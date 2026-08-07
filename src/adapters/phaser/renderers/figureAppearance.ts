/**
 * What each member of the cast looks like — resolved from authored data, without drawing anything
 * (Story 2.9, design revision of 2026-08-07).
 *
 * **Phaser is not imported here at all**, for the reason `characterStageView.ts` sets out: Phaser
 * touches `window` at import time and both Vitest and the Playwright specs run in Node, so anything
 * inside `CharacterStage` is unreachable by a unit test. The palette and the defaults are the part
 * worth asserting, so they live here and the fill commands live there.
 *
 * ## Why this module exists at all
 *
 * The first two versions drew **one silhouette recoloured four times**. Colour was the only thing
 * separating one colleague from the next, which is precisely what AC2 forbids ("identity must not rest
 * on colour alone") — the rule was satisfied on the *cards*, by the attribution line, and quietly
 * broken on the stage. The design board Alexis supplied on 2026-08-07 shows what the fix is: Elias Wren
 * wears spectacles and carries a clipboard, Marianne Cole is gowned with her hair pinned up, Samuel
 * Hart has a moustache and an arm out mid-explanation, Arthur Bell stands with his arms folded. Five
 * people, told apart with the colour removed.
 *
 * ## A closed vocabulary, not free-form art direction
 *
 * Every field is an enum or a boolean, and colours are picked from curated ramps rather than authored
 * as hex. That is deliberate: the room is lit warm and dark, and an author handed a free `hairColor`
 * would sooner or later put a colour in it that does not sit in that light. The accent stays authored
 * hex because it is not only a garment — the card stripe, the dialogue speaker name and the figure all
 * read the same field, and they have to agree.
 *
 * ## Everything is optional, and the role is the fallback
 *
 * A case may ship a cast with no `figure` block at all and still get four people who differ, because
 * the role already carries most of the pose: an instrument maker holds a clipboard, a communicator
 * explains with their hands, a lead holds the apparatus up to the light. That keeps this additive —
 * no existing case content becomes invalid — and it keeps the authored block for the things a role
 * genuinely cannot imply.
 */

import type {
    ColleagueFigure,
    ColleagueRole,
    FigureBuild,
    FigureHair,
    FigureHairColor,
    FigurePose,
    FigureSkinTone
} from '../../../domain/cases/ColleagueCast';

/** Everything resolved, as numbers the `Graphics` calls can take straight. */
export type FigureAppearance = Readonly<{
    build: FigureBuild;
    pose: FigurePose;
    hair: FigureHair;
    hairColor: number;
    skinTone: number;
    spectacles: boolean;
    moustache: boolean;
}>;

/**
 * The hair ramp, warmed to the lamplight of the room rather than sampled from daylight.
 *
 * `grey` is not white: under a single oil lamp the lightest hair in the room still sits well below the
 * paper a figure is holding, and a true white head would out-read every face on the stage.
 */
const HAIR_COLORS: Readonly<Record<FigureHairColor, number>> = Object.freeze({
    dark: 0x2b2118,
    auburn: 0x6b3a21,
    fair: 0xa8823f,
    grey: 0x8d8477
});

/**
 * The skin ramp.
 *
 * Four tones, spaced far enough apart to survive the room's amber cast — the cast of the wider
 * narrative includes Priya Sen, Maya Rao and David Lin, and a single default tone would have to be
 * corrected the moment their case ships rather than now.
 */
const SKIN_TONES: Readonly<Record<FigureSkinTone, number>> = Object.freeze({
    light: 0xdcb188,
    tan: 0xc08b5c,
    brown: 0x8d5a34,
    deep: 0x5f3a22
});

/**
 * What a role implies when nothing is authored.
 *
 * Poses only. Build, hair and face are **not** inferred: there is nothing about being an analyst that
 * implies a gown, and guessing a figure's presentation from their role or their name is exactly the
 * kind of inference that gets a named character drawn wrong. Unauthored figures are suited with
 * cropped dark hair and no spectacles, and an author who wants otherwise says so.
 */
const POSE_BY_ROLE: Readonly<Record<ColleagueRole, FigurePose>> = Object.freeze({
    lead: 'raising-instrument',
    builder: 'holding-paper',
    analyst: 'holding-paper',
    communicator: 'presenting'
});

const DEFAULT_APPEARANCE = Object.freeze({
    build: 'suited',
    hair: 'cropped',
    hairColor: 'dark',
    skinTone: 'light',
    spectacles: false,
    moustache: false
} as const);

/**
 * Resolves one figure's appearance from its role and whatever the case authored.
 *
 * The rival passes `'rival'` rather than a {@link ColleagueRole}, because he has none — he is not a
 * member of `colleagues[]` and nothing may treat him as one (AC4). His default pose is his character
 * note: arms folded, waiting to be convinced.
 */
