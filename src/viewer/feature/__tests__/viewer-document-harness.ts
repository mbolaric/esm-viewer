import {
    DocumentLifecycleController,
    DocumentSelectionController,
    type IFileDigestPort,
    type IParsedDocumentOperation,
    type IParsedDriverCardDocument,
    type IParsedVehicleUnitDocument,
    type ITachographFilePicker,
    type ITachographParserPort,
    type ParsedDocumentResult,
    type TachographFileAcquisitionResult,
} from '#viewer-application';
import { classifyParseError, decodeFileMetadata, type ReopenToken, type Result } from '#contracts';
import {
    createCardUse,
    createDetailedSpeedSample,
    createDriverIdentity,
    createRecordedActivityInterval,
    createSourceReference,
    createTachographEvent,
    createTachographFault,
    createTachographWarning,
    createVehicleIdentity,
    createVehicleUse,
    isCardNumber,
    isIdentityName,
    isIssuingMemberState,
    isJsonPointer,
    isOdometerKilometres,
    isSpeedKilometresPerHour,
    isUtcTimestamp,
    isVehicleIdentificationNumber,
    isVehicleRegistrationNumber,
    normalizeActivityDay,
    type IActivityCrewContext,
    type IActivityDay,
    type IDetailedSpeedSample,
    type IntegrityAssessment,
    type IntegrityFailureCode,
    type ISourceReference,
    type IVehicleUnitUse,
    type TachographLocationRecord,
    type UtcTimestamp,
} from '#viewer-domain';
import { DocumentComparisonController } from '#viewer-application';

import { ViewerDocumentController } from '../controllers/viewer-document-controller.svelte.js';

const singleDriverCrew: IActivityCrewContext = { crewPresence: 'single', slot: 'Driver' };

interface IParserRequest {
    readonly complete: (result: ParsedDocumentResult) => void;
}

export interface IRecordedRecentFileCall {
    readonly displayName: string;
    readonly openedAtEpochMs: number;
    readonly reopenToken: ReopenToken;
}

export interface IViewerDocumentHarness {
    readonly controller: ViewerDocumentController;
    readonly parserRequestCount: () => number;
    readonly parserWasDisposed: () => boolean;
    readonly recentFileCalls: () => readonly IRecordedRecentFileCall[];
    readonly releaseCount: () => number;
    readonly reopenPickerCallCount: () => number;
    completeLatestParser(result: ParsedDocumentResult): void;
    successfulParserResult(): ParsedDocumentResult;
    successfulVehicleParserResult(): ParsedDocumentResult;
}

