import { describe, expect, it } from 'vitest';

import { decodePdfDocumentRequest } from '#contracts';
import { isUtcTimestamp, type UtcTimestamp } from '#tachograph-domain';
import type { IAttestationFormViewModel } from '../attestation-form-view-model.js';
import type { IAttestationFormExportLabels } from '../export-document-html.js';
import type { IInfringementLetterViewModel } from '../infringement-letter-view-model.js';
import type { IInfringementLetterExportLabels } from '../export-document-html.js';
import { createAttestationFormPdfRequest, createInfringementLetterPdfRequest } from '../pdf-document-request.js';

function utc(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError(`Fixture timestamp ${String(value)} is not a valid UTC epoch value.`);
    }
    return value;
}

function createLetterLabels(): IInfringementLetterExportLabels {
    return {
        auditPeriod: 'Audit period',
        cardNumber: 'Card Number',
        colAllowed: 'Limit',
        colDateTime: 'Date / Time',
        colDescription: 'Description',
        colExcess: 'Excess',
        colMeasured: 'Measured',
        colNum: '#',
        colSeverity: 'Severity',
        date: 'Date',
        dateAndSignature: 'Date and signature',
        driver: 'Driver',
        driverAckText: 'I confirm receipt of this notification.',
        driverExplanation: 'Driver statement',
        driverSignature: 'Driver Signature',
        file: 'Source File',
        generated: 'Generated',
        managerSignature: 'Manager Signature',
        qualification:
            'ESM Viewer calculation — not a certified legal assessment. Confirm important findings with a qualified specialist.',
        severityMinor: 'Minor',
        severityMostSerious: 'Most serious',
        severitySerious: 'Serious',
        severityVerySerious: 'Very serious',
        statement: 'The following infringements were detected:',
        title: 'Infringement Letter',
        totalInfringements: 'Total Infringements',
        vin: 'VIN',
        vehicle: 'Vehicle',
    };
}

function createLetterModel(): IInfringementLetterViewModel {
    return {
        auditPeriod: '2026-08-01 - 2026-08-14',
        cardNumber: 'DF1234567890',
        company: {
            address: '1 Main Street',
            companyName: 'Acme Transport',
            managerName: 'Max Mustermann',
            vatOrRegistration: 'DE123456789',
        },
        driverExplanation: '',
        driverName: 'Jane Doe',
        fileName: 'C_JANE_DOE.ddd',
        generatedAt: '2026-08-28 12:00',
        issuingMemberState: 'DE',
        items: [
            {
                allowedValue: '9h 00m',
                dateTimeDisplay: '2026-08-20 14:30',
                excess: '+1h 15m',
                legalReference: 'Reg (EC) 561/2006 Art. 6(1)',
                measuredValue: '10h 15m',
                ruleId: 'daily-driving',
                severity: 'serious',
                sourcePointer: '/0/1',
                timestamp: utc(1_752_000_000_000),
                title: 'Daily driving limit exceeded',
            },
        ],
        minorCount: 0,
        mostSeriousCount: 0,
        seriousCount: 1,
        totalInfringements: 1,
        vehicleRegistration: 'AB12 CDE',
        verySeriousCount: 0,
        vin: 'WDB12345678901234',
    };
}

function createAttestationModel(): IAttestationFormViewModel {
    return {
        box14_sickLeave: false,
        box15_annualLeave: true,
        box16_leaveOrRest: false,
        box17_outOfScope: false,
        box18_otherWork: false,
        box19_available: false,
        companyCity: 'Berlin',
        companyCountry: 'Germany',
        companyEmail: 'office@acme.de',
        companyFax: '+49 30 654321',
        companyName: 'Acme Transport',
        companyPostalCode: '10115',
        companyStreet: 'Hauptstr. 1',
        companyTelephone: '+49 30 123456',
        dateFormatted: '28.08.2026',
        driverBirthDate: '15.05.1980',
        driverCardNumber: 'D987654321',
        driverEmploymentDate: '01.01.2020',
        driverLicenceOrId: 'B1234567',
        driverName: 'Jane Doe',
        generatedAt: '28.08.2026 12:00',
        managerName: 'Max Mustermann',
        managerPosition: 'Transport Manager',
        periodFromFormatted: '01.08.2026 00:00',
        periodToFormatted: '14.08.2026 23:59',
        reason: 'annualLeave',
    };
}

