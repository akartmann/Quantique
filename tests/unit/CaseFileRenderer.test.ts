import { readFile } from 'node:fs/promises';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CaseFilePresenter } from '../../src/adapters/phaser/renderers/CaseFilePresenter';
import { CASE_FILE_ROWS_PER_PAGE } from '../../src/adapters/phaser/renderers/caseFileGeometry';
import type { CaseRecordOperations } from '../../src/adapters/persistence/caseRecordOperations';
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
const mount = (store: AppStore, open = true, record?: CaseRecordOperations): Harness => {
    const slice = makeSceneSlice();
    const visibility: boolean[] = [];
    const presenter = new CaseFilePresenter(slice.scene, createPhaserStoreAdapter(store), {
        onVisibilityChange: (visible) => visibility.push(visible),
        record
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
 * rows, then request, save, consult, close, and — only when the session has a repository — the three
 * record actions. Named here rather than as literals so a reordering of that method fails loudly on the
 * name rather than silently pressing the neighbouring control — the trap `NotebookRenderer.test.ts`
 * records having fallen into.
 */
const SOURCE_ROWS = 2;
const EARLIER = CASE_FILE_ROWS_PER_PAGE;
const LATER = EARLIER + 1;
const FIRST_SOURCE_PIN = LATER + 1;
const REQUEST = FIRST_SOURCE_PIN + SOURCE_ROWS;
const SAVE = REQUEST + 1;
const CONSULT = SAVE + 1;
const CLOSE = CONSULT + 1;
const FIRST_RECORD_ACTION = CLOSE + 1;

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

/**
 * The consultation, in the band the peer-review pane leaves empty outside `review` (Story 2.12, D4).
 *
 * `consultation.requested` had no canvas dispatcher at all — `src/ui/review/ConsultationPanel.ts` was
 * the only one, and it is deleted. These press the control the way a player does rather than
 * dispatching the action, because a store test would have been green all along while the intent stayed
 * unreachable, which is the gap ADR-011 exists for.
 */
describe('the case file consultation', () => {
    beforeEach(() => { vi.stubGlobal('window', stub.window); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('asks for a consultation and renders all four authored parts', () => {
        const harness = mount(storeAtTheBoard(0));
        expect(harness.store.getState().consultation).toBeUndefined();

        press(harness, CONSULT);

        const consultation = harness.store.getState().consultation;
        expect(consultation).toBeDefined();
        const shown = harness.slice.texts();
        const rule = definition.consultationRules.find(({ id }) => id === consultation!.ruleId)!;
        [rule.nextStep, rule.layers.observation, rule.layers.plainLanguage, rule.layers.technicalDetail]
            .forEach((authored) => {
                expect(shown.some((text) => text.includes(authored.en)), authored.en).toBe(true);
            });
    });

    /**
     * The authored prose comes out in the player's language, not in the canonical field.
     *
     * The retired panel rendered `consultation.layers.observation.en` directly. Carrying that across
     * would have shipped a French player an English colleague — the project's most-repeated defect, and
     * the one D3 of Story 2.11 was written about.
     */
    it('renders the authored guidance in French, never the canonical English field', () => {
        const harness = mount(storeAtTheBoard(0, 'fr'));

        press(harness, CONSULT);

        const rule = definition.consultationRules
            .find(({ id }) => id === harness.store.getState().consultation!.ruleId)!;
        const shown = harness.slice.texts();
        expect(shown.some((text) => text.includes(rule.layers.plainLanguage.fr))).toBe(true);
        expect(shown.some((text) => text.includes(rule.layers.plainLanguage.en))).toBe(false);
        expect(shown).toContain(fr['caseFile.consultation.request']);
    });

    /** A refusal is answered rather than swallowed: `consultation-unavailable` is a real answer. */
    it('surfaces the localized refusal when no authored consultation applies', () => {
        const store = storeAtTheBoard(2);
        // Every authored predicate satisfied: two observations at different throws, both sources read,
        // and a chosen conclusion (which is what writes the limitation the fourth rule looks for).
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        const harness = mount(store);

        press(harness, CONSULT);

        expect(harness.store.getState().consultation).toBeUndefined();
        expect(harness.slice.texts()).toContain(en['error.consultation-unavailable']);
    });

    /** One band, one occupant. The peer-review pane owns it in `review`; the consultation owns it before. */
    it('gives the band to peer review in review, and to the consultation before it', () => {
        const synthesis = mount(storeAtTheBoard(2));
        expect(synthesis.slice.pressable()[CONSULT].state.visible).toBe(true);
        expect(synthesis.slice.pressable()[REQUEST].state.visible).toBe(false);

        const store = storeAtTheBoard(2);
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'comparison.runSelected', runId }));
        store.dispatch({ type: 'comparison.noteSaved', note: 'The spacing widens with the distance.' });
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId: id }));
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
        const review = mount(store);

        expect(review.slice.pressable()[REQUEST].state.visible).toBe(true);
        expect(review.slice.pressable()[CONSULT].state.visible).toBe(false);
        expect(review.slice.pressable()[CONSULT].state.interactive).toBe(false);
    });
});

