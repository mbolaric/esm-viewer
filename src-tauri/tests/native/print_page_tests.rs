use super::place_page;

#[test]
fn matching_paper_keeps_pdf_dimensions_without_extra_margins() {
    let page = place_page(595.28, 841.89, 595.28, 841.89).unwrap();
    assert_eq!((page.x, page.y, page.scale), (0.0, 0.0, 1.0));
}

#[test]
fn larger_paper_centers_the_pdf_without_enlarging_fonts() {
    let page = place_page(595.0, 842.0, 695.0, 942.0).unwrap();
    assert_eq!((page.x, page.y, page.scale), (50.0, 50.0, 1.0));
}

#[test]
fn smaller_paper_preserves_the_page_aspect_ratio() {
    let page = place_page(600.0, 800.0, 300.0, 500.0).unwrap();
    assert_eq!((page.x, page.y, page.scale), (0.0, 50.0, 0.5));
}

#[test]
fn invalid_dimensions_cannot_reach_native_rendering() {
    for invalid in [0.0, -1.0, f64::NAN, f64::INFINITY] {
        assert!(place_page(invalid, 842.0, 595.0, 842.0).is_err());
        assert!(place_page(595.0, 842.0, 595.0, invalid).is_err());
    }
}
