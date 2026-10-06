import { evaluateDocumentCompliance, nightWindowFromPreferences, type INightWindow } from '#compliance';
import type { Result } from '#contracts';
import type { DocumentWorkspaceSection, OpenedTachographDocument } from '#viewer-application';
import type { IDetailedSpeedSample } from '#viewer-domain';
import {
    createActivityInfringementInspectorViewModel,
    createActivitySectionViewModel,
    createAssociationSectionViewModel,
    createDocumentComparisonViewModel,
    createDocumentOverviewViewModel,
    createEventFaultSectionViewModel,
    createIntegrityDetailViewModel,
    createLocationSectionViewModel,
    createRawDataExplorerViewModel,
    createRecordInspectorViewModel,
    createSpeedSectionViewModel,
    createTechnicalSectionViewModel,
    type IActivitySectionViewModel,
    type IAssociationSectionViewModel,
    type IOpenedDocumentComparisonViewModel,
    type IDocumentOverviewViewModel,
    type IEventFaultSectionViewModel,
    type IIntegrityDetailViewModel,
    type ILocationSectionViewModel,
    type IRawDataExplorerViewModel,
    type IRecordInspectorViewModel,
    type ISpeedSectionViewModel,
    type ITechnicalSectionViewModel,
} from '#viewer-presentation';

import type { IViewerContext } from '../viewer-context.js';
import type { ViewerDocumentSession } from './viewer-document-session.svelte.js';

// View models for the open document. Each section's model is derived only while that section is visible, so opening
// a large document does not build every screen at once.
export class ViewerSectionViewModels {
    readonly #_context: IViewerContext;
    readonly #_session: ViewerDocumentSession;

    #_activeSection: DocumentWorkspaceSection | null;
    #_complianceNightWindow: INightWindow;
    #_overview: IDocumentOverviewViewModel | null;
    #_activity: IActivitySectionViewModel | null;
    #_association: IAssociationSectionViewModel | null;
    #_eventFault: IEventFaultSectionViewModel | null;
    #_location: ILocationSectionViewModel | null;
    #_technical: ITechnicalSectionViewModel | null;
    #_selectedSpeedRecord: IDetailedSpeedSample | null;
    #_speed: ISpeedSectionViewModel | null;
    #_rawDataExplorer: IRawDataExplorerViewModel | null;
    #_integrityDetail: IIntegrityDetailViewModel | null;
    #_comparison: IOpenedDocumentComparisonViewModel;
    #_inspector: IRecordInspectorViewModel | null;