function parsedDriverCardDocument(
    locations: readonly TachographLocationRecord[] = [],
    vehicleUnitUses: readonly IVehicleUnitUse[] = [],
): IParsedDriverCardDocument {
    const cardNumber = '1234567890123456';
    const firstNames = 'Ada';
    const issuingMemberState = 'D';
    const surname = 'Lovelace';
    const eventStart = Date.UTC(2026, 6, 27, 8, 15);
    const faultStart = Date.UTC(2026, 6, 27, 10, 20);
    const faultEnd = Date.UTC(2026, 6, 27, 10, 24);
    if (
        !isCardNumber(cardNumber) ||
        !isIdentityName(firstNames) ||
        !isIssuingMemberState(issuingMemberState) ||
        !isIdentityName(surname) ||
        !isUtcTimestamp(eventStart) ||
        !isUtcTimestamp(faultStart) ||
        !isUtcTimestamp(faultEnd)
    ) {
        throw new TypeError('The driver-card parser fixture must be valid.');
    }
    const event = createTachographEvent({
        code: 'cardConflict',
        end: null,
        recordKind: 'event',
        recordPurpose: null,
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: null,
        source: cardSource('/events/0'),
        start: eventStart,
    });
    if (event === null) {
        throw new TypeError('The driver-card event fixture must be valid.');
    }
    const fault = createTachographFault({
        code: 'recordingEquipmentPrinterFault',
        end: faultEnd,
        recordKind: 'fault',
        recordPurpose: 'active',
        registrationMemberState: null,
        registrationNumber: null,
        similarOccurrences: 2,
        source: cardSource('/faults/0'),
        start: faultStart,
    });
    if (fault === null) {
        throw new TypeError('The driver-card fault fixture must be valid.');
    }
    const activityDays = createActivityDays();
    const vehicleFirstUse = Date.UTC(2026, 6, 27, 8);
    const vehicleLastUse = Date.UTC(2026, 6, 27, 16);
    const odometerBegin = 12_340;
    const odometerEnd = 12_620;
    const registrationNumber = 'B-ESM-2026';
    if (
        !isUtcTimestamp(vehicleFirstUse) ||
        !isUtcTimestamp(vehicleLastUse) ||
        !isOdometerKilometres(odometerBegin) ||
        !isOdometerKilometres(odometerEnd) ||
        !isVehicleRegistrationNumber(registrationNumber)
    ) {
        throw new TypeError('The driver-card vehicle-use fixture must be valid.');
    }
    const vehicleUse = createVehicleUse({
        firstUse: vehicleFirstUse,
        lastUse: vehicleLastUse,
        odometerBegin,
        odometerEnd,
        registrationMemberState: issuingMemberState,
        registrationNumber,
        source: cardSource('/vehicles/0'),
        vehicleIdentificationNumber: null,
    });
    if (vehicleUse === null) {
        throw new TypeError('The driver-card vehicle-use record must be valid.');
    }

    return {
        applications: [
            {
                activityDays,
                cardNotes: null,
                events: [event],
                faults: [fault],
                generation: 'g1',
                identity: createDriverIdentity({
                    cardExpiryDate: null,
                    cardHolderBirthDate: null,
                    cardIssueDate: null,
                    cardValidityBegin: null,
                    cardIssuingAuthorityName: null,
                    cardNumber,
                    firstNames,
                    issuingMemberState,
                    source: cardSource('/identity'),
                    surname,
                }),
                locations,
                source: cardSource('/cardDataResponses'),
                technicalRecords: [],
                verification: {
                    dataFiles: {},
                    dataFileSourcePaths: {},
                    generation: 'g1',
                },
                vehicleUses: [vehicleUse],
                vehicleUnitUses: [...vehicleUnitUses],
                warnings: [createTachographWarning('unsupportedData', cardSource('/unsupported/0'))],
            },
        ],
        cardType: 'driverCard',
        documentKind: 'driverCard',
        generation: 'g1',
        parserVariant: 'cardGen1',
        rawTree: {
            activities: [
                {
                    activity: 'Driving',
                    end: '2026-07-26T09:00:00.000Z',
                    start: '2026-07-26T08:00:00.000Z',
                },
                {
                    activity: 'OtherWork',
                    end: '2026-07-27T10:30:00.000Z',
                    start: '2026-07-27T09:00:00.000Z',
                },
            ],
            events: [
                {
                    code: 'cardConflict',
                },
            ],
            faults: [
                {
                    code: 'recordingEquipmentPrinterFault',
                },
            ],
            identity: {
                cardNumber,
                firstNames,
                issuingMemberState,
                surname,
            },
            unsupported: [
                {
                    section: 'syntheticUnsupportedSection',
                },
            ],
            vehicles: [
                {
                    firstUse: '2026-07-27T08:00:00.000Z',
                    lastUse: '2026-07-27T16:00:00.000Z',
                    odometerBegin,
                    odometerEnd,
                    registrationMemberState: issuingMemberState,
                    registrationNumber,
                },
            ],
        },
        sections: [],
    };
}

