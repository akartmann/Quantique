import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectConsultation, selectDecisionHistory, selectLocalizedPeerReview, selectPeerReview } from '../../src/core/store/selectors';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { CANONICAL_UNAVAILABLE_MESSAGE } from '../../src/domain/review/peerReviewRules';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { selectConsultation as chooseConsultation } from '../../src/domain/review/ConsultationRule';
import { evaluatePeerReview } from '../../src/domain/review/peerReviewRules';
import { createTheoryBoardDraft } from '../../src/domain/theory/conclusionReadiness';
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
    id: 'young-interference', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: { en: 'Slit spacing', fr: 'Slit spacing [fr]' }, unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: { en: 'Screen distance', fr: 'Screen distance [fr]' }, unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'source-1', displayName: { en: 'Source one', fr: 'Source one [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } },
        { id: 'source-2', displayName: { en: 'Source two', fr: 'Source two [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } }
    ],
    consultationRules: [
        { id: 'run', predicate: { kind: 'missing-run' }, layers: { observation: { en: 'Observe.', fr: 'Observe. [fr]' }, plainLanguage: { en: 'Run.', fr: 'Run. [fr]' }, technicalDetail: { en: 'Control.', fr: 'Control. [fr]' } }, nextStep: { en: 'Record a run.', fr: 'Record a run. [fr]' } },
        { id: 'source', predicate: { kind: 'missing-source', sourceId: 'source-1' }, layers: { observation: { en: 'Source.', fr: 'Source. [fr]' }, plainLanguage: { en: 'Inspect.', fr: 'Inspect. [fr]' }, technicalDetail: { en: 'Provenance.', fr: 'Provenance. [fr]' } }, nextStep: { en: 'Inspect source.', fr: 'Inspect source. [fr]' } },
        { id: 'test', predicate: { kind: 'alternative-test', controlId: 'screenDistanceM' }, layers: { observation: { en: 'Same setting.', fr: 'Same setting. [fr]' }, plainLanguage: { en: 'Change setting.', fr: 'Change setting. [fr]' }, technicalDetail: { en: 'Bounded.', fr: 'Bounded. [fr]' } }, nextStep: { en: 'Change control.', fr: 'Change control. [fr]' } },
        { id: 'limit', predicate: { kind: 'missing-limitation' }, layers: { observation: { en: 'No limit.', fr: 'No limit. [fr]' }, plainLanguage: { en: 'Limit.', fr: 'Limit. [fr]' }, technicalDetail: { en: 'Bounded.', fr: 'Bounded. [fr]' } }, nextStep: { en: 'Add limitation.', fr: 'Add limitation. [fr]' } }
    ],
    peerReviewRules: [
        { id: 'missing', predicate: { kind: 'missing-evidence' }, feedback: { en: 'Evidence is incomplete.', fr: 'Evidence is incomplete. [fr]' }, revisionPath: { en: 'Select evidence.', fr: 'Select evidence. [fr]' } },
        { id: 'unsupported', predicate: { kind: 'unsupported-support' }, feedback: { en: 'Support is unavailable.', fr: 'Support is unavailable. [fr]' }, revisionPath: { en: 'Use current support.', fr: 'Use current support. [fr]' } },
        { id: 'overreach', predicate: { kind: 'overreach', overreachPhrases: { en: ['proves'], fr: ['prouve'] } }, feedback: { en: 'Bound the claim.', fr: 'Bound the claim. [fr]' }, revisionPath: { en: 'Revise wording.', fr: 'Revise wording. [fr]' } }
    ],
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

const run = (id: string, screenDistanceM = 2) => {
    const result = createRunRecord({ id, caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM }, result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: '2026-08-04T12:00:00.000Z', experimentModelVersion: 'young-v1' }, runControlContract(definition));
    if (!result.ok) throw new Error('fixture must be valid');
    return result.value;
};

describe('authored consultation and peer-review rules', () => {
    it('chooses the first eligible authored consultation and freezes its bounded projection', () => {
        const first = chooseConsultation(definition.consultationRules, { runs: [], inspectedSourceIds: [], theory: createTheoryBoardDraft() });
        expect(first).toMatchObject({ ruleId: 'run', nextStep: { en: 'Record a run.', fr: 'Record a run. [fr]' } });
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

    // Detection matches the union of both locales' phrases regardless of the active language, so the
    // recomputation that validates a saved record cannot depend on which language it was saved in.
    it('detects overreach in either language and emits identical, canonical issues', () => {
        const english = evaluatePeerReview(definition, { runs: [], inspectedSourceIds: [] },
            { ...createTheoryBoardDraft(), conclusion: 'This proves the wave account.' });
        const french = evaluatePeerReview(definition, { runs: [], inspectedSourceIds: [] },
            { ...createTheoryBoardDraft(), conclusion: 'Cela prouve la thèse ondulatoire.' });

        expect(english).toEqual(french);
        expect(english).toMatchObject({
            status: 'reviewed',
            // Canonical English feedback in both cases: this value is persisted and re-compared.
            issues: [{ code: 'missing-evidence', feedback: 'Evidence is incomplete.' }, { code: 'overreach', feedback: 'Bound the claim.' }]
        });
    });

    // French inflects where English does not. `prouvent` is the form every natural plural subject
    // here takes ("ces observations", "les mesures"), and missing it would leave the learner credited
    // with a calibrated conclusion for an overreaching one.
    it('detects the French plural inflection, not just the singular', () => {
        const inflected = { ...definition, peerReviewRules: definition.peerReviewRules.map((rule) => (rule.predicate.kind === 'overreach'
            ? { ...rule, predicate: { ...rule.predicate, overreachPhrases: { en: ['proves'], fr: ['prouve', 'prouvent'] } } }
            : rule)) };

        const review = evaluatePeerReview(inflected, { runs: [], inspectedSourceIds: [] },
            { ...createTheoryBoardDraft(), conclusion: 'Ces observations prouvent que la lumière est une onde.' });

        expect(review.status).toBe('reviewed');
        if (review.status === 'reviewed') expect(review.issues.map((issue) => issue.code)).toContain('overreach');
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
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'experiment.run', id: 'one', timestamp: '2026-08-04T12:00:00.000Z' });
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'dom' });
        store.dispatch({ type: 'experiment.run', id: 'two', timestamp: '2026-08-04T12:01:00.000Z' });
        ['one', 'two'].forEach((id) => store.dispatch({ type: 'comparison.runSelected', runId: id }));
        store.dispatch({ type: 'comparison.noteSaved', note: 'The recorded spacing differs across configurations.' });
        ['one', 'two'].forEach((runId) => store.dispatch({ type: 'theory.supportRunSelected', runId }));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'theory.supportSourceSelected', sourceId }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[1].id });
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
        expect(history[0]).toMatchObject({ version: 1, priorConclusion: '', conclusion: definition.conclusionProposals[1].claim.en });
        expect(Object.isFrozen(history[0])).toBe(true);
        // A later choice must not reach back into the frozen snapshot the revision already made.
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        expect(history[0].conclusion).toBe(definition.conclusionProposals[1].claim.en);
    });
});

