import type { AssociationGenerationFilter, EventFaultTypeFilter, LocationRecordTypeFilter } from '#viewer-application';
import type { UtcTimestamp } from '#viewer-domain';
import type { IActivityInfringementPinViewModel } from '#viewer-presentation';

import { createDocumentScopedValue, type IDocumentScopedValue } from './document-scoped-value.svelte.js';

export interface ILinkedActivityDay {
    readonly label: string;
    readonly midnight: UtcTimestamp;
}

// Per-document viewing state (section filters, table searches, speed range, activity links) that must start fresh
// whenever another document is opened. Every value is registered on creation, so one sync resets them all.
export class ViewerDocumentSession {
    readonly #_values: { syncDocumentKey(documentKey: string): void }[] = [];

    public readonly associationFilter = this.scoped<AssociationGenerationFilter>('all');
    public readonly eventFaultFilter = this.scoped<EventFaultTypeFilter>('all');
    public readonly locationFilter = this.scoped<LocationRecordTypeFilter>('all');

    public readonly activitiesAllDaysSearchText = this.scoped('');
    public readonly activitiesCalendarSearchText = this.scoped('');
    public readonly activitiesDaySearchText = this.scoped('');
    public readonly associationsSearchText = this.scoped('');
    public readonly comparisonSearchText = this.scoped('');
    public readonly eventsAndFaultsSearchText = this.scoped('');
    public readonly integritySearchText = this.scoped('');
    public readonly placesSearchText = this.scoped('');
    public readonly speedOverspeedSearchText = this.scoped('');
    public readonly speedSampleSearchText = this.scoped('');
    public readonly technicalSearchText = this.scoped('');

    public readonly speedRangeEnd = this.scoped<UtcTimestamp | null>(null);
    public readonly speedRangeStart = this.scoped<UtcTimestamp | null>(null);
    public readonly speedPage = this.scoped(0);

    public readonly linkedActivityDay = this.scoped<ILinkedActivityDay | null>(null);
    public readonly selectedActivityInfringement = this.scoped<IActivityInfringementPinViewModel | null>(null);

    public syncDocumentKey(documentKey: string): void {
        for (const value of this.#_values) {
            value.syncDocumentKey(documentKey);
        }
    }

    public setSpeedPage(pageIndex: number): void {
        this.speedPage.set(Math.max(0, Math.floor(pageIndex)));
    }

    // A new range always starts on its first page; `null` bounds show the whole recording.
    public setSpeedRange(start: UtcTimestamp | null, end: UtcTimestamp | null): void {
        this.speedRangeStart.set(start);
        this.speedRangeEnd.set(end);
        this.speedPage.set(0);
    }

    private scoped<TValue>(initial: TValue): IDocumentScopedValue<TValue> {
        const value = createDocumentScopedValue(initial);
        this.#_values.push(value);
        return value;
    }
}
