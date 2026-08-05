import type { AppStore } from '../../core/store/createStore';
import type { ContextualArtifact } from '../../domain/cases/CaseDefinition';
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
export type CaseContextAndPredictionController = Readonly<{
    destroy: () => void;
    openLectureRecord: (source: ContextualArtifact, returnFocus: () => void) => void;
}>;

export const mountCaseContextAndPrediction = (root: HTMLElement, store: AppStore): CaseContextAndPredictionController => {
    let statusMessage = '';
    let draftPrediction = '';
    let lastSavedPrediction = '';
    let requestedFocusKey: string | undefined;
    let openLectureRecord: ContextualArtifact | undefined;
    let returnFocusToSourceCard: (() => void) | undefined;

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

        if (openLectureRecord?.textualRendition) {
            const englishRendition = openLectureRecord.textualRendition.renditions.find(({ locale }) => locale === 'en');
            if (englishRendition) {
                const reader = document.createElement('article');
                reader.className = 'contextual-text-reader';
                reader.dataset.contextPredictionFocus = 'lecture-reader';
                reader.tabIndex = -1;
                reader.setAttribute('aria-label', openLectureRecord.textualRendition.readerLabel);
                const readerHeading = document.createElement('h3');
                readerHeading.textContent = openLectureRecord.textualRendition.readerLabel;
                const sourceIdentity = document.createElement('p');
                sourceIdentity.textContent = `${openLectureRecord.creatorOrOrigin}. ${openLectureRecord.caseRelationship}`;
                const readingNote = document.createElement('p');
                readingNote.className = 'contextual-reader-note';
                readingNote.textContent = 'Reading this local rendition does not record the source as inspected evidence.';
                const reuse = document.createElement('p');
                reuse.textContent = openLectureRecord.textualRendition.citation.reuseStatement;
                const citation = document.createElement('p');
                citation.textContent = `${openLectureRecord.textualRendition.citation.citationText} `;
                const archive = document.createElement('a');
                archive.href = openLectureRecord.textualRendition.citation.archiveUrl;
                archive.target = '_blank';
                archive.rel = 'noopener noreferrer';
                archive.textContent = 'View the Wellcome Collection facsimile (opens in a new tab).';
                citation.append(archive);
                const close = document.createElement('button');
                close.type = 'button';
                close.dataset.contextPredictionFocus = 'close-lecture-reader';
                close.textContent = 'Return to Curated Record';
                close.addEventListener('click', () => {
                    openLectureRecord = undefined;
                    const returnFocus = returnFocusToSourceCard;
                    returnFocusToSourceCard = undefined;
                    render();
                    returnFocus?.();
                });
                reader.append(readerHeading, sourceIdentity, readingNote, reuse, citation, close);
                englishRendition.sections.forEach((section) => {
                    const sourceSection = document.createElement('section');
                    sourceSection.className = 'contextual-text-section';
                    sourceSection.id = section.id;
                    const sectionHeading = document.createElement('h4');
                    sectionHeading.textContent = section.heading;
                    const pageReference = document.createElement('p');
                    pageReference.className = 'contextual-source-pages';
                    pageReference.textContent = `Source page${section.sourcePages.length === 1 ? '' : 's'} ${section.sourcePages.join(', ')}.`;
                    sourceSection.append(sectionHeading, pageReference);
                    section.paragraphs.forEach((text) => {
                        const paragraph = document.createElement('p');
                        paragraph.textContent = text;
                        sourceSection.append(paragraph);
                    });
                    reader.append(sourceSection);
                });
                panel.append(reader);
            }
        }

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
    return {
        destroy: () => { unsubscribe(); root.replaceChildren(); },
        openLectureRecord: (source, returnFocus) => {
            openLectureRecord = source;
            returnFocusToSourceCard = returnFocus;
            requestedFocusKey = 'lecture-reader';
            render();
        }
    };
};
