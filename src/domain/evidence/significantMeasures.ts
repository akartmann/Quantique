import type { CaseDefinition, SignificanceRule } from '../cases/CaseDefinition';
import type { RunRecord } from './RunRecord';

/**
 * How many of the recorded runs count as *significant* measurements (Story 2.6).
 *
 * Pure and dependency-free by design: no Phaser, no store, no `AppState`, no locale, no Zod. AC1
 * requires the count to come "deterministically from the recorded runs without inspecting scene
 * state", and the only way to guarantee that is for scene state to be unreachable from here.
 *
 * The distinction it draws is the one `conclusionProposals.ts`'s `varied-control` already draws, and
 * for the same reason: two runs at the same setting are a *replication* — worth having, and evidence
 * that the instrument is steady — but they do not distinguish anything, so they cannot be two
 * distinguishing measurements. What unlocks the conclusion is evidence that could have come out
 * differently.
 *
 * This is deliberately **not** part of `evaluateConclusionReadiness`. That function is the pre-pivot
 * *draft* check — support selections, a saved comparison, a written conclusion and limitation — and
 * it gates `theory.reviewRequested` and `case.debriefCompleted`. Folding a phase gate into it would
 * change what both of those mean. `game-architecture.md` sketches one combined evaluator; the
 * realized decomposition is finer.
 */

/**
 * The slot a run without `modelInputs` occupies for a critical model input.
 *
 * A fixture run carries `controls` but no `modelInputs` (Task 3 requires it still count), so its
 * wavelength is genuinely unknown rather than equal to any recorded one. Giving it its own slot keeps
 * "unknown" from silently colliding with an authored value.
 */
const UNRECORDED_INPUT = '∅';

/**
 * A run's position in the space the rule calls critical — its *configuration*.
 *
 * Exported because `colleagueHints.ts`'s `repeated-configuration` predicate asks the same question
 * and must ask it directly rather than inferring a repetition from a count shortfall.
 */
export const configurationKey = (rule: SignificanceRule, run: RunRecord): string => [
    ...rule.criticalControlIds.map((controlId) => `${controlId}=${run.controls[controlId]}`),
    // `criticalModelInputIds` is an authored stable ID since Story 3.1, and `modelInputs` is the
    // Young model's own typed shape — so the read is a lookup on a record whose keys this rule cannot
    // know. An ID naming nothing on the run yields `UNRECORDED_INPUT`, which is the same slot a run
    // with no `modelInputs` at all occupies: genuinely unknown, never silently equal to a value.
    ...(rule.criticalModelInputIds ?? []).map((inputId) => {
        const inputs: Readonly<Record<string, unknown>> | undefined = run.modelInputs;
        return `${inputId}=${inputs?.[inputId] ?? UNRECORDED_INPUT}`;
    })
].join('|');

/**
 * The number of significant measurements in `runs` — that is, the number of distinct critical
 * configurations recorded.
 *
 * **Order-independent by construction**, not by argument: it is the cardinality of a set, so no
 * walk order can change it. This replaced a greedy pass whose `minimumResultDelta` check compared
 * each run against the runs already counted; that made the total depend on recording order, and the
 * docstring claiming otherwise was wrong (review, 2026-08-06). See {@link SignificanceRule}.
 */
export const countSignificantMeasures = (rule: SignificanceRule, runs: readonly RunRecord[]): number =>
    new Set(runs.map((run) => configurationKey(rule, run))).size;

/**
 * Whether the recorded evidence clears the authored bar for unlocking the conclusion.
 *
 * The bar is read from `requirements.minimumSignificantRuns` rather than written as a literal, so
 * the count and the threshold stay one authored decision.
 */
export const isSignificantMeasureGateMet = (definition: CaseDefinition, runs: readonly RunRecord[]): boolean =>
    countSignificantMeasures(definition.significanceRule, runs) >= definition.requirements.minimumSignificantRuns;
