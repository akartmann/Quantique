import type { CaseDefinition } from '../cases/CaseDefinition';
import type { ColleagueHint, ColleagueHintPredicate } from '../cases/ColleagueCast';
import type { RunRecord } from '../evidence/RunRecord';
import { countSignificantMeasures } from '../evidence/significantMeasures';

/**
 * Which authored colleague hint answers a player whose evidence has not yet cleared the
 * significant-measure gate (Story 2.6).
 *
 * Pure and dependency-free by design: no Phaser, no store, no locale, no Zod. Selection is a content
 * lookup over recorded runs, and it is tested without a browser.
 *
 * **It carries the authored `LocalizedText`, never a resolved string** — the domain selects *which*
 * hint applies and the presentation resolves the active language, the same split
 * `ConsultationProjection` makes. Nothing here is persisted, so unlike `peerReviewRules` an author
 * may rewrite a line without touching a single saved investigation.
 *
 * **It never reads the defensible-conclusion set**, and the projection has no field that could carry
 * one. A hint points at a measurement to take; it must not hint at an answer (ADR-006, and the
 * project rule that hints "never supply the answer").
 */
export type ColleagueHintProjection = Readonly<{
    hintId: string;
    colleagueId: string;
    line: ColleagueHint['line'];
}>;

const freezeProjection = (hint: ColleagueHint): ColleagueHintProjection => Object.freeze({
    hintId: hint.id,
    colleagueId: hint.colleagueId,
    line: hint.line
});

/** Distinct recorded values for one control — the same test `varied-control` applies. */
const distinctValues = (runs: readonly RunRecord[], controlId: 'slitSpacingMm' | 'screenDistanceM'): number =>
    new Set(runs.map((run) => run.controls[controlId])).size;

const applies = (
    predicate: ColleagueHintPredicate,
    definition: CaseDefinition,
    runs: readonly RunRecord[]
): boolean => {
    switch (predicate.kind) {
        case 'no-recorded-runs':
            return runs.length === 0;
        case 'repeated-configuration':
            // More runs than the rule counts as distinguishing means at least one is a replication.
            return runs.length > countSignificantMeasures(definition.significanceRule, runs);
        case 'unvaried-control':
            // `runs.length > 0` on purpose: with an empty notebook every control is trivially
            // unvaried, and "you never changed the screen distance" is the wrong first thing to say
            // to someone who has not measured anything yet. The empty case has its own hint.
            return runs.length > 0 && distinctValues(runs, predicate.controlId) < 2;
        case 'below-significant-measures':
            // The catch-all floor. The caller has already established the gate is unmet, so this is
            // unconditionally true — which is exactly what makes it a safe last authored entry.
            return true;
    }
};

/**
 * The first authored hint that applies, in authored order, or `undefined`.
 *
 * `undefined` means one of two things, and they are deliberately the same answer: the gate is
 * already met and the player needs no nudge, or no authored hint matches this evidence. Validation
 * requires at least one hint that holds with an empty notebook, so the second case cannot arise for
 * shipped content — but a caller must still handle it rather than assume a line exists.
 *
 * Authored order is the escalation order: put the specific predicates first and the catch-all last.
 */
export const selectColleagueHint = (
    definition: CaseDefinition,
    runs: readonly RunRecord[]
): ColleagueHintProjection | undefined => {
    if (countSignificantMeasures(definition.significanceRule, runs) >= definition.requirements.minimumSignificantRuns) {
        return undefined;
    }
    const hint = definition.colleagueHints.find((candidate) => applies(candidate.predicate, definition, runs));
    return hint ? freezeProjection(hint) : undefined;
};
