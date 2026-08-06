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
        // `title` is included deliberately: it is also the section's `aria-label`, so an English leak
        // there is the least visible of the three. `translate` treats `''` as absent and falls back to
        // English, so an empty FR value would satisfy `tsc` and the key-parity test yet still render
        // English to a French session — this is the assertion that catches it.
        for (const key of ['title', 'facilitatorHeld', 'noCollection'] as const) {
            expect(french[key], `fr ${key} must not fall back to the English string`).not.toBe(english[key]);
        }
    });

    /**
     * AC4: the disclosure carries no score, right/wrong, or speed language. Asserted against both
     * locales, because the FR copy is the one that was missing and is the one nobody re-reads.
     */
    it('keeps both locales free of score, correctness, and speed language', () => {
        // `\b` is defined over `[A-Za-z0-9_]`, so it never holds before an accented initial:
        // `/\bévalu/i` cannot match `évaluation` at a string start or after a space, and `/\béchou/i`
        // cannot match `échoué`. Accent-initial patterns therefore use `(^|[^\p{L}])` with the `u`
        // flag; ASCII-initial ones keep `\b`. `évalu` is the highest-value pattern of the set —
        // "évaluation" / "vous évalue" is the likeliest French way to imply the product is assessing
        // the learner, which AC4 forbids — and it was the one silently matching nothing.
        const forbidden = [
            /\bscore/i,
            /\bcorrect/i,
            /\bincorrect/i,
            /\bwrong\b/i,
            /\bgrade/i,
            // Covers the graded sense in both languages: note, notes, noté, notés, notée, notées.
            // `\bnote\b` alone missed every accented form, which is the form that means "graded".
            /(^|[^\p{L}])not[eé]e?s?\b/iu,
            /\bfaux\b/i,
            /\bjuste\b/i,
            /\bquickly\b/i,
            /\bvite\b/i,
            /\bexact/i,
            /\brapide/i,
            /\btest(ing)? you/i,
            /\bassess/i,
            /(^|[^\p{L}])réussi/iu,
            /(^|[^\p{L}])échou/iu,
            /(^|[^\p{L}])évalu/iu,
            // French counterparts of the two behavioural patterns above, which were English-only.
            /(^|[^\p{L}])(vous|on vous)\s+(évalue|teste|note|juge)/iu,
            /(^|[^\p{L}])chronom/iu
        ];
        for (const locale of ['en', 'fr'] as const) {
            const copy = Object.values(getValidationSessionDisclosureText(locale)).join(' ');
            for (const pattern of forbidden) {
                expect(copy, `${locale} disclosure matched ${pattern}`).not.toMatch(pattern);
            }
        }
    });
});
