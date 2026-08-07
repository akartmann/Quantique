import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DebriefRenderer } from '../../src/adapters/phaser/renderers/DebriefRenderer';
import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState, type AppState, type CompletionSnapshot } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { RECOGNITION_IDS } from '../../src/domain/recognition/recognitionRules';
import { makeSceneSlice, makeWindowStub, type SceneSlice } from './sceneSlice';

/**
 * The debrief, driven through the structural scene slice (Story 2.11, AC1–AC4, AC8).
 *
 * A real `Phaser.Game` cannot be constructed in Vitest and is not what is under test. `sceneSlice.ts`
 * records `text`, `visible`, `alpha`, `destroyed`, `interactive`, `commands` and `clears`, and keys
 * listeners by identity — all of which exist because the 2.10 review found the harness itself was the
 * blind spot. Controls are pressed through `pressable()` the way a player presses them, rather than by
 * reaching past the surface into a private method.
 *
 * **This is where the debrief's own copy is asserted.** Canvas text cannot be read from the DOM, so no
 * Playwright spec can see it; `debrief-replay.spec.ts` says so in its own header and covers routing
 * instead. Every localization claim in AC8 that concerns what this room *paints* is met here.
 */

const bilingual = (english: string, french: string) => ({ en: english, fr: french });

const artifact = (id: string, name: string, category: 'primary-material' | 'reconstruction' | 'later-interpretation' | 'deliberate-fiction') => ({
    id,
    displayName: bilingual(name, `${name} [fr]`),
    creatorOrOrigin: 'Archive',
    sourceType: 'lecture-record' as const,
    provenance: { category, reference: id },
    rightsStatus: 'reviewed' as const,
    caseRelationship: bilingual('Evidence.', 'Preuve.')
});

/**
 * A fixture, not the shipped case.
 *
 * Both shipped Young artifacts are `primary-material`, so shipped content exercises **one** of AC2's
 * four provenance categories. The fixture cites a `reconstruction` beside a `primary-material` one so
 * the second vocabulary is actually painted; `I18n.test.ts` covers all four labels against the
 * schema's own `.options`, which is the half a fixture cannot prove.
 */
const definition = {
    id: 'young-interference',
    version: '1.14.0',
    prediction: { required: true },
    requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: bilingual('Spacing', 'Écartement'), unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: bilingual('Distance', 'Distance'), unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    contextualArtifacts: [
        artifact('source-1', 'Source one', 'primary-material'),
        artifact('source-2', 'Source two', 'reconstruction')
    ],
    consultationRules: [],
    peerReviewRules: [],
    experiment: { modelVersion: 'young-double-slit-v1', wavelengthComparison: { fixedMinimumPathNm: 550, advancedChoicesNm: [450, 650] } },
    rivalLab: {
        name: 'Mr. Arthur Bell',
        accentColor: '#8c3b3b',
        critiques: [
            { id: 'critique-one', proposalId: 'p-1', line: bilingual('Your evidence is thin.', 'Vos preuves sont minces.') },
            { id: 'critique-two', proposalId: 'p-2', line: bilingual('You claim too much.', 'Vous affirmez trop.') }
        ]
    },
    debrief: {
        summary: bilingual('Compare the pattern with the evidence.', 'Comparez la figure aux preuves.'),
        sourceRefs: ['ignored'],
        historicalComparison: {
            title: bilingual('The record and the earlier reference', 'Le dossier et la référence antérieure'),
            text: bilingual('The fixed record places them side by side.', 'Le dossier établi les place côte à côte.'),
            sourceIds: ['source-1', 'source-2']
        },
        deeperTheory: {
            title: bilingual('Optional deeper theory', 'Approfondissement facultatif'),
            text: bilingual('The recorded model describes how the inputs relate.', 'Le modèle enregistré décrit comment les entrées se relient.')
        },
        replayLabel: bilingual('Replay — not the recorded historical result', 'Rejouer — il ne s’agit pas du résultat enregistré')
    }
} as unknown as CaseDefinition;

const recognitionSnapshot = (achieved: boolean) => ({
    version: 1 as const,
    items: RECOGNITION_IDS.map((id) => ({
        id,
        // Canonical English, exactly as `deriveRecognition` persists it. The display must **not** show
        // these — it resolves by stable id — so the fixture makes them recognisably wrong on purpose.
        label: `CANONICAL ${id}`,
        description: `CANONICAL description of ${id}`,
        achieved
    }))
});

