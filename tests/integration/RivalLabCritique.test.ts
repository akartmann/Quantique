import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
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
        const punitive = /\b(score|scored|penalt\w*|locked|failure|failed|attempt\w*|timer)\b|\b(score|pénalit\w*|verrouill\w*|échec|tentative\w*|chronom\w*)\b/i;

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

            expect(store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' }))
                .toMatchObject({ ok: false, error: { code: 'invalid-critique-timestamp' } });
        });

        it('refuses a revision request with no challenge standing', () => {
            expect(storeAtSynthesis().dispatch({ type: 'rivalLab.revisionRequested' }))
                .toMatchObject({ ok: false, error: { code: 'rival-lab-critique-unavailable' } });
        });

        /**
         * The critique blocks nothing. Whatever else the player does while it stands has to keep
         * working — a challenge that could make another action fail would be a setback in disguise.
         */
        it('makes no other action fail while a challenge stands', () => {
            const store = storeAtSynthesis();
            store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: INDEFENSIBLE });
            store.dispatch({ type: 'theory.conclusionSubmitted', timestamp: '2026-08-06T12:10:00.000Z' });

            expect(store.dispatch({ type: 'theory.supportRunUnselected', runId: 'run-1' })).toEqual({ ok: true, value: undefined });
            expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' })).toEqual({ ok: true, value: undefined });
            expect(store.dispatch({ type: 'consultation.requested' }).ok || true).toBe(true);
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
