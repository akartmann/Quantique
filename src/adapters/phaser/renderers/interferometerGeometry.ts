/**
 * The rotating interferometer's tableau, in the same design space and the same geometry/painting split
 * every other surface here draws (Story 4.2, AC1 / AC8 / AC9).
 *
 * ## Why a second geometry module rather than more of `apparatusGeometry.ts`
 *
 * `apparatusGeometry.ts` holds two different kinds of number, and only one of them is Young's. The
 * *bench* — the instrument row, the control row, the readouts, the side column — is composed from
 * `apparatus.primaryControls` and is identical for every case; the *tableau* is one case's apparatus.
 * Mixing a second apparatus into that file would put two mutually exclusive layouts behind one set of
 * exports and invite exactly the sweep defect AC9 names: a test measuring a slit that is not drawn.
 *
 * So the shared bench keeps its module, and each tableau owns its own. The two are joined by
 * {@link TABLEAU_FLOOR_Y}, which is the one number the bench genuinely needs from a tableau — how far
 * down the apparatus reaches — and which `ApparatusGeometry.test.ts` now measures the bench against
 * *per case* rather than against Young's screen for both.
 *
 * ## No Phaser, still
 *
 * Nothing here imports Phaser, as a value or as a type. It is arithmetic over an authored control value
 * and the model's own stable window, so a spec deriving a click target or a band reads the numbers
 * instead of constructing a renderer — the rule `apparatusGeometry.ts`'s header states and the reason
 * `libraryGeometry.ts`, `debriefGeometry.ts` and `characterStageView.ts` all exist.
 *
 * ## The space this had to fit into, measured rather than chosen
 *
 * The same fixed 1024×768 `Scale.FIT` surface, and the same neighbours: the title and guide across the
 * top to y≈90, the label row at {@link SCREEN_LABEL_Y} = 322, the composed guidance line at y=348, the
 * bench from {@link BENCH_TOP} = 404 and the side column from {@link SIDE_COLUMN_LEFT} = 680 — but only
 * *below* `ADVANCE_CONTROL_Y` = 360, which is why the screen may reach past 680 in x and the labels may
 * not reach past 768 in y. What is left for the apparatus is roughly **x 40–710 by y 92–342**, and every
 * number below is spent out of that. `InterferometerTableau.test.ts` pins each bound against the
 * shared constants rather than trusting this comment — there is no `InterferometerGeometry.test.ts`, which
 * is what this line named until the 4.2 code review followed the pointer and found nothing there.
 */

import { CENTRE_Y, SCREEN_BAR_HALF_WIDTH, SCREEN_HALF_HEIGHT, SCREEN_LABEL_HEIGHT, SCREEN_LABEL_Y } from './apparatusGeometry';

/**
 * The floating stone the whole apparatus is mounted on, and the trough it turns in.
 *
 * Centred left of middle so the recombined path has room to reach the observing screen without the
 * screen crossing into the side column's x. 84 of stone plus 20 of bath is 104 either side: the bath's
 * top edge lands at y=96, four pixels below the guide line's own floor, and its bottom at y=304,
 * eighteen above the label row.
 */
export const STONE_CENTRE_X = 296;
export const STONE_CENTRE_Y = CENTRE_Y;
export const STONE_RADIUS = 84;
export const BATH_INNER_RADIUS = STONE_RADIUS;
export const BATH_OUTER_RADIUS = STONE_RADIUS + 20;

/**
 * The two perpendicular arms, the splitter they cross at, and the mirrors that close them.
 *
 * The arms are what makes the rotation *visible*: a disc has no orientation, so a stone drawn as a
 * circle would turn without appearing to, and the fact that it *is* turning is AC1's second clause.
 *
 * The end mirrors stay wholly on the stone at every authored angle, and the bound is a **hypotenuse**
 * rather than a sum: a mirror is a bar drawn across the end of its arm, so its corners sit off the arm's
 * axis rather than further along it.
 *
 * **Which corner, exactly** — the 4.2 code review found this docstring and its test both measuring one the
 * painter does not draw. `paintApparatus` gives each mirror a depth of {@link MIRROR_THICKNESS} *along*
 * the arm axis, so the far corners are at `hypot(ARM_LENGTH + MIRROR_THICKNESS, MIRROR_HALF_WIDTH)` ≈ 74.5
 * from the centre, not at `hypot(ARM_LENGTH, MIRROR_HALF_WIDTH)` ≈ 69.6. Both are inside
 * {@link STONE_RADIUS} today, so nothing was drawn wrong — but the guard was five pixels loose in the one
 * direction that matters, and `MIRROR_THICKNESS: 5 → 20` would have put a mirror bar off the stone at
 * every angle with the assertion still green. {@link mirrorReachFromCentre} is now the single number both
 * the docstring and the test read.
 */
