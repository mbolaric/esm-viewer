import { isUnknownRecord } from '#contracts';

import type { VerifyResultStatus } from '../generated/esm_parser.js';

const aggregateAssessmentStatus = {
    Invalid: 'invalid',
    PartiallyValid: 'partiallyValid',
    Valid: 'valid',
} as const satisfies Readonly<Record<Exclude<VerifyResultStatus, 'Unsigned'>, string>>;

// The parser's aggregate status must agree with the status recomputed from its items; an unsigned result never does.
export function isExpectedAggregateStatus(parserStatus: VerifyResultStatus, assessmentStatus: string): boolean {
    return parserStatus !== 'Unsigned' && aggregateAssessmentStatus[parserStatus] === assessmentStatus;
}

// Card and vehicle-unit verification results share one outer shape: a known status and an item array.
export function hasVerifyResultShape(value: unknown): boolean {
    if (!isUnknownRecord(value)) {
        return false;
    }
    const { status, result } = value;
    return (
        (status === 'Unsigned' || status === 'Valid' || status === 'PartiallyValid' || status === 'Invalid') &&
        Array.isArray(result)
    );
}
