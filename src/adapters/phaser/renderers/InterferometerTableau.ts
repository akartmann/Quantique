import type { Scene } from 'phaser';

import { uiTextStyle } from '../textStyles';
import { INTERFEROMETER_CONTROL_IDS, STABLE_WINDOW_C } from '../../../domain/apparatus/calculateInterferometerDrift';
import { CENTRE_Y, SCREEN_HALF_HEIGHT } from './apparatusGeometry';
import { FRINGE_LAYER_NAME, LAMP_LAYER_NAME, type BenchLightPhase, type BenchTableau, type BenchTableauView } from './benchTableau';
import {
    ARM_HALF_WIDTH,
    BATH_INNER_RADIUS,
    BATH_LABEL_WRAP,
    BATH_LABEL_X,
    BATH_OUTER_RADIUS,
    BATH_STEADY_RING_COLOR,
    BATH_STEADY_RING_WIDTH,
    LABEL_FONT_SIZE,
    LABEL_Y,
    MIRROR_HALF_WIDTH,
    MIRROR_THICKNESS,
    RECOMBINED_PATH_START_X,
    SCREEN_LABEL_WRAP,
    SCREEN_X,
    SOURCE_GLOW_RADIUS,
    SOURCE_RADIUS,
    SPLITTER_HALF_LENGTH,
    SPLITTER_THICKNESS,
    STONE_CENTRE_X,
    STONE_CENTRE_Y,
    STONE_LABEL_WRAP,
    STONE_RADIUS,
    armEndPoint,
    bathFillColor,
    bathWarmth01,
    sourcePoint
} from './interferometerGeometry';

/**
 * The rotating interferometer: a stone floating in a temperature bath, carrying a beam splitter, two
 * perpendicular arms with their end mirrors, and the recombined path out to the observing screen
 * (Story 4.2, AC1 / AC2 / AC8).
 *
 * ## What this closes
 *
 * `deferred-work.md:216` and `:278`, and gap #1 of `docs/case-prototypes/morley-miller-prototype.md` §8:
 * *"a reviewer opening the prototype sees an optical bench with rotation and temperature knobs on it."*
 * The **screen** was never part of that gap — `paintDisplacedFringes` was delivered and mutation-proven
 * by the code review of 3.2, and its docstring was narrowed in writing to say so. What was left is the
 * apparatus *around* the screen, and that is this file.
 *
 * ## No asset, and no ledger row (AC8)
 *
 * `Graphics` fill commands only. No texture is loaded, nothing is added to `case.json`'s
 * `assets.entries`, and no row joins the rights ledger — which is not merely cheap but *necessary*: this
 * case is ledger-**BLOCKED** on an unassigned scholarly reviewer, and a new asset would be a new row
 * needing a rights judgement nobody has made. `ReadingRoomDecor` and `LaboratoryDecor` are the two
 * precedents and the rule that licenses them: **scenery is generated once in the create pass, and that
 * is what keeps it legal** under §Performance's "prefer atlases over regenerating `Graphics` geometry
 * each frame". So the stone, the bath and the screen are painted once here and never regenerated; only
 * the parts that genuinely move with a control or with the light are redrawn, and each of those is
 * signature-guarded so a repaint with nothing changed does no fills at all.
 *
 * ## What rotates, and what does not
 *
 * The stone and everything mounted on it — the lamp, the splitter, both arms, both end mirrors — turn
 * with `rotationDeg`. The observing screen does not, because the case's own second authored assumption
 * is *"The fringe displacement is read at a fixed position of the turn, not while turning"*. That is why
 * there is no rotation term anywhere in the recombined path or the screen.
 *
 * The rotation is bound to `activeControlValues.rotationDeg` and the bath's visual state to `bathTempC`.
 * **Both come from the store and neither is inferred** — the whole point of AC1's last clause.
 *
 * ## ADR-012
 *
 * The apparatus is **dark until the player starts it**: `create()` registers no loop and paints no lit
 * state, and the light's three acts are driven from the {@link BenchLightPhase} the renderer computes
 * from a run it already recorded. Under `prefers-reduced-motion` the renderer registers no loop at all
 * and hands this a resolved phase, so `paintLight` paints the settled frame directly — this file needs no
 * reduced-motion branch of its own, and having one would be a second copy of a decision that is made
 * once.
 */
