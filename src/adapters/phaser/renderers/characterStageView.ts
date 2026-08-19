/**
 * Where each colleague stands in the room and which one is foregrounded, decided without drawing
 * anything (Story 2.9).
 *
 * **Phaser is not imported here at all** — not even as a type. `CharacterStage` builds display objects
 * and therefore imports Phaser; Phaser touches `window` at import time, and both Vitest and the
 * Playwright specs run in Node, so nothing inside that file can be reached by a unit test. The Story
 * 2.6 review found a whole rendering path shipped with no automated coverage for exactly that reason,
 * and `advanceView.ts`, `apparatusGeometry.ts`, `libraryGeometry.ts` and `libraryDecorGeometry.ts` each
 * exist as the answer to it. This is the next one.
 *
 * ## A row of people in a room, not a column of vignettes
 *
 * The first version of this module stood four 44×78 busts in a 74px column beside the proposal cards.
 * It was rejected on sight, and rightly: at that size a figure is a decorative token, not a colleague
 * standing in the laboratory. Figures are now **full-length**, laid out in a horizontal row across a
 * band of the room, at roughly the proportion a person occupies in the reference art.
 *
 * The layout change pays for itself twice over. Each figure gets a slot ≈236px wide instead of 74, so
 * its **name and role both fit underneath it** — which is what AC1 actually asks for and what the
 * column could never afford. And the cards get their full text width back, because they no longer
 * surrender a left inset to a figure column.
 *
 * ## What it may see, and what it may not
 *
 * The cast, who is speaking, which proposal the player has chosen, the accent colours, and the band to
 * stand in. **Nothing here accepts, returns, or references which conclusion the evidence supports**,
 * and it never can: a staging surface able to read that could mark the "right" answer, which ADR-006
 * forbids. `CharacterStageView.test.ts` asserts it at source level — by searching this file for the
 * selector and field names that would carry it — because no type signature can express the rule and a
 * comment is not an assertion. That search is why the terms themselves do not appear in this prose.
 *
 * The player's own selection is a different thing entirely and is safe: it is what *they* chose, not
 * what the evidence supports, and reflecting it back is how AC3's connection between a card and its
 * author is made without a drawn connector.
 *
 * ## The band comes in; nothing is derived from a canvas
 *
 * The caller passes the band, because the caller is the only thing that knows where the room ends and
 * the cards begin — and that boundary is measured, not constant.
 *
 * ## Motion is a duration, not a flag
 *
 * {@link CharacterStageView.transitionMs} is `0` under `prefers-reduced-motion: reduce` and
 * {@link EMPHASIS_TWEEN_MS} otherwise, and the figure targets are **identical either way**. That is
 * what makes AC5 true by construction rather than by a branch someone can forget: the static frame the
 * reduced-motion path paints is the exact frame the tween would have ended on.
 */

import type { FigureAppearance } from './figureAppearance';

/** The horizontal strip of room the figures stand across, and the vertical band they stand in. */
export type StageBand = Readonly<{ top: number; height: number }>;
export type StageArea = Readonly<{ x: number; width: number }>;

/**
 * One present colleague, already resolved.
 *
 * `name` and `roleLabel` are **resolved strings**, never `LocalizedText`: the name is a canonical
 * proper noun straight from `case.json`, and the role has already been through the i18n layer by the
 * caller. This module holds no locale and can resolve nothing.
 */
export type StageCastMember = Readonly<{
    colleagueId: string;
    accentColor: number;
    name: string;
    roleLabel: string;
    /** Case-namespaced Phaser texture key. Omitted when this member is vector-only. */
    portraitTextureKey?: string;
    /**
     * How this person is built, posed and groomed — resolved by the caller through
     * `resolveFigureAppearance`, which is what stops the four figures from being one silhouette
     * recoloured four times (AC2). Optional here because nothing in *this* module reads it: the
     * resolver places people, it does not draw them, and a placement test should not have to invent an
     * appearance to assert a coordinate.
     */
    appearance?: FigureAppearance;
}>;

// --- Geometry ---------------------------------------------------------------------------------

