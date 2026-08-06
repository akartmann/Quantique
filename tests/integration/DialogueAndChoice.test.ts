import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createPhaserStoreAdapter } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import {
    selectDialogueBeats,
    selectPortableCaseRecord,
    selectSelectedConclusionProposalId,
    selectSelectedPredictionProposalId
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CASE_PHASES } from '../../src/domain/cases/CaseProgress';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * AC2 and AC3, driven through the exact seam the widgets use.
 *
 * `ProposalChoice.onChoose` calls `PhaserStoreAdapter.chooseProposal`, so that adapter over a **real
 * `createStore`** is what these tests exercise — the public action and the authoritative state it
 * produces, never a widget internal, a Phaser private field, or an incidental pixel. Testing through
 * the adapter rather than dispatching by hand is the point: it is the adapter that maps a widget's
 * "the player picked this" into the right typed intent, and a swapped mapping is exactly the defect a
 * hand-written dispatch could not catch.
 *
 * The authored Young content, not a hand-built fixture: the canonical `.en` text a saved record has to
 * revalidate against comes from the case that actually ships.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

const storeAtPrediction = (locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    return store;
};

/** Through to synthesis, which is the earliest a conclusion may be chosen. */
const storeAtSynthesis = (locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = storeAtPrediction(locale);
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
    store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.35, origin: 'phaser' });
    store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    return store;
};

describe('choosing a proposal through the widget seam', () => {
    it('dispatches the prediction intent and writes both the ID and the canonical text', () => {
        const store = storeAtPrediction();
        const adapter = createPhaserStoreAdapter(store);
        const [first] = definition.predictionProposals;

        expect(adapter.chooseProposal('prediction', first.id)).toEqual({ ok: true, value: undefined });

        expect(selectSelectedPredictionProposalId(store.getState())).toBe(first.id);
        // Canonical `.en`, whatever the interface language: this value is persisted and
        // equality-validated on load.
        expect(store.getState().prediction).toBe(first.text.en);
        // And the conclusion side is untouched — the adapter maps each kind to its own action.
        expect(selectSelectedConclusionProposalId(store.getState())).toBeUndefined();
    });

    it('dispatches the conclusion intent and writes the claim and the limitation', () => {
        const store = storeAtSynthesis();
        const adapter = createPhaserStoreAdapter(store);
        const [first] = definition.conclusionProposals;

        expect(adapter.chooseProposal('conclusion', first.id)).toEqual({ ok: true, value: undefined });

        expect(selectSelectedConclusionProposalId(store.getState())).toBe(first.id);
        expect(store.getState().theory.conclusion).toBe(first.claim.en);
        expect(store.getState().theory.limitation).toBe(first.limitation.en);
    });

    it('writes canonical English through the adapter even in a French session', () => {
        const store = storeAtPrediction('fr');
        const adapter = createPhaserStoreAdapter(store);
        const [first] = definition.predictionProposals;

        adapter.chooseProposal('prediction', first.id);

        expect(store.getState().prediction).toBe(first.text.en);
        expect(store.getState().prediction).not.toBe(first.text.fr);
    });

    // AC2: the choice remains revisable. Re-choosing must never fail on "already chosen".
    it.each([
        ['prediction', () => storeAtPrediction(), () => definition.predictionProposals, selectSelectedPredictionProposalId],
        ['conclusion', () => storeAtSynthesis(), () => definition.conclusionProposals, selectSelectedConclusionProposalId]
    ] as const)('leaves a %s choice revisable, including re-picking the same one', (kind, makeStore, proposals, selectId) => {
        const store = makeStore();
        const adapter = createPhaserStoreAdapter(store);
        const [first, second] = proposals();

        expect(adapter.chooseProposal(kind, first.id)).toEqual({ ok: true, value: undefined });
        expect(adapter.chooseProposal(kind, first.id)).toEqual({ ok: true, value: undefined });
        expect(adapter.chooseProposal(kind, second.id)).toEqual({ ok: true, value: undefined });

        expect(selectId(store.getState())).toBe(second.id);
    });

    it.each([
        ['prediction', () => storeAtPrediction(), 'unknown-prediction-proposal'],
        ['conclusion', () => storeAtSynthesis(), 'unknown-conclusion-proposal']
    ] as const)('refuses an unauthored %s ID with a typed failure and leaves state untouched', (kind, makeStore, code) => {
        const store = makeStore();
        const adapter = createPhaserStoreAdapter(store);
        const before = store.getState();

        expect(adapter.chooseProposal(kind, 'invented-by-the-widget'))
            .toMatchObject({ ok: false, error: { code } });

        // The same object, not merely an equal one: a refused choice must not produce a new state.
        expect(store.getState()).toBe(before);
    });
});

