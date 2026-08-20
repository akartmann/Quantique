import type { Scene } from 'phaser';

import { uiTextStyle } from '../textStyles';
import { interferenceIntensity, rgbToInt, wavelengthToRgb } from '../../../domain/apparatus/opticalVisualModel';
import { YOUNG_CONTROL_IDS } from '../../../domain/apparatus/calculateYoungFringeSpacing';
import { CENTRE_Y, SCREEN_HALF_HEIGHT, SCREEN_LABEL_HEIGHT, SCREEN_LABEL_Y, screenXForDistance } from './apparatusGeometry';
import { FRINGE_LAYER_NAME, type BenchLightPhase, type BenchTableau, type BenchTableauView } from './benchTableau';

/**
 * Young's optical bench: a lamp, a barrier with two slits, and the screen the fringes resolve on.
 *
 * ## Moved, not rewritten (Story 4.2, Task 3)
 *
 * Every number, every fill and every act of the animation in this file was `ApparatusRenderer`'s until
 * this story, and it is **moved verbatim** — the same layers in the same creation order, the same
 * additive blend modes, the same signature-guarded repaint, the same three light states. AC1's fourth
 * clause is that Young's bench is unchanged for the Young case, pixel intent and text alike, and the way
 * to be able to claim that is to have changed none of the arithmetic.
 *
 * What *did* change is who decides that this is the apparatus to draw. It used to be a duck-type guard
 * on two of Young's own control ids (`hasOpticalGeometry`); it is now
 * `experiment.modelId === 'young-double-slit'`, resolved once in `create()` through the exhaustive
 * record in `benchTableau.ts`. See that module's header for the three defects the guard produced.
 *
 * ## The three things the deleted guard was silently holding
 *
 * Story 3.1's re-statement rule — *make the list of things you relaxed or replaced explicit and tick each
 * one off* — applied to a guard rather than to a schema shape. `hasOpticalGeometry` was load-bearing for
 * three separate things, and all three are now stated where they belong:
 *
 * 1. **The slit and screen placement.** The guard stopped a case with no `slitSpacingMm` computing `NaN`
 *    and calling `setY(NaN)` on the slits and the screen. That cannot happen now for the reason the
 *    guard is gone: this file is only ever constructed for the model that authors those controls, and its
 *    model declares them in `requiredControlIds`, which the schema checks against the case's own
 *    `apparatus.primaryControls` at load. {@link readControl} keeps the last good geometry anyway, for
 *    the one state that is still reachable — a restored record against a changed `case.json`.
 * 2. **The choice between the two fringe painters.** `paintFringes` (a spacing, with a diffraction
 *    envelope) versus `paintDisplacedFringes` (a fixed field, bodily shifted). That was a branch on the
 *    guard; it is now simply which class you are in. Neither file contains the other's painter.
 * 3. **The geometry test's apparatus floor.** `ApparatusGeometry.test.ts` derived one floor from Young's
 *    screen and measured *both* shipped control sets against it. Each tableau now exports its own — see
 *    {@link YOUNG_TABLEAU_FLOOR_Y} — and the sweep asks each case for its own. The two floors happen to
 *    be equal today, because the shared label row is the deepest thing in both; the defect was the
 *    sweep's subject, not its arithmetic, and the test says so rather than implying otherwise.
 */
export class YoungOpticalTableau implements BenchTableau {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private sourceGlow?: Phaser.GameObjects.Arc;
    private sourceCore?: Phaser.GameObjects.Arc;
    private sourceLabel?: Phaser.GameObjects.Text;
    private barrier?: Phaser.GameObjects.Rectangle;
    private slitTop?: Phaser.GameObjects.Rectangle;
    private slitBottom?: Phaser.GameObjects.Rectangle;
    private screen?: Phaser.GameObjects.Rectangle;
    private screenLabel?: Phaser.GameObjects.Text;
    private beamGraphics?: Phaser.GameObjects.Graphics;
    private wavefrontGraphics?: Phaser.GameObjects.Graphics;
    private fringeGraphics?: Phaser.GameObjects.Graphics;

    // Live optical geometry, refreshed from store state and consumed by the animation loop.
    private slitTopY = CENTRE_Y - 30;
    private slitBottomY = CENTRE_Y + 30;
    private screenX = 605;
    private bandSpacingPx = 18;
    private currentWavelengthNm = 550;
    private wavelengthColor = rgbToInt(wavelengthToRgb(550));
    private fringeSignature = '';

