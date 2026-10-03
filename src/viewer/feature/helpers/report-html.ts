import { translateActivityKind, translateDocumentKind, translateGeneration, translateIntegrityStatus } from './viewer-labels.js';
import { activityIconSvg } from './activity-visual.js';
import {
    activityRecordTable,
    activityTotalEntries,
    associationTable,
    complianceSummaryText,
    complianceTable,
    eventFaultTable,
    identityGroups,
    integrityItemTable,
    integrityScopeTable,
    integritySummary,
    placesTable,
    reportLimitations,
    technicalReportRecords,
    type IReportTable,
    type ITechnicalReportRecord,
    type ReportCell,
    type ReportLine,
    type ViewerTranslationService,
} from './report-tables.js';
import { escapeHtml } from '#contracts';
import { ACTIVITY_KINDS, type DurationMilliseconds, type UtcTimestamp } from '#viewer-domain';
import type { ILocalisationService, ITranslationService } from '#localization';
import {
    createComparisonReportSections,
    type ComparisonPdfTranslationKey,
    type IActivityDayViewModel,
    type IExportReportViewModel,
    type IOpenedDocumentComparisonViewModel,
    type ITechnicalSectionViewModel,
} from '#viewer-presentation';

// Standalone HTML report: every section of the opened document with full evidence detail, styled for print.
function section(id: string, heading: string, content: string): string {
    return `<section id="${id}">\n<h2>${escapeHtml(heading)}</h2>\n${content}</section>`;
}

function dataTable(caption: string, headers: readonly string[], rows: readonly (readonly string[])[]): string {
    const headerCells = headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('');
    const bodyRows = rows
        .map(
            (row) =>
                `<tr>${row
                    .map((cell, index) => `${index === 0 ? '<th scope="row">' : '<td>'}${cell}${index === 0 ? '</th>' : '</td>'}`)
                    .join('')}</tr>`,
        )
        .join('');

    return `<table>\n<caption>${escapeHtml(caption)}</caption>\n<thead><tr>${headerCells}</tr></thead>\n<tbody>${bodyRows}</tbody>\n</table>`;
}

function htmlLine(line: ReportLine, missing: string): string {
    if (line === null) {
        return missing;
    }
    if (typeof line === 'string') {
        return escapeHtml(line);
    }
    const value = line.value === null ? missing : escapeHtml(line.value);
    const printed = line.code && line.value !== null ? `<code>${value}</code>` : value;
    return line.label === null ? printed : `<span class="cell-label">${escapeHtml(line.label)}</span> ${printed}`;
}

// Prints one report cell as HTML; `missing` (already escaped) stands in for values the document did not record.
// Cells with labelled lines print as stacked blocks, other multi-line cells as line breaks.
function htmlCell(cell: ReportCell, missing: string): string {
    if (cell === null) {
        return missing;
    }
    if (typeof cell === 'string') {
        return escapeHtml(cell);
    }
    if (cell.some((line) => line !== null && typeof line !== 'string')) {
        return `<span class="cell-stack">${cell
            .map((line) => `<span class="cell-block">${htmlLine(line, missing)}</span>`)
            .join('')}</span>`;
    }
    return cell.map((line) => htmlLine(line, missing)).join('<br>');
}

function htmlReportTable(table: IReportTable, translationService: ViewerTranslationService): string {
    const missing = escapeHtml(translationService.translate('overview.identity.missing'));
    return dataTable(
        table.caption,
        table.headers,
        table.rows.map((row) => row.cells.map((cell) => htmlCell(cell, missing))),
    );
}

function definitionList(entries: readonly (readonly [string, string])[]): string {
    const items = entries.map(([term, definition]) => `<div><dt>${escapeHtml(term)}</dt><dd>${definition}</dd></div>`).join('');
    return `<dl>${items}</dl>`;
}

const activityBandWidth = 800;
const activityBandTop = 14;
const activityBandHeight = 42;
const activityAxisOffset = 10;

function formatSvgNumber(value: number): string {
    return value.toFixed(2);
}

