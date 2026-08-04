import type { Result } from '../../core/errors/Result';
import type { AppStore } from '../../core/store/createStore';
import { selectComparisonNote, selectNotebookObservations, selectPrimaryControl, selectSelectedComparisonPair } from '../../core/store/selectors';
import type { RunRecord } from '../../domain/evidence/RunRecord';

export type PrepareRun = () => Result<RunRecord>;

const definition = (term: string, value: string): HTMLDivElement => {
    const item = document.createElement('div');
    const definitionTerm = document.createElement('dt');
    definitionTerm.textContent = term;
    const definitionValue = document.createElement('dd');
    definitionValue.textContent = value;
    item.append(definitionTerm, definitionValue);
    return item;
};

const recordDetails = (record: RunRecord, observationNumber: number, store: AppStore): HTMLElement => {
    const article = document.createElement('article');
    article.className = 'notebook-observation';
    const heading = document.createElement('h3');
    heading.textContent = `Observation ${observationNumber}`;
    const details = document.createElement('dl');
    details.className = 'notebook-details';
    const slitSpacing = selectPrimaryControl(store.getState(), 'slitSpacingMm');
    const screenDistance = selectPrimaryControl(store.getState(), 'screenDistanceM');
    details.append(
        definition('Recorded order', String(observationNumber)),
        definition('Timestamp', record.timestamp),
        definition('Experiment model version', record.experimentModelVersion),
        definition(slitSpacing.label, `${record.controls.slitSpacingMm} ${slitSpacing.unit}`),
        definition(screenDistance.label, `${record.controls.screenDistanceM} ${screenDistance.unit}`),
        definition('Observed result', `${record.result.label}: ${record.result.value} ${record.result.unit}`),
        definition('Linked evidence', record.linkedEvidenceIds.length ? record.linkedEvidenceIds.join(', ') : 'None recorded')
    );
    article.append(heading, details);
    return article;
};

export const mountNotebookPanel = (root: HTMLElement, store: AppStore, prepareRun: PrepareRun): (() => void) => {
    let statusMessage = '';
    let noteDraft = '';
    let noteDraftPairKey = '';

    const setRecovery = (): void => {
        statusMessage = 'This observation could not be recorded. Your existing observations are unchanged.';
    };

    const render = (): void => {
        const state = store.getState();
        const observations = selectNotebookObservations(state);
        const panel = document.createElement('section');
        panel.className = 'measurement-notebook';
        panel.setAttribute('aria-label', 'Measurement notebook');

        const heading = document.createElement('h2');
        heading.textContent = 'Measurement notebook';
        const introduction = document.createElement('p');
        introduction.textContent = 'Record prepared observations, then compare any two saved observations as evidence.';
        const recordButton = document.createElement('button');
        recordButton.type = 'button';
        recordButton.textContent = 'Record prepared observation';
        recordButton.addEventListener('click', () => {
            const prepared = prepareRun();
            if (!prepared.ok || !store.dispatch({ type: 'run.record', record: prepared.value }).ok) {
                setRecovery();
                render();
                return;
            }

            statusMessage = `Observation ${store.getState().runs.length} recorded.`;
            render();
        });

        const status = document.createElement('p');
        status.className = 'notebook-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-label', 'Measurement notebook status');
        status.textContent = statusMessage;

        const observationsHeading = document.createElement('h3');
        observationsHeading.textContent = 'Recorded observations';
        const list = document.createElement('ol');
        list.className = 'notebook-observations';
        observations.forEach((record, index) => {
            const item = document.createElement('li');
            item.append(recordDetails(record, index + 1, store));
            const selection = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = state.comparison.selectedRunIds.includes(record.id);
            checkbox.setAttribute('aria-label', `Select Observation ${index + 1} for comparison`);
            checkbox.addEventListener('change', () => {
                const transition = store.dispatch(checkbox.checked
                    ? { type: 'comparison.runSelected', runId: record.id }
                    : { type: 'comparison.runUnselected', runId: record.id });
                if (!transition.ok) {
                    statusMessage = 'Choose two different saved observations to compare. Your existing observations are unchanged.';
                }
                render();
            });
            selection.append(checkbox, ' Select for comparison');
            item.append(selection);
            list.append(item);
        });

        panel.append(heading, introduction, recordButton, status, observationsHeading, list);
        const selectedPair = selectSelectedComparisonPair(state);
        if (selectedPair) {
            const selectedPairKey = [selectedPair[0].id, selectedPair[1].id].sort().join('::');
            if (noteDraftPairKey !== selectedPairKey) {
                noteDraft = '';
                noteDraftPairKey = selectedPairKey;
            }
            const comparison = document.createElement('section');
            comparison.className = 'run-comparison';
            comparison.setAttribute('aria-label', 'Run comparison');
            const comparisonHeading = document.createElement('h3');
            comparisonHeading.textContent = 'Run comparison';
            const columns = document.createElement('div');
            columns.className = 'run-comparison-columns';
            selectedPair.forEach((record) => {
                const index = observations.findIndex(({ id }) => id === record.id);
                columns.append(recordDetails(record, index + 1, store));
            });
            const noteLabel = document.createElement('label');
            noteLabel.htmlFor = 'comparison-note';
            noteLabel.textContent = 'Comparison note';
            const note = document.createElement('textarea');
            note.id = 'comparison-note';
            note.value = noteDraft || selectComparisonNote(state)?.text || '';
            note.addEventListener('input', () => { noteDraft = note.value; });
            const saveNote = document.createElement('button');
            saveNote.type = 'button';
            saveNote.textContent = 'Save comparison note';
            saveNote.addEventListener('click', () => {
                const transition = store.dispatch({ type: 'comparison.noteSaved', note: note.value });
                if (!transition.ok) {
                    statusMessage = 'This comparison note could not be saved. Your existing observations are unchanged.';
                } else {
                    noteDraft = note.value;
                    statusMessage = 'Comparison note saved.';
                }
                render();
            });
            comparison.append(comparisonHeading, columns, noteLabel, note, saveNote);
            panel.append(comparison);
        } else if (observations.length >= 2) {
            const guidance = document.createElement('p');
            guidance.textContent = 'Select two saved observations to compare their evidence side by side.';
            panel.append(guidance);
        }

        root.replaceChildren(panel);
    };

    const unsubscribe = store.subscribe(render);
    render();
    return () => {
        unsubscribe();
        root.replaceChildren();
    };
};
