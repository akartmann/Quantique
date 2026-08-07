import type { Locale } from '../core/i18n/Locale';
import { createTranslator } from '../core/i18n/translate';

/**
 * The boot frame is retained by the architecture's target tree, so it is localized rather than left
 * to the retiring panels. Its markup in `index.html` cannot know the resolved language before
 * hydration, so every visible string is populated here from the i18n layer.
 */
export const getBootShellStatusMessage = (locale: Locale): string => createTranslator(locale)('boot.status.ready');

/**
 * How long a `notice` stays on screen before it clears itself.
 *
 * Long enough to be read at a glance and to be announced by a screen reader, short enough that it is
 * not sitting over the laboratory by the time the player has looked at it.
 */
export const BOOT_NOTICE_MS = 2_000;

/**
 * How loudly a status message is carried.
 *
 * `alert` stays: something went wrong, and a failed save that scrolls away is the silent loss NFR12
 * forbids. `notice` is a confirmation — it says its piece and gets out of the way, because the status
 * bar is drawn over the canvas and the canvas is the whole page now.
 */
export type BootStatusTone = 'alert' | 'notice';

let clearNotice: ReturnType<typeof setTimeout> | undefined;

/**
 * Writes to the status region, wherever in the document it is.
 *
 * **Resolved from the document rather than from the frame** since Story 2.12. The frame is dismissed on
 * entry, and this region is the only surface a failed autosave speaks from (NFR12) — a save can fail in
 * any phase, so a region scoped to the frame would be unreachable exactly when it mattered. It is now a
 * sibling of the frame in `index.html` and this function follows it there.
 *
 * A pending expiry is always cancelled first, so a notice cannot wipe an alert that replaced it — which
 * is the one way a timed message can turn into silent loss.
 */
export const setBootShellStatus = (message: string, tone: BootStatusTone = 'alert'): void => {
    const status = document.querySelector<HTMLElement>('#boot-status');
    if (!status) return;
    if (clearNotice !== undefined) {
        clearTimeout(clearNotice);
        clearNotice = undefined;
    }
    status.textContent = message;
    if (tone === 'notice') {
        clearNotice = setTimeout(() => {
            // Emptying it is what hides it: `#boot-status:empty` is `display: none`.
            status.textContent = '';
            clearNotice = undefined;
        }, BOOT_NOTICE_MS);
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

/**
 * Hydrates the frame and arms the entry gate.
 *
 * **The button now does what it says.** Before Story 2.12 it only wrote a status string: the frame was a
 * permanent column beside the canvas and the game booted on load regardless, so "open the laboratory to
 * begin" sat next to a laboratory that had already begun, and the DOM held a third of the viewport for
 * the rest of the session. Entering dismisses the frame and leaves the canvas the whole page.
 *
 * The game is still constructed on load, behind the frame, rather than on the click. Phaser's `Scale.FIT`
 * measures its container to letterbox the design surface, and a container inside a hidden or zero-sized
 * subtree measures as nothing — starting the game on entry would mean either a resize dance or a scene
 * that boots at the wrong scale. Covering a running canvas costs nothing that not starting it would save:
 * it is the same work, one click earlier, which is also what the offline reload gate already relies on.
 */
export const createBootShell = (root: HTMLElement, locale: Locale): { readonly entered: Promise<void> } => {
    const button = root.querySelector<HTMLButtonElement>('[data-testid="enter-laboratory"]');

    if (!button) {
        throw new Error('The boot shell requires an entry button.');
    }

    /**
     * Resolved once, when the player enters.
     *
     * A promise rather than a callback parameter because of *when* each side exists. This function runs
     * before the first `await` in `main.ts`, so the frame is hydrated in the resolved language as early
     * as possible; the game it has to unlock is not constructed until a case definition has loaded. A
     * promise lets the caller register afterwards without either side reaching for a mutable reference,
     * and an entry that happens during the load is still delivered — the `then` simply runs on the next
     * microtask once it is attached.
     */
    let admit: () => void;
    const entered = new Promise<void>((resolve) => { admit = resolve; });

    button.addEventListener('click', () => {
        // A notice, so it clears itself. It is worth saying — `#game-container` is `aria-hidden`, so for
        // a screen reader nothing at all happens on this click unless the live region says so — but it
        // is a confirmation, and a confirmation that never leaves is a bar across the laboratory.
        setBootShellStatus(getBootShellStatusMessage(locale), 'notice');
        root.hidden = true;
        admit();
    }, { once: true });

    renderBootShellText(root, locale);

    return { entered };
};
