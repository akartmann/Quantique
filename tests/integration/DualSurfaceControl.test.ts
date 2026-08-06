import { describe, expect, it } from 'vitest';

import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectFormattedControlValue, selectRecognition } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';
import { dispatchControlValueFromDom } from '../../src/ui/apparatus/ApparatusControls';

const caseDefinition: CaseDefinition = {
    id: 'young-interference',
    version: '1.0.0',
    openingDispute: 'A dispute',
    contextualArtifacts: [
        {
            id: 'record', displayName: 'Record', creatorOrOrigin: 'Archive', sourceType: 'lecture-record',
            provenance: { category: 'primary-material', reference: 'record' }, rightsStatus: 'reviewed', caseRelationship: 'Context.'
        },
        {
            id: 'reference', displayName: 'Reference', creatorOrOrigin: 'Archive', sourceType: 'published-book',
            provenance: { category: 'primary-material', reference: 'reference' }, rightsStatus: 'reviewed', caseRelationship: 'Context.'
        }
    ],
    prediction: { required: true },
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    experiment: {
        modelVersion: 'young-double-slit-v1',
        wavelengthNm: 550,
        assumptions: [],
        confound: { id: 'confound', description: 'A confound', discoverableBy: 'replication' },
        resetPath: { recoveryRoute: 'replication', description: 'Recover.' }
    },
    requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    flow: { openingDispute: true, curatedRecord: true, labSetup: true, minimumExperimentCycles: 2, maximumExperimentCycles: 4, theoryBoardReview: true, historicalDebrief: true, optionalReplay: true },
    debrief: { summary: 'Compare evidence.', sourceRefs: ['record'] },
    assets: { manifestVersion: '1.0.0', entries: [] }
};

describe('dual-surface apparatus control', () => {
    it('leaves the same authoritative state and formatted readout after DOM and Phaser intents', () => {
        const initialState = createInitialAppState(caseDefinition);
        const domStore = createStore(initialState);
        const phaserStore = createStore(initialState);

        const seedEvidence = (store: typeof domStore, id: string, timestamp: string) => {
            if (store.getState().phase === 'context') {
                ['record', 'reference'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
                store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
                store.dispatch({ type: 'prediction.recorded', prediction: 'A patterned result may appear.' });
                store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
            }
            const record = createRunRecord({
                id, caseId: 'young-interference', controls: store.getState().activeControlValues,
                result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp,
                experimentModelVersion: 'young-double-slit-v1', linkedEvidenceIds: ['record', 'reference']
            });
            if (!record.ok) throw new Error('Fixture run must be valid.');
            expect(store.dispatch({ type: 'run.record', record: record.value })).toEqual({ ok: true, value: undefined });
        };

        seedEvidence(domStore, 'dom-first', '2026-08-05T10:00:00.000Z');
        seedEvidence(phaserStore, 'phaser-first', '2026-08-05T10:00:00.000Z');

        expect(dispatchControlValueFromDom(domStore, 'slitSpacingMm', 0.23)).toEqual({ ok: true, value: undefined });
        expect(createPhaserStoreAdapter(phaserStore).setControlValue('slitSpacingMm', 0.23)).toEqual({ ok: true, value: undefined });
        seedEvidence(domStore, 'dom-second', '2026-08-05T10:00:01.000Z');
        seedEvidence(phaserStore, 'phaser-second', '2026-08-05T10:00:01.000Z');

        expect(domStore.getState().activeControlValues).toEqual(phaserStore.getState().activeControlValues);
        expect(selectFormattedControlValue(domStore.getState(), 'slitSpacingMm')).toBe('0.25 mm');
        expect(selectFormattedControlValue(phaserStore.getState(), 'slitSpacingMm')).toBe('0.25 mm');
        expect(selectRecognition(domStore.getState())).toEqual(selectRecognition(phaserStore.getState()));
        expect(selectRecognition(domStore.getState()).items.find(({ id }) => id === 'replication')).toMatchObject({ achieved: true });
    });
});
