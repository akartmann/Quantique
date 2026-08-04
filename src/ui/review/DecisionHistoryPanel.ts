import type { AppStore } from '../../core/store/createStore';
import { selectDecisionHistory } from '../../core/store/selectors';

export const mountDecisionHistoryPanel = (root: HTMLElement, store: AppStore): (() => void) => {
    const render = (): void => {
        const panel = document.createElement('section');
        panel.className = 'review-panel decision-history-panel';
        panel.setAttribute('aria-label', 'Decision history');
        const heading = document.createElement('h2');
        heading.textContent = 'Decision history';
        panel.append(heading);
        const history = selectDecisionHistory(store.getState());
        if (!history.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Reviewed revisions are retained here in chronological order.';
            panel.append(empty);
        } else {
            const list = document.createElement('ol');
            history.forEach((entry) => {
                const item = document.createElement('li');
                const title = document.createElement('h3');
                title.textContent = `Version ${entry.version}`;
                const content = document.createElement('dl');
                [['Timestamp', entry.timestamp], ['Prior conclusion', entry.priorConclusion || 'No prior saved conclusion.'], ['Saved conclusion', entry.conclusion], ['Limitation', entry.limitation], ['Supporting observations', entry.selectedRunIds.join(', ') || 'None'], ['Supporting sources', entry.selectedSourceIds.join(', ') || 'None'], ['Feedback', entry.feedback.status === 'reviewed' ? entry.feedback.issues.map((issue) => issue.feedback).join(' ') || 'No authored concerns.' : entry.feedback.message]]
                    .forEach(([term, value]) => {
                        const dt = document.createElement('dt'); dt.textContent = term;
                        const dd = document.createElement('dd'); dd.textContent = value;
                        content.append(dt, dd);
                    });
                item.append(title, content);
                list.append(item);
            });
            panel.append(list);
        }
        root.replaceChildren(panel);
    };
    const unsubscribe = store.subscribe(render);
    render();
    return () => { unsubscribe(); root.replaceChildren(); };
};
