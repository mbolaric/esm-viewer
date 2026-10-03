<script lang="ts">
    import { Button } from '#ui';
    import type { ComplianceExportStatus } from './compliance-export-status.svelte.js';

    interface ISaveAction {
        readonly label: string;
        readonly onclick: () => Promise<void> | void;
    }

    interface IProps {
        closeLabel: string;
        // Whether the document has all required export fields; independent of status.busy.
        exportAllowed?: boolean;
        onclose: () => void;
        onprint: () => Promise<void> | void;
        printLabel: string;
        saveHtml?: ISaveAction | undefined;
        savePdf?: ISaveAction | undefined;
        // Owned by parent dialog, shared with header ComplianceExportStatusText.
        status: ComplianceExportStatus;
    }

    let {
        closeLabel,
        exportAllowed = true,
        onclose,
        onprint,
        printLabel,
        saveHtml = undefined,
        savePdf = undefined,
        status,
    }: IProps = $props();

    const actionDisabled = $derived(status.busy || !exportAllowed);

    function handlePrint(): void {
        void status.run('printing', onprint);
    }

    function handleSaveHtml(): void {
        if (saveHtml === undefined) {
            return;
        }
        void status.run('exportingHtml', saveHtml.onclick);
    }

    function handleSavePdf(): void {
        if (savePdf === undefined) {
            return;
        }
        void status.run('exportingPdf', savePdf.onclick);
    }
</script>

<Button disabled={status.busy} label={closeLabel} onclick={onclose} />
<Button disabled={actionDisabled} label={printLabel} onclick={handlePrint} />
{#if saveHtml !== undefined}
    <Button disabled={actionDisabled} label={saveHtml.label} onclick={handleSaveHtml} />
{/if}
{#if savePdf !== undefined}
    <Button disabled={actionDisabled} label={savePdf.label} onclick={handleSavePdf} variant="primary" />
{/if}
