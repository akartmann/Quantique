# Young observation rubric

Complete this rubric by direct facilitator observation during a consented moderated session. Do not derive either measure from application state, events, IndexedDB, exports, Playwright, telemetry, or analytics.

Both fields were rewritten for the guided-adventure model. The conclusion is no longer written by the
learner: it is **one of four authored colleague proposals**, and the minimum path to unlocking it is
**≥2 significant measures** per the case's significance rule, not a run count. The pre-pivot
definitions credited behaviour that the current product hands to the learner for free — do not carry
them forward.

## Per-session header

| Field | Value |
| --- | --- |
| Facilitator-held session code | _Arbitrary, non-identifying; removed before aggregation_ |
| Session date | _YYYY-MM-DD_ |
| **Interface locale** | **`en` or `fr`** — the locale the session was actually run in, as resolved from the browser (see the locale protocol in `young-validation-plan.md`) |

The locale is recorded on every session because the aggregate reports each measure **both overall and
split by locale**, and because the gate requires at least one session in each locale. A session whose
locale was not recorded cannot be counted toward the per-locale minimum.

## Field A — Own-measurement reason for the chosen proposal

This is the single distinction the gate now rests on. The learner selects an authored proposal card,
so "cites a recorded observation" is trivially satisfiable by reading the card aloud. The measure is
whether the learner can say **why that proposal beat the other three, using something they measured
themselves**.

**Yes** — only when the participant, **unprompted and in their own words**, names a **specific
measurement or apparatus setting from their own run** as the reason that proposal beat the others.

Examples that earn a **Yes**:

- "When I moved the screen further out the bands got wider, and that one is the only proposal that says spacing grows with distance."
- "At 0.10 mm slit spacing the fringes were much further apart than at 0.50 mm — the other cards don't account for that."
- "I got about 4.4 mm at two metres, and only that proposal matches a number that big."

**No** — when the participant does any of the following instead. These are non-credit even when the
chosen proposal is the well-supported one:

| Non-credit response | Example |
| --- | --- |
| **Restates the proposal's text** | "Because the light interferes and makes bands, like it says." |
| **Cites a colleague's authority** | "Because Camille said so." / "The senior one seemed most confident." |
| **Cites the source reading alone** | "Young's lecture says it, and the Opticks pages back it up." |
| **Gives a general impression** | "It just looked right." / "It felt like the most careful answer." |

A facilitator may ask one neutral, non-leading opener ("Can you tell me why you picked that one?").
Anything that names a control, a value, or a comparison for the learner makes the response
**prompted**, and a prompted response is a **No**.

## Field B — Beyond-minimum variable test

The minimum path is **≥2 significant measures** as defined by the case's significance rule
(Story 2.6). Do **not** define this field by run count: repeating an identical configuration may
produce two runs and zero additional significant measures, and a single well-chosen variation may
satisfy the gate outright.

**Yes** — only when the participant **initiates** at least one apparatus variation that was **not
needed to unlock the conclusion**. Any one of these qualifies:

- A further run **after** the conclusion had already unlocked.
- Varying the **second** primary control after the first had already carried them past the gate — the
  two primary controls are slit spacing (`slitSpacingMm`) and screen distance (`screenDistanceM`).
- Taking the **optional advanced wavelength comparison** rather than the fixed minimum path
  (`experiment.wavelengthComparison.advancedChoicesNm`, currently `[450, 650]`, against
  `fixedMinimumPathNm: 550`).

**No** — when every apparatus change they made was on the path the conclusion gate required of them,
or when the only additional runs repeated a configuration they had already measured.

A variation the **facilitator** suggests is a **No**: the measure is voluntary exploration.

## Calculation

For each measure, the **numerator** is the count of included participants with a **Yes** observation.
The **denominator** is the count of included consented sessions with an observable outcome for that
measure. Exclude a session only when consent is withdrawn, the session is abandoned before an
observable outcome, or a documented technical failure prevents the observation; record the exclusion
count and reason category in facilitator-held notes.

`percentage = (numerator / denominator) × 100`

Each target passes only at **>= 60%**, calculated on the **overall** denominator. Report the same
calculation **split by locale** alongside it, so a shortfall concentrated in one language is visible
rather than averaged away. Record the calculation date and validation lead in
`young-validation-aggregate-template.md`.

A denominator of zero fails the gate. A sample containing sessions in only one locale fails the gate
regardless of the percentage — an EN-only sample cannot satisfy either 60% target (AC5).

These observations are facilitator evidence, not product facts. No automated test, event log, or
export may supply either field.
