import { describe, expect, it } from 'vitest';

import type { Gen2DriverCard } from '../generated/esm_parser.js';
import { normalizeCardTechnicalData } from '../card/card-technical-normalizer.js';
import { decodeParserNationAlphaCodes, type ParserNationAlphaCodes } from '../normalizers/parser-value-normalizer.js';
import { fullCardNumber, gen2DriverCard, vehicleRegistration } from './parser-fixtures.js';

function nationAlphaCodes(): ParserNationAlphaCodes {
    const decoded = decodeParserNationAlphaCodes({
        Germany: 'D',
    });
    if (!decoded.ok) {
        throw new Error('Synthetic nation metadata must be valid.');
    }
    return decoded.value;
}

function application(): Gen2DriverCard {
    return gen2DriverCard({
        applicationIdentificationV2: {
            lengthOfFollowingData: 10,
            noOfBorderCrossingRecords: 24,
            noOfLoadTypeEntryRecords: 12,
            noOfLoadUnloadRecords: 24,
            vuConfigurationLengthRange: 128,
        },
        cardDownload: '2026-06-18 11:00:00 UTC',
        controlActivityData: {
            controlCardNumber: fullCardNumber('CONTROL000000001', 'ControlCard'),
            controlDownloadPeriodBegin: '2026-06-17 08:00:00 UTC',
            controlDownloadPeriodEnd: '2026-06-18 08:00:00 UTC',
            controlTime: '2026-06-18 10:00:00 UTC',
            controlType: 'CardDownloaded',
            controlVehicleRegistration: vehicleRegistration(),
        },
        currentUsage: {
            sessionOpenTime: '2026-06-18 09:00:00 UTC',
            sessionOpenVehicle: vehicleRegistration(),
        },
        drivingLicenceInformation: {
            drivingLicenceIssuingAuthority: 'Synthetic Authority',
            drivingLicenceIssuingNation: 'Germany',
            drivingLicenceNumber: 'LICENCE-123',
        },
        specificConditions: {
            conditionPointerNewestRecord: 1,
            specificConditionRecords: [
                {
                    entryTime: '2026-06-18 07:00:00 UTC',
                    specificConditionType: 'OutOfScopeBegin',
                },
                {
                    entryTime: '2026-06-18 08:00:00 UTC',
                    specificConditionType: 'OutOfScopeEnd',
                },
            ],
        },
    });
}

