import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import {
    FIGURE_MAX_HEIGHT,
    figureLabelHeight,
    presentColleagueIds,
    resolveCharacterStage,
    type StageCastMember
} from '../../src/adapters/phaser/renderers/characterStageView';
import { createTranslator, translate } from '../../src/core/i18n/translate';
import { boardProposerIds, resolveStageCast } from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import {
    selectCasePhase,
    selectColleagues,
    selectDialogueBeats,
    selectLocale,
    selectLocalizedConclusionProposals,
    selectLocalizedPredictionProposals
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * Character staging against the **authored Young case**, through public actions and selectors only
 * (Story 2.9, AC7).
 *
 * Driven from the shipped content rather than a fixture, as `RivalLabCritique.test.ts` is: the beats,
 * the cast, the accents and the two proposal orderings all have to agree with each other in the content
 * that actually ships, and a fixture proves only that the code agrees with itself.
 *
 * ## Be honest about the seam
 *
 * The reading position is **widget-local and deliberately not in the store** — that is `DialogueBox`'s
 * stated contract, and an `AppState` beat index would have to be cleared on every phase move and every
 * replay. So no public action can move it, and this test does not pretend otherwise: it drives the
 * *store* for the beats and the *resolver* for the position, and asserts the pair. What it proves is
 * that the two halves compose — that successive reading positions in a real conversation foreground
 * successively different real colleagues.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

const storeAt = (locale: 'en' | 'fr' = 'en'): AppStore => createStore(createInitialAppState(definition, locale));

/**
 * Moves the case to a phase through **public actions only**, never by writing state.
 *
 * `review` is not reachable with `case.phaseAdvance`: it is entered through `theory.reviewRequested`,
 * which first requires full conclusion readiness — two runs at different slit spacings, a saved
 * comparison of them, both sources inspected and selected, and a chosen conclusion. Earlier drafts of
 * this helper simply dispatched the phase move and let the refusal fall on the floor, which left the
 * case sitting in `synthesis` while the tests below believed they were reading `review`'s conversation
 * and passed on synthesis's beats. The arrival assertion at the end is what makes that impossible: a
 * refused transition now fails the test that depends on it rather than silently weakening it.
 */
const advanceTo = (store: AppStore, phase: 'prediction' | 'synthesis' | 'review'): AppStore => {
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });

    if (phase !== 'prediction') {
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-07T12:00:00.000Z' });
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.35, origin: 'phaser' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-07T12:01:00.000Z' });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-2' });
        store.dispatch({ type: 'comparison.noteSaved', note: 'The band spacing changes with the slit separation.' });
        store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' });
        store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-2' });
        definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId: id }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    }

    if (phase === 'review') {
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclusion-spacing-varies' });
        store.dispatch({ type: 'theory.reviewRequested' });
    }

    expect(selectCasePhase(store.getState())).toBe(phase);
    return store;
};

/** A band with room for a full-height figure and its plaque, as the prediction board provides. */
const BAND = { top: 120, height: FIGURE_MAX_HEIGHT + figureLabelHeight() + 20 } as const;
const AREA = { x: 40, width: 944 } as const;

/**
 * The board's cast — through the **production** resolver, not a copy of it.
 *
 * This helper used to re-implement `ColleagueRenderer.stageCast` line for line, which meant it could
 * not fail on any change to the thing it was named after: swapping the prediction proposals for the
 * conclusion ones in the real method left every assertion here green, because the real method never
 * ran. `resolveStageCast` was extracted so this reads the rule instead of restating it (2.9 review).
 */
const boardCast = (store: AppStore, kind: 'prediction' | 'conclusion'): readonly StageCastMember[] => {
    const state = store.getState();
    const scene = state.caseDefinition.scenarioScript.scenes.find(({ phase }) => phase === selectCasePhase(state));

    return resolveStageCast({
        colleagues: selectColleagues(state),
        proposerIds: boardProposerIds(state.caseDefinition, kind),
        speakerIds: (scene?.dialogueBeats ?? []).map(({ speakerId }) => speakerId),
        t: createTranslator(selectLocale(state))
    });
};

describe('the dialogue projection carries who is speaking', () => {
    it.each(['prediction', 'synthesis', 'review'] as const)('attributes every %s beat to a real colleague', (phase) => {
        const store = advanceTo(storeAt(), phase);
        const beats = selectDialogueBeats(store.getState());
        const castIds = selectColleagues(store.getState()).map(({ id }) => id);

        expect(beats.length).toBeGreaterThan(0);
        beats.forEach((beat) => {
            expect(beat.speakerId).not.toBe('');
            // The authored content resolves; the degraded-content fallback is unit-tested separately.
            expect(castIds).toContain(beat.speakerId);
        });
    });

    /**
     * `TheoryBoard` hosts both `synthesis` and `review`, which is what makes the phase — not the scene
     * key — the conversation's identity. A staging surface keyed on the scene would foreground the
     * wrong people after the transition.
     */
    it('swaps the conversation when the phase moves under one scene key', () => {
        const store = advanceTo(storeAt(), 'synthesis');
        const synthesis = selectDialogueBeats(store.getState()).map(({ speakerId }) => speakerId);

        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });
        const review = selectDialogueBeats(store.getState()).map(({ speakerId }) => speakerId);

        expect(synthesis).not.toEqual(review);
        expect(synthesis.length).toBeGreaterThan(0);
        expect(review.length).toBeGreaterThan(0);
    });
});

