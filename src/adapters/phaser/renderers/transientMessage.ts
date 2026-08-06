/**
 * An explicit lifetime for a transient message: it survives until a **real state change** replaces it
 * (Story 2.7, AC5).
 *
 * Both `ApparatusRenderer` and `ColleagueRenderer` used to clear the message inside the render that
 * drew it — `this.transientError = undefined` immediately after reading it into the text object. So
 * the message painted once and the next `render(state)` erased it, and both renderers re-render for
 * reasons that are **not** state changes: a dialogue advance, a card relayout, the refusal's own
 * follow-up render. The player was left with a control that had refused for a reason they could no
 * longer read — which is the state `advanceToSynthesis()`'s own comment said swallowing the error
 * would produce. `deferred-work.md` recorded it against both renderers and asked for one pass that
 * fixed them together rather than a patch that made the two disagree; this is that pass.
 *
 * **Why object identity is the exact rule.** `createStore` replaces `state` with a new frozen object
 * only on a successful `dispatch` or `replaceWithValidatedRecord`, and notifies only then. A refused
 * dispatch returns a failure and leaves the object untouched. So `state !== anchor` is precisely "a
 * real state change happened since this message was set" — no timers, no frame counting, nothing to
 * tune, and nothing to keep in sync with the store's notification schedule.
 *
 * One consequence, accepted deliberately: a locale change *is* a state change and clears the message.
 * That is correct — the message would otherwise be stranded in the previous language.
 *
 * Phaser-free on purpose, so the lifetime can be asserted directly instead of through a renderer that
 * Vitest cannot import.
 */
export class TransientMessageSlot<TValue> {
    private value?: TValue;
    /**
     * The state object the message was set against. `object` rather than `AppState` because the rule
     * is about identity and nothing else, and a narrower type would tie the helper to the store for
     * no benefit.
     */
    private anchor?: object;

    /** Holds `value` until a state other than `anchor` is rendered. */
    public set(value: TValue, anchor: object): void {
        this.value = value;
        this.anchor = anchor;
    }

    /**
     * What to paint for this render, spending the message if the state has moved on.
     *
     * Reading is what expires it, rather than a separate `tick`: every render reads the slot exactly
     * once, so there is no second call site to forget.
     */
    public read(state: object): TValue | undefined {
        if (this.anchor !== undefined && this.anchor !== state) {
            this.value = undefined;
            this.anchor = undefined;
        }
        return this.value;
    }

    /** For a caller that has superseded the message itself — a gate refusal answered by a hint. */
    public clear(): void {
        this.value = undefined;
        this.anchor = undefined;
    }
}