const completion = (overrides: Partial<CompletionSnapshot> = {}): CompletionSnapshot => ({
    completedAt: '2026-08-07T12:00:00.000Z',
    finalDecision: {
        version: 1,
        priorConclusion: '',
        conclusion: 'A bounded claim.',
        limitation: 'A stated limit.',
        selectedRunIds: [],
        selectedSourceIds: [],
        feedback: { status: 'reviewed', issues: [] },
        timestamp: '2026-08-07T11:00:00.000Z'
    },
    decisionHistory: [],
    runs: [],
    inspectedSourceIds: [],
    comparison: { selectedRunIds: [], notes: [] },
    critiqueHistory: [
        { proposalId: 'p-1', critiqueId: 'critique-one', timestamp: '2026-08-07T10:00:00.000Z' },
        { proposalId: 'p-2', critiqueId: 'critique-two', timestamp: '2026-08-07T10:30:00.000Z' }
    ],
    recognition: recognitionSnapshot(true),
    ...overrides
});

type Harness = Readonly<{ slice: SceneSlice; renderer: DebriefRenderer; render: (state: AppState) => void }>;

const mount = (state: AppState): Harness => {
    const slice = makeSceneSlice();
    const store = createStore(state);
    const renderer = new DebriefRenderer(slice.scene, createPhaserStoreAdapter(store));
    renderer.create();
    renderer.render(store.getState());
    return { slice, renderer, render: (next) => renderer.render(next) };
};

const debriefState = (locale: 'en' | 'fr', overrides: Partial<AppState> = {}): AppState => ({
    ...createInitialAppState(definition, locale),
    phase: 'debrief',
    completion: completion(),
    ...overrides
} as AppState);

/** `textStyles.textResolution()` reads `window.devicePixelRatio`, and Vitest runs in Node. */
const stub = makeWindowStub();

let harness: Harness;

