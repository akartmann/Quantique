import type { Locale } from '../core/i18n/Locale';
import { createTranslator } from '../core/i18n/translate';

/**
 * The boot frame is retained by the architecture's target tree, so it is localized rather than left
 * to the retiring panels. Its markup in `index.html` cannot know the resolved language before
 * hydration, so every visible string is populated here from the i18n layer.
 */
export const getBootShellStatusMessage = (locale: Locale): string => createTranslator(locale)('boot.status.ready');

export const setBootShellStatus = (root: HTMLElement, message: string): void => {
    const status = root.querySelector<HTMLElement>('#boot-status');
    if (status) {
        status.textContent = message;
    }
};

export const renderBootShellText = (root: HTMLElement, locale: Locale): void => {
    const t = createTranslator(locale);
    // Keeps the document language in step with the interface language, for spell-check,
    // hyphenation, and assistive technology.
    document.documentElement.lang = locale;
    const set = (selector: string, text: string): void => {
        const element = root.querySelector<HTMLElement>(selector);
        if (element) element.textContent = text;
    };
    set('[data-boot-text="eyebrow"]', t('boot.eyebrow'));
    set('#boot-title', t('boot.title'));
    set('[data-boot-text="intro"]', t('boot.intro'));
    set('[data-testid="enter-laboratory"]', t('boot.enter'));
};

export const createBootShell = (root: HTMLElement, locale: Locale): void => {
    const button = root.querySelector<HTMLButtonElement>('[data-testid="enter-laboratory"]');
    const status = root.querySelector<HTMLElement>('#boot-status');

    if (!button || !status) {
        throw new Error('The boot shell requires an entry button and status region.');
    }

    button.addEventListener('click', () => {
        setBootShellStatus(root, getBootShellStatusMessage(locale));
    });

    renderBootShellText(root, locale);
};
