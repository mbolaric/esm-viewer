import type { ITachographWarning, TachographGeneration, UtcTimestamp } from '#viewer-domain';

import { createNormalizationSourceContext } from '../normalization-source.js';
import { isRecordedParserTimestamp, normalizeParserUtcTimestamp } from '../normalizers/parser-value-normalizer.js';

const { warning } = createNormalizationSourceContext('vehicleUnit');

// A timestamp the record cannot do without: unreadable or unrecorded value is an invalid value.
export function requiredTimestamp(
    value: string | null,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): UtcTimestamp | null {
    const timestamp = normalizeParserUtcTimestamp(value);
    if (!isRecordedParserTimestamp(timestamp)) {
        warnings.push(warning('invalidValue', generation, pathTokens));
        return null;
    }
    return timestamp;
}

// A timestamp that may be unset: null or unrecorded value means absent; only an unreadable value is invalid.
export function optionalTimestamp(
    value: string | null,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): UtcTimestamp | null {
    if (value === null) {
        return null;
    }
    const timestamp = normalizeParserUtcTimestamp(value);
    if (timestamp === null) {
        warnings.push(warning('invalidValue', generation, pathTokens));
        return null;
    }
    return isRecordedParserTimestamp(timestamp) ? timestamp : null;
}
