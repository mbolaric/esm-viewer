import type { ICardVerificationApplication, IDriverCardApplication } from '#viewer-application';
import type { IJsonRecord } from '#contracts';
import {
    createCardNotes,
    createDriverIdentity,
    createRecordedActivityInterval,
    createTachographWarning,
    groupActivityDays,
    isCardNotesText,
    isCardNumber,
    isIdentityName,
    isUtcTimestamp,
    UNKNOWN_CREW_CONTEXT,
    type ActivityKind,
    type IActivityCrewContext,
    type IActivityDay,
    type ICardNotes,
    type IDriverIdentity,
    type IRecordedActivityInterval,
    type ITachographWarning,
    type TachographGeneration,
} from '#viewer-domain';
import { MILLISECONDS_PER_MINUTE, MINUTES_PER_DAY } from '#time';

import { normalizeCardEventFaultData } from './card-event-fault-normalizer.js';
import { normalizeCardAssociations } from './card-association-normalizer.js';
import { normalizeCardLocations } from './card-location-normalizer.js';
import { normalizeCardTechnicalData } from './card-technical-normalizer.js';
import type { ActivityChangeInfo } from '../generated/esm_parser.js';
import { createJsonPointer } from '../json-pointer.js';
import { createNormalizationSourceContext } from '../normalization-source.js';
import { normalizeParserActivityKind, parserDriverActivityCard } from '../normalizers/parser-enum-normalizer.js';
import type { ParserDriverCardApplication } from '../decoders/parser-result-types.js';
import {
    isRecordedParserTimestamp,
    normalizeParserDatef,
    normalizeParserNation,
    normalizeParserUtcTimestamp,
    type ParserNationAlphaCodes,
} from '../normalizers/parser-value-normalizer.js';

interface INormalizedDriverIdentity {
    readonly identity: IDriverIdentity | null;
    readonly warnings: readonly ITachographWarning[];
}

interface INormalizedDriverActivities {
    readonly activityDays: readonly IActivityDay[];
    readonly warnings: readonly ITachographWarning[];
}

interface INormalizedCardNotes {
    readonly cardNotes: ICardNotes | null;
    readonly warnings: readonly ITachographWarning[];
}

const maximumActivityDays = 4_096;
const maximumActivityChangesPerDay = 1_440;

const { source, warning } = createNormalizationSourceContext('driverCard');

function readOptionalIdentityName(value: string): {
    readonly invalid: boolean;
    readonly value: IDriverIdentity['firstNames'];
} {
    if (value === '') {
        return { invalid: false, value: null };
    }

    return isIdentityName(value) ? { invalid: false, value } : { invalid: true, value: null };
}

