import { beforeAll, describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import { selectColleagueHint } from '../../src/domain/review/colleagueHints';
import { STABLE_WINDOW_C } from '../../src/domain/apparatus/calculateInterferometerDrift';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { loadMorleyMillerCase } from './shippedCases';

/**
 * The synthesis feedback on the Morley–Miller case: what it says, and that every branch of it is
 * **reachable from a state a player can actually be in** (Story 4.2, AC4).
 *
 * ## Why this file drives the store instead of building projections
 *
 * AC4's last clause exists because `conclusionReadiness` shipped two Young-shaped rules that were
 * *permanently unsatisfiable* for this exact case: a player could reach synthesis, pin two runs, save a
 * comparison, and read two English sentences about Young in front of a list that would never open. The
 * rules were correct as functions and unreachable as content, and nothing caught it because every test
 * handed them a hand-built evidence object.
 *
 * So every state below is reached by **real dispatches through the real store**, from the real authored
 * case, and the assertion is on what the store then holds. A projection assembled here would prove the
 * predicate agrees with itself.
 *
 * ## Two distinct mechanisms, not one
 *
 * **Colleague hints** are delivered in the laboratory's side column while the significant-measure gate is
 * unmet. **Consultations** are reached from the case file, which `TheoryBoardScene` hosts in `synthesis`
 * and `review`. They are not interchangeable and they answer at different moments, so both are swept.
 */

let definition: CaseDefinition;

beforeAll(async () => {
    definition = await loadMorleyMillerCase();
});

const control = (controlId: string) => {
    const found = definition.apparatus.primaryControls.find(({ id }) => id === controlId);
    if (!found) throw new Error(`The case must author a ${controlId} control.`);
    return found;
};

/** A store in `experiment`, having read whichever sources are asked for. */
const atTheBench = (inspect: readonly string[] = definition.contextualArtifacts.map(({ id }) => id)): AppStore => {
    const store = createStore(createInitialAppState(definition, 'en'));
    inspect.forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
    const toPrediction = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
    if (!toPrediction.ok) throw new Error(`Could not reach prediction: ${toPrediction.error.code}`);
    store.dispatch({ type: 'prediction.proposalChosen', proposalId: definition.predictionProposals[0]!.id });
    const toExperiment = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'experiment' });
    if (!toExperiment.ok) throw new Error(`Could not reach experiment: ${toExperiment.error.code}`);
    return store;
};

let runSequence = 0;

/** Records one observation at the given bench settings, the way the bench does. */
const record = (store: AppStore, rotationDeg: number, bathTempC: number): void => {
    const rotation = store.dispatch({ type: 'apparatus.controlSet', controlId: 'rotationDeg', value: rotationDeg, origin: 'phaser' });
    if (!rotation.ok) throw new Error(`The bench refused rotationDeg=${rotationDeg}: ${rotation.error.code}`);
    const bath = store.dispatch({ type: 'apparatus.controlSet', controlId: 'bathTempC', value: bathTempC, origin: 'phaser' });
    if (!bath.ok) throw new Error(`The bench refused bathTempC=${bathTempC}: ${bath.error.code}`);
    runSequence += 1;
    const run = store.dispatch({
        type: 'experiment.run',
        id: `run-${runSequence}`,
        timestamp: `2026-08-20T10:${String(runSequence).padStart(2, '0')}:00.000Z`
    });
    if (!run.ok) throw new Error(`The bench refused the run: ${run.error.code}`);
};

/** Moves to `synthesis`, which the store refuses below two significant measures. */
const toSynthesis = (store: AppStore): void => {
    const advanced = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'synthesis' });
    if (!advanced.ok) throw new Error(`Could not reach synthesis: ${advanced.error.code}`);
};

/** The rule the store actually selects, or the localized refusal code, for a real dispatch. */
const consult = (store: AppStore): string => {
    const asked = store.dispatch({ type: 'consultation.requested' });
    if (!asked.ok) return `refused:${asked.error.code}`;
    const ruleId = store.getState().consultation?.ruleId;
    if (!ruleId) throw new Error('A successful consultation must leave a rule in the store.');
    return ruleId;
};

