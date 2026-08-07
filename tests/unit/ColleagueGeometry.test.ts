import { describe, expect, it } from 'vitest';

import {
    proposalCardHeight,
    proposalStageArea,
    proposalStageBand,
    proposalStageBandBelowPanel,
    PROPOSAL_CARD_HEIGHT
} from '../../src/adapters/phaser/renderers/ColleagueRenderer';
import {
    figureLabelHeight,
    MIN_LEGIBLE_FIGURE_HEIGHT,
    resolveCharacterStage,
    type StageCastMember
} from '../../src/adapters/phaser/renderers/characterStageView';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../../src/adapters/phaser/designSurface';

/**
 * The board's **real** geometry, at the real canvas size and the real card count.
 *
 * This file exists because of what its absence cost. Every staging test — unit and integration alike —
 * fabricated a band (`{ top: 120, height: FIGURE_MAX_HEIGHT + figureLabelHeight() + 20 }`) and asserted
 * against that, so nothing in the suite ever called `proposalStageBand`. The conclusion board shipped
 * unable to stage a single figure at *any* panel height — AC1, AC2 and AC3 unmet on the two phases it
 * hosts — and every test passed. A resolver tested against a band nobody paints is a resolver with no
 * coverage at all.
 *
 * So the rule here is: **no band literal appears in this file.** Every number comes from the functions
 * the renderer itself calls.
 */

const CARD_COUNT = 4;

/**
 * The dialogue panel's measured bottom, from `DialogueBox`'s own layout:
 * `DIALOGUE_TOP + PADDING_Y + rowHeight + BODY_TOP_GAP + body + PADDING_Y`. Sampled rather than
 * imported because the body's height is a *rendered* measurement Phaser makes in a browser, which is
 * the one thing a Node spec cannot have. The sweep therefore covers the range a real beat produces —
 * one line to four — instead of pretending to know which one ships.
 */
const panelBottomFor = (bodyLines: number): number => 54 + 12 + 26 + 6 + Math.round(bodyLines * 16 * 1.32) + 12;

const castOf = (size: number): readonly StageCastMember[] => Array.from({ length: size }, (_, index) => ({
    colleagueId: `c-${index}`,
    accentColor: 0x4f8a8b,
    name: `Name ${index}`,
    roleLabel: `Role ${index}`
}));

const stageAt = (kind: 'prediction' | 'conclusion', bodyLines: number) => resolveCharacterStage({
    cast: castOf(CARD_COUNT),
    band: proposalStageBandBelowPanel(kind, DESIGN_HEIGHT, CARD_COUNT, panelBottomFor(bodyLines)),
    area: proposalStageArea(),
    motionAllowed: false
});

describe('proposal board geometry', () => {
    it('gives both boards the same card height, because both now carry the same content', () => {
        expect(proposalCardHeight('prediction')).toBe(PROPOSAL_CARD_HEIGHT);
        expect(proposalCardHeight('conclusion')).toBe(PROPOSAL_CARD_HEIGHT);
    });

    it('leaves a room band that clears the plaque and the legibility floor on both boards', () => {
        const needed = MIN_LEGIBLE_FIGURE_HEIGHT + figureLabelHeight();

        (['prediction', 'conclusion'] as const).forEach((kind) => {
            const band = proposalStageBand(kind, DESIGN_HEIGHT, CARD_COUNT);
            expect(band.height).toBeGreaterThan(needed);
        });
    });

    /**
     * The assertion the whole story turned on. A board that resolves zero figures is a board where AC1
     * ("each figure carries its colleague's name and role"), AC2 ("that colleague's figure is visibly
     * foregrounded") and AC3 ("the prediction **and conclusion** boards") are all unmet, silently.
     */
    it.each([
        ['prediction', 1], ['prediction', 2], ['prediction', 3],
        ['conclusion', 1], ['conclusion', 2], ['conclusion', 3]
    ] as const)('stages the whole cast on the %s board with a %i-line beat', (kind, bodyLines) => {
        const view = stageAt(kind, bodyLines);

        expect(view.figures).toHaveLength(CARD_COUNT);
        view.figures.forEach((figure) => {
            expect(figure.height).toBeGreaterThanOrEqual(MIN_LEGIBLE_FIGURE_HEIGHT);
            expect(figure.width).toBeGreaterThan(0);
        });
    });

    it('withholds the cast rather than drawing it illegibly when a beat is long enough to take the room', () => {
        // Not a failure state — the documented trade. What matters is that it degrades to *nothing*
        // rather than to four dots with names under them, and that it takes an extreme beat to get
        // there rather than an ordinary one.
        const view = stageAt('conclusion', 9);
        expect(view.figures).toHaveLength(0);
    });

    it('never lets the room overlap the cards, at any beat length', () => {
        (['prediction', 'conclusion'] as const).forEach((kind) => {
            const cardsTop = DESIGN_HEIGHT - 16
                - ((CARD_COUNT * proposalCardHeight(kind)) + ((CARD_COUNT - 1) * 10));

            [1, 2, 3, 5].forEach((bodyLines) => {
                const band = proposalStageBandBelowPanel(kind, DESIGN_HEIGHT, CARD_COUNT, panelBottomFor(bodyLines));
                const view = resolveCharacterStage({
                    cast: castOf(CARD_COUNT),
                    band,
                    area: proposalStageArea(),
                    motionAllowed: false
                });
                // The plaque's last line is the lowest thing the room draws.
                expect(view.floorY + figureLabelHeight()).toBeLessThanOrEqual(cardsTop);
            });
        });
    });

    it('spreads the cast across the full proposal surface, inside the canvas', () => {
        const area = proposalStageArea();
        const view = stageAt('prediction', 2);

        expect(area.x).toBeGreaterThanOrEqual(0);
        expect(area.x + area.width).toBeLessThanOrEqual(DESIGN_WIDTH);
        view.figures.forEach((figure) => {
            expect(figure.x - (figure.width / 2)).toBeGreaterThanOrEqual(area.x);
            expect(figure.x + (figure.width / 2)).toBeLessThanOrEqual(area.x + area.width);
        });
    });

    /**
     * The guide is bottom-anchored at `cardsTop − GUIDE_TO_CARDS_GAP − height`, so the room's floor has
     * to clear the gap *and* the band. Reserving only the band put a two-line French guide on the
     * boundary with zero slack, and a longer one across the plaques (2.9 review).
     */
    it('reserves enough below the room for a two-line guide and its gap', () => {
        const band = proposalStageBand('conclusion', DESIGN_HEIGHT, CARD_COUNT);
        const cardsTop = DESIGN_HEIGHT - 16
            - ((CARD_COUNT * proposalCardHeight('conclusion')) + ((CARD_COUNT - 1) * 10));
        const twoLineFrenchGuide = Math.round(2 * 15 * 1.3);

        expect(cardsTop - band.height).toBeGreaterThanOrEqual(twoLineFrenchGuide);
    });
});
