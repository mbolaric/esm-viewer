import type { ILocalisationService } from '#localization';
import { MILLISECONDS_PER_DAY } from '#time';
import type { OpenedTachographDocument } from '#viewer-application';
import { isUtcTimestamp, type DurationMilliseconds, type UtcTimestamp } from '#tachograph-domain';

type ViewerLocalisationService = ILocalisationService<UtcTimestamp, DurationMilliseconds>;

export type AttestationReason =
    | 'annualLeave' // Box 15
    | 'available' // Box 19
    | 'leaveOrRest' // Box 16
    | 'otherWork' // Box 18
    | 'outOfScope' // Box 17
    | 'sickLeave'; // Box 14

export interface IAttestationCompanyInput {
    readonly city: string;
    readonly companyName: string;
    readonly country: string;
    readonly email: string;
    readonly faxNumber: string;
    readonly managerName: string;
    readonly managerPosition: string;
    readonly postalCode: string;
    readonly street: string;
    readonly telephone: string;
}

export interface IAttestationFormViewModel {
    readonly box14_sickLeave: boolean;
    readonly box15_annualLeave: boolean;
    readonly box16_leaveOrRest: boolean;
    readonly box17_outOfScope: boolean;
    readonly box18_otherWork: boolean;
    readonly box19_available: boolean;
    readonly companyCity: string;
    readonly companyCountry: string;
    readonly companyEmail: string;
    readonly companyFax: string;
    readonly companyName: string;
    readonly companyPostalCode: string;
    readonly companyStreet: string;
    readonly companyTelephone: string;
    readonly dateFormatted: string;
    readonly driverBirthDate: string;
    readonly driverCardNumber: string;
    readonly driverEmploymentDate: string;
    readonly driverLicenceOrId: string;
    readonly driverName: string;
    readonly generatedAt: string;
    readonly managerName: string;
    readonly managerPosition: string;
    readonly periodFromFormatted: string;
    readonly periodToFormatted: string;
    readonly reason: AttestationReason;
}

// Initial company details default to empty strings; user input is required for legal validity.
export const DEFAULT_ATTESTATION_COMPANY: IAttestationCompanyInput = {
    city: '',
    companyName: '',
    country: '',
    email: '',
    faxNumber: '',
    managerName: '',
    managerPosition: '',
    postalCode: '',
    street: '',
    telephone: '',
};

// Placeholder when the document contains no driver card identity.
export const UNKNOWN_DRIVER_CARD_NUMBER = '—';

// Checks if cardNumber identifies a known driver card rather than the unknown placeholder.
export function isKnownDriverCardNumber(cardNumber: string): boolean {
    return cardNumber.length > 0 && cardNumber !== UNKNOWN_DRIVER_CARD_NUMBER;
}

interface IUnrecordedActivitySpan {
    readonly end: UtcTimestamp;
    readonly start: UtcTimestamp;
}

// Prefills the attestation period with the most recent unrecorded activity-day gap or trailing gap up to now.
function findUnrecordedActivitySpan(
    document: OpenedTachographDocument,
    generatedAtUtc: UtcTimestamp,
): IUnrecordedActivitySpan | null {
    if (document.content.documentKind !== 'driverCard') {
        return null;
    }

    const midnights = new Set<number>();
    for (const application of document.content.applications) {
        for (const day of application.activityDays) {
            midnights.add(day.midnightUtc);
        }
    }
    if (midnights.size === 0) {
        return null;
    }
    const sortedMidnights = [...midnights].sort((a, b) => a - b);

    const candidates: { end: number; start: number }[] = [];
    for (let index = 1; index < sortedMidnights.length; index++) {
        const previous = sortedMidnights[index - 1];
        const current = sortedMidnights[index];
        if (previous !== undefined && current !== undefined && current - previous > MILLISECONDS_PER_DAY) {
            candidates.push({ end: current, start: previous + MILLISECONDS_PER_DAY });
        }
    }

    const lastMidnight = sortedMidnights[sortedMidnights.length - 1];
    if (lastMidnight !== undefined && generatedAtUtc - (lastMidnight + MILLISECONDS_PER_DAY) > 0) {
        candidates.push({ end: generatedAtUtc, start: lastMidnight + MILLISECONDS_PER_DAY });
    }

    if (candidates.length === 0) {
        return null;
    }

    const mostRecent = candidates.reduce((latest, candidate) => (candidate.start > latest.start ? candidate : latest));

    return isUtcTimestamp(mostRecent.start) && isUtcTimestamp(mostRecent.end)
        ? { end: mostRecent.end, start: mostRecent.start }
        : null;
}