function createActivityDays(): readonly IActivityDay[] {
    const firstMidnight = Date.UTC(2026, 6, 26);
    const secondMidnight = Date.UTC(2026, 6, 27);
    if (!isUtcTimestamp(firstMidnight) || !isUtcTimestamp(secondMidnight)) {
        throw new TypeError('The activity-day timestamps must be valid.');
    }

    const firstInterval = createRecordedActivityInterval(
        'driving',
        activityTimestamp(firstMidnight + 8 * 60 * 60 * 1_000),
        activityTimestamp(firstMidnight + 9 * 60 * 60 * 1_000),
        cardSource('/activities/0'),
        singleDriverCrew,
    );
    const secondInterval = createRecordedActivityInterval(
        'work',
        activityTimestamp(secondMidnight + 9 * 60 * 60 * 1_000),
        activityTimestamp(secondMidnight + 10 * 60 * 60 * 1_000 + 30 * 60 * 1_000),
        cardSource('/activities/1'),
        singleDriverCrew,
    );
    // Five hours of driving without a break gives the fixture a genuine Art. 7 finding on its second day.
    const thirdInterval = createRecordedActivityInterval(
        'driving',
        activityTimestamp(secondMidnight + 10 * 60 * 60 * 1_000 + 30 * 60 * 1_000),
        activityTimestamp(secondMidnight + 15 * 60 * 60 * 1_000 + 30 * 60 * 1_000),
        cardSource('/activities/2'),
        singleDriverCrew,
    );
    if (firstInterval === null || secondInterval === null || thirdInterval === null) {
        throw new TypeError('The activity-day intervals must be valid.');
    }

    const firstDay = normalizeActivityDay([firstInterval], firstMidnight);
    const secondDay = normalizeActivityDay([secondInterval, thirdInterval], secondMidnight);
    if (firstDay.status !== 'normalized' || secondDay.status !== 'normalized') {
        throw new TypeError('The activity-day fixtures must normalize.');
    }

    return [firstDay.day, secondDay.day];
}

function activityTimestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The activity timestamp must be valid.');
    }
    return value;
}

function cardSource(path: string): ISourceReference<'g1', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The driver-card source fixture must be valid.');
    }
    return createSourceReference('driverCard', 'g1', path);
}

function parsedVehicleUnitDocument(): IParsedVehicleUnitDocument {
    const registrationMemberState = 'D';
    const registrationNumber = 'B-ESM-2026';
    const vehicleIdentificationNumber = 'WVWZZZ1JZXW000001';
    const cardNumber = '1234567890123456';
    const firstNames = 'Ada';
    const surname = 'Lovelace';
    const insertion = Date.UTC(2026, 6, 27, 8);
    const withdrawal = Date.UTC(2026, 6, 27, 16);
    const cardExpiryDate = Date.UTC(2030, 6, 27);
    const odometerAtInsertion = 12_340;
    const odometerAtWithdrawal = 12_620;
    const speedStart = Date.UTC(2026, 6, 27, 8, 42);
    if (
        !isCardNumber(cardNumber) ||
        !isIdentityName(firstNames) ||
        !isIdentityName(surname) ||
        !isIssuingMemberState(registrationMemberState) ||
        !isVehicleRegistrationNumber(registrationNumber) ||
        !isVehicleIdentificationNumber(vehicleIdentificationNumber) ||
        !isUtcTimestamp(insertion) ||
        !isUtcTimestamp(withdrawal) ||
        !isUtcTimestamp(cardExpiryDate) ||
        !isUtcTimestamp(speedStart) ||
        !isOdometerKilometres(odometerAtInsertion) ||
        !isOdometerKilometres(odometerAtWithdrawal)
    ) {
        throw new TypeError('The Vehicle Unit parser fixture must be valid.');
    }
    const rootSource = vehicleSource('/vehicleUnit');
    const identity = createVehicleIdentity({
        registrationMemberState,
        registrationNumber,
        source: vehicleSource('/identity'),
        vehicleIdentificationNumber,
    });
    if (identity === null) {
        throw new TypeError('The Vehicle Unit identity fixture must be valid.');
    }
    const cardUse = createCardUse({
        cardExpiryDate,
        cardNumber,
        cardType: 'driverCard',
        firstNames,
        insertion,
        issuingMemberState: registrationMemberState,
        odometerAtInsertion,
        odometerAtWithdrawal,
        slot: 'Driver',
        source: vehicleSource('/cards/0'),
        surname,
        withdrawal,
    });
    if (cardUse === null) {
        throw new TypeError('The Vehicle Unit card-use fixture must be valid.');
    }
    const detailedSpeedSamples = createSpeedSamples(speedStart);

    return {
        cardUses: [cardUse],
        detailedSpeedSamples,
        documentKind: 'vehicleUnit',
        companyLocks: [],
        events: [],
        faults: [],
        generation: 'g2',
        overspeedControl: null,
        overspeedRecords: [],

        identity,
        locations: [],
        parserVariant: 'vuGen2',
        verification: null,
        rawTree: {
            cards: [
                {
                    cardNumber,
                    firstNames,
                    insertion: '2026-07-27T08:00:00.000Z',
                    odometerAtInsertion,
                    odometerAtWithdrawal,
                    surname,
                    withdrawal: '2026-07-27T16:00:00.000Z',
                },
            ],
            identity: {
                registrationMemberState,
                registrationNumber,
                vehicleIdentificationNumber,
            },
            speed: detailedSpeedSamples.map((sample) => sample.speedKilometresPerHour),
        },
        rootSource,
        sections: [],
        technicalRecords: [],
        warnings: [],
    };
}

