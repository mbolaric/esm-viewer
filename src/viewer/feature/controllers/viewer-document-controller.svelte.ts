import {
    acquireDocumentCandidate,
    documentComparisonKey,
    verifyDriverCardDocumentIntegrity,
    verifyVehicleUnitDocumentIntegrity,
} from '#viewer-application';
import type {
    DocumentClock,
    DocumentSectionRecord,
    DocumentWorkspaceSection,
    IDroppedTachographFile,
    IDocumentLifecycleController,
    IDocumentLifecycleSnapshot,
    IDocumentSelectionController,
    IDocumentSelectionSnapshot,
    IDocumentComparisonController,
    IOpenedDocumentComparisonSnapshot,
    IFileDigestPort,
    ITachographFilePicker,
    ITachographParserPort,
    OpenedTachographDocument,
} from '#viewer-application';
import type { IErrorService } from '#error-reporting';
import { ERROR_CODES, classifyParseError, type FileDisplayName, type ReopenToken } from '#contracts';
import { SvelteSet } from 'svelte/reactivity';

export interface IViewerDocumentControllerDependencies {
    readonly clock: DocumentClock;
    readonly comparison: IDocumentComparisonController;
    readonly createDroppedFilePicker: (file: IDroppedTachographFile) => ITachographFilePicker;
    readonly createReopenFilePicker: (reopenToken: ReopenToken) => ITachographFilePicker;
    readonly createSelectionController: (document: OpenedTachographDocument) => IDocumentSelectionController;
    readonly digest: IFileDigestPort;
    readonly disposeOwnedResources: () => void;
    readonly errorService?: IErrorService;
    readonly filePicker: ITachographFilePicker;
    readonly lifecycle: IDocumentLifecycleController;
    readonly parser: ITachographParserPort;
    readonly preferencesController: {
        readonly snapshot: {
            readonly preferences: { readonly verificationAutoRun: boolean };
        };
        recordRecentFile(entry: {
            readonly displayName: FileDisplayName;
            readonly openedAtEpochMs: number;
            readonly reopenToken: ReopenToken;
        }): void;
    };
}

export class ViewerDocumentController {
    private readonly _dependencies: IViewerDocumentControllerDependencies;
    private readonly _comparison: IDocumentComparisonController;
    private _disposeCompletion: Promise<void> | null = null;
    private _disposed = false;
    private readonly _lifecycle: IDocumentLifecycleController;
    private _selectionController: IDocumentSelectionController | null = null;
    private _selectionDocument: OpenedTachographDocument | null = null;
    private _selectionGeneration = 0;
    // Comparison entries the user removed; a document stays out of the history until it is opened again.
    private readonly _removedComparisonKeys = new SvelteSet<string>();
    private _verifyingDocument: OpenedTachographDocument | null = null;
    #_selectingFile = $state(false);
    #_verifying = $state(false);
    #_comparisonSnapshot = $state.raw<IOpenedDocumentComparisonSnapshot>({ records: [] });
    #_selectionSnapshot = $state.raw<IDocumentSelectionSnapshot | null>(null);
    #_snapshot = $state.raw<IDocumentLifecycleSnapshot | null>(null);

    public constructor(dependencies: IViewerDocumentControllerDependencies) {
        this._dependencies = dependencies;
        this._comparison = dependencies.comparison;
        this._lifecycle = dependencies.lifecycle;
        this.synchronize();
    }

    public get verifying(): boolean {
        return this.#_verifying;
    }

    public get comparisonSnapshot(): IOpenedDocumentComparisonSnapshot {
        return this.#_comparisonSnapshot;
    }

    public get busy(): boolean {
        return this.#_selectingFile || this.snapshot.status === 'opening';
    }

    public get snapshot(): IDocumentLifecycleSnapshot {
        return this.#_snapshot ?? this._lifecycle.snapshot;
    }

    public get selectionSnapshot(): IDocumentSelectionSnapshot | null {
        return this.#_selectionSnapshot;
    }

    public cancel(): boolean {
        return this.syncAfterLifecycle(() => this._lifecycle.cancelCandidate());
    }

    public dismissFailure(): boolean {
        return this.syncAfterLifecycle(() => this._lifecycle.dismissFailure());
    }

    public clearComparison(): boolean {
        const cleared = this._comparison.clear();
        this._removedComparisonKeys.clear();
        this.synchronizeComparison();
        return cleared;
    }

