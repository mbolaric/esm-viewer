import type { IAttestationCompanyInput, IAttestationFormViewModel } from './attestation-form-view-model.js';

// Structurally matches ICompanySettings to avoid feature-layer imports while preserving address and vatOrRegistration.
export type IAttestationCompanyDraft = IAttestationCompanyInput & {
    readonly address: string;
    readonly vatOrRegistration: string;
};

export interface IAttestationFormDraft {
    readonly company: IAttestationCompanyDraft;
    readonly driverBirthDate: string;
    readonly driverEmploymentDate: string;
    readonly driverLicenceOrId: string;
    readonly driverName: string;
    readonly periodFromFormatted: string;
    readonly periodToFormatted: string;
}

// Structurally matches IDriverAttestationDetails to avoid importing feature-layer types.
export interface IPersistedDriverAttestationDetails {
    readonly birthDate: string;
    readonly employmentDate: string;
}

// Synchronously builds initial editable draft from document prefill and persisted company/driver settings.
export function createInitialAttestationFormDraft(
    model: IAttestationFormViewModel,
    persistedSettings: IAttestationCompanyDraft | null,
    persistedDriverDetails: IPersistedDriverAttestationDetails | null = null,
): IAttestationFormDraft {
    return {
        company: {
            address: persistedSettings?.address ?? '',
            city: persistedSettings?.city ?? model.companyCity,
            companyName: persistedSettings?.companyName ?? model.companyName,
            country: persistedSettings?.country ?? model.companyCountry,
            email: persistedSettings?.email ?? model.companyEmail,
            faxNumber: persistedSettings?.faxNumber ?? model.companyFax,
            managerName: persistedSettings?.managerName ?? model.managerName,
            managerPosition: persistedSettings?.managerPosition ?? model.managerPosition,
            postalCode: persistedSettings?.postalCode ?? model.companyPostalCode,
            street: persistedSettings?.street ?? model.companyStreet,
            telephone: persistedSettings?.telephone ?? model.companyTelephone,
            vatOrRegistration: persistedSettings?.vatOrRegistration ?? '',
        },
        driverBirthDate: persistedDriverDetails?.birthDate ?? model.driverBirthDate,
        driverEmploymentDate: persistedDriverDetails?.employmentDate ?? model.driverEmploymentDate,
        driverLicenceOrId: model.driverLicenceOrId,
        driverName: model.driverName,
        periodFromFormatted: model.periodFromFormatted,
        periodToFormatted: model.periodToFormatted,
    };
}

// Fields the attestation needs before it can be printed or exported. Fax and e-mail (boxes 4 and 5) are optional.
export type AttestationRequiredField =
    | 'city'
    | 'companyName'
    | 'country'
    | 'driverBirthDate'
    | 'driverEmploymentDate'
    | 'driverLicenceOrId'
    | 'driverName'
    | 'managerName'
    | 'managerPosition'
    | 'periodFrom'
    | 'periodTo'
    | 'postalCode'
    | 'street'
    | 'telephone';

const requiredFieldValues: Readonly<Record<AttestationRequiredField, (draft: IAttestationFormDraft) => string>> = {
    city: (draft) => draft.company.city,
    companyName: (draft) => draft.company.companyName,
    country: (draft) => draft.company.country,
    driverBirthDate: (draft) => draft.driverBirthDate,
    driverEmploymentDate: (draft) => draft.driverEmploymentDate,
    driverLicenceOrId: (draft) => draft.driverLicenceOrId,
    driverName: (draft) => draft.driverName,
    managerName: (draft) => draft.company.managerName,
    managerPosition: (draft) => draft.company.managerPosition,
    periodFrom: (draft) => draft.periodFromFormatted,
    periodTo: (draft) => draft.periodToFormatted,
    postalCode: (draft) => draft.company.postalCode,
    street: (draft) => draft.company.street,
    telephone: (draft) => draft.company.telephone,
};

// Required fields in the order the dialog shows them, so a list of missing fields reads top to bottom.
export const ATTESTATION_REQUIRED_FIELDS: readonly AttestationRequiredField[] = [
    'companyName',
    'street',
    'postalCode',
    'city',
    'country',
    'telephone',
    'managerName',
    'managerPosition',
    'driverName',
    'driverBirthDate',
    'driverLicenceOrId',
    'driverEmploymentDate',
    'periodFrom',
    'periodTo',
];

export function missingAttestationFormFields(draft: IAttestationFormDraft): readonly AttestationRequiredField[] {
    return ATTESTATION_REQUIRED_FIELDS.filter((field) => requiredFieldValues[field](draft).trim().length === 0);
}

// Validates that all mandatory EU attestation form fields are populated before export or print.
export function isAttestationFormDraftComplete(draft: IAttestationFormDraft): boolean {
    return missingAttestationFormFields(draft).length === 0;
}

// Merges user draft edits into the base attestation view model for print or export.
export function createAttestationExportModel(
    model: IAttestationFormViewModel,
    draft: IAttestationFormDraft,
): IAttestationFormViewModel {
    return {
        ...model,
        companyCity: draft.company.city,
        companyCountry: draft.company.country,
        companyEmail: draft.company.email,
        companyFax: draft.company.faxNumber,
        companyName: draft.company.companyName,
        companyPostalCode: draft.company.postalCode,
        companyStreet: draft.company.street,
        companyTelephone: draft.company.telephone,
        driverBirthDate: draft.driverBirthDate,
        driverEmploymentDate: draft.driverEmploymentDate,
        driverLicenceOrId: draft.driverLicenceOrId,
        driverName: draft.driverName,
        managerName: draft.company.managerName,
        managerPosition: draft.company.managerPosition,
        periodFromFormatted: draft.periodFromFormatted,
        periodToFormatted: draft.periodToFormatted,
    };
}
