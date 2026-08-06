/**
 * What the in-scene advance affordance shows, and which move it makes, decided without drawing
 * anything (Story 2.7).
 *
 * **This is a separate module so it can be tested.** `ApparatusRenderer` imports Phaser as a *value*
 * (`BlendModes`, for the additive beam blending), Phaser touches `window` at import time, and Vitest
 * runs in Node — so nothing inside that file can be reached by a unit test at all. The Story 2.6
 * review found the whole of its Task 7 uncovered for exactly that reason: the `advanceRefused`
 * lifecycle, the precedence between a gate refusal and a store-busy error, and the hint's
 * self-withdrawal were verified only by a temporary Playwright spec that was then deleted.
 *
 * It supersedes `sideColumnView.ts`, which held the same rule for the laboratory alone. Story 2.7
 * puts one of these controls in every phase's scene, so the rule is now shared — **one rule, not
 * two**, which is the whole reason the older module was folded in here rather than left beside this
 * one to drift.
 *
 * The rule has three moving parts that interact, which is precisely the shape that earns a test:
 *
 * 1. **A hint is drawn only after an attempt was actually refused.** A colleague who volunteers
 *    "vary the screen distance" before the player has tried anything is supplying the next step
 *    rather than answering a question, and the project rule is that hints never supply the answer.
 * 2. **The hint withdraws itself.** The selector stops returning one the moment the evidence clears
 *    the bar, and the refusal goes with it — the player answered it, so it stops being true.
 * 3. **A store-busy refusal is not a gate refusal.** `createStore` short-circuits every dispatch
 *    during an exclusive progress operation, so a click during an export legitimately fails with
 *    nothing to do with the evidence. It takes the same slot and outranks the hint, because it is the
 *    more surprising of the two and the one the player cannot act on.
 */

import type { TranslationKey } from '../../../core/i18n/locales/en';
import type { CasePhase } from '../../../domain/cases/CaseProgress';
import type { AdvanceTransitionId } from '../PhaserStoreAdapter';

export type AdvanceTransition = Readonly<{
    transition: AdvanceTransitionId;
    /** The interface key for the control's label. Names the destination **in the fiction**. */
    labelKey: TranslationKey;
}>;

/**
 * The move that leaves each phase, and what the control calls it.
 *
 * **Total over `CasePhase`, deliberately.** `debrief` maps to the replay rather than to nothing, so
 * there is no phase whose scene has no way on — "a transition reachable only from outside the canvas
 * does not exist", and a phase with no transition at all is the same dead end by another route. A
 * `Record` rather than a lookup function so the compiler rejects a new phase that forgets one.
 *
 * The labels name a place, a person, or an act **in the fiction** and never a scene key, a phase, or
 * a route (the `encodesPath` rule, which interface copy holds to as well as authored case prose).
 * `advance.toTheoryBoard` is Story 2.6's `lab.advance` verbatim, and it is the calibration point:
 * "the theory board" is a thing in the room, `TheoryBoard` is a scene key.
 */
export const ADVANCE_TRANSITION_BY_PHASE: Readonly<Record<CasePhase, AdvanceTransition>> = Object.freeze({
    context: { transition: 'context-to-prediction', labelKey: 'advance.toColleagues' },
    prediction: { transition: 'prediction-to-experiment', labelKey: 'advance.toBench' },
    experiment: { transition: 'experiment-to-synthesis', labelKey: 'advance.toTheoryBoard' },
    synthesis: { transition: 'synthesis-to-review', labelKey: 'advance.toReviewers' },
    review: { transition: 'review-to-debrief', labelKey: 'advance.closeTheCase' },
    debrief: { transition: 'debrief-replay', labelKey: 'advance.replay' }
} as const);

/**
 * The move that leaves the **live** phase.
 *
 * Read on every render and never captured: one scene can host more than one phase — `TheoryBoard`
 * hosts `synthesis` and `review`, and those two dispatch different actions — so a renderer holding a
 * transition from its `create()` would send a reviewing player back through the readiness check. It
 * is the same trap `DialogueBox`'s `conversationId` exists for.
 */
