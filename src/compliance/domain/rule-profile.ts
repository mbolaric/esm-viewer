import { MILLISECONDS_PER_MINUTE, MINUTES_PER_DAY } from '#time';
import type { InfringementSeverity } from './infringement.js';

// Art. 8(6): weekly rest must start within six 24-hour periods of previous rest.
const SIX_24_HOUR_PERIODS_MINUTES = 6 * MINUTES_PER_DAY;

export interface IBreakRuleConfig {
    readonly maxContinuousDrivingMinutes: number;
    readonly minTotalBreakMinutes: number;
    readonly splitBreaks: readonly {
        readonly firstBreakMinutes: number;
        readonly secondBreakMinutes: number;
    }[];
}

export interface IDailyDrivingRuleConfig {
    readonly extendedDailyDrivingMinutes: number;
    readonly maxExtensionsPerCalendarWeek: number;
    readonly standardDailyDrivingMinutes: number;
}

export interface IWeeklyDrivingRuleConfig {
    readonly maxBiWeeklyDrivingMinutes: number;
    readonly maxWeeklyDrivingMinutes: number;
}

export interface IDailyRestRuleConfig {
    readonly maxReductionsPerPeriod: number;
    readonly reducedRestMinutes: number;
    readonly regularRestMinutes: number;
    readonly splitRest: {
        readonly firstPeriodMinutes: number;
        readonly secondPeriodMinutes: number;
    } | null;
}

export interface IWeeklyRestRuleConfig {
    readonly legalRegime: 'mobilityPackage2020' | 'standard';
    readonly maxRestSpacingMinutes: number;
    readonly reducedRestMinutes: number;
    readonly regularRestMinutes: number;
}

export interface IWorkingTimeRuleConfig {
    readonly averageReferencePeriodWeeks: number;
    readonly breakRequirement6to9hMinutes: number;
    readonly breakRequirementOver9hMinutes: number;
    readonly continuousWorkLimitMinutes: number;
    readonly longWorkdayThresholdMinutes: number;
    readonly maxAverageWeeklyWorkingMinutes: number;
    readonly maxWeeklyWorkingMinutes: number;
    readonly minBreakSegmentMinutes: number;
    readonly nightWindowEndHourUtc: number;
    readonly nightWindowStartHourUtc: number;
    readonly nightWorkMaxDailyMinutes: number;
}

// Art. 4(o) and 8(5): multi-manning qualification and its 30-hour daily-rest window.
export interface IMultiManningRuleConfig {
    // Art. 7, third paragraph (Reg. (EU) 2020/1054): first date on which co-driver availability counts as a break;
    // null where the profile does not apply that paragraph.
    readonly availabilityBreakFrom: string | null;
    // A single-card drive this short beside a card change is minute-rounding noise, not driving without a crew.
    readonly cardChangeToleranceMinutes: number;
    readonly dailyRestWindowMinutes: number;
    // Art. 4(o): the second driver's presence is optional for the first hour of the duty period.
    readonly firstHourMinutes: number;
    readonly minDailyRestMinutes: number;
}

// Art. 9(1): limits for ferry/train interrupted regular daily or reduced weekly rest.
export interface IFerryRuleConfig {
    readonly maxInterruptionDurationMinutes: number;
    readonly maxInterruptions: number;
}

export interface ISeverityThresholds {
    // Reg. 2016/403 Annex I: MSI cutoff margin; undefined when the category has no MSI tier.
    readonly mostSeriousMarginMinutes?: number;
    readonly seriousMarginMinutes: number;
    readonly verySeriousMarginMinutes: number;
}

export interface IRuleProfile {
    // Reg. 2016/403 Annex I severity bands by rule ID; falls back to severityThresholds if unmapped.
    readonly annexISeverityBands?: Partial<Record<string, ISeverityThresholds>>;
    readonly breakRules: IBreakRuleConfig;
    readonly dailyDrivingRules: IDailyDrivingRuleConfig;
    readonly dailyRestRules: IDailyRestRuleConfig;
    readonly effectiveFrom: string;
    readonly effectiveTo: string | null;
    readonly ferryRules?: IFerryRuleConfig;
    readonly jurisdiction: string;
    // Null where the profile does not apply the Art. 8(5) multi-manning derogation.
    readonly multiManningRules: IMultiManningRuleConfig | null;
    readonly name: string;
    readonly profileId: string;
    // Legal instrument cited in infringements evaluated under this profile.
    readonly regulationName: string;
    readonly severityThresholds: ISeverityThresholds;
    readonly version: string;
    readonly weeklyDrivingRules: IWeeklyDrivingRuleConfig;
    readonly weeklyRestRules: IWeeklyRestRuleConfig;
    readonly workingTimeRules?: IWorkingTimeRuleConfig;
}

