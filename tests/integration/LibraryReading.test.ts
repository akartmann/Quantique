import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import {
    selectCasePhase,
    selectContextualArtifacts,
    selectContextualReadiness,
    selectInspectedSourceIds,
    selectIsSourceInspected,
    selectLocalizedError,
    selectLocalizedReadingGateHint
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { advanceRefusalRegister, resolveAdvanceRefusal } from '../../src/adapters/phaser/renderers/advanceView';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The reading room's pickup path, through **public actions and selectors only** (Story 2.8, AC8).
 *
 * Nothing here constructs a scene, a renderer, or a Phaser object: Vitest has no canvas, and the rule
 * is to assert public actions, selectors, and rendered text rather than private fields. What that
 * leaves is the whole of the contract the reading room depends on — that recording a reading moves
 * context readiness, that the phase gate refuses before and succeeds after, that re-reading is the
 * store's refusal and therefore the surface's responsibility to avoid, and that the refusal it does
 * meet is one a colleague can answer.
 *
 * Run against the **shipped** Young content rather than a fixture, because half of what it checks is
 * whether the authored case actually satisfies its own gate.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

const freshStore = (): AppStore => createStore(createInitialAppState(definition, 'en'));
const artifactIds = (): readonly string[] => definition.contextualArtifacts.map(({ id }) => id);

describe('recording a reading', () => {
    it('moves context readiness from incomplete to ready as each artifact is read', () => {
        const store = freshStore();
        const [first, second] = artifactIds();

        expect(selectContextualReadiness(store.getState()).status).toBe('incomplete');
        expect(selectContextualReadiness(store.getState()).missingArtifactIds).toStrictEqual([first, second]);

        expect(store.dispatch({ type: 'source.inspected', sourceId: first! })).toMatchObject({ ok: true });
        // Half-read is still incomplete, and the *remaining* artifact is named — which is what the
        // colleague's line and the localized error both interpolate.
        expect(selectContextualReadiness(store.getState()).status).toBe('incomplete');
        expect(selectContextualReadiness(store.getState()).missingArtifactIds).toStrictEqual([second]);

        expect(store.dispatch({ type: 'source.inspected', sourceId: second! })).toMatchObject({ ok: true });
        expect(selectContextualReadiness(store.getState()).status).toBe('ready');
        expect(selectInspectedSourceIds(store.getState())).toStrictEqual([first, second]);
    });

    it('is recorded in either order', () => {
        const store = freshStore();
        const [first, second] = artifactIds();

        store.dispatch({ type: 'source.inspected', sourceId: second! });
        store.dispatch({ type: 'source.inspected', sourceId: first! });

        expect(selectContextualReadiness(store.getState()).status).toBe('ready');
    });

    it('refuses a second reading of the same artifact, which is why the room must not dispatch one', () => {
        // The exact reason `LibraryRenderer.pickUp` checks `selectIsSourceInspected` before dispatching
        // (AC2). Re-opening a reference is a normal act; the reducer is right to call a duplicated
        // *dispatch* an error, and the surface is wrong if it provokes one it then has to explain away.
        const store = freshStore();
        const [first] = artifactIds();

        store.dispatch({ type: 'source.inspected', sourceId: first! });
        expect(selectIsSourceInspected(store.getState(), first!)).toBe(true);

        const duplicate = store.dispatch({ type: 'source.inspected', sourceId: first! });

        expect(duplicate).toMatchObject({ ok: false });
        if (duplicate.ok) return;
        expect(duplicate.error.code).toBe('duplicate-inspected-source');
        // And the record is unchanged — a refused dispatch is inert, which is what lets the transient
        // message slot anchor on state identity.
        expect(selectInspectedSourceIds(store.getState())).toStrictEqual([first]);
    });

    it('refuses an artifact this case does not carry', () => {
        const refusal = freshStore().dispatch({ type: 'source.inspected', sourceId: 'not-on-this-shelf' });

        expect(refusal).toMatchObject({ ok: false });
        if (!refusal.ok) expect(refusal.error.code).toBe('unknown-source-id');
    });
});

describe('leaving the reading room', () => {
    it('is refused with missing-contextual-sources before the reading is complete, and succeeds after', () => {
        const store = freshStore();

        expect(selectCasePhase(store.getState())).toBe('context');
        const refused = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });

        expect(refused).toMatchObject({ ok: false });
        if (!refused.ok) expect(refused.error.code).toBe('missing-contextual-sources');
        // Refused, and *still in the room* — no partial move, nothing lost.
        expect(selectCasePhase(store.getState())).toBe('context');

        artifactIds().forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));

        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' })).toMatchObject({ ok: true });
        expect(selectCasePhase(store.getState())).toBe('prediction');
    });

    it('is still refused when only one artifact has been read', () => {
        const store = freshStore();
        store.dispatch({ type: 'source.inspected', sourceId: artifactIds()[0]! });

        const refused = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });

        expect(refused).toMatchObject({ ok: false });
        if (!refused.ok) expect(refused.error.code).toBe('missing-contextual-sources');
    });
});

