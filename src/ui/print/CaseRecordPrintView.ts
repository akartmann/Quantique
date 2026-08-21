import { resolveLocalizedText } from '../../core/i18n/resolveLocalizedText';
import { createTranslator, type Translator } from '../../core/i18n/translate';
import type { AppStore } from '../../core/store/createStore';
import {
    selectCompletionSnapshot, selectConclusionProposals, selectContextualArtifacts, selectControlLabel,
    selectDecisionHistory, selectFormattedControlValue, selectLocale, selectNotebookObservations,
    selectSavedPrediction, selectSelectedConclusionProposalId, selectSourceLabel, selectTheoryBoardDraft
} from '../../core/store/selectors';
import type { AppState } from '../../core/store/AppState';
import { composeCaseSummary } from '../../domain/evidence/caseSummary';
import { formatRecordedValue } from '../../core/i18n/formatNumber';
import { formatRecordedResult, resolveExperimentModel } from '../../domain/apparatus/experimentModels';
import { CANONICAL_UNAVAILABLE_MESSAGE, type PeerReviewProjection } from '../../domain/review/peerReviewRules';

const term = (label: string, value: string): HTMLDivElement => {
    const item = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    item.append(dt, dd);
    return item;
};

const listItem = (text: string): HTMLLIElement => Object.assign(document.createElement('li'), { textContent: text });

/**
 * The conclusion or limitation a *reader* should see, resolved by `conclusionProposalId`.
 *
 * The player never types a conclusion — `reduceTheoryConclusionProposalChosen` writes
 * `proposal.claim.en` and `proposal.limitation.en`, the canonical English, because that is the draft
 * `evaluatePeerReview` and the `peer-overreach` phrase set read. Every other field on this page is
 * resolved for the reader ({@link localizedFeedback} by `ruleId`, control labels, source display names,
 * recorded results), so printing the draft raw was the one place a French player's record came back in
 * English — on the sentence the whole record is about.
 *
 * Substitution is conditional on `proposal[field].en === persisted`: the persisted text must still *be*
 * this proposal's canonical English for the French half to be the same sentence. When it has drifted —
 * a hand-edited record, or one written before an authored copy edit that
 * `validateCaseRecordForDefinition` did not migrate — the persisted text is printed verbatim instead.
 * That is the same principle `localizedFeedback` applies to a retired `review.unavailable` message: the
 * record is the authored account of what the learner was actually told, so it is never overwritten by
 * text they did not see.
 */
const localizedConclusionText = (
    state: AppState,
    proposalId: string | undefined,
    persisted: string,
    field: 'claim' | 'limitation'
): string => {
    if (!proposalId) return persisted;
    const proposal = selectConclusionProposals(state).find(({ id }) => id === proposalId);
    if (!proposal || proposal[field].en !== persisted) return persisted;
    return resolveLocalizedText(proposal[field], selectLocale(state));
};

/**
 * Peer-review issues carry canonical English feedback because that text is persisted and compared on
 * load. The display resolves the active language from the authored rule the issue names, keyed by
 * `ruleId`, and falls back to the canonical text if a rule ever disappears from the definition.
 */
const localizedFeedback = (state: AppState, t: Translator, feedback: PeerReviewProjection): string => {
    // `review.unavailable` mirrors the canonical string the domain persists. A record written by an
    // older definition may carry a different one; that message is the authored record of what the
    // learner was told, so it is preferred over the current wording rather than overwritten.
    if (feedback.status !== 'reviewed') {
        return feedback.message === CANONICAL_UNAVAILABLE_MESSAGE ? t('review.unavailable') : feedback.message;
    }
    if (!feedback.issues.length) return t('print.history.noIssues');
    const locale = selectLocale(state);
    return feedback.issues.map((issue) => {
        const rule = state.caseDefinition.peerReviewRules.find(({ id }) => id === issue.ruleId);
        return rule ? resolveLocalizedText(rule.feedback, locale) : issue.feedback;
    }).join(' ');
};

