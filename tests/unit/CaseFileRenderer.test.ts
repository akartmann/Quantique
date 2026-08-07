import { readFile } from 'node:fs/promises';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CaseFilePresenter } from '../../src/adapters/phaser/renderers/CaseFilePresenter';
import { CASE_FILE_ROWS_PER_PAGE } from '../../src/adapters/phaser/renderers/caseFileGeometry';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { selectConclusionReadiness } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';
import { makeSceneSlice, makeWindowStub, type SceneSlice } from './sceneSlice';

/**
 * The case file, driven through the structural scene slice (Story 2.11, AC5 and AC7).
 *
 * Against the **shipped** Young case rather than a fixture, because what this overlay is for is the
 * six intents whose only dispatchers were retired DOM panels — and the reducers that answer them read
 * authored requirements (`minimumRuns`, `minimumSources`, the peer-review rules). A fixture would let
 * a projection agree with a case nobody plays.
 *
 * Controls are pressed through `pressable()`, which returns objects carrying a `pointerup` handler in
 * **creation order**. That order is `CaseFilePresenter.create()`'s, and the named indices below are
 * where it is written down once.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** A store at the theory board with `count` observations recorded at genuinely different throws. */
const storeAtTheBoard = (count: number, locale: 'en' | 'fr' = 'en'): AppStore => {
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
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    return store;
};

type Harness = Readonly<{ slice: SceneSlice; presenter: CaseFilePresenter; store: AppStore; visibility: boolean[] }>;

/**
 * Mounts the overlay the way `TheoryBoardScene` does — **including the store subscription**.
 *
 * The presenter deliberately does not repaint itself after a successful dispatch: the scene's own
 * subscription does, unconditionally, because every other surface on that scene has to repaint too.
 * A harness without the subscription would leave the overlay showing pre-dispatch text and make every
 * "the row now reads Unpin" assertion below fail against correct code — which is exactly what it did
 * the first time this file was written.
 */
const mount = (store: AppStore, open = true): Harness => {
    const slice = makeSceneSlice();
    const visibility: boolean[] = [];
    const presenter = new CaseFilePresenter(slice.scene, createPhaserStoreAdapter(store), {
        onVisibilityChange: (visible) => visibility.push(visible)
    });
    presenter.create();
    store.subscribe(() => presenter.render(store.getState()));
    if (open) presenter.open();
    return { slice, presenter, store, visibility };
};

/**
 * Where each control sits in `pressable()`, which returns them in **creation order**.
 *
 * `CaseFilePresenter.create()` builds: the observation rows, the two paging controls, the reference
 * rows, then request, save and close. Named here rather than as literals so a reordering of that
 * method fails loudly on the name rather than silently pressing the neighbouring control — the trap
 * `NotebookRenderer.test.ts` records having fallen into.
 */
const SOURCE_ROWS = 2;
const EARLIER = CASE_FILE_ROWS_PER_PAGE;
const LATER = EARLIER + 1;
const FIRST_SOURCE_PIN = LATER + 1;
const REQUEST = FIRST_SOURCE_PIN + SOURCE_ROWS;
const SAVE = REQUEST + 1;
const CLOSE = SAVE + 1;

const observationPin = (harness: Harness, index: number) => harness.slice.pressable()[index];
const sourcePin = (harness: Harness, index: number) => harness.slice.pressable()[FIRST_SOURCE_PIN + index];
const press = (harness: Harness, index: number): void => {
    const control = harness.slice.pressable()[index];
    expect(control, `no pressable control at ${index}`).toBeDefined();
    control.handlers.get('pointerup')!();
};

const stub = makeWindowStub();

