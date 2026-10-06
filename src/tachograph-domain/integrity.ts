import type { ISourceReference } from './source-reference.js';
import type { TachographGeneration } from './tachograph.js';

export type VerificationGeneration = Extract<TachographGeneration, 'g1' | 'g2'>;
export type IntegrityItemStatus = 'valid' | 'invalid';
export type IntegrityNotCheckedReason = 'missingRootCertificate' | 'notRequested';
export type IntegrityFailureCode =
    | 'certificateChainIncomplete'
    | 'decoderContractViolation'
    | 'ercaKeyMismatch'
    | 'internalError'
    | 'invalidVerificationResult'
    | 'malformedData'
    | 'normalizationFailed'
    | 'parseFailed'
    | 'parserNotAvailable'
    | 'rootCertificateMissing'
    | 'unsupportedCertificateProfile'
    | 'unsupportedContent'
    | 'unsupportedVerificationGeneration'
    | 'verificationFailed'
    | 'verificationUnsupported'
    | 'parserInitFailed'
    | 'parserPanic';
export type VerificationLimitation =
    'missingVehicleUnitOverview' | 'unsupportedCardApplication' | 'unsupportedCertificateChain' | 'unsupportedCertificateProfile';
export type IntegrityChainStatus = 'valid' | 'partiallyValid' | 'invalid';

export interface IIntegrityItem {
    readonly generation: VerificationGeneration;
    readonly recordId: string;
    readonly source: ISourceReference<VerificationGeneration, 'driverCard' | 'vehicleUnit'>;
    readonly status: IntegrityItemStatus;
}

export type IntegrityItem = IIntegrityItem;

export interface IIntegrityNotChecked {
    readonly reason: IntegrityNotCheckedReason;
    readonly status: 'notChecked';
}

export interface IIntegrityValid {
    readonly items: readonly IntegrityItem[];
    readonly status: 'valid';
}

export interface IIntegrityPartiallyValid {
    readonly items: readonly IntegrityItem[];
    readonly status: 'partiallyValid';
}

export interface IIntegrityInvalid {
    readonly items: readonly IntegrityItem[];
    readonly status: 'invalid';
}

export interface IIntegrityUnsupported {
    readonly reason: VerificationLimitation;
    readonly status: 'unsupported';
}

export interface IIntegrityFailed {
    readonly code: IntegrityFailureCode;
    readonly status: 'failed';
}

// Equipment certificate chain was verified; does not verify recorded data itself.
export interface IIntegrityChainVerified {
    readonly chainStatus: IntegrityChainStatus;
    readonly items: readonly IntegrityItem[];
    readonly status: 'chainVerified';
}

export type VerifiedIntegrityAssessment = IIntegrityValid | IIntegrityPartiallyValid | IIntegrityInvalid;

export type IntegrityAssessment =
    IIntegrityNotChecked | VerifiedIntegrityAssessment | IIntegrityChainVerified | IIntegrityUnsupported | IIntegrityFailed;

export function classifyIntegrityItems(items: readonly IntegrityItem[]): VerifiedIntegrityAssessment | null {
    if (items.length === 0) {
        return null;
    }

    const itemSnapshot = [...items];
    const hasValidItem = itemSnapshot.some((item) => item.status === 'valid');
    const hasInvalidItem = itemSnapshot.some((item) => item.status === 'invalid');

    if (hasValidItem && hasInvalidItem) {
        return {
            items: itemSnapshot,
            status: 'partiallyValid',
        };
    }

    return {
        items: itemSnapshot,
        status: hasValidItem ? 'valid' : 'invalid',
    };
}

export function classifyChainVerifiedItems(items: readonly IntegrityItem[]): IIntegrityChainVerified | null {
    const verified = classifyIntegrityItems(items);
    if (verified === null) {
        return null;
    }

    return {
        chainStatus: verified.status,
        items: verified.items,
        status: 'chainVerified',
    };
}
