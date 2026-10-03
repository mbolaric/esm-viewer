import type {
    ActivityChangeInfo,
    CardActivityDailyRecord,
    FullCardNumber,
    Gen1CardData,
    Gen1CompanyCard,
    Gen1DriverCard,
    Gen1VUActivity,
    Gen1VuOverview,
    Gen2CardData,
    Gen2CardVehicleUnitsUsed,
    Gen2DataInfoGenericRecordArray,
    Gen2DriverCard,
    Gen2FullCardNumberAndGeneration,
    Gen2GnssPlaceRecord,
    Gen2VUActivity,
    Gen2VUOverview,
    RecordType,
    TachographHeader,
    VehicleRegistrationIdentification,
} from '../generated/esm_parser.js';

export function cardHeader(generation: 'FirstGeneration' | 'SecondGeneration'): TachographHeader {
    return {
        cardInVuData: false,
        dataType: 'Card',
        generation,
    };
}

export function vehicleUnitHeader(generation: 'FirstGeneration' | 'SecondGeneration'): TachographHeader {
    return {
        cardInVuData: false,
        dataType: 'VU',
        generation,
    };
}

export function fullCardNumber(
    cardNumber = 'SYNTHETIC0000001',
    cardType: FullCardNumber['cardType'] = 'DriverCard',
): FullCardNumber {
    return {
        cardIssuingMemberState: 'Germany',
        cardNumber,
        cardType,
    };
}

export function vehicleRegistration(vehicleRegistrationNumber = 'TEST-123'): VehicleRegistrationIdentification {
    return {
        vehicleRegistrationNation: 'Germany',
        vehicleRegistrationNumber,
    };
}

export function gnssPlaceRecord(timeStamp: string, latitude: number, longitude: number): Gen2GnssPlaceRecord {
    return {
        geoCoordinates: {
            latitude,
            longitude,
        },
        gnssAccuracy: 2,
        timeStamp,
    };
}

export function recordArray<TRecord>(
    recordType: RecordType,
    records: TRecord[],
    recordSize = 1,
): Gen2DataInfoGenericRecordArray<TRecord> {
    return {
        noOfRecords: records.length,
        recordSize,
        recordType,
        records,
    };
}

export function vehicleUnitsUsedFixture(overrides: Partial<Gen2CardVehicleUnitsUsed> = {}): Gen2CardVehicleUnitsUsed {
    return {
        cardVehicleUnitRecords: [
            {
                deviceID: 123_456,
                manufacturerCode: 2,
                timeStamp: '2026-01-02 08:00:00 UTC',
                vuSoftwareVersion: '0001',
            },
        ],
        vehicleUnitPointerNewestRecord: 0,
        ...overrides,
    };
}

function cardChipIdentification(): Gen1DriverCard['cardChipIdentification'] {
    return {
        icManufacturingReferences: [18, 52, 86, 120],
        icManufacturingReferencesHex: '12345678',
        icSerialNumber: [222, 173, 190, 239],
        icSerialNumberHex: 'DEADBEEF',
    };
}

function cardIccIdentification(): Gen1DriverCard['cardIccIdentification'] {
    return {
        cardApprovalNumber: 'APPROVAL',
        cardExtendedSerialNumber: {
            manufacturerCode: 2,
            monthYear: '0626',
            serialNumber: 123_456,
            type: 1,
        },
        cardPersonaliserID: 3,
        clockStop: 0,
        embedderIcAssemblerId: {
            countryCode: 'DE',
            manufacturerInformation: [4, 5],
            moduleEmbedder: '01',
        },
        icIdentifier: [6, 7],
    };
}

function identification(): NonNullable<Gen1DriverCard['identification']> {
    return {
        cardIdentification: {
            cardExpiryDate: '2030-01-02 00:00:00 UTC',
            cardIssueDate: '2024-01-02 00:00:00 UTC',
            cardIssuingAuthorityName: 'Synthetic Authority',
            cardIssuingMemberState: 'Germany',
            cardNumber: {
                cardConsecutiveindex: '',
                cardIssuingMemberState: 'DriverCard',
                cardRenewalindex: '1',
                cardReplacementindex: '0',
                identification: 'SYNTHETIC00000',
                number: 'SYNTHETIC0000001',
            },
            cardValidityBegin: '2024-01-02 00:00:00 UTC',
        },
        driverCardHolderIdentification: {
            cardHolderBirthDate: {
                day: '01',
                month: '01',
                year: '1990',
            },
            cardHolderName: {
                holderFirstNames: 'Alex',
                holderSurname: 'Example',
            },
            cardHolderPreferredLanguage: 'en',
        },
    };
}