describe('every authored consultation is reachable from a state a player can be in', () => {
    /**
     * **Two of the four shipped rules could never fire, and this is the record of finding out.**
     *
     * §SS5 anticipated one gap — replication — and flagged one rule as suspicious. There were two dead
     * branches, and neither was reachable for the same reason:
     *
     * - `consult-no-runs` fired on `runs.length < 2`. The case file is hosted only by `TheoryBoardScene`,
     *   which runs in `synthesis` and `review`, and `reduceCasePhaseAdvance` refuses `experiment →
     *   synthesis` below two *significant* measures, each of which needs a run. So wherever the rule could
     *   be asked, the notebook already held two observations.
     * - `consult-unread-report` fired on `morley-miller-1907-final-report` being uninspected. The case
     *   authors exactly **two** contextual artifacts and `requirements.minimumSources` is **2**, so the
     *   `context → prediction` gate refuses with `missing-contextual-sources` until *both* have been read —
     *   and `inspectedSourceIds` only ever grows. A player at synthesis has read the report by construction.
     *
     * `reduceConsultationRequest` has no phase guard, so both *actions* are callable at the bench — which is
     * exactly the distinction AC4's last clause draws. A reducer being callable is not a state a player can
     * be in: ADR-011's rule is that the canvas is what makes an intent real, and no canvas surface outside
     * the theory board dispatches this one. The two rows below prove the unreachability against the real
     * store rather than asserting it in a comment.
     *
     * Both slots were **repurposed rather than deleted**, so the authored count is unchanged and every
     * branch now says something a reachable player can act on: `consult-no-runs` became
     * `consult-turn-the-stone`, the exact mirror of `consult-vary-bath`, and the report rule's own point —
     * that the authors published a *bound* rather than a zero — moved into `consult-no-limitation`, which
     * is the one place a player is actually being asked to state one. Consultation copy is display copy and
     * is not in `validateCaseRecordForDefinition`'s recomputed canonical set, so no saved record holds a
     * rule id and this costs no record compatibility.
     */
    it('cannot be asked about an empty notebook, because synthesis is gated on runs', () => {
        const store = atTheBench();
        record(store, 0, 22);
        record(store, 90, 22);
        toSynthesis(store);

        expect(store.getState().runs.length).toBeGreaterThanOrEqual(2);
        expect(definition.consultationRules.some(({ predicate }) => predicate.kind === 'missing-run')).toBe(false);
    });

    it('cannot be asked about an unread source, because the reading gate is the whole authored set', () => {
        // The gate, demonstrated rather than described: one source read is not enough to leave `context`.
        const store = createStore(createInitialAppState(definition, 'en'));
        store.dispatch({ type: 'source.inspected', sourceId: definition.contextualArtifacts[0]!.id });
        const refused = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });

        expect(refused.ok).toBe(false);
        expect(refused.ok ? undefined : refused.error.code).toBe('missing-contextual-sources');
        expect(definition.requirements.minimumSources).toBe(definition.contextualArtifacts.length);
        expect(definition.consultationRules.some(({ predicate }) => predicate.kind === 'missing-source')).toBe(false);
    });

    it('asks for the stone to be turned when only the bath has moved', () => {
        const store = atTheBench();
        record(store, 0, 22);
        record(store, 0, STABLE_WINDOW_C);
        toSynthesis(store);

        // Reachable, and it is the bath varying that gets the player here: two distinct configurations
        // meet the gate while `rotationDeg` has stood still.
        expect(consult(store)).toBe('consult-turn-the-stone');
    });

    it('asks for the bath to be moved when every observation shares one temperature', () => {
        const store = atTheBench();
        record(store, 0, 22);
        record(store, 90, 22);
        toSynthesis(store);

        expect(consult(store)).toBe('consult-vary-bath');
    });

    /**
     * The gap AC4 named, and the rule that closes it.
     *
     * The case's `experiment.confound.discoverableBy` is `'replication'` and its
     * `experiment.resetPath.recoveryRoute` is `'replication'` — and before this story **no consultation
     * rule and no colleague hint told the player to repeat a reading**. The nearest thing, `hint-repeated`,
     * says the *opposite*: it warns them off a repeated arrangement, which is right about *distinguishing*
     * and wrong about *confirming*. So the case taught a recovery route it never mentioned.
     */
    it('asks for a reading to be repeated once both controls have moved but nothing is confirmed', () => {
        const store = atTheBench();
        record(store, 0, 22);
        record(store, 90, STABLE_WINDOW_C);
        toSynthesis(store);

        // Both controls varied, so neither `alternative-test` rule can shadow this; every configuration is
        // its own, so nothing has been confirmed by repetition.
        expect(consult(store)).toBe('consult-repeat-reading');
    });

    it('asks for a limitation once a reading has actually been repeated', () => {
        const store = atTheBench();
        record(store, 0, 22);
        record(store, 90, STABLE_WINDOW_C);
        record(store, 90, STABLE_WINDOW_C);
        toSynthesis(store);

        // Without a state that satisfies replication, `consult-no-limitation` would have been shadowed into
        // unreachability by the rule inserted before it — the trap of inserting into an ordered `find`, and
        // the reason this row sits beside the one above rather than being assumed from it.
        expect(consult(store)).toBe('consult-no-limitation');
    });

    it('runs out of authored guidance once every consultation is satisfied, and says so', () => {
        const store = atTheBench();
        record(store, 0, 22);
        record(store, 90, STABLE_WINDOW_C);
        record(store, 90, STABLE_WINDOW_C);
        toSynthesis(store);
        // The limitation is written by choosing a conclusion proposal, which writes the claim and its
        // limitation together out of one authored proposal — there is no separate limitation action.
        const chosen = store.dispatch({ type: 'theory.conclusionProposalChosen', proposalId: definition.conclusionProposals[0]!.id });
        if (!chosen.ok) throw new Error(`Could not choose a conclusion: ${chosen.error.code}`);

        // A localized refusal, not silence and not a raw error: "a refused action always says why".
        expect(consult(store)).toBe('refused:consultation-unavailable');
    });

    it('reaches every authored consultation across the sweep above, with none left unexercised', () => {
        // The guard on this describe: each of the four authored rules is asserted by name in a row above,
        // so a fifth added without a reachability row fails here rather than shipping unexercised.
        expect(definition.consultationRules.map(({ id }) => id)).toEqual([
            'consult-turn-the-stone', 'consult-vary-bath', 'consult-repeat-reading', 'consult-no-limitation'
        ]);
        // And no predicate kind survives that this case cannot reach.
        expect(definition.consultationRules.map(({ predicate }) => predicate.kind)).toEqual([
            'alternative-test', 'alternative-test', 'missing-replication', 'missing-limitation'
        ]);
    });
});

