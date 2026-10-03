import { isFileDisplayName, isReopenToken, type IRecentFileEntry } from '#contracts';
import { describe, expect, it } from 'vitest';

import { createRecentFilesViewModel } from '../view-models/recent-files-view-model.js';

import { localisation } from './activity-view-model-fixture.js';

function entry(openedAtEpochMs: number): IRecentFileEntry {
    const displayName = 'card.ddd';
    const reopenToken = '/private/tachograph/card.ddd';
    if (!isFileDisplayName(displayName) || !isReopenToken(reopenToken)) {
        throw new TypeError('The recent-file fixture must be valid.');
    }
    return { displayName, openedAtEpochMs, reopenToken };
}

describe('createRecentFilesViewModel', () => {
    it('formats a valid opened-at timestamp and preserves order and identity', () => {
        const viewModel = createRecentFilesViewModel([entry(Date.UTC(2026, 0, 10))], localisation());

        expect(viewModel).toEqual([
            {
                displayName: 'card.ddd',
                openedAt: {
                    display: `date-time:${String(Date.UTC(2026, 0, 10))}`,
                    value: Date.UTC(2026, 0, 10),
                },
                reopenToken: '/private/tachograph/card.ddd',
            },
        ]);
    });

    it('reports no formatted time rather than throwing for a corrupted timestamp', () => {
        const viewModel = createRecentFilesViewModel([entry(Number.MAX_SAFE_INTEGER)], localisation());

        expect(viewModel).toEqual([
            {
                displayName: 'card.ddd',
                openedAt: null,
                reopenToken: '/private/tachograph/card.ddd',
            },
        ]);
    });
});