function createAttestationLabels(): IAttestationFormExportLabels {
    return {
        date: 'Date',
        declareDriver: 'Driver part',
        driverSignature: 'Driver Signature',
        footnote1: 'Footnote',
        footnote2: '',
        footnote3: '',
        forPeriod: 'Period',
        item10_licence: 'Driving licence',
        item11_employmentDate: 'Employment start',
        item12_from: 'From',
        item13_to: 'To',
        item14_sickLeave: 'Sick leave',
        item15_annualLeave: 'Annual leave',
        item16_leaveOrRest: 'Leave or rest',
        item17_outOfScope: 'Out of scope',
        item18_otherWork: 'Other work',
        item19_available: 'Available',
        item1_undertaking: 'Undertaking',
        item20_place: 'Place',
        item21_driverConfirm: 'Driver confirmation',
        item22_place: 'Place',
        item2_address: 'Address',
        item3_tel: 'Telephone',
        item4_fax: 'Fax',
        item5_email: 'E-mail',
        item6_name: 'Signatory',
        item7_position: 'Position',
        item8_driverName: 'Driver Name',
        item9_birthDate: 'Date of birth',
        officialAnnex: 'Annex',
        officialInstruction: 'Instructions',
        officialRegulation: 'Regulation',
        officialTitle: 'Attestation',
        officialWarning: 'Warning',
        partUndertaking: 'Undertaking part',
        signature: 'Signature',
        undersigned: 'Undersigned',
    };
}

describe('PDF request factories', () => {
    it('builds a typed infringement letter request that passes the boundary decoder', () => {
        const model = createLetterModel();
        const labels = createLetterLabels();

        const request = createInfringementLetterPdfRequest(
            model,
            labels,
            (severity) => {
                switch (severity) {
                    case 'minor':
                        return labels.severityMinor;
                    case 'mostSerious':
                        return labels.severityMostSerious;
                    case 'serious':
                        return labels.severitySerious;
                    case 'verySerious':
                        return labels.severityVerySerious;
                }
            },
            'Operator Details',
            'Date',
            'VIN',
            'en',
        );

        expect(request.kind).toBe('infringementLetter');
        expect(request.companyName).toBe('Acme Transport');
        expect(request.driverName).toBe('Jane Doe');
        expect(request.footerNotice).toBe(labels.qualification);
        expect(request.infringements).toEqual([
            {
                allowed: '9h 00m',
                category: 'Daily driving limit exceeded',
                dateTime: '2026-08-20 14:30',
                description: 'Daily driving limit exceeded',
                excess: '+1h 15m',
                index: 1,
                legalReference: 'Reg (EC) 561/2006 Art. 6(1)',
                measured: '10h 15m',
                severity: 'Serious',
            },
        ]);
        expect(decodePdfDocumentRequest(request)).toEqual({ ok: true, value: request });
    });

    it('carries the explanation typed in the dialog into the letter request', () => {
        const model = { ...createLetterModel(), driverExplanation: 'Road closed near Graz.\nWaited for police.' };

        const request = createInfringementLetterPdfRequest(
            model,
            createLetterLabels(),
            () => 'Serious',
            'Operator Details',
            'Date',
            'VIN',
            'en',
        );

        expect(request.driverComments).toBe('Road closed near Graz.\nWaited for police.');
    });

    it('builds a typed attestation request that passes the boundary decoder', () => {
        const model = createAttestationModel();
        const labels = createAttestationLabels();

        const request = createAttestationFormPdfRequest(model, labels, 'en');

        expect(request.kind).toBe('attestationForm');
        expect(request.companyAddress).toBe('Hauptstr. 1, 10115 Berlin, Germany');
        expect(request.companyName).toBe('Acme Transport');
        expect(request.signatoryName).toBe('Max Mustermann');
        expect(request.reasonKey).toBe('annualLeave');
        expect(request.periodStart).toBe('01.08.2026 00:00');
        expect(decodePdfDocumentRequest(request)).toEqual({ ok: true, value: request });
    });

    it('carries the translated signature-block text instead of printing English in the native engine', () => {
        const labels = createAttestationLabels();

        const request = createAttestationFormPdfRequest(createAttestationModel(), labels, 'en');

        expect(request.undersignedLabel).toBe(labels.undersigned);
        expect(request.dateLabel).toBe(labels.date);
        expect(request.signatureLabel).toBe(labels.signature);
        expect(request.driverSignatureLabel).toBe(labels.driverSignature);
    });
});
