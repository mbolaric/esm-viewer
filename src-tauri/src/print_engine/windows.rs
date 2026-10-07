use std::mem::size_of;

use tauri::Manager;
use windows::core::w;
use windows::Data::Pdf::{PdfDocument, PdfPage, PdfPageRenderOptions};
use windows::Graphics::Imaging::{
    BitmapAlphaMode, BitmapDecoder, BitmapPixelFormat, BitmapTransform, ColorManagementMode, ExifOrientationMode,
};
use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};
use windows::Win32::Foundation::{GetLastError, GlobalFree, HWND};
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::Storage::Xps::{AbortDoc, EndDoc, EndPage, StartDocW, StartPage, DOCINFOW};
use windows::Win32::System::Com::{CoGetApartmentType, APTTYPE, APTTYPEQUALIFIER, APTTYPE_MAINSTA, APTTYPE_STA};
use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};
use windows::Win32::System::WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED};
use windows::Win32::UI::Controls::Dialogs::*;

use super::page::place_page;

const RENDER_DPI: f64 = 300.0;

struct Runtime;

impl Drop for Runtime {
    fn drop(&mut self) {
        unsafe { RoUninitialize() };
    }
}

struct PrintDialog(PRINTDLGEXW);

impl Drop for PrintDialog {
    fn drop(&mut self) {
        unsafe {
            if !self.0.hDC.is_invalid() {
                let _ = DeleteDC(self.0.hDC);
            }
            if !self.0.hDevMode.is_invalid() {
                let _ = GlobalFree(Some(self.0.hDevMode));
            }
            if !self.0.hDevNames.is_invalid() {
                let _ = GlobalFree(Some(self.0.hDevNames));
            }
        }
    }
}

struct Printer {
    dc: HDC,
    first_page: u32,
    last_page: u32,
}

// SAFETY: The printer DC is a process-local GDI handle, used by one owner at a
// time. Dialog objects, callbacks, and global settings never leave the UI thread.
unsafe impl Send for Printer {}

impl Drop for Printer {
    fn drop(&mut self) {
        unsafe {
            let _ = DeleteDC(self.dc);
        }
    }
}

fn api_failure(stage: &'static str, code: u32) -> String {
    format!("print.windows.{stage} code=0x{code:08X}")
}

fn hresult_failure(stage: &'static str, error: windows::core::Error) -> String {
    api_failure(stage, error.code().0 as u32)
}

fn last_failure(stage: &'static str) -> String {
    api_failure(stage, unsafe { GetLastError().0 })
}

// An interrupted render must abort the spool job rather than submit partial pages.
struct PrintJob(HDC);

impl Drop for PrintJob {
    fn drop(&mut self) {
        if !self.0.is_invalid() {
            unsafe { AbortDoc(self.0) };
        }
    }
}

fn printer_dialog(parent: isize, pages: u32) -> Result<Option<Printer>, String> {
    let (mut apartment, mut qualifier) = (APTTYPE::default(), APTTYPEQUALIFIER::default());
    unsafe { CoGetApartmentType(&mut apartment, &mut qualifier) }.map_err(|error| hresult_failure("dialog-apartment", error))?;
    if apartment != APTTYPE_STA && apartment != APTTYPE_MAINSTA {
        return Err("print.windows.dialog-requires-sta".to_string());
    }
    let mut range = PRINTPAGERANGE { nFromPage: 1, nToPage: pages };
    let mut printer = PrintDialog(PRINTDLGEXW {
        lStructSize: size_of::<PRINTDLGEXW>() as u32,
        hwndOwner: HWND(parent as *mut _),
        Flags: PD_RETURNDC | PD_NOSELECTION | PD_NOCURRENTPAGE | PD_USEDEVMODECOPIESANDCOLLATE,
        nMaxPageRanges: 1,
        lpPageRanges: &mut range,
        nMinPage: 1,
        nMaxPage: pages,
        nCopies: 1,
        nStartPage: START_PAGE_GENERAL,
        ..Default::default()
    });
    // Fetch settings without displaying a dialog, then default to the PDF's A4 paper.
    // The user can choose another printer or paper in the actual print panel.
    let mut defaults = PRINTDLGW { lStructSize: size_of::<PRINTDLGW>() as u32, Flags: PD_RETURNDEFAULT, ..Default::default() };
    unsafe {
        let _ = PrintDlgW(&mut defaults);
        printer.0.hDevMode = defaults.hDevMode;
        printer.0.hDevNames = defaults.hDevNames;
        if !printer.0.hDevMode.is_invalid() {
            let mode = GlobalLock(printer.0.hDevMode).cast::<DEVMODEW>();
            if let Some(mode) = mode.as_mut() {
                mode.dmFields |= DM_PAPERSIZE | DM_ORIENTATION;
                mode.Anonymous1.Anonymous1.dmPaperSize = DMPAPER_A4 as i16;
                mode.Anonymous1.Anonymous1.dmOrientation = DMORIENT_PORTRAIT as i16;
                let _ = GlobalUnlock(printer.0.hDevMode);
            }
        }
        PrintDlgExW(&mut printer.0).map_err(|error| hresult_failure("dialog", error))?;
    }
    if printer.0.dwResultAction != PD_RESULT_PRINT {
        return Ok(None);
    }
    if printer.0.hDC.is_invalid() {
        return Err("print.windows.printer-unavailable".to_string());
    }
    let (first_page, last_page) = if printer.0.Flags.contains(PD_PAGENUMS) && printer.0.nPageRanges > 0 {
        (range.nFromPage.max(1), range.nToPage.min(pages))
    } else {
        (1, pages)
    };
    if first_page > last_page {
        return Err("print.windows.invalid-page-range".to_string());
    }
    let dc = std::mem::take(&mut printer.0.hDC);
    Ok(Some(Printer { dc, first_page, last_page }))
}

