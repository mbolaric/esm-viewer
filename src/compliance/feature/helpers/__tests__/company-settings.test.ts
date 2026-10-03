import { describe, expect, it } from 'vitest';
import { mergeCompanySettings, type ICompanySettings } from '../company-settings.js';

const stored: ICompanySettings = {
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

describe('mergeCompanySettings', () => {
    it('keeps stored fields the caller did not edit', () => {
        expect(mergeCompanySettings(stored, { companyName: 'New Name' })).toEqual({ ...stored, companyName: 'New Name' });
    });

    it('fills every field with an empty string when nothing is stored', () => {
        const merged = mergeCompanySettings(null, { companyName: 'New Name' });

        expect(merged.companyName).toBe('New Name');
        expect(merged.city).toBe('');
        expect(Object.keys(merged)).toHaveLength(12);
    });
});