// Reg. 2016/403 Annex I absolute-hour cutoffs converted to margin minutes relative to profile limits.
// Daily driving MSI margin (270m) is calibrated to the standard 9h limit.
const EU_561_2006_ANNEX_I_SEVERITY_BANDS: Partial<Record<string, ISeverityThresholds>> = {
    BREAK_CONTINUOUS_DRIVING: { seriousMarginMinutes: 30, verySeriousMarginMinutes: 90 },
    DAILY_DRIVING_LIMIT: {
        mostSeriousMarginMinutes: 270,
        seriousMarginMinutes: 60,
        verySeriousMarginMinutes: 120,
    },
    // Rows 18-19: reduced daily rest (9h) where a reduction was still allowed.
    DAILY_REST_INSUFFICIENT: { seriousMarginMinutes: 60, verySeriousMarginMinutes: 120 },
    // Rows 16-17: regular daily rest (11h) once no reduction was allowed.
    DAILY_REST_INSUFFICIENT_REGULAR: { seriousMarginMinutes: 60, verySeriousMarginMinutes: 150 },
    // Rows 22-23: multi-manning daily rest (9h within 30h); Annex I defines no MSI tier for it.
    DAILY_REST_MULTI_MANNING: { seriousMarginMinutes: 60, verySeriousMarginMinutes: 120 },
    DAILY_REST_REDUCTIONS_EXCEEDED: { seriousMarginMinutes: 60, verySeriousMarginMinutes: 150 },
    // Section 3 rows 9-10 (Directive 2002/15/EC Art. 7(1)): 11h serious, 13h very serious against the 10h ceiling.
    NIGHT_WORK_DAILY_LIMIT_10H: { seriousMarginMinutes: 60, verySeriousMarginMinutes: 180 },
    WEEKLY_DRIVING_BIWEEKLY_LIMIT: {
        mostSeriousMarginMinutes: 1350,
        seriousMarginMinutes: 600,
        verySeriousMarginMinutes: 900,
    },
    WEEKLY_DRIVING_LIMIT: {
        mostSeriousMarginMinutes: 840,
        seriousMarginMinutes: 240,
        verySeriousMarginMinutes: 540,
    },
    WEEKLY_REST_INSUFFICIENT: { seriousMarginMinutes: 120, verySeriousMarginMinutes: 240 },
    WEEKLY_REST_MAX_SPACING_EXCEEDED: { seriousMarginMinutes: 180, verySeriousMarginMinutes: 720 },
    WEEKLY_REST_REGULAR_MISSING: { seriousMarginMinutes: 180, verySeriousMarginMinutes: 540 },
    // Section 3 rows 5-8: the break actually taken decides the tier, expressed here as its deficit against the
    // rule's requirement (over nine hours of work: a 20-30 minute break is serious and 20 minutes or less is very
    // serious; six to nine hours: 10-20 minutes serious, 10 minutes or less very serious).
    WORKING_TIME_BREAK_6H: { seriousMarginMinutes: 10, verySeriousMarginMinutes: 20 },
    WORKING_TIME_BREAK_9H: { seriousMarginMinutes: 15, verySeriousMarginMinutes: 25 },
    // Section 3 rows 3-4 (Art. 4): 65h serious, 70h very serious against the 60h weekly cap. The 48-hour average
    // rule is deliberately left on the flat margins: Annex I rows 1-2 classify a single week's hours, not an average.
    WORKING_TIME_WEEKLY_LIMIT_60H: { seriousMarginMinutes: 300, verySeriousMarginMinutes: 600 },
};

const EU_561_2006_STANDARD_MULTI_MANNING_RULES: IMultiManningRuleConfig = {
    availabilityBreakFrom: null,
    cardChangeToleranceMinutes: 1,
    dailyRestWindowMinutes: 1800,
    firstHourMinutes: 60,
    minDailyRestMinutes: 540,
};

