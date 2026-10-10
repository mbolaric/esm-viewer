import { beforeEach, describe, expect, it, vi } from 'vitest';

import { classifyParseError, err } from '#contracts';
import type { SerializedTachographData, VerifyResult, VuVerifyResult } from '#viewer-parser-client';

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn<(command: string, args?: unknown) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: invokeMock,
}));

import { TauriTachographParser } from '../tauri-tachograph-parser.js';

const document: SerializedTachographData = {
    data: {
        dataFiles: [],
        header: {
            cardInVuData: false,
            dataType: 'VU',
            generation: 'SecondGeneration',
        },
        transferResParams: [],
    },
    kind: 'vuGen2',
};

const vuSourcePaths = {
    dataFileSourcePaths: { 'Overview.1': '/dataFiles/0' },
    memberStateCertificate: '/transferResParams/0/data/Control/memberStateCertificateRaw',
    vuCertificate: '/transferResParams/0/data/Control/vuCertificateRaw',
};

function mockParsing(loadNationAlphaCodes: () => Promise<unknown> = () => Promise.resolve({ Germany: 'D' })): void {
    invokeMock.mockImplementation(async (command) => {
        if (command === 'parse_ddd_memory') {
            return { data: document, ok: true };
        }
        if (command === 'get_supported_nation_alpha_codes') {
            return loadNationAlphaCodes();
        }
        throw new Error('Unexpected native command in parser test.');
    });
}

