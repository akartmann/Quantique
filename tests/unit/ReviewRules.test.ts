import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectConsultation, selectDecisionHistory, selectPeerReview } from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { selectConsultation as chooseConsultation } from '../../src/domain/review/ConsultationRule';
import { evaluatePeerReview } from '../../src/domain/review/peerReviewRules';
import { createTheoryBoardDraft } from '../../src/domain/theory/conclusionReadiness';
import { createRunRecord } from '../../src/domain/evidence/RunRecord';

const definition = {
    id: 'young-interference', requirements: { minimumRuns: 2, minimumSources: 2 },
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'source-1', displayName: 'Source one', creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' },
        { id: 'source-2', displayName: 'Source two', creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: 'Evidence.' }
    ],
    consultationRules: [
        { id: 'run', predicate: { kind: 'missing-run' }, layers: { observation: 'Observe.', plainLanguage: 'Run.', technicalDetail: 'Control.' }, nextStep: 'Record a run.' },
        { id: 'source', predicate: { kind: 'missing-source', sourceId: 'source-1' }, layers: { observation: 'Source.', plainLanguage: 'Inspect.', technicalDetail: 'Provenance.' }, nextStep: 'Inspect source.' },
        { id: 'test', predicate: { kind: 'alternative-test', controlId: 'screenDistanceM' }, layers: { observation: 'Same setting.', plainLanguage: 'Change setting.', technicalDetail: 'Bounded.' }, nextStep: 'Change control.' },
        { id: 'limit', predicate: { kind: 'missing-limitation' }, layers: { observation: 'No limit.', plainLanguage: 'Limit.', technicalDetail: 'Bounded.' }, nextStep: 'Add limitation.' }
    ],
    peerReviewRules: [
        { id: 'missing', predicate: { kind: 'missing-evidence' }, feedback: 'Evidence is incomplete.', revisionPath: 'Select evidence.' },
        { id: 'unsupported', predicate: { kind: 'unsupported-support' }, feedback: 'Support is unavailable.', revisionPath: 'Use current support.' },
        { id: 'overreach', predicate: { kind: 'overreach', overreachPhrases: ['proves'] }, feedback: 'Bound the claim.', revisionPath: 'Revise wording.' }
    ],
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

const run = (id: string, screenDistanceM = 2) => {
    const result = createRunRecord({ id, caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM }, result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: '2026-08-04T12:00:00.000Z', experimentModelVersion: 'young-v1' });
    if (!result.ok) throw new Error('fixture must be valid');
    return result.value;
};

describe('authored consultation and peer-review rules', () => {
    it('chooses the first eligible authored consultation and freezes its bounded projection', () => {
        const first = chooseConsultation(definition.consultationRules, { runs: [], inspectedSourceIds: [], theory: createTheoryBoardDraft() });
        expect(first).toMatchObject({ ruleId: 'run', nextStep: 'Record a run.' });
        expect(Object.isFrozen(first)).toBe(true);
        const next = chooseConsultation(definition.consultationRules, { runs: [run('one'), run('two')], inspectedSourceIds: [], theory: createTheoryBoardDraft() });
        expect(next).toMatchObject({ ruleId: 'source' });
        const alternative = chooseConsultation(definition.consultationRules, { runs: [run('one'), run('two')], inspectedSourceIds: ['source-1'], theory: createTheoryBoardDraft() });
        expect(alternative).toMatchObject({ ruleId: 'test' });
    });

    it('returns neutral issue codes without reproducing the learner conclusion', () => {
        const draft = { ...createTheoryBoardDraft(), conclusion: 'This proves the result.' };
        const review = evaluatePeerReview(definition, { runs: [], inspectedSourceIds: [] }, draft);
        expect(review.status).toBe('reviewed');
        if (review.status !== 'reviewed') throw new Error('valid rules must produce a review');
        expect(review.issues.map((issue) => issue.code)).toEqual(['missing-evidence', 'overreach']);
        expect(JSON.stringify(review)).not.toContain(draft.conclusion);
        expect(Object.isFrozen(review.issues)).toBe(true);
    });

    it('handles unsupported support, unavailable rules, and boundary-aware overreach checks', () => {
        const unsupportedDraft = { ...createTheoryBoardDraft(), selectedRunIds: ['missing-run'] };
        const unsupported = evaluatePeerReview(definition, { runs: [], inspectedSourceIds: [] }, unsupportedDraft);
        expect(unsupported).toMatchObject({ status: 'reviewed', issues: [{ code: 'missing-evidence' }, { code: 'unsupported-support' }] });

        const incidentalPhrase = evaluatePeerReview(definition, { runs: [], inspectedSourceIds: [] }, { ...createTheoryBoardDraft(), conclusion: 'The apparatus improves when adjusted.' });
        expect(incidentalPhrase.status).toBe('reviewed');
        if (incidentalPhrase.status === 'reviewed') expect(incidentalPhrase.issues.map((issue) => issue.code)).not.toContain('overreach');

        const unavailable = evaluatePeerReview({ ...definition, peerReviewRules: [] }, { runs: [], inspectedSourceIds: [] }, createTheoryBoardDraft());
        expect(unavailable).toMatchObject({ status: 'unavailable', message: expect.any(String) });
    });

    it('keeps rejected requests immutable and appends frozen revision snapshots', () => {
        const store = createStore(createInitialAppState(definition));
        let notifications = 0;
        store.subscribe(() => { notifications += 1; });
        const before = store.getState();
        expect(store.dispatch({ type: 'peerReview.requested' })).toMatchObject({ ok: false, error: { code: 'peer-review-unavailable' } });
        expect(store.getState()).toBe(before);
        expect(notifications).toBe(0);
        expect(store.dispatch({ type: 'consultation.requested' })).toEqual({ ok: true, value: undefined });
        expect(selectConsultation(store.getState())?.ruleId).toBe('run');
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        expect(selectConsultation(store.getState())).toBeUndefined();
        [run('one'), run('two', 3)].forEach((record) => store.dispatch({ type: 'run.record', record }));
        ['one', 'two'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }));
        store.dispatch({ type: 'theory.conclusionSet', conclusion: 'The evidence proves a bounded result.' });
        store.dispatch({ type: 'theory.limitationSet', limitation: 'Other explanations remain possible.' });
        ['prediction', 'experiment', 'synthesis'].forEach((nextPhase) => store.dispatch({ type: 'case.phaseAdvance', nextPhase }));
        store.dispatch({ type: 'theory.reviewRequested' });
        expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });
        const peerReview = selectPeerReview(store.getState());
        expect(peerReview?.status).toBe('reviewed');
        if (peerReview?.status === 'reviewed') expect(peerReview.issues[0]?.code).toBe('overreach');
        expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-02-30T25:99:99.000Z' })).toMatchObject({ ok: false, error: { code: 'invalid-revision-timestamp' } });
        expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-08-04T13:00:00.000Z' })).toEqual({ ok: true, value: undefined });
        expect(selectPeerReview(store.getState())).toBeUndefined();
        expect(store.dispatch({ type: 'revision.saved', timestamp: '2026-08-04T14:00:00.000Z' })).toMatchObject({ ok: false, error: { code: 'revision-review-required' } });
        const history = selectDecisionHistory(store.getState());
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({ version: 1, priorConclusion: '', conclusion: 'The evidence proves a bounded result.' });
        expect(Object.isFrozen(history[0])).toBe(true);
        store.dispatch({ type: 'theory.conclusionSet', conclusion: 'A revised, bounded statement.' });
        expect(history[0].conclusion).toBe('The evidence proves a bounded result.');
    });
});
