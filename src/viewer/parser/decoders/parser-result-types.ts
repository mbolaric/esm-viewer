import type { ParsedCardType } from '#viewer-application';
import type { TachographGeneration } from '#viewer-domain';

import type {
    Gen1CompanyCard,
    Gen1ControlCard,
    Gen1DriverCard,
    Gen1VUData,
    Gen1WorkshopCard,
    Gen2CompanyCard,
    Gen2ControlCard,
    Gen2DriverCard,
    Gen2VUData,
    Gen2WorkshopCard,
} from '../generated/esm_parser.js';

export type ParserGen1CardApplication = Gen1CompanyCard | Gen1ControlCard | Gen1DriverCard | Gen1WorkshopCard;

export type ParserGen2CardApplication = Gen2CompanyCard | Gen2ControlCard | Gen2DriverCard | Gen2WorkshopCard;

export type ParserCardApplication = ParserGen1CardApplication | ParserGen2CardApplication;

export type ParserDriverCardApplication = Gen1DriverCard | Gen2DriverCard;

export type ParserVehicleUnitData = Gen1VUData | Gen2VUData;

export interface IParserEmbeddedCardSnapshotApplication {
    readonly cardType: ParsedCardType;
    readonly generation: TachographGeneration;
    readonly pathTokens: readonly (string | number)[];
    readonly value: ParserCardApplication;
}

export interface IParserEmbeddedCardSnapshot {
    readonly applications: readonly IParserEmbeddedCardSnapshotApplication[] | null;
    readonly generation: 'g1' | 'g2';
    readonly hasSignature: boolean;
    readonly pathTokens: readonly (string | number)[];
    readonly state: 'noCard' | 'parsed' | 'unsupported';
}

export type ParserGen1VehicleUnitTransferParameter = Gen1VUData['transferResParams'][number];

export type ParserGen2VehicleUnitTransferParameter = Gen2VUData['transferResParams'][number];

export type ParserVehicleUnitTransferParameter = ParserGen1VehicleUnitTransferParameter | ParserGen2VehicleUnitTransferParameter;
