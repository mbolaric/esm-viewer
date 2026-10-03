use genpdfi::fonts::{FontData, FontFamily};

static REGULAR_FONT: &[u8] = include_bytes!("../../fonts/LiberationSans-Regular.ttf");
static BOLD_FONT: &[u8] = include_bytes!("../../fonts/LiberationSans-Bold.ttf");
static ITALIC_FONT: &[u8] = include_bytes!("../../fonts/LiberationSans-Italic.ttf");
static BOLD_ITALIC_FONT: &[u8] = include_bytes!("../../fonts/LiberationSans-BoldItalic.ttf");

pub fn create_font_family() -> Result<FontFamily<FontData>, String> {
    let regular = FontData::new(REGULAR_FONT.to_vec(), None).map_err(|e| format!("Failed to load regular font: {e}"))?;
    let bold = FontData::new(BOLD_FONT.to_vec(), None).map_err(|e| format!("Failed to load bold font: {e}"))?;
    let italic = FontData::new(ITALIC_FONT.to_vec(), None).map_err(|e| format!("Failed to load italic font: {e}"))?;
    let bold_italic =
        FontData::new(BOLD_ITALIC_FONT.to_vec(), None).map_err(|e| format!("Failed to load bold italic font: {e}"))?;

    Ok(FontFamily { regular, bold, italic, bold_italic })
}
