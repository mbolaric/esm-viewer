import { isTechnicalByte, isTechnicalText, isTechnicalUnsignedLong, type ITechnicalExtendedSerialNumber } from '#viewer-domain';

import type { ExtendedSerialNumber } from '../generated/esm_parser.js';

export function normalizeTechnicalExtendedSerialNumber(value: ExtendedSerialNumber): ITechnicalExtendedSerialNumber | null {
    if (
        !isTechnicalByte(value.manufacturerCode) ||
        !/^\d{4}$/u.test(value.monthYear) ||
        !isTechnicalUnsignedLong(value.serialNumber) ||
        !isTechnicalByte(value.type)
    ) {
        return null;
    }

    return {
        manufacturerCode: value.manufacturerCode,
        monthYear: value.monthYear,
        serialNumber: value.serialNumber,
        type: value.type,
    };
}

export function normalizeTechnicalText(value: string, maximumLength: number): string | null {
    const normalized = value.trim();
    return isTechnicalText(normalized, maximumLength) ? normalized : null;
}
