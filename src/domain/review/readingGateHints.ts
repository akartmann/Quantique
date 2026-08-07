import type { CaseDefinition } from '../cases/CaseDefinition';
import type { ReadingGateHint, ReadingGateHintPredicate } from '../cases/ColleagueCast';
import { evaluateContextReadiness } from '../cases/contextPredictionReadiness';

/**
 * Which authored colleague line answers a player whose required reading is incomplete (Story 2.8,
 * AC4).
 *
 * Pure and dependency-free by design: no Phaser, no store, no locale, no Zod. Selection is a content
 * lookup over the inspected artifacts, and it is tested without a browser. It is the sibling of
 * `colleagueHints.ts` and follows it deliberately, down to the projection shape.
 *
 * **It never re-derives "missing".** `evaluateContextReadiness` is the one place that decides which
 * artifacts are outstanding, and it counts an artifact as missing when it is *ineligible or
 * uninspected*. A second definition here could disagree with the gate the player just met — a
 * colleague naming a reading the store considers done, or falling silent on one it does not.
 *
 * **It carries the authored `LocalizedText`, never a resolved string** — the domain selects *which*
 * line applies and the presentation resolves the active language. Nothing here is persisted, so an
 * author may rewrite a line without touching a single saved investigation.
 *
 * **It never reads the defensible-conclusion set**, and the projection has no field that could carry
 * one. A line points at a reading to take; it must not hint at an answer (ADR-006).
 */
export type ReadingGateHintProjection = Readonly<{
    hintId: string;
    colleagueId: string;
    line: ReadingGateHint['line'];
}>;

const freezeProjection = (hint: ReadingGateHint): ReadingGateHintProjection => Object.freeze({
    hintId: hint.id,
    colleagueId: hint.colleagueId,
    line: hint.line
});

const applies = (predicate: ReadingGateHintPredicate, missingArtifactIds: readonly string[]): boolean => {
    switch (predicate.kind) {
        case 'missing-artifact':
            return missingArtifactIds.includes(predicate.artifactId);
        case 'any-missing-reading':
            // The catch-all floor. The caller has already established the reading is incomplete, so
            // this is unconditionally true — which is exactly what makes it a safe last authored
            // entry, and why validation requires it to be authored *and* to be last.
            //
            // For Young it never fires, and that is correct rather than dead content: the case
            // authors one specific line per contextual artifact, so any incomplete state names at
            // least one of them. The floor is the guarantee that a *future* case — one that adds an
            // artifact and forgets its line — cannot author its way into a refusal with nothing to
            // say. A safety net that never catches anything is a working safety net.
            return true;
    }
};

/**
 * The first authored line that applies, in authored order, or `undefined`.
 *
 * `undefined` means one of two things, and they are deliberately the same answer: the reading is
 * already complete and the player needs no nudge, or no authored line matches this state. Validation
 * requires a floor, so the second case cannot arise for shipped content — but a caller must still
 * handle it rather than assume a line exists, which is precisely what `resolveAdvanceRefusal`'s
 * `colleagueAnswers` argument is for.
 *
 * Authored order is the escalation order: put the artifact-specific lines first and the floor last.
 */
export const selectReadingGateHint = (
    definition: CaseDefinition,
    inspectedSourceIds: readonly string[]
): ReadingGateHintProjection | undefined => {
    const readiness = evaluateContextReadiness(definition, inspectedSourceIds);
    if (readiness.status === 'ready') return undefined;
    const hint = definition.readingGateHints.find(({ predicate }) => applies(predicate, readiness.missingArtifactIds));
    return hint ? freezeProjection(hint) : undefined;
};
