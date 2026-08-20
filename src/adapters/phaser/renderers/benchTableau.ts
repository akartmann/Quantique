import type { Scene } from 'phaser';

import type { Translator } from '../../../core/i18n/translate';
import { EXPERIMENT_MODEL_IDS, isExperimentModelId, type ExperimentModelId } from '../../../domain/apparatus/experimentModels';
import type { PrimaryControl } from '../../../domain/cases/CaseDefinition';
import { InterferometerTableau } from './InterferometerTableau';
import { YoungOpticalTableau } from './YoungOpticalTableau';

/**
 * Which apparatus the laboratory draws, resolved from the case's own `experiment.modelId` (Story 4.2, AC1).
 *
 * ## What this replaces, and why the shape matters
 *
 * `ApparatusRenderer.renderApparatusGeometry` used to decide which case it was drawing like this:
 *
 * ```ts
 * const slitSpacing = state.activeControlValues.slitSpacingMm;
 * const screenDistance = state.activeControlValues.screenDistanceM;
 * const hasOpticalGeometry = Number.isFinite(slitSpacing) && Number.isFinite(screenDistance);
 * ```
 *
 * Two of Young's control ids written into a renderer, read off a case that does not author them, and
 * turned into a boolean standing in for *"is this Young?"*. The project has paid for that shape three
 * times, and every time it was a **graceful degradation** — nothing threw, nothing failed, the surface
 * simply lied: `lab.idle` printed a rotation angle as a slit spacing under 1293 green tests; this very
 * method returned at this very guard *before* its own `paintFringes()` call while `paintLight` had
 * already decided the bench was lit, so the prototype ignited for a full 2.4 s onto an empty screen; and
 * `conclusionReadiness` shipped two Young-shaped rules permanently unsatisfiable for a case recording no
 * `modelInputs`.
 *
 * So the artwork is selected the way the physics already is: **keyed on `experiment.modelId`, through a
 * closed, exhaustive record.**
 *
 * - **Not on the case id.** That would put a per-case branch in a renderer, which is the layer Story 3.1
 *   deliberately kept one out of. Case-specific *rules* branch on `id`; a case's *physics* and now its
 *   *artwork* are keyed lookups, and mixing the two mechanisms up is the trap `project-context.md` names.
 * - **Not on `modelVersion`.** That is the per-run provenance stamp. Bumping it must no more change what
 *   is drawn than it changes which physics runs.
 * - **Not by sniffing a control value.** That is the defect above, and it is what this module deletes.
 *
 * ## Exhaustive, so a third model cannot ship a blank tableau
 *
 * {@link BENCH_TABLEAU} is a `Record<ExperimentModelId, …>`, so adding a fourth member to
 * `EXPERIMENT_MODEL_IDS` without adding artwork for it is a **`tsc` error**. That is the whole point of
 * the shape: the alternative is a tableau nothing paints, and a blank tableau is invisible to every test
 * this project can write — the bench's own tests assert text, and the e2e header says in as many words
 * that it asserts no rendered string.
 *
 * ## A lookup, not a registry
 *
 * Two entries, and `experimentModels.ts`'s own docstring already made this ruling for the physics: at two
 * models the list *is* the mechanism, and a plugin layer, a model factory or a per-case module loader
 * here would be the all-purpose framework epic AC1 forbids. When a third and fourth model arrive, this
 * stays a list. The same ruling applies to the artwork, for the same reason.
 *
 * ## Why the lit/dark decision is *not* in here
 *
 * `project-context.md`: *"A renderer's case-shape guard and its 'is this running?' decision must be the
 * same decision."* The strongest form of that rule is for the case-shape guard not to be on the lit/dark
 * path at all — so the case shape is resolved **once, in `create()`**, and every tableau is then handed
 * the *same* {@link BenchLightPhase}, computed in the one place that owns the run. A tableau cannot
 * decide that it is dark while the renderer thinks it is lit, because a tableau does not decide.
 */

/**
 * What the light is doing, computed once by the renderer and handed to whichever tableau is drawn.
 *
 * Every field is derived from the run the renderer owns, so the reduced-motion path and the animated
 * path end on the same picture rather than on two that agree by coincidence — which is the property the
 * old `paintLight` had and which must survive being split in two.
 */
export type BenchLightPhase = Readonly<{
    /**
     * Nothing recorded that still describes this bench, and no run in flight: the apparatus is unlit.
     *
     * ADR-012's *"the apparatus is unlit until the player starts it"*, as one boolean, so no tableau
     * re-derives it and no two tableaux can disagree about it.
     */
    dark: boolean;
    /** 0→1 across the ignition act while a run is in flight; 1 once the run has resolved. */
    ignition: number;
    /** Whether the light is crossing the bench right now, which is what licenses a travelling animation. */
    running: boolean;
    /** 0→1 across the resolve act: how much of the recorded pattern has arrived on the screen. */
    revealed: number;
    /**
     * 0→1, cyclic, for whatever the apparatus sends across itself. Meaningless while not `running`.
     *
     * **Cyclic, and one consumer reads it as progress.** Young's wavefronts want a sawtooth — they repeat
     * for as long as the run lasts — while the interferometer's recombined path uses it as *how far the
     * light has reached*, which is only the same thing while the sawtooth has not yet wrapped. It has not:
     * the producer's period is `LIGHT_TRAVEL_PERIOD_MS` (2600 ms) and a whole run is `RUN_ANIMATION_MS`
     * (2400 ms), a 200 ms margin that nothing recorded and no test read until the 4.2 code review. Shorten
     * the period or lengthen the run past it and the recombined beam visibly snaps back from the screen to
     * the stone mid-run while the fringe field is still arriving. `ApparatusRun.test.ts` now asserts the
     * inequality, so the two constants fail together instead of drifting apart quietly.
     */
    travelPhase01: number;
}>;

