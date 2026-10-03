import { escapeHtml } from '#contracts';
import type { IInfringementLetterViewModel } from './infringement-letter-view-model.js';
import type { IAttestationFormViewModel } from './attestation-form-view-model.js';

export interface IInfringementLetterExportLabels {
    readonly auditPeriod: string;
    readonly cardNumber: string;
    readonly colAllowed: string;
    readonly colDateTime: string;
    readonly colDescription: string;
    readonly colExcess: string;
    readonly colMeasured: string;
    readonly colNum: string;
    readonly colSeverity: string;
    // Used by the PDF signature block only.
    readonly date: string;
    readonly dateAndSignature: string;
    readonly driver: string;
    readonly driverAckText: string;
    readonly driverExplanation: string;
    readonly driverSignature: string;
    readonly file: string;
    readonly generated: string;
    readonly managerSignature: string;
    readonly qualification: string;
    readonly severityMinor: string;
    readonly severityMostSerious: string;
    readonly severitySerious: string;
    readonly severityVerySerious: string;
    readonly statement: string;
    readonly title: string;
    readonly totalInfringements: string;
    readonly vehicle: string;
    // Used by the PDF vehicle block only.
    readonly vin: string;
}

export interface IAttestationFormExportLabels {
    readonly date: string;
    readonly declareDriver: string;
    readonly driverSignature: string;
    readonly footnote1: string;
    readonly footnote2: string;
    readonly footnote3: string;
    readonly forPeriod: string;
    readonly item1_undertaking: string;
    readonly item2_address: string;
    readonly item3_tel: string;
    readonly item4_fax: string;
    readonly item5_email: string;
    readonly item6_name: string;
    readonly item7_position: string;
    readonly item8_driverName: string;
    readonly item9_birthDate: string;
    readonly item10_licence: string;
    readonly item11_employmentDate: string;
    readonly item12_from: string;
    readonly item13_to: string;
    readonly item14_sickLeave: string;
    readonly item15_annualLeave: string;
    readonly item16_leaveOrRest: string;
    readonly item17_outOfScope: string;
    readonly item18_otherWork: string;
    readonly item19_available: string;
    readonly item20_place: string;
    readonly item21_driverConfirm: string;
    readonly item22_place: string;
    readonly officialAnnex: string;
    readonly officialInstruction: string;
    readonly officialRegulation: string;
    readonly officialTitle: string;
    readonly officialWarning: string;
    readonly partUndertaking: string;
    readonly signature: string;
    readonly undersigned: string;
}

const INFRINGEMENT_LETTER_STYLES = `
        @page {
            size: A4 portrait;
            margin: 15mm 15mm 20mm 15mm;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            background: #ffffff;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            line-height: 1.5;
            max-width: 210mm;
            box-sizing: border-box;
        }
        *,
        *::before,
        *::after {
            box-sizing: border-box;
        }
        .header {
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 16px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
        }
        .company-info h1 {
            font-size: 18px;
            margin: 0 0 4px 0;
            color: #1f2937;
        }
        .meta-box {
            text-align: right;
            font-size: 12px;
            color: #4b5563;
        }
        .letter-title {
            text-align: center;
            font-size: 16px;
            font-weight: 700;
            margin: 20px 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #111827;
        }
        .driver-details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 20px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
        }
        .detail-label {
            color: #6b7280;
            font-weight: 500;
        }
        .detail-val {
            font-weight: 600;
            color: #111827;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            font-size: 12px;
            table-layout: fixed;
        }
        th, td {
            border: 1px solid #d1d5db;
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
            overflow-wrap: anywhere;
        }
        th {
            background-color: #f3f4f6;
            font-weight: 600;
            color: #374151;
        }
        th.num, td.num {
            text-align: center;
            font-weight: 600;
            white-space: nowrap;
            padding: 8px 4px;
        }
        td.date-time { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        td.excess { font-weight: 700; color: #dc2626; }
        .legal-ref { font-size: 11px; color: #4b5563; overflow-wrap: anywhere; }
        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .badge-minor { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .badge-serious { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
        .badge-verySerious { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .badge-mostSerious { background: #7f1d1d; color: #fff1f1; border: 1px solid #601515; }
        .statement-text {
            font-size: 12px;
            color: #374151;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .qualification-notice {
            background: #f8f9fa;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            color: #4b5563;
            font-size: 11px;
            line-height: 1.4;
            margin-bottom: 16px;
            padding: 9px 11px;
        }
        .explanation-box {
            border: 1px dashed #9ca3af;
            border-radius: 6px;
            min-height: 70px;
            margin-bottom: 24px;
            padding: 8px 12px;
            background: #fafafa;
        }
        .explanation-title {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            margin-bottom: 4px;
        }
        .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            margin-top: 30px;
        }
        .sig-block {
            border-top: 1px solid #111827;
            padding-top: 8px;
        }
        .sig-title {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 4px;
        }
        .sig-date {
            font-size: 11px;
            color: #6b7280;
        }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
`;

