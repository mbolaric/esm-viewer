import type { EventFaultCode, TachographEventFault } from '#tachograph-domain';

import type { IInfringement, InfringementSeverity } from '../infringement.js';
import { measureExcessMinutes, type IRuleProfile } from '../rule-profile.js';

interface IAnomalyRuleDefinition {
    readonly article: string;
    readonly description: string;
    readonly ruleId: string;
    readonly severity: InfringementSeverity;
    readonly title: string;
}

// Reg. 165/2014 & Reg. 2016/403 Annex I: classifies driving without card and sensor anomalies as MSI.
const ANOMALY_RULE_DEFINITIONS: Partial<Record<EventFaultCode, IAnomalyRuleDefinition>> = {
    drivingWithoutAppropriateCard: {
        article: 'Art. 34(1)',
        description: 'Driver failed to use the driver card while driving',
        ruleId: 'ANOMALY_DRIVING_WITHOUT_CARD',
        severity: 'mostSerious',
        title: 'Driving Without Card',
    },
    motionDataError: {
        article: 'Art. 32(1)',
        description: 'Motion sensor data integrity fault detected by the recording equipment',
        ruleId: 'ANOMALY_MOTION_DATA_ERROR',
        severity: 'mostSerious',
        title: 'Motion Data Error',
    },
    vehicleMotionConflict: {
        article: 'Art. 32(1)',
        description: 'Recorded vehicle motion is inconsistent with the motion sensor signal',
        ruleId: 'ANOMALY_VEHICLE_MOTION_CONFLICT',
        severity: 'mostSerious',
        title: 'Vehicle Motion Conflict',
    },
};

export function evaluateAnomalyInfringements(
    eventFaults: readonly TachographEventFault[],
    profile: IRuleProfile,
): readonly IInfringement[] {
    const infringements: IInfringement[] = [];

    for (const record of eventFaults) {
        if (record.recordKind !== 'event') {
            continue;
        }

        const definition = ANOMALY_RULE_DEFINITIONS[record.code];
        if (definition === undefined) {
            continue;
        }

        const endMs = record.end;
        const durationMs = endMs !== null ? Math.max(0, endMs - record.start) : 0;
        const { measuredMinutes } = measureExcessMinutes(durationMs, 0);

        infringements.push({
            allowedValueMinutes: 0,
            category: 'anomaly',
            excessOrDeficitMinutes: measuredMinutes,
            id: `anomaly-${String(record.start)}-${record.code}`,
            legalReference: {
                article: definition.article,
                description: definition.description,
                regulation: 'Regulation (EU) No 165/2014',
            },
            measuredValueMinutes: measuredMinutes,
            profileId: profile.profileId,
            recordedAt: record.start,
            ruleId: definition.ruleId,
            severity: definition.severity,
            source: record.source,
            title: definition.title,
        });
    }

    return infringements;
}