describe('every authored colleague hint is reachable from a state a player can be in', () => {
    /** The hint the side column would show, for a store the player has actually driven there. */
    const hint = (store: AppStore): string | undefined =>
        selectColleagueHint(definition, store.getState().runs)?.hintId;

    it('speaks the empty-notebook hint at the bench, where the notebook really can be empty', () => {
        // The mirror image of `consult-no-runs`: this predicate *is* reachable, because the hint is
        // delivered in the laboratory rather than behind the synthesis gate. The two mechanisms are not
        // interchangeable, and this is what that difference looks like.
        expect(hint(atTheBench())).toBe('hint-no-runs');
    });

    it('warns off a repeated arrangement while it is still the only arrangement', () => {
        const store = atTheBench();
        record(store, 0, 22);
        record(store, 0, 22);

        expect(hint(store)).toBe('hint-repeated');
    });

    it('asks for the stone to be turned while only one observation stands', () => {
        const store = atTheBench();
        record(store, 0, 22);

        // **One** run, and that is the only shape that reaches this hint — worth stating, because the
        // obvious two-run state does not. With two observations the notebook either repeats a
        // configuration, which `hint-repeated` answers first, or holds two distinct ones, which meets the
        // gate and withdraws every hint. So the unvaried-rotation branch lives entirely in the one-run
        // window, and a test that reached for two runs would have been asserting an unreachable state.
        expect(hint(store)).toBe('hint-unvaried-rotation');
    });

    it('withdraws itself the moment the gate is met, rather than volunteering a next step', () => {
        const store = atTheBench();
        record(store, 0, 22);
        record(store, 90, 22);

        expect(hint(store)).toBeUndefined();
    });

    /**
     * `hint-floor` is the authored catch-all, and it is **unreachable for this case** — correctly.
     *
     * The three specific predicates above partition every unmet state the significance rule can produce:
     * nothing recorded, a repeat, or a single arrangement. `colleagueHints`' own docstring already records
     * this for Young and explains why it is a working safety net rather than dead content — *"a safety net
     * that never catches anything is a working safety net"* — and the schema **requires** it to be authored
     * and to be last, so the gate can never have nothing to say.
     *
     * Stated here rather than left implicit, because AC4 asks the reachability question of every branch and
     * the honest answer for this one is "unreachable, required, and that is the design". The distinction
     * from `consult-no-runs` is the point: that rule is unreachable *and* says something a reachable state
     * needs said, so it was repurposed. This one is unreachable and says nothing that is missing.
     */
    it('keeps the catch-all authored and last, even though this case can never reach it', () => {
        const hints = definition.colleagueHints;

        expect(hints[hints.length - 1]!.predicate.kind).toBe('below-significant-measures');
        expect(hints.filter(({ predicate }) => predicate.kind === 'below-significant-measures')).toHaveLength(1);
    });
});

