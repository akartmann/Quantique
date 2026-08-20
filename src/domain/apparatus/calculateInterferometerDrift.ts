import type { Result } from '../../core/errors/Result';
import type { ExperimentResult, RunControls } from '../evidence/RunRecord';

/**
 * The rotating-interferometer model: fringe displacement against orientation and bath temperature.
 *
 * ## Where each constant comes from (Story 4.2, AC3)
 *
 * The docstring that stood here said *"nothing here is sourced from the 1887 paper or the 1907 final
 * report. Calibrating them against the published numbers … is **Story 4.2's** work."* That sentence is
 * gone because it has been acted on, and this is the account of what was decided. **Two of these three
 * constants are still teaching-chosen, and they say so** — which is AC3's second branch, taken
 * deliberately and not by omission.
 *
 * The case's own 1907 transcription publishes two numbers, verbatim, and they are
 * {@link ETHER_DEMANDED_DISPLACEMENT_FRINGE_WIDTHS} and {@link PUBLISHED_CERTAINTY_FRACTION} below.
 *
 * ### Why the orientation amplitude is *bounded by* the published figure rather than *derived from* it
 *
 * Deriving it is the better shape and it was the story's own recommendation: `1.53 / 80` = 0.019125, the
 * largest residual the 1907 observations could not exclude, would make the bench's near-null reading at
 * the stable window **equal** the bound the case's record quotes — which today it does not.
 *
 * It is unavailable, and the reason is worth stating at the site rather than only in a story file. Any
 * change to a constant here changes every recorded value, which requires bumping
 * `experiment.modelVersion` — and `validateCaseRecordForDefinition` compares `experimentModelVersion`
 * against the definition's with **unconditional equality**, in `validateCaseRecordForDefinition`'s restore
 * walk and again in its completion walk, returning `invalid-case-record` for the *whole record*. (Named by
 * walk rather than by line number since the 4.2 code review: the two line numbers this cited had already
 * drifted by thirty lines, which is what a line number in a docstring does.) There
 * is no allowlist for `experimentModelVersion` as there is for `caseDefinitionVersion`; the only way to
 * accept a pre-bump record is a record migration. And because `attachAutosave` saves on the first
 * dispatch of the recovered session, the refusal overwrites the record it refused. So a bump discards
 * every returning player's investigation and tells them their work is unchanged — the defect the 1.1.0,
 * 1.3.0 and 1.4.0 record clauses exist to prevent.
 *
 * So `ORIENTATION_AMPLITUDE` keeps its value and gains a guarantee instead: it must lie **inside** the
 * published bound, which is the historical-honesty property that actually matters — the case's orientation
 * signal is smaller than anything 1907 could have ruled out. `ExperimentModels.test.ts` asserts it against
 * {@link PUBLISHED_RESIDUAL_BOUND_FRINGE_WIDTHS}, so the number and its justification fail together
 * rather than the justification living in prose beside it. Recorded in `deferred-work.md`: closing the
 * gap between 0.01 and 0.019125 needs the record-compatibility path a `modelVersion` bump has never had.
 *
 * ### Why the other two are not derived at all, and must not be
 *
 * The 1907 report publishes **no** thermal coefficient. What it says is that *"the temperature effects
 * could never be entirely eliminated"* — so a derivation would be a fabrication dressed as a citation,
 * which is worse than an honest design constant. What they owe instead is the design requirement they
 * satisfy, and it is asserted rather than asserted-in-prose: the thermal term must **swamp** the
 * orientation term at the authored default (22 °C → 0.10 against ±0.01, a factor of ten) and **vanish** at
 * the window. That gap is FR19's whole teaching loop — hold one, move the other, and the confound
 * separates from the signal.
 *
 * **Do not cite any of the three as historical.** The two published figures below are the only historical
 * numbers in this file.
 */

/**
 * What a stationary ether demanded, in fringe widths, as the 1907 report states it.
 *
 * > *"The expected drift would produce a displacement of the interference fringes of **1.53 wave-lengths**;
 * > the above result is probably certain to **one eightieth part** of the whole."*
 *
 * Authored as the second contextual artifact's rendition of record, a verified transcription of the
 * authors' own words; the case file is the source of truth and is deliberately not named here by id,
 * because a case id must not reach a domain module even in a comment. This is the counterfactual the
 * prediction proposals argue about; it is **not** what the apparatus reads.
 */
export const ETHER_DEMANDED_DISPLACEMENT_FRINGE_WIDTHS = 1.53;

/** The fraction of that displacement the observations could vouch for — *"one eightieth part"*. */
export const PUBLISHED_CERTAINTY_FRACTION = 1 / 80;

/**
 * The largest residual orientation signal the 1907 observations could not exclude, in fringe widths.
 *
 * ≈ 0.019. **The measured result was a bound, not a zero**, and Story 4.1 made that distinction legible
 * in the player's record; this is the same number the physics side of the model is held against.
 *
 * Read by `ExperimentModels.test.ts`, which asserts {@link ORIENTATION_AMPLITUDE} lies inside it. A
 * constant read only by a guard test is not the shipped-and-dead shape — it is the project's own rule
 * that a test must never share a magic number with source unless both read one exported constant,
 * applied to a justification instead of a coordinate.
 */
export const PUBLISHED_RESIDUAL_BOUND_FRINGE_WIDTHS
    = ETHER_DEMANDED_DISPLACEMENT_FRINGE_WIDTHS * PUBLISHED_CERTAINTY_FRACTION;

