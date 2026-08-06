import { Scene } from 'phaser';

import { monoTextStyle } from '../textStyles';
import type { AppStore } from '../../../core/store/createStore';
import { selectCasePhase } from '../../../core/store/selectors';
import type { SceneKey } from '../../../domain/cases/ScenarioScript';

/**
 * Routing shell for a scene whose content lands in a later story (Library 2.1, Debrief 2.3). It
 * renders a neutral development marker only — authored player-facing copy waits for the scene's own
 * story, through the i18n layer (ADR-010). Colleagues and TheoryBoard left this shell in Story 1.11.
 *
 * The scene mirrors the phase and never dispatches: it reads the phase purely to label itself.
 */
export abstract class PhasePlaceholderScene extends Scene {
    private unsubscribe?: () => void;
    private marker?: Phaser.GameObjects.Text;

    protected constructor(private readonly sceneKey: SceneKey, private readonly store: AppStore) {
        super(sceneKey);
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x10252c);
        // Un-localized on purpose: this is a development marker, not player copy. Each replacement
        // scene authors its own EN+FR text through the i18n layer (Story 1.1b / ADR-010).
        this.marker = this.add.text(512, 384, '', monoTextStyle({
            fontSize: '20px',
            color: '#8fb3bd',
            align: 'center'
        })).setOrigin(0.5);
        this.renderMarker();

        this.unsubscribe = this.store.subscribe(() => this.renderMarker());
        this.events.once('shutdown', this.shutdown, this);
    }

    private renderMarker(): void {
        // A single scene can host more than one phase, so the marker reads the live phase.
        this.marker?.setText(`${this.sceneKey} (placeholder)\n${selectCasePhase(this.store.getState())}`);
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.marker?.destroy();
        this.marker = undefined;
    }
}
