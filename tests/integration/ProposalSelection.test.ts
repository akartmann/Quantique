import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createAppStateFromCaseRecord, createInitialAppState, type AppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import {
    selectColleagueById,
    selectConclusionProposals,
    selectDefensibleConclusionProposalIds,
    selectLocalizedConclusionProposals,
    selectLocalizedPredictionProposals,
    selectPortableCaseRecord,
    selectPredictionProposals,
    selectRivalLabCritique,
    selectSelectedConclusionProposalId,
    selectSelectedPredictionProposalId
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The authored Young content, not a hand-built fixture: these assertions are about the contract
 * between the store and the case that actually ships, including the canonical `.en` text that a
 * saved record has to revalidate against.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** Advances a fresh store to the prediction phase, which is the earliest a proposal can be chosen. */
const storeAtPrediction = (locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    return store;
};

/** Runs the fixture through to a review-ready state so a record round-trip has something to carry. */
const storeAtReview = (): AppStore => {
    const store = storeAtPrediction();
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
    store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.35, origin: 'phaser' });
    store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' });
    store.dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
    store.dispatch({ type: 'comparison.runSelected', runId: 'run-2' });
    store.dispatch({ type: 'comparison.noteSaved', note: 'The band spacing changes with the slit separation.' });
    store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' });
    store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-2' });
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    return store;
};

describe('prediction proposal selection', () => {
    it('records the chosen proposal and writes the canonical prediction text', () => {
        const store = storeAtPrediction();
        const [first] = definition.predictionProposals;

        expect(store.dispatch({ type: 'prediction.proposalChosen', proposalId: first.id })).toEqual({ ok: true, value: undefined });

        expect(selectSelectedPredictionProposalId(store.getState())).toBe(first.id);
        // Canonical `.en`, regardless of the interface language: this value is persisted and
        // equality-validated on load.
        expect(store.getState().prediction).toBe(first.text.en);
    });

    it('writes canonical English even in a French session', () => {
        const store = storeAtPrediction('fr');
        const [first] = definition.predictionProposals;

        store.dispatch({ type: 'prediction.proposalChosen', proposalId: first.id });

        expect(store.getState().prediction).toBe(first.text.en);
        expect(store.getState().prediction).not.toBe(first.text.fr);
    });

    it('is revisable: re-choosing replaces the choice and never fails', () => {
        const store = storeAtPrediction();
        const [first, second] = definition.predictionProposals;

        store.dispatch({ type: 'prediction.proposalChosen', proposalId: first.id });
        expect(store.dispatch({ type: 'prediction.proposalChosen', proposalId: first.id })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'prediction.proposalChosen', proposalId: second.id })).toEqual({ ok: true, value: undefined });

        expect(selectSelectedPredictionProposalId(store.getState())).toBe(second.id);
        expect(store.getState().prediction).toBe(second.text.en);
    });

    it('rejects an unauthored proposal ID and leaves state untouched', () => {
        const store = storeAtPrediction();
        const before = store.getState();

        expect(store.dispatch({ type: 'prediction.proposalChosen', proposalId: 'prediction-invented' }))
            .toMatchObject({ ok: false, error: { code: 'unknown-prediction-proposal' } });

        expect(store.getState()).toBe(before);
    });

    it('applies the same context-readiness gate as a free-text prediction', () => {
        const store = createStore(createInitialAppState(definition));

        expect(store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id }))
            .toMatchObject({ ok: false, error: { code: 'missing-contextual-sources' } });
    });

    it('clears the proposal ID when a free-text prediction is recorded over it', () => {
        const store = storeAtPrediction();
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });

        store.dispatch({ type: 'prediction.recorded', prediction: 'A hand-written prediction.' });

        expect(selectSelectedPredictionProposalId(store.getState())).toBeUndefined();
        expect(store.getState().prediction).toBe('A hand-written prediction.');
    });

    // The DOM panel offers the chosen proposal's canonical text straight back in its textarea, so
    // "Record a prediction" is one click away from re-recording it byte-for-byte. Clearing there made
    // the surface silently un-choose a proposal without a single character changing.
    it('keeps the proposal ID when the recorded text is the proposal’s own, unchanged', () => {
        const store = storeAtPrediction();
        const [first] = definition.predictionProposals;
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: first.id });

        expect(store.dispatch({ type: 'prediction.recorded', prediction: first.text.en })).toEqual({ ok: true, value: undefined });

        expect(selectSelectedPredictionProposalId(store.getState())).toBe(first.id);
        expect(store.getState().prediction).toBe(first.text.en);
    });
});

