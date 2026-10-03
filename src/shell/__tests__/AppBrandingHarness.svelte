<script lang="ts">
    import { provideAppBranding, useAppBranding } from '../app-branding.js';

    interface IProps {
        icon?: string | undefined;
    }

    let { icon = undefined }: IProps = $props();

    // The composition root fixes branding for the app lifetime, so the harness captures the initial prop once.
    // svelte-ignore state_referenced_locally
    if (icon !== undefined) {
        provideAppBranding({ icon });
    }

    const appBranding = useAppBranding();
</script>

<img alt="" data-testid="brand-icon" src={appBranding.icon} />
