import {
    classifyParseError,
    err,
    type FileDisplayName,
    type IJsonRecord,
    type IParserVuVerificationSourcePaths,
    ok,
    type ParseError,
    type ReopenToken,
    type Result,
    type Sha256Digest,
    type SourceToken,
} from '#contracts';
import {
    isUtcTimestamp,
    type IntegrityAssessment,
    type IntegrityFailureCode,
    type UtcTimestamp,
    type VerificationGeneration,
} from '#viewer-domain';

import { createDocumentSource } from './document-source.js';
import type {
    DocumentOpenResult,
    DocumentSessionDisposeResult,
    IDocumentOpenOperation,
    IOpenedDocumentSession,
} from './document-lifecycle.js';
import { createOpenedTachographDocument, type ParsedParserDocument } from './opened-document.js';

export interface ITachographFileResource {
    readonly bytes: Uint8Array;
    readonly displayName: FileDisplayName;
    readonly reopenToken: ReopenToken | null;
    readonly sourceToken: SourceToken | null;
    release(): Promise<DocumentSessionDisposeResult>;
}

export type TachographFileAcquisitionResult =
    | { readonly error: ParseError; readonly status: 'failed' }
    | { readonly resource: ITachographFileResource; readonly status: 'opened' }
    | { readonly status: 'cancelled' };

export interface ITachographFilePicker {
    open(): Promise<TachographFileAcquisitionResult>;
}

export interface IDroppedTachographFile {
    readonly name: string;
    readonly size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export interface IFileDigestPort {
    sha256(bytes: Uint8Array): Promise<Result<Sha256Digest, ParseError>>;
}

export type ParsedDocumentResult = Result<ParsedParserDocument, ParseError>;

export interface IParsedDocumentOperation {
    readonly completion: Promise<ParsedDocumentResult>;
    cancel(): void;
}

export interface ITachographParserPort {
    parse(bytes: Uint8Array, displayName: FileDisplayName): IParsedDocumentOperation;
    loadErcRootCertificate(generation: VerificationGeneration): Promise<Result<ArrayBuffer, IntegrityFailureCode>>;
    verify(
        generation: VerificationGeneration,
        dataFiles: IJsonRecord,
        dataFileSourcePaths: Readonly<Record<string, string>>,
        rootCertificate: ArrayBuffer,
    ): Promise<Result<IntegrityAssessment, IntegrityFailureCode>>;
    verifyVehicleUnit(
        generation: VerificationGeneration,
        memberStateCertificateRaw: readonly number[],
        vuCertificateRaw: readonly number[],
        sourcePaths: IParserVuVerificationSourcePaths,
        dataFiles: readonly unknown[],
        rootCertificate: ArrayBuffer,
    ): Promise<Result<IntegrityAssessment, IntegrityFailureCode>>;
}

export type DocumentClock = () => UtcTimestamp;

export type DocumentCandidateAcquisitionResult =
    | { readonly error: ParseError; readonly status: 'failed' }
    | { readonly operation: IDocumentOpenOperation; readonly status: 'ready' }
    | { readonly status: 'cancelled' };

async function releaseResource(resource: ITachographFileResource): Promise<DocumentSessionDisposeResult> {
    try {
        return await resource.release();
    } catch {
        return err(classifyParseError('documentCleanupFailed'));
    }
}

class OpenedDocumentSession implements IOpenedDocumentSession {
    private _disposal: Promise<DocumentSessionDisposeResult> | null = null;
    private readonly _resource: ITachographFileResource;
    public document: IOpenedDocumentSession['document'];

    public constructor(document: IOpenedDocumentSession['document'], resource: ITachographFileResource) {
        this.document = document;
        this._resource = resource;
    }

