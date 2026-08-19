import type { CaseDefinition } from '../cases/CaseDefinition';
import type { RunRecord } from '../evidence/RunRecord';
import { configurationKey } from '../evidence/significantMeasures';

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
    | 'foreign-model-run'
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
    // **"Produced by this case's own model", not "carries Young's optical inputs" (Story 3.2).**
    //
    // This asked `!run.modelInputs`, and `modelInputs` is `YoungModelInputs` — the Young optical model's
    // own persisted shape. A case whose apparatus has no wavelength records none (D4), so *every*
    // selected run failed this and the theory board could never unlock for a second case: the player
    // reached synthesis, pinned two runs, saved a comparison, and read an English sentence about Young.
    // The evaluator is the sole completion authority (ADR-006), so this was the deepest of the three
    // walls, and the only one not already in the backlog.
    //
    // `experimentModelVersion` is the right question because it is exactly the provenance stamp every
    // run carries: it says which deterministic model produced this reading, for any case. A hand-built
    // fixture run — the thing this rule was written to keep out of a conclusion — still fails it.
    if (evidence.comparisonNotes && selectedRuns.some((run) => run.experimentModelVersion !== definition.experiment.modelVersion)) {
        requirements.push(missing('foreign-model-run', 'Use observations recorded on this investigation’s own apparatus as conclusion support.'));
    }
    if (evidence.comparisonNotes && selectedRuns.length >= definition.requirements.minimumRuns) {
        const [first, ...rest] = selectedRuns;
        // Decided by the case's own `significanceRule`, through the same `configurationKey` that
        // `countSignificantMeasures` and the `repeated-configuration` hint already use. It used to
        // compare Young's three `modelInputs` names, so for a case recording none the `.some(...)` was
        // false whatever the player did and the requirement was pushed unconditionally.
        //
        // Reused rather than re-derived on purpose: "are these two runs the same configuration?" is one
        // question, and two answers to it would drift — the gate would count two configurations while
        // the board refused them as one.
        if (first && !rest.some((run) => configurationKey(definition.significanceRule, run) !== configurationKey(definition.significanceRule, first))) {
            requirements.push(missing('distinct-run-configurations', 'Select observations recorded at two different apparatus configurations.'));
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
