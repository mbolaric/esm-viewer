import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeFileMetadata } from '#contracts';
import { createDriverIdentity, isDurationMilliseconds, type DurationMilliseconds, type IActivityDay } from '#tachograph-domain';
import { createOpenedTachographDocument } from '#viewer-application';
import {
    createLocalisationServiceFake,
    fixtureActivityInterval,
    fixtureCardNumber,
    fixtureIdentityName,
    fixtureIssuingMemberState,
    fixtureSourceReference,
    fixtureUtcTimestamp,
} from '#testing';
import {
    createAttestationFormViewModel,
    DEFAULT_ATTESTATION_COMPANY,
    isKnownDriverCardNumber,
    UNKNOWN_DRIVER_CARD_NUMBER,
} from '../attestation-form-view-model.js';

describe('isKnownDriverCardNumber', () => {
    it('rejects the unknown-card-number placeholder and empty strings', () => {
        expect(isKnownDriverCardNumber(UNKNOWN_DRIVER_CARD_NUMBER)).toBe(false);
        expect(isKnownDriverCardNumber('')).toBe(false);
    });

    it('accepts a real card number', () => {
        expect(isKnownDriverCardNumber('D987654321')).toBe(true);
    });
});

function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError(`Fixture duration ${String(value)} is not a valid duration.`);
    }
    return value;
}

function createActivityDay(midnightMs: number): IActivityDay {
    const midnightUtc = fixtureUtcTimestamp(midnightMs);
    const interval = fixtureActivityInterval('driving', midnightMs, midnightMs + 3_600_000, '/driverActivityData/0');
    return {
        intervals: [interval],
        midnightUtc,
        totals: {
            availability: duration(0),
            breakOrRest: duration(0),
            driving: duration(3_600_000),
            unknown: duration(0),
            work: duration(0),
        },
    };
}

function createDummyDriverCardDoc(activityDays: readonly IActivityDay[] = []): ReturnType<typeof createOpenedTachographDocument> {
    const meta = decodeFileMetadata({
        byteLength: 1024,
        displayName: 'attestation_card.ddd',
        sha256: 'b'.repeat(64),
    });
    if (!meta.ok) {
        throw new TypeError('Failed metadata decoding');
    }
    const id = createDriverIdentity({
        cardExpiryDate: fixtureUtcTimestamp(Date.UTC(2030, 0, 1)),
        cardHolderBirthDate: null,
        cardIssueDate: fixtureUtcTimestamp(Date.UTC(2025, 0, 1)),
        cardIssuingAuthorityName: 'KBA',
        cardNumber: fixtureCardNumber('D000001234567000'),
        cardValidityBegin: fixtureUtcTimestamp(Date.UTC(2025, 0, 1)),
        firstNames: fixtureIdentityName('Hans'),
        issuingMemberState: fixtureIssuingMemberState('DE'),
        source: fixtureSourceReference('driverCard', 'g2', '/cardIdentification'),
        surname: fixtureIdentityName('Muster'),
    });
    return createOpenedTachographDocument(
        {
            ...meta.value,
            openedAt: fixtureUtcTimestamp(Date.UTC(2026, 7, 25)),
            reopenToken: null,
            sourceToken: null,
        },
        {
            applications: [
                {
                    activityDays,
                    cardNotes: null,
                    events: [],
                    faults: [],
                    generation: 'g2',
                    identity: id,
                    locations: [],
                    source: fixtureSourceReference('driverCard', 'g2', '/cardIdentification'),
                    technicalRecords: [],
                    vehicleUnitUses: [],
                    vehicleUses: [],
                    verification: { dataFileSourcePaths: {}, dataFiles: {}, generation: 'g2' },
                    warnings: [],
                },
            ],
            cardType: 'driverCard',
            documentKind: 'driverCard',
            generation: 'g2',
            parserVariant: 'cardGen2',
            rawTree: {},
            sections: [],
        },
    );
}