/**
 * Export, import and print, off the panel that owned all three (Story 2.12, Task 2 / AC3).
 *
 * The operations are stubbed rather than real: what is under test here is that the surface reaches
 * them, arms them, and answers every `Result` — `caseRecordOperations.ts` is where the adapters
 * themselves are exercised.
 */
describe('the case file record actions', () => {
    beforeEach(() => { vi.stubGlobal('window', stub.window); });
    afterEach(() => { vi.unstubAllGlobals(); });

    const stubOperations = (overrides: Partial<CaseRecordOperations> = {}): CaseRecordOperations & {
        calls: string[];
    } => {
        const calls: string[] = [];
        return {
            calls,
            exportRecord: () => { calls.push('export'); return { ok: true, value: undefined }; },
            importRecord: async () => { calls.push('import'); return { ok: true, value: undefined }; },
            printRecord: () => { calls.push('print'); return { ok: true, value: undefined }; },
            ...overrides
        };
    };

    it('reaches each adapter from its own control and says what happened', async () => {
        const operations = stubOperations();
        const harness = mount(storeAtTheBoard(2), true, operations);

        press(harness, FIRST_RECORD_ACTION);
        expect(harness.slice.texts()).toContain(en['caseFile.record.exported']);
        press(harness, FIRST_RECORD_ACTION + 2);
        expect(harness.slice.texts()).toContain(en['caseFile.record.printed']);
        press(harness, FIRST_RECORD_ACTION + 1);
        await Promise.resolve();
        await Promise.resolve();

        expect(operations.calls).toEqual(['export', 'print', 'import']);
        expect(harness.slice.texts()).toContain(en['caseFile.record.imported']);
    });

    /** A failed export is reported, not discarded — the rule `report()` states for every other control. */
    it('answers a refused export with its localized error', () => {
        const harness = mount(storeAtTheBoard(2), true, stubOperations({
            exportRecord: () => ({ ok: false, error: { code: 'export-unavailable', message: 'dev-facing' } })
        }));

        press(harness, FIRST_RECORD_ACTION);

        expect(harness.slice.texts()).toContain(en['error.export-unavailable']);
        expect(harness.slice.texts()).not.toContain('dev-facing');
    });

    /**
     * A cancelled chooser is not a failure.
     *
     * `importRecord` resolves `undefined` when the player picked no file. Reporting that would answer
     * somebody who deliberately backed out with a message about something going wrong.
     */
    it('says nothing when the player closes the chooser without choosing', async () => {
        const harness = mount(storeAtTheBoard(2), true, stubOperations({
            importRecord: async () => undefined
        }));

        press(harness, FIRST_RECORD_ACTION + 1);
        await Promise.resolve();
        await Promise.resolve();

        expect(harness.slice.texts()).not.toContain(en['caseFile.record.imported']);
        expect(harness.slice.texts()).not.toContain(en['error.invalid-import']);
        // And the control is live again, rather than left dead behind a chooser that has closed.
        expect(harness.slice.pressable()[FIRST_RECORD_ACTION + 1].state.interactive).toBe(true);
    });

    /**
     * The validation route draws no record row at all.
     *
     * `main.ts` builds the operations only inside its `if (repository)` branch, which the validation
     * route never enters. A row drawn dead would still be a row offering to write to a device the
     * moderated session must not touch.
     */
    it('draws no record row when the session has no repository', () => {
        const harness = mount(storeAtTheBoard(2));

        expect(harness.slice.pressable()[FIRST_RECORD_ACTION]).toBeUndefined();
        [en['caseFile.record.export'], en['caseFile.record.import'], en['caseFile.record.print']]
            .forEach((label) => expect(harness.slice.texts()).not.toContain(label));
    });
});
