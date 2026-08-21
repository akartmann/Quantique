import { decimalPlaces, formatMeasurement, formatNumber } from '../i18n/formatNumber';
import type { Locale } from '../i18n/Locale';
import { resolveLocalizedText } from '../i18n/resolveLocalizedText';
import { formatAttribution, type Attribution } from '../i18n/formatAttribution';
import { createTranslator, translate, translateError } from '../i18n/translate';
import type { ResultError } from '../errors/Result';
import type { ContextualArtifact, PrimaryControl } from '../../domain/cases/CaseDefinition';
import type { Colleague, ConclusionProposal, PredictionProposal } from '../../domain/cases/ColleagueCast';
import { selectDefensibleConclusionIds } from '../../domain/theory/conclusionProposals';
import type { RunRecord } from '../../domain/evidence/RunRecord';
import { isAdvancedWavelengthUnlocked } from '../../domain/evidence/wavelengthComparison';
import { countSignificantMeasures } from '../../domain/evidence/significantMeasures';
import { selectColleagueHint } from '../../domain/review/colleagueHints';
import { selectReadingGateHint } from '../../domain/review/readingGateHints';
import type { AppState, ComparisonNote, CompletionSnapshot, ReplayState, RivalLabCritiqueEntry } from './AppState';
import type { RivalLabCritiqueSelection } from '../../domain/review/rivalLabRules';
import type { ConsultationProjection } from '../../domain/review/ConsultationRule';
import type { PeerReviewProjection } from '../../domain/review/peerReviewRules';
import type { DecisionHistoryEntry } from './AppState';
import { evaluateConclusionReadiness, type ConclusionReadiness, type TheoryBoardDraft } from '../../domain/theory/conclusionReadiness';
import type { CasePhase } from '../../domain/cases/CaseProgress';
import { createCaseRecordProjection } from './CaseRecordProjection';
import type { Result } from '../errors/Result';
import type { CaseRecord } from '../../schemas/CaseRecordSchema';
import type { RecognitionId, RecognitionItem, RecognitionState } from '../../domain/recognition/recognitionRules';
import { evaluateContextReadiness, evaluatePredictionReadiness, type ContextReadiness, type PredictionReadiness } from '../../domain/cases/contextPredictionReadiness';

/** The floor the record and the notebook already use for "nothing to show here", reused for parity. */
const NOTHING_RECORDED = '—';

export const selectLocale = (state: AppState): Locale => state.locale;

/**
 * An authored control, or `undefined` — the fallible seam.
 *
 * Added by the Story 3.1 review. `PrimaryControl['id']` was a two-member union until this story widened
 * it to `string`, so `tsc` used to reject a call naming a control the case does not author; now it does
 * not, and {@link selectPrimaryControl} throws. Presentation code must branch instead of throwing:
 * a throw inside `render()` is inside `dispatch() → notify()`, where it advances the phase, skips every
 * later subscriber and strands the router with no visible error (the 1.10 failure mode).
 *
 * Reach for this in anything a renderer calls. {@link selectPrimaryControl} stays for callers holding a
 * genuine invariant.
 */
export const findPrimaryControl = (state: AppState, controlId: PrimaryControl['id']): PrimaryControl | undefined =>
    state.caseDefinition.apparatus.primaryControls.find(({ id }) => id === controlId);

/**
 * An authored control, or a throw.
 *
 * **Not for render paths** — see {@link findPrimaryControl} for why, and prefer it there.
 */
export const selectPrimaryControl = (state: AppState, controlId: PrimaryControl['id']): PrimaryControl => {
    const control = findPrimaryControl(state, controlId);
    if (!control) {
        throw new Error(`Unknown authored control: ${controlId}`);
    }
    return control;
};

export const selectControlValue = (state: AppState, controlId: PrimaryControl['id']): number =>
    state.activeControlValues[controlId];

/**
 * Locale-aware display of a bounded control value (AC6). The authored step still sets the precision.
 *
 * **Total, not throwing** (Story 3.1 review): every caller is a renderer, and a control the case does not
 * author now type-checks. An unauthored or unrecorded control reads as the canonical number, or as the
 * "nothing recorded" dash — the same graceful degradation the notebook and the printable record already
 * apply to a record they cannot fully describe. A missing control here means degraded state (a restored
 * record against a changed `case.json`), never invalid authored content: the schema validates the
 * authored set at load.
 */
export const selectFormattedControlValue = (state: AppState, controlId: PrimaryControl['id']): string => {
    const control = findPrimaryControl(state, controlId);
    const value = selectControlValue(state, controlId);
    if (!Number.isFinite(value)) return NOTHING_RECORDED;
    if (!control) return formatNumber(selectLocale(state), value, 0);
    return formatMeasurement(selectLocale(state), value, decimalPlaces(control.step), control.unit);
};