export const ARM_LENGTH = 68;
export const ARM_HALF_WIDTH = 3;
export const MIRROR_HALF_WIDTH = 15;
export const MIRROR_THICKNESS = 5;
export const SPLITTER_HALF_LENGTH = 13;
export const SPLITTER_THICKNESS = 4;

/**
 * How far the outermost drawn corner of an end mirror sits from the stone's centre.
 *
 * Exported so the bound and the painting read one number: the mirror is drawn as a bar of half-width
 * {@link MIRROR_HALF_WIDTH} across the arm's end, given {@link MIRROR_THICKNESS} of depth along the arm's
 * own axis, so its far corner is the hypotenuse of (arm + depth) and half-width. Rotation-independent —
 * it is a distance from the centre of rotation, which is what makes "at every authored angle" a
 * statement about one number rather than a sweep.
 */
export const mirrorReachFromCentre = (): number => Math.hypot(ARM_LENGTH + MIRROR_THICKNESS, MIRROR_HALF_WIDTH);

/**
 * The lamp, mounted on the stone and turning with it, feeding the splitter along the incoming arm.
 *
 * The glow is the part that decides how far the lamp reaches, not the lamp's own body — and **the glow is
 * scaled while the light is on**, which this docstring got wrong until the 4.2 code review.
 * `paintLight` sets `setScale(1 + 0.9 * ignition)`, and `ignition` is 1 for every resolved lit frame, so
 * the drawn glow radius is `17 × 1.9 = 32.3` and the lamp reaches `62 + 32.3 = 94.3` — not the 79 the
 * unscaled sum gives, and past {@link STONE_RADIUS}. It stays inside {@link BATH_OUTER_RADIUS}, so what
 * spills is a pale disc over the bath annulus rather than anything leaving the apparatus; that is the
 * bound {@link sourceReachFromCentre} is asserted against, at the scale actually painted.
 */
export const SOURCE_RADIUS = 8;
export const SOURCE_GLOW_RADIUS = 17;
export const SOURCE_DISTANCE = 62;

/**
 * How far the lamp's glow reaches from the stone's centre, at the scale it is drawn at.
 *
 * Takes the ignition the painter would pass, so the test can ask the question at the value that is on
 * screen rather than at the value the constants happen to spell. `SOURCE_GLOW_SCALE_AT_FULL` is the
 * painter's own multiplier, exported beside it so the two cannot drift.
 */
export const SOURCE_GLOW_SCALE_AT_FULL = 0.9;

export const sourceReachFromCentre = (ignition01: number): number =>
    SOURCE_DISTANCE + (SOURCE_GLOW_RADIUS * (1 + (SOURCE_GLOW_SCALE_AT_FULL * ignition01)));

/**
 * The observing screen: fixed, because the reading is taken at a fixed position of the turn.
 *
 * That is not a simplification chosen for the drawing — it is the case's own second authored assumption,
 * *"The fringe displacement is read at a fixed position of the turn, not while turning"*. The stone and
 * everything on it rotate; the screen the recombined light is read on does not, and the arithmetic below
 * has no rotation term for exactly that reason.
 *
 * Unlike Young's, it does not slide: this apparatus authors no throw for it to slide along.
 * `screenXForDistance` is Young's mapping from an authored `screenDistanceM` and has no meaning here,
 * which is one of the three things the deleted `hasOpticalGeometry` guard was silently holding.
 */
