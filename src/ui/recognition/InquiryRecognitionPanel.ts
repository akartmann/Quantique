import type { AppStore } from '../../core/store/createStore';
import { selectRecognition } from '../../core/store/selectors';

const achievedIds = (store: AppStore): Set<string> => new Set(selectRecognition(store.getState()).items
    .filter(({ achieved }) => achieved)
    .map(({ id }) => id));

/** A calm semantic projection of authoritative, non-gating inquiry recognition. */
export const mountInquiryRecognitionPanel = (root: HTMLElement, store: AppStore): (() => void) => {
    let announcedIds = achievedIds(store);

    const panel = document.createElement('section');
    panel.className = 'inquiry-recognition-panel';
    panel.setAttribute('aria-label', 'Inquiry recognition');
    panel.dataset.inquiryRecognitionFocus = 'panel';

    const heading = document.createElement('h2');
    heading.textContent = 'Inquiry recognition';
    const introduction = document.createElement('p');
    introduction.textContent = 'This record notes careful investigation. It does not change what remains available in the case.';
    const status = document.createElement('p');
    status.className = 'inquiry-recognition-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-label', 'Inquiry recognition updates');
    const content = document.createElement('div');
    panel.append(heading, introduction, status, content);
    root.replaceChildren(panel);

    const render = (): void => {
        const recognition = selectRecognition(store.getState());
        const achieved = recognition.items.filter(({ achieved }) => achieved);
        const list = document.createElement('ul');
        list.className = 'inquiry-recognition-list';

        if (achieved.length === 0) {
            const empty = document.createElement('li');
            empty.textContent = 'No inquiry recognitions are recorded yet. Source inspection, comparison, and bounded revisions remain available when you choose them.';
            list.append(empty);
        } else {
            achieved.forEach((item) => {
                const entry = document.createElement('li');
                const label = document.createElement('strong');
                label.textContent = item.label;
                const description = document.createElement('p');
                description.textContent = item.description;
                entry.append(label, description);
                list.append(entry);
            });
        }

        const audio = document.createElement('p');
        audio.className = 'inquiry-audio-status';
        audio.textContent = 'Optional audio feedback is unavailable for this investigation. All feedback is available as text.';
        content.replaceChildren(list, audio);
    };

    const unsubscribe = store.subscribeToUpdates((update) => {
        const recognition = selectRecognition(store.getState());
        if (update.kind === 'record-replaced') {
            announcedIds = achievedIds(store);
            status.textContent = '';
            render();
            return;
        }
        const newlyAchieved = recognition.items.filter((item) => item.achieved && !announcedIds.has(item.id));
        newlyAchieved.forEach(({ id }) => announcedIds.add(id));
        status.textContent = newlyAchieved.length > 0
            ? newlyAchieved.map(({ label }) => `${label}.`).join(' ')
            : '';
        render();
    });

    render();
    return () => { unsubscribe(); root.replaceChildren(); };
};