export const resolveFigureAppearance = (
    role: ColleagueRole | 'rival',
    figure?: ColleagueFigure
): FigureAppearance => Object.freeze({
    build: figure?.build ?? DEFAULT_APPEARANCE.build,
    pose: figure?.pose ?? (role === 'rival' ? 'arms-folded' : POSE_BY_ROLE[role]),
    hair: figure?.hair ?? DEFAULT_APPEARANCE.hair,
    hairColor: HAIR_COLORS[figure?.hairColor ?? DEFAULT_APPEARANCE.hairColor],
    skinTone: SKIN_TONES[figure?.skinTone ?? DEFAULT_APPEARANCE.skinTone],
    spectacles: figure?.spectacles ?? DEFAULT_APPEARANCE.spectacles,
    moustache: figure?.moustache ?? DEFAULT_APPEARANCE.moustache
});

// --- Garment shading ----------------------------------------------------------------------------

/**
 * Mixes a colour toward black or toward a warm highlight.
 *
 * Per channel and clamped, so an accent already near the top of a channel tints without wrapping
 * around — a bug worth naming, because `colour + 0x101010` looks right on four authored accents and
 * turns the fifth bright green.
 */
const mixChannel = (from: number, to: number, amount: number): number =>
    Math.max(0, Math.min(255, Math.round(from + ((to - from) * amount))));

const mix = (
    color: number,
    target: number,
    amount: number,
    limit: (from: number, to: number) => number
): number =>
    (mixChannel((color >> 16) & 0xff, limit((color >> 16) & 0xff, (target >> 16) & 0xff), amount) << 16)
    | (mixChannel((color >> 8) & 0xff, limit((color >> 8) & 0xff, (target >> 8) & 0xff), amount) << 8)
    | mixChannel(color & 0xff, limit(color & 0xff, target & 0xff), amount);

/** The lamp is oil, not daylight: highlights go warm, never white. */
const LAMPLIGHT = 0xffd9a0;
/** Not pure black — a shadow in a lamplit room keeps a trace of the room's cold blue. */
const DEEP_SHADE = 0x0d1216;

/**
 * Darkens toward the room's shadow, and **never lightens**.
 *
 * The per-channel `Math.min` is the whole point. Both targets are colours rather than pure black and
 * pure white — a shadow in this room keeps a trace of cold blue and a highlight stays oil-lamp warm —
 * which means a naive mix does the wrong thing at the ends of the ramp: shading a near-black accent
 * toward `#0d1216` makes it *brighter*, and tinting a white one toward `#ffd9a0` makes it *duller*. On
 * the four accents this case ships neither is visible, so this is exactly the kind of defect that
 * ships and then surprises the fifth case. Clamping each channel to the direction the function names
 * makes the ordering hold for every accent instead of for the ones that were tried.
 */
export const shade = (color: number, amount: number): number => mix(color, DEEP_SHADE, amount, Math.min);
export const tint = (color: number, amount: number): number => mix(color, LAMPLIGHT, amount, Math.max);

/**
 * The four tones one garment is drawn in.
 *
 * A coat painted in one flat fill is a cut-out whatever shape it is cut into; the reference art reads
 * as cloth because the same colour appears at four depths. Derived from the authored accent rather
 * than authored separately, so a case that changes a colleague's colour gets a consistent figure for
 * free and cannot author a highlight darker than its own shadow.
 */
export type GarmentTones = Readonly<{
    /** The lit face of the coat — what the eye reads as "their colour". */
    base: number;
    /** Trousers, skirt, and the coat's turned edges. */
    deep: number;
    /** The shirt, collar and cuffs: the same hue, lifted far enough to read as linen. */
    linen: number;
    /** A single lit edge down the side the lamp is on. */
    highlight: number;
}>;

/**
 * The band an accent is brought into before the ramp is derived from it.
 *
 * Clamping the direction of each mix stopped the ramp from *inverting* at the ends. It did not stop it
 * from **collapsing** there, and the "every accent" ordering test hid that by asserting `≤`: a white
 * accent tints to white at every amount, so `linen` and `highlight` came out identical, and a black one
 * shades to black, so `deep` and `base` did. Four tones become three, the shirt front and the collar
 * vanish into the coat, and the figure reverts to precisely the flat cut-out this whole module exists
 * to prevent — for a `#ffffff` that `CaseDefinitionSchema` accepts perfectly happily.
 *
 * Leaving headroom at both ends is what makes the ordering **strict** for every accent rather than for
 * the ones that were tried. The band is wide enough that no shipped accent moves — the darkest channel
 * across the five authored figures is `0x22` and the lightest `0xc9` — so this costs the case nothing
 * and costs a future author only the two extremes, which were never going to read as cloth anyway
 * (2.9 review).
 */
const WORKING_FLOOR = 26;
const WORKING_CEILING = 229;
const intoWorkingBand = (color: number): number => {
    const channel = (shift: number): number =>
        Math.max(WORKING_FLOOR, Math.min(WORKING_CEILING, (color >> shift) & 0xff));
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

export const garmentTones = (accent: number): GarmentTones => {
    const workable = intoWorkingBand(accent);
    return Object.freeze({
        base: shade(workable, 0.18),
        deep: shade(workable, 0.46),
        linen: tint(workable, 0.72),
        highlight: tint(workable, 0.34)
    });
};
