import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { dispatchControlValueFromDom } from '../../src/ui/apparatus/ApparatusControls';

const definition = {
    id: 'young-interference', version: '1.1.0', openingDispute: 'A dispute', prediction: { required: true },
    contextualArtifacts: [
        { id: 'young', displayName: 'Young source', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'young' }, rightsStatus: 'reviewed', caseRelationship: 'Context.' },
        { id: 'newton', displayName: 'Newton source', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'newton' }, rightsStatus: 'reviewed', caseRelationship: 'Context.' }
    ],
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    experiment: { modelVersion: 'young-double-slit-v1', wavelengthNm: 550, wavelengthComparison: { fixedMinimumPathNm: 550, advancedChoicesNm: [450, 650] }, assumptions: ['Monochromatic light.'], confound: { id: 'confound', description: 'A confound.', discoverableBy: 'replication' }, resetPath: { recoveryRoute: 'replication', description: 'Reset.' } },
    requirements: { minimumRuns: 2, minimumSources: 2 }, consultationRules: [], peerReviewRules: [],
    flow: { openingDispute: true, curatedRecord: true, labSetup: true, minimumExperimentCycles: 2, maximumExperimentCycles: 4, theoryBoardReview: true, historicalDebrief: true, optionalReplay: true },
    debrief: { summary: 'Compare.', sourceRefs: ['young'] }, assets: { manifestVersion: '1', entries: [] }
} as CaseDefinition;

const enterExperiment = (store: ReturnType<typeof createStore>): void => {
    store.dispatch({ type: 'source.inspected', sourceId: 'young' });
    store.dispatch({ type: 'source.inspected', sourceId: 'newton' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.recorded', prediction: 'Changing values changes spacing.' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
};

describe('authoritative Young experiment actions', () => {
    it('gates runs by phase and creates a frozen snapshot solely from current state', () => {
        const store = createStore(createInitialAppState(definition));
        const before = store.getState();
        expect(store.dispatch({ type: 'experiment.run', id: 'early', timestamp: '2026-08-05T10:00:00.000Z' })).toMatchObject({ ok: false, error: { code: 'experiment-phase-required' } });
        expect(store.getState()).toBe(before);
        enterExperiment(store);
        expect(store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-05T10:00:00.000Z' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().runs[0]).toMatchObject({ result: { label: 'Fringe spacing', value: 4.4, unit: 'mm' }, modelInputs: { slitSpacingMm: 0.25, screenDistanceM: 2, wavelengthNm: 550, wavelengthMode: 'minimum' } });
        expect(Object.isFrozen(store.getState().runs[0].modelInputs)).toBe(true);
    });

    it('unlocks optional authored wavelengths after two fixed runs and reset preserves saved evidence', () => {
        const store = createStore(createInitialAppState(definition));
        enterExperiment(store);
        expect(store.dispatch({ type: 'apparatus.wavelengthSet', wavelengthNm: 650 })).toMatchObject({ ok: false, error: { code: 'advanced-wavelength-locked' } });
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-05T10:00:00.000Z' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-05T10:00:01.000Z' });
        expect(store.dispatch({ type: 'apparatus.wavelengthSet', wavelengthNm: 650 })).toEqual({ ok: true, value: undefined });
        store.dispatch({ type: 'experiment.run', id: 'run-3', timestamp: '2026-08-05T10:00:02.000Z' });
        expect(store.dispatch({ type: 'apparatus.reset' })).toEqual({ ok: true, value: undefined });
        expect(store.getState()).toMatchObject({ activeControlValues: { slitSpacingMm: 0.25, screenDistanceM: 2 }, selectedWavelengthNm: 550, selectedWavelengthMode: 'minimum' });
        expect(store.getState().runs).toHaveLength(3);
        expect(store.getState().runs[2].modelInputs).toMatchObject({ wavelengthNm: 650, wavelengthMode: 'advanced' });
    });

    it('records byte-identical results after equivalent DOM and Phaser primary-control intents', () => {
        const domStore = createStore(createInitialAppState(definition));
        const phaserStore = createStore(createInitialAppState(definition));
        enterExperiment(domStore); enterExperiment(phaserStore);
        dispatchControlValueFromDom(domStore, 'slitSpacingMm', 0.15);
        dispatchControlValueFromDom(domStore, 'screenDistanceM', 3);
        const adapter = createPhaserStoreAdapter(phaserStore);
        adapter.setControlValue('slitSpacingMm', 0.15); adapter.setControlValue('screenDistanceM', 3);
        domStore.dispatch({ type: 'experiment.run', id: 'controlled', timestamp: '2026-08-05T10:00:00.000Z' });
        phaserStore.dispatch({ type: 'experiment.run', id: 'controlled', timestamp: '2026-08-05T10:00:00.000Z' });
        expect(JSON.stringify(domStore.getState().runs[0])).toBe(JSON.stringify(phaserStore.getState().runs[0]));
    });
});
