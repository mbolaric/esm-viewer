use genpdfi::elements::{Break, LinearLayout, PaddedElement, TableLayout};

use super::text::{clean_text, FittedParagraph};
use genpdfi::style::{Color, Style};
use genpdfi::{Alignment, Document, Margins, PaperSize};
use serde::{Deserialize, Serialize};

use super::layout::{
    centered, framed_box, framed_columns, framed_table, labelled_value, new_document, paragraph, push_footer_notice, push_row,
    render_to_bytes, standard_page_margins, table_cell, MUTED_TEXT,
};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct InfringementItemDto {
    pub index: usize,
    pub date_time: String,
    pub category: String,
    pub severity: String,
    pub description: String,
    pub legal_reference: String,
    pub measured: String,
    pub allowed: String,
    pub excess: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct InfringementLetterPdfRequest {
    pub company_name: String,
    pub company_address: String,
    pub driver_name: String,
    pub card_number: String,
    pub issuing_country: String,
    pub vehicle_registration: String,
    pub vin: String,
    pub file_name: String,
    pub date_printed: String,
    pub infringements: Vec<InfringementItemDto>,
    pub title: String,
    pub company_details_title: String,
    pub driver_details_title: String,
    pub date_printed_label: String,
    pub file_label: String,
    pub driver_name_label: String,
    pub card_number_label: String,
    pub issuing_country_label: String,
    pub vehicle_label: String,
    pub vin_label: String,
    pub total_infringements_label: String,
    pub intro_text: String,
    pub num_header: String,
    pub date_time_header: String,
    pub category_header: String,
    pub description_header: String,
    pub measured_header: String,
    pub allowed_header: String,
    pub excess_header: String,
    pub severity_header: String,
    pub driver_comments_title: String,
    pub driver_comments: String,
    pub driver_declaration_text: String,
    pub driver_signature_label: String,
    pub operator_signature_label: String,
    pub date_signature_label: String,
    pub footer_notice: String,
    // UI locale for hyphenation dictionary selection.
    pub locale: String,
}

pub fn render_infringement_letter(req: &InfringementLetterPdfRequest) -> Result<Vec<u8>, String> {
    let mut doc = new_document(&req.locale, PaperSize::A4, standard_page_margins())?;
    push_letter_header(&mut doc, req)?;
    push_identity_box(&mut doc, req)?;
    doc.push(paragraph(clean_text(&req.intro_text), Style::new().with_font_size(8)));
    doc.push(Break::new(0.6_f32));
    push_findings_table(&mut doc, req)?;
    push_driver_comments(&mut doc, req);
    doc.push(paragraph(&req.driver_declaration_text, Style::new().with_font_size(8)));
    doc.push(Break::new(0.6_f32));
    push_signatures(&mut doc, req)?;
    push_footer_notice(&mut doc, &req.footer_notice);
    render_to_bytes(doc)
}

// Company heading beside the print date and source file, then the letter title.
fn push_letter_header(doc: &mut Document, req: &InfringementLetterPdfRequest) -> Result<(), String> {
    let mut company_info = LinearLayout::vertical();
    // No placeholder name: company details are user-entered and never invented, matching the HTML letter.
    if !req.company_name.trim().is_empty() {
        company_info.push(paragraph(req.company_name.trim(), Style::new().bold().with_font_size(13)));
    }
    if !req.company_address.trim().is_empty() {
        company_info.push(paragraph(req.company_address.trim(), Style::new().with_font_size(8).with_color(MUTED_TEXT)));
    }

    let mut meta_info = LinearLayout::vertical();
    for line in [format!("{}: {}", req.date_printed_label, req.date_printed), format!("{}: {}", req.file_label, req.file_name)] {
        meta_info.push(
            FittedParagraph::default()
                .aligned(Alignment::Right)
                .styled_string(line, Style::new().with_font_size(8).with_color(MUTED_TEXT)),
        );
    }

    let mut header_table = TableLayout::new(vec![3, 2]);
    push_row(header_table.row().element(company_info).element(meta_info))?;
    doc.push(header_table);
    doc.push(Break::new(0.8_f32));
    doc.push(centered(&req.title, Style::new().bold().with_font_size(12)));
    doc.push(Break::new(0.6_f32));
    Ok(())
}

// Driver and card on the left, vehicle and finding count on the right.
fn push_identity_box(doc: &mut Document, req: &InfringementLetterPdfRequest) -> Result<(), String> {
    let lines = vec![
        labelled_value(&req.driver_name_label, &req.driver_name),
        labelled_value(&req.card_number_label, &req.card_number),
        labelled_value(&req.issuing_country_label, &req.issuing_country),
        labelled_value(&req.vehicle_label, &req.vehicle_registration),
        labelled_value(&req.vin_label, &req.vin),
        labelled_value(&req.total_infringements_label, &req.infringements.len().to_string()),
    ];
    doc.push(framed_columns(lines, 0.2)?);
    doc.push(Break::new(0.8_f32));
    Ok(())
}

fn push_findings_table(doc: &mut Document, req: &InfringementLetterPdfRequest) -> Result<(), String> {
    if req.infringements.is_empty() {
        return Ok(());
    }
    let mut table = framed_table(vec![3, 6, 12, 6, 4, 4]);

    let header = Style::new().bold().with_font_size(8);
    push_row(
        table
            .row()
            .element(table_cell(FittedParagraph::new(&req.num_header, header).aligned(Alignment::Center)))
            .element(table_cell(FittedParagraph::new(&req.date_time_header, header)))
            .element(table_cell(FittedParagraph::new(&format!("{} & {}", req.category_header, req.description_header), header)))
            .element(table_cell(FittedParagraph::new(&format!("{} / {}", req.measured_header, req.allowed_header), header)))
            .element(table_cell(FittedParagraph::new(&req.excess_header, header)))
            .element(table_cell(FittedParagraph::new(&req.severity_header, header).aligned(Alignment::Center))),
    )?;

    for item in &req.infringements {
        let mut description = FittedParagraph::new(&item.description, Style::new().bold().with_font_size(8));
        if !item.legal_reference.is_empty() {
            description = description
                .styled_string(format!(" ({})", item.legal_reference), Style::new().with_font_size(7).with_color(MUTED_TEXT));
        }

        push_row(
            table
                .row()
                .element(table_cell(
                    FittedParagraph::new(&item.index.to_string(), Style::new().with_font_size(8)).aligned(Alignment::Center),
                ))
                .element(table_cell(FittedParagraph::new(&item.date_time, Style::new().with_font_size(8))))
                .element(table_cell(description))
                .element(table_cell(FittedParagraph::new(
                    &format!("{} / {}", item.measured, item.allowed),
                    Style::new().with_font_size(8),
                )))
                .element(table_cell(FittedParagraph::new(
                    &item.excess,
                    Style::new().bold().with_font_size(8).with_color(Color::Rgb(180, 20, 20)),
                )))
                .element(table_cell(
                    FittedParagraph::new(&item.severity, Style::new().bold().with_font_size(7)).aligned(Alignment::Center),
                )),
        )?;
    }

    doc.push(table);
    doc.push(Break::new(0.6_f32));
    Ok(())
}

fn push_driver_comments(doc: &mut Document, req: &InfringementLetterPdfRequest) {
    let mut comments_layout = LinearLayout::vertical();
    comments_layout.push(paragraph(&req.driver_comments_title, Style::new().bold().with_font_size(8)));
    if req.driver_comments.trim().is_empty() {
        comments_layout.push(Break::new(2.2_f32)); // blank space for a handwritten statement
    } else {
        // One paragraph per typed line, so the driver's line breaks survive into the letter.
        for line in req.driver_comments.lines() {
            comments_layout.push(paragraph(line, Style::new().with_font_size(8)));
        }
    }
    doc.push(framed_box(comments_layout, Margins::trbl(3, 5, 3, 5)));
    doc.push(Break::new(0.6_f32));
}

fn signature_block(label: &str, date_label: &str) -> PaddedElement<LinearLayout> {
    let mut block = LinearLayout::vertical();
    block.push(paragraph(label, Style::new().bold().with_font_size(8)));
    block.push(Break::new(1.6_f32));
    block.push(paragraph(format!("{date_label}: ____________________"), Style::new().with_font_size(8)));
    PaddedElement::new(block, Margins::trbl(3, 5, 3, 5))
}

fn push_signatures(doc: &mut Document, req: &InfringementLetterPdfRequest) -> Result<(), String> {
    let mut sig_table = framed_table(vec![1, 1]);
    push_row(
        sig_table
            .row()
            .element(signature_block(&req.driver_signature_label, &req.date_signature_label))
            .element(signature_block(&req.operator_signature_label, &req.date_signature_label)),
    )?;
    doc.push(sig_table);
    doc.push(Break::new(0.6_f32));
    Ok(())
}
