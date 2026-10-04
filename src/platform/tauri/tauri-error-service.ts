import { ErrorService, type IErrorService } from '#error-reporting';
import { ConsoleErrorProvider } from './console-error-provider.js';
import { LogFileErrorProvider } from './log-file-error-provider.js';
import { NativeDebugLogErrorProvider } from './native-debug-log-error-provider.js';

export function createTauriErrorService(): IErrorService {
    return new ErrorService([new ConsoleErrorProvider(), new LogFileErrorProvider(), new NativeDebugLogErrorProvider()]);
}
