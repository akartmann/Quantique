import { describe, expect, it } from 'vitest';

import { TransientMessageSlot } from '../../src/adapters/phaser/renderers/transientMessage';

/**
 * How long a refused action's message stays on screen (Story 2.7, AC5).
 *
 * Both renderers used to clear the message *inside the render that drew it*, so it painted once and
 * the next `render(state)` erased it — and both re-render for reasons that are not state changes: a
 * dialogue advance, a card relayout, the refusal's own follow-up render. The player was left with a
 * control that refused for a reason they could no longer read (`deferred-work.md`).
 *
 * The fix anchors the message to the `AppState` object it was set against. `createStore` replaces
 * `state` with a **new frozen object** only on a successful `dispatch` or `replaceWithValidatedRecord`,
 * and notifies only then; a refused dispatch leaves the object identity untouched. So object identity
 * is exactly "a real state change happened", with no timers and nothing to tune.
 *
 * Asserted on the helper rather than on a renderer, which is what makes it testable at all — the
 * renderers cannot be imported into Vitest.
 */

/** Stands in for `AppState`: the helper only ever compares identity, never shape. */
const state = (label: string): Readonly<{ label: string }> => Object.freeze({ label });

describe('TransientMessageSlot', () => {
    it('is empty before anything is set', () => {
        const slot = new TransientMessageSlot<string>();

        expect(slot.read(state('a'))).toBeUndefined();
    });

    it('keeps painting the message across repaints of the same state', () => {
        // The case the old code got wrong. A refused dispatch returns the state object untouched, and
        // the renderer then repaints several times for reasons that are not state changes at all.
        const anchor = state('refused');
        const slot = new TransientMessageSlot<string>();
        slot.set('Progress is being saved.', anchor);

        expect(slot.read(anchor)).toBe('Progress is being saved.');
        expect(slot.read(anchor)).toBe('Progress is being saved.');
        expect(slot.read(anchor)).toBe('Progress is being saved.');
    });

    it('clears on the first render that carries a genuinely new state', () => {
        const slot = new TransientMessageSlot<string>();
        slot.set('Progress is being saved.', state('refused'));

        expect(slot.read(state('recorded a run'))).toBeUndefined();
    });

    it('stays cleared once a new state has replaced it', () => {
        // Not merely absent from that one paint: the message is spent, and returning to a repaint of
        // the anchor object must not resurrect it.
        const anchor = state('refused');
        const slot = new TransientMessageSlot<string>();
        slot.set('Progress is being saved.', anchor);
        slot.read(state('moved on'));

        expect(slot.read(anchor)).toBeUndefined();
    });

    it('treats two equal-looking states as different when they are different objects', () => {
        // The identity rule is the point. `createStore` freezes a fresh object on every successful
        // dispatch, so a structurally identical successor is still a real state change — and a
        // structural comparison here would keep a stale message alive across one.
        const slot = new TransientMessageSlot<string>();
        slot.set('Progress is being saved.', state('same'));

        expect(slot.read(state('same'))).toBeUndefined();
    });

    it('re-anchors when a newer message replaces an older one', () => {
        const slot = new TransientMessageSlot<string>();
        slot.set('First refusal.', state('one'));
        const second = state('two');
        slot.set('Second refusal.', second);

        expect(slot.read(second)).toBe('Second refusal.');
    });

    it('clears on demand, for a caller that has answered the message itself', () => {
        // The laboratory does this: a gate refusal is answered by the colleague hint, so any error
        // still standing in the same slot has been superseded rather than merely aged out.
        const anchor = state('refused');
        const slot = new TransientMessageSlot<string>();
        slot.set('Progress is being saved.', anchor);
        slot.clear();

        expect(slot.read(anchor)).toBeUndefined();
    });

    it('carries a structured value, not only a string', () => {
        // `ColleagueRenderer` puts two different kinds of message through one guide slot — a refusal
        // and an acknowledgement — and they are drawn in different colours.
        const anchor = state('submitted');
        const slot = new TransientMessageSlot<Readonly<{ text: string; tone: 'error' | 'notice' }>>();
        slot.set({ text: 'Submitted.', tone: 'notice' }, anchor);

        expect(slot.read(anchor)).toEqual({ text: 'Submitted.', tone: 'notice' });
    });
});
