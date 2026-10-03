import { describe, expect, it } from 'vitest';

import { isUtcTimestamp, type UtcTimestamp } from '#viewer-domain';

import { ViewerDocumentSession } from '../controllers/viewer-document-session.svelte.js';

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The session fixture timestamp must be valid.');
    }
    return value;
}

describe('ViewerDocumentSession', () => {
    it('resets every filter, search, speed range, and activity link when another document opens', () => {
        const session = new ViewerDocumentSession();
        session.syncDocumentKey('first');
        session.eventFaultFilter.set('fault');
        session.placesSearchText.set('Berlin');
        session.setSpeedRange(timestamp(1_000), timestamp(2_000));
        session.setSpeedPage(3);
        session.linkedActivityDay.set({ label: '1 Jan', midnight: timestamp(0) });

        session.syncDocumentKey('second');

        expect(session.eventFaultFilter.value).toBe('all');
        expect(session.placesSearchText.value).toBe('');
        expect(session.speedRangeStart.value).toBeNull();
        expect(session.speedRangeEnd.value).toBeNull();
        expect(session.speedPage.value).toBe(0);
        expect(session.linkedActivityDay.value).toBeNull();
    });

    it('keeps values while the same document stays open', () => {
        const session = new ViewerDocumentSession();
        session.syncDocumentKey('first');
        session.technicalSearchText.set('VIN');

        session.syncDocumentKey('first');

        expect(session.technicalSearchText.value).toBe('VIN');
    });

    it('starts a new speed range on its first page and clamps page requests', () => {
        const session = new ViewerDocumentSession();
        session.setSpeedPage(4);

        session.setSpeedRange(timestamp(1_000), timestamp(2_000));
        expect(session.speedPage.value).toBe(0);

        session.setSpeedPage(-2.5);
        expect(session.speedPage.value).toBe(0);
        session.setSpeedPage(2.7);
        expect(session.speedPage.value).toBe(2);
    });
});