/**
 * A standing adult, at the proportion the reference art uses.
 *
 * 76×230 is a ratio of about 1:3, which is what reads as a person seen full-length rather than as a
 * bust or a bollard. The height is a *maximum*: the band the room can spare differs between the two
 * boards, because the conclusion cards carry a stated limitation and the prediction cards do not, so
 * the figures shrink to fit and keep their proportions while they do it.
 */
export const FIGURE_MAX_WIDTH = 76;
export const FIGURE_MAX_HEIGHT = 230;
/** Between the widest point of a figure and the edge of its slot, so neighbours never touch. */
export const FIGURE_SIDE_INSET = 10;

/**
 * The height below which a figure is not drawn at all.
 *
 * **A stage that cannot be legible is not a stage.** The conclusion board's four cards each carry a
 * claim *and* a stated limitation, which is 488px of a 768px surface; after the dialogue panel and the
 * guide there is about 60px of room left, and four people rendered into 60px are four dots with names
 * under them — worse than an empty room, because they claim to be characters and are not.
 *
 * 96px is where a full-length figure stops reading as a person: below it the head is under 6px across
 * and the coat and legs merge into one block. At that point the room is painted and the cast is
 * withheld, and the colleague's identity rests where it already also lives — the attribution line on
 * their own card.
 *
 * **Both boards clear it as of the 2.9 review.** They did not before: the conclusion board's cards each
 * reserved two lines for a stated limitation, which cost ≈112px and left 44px of room — so the cast was
 * withheld there in every case, for every panel height, and `synthesis` and `review` played out with
 * nobody on stage. The limitation moved out of the card and into the guide slot (`LimitationMode`),
 * which returned the board to the same 316px band the prediction board has. `ColleagueGeometry.test.ts`
 * asserts the margin against the real geometry so this cannot regress silently again.
 */
export const MIN_LEGIBLE_FIGURE_HEIGHT = 96;

/**
 * The name-and-role plaque under each figure — which is where AC1 is actually satisfied.
 *
 * Two lines: the canonical name, then the localized role. Four figures across the 944px surface give
 * each a slot of ≈236px, and the longest French role,
 * `"Constructrice ou constructeur d'appareils"`, measures ≈210px at 11px — so it holds on one line
 * with room to spare. That is the whole reason the row layout can carry this label and the rejected
 * column could not.
 */
export const FIGURE_NAME_FONT_SIZE = 12;
export const FIGURE_ROLE_FONT_SIZE = 11;
/**
 * The speaking marker's own size — the third plaque line, and AC2's **label**.
 *
 * Smaller than the role, because it is a state and not an identity. Its height is reserved on every
 * plaque and its text is written on one, so the plaque does not change height when the speaker changes
 * and no figure grows or shrinks as a conversation advances.
 */
export const FIGURE_BADGE_FONT_SIZE = 10;
const NAME_LINE_HEIGHT = 1.35;
const ROLE_LINE_HEIGHT = 1.35;
const BADGE_LINE_HEIGHT = 1.35;
export const figureNameHeight = (fontSize: number = FIGURE_NAME_FONT_SIZE): number =>
    Math.round(fontSize * NAME_LINE_HEIGHT);
export const figureRoleHeight = (fontSize: number = FIGURE_ROLE_FONT_SIZE): number =>
    Math.round(fontSize * ROLE_LINE_HEIGHT);
export const figureBadgeHeight = (fontSize: number = FIGURE_BADGE_FONT_SIZE): number =>
    Math.round(fontSize * BADGE_LINE_HEIGHT);
/** The whole plaque: all three lines, plus the gap between the figure's feet and the first of them. */
export const FIGURE_LABEL_GAP = 4;
export const figureLabelHeight = (
    nameFontSize: number = FIGURE_NAME_FONT_SIZE,
    roleFontSize: number = FIGURE_ROLE_FONT_SIZE,
    badgeFontSize: number = FIGURE_BADGE_FONT_SIZE
): number => FIGURE_LABEL_GAP
    + figureNameHeight(nameFontSize)
    + figureRoleHeight(roleFontSize)
    + figureBadgeHeight(badgeFontSize);

// --- Emphasis ---------------------------------------------------------------------------------

