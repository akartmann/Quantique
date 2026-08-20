import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApparatusNotesRenderer, MAX_SECTION_LINES } from '../../src/adapters/phaser/renderers/ApparatusNotesRenderer';
import { ApparatusRenderer } from '../../src/adapters/phaser/renderers/ApparatusRenderer';
import {
    ADVANCE_CONTROL_HEIGHT,
    REFERENCE_HEADING_GAP,
    NOTES_ACTION_ROW_Y,
    NOTES_CONTROL_Y,
    NOTES_PANEL_HEIGHT,
    NOTES_PANEL_WIDTH,
    NOTES_PANEL_X,
    NOTES_PANEL_Y,
    NOTES_SECTIONS_FLOOR_Y,
    NOTES_SECTIONS_TOP,
    REFERENCE_HEADING_Y,
    REVISIT_CONTROL_Y,
    apparatusNotesControlCentre
} from '../../src/adapters/phaser/renderers/apparatusGeometry';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { resolveLocalizedText, resolveLocalizedTextList } from '../../src/core/i18n/resolveLocalizedText';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { ADVANCE_RELABEL_LOCKOUT_MS } from '../../src/adapters/phaser/renderers/advanceView';
import { loadMorleyMillerCase, loadYoungCase } from './shippedCases';
import { makeSceneSlice, makeWindowStub } from './sceneSlice';

/**
 * The apparatus notes: the surface that makes FR18's three authored fields reach a player (Story 4.2, AC2).
 *
 * `experiment.assumptions`, `experiment.confound.description` and `experiment.resetPath.description` are
 * authored bilingually on **both** shipped cases, validated by `CaseDefinitionSchema`, proved by
 * `CaseDefinition.test.ts` to be rejected when missing or locale-mismatched — and were rendered on **no
 * player surface at all**. FR18 requires every case to have *"one discoverable confound or misleading
 * result, a reset-solvable required puzzle, and inspectable model assumptions"*, and the case review
 * artifact listed all three as satisfied, naming the authored field for each. True about the authoring and
 * misleading about the player.
 *
 * So this drives **both** shipped cases, in **both** locales, because the find applies to Young equally.
 */

let young: CaseDefinition;
let prototype: CaseDefinition;

beforeAll(async () => {
    young = await loadYoungCase();
    prototype = await loadMorleyMillerCase();
});

const stub = makeWindowStub();

const storeAtTheBench = (definition: CaseDefinition, locale: 'en' | 'fr'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    return store;
};

const mountNotes = (definition: CaseDefinition, locale: 'en' | 'fr') => {
    const store = storeAtTheBench(definition, locale);
    const slice = makeSceneSlice();
    const visibility: boolean[] = [];
    const notes = new ApparatusNotesRenderer(slice.scene, createPhaserStoreAdapter(store), { onVisibilityChange: () => visibility.push(notes.isOpen) });
    notes.create();
    notes.render(store.getState());
    return { ...slice, notes, store, visibility };
};

