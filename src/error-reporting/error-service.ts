import type { ErrorSeverity, ErrorSource, IErrorEvent } from '#contracts';

export interface IErrorEventBase {
    readonly code: string;
    readonly severity: ErrorSeverity;
    readonly source: ErrorSource;
}

export type IErrorRecord<TEvent extends IErrorEventBase = IErrorEvent> = TEvent & {
    readonly occurredAt: string;
    // Correlation trace ID matching OpenTelemetry TraceId shape.
    readonly traceId: string;
};

export interface IErrorProvider<TEvent extends IErrorEventBase = IErrorEvent> {
    // Optional raw detail passed to local providers only.
    report(error: IErrorRecord<TEvent>, detail?: unknown): Promise<void> | void;
}

export interface IErrorService<TEvent extends IErrorEventBase = IErrorEvent> {
    report(error: TEvent, detail?: unknown): Promise<void>;
}

export type ErrorClock = () => string;
export type TraceIdGenerator = () => string;

const systemClock: ErrorClock = () => new Date().toISOString();

function systemTraceIdGenerator(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Logs uncaught boundary render errors to local console.
export function logBoundaryError(scope: string, error: unknown): void {
    console.error(`[boundary:${scope}] uncaught render error`, error);
}

export class ErrorService<TEvent extends IErrorEventBase = IErrorEvent> implements IErrorService<TEvent> {
    readonly #_clock: ErrorClock;
    readonly #_generateTraceId: TraceIdGenerator;
    readonly #_providers: readonly IErrorProvider<TEvent>[];

    public constructor(
        providers: readonly IErrorProvider<TEvent>[],
        clock: ErrorClock = systemClock,
        generateTraceId: TraceIdGenerator = systemTraceIdGenerator,
    ) {
        this.#_clock = clock;
        this.#_generateTraceId = generateTraceId;
        this.#_providers = providers;
    }

    public async report(error: TEvent, detail?: unknown): Promise<void> {
        const record: IErrorRecord<TEvent> = {
            ...error,
            occurredAt: this.#_clock(),
            traceId: this.#_generateTraceId(),
        };

        await Promise.allSettled(
            this.#_providers.map(async (provider) => {
                await provider.report(record, detail);
            }),
        );
    }
}
