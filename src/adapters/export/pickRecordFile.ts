type PickerDocument = Pick<Document, 'createElement' | 'body'>;

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
 * `cancel` is listened for as well as `change` so the element is removed when the player backs out. It
 * is not load-bearing: a browser that fires neither leaves one detached, hidden, listener-free input in
 * `body` and nothing else — this resolves `undefined` only when the player actually chose nothing.
 */
export const pickRecordFile = (documentRef: PickerDocument = document): Promise<Pick<File, 'text'> | undefined> =>
    new Promise((resolve) => {
        const input = documentRef.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.hidden = true;
        let settled = false;
        const finish = (file: Pick<File, 'text'> | undefined): void => {
            if (settled) return;
            settled = true;
            input.remove();
            resolve(file);
        };
        input.addEventListener('change', () => finish(input.files?.item(0) ?? undefined), { once: true });
        input.addEventListener('cancel', () => finish(undefined), { once: true });
        documentRef.body.append(input);
        input.click();
    });
