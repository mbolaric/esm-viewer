import { describe, expect, it } from 'vitest';
import {
    createAttestationExportModel,
    createInitialAttestationFormDraft,
    isAttestationFormDraftComplete,
    missingAttestationFormFields,
    type IAttestationCompanyDraft,
} from '../attestation-form-draft.js';
import { mockAttestationFormViewModel as model } from './attestation-form-fixture.js';

const persistedSettings: IAttestationCompanyDraft = {
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

describe('createInitialAttestationFormDraft', () => {
    it('prefers persisted company settings over the document prefill', () => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);

        expect(draft.company).toEqual(persistedSettings);
    });

    it('falls back to the document prefill when nothing is persisted, with empty address/vat', () => {
        const draft = createInitialAttestationFormDraft(model, null);

        expect(draft.company).toEqual({
            address: '',
            city: model.companyCity,
            companyName: model.companyName,
            country: model.companyCountry,
            email: model.companyEmail,
            faxNumber: model.companyFax,
            managerName: model.managerName,
            managerPosition: model.managerPosition,
            postalCode: model.companyPostalCode,
            street: model.companyStreet,
            telephone: model.companyTelephone,
            vatOrRegistration: '',
        });
    });

    it('always seeds driver/period fields from the document, never from persisted settings', () => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);

        expect(draft.driverName).toBe(model.driverName);
        expect(draft.driverBirthDate).toBe(model.driverBirthDate);
        expect(draft.driverLicenceOrId).toBe(model.driverLicenceOrId);
        expect(draft.driverEmploymentDate).toBe(model.driverEmploymentDate);
        expect(draft.periodFromFormatted).toBe(model.periodFromFormatted);
        expect(draft.periodToFormatted).toBe(model.periodToFormatted);
    });
});

describe('isAttestationFormDraftComplete', () => {
    it('is complete when every required field is filled in', () => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);
        expect(isAttestationFormDraftComplete(draft)).toBe(true);
    });

    it.each<keyof IAttestationCompanyDraft>([
        'companyName',
        'street',
        'postalCode',
        'city',
        'country',
        'telephone',
        'managerName',
        'managerPosition',
    ])('is incomplete when company.%s is blank', (field) => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);
        const incomplete = { ...draft, company: { ...draft.company, [field]: '  ' } };
        expect(isAttestationFormDraftComplete(incomplete)).toBe(false);
    });

    it.each<'driverBirthDate' | 'driverEmploymentDate' | 'driverLicenceOrId' | 'driverName'>([
        'driverName',
        'driverBirthDate',
        'driverLicenceOrId',
        'driverEmploymentDate',
    ])('is incomplete when %s is blank', (field) => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);
        const incomplete = { ...draft, [field]: '  ' };
        expect(isAttestationFormDraftComplete(incomplete)).toBe(false);
    });

    it('is incomplete when the period is blank', () => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);
        expect(isAttestationFormDraftComplete({ ...draft, periodFromFormatted: '' })).toBe(false);
        expect(isAttestationFormDraftComplete({ ...draft, periodToFormatted: '' })).toBe(false);
    });

    it('address and vatOrRegistration are never required', () => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);
        const cleared = {
            ...draft,
            company: { ...draft.company, address: '', vatOrRegistration: '' },
        };
        expect(isAttestationFormDraftComplete(cleared)).toBe(true);
    });
});

describe('createAttestationExportModel', () => {
    it('overlays the draft edits onto the document view model and keeps everything else', () => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);
        const edited = {
            ...draft,
            driverName: 'Edited Driver',
            company: { ...draft.company, companyName: 'Edited Co.' },
        };

        const exportModel = createAttestationExportModel(model, edited);

        expect(exportModel.companyName).toBe('Edited Co.');
        expect(exportModel.companyCity).toBe(persistedSettings.city);
        expect(exportModel.driverName).toBe('Edited Driver');
        expect(exportModel.managerName).toBe(persistedSettings.managerName);
        // Fields the draft does not own must pass through from `model` unchanged.
        expect(exportModel.reason).toBe(model.reason);
        expect(exportModel.driverCardNumber).toBe(model.driverCardNumber);
        expect(exportModel.dateFormatted).toBe(model.dateFormatted);
    });
});

describe('missingAttestationFormFields', () => {
    it('lists nothing for a complete draft', () => {
        expect(missingAttestationFormFields(createInitialAttestationFormDraft(model, persistedSettings))).toEqual([]);
    });

    it('lists blank required fields in the order the dialog shows them', () => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);
        const incomplete = {
            ...draft,
            company: { ...draft.company, city: ' ', companyName: '' },
            periodToFormatted: '',
        };

        expect(missingAttestationFormFields(incomplete)).toEqual(['companyName', 'city', 'periodTo']);
    });

    it('never lists fax or e-mail, which are optional on the form', () => {
        const draft = createInitialAttestationFormDraft(model, persistedSettings);
        const withoutContact = { ...draft, company: { ...draft.company, email: '', faxNumber: '' } };

        expect(missingAttestationFormFields(withoutContact)).toEqual([]);
    });
});
