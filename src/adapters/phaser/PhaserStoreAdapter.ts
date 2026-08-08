import type { AppStore } from '../../core/store/createStore';
import type { PrimaryControl } from '../../domain/cases/CaseDefinition';

/** Which proposal set a surface is choosing from. The two sets are looked up independently. */
export type ProposalKind = 'prediction' | 'conclusion';

/**
 * Every forward transition the adventure has, named after the move rather than after the action that
 * makes it (Story 2.7).
 *
 * The indirection earns its keep because **three of the six are not `case.phaseAdvance`**, and each
 * of the three fails differently if a surface guesses:
 *
 * - `synthesis → review` must dispatch `theory.reviewRequested`. `case.phaseAdvance` with
 *   `nextPhase: 'review'` would *succeed* — `advanceCasePhase` permits it and `reduceCasePhaseAdvance`
 *   has no gate for it — and silently bypass `evaluateConclusionReadiness`. It looks like it works.
 * - `review → debrief` must dispatch `case.debriefCompleted`. `reduceCasePhaseAdvance` refuses that
 *   pair outright (`debrief-completion-required`) as its very first check, so the uniform mapping
 *   makes the last transition permanently unreachable.
 * - the replay is `case.replayStarted`, which resets the investigation rather than moving a phase.
 *
 * A scene therefore names the *move* and never the action, and this module is the single place the
 * two are related. `tests/unit/PhaserStoreAdapter.test.ts` pins all three.
 */
export const ADVANCE_TRANSITION_IDS = [
    'context-to-prediction',
    'prediction-to-experiment',
    'experiment-to-synthesis',
    'synthesis-to-review',
    'review-to-debrief',
    'debrief-replay'
] as const;

export type AdvanceTransitionId = typeof ADVANCE_TRANSITION_IDS[number];

/** The only authored revisits that preserve the ongoing investigation. */
export const REVISIT_TRANSITION_IDS = [
    'experiment-to-prediction',
    'theory-board-to-experiment'
] as const;

export type RevisitTransitionId = typeof REVISIT_TRANSITION_IDS[number];