describe('Attestation Form View Model', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('creates pre-filled EU attestation form with driver and company data', () => {
        const doc = createDummyDriverCardDoc();
        const localisation = createLocalisationServiceFake();

        const model = createAttestationFormViewModel(doc, localisation, {
            reason: 'sickLeave',
        });

        expect(model.driverName).toBe('Muster Hans');
        expect(model.driverCardNumber).toBe('D000001234567000');
        // Company details are never fabricated: the prefill stays empty until
        // the user enters them in the dialog.
        expect(model.companyName).toBe(DEFAULT_ATTESTATION_COMPANY.companyName);
        expect(model.companyName).toBe('');
        expect(model.reason).toBe('sickLeave');
        expect(model.box14_sickLeave).toBe(true);
        expect(model.box15_annualLeave).toBe(false);
        expect(model.box16_leaveOrRest).toBe(false);
    });

    it('toggles reason flags accurately for each box 14-19', () => {
        const doc = createDummyDriverCardDoc();
        const localisation = createLocalisationServiceFake();

        const modelAnnual = createAttestationFormViewModel(doc, localisation, {
            reason: 'annualLeave',
        });
        expect(modelAnnual.box15_annualLeave).toBe(true);
        expect(modelAnnual.box14_sickLeave).toBe(false);

        const modelOutOfScope = createAttestationFormViewModel(doc, localisation, {
            reason: 'outOfScope',
        });
        expect(modelOutOfScope.box17_outOfScope).toBe(true);
        expect(modelOutOfScope.box16_leaveOrRest).toBe(false);
    });

    it('leaves date of birth and employment date blank for the user to fill in (REPORT-05)', () => {
        const doc = createDummyDriverCardDoc();
        const localisation = createLocalisationServiceFake();

        const model = createAttestationFormViewModel(doc, localisation);

        // The tachograph never records either fact - these must start blank
        // (an editable input) rather than a permanent, non-editable em dash.
        expect(model.driverBirthDate).toBe('');
        expect(model.driverEmploymentDate).toBe('');
    });

    it('defaults the period to a calendar-day gap in recorded activity, not the full recorded range (REPORT-05)', () => {
        const firstDay = Date.UTC(2026, 7, 1);
        const secondDay = Date.UTC(2026, 7, 15);
        const doc = createDummyDriverCardDoc([createActivityDay(firstDay), createActivityDay(secondDay)]);
        const localisation = createLocalisationServiceFake();

        vi.useFakeTimers();
        vi.setSystemTime(secondDay);

        const model = createAttestationFormViewModel(doc, localisation);

        const gapStart = firstDay + 24 * 3_600_000;
        expect(model.periodFromFormatted).toBe(localisation.formatDateTime(fixtureUtcTimestamp(gapStart)));
        expect(model.periodToFormatted).toBe(localisation.formatDateTime(fixtureUtcTimestamp(secondDay)));
        // Not the old (backwards) default of the full recorded range, which
        // would start at the first day's own driving interval.
        expect(model.periodFromFormatted).not.toBe(localisation.formatDateTime(fixtureUtcTimestamp(firstDay)));
    });

    it('defaults the period to a trailing gap since the last recorded day when the card was just reinserted (REPORT-05)', () => {
        const onlyDay = Date.UTC(2026, 7, 1);
        const now = Date.UTC(2026, 7, 20);
        const doc = createDummyDriverCardDoc([createActivityDay(onlyDay)]);
        const localisation = createLocalisationServiceFake();

        vi.useFakeTimers();
        vi.setSystemTime(now);

        const model = createAttestationFormViewModel(doc, localisation);

        const gapStart = onlyDay + 24 * 3_600_000;
        expect(model.periodFromFormatted).toBe(localisation.formatDateTime(fixtureUtcTimestamp(gapStart)));
        expect(model.periodToFormatted).toBe(localisation.formatDateTime(fixtureUtcTimestamp(now)));
    });

    it('falls back to the current moment when no gap exists (continuous recorded days)', () => {
        const day1 = Date.UTC(2026, 7, 1);
        const day2 = Date.UTC(2026, 7, 2);
        const doc = createDummyDriverCardDoc([createActivityDay(day1), createActivityDay(day2)]);
        const localisation = createLocalisationServiceFake();

        vi.useFakeTimers();
        vi.setSystemTime(day2);

        const model = createAttestationFormViewModel(doc, localisation);

        expect(model.periodFromFormatted).toBe(localisation.formatDateTime(fixtureUtcTimestamp(day2)));
        expect(model.periodToFormatted).toBe(localisation.formatDateTime(fixtureUtcTimestamp(day2)));
    });

    it('lets an explicit period option override the detected gap', () => {
        const firstDay = Date.UTC(2026, 7, 1);
        const secondDay = Date.UTC(2026, 7, 15);
        const doc = createDummyDriverCardDoc([createActivityDay(firstDay), createActivityDay(secondDay)]);
        const localisation = createLocalisationServiceFake();
        const overrideFrom = fixtureUtcTimestamp(Date.UTC(2026, 7, 5));
        const overrideTo = fixtureUtcTimestamp(Date.UTC(2026, 7, 6));

        const model = createAttestationFormViewModel(doc, localisation, {
            periodFrom: overrideFrom,
            periodTo: overrideTo,
        });

        expect(model.periodFromFormatted).toBe(localisation.formatDateTime(overrideFrom));
        expect(model.periodToFormatted).toBe(localisation.formatDateTime(overrideTo));
    });
});