fn load_pdf(bytes: &[u8]) -> windows::core::Result<PdfDocument> {
    let stream = InMemoryRandomAccessStream::new()?;
    let writer = DataWriter::CreateDataWriter(&stream)?;
    writer.WriteBytes(bytes)?;
    writer.StoreAsync()?.join()?;
    writer.DetachStream()?;
    stream.Seek(0)?;
    PdfDocument::LoadFromStreamAsync(&stream)?.join()
}

struct PageBitmap {
    pixels: windows::core::Array<u8>,
    width: i32,
    height: i32,
}

fn render_page(page: &PdfPage) -> windows::core::Result<PageBitmap> {
    let size = page.Size()?;
    let options = PdfPageRenderOptions::new()?;
    options.SetDestinationWidth((f64::from(size.Width) * RENDER_DPI / 96.0).ceil() as u32)?;
    options.SetDestinationHeight((f64::from(size.Height) * RENDER_DPI / 96.0).ceil() as u32)?;
    options.SetIsIgnoringHighContrast(true)?;
    let stream = InMemoryRandomAccessStream::new()?;
    page.RenderWithOptionsToStreamAsync(&stream, &options)?.join()?;
    stream.Seek(0)?;
    let decoder = BitmapDecoder::CreateAsync(&stream)?.join()?;
    let width = decoder.PixelWidth()? as i32;
    let height = decoder.PixelHeight()? as i32;
    let data = decoder
        .GetPixelDataTransformedAsync(
            BitmapPixelFormat::Bgra8,
            BitmapAlphaMode::Ignore,
            &BitmapTransform::new()?,
            ExifOrientationMode::IgnoreExifOrientation,
            ColorManagementMode::DoNotColorManage,
        )?
        .join()?;
    Ok(PageBitmap { pixels: data.DetachPixelData()?, width, height })
}

