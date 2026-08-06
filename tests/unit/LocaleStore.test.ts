import { describe, expect, it } from 'vitest';

import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { selectLocale } from '../../src/core/store/selectors';
import { createCaseRecordProjection } from '../../src/core/store/CaseRecordProjection';
import { DEFAULT_LOCALE } from '../../src/core/i18n/Locale';
import { resolveBrowserLocale } from '../../src/core/i18n/resolveBrowserLocale';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

const caseDefinition = {
    id: 'young-interference',
    version: '1.5.0',
    contextualArtifacts: [],
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: { en: 'Slit spacing', fr: 'Écartement des fentes' }, unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: { en: 'Screen distance', fr: 'Distance à l’écran' }, unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    }
} as unknown as CaseDefinition;

describe('locale in the authoritative store', () => {
    it('defaults to English and is readable through a selector', () => {
        const state = createInitialAppState(caseDefinition);
        expect(state.locale).toBe(DEFAULT_LOCALE);
        expect(selectLocale(state)).toBe('en');
    });

    it('takes the locale the browser resolved, so the first paint needs no correction', () => {
        const state = createInitialAppState(caseDefinition, resolveBrowserLocale(['fr-FR', 'en']));
        expect(selectLocale(state)).toBe('fr');
    });

    it('keeps the state frozen with the locale in place', () => {
        const state = createInitialAppState(caseDefinition, 'fr');
        expect(Object.isFrozen(state)).toBe(true);
        expect(state.locale).toBe('fr');
    });

    // There is no in-game language control, so nothing in the action union can move the locale.
    it('exposes no action that changes the language', () => {
        const store = createStore(createInitialAppState(caseDefinition, 'fr'));
        store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.3, origin: 'dom' });

        expect(selectLocale(store.getState())).toBe('fr');
    });

    it('omits locale from the portable case record — it describes the device, not the investigation', () => {
        const projection = createCaseRecordProjection(createInitialAppState(caseDefinition, 'fr'));

        expect(projection.ok).toBe(true);
        expect(projection.ok && 'locale' in projection.value).toBe(false);
    });
});
