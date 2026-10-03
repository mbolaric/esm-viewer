<script lang="ts">
    import { provideAppBranding } from '../app-branding.js';

    import CommandBar from '../CommandBar.svelte';

    interface IProps {
        icon?: string | undefined;
        label: string;
    }

    let { icon = undefined, label }: IProps = $props();

    // The composition root fixes branding for the app lifetime, so the harness captures the initial prop once.
    // svelte-ignore state_referenced_locally
    if (icon !== undefined) {
        provideAppBranding({ icon });
    }
</script>

{#snippet actions()}
    <span>{label}</span>
{/snippet}

<CommandBar appName="ESM Viewer" ariaLabel="Application commands" {actions} />
