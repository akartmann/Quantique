import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import type { AppAction } from '../../src/core/store/AppAction';
import type { Result } from '../../src/core/errors/Result';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import {
    selectCasePhase,
    selectCritiqueHistory,
    selectDefensibleConclusionProposalIds,
    selectLocalizedRivalLabCritique,
    selectPortableCaseRecord,
    selectRivalLabCritique,
    selectSelectedConclusionProposalId,
    selectTheoryBoardDraft
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The whole choose → submit → critique → revise → proceed loop, through **public store actions and
 * selectors only**. No Phaser, no renderer, no internal store shape — AC4 asks for exactly that, and
 * it is also what makes these assertions survive a presentation rewrite.
 *
 * Driven against the authored Young case rather than a fixture: the critiques, the defensible-set
 * evaluator, and the conclusion proposals all have to agree with each other in the content that ships.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

/**
 * A store at the theory board with enough evidence to defend `conclusion-spacing-varies`: two runs at
 * different slit spacings, a saved comparison of them, and both sources inspected and selected.
 *
 * `conclusion-both-settings` additionally needs a varied screen distance, so it stays indefensible
 * here — which is what gives the "missing evidence" critiques something real to be about.
 */
const storeAtSynthesis = (locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
    store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.35, origin: 'phaser' });
    store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-06T12:01:00.000Z' });
    store.dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
    store.dispatch({ type: 'comparison.runSelected', runId: 'run-2' });
    store.dispatch({ type: 'comparison.noteSaved', note: 'The band spacing changes with the slit separation.' });
    store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' });
    store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-2' });
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    return store;
};

/**
 * The theory board reached on **thin evidence** — one run, no comparison — which leaves every authored
 * conclusion indefensible. It is a reachable state, not a contrived one: the gates from `experiment`
 * onward are phase gates, and the evidence gate is Story 2.6.
 */
const storeAtSynthesisWithThinEvidence = (locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-06T12:00:00.000Z' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    return store;
};

const INDEFENSIBLE = 'conclusion-wave-settled';
const DEFENSIBLE = 'conclusion-spacing-varies';

/**
 * AC1 across the whole authored set, in both locales — the automated counterpart of Task 11's manual
 * pass. Every conclusion a player can pick draws a critique from a thin-evidence state, and the line
 * they read is the authored one for that locale rather than an English fallback.
 */
describe('every authored conclusion draws a critique from a thin-evidence state', () => {
    const proposalIds = [
        'conclusion-spacing-varies',
        'conclusion-both-settings',
        'conclusion-wave-settled',
        'conclusion-universal-optics'
    ] as const;

    it.each(proposalIds)('critiques %s in English', (proposalId) => {
        const store = storeAtSynthesisWithThinEvidence('en');
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });

        expect(selectRivalLabCritique(store.getState())).toMatchObject({ proposalId });
        expect(selectLocalizedRivalLabCritique(store.getState())?.line)
            .toBe(definition.rivalLab.critiques.find((critique) => critique.proposalId === proposalId)?.line.en);
    });

    it.each(proposalIds)('critiques %s in French', (proposalId) => {
        const store = storeAtSynthesisWithThinEvidence('fr');
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });

        expect(selectLocalizedRivalLabCritique(store.getState())?.line)
            .toBe(definition.rivalLab.critiques.find((critique) => critique.proposalId === proposalId)?.line.fr);
    });

    /** No score, timer, attempt count, penalty, or lockout language in either locale (AC2). */
    it.each(proposalIds)('says nothing punitive in %s', (proposalId) => {
        const critique = definition.rivalLab.critiques.find((candidate) => candidate.proposalId === proposalId);
        // The `u` flag is load-bearing, not decoration. Without it `\b` is defined against ASCII `\w`,
        // so `\béchec` demands a word character before `é` and can never match a space-delimited
        // "échec" — the most obvious French term in the list was silently unmatchable (2.5 review).
        const punitive = /\b(score|scored|penalt\w*|locked|failure|failed|attempt\w*|timer)\b|(?<![\p{L}\p{N}_])(pénalit|verrouill|échec|tentative|chronom|sanction|perdu)[\p{L}\p{N}]*(?![\p{L}\p{N}_])/iu;

        expect(critique?.line.en).not.toMatch(punitive);
        expect(critique?.line.fr).not.toMatch(punitive);
    });
});

