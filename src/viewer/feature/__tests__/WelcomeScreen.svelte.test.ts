import { isReopenToken } from '#contracts';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import WelcomeScreen from '../components/screens/WelcomeScreen.svelte';

describe('WelcomeScreen', () => {
    it('renders translated copy supplied by the composition boundary', () => {
        const onopen = vi.fn<() => void>();
        const rendered = render(WelcomeScreen, {
            description: 'Open a tachograph file.',
            heading: 'Open evidence',
            onopen,
            openLabel: 'Choose file',
            openTooltip: 'Open file ({shortcut})',
            privacyLabel: 'Local only',
            shortcutHint: 'Or press {shortcut}',
            supportedFilesLabel: 'Card and VU files',
        });

        expect(screen.getByRole('heading', { name: 'Open evidence' })).toBeTruthy();
        expect(screen.getByText('Open a tachograph file.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Choose file' })).toBeTruthy();
        expect(rendered.container.querySelector('img.app-logo')).toBeTruthy();
        expect(rendered.container.querySelector('img.app-logo')?.getAttribute('src')).toBeTruthy();
    });

    it('renders no recent-files section when the list is empty', () => {
        render(WelcomeScreen, {
            description: 'Open a tachograph file.',
            heading: 'Open evidence',
            onopen: vi.fn<() => void>(),
            openLabel: 'Choose file',
            openTooltip: 'Open file ({shortcut})',
            privacyLabel: 'Local only',
            recentFilesHeading: 'Recent files',
            shortcutHint: 'Or press {shortcut}',
            supportedFilesLabel: 'Card and VU files',
        });

        expect(screen.queryByText('Recent files')).toBeNull();
    });

    it('reopens a recent file by its display name only, never its path, and can clear the list', async () => {
        const reopenToken = '/private/tachograph/card.ddd';
        if (!isReopenToken(reopenToken)) {
            throw new TypeError('The reopen-token fixture must be valid.');
        }
        const onreopenrecent = vi.fn<(token: typeof reopenToken) => void>();
        const onclearrecent = vi.fn<() => void>();
        render(WelcomeScreen, {
            clearRecentFilesLabel: 'Clear recent files',
            description: 'Open a tachograph file.',
            heading: 'Open evidence',
            onclearrecent,
            onopen: vi.fn<() => void>(),
            onreopenrecent,
            openLabel: 'Choose file',
            openTooltip: 'Open file ({shortcut})',
            privacyLabel: 'Local only',
            recentFiles: [
                {
                    displayName: 'card.ddd',
                    openedAtDisplay: '2026-01-10',
                    reopenAriaLabel: 'Reopen card.ddd',
                    reopenToken,
                },
            ],
            recentFilesHeading: 'Recent files',
            shortcutHint: 'Or press {shortcut}',
            supportedFilesLabel: 'Card and VU files',
        });

        expect(screen.getByText('Recent files')).toBeTruthy();
        const item = screen.getByRole('button', { name: 'Reopen card.ddd' });
        expect(item.textContent).not.toContain('/private');
        expect(screen.getByText('2026-01-10')).toBeTruthy();

        await fireEvent.click(item);
        expect(onreopenrecent).toHaveBeenCalledWith(reopenToken);

        await fireEvent.click(screen.getByRole('button', { name: 'Clear recent files' }));
        expect(onclearrecent).toHaveBeenCalledOnce();
    });
});
