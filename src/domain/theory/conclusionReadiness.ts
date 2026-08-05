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
    comparisonNotes?: readonly Readonly<{ runIds: readonly [string, string] }> [];
}>;

export type MissingConclusionRequirementCode =
    | 'duplicate-run-selection'
    | 'unknown-run-selection'
    | 'minimum-runs'
    | 'non-physical-young-run'
    | 'distinct-run-configurations'
    | 'saved-comparison'
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
    const runIds = new Set(evidence.runs.map(({ id }) => id));
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
    const selectedRuns = evidence.runs.filter((run) => selectedKnownRunIds.includes(run.id));
    if (evidence.comparisonNotes && selectedRuns.some((run) => !run.modelInputs)) {
        requirements.push(missing('non-physical-young-run', 'Use recorded physical Young observations as conclusion support.'));
    }
    if (evidence.comparisonNotes && selectedRuns.length >= definition.requirements.minimumRuns) {
        const [first, ...rest] = selectedRuns;
        if (first && !rest.some((run) => run.modelInputs && first.modelInputs && (
            run.modelInputs.slitSpacingMm !== first.modelInputs.slitSpacingMm
            || run.modelInputs.screenDistanceM !== first.modelInputs.screenDistanceM
            || run.modelInputs.wavelengthNm !== first.modelInputs.wavelengthNm
        ))) {
            requirements.push(missing('distinct-run-configurations', 'Select observations from two different recorded Young configurations.'));
        }
        const hasComparison = evidence.comparisonNotes.some((note) =>
            note.runIds.includes(selectedKnownRunIds[0]!) && note.runIds.includes(selectedKnownRunIds[1]!));
        if (!hasComparison) requirements.push(missing('saved-comparison', 'Save an intentional comparison of the two selected observations.'));
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