/** The authored control name in the active language. SI unit symbols stay canonical. */
export const selectControlLabel = (state: AppState, controlId: PrimaryControl['id']): string =>
    resolveLocalizedText(selectPrimaryControl(state, controlId).label, selectLocale(state));

export const selectNotebookObservations = (state: AppState): readonly RunRecord[] => state.runs;

export const selectContextualArtifacts = (state: AppState): readonly ContextualArtifact[] => state.caseDefinition.contextualArtifacts;

export const selectSourceById = (state: AppState, sourceId: string): ContextualArtifact | undefined =>
    selectContextualArtifacts(state).find(({ id }) => id === sourceId);

export const selectInspectedSourceIds = (state: AppState): readonly string[] => state.inspectedSourceIds;

export const selectSavedPrediction = (state: AppState): string => state.prediction;

export const selectContextualReadiness = (state: AppState): ContextReadiness =>
    evaluateContextReadiness(state.caseDefinition, state.inspectedSourceIds);

/** Canonical English labels, as the domain computes them. Prefer {@link selectMissingContextArtifactNames} for display. */
export const selectMissingContextArtifactLabels = (state: AppState): readonly string[] =>
    selectContextualReadiness(state).missingArtifactLabels;

/** The same missing sources, resolved to the active language by stable id. */
export const selectMissingContextArtifactNames = (state: AppState): readonly string[] =>
    selectContextualReadiness(state).missingArtifactIds.map((sourceId) => selectSourceLabel(state, sourceId));

/**
 * The single presentation boundary for a `Result` failure (trap 4). The domain emits a stable `code`
 * plus a dev-facing English `message`; this resolves `error.<code>` in the active language.
 *
 * Codes whose authored string interpolates content have their parameters supplied *here* rather than
 * at each call site — a surface cannot forget one and leave a raw `{label}` on screen. The domain
 * still pre-formats the canonical English into `message`, which stays the fallback for any code the
 * layer does not carry a key for.
 */
export const selectLocalizedError = (state: AppState, error: ResultError): string => {
    const locale = selectLocale(state);
    if (error.code === 'missing-contextual-sources') {
        return translateError(locale, error, { label: selectMissingContextArtifactNames(state)[0] ?? '' });
    }
    // The refusal the player reads named "two" and "550 nm" as fixed prose, while the gate it explains
    // had already become case-driven — so a case requiring three baseline runs refused the fourth click
    // by telling the player to record two. The one copy of these two numbers the story set out to
    // de-duplicate that it did not (review 2026-08-19).
    //
    // No plural form needed: `requirements.minimumRuns` has a floor of 2 in the schema, so `count` is
    // never 1 in either locale.
    if (error.code === 'advanced-wavelength-locked') {
        return translateError(locale, error, {
            count: formatNumber(locale, state.caseDefinition.requirements.minimumRuns, 0),
            baseline: formatNumber(locale, state.caseDefinition.experiment.wavelengthComparison?.fixedMinimumPathNm ?? 0, 0)
        });
    }
    return translateError(locale, error);
};

export const selectPredictionReadiness = (state: AppState): PredictionReadiness =>
    evaluatePredictionReadiness(state.caseDefinition, state.prediction);

export const selectIsSourceInspected = (state: AppState, sourceId: string): boolean =>
    selectInspectedSourceIds(state).includes(sourceId);

export const selectSourceLabel = (state: AppState, sourceId: string): string => {
    const source = selectSourceById(state, sourceId);
    const locale = selectLocale(state);
    // No `sourceId` in the fallback: this reaches the printed record, and an internal id is not
    // something a learner should read in a document they take away.
    return source ? resolveLocalizedText(source.displayName, locale) : translate(locale, 'source.unavailable');
};

// `selectCanonicalSourceLabel` and `selectCanonicalControlValue` stood here, exported, called by
// nothing in `src/`, and consumed only by `tests/integration/LocaleProjection.test.ts`. **Deleted by
// Story 4.2 (§SS11).** Their docstring justified them by "the retiring pre-pivot DOM panels", which
// "are deliberately not localized and read authored text as `.en` directly" — and Story 2.12 deleted
// all eleven of those panels. So the justification named a surface that no longer exists, and the pair
// was a canonical-English projection with no consumer that renders canonical English: `src/ui/` holds
// three modules, and the one that shows a source label and a control value is
// `CaseRecordPrintView`, which is localized. `selectCanonicalControlValue` was met while tracing
// `formatMeasurement`'s callers for AC5 — it is the one caller of that function nothing renders — and
// deleting is the honest option of the two §SS11 offers, so the two `LocaleProjection.test.ts` rows
// that were their only readers went with them rather than a test disappearing quietly.
//
// The living pair is {@link selectSourceLabel} and {@link selectFormattedControlValue}, which take the
// locale from the store; the `DEFAULT_LOCALE`-fallback shape these had is the one §i18n forbids
// outright for any *new* call site.

