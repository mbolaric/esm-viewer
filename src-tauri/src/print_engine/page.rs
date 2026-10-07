// PDF margins are part of each page. Smaller paper only scales down, preserving
// the PDF's proportions without adding margins or enlarging its fonts.
#[derive(Debug, PartialEq)]
pub(super) struct PagePlacement {
    pub x: f64,
    pub y: f64,
    pub scale: f64,
}

pub(super) fn place_page(width: f64, height: f64, paper_width: f64, paper_height: f64) -> Result<PagePlacement, String> {
    if [width, height, paper_width, paper_height].iter().any(|value| !value.is_finite() || *value <= 0.0) {
        return Err("Invalid print page dimensions.".to_string());
    }
    let scale = (paper_width / width).min(paper_height / height).min(1.0);
    Ok(PagePlacement { x: (paper_width - width * scale) / 2.0, y: (paper_height - height * scale) / 2.0, scale })
}

#[cfg(test)]
#[path = "../../tests/native/print_page_tests.rs"]
mod tests;
