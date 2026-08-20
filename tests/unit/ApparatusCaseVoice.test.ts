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
import { FRINGE_LAYER_NAME } from '../../src/adapters/phaser/renderers/benchTableau';
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

        // The **inline** forms — lowercase, and in French carrying their own preposition and elision.
        // This asserted the capitalised *display* labels spliced mid-sentence until the review of 3.2,
        // which is what the sentence actually rendered and what made the French ungrammatical; the row
        // pinned the defect rather than the intent (review 2026-08-19).
        //
        // **`0°`, not `0 °` (Story 4.2, AC5).** The two paragraphs that stood here said `formatMeasurement`
        // writes its separator before every unit, that this is wrong for an arc degree, and that the row
        // therefore pinned the defect and left it to this story — twice, verbatim, in the same test. The
        // separator is now a function of `(locale, unit)`, so the row states the intent instead of the
        // defect. `°C` keeps its separator, which is the near-miss the classifier has to survive and
        // which this same line asserts.
        expect(idle).toBe(`The bench is dark at 0° bench rotation, 22.0\u00A0°C bath temperature. Start the light to record an observation.`);
        expect(idle).not.toContain('slit spacing');
        expect(idle).not.toContain('screen distance');
        // No capital reaches the middle of the sentence.
        expect(idle).not.toContain('Bench rotation');
        expect(idle).not.toContain('Bath temperature');
    });

    it('still names Young\'s two quantities for Young', () => {
        const ui = mount(storeAtTheBench(young));
        const idle = ui.texts().find((text) => text.includes('The bench is dark'));

        // Young's own inline forms, on content that had already shipped: the composed sentence is the
        // one surface where the display labels were wrong, and this is the regression that caught it.
        expect(idle).toBe(`The bench is dark at 0.25\u00A0mm slit spacing, 2.00\u00A0m screen distance. Start the light to record an observation.`);
    });

    it('states the prototype\'s controls in French', () => {
        const ui = mount(storeAtTheBench(prototype, 'fr'));
        const idle = ui.texts().find((text) => text.includes('La paillasse est éteinte'));

        // The whole composed sentence, in French, asserted exactly — not two `toContain`s that a
        // capital and a missing elision both slipped through. "de Écartement des fentes" was the shipped
        // output for Young; correct French needs the preposition authored with the label.
        // `\u202f` is the narrow no-break space `formatMeasurement` puts before a **symbol** unit in
        // French. Written as an escape so the expectation cannot be silently "fixed" by pasting an
        // ordinary space. The arc degree now takes **no** separator in French either (Story 4.2, AC5):
        // `0°`, not `0\u202f°`. Both rules are on this one line, which is why it is asserted whole.
        expect(idle).toBe('La paillasse est éteinte : 0° de rotation du banc, 22,0\u202f°C de température du bain. Allumez la source pour enregistrer une observation.');
        expect(idle).not.toContain('de Rotation');
        expect(idle).not.toContain('de Température');
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
     * **The screen, not the sentence.** (Review 2026-08-19.)
     *
     * `paintFringes()` has one call site, inside `renderApparatusGeometry`, which returned at its
     * `!Number.isFinite(slitSpacing)` guard before reaching it — while `paintLight`'s `dark` flag had
     * already decided the bench was lit. A prototype run therefore played a full 2.4 s ignition, beam
     * and wavefronts included, and resolved onto a `fringeGraphics` nothing had filled. 1334 tests were
     * green: every bench test in this file asserts `texts()`, and the e2e walk states in its own header
     * that it asserts no rendered string.
     *
     * `commands` counts fill/stroke calls issued since the last `clear()`, so "the screen is blank" is
     * an assertion here rather than a screenshot.
     */
    it('paints the prototype\'s screen after a run, not just its readout', () => {
        const ui = mount(recordOneRun(prototype));
        const fringes = ui.named(FRINGE_LAYER_NAME)!;

        expect(fringes.state.commands).toBeGreaterThan(0);
        expect(fringes.state.visible).toBe(true);
    });

    it('leaves the prototype\'s screen blank until a run is recorded', () => {
        const ui = mount(storeAtTheBench(prototype));
        const fringes = ui.named(FRINGE_LAYER_NAME)!;

        expect(fringes.state.commands).toBe(0);
    });

    it('still paints Young\'s screen from its own recorded spacing', () => {
        const ui = mount(recordOneRun(young));
        const fringes = ui.named(FRINGE_LAYER_NAME)!;

        expect(fringes.state.commands).toBeGreaterThan(0);
    });

    /**
     * The guard on the three rows above, and the reason they name the layer instead of indexing it.
     *
     * They read `ofKind('graphics')[0]` and called it the fringe graphics. That was true while the
     * laboratory drew one apparatus; Story 4.2 gave the prototype its own tableau, whose temperature bath
     * is created first — and the bath is painted whether or not a run exists, so *"the screen is blank
     * until a run is recorded"* began measuring an object that is never blank. It failed, which is the
     * only reason this was caught rather than shipped as coverage of nothing.
     *
     * So this asserts that the named layer really is a distinct object from the first graphics on the
     * prototype's bench. Without it, `named()` could quietly start returning the same thing an index
     * would and the lesson would be lost.
     */
    it('finds the fringe layer at a different index on each case, which is why it is named', () => {
        const forPrototype = mount(recordOneRun(prototype));
        const forYoung = mount(recordOneRun(young));

        // Young's fringe field is still the first graphics its tableau creates; the prototype's is not,
        // because its temperature bath is created before it. **One written-down index cannot be right for
        // both**, which is the whole finding — and the bath is painted with or without a run, so the index
        // that stayed put silently pointed the "blank until recorded" assertion at a never-blank object.
        expect(forYoung.named(FRINGE_LAYER_NAME)).toBe(forYoung.ofKind('graphics')[0]);
        expect(forPrototype.named(FRINGE_LAYER_NAME)).toBeDefined();
        expect(forPrototype.named(FRINGE_LAYER_NAME)).not.toBe(forPrototype.ofKind('graphics')[0]);
    });

    /**
     * `ExperimentResult.unit` is canonical English and persisted, exactly like `label` — which Story 3.2
     * localized by a model-declared key while leaving the unit beside it untranslated, so the French
     * bench read "0,1100 fringe widths" (review 2026-08-19).
     */
    it('localizes the result unit, not only the result label', () => {
        const texts = mount(recordOneRun(prototype, 'fr')).texts();

        expect(texts.some((text) => text.includes('largeurs de frange'))).toBe(true);
        expect(texts.some((text) => text.includes('fringe widths'))).toBe(false);
    });

    /**
     * The readout was gated on `latest?.modelInputs`, so a recorded run without them fell through to
     * `lab.result.emptyHint`: the bench said nothing had been recorded over an observation that was
     * already in the notebook.
     */
    it('reports its own labelled, unit-carrying result instead of "nothing recorded yet"', () => {
        const ui = mount(recordOneRun(prototype));
        const texts = ui.texts();

        expect(texts).toContain(`Recorded Fringe displacement: 0.11\u00A0fringe widths.`);
        // The empty-state hint itself is no longer Young-worded (review 2026-08-19), so this asserts the
        // string that actually ships — a stale literal here would pass whatever the bench said.
        expect(texts.some((text) => text.includes('No measurement recorded yet'))).toBe(false);
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

        expect(pattern).toBe(`Recorded observation: Fringe displacement of 0.11\u00A0fringe widths in the saved model result.`);
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

        // `0°`, not `0 °` — the same AC5 rule, on the second of the four surfaces that render a run's
        // apparatus settings. All four are asserted, because Story 3.2 localized three of them and
        // missed the fourth for the single reason that it was absent from that story's file list.
        expect(settings).toBe(`Bench rotation: 0° · Bath temperature: 22.0\u00A0°C`);
        expect(texts.some((text) => text.includes('slitSpacingMm'))).toBe(false);
        expect(texts.some((text) => text.includes('screenDistanceM'))).toBe(false);
        expect(texts.some((text) => text.includes('—'))).toBe(false);
    });

    it('still lists Young\'s two controls for Young', () => {
        const settings = mountNotebook(young, 'en').texts().find((text) => text.includes('Slit spacing'));

        expect(settings).toBe(`Slit spacing: 0.25\u00A0mm · Screen distance: 2.00\u00A0m`);
    });

    it('names the measured quantity in French rather than the canonical English', () => {
        const texts = mountNotebook(prototype, 'fr').texts();

        expect(texts.some((text) => text.includes('Déplacement des franges'))).toBe(true);
        expect(texts.some((text) => text.includes('Fringe displacement'))).toBe(false);
    });
});
