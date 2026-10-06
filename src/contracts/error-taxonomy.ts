// Typed error taxonomy separating failure categories for application handling.

export type ParseErrorCategory =
    | 'cancellation'
    | 'integrityLimitation'
    | 'internalDefect'
    | 'parserFailure'
    | 'platformFailure'
    | 'unsupportedData'
    | 'userCorrectable';

export type ParseFailureCode =
    | 'cancelled'
    | 'certificateChainIncomplete'
    | 'decoderContractViolation'
    | 'documentCleanupFailed'
    | 'ercaKeyMismatch'
    | 'fileNotFound'
    | 'fileReadFailed'
    | 'fileTooLarge'
    | 'inputTooLarge'
    | 'internalError'
    | 'invalidDocumentState'
    | 'invalidFileName'
    | 'malformedData'
    | 'multipleFilesDropped'
    | 'normalizationFailed'
    | 'parseFailed'
    | 'parserNotAvailable'
    | 'projectionFailed'
    | 'rootCertificateMissing'
    | 'unsupportedCertificateProfile'
    | 'unsupportedContent'
    | 'unsupportedExtension'
    | 'unsupportedVerificationGeneration'
    | 'verificationFailed'
    | 'verificationUnsupported'
    | 'parserInitFailed'
    | 'parserPanic';

interface IBaseParseFailure {
    readonly category: ParseErrorCategory;
    readonly code: ParseFailureCode;
}

export interface ICancellationError extends IBaseParseFailure {
    readonly category: 'cancellation';
    readonly code: 'cancelled';
}

export interface IUserCorrectableError extends IBaseParseFailure {
    readonly category: 'userCorrectable';
    readonly code:
        | 'fileNotFound'
        | 'fileReadFailed'
        | 'fileTooLarge'
        | 'inputTooLarge'
        | 'invalidFileName'
        | 'malformedData'
        | 'multipleFilesDropped'
        | 'unsupportedExtension';
}

export interface IUnsupportedDataError extends IBaseParseFailure {
    readonly category: 'unsupportedData';
    readonly code: 'unsupportedContent';
}

export interface IParserFailureError extends IBaseParseFailure {
    readonly category: 'parserFailure';
    readonly code:
        'internalError' | 'parseFailed' | 'parserInitFailed' | 'parserNotAvailable' | 'parserPanic' | 'verificationFailed';
}

export interface IIntegrityLimitationError extends IBaseParseFailure {
    readonly category: 'integrityLimitation';
    readonly code:
        | 'certificateChainIncomplete'
        | 'ercaKeyMismatch'
        | 'rootCertificateMissing'
        | 'unsupportedCertificateProfile'
        | 'unsupportedVerificationGeneration'
        | 'verificationUnsupported';
}

export interface IPlatformFailureError extends IBaseParseFailure {
    readonly category: 'platformFailure';
    readonly code: 'documentCleanupFailed';
}

export interface IInternalDefectError extends IBaseParseFailure {
    readonly category: 'internalDefect';
    readonly code: 'decoderContractViolation' | 'invalidDocumentState' | 'normalizationFailed' | 'projectionFailed';
}

export type ParseError =
    | ICancellationError
    | IIntegrityLimitationError
    | IInternalDefectError
    | IParserFailureError
    | IPlatformFailureError
    | IUnsupportedDataError
    | IUserCorrectableError;

export function classifyParseError(code: ParseFailureCode): ParseError {
    switch (code) {
        case 'cancelled':
            return {
                category: 'cancellation' as const,
                code,
            };

        case 'fileNotFound':
        case 'fileReadFailed':
        case 'fileTooLarge':
        case 'inputTooLarge':
        case 'invalidFileName':
        case 'malformedData':
        case 'multipleFilesDropped':
        case 'unsupportedExtension':
            return {
                category: 'userCorrectable' as const,
                code,
            };

        case 'unsupportedContent':
            return {
                category: 'unsupportedData' as const,
                code,
            };

        case 'internalError':
        case 'parseFailed':
        case 'parserInitFailed':
        case 'parserNotAvailable':
        case 'parserPanic':
        case 'verificationFailed':
            return {
                category: 'parserFailure' as const,
                code,
            };

        case 'certificateChainIncomplete':
        case 'ercaKeyMismatch':
        case 'rootCertificateMissing':
        case 'unsupportedCertificateProfile':
        case 'unsupportedVerificationGeneration':
        case 'verificationUnsupported':
            return {
                category: 'integrityLimitation' as const,
                code,
            };

        case 'documentCleanupFailed':
            return {
                category: 'platformFailure' as const,
                code,
            };

        case 'decoderContractViolation':
        case 'invalidDocumentState':
        case 'normalizationFailed':
        case 'projectionFailed':
            return {
                category: 'internalDefect' as const,
                code,
            };
    }
}