fn draw_page(page: &PdfPage, dc: HDC) -> Result<(), String> {
    let size = page.Size().map_err(|error| hresult_failure("pdf-page-size", error))?;
    // WinRT dimensions use 96 DPI, while printer coordinates use device pixels.
    let width = f64::from(size.Width) * 72.0 / 96.0;
    let height = f64::from(size.Height) * 72.0 / 96.0;
    let (dpi_x, dpi_y, paper_width, paper_height, offset_x, offset_y) = unsafe {
        (
            GetDeviceCaps(Some(dc), LOGPIXELSX),
            GetDeviceCaps(Some(dc), LOGPIXELSY),
            GetDeviceCaps(Some(dc), PHYSICALWIDTH),
            GetDeviceCaps(Some(dc), PHYSICALHEIGHT),
            GetDeviceCaps(Some(dc), PHYSICALOFFSETX),
            GetDeviceCaps(Some(dc), PHYSICALOFFSETY),
        )
    };
    if dpi_x <= 0 || dpi_y <= 0 {
        return Err("print.windows.printer-resolution".to_string());
    }
    let placement = place_page(
        width,
        height,
        f64::from(paper_width) * 72.0 / f64::from(dpi_x),
        f64::from(paper_height) * 72.0 / f64::from(dpi_y),
    )?;
    let bitmap = render_page(page).map_err(|error| hresult_failure("pdf-page-render", error))?;
    if bitmap.width <= 0 || bitmap.height <= 0 || bitmap.pixels.len() != bitmap.width as usize * bitmap.height as usize * 4 {
        return Err("print.windows.invalid-bitmap".to_string());
    }
    let info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: bitmap.width,
            biHeight: -bitmap.height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    let result = unsafe {
        SetStretchBltMode(dc, HALFTONE);
        StretchDIBits(
            dc,
            (placement.x * f64::from(dpi_x) / 72.0).round() as i32 - offset_x,
            (placement.y * f64::from(dpi_y) / 72.0).round() as i32 - offset_y,
            (width * placement.scale * f64::from(dpi_x) / 72.0).round() as i32,
            (height * placement.scale * f64::from(dpi_y) / 72.0).round() as i32,
            0,
            0,
            bitmap.width,
            bitmap.height,
            Some(bitmap.pixels.as_ptr().cast()),
            &info,
            DIB_RGB_COLORS,
            SRCCOPY,
        )
    };
    if result <= 0 {
        return Err(last_failure("page-draw"));
    }
    Ok(())
}

fn spool_pdf(bytes: &[u8], select_printer: impl FnOnce(u32) -> Result<Option<Printer>, String>) -> Result<(), String> {
    // A blocking worker keeps WinRT page rendering and printer spooling off the UI thread.
    unsafe { RoInitialize(RO_INIT_MULTITHREADED) }.map_err(|error| hresult_failure("pdf-runtime", error))?;
    let _runtime = Runtime;
    let document = load_pdf(bytes).map_err(|error| hresult_failure("pdf-load", error))?;
    let pages = document.PageCount().map_err(|error| hresult_failure("pdf-page-count", error))?;
    if pages == 0 {
        return Err("print.windows.no-pages".to_string());
    }
    let Some(printer) = select_printer(pages)? else {
        return Ok(());
    };
    let info = DOCINFOW { cbSize: size_of::<DOCINFOW>() as i32, lpszDocName: w!("ESM Viewer"), ..Default::default() };
    if unsafe { StartDocW(printer.dc, &info) } <= 0 {
        return Err(last_failure("job-start"));
    }
    let mut job = PrintJob(printer.dc);
    for index in printer.first_page - 1..printer.last_page {
        if unsafe { StartPage(job.0) } <= 0 {
            return Err(last_failure("page-start"));
        }
        let page = document.GetPage(index).map_err(|error| hresult_failure("pdf-page", error))?;
        let result = draw_page(&page, job.0);
        let _ = page.Close();
        result?;
        if unsafe { EndPage(job.0) } <= 0 {
            return Err(last_failure("page-end"));
        }
    }
    if unsafe { EndDoc(job.0) } <= 0 {
        return Err(last_failure("job-end"));
    }
    job.0 = HDC::default();
    Ok(())
}

pub(super) async fn print_pdf<R: tauri::Runtime>(bytes: Vec<u8>, window: tauri::WebviewWindow<R>) -> Result<(), String> {
    let app = window.app_handle().clone();
    let result = crate::blocking::run_blocking_string(move || {
        spool_pdf(&bytes, move |pages| {
            let (sender, receiver) = std::sync::mpsc::channel();
            let parent = window.clone();
            window
                .run_on_main_thread(move || {
                    let selection = parent
                        .hwnd()
                        .map_err(|_| "print.windows.owner-window".to_string())
                        .and_then(|parent| printer_dialog(parent.0 as isize, pages));
                    let _ = sender.send(selection);
                })
                .map_err(|_| "print.windows.dialog-dispatch".to_string())?;
            receiver.recv().map_err(|_| "print.windows.dialog-interrupted".to_string())?
        })
    })
    .await;
    if let Err(reason) = &result {
        let diagnostic = if reason.starts_with("print.windows.") { reason.as_str() } else { "print.windows.worker-failed" };
        let _ = crate::logger::append_debug_log(&app, "print_engine", diagnostic, None, "error");
    }
    result
}

#[cfg(test)]
#[path = "../../tests/native/windows_pdf_print_tests.rs"]
mod tests;
