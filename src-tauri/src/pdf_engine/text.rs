// Text cleaning, HTML entity decoding, and token wrapping helpers for PDF generation.

use genpdfi::elements::Paragraph;
use genpdfi::error::Error;
use genpdfi::render::Area;
use genpdfi::style::Style;
use genpdfi::{Alignment, Context, Element, Mm, RenderResult};

// Word length threshold for manual break opportunities.
const LONG_WORD_THRESHOLD: usize = 28;

// Threshold for unhyphenatable technical words (VINs, card numbers).
const TECHNICAL_WORD_THRESHOLD: usize = 12;

// Chunk sizes for manual word breaks.
const PUNCTUATION_BREAK_MIN_CHUNK: usize = 8;
const HARD_BREAK_CHUNK_SIZE: usize = 12;

// True for uppercase/digit identifiers lacking lowercase letters.
fn looks_unhyphenatable(word: &str) -> bool {
    let mut has_letter_or_digit = false;
    for ch in word.chars() {
        if ch.is_lowercase() {
            return false;
        }
        if ch.is_uppercase() || ch.is_ascii_digit() {
            has_letter_or_digit = true;
        }
    }
    has_letter_or_digit
}

// Strips HTML tags, decodes entities, and breaks oversized unbroken tokens.
pub fn clean_text(input: &str) -> String {
    let mut stripped = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '<' {
            let rest: String = chars.clone().take(30).collect();
            if let Some(close_pos) = rest.find('>') {
                // `find` reports a byte offset: skip that many bytes of the remaining characters as well, or a
                // multi-byte character inside the tag would consume one character too many.
                let consumed = rest[..close_pos].chars().count();
                let tag_content = &rest[..close_pos];
                if (tag_content.starts_with('/')
                    && tag_content.len() > 1
                    && tag_content[1..].chars().all(|ch| ch.is_alphanumeric() || ch == '-'))
                    || (!tag_content.is_empty()
                        && tag_content.chars().next().is_some_and(|ch| ch.is_ascii_alphabetic())
                        && tag_content.chars().all(|ch| {
                            ch.is_alphanumeric() || ch.is_whitespace() || ch == '-' || ch == '/' || ch == '=' || ch == '"'
                        }))
                {
                    for _ in 0..=consumed {
                        chars.next();
                    }
                    continue;
                }
            }
            stripped.push('<');
        } else {
            stripped.push(c);
        }
    }

    let decoded = stripped
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ");

    let mut result = String::with_capacity(decoded.len() + 32);
    for line in decoded.lines() {
        let mut line_res = String::with_capacity(line.len());
        for word in line.split_whitespace() {
            if !line_res.is_empty() {
                line_res.push(' ');
            }
            let word_len = word.chars().count();
            let needs_manual_break =
                word_len > LONG_WORD_THRESHOLD || (word_len > TECHNICAL_WORD_THRESHOLD && looks_unhyphenatable(word));
            if needs_manual_break {
                let mut chunk_len = 0;
                for ch in word.chars() {
                    if chunk_len >= PUNCTUATION_BREAK_MIN_CHUNK
                        && (ch == '/' || ch == '_' || ch == '-' || ch == '.' || ch == ':' || ch == '&')
                    {
                        line_res.push(ch);
                        line_res.push(' ');
                        chunk_len = 0;
                    } else if chunk_len >= HARD_BREAK_CHUNK_SIZE {
                        line_res.push(' ');
                        line_res.push(ch);
                        chunk_len = 1;
                    } else {
                        line_res.push(ch);
                        chunk_len += 1;
                    }
                }
            } else {
                line_res.push_str(word);
            }
        }
        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str(&line_res);
    }
    if decoded.ends_with('\n') {
        result.push('\n');
    }
    result
}

// Splits every word wider than `max_width` into chunks that fit, so a cell can never hold a word the layout engine is
// unable to place (genpdfi fails the whole document with "Page overflowed while trying to wrap a string"). Words
// that fit are left intact, so hyphenation still handles ordinary wrapping. genpdfi measures each word together with
// the space that follows it, so every piece is fitted with room for one space.
pub fn split_overwide_words(text: &str, max_width: Mm, width_of: impl Fn(&str) -> Mm) -> String {
    let fits = |piece: &str| width_of(&format!("{piece} ")) <= max_width;
    let mut lines = Vec::new();
    for line in text.split('\n') {
        let mut words = Vec::new();
        for word in line.split(' ') {
            if word.is_empty() || fits(word) {
                words.push(word.to_string());
                continue;
            }
            let mut chunk = String::new();
            for ch in word.chars() {
                let mut candidate = chunk.clone();
                candidate.push(ch);
                // A single character always goes on its own, even if the cell is narrower than it.
                if !chunk.is_empty() && !fits(&candidate) {
                    words.push(std::mem::take(&mut chunk));
                    chunk.push(ch);
                } else {
                    chunk = candidate;
                }
            }
            words.push(chunk);
        }
        lines.push(words.join(" "));
    }
    lines.join("\n")
}

// Paragraph that fits its words to the width it is actually rendered in (for example a narrow table column), instead of
// guessing from character counts. Each segment keeps its own style and is measured in it.
pub struct FittedParagraph {
    alignment: Alignment,
    paragraph: Option<Paragraph>,
    segments: Vec<(String, Style)>,
}

impl Default for FittedParagraph {
    fn default() -> Self {
        Self { alignment: Alignment::Left, paragraph: None, segments: Vec::new() }
    }
}

