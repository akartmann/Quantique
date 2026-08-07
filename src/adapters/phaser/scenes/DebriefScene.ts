import { Scene } from 'phaser';

import { createTranslator } from '../../../core/i18n/translate';
import type { AppStore } from '../../../core/store/createStore';
import { selectCasePhase, selectLocale, selectLocalizedError } from '../../../core/store/selectors';
import { registerCanvasBoundsRefresh } from '../canvasBounds';
import { createPhaserStoreAdapter, type PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { advanceTransitionForPhase, resolveAdvanceRefusal } from '../renderers/advanceView';
import { DebriefRenderer } from '../renderers/DebriefRenderer';
import { TransientMessageSlot } from '../renderers/transientMessage';
import { uiTextStyle } from '../textStyles';
import { AdvanceControl } from '../ui/AdvanceControl';
import {
    DEBRIEF_MIN_FONT_SIZE,
    DEBRIEF_REFUSAL_FONT_SIZE,
    debriefAdvanceControlBounds,
    debriefRefusalBand
} from './debriefGeometry';

/**
 * The historical debrief, and the way back round (Story 2.11).
 *
 * It was the last subclass of the routing shell, and Story 2.11 deletes that shell with it. What the
 * shell did that mattered is reproduced here verbatim: the advance control
 * (which since Story 2.7 is the replay, and is the only way out of the last phase on the canvas), the
 * transient refusal with the `AppState`-identity lifetime, and the sticky-canvas bounds refresh. What
 * it did that did not is gone: the development marker, and the un-localized text that went with it.
 *
 * `LibraryScene` is the reference lifecycle, **including the ordering the 2.8 review corrected**:
 * `this.events.once('shutdown', …)` is registered before anything it releases exists. A throw in the
 * first render would otherwise leak the scroll listener and a store subscription that keeps rendering
 * a half-built scene forever, because `SceneRouter`'s catch clears `activeSceneKey` and nothing ever
 * stops the scene or fires the handler that would have disposed them.
 *
 * The scene **mirrors** the phase and never defines, infers, or advances it (ADR-009). It reads the
 * live phase to resolve which typed action its control asks for, and the router reacts to the result.
 */
export class DebriefScene extends Scene {
    private unsubscribe?: () => void;
    private disposeCanvasBounds?: () => void;
    private debriefRenderer?: DebriefRenderer;
    private advanceControl?: AdvanceControl;
    private refusalMessage?: Phaser.GameObjects.Text;
    private storeAdapter?: PhaserStoreAdapter;
    /** A refused replay stays legible until a real state change replaces it. */
    private readonly transientError = new TransientMessageSlot<string>();

    public constructor(private readonly store: AppStore) {
        super('Debrief');
    }

    public create(): void {
        // Registered before anything it releases exists — see the class docstring.
        this.events.once('shutdown', this.shutdown, this);

        this.cameras.main.setBackgroundColor(0x10252c);
        const adapter = createPhaserStoreAdapter(this.store);
        this.storeAdapter = adapter;

        this.debriefRenderer = new DebriefRenderer(this, adapter);
        this.debriefRenderer.create();

        this.advanceControl = new AdvanceControl(this, {
            ...debriefAdvanceControlBounds(this.scale.width, this.scale.height),
            onAdvance: () => this.requestAdvance()
        });
        this.advanceControl.create();

        // Empty here, written in `render`: it is player-facing and the locale can change at any time.
        const refusal = debriefRefusalBand(this.scale.width, this.scale.height);
        this.refusalMessage = this.add.text(refusal.x, refusal.y, '', uiTextStyle({
            color: '#f4d35e',
            fontSize: `${DEBRIEF_REFUSAL_FONT_SIZE}px`,
            wordWrap: { width: refusal.width }
        }));

        this.render();
        this.disposeCanvasBounds = registerCanvasBoundsRefresh(this);
        this.unsubscribe = this.store.subscribe(() => this.render());
    }

    private render(): void {
        const state = this.store.getState();
        this.debriefRenderer?.render(state);
        this.advanceControl?.render({
            // Resolved from the **live** phase on every render, never captured. The label is
            // `advance.replay` ("Investigate it again"), an interface string measured by the French
            // whole-string sweep — deliberately **not** the authored `debrief.replayLabel`, which is
            // prose and is where the counterfactual warning belongs (the renderer paints it).
            label: createTranslator(selectLocale(state))(advanceTransitionForPhase(selectCasePhase(state)).labelKey),
            // The store decides on the click. A control here that guessed would be holding an opinion
            // about a conclusion, which is the evaluator's business and not a surface's (ADR-006).
            isReady: true
        });
        // Reading the slot is what spends it: the message survives every repaint of the state it was
        // set against, and clears on the first render carrying a new one.
        this.refusalMessage?.setText(this.transientError.read(state) ?? '');
        // Clamped into the band it was given. It was the one player-facing text in this room outside
        // the renderer's clamp discipline, and the slot renders arbitrary `selectLocalizedError` output:
        // a French `replay-unavailable` is already two lines in a 40px band, and a third would grow down
        // into the counterfactual warning — which `debriefRefusalBand`'s own docstring says is on screen
        // at the same time on a second pass (2.11 review).
        if (this.refusalMessage) {
            const refusal = debriefRefusalBand(this.scale.width, this.scale.height);
            this.refusalMessage.setFontSize(DEBRIEF_REFUSAL_FONT_SIZE).setCrop();
            for (
                let fontSize = DEBRIEF_REFUSAL_FONT_SIZE;
                fontSize >= DEBRIEF_MIN_FONT_SIZE && this.refusalMessage.height > refusal.height;
                fontSize -= 1
            ) {
                this.refusalMessage.setFontSize(fontSize);
            }
            if (this.refusalMessage.height > refusal.height) {
                this.refusalMessage.setCrop(0, 0, this.refusalMessage.width, refusal.height);
            }
        }
    }

    /**
     * Asks for the replay.
     *
     * `colleagueAnswers: false`, and honestly so: no gate reachable from this room has an authored
     * colleague line, and this room has no hint slot to paint one in. A host that routed a gate
     * refusal to a slot it does not have would answer with nothing, which is the one thing the refusal
     * rule forbids. **One rule, not two** — the precedence lives in `resolveAdvanceRefusal` and is not
     * re-decided here.
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
        this.debriefRenderer?.destroy();
        this.debriefRenderer = undefined;
        this.refusalMessage?.destroy();
        this.refusalMessage = undefined;
        this.storeAdapter = undefined;
        this.transientError.clear();
    }
}