describe('rival-lab critique', () => {
    it('leaves the defensible and indefensible conclusions where these cases assume they are', () => {
        const defensible = selectDefensibleConclusionProposalIds(storeAtSynthesis().getState());

        expect(defensible).toContain(DEFENSIBLE);
        expect(defensible).not.toContain(INDEFENSIBLE);
    });

    it('answers an unsupported conclusion with an authored critique naming the rival', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });

        expect(store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' }))
            .toEqual({ ok: true, value: undefined });

        expect(selectRivalLabCritique(store.getState())).toMatchObject({ proposalId: INDEFENSIBLE });
        const projected = selectLocalizedRivalLabCritique(store.getState());
        expect(projected?.speaker).toContain(definition.rivalLab.name);
        expect(projected?.line.length).toBeGreaterThan(0);
        expect(projected?.accentColor).toBe(definition.rivalLab.accentColor);
    });

    /** The critique is a beat, not a setback: nothing about the investigation may move because of it. */
    it('loses no state and moves no phase when the critique appears', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        const before = store.getState();

        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });

        const after = store.getState();
        expect(selectCasePhase(after)).toBe(selectCasePhase(before));
        expect(selectSelectedConclusionProposalId(after)).toBe(INDEFENSIBLE);
        expect(selectTheoryBoardDraft(after)).toEqual(selectTheoryBoardDraft(before));
        expect(after.runs).toEqual(before.runs);
        expect(after.comparison).toEqual(before.comparison);
        expect(after.decisionHistory).toEqual(before.decisionHistory);
        expect(after.recognition).toEqual(before.recognition);
    });

    it('records the rejected choice and the critique in the history', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });

        expect(selectCritiqueHistory(store.getState())).toEqual([{
            proposalId: INDEFENSIBLE,
            critiqueId: definition.rivalLab.critiques.find(({ proposalId }) => proposalId === INDEFENSIBLE)?.id,
            timestamp: '2026-08-06T12:10:00.000Z'
        }]);
    });

    it('grows the history when another unsupported conclusion is submitted', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });
        store.dispatch({ type: 'rivalLab.revisionRequested' });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: 'conclusion-universal-optics' });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:11:00.000Z' });

        expect(selectCritiqueHistory(store.getState()).map(({ proposalId }) => proposalId))
            .toEqual([INDEFENSIBLE, 'conclusion-universal-optics']);
    });

    it('returns the player to their rejected choice, still revisable', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });

        expect(store.dispatch({ type: 'rivalLab.revisionRequested' })).toEqual({ ok: true, value: undefined });

        expect(selectRivalLabCritique(store.getState())).toBeUndefined();
        // The choice and the draft survive: the player comes back to what they wrote, not to a blank board.
        expect(selectSelectedConclusionProposalId(store.getState())).toBe(INDEFENSIBLE);
        expect(selectTheoryBoardDraft(store.getState()).conclusion).toBe(
            definition.conclusionProposals.find(({ id }) => id === INDEFENSIBLE)?.claim.en
        );
        // And re-choosing stays a no-op success rather than an "already chosen" failure.
        expect(store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE }))
            .toEqual({ ok: true, value: undefined });
    });

    it('clears the critique as soon as a different conclusion is chosen', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });

        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE });

        expect(selectRivalLabCritique(store.getState())).toBeUndefined();
    });

    it('raises no critique when a defensible conclusion is submitted, and leaves the case free to proceed', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });
        store.dispatch({ type: 'rivalLab.revisionRequested' });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE });

        expect(store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:12:00.000Z' }))
            .toEqual({ ok: true, value: undefined });

        expect(selectRivalLabCritique(store.getState())).toBeUndefined();
        // The submission itself advances nothing — it only stops blocking.
        expect(selectCasePhase(store.getState())).toBe('synthesis');
        expect(selectCritiqueHistory(store.getState())).toHaveLength(1);
        // And the existing review → revision → debrief path is unobstructed.
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
        expect(selectCasePhase(store.getState())).toBe('review');
    });

    it('raises no critique on a second submit of a defensible conclusion', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:11:00.000Z' });

        expect(selectRivalLabCritique(store.getState())).toBeUndefined();
        expect(selectCritiqueHistory(store.getState())).toEqual([]);
    });

    it('clears both the standing critique and the history on a counterfactual replay', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });
        store.dispatch({ type: 'rivalLab.revisionRequested' });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE });
        store.dispatch({ type: 'theory.reviewRequested' });
        store.dispatch({ type: 'peerReview.requested' });
        store.dispatch({ type: 'revision.saved', timestamp: '2026-08-06T12:20:00.000Z' });
        store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-06T12:21:00.000Z' });

        expect(store.dispatch({ type: 'case.replayStarted' })).toEqual({ ok: true, value: undefined });

        expect(selectRivalLabCritique(store.getState())).toBeUndefined();
        expect(selectCritiqueHistory(store.getState())).toEqual([]);
        // The completed run keeps its own copy, so replaying never erases what it drew.
        expect(store.getState().completion?.critiqueHistory).toHaveLength(1);
    });

    /**
     * `SceneRouter` treats a standing critique as an unconditional override, so a critique that outlives
     * a phase change would pin the rival lab over a phase whose own scene never runs — and it is
     * reachable, because the retired-but-mounted DOM panels sit outside canvas input suppression. The
     * history is untouched either way: what the phase clears is the transient beat, not the record of it.
     */
    it('clears a standing critique when the phase advances', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:09:00.000Z' });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });
        expect(selectRivalLabCritique(store.getState())).toBeDefined();

        // The choice has to be defensible again for the readiness gate to let the phase move; the
        // critique from the rejected one is what must not survive it.
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:11:00.000Z' });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:12:00.000Z' });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE });
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });

        expect(selectCasePhase(store.getState())).toBe('review');
        expect(selectRivalLabCritique(store.getState())).toBeUndefined();
        expect(selectCritiqueHistory(store.getState())).toHaveLength(2);
    });

    it('clears a standing critique when the case completes', () => {
        // The indefensible conclusion is chosen *before* the revision is saved, and never re-chosen
        // after: choosing writes the proposal's canonical text into the draft, and `case.debriefCompleted`
        // requires the draft to still match the saved decision. Defensibility gates nothing here —
        // completion is the peer review's business — so an unsupported claim can legitimately be carried
        // all the way in, which is exactly the case where a stale critique would strand the player.
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.reviewRequested' });
        store.dispatch({ type: 'peerReview.requested' });
        store.dispatch({ type: 'revision.saved', timestamp: '2026-08-06T12:20:00.000Z' });
        // `review` is the second phase the theory board hosts, so a challenge can still be raised here —
        // after the reviewed revision the completion contract needs, and before the debrief opens.
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:20:40.000Z' });
        expect(selectRivalLabCritique(store.getState())).toBeDefined();

        expect(store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-06T12:21:00.000Z' }))
            .toEqual({ ok: true, value: undefined });

        expect(selectCasePhase(store.getState())).toBe('debrief');
        expect(selectRivalLabCritique(store.getState())).toBeUndefined();
        // The snapshot still carries what was drawn: clearing the beat never clears the record.
        expect(store.getState().completion?.critiqueHistory).toHaveLength(1);
    });

    it('carries the critique history into the portable record as IDs only', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });

        const record = selectPortableCaseRecord(store.getState());

        expect(record).toMatchObject({ ok: true });
        if (!record.ok) return;
        expect(record.value.critiqueHistory).toEqual(selectCritiqueHistory(store.getState()));
        const line = definition.rivalLab.critiques.find(({ proposalId }) => proposalId === INDEFENSIBLE)?.line.en ?? '';
        expect(JSON.stringify(record.value.critiqueHistory)).not.toContain(line);
    });

    it('resolves the critique line in the active language', () => {
        const critique = definition.rivalLab.critiques.find(({ proposalId }) => proposalId === INDEFENSIBLE);
        const projected = (locale: 'en' | 'fr') => {
            const store = storeAtSynthesis(locale);
            store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
            store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });
            return selectLocalizedRivalLabCritique(store.getState());
        };

        expect(projected('en')?.line).toBe(critique?.line.en);
        expect(projected('fr')?.line).toBe(critique?.line.fr);
        // Canonical either way: the rival's name is a proper noun, so only the role label changes.
        expect(projected('fr')?.speaker).toContain(definition.rivalLab.name);
        expect(projected('fr')?.speaker).not.toBe(projected('en')?.speaker);
    });

    /** No defensibility field may reach a surface — the rule ADR-006 states and 1.11 AC3 repeats. */
    it('never exposes the defensible set through the rival-lab projection', () => {
        const store = storeAtSynthesis();
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
        store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });

        expect(Object.keys(selectLocalizedRivalLabCritique(store.getState()) ?? {}).sort())
            .toEqual(['accentColor', 'line', 'speaker']);
    });

    describe('refusals', () => {
        it('refuses a submission before the theory board', () => {
            const store = createStore(createInitialAppState(definition));

            expect(store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' }))
                .toMatchObject({ ok: false, error: { code: 'conclusion-submission-unavailable' } });
        });

        it('refuses a submission with no conclusion chosen', () => {
            expect(storeAtSynthesis().dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' }))
                .toMatchObject({ ok: false, error: { code: 'conclusion-choice-required' } });
        });

        it.each(['not-a-timestamp', '2026-08-06T12:10:00Z'])('refuses the malformed submission timestamp %s', (timestamp) => {
            const store = storeAtSynthesis();
            store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });

            expect(store.dispatch({ type: 'theory.conclusionSubmitted', timestamp }))
                .toMatchObject({ ok: false, error: { code: 'invalid-critique-timestamp' } });
        });

        it('refuses a submission timestamp no later than the previous challenge', () => {
            const store = storeAtSynthesis();
            store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
            store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });
            store.dispatch({ type: 'rivalLab.revisionRequested' });

            // A distinct code from the malformed-timestamp case above: different refusal, different
            // remedy, and the player supplies neither timestamp (2.5 review).
            expect(store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' }))
                .toMatchObject({ ok: false, error: { code: 'critique-timestamp-not-later' } });
        });

        it('refuses a revision request with no challenge standing', () => {
            expect(storeAtSynthesis().dispatch({ type: 'rivalLab.revisionRequested' }))
                .toMatchObject({ ok: false, error: { code: 'rival-lab-critique-unavailable' } });
        });

        /**
         * The critique blocks nothing. Whatever else the player does while it stands has to keep
         * working — a challenge that could make another action fail would be a setback in disguise.
         *
         * Stated as an equality rather than a success, which is what the claim actually is: a standing
         * challenge must not change what any other action does. A bare `.ok` assertion would pin
         * whichever outcome an action happens to have in this fixture — `consultation.requested` may
         * legitimately have no authored rule left to fire once the evidence is this complete — and would
         * fail for a reason that has nothing to do with the critique.
         *
         * The previous form proved neither: `expect(result.ok || true).toBe(true)` is unconditionally
         * true and would have passed with the consultation feature deleted, and every assertion after
         * the first ran with no challenge standing, because the evidence-touching reducers clear
         * `rivalLabCritique` (2.5 review).
         */
        it('makes no other action fail while a challenge stands', () => {
            const outcomeOf = (action: AppAction, challenged: boolean): Result<void> => {
                const store = storeAtSynthesis();
                store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
                if (challenged) {
                    store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });
                    expect(selectRivalLabCritique(store.getState())).toBeDefined();
                }
                return store.dispatch(action);
            };

            const unaffected: readonly AppAction[] = [
                { type: 'theory.supportRunUnselected', runId: 'run-1' },
                { type: 'theory.supportSourceUnselected', sourceId: definition.contextualArtifacts[0]!.id },
                { type: 'consultation.requested' },
                { type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE },
                { type: 'theory.reviewRequested' }
            ];

            unaffected.forEach((action) => {
                expect(outcomeOf(action, true)).toEqual(outcomeOf(action, false));
            });

            // And at least one of them demonstrably succeeds, so the equality above is an equality
            // between two successes rather than between two identical refusals.
            expect(outcomeOf({ type: 'theory.supportRunUnselected', runId: 'run-1' }, true))
                .toEqual({ ok: true, value: undefined });
        });
    });

    /**
     * AC3: revising is inquiry, not failure. No recognition item may be lost or withheld because a
     * critique happened — and no fifth item was added to say so, because `CurrentRecognitionSchema`
     * pins the count and `migrateCaseRecord` has no path from four items to five, so every saved
     * four-item record would fail to load and `CaseProgressPanel` would autosave over it.
     */
    describe('recognition after a critique', () => {
        const completeAfterCritique = (): AppStore => {
            const store = storeAtSynthesis();
            store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
            store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });
            store.dispatch({ type: 'rivalLab.revisionRequested' });
            store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE });
            store.dispatch({ type: 'theory.reviewRequested' });
            store.dispatch({ type: 'peerReview.requested' });
            store.dispatch({ type: 'revision.saved', timestamp: '2026-08-06T12:20:00.000Z' });
            store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-06T12:21:00.000Z' });
            return store;
        };

        const completeWithoutCritique = (): AppStore => {
            const store = storeAtSynthesis();
            store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: DEFENSIBLE });
            store.dispatch({ type: 'theory.reviewRequested' });
            store.dispatch({ type: 'peerReview.requested' });
            store.dispatch({ type: 'revision.saved', timestamp: '2026-08-06T12:20:00.000Z' });
            store.dispatch({ type: 'case.debriefCompleted', timestamp: '2026-08-06T12:21:00.000Z' });
            return store;
        };

        it('achieves calibrated-conclusion on the revised path', () => {
            const store = completeAfterCritique();

            expect(selectCasePhase(store.getState())).toBe('debrief');
            expect(store.getState().recognition.items.find(({ id }) => id === 'calibrated-conclusion')?.achieved).toBe(true);
        });

        it('regresses no recognition item against the same completion with no critique', () => {
            expect(completeAfterCritique().getState().recognition)
                .toEqual(completeWithoutCritique().getState().recognition);
        });
    });
});