    public dispose(): Promise<DocumentSessionDisposeResult> {
        this._disposal ??= releaseResource(this._resource);
        return this._disposal;
    }
}

class DocumentCandidateOperation implements IDocumentOpenOperation {
    private readonly _clock: DocumentClock;
    private readonly _digest: IFileDigestPort;
    private readonly _parser: ITachographParserPort;
    private _parserOperation: IParsedDocumentOperation | null = null;
    private _release: Promise<DocumentSessionDisposeResult> | null = null;
    private readonly _resource: ITachographFileResource;
    private _resourceTransferred = false;
    private _cancelled = false;
    public readonly completion: Promise<DocumentOpenResult>;
    public readonly displayName: FileDisplayName;

    public constructor(
        resource: ITachographFileResource,
        digest: IFileDigestPort,
        parser: ITachographParserPort,
        clock: DocumentClock,
    ) {
        this._clock = clock;
        this._digest = digest;
        this._parser = parser;
        this._resource = resource;
        this.displayName = resource.displayName;
        this.completion = this.run();
    }

    public cancel(): void {
        this._cancelled = true;
        this._parserOperation?.cancel();
    }

    private async fail(error: ParseError): Promise<DocumentOpenResult> {
        const releaseResult = await this.release();
        return releaseResult.ok ? err(error) : releaseResult;
    }

    private release(): Promise<DocumentSessionDisposeResult> {
        if (this._resourceTransferred) {
            return Promise.resolve(ok(null));
        }

        this._release ??= releaseResource(this._resource);
        return this._release;
    }

    private async run(): Promise<DocumentOpenResult> {
        try {
            const byteLength = this._resource.bytes.byteLength;
            const digest = await this._digest.sha256(this._resource.bytes);
            if (!digest.ok) {
                return await this.fail(digest.error);
            }
            if (this._cancelled) {
                return await this.fail(classifyParseError('cancelled'));
            }

            const openedAt = this._clock();
            if (!isUtcTimestamp(openedAt)) {
                return await this.fail(classifyParseError('internalError'));
            }

            const parserOperation = this._parser.parse(this._resource.bytes, this._resource.displayName);
            this._parserOperation = parserOperation;
            if (this.isCancelled()) {
                parserOperation.cancel();
            }

            const parsed = await parserOperation.completion;
            this._parserOperation = null;
            if (this.isCancelled() || (!parsed.ok && parsed.error.category === 'cancellation')) {
                return await this.fail(classifyParseError('cancelled'));
            }
            if (!parsed.ok) {
                return await this.fail(parsed.error);
            }
            if (parsed.value.documentKind === 'unsupportedCard') {
                return await this.fail(classifyParseError('unsupportedContent'));
            }

            const source = createDocumentSource(
                {
                    byteLength,
                    displayName: this._resource.displayName,
                    sha256: digest.value,
                },
                openedAt,
                this._resource.sourceToken,
                this._resource.reopenToken,
            );
            const document = createOpenedTachographDocument(source, parsed.value);
            const session = new OpenedDocumentSession(document, this._resource);
            this._resourceTransferred = true;

            return ok(session);
        } catch {
            return await this.fail(classifyParseError('internalError'));
        }
    }

    private isCancelled(): boolean {
        return this._cancelled;
    }
}

export async function acquireDocumentCandidate(
    filePicker: ITachographFilePicker,
    digest: IFileDigestPort,
    parser: ITachographParserPort,
    clock: DocumentClock,
): Promise<DocumentCandidateAcquisitionResult> {
    let acquisition: TachographFileAcquisitionResult;
    try {
        acquisition = await filePicker.open();
    } catch {
        return {
            error: classifyParseError('fileReadFailed'),
            status: 'failed',
        };
    }

    switch (acquisition.status) {
        case 'cancelled':
            return {
                status: 'cancelled',
            };
        case 'failed':
            return {
                error: acquisition.error,
                status: 'failed',
            };
        case 'opened':
            return {
                operation: new DocumentCandidateOperation(acquisition.resource, digest, parser, clock),
                status: 'ready',
            };
    }
}
