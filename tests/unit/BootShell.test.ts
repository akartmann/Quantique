import { describe, expect, it } from 'vitest';

import { getBootShellStatusMessage } from '../../src/ui/BootShell';

describe('getBootShellStatusMessage', () => {
    it('confirms the semantic lab entry interaction is ready', () => {
        expect(getBootShellStatusMessage()).toBe('Laboratory shell ready.');
    });
});
