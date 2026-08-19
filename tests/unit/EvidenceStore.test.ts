import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import {
    selectComparisonNote,
    selectContextualArtifacts,
    selectInspectedSourceIds,
    selectNotebookObservations,
    selectSelectedComparisonPair,
    selectSourceLabel
} from '../../src/core/store/selectors';
import { createRunRecord, runControlContract } from '../../src/domain/evidence/RunRecord';
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
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: { en: 'Slit spacing', fr: 'Slit spacing [fr]' }, unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: { en: 'Screen distance', fr: 'Screen distance [fr]' }, unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    contextualArtifacts: [
        {
            id: 'young-lecture-1801',
            displayName: { en: 'Young lecture record', fr: 'Young lecture record [fr]' },
            creatorOrOrigin: 'Thomas Young',
            sourceType: 'lecture-record',
            provenance: { category: 'primary-material', reference: 'young-1801-lecture' },
            rightsStatus: 'reviewed',
            caseRelationship: { en: 'A contemporary account of the Young investigation.', fr: 'A contemporary account of the Young investigation. [fr]' }
        },
        {
            id: 'unavailable-source',
            displayName: { en: 'Unavailable contextual record', fr: 'Unavailable contextual record [fr]' },
            creatorOrOrigin: 'Collection record',
            sourceType: 'interpretive-essay',
            provenance: { category: 'later-interpretation', reference: 'collection-placeholder' },
            rightsStatus: 'reviewed',
            caseRelationship: { en: 'A contextual item that cannot be treated as verified evidence.', fr: 'A contextual item that cannot be treated as verified evidence. [fr]' }
        }
    ],
    experiment: { modelId: 'young-double-slit', modelVersion: 'young-observation-v1' }
} as CaseDefinition;

const createRecord = (id: string, value: number) => {
    const result = createRunRecord({
        id,
        caseId: 'young-interference',
        controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
        result: { label: 'Observed fringe spacing', value, unit: 'mm' },
        timestamp: `2026-08-04T10:15:0${value}.000Z`,
        experimentModelVersion: 'young-observation-v1'
    }, runControlContract(caseDefinition));
    if (!result.ok) throw new Error('Fixture run must be valid.');
    return result.value;
};

const enterExperiment = (store: ReturnType<typeof createStore>): void => {
    store.dispatch({ type: 'source.inspected', sourceId: 'young-lecture-1801' });
    store.dispatch({ type: 'source.inspected', sourceId: 'unavailable-source' });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: caseDefinition.predictionProposals[0].id });
    store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
};

