use super::text::{clean_text, FittedParagraph};
use genpdfi::elements::{Break, LinearLayout};
use genpdfi::style::{Color, Style};
use genpdfi::{Margins, PaperSize};
use serde::{Deserialize, Serialize};

use super::layout::{centered, framed_box, new_document, paragraph, render_to_bytes};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AttestationFormPdfRequest {
    pub company_name: String,
    pub company_address: String,
    pub company_phone: String,
    pub company_fax: String,
    pub company_email: String,
    pub signatory_name: String,
    pub signatory_position: String,
    pub driver_name: String,
    pub driver_dob: String,
    pub driving_licence: String,
    pub employment_start: String,
    pub period_start: String,
    pub period_end: String,
    pub reason_key: String,
    pub place: String,
    pub date: String,
    pub title: String,
    pub subtitle: String,
    pub instructions: String,
    pub undertaking_part_title: String,
    pub driver_part_title: String,
    pub period_part_title: String,
    pub box1_label: String,
    pub box2_label: String,
    pub box3_label: String,
    pub box4_label: String,
    pub box5_label: String,
    pub box6_label: String,
    pub box7_label: String,
    pub box8_label: String,
    pub box9_label: String,
    pub box10_label: String,
    pub box11_label: String,
    pub box12_label: String,
    pub box13_label: String,
    pub box14_label: String,
    pub box15_label: String,
    pub box16_label: String,
    pub box17_label: String,
    pub box18_label: String,
    pub box19_label: String,
    pub box20_label: String,
    pub box21_label: String,
    pub box22_label: String,
    pub warning: String,
    pub footnote: String,
    pub undersigned_label: String,
    pub date_label: String,
    pub signature_label: String,
    pub driver_signature_label: String,
    // UI locale for hyphenation dictionary selection.
    pub locale: String,
}

// Strips leading numbers and trailing colons from pre-formatted labels.
fn clean_label(label: &str) -> String {
    let text = clean_text(label);
    let without_number = text.trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == ' ');
    without_number.trim_end_matches(':').trim_end().to_string()
}

fn form_line(item_num: &str, label: &str, value: &str) -> FittedParagraph {
    let mut p = FittedParagraph::default();
    p.push_styled(format!("{}. {}: ", item_num, clean_label(label)), Style::new().with_font_size(9));
    p.push_styled(clean_text(value), Style::new().bold().with_font_size(9));
    p
}

fn checkbox_line(item_num: &str, checked: bool, label: &str) -> FittedParagraph {
    let mark = if checked { "[X] " } else { "[   ] " };
    let mut p = FittedParagraph::default();
    p.push_styled(format!("{}. ", item_num), Style::new().with_font_size(9));
    p.push_styled(mark, Style::new().bold().with_font_size(9));
    p.push_styled(clean_label(label), Style::new().with_font_size(9));
    p
}

// Numbered form lines under an optional italic heading, closed by a gap.
fn push_form_section(content: &mut LinearLayout, heading: Option<&str>, lines: &[(&str, &str, &str)]) {
    if let Some(heading) = heading {
        content.push(paragraph(heading, Style::new().italic().with_font_size(9)));
    }
    for &(number, label, value) in lines {
        content.push(form_line(number, label, value));
    }
    content.push(Break::new(1.5_f32));
}

// Boxes 20 and 22: place and date, then a line for the named signature.
fn place_date_signature_line(
    number: &str,
    box_label: &str,
    req: &AttestationFormPdfRequest,
    signature_label: &str,
) -> FittedParagraph {
    let mut line = FittedParagraph::default();
    line.push_styled(format!("{number}. {} ", clean_label(box_label)), Style::new().bold().with_font_size(9));
    line.push_styled(format!("{}   ", req.place), Style::new().bold().with_font_size(9));
    line.push_styled(format!("{} ", req.date_label), Style::new().with_font_size(9));
    line.push_styled(format!("{}   ", req.date), Style::new().bold().with_font_size(9));
    line.push_styled(format!("{signature_label} _________________________________"), Style::new().with_font_size(9));
    line
}

