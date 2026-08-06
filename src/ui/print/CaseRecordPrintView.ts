import { formatRecordedValue } from '../../core/i18n/formatNumber';
import { resolveLocalizedText } from '../../core/i18n/resolveLocalizedText';
import { createTranslator, type Translator } from '../../core/i18n/translate';
import type { AppStore } from '../../core/store/createStore';
import {
    selectCompletionSnapshot, selectContextualArtifacts, selectControlLabel, selectDecisionHistory,
    selectFormattedControlValue, selectLocale, selectNotebookObservations, selectSavedPrediction,
    selectSourceLabel, selectTheoryBoardDraft
} from '../../core/store/selectors';
import type { AppState } from '../../core/store/AppState';
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
        selectNotebookObservations(state).forEach((run, index) => {
            const inputs = run.modelInputs
                ? t('print.observations.inputs', {
                    wavelength: run.modelInputs.wavelengthNm,
                    mode: t(`lab.wavelengthMode.${run.modelInputs.wavelengthMode}`),
                    screenDistance: formatRecordedValue(locale, run.modelInputs.screenDistanceM, 'm'),
                    slitSpacing: formatRecordedValue(locale, run.modelInputs.slitSpacingMm, 'mm')
                })
                : t('print.observations.preModel');
            observationList.append(listItem(t('print.observations.item', {
                index: index + 1,
                // The stored `result.label` stays canonical English so saved runs revalidate, and a
                // Young run always carries the same one — so that measurement localizes by key.
                // A pre-model observation (`modelInputs` is optional in `RunRecordSchema`) is *not*
                // that measurement, and printing it as "fringe spacing" would contradict the
                // "not treated as a physical Young measurement" line beside it. Its canonical label
                // is shown as-is rather than mislabelled.
                label: run.modelInputs ? t('experiment.result.fringeSpacing') : run.result.label,
                value: formatRecordedValue(locale, run.result.value, run.result.unit),
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
            term(t('print.conclusion.term'), theory.conclusion || t('print.conclusion.empty')),
            term(t('print.limitation.term'), theory.limitation || t('print.limitation.empty'))
        );
        conclusion.append(conclusionHeading, conclusionList);

        const history = document.createElement('section');
        const historyHeading = document.createElement('h3'); historyHeading.textContent = t('print.history.heading');
        const historyList = document.createElement('ol');
        selectDecisionHistory(state).forEach((entry) => {
            historyList.append(listItem(t('print.history.item', {
                version: entry.version,
                timestamp: entry.timestamp,
                conclusion: entry.conclusion,
                limitation: entry.limitation,
                runs: entry.selectedRunIds.map(runLabel).join(', ') || t('print.history.noRuns'),
                sources: entry.selectedSourceIds.map((id) => selectSourceLabel(state, id)).join(', ') || t('print.history.noSources'),
                feedback: localizedFeedback(state, t, entry.feedback)
            })));
        });
        if (!historyList.children.length) historyList.append(listItem(t('print.history.empty')));
        history.append(historyHeading, historyList);

        const completion = selectCompletionSnapshot(state);
        if (completion) {
            const completed = document.createElement('section');
            const completedHeading = document.createElement('h3'); completedHeading.textContent = t('print.completion.heading');
            const completedText = document.createElement('p');
            completedText.textContent = t('print.completion.text', {
                timestamp: completion.completedAt,
                conclusion: completion.finalDecision.conclusion
            });
            completed.append(completedHeading, completedText);
            record.append(heading, settings, observations, sources, prediction, comparison, conclusion, history, completed);
        } else {
            record.append(heading, settings, observations, sources, prediction, comparison, conclusion, history);
        }
        root.replaceChildren(record);
    };
    const unsubscribe = store.subscribe(render);
    render();
    return () => { unsubscribe(); root.replaceChildren(); };
};
