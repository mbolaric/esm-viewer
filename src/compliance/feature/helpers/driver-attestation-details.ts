import { createStoredValue, hasExactKeys, isUnknownRecord, jsonStoredValueCodec, type IKeyValueStore } from '#contracts';

// Persists driver birthDate and employmentDate per card number.
export interface IDriverAttestationDetails {
    readonly birthDate: string;
    readonly employmentDate: string;
}

const STORAGE_KEY_PREFIX = 'esm-viewer.compliance.driver-attestation-details.v1.';

const driverAttestationDetailsFields = [
    'birthDate',
    'employmentDate',
] as const satisfies readonly (keyof IDriverAttestationDetails)[];

function isDriverAttestationDetails(value: unknown): value is IDriverAttestationDetails {
    return (
        isUnknownRecord(value) &&
        hasExactKeys(value, driverAttestationDetailsFields) &&
        driverAttestationDetailsFields.every((field) => typeof value[field] === 'string')
    );
}

const driverAttestationDetailsCodec = jsonStoredValueCodec(isDriverAttestationDetails);

export function loadDriverAttestationDetails(store: IKeyValueStore, cardNumber: string): IDriverAttestationDetails | null {
    return createStoredValue(store, `${STORAGE_KEY_PREFIX}${cardNumber}`, driverAttestationDetailsCodec).load();
}

export function saveDriverAttestationDetails(
    store: IKeyValueStore,
    cardNumber: string,
    details: IDriverAttestationDetails,
): void {
    createStoredValue(store, `${STORAGE_KEY_PREFIX}${cardNumber}`, driverAttestationDetailsCodec).save(details);
}
