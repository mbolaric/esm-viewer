// Page setup and layout pieces shared by the PDF documents.

use genpdfi::elements::{Break, FrameCellDecorator, FramedElement, LinearLayout, PaddedElement, TableLayout, TableLayoutRow};
use genpdfi::style::{Color, Style};
use genpdfi::{Alignment, Document, Element, Margins, SimplePageDecorator, Size};

use super::fonts::create_font_family;
use super::hyphenation::hyphenator_for_locale;
use super::text::FittedParagraph;

pub const MUTED_TEXT: Color = Color::Rgb(90, 90, 90);
pub const NOTICE_TEXT: Color = Color::Rgb(120, 120, 120);

pub fn new_document(locale: &str, paper_size: impl Into<Size>, page_margins: Margins) -> Result<Document, String> {
    let mut doc = Document::new(create_font_family()?);
    doc.set_hyphenator(hyphenator_for_locale(locale));
    doc.set_paper_size(paper_size);
    let mut decorator = SimplePageDecorator::new();
    decorator.set_margins(page_margins);
    doc.set_page_decorator(decorator);
    Ok(doc)
}

pub fn standard_page_margins() -> Margins {
    Margins::trbl(15, 15, 15, 15)
}

pub fn render_to_bytes(doc: Document) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    doc.render(&mut buffer).map_err(|e| e.to_string())?;
    Ok(buffer)
}

pub fn paragraph(text: impl AsRef<str>, style: impl Into<Style>) -> FittedParagraph {
    FittedParagraph::default().styled_string(text, style)
}

pub fn centered(text: impl AsRef<str>, style: impl Into<Style>) -> FittedParagraph {
    FittedParagraph::default().aligned(Alignment::Center).styled_string(text, style)
}

pub fn table_cell<E: Element>(element: E) -> PaddedElement<E> {
    PaddedElement::new(element, Margins::trbl(1.2, 1.8, 1.2, 1.8))
}

pub fn framed_box<E: Element>(element: E, padding: Margins) -> FramedElement<PaddedElement<E>> {
    FramedElement::new(PaddedElement::new(element, padding))
}

// Table with a frame around every cell.
pub fn framed_table(column_weights: Vec<usize>) -> TableLayout {
    let mut table = TableLayout::new(column_weights);
    table.set_cell_decorator(FrameCellDecorator::new(true, true, false));
    table
}

pub fn push_row(row: TableLayoutRow<'_>) -> Result<(), String> {
    row.push().map_err(|e| e.to_string())
}

// "Label: value" with a muted label and a bold value, as the identity boxes of every document print it.
pub fn labelled_value(label: &str, value: &str) -> FittedParagraph {
    FittedParagraph::new(&format!("{label}:"), Style::new().with_font_size(8).with_color(MUTED_TEXT))
        .styled_string(format!(" {value}"), Style::new().bold().with_font_size(8))
}

// Framed two-column box. The first half of the lines fills the left column and the rest the right, so any line count
// stays balanced.
pub fn framed_columns(lines: Vec<FittedParagraph>, line_gap_mm: f32) -> Result<impl Element, String> {
    let left_count = lines.len().div_ceil(2);
    let mut left = LinearLayout::vertical();
    let mut right = LinearLayout::vertical();
    for (index, line) in lines.into_iter().enumerate() {
        let column = if index < left_count { &mut left } else { &mut right };
        if line_gap_mm > 0.0 && index != 0 && index != left_count {
            column.push(Break::new(line_gap_mm));
        }
        column.push(line);
    }
    let mut table = TableLayout::new(vec![1, 1]);
    push_row(table.row().element(left).element(right))?;
    Ok(framed_box(table, Margins::trbl(3, 5, 3, 5)))
}

pub fn push_footer_notice(doc: &mut Document, notice: &str) {
    if !notice.is_empty() {
        doc.push(centered(notice, Style::new().italic().with_font_size(7).with_color(NOTICE_TEXT)));
    }
}