export const EU_561_2006_STANDARD: IRuleProfile = {
    annexISeverityBands: EU_561_2006_ANNEX_I_SEVERITY_BANDS,
    breakRules: {
        maxContinuousDrivingMinutes: 270,
        minTotalBreakMinutes: 45,
        splitBreaks: [
            {
                firstBreakMinutes: 15,
                secondBreakMinutes: 30,
            },
        ],
    },
    dailyDrivingRules: {
        extendedDailyDrivingMinutes: 600,
        maxExtensionsPerCalendarWeek: 2,
        standardDailyDrivingMinutes: 540,
    },
    dailyRestRules: {
        maxReductionsPerPeriod: 3,
        reducedRestMinutes: 540,
        regularRestMinutes: 660,
        splitRest: {
            firstPeriodMinutes: 180,
            secondPeriodMinutes: 540,
        },
    },
    effectiveFrom: '2007-04-11',
    effectiveTo: null,
    ferryRules: {
        maxInterruptionDurationMinutes: 60,
        maxInterruptions: 2,
    },
    jurisdiction: 'EU',
    multiManningRules: EU_561_2006_STANDARD_MULTI_MANNING_RULES,
    name: 'Regulation (EC) No 561/2006 Standard',
    profileId: 'EU_561_2006_STANDARD',
    regulationName: 'Regulation (EC) No 561/2006',
    severityThresholds: {
        seriousMarginMinutes: 60,
        verySeriousMarginMinutes: 120,
    },
    version: '2024.1',
    weeklyDrivingRules: {
        maxBiWeeklyDrivingMinutes: 5400,
        maxWeeklyDrivingMinutes: 3360,
    },
    weeklyRestRules: {
        legalRegime: 'standard',
        maxRestSpacingMinutes: SIX_24_HOUR_PERIODS_MINUTES,
        reducedRestMinutes: 1440,
        regularRestMinutes: 2700,
    },
};

export const EU_MOBILITY_PACKAGE_2020: IRuleProfile = {
    ...EU_561_2006_STANDARD,
    effectiveFrom: '2020-08-20',
    multiManningRules: {
        ...EU_561_2006_STANDARD_MULTI_MANNING_RULES,
        availabilityBreakFrom: '2020-08-20',
    },
    name: 'EU Mobility Package Regulation (EU) 2020/1054',
    profileId: 'EU_MOBILITY_PACKAGE_2020',
    regulationName: 'Regulation (EC) No 561/2006, as amended by Regulation (EU) 2020/1054',
    version: '2020.1',
    weeklyRestRules: {
        ...EU_561_2006_STANDARD.weeklyRestRules,
        legalRegime: 'mobilityPackage2020',
    },
};

export const DIRECTIVE_2002_15_EC_WORKING_TIME: IRuleProfile = {
    ...EU_561_2006_STANDARD,
    effectiveFrom: '2005-03-23',
    effectiveTo: null,
    jurisdiction: 'EU',
    name: 'Directive 2002/15/EC (Road Transport Working Time)',
    profileId: 'DIRECTIVE_2002_15_EC_WORKING_TIME',
    version: '2002.1',
    workingTimeRules: {
        // Dir. 2002/15/EC Art. 4(a): 4-month reference period represented conservatively as 17 weeks.
        averageReferencePeriodWeeks: 17,
        breakRequirement6to9hMinutes: 30,
        breakRequirementOver9hMinutes: 45,
        continuousWorkLimitMinutes: 360,
        longWorkdayThresholdMinutes: 540,
        maxAverageWeeklyWorkingMinutes: 2880,
        maxWeeklyWorkingMinutes: 3600,
        minBreakSegmentMinutes: 15,
        // Dir. 2002/15/EC Art. 3(h): night time is at least four hours between 00:00 and 07:00 as defined by
        // national law; 00:00-04:00 is the default used until a jurisdiction-specific window is configured.
        nightWindowEndHourUtc: 4,
        nightWindowStartHourUtc: 0,
        nightWorkMaxDailyMinutes: 600,
    },
};

// AETR shares EU limits but excludes EU Annex I enforcement severity bands.
// Destructured to omit the key for exactOptionalPropertyTypes compliance.
const { annexISeverityBands: _eu561AnnexISeverityBands, ...eu561WithoutAnnexIBands } = EU_561_2006_STANDARD;

export const AETR_2020_INTERNATIONAL: IRuleProfile = {
    ...eu561WithoutAnnexIBands,
    effectiveFrom: '2020-01-01',
    effectiveTo: null,
    jurisdiction: 'UNECE',
    name: 'UNECE AETR Agreement (International Transport)',
    profileId: 'AETR_2020_INTERNATIONAL',
    regulationName: 'European Agreement Concerning the Work of Crews of Vehicles Engaged in International Road Transport (AETR)',
    version: '2020.1',
};

