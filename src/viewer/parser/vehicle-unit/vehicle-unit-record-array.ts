import type { Gen2DataInfoGenericRecordArray, RecordType } from '../generated/esm_parser.js';

export function decodeVehicleUnitRecordArray<TRecord>(
    value: Gen2DataInfoGenericRecordArray<TRecord>,
    maximumRecords: number,
    expectedRecordType: RecordType,
): readonly TRecord[] | null {
    if (
        !Number.isInteger(value.noOfRecords) ||
        value.noOfRecords < 0 ||
        value.noOfRecords !== value.records.length ||
        !Number.isInteger(value.recordSize) ||
        value.recordSize <= 0 ||
        value.recordSize > 0xff_ff ||
        value.recordType !== expectedRecordType ||
        value.records.length > maximumRecords
    ) {
        return null;
    }

    return value.records;
}

// Gen1 lists declare their length in a separate count field; a list whose count disagrees or that exceeds the bound is
// inconsistent. A count equal to an array length is necessarily a non-negative integer.
export function decodeVehicleUnitCountedRecords<TRecord>(
    count: number,
    records: readonly TRecord[],
    maximumRecords: number,
): readonly TRecord[] | null {
    return count === records.length && records.length <= maximumRecords ? records : null;
}
