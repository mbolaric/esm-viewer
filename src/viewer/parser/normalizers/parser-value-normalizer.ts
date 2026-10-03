import { err, isUnknownRecord, ok, type Result } from '#contracts';
import {
    isIssuingMemberState,
    isOdometerKilometres,
    isUtcTimestamp,
    type IssuingMemberState,
    type ITachographWarning,
    type OdometerKilometres,
    type TachographGeneration,
    type UtcTimestamp,
} from '#viewer-domain';

import type { Datef, NationNumeric, OdometerShort, TimeReal } from '../generated/esm_parser.js';

export type ParserNationAlphaCodes = Readonly<Record<string, IssuingMemberState>>;
export type ParserNationAlphaCodesDecodeError = 'invalidParserNationAlphaCodes';

export interface IParserOdometerNormalization {
    readonly status: 'absent' | 'invalid' | 'supported';
    readonly value: OdometerKilometres | null;
}

export type ParserWarningFactory = (
    code: ITachographWarning['code'],
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
) => ITachographWarning;

const maximumSupportedNations = 256;
const maximumParserNationNameLength = 64;
const parserNationNamePattern = /^[A-Z][A-Za-z0-9]*$/u;
const parserUtcTimestampPattern =
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}) (?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2}) UTC$/u;

// Annex IC defines TimeReal as seconds since 1970, and its maximum value falls on 2106-02-07 06:28:15 UTC. A unit
// that has nothing to record for a field leaves that maximum behind - a card still inserted at download has no
// withdrawal time - and a zero stands for the same in the files handled here. Both mean "no value", not a date.
const timeRealNotSetMilliseconds = 4_294_967_295_000;

function readTimestampPart(groups: Readonly<Record<string, string | undefined>>, key: string): number {
    const value = groups[key];

    return value === undefined ? Number.NaN : Number(value);
}

export function decodeParserNationAlphaCodes(value: unknown): Result<ParserNationAlphaCodes, ParserNationAlphaCodesDecodeError> {
    if (!isUnknownRecord(value)) {
        return err('invalidParserNationAlphaCodes');
    }

    const entries = Object.entries(value);
    if (entries.length === 0 || entries.length > maximumSupportedNations) {
        return err('invalidParserNationAlphaCodes');
    }

    const codes: Record<string, IssuingMemberState> = {};
    for (const [parserNation, nationAlpha] of entries) {
        if (
            parserNation.length > maximumParserNationNameLength ||
            !parserNationNamePattern.test(parserNation) ||
            !isIssuingMemberState(nationAlpha)
        ) {
            return err('invalidParserNationAlphaCodes');
        }
        codes[parserNation] = nationAlpha;
    }

    return ok(codes);
}

export function normalizeParserNation(value: NationNumeric, nationAlphaCodes: ParserNationAlphaCodes): IssuingMemberState | null {
    return nationAlphaCodes[value] ?? null;
}

const odometerAbsent: IParserOdometerNormalization = {
    status: 'absent',
    value: null,
};
const odometerInvalid: IParserOdometerNormalization = {
    status: 'invalid',
    value: null,
};

function normalizeParserOdometer(value: OdometerShort): IParserOdometerNormalization {
    if (value === null) {
        return odometerAbsent;
    }

    return isOdometerKilometres(value)
        ? {
              status: 'supported',
              value,
          }
        : odometerInvalid;
}

export function normalizeParserOdometerWithWarning(
    value: OdometerShort,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
    warning: ParserWarningFactory,
): OdometerKilometres | null {
    const normalized = normalizeParserOdometer(value);
    if (normalized.status === 'invalid') {
        warnings.push(warning('invalidValue', generation, pathTokens));
    }
    return normalized.value;
}

export function normalizeParserUtcTimestamp(value: TimeReal): UtcTimestamp | null {
    if (value === null) {
        return null;
    }

    const match = parserUtcTimestampPattern.exec(value);
    if (match?.groups === undefined) {
        return null;
    }

    const year = readTimestampPart(match.groups, 'year');
    const month = readTimestampPart(match.groups, 'month');
    const day = readTimestampPart(match.groups, 'day');
    const hour = readTimestampPart(match.groups, 'hour');
    const minute = readTimestampPart(match.groups, 'minute');
    const second = readTimestampPart(match.groups, 'second');

    if (year === 0 && month === 0 && day === 0 && hour === 0 && minute === 0 && second === 0) {
        const zeroTimestamp = 0;
        return isUtcTimestamp(zeroTimestamp) ? zeroTimestamp : null;
    }

    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
    const timestamp = date.getTime();

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day ||
        date.getUTCHours() !== hour ||
        date.getUTCMinutes() !== minute ||
        date.getUTCSeconds() !== second
    ) {
        return null;
    }

    return isUtcTimestamp(timestamp) ? timestamp : null;
}

// Tells a decoded TimeReal that carries a recorded moment from one the unit left unfilled.
export function isRecordedParserTimestamp(timestamp: UtcTimestamp | null): timestamp is UtcTimestamp {
    return timestamp !== null && timestamp !== 0 && timestamp !== timeRealNotSetMilliseconds;
}

export function normalizeParserDatef(value: Datef | null | undefined): UtcTimestamp | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (!/^\d{4}$/u.test(value.year) || !/^\d{2}$/u.test(value.month) || !/^\d{2}$/u.test(value.day)) {
        return null;
    }

    const year = Number(value.year);
    const month = Number(value.month);
    const day = Number(value.day);

    if (year <= 0 || month <= 0 || month > 12 || day <= 0 || day > 31) {
        return null;
    }

    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    const timestamp = date.getTime();

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }

    return isUtcTimestamp(timestamp) ? timestamp : null;
}
