export class ApplicationCommandController<TCommandId extends string> {
    private readonly _handlers = new Map<TCommandId, () => void>();

    public register(command: TCommandId, handler: () => void): () => void {
        this._handlers.set(command, handler);
        return () => {
            if (this._handlers.get(command) === handler) {
                this._handlers.delete(command);
            }
        };
    }

    public execute(command: TCommandId): void {
        this._handlers.get(command)?.();
    }
}
