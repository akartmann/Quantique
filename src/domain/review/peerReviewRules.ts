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

const unavailable = (): PeerReviewProjection => Object.freeze({
    status: 'unavailable',
    message: 'Peer feedback is temporarily unavailable. Your evidence and draft have been kept unchanged.'
});

const freezeIssue = (rule: PeerReviewRule): PeerReviewIssue => Object.freeze({
    code: rule.predicate.kind,
    ruleId: rule.id,
    feedback: rule.feedback,
    revisionPath: rule.revisionPath
});

const isApplicable = (
    rule: PeerReviewRule,
    definition: CaseDefinition,
    evidence: AuthoritativeEvidence,
    draft: TheoryBoardDraft
): boolean => {
    const readiness = evaluateConclusionReadiness(definition, evidence, draft);
    switch (rule.predicate.kind) {
        case 'missing-evidence':
            return readiness.missing.some(({ code }) => ['minimum-runs', 'non-physical-young-run', 'distinct-run-configurations', 'saved-comparison', 'minimum-sources', 'limitation'].includes(code));
        case 'unsupported-support':
            return readiness.missing.some(({ code }) => code === 'unknown-run-selection' || code === 'unknown-source-selection' || code === 'duplicate-run-selection' || code === 'duplicate-source-selection');
        case 'overreach':
            return (rule.predicate.overreachPhrases ?? []).some((phrase) => {
                const escaped = phrase.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
                return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'u').test(draft.conclusion.toLowerCase());
            });
    }
};

const hasEvaluableRules = (definition: CaseDefinition): boolean => definition.peerReviewRules.length > 0
    && definition.peerReviewRules.every((rule) => {
        if (!rule.id.trim() || !rule.feedback.trim() || !rule.revisionPath.trim()) return false;
        return rule.predicate.kind !== 'overreach' || Boolean(rule.predicate.overreachPhrases?.length);
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
