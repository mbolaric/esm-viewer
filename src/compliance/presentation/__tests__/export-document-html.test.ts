import { describe, expect, it } from 'vitest';
import type { IInfringementLetterViewModel } from '../infringement-letter-view-model.js';
import type { IAttestationFormViewModel } from '../attestation-form-view-model.js';
import { generateAttestationFormHtml, generateInfringementLetterHtml } from '../export-document-html.js';
import { isUtcTimestamp, type UtcTimestamp } from '#tachograph-domain';
import { englishAttestationExportLabels, englishLetterExportLabels } from './export-labels-fixture.js';

function utc(v: number): UtcTimestamp {
    if (!isUtcTimestamp(v)) {
        throw new TypeError('Invalid utc');
    }
    return v;
}

describe('Export Document HTML Generators', () => {
    it('generates self-contained HTML for Driver Infringement Letter with print media CSS', () => {
        const letterModel: IInfringementLetterViewModel = {
            auditPeriod: '01.07.2026 – 28.07.2026',
            cardNumber: 'D1234567890',
            company: {
                address: 'Logistics Park 5, Frankfurt',
                companyName: 'Trans-Euro Spedition GmbH',
                managerName: 'Klaus Fischer',
                vatOrRegistration: 'DE123456789',
            },
            driverName: 'Mustermann Max',
            driverExplanation: 'Roadworks on A3 caused a 20-minute delay.',
            fileName: 'driver.ddd',
            generatedAt: '28.07.2026 14:00',
            issuingMemberState: 'DE',
            items: [
                {
                    allowedValue: '4h 30m',
                    dateTimeDisplay: '15.07.2026 14:30',
                    excess: '+45m',
                    legalReference: 'Reg (EC) 561/2006 Art. 7',
                    measuredValue: '5h 15m',
                    ruleId: 'BREAK_CONTINUOUS_DRIVING',
                    severity: 'minor',
                    sourcePointer: '/driverActivityData/0',
                    timestamp: utc(1700000000000),
                    title: 'Continuous driving without 45m break',
                },
            ],
            minorCount: 1,
            mostSeriousCount: 0,
            seriousCount: 0,
            totalInfringements: 1,
            vehicleRegistration: 'F-TR 1000',
            verySeriousCount: 0,
            vin: 'WDB9634031L123456',
        };

        const html = generateInfringementLetterHtml(
            letterModel,
            {
                ...englishLetterExportLabels,
                qualification: 'Viewer calculation — not a certified <legal> assessment & requires review.',
            },
            'en',
        );

        expect(html).toContain('Trans-Euro Spedition GmbH');
        expect(html).toContain('Mustermann Max');
        expect(html).toContain('D1234567890');
        expect(html).toContain('Continuous driving without 45m break');
        expect(html).toContain('+45m');
        expect(html).toContain('@media print');
        expect(html).toContain('Klaus Fischer');
        expect(html).toContain('Roadworks on A3 caused a 20-minute delay.');
        expect(html).toContain('Viewer calculation — not a certified &lt;legal&gt; assessment &amp; requires review.');
        expect(html).not.toContain('<legal>');
    });

    it('generates official 21-point Commission Decision 2009/959/EU Attestation HTML', () => {
        const attestationModel: IAttestationFormViewModel = {
            box14_sickLeave: true,
            box15_annualLeave: false,
            box16_leaveOrRest: false,
            box17_outOfScope: false,
            box18_otherWork: false,
            box19_available: false,
            companyCity: 'Hamburg',
            companyCountry: 'DE',
            companyEmail: 'ops@eurotrans.de',
            companyFax: '',
            companyName: 'EuroTrans Logistics',
            companyPostalCode: '20095',
            companyStreet: 'Hafenstr. 12',
            companyTelephone: '+49 40 123456',
            dateFormatted: '28.07.2026',
            driverBirthDate: '15.05.1985',
            driverCardNumber: 'D987654321',
            driverEmploymentDate: '01.03.2021',
            driverLicenceOrId: 'DL-998877',
            driverName: 'Schmidt Hans',
            generatedAt: '28.07.2026 14:30',
            managerName: 'Klaus Weber',
            managerPosition: 'Compliance Manager',
            periodFromFormatted: '01.07.2026 08:00',
            periodToFormatted: '05.07.2026 18:00',
            reason: 'sickLeave',
        };

        const html = generateAttestationFormHtml(attestationModel, englishAttestationExportLabels, 'en');

        expect(html).toContain('ATTESTATION OF ACTIVITIES');
        expect(html).toContain('EuroTrans Logistics');
        expect(html).toContain('Schmidt Hans');
        expect(html).toContain('was on sick leave');
        expect(html).toContain('&#10003;'); // Checked box symbol
        expect(html).toContain('Klaus Weber');
    });

    it('generates fully localized German HTML when German translations are supplied', () => {
        const attestationModel: IAttestationFormViewModel = {
            box14_sickLeave: false,
            box15_annualLeave: true,
            box16_leaveOrRest: false,
            box17_outOfScope: false,
            box18_otherWork: false,
            box19_available: false,
            companyCity: 'München',
            companyCountry: 'Deutschland',
            companyEmail: 'info@bayern-trans.de',
            companyFax: '+49 89 123456',
            companyName: 'Bayern Trans GmbH',
            companyPostalCode: '80331',
            companyStreet: 'Marienplatz 1',
            companyTelephone: '+49 89 654321',
            dateFormatted: '28.07.2026',
            driverBirthDate: '15.05.1980',
            driverCardNumber: 'D987654321',
            driverEmploymentDate: '01.01.2020',
            driverLicenceOrId: 'B1234567',
            driverName: 'Huber Franz',
            generatedAt: '28.07.2026 12:00',
            managerName: 'Josef Meier',
            managerPosition: 'Verkehrsleiter',
            periodFromFormatted: '01.07.2026 00:00',
            periodToFormatted: '14.07.2026 23:59',
            reason: 'annualLeave',
        };

        const deLabels = {
            item15_annualLeave: '15. Befand sich im Erholungsurlaub***',
            officialAnnex: 'ANHANG',
            officialTitle: 'BESCHEINIGUNG VON TÄTIGKEITEN (1)',
            partUndertaking: 'Vom Unternehmen auszufüllender Teil',
        };

        const html = generateAttestationFormHtml(attestationModel, { ...englishAttestationExportLabels, ...deLabels }, 'de');

        expect(html).toContain('lang="de"');
        expect(html).toContain('BESCHEINIGUNG VON TÄTIGKEITEN (1)');
        expect(html).toContain('ANHANG');
        expect(html).toContain('Vom Unternehmen auszufüllender Teil');
        expect(html).toContain('Befand sich im Erholungsurlaub');
    });
});
