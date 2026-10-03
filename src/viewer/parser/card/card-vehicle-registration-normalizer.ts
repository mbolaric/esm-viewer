import {
    isRawMemberState,
    isVehicleRegistrationNumber,
    type ITachographWarning,
    type RecordedIssuingMemberState,
    type TachographGeneration,
    type VehicleRegistrationNumber,
} from '#viewer-domain';

import type { VehicleRegistrationIdentification } from '../generated/esm_parser.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import {
    normalizeParserNation,
    type ParserNationAlphaCodes,
    type ParserWarningFactory,
} from '../normalizers/parser-value-normalizer.js';

export interface INormalizedCardVehicleRegistration {
    readonly memberState: RecordedIssuingMemberState | null;
    readonly number: VehicleRegistrationNumber | null;
    readonly warnings: readonly ITachographWarning[];
}

const { warning } = createNormalizationSourceContext('driverCard');

export function normalizeCardVehicleRegistration(
    value: VehicleRegistrationIdentification,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
): INormalizedCardVehicleRegistration {
    return normalizeVehicleRegistration(value, generation, pathTokens, nationAlphaCodes, warning);
}

export function normalizeVehicleRegistration(
    value: VehicleRegistrationIdentification,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
    nationAlphaCodes: ParserNationAlphaCodes,
    createWarning: ParserWarningFactory,
): INormalizedCardVehicleRegistration {
    const warnings: ITachographWarning[] = [];
    const rawNumber = value.vehicleRegistrationNumber;
    const number = rawNumber === '' ? null : isVehicleRegistrationNumber(rawNumber) ? rawNumber : null;
    if (number === null && rawNumber !== '') {
        warnings.push(createWarning('invalidValue', generation, [...pathTokens, 'vehicleRegistrationNumber']));
    }

    const rawMemberState = value.vehicleRegistrationNation;
    const memberState: RecordedIssuingMemberState | null =
        number === null && rawMemberState === 'Unknown'
            ? null
            : (normalizeParserNation(rawMemberState, nationAlphaCodes) ??
              (isRawMemberState(rawMemberState) ? rawMemberState : null));

    return {
        memberState,
        number,
        warnings: warnings,
    };
}
