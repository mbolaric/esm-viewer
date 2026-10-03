import {
    createVehicleUnitCompanyLockTechnicalRecord,
    type ITachographWarning,
    type TachographGeneration,
    type VehicleUnitTechnicalRecord,
} from '#viewer-domain';

import type { Gen1VuCompanyLocksRecord, Gen2VuCompanyLocksRecord, TimeReal } from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { isRecordedParserTimestamp, normalizeParserUtcTimestamp } from '../normalizers/parser-value-normalizer.js';
import { decodeVehicleUnitCountedRecords, decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';
import { iterateVehicleUnitOverviewSources } from './vehicle-unit-overview-source.js';

export interface INormalizedVehicleUnitCompanyLocks {
    readonly records: readonly VehicleUnitTechnicalRecord[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumCompanyLocksPerParameter = 4_096;

const { source, warning } = createNormalizationSourceContext('vehicleUnit');

interface ICompanyLockRecordInput {
    readonly cardNumber: string;
    readonly cardNumberPathTokens: readonly string[];
    readonly companyAddress: string;
    readonly companyName: string;
    readonly lockInTime: TimeReal;
    readonly lockOutTime: TimeReal;
}

function createCompanyLockRecord(
    input: ICompanyLockRecordInput,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): VehicleUnitTechnicalRecord | null {
    const lockInTime = normalizeParserUtcTimestamp(input.lockInTime);
    if (!isRecordedParserTimestamp(lockInTime)) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'lockInTime']));
        return null;
    }

    const rawLockOutTime = normalizeParserUtcTimestamp(input.lockOutTime);
    if (input.lockOutTime !== null && rawLockOutTime === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'lockOutTime']));
    }
    const lockOutTime = isRecordedParserTimestamp(rawLockOutTime) ? rawLockOutTime : null;

    const companyName = input.companyName.trim();
    const companyAddress = input.companyAddress.trim();
    if (companyName.length === 0) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'companyName']));
        return null;
    }
    if (companyAddress.length === 0) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'companyAddress']));
        return null;
    }

    const cardNumber = input.cardNumber.trim();
    if (cardNumber.length === 0) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, ...input.cardNumberPathTokens]));
        return null;
    }

    return createVehicleUnitCompanyLockTechnicalRecord({
        companyAddress,
        companyCardNumber: cardNumber,
        companyName,
        lockInTime,
        lockOutTime,
        source: source(generation, pathTokens),
    });
}

function normalizeGen1CompanyLockRecord(
    lock: Gen1VuCompanyLocksRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): VehicleUnitTechnicalRecord | null {
    return createCompanyLockRecord(
        {
            cardNumber: lock.companyCardNumber.cardNumber,
            cardNumberPathTokens: ['companyCardNumber', 'cardNumber'],
            companyAddress: lock.companyAddress,
            companyName: lock.companyName,
            lockInTime: lock.lockInTime,
            lockOutTime: lock.lockOutTime,
        },
        generation,
        pathTokens,
        warnings,
    );
}

function normalizeGen2CompanyLockRecord(
    lock: Gen2VuCompanyLocksRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): VehicleUnitTechnicalRecord | null {
    return createCompanyLockRecord(
        {
            cardNumber: lock.companyCardNumberAndGeneration.fullcardNumber.cardNumber,
            cardNumberPathTokens: ['companyCardNumberAndGeneration', 'fullcardNumber', 'cardNumber'],
            companyAddress: lock.companyAddress,
            companyName: lock.companyName,
            lockInTime: lock.lockInTime,
            lockOutTime: lock.lockOutTime,
        },
        generation,
        pathTokens,
        warnings,
    );
}

export function normalizeVehicleUnitCompanyLocks(
    parameters: readonly ParserVehicleUnitTransferParameter[],
): INormalizedVehicleUnitCompanyLocks {
    const warnings: ITachographWarning[] = [];
    const records: VehicleUnitTechnicalRecord[] = [];

    for (const source of iterateVehicleUnitOverviewSources(parameters)) {
        const { generation, overview, pathTokens } = source;

        if (generation === 'g1') {
            if (!('vuCompanyLocksData' in overview)) {
                continue;
            }
            const lockData = overview.vuCompanyLocksData;
            const rawLocks = lockData.company_locks;
            const count = lockData.no_of_locks;

            if (decodeVehicleUnitCountedRecords(count, rawLocks, maximumCompanyLocksPerParameter) === null) {
                warnings.push(warning('inconsistentData', generation, [...pathTokens, 'Control', 'vuCompanyLocksData']));
                continue;
            }

            for (let lockIndex = 0; lockIndex < rawLocks.length; lockIndex++) {
                const lock = rawLocks[lockIndex];
                if (lock !== undefined) {
                    const record = normalizeGen1CompanyLockRecord(
                        lock,
                        generation,
                        [...pathTokens, 'Control', 'vuCompanyLocksData', 'company_locks', lockIndex],
                        warnings,
                    );
                    if (record !== null) {
                        records.push(record);
                    }
                }
            }
        } else {
            if (!('vuCompanyLocksRecordArray' in overview)) {
                continue;
            }
            const result = decodeVehicleUnitRecordArray(
                overview.vuCompanyLocksRecordArray,
                maximumCompanyLocksPerParameter,
                'VuCompanyLocksRecord',
            );
            if (result === null) {
                warnings.push(warning('inconsistentData', generation, [...pathTokens, 'Control', 'vuCompanyLocksRecordArray']));
                continue;
            }

            for (let lockIndex = 0; lockIndex < result.length; lockIndex++) {
                const lock = result[lockIndex];
                if (lock !== undefined) {
                    const record = normalizeGen2CompanyLockRecord(
                        lock,
                        generation,
                        [...pathTokens, 'Control', 'vuCompanyLocksRecordArray', 'records', lockIndex],
                        warnings,
                    );
                    if (record !== null) {
                        records.push(record);
                    }
                }
            }
        }
    }

    return { records, warnings };
}
