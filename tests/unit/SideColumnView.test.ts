import { describe, expect, it } from 'vitest';

import { resolveSideColumnView, type SideColumnInput } from '../../src/adapters/phaser/renderers/sideColumnView';

/**
 * The laboratory side column's decision, tested without a browser.
 *
 * Added in review (2026-08-06): Task 7 shipped with no automated coverage at all. `rival-lab.spec.ts`
 * proves the advance control has a live hit area and that the gate holds, and nothing anywhere
 * asserted that a hint is ever *drawn*, that it withdraws itself, or that a store-busy refusal says
 * something different from a gate refusal. The Completion Notes' manual walkthrough ran through a
 * temporary Playwright spec that was then deleted, so every claim in it rested on a test that no
 * longer exists.
 *
 * `ApparatusRenderer` cannot be imported here — it imports Phaser as a value and Phaser touches
 * `window` at import time — which is why the decision lives in its own module.
 */

const HINT = Object.freeze({ speaker: 'Elias Wren — Instrument maker', line: 'Take a reading at the settings we have.' });

const view = (overrides: Partial<SideColumnInput> = {}) => resolveSideColumnView({
    isGateMet: false,
    hint: HINT,
    advanceRefused: false,
    ...overrides
});

describe('resolveSideColumnView', () => {
    describe('the advance control', () => {
        it('reads ready only when the gate is met', () => {
            expect(view({ isGateMet: false }).isAdvanceReady).toBe(false);
            expect(view({ isGateMet: true, hint: undefined }).isAdvanceReady).toBe(true);
        });

        it('reports readiness independently of whether anything was refused', () => {
            // The control mirrors the evidence, not the player's history with it.
            expect(view({ isGateMet: true, hint: undefined, advanceRefused: true }).isAdvanceReady).toBe(true);
            expect(view({ isGateMet: false, advanceRefused: false }).isAdvanceReady).toBe(false);
        });
    });

    describe('the hint slot', () => {
        it('stays empty until an attempt has actually been refused', () => {
            // A colleague who volunteers the next step before the player has tried anything is
            // supplying it rather than answering. An applicable hint alone must not draw.
            const before = view({ advanceRefused: false });

            expect(before.lineText).toBe('');
            expect(before.speakerText).toBe('');
        });

        it('speaks the attributed authored line once an attempt has been refused', () => {
            const after = view({ advanceRefused: true });

            expect(after.lineText).toBe(HINT.line);
            expect(after.speakerText).toBe(HINT.speaker);
            expect(after.advanceRefused).toBe(true);
        });

        it('withdraws itself, and the refusal with it, as soon as no hint applies', () => {
            // The player answered the nudge by recording a distinguishing measurement. The selector
            // stops returning a hint, so the refusal stops being true and must not survive to the
            // next paint as a stale empty panel or a reappearing line.
            const answered = view({ hint: undefined, advanceRefused: true, isGateMet: true });

            expect(answered.lineText).toBe('');
            expect(answered.speakerText).toBe('');
            expect(answered.advanceRefused).toBe(false);
        });

        it('does not resurrect a refusal when a hint applies again later', () => {
            // Having cleared the flag above, an applicable hint on a later paint must not redraw on
            // its own — it waits for another actual refusal. Otherwise a player who advanced, replayed,
            // and came back would be lectured without having asked for anything.
            expect(view({ advanceRefused: false }).lineText).toBe('');
        });
    });

    describe('a refusal that is not the gate', () => {
        const BUSY = 'Progress is being saved. Try again in a moment.';

        it('takes the slot and outranks the hint', () => {
            // `createStore` short-circuits every dispatch during an exclusive progress operation, so a
            // click during an export fails for a reason that has nothing to do with the evidence.
            const busy = view({ transientError: BUSY, advanceRefused: true });

            expect(busy.lineText).toBe(BUSY);
        });

        it('carries no speaker attribution, so no colleague appears to have said it', () => {
            expect(view({ transientError: BUSY, advanceRefused: true }).speakerText).toBe('');
            expect(view({ transientError: BUSY, advanceRefused: false }).speakerText).toBe('');
        });

        it('shows even when no hint applies at all', () => {
            const busy = view({ transientError: BUSY, hint: undefined, advanceRefused: false });

            expect(busy.lineText).toBe(BUSY);
        });

        it('leaves the gate refusal standing underneath it', () => {
            // The evidence did not change because an export was running, so the flag must survive to
            // the paint after the error clears.
            expect(view({ transientError: BUSY, advanceRefused: true }).advanceRefused).toBe(true);
        });
    });

    it('returns a frozen view, so a caller cannot paint one thing and store another', () => {
        expect(Object.isFrozen(view({ advanceRefused: true }))).toBe(true);
    });
});
