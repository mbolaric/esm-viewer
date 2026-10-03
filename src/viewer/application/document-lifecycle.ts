import { classifyParseError, err, type FileDisplayName, type ParseError, type Result } from '#contracts';
import type { IntegrityAssessment } from '#viewer-domain';

import type { OpenedTachographDocument } from './opened-document.js';

export type DocumentLifecycleStatus = 'empty' | 'failed' | 'opening' | 'ready';

export interface IDocumentLifecycleSnapshot {
    readonly candidateDisplayName: FileDisplayName | null;
    readonly current: OpenedTachographDocument | null;
    readonly error: ParseError | null;
    readonly status: DocumentLifecycleStatus;
}

export type DocumentSessionDisposeResult = Result<null, ParseError>;

export interface IOpenedDocumentSession {
    document: OpenedTachographDocument;
    dispose(): Promise<DocumentSessionDisposeResult>;
}

export type DocumentOpenResult = Result<IOpenedDocumentSession, ParseError>;

export interface IDocumentOpenOperation {
    readonly completion: Promise<DocumentOpenResult>;
    readonly displayName: FileDisplayName;
    cancel(): void;
}

export interface IDocumentLifecycleController {
    readonly snapshot: IDocumentLifecycleSnapshot;
    cancelCandidate(): boolean;
    close(): Promise<void>;
    dismissFailure(): boolean;
    openCandidate(operation: IDocumentOpenOperation): Promise<void>;
    reportOpenFailure(error: ParseError): IDocumentLifecycleSnapshot;
    updateIntegrity(integrity: IntegrityAssessment): boolean;
}

function createSnapshot(
    status: DocumentLifecycleStatus,
    current: OpenedTachographDocument | null,
    candidateDisplayName: FileDisplayName | null,
    error: ParseError | null,
): IDocumentLifecycleSnapshot {
    return {
        candidateDisplayName,
        current,
        error,
        status,
    };
}

function settledSnapshot(current: OpenedTachographDocument | null, error: ParseError | null = null): IDocumentLifecycleSnapshot {
    return createSnapshot(current === null ? 'empty' : 'ready', current, null, error);
}

export class DocumentLifecycleController implements IDocumentLifecycleController {
    private _activeOperation: IDocumentOpenOperation | null = null;
    private _currentSession: IOpenedDocumentSession | null = null;
    private _generation = 0;
    private _snapshot: IDocumentLifecycleSnapshot = settledSnapshot(null);

    public get snapshot(): IDocumentLifecycleSnapshot {
        return this._snapshot;
    }

    public openCandidate(operation: IDocumentOpenOperation): Promise<void> {
        this._generation += 1;
        const generation = this._generation;
        const cancellationError = this.cancelActiveOperation();
        this._activeOperation = operation;
        this._snapshot = createSnapshot(
            'opening',
            this._currentSession?.document ?? null,
            operation.displayName,
            cancellationError,
        );

        return this.completeOpen(generation, operation);
    }

    public cancelCandidate(): boolean {
        const operation = this._activeOperation;
        if (operation === null) {
            return false;
        }

        this._generation += 1;
        const cancellationError = this.cancelActiveOperation();
        this._snapshot =
            cancellationError === null
                ? settledSnapshot(this._currentSession?.document ?? null)
                : createSnapshot('failed', this._currentSession?.document ?? null, operation.displayName, cancellationError);
        return true;
    }

    public dismissFailure(): boolean {
        if (this._snapshot.status !== 'failed') {
            return false;
        }

        this._snapshot = settledSnapshot(this._currentSession?.document ?? null);
        return true;
    }

    public updateIntegrity(integrity: IntegrityAssessment): boolean {
        if (this._currentSession === null) {
            return false;
        }

        const updatedDocument = {
            ...this._currentSession.document,
            integrity,
        };
        this._currentSession.document = updatedDocument;
        this._snapshot = settledSnapshot(updatedDocument);
        return true;
    }

    public reportOpenFailure(error: ParseError): IDocumentLifecycleSnapshot {
        if (error.category === 'cancellation') {
            this._snapshot = settledSnapshot(this._currentSession?.document ?? null);
            return this._snapshot;
        }

        this._snapshot = createSnapshot('failed', this._currentSession?.document ?? null, null, error);
        return this._snapshot;
    }

    public async close(): Promise<void> {
        this._generation += 1;
        const generation = this._generation;
        const cancellationError = this.cancelActiveOperation();
        const currentSession = this._currentSession;
        this._currentSession = null;
        this._snapshot =
            cancellationError === null ? settledSnapshot(null) : createSnapshot('failed', null, null, cancellationError);

        if (currentSession === null) {
            return;
        }

        const disposalError = await this.disposeSession(currentSession);
        if (disposalError !== null) {
            this._snapshot =
                generation === this._generation
                    ? createSnapshot('failed', null, null, disposalError)
                    : createSnapshot(
                          this._snapshot.status,
                          this._snapshot.current,
                          this._snapshot.candidateDisplayName,
                          disposalError,
                      );
        }
    }

    private cancelActiveOperation(): ParseError | null {
        const operation = this._activeOperation;
        this._activeOperation = null;
        if (operation === null) {
            return null;
        }

        try {
            operation.cancel();
            return null;
        } catch {
            return classifyParseError('documentCleanupFailed');
        }
    }

    private async completeOpen(generation: number, operation: IDocumentOpenOperation): Promise<void> {
        const result = await this.readCompletion(operation);
        if (generation !== this._generation) {
            if (result.ok) {
                const disposalError = await this.disposeSession(result.value);
                if (disposalError !== null) {
                    this._snapshot = createSnapshot(
                        this._snapshot.status,
                        this._snapshot.current,
                        this._snapshot.candidateDisplayName,
                        disposalError,
                    );
                }
            } else if (result.error.code === 'documentCleanupFailed') {
                this._snapshot = createSnapshot(
                    this._snapshot.status,
                    this._snapshot.current,
                    this._snapshot.candidateDisplayName,
                    result.error,
                );
            }
            return;
        }

        this._activeOperation = null;
        if (!result.ok) {
            this._snapshot =
                result.error.category === 'cancellation'
                    ? settledSnapshot(this._currentSession?.document ?? null)
                    : createSnapshot('failed', this._currentSession?.document ?? null, operation.displayName, result.error);
            return;
        }

        const previousSession = this._currentSession;
        this._currentSession = result.value;
        this._snapshot = settledSnapshot(result.value.document);
        if (previousSession === null) {
            return;
        }

        const disposalError = await this.disposeSession(previousSession);
        if (disposalError !== null) {
            this._snapshot =
                generation === this._generation
                    ? settledSnapshot(result.value.document, disposalError)
                    : createSnapshot(
                          this._snapshot.status,
                          this._snapshot.current,
                          this._snapshot.candidateDisplayName,
                          disposalError,
                      );
        }
    }

    private async disposeSession(session: IOpenedDocumentSession): Promise<ParseError | null> {
        try {
            const result = await session.dispose();
            return result.ok ? null : result.error;
        } catch {
            return classifyParseError('documentCleanupFailed');
        }
    }

    private async readCompletion(operation: IDocumentOpenOperation): Promise<DocumentOpenResult> {
        try {
            return await operation.completion;
        } catch {
            return err(classifyParseError('internalError'));
        }
    }
}
