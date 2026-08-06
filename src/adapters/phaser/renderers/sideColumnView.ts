/**
 * What the laboratory's side column should show, decided without drawing anything (Story 2.6).
 *
 * **This is a separate module so it can be tested.** `ApparatusRenderer` imports Phaser as a *value*
 * (`BlendModes`, for the additive beam blending), Phaser touches `window` at import time, and Vitest
 * runs in Node — so nothing inside that file can be reached by a unit test at all. The review
 * (2026-08-06) found the whole of Task 7 uncovered for exactly that reason: the `advanceRefused`
 * lifecycle, the precedence between a gate refusal and a store-busy error, and the hint's
 * self-withdrawal were verified only by a temporary Playwright spec that was then deleted.
 *
 * The rule the module encodes is small but has three moving parts that interact, which is precisely
 * the shape that earns a test:
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

export type SideColumnInput = Readonly<{
    /** Whether the recorded evidence clears the authored bar. */
    isGateMet: boolean;
    /** The authored colleague line for this evidence, already localized, or `undefined` if none applies. */
    hint?: Readonly<{ speaker: string; line: string }>;
    /** A localized error from a refusal that was *not* the gate, if one is waiting to be shown. */
    transientError?: string;
    /** Whether an advance has been refused by the gate since the last time a hint applied. */
    advanceRefused: boolean;
}>;

export type SideColumnView = Readonly<{
    /** The control reports only whether the way on is open — never an opinion about a conclusion. */
    isAdvanceReady: boolean;
    speakerText: string;
    lineText: string;
    /** The refusal flag as it stands *after* this paint, for the caller to store back. */
    advanceRefused: boolean;
}>;

export const resolveSideColumnView = ({
    isGateMet,
    hint,
    transientError,
    advanceRefused
}: SideColumnInput): SideColumnView => {
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