describe('conclusion proposal selection', () => {
    it('records the chosen proposal and writes the canonical claim and limitation', () => {
        const store = storeAtReview();
        const [first] = definition.conclusionProposals;

        expect(store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: first.id })).toEqual({ ok: true, value: undefined });

        expect(selectSelectedConclusionProposalId(store.getState())).toBe(first.id);
        expect(store.getState().theory.conclusion).toBe(first.claim.en);
        expect(store.getState().theory.limitation).toBe(first.limitation.en);
    });

    it('does not advance the phase or gate on defensibility', () => {
        const store = storeAtReview();
        // The two `never` proposals are the ones the evaluator can never defend; choosing one is
        // still recorded. The gate and the critique belong to Stories 2.3/2.5/2.6.
        const overreaching = definition.conclusionProposals.find(({ supportPredicate }) => supportPredicate.kind === 'never');
        if (!overreaching) throw new Error('The authored set must include an overreaching conclusion.');

        expect(store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: overreaching.id })).toEqual({ ok: true, value: undefined });

        expect(store.getState().phase).toBe('synthesis');
        expect(selectSelectedConclusionProposalId(store.getState())).toBe(overreaching.id);
    });

    it('is revisable and rejects an unauthored proposal ID without touching state', () => {
        const store = storeAtReview();
        const [first, second] = definition.conclusionProposals;

        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: first.id });
        expect(store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: second.id })).toEqual({ ok: true, value: undefined });
        expect(selectSelectedConclusionProposalId(store.getState())).toBe(second.id);

        const before = store.getState();
        expect(store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclusion-invented' }))
            .toMatchObject({ ok: false, error: { code: 'unknown-conclusion-proposal' } });
        expect(store.getState()).toBe(before);
    });

    it.each([
        ['theory.conclusionSet', { type: 'theory.conclusionSet', conclusion: 'A hand-written conclusion.' } as const],
        ['theory.limitationSet', { type: 'theory.limitationSet', limitation: 'A hand-written limitation.' } as const]
    ])('clears the proposal ID when %s writes over it', (_description, action) => {
        const store = storeAtReview();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });

        store.dispatch(action);

        expect(selectSelectedConclusionProposalId(store.getState())).toBeUndefined();
    });

    // Setting the same text back — which typing a character into the textarea and deleting it again
    // does — must not cost the attribution.
    it.each([
        ['theory.conclusionSet', 'claim' as const],
        ['theory.limitationSet', 'limitation' as const]
    ])('keeps the proposal ID when %s rewrites the proposal’s own text unchanged', (actionType, field) => {
        const store = storeAtReview();
        const [first] = definition.conclusionProposals;
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: first.id });

        store.dispatch(actionType === 'theory.conclusionSet'
            ? { type: 'theory.conclusionSet', conclusion: first[field].en }
            : { type: 'theory.limitationSet', limitation: first[field].en });

        expect(selectSelectedConclusionProposalId(store.getState())).toBe(first.id);
    });

    // The store is the authority on when a conclusion can be chosen, not whichever scene is mounted.
    it('refuses a conclusion choice before the theory board is reached', () => {
        const store = storeAtPrediction();
        const before = store.getState();

        expect(store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id }))
            .toMatchObject({ ok: false, error: { code: 'conclusion-phase-unavailable' } });
        expect(store.getState()).toBe(before);
    });
});

describe('proposal projections', () => {
    it('exposes the authored cast and both proposal sets', () => {
        const state = storeAtPrediction().getState();

        expect(selectPredictionProposals(state)).toHaveLength(4);
        expect(selectConclusionProposals(state)).toHaveLength(4);
        expect(selectColleagueById(state, 'thea-young')).toMatchObject({ name: 'Dr. Thea Young', role: 'lead' });
        expect(selectColleagueById(state, 'arthur-bell')).toBeUndefined();
    });

    it('projects proposals in the active locale, attributed, and with no defensibility field', () => {
        const [english] = selectLocalizedPredictionProposals(storeAtPrediction('en').getState());
        const [french] = selectLocalizedPredictionProposals(storeAtPrediction('fr').getState());
        const [authored] = definition.predictionProposals;
        const speaker = definition.colleagues.find(({ id }) => id === authored.colleagueId);

        expect(english).toEqual({
            proposalId: authored.id,
            colleagueName: speaker?.name,
            roleLabel: 'Lead',
            text: authored.text.en
        });
        expect(french.text).toBe(authored.text.fr);
        expect(french.roleLabel).toBe('Responsable');
        // AC3: the renderer must never learn which proposals are defensible.
        expect(Object.keys(english)).not.toContain('isDefensible');
    });

    it('projects conclusion proposals with their claim, limitation, and no defensibility field', () => {
        const [projected] = selectLocalizedConclusionProposals(storeAtReview().getState());
        const [authored] = definition.conclusionProposals;

        // Exact equality, not `toMatchObject`: AC3 turns on the projection carrying *no* defensibility
        // signal, and a matcher that ignores extra keys paired with a one-name blacklist would pass
        // just as happily if `supportPredicate` or `isCorrect` were added to it.
        const speaker = definition.colleagues.find(({ id }) => id === authored.colleagueId);
        expect(projected).toEqual({
            proposalId: authored.id,
            colleagueName: speaker?.name,
            roleLabel: 'Analyst',
            text: authored.claim.en,
            limitation: authored.limitation.en
        });
    });

    it('keeps the defensible set on the evaluator side, matching the recorded evidence', () => {
        const store = storeAtReview();

        // Two runs at different slit spacings plus both sources inspected: exactly the minimum path.
        expect(selectDefensibleConclusionProposalIds(store.getState())).toEqual(['conclusion-spacing-varies']);
        expect(selectDefensibleConclusionProposalIds(createInitialAppState(definition))).toEqual([]);
    });
});