/**
 * Fringe displacement, in fringe widths, contributed by orientation alone at its extremes.
 *
 * Teaching-chosen, and constrained: it must stay inside
 * {@link PUBLISHED_RESIDUAL_BOUND_FRINGE_WIDTHS}, so the signal this apparatus reads is smaller than
 * anything the historical observations could have ruled out. See the header for why it is bounded rather
 * than derived.
 */
export const ORIENTATION_AMPLITUDE = 0.01;

/**
 * Fringe displacement, in fringe widths, contributed per degree Celsius away from the stable window.
 *
 * **Teaching-chosen. The 1907 report publishes no coefficient**, and inventing a derivation for one would
 * be a fabrication dressed as a citation. Its design requirement is that the thermal term swamp the
 * orientation term at the authored default, which is what makes the confound discoverable and the signal
 * recoverable; `ExperimentModels.test.ts` asserts the factor rather than trusting this sentence.
 */
export const THERMAL_COEFFICIENT = 0.05;

/**
 * The bath temperature at which the thermal term vanishes and the orientation signal stands alone.
 *
 * **Teaching-chosen**, for the same reason and with the same standing as {@link THERMAL_COEFFICIENT}.
 *
 * It is also the one constant here the *player* has to know: `experiment.resetPath.description` tells
 * them to bring the bath back to its steady window, and a window they cannot name is an instruction they
 * cannot follow. So the authored prose states this number in both locales and
 * `MorleyMillerFeedback.test.ts` asserts the authored sentence against this constant — two copies that
 * fail together rather than drift. (This named `MorleyMillerPrototype.test.ts` until the 4.2 code review
 * checked; that file asserts the *model constants against the 1907 transcription*, which is a different
 * pair and was itself asserted nowhere at all.) The bench also rings the bath when it is at this temperature
 * (`InterferometerTableau`), which is the same fact told diegetically.
 */
export const STABLE_WINDOW_C = 20;

/** The authored control IDs this model reads. Checked against the case's apparatus at load. */
export const INTERFEROMETER_CONTROL_IDS = ['rotationDeg', 'bathTempC'] as const;

/**
 * Mirrors {@link calculateYoungFringeSpacing}'s stored precision rather than inventing a second one:
 * both results are read by the same notebook, the same printable record and the same bench readout,
 * and two precisions there would be two ways to render "the same" observation.
 */
const DISPLAY_DECIMAL_PLACES = 4;

/**
 * Rounds to the stored precision and normalizes negative zero away.
 *
 * `Number((-1.8e-18).toFixed(4))` is `-0`, and `-0` renders as **"-0"**: `decimalPlaces` reads
 * `(-0).toString()`, which is `"0"`, so it formats at zero decimals with the sign intact. That is
 * reachable from ordinary authored play — `rotationDeg 135` at the stable window puts `cos(270°)` at
 * `-1.84e-16` — and it lands on the one reading the teaching loop is *about*, the near-null. The
 * symmetric orientation at 45° prints `0`. Two readings of the same physical null, rendered with
 * different signs (review 2026-08-19).
 */
const roundForStoredDisplay = (value: number): number => {
    const rounded = Number(value.toFixed(DISPLAY_DECIMAL_PLACES));
    return rounded === 0 ? 0 : rounded;
};

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Deterministic fringe displacement for the rotating interferometer.
 *
 * ```
 * displacement = ORIENTATION_AMPLITUDE * cos(2θ) + THERMAL_COEFFICIENT * (bathTempC - STABLE_WINDOW_C)
 * ```
 *
 * `cos(2θ)` is the orientation term's physical period: rotating 90° reverses the sign, and 180°
 * returns to the start.
 *
 * **The period is why 0° and 180° are one reading, not two.** An earlier version of this docstring
 * claimed the period was what made two orientations "a genuinely distinguishing pair", which is the
 * opposite of what it does at the endpoints: the authored travel is 0–180°, so dragging the knob from
 * its default to its maximum returns the *same* displacement, and the e2e walk did exactly that while
 * calling the two runs distinguishing (review 2026-08-19). The distinguishing pair is 0°/90° — a sign
 * reversal — and that is the pair the walk now records.
 *
 * At 22 °C the thermal term is 0.10 and swamps the ±0.01 orientation term entirely; at the stable
 * window it vanishes and what remains is the near-null signal the historical result actually was.
 */
export const calculateInterferometerDrift = (controls: RunControls): Result<ExperimentResult> => {
    const rotationDeg = controls.rotationDeg;
    const bathTempC = controls.bathTempC;
    if (!Number.isFinite(rotationDeg) || !Number.isFinite(bathTempC)) {
        return { ok: false, error: { code: 'invalid-experiment-model-input', message: 'The selected apparatus inputs cannot produce a fringe displacement.' } };
    }

    const displacement = ORIENTATION_AMPLITUDE * Math.cos(2 * rotationDeg * DEGREES_TO_RADIANS)
        + THERMAL_COEFFICIENT * (bathTempC - STABLE_WINDOW_C);
    if (!Number.isFinite(displacement)) {
        return { ok: false, error: { code: 'invalid-experiment-model-input', message: 'The selected apparatus inputs cannot produce a fringe displacement.' } };
    }

    return { ok: true, value: Object.freeze({ label: 'Fringe displacement', value: roundForStoredDisplay(displacement), unit: 'fringe widths' }) };
};