/** What a tableau needs from the store, narrowed so no tableau can reach the defensible set or the phase. */
export type BenchTableauView = Readonly<{
    /**
     * The case's authored controls and the bench's current values.
     *
     * The controls come as the authored array rather than as two named numbers, because *"never write a
     * control id into a renderer"* is the rule the deleted guard broke — a tableau reads the control it
     * draws **by the authored id its own model declares in `requiredControlIds`**, which the schema has
     * already checked against this very array at load.
     */
    controls: readonly PrimaryControl[];
    controlValues: Readonly<Record<string, number>>;
    /** The recorded reading the resolved pattern is painted from, or `undefined` when the bench is dark. */
    recordedResultValue: number | undefined;
    /** The selected wavelength, for a model whose light has a colour to choose. The interferometer's has not. */
    wavelengthNm: number;
    /** Resolved in the reader's language by the caller, so no tableau authors copy in `create()`. */
    t: Translator;
}>;

/**
 * One apparatus, drawn. The renderer contract, scoped to a tableau.
 *
 * `create()` / `render(view)` / `paintLight(light)` / `destroy()`, and the tableau owns every display
 * object, tween, timer and listener it creates — `destroy()` releases all of them, because
 * `ApparatusRenderer.destroy()` no longer knows what they are.
 *
 * The split between `render` and `paintLight` is the one the old renderer already had and is worth
 * keeping: `render` runs on a store change and may measure text; `paintLight` runs **per frame** while a
 * run is in flight and must allocate nothing and measure nothing (§Performance).
 */
export type BenchTableau = Readonly<{
    create: () => void;
    render: (view: BenchTableauView) => void;
    paintLight: (light: BenchLightPhase) => void;
    destroy: () => void;
}>;

const BENCH_TABLEAU: Readonly<Record<ExperimentModelId, (scene: Scene) => BenchTableau>> = Object.freeze({
    'young-double-slit': (scene) => new YoungOpticalTableau(scene),
    'morley-miller-interferometer': (scene) => new InterferometerTableau(scene)
});

/** Every model id that has artwork, exported so a test can assert the record against the domain's list. */
export const TABLEAU_MODEL_IDS = Object.freeze(Object.keys(BENCH_TABLEAU)) as readonly string[];

/**
 * The tableau a case's model declares, or `undefined` for an id this build does not implement.
 *
 * Fallible in its type rather than throwing, and in practice **total for loaded content**: the schema
 * refuses an unknown `experiment.modelId` at load with the offending path named, so the `undefined`
 * branch is unreachable from a validated definition and exists only so that fact is stated rather than
 * assumed. That is `resolveExperimentModel`'s own shape and its own reasoning, one layer up.
 *
 * **It never falls back to Young.** A fallback is what AC1's last clause forbids and it is the whole
 * defect class this module exists to close: an apparatus drawn for the wrong case is a lie the player
 * reads and no test can see. `undefined` draws nothing, which is at least honest.
 */
export const createBenchTableau = (modelId: string, scene: Scene): BenchTableau | undefined =>
    isExperimentModelId(modelId) ? BENCH_TABLEAU[modelId](scene) : undefined;

/**
 * The name every tableau gives the `Graphics` its recorded pattern is painted into.
 *
 * A name rather than a position, because a position is what broke. Three assertions read
 * `ofKind('graphics')[0]` and called it "the fringe graphics" — true while the laboratory drew one
 * apparatus, and false the moment a second tableau put its temperature bath at index 0. The bath is
 * painted whether or not a run exists, so *"the screen is blank until a run is recorded"* began
 * measuring an object that is never blank. Naming it in `src/` and asking for it by name in the test is
 * the same discipline as "never assert a magic number a test shares with source unless both read one
 * exported constant", applied to a display object instead of a coordinate.
 */
export const FRINGE_LAYER_NAME = 'fringes';

/**
 * The name a tableau gives the lamp's own body, where its lamp *moves*.
 *
 * Young's does not — its source sits at a fixed `SOURCE_X` — so only the interferometer sets it, and a
 * test asking for it on Young's bench correctly gets `undefined`. It exists because the harness discards
 * constructor geometry (a gap the 3.4 review recorded and left open), so the only way to see that the
 * lamp rides the turning stone is the `setPosition` call the painter makes — and singling that object out
 * by index would be the same fragility {@link FRINGE_LAYER_NAME} exists to end.
 */
export const LAMP_LAYER_NAME = 'lamp';

/**
 * The temperature bath's layer, named for the same reason and found by the same defect.
 *
 * The bath is the interferometer's **first** created object, so `ofKind('graphics')[0]` reached it — and
 * two assertions in `InterferometerTableau.test.ts` were written against exactly that index while this
 * file's own header explains why an index is what broke. Swapping the two `scene.add.graphics()` lines in
 * `create()` — which creation-order-as-depth actively invites — would have retargeted both rows onto the
 * stone, which also strokes circles and is never cleared, so one row would fail with a message about the
 * wrong object and the other would pass forever (4.2 code review).
 */
export const BATH_LAYER_NAME = 'temperature-bath';

/** Re-exported so a test asserts the artwork record's coverage against the domain's own closed list. */
export { EXPERIMENT_MODEL_IDS };
