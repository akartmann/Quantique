import type { AppStore } from '../../core/store/createStore';
import { selectConsultation } from '../../core/store/selectors';

export const mountConsultationPanel = (root: HTMLElement, store: AppStore): (() => void) => {
    let message = '';
    let requestedFocus: string | undefined;
    let stateSignature = '';

    const render = (): void => {
        const focus = requestedFocus ?? (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
            ? document.activeElement.dataset.reviewFocus
            : undefined);
        requestedFocus = undefined;
        const state = store.getState();
        const nextSignature = JSON.stringify({ consultation: state.consultation, theory: state.theory, runs: state.runs, sources: state.inspectedSourceIds });
        if (stateSignature && nextSignature !== stateSignature) message = '';
        stateSignature = nextSignature;
        const consultation = selectConsultation(state);
        const panel = document.createElement('section');
        panel.className = 'review-panel consultation-panel';
        panel.setAttribute('aria-label', 'Evidence-responsive consultation');
        const heading = document.createElement('h2');
        heading.textContent = 'Consultation';
        const status = document.createElement('p');
        status.className = 'review-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.textContent = message;
        const request = document.createElement('button');
        request.type = 'button';
        request.dataset.reviewFocus = 'consultation-request';
        request.textContent = 'Request consultation';
        request.addEventListener('click', () => {
            requestedFocus = request.dataset.reviewFocus;
            const result = store.dispatch({ type: 'consultation.requested' });
            message = result.ok ? 'A next actionable step is available below.' : result.error.message;
            render();
        });
        panel.append(heading, request, status);
        if (consultation) {
            const nextStep = document.createElement('p');
            nextStep.textContent = `Next step: ${consultation.nextStep}`;
            panel.append(nextStep);
            ([['In-play observation', consultation.layers.observation], ['Plain-language guidance', consultation.layers.plainLanguage], ['Technical or source detail', consultation.layers.technicalDetail]] as const)
                .forEach(([summary, content], index) => {
                    const details = document.createElement('details');
                    details.dataset.reviewFocus = `consultation-layer-${index}`;
                    const title = document.createElement('summary');
                    title.textContent = summary;
                    const body = document.createElement('p');
                    body.textContent = content;
                    details.append(title, body);
                    panel.append(details);
                });
        }
        root.replaceChildren(panel);
        if (focus) Array.from(root.querySelectorAll<HTMLElement>('[data-review-focus]')).find((element) => element.dataset.reviewFocus === focus)?.focus();
    };
    const unsubscribe = store.subscribe(render);
    render();
    return () => { unsubscribe(); root.replaceChildren(); };
};