    public constructor(private readonly scene: Scene) {}

    public create(): void {
        // Painted layers, back to front: fringe pattern under a soft additive glow of light.
        // Named, so a test can single out the layer the recorded pattern lands on instead of indexing
        // into creation order — see {@link FRINGE_LAYER_NAME}.
        this.fringeGraphics = this.scene.add.graphics().setName(FRINGE_LAYER_NAME);
        this.beamGraphics = this.scene.add.graphics().setBlendMode('ADD');
        this.wavefrontGraphics = this.scene.add.graphics().setBlendMode('ADD');

        this.sourceGlow = this.scene.add.circle(SOURCE_X, CENTRE_Y, 26, this.wavelengthColor, 0.35).setBlendMode('ADD');
        this.sourceCore = this.scene.add.circle(SOURCE_X, CENTRE_Y, 13, 0xfff4d0);
        // Authored empty and written in `render`: `create()` runs once and the locale can change.
        this.sourceLabel = this.scene.add.text(55, 232, '', uiTextStyle({ color: '#f7f4ef', fontSize: '14px' }));
        this.barrier = this.scene.add.rectangle(BARRIER_X, CENTRE_Y, 16, 186, 0x8db7c2);
        this.slitTop = this.scene.add.rectangle(BARRIER_X, this.slitTopY, 22, 13, 0x10252c);
        this.slitBottom = this.scene.add.rectangle(BARRIER_X, this.slitBottomY, 22, 13, 0x10252c);
        this.screen = this.scene.add.rectangle(this.screenX, CENTRE_Y, 14, SCREEN_HALF_HEIGHT * 2, 0x0b1a20);
        this.screenLabel = this.scene.add.text(this.screenX - 31, SCREEN_LABEL_Y, '', uiTextStyle({ color: '#f7f4ef', fontSize: '14px' }));

        this.objects.push(
            this.fringeGraphics, this.beamGraphics, this.wavefrontGraphics,
            this.sourceGlow, this.sourceCore, this.sourceLabel, this.barrier, this.slitTop, this.slitBottom,
            this.screen, this.screenLabel
        );
    }

    public render(view: BenchTableauView): void {
        this.sourceLabel?.setText(view.t('lab.source'));
        this.screenLabel?.setText(view.t('lab.screen'));

        const slitSpacing = readControl(view, SLIT_SPACING_ID);
        const screenDistance = readControl(view, SCREEN_DISTANCE_ID);
        // The last-good-geometry guard, kept for the one state that is still reachable: a restored
        // record against a changed `case.json` can hold a control this case no longer authors, and
        // `setY(NaN)` on the slits leaves an apparatus nobody can see rather than one that has not moved.
        // What this is **no longer** doing is standing in for "is this Young?" — see the class header.
        if (slitSpacing !== undefined && screenDistance !== undefined) {
            const slitGapPx = 28 + ((slitSpacing - 0.1) / 0.4) * 92;
            this.screenX = screenXForDistance(screenDistance);
            this.slitTopY = CENTRE_Y - (slitGapPx / 2);
            this.slitBottomY = CENTRE_Y + (slitGapPx / 2);
            this.slitTop?.setY(this.slitTopY);
            this.slitBottom?.setY(this.slitBottomY);
            this.screen?.setX(this.screenX);
            this.screenLabel?.setPosition(this.screenX - 31, SCREEN_LABEL_Y);
        }

        this.currentWavelengthNm = view.wavelengthNm;
        this.wavelengthColor = rgbToInt(wavelengthToRgb(view.wavelengthNm));
        this.sourceGlow?.setFillStyle(this.wavelengthColor, 0.35);

        // **The pattern is painted from the recorded value and from nothing else.** There is no preview
        // branch: an unrecorded setup has no reading, and the screen stays unlit.
        if (view.recordedResultValue === undefined) return;
        this.bandSpacingPx = Math.max(8, Math.min(31, view.recordedResultValue * 4.6));
        this.paintFringes();
    }

