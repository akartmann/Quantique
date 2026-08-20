import type { CaseDefinition } from '../cases/CaseDefinition';
import type { RunRecord } from '../evidence/RunRecord';
import { configurationKey } from '../evidence/significantMeasures';
import { resolveExperimentModel } from '../apparatus/experimentModels';

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
    /**
     * The runs the player has pinned as conclusion support, for predicates that must judge a claim on
     * *that* evidence rather than on everything in the notebook.
     *
     * Every other support predicate reads {@link AuthoritativeEvidence.runs} — every run ever recorded —
     * which is right for "did you ever vary this?" and wrong for "was this held?". The prototype's
     * bounded-null claim reads "Held at a steady bath temperature", and the case's own `resetPath`
     * instructs the player to move the bath and come back, so an all-runs reading of "held" is
     * unsatisfiable for anyone who follows the case's teaching (code review 2026-08-19).
     *
     * Optional, and predicates that need it **fail closed** when it is absent: a claim whose defence
     * depends on which runs were pinned cannot be defended by a caller that never said. Fail-open here
     * would be the silent degradation this project keeps finding.
     */
    selectedRunIds?: readonly string[];
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
    // run carries: it says which deterministic model produced this reading, for any case.
    //
    // **The version stamp alone is not enough (review 2026-08-19).** An earlier comment here claimed "a
    // hand-built fixture run — the thing this rule was written to keep out of a conclusion — still fails
    // it". It did not: the predicate this replaced was `!run.modelInputs`, so a run stamping the case's
    // own `modelVersion` while carrying no inputs and an arbitrary `result.value` was refused before and
    // passed after — one copied string away, and nothing recomputes such a run's result on either the
    // restore path or the reducer. So where the case's model *declares* persisted inputs, they are
    // required as well; where it declares none, the stamp is the whole of the provenance available and
    // is all that is asked. That keeps Young exactly as strict as it was before Story 3.2 without making
    // the rule unsatisfiable for a model that records nothing.
    //
    // Resolved *inside* the predicate, not above it: `definition.experiment` is only reached once a
    // selected run exists, which is the evaluation order this rule has always had and which fixtures
    // authoring no `experiment` at all depend on.
    if (evidence.comparisonNotes && selectedRuns.some((run) => {
        if (run.experimentModelVersion !== definition.experiment.modelVersion) return true;
        const caseModel = resolveExperimentModel(definition.experiment.modelId);
        return caseModel?.recordInputs !== undefined && !run.modelInputs;
    })) {
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
    // **What this requirement guards is the pre-choice draft, and that is its whole scope** (Story 4.3,
    // D2). Stated because Epic 4's criterion reads *"review requires an explicit limitation"*, and the
    // unqualified reading of that sentence is not a guarantee this line makes.
    //
    // Since Story 2.12 the only writer of `theory.limitation` is
    // `reduceTheoryConclusionProposalChosen`, which writes `proposal.limitation.en`, and
    // `CaseDefinitionSchema` requires every conclusion proposal to author one. So there are exactly two
    // states, and this asks `.trim()`, which distinguishes only the first:
    //
    // - **Before a proposal is chosen** the limitation is `''`, this fires, and the authored
    //   `consult-no-limitation` guidance answers it in fiction. Load-bearing, and proven reachable from a
    //   state a player can be in by `MorleyMillerFeedback.test.ts`.
    // - **After a proposal is chosen** the limitation is whatever the author wrote — and Morley–Miller's
    //   `conclude-ether-disproved` authors **"None offered."**, a non-empty string that satisfies a
    //   requirement meant to ask for a limitation. Young does the same thing twice ("None is offered: …").
    //
    // The second state is **not** this requirement's to answer, and the mechanism that does answer it is
    // the `peer-overreach` refusal in `peerReviewRules.ts`, which Story 4.3 made reachable on exactly
    // that proposal. Both are pinned to their own state, on shipped content, by
    // `MorleyMillerConclusion.test.ts`'s "the limitation requirement guards the draft it can guard".
    //
    // Teaching this predicate to read a declared absence was considered and declined: it would put a
    // second detection surface over persisted text, carrying the same recomputation constraint as the
    // phrase set (`validateCaseRecordForDefinition` re-runs this evaluator over a record's own draft), for
    // content whose author already marked it undefendable with `supportPredicate: never` and which the
    // rival lab already answers by name. Three refusals where two hold, bought with the expensive kind of
    // seam.
    //
    // And whichever way it is read, **it must never become a hard fail**: FR16 and NFR8 give a weak
    // conclusion revision feedback, never a lockout. `reduceDebriefComplete` deliberately does not inspect
    // the standing issues, and must keep not doing so.
    if (!draft.limitation.trim()) {
        requirements.push(missing('limitation', 'Describe at least one limitation or alternative explanation.'));
    }

    return Object.freeze({
        status: requirements.length === 0 ? 'ready' : 'incomplete',
        missing: Object.freeze(requirements)
    });
};
