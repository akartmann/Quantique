import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectDecisionHistory, selectPeerReview } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

const definition = {
    id: 'young-interference', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2 },
    apparatus: { primaryControls: [{ id: 'slitSpacingMm', label: 'Spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 }, { id: 'screenDistanceM', label: 'Distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }] },
    contextualArtifacts: [{ id: 'source-1', displayName: 'Source one', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }, { id: 'source-2', displayName: 'Source two', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }],
    consultationRules: [{ id: 'run', predicate: { kind: 'missing-run' }, layers: { observation: 'Observe.', plainLanguage: 'Run.', technicalDetail: 'Control.' }, nextStep: 'Record.' }, { id: 'source', predicate: { kind: 'missing-source', sourceId: 'source-1' }, layers: { observation: 'Source.', plainLanguage: 'Inspect.', technicalDetail: 'Provenance.' }, nextStep: 'Inspect.' }, { id: 'test', predicate: { kind: 'alternative-test', controlId: 'screenDistanceM' }, layers: { observation: 'Same.', plainLanguage: 'Change.', technicalDetail: 'Bounded.' }, nextStep: 'Change.' }, { id: 'limit', predicate: { kind: 'missing-limitation' }, layers: { observation: 'Limit.', plainLanguage: 'State.', technicalDetail: 'Bounded.' }, nextStep: 'Limit.' }],
    peerReviewRules: [{ id: 'missing', predicate: { kind: 'missing-evidence' }, feedback: 'More evidence.', revisionPath: 'Select.' }, { id: 'unsupported', predicate: { kind: 'unsupported-support' }, feedback: 'Unavailable.', revisionPath: 'Replace.' }, { id: 'overreach', predicate: { kind: 'overreach', overreachPhrases: ['proves'] }, feedback: 'Bound claim.', revisionPath: 'Revise.' }],
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

describe('consultation, peer review, and revision public flow', () => {
    it('retains authoritative evidence and appends an inspectable reviewed snapshot', () => {
        const store = createStore(createInitialAppState(definition));
        store.dispatch({ type: 'consultation.requested' });
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.recorded', prediction: 'A tentative pattern may appear.' });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-04T12:00:00.000Z' });
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-04T12:01:00.000Z' });
        const [first, second] = store.getState().runs;
        if (!first || !second) throw new Error('Physical fixture observations must be recorded.');
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-2' });
        store.dispatch({ type: 'comparison.noteSaved', note: 'The recorded spacing differs across these configurations.' });
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }));
        store.dispatch({ type: 'theory.conclusionSet', conclusion: 'This proves a conclusion.' });
        store.dispatch({ type: 'theory.limitationSet', limitation: 'Alternatives remain possible.' });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });
        const peerReview = selectPeerReview(store.getState());
        expect(peerReview?.status).toBe('reviewed');
        if (peerReview?.status === 'reviewed') expect(peerReview.issues.map((issue) => issue.code)).toEqual(['overreach']);
        expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-08-04T13:00:00.000Z' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().runs).toEqual([first, second]);
        expect(store.getState().comparison.selectedRunIds).toEqual(['run-1', 'run-2']);
        expect(selectDecisionHistory(store.getState())[0]).toMatchObject({ version: 1, selectedRunIds: ['run-1', 'run-2'], selectedSourceIds: ['source-1', 'source-2'] });
    });
});
