import type { ILocalisationService } from '#localization';
import type { OpenedTachographDocument } from '#viewer-application';
import {
    createDetailedSpeedSample,
    createOverspeedRecord,
    createSourceReference,
    isJsonPointer,
    isSpeedKilometresPerHour,
    isUtcTimestamp,
    type DurationMilliseconds,
    type UtcTimestamp,
} from '#viewer-domain';
import { createVehicleUnitDocumentFixture } from './vehicle-unit-document-fixture.js';

import { describe, expect, it } from 'vitest';

import { createSpeedSectionViewModel } from '../view-models/speed-view-model.js';

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The speed view-model timestamp fixture must be valid.');
    }
    return value;
}

function localisation(): ILocalisationService<UtcTimestamp, DurationMilliseconds> {
    return {
        dateFormat: 'ddMMyyyy',
        locale: 'en',
        timeZone: 'UTC',
        formatDateTime: (value) => `date-time:${String(value)}`,
        formatDuration: (value) => `duration:${String(value)}`,
        formatMonthLabel: (value) => `month:${String(value)}`,
        formatMonthShortLabel: (value) => `month-short:${String(value)}`,
        formatNumber: (value, options) => `number:${new Intl.NumberFormat('en', options).format(value)}`,
        formatDate: (value) => `date:${String(value)}`,
        formatUtcDate: (value) => `utc-date:${String(value)}`,
        formatUtcTime: (value) => `utc-time:${String(value)}`,
        formatWeekdayLabels: () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    };
}

function document(): OpenedTachographDocument {
    const samplePath = '/speed/0';
    const recordedAt = timestamp(Date.UTC(2026, 5, 18, 8, 42));
    const speed = 72;
    if (!isJsonPointer(samplePath) || !isSpeedKilometresPerHour(speed)) {
        throw new TypeError('The speed view-model document fixture must be valid.');
    }
    return createVehicleUnitDocumentFixture({
        detailedSpeedSamples: [
            createDetailedSpeedSample({
                recordedAt,
                source: createSourceReference('vehicleUnit', 'g2', samplePath),
                speedKilometresPerHour: speed,
            }),
        ],
        openedAt: timestamp(Date.UTC(2026, 5, 19)),
    });
}

describe('speed view model', () => {
    it('formats a bounded page, factual statistics, and exact source records', () => {
        const viewModel = createSpeedSectionViewModel(document(), localisation(), {
            end: null,
            pageIndex: 0,
            preferredSample: null,
            start: null,
        });

        expect(viewModel).toMatchObject({
            chartRecords: [
                {
                    pageIndex: 0,
                    source: {
                        path: '/speed/0',
                    },
                },
            ],
            chartReduced: false,
            pageCount: { display: 'number:1', value: 1 },
            pageIndex: 0,
            pageNumber: { display: 'number:1', value: 1 },
            statistics: {
                average: { display: 'number:72.0', value: 72 },
                maximum: { display: 'number:72', value: 72 },
                minimum: { display: 'number:72', value: 72 },
            },
            timeZone: 'UTC',
            totalSamples: { display: 'number:1', value: 1 },
        });
        expect(viewModel.range).toMatchObject({
            endInput: `utc-date:${String(Date.UTC(2026, 5, 18, 8, 42))} utc-time:${String(Date.UTC(2026, 5, 18, 8, 42))}`,
            startInput: `utc-date:${String(Date.UTC(2026, 5, 18, 8, 42))} utc-time:${String(Date.UTC(2026, 5, 18, 8, 42))}`,
        });
        expect(viewModel.chartTicks).toEqual([
            {
                display: `date-time:${String(Date.UTC(2026, 5, 18, 8, 42))}`,
                value: Date.UTC(2026, 5, 18, 8, 42),
            },
        ]);
        expect(viewModel.records[0]).toMatchObject({
            generation: 'g2',
            recordedAt: {
                display: `date-time:${String(Date.UTC(2026, 5, 18, 8, 42))}`,
            },
            source: {
                path: '/speed/0',
            },
            speed: {
                display: 'number:72',
            },
        });
    });

    it('formats overspeed records and control context as raw evidence', () => {
        const begin = Date.UTC(2026, 5, 18, 8);
        const end = begin + 5 * 60 * 1_000;
        const overspeedPath = '/overspeed/0';
        const controlPath = '/overspeedControl';
        const samplePath = '/speed/0';
        const sampleSpeed = 72;
        const maxSpeed = 98;
        if (
            !isUtcTimestamp(begin) ||
            !isUtcTimestamp(end) ||
            !isJsonPointer(overspeedPath) ||
            !isJsonPointer(controlPath) ||
            !isJsonPointer(samplePath) ||
            !isSpeedKilometresPerHour(sampleSpeed) ||
            !isSpeedKilometresPerHour(maxSpeed)
        ) {
            throw new TypeError('The overspeed view-model fixture must be valid.');
        }
        const record = createOverspeedRecord({
            averageSpeedKilometresPerHour: 95,
            begin,
            cardNumberDriverSlotBegin: null,
            end,
            maxSpeedKilometresPerHour: maxSpeed,
            purpose: 'oneOf10MostRecentOrLast',
            similarEventsNumber: 1,
            source: createSourceReference('vehicleUnit', 'g2', overspeedPath),
        });
        if (record === null) {
            throw new TypeError('The overspeed view-model fixture must be valid.');
        }
        const overspeedDocument: OpenedTachographDocument = createVehicleUnitDocumentFixture({
            detailedSpeedSamples: [
                createDetailedSpeedSample({
                    recordedAt: begin,
                    source: createSourceReference('vehicleUnit', 'g2', samplePath),
                    speedKilometresPerHour: sampleSpeed,
                }),
            ],
            openedAt: timestamp(Date.UTC(2026, 5, 19)),
            overspeedControl: {
                firstOverspeedSince: begin,
                kind: 'overspeedControlData',
                lastOverspeedControlTime: null,
                numberOfOverspeedSince: 1,
                source: createSourceReference('vehicleUnit', 'g2', controlPath),
            },
            overspeedRecords: [record],
        });

        const viewModel = createSpeedSectionViewModel(overspeedDocument, localisation(), {
            end: null,
            pageIndex: 0,
            preferredSample: null,
            start: null,
        });

        expect(viewModel.overspeedRecords).toEqual([
            {
                begin: { display: `date-time:${String(begin)}`, value: begin },
                cardNumber: null,
                end: { display: `date-time:${String(end)}`, value: end },
                generation: 'g2',
                id: '/overspeed/0',
                maxSpeed: { display: 'number:98', value: 98 },
                purpose: 'oneOf10MostRecentOrLast',
                similarEvents: { display: 'number:1', value: 1 },
                source: {
                    documentKind: 'vehicleUnit',
                    generation: 'g2',
                    path: '/overspeed/0',
                },
            },
        ]);
        expect(viewModel.overspeedControl).toMatchObject({
            firstOverspeedSince: { display: `date-time:${String(begin)}`, value: begin },
            lastControl: null,
            numberOfOverspeedSince: { display: 'number:1', value: 1 },
        });
    });
});
