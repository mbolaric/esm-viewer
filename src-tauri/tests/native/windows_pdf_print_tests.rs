use super::{hresult_failure, printer_dialog, Runtime};
use windows::Win32::Foundation::E_FAIL;
use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

#[test]
fn a_background_apartment_cannot_open_the_native_print_panel() {
    let result = std::thread::spawn(|| {
        unsafe { RoInitialize(RO_INIT_MULTITHREADED) }.unwrap();
        let _runtime = Runtime;
        printer_dialog(0, 1).err()
    })
    .join()
    .unwrap();

    assert_eq!(result.as_deref(), Some("print.windows.dialog-requires-sta"));
}

#[test]
fn diagnostics_retain_the_operation_and_code_without_os_message_content() {
    let error = windows::core::Error::new(E_FAIL, "Synthetic private document or printer details");

    assert_eq!(hresult_failure("dialog", error), "print.windows.dialog code=0x80004005");
}
