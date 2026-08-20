import type { CaseDefinition, ConsultationRule, LocalizedText, ProgressiveHelpLayers } from '../cases/CaseDefinition';
import type { RunRecord } from '../evidence/RunRecord';
import { configurationKey } from '../evidence/significantMeasures';
import type { TheoryBoardDraft } from '../theory/conclusionReadiness';

/**
 * Carries the authored text in every locale rather than a resolved string: the domain selects *which*
 * consultation applies, and the presentation resolves the active language. This projection is
 * transient — it is never written into the portable record.
 */
export type ConsultationProjection = Readonly<{
    ruleId: string;
    layers: ProgressiveHelpLayers;
    nextStep: LocalizedText;
}>;

export type ConsultationEvidence = Readonly<{
    runs: readonly RunRecord[];
    inspectedSourceIds: readonly string[];
    theory: TheoryBoardDraft;
    /**
     * The case's own significance rule, for the predicates that ask *"is this the same setup?"*.
     *
     * Threaded in rather than re-derived, because `configurationKey` is the one answer to that question and
     * two answers drift apart — the rule `conclusionReadiness` was rewritten to follow in Story 3.2, when
     * `distinct-run-configurations` had its own copy and compared three model-input names that were all
     * `undefined`.
     */
    significanceRule: CaseDefinition['significanceRule'];
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
        case 'missing-replication': {
            // Nothing has been repeated: every recorded observation is at its own configuration. Asked of
            // `configurationKey` and not of a control-by-control comparison, so "the same setup" means here
            // exactly what it means to the significance rule, the colleague hints and the readiness check.
            //
            // `runs.length >= 2` on purpose, for the reason `unvaried-control` carries the same guard:
            // with fewer than two observations nothing *could* have been repeated, and "you have not
            // confirmed anything" is the wrong thing to say to somebody who has not measured twice yet.
            if (evidence.runs.length < 2) return false;
            const keys = evidence.runs.map((run) => configurationKey(evidence.significanceRule, run));
            return new Set(keys).size === keys.length;
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
