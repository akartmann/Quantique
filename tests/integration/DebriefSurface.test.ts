import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createInitialAppState, type AppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import {
    selectCompletionSnapshot,
    selectLocalizedCritiqueHistory,
    selectLocalizedDebrief,
    selectLocalizedRecognition,
    selectReplayState
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { RECOGNITION_IDS, recognitionDefinitions } from '../../src/domain/recognition/recognitionRules';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The debrief through **public actions and selectors only** (Story 2.11, AC8).
 *
 * No renderer, no scene, no Phaser: what this pins is the contract the debrief surface reads — the
 * completion snapshot's lifetime across a counterfactual replay, the two timestamp refusals AC6 splits
 * apart, and the four projections the room renders. The surface's own painting is
 * `DebriefRenderer.test.ts`; the routing is `debrief-replay.spec.ts`.
 *
 * Against the shipped Young case, so the reducers evaluate the requirements a player actually meets.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** Drives a store to `review` with a reviewed revision saved, entirely through public actions. */
const reviewedStore = (locale: 'en' | 'fr' = 'en', options: { indefensible?: boolean } = {}): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    const screen = definition.apparatus.primaryControls.find(({ id }) => id === 'screenDistanceM')!;
    [0, 1].forEach((index) => {
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: screen.min + (index * screen.step), origin: 'phaser' });
        store.dispatch({ type: 'experiment.run', id: `run-${index + 1}`, timestamp: `2026-08-07T10:0${index}:00.000Z` });
    });
    ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'comparison.runSelected', runId }));
    store.dispatch({ type: 'comparison.noteSaved', note: 'The spacing widens with the screen distance.' });
    ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    store.dispatch({
        type: 'theory.conclusionProposalChosen',
        // A proposal the rival lab challenges, when the test needs a challenge in the history.
        proposalId: (options.indefensible
            ? definition.conclusionProposals.find(({ id }) => definition.rivalLab.critiques.some((critique) => critique.proposalId === id))
            : definition.conclusionProposals[0])!.id
    });
    if (options.indefensible) {
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-07T10:30:00.000Z' });
        store.dispatch({ type: 'rivalLab.revisionRequested' });
    }
    expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
    expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });
    expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-08-07T11:00:00.000Z' })).toEqual({ ok: true, value: undefined });
    return store;
};

const complete = (store: AppStore, timestamp = '2026-08-07T12:00:00.000Z') =>
    store.dispatch({ type: 'case.debriefCompleted', timestamp });