/**
 * Four states, because there are four things a figure can be doing, and the reader has to tell them
 * apart at a glance.
 *
 * The speaker is at full size and opacity on the shared floor line. The colleague
 * whose proposal the player has **chosen** is held at an intermediate weight — that is what connects a
 * card to its author now that the figures stand in a row rather than beside their own card, and it is
 * a connection the reader creates by acting rather than one they have to trace. Everyone else recedes.
 * With nobody speaking and nothing chosen, all four sit at a uniform neutral: receding everyone would
 * say "nobody here matters" and foregrounding everyone would say "everybody is talking".
 */
export const SPEAKER_SCALE = 1;
export const SPEAKER_ALPHA = 1;
/**
 * The foregrounded speaker stays on the shared baseline.
 *
 * Scale, opacity, and the explicit speaking label already make the active colleague clear. Raising
 * the whole body also raised its contact shadow, which reads as a hovering person once the room has a
 * visible floor plane.
 */
export const SPEAKER_LIFT = 0;
export const SELECTED_SCALE = 0.95;
export const SELECTED_ALPHA = 0.9;
export const RECEDED_SCALE = 0.88;
export const RECEDED_ALPHA = 0.55;
export const NEUTRAL_SCALE = 0.94;
export const NEUTRAL_ALPHA = 0.82;

/**
 * How long the emphasis takes to move.
 *
 * Restrained and short, because scientific legibility outranks the motion (AC5): the reader is here to
 * compare four claims, and a figure still travelling when their eye arrives is a cost with no return.
 * At the short end of the 160–200ms the story allows — long enough to read as movement rather than a
 * jump, short enough that a reader advancing quickly through a conversation never waits for it.
 */
export const EMPHASIS_TWEEN_MS = 180;

export type StagedFigure = Readonly<{
    colleagueId: string;
    accentColor: number;
    name: string;
    roleLabel: string;
    /**
     * The figure's **feet**, centred in its slot — not its top-left.
     *
     * Emphasis is applied with `setScale`, which scales a `Graphics` about its position, so anchoring
     * at the base is what makes a foregrounded figure grow upward out of the floor instead of sinking
     * through it. It is also what puts every figure on one floor line whatever its height.
     */
    x: number;
    y: number;
    width: number;
    height: number;
    /** The emphasis targets: what the renderer tweens toward, or applies directly under `reduce`. */
    scale: number;
    alpha: number;
    /** Upward, so a positive lift raises the figure. Subtracted from `y` by the renderer. */
    lift: number;
    /** The plaque, centred on the same slot: name, role, and the speaking marker under them. */
    labelX: number;
    nameY: number;
    roleY: number;
    badgeY: number;
    labelWrapWidth: number;
    isSpeaker: boolean;
    isSelected: boolean;
}>;

export type CharacterStageView = Readonly<{
    figures: readonly StagedFigure[];
    /** The floor line every figure stands on, so the room can paint a shadow under them. */
    floorY: number;
    /** `0` under `reduce`: the renderer applies the targets directly and starts no tween. */
    transitionMs: number;
}>;

/** The natural figure size, and the override a host with more or less room can pass. */
export type StageFigureSize = Readonly<{ width: number; height: number }>;
const DEFAULT_FIGURE_SIZE: StageFigureSize = Object.freeze({ width: FIGURE_MAX_WIDTH, height: FIGURE_MAX_HEIGHT });

export type CharacterStageInput = Readonly<{
    /** The present cast, already ordered — left to right, in the order the caller wants them read. */
    cast: readonly StageCastMember[];
    /**
     * Who is speaking right now, or `undefined` when nobody is.
     *
     * Not required to resolve: a degraded cached `case.json` can attribute a beat to a colleague this
     * build no longer authors, and the answer to that is to foreground nobody rather than to throw.
     */
    speakerColleagueId?: string;
    /** Whose proposal the player has chosen, if any. Their own choice — never an evaluation of it. */
    selectedColleagueId?: string;
    band: StageBand;
    area: StageArea;
    motionAllowed: boolean;
    maxFigure?: StageFigureSize;
    nameFontSize?: number;
    roleFontSize?: number;
    badgeFontSize?: number;
}>;

