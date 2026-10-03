import { describe, expect, it } from 'vitest';
import { createInfringementLetterExportModel, createInitialInfringementLetterDraft } from '../infringement-letter-draft.js';
import type { IInfringementLetterViewModel } from '../infringement-letter-view-model.js';

const model: IInfringementLetterViewModel = {
    auditPeriod: '01.07.2026 – 28.07.2026',
    cardNumber: 'D1234567890',
    company: {
        address: 'Prefill Street 1',
        companyName: 'Prefill GmbH',
        managerName: 'Prefill Manager',
        vatOrRegistration: 'DE000',
    },
    driverExplanation: 'Prefilled explanation',
    driverName: 'Mustermann Max',
    fileName: 'driver.ddd',
    generatedAt: '28.07.2026 14:00',
    issuingMemberState: 'Germany',
    items: [],
    minorCount: 0,
    mostSeriousCount: 0,
    seriousCount: 0,
    totalInfringements: 0,
    vehicleRegistration: null,
    verySeriousCount: 0,
    vin: null,
};

describe('createInitialInfringementLetterDraft', () => {
    it('prefers persisted company details over the document prefill', () => {
        const persisted = {
            address: 'Logistics Park 5',
            companyName: 'Acme Transport S.A.',
            managerName: 'Klaus Meier',
            vatOrRegistration: 'DE123456789',
        };

        expect(createInitialInfringementLetterDraft(model, persisted).company).toEqual(persisted);
    });

    it('falls back to the document prefill when nothing is persisted', () => {
        const draft = createInitialInfringementLetterDraft(model, null);

        expect(draft.company).toEqual(model.company);
        expect(draft.driverExplanation).toBe('Prefilled explanation');
    });
});

describe('createInfringementLetterExportModel', () => {
    it('overlays the draft company and explanation while passing other fields through', () => {
        const exportModel = createInfringementLetterExportModel(model, {
            company: { address: 'A', companyName: 'B', managerName: 'C', vatOrRegistration: 'D' },
            driverExplanation: 'Edited',
        });

        expect(exportModel.company).toEqual({ address: 'A', companyName: 'B', managerName: 'C', vatOrRegistration: 'D' });
        expect(exportModel.driverExplanation).toBe('Edited');
        expect(exportModel.driverName).toBe(model.driverName);
        expect(exportModel.auditPeriod).toBe(model.auditPeriod);
    });
});
