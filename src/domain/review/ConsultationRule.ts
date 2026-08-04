import type { ConsultationRule } from '../cases/CaseDefinition';
import type { RunRecord } from '../evidence/RunRecord';
import type { TheoryBoardDraft } from '../theory/conclusionReadiness';

export type ConsultationProjection = Readonly<{
    ruleId: string;
    layers: Readonly<{ observation: string; plainLanguage: string; technicalDetail: string }>;
    nextStep: string;
}>;

export type ConsultationEvidence = Readonly<{
    runs: readonly RunRecord[];
    inspectedSourceIds: readonly string[];
    theory: TheoryBoardDraft;
}>;

const freezeProjection = (rule: ConsultationRule): ConsultationProjection => Object.freeze({
    ruleId: rule.id,
    layers: Object.freeze({ ...rule.layers }),
    nextStep: rule.nextStep
});

const applies = (rule: ConsultationRule, evidence: ConsultationEvidence): boolean => {
    switch (rule.predicate.kind) {
        case 'missing-run':
            return evidence.runs.length < 2;
        case 'missing-source':
            return !evidence.inspectedSourceIds.includes(rule.predicate.sourceId);
        case 'alternative-test': {
            const controlId = rule.predicate.controlId;
            return evidence.runs.length >= 2
                && new Set(evidence.runs.map((run) => run.controls[controlId])).size < 2;
        }
        case 'missing-limitation':
            return !evidence.theory.limitation.trim();
    }
};

/** Chooses authored guidance only; it does not alter case evidence or phase. */
export const selectConsultation = (
    rules: readonly ConsultationRule[],
    evidence: ConsultationEvidence
): ConsultationProjection | undefined => {
    const rule = rules.find((candidate) => applies(candidate, evidence));
    return rule ? freezeProjection(rule) : undefined;
};
