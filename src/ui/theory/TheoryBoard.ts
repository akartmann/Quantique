import type { AppStore } from '../../core/store/createStore';
import {
    selectCasePhase,
    selectConclusionReadiness,
    selectContextualArtifacts,
    selectNotebookObservations,
    selectSourceLabel,
    selectTheoryBoardDraft
} from '../../core/store/selectors';
import type { RunRecord } from '../../domain/evidence/RunRecord';

const definition = (term: string, value: string): HTMLDivElement => {
    const item = document.createElement('div');
    const definitionTerm = document.createElement('dt');
    definitionTerm.textContent = term;
    const definitionValue = document.createElement('dd');
    definitionValue.textContent = value;
    item.append(definitionTerm, definitionValue);
    return item;
};

const runDetails = (record: RunRecord, order: number, store: AppStore): HTMLElement => {
    const details = document.createElement('dl');
    details.className = 'theory-board-details';
    details.append(
        definition('Recorded order', String(order)),
        definition('Timestamp', record.timestamp),
        definition('Experiment model version', record.experimentModelVersion),
        definition('Observed result', `${record.result.label}: ${record.result.value} ${record.result.unit}`),
        definition('Linked evidence', record.linkedEvidenceIds.length
            ? record.linkedEvidenceIds.map((sourceId) => selectSourceLabel(store.getState(), sourceId)).join(', ')
            : 'None recorded')
    );
    return details;
};

const phaseGuidance = (phase: string): string => phase === 'synthesis'
    ? 'Your evidence is in synthesis. Select support, state a limitation, and request review when ready.'
    : `Current phase: ${phase}. The theory board preserves your draft while you continue the investigation.`;

