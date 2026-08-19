import { readFile } from 'node:fs/promises';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApparatusRenderer } from '../../src/adapters/phaser/renderers/ApparatusRenderer';
import { NotebookRenderer } from '../../src/adapters/phaser/renderers/NotebookRenderer';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import type { Locale } from '../../src/core/i18n/Locale';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';
import { makeSceneSlice, makeWindowStub } from './sceneSlice';

/**
 * **Wall 3: the bench spoke Young.** (Story 3.2, AC5.)
 *
 * `lab.idle` named `'slitSpacingMm'` and `'screenDistanceM'` as literals, and since the Story 3.1
 * review `selectFormattedControlValue` is *total* — it degrades rather than throwing. So for a case
 * authoring `rotationDeg`/`bathTempC` the bench read "The bench is dark at 0 slit spacing and 22 screen
 * distance", printing the rotation angle as a slit spacing. Nothing failed. The sentence was simply
 * false, which is exactly the defect shape a green suite keeps — and the reason these assertions are
 * on the rendered string rather than on a helper.
 *
 * Every assertion here is on what the **player reads**, in both shipped languages (AC6).
 */

let young: CaseDefinition;
let prototype: CaseDefinition;

const parse = async (caseId: string): Promise<CaseDefinition> => {
    const content: unknown = JSON.parse(await readFile(`public/cases/${caseId}/case.json`, 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error(`${caseId} must parse: ${JSON.stringify(parsed.error.issues)}`);
    return parsed.data as unknown as CaseDefinition;
};

beforeAll(async () => {
    young = await parse('young-interference');
    prototype = await parse('morley-miller');
});

const stub = makeWindowStub();
beforeEach(() => {
    stub.setReducedMotion(false);
    stub.setNarrowViewport(false);
    vi.stubGlobal('window', stub.window);
});

afterEach(() => { vi.unstubAllGlobals(); });

const storeAtTheBench = (definition: CaseDefinition, locale: Locale = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    return store;
};

const mount = (store: AppStore) => {
    const slice = makeSceneSlice();
    const renderer = new ApparatusRenderer(slice.scene, createPhaserStoreAdapter(store), { openNotebook: () => undefined });
    renderer.create();
    renderer.render(store.getState());
    return { ...slice, renderer };
};

describe('the bench states the case\'s own apparatus', () => {
    it('names the prototype\'s authored controls, and no Young quantity', () => {
        const ui = mount(storeAtTheBench(prototype));
        const idle = ui.texts().find((text) => text.includes('The bench is dark'));

        // `formatMeasurement` puts its locale separator before every unit, which is right for `°C` and
        // wrong for an arc degree. Shared with Young's rendering, so it is asserted as it is and
        // recorded as a typography gap for the bench work of Story 4.2 rather than changed here.
        expect(idle).toBe('The bench is dark at 0 ° Bench rotation, 22.0 °C Bath temperature. Start the light to record an observation.');
        expect(idle).not.toContain('slit spacing');
        expect(idle).not.toContain('screen distance');
    });

    it('still names Young\'s two quantities for Young', () => {
        const ui = mount(storeAtTheBench(young));
        const idle = ui.texts().find((text) => text.includes('The bench is dark'));

        expect(idle).toContain('Slit spacing');
        expect(idle).toContain('Screen distance');
    });

    it('states the prototype\'s controls in French', () => {
        const ui = mount(storeAtTheBench(prototype, 'fr'));
        const idle = ui.texts().find((text) => text.includes('La paillasse est éteinte'));

        expect(idle).toContain('Rotation du banc');
        expect(idle).toContain('Température du bain');
    });

    it('shows the investigation\'s own authored title in both languages', () => {
        expect(mount(storeAtTheBench(prototype)).texts()).toContain('Morley–Miller — the rotating interferometer');
        expect(mount(storeAtTheBench(prototype, 'fr')).texts()).toContain('Morley–Miller — l’interféromètre tournant');
        // Young keeps its own, which is now authored rather than an interface string.
        expect(mount(storeAtTheBench(young)).texts()).toContain('Young interference — the optical bench');
    });
});

describe('the bench reports a run it has no Young model inputs for', () => {
    const recordOneRun = (definition: CaseDefinition, locale: Locale = 'en'): AppStore => {
        const store = storeAtTheBench(definition, locale);
        const result = store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-19T10:00:00.000Z' });
        if (!result.ok) throw new Error(`The bench refused the run: ${result.error.code}`);
        return store;
    };

    /**
     * The readout was gated on `latest?.modelInputs`, so a recorded run without them fell through to
     * `lab.result.emptyHint`: the bench said nothing had been recorded over an observation that was
     * already in the notebook.
     */
    it('reports its own labelled, unit-carrying result instead of "nothing recorded yet"', () => {
        const ui = mount(recordOneRun(prototype));
        const texts = ui.texts();

        expect(texts).toContain('Recorded Fringe displacement: 0.11 fringe widths.');
        expect(texts.some((text) => text.includes('No fringe spacing recorded yet'))).toBe(false);
    });

    it('localizes that result label rather than printing the canonical English', () => {
        const ui = mount(recordOneRun(prototype, 'fr'));

        // `result.label` is canonical English in the record; the model declares the interface key.
        expect(ui.texts().some((text) => text.includes('Déplacement des franges enregistré'))).toBe(true);
        expect(ui.texts().some((text) => text.includes('Fringe displacement'))).toBe(false);
    });

    /**
     * The pattern line read a Young fringe spacing for whatever the run measured. It now reports the
     * run's own result, so it cannot describe a quantity this apparatus does not measure.
     */
    it('describes the pattern with the run\'s own quantity, not a fringe spacing', () => {
        const pattern = mount(recordOneRun(prototype)).texts().find((text) => text.includes('Recorded observation'));

        expect(pattern).toBe('Recorded observation: Fringe displacement of 0.11 fringe widths in the saved model result.');
    });

    it('keeps Young\'s wavelength sentence, which is the part that genuinely needs model inputs', () => {
        const texts = mount(recordOneRun(young)).texts();

        expect(texts.some((text) => text.includes('550 nm'))).toBe(true);
    });
});

/**
 * The bench notebook, for a case whose controls are not Young's (Story 3.2, AC5).
 *
 * `settingsLine` read `'slitSpacingMm'` and `'screenDistanceM'` as literals into a two-slot authored
 * row, with a total fallback behind them — so the prototype's notebook printed `slitSpacingMm —` beside
 * `screenDistanceM —` for every observation it held, while the observations themselves were correct.
 * Assigned to this story by the Story 3.1 review, and green until this file.
 */
describe('the notebook row states the case\'s own apparatus', () => {
    const mountNotebook = (definition: CaseDefinition, locale: Locale) => {
        const store = storeAtTheBench(definition, locale);
        const run = store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-19T10:00:00.000Z' });
        if (!run.ok) throw new Error(`The bench refused the run: ${run.error.code}`);
        const slice = makeSceneSlice();
        const notebook = new NotebookRenderer(slice.scene, createPhaserStoreAdapter(store), { onVisibilityChange: () => undefined });
        notebook.create();
        notebook.open();
        return slice;
    };

    it('lists the prototype\'s authored controls, and neither Young control id', () => {
        const texts = mountNotebook(prototype, 'en').texts();
        const settings = texts.find((text) => text.includes('Bench rotation'));

        expect(settings).toBe('Bench rotation: 0 ° · Bath temperature: 22.0 °C');
        expect(texts.some((text) => text.includes('slitSpacingMm'))).toBe(false);
        expect(texts.some((text) => text.includes('screenDistanceM'))).toBe(false);
        expect(texts.some((text) => text.includes('—'))).toBe(false);
    });

    it('still lists Young\'s two controls for Young', () => {
        const settings = mountNotebook(young, 'en').texts().find((text) => text.includes('Slit spacing'));

        expect(settings).toBe('Slit spacing: 0.25 mm · Screen distance: 2.00 m');
    });

    it('names the measured quantity in French rather than the canonical English', () => {
        const texts = mountNotebook(prototype, 'fr').texts();

        expect(texts.some((text) => text.includes('Déplacement des franges'))).toBe(true);
        expect(texts.some((text) => text.includes('Fringe displacement'))).toBe(false);
    });
});
