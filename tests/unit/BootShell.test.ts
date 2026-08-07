import { describe, expect, it } from 'vitest';

import { getBootFailureMessage, getBootShellStatusMessage } from '../../src/ui/BootShell';

describe('getBootShellStatusMessage', () => {
    it('confirms the semantic lab entry interaction is ready', () => {
        expect(getBootShellStatusMessage('en')).toBe('Laboratory shell ready.');
    });

    it('confirms it in the active language', () => {
        expect(getBootShellStatusMessage('fr')).toBe('Laboratoire prêt.');
    });

    it('localizes the loud boot failure in both launch locales', () => {
        expect(getBootFailureMessage('en')).toBe('This page did not load correctly. Please reload it.');
        expect(getBootFailureMessage('fr')).toBe('Cette page ne s’est pas chargée correctement. Veuillez la recharger.');
    });
});