export function gen1DriverCard(overrides: Partial<Gen1DriverCard> = {}): Gen1DriverCard {
    return {
        applicationIdentification: {
            activityStructureLength: 1_024,
            cardStructureVersion: {
                dataElementUseVersion: 1,
                structureVersion: 2,
            },
            noOfCardPlaceRecords: 32,
            noOfCardVehicleRecords: 64,
            noOfEventsPerType: 6,
            noOfFaultsPerType: 4,
            typeOfTachographCardId: 'DriverCard',
        },
        caCertificate: null,
        cardCertificate: null,
        cardChipIdentification: cardChipIdentification(),
        cardDownload: null,
        cardGeneration: 'Gen1',
        cardIccIdentification: cardIccIdentification(),
        cardNotes: '',
        controlActivityData: null,
        currentUsage: null,
        dataFiles: {},
        driverActivityData: null,
        drivingLicenceInformation: null,
        eventsData: null,
        faultsData: null,
        identification: identification(),
        places: null,
        specificConditions: null,
        vehiclesUsed: null,
        ...overrides,
    };
}

export function gen1CompanyCard(overrides: Partial<Gen1CompanyCard> = {}): Gen1CompanyCard {
    return {
        applicationIdentification: {
            cardStructureVersion: {
                dataElementUseVersion: 1,
                structureVersion: 2,
            },
            noOfCompanyActivityRecords: 32,
            typeOfTachographCardId: 'CompanyCard',
        },
        caCertificate: null,
        cardCertificate: null,
        cardChipIdentification: cardChipIdentification(),
        cardGeneration: 'Gen1',
        cardIccIdentification: cardIccIdentification(),
        cardNotes: '',
        companyActivityData: null,
        dataFiles: {},
        identification: null,
        ...overrides,
    };
}

export function gen2DriverCard(overrides: Partial<Gen2DriverCard> = {}): Gen2DriverCard {
    return {
        applicationIdentification: {
            activityStructureLength: 1_024,
            cardStructureVersion: {
                dataElementUseVersion: 1,
                structureVersion: 2,
            },
            noOfCardPlaceRecords: 32,
            noOfCardVehicleRecords: 64,
            noOfCardVehicleUnitRecords: 8,
            noOfEventsPerType: 6,
            noOfFaultsPerType: 4,
            noOfGnssadRecords: 16,
            noOfSpecificConditionRecords: 12,
            typeOfTachographCardId: 'DriverCard',
        },
        applicationIdentificationV2: null,
        borderCrossings: null,
        caCertificate: null,
        cardCertificate: null,
        cardChipIdentification: cardChipIdentification(),
        cardDownload: null,
        cardGeneration: 'Gen2',
        cardIccIdentification: cardIccIdentification(),
        cardNotes: '',
        cardSignCertificate: null,
        controlActivityData: null,
        currentUsage: null,
        dataFiles: {},
        driverActivityData: null,
        drivingLicenceInformation: null,
        eventsData: null,
        faultsData: null,
        gnssPlaces: null,
        identification: identification(),
        linkCertificate: null,
        loadTypeEntries: null,
        loadUnloadOperations: null,
        places: null,
        specificConditions: null,
        vehicleUnitsUsed: null,
        vehiclesUsed: null,
        ...overrides,
    };
}

export function gen1CardData(cardDataResponses: Gen1CardData['cardDataResponses'] = gen1DriverCard()): Gen1CardData {
    return {
        cardDataResponses,
        header: cardHeader('FirstGeneration'),
    };
}

export function gen1VuActivity(overrides: Partial<Gen1VUActivity> = {}): Gen1VUActivity {
    return {
        dateOfDayDownloaded: '2026-06-18 00:00:00 UTC',
        odometerValueMidnight: 12_000,
        signature: null,
        vuActivityDailyData: {
            activityChangeInfos: [],
            noOfActivityChanges: 0,
        },
        vuCardIWData: {
            no_of_iw_records: 0,
            vu_card_iw_records: [],
        },
        vuPlaceDailyWorkPeriodData: {
            noOfPlaceRecords: 0,
            vuPlaceDailyWorkPeriodRecords: [],
        },
        vuSpecificConditionData: {
            noOfSpecificConditionRecords: 0,
            specificConditionRecords: [],
        },
        ...overrides,
    };
}

export function gen2CardData(
    cardDataResponses: Gen2CardData['cardDataResponses'] = {
        gen2: gen2DriverCard(),
    },
): Gen2CardData {
    return {
        cardDataResponses,
        header: cardHeader('SecondGeneration'),
    };
}

