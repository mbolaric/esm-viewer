// Cross-platform vector PDF generation engine.

mod attestation;
pub mod commands;
mod document;
pub use document::{render_pdf, PdfDocumentRequest};
mod fonts;
mod hyphenation;
mod infringement;
mod layout;
mod report;
mod text;
