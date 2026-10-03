import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryKeyValueStore, type IKeyValueStore } from '#contracts';

import {
    loadDriverAttestationDetails,
    saveDriverAttestationDetails,
    type IDriverAttestationDetails,
} from '../helpers/driver-attestation-details.js';

const details: IDriverAttestationDetails = {
    birthDate: '15.05.1980',
    employmentDate: '01.01.2020',
};

let settingsStore: IKeyValueStore = createMemoryKeyValueStore();

beforeEach(() => {
    settingsStore = createMemoryKeyValueStore();
});

describe('driver-attestation-details persistence', () => {
    it('round-trips details through the settings store, keyed by card number', () => {
        expect(loadDriverAttestationDetails(settingsStore, 'D987654321')).toBeNull();

        saveDriverAttestationDetails(settingsStore, 'D987654321', details);
        expect(loadDriverAttestationDetails(settingsStore, 'D987654321')).toEqual(details);
    });

    it('keeps different driver card numbers independent', () => {
        saveDriverAttestationDetails(settingsStore, 'D111111111', details);

        expect(loadDriverAttestationDetails(settingsStore, 'D222222222')).toBeNull();
        expect(loadDriverAttestationDetails(settingsStore, 'D111111111')).toEqual(details);
    });

    it('rejects malformed stored values without throwing', () => {
        settingsStore.setItem('esm-viewer.compliance.driver-attestation-details.v1.D987654321', '{broken');
        expect(loadDriverAttestationDetails(settingsStore, 'D987654321')).toBeNull();

        settingsStore.setItem(
            'esm-viewer.compliance.driver-attestation-details.v1.D987654321',
            JSON.stringify({ birthDate: 42 }),
        );
        expect(loadDriverAttestationDetails(settingsStore, 'D987654321')).toBeNull();
    });
});
