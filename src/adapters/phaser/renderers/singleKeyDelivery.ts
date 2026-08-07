/**
 * One handling per physical key press, whatever Phaser's keyboard queue does (Story 2.10).
 *
 * ## The defect this exists for, found by typing into the bench notebook
 *
 * `Phaser.Input.Keyboard.KeyboardManager.onKeyDown` pushes the DOM event onto a **shared manager
 * queue** and then emits `MANAGER_PROCESS` *synchronously*, so the input plugins run right there.
 * `KeyboardPlugin.update()` then dispatches **every event currently in `this.manager.queue`** — and
 * does not clear it; the manager clears it once per frame, in its own post-update.
 *
 * So within a single frame the queue is drained once per key press, cumulatively:
 *
 * ```
 * keydown a → queue [a]     → dispatches a
 * keydown b → queue [a,b]   → dispatches a, b
 * keydown c → queue [a,b,c] → dispatches a, b, c
 * ```
 *
 * `a` is handled three times and `b` twice, out of order with `c`. At a player's typing speed one
 * frame rarely holds two characters and it shows up as the occasional doubled letter; at a spec's
 * typing speed it garbles a sentence outright — `"as the screen moves back"` came out as
 * `"as the s s screen moves s s bs back"`, which is what made the mechanism visible.
 *
 * The same replay on an arrow key moves an instrument two or three authored steps for one press,
 * which is AC3's "exactly one authored step" broken in a way no test on the renderer could see.
 *
 * ## Why the event is marked rather than remembered
 *
 * The first version of this held the *last* event and refused a repeat of it. That closes the
 * back-to-back case and nothing else: in the drain above, `a` is re-dispatched after `b`, so it is no
 * longer the last one and sails through. Marking the event object itself is total over the pattern —
 * it does not matter how many times, in what order, or across how many frames an event comes back.
 *
 * The mark is a **per-instance** symbol, so two renderers each get their own single delivery of the
 * same press. It is written onto the DOM event, which is extensible, and dies with it — there is
 * nothing to release and no memory held between presses.
 *
 * Auto-repeat from a held key is a genuinely different event object each time and is deliberately let
 * through: a held `Backspace` should keep deleting, as a text field does everywhere else.
 *
 * Phaser-free, so the rule can be asserted directly rather than through a renderer.
 */
export class SingleKeyDelivery {
    /** Unique per instance, so one press can be delivered once to each handler that wants it. */
    private readonly mark = Symbol('single-key-delivery');

    /**
     * Whether this delivery is the first one for its press.
     *
     * Asking is what spends it, rather than a separate `mark()`: every handler asks exactly once, so
     * there is no second call site to forget.
     */
    public accepts(event: object): boolean {
        const marked = event as Record<symbol, boolean | undefined>;
        if (marked[this.mark]) return false;
        marked[this.mark] = true;
        return true;
    }
}
