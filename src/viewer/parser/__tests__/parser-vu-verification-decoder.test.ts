import { describe, expect, it } from 'vitest';

import { resolveJsonPointer } from '#viewer-application';

import type {
    VUTransferResponseParameterID,
    VuCertificateKind,
    VuVerifyItem,
    VuVerifyResult,
    VerifyStatus,
} from '../generated/esm_parser.js';
import { decodeParserVuVerification } from '../decoders/parser-vu-verification-decoder.js';

function certItem(certificate: VuCertificateKind, status: VerifyStatus): VuVerifyItem {
    return {
        certificate,
        end_of_validity: null,
        status,
    };
}

function recordItem(trepId: VUTransferResponseParameterID, position: number, status: VerifyStatus): VuVerifyItem {
    return {
        end_of_validity: null,
        position,
        status,
        trepId,
    };
}

describe('decodeParserVuVerification', () => {
    it('decodes certificate-chain-only verification and preserves chainVerified status', () => {
        const sourcePaths = {
            memberStateCertificate: '/transferResParams/0/data/Control/memberStateCertificateRaw',
            vuCertificate: '/transferResParams/0/data/Control/vuCertificateRaw',
        };
        const raw: VuVerifyResult = {
            result: [certItem('MemberStateCertificate', 'Valid'), certItem('VuCertificate', 'Valid')],
            status: 'Valid',
        };
        const result = decodeParserVuVerification(raw, 'g2', sourcePaths);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.value).toMatchObject({
            chainStatus: 'valid',
            status: 'chainVerified',
        });
        expect(result.value.items.map((entry) => entry.recordId)).toEqual(['memberStateCertificate', 'vuCertificate']);
        expect(result.value.items.map((entry) => entry.status)).toEqual(['valid', 'valid']);
    });

    it('decodes full VU verification with both certificates and data records and preserves valid status', () => {
        const sourcePaths = {
            dataFileSourcePaths: {
                'Activities.2': '/dataFiles/1',
                'EventsAndFaults.3': '/dataFiles/2',
                'Overview.1': '/dataFiles/0',
                'Speed.4': '/dataFiles/3',
                'TechnicalData.5': '/dataFiles/4',
            },
            memberStateCertificate: '/transferResParams/0/data/Control/memberStateCertificateRaw',
            vuCertificate: '/transferResParams/0/data/Control/vuCertificateRaw',
        };
        const rawRoot = {
            dataFiles: [
                { position: 1, trepId: 'Overview' },
                { position: 2, trepId: 'Activities' },
                { position: 3, trepId: 'EventsAndFaults' },
                { position: 4, trepId: 'Speed' },
                { position: 5, trepId: 'TechnicalData' },
            ],
            transferResParams: [
                {
                    data: {
                        Control: {
                            memberStateCertificateRaw: [],
                            vuCertificateRaw: [],
                        },
                    },
                },
            ],
        };
        const raw: VuVerifyResult = {
            result: [
                certItem('MemberStateCertificate', 'Valid'),
                certItem('VuCertificate', 'Valid'),
                recordItem('Overview', 1, 'Valid'),
                recordItem('Activities', 2, 'Valid'),
                recordItem('EventsAndFaults', 3, 'Valid'),
                recordItem('Speed', 4, 'Valid'),
                recordItem('TechnicalData', 5, 'Valid'),
            ],
            status: 'Valid',
        };
        const result = decodeParserVuVerification(raw, 'g2', sourcePaths);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.value.status).toBe('valid');
        expect(result.value.items).toHaveLength(7);
        expect(result.value.items.every((entry) => entry.status === 'valid')).toBe(true);

        for (const item of result.value.items) {
            expect(resolveJsonPointer(rawRoot, item.source.path).ok).toBe(true);
        }
    });

    it('decodes partially valid full VU verification when some records are invalid', () => {
        const sourcePaths = {
            dataFileSourcePaths: {
                'Activities.2': '/dataFiles/1',
                'Overview.1': '/dataFiles/0',
            },
            memberStateCertificate: '/transferResParams/0/data/Control/memberStateCertificateRaw',
            vuCertificate: '/transferResParams/0/data/Control/vuCertificateRaw',
        };
        const raw: VuVerifyResult = {
            result: [
                certItem('MemberStateCertificate', 'Valid'),
                certItem('VuCertificate', 'Valid'),
                recordItem('Overview', 1, 'Valid'),
                recordItem('Activities', 2, 'Invalid'),
            ],
            status: 'PartiallyValid',
        };
        const result = decodeParserVuVerification(raw, 'g1', sourcePaths);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.value.status).toBe('partiallyValid');
        expect(result.value.items.map((entry) => entry.status)).toEqual(['valid', 'valid', 'valid', 'invalid']);
    });

    it('rejects aggregate status mismatch between parser and assessed items', () => {
        const sourcePaths = {
            dataFileSourcePaths: {
                'Overview.1': '/dataFiles/0',
            },
            memberStateCertificate: '/transferResParams/0/data/Control/memberStateCertificateRaw',
            vuCertificate: '/transferResParams/0/data/Control/vuCertificateRaw',
        };
        const raw: VuVerifyResult = {
            result: [certItem('MemberStateCertificate', 'Valid'), recordItem('Overview', 1, 'Invalid')],
            status: 'Valid',
        };
        const result = decodeParserVuVerification(raw, 'g2', sourcePaths);

        expect(result).toEqual({
            error: 'aggregateStatusMismatch',
            ok: false,
        });
    });

    it('rejects invalid JSON pointer sources', () => {
        const sourcePaths = {
            memberStateCertificate: 'not-a-pointer',
            vuCertificate: '/transferResParams/0/data/Control/vuCertificateRaw',
        };
        const raw: VuVerifyResult = {
            result: [certItem('MemberStateCertificate', 'Valid')],
            status: 'Valid',
        };
        const result = decodeParserVuVerification(raw, 'g2', sourcePaths);

        expect(result).toEqual({
            error: 'invalidVerificationSource',
            ok: false,
        });
    });

    it('rejects duplicate verification items', () => {
        const sourcePaths = {
            memberStateCertificate: '/transferResParams/0/data/Control/memberStateCertificateRaw',
            vuCertificate: '/transferResParams/0/data/Control/vuCertificateRaw',
        };
        const raw: VuVerifyResult = {
            result: [certItem('MemberStateCertificate', 'Valid'), certItem('MemberStateCertificate', 'Valid')],
            status: 'Valid',
        };
        const result = decodeParserVuVerification(raw, 'g2', sourcePaths);

        expect(result).toEqual({
            error: 'duplicateVerificationItem',
            ok: false,
        });
    });

    it('rejects Unsigned status as out of bounds for verified documents', () => {
        const sourcePaths = {
            memberStateCertificate: '/transferResParams/0/data/Control/memberStateCertificateRaw',
            vuCertificate: '/transferResParams/0/data/Control/vuCertificateRaw',
        };
        const raw: VuVerifyResult = {
            result: [],
            status: 'Unsigned',
        };
        const result = decodeParserVuVerification(raw, 'g2', sourcePaths);

        expect(result).toEqual({
            error: 'verificationResultOutsideBounds',
            ok: false,
        });
    });
});
