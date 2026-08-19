import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';

const definition = {
    // Story 2.12 removed the free-text `prediction.recorded` / `theory.conclusionSet` /
    // `theory.limitationSet` actions, so a fixture that seeds a prediction or a conclusion has to
    // carry the authored proposals the surviving actions choose from. Four of each, because
    // `.length(4)` is the design rather than a minimum.
    predictionProposals: [0, 1, 2, 3].map((index) => ({
        id: `prediction-${index}`,
        colleagueId: 'colleague-1',
        text: { en: `A patterned result may appear (${index}).`, fr: `Un résultat structuré pourrait apparaître (${index}).` }
    })),
    conclusionProposals: [0, 1, 2, 3].map((index) => ({
        id: `conclusion-${index}`,
        colleagueId: 'colleague-1',
        // Index 1 is deliberately overreaching: `peerReviewRules`' `overreach` predicate matches an
        // authored phrase ("proves" / "prouve"), and the free-text conclusions that used to trigger it
        // are gone. A fixture that could not produce a finding would make every peer-review test pass
        // by having nothing to review.
        claim: index === 1
            ? { en: 'The evidence proves a bounded result.', fr: 'Les preuves prouvent un résultat délimité.' }
            : { en: `The observations support a bounded conclusion (${index}).`, fr: `Les observations étayent une conclusion délimitée (${index}).` },
        limitation: { en: `The observations leave alternative explanations open (${index}).`, fr: `Les observations laissent ouvertes d'autres explications (${index}).` },
        supportPredicate: { kind: 'minimum-runs', count: 1 }
    })),
    id: 'young-interference', version: '1.1.0', openingDispute: 'A dispute', prediction: { required: true },
    contextualArtifacts: [
        { id: 'young', displayName: 'Young source', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'young' }, rightsStatus: 'reviewed', caseRelationship: 'Context.' },
        { id: 'newton', displayName: 'Newton source', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'newton' }, rightsStatus: 'reviewed', caseRelationship: 'Context.' }
    ],
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    experiment: { modelId: 'young-double-slit', modelVersion: 'young-double-slit-v1', wavelengthNm: 550, wavelengthComparison: { fixedMinimumPathNm: 550, advancedChoicesNm: [450, 650] }, assumptions: ['Monochromatic light.'], confound: { id: 'confound', description: 'A confound.', discoverableBy: 'replication' }, resetPath: { recoveryRoute: 'replication', description: 'Reset.' } },
    requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [], consultationRules: [], peerReviewRules: [],
    flow: { openingDispute: true, curatedRecord: true, labSetup: true, minimumExperimentCycles: 2, maximumExperimentCycles: 4, theoryBoardReview: true, historicalDebrief: true, optionalReplay: true },
    debrief: { summary: 'Compare.', sourceRefs: ['young'] }, assets: { manifestVersion: '1', entries: [] }
} as CaseDefinition;

const enterExperiment = (store: ReturnType<typeof createStore>): void => {
    store.dispatch({ type: 'source.inspected', sourceId: 'young' });
    store.dispatch({ type: 'source.inspected', sourceId: 'newton' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
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

    /**
     * The record is a pure function of the values, not of which path set them.
     *
     * This used to compare a `dispatchControlValueFromDom` store against a `PhaserStoreAdapter` one —
     * the DOM-parity contract ADR-001 v1.1 retired on 2026-08-05, and `ApparatusControls.ts` is deleted
     * (Story 2.12). The **live** property it was really pinning survives and is worth keeping: the
     * `origin` field the two paths differ by must not reach the run record, or a run recorded by drag
     * would fail to compare with one recorded by keyboard. The pointer-versus-keyboard half of the same
     * rule (ADR-012) is covered on the bench by `ApparatusRun.test.ts`.
     */
    it('records byte-identical results however the control values were set', () => {
        const viaAdapter = createStore(createInitialAppState(definition));
        const viaAction = createStore(createInitialAppState(definition));
        enterExperiment(viaAdapter); enterExperiment(viaAction);
        createPhaserStoreAdapter(viaAdapter).setControlValue('slitSpacingMm', 0.15);
        createPhaserStoreAdapter(viaAdapter).setControlValue('screenDistanceM', 3);
        viaAction.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.15, origin: 'dom' });
        viaAction.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });
        viaAdapter.dispatch({ type: 'experiment.run', id: 'controlled', timestamp: '2026-08-05T10:00:00.000Z' });
        viaAction.dispatch({ type: 'experiment.run', id: 'controlled', timestamp: '2026-08-05T10:00:00.000Z' });
        expect(JSON.stringify(viaAdapter.getState().runs[0])).toBe(JSON.stringify(viaAction.getState().runs[0]));
    });
});
