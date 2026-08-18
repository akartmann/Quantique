import { describe, expect, it } from 'vitest';

import { resolveAssetUrl } from '../../src/adapters/content/resolveAssetUrl';

const LOGO = '/assets/logo.png';
const PORTRAIT = '/cases/young-interference/assets/characters/thea-young.png';

describe('resolveAssetUrl', () => {
    it('makes an authored root path document-relative under the shipped base', () => {
        // `'./'` is what both Vite configs set, so this is the resolution every real build performs.
        // A document-relative URL is the one form that is correct at the origin root and under a
        // subpath host without the build knowing which it is.
        expect(resolveAssetUrl(LOGO, './')).toBe('./assets/logo.png');
        expect(resolveAssetUrl(PORTRAIT, './')).toBe('./cases/young-interference/assets/characters/thea-young.png');
    });

    it('leaves an authored root path untouched when the site is served from the origin root', () => {
        // This is the no-regression case: the preview server and the offline-reload spec both observe
        // these exact pathnames, so a base of `'/'` must not rewrite them at all.
        expect(resolveAssetUrl(LOGO, '/')).toBe(LOGO);
        expect(resolveAssetUrl(PORTRAIT, '/')).toBe(PORTRAIT);
    });

    it('prefixes an explicit subpath base', () => {
        expect(resolveAssetUrl(LOGO, '/Quantique/')).toBe('/Quantique/assets/logo.png');
        expect(resolveAssetUrl(PORTRAIT, '/Quantique/'))
            .toBe('/Quantique/cases/young-interference/assets/characters/thea-young.png');
    });

    it('joins with exactly one separator whether or not the base carries a trailing slash', () => {
        // `import.meta.env.BASE_URL` is not guaranteed to end in a slash, and both failure modes are
        // silent at load time: `//assets/…` reads as a protocol-relative host, and a missing separator
        // fuses the base into the first path segment.
        expect(resolveAssetUrl(LOGO, '/Quantique')).toBe('/Quantique/assets/logo.png');
        expect(resolveAssetUrl(LOGO, '/Quantique/')).toBe(resolveAssetUrl(LOGO, '/Quantique'));

        // Anchored, not a substring search: the defect is a leading `//`, which the browser reads as
        // the start of an authority and sends to another host entirely. A `//` later in a path is
        // merely odd, so `toContain` would both miss the point and reject legitimate input.
        expect(resolveAssetUrl(LOGO, '/')).not.toMatch(/^\/\//);
        expect(resolveAssetUrl(LOGO, './')).not.toMatch(/^\/\//);
        expect(resolveAssetUrl(LOGO, '/Quantique/')).not.toMatch(/^\/\//);
    });
});
