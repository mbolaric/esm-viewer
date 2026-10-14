# Evidence-based compliance scenarios

The public `#compliance` service `evaluateDocumentComplianceScenario(document, request, profile?, nightWindow?)` returns the
unchanged recorded baseline and separate numerical findings under explicit, source-bound reviewer assumptions. The request
contains the exact source SHA-256 and at most 100 assumptions, each with a bounded evidence ID, canonical source pointer and
positive UTC interval. The result records calculation version `1`, the profile and the complete applied assumption set. These
are single-source comparisons; they do not merge driver cards or VU records or decide exemptions, fines, points or intent.

Invalid requests, changed hashes, unavailable driver activities, foreign pointers, uncovered ranges, duplicate IDs and
overlapping assumptions reject the entire comparison. Interpreted activity copies stay inside the engine and are omitted from
public scenario outputs. The opened document and baseline never change. Source warnings and incomplete recordings still require
the caller's existing partial-evidence presentation. Callers must validate saved evidence revisions and decide visibility before
publishing a comparison; evidence IDs and assertions are not automatically exportable.

| Assumption | Numerical behavior and required evidence |
| --- | --- |
| Unrecorded work/rest | Changes only time the existing resolver identifies as unrecorded, within observed coverage. Work affects the existing break/driving/rest/work rules; rest can confirm the favourable baseline with no numerical change. The missing-manual-entry review remains. Recorded activities cannot be replaced through this input. |
| Crew presence | Applies a reviewer assertion to driving in the cited interval and reuses the existing Article 4(o)/8(5) policy. The recorded baseline remains beside the resulting 24/30-hour comparison. It does not certify the second driver's physical presence or credit unsupported availability as a break. |
| Outside Regulation 561/2006 | Treats the scoped movement as work for the rule comparison, retaining elapsed duty and working time. It is never counted as rest. The reviewer must explicitly confirm the asserted scope; the software does not infer a private depot from a location or OUT indicator. |
| Ferry/train rest | Requires asserted vehicle accompaniment and sleeping accommodation, at most two interruptions totalling one hour, and enough actual rest excluding interruptions. Regular daily rest, reduced weekly rest and regular weekly rest are distinct choices. Regular weekly rest additionally requires a cabin and at least eight scheduled journey hours. Weekly choices require dates from 20 August 2020. A lower rest category cannot be used to bypass the regular-weekly conditions. |
| Article 12 weekly return | Requires asserted exceptional circumstances, maintained road safety, written reason and compensation by the statutory deadline, a return to residence/operational centre, observed following weekly rest and an observed preceding qualifying rest. One hour supports reduced/regular weekly rest; two hours requires regular weekly rest and the immediate uninterrupted thirty-minute break. Only the cited actual driving is credited to daily/weekly allowances and the matching 24-hour daily-rest window; crew 30-hour windows are not extended. Ordinary extension accounting, required rest lengths, break, fortnightly-driving, weekly-rest deadline and working-time rules remain. The general safe-stopping-place paragraph and drives crossing the baseline duty-window end are outside this bounded contract. |

The API accepts the EU standard and Mobility Package profile identities and retains the supplied profile settings in both results.
It reuses millisecond evaluation and the existing rounding/severity rules. Claims about external circumstances are supplied by a
reviewer with evidence; the engine checks numerical prerequisites and does not verify a ticket, printout or rationale itself.

Fixture coverage in `src/compliance/application/__tests__/compliance-service.test.ts` checks baseline/source immutability, both
disjoint edits within one unrecorded interval, unsupported recorded edits, hash/range/conflict rejection, crew windows, retained
formal-entry review, non-rest scope treatment, ferry credit and interruption/regular-weekly conditions, and Article 12 break,
weekly-return and fortnightly constraints. This is engineering validation, not independent regulatory certification.

Primary-source basis checked on 14 October 2026:

- [Regulation 561/2006 consolidated text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02006R0561-20241231): Articles 4, 6(5), 8, 9 and 12.
- [Commission Guidance Note 7](https://transport.ec.europa.eu/system/files/2016-09/guidance_7_en.pdf): qualifying-rest anchors and 24/30-hour periods.
- [Commission Mobility Package questions and answers](https://transport.ec.europa.eu/transport-modes/road/mobility-package-i/driving-rest-times_en): ferry accommodation, Article 12 rest completion/compensation, retained break/fortnightly/weekly-rest limits.

The relevant sections are applied as bounded reviewer scenarios, not the earlier Cases blueprint's blanket finding suppression
or fixed fine-saving examples. No new runtime dependency, parser change or standalone UI is introduced.
