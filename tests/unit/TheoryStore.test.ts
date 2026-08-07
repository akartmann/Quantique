import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectCasePhase, selectConclusionReadiness, selectTheoryBoardDraft } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';

const definition = {
    // Story 2.12 removed the free-text `prediction.recorded` / `theory.conclusionSet` /
    // `theory.limitationSet` actions, so a fixture that seeds a prediction or a conclusion has to
    // carry the authored proposals the surviving actions choose from. Four of each, because
    // `.length(4)` is the design rather than a minimum.
    predictionProposals: [0, 1, 2, 3].map((index) => ({
        id: `prediction-${index}`,
        colleagueId: 'colleague-1',
        text: { en: `A patterned result may appear (${index}).`, fr: `Un résultat structuré pourrait apparaître (${index}).` }
    })),
    conclusionProposals: [0, 1, 2, 3].map((index) => ({
        id: `conclusion-${index}`,
        colleagueId: 'colleague-1',
        // Index 1 is deliberately overreaching: `peerReviewRules`' `overreach` predicate matches an
        // authored phrase ("proves" / "prouve"), and the free-text conclusions that used to trigger it
        // are gone. A fixture that could not produce a finding would make every peer-review test pass
        // by having nothing to review.
        claim: index === 1
            ? { en: 'The evidence proves a bounded result.', fr: 'Les preuves prouvent un résultat délimité.' }
            : { en: `The observations support a bounded conclusion (${index}).`, fr: `Les observations étayent une conclusion délimitée (${index}).` },
        limitation: { en: `The observations leave alternative explanations open (${index}).`, fr: `Les observations laissent ouvertes d'autres explications (${index}).` },
        supportPredicate: { kind: 'minimum-runs', count: 1 }
    })),
    id: 'young-interference',
    prediction: { required: true },
    requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'source-1', displayName: 'Source one', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'source-2', displayName: 'Source two', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ],
    experiment: { modelVersion: 'young-observation-v1' }
} as CaseDefinition;

/** @param screenDistanceM Varied so a pair of runs can be *significant*, not merely two. */
const run = (id: string, screenDistanceM = 2) => {
    const result = createRunRecord({
        id, caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM },
        result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: '2026-08-04T12:00:00.000Z', experimentModelVersion: 'young-observation-v1'
    });
    if (!result.ok) throw new Error('Fixture run must be valid.');
    return result.value;
};

describe('theory board store transitions', () => {
    it('keeps one frozen authoritative draft and rejects invalid support without notification', () => {
        const store = createStore(createInitialAppState(definition));
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });

        expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'unknown' })).toMatchObject({ ok: false, error: { code: 'unknown-theory-run' } });
        expect(notifications).toBe(0);
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'run.record', record: run('run-1') });
        expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'theory.supportRunSelected', runId: 'run-1' })).toMatchObject({ ok: false, error: { code: 'duplicate-theory-run' } });
        expect(selectTheoryBoardDraft(store.getState()).selectedRunIds).toEqual(['run-1']);
        expect(Object.isFrozen(store.getState().theory)).toBe(true);
        expect(Object.isFrozen(selectTheoryBoardDraft(store.getState()).selectedRunIds)).toBe(true);
    });

    /**
     * A refused review request changes nothing — not the draft, not the evidence, not the subscribers.
     *
     * The draft used to be seeded with a free-text `theory.conclusionSet` from the `context` phase.
     * `theory.conclusionProposalChosen` is gated on `synthesis`/`review`, so the store now reaches
     * synthesis first — which means the incompleteness has to come from somewhere the phase gate does
     * not already cover. It comes from the support pins and the comparison note, which is what
     * `evaluateConclusionReadiness` actually reads and what the player is missing at that moment.
     */
    it('retains draft and evidence after a recoverable incomplete review request', () => {
        const store = createStore(createInitialAppState(definition));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'run.record', record: run('run-1') });
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });
        store.dispatch({ type: 'run.record', record: run('run-2', 3) });
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' })).toEqual({ ok: true, value: undefined });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });
        const before = store.getState();

        expect(store.dispatch({ type: 'theory.reviewRequested' })).toMatchObject({ ok: false, error: { code: 'conclusion-not-ready' } });
        expect(store.getState()).toBe(before);
        expect(selectTheoryBoardDraft(store.getState()).conclusion).toBe(definition.conclusionProposals[0].claim.en);
        expect(selectConclusionReadiness(store.getState()).status).toBe('incomplete');
        expect(notifications).toBe(0);
    });

    it('uses only the adjacent domain transition for a ready synthesis-to-review request', () => {
        const store = createStore(createInitialAppState(definition));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-04T12:00:00.000Z' });
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-04T12:01:00.000Z' });
        ['run-1', 'run-2'].forEach((id) => store.dispatch({ type: 'comparison.runSelected', runId: id }));
        store.dispatch({ type: 'comparison.noteSaved', note: 'The recorded spacing differs across configurations.' });
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }));

        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' })).toEqual({ ok: true, value: undefined });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
        expect(selectCasePhase(store.getState())).toBe('review');
    });
});
