import type { PeerReviewRule } from '../cases/CaseDefinition';
import type { TheoryBoardDraft } from '../theory/conclusionReadiness';
import { evaluateConclusionReadiness, type AuthoritativeEvidence } from '../theory/conclusionReadiness';
import type { CaseDefinition } from '../cases/CaseDefinition';

export type PeerReviewIssue = Readonly<{
    code: PeerReviewRule['predicate']['kind'];
    ruleId: string;
    feedback: string;
    revisionPath: string;
}>;

export type PeerReviewProjection = Readonly<{
    status: 'reviewed';
    issues: readonly PeerReviewIssue[];
}> | Readonly<{
    status: 'unavailable';
    message: string;
}>;

/**
 * Canonical English, the same contract as `Result.error.message`: the domain owns the dev-facing
 * default and the presentation localizes it. `message` is persisted inside `DecisionHistoryEntry`,
 * so it must not vary with the active language.
 *
 * **Keep in sync with the `review.unavailable` key** in `src/core/i18n/locales/{en,fr}.ts` — the
 * surfaces resolve that key, and this string is what they fall back to. The status is not code-
 * bearing (`PeerReviewProjection`'s shape is persisted and cannot gain a `code` field without a
 * `schemaVersion` bump), so the link is by convention rather than by type.
 */
export const CANONICAL_UNAVAILABLE_MESSAGE = 'Peer feedback is temporarily unavailable. Your evidence and draft have been kept unchanged.';

const unavailable = (): PeerReviewProjection => Object.freeze({
    status: 'unavailable',
    message: CANONICAL_UNAVAILABLE_MESSAGE
});

/**
 * `.en` on purpose. These issues are written into `DecisionHistoryEntry.feedback`, persisted, and then
 * recomputed and string-compared on load (`validateCaseRecordForDefinition`). Emitting the active
 * locale would reject every record saved in the other language. The review surface localizes by
 * `ruleId` against the case definition.
 */
const freezeIssue = (rule: PeerReviewRule): PeerReviewIssue => Object.freeze({
    code: rule.predicate.kind,
    ruleId: rule.id,
    feedback: rule.feedback.en,
    revisionPath: rule.revisionPath.en
});

/** Every authored detection phrase, in every locale, as one flat list. */
const overreachPhrases = (rule: PeerReviewRule): readonly string[] => {
    const authored = rule.predicate.overreachPhrases;
    return authored ? [...authored.en, ...authored.fr] : [];
};

const isApplicable = (
    rule: PeerReviewRule,
    definition: CaseDefinition,
    evidence: AuthoritativeEvidence,
    draft: TheoryBoardDraft
): boolean => {
    const readiness = evaluateConclusionReadiness(definition, evidence, draft);
    switch (rule.predicate.kind) {
        case 'missing-evidence':
            return readiness.missing.some(({ code }) => ['minimum-runs', 'foreign-model-run', 'distinct-run-configurations', 'saved-comparison', 'minimum-sources', 'limitation'].includes(code));
        case 'unsupported-support':
            return readiness.missing.some(({ code }) => code === 'unknown-run-selection' || code === 'unknown-source-selection' || code === 'duplicate-run-selection' || code === 'duplicate-source-selection');
        case 'overreach':
            // The union of both locales' phrases, never the active one: detection must stay
            // deterministic so the recomputation on record load matches what was persisted.
            //
            // Widening the union is therefore not a free change — `validateCaseRecordForDefinition`
            // re-runs this evaluator and rejects a record whose recomputed issues differ from the
            // stored ones. Adding the French list in 1.6.0 is safe only because every build that
            // could have saved a record was English-only with English authored proposals, so no
            // persisted conclusion can contain these words. Any future addition needs the same
            // argument, or a version-gated detection set.
            return overreachPhrases(rule).some((phrase) => {
                const escaped = phrase.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
                return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'u').test(draft.conclusion.toLowerCase());
            });
    }
};

const hasEvaluableRules = (definition: CaseDefinition): boolean => definition.peerReviewRules.length > 0
    && definition.peerReviewRules.every((rule) => {
        // `.en` again: the canonical locale is what this evaluator emits and persists.
        if (!rule.id.trim() || !rule.feedback.en.trim() || !rule.revisionPath.en.trim()) return false;
        return rule.predicate.kind !== 'overreach' || overreachPhrases(rule).length > 0;
    });

/** Evaluates only authored predicates and returns no learner-entered text. */
export const evaluatePeerReview = (
    definition: CaseDefinition,
    evidence: AuthoritativeEvidence,
    draft: TheoryBoardDraft
): PeerReviewProjection => {
    if (!hasEvaluableRules(definition)) return unavailable();
    return Object.freeze({
        status: 'reviewed',
        issues: Object.freeze(definition.peerReviewRules
            .filter((rule) => isApplicable(rule, definition, evidence, draft))
            .map(freezeIssue))
    });
};