describe('record round trip', () => {
    const restore = (state: AppState): AppState => {
        const record = selectPortableCaseRecord(state);
        if (!record.ok) throw new Error(`The projection must succeed: ${record.error.code}`);
        const restored = createAppStateFromCaseRecord(record.value, definition);
        if (!restored.ok) throw new Error(`The record must revalidate: ${restored.error.code}`);
        return restored.value;
    };

    it('preserves both proposal IDs through export and import', () => {
        const store = storeAtReview();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });

        const restored = restore(store.getState());

        expect(selectSelectedPredictionProposalId(restored)).toBe(definition.predictionProposals[0].id);
        expect(selectSelectedConclusionProposalId(restored)).toBe(definition.conclusionProposals[0].id);
        expect(restored.prediction).toBe(definition.predictionProposals[0].text.en);
        expect(restored.theory.conclusion).toBe(definition.conclusionProposals[0].claim.en);
    });

    it('restores a record that carries no proposal IDs at all', () => {
        const store = storeAtPrediction();
        store.dispatch({ type: 'prediction.recorded', prediction: 'A hand-written prediction.' });

        const restored = restore(store.getState());

        expect(selectSelectedPredictionProposalId(restored)).toBeUndefined();
        expect(selectSelectedConclusionProposalId(restored)).toBeUndefined();
    });

    it('clears both proposal IDs when a counterfactual replay resets progress', () => {
        const store = storeAtReview();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        store.dispatch({ type: 'theory.reviewRequested' });
        store.dispatch({ type: 'peerReview.requested' });
        store.dispatch({ type: 'revision.saved', timestamp: '2026-08-06T12:10:00.000Z' });
        store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-06T12:11:00.000Z' });

        expect(store.dispatch({ type: 'case.replayStarted' })).toEqual({ ok: true, value: undefined });

        expect(selectSelectedPredictionProposalId(store.getState())).toBeUndefined();
        expect(selectSelectedConclusionProposalId(store.getState())).toBeUndefined();
    });
});

/**
 * The authored `conclusion-wave-settled` claim contains "proves", which is an authored overreach
 * phrase. That is the intended pre-rival-lab critique mechanism, not an accident — pinned here so a
 * later copy edit cannot silently change which issues a saved record recomputes to on load.
 */
describe('authored overreach interaction', () => {
    it('raises the overreach finding for the authored overreaching conclusion', () => {
        const store = storeAtReview();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclusion-wave-settled' });
        store.dispatch({ type: 'theory.reviewRequested' });

        store.dispatch({ type: 'peerReview.requested' });

        expect(store.getState().peerReview).toMatchObject({
            status: 'reviewed',
            issues: [{ code: 'overreach' }]
        });
    });

    it('raises no overreach finding for the authored bounded conclusion', () => {
        const store = storeAtReview();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclusion-spacing-varies' });
        store.dispatch({ type: 'theory.reviewRequested' });

        store.dispatch({ type: 'peerReview.requested' });

        expect(store.getState().peerReview).toMatchObject({ status: 'reviewed', issues: [] });
    });
});

/** Drives one chosen conclusion all the way to a completed debrief. */
const completeWithConclusion = (proposalId: string): AppStore => {
    const store = storeAtReview();
    store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId });
    store.dispatch({ type: 'theory.reviewRequested' });
    store.dispatch({ type: 'peerReview.requested' });
    store.dispatch({ type: 'revision.saved', timestamp: '2026-08-06T12:10:00.000Z' });
    store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-06T12:11:00.000Z' });
    return store;
};