export const SCREEN_X = 596;
export const SCREEN_LABEL_WRAP = 240;

/** The recombined path leaves the stone and crosses to the screen. Drawn from the stone's edge. */
export const RECOMBINED_PATH_START_X = STONE_CENTRE_X + BATH_OUTER_RADIUS;

/**
 * The label row, shared with Young's at {@link SCREEN_LABEL_Y} so there is one row and not two.
 *
 * The bath's label is left-aligned from the canvas gutter and the other two are centred on the objects
 * they name, which is what keeps three labels apart on one row in both languages without any of them
 * being measured against a constant guess at the others' width. {@link interferometerObjectBands} states
 * the reserve each one gets and the non-overlap sweep checks it.
 */
export const LABEL_Y = SCREEN_LABEL_Y;
export const LABEL_FONT_SIZE = 14;
export const BATH_LABEL_X = 40;
export const BATH_LABEL_WRAP = 140;
export const STONE_LABEL_WRAP = 200;

/**
 * How far down the apparatus reaches, so the bench below it can be measured against the right number.
 *
 * **This is the export AC9 is about.** `ApparatusGeometry.test.ts` derived its apparatus floor from
 * Young's screen bar and Young's screen label and then measured *both* shipped control sets against it —
 * so the prototype's dial and slider were asserted to clear an apparatus the prototype does not draw.
 * That is the 2.9 fabricated-band defect: the assertion was green and its subject was not on screen.
 *
 * **Be precise about what was wrong with it.** Not the number: the label row at `SCREEN_LABEL_Y` is the
 * deepest thing in *both* tableaux, so Young's floor and this one are both 342 and the old sweep reached
 * the right answer. What was wrong is that it would have gone on reaching Young's answer however deep
 * this apparatus grew. The fix is that the derivation is per case; the agreement is a coincidence, and
 * `ApparatusGeometry.test.ts` pins it as one so that separating them later is a visible decision.
 *
 * The bath's bottom edge is at 304 and the labels run to `322 + 20`.
 */
export const TABLEAU_FLOOR_Y = Math.max(
    STONE_CENTRE_Y + BATH_OUTER_RADIUS,
    CENTRE_Y + SCREEN_HALF_HEIGHT,
    LABEL_Y + SCREEN_LABEL_HEIGHT
);

/** The bath's colour ramp, in the two states the authored range has ends for. */
export const BATH_COOL_RGB = Object.freeze({ r: 0x4a, g: 0x74, b: 0x8c });
export const BATH_WARM_RGB = Object.freeze({ r: 0xc2, g: 0x70, b: 0x3a });
/** The ring drawn round the bath only while it is actually at the model's stable window. */
export const BATH_STEADY_RING_COLOR = 0x9fc6bb;
export const BATH_STEADY_RING_WIDTH = 3;

/**
 * Where one arm's end mirror sits for a given bench rotation.
 *
 * `armIndex` 0 is the arm the lamp feeds and 1 is the arm at right angles to it; the two are what the
 * model's `cos(2θ)` period is *about*, so they are drawn as one rigid pair and not as two independent
 * angles. Degrees in, because the authored control is in degrees and converting at the boundary keeps
 * one conversion rather than one per caller.
 *
 * Screen coordinates, so a positive angle turns clockwise on the canvas. Which way it turns is a
 * drawing choice with no physical content — the model reads `cos(2θ)`, which is symmetric under a sign
 * flip of θ — but it is stated here so the test asserts a direction rather than accepting either.
 */
export const armEndPoint = (rotationDeg: number, armIndex: 0 | 1): Readonly<{ x: number; y: number }> => {
    const radians = ((rotationDeg + (armIndex * 90)) * Math.PI) / 180;
    return {
        x: STONE_CENTRE_X + (Math.cos(radians) * ARM_LENGTH),
        y: STONE_CENTRE_Y + (Math.sin(radians) * ARM_LENGTH)
    };
};

/** Where the lamp sits on the stone: opposite the arm it feeds, so the light crosses the splitter. */
export const sourcePoint = (rotationDeg: number): Readonly<{ x: number; y: number }> => {
    const radians = ((rotationDeg + 180) * Math.PI) / 180;
    return {
        x: STONE_CENTRE_X + (Math.cos(radians) * SOURCE_DISTANCE),
        y: STONE_CENTRE_Y + (Math.sin(radians) * SOURCE_DISTANCE)
    };
};