    public removeComparisonRecord(key: string): boolean {
        const removed = this._comparison.remove(key);
        if (removed) {
            this._removedComparisonKeys.add(key);
        }
        this.synchronizeComparison();
        return removed;
    }

    public async reopenComparisonRecord(key: string): Promise<void> {
        if (this._disposed || this.busy) {
            return;
        }

        const record = this._comparison.snapshot.records.find((entry) => entry.key === key);
        if (record?.reopenToken === null || record?.reopenToken === undefined) {
            return;
        }

        await this.openWithPicker(this._dependencies.createReopenFilePicker(record.reopenToken), {
            recordAsRecent: true,
        });
    }

    public clearRecord(): boolean {
        const selectionController = this._selectionController;
        if (selectionController === null) {
            return false;
        }

        this.#_selectionSnapshot = selectionController.clearRecord();
        return true;
    }

    public async close(): Promise<void> {
        if (this._disposed) {
            return;
        }

        this._selectionGeneration += 1;
        this.#_selectingFile = false;
        await this.syncAroundLifecycle(() => this._lifecycle.close());
    }

    public selectSection(section: DocumentWorkspaceSection): boolean {
        const selectionController = this._selectionController;
        if (selectionController === null) {
            return false;
        }

        const selection = selectionController.selectSection(section);
        if (!selection.ok) {
            return false;
        }

        this.#_selectionSnapshot = selection.value;
        return true;
    }

    public selectRecord(record: DocumentSectionRecord): boolean {
        const selectionController = this._selectionController;
        if (selectionController === null) {
            return false;
        }

        const selection = selectionController.selectRecord(record);
        if (!selection.ok) {
            return false;
        }

        this.#_selectionSnapshot = selection.value;
        return true;
    }

    public dispose(): Promise<void> {
        this._disposeCompletion ??= this.completeDisposal();
        return this._disposeCompletion;
    }

    public async open(): Promise<void> {
        await this.openWithPicker(this._dependencies.filePicker, { recordAsRecent: true });
    }

    public async reopenDocument(reopenToken: ReopenToken): Promise<void> {
        if (this._disposed || this.busy) {
            return;
        }

        await this.openWithPicker(this._dependencies.createReopenFilePicker(reopenToken), {
            recordAsRecent: true,
        });
    }

    public async openDroppedFiles(files: readonly IDroppedTachographFile[]): Promise<void> {
        if (this._disposed || this.busy) {
            return;
        }

        if (files.length !== 1) {
            if (files.length > 1) {
                this.syncAfterLifecycle(() => this._lifecycle.reportOpenFailure(classifyParseError('multipleFilesDropped')));
            }
            return;
        }

        const file = files[0];
        if (file === undefined) {
            return;
        }

        let filePicker: ITachographFilePicker;
        try {
            filePicker = this._dependencies.createDroppedFilePicker(file);
        } catch {
            this.syncAfterLifecycle(() => this._lifecycle.reportOpenFailure(classifyParseError('internalError')));
            return;
        }

        await this.openWithPicker(filePicker);
    }

    private async openWithPicker(
        filePicker: ITachographFilePicker,
        options: { readonly recordAsRecent: boolean } = { recordAsRecent: false },
    ): Promise<void> {
        if (this._disposed || this.busy) {
            return;
        }

        const selectionGeneration = ++this._selectionGeneration;
        this.#_selectingFile = true;
        const candidate = await acquireDocumentCandidate(
            filePicker,
            this._dependencies.digest,
            this._dependencies.parser,
            this._dependencies.clock,
        );

        if (selectionGeneration !== this._selectionGeneration) {
            if (candidate.status === 'ready') {
                candidate.operation.cancel();
                void candidate.operation.completion;
            }
            return;
        }

        this.#_selectingFile = false;
        switch (candidate.status) {
            case 'cancelled':
                return;
            case 'failed':
                this.syncAfterLifecycle(() => this._lifecycle.reportOpenFailure(candidate.error));
                return;
            case 'ready': {
                await this.syncAroundLifecycle(() => this._lifecycle.openCandidate(candidate.operation));

                const current = this.snapshot.current;
                if (this.snapshot.status === 'ready' && current !== null) {
                    if (this._dependencies.preferencesController.snapshot.preferences.verificationAutoRun) {
                        void this.verifyDocument();
                    }

                    // Only record recent files when a persistent reopen token exists.
                    if (options.recordAsRecent && current.source.reopenToken !== null) {
                        this._dependencies.preferencesController.recordRecentFile({
                            displayName: current.source.displayName,
                            openedAtEpochMs: current.source.openedAt,
                            reopenToken: current.source.reopenToken,
                        });
                    }
                }
            }
        }
    }