describe('the apparatus notes render the case\'s own three authored fields', () => {
    beforeEach(() => { vi.stubGlobal('window', stub.window); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('authors no player-facing copy in create(), and stays hidden until it is opened', () => {
        const ui = mountNotes(prototype, 'en');

        // `create()` runs once and the locale can change, so every string comes from `render`. A panel that
        // wrote its headings in `create()` would silently ignore a locale change.
        expect(ui.drawn.filter(({ state }) => state.text.length > 0)).toEqual([]);
        expect(ui.drawn.filter(({ state }) => state.visible)).toEqual([]);
        expect(ui.notes.isOpen).toBe(false);
    });

    ([['en', en], ['fr', fr]] as const).forEach(([locale, table]) => {
        it(`shows every assumption, the confound and the reset path for the prototype in ${locale}`, () => {
            const ui = mountNotes(prototype, locale);
            // **No manual `render` after `openNotes()`.** There was one here, and it hid a real defect:
            // opening the notes is not a dispatch, so the scene's subscription never fires, so nothing
            // published — the panel appeared with every string empty over a backdrop covering the bench,
            // and only a screenshot showed it. A test that renders by hand is testing a sequence the app
            // never performs. `openNotes()` publishes now, and this asserts that it does.
            ui.notes.openNotes();
            const texts = ui.texts();

            // The three headings, from the interface table rather than restated here.
            expect(texts).toContain(table['lab.notes.assumptions']);
            expect(texts).toContain(table['lab.notes.confound']);
            expect(texts).toContain(table['lab.notes.resetPath']);
            // And every line of authored content, resolved the way the renderer resolves it. This is the
            // assertion the whole surface exists for: before it, none of these strings reached a player.
            resolveLocalizedTextList(prototype.experiment.assumptions, locale)
                .forEach((assumption) => expect(texts).toContain(assumption));
            expect(texts).toContain(resolveLocalizedText(prototype.experiment.confound.description, locale));
            expect(texts).toContain(resolveLocalizedText(prototype.experiment.resetPath.description, locale));
        });

        it(`shows the same three fields for Young in ${locale}, because the find applies to it equally`, () => {
            const ui = mountNotes(young, locale);
            // **No manual `render` after `openNotes()`.** There was one here, and it hid a real defect:
            // opening the notes is not a dispatch, so the scene's subscription never fires, so nothing
            // published — the panel appeared with every string empty over a backdrop covering the bench,
            // and only a screenshot showed it. A test that renders by hand is testing a sequence the app
            // never performs. `openNotes()` publishes now, and this asserts that it does.
            ui.notes.openNotes();
            const texts = ui.texts();

            resolveLocalizedTextList(young.experiment.assumptions, locale)
                .forEach((assumption) => expect(texts).toContain(assumption));
            expect(texts).toContain(resolveLocalizedText(young.experiment.confound.description, locale));
            expect(texts).toContain(resolveLocalizedText(young.experiment.resetPath.description, locale));
        });
    });

    it('repaints in the new language when the locale changes under it', () => {
        const ui = mountNotes(prototype, 'en');
        ui.notes.openNotes();
        expect(ui.texts()).toContain(en['lab.notes.confound']);

        const french = createStore(createInitialAppState(prototype, 'fr'));
        ui.notes.render(french.getState());

        expect(ui.texts()).toContain(fr['lab.notes.confound']);
        expect(ui.texts()).not.toContain(en['lab.notes.confound']);
    });

    it('tells the host each time it appears and disappears, so the bench can be suppressed', () => {
        const ui = mountNotes(prototype, 'en');

        ui.notes.openNotes();
        expect(ui.visibility).toEqual([true]);
        // Idempotent: a second press on the control is not a second visibility change, so the scene's
        // suppression rule is not re-run for a state that did not move.
        ui.notes.openNotes();
        expect(ui.visibility).toEqual([true]);
        ui.notes.close();
        expect(ui.visibility).toEqual([true, false]);
        ui.notes.close();
        expect(ui.visibility).toEqual([true, false]);
    });

    it('arms its own way out only while it is showing, so a hidden control cannot be pressed', () => {
        const ui = mountNotes(prototype, 'en');
        const armed = () => ui.drawn.filter(({ state }) => state.interactive).length;

        expect(armed()).toBe(0);
        ui.notes.openNotes();
        expect(armed()).toBe(1);
        ui.notes.close();
        expect(armed()).toBe(0);
    });

    it('closes from its own control, the way a player closes it', () => {
        const ui = mountNotes(prototype, 'en');
        ui.notes.openNotes();
        const close = ui.pressable().find(({ handlers }) => handlers.has('pointerup'));

        close!.handlers.get('pointerup')!();

        expect(ui.notes.isOpen).toBe(false);
        expect(ui.visibility).toEqual([true, false]);
    });

    it('registers no update loop and starts no tween', () => {
        const ui = mountNotes(prototype, 'en');
        ui.notes.openNotes();

        expect(ui.updateHandlers).toHaveLength(0);
        expect(ui.tweens).toHaveLength(0);
    });

    it('releases every display object it made', () => {
        const ui = mountNotes(prototype, 'en');
        ui.notes.openNotes();

        ui.notes.destroy();

        expect(ui.drawn.filter(({ state }) => !state.destroyed)).toEqual([]);
        expect(ui.drawn.length).toBeGreaterThan(0);
    });

    it('does nothing at all while closed, so the scene can call it unconditionally', () => {
        const ui = mountNotes(prototype, 'en');
        ui.notes.render(ui.store.getState());

        expect(ui.drawn.filter(({ state }) => state.text.length > 0)).toEqual([]);
    });
});

describe('the bench opens the notes, and only when the scene hosts them', () => {
    beforeEach(() => { vi.stubGlobal('window', stub.window); });
    afterEach(() => { vi.unstubAllGlobals(); });

    const mountBench = (definition: CaseDefinition, host: boolean) => {
        const store = storeAtTheBench(definition, 'en');
        const slice = makeSceneSlice();
        let opened = 0;
        const renderer = new ApparatusRenderer(slice.scene, createPhaserStoreAdapter(store), {
            openNotebook: () => undefined,
            ...(host ? { openApparatusNotes: () => { opened += 1; } } : {})
        });
        renderer.create();
        renderer.render(store.getState());
        return { ...slice, renderer, store, openedCount: () => opened };
    };

    it('draws the control and opens the notes from a press, on both cases', () => {
        ([prototype, young] as const).forEach((definition) => {
            const hosted = mountBench(definition, true);
            const unhosted = mountBench(definition, false);

            expect(hosted.texts()).toContain(en['lab.notes.open']);
            // ADR-011: the canvas can dispatch the intent, and this presses every control on the bench to
            // find out that **exactly one** of them opens the notes. Identifying it by index would be the
            // fabricated-index shape; identifying it by position is impossible here, because the harness
            // discards constructor geometry. Counting is what is left, and it can genuinely fail — the
            // press either reaches the callback or it does not.
            // Past the relabel lockout first. `AdvanceControl` refuses a press within
            // `ADVANCE_RELABEL_LOCKOUT_MS` of its label changing — *"a click aimed at the label that was on
            // screen a moment ago is not a click on this one"* — and the harness clock starts at 0, which is
            // when the first `render` labelled it. A test that skipped this would assert the lockout rather
            // than the wiring, and would read as though the control were dead.
            (hosted.scene as unknown as { time: { now: number } }).time.now = ADVANCE_RELABEL_LOCKOUT_MS + 1;
            hosted.pressable().forEach(({ handlers }) => handlers.get('pointerup')?.());
            expect(hosted.openedCount()).toBe(1);
            // And the control really is the extra one: the same bench without a host has one fewer.
            expect(hosted.pressable().length).toBe(unhosted.pressable().length + 1);
        });
    });

    it('draws no notes control when the scene hosts no notes, rather than one that does nothing', () => {
        // The same rule the notebook control follows: *"a control that does nothing is worse than no
        // control at all"*, and the reason the option is optional.
        const ui = mountBench(prototype, false);

        expect(ui.texts()).not.toContain(en['lab.notes.open']);
    });
});

describe('the notes panel fits the surface it is laid out on', () => {
    it('covers the bench it is presented over, and stays inside the canvas', () => {
        expect(NOTES_PANEL_X).toBeGreaterThan(0);
        expect(NOTES_PANEL_Y).toBeGreaterThan(0);
        expect(NOTES_PANEL_X + NOTES_PANEL_WIDTH).toBeLessThanOrEqual(DESIGN_WIDTH);
        expect(NOTES_PANEL_Y + NOTES_PANEL_HEIGHT).toBeLessThanOrEqual(DESIGN_HEIGHT);
    });

    it('leaves the way out below the sections, where a long section cannot push it off the panel', () => {
        expect(NOTES_SECTIONS_TOP).toBeGreaterThan(NOTES_PANEL_Y);
        expect(NOTES_SECTIONS_FLOOR_Y).toBeLessThan(NOTES_ACTION_ROW_Y);
        expect(NOTES_ACTION_ROW_Y).toBeGreaterThan(NOTES_SECTIONS_TOP);
        expect(NOTES_ACTION_ROW_Y).toBeLessThan(NOTES_PANEL_Y + NOTES_PANEL_HEIGHT);
        expect(notesCloseWithinPanel()).toBe(true);
    });

    /**
     * What the notes control costs the reference shelf, stated rather than hoped.
     *
     * The shelf grows *downward* from this control and the colleague's hint grows *upward* from the canvas
     * floor into the same column, so inserting 48px here moves the shelf's heading down by 48 and the two
     * meet sooner. The consequence is real and it is bounded; the numbers are here so a reviewer can see
     * the trade rather than reconstruct it.
     */
    it('pushes the reference shelf down by exactly one control, and no further', () => {
        expect(NOTES_CONTROL_Y).toBeGreaterThan(REVISIT_CONTROL_Y);
        expect(REFERENCE_HEADING_Y).toBeGreaterThan(NOTES_CONTROL_Y);
        // One control's height plus its gap, and no more: the shelf moved by exactly what was inserted.
        expect(NOTES_CONTROL_Y - REVISIT_CONTROL_Y).toBe(ADVANCE_CONTROL_HEIGHT + 8);
        // Derived from the notes control, so a future insertion in this column moves the shelf with it
        // instead of leaving two numbers that agree until one of them is edited. Stated as the gap the
        // shelf keeps from whatever is above it, which is the fact that has to survive.
        expect(REFERENCE_HEADING_Y - (NOTES_CONTROL_Y + ADVANCE_CONTROL_HEIGHT)).toBe(REFERENCE_HEADING_GAP);
    });

    it('centres the exported click target inside the control it names', () => {
        const { x, y } = apparatusNotesControlCentre();

        expect(y).toBeGreaterThan(NOTES_CONTROL_Y);
        expect(y).toBeLessThan(REFERENCE_HEADING_Y);
        expect(x).toBeGreaterThan(0);
    });
});

describe('no case can author more note lines than the panel builds', () => {
    /**
     * The reserve, asserted against the shipped content.
     *
     * `MAX_SECTION_LINES` text objects are built per section in `create()`, before any content is known, so
     * a case authoring more assumptions than that would **silently lose the extra lines** — the same shape
     * as `CASE_FILE_READINESS_ROWS` dropping a twelfth code, which is a carried deferred item precisely
     * because nothing asserted it.
     *
     * Mutation target: author a fourth and fifth assumption on either case, or drop `MAX_SECTION_LINES` to
     * two, and this fails by name at authoring time rather than in front of a player.
     */
    it('reserves at least as many lines as either shipped case authors', () => {
        ([young, prototype] as const).forEach((definition) => {
            expect(definition.experiment.assumptions.en.length).toBeLessThanOrEqual(MAX_SECTION_LINES);
            expect(definition.experiment.assumptions.fr.length).toBeLessThanOrEqual(MAX_SECTION_LINES);
        });
        // And the reserve is not vacuously large: it is within one of what the content actually needs, so
        // it is a bound somebody chose rather than a number nobody will ever reach.
        const longest = Math.max(
            young.experiment.assumptions.en.length,
            prototype.experiment.assumptions.en.length
        );
        expect(MAX_SECTION_LINES - longest).toBeLessThanOrEqual(1);
    });
});

/** Whether the way out is drawn inside the panel it belongs to, rather than beside it. */
const notesCloseWithinPanel = (): boolean =>
    NOTES_ACTION_ROW_Y > NOTES_PANEL_Y && NOTES_ACTION_ROW_Y < NOTES_PANEL_Y + NOTES_PANEL_HEIGHT;
