import { describe, expect, it } from 'vitest';
import { decodeFileMetadata } from '#contracts';
import {
    createDriverIdentity,
    createRecordedActivityInterval,
    createSourceReference,
    isDurationMilliseconds,
    isUtcTimestamp,
    type DurationMilliseconds,
    type IActivityDay,
    type ISourceReference,
    type IVehicleUse,
    type TachographGeneration,
    type UtcTimestamp,
} from '#tachograph-domain';
import { createOpenedTachographDocument, type IDriverCardApplication } from '#viewer-application';
import { createComplianceViewModel, type IComplianceTranslationService } from '../compliance-view-model.js';
import { EU_561_2006_STANDARD } from '../../domain/rule-profile.js';
import {
    createLocalisationServiceFake,
    fixtureCardNumber,
    fixtureIdentityName,
    fixtureIssuingMemberState,
    fixtureJsonPointer,
    fixtureSingleDriverCrew,
    fixtureVehicleIdentificationNumber,
    fixtureVehicleRegistrationNumber,
} from '#testing';
import { createInfringementLetterViewModel, DEFAULT_COMPANY_DETAILS } from '../infringement-letter-view-model.js';

function utc(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError(`Fixture timestamp ${String(value)} is not a valid UTC epoch value.`);
    }
    return value;
}

function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError(`Fixture duration ${String(value)} is not a valid duration.`);
    }
    return value;
}

function cardSource(generation: TachographGeneration, path: string): ISourceReference<TachographGeneration, 'driverCard'> {
    return createSourceReference('driverCard', generation, fixtureJsonPointer(path));
}

function createDummyDriverCardDoc(vehicleUses: readonly IVehicleUse[] = []): ReturnType<typeof createOpenedTachographDocument> {
    const metadata = decodeFileMetadata({
        byteLength: 2048,
        displayName: 'driver_test.ddd',
        sha256: 'a'.repeat(64),
    });
    if (!metadata.ok) {
        throw new TypeError('The compliance fixture metadata must be valid.');
    }

    const driverIdentity = createDriverIdentity({
        cardExpiryDate: utc(Date.UTC(2028, 5, 30)),
        cardHolderBirthDate: null,
        cardIssueDate: utc(Date.UTC(2023, 5, 1)),
        cardIssuingAuthorityName: 'Kraftfahrt-Bundesamt',
        cardNumber: fixtureCardNumber('D000009876543001'),
        cardValidityBegin: utc(Date.UTC(2023, 5, 1)),
        firstNames: fixtureIdentityName('Erika'),
        issuingMemberState: fixtureIssuingMemberState('FR'),
        source: cardSource('g2', '/cardIdentification'),
        surname: fixtureIdentityName('Mustermann'),
    });

    const midnightUtc = utc(Date.UTC(2026, 6, 27));
    const drivingInterval = createRecordedActivityInterval(
        'driving',
        utc(midnightUtc + 6 * 3_600_000),
        utc(midnightUtc + 11 * 3_600_000), // 5 hours continuous driving -> infringement
        cardSource('g2', '/driverActivityData/0/0'),
        fixtureSingleDriverCrew,
    );
    if (drivingInterval === null) {
        throw new TypeError('Interval fixture failed');
    }

    const day: IActivityDay = {
        intervals: [drivingInterval],
        midnightUtc,
        totals: {
            availability: duration(0),
            breakOrRest: duration(0),
            driving: duration(5 * 3_600_000),
            unknown: duration(0),
            work: duration(0),
        },
    };

    const app: IDriverCardApplication = {
        activityDays: [day],
        cardNotes: null,
        events: [],
        faults: [],
        generation: 'g2',
        identity: driverIdentity,
        locations: [],
        source: cardSource('g2', '/cardIdentification'),
        technicalRecords: [],
        vehicleUnitUses: [],
        vehicleUses,
        verification: {
            dataFileSourcePaths: {},
            dataFiles: {},
            generation: 'g2',
        },
        warnings: [],
    };

    return createOpenedTachographDocument(
        {
            ...metadata.value,
            openedAt: utc(Date.UTC(2026, 7, 25)),
            reopenToken: null,
            sourceToken: null,
        },
        {
            applications: [app],
            cardType: 'driverCard',
            documentKind: 'driverCard',
            generation: 'g2',
            parserVariant: 'cardGen2',
            rawTree: {},
            sections: [],
        },
    );
}

