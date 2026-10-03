import { describe, expect, it } from 'vitest';

import { expectInvalid, expectOk } from './result-assertions.js';
import {
    decodePdfDocumentRequest,
    type IAttestationFormPdfRequest,
    type IFactualReportPdfRequest,
    type IInfringementLetterPdfRequest,
} from '../index.js';

function createValidInfringementRequest(): IInfringementLetterPdfRequest {
    return {
        allowedHeader: 'Limit',
        cardNumber: 'DF1234567890',
        cardNumberLabel: 'Card Number',
        categoryHeader: 'Category',
        companyAddress: '1 Main Street',
        companyDetailsTitle: 'Operator',
        companyName: 'Acme Transport',
        datePrinted: '2026-08-28',
        datePrintedLabel: 'Printed',
        dateSignatureLabel: 'Date',
        dateTimeHeader: 'Date / Time',
        descriptionHeader: 'Description',
        driverComments: '',
        driverCommentsTitle: 'Driver statement',
        driverDeclarationText: 'I confirm receipt.',
        driverDetailsTitle: 'Driver Details',
        driverName: 'Jane Doe',
        driverNameLabel: 'Driver',
        driverSignatureLabel: 'Driver Signature',
        excessHeader: 'Excess',
        fileLabel: 'File',
        fileName: 'C_JANE_DOE.ddd',
        footerNotice: '',
        infringements: [
            {
                allowed: '9h 00m',
                category: 'Driving Time',
                dateTime: '2026-08-20 14:30',
                description: 'Daily driving limit exceeded',
                excess: '+1h 15m',
                index: 1,
                legalReference: 'Reg (EC) 561/2006 Art. 6(1)',
                measured: '10h 15m',
                severity: 'Serious',
            },
        ],
        introText: 'The following infringements were detected:',
        issuingCountry: 'DE',
        issuingCountryLabel: 'Card Number',
        kind: 'infringementLetter',
        locale: 'en',
        measuredHeader: 'Measured',
        numHeader: '#',
        operatorSignatureLabel: 'Operator Signature',
        severityHeader: 'Severity',
        title: 'Infringement Letter',
        totalInfringementsLabel: 'Total Infringements',
        vehicleLabel: 'Vehicle',
        vehicleRegistration: 'AB12 CDE',
        vin: 'WDB12345678901234',
        vinLabel: 'VIN',
    };
}

function createValidAttestationRequest(): IAttestationFormPdfRequest {
    return {
        box10Label: 'Driving licence',
        box11Label: 'Employment start',
        box12Label: 'From',
        box13Label: 'To',
        box14Label: 'Sick leave',
        box15Label: 'Annual leave',
        box16Label: 'Leave or rest',
        box17Label: 'Out of scope',
        box18Label: 'Other work',
        box19Label: 'Available',
        box1Label: 'Undertaking',
        box20Label: 'Place',
        box21Label: 'Signature of undertaking',
        box22Label: 'Signature of driver',
        box2Label: 'Address',
        box3Label: 'Telephone',
        box4Label: 'Fax',
        box5Label: 'E-mail',
        box6Label: 'Signatory',
        box7Label: 'Position',
        box8Label: 'Driver Name',
        box9Label: 'Date of birth',
        companyAddress: 'Hauptstr. 1, 10115 Berlin, Germany',
        companyEmail: 'office@acme.de',
        companyFax: '',
        companyName: 'Acme Transport',
        companyPhone: '+49 30 123456',
        dateLabel: 'Date:',
        driverSignatureLabel: 'Signature of the driver:',
        signatureLabel: 'Signature:',
        undersignedLabel: 'I, the undersigned:',
        date: '2026-08-28',
        driverDob: '1980-01-01',
        driverName: 'Jane Doe',
        driverPartTitle: 'Driver part',
        drivingLicence: 'DL123456',
        employmentStart: '2020-01-01',
        footnote: 'Footnote',
        instructions: 'Instructions',
        kind: 'attestationForm',
        locale: 'en',
        periodEnd: '2026-08-14 23:59',
        periodPartTitle: 'Period',
        periodStart: '2026-08-01 00:00',
        place: 'Berlin',
        reasonKey: 'annualLeave',
        signatoryName: 'Max Mustermann',
        signatoryPosition: 'Compliance Manager',
        subtitle: 'Regulation',
        title: 'Attestation',
        undertakingPartTitle: 'Undertaking part',
        warning: 'Warning',
    };
}