export const selectRunObservation = (state: AppState, runId: string): Readonly<{ order: number; record: RunRecord }> | undefined => {
    const order = state.runs.findIndex(({ id }) => id === runId);
    return order === -1 ? undefined : { order: order + 1, record: state.runs[order] };
};

export const selectSelectedComparisonPair = (state: AppState): readonly [RunRecord, RunRecord] | undefined => {
    if (state.comparison.selectedRunIds.length !== 2) return undefined;
    const selected = state.comparison.selectedRunIds.map((id) => state.runs.find((run) => run.id === id));
    return selected[0] && selected[1] ? [selected[0], selected[1]] : undefined;
};

const pairKey = (runIds: readonly [string, string]): string => JSON.stringify([...runIds].sort());

export const selectComparisonNote = (state: AppState): ComparisonNote | undefined => {
    const pair = selectSelectedComparisonPair(state);
    if (!pair) return undefined;
    return state.comparison.notes.find((note) => pairKey(note.runIds) === pairKey([pair[0].id, pair[1].id]));
};

/**
 * The authored wavelengths the player may work at, in the order the bench offers them (Story 2.10).
 *
 * The fixed minimum path first, because it is always permitted and is the reset path back to the
 * history the case is actually about; the comparisons after it. Read from
 * `experiment.wavelengthComparison` rather than written down as 450 / 550 / 650: `reduceWavelengthSet`
 * refuses an unauthored value with `unavailable-wavelength`, so a surface that hard-coded a choice
 * would be offering the player a refusal.
 *
 * Empty for a case authoring no comparison at all, which the schema permits — the chooser then simply
 * is not drawn, rather than drawn with one inert option.
 */
export type WavelengthChoice = Readonly<{ wavelengthNm: 450 | 550 | 650; mode: 'minimum' | 'advanced' }>;

export const selectWavelengthChoices = (state: AppState): readonly WavelengthChoice[] => {
    const comparison = state.caseDefinition.experiment.wavelengthComparison;
    if (!comparison) return Object.freeze([]);
    return Object.freeze([
        { wavelengthNm: comparison.fixedMinimumPathNm, mode: 'minimum' } as WavelengthChoice,
        ...comparison.advancedChoicesNm.map((wavelengthNm) => ({ wavelengthNm, mode: 'advanced' } as WavelengthChoice))
    ]);
};

/**
 * Whether the optional comparison is available yet — the same count `reduceWavelengthSet` gates on.
 *
 * A selector rather than arithmetic in the renderer, because the *rule* is the store's: the bench has
 * to draw the locked state, and a surface that counted qualifying runs itself would be a second copy
 * of a gate that already exists and could drift from it. The refusal still comes from the reducer on
 * the click; this only decides how the choice is painted before one.
 */
export const selectAdvancedWavelengthUnlocked = (state: AppState): boolean =>
    // The *same* function `reduceWavelengthSet` refuses on, from the authored `fixedMinimumPathNm` rather
    // than a written-down 550. This selector and the reducer used to be two copies of one gate with the
    // number in each, so a case authoring a different baseline would have had the bench paint the
    // comparison unlocked while every click on it was refused (`deferred-work.md:99`, Story 3.1).
    isAdvancedWavelengthUnlocked(state.caseDefinition, state.runs);

export const selectCasePhase = (state: AppState): CasePhase => state.phase;

export const selectTheoryBoardDraft = (state: AppState): TheoryBoardDraft => state.theory;

export const selectSelectedSupportingRuns = (state: AppState): readonly RunRecord[] =>
    state.theory.selectedRunIds.flatMap((id) => state.runs.filter((run) => run.id === id));

export const selectSelectedSupportingSources = (state: AppState): readonly ContextualArtifact[] =>
    state.theory.selectedSourceIds.flatMap((id) => selectSourceById(state, id) ? [selectSourceById(state, id)!] : []);

/**
 * What the player's own record is still missing, resolved for display (Story 2.11, AC7).
 *
 * Localized **by `code`** through the existing `conclusion.missing.*` keys, never by
 * `missing[].message` — that field is the dev-facing English the domain pre-formats, and rendering it
 * is this project's most-repeated defect. The two codes whose authored string interpolates a count get
 * it from `requirements` here rather than at the call site, so a surface cannot forget one and leave a
 * raw `{count}` on screen; {@link selectLocalizedError} sets that precedent.
 *
 * **It carries no defensibility, and it cannot.** `ConclusionReadiness` has `status` and `missing[]`,
 * both derived from what the player has recorded; which conclusion the evidence *defends* lives in
 * {@link selectDefensibleConclusionProposalIds}, a different selector the boards deliberately cannot
 * reach. ADR-006 bars a surface from holding an opinion about a conclusion, not from reporting the
 * player's own record — the same reading `LibraryScene` already relies on for `selectContextualReadiness`.
 */
