import { readFile } from 'node:fs/promises';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookRenderer } from '../../src/adapters/phaser/renderers/NotebookRenderer';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { fr } from '../../src/core/i18n/locales/fr';
import { selectComparisonNote } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';
import { NOTEBOOK_ROWS_PER_PAGE } from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { makeSceneSlice, makeWindowStub } from './sceneSlice';

/**
 * The bench notebook's rules, driven without a browser (Story 2.10, AC8).
 *
 * What is pinned here is what a review would otherwise have to take on trust from a docstring: that
 * every field is **read from the stored record**, that the surface does not provoke a refusal the
 * player did nothing to earn, and — the project's most-repeated defect — that a French player reads
 * French, including the result's own label.
 *
 * `NotebookRenderer` imports Phaser as a type only, so a Vitest run can construct it against the
 * structural slice in `sceneSlice.ts`.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** A store at the bench with `count` observations already recorded, at genuinely different throws. */
const storeWithObservations = (count: number, locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    const screen = definition.apparatus.primaryControls.find(({ id }) => id === 'screenDistanceM')!;
    for (let index = 0; index < count; index += 1) {
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: screen.min + (index * screen.step), origin: 'phaser' });
        store.dispatch({ type: 'experiment.run', id: `run-${index + 1}`, timestamp: `2026-08-07T10:0${index}:00.000Z` });
    }
    return store;
};

const stub = makeWindowStub();

beforeEach(() => { vi.stubGlobal('window', stub.window); });
afterEach(() => { vi.unstubAllGlobals(); });

/**
 * Presses one observation row's comparison control.
 *
 * The rows are the first {@link NOTEBOOK_ROWS_PER_PAGE} objects with a `pointerup` handler, which is
 * the order `NotebookRenderer.create()` builds them in — stated here so a reordering of that method
 * fails this test loudly rather than silently pressing the paging control instead.
 */
const selectRow = (ui: ReturnType<typeof mount>, index: number): void => {
    const rows = ui.slice.pressable().slice(0, NOTEBOOK_ROWS_PER_PAGE);
    expect(rows.length).toBe(NOTEBOOK_ROWS_PER_PAGE);
    rows[index]!.handlers.get('pointerup')!();
};

const mount = (store: AppStore) => {
    const slice = makeSceneSlice();
    let visible: boolean | undefined;
    const notebook = new NotebookRenderer(slice.scene, createPhaserStoreAdapter(store), {
        onVisibilityChange: (value) => { visible = value; }
    });
    notebook.create();
    return { slice, notebook, suppressed: () => visible };
};

describe('the notebook reads the record and nothing else', () => {
    it('shows each observation\'s setup, result, wavelength and model version as stored', () => {
        const store = storeWithObservations(2);
        const ui = mount(store);

        ui.notebook.open();

        const shown = ui.slice.texts().join('\n');
        const [first] = store.getState().runs;
        expect(shown).toContain('Observation 1');
        expect(shown).toContain('Observation 2');
        expect(shown).toContain(`${first!.result.value} mm`);
        expect(shown).toContain(first!.timestamp);
        expect(shown).toContain(first!.experimentModelVersion);
        expect(shown).toContain('550 nm');
        ui.notebook.destroy();
    });

    it('goes on showing a saved observation unchanged after the bench moves on', () => {
        const store = storeWithObservations(1);
        const ui = mount(store);
        ui.notebook.open();
        const before = ui.slice.texts().join('\n');

        store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.5, origin: 'phaser' });
        ui.notebook.render(store.getState());

        expect(ui.slice.texts().join('\n')).toBe(before);
        ui.notebook.destroy();
    });

    it('says so plainly when nothing has been recorded yet', () => {
        const store = storeWithObservations(0);
        const ui = mount(store);

        ui.notebook.open();

        expect(ui.slice.texts().join('\n')).toContain('No observation saved yet');
        ui.notebook.destroy();
    });
});

describe('the notebook in French', () => {
    /**
     * The project's most-repeated defect, in the one line most likely to carry it.
     *
     * `record.result.label` is the domain's canonical `"Fringe spacing"`, and printing it inside
     * French copy is chrome-localized-content-not in miniature. `CaseRecordPrintView` already
     * substitutes the authored translation for a model-derived run and this must do the same.
     */
    it('translates the result label as well as the chrome and the numbers', () => {
        const store = storeWithObservations(1, 'fr');
        const ui = mount(store);

        ui.notebook.open();

        const shown = ui.slice.texts().join('\n');
        expect(shown).toContain(fr['notebook.heading']);
        expect(shown).toContain(fr['experiment.result.fringeSpacing']);
        expect(shown).not.toContain('Fringe spacing');
        // The value stays canonical and is localized only for display: 4,95 in French, 4.95 in English.
        expect(shown).toMatch(/\d+,\d+/);
        ui.notebook.destroy();
    });
});

