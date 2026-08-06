import { Scene } from 'phaser';

import { createTranslator } from '../../../core/i18n/translate';
import { monoTextStyle, uiTextStyle } from '../textStyles';
import type { AppStore } from '../../../core/store/createStore';
import { selectCasePhase, selectLocale, selectLocalizedError } from '../../../core/store/selectors';
import type { SceneKey } from '../../../domain/cases/ScenarioScript';
import { createPhaserStoreAdapter, type PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { advanceTransitionForPhase } from '../renderers/advanceView';
import { TransientMessageSlot } from '../renderers/transientMessage';
import { ADVANCE_CONTROL_HEIGHT, ADVANCE_CONTROL_WIDTH, AdvanceControl } from '../ui/AdvanceControl';
import {
    PLACEHOLDER_MESSAGE_FONT_SIZE,
    PLACEHOLDER_MESSAGE_TOP_GAP,
    PLACEHOLDER_MESSAGE_WRAP,
    placeholderAdvanceControlCentre
} from './phasePlaceholderGeometry';

/**
 * Routing shell for a scene whose content lands in a later story (Library 2.8, Debrief 2.11). It
 * renders a neutral development marker only — authored player-facing copy waits for the scene's own
 * story, through the i18n layer (ADR-010). Colleagues and TheoryBoard left this shell in Story 1.11.
 *
 * The scene mirrors the phase and never dispatches it: it reads the phase to label itself, and to
 * resolve **which** typed action its advance control asks for.
 *
 * **It carries the advance affordance (Story 2.7).** The shell is mounted for `context` and `debrief`,
 * and until 2.8 and 2.11 replace it those two phases would otherwise have no way on from the canvas
 * at all — `context → prediction` and the post-debrief replay were both reachable only from a retired
 * DOM panel. Mounting it in the base class rather than in each subclass is the smaller diff and the
 * one that disappears cleanly: the base class is deleted once both replacements land, and the widget
 * survives into the real scenes.
 *
 * The control is the only player-facing thing here. The marker stays un-localized on purpose.
 */

export abstract class PhasePlaceholderScene extends Scene {
    private unsubscribe?: () => void;
    private marker?: Phaser.GameObjects.Text;
    private advanceControl?: AdvanceControl;
    private refusalMessage?: Phaser.GameObjects.Text;
    private storeAdapter?: PhaserStoreAdapter;
    /** A refused advance stays legible until a real state change replaces it (AC5). */
    private readonly transientError = new TransientMessageSlot<string>();

    /**
     * @param isOverlayVisible Reads the reference book's live visibility, for the same reason
     * {@link LaboratoryScene} does. The book is reachable in **every** phase — `context` included —
     * and the router rebuilds this scene while the book may already be open, so an edge-triggered
     * suppression callback is not enough on its own: a page-turn click would fall through the book
     * and advance the phase.
     */
    protected constructor(
        private readonly sceneKey: SceneKey,
        private readonly store: AppStore,
        private readonly isOverlayVisible: () => boolean = () => false
    ) {
        super(sceneKey);
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(0x10252c);
        this.storeAdapter = createPhaserStoreAdapter(this.store);
        // Un-localized on purpose: this is a development marker, not player copy. Each replacement
        // scene authors its own EN+FR text through the i18n layer (Story 1.1b / ADR-010).
        this.marker = this.add.text(this.scale.width / 2, this.scale.height / 2, '', monoTextStyle({
            fontSize: '20px',
            color: '#8fb3bd',
            align: 'center'
        })).setOrigin(0.5);

        const { x, y } = placeholderAdvanceControlCentre(this.scale.width, this.scale.height);
        this.advanceControl = new AdvanceControl(this, {
            x: x - (ADVANCE_CONTROL_WIDTH / 2),
            y: y - (ADVANCE_CONTROL_HEIGHT / 2),
            onAdvance: () => this.requestAdvance()
        });
        this.advanceControl.create();
        // Empty here, written in `render`: it is player-facing and the locale can change at any time.
        this.refusalMessage = this.add.text(this.scale.width / 2, y + (ADVANCE_CONTROL_HEIGHT / 2) + PLACEHOLDER_MESSAGE_TOP_GAP, '', uiTextStyle({
            color: '#f4d35e', fontSize: `${PLACEHOLDER_MESSAGE_FONT_SIZE}px`, align: 'center', wordWrap: { width: PLACEHOLDER_MESSAGE_WRAP }
        })).setOrigin(0.5, 0);

        this.advanceControl.setInputEnabled(!this.isOverlayVisible());
        this.render();

        this.unsubscribe = this.store.subscribe(() => this.render());
        this.events.once('shutdown', this.shutdown, this);
    }

    /** Lets the overlaying reference book suppress the advance control while it is open. */
    public setInputEnabled(enabled: boolean): void {
        this.advanceControl?.setInputEnabled(enabled);
    }

    private render(): void {
        const state = this.store.getState();
        const phase = selectCasePhase(state);
        // A single scene can host more than one phase, so the marker reads the live phase.
        this.marker?.setText(`${this.sceneKey} (placeholder)\n${phase}`);
        this.advanceControl?.render({
            label: createTranslator(selectLocale(state))(advanceTransitionForPhase(phase).labelKey),
            // The shell knows of no gate it could read honestly; the store answers on the click.
            isReady: true
        });
        this.refusalMessage?.setText(this.transientError.read(state) ?? '');
    }

    /**
     * Asks to make the move that leaves the live phase.
     *
     * Never silent, and never a raw error string: `selectLocalizedError` is the single presentation
     * boundary for a `Result` failure and supplies its own interpolation parameters, so the
     * `missing-contextual-sources` refusal a player meets in the library arrives with its `{label}`
     * already filled. Story 2.8 replaces this shell and authors the in-fiction colleague line for
     * that gate; until then the localized error is what keeps the refusal answerable.
     */
    private requestAdvance(): void {
        const adapter = this.storeAdapter;
        if (!adapter) return;
        const { transition } = advanceTransitionForPhase(selectCasePhase(this.store.getState()));
        const result = adapter.advanceCase(transition);
        if (result.ok) return;
        const current = this.store.getState();
        this.transientError.set(selectLocalizedError(current, result.error), current);
        this.render();
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.advanceControl?.destroy();
        this.advanceControl = undefined;
        this.refusalMessage?.destroy();
        this.refusalMessage = undefined;
        this.marker?.destroy();
        this.marker = undefined;
        this.storeAdapter = undefined;
        this.transientError.clear();
    }
}