export const selectLocalizedConclusionReadiness = (state: AppState): readonly string[] => {
    const locale = selectLocale(state);
    const t = createTranslator(locale);
    const { minimumRuns, minimumSources } = state.caseDefinition.requirements;
    return Object.freeze(selectConclusionReadiness(state).missing.map(({ code }) => {
        if (code === 'minimum-runs') return t('conclusion.missing.minimum-runs', { count: minimumRuns });
        if (code === 'minimum-sources') return t('conclusion.missing.minimum-sources', { count: minimumSources });
        return t(`conclusion.missing.${code}`);
    }));
};

export const selectConclusionReadiness = (state: AppState): ConclusionReadiness => evaluateConclusionReadiness(state.caseDefinition, {
    runs: state.runs,
    inspectedSourceIds: state.inspectedSourceIds,
    comparisonNotes: state.comparison.notes
}, state.theory);

// --- Colleague cast and proposals ---------------------------------------------------------------

export const selectColleagues = (state: AppState): readonly Colleague[] => state.caseDefinition.colleagues;

export const selectColleagueById = (state: AppState, colleagueId: string): Colleague | undefined =>
    selectColleagues(state).find(({ id }) => id === colleagueId);

export const selectPredictionProposals = (state: AppState): readonly PredictionProposal[] =>
    state.caseDefinition.predictionProposals;

export const selectConclusionProposals = (state: AppState): readonly ConclusionProposal[] =>
    state.caseDefinition.conclusionProposals;

export const selectSelectedPredictionProposalId = (state: AppState): string | undefined =>
    state.selectedPredictionProposalId;

export const selectSelectedConclusionProposalId = (state: AppState): string | undefined =>
    state.selectedConclusionProposalId;

/**
 * The defensible-conclusion set, for the evaluator and the later rival-lab critique (Story 2.5).
 *
 * Deliberately kept out of {@link selectLocalizedConclusionProposals}: a renderer that could read
 * this could mark the "right" answer, which ADR-006 and AC3 both forbid.
 */
export const selectDefensibleConclusionProposalIds = (state: AppState): readonly string[] =>
    selectDefensibleConclusionIds(state.caseDefinition, {
        runs: state.runs,
        inspectedSourceIds: state.inspectedSourceIds,
        comparisonNotes: state.comparison.notes,
        // What the player pinned to this conclusion, for the predicates that judge a claim on its own
        // supporting evidence rather than on the whole notebook (code review 2026-08-19).
        selectedRunIds: state.theory.selectedRunIds
    });

/**
 * What a surface needs to render one attributed proposal, and nothing more.
 *
 * `text` is the active locale; `colleagueName` stays canonical (a proper noun); `roleLabel` resolves
 * the stable role enum through the i18n layer. There is no defensibility field, by design.
 */
export type LocalizedProposalProjection = Readonly<{
    proposalId: string;
    colleagueName: string;
    roleLabel: string;
    text: string;
    /** Present only for conclusion proposals, which carry a stated limitation alongside the claim. */
    limitation?: string;
}>;

/**
 * `unresolvedKey` is required, not defaulted: the label for an attribution that does not resolve is
 * surface-specific, and getting it wrong is silent. "Unattributed proposal" is right on a proposal card
 * and wrong in a dialogue speaker slot, where it describes the wrong kind of thing entirely (1.12
 * review). A default here would have turned choosing correctly into remembering to.
 */
const projectAttribution = (
    state: AppState,
    colleagueId: string,
    unresolvedKey: 'colleague.unattributed' | 'colleague.unattributedSpeaker'
): Attribution => {
    const locale = selectLocale(state);
    const colleague = selectColleagueById(state, colleagueId);
    // Zod guarantees the attribution resolves in authored content; this guards a degraded cached
    // case.json the same way `resolveLocalizedText` does, without printing "undefined" to a player.
    return colleague
        ? { colleagueName: colleague.name, roleLabel: translate(locale, `colleague.role.${colleague.role}`) }
        : { colleagueName: translate(locale, unresolvedKey), roleLabel: '' };
};

export const selectLocalizedPredictionProposals = (state: AppState): readonly LocalizedProposalProjection[] =>
    selectPredictionProposals(state).map((proposal) => Object.freeze({
        proposalId: proposal.id,
        ...projectAttribution(state, proposal.colleagueId, 'colleague.unattributed'),
        text: resolveLocalizedText(proposal.text, selectLocale(state))
    }));

export const selectLocalizedConclusionProposals = (state: AppState): readonly LocalizedProposalProjection[] =>
    selectConclusionProposals(state).map((proposal) => Object.freeze({
        proposalId: proposal.id,
        ...projectAttribution(state, proposal.colleagueId, 'colleague.unattributed'),
        text: resolveLocalizedText(proposal.claim, selectLocale(state)),
        limitation: resolveLocalizedText(proposal.limitation, selectLocale(state))
    }));