describe('authored dialogue beats', () => {
    /** The selector's input, with the phase moved. The projection under test is never stood in for. */
    const beatsAt = (phase: typeof CASE_PHASES[number], locale: 'en' | 'fr' = 'en') =>
        selectDialogueBeats({ ...createInitialAppState(definition, locale), phase });

    it('authors a conversation for exactly the phases whose scene is real today', () => {
        const authored = CASE_PHASES.filter((phase) => beatsAt(phase).length > 0);

        // `context` and `experiment` get theirs from Stories 2.1 and 2.2/2.6; `debrief` from 2.3.
        // Beats authored for a `PhasePlaceholderScene` would validate and render nowhere.
        expect(authored).toEqual(['prediction', 'synthesis', 'review']);
    });

    it('attributes every authored beat to a colleague in the cast, in both locales', () => {
        const cast = definition.colleagues.map(({ name }) => name);

        for (const locale of ['en', 'fr'] as const) {
            const beats = (['prediction', 'synthesis', 'review'] as const).flatMap((phase) => beatsAt(phase, locale));
            expect(beats.length).toBeGreaterThan(0);
            expect(beats.filter(({ speaker }) => !cast.some((name) => speaker.startsWith(name)))).toEqual([]);
            // Nothing left untranslated and nothing degraded to the `—` floor.
            expect(beats.filter(({ text }) => text.trim().length < 2)).toEqual([]);
        }
    });

    it('reads differently in French, so no beat is shipping English to a French player', () => {
        for (const phase of ['prediction', 'synthesis', 'review'] as const) {
            const english = beatsAt(phase).map(({ text }) => text);
            const french = beatsAt(phase, 'fr').map(({ text }) => text);

            expect(french).toHaveLength(english.length);
            expect(french.filter((text, index) => text === english[index])).toEqual([]);
        }
    });

    // Exact equality, not `toMatchObject`: AC3's separation turns on the projection carrying *nothing*
    // beyond what a dialogue widget needs, and a matcher that ignores extra keys would pass just as
    // happily if a defensibility signal were added to it.
    it('projects nothing beyond what the widget renders', () => {
        for (const beat of beatsAt('synthesis')) {
            expect(Object.keys(beat).sort()).toEqual(['id', 'speaker', 'text']);
        }
    });

    it('keeps beat IDs unique within each conversation', () => {
        for (const phase of ['prediction', 'synthesis', 'review'] as const) {
            const ids = beatsAt(phase).map(({ id }) => id);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });
});

/**
 * The "beat advancement is ephemeral" decision, guarded the way `LocaleStore` guards the absence of a
 * language control: if a beat index were ever persisted it would need a record field and a migration,
 * and it would hand a scene something that looks like progression state (ADR-009).
 */
describe('beat position is never persisted', () => {
    it('carries no dialogue or beat field in the portable case record', () => {
        const record = selectPortableCaseRecord(storeAtSynthesis().getState());

        expect(record.ok).toBe(true);
        if (!record.ok) return;
        expect(Object.keys(record.value).filter((key) => /dialogue|beat/i.test(key))).toEqual([]);
    });

    it('leaves the authoritative state unchanged by anything a conversation can do', () => {
        // There is no action a dialogue widget could dispatch: it is given a callback, not the store.
        // The whole action union is exercised elsewhere; what matters here is that reaching the phase
        // that authors beats does not itself record anything about reading them.
        const state = storeAtSynthesis().getState();

        expect(Object.keys(state).filter((key) => /dialogue|beat/i.test(key))).toEqual([]);
    });
});
