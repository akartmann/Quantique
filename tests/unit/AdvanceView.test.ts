import { describe, expect, it } from 'vitest';

import {
    ADVANCE_TRANSITION_BY_PHASE,
    advanceRefusalRegister,
    advanceTransitionForPhase,
    resolveAdvanceView,
    type AdvanceViewInput
} from '../../src/adapters/phaser/renderers/advanceView';
import { ADVANCE_TRANSITION_IDS } from '../../src/adapters/phaser/PhaserStoreAdapter';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { CASE_PHASES } from '../../src/domain/cases/CaseProgress';

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

describe('the phase → transition mapping', () => {
    it('gives every phase in the case machine a forward move', () => {
        // The set is total by design: `debrief` maps to the replay rather than to nothing, so a player
        // is never standing in a phase whose scene has no way on. Written against `CASE_PHASES` rather
        // than a restated list, so a new phase fails here instead of shipping a dead end.
        const uncovered = CASE_PHASES.filter((phase) => ADVANCE_TRANSITION_BY_PHASE[phase] === undefined);

        expect(uncovered).toEqual([]);
        expect(CASE_PHASES.length).toBeGreaterThan(0);
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
        // The `encodesPath` rule, held to by interface copy as well as authored case prose. Two checks,
        // because the two vocabularies differ in exactly one respect:
        //
        // - **Machinery words** ("synthesis", "phase", an arrow) are wrong in any casing, so they are
        //   matched case-insensitively. `\breview\b` deliberately does not match "reviewers": the
        //   phase is `review`, the people are reviewers, and the people are the fiction.
        // - **Scene keys** are PascalCase identifiers, and their case is the whole distinction the
        //   story draws: `Colleagues` is a routing key, "your colleagues" is four people in a room.
        //   Matching them case-insensitively would reject the fiction the rule asks for.
        const machinery = [...CASE_PHASES, 'scene', 'phase', 'route', '→', '->'];
        const sceneKeys = ['Library', 'Colleagues', 'Laboratory', 'TheoryBoard', 'Debrief', 'RivalLab'];
        const offending = CASE_PHASES.flatMap((phase) => {
            const { labelKey } = advanceTransitionForPhase(phase);
            return [en[labelKey], fr[labelKey]].flatMap((label) => [
                ...machinery.filter((token) => new RegExp(`\\b${token}\\b`, 'iu').test(label)),
                ...sceneKeys.filter((token) => label.includes(token))
            ].map((token) => `${labelKey}: "${label}" names ${token}`));
        });

        expect(offending).toEqual([]);
    });

    it('would catch a label that named the machinery, so the check above is not vacuous', () => {
        // The realistic mistake is naming the destination after the thing the code calls it. Pinning
        // that the matcher fires keeps the sweep from silently degrading into an empty filter.
        expect(/\bsynthesis\b/iu.test('To synthesis')).toBe(true);
        expect('Open the TheoryBoard'.includes('TheoryBoard')).toBe(true);
        // …and that it does not fire on the fiction the rule explicitly permits.
        expect(/\breview\b/iu.test('To your reviewers')).toBe(false);
        expect('To your colleagues'.includes('Colleagues')).toBe(false);
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