/** One resolved line of authored dialogue, ready for a widget that knows nothing about the store. */
export type DialogueBeatProjection = Readonly<{
    id: string;
    /**
     * Who is speaking, as the authored `colleagues[].id` — carried **beside** the formatted line, not
     * instead of it.
     *
     * The projection used to drop the id and keep only {@link speaker}, which is exactly enough to
     * *print* an attribution and not nearly enough to *stage* one: character staging has to know which
     * figure to foreground, and the only other route to that is reverse-matching a formatted,
     * localized, degradable string back to a cast member (Story 2.9). It carries no defensibility and
     * cannot: it is the beat's authored `speakerId` and nothing else.
     *
     * It is **not** guaranteed to resolve. A degraded cached `case.json` can name a colleague this
     * build no longer authors, in which case {@link speaker} already falls back to
     * `colleague.unattributedSpeaker` and a consumer must foreground nothing rather than throw.
     */
    speakerId: string;
    /** The attributed speaker line, already formatted. */
    speaker: string;
    text: string;
}>;

/** A scene that authors no conversation gets this, so a caller never has to guard on `undefined`. */
const NO_DIALOGUE_BEATS: readonly DialogueBeatProjection[] = Object.freeze([]);

/**
 * The authored beats of the scenario scene mirroring the **live phase**, resolved for display.
 *
 * Keyed on phase rather than scene key on purpose: `TheoryBoard` hosts both `synthesis` and `review`,
 * which are separate scenario-script entries with their own conversations.
 */
export const selectDialogueBeats = (state: AppState): readonly DialogueBeatProjection[] => {
    const scene = state.caseDefinition.scenarioScript.scenes.find(({ phase }) => phase === selectCasePhase(state));
    const beats = scene?.dialogueBeats;
    if (!beats || beats.length === 0) return NO_DIALOGUE_BEATS;

    const locale = selectLocale(state);
    const t = createTranslator(locale);
    return beats.map((beat) => Object.freeze({
        id: beat.id,
        speakerId: beat.speakerId,
        speaker: formatAttribution(t, projectAttribution(state, beat.speakerId, 'colleague.unattributedSpeaker')),
        text: resolveLocalizedText(beat.text, locale)
    }));
};

// --- Significant-measure gate and colleague hints (Story 2.6) -----------------------------------

/**
 * How many recorded observations count as distinguishing measurements.
 *
 * Derived on call rather than stored: the count is a pure function of `runs`, which only ever grows,
 * so there is nothing to keep in sync, nothing to clear on a phase move or a replay, and nothing to
 * persist. It is one `Set` build over `runs`, and it is not on a render path.
 *
 * An earlier version of this comment justified the cost with "`flow.maximumExperimentCycles` caps the
 * notebook at four". It does not, and Story 4.2 (AC6, decision D1) settled that it never will: the field
 * is authored session-shape metadata, read at load by a refinement and by nothing at runtime.
 *
 * The absence of a cap is what keeps the gate honest, which is why this is not a bug awaiting a fix but
 * the design: a player below the bar can always record another run, so a refusal is a nudge rather than a
 * dead end. A real quota would invert that — four observations at one arrangement would leave the gate
 * unsatisfiable with nothing able to clear `runs`. `CaseDefinitionSchema`'s `flow` shape carries the full
 * reasoning.
 */
export const selectSignificantMeasureCount = (state: AppState): number =>
    countSignificantMeasures(state.caseDefinition.significanceRule, state.runs);

/**
 * The gate as a count against the authored bar.
 *
 * The laboratory reads only `isMet`, to colour the advance control. `count` and `required` are
 * carried for tests and for the debrief, and deliberately reach no in-play surface: "1 of 2" on the
 * bench would be a progress score, and the design forbids scores. The colleague's line is how the
 * player learns where they stand, in fiction and without a number.
 *
 * An earlier version of this comment said the shape existed "so a surface can explain it rather than
 * just obey it", which promised a surface that does not exist and should not (review, 2026-08-06).
 */
export type SignificantMeasureGate = Readonly<{ count: number; required: number; isMet: boolean }>;

export const selectSignificantMeasureGate = (state: AppState): SignificantMeasureGate => {
    const count = selectSignificantMeasureCount(state);
    const required = state.caseDefinition.requirements.minimumSignificantRuns;
    return Object.freeze({ count, required, isMet: count >= required });
};

/** What the laboratory needs to speak the hint, and nothing more. */
export type LocalizedColleagueHint = Readonly<{
    hintId: string;
    speaker: string;
    line: string;
}>;

/**
 * The in-fiction nudge for a player whose evidence has not cleared the gate, resolved for display.
 *
 * **It carries no defensibility field, and it never can** — the projection has three string members
 * and the domain function it wraps never reads the conclusion proposals at all. A hint names a
 * measurement to take; a surface that could see which conclusion the evidence defends could mark the
 * "right" answer, which ADR-006 forbids.
 *
 * `undefined` means the player needs no hint: either the gate is met, or no authored hint matches.
 * Validation guarantees shipped content always has a line for an unmet gate, so in practice the
 * first case is the one a caller sees.
 */
