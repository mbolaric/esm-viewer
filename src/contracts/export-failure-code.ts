// Reasons a save-to-disk export can fail across viewer capabilities and desktop hosts.
export type ExportFailureCode = 'archiveChanged' | 'destinationExists' | 'exportFailed' | 'ioFailure' | 'sourceConflict';