const emphasisFor = (
    isSpeaker: boolean,
    isSelected: boolean,
    hasSpeaker: boolean
): Readonly<{ scale: number; alpha: number; lift: number }> => {
    if (isSpeaker) return { scale: SPEAKER_SCALE, alpha: SPEAKER_ALPHA, lift: SPEAKER_LIFT };
    if (isSelected) return { scale: SELECTED_SCALE, alpha: SELECTED_ALPHA, lift: 0 };
    if (hasSpeaker) return { scale: RECEDED_SCALE, alpha: RECEDED_ALPHA, lift: 0 };
    return { scale: NEUTRAL_SCALE, alpha: NEUTRAL_ALPHA, lift: 0 };
};

/**
 * Stands the cast in a row across the band it is given.
 *
 * **Equal slots, total over the count**: the area is divided by however many figures there are, so a
 * cast of three leaves no gap where a fourth would have been and a coordinate derived for four never
 * lands between two at three. `libraryArtifactPlacements` is the precedent.
 *
 * The band is the ceiling. A short band — the conclusion board, whose cards are taller — shrinks the
 * figures and keeps their proportions rather than letting them overflow into the dialogue panel above
 * or the cards below. On a fixed surface that does not scroll, an overflow is a defect and not a
 * responsive state.
 */
export const resolveCharacterStage = ({
    cast,
    speakerColleagueId,
    selectedColleagueId,
    band,
    area,
    motionAllowed,
    maxFigure = DEFAULT_FIGURE_SIZE,
    nameFontSize = FIGURE_NAME_FONT_SIZE,
    roleFontSize = FIGURE_ROLE_FONT_SIZE,
    badgeFontSize = FIGURE_BADGE_FONT_SIZE
}: CharacterStageInput): CharacterStageView => {
    const hasSpeaker = speakerColleagueId !== undefined
        && cast.some(({ colleagueId }) => colleagueId === speakerColleagueId);

    const labelHeight = figureLabelHeight(nameFontSize, roleFontSize, badgeFontSize);
    const floorY = band.top + band.height - labelHeight;
    // What is left of the band once the plaque has its three lines. The figure stands in that.
    const available = Math.max(0, floorY - band.top);
    const slotWidth = cast.length > 0 ? area.width / cast.length : area.width;

    const height = Math.max(0, Math.min(maxFigure.height, available));
    // Proportions are kept as the figure shrinks, so a squeezed band gets a smaller person rather than
    // a squat one — and a narrow slot narrows the person rather than letting neighbours overlap.
    //
    // A degenerate `maxFigure` would divide by zero here, so the ratio falls back to the natural one:
    // a host that passes a zero dimension gets a figure that is merely small, not one drawn at `NaN`
    // scale by the renderer downstream.
    const ratio = maxFigure.height > 0 && maxFigure.width > 0
        ? maxFigure.width / maxFigure.height
        : FIGURE_MAX_WIDTH / FIGURE_MAX_HEIGHT;
    const width = Math.max(0, Math.min(
        maxFigure.width,
        slotWidth - (2 * FIGURE_SIDE_INSET),
        height * ratio
    ));

    // Nothing at all rather than something illegible. The caller still paints its room; it simply has
    // nobody in it.
    //
    // **Both dimensions, not just the height.** The width clamps to zero as soon as a slot is no wider
    // than its two side insets, and a height-only gate let that through: the renderer then fitted at
    // `min(0, …)`, drew four figures at scale zero, and left four plaques standing on the floor line
    // naming people who were not there (2.9 review). The width bound is proportional to the height
    // bound so one threshold governs both.
    const minWidth = Math.min(MIN_LEGIBLE_FIGURE_HEIGHT, maxFigure.height) * ratio;
    if (height < Math.min(MIN_LEGIBLE_FIGURE_HEIGHT, maxFigure.height) || width < minWidth) {
        return Object.freeze({ figures: Object.freeze([]), floorY, transitionMs: motionAllowed ? EMPHASIS_TWEEN_MS : 0 });
    }

    const figures = cast.map((member, index) => {
        const centreX = area.x + (slotWidth * (index + 0.5));
        const isSpeaker = hasSpeaker && member.colleagueId === speakerColleagueId;
        const isSelected = selectedColleagueId !== undefined && member.colleagueId === selectedColleagueId;

        return Object.freeze({
            colleagueId: member.colleagueId,
            accentColor: member.accentColor,
            name: member.name,
            roleLabel: member.roleLabel,
            x: centreX,
            y: floorY,
            width,
            height,
            ...emphasisFor(isSpeaker, isSelected, hasSpeaker),
            labelX: centreX,
            nameY: floorY + FIGURE_LABEL_GAP,
            roleY: floorY + FIGURE_LABEL_GAP + figureNameHeight(nameFontSize),
            badgeY: floorY + FIGURE_LABEL_GAP + figureNameHeight(nameFontSize) + figureRoleHeight(roleFontSize),
            labelWrapWidth: slotWidth,
            isSpeaker,
            isSelected
        });
    });

    return Object.freeze({
        figures: Object.freeze(figures),
        floorY,
        transitionMs: motionAllowed ? EMPHASIS_TWEEN_MS : 0
    });
};