pub fn render_attestation_form(req: &AttestationFormPdfRequest) -> Result<Vec<u8>, String> {
    let mut doc = new_document(&req.locale, PaperSize::A4, Margins::trbl(12, 16, 12, 16))?;

    // Title & Subtitle Header
    doc.push(centered(&req.title, Style::new().bold().with_font_size(11)));
    doc.push(centered(&req.subtitle, Style::new().with_font_size(9).with_color(Color::Rgb(60, 60, 60))));
    doc.push(centered(&req.instructions, Style::new().italic().with_font_size(8).with_color(Color::Rgb(80, 80, 80))));
    doc.push(centered(&req.warning, Style::new().bold().with_font_size(8).with_color(Color::Rgb(160, 20, 20))));
    doc.push(Break::new(2.0_f32));

    // Part to be filled in by the undertaking (Framed Box)
    let mut undertaking_content = LinearLayout::vertical();
    undertaking_content.push(paragraph(&req.undertaking_part_title, Style::new().bold().with_font_size(9)));
    undertaking_content.push(Break::new(1.5_f32));

    push_form_section(
        &mut undertaking_content,
        None,
        &[
            ("1", &req.box1_label, &req.company_name),
            ("2", &req.box2_label, &req.company_address),
            ("3", &req.box3_label, &req.company_phone),
            ("4", &req.box4_label, &req.company_fax),
            ("5", &req.box5_label, &req.company_email),
        ],
    );
    push_form_section(
        &mut undertaking_content,
        Some(&req.undersigned_label),
        &[("6", &req.box6_label, &req.signatory_name), ("7", &req.box7_label, &req.signatory_position)],
    );
    push_form_section(
        &mut undertaking_content,
        Some(&req.driver_part_title),
        &[
            ("8", &req.box8_label, &req.driver_name),
            ("9", &req.box9_label, &req.driver_dob),
            ("10", &req.box10_label, &req.driving_licence),
            ("11", &req.box11_label, &req.employment_start),
        ],
    );
    push_form_section(
        &mut undertaking_content,
        Some(&req.period_part_title),
        &[("12", &req.box12_label, &req.period_start), ("13", &req.box13_label, &req.period_end)],
    );

    // Boxes 14-19: one reason is ticked, matched by the request's reason key.
    let reasons: [(&str, &[&str], &str); 6] = [
        ("14", &["sickLeave"], &req.box14_label),
        ("15", &["annualLeave"], &req.box15_label),
        ("16", &["leaveOrRest"], &req.box16_label),
        ("17", &["outOfScope"], &req.box17_label),
        ("18", &["otherWork"], &req.box18_label),
        ("19", &["available", "standby"], &req.box19_label),
    ];
    for (number, reason_keys, label) in reasons {
        undertaking_content.push(checkbox_line(number, reason_keys.contains(&req.reason_key.as_str()), label));
    }
    undertaking_content.push(Break::new(1.5_f32));

    undertaking_content.push(place_date_signature_line("20", &req.box20_label, req, &req.signature_label));

    doc.push(framed_box(undertaking_content, Margins::trbl(8, 10, 8, 10)));
    doc.push(Break::new(3.0_f32));

    // Part to be filled in by the driver (Boxes 21 and 22)
    let mut driver_content = LinearLayout::vertical();
    driver_content.push(paragraph(format!("21. {}", clean_label(&req.box21_label)), Style::new().with_font_size(9)));
    driver_content.push(Break::new(1.5_f32));

    driver_content.push(place_date_signature_line("22", &req.box22_label, req, &req.driver_signature_label));

    doc.push(framed_box(driver_content, Margins::trbl(8, 10, 8, 10)));

    // Footnotes at bottom
    if !req.footnote.is_empty() {
        doc.push(Break::new(2.0_f32));
        doc.push(paragraph(&req.footnote, Style::new().italic().with_font_size(7).with_color(Color::Rgb(100, 100, 100))));
    }

    render_to_bytes(doc)
}
