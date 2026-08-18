import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    EMPHASIS_TWEEN_MS,
    FIGURE_MAX_HEIGHT,
    FIGURE_MAX_WIDTH,
    MIN_LEGIBLE_FIGURE_HEIGHT,
    NEUTRAL_ALPHA,
    NEUTRAL_SCALE,
    RECEDED_ALPHA,
    RECEDED_SCALE,
    SELECTED_ALPHA,
    SELECTED_SCALE,
    SPEAKER_ALPHA,
    SPEAKER_LIFT,
    SPEAKER_SCALE,
    figureLabelHeight,
    presentColleagueIds,
    resolveCharacterStage,
    type StageCastMember
} from '../../src/adapters/phaser/renderers/characterStageView';

/**
 * The staging resolver, tested without Phaser (Story 2.9, AC7).
 *
 * `CharacterStage` imports Phaser types and builds display objects; `characterStageView` is the
 * decidable half — where each figure stands, which one is foregrounded, and whether motion is allowed
 * — split out precisely so a Vitest run can drive it. `advanceView.ts` and `libraryGeometry.ts` exist
 * for the same reason, and the Story 2.6 review is why: a rendering path with no Phaser-free module
 * shipped with no automated coverage at all.
 *
 * Every geometry assertion reads the module's own exported constants rather than restating a number.
 * A test that restates a source constant stops covering it the moment the source changes.
 */

const CAST: readonly StageCastMember[] = [
    { colleagueId: 'thea-young', accentColor: 0xc9a227, name: 'Dr. Thea Young', roleLabel: 'Lead' },
    { colleagueId: 'elias-wren', accentColor: 0x4f8a8b, name: 'Elias Wren', roleLabel: 'Instrument maker' },
    { colleagueId: 'marianne-cole', accentColor: 0x9c6b98, name: 'Marianne Cole', roleLabel: 'Analyst' },
    { colleagueId: 'samuel-hart', accentColor: 0xb8653f, name: 'Samuel Hart', roleLabel: 'Communicator' }
];

/** A band with room for a full-height figure plus its plaque, as the prediction board provides. */
const ROOMY = { top: 160, height: FIGURE_MAX_HEIGHT + figureLabelHeight() + 20 } as const;
const AREA = { x: 40, width: 944 } as const;

describe('resolveCharacterStage — the row', () => {
    it('stands the cast in a row, left to right, in the order given', () => {
        const view = resolveCharacterStage({ cast: CAST, band: ROOMY, area: AREA, motionAllowed: true });

        expect(view.figures.map(({ colleagueId }) => colleagueId))
            .toEqual(['thea-young', 'elias-wren', 'marianne-cole', 'samuel-hart']);
        const xs = view.figures.map(({ x }) => x);
        expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    });

    /**
     * Slots are **total over the count**: a cast of three fills the area rather than leaving a gap
     * where a fourth would have been, and no coordinate derived for four is reused at three.
     */
    it.each([2, 3, 4])('divides the area into %i equal slots that fill it', (count) => {
        const view = resolveCharacterStage({
            cast: CAST.slice(0, count), band: ROOMY, area: AREA, motionAllowed: true
        });

        expect(view.figures).toHaveLength(count);
        const slot = AREA.width / count;
        view.figures.forEach((figure, index) => {
            expect(figure.x).toBeCloseTo(AREA.x + (slot * (index + 0.5)), 6);
            expect(figure.labelWrapWidth).toBeCloseTo(slot, 6);
        });
        // The row spans the area: first and last are half a slot from each edge.
        expect(view.figures[0]!.x - AREA.x).toBeCloseTo(slot / 2, 6);
        expect((AREA.x + AREA.width) - view.figures[count - 1]!.x).toBeCloseTo(slot / 2, 6);
    });

    it('stands every figure on one floor line, with the plaque below it', () => {
        const view = resolveCharacterStage({ cast: CAST, band: ROOMY, area: AREA, motionAllowed: true });

        expect(view.floorY).toBe(ROOMY.top + ROOMY.height - figureLabelHeight());
        view.figures.forEach((figure) => {
            expect(figure.y).toBe(view.floorY);
            expect(figure.nameY).toBeGreaterThan(view.floorY);
            expect(figure.roleY).toBeGreaterThan(figure.nameY);
            expect(figure.roleY).toBeLessThan(ROOMY.top + ROOMY.height);
            // Standing upward from the floor, never above the band.
            expect(figure.y - figure.height).toBeGreaterThanOrEqual(ROOMY.top);
        });
    });

    /** Two band sizes, so a memorised dimension fails. Nothing may close over a canvas here. */
    it('derives everything from the band it is given', () => {
        const tall = resolveCharacterStage({ cast: CAST, band: ROOMY, area: AREA, motionAllowed: true });
        const short = resolveCharacterStage({
            cast: CAST, band: { top: 200, height: 180 }, area: AREA, motionAllowed: true
        });

        expect(short.figures[0]!.height).toBeLessThan(tall.figures[0]!.height);
        expect(short.floorY).not.toBe(tall.floorY);
        expect(tall.figures[0]!.height).toBe(FIGURE_MAX_HEIGHT);
    });

    it('keeps the figure in proportion as the band shrinks it', () => {
        const view = resolveCharacterStage({
            cast: CAST, band: { top: 200, height: 180 }, area: AREA, motionAllowed: true
        });
        const { width, height } = view.figures[0]!;

        expect(width / height).toBeCloseTo(FIGURE_MAX_WIDTH / FIGURE_MAX_HEIGHT, 6);
    });

    /** A crowded row narrows the person rather than letting neighbours overlap. */
    it('never draws wider than its slot', () => {
        const view = resolveCharacterStage({
            cast: CAST, band: ROOMY, area: { x: 40, width: 240 }, motionAllowed: true
        });

        const slot = 240 / CAST.length;
        view.figures.forEach((figure) => expect(figure.width).toBeLessThan(slot));
    });

    it('carries the authored accent, name, and role through untouched', () => {
        const view = resolveCharacterStage({ cast: CAST, band: ROOMY, area: AREA, motionAllowed: true });

        expect(view.figures.map(({ accentColor }) => accentColor))
            .toEqual([0xc9a227, 0x4f8a8b, 0x9c6b98, 0xb8653f]);
        expect(view.figures[2]).toMatchObject({ name: 'Marianne Cole', roleLabel: 'Analyst' });
    });

    it('freezes what it returns, as every projection here does', () => {
        const view = resolveCharacterStage({ cast: CAST, band: ROOMY, area: AREA, motionAllowed: true });

        expect(Object.isFrozen(view)).toBe(true);
        expect(Object.isFrozen(view.figures)).toBe(true);
        expect(Object.isFrozen(view.figures[0])).toBe(true);
    });
});

