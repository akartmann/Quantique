import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import {
    selectCasePhase,
    selectConclusionReadiness,
    selectSelectedComparisonPair,
    selectSelectedSupportingRuns,
    selectSelectedSupportingSources
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';

const definition = {
    id: 'young-interference', requirements: { minimumRuns: 2, minimumSources: 2 },
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'source-1', displayName: 'First source', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'first' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'source-2', displayName: 'Second source', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'second' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ], experiment: { modelVersion: 'young-observation-v1' }
} as CaseDefinition;

const fixtureRun = (id: string, linkedEvidenceIds: readonly string[]) => {
    const result = createRunRecord({
        id, caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
        result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: '2026-08-04T12:00:00.000Z',
        experimentModelVersion: 'young-observation-v1', linkedEvidenceIds
    });
    if (!result.ok) throw new Error('Fixture run must be valid.');
    return result.value;
};

describe('theory board public projection', () => {
    it('recovers from incomplete evidence, keeps theory support independent from comparison, and submits from synthesis', () => {
        const store = createStore(createInitialAppState(definition));
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toMatchObject({
            ok: false,
            error: { code: 'conclusion-not-ready' }
        });
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        const first = fixtureRun('run-1', ['source-1']);
        const second = fixtureRun('run-2', ['source-1', 'source-2']);
        store.dispatch({ type: 'run.record', record: first });
        store.dispatch({ type: 'run.record', record: second });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-2' });

        store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-2' });
        store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' });
        store.dispatch({ type: 'theory.supportSourceSelected', sourceId: 'source-2' });
        store.dispatch({ type: 'theory.supportSourceSelected', sourceId: 'source-1' });
        store.dispatch({ type: 'theory.conclusionSet', conclusion: 'The observations support a bounded conclusion.' });
        store.dispatch({ type: 'theory.limitationSet', limitation: 'The observations leave alternative explanations open.' });

        expect(selectSelectedSupportingRuns(store.getState())).toEqual([second, first]);
        expect(selectSelectedSupportingSources(store.getState()).map(({ id }) => id)).toEqual(['source-2', 'source-1']);
        expect(selectSelectedComparisonPair(store.getState())).toEqual([first, second]);
        expect(store.getState().runs).toEqual([first, second]);
        expect(selectConclusionReadiness(store.getState())).toMatchObject({ status: 'ready' });
        ['prediction', 'experiment', 'synthesis'].forEach((nextPhase) => {
            expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase })).toEqual({ ok: true, value: undefined });
        });
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
        expect(selectCasePhase(store.getState())).toBe('review');
    });
});
