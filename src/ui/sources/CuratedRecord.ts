import type { AppStore } from '../../core/store/createStore';
import { selectContextualArtifacts, selectIsSourceInspected } from '../../core/store/selectors';
import type { ContextualArtifact } from '../../domain/cases/CaseDefinition';

const definition = (term: string, value: string): HTMLDivElement => {
    const item = document.createElement('div');
    const definitionTerm = document.createElement('dt');
    definitionTerm.textContent = term;
    const definitionValue = document.createElement('dd');
    definitionValue.textContent = value;
    item.append(definitionTerm, definitionValue);
    return item;
};

const titleCase = (value: string): string => value.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');

const categoryMarker = (source: ContextualArtifact): string => {
    switch (source.provenance.category) {
        case 'primary-material': return 'Primary-source marker';
        case 'reconstruction': return 'Reconstruction marker';
        case 'later-interpretation': return 'Later-interpretation marker';
        case 'deliberate-fiction': return 'Deliberate-fiction marker';
    }
};

export const mountCuratedRecord = (root: HTMLElement, store: AppStore): (() => void) => {
    let statusMessage = '';
    let renderedInspectionIds: string | undefined;
    let requestedFocusKey: string | undefined;

    const activeRecordFocusKey = (): string | undefined => {
        const activeElement = document.activeElement;
        return activeElement instanceof HTMLElement && root.contains(activeElement)
            ? activeElement.dataset.curatedRecordFocus
            : undefined;
    };

    const render = (force = false): void => {
        const focusKey = requestedFocusKey ?? activeRecordFocusKey();
        const state = store.getState();
        const inspectionIds = state.inspectedSourceIds.join('\u0000');
        if (!force && renderedInspectionIds === inspectionIds) return;
        requestedFocusKey = undefined;
        renderedInspectionIds = inspectionIds;
        const record = document.createElement('section');
        record.className = 'curated-record';
        record.setAttribute('aria-label', 'Curated Record');

        const heading = document.createElement('h2');
        heading.textContent = 'Curated Record';
        const prompt = document.createElement('p');
        prompt.textContent = 'Inspect the available contextual sources and note how each one is presented.';
        const status = document.createElement('p');
        status.className = 'curated-record-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-label', 'Curated Record status');
        status.textContent = statusMessage;
        const cards = document.createElement('div');
        cards.className = 'source-cards';

        selectContextualArtifacts(state).forEach((source) => {
            const card = document.createElement('article');
            card.className = `source-card source-provenance-${source.provenance.category}`;
            const title = document.createElement('h3');
            title.textContent = source.displayName;
            const details = document.createElement('dl');
            details.className = 'source-details';
            details.append(
                definition('Creator or originating context', source.creatorOrOrigin),
                definition('Source type', titleCase(source.sourceType)),
                definition('Case relationship', source.caseRelationship)
            );
            const provenance = document.createElement('p');
            provenance.className = 'source-provenance-label';
            provenance.textContent = `Provenance: ${titleCase(source.provenance.category)}`;
            const marker = document.createElement('p');
            marker.className = 'source-category-marker';
            marker.textContent = categoryMarker(source);
            const rights = document.createElement('p');
            rights.className = 'source-rights-status';
            rights.textContent = `Rights status: ${titleCase(source.rightsStatus)}`;
            const inspect = document.createElement('button');
            inspect.type = 'button';
            inspect.dataset.curatedRecordFocus = `inspect-${source.id}`;
            inspect.textContent = `Inspect ${source.displayName}`;
            inspect.addEventListener('click', () => {
                requestedFocusKey = inspect.dataset.curatedRecordFocus;
                statusMessage = `${source.displayName} is recorded as inspected evidence.`;
                const transition = store.dispatch({ type: 'source.inspected', sourceId: source.id });
                if (!transition.ok) {
                    statusMessage = transition.error.code === 'source-not-eligible'
                        ? 'This source cannot be inspected as verified evidence right now. Try another contextual source.'
                        : transition.error.code === 'duplicate-inspected-source'
                            ? 'This source is already recorded as inspected evidence.'
                            : 'This source is unavailable. Your existing inspected evidence is unchanged.';
                    render(true);
                }
            });
            card.append(title, details, provenance, marker, rights, inspect);
            if (selectIsSourceInspected(state, source.id)) {
                const inspected = document.createElement('p');
                inspected.className = 'source-inspected-state';
                inspected.textContent = 'Inspection recorded';
                card.append(inspected);
            }
            cards.append(card);
        });

        record.append(heading, prompt, status, cards);
        root.replaceChildren(record);
        if (focusKey) {
            root.querySelector<HTMLElement>(`[data-curated-record-focus="${focusKey}"]`)?.focus();
        }
    };

    const unsubscribe = store.subscribe(render);
    render();
    return () => {
        unsubscribe();
        root.replaceChildren();
    };
};