describe('the debrief renderer', () => {
    beforeEach(() => {
        vi.stubGlobal('window', stub.window);
        harness = mount(debriefState('en'));
    });

    afterEach(() => { vi.unstubAllGlobals(); });

    it('authors no player-facing copy in create(), and writes it all in render()', () => {
        // `create()` runs once and the locale can change at any time, so every string has to come from
        // a render. A renderer that wrote copy in `create()` would show the boot locale forever.
        const fresh = makeSceneSlice();
        const store = createStore(debriefState('fr'));
        const renderer = new DebriefRenderer(fresh.scene, createPhaserStoreAdapter(store));
        renderer.create();

        expect(fresh.texts()).toEqual([]);

        renderer.render(store.getState());
        expect(fresh.texts().length).toBeGreaterThan(0);
    });

    it('renders the authored summary, comparison and cited provenance in the active locale', () => {
        const texts = harness.slice.texts();
        expect(texts).toContain(en['debrief.heading']);
        expect(texts).toContain(definition.debrief.summary.en);
        expect(texts).toContain(definition.debrief.historicalComparison.title.en);
        expect(texts).toContain(definition.debrief.historicalComparison.text.en);
        expect(texts).toContain('Source one');
        expect(texts).toContain('Source two');
    });

    /**
     * AC2: provenance labels distinguish the four categories, and the fixture cites two of them.
     *
     * The two cited sources carry **different** categories, so a renderer that painted one label twice
     * — or resolved the wrong artifact for a row — fails here rather than looking plausible.
     */
    it('names each cited source’s provenance, type and rights beside it', () => {
        const texts = harness.slice.texts();
        const line = (provenance: string): string => en['debrief.sources.line']
            .replace('{provenance}', provenance)
            .replace('{type}', en['source.type.lecture-record'])
            .replace('{rights}', en['source.rights.reviewed']);

        expect(texts).toContain(line(en['source.provenanceName.primary-material']));
        expect(texts).toContain(line(en['source.provenanceName.reconstruction']));
    });

    /**
     * D3, and the defect this project repeats most often: the persisted record keeps canonical English
     * and the **display** resolves by stable id.
     *
     * The fixture's snapshot carries deliberately recognisable canonical strings, so a renderer that
     * rendered `item.label` straight through — which is what the retired DOM panel does — fails in
     * both locales rather than only in French.
     */
    it('localizes recognition by stable id and never renders the canonical English in the record', () => {
        const english = harness.slice.texts();
        RECOGNITION_IDS.forEach((id) => {
            expect(english).toContain(en[`recognition.${id}.label`]);
            expect(english).toContain(en[`recognition.${id}.description`]);
        });
        expect(english.filter((text) => text.startsWith('CANONICAL'))).toEqual([]);

        const french = mount(debriefState('fr')).slice.texts();
        RECOGNITION_IDS.forEach((id) => {
            expect(french).toContain(fr[`recognition.${id}.label`]);
            expect(french).toContain(fr[`recognition.${id}.description`]);
        });
        expect(french.filter((text) => text.startsWith('CANONICAL'))).toEqual([]);
        expect(french).toContain(fr['debrief.recognition.intro']);
    });

    it('marks each recognition line as recorded or not, without reading as a tally', () => {
        expect(harness.slice.texts().filter((text) => text === en['debrief.recognition.achieved']))
            .toHaveLength(RECOGNITION_IDS.length);
        // The framing line is what keeps four ticked lines from being a score, so it is asserted
        // present rather than assumed — AC3 forbids one.
        expect(harness.slice.texts()).toContain(en['debrief.recognition.intro']);

        const none = mount(debriefState('en', { completion: completion({ recognition: recognitionSnapshot(false) }) }));
        expect(none.slice.texts().filter((text) => text === en['debrief.recognition.notRecorded']))
            .toHaveLength(RECOGNITION_IDS.length);
    });

    /**
     * D2: the debrief reads `completion`, never the live field.
     *
     * The state below has a **different** live `critiqueHistory` from the snapshot's — which is exactly
     * what a re-completion after a counterfactual replay produces. A renderer reading `state` would
     * show the second pass's challenge; one reading `completion` shows the first pass's.
     */
    it('pages the completed investigation’s challenges, not the live ones', () => {
        const live = mount(debriefState('en', {
            critiqueHistory: [{ proposalId: 'p-2', critiqueId: 'critique-two', timestamp: '2026-08-07T13:00:00.000Z' }]
        }));
        const texts = live.slice.texts();
        expect(texts).toContain('Your evidence is thin.');
        expect(texts).not.toContain('You claim too much.');
        expect(texts).toContain(en['debrief.critiques.headingCounted'].replace('{index}', '1').replace('{total}', '2'));
        // Attributed to the rival by name, with his role resolved through the i18n layer.
        expect(texts.some((text) => text.includes('Mr. Arthur Bell') && text.includes(en['rivalLab.role']))).toBe(true);
    });

    it('turns to the next challenge when the later control is pressed, and stops at the ends', () => {
        // Pressed through the surface: `pressable()` returns the controls in creation order — the
        // deeper-theory strip, then earlier, then later.
        const [, earlier, later] = harness.slice.pressable();
        expect(earlier.state.interactive, 'earlier is dead on the first challenge').toBe(false);
        expect(later.state.interactive).toBe(true);

        later.handlers.get('pointerup')!();
        expect(harness.slice.texts()).toContain('You claim too much.');
        expect(harness.slice.texts()).toContain(
            en['debrief.critiques.headingCounted'].replace('{index}', '2').replace('{total}', '2')
        );
        expect(harness.slice.pressable()[2].state.interactive, 'later is dead on the last challenge').toBe(false);

        harness.slice.pressable()[1].handlers.get('pointerup')!();
        expect(harness.slice.texts()).toContain('Your evidence is thin.');
    });

    it('says so plainly when the completed investigation drew no challenge at all', () => {
        const quiet = mount(debriefState('en', { completion: completion({ critiqueHistory: [] }) }));
        expect(quiet.slice.texts()).toContain(en['debrief.critiques.empty']);
        // And the paging controls are not offered for a single entry, let alone none.
        expect(quiet.slice.pressable()[1].state.visible).toBe(false);
    });

    /**
     * AC1: the deeper-theory layer is optional and **collapsed by default**, and the flag is
     * widget-local — nothing here writes to the store.
     */
    it('opens and closes the optional deeper theory without dispatching anything', () => {
        const store = createStore(debriefState('en'));
        const slice = makeSceneSlice();
        const renderer = new DebriefRenderer(slice.scene, createPhaserStoreAdapter(store));
        renderer.create();
        renderer.render(store.getState());

        const before = store.getState();
        expect(renderer.isDeeperTheoryOpen).toBe(false);
        expect(slice.texts()).not.toContain(definition.debrief.deeperTheory.text.en);
        expect(slice.texts()).toContain(en['debrief.deeperTheory.show']);
        // The authored title is on the strip even while the layer is shut, so the player knows what
        // they would be opening.
        expect(slice.texts()).toContain(definition.debrief.deeperTheory.title.en);

        slice.pressable()[0].handlers.get('pointerup')!();

        expect(renderer.isDeeperTheoryOpen).toBe(true);
        expect(slice.texts()).toContain(definition.debrief.deeperTheory.text.en);
        expect(slice.texts()).toContain(en['debrief.deeperTheory.hide']);
        // Reading is not an act on the record: the store is the same frozen object it was.
        expect(store.getState()).toBe(before);

        slice.pressable()[0].handlers.get('pointerup')!();
        expect(renderer.isDeeperTheoryOpen).toBe(false);
        expect(slice.texts()).not.toContain(definition.debrief.deeperTheory.text.en);
    });

    /**
     * The shared lower band has one tenant at a time, and the challenge paging belongs to the
     * challenges — a control left live under the open layer would page something nobody can see.
     */
    it('hands the shared lower band to the deeper theory and silences the paging while it is open', () => {
        harness.slice.pressable()[0].handlers.get('pointerup')!();
        const [, earlier, later] = harness.slice.pressable();
        expect(earlier.state.visible).toBe(false);
        expect(later.state.visible).toBe(false);
        expect(earlier.state.interactive).toBe(false);
        expect(later.state.interactive).toBe(false);
        expect(harness.slice.texts()).not.toContain('Your evidence is thin.');
    });

    /**
     * AC4 and AC2: the counterfactual warning is the **authored** prose, and it appears only on the
     * pass where `isCounterfactual` is set — which is the second one, because `reduceReplayStart`
     * moves the phase to `context` and this room shuts down immediately.
     */
    it('paints the authored counterfactual warning only once the replay flag is set', () => {
        expect(harness.slice.texts()).not.toContain(definition.debrief.replayLabel.en);

        const second = mount(debriefState('en', { replay: { isCounterfactual: true } }));
        expect(second.slice.texts()).toContain(definition.debrief.replayLabel.en);

        const french = mount(debriefState('fr', { replay: { isCounterfactual: true } }));
        expect(french.slice.texts()).toContain(definition.debrief.replayLabel.fr);
        // The control's own label is the interface key, never the authored prose. The scene draws the
        // control, so what this asserts is that the renderer does not *also* paint one.
        expect(french.slice.texts()).not.toContain(fr['advance.replay']);
    });

    /**
     * A restored record can carry the `debrief` phase with no snapshot, and a degraded cached
     * `case.json` can leave a `critiqueId` unresolvable. Neither may throw: `render()` runs inside
     * `dispatch() → notify()`, so a throw advances the phase and strands the router (the 1.10 failure
     * mode, reproduced in 2.8's Debug Log).
     */
    it('renders the authored record and never throws when the investigation data is missing', () => {
        const bare = debriefState('en', { completion: undefined });
        expect(() => mount(bare)).not.toThrow();
        const texts = mount(bare).slice.texts();
        expect(texts).toContain(definition.debrief.historicalComparison.text.en);
        expect(texts).toContain(en['debrief.record.unavailable']);
        expect(texts.filter((text) => text.startsWith('CANONICAL'))).toEqual([]);
    });

    it('drops a challenge whose authored line this build no longer carries, rather than heading nothing', () => {
        const degraded = mount(debriefState('en', {
            completion: completion({
                critiqueHistory: [{ proposalId: 'p-9', critiqueId: 'critique-gone', timestamp: '2026-08-07T10:00:00.000Z' }]
            })
        }));
        expect(degraded.slice.texts()).toContain(en['debrief.critiques.empty']);
        expect(degraded.slice.texts().some((text) => text.includes('Mr. Arthur Bell'))).toBe(false);
    });

    it('repaints in the new language when the locale changes under it', () => {
        harness.render(debriefState('fr'));
        const texts = harness.slice.texts();
        expect(texts).toContain(fr['debrief.heading']);
        expect(texts).toContain(definition.debrief.summary.fr);
        expect(texts).toContain(definition.debrief.historicalComparison.text.fr);
        expect(texts).not.toContain(en['debrief.heading']);
    });

    /**
     * §Animation and reduced motion: the cheapest correct option is none at all, and this room takes
     * it. Asserted rather than described — a later story that adds a tween inherits the whole contract
     * and should have to change this line to do it.
     */
    it('registers no update loop and starts no tween', () => {
        expect(harness.slice.updateHandlers).toHaveLength(0);
        // The tween half of this test's own name. `sceneSlice` records `tweens.add` now, so this
        // fails if either surface ever starts one without taking on the reduced-motion contract.
        expect(harness.slice.tweens).toHaveLength(0);
        expect(harness.slice.keyboardListeners).toHaveLength(0);
    });

    it('releases every display object it made', () => {
        const made = harness.slice.drawn.length;
        expect(made).toBeGreaterThan(0);
        harness.renderer.destroy();
        expect(harness.slice.drawn.filter(({ state }) => !state.destroyed)).toEqual([]);
    });
});
