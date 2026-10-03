import { describe, expect, it } from 'vitest';

import type { Gen1VuEvents } from '../generated/esm_parser.js';
import type { ParserGen1VehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { normalizeVehicleUnitEventFaultData } from '../vehicle-unit/vehicle-unit-event-fault-normalizer.js';
import { fullCardNumber } from './parser-fixtures.js';

function eventsAndFaults(): Gen1VuEvents {
    const cardNumber = fullCardNumber();
    return {
        signature: null,
        vuEventData: {
            noOfVuEvents: 1,
            vuEventRecords: [
                {
                    cardNumberCodriverSlotBegin: cardNumber,
                    cardNumberCodriverSlotEnd: cardNumber,
                    cardNumberDriverSlotBegin: cardNumber,
                    cardNumberDriverSlotEnd: cardNumber,
                    eventBeginTime: '2024-02-01 10:00:00 UTC',
                    eventEndTime: '2024-02-01 11:00:00 UTC',
                    eventRecordPurpose: 'OneOf10MostRecentOrLast',
                    eventType: 'PowerSupplyInterruption',
                    similarEventsNumber: 2,
                },
            ],
        },
        vuFaultData: {
            noOfVuFaults: 2,
            vuFaultRecords: [
                {
                    cardNumberCodriverSlotBegin: cardNumber,
                    cardNumberCodriverSlotEnd: cardNumber,
                    cardNumberDriverSlotBegin: cardNumber,
                    cardNumberDriverSlotEnd: cardNumber,
                    faultBeginTime: '2024-02-02 10:00:00 UTC',
                    faultEndTime: '2024-02-02 11:00:00 UTC',
                    faultRecordPurpose: 'ActiveEventOrFault',
                    faultType: 'REDisplayFault',
                },
            ],
        },
        vuOverSpeedingControlData: {
            firstOverspeedSince: null,
            lastOverspeedControlTime: null,
            numberOfOverspeedSince: 0,
        },
        vuOverSpeedingEventData: {
            noOfVuOverSpeedingEvents: 0,
            vuOverSpeedingEventRecords: [],
        },
        vuTimeAdjustmentData: {
            noOfVuTimeAdjRecords: 0,
            vuTimeAdjustmentRecords: [],
        },
    };
}

describe('vehicle-unit event and fault normalization', () => {
    it('preserves valid event evidence when a fault count is inconsistent', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Events: eventsAndFaults(),
            },
            position: 0,
            typeId: 'EventsAndFaults',
        };

        const result = normalizeVehicleUnitEventFaultData([parameter], 'vuGen1');

        expect(result.events).toMatchObject([
            {
                code: 'powerSupplyInterruption',
                recordKind: 'event',
                recordPurpose: 'oneOf10MostRecentOrLast',
                similarOccurrences: 2,
                source: {
                    generation: 'g1',
                    path: '/transferResParams/0/data/Events/vuEventData/vuEventRecords/0',
                },
            },
        ]);
        expect(result.faults).toEqual([]);
        expect(result.warnings).toEqual([
            {
                code: 'inconsistentData',
                source: {
                    documentKind: 'vehicleUnit',
                    generation: 'g1',
                    path: '/transferResParams/0/data/Events/vuFaultData',
                },
            },
        ]);
    });

    it('reports same-generation duplicate event evidence through a source-safe warning', () => {
        const data = eventsAndFaults();
        const event = data.vuEventData.vuEventRecords[0];
        if (event === undefined) {
            throw new TypeError('The synthetic VU event must exist.');
        }
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Events: {
                    ...data,
                    vuEventData: {
                        noOfVuEvents: 2,
                        vuEventRecords: [event, { ...event }],
                    },
                    vuFaultData: {
                        ...data.vuFaultData,
                        noOfVuFaults: 1,
                    },
                },
            },
            position: 0,
            typeId: 'EventsAndFaults',
        };

        const result = normalizeVehicleUnitEventFaultData([parameter], 'vuGen1');

        expect(result.events).toHaveLength(2);
        expect(result.warnings).toContainEqual({
            code: 'duplicateEvidence',
            source: {
                documentKind: 'vehicleUnit',
                generation: 'g1',
                path: '/transferResParams/0/data/Events/vuEventData/vuEventRecords/1',
            },
        });
    });
});
