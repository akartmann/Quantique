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
}>;

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
            return readiness.missing.some(({ code }) => code === 'minimum-runs' || code === 'minimum-sources' || code === 'limitation');
        case 'unsupported-support':
            return readiness.missing.some(({ code }) => code === 'unknown-run-selection' || code === 'unknown-source-selection' || code === 'duplicate-run-selection' || code === 'duplicate-source-selection');
        case 'overreach':
            return (rule.predicate.overreachPhrases ?? []).some((phrase) => draft.conclusion.toLocaleLowerCase().includes(phrase.toLocaleLowerCase()));
    }
};

/** Evaluates only authored predicates and returns no learner-entered text. */
export const evaluatePeerReview = (
    definition: CaseDefinition,
    evidence: AuthoritativeEvidence,
    draft: TheoryBoardDraft
): PeerReviewProjection => Object.freeze({
    status: 'reviewed',
    issues: Object.freeze(definition.peerReviewRules
        .filter((rule) => isApplicable(rule, definition, evidence, draft))
        .map(freezeIssue))
});