/**
 * The legibility floor.
 *
 * The conclusion board's four cards each carry a claim **and** a stated limitation — 488px of a 768px
 * surface — so after the dialogue panel and the guide there is about 60px of room. Four people drawn
 * into 60px are four dots with names under them, which is worse than an empty room because they claim
 * to be characters and are not. Below the floor the room is painted and the cast is withheld.
 */
describe('resolveCharacterStage — the legibility floor', () => {
    it('withholds the cast when the band cannot hold a legible figure', () => {
        const view = resolveCharacterStage({
            cast: CAST,
            band: { top: 160, height: MIN_LEGIBLE_FIGURE_HEIGHT + figureLabelHeight() - 1 },
            area: AREA,
            motionAllowed: true
        });

        expect(view.figures).toEqual([]);
    });

    it('stages them the moment the band can hold one', () => {
        const view = resolveCharacterStage({
            cast: CAST,
            band: { top: 160, height: MIN_LEGIBLE_FIGURE_HEIGHT + figureLabelHeight() },
            area: AREA,
            motionAllowed: true
        });

        expect(view.figures).toHaveLength(CAST.length);
        expect(view.figures[0]!.height).toBe(MIN_LEGIBLE_FIGURE_HEIGHT);
    });

    /**
     * A host whose figure is naturally smaller than the floor — were one ever added — must not be
     * suppressed by a threshold meant for full-length people. The floor is `min(threshold, max)`.
     */
    it('does not suppress a host whose figure is deliberately small', () => {
        const view = resolveCharacterStage({
            cast: [CAST[0]!],
            band: { top: 0, height: 40 + figureLabelHeight() },
            area: AREA,
            motionAllowed: true,
            maxFigure: { width: 12, height: 40 }
        });

        expect(view.figures).toHaveLength(1);
    });
});

