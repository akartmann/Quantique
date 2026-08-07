import { describe, expect, it } from 'vitest';

import { SingleKeyDelivery } from '../../src/adapters/phaser/renderers/singleKeyDelivery';

/**
 * The guard that turns Phaser's replayed keyboard queue back into one handling per press
 * (Story 2.10).
 *
 * Written after typing a sentence into the bench notebook came out as
 * `"as the s s screen moves s s bs back"`. The mechanism is in the module's own header; what is
 * asserted here is the rule, and the load-bearing case is the **third** test — a re-dispatch of an
 * earlier event *after* a later one, which is the shape the real drain produces and which a
 * remember-the-last-one guard passes straight through.
 */
describe('SingleKeyDelivery', () => {
    it('accepts a press once and refuses every later delivery of the same event', () => {
        const guard = new SingleKeyDelivery();
        const press = { key: 'h' };

        expect(guard.accepts(press)).toBe(true);
        expect(guard.accepts(press)).toBe(false);
        expect(guard.accepts(press)).toBe(false);
    });

    it('accepts two genuine presses of the same key', () => {
        // Auto-repeat, and a player pressing the same arrow twice, arrive as distinct objects — and
        // both must move the instrument. A guard keyed on `event.key` would eat the second.
        const guard = new SingleKeyDelivery();

        expect(guard.accepts({ key: 'ArrowRight' })).toBe(true);
        expect(guard.accepts({ key: 'ArrowRight' })).toBe(true);
    });

    it('survives the cumulative queue drain that produced the defect', () => {
        // Exactly the pattern `KeyboardPlugin.update()` produces when three characters land in one
        // frame: the queue is drained once per press and never cleared between them, so the whole
        // prefix is replayed each time. Only the three first deliveries may be accepted, and each
        // character must be accepted in its own order.
        const guard = new SingleKeyDelivery();
        const a = { key: 'a' };
        const b = { key: 'b' };
        const c = { key: 'c' };

        const typed = [[a], [a, b], [a, b, c]]
            .flat()
            .filter((event) => guard.accepts(event))
            .map(({ key }) => key)
            .join('');

        expect(typed).toBe('abc');
    });

    it('gives each handler its own single delivery of the same press', () => {
        // The bench and the notebook both listen; the notebook's note field must not be starved
        // because the apparatus saw the event first.
        const bench = new SingleKeyDelivery();
        const notebook = new SingleKeyDelivery();
        const press = { key: 'Escape' };

        expect(bench.accepts(press)).toBe(true);
        expect(notebook.accepts(press)).toBe(true);
        expect(bench.accepts(press)).toBe(false);
        expect(notebook.accepts(press)).toBe(false);
    });
});