function activityBandSvg(day: IActivityDayViewModel, translationService: ViewerTranslationService): string {
    const t = translationService.translate.bind(translationService);
    const total = day.timelineEnd;
    if (total <= 0) {
        return '';
    }
    const axisY = activityBandTop + activityBandHeight + activityAxisOffset;
    const svgHeight = axisY + 20;
    const orderedRecords = [...day.records].sort((left, right) => left.timelineStart - right.timelineStart);
    const segments = orderedRecords
        .map((record) => {
            const duration = record.timelineEnd - record.timelineStart;
            const x = (record.timelineStart / total) * activityBandWidth;
            const width = Math.max(0.5, (duration / total) * activityBandWidth);
            const summary = [
                translateActivityKind(record.activity, translationService),
                record.start.display,
                record.end.display,
                record.duration.display,
            ].join(' · ');
            return `<rect class="band-${record.activity}" x="${formatSvgNumber(x)}" y="${String(activityBandTop)}" width="${formatSvgNumber(width)}" height="${String(activityBandHeight)}" rx="2"><title>${escapeHtml(summary)}</title></rect>`;
        })
        .join('');
    const ticks = day.timelineTicks
        .map((tick) => {
            const x = (tick.offset / total) * activityBandWidth;
            return `<g><line x1="${formatSvgNumber(x)}" x2="${formatSvgNumber(x)}" y1="${String(axisY)}" y2="${String(axisY + 4)}"/><text x="${formatSvgNumber(x)}" y="${String(axisY + 16)}" text-anchor="middle">${escapeHtml(tick.display)}</text></g>`;
        })
        .join('');
    return `<svg class="activity-band" viewBox="-16 0 832 ${String(svgHeight)}" role="img" aria-label="${escapeHtml(t('activities.timeline.heading'))} ${escapeHtml(day.date.display)}"><title>${escapeHtml(t('activities.timeline.heading'))} ${escapeHtml(day.date.display)}</title>${segments}<line class="band-axis" x1="0" x2="${String(activityBandWidth)}" y1="${String(axisY)}" y2="${String(axisY)}"/>${ticks}</svg>`;
}

function activityLegend(translationService: ViewerTranslationService): string {
    const items = ACTIVITY_KINDS.map(
        (activity) =>
            `<span class="activity-legend-item"><span class="legend-swatch swatch-${activity}" aria-hidden="true"></span>${escapeHtml(translateActivityKind(activity, translationService))}</span>`,
    ).join('');
    return `<div class="activity-legend">${items}</div>`;
}

function identitySection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string | null {
    const groups = identityGroups(viewModel, translationService);
    if (groups.length === 0) {
        return null;
    }

    const t = translationService.translate.bind(translationService);
    const missing = escapeHtml(t('overview.identity.missing'));
    const blocks = groups
        .map((group) =>
            definitionList([
                ...group.entries.map((entry) => [entry.label, htmlCell(entry.value, missing)] as const),
                [t('overview.identity.sourceReference'), escapeHtml(group.sourcePath)] as const,
            ]),
        )
        .join('\n');

    return section('identity', t('overview.identity.heading'), blocks);
}

function activityTotals(day: IActivityDayViewModel, translationService: ViewerTranslationService): string {
    const items = activityTotalEntries(day, translationService)
        .map(
            (entry) =>
                `<div class="activity-total-row">${activityIconSvg(entry.activity)}<span>${escapeHtml(
                    entry.label,
                )}</span><strong>${escapeHtml(entry.display)}</strong></div>`,
        )
        .join('');
    return `<div class="activity-totals">${items}</div>`;
}

function activitiesSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string | null {
    const t = translationService.translate.bind(translationService);
    const activities = viewModel.activities;
    if (!activities.ok || activities.viewModel === null) {
        return section(
            'activities',
            t('navigator.section.activities'),
            `<p>${escapeHtml(t('report.section.unavailableDescription'))}</p>`,
        );
    }
    if (activities.viewModel.days.length === 0) {
        return null;
    }

    const dayBlocks = activities.viewModel.days
        .map((day) => {
            const graph =
                day.records.length === 0
                    ? ''
                    : `<figure class="activity-graph"><figcaption>${escapeHtml(
                          t('activities.timeline.heading'),
                      )} — ${escapeHtml(day.date.display)}</figcaption>${activityBandSvg(
                          day,
                          translationService,
                      )}${activityLegend(translationService)}</figure>`;
            const table =
                day.records.length === 0 ? '' : htmlReportTable(activityRecordTable(day, translationService), translationService);

            return `<h3>${escapeHtml(day.date.display)}</h3>\n<h4 class="activity-totals-heading">${escapeHtml(
                t('activities.totalsHeading'),
            )}</h4>\n${activityTotals(day, translationService)}\n${graph}\n${table}`;
        })
        .join('\n');

    return section(
        'activities',
        t('navigator.section.activities'),
        `${dayBlocks}\n<p class="note">${escapeHtml(t('activities.viewerCalculationNote'))}</p>`,
    );
}

function associationsSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string | null {
    const t = translationService.translate.bind(translationService);
    const associations = viewModel.associations;
    if (!associations.ok || associations.viewModel === null) {
        return section(
            'associations',
            t('report.section.associations'),
            `<p>${escapeHtml(t('report.section.unavailableDescription'))}</p>`,
        );
    }
    if (associations.viewModel.records.length === 0) {
        return null;
    }

    return section(
        'associations',
        t('report.section.associations'),
        htmlReportTable(associationTable(associations.viewModel, translationService), translationService),
    );
}

function placesSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string | null {
    const t = translationService.translate.bind(translationService);
    const locations = viewModel.locations;
    if (!locations.ok || locations.viewModel === null) {
        return section('places', t('report.section.places'), `<p>${escapeHtml(t('report.section.unavailableDescription'))}</p>`);
    }
    if (locations.viewModel.records.length === 0) {
        return null;
    }

    const table = htmlReportTable(placesTable(locations.viewModel, translationService), translationService);
    const limitation = locations.viewModel.hasGen2v2ParserLimitation
        ? `<p class="note">${escapeHtml(t('places.limitation'))}</p>`
        : '';

    return section('places', t('report.section.places'), `${table}\n${limitation}`);
}

function eventsFaultsSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string | null {
    const t = translationService.translate.bind(translationService);
    const eventsAndFaults = viewModel.eventsAndFaults;
    if (!eventsAndFaults.ok || eventsAndFaults.viewModel === null) {
        return section(
            'events-faults',
            t('report.section.eventsFaults'),
            `<p>${escapeHtml(t('report.section.unavailableDescription'))}</p>`,
        );
    }
    if (eventsAndFaults.viewModel.records.length === 0) {
        return null;
    }

    return section(
        'events-faults',
        t('report.section.eventsFaults'),
        htmlReportTable(eventFaultTable(eventsAndFaults.viewModel.records, translationService), translationService),
    );
}

function technicalRecordBlock(record: ITechnicalReportRecord, translationService: ViewerTranslationService): string {
    const heading = record.recordedAt === null ? record.kindLabel : `${record.kindLabel} — ${record.recordedAt}`;
    const fields = definitionList(
        record.fields.map(
            (field) => [field.label, field.isCode ? `<code>${escapeHtml(field.value)}</code>` : escapeHtml(field.value)] as const,
        ),
    );
    return `<h4>${escapeHtml(heading)}</h4>\n${fields}<p class="source">${escapeHtml(
        translationService.translate('eventsFaults.source'),
    )}: ${escapeHtml(record.sourcePath)}</p>`;
}

function technicalSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string | null {
    const t = translationService.translate.bind(translationService);
    const technical = viewModel.technical;
    if (!technical.ok || technical.viewModel === null) {
        return section(
            'technical',
            t('report.section.technical'),
            `<p>${escapeHtml(t('report.section.unavailableDescription'))}</p>`,
        );
    }

    const sectionModel: ITechnicalSectionViewModel = technical.viewModel;
    const blocks: string[] = [];
    if (sectionModel.identificationRecords.length > 0) {
        blocks.push(
            `<h3>${escapeHtml(
                sectionModel.documentKind === 'driverCard'
                    ? t('technical.identificationHeading')
                    : t('technical.vehicleUnit.identificationHeading'),
            )}</h3>`,
            ...technicalReportRecords(sectionModel.identificationRecords, translationService).map((record) =>
                technicalRecordBlock(record, translationService),
            ),
        );
    }
    if (sectionModel.operationalRecords.length > 0) {
        blocks.push(
            `<h3>${escapeHtml(
                sectionModel.documentKind === 'driverCard'
                    ? t('technical.operationalHeading')
                    : t('technical.vehicleUnit.operationalHeading'),
            )}</h3>`,
            ...technicalReportRecords(sectionModel.operationalRecords, translationService).map((record) =>
                technicalRecordBlock(record, translationService),
            ),
        );
    }
    if (blocks.length === 0) {
        return null;
    }

    return section('technical', t('report.section.technical'), blocks.join('\n'));
}

function integritySection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string {
    const t = translationService.translate.bind(translationService);
    const integrity = viewModel.integrity;
    const summary = integritySummary(viewModel, translationService);
    const counts = definitionList(summary.counts.map(([label, value]) => [label, escapeHtml(value)] as const));
    const items =
        integrity.items.length === 0
            ? `<p>${escapeHtml(t('integrity.verificationItemsEmpty'))}</p>`
            : htmlReportTable(integrityItemTable(integrity, translationService), translationService);

    return section(
        'integrity',
        t('report.section.integrity'),
        [
            `<p><strong>${escapeHtml(summary.status)}</strong> — ${escapeHtml(summary.description)}</p>`,
            counts,
            integrity.scopes.length === 0
                ? ''
                : htmlReportTable(integrityScopeTable(integrity, translationService), translationService),
            `<h3>${escapeHtml(t('integrity.verificationItemsHeading'))}</h3>\n${items}`,
            `<p class="note">${escapeHtml(t('integrity.parsedIndependently'))}</p>`,
        ].join('\n'),
    );
}

function limitationsSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string {
    const items = reportLimitations(viewModel, translationService)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('');
    return section('limitations', translationService.translate('report.limitations.heading'), `<ul>${items}</ul>`);
}

