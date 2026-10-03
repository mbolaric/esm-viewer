<script lang="ts">
    import type { ReopenToken } from '#contracts';
    import { useAppBranding } from '#shell';
    import { Button, InlineNotice, TaskState } from '#ui';
    import type { Snippet } from 'svelte';

    export interface IRecentFileListItem {
        readonly displayName: string;
        readonly openedAtDisplay: string | null;
        readonly reopenAriaLabel: string;
        readonly reopenToken: ReopenToken;
    }

    interface IProps {
        extraActions?: Snippet | undefined;
        clearRecentFilesLabel?: string | undefined;
        description: string;
        heading: string;
        helpHintDismissLabel?: string | undefined;
        helpHintOpenGuideLabel?: string | undefined;
        helpHintText?: string | undefined;
        helpHintVisible?: boolean;
        ondismisshelphint?: (() => void) | undefined;
        onclearrecent?: (() => void) | undefined;
        onopen: () => void;
        onopenguide?: (() => void) | undefined;
        onreopenrecent?: ((reopenToken: ReopenToken) => void) | undefined;
        openLabel: string;
        openTooltip: string;
        privacyLabel: string;
        recentFiles?: readonly IRecentFileListItem[];
        recentFilesHeading?: string | undefined;
        shortcutHint: string;
        supportedFilesLabel: string;
    }

    let {
        extraActions,
        clearRecentFilesLabel = undefined,
        description,
        heading,
        helpHintDismissLabel = undefined,
        helpHintOpenGuideLabel = undefined,
        helpHintText = undefined,
        helpHintVisible = false,
        ondismisshelphint = undefined,
        onclearrecent = undefined,
        onopen,
        onopenguide = undefined,
        onreopenrecent = undefined,
        openLabel,
        openTooltip,
        privacyLabel,
        recentFiles = [],
        recentFilesHeading = undefined,
        shortcutHint,
        supportedFilesLabel,
    }: IProps = $props();
    const appBranding = useAppBranding();

    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent || navigator.platform);
    const shortcutText = isMac ? '⌘O' : 'Ctrl+O';
</script>

{#snippet leading()}
    <img alt="" class="app-logo" height="64" src={appBranding.icon} width="64" />
{/snippet}

<TaskState title={heading} {description} {leading} glassmorphic={true}>
    <p class="support">{supportedFilesLabel}</p>
    <p class="privacy">{privacyLabel}</p>
    {#snippet actions()}
        <div class="welcome-actions">
            <Button
                icon="folderOpen"
                label={openLabel}
                onclick={onopen}
                tooltip={openTooltip.replace('{shortcut}', shortcutText)}
                variant="primary"
            />
            <span class="shortcut-hint">{shortcutHint.replace('{shortcut}', shortcutText)}</span>
            {#if extraActions !== undefined}
                <div class="welcome-divider"></div>
                {@render extraActions()}
            {/if}
        </div>
    {/snippet}
</TaskState>

{#if helpHintVisible && helpHintText !== undefined}
    <div class="help-hint">
        <InlineNotice
            actions={[
                ...(onopenguide ? [{ label: helpHintOpenGuideLabel ?? '', onclick: onopenguide }] : []),
                {
                    ariaLabel: helpHintDismissLabel ?? '',
                    icon: 'x' as const,
                    iconOnly: true,
                    label: helpHintDismissLabel ?? '',
                    onclick: () => ondismisshelphint?.(),
                },
            ]}
            label={helpHintText}
            role="note"
        />
    </div>
{/if}

{#if recentFiles.length > 0}
    <section aria-label={recentFilesHeading} class="recent-files">
        <div class="recent-files-header">
            <h2>{recentFilesHeading}</h2>
            {#if onclearrecent}
                <Button
                    icon="circleX"
                    label={clearRecentFilesLabel ?? ''}
                    onclick={onclearrecent}
                    size="compact"
                    variant="ghost"
                />
            {/if}
        </div>
        <ul>
            {#each recentFiles as file (file.reopenToken)}
                <li>
                    <div class="recent-file-name">
                        <Button
                            ariaLabel={file.reopenAriaLabel}
                            icon="folderOpen"
                            label={file.displayName}
                            onclick={() => onreopenrecent?.(file.reopenToken)}
                            tooltip={file.reopenAriaLabel}
                            truncate
                            variant="ghost"
                        />
                    </div>
                    {#if file.openedAtDisplay !== null}
                        <span class="recent-file-time">{file.openedAtDisplay}</span>
                    {/if}
                </li>
            {/each}
        </ul>
    </section>
{/if}

<style>
    p {
        margin: var(--space-none);
    }

    .support {
        font-weight: var(--font-weight-action);
    }

    .privacy {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .welcome-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-actions);
    }

    .shortcut-hint {
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
    }

    .welcome-divider {
        inline-size: var(--size-brand-mark);
        block-size: var(--border-width-hairline);
        background: var(--color-border);
        margin-block: var(--space-compact);
    }

    .help-hint {
        inline-size: var(--size-full);
        max-inline-size: var(--size-content-boundary);
        margin-block-start: var(--space-section);
        margin-inline: auto;
    }

    .recent-files {
        inline-size: var(--size-full);
        max-inline-size: var(--size-content-readable);
        margin-block-start: var(--space-section);
        margin-inline: auto;
    }

    .recent-files-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-compact);
    }

    .recent-files h2 {
        margin: var(--space-none);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        font-weight: var(--font-weight-action);
        text-transform: var(--text-transform-group);
        letter-spacing: var(--letter-spacing-group);
    }

    .recent-files ul {
        display: flex;
        flex-direction: column;
        gap: var(--space-compact);
        margin: var(--space-none);
        padding: var(--space-none);
        list-style: none;
    }

    .recent-files li {
        display: flex;
        align-items: center;
        gap: var(--space-compact);
    }

    /* Shrinks file name button to allow truncate ellipsis to engage. */
    .recent-file-name {
        flex: var(--layout-recent-file-name-flex);
        min-inline-size: var(--space-none);
    }

    .recent-file-time {
        flex: var(--layout-recent-file-time-flex);
        color: var(--color-text-muted);
        font-size: var(--font-size-metadata);
        white-space: nowrap;
    }
</style>