/**
 * How warm the bath reads, as 0 at the authored minimum and 1 at the authored maximum.
 *
 * Takes the authored bounds rather than restating 18 and 24: the range is content, and a renderer that
 * writes a case's numbers down is the defect `lab.idle` shipped for two epics. Clamped, because a
 * restored record against a changed `case.json` can hold a value outside today's bounds and a colour
 * component outside 0–255 is a silently wrong fill rather than a loud failure.
 */
export const bathWarmth01 = (bathTempC: number, min: number, max: number): number => {
    if (!Number.isFinite(bathTempC) || max <= min) return 0;
    return Math.min(1, Math.max(0, (bathTempC - min) / (max - min)));
};

/** The bath's fill at a given warmth, interpolated between the two ends of the ramp. */
export const bathFillColor = (warmth01: number): number => {
    const mix = (from: number, to: number): number => Math.round(from + ((to - from) * warmth01));
    return (mix(BATH_COOL_RGB.r, BATH_WARM_RGB.r) << 16)
        | (mix(BATH_COOL_RGB.g, BATH_WARM_RGB.g) << 8)
        | mix(BATH_COOL_RGB.b, BATH_WARM_RGB.b);
};

/** One named rectangle the tableau paints, for the non-overlap invariant. Mirrors `BenchBand`. */
export type InterferometerBand = Readonly<{ name: string; left: number; right: number; top: number; bottom: number }>;

/**
 * Every rectangle this tableau paints, so the all-pairs sweep measures what is **actually drawn**.
 *
 * Assembled here and not inside the test, for the reason `benchObjectBands`' own header gives: every
 * staging test in the 2.9 review fabricated its own rectangles, so the board staged zero figures at
 * every panel height while the assertions stayed green. A test that builds its own bands tests
 * arithmetic.
 *
 * The stone's band is the *bath's* extent, because the bath is the outermost thing the apparatus
 * occupies and the arms are wholly inside the stone at every angle — which is asserted rather than
 * assumed, since {@link ARM_LENGTH} plus {@link MIRROR_HALF_WIDTH} against {@link STONE_RADIUS} is the
 * only thing making it true.
 */
export const interferometerObjectBands = (): readonly InterferometerBand[] => Object.freeze([
    {
        name: 'the bath and the stone it holds',
        left: STONE_CENTRE_X - BATH_OUTER_RADIUS,
        right: STONE_CENTRE_X + BATH_OUTER_RADIUS,
        top: STONE_CENTRE_Y - BATH_OUTER_RADIUS,
        bottom: STONE_CENTRE_Y + BATH_OUTER_RADIUS
    },
    {
        name: 'the observing screen',
        left: SCREEN_X - SCREEN_BAR_HALF_WIDTH,
        right: SCREEN_X + SCREEN_BAR_HALF_WIDTH,
        top: CENTRE_Y - SCREEN_HALF_HEIGHT,
        bottom: CENTRE_Y + SCREEN_HALF_HEIGHT
    },
    {
        name: 'the bath label',
        left: BATH_LABEL_X,
        right: BATH_LABEL_X + BATH_LABEL_WRAP,
        top: LABEL_Y,
        bottom: LABEL_Y + SCREEN_LABEL_HEIGHT
    },
    {
        name: 'the bench label',
        left: STONE_CENTRE_X - (STONE_LABEL_WRAP / 2),
        right: STONE_CENTRE_X + (STONE_LABEL_WRAP / 2),
        top: LABEL_Y,
        bottom: LABEL_Y + SCREEN_LABEL_HEIGHT
    },
    {
        name: 'the observing screen label',
        left: SCREEN_X - (SCREEN_LABEL_WRAP / 2),
        right: SCREEN_X + (SCREEN_LABEL_WRAP / 2),
        top: LABEL_Y,
        bottom: LABEL_Y + SCREEN_LABEL_HEIGHT
    }
]);