describe('completing the case and replaying it', () => {
    it('refuses completion before a reviewed revision, and accepts it after', () => {
        const store = createStore(createInitialAppState(definition));
        expect(complete(store)).toMatchObject({ ok: false, error: { code: 'debrief-review-required' } });

        const reviewed = reviewedStore();
        expect(complete(reviewed)).toEqual({ ok: true, value: undefined });
        expect(reviewed.getState().phase).toBe('debrief');
        expect(selectCompletionSnapshot(reviewed.getState())).toBeDefined();
    });

    /**
     * AC6: the ordering failure has its own code, so its message can name the device clock rather than
     * describe a UTC field the player has never seen.
     *
     * Both refusals are reachable and both are asserted, because the point of the split is that they
     * stay **different** — a change that merged them again would pass a test that only checked one.
     */
    it('answers a stale completion timestamp and a malformed one with different codes', () => {
        const store = reviewedStore();
        expect(complete(store, '2026-08-07T10:59:59.000Z'))
            .toMatchObject({ ok: false, error: { code: 'completion-timestamp-not-later' } });
        expect(complete(store, 'not-a-timestamp'))
            .toMatchObject({ ok: false, error: { code: 'invalid-completion-timestamp' } });

        // Both carry authored copy in both locales, and the new one names the remedy the player has.
        expect(en['error.completion-timestamp-not-later']).toContain('device clock');
        expect(fr['error.completion-timestamp-not-later']).toContain('horloge de l’appareil');
        expect(en['error.completion-timestamp-not-later']).not.toBe(en['error.invalid-completion-timestamp']);
    });

    it('refuses a replay outside the debrief, and takes one from inside it', () => {
        const store = reviewedStore();
        expect(store.dispatch({ type: 'case.replayStarted' }))
            .toMatchObject({ ok: false, error: { code: 'replay-unavailable' } });

        complete(store);
        expect(store.dispatch({ type: 'case.replayStarted' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().phase).toBe('context');
        expect(selectReplayState(store.getState()).isCounterfactual).toBe(true);
    });

    /**
     * AC4's "a replay preserves the completed historical record", and AC2's "never rewrites the
     * historical outcome" — **both held by the reducer**, asserted here rather than re-implemented in
     * a surface.
     */
    it('clears the investigation on a replay and leaves the completed record untouched', () => {
        const store = reviewedStore('en', { indefensible: true });
        complete(store);
        const completed = selectCompletionSnapshot(store.getState());
        expect(completed?.critiqueHistory.length).toBeGreaterThan(0);

        store.dispatch({ type: 'case.replayStarted' });
        const after = store.getState();

        expect(after.runs).toEqual([]);
        expect(after.decisionHistory).toEqual([]);
        expect(after.critiqueHistory).toEqual([]);
        expect(after.inspectedSourceIds).toEqual([]);
        // Value-equal, not identity-equal: `freezeState` rebuilds the frozen tree on every accepted
        // action, so object identity is a fact about the freezer rather than about the record. What
        // the debrief depends on is that nothing in the snapshot *changed*.
        expect(selectCompletionSnapshot(after)).toEqual(completed);
        expect(selectCompletionSnapshot(after)?.critiqueHistory).toEqual(completed?.critiqueHistory);
    });

    /**
     * "Campaign unlock state" (AC4). There is **no campaign state in this build**: one case ships, and
     * `reduceReplayStart` resets case progress only. The clause is satisfied by the completed record
     * surviving the replay *and* the re-completion, which is what this asserts — recorded as a reading
     * rather than answered by inventing an unlock field.
     */
    it('leaves the completed record byte-identical after a counterfactual replay is itself completed', () => {
        const store = reviewedStore();
        complete(store);
        const original = selectCompletionSnapshot(store.getState());
        store.dispatch({ type: 'case.replayStarted' });

        // A whole second investigation, on the same store.
        definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[1].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        const screen = definition.apparatus.primaryControls.find(({ id }) => id === 'screenDistanceM')!;
        [0, 1].forEach((index) => {
            store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: screen.max - (index * screen.step), origin: 'phaser' });
            store.dispatch({ type: 'experiment.run', id: `replay-run-${index + 1}`, timestamp: `2026-08-07T13:0${index}:00.000Z` });
        });
        ['replay-run-1', 'replay-run-2'].forEach((runId) => store.dispatch({ type: 'comparison.runSelected', runId }));
        store.dispatch({ type: 'comparison.noteSaved', note: 'A second look at the same pair.' });
        ['replay-run-1', 'replay-run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId: id }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[1].id });
        store.dispatch({ type: 'theory.reviewRequested' });
        store.dispatch({ type: 'peerReview.requested' });
        store.dispatch({ type: 'revision.saved', timestamp: '2026-08-07T14:00:00.000Z' });
        expect(complete(store, '2026-08-07T15:00:00.000Z')).toEqual({ ok: true, value: undefined });

        // The record the debrief shows is the **first** completion's, not the second's.
        expect(selectCompletionSnapshot(store.getState())).toEqual(original);
        expect(selectCompletionSnapshot(store.getState())?.completedAt).toBe('2026-08-07T12:00:00.000Z');
        expect(selectReplayState(store.getState()).isCounterfactual).toBe(true);
    });
});

describe('what the debrief projects', () => {
    /**
     * D2: the recognition account and the challenge history come from `completion`, never from the
     * live fields — a selector that read the live ones would show the replay's on a completed record.
     */
    it('reads the completed snapshot rather than the live fields after a replay', () => {
        const store = reviewedStore('en', { indefensible: true });
        complete(store);
        const snapshot = selectCompletionSnapshot(store.getState())!;
        const before = selectLocalizedCritiqueHistory(store.getState());
        expect(before.length).toBe(snapshot.critiqueHistory.length);
        expect(before.length).toBeGreaterThan(0);

        store.dispatch({ type: 'case.replayStarted' });
        // `state.critiqueHistory` is empty now. The projection is not.
        expect(store.getState().critiqueHistory).toEqual([]);
        expect(selectLocalizedCritiqueHistory(store.getState())).toEqual(before);
    });

    it('attributes every challenge to the rival by name, with his role resolved by locale', () => {
        const store = reviewedStore('fr', { indefensible: true });
        complete(store);
        const [entry] = selectLocalizedCritiqueHistory(store.getState());

        expect(entry.speaker).toContain(definition.rivalLab.name);
        expect(entry.speaker).toContain(fr['rivalLab.role']);
        const authored = definition.rivalLab.critiques.find(({ id }) => id === entry.critiqueId)!;
        expect(entry.line).toBe(authored.line.fr);
        expect(entry.line).not.toBe(authored.line.en);
    });

    it('resolves recognition by stable id and leaves the canonical English in the record', () => {
        const store = reviewedStore('fr');
        complete(store);
        const snapshot = selectCompletionSnapshot(store.getState())!;
        const projected = selectLocalizedRecognition(store.getState(), snapshot.recognition.items);

        expect(projected).toHaveLength(RECOGNITION_IDS.length);
        projected.forEach(({ id, label, description }) => {
            expect(label).toBe(fr[`recognition.${id}.label`]);
            expect(description).toBe(fr[`recognition.${id}.description`]);
        });
        /**
         * The record keeps the **domain's** canonical English, because
         * `validateCaseRecordForDefinition` recomputes and string-compares it on load — emitting the
         * active locale would reject every record saved in the other language.
         *
         * Compared against `recognitionDefinitions()` rather than against the bundle, which is the
         * stronger claim: the two are separate strings that happen to say similar things, and Story
         * 2.11 shortened the bundle's display labels without touching the persisted ones. A test that
         * held them equal would have made that copy edit look like a record-compatibility break.
         */
        const canonical = new Map(recognitionDefinitions().map((item) => [item.id, item.label]));
        snapshot.recognition.items.forEach(({ id, label }) => {
            expect(label).toBe(canonical.get(id));
        });
        expect([...canonical.values()]).not.toEqual(RECOGNITION_IDS.map((id) => en[`recognition.${id}.label`]));
    });

    /**
     * The selector takes its items as an **argument** rather than reading `state.recognition`, and
     * this is why: on a completed record the live field belongs to whatever is running now.
     */
    it('projects whichever recognition list it is given, not whichever one the store holds', () => {
        const store = reviewedStore();
        complete(store);
        const snapshot = selectCompletionSnapshot(store.getState())!;
        store.dispatch({ type: 'case.replayStarted' });

        const live = selectLocalizedRecognition(store.getState(), store.getState().recognition.items);
        const recorded = selectLocalizedRecognition(store.getState(), snapshot.recognition.items);
        expect(recorded.map(({ achieved }) => achieved)).not.toEqual(live.map(({ achieved }) => achieved));
    });

    it('cites the comparison’s own sources with their provenance, in the active locale', () => {
        const store = reviewedStore('fr');
        const projected = selectLocalizedDebrief(store.getState());

        expect(projected.summary).toBe(definition.debrief.summary.fr);
        expect(projected.historicalComparison.text).toBe(definition.debrief.historicalComparison.text.fr);
        expect(projected.deeperTheory.text).toBe(definition.debrief.deeperTheory.text.fr);
        expect(projected.replayLabel).toBe(definition.debrief.replayLabel.fr);

        expect(projected.historicalComparison.sources.map(({ sourceId }) => sourceId))
            .toEqual([...definition.debrief.historicalComparison.sourceIds]);
        projected.historicalComparison.sources.forEach((source) => {
            const artifact = definition.contextualArtifacts.find(({ id }) => id === source.sourceId)!;
            expect(source.name).toBe(artifact.displayName.fr);
            expect(source.provenance).toBe(fr[`source.provenanceName.${artifact.provenance.category}`]);
            expect(source.sourceType).toBe(fr[`source.type.${artifact.sourceType}`]);
            expect(source.rightsStatus).toBe(fr[`source.rights.${artifact.rightsStatus}`]);
        });
    });

    /**
     * `debrief.sourceRefs` cites two ids that match no artifact and is validated only as non-empty
     * strings (Open Question 3). Nothing reads it, and the projection must be citing
     * `historicalComparison.sourceIds` instead — which is what this pins, so a later change that
     * quietly switched fields would show the player two unresolvable citations.
     */
    it('cites the cross-checked source ids and never the vestigial sourceRefs', () => {
        const store = reviewedStore();
        const cited = selectLocalizedDebrief(store.getState()).historicalComparison.sources.map(({ sourceId }) => sourceId);

        expect(cited).toEqual([...definition.debrief.historicalComparison.sourceIds]);
        definition.debrief.sourceRefs.forEach((ref) => {
            if (!definition.contextualArtifacts.some(({ id }) => id === ref)) expect(cited).not.toContain(ref);
        });
    });

    /**
     * AC2's four provenance categories, exercised against a fixture rather than the shipped case —
     * both shipped artifacts are `primary-material`, so shipped content covers one of the four.
     */
    it('names a reconstruction, a later interpretation and a deliberate fiction when a case cites them', () => {
        (['reconstruction', 'later-interpretation', 'deliberate-fiction'] as const).forEach((category) => {
            const fixture = {
                ...definition,
                contextualArtifacts: definition.contextualArtifacts.map((artifact, index) => index === 0
                    ? { ...artifact, provenance: { ...artifact.provenance, category } }
                    : artifact)
            } as CaseDefinition;
            const state = createInitialAppState(fixture, 'fr') as AppState;

            const [first] = selectLocalizedDebrief(state).historicalComparison.sources;
            expect(first.provenance).toBe(fr[`source.provenanceName.${category}`]);
            // Distinct from the shipped one, so a projection returning a constant would fail here.
            expect(first.provenance).not.toBe(fr['source.provenanceName.primary-material']);
        });
    });
});
