import { Scene } from 'phaser';

import { createTranslator } from '../../../core/i18n/translate';
import { registerCanvasBoundsRefresh } from '../canvasBounds';
import { monoTextStyle, uiTextStyle } from '../textStyles';
import type { AppStore } from '../../../core/store/createStore';
import { selectCasePhase, selectLocale, selectLocalizedError } from '../../../core/store/selectors';
import type { SceneKey } from '../../../domain/cases/ScenarioScript';
import { createPhaserStoreAdapter, type PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { advanceTransitionForPhase, resolveAdvanceRefusal } from '../renderers/advanceView';
import { TransientMessageSlot } from '../renderers/transientMessage';
import { ADVANCE_CONTROL_HEIGHT, ADVANCE_CONTROL_WIDTH, AdvanceControl } from '../ui/AdvanceControl';
import {
    PLACEHOLDER_MESSAGE_FONT_SIZE,
    PLACEHOLDER_MESSAGE_TOP_GAP,
    PLACEHOLDER_MESSAGE_WRAP,
    placeholderAdvanceControlCentre
} from './phasePlaceholderGeometry';

/**
 * Routing shell for a scene whose content lands in a later story. **Only `DebriefScene` extends it
 * now** — Story 2.8 replaced `LibraryScene` with a real reading room, and Story 2.11 replaces the
 * debrief, after which this file is deleted. It renders a neutral development marker only; authored
 * player-facing copy waits for the scene's own story, through the i18n layer (ADR-010). Colleagues and
 * TheoryBoard left this shell in Story 1.11.
 *
 * The scene mirrors the phase and never dispatches it: it reads the phase to label itself, and to
 * resolve **which** typed action its advance control asks for.
 *
 * **It carries the advance affordance (Story 2.7).** Without it the post-debrief replay would be
 * reachable only from a retired DOM panel, and `debrief` is the last phase — a finished player would
 * have nowhere to go on the canvas at all.
 *
 * The control is the only player-facing thing here. The marker stays un-localized on purpose.
 */

export abstract class PhasePlaceholderScene extends Scene {
    private unsubscribe?: () => void;
    private disposeCanvasBounds?: () => void;
    private marker?: Phaser.GameObjects.Text;
    private advanceControl?: AdvanceControl;
    private refusalMessage?: Phaser.GameObjects.Text;
    private storeAdapter?: PhaserStoreAdapter;
    /** A refused advance stays legible until a real state change replaces it (AC5). */
    private readonly transientError = new TransientMessageSlot<string>();

    /**
     * It took an `isOverlayVisible` reader until Story 2.8, because an always-running book scene could
     * be open over it and a page-turn click would otherwise fall through and advance the phase. There
     * is no such scene now: the book belongs to the two scenes that host one, and neither is this.
     *
     * The parameter was **removed rather than defaulted**. A `() => false` fallback would have made a
     * wiring omission a compile-time success reading as "the book is never open" — which is what the
     * 2.7 review flagged, and it is the same reasoning that put the parameter here in the first place.
     */
    protected constructor(
        private readonly sceneKey: SceneKey,
        private readonly store: AppStore
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

        this.render();
        // The sticky-canvas bounds refresh the retired overlay scene used to own for the whole session
        // (Story 2.8). Every routed scene registers its own; exactly one routed scene runs at a time.
        this.disposeCanvasBounds = registerCanvasBoundsRefresh(this);

        this.unsubscribe = this.store.subscribe(() => this.render());
        this.events.once('shutdown', this.shutdown, this);
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
     *
     * Routed through {@link resolveAdvanceRefusal} rather than straight to `selectLocalizedError`, so
     * the register is consulted from every host and not only from the ones that can speak a line.
     * `colleagueAnswers` is `false` because this shell has no hint slot to paint one in — a host that
     * routed a gate refusal to a slot it does not have would answer with nothing. Story 2.8 changed
     * exactly this argument in the reading room and left the rule here untouched, which is what "one
     * rule, not two" was supposed to buy.
     */
    private requestAdvance(): void {
        const adapter = this.storeAdapter;
        if (!adapter) return;
        const { transition } = advanceTransitionForPhase(selectCasePhase(this.store.getState()));
        const result = adapter.advanceCase(transition);
        if (result.ok) return;
        const current = this.store.getState();
        const { message } = resolveAdvanceRefusal({
            code: result.error.code,
            localizedError: selectLocalizedError(current, result.error),
            colleagueAnswers: false
        });
        this.transientError.set(message ?? '', current);
        this.render();
    }

    private shutdown(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.disposeCanvasBounds?.();
        this.disposeCanvasBounds = undefined;
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
