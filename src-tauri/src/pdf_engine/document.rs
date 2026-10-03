// Dispatches a typed document request to the renderer that builds it.

use serde::{Deserialize, Serialize};

use super::{attestation, infringement, report};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PdfDocumentRequest {
    InfringementLetter(Box<infringement::InfringementLetterPdfRequest>),
    AttestationForm(Box<attestation::AttestationFormPdfRequest>),
    FactualReport(Box<report::FactualReportPdfRequest>),
}

// Renders the requested document to vector PDF bytes.
pub fn render_pdf(request: &PdfDocumentRequest) -> Result<Vec<u8>, String> {
    match request {
        PdfDocumentRequest::InfringementLetter(req) => infringement::render_infringement_letter(req),
        PdfDocumentRequest::AttestationForm(req) => attestation::render_attestation_form(req),
        PdfDocumentRequest::FactualReport(req) => report::render_factual_report(req),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Counts /Type/Page objects excluding /Type/Pages in raw PDF bytes.
    fn rendered_page_count(bytes: &[u8]) -> usize {
        let page_marker: &[u8] = b"/Type/Page";
        let pages_marker: &[u8] = b"/Type/Pages";
        let mut count = 0usize;
        let mut index = 0usize;
        while index + pages_marker.len() <= bytes.len() {
            let window = &bytes[index..index + page_marker.len()];
            if window == page_marker && &bytes[index..index + pages_marker.len()] != pages_marker {
                count += 1;
            }
            index += 1;
        }
        count
    }

    #[test]
    fn test_render_infringement_letter_pdf() {
        let req = PdfDocumentRequest::InfringementLetter(Box::new(infringement::InfringementLetterPdfRequest {
            company_name: "Test Transport Ltd".to_string(),
            company_address: "123 High Street, London".to_string(),
            driver_name: "John Doe".to_string(),
            card_number: "DF1234567890".to_string(),
            issuing_country: "UK".to_string(),
            vehicle_registration: "AB12 CDE".to_string(),
            vin: "WDB12345678901234".to_string(),
            file_name: "C_DF1234567890.ddd".to_string(),
            date_printed: "2026-08-28".to_string(),
            infringements: vec![infringement::InfringementItemDto {
                index: 1,
                date_time: "2026-08-20 14:30".to_string(),
                category: "Driving Time".to_string(),
                severity: "Serious".to_string(),
                description: "Daily driving limit exceeded (10h 15m > 9h 00m)".to_string(),
                legal_reference: "Reg (EC) 561/2006 Art. 6(1)".to_string(),
                measured: "10h 15m".to_string(),
                allowed: "9h 00m".to_string(),
                excess: "+1h 15m".to_string(),
            }],
            title: "DRIVER INFRINGEMENT ACKNOWLEDGEMENT LETTER".to_string(),
            company_details_title: "Operator Details".to_string(),
            driver_details_title: "Driver Details".to_string(),
            date_printed_label: "Date Printed".to_string(),
            file_label: "Source File".to_string(),
            driver_name_label: "Driver Name".to_string(),
            card_number_label: "Card Number".to_string(),
            issuing_country_label: "Issuing Member State".to_string(),
            vehicle_label: "Vehicle Registration".to_string(),
            vin_label: "VIN".to_string(),
            total_infringements_label: "Total Infringements".to_string(),
            intro_text: "The following driving time infringements were detected:".to_string(),
            num_header: "#".to_string(),
            date_time_header: "Date / Time".to_string(),
            category_header: "Category".to_string(),
            description_header: "Description".to_string(),
            measured_header: "Measured".to_string(),
            allowed_header: "Limit".to_string(),
            excess_header: "Excess".to_string(),
            severity_header: "Severity".to_string(),
            driver_comments_title: "Driver Explanations & Comments (Art. 12 Reg. 561/2006)".to_string(),
            driver_comments: "Driver statement on exceptional circumstances...".to_string(),
            driver_declaration_text: "I hereby confirm receipt of this notification...".to_string(),
            driver_signature_label: "Driver Signature".to_string(),
            operator_signature_label: "Operator Signature".to_string(),
            date_signature_label: "Date".to_string(),
            footer_notice: "Confidential Transport Compliance Record".to_string(),
            locale: "en".to_string(),
        }));

        let result = render_pdf(&req);
        assert!(result.is_ok(), "PDF generation failed: {:?}", result.err());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty(), "PDF bytes should not be empty");
        assert_eq!(&bytes[0..4], b"%PDF", "PDF bytes should start with %PDF magic header");
    }

    #[test]
    fn test_render_attestation_form_pdf() {
        let req = PdfDocumentRequest::AttestationForm(Box::new(attestation::AttestationFormPdfRequest {
            company_name: "Test Logistics GmbH".to_string(),
            company_address: "Musterstr. 10, Berlin".to_string(),
            company_phone: "+49 30 123456".to_string(),
            company_fax: "".to_string(),
            company_email: "info@logistics.de".to_string(),
            signatory_name: "Max Mustermann".to_string(),
            signatory_position: "Compliance Manager".to_string(),
            driver_name: "Erika Muster".to_string(),
            driver_dob: "1985-05-12".to_string(),
            driving_licence: "DL987654321".to_string(),
            employment_start: "2020-01-15".to_string(),
            period_start: "2026-08-01 00:00".to_string(),
            period_end: "2026-08-14 23:59".to_string(),
            reason_key: "annualLeave".to_string(),
            place: "Berlin".to_string(),
            date: "2026-08-28".to_string(),
            title: "ATTESTATION OF ACTIVITIES".to_string(),
            subtitle: "REGULATION (EC) 561/2006 OR AETR".to_string(),
            instructions: "To be filled in by typing and signed before a journey".to_string(),
            undertaking_part_title: "Part to be filled in by the undertaking".to_string(),
            driver_part_title: "Part to be filled in by the driver".to_string(),
            period_part_title: "Period of Activity".to_string(),
            box1_label: "Name of undertaking".to_string(),
            box2_label: "Address".to_string(),
            box3_label: "Telephone".to_string(),
            box4_label: "Fax".to_string(),
            box5_label: "E-mail".to_string(),
            box6_label: "Name of signatory".to_string(),
            box7_label: "Position".to_string(),
            box8_label: "Driver Name".to_string(),
            box9_label: "Date of birth".to_string(),
            box10_label: "Driving licence or card number".to_string(),
            box11_label: "Date commenced employment".to_string(),
            box12_label: "From (time / day / month / year)".to_string(),
            box13_label: "To (time / day / month / year)".to_string(),
            box14_label: "was on sick leave".to_string(),
            box15_label: "was on annual leave".to_string(),
            box16_label: "was on leave or rest".to_string(),
            box17_label: "drove a vehicle out of the scope of Regulation (EC) 561/2006 or AETR".to_string(),
            box18_label: "performed other work than driving".to_string(),
            box19_label: "was available".to_string(),
            box20_label: "Place".to_string(),
            box21_label: "Signature of the undertaking".to_string(),
            box22_label: "Signature of the driver".to_string(),
            warning: "False attestations constitute a serious infringement".to_string(),
            footnote: "This form is available in electronic version at https://transport.ec.europa.eu".to_string(),
            undersigned_label: "Ich, der Unterzeichnete:".to_string(),
            date_label: "Datum:".to_string(),
            signature_label: "Unterschrift:".to_string(),
            driver_signature_label: "Unterschrift des Fahrers:".to_string(),
            locale: "en".to_string(),
        }));

        let result = render_pdf(&req);
        assert!(result.is_ok(), "Attestation PDF generation failed: {:?}", result.err());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        assert_eq!(&bytes[0..4], b"%PDF");
        // The EU form must fit on exactly one A4 page.
        assert_eq!(rendered_page_count(&bytes), 1, "Attestation PDF must stay on one page");
    }

    #[test]
    fn test_render_factual_report_pdf() {
        let req = PdfDocumentRequest::FactualReport(Box::new(report::FactualReportPdfRequest {
            title: "FACTUAL TECHNICAL REPORT".to_string(),
            subtitle: "Digital Tachograph Source Data".to_string(),
            header_fields: vec![
                report::ReportSummaryItemDto { label: "Driver".to_string(), value: "Mato Jelec".to_string() },
                report::ReportSummaryItemDto { label: "Card Number".to_string(), value: "DF123456789".to_string() },
                report::ReportSummaryItemDto { label: "File".to_string(), value: "C_TEST_DRIVER.ddd".to_string() },
                report::ReportSummaryItemDto { label: "Generated".to_string(), value: "2026-08-28 12:00 UTC".to_string() },
            ],
            summary_title: "Activity Summary".to_string(),
            summary_items: vec![
                report::ReportSummaryItemDto { label: "Total Driving".to_string(), value: "45h 12m".to_string() },
                report::ReportSummaryItemDto { label: "Total Work".to_string(), value: "12h 45m".to_string() },
            ],
            sections: vec![report::ReportTableSectionDto {
                title: "Daily Records".to_string(),
                subtitle: "Summary of driver activities".to_string(),
                timeline: Some(report::ActivityTimelineDayDto {
                    total_ms: 86_400_000,
                    segments: vec![
                        report::ActivitySegmentDto {
                            timeline_start_ms: 0,
                            timeline_end_ms: 28_800_000,
                            activity: "breakOrRest".to_string(),
                        },
                        report::ActivitySegmentDto {
                            timeline_start_ms: 28_800_000,
                            timeline_end_ms: 45_000_000,
                            activity: "driving".to_string(),
                        },
                    ],
                }),
                headers: vec!["Date".to_string(), "Driving".to_string(), "Rest".to_string()],
                rows: vec![report::ReportTableRowDto {
                    cells: vec!["2026-08-20".to_string(), "08:30".to_string(), "11:00".to_string()],
                }],
            }],
            footer_notice: "Factual record export - non-modifiable raw source evidence".to_string(),
            orientation: "portrait".to_string(),
            locale: "en".to_string(),
        }));

        let result = render_pdf(&req);
        assert!(result.is_ok(), "Factual Report PDF generation failed: {:?}", result.err());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        assert_eq!(&bytes[0..4], b"%PDF");
    }

    // Asserts landscape orientation produces different geometry than portrait.
    #[test]
    fn test_render_factual_report_landscape_orientation_differs_from_portrait() {
        fn minimal_request(orientation: &str) -> report::FactualReportPdfRequest {
            report::FactualReportPdfRequest {
                title: "COMPARISON REPORT".to_string(),
                subtitle: String::new(),
                header_fields: vec![
                    report::ReportSummaryItemDto { label: "Documents".to_string(), value: "2".to_string() },
                    report::ReportSummaryItemDto { label: "Differing fields".to_string(), value: "0".to_string() },
                    report::ReportSummaryItemDto { label: "Scope".to_string(), value: "Session comparison".to_string() },
                    report::ReportSummaryItemDto { label: "Generated".to_string(), value: "2026-09-04 12:00 UTC".to_string() },
                ],
                summary_title: "Overview".to_string(),
                summary_items: vec![],
                sections: vec![],
                footer_notice: String::new(),
                orientation: orientation.to_string(),
                locale: "en".to_string(),
            }
        }

        let landscape = report::render_factual_report(&minimal_request("landscape")).unwrap();
        let portrait = report::render_factual_report(&minimal_request("portrait")).unwrap();

        assert_eq!(&landscape[0..4], b"%PDF");
        assert_eq!(&portrait[0..4], b"%PDF");
        assert_ne!(landscape, portrait, "landscape and portrait orientation must render different page geometry");
    }

    // Translated labels and values can hold one long word that is wider than a narrow table column. Previously genpdfi
    // failed the whole document with "Page overflowed while trying to wrap a string".
    #[test]
    fn test_render_tables_with_words_wider_than_their_columns() {
        let long_word = "Geschwindigkeitsüberschreitungsdauer";
        let letter = PdfDocumentRequest::InfringementLetter(Box::new(infringement::InfringementLetterPdfRequest {
            title: "Verstoßmitteilung".to_string(),
            num_header: long_word.to_string(),
            date_time_header: long_word.to_string(),
            measured_header: long_word.to_string(),
            allowed_header: long_word.to_string(),
            excess_header: long_word.to_string(),
            severity_header: long_word.to_string(),
            infringements: vec![infringement::InfringementItemDto {
                index: 1,
                date_time: long_word.to_string(),
                severity: long_word.to_string(),
                description: long_word.to_string(),
                legal_reference: long_word.to_string(),
                measured: long_word.to_string(),
                allowed: long_word.to_string(),
                excess: long_word.to_string(),
                ..Default::default()
            }],
            locale: "de".to_string(),
            ..Default::default()
        }));
        let columns: Vec<String> = (0..11).map(|_| long_word.to_string()).collect();
        let report = PdfDocumentRequest::FactualReport(Box::new(report::FactualReportPdfRequest {
            title: "Bericht".to_string(),
            sections: vec![report::ReportTableSectionDto {
                title: "Abschnitt".to_string(),
                headers: columns.clone(),
                rows: vec![report::ReportTableRowDto { cells: columns }],
                ..Default::default()
            }],
            orientation: "portrait".to_string(),
            locale: "de".to_string(),
            ..Default::default()
        }));

        for (name, request) in [("infringement letter", letter), ("factual report", report)] {
            let bytes = render_pdf(&request).unwrap_or_else(|error| panic!("{name}: narrow columns must wrap: {error}"));
            assert_eq!(&bytes[0..4], b"%PDF");
        }
    }

    // Replaces every free-text string in the request, so a paragraph added later without width fitting fails here.
    fn fill_text_fields(value: &mut serde_json::Value, text: &str) {
        match value {
            serde_json::Value::String(existing) => *existing = text.to_string(),
            serde_json::Value::Array(items) => items.iter_mut().for_each(|item| fill_text_fields(item, text)),
            serde_json::Value::Object(fields) => {
                for (key, field) in fields.iter_mut() {
                    if !matches!(key.as_str(), "kind" | "locale" | "orientation" | "activity") {
                        fill_text_fields(field, text);
                    }
                }
            }
            _ => {}
        }
    }

    #[test]
    fn test_render_every_text_field_with_a_word_wider_than_the_page() {
        let page_wide_word = "Geschwindigkeitsüberschreitungsdauer".repeat(8);
        let summary_item = || report::ReportSummaryItemDto { label: String::new(), value: String::new() };
        let requests = [
            PdfDocumentRequest::InfringementLetter(Box::new(infringement::InfringementLetterPdfRequest {
                infringements: vec![infringement::InfringementItemDto::default()],
                locale: "de".to_string(),
                ..Default::default()
            })),
            PdfDocumentRequest::AttestationForm(Box::default()),
            PdfDocumentRequest::FactualReport(Box::new(report::FactualReportPdfRequest {
                header_fields: vec![summary_item(), summary_item(), summary_item()],
                summary_items: vec![summary_item(), summary_item()],
                sections: vec![report::ReportTableSectionDto {
                    headers: vec![String::new(); 11],
                    rows: vec![report::ReportTableRowDto { cells: vec![String::new(); 11] }],
                    ..Default::default()
                }],
                orientation: "portrait".to_string(),
                locale: "de".to_string(),
                ..Default::default()
            })),
        ];

        for request in requests {
            let mut json = serde_json::to_value(&request).unwrap();
            fill_text_fields(&mut json, &page_wide_word);
            let filled: PdfDocumentRequest = serde_json::from_value(json).unwrap();
            let bytes = render_pdf(&filled).unwrap_or_else(|error| panic!("{request:?}: every text must wrap: {error}"));
            assert_eq!(&bytes[0..4], b"%PDF");
        }
    }

    #[test]
    fn test_render_factual_report_with_uneven_or_empty_header_fields() {
        for field_count in [0_usize, 1, 3, 5] {
            let header_fields = (0..field_count)
                .map(|index| report::ReportSummaryItemDto { label: format!("Label {index}"), value: format!("Value {index}") })
                .collect();
            let req = report::FactualReportPdfRequest {
                title: "FLEET REPORT".to_string(),
                header_fields,
                orientation: "portrait".to_string(),
                locale: "en".to_string(),
                ..Default::default()
            };

            let bytes = report::render_factual_report(&req).unwrap();

            assert_eq!(&bytes[0..4], b"%PDF", "{field_count} header fields must render a PDF");
        }
    }

    #[test]
    fn test_render_factual_report_mismatched_row_columns() {
        let req = PdfDocumentRequest::FactualReport(Box::new(report::FactualReportPdfRequest {
            title: "FACTUAL TECHNICAL REPORT".to_string(),
            subtitle: "Column Mismatch Test".to_string(),
            header_fields: vec![
                report::ReportSummaryItemDto { label: "Driver".to_string(), value: "Test Driver".to_string() },
                report::ReportSummaryItemDto { label: "Card Number".to_string(), value: "DF000000000".to_string() },
                report::ReportSummaryItemDto { label: "File".to_string(), value: "C_TEST.ddd".to_string() },
                report::ReportSummaryItemDto { label: "Generated".to_string(), value: "2026-08-28 12:00 UTC".to_string() },
            ],
            summary_title: "Summary".to_string(),
            summary_items: vec![],
            sections: vec![
                // Section with rows that have fewer cells than headers
                report::ReportTableSectionDto {
                    title: "Short Rows".to_string(),
                    subtitle: String::new(),
                    timeline: None,
                    headers: vec!["Col A".to_string(), "Col B".to_string(), "Col C".to_string(), "Col D".to_string()],
                    rows: vec![
                        report::ReportTableRowDto { cells: vec!["only one".to_string()] },
                        report::ReportTableRowDto { cells: vec!["a".to_string(), "b".to_string()] },
                        report::ReportTableRowDto { cells: vec![] },
                    ],
                },
                // Section with rows that have more cells than headers
                report::ReportTableSectionDto {
                    title: "Long Rows".to_string(),
                    subtitle: String::new(),
                    timeline: None,
                    headers: vec!["Col A".to_string(), "Col B".to_string()],
                    rows: vec![report::ReportTableRowDto {
                        cells: vec!["a".to_string(), "b".to_string(), "c".to_string(), "d".to_string()],
                    }],
                },
            ],
            footer_notice: String::new(),
            orientation: "portrait".to_string(),
            locale: "en".to_string(),
        }));

        let result = render_pdf(&req);
        assert!(result.is_ok(), "Factual Report with mismatched columns failed: {:?}", result.err());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        assert_eq!(&bytes[0..4], b"%PDF");
    }

    #[test]
    fn test_render_factual_report_with_long_unbroken_strings() {
        let req = PdfDocumentRequest::FactualReport(Box::new(report::FactualReportPdfRequest {
            title: "FACTUAL TECHNICAL REPORT".to_string(),
            subtitle: "Long String Wrap Test".to_string(),
            header_fields: vec![
                report::ReportSummaryItemDto { label: "Driver".to_string(), value: "Test Driver".to_string() },
                report::ReportSummaryItemDto { label: "Card Number".to_string(), value: "DF000000000000000000000000000000".to_string() },
                report::ReportSummaryItemDto { label: "File".to_string(), value: "C_TEST_WITH_VERY_LONG_FILE_NAME_AND_IDENTIFIERS_AND_EXTRA_METADATA.ddd".to_string() },
                report::ReportSummaryItemDto { label: "Generated".to_string(), value: "2026-08-28 12:00 UTC".to_string() },
            ],
            summary_title: "Summary".to_string(),
            summary_items: vec![
                report::ReportSummaryItemDto {
                    label: "SHA-256 Digest".to_string(),
                    value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string(),
                },
                report::ReportSummaryItemDto {
                    label: "Canonical JSON Pointer".to_string(),
                    value: "/card/application/identification/cardIdentificationRecord/cardExtendedSerialNumber/serialNumber".to_string(),
                },
            ],
            sections: vec![
                report::ReportTableSectionDto {
                    title: "Signature Verification Scopes".to_string(),
                    subtitle: String::new(),
                    timeline: None,
                    headers: vec![
                        "Generation".to_string(),
                        "Scope Status".to_string(),
                        "Source Path".to_string(),
                    ],
                    rows: vec![
                        report::ReportTableRowDto {
                            cells: vec![
                                "Gen2".to_string(),
                                "Valid".to_string(),
                                "/card/generation2/applications/driverCardApplication/cardData/cardStructureVersion".to_string(),
                            ],
                        },
                        report::ReportTableRowDto {
                            cells: vec![
                                "Gen1".to_string(),
                                "Partially Valid".to_string(),
                                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string(),
                            ],
                        },
                    ],
                },
            ],
            footer_notice: "Factual Report Test".to_string(),
            orientation: "portrait".to_string(),
            locale: "en".to_string(),
        }));

        let result = render_pdf(&req);
        assert!(result.is_ok(), "Factual Report with long strings failed: {:?}", result.err());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        assert_eq!(&bytes[0..4], b"%PDF");
    }
}
