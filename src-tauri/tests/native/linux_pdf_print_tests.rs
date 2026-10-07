use super::{operation, poppler_page_render_for_printing, print_pdf, PdfDocument};
use crate::pdf_engine::{render_pdf, PdfDocumentRequest};
use gtk::prelude::*;

fn raster(document: &PdfDocument, index: i32) -> Vec<u8> {
    let page = document.page(index).unwrap();
    let (width, height) = PdfDocument::size(&page);
    let mut surface =
        gtk::cairo::ImageSurface::create(gtk::cairo::Format::Rgb24, (width * 2.0).ceil() as i32, (height * 2.0).ceil() as i32)
            .unwrap();
    let context = gtk::cairo::Context::new(&surface).unwrap();
    context.set_source_rgb(1.0, 1.0, 1.0);
    context.paint().unwrap();
    context.scale(2.0, 2.0);
    unsafe { poppler_page_render_for_printing(page.as_ptr(), context.to_raw_none().cast()) };
    drop(context);
    surface.flush();
    surface.data().unwrap().to_vec()
}

fn requests() -> [PdfDocumentRequest; 2] {
    let rows: Vec<_> = (1..=70)
        .map(|index| {
            serde_json::json!({
                "index": index, "dateTime": "2026-10-01 12:00", "category": "Driving", "severity": "Serious",
                "description": "Synthetic driving infringement", "legalReference": "Synthetic reference",
                "measured": "10h 15m", "allowed": "9h 00m", "excess": "1h 15m"
            })
        })
        .collect();
    [
        serde_json::from_value(serde_json::json!({
            "kind": "infringementLetter", "title": "Synthetic letter", "companyName": "Example transport",
            "driverName": "Synthetic driver", "driverNameLabel": "Driver", "infringements": rows,
            "numHeader": "#", "dateTimeHeader": "Date", "categoryHeader": "Category", "severityHeader": "Severity",
            "driverComments": "Synthetic driver explanation", "driverDeclarationText": "Synthetic declaration",
            "driverSignatureLabel": "Driver signature", "operatorSignatureLabel": "Operator signature", "locale": "en"
        }))
        .unwrap(),
        serde_json::from_value(serde_json::json!({
            "kind": "attestationForm", "title": "Synthetic attestation", "companyName": "Example transport",
            "driverName": "Synthetic driver", "box1Label": "Undertaking", "box8Label": "Driver",
            "undertakingPartTitle": "Undertaking", "driverPartTitle": "Driver", "periodPartTitle": "Period",
            "driverDob": "1980-01-01", "periodStart": "2026-10-01 00:00", "periodEnd": "2026-10-05 23:59",
            "reasonKey": "annualLeave", "box15Label": "Annual leave", "signatureLabel": "Signature",
            "driverSignatureLabel": "Driver signature", "undersignedLabel": "Undersigned", "locale": "en"
        }))
        .unwrap(),
    ]
}

#[test]
fn poppler_reads_the_existing_native_pdf_output_and_a4_dimensions() {
    for request in requests() {
        let document = PdfDocument::new(render_pdf(&request).unwrap()).unwrap();
        assert!(document.page_count() > 0);
        let (width, height) = PdfDocument::size(&document.page(0).unwrap());
        assert!((width - 595.28).abs() < 0.1);
        assert!((height - 841.89).abs() < 0.1);
        assert!(document.page(-1).is_err());
        assert!(document.page(document.page_count()).is_err());
    }
    assert!(PdfDocument::new(b"invalid PDF".to_vec()).is_err());
}

#[test]
#[ignore = "requires a desktop session; exports through the real GTK print pipeline"]
fn gtk_pdf_print_opens_cancels_and_preserves_exported_layout() {
    gtk::init().unwrap();
    assert_print_dialog_cancellation();
    for (index, request) in requests().into_iter().enumerate() {
        let bytes = render_pdf(&request).unwrap();
        let original = PdfDocument::new(bytes.clone()).unwrap();
        let (print, failed) = operation(bytes).unwrap();
        let output = std::env::temp_dir().join(format!("esm-pdf-print-{}-{index}.pdf", std::process::id()));
        print.set_export_filename(output.to_str().unwrap());
        assert_eq!(print.run(gtk::PrintOperationAction::Export, None::<&gtk::Window>).unwrap(), gtk::PrintOperationResult::Apply);
        assert!(!failed.get());
        let printed = PdfDocument::new(std::fs::read(&output).unwrap()).unwrap();
        assert_eq!(printed.page_count(), original.page_count());
        let actual = PdfDocument::size(&printed.page(0).unwrap());
        let expected = PdfDocument::size(&original.page(0).unwrap());
        assert!((actual.0 - expected.0).abs() < 0.1);
        assert!((actual.1 - expected.1).abs() < 0.1);
        for page in 0..original.page_count() {
            let source = raster(&original, page);
            let printed = raster(&printed, page);
            assert_eq!(source.len(), printed.len());
            let mut ink_pixels = 0usize;
            let mut different_pixels = 0usize;
            for (before, after) in source.as_chunks::<4>().0.iter().zip(printed.as_chunks::<4>().0.iter()) {
                if before[0] < 220 || after[0] < 220 {
                    ink_pixels += 1;
                    if before[0].abs_diff(after[0]) > 40 {
                        different_pixels += 1;
                    }
                }
            }
            assert!(ink_pixels > 0);
            assert!(
                different_pixels * 5 < ink_pixels,
                "Print changed the PDF's text or geometry: {different_pixels}/{ink_pixels} pixels differ"
            );
        }
        std::fs::remove_file(output).unwrap();
    }
}

fn assert_print_dialog_cancellation() {
    for request in requests() {
        let cancelled = std::rc::Rc::new(std::cell::Cell::new(false));
        let observed = std::rc::Rc::clone(&cancelled);
        let timer = gtk::glib::timeout_add_local(std::time::Duration::from_millis(100), move || {
            for window in gtk::Window::list_toplevels() {
                if window.type_().name() == "GtkPrintUnixDialog" {
                    let dialog = window.downcast::<gtk::Dialog>().unwrap();
                    observed.set(true);
                    dialog.response(gtk::ResponseType::Cancel);
                    return gtk::glib::ControlFlow::Break;
                }
            }
            gtk::glib::ControlFlow::Continue
        });
        let result = print_pdf(render_pdf(&request).unwrap(), None);
        if !cancelled.get() {
            timer.remove();
        }
        result.unwrap();
        assert!(cancelled.get(), "The native print panel must open before cancellation completes");
    }
}