export const selectLocalizedColleagueHint = (state: AppState): LocalizedColleagueHint | undefined => {
    const hint = selectColleagueHint(state.caseDefinition, state.runs);
    if (!hint) return undefined;
    const locale = selectLocale(state);
    const t = createTranslator(locale);
    return Object.freeze({
        hintId: hint.hintId,
        speaker: formatAttribution(t, projectAttribution(state, hint.colleagueId, 'colleague.unattributedSpeaker')),
        line: resolveLocalizedText(hint.line, locale)
    });
};

// --- Reading gate (Story 2.8) -------------------------------------------------------------------

/**
 * The in-fiction line for a player whose required reading is incomplete, resolved for display.
 *
 * Shaped exactly like {@link LocalizedColleagueHint} and for the same reasons — three string members,
 * no defensibility field, and none is reachable: the domain function it wraps reads only the inspected
 * artifacts and never the conclusion proposals. The two hint selectors are siblings and stay
 * symmetrical deliberately; the gates they answer are different (`inspectedSourceIds` here, `runs`
 * there) and neither can substitute for the other.
 *
 * `undefined` means the player needs no line: either the reading is complete, or no authored line
 * matches. Validation guarantees shipped content always has one for an incomplete reading, so in
 * practice the first case is the one a caller sees — and `resolveAdvanceRefusal`'s `colleagueAnswers`
 * argument is how a caller handles the second without going silent.
 */
export const selectLocalizedReadingGateHint = (state: AppState): LocalizedColleagueHint | undefined => {
    const hint = selectReadingGateHint(state.caseDefinition, state.inspectedSourceIds);
    if (!hint) return undefined;
    const locale = selectLocale(state);
    const t = createTranslator(locale);
    return Object.freeze({
        hintId: hint.hintId,
        speaker: formatAttribution(t, projectAttribution(state, hint.colleagueId, 'colleague.unattributedSpeaker')),
        line: resolveLocalizedText(hint.line, locale)
    });
};

// --- Rival lab ----------------------------------------------------------------------------------

/**
 * The standing challenge, as stable IDs.
 *
 * Note the name it shares with `rivalLabRules.selectRivalLabCritique(definition, proposalId)`. The two
 * do not meet — the reducer calls the domain one, this module does not import it — so no alias is
 * needed here; the codebase keeps `selectConsultation` distinct between `ConsultationRule.ts` and this
 * module the same way.
 */
export const selectRivalLabCritique = (state: AppState): RivalLabCritiqueSelection | undefined => state.rivalLabCritique;

export const selectCritiqueHistory = (state: AppState): readonly RivalLabCritiqueEntry[] => state.critiqueHistory;

/** What the rival-lab surface needs to render the standing challenge, and nothing more. */
export type LocalizedRivalLabCritique = Readonly<{
    speaker: string;
    line: string;
    accentColor: string;
}>;

/**
 * The standing challenge, resolved for display.
 *
 * **It carries no defensibility field, and it never can.** It projects the critique for the proposal
 * that was already submitted — not the defensible set, and not which of the four would have drawn no
 * challenge. A surface able to read that could mark the "right" answer, which ADR-006 forbids and
 * which `ColleagueRenderer` and `ProposalChoice` are both built around.
 */
export const selectLocalizedRivalLabCritique = (state: AppState): LocalizedRivalLabCritique | undefined => {
    const selection = selectRivalLabCritique(state);
    if (!selection) return undefined;
    const { rivalLab } = state.caseDefinition;
    const critique = rivalLab.critiques.find(({ id }) => id === selection.critiqueId);
    // A degraded cached `case.json` can carry a critique ID this build no longer authors. Rendering an
    // attributed heading with no line under it is worse than rendering nothing at all.
    if (!critique) return undefined;
    const locale = selectLocale(state);
    const t = createTranslator(locale);
    return Object.freeze({
        // The rival's name is canonical — a proper noun, like every `colleagues[].name` — and only his
        // role resolves through the i18n layer.
        speaker: formatAttribution(t, { colleagueName: rivalLab.name, roleLabel: t('rivalLab.role') }),
        line: resolveLocalizedText(critique.line, locale),
        accentColor: rivalLab.accentColor
    });
};

export const selectConsultation = (state: AppState): ConsultationProjection | undefined => state.consultation;

export const selectPeerReview = (state: AppState): PeerReviewProjection | undefined => state.peerReview;

export const selectDecisionHistory = (state: AppState): readonly DecisionHistoryEntry[] => state.decisionHistory;

export const selectRecognition = (state: AppState): RecognitionState => state.recognition;

