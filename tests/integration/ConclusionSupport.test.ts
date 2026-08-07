import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import {
    selectConclusionReadiness,
    selectLocalizedConclusionReadiness,
    selectLocalizedPeerReview
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The six intents the case file carries, and the projection it reads, through **public actions and
 * selectors only** (Story 2.11, AC5 and AC7).
 *
 * `ReviewFlow.test.ts` and `TheoryStore.test.ts` already cover the store's own behaviour for the four
 * support intents and the two review ones. **What is new is the projection the overlay reads** — the
 * localized readiness list AC7 promises and the localized peer review D3 requires — and the one rule
 * the surface has to hold rather than the store: it reads the selection first, so a repeat is never
 * dispatched and a refusal the player did nothing to earn is never provoked. That rule is asserted
 * from the other side here (the reducer *does* refuse a repeat, which is why the surface must not send
 * one) and from the surface's side in `CaseFileRenderer.test.ts`.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/** A store at `synthesis` with two observations recorded at different throws and a saved comparison. */
const atTheBoard = (locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    const screen = definition.apparatus.primaryControls.find(({ id }) => id === 'screenDistanceM')!;
    [0, 1].forEach((index) => {
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: screen.min + (index * screen.step), origin: 'phaser' });
        store.dispatch({ type: 'experiment.run', id: `run-${index + 1}`, timestamp: `2026-08-07T10:0${index}:00.000Z` });
    });
    ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'comparison.runSelected', runId }));
    store.dispatch({ type: 'comparison.noteSaved', note: 'The spacing widens with the screen distance.' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    return store;
};

/** Everything the readiness list asks for, so `selectConclusionReadiness` reaches `ready`. */
const pinEverything = (store: AppStore): void => {
    ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId: id }));
    store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
};

describe('pinning what the conclusion rests on', () => {
    it('adds and removes an observation, and answers a repeat with a refusal the surface must not provoke', () => {
        const store = atTheBoard();

        expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().theory.selectedRunIds).toEqual(['run-1']);

        // The reducer is right to refuse this. The **surface** is what must never send it: a player
        // pressing a pinned row is asking to unpin, not to pin twice.
        expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' }))
            .toMatchObject({ ok: false, error: { code: 'duplicate-theory-run' } });

        expect(store.dispatch({ type: 'theory.supportRunUnselected', runId: 'run-1' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().theory.selectedRunIds).toEqual([]);
        expect(store.dispatch({ type: 'theory.supportRunUnselected', runId: 'run-1' }))
            .toMatchObject({ ok: false, error: { code: 'theory-run-not-selected' } });
    });

    it('adds and removes an inspected reference, and refuses one that was never read', () => {
        const store = atTheBoard();
        const [first] = definition.contextualArtifacts;

        expect(store.dispatch({ type: 'theory.supportSourceSelected', sourceId: first.id })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'theory.supportSourceSelected', sourceId: first.id }))
            .toMatchObject({ ok: false, error: { code: 'duplicate-theory-source' } });
        expect(store.dispatch({ type: 'theory.supportSourceUnselected', sourceId: first.id })).toEqual({ ok: true, value: undefined });

        // Unreachable from the case file, which offers only inspected artifacts — asserted so the
        // surface's guard has something to be a guard *against*.
        const unread = createStore(createInitialAppState(definition));
        expect(unread.dispatch({ type: 'theory.supportSourceSelected', sourceId: first.id }))
            .toMatchObject({ ok: false, error: { code: 'uninspected-theory-source' } });
    });

    /** Support is adjustable in **both** phases the board hosts: the reducers carry no phase gate. */
    it('keeps the support adjustable in review as well as in synthesis', () => {
        const store = atTheBoard();
        pinEverything(store);
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().phase).toBe('review');

        expect(store.dispatch({ type: 'theory.supportRunUnselected', runId: 'run-2' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-2' })).toEqual({ ok: true, value: undefined });
    });
});

describe('what the readiness list tells the player (AC7)', () => {
    it('empties as the support is pinned, and reports completeness when nothing is left', () => {
        const store = atTheBoard();
        expect(selectLocalizedConclusionReadiness(store.getState()).length).toBeGreaterThan(0);

        pinEverything(store);
        expect(selectConclusionReadiness(store.getState()).status).toBe('ready');
        expect(selectLocalizedConclusionReadiness(store.getState())).toEqual([]);
    });

    /**
     * **The projection never falls back**, in either locale.
     *
     * `translate` answers a key neither bundle carries with a humanised final segment, so a code the
     * domain emits and the bundle has stopped authoring would reach the player as
     * `"Minimum runs"` rather than as a sentence — green everywhere else, and unreadable on screen.
     * `MissingConclusionRequirementCode` is a type union with no runtime counterpart, so the roster
     * cannot be swept; this drives the store into states that produce codes instead and checks each
     * resolved line against the bundle it should have come from.
     */
    it('resolves every readiness code it produces to an authored line, in both locales', () => {
        (['en', 'fr'] as const).forEach((locale) => {
            const bundle = locale === 'en' ? en : fr;
            const store = atTheBoard(locale);

            // Three deliberately different records, so several codes are produced across the sweep.
            const states = [store.getState()];
            store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' });
            states.push(store.getState());
            store.dispatch({ type: 'theory.supportSourceSelected', sourceId: definition.contextualArtifacts[0].id });
            store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
            states.push(store.getState());

            const seen = new Set<string>();
            states.forEach((state) => {
                const codes = selectConclusionReadiness(state).missing.map(({ code }) => code);
                const lines = selectLocalizedConclusionReadiness(state);
                expect(lines).toHaveLength(codes.length);

                codes.forEach((code, index) => {
                    seen.add(code);
                    const authored = bundle[`conclusion.missing.${code}`];
                    expect(authored, `${code} (${locale})`).toBeDefined();
                    // Interpolated where the authored string carries a count, so a raw `{count}` fails.
                    expect(lines[index]).not.toContain('{count}');
                    expect(lines[index].startsWith(authored.split('{')[0])).toBe(true);
                });
            });
            // The sweep has to actually exercise something: an empty roster would make it vacuous.
            expect(seen.size).toBeGreaterThan(1);
        });
    });

    /**
     * AC7 again, from the other side: the readiness list is a fact about the player's own record, so
     * the same record produces the same list whichever conclusion is chosen.
     *
     * A projection that leaked an opinion about the evidence would differ between a claim the case
     * challenges and one it does not — and this is a behavioural check rather than the source-level
     * sweep `CharacterStageView.test.ts` runs, so the two fail for different reasons.
     */
    it('reports the same missing requirements whichever conclusion is chosen', () => {
        const lists = definition.conclusionProposals.map((proposal) => {
            const store = atTheBoard();
            store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' });
            store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: proposal.id });
            return selectLocalizedConclusionReadiness(store.getState());
        });

        expect(lists.length).toBeGreaterThan(1);
        lists.slice(1).forEach((list) => expect(list).toEqual(lists[0]));
    });
});

