export {
    acquireDocumentCandidate,
    type DocumentCandidateAcquisitionResult,
    type DocumentClock,
    type IDroppedTachographFile,
    type IFileDigestPort,
    type IParsedDocumentOperation,
    type ITachographFilePicker,
    type ITachographFileResource,
    type ITachographParserPort,
    type ParsedDocumentResult,
    type TachographFileAcquisitionResult,
} from './document-candidate.js';
export { hasRecognizedTachographHeader } from './tachograph-file-validation.js';
export { createDocumentSource, type IDocumentSource } from './document-source.js';
export {
    createOpenedDocumentComparisonRecord,
    documentComparisonKey,
    DocumentComparisonController,
    type IComparisonAssociationSession,
    type IComparisonOdometerRange,
    type IDocumentComparisonController,
    type IOpenedDocumentComparisonRecord,
    type IOpenedDocumentComparisonSnapshot,
} from './document-comparison.js';
export {
    DocumentLifecycleController,
    type DocumentLifecycleStatus,
    type DocumentOpenResult,
    type DocumentSessionDisposeResult,
    type IDocumentLifecycleController,
    type IDocumentLifecycleSnapshot,
    type IDocumentOpenOperation,
    type IOpenedDocumentSession,
} from './document-lifecycle.js';
export {
    createDocumentOverviewProjection,
    detailedSpeedChartSampleLimit,
    detailedSpeedPageSize,
    maximumDetailedSpeedRangeMilliseconds,
    projectDocumentAssociations,
    projectDocumentActivityDays,
    projectDocumentCanonicalActivityDays,
    projectDocumentCanonicalEventFaultRecords,
    projectDocumentActivityRecords,
    projectDocumentDailyOdometerRecords,
    projectDocumentDetailedSpeed,
    projectDocumentDetailedSpeedSamples,
    projectDocumentOverspeedRecords,
    projectDocumentEventFaultRecords,
    projectDocumentIdentities,
    projectDocumentLocationRecords,
    projectDocumentTechnicalRecords,
    type AssociationGenerationFilter,
    type IDetailedSpeedChartSample,
    type IDetailedSpeedProjectionRequest,
    type IDetailedSpeedStatistics,
    type IDocumentDetailedSpeedProjection,
    type EventFaultTypeFilter,
    type LocationRecordTypeFilter,
    type IDocumentActivityDayProjection,
    type IDocumentActivityRecord,
    type IDocumentContentCounts,
    type IDocumentCoverage,
    type IDocumentOverviewProjection,
} from './document-projections.js';
export {
    createDocumentIntegrityProjection,
    verifyDriverCardDocumentIntegrity,
    verifyVehicleUnitDocumentIntegrity,
    type IDocumentIntegrityCounts,
    type IDocumentIntegrityProjection,
    type IDocumentIntegrityScopeProjection,
} from './document-integrity.js';
export {
    createDocumentSectionProjection,
    DocumentSelectionController,
    getAvailableDocumentSections,
    type DocumentSectionRecord,
    type DocumentSelectionResult,
    type DocumentWorkspaceSection,
    type IDocumentSelectionController,
    type IDocumentSectionProjection,
    type IDocumentSelectionSnapshot,
} from './document-selection.js';
export { resolveJsonPointer, type JsonPointerResolutionError } from './json-pointer-resolver.js';
export {
    createRawDataExplorer,
    rawDataChildPageSize,
    type IRawDataChildPage,
    type IRawDataExplorer,
    type IRawDataNodeProjection,
    type RawDataExplorationError,
    type RawDataNodeKind,
    type RawDataScalar,
} from './raw-data-explorer.js';
export { writeTextToClipboard, type ITextClipboardPort, type TextClipboardWriteResult } from './text-clipboard.js';
export {
    type IViewerExportPort,
    type IViewerExportSaveRequest,
    type IViewerExportSource,
    type IViewerPdfPort,
    type ViewerExportFailureCode,
    type ViewerExportOutcome,
    type ViewerPdfOutcome,
} from './viewer-export.js';
export { type IViewerRuntimeVersionsPort, type ViewerRuntimeVersionsResult } from './viewer-about.js';
export { type IApplicationCommandStateTarget } from './viewer-command.js';
export {
    type IViewerPreferencesStore,
    type IViewerPreferencesTarget,
    type ViewerPreferencesLoadResult,
    type ViewerPreferencesSaveResult,
} from './viewer-preferences.js';
export {
    createOpenedTachographDocument,
    type ICardVerificationApplication,
    type IDriverCardApplication,
    type INormalizedDocumentSection,
    type IOpenedDriverCardDocument,
    type IOpenedVehicleUnitDocument,
    type IParsedDriverCardDocument,
    type IParsedUnsupportedCardDocument,
    type IParsedVehicleUnitDocument,
    type IVuVerificationApplication,
    type NormalizedSectionKind,
    type OpenedTachographDocument,
    type ParsedCardType,
    type ParsedParserDocument,
    type SupportedParsedParserDocument,
} from './opened-document.js';
