import type { CaseDefinition } from '../cases/CaseDefinition';
import type { RunRecord } from '../evidence/RunRecord';

export type TheoryBoardDraft = Readonly<{
    selectedRunIds: readonly string[];
    selectedSourceIds: readonly string[];
    conclusion: string;
    limitation: string;
}>;

export type AuthoritativeEvidence = Readonly<{
    runs: readonly RunRecord[];
    inspectedSourceIds: readonly string[];
}>;

export type MissingConclusionRequirementCode =
    | 'duplicate-run-selection'
    | 'unknown-run-selection'
    | 'minimum-runs'
    | 'duplicate-source-selection'
    | 'unknown-source-selection'
    | 'minimum-sources'
    | 'conclusion'
    | 'limitation';

export type MissingConclusionRequirement = Readonly<{
    code: MissingConclusionRequirementCode;
    message: string;
}>;

export type ConclusionReadiness = Readonly<{
    status: 'ready' | 'incomplete';
    missing: readonly MissingConclusionRequirement[];
}>;

const freezeDraft = (draft: TheoryBoardDraft): TheoryBoardDraft => Object.freeze({
    selectedRunIds: Object.freeze([...draft.selectedRunIds]),
    selectedSourceIds: Object.freeze([...draft.selectedSourceIds]),
    conclusion: draft.conclusion,
    limitation: draft.limitation
});

const missing = (code: MissingConclusionRequirementCode, message: string): MissingConclusionRequirement => Object.freeze({ code, message });

const hasDuplicates = (ids: readonly string[]): boolean => new Set(ids).size !== ids.length;

export const createTheoryBoardDraft = (): TheoryBoardDraft => freezeDraft({
    selectedRunIds: [],
    selectedSourceIds: [],
    conclusion: '',
    limitation: ''
});

/**
 * Purely evaluates the current evidence record and theory draft. It deliberately
 * has no knowledge of UI, Phaser, timestamps, or historical run calculation.
 */
export const evaluateConclusionReadiness = (
    definition: CaseDefinition,
    evidence: AuthoritativeEvidence,
    draft: TheoryBoardDraft
): ConclusionReadiness => {
    const requirements: MissingConclusionRequirement[] = [];
    const runIds = new Set(evidence.runs.filter((run) => run.modelInputs !== undefined).map(({ id }) => id));
    const inspectedSourceIds = new Set(evidence.inspectedSourceIds);
    const selectedKnownRunIds = draft.selectedRunIds.filter((id) => runIds.has(id));
    const selectedKnownSourceIds = draft.selectedSourceIds.filter((id) => inspectedSourceIds.has(id));

    if (hasDuplicates(draft.selectedRunIds)) {
        requirements.push(missing('duplicate-run-selection', 'Choose each supporting observation only once.'));
    }
    if (draft.selectedRunIds.some((id) => !runIds.has(id))) {
        requirements.push(missing('unknown-run-selection', 'Remove an unavailable supporting observation.'));
    }
    if (new Set(selectedKnownRunIds).size < definition.requirements.minimumRuns) {
        requirements.push(missing('minimum-runs', `Select at least ${definition.requirements.minimumRuns} recorded observations.`));
    }
    if (hasDuplicates(draft.selectedSourceIds)) {
        requirements.push(missing('duplicate-source-selection', 'Choose each supporting source only once.'));
    }
    if (draft.selectedSourceIds.some((id) => !inspectedSourceIds.has(id))) {
        requirements.push(missing('unknown-source-selection', 'Remove a source that is not currently inspected evidence.'));
    }
    if (new Set(selectedKnownSourceIds).size < definition.requirements.minimumSources) {
        requirements.push(missing('minimum-sources', `Inspect and select at least ${definition.requirements.minimumSources} sources.`));
    }
    if (!draft.conclusion.trim()) {
        requirements.push(missing('conclusion', 'Write a bounded conclusion before requesting review.'));
    }
    if (!draft.limitation.trim()) {
        requirements.push(missing('limitation', 'Describe at least one limitation or alternative explanation.'));
    }

    return Object.freeze({
        status: requirements.length === 0 ? 'ready' : 'incomplete',
        missing: Object.freeze(requirements)
    });
};
