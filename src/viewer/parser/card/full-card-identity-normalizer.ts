import {
    isCardNumber,
    isRawMemberState,
    type CardNumber,
    type InsertedCardType,
    type IRecordedCardReference,
    type ITachographWarning,
    type RecordedIssuingMemberState,
    type TachographGeneration,
} from '#viewer-domain';

import type { EquipmentType, FullCardNumber, Gen2FullCardNumberAndGeneration } from '../generated/esm_parser.js';
import {
    normalizeParserNation,
    type ParserNationAlphaCodes,
    type ParserWarningFactory,
} from '../normalizers/parser-value-normalizer.js';
import { normalizeParserInsertedCardType } from '../normalizers/parser-enum-normalizer.js';

export interface INormalizedFullCardIdentity {
    readonly cardNumber: CardNumber | null;
    readonly cardType: InsertedCardType;
    readonly issuingMemberState: RecordedIssuingMemberState | null;
    readonly warnings: readonly ITachographWarning[];
}

export interface INormalizedRecordedCardReference {
    readonly reference: IRecordedCardReference | null;
    readonly warnings: readonly ITachographWarning[];
}

function normalizeCardType(
    value: EquipmentType,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    warnings: ITachographWarning[],
    warning: ParserWarningFactory,
): InsertedCardType {
    const cardType = normalizeParserInsertedCardType(value);
    if (cardType === null) {
        warnings.push(warning('unsupportedData', generation, pathTokens));
        return 'unknown';
    }

    return cardType;
}

export function normalizeFullCardIdentity(
    value: FullCardNumber,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
    warning: ParserWarningFactory,
): INormalizedFullCardIdentity {
    const warnings: ITachographWarning[] = [];
    const rawCardNumber = value.cardNumber;
    const cardNumber = rawCardNumber === '' ? null : isCardNumber(rawCardNumber) ? rawCardNumber : null;
    if (cardNumber === null && rawCardNumber !== '') {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'cardNumber']));
    }

    const rawNation = value.cardIssuingMemberState;
    const emptyCard = cardNumber === null && rawNation === 'Unknown';
    const issuingMemberState: RecordedIssuingMemberState | null = emptyCard
        ? null
        : (normalizeParserNation(rawNation, nationAlphaCodes) ?? (isRawMemberState(rawNation) ? rawNation : null));

    return {
        cardNumber,
        cardType: normalizeCardType(value.cardType, generation, [...pathTokens, 'cardType'], warnings, warning),
        issuingMemberState,
        warnings: warnings,
    };
}

export function normalizeRecordedCardReference(
    value: FullCardNumber,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
    warning: ParserWarningFactory,
): INormalizedRecordedCardReference {
    const identity = normalizeFullCardIdentity(value, generation, pathTokens, nationAlphaCodes, warning);

    return {
        reference:
            identity.cardNumber === null && identity.cardType === 'unknown' && identity.issuingMemberState === null
                ? null
                : {
                      cardNumber: identity.cardNumber,
                      cardType: identity.cardType,
                      issuingMemberState: identity.issuingMemberState,
                  },
        warnings: identity.warnings,
    };
}

export function normalizeWrappedCardReference(
    value: FullCardNumber | Gen2FullCardNumberAndGeneration,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
    warning: ParserWarningFactory,
): INormalizedRecordedCardReference {
    const generationWrapped = 'fullcardNumber' in value;
    const rawCard = generationWrapped ? value.fullcardNumber : value;
    const cardPath = generationWrapped ? [...pathTokens, 'fullcardNumber'] : pathTokens;
    const warnings: ITachographWarning[] = [];
    if (generationWrapped && (!Number.isInteger(value.generation) || value.generation < 0 || value.generation > 0xff)) {
        warnings.push(warning('invalidValue', generation, [...pathTokens, 'generation']));
    }

    const identity = normalizeRecordedCardReference(rawCard, generation, cardPath, nationAlphaCodes, warning);
    warnings.push(...identity.warnings);

    return {
        reference: identity.reference,
        warnings,
    };
}
