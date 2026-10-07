use objc2::AnyThread;
use objc2_app_kit::NSPrintInfo;
use objc2_foundation::{MainThreadMarker, NSCopying, NSData, NSSize};
use objc2_pdf_kit::{PDFDocument, PDFPrintScalingMode};

pub(super) fn print_pdf(bytes: &[u8]) -> Result<(), String> {
    let mtm = MainThreadMarker::new().ok_or_else(|| "The print dialog requires the main thread.".to_string())?;
    objc2::rc::autoreleasepool(|_| {
        let data = NSData::with_bytes(bytes);
        // PDFKit reads only the app-generated PDF, and all AppKit access stays on the main thread.
        let document = unsafe { PDFDocument::initWithData(PDFDocument::alloc(), &data) }
            .ok_or_else(|| "The PDF could not be loaded for printing.".to_string())?;
        let info = NSPrintInfo::sharedPrintInfo().copy();
        info.setPaperSize(NSSize::new(210.0 * 72.0 / 25.4, 297.0 * 72.0 / 25.4));
        info.setTopMargin(0.0);
        info.setBottomMargin(0.0);
        info.setLeftMargin(0.0);
        info.setRightMargin(0.0);
        let operation = unsafe {
            document.printOperationForPrintInfo_scalingMode_autoRotate(
                Some(&info),
                PDFPrintScalingMode::PageScaleDownToFit,
                true,
                mtm,
            )
        }
        .ok_or_else(|| "The PDF print operation is unavailable.".to_string())?;
        operation.setShowsPrintPanel(true);
        operation.runOperation();
        Ok(())
    })
}
