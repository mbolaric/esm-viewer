<script lang="ts">
    import { Navigator, type INavigatorGroup } from '#ui';
    import type { DocumentWorkspaceSection } from '#viewer-application';
    import type { DocumentKind } from '#viewer-domain';

    import type { TranslationKey } from '#i18n-locales';
    import { useViewerTranslationService } from '../../viewer-context.js';
    import { sectionIcons, translateDocumentSection } from '../../helpers/viewer-labels.js';

    type NavigationGroupId = 'evidence' | 'records' | 'summary';

    interface INavigationGroup {
        readonly id: NavigationGroupId;
        readonly sections: readonly DocumentWorkspaceSection[];
    }

    interface IProps {
        availableSections: readonly DocumentWorkspaceSection[];
        disabled: boolean;
        documentKind: DocumentKind;
        onselect: (section: DocumentWorkspaceSection) => void;
        selectedSection: DocumentWorkspaceSection;
    }

    let { availableSections, disabled, documentKind, onselect, selectedSection }: IProps = $props();
    let pendingSection = $state<DocumentWorkspaceSection | null>(null);

    const translationService = useViewerTranslationService();
    const groupTranslationKeys = {
        evidence: 'navigator.group.evidence',
        records: 'navigator.group.records',
        summary: 'navigator.group.summary',
    } satisfies Readonly<Record<NavigationGroupId, TranslationKey>>;
    const groups = [
        {
            id: 'summary',
            sections: ['overview', 'compliance', 'comparison'],
        },
        {
            id: 'records',
            sections: ['activities', 'associations', 'places', 'eventsAndFaults'],
        },
        {
            id: 'evidence',
            sections: ['technical', 'speed', 'integrity', 'rawData'],
        },
    ] as const satisfies readonly INavigationGroup[];

    function groupIsAvailable(group: INavigationGroup): boolean {
        return group.sections.some((section) => availableSections.includes(section));
    }

    function groupLabel(group: NavigationGroupId): string {
        return translationService.translate(groupTranslationKeys[group]);
    }

    function sectionLabel(section: DocumentWorkspaceSection): string {
        return translateDocumentSection(section, documentKind, translationService);
    }

    function dispatchPending(): void {
        const target = pendingSection;
        pendingSection = null;
        if (target !== null) {
            onselect(target);
        }
    }

    function handleSelect(section: DocumentWorkspaceSection): void {
        if (section === selectedSection) {
            return;
        }
        // Last click wins: redirects pending callback to newest target.
        const alreadyPending = pendingSection !== null;
        pendingSection = section;
        if (alreadyPending) {
            return;
        }
        if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.requestAnimationFrame(() => {
                globalThis.setTimeout(dispatchPending, 0);
            });
        } else {
            globalThis.setTimeout(dispatchPending, 0);
        }
    }

    let navigatorGroups = $derived<readonly INavigatorGroup[]>(
        groups
            .filter((group) => groupIsAvailable(group))
            .map((group) => ({
                heading: groupLabel(group.id),
                items: group.sections
                    .filter((section) => availableSections.includes(section))
                    .map((section) => ({
                        badgeCount: null,
                        badgeVariant: null,
                        // Kept enabled during transitions to prevent visual flicker; handleSelect guards concurrency.
                        disabled,
                        icon: sectionIcons[section],
                        label: sectionLabel(section),
                        loading: pendingSection === section,
                        onselect: () => {
                            handleSelect(section);
                        },
                        selected: section === selectedSection || pendingSection === section,
                    })),
            })),
    );
</script>

<Navigator
    ariaLabel={translationService.translate('navigator.ariaLabel')}
    closeLabel={translationService.translate('navigator.close')}
    drawerId="document-navigation-drawer"
    groups={navigatorGroups}
    padding={true}
/>
