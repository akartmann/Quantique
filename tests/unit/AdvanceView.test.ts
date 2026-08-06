import { describe, expect, it } from 'vitest';

import {
    ADVANCE_RELABEL_LOCKOUT_MS,
    ADVANCE_TRANSITION_BY_PHASE,
    acceptsAdvanceClick,
    advanceRefusalRegister,
    advanceTransitionForPhase,
    resolveAdvanceRefusal,
    resolveAdvanceView,
    type AdvanceViewInput
} from '../../src/adapters/phaser/renderers/advanceView';
import { ADVANCE_TRANSITION_IDS } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { CASE_PHASES } from '../../src/domain/cases/CaseProgress';
import { ROUTABLE_SCENE_KEYS } from '../../src/domain/cases/ScenarioScript';

/**
 * What the in-scene advance affordance decides, tested without a browser.
 *
 * The rule started life in `sideColumnView.ts` as the laboratory's alone (Story 2.6, added in review
 * after Task 7 shipped with no coverage at all). Story 2.7 gives every phase one of these controls, so
 * the rule generalizes and this file carries the laboratory's original assertions forward unchanged —
 * they still mean exactly what they meant — plus the mapping and the refusal-register rule that are
 * new here.
 *
 * The renderers cannot be imported: `ApparatusRenderer` imports Phaser as a value, and Phaser touches
 * `window` at import time. That is why the decision lives in its own module.
 */

const HINT = Object.freeze({ speaker: 'Elias Wren — Instrument maker', line: 'Take a reading at the settings we have.' });

const view = (overrides: Partial<AdvanceViewInput> = {}) => resolveAdvanceView({
    isGateMet: false,
    hint: HINT,
    advanceRefused: false,
    ...overrides
});

/**
 * Every machinery token a label names, or `[]` when it names only the fiction — the `encodesPath` rule
 * as one function, so the sweep and the guard that proves the sweep can fire share it.
 *
 * Three vocabularies, and they are matched differently on purpose:
 *
 * - **Machinery words** ("synthesis", "phase") are wrong in any casing, so they match case-insensitively
 *   on a word boundary. `\breview\b` deliberately does not match "reviewers": the phase is `review`, the
 *   people are reviewers, and the people are the fiction.
 * - **Arrows** are punctuation and carry no word boundary at all, so they are matched as substrings.
 *   Written as `\b→\b` they could never fire, which is how two dead entries survived in this list.
 * - **Scene keys** are PascalCase identifiers read from `ROUTABLE_SCENE_KEYS` rather than restated, so a
 *   scene added to the routing vocabulary is swept without anyone remembering to add it here. Their case
 *   is the whole distinction the story draws: `Colleagues` is a routing key, "your colleagues" is four
 *   people in a room, and matching case-insensitively would reject the fiction the rule asks for.
 */
const MACHINERY_WORDS = [...CASE_PHASES, 'scene', 'phase', 'route'];
const MACHINERY_ARROWS = ['→', '->'];

const namesMachinery = (label: string): string[] => [
    ...MACHINERY_WORDS.filter((token) => new RegExp(`\\b${token}\\b`, 'iu').test(label)),
    ...MACHINERY_ARROWS.filter((token) => label.includes(token)),
    ...ROUTABLE_SCENE_KEYS.filter((token) => label.includes(token))
];