export const advanceTransitionForPhase = (phase: CasePhase): AdvanceTransition => ADVANCE_TRANSITION_BY_PHASE[phase];

/** Which of the two answers a refusal gets (AC4). They are not interchangeable. */
export type RefusalRegister = 'gate' | 'error';

/**
 * Every code the localization layer carries an authored string for, as the code alone.
 *
 * Derived from `TranslationKey` rather than restated, so {@link GATE_REFUSAL_CODES} cannot hold a
 * code the bundles have stopped authoring. `ResultError.code` is a bare `string` — the store has no
 * code union to bind to — and the failure mode that leaves is silent in exactly the wrong direction:
 * rename the code in the reducer, fix the one integration test that names it, and this module keeps a
 * stale literal that `includes` never matches again, so the register quietly answers `'error'`
 * forever and the authored colleague line stops appearing. `tsc` catches it here instead.
 */
type ErrorCodeOf<TKey> = TKey extends `error.${infer TCode}` ? TCode : never;
export type LocalizedErrorCode = ErrorCodeOf<TranslationKey>;

/**
 * The gates that have an authored in-fiction colleague line, by error code.
 *
 * Exactly one today: the significant-measure gate, whose four `colleagueHints` entries are authored
 * EN+FR in `case.json`. Adding a second predicate kind is a `CaseDefinition` contract change and a
 * version bump — the missing-sources colleague line is Story 2.8's AC4, not this story's.
 */
const GATE_REFUSAL_CODES: readonly LocalizedErrorCode[] = ['significant-measures-required'];

/**
 * A gate the player can act on is answered by the colleague; anything else by the localized error.
 *
 * The default matters more than the special case. `createStore` short-circuits every dispatch during
 * an exclusive progress operation, so a click during a progress export fails with
 * `progress-operation-active` — a refusal with nothing to do with the evidence, which a colleague
 * must not appear to have explained.
 */
export const advanceRefusalRegister = (code: string): RefusalRegister =>
    (GATE_REFUSAL_CODES as readonly string[]).includes(code) ? 'gate' : 'error';

export type AdvanceRefusalInput = Readonly<{
    /** The code the store refused with. */
    code: string;
    /** The already-localized error for that refusal — the fallback, and usually the answer. */
    localizedError: string;
    /**
     * Whether this host can actually **speak** the colleague's line for this refusal: it has an
     * authored hint that applies right now, and a slot to paint it in.
     *
     * The laboratory passes `selectLocalizedColleagueHint(state) !== undefined`. Every other host
     * passes `false` today, and says so here rather than by not calling this function — a host that
     * routed a gate refusal to a hint slot it does not have would answer with nothing, which is the
     * one thing AC4 forbids. When Story 2.8 authors the missing-sources line, the library changes
     * this one argument and inherits the rule already written.
     */
    colleagueAnswers: boolean;
}>;

export type AdvanceRefusal = Readonly<{
    register: RefusalRegister;
    /** What to hold in the transient slot, or `undefined` when the colleague has the answer. */
    message?: string;
}>;

/**
 * How a refusal is answered — decided here for **every** host, not just the one that has a hint slot.
 *
 * This is the "one rule, not two" the module header claims. `advanceRefusalRegister` alone was not
 * enough: it says which register a code belongs to, and each host still had to decide what to do with
 * that, which is where two of them diverged into answering everything with the localized error.
 *
 * The fallback is the part that has to be here rather than at a call site. `'gate'` means "the
 * colleague answers this, so the error must not also be shown" — and with no line actually applying,
 * that reduces to showing nothing at all: no hint, no error, no change, a refusal indistinguishable
 * from a dead control. Shipped content cannot reach it (`below-significant-measures` is an
 * unconditional catch-all and validation requires it authored last), but the register is a lookup
 * table that later stories add to, and the silent branch should not be waiting for them.
 */