export class InterferometerTableau implements BenchTableau {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    /** Painted once in the create pass and never regenerated: the trough, the stone, the screen bar. */
    private stoneGraphics?: Phaser.GameObjects.Graphics;
    /** Repainted only when the bath's own temperature changes. Signature-guarded. */
    private bathGraphics?: Phaser.GameObjects.Graphics;
    /** Repainted only when the bench's rotation changes. Signature-guarded. */
    private apparatusGraphics?: Phaser.GameObjects.Graphics;
    /** The light: the lamp's glow, the arms' beams and the recombined path. Per-frame while running. */
    private beamGraphics?: Phaser.GameObjects.Graphics;
    /** The fringe field on the observing screen, painted from the recorded displacement. */
    private fringeGraphics?: Phaser.GameObjects.Graphics;
    private sourceGlow?: Phaser.GameObjects.Arc;
    private sourceCore?: Phaser.GameObjects.Arc;
    private bathLabel?: Phaser.GameObjects.Text;
    private stoneLabel?: Phaser.GameObjects.Text;
    private screenLabel?: Phaser.GameObjects.Text;

    /** The live bench state the light's per-frame pass reads, refreshed by {@link render}. */
    private rotationDeg = 0;
    private bathSignature = '';
    private apparatusSignature = '';
    private fringeSignature = '';

    public constructor(private readonly scene: Scene) {}

