import {
    createRecordedActivityInterval,
    createSourceReference,
    isJsonPointer,
    isUtcTimestamp,
    type ActivityKind,
    type IRecordedActivityInterval,
    type ISourceReference,
    type UtcTimestamp,
} from '#viewer-domain';
import { createLocalisationServiceFake, fixtureSingleDriverCrew } from '#testing';
import { describe, expect, it } from 'vitest';

import { EU_561_2006_STANDARD, evaluateDocumentCompliance } from '#compliance';

import { createActivitySectionViewModel } from '../view-models/activity-view-model.js';
import { createDriverCardActivityDocumentFixture } from './driver-card-activity-document-fixture.js';
import { NO_COMPLIANCE_EVALUATION } from './activity-view-model-fixture.js';

function utc(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The test timestamp must be valid.');
    }
    return value;
}

function cardSource(path: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The test source must be valid.');
    }
    return createSourceReference('driverCard', 'g1', path);
}

const hour = 3_600_000;

function interval(activity: ActivityKind, startMs: number, endMs: number, path: string): IRecordedActivityInterval {
    const res = createRecordedActivityInterval(activity, utc(startMs), utc(endMs), cardSource(path), fixtureSingleDriverCrew);
    if (res === null) {
        throw new TypeError('The test interval must be valid.');
    }
    return res;
}

describe('Activity view-model infringement pins', () => {
    it('projects continuous driving break infringement pins onto the corresponding day', () => {
        const midnight = Date.UTC(2026, 6, 27);
        const document = createDriverCardActivityDocumentFixture({
            displayName: 'card-with-infringement.ddd',
            intervals: [interval('driving', midnight + 8 * hour, midnight + 13 * hour, '/activities/0')],
            midnight,
            openedAt: utc(midnight + 14 * hour),
        });

        const localisation = createLocalisationServiceFake({ locale: 'en', timeZone: 'UTC' });
        const { infringements } = evaluateDocumentCompliance(document, EU_561_2006_STANDARD);
        const sectionResult = createActivitySectionViewModel(document, localisation, EU_561_2006_STANDARD, {
            ...NO_COMPLIANCE_EVALUATION,
            infringements,
        });

        expect(sectionResult.ok).toBe(true);
        if (!sectionResult.ok) {
            return;
        }

        const day = sectionResult.value.days[0];
        expect(day).toBeDefined();
        expect(day?.infringements.length).toBeGreaterThan(0);

        const breakPin = day?.infringements.find((pin) => pin.category === 'break');
        expect(breakPin).toBeDefined();
        expect(breakPin?.severity).toBe('serious');
        expect(breakPin?.matchedRecordId).toBeDefined();
        expect(breakPin?.percentage).toBeGreaterThan(0);
    });
});