describe('driver-card technical normalization', () => {
    it('normalizes identification, operational records, and canonical source paths', () => {
        const result = normalizeCardTechnicalData(application(), 'g2v2', ['cardDataResponses', 'Gen2'], nationAlphaCodes());

        expect(result.warnings).toEqual([]);
        expect(result.records).toHaveLength(10);
        const applicationRecord = result.records.find((record) => record.kind === 'cardApplicationTechnicalData');
        const applicationV2Record = result.records.find((record) => record.kind === 'cardApplicationV2TechnicalData');
        const chipRecord = result.records.find((record) => record.kind === 'cardChipTechnicalData');
        const iccRecord = result.records.find((record) => record.kind === 'cardIccTechnicalData');
        const licenceRecord = result.records.find((record) => record.kind === 'drivingLicenceTechnicalData');
        const controlRecord = result.records.find((record) => record.kind === 'cardControlActivityTechnicalRecord');
        const conditionRecord = result.records.find(
            (record) => record.kind === 'specificConditionTechnicalRecord' && record.conditionType === 'outOfScopeEnd',
        );

        expect(applicationRecord).toMatchObject({
            activityStructureLength: 1_024,
            source: {
                path: '/cardDataResponses/Gen2/applicationIdentification',
            },
        });
        expect(applicationV2Record).toMatchObject({ loadUnloadRecords: 24 });
        expect(chipRecord).toMatchObject({
            manufacturingReference: '12345678',
            serialNumber: 'DEADBEEF',
        });
        expect(iccRecord).toMatchObject({
            embedder: {
                countryCode: 'DE',
                manufacturerInformation: [4, 5],
                moduleEmbedder: '01',
            },
        });
        expect(licenceRecord).toMatchObject({
            issuingMemberState: 'D',
            licenceNumber: 'LICENCE-123',
        });
        expect(controlRecord).toMatchObject({
            controlType: 'cardDownloaded',
            registrationNumber: 'TEST-123',
        });
        expect(conditionRecord).toMatchObject({
            source: {
                path: '/cardDataResponses/Gen2/specificConditions/specificConditionRecords/1',
            },
        });
    });

    it('preserves zero time sentinels and rejects inconsistent control periods', () => {
        const raw = application();
        if (raw.controlActivityData === null || raw.currentUsage === null) {
            throw new Error('Synthetic technical records must be populated.');
        }
        const result = normalizeCardTechnicalData(
            {
                ...raw,
                cardDownload: '1970-01-01 00:00:00 UTC',
                controlActivityData: {
                    ...raw.controlActivityData,
                    controlDownloadPeriodBegin: '2026-06-19 08:00:00 UTC',
                    controlDownloadPeriodEnd: '2026-06-18 08:00:00 UTC',
                },
                currentUsage: {
                    ...raw.currentUsage,
                    sessionOpenTime: '1970-01-01 00:00:00 UTC',
                },
            },
            'g2v2',
            ['cardDataResponses', 'Gen2'],
            nationAlphaCodes(),
        );

        expect(result.records).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    downloadedAt: null,
                    kind: 'cardDownloadTechnicalRecord',
                }),
                expect.objectContaining({
                    kind: 'cardCurrentUsageTechnicalRecord',
                    sessionOpenedAt: null,
                }),
            ]),
        );
        expect(result.records.some((record) => record.kind === 'cardControlActivityTechnicalRecord')).toBe(false);
        expect(result.warnings.map((item) => [item.code, item.source.path])).toContainEqual([
            'inconsistentData',
            '/cardDataResponses/Gen2/controlActivityData',
        ]);
    });

    it('rejects semantically inconsistent technical values', () => {
        const raw = application();
        const result = normalizeCardTechnicalData(
            {
                ...raw,
                cardChipIdentification: {
                    ...raw.cardChipIdentification,
                    icManufacturingReferencesHex: 'FFFFFFFF',
                },
                specificConditions: {
                    conditionPointerNewestRecord: 0x1_0000,
                    specificConditionRecords: raw.specificConditions?.specificConditionRecords ?? [],
                },
            },
            'g2v2',
            ['cardDataResponses', 'Gen2'],
            nationAlphaCodes(),
        );

        expect(result.warnings.map((item) => [item.code, item.source.path])).toEqual(
            expect.arrayContaining([
                ['invalidValue', '/cardDataResponses/Gen2/cardChipIdentification'],
                ['invalidValue', '/cardDataResponses/Gen2/specificConditions'],
            ]),
        );
    });

    it('normalizes control activity with null download period timestamps without warnings', () => {
        const raw = application();
        if (raw.controlActivityData === null) {
            throw new Error('Synthetic technical records must be populated.');
        }
        const result = normalizeCardTechnicalData(
            {
                ...raw,
                controlActivityData: {
                    ...raw.controlActivityData,
                    controlDownloadPeriodBegin: null,
                    controlDownloadPeriodEnd: null,
                },
            },
            'g2v2',
            ['cardDataResponses', 'Gen2'],
            nationAlphaCodes(),
        );

        const controlRecord = result.records.find((record) => record.kind === 'cardControlActivityTechnicalRecord');
        expect(controlRecord).toBeDefined();
        if (controlRecord?.kind === 'cardControlActivityTechnicalRecord') {
            expect(controlRecord.downloadPeriodBegin).toBeNull();
            expect(controlRecord.downloadPeriodEnd).toBeNull();
        }
        expect(result.warnings).toEqual([]);
    });
});
