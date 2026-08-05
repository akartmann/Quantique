import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectCasePhase, selectConclusionReadiness, selectTheoryBoardDraft } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';

const definition = {
    id: 'young-interference',
    prediction: { required: true },
    requirements: { minimumRuns: 2, minimumSources: 2 },
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'source-1', displayName: 'Source one', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'source-2', displayName: 'Source two', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ],
    experiment: { modelVersion: 'young-observation-v1' }
} as CaseDefinition;

const run = (id: string) => {
    const result = createRunRecord({
        id, caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
        result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: '2026-08-04T12:00:00.000Z', experimentModelVersion: 'young-observation-v1'
    });
    if (!result.ok) throw new Error('Fixture run must be valid.');
    return result.value;
};

describe('theory board store transitions', () => {
    it('keeps one frozen authoritative draft and rejects invalid support without notification', () => {
        const store = createStore(createInitialAppState(definition));
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });

        expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'unknown' })).toMatchObject({ ok: false, error: { code: 'unknown-theory-run' } });
        expect(notifications).toBe(0);
        store.dispatch({ type: 'run.record', record: run('run-1') });
        expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' })).toMatchObject({ ok: false, error: { code: 'duplicate-theory-run' } });
        expect(selectTheoryBoardDraft(store.getState()).selectedRunIds).toEqual(['run-1']);
        expect(Object.isFrozen(store.getState().theory)).toBe(true);
        expect(Object.isFrozen(selectTheoryBoardDraft(store.getState()).selectedRunIds)).toBe(true);
    });

    it('retains draft and evidence after a recoverable incomplete review request', () => {
        const store = createStore(createInitialAppState(definition));
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });
        store.dispatch({ type: 'theory.conclusionSet', conclusion: 'Evidence supports a bounded conclusion.' });
        const before = store.getState();
        notifications = 0;

        expect(store.dispatch({ type: 'theory.reviewRequested' })).toMatchObject({ ok: false, error: { code: 'conclusion-not-ready' } });
        expect(store.getState()).toBe(before);
        expect(selectTheoryBoardDraft(store.getState()).conclusion).toBe('Evidence supports a bounded conclusion.');
        expect(selectConclusionReadiness(store.getState()).status).toBe('incomplete');
        expect(notifications).toBe(0);
    });

    it('uses only the adjacent domain transition for a ready synthesis-to-review request', () => {
        const store = createStore(createInitialAppState(definition));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        ['run-1', 'run-2'].forEach((id) => store.dispatch({ type: 'run.record', record: run(id) }));
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }));
        store.dispatch({ type: 'theory.conclusionSet', conclusion: 'The selected evidence supports a bounded conclusion.' });
        store.dispatch({ type: 'theory.limitationSet', limitation: 'The observations do not settle every alternative explanation.' });

        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' })).toMatchObject({ ok: false, error: { code: 'invalid-case-transition' } });
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'prediction.recorded', prediction: 'A tentative pattern may appear.' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
        expect(selectCasePhase(store.getState())).toBe('review');
    });
});
