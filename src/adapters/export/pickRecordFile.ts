type PickerDocument = Pick<Document, 'createElement' | 'body'>;
type PickerWindow = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * Asks the player for a progress record, through a file input that exists only for the ask.
 *
 * ## Why this is an adapter and not a panel (Story 2.12, D2)
 *
 * `CaseProgressPanel` owned the only `<input type="file">` in the project and is deleted. The import it
 * fed is `NFR12`'s "progress survives a failed import without silent loss" and half of `FR11`, so the
 * capability has to survive its panel — but a browser will not open a file chooser without a real input
 * element, and no amount of canvas can substitute for one.
 *
 * The shape is `exportCaseRecord`'s, deliberately and exactly: create a hidden element, use it, remove
 * it. That element has no persistent DOM presence, mirrors no Phaser gesture, and adds no semantic HTML
 * control the player can reach — which is what ADR-001 v1.1 forbids. It is the same mechanism the export
 * anchor has been using since Story 1.8, pointed the other way.
 *
 * ## The lock is not taken here
 *
 * Deliberately. `store.acquireExclusiveOperation` refuses **every** dispatch while it is held, and a
 * player who opens this chooser and then closes it without choosing is entitled to carry on. The caller
 * takes the lock once a file exists, which is the ordering the retired panel had and the reason it was
 * right.
 *
 * `cancel` is listened for as well as `change`, with a focus-return fallback for browsers that fire
 * neither when the player backs out. Every completion route removes the transient input.
 */
export const pickRecordFile = (
    documentRef: PickerDocument = document,
    windowRef: PickerWindow = window
): Promise<Pick<File, 'text'> | undefined> =>
    new Promise((resolve) => {
        const input = documentRef.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.hidden = true;
        let settled = false;
        let onWindowFocus: () => void = () => {};
        const finish = (file: Pick<File, 'text'> | undefined): void => {
            if (settled) return;
            settled = true;
            windowRef.removeEventListener('focus', onWindowFocus);
            input.remove();
            resolve(file);
        };
        // Some browsers close a native picker without dispatching either input event. Focus returning to
        // the document is the completion boundary they do guarantee; queueing lets a real `change` win
        // when the player did select a file.
        onWindowFocus = (): void => queueMicrotask(() => finish(undefined));
        input.addEventListener('change', () => finish(input.files?.item(0) ?? undefined), { once: true });
        input.addEventListener('cancel', () => finish(undefined), { once: true });
        windowRef.addEventListener('focus', onWindowFocus, { once: true });
        documentRef.body.append(input);
        input.click();
    });