export const resolveAdvanceRefusal = ({ code, localizedError, colleagueAnswers }: AdvanceRefusalInput): AdvanceRefusal => {
    const register: RefusalRegister = colleagueAnswers && advanceRefusalRegister(code) === 'gate' ? 'gate' : 'error';
    return Object.freeze({ register, message: register === 'gate' ? undefined : localizedError });
};

/**
 * How long the control ignores clicks after its own label changes under the cursor.
 *
 * **The one scene that hosts two phases is what makes this necessary.** `SceneRouter.route()` returns
 * early when the resolved scene key is unchanged, so `TheoryBoardScene` and its live control *survive*
 * `synthesis → review`. `requestAdvance` correctly re-resolves from the live phase, and a double-click
 * therefore dispatches two **different** actions: click 1 sends `theory.reviewRequested`, the label
 * changes from "To your reviewers" to "Close the case" between frames, and click 2 sends
 * `case.debriefCompleted`. Usually that second one is refused with `reviewed-revision-required` one
 * frame after an advance the player was never told about — but against a restored record already
 * carrying a matching `decisionHistory` entry every check passes, and the double-click completes the
 * case, skipping `review` entirely. That is the bypass the transition mapping is careful to prevent,
 * arrived at through click timing instead.
 *
 * 400ms is a read-the-new-label window, not an animation: nothing moves, so it has nothing to do with
 * `prefers-reduced-motion` and the widget stays free of tweens and update loops. Deliberately longer
 * than a typical ~150ms double-click and short enough to be invisible to a player clicking on purpose.
 */
export const ADVANCE_RELABEL_LOCKOUT_MS = 400;

/**
 * Whether a click that has just landed should be honoured, given when the label last changed.
 *
 * A pure predicate over an elapsed-millisecond clock rather than a timer object: nothing to release in
 * `destroy()`, nothing to keep in sync with the frame loop, and it can be asserted directly instead of
 * through a Phaser scene Vitest cannot construct. Elapsed time, never a frame counter.
 */
export const acceptsAdvanceClick = ({ relabelledAt, now }: Readonly<{ relabelledAt?: number; now: number }>): boolean =>
    relabelledAt === undefined || (now - relabelledAt) >= ADVANCE_RELABEL_LOCKOUT_MS;

export type AdvanceViewInput = Readonly<{
    /**
     * Whether the gate on this transition is met, as far as the surface can know.
     *
     * Only the laboratory has a gate it can read cheaply and honestly (the significant-measure
     * count). Every other host passes `true`: the store decides on the click, and a control that
     * guessed at readiness on the theory board would be holding an opinion about a conclusion, which
     * is the evaluator's business and not a surface's (ADR-006).
     */
    isGateMet: boolean;
    /** The authored colleague line for this evidence, already localized, or `undefined` if none applies. */
    hint?: Readonly<{ speaker: string; line: string }>;
    /** A localized error from a refusal that was *not* the gate, if one is waiting to be shown. */
    transientError?: string;
    /** Whether an advance has been refused by the gate since the last time a hint applied. */
    advanceRefused: boolean;
}>;

export type AdvanceView = Readonly<{
    /** The control reports only whether the way on is open — never an opinion about a conclusion. */
    isAdvanceReady: boolean;
    speakerText: string;
    lineText: string;
    /** The refusal flag as it stands *after* this paint, for the caller to store back. */
    advanceRefused: boolean;
}>;

export const resolveAdvanceView = ({
    isGateMet,
    hint,
    transientError,
    advanceRefused
}: AdvanceViewInput): AdvanceView => {
    // A hint that no longer applies takes the refusal with it.
    const stillRefused = hint ? advanceRefused : false;
    const showsHint = stillRefused && hint !== undefined;

    return Object.freeze({
        isAdvanceReady: isGateMet,
        // The error owns the whole slot when it is present: an attribution line above an unrelated
        // message would read as the colleague having said it.
        speakerText: transientError ? '' : showsHint ? hint.speaker : '',
        lineText: transientError ?? (showsHint ? hint.line : ''),
        advanceRefused: stillRefused
    });
};
