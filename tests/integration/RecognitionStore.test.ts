import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectRecognition } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';

const definition = {
    id: 'young-interference',
    contextualArtifacts: [
        { id: 'source-1', displayName: 'Source one', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'source-2', displayName: 'Source two', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ],
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

const record = (id: string, screenDistanceM: number) => {
    const created = createRunRecord({
        id, caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM },
        result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: `2026-08-05T10:00:0${id.at(-1)}.000Z`,
        experimentModelVersion: 'young-v1', linkedEvidenceIds: ['source-1', 'source-2']
    });
    if (!created.ok) throw new Error('Fixture run must be valid.');
    return created.value;
};

describe('inquiry recognition store projection', () => {
    it('recomputes recognition only for successful authoritative transitions without changing case authority', () => {
        const store = createStore(createInitialAppState(definition));
        const initialPhase = store.getState().phase;
        const initialHistory = store.getState().decisionHistory;

        store.dispatch({ type: 'source.inspected', sourceId: 'source-1' });
        store.dispatch({ type: 'source.inspected', sourceId: 'source-2' });
        store.dispatch({ type: 'run.record', record: record('run-1', 2) });
        store.dispatch({ type: 'run.record', record: record('run-2', 2) });
        store.dispatch({ type: 'run.record', record: record('run-3', 3) });

        expect(selectRecognition(store.getState()).items.map(({ id, achieved }) => [id, achieved])).toEqual([
            ['source-discipline', true], ['replication', true], ['variable-curiosity', true], ['calibrated-conclusion', false]
        ]);
        expect(store.getState().phase).toBe(initialPhase);
        expect(store.getState().decisionHistory).toEqual(initialHistory);
        const recognition = store.getState().recognition;
        expect(store.dispatch({ type: 'source.inspected', sourceId: 'source-2' })).toMatchObject({ ok: false, error: { code: 'duplicate-inspected-source' } });
        expect(store.getState().recognition).toBe(recognition);
    });
});
