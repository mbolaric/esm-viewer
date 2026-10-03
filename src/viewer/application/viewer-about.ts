import type { IRuntimeVersions, Result } from '#contracts';

export type ViewerRuntimeVersionsResult = Result<IRuntimeVersions, 'runtimeVersionsFailed'>;

export interface IViewerRuntimeVersionsPort {
    load(): Promise<ViewerRuntimeVersionsResult>;
}
