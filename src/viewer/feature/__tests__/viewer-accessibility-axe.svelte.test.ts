import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { classifyParseError } from '#contracts';
import { expectNoAxeViolations } from '#testing';
import {
    createAccumulatedDrivingPosition,
    createDailyWorkPeriodPlace,
    createGnssPositionEvidence,
    createSourceReference,
    isCardNumber,
    isGnssAccuracyIndicator,
    isGnssAuthenticationStatus,
    isIssuingMemberState,
    isJsonPointer,
    isLatitude,
    isLongitude,
    isOdometerKilometres,
    isUtcTimestamp,
    type ISourceReference,
    type OdometerKilometres,
    type TachographLocationRecord,
} from '#viewer-domain';

import { createViewerDocumentHarness } from './viewer-document-harness.js';
import { startOpen, renderWorkflow, type ViewerDocumentHarness } from './viewer-workflow-helpers.js';

// Automated WCAG 2.2 AA accessibility verification across composed screen states.
beforeAll(() => {
    document.documentElement.setAttribute('lang', 'en');
});

afterEach(() => {
    cleanup();
    window.localStorage.clear();
});

async function openOverview(harness: ViewerDocumentHarness): Promise<void> {
    await startOpen(harness);
    harness.completeLatestParser(harness.successfulParserResult());
    await screen.findByRole('heading', { name: 'Overview' });
}

async function openVehicleUnitOverview(harness: ViewerDocumentHarness): Promise<void> {
    await startOpen(harness);
    harness.completeLatestParser(harness.successfulVehicleParserResult());
    await screen.findByRole('heading', { name: 'Overview' });
}

function journeyLocations(): readonly TachographLocationRecord[] {
    const midnight = Date.UTC(2026, 6, 27);
    const beginAt = midnight + 6 * 3_600_000;
    const gnssAt = midnight + 9 * 3_600_000;
    const endAt = midnight + 12 * 3_600_000;
    const odometerValue = 12_338;
    const cardNumber = 'SYNTHETIC0000001';
    const memberState = 'D';
    const latitude = 40.4168;
    const longitude = -3.7038;
    const accuracy = 2;
    const authenticationStatus = 1;
    if (
        !isUtcTimestamp(beginAt) ||
        !isUtcTimestamp(gnssAt) ||
        !isUtcTimestamp(endAt) ||
        !isOdometerKilometres(odometerValue) ||
        !isCardNumber(cardNumber) ||
        !isIssuingMemberState(memberState) ||
        !isLatitude(latitude) ||
        !isLongitude(longitude) ||
        !isGnssAccuracyIndicator(accuracy) ||
        !isGnssAuthenticationStatus(authenticationStatus)
    ) {
        throw new TypeError('The journey axe fixture must be valid.');
    }
    const odometer = (value: number): OdometerKilometres => {
        if (!isOdometerKilometres(value)) {
            throw new TypeError('The journey axe odometer must be valid.');
        }
        return value;
    };
    const source = (path: string): ISourceReference<'g1', 'driverCard'> => {
        if (!isJsonPointer(path)) {
            throw new TypeError('The journey axe source must be valid.');
        }
        return createSourceReference('driverCard', 'g1', path);
    };
    const position = createGnssPositionEvidence({
        accuracy,
        authenticationStatus,
        coordinates: { latitude, longitude },
        determinedAt: gnssAt,
    });
    const card = {
        cardNumber,
        cardType: 'driverCard' as const,
        issuingMemberState: memberState,
    };
    const begin = createDailyWorkPeriodPlace({
        card,
        country: memberState,
        entryAt: beginAt,
        entryType: 'beginCardInsertion',
        odometer: odometer(odometerValue),
        position,
        region: 'CastillaLeon',
        source: source('/places/0'),
    });
    const end = createDailyWorkPeriodPlace({
        card,
        country: memberState,
        entryAt: endAt,
        entryType: 'endCardWithdrawal',
        odometer: odometer(odometerValue + 280),
        position,
        region: 'CastillaLeon',
        source: source('/places/1'),
    });
    const gnss = createAccumulatedDrivingPosition({
        coDriverCard: null,
        driverCard: card,
        odometer: odometer(odometerValue + 140),
        position,
        recordedAt: gnssAt,
        source: source('/positions/0'),
    });
    return [begin, end, gnss];
}

