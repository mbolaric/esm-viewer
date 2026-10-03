import { describe, expect, it } from 'vitest';

import type { Gen1VuCompanyLocksRecord, Gen1VuOverview } from '../generated/esm_parser.js';
import type { ParserGen1VehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import { normalizeVehicleUnitCompanyLocks } from '../vehicle-unit/vehicle-unit-company-locks-normalizer.js';

function gen1Overview(companyLocks: Gen1VuCompanyLocksRecord[]): Gen1VuOverview {
    return {
        cardSlotStatus: {
            coDriverSlot: 'Unknown',
            data: 0,
            driverSlot: 'Unknown',
        },
        currentDateTime: '2025-01-01 08:00:00 UTC',
        memberStateCertificate: [],
        signature: null,
        vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
        vehicleRegistrationIdentification: {
            vehicleRegistrationNation: 'Spain',
            vehicleRegistrationNumber: '1234ABC',
        },
        vuCertificate: [],
        vuCompanyLocksData: {
            company_locks: companyLocks,
            no_of_locks: companyLocks.length,
        },
        vuControlActivity: {
            noOfControls: 0,
            vuControlActivities: [],
        },
        vuDownloadActivityData: {
            companyOrWorkshopName: '',
            downloadingTime: null,
            fullCardNumber: {
                cardIssuingMemberState: 'Spain',
                cardNumber: '',
                cardType: 'CompanyCard',
            },
        },
        vuDownloadablePeriod: {
            maxDownloadableTime: null,
            minDownloadableTime: null,
        },
    };
}

describe('normalizeVehicleUnitCompanyLocks', () => {
    it.each([
        { lockOutTime: '0000-00-00 00:00:00 UTC', representation: 'a zero TimeReal' },
        { lockOutTime: null, representation: 'a null TimeReal' },
    ])('normalizes active Gen1 company locks with $representation', ({ lockOutTime }) => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Control: gen1Overview([
                    {
                        companyAddress: '123 Main St   ',
                        companyCardNumber: {
                            cardIssuingMemberState: 'Spain',
                            cardNumber: 'C123456789000000 ',
                            cardType: 'CompanyCard',
                        },
                        companyName: 'ACME Transport   ',
                        lockInTime: '2025-01-01 08:00:00 UTC',
                        lockOutTime,
                    },
                ]),
            },
            position: 0,
            typeId: 'Overview',
        };

        const result = normalizeVehicleUnitCompanyLocks([parameter]);

        expect(result.warnings).toHaveLength(0);
        expect(result.records).toHaveLength(1);
        const record = result.records[0];
        expect(record?.kind).toBe('vehicleUnitCompanyLockTechnicalRecord');
        if (record?.kind === 'vehicleUnitCompanyLockTechnicalRecord') {
            expect(record.companyName).toBe('ACME Transport');
            expect(record.companyAddress).toBe('123 Main St');
            expect(record.companyCardNumber).toBe('C123456789000000');
            expect(record.lockInTime).toBe(1_735_718_400_000);
            expect(record.lockOutTime).toBeNull();
        }
    });

    it('emits invalidValue warnings when company lock fields fail validation', () => {
        const parameter: ParserGen1VehicleUnitTransferParameter = {
            data: {
                Control: gen1Overview([
                    {
                        companyAddress: '   ',
                        companyCardNumber: {
                            cardIssuingMemberState: 'Spain',
                            cardNumber: 'C123456789000000',
                            cardType: 'CompanyCard',
                        },
                        companyName: 'ACME',
                        lockInTime: '2025-01-01 08:00:00 UTC',
                        lockOutTime: '2025-01-02 08:00:00 UTC',
                    },
                ]),
            },
            position: 0,
            typeId: 'Overview',
        };

        const result = normalizeVehicleUnitCompanyLocks([parameter]);

        expect(result.records).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]?.code).toBe('invalidValue');
    });
});
