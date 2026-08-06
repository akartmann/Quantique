import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { ADVANCE_TRANSITION_IDS, createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { advanceTransitionForPhase } from '../../src/adapters/phaser/renderers/advanceView';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { selectCasePhase, selectCompletionSnapshot, selectLocalizedError } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CASE_PHASES } from '../../src/domain/cases/CaseProgress';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * Every forward transition, driven end to end through **public store actions and selectors only**
 * (Story 2.7, AC2/AC6) — no Phaser, no renderer, no internal store shape.
 *
 * This walk *can* be complete today, which is the point of writing it here rather than only in the
 * browser: the store already has every action, and what Story 2.7 adds is the canvas dispatcher for
 * each. Five of the intents that *gate* these transitions are still DOM-only until Stories 2.8 and
 * 2.10, so the pure-canvas walk cannot finish yet — but the phase machine can, and this is the test
 * that says which half is which.
 *
 * The adapter is exercised rather than bypassed, so the six moves under test are the same six the
 * canvas takes. Driven against the authored Young case rather than a fixture, so the requirement
 * counts, the significance rule, and the scenario script all have to agree in the content that ships.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** The move that leaves the phase the store is standing in, taken exactly as a scene would take it. */
const advance = (store: AppStore) => createPhaserStoreAdapter(store)
    .advanceCase(advanceTransitionForPhase(selectCasePhase(store.getState())).transition);

const sourceIds = (): readonly string[] => definition.contextualArtifacts.map(({ id }) => id);

/** Two observations at different screen distances: two significant measures, and two distinct configs. */
const recordTwoDistinctRuns = (store: AppStore): void => {
    store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
    store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'phaser' });
    store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' });
};

/** Everything `evaluateConclusionReadiness` asks for, so `synthesis → review` is not refused. */
const buildDefensibleDraft = (store: AppStore): void => {
    store.dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
    store.dispatch({ type: 'comparison.runSelected', runId: 'run-2' });
    store.dispatch({ type: 'comparison.noteSaved', note: 'The recorded spacing differs across these two throws.' });
    ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
    sourceIds().forEach((sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }));
    store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0]!.id });
};

/** A reviewed revision, which `case.debriefCompleted` requires and refuses to proceed without. */
const saveReviewedRevision = (store: AppStore): void => {
    store.dispatch({ type: 'peerReview.requested' });
    store.dispatch({ type: 'revision.saved', timestamp: '2026-08-06T13:00:00.000Z' });
};

describe('the six forward transitions, taken through the adapter', () => {
    it('walks context → prediction → experiment → synthesis → review → debrief, then replays', () => {
        const store = createStore(createInitialAppState(definition));

        expect(selectCasePhase(store.getState())).toBe('context');
        sourceIds().forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        expect(advance(store).ok).toBe(true);
        expect(selectCasePhase(store.getState())).toBe('prediction');

        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
        expect(advance(store).ok).toBe(true);
        expect(selectCasePhase(store.getState())).toBe('experiment');

        recordTwoDistinctRuns(store);
        expect(advance(store).ok).toBe(true);
        expect(selectCasePhase(store.getState())).toBe('synthesis');

        buildDefensibleDraft(store);
        expect(advance(store).ok).toBe(true);
        expect(selectCasePhase(store.getState())).toBe('review');

        saveReviewedRevision(store);
        expect(advance(store).ok).toBe(true);
        expect(selectCasePhase(store.getState())).toBe('debrief');
        expect(selectCompletionSnapshot(store.getState())).toBeDefined();

        // The replay is a forward move like the others, and it takes the player back to the library
        // with a fresh investigation rather than to a finished one.
        expect(advance(store).ok).toBe(true);
        expect(selectCasePhase(store.getState())).toBe('context');
        expect(store.getState().runs).toEqual([]);
        expect(store.getState().replay.isCounterfactual).toBe(true);
    });

    it('reaches every phase the case machine has, so no phase is skipped by the walk above', () => {
        // Guards against a walk that "passes" by taking a shortcut the player does not have — the
        // review phase in particular is reachable by a `case.phaseAdvance` that bypasses the readiness
        // check entirely, and a walk that used it would still end in `debrief`.
        const store = createStore(createInitialAppState(definition));
        const visited: string[] = [selectCasePhase(store.getState())];

        sourceIds().forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        advance(store); visited.push(selectCasePhase(store.getState()));
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
        advance(store); visited.push(selectCasePhase(store.getState()));
        recordTwoDistinctRuns(store);
        advance(store); visited.push(selectCasePhase(store.getState()));
        buildDefensibleDraft(store);
        advance(store); visited.push(selectCasePhase(store.getState()));
        saveReviewedRevision(store);
        advance(store); visited.push(selectCasePhase(store.getState()));

        expect(visited).toEqual([...CASE_PHASES]);
    });

    it('uses a distinct transition for each step, covering the whole set exactly once', () => {
        const store = createStore(createInitialAppState(definition));
        const taken: string[] = [];
        const step = (): void => {
            taken.push(advanceTransitionForPhase(selectCasePhase(store.getState())).transition);
            advance(store);
        };

        sourceIds().forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        step();
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
        step();
        recordTwoDistinctRuns(store);
        step();
        buildDefensibleDraft(store);
        step();
        saveReviewedRevision(store);
        step();
        step();

        expect([...taken].sort()).toEqual([...ADVANCE_TRANSITION_IDS].sort());
    });
});

