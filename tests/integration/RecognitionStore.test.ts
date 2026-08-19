import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectRecognition } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createRunRecord, runControlContract } from '../../src/domain/evidence/RunRecord';

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
    contextualArtifacts: [
        { id: 'source-1', displayName: 'Source one', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'source-2', displayName: 'Source two', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ],
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    experiment: { modelId: 'young-double-slit', modelVersion: 'young-v1' }
} as CaseDefinition;

const record = (id: string, screenDistanceM: number) => {
    const created = createRunRecord({
        id, caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM },
        result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: `2026-08-05T10:00:0${id.at(-1)}.000Z`,
        experimentModelVersion: 'young-v1', linkedEvidenceIds: ['source-1', 'source-2']
    }, runControlContract(definition));
    if (!created.ok) throw new Error('Fixture run must be valid.');
    return created.value;
};

describe('inquiry recognition store projection', () => {
    it('recomputes recognition only for successful authoritative transitions without changing case authority', () => {
        const store = createStore(createInitialAppState(definition));
        const initialPhase = store.getState().phase;
        const initialHistory = store.getState().decisionHistory;

        store.dispatch({ type: 'source.inspected', sourceId: 'source-1' });
        store.dispatch({ type: 'source.inspected', sourceId: 'source-2' });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'run.record', record: record('run-1', 2) });
        store.dispatch({ type: 'run.record', record: record('run-2', 2) });
        // `run-3` varies the screen distance, so the bench varies with it. Since Story 3.2 the
        // bench-match check applies to every run rather than only to runs carrying Young's model
        // inputs — which is what `variable-curiosity` is recognising in the first place.
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });
        store.dispatch({ type: 'run.record', record: record('run-3', 3) });

        expect(selectRecognition(store.getState()).items.map(({ id, achieved }) => [id, achieved])).toEqual([
            ['source-discipline', true], ['replication', true], ['variable-curiosity', true], ['calibrated-conclusion', false]
        ]);
        expect(store.getState().phase).toBe('experiment');
        expect(store.getState().decisionHistory).toEqual(initialHistory);
        const recognition = store.getState().recognition;
        expect(store.dispatch({ type: 'source.inspected', sourceId: 'source-2' })).toMatchObject({ ok: false, error: { code: 'duplicate-inspected-source' } });
        expect(store.getState().recognition).toBe(recognition);
    });
});
