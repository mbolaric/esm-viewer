use std::cell::Cell;
use std::ffi::{c_char, c_void};
use std::rc::Rc;

use gtk::glib::{self, translate::*};
use gtk::prelude::*;
use gtk::{PageSetup, PaperSize, PrintOperation, PrintOperationAction, PrintOperationResult, Unit};

use super::page::place_page;

// The public GLib ABI avoids depending on Poppler's unstable core interfaces.
unsafe extern "C" {
    fn poppler_document_new_from_bytes(
        bytes: *mut glib::ffi::GBytes,
        password: *const c_char,
        error: *mut *mut glib::ffi::GError,
    ) -> *mut glib::gobject_ffi::GObject;
    fn poppler_document_get_n_pages(document: *mut glib::gobject_ffi::GObject) -> i32;
    fn poppler_document_get_page(document: *mut glib::gobject_ffi::GObject, index: i32) -> *mut glib::gobject_ffi::GObject;
    fn poppler_page_get_size(page: *mut glib::gobject_ffi::GObject, width: *mut f64, height: *mut f64);
    fn poppler_page_render_for_printing(page: *mut glib::gobject_ffi::GObject, context: *mut c_void);
}

struct PdfDocument(glib::Object);

impl PdfDocument {
    fn new(bytes: Vec<u8>) -> Result<Self, String> {
        let bytes = glib::Bytes::from_owned(bytes);
        let mut error = std::ptr::null_mut();
        // Poppler retains the GBytes; from_glib_full owns its returned GObject.
        let document = unsafe { poppler_document_new_from_bytes(bytes.to_glib_none().0, std::ptr::null(), &mut error) };
        if !error.is_null() {
            unsafe { glib::ffi::g_error_free(error) };
        }
        if document.is_null() {
            return Err("The PDF could not be loaded for printing.".to_string());
        }
        Ok(Self(unsafe { from_glib_full(document) }))
    }

    fn page_count(&self) -> i32 {
        unsafe { poppler_document_get_n_pages(self.0.as_ptr()) }
    }

    fn page(&self, index: i32) -> Result<glib::Object, String> {
        if index < 0 || index >= self.page_count() {
            return Err("The PDF page is unavailable.".to_string());
        }
        let page = unsafe { poppler_document_get_page(self.0.as_ptr(), index) };
        if page.is_null() {
            return Err("The PDF page is unavailable.".to_string());
        }
        Ok(unsafe { from_glib_full(page) })
    }

    fn size(page: &glib::Object) -> (f64, f64) {
        let (mut width, mut height) = (0.0, 0.0);
        unsafe { poppler_page_get_size(page.as_ptr(), &mut width, &mut height) };
        (width, height)
    }

    fn draw(&self, index: i32, context: &gtk::PrintContext) -> Result<(), String> {
        let page = self.page(index)?;
        let (width, height) = Self::size(&page);
        let placement = place_page(width, height, context.width(), context.height())?;
        let cairo = context.cairo_context().ok_or_else(|| "The print surface is unavailable.".to_string())?;
        cairo.save().map_err(|_| "The print surface is unavailable.".to_string())?;
        cairo.translate(placement.x, placement.y);
        cairo.scale(placement.scale, placement.scale);
        unsafe { poppler_page_render_for_printing(page.as_ptr(), cairo.to_raw_none().cast()) };
        cairo.restore().map_err(|_| "The PDF page could not be printed.".to_string())?;
        cairo.status().map_err(|_| "The PDF page could not be printed.".to_string())
    }
}

fn operation(bytes: Vec<u8>) -> Result<(PrintOperation, Rc<Cell<bool>>), String> {
    let document = PdfDocument::new(bytes)?;
    let pages = document.page_count();
    if pages < 1 {
        return Err("The PDF has no printable pages.".to_string());
    }
    let (width, height) = PdfDocument::size(&document.page(0)?);
    place_page(width, height, width, height)?;
    let setup = PageSetup::new();
    setup.set_paper_size(&PaperSize::new_custom("pdf-page", "A4", width, height, Unit::Points));
    setup.set_top_margin(0.0, Unit::Points);
    setup.set_bottom_margin(0.0, Unit::Points);
    setup.set_left_margin(0.0, Unit::Points);
    setup.set_right_margin(0.0, Unit::Points);
    let operation = PrintOperation::new();
    operation.set_job_name("ESM Viewer");
    operation.set_unit(Unit::Points);
    operation.set_use_full_page(true);
    operation.set_default_page_setup(Some(&setup));
    operation.set_n_pages(pages);
    operation.set_allow_async(false);
    let failed = Rc::new(Cell::new(false));
    let draw_failed = Rc::clone(&failed);
    operation.connect_draw_page(move |operation, context, page| {
        if document.draw(page, context).is_err() {
            draw_failed.set(true);
            operation.cancel();
        }
    });
    Ok((operation, failed))
}

pub(super) fn print_pdf(bytes: Vec<u8>, parent: Option<&gtk::ApplicationWindow>) -> Result<(), String> {
    let (operation, failed) = operation(bytes)?;
    let result =
        operation.run(PrintOperationAction::PrintDialog, parent).map_err(|_| "The native print operation failed.".to_string())?;
    if failed.get() || !matches!(result, PrintOperationResult::Apply | PrintOperationResult::Cancel) {
        return Err("The native print operation failed.".to_string());
    }
    Ok(())
}

#[cfg(test)]
#[path = "../../tests/native/linux_pdf_print_tests.rs"]
mod tests;
