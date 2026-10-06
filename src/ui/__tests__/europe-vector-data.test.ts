import { describe, expect, it } from 'vitest';

import {
    EUROPE_COUNTRIES,
    getApproximateCountryPosition,
    getCountryCentroid,
    isPointInsideCountry,
} from '../map/europe-vector-data.js';

function isInsideCountry(code: string, point: readonly [number, number] | null): boolean {
    return point !== null && isPointInsideCountry(code, point);
}

describe('getApproximateCountryPosition', () => {
    it('returns null for an unrecognized country code', () => {
        expect(getApproximateCountryPosition('ZZ', -1)).toBeNull();
        expect(getApproximateCountryPosition('ZZ', 1)).toBeNull();
    });

    it('translates EU vehicle distinguishing signs that differ from ISO codes', () => {
        // Resolves tachograph sign 'D' to ISO 'DE' centroid.
        expect(getApproximateCountryPosition('D', -1)).not.toBeNull();
        expect(getApproximateCountryPosition('A', -1)).not.toBeNull();
    });

    it('translates the South-East European signs whose recorded spelling is not their ISO code', () => {
        // 'SRB', 'BIH' and 'MNE' are the Annex 1C signs; the geometry and centroids are ISO-coded.
        expect(isInsideCountry('RS', getApproximateCountryPosition('SRB', -1))).toBe(true);
        expect(isInsideCountry('BA', getApproximateCountryPosition('BIH', 1))).toBe(true);
        expect(isInsideCountry('ME', getApproximateCountryPosition('MNE', -1))).toBe(true);
    });

    it('offsets the start and end positions in opposite directions so they never collapse onto the same point', () => {
        const start = getApproximateCountryPosition('DE', -1);
        const end = getApproximateCountryPosition('DE', 1);

        expect(start).not.toBeNull();
        expect(end).not.toBeNull();
        expect(start).not.toEqual(end);
    });

    it("keeps every country code in the map dataset inside that country's own polygon, for both offset directions", () => {
        for (const country of EUROPE_COUNTRIES) {
            const centroid = getCountryCentroid(country.code);
            if (centroid === null) {
                continue;
            }
            const start = getApproximateCountryPosition(country.code, -1);
            const end = getApproximateCountryPosition(country.code, 1);

            expect(isInsideCountry(country.code, start)).toBe(true);
            expect(isInsideCountry(country.code, end)).toBe(true);
        }
    });

    it('stays inside a narrow, concave country (Croatia) that a fixed 0.3-degree offset alone would escape', () => {
        const start = getApproximateCountryPosition('HR', -1);
        const end = getApproximateCountryPosition('HR', 1);

        expect(isInsideCountry('HR', start)).toBe(true);
        expect(isInsideCountry('HR', end)).toBe(true);
    });

    it('stays inside a small country (Luxembourg) where a 0.3-degree offset alone would escape', () => {
        const start = getApproximateCountryPosition('LU', -1);
        const end = getApproximateCountryPosition('LU', 1);

        expect(isInsideCountry('LU', start)).toBe(true);
        expect(isInsideCountry('LU', end)).toBe(true);
    });
});
