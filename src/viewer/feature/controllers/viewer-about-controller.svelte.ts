import { err, type IRuntimeVersions } from '#contracts';
import type { ILocalisationService } from '#localization';
import type { DurationMilliseconds, UtcTimestamp } from '#viewer-domain';
import type { ITextClipboardPort, IViewerRuntimeVersionsPort, ViewerRuntimeVersionsResult } from '#viewer-application';
import { writeTextToClipboard } from '#viewer-application';

export interface IViewerAboutSnapshot {
    readonly copyFailed: boolean;
    readonly copied: boolean;
    readonly isOpen: boolean;
    readonly loading: boolean;
    readonly versions: IRuntimeVersions | null;
    readonly versionsFailed: boolean;
}

export interface IViewerAboutControllerDependencies {
    readonly clipboard: ITextClipboardPort;
    readonly localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
    readonly runtimeVersionsPort: IViewerRuntimeVersionsPort;
}

function diagnosticsText(versions: IRuntimeVersions | null, locale: string, timeZone: string): string {
    return [
        `ESM Viewer ${versions?.application ?? 'unknown'}`,
        `Platform: ${versions?.platform ?? 'unknown'} (${versions?.architecture ?? 'unknown'})`,
        `Runtime: ${versions?.runtime ?? 'unknown'}`,
        `Parser: ${versions?.parserVersion ?? 'unknown'} @ ${versions?.parserCommit ?? 'unknown'}`,
        `Locale: ${locale}`,
        `Display time zone: ${timeZone}`,
    ].join('\n');
}

export class ViewerAboutController {
    private readonly _clipboard: ITextClipboardPort;
    private _generation = 0;
    private readonly _localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
    private readonly _runtimeVersionsPort: IViewerRuntimeVersionsPort;
    #_copied = $state(false);
    #_copyFailed = $state(false);
    #_isOpen = $state(false);
    #_loading = $state(false);
    #_versions = $state<IRuntimeVersions | null>(null);
    #_versionsFailed = $state(false);

    public constructor(dependencies: IViewerAboutControllerDependencies) {
        this._clipboard = dependencies.clipboard;
        this._localisationService = dependencies.localisationService;
        this._runtimeVersionsPort = dependencies.runtimeVersionsPort;
    }

    public get snapshot(): IViewerAboutSnapshot {
        return {
            copied: this.#_copied,
            copyFailed: this.#_copyFailed,
            isOpen: this.#_isOpen,
            loading: this.#_loading,
            versions: this.#_versions,
            versionsFailed: this.#_versionsFailed,
        };
    }

    public async open(): Promise<boolean> {
        if (this.#_isOpen) {
            return false;
        }

        const generation = ++this._generation;
        this.#_copied = false;
        this.#_copyFailed = false;
        this.#_isOpen = true;
        this.#_loading = true;
        this.#_versions = null;
        this.#_versionsFailed = false;
        let result: ViewerRuntimeVersionsResult;
        try {
            result = await this._runtimeVersionsPort.load();
        } catch {
            result = err('runtimeVersionsFailed');
        }
        if (generation !== this._generation) {
            return true;
        }
        this.#_loading = false;
        this.#_versions = result.ok ? result.value : null;
        this.#_versionsFailed = !result.ok;
        return true;
    }

    public cancel(): boolean {
        if (!this.#_isOpen) {
            return false;
        }

        this._generation += 1;
        this.#_copied = false;
        this.#_copyFailed = false;
        this.#_isOpen = false;
        this.#_loading = false;
        this.#_versions = null;
        this.#_versionsFailed = false;
        return true;
    }

    public async copyDiagnostics(): Promise<boolean> {
        if (!this.#_isOpen || this.#_loading) {
            return false;
        }

        const text = diagnosticsText(this.#_versions, this._localisationService.locale, this._localisationService.timeZone);
        const copied = (await writeTextToClipboard(this._clipboard, text)).ok;
        this.#_copied = copied;
        this.#_copyFailed = !copied;
        return copied;
    }
}
