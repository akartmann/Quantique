import { describe, expect, it } from 'vitest';

import { pickRecordFile } from '../../src/adapters/export/pickRecordFile';

describe('pickRecordFile', () => {
    it('settles and removes its transient input when focus returns without a picker event', async () => {
        const listeners = new Map<string, () => void>();
        let removed = false;
        const input = {
            type: '',
            accept: '',
            hidden: false,
            files: null,
            addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
            remove: () => { removed = true; },
            click: () => {}
        };
        const documentRef = {
            createElement: () => input,
            body: { append: () => {} }
        } as unknown as Pick<Document, 'createElement' | 'body'>;
        let onFocus: (() => void) | undefined;
        const windowRef = {
            addEventListener: (_name: 'focus', listener: () => void) => { onFocus = listener; },
            removeEventListener: () => {}
        } as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>;

        const selected = pickRecordFile(documentRef, windowRef);
        onFocus?.();

        await expect(selected).resolves.toBeUndefined();
        expect(removed).toBe(true);
    });
});