describe('the phase → transition mapping', () => {
    it('covers the case machine\'s phases exactly, with nothing missing and nothing stale', () => {
        // The set is total by design: `debrief` maps to the replay rather than to nothing, so a player
        // is never standing in a phase whose scene has no way on. A *missing* phase is already a `tsc`
        // error — the mapping is a `Record<CasePhase, …>` — so what this asserts is the other half the
        // type cannot: a key left behind by a phase that has since been renamed or removed, which would
        // sit there matching nothing.
        expect(Object.keys(ADVANCE_TRANSITION_BY_PHASE).sort()).toEqual([...CASE_PHASES].sort());
    });

    it('maps each phase to the transition that leaves it, and never to another phase\'s', () => {
        expect(advanceTransitionForPhase('context').transition).toBe('context-to-prediction');
        expect(advanceTransitionForPhase('prediction').transition).toBe('prediction-to-experiment');
        expect(advanceTransitionForPhase('experiment').transition).toBe('experiment-to-synthesis');
        // The theory board hosts both of these, and they dispatch different actions. A renderer that
        // captured its transition once would send a reviewing player back through the readiness check.
        expect(advanceTransitionForPhase('synthesis').transition).toBe('synthesis-to-review');
        expect(advanceTransitionForPhase('review').transition).toBe('review-to-debrief');
        expect(advanceTransitionForPhase('debrief').transition).toBe('debrief-replay');
    });

    it('uses each transition exactly once, so none is unreachable and none is duplicated', () => {
        const used = CASE_PHASES.map((phase) => advanceTransitionForPhase(phase).transition);

        expect([...used].sort()).toEqual([...ADVANCE_TRANSITION_IDS].sort());
    });

    it('labels every transition in both locales', () => {
        // The project's most-repeated defect is a surface localized in English only. A label key with
        // no French entry would fall back to English silently at runtime.
        const missing = CASE_PHASES
            .map((phase) => advanceTransitionForPhase(phase).labelKey)
            .filter((labelKey) => !en[labelKey] || !fr[labelKey]);

        expect(missing).toEqual([]);
    });

    it('names a destination in the fiction rather than a scene, phase, or route', () => {
        const offending = CASE_PHASES.flatMap((phase) => {
            const { labelKey } = advanceTransitionForPhase(phase);
            return [en[labelKey], fr[labelKey]].flatMap((label) =>
                namesMachinery(label).map((token) => `${labelKey}: "${label}" names ${token}`));
        });

        expect(offending).toEqual([]);
    });

    it('would catch a label that named the machinery, so the check above is not vacuous', () => {
        // Run through `namesMachinery` itself, not through restated regexes: a guard that asserts
        // JavaScript's own regex semantics against its own literals stays green when the sweep's
        // vocabulary is emptied, which is the one failure it exists to prevent.
        //
        // The realistic mistakes, one per vocabulary, plus both arrow forms — those were previously
        // written as `\b→\b` and `\b->\b`, which can never and almost never match: `\b` asserts a word
        // boundary, `→` is not a word character, and `->` only matched the exact form `word->word`.
        expect(namesMachinery('To synthesis')).toContain('synthesis');
        expect(namesMachinery('Open the TheoryBoard')).toContain('TheoryBoard');
        expect(namesMachinery('Library → prediction')).toContain('→');
        expect(namesMachinery('To -> the board')).toContain('->');
        expect(namesMachinery('Advance to the next phase')).toContain('phase');
        // …and that it does not fire on the fiction the rule explicitly permits.
        expect(namesMachinery('To your reviewers')).toEqual([]);
        expect(namesMachinery('To your colleagues')).toEqual([]);
        expect(namesMachinery('Vers vos relecteurs')).toEqual([]);
    });
});

describe('which register answers a refusal', () => {
    it('sends the significant-measure gate to the authored colleague line', () => {
        // The one gate with authored in-fiction lines today (`case.json` `colleagueHints`).
        expect(advanceRefusalRegister('significant-measures-required')).toBe('gate');
    });

    it('sends every other refusal to the localized error', () => {
        // Including the ones that have nothing to do with the evidence. `createStore` short-circuits
        // every dispatch during an exclusive progress operation, so a click during an export fails
        // with `progress-operation-active` and must not be answered by a colleague.
        ['progress-operation-active', 'missing-contextual-sources', 'missing-prediction', 'conclusion-not-ready',
            'debrief-review-required', 'reviewed-revision-required', 'invalid-completion-timestamp', 'replay-unavailable']
            .forEach((code) => expect(advanceRefusalRegister(code)).toBe('error'));
    });
});

