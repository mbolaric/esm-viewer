export interface ILatestRequestOptions<TData, TError> {
    // Classifies a failure into the caller's typed error state.
    readonly classifyError: (error: unknown) => TError;
    // Value shown while no response has been applied, including during each new load.
    readonly initialData: TData;
    // Receives failures of the current request only; stale failures are dropped silently.
    readonly onError?: ((error: unknown) => Promise<void>) | undefined;
    // When true, preserves the previous response during each new load instead of resetting to initialData.
    readonly retainDataOnRun?: boolean | undefined;
}

// Async load state where only the most recent request may write results, so a slow earlier response can never
// overwrite a newer one after the user changes the range or leaves the screen.
export class LatestRequest<TData, TError> {
    readonly #_classifyError: (error: unknown) => TError;
    readonly #_initialData: TData;
    readonly #_onError: ((error: unknown) => Promise<void>) | undefined;
    readonly #_retainDataOnRun: boolean;
    #_generation = 0;
    #_data: TData;
    #_error: TError | null;
    #_isLoading: boolean;

    public constructor(options: ILatestRequestOptions<TData, TError>) {
        this.#_classifyError = options.classifyError;
        this.#_initialData = options.initialData;
        this.#_onError = options.onError;
        this.#_retainDataOnRun = options.retainDataOnRun ?? false;
        this.#_data = $state.raw(options.initialData);
        this.#_error = $state(null);
        this.#_isLoading = $state(false);
    }

    public get data(): TData {
        return this.#_data;
    }

    public get error(): TError | null {
        return this.#_error;
    }

    public get isLoading(): boolean {
        return this.#_isLoading;
    }

    // `isCurrent` lets multi-step loads stop early once superseded; whatever they return is then discarded.
    public async run(load: (isCurrent: () => boolean) => Promise<TData>): Promise<void> {
        this.#_generation += 1;
        const generation = this.#_generation;
        const isCurrent = (): boolean => generation === this.#_generation;
        this.#_isLoading = true;
        this.#_error = null;
        if (!this.#_retainDataOnRun) {
            this.#_data = this.#_initialData;
        }
        try {
            const data = await load(isCurrent);
            if (isCurrent()) {
                this.#_data = data;
            }
        } catch (error: unknown) {
            if (!isCurrent()) {
                return;
            }
            this.#_error = this.#_classifyError(error);
            await this.#_onError?.(error);
        } finally {
            if (isCurrent()) {
                this.#_isLoading = false;
            }
        }
    }

    // Abandons any in-flight request while keeping the last applied result and error.
    public cancel(): void {
        this.#_generation += 1;
        this.#_isLoading = false;
    }

    // Abandons any in-flight request and returns to the initial state.
    public reset(): void {
        this.cancel();
        this.#_data = this.#_initialData;
        this.#_error = null;
    }
}
