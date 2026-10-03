import { classifyParseError, isFileDisplayName, isSha256Digest, type FileDisplayName, type Result } from '#contracts';
import {
    isJsonPointer,
    isUtcTimestamp,
    type IntegrityAssessment,
    type IntegrityFailureCode,
    type UtcTimestamp,
} from '#viewer-domain';
import { describe, expect, it } from 'vitest';

import {
    acquireDocumentCandidate,
    type IFileDigestPort,
    type IParsedDocumentOperation,
    type IParsedDriverCardDocument,
    type IParsedUnsupportedCardDocument,
    type ITachographFilePicker,
    type ITachographFileResource,
    type ITachographParserPort,
    type ParsedDocumentResult,
    type TachographFileAcquisitionResult,
} from '../index.js';

interface IFileResourceHarness {
    readonly releaseCount: () => number;
    readonly resource: ITachographFileResource;
}

function displayName(value: string): FileDisplayName {
    if (!isFileDisplayName(value)) {
        throw new TypeError('The candidate display-name fixture must be valid.');
    }
    return value;
}

function digestPort(): IFileDigestPort {
    const digest = 'a'.repeat(64);
    if (!isSha256Digest(digest)) {
        throw new TypeError('The candidate digest fixture must be valid.');
    }

    return {
        sha256: () =>
            Promise.resolve({
                ok: true,
                value: digest,
            }),
    };
}

function fileResource(name = 'synthetic.ddd'): IFileResourceHarness {
    let releases = 0;

    return {
        releaseCount: () => releases,
        resource: {
            bytes: new Uint8Array([0x00, 0x02, 0x01]),
            displayName: displayName(name),
            reopenToken: null,
            sourceToken: null,
            release: () => {
                releases += 1;
                return Promise.resolve({
                    ok: true,
                    value: null,
                });
            },
        },
    };
}

function filePicker(result: TachographFileAcquisitionResult): ITachographFilePicker {
    return {
        open: () => Promise.resolve(result),
    };
}

function driverCardDocument(): IParsedDriverCardDocument {
    return {
        applications: [],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {},
        sections: [],
    };
}

function unsupportedCardDocument(): IParsedUnsupportedCardDocument {
    const contentPath = '/cardDataResponses';
    if (!isJsonPointer(contentPath)) {
        throw new TypeError('The unsupported-card source fixture must be valid.');
    }

    return {
        cardType: 'companyCard',
        contentPath,
        documentKind: 'unsupportedCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {},
    };
}

class FakeParser implements ITachographParserPort {
    private readonly _completion: Promise<ParsedDocumentResult>;
    public cancelCalls = 0;
    public parseCalls = 0;

    public constructor(completion: Promise<ParsedDocumentResult>) {
        this._completion = completion;
    }

    public parse(): IParsedDocumentOperation {
        this.parseCalls += 1;
        return {
            cancel: () => {
                this.cancelCalls += 1;
            },
            completion: this._completion,
        };
    }

    public loadErcRootCertificate(): Promise<Result<ArrayBuffer, IntegrityFailureCode>> {
        return Promise.resolve({
            ok: true,
            value: new ArrayBuffer(10),
        });
    }

    public verify(): Promise<Result<IntegrityAssessment, IntegrityFailureCode>> {
        return Promise.resolve({
            error: 'verificationUnsupported',
            ok: false,
        });
    }

    public verifyVehicleUnit(): Promise<Result<IntegrityAssessment, IntegrityFailureCode>> {
        return Promise.resolve({
            error: 'verificationUnsupported',
            ok: false,
        });
    }
}

function clock(): UtcTimestamp {
    const openedAt = Date.UTC(2026, 6, 27);
    if (!isUtcTimestamp(openedAt)) {
        throw new TypeError('The candidate clock fixture must be valid.');
    }
    return openedAt;
}

describe('acquireDocumentCandidate', () => {
    it('preserves file-picker cancellation without starting parsing', async () => {
        const parser = new FakeParser(Promise.resolve({ ok: true, value: driverCardDocument() }));

        await expect(acquireDocumentCandidate(filePicker({ status: 'cancelled' }), digestPort(), parser, clock)).resolves.toEqual(
            {
                status: 'cancelled',
            },
        );
        expect(parser.parseCalls).toBe(0);
    });

    it('creates an opened session and transfers source ownership until disposal', async () => {
        const resource = fileResource();
        const parser = new FakeParser(Promise.resolve({ ok: true, value: driverCardDocument() }));
        const acquisition = await acquireDocumentCandidate(
            filePicker({
                resource: resource.resource,
                status: 'opened',
            }),
            digestPort(),
            parser,
            clock,
        );

        expect(acquisition.status).toBe('ready');
        if (acquisition.status !== 'ready') {
            return;
        }

        const result = await acquisition.operation.completion;
        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(result.value.document.source).toMatchObject({
            byteLength: 3,
            displayName: 'synthetic.ddd',
            openedAt: Date.UTC(2026, 6, 27),
            sha256: 'a'.repeat(64),
        });
        expect(resource.releaseCount()).toBe(0);

        await result.value.dispose();
        await result.value.dispose();
        expect(resource.releaseCount()).toBe(1);
    });

    it('releases the source when parsing fails', async () => {
        const resource = fileResource();
        const parser = new FakeParser(
            Promise.resolve({
                error: classifyParseError('malformedData'),
                ok: false,
            }),
        );
        const acquisition = await acquireDocumentCandidate(
            filePicker({
                resource: resource.resource,
                status: 'opened',
            }),
            digestPort(),
            parser,
            clock,
        );
        if (acquisition.status !== 'ready') {
            return;
        }

        await expect(acquisition.operation.completion).resolves.toEqual({
            error: classifyParseError('malformedData'),
            ok: false,
        });
        expect(resource.releaseCount()).toBe(1);
    });

    it('forwards cancellation to parsing and releases the source', async () => {
        const resource = fileResource();
        const deferred = Promise.withResolvers<ParsedDocumentResult>();
        const parser = new FakeParser(deferred.promise);
        const acquisition = await acquireDocumentCandidate(
            filePicker({
                resource: resource.resource,
                status: 'opened',
            }),
            digestPort(),
            parser,
            clock,
        );
        if (acquisition.status !== 'ready') {
            return;
        }

        await Promise.resolve();
        acquisition.operation.cancel();
        deferred.resolve({
            error: classifyParseError('cancelled'),
            ok: false,
        });

        await expect(acquisition.operation.completion).resolves.toEqual({
            error: classifyParseError('cancelled'),
            ok: false,
        });
        expect(parser.cancelCalls).toBe(1);
        expect(resource.releaseCount()).toBe(1);
    });

    it('does not open explicitly unsupported card evidence', async () => {
        const resource = fileResource();
        const parser = new FakeParser(
            Promise.resolve({
                ok: true,
                value: unsupportedCardDocument(),
            }),
        );
        const acquisition = await acquireDocumentCandidate(
            filePicker({
                resource: resource.resource,
                status: 'opened',
            }),
            digestPort(),
            parser,
            clock,
        );
        if (acquisition.status !== 'ready') {
            return;
        }

        await expect(acquisition.operation.completion).resolves.toEqual({
            error: classifyParseError('unsupportedContent'),
            ok: false,
        });
        expect(resource.releaseCount()).toBe(1);
    });
});