    /**
     * The whole of what the light looks like, in one place, for the three states the bench has.
     *
     * **Dark** — no run, or the setup has moved on from the one that was run: the source is out, no
     * wavefronts propagate, and the screen carries nothing beyond its own unlit bar. **Running** — the
     * source ignites, the beam reaches the slits, wavefronts travel to the screen and the pattern
     * resolves on it. **Resolved** — a still frame of the recorded pattern, with nothing moving.
     *
     * Called from the renderer's update loop while a run is in flight and from `render()` otherwise, on
     * a phase the renderer computes either way — so the reduced-motion path and the animated path end on
     * the same picture rather than on two that agree by coincidence.
     */
    public paintLight(light: BenchLightPhase): void {
        const beam = this.beamGraphics;
        const rings = this.wavefrontGraphics;
        const fringes = this.fringeGraphics;
        if (!beam || !rings || !fringes) return;

        if (light.dark) {
            beam.clear();
            rings.clear();
            fringes.setVisible(false);
            this.sourceGlow?.setAlpha(0).setScale(1);
            this.sourceCore?.setAlpha(0.18).setScale(1);
            return;
        }

        this.sourceGlow?.setAlpha(light.ignition).setScale(1 + (0.9 * light.ignition));
        this.sourceCore?.setAlpha(0.18 + (0.82 * light.ignition)).setScale(1 + (0.35 * light.ignition));

        this.drawBeam(light.ignition);
        if (light.running) {
            this.drawWavefronts(light.travelPhase01, light.ignition);
            // The pattern arrives over the last act, as an alpha on geometry that was painted once.
            fringes.setVisible(light.revealed > 0).setAlpha(light.revealed);
            return;
        }
        // Resolved: the light stands still. No loop is registered and nothing here moves.
        rings.clear();
        fringes.setVisible(true).setAlpha(1);
    }

    public destroy(): void {
        // Nothing here is tweened today — the alphas and scales are set directly — but the kill is kept
        // from the renderer this moved out of, because it is the renderer contract's own clause: release
        // every tween whose target is an object this owns, including one a later story adds.
        this.scene.tweens.killTweensOf([this.sourceGlow, this.sourceCore].filter(Boolean) as Phaser.GameObjects.GameObject[]);
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.sourceGlow = undefined; this.sourceCore = undefined; this.sourceLabel = undefined;
        this.barrier = undefined; this.slitTop = undefined; this.slitBottom = undefined;
        this.screen = undefined; this.screenLabel = undefined;
        this.beamGraphics = undefined; this.wavefrontGraphics = undefined; this.fringeGraphics = undefined;
        this.fringeSignature = '';
    }

    /**
     * Paints the interference pattern as a smooth vertical stack of intensity-shaded rows on the screen,
     * sampling the pure {@link interferenceIntensity} model. Redrawn only when the geometry, spacing, or
     * wavelength changes — never per animation frame. The *reveal* is an alpha on the whole object, so a
     * run resolving does not regenerate the geometry.
     */
    private paintFringes(): void {
        const signature = `${this.screenX.toFixed(1)}|${this.bandSpacingPx.toFixed(2)}|${this.wavelengthColor}`;
        if (signature === this.fringeSignature || !this.fringeGraphics) return;
        this.fringeSignature = signature;
        const envelopePx = this.bandSpacingPx * 3.2;
        const { r, g, b } = wavelengthToRgb(this.currentWavelengthNm);
        const g0 = this.fringeGraphics;
        g0.clear();
        for (let offset = -SCREEN_HALF_HEIGHT; offset <= SCREEN_HALF_HEIGHT; offset += FRINGE_ROW_STEP) {
            const intensity = interferenceIntensity(offset, this.bandSpacingPx, envelopePx);
            if (intensity <= 0.01) continue;
            const color = (Math.round(r * intensity) << 16) | (Math.round(g * intensity) << 8) | Math.round(b * intensity);
            g0.fillStyle(color, Math.min(1, 0.25 + intensity));
            g0.fillRect(this.screenX - FRINGE_STRIP_HALF_WIDTH, CENTRE_Y + offset - FRINGE_ROW_STEP / 2, FRINGE_STRIP_HALF_WIDTH * 2, FRINGE_ROW_STEP);
        }
    }

