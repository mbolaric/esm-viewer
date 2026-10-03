import { err, ok, type Result } from './result.js';
import {
    arrayOf,
    boundedString,
    exactRecord,
    isNonNegativeSafeInteger,
    isString,
    literal,
    nullable,
    type Guard,
} from './unknown-value.js';

// Typed IPC DTO for native PDF generation, validated at the invoke boundary.
export type PdfDocumentRequestDecodeError = 'invalidPdfDocumentRequest';

export interface IInfringementItemDto {
    readonly allowed: string;
    readonly category: string;
    readonly dateTime: string;
    readonly description: string;
    readonly excess: string;
    readonly index: number;
    readonly legalReference: string;
    readonly measured: string;
    readonly severity: string;
}

export interface IInfringementLetterPdfRequest {
    readonly allowedHeader: string;
    readonly cardNumber: string;
    readonly cardNumberLabel: string;
    readonly categoryHeader: string;
    readonly companyAddress: string;
    readonly companyDetailsTitle: string;
    readonly companyName: string;
    readonly datePrinted: string;
    readonly datePrintedLabel: string;
    readonly dateSignatureLabel: string;
    readonly dateTimeHeader: string;
    readonly descriptionHeader: string;
    readonly driverComments: string;
    readonly driverCommentsTitle: string;
    readonly driverDeclarationText: string;
    readonly driverDetailsTitle: string;
    readonly driverName: string;
    readonly driverNameLabel: string;
    readonly driverSignatureLabel: string;
    readonly excessHeader: string;
    readonly fileLabel: string;
    readonly fileName: string;
    readonly footerNotice: string;
    readonly infringements: readonly IInfringementItemDto[];
    readonly introText: string;
    readonly issuingCountry: string;
    readonly issuingCountryLabel: string;
    readonly kind: 'infringementLetter';
    readonly locale: string;
    readonly measuredHeader: string;
    readonly numHeader: string;
    readonly operatorSignatureLabel: string;
    readonly severityHeader: string;
    readonly title: string;
    readonly totalInfringementsLabel: string;
    readonly vehicleLabel: string;
    readonly vehicleRegistration: string;
    readonly vin: string;
    readonly vinLabel: string;
}

export interface IAttestationFormPdfRequest {
    readonly box10Label: string;
    readonly box11Label: string;
    readonly box12Label: string;
    readonly box13Label: string;
    readonly box14Label: string;
    readonly box15Label: string;
    readonly box16Label: string;
    readonly box17Label: string;
    readonly box18Label: string;
    readonly box19Label: string;
    readonly box1Label: string;
    readonly box20Label: string;
    readonly box21Label: string;
    readonly box22Label: string;
    readonly box2Label: string;
    readonly box3Label: string;
    readonly box4Label: string;
    readonly box5Label: string;
    readonly box6Label: string;
    readonly box7Label: string;
    readonly box8Label: string;
    readonly box9Label: string;
    readonly companyAddress: string;
    readonly companyEmail: string;
    readonly companyFax: string;
    readonly companyName: string;
    readonly companyPhone: string;
    readonly date: string;
    readonly dateLabel: string;
    readonly driverDob: string;
    readonly driverName: string;
    readonly driverPartTitle: string;
    readonly driverSignatureLabel: string;
    readonly drivingLicence: string;
    readonly employmentStart: string;
    readonly footnote: string;
    readonly instructions: string;
    readonly kind: 'attestationForm';
    readonly locale: string;
    readonly periodEnd: string;
    readonly periodPartTitle: string;
    readonly periodStart: string;
    readonly place: string;
    readonly reasonKey: string;
    readonly signatoryName: string;
    readonly signatoryPosition: string;
    readonly signatureLabel: string;
    readonly subtitle: string;
    readonly title: string;
    readonly undersignedLabel: string;
    readonly undertakingPartTitle: string;
    readonly warning: string;
}

export interface IReportSummaryItemDto {
    readonly label: string;
    readonly value: string;
}

export interface IReportTableRowDto {
    readonly cells: readonly string[];
}

export interface IActivitySegmentDto {
    readonly activity: string;
    readonly timelineEndMs: number;
    readonly timelineStartMs: number;
}

export interface IActivityTimelineDayDto {
    readonly segments: readonly IActivitySegmentDto[];
    readonly totalMs: number;
}

export interface IReportTableSectionDto {
    readonly headers: readonly string[];
    readonly rows: readonly IReportTableRowDto[];
    readonly subtitle: string;
    readonly timeline: IActivityTimelineDayDto | null;
    readonly title: string;
}

export type PdfPageOrientation = 'landscape' | 'portrait';

export interface IFactualReportPdfRequest {
    readonly footerNotice: string;
    // Labelled facts in the framed header box (subject, identifier, period, generation time, ...), split across two
    // columns in order.
    readonly headerFields: readonly IReportSummaryItemDto[];
    readonly kind: 'factualReport';
    readonly locale: string;
    readonly orientation: PdfPageOrientation;
    readonly sections: readonly IReportTableSectionDto[];
    readonly subtitle: string;
    readonly summaryItems: readonly IReportSummaryItemDto[];
    readonly summaryTitle: string;
    readonly title: string;
}

export type IPdfDocumentRequest = IInfringementLetterPdfRequest | IAttestationFormPdfRequest | IFactualReportPdfRequest;

