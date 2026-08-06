import { describe, expect, it } from 'vitest';

import { resolveBrowserLocale } from '../../src/core/i18n/resolveBrowserLocale';
import { createTranslator } from '../../src/core/i18n/translate';
import { createInitialAppState } from '../../src/core/store/AppState';
import { createStore, type AppStore } from '../../src/core/store/createStore';
import {
    selectControlLabel, selectFormattedControlValue, selectLocale, selectMissingContextArtifactLabels,
    selectMissingContextArtifactNames, selectSourceLabel,
    selectCanonicalSourceLabel, selectCanonicalControlValue, selectLocalizedError
} from '../../src/core/store/selectors';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

/** U+202F, asserted as a code point so a plain space cannot pass by accident. */
const NARROW_NO_BREAK_SPACE = '\u202F';

const definition = {
    id: 'young-interference',
    version: '1.5.0',
    requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: { en: 'Slit spacing', fr: 'Écartement des fentes' }, unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: { en: 'Screen distance', fr: 'Distance à l’écran' }, unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    contextualArtifacts: [
        { id: 'young-lecture-1801', displayName: { en: 'Young lecture record', fr: 'Compte rendu de la conférence de Young' }, creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'young' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Preuve.' } },
        { id: 'newton-opticks', displayName: { en: 'Opticks reference', fr: 'Référence à l’Opticks' }, creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'opticks' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Preuve.' } }
    ],
    experiment: { modelVersion: 'young-double-slit-v1' }
} as unknown as CaseDefinition;

/**
 * A minimal stand-in for a renderer: it re-reads its text from the store on every notification,
 * exactly as `ApparatusRenderer.render` does. Keeping the fake at that contract lets the test assert
 * the rendering path without a real `Phaser.Game`, which has no canvas under Vitest.
 */
const mountFakeSceneRenderer = (store: AppStore) => {
    const painted: string[] = [];
    const render = (): void => {
        const state = store.getState();
        const t = createTranslator(selectLocale(state));
        painted.push(`${t('lab.title')} | ${t('lab.control.readout', {
            label: selectControlLabel(state, 'slitSpacingMm'),
            value: selectFormattedControlValue(state, 'slitSpacingMm')
        })}`);
    };
    const unsubscribe = store.subscribe(render);
    render();
    return { painted, unsubscribe };
};

/** Boot as `main.ts` does: resolve the browser language, then build the store around it. */
const bootWith = (languageTags: readonly string[]): AppStore =>
    createStore(createInitialAppState(definition, resolveBrowserLocale(languageTags)));

describe('browser-resolved locale across the whole projection', () => {
    it('paints an English browser in English from the first render', () => {
        const scene = mountFakeSceneRenderer(bootWith(['en-GB']));

        expect(scene.painted).toEqual(['Young interference — visual laboratory surface | Slit spacing: 0.25 mm']);
    });

    it('paints a French browser in French from the first render, formatting included', () => {
        const scene = mountFakeSceneRenderer(bootWith(['fr-FR', 'en']));

        // One entry, not two: there is no English first paint to correct.
        expect(scene.painted).toEqual([
            `Interférences de Young — surface visuelle du laboratoire | Écartement des fentes : 0,25${NARROW_NO_BREAK_SPACE}mm`
        ]);
    });

    it('falls back to English for a browser that asks for neither language', () => {
        expect(selectLocale(bootWith(['de-DE', 'es-ES']).getState())).toBe('en');
    });

    it('resolves authored case text in the resolved language by stable id', () => {
        expect(selectSourceLabel(bootWith(['en']).getState(), 'newton-opticks')).toBe('Opticks reference');
        expect(selectSourceLabel(bootWith(['fr-CA']).getState(), 'newton-opticks')).toBe('Référence à l’Opticks');
    });

    // The retiring pre-pivot DOM panels are English-only by scope. Reading a locale-aware selector
    // from inside one produced mixed output — the same source named in French on one line and
    // English on the next, and a French decimal inside an English sentence.
    it('offers canonical English counterparts for the panels that are not localized', () => {
        const state = bootWith(['fr-FR']).getState();

        expect(selectSourceLabel(state, 'newton-opticks')).toBe('Référence à l’Opticks');
        expect(selectCanonicalSourceLabel(state, 'newton-opticks')).toBe('Opticks reference');

        expect(selectFormattedControlValue(state, 'slitSpacingMm')).toBe(`0,25${NARROW_NO_BREAK_SPACE}mm`);
        expect(selectCanonicalControlValue(state, 'slitSpacingMm')).toBe('0.25 mm');
    });

    // The `{label}` parameter is supplied at this boundary, not by each surface — a surface that
    // forgot it would print a literal `{label}` to the player.
    it('resolves a parameterised error code with its content already filled in', () => {
        const state = bootWith(['fr-FR']).getState();

        const message = selectLocalizedError(state, { code: 'missing-contextual-sources', message: 'dev-facing default' });

        expect(message).not.toContain('{label}');
        expect(message).toContain('Compte rendu de la conférence de Young');
    });

    it('keeps readiness labels canonical while offering localized names alongside them', () => {
        const state = bootWith(['fr']).getState();

        // Canonical: this list feeds comparisons and must not move with the language.
        expect(selectMissingContextArtifactLabels(state)).toEqual(['Young lecture record', 'Opticks reference']);
        expect(selectMissingContextArtifactNames(state))
            .toEqual(['Compte rendu de la conférence de Young', 'Référence à l’Opticks']);
    });

    it('holds the resolved language steady for the whole session', () => {
        const store = bootWith(['fr-FR']);
        const scene = mountFakeSceneRenderer(store);

        store.dispatch({ type: 'apparatus.controlSet', controlId: 'slitSpacingMm', value: 0.3, origin: 'dom' });

        expect(selectLocale(store.getState())).toBe('fr');
        expect(scene.painted).toHaveLength(2);
        expect(scene.painted[1]).toContain(`0,30${NARROW_NO_BREAK_SPACE}mm`);
    });
});
