import { describe, expect, it } from 'vitest';

import { createTachographEvent, createTachographFault, type ITachographEventInput } from '../index.js';
import {
    fixtureIssuingMemberState,
    fixtureSourceReference,
    fixtureUtcTimestamp,
    fixtureVehicleRegistrationNumber,
} from '#testing';

function eventInput(overrides: Partial<ITachographEventInput> = {}): ITachographEventInput {
    return {
        code: overrides.code ?? 'powerSupplyInterruption',
        end: overrides.end === undefined ? fixtureUtcTimestamp(Date.UTC(2024, 0, 2, 11)) : overrides.end,
        recordKind: 'event',
        recordPurpose: overrides.recordPurpose === undefined ? null : overrides.recordPurpose,
        registrationMemberState:
            overrides.registrationMemberState === undefined ? fixtureIssuingMemberState('D') : overrides.registrationMemberState,
        registrationNumber:
            overrides.registrationNumber === undefined
                ? fixtureVehicleRegistrationNumber('TEST-123')
                : overrides.registrationNumber,
        similarOccurrences: overrides.similarOccurrences === undefined ? null : overrides.similarOccurrences,
        source: overrides.source ?? fixtureSourceReference('driverCard', 'g2', '/driverCard/events/0'),
        start: overrides.start ?? fixtureUtcTimestamp(Date.UTC(2024, 0, 2, 10)),
    };
}

describe('tachograph events and faults', () => {
    it('creates an immutable event with explicit generation-neutral absence', () => {
        const event = createTachographEvent(
            eventInput({
                end: null,
                recordPurpose: null,
                registrationMemberState: null,
                registrationNumber: null,
                similarOccurrences: null,
            }),
        );

        expect(event).toMatchObject({
            code: 'powerSupplyInterruption',
            end: null,
            recordKind: 'event',
            recordPurpose: null,
            registrationMemberState: null,
            registrationNumber: null,
            similarOccurrences: null,
        });
    });

    it('creates a fault using the shared factual occurrence contract', () => {
        const input = eventInput({
            code: 'recordingEquipmentPrinterFault',
            recordPurpose: 'active',
            similarOccurrences: 2,
        });
        const fault = createTachographFault({
            ...input,
            recordKind: 'fault',
        });

        expect(fault).toMatchObject({
            code: 'recordingEquipmentPrinterFault',
            recordKind: 'fault',
            recordPurpose: 'active',
            similarOccurrences: 2,
        });
    });

    it('rejects an end before the recorded start', () => {
        expect(
            createTachographEvent(
                eventInput({
                    end: fixtureUtcTimestamp(Date.UTC(2024, 0, 2, 9)),
                }),
            ),
        ).toBeNull();
    });

    it.each([-1, 256, 1.5])('rejects an invalid similar-occurrence count', (value) => {
        expect(createTachographEvent(eventInput({ similarOccurrences: value }))).toBeNull();
    });
});
