export type ComplianceExportBusyAction = 'exportingHtml' | 'exportingPdf' | 'printing' | null;

// Shared reactive busy state coordinator for compliance export dialogs.
export class ComplianceExportStatus {
    #_busyAction = $state<ComplianceExportBusyAction>(null);

    public get busyAction(): ComplianceExportBusyAction {
        return this.#_busyAction;
    }

    public get busy(): boolean {
        return this.#_busyAction !== null;
    }

    // Executes callback under the specified busy action, preventing concurrent operations.
    public async run(action: Exclude<ComplianceExportBusyAction, null>, callback: () => Promise<void> | void): Promise<void> {
        if (this.busy) {
            return;
        }
        this.#_busyAction = action;
        try {
            await callback();
        } finally {
            this.#_busyAction = null;
        }
    }
}
