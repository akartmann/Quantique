import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectDecisionHistory, selectPeerReview } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';

const definition = {
    id: 'young-interference', requirements: { minimumRuns: 2, minimumSources: 2 },
    apparatus: { primaryControls: [{ id: 'slitSpacingMm', label: 'Spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 }, { id: 'screenDistanceM', label: 'Distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }] },
    contextualArtifacts: [{ id: 'source-1', displayName: 'Source one', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }, { id: 'source-2', displayName: 'Source two', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }],
    consultationRules: [{ id: 'run', predicate: { kind: 'missing-run' }, layers: { observation: 'Observe.', plainLanguage: 'Run.', technicalDetail: 'Control.' }, nextStep: 'Record.' }, { id: 'source', predicate: { kind: 'missing-source', sourceId: 'source-1' }, layers: { observation: 'Source.', plainLanguage: 'Inspect.', technicalDetail: 'Provenance.' }, nextStep: 'Inspect.' }, { id: 'test', predicate: { kind: 'alternative-test', controlId: 'screenDistanceM' }, layers: { observation: 'Same.', plainLanguage: 'Change.', technicalDetail: 'Bounded.' }, nextStep: 'Change.' }, { id: 'limit', predicate: { kind: 'missing-limitation' }, layers: { observation: 'Limit.', plainLanguage: 'State.', technicalDetail: 'Bounded.' }, nextStep: 'Limit.' }],
    peerReviewRules: [{ id: 'missing', predicate: { kind: 'missing-evidence' }, feedback: 'More evidence.', revisionPath: 'Select.' }, { id: 'unsupported', predicate: { kind: 'unsupported-support' }, feedback: 'Unavailable.', revisionPath: 'Replace.' }, { id: 'overreach', predicate: { kind: 'overreach', overreachPhrases: ['proves'] }, feedback: 'Bound claim.', revisionPath: 'Revise.' }],
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

const makeRun = (id: string, screenDistanceM: number) => {
    const result = createRunRecord({ id, caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM }, result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: '2026-08-04T12:00:00.000Z', experimentModelVersion: 'young-v1', linkedEvidenceIds: ['source-1', 'source-2'] });
    if (!result.ok) throw new Error('valid run fixture required');
    return result.value;
};

describe('consultation, peer review, and revision public flow', () => {
    it('retains authoritative evidence and appends an inspectable reviewed snapshot', () => {
        const store = createStore(createInitialAppState(definition));
        store.dispatch({ type: 'consultation.requested' });
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        const first = makeRun('run-1', 2);
        const second = makeRun('run-2', 3);
        store.dispatch({ type: 'run.record', record: first });
        store.dispatch({ type: 'run.record', record: second });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-2' });
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }));
        store.dispatch({ type: 'theory.conclusionSet', conclusion: 'This proves a conclusion.' });
        store.dispatch({ type: 'theory.limitationSet', limitation: 'Alternatives remain possible.' });
        ['prediction', 'experiment', 'synthesis'].forEach((nextPhase) => store.dispatch({ type: 'case.phaseAdvance', nextPhase }));
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });
        expect(selectPeerReview(store.getState())?.issues.map((issue) => issue.code)).toEqual(['overreach']);
        expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-08-04T13:00:00.000Z' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().runs).toEqual([first, second]);
        expect(store.getState().comparison.selectedRunIds).toEqual(['run-1', 'run-2']);
        expect(selectDecisionHistory(store.getState())[0]).toMatchObject({ version: 1, selectedRunIds: ['run-1', 'run-2'], selectedSourceIds: ['source-1', 'source-2'] });
    });
});
