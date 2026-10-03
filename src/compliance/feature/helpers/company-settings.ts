import {
    createStoredValue,
    hasExactKeys,
    isUnknownRecord,
    jsonStoredValueCodec,
    type IKeyValueStore,
    type IStoredValue,
} from '#contracts';

// Persists company details under a versioned key shared by the infringement letter and attestation dialogs.
export interface ICompanySettings {
    readonly address: string;
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
    readonly vatOrRegistration: string;
}

const STORAGE_KEY = 'esm-viewer.compliance.company-details.v1';

const companySettingsFields = [
    'address',
    'city',
    'companyName',
    'country',
    'email',
    'faxNumber',
    'managerName',
    'managerPosition',
    'postalCode',
    'street',
    'telephone',
    'vatOrRegistration',
] as const satisfies readonly (keyof ICompanySettings)[];

function isCompanySettings(value: unknown): value is ICompanySettings {
    return (
        isUnknownRecord(value) &&
        hasExactKeys(value, companySettingsFields) &&
        companySettingsFields.every((field) => typeof value[field] === 'string')
    );
}

function companySettingsValue(store: IKeyValueStore): IStoredValue<ICompanySettings> {
    return createStoredValue(store, STORAGE_KEY, jsonStoredValueCodec(isCompanySettings));
}

export function loadCompanySettings(store: IKeyValueStore): ICompanySettings | null {
    return companySettingsValue(store).load();
}

// Overlays the fields a dialog edits onto the stored record so fields it does not edit survive the save.
export function mergeCompanySettings(stored: ICompanySettings | null, edited: Partial<ICompanySettings>): ICompanySettings {
    return {
        address: '',
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
        vatOrRegistration: '',
        ...stored,
        ...edited,
    };
}

export function saveCompanySettings(store: IKeyValueStore, settings: ICompanySettings): void {
    companySettingsValue(store).save(settings);
}