/**
 * The peer-review projection the case file reads (Story 2.11, D3).
 *
 * `PeerReviewIssue.feedback` and `.revisionPath` are canonical `.en` **by contract**: they are
 * persisted inside `DecisionHistoryEntry.feedback` and recomputed-and-string-compared on load by
 * `validateCaseRecordForDefinition`, so emitting the active locale would reject every record saved in
 * the other language. The retired `ConclusionReviewPanel` rendered them straight to the player, which
 * is this project's most-repeated defect one layer down.
 *
 * Asserted **against a French store**, because that is the only place the two can be told apart: in
 * English the authored string and the canonical one are the same text, so a projection passing
 * `issue.feedback` through would look correct.
 */
describe('the localized peer-review projection', () => {
    const reviewedFrenchStore = () => {
        const store = createStore(createInitialAppState(definition, 'fr'));
        ['source-1', 'source-2'].forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
        store.dispatch({ type: 'experiment.run', id: 'one', timestamp: '2026-08-04T12:00:00.000Z' });
        // A second observation at a **different** throw: the significant-measure gate reads a repeat
        // at one setting as a replication and correctly holds `experiment → synthesis` shut.
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'screenDistanceM', value: 3, origin: 'phaser' });
        store.dispatch({ type: 'experiment.run', id: 'two', timestamp: '2026-08-04T12:01:00.000Z' });
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' })).toEqual({ ok: true, value: undefined });
        store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0].id });
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'review' });
        expect(store.dispatch({ type: 'peerReview.requested' })).toEqual({ ok: true, value: undefined });
        return store;
    };

    it('resolves each finding by ruleId to the authored French, and never returns the canonical English', () => {
        const store = reviewedFrenchStore();
        const raw = selectPeerReview(store.getState());
        const projected = selectLocalizedPeerReview(store.getState());

        expect(raw?.status).toBe('reviewed');
        expect(projected?.status).toBe('reviewed');
        if (raw?.status !== 'reviewed' || projected?.status !== 'reviewed') throw new Error('the fixture must produce findings');
        expect(raw.issues.length).toBeGreaterThan(0);
        expect(projected.issues).toHaveLength(raw.issues.length);

        projected.issues.forEach((issue, index) => {
            const rule = definition.peerReviewRules.find(({ id }) => id === issue.ruleId)!;
            expect(issue.ruleId).toBe(raw.issues[index].ruleId);
            expect(issue.feedback).toBe(rule.feedback.fr);
            expect(issue.revisionPath).toBe(rule.revisionPath.fr);
            // The canonical `.en` is what the record persists, and it must not be what a player reads.
            expect(issue.feedback).not.toBe(raw.issues[index].feedback);
            expect(issue.revisionPath).not.toBe(raw.issues[index].revisionPath);
        });
    });

    /**
     * A `ruleId` the case no longer authors falls back to the canonical `.en`.
     *
     * That is the one place it is the right answer: the alternative is dropping a finding the player's
     * revision was judged against, and silence about a finding is worse than an untranslated one.
     */
    it('falls back to the canonical English for a rule this build no longer authors', () => {
        const store = reviewedFrenchStore();
        const raw = selectPeerReview(store.getState());
        if (raw?.status !== 'reviewed') throw new Error('the fixture must produce findings');

        const degraded = {
            ...store.getState(),
            caseDefinition: { ...definition, peerReviewRules: [] } as CaseDefinition
        };
        const projected = selectLocalizedPeerReview(degraded);
        if (projected?.status !== 'reviewed') throw new Error('the projection must survive degraded content');

        expect(projected.issues).toHaveLength(raw.issues.length);
        expect(projected.issues[0].feedback).toBe(raw.issues[0].feedback);
    });

    /**
     * `status: 'unavailable'` resolves the existing `review.unavailable` key rather than the
     * projection's own `message`, which is `CANONICAL_UNAVAILABLE_MESSAGE` and English by contract.
     */
    it('localizes the unavailable status rather than echoing the canonical message', () => {
        // A case authoring no evaluable rule at all, which is what `hasEvaluableRules` answers with
        // `unavailable`. Reached by projecting a degraded definition onto a state that is already in
        // `review`, rather than by walking a second full investigation to get there.
        const store = reviewedFrenchStore();
        const degraded = {
            ...store.getState(),
            caseDefinition: { ...definition, peerReviewRules: [] } as CaseDefinition,
            peerReview: { status: 'unavailable' as const, message: CANONICAL_UNAVAILABLE_MESSAGE }
        };

        const projected = selectLocalizedPeerReview(degraded);
        expect(projected?.status).toBe('unavailable');
        if (projected?.status !== 'unavailable') throw new Error('the fixture must be unavailable');
        expect(projected.message).toBe(fr['review.unavailable']);
        expect(projected.message).not.toBe(CANONICAL_UNAVAILABLE_MESSAGE);
        // And the two are kept in sync by convention, which is worth one assertion.
        expect(en['review.unavailable']).toBe(CANONICAL_UNAVAILABLE_MESSAGE);
    });

    it('returns nothing at all when no feedback has been asked for', () => {
        const store = createStore(createInitialAppState(definition, 'fr'));
        expect(selectLocalizedPeerReview(store.getState())).toBeUndefined();
    });
});