describe('the transitions that are not a phase advance', () => {
    /** A store standing at the theory board with a complete, reviewable draft. */
    const storeAtSynthesis = (): AppStore => {
        const store = createStore(createInitialAppState(definition));
        sourceIds().forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        advance(store);
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
        advance(store);
        recordTwoDistinctRuns(store);
        advance(store);
        return store;
    };

    it('refuses synthesis → review while the conclusion is not ready, which a phase advance would not', () => {
        // The trap, stated as a test. `case.phaseAdvance { nextPhase: 'review' }` succeeds here — the
        // phase machine permits it and no gate stands in front of it — so a surface that used it would
        // move a player past `evaluateConclusionReadiness` with an unsupported draft and no warning.
        const store = storeAtSynthesis();

        const refused = advance(store);
        expect(refused.ok).toBe(false);
        expect(refused.ok === false && refused.error.code).toBe('conclusion-not-ready');
        expect(selectCasePhase(store.getState())).toBe('synthesis');

        // The bypass is real, not hypothetical: this is the action a uniform mapping would have sent.
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' }).ok).toBe(true);
        expect(selectCasePhase(store.getState())).toBe('review');
    });

    it('refuses review → debrief until a reviewed revision is saved', () => {
        const store = storeAtSynthesis();
        buildDefensibleDraft(store);
        advance(store);

        const refused = advance(store);
        expect(refused.ok).toBe(false);
        expect(refused.ok === false && refused.error.code).toBe('reviewed-revision-required');
        expect(selectCasePhase(store.getState())).toBe('review');
    });

    it('refuses a phase advance into the debrief outright, whatever the evidence', () => {
        // Why `review → debrief` cannot be a `case.phaseAdvance`: the reducer's first check rejects
        // the pair before it ever reaches the phase machine.
        const store = storeAtSynthesis();
        buildDefensibleDraft(store);
        advance(store);
        saveReviewedRevision(store);

        const refused = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'debrief' });

        expect(refused.ok === false && refused.error.code).toBe('debrief-completion-required');
    });

    it('refuses a replay before the case is complete', () => {
        const store = createStore(createInitialAppState(definition));

        const refused = createPhaserStoreAdapter(store).advanceCase('debrief-replay');

        expect(refused.ok === false && refused.error.code).toBe('replay-unavailable');
    });
});

describe('the two registers a refusal is answered in (AC4)', () => {
    it('answers the significant-measure gate with a code the surface routes to the colleague', () => {
        const store = createStore(createInitialAppState(definition));
        sourceIds().forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        advance(store);
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
        advance(store);

        const refused = advance(store);

        expect(refused.ok === false && refused.error.code).toBe('significant-measures-required');
    });

    it('answers a refusal during a progress operation with a localized error instead', () => {
        // Nothing to do with the evidence: `createStore` short-circuits every dispatch while an
        // exclusive progress operation is in flight, so a click during an export legitimately fails.
        // Swallowing it would leave the control indistinguishable from a dead one.
        const store = createStore(createInitialAppState(definition));
        sourceIds().forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        const release = store.acquireExclusiveOperation();
        if (!release.ok) throw new Error('The exclusive progress operation must be acquirable.');

        const refused = advance(store);

        expect(refused.ok).toBe(false);
        expect(refused.ok === false && refused.error.code).toBe('progress-operation-active');
        expect(refused.ok === false && selectLocalizedError(store.getState(), refused.error))
            .not.toBe(refused.ok === false ? refused.error.code : '');
        expect(selectCasePhase(store.getState())).toBe('context');

        // Released, the same click succeeds — so the refusal really was the operation and not the gate.
        release.value();
        expect(advance(store).ok).toBe(true);
    });

    it('localizes the missing-sources refusal with its interpolated source name, never a raw token', () => {
        // `selectLocalizedError` supplies `{label}` itself, which is what stops a surface leaving the
        // placeholder on screen.
        const store = createStore(createInitialAppState(definition, 'fr'));

        const refused = advance(store);
        const message = refused.ok === false ? selectLocalizedError(store.getState(), refused.error) : '';

        expect(refused.ok === false && refused.error.code).toBe('missing-contextual-sources');
        expect(message).not.toContain('{label}');
        expect(message).not.toBe(refused.ok === false ? refused.error.message : '');
    });
});