/**
 * `conclusion-universal-optics` is the most unbounded claim in the authored set, and the peer-review
 * rules deliberately cannot see it: it contains none of the authored `overreachPhrases`, and its
 * "None is offered: …" limitation is a non-empty string, which is all any limitation gate tests. So
 * peer review returns zero findings for it and it *earns* `calibrated-conclusion` — "a bounded claim
 * without an overreach finding".
 *
 * **Story 2.5 landed, and it is what catches this claim** — the mechanism chosen at the 1.11 review
 * (decision 1d) precisely so the detection phrases would not have to grow. Widening
 * `overreachPhrases` would invalidate every saved record, because `PeerReviewIssue` persists authored
 * English prose and `validateCaseRecordForDefinition` recomputes and compares it on every load; see
 * the argument in `peerReviewRules.ts`. So the peer-review assertions below stay exactly as they were,
 * and the rival lab is the layer that answers the overreach.
 */
describe('authored overreach the peer-review rules deliberately cannot detect', () => {
    it('raises no finding for conclusion-universal-optics', () => {
        const store = storeAtReview();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclusion-universal-optics' });
        store.dispatch({ type: 'theory.reviewRequested' });

        store.dispatch({ type: 'peerReview.requested' });

        expect(store.getState().peerReview).toMatchObject({ status: 'reviewed', issues: [] });
    });

    it('and therefore still awards calibrated-conclusion for it', () => {
        const store = completeWithConclusion('conclusion-universal-optics');

        expect(store.getState().recognition.items.find(({ id }) => id === 'calibrated-conclusion')?.achieved).toBe(true);
    });

    it('is never in the defensible set, whatever the evidence', () => {
        const store = completeWithConclusion('conclusion-universal-optics');

        expect(selectDefensibleConclusionProposalIds(store.getState())).not.toContain('conclusion-universal-optics');
    });

    /** The behaviour Story 2.5 exists to add: submitting it draws the rival lab, not a review finding. */
    it('draws a rival-lab critique when it is submitted', () => {
        const store = storeAtReview();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclusion-universal-optics' });

        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:05:00.000Z' });

        expect(selectRivalLabCritique(store.getState())).toMatchObject({ proposalId: 'conclusion-universal-optics' });
    });
});

/**
 * Provenance has to outlive the live selection: `case.replayStarted` clears
 * `selectedConclusionProposalId`, so without an ID on the saved revision a completed investigation
 * kept a colleague's verbatim claim with nothing recording who said it, and the debrief and print
 * view presented their words as the player's own.
 */
describe('conclusion attribution in the saved revision', () => {
    it('records which proposal a revision adopted', () => {
        const store = completeWithConclusion('conclusion-spacing-varies');

        expect(store.getState().decisionHistory[0]).toMatchObject({ conclusionProposalId: 'conclusion-spacing-varies' });
    });

    it('leaves it absent for a hand-written conclusion', () => {
        const store = storeAtReview();
        store.dispatch({ type: 'theory.conclusionSet', conclusion: 'A hand-written conclusion, bounded to this bench.' });
        store.dispatch({ type: 'theory.limitationSet', limitation: 'It covers only the settings recorded here.' });
        store.dispatch({ type: 'theory.reviewRequested' });
        store.dispatch({ type: 'peerReview.requested' });
        store.dispatch({ type: 'revision.saved', timestamp: '2026-08-06T12:10:00.000Z' });

        expect(store.getState().decisionHistory[0].conclusionProposalId).toBeUndefined();
    });

    it('survives a counterfactual replay, which clears the live selection', () => {
        const store = completeWithConclusion('conclusion-spacing-varies');

        store.dispatch({ type: 'case.replayStarted' });

        expect(selectSelectedConclusionProposalId(store.getState())).toBeUndefined();
        expect(store.getState().completion?.finalDecision.conclusionProposalId).toBe('conclusion-spacing-varies');
    });

    it('round-trips through a saved record', () => {
        const store = completeWithConclusion('conclusion-spacing-varies');
        const record = selectPortableCaseRecord(store.getState());

        expect(record.ok).toBe(true);
        if (!record.ok) return;
        const restored = createAppStateFromCaseRecord(record.value, definition);

        expect(restored.ok).toBe(true);
        if (!restored.ok) return;
        expect(restored.value.decisionHistory[0].conclusionProposalId).toBe('conclusion-spacing-varies');
    });
});
