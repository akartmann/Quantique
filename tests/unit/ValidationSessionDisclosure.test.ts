import { describe, expect, it } from 'vitest';

import { getValidationSessionDisclosureText } from '../../src/ui/ValidationSessionDisclosure';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';

/**
 * The mount itself needs a DOM and is asserted in `tests/e2e/validation-route.spec.ts` (EN and FR).
 * What is unit-testable is the pure text resolution the mount renders — the defect this story fixes
 * was four hardcoded English strings, so the regression worth locking is "the disclosure resolves
 * through the i18n layer in the session's language", not the element tree.
 */
describe('getValidationSessionDisclosureText', () => {
    it('resolves the facilitator disclosure through the i18n layer in English', () => {
        expect(getValidationSessionDisclosureText('en')).toEqual({
            title: en['validation.session.title'],
            facilitatorHeld: en['validation.session.facilitatorHeld'],
            noCollection: en['validation.session.noCollection']
        });
    });

    it('resolves it in French, so an FR moderated session is not read an English disclosure', () => {
        expect(getValidationSessionDisclosureText('fr')).toEqual({
            title: fr['validation.session.title'],
            facilitatorHeld: fr['validation.session.facilitatorHeld'],
            noCollection: fr['validation.session.noCollection']
        });
    });

    it('ships a distinct French translation for every string rather than falling back to English', () => {
        const english = getValidationSessionDisclosureText('en');
        const french = getValidationSessionDisclosureText('fr');
        for (const key of ['facilitatorHeld', 'noCollection'] as const) {
            expect(french[key]).not.toBe(english[key]);
        }
    });

    /**
     * AC4: the disclosure carries no score, right/wrong, or speed language. Asserted against both
     * locales, because the FR copy is the one that was missing and is the one nobody re-reads.
     */
    it('keeps both locales free of score, correctness, and speed language', () => {
        const forbidden = [
            /\bscore/i,
            /\bcorrect/i,
            /\bincorrect/i,
            /\bwrong\b/i,
            /\bgrade/i,
            /\bnote\b/i,
            /\bréussi/i,
            /\béchou/i,
            /\bfaux\b/i,
            /\bjuste\b/i,
            /\bexact/i,
            /\bquickly\b/i,
            /\brapide/i,
            /\bvite\b/i,
            /\btest(ing)? you/i,
            /\bévalu/i,
            /\bassess/i
        ];
        for (const locale of ['en', 'fr'] as const) {
            const copy = Object.values(getValidationSessionDisclosureText(locale)).join(' ');
            for (const pattern of forbidden) {
                expect(copy, `${locale} disclosure matched ${pattern}`).not.toMatch(pattern);
            }
        }
    });
});