describe('the comparison', () => {
    it('answers a third selection itself rather than provoking a refusal', () => {
        const store = storeWithObservations(3);
        const ui = mount(store);
        ui.notebook.open();
        const [first, second] = store.getState().runs;

        // Pressed the way the player presses them: the first four objects carrying a `pointerup`
        // handler are the four observation rows' comparison controls, in the order `create()` builds
        // them. Reaching past them into a private method would test the code and not the surface.
        selectRow(ui, 0);
        selectRow(ui, 1);
        expect(store.getState().comparison.selectedRunIds).toEqual([first!.id, second!.id]);

        selectRow(ui, 2);

        // The reducer *would* answer `too-many-comparison-runs`, and it would be right to — but the
        // player clicking a third row did nothing wrong, so the surface says why instead of
        // provoking a refusal it then has to explain away.
        expect(store.getState().comparison.selectedRunIds).toEqual([first!.id, second!.id]);
        expect(ui.slice.texts().join('\n')).toContain('Choose two saved observations');
        ui.notebook.destroy();
    });

    it('takes an observation back out of the comparison when its control is pressed again', () => {
        const store = storeWithObservations(2);
        const ui = mount(store);
        ui.notebook.open();

        selectRow(ui, 0);
        expect(store.getState().comparison.selectedRunIds).toHaveLength(1);
        selectRow(ui, 0);

        expect(store.getState().comparison.selectedRunIds).toEqual([]);
        ui.notebook.destroy();
    });

    it('types a note into the canvas and saves it against the pair', () => {
        const store = storeWithObservations(2);
        const ui = mount(store);
        ui.notebook.open();
        selectRow(ui, 0);
        selectRow(ui, 1);

        // No click into the field first: the field takes keys from the moment a pair is selected, which is the only
        // moment the note can be saved anyway.
        const keydown = ui.slice.keyboardHandlers.get('keydown');
        expect(keydown).toBeDefined();
        [...'wider'].forEach((key) => keydown!({ key } as KeyboardEvent));
        keydown!({ key: 'Enter' } as KeyboardEvent);

        expect(selectComparisonNote(store.getState())).toMatchObject({ text: 'wider' });
        ui.notebook.destroy();
    });

    it('deletes with Backspace and refuses to save an empty note', () => {
        const store = storeWithObservations(2);
        const ui = mount(store);
        ui.notebook.open();
        selectRow(ui, 0);
        selectRow(ui, 1);
        const keydown = ui.slice.keyboardHandlers.get('keydown')!;

        [...'ab'].forEach((key) => keydown({ key } as KeyboardEvent));
        keydown({ key: 'Backspace' } as KeyboardEvent);
        keydown({ key: 'Backspace' } as KeyboardEvent);
        keydown({ key: 'Enter' } as KeyboardEvent);

        expect(selectComparisonNote(store.getState())).toBeUndefined();
        // Refused, and the refusal is shown rather than swallowed — a control that refuses in silence
        // is indistinguishable from a dead one.
        expect(ui.slice.texts().join('\n')).toContain('Enter a comparison note');
        ui.notebook.destroy();
    });
});

describe('the overlay', () => {
    it('tells its owner to suppress the bench while it is up, and to hand it back on close', () => {
        const store = storeWithObservations(1);
        const ui = mount(store);

        expect(ui.suppressed()).toBeUndefined();
        ui.notebook.open();
        expect(ui.suppressed()).toBe(true);
        expect(ui.notebook.isOpen).toBe(true);

        ui.notebook.close();

        expect(ui.suppressed()).toBe(false);
        expect(ui.notebook.isOpen).toBe(false);
        ui.notebook.destroy();
    });

    it('renders nothing while closed, so a scene can call it unconditionally', () => {
        const store = storeWithObservations(2);
        const ui = mount(store);

        ui.notebook.render(store.getState());

        expect(ui.slice.texts()).toEqual([]);
        ui.notebook.destroy();
    });

    it('releases every object and its keyboard listener on destroy', () => {
        const store = storeWithObservations(2);
        const ui = mount(store);
        ui.notebook.open();

        ui.notebook.destroy();

        expect(ui.slice.drawn.length).toBeGreaterThan(0);
        expect(ui.slice.drawn.every(({ state }) => state.destroyed)).toBe(true);
        expect(ui.slice.keyboardHandlers.size).toBe(0);
    });
});