describe('resolveCharacterStage — emphasis', () => {
    it('foregrounds the speaker on the shared floor line and recedes the rest', () => {
        const view = resolveCharacterStage({
            cast: CAST, speakerColleagueId: 'marianne-cole', band: ROOMY, area: AREA, motionAllowed: true
        });

        expect(view.figures.find(({ colleagueId }) => colleagueId === 'marianne-cole')).toMatchObject({
            isSpeaker: true, scale: SPEAKER_SCALE, alpha: SPEAKER_ALPHA, lift: SPEAKER_LIFT
        });
        view.figures
            .filter(({ colleagueId }) => colleagueId !== 'marianne-cole')
            .forEach((figure) => expect(figure).toMatchObject({
                isSpeaker: false, scale: RECEDED_SCALE, alpha: RECEDED_ALPHA, lift: 0
            }));
    });

    /**
     * Emphasis is position, scale, **and** label together — never colour alone (AC2). The three
     * asserted here are the ones that are not colour, and the accents differ in both states so none of
     * them can be standing in for the accent.
     */
    it('marks the speaker by more than its accent', () => {
        const view = resolveCharacterStage({
            cast: CAST, speakerColleagueId: 'thea-young', band: ROOMY, area: AREA, motionAllowed: true
        });
        const [speaker, other] = view.figures;

        expect(speaker!.accentColor).not.toBe(other!.accentColor);
        expect(speaker!.scale).toBeGreaterThan(other!.scale);
        expect(speaker!.alpha).toBeGreaterThan(other!.alpha);
        expect(speaker!.lift).toBe(other!.lift);
        expect(speaker!.isSpeaker).toBe(true);
    });

    /**
     * AC3's connection between a card and its author, now that the figures stand in a row rather than
     * beside their own card: choosing a proposal brings its author forward.
     *
     * It is the player's own choice reflected back — never an evaluation of it. Nothing here can see
     * which conclusion the evidence supports, and the source-level sweep below is what pins that.
     */
    it('brings the chosen colleague forward, between the speaker and the rest', () => {
        const view = resolveCharacterStage({
            cast: CAST,
            speakerColleagueId: 'thea-young',
            selectedColleagueId: 'samuel-hart',
            band: ROOMY,
            area: AREA,
            motionAllowed: true
        });

        const chosen = view.figures.find(({ colleagueId }) => colleagueId === 'samuel-hart')!;
        const bystander = view.figures.find(({ colleagueId }) => colleagueId === 'elias-wren')!;

        expect(chosen).toMatchObject({ isSelected: true, scale: SELECTED_SCALE, alpha: SELECTED_ALPHA });
        expect(chosen.scale).toBeGreaterThan(bystander.scale);
        expect(chosen.scale).toBeLessThan(SPEAKER_SCALE);
        expect(bystander.isSelected).toBe(false);
    });

    it('lets the speaker outrank their own selection', () => {
        const view = resolveCharacterStage({
            cast: CAST,
            speakerColleagueId: 'thea-young',
            selectedColleagueId: 'thea-young',
            band: ROOMY,
            area: AREA,
            motionAllowed: true
        });

        expect(view.figures[0]).toMatchObject({ isSpeaker: true, isSelected: true, scale: SPEAKER_SCALE });
    });

    it('treats every figure alike when nobody is speaking and nothing is chosen', () => {
        const view = resolveCharacterStage({ cast: CAST, band: ROOMY, area: AREA, motionAllowed: true });

        view.figures.forEach((figure) => expect(figure).toMatchObject({
            isSpeaker: false, isSelected: false, scale: NEUTRAL_SCALE, alpha: NEUTRAL_ALPHA, lift: 0
        }));
    });

    /**
     * A degraded cached `case.json` can attribute a beat to a colleague this build no longer authors.
     * It must foreground nothing and throw nothing — the label side is already handled by
     * `projectAttribution`'s `colleague.unattributedSpeaker` fallback.
     */
    it('foregrounds nothing for a speaker who is not in the cast', () => {
        const view = resolveCharacterStage({
            cast: CAST, speakerColleagueId: 'someone-who-left', band: ROOMY, area: AREA, motionAllowed: true
        });

        expect(view.figures.some(({ isSpeaker }) => isSpeaker)).toBe(false);
        view.figures.forEach((figure) => expect(figure.scale).toBe(NEUTRAL_SCALE));
    });
});

describe('resolveCharacterStage — motion', () => {
    it('offers a tween duration when motion is allowed', () => {
        const view = resolveCharacterStage({
            cast: CAST, speakerColleagueId: 'thea-young', band: ROOMY, area: AREA, motionAllowed: true
        });

        expect(view.transitionMs).toBe(EMPHASIS_TWEEN_MS);
    });

    /**
     * Under `reduce` the duration is zero, which is what makes AC5 true by construction: there is no
     * flag for the renderer to forget, and the targets are identical either way, so the static frame is
     * the frame the tween would have ended on.
     */
    it('asks for no motion under reduce, and stages the identical frame', () => {
        const options = { cast: CAST, speakerColleagueId: 'thea-young', band: ROOMY, area: AREA } as const;
        const moving = resolveCharacterStage({ ...options, motionAllowed: true });
        const still = resolveCharacterStage({ ...options, motionAllowed: false });

        expect(still.transitionMs).toBe(0);
        expect(still.figures).toEqual(moving.figures);
    });
});