describe('asking the reviewers (AC5)', () => {
    it('refuses feedback outside review and returns a projection inside it', () => {
        const store = atTheBoard();
        expect(store.dispatch({ type: 'peerReview.requested' }))
            .toMatchObject({ ok: false, error: { code: 'peer-review-unavailable' } });
        expect(selectLocalizedPeerReview(store.getState())).toBeUndefined();

        pinEverything(store);
        store.dispatch({ type: 'theory.reviewRequested' });
        expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });
        expect(selectLocalizedPeerReview(store.getState())?.status).toBe('reviewed');
    });

    it('refuses a revision without reviewed feedback, and saves one with it', () => {
        const store = atTheBoard();
        pinEverything(store);
        store.dispatch({ type: 'theory.reviewRequested' });

        expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-08-07T11:00:00.000Z' }))
            .toMatchObject({ ok: false, error: { code: 'revision-review-required' } });

        store.dispatch({ type: 'peerReview.requested' });
        expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-08-07T11:00:00.000Z' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().decisionHistory).toHaveLength(1);
    });

    /**
     * `reduceRevisionSave` **clears** `peerReview` on success, so asking again after a save is a fresh
     * request rather than a no-op — and the surface has to re-arm its save control accordingly. Stated
     * in the adapter's docstring and asserted here.
     */
    it('clears the feedback on save, so the next request is a fresh one', () => {
        const store = atTheBoard();
        pinEverything(store);
        store.dispatch({ type: 'theory.reviewRequested' });
        store.dispatch({ type: 'peerReview.requested' });
        store.dispatch({ type: 'revision.saved', timestamp: '2026-08-07T11:00:00.000Z' });

        expect(selectLocalizedPeerReview(store.getState())).toBeUndefined();
        expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });
        expect(selectLocalizedPeerReview(store.getState())?.status).toBe('reviewed');
    });
});