describe('the case file', () => {
    beforeEach(() => { vi.stubGlobal('window', stub.window); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('authors no player-facing copy in create(), and stays hidden until it is opened', () => {
        const slice = makeSceneSlice();
        const presenter = new CaseFilePresenter(slice.scene, createPhaserStoreAdapter(storeAtTheBoard(2)), {
            onVisibilityChange: () => undefined
        });
        presenter.create();

        expect(slice.texts()).toEqual([]);
        expect(slice.drawn.filter(({ state }) => state.visible)).toEqual([]);
        // Nothing is armed while it is shut: an interactive backdrop over a closed overlay would
        // swallow every click on a proposal card underneath it.
        expect(slice.drawn.filter(({ state }) => state.interactive)).toEqual([]);
        expect(presenter.isOpen).toBe(false);
    });

    /**
     * Both ways out, in one test, because they must not diverge.
     *
     * These used to be two adjacent tests differing only in closing through the control versus through
     * `close()`, with neither name saying which — so an edit would have deleted the wrong one
     * (2.11 review). The player's path is the control; the scene's path is the method; the scene is
     * told either way, and that is the contract the board's input suppression rests on.
     */
    it('closes from its own way out and from the scene, telling the scene each time', () => {
        const pressed = mount(storeAtTheBoard(2));
        expect(pressed.visibility).toEqual([true]);
        expect(pressed.presenter.isOpen).toBe(true);
        press(pressed, CLOSE);
        expect(pressed.presenter.isOpen).toBe(false);
        expect(pressed.visibility).toEqual([true, false]);

        const harness = mount(storeAtTheBoard(2));
        harness.presenter.close();
        expect(harness.visibility).toEqual([true, false]);
        expect(harness.presenter.isOpen).toBe(false);
        // Everything it drew goes with it, including the backdrop's hit area.
        expect(harness.slice.drawn.filter(({ state }) => state.visible)).toEqual([]);
        expect(harness.slice.drawn.filter(({ state }) => state.interactive)).toEqual([]);
    });

    it('lists the recorded observations and the references that have actually been read', () => {
        const harness = mount(storeAtTheBoard(2));
        const texts = harness.slice.texts();
        expect(texts).toContain(en['caseFile.heading']);
        expect(texts).toContain(en['caseFile.observations.heading']);
        expect(texts).toContain(en['caseFile.observation'].replace('{order}', '1'));
        expect(texts).toContain(en['caseFile.observation'].replace('{order}', '2'));
        expect(texts).toContain(en['caseFile.sources.heading']);
        definition.contextualArtifacts.forEach((artifact) => {
            expect(texts).toContain(artifact.displayName.en);
        });
    });

    /**
     * AC5: the four support intents reach the canvas. Pressed the way a player presses them.
     */
    it('pins and unpins an observation through the store, from a press on its own control', () => {
        const harness = mount(storeAtTheBoard(2));
        expect(harness.store.getState().theory.selectedRunIds).toEqual([]);

        observationPin(harness, 0).handlers.get('pointerup')!();
        expect(harness.store.getState().theory.selectedRunIds).toEqual(['run-1']);
        expect(harness.slice.texts()).toContain(en['caseFile.unpin']);

        observationPin(harness, 0).handlers.get('pointerup')!();
        expect(harness.store.getState().theory.selectedRunIds).toEqual([]);
    });

    it('pins and unpins a reference through the store, from a press on its own control', () => {
        const harness = mount(storeAtTheBoard(2));
        const [first] = definition.contextualArtifacts;

        sourcePin(harness, 0).handlers.get('pointerup')!();
        expect(harness.store.getState().theory.selectedSourceIds).toEqual([first.id]);

        sourcePin(harness, 0).handlers.get('pointerup')!();
        expect(harness.store.getState().theory.selectedSourceIds).toEqual([]);
    });

    /**
     * The no-dispatch-on-repeat guard: the surface reads the selection **first** and only ever sends
     * the transition that changes something.
     *
     * Asserted by pressing the same control twice and watching the store: a surface that dispatched
     * blind would earn `duplicate-theory-run` on the second press and paint a refusal the player did
     * nothing to deserve. The status slot being empty is the observable half of that.
     */
    it('never provokes a duplicate refusal by dispatching a selection the store already holds', () => {
        const harness = mount(storeAtTheBoard(2));
        observationPin(harness, 0).handlers.get('pointerup')!();
        observationPin(harness, 0).handlers.get('pointerup')!();
        observationPin(harness, 0).handlers.get('pointerup')!();

        expect(harness.store.getState().theory.selectedRunIds).toEqual(['run-1']);
        expect(harness.slice.texts()).not.toContain(en['error.duplicate-theory-run']);
        expect(harness.slice.texts()).not.toContain(en['error.theory-run-not-selected']);
    });

    /**
     * AC7: what the player's own record is still missing, localized by requirement `code`.
     *
     * The domain's `missing[].message` is dev-facing English and must never reach a player, so the
     * French pass is what proves the projection resolves the bundle rather than passing the message
     * through.
     */
    it('lists what the record is still missing, localized by code rather than from the domain message', () => {
        const harness = mount(storeAtTheBoard(2));
        const missing = selectConclusionReadiness(harness.store.getState()).missing;
        expect(missing.length).toBeGreaterThan(0);

        const texts = harness.slice.texts();
        expect(texts).toContain(en['caseFile.readiness.heading']);
        expect(texts).toContain(en['conclusion.missing.minimum-runs'].replace('{count}', '2'));

        /**
         * **The French pass is the load-bearing half.** Several `conclusion.missing.*` English strings
         * are byte-identical to the domain's `missing[].message` — deliberately, they were authored
         * from it — so "the dev-facing message never reaches the surface" is unfalsifiable in English
         * and would be a vacuous assertion of exactly the shape two reviews have already rejected. In
         * French the two genuinely differ, so a projection that passed `message` through fails here.
         */
        const french = mount(storeAtTheBoard(2, 'fr')).slice.texts();
        expect(french).toContain(fr['caseFile.readiness.heading']);
        expect(french).toContain(fr['conclusion.missing.minimum-runs'].replace('{count}', '2'));
        missing.forEach(({ message }) => expect(french).not.toContain(message));
    });

    it('says the record is complete once nothing is missing, rather than showing an empty list', () => {
        const store = storeAtTheBoard(2);
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'comparison.runSelected', runId }));
        store.dispatch({ type: 'comparison.noteSaved', note: 'The spacing widens with the distance.' });
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId: id }));
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });

        const harness = mount(store);
        expect(selectConclusionReadiness(store.getState()).status).toBe('ready');
        expect(harness.slice.texts()).toContain(en['caseFile.readiness.complete']);
    });

    /**
     * The peer-review pane belongs to the `review` phase, and `reducePeerReviewRequest` says so. The
     * pane is hidden and its controls disarmed outside it, so the refusal is not something a click can
     * reach — which is the surface's job, while the reducer keeps the guard.
     */
    it('withholds the peer-review pane outside the review phase', () => {
        const harness = mount(storeAtTheBoard(2));
        expect(harness.store.getState().phase).toBe('synthesis');
        expect(harness.slice.texts()).not.toContain(en['caseFile.review.heading']);
        const pressable = harness.slice.pressable();
        // **The request and save controls by name**, not a count. The previous form asserted that
        // *fewer* pressables were live than existed — which `storeAtTheBoard(2)` already guarantees by
        // hiding two observation pins and both paging controls, so it passed with this pane fully
        // visible and armed (2.11 review). "Drawn dead" and "drawn live" were indistinguishable before
        // `sceneSlice` recorded `interactive` (2.10 review); this is what reading that record looks
        // like when it can fail.
        expect(pressable[REQUEST].state.visible).toBe(false);
        expect(pressable[REQUEST].state.interactive).toBe(false);
        expect(pressable[SAVE].state.visible).toBe(false);
        expect(pressable[SAVE].state.interactive).toBe(false);
    });

    it('requests feedback and saves the reviewed revision from the canvas, in the review phase', () => {
        const store = storeAtTheBoard(2);
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'comparison.runSelected', runId }));
        store.dispatch({ type: 'comparison.noteSaved', note: 'The spacing widens with the distance.' });
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId: id }));
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });

        const harness = mount(store);
        expect(harness.slice.texts()).toContain(en['caseFile.review.heading']);
        expect(harness.slice.texts()).toContain(en['caseFile.review.notRequested']);

        press(harness, REQUEST);
        expect(harness.store.getState().peerReview?.status).toBe('reviewed');

        press(harness, SAVE);
        expect(harness.store.getState().decisionHistory).toHaveLength(1);
        expect(harness.slice.texts()).toContain(en['caseFile.review.saved']);
    });

    /**
     * The no-dispatch-on-repeat rule, on the one control that was exempt from it.
     *
     * Every pin reads the store first so only the transition that changes something is sent, and the
     * save control is gated on `reviewed` — but the request control was armed unconditionally in
     * `review`, so a second press against an already-reviewed draft dispatched anyway. A refusal earned
     * by pressing a control the surface drew as live is the one thing the class forbids, and no test
     * exercised the repeat (2.11 review).
     */
    it('disarms the request control once feedback is standing, so a repeat cannot be pressed', () => {
        const store = storeAtTheBoard(2, 'fr');
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });

        const harness = mount(store);
        expect(harness.slice.pressable()[REQUEST].state.interactive).toBe(true);

        press(harness, REQUEST);
        expect(harness.store.getState().peerReview?.status).toBe('reviewed');
        // Drawn, still readable, and no longer pressable.
        expect(harness.slice.pressable()[REQUEST].state.visible).toBe(true);
        expect(harness.slice.pressable()[REQUEST].state.interactive).toBe(false);
        expect(harness.slice.pressable()[SAVE].state.interactive).toBe(true);
    });

    /**
     * A successful pin that destroys standing feedback says so.
     *
     * `withTheory` clears `peerReview` on every support change, so the issues pane empties and the save
     * control dies under a player who did nothing wrong. `report()` only ever wrote the status slot on
     * a refusal, so this arrived as silence — which the guided-adventure rule forbids everywhere else
     * on this surface (2.11 review; resolved as a decision by Alexis).
     */
    it('says so when pinning support clears the feedback already standing on the draft', () => {
        const store = storeAtTheBoard(2);
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });

        const harness = mount(store);
        press(harness, REQUEST);
        expect(harness.store.getState().peerReview?.status).toBe('reviewed');

        press(harness, 0);
        expect(harness.store.getState().peerReview).toBeUndefined();
        expect(harness.slice.texts()).toContain(en['caseFile.review.clearedBySupport']);
    });

    /**
     * D3 again, on the other surface that used to leak canonical English: `PeerReviewIssue.feedback`
     * is `.en` by contract, persisted and string-compared on load, and the display resolves the
     * authored `LocalizedText` by `ruleId` instead.
     */
    it('renders the authored French feedback rather than the canonical English the record persists', () => {
        const store = storeAtTheBoard(2, 'fr');
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });
        expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });

        const issues = store.getState().peerReview;
        expect(issues?.status).toBe('reviewed');
        if (issues?.status !== 'reviewed' || issues.issues.length === 0) throw new Error('The fixture must produce a finding.');

        const harness = mount(store);
        const texts = harness.slice.texts().join('\n');
        issues.issues.forEach((issue) => {
            const rule = definition.peerReviewRules.find(({ id }) => id === issue.ruleId)!;
            expect(texts).toContain(rule.feedback.fr);
            // The canonical English is what the record keeps and what the retired panel showed.
            expect(texts).not.toContain(issue.feedback);
        });
    });

    it('pages the observation list rather than dropping the ones past a page', () => {
        const harness = mount(storeAtTheBoard(CASE_FILE_ROWS_PER_PAGE + 2));
        const first = harness.slice.texts();
        expect(first).toContain(en['caseFile.observation'].replace('{order}', '1'));
        expect(first).not.toContain(en['caseFile.observation'].replace('{order}', `${CASE_FILE_ROWS_PER_PAGE + 1}`));
        expect(first).toContain(en['caseFile.page.counter']
            .replace('{from}', '1').replace('{to}', String(CASE_FILE_ROWS_PER_PAGE))
            .replace('{total}', String(CASE_FILE_ROWS_PER_PAGE + 2)));

        press(harness, LATER);
        expect(harness.slice.texts()).toContain(en['caseFile.observation'].replace('{order}', `${CASE_FILE_ROWS_PER_PAGE + 1}`));
    });

    /**
     * A pin pressed on a **paged** list must act on the record the row is showing, not on the row's
     * index into the first page. This is the defect a paged list invites and the reason the toggle
     * reads the page's own slice rather than the whole list.
     */
    it('pins the observation the row is actually showing, on any page', () => {
        const harness = mount(storeAtTheBoard(CASE_FILE_ROWS_PER_PAGE + 2));
        press(harness, LATER);

        observationPin(harness, 0).handlers.get('pointerup')!();
        expect(harness.store.getState().theory.selectedRunIds)
            .toEqual([`run-${CASE_FILE_ROWS_PER_PAGE + 1}`]);
    });

    it('offers no reference the player has not read, so the uninspected refusal is unreachable', () => {
        const store = createStore(createInitialAppState(definition));
        store.dispatch({ type: 'source.inspected', sourceId: definition.contextualArtifacts[0].id });
        const harness = mount(store);

        expect(harness.slice.texts()).toContain(definition.contextualArtifacts[0].displayName.en);
        expect(harness.slice.texts()).not.toContain(definition.contextualArtifacts[1].displayName.en);
    });

    it('repaints in the new language when the locale changes under it', () => {
        const harness = mount(storeAtTheBoard(2));
        expect(harness.slice.texts()).toContain(en['caseFile.guide']);

        harness.presenter.render(createStore(createInitialAppState(definition, 'fr')).getState());
        expect(harness.slice.texts()).toContain(fr['caseFile.guide']);
        expect(harness.slice.texts()).not.toContain(en['caseFile.guide']);
    });

    it('registers no update loop, starts no tween, and claims no keys', () => {
        const harness = mount(storeAtTheBoard(2));
        expect(harness.slice.updateHandlers).toHaveLength(0);
        // The tween half of this test's own name. `sceneSlice` records `tweens.add` now, so this
        // fails if either surface ever starts one without taking on the reduced-motion contract.
        expect(harness.slice.tweens).toHaveLength(0);
        expect(harness.slice.keyboardListeners).toHaveLength(0);
        expect(harness.slice.capturedKeys()).toEqual([]);
    });

    it('releases every display object it made', () => {
        const harness = mount(storeAtTheBoard(2));
        expect(harness.slice.drawn.length).toBeGreaterThan(0);
        harness.presenter.destroy();
        expect(harness.slice.drawn.filter(({ state }) => !state.destroyed)).toEqual([]);
    });
});