export type PhaserStoreAdapter = Readonly<{
    getState: AppStore['getState'];
    setControlValue: (controlId: PrimaryControl['id'], value: number) => ReturnType<AppStore['dispatch']>;
    chooseProposal: (kind: ProposalKind, proposalId: string) => ReturnType<AppStore['dispatch']>;
    /** Putting the chosen conclusion in front of the rival lab. The adapter stamps the submission time. */
    submitConclusion: () => ReturnType<AppStore['dispatch']>;
    /** Answering a standing rival-lab challenge. Clears the challenge; keeps the choice and the draft. */
    requestRivalLabRevision: () => ReturnType<AppStore['dispatch']>;
    /**
     * Recording that a contextual artifact has been read (Story 2.8).
     *
     * Until this existed the only dispatcher of `source.inspected` was the retired `CuratedRecord` DOM
     * panel — one of the nine intents the 2026-08-06 correction found unreachable from the canvas
     * (ADR-011).
     *
     * The caller is expected to have checked `selectIsSourceInspected` first: re-reading is a
     * legitimate, common act and the reducer answers a second inspection with
     * `duplicate-inspected-source`, which is a refusal the reading room would then have to explain
     * away for something the player did nothing wrong to reach. The refusal stays — it is the correct
     * answer to a genuinely duplicated dispatch — but the surface must not provoke it.
     */
    inspectSource: (sourceId: string) => ReturnType<AppStore['dispatch']>;
    /**
     * Taking one named forward transition (Story 2.7). It generalizes Story 2.6's `advanceToSynthesis`,
     * which was the only one of the six that had a canvas dispatcher at all.
     *
     * It decides nothing: the caller names the move that its phase authorizes, and every gate stays in
     * the reducer where it is answerable. The refusal comes back as the `Result` it was, because the
     * two registers a surface answers with — the authored colleague hint and the localized error —
     * are told apart by the error's `code`.
     */
    advanceCase: (transition: AdvanceTransitionId) => ReturnType<AppStore['dispatch']>;
    /** Revisit an earlier authored workspace without resetting the investigation. */
    revisitCase: (transition: RevisitTransitionId) => ReturnType<AppStore['dispatch']>;
    /**
     * Starting the light — the whole activity of the `experiment` phase (Story 2.10, AC5).
     *
     * **It dispatches `experiment.run` and nothing else.** `reduceExperimentRun` builds the
     * `RunRecord` from `calculateYoungFringeSpacing` and hands it to `reduceRecordRun` itself, so that
     * dispatch *is* "recorded through `run.record`". A caller that also dispatched `run.record`
     * alongside it would get `duplicate-run-id` on the second — or, with a fresh id, two runs for one
     * press.
     *
     * The id and the timestamp are stamped **here**, never in the reducer: a reducer that read the
     * clock or a random source would not be a pure function of its arguments, and `submitConclusion`
     * set that precedent.
     *
     * Dispatch happens on the press and the animation is its consequence, never its source (D2). The
     * record is then a pure function of the state the player pressed against, and a refusal
     * (`experiment-phase-required`, `advanced-wavelength-locked`) arrives immediately rather than
     * after three seconds of spectacle that implied success.
     */
    runExperiment: () => ReturnType<AppStore['dispatch']>;
    /**
     * Choosing the authored wavelength to work at (Story 2.10, AC7).
     *
     * 550 nm is always permitted and resets to the minimum path. An advanced choice is refused with
     * `advanced-wavelength-locked` until `minimumRuns` fixed-550 nm observations exist, and with
     * `unavailable-wavelength` if the case does not author it — so the caller reads the choices out of
     * `experiment.wavelengthComparison` rather than writing 450 / 650 down.
     */
    setWavelength: (wavelengthNm: 450 | 550 | 650) => ReturnType<AppStore['dispatch']>;
    /**
     * Putting the apparatus back to its authored setup (Story 2.12, D3).
     *
     * Until this existed the only dispatcher of `apparatus.reset` was the retired
     * `src/ui/apparatus/ApparatusControls.ts` — the last of the intents the 2026-08-06 correction found
     * unreachable from the canvas (ADR-011), and the one Story 2.2 shipped an acceptance criterion for
     * ("reset is immediate and does not erase saved observations").
     *
     * `reduceApparatusReset` sets every primary control to its `defaultValue` and the wavelength to
     * 550 nm / minimum. It clears **no** recorded observation and no colleague state, which is what makes
     * that criterion true. The caller is expected to have compared the live values first: the reducer has
     * no "nothing to do" branch and mints a new frozen state either way, which would expire every
     * transient message slot anchored on state identity — the same rule {@link setWavelength}'s own call
     * site learned in 2.10.
     */
    resetApparatus: () => ReturnType<AppStore['dispatch']>;
    /**
     * Putting a saved observation into the comparison, and taking it out again (Story 2.10, AC8).
     *
     * The caller is expected to have read `state.comparison.selectedRunIds` first, the same rule
     * {@link inspectSource} states: the reducer answers a third selection with
     * `too-many-comparison-runs` and a repeat with `duplicate-comparison-run`, and both are correct
     * answers to a genuinely duplicated dispatch — but a surface must not provoke a refusal the player
     * did nothing to earn.
     */
    selectComparisonRun: (runId: string) => ReturnType<AppStore['dispatch']>;
    unselectComparisonRun: (runId: string) => ReturnType<AppStore['dispatch']>;
    /**
     * Saving what the player made of the pair.
     *
     * Refused with `comparison-pair-required` unless exactly two are selected and with
     * `invalid-comparison-note` on a blank one; the surface answers both with the existing localized
     * errors rather than swallowing them. A note replaces the existing note for the same pair.
     */
    saveComparisonNote: (note: string) => ReturnType<AppStore['dispatch']>;
    /**
     * Pinning a recorded observation to the conclusion as support, and taking it off again
     * (Story 2.11, AC5).
     *
     * Until this existed the only dispatcher of `theory.supportRunSelected` /
     * `theory.supportRunUnselected` was the retired `src/ui/theory/TheoryBoard.ts` — two of the four
     * gating intents the 2.8 review assigned to this story (ADR-011).
     *
     * The caller is expected to have read `state.theory.selectedRunIds` first, the same rule
     * {@link inspectSource} and {@link selectComparisonRun} state: the reducer answers a repeat with
     * `duplicate-theory-run` and an absent one with `theory-run-not-selected`, and both are correct
     * answers to a genuinely duplicated dispatch — but a surface must not provoke a refusal the player
     * did nothing to earn.
     */
    selectSupportRun: (runId: string) => ReturnType<AppStore['dispatch']>;
    unselectSupportRun: (runId: string) => ReturnType<AppStore['dispatch']>;
    /**
     * The same, for an inspected reference. Only artifacts already in `state.inspectedSourceIds` may be
     * offered: the reducer's `uninspected-theory-source` must be unreachable from the surface.
     */
    selectSupportSource: (sourceId: string) => ReturnType<AppStore['dispatch']>;
    unselectSupportSource: (sourceId: string) => ReturnType<AppStore['dispatch']>;
    /**
     * Asking the reviewers what they make of the draft (Story 2.11, AC5).
     *
     * Refused outside the `review` phase with `peer-review-unavailable`, which the surface localizes
     * rather than swallows. Note that `reduceRevisionSave` **clears** `peerReview` on success, so
     * asking again after a save is a fresh request rather than a no-op.
     */
    requestPeerReview: () => ReturnType<AppStore['dispatch']>;
    /**
     * Asking a colleague what the draft is still missing (Story 2.12, D4).
     *
     * Until this existed the only dispatcher of `consultation.requested` was the retired
     * `src/ui/review/ConsultationPanel.ts` (ADR-011).
     *
     * Unlike {@link requestPeerReview} it has **no phase gate** — `reduceConsultationRequest` refuses
     * only with `consultation-unavailable`, when no authored rule applies to the evidence on hand. That
     * is a real answer rather than a refusal a surface should have prevented, so the control stays armed
     * and the caller surfaces it localized. Note that a great many reducers clear `consultation`
     * afterwards — recording a run, inspecting a source, changing the draft — so asking again after any
     * of them is a fresh question, not a repeat.
     */
    requestConsultation: () => ReturnType<AppStore['dispatch']>;
    /**
     * Saving the reviewed revision. Refused without reviewed feedback with `revision-review-required`.
     *
     * The timestamp is stamped **here**, never in the reducer: a reducer that read the clock would not
     * be a pure function of its arguments, and every other timestamped action follows the same rule.
     */
    saveRevision: () => ReturnType<AppStore['dispatch']>;
    subscribe: AppStore['subscribe'];
}>;

