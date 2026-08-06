# Young validation aggregate — template

Complete only with de-identified totals after the moderated sessions. Both measures are reported
**overall** and **split by interface locale**, because a shortfall concentrated in one language is
invisible in an averaged total and because the gate requires at least one session in each locale
(AC5).

| Item | Value |
| --- | --- |
| Calculation date | _YYYY-MM-DD_ |
| Learning-validation lead / session owner | _Name_ |
| Sessions scheduled | _15–30_ |
| Sessions run in `en` | _Number_ |
| Sessions run in `fr` | _Number_ |

## Measure A — Own-measurement reason for the chosen proposal

Field A of `young-observation-rubric.md`: the participant, unprompted and in their own words, named a
specific measurement or apparatus setting from their own run as the reason that proposal beat the
others.

| Slice | Included denominator | Numerator (Yes) | Percentage |
| --- | --- | --- | --- |
| **Overall** | _Number_ | _Number_ | _Number%_ |
| `en` | _Number_ | _Number_ | _Number%_ |
| `fr` | _Number_ | _Number_ | _Number%_ |

## Measure B — Beyond-minimum variable test

Field B of `young-observation-rubric.md`: the participant initiated at least one apparatus variation
that was not needed to unlock the conclusion. Not a run count.

| Slice | Included denominator | Numerator (Yes) | Percentage |
| --- | --- | --- | --- |
| **Overall** | _Number_ | _Number_ | _Number%_ |
| `en` | _Number_ | _Number_ | _Number%_ |
| `fr` | _Number_ | _Number_ | _Number%_ |

## Exclusions and consent

| Item | Value |
| --- | --- |
| Excluded-session totals and reason categories (overall) | _Totals only_ |
| Excluded-session totals by locale | _Totals only_ |
| Consent-held evidence location/reference | _Facilitator-controlled reference; no participant data_ |

## Calculation and result

`percentage = (numerator / denominator) × 100`, computed independently for each row above. A session
excluded from one measure may still count toward the other.

**Locale denominators.** `en` + `fr` + `locale unrecorded` sums to the overall denominator. The third
bucket exists because the rubric anticipates it — a session whose per-session locale field was left blank
cannot be counted toward the per-locale minimum, but it still happened and still counts toward the overall
measures, so it is neither excludable nor assignable to a language. Record it here rather than dropping it
or guessing.

| Locale bucket | Sessions | Measure A numerator | Measure B numerator |
| --- | --- | --- | --- |
| `en` | _Total_ | _Total_ | _Total_ |
| `fr` | _Total_ | _Total_ | _Total_ |
| Locale unrecorded | _Total_ | _Total_ | _Total_ |
| **Overall** | _Sum_ | _Sum_ | _Sum_ |

A non-zero "locale unrecorded" count is a protocol defect worth naming in the notes: it means a
facilitator skipped a required field, and it shrinks the evidence available for the `>= 1 en` / `>= 1 fr`
condition below.

| Gate condition | Result |
| --- | --- |
| Measure A overall **>= 60%** | _Pass / Blocked_ |
| Measure B overall **>= 60%** | _Pass / Blocked_ |
| Sample includes **>= 1** session in `en` **and** **>= 1** in `fr` | _Pass / Blocked_ |
| **Result** | _Pass only when all three conditions above are Pass; otherwise Blocked_ |

A denominator of zero fails the gate. The two 60% targets are evaluated on the **overall** slice; the
per-locale rows are reported for visibility and are not separately thresholded — but a single-locale
sample fails the third condition and therefore fails the gate, so an EN-only sample cannot satisfy
either target.

Do not enter names, identifiers, raw conclusions, progress records, exports, screenshots containing
learner data, or product-derived event data. **In this sheet**, record only the locale totals above and
never a per-participant locale — this is the de-identified aggregate, and a per-participant language
alongside the other columns narrows the pool a session could belong to. The rubric's per-session locale
field is still **required**; it lives in the facilitator-held session records, which is where per-session
detail belongs, and it is what these totals are counted from.
