export { ConsoleErrorProvider } from './console-error-provider.js';
export { exactArrayBuffer } from './desktop-failure.js';
export {
    createExportPort,
    createFileDigest,
    createPdfPort,
    createPreferencesStore,
    createRuntimeVersionsPort,
    createTextClipboardPort,
    generateDocument,
} from './desktop-ports.js';
export { LogFileErrorProvider } from './log-file-error-provider.js';
export { logPlatformError } from './log-platform-error.js';
export { NativeDebugLogErrorProvider } from './native-debug-log-error-provider.js';
export {
    TauriDroppedTachographFilePicker,
    TauriReopenTachographFilePicker,
    TauriTachographFilePicker,
} from './tauri-file-pickers.js';
export { TauriPlatformService, generateNativeDocument } from './tauri-platform-service.js';
export { TauriPreferencesTarget, type ITauriPreferencesTargetOptions } from './tauri-preferences-target.js';
export { TauriTachographParser } from './tauri-tachograph-parser.js';
export { createTauriViewerContext, type ITauriViewerCompositionOptions } from './tauri-viewer-composition.js';
export { createRandomReopenToken, createRandomSourceToken } from './token.js';
export {
    createApplicationMenu,
    createCommandMenuItem,
    isLinux,
    isMacOS,
    type IApplicationMenu,
    type IApplicationMenuOptions,
} from './viewer-menu.js';
export { createNativeCommandMenuItem, createNativeMenuItems } from './application-menu-items.js';
export { createBrowserKeyValueStore } from './browser-key-value-store.js';