describe('presentColleagueIds', () => {
    const CAST_IDS = CAST.map(({ colleagueId }) => colleagueId);

    /**
     * Presence is derived until Story 3.4 authors `scenarioScript.scenes[].cast?`. For the shipped
     * Young case the proposers, the speakers, and the full cast are the same four people, so none of
     * this is observable today — it is one pure function anyway so 3.4 replaces one call rather than a
     * rule spread across two renderers (D2).
     */
    it('keeps the proposers in proposal order', () => {
        expect(presentColleagueIds({
            proposerIds: ['marianne-cole', 'elias-wren', 'thea-young', 'samuel-hart'],
            speakerIds: ['thea-young', 'samuel-hart'],
            castIds: CAST_IDS
        })).toEqual(['marianne-cole', 'elias-wren', 'thea-young', 'samuel-hart']);
    });

    it('appends a beat speaker who authored no proposal on this board', () => {
        expect(presentColleagueIds({
            proposerIds: ['thea-young', 'elias-wren'],
            speakerIds: ['elias-wren', 'marianne-cole'],
            castIds: CAST_IDS
        })).toEqual(['thea-young', 'elias-wren', 'marianne-cole']);
    });

    it('falls back to the whole cast when a scene authors neither', () => {
        expect(presentColleagueIds({ proposerIds: [], speakerIds: [], castIds: CAST_IDS })).toEqual(CAST_IDS);
    });

    it('never repeats a colleague', () => {
        expect(presentColleagueIds({
            proposerIds: ['thea-young', 'thea-young'],
            speakerIds: ['thea-young'],
            castIds: CAST_IDS
        })).toEqual(['thea-young']);
    });
});

/**
 * ADR-006, asserted at source level rather than argued in a comment (AC7).
 *
 * The rule is that a staging renderer gets the cast, the speaker, and the accent colour, and nothing
 * more — a surface able to read which conclusion the evidence supports could mark the "right" answer.
 * No type signature can express "this module never imports that one", and a comment saying so is not
 * an assertion, so the files are read and searched. `tests/e2e/canvasHelpers.ts` is the precedent for
 * reading a project file inside a test.
 *
 * Verified by mutation: adding `selectDefensibleConclusionProposalIds` to `CharacterStage.ts` fails
 * this test, and removing it passes again. It has also fired for real — on the word `defensible` in
 * `characterStageView.ts`'s own prose, which was rewritten rather than the test weakened.
 *
 * `LaboratoryDecor` is swept too. It is the newest member of the staging path and the one most likely
 * to be handed state later by someone who thinks a backdrop is harmless.
 */
describe('ADR-006 — the staging path cannot reach the answer', () => {
    const FORBIDDEN = [
        'selectDefensibleConclusionProposalIds',
        'selectDefensibleConclusionIds',
        'supportPredicate',
        'defensible'
    ] as const;

    /**
     * Every module that decides what the reader sees standing in the room.
     *
     * `figureAppearance.ts` was missing until the 2.9 review, which is the worst kind of gap in a sweep
     * like this: it is new, it is imported by both the renderer and the board, and what it resolves is
     * precisely *what each figure looks like* — the one place a "mark the defensible one" change would
     * be easiest to write and least visible.
     *
     * `ColleagueRenderer.ts` is the deliberate addition beyond the drawing modules. It is the only file
     * here that touches the store at all, so it is the only realistic place a defensibility selector
     * could actually be wired *into* staging — the three below have no way to reach one. Its prose has
     * to avoid the forbidden words for the same reason `characterStageView.ts`'s does, which is a small
     * cost for closing the one door that is not already locked.
     */
    const STAGING_SOURCES = [
        'src/adapters/phaser/renderers/characterStageView.ts',
        'src/adapters/phaser/renderers/CharacterStage.ts',
        'src/adapters/phaser/renderers/LaboratoryDecor.ts',
        'src/adapters/phaser/renderers/figureAppearance.ts',
        'src/adapters/phaser/renderers/ColleagueRenderer.ts',
        // The two surfaces Story 2.11 adds to the theory board's scene. The case file is the one that
        // matters most: it renders `selectConclusionReadiness`, which is a fact about the player's own
        // record and carries no defensibility — and it sits one import away from the selector that
        // does. `caseFileGeometry.ts` is swept for the same reason `LaboratoryDecor` is: it is where a
        // "mark the defensible one" change would be easiest to write and least visible.
        'src/adapters/phaser/renderers/CaseFilePresenter.ts',
        'src/adapters/phaser/renderers/caseFileGeometry.ts',
        // The debrief reads the *completed* record and never re-evaluates it.
        'src/adapters/phaser/renderers/DebriefRenderer.ts',
        'src/adapters/phaser/scenes/debriefGeometry.ts'
    ] as const;

    it.each(STAGING_SOURCES)('%s mentions nothing that could reveal the answer', (path) => {
        const source = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf-8');

        // A guard on the guard: an unreadable or empty file would make the sweep below vacuous, which
        // is how a source-level assertion starts passing because the thing it protects moved.
        expect(source.length).toBeGreaterThan(0);
        expect(FORBIDDEN.filter((term) => source.includes(term))).toEqual([]);
    });
});