export const selectCompletionSnapshot = (state: AppState): CompletionSnapshot | undefined => state.completion;

export const selectReplayState = (state: AppState): ReplayState => state.replay;

export const selectPortableCaseRecord = (state: AppState): Result<CaseRecord> => createCaseRecordProjection(state);

// --- The debrief (Story 2.11) -------------------------------------------------------------------

/**
 * One recognition line, resolved for display.
 *
 * `achieved` is carried so a surface can present the whole list as an account rather than only the
 * items that landed. It is not a score and must never be rendered as one (§Guided adventure): the
 * design forbids a progress number, and the debrief presents these as things the player *did*.
 */
export type LocalizedRecognitionItem = Readonly<{
    id: RecognitionId;
    label: string;
    description: string;
    achieved: boolean;
}>;

/**
 * The recognition account, resolved by stable id against the eight `recognition.<id>.*` keys that
 * ship in both bundles.
 *
 * **The items are an argument, not a read of `state.recognition`.** The debrief shows
 * `completion.recognition` — the snapshot taken at first completion — and a selector that read the
 * live field would show the *replay's* recognition on a completed record (D2). Making the caller
 * name its source is what stops that being a mistake somebody has to remember not to make.
 *
 * `deriveRecognition` emits canonical English `label`/`description` inside the persisted
 * `RecognitionState`, because `validateCaseRecordForDefinition` recomputes and string-compares it on
 * load — emitting the active locale would reject every record saved in the other language (D3). So
 * the record keeps its English and the *display* resolves by `id`. The canonical strings on the
 * argument are deliberately not read here.
 */
export const selectLocalizedRecognition = (
    state: AppState,
    items: readonly RecognitionItem[]
): readonly LocalizedRecognitionItem[] => {
    const t = createTranslator(selectLocale(state));
    return Object.freeze(items.map((item) => Object.freeze({
        id: item.id,
        label: t(`recognition.${item.id}.label`),
        description: t(`recognition.${item.id}.description`),
        achieved: item.achieved
    })));
};

/** One past challenge, attributed and resolved. Shaped like {@link LocalizedRivalLabCritique}. */
export type LocalizedCritiqueHistoryEntry = Readonly<{
    critiqueId: string;
    speaker: string;
    line: string;
}>;

/**
 * Every challenge the **completed** investigation drew, resolved for display (AC3).
 *
 * Over `completion.critiqueHistory`, never `state.critiqueHistory` (D2): `reduceReplayStart` clears
 * the live list and a re-completion would refill it with the second pass's challenges, so reading it
 * here would show an empty list after a replay and somebody else's challenges after a re-completion
 * — both are exactly the rewriting AC2 forbids. Outside a completed case there is nothing to show,
 * so this is empty rather than a live projection of the current attempt.
 *
 * A `critiqueId` a degraded cached `case.json` no longer authors is **dropped**, the same rule
 * {@link selectLocalizedRivalLabCritique} states: an attributed heading with no line under it is
 * worse than nothing at all.
 *
 * It carries no defensibility field and never can — it projects challenges that were already drawn,
 * not which conclusion would have drawn none (ADR-006).
 */
export const selectLocalizedCritiqueHistory = (state: AppState): readonly LocalizedCritiqueHistoryEntry[] => {
    const history = selectCompletionSnapshot(state)?.critiqueHistory ?? [];
    if (history.length === 0) return NO_CRITIQUE_HISTORY;
    const { rivalLab } = state.caseDefinition;
    const t = createTranslator(selectLocale(state));
    // The rival's name is canonical — a proper noun — and only his role resolves through i18n.
    const speaker = formatAttribution(t, { colleagueName: rivalLab.name, roleLabel: t('rivalLab.role') });
    const locale = selectLocale(state);
    return Object.freeze(history.flatMap((entry) => {
        const critique = rivalLab.critiques.find(({ id }) => id === entry.critiqueId);
        return critique
            ? [Object.freeze({ critiqueId: entry.critiqueId, speaker, line: resolveLocalizedText(critique.line, locale) })]
            : [];
    }));
};

const NO_CRITIQUE_HISTORY: readonly LocalizedCritiqueHistoryEntry[] = Object.freeze([]);

/**
 * The peer-review outcome, resolved for display.
 *
 * **`PeerReviewIssue.feedback` and `.revisionPath` are never rendered.** Both are canonical `.en`,
 * persisted inside `DecisionHistoryEntry.feedback` and recomputed-and-string-compared on load, so
 * they must not vary with the language (D3) — and the retired `ConclusionReviewPanel` rendered them
 * straight to the player, which is this project's most-repeated defect. The display resolves
 * `caseDefinition.peerReviewRules` by `ruleId` to the authored `LocalizedText` instead.
 *
 * A `ruleId` the case no longer authors falls back to the canonical `.en`. That is the one place it
 * is the right answer: the alternative is dropping a finding the player's revision was judged
 * against, and silence about a finding is worse than an untranslated one.
 *
 * `status: 'unavailable'` resolves the existing `review.unavailable` key rather than the projection's
 * `message`, which is `CANONICAL_UNAVAILABLE_MESSAGE` and English by contract.
 */
