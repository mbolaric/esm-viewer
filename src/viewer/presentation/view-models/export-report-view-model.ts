import type { OpenedTachographDocument } from '#viewer-application';
import type { ParseError, Result } from '#contracts';

import {
    type ActivityComplianceInput,
    createActivitySectionViewModel,
    createAssociationSectionViewModel,
    createDocumentOverviewViewModel,
    createEventFaultSectionViewModel,
    createLocationSectionViewModel,
    type IActivitySectionViewModel,
    type IAssociationSectionViewModel,
    type IDocumentOverviewViewModel,
    type IEventFaultSectionViewModel,
    type ILocationSectionViewModel,
} from './document-view-model.js';
import { createIntegrityDetailViewModel, type IIntegrityDetailViewModel } from './integrity-view-model.js';
import { createTechnicalSectionViewModel, type ITechnicalSectionViewModel } from './technical-view-model.js';

import type { IComplianceViewModel } from '#compliance';
import type { ViewerLocalisationService } from '../helpers/view-model-formatting.js';

export interface IReportSectionViewModel<TViewModel> {
    readonly ok: boolean;
    readonly viewModel: TViewModel | null;
}

export interface IExportReportViewModel {
    readonly activities: IReportSectionViewModel<IActivitySectionViewModel>;
    readonly associations: IReportSectionViewModel<IAssociationSectionViewModel>;
    readonly compliance: IComplianceViewModel;
    readonly eventsAndFaults: IReportSectionViewModel<IEventFaultSectionViewModel>;
    readonly integrity: IIntegrityDetailViewModel;
    readonly locations: IReportSectionViewModel<ILocationSectionViewModel>;
    readonly overview: IDocumentOverviewViewModel;
    readonly parserCommit: string | null;
    readonly parserVersion: string | null;
    readonly technical: IReportSectionViewModel<ITechnicalSectionViewModel>;
}

function mapSectionResult<TViewModel>(result: Result<TViewModel, ParseError>): IReportSectionViewModel<TViewModel> {
    return result.ok
        ? {
              ok: true,
              viewModel: result.value,
          }
        : {
              ok: false,
              viewModel: null,
          };
}

// Receives pre-evaluated compliance and infringements from composition layer.
export function createExportReportViewModel(
    document: OpenedTachographDocument,
    localisation: ViewerLocalisationService,
    parserVersions: { readonly commit: string | null; readonly version: string | null },
    compliance: IComplianceViewModel,
    activityEvaluation: ActivityComplianceInput,
): IExportReportViewModel {
    const activities = createActivitySectionViewModel(document, localisation, compliance.selectedProfile, activityEvaluation);
    const associations = createAssociationSectionViewModel(document, localisation, 'all');
    const eventsAndFaults = createEventFaultSectionViewModel(document, localisation, 'all');
    const locations = createLocationSectionViewModel(document, localisation, 'all');

    return {
        activities: mapSectionResult(activities),
        associations: mapSectionResult(associations),
        compliance,
        eventsAndFaults: mapSectionResult(eventsAndFaults),
        integrity: createIntegrityDetailViewModel(document, localisation),
        locations: mapSectionResult(locations),
        overview: createDocumentOverviewViewModel(document, localisation),
        parserCommit: parserVersions.commit,
        parserVersion: parserVersions.version,
        technical: {
            ok: true,
            viewModel: createTechnicalSectionViewModel(document, localisation),
        },
    };
}
