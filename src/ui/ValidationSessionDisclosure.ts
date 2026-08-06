import type { Locale } from '../core/i18n/Locale';
import { createTranslator } from '../core/i18n/translate';

/**
 * The disclosure the facilitator and learner read on the moderated `?mode=validation` route.
 *
 * Kept in the boot frame rather than moved into a Phaser scene: it is static facilitator-facing chrome
 * adjacent to the boot shell and mirrors no interactive gesture, so neither the single-Phaser-surface
 * rule nor the "no semantic HTML for parity" rule applies. `BootShell` is the retained non-Phaser
 * surface it sits beside, and it is localized the same way.
 */
export interface ValidationSessionDisclosureText {
    readonly title: string;
    readonly facilitatorHeld: string;
    readonly noCollection: string;
}

export const getValidationSessionDisclosureText = (locale: Locale): ValidationSessionDisclosureText => {
    const t = createTranslator(locale);
    return {
        title: t('validation.session.title'),
        facilitatorHeld: t('validation.session.facilitatorHeld'),
        noCollection: t('validation.session.noCollection')
    };
};

/**
 * Renders facilitator-facing privacy information for the isolated Young validation entry mode.
 *
 * `locale` is required with no `DEFAULT_LOCALE` fallback on purpose: a silent default would turn a
 * call site that forgot the locale from a `tsc` failure into a French moderated session silently
 * reading an English disclosure — the exact defect this fixes.
 */
export const mountValidationSessionDisclosure = (root: HTMLElement, locale: Locale): void => {
    const text = getValidationSessionDisclosureText(locale);

    const disclosure = document.createElement('section');
    disclosure.className = 'validation-session-disclosure';
    disclosure.setAttribute('aria-label', text.title);

    const heading = document.createElement('h2');
    heading.textContent = text.title;
    const facilitatorNotice = document.createElement('p');
    facilitatorNotice.textContent = text.facilitatorHeld;
    const privacyNotice = document.createElement('p');
    privacyNotice.textContent = text.noCollection;

    disclosure.append(heading, facilitatorNotice, privacyNotice);
    root.replaceChildren(disclosure);
};