function createSpeedSamples(start: UtcTimestamp): readonly IDetailedSpeedSample[] {
    return Array.from({ length: 302 }, (_, index) => {
        const recordedAt = start + index * 1_000;
        const speed = index % 101;
        const path = `/speed/${String(index)}`;
        if (!isUtcTimestamp(recordedAt) || !isSpeedKilometresPerHour(speed) || !isJsonPointer(path)) {
            throw new TypeError('The Vehicle Unit speed fixture must be valid.');
        }
        return createDetailedSpeedSample({
            recordedAt,
            source: vehicleSource(path),
            speedKilometresPerHour: speed,
        });
    });
}

function vehicleSource(path: string): ISourceReference<'g2', 'vehicleUnit'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The Vehicle Unit source fixture must be valid.');
    }
    return createSourceReference('vehicleUnit', 'g2', path);
}

export interface IViewerDocumentHarnessOptions {
    readonly displayNameCandidate?: string;
    readonly locations?: readonly TachographLocationRecord[];
    readonly loadErcRootCertificateMock?: () => Promise<Result<ArrayBuffer, IntegrityFailureCode>>;
    readonly openedAtStepMs?: number;
    readonly preferencesAutoRun?: boolean;
    readonly reopenToken?: ReopenToken | null;
    readonly vehicleUnitUses?: readonly IVehicleUnitUse[];
    readonly verifyMock?: () => Promise<Result<IntegrityAssessment, IntegrityFailureCode>>;
    readonly verifyVehicleUnitMock?: () => Promise<Result<IntegrityAssessment, IntegrityFailureCode>>;
}

