import {
    createCardUse,
    isIdentityName,
    type ICardUse,
    type IdentityName,
    type ITachographWarning,
    type TachographGeneration,
} from '#viewer-domain';

import { normalizeFullCardIdentity } from '../card/full-card-identity-normalizer.js';
import type { Gen1VuCardIWRecord, Gen2VuCardIWRecord } from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import {
    isRecordedParserTimestamp,
    normalizeParserOdometerWithWarning,
    normalizeParserUtcTimestamp,
    type ParserNationAlphaCodes,
} from '../normalizers/parser-value-normalizer.js';
import type { IVehicleUnitActivitySection } from './vehicle-unit-activity-normalizer.js';
import { decodeVehicleUnitCountedRecords, decodeVehicleUnitRecordArray } from './vehicle-unit-record-array.js';

export interface INormalizedVehicleUnitAssociations {
    readonly cardUses: readonly ICardUse[];
    readonly warnings: readonly ITachographWarning[];
}

const maximumCardUsesPerSection = 4_096;
const { source, warning } = createNormalizationSourceContext('vehicleUnit');

function normalizeIdentityName(
    value: string,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
): IdentityName | null {
    if (value === '') {
        return null;
    }
    if (isIdentityName(value)) {
        return value;
    }

    warnings.push(warning('invalidValue', generation, pathTokens));
    return null;
}

function normalizeCardUseRecord(
    value: Gen1VuCardIWRecord | Gen2VuCardIWRecord,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitAssociations {
    const warnings: ITachographWarning[] = [];
    const firstNames = normalizeIdentityName(
        value.cardHolderName.holderFirstNames,
        generation,
        [...pathTokens, 'cardHolderName', 'holderFirstNames'],
        warnings,
    );
    const surname = normalizeIdentityName(
        value.cardHolderName.holderSurname,
        generation,
        [...pathTokens, 'cardHolderName', 'holderSurname'],
        warnings,
    );

    const isGen2 = 'fullCardNumberAndGeneration' in value;
    if ((generation === 'g1') === isGen2) {
        return {
            cardUses: [],
            warnings: [...warnings, warning('inconsistentData', generation, pathTokens)],
        };
    }

    const fullCardNumber = isGen2 ? value.fullCardNumberAndGeneration.fullcardNumber : value.fullCardNumber;
    const fullCardNumberPath = isGen2
        ? [...pathTokens, 'fullCardNumberAndGeneration', 'fullcardNumber']
        : [...pathTokens, 'fullCardNumber'];
    if (
        isGen2 &&
        (!Number.isInteger(value.fullCardNumberAndGeneration.generation) ||
            value.fullCardNumberAndGeneration.generation < 0 ||
            value.fullCardNumberAndGeneration.generation > 0xff)
    ) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'fullCardNumberAndGeneration', 'generation']));
    }
    const fullCardIdentity = normalizeFullCardIdentity(fullCardNumber, generation, fullCardNumberPath, nationAlphaCodes, warning);
    warnings.push(...fullCardIdentity.warnings);

    const insertion = normalizeParserUtcTimestamp(value.cardInsertionTime);
    const rawWithdrawal = normalizeParserUtcTimestamp(value.cardWithdrawalTime);
    // A card still inserted at download has no withdrawal time, so the unit leaves the TimeReal maximum there.
    const withdrawal = isRecordedParserTimestamp(rawWithdrawal) ? rawWithdrawal : null;
    const rawExpiry = normalizeParserUtcTimestamp(value.cardExpiryDate);
    const cardExpiryDate = isRecordedParserTimestamp(rawExpiry) ? rawExpiry : null;
    if (insertion === null || insertion === 0) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'cardInsertionTime']));
    }
    if (value.cardWithdrawalTime !== null && rawWithdrawal === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'cardWithdrawalTime']));
    }
    if (value.cardExpiryDate !== null && rawExpiry === null) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'cardExpiryDate']));
    }

    const odometerAtInsertion = normalizeParserOdometerWithWarning(
        value.vehicleOdometerValueAtInsertion,
        generation,
        [...pathTokens, 'vehicleOdometerValueAtInsertion'],
        warnings,
        warning,
    );
    const odometerAtWithdrawal = normalizeParserOdometerWithWarning(
        value.vehicleOdometerValueAtWithdrawal,
        generation,
        [...pathTokens, 'vehicleOdometerValueAtWithdrawal'],
        warnings,
        warning,
    );
    if (insertion === null || insertion === 0) {
        return {
            cardUses: [],
            warnings: warnings,
        };
    }

    const record = createCardUse({
        cardExpiryDate,
        cardNumber: fullCardIdentity.cardNumber,
        cardType: fullCardIdentity.cardType,
        firstNames,
        insertion,
        issuingMemberState: fullCardIdentity.issuingMemberState,
        odometerAtInsertion,
        odometerAtWithdrawal,
        slot: value.cardSlotNumber,
        source: source(generation, pathTokens),
        surname,
        withdrawal,
    });
    if (record === null) {
        warnings.push(warning('inconsistentData', generation, pathTokens));
    }

    return {
        cardUses: record === null ? [] : [record],
        warnings: warnings,
    };
}

function normalizeRecords(
    records: readonly (Gen1VuCardIWRecord | Gen2VuCardIWRecord)[],
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitAssociations {
    const cardUses: ICardUse[] = [];
    const warnings: ITachographWarning[] = [];
    for (const [index, record] of records.entries()) {
        const normalized = normalizeCardUseRecord(record, generation, [...pathTokens, index], nationAlphaCodes);
        cardUses.push(...normalized.cardUses);
        warnings.push(...normalized.warnings);
    }

    return {
        cardUses: cardUses,
        warnings: warnings,
    };
}

export function normalizeVehicleUnitAssociations(
    activitySections: readonly IVehicleUnitActivitySection[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedVehicleUnitAssociations {
    const cardUses: ICardUse[] = [];
    const warnings: ITachographWarning[] = [];
    for (const section of activitySections) {
        const pathTokens =
            section.generation === 'g1'
                ? [...section.rootPath, 'vuCardIWData', 'vu_card_iw_records']
                : [...section.rootPath, 'vuCardIWRecordArray', 'records'];
        const records =
            section.generation === 'g1'
                ? decodeVehicleUnitCountedRecords(
                      section.activity.vuCardIWData.no_of_iw_records,
                      section.activity.vuCardIWData.vu_card_iw_records,
                      maximumCardUsesPerSection,
                  )
                : decodeVehicleUnitRecordArray(section.activity.vuCardIWRecordArray, maximumCardUsesPerSection, 'VuCardIWRecord');
        if (records === null) {
            warnings.push(warning('inconsistentData', section.generation, pathTokens.slice(0, -1)));
            continue;
        }

        const normalized = normalizeRecords(records, section.generation, pathTokens, nationAlphaCodes);
        cardUses.push(...normalized.cardUses);
        warnings.push(...normalized.warnings);
    }

    return {
        cardUses: cardUses,
        warnings: warnings,
    };
}