async function navigateToSection(harness: ViewerDocumentHarness, sectionName: string, headingName: string): Promise<void> {
    await openOverview(harness);
    const navigator = screen.getByRole('navigation', { name: 'Document sections' });
    await fireEvent.click(within(navigator).getByRole('button', { name: sectionName }));
    await screen.findByRole('heading', { level: 1, name: headingName });
}

describe('WCAG 2.2 AA automated axe gate', () => {
    it('has no violations on the welcome task', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await screen.findByRole('heading', { name: 'Open a tachograph file' });
        await expectNoAxeViolations(document.body);
    });

    it('has no violations while opening a document', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await startOpen(harness);
        await screen.findByRole('heading', { name: 'Opening tachograph file' });
        await expectNoAxeViolations(document.body);
    });

    it('has no violations on the privacy-safe open failure state', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await startOpen(harness);
        harness.completeLatestParser({
            error: classifyParseError('malformedData'),
            ok: false,
        });
        await screen.findByRole('heading', { name: 'This file could not be opened' });
        await expectNoAxeViolations(document.body);
    });

    it('has no violations on the factual overview', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await openOverview(harness);
        await expectNoAxeViolations(document.body);
    });

    it('has no violations on the integrity workspace', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await navigateToSection(harness, 'Integrity', 'Integrity');
        await expectNoAxeViolations(document.body);
    });

    it('has no violations on the activities workspace', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await navigateToSection(harness, 'Activities', 'Activities');
        await expectNoAxeViolations(document.body);
    });

    it('has no violations on the events and faults workspace', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await navigateToSection(harness, 'Events & faults', 'Events & faults');
        await expectNoAxeViolations(document.body);
    });

    it('has no violations with the preferences dialog open', async () => {
        const harness = createViewerDocumentHarness();
        const context = renderWorkflow(harness);

        await openOverview(harness);
        context.preferencesController.open();
        await screen.findByRole('dialog', { name: 'Preferences' });
        await expectNoAxeViolations(document.body);
    });

    it('has no violations with the about dialog open', async () => {
        const harness = createViewerDocumentHarness();
        const context = renderWorkflow(harness);

        await openOverview(harness);
        void context.aboutController.open();
        await screen.findByRole('dialog', { name: 'About ESM Viewer' });
        await expectNoAxeViolations(document.body);
    });

    it('has no violations on the places workspace with journey progression cards', async () => {
        const harness = createViewerDocumentHarness({ locations: journeyLocations() });
        renderWorkflow(harness);

        await navigateToSection(harness, 'Places', 'Places');
        await screen.findByRole('region', { name: 'Journey progression' });
        await expectNoAxeViolations(document.body);
    });

    it('has no violations on the speed workspace', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await openVehicleUnitOverview(harness);
        const navigator = screen.getByRole('navigation', { name: 'Document sections' });
        await fireEvent.click(within(navigator).getByRole('button', { name: 'Speed' }));
        await screen.findByRole('heading', { level: 1, name: 'Speed' });
        await expectNoAxeViolations(document.body);
    }, 30_000);

    it('has no violations on the duty-shift activity view', async () => {
        const harness = createViewerDocumentHarness();
        renderWorkflow(harness);

        await navigateToSection(harness, 'Activities', 'Activities');
        const dutyShiftToggle = screen.getByRole('button', { name: 'Duty Shift' });
        await fireEvent.click(dutyShiftToggle);
        await waitFor(() => {
            expect(dutyShiftToggle.getAttribute('aria-pressed')).toBe('true');
        });
        await expectNoAxeViolations(document.body);
    });
});
