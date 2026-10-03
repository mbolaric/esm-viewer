// Locale-aware hyphenation for PDF text wrapping.

use hyphenation::{Language, Load, Standard};

// Loads the hyphenation dictionary for locale with US English fallback.
pub fn hyphenator_for_locale(locale: &str) -> Standard {
    let language = match locale {
        "de" => Language::German1996,
        _ => Language::EnglishUS,
    };

    Standard::from_embedded(language)
        .or_else(|_| Standard::from_embedded(Language::EnglishUS))
        .expect("the en-us hyphenation dictionary is embedded via the embed_all feature")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hyphenator_for_locale_loads_german_for_de() {
        let hyphenator = hyphenator_for_locale("de");
        assert_eq!(hyphenator.language(), Language::German1996);
    }

    #[test]
    fn test_hyphenator_for_locale_defaults_to_english_for_unknown_locales() {
        for locale in ["en", "", "fr", "unknown"] {
            let hyphenator = hyphenator_for_locale(locale);
            assert_eq!(hyphenator.language(), Language::EnglishUS);
        }
    }
}