export const mountTheoryBoard = (root: HTMLElement, store: AppStore): (() => void) => {
    let statusMessage = '';
    let renderedStateSignature = '';
    let requestedFocusKey: string | undefined;

    const activeTheoryFocusKey = (): string | undefined => {
        const activeElement = document.activeElement;
        return activeElement instanceof HTMLElement && root.contains(activeElement)
            ? activeElement.dataset.theoryFocus
            : undefined;
    };

    const render = (force = false): void => {
        const focusKey = requestedFocusKey ?? activeTheoryFocusKey();
        const state = store.getState();
        const signature = JSON.stringify({
            phase: state.phase,
            runs: state.runs,
            inspectedSourceIds: state.inspectedSourceIds,
            theory: state.theory
        });
        if (!force && signature === renderedStateSignature) return;
        requestedFocusKey = undefined;
        renderedStateSignature = signature;

        const draft = selectTheoryBoardDraft(state);
        const readiness = selectConclusionReadiness(state);
        const panel = document.createElement('section');
        panel.className = 'theory-board';
        panel.setAttribute('aria-label', 'Theory board');

        const heading = document.createElement('h2');
        heading.textContent = 'Theory board';
        const guidance = document.createElement('p');
        guidance.textContent = phaseGuidance(selectCasePhase(state));
        const status = document.createElement('p');
        status.className = 'theory-board-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-label', 'Theory board status');
        status.textContent = statusMessage || (readiness.status === 'ready'
            ? 'Your selected evidence and limitation are ready for review.'
            : readiness.missing[0]?.message ?? 'Add evidence to prepare a bounded conclusion.');
        panel.append(heading, guidance, status);

        const observationsHeading = document.createElement('h3');
        observationsHeading.textContent = 'Supporting observations';
        panel.append(observationsHeading);
        const observations = selectNotebookObservations(state);
        if (!observations.length) {
            const unavailable = document.createElement('p');
            unavailable.textContent = 'Record observations in the measurement notebook before selecting support.';
            panel.append(unavailable);
        } else {
            const list = document.createElement('ol');
            list.className = 'theory-board-evidence';
            observations.forEach((record, index) => {
                const item = document.createElement('li');
                item.append(runDetails(record, index + 1, store));
                const selection = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.theoryFocus = `run-${record.id}`;
                checkbox.checked = draft.selectedRunIds.includes(record.id);
                checkbox.setAttribute('aria-label', `Select Observation ${index + 1} as conclusion support`);
                checkbox.addEventListener('change', () => {
                    requestedFocusKey = checkbox.dataset.theoryFocus;
                    const transition = store.dispatch(checkbox.checked
                        ? { type: 'theory.supportRunSelected', runId: record.id }
                        : { type: 'theory.supportRunUnselected', runId: record.id });
                    if (!transition.ok) statusMessage = transition.error.message;
                    render(true);
                });
                selection.append(checkbox, ' Use as conclusion support');
                item.append(selection);
                list.append(item);
            });
            panel.append(list);
        }

        const sourcesHeading = document.createElement('h3');
        sourcesHeading.textContent = 'Supporting sources';
        panel.append(sourcesHeading);
        const inspectedSources = selectContextualArtifacts(state).filter((source) => state.inspectedSourceIds.includes(source.id));
        if (!inspectedSources.length) {
            const unavailable = document.createElement('p');
            unavailable.textContent = 'Inspect reviewed sources in the Curated Record before selecting them as support.';
            panel.append(unavailable);
        } else {
            const list = document.createElement('ul');
            list.className = 'theory-board-evidence';
            inspectedSources.forEach((source) => {
                const item = document.createElement('li');
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.theoryFocus = `source-${source.id}`;
                checkbox.checked = draft.selectedSourceIds.includes(source.id);
                checkbox.setAttribute('aria-label', `Select ${source.displayName} as conclusion support`);
                checkbox.addEventListener('change', () => {
                    requestedFocusKey = checkbox.dataset.theoryFocus;
                    const transition = store.dispatch(checkbox.checked
                        ? { type: 'theory.supportSourceSelected', sourceId: source.id }
                        : { type: 'theory.supportSourceUnselected', sourceId: source.id });
                    if (!transition.ok) statusMessage = transition.error.message;
                    render(true);
                });
                const provenance = `${source.provenance.category.replace(/-/g, ' ')}; ${source.provenance.reference}`;
                label.append(checkbox, ` ${source.displayName} — provenance: ${provenance}`);
                item.append(label);
                list.append(item);
            });
            panel.append(list);
        }

        const conclusionLabel = document.createElement('label');
        conclusionLabel.htmlFor = 'theory-conclusion';
        conclusionLabel.textContent = 'Conclusion';
        const conclusion = document.createElement('textarea');
        conclusion.id = 'theory-conclusion';
        conclusion.dataset.theoryFocus = 'conclusion';
        conclusion.value = draft.conclusion;
        conclusion.addEventListener('input', () => {
            requestedFocusKey = conclusion.dataset.theoryFocus;
            store.dispatch({ type: 'theory.conclusionSet', conclusion: conclusion.value });
        });
        const limitationLabel = document.createElement('label');
        limitationLabel.htmlFor = 'theory-limitation';
        limitationLabel.textContent = 'Limitation or alternative explanation';
        const limitation = document.createElement('textarea');
        limitation.id = 'theory-limitation';
        limitation.dataset.theoryFocus = 'limitation';
        limitation.value = draft.limitation;
        limitation.addEventListener('input', () => {
            requestedFocusKey = limitation.dataset.theoryFocus;
            store.dispatch({ type: 'theory.limitationSet', limitation: limitation.value });
        });
        const submit = document.createElement('button');
        submit.type = 'button';
        submit.dataset.theoryFocus = 'submit';
        submit.textContent = 'Request review';
        submit.addEventListener('click', () => {
            requestedFocusKey = submit.dataset.theoryFocus;
            const transition = store.dispatch({ type: 'theory.reviewRequested' });
            statusMessage = transition.ok
                ? 'Your conclusion has moved to review.'
                : transition.error.message;
            render(true);
        });
        panel.append(conclusionLabel, conclusion, limitationLabel, limitation, submit);

        root.replaceChildren(panel);
        if (focusKey) {
            Array.from(root.querySelectorAll<HTMLElement>('[data-theory-focus]'))
                .find((element) => element.dataset.theoryFocus === focusKey)
                ?.focus();
        }
    };

    const unsubscribe = store.subscribe(render);
    render();
    return () => {
        unsubscribe();
        root.replaceChildren();
    };
};