export type PresentColleaguesInput = Readonly<{
    /** The colleagues who authored the proposals on this board, in proposal order. */
    proposerIds: readonly string[];
    /** The beat speakers of the live phase's conversation, in reading order. */
    speakerIds: readonly string[];
    /** The whole authored cast, as the fallback for a scene that has neither. */
    castIds: readonly string[];
    /**
     * This scene's authored `scenarioScript.scenes[].cast`, when it has one (Story 3.4).
     *
     * `undefined` — not `[]` — is how a scene says "the whole cast": an authored empty array is refused
     * at load, so the two cannot be confused here.
     */
    authoredCast?: readonly string[];
}>;

/**
 * Who is in the room.
 *
 * **An authored cast decides presence; proposal order still decides sequence.** When a scene authors a
 * `cast`, the staged set is exactly that cast, ordered proposal-order-first — the members that authored
 * a proposal on *this* board, in proposal order — and then the remaining authored members in their
 * authored order. When no `cast` is authored, presence is derived exactly as before: the proposers on
 * this board, then any beat speaker who authored nothing, and the whole cast if a scene has neither.
 *
 * The order half is load-bearing and is why an authored cast cannot simply be returned as written. The
 * two boards attribute in different orders — prediction is `thea, elias, marianne, samuel`, conclusion
 * is `marianne, elias, thea, samuel` — so staging in cast order would put three of the four colleagues
 * beside somebody else's draft on the conclusion board (2.9's AC3).
 *
 * `speakerIds` is deliberately unread on the authored branch. It is not an omission: every beat speaker
 * in a scene is already a member of that scene's cast, refused at load if not, so folding the speakers
 * in again could only re-add somebody the author left out on purpose.
 *
 * Until Story 3.4 this was derived for every scene, and for the shipped Young case the proposers, the
 * beat speakers and the whole cast are the same four people — so the derivation was never observable.
 * The authored field is what makes the set genuinely vary, which is what closed the
 * `CharacterStage.create` rebuild note in `deferred-work.md`.
 */
export const presentColleagueIds = ({
    proposerIds,
    speakerIds,
    castIds,
    authoredCast
}: PresentColleaguesInput): readonly string[] => {
    if (authoredCast) {
        const authored = new Set(authoredCast);
        const staged = [...new Set(proposerIds)].filter((colleagueId) => authored.has(colleagueId));
        const seen = new Set(staged);
        // Deduplicated on the way out as well as filtered. The schema refuses a repeated ID, but this
        // function is exported and driven directly by tests, and a doubled figure halves the slot width
        // for everybody on the board rather than failing loudly.
        authoredCast.forEach((colleagueId) => {
            if (seen.has(colleagueId)) return;
            seen.add(colleagueId);
            staged.push(colleagueId);
        });
        return Object.freeze(staged);
    }

    const present = [...new Set([...proposerIds, ...speakerIds])];
    return Object.freeze(present.length > 0 ? present : [...castIds]);
};
