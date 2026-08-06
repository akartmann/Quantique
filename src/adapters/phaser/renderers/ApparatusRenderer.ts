import { BlendModes, type Scene } from 'phaser';

import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import type { AppState } from '../../../core/store/AppState';
import { formatRecordedValue } from '../../../core/i18n/formatNumber';
import { createTranslator, type Translator } from '../../../core/i18n/translate';
import { selectControlLabel, selectFormattedControlValue, selectLocale, selectPrimaryControl } from '../../../core/store/selectors';
import type { PrimaryControl } from '../../../domain/cases/CaseDefinition';
import { interferenceIntensity, rgbToInt, wavelengthToRgb } from '../../../domain/apparatus/opticalVisualModel';

const SOURCE_X = 92;
const BARRIER_X = 260;
const CENTRE_Y = 200;
const SCREEN_HALF_HEIGHT = 108;
const FRINGE_STRIP_HALF_WIDTH = 9;
const FRINGE_ROW_STEP = 2;
const WAVEFRONT_RINGS = 6;
const WAVEFRONT_PERIOD_MS = 2600;

/** Clearance between the bottom of the result readout and the first control row. */
const RESULT_READOUT_GAP = 14;
const MAX_RESULT_FONT_SIZE = 19;
const MIN_RESULT_FONT_SIZE = 15;
/** Headroom above the readout before it would reach the painted screen and its label. */
const RESULT_READOUT_MAX_HEIGHT = 96;