export function generateInfringementLetterHtml(
    model: IInfringementLetterViewModel,
    labels: IInfringementLetterExportLabels,
    locale: string,
): string {
    const letterTitle = labels.title;
    const generatedLabel = labels.generated;
    const auditPeriodLabel = labels.auditPeriod;
    const totalInfringementsLabel = labels.totalInfringements;
    const driverLabel = labels.driver;
    const cardLabel = labels.cardNumber;
    const vehicleLabel = labels.vehicle;
    const fileLabel = labels.file;
    const statementText = labels.statement;
    const colNum = labels.colNum;
    const colDateTime = labels.colDateTime;
    const colDescription = labels.colDescription;
    const colSeverity = labels.colSeverity;
    const colMeasured = labels.colMeasured;
    const colAllowed = labels.colAllowed;
    const colExcess = labels.colExcess;
    const explanationTitle = labels.driverExplanation;
    const driverSignatureLabel = labels.driverSignature;
    const driverAckText = labels.driverAckText;
    const managerSignatureLabel = labels.managerSignature;
    const qualification = labels.qualification;
    const dateAndSigText = labels.dateAndSignature;
    const severityLabels = {
        minor: labels.severityMinor,
        mostSerious: labels.severityMostSerious,
        serious: labels.severitySerious,
        verySerious: labels.severityVerySerious,
    } as const;

    const infringementRows = model.items
        .map(
            (item, index) => `
        <tr>
            <td class="num">${String(index + 1)}</td>
            <td class="date-time">${escapeHtml(item.dateTimeDisplay)}</td>
            <td>
                <strong>${escapeHtml(item.title)}</strong><br>
                <span class="legal-ref">${escapeHtml(item.legalReference)}</span>
            </td>
            <td><span class="badge badge-${item.severity}">${escapeHtml(severityLabels[item.severity])}</span></td>
            <td>${escapeHtml(item.measuredValue)}</td>
            <td>${escapeHtml(item.allowedValue)}</td>
            <td class="excess">${escapeHtml(item.excess)}</td>
        </tr>`,
        )
        .join('');

    return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(letterTitle)} - ${escapeHtml(model.driverName)}</title>
    <style>${INFRINGEMENT_LETTER_STYLES}</style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h1>${escapeHtml(model.company.companyName)}</h1>
            <div>${escapeHtml(model.company.address)}</div>
            <div>${escapeHtml(model.company.vatOrRegistration)}</div>
        </div>
        <div class="meta-box">
            <div><strong>${escapeHtml(generatedLabel)}</strong> ${escapeHtml(model.generatedAt)}</div>
            <div><strong>${escapeHtml(auditPeriodLabel)}</strong> ${escapeHtml(model.auditPeriod)}</div>
            <div><strong>${escapeHtml(totalInfringementsLabel)}</strong> ${String(model.totalInfringements)}</div>
        </div>
    </div>

    <div class="letter-title">${escapeHtml(letterTitle)}</div>

    <div class="driver-details-grid">
        <div class="detail-row">
            <span class="detail-label">${escapeHtml(driverLabel)}</span>
            <span class="detail-val">${escapeHtml(model.driverName)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">${escapeHtml(cardLabel)}</span>
            <span class="detail-val">${escapeHtml(model.cardNumber)} (${escapeHtml(model.issuingMemberState)})</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">${escapeHtml(vehicleLabel)}</span>
            <span class="detail-val">${escapeHtml(model.vehicleRegistration ?? '—')}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">${escapeHtml(fileLabel)}</span>
            <span class="detail-val">${escapeHtml(model.fileName)}</span>
        </div>
    </div>

    <div class="qualification-notice">${escapeHtml(qualification)}</div>

    <p class="statement-text">
        ${escapeHtml(statementText)}
    </p>

    <table>
        <thead>
            <tr>
                <th class="num" style="width: 44px;">${escapeHtml(colNum)}</th>
                <th style="width: 105px;">${escapeHtml(colDateTime)}</th>
                <th>${escapeHtml(colDescription)}</th>
                <th style="width: 95px;">${escapeHtml(colSeverity)}</th>
                <th style="width: 75px;">${escapeHtml(colMeasured)}</th>
                <th style="width: 75px;">${escapeHtml(colAllowed)}</th>
                <th style="width: 75px;">${escapeHtml(colExcess)}</th>
            </tr>
        </thead>
        <tbody>
            ${infringementRows}
        </tbody>
    </table>

    <div class="explanation-box">
        <div class="explanation-title">${escapeHtml(explanationTitle)}</div>
        ${model.driverExplanation.length > 0 ? `<div class="explanation-text">${escapeHtml(model.driverExplanation)}</div>` : ''}
    </div>

    <div class="signature-grid">
        <div class="sig-block">
            <div class="sig-title">${escapeHtml(driverSignatureLabel)}</div>
            <div>${escapeHtml(driverAckText)}</div>
            <div style="margin-top: 30px;" class="sig-date">${escapeHtml(dateAndSigText)}</div>
        </div>
        <div class="sig-block">
            <div class="sig-title">${escapeHtml(managerSignatureLabel)}</div>
            <div>${escapeHtml(model.company.managerName)}</div>
            <div style="margin-top: 30px;" class="sig-date">${escapeHtml(dateAndSigText)}</div>
        </div>
    </div>
</body>
</html>`;
}

const ATTESTATION_FORM_STYLES = `
        @page {
            size: A4 portrait;
            margin: 15mm 20mm;
        }
        * {
            box-sizing: border-box;
        }
        body {
            font-family: "Times New Roman", Times, Georgia, serif;
            color: #000000;
            background: #ffffff;
            margin: 0 auto;
            padding: 15px 25px;
            font-size: 10pt;
            line-height: 1.35;
            max-width: 210mm;
        }
        .annex {
            text-align: center;
            font-weight: bold;
            text-decoration: underline;
            font-size: 11pt;
            margin-bottom: 3px;
        }
        .main-title {
            text-align: center;
            font-weight: bold;
            font-size: 12pt;
            margin: 2px 0;
            text-transform: uppercase;
        }
        .reg-subtitle {
            text-align: center;
            font-size: 9.5pt;
            margin: 2px 0;
        }
        .instruction-notice {
            text-align: center;
            font-style: italic;
            font-size: 8.5pt;
            margin: 6px 0 2px 0;
            line-height: 1.25;
        }
        .warning-notice {
            text-align: center;
            font-weight: bold;
            font-size: 9pt;
            margin: 2px 0 10px 0;
            text-transform: uppercase;
        }
        .undertaking-box {
            border: 1.5px solid #000000;
            padding: 8px 12px;
            margin-bottom: 10px;
        }
        .section-heading {
            font-weight: bold;
            margin: 6px 0 3px 0;
        }
        .section-heading:first-child {
            margin-top: 0;
        }
        .form-row {
            margin: 2.5px 0;
            display: flex;
            align-items: baseline;
            flex-wrap: wrap;
        }
        .form-label {
            font-size: 10pt;
        }
        .form-value {
            font-weight: normal;
            text-decoration: underline;
            padding: 0 4px;
        }
        .checkbox-item {
            margin: 2.5px 0;
            display: flex;
            align-items: center;
            font-size: 10pt;
        }
        .cb-square {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 13px;
            height: 13px;
            border: 1.5px solid #000000;
            margin-right: 8px;
            font-family: Arial, sans-serif;
            font-size: 10px;
            font-weight: bold;
            line-height: 1;
            flex-shrink: 0;
        }
        .sig-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 8px;
        }
        .sig-line-block {
            min-width: 240px;
            border-bottom: 1px dotted #000000;
            height: 16px;
        }
        .driver-box {
            margin-top: 6px;
        }
        .driver-confirm {
            font-size: 9.5pt;
            line-height: 1.3;
            margin-bottom: 6px;
        }
        .footnotes-section {
            margin-top: 14px;
            padding-top: 6px;
            border-top: 0.5px solid #666666;
            font-size: 7.5pt;
            color: #333333;
            line-height: 1.25;
        }
        @media print {
            body {
                padding: 0;
                margin: 0;
            }
            .undertaking-box {
                border: 1.5px solid #000000 !important;
            }
        }
