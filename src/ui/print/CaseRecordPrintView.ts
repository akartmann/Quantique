import type { AppStore } from '../../core/store/createStore';
import { selectCompletionSnapshot, selectContextualArtifacts, selectDecisionHistory, selectNotebookObservations, selectSavedPrediction, selectTheoryBoardDraft } from '../../core/store/selectors';

const term = (label: string, value: string): HTMLDivElement => {
    const item = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    item.append(dt, dd);
    return item;
};

/** Semantic, selector-driven print record; it does not inspect the Phaser canvas. */
export const mountCaseRecordPrintView = (root: HTMLElement, store: AppStore): (() => void) => {
    const render = (): void => {
        const state = store.getState();
        const record = document.createElement('article');
        record.className = 'case-record-print-view';
        record.setAttribute('aria-label', 'Printable investigation record');
        const heading = document.createElement('h2'); heading.textContent = 'Investigation record';
        const settings = document.createElement('section');
        const settingsHeading = document.createElement('h3'); settingsHeading.textContent = 'Apparatus settings';
        const settingsList = document.createElement('dl');
        state.caseDefinition.apparatus.primaryControls.forEach((control) => settingsList.append(term(control.label, `${state.activeControlValues[control.id]} ${control.unit}`)));
        settings.append(settingsHeading, settingsList);
        const observations = document.createElement('section');
        const observationsHeading = document.createElement('h3'); observationsHeading.textContent = 'Recorded observations';
        const observationList = document.createElement('ol');
        selectNotebookObservations(state).forEach((run, index) => {
            const item = document.createElement('li');
            item.textContent = `Observation ${index + 1}: ${run.result.label}: ${run.result.value} ${run.result.unit}. ${run.timestamp}. Model ${run.experimentModelVersion}. ${run.modelInputs ? `Inputs: ${run.modelInputs.wavelengthNm} nm (${run.modelInputs.wavelengthMode}), ${run.modelInputs.screenDistanceM} m screen distance, ${run.modelInputs.slitSpacingMm} mm slit spacing.` : 'Pre-model observation; not treated as a physical Young measurement.'}`;
            observationList.append(item);
        });
        if (!observationList.children.length) observationList.append(Object.assign(document.createElement('li'), { textContent: 'No observations recorded.' }));
        observations.append(observationsHeading, observationList);
        const sources = document.createElement('section');
        const sourceHeading = document.createElement('h3'); sourceHeading.textContent = 'Inspected sources';
        const sourceList = document.createElement('ul');
        selectContextualArtifacts(state).filter((source) => state.inspectedSourceIds.includes(source.id)).forEach((source) => {
            const item = document.createElement('li');
            item.textContent = `${source.displayName} — ${source.provenance.category.replace(/-/g, ' ')}; ${source.provenance.reference}.`;
            sourceList.append(item);
        });
        if (!sourceList.children.length) sourceList.append(Object.assign(document.createElement('li'), { textContent: 'No sources inspected.' }));
        sources.append(sourceHeading, sourceList);
        const prediction = document.createElement('section');
        const predictionHeading = document.createElement('h3'); predictionHeading.textContent = 'Tentative prediction';
        const predictionList = document.createElement('dl');
        predictionList.append(term('Recorded prediction', selectSavedPrediction(state) || 'No prediction recorded.'));
        prediction.append(predictionHeading, predictionList);
        const comparison = document.createElement('section');
        const comparisonHeading = document.createElement('h3'); comparisonHeading.textContent = 'Comparison notes';
        const comparisonList = document.createElement('ul');
        state.comparison.notes.forEach((note) => {
            const item = document.createElement('li');
            item.textContent = `${note.runIds.map((id) => {
                const index = state.runs.findIndex((run) => run.id === id);
                return index === -1 ? 'Unavailable observation' : `Observation ${index + 1}`;
            }).join(' and ')}: ${note.text}`;
            comparisonList.append(item);
        });
        if (!comparisonList.children.length) comparisonList.append(Object.assign(document.createElement('li'), { textContent: 'No comparison notes saved.' }));
        comparison.append(comparisonHeading, comparisonList);
        const theory = selectTheoryBoardDraft(state);
        const conclusion = document.createElement('section');
        const conclusionHeading = document.createElement('h3'); conclusionHeading.textContent = 'Conclusion and limitation';
        const conclusionList = document.createElement('dl');
        conclusionList.append(term('Conclusion', theory.conclusion || 'No conclusion recorded.'), term('Stated limitation', theory.limitation || 'No limitation recorded.'));
        conclusion.append(conclusionHeading, conclusionList);
        const history = document.createElement('section');
        const historyHeading = document.createElement('h3'); historyHeading.textContent = 'Decision history';
        const historyList = document.createElement('ol');
        selectDecisionHistory(state).forEach((entry) => {
            const item = document.createElement('li');
            const selectedRuns = entry.selectedRunIds.map((id) => {
                const index = state.runs.findIndex((run) => run.id === id);
                return index === -1 ? 'Unavailable observation' : `Observation ${index + 1}`;
            }).join(', ') || 'No observations';
            const selectedSources = entry.selectedSourceIds.map((id) => {
                const source = selectContextualArtifacts(state).find((artifact) => artifact.id === id);
                return source?.displayName ?? 'Unavailable source';
            }).join(', ') || 'No sources';
            const feedback = entry.feedback.status === 'reviewed'
                ? entry.feedback.issues.length
                    ? entry.feedback.issues.map((issue) => issue.feedback).join(' ')
                    : 'Peer review found no issues.'
                : entry.feedback.message;
            item.textContent = `Version ${entry.version}, saved ${entry.timestamp}. Conclusion: ${entry.conclusion}. Limitation: ${entry.limitation}. Supporting observations: ${selectedRuns}. Supporting sources: ${selectedSources}. Peer feedback: ${feedback}`;
            historyList.append(item);
        });
        if (!historyList.children.length) historyList.append(Object.assign(document.createElement('li'), { textContent: 'No reviewed revisions saved.' }));
        history.append(historyHeading, historyList);
        const completion = selectCompletionSnapshot(state);
        if (completion) {
            const completed = document.createElement('section');
            const completedHeading = document.createElement('h3'); completedHeading.textContent = 'Historical completion snapshot';
            const completedText = document.createElement('p'); completedText.textContent = `Completed ${completion.completedAt}. Final conclusion: ${completion.finalDecision.conclusion}. The historical record remains unchanged during counterfactual replay.`;
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
