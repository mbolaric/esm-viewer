import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryKeyValueStore, type IKeyValueStore } from '#contracts';

import { loadCompanySettings, saveCompanySettings, type ICompanySettings } from '../helpers/company-settings.js';

const settings: ICompanySettings = {
    address: 'Logistics Park 5',
    city: 'Frankfurt',
    companyName: 'Acme Transport S.A.',
    country: 'Germany',
    email: 'compliance@acme.example',
    faxNumber: '+49 69 123456',
    managerName: 'Klaus Meier',
    managerPosition: 'Transport Manager',
    postalCode: '60327',
    street: 'Mainzer Landstr. 1',
    telephone: '+49 69 654321',
    vatOrRegistration: 'DE123456789',
};

let settingsStore: IKeyValueStore = createMemoryKeyValueStore();

beforeEach(() => {
    settingsStore = createMemoryKeyValueStore();
});

describe('company-settings persistence', () => {
    it('round-trips company details through the settings store', () => {
        expect(loadCompanySettings(settingsStore)).toBeNull();

        saveCompanySettings(settingsStore, settings);
        expect(loadCompanySettings(settingsStore)).toEqual(settings);
    });

    it('rejects malformed stored values without throwing', () => {
        settingsStore.setItem('esm-viewer.compliance.company-details.v1', '{broken');
        expect(loadCompanySettings(settingsStore)).toBeNull();

        settingsStore.setItem('esm-viewer.compliance.company-details.v1', JSON.stringify({ companyName: 42 }));
        expect(loadCompanySettings(settingsStore)).toBeNull();
    });
});