describe('the feedback directs, and never concludes (AC4)', () => {
    /**
     * Asserted rather than eyeballed, which is what AC4's second clause asks for.
     *
     * Every authored proposal id and every authored claim is swept against every line of consultation and
     * hint prose in both locales. A consultation that named a proposal, ranked the proposals, or asserted
     * which conclusion the evidence supports would be the evaluator's job done by content — and ADR-006
     * makes the evaluator the sole completion authority.
     */
    const feedbackProse = (): readonly string[] => [
        ...definition.consultationRules.flatMap(({ layers, nextStep }) => [
            layers.observation.en, layers.observation.fr,
            layers.plainLanguage.en, layers.plainLanguage.fr,
            layers.technicalDetail.en, layers.technicalDetail.fr,
            nextStep.en, nextStep.fr
        ]),
        ...definition.colleagueHints.flatMap(({ line }) => [line.en, line.fr])
    ];

    it('names no proposal, in any layer, in either language', () => {
        const ids = [
            ...definition.predictionProposals.map(({ id }) => id),
            ...definition.conclusionProposals.map(({ id }) => id)
        ];
        const offenders = feedbackProse().flatMap((prose) =>
            ids.filter((id) => prose.includes(id)).map((id) => `${id} appears in "${prose}"`));

        expect(offenders).toEqual([]);
        expect(ids.length).toBeGreaterThan(0);
        expect(feedbackProse().length).toBeGreaterThan(0);
    });

    it('quotes no conclusion claim, so it cannot mark one correct by restating it', () => {
        const claims = definition.conclusionProposals.flatMap(({ claim }) => [claim.en, claim.fr]);
        const offenders = feedbackProse().flatMap((prose) =>
            claims.filter((claim) => prose.includes(claim)).map((claim) => `"${claim}" is restated in feedback`));

        expect(offenders).toEqual([]);
    });

    it('uses none of the vocabulary that would rank or settle the question', () => {
        // Words that would turn a nudge into a verdict. Deliberately narrow and deliberately bilingual:
        // this is a guard against the *register* slipping, not a general prose linter.
        const verdictWords = ['correct', 'incorrect', 'right answer', 'best', 'wrong', 'proves', 'disproves',
            'correcte', 'incorrecte', 'bonne réponse', 'meilleure', 'prouve', 'réfute'];
        const offenders = feedbackProse().flatMap((prose) =>
            verdictWords.filter((word) => prose.toLowerCase().includes(word)).map((word) => `"${word}" in "${prose}"`));

        expect(offenders).toEqual([]);
    });
});

describe('the stable window is legible to the player (AC2)', () => {
    /**
     * The number and the prose that names it, held together.
     *
     * `STABLE_WINDOW_C` is 20 and `bathTempC` defaults to 22 across an 18–24 range, so a player told to
     * *"bring the bath back to its steady window"* had no way to know which value that was — an
     * instruction they could not follow. The window is now named in the authored `resetPath` prose in both
     * locales, and this asserts the prose against the constant so the two cannot drift. Authored content
     * rather than an interface string, because the case's own physics belongs to the case.
     *
     * Mutation target: change `STABLE_WINDOW_C` without editing the authored sentences, or vice versa, and
     * this fails.
     */
    it('names the window\'s own temperature in the reset path, in both languages', () => {
        const resetPath = definition.experiment.resetPath.description;

        expect(resetPath.en).toContain(`${STABLE_WINDOW_C}`);
        expect(resetPath.fr).toContain(`${STABLE_WINDOW_C}`);
    });

    it('puts the window inside the authored bath range and on an authored step', () => {
        const bath = control('bathTempC');

        // Otherwise the instruction is unfollowable for a different reason: the player can read the number
        // and still not be able to reach it.
        expect(STABLE_WINDOW_C).toBeGreaterThanOrEqual(bath.min);
        expect(STABLE_WINDOW_C).toBeLessThanOrEqual(bath.max);
        expect(Number(((STABLE_WINDOW_C - bath.min) / bath.step).toFixed(6)) % 1).toBe(0);
        // And it is not where the bench starts, so reaching it is an action the player takes.
        expect(bath.defaultValue).not.toBe(STABLE_WINDOW_C);
    });
});

