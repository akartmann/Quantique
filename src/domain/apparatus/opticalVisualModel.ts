/**
 * Pure, framework-free helpers that drive the *visual* Young interference scene.
 *
 * These do not compute or alter any recorded physics result — the authoritative
 * fringe spacing still comes from `calculateYoungFringeSpacing`. These functions
 * only translate physical quantities into things the renderer can paint: a
 * wavelength into a spectral colour, and a screen position into a relative
 * interference intensity.
 */

export type Rgb = Readonly<{ r: number; g: number; b: number }>;

const VISIBLE_MIN_NM = 380;
const VISIBLE_MAX_NM = 780;
const GAMMA = 0.8;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const toChannel = (raw: number, factor: number): number => {
    if (raw <= 0) return 0;
    return Math.round(255 * Math.pow(raw * factor, GAMMA));
};

/**
 * Approximate the perceived colour of a single wavelength of visible light using
 * Bruton's piecewise spectrum approximation. Wavelengths outside the visible
 * range are clamped to the nearest visible bound so the mapping never returns
 * black for the wavelengths this laboratory offers.
 *
 * 450 nm → blue, 550 nm → green, 650 nm → red.
 */
export const wavelengthToRgb = (wavelengthNm: number): Rgb => {
    const nm = clamp(Number.isFinite(wavelengthNm) ? wavelengthNm : VISIBLE_MIN_NM, VISIBLE_MIN_NM, VISIBLE_MAX_NM);

    let r = 0;
    let g = 0;
    let b = 0;
    if (nm < 440) {
        r = -(nm - 440) / (440 - 380);
        b = 1;
    } else if (nm < 490) {
        g = (nm - 440) / (490 - 440);
        b = 1;
    } else if (nm < 510) {
        g = 1;
        b = -(nm - 510) / (510 - 490);
    } else if (nm < 580) {
        r = (nm - 510) / (580 - 510);
        g = 1;
    } else if (nm < 645) {
        r = 1;
        g = -(nm - 645) / (645 - 580);
    } else {
        r = 1;
    }

    let factor = 1;
    if (nm < 420) factor = 0.3 + (0.7 * (nm - 380)) / (420 - 380);
    else if (nm > 700) factor = 0.3 + (0.7 * (780 - nm)) / (780 - 700);

    return Object.freeze({ r: toChannel(r, factor), g: toChannel(g, factor), b: toChannel(b, factor) });
};

/** Pack an {@link Rgb} into a Phaser-style 0xRRGGBB integer. */
export const rgbToInt = (rgb: Rgb): number => (rgb.r << 16) | (rgb.g << 8) | rgb.b;

const sincSquared = (x: number): number => {
    if (x === 0) return 1;
    const px = Math.PI * x;
    const s = Math.sin(px) / px;
    return s * s;
};

/**
 * Relative brightness at a signed distance `offsetPx` from the pattern centre,
 * in [0, 1]. Models the real two-slit interference term modulated by the
 * single-slit diffraction envelope:
 *
 *   I(y) = cos²(π·y / spacing) · sinc²(y / envelope)
 *
 * The centre (offset 0) is the brightest point; bright fringes recur every
 * `spacingPx` and fade outward under the envelope. Non-positive spacing or
 * envelope inputs return 0 rather than dividing by zero.
 */
export const interferenceIntensity = (offsetPx: number, spacingPx: number, envelopePx: number): number => {
    if (!(spacingPx > 0) || !(envelopePx > 0) || !Number.isFinite(offsetPx)) return 0;
    const twoSlit = Math.cos((Math.PI * offsetPx) / spacingPx) ** 2;
    const envelope = sincSquared(offsetPx / envelopePx);
    return clamp(twoSlit * envelope, 0, 1);
};
