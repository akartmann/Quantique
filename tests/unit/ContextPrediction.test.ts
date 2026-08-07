import { describe, expect, it } from 'vitest';

import { createInitialAppState, reduceAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectMissingContextArtifactLabels, selectSavedPrediction } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

/**
 * The context gate, and the one action that can still write a prediction.
 *
 * **This file's original subject was `reducePredictionRecord`**, the free-text path Story 2.12 deleted
 * along with `CaseContextAndPrediction`. Of the three things it proved, two went with the reducer and
 * one did not:
 *
 * - the **trimming** and the `invalid-prediction` guard were about arbitrary typed input, and there is
 *   no arbitrary typed input any more — a prediction is one of four authored proposals, and its text is
 *   `proposal.text.en` verbatim. Both are gone, and so is the error code (removed from both bundles).
 * - the **context readiness gate** is a property of *recording a prediction at all*, not of how it was
 *   written. `reducePredictionProposalChosen` applies exactly the same gate, and it is asserted here
 *   against that action rather than deleted with the one it used to be written against.
 */
const definition = {
    id: 'young-interference', version: '1.0.0', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: { en: 'Slit spacing', fr: 'Slit spacing [fr]' }, unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: { en: 'Screen distance', fr: 'Screen distance [fr]' }, unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    predictionProposals: [0, 1, 2, 3].map((index) => ({
        id: `prediction-${index}`,
        colleagueId: 'colleague-1',
        text: { en: `A tentative pattern may appear (${index}).`, fr: `Un motif provisoire pourrait apparaître (${index}).` }
    })),
    contextualArtifacts: [
        { id: 'young-lecture-1801', displayName: { en: 'Young lecture record', fr: 'Young lecture record [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'young' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } },
        { id: 'newton-opticks', displayName: { en: 'Opticks reference', fr: 'Opticks reference [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'opticks' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } }
    ],
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

const firstProposal = () => definition.predictionProposals[0]!;

describe('context and prediction gates', () => {
    it('rejects phase shortcuts without notifying, then saves the chosen proposal immutably', () => {
        let state = createInitialAppState(definition);
        const beforeGate = state;
        const blockedContext = reduceAppState(state, { type: 'case.phaseAdvance', nextPhase: 'prediction' });
        expect(blockedContext).toMatchObject({ ok: false, error: { code: 'missing-contextual-sources' } });
        expect(state).toBe(beforeGate);
        // The gate the deleted free-text reducer used to carry, on the action that inherited it.
        expect(reduceAppState(state, { type: 'prediction.proposalChosen', proposalId: firstProposal().id })).toMatchObject({
            ok: false, error: { code: 'missing-contextual-sources' }
        });
        expect(state).toBe(beforeGate);

        for (const sourceId of ['young-lecture-1801', 'newton-opticks']) {
            const inspected = reduceAppState(state, { type: 'source.inspected', sourceId });
            if (!inspected.ok) throw new Error('The fixture source must be inspectable.');
            state = inspected.value;
        }
        const predictionPhase = reduceAppState(state, { type: 'case.phaseAdvance', nextPhase: 'prediction' });
        if (!predictionPhase.ok) throw new Error('Inspected context must unlock prediction.');
        state = predictionPhase.value;
        // A proposal the case does not author is still refused — the only bad input left.
        expect(reduceAppState(state, { type: 'prediction.proposalChosen', proposalId: 'not-on-offer' })).toMatchObject({
            ok: false, error: { code: 'unknown-prediction-proposal' }
        });
        const missingPrediction = reduceAppState(state, { type: 'case.phaseAdvance', nextPhase: 'experiment' });
        expect(missingPrediction).toMatchObject({ ok: false, error: { code: 'missing-prediction' } });

        const recorded = reduceAppState(state, { type: 'prediction.proposalChosen', proposalId: firstProposal().id });
        expect(recorded).toMatchObject({ ok: true, value: { prediction: firstProposal().text.en } });
        if (!recorded.ok) return;
        expect(Object.isFrozen(recorded.value)).toBe(true);
        expect(Object.isFrozen(recorded.value.prediction)).toBe(true);
        expect(reduceAppState(recorded.value, { type: 'case.phaseAdvance', nextPhase: 'experiment' })).toMatchObject({ ok: true, value: { phase: 'experiment' } });
    });

    it('exposes public readiness selectors and leaves recoverable rejections unsubscribed', () => {
        const store = createStore(createInitialAppState(definition));
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });

        expect(selectMissingContextArtifactLabels(store.getState())).toEqual(['Young lecture record', 'Opticks reference']);
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' })).toMatchObject({
            ok: false, error: { code: 'missing-contextual-sources' }
        });
        expect(store.dispatch({ type: 'prediction.proposalChosen', proposalId: firstProposal().id })).toMatchObject({
            ok: false, error: { code: 'missing-contextual-sources' }
        });
        expect(notifications).toBe(0);

        ['young-lecture-1801', 'newton-opticks'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: firstProposal().id });
        expect(selectMissingContextArtifactLabels(store.getState())).toEqual([]);
        expect(selectSavedPrediction(store.getState())).toBe(firstProposal().text.en);
    });
});
