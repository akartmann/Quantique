import { decimalPlaces, formatMeasurement } from '../i18n/formatNumber';
import { DEFAULT_LOCALE, type Locale } from '../i18n/Locale';
import { resolveLocalizedText } from '../i18n/resolveLocalizedText';
import { createTranslator, translate, translateError, type Translator } from '../i18n/translate';
import type { ResultError } from '../errors/Result';
import type { ContextualArtifact, PrimaryControl } from '../../domain/cases/CaseDefinition';
import type { Colleague, ConclusionProposal, PredictionProposal } from '../../domain/cases/ColleagueCast';
import { selectDefensibleConclusionIds } from '../../domain/theory/conclusionProposals';
import type { RunRecord } from '../../domain/evidence/RunRecord';
import type { AppState, ComparisonNote, CompletionSnapshot, ReplayState } from './AppState';
import type { ConsultationProjection } from '../../domain/review/ConsultationRule';
import type { PeerReviewProjection } from '../../domain/review/peerReviewRules';
import type { DecisionHistoryEntry } from './AppState';
import { evaluateConclusionReadiness, type ConclusionReadiness, type TheoryBoardDraft } from '../../domain/theory/conclusionReadiness';
import type { CasePhase } from '../../domain/cases/CaseProgress';
import { createCaseRecordProjection } from './CaseRecordProjection';
import type { Result } from '../errors/Result';
import type { CaseRecord } from '../../schemas/CaseRecordSchema';
import type { RecognitionState } from '../../domain/recognition/recognitionRules';
import { evaluateContextReadiness, evaluatePredictionReadiness, type ContextReadiness, type PredictionReadiness } from '../../domain/cases/contextPredictionReadiness';

export const selectLocale = (state: AppState): Locale => state.locale;

export const selectPrimaryControl = (state: AppState, controlId: PrimaryControl['id']): PrimaryControl => {
    const control = state.caseDefinition.apparatus.primaryControls.find(({ id }) => id === controlId);
    if (!control) {
        throw new Error(`Unknown authored control: ${controlId}`);
    }
    return control;
};

export const selectControlValue = (state: AppState, controlId: PrimaryControl['id']): number =>
    state.activeControlValues[controlId];

/** Locale-aware display of a bounded control value (AC6). The authored step still sets the precision. */
export const selectFormattedControlValue = (state: AppState, controlId: PrimaryControl['id']): string => {
    const control = selectPrimaryControl(state, controlId);
    return formatMeasurement(selectLocale(state), selectControlValue(state, controlId), decimalPlaces(control.step), control.unit);
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

/**
 * Canonical English counterparts of {@link selectSourceLabel} and {@link selectFormattedControlValue},
 * for the retiring pre-pivot DOM panels.
 *
 * Those panels are deliberately not localized (see `docs/i18n-authoring.md`), and they read authored
 * text as `.en` directly. Calling the locale-aware selectors from inside them produced *mixed*
 * output — the same source named in French on one line and English on the next, and
 * `"Slit spacing set to 0,25 mm."` with a French decimal inside an English sentence. A panel picks
 * one language for everything it renders; these are how it picks English.
 */
export const selectCanonicalSourceLabel = (state: AppState, sourceId: string): string =>
    selectSourceById(state, sourceId)?.displayName.en ?? translate(DEFAULT_LOCALE, 'source.unavailable');

export const selectCanonicalControlValue = (state: AppState, controlId: PrimaryControl['id']): string => {
    const control = selectPrimaryControl(state, controlId);
    return formatMeasurement(DEFAULT_LOCALE, selectControlValue(state, controlId), decimalPlaces(control.step), control.unit);
};

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

export const selectCasePhase = (state: AppState): CasePhase => state.phase;

export const selectTheoryBoardDraft = (state: AppState): TheoryBoardDraft => state.theory;

export const selectSelectedSupportingRuns = (state: AppState): readonly RunRecord[] =>
    state.theory.selectedRunIds.flatMap((id) => state.runs.filter((run) => run.id === id));

export const selectSelectedSupportingSources = (state: AppState): readonly ContextualArtifact[] =>
    state.theory.selectedSourceIds.flatMap((id) => selectSourceById(state, id) ? [selectSourceById(state, id)!] : []);

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
        comparisonNotes: state.comparison.notes
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

const projectAttribution = (state: AppState, colleagueId: string): Readonly<{ colleagueName: string; roleLabel: string }> => {
    const locale = selectLocale(state);
    const colleague = selectColleagueById(state, colleagueId);
    // Zod guarantees the attribution resolves in authored content; this guards a degraded cached
    // case.json the same way `resolveLocalizedText` does, without printing "undefined" to a player.
    return colleague
        ? { colleagueName: colleague.name, roleLabel: translate(locale, `colleague.role.${colleague.role}`) }
        : { colleagueName: translate(locale, 'colleague.unattributed'), roleLabel: '' };
};

export const selectLocalizedPredictionProposals = (state: AppState): readonly LocalizedProposalProjection[] =>
    selectPredictionProposals(state).map((proposal) => Object.freeze({
        proposalId: proposal.id,
        ...projectAttribution(state, proposal.colleagueId),
        text: resolveLocalizedText(proposal.text, selectLocale(state))
    }));

export const selectLocalizedConclusionProposals = (state: AppState): readonly LocalizedProposalProjection[] =>
    selectConclusionProposals(state).map((proposal) => Object.freeze({
        proposalId: proposal.id,
        ...projectAttribution(state, proposal.colleagueId),
        text: resolveLocalizedText(proposal.claim, selectLocale(state)),
        limitation: resolveLocalizedText(proposal.limitation, selectLocale(state))
    }));

/**
 * `'{name} — {role}'`, or the name alone when a degraded cached `case.json` leaves the role empty.
 *
 * Shared rather than reimplemented per surface: the two-part template would otherwise render a
 * trailing em dash with nothing after it, and both the proposal cards and the dialogue speaker line
 * need the same fallback.
 */
export const formatAttribution = (t: Translator, attribution: Readonly<{ colleagueName: string; roleLabel: string }>): string =>
    attribution.roleLabel
        ? t('colleague.attribution', { name: attribution.colleagueName, role: attribution.roleLabel })
        : attribution.colleagueName;

/** One resolved line of authored dialogue, ready for a widget that knows nothing about the store. */
export type DialogueBeatProjection = Readonly<{
    id: string;
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
        speaker: formatAttribution(t, projectAttribution(state, beat.speakerId)),
        text: resolveLocalizedText(beat.text, locale)
    }));
};

export const selectConsultation = (state: AppState): ConsultationProjection | undefined => state.consultation;

export const selectPeerReview = (state: AppState): PeerReviewProjection | undefined => state.peerReview;

export const selectDecisionHistory = (state: AppState): readonly DecisionHistoryEntry[] => state.decisionHistory;

export const selectRecognition = (state: AppState): RecognitionState => state.recognition;

export const selectCompletionSnapshot = (state: AppState): CompletionSnapshot | undefined => state.completion;

export const selectReplayState = (state: AppState): ReplayState => state.replay;

export const selectPortableCaseRecord = (state: AppState): Result<CaseRecord> => createCaseRecordProjection(state);