/**
 * The exact action behind each move.
 *
 * Timestamps are stamped **here** and never in a reducer: a reducer that read the clock would not be
 * a pure function of its arguments, and `submitConclusion` already set that precedent.
 */
const ADVANCE_DISPATCHERS: Readonly<Record<AdvanceTransitionId, (store: AppStore) => ReturnType<AppStore['dispatch']>>> = {
    'context-to-prediction': (store) => store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' }),
    'prediction-to-experiment': (store) => store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' }),
    'experiment-to-synthesis': (store) => store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' }),
    'synthesis-to-review': (store) => store.dispatch({ type: 'theory.reviewRequested' }),
    'review-to-debrief': (store) => store.dispatch({ type: 'case.debriefCompleted', timestamp: new Date().toISOString() }),
    'debrief-replay': (store) => store.dispatch({ type: 'case.replayStarted' })
};

const REVISIT_DISPATCHERS: Readonly<Record<RevisitTransitionId, (store: AppStore) => ReturnType<AppStore['dispatch']>>> = {
    'experiment-to-prediction': (store) => store.dispatch({ type: 'case.phaseRetreat', previousPhase: 'prediction' }),
    'theory-board-to-experiment': (store) => store.dispatch({ type: 'case.phaseRetreat', previousPhase: 'experiment' })
};

export const createPhaserStoreAdapter = (store: AppStore): PhaserStoreAdapter => ({
    getState: store.getState,
    setControlValue: (controlId, value) => store.dispatch({
        type: 'apparatus.controlSet',
        controlId,
        value,
        origin: 'phaser'
    }),
    chooseProposal: (kind, proposalId) => store.dispatch(kind === 'prediction'
        ? { type: 'prediction.proposalChosen', proposalId }
        : { type: 'theory.conclusionProposalChosen', proposalId }),
    // Stamped here rather than in the reducer: a reducer that read the clock would not be a pure
    // function of its arguments, and every other timestamped action follows the same rule.
    submitConclusion: () => store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: new Date().toISOString() }),
    requestRivalLabRevision: () => store.dispatch({ type: 'rivalLab.revisionRequested' }),
    inspectSource: (sourceId) => store.dispatch({ type: 'source.inspected', sourceId }),
    advanceCase: (transition) => ADVANCE_DISPATCHERS[transition](store),
    revisitCase: (transition) => REVISIT_DISPATCHERS[transition](store),
    // Both stamped here for the reason above: `reduceExperimentRun` is a pure function of the state
    // and the action, and it stays one. Nothing else is dispatched — the reducer records the run.
    runExperiment: () => store.dispatch({
        type: 'experiment.run',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
    }),
    setWavelength: (wavelengthNm) => store.dispatch({ type: 'apparatus.wavelengthSet', wavelengthNm }),
    resetApparatus: () => store.dispatch({ type: 'apparatus.reset' }),
    selectComparisonRun: (runId) => store.dispatch({ type: 'comparison.runSelected', runId }),
    unselectComparisonRun: (runId) => store.dispatch({ type: 'comparison.runUnselected', runId }),
    saveComparisonNote: (note) => store.dispatch({ type: 'comparison.noteSaved', note }),
    selectSupportRun: (runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }),
    unselectSupportRun: (runId) => store.dispatch({ type: 'theory.supportRunUnselected', runId }),
    selectSupportSource: (sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }),
    unselectSupportSource: (sourceId) => store.dispatch({ type: 'theory.supportSourceUnselected', sourceId }),
    requestPeerReview: () => store.dispatch({ type: 'peerReview.requested' }),
    requestConsultation: () => store.dispatch({ type: 'consultation.requested' }),
    // Stamped here for the reason above: `reduceRevisionSave` is a pure function of the state and the
    // action, and it stays one.
    saveRevision: () => store.dispatch({ type: 'revision.saved', timestamp: new Date().toISOString() }),
    subscribe: store.subscribe
});
