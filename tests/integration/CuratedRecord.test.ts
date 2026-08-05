import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectContextualArtifacts, selectInspectedSourceIds, selectNotebookObservations } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createCalculatedRunRecord } from '../../src/domain/evidence/RunRecord';

const caseDefinition = {
    id: 'young-interference',
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    contextualArtifacts: [
        {
            id: 'young-lecture-1801', displayName: 'Young lecture record', creatorOrOrigin: 'Thomas Young', sourceType: 'lecture-record',
            provenance: { category: 'primary-material', reference: 'young-1801-lecture' }, rightsStatus: 'reviewed', caseRelationship: 'Contemporary record.'
        },
        {
            id: 'newton-opticks', displayName: 'Opticks reference', creatorOrOrigin: 'Isaac Newton', sourceType: 'published-book',
            provenance: { category: 'primary-material', reference: 'newton-opticks-1704' }, rightsStatus: 'reviewed', caseRelationship: 'Earlier context.'
        }
    ],
    experiment: { modelVersion: 'young-observation-v1' }
} as CaseDefinition;

const prepareRun = (store: ReturnType<typeof createStore>, id: string) => createCalculatedRunRecord({
    id,
    caseId: store.getState().caseDefinition.id,
    controls: store.getState().activeControlValues,
    timestamp: '2026-08-04T12:00:00.000Z',
    experimentModelVersion: store.getState().caseDefinition.experiment.modelVersion,
    linkedEvidenceIds: store.getState().inspectedSourceIds,
    calculateResult: () => ({ ok: true, value: { label: 'Prepared observation', value: 1, unit: 'relative units' } })
}, store.getState().runs.map(({ id: runId }) => runId));

describe('Curated Record public evidence flow', () => {
    it('projects validated source labels and snapshots inspected evidence only into later runs', () => {
        const store = createStore(createInitialAppState(caseDefinition));

        expect(selectContextualArtifacts(store.getState()).map(({ displayName }) => displayName)).toEqual([
            'Young lecture record', 'Opticks reference'
        ]);
        const earlier = prepareRun(store, 'run-001');
        expect(earlier).toMatchObject({ ok: true, value: { linkedEvidenceIds: [] } });
        if (!earlier.ok) throw new Error('Fixture run must be valid.');
        expect(store.dispatch({ type: 'source.inspected', sourceId: 'young-lecture-1801' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'source.inspected', sourceId: 'newton-opticks' })).toEqual({ ok: true, value: undefined });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'run.record', record: earlier.value });
        const later = prepareRun(store, 'run-002');
        if (!later.ok) throw new Error('Fixture run must be valid.');
        store.dispatch({ type: 'run.record', record: later.value });

        expect(selectInspectedSourceIds(store.getState())).toEqual(['young-lecture-1801', 'newton-opticks']);
        expect(selectNotebookObservations(store.getState())).toMatchObject([
            { id: 'run-001', linkedEvidenceIds: [] },
            { id: 'run-002', linkedEvidenceIds: ['young-lecture-1801', 'newton-opticks'] }
        ]);
    });
});
