import { describe, expect, it } from 'vitest';

import { getBootShellStatusMessage } from '../../src/ui/BootShell';

describe('getBootShellStatusMessage', () => {
    it('confirms the semantic lab entry interaction is ready', () => {
        expect(getBootShellStatusMessage('en')).toBe('Laboratory shell ready.');
    });

    it('confirms it in the active language', () => {
        expect(getBootShellStatusMessage('fr')).toBe('Laboratoire prêt.');
    });
});