const maximumPdfRequestStringLength = 64 * 1024;
const maximumPdfRequestArrayEntries = 10_000;

// Content derived from parsed data or user input is length-capped; labels come from the i18n catalogue and are not.
const pdfText = boundedString(maximumPdfRequestStringLength);

function pdfArray<T>(guard: Guard<T>): Guard<readonly T[]> {
    return arrayOf(guard, maximumPdfRequestArrayEntries);
}

const isInfringementItem = exactRecord<IInfringementItemDto>({
    allowed: pdfText,
    category: pdfText,
    dateTime: pdfText,
    description: pdfText,
    excess: pdfText,
    index: isNonNegativeSafeInteger,
    legalReference: pdfText,
    measured: pdfText,
    severity: isString,
});

const isInfringementLetterRequest = exactRecord<IInfringementLetterPdfRequest>({
    allowedHeader: isString,
    cardNumber: pdfText,
    cardNumberLabel: isString,
    categoryHeader: isString,
    companyAddress: pdfText,
    companyDetailsTitle: isString,
    companyName: pdfText,
    datePrinted: pdfText,
    datePrintedLabel: isString,
    dateSignatureLabel: isString,
    dateTimeHeader: isString,
    descriptionHeader: isString,
    driverComments: isString,
    driverCommentsTitle: isString,
    driverDeclarationText: isString,
    driverDetailsTitle: isString,
    driverName: pdfText,
    driverNameLabel: isString,
    driverSignatureLabel: isString,
    excessHeader: isString,
    fileLabel: isString,
    fileName: pdfText,
    footerNotice: isString,
    infringements: pdfArray(isInfringementItem),
    introText: isString,
    issuingCountry: pdfText,
    issuingCountryLabel: isString,
    kind: literal('infringementLetter'),
    locale: isString,
    measuredHeader: isString,
    numHeader: isString,
    operatorSignatureLabel: isString,
    severityHeader: isString,
    title: isString,
    totalInfringementsLabel: isString,
    vehicleLabel: isString,
    vehicleRegistration: pdfText,
    vin: pdfText,
    vinLabel: isString,
});

const isAttestationFormRequest = exactRecord<IAttestationFormPdfRequest>({
    box10Label: isString,
    box11Label: isString,
    box12Label: isString,
    box13Label: isString,
    box14Label: isString,
    box15Label: isString,
    box16Label: isString,
    box17Label: isString,
    box18Label: isString,
    box19Label: isString,
    box1Label: isString,
    box20Label: isString,
    box21Label: isString,
    box22Label: isString,
    box2Label: isString,
    box3Label: isString,
    box4Label: isString,
    box5Label: isString,
    box6Label: isString,
    box7Label: isString,
    box8Label: isString,
    box9Label: isString,
    companyAddress: pdfText,
    companyEmail: pdfText,
    companyFax: pdfText,
    companyName: pdfText,
    companyPhone: pdfText,
    date: pdfText,
    dateLabel: isString,
    driverDob: pdfText,
    driverName: pdfText,
    driverPartTitle: isString,
    driverSignatureLabel: isString,
    drivingLicence: pdfText,
    employmentStart: pdfText,
    footnote: isString,
    instructions: isString,
    kind: literal('attestationForm'),
    locale: isString,
    periodEnd: pdfText,
    periodPartTitle: isString,
    periodStart: pdfText,
    place: pdfText,
    reasonKey: pdfText,
    signatoryName: pdfText,
    signatoryPosition: pdfText,
    signatureLabel: isString,
    subtitle: isString,
    title: isString,
    undersignedLabel: isString,
    undertakingPartTitle: isString,
    warning: isString,
});

const isReportSummaryItem = exactRecord<IReportSummaryItemDto>({ label: pdfText, value: pdfText });

const isActivityTimeline = exactRecord<IActivityTimelineDayDto>({
    segments: pdfArray(
        exactRecord<IActivitySegmentDto>({
            activity: pdfText,
            timelineEndMs: isNonNegativeSafeInteger,
            timelineStartMs: isNonNegativeSafeInteger,
        }),
    ),
    totalMs: isNonNegativeSafeInteger,
});

const isReportSection = exactRecord<IReportTableSectionDto>({
    headers: pdfArray(pdfText),
    rows: pdfArray(exactRecord<IReportTableRowDto>({ cells: pdfArray(pdfText) })),
    subtitle: pdfText,
    timeline: nullable(isActivityTimeline),
    title: pdfText,
});

const isFactualReportRequest = exactRecord<IFactualReportPdfRequest>({
    footerNotice: isString,
    headerFields: pdfArray(isReportSummaryItem),
    kind: literal('factualReport'),
    locale: isString,
    orientation: literal('landscape', 'portrait'),
    sections: pdfArray(isReportSection),
    subtitle: pdfText,
    summaryItems: pdfArray(isReportSummaryItem),
    summaryTitle: isString,
    title: isString,
});

export function decodePdfDocumentRequest(value: unknown): Result<IPdfDocumentRequest, PdfDocumentRequestDecodeError> {
    return isInfringementLetterRequest(value) || isAttestationFormRequest(value) || isFactualReportRequest(value)
        ? ok(value)
        : err('invalidPdfDocumentRequest');
}