export class ApparatusRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private readonly controls: Phaser.GameObjects.Text[] = [];
    private readonly readouts = new Map<PrimaryControl['id'], Phaser.GameObjects.Text>();
    private resultReadout?: Phaser.GameObjects.Text;
    private resultReadoutBottomY = 0;
    private visualGuidance?: Phaser.GameObjects.Text;
    private sourceGlow?: Phaser.GameObjects.Arc;
    private sourceCore?: Phaser.GameObjects.Arc;
    private barrier?: Phaser.GameObjects.Rectangle;
    private slitTop?: Phaser.GameObjects.Rectangle;
    private slitBottom?: Phaser.GameObjects.Rectangle;
    private screen?: Phaser.GameObjects.Rectangle;
    private screenLabel?: Phaser.GameObjects.Text;
    private title?: Phaser.GameObjects.Text;
    private guide?: Phaser.GameObjects.Text;
    private sourceLabel?: Phaser.GameObjects.Text;
    private decreaseButtons: Phaser.GameObjects.Text[] = [];
    private increaseButtons: Phaser.GameObjects.Text[] = [];
    private beamGraphics?: Phaser.GameObjects.Graphics;
    private wavefrontGraphics?: Phaser.GameObjects.Graphics;
    private fringeGraphics?: Phaser.GameObjects.Graphics;
    private lastRunId?: string;
    private inputEnabled = true;

    // Live optical geometry, refreshed from store state and consumed by the animation loop.
    private slitTopY = CENTRE_Y - 30;
    private slitBottomY = CENTRE_Y + 30;
    private screenX = 605;
    private bandSpacingPx = 18;
    private currentWavelengthNm = 550;
    private wavelengthColor = rgbToInt(wavelengthToRgb(550));
    private fringeSignature = '';
    private animPhaseMs = 0;
    private measurementBoost = 0;
    private updateBound?: (time: number, delta: number) => void;
    private readonly reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    private motionAllowed = !this.reducedMotionQuery.matches;

    public constructor(private readonly scene: Scene, private readonly storeAdapter: PhaserStoreAdapter) {}

    // Reduced-motion can be toggled at runtime; keep the cached flag and the loop in sync when it changes.
    private readonly onReducedMotionChange = (): void => {
        this.motionAllowed = !this.reducedMotionQuery.matches;
        this.syncAnimationLoop();
        if (!this.motionAllowed) this.drawPropagation(0);
    };

    /** The continuous loop runs only while motion is allowed AND the apparatus is visible (no book overlay). */
    private syncAnimationLoop(): void {
        const shouldRun = this.motionAllowed && this.inputEnabled;
        if (shouldRun && !this.updateBound) {
            this.updateBound = (_time, delta) => this.onUpdate(delta);
            this.scene.events.on('update', this.updateBound, this);
        } else if (!shouldRun && this.updateBound) {
            this.scene.events.off('update', this.updateBound, this);
            this.updateBound = undefined;
        }
    }

    public create(): void {
        // Text is authored empty here and populated by render(): create() runs once, but the language
        // can change at any time, so every string has to come from the store subscription (AC2).
        this.title = this.scene.add.text(40, 28, '', uiTextStyle({ color: '#f7f4ef', fontSize: '24px', wordWrap: { width: 900 } }));
        this.guide = this.scene.add.text(40, 62, '', uiTextStyle({ color: '#c7d7d9', fontSize: '15px', wordWrap: { width: 900 } }));
        this.objects.push(this.title, this.guide);
        this.createRichPattern();
        const controlsTop = Math.max(440, this.scene.scale.height - 190);
        this.storeAdapter.getState().caseDefinition.apparatus.primaryControls.forEach((control, index) => this.createControl(control.id, controlsTop + (index * 74)));
        // The readout is bottom-anchored to the gap above the first control, so a string that needs
        // an extra line grows upward into empty space instead of down over the control row. French
        // runs 15–25% longer than English and `lab.result.emptyHint` is a third line at this width.
        this.resultReadoutBottomY = controlsTop - RESULT_READOUT_GAP;
        this.resultReadout = this.scene.add.text(40, this.resultReadoutBottomY, '', uiTextStyle({ color: '#f7f4ef', fontSize: `${MAX_RESULT_FONT_SIZE}px`, wordWrap: { width: 620 } }))
            .setOrigin(0, 1);
        this.objects.push(this.resultReadout);
        this.updatePhoneReadOnlyMode();
        window.addEventListener('resize', this.updatePhoneReadOnlyMode);

        // Continuous light propagation runs off the scene update loop so it is smooth and
        // frame-rate independent. Under reduced motion no loop registers and render() paints a static frame.
        this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);
        this.syncAnimationLoop();
    }

    public render(state: AppState): void {
        const locale = selectLocale(state);
        const t = createTranslator(locale);
        this.title?.setText(t('lab.title'));
        this.guide?.setText(t('lab.guide'));
        this.sourceLabel?.setText(t('lab.source'));
        this.screenLabel?.setText(t('lab.screen'));
        this.decreaseButtons.forEach((button) => button.setText(t('lab.control.decrease')));
        this.increaseButtons.forEach((button) => button.setText(t('lab.control.increase')));
        state.caseDefinition.apparatus.primaryControls.forEach((control) => {
            this.readouts.get(control.id)?.setText(t('lab.control.readout', {
                label: selectControlLabel(state, control.id),
                value: selectFormattedControlValue(state, control.id)
            }));
        });
        const latest = state.runs[state.runs.length - 1];
        const latestMatchesActiveSetup = latest?.modelInputs
            && latest.modelInputs.slitSpacingMm === state.activeControlValues.slitSpacingMm
            && latest.modelInputs.screenDistanceM === state.activeControlValues.screenDistanceM
            && latest.modelInputs.wavelengthNm === state.selectedWavelengthNm
            && latest.modelInputs.wavelengthMode === state.selectedWavelengthMode;
        this.resultReadout?.setText(latest?.modelInputs
            ? latestMatchesActiveSetup
                ? t('lab.result.recorded', {
                    value: formatRecordedValue(locale, latest.result.value, latest.result.unit),
                    wavelength: latest.modelInputs.wavelengthNm,
                    mode: t(`lab.wavelengthMode.${latest.modelInputs.wavelengthMode}`)
                })
                : t('lab.result.stale', { value: formatRecordedValue(locale, latest.result.value, latest.result.unit) })
            : t('lab.result.emptyHint'));
        this.fitResultReadout();
        this.renderApparatusGeometry(state, t, latestMatchesActiveSetup ? latest?.result.value : undefined);
        if (latest && latest.id !== this.lastRunId) this.animateRecordedRun();
        this.lastRunId = latest?.id;
        // With no update loop (reduced motion), the store subscription is the only paint trigger.
        if (!this.motionAllowed) this.drawPropagation(0);
    }

    public destroy(): void {
        window.removeEventListener('resize', this.updatePhoneReadOnlyMode);
        this.reducedMotionQuery.removeEventListener('change', this.onReducedMotionChange);
        if (this.updateBound) this.scene.events.off('update', this.updateBound, this);
        this.updateBound = undefined;
        // Kill every tween this renderer can start — including the `targets: this` measurementBoost tween
        // and the resultReadout fade — so nothing writes to torn-down objects after destroy.
        this.scene.tweens.killTweensOf(this);
        this.scene.tweens.killTweensOf([this.sourceGlow, this.sourceCore, this.resultReadout].filter(Boolean) as Phaser.GameObjects.GameObject[]);
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0; this.controls.length = 0; this.readouts.clear();
        this.decreaseButtons.length = 0; this.increaseButtons.length = 0;
        this.title = undefined; this.guide = undefined; this.sourceLabel = undefined;
        this.resultReadout = undefined; this.visualGuidance = undefined; this.slitTop = undefined; this.slitBottom = undefined; this.screen = undefined; this.screenLabel = undefined;
        this.sourceGlow = undefined; this.sourceCore = undefined; this.barrier = undefined;
        this.beamGraphics = undefined; this.wavefrontGraphics = undefined; this.fringeGraphics = undefined;
        this.lastRunId = undefined; this.fringeSignature = ''; this.measurementBoost = 0;
    }

    /** The book overlay temporarily owns pointer interaction without changing laboratory state. */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.updatePhoneReadOnlyMode();
        // Pause the animation loop while the book overlay covers the apparatus; resume when it closes.
        this.syncAnimationLoop();
    }

    private createRichPattern(): void {
        // Painted layers, back to front: fringe pattern under a soft additive glow of light.
        this.fringeGraphics = this.scene.add.graphics();
        this.beamGraphics = this.scene.add.graphics().setBlendMode(BlendModes.ADD);
        this.wavefrontGraphics = this.scene.add.graphics().setBlendMode(BlendModes.ADD);

        this.sourceGlow = this.scene.add.circle(SOURCE_X, CENTRE_Y, 26, this.wavelengthColor, 0.35).setBlendMode(BlendModes.ADD);
        this.sourceCore = this.scene.add.circle(SOURCE_X, CENTRE_Y, 13, 0xfff4d0);
        this.sourceLabel = this.scene.add.text(55, 232, '', uiTextStyle({ color: '#f7f4ef', fontSize: '14px' }));
        this.barrier = this.scene.add.rectangle(BARRIER_X, CENTRE_Y, 16, 186, 0x8db7c2);
        this.slitTop = this.scene.add.rectangle(BARRIER_X, this.slitTopY, 22, 13, 0x10252c);
        this.slitBottom = this.scene.add.rectangle(BARRIER_X, this.slitBottomY, 22, 13, 0x10252c);
        this.screen = this.scene.add.rectangle(this.screenX, CENTRE_Y, 14, SCREEN_HALF_HEIGHT * 2, 0x0b1a20);
        this.screenLabel = this.scene.add.text(this.screenX - 31, 322, '', uiTextStyle({ color: '#f7f4ef', fontSize: '14px' }));
        this.visualGuidance = this.scene.add.text(40, 348, '', uiTextStyle({ color: '#c7d7d9', fontSize: '13px', wordWrap: { width: 620 } }));

        this.objects.push(
            this.fringeGraphics, this.beamGraphics, this.wavefrontGraphics,
            this.sourceGlow, this.sourceCore, this.sourceLabel, this.barrier, this.slitTop, this.slitBottom,
            this.screen, this.screenLabel, this.visualGuidance
        );
    }

    /**
     * Keeps the readout inside the gap above the controls. Bottom-anchored, so the common case costs
     * one measurement and no reflow; the shrink loop only runs for a string long enough to reach the
     * painted screen above, which is the same mechanism {@link LectureBookRenderer} uses for its
     * authored leaves. Called on state change, never per frame.
     */
    private fitResultReadout(): void {
        const readout = this.resultReadout;
        if (!readout) return;
        readout.setFontSize(MAX_RESULT_FONT_SIZE);
        for (let fontSize = MAX_RESULT_FONT_SIZE; fontSize > MIN_RESULT_FONT_SIZE && readout.height > RESULT_READOUT_MAX_HEIGHT; fontSize -= 1) {
            readout.setFontSize(fontSize - 1);
        }
        readout.setY(this.resultReadoutBottomY);
    }

    /** Visual-only measurement flash for a saved deterministic run; no domain calculation occurs here. */
    private animateRecordedRun(): void {
        // Kill the prior flash — including the `targets: this` boost tween — so a rapid re-run cannot run two concurrently.
        this.scene.tweens.killTweensOf(this);
        this.scene.tweens.killTweensOf([this.sourceGlow, this.sourceCore, this.resultReadout].filter(Boolean) as Phaser.GameObjects.GameObject[]);
        if (!this.motionAllowed) {
            this.sourceGlow?.setScale(1).setAlpha(0.35);
            this.sourceCore?.setScale(1);
            this.resultReadout?.setAlpha(1);
            this.measurementBoost = 0;
            this.drawPropagation(0);
            return;
        }
        this.sourceCore?.setScale(1);
        this.sourceGlow?.setScale(1);
        this.scene.tweens.add({ targets: [this.sourceCore, this.sourceGlow], scale: 2.15, duration: 360, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
        // A brightness surge that decays over ~1.2s, read by the propagation painter as extra glow.
        this.measurementBoost = 1;
        this.scene.tweens.add({ targets: this, measurementBoost: 0, duration: 1200, ease: 'Cubic.easeOut' });
        this.resultReadout?.setAlpha(0);
        this.scene.tweens.add({ targets: this.resultReadout, alpha: 1, delay: 900, duration: 360, ease: 'Sine.easeOut' });
    }

    private renderApparatusGeometry(state: AppState, t: Translator, recordedSpacingMm: number | undefined): void {
        const slitSpacing = state.activeControlValues.slitSpacingMm;
        const screenDistance = state.activeControlValues.screenDistanceM;
        const slitGapPx = 28 + ((slitSpacing - 0.1) / 0.4) * 92;
        this.screenX = 480 + ((screenDistance - 1) / 3) * 220;
        this.slitTopY = CENTRE_Y - (slitGapPx / 2);
        this.slitBottomY = CENTRE_Y + (slitGapPx / 2);
        this.slitTop?.setY(this.slitTopY);
        this.slitBottom?.setY(this.slitBottomY);
        this.screen?.setX(this.screenX);
        this.screenLabel?.setPosition(this.screenX - 31, 322);
        this.currentWavelengthNm = state.selectedWavelengthNm;
        this.wavelengthColor = rgbToInt(wavelengthToRgb(state.selectedWavelengthNm));
        this.sourceGlow?.setFillStyle(this.wavelengthColor, 0.35);

        const previewSpacingPx = 10 + ((screenDistance - 1) / 3) * 14 + ((0.5 - slitSpacing) / 0.4) * 14;
        this.bandSpacingPx = recordedSpacingMm === undefined ? previewSpacingPx : Math.max(8, Math.min(31, recordedSpacingMm * 4.6));

        this.paintFringes();
        const locale = selectLocale(state);
        this.visualGuidance?.setText(recordedSpacingMm === undefined
            // Same precision and unit as the readouts above: both come from the authored control, so
            // the preview cannot drift from the value it is previewing when a step changes.
            ? t('lab.preview', {
                slitSpacing: selectFormattedControlValue(state, 'slitSpacingMm'),
                screenDistance: selectFormattedControlValue(state, 'screenDistanceM')
            })
            : t('lab.pattern.recorded', { spacing: formatRecordedValue(locale, recordedSpacingMm, 'mm') }));
    }

    /**
     * Paints the interference pattern as a smooth vertical stack of intensity-shaded rows on the
     * screen, sampling the pure {@link interferenceIntensity} model. Redrawn only when the geometry,
     * spacing, or wavelength changes — never per animation frame.
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

    private onUpdate(delta: number): void {
        this.animPhaseMs = (this.animPhaseMs + delta) % WAVEFRONT_PERIOD_MS;
        this.drawPropagation(this.animPhaseMs / WAVEFRONT_PERIOD_MS);
    }

    /**
     * Draws the travelling light: converging incident rays from the source to the slits, and
     * expanding Huygens wavefronts from each slit whose additive overlap between the slits and the
     * screen renders the interference visually. `basePhase01` in [0,1) advances the wavefronts;
     * calling with a fixed value produces a static representative frame (reduced motion).
     */
    private drawPropagation(basePhase01: number): void {
        const beam = this.beamGraphics;
        const rings = this.wavefrontGraphics;
        if (!beam || !rings) return;
        const color = this.wavelengthColor;
        const boost = 1 + this.measurementBoost * 1.4;

        // Incident light: a soft beam wedge plus two crisp converging rays onto the slits.
        beam.clear();
        beam.fillStyle(color, 0.10 * boost);
        beam.fillTriangle(SOURCE_X, CENTRE_Y, BARRIER_X, this.slitTopY, BARRIER_X, this.slitBottomY);
        beam.lineStyle(2, 0xfff4d0, Math.min(1, 0.5 * boost));
        beam.lineBetween(SOURCE_X, CENTRE_Y, BARRIER_X, this.slitTopY);
        beam.lineBetween(SOURCE_X, CENTRE_Y, BARRIER_X, this.slitBottomY);

        // Huygens wavefronts from each slit toward the screen; additive overlap = interference.
        rings.clear();
        const maxRadius = Math.max(60, this.screenX - BARRIER_X + 24);
        const arcHalfAngleRad = (72 * Math.PI) / 180;
        // Iterate the two slit Y positions without allocating an array each frame.
        for (let s = 0; s < 2; s += 1) {
            const slitY = s === 0 ? this.slitTopY : this.slitBottomY;
            for (let i = 0; i < WAVEFRONT_RINGS; i += 1) {
                const p = (basePhase01 + i / WAVEFRONT_RINGS) % 1;
                const radius = p * maxRadius;
                if (radius < 4) continue;
                // Fade in at birth, fade out as the wavefront expands; boosted during a measurement (clamped ≤1).
                const alpha = Math.min(1, Math.min(1, p * 6) * (1 - p) * 0.55 * boost);
                if (alpha <= 0.01) continue;
                rings.lineStyle(2, color, alpha);
                rings.beginPath();
                rings.arc(BARRIER_X, slitY, radius, -arcHalfAngleRad, arcHalfAngleRad, false);
                rings.strokePath();
            }
        }
    }

    private createControl(controlId: PrimaryControl['id'], y: number): void {
        // A French control label runs 15–25% longer than its English counterpart; the readout wraps
        // rather than running under the step buttons at x = 390.
        const readout = this.scene.add.text(40, y, '', uiTextStyle({ color: '#f7f4ef', fontSize: '18px', wordWrap: { width: 330 } }));
        const decrease = this.createButton(390, y - 7, controlId, -1);
        const increase = this.createButton(510, y - 7, controlId, 1);
        this.decreaseButtons.push(decrease);
        this.increaseButtons.push(increase);
        this.readouts.set(controlId, readout);
        this.objects.push(readout, decrease, increase);
    }

    private createButton(x: number, y: number, controlId: PrimaryControl['id'], direction: -1 | 1): Phaser.GameObjects.Text {
        const button = this.scene.add.text(x, y, '', uiTextStyle({ backgroundColor: '#f4d35e', color: '#10252c', fontSize: '27px', padding: { x: 20, y: 8 } }));
        button.on('pointerup', () => {
            const state = this.storeAdapter.getState();
            const control = selectPrimaryControl(state, controlId);
            this.storeAdapter.setControlValue(control.id, state.activeControlValues[control.id] + (direction * control.step));
        });
        this.controls.push(button);
        return button;
    }

    private readonly updatePhoneReadOnlyMode = (): void => {
        const enabled = this.inputEnabled && !window.matchMedia('(max-width: 767px)').matches;
        this.controls.forEach((control) => enabled ? control.setInteractive({ useHandCursor: true }) : control.disableInteractive());
    };
}