const translationServiceFake: IComplianceTranslationService = {
    translate: (key: string, params?: unknown): string => {
        if (typeof params === 'object' && params !== null) {
            return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), key);
        }
        return key;
    },
};

describe('Infringement Letter View Model', () => {
    it('creates structured letter model with driver, company, and detected infringements', () => {
        const doc = createDummyDriverCardDoc();
        const compliance = createComplianceViewModel(doc, translationServiceFake, EU_561_2006_STANDARD);
        const localisation = createLocalisationServiceFake();

        const letter = createInfringementLetterViewModel(doc, compliance, localisation);

        expect(letter.driverName).toBe('Mustermann Erika');
        expect(letter.cardNumber).toBe('D000009876543001');
        expect(letter.issuingMemberState).toBe('FR');
        // Company details are never fabricated: the prefill stays empty until
        // the user enters them in the dialog.
        expect(letter.company.companyName).toBe(DEFAULT_COMPANY_DETAILS.companyName);
        expect(letter.company.companyName).toBe('');
        expect(letter.totalInfringements).toBeGreaterThan(0);
        expect(letter.items.length).toBe(letter.totalInfringements);

        const firstItem = letter.items[0];
        expect(firstItem).toBeDefined();
        expect(firstItem?.allowedValue).toBeDefined();
        expect(firstItem?.measuredValue).toBeDefined();
        expect(firstItem?.excess).toBeDefined();
    });

    it('derives letter counts from the filtered view model, not the unfiltered document summary (REPORT-02)', () => {
        const doc = createDummyDriverCardDoc();
        const localisation = createLocalisationServiceFake();

        // Sanity check: the fixture document really does have a finding
        // ('break' category) that the filter below is going to hide - this
        // is not a document with zero findings to begin with.
        const unfilteredCompliance = createComplianceViewModel(doc, translationServiceFake, EU_561_2006_STANDARD);
        expect(unfilteredCompliance.summary.totalInfringements).toBeGreaterThan(0);

        const filteredCompliance = createComplianceViewModel(doc, translationServiceFake, EU_561_2006_STANDARD, 'dailyRest');

        const letter = createInfringementLetterViewModel(doc, filteredCompliance, localisation);

        // The letter's own counts must agree with the rows it actually
        // lists, not with the document's unfiltered totals.
        expect(letter.items).toHaveLength(0);
        expect(letter.totalInfringements).toBe(0);
        expect(letter.minorCount).toBe(0);
        expect(letter.seriousCount).toBe(0);
        expect(letter.verySeriousCount).toBe(0);
    });

    it('applies custom company details override when provided', () => {
        const doc = createDummyDriverCardDoc();
        const compliance = createComplianceViewModel(doc, translationServiceFake, EU_561_2006_STANDARD);
        const localisation = createLocalisationServiceFake();

        const letter = createInfringementLetterViewModel(doc, compliance, localisation, {
            companyName: 'Acme Fleet Logistics GmbH',
            managerName: 'Klaus Meier',
        });

        expect(letter.company.companyName).toBe('Acme Fleet Logistics GmbH');
        expect(letter.company.managerName).toBe('Klaus Meier');
        expect(letter.company.address).toBe(DEFAULT_COMPANY_DETAILS.address);
        expect(letter.company.address).toBe('');
    });

    it('extracts vehicle registration and VIN from driver card vehicleUses', () => {
        const vehicleUse: IVehicleUse = {
            firstUse: utc(Date.UTC(2026, 6, 27, 8, 0)),
            kind: 'vehicleUse',
            lastUse: utc(Date.UTC(2026, 6, 27, 17, 0)),
            odometerBegin: null,
            odometerEnd: null,
            registrationMemberState: fixtureIssuingMemberState('DE'),
            registrationNumber: fixtureVehicleRegistrationNumber('B-TR 4567'),
            source: cardSource('g2', '/vehiclesUsed/0'),
            vehicleIdentificationNumber: fixtureVehicleIdentificationNumber('WDB9634031L999999'),
        };
        const doc = createDummyDriverCardDoc([vehicleUse]);

        const compliance = createComplianceViewModel(doc, translationServiceFake, EU_561_2006_STANDARD);
        const localisation = createLocalisationServiceFake();
        const letter = createInfringementLetterViewModel(doc, compliance, localisation);

        expect(letter.vehicleRegistration).toBe('B-TR 4567 (DE)');
        expect(letter.vin).toBe('WDB9634031L999999');
    });
});
