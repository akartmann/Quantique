import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectComparisonNote, selectNotebookObservations, selectSelectedComparisonPair } from '../../src/core/store/selectors';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

const caseDefinition = {
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
    contextualArtifacts: [],
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    experiment: { modelVersion: 'young-observation-v1' }
} as CaseDefinition;

const fixtureRun = (id: string, controls: { slitSpacingMm: number; screenDistanceM: number }, value: number) => {
    const created = createRunRecord({
        id,
        caseId: 'young-interference',
        controls,
        result: { label: 'Prepared observation', value, unit: 'relative units' },
        timestamp: `2026-08-04T10:20:0${value}.000Z`,
        experimentModelVersion: 'young-observation-v1',
        linkedEvidenceIds: []
    });
    if (!created.ok) throw new Error('Fixture run must be valid.');
    return created.value;
};

describe('measurement notebook public store projection', () => {
    it('projects saved evidence and its pair note without recalculating historical values', () => {
        const store = createStore(createInitialAppState(caseDefinition));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: caseDefinition.predictionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        const first = fixtureRun('run-001', { slitSpacingMm: 0.25, screenDistanceM: 2 }, 1);
        const second = fixtureRun('run-002', { slitSpacingMm: 0.3, screenDistanceM: 2.5 }, 2);
        store.dispatch({ type: 'run.record', record: first });
        store.dispatch({ type: 'run.record', record: second });

        store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.5, origin: 'dom' });
        expect(selectNotebookObservations(store.getState())).toMatchObject([
            { controls: { slitSpacingMm: 0.25, screenDistanceM: 2 }, result: { value: 1 }, experimentModelVersion: 'young-observation-v1' },
            { controls: { slitSpacingMm: 0.3, screenDistanceM: 2.5 }, result: { value: 2 }, experimentModelVersion: 'young-observation-v1' }
        ]);

        store.dispatch({ type: 'comparison.runSelected', runId: first.id });
        store.dispatch({ type: 'comparison.runSelected', runId: second.id });
        expect(selectSelectedComparisonPair(store.getState())).toEqual([first, second]);
        expect(store.dispatch({ type: 'comparison.noteSaved', note: 'Compare the two recorded values.' })).toEqual({ ok: true, value: undefined });
        expect(selectComparisonNote(store.getState())).toMatchObject({ text: 'Compare the two recorded values.' });
    });
});
