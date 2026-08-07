import type { Scene } from 'phaser';

import { uiTextStyle } from '../textStyles';
import type { WavelengthChoice } from '../../../core/store/selectors';
import {
    WAVELENGTH_CHOICE_FONT_SIZE,
    WAVELENGTH_CHOICE_HEIGHT,
    WAVELENGTH_CHOICE_LABEL_WRAP,
    WAVELENGTH_CHOICE_PADDING,
    WAVELENGTH_COLUMN_LEFT,
    WAVELENGTH_COLUMN_WIDTH,
    WAVELENGTH_HEADING_FONT_SIZE,
    WAVELENGTH_HEADING_Y,
    wavelengthChoiceTop
} from './apparatusGeometry';

/**
 * The optional wavelength comparison, chosen in-scene (Story 2.10, AC7).
 *
 * Until now `apparatus.wavelengthSet` had no canvas dispatcher at all — one of the nine intents the
 * 2026-08-06 correction found reachable only from a retired DOM panel (ADR-011).
 *
 * ## The choices are authored, and this widget is told them
 *
 * It renders whatever {@link WavelengthChoice} list its owner passes, which comes from
 * `selectWavelengthChoices` reading `experiment.wavelengthComparison`. Nothing here writes 450, 550 or
 * 650 down: `reduceWavelengthSet` refuses an unauthored value with `unavailable-wavelength`, so a
 * hard-coded choice would be a control that offers the player a refusal.
 *
 * ## Locked is drawn, not hidden
 *
 * An advanced choice stays locked until the case's `minimumRuns` fixed-550 nm observations exist. It is
 * painted in its locked state rather than removed — a control that vanishes teaches nothing, and
 * "diegetic never means hidden" (`EXPERIENCE.md` §HUD). Clicking one still dispatches, and the reducer
 * answers `advanced-wavelength-locked`, which **already exists in both locales**; the owner shows it.
 * Nothing here decides the gate, and nothing here recalculates or re-labels a saved run.
 */

const CHOICE_FILL = 0x14313a;
const CHOICE_FILL_SELECTED = 0x276b55;
const CHOICE_FILL_LOCKED = 0x122a31;
const CHOICE_LABEL = '#f7f4ef';
const CHOICE_LABEL_LOCKED = '#8ba3aa';
const HEADING_COLOR = '#9fc6bb';

export type WavelengthChooserOptions = Readonly<{
    /** The player has chosen a wavelength. The owner dispatches and answers any refusal. */
    onChoose: (wavelengthNm: 450 | 550 | 650) => void;
}>;

export type WavelengthChooserView = Readonly<{
    heading: string;
    /** Already-localized, one per authored choice, in the order they are drawn. */
    choices: readonly Readonly<{
        wavelengthNm: 450 | 550 | 650;
        label: string;
        selected: boolean;
        locked: boolean;
    }>[];
}>;

export class WavelengthChooser {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private heading?: Phaser.GameObjects.Text;
    private readonly rows: Readonly<{
        wavelengthNm: 450 | 550 | 650;
        surface: Phaser.GameObjects.Rectangle;
        label: Phaser.GameObjects.Text;
    }>[] = [];
    private inputEnabled = true;

    /**
     * @param choices The authored choices, needed at construction because one display object per
     * choice is built in `create()` and the authored set cannot change during a case.
     */
    public constructor(
        private readonly scene: Scene,
        private readonly choices: readonly WavelengthChoice[],
        private readonly options: WavelengthChooserOptions
    ) {}

    public create(): void {
        if (this.choices.length === 0) return;
        // Authored empty and written in `render`: `create()` runs once and the locale can change.
        this.heading = this.scene.add.text(WAVELENGTH_COLUMN_LEFT, WAVELENGTH_HEADING_Y, '', uiTextStyle({
            color: HEADING_COLOR,
            fontSize: `${WAVELENGTH_HEADING_FONT_SIZE}px`,
            fontStyle: 'bold',
            wordWrap: { width: WAVELENGTH_COLUMN_WIDTH }
        }));
        this.objects.push(this.heading);

        this.choices.forEach(({ wavelengthNm }, index) => {
            const top = wavelengthChoiceTop(index);
            const surface = this.scene.add
                .rectangle(WAVELENGTH_COLUMN_LEFT, top, WAVELENGTH_COLUMN_WIDTH, WAVELENGTH_CHOICE_HEIGHT, CHOICE_FILL)
                .setOrigin(0, 0);
            const label = this.scene.add.text(
                WAVELENGTH_COLUMN_LEFT + WAVELENGTH_CHOICE_PADDING,
                top + (WAVELENGTH_CHOICE_HEIGHT / 2),
                '',
                uiTextStyle({
                    color: CHOICE_LABEL,
                    fontSize: `${WAVELENGTH_CHOICE_FONT_SIZE}px`,
                    wordWrap: { width: WAVELENGTH_CHOICE_LABEL_WRAP }
                })
            ).setOrigin(0, 0.5);
            // A locked choice is still clickable: the refusal is how the player learns what unlocks it.
            surface.on('pointerup', () => {
                if (!this.inputEnabled) return;
                this.options.onChoose(wavelengthNm);
            });
            this.rows.push({ wavelengthNm, surface, label });
            this.objects.push(surface, label);
        });
        this.applyInputState();
    }

    public render(view: WavelengthChooserView): void {
        this.heading?.setText(view.heading);
        this.rows.forEach((row) => {
            const choice = view.choices.find(({ wavelengthNm }) => wavelengthNm === row.wavelengthNm);
            if (!choice) return;
            row.label.setText(choice.label).setColor(choice.locked ? CHOICE_LABEL_LOCKED : CHOICE_LABEL);
            row.surface.setFillStyle(choice.locked
                ? CHOICE_FILL_LOCKED
                : choice.selected ? CHOICE_FILL_SELECTED : CHOICE_FILL);
        });
    }

    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.applyInputState();
    }

    public destroy(): void {
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.rows.length = 0;
        this.heading = undefined;
    }

    private applyInputState(): void {
        this.rows.forEach(({ surface }) => {
            if (this.inputEnabled) surface.setInteractive({ useHandCursor: true });
            else surface.disableInteractive();
        });
    }
}