function normalizeDriverIdentity(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    nationAlphaCodes: ParserNationAlphaCodes,
    pathTokens: readonly string[],
): INormalizedDriverIdentity {
    const identityPath = [...pathTokens, 'identification'];
    const rawIdentity = application.identification;

    if (rawIdentity === null) {
        return {
            identity: null,
            warnings: [warning('missingValue', generation, identityPath)],
        };
    }
    if (!('driverCardHolderIdentification' in rawIdentity)) {
        return {
            identity: null,
            warnings: [warning('invalidValue', generation, identityPath)],
        };
    }

    const cardIdentification = rawIdentity.cardIdentification;
    const holderIdentification = rawIdentity.driverCardHolderIdentification;
    const rawCardNumber = cardIdentification.cardNumber;
    const rawHolderName = holderIdentification.cardHolderName;

    const warnings: ITachographWarning[] = [];
    const cardNumber = rawCardNumber.number;
    if (!isCardNumber(cardNumber)) {
        return {
            identity: null,
            warnings: [warning('invalidValue', generation, [...identityPath, 'cardIdentification', 'cardNumber', 'number'])],
        };
    }

    const issuingMemberState = normalizeParserNation(cardIdentification.cardIssuingMemberState, nationAlphaCodes);
    if (issuingMemberState === null) {
        warnings.push(warning('unsupportedData', generation, [...identityPath, 'cardIdentification', 'cardIssuingMemberState']));
    }

    const cardIssueDate = normalizeParserUtcTimestamp(cardIdentification.cardIssueDate);
    if (cardIdentification.cardIssueDate !== null && cardIssueDate === null) {
        warnings.push(warning('invalidValue', generation, [...identityPath, 'cardIdentification', 'cardIssueDate']));
    }

    const cardExpiryDate = normalizeParserUtcTimestamp(cardIdentification.cardExpiryDate);
    if (cardIdentification.cardExpiryDate !== null && cardExpiryDate === null) {
        warnings.push(warning('invalidValue', generation, [...identityPath, 'cardIdentification', 'cardExpiryDate']));
    }

    const cardValidityBegin = normalizeParserUtcTimestamp(cardIdentification.cardValidityBegin);
    if (cardIdentification.cardValidityBegin !== null && cardValidityBegin === null) {
        warnings.push(warning('invalidValue', generation, [...identityPath, 'cardIdentification', 'cardValidityBegin']));
    }

    const rawIssuingAuthorityName = cardIdentification.cardIssuingAuthorityName;
    const cardIssuingAuthorityName =
        typeof rawIssuingAuthorityName === 'string' && rawIssuingAuthorityName.trim() !== ''
            ? rawIssuingAuthorityName.trim()
            : null;
    if (cardIssuingAuthorityName === null) {
        warnings.push(warning('invalidValue', generation, [...identityPath, 'cardIdentification', 'cardIssuingAuthorityName']));
    }

    const firstNames = readOptionalIdentityName(rawHolderName.holderFirstNames);
    if (firstNames.invalid) {
        warnings.push(
            warning('invalidValue', generation, [
                ...identityPath,
                'driverCardHolderIdentification',
                'cardHolderName',
                'holderFirstNames',
            ]),
        );
    }

    const surname = readOptionalIdentityName(rawHolderName.holderSurname);
    if (surname.invalid) {
        warnings.push(
            warning('invalidValue', generation, [
                ...identityPath,
                'driverCardHolderIdentification',
                'cardHolderName',
                'holderSurname',
            ]),
        );
    }

    const rawBirthDate = holderIdentification.cardHolderBirthDate;
    const cardHolderBirthDate = normalizeParserDatef(rawBirthDate);
    if (
        cardHolderBirthDate === null &&
        (rawBirthDate.year !== '0000' || rawBirthDate.month !== '00' || rawBirthDate.day !== '00')
    ) {
        warnings.push(
            warning('invalidValue', generation, [...identityPath, 'driverCardHolderIdentification', 'cardHolderBirthDate']),
        );
    }

    return {
        identity: createDriverIdentity({
            cardExpiryDate: isRecordedParserTimestamp(cardExpiryDate) ? cardExpiryDate : null,
            cardHolderBirthDate,
            cardIssueDate: isRecordedParserTimestamp(cardIssueDate) ? cardIssueDate : null,
            cardValidityBegin: isRecordedParserTimestamp(cardValidityBegin) ? cardValidityBegin : null,
            cardIssuingAuthorityName,
            cardNumber,
            firstNames: firstNames.value,
            issuingMemberState,
            source: source(generation, identityPath),
            surname: surname.value,
        }),
        warnings: warnings,
    };
}