export function activityChange(activityType: ActivityChangeInfo['activityType'], timeInMin: number): ActivityChangeInfo {
    return {
        activityCard: 'Card',
        activityInfo: 0,
        activitySource: 'Automatic',
        activityType,
        cardSlot: 'Driver',
        cardStatus: 'Inserted',
        drivingStatus: 'SingleOrUnknown',
        encodedActivityType: activityType,
        encodedCardSlot: 'Driver',
        isCardWithdrawal: false,
        timeInMin,
    };
}

export function gen1VuOverview(
    registrationNation: Gen1VuOverview['vehicleRegistrationIdentification']['vehicleRegistrationNation'] = 'Germany',
): Gen1VuOverview {
    return {
        cardSlotStatus: {
            coDriverSlot: 'Unknown',
            data: 0,
            driverSlot: 'DriverCard',
        },
        currentDateTime: '2026-06-18 12:00:00 UTC',
        memberStateCertificate: [],
        signature: null,
        vehicleIdentificationNumber: 'WVWZZZ1JZXW000001',
        vehicleRegistrationIdentification: {
            vehicleRegistrationNation: registrationNation,
            vehicleRegistrationNumber: 'TEST-123',
        },
        vuCertificate: [],
        vuCompanyLocksData: {
            company_locks: [],
            no_of_locks: 0,
        },
        vuControlActivity: {
            noOfControls: 0,
            vuControlActivities: [],
        },
        vuDownloadActivityData: {
            companyOrWorkshopName: '',
            downloadingTime: '1970-01-01 00:00:00 UTC',
            fullCardNumber: fullCardNumber('', 'Unknown'),
        },
        vuDownloadablePeriod: {
            maxDownloadableTime: '2026-06-18 12:00:00 UTC',
            minDownloadableTime: '2026-06-01 00:00:00 UTC',
        },
    };
}

export function gen2VuOverview(typeId: 'Gen2Overview' | 'Gen2v2Overview'): Gen2VUOverview {
    return {
        CurrentDateTimeRecordArray: recordArray('CurrentDateTime', []),
        cardSlotsStatusRecordArray: recordArray('CardSlotStatus', []),
        memberStateCertificateRaw: [],
        memberStateCertificateRecordArray: recordArray('MemberStateCertificate', []),
        signatureRecordArray: recordArray('Signature', []),
        trepId: typeId,
        vehicleIdentificationNumberRecordArray: recordArray('VehicleIdentificationNumber', ['WVWZZZ1JZXW000001']),
        vehicleRegistrationNumberRecordArray: recordArray('VehicleRegistrationNumber', ['TEST-123']),
        vuCertificateRaw: [],
        vuCertificateRecordArray: recordArray('VuCertificate', []),
        vuCompanyLocksRecordArray: recordArray('VuCompanyLocksRecord', []),
        vuControlActivityRecordArray: recordArray('VuControlActivityRecord', []),
        vuDownloadActivityDataRecordArray: recordArray('VuDownloadActivityData', []),
        vuDownloadablePeriodRecordArray: recordArray('VuDownloadablePeriod', []),
    };
}

export function gen2VuActivity(isGen2V2 = false): Gen2VUActivity {
    return {
        dateOfDayDownloadedRecordArray: recordArray('DateOfDayDownloaded', []),
        odometerValueMidnightRecordArray: recordArray('OdometerValueMidnight', []),
        signatureRecordArray: null,
        vuActivityDailyRecordArray: recordArray('ActivityChangeInfo', []),
        vuCardIWRecordArray: recordArray('VuCardIWRecord', []),
        vuGnssadRecordArray: recordArray('VuGNSSADRecord', []),
        vuPlaceDailyWorkPeriodRecordArray: {
            isGen2V2,
            ...recordArray('VuPlaceDailyWorkPeriodRecord', []),
        },
        vuSpecificConditionRecordArray: recordArray('SpecificConditionRecord', []),
    };
}

export function cardAndGeneration(cardNumber = 'SYNTHETIC0000001', generation = 2): Gen2FullCardNumberAndGeneration {
    return {
        fullcardNumber: fullCardNumber(cardNumber),
        generation,
    };
}

export function cardActivityDailyRecord(
    activityRecordDate: CardActivityDailyRecord['activityRecordDate'],
    activityChangeInfo: ActivityChangeInfo[] = [activityChange('Driving', 0)],
): CardActivityDailyRecord {
    return {
        activityChangeInfo,
        activityDailyPresenceCounter: '0001',
        activityDayDistance: 0,
        activityPreviousRecordLength: 0,
        activityRecordDate,
        activityRecordLength: 16,
    };
}