describe('TauriTachographParser', () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it('sends the file as the raw request body rather than a JSON number array', async () => {
        invokeMock.mockResolvedValueOnce({ data: null, error: 'Parsing error', ok: false });
        const bytes = Uint8Array.from([1, 2, 3]);

        const result = await new TauriTachographParser().parse(bytes).completion;

        expect(invokeMock).toHaveBeenCalledWith('parse_ddd_memory', bytes);
        expect(result).toEqual(err(classifyParseError('parseFailed')));
    });

    it('treats a native answer of an unexpected shape as a failed parse', async () => {
        invokeMock.mockResolvedValueOnce('not a parse response');

        const result = await new TauriTachographParser().parse(Uint8Array.from([1])).completion;

        expect(result).toEqual(err(classifyParseError('parseFailed')));
    });

    it('validates the document tree once and preserves the raw evidence', async () => {
        mockParsing();
        const entries = vi.spyOn(Object, 'entries');
        try {
            const result = await new TauriTachographParser().parse(Uint8Array.from([1])).completion;

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.rawTree).toBe(document.data);
                expect(result.value.parserVariant).toBe('vuGen2');
            }
            expect(entries.mock.calls.filter(([value]) => value === document.data)).toHaveLength(1);
        } finally {
            entries.mockRestore();
        }
    });

    it('reuses successful nation metadata within an instance, not across instances', async () => {
        const metadata = vi.fn<() => Promise<unknown>>().mockResolvedValue({ Germany: 'D' });
        mockParsing(metadata);
        const parser = new TauriTachographParser();
        const bytes = Uint8Array.from([1]);

        expect((await parser.parse(bytes).completion).ok).toBe(true);
        expect((await parser.parse(bytes).completion).ok).toBe(true);
        expect(metadata).toHaveBeenCalledTimes(1);
        expect((await new TauriTachographParser().parse(bytes).completion).ok).toBe(true);
        expect(metadata).toHaveBeenCalledTimes(2);
    });

    it('shares an in-flight metadata request between concurrent parses', async () => {
        const pending = Promise.withResolvers<unknown>();
        const metadata = vi.fn<() => Promise<unknown>>().mockReturnValue(pending.promise);
        mockParsing(metadata);
        const parser = new TauriTachographParser();
        const completions = [parser.parse(Uint8Array.from([1])).completion, parser.parse(Uint8Array.from([2])).completion];

        await vi.waitFor(() => {
            expect(metadata).toHaveBeenCalledTimes(1);
        });
        pending.resolve({ Germany: 'D' });
        expect((await Promise.all(completions)).every((result) => result.ok)).toBe(true);
        expect(metadata).toHaveBeenCalledTimes(1);
    });

    it.each(['invalid', 'rejected'] as const)('retries %s metadata and caches the successful retry', async (failure) => {
        const metadata = vi.fn<() => Promise<unknown>>().mockResolvedValue({ Germany: 'D' });
        if (failure === 'invalid') {
            metadata.mockResolvedValueOnce({});
        } else {
            metadata.mockRejectedValueOnce(new Error('Synthetic IPC failure.'));
        }
        mockParsing(metadata);
        const parser = new TauriTachographParser();
        const bytes = Uint8Array.from([1]);

        const expectedFailure = err(classifyParseError(failure === 'invalid' ? 'decoderContractViolation' : 'internalError'));
        expect(await Promise.all([parser.parse(bytes).completion, parser.parse(bytes).completion])).toEqual([
            expectedFailure,
            expectedFailure,
        ]);
        expect(metadata).toHaveBeenCalledTimes(1);
        expect((await parser.parse(bytes).completion).ok).toBe(true);
        expect((await parser.parse(bytes).completion).ok).toBe(true);
        expect(metadata).toHaveBeenCalledTimes(2);
    });

    it('reports an invalid header without discarding successful nation metadata', async () => {
        const metadata = vi.fn<() => Promise<unknown>>().mockResolvedValue({ Germany: 'D' });
        mockParsing(metadata);
        invokeMock.mockResolvedValueOnce({ data: { data: { ...document.data, header: null }, kind: document.kind }, ok: true });
        const parser = new TauriTachographParser();
        const bytes = Uint8Array.from([1]);

        expect(await parser.parse(bytes).completion).toEqual(err(classifyParseError('decoderContractViolation')));
        expect((await parser.parse(bytes).completion).ok).toBe(true);
        expect(metadata).toHaveBeenCalledTimes(1);
    });

    it('preserves card verification status and canonical evidence pointers', async () => {
        const report: VerifyResult = {
            result: [{ card_file_id: 'EventsData', end_of_validity: null, status: 'Valid' }],
            status: 'Valid',
        };
        invokeMock.mockResolvedValueOnce({ data: report, ok: true });
        const result = await new TauriTachographParser().verify(
            'g1',
            { EventsData: { data: [1] } },
            { EventsData: '/cardDataResponses/eventsData' },
            Uint8Array.from([2, 3]).buffer,
        );

        expect(result).toMatchObject({
            ok: true,
            value: {
                items: [{ recordId: 'EventsData', source: { path: '/cardDataResponses/eventsData' }, status: 'valid' }],
                status: 'valid',
            },
        });
        expect(invokeMock).toHaveBeenCalledWith('verify_document', {
            dataFiles: { EventsData: { data: [1] } },
            ercaPk: [2, 3],
            generation: 'g1',
        });
    });

    it.each([false, true])('preserves the VU verification scope when data records are present: %s', async (hasRecords) => {
        const certificates: VuVerifyResult['result'] = [
            { certificate: 'MemberStateCertificate', end_of_validity: null, status: 'Valid' },
            { certificate: 'VuCertificate', end_of_validity: null, status: 'Valid' },
        ];
        const report: VuVerifyResult = {
            result: hasRecords
                ? [...certificates, { end_of_validity: null, position: 1, status: 'Valid', trepId: 'Overview' }]
                : certificates,
            status: 'Valid',
        };
        const dataFiles = hasRecords ? [{ position: 1, trepId: 'Overview' }] : [];
        invokeMock.mockResolvedValueOnce({ data: report, ok: true });
        const result = await new TauriTachographParser().verifyVehicleUnit(
            'g2',
            [1],
            [2],
            vuSourcePaths,
            dataFiles,
            Uint8Array.from([3]).buffer,
        );

        expect(result).toMatchObject({ ok: true, value: { status: hasRecords ? 'valid' : 'chainVerified' } });
        if (result.ok && 'items' in result.value) {
            expect(result.value.items.map((item) => item.source.path)).toEqual([
                vuSourcePaths.memberStateCertificate,
                vuSourcePaths.vuCertificate,
                ...(hasRecords ? ['/dataFiles/0'] : []),
            ]);
        }
        expect(invokeMock).toHaveBeenCalledWith('verify_vu_document', {
            dataFiles: hasRecords ? dataFiles : null,
            ercaPk: [3],
            generation: 'g2',
            memberStateCertificateRaw: [1],
            vuCertificateRaw: [2],
        });
    });

    it.each([
        [{ data: null, ok: false }, 'verificationFailed'],
        [{ data: null, ok: true }, 'verificationFailed'],
        ['not a native response', 'verificationFailed'],
        [{ data: { result: [], status: 'unknown' }, ok: true }, 'decoderContractViolation'],
    ] as const)('preserves native and decoder verification failures %#', async (response, expected) => {
        const parser = new TauriTachographParser();
        const operations = [
            () => parser.verify('g1', {}, {}, new ArrayBuffer(0)),
            () => parser.verifyVehicleUnit('g2', [], [], vuSourcePaths, [], new ArrayBuffer(0)),
        ];
        for (const verify of operations) {
            invokeMock.mockResolvedValueOnce(response);
            expect(await verify()).toEqual(err(expected));
        }
    });

    it('preserves internal errors from rejected native commands', async () => {
        const parser = new TauriTachographParser();
        invokeMock.mockRejectedValue(new Error('Synthetic native failure.'));

        expect(await parser.parse(Uint8Array.from([1])).completion).toEqual(err(classifyParseError('internalError')));
        expect(await parser.verify('g1', {}, {}, new ArrayBuffer(0))).toEqual(err('internalError'));
        expect(await parser.verifyVehicleUnit('g2', [], [], vuSourcePaths, [], new ArrayBuffer(0))).toEqual(err('internalError'));
    });
});