    public create(): void {
        // Back to front, and creation order *is* the depth mechanism most renderers here use: the bath
        // and the stone under the apparatus, the apparatus under the light, the fringe field on the
        // screen bar. An overlay built before the thing it sits on is one of the three defects the 2.9
        // review found only by screenshotting.
        this.bathGraphics = this.scene.add.graphics();
        this.stoneGraphics = this.scene.add.graphics();
        this.apparatusGraphics = this.scene.add.graphics();
        // Named for the same reason Young's is, and it is *this* tableau that made the naming necessary:
        // its bath occupies the index three tests had written down as the fringe field.
        this.fringeGraphics = this.scene.add.graphics().setName(FRINGE_LAYER_NAME);
        this.beamGraphics = this.scene.add.graphics().setBlendMode('ADD');

        this.sourceGlow = this.scene.add.circle(STONE_CENTRE_X, STONE_CENTRE_Y, SOURCE_GLOW_RADIUS, LAMP_COLOR, 0.35).setBlendMode('ADD');
        // Named because it *moves*: the lamp rides the stone, and that is AC1's "turns when I move the
        // dial" — see {@link LAMP_LAYER_NAME} for why a name rather than an index.
        this.sourceCore = this.scene.add.circle(STONE_CENTRE_X, STONE_CENTRE_Y, SOURCE_RADIUS, 0xfff4d0).setName(LAMP_LAYER_NAME);

        // Authored empty and written in `render`: `create()` runs once and the locale can change.
        this.bathLabel = this.scene.add.text(BATH_LABEL_X, LABEL_Y, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${LABEL_FONT_SIZE}px`, wordWrap: { width: BATH_LABEL_WRAP }
        }));
        this.stoneLabel = this.scene.add.text(STONE_CENTRE_X, LABEL_Y, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${LABEL_FONT_SIZE}px`, align: 'center', wordWrap: { width: STONE_LABEL_WRAP }
        })).setOrigin(0.5, 0);
        this.screenLabel = this.scene.add.text(SCREEN_X, LABEL_Y, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${LABEL_FONT_SIZE}px`, align: 'center', wordWrap: { width: SCREEN_LABEL_WRAP }
        })).setOrigin(0.5, 0);

        this.objects.push(
            this.bathGraphics, this.stoneGraphics, this.apparatusGraphics, this.fringeGraphics, this.beamGraphics,
            this.sourceGlow, this.sourceCore, this.bathLabel, this.stoneLabel, this.screenLabel
        );

        this.paintFixedScenery();
    }

    public render(view: BenchTableauView): void {
        this.bathLabel?.setText(view.t('lab.interferometer.bath'));
        this.stoneLabel?.setText(view.t('lab.interferometer.bench'));
        this.screenLabel?.setText(view.t('lab.interferometer.screen'));

        const rotation = readControl(view, ROTATION_ID);
        const bathTempC = readControl(view, BATH_TEMP_ID);
        // Last-good-geometry, exactly as Young's tableau keeps: a restored record against a changed
        // `case.json` can hold no finite value for a control, and a stone drawn at `NaN` degrees is an
        // apparatus nobody can see rather than one that has not turned. This is **not** a case-shape
        // guard — which apparatus is drawn was settled in `create()` by the model id.
        if (rotation !== undefined) this.rotationDeg = rotation;
        this.paintApparatus();
        this.paintBath(view, bathTempC);

        // **The pattern is painted from the recorded value and from nothing else** — the same rule
        // Young's tableau follows. An unrecorded setup has no reading, and the screen stays unlit.
        if (view.recordedResultValue === undefined) return;
        this.paintDisplacedFringes(view.recordedResultValue);
    }

    /**
     * The light, in the three states this bench has.
     *
     * **Dark** — the lamp is out, no beam crosses the arms, and the screen carries nothing beyond its own
     * unlit bar. **Running** — the lamp ignites, the split beams travel out to the mirrors and back, the
     * recombined path reaches the screen, and the fringe field arrives over the last act. **Resolved** —
     * a still frame with the beams standing and nothing moving.
     *
     * Every act is read off the phase the renderer computed, so this file contains no timing of its own
     * and cannot drift from Young's — which is what makes "the reduced-motion frame and the animated
     * frame are the same picture" a property of one computation rather than of two that agree.
     */
    public paintLight(light: BenchLightPhase): void {
        const beam = this.beamGraphics;
        const fringes = this.fringeGraphics;
        if (!beam || !fringes) return;

        if (light.dark) {
            beam.clear();
            fringes.setVisible(false);
            this.sourceGlow?.setAlpha(0).setScale(1);
            this.sourceCore?.setAlpha(0.18).setScale(1);
            return;
        }

        this.sourceGlow?.setAlpha(light.ignition).setScale(1 + (0.9 * light.ignition));
        this.sourceCore?.setAlpha(0.18 + (0.82 * light.ignition)).setScale(1 + (0.35 * light.ignition));

        this.drawBeams(light);
        if (light.running) {
            fringes.setVisible(light.revealed > 0).setAlpha(light.revealed);
            return;
        }
        fringes.setVisible(true).setAlpha(1);
    }

    public destroy(): void {
        this.scene.tweens.killTweensOf([this.sourceGlow, this.sourceCore].filter(Boolean) as Phaser.GameObjects.GameObject[]);
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.bathGraphics = undefined; this.stoneGraphics = undefined; this.apparatusGraphics = undefined;
        this.fringeGraphics = undefined; this.beamGraphics = undefined;
        this.sourceGlow = undefined; this.sourceCore = undefined;
        this.bathLabel = undefined; this.stoneLabel = undefined; this.screenLabel = undefined;
        this.rotationDeg = 0;
        this.bathSignature = ''; this.apparatusSignature = ''; this.fringeSignature = '';
    }

    /**
     * The parts that never move: the stone's face and the unlit screen bar.
     *
     * Generated **once**, in the create pass, which is the clause of §Performance that licenses a
     * `Graphics`-built backdrop at all. Nothing in `render` or `paintLight` touches this object.
     */
    private paintFixedScenery(): void {
        const g0 = this.stoneGraphics;
        if (!g0) return;
        g0.fillStyle(STONE_FILL, 1);
        g0.fillCircle(STONE_CENTRE_X, STONE_CENTRE_Y, STONE_RADIUS);
        g0.lineStyle(2, STONE_EDGE, 1);
        g0.strokeCircle(STONE_CENTRE_X, STONE_CENTRE_Y, STONE_RADIUS);
        // The unlit observing screen, the same dark bar Young's tableau stands a `Rectangle` for. A fill
        // rather than a `Rectangle` because this tableau has a `Graphics` in the create pass anyway and
        // one object is cheaper than two — the shape and the size are identical.
        g0.fillStyle(SCREEN_FILL, 1);
        g0.fillRect(SCREEN_X - SCREEN_BAR_HALF_WIDTH_PX, CENTRE_Y - SCREEN_HALF_HEIGHT, SCREEN_BAR_HALF_WIDTH_PX * 2, SCREEN_HALF_HEIGHT * 2);
    }

    /**
     * The trough the stone floats in, coloured by its own temperature, and the ring that says it is steady.
     *
     * **The ring is AC2's in-fiction statement of the stable window**, alongside the authored
     * `experiment.resetPath.description` that names the number in the reader's own language on the
     * apparatus-notes surface. A colour ramp alone tells the player the bath is warm; it does not tell
     * them *where* to bring it back to. The ring appears exactly when the bath is at
     * {@link STABLE_WINDOW_C} — the model's own constant, imported rather than restated, so the picture
     * and the physics cannot disagree about which temperature the thermal term vanishes at.
     *
     * Exactly, and with no invented tolerance: the thermal term is `k · (bathTempC − STABLE_WINDOW_C)`,
     * which vanishes at one temperature and not in a neighbourhood of it. A tolerance here would be a
     * second, softer definition of "steady" than the model's, and the player would see the ring while
     * still reading a thermal contribution.
     */
    private paintBath(view: BenchTableauView, bathTempC: number | undefined): void {
        const g0 = this.bathGraphics;
        const bath = view.controls.find(({ id }) => id === BATH_TEMP_ID);
        if (!g0 || !bath) return;
        const warmth = bathWarmth01(bathTempC ?? bath.defaultValue, bath.min, bath.max);
        const steady = bathTempC === STABLE_WINDOW_C;
        const signature = `${warmth.toFixed(4)}|${steady}`;
        if (signature === this.bathSignature) return;
        this.bathSignature = signature;

        g0.clear();
        g0.fillStyle(bathFillColor(warmth), 1);
        g0.fillCircle(STONE_CENTRE_X, STONE_CENTRE_Y, BATH_OUTER_RADIUS);
        // The stone's own face is painted over this by `stoneGraphics`, which sits above it — so the
        // trough reads as an annulus without this object having to punch a hole in itself.
        g0.lineStyle(1, STONE_EDGE, 0.6);
        g0.strokeCircle(STONE_CENTRE_X, STONE_CENTRE_Y, BATH_INNER_RADIUS);
        if (steady) {
            g0.lineStyle(BATH_STEADY_RING_WIDTH, BATH_STEADY_RING_COLOR, 1);
            g0.strokeCircle(STONE_CENTRE_X, STONE_CENTRE_Y, BATH_OUTER_RADIUS);
        }
    }

    /**
     * The splitter, the two arms and their end mirrors, at the bench's current rotation.
     *
     * Signature-guarded on the rotation alone, so the fills are re-issued only when the stone has
     * actually turned — a repaint at the same angle does nothing, which is what keeps a store change
     * that moved the bath from redrawing the apparatus.
     */
    private paintApparatus(): void {
        const g0 = this.apparatusGraphics;
        if (!g0) return;
        const signature = this.rotationDeg.toFixed(2);
        if (signature === this.apparatusSignature) return;
        this.apparatusSignature = signature;

        g0.clear();
        // The keel line across the stone, so the rotation is legible on the disc as well as from the
        // arms. A round stone has no orientation of its own; without this, a turn of the bench between
        // two authored steps would be visible only where an arm happens to fall.
        const keel = armEndPoint(this.rotationDeg, 0);
        const keelOpposite = armEndPoint(this.rotationDeg + 180, 0);
        g0.lineStyle(1, STONE_EDGE, 0.75);
        g0.lineBetween(keelOpposite.x, keelOpposite.y, keel.x, keel.y);

        ([0, 1] as const).forEach((armIndex) => {
            const end = armEndPoint(this.rotationDeg, armIndex);
            const angleRad = ((this.rotationDeg + (armIndex * 90)) * Math.PI) / 180;
            // The arm itself: a bar from the splitter out to the mirror, drawn as a quad so it has a
            // width at any angle rather than being a hairline the rotation thins out.
            const normalX = -Math.sin(angleRad) * ARM_HALF_WIDTH;
            const normalY = Math.cos(angleRad) * ARM_HALF_WIDTH;
            g0.fillStyle(ARM_FILL, 1);
            g0.fillTriangle(
                STONE_CENTRE_X + normalX, STONE_CENTRE_Y + normalY,
                STONE_CENTRE_X - normalX, STONE_CENTRE_Y - normalY,
                end.x - normalX, end.y - normalY
            );
            g0.fillTriangle(
                STONE_CENTRE_X + normalX, STONE_CENTRE_Y + normalY,
                end.x + normalX, end.y + normalY,
                end.x - normalX, end.y - normalY
            );
            // The end mirror: a bar across the arm, so it reads as something the light bounces off
            // rather than as the arm simply stopping.
            const mirrorX = -Math.sin(angleRad) * MIRROR_HALF_WIDTH;
            const mirrorY = Math.cos(angleRad) * MIRROR_HALF_WIDTH;
            const depthX = Math.cos(angleRad) * MIRROR_THICKNESS;
            const depthY = Math.sin(angleRad) * MIRROR_THICKNESS;
            g0.fillStyle(MIRROR_FILL, 1);
            g0.fillTriangle(end.x + mirrorX, end.y + mirrorY, end.x - mirrorX, end.y - mirrorY, end.x - mirrorX + depthX, end.y - mirrorY + depthY);
            g0.fillTriangle(end.x + mirrorX, end.y + mirrorY, end.x + mirrorX + depthX, end.y + mirrorY + depthY, end.x - mirrorX + depthX, end.y - mirrorY + depthY);
        });

        // The beam splitter at the crossing, set at 45° to both arms — which is what makes one beam two.
        const splitterRad = ((this.rotationDeg + 45) * Math.PI) / 180;
        const splitterX = Math.cos(splitterRad) * SPLITTER_HALF_LENGTH;
        const splitterY = Math.sin(splitterRad) * SPLITTER_HALF_LENGTH;
        const splitterNormalX = -Math.sin(splitterRad) * SPLITTER_THICKNESS;
        const splitterNormalY = Math.cos(splitterRad) * SPLITTER_THICKNESS;
        g0.fillStyle(SPLITTER_FILL, 1);
        g0.fillTriangle(
            STONE_CENTRE_X - splitterX, STONE_CENTRE_Y - splitterY,
            STONE_CENTRE_X + splitterX, STONE_CENTRE_Y + splitterY,
            STONE_CENTRE_X + splitterX + splitterNormalX, STONE_CENTRE_Y + splitterY + splitterNormalY
        );
        g0.fillTriangle(
            STONE_CENTRE_X - splitterX, STONE_CENTRE_Y - splitterY,
            STONE_CENTRE_X - splitterX + splitterNormalX, STONE_CENTRE_Y - splitterY + splitterNormalY,
            STONE_CENTRE_X + splitterX + splitterNormalX, STONE_CENTRE_Y + splitterY + splitterNormalY
        );

        // The lamp rides the stone, so it moves with the rotation the same way the arms do.
        const lamp = sourcePoint(this.rotationDeg);
        this.sourceGlow?.setPosition(lamp.x, lamp.y);
        this.sourceCore?.setPosition(lamp.x, lamp.y);
    }

    /**
     * The light on its way round the apparatus: lamp to splitter, out along both arms, and recombined
     * across to the screen.
     *
     * Per-frame while a run is in flight, so it allocates nothing and measures nothing. The travelling
     * part is the recombined path's leading edge, which is this apparatus's equivalent of Young's
     * wavefronts — the moment of spectacle `EXPERIENCE.md` §Feedback asks the run to have — and it is
     * driven by the phase the renderer passes rather than by a frame counter.
     */
    private drawBeams(light: BenchLightPhase): void {
        const beam = this.beamGraphics;
        if (!beam) return;
        beam.clear();
        if (light.ignition <= 0) return;

        const lamp = sourcePoint(this.rotationDeg);
        beam.lineStyle(2, LAMP_COLOR, Math.min(1, 0.7 * light.ignition));
        beam.lineBetween(lamp.x, lamp.y, STONE_CENTRE_X, STONE_CENTRE_Y);
        ([0, 1] as const).forEach((armIndex) => {
            const end = armEndPoint(this.rotationDeg, armIndex);
            beam.lineBetween(STONE_CENTRE_X, STONE_CENTRE_Y, end.x, end.y);
        });

        // The recombined path. While the run is in flight it grows from the stone toward the screen, so
        // the player watches the reading arrive rather than being handed it; once resolved it stands.
        const reach = light.running ? Math.min(1, light.travelPhase01 + light.revealed) : 1;
        const endX = RECOMBINED_PATH_START_X + ((SCREEN_X - RECOMBINED_PATH_START_X) * reach);
        beam.lineStyle(3, LAMP_COLOR, Math.min(1, 0.55 * light.ignition));
        beam.lineBetween(RECOMBINED_PATH_START_X, CENTRE_Y, endX, CENTRE_Y);
    }

    /**
     * The screen for a case whose reading is a fringe *displacement* rather than a fringe spacing.
     *
     * A regular fringe field at a constant spacing, shifted bodily by the recorded drift. **Moved here
     * verbatim from `ApparatusRenderer`, deliberately unchanged**: it was delivered and mutation-proven
     * by the code review of 3.2, and gap #1 was narrowed in writing to exclude it. The shift is
     * deliberately **not** exaggerated — a Morley–Miller reading at the stable window is a fraction of a
     * fringe width, so the honest picture is a field that barely moves and the number in the readout is
     * what carries the precision. Amplifying it for legibility would be a physics lie painted onto the
     * one observation the case is about.
     *
     * No diffraction envelope, unlike Young's `paintFringes`: an interferometer's field is even across
     * the aperture.
     */
    private paintDisplacedFringes(displacementFringeWidths: number): void {
        const offsetPx = displacementFringeWidths * INTERFEROMETER_BAND_SPACING_PX;
        const signature = `displaced|${offsetPx.toFixed(3)}`;
        if (signature === this.fringeSignature || !this.fringeGraphics) return;
        this.fringeSignature = signature;
        const g0 = this.fringeGraphics;
        g0.clear();
        for (let offset = -SCREEN_HALF_HEIGHT; offset <= SCREEN_HALF_HEIGHT; offset += FRINGE_ROW_STEP) {
            const phase = ((offset - offsetPx) / INTERFEROMETER_BAND_SPACING_PX) * Math.PI;
            const intensity = Math.cos(phase) ** 2;
            if (intensity <= 0.01) continue;
            const color = (Math.round(FRINGE_RGB.r * intensity) << 16)
                | (Math.round(FRINGE_RGB.g * intensity) << 8)
                | Math.round(FRINGE_RGB.b * intensity);
            g0.fillStyle(color, Math.min(1, 0.25 + intensity));
            g0.fillRect(SCREEN_X - FRINGE_STRIP_HALF_WIDTH, CENTRE_Y + offset - FRINGE_ROW_STEP / 2, FRINGE_STRIP_HALF_WIDTH * 2, FRINGE_ROW_STEP);
        }
    }
}

/** One control's current value, or `undefined` when the bench carries no finite one for it. */
const readControl = (view: BenchTableauView, controlId: string): number | undefined => {
    if (!view.controls.some(({ id }) => id === controlId)) return undefined;
    const value = view.controlValues[controlId];
    return Number.isFinite(value) ? value : undefined;
};

/**
 * The two control ids this tableau draws, from the **model's own declaration** rather than typed again.
 *
 * `INTERFEROMETER_CONTROL_IDS` is what `morley-miller-interferometer` publishes as `requiredControlIds`
 * and what the schema checks against the case's `apparatus.primaryControls` at load — so the artwork's
 * two ids and the physics' two ids are one fact rather than two that agree by coincidence.
 */
const [ROTATION_ID, BATH_TEMP_ID] = INTERFEROMETER_CONTROL_IDS;

/**
 * Fringe spacing for a screen pattern that is a *displacement*, not a spacing.
 *
 * Young's bands are spaced by the reading itself, so its `bandSpacingPx` is derived from the result. An
 * interferometer's reading is how far an otherwise-fixed fringe field has walked, so the spacing is a
 * constant of the picture and the result is an offset within it. Moved from `ApparatusRenderer`, where it
 * was a module constant beside Young's.
 */
const INTERFEROMETER_BAND_SPACING_PX = 18;
const FRINGE_STRIP_HALF_WIDTH = 9;
const FRINGE_ROW_STEP = 2;
/** Young's screen bar half-width, restated as this tableau's own because it is drawn as a fill here. */
const SCREEN_BAR_HALF_WIDTH_PX = 7;

/**
 * The fringe field's colour: white light, because this apparatus authors no wavelength to select.
 *
 * Young's field takes its colour from `wavelengthToRgb(selectedWavelengthNm)`. This one must not: the
 * interferometer authors no `experiment.wavelengthComparison`, `selectWavelengthChoices` returns an empty
 * list for it, and `AppState` nevertheless initialises `selectedWavelengthNm` to 550 for **every** case —
 * so reading that field here would tint this apparatus with a wavelength the player cannot see, cannot
 * change, and which has no part in its physics. That is the same shape as the deleted guard: a Young
 * quantity read off a case that does not author it.
 */
const FRINGE_RGB = Object.freeze({ r: 0xf0, g: 0xf4, b: 0xe8 });

const LAMP_COLOR = 0xfff4d0;
const STONE_FILL = 0x24404a;
const STONE_EDGE = 0x8db7c2;
const ARM_FILL = 0x8db7c2;
const MIRROR_FILL = 0xdfeaea;
const SPLITTER_FILL
    = 0xb8d4c8;
const SCREEN_FILL = 0x0b1a20;