describe('what answers the refusal', () => {
    it('routes the refusal to the colleague, with a line that actually applies', () => {
        // The three pieces the reading room wires together, checked as a chain rather than one by one:
        // the code is in the gate register, a line applies to this evidence, and the resolved answer
        // therefore withholds the error so the colleague is not talked over.
        const store = freshStore();
        const refused = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        expect(refused.ok).toBe(false);
        if (refused.ok) return;

        const state = store.getState();
        const hint = selectLocalizedReadingGateHint(state);

        expect(advanceRefusalRegister(refused.error.code)).toBe('gate');
        expect(hint).toBeDefined();
        expect(hint!.line.trim().length).toBeGreaterThan(0);
        expect(hint!.speaker.trim().length).toBeGreaterThan(0);
        expect(resolveAdvanceRefusal({
            code: refused.error.code,
            localizedError: selectLocalizedError(state, refused.error),
            colleagueAnswers: hint !== undefined
        })).toStrictEqual({ register: 'gate', message: undefined });
    });

    it('names the artifact still outstanding, and changes which one as the reading progresses', () => {
        const store = freshStore();
        const [first, second] = artifactIds();

        const beforeAnyReading = selectLocalizedReadingGateHint(store.getState());
        store.dispatch({ type: 'source.inspected', sourceId: first! });
        const afterFirst = selectLocalizedReadingGateHint(store.getState());

        expect(beforeAnyReading?.hintId).toBeDefined();
        expect(afterFirst?.hintId).toBeDefined();
        // The line moves on with the player. A gate that said the same thing after they had acted on
        // it would read as though the reading had not counted.
        expect(afterFirst!.hintId).not.toBe(beforeAnyReading!.hintId);

        store.dispatch({ type: 'source.inspected', sourceId: second! });
        // And withdraws itself entirely once there is nothing left to say.
        expect(selectLocalizedReadingGateHint(store.getState())).toBeUndefined();
    });

    it('carries a localized error as the fallback, with the missing artifact interpolated into it', () => {
        // `selectLocalizedError` supplies `{label}` itself for this code, so a surface cannot leave a
        // raw placeholder on screen. If no line applied, this is the string the room would show.
        const store = freshStore();
        const refused = store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });
        expect(refused.ok).toBe(false);
        if (refused.ok) return;

        const message = selectLocalizedError(store.getState(), refused.error);

        expect(message).not.toContain('{label}');
        expect(message).toContain(selectContextualArtifacts(store.getState())[0]!.displayName.en);
    });

    it('speaks the line in the active locale', () => {
        const french = createStore(createInitialAppState(definition, 'fr'));
        const english = freshStore();

        const frenchHint = selectLocalizedReadingGateHint(french.getState());
        const englishHint = selectLocalizedReadingGateHint(english.getState());
        const authored = definition.readingGateHints.find(({ id }) => id === frenchHint?.hintId);

        expect(frenchHint?.hintId).toBe(englishHint?.hintId);
        expect(frenchHint?.line).toBe(authored?.line.fr);
        expect(englishHint?.line).toBe(authored?.line.en);
        expect(frenchHint?.line).not.toBe(englishHint?.line);
    });
});

