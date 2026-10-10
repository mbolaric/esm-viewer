import { describe, expect, it } from 'vitest';

import { resolveJsonPointer } from '#viewer-application';

import type { CardFileID, VerifyItem, VerifyResult, VerifyStatus } from '../generated/esm_parser.js';
import { decodeParserVerification } from '../decoders/parser-verification-decoder.js';

function item(cardFileId: CardFileID, status: VerifyStatus): VerifyItem {
    return {
        card_file_id: cardFileId,
        end_of_validity: null,
        status,
    };
}

describe('decodeParserVerification', () => {
    it.each([null, 'not a report', {}, { result: [], status: 'unknown' }, { result: null, status: 'Valid' }])(
        'rejects unknown responses outside the verification envelope %#',
        (value) => {
            expect(decodeParserVerification(value, 'g1', {}, {})).toEqual({
                error: 'invalidVerificationResult',
                ok: false,
            });
        },
    );

    it('retains the JSON budget check after accepting the outer verification shape', () => {
        expect(decodeParserVerification({ extra: 'x'.repeat(1_048_577), result: [], status: 'Unsigned' }, 'g1', {}, {})).toEqual({
            error: 'verificationResultOutsideBounds',
            ok: false,
        });
    });

    it('normalizes every valid and invalid item and preserves aggregate status', () => {
        const dataFiles = {
            EventsData: { data: [1] },
            Identification: { data: [2] },
        };
        const dataFileSourcePaths = {
            EventsData: '/cardDataResponses/eventsData',
            Identification: '/cardDataResponses/identification',
        };
        const sourceRoot = {
            cardDataResponses: {
                eventsData: dataFiles.EventsData,
                identification: dataFiles.Identification,
            },
        };
        const raw: VerifyResult = {
            result: [item('EventsData', 'Valid'), item('Identification', 'InvalidSignatureSize')],
            status: 'PartiallyValid',
        };
        const result = decodeParserVerification(raw, 'g2', dataFiles, dataFileSourcePaths);

        expect(result.ok).toBe(true);
        if (!result.ok || !('items' in result.value.assessment)) {
            return;
        }

        expect(result.value.assessment).toMatchObject({
            status: 'partiallyValid',
        });
        expect(result.value.assessment.items.map((entry) => entry.status)).toEqual(['valid', 'invalid']);
        expect(result.value.assessment.items.map((entry) => entry.recordId)).toEqual(['EventsData', 'Identification']);
        expect(result.value.assessment.items[1]?.source.path).toBe('/cardDataResponses/identification');

        for (const verificationItem of result.value.assessment.items) {
            expect(resolveJsonPointer(sourceRoot, verificationItem.source.path).ok).toBe(true);
        }
    });

    it.each([
        ['Valid', [item('EventsData', 'Valid')], 'valid'],
        ['Invalid', [item('EventsData', 'NotHaveSignature')], 'invalid'],
        ['Unsigned', [], 'unsupported'],
    ] satisfies readonly [VerifyResult['status'], VerifyItem[], 'invalid' | 'unsupported' | 'valid'][])(
        'maps %s into the required integrity state',
        (status, resultItems, expected) => {
            const result = decodeParserVerification(
                {
                    result: resultItems,
                    status,
                },
                'g1',
                { EventsData: { data: [] } },
                { EventsData: '/cardDataResponses/eventsData' },
            );

            expect(result.ok && result.value.assessment.status).toBe(expected);
        },
    );

    it.each([
        [
            {
                result: [item('EventsData', 'Invalid')],
                status: 'Valid',
            },
            'aggregateStatusMismatch',
        ],
        [
            {
                result: [item('Identification', 'Valid')],
                status: 'Valid',
            },
            'missingSourceData',
        ],
        [
            {
                result: [item('EventsData', 'Valid'), item('EventsData', 'Valid')],
                status: 'Valid',
            },
            'duplicateVerificationItem',
        ],
        [
            {
                result: [],
                status: 'PartiallyValid',
            },
            'invalidVerificationResult',
        ],
        [
            {
                result: [item('EventsData', 'Valid')],
                status: 'Unsigned',
            },
            'aggregateStatusMismatch',
        ],
    ] satisfies readonly [VerifyResult, string][])('rejects inconsistent verification evidence %#', (raw, expectedError) => {
        expect(
            decodeParserVerification(
                raw,
                'g1',
                {
                    EventsData: { data: [] },
                },
                {
                    EventsData: '/cardDataResponses/eventsData',
                },
            ),
        ).toEqual({
            error: expectedError,
            ok: false,
        });
    });

    it('rejects duplicate canonical source paths across distinct items', () => {
        expect(
            decodeParserVerification(
                {
                    result: [item('EventsData', 'Valid'), item('Identification', 'Valid')],
                    status: 'Valid',
                },
                'g1',
                {
                    EventsData: { data: [] },
                    Identification: { data: [] },
                },
                {
                    EventsData: '/cardDataResponses/eventsData',
                    Identification: '/cardDataResponses/eventsData',
                },
            ),
        ).toEqual({
            error: 'duplicateVerificationItem',
            ok: false,
        });
    });

    it('rejects a source path that is not a canonical JSON Pointer', () => {
        expect(
            decodeParserVerification(
                {
                    result: [item('EventsData', 'Valid')],
                    status: 'Valid',
                },
                'g1',
                { EventsData: { data: [] } },
                { EventsData: 'cardDataResponses/eventsData' },
            ),
        ).toEqual({
            error: 'invalidVerificationSource',
            ok: false,
        });
    });
});
