import type { AppStore } from '../../core/store/createStore';
import {
    selectCasePhase,
    selectContextualReadiness,
    selectMissingContextArtifactLabels,
    selectSavedPrediction
} from '../../core/store/selectors';

const phaseCopy = (phase: string): string => {
    switch (phase) {
        case 'context': return 'Inspect both reviewed contextual artifacts before moving to the prediction step.';
        case 'prediction': return 'Record a tentative, revisable prediction before beginning the experiment.';
        case 'experiment': return 'Your contextual record and prediction are saved. Continue with the bounded laboratory.';
        default: return `Your contextual record is retained as the investigation continues through ${phase}.`;
    }
};

/** Semantic owner of the Young context and prediction gates; source cards remain in Curated Record. */
export const mountCaseContextAndPrediction = (root: HTMLElement, store: AppStore): (() => void) => {
    let statusMessage = '';
    let draftPrediction = '';
    let lastSavedPrediction = '';
    let requestedFocusKey: string | undefined;

    const activeFocusKey = (): string | undefined => {
        const activeElement = document.activeElement;
        return activeElement instanceof HTMLElement && root.contains(activeElement)
            ? activeElement.dataset.contextPredictionFocus
            : undefined;
    };

    const render = (): void => {
        const focusKey = requestedFocusKey ?? activeFocusKey();
        requestedFocusKey = undefined;
        const state = store.getState();
        const phase = selectCasePhase(state);
        const readiness = selectContextualReadiness(state);
        const missingLabels = selectMissingContextArtifactLabels(state);
        const savedPrediction = selectSavedPrediction(state);
        if (savedPrediction !== lastSavedPrediction) {
            draftPrediction = savedPrediction;
            lastSavedPrediction = savedPrediction;
        }

        const panel = document.createElement('section');
        panel.className = 'case-context-prediction';
        panel.setAttribute('aria-label', 'Young context and prediction');
        panel.dataset.contextPredictionFocus = 'panel';
        panel.tabIndex = -1;
        const heading = document.createElement('h2');
        heading.textContent = 'Young context and prediction';
        const dispute = document.createElement('p');
        dispute.textContent = state.caseDefinition.openingDispute;
        const guidance = document.createElement('p');
        guidance.textContent = phaseCopy(phase);
        const sourceSummary = document.createElement('p');
        const requiredSourceCount = state.caseDefinition.contextualArtifacts.length;
        sourceSummary.className = 'context-readiness-summary';
        sourceSummary.textContent = readiness.status === 'ready'
            ? `${requiredSourceCount} of ${requiredSourceCount} reviewed contextual artifacts inspected.`
            : `${requiredSourceCount - missingLabels.length} of ${requiredSourceCount} reviewed contextual artifacts inspected. Still needed: ${missingLabels.join(', ')}.`;
        const status = document.createElement('p');
        status.className = 'context-prediction-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-label', 'Context and prediction status');
        status.textContent = statusMessage;
        panel.append(heading, dispute, guidance, sourceSummary, status);

        const predictionLabel = document.createElement('label');
        predictionLabel.htmlFor = 'case-prediction';
        predictionLabel.textContent = 'Tentative prediction';
        const prediction = document.createElement('textarea');
        prediction.id = 'case-prediction';
        prediction.dataset.contextPredictionFocus = 'prediction';
        prediction.value = draftPrediction;
        prediction.addEventListener('input', () => { draftPrediction = prediction.value; });
        const record = document.createElement('button');
        record.type = 'button';
        record.dataset.contextPredictionFocus = 'record';
        record.textContent = 'Record a prediction';
        record.addEventListener('click', () => {
            requestedFocusKey = 'record';
            const transition = store.dispatch({ type: 'prediction.recorded', prediction: draftPrediction });
            statusMessage = transition.ok
                ? 'Your tentative prediction is recorded and can be revised.'
                : transition.error.message;
            if (transition.ok) draftPrediction = selectSavedPrediction(store.getState());
            render();
        });
        panel.append(predictionLabel, prediction, record);

        if (phase === 'context' || phase === 'prediction') {
            const continueButton = document.createElement('button');
            continueButton.type = 'button';
            continueButton.dataset.contextPredictionFocus = 'continue';
            continueButton.textContent = phase === 'context' ? 'Continue to prediction' : 'Continue to experimentation';
            continueButton.addEventListener('click', () => {
                requestedFocusKey = phase === 'prediction' ? 'panel' : 'continue';
                const transition = store.dispatch({ type: 'case.phaseAdvance', nextPhase: phase === 'context' ? 'prediction' : 'experiment' });
                statusMessage = transition.ok
                    ? phase === 'context'
                        ? 'Context is complete. Record or revise your tentative prediction.'
                        : 'Prediction recorded. The experiment is ready to begin.'
                    : transition.error.message;
                render();
            });
            panel.append(continueButton);
        }

        root.replaceChildren(panel);
        if (focusKey) root.querySelector<HTMLElement>('[data-context-prediction-focus="' + focusKey + '"]')?.focus();
    };

    const unsubscribe = store.subscribe(render);
    render();
    return () => { unsubscribe(); root.replaceChildren(); };
};