describe('the two contributions are separable from recorded evidence alone (AC2)', () => {
    /**
     * The reading, not the formula.
     *
     * AC2's first clause is that *"the deterministic model lets me hold one control and vary the other, so
     * the temperature contribution and the orientation contribution can each be isolated from recorded
     * evidence alone"*. So these rows record observations through the real bench and subtract the numbers
     * the **notebook** holds — never `ORIENTATION_AMPLITUDE` and `THERMAL_COEFFICIENT` re-multiplied, which
     * would be the calculator agreeing with itself. The constants appear only where they name the *state*
     * the player has to reach.
     *
     * That is the difference the story asks for in as many words: *"Assert the recorded results, not the
     * arithmetic."*
     */
    const results = (store: AppStore): readonly number[] => store.getState().runs.map(({ result }) => result.value);

    it('isolates the thermal contribution when the stone is held and the bath moved', () => {
        const store = atTheBench();
        const bath = control('bathTempC');
        record(store, 0, bath.defaultValue);
        record(store, 0, STABLE_WINDOW_C);
        const [warm, steady] = results(store);

        // One orientation throughout, so whatever moved between these two readings is the bath's doing and
        // nothing else. The player can read this difference straight off two notebook rows.
        expect(warm).not.toBe(steady);
        const perDegree = (warm! - steady!) / (bath.defaultValue - STABLE_WINDOW_C);
        // Linear in the bath temperature, which is what makes "hold one, move the other" actually work: a
        // third reading at a third temperature lands on the same slope rather than on a curve the player
        // would have to model.
        record(store, 0, bath.max);
        const third = results(store)[2]!;
        expect((third - steady!) / (bath.max - STABLE_WINDOW_C)).toBeCloseTo(perDegree, 10);
    });

    it('isolates the orientation contribution at the stable window, where the thermal term is gone', () => {
        const store = atTheBench();
        record(store, 0, STABLE_WINDOW_C);
        record(store, 90, STABLE_WINDOW_C);
        const [alongside, across] = results(store);

        // A sign reversal, and nothing else: same bath, quarter turn. This is the near-null the case is
        // about, and it is only visible once the confound has been removed — which is the teaching loop.
        expect(alongside).toBe(-across!);
        expect(alongside).not.toBe(0);
    });

    it('buries the orientation signal at the authored default, which is why the confound has to be removed', () => {
        const store = atTheBench();
        const bath = control('bathTempC');
        record(store, 0, bath.defaultValue);
        record(store, 90, bath.defaultValue);
        const warmSwing = Math.abs(results(store)[0]! - results(store)[1]!);

        const steadyStore = atTheBench();
        record(steadyStore, 0, STABLE_WINDOW_C);
        record(steadyStore, 90, STABLE_WINDOW_C);
        const steadySwing = Math.abs(results(steadyStore)[0]! - results(steadyStore)[1]!);

        // The orientation swing is the *same size* either way — the confound does not mask it by shrinking
        // it, it masks it by sitting on top of it. What changes is the size of the number the player is
        // reading it out of, which is why both readings at the default are ten times the swing.
        expect(warmSwing).toBeCloseTo(steadySwing, 10);
        expect(Math.min(...results(store).map(Math.abs))).toBeGreaterThan(warmSwing);
        expect(Math.max(...results(steadyStore).map(Math.abs))).toBeLessThanOrEqual(steadySwing);
    });

    it('records the rotation, the bath temperature and the displacement together on every observation', () => {
        // AC2's third clause: *"the notebook rows for this case carry the rotation, the bath temperature and
        // the displacement together, so a temperature trend across observations is readable from the
        // record."* Asserted on the record itself, because a row that carried only the result would make the
        // trend unreadable however separable the model is.
        const store = atTheBench();
        record(store, 0, 22);
        record(store, 90, STABLE_WINDOW_C);

        store.getState().runs.forEach((run) => {
            expect(Number.isFinite(run.controls.rotationDeg)).toBe(true);
            expect(Number.isFinite(run.controls.bathTempC)).toBe(true);
            expect(Number.isFinite(run.result.value)).toBe(true);
        });
        // And the two rows really do differ in the bath, so a trend exists to be read.
        expect(new Set(store.getState().runs.map(({ controls }) => controls.bathTempC)).size).toBe(2);
    });
});
