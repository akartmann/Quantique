import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectComparisonNote, selectNotebookObservations, selectSelectedComparisonPair } from '../../src/core/store/selectors';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

const caseDefinition = {
    id: 'young-interference',
    contextualArtifacts: [],
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    experiment: { modelVersion: 'young-observation-v1' }
} as CaseDefinition;

const fixtureRun = (id: string, controls: { slitSpacingMm: number; screenDistanceM: number }, value: number) => {
    const created = createRunRecord({
        id,
        caseId: 'young-interference',
        controls,
        result: { label: 'Prepared observation', value, unit: 'relative units' },
        timestamp: `2026-08-04T10:20:0${value}.000Z`,
        experimentModelVersion: 'young-observation-v1',
        linkedEvidenceIds: []
    });
    if (!created.ok) throw new Error('Fixture run must be valid.');
    return created.value;
};

describe('measurement notebook public store projection', () => {
    it('projects saved evidence and its pair note without recalculating historical values', () => {
        const store = createStore(createInitialAppState(caseDefinition));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.recorded', prediction: 'A patterned result may appear.' });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        const first = fixtureRun('run-001', { slitSpacingMm: 0.25, screenDistanceM: 2 }, 1);
        const second = fixtureRun('run-002', { slitSpacingMm: 0.3, screenDistanceM: 2.5 }, 2);
        store.dispatch({ type: 'run.record', record: first });
        store.dispatch({ type: 'run.record', record: second });

        store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.5, origin: 'dom' });
        expect(selectNotebookObservations(store.getState())).toMatchObject([
            { controls: { slitSpacingMm: 0.25, screenDistanceM: 2 }, result: { value: 1 }, experimentModelVersion: 'young-observation-v1' },
            { controls: { slitSpacingMm: 0.3, screenDistanceM: 2.5 }, result: { value: 2 }, experimentModelVersion: 'young-observation-v1' }
        ]);

        store.dispatch({ type: 'comparison.runSelected', runId: first.id });
        store.dispatch({ type: 'comparison.runSelected', runId: second.id });
        expect(selectSelectedComparisonPair(store.getState())).toEqual([first, second]);
        expect(store.dispatch({ type: 'comparison.noteSaved', note: 'Compare the two recorded values.' })).toEqual({ ok: true, value: undefined });
        expect(selectComparisonNote(store.getState())).toMatchObject({ text: 'Compare the two recorded values.' });
    });
});