export function createAttestationFormViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
    options?: {
        readonly company?: Partial<IAttestationCompanyInput>;
        readonly periodFrom?: UtcTimestamp;
        readonly periodTo?: UtcTimestamp;
        readonly reason?: AttestationReason;
    },
): IAttestationFormViewModel {
    let driverName = 'Driver';
    let driverCardNumber = UNKNOWN_DRIVER_CARD_NUMBER;
    let driverLicenceOrId = '';
    // Tachograph data does not record driver birth date; initialized blank for manual entry.
    const driverBirthDate = '';

    if (document.content.documentKind === 'driverCard') {
        const app = document.content.applications[0];
        if (app !== undefined) {
            if (app.identity !== null) {
                const driverIdentity = app.identity;
                driverName = `${driverIdentity.surname ?? ''} ${driverIdentity.firstNames ?? ''}`.trim() || 'Driver';
                driverCardNumber = driverIdentity.cardNumber;
                driverLicenceOrId = driverIdentity.cardNumber;
            }
            const dlRecord = app.technicalRecords.find((r) => r.kind === 'drivingLicenceTechnicalData');
            if (dlRecord !== undefined && dlRecord.licenceNumber.length > 0) {
                driverLicenceOrId = dlRecord.licenceNumber;
            }
        }
    }

    const company: IAttestationCompanyInput = {
        city: options?.company?.city ?? DEFAULT_ATTESTATION_COMPANY.city,
        country: options?.company?.country ?? DEFAULT_ATTESTATION_COMPANY.country,
        email: options?.company?.email ?? DEFAULT_ATTESTATION_COMPANY.email,
        faxNumber: options?.company?.faxNumber ?? DEFAULT_ATTESTATION_COMPANY.faxNumber,
        managerName: options?.company?.managerName ?? DEFAULT_ATTESTATION_COMPANY.managerName,
        managerPosition: options?.company?.managerPosition ?? DEFAULT_ATTESTATION_COMPANY.managerPosition,
        companyName: options?.company?.companyName ?? DEFAULT_ATTESTATION_COMPANY.companyName,
        postalCode: options?.company?.postalCode ?? DEFAULT_ATTESTATION_COMPANY.postalCode,
        street: options?.company?.street ?? DEFAULT_ATTESTATION_COMPANY.street,
        telephone: options?.company?.telephone ?? DEFAULT_ATTESTATION_COMPANY.telephone,
    };

    const now = Date.now();
    const generatedAtUtc = isUtcTimestamp(now) ? now : document.source.openedAt;
    const generatedAt = localisation.formatDateTime(generatedAtUtc);
    // Signature date reflects the user's display time zone rather than UTC card timestamps.
    const dateFormatted = localisation.formatDate(generatedAtUtc);

    const unrecordedSpan = findUnrecordedActivitySpan(document, generatedAtUtc);
    const fromTs = options?.periodFrom ?? unrecordedSpan?.start ?? generatedAtUtc;
    const toTs = options?.periodTo ?? unrecordedSpan?.end ?? generatedAtUtc;

    const periodFromFormatted = localisation.formatDateTime(fromTs);
    const periodToFormatted = localisation.formatDateTime(toTs);

    const selectedReason: AttestationReason = options?.reason ?? 'leaveOrRest';

    return {
        box14_sickLeave: selectedReason === 'sickLeave',
        box15_annualLeave: selectedReason === 'annualLeave',
        box16_leaveOrRest: selectedReason === 'leaveOrRest',
        box17_outOfScope: selectedReason === 'outOfScope',
        box18_otherWork: selectedReason === 'otherWork',
        box19_available: selectedReason === 'available',
        companyCity: company.city,
        companyCountry: company.country,
        companyEmail: company.email,
        companyFax: company.faxNumber,
        companyName: company.companyName,
        companyPostalCode: company.postalCode,
        companyStreet: company.street,
        companyTelephone: company.telephone,
        dateFormatted,
        driverBirthDate,
        driverCardNumber,
        // Driver employment start date is not tachograph data; initialized blank for operator entry.
        driverEmploymentDate: '',
        driverLicenceOrId,
        driverName,
        generatedAt,
        managerName: company.managerName,
        managerPosition: company.managerPosition,
        periodFromFormatted,
        periodToFormatted,
        reason: selectedReason,
    };
}