// Same builder surface as genpdfi's `Paragraph`, so any paragraph in the PDF engines can use it.
impl FittedParagraph {
    pub fn new(text: &str, style: Style) -> Self {
        Self::default().styled_string(text, style)
    }

    pub fn styled_string(mut self, text: impl AsRef<str>, style: impl Into<Style>) -> Self {
        self.push_styled(text, style);
        self
    }

    // Leading and trailing spaces are kept, so "Label: " followed by a value still reads as two words.
    pub fn push_styled(&mut self, text: impl AsRef<str>, style: impl Into<Style>) {
        let raw = text.as_ref();
        let cleaned = clean_text(raw);
        let text = if cleaned.is_empty() {
            if raw.is_empty() {
                String::new()
            } else {
                " ".to_string()
            }
        } else {
            let lead = if raw.starts_with(char::is_whitespace) { " " } else { "" };
            let trail = if raw.ends_with(char::is_whitespace) { " " } else { "" };
            format!("{lead}{cleaned}{trail}")
        };
        self.segments.push((text, style.into()));
    }

    pub fn aligned(mut self, alignment: Alignment) -> Self {
        self.alignment = alignment;
        self
    }
}

impl Element for FittedParagraph {
    fn render(&mut self, context: &Context, area: Area<'_>, style: Style) -> Result<RenderResult, Error> {
        let Self { alignment, paragraph, segments } = self;
        let paragraph = paragraph.get_or_insert_with(|| {
            let width = area.size().width;
            let mut fitted = Paragraph::default().aligned(*alignment);
            for (text, segment_style) in segments.iter() {
                let effective = style.and(*segment_style);
                fitted.push_styled(
                    split_overwide_words(text, width, |s| effective.str_width(&context.font_cache, s)),
                    *segment_style,
                );
            }
            fitted
        });
        paragraph.render(context, area, style)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_text_after_a_tag_that_contains_a_multibyte_character() {
        // The closing bracket is found by byte offset, so skipping it must not consume an extra character.
        assert_eq!(clean_text("<aé>bc"), "bc");
        assert_eq!(clean_text("x<bé>y</bé>z"), "xyz");
    }

    // One millimetre per character keeps the arithmetic obvious.
    fn char_width(s: &str) -> Mm {
        Mm::from(s.chars().count() as f32)
    }

    #[test]
    fn test_split_overwide_words_splits_only_words_wider_than_the_cell() {
        // Five characters plus the trailing space fill a six-millimetre cell.
        assert_eq!(split_overwide_words("Prekoračenje brzine", Mm::from(6.0), char_width), "Preko račen je brzin e");
        assert_eq!(split_overwide_words("short words fit", Mm::from(6.0), char_width), "short words fit");
    }

    #[test]
    fn test_split_overwide_words_keeps_lines_and_places_single_characters_in_tiny_cells() {
        assert_eq!(split_overwide_words("abc\ndefg", Mm::from(3.0), char_width), "ab c\nde fg");
        assert_eq!(split_overwide_words("wide", Mm::from(0.5), char_width), "w i d e");
    }

    #[test]
    fn test_clean_text_strips_html_tags_and_decodes_entities() {
        assert_eq!(clean_text("<code>0912</code>"), "0912");
        assert_eq!(clean_text("<strong>Hello &amp; World</strong>"), "Hello & World");
        assert_eq!(clean_text("No tags here"), "No tags here");
        assert_eq!(clean_text("<span class=\"test\">123</span> / <code>456</code>"), "123 / 456");
    }

    #[test]
    fn test_clean_text_preserves_mathematical_comparisons_and_strips_html() {
        assert_eq!(clean_text("Due soon (< 7 days)"), "Due soon (< 7 days)");
        assert_eq!(clean_text("<b>Title</b> and <code>code</code>"), "Title and code");
        assert_eq!(clean_text("Speed > 90 km/h &amp; < 100 km/h"), "Speed > 90 km/h & < 100 km/h");
    }

    // Long unbroken technical tokens receive manual break opportunities.
    #[test]
    fn test_clean_text_breaks_long_unbroken_technical_tokens() {
        for word in [
            "DF000000000000000000000000000000",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "/card/application/identification/cardIdentificationRecord/cardExtendedSerialNumber/serialNumber",
            "C_TEST_WITH_VERY_LONG_FILE_NAME_AND_IDENTIFIERS_AND_EXTRA_METADATA.ddd",
        ] {
            let cleaned = clean_text(word);
            assert!(
                cleaned.contains(' '),
                "{word} must get manual break opportunities"
            );
        }
    }

    // VIN-length uppercase tokens are broken while short identifiers are preserved.
    #[test]
    fn test_clean_text_breaks_vin_length_tokens_with_no_lowercase_letters() {
        assert!(clean_text("WDB1234567890ABCD").contains(' '));
        assert!(clean_text("1HGCM82633A123456").contains(' '));
        assert_eq!(clean_text("REG-1"), "REG-1");
        assert_eq!(clean_text("AB12CDE"), "AB12CDE");
    }

    // Ordinary long dictionary words are preserved without forced splitting.
    #[test]
    fn test_clean_text_does_not_split_ordinary_long_words() {
        for word in [
            "Operational",
            "Overlapping",
            "Availability",
            "Normalization",
            "Diagnostic",
            "Aktivitätssummen",
            "Normalisierungswarnungen",
            "Datenschutzgrundverordnung",
        ] {
            assert_eq!(clean_text(word), word, "ordinary word must render unchanged, not force-split");
        }
    }
}
