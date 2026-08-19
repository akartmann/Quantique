import type { CaseDefinition } from '../cases/CaseDefinition';
import type { ConclusionSupportPredicate } from '../cases/ColleagueCast';
import type { AuthoritativeEvidence } from './conclusionReadiness';

/**
 * Interprets the authored `supportPredicate` trees against the authoritative evidence record.
 *
 * Pure and dependency-free by design: no Phaser, no store, no `AppState`, no locale. The evaluator
 * is the sole authority on which conclusions the evidence defends (ADR-006) — a scene must never
 * decide, display, or imply it, which is why nothing here is shaped for presentation.
 *
 * The set this produces is for the evaluator and the later rival-lab critique (Story 2.5). It is
 * deliberately *not* an up-front "correct answer" marker.
 */

/**
 * An empty `all-of` is vacuously true, as `Array.prototype.every` says. That is not an oversight:
 * `CaseDefinitionSchema` rejects an empty `all-of` at the content boundary precisely because it
 * would be, so by the time a predicate reaches this function it has already been ruled out. Keeping
 * the operator honest here means the evaluator has one job — interpretation — and validation has
 * the other.
 */
export const evaluateSupportPredicate = (
    predicate: ConclusionSupportPredicate,
    evidence: AuthoritativeEvidence
): boolean => {
    switch (predicate.kind) {
        case 'never':
            return false;
        case 'minimum-runs':
            return evidence.runs.length >= predicate.count;
        case 'varied-control':
            // Distinct *recorded* values, so two runs at the same setting read as a replication
            // rather than a variation — which is the distinction the claim depends on.
            return new Set(evidence.runs.map((run) => run.controls[predicate.controlId])).size >= 2;
        case 'unvaried-control-pinned': {
            // **Fails closed on an absent pinned set.** A caller that did not say which runs were pinned
            // cannot have this claim defended for it; passing would be a silent degradation.
            const selected = evidence.selectedRunIds;
            if (!selected) return false;
            const pinned = evidence.runs.filter((run) => selected.includes(run.id));
            // `pinned.length > 0` for the same reason the colleague hint checks it: with nothing pinned
            // every control is trivially unvaried, and a claim must not be defensible on no evidence.
            return pinned.length > 0
                && new Set(pinned.map((run) => run.controls[predicate.controlId])).size === 1;
        }
        case 'inspected-source':
            return evidence.inspectedSourceIds.includes(predicate.sourceId);
        case 'all-of':
            return predicate.predicates.every((child) => evaluateSupportPredicate(child, evidence));
    }
};

/** The authored conclusion proposals the current evidence defends, in authored order. */
export const selectDefensibleConclusionIds = (
    definition: CaseDefinition,
    evidence: AuthoritativeEvidence
): readonly string[] => Object.freeze(
    definition.conclusionProposals
        .filter(({ supportPredicate }) => evaluateSupportPredicate(supportPredicate, evidence))
        .map(({ id }) => id)
);