describe('reading a conversation re-stages the speaker', () => {
    /**
     * `prediction` and `synthesis` each author three beats with three *distinct* speakers, which is
     * what makes this assertion able to fail: a conversation whose speakers repeated would foreground
     * the same figure at every position and pass a weaker version of this test for free.
     */
    it.each(['prediction', 'synthesis'] as const)('foregrounds a different colleague at each %s position', (phase) => {
        const store = advanceTo(storeAt(), phase);
        const beats = selectDialogueBeats(store.getState());
        const kind = phase === 'prediction' ? 'prediction' : 'conclusion';
        const cast = boardCast(store, kind);

        const speakers = new Set(beats.map(({ speakerId }) => speakerId));
        expect(speakers.size).toBeGreaterThan(1);

        // One resolve per reading position — the seam: the store supplies the beats, the resolver the
        // position, and the pair is what a reader actually sees.
        const foregrounded = beats.map((beat) => resolveCharacterStage({
            cast,
            speakerColleagueId: beat.speakerId,
            band: BAND,
            area: AREA,
            motionAllowed: true
        }).figures.find(({ isSpeaker }) => isSpeaker)?.colleagueId);

        expect(foregrounded).toEqual(beats.map(({ speakerId }) => speakerId));
        expect(new Set(foregrounded).size).toBe(speakers.size);
    });

    it('foregrounds exactly one figure at a time', () => {
        const store = advanceTo(storeAt(), 'prediction');
        const cast = boardCast(store, 'prediction');

        selectDialogueBeats(store.getState()).forEach((beat) => {
            const view = resolveCharacterStage({
                cast, speakerColleagueId: beat.speakerId, band: BAND, area: AREA, motionAllowed: true
            });
            expect(view.figures.filter(({ isSpeaker }) => isSpeaker)).toHaveLength(1);
        });
    });
});

describe('the row is ordered by proposal, and carries the authored identity', () => {
    /**
     * The two boards attribute in **different orders** — prediction is `thea, elias, marianne, samuel`
     * and conclusion is `marianne, elias, thea, samuel` — which is exactly why the stage is ordered by
     * proposal rather than by cast. Read from the content, so a re-ordering of `case.json` cannot make
     * this pass by agreeing with a memorised list.
     */
    it.each([
        ['prediction', 'prediction'],
        ['synthesis', 'conclusion']
    ] as const)('pairs the %s row with the proposals, in proposal order', (phase, kind) => {
        const store = advanceTo(storeAt(), phase);
        const state = store.getState();
        const proposals = kind === 'prediction'
            ? selectLocalizedPredictionProposals(state)
            : selectLocalizedConclusionProposals(state);
        const cast = boardCast(store, kind);

        const view = resolveCharacterStage({ cast, band: BAND, area: AREA, motionAllowed: true });

        // Figure i stands in slot i, left to right, and card i is proposal i top to bottom.
        expect(view.figures).toHaveLength(proposals.length);
        view.figures.forEach((figure, index) => {
            expect(figure.name).toBe(proposals[index]!.colleagueName);
            expect(figure.roleLabel).toBe(proposals[index]!.roleLabel);
        });
    });

    it('puts the two boards in genuinely different orders, so the pairing is doing work', () => {
        const prediction = boardCast(advanceTo(storeAt(), 'prediction'), 'prediction')
            .map(({ colleagueId }) => colleagueId);
        const conclusion = boardCast(advanceTo(storeAt(), 'synthesis'), 'conclusion')
            .map(({ colleagueId }) => colleagueId);

        expect(prediction).not.toEqual(conclusion);
        expect([...prediction].sort()).toEqual([...conclusion].sort());
    });

    it('authors each shipped portrait image with its preserved vector fallback', () => {
        const store = advanceTo(storeAt(), 'prediction');
        const expectedFallbacks = {
            'thea-young': { accentColor: '#c9a227', figure: { build: 'gowned', pose: 'raising-instrument', hair: 'upswept', hairColor: 'dark', skinTone: 'light' } },
            'elias-wren': { accentColor: '#4f8a8b', figure: { build: 'suited', pose: 'holding-paper', hair: 'swept', hairColor: 'dark', skinTone: 'light', spectacles: true } },
            'marianne-cole': { accentColor: '#9c6b98', figure: { build: 'gowned', pose: 'holding-paper', hair: 'upswept', hairColor: 'auburn', skinTone: 'light' } },
            'samuel-hart': { accentColor: '#b8653f', figure: { build: 'suited', pose: 'presenting', hair: 'cropped', hairColor: 'dark', skinTone: 'light', moustache: true } }
        } as const;

        selectColleagues(store.getState()).forEach((colleague) => {
            const fallback = expectedFallbacks[colleague.id];
            expect(fallback).toBeDefined();
            expect(colleague.portrait).toEqual({
                kind: 'asset',
                assetId: `${colleague.id}-portrait`,
                ...fallback
            });
        });
    });
});

