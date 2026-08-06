import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectDecisionHistory, selectPeerReview } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

const definition = {
    id: 'young-interference', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    apparatus: { primaryControls: [{ id: 'slitSpacingMm', label: { en: 'Spacing', fr: 'Spacing [fr]' }, unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 }, { id: 'screenDistanceM', label: { en: 'Distance', fr: 'Distance [fr]' }, unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }] },
    contextualArtifacts: [{ id: 'source-1', displayName: { en: 'Source one', fr: 'Source one [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } }, { id: 'source-2', displayName: { en: 'Source two', fr: 'Source two [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } }],
    consultationRules: [{ id: 'run', predicate: { kind: 'missing-run' }, layers: { observation: { en: 'Observe.', fr: 'Observe. [fr]' }, plainLanguage: { en: 'Run.', fr: 'Run. [fr]' }, technicalDetail: { en: 'Control.', fr: 'Control. [fr]' } }, nextStep: { en: 'Record.', fr: 'Record. [fr]' } }, { id: 'source', predicate: { kind: 'missing-source', sourceId: 'source-1' }, layers: { observation: { en: 'Source.', fr: 'Source. [fr]' }, plainLanguage: { en: 'Inspect.', fr: 'Inspect. [fr]' }, technicalDetail: { en: 'Provenance.', fr: 'Provenance. [fr]' } }, nextStep: { en: 'Inspect.', fr: 'Inspect. [fr]' } }, { id: 'test', predicate: { kind: 'alternative-test', controlId: 'screenDistanceM' }, layers: { observation: { en: 'Same.', fr: 'Same. [fr]' }, plainLanguage: { en: 'Change.', fr: 'Change. [fr]' }, technicalDetail: { en: 'Bounded.', fr: 'Bounded. [fr]' } }, nextStep: { en: 'Change.', fr: 'Change. [fr]' } }, { id: 'limit', predicate: { kind: 'missing-limitation' }, layers: { observation: { en: 'Limit.', fr: 'Limit. [fr]' }, plainLanguage: { en: 'State.', fr: 'State. [fr]' }, technicalDetail: { en: 'Bounded.', fr: 'Bounded. [fr]' } }, nextStep: { en: 'Limit.', fr: 'Limit. [fr]' } }],
    peerReviewRules: [{ id: 'missing', predicate: { kind: 'missing-evidence' }, feedback: { en: 'More evidence.', fr: 'More evidence. [fr]' }, revisionPath: { en: 'Select.', fr: 'Select. [fr]' } }, { id: 'unsupported', predicate: { kind: 'unsupported-support' }, feedback: { en: 'Unavailable.', fr: 'Unavailable. [fr]' }, revisionPath: { en: 'Replace.', fr: 'Replace. [fr]' } }, { id: 'overreach', predicate: { kind: 'overreach', overreachPhrases: { en: ['proves'], fr: ['prouve'] } }, feedback: { en: 'Bound claim.', fr: 'Bound claim. [fr]' }, revisionPath: { en: 'Revise.', fr: 'Revise. [fr]' } }],
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

describe('consultation, peer review, and revision public flow', () => {
    it('retains authoritative evidence and appends an inspectable reviewed snapshot', () => {
        const store = createStore(createInitialAppState(definition));
        store.dispatch({ type: 'consultation.requested' });
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.recorded', prediction: 'A tentative pattern may appear.' });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'experiment.run', id: 'run-1', timestamp: '2026-08-04T12:00:00.000Z' });
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });
        store.dispatch({ type: 'experiment.run', id: 'run-2', timestamp: '2026-08-04T12:01:00.000Z' });
        const [first, second] = store.getState().runs;
        if (!first || !second) throw new Error('Physical fixture observations must be recorded.');
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-1' });
        store.dispatch({ type: 'comparison.runSelected', runId: 'run-2' });
        store.dispatch({ type: 'comparison.noteSaved', note: 'The recorded spacing differs across these configurations.' });
        ['run-1', 'run-2'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }));
        store.dispatch({ type: 'theory.conclusionSet', conclusion: 'This proves a conclusion.' });
        store.dispatch({ type: 'theory.limitationSet', limitation: 'Alternatives remain possible.' });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
        expect(store.dispatch({ type: 'theory.reviewRequested' })).toEqual({ ok: true, value: undefined });
        expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });
        const peerReview = selectPeerReview(store.getState());
        expect(peerReview?.status).toBe('reviewed');
        if (peerReview?.status === 'reviewed') expect(peerReview.issues.map((issue) => issue.code)).toEqual(['overreach']);
        expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-08-04T13:00:00.000Z' })).toEqual({ ok: true, value: undefined });
        expect(store.getState().runs).toEqual([first, second]);
        expect(store.getState().comparison.selectedRunIds).toEqual(['run-1', 'run-2']);
        expect(selectDecisionHistory(store.getState())[0]).toMatchObject({ version: 1, selectedRunIds: ['run-1', 'run-2'], selectedSourceIds: ['source-1', 'source-2'] });
    });
});