/** Semantic, selector-driven print record; it does not inspect the Phaser canvas. */
export const mountCaseRecordPrintView = (root: HTMLElement, store: AppStore): (() => void) => {
    const render = (): void => {
        const state = store.getState();
        const locale = selectLocale(state);
        const t = createTranslator(locale);
        const runLabel = (runId: string): string => {
            const index = state.runs.findIndex((run) => run.id === runId);
            return index === -1 ? t('print.observation.unavailable') : t('print.observation.label', { index: index + 1 });
        };

        const record = document.createElement('article');
        record.className = 'case-record-print-view';
        record.setAttribute('aria-label', t('print.ariaLabel'));
        const heading = document.createElement('h2'); heading.textContent = t('print.title');

        const settings = document.createElement('section');
        const settingsHeading = document.createElement('h3'); settingsHeading.textContent = t('print.settings.heading');
        const settingsList = document.createElement('dl');
        state.caseDefinition.apparatus.primaryControls.forEach((control) =>
            settingsList.append(term(selectControlLabel(state, control.id), selectFormattedControlValue(state, control.id))));
        settings.append(settingsHeading, settingsList);

        const observations = document.createElement('section');
        const observationsHeading = document.createElement('h3'); observationsHeading.textContent = t('print.observations.heading');
        const observationList = document.createElement('ol');
        const runModel = resolveExperimentModel(state.caseDefinition.experiment.modelId);
        selectNotebookObservations(state).forEach((run, index) => {
            // Matched per run, then used for the label *and* the unit: both are canonical English on the
            // record, and a run this case's model did not produce keeps its own.
            const matchedRunModel = runModel && run.experimentModelVersion === state.caseDefinition.experiment.modelVersion
                ? runModel
                : undefined;
            const inputs = run.modelInputs
                ? t('print.observations.inputs', {
                    wavelength: run.modelInputs.wavelengthNm,
                    mode: t(`lab.wavelengthMode.${run.modelInputs.wavelengthMode}`),
                    screenDistance: formatRecordedValue(locale, run.modelInputs.screenDistanceM, 'm'),
                    slitSpacing: formatRecordedValue(locale, run.modelInputs.slitSpacingMm, 'mm')
                })
                // **The run's own apparatus settings, for a model that records no optical inputs.**
                // This read `print.observations.preModel` — "not treated as a physical Young
                // measurement" — which for a case whose model records none was printed over *every*
                // observation the player made, in the record they take away (Story 3.2). Composed from
                // the case's authored controls, so it describes the bench that was actually used.
                : t('print.observations.settings', {
                    settings: state.caseDefinition.apparatus.primaryControls
                        .map((control) => t('lab.idle.setting', {
                            value: formatRecordedValue(locale, run.controls[control.id] ?? Number.NaN, control.unit),
                            inlineLabel: resolveLocalizedText(control.inlineLabel, locale)
                        }))
                        .join(t('list.separator'))
                });
            observationList.append(listItem(t('print.observations.item', {
                index: index + 1,
                // The stored `result.label` stays canonical English so saved runs revalidate, so it is
                // localized by the *model's* declared key rather than shown as-is (Story 3.2). Young
                // already did this for its one label; stating the key on the model generalises it to a
                // case whose observations would otherwise print English prose in a French record.
                // A run this case's model did not produce keeps its own canonical label, which is the
                // honest rendering of a reading whose provenance is something else.
                label: matchedRunModel ? t(matchedRunModel.resultLabelKey) : run.result.label,
                value: formatRecordedResult(locale, matchedRunModel, run.result, t),
                timestamp: run.timestamp,
                model: run.experimentModelVersion,
                inputs
            })));
        });
        if (!observationList.children.length) observationList.append(listItem(t('print.observations.empty')));
        observations.append(observationsHeading, observationList);

        const sources = document.createElement('section');
        const sourceHeading = document.createElement('h3'); sourceHeading.textContent = t('print.sources.heading');
        const sourceList = document.createElement('ul');
        selectContextualArtifacts(state).filter((source) => state.inspectedSourceIds.includes(source.id)).forEach((source) => {
            sourceList.append(listItem(t('print.sources.item', {
                name: resolveLocalizedText(source.displayName, locale),
                // The provenance category is an enum id, not prose: resolve it rather than
                // de-kebabing it into English.
                category: t(`source.provenance.${source.provenance.category}`),
                reference: source.provenance.reference
            })));
        });
        if (!sourceList.children.length) sourceList.append(listItem(t('print.sources.empty')));
        sources.append(sourceHeading, sourceList);

        const prediction = document.createElement('section');
        const predictionHeading = document.createElement('h3'); predictionHeading.textContent = t('print.prediction.heading');
        const predictionList = document.createElement('dl');
        predictionList.append(term(t('print.prediction.term'), selectSavedPrediction(state) || t('print.prediction.empty')));
        prediction.append(predictionHeading, predictionList);

        const comparison = document.createElement('section');
        const comparisonHeading = document.createElement('h3'); comparisonHeading.textContent = t('print.comparison.heading');
        const comparisonList = document.createElement('ul');
        state.comparison.notes.forEach((note) => {
            comparisonList.append(listItem(t('print.comparison.item', {
                runs: note.runIds.map(runLabel).join(t('print.comparison.join')),
                note: note.text
            })));
        });
        if (!comparisonList.children.length) comparisonList.append(listItem(t('print.comparison.empty')));
        comparison.append(comparisonHeading, comparisonList);

        const theory = selectTheoryBoardDraft(state);
        const conclusion = document.createElement('section');
        const conclusionHeading = document.createElement('h3'); conclusionHeading.textContent = t('print.conclusion.heading');
        const conclusionList = document.createElement('dl');
        conclusionList.append(
            term(t('print.conclusion.term'),
                localizedConclusionText(state, selectSelectedConclusionProposalId(state), theory.conclusion, 'claim')
                || t('print.conclusion.empty')),
            term(t('print.limitation.term'),
                localizedConclusionText(state, selectSelectedConclusionProposalId(state), theory.limitation, 'limitation')
                || t('print.limitation.empty'))
        );
        conclusion.append(conclusionHeading, conclusionList);

        const history = document.createElement('section');
        const historyHeading = document.createElement('h3'); historyHeading.textContent = t('print.history.heading');
        const historyList = document.createElement('ol');
        selectDecisionHistory(state).forEach((entry) => {
            historyList.append(listItem(t('print.history.item', {
                version: entry.version,
                timestamp: entry.timestamp,
                conclusion: localizedConclusionText(state, entry.conclusionProposalId, entry.conclusion, 'claim'),
                limitation: localizedConclusionText(state, entry.conclusionProposalId, entry.limitation, 'limitation'),
                runs: entry.selectedRunIds.map(runLabel).join(', ') || t('print.history.noRuns'),
                sources: entry.selectedSourceIds.map((id) => selectSourceLabel(state, id)).join(', ') || t('print.history.noSources'),
                feedback: localizedFeedback(state, t, entry.feedback)
            })));
        });
        if (!historyList.children.length) historyList.append(listItem(t('print.history.empty')));
        history.append(historyHeading, historyList);

        // The neutral auto-summary (FR23, AC5). One section, in the file that already builds settings,
        // observations, sources and prediction the same way — and no new `src/ui/` module, which
        // project-context forbids.
        //
        // Here rather than on the canvas because this file is the **retained** portable record (ADR-007)
        // and ADR-011/NFR20's sole exemption, and it earns that exemption by dispatching nothing. A
        // read-only summary dispatches nothing either, so rendering it creates no canvas-completeness
        // obligation. The alternative — shipping the authored field with nothing reading it — is the
        // unreachable-content defect this codebase's refinements exist to catch.
        const summary = document.createElement('section');
        const summaryHeading = document.createElement('h3'); summaryHeading.textContent = t('print.summary.heading');
        const summaryText = document.createElement('p');
        // Composed in the domain and merely printed here: the composer is pure and unit-tested directly,
        // and this view stays a projection. It states what the player did and never evaluates it —
        // no defensibility, no ranking, no "correct" (ADR-006, UX-DR5).
        summaryText.textContent = composeCaseSummary(state.caseDefinition, {
            runs: state.runs,
            inspectedSourceIds: state.inspectedSourceIds,
            decisionHistory: selectDecisionHistory(state)
        }, locale);
        summary.append(summaryHeading, summaryText);

        const completion = selectCompletionSnapshot(state);
        if (completion) {
            const completed = document.createElement('section');
            const completedHeading = document.createElement('h3'); completedHeading.textContent = t('print.completion.heading');
            const completedText = document.createElement('p');
            completedText.textContent = t('print.completion.text', {
                timestamp: completion.completedAt,
                conclusion: localizedConclusionText(state, completion.finalDecision.conclusionProposalId,
                    completion.finalDecision.conclusion, 'claim')
            });
            completed.append(completedHeading, completedText);
            record.append(heading, summary, settings, observations, sources, prediction, comparison, conclusion, history, completed);
        } else {
            record.append(heading, summary, settings, observations, sources, prediction, comparison, conclusion, history);
        }
        root.replaceChildren(record);
    };
    const unsubscribe = store.subscribe(render);
    render();
    return () => { unsubscribe(); root.replaceChildren(); };
};