    public constructor(context: IViewerContext, session: ViewerDocumentSession) {
        this.#_context = context;
        this.#_session = session;
        this.#_activeSection = $derived(this.#_context.documentController.selectionSnapshot?.projection.section ?? null);
        this.#_complianceNightWindow = $derived(
            nightWindowFromPreferences(this.#_context.preferencesController.snapshot.preferences),
        );
        this.#_overview = $derived.by(() => {
            const current = this.#_context.documentController.snapshot.current;
            return current === null ? null : createDocumentOverviewViewModel(current, this.#_context.localisationService);
        });
        // Compliance is evaluated here, in the feature layer, so the presentation builder receives plain findings.
        this.#_activity = $derived.by(() =>
            this.sectionView('activities', (current) => {
                const profile = this.#_context.complianceProfileController.selectedProfile;
                return createActivitySectionViewModel(
                    current,
                    this.#_context.localisationService,
                    profile,
                    evaluateDocumentCompliance(current, profile, this.#_complianceNightWindow),
                );
            }),
        );
        this.#_association = $derived.by(() =>
            this.sectionView('associations', (current) =>
                createAssociationSectionViewModel(
                    current,
                    this.#_context.localisationService,
                    this.#_session.associationFilter.value,
                ),
            ),
        );
        this.#_eventFault = $derived.by(() =>
            this.sectionView('eventsAndFaults', (current) =>
                createEventFaultSectionViewModel(
                    current,
                    this.#_context.localisationService,
                    this.#_session.eventFaultFilter.value,
                ),
            ),
        );
        this.#_location = $derived.by(() =>
            this.sectionView('places', (current) =>
                createLocationSectionViewModel(current, this.#_context.localisationService, this.#_session.locationFilter.value),
            ),
        );
        this.#_technical = $derived.by(() => {
            const current = this.visibleDocument('technical');
            return current === null ? null : createTechnicalSectionViewModel(current, this.#_context.localisationService);
        });
        this.#_selectedSpeedRecord = $derived.by(() => {
            const record = this.#_context.documentController.selectionSnapshot?.selectedRecord ?? null;
            return record !== null && 'speedKilometresPerHour' in record ? record : null;
        });
        this.#_speed = $derived.by(() => {
            const current = this.visibleDocument('speed');
            return current === null
                ? null
                : createSpeedSectionViewModel(current, this.#_context.localisationService, {
                      end: this.#_session.speedRangeEnd.value,
                      pageIndex: this.#_session.speedPage.value,
                      preferredSample: this.#_selectedSpeedRecord,
                      start: this.#_session.speedRangeStart.value,
                  });
        });
        this.#_rawDataExplorer = $derived.by(() => {
            const current = this.visibleDocument('rawData');
            return current === null ? null : createRawDataExplorerViewModel(current, this.#_context.localisationService);
        });
        this.#_integrityDetail = $derived.by(() => {
            const current = this.visibleDocument('integrity');
            return current === null ? null : createIntegrityDetailViewModel(current, this.#_context.localisationService);
        });
        this.#_comparison = $derived(
            createDocumentComparisonViewModel(
                this.#_context.documentController.comparisonSnapshot,
                this.#_context.localisationService,
            ),
        );
        this.#_inspector = $derived.by(() => this.buildInspector());
    }

    public get activeSection(): DocumentWorkspaceSection | null {
        return this.#_activeSection;
    }

    // Night-work window from the user's preferences, applied to every compliance evaluation.
    public get complianceNightWindow(): INightWindow {
        return this.#_complianceNightWindow;
    }

    public get selectedSpeedRecord(): IDetailedSpeedSample | null {
        return this.#_selectedSpeedRecord;
    }

    public get overview(): IDocumentOverviewViewModel | null {
        return this.#_overview;
    }

    public get activity(): IActivitySectionViewModel | null {
        return this.#_activity;
    }

    public get association(): IAssociationSectionViewModel | null {
        return this.#_association;
    }

    public get eventFault(): IEventFaultSectionViewModel | null {
        return this.#_eventFault;
    }

    public get location(): ILocationSectionViewModel | null {
        return this.#_location;
    }

    public get technical(): ITechnicalSectionViewModel | null {
        return this.#_technical;
    }

    public get speed(): ISpeedSectionViewModel | null {
        return this.#_speed;
    }

    public get rawDataExplorer(): IRawDataExplorerViewModel | null {
        return this.#_rawDataExplorer;
    }

    public get integrityDetail(): IIntegrityDetailViewModel | null {
        return this.#_integrityDetail;
    }

    public get comparison(): IOpenedDocumentComparisonViewModel {
        return this.#_comparison;
    }

    public get inspector(): IRecordInspectorViewModel | null {
        return this.#_inspector;
    }

    // The open document, but only while `section` is the visible one.
    private visibleDocument(section: DocumentWorkspaceSection): IViewerContext['documentController']['snapshot']['current'] {
        return this.#_activeSection === section ? this.#_context.documentController.snapshot.current : null;
    }

    // A section whose builder reports a failure renders as unavailable rather than as an error.
    private sectionView<TViewModel>(
        section: DocumentWorkspaceSection,
        build: (document: OpenedTachographDocument) => Result<TViewModel, unknown>,
    ): TViewModel | null {
        const current = this.visibleDocument(section);
        if (current === null) {
            return null;
        }
        const result = build(current);
        return result.ok ? result.value : null;
    }

    private buildInspector(): IRecordInspectorViewModel | null {
        const overview = this.#_overview;
        if (overview === null) {
            return null;
        }
        const pin = this.#_session.selectedActivityInfringement.value;
        if (this.#_activeSection === 'activities' && pin !== null) {
            return createActivityInfringementInspectorViewModel(pin, overview.documentKind);
        }
        const selection = this.#_context.documentController.selectionSnapshot;
        const record = selection?.selectedRecord ?? null;
        if (selection === null || record === null) {
            return null;
        }
        const section = selection.projection.section;
        return createRecordInspectorViewModel(record, section, overview.documentKind, {
            activityRows: section === 'activities' ? (this.#_activity?.days.flatMap((day) => day.records) ?? []) : [],
            associationRows: section === 'associations' ? (this.#_association?.records ?? []) : [],
            eventFaultRows: section === 'eventsAndFaults' ? (this.#_eventFault?.records ?? []) : [],
            identityRows: section === 'overview' ? overview.identities : [],
            locationRows: section === 'places' ? (this.#_location?.records ?? []) : [],
            // The inspector must find a selected sample on any page, not only the one on screen.
            speedRows: section === 'speed' ? (this.#_speed?.allRecords ?? []) : [],
            technicalRows:
                section === 'technical' && this.#_technical !== null
                    ? [...this.#_technical.identificationRecords, ...this.#_technical.operationalRecords]
                    : [],
        });
    }
}
