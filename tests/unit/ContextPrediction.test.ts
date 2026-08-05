import { describe, expect, it } from 'vitest';

import { createInitialAppState, reduceAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectMissingContextArtifactLabels, selectSavedPrediction } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

const definition = {
    id: 'young-interference', version: '1.0.0', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2 },
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'young-lecture-1801', displayName: 'Young lecture record', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'young' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'newton-opticks', displayName: 'Opticks reference', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'opticks' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ],
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

describe('context and prediction gates', () => {
    it('rejects phase shortcuts without notifying, then saves a trimmed prediction immutably', () => {
        let state = createInitialAppState(definition);
        const beforeGate = state;
        const blockedContext = reduceAppState(state, { type: 'case.phaseAdvance', nextPhase: 'prediction' });
        expect(blockedContext).toMatchObject({ ok: false, error: { code: 'missing-contextual-sources' } });
        expect(state).toBe(beforeGate);
        expect(reduceAppState(state, { type: 'prediction.recorded', prediction: 'A premature prediction.' })).toMatchObject({
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
        expect(reduceAppState(state, { type: 'prediction.recorded', prediction: '   ' })).toMatchObject({
            ok: false, error: { code: 'invalid-prediction' }
        });
        const missingPrediction = reduceAppState(state, { type: 'case.phaseAdvance', nextPhase: 'experiment' });
        expect(missingPrediction).toMatchObject({ ok: false, error: { code: 'missing-prediction' } });

        const recorded = reduceAppState(state, { type: 'prediction.recorded', prediction: '  A tentative pattern may appear.  ' });
        expect(recorded).toMatchObject({ ok: true, value: { prediction: 'A tentative pattern may appear.' } });
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
        expect(store.dispatch({ type: 'prediction.recorded', prediction: '   ' })).toMatchObject({
            ok: false, error: { code: 'missing-contextual-sources' }
        });
        expect(notifications).toBe(0);

        ['young-lecture-1801', 'newton-opticks'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        store.dispatch({ type: 'prediction.recorded', prediction: 'A revisable expectation.' });
        expect(selectMissingContextArtifactLabels(store.getState())).toEqual([]);
        expect(selectSavedPrediction(store.getState())).toBe('A revisable expectation.');
    });
});