function complianceSection(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string {
    const t = translationService.translate.bind(translationService);
    const compliance = viewModel.compliance;
    const summary = complianceSummaryText(compliance, translationService);
    const summaryHtml = `<p><strong>${escapeHtml(summary.profileLabel)}</strong> ${escapeHtml(summary.profileName)} (v${escapeHtml(
        summary.profileVersion,
    )})</p>\n<p><strong>${escapeHtml(summary.totalLabel)}:</strong> ${escapeHtml(summary.total)} (${escapeHtml(summary.breakdown)})</p>`;
    const table =
        compliance.infringements.length === 0
            ? `<p>${escapeHtml(t('compliance.emptyTitle'))}</p>`
            : htmlReportTable(complianceTable(compliance, translationService), translationService);

    return section('compliance', t('navigator.section.compliance'), [summaryHtml, table].join('\n'));
}

export function serializeHtmlReport(viewModel: IExportReportViewModel, translationService: ViewerTranslationService): string {
    const t = translationService.translate.bind(translationService);
    const overview = viewModel.overview;
    const parser = [viewModel.parserVersion, viewModel.parserCommit]
        .filter((value): value is string => value !== null)
        .join(' @ ');
    const meta = definitionList([
        [t('report.file'), escapeHtml(overview.displayName)],
        [t('report.documentKind'), escapeHtml(translateDocumentKind(overview.documentKind, translationService))],
        [t('overview.generation'), escapeHtml(translateGeneration(overview.generation, translationService))],
        [t('report.sha256'), `<code>${escapeHtml(overview.sha256)}</code>`],
        [t('report.generatedAt'), escapeHtml(overview.openedAt.display)],
        [t('report.timeZone'), escapeHtml(overview.timeZone)],
        [t('report.parser'), escapeHtml(parser.length > 0 ? parser : t('overview.identity.missing'))],
        [t('overview.integrity'), escapeHtml(translateIntegrityStatus(overview.integrity.status, translationService))],
    ]);
    const sections = [
        identitySection(viewModel, translationService),
        activitiesSection(viewModel, translationService),
        complianceSection(viewModel, translationService),
        associationsSection(viewModel, translationService),
        placesSection(viewModel, translationService),
        eventsFaultsSection(viewModel, translationService),
        technicalSection(viewModel, translationService),
        integritySection(viewModel, translationService),
        limitationsSection(viewModel, translationService),
    ]
        .filter((value): value is string => value !== null)
        .join('\n');

    return [
        '<!DOCTYPE html>',
        `<html lang="${escapeHtml(overview.locale)}">`,
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `<title>${escapeHtml(overview.displayName)} – ${escapeHtml(t('report.title'))}</title>`,
        reportStyles,
        '</head>',
        '<body>',
        '<main>',
        '<header class="report-header">',
        `<h1>${escapeHtml(t('report.title'))}</h1>`,
        meta,
        `<p class="note">${escapeHtml(t('report.notALegalAssessment'))}</p>`,
        '</header>',
        sections,
        '</main>',
        '</body>',
        '</html>',
    ].join('\n');
}

const comparisonLandscapePrintStyle = '<style>@media print { @page { size: A4 landscape; } }</style>';

// Serializes comparison evidence into a standalone HTML document.
export function serializeComparisonHtmlReport(
    viewModel: IOpenedDocumentComparisonViewModel,
    translationService: ITranslationService<ComparisonPdfTranslationKey>,
    localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>,
    generatedAtTimestamp: UtcTimestamp,
): string {
    const t = translationService.translate.bind(translationService);
    const totalFiles = viewModel.records.length;
    const differingCount = viewModel.differingColumns.length;

    const meta = definitionList([
        [t('comparison.pdf.scopeLabel'), escapeHtml(t('comparison.pdf.scopeValue'))],
        [t('comparison.pdf.documentsLabel'), escapeHtml(String(totalFiles))],
        [t('comparison.pdf.differingColumnsLabel'), escapeHtml(String(differingCount))],
        [t('comparison.pdf.generatedAtLabel'), escapeHtml(localisationService.formatDateTime(generatedAtTimestamp))],
    ]);

    const sectionsHtml = createComparisonReportSections(viewModel, translationService)
        .map((sectionDto) => {
            const rows = sectionDto.rows.map((row) => row.cells.map(escapeHtml));
            const subtitleHtml = sectionDto.subtitle.length > 0 ? `<p class="note">${escapeHtml(sectionDto.subtitle)}</p>` : '';
            const sectionId = `comparison-${sectionDto.title.toLowerCase().replace(/[^a-z0-9]+/gu, '-')}`;
            return section(
                sectionId,
                sectionDto.title,
                `${subtitleHtml}${dataTable(sectionDto.title, sectionDto.headers, rows)}`,
            );
        })
        .join('\n');

    return [
        '<!DOCTYPE html>',
        `<html lang="${escapeHtml(localisationService.locale)}">`,
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `<title>${escapeHtml(t('comparison.pdf.title'))}</title>`,
        reportStyles,
        comparisonLandscapePrintStyle,
        '</head>',
        '<body>',
        '<main>',
        '<header class="report-header">',
        `<h1>${escapeHtml(t('comparison.pdf.title'))}</h1>`,
        meta,
        `<p class="note">${escapeHtml(t('comparison.pdf.footerNotice'))}</p>`,
        '</header>',
        sectionsHtml,
        '</main>',
        '</body>',
        '</html>',
    ].join('\n');
}

const reportStyles = `<style>
    :root {
        color-scheme: light;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        line-height: 1.45;
        color: #1a1d21;
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 1rem; width: 100%; min-width: 100%; background: #ffffff; }
    main, section, header { width: 100%; min-width: 100%; max-width: 100%; margin: 0; padding: 0; }
    h1 { margin-block-start: 0; }
    h2 {
        margin-block-start: 2rem;
        border-block-end: 1px solid #d0d5dc;
        padding-block-end: 0.25rem;
    }
    h3 { margin-block-end: 0.25rem; }
    h4 { margin-block-end: 0.25rem; }
    dl { width: 100%; display: grid; grid-template-columns: minmax(12rem, max-content) minmax(0, 1fr); gap: 0.25rem 1rem; }
    dl > div { display: contents; }
    dt { font-weight: 600; }
    dd { margin-inline-start: 0; overflow-wrap: anywhere; }
    table {
        width: 100% !important;
        inline-size: 100% !important;
        min-width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;
        border-collapse: collapse;
        margin-block: 0.75rem;
        font-size: 0.9rem;
    }
    caption { text-align: start; font-weight: 600; padding-block: 0.5rem; }
    th, td { border: 1px solid #d0d5dc; padding: 0.35rem 0.5rem; text-align: start; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
    th { background: #f2f4f7; }
    code { font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", monospace; }
    .note { color: #444b55; }
    .source { color: #444b55; font-size: 0.85rem; }
    figure { margin: 0; padding: 0; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
    .activity-graph { width: 100% !important; max-width: 100% !important; margin-block: 0.75rem 1rem; box-sizing: border-box !important; }
    .activity-graph figcaption { font-weight: 600; margin-block-end: 0.35rem; }
    .activity-band { width: 100% !important; max-width: 100% !important; height: auto !important; display: block; overflow: visible; }
    img, svg { max-width: 100% !important; height: auto !important; }
    .activity-band text { font-size: 10px; fill: #444b55; }
    .band-axis { stroke: #444b55; stroke-width: 1; }
    .band-availability { fill: #7c3aed; }
    .band-breakOrRest { fill: #0f766e; }
    .band-driving { fill: #0f62fe; }
    .band-unknown { fill: #64748b; }
    .band-work { fill: #b45309; }
    .activity-legend { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin-block-start: 0.35rem; font-size: 0.85rem; }
    .activity-legend-item { display: inline-flex; align-items: center; gap: 0.35rem; }
    .legend-swatch { inline-size: 0.75rem; block-size: 0.75rem; border-radius: 2px; }
    .swatch-availability { background-color: #7c3aed; }
    .swatch-breakOrRest { background-color: #0f766e; }
    .swatch-driving { background-color: #0f62fe; }
    .swatch-unknown { background-color: #64748b; }
    .swatch-work { background-color: #b45309; }
    .activity-totals-heading { margin-block-end: 0.25rem; font-size: 0.9rem; }
    .activity-totals { width: 100% !important; display: grid; gap: 0.1rem 1.5rem; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); margin-block: 0.25rem 0.75rem; padding: 0.5rem 0.75rem; background: #f2f4f7; border-radius: 6px; font-size: 0.85rem; }
    .activity-total-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.4rem; padding-block: 0.1rem; }
    .activity-totals strong { font-variant-numeric: tabular-nums; }
    .activity-icon { inline-size: 0.95rem; block-size: 0.95rem; }
    .cell-stack { display: grid; gap: 0.15rem; }
    .cell-block { display: block; }
    .cell-label { font-weight: 600; }
    @media print {
        @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
        }
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            padding: 0;
            margin: 0;
            background-color: #ffffff !important;
            color: #1a1d21 !important;
        }
        main, section, header {
            max-inline-size: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        section {
            break-inside: avoid;
            page-break-inside: avoid;
        }
        table {
            inline-size: 100% !important;
            width: 100% !important;
            table-layout: fixed !important;
        }
        table, tr, dt, dd {
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .activity-graph {
            width: 100% !important;
            break-inside: avoid;
            page-break-inside: avoid;
        }
    }
</style>`;