export function createViewerDocumentHarness(options?: IViewerDocumentHarnessOptions): IViewerDocumentHarness {
    const displayNameCandidate = options?.displayNameCandidate ?? 'synthetic-card.ddd';
    const preferencesAutoRun = options?.preferencesAutoRun ?? false;
    const reopenToken = options?.reopenToken ?? null;
    const recentFileCalls: IRecordedRecentFileCall[] = [];
    const metadata = decodeFileMetadata({
        byteLength: 3,
        displayName: displayNameCandidate,
        sha256: 'a'.repeat(64),
    });
    const openedAt = Date.UTC(2026, 6, 28, 8, 30);
    if (!metadata.ok || !isUtcTimestamp(openedAt)) {
        throw new TypeError('The viewer document test fixture must be valid.');
    }

    let parserDisposed = false;
    let currentOpenedAt = openedAt;
    let releases = 0;
    let reopenPickerCalls = 0;
    const parserRequests: IParserRequest[] = [];
    const filePicker = {
        open(): Promise<TachographFileAcquisitionResult> {
            return Promise.resolve({
                resource: {
                    bytes: new Uint8Array([1, 2, 3]),
                    displayName: metadata.value.displayName,
                    reopenToken,
                    sourceToken: null,
                    release: () => {
                        releases += 1;
                        return Promise.resolve({
                            ok: true,
                            value: null,
                        });
                    },
                },
                status: 'opened',
            });
        },
    } satisfies ITachographFilePicker;
    const reopenFilePicker = {
        open(): Promise<TachographFileAcquisitionResult> {
            reopenPickerCalls += 1;
            return Promise.resolve({
                resource: {
                    bytes: new Uint8Array([1, 2, 3]),
                    displayName: metadata.value.displayName,
                    reopenToken,
                    sourceToken: null,
                    release: () => {
                        releases += 1;
                        return Promise.resolve({
                            ok: true,
                            value: null,
                        });
                    },
                },
                status: 'opened',
            });
        },
    } satisfies ITachographFilePicker;
    const digest = {
        sha256(): ReturnType<IFileDigestPort['sha256']> {
            return Promise.resolve({
                ok: true,
                value: metadata.value.sha256,
            });
        },
    } satisfies IFileDigestPort;
    const parser = {
        loadErcRootCertificate(): Promise<Result<ArrayBuffer, IntegrityFailureCode>> {
            if (options?.loadErcRootCertificateMock) {
                return options.loadErcRootCertificateMock();
            }
            return Promise.resolve({
                ok: true,
                value: new ArrayBuffer(10),
            });
        },
        parse(): IParsedDocumentOperation {
            const deferred = Promise.withResolvers<ParsedDocumentResult>();
            parserRequests.push({
                complete: deferred.resolve,
            });
            return {
                cancel: () => {
                    deferred.resolve({
                        error: classifyParseError('cancelled'),
                        ok: false,
                    });
                },
                completion: deferred.promise,
            };
        },
        verify(): Promise<Result<IntegrityAssessment, IntegrityFailureCode>> {
            if (options?.verifyMock) {
                return options.verifyMock();
            }
            return Promise.resolve({
                error: 'verificationUnsupported',
                ok: false,
            });
        },
        verifyVehicleUnit(): Promise<Result<IntegrityAssessment, IntegrityFailureCode>> {
            if (options?.verifyVehicleUnitMock) {
                return options.verifyVehicleUnitMock();
            }
            return Promise.resolve({
                error: 'verificationUnsupported',
                ok: false,
            });
        },
    } satisfies ITachographParserPort;
    const controller = new ViewerDocumentController({
        clock: () => {
            const value = currentOpenedAt;
            const nextValue = value + (options?.openedAtStepMs ?? 0);
            if (!isUtcTimestamp(nextValue)) {
                throw new TypeError('The next viewer document timestamp must be valid.');
            }
            currentOpenedAt = nextValue;
            return value;
        },
        comparison: new DocumentComparisonController(),
        createDroppedFilePicker: () => filePicker,
        createReopenFilePicker: () => reopenFilePicker,
        createSelectionController: (document) => new DocumentSelectionController(document),
        digest,
        disposeOwnedResources: () => {
            parserDisposed = true;
        },
        filePicker,
        lifecycle: new DocumentLifecycleController(),
        parser,
        preferencesController: {
            recordRecentFile: (entry) => {
                recentFileCalls.push({ ...entry });
            },
            snapshot: {
                preferences: {
                    verificationAutoRun: preferencesAutoRun,
                },
            },
        },
    });

    function latestParserRequest(): IParserRequest {
        const request = parserRequests.at(-1);
        if (request === undefined) {
            throw new TypeError('The parser fixture has no pending request.');
        }
        return request;
    }

    return {
        completeLatestParser: (result) => {
            latestParserRequest().complete(result);
        },
        controller,
        parserRequestCount: () => parserRequests.length,
        parserWasDisposed: () => parserDisposed,
        recentFileCalls: () => recentFileCalls,
        releaseCount: () => releases,
        reopenPickerCallCount: () => reopenPickerCalls,
        successfulParserResult: () => ({
            ok: true,
            value: parsedDriverCardDocument(options?.locations, options?.vehicleUnitUses),
        }),
        successfulVehicleParserResult: () => ({
            ok: true,
            value: parsedVehicleUnitDocument(),
        }),
    };
}
