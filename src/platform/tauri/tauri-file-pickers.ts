import {
    classifyParseError,
    type DesktopOperationFailureCode,
    err,
    isFileDisplayName,
    MAXIMUM_OPEN_FILE_BYTES,
    ok,
    type OpenTachographFileResult,
    type ParseError,
    type ReopenToken,
    type SourceToken,
} from '#contracts';
import {
    hasRecognizedTachographHeader,
    type DocumentSessionDisposeResult,
    type IDroppedTachographFile,
    type ITachographFilePicker,
    type ITachographFileResource,
    type TachographFileAcquisitionResult,
} from '#viewer-application';
import { type TauriPlatformService } from './tauri-platform-service.js';
import { createRandomReopenToken, createRandomSourceToken } from './token.js';

const OPEN_FAILURE_MAPPING: Record<DesktopOperationFailureCode, ParseError['code']> = {
    destinationExists: 'decoderContractViolation',
    guardUnavailable: 'decoderContractViolation',
    fileNotFound: 'fileNotFound',
    invalidPreferences: 'decoderContractViolation',
    invalidRequest: 'decoderContractViolation',
    invalidResponse: 'decoderContractViolation',
    ioFailure: 'fileReadFailed',
    sourceConflict: 'decoderContractViolation',
    tooLarge: 'fileTooLarge',
    unsupportedContent: 'unsupportedContent',
};

export function mapOpenResult(service: TauriPlatformService, result: OpenTachographFileResult): TachographFileAcquisitionResult {
    switch (result.status) {
        case 'cancelled':
            return {
                status: 'cancelled',
            };
        case 'failed':
            return {
                error: classifyParseError(OPEN_FAILURE_MAPPING[result.code]),
                status: 'failed',
            };
        case 'opened':
            return {
                resource: createTauriFileResource(
                    service,
                    result.file.bytes,
                    result.file.displayName,
                    result.file.reopenToken ?? createRandomReopenToken(),
                    result.file.sourceToken,
                ),
                status: 'opened',
            };
    }
}

export function createTauriFileResource(
    service: TauriPlatformService,
    bytes: Uint8Array,
    displayName: ITachographFileResource['displayName'],
    reopenToken: ReopenToken,
    sourceToken: SourceToken | null,
): ITachographFileResource {
    let release: ReturnType<ITachographFileResource['release']> | null = null;

    return {
        bytes,
        displayName,
        reopenToken,
        sourceToken: sourceToken ?? createRandomSourceToken(),
        release(): ReturnType<ITachographFileResource['release']> {
            release ??= releaseSource(service, sourceToken);
            return release;
        },
    };
}

function releaseSource(service: TauriPlatformService, sourceToken: SourceToken | null): Promise<DocumentSessionDisposeResult> {
    if (sourceToken === null) {
        return Promise.resolve(ok(null));
    }

    try {
        const releaseResult = service.releaseSource({ sourceToken });
        return Promise.resolve(releaseResult.status === 'released' ? ok(null) : err(classifyParseError('documentCleanupFailed')));
    } catch {
        return Promise.resolve(err(classifyParseError('documentCleanupFailed')));
    }
}

export class TauriTachographFilePicker implements ITachographFilePicker {
    private readonly _service: TauriPlatformService;

    public constructor(service: TauriPlatformService) {
        this._service = service;
    }

    public async open(): Promise<TachographFileAcquisitionResult> {
        let result: OpenTachographFileResult;
        try {
            result = await this._service.openTachographFile();
        } catch {
            return {
                error: classifyParseError('fileReadFailed'),
                status: 'failed',
            };
        }

        return mapOpenResult(this._service, result);
    }
}

export class TauriReopenTachographFilePicker implements ITachographFilePicker {
    private readonly _service: TauriPlatformService;
    private readonly _reopenToken: ReopenToken;

    public constructor(service: TauriPlatformService, reopenToken: ReopenToken) {
        this._service = service;
        this._reopenToken = reopenToken;
    }

    public async open(): Promise<TachographFileAcquisitionResult> {
        let result: OpenTachographFileResult;
        try {
            result = await this._service.openTachographPath({ reopenToken: this._reopenToken });
        } catch {
            return {
                error: classifyParseError('fileReadFailed'),
                status: 'failed',
            };
        }

        return mapOpenResult(this._service, result);
    }
}

export class TauriDroppedTachographFilePicker implements ITachographFilePicker {
    private readonly _service: TauriPlatformService;
    private readonly _file: IDroppedTachographFile;

    public constructor(service: TauriPlatformService, file: IDroppedTachographFile) {
        this._service = service;
        this._file = file;
    }

    public async open(): Promise<TachographFileAcquisitionResult> {
        if (!Number.isSafeInteger(this._file.size) || this._file.size < 2 || this._file.size > MAXIMUM_OPEN_FILE_BYTES) {
            return {
                error: classifyParseError(this._file.size > MAXIMUM_OPEN_FILE_BYTES ? 'fileTooLarge' : 'unsupportedContent'),
                status: 'failed',
            };
        }

        if (!isFileDisplayName(this._file.name)) {
            return {
                error: classifyParseError('invalidFileName'),
                status: 'failed',
            };
        }

        try {
            const bytes = new Uint8Array(await this._file.arrayBuffer());
            if (bytes.byteLength !== this._file.size || !hasRecognizedTachographHeader(bytes)) {
                return {
                    error: classifyParseError('unsupportedContent'),
                    status: 'failed',
                };
            }

            let sourceToken: SourceToken | null = null;
            try {
                const registration = this._service.registerExportSource();
                if (registration.status === 'registered') {
                    sourceToken = registration.sourceToken;
                }
            } catch {
                sourceToken = null;
            }

            return {
                resource: createTauriFileResource(this._service, bytes, this._file.name, createRandomReopenToken(), sourceToken),
                status: 'opened',
            };
        } catch {
            return {
                error: classifyParseError('fileReadFailed'),
                status: 'failed',
            };
        }
    }
}