describe('resolveAdvanceRefusal', () => {
    const LOCALIZED = 'Two measurements that differ are needed before the conclusion opens.';

    it('lets the colleague answer a gate, on a host that can speak the line', () => {
        const { register, message } = resolveAdvanceRefusal({
            code: 'significant-measures-required', localizedError: LOCALIZED, colleagueAnswers: true
        });

        // The error is withheld deliberately: showing both would have the colleague and the interface
        // answer the same refusal twice, in two registers.
        expect(register).toBe('gate');
        expect(message).toBeUndefined();
    });

    it('falls back to the localized error when the gate has no line that applies', () => {
        // The silent branch this exists to close: `'gate'` with no hint drawn nothing at all — no
        // colleague, no error, no change — a refusal indistinguishable from a dead control.
        const { register, message } = resolveAdvanceRefusal({
            code: 'significant-measures-required', localizedError: LOCALIZED, colleagueAnswers: false
        });

        expect(register).toBe('error');
        expect(message).toBe(LOCALIZED);
    });

    it('answers every non-gate refusal with the localized error, on every host', () => {
        // Including on the laboratory, which *can* speak a line: a store-busy refusal has nothing to do
        // with the evidence and a colleague must not appear to have explained it.
        [true, false].forEach((colleagueAnswers) => {
            const { register, message } = resolveAdvanceRefusal({
                code: 'progress-operation-active', localizedError: 'Please wait.', colleagueAnswers
            });

            expect(register).toBe('error');
            expect(message).toBe('Please wait.');
        });
    });

    it('returns a frozen answer, so a caller cannot edit the rule on its way to the screen', () => {
        expect(Object.isFrozen(resolveAdvanceRefusal({
            code: 'replay-unavailable', localizedError: 'x', colleagueAnswers: false
        }))).toBe(true);
    });
});

describe('acceptsAdvanceClick', () => {
    // The theory board hosts `synthesis` and `review`, the router leaves the scene standing across that
    // transition, and the label changes under the cursor — so a double-click sends two *different*
    // actions. Elapsed milliseconds, never a frame count.
    it('accepts a click on a control whose label has not changed', () => {
        expect(acceptsAdvanceClick({ relabelledAt: undefined, now: 10_000 })).toBe(true);
    });

    it('ignores a click that lands while the new label is still unread', () => {
        expect(acceptsAdvanceClick({ relabelledAt: 10_000, now: 10_000 })).toBe(false);
        // A typical double-click interval, which is the case that skipped `review` entirely against a
        // restored record.
        expect(acceptsAdvanceClick({ relabelledAt: 10_000, now: 10_150 })).toBe(false);
    });

    it('accepts it again once the window has passed', () => {
        expect(acceptsAdvanceClick({ relabelledAt: 10_000, now: 10_000 + ADVANCE_RELABEL_LOCKOUT_MS })).toBe(true);
        expect(acceptsAdvanceClick({ relabelledAt: 10_000, now: 12_000 })).toBe(true);
    });

    it('holds a window long enough to outlast a double-click, and short enough not to be felt', () => {
        // Asserted as a range rather than as the constant's own value, which would only restate it.
        expect(ADVANCE_RELABEL_LOCKOUT_MS).toBeGreaterThan(250);
        expect(ADVANCE_RELABEL_LOCKOUT_MS).toBeLessThanOrEqual(600);
    });
});

describe('resolveAdvanceView', () => {
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

        it('stays empty on a surface with no authored hint for its gate at all', () => {
            // Five of the six transitions are in exactly this position: their gates have no authored
            // colleague line, so the slot is the localized error's or nobody's.
            const noHint = view({ hint: undefined, advanceRefused: true, isGateMet: false });

            expect(noHint.lineText).toBe('');
            expect(noHint.speakerText).toBe('');
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
