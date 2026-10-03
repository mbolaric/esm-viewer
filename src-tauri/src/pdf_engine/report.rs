use super::text::{clean_text, FittedParagraph};
use genpdfi::elements::{Break, LinearLayout, PaddedElement, TableLayout};
use genpdfi::style::{Color, LineStyle, Style};
use genpdfi::{Alignment, Document, Margins, PaperSize, Position};
use serde::{Deserialize, Serialize};

use super::layout::{
    centered, framed_columns, framed_table, labelled_value, new_document, paragraph, push_footer_notice, push_row,
    render_to_bytes, standard_page_margins, table_cell, MUTED_TEXT,
};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ReportSummaryItemDto {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ReportTableRowDto {
    pub cells: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ActivitySegmentDto {
    pub timeline_start_ms: u64,
    pub timeline_end_ms: u64,
    pub activity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ActivityTimelineDayDto {
    pub total_ms: u64,
    pub segments: Vec<ActivitySegmentDto>,
}

pub struct ActivityTimelineElement {
    timeline: ActivityTimelineDayDto,
}

impl ActivityTimelineElement {
    pub fn new(timeline: ActivityTimelineDayDto) -> Self {
        Self { timeline }
    }
}

impl genpdfi::Element for ActivityTimelineElement {
    fn render(
        &mut self,
        _context: &genpdfi::Context,
        area: genpdfi::render::Area<'_>,
        _style: genpdfi::style::Style,
    ) -> Result<genpdfi::RenderResult, genpdfi::error::Error> {
        let width_mm: f32 = area.size().width.into();
        let bar_height: f32 = 6.0;
        let total_ms = if self.timeline.total_ms > 0 { self.timeline.total_ms as f32 } else { 86_400_000.0 };

        // Draw colored segments
        for seg in &self.timeline.segments {
            let start_ratio = (seg.timeline_start_ms as f32 / total_ms).clamp(0.0, 1.0);
            let end_ratio = (seg.timeline_end_ms as f32 / total_ms).clamp(0.0, 1.0);
            let x1 = start_ratio * width_mm;
            let x2 = (end_ratio * width_mm).max(x1 + 0.25);

            let color = match seg.activity.as_str() {
                "driving" => Color::Rgb(235, 115, 0),       // Orange
                "work" => Color::Rgb(40, 115, 215),         // Blue
                "availability" => Color::Rgb(225, 160, 20), // Amber / Yellow
                "breakOrRest" => Color::Rgb(40, 165, 75),   // Green
                _ => Color::Rgb(150, 150, 150),             // Gray
            };

            let mut x = x1;
            while x <= x2 {
                area.draw_line(vec![Position::new(x, 0.0_f32), Position::new(x, bar_height)], color.into());
                x += 0.25;
            }
        }

        // Draw border around the bar
        area.draw_line(
            vec![
                Position::new(0.0_f32, 0.0_f32),
                Position::new(width_mm, 0.0_f32),
                Position::new(width_mm, bar_height),
                Position::new(0.0_f32, bar_height),
                Position::new(0.0_f32, 0.0_f32),
            ],
            LineStyle::from(Color::Rgb(170, 170, 170)),
        );

        // Draw axis line and tick marks below the bar
        let tick_bottom = bar_height + 2.0;
        area.draw_line(
            vec![Position::new(0.0_f32, bar_height), Position::new(width_mm, bar_height)],
            LineStyle::from(Color::Rgb(120, 120, 120)),
        );

        for i in 0..=4 {
            let x = width_mm * (i as f32 / 4.0);
            area.draw_line(
                vec![Position::new(x, bar_height), Position::new(x, tick_bottom)],
                LineStyle::from(Color::Rgb(120, 120, 120)),
            );
        }

        Ok(genpdfi::RenderResult { has_more: false, size: genpdfi::Size::new(area.size().width, 8.5_f32) })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ReportTableSectionDto {
    pub title: String,
    pub subtitle: String,
    pub timeline: Option<ActivityTimelineDayDto>,
    pub headers: Vec<String>,
    pub rows: Vec<ReportTableRowDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct FactualReportPdfRequest {
    pub title: String,
    pub subtitle: String,
    // Labelled facts for the framed header box, split across two columns in order.
    pub header_fields: Vec<ReportSummaryItemDto>,
    pub summary_title: String,
    pub summary_items: Vec<ReportSummaryItemDto>,
    pub sections: Vec<ReportTableSectionDto>,
    pub footer_notice: String,
    // Page orientation ("landscape" or default portrait).
    pub orientation: String,
    // UI locale for hyphenation dictionary selection.
    pub locale: String,
}

fn compute_column_weights(col_count: usize) -> Vec<usize> {
    match col_count {
        1 => vec![1],
        2 => vec![1, 2],
        3 => vec![2, 2, 3],
        4 => vec![2, 3, 3, 4],
        5 => vec![3, 2, 2, 3, 2],
        6 => vec![3, 2, 2, 2, 2, 2],
        7 => vec![4, 2, 2, 2, 2, 2, 2],
        8 => vec![3, 2, 2, 2, 2, 2, 2, 2],
        _ => vec![1; col_count],
    }
}

pub fn render_factual_report(req: &FactualReportPdfRequest) -> Result<Vec<u8>, String> {
    let paper_size = if req.orientation == "landscape" {
        // Swap A4 dimensions to render landscape orientation.
        genpdfi::Size::new(297, 210)
    } else {
        PaperSize::A4.into()
    };
    let mut doc = new_document(&req.locale, paper_size, standard_page_margins())?;
    push_report_heading(&mut doc, req)?;
    push_summary_grid(&mut doc, req)?;
    for section in &req.sections {
        push_section(&mut doc, section)?;
    }
    if !req.footer_notice.is_empty() {
        doc.push(Break::new(0.6_f32));
        push_footer_notice(&mut doc, &clean_text(&req.footer_notice));
    }
    render_to_bytes(doc)
}

// Title, optional subtitle, and the framed box of header fields.
fn push_report_heading(doc: &mut Document, req: &FactualReportPdfRequest) -> Result<(), String> {
    doc.push(centered(clean_text(&req.title), Style::new().bold().with_font_size(12)));
    if !req.subtitle.is_empty() {
        doc.push(centered(clean_text(&req.subtitle), Style::new().with_font_size(7).with_color(MUTED_TEXT)));
    }
    doc.push(Break::new(0.6_f32));
    let lines = req.header_fields.iter().map(|field| labelled_value(&field.label, &field.value)).collect();
    doc.push(framed_columns(lines, 0.0)?);
    doc.push(Break::new(0.6_f32));
    Ok(())
}

const SUMMARY_COLUMNS: usize = 3;

fn push_summary_grid(doc: &mut Document, req: &FactualReportPdfRequest) -> Result<(), String> {
    if req.summary_items.is_empty() {
        return Ok(());
    }
    doc.push(paragraph(clean_text(&req.summary_title), Style::new().bold().with_font_size(9)));
    doc.push(Break::new(0.3_f32));
    let mut summary_table = TableLayout::new(vec![1; SUMMARY_COLUMNS]);
    summary_table.set_cell_decorator(genpdfi::elements::FrameCellDecorator::new(true, true, false));

    for items in req.summary_items.chunks(SUMMARY_COLUMNS) {
        let mut row = summary_table.row();
        for item in items {
            let mut cell = LinearLayout::vertical();
            cell.push(FittedParagraph::new(&item.label, Style::new().with_font_size(7).with_color(MUTED_TEXT)));
            cell.push(FittedParagraph::new(&item.value, Style::new().bold().with_font_size(8)));
            row = row.element(table_cell(cell));
        }
        // A short last row is padded with empty cells, since every table row needs one element per column.
        for _ in items.len()..SUMMARY_COLUMNS {
            row = row.element(FittedParagraph::default());
        }
        push_row(row)?;
    }
    doc.push(summary_table);
    doc.push(Break::new(0.6_f32));
    Ok(())
}

fn push_section(doc: &mut Document, section: &ReportTableSectionDto) -> Result<(), String> {
    doc.push(Break::new(0.6_f32));
    doc.push(paragraph(clean_text(&section.title), Style::new().bold().with_font_size(9)));
    if !section.subtitle.is_empty() {
        doc.push(paragraph(clean_text(&section.subtitle), Style::new().italic().with_font_size(7).with_color(MUTED_TEXT)));
    }
    doc.push(Break::new(0.3_f32));
    if let Some(timeline) = section.timeline.as_ref().filter(|t| !t.segments.is_empty()) {
        push_timeline(doc, timeline)?;
    }
    if !section.headers.is_empty() {
        push_section_table(doc, section)?;
    }
    Ok(())
}

// The day bar with its hour ticks underneath.
fn push_timeline(doc: &mut Document, timeline: &ActivityTimelineDayDto) -> Result<(), String> {
    doc.push(ActivityTimelineElement::new(timeline.clone()));
    let ticks = [
        ("00:00", Alignment::Left),
        ("06:00", Alignment::Center),
        ("12:00", Alignment::Center),
        ("18:00", Alignment::Center),
        ("24:00", Alignment::Right),
    ];
    let mut tick_table = TableLayout::new(vec![1; ticks.len()]);
    let mut row = tick_table.row();
    for (label, alignment) in ticks {
        row = row.element(
            FittedParagraph::default()
                .aligned(alignment)
                .styled_string(label, Style::new().with_font_size(6).with_color(Color::Rgb(110, 110, 110))),
        );
    }
    push_row(row)?;
    doc.push(tick_table);
    doc.push(Break::new(0.4_f32));
    Ok(())
}

fn push_section_table(doc: &mut Document, section: &ReportTableSectionDto) -> Result<(), String> {
    let col_count = section.headers.len();
    let mut table = framed_table(compute_column_weights(col_count));

    // Wide tables get smaller text and tighter cells so more columns fit the page.
    let font_size = if col_count >= 7 { 6 } else { 7 };
    let cell_margins = if col_count >= 7 { Margins::trbl(0.8, 1.0, 0.8, 1.0) } else { Margins::trbl(1.2, 1.8, 1.2, 1.8) };

    let mut header_row = table.row();
    for h in &section.headers {
        header_row = header_row
            .element(PaddedElement::new(FittedParagraph::new(h, Style::new().bold().with_font_size(font_size)), cell_margins));
    }
    push_row(header_row)?;

    for row in &section.rows {
        let mut data_row = table.row();
        for i in 0..col_count {
            let cell_text = row.cells.get(i).map(|s| s.as_str()).unwrap_or("\u{2014}");
            data_row = data_row.element(PaddedElement::new(
                FittedParagraph::new(cell_text, Style::new().with_font_size(font_size)),
                cell_margins,
            ));
        }
        push_row(data_row)?;
    }
    doc.push(table);
    doc.push(Break::new(0.6_f32));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_comparison_diff_report_pdf() {
        let req = FactualReportPdfRequest {
            title: "Dokumentenvergleich & Multi-Datei-Auditbericht".to_string(),
            subtitle: "Gegenüberstellung der geöffneten Tachographendateien".to_string(),
            header_fields: vec![
                ReportSummaryItemDto { label: "Verglichene Dateien".to_string(), value: "2".to_string() },
                ReportSummaryItemDto { label: "Abweichende Felder".to_string(), value: "3".to_string() },
                ReportSummaryItemDto { label: "Vergleichsumfang".to_string(), value: "Sitzungsvergleich".to_string() },
                ReportSummaryItemDto {
                    label: "Vergleichsbericht erstellt am".to_string(),
                    value: "2026-08-29 14:00 UTC".to_string(),
                },
            ],
            summary_title: "Vergleichsübersicht".to_string(),
            summary_items: vec![
                ReportSummaryItemDto { label: "Verglichene Dateien gesamt".to_string(), value: "2".to_string() },
                ReportSummaryItemDto { label: "Abweichende Attribute".to_string(), value: "3".to_string() },
            ],
            sections: vec![
                ReportTableSectionDto {
                    title: "Dokumentenidentitäten & Zeitraum".to_string(),
                    subtitle: "Identitäten, Tachographengenerationen, Erfassungszeiträume und kryptografische Integrität"
                        .to_string(),
                    timeline: None,
                    headers: vec![
                        "Dokumentdatei".to_string(),
                        "Art & Generation".to_string(),
                        "Dokumentidentität".to_string(),
                        "Abgedeckter Zeitraum".to_string(),
                        "Integritätsstatus".to_string(),
                    ],
                    rows: vec![ReportTableRowDto {
                        cells: vec![
                            "C_DF1234567890.ddd".to_string(),
                            "Fahrerkarte (Generation 2)".to_string(),
                            "Mustermann, Max".to_string(),
                            "2026-08-01 00:00 – 2026-08-28 23:59".to_string(),
                            "Gültig".to_string(),
                        ],
                    }],
                },
                ReportTableSectionDto {
                    title: "Dekodierte Datensatzzahlen".to_string(),
                    subtitle: "Aktivitätstage, Intervalle, Lücken, Ereignisse, Fehler und Warnungen".to_string(),
                    timeline: None,
                    headers: vec![
                        "Dokumentdatei".to_string(),
                        "Aktivitätstage".to_string(),
                        "Aktivitätsintervalle".to_string(),
                        "Lücken".to_string(),
                        "Ereignisse".to_string(),
                        "Fehler".to_string(),
                        "Normalisierungswarnungen".to_string(),
                    ],
                    rows: vec![ReportTableRowDto {
                        cells: vec![
                            "C_DF1234567890.ddd".to_string(),
                            "28".to_string(),
                            "142".to_string(),
                            "3".to_string(),
                            "0".to_string(),
                            "0".to_string(),
                            "0".to_string(),
                        ],
                    }],
                },
            ],
            footer_notice: "Erstellt mit ESM Viewer.".to_string(),
            orientation: "portrait".to_string(),
            locale: "de".to_string(),
        };

        let result = render_factual_report(&req);
        assert!(result.is_ok(), "Comparison Diff Report PDF failed: {:?}", result.err());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        assert_eq!(&bytes[0..4], b"%PDF");
    }
}