`;

export function generateAttestationFormHtml(
    model: IAttestationFormViewModel,
    labels: IAttestationFormExportLabels,
    locale: string,
): string {
    const annexTitle = labels.officialAnnex;
    const mainTitle = labels.officialTitle;
    const regSubtitle = labels.officialRegulation;
    const instructionNotice = labels.officialInstruction;
    const warningNotice = labels.officialWarning;
    const partUndertaking = labels.partUndertaking;
    const item1 = labels.item1_undertaking;
    const item2 = labels.item2_address;
    const item3 = labels.item3_tel;
    const item4 = labels.item4_fax;
    const item5 = labels.item5_email;
    const undersigned = labels.undersigned;
    const item6 = labels.item6_name;
    const item7 = labels.item7_position;
    const declareDriver = labels.declareDriver;
    const item8 = labels.item8_driverName;
    const item9 = labels.item9_birthDate;
    const item10 = labels.item10_licence;
    const item11 = labels.item11_employmentDate;
    const forPeriod = labels.forPeriod;
    const item12 = labels.item12_from;
    const item13 = labels.item13_to;
    const item14 = labels.item14_sickLeave;
    const item15 = labels.item15_annualLeave;
    const item16 = labels.item16_leaveOrRest;
    const item17 = labels.item17_outOfScope;
    const item18 = labels.item18_otherWork;
    const item19 = labels.item19_available;
    const item20Place = labels.item20_place;
    const dateLabel = labels.date;
    const signatureLabel = labels.signature;
    const item21DriverConfirm = labels.item21_driverConfirm;
    const item22Place = labels.item22_place;
    const driverSignatureLabel = labels.driverSignature;
    const footnote1 = labels.footnote1;
    const footnote2 = labels.footnote2;
    const footnote3 = labels.footnote3;

    return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(mainTitle)}</title>
    <style>${ATTESTATION_FORM_STYLES}</style>
</head>
<body>
    <div class="annex">${escapeHtml(annexTitle)}</div>
    <div class="main-title">${escapeHtml(mainTitle)}</div>
    <div class="reg-subtitle">${escapeHtml(regSubtitle)}</div>
    <div class="instruction-notice">${escapeHtml(instructionNotice)}</div>
    <div class="warning-notice">${escapeHtml(warningNotice)}</div>

    <div class="undertaking-box">
        <div class="section-heading">${escapeHtml(partUndertaking)}</div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item1)}</span>
            <span class="form-value">${escapeHtml(model.companyName)}</span>
        </div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item2)}</span>
            <span class="form-value">${escapeHtml(model.companyStreet)}, ${escapeHtml(model.companyPostalCode)}, ${escapeHtml(model.companyCity)}, ${escapeHtml(model.companyCountry)}</span>
        </div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item3)}</span>
            <span class="form-value">${escapeHtml(model.companyTelephone)}</span>
        </div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item4)}</span>
            <span class="form-value">${escapeHtml(model.companyFax)}</span>
        </div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item5)}</span>
            <span class="form-value">${escapeHtml(model.companyEmail)}</span>
        </div>

        <div class="section-heading">${escapeHtml(undersigned)}</div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item6)}</span>
            <span class="form-value">${escapeHtml(model.managerName)}</span>
        </div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item7)}</span>
            <span class="form-value">${escapeHtml(model.managerPosition)}</span>
        </div>

        <div class="section-heading">${escapeHtml(declareDriver)}</div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item8)}</span>
            <span class="form-value">${escapeHtml(model.driverName)}</span>
        </div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item9)}</span>
            <span class="form-value">${escapeHtml(model.driverBirthDate)}</span>
        </div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item10)}</span>
            <span class="form-value">${escapeHtml(model.driverLicenceOrId)}</span>
        </div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item11)}</span>
            <span class="form-value">${escapeHtml(model.driverEmploymentDate)}</span>
        </div>

        <div class="section-heading">${escapeHtml(forPeriod)}</div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item12)}</span>
            <span class="form-value">${escapeHtml(model.periodFromFormatted)}</span>
        </div>
        <div class="form-row">
            <span class="form-label">${escapeHtml(item13)}</span>
            <span class="form-value">${escapeHtml(model.periodToFormatted)}</span>
        </div>

        <div style="margin-top: 6px;">
            <div class="checkbox-item">
                <span class="form-label" style="width: 22px;">14.</span>
                <span class="cb-square">${model.box14_sickLeave ? '&#10003;' : '&nbsp;'}</span>
                <span>${escapeHtml(item14.replace(/^\d+\.\s*/, ''))}</span>
            </div>
            <div class="checkbox-item">
                <span class="form-label" style="width: 22px;">15.</span>
                <span class="cb-square">${model.box15_annualLeave ? '&#10003;' : '&nbsp;'}</span>
                <span>${escapeHtml(item15.replace(/^\d+\.\s*/, ''))}</span>
            </div>
            <div class="checkbox-item">
                <span class="form-label" style="width: 22px;">16.</span>
                <span class="cb-square">${model.box16_leaveOrRest ? '&#10003;' : '&nbsp;'}</span>
                <span>${escapeHtml(item16.replace(/^\d+\.\s*/, ''))}</span>
            </div>
            <div class="checkbox-item">
                <span class="form-label" style="width: 22px;">17.</span>
                <span class="cb-square">${model.box17_outOfScope ? '&#10003;' : '&nbsp;'}</span>
                <span>${escapeHtml(item17.replace(/^\d+\.\s*/, ''))}</span>
            </div>
            <div class="checkbox-item">
                <span class="form-label" style="width: 22px;">18.</span>
                <span class="cb-square">${model.box18_otherWork ? '&#10003;' : '&nbsp;'}</span>
                <span>${escapeHtml(item18.replace(/^\d+\.\s*/, ''))}</span>
            </div>
            <div class="checkbox-item">
                <span class="form-label" style="width: 22px;">19.</span>
                <span class="cb-square">${model.box19_available ? '&#10003;' : '&nbsp;'}</span>
                <span>${escapeHtml(item19.replace(/^\d+\.\s*/, ''))}</span>
            </div>
        </div>

        <div class="sig-row">
            <div>
                <span class="form-label">${escapeHtml(item20Place)}</span> <span class="form-value">${escapeHtml(model.companyCity)}</span>
                <span class="form-label" style="margin-left: 14px;">${escapeHtml(dateLabel)}</span> <span class="form-value">${escapeHtml(model.dateFormatted)}</span>
            </div>
            <div>
                <span class="form-label">${escapeHtml(signatureLabel)}</span>
                <div class="sig-line-block"></div>
            </div>
        </div>
    </div>

    <div class="driver-box">
        <div class="driver-confirm">
            <strong>${escapeHtml(item21DriverConfirm)}</strong>
        </div>
        <div class="sig-row">
            <div>
                <span class="form-label">${escapeHtml(item22Place)}</span> <span class="form-value">${escapeHtml(model.companyCity)}</span>
                <span class="form-label" style="margin-left: 14px;">${escapeHtml(dateLabel)}</span> <span class="form-value">${escapeHtml(model.dateFormatted)}</span>
            </div>
            <div>
                <span class="form-label">${escapeHtml(driverSignatureLabel)}</span>
                <div class="sig-line-block"></div>
            </div>
        </div>
    </div>

    <div class="footnotes-section">
        <div>${escapeHtml(footnote1)}</div>
        <div>${escapeHtml(footnote2)}</div>
        <div>${escapeHtml(footnote3)}</div>
    </div>
</body>
</html>`;
}
