import { MILLISECONDS_PER_MINUTE } from '#time';

import type { IComplianceAssessment } from '../compliance-assessment.js';
import { EU_165_2014_TACHOGRAPH_URL } from '../legal-references.js';
import type { IRuleProfile } from '../rule-profile.js';
import type { IUnrecordedPeriod } from '../unrecorded-time.js';

// Reg. (EU) 165/2014 Art. 34(3) and Reg. (EU) 2016/403 Annex I: time away from the vehicle must be entered manually.
// Rest and break rules treated each such period as rest, so each one needs the driver's or operator's account.
// A period still open when the records end is skipped: its entry is only due at the next card insertion. Periods
// shorter than the shortest break part are skipped too, since no break or rest rule turns on them alone.
// Only EU profiles cite the obligation; AETR and GB domestic recording rules are not modelled.
export function evaluateUnrecordedPeriodAssessments(
    periods: readonly IUnrecordedPeriod[],
    profile: IRuleProfile,
): readonly IComplianceAssessment[] {
    if (profile.jurisdiction !== 'EU') {
        return [];
    }

    const shortestBreakPartMinutes =
        profile.breakRules.splitBreaks[0]?.firstBreakMinutes ?? profile.breakRules.minTotalBreakMinutes;
    const minimumDurationMs = shortestBreakPartMinutes * MILLISECONDS_PER_MINUTE;

    return periods
        .filter((period) => period.isFollowedByRecord && period.end - period.start >= minimumDurationMs)
        .map((period) => ({
            category: 'anomaly',
            id: `unrecorded-period-${String(period.start)}`,
            legalReference: {
                article: 'Art. 34(3)',
                description: 'Time away from the vehicle was not entered manually; rest and break rules treated it as rest',
                regulation: 'Regulation (EU) No 165/2014',
                sourceUrl: EU_165_2014_TACHOGRAPH_URL,
            },
            profileId: profile.profileId,
            recordedAt: period.start,
            ruleId: 'UNRECORDED_PERIOD_REVIEW',
            source: period.source,
            status: 'externalEvidenceRequired',
        }));
}