export type LocalizedPeerReviewIssue = Readonly<{
    ruleId: string;
    feedback: string;
    revisionPath: string;
}>;

export type LocalizedPeerReview =
    | Readonly<{ status: 'reviewed'; issues: readonly LocalizedPeerReviewIssue[] }>
    | Readonly<{ status: 'unavailable'; message: string }>;

export const selectLocalizedPeerReview = (state: AppState): LocalizedPeerReview | undefined => {
    const projection = selectPeerReview(state);
    if (!projection) return undefined;
    const locale = selectLocale(state);
    if (projection.status === 'unavailable') {
        return Object.freeze({ status: 'unavailable' as const, message: translate(locale, 'review.unavailable') });
    }
    const rules = state.caseDefinition.peerReviewRules;
    return Object.freeze({
        status: 'reviewed' as const,
        issues: Object.freeze(projection.issues.map((issue) => {
            const rule = rules.find(({ id }) => id === issue.ruleId);
            return Object.freeze({
                ruleId: issue.ruleId,
                feedback: rule ? resolveLocalizedText(rule.feedback, locale) : issue.feedback,
                revisionPath: rule ? resolveLocalizedText(rule.revisionPath, locale) : issue.revisionPath
            });
        }))
    });
};

/** One cited source under the historical comparison, with its provenance said out loud (AC2). */
export type LocalizedDebriefSource = Readonly<{
    sourceId: string;
    name: string;
    /** The four provenance categories, named — `primary artifact`, `reconstruction`, and the rest. */
    provenance: string;
    sourceType: string;
    rightsStatus: string;
}>;

/** Everything the debrief renders that comes out of authored content, resolved for display. */
export type LocalizedDebrief = Readonly<{
    summary: string;
    historicalComparison: Readonly<{ title: string; text: string; sources: readonly LocalizedDebriefSource[] }>;
    deeperTheory: Readonly<{ title: string; text: string }>;
    /**
     * The authored counterfactual warning. It already reads as one in both locales; the retired DOM
     * panel used it as a *button* label and hard-coded a separate English-only warning line beside it.
     * The control's own label is the interface key `advance.replay`, never this.
     */
    replayLabel: string;
}>;

/**
 * The authored debrief, resolved for display.
 *
 * Cites from `historicalComparison.sourceIds`, which the schema cross-checks against
 * `contextualArtifacts`. **Not `debrief.sourceRefs`**, which is validated only as non-empty strings and
 * which nothing reads — and whose **first** id is a dangling reference: it authors
 * `['michelson-morley-1887-ajs', 'morley-miller-1907-final-report']` against artifacts
 * `michelson-morley-1887` and `morley-miller-1907-final-report`, so the second resolves and the first does
 * not (`-ajs` is that artifact's `provenance.reference`, not its id). Story 4.3 established that and
 * recorded it in `deferred-work.md` and the case review; this docstring said "two ids match no artifact"
 * until its code review, which is the same overstatement one field over. Deciding whether to fix the
 * content or delete the field is Epic 5's first story, which owns it by name.
 *
 * A cited id that resolves to no artifact is dropped rather than rendered as an empty citation, the
 * same degraded-content rule the critique history follows. Shipped content cannot reach it; the
 * schema's cross-check is on the definition, and a degraded cached `case.json` is not.
 */
export const selectLocalizedDebrief = (state: AppState): LocalizedDebrief => {
    const { debrief } = state.caseDefinition;
    const locale = selectLocale(state);
    const t = createTranslator(locale);
    return Object.freeze({
        summary: resolveLocalizedText(debrief.summary, locale),
        historicalComparison: Object.freeze({
            title: resolveLocalizedText(debrief.historicalComparison.title, locale),
            text: resolveLocalizedText(debrief.historicalComparison.text, locale),
            sources: Object.freeze(debrief.historicalComparison.sourceIds.flatMap((sourceId) => {
                const artifact = selectSourceById(state, sourceId);
                return artifact ? [Object.freeze({
                    sourceId,
                    name: resolveLocalizedText(artifact.displayName, locale),
                    provenance: t(`source.provenanceName.${artifact.provenance.category}`),
                    sourceType: t(`source.type.${artifact.sourceType}`),
                    rightsStatus: t(`source.rights.${artifact.rightsStatus}`)
                })] : [];
            }))
        }),
        deeperTheory: Object.freeze({
            title: resolveLocalizedText(debrief.deeperTheory.title, locale),
            text: resolveLocalizedText(debrief.deeperTheory.text, locale)
        }),
        replayLabel: resolveLocalizedText(debrief.replayLabel, locale)
    });
};
