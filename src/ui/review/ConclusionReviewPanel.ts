import type { AppStore } from '../../core/store/createStore';
import { selectPeerReview } from '../../core/store/selectors';

export const mountConclusionReviewPanel = (root: HTMLElement, store: AppStore): (() => void) => {
    let message = '';
    let requestedFocus: string | undefined;
    let stateSignature = '';
    const render = (): void => {
        const focus = requestedFocus ?? (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
            ? document.activeElement.dataset.reviewFocus
            : undefined);
        requestedFocus = undefined;
        const state = store.getState();
        const nextSignature = JSON.stringify({ peerReview: state.peerReview, theory: state.theory, phase: state.phase, history: state.decisionHistory });
        if (stateSignature && nextSignature !== stateSignature) message = '';
        stateSignature = nextSignature;
        const review = selectPeerReview(state);
        const panel = document.createElement('section');
        panel.className = 'review-panel conclusion-review-panel';
        panel.setAttribute('aria-label', 'Peer review');
        const heading = document.createElement('h2');
        heading.textContent = 'Peer review';
        const status = document.createElement('p');
        status.className = 'review-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.textContent = message;
        const request = document.createElement('button');
        request.type = 'button';
        request.dataset.reviewFocus = 'peer-review-request';
        request.textContent = 'Request peer feedback';
        request.addEventListener('click', () => {
            requestedFocus = request.dataset.reviewFocus;
            const result = store.dispatch({ type: 'peerReview.requested' });
            message = result.ok ? 'Peer feedback is ready to inspect.' : result.error.message;
            render();
        });
        panel.append(heading, request, status);
        if (review) {
            const introduction = document.createElement('p');
            introduction.textContent = review.issues.length ? 'Review feedback identifies bounded revision opportunities.' : 'No authored concern applies to the current draft; keep its limitation visible when revising.';
            panel.append(introduction);
            const list = document.createElement('ul');
            review.issues.forEach((issue) => {
                const item = document.createElement('li');
                item.textContent = `${issue.feedback} ${issue.revisionPath}`;
                list.append(item);
            });
            panel.append(list);
            const save = document.createElement('button');
            save.type = 'button';
            save.dataset.reviewFocus = 'revision-save';
            save.textContent = 'Save reviewed revision';
            save.addEventListener('click', () => {
                requestedFocus = save.dataset.reviewFocus;
                const result = store.dispatch({ type: 'revision.saved', timestamp: new Date().toISOString() });
                message = result.ok ? 'The reviewed revision was saved to decision history.' : result.error.message;
                render();
            });
            panel.append(save);
        }
        root.replaceChildren(panel);
        if (focus) Array.from(root.querySelectorAll<HTMLElement>('[data-review-focus]')).find((element) => element.dataset.reviewFocus === focus)?.focus();
    };
    const unsubscribe = store.subscribe(render);
    render();
    return () => { unsubscribe(); root.replaceChildren(); };
};