function isIntegerWithin(value: number, minimum: number, maximum: number): boolean {
    return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isBcdDigitText(value: string): boolean {
    return /^\d{4}$/.test(value);
}

function hasValidActivityChangeSemantics(value: ActivityChangeInfo): boolean {
    return value.activityCard === parserDriverActivityCard && isIntegerWithin(value.activityInfo, 0, 0xff_ff);
}

// Bit 14 means single/crew only while the card is inserted; for a card that is out it says whether the activity was
// entered by hand, and the slot bit is not meaningful either.
function normalizeActivityCrewContext(change: ActivityChangeInfo): IActivityCrewContext {
    if (change.cardStatus !== 'Inserted') {
        return UNKNOWN_CREW_CONTEXT;
    }

    switch (change.drivingStatus) {
        case 'CrewOrKnown':
            return { crewPresence: 'crew', slot: change.cardSlot };
        case 'SingleOrUnknown':
            return { crewPresence: 'single', slot: change.cardSlot };
        case 'Unknown':
            return { crewPresence: 'unknown', slot: change.cardSlot };
    }
}

function normalizeDriverActivities(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly string[],
): INormalizedDriverActivities {
    const activityRootPath = [...pathTokens, 'driverActivityData'];
    const rawActivity = application.driverActivityData;
    if (rawActivity === null) {
        return {
            activityDays: [],
            warnings: [],
        };
    }
    if (
        !isIntegerWithin(rawActivity.activityPointerNewestRecord, 0, 0xff_ff) ||
        !isIntegerWithin(rawActivity.activityPointerOldestDayRecord, 0, 0xff_ff)
    ) {
        return {
            activityDays: [],
            warnings: [warning('invalidValue', generation, activityRootPath)],
        };
    }

    const rawDailyRecords = rawActivity.activityDailyRecords;
    if (rawDailyRecords.length > maximumActivityDays) {
        return {
            activityDays: [],
            warnings: [warning('unsupportedData', generation, activityRootPath)],
        };
    }

    const intervals: IRecordedActivityInterval[] = [];
    const warnings: ITachographWarning[] = [];
    const normalizedDailyRecordDates = new Set<number>();

    for (const [dayIndex, rawDailyRecord] of rawDailyRecords.entries()) {
        const dailyRecordPath = [...activityRootPath, 'activityDailyRecords', dayIndex];
        if (
            !isBcdDigitText(rawDailyRecord.activityDailyPresenceCounter) ||
            !isIntegerWithin(rawDailyRecord.activityDayDistance, 0, 0xff_ff) ||
            !isIntegerWithin(rawDailyRecord.activityPreviousRecordLength, 0, 0xff_ff) ||
            !isIntegerWithin(rawDailyRecord.activityRecordLength, 0, 0xff_ff)
        ) {
            warnings.push(warning('invalidValue', generation, dailyRecordPath));
            continue;
        }

        const midnightUtc = normalizeParserUtcTimestamp(rawDailyRecord.activityRecordDate);
        if (
            rawDailyRecord.activityRecordDate === null ||
            midnightUtc === 0 ||
            (midnightUtc !== null && !isRecordedParserTimestamp(midnightUtc))
        ) {
            continue;
        }
        const changes = rawDailyRecord.activityChangeInfo;
        if (
            midnightUtc === null ||
            midnightUtc % (MINUTES_PER_DAY * MILLISECONDS_PER_MINUTE) !== 0 ||
            changes.length === 0 ||
            changes.length > maximumActivityChangesPerDay
        ) {
            warnings.push(warning('invalidValue', generation, dailyRecordPath));
            continue;
        }
        const decodedChanges: {
            readonly activity: ActivityKind;
            readonly crew: IActivityCrewContext;
            readonly path: readonly (number | string)[];
            readonly timeInMinutes: number;
        }[] = [];
        let invalidDayWarning: ITachographWarning | null = null;
        for (const [changeIndex, rawChange] of changes.entries()) {
            const changePath = [...dailyRecordPath, 'activityChangeInfo', changeIndex];
            if (!hasValidActivityChangeSemantics(rawChange)) {
                invalidDayWarning = warning('invalidValue', generation, changePath);
                break;
            }

            const activity = normalizeParserActivityKind(rawChange.activityType);
            const timeInMinutes = rawChange.timeInMin;
            if (activity === null || !isIntegerWithin(timeInMinutes, 0, MINUTES_PER_DAY - 1)) {
                invalidDayWarning = warning('invalidValue', generation, changePath);
                break;
            }
            const previousChange = decodedChanges.at(-1);
            const previousMinutes = previousChange?.timeInMinutes;
            if (previousMinutes !== undefined && previousMinutes > timeInMinutes) {
                invalidDayWarning = warning('inconsistentData', generation, changePath);
                break;
            }

            if (previousChange?.timeInMinutes === timeInMinutes) {
                decodedChanges[decodedChanges.length - 1] = {
                    activity,
                    crew: normalizeActivityCrewContext(rawChange),
                    path: changePath,
                    timeInMinutes,
                };
            } else {
                decodedChanges.push({
                    activity,
                    crew: normalizeActivityCrewContext(rawChange),
                    path: changePath,
                    timeInMinutes,
                });
            }
        }

        if (invalidDayWarning !== null) {
            warnings.push(invalidDayWarning);
            continue;
        }

        const dayIntervals: IRecordedActivityInterval[] = [];
        let invalidDay = false;
        for (const [changeIndex, change] of decodedChanges.entries()) {
            const nextChange = decodedChanges[changeIndex + 1];
            const start = midnightUtc + change.timeInMinutes * MILLISECONDS_PER_MINUTE;
            const end =
                nextChange === undefined
                    ? midnightUtc + MINUTES_PER_DAY * MILLISECONDS_PER_MINUTE
                    : midnightUtc + nextChange.timeInMinutes * MILLISECONDS_PER_MINUTE;
            if (!isUtcTimestamp(start) || !isUtcTimestamp(end)) {
                invalidDay = true;
                break;
            }
            const interval = createRecordedActivityInterval(
                change.activity,
                start,
                end,
                source(generation, change.path),
                change.crew,
            );

            if (interval === null) {
                invalidDay = true;
                break;
            }
            dayIntervals.push(interval);
        }

        if (invalidDay) {
            warnings.push(warning('inconsistentData', generation, dailyRecordPath));
            continue;
        }
        if (normalizedDailyRecordDates.has(midnightUtc)) {
            warnings.push(warning('duplicateEvidence', generation, dailyRecordPath));
            continue;
        }
        normalizedDailyRecordDates.add(midnightUtc);
        intervals.push(...dayIntervals);
    }

    const activityDays: IActivityDay[] = [];
    for (const result of groupActivityDays(intervals)) {
        if (result.status === 'normalized') {
            activityDays.push(result.day);
            continue;
        }

        switch (result.status) {
            case 'durationOverflow':
            case 'emptyData':
            case 'invalidInterval':
            case 'invalidMidnight':
            case 'midnightBoundary':
                warnings.push(warning('inconsistentData', generation, activityRootPath));
                break;
            case 'overlap':
                warnings.push(
                    result.overlapping.source === null
                        ? warning('inconsistentData', generation, activityRootPath)
                        : createTachographWarning('inconsistentData', result.overlapping.source),
                );
                break;
        }
    }

    return {
        activityDays: activityDays,
        warnings: warnings,
    };
}

function normalizeCardNotes(
    application: ParserDriverCardApplication,
    generation: TachographGeneration,
    pathTokens: readonly (number | string)[],
): INormalizedCardNotes {
    const notesPath = [...pathTokens, 'cardNotes'];
    const rawNotes = application.cardNotes;
    if (rawNotes === '') {
        return {
            cardNotes: null,
            warnings: [],
        };
    }
    if (!isCardNotesText(rawNotes)) {
        return {
            cardNotes: null,
            warnings: [warning('invalidValue', generation, notesPath)],
        };
    }

    return {
        cardNotes: createCardNotes({
            source: source(generation, notesPath),
            text: rawNotes,
        }),
        warnings: [],
    };
}

function createVerificationApplication(
    dataFiles: IJsonRecord,
    generation: TachographGeneration,
    pathTokens: readonly string[],
): ICardVerificationApplication {
    return {
        dataFiles,
        dataFileSourcePaths: Object.fromEntries(
            Object.keys(dataFiles).map((fileId) => [fileId, createJsonPointer([...pathTokens, 'dataFiles', fileId])]),
        ),
        generation: generation === 'g1' ? 'g1' : 'g2',
    };
}

export function normalizeDriverCardApplication(
    application: ParserDriverCardApplication,
    dataFiles: IJsonRecord,
    generation: TachographGeneration,
    pathTokens: readonly string[],
    nationAlphaCodes: ParserNationAlphaCodes,
): IDriverCardApplication {
    const identity = normalizeDriverIdentity(application, generation, nationAlphaCodes, pathTokens);
    const activities = normalizeDriverActivities(application, generation, pathTokens);
    const eventFaultData = normalizeCardEventFaultData(application, generation, pathTokens, nationAlphaCodes);
    const associations = normalizeCardAssociations(application, generation, pathTokens, nationAlphaCodes);
    const locations = normalizeCardLocations(application, generation, pathTokens, nationAlphaCodes);
    const technical = normalizeCardTechnicalData(application, generation, pathTokens, nationAlphaCodes);
    const cardNotes = normalizeCardNotes(application, generation, pathTokens);

    return {
        activityDays: activities.activityDays,
        cardNotes: cardNotes.cardNotes,
        events: eventFaultData.events,
        faults: eventFaultData.faults,
        generation,
        identity: identity.identity,
        locations: locations.locations,
        source: source(generation, pathTokens),
        technicalRecords: technical.records,
        verification: createVerificationApplication(dataFiles, generation, pathTokens),
        vehicleUses: associations.vehicleUses,
        vehicleUnitUses: associations.vehicleUnitUses,
        warnings: [
            ...identity.warnings,
            ...activities.warnings,
            ...eventFaultData.warnings,
            ...associations.warnings,
            ...locations.warnings,
            ...technical.warnings,
            ...cardNotes.warnings,
        ],
    };
}
