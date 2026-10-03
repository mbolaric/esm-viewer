import {
    createDriverIdentity,
    createRecordedActivityInterval,
    createSourceReference,
    createVehicleIdentity,
    isCardNumber,
    isIdentityName,
    isIssuingMemberState,
    isJsonPointer,
    isUtcTimestamp,
    isVehicleIdentificationNumber,
    isVehicleRegistrationNumber,
    type ActivityInterval,
    type ActivityKind,
    type CardNumber,
    type IActivityCrewContext,
    type IdentityName,
    type IDriverIdentity,
    type IDriverIdentityInput,
    type ISourceReference,
    type IssuingMemberState,
    type IVehicleIdentity,
    type IVehicleIdentityInput,
    type JsonPointer,
    type TachographGeneration,
    type UtcTimestamp,
    type VehicleIdentificationNumber,
    type VehicleRegistrationNumber,
} from '#viewer-domain';

// Synthetic domain fixture factories for tests.

export function fixtureUtcTimestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError(`Fixture timestamp ${String(value)} is not a valid UTC epoch-millisecond value.`);
    }

    return value;
}

export function fixtureJsonPointer(pathValue: string): JsonPointer {
    if (!isJsonPointer(pathValue)) {
        throw new TypeError(`Fixture path "${pathValue}" is not a canonical JSON Pointer.`);
    }

    return pathValue;
}

export function fixtureCardNumber(value: string): CardNumber {
    if (!isCardNumber(value)) {
        throw new TypeError(`Fixture card number "${value}" is not normalized.`);
    }

    return value;
}

export function fixtureIdentityName(value: string): IdentityName {
    if (!isIdentityName(value)) {
        throw new TypeError(`Fixture identity name "${value}" is not normalized.`);
    }

    return value;
}

export function fixtureIssuingMemberState(value: string): IssuingMemberState {
    if (!isIssuingMemberState(value)) {
        throw new TypeError(`Fixture issuing member state "${value}" is not normalized.`);
    }

    return value;
}

export function fixtureVehicleIdentificationNumber(value: string): VehicleIdentificationNumber {
    if (!isVehicleIdentificationNumber(value)) {
        throw new TypeError(`Fixture VIN "${value}" is not normalized.`);
    }

    return value;
}

export function fixtureVehicleRegistrationNumber(value: string): VehicleRegistrationNumber {
    if (!isVehicleRegistrationNumber(value)) {
        throw new TypeError(`Fixture registration number "${value}" is not normalized.`);
    }

    return value;
}

export function fixtureSourceReference<TDocumentKind extends 'driverCard' | 'vehicleUnit'>(
    documentKind: TDocumentKind,
    generation: TachographGeneration,
    pathValue: string,
): ISourceReference<TachographGeneration, TDocumentKind> {
    return createSourceReference(documentKind, generation, fixtureJsonPointer(pathValue));
}

// A single driver in the driver slot, the context of most activity fixtures.
export const fixtureSingleDriverCrew: IActivityCrewContext = { crewPresence: 'single', slot: 'Driver' };

export function fixtureActivityInterval(activity: ActivityKind, start: number, end: number, pathValue: string): ActivityInterval {
    const interval = createRecordedActivityInterval(
        activity,
        fixtureUtcTimestamp(start),
        fixtureUtcTimestamp(end),
        fixtureSourceReference('driverCard', 'g2', pathValue),
        fixtureSingleDriverCrew,
    );

    if (interval === null) {
        throw new TypeError(
            `Fixture activity interval [${String(start)}, ${String(end)}] must have increasing boundaries and a known activity kind.`,
        );
    }

    return interval;
}

function useOverride<T>(override: T | undefined, fallback: T): T {
    if (override === undefined) {
        return fallback;
    }

    return override;
}

export function fixtureDriverIdentity(overrides?: Partial<IDriverIdentityInput>): IDriverIdentity {
    if (overrides === undefined) {
        return createDriverIdentity({
            cardExpiryDate: fixtureUtcTimestamp(1_894_771_200_000),
            cardHolderBirthDate: fixtureUtcTimestamp(631_152_000_000),
            cardIssueDate: fixtureUtcTimestamp(1_515_264_000_000),
            cardValidityBegin: fixtureUtcTimestamp(1_515_264_000_000),
            cardIssuingAuthorityName: 'Synthetic Authority',
            cardNumber: fixtureCardNumber('SYNTHETICCARD001'),
            firstNames: fixtureIdentityName('Synthetic'),
            issuingMemberState: fixtureIssuingMemberState('D'),
            source: fixtureSourceReference('driverCard', 'g2', '/driverCard/g2/identification'),
            surname: fixtureIdentityName('Driver'),
        });
    }

    return createDriverIdentity({
        cardExpiryDate: useOverride(overrides.cardExpiryDate, fixtureUtcTimestamp(1_894_771_200_000)),
        cardHolderBirthDate: useOverride(overrides.cardHolderBirthDate, fixtureUtcTimestamp(631_152_000_000)),
        cardIssueDate: useOverride(overrides.cardIssueDate, fixtureUtcTimestamp(1_515_264_000_000)),
        cardValidityBegin: useOverride(overrides.cardValidityBegin, fixtureUtcTimestamp(1_515_264_000_000)),
        cardIssuingAuthorityName: useOverride(overrides.cardIssuingAuthorityName, 'Synthetic Authority'),
        cardNumber: useOverride(overrides.cardNumber, fixtureCardNumber('SYNTHETICCARD001')),
        firstNames: useOverride(overrides.firstNames, fixtureIdentityName('Synthetic')),
        issuingMemberState: useOverride(overrides.issuingMemberState, fixtureIssuingMemberState('D')),
        source: useOverride(overrides.source, fixtureSourceReference('driverCard', 'g2', '/driverCard/g2/identification')),
        surname: useOverride(overrides.surname, fixtureIdentityName('Driver')),
    });
}

export function fixtureVehicleIdentity(overrides?: Partial<IVehicleIdentityInput>): IVehicleIdentity {
    if (overrides === undefined) {
        const identity = createVehicleIdentity({
            registrationMemberState: fixtureIssuingMemberState('D'),
            registrationNumber: fixtureVehicleRegistrationNumber('TEST-000'),
            source: fixtureSourceReference('vehicleUnit', 'g2', '/vehicleUnit/g2/overview'),
            vehicleIdentificationNumber: fixtureVehicleIdentificationNumber('SYNTHETICVIN00001'),
        });

        if (identity === null) {
            throw new TypeError('Fixture vehicle identity must have at least one identifier.');
        }

        return identity;
    }

    const identity = createVehicleIdentity({
        registrationMemberState: useOverride(overrides.registrationMemberState, fixtureIssuingMemberState('D')),
        registrationNumber: useOverride(overrides.registrationNumber, fixtureVehicleRegistrationNumber('TEST-000')),
        source: useOverride(overrides.source, fixtureSourceReference('vehicleUnit', 'g2', '/vehicleUnit/g2/overview')),
        vehicleIdentificationNumber: useOverride(
            overrides.vehicleIdentificationNumber,
            fixtureVehicleIdentificationNumber('SYNTHETICVIN00001'),
        ),
    });

    if (identity === null) {
        throw new TypeError('Fixture vehicle identity must have at least one identifier.');
    }

    return identity;
}
