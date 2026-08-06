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

/** A run's position in the space the rule calls critical. Stable for a given rule and run. */
const configurationKey = (rule: SignificanceRule, run: RunRecord): string =>
    rule.criticalControlIds.map((controlId) => `${controlId}=${run.controls[controlId]}`).join('|');

/**
 * Whether this run's reading is far enough from every already-counted one to be a distinct
 * measurement rather than the same number reached another way.
 *
 * An absent `minimumResultDelta` means the rule makes no claim about readings, so every distinct
 * configuration counts on configuration alone.
 */
const isDistinguishableReading = (
    rule: SignificanceRule,
    run: RunRecord,
    counted: readonly RunRecord[]
): boolean => rule.minimumResultDelta === undefined
    || counted.every((other) => Math.abs(run.result.value - other.result.value) >= rule.minimumResultDelta!);

/**
 * The number of significant measurements in `runs`.
 *
 * A run counts when its critical configuration has not been counted before **and** its reading is
 * distinguishable from every run already counted. Runs are walked in recorded order; the total is
 * order-independent, because both conditions are symmetric over the counted set.
 */
export const countSignificantMeasures = (rule: SignificanceRule, runs: readonly RunRecord[]): number => {
    const seenConfigurations = new Set<string>();
    const counted: RunRecord[] = [];

    for (const run of runs) {
        const key = configurationKey(rule, run);
        if (seenConfigurations.has(key)) continue;
        if (!isDistinguishableReading(rule, run, counted)) continue;
        seenConfigurations.add(key);
        counted.push(run);
    }

    return counted.length;
};

/**
 * Whether the recorded evidence clears the authored bar for unlocking the conclusion.
 *
 * The bar is read from `requirements.minimumSignificantRuns` rather than written as a literal, so
 * the count and the threshold stay one authored decision.
 */
export const isSignificantMeasureGateMet = (definition: CaseDefinition, runs: readonly RunRecord[]): boolean =>
    countSignificantMeasures(definition.significanceRule, runs) >= definition.requirements.minimumSignificantRuns;
