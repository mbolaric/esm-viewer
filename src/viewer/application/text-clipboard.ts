import { err, ok, type Result } from '#contracts';

export type TextClipboardWriteResult = Result<null, 'clipboardWriteFailed'>;

export interface ITextClipboardPort {
    writeText(value: string): Promise<void>;
}

export async function writeTextToClipboard(clipboard: ITextClipboardPort, value: string): Promise<TextClipboardWriteResult> {
    try {
        await clipboard.writeText(value);
        return ok(null);
    } catch {
        return err('clipboardWriteFailed');
    }
}
