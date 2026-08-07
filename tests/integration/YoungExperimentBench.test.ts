import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createPhaserStoreAdapter, type PhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import {
    selectAdvancedWavelengthUnlocked,
    selectComparisonNote,
    selectNotebookObservations,
    selectSelectedComparisonPair,
    selectSignificantMeasureGate,
    selectWavelengthChoices
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The whole bench loop — set up, start the light, compare, annotate, unlock the comparison — through
 * the **canvas's own public surface** (Story 2.10, AC10).
 *
 * Driven through `PhaserStoreAdapter` rather than through raw actions, deliberately. The adapter is
 * what the bench actually calls, and it is where the run's id and timestamp are stamped and where "one
 * dispatch per press" is decided. A test that dispatched `experiment.run` directly would prove the
 * reducer works and say nothing about whether the surface can reach it — which is exactly the gap
 * ADR-011 exists for and how nine intents came to be unreachable while every unit test stayed green.
 *
 * Built from the authored Young case rather than a fixture, as `RivalLabCritique.test.ts` is: the
 * significance rule, the authored bounds and the wavelength gate all have to agree with each other in
 * the content that ships.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

const benchAdapter = (): Readonly<{ store: AppStore; bench: PhaserStoreAdapter }> => {
    const store = createStore(createInitialAppState(definition));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    return { store, bench: createPhaserStoreAdapter(store) };
};

/** Two authored screen distances that are genuinely different, read rather than written down. */
const twoThrows = (): readonly [number, number] => {
    const screen = definition.apparatus.primaryControls.find(({ id }) => id === 'screenDistanceM');
    if (!screen) throw new Error('The authored case must carry a screen-distance control.');
    return [screen.min, screen.max];
};

describe('starting the light from the bench', () => {
    it('records an observation with one dispatch, and stamps its own id and time', () => {
        const { store, bench } = benchAdapter();

        expect(bench.runExperiment().ok).toBe(true);

        const [saved, ...rest] = selectNotebookObservations(store.getState());
        expect(rest).toEqual([]);
        expect(saved!.id).toMatch(/[0-9a-f-]{36}/);
        expect(Number.isNaN(Date.parse(saved!.timestamp))).toBe(false);
        expect(saved!.caseId).toBe(definition.id);
    });

    it('refuses to start outside the experiment phase, and says which refusal it is', () => {
        const store = createStore(createInitialAppState(definition));
        const bench = createPhaserStoreAdapter(store);

        const refusal = bench.runExperiment();

        expect(refusal.ok).toBe(false);
        expect(!refusal.ok && refusal.error.code).toBe('experiment-phase-required');
        expect(selectNotebookObservations(store.getState())).toEqual([]);
    });

    it('opens the significant-measure gate with two observations at different throws', () => {
        const { store, bench } = benchAdapter();
        const [near, far] = twoThrows();

        bench.setControlValue('screenDistanceM', near);
        bench.runExperiment();
        expect(selectSignificantMeasureGate(store.getState()).isMet).toBe(false);

        bench.setControlValue('screenDistanceM', far);
        bench.runExperiment();

        const gate = selectSignificantMeasureGate(store.getState());
        expect(gate.isMet).toBe(true);
        expect(gate.count).toBeGreaterThanOrEqual(gate.required);
    });

    it('does not count a replication at the same setting as a second significant measure', () => {
        // The reason the e2e walk has to change the throw between its two runs, pinned here so the
        // walk is not the only thing that knows it.
        const { store, bench } = benchAdapter();
        const [near] = twoThrows();

        bench.setControlValue('screenDistanceM', near);
        bench.runExperiment();
        bench.runExperiment();

        expect(selectNotebookObservations(store.getState())).toHaveLength(2);
        expect(selectSignificantMeasureGate(store.getState()).isMet).toBe(false);
    });
});

describe('the bench notebook', () => {
    it('round-trips a comparison pair and the note saved against it', () => {
        const { store, bench } = benchAdapter();
        const [near, far] = twoThrows();
        bench.setControlValue('screenDistanceM', near);
        bench.runExperiment();
        bench.setControlValue('screenDistanceM', far);
        bench.runExperiment();
        const [first, second] = selectNotebookObservations(store.getState());

        expect(bench.selectComparisonRun(first!.id).ok).toBe(true);
        expect(bench.selectComparisonRun(second!.id).ok).toBe(true);
        expect(selectSelectedComparisonPair(store.getState())).toEqual([first, second]);

        expect(bench.saveComparisonNote('The bands spread as the screen moves back.').ok).toBe(true);
        expect(selectComparisonNote(store.getState())).toMatchObject({
            text: 'The bands spread as the screen moves back.'
        });

        // Taking one back out leaves the pair incomplete, and the note is no longer the note *of* a
        // pair — the surface must not offer to save against one observation.
        expect(bench.unselectComparisonRun(second!.id).ok).toBe(true);
        expect(selectSelectedComparisonPair(store.getState())).toBeUndefined();
        expect(bench.saveComparisonNote('Half a comparison.').ok).toBe(false);
    });

    it('refuses a blank note rather than saving an empty comparison', () => {
        const { store, bench } = benchAdapter();
        const [near, far] = twoThrows();
        bench.setControlValue('screenDistanceM', near);
        bench.runExperiment();
        bench.setControlValue('screenDistanceM', far);
        bench.runExperiment();
        const [first, second] = selectNotebookObservations(store.getState());
        bench.selectComparisonRun(first!.id);
        bench.selectComparisonRun(second!.id);

        const refusal = bench.saveComparisonNote('   ');

        expect(refusal.ok).toBe(false);
        expect(!refusal.ok && refusal.error.code).toBe('invalid-comparison-note');
    });

    it('never recalculates a saved observation when the setup moves on', () => {
        const { store, bench } = benchAdapter();
        const [near, far] = twoThrows();
        bench.setControlValue('screenDistanceM', near);
        bench.runExperiment();
        const saved = { ...selectNotebookObservations(store.getState())[0]! };

        bench.setControlValue('screenDistanceM', far);
        bench.setControlValue('slitSpacingMm', 0.5);

        expect(selectNotebookObservations(store.getState())[0]).toEqual(saved);
    });
});

describe('the optional wavelength comparison', () => {
    it('offers the authored choices, minimum path first', () => {
        const { store } = benchAdapter();
        const comparison = definition.experiment.wavelengthComparison;
        expect(comparison).toBeDefined();

        expect(selectWavelengthChoices(store.getState())).toEqual([
            { wavelengthNm: comparison!.fixedMinimumPathNm, mode: 'minimum' },
            ...comparison!.advancedChoicesNm.map((wavelengthNm) => ({ wavelengthNm, mode: 'advanced' }))
        ]);
    });

    it('is locked until the authored number of minimum-path observations exist, then opens', () => {
        const { store, bench } = benchAdapter();
        const advanced = definition.experiment.wavelengthComparison!.advancedChoicesNm[0]!;
        const [near, far] = twoThrows();

        expect(selectAdvancedWavelengthUnlocked(store.getState())).toBe(false);
        const early = bench.setWavelength(advanced as 450 | 650);
        expect(early.ok).toBe(false);
        expect(!early.ok && early.error.code).toBe('advanced-wavelength-locked');

        bench.setControlValue('screenDistanceM', near);
        bench.runExperiment();
        bench.setControlValue('screenDistanceM', far);
        bench.runExperiment();

        expect(selectAdvancedWavelengthUnlocked(store.getState())).toBe(true);
        expect(bench.setWavelength(advanced as 450 | 650).ok).toBe(true);
        expect(store.getState().selectedWavelengthMode).toBe('advanced');

        // 550 is always permitted and is the reset path back to the minimum-path history.
        expect(bench.setWavelength(550).ok).toBe(true);
        expect(store.getState().selectedWavelengthMode).toBe('minimum');
    });

    it('leaves the fixed 550 nm history untouched when a comparison is run', () => {
        const { store, bench } = benchAdapter();
        const [near, far] = twoThrows();
        bench.setControlValue('screenDistanceM', near);
        bench.runExperiment();
        bench.setControlValue('screenDistanceM', far);
        bench.runExperiment();
        const minimumPath = selectNotebookObservations(store.getState()).map((run) => ({ ...run }));

        bench.setWavelength(definition.experiment.wavelengthComparison!.advancedChoicesNm[0]! as 450 | 650);
        bench.runExperiment();

        const after = selectNotebookObservations(store.getState());
        expect(after.slice(0, 2)).toEqual(minimumPath);
        expect(after[2]!.modelInputs?.wavelengthMode).toBe('advanced');
        // And the gate the comparison unlocked stays unlocked on the strength of the two that earned it.
        expect(selectAdvancedWavelengthUnlocked(store.getState())).toBe(true);
    });
});

/**
 * `apparatus.reset` reaching the canvas at last (Story 2.12, D3 / AC8).
 *
 * It is driven through `PhaserStoreAdapter` for the reason this file's header gives: until Story 2.12
 * the only dispatcher was the retired `src/ui/apparatus/ApparatusControls.ts`, so the reducer was
 * correct and the intent was unreachable — the exact shape ADR-011 exists to catch. Story 2.2 is `done`
 * with the acceptance criterion these assertions restate.
 */
describe('resetting the apparatus from the bench', () => {
    /** The authored defaults, read from the case rather than written down. */
    const defaults = (): Readonly<Record<string, number>> => Object.fromEntries(
        definition.apparatus.primaryControls.map(({ id, defaultValue }) => [id, defaultValue])
    );

    it('puts every primary control and the wavelength back to what the case authored', () => {
        const { store, bench } = benchAdapter();
        const [, far] = twoThrows();
        bench.setControlValue('screenDistanceM', far);
        bench.runExperiment();
        bench.runExperiment();
        bench.setWavelength(definition.experiment.wavelengthComparison!.advancedChoicesNm[0]! as 450 | 650);
        expect(store.getState().activeControlValues).not.toEqual(defaults());

        expect(bench.resetApparatus().ok).toBe(true);

        expect(store.getState().activeControlValues).toEqual(defaults());
        expect(store.getState().selectedWavelengthNm).toBe(550);
        expect(store.getState().selectedWavelengthMode).toBe('minimum');
    });

    /** Story 2.2's criterion in as many words: immediate, and it erases no saved observation. */
    it('erases no saved observation and no evidence the player has gathered', () => {
        const { store, bench } = benchAdapter();
        const [near, far] = twoThrows();
        bench.setControlValue('screenDistanceM', near);
        bench.runExperiment();
        bench.setControlValue('screenDistanceM', far);
        bench.runExperiment();
        const saved = selectNotebookObservations(store.getState()).map((run) => ({ ...run }));
        const inspected = [...store.getState().inspectedSourceIds];

        bench.resetApparatus();

        expect(selectNotebookObservations(store.getState())).toEqual(saved);
        expect(store.getState().inspectedSourceIds).toEqual(inspected);
        expect(store.getState().selectedPredictionProposalId).toBeDefined();
        expect(store.getState().prediction).not.toBe('');
        // And the gate those two observations earned is still open: reset is a setup change, not a
        // retraction of evidence.
        expect(selectSignificantMeasureGate(store.getState()).isMet).toBe(true);
        expect(selectAdvancedWavelengthUnlocked(store.getState())).toBe(true);
    });

    /**
     * The reducer clears no colleague state, and this pins that it stays that way.
     *
     * 2.10 found `apparatus.wavelengthSet` discarding a standing consultation, a peer review and a
     * rival-lab critique on a click that changed nothing — the reducer is entitled to, because a new
     * run invalidates the feedback, but reset changes no recorded evidence and so invalidates nothing.
     */
    it('leaves a standing consultation alone, because it invalidates no evidence', () => {
        const { store, bench } = benchAdapter();
        expect(store.dispatch({ type: 'consultation.requested' }).ok).toBe(true);
        const consultation = store.getState().consultation;
        expect(consultation).toBeDefined();

        bench.resetApparatus();

        expect(store.getState().consultation).toEqual(consultation);
    });
});