describe('evidence store transitions', () => {
    it('records only reviewed declared source IDs as immutable authoritative evidence', () => {
        const store = createStore(createInitialAppState(caseDefinition));
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });

        expect(selectContextualArtifacts(store.getState())).toHaveLength(2);
        expect(selectInspectedSourceIds(store.getState())).toEqual([]);
        expect(store.dispatch({ type: 'source.inspected', sourceId: 'young-lecture-1801' })).toEqual({ ok: true, value: undefined });
        expect(selectInspectedSourceIds(store.getState())).toEqual(['young-lecture-1801']);
        expect(selectSourceLabel(store.getState(), 'young-lecture-1801')).toBe('Young lecture record');
        expect(Object.isFrozen(store.getState().inspectedSourceIds)).toBe(true);

        expect(store.dispatch({ type: 'source.inspected', sourceId: 'unknown-source' })).toMatchObject({
            ok: false, error: { code: 'unknown-source-id' }
        });
        expect(store.dispatch({ type: 'source.inspected', sourceId: 'young-lecture-1801' })).toMatchObject({
            ok: false, error: { code: 'duplicate-inspected-source' }
        });
        expect(store.dispatch({ type: 'source.inspected', sourceId: 'unavailable-source' })).toEqual({ ok: true, value: undefined });
        expect(selectInspectedSourceIds(store.getState())).toEqual(['young-lecture-1801', 'unavailable-source']);
        expect(notifications).toBe(2);
    });

    it('rejects a run that links evidence not inspected in the current state', () => {
        const store = createStore(createInitialAppState(caseDefinition));
        enterExperiment(store);
        const record = createRunRecord({
            id: 'uninspected-evidence-run',
            caseId: 'young-interference',
            controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
            result: { label: 'Observed fringe spacing', value: 1, unit: 'mm' },
            timestamp: '2026-08-04T10:15:01.000Z',
            experimentModelVersion: 'young-observation-v1',
            linkedEvidenceIds: ['uninspected-source']
        }, runControlContract(caseDefinition));
        if (!record.ok) throw new Error('Fixture run must be valid.');
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });

        expect(store.dispatch({ type: 'run.record', record: record.value })).toMatchObject({
            ok: false, error: { code: 'uninspected-linked-evidence' }
        });
        expect(selectNotebookObservations(store.getState())).toEqual([]);
        expect(notifications).toBe(0);
    });

    it('records ordered immutable observations and never notifies on a rejected duplicate', () => {
        const store = createStore(createInitialAppState(caseDefinition));
        enterExperiment(store);
        const first = createRecord('run-001', 1);
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });

        expect(store.dispatch({ type: 'run.record', record: first })).toEqual({ ok: true, value: undefined });
        expect(selectNotebookObservations(store.getState())).toEqual([first]);
        expect(Object.isFrozen(store.getState().runs)).toBe(true);
        expect(store.dispatch({ type: 'run.record', record: first })).toMatchObject({
            ok: false, error: { code: 'duplicate-run-id' }
        });
        expect(notifications).toBe(1);
        expect(selectNotebookObservations(store.getState())).toEqual([first]);
    });

    it('rejects evidence from a different investigation without notifying subscribers', () => {
        const store = createStore(createInitialAppState(caseDefinition));
        enterExperiment(store);
        const foreign = createRunRecord({
            id: 'foreign-run',
            caseId: 'another-investigation',
            controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
            result: { label: 'Observed fringe spacing', value: 1, unit: 'mm' },
            timestamp: '2026-08-04T10:15:01.000Z',
            experimentModelVersion: 'another-model'
        }, runControlContract(caseDefinition));
        if (!foreign.ok) throw new Error('Fixture run must be valid.');
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });

        expect(store.dispatch({ type: 'run.record', record: foreign.value })).toMatchObject({
            ok: false, error: { code: 'run-case-mismatch' }
        });
        expect(selectNotebookObservations(store.getState())).toEqual([]);
        expect(notifications).toBe(0);
    });

    it('allows any two distinct saved runs to be selected in selection order', () => {
        const store = createStore(createInitialAppState(caseDefinition));
        enterExperiment(store);
        const first = createRecord('run-001', 1);
        const second = createRecord('run-002', 2);
        const third = createRecord('run-003', 3);
        [first, second, third].forEach((record) => store.dispatch({ type: 'run.record', record }));

        expect(store.dispatch({ type: 'comparison.runSelected', runId: 'run-002' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'comparison.runSelected', runId: 'run-001' })).toEqual({ ok: true, value: undefined });
        expect(selectSelectedComparisonPair(store.getState())).toEqual([second, first]);
        expect(store.dispatch({ type: 'comparison.runSelected', runId: 'run-001' })).toMatchObject({
            ok: false, error: { code: 'duplicate-comparison-run' }
        });
        expect(store.dispatch({ type: 'comparison.runSelected', runId: 'run-003' })).toMatchObject({
            ok: false, error: { code: 'too-many-comparison-runs' }
        });

        expect(store.dispatch({ type: 'comparison.runUnselected', runId: 'run-002' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'comparison.runSelected', runId: 'run-003' })).toEqual({ ok: true, value: undefined });
        expect(selectSelectedComparisonPair(store.getState())).toEqual([first, third]);
    });

    it('associates notes only with the selected pair and preserves notes for other pairs', () => {
        const store = createStore(createInitialAppState(caseDefinition));
        enterExperiment(store);
        const first = createRecord('run-001', 1);
        const second = createRecord('run-002', 2);
        const third = createRecord('run-003', 3);
        [first, second, third].forEach((record) => store.dispatch({ type: 'run.record', record }));

        expect(store.dispatch({ type: 'comparison.noteSaved', note: 'Too early.' })).toMatchObject({
            ok: false, error: { code: 'comparison-pair-required' }
        });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-001' });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-002' });
        expect(store.dispatch({ type: 'comparison.noteSaved', note: 'First pair note.' })).toEqual({ ok: true, value: undefined });

        store.dispatch({ type: 'comparison.runUnselected', runId: 'run-002' });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-003' });
        expect(store.dispatch({ type: 'comparison.noteSaved', note: 'Second pair note.' })).toEqual({ ok: true, value: undefined });
        expect(selectComparisonNote(store.getState())).toMatchObject({ text: 'Second pair note.' });

        store.dispatch({ type: 'comparison.runUnselected', runId: 'run-003' });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-002' });
        expect(selectComparisonNote(store.getState())).toMatchObject({ text: 'First pair note.' });
    });

    it('keeps notes distinct when run IDs contain the former pair-key delimiter', () => {
        const store = createStore(createInitialAppState(caseDefinition));
        enterExperiment(store);
        const first = createRecord('a', 1);
        const second = createRecord('b::c', 2);
        const third = createRecord('a::b', 3);
        const fourth = createRecord('c', 4);
        [first, second, third, fourth].forEach((record) => store.dispatch({ type: 'run.record', record }));

        store.dispatch({ type: 'comparison.runSelected', runId: first.id });
        store.dispatch({ type: 'comparison.runSelected', runId: second.id });
        store.dispatch({ type: 'comparison.noteSaved', note: 'First distinct pair.' });
        store.dispatch({ type: 'comparison.runUnselected', runId: first.id });
        store.dispatch({ type: 'comparison.runUnselected', runId: second.id });
        store.dispatch({ type: 'comparison.runSelected', runId: third.id });
        store.dispatch({ type: 'comparison.runSelected', runId: fourth.id });
        store.dispatch({ type: 'comparison.noteSaved', note: 'Second distinct pair.' });
        store.dispatch({ type: 'comparison.runUnselected', runId: third.id });
        store.dispatch({ type: 'comparison.runUnselected', runId: fourth.id });
        store.dispatch({ type: 'comparison.runSelected', runId: first.id });
        store.dispatch({ type: 'comparison.runSelected', runId: second.id });

        expect(selectComparisonNote(store.getState())).toMatchObject({ text: 'First distinct pair.' });
    });
});