export const UK_GB_DOMESTIC: IRuleProfile = {
    breakRules: {
        maxContinuousDrivingMinutes: 330,
        minTotalBreakMinutes: 45,
        splitBreaks: [],
    },
    dailyDrivingRules: {
        extendedDailyDrivingMinutes: 600,
        maxExtensionsPerCalendarWeek: 0,
        standardDailyDrivingMinutes: 600,
    },
    dailyRestRules: {
        maxReductionsPerPeriod: 0,
        reducedRestMinutes: 600,
        regularRestMinutes: 600,
        splitRest: null,
    },
    effectiveFrom: '2021-01-01',
    effectiveTo: null,
    jurisdiction: 'UK',
    // GB domestic rules (Transport Act 1968) have no multi-manning derogation.
    multiManningRules: null,
    name: 'UK Great Britain Domestic Rules',
    profileId: 'UK_GB_DOMESTIC',
    regulationName: 'Transport Act 1968, Part VI (GB Domestic Rules)',
    severityThresholds: {
        seriousMarginMinutes: 60,
        verySeriousMarginMinutes: 120,
    },
    version: '2021.1',
    weeklyDrivingRules: {
        // GB domestic rules have no weekly/bi-weekly driving limit; 0 disables the check.
        maxBiWeeklyDrivingMinutes: 0,
        maxWeeklyDrivingMinutes: 0,
    },
    weeklyRestRules: {
        legalRegime: 'standard',
        maxRestSpacingMinutes: SIX_24_HOUR_PERIODS_MINUTES,
        reducedRestMinutes: 1440,
        regularRestMinutes: 1440,
    },
};

export const BUILTIN_RULE_PROFILES: readonly IRuleProfile[] = [
    EU_561_2006_STANDARD,
    EU_MOBILITY_PACKAGE_2020,
    DIRECTIVE_2002_15_EC_WORKING_TIME,
    AETR_2020_INTERNATIONAL,
    UK_GB_DOMESTIC,
];

export interface IMinuteExcess {
    readonly excessMinutes: number;
    readonly measuredMinutes: number;
}

// Measures excess against a legal maximum in minutes; uses Math.ceil to prevent rounding breaches to zero.
export function measureExcessMinutes(measuredMs: number, allowedMinutes: number): IMinuteExcess {
    const allowedMs = allowedMinutes * MILLISECONDS_PER_MINUTE;
    return {
        excessMinutes: Math.ceil((measuredMs - allowedMs) / MILLISECONDS_PER_MINUTE),
        measuredMinutes: Math.ceil(measuredMs / MILLISECONDS_PER_MINUTE),
    };
}

export interface IMinuteDeficit {
    readonly deficitMinutes: number;
    readonly measuredMinutes: number;
}

// Measures deficit against a legal minimum in minutes; rounds down measured and rounds up deficit.
export function measureDeficitMinutes(measuredMs: number, requiredMinutes: number): IMinuteDeficit {
    const requiredMs = requiredMinutes * MILLISECONDS_PER_MINUTE;
    return {
        deficitMinutes: Math.ceil((requiredMs - measuredMs) / MILLISECONDS_PER_MINUTE),
        measuredMinutes: Math.floor(measuredMs / MILLISECONDS_PER_MINUTE),
    };
}

function classifyMargin(
    marginMinutes: number,
    thresholds: ISeverityThresholds,
    reachesTier: (marginMinutes: number, tierMarginMinutes: number) => boolean,
): InfringementSeverity {
    if (thresholds.mostSeriousMarginMinutes !== undefined && reachesTier(marginMinutes, thresholds.mostSeriousMarginMinutes)) {
        return 'mostSerious';
    }
    if (reachesTier(marginMinutes, thresholds.verySeriousMarginMinutes)) {
        return 'verySerious';
    }
    if (reachesTier(marginMinutes, thresholds.seriousMarginMinutes)) {
        return 'serious';
    }
    return 'minor';
}

// Classifies an excess over a maximum. Annex I excess bands include their lower bound ("10h ≤ … < 11h" of driving),
// so an excess exactly on a margin enters that tier.
export function calculateSeverity(marginMinutes: number, profile: IRuleProfile, ruleId: string): InfringementSeverity {
    const thresholds = profile.annexISeverityBands?.[ruleId] ?? profile.severityThresholds;
    return classifyMargin(marginMinutes, thresholds, (margin, tierMargin) => margin >= tierMargin);
}

// Classifies a rest deficit. Annex I states rest bands by the rest actually taken ("7h ≤ … < 8h" of a 9h rest), so a
// deficit exactly on a margin stays in the lower tier. Profiles without an Annex I band keep the flat thresholds'
// inclusive convention. `bandKey` may differ from the reported rule ID when one rule has several Annex I rows.
export function calculateDeficitSeverity(deficitMinutes: number, profile: IRuleProfile, bandKey: string): InfringementSeverity {
    const annexBand = profile.annexISeverityBands?.[bandKey];
    if (annexBand === undefined) {
        return calculateSeverity(deficitMinutes, profile, bandKey);
    }
    return classifyMargin(deficitMinutes, annexBand, (margin, tierMargin) => margin > tierMargin);
}