describe('what a completed reading unblocks', () => {
    it('leaves the prediction proposals choosable, which they are not before the move', () => {
        // AC5's other half. The prediction cards refuse on `missing-contextual-sources` today because
        // the phase never leaves `context` — this is that claim, made against public actions.
        const store = freshStore();
        const proposalId = definition.predictionProposals[0]!.id;

        expect(store.dispatch({ type: 'prediction.proposalChosen', proposalId })).toMatchObject({ ok: false });

        artifactIds().forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));
        store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' });

        expect(store.dispatch({ type: 'prediction.proposalChosen', proposalId })).toMatchObject({ ok: true });
    });
});

/**
 * AC3's unusable-artifact branches, which the shipped case cannot reach (2.8 review).
 *
 * `LibraryRenderer.pickUp` guards on `isSourceEligibleForInspection` and on the presence of a
 * rendition before it dispatches, and both Young artifacts are `reviewed` with a rendition — so those
 * two branches, and the two localized lines they paint, had never been executed by any test. What can
 * be pinned without a canvas is the *store-side* half: what the reducer does with each shape, which is
 * what makes the renderer's guards necessary rather than decorative.
 */
describe('an artifact the room cannot open', () => {
    const withFirstArtifact = (patch: Record<string, unknown>): CaseDefinition => {
        const [first, ...rest] = definition.contextualArtifacts;
        return { ...definition, contextualArtifacts: [{ ...first, ...patch }, ...rest] } as CaseDefinition;
    };

    it('is refused by the reducer when its rights are unreviewed, so the surface must not dispatch', () => {
        const ineligible = withFirstArtifact({ rightsStatus: 'incomplete', textualRendition: undefined });
        const store = createStore(createInitialAppState(ineligible, 'en'));
        const [firstId] = artifactIds();

        const result = store.dispatch({ type: 'source.inspected', sourceId: firstId });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('source-not-eligible');
        // Which is why `pickUp` answers this one with authored copy instead: dispatching would provoke
        // a refusal the player did nothing to earn.
        expect(selectIsSourceInspected(store.getState(), firstId)).toBe(false);
    });

    it('leaves context readiness permanently incomplete, which is why the schema now forbids authoring it', () => {
        // The dead end recorded in `deferred-work.md` for Story 3.1: an ineligible artifact counts as
        // missing forever, and no action can clear it. Pinned here so the day the domain rule changes,
        // this test is what says so.
        const ineligible = withFirstArtifact({ rightsStatus: 'incomplete', textualRendition: undefined });
        const store = createStore(createInitialAppState(ineligible, 'en'));

        artifactIds().forEach((sourceId) => store.dispatch({ type: 'source.inspected', sourceId }));

        expect(selectContextualReadiness(store.getState()).status).toBe('incomplete');
        expect(selectContextualReadiness(store.getState()).missingArtifactIds).toContain(artifactIds()[0]);
    });

    it('cannot be authored as reviewed-with-nothing-to-read, because the gate could never be satisfied', () => {
        // The sibling shape, closed at the schema in this review rather than deferred: the reducer
        // *would* have accepted it, so nothing downstream could have caught it.
        const [first, ...rest] = definition.contextualArtifacts;
        const { textualRendition: _dropped, ...withoutRendition } = first;
        const unreadable = { ...definition, contextualArtifacts: [withoutRendition, ...rest] };

        const parsed = CaseDefinitionSchema.safeParse(unreadable);

        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(parsed.error.issues.some(({ path }) => path.join('.') === 'contextualArtifacts.0.textualRendition')).toBe(true);
        }
    });
});
