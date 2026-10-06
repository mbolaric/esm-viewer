import { describe, expect, it } from 'vitest';

import { classifyParseError, type ParseFailureCode } from '../index.js';

const allCodes: readonly ParseFailureCode[] = [
    'cancelled',
    'certificateChainIncomplete',
    'decoderContractViolation',
    'documentCleanupFailed',
    'ercaKeyMismatch',
    'fileNotFound',
    'fileReadFailed',
    'fileTooLarge',
    'inputTooLarge',
    'internalError',
    'invalidDocumentState',
    'invalidFileName',
    'malformedData',
    'multipleFilesDropped',
    'normalizationFailed',
    'parseFailed',
    'parserNotAvailable',
    'projectionFailed',
    'rootCertificateMissing',
    'unsupportedCertificateProfile',
    'unsupportedContent',
    'unsupportedExtension',
    'unsupportedVerificationGeneration',
    'verificationFailed',
    'verificationUnsupported',
    'parserInitFailed',
    'parserPanic',
];

describe('classifyParseError', () => {
    it('classifies every ParseFailureCode into the expected category', () => {
        const expected: Readonly<Record<ParseFailureCode, string>> = {
            cancelled: 'cancellation',
            certificateChainIncomplete: 'integrityLimitation',
            decoderContractViolation: 'internalDefect',
            documentCleanupFailed: 'platformFailure',
            ercaKeyMismatch: 'integrityLimitation',
            fileNotFound: 'userCorrectable',
            fileReadFailed: 'userCorrectable',
            fileTooLarge: 'userCorrectable',
            inputTooLarge: 'userCorrectable',
            internalError: 'parserFailure',
            invalidDocumentState: 'internalDefect',
            invalidFileName: 'userCorrectable',
            malformedData: 'userCorrectable',
            multipleFilesDropped: 'userCorrectable',
            normalizationFailed: 'internalDefect',
            parseFailed: 'parserFailure',
            parserInitFailed: 'parserFailure',
            parserNotAvailable: 'parserFailure',
            parserPanic: 'parserFailure',
            projectionFailed: 'internalDefect',
            rootCertificateMissing: 'integrityLimitation',
            unsupportedCertificateProfile: 'integrityLimitation',
            unsupportedContent: 'unsupportedData',
            unsupportedExtension: 'userCorrectable',
            unsupportedVerificationGeneration: 'integrityLimitation',
            verificationFailed: 'parserFailure',
            verificationUnsupported: 'integrityLimitation',
        };

        for (const code of allCodes) {
            const error = classifyParseError(code);

            expect(error.category).toBe(expected[code]);
            expect(error.code).toBe(code);
        }
    });

    it('contains only the stable category and code', () => {
        expect(classifyParseError('parseFailed')).toEqual({
            category: 'parserFailure',
            code: 'parseFailed',
        });
    });
});