    /** Incident light: a soft beam wedge plus two crisp converging rays onto the slits. */
    private drawBeam(intensity: number): void {
        const beam = this.beamGraphics;
        if (!beam) return;
        beam.clear();
        if (intensity <= 0) return;
        beam.fillStyle(this.wavelengthColor, 0.14 * intensity);
        beam.fillTriangle(SOURCE_X, CENTRE_Y, BARRIER_X, this.slitTopY, BARRIER_X, this.slitBottomY);
        beam.lineStyle(2, 0xfff4d0, Math.min(1, 0.6 * intensity));
        beam.lineBetween(SOURCE_X, CENTRE_Y, BARRIER_X, this.slitTopY);
        beam.lineBetween(SOURCE_X, CENTRE_Y, BARRIER_X, this.slitBottomY);
    }

    /**
     * Expanding Huygens wavefronts from each slit, whose additive overlap between the slits and the
     * screen renders the interference visually. `basePhase01` in [0,1) advances them.
     *
     * The two slit positions are iterated without allocating an array per frame, which is the discipline
     * §Performance asks for in a render path and which this method has always kept.
     */
    private drawWavefronts(basePhase01: number, intensity: number): void {
        const rings = this.wavefrontGraphics;
        if (!rings) return;
        rings.clear();
        const maxRadius = Math.max(60, this.screenX - BARRIER_X + 24);
        const arcHalfAngleRad = (72 * Math.PI) / 180;
        for (let s = 0; s < 2; s += 1) {
            const slitY = s === 0 ? this.slitTopY : this.slitBottomY;
            for (let i = 0; i < WAVEFRONT_RINGS; i += 1) {
                const p = (basePhase01 + i / WAVEFRONT_RINGS) % 1;
                const radius = p * maxRadius;
                if (radius < 4) continue;
                // Fade in at birth, fade out as the wavefront expands (clamped ≤1).
                const alpha = Math.min(1, Math.min(1, p * 6) * (1 - p) * 0.6 * intensity);
                if (alpha <= 0.01) continue;
                rings.lineStyle(2, this.wavelengthColor, alpha);
                rings.beginPath();
                rings.arc(BARRIER_X, slitY, radius, -arcHalfAngleRad, arcHalfAngleRad, false);
                rings.strokePath();
            }
        }
    }
}

/**
 * One control's current value, or `undefined` when the bench does not carry a finite one for it.
 *
 * Read through the case's own authored control array, so the *presence* of the control is a fact about
 * the definition rather than about a hard-coded key — the surviving half of "never write a control id
 * into a renderer" for a tableau that can only ever be the model whose `requiredControlIds` these are.
 */
const readControl = (view: BenchTableauView, controlId: string): number | undefined => {
    if (!view.controls.some(({ id }) => id === controlId)) return undefined;
    const value = view.controlValues[controlId];
    return Number.isFinite(value) ? value : undefined;
};

/**
 * The two control ids this tableau draws, taken from the **model's own declaration** rather than typed
 * out again.
 *
 * `YOUNG_CONTROL_IDS` is what `young-double-slit` publishes as `requiredControlIds` and what the schema
 * checks against the case's `apparatus.primaryControls` at load. Destructuring it here is what makes the
 * renderer's two ids and the model's two ids one fact instead of two that agree by coincidence — which
 * is precisely how `lab.idle` came to print a rotation angle as a slit spacing.
 */
const [SLIT_SPACING_ID, SCREEN_DISTANCE_ID] = YOUNG_CONTROL_IDS;

const SOURCE_X = 92;
const BARRIER_X = 260;
const FRINGE_STRIP_HALF_WIDTH = 9;
const FRINGE_ROW_STEP = 2;
const WAVEFRONT_RINGS = 6;

/**
 * How far down this tableau reaches, so the bench below it is measured against the right number.
 *
 * The screen bar spans `CENTRE_Y ± SCREEN_HALF_HEIGHT` and its label runs to
 * `SCREEN_LABEL_Y + SCREEN_LABEL_HEIGHT`, at **every** authored throw: the bar slides in x with the
 * throw and never in y. This is the number `ApparatusGeometry.test.ts` used to compute inline and then
 * apply to both shipped cases; see `interferometerGeometry.ts`'s own floor for the other half.
 */
export const YOUNG_TABLEAU_FLOOR_Y = Math.max(CENTRE_Y + SCREEN_HALF_HEIGHT, SCREEN_LABEL_Y + SCREEN_LABEL_HEIGHT);