    // Batches teardown mutations behind a single final synchronization pass.
    private async completeDisposal(): Promise<void> {
        this._disposed = true;
        this._selectionGeneration += 1;
        this.#_selectingFile = false;
        this._lifecycle.cancelCandidate();
        await this._lifecycle.close();
        try {
            this._dependencies.disposeOwnedResources();
        } catch {
            this._lifecycle.reportOpenFailure(classifyParseError('documentCleanupFailed'));
        }
        this.synchronize();
    }

    public async verifyDocument(): Promise<void> {
        const current = this.snapshot.current;
        if (
            this._verifyingDocument === current ||
            (current?.content.documentKind !== 'driverCard' && current?.content.documentKind !== 'vehicleUnit')
        ) {
            return;
        }

        this._verifyingDocument = current;
        this.#_verifying = true;
        try {
            const assessment =
                current.content.documentKind === 'driverCard'
                    ? await verifyDriverCardDocumentIntegrity(current, this._dependencies.parser)
                    : await verifyVehicleUnitDocumentIntegrity(current, this._dependencies.parser);

            if (this.snapshot.current === current) {
                this._lifecycle.updateIntegrity(assessment);
            }
        } catch {
            void this._dependencies.errorService?.report({
                code: ERROR_CODES.signatureVerificationFailed,
                severity: 'error',
                source: 'viewer',
            });
            if (this.snapshot.current === current) {
                this._lifecycle.updateIntegrity({
                    code: 'verificationFailed',
                    status: 'failed',
                });
            }
        } finally {
            if (this._verifyingDocument === current) {
                this._verifyingDocument = null;
                this.#_verifying = false;
            }
            this.synchronize();
        }
    }

    private syncAfterLifecycle<T>(mutate: () => T): T {
        const result = mutate();
        this.synchronize();
        return result;
    }

    private async syncAroundLifecycle<T>(mutate: () => Promise<T>): Promise<T> {
        const completion = mutate();
        this.synchronize();
        const result = await completion;
        this.synchronize();
        return result;
    }

    private synchronize(): void {
        const snapshot = this._lifecycle.snapshot;
        this.#_snapshot = snapshot;
        this.synchronizeSelection(snapshot.current);
        this.synchronizeComparison();
    }

    private synchronizeComparison(): void {
        const current = this.snapshot.current;
        if (
            current !== null &&
            this.snapshot.status === 'ready' &&
            !this._removedComparisonKeys.has(documentComparisonKey(current))
        ) {
            this._comparison.add(current);
        }
        this.#_comparisonSnapshot = this._comparison.snapshot;
    }

    private synchronizeSelection(document: OpenedTachographDocument | null): void {
        if (document === this._selectionDocument) {
            return;
        }

        // Opening a file again restores the history entry that removing it suppressed.
        const nextKey = document === null ? null : documentComparisonKey(document);
        if (nextKey !== null && nextKey !== this._selectionDocument?.source.sha256) {
            this._removedComparisonKeys.delete(nextKey);
        }

        this.#_verifying = document !== null && this._verifyingDocument === document;
        const previousSection = this.#_selectionSnapshot?.projection.section;
        const previousRecord = this.#_selectionSnapshot?.selectedRecord;
        const isSameDocument =
            document !== null &&
            this._selectionDocument !== null &&
            document.source.sha256 === this._selectionDocument.source.sha256;

        this._selectionDocument = document;
        this._selectionController = document === null ? null : this._dependencies.createSelectionController(document);
        this.#_selectionSnapshot = this._selectionController?.snapshot ?? null;

        if (isSameDocument && this._selectionController !== null) {
            if (previousSection !== undefined && previousSection !== 'overview') {
                this._selectionController.selectSection(previousSection);
            }
            if (previousRecord !== undefined && previousRecord !== null) {
                const matchingRecord = this._selectionController.snapshot.projection.records.find(
                    (record) =>
                        record.source !== null &&
                        previousRecord.source !== null &&
                        record.source.path === previousRecord.source.path,
                );
                if (matchingRecord !== undefined) {
                    this._selectionController.selectRecord(matchingRecord);
                }
            }
            this.#_selectionSnapshot = this._selectionController.snapshot;
        }
    }
}
