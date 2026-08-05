import type { Scene } from 'phaser';

import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import type { AppState } from '../../../core/store/AppState';
import { selectFormattedControlValue, selectPrimaryControl } from '../../../core/store/selectors';
import type { PrimaryControl } from '../../../domain/cases/CaseDefinition';

export class ApparatusRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private readonly controls: Phaser.GameObjects.Text[] = [];
    private readonly readouts = new Map<PrimaryControl['id'], Phaser.GameObjects.Text>();
    private readonly fringeDots: Phaser.GameObjects.Arc[] = [];
    private resultReadout?: Phaser.GameObjects.Text;
    private visualGuidance?: Phaser.GameObjects.Text;
    private source?: Phaser.GameObjects.Arc;
    private waveA?: Phaser.GameObjects.Arc;
    private waveB?: Phaser.GameObjects.Arc;
    private waveC?: Phaser.GameObjects.Arc;
    private slitTop?: Phaser.GameObjects.Rectangle;
    private slitBottom?: Phaser.GameObjects.Rectangle;
    private screen?: Phaser.GameObjects.Rectangle;
    private screenLabel?: Phaser.GameObjects.Text;
    private readonly textResolution = Math.min(window.devicePixelRatio || 1, 2);
    private lastRunId?: string;

    public constructor(private readonly scene: Scene, private readonly storeAdapter: PhaserStoreAdapter) {}

    public create(): void {
        const title = this.scene.add.text(40, 28, 'Young interference — visual laboratory surface', { color: '#f7f4ef', fontFamily: 'system-ui', fontSize: '24px', resolution: this.textResolution });
        const guide = this.scene.add.text(40, 62, 'Use the semantic laboratory controls or these matching visual step controls.', { color: '#c7d7d9', fontFamily: 'system-ui', fontSize: '15px', resolution: this.textResolution });
        this.objects.push(title, guide);
        this.createRichPattern();
        const controlsTop = Math.max(440, this.scene.scale.height - 190);
        this.storeAdapter.getState().caseDefinition.apparatus.primaryControls.forEach((control, index) => this.createControl(control.id, controlsTop + (index * 74)));
        this.resultReadout = this.scene.add.text(40, controlsTop - 58, 'No fringe spacing recorded yet.', { color: '#f7f4ef', fontFamily: 'system-ui', fontSize: '19px', resolution: this.textResolution, wordWrap: { width: 620 } });
        this.objects.push(this.resultReadout);
        this.updatePhoneReadOnlyMode();
        window.addEventListener('resize', this.updatePhoneReadOnlyMode);
    }

    public render(state: AppState): void {
        state.caseDefinition.apparatus.primaryControls.forEach((control) => {
            this.readouts.get(control.id)?.setText(`${control.label}: ${selectFormattedControlValue(state, control.id)}`);
        });
        const latest = state.runs[state.runs.length - 1];
        const latestMatchesActiveSetup = latest?.modelInputs
            && latest.modelInputs.slitSpacingMm === state.activeControlValues.slitSpacingMm
            && latest.modelInputs.screenDistanceM === state.activeControlValues.screenDistanceM
            && latest.modelInputs.wavelengthNm === state.selectedWavelengthNm
            && latest.modelInputs.wavelengthMode === state.selectedWavelengthMode;
        this.resultReadout?.setText(latest?.modelInputs
            ? latestMatchesActiveSetup
                ? `Recorded pattern: ${latest.result.value} ${latest.result.unit} at ${latest.modelInputs.wavelengthNm} nm (${latest.modelInputs.wavelengthMode} path).`
                : `Last recorded result: ${latest.result.value} ${latest.result.unit}. The changed setup is an unrecorded preview.`
            : 'No fringe spacing recorded yet. Enter the experiment phase and use Run experiment in the semantic controls.');
        this.renderApparatusGeometry(state, latestMatchesActiveSetup ? latest?.result.value : undefined);
        if (latest && latest.id !== this.lastRunId) this.animateRecordedRun();
        this.lastRunId = latest?.id;
    }

    public destroy(): void {
        window.removeEventListener('resize', this.updatePhoneReadOnlyMode);
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0; this.controls.length = 0; this.fringeDots.length = 0; this.readouts.clear();
        this.resultReadout = undefined; this.visualGuidance = undefined; this.slitTop = undefined; this.slitBottom = undefined; this.screen = undefined; this.screenLabel = undefined;
        this.source = undefined; this.waveA = undefined; this.waveB = undefined; this.waveC = undefined; this.lastRunId = undefined;
    }

    private createRichPattern(): void {
        this.source = this.scene.add.circle(92, 200, 16, 0xf4d35e);
        const sourceLabel = this.scene.add.text(55, 232, 'source', { color: '#f7f4ef', fontFamily: 'system-ui', fontSize: '14px', resolution: this.textResolution });
        const barrier = this.scene.add.rectangle(260, 200, 16, 186, 0x8db7c2);
        this.slitTop = this.scene.add.rectangle(260, 170, 22, 13, 0x10252c);
        this.slitBottom = this.scene.add.rectangle(260, 230, 22, 13, 0x10252c);
        this.screen = this.scene.add.rectangle(605, 200, 12, 210, 0xe7edf0);
        this.screenLabel = this.scene.add.text(575, 322, 'screen', { color: '#f7f4ef', fontFamily: 'system-ui', fontSize: '14px', resolution: this.textResolution });
        this.waveA = this.scene.add.arc(177, 200, 78, -58, 58, false, 0x5cc8ff, 0.45).setStrokeStyle(2, 0x5cc8ff, 0.75);
        this.waveB = this.scene.add.arc(330, 170, 140, -32, 45, false, 0xd083ff, 0.35).setStrokeStyle(2, 0xd083ff, 0.65);
        this.waveC = this.scene.add.arc(330, 230, 140, -45, 32, false, 0xd083ff, 0.35).setStrokeStyle(2, 0xd083ff, 0.65);
        for (let index = -6; index <= 6; index += 1) this.fringeDots.push(this.scene.add.circle(605, 200, 4, 0xf4d35e));
        this.visualGuidance = this.scene.add.text(40, 348, 'Preview changes with the controls. Record a run to lock the exact model spacing into the pattern.', { color: '#c7d7d9', fontFamily: 'system-ui', fontSize: '13px', resolution: this.textResolution, wordWrap: { width: 620 } });
        this.objects.push(this.source, sourceLabel, barrier, this.slitTop, this.slitBottom, this.screen, this.screenLabel, this.waveA, this.waveB, this.waveC, this.visualGuidance, ...this.fringeDots);
    }

    /** Visual-only feedback for a saved deterministic run; no domain calculation occurs here. */
    private animateRecordedRun(): void {
        const waves = [this.waveA, this.waveB, this.waveC].filter((wave): wave is Phaser.GameObjects.Arc => Boolean(wave));
        this.scene.tweens.killTweensOf([this.source, ...waves, ...this.fringeDots, this.resultReadout]);
        const visibleBands = this.fringeDots.filter((dot) => dot.visible);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.source?.setScale(1).setAlpha(1);
            waves.forEach((wave) => wave.setScale(1).setAlpha(1));
            visibleBands.forEach((band, index) => band.setScale(1).setAlpha(index % 2 === 0 ? 1 : 0.82));
            this.resultReadout?.setAlpha(1);
            return;
        }
        this.source?.setScale(1).setAlpha(1);
        this.scene.tweens.add({ targets: this.source, scale: 2.15, duration: 360, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
        waves.forEach((wave, index) => {
            wave.setScale(0.18).setAlpha(0);
            this.scene.tweens.add({ targets: wave, scale: 1.18, alpha: 1, delay: 140 + (index * 220), duration: 680, ease: 'Sine.easeOut' });
        });
        visibleBands.forEach((band, index) => {
            const bright = index % 2 === 0;
            band.setAlpha(0).setScale(bright ? 0.35 : 0.55);
            this.scene.tweens.add({
                targets: band,
                alpha: bright ? 1 : 0.82,
                scale: 1,
                delay: 940 + (Math.abs(index - Math.floor(visibleBands.length / 2)) * 100),
                duration: 420,
                ease: 'Sine.easeOut'
            });
        });
        this.resultReadout?.setAlpha(0);
        this.scene.tweens.add({ targets: this.resultReadout, alpha: 1, delay: 1260, duration: 360, ease: 'Sine.easeOut' });
    }

    private renderApparatusGeometry(state: AppState, recordedSpacingMm: number | undefined): void {
        const slitSpacing = state.activeControlValues.slitSpacingMm;
        const screenDistance = state.activeControlValues.screenDistanceM;
        const slitGapPx = 28 + ((slitSpacing - 0.1) / 0.4) * 92;
        const screenX = 480 + ((screenDistance - 1) / 3) * 220;
        this.slitTop?.setY(200 - (slitGapPx / 2));
        this.slitBottom?.setY(200 + (slitGapPx / 2));
        this.screen?.setX(screenX);
        this.screenLabel?.setPosition(screenX - 31, 322);
        const previewSpacingPx = 10 + ((screenDistance - 1) / 3) * 14 + ((0.5 - slitSpacing) / 0.4) * 14;
        const bandSpacingPx = recordedSpacingMm === undefined ? previewSpacingPx : Math.max(8, Math.min(31, recordedSpacingMm * 4.6));
        this.fringeDots.forEach((dot, index) => {
            const order = index - 6;
            const bright = order % 2 === 0;
            dot.setPosition(screenX, 200 + (order * bandSpacingPx));
            dot.setRadius(bright ? 7 : 3);
            dot.setFillStyle(bright ? 0xf4d35e : 0x6e8a93, bright ? 1 : 0.82);
            dot.setVisible(dot.y > 98 && dot.y < 302);
        });
        this.visualGuidance?.setText(recordedSpacingMm === undefined
            ? `Visual preview: ${slitSpacing.toFixed(2)} mm slit spacing and ${screenDistance.toFixed(2)} m screen distance. Run experiment for an exact recorded fringe spacing.`
            : `Recorded interference pattern: bright bands are ${recordedSpacingMm} mm apart in the saved Young model result.`);
    }

    private createControl(controlId: PrimaryControl['id'], y: number): void {
        const readout = this.scene.add.text(40, y, '', { color: '#f7f4ef', fontFamily: 'system-ui', fontSize: '18px', resolution: this.textResolution });
        const decrease = this.createButton(390, y - 7, '−', controlId, -1);
        const increase = this.createButton(510, y - 7, '+', controlId, 1);
        this.readouts.set(controlId, readout);
        this.objects.push(readout, decrease, increase);
    }

    private createButton(x: number, y: number, label: string, controlId: PrimaryControl['id'], direction: -1 | 1): Phaser.GameObjects.Text {
        const button = this.scene.add.text(x, y, label, { backgroundColor: '#f4d35e', color: '#10252c', fontFamily: 'system-ui', fontSize: '27px', resolution: this.textResolution, padding: { x: 20, y: 8 } });
        button.on('pointerup', () => {
            const state = this.storeAdapter.getState();
            const control = selectPrimaryControl(state, controlId);
            this.storeAdapter.setControlValue(control.id, state.activeControlValues[control.id] + (direction * control.step));
        });
        this.controls.push(button);
        return button;
    }

    private readonly updatePhoneReadOnlyMode = (): void => {
        const enabled = !window.matchMedia('(max-width: 767px)').matches;
        this.controls.forEach((control) => enabled ? control.setInteractive({ useHandCursor: true }) : control.disableInteractive());
    };
}
