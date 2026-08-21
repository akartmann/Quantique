import { beforeAll, describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { evaluatePeerReview } from '../../src/domain/review/peerReviewRules';
import { evaluateConclusionReadiness } from '../../src/domain/theory/conclusionReadiness';
import { selectDefensibleConclusionIds } from '../../src/domain/theory/conclusionProposals';
import { deriveRecognition } from '../../src/domain/recognition/recognitionRules';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { presentColleagueIds } from '../../src/adapters/phaser/renderers/characterStageView';
import { selectLocalizedPeerReview } from '../../src/core/store/selectors';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { loadMorleyMillerCase, loadShippedCases } from './shippedCases';
import { STABLE_WINDOW_C } from '../../src/domain/apparatus/calculateInterferometerDrift';
import { matchesOverreachPhrase } from '../../src/domain/review/peerReviewRules';
import { createCaseRecordProjection } from '../../src/core/store/CaseRecordProjection';
import { validateCaseRecordForDefinition } from '../../src/schemas/CaseRecordSchema';

/**
 * The Morley–Miller conclusion path, asserted against **the content that ships** (Story 4.3, AC1–AC3).
 *
 * ## Why this file exists at all
 *
 * `peer-overreach` is authored with ten detection phrases in two languages, is schema-validated, and
 * matched **none of this case's four conclusion claims**. It was shipped-and-dead content in the case
 * whose whole teaching is the refusal it was written for — and the suite could not see it, because every
 * overreach assertion in `ReviewRules.test.ts`, `ReviewFlow.test.ts` and `ConclusionProposals.test.ts`
 * is a *fixture* rule carrying `overreachPhrases: { en: ['proves'] }` against a *fixture* claim
 * containing the word "proves". A test that supplies both halves of the match proves the regex works and
 * says nothing about whether any authored content reaches it.
 *
 * So nothing below authors a phrase, a claim or a rule. Every string comes from `public/cases/`, through
 * `shippedCases.ts`, parsed by the real `CaseDefinitionSchema`.
 *
 * ## The NFR8 half, which is the one a player actually reads
 *
 * `deriveRecognition` awards `calibrated-conclusion` — *"A reviewed revision makes a bounded claim
 * without an overreach finding"* — to any reviewed revision whose `feedback.issues` is empty. While the
 * refusal could not fire, a player who concluded *"The ether does not exist, and this bench has settled
 * the matter…"* reached the debrief being told they had recorded a **calibrated conclusion**, and
 * `completion.recognition` persisted it. NFR8 forbids a reward for overclaiming by name. AC1 fixes the
 * cause; the recognition assertions here are what fail if the cause comes back.
 *
 * ## Real dispatches, not hand-built projections
 *
 * `MorleyMillerFeedback.test.ts` records why, and it applies unchanged: the two Young-shaped readiness
 * rules that shipped permanently unsatisfiable for this case were correct as functions and unreachable as
 * content, and every test that missed them handed the evaluator an object it had built itself. The
 * evidence here is reached by driving the real store from the real case, and the isolation that lets one
 * predicate be read at a time is a **property of the review phase** rather than a fixture: reaching
 * `review` requires full readiness, so `missing-evidence` and `unsupported-support` have nothing left to
 * report and `overreach` is the only rule that can still fire.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    definition = await loadMorleyMillerCase();
});

const proposal = (proposalId: string) => {
    const found = definition.conclusionProposals.find(({ id }) => id === proposalId);
    if (!found) throw new Error(`The case must author a ${proposalId} conclusion proposal.`);
    return found;
};

/**
 * The bath temperature the case's own `experiment.resetPath` teaches.
 *
 * Read from `calculateInterferometerDrift` rather than written as 20, and **not** taken from the
 * control's `defaultValue` (which is 22): the reset path's prose names the steady window ("20 °C, where
 * the warmth contributes nothing"), the model exports it as the point where the thermal term vanishes,
 * and `conclude-bounded-null`'s `unvaried-control-pinned` clause is the reason the two pinned runs have
 * to share it.
 *
 * This was the literal `20` until Story 4.3's review, under this same docstring naming the exact failure
 * a literal causes. If the authored steady window moves, `atReview()` would have gone on recording two
 * runs at a temperature the case no longer teaches, `unvaried-control-pinned` would still pass because
 * both runs share it, and the suite would stay green while claiming to assert the case's own path.
 */
const STEADY_BATH_C = STABLE_WINDOW_C;

let runSequence = 0;

/** One observation at the given settings, recorded the way the bench records it. */
const record = (store: AppStore, rotationDeg: number, bathTempC: number): string => {
    const rotation = store.dispatch({ type: 'apparatus.controlSet', controlId: 'rotationDeg', value: rotationDeg, origin: 'phaser' });
    if (!rotation.ok) throw new Error(`The bench refused rotationDeg=${rotationDeg}: ${rotation.error.code}`);
    const bath = store.dispatch({ type: 'apparatus.controlSet', controlId: 'bathTempC', value: bathTempC, origin: 'phaser' });
    if (!bath.ok) throw new Error(`The bench refused bathTempC=${bathTempC}: ${bath.error.code}`);
    runSequence += 1;
    const id = `run-${runSequence}`;
    // Minute *and* second, because this counter is module-level and never reset: every `atReview()` burns
    // two of it and this file already spends around forty. A single unbounded minute field reached
    // `09:60:00.000Z` — not an instant — after a handful more tests, which would have failed the suite for
    // a reason unrelated to anything under test. 3600 ordered timestamps is past any plausible growth.
    const minute = Math.floor(runSequence / 60) % 60;
    const second = runSequence % 60;
    const pad = (value: number): string => String(value).padStart(2, '0');
    const run = store.dispatch({
        type: 'experiment.run',
        id,
        timestamp: `2026-08-21T09:${pad(minute)}:${pad(second)}.000Z`
    });
    if (!run.ok) throw new Error(`The bench refused the run: ${run.error.code}`);
    return id;
};

/** The authored `overreach` rule, so a locale assertion can name its French prose without restating it. */
const resolveOverreachRule = () => {
    const rule = definition.peerReviewRules.find(({ predicate }) => predicate.kind === 'overreach');
    if (!rule) throw new Error('The case must author an overreach peer-review rule.');
    return rule;
};

const mustDispatch = (store: AppStore, action: Parameters<AppStore['dispatch']>[0], what: string): void => {
    const result = store.dispatch(action);
    if (!result.ok) throw new Error(`${what}: ${result.error.code} — ${result.error.message}`);
};

/**
 * A store standing in `review`, on the two observations the case's own reset path teaches.
 *
 * Two rotations at **one** bath temperature: `varied-control` on `rotationDeg` reads the whole notebook
 * and needs two settings, `unvaried-control-pinned` on `bathTempC` reads only what was pinned and needs
 * one — and `configurationKey` (`criticalControlIds: [rotationDeg, bathTempC]`) reads them as two
 * distinct configurations because the rotation moved, which is what the significant-measure gate and
 * `distinct-run-configurations` both ask for. This is the pair the case teaches, not a pair chosen to
 * pass: the alternative reading of "held steady" over the whole notebook would make the case's own
 * headline conclusion unreachable for anyone who followed its instructions.
 *
 * The conclusion it arrives holding is `conclude-bounded-null`, because `review` is gated on readiness
 * and a draft must be chosen to satisfy it. Callers re-choose whichever proposal they are asking about —
 * `reduceTheoryConclusionProposalChosen` accepts `synthesis` **and** `review`, and choices are revisable
 * by design ("re-choosing must never fail on already-chosen").
 */
const atReview = (locale: 'en' | 'fr' = 'en'): AppStore => {
    const store = createStore(createInitialAppState(definition, locale));
    definition.contextualArtifacts.forEach(({ id }) => store.dispatch({ type: 'source.inspected', sourceId: id }));
    mustDispatch(store, { type: 'case.phaseAdvance', nextPhase: 'prediction' }, 'Could not reach prediction');
    mustDispatch(store, { type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id }, 'Could not choose a prediction');
    mustDispatch(store, { type: 'case.phaseAdvance', nextPhase: 'experiment' }, 'Could not reach the bench');

    const first = record(store, 0, STEADY_BATH_C);
    const second = record(store, 90, STEADY_BATH_C);

    mustDispatch(store, { type: 'comparison.runSelected', runId: first }, 'Could not select the first observation');
    mustDispatch(store, { type: 'comparison.runSelected', runId: second }, 'Could not select the second observation');
    mustDispatch(store, { type: 'comparison.noteSaved', note: 'The turn moves it; the bath did not.' }, 'Could not save the comparison');
    mustDispatch(store, { type: 'case.phaseAdvance', nextPhase: 'synthesis' }, 'Could not reach synthesis');

    mustDispatch(store, { type: 'theory.conclusionProposalChosen', proposalId: 'conclude-bounded-null' }, 'Could not choose the bounded conclusion');
    [first, second].forEach((runId) =>
        mustDispatch(store, { type: 'theory.supportRunSelected', runId }, `Could not pin ${runId}`));
    definition.contextualArtifacts.forEach(({ id }) =>
        mustDispatch(store, { type: 'theory.supportSourceSelected', sourceId: id }, `Could not pin ${id}`));

    mustDispatch(store, { type: 'theory.reviewRequested' }, 'Could not move the draft to review');
    return store;
};

/** The peer-review issue codes the reviewers return for a draft, through a real dispatch. */
const issueCodesFor = (store: AppStore, proposalId: string): readonly string[] => {
    mustDispatch(store, { type: 'theory.conclusionProposalChosen', proposalId }, `Could not choose ${proposalId}`);
    mustDispatch(store, { type: 'peerReview.requested' }, `Could not request review for ${proposalId}`);
    const review = store.getState().peerReview;
    if (review?.status !== 'reviewed') throw new Error(`Peer review was ${review?.status ?? 'absent'} for ${proposalId}.`);
    return review.issues.map(({ code }) => code);
};

/**
 * What each of the four shipped conclusions is expected to earn, **and why** — so a later copy edit that
 * drifts a claim away from the phrase set goes red with a reason attached rather than quietly.
 *
 * The `why` column is not decoration: AC1 requires the table to state, for each proposal, whether
 * overreach is expected *of it*. Three of the four expecting nothing is what makes the fourth meaningful,
 * and a change that makes every row fire is as much a defect as one that makes none fire.
 */
const EXPECTED_ISSUES: readonly Readonly<{ proposalId: string; codes: readonly string[]; why: string }>[] = [
    {
        proposalId: 'conclude-bounded-null',
        codes: [],
        why: 'the bounded claim the evidence defends — it states what moved and within what bound, which is what the revision path asks for'
    },
    {
        proposalId: 'conclude-thermal-confound',
        codes: [],
        why: 'a claim about what interferes with the measurement; wrong about the orientation, but not overclaiming'
    },
    {
        proposalId: 'conclude-ether-disproved',
        codes: ['overreach'],
        why: 'the overclaim the rule was authored for: it declares the question settled from one afternoon of turns'
    },
    {
        proposalId: 'conclude-instrument-broken',
        codes: [],
        why: 'a different error — reading a small result as an instrument fault — which the rival lab answers, not the reviewers'
    }
];

describe('the authored overclaim refusal fires on this case\'s overclaiming conclusion', () => {
    /**
     * The premise of Story 4.3, asserted on shipped content.
     *
     * **Break `conclude-ether-disproved.claim.en` back to "…settled the matter for good"** — the text
     * that shipped through 1.6.0 — and this goes red, because none of the ten authored phrases matches
     * it: *"has settled the matter"* is not *"settles it"*, *"for good"* is not *"once and for all"*, and
     * *"disproved"* is in the proposal's **id**, not in its text.
     *
     * **Or delete the `overreach` branch from `isApplicable`** and it goes red for the other reason. Both
     * are asserted, because a phrase set and the evaluator that reads it are two things and either can
     * fail alone (mutation proofs 1 and 2).
     */
    it.each(EXPECTED_ISSUES)('returns $codes for $proposalId, because $why', ({ proposalId, codes }) => {
        expect(issueCodesFor(atReview(), proposalId)).toEqual(codes);
    });

    /**
     * Exactly one of the four overclaims, and the reviewers answer it in the player's language.
     *
     * The count is asserted rather than left implicit: a copy edit that made a *second* claim trip the
     * phrase set would leave every row above green while changing what the case teaches, since three of
     * the four rows expect an empty list and `toEqual([])` cannot distinguish "not overclaiming" from
     * "the rule stopped working". This is the row that fails in that direction.
     */
    it('finds the overclaim in exactly one of the four shipped conclusions', () => {
        const overclaiming = definition.conclusionProposals.filter(({ id }) =>
            issueCodesFor(atReview(), id).includes('overreach'));

        expect(overclaiming.map(({ id }) => id)).toEqual(['conclude-ether-disproved']);
    });

    /**
     * The issue carries the authored `feedback` and `revisionPath`, and both surfaces resolve by
     * `ruleId` — so the refusal is bilingual without the persisted issue varying by locale.
     *
     * `evaluatePeerReview` emits canonical `.en` on purpose (the issue is written into
     * `DecisionHistoryEntry.feedback`, persisted, and recomputed-and-string-compared on load), and the
     * `ruleId` is what `selectLocalizedPeerReview` resolves against the case definition. Both halves are
     * asserted here because AC1 asks for the authored feedback *and* its revision path, resolved in the
     * reader's language: drop the `ruleId` and the French player gets English.
     */
    it('carries the authored feedback and revision path, addressable by rule id', () => {
        const store = atReview();
        mustDispatch(store, { type: 'theory.conclusionProposalChosen', proposalId: 'conclude-ether-disproved' }, 'Could not choose the overclaim');
        mustDispatch(store, { type: 'peerReview.requested' }, 'Could not request review');

        const review = store.getState().peerReview;
        if (review?.status !== 'reviewed') throw new Error('The reviewers must answer a ready draft.');
        const rule = definition.peerReviewRules.find(({ predicate }) => predicate.kind === 'overreach');
        if (!rule) throw new Error('The case must author an overreach rule.');

        expect(review.issues).toEqual([{
            code: 'overreach',
            ruleId: rule.id,
            feedback: rule.feedback.en,
            revisionPath: rule.revisionPath.en
        }]);
        // Authored in both locales, and the French half is what the `ruleId` above is for.
        expect(rule.feedback.fr.trim()).not.toBe('');
        expect(rule.revisionPath.fr.trim()).not.toBe('');
        expect(rule.feedback.fr).not.toBe(rule.feedback.en);
    });

    /**
     * Detection runs against the canonical English draft, so the locale the player reads in cannot change
     * whether the refusal fires.
     *
     * `reduceTheoryConclusionProposalChosen` writes `proposal.claim.en` in **every** locale — the draft is
     * persisted and string-compared on load, so emitting the active language would reject every record
     * saved in the other one. This asserts the consequence rather than restating the reducer: a French
     * store reaches the same finding on the same draft text.
     */
    it('fires for a French reader too, because the draft is the canonical English claim', () => {
        // A French store driven the whole way, not an English one beside a French store that is never
        // used: until Story 4.3's review this test built `french`, asserted its locale — which restates
        // the argument just handed to `createInitialAppState` and cannot fail — and then ran both real
        // assertions on English stores, leaving AC1's locale clause unexercised.
        const french = atReview('fr');
        expect(french.getState().locale).toBe('fr');
        mustDispatch(french, { type: 'theory.conclusionProposalChosen', proposalId: 'conclude-ether-disproved' }, 'Could not choose the overclaim');

        // The draft is the canonical English claim even here, which is *why* the finding is the same.
        expect(french.getState().theory.conclusion).toBe(proposal('conclude-ether-disproved').claim.en);
        expect(issueCodesFor(french, 'conclude-ether-disproved')).toEqual(['overreach']);

        // And the reader is told about it in French: the code is locale-independent, the prose is not.
        const localized = selectLocalizedPeerReview(french.getState());
        if (localized?.status !== 'reviewed') throw new Error(`Expected a reviewed projection, got ${localized?.status ?? 'none'}.`);
        expect(localized.issues.map(({ feedback }) => feedback))
            .toEqual([resolveOverreachRule().feedback.fr]);
    });

    /**
     * **The dead half of the union, recorded rather than left to be inferred.**
     *
     * Every French phrase in `overreachPhrases.fr` is unreachable while the draft is `.en`, on both
     * shipped cases. The comment in `peerReviewRules.ts` explaining that the union is deterministic is
     * correct; the implication a reader draws from it — that the French list participates in detection —
     * is not. This case's French claim *does* contain `une fois pour toutes`, and it is never read.
     *
     * Asserted as a **fact about today's build**, not as something desirable: it is what makes the FR
     * list's future either a deliberate annotation or a defect, and Story 4.3 chose to record it (§SS12)
     * rather than delete authored content mid-story. Delete the `.fr` spread from `overreachPhrases()`
     * and this stays green — which is the point: nothing in `src/` depends on it.
     */
    it('reads no French phrase, on either shipped case, because the draft is always .en', async () => {
        const cases = await loadShippedCases();
        const readingFrench = cases.flatMap(({ caseId, definition: shipped }) => {
            const rule = shipped.peerReviewRules.find(({ predicate }) => predicate.kind === 'overreach');
            const french = rule?.predicate.overreachPhrases?.fr ?? [];
            return shipped.conclusionProposals
                // `matchesOverreachPhrase` is the production matcher, imported rather than paraphrased:
                // a naive `includes` agrees with it on today's content and diverges on any phrase carrying
                // surrounding whitespace or an internal double space, so the guard could have gone green
                // while the note it defends rotted.
                .filter(({ claim }) => french.some((phrase) => matchesOverreachPhrase(phrase, claim.en)))
                .map(({ id }) => `${caseId} ${id}`);
        });

        expect(readingFrench).toEqual([]);
    });
});

describe('recognition is not awarded for overclaiming (NFR8)', () => {
    /**
     * **The saved-record route to the reward NFR8 forbids, closed and asserted.**
     *
     * D1 reworded `conclude-ether-disproved.claim.en` so the authored `peer-overreach` rule fires on it.
     * That works for anyone playing at 1.7.0 — and Story 4.3's code review found it did nothing for a
     * player returning with a 1.6.0 record, because `theory.conclusion` is the text peer review reads and
     * the record holds the *retired* wording. "…has settled the matter for good." matches none of the five
     * authored English phrases, so the returning player asked for review **at 1.7.0**, was told the
     * conclusion was sound, and earned `calibrated-conclusion` for declaring the ether disproved.
     *
     * Both halves are asserted below, in order, because the first is what makes the second necessary: the
     * retired text really does trip nothing, and the migrated record really does trip `overreach`.
     *
     * **Named change that breaks this:** restoring the `selectedConclusionProposalId: undefined`
     * sanitization in `CaseRecordSchema.ts` in place of the draft migration.
     */
    it('brings a returning 1.6.0 draft forward, so the overclaim is refused at 1.7.0', () => {
        const overclaim = proposal('conclude-ether-disproved');
        const PRE_EDIT_CLAIM_EN = 'The ether does not exist, and this bench has settled the matter for good.';
        expect(overclaim.claim.en).not.toBe(PRE_EDIT_CLAIM_EN);

        const store = atReview();
        mustDispatch(store, { type: 'theory.conclusionProposalChosen', proposalId: overclaim.id }, 'Could not choose the overclaim');
        const state = store.getState();
        const evidence = { runs: state.runs, inspectedSourceIds: state.inspectedSourceIds };

        // 1. The retired wording trips nothing. This is the defect, stated as a fact about the phrase set
        //    rather than as a story about it — and it is why dropping the card was not a repair.
        const onRetiredText = evaluatePeerReview(definition, evidence, { ...state.theory, conclusion: PRE_EDIT_CLAIM_EN });
        if (onRetiredText.status !== 'reviewed') throw new Error('Peer review was unavailable on the retired text.');
        expect(onRetiredText.issues).toEqual([]);

        // 2. A 1.6.0 record carrying that wording is migrated forward on load, and then trips `overreach`.
        const projected = createCaseRecordProjection(state);
        expect(projected.ok).toBe(true);
        if (!projected.ok) return;
        const restored = validateCaseRecordForDefinition({
            ...projected.value,
            caseDefinitionVersion: '1.6.0',
            theory: { ...projected.value.theory, conclusion: PRE_EDIT_CLAIM_EN }
        }, definition);
        expect(restored.ok).toBe(true);
        if (!restored.ok) return;

        expect(restored.value.theory.conclusion).toBe(overclaim.claim.en);
        expect(restored.value.selectedConclusionProposalId).toBe(overclaim.id);
        const onMigratedText = evaluatePeerReview(definition, evidence, restored.value.theory);
        if (onMigratedText.status !== 'reviewed') throw new Error('Peer review was unavailable on the migrated text.');
        expect(onMigratedText.issues.map(({ code }) => code)).toEqual(['overreach']);
    });

    /**
     * Saves a reviewed revision on the chosen proposal and returns whether the debrief would call it
     * calibrated.
     *
     * `revision.saved` is what writes the issue list into `decisionHistory`, and `deriveRecognition`
     * reads *that* — the persisted feedback, never a fresh evaluation. Which is also why AC1's
     * record-safety half holds: an already-saved record's stored feedback is unchanged by a content edit,
     * so its flag still derives the same way it was persisted.
     */
    const calibratedAfterReviewing = (proposalId: string): boolean => {
        const store = atReview();
        mustDispatch(store, { type: 'theory.conclusionProposalChosen', proposalId }, `Could not choose ${proposalId}`);
        mustDispatch(store, { type: 'peerReview.requested' }, 'Could not request review');
        mustDispatch(store, { type: 'revision.saved', timestamp: '2026-08-21T10:00:00.000Z' }, 'Could not save the revision');

        const state = store.getState();
        const recognition = deriveRecognition(definition, {
            inspectedSourceIds: state.inspectedSourceIds,
            runs: state.runs,
            decisionHistory: state.decisionHistory
        });
        const item = recognition.items.find(({ id }) => id === 'calibrated-conclusion');
        if (!item) throw new Error('Recognition must carry a calibrated-conclusion item.');
        return item.achieved;
    };

    /**
     * The NFR8 half of Story 4.3's premise. **Revert D1's claim wording and this goes red** — the
     * overclaiming revision earns zero issues, `calibrated-conclusion` derives `true`, and the debrief
     * paints *"Calibrated conclusion recorded"* over a player who concluded the ether is disproved
     * (mutation proof 9).
     *
     * This is the assertion `inquiry-recognition.spec.ts` could never have made: that spec walks to the
     * debrief and checks every `RECOGNITION_ID` resolves and that no score appears anywhere, but it never
     * asserts *which* recognitions were earned.
     */
    it('withholds calibrated-conclusion from a reviewed overclaim', () => {
        expect(calibratedAfterReviewing('conclude-ether-disproved')).toBe(false);
    });

    /**
     * And the other direction, so the assertion above cannot be satisfied by breaking recognition
     * outright. A rule that awards nothing to anybody would pass the row above and fail this one.
     */
    it('awards calibrated-conclusion to the bounded conclusion', () => {
        expect(calibratedAfterReviewing('conclude-bounded-null')).toBe(true);
    });
});

describe('the limitation requirement guards the draft it can guard (AC2, D2)', () => {
    /**
     * **Three mechanisms, three states, and this is the file that pins each to its own.**
     *
     * D2 chose to re-state the `limitation` requirement's real scope rather than teach it to read
     * `"None offered."` as a declared absence. That is only honest if the scope is written down *and*
     * held by a test, so:
     *
     * 1. the requirement fires on the **pre-choice** draft, where `theory.limitation` is `''`;
     * 2. `consult-no-limitation` answers it in fiction from a state a player can be in — already proven
     *    in `MorleyMillerFeedback.test.ts` and deliberately not rebuilt here;
     * 3. the **post-choice** `"None offered."` draft is answered by the overclaim refusal, which after
     *    D1 fires on exactly that proposal.
     *
     * Leg 3 is the one that did not exist before this story, and mutation proof 8 breaks it.
     */
    it('fires on the pre-choice draft, before any proposal has been adopted', () => {
        const readiness = evaluateConclusionReadiness(definition, {
            runs: [],
            inspectedSourceIds: definition.contextualArtifacts.map(({ id }) => id)
        }, { selectedRunIds: [], selectedSourceIds: [], conclusion: '', limitation: '' });

        expect(readiness.missing.map(({ code }) => code)).toContain('limitation');
    });

    /**
     * The requirement asks `.trim()`, so the authored string `"None offered."` satisfies it — stated as a
     * **fact about the content**, which is what makes leg 3 necessary rather than optional.
     *
     * Reword that limitation to an empty string and this goes red, correctly: the case would then be
     * refusing the draft at readiness instead, and D2's reasoning would need revisiting rather than the
     * assertion being updated.
     */
    it('is satisfied by the one authored limitation that declares there is none', () => {
        const overclaim = proposal('conclude-ether-disproved');
        expect(overclaim.limitation.en.trim()).not.toBe('');

        const readiness = evaluateConclusionReadiness(definition, {
            runs: [],
            inspectedSourceIds: []
        }, {
            selectedRunIds: [],
            selectedSourceIds: [],
            conclusion: overclaim.claim.en,
            limitation: overclaim.limitation.en
        });

        expect(readiness.missing.map(({ code }) => code)).not.toContain('limitation');
    });

    /**
     * Leg 3: the mechanism that actually answers the post-choice draft. Not a second copy of the AC1
     * suite — what it asserts is the *pairing*, that the draft readiness lets through is the draft the
     * reviewers refuse, on the same shipped proposal.
     */
    it('leaves the "None offered." draft to the overclaim refusal, which answers it', () => {
        const overclaim = proposal('conclude-ether-disproved');
        const store = atReview();
        mustDispatch(store, { type: 'theory.conclusionProposalChosen', proposalId: overclaim.id }, 'Could not choose the overclaim');

        const state = store.getState();
        // Readiness has nothing to say about this draft — that is the honest scope, and the reason the
        // phase advance to `review` above succeeded at all.
        expect(evaluateConclusionReadiness(definition, {
            runs: state.runs,
            inspectedSourceIds: state.inspectedSourceIds,
            comparisonNotes: state.comparison.notes
        }, state.theory).status).toBe('ready');
        expect(state.theory.limitation).toBe(overclaim.limitation.en);

        // And the reviewers do.
        expect(issueCodesFor(store, overclaim.id)).toEqual(['overreach']);
    });
});

describe('the rival lab answers both undefendable conclusions and routes back (AC3)', () => {
    /**
     * Submits a conclusion and reports what the rival lab did, on shipped content.
     *
     * `reduceTheoryConclusionSubmit` evaluates defensibility and **nothing else** — it never advances a
     * phase, saves, or completes — and it passes `selectedRunIds` so the pinned-scope predicates can
     * judge the claim on the evidence pinned to it.
     */
    const submit = (store: AppStore, proposalId: string): AppStore => {
        mustDispatch(store, { type: 'theory.conclusionProposalChosen', proposalId }, `Could not choose ${proposalId}`);
        mustDispatch(store, { type: 'theory.conclusionSubmitted', timestamp: '2026-08-21T11:00:00.000Z' }, `Could not submit ${proposalId}`);
        return store;
    };

    const undefendable = () => definition.conclusionProposals
        .filter(({ supportPredicate }) => supportPredicate.kind === 'never')
        .map(({ id }) => id);

    it('authors a critique that answers each undefendable conclusion by name', () => {
        const answered = undefendable().map((proposalId) =>
            definition.rivalLab.critiques.find((critique) => critique.proposalId === proposalId)?.proposalId);

        expect(answered).toEqual(undefendable());
        expect(undefendable().length).toBeGreaterThan(0);
    });

    it.each(['conclude-ether-disproved', 'conclude-instrument-broken'])(
        'stands a critique against %s, refuses the retreat while it stands, and clears on revision',
        (proposalId) => {
            const store = submit(atReview(), proposalId);

            const critique = store.getState().rivalLabCritique;
            expect(critique?.proposalId).toBe(proposalId);

            // Narrative dressing, never a fail state: the retreat is refused while the challenge stands,
            // and that refusal is the *only* consequence.
            // The **code**, not merely `ok: false`: `reduceCasePhaseRetreat` refuses for two different
            // reasons — the standing critique, and an illegal transition — and asserting the boolean alone
            // would pass if the critique guard were deleted and `previousPhase` happened to be rejected by
            // `retreatCasePhase` instead. That is the "passed for a different reason" shape 4.2's review
            // found nine times.
            const retreat = store.dispatch({ type: 'case.phaseRetreat', previousPhase: 'synthesis' });
            expect(retreat.ok).toBe(false);
            expect(retreat.ok ? undefined : retreat.error.code).toBe('rival-lab-revision-required');

            const draftBefore = store.getState().theory;
            mustDispatch(store, { type: 'rivalLab.revisionRequested' }, 'Could not request a revision');

            const after = store.getState();
            expect(after.rivalLabCritique).toBeUndefined();
            // The chosen proposal and the draft survive untouched — no lockout, no reset, no penalty.
            expect(after.selectedConclusionProposalId).toBe(proposalId);
            expect(after.theory).toEqual(draftBefore);
        }
    );

    /**
     * The defensible conclusion, on the evidence the case's own `resetPath` teaches — including the
     * `unvaried-control-pinned` clause on `bathTempC`, which reads **the pinned set** and fails closed
     * when it is absent.
     *
     * The two rotations share one bath temperature here because that is what the case instructs; an
     * all-runs reading of "held steady" would make this claim unreachable for any player who followed it,
     * which is the near-miss the 3.2 review recorded.
     */
    it('raises no critique for the bounded conclusion the pinned evidence defends', () => {
        const store = submit(atReview(), 'conclude-bounded-null');
        const state = store.getState();

        expect(state.rivalLabCritique).toBeUndefined();
        expect(selectDefensibleConclusionIds(definition, {
            runs: state.runs,
            inspectedSourceIds: state.inspectedSourceIds,
            comparisonNotes: state.comparison.notes,
            selectedRunIds: state.theory.selectedRunIds
        })).toContain('conclude-bounded-null');
    });

    /**
     * The fail-closed half, which is the one that would degrade silently.
     *
     * **Make `unvaried-control-pinned` return `true` on an absent `selectedRunIds`** and this goes red:
     * the bounded claim becomes defensible on no pinned evidence at all, and the rival lab stops
     * answering a conclusion nothing supports (mutation proof 3).
     */
    it('does not defend the bounded conclusion when the support argument is absent or empty', () => {
        const store = atReview();
        const state = store.getState();
        const evidence = {
            runs: state.runs,
            inspectedSourceIds: state.inspectedSourceIds,
            comparisonNotes: state.comparison.notes
        };

        // **Omitted** — the fail-closed case. `atReview()` pins both runs and every artifact, so this row
        // never described an unpinned store; what it exercises is a caller that forgot to pass
        // `selectedRunIds` at all, which is a real defence and worth keeping.
        expect(selectDefensibleConclusionIds(definition, evidence)).not.toContain('conclude-bounded-null');

        // **Empty** — the case ordinary play reaches, and the one this row claimed to cover until Story
        // 4.3's review. A predicate that fails closed on `undefined` and open on `[]` passed the old
        // assertion; a player who pins nothing must not be told the bounded conclusion is defensible.
        expect(selectDefensibleConclusionIds(definition, { ...evidence, selectedRunIds: [] }))
            .not.toContain('conclude-bounded-null');
        expect(selectDefensibleConclusionIds(definition, { ...evidence, selectedRunIds: [], inspectedSourceIds: [] }))
            .not.toContain('conclude-bounded-null');
    });

    it('puts no score, counter, timer or penalty anywhere on the path', () => {
        const store = submit(atReview(), 'conclude-ether-disproved');
        const state = store.getState();

        // The whole state, read as one document: a score or a strike counter introduced anywhere on this
        // path fails here rather than in a review.
        const serialized = JSON.stringify({
            critique: state.rivalLabCritique,
            theory: state.theory,
            decisionHistory: state.decisionHistory,
            critiqueHistory: state.critiqueHistory
        });
        expect(serialized).not.toMatch(/score|penalt|strike|attemptsRemaining|livesLeft|gameOver/i);
    });
});

describe('the shipped phrase set and the shipped claims are checked against each other', () => {
    /**
     * The evaluator, read directly over each authored claim, with the pinned evidence removed.
     *
     * The store-driven rows above are the player's path; this is the same question asked of the content
     * alone, and it is here because the two can come apart: a readiness change could start suppressing
     * `overreach` behind `missing-evidence` and every row above would still report the codes it expects
     * as a *set*. Passing an empty notebook makes `missing-evidence` fire too, so what this asserts is
     * `overreach`'s membership rather than the exact list.
     */
    it.each(EXPECTED_ISSUES)('agrees with the evaluator about $proposalId', ({ proposalId, codes }) => {
        const authored = proposal(proposalId);
        const review = evaluatePeerReview(definition, { runs: [], inspectedSourceIds: [] }, {
            selectedRunIds: [],
            selectedSourceIds: [],
            conclusion: authored.claim.en,
            limitation: authored.limitation.en
        });
        if (review.status !== 'reviewed') throw new Error('The shipped rules must be evaluable.');

        expect(review.issues.some(({ code }) => code === 'overreach')).toBe(codes.includes('overreach'));
    });
});

describe('which figure on the conclusion board proposes what', () => {
    /**
     * **The stage is ordered by proposal, not by cast — and on this case the two disagree.**
     *
     * `presentColleagueIds` lays the board out in `proposerIds` order, which is
     * `conclusionProposals.map(colleagueId)`, then appends any beat speaker not already standing. On Young
     * that happens to equal `colleagues[]` order at slot 3, so the e2e walk's `colleagueIndex = 3` picked
     * `samuel-hart` either way and nothing recorded which of the two orderings it was relying on. On this
     * case they differ, and slot 3 is `harriet-lowe` (`conclude-instrument-broken`) where `colleagues[3]`
     * is `nils-abrahamsen` (`conclude-ether-disproved`).
     *
     * Story 4.3's first attempt at a named-conclusion walk helper resolved the seat through `colleagues[]`
     * and therefore chose the wrong conclusion; the browser reported it — the peer-review pane came back
     * with `missing-evidence` alone and no overreach — and this row is what makes the next attempt fail
     * here instead of three transitions and one screenshot later.
     *
     * **Named change that breaks this:** reordering `conclusionProposals` in `case.json`, or changing
     * `presentColleagueIds` to lead with `castIds`.
     */
    it('stages this case in conclusion-proposal order, which is not the cast order', () => {
        const synthesis = definition.scenarioScript.scenes.find(({ phase }) => phase === 'synthesis');
        if (!synthesis) throw new Error('The case must author a synthesis scene.');

        const staged = presentColleagueIds({
            proposerIds: definition.conclusionProposals.map(({ colleagueId }) => colleagueId),
            speakerIds: (synthesis.dialogueBeats ?? []).map(({ speakerId }) => speakerId),
            castIds: definition.colleagues.map(({ id }) => id),
            authoredCast: synthesis.cast
        });

        // The slot order is the proposal order.
        expect(staged).toEqual(definition.conclusionProposals.map(({ colleagueId }) => colleagueId));
        // And it is *not* the cast order — which is the whole point, and the assertion that would have
        // caught the wrong helper.
        expect(staged).not.toEqual(definition.colleagues.map(({ id }) => id));

        const proposalAtSlot = (slot: number) => definition.conclusionProposals
            .find(({ colleagueId }) => colleagueId === staged[slot])?.id;
        expect(proposalAtSlot(0)).toBe('conclude-bounded-null');
        expect(proposalAtSlot(2)).toBe('conclude-ether-disproved');
        expect(proposalAtSlot(3)).toBe('conclude-instrument-broken');
    });
});

describe('the refusal reads in French on every surface that draws it (AC7)', () => {
    /**
     * **The surface list was built by grepping for the read, not from this story's file list.**
     *
     * `grep -rn` over `src/` for `peerReviewRules`, `selectLocalizedPeerReview` and `PeerReviewIssue`
     * returns five files that put this text in front of a player:
     * `selectors.ts`'s `selectLocalizedPeerReview` (the projection both canvas surfaces read),
     * `CaseFilePresenter.renderPeerReview` (the pane), and `CaseRecordPrintView`'s `localizedFeedback`
     * (ADR-007's portable record, the one non-Phaser surface). `ColleagueRenderer` and `RivalLabRenderer`
     * draw the *proposal* and *critique* copy on the same path and are covered by their own suites.
     *
     * That list-by-grep is the rule and the reason for it: Story 3.2 localized three of the four surfaces
     * rendering a run's apparatus settings and missed `CaseFilePresenter` for the single reason that it
     * was the only one absent from the story's file list.
     *
     * The projection is what is asserted here, because it is the seam all of them share and the one that
     * would silently hand a French player English: `evaluatePeerReview` emits canonical `.en` on purpose
     * (the issue is persisted and recomputed on load), so **every** surface has to resolve by `ruleId`.
     * The pane's rendered pixels are confirmed by the frames `morley-miller-debrief.spec.ts` captures at
     * 1280×720 in both locales.
     *
     * **Named change that breaks this:** dropping the `rules.find(({ id }) => id === issue.ruleId)`
     * lookup in `selectLocalizedPeerReview`, at which point the fallback returns `issue.feedback` — the
     * canonical English — and this row reads it.
     */
    it('resolves the overclaim issue into French by rule id, not the persisted canonical English', () => {
        const rule = definition.peerReviewRules.find(({ predicate }) => predicate.kind === 'overreach');
        if (!rule) throw new Error('The case must author an overreach rule.');

        const french = createStore(createInitialAppState(definition, 'fr'));
        // The projection is read from a store standing where the pane draws it, so this cannot pass on a
        // state the surface never sees.
        const store = atReview();
        mustDispatch(store, { type: 'theory.conclusionProposalChosen', proposalId: 'conclude-ether-disproved' }, 'Could not choose the overclaim');
        mustDispatch(store, { type: 'peerReview.requested' }, 'Could not request review');

        const projected = selectLocalizedPeerReview({ ...store.getState(), locale: french.getState().locale });
        if (projected?.status !== 'reviewed') throw new Error('The reviewers must answer a ready draft.');

        expect(projected.issues).toHaveLength(1);
        expect(projected.issues[0]!.feedback).toBe(rule.feedback.fr);
        expect(projected.issues[0]!.revisionPath).toBe(rule.revisionPath.fr);
        // And no English leaked in beside it — the persisted issue still carries `.en`, which is exactly
        // why the resolution has to happen here.
        expect(projected.issues[0]!.feedback).not.toBe(rule.feedback.en);
        expect(projected.issues[0]!.revisionPath).not.toBe(rule.revisionPath.en);

        // The English reader gets English from the same projection, so the row above cannot be satisfied
        // by a surface that is French-only.
        const english = selectLocalizedPeerReview(store.getState());
        if (english?.status !== 'reviewed') throw new Error('The reviewers must answer a ready draft.');
        expect(english.issues[0]!.feedback).toBe(rule.feedback.en);
    });

    /**
     * No French phrase on this path is composed by joining a preposition or an article to authored text
     * (AC7's last clause, and the `'de ' + label.fr` regression that shipped as "de Ecartement des
     * fentes").
     *
     * `caseFile.review.issue` is `'{feedback} — {revisionPath}'` in **both** locales — two authored
     * sentences and an em dash, no grammatical join — which is the shape the i18n rule prescribes:
     * author the joined form rather than building it.
     */
    it('composes the issue line from whole authored sentences, with no grammatical join', () => {
        expect(fr['caseFile.review.issue']).toBe(en['caseFile.review.issue']);
        expect(fr['caseFile.review.issue']).toBe('{feedback} — {revisionPath}');
    });
});