function createValidFactualReportRequest(): IFactualReportPdfRequest {
    return {
        footerNotice: 'Not a legal assessment',
        headerFields: [
            { label: 'Driver', value: 'Jane Doe' },
            { label: 'Card Number', value: 'DF123456' },
            { label: 'File', value: 'C_JANE_DOE.ddd' },
            { label: 'Generated', value: '2026-08-28 12:00' },
        ],
        kind: 'factualReport',
        locale: 'en',
        orientation: 'portrait',
        sections: [
            {
                headers: ['Date', 'Driving'],
                rows: [{ cells: ['2026-08-20', '08:30'] }],
                subtitle: 'Daily records',
                timeline: {
                    segments: [
                        {
                            activity: 'driving',
                            timelineEndMs: 45_000_000,
                            timelineStartMs: 28_800_000,
                        },
                    ],
                    totalMs: 86_400_000,
                },
                title: 'Daily Records',
            },
            {
                headers: ['Scope'],
                rows: [{ cells: ['Reported'] }],
                subtitle: '',
                timeline: null,
                title: 'Scope',
            },
        ],
        subtitle: 'Factual record',
        summaryItems: [{ label: 'Total Driving', value: '45h 12m' }],
        summaryTitle: 'Summary',
        title: 'Factual Technical Report',
    };
}

describe('decodePdfDocumentRequest', () => {
    it('decodes a valid infringement letter request', () => {
        const request = createValidInfringementRequest();
        expectOk(decodePdfDocumentRequest(request), request);
    });

    it('decodes a valid attestation form request', () => {
        const request = createValidAttestationRequest();
        expectOk(decodePdfDocumentRequest(request), request);
    });

    it('decodes a valid factual report request including nested sections and timelines', () => {
        const request = createValidFactualReportRequest();
        expectOk(decodePdfDocumentRequest(request), request);
    });

    it('accepts any number of factual report header fields, including none', () => {
        const request = { ...createValidFactualReportRequest(), headerFields: [] };
        expectOk(decodePdfDocumentRequest(request), request);
    });

    it('rejects the retired single-document header fields and malformed header entries', () => {
        const request = createValidFactualReportRequest();
        const retired: unknown = { ...request, cardOrVin: 'DF123456', cardOrVinLabel: 'Card Number' };
        const malformedEntry: unknown = { ...request, headerFields: [{ label: 'Driver' }] };

        expectInvalid(decodePdfDocumentRequest(retired), 'invalidPdfDocumentRequest');
        expectInvalid(decodePdfDocumentRequest(malformedEntry), 'invalidPdfDocumentRequest');
    });

    it('rejects a non-record payload', () => {
        expectInvalid(decodePdfDocumentRequest('attestationForm'), 'invalidPdfDocumentRequest');
        expectInvalid(decodePdfDocumentRequest(null), 'invalidPdfDocumentRequest');
    });

    it('rejects an unknown kind tag', () => {
        const request = { ...createValidAttestationRequest(), kind: 'legalOpinion' };
        expectInvalid(decodePdfDocumentRequest(request), 'invalidPdfDocumentRequest');
    });

    it('rejects a missing field', () => {
        const request = createValidAttestationRequest();
        const withoutBox1: Record<string, unknown> = { ...request };
        delete withoutBox1['box1Label'];

        expectInvalid(decodePdfDocumentRequest(withoutBox1), 'invalidPdfDocumentRequest');
    });

    it('rejects an extra field', () => {
        const request = { ...createValidInfringementRequest(), unexpected: 'extra' };
        expectInvalid(decodePdfDocumentRequest(request), 'invalidPdfDocumentRequest');
    });

    it('rejects a wrongly typed field', () => {
        const request = createValidFactualReportRequest();
        const malformed: unknown = {
            ...request,
            sections: [
                {
                    headers: ['Date'],
                    rows: [],
                    subtitle: '',
                    timeline: { segments: [], totalMs: 'not-a-number' },
                    title: 'Bad Timeline',
                },
            ],
        };

        expectInvalid(decodePdfDocumentRequest(malformed), 'invalidPdfDocumentRequest');
    });

    it('rejects a malformed nested infringement item', () => {
        const request = createValidInfringementRequest();
        const malformed = {
            ...request,
            infringements: [{ ...request.infringements[0], index: 'one' }],
        };

        expectInvalid(decodePdfDocumentRequest(malformed), 'invalidPdfDocumentRequest');
    });

    it('still rejects an oversized content field (driverName)', () => {
        const request = {
            ...createValidInfringementRequest(),
            driverName: 'x'.repeat(64 * 1024 + 1),
        };

        expectInvalid(decodePdfDocumentRequest(request), 'invalidPdfDocumentRequest');
    });

    it('accepts an oversized label field (title) since labels only trace to the i18n catalogue', () => {
        const request = {
            ...createValidInfringementRequest(),
            title: 'x'.repeat(64 * 1024 + 1),
        };

        const result = decodePdfDocumentRequest(request);

        expect(result.ok).toBe(true);
    });
});