describe('the rival is not one of the cast (AC4)', () => {
    it('authors Mr. Arthur Bell outside colleagues[]', () => {
        const state = storeAt().getState();

        expect(state.caseDefinition.rivalLab.name).toBe('Mr. Arthur Bell');
        expect(selectColleagues(state).map(({ name }) => name)).not.toContain(state.caseDefinition.rivalLab.name);
        expect(selectColleagues(state).map(({ id }) => id)).not.toContain('rival-lab');
    });

    /**
     * Presence is derived from the board's own proposals and beats, so the rival can never be swept
     * into a colleague stage by a future scene: he authors neither.
     */
    it('never appears in a board stage, in any phase that has one', () => {
        (['prediction', 'synthesis', 'review'] as const).forEach((phase) => {
            const store = advanceTo(storeAt(), phase);
            const kind = phase === 'prediction' ? 'prediction' : 'conclusion';

            expect(boardCast(store, kind).map(({ name }) => name))
                .not.toContain(store.getState().caseDefinition.rivalLab.name);
        });
    });
});

describe('locale', () => {
    /** Proper nouns stay canonical; only the prose and the role labels move with the locale. */
    it('keeps colleague names canonical while the beats translate', () => {
        const english = advanceTo(storeAt('en'), 'prediction');
        const french = advanceTo(storeAt('fr'), 'prediction');

        expect(boardCast(french, 'prediction').map(({ name }) => name))
            .toEqual(boardCast(english, 'prediction').map(({ name }) => name));
        expect(selectDialogueBeats(french.getState()).map(({ text }) => text))
            .not.toEqual(selectDialogueBeats(english.getState()).map(({ text }) => text));
        // The speaker *ids* are locale-independent, which is what makes staging work in both.
        expect(selectDialogueBeats(french.getState()).map(({ speakerId }) => speakerId))
            .toEqual(selectDialogueBeats(english.getState()).map(({ speakerId }) => speakerId));
    });
});

describe('degraded content', () => {
    /**
     * The path the copied helper could not reach, and the one that matters most.
     *
     * `ColleagueRenderer.create()` runs synchronously inside `dispatch() → notify()`, so a throw here
     * would advance the phase, skip every later subscriber, and break `dispatch`'s `Result` contract
     * (1.10 review). The old test helper resolved colleagues with a non-null assertion, so it asserted
     * the exact opposite of what production does: it would have thrown where production degrades, and
     * nothing covered the difference (2.9 review).
     */
    it('stages a proposer the cast no longer authors, without throwing', () => {
        const store = advanceTo(storeAt(), 'prediction');
        const t = createTranslator(selectLocale(store.getState()));
        const colleagues = selectColleagues(store.getState());

        const cast = resolveStageCast({
            colleagues,
            proposerIds: [...colleagues.map(({ id }) => id), 'a-colleague-this-build-dropped'],
            speakerIds: [],
            t
        });

        const orphan = cast.find(({ colleagueId }) => colleagueId === 'a-colleague-this-build-dropped');
        expect(orphan).toBeDefined();
        // A stand-in label rather than a blank plaque, the same one the dialogue attribution falls back
        // to, and a legible neutral accent rather than a parse of `undefined`.
        expect(orphan!.name).toBe(t('colleague.unattributedSpeaker'));
        expect(Number.isFinite(orphan!.accentColor)).toBe(true);
        // And it still gets a figure to draw: a plain standing pose, never `undefined`.
        expect(orphan!.appearance).toBeDefined();
    });

    /** A speaker who authored no proposal is present, which is what `presentColleagueIds` is for. */
    it('adds a beat speaker who authored nothing to the room', () => {
        const store = advanceTo(storeAt(), 'prediction');
        const colleagues = selectColleagues(store.getState());
        const [first, ...rest] = colleagues;

        const cast = resolveStageCast({
            colleagues,
            proposerIds: rest.map(({ id }) => id),
            speakerIds: [first!.id],
            t: createTranslator(selectLocale(store.getState()))
        });

        expect(cast.map(({ colleagueId }) => colleagueId)).toContain(first!.id);
        // Proposal order first, then the speaker who authored nothing — a stable reading order.
        expect(cast[cast.length - 1]!.colleagueId).toBe(first!.id);
    });
});
