import { describe, expect, it } from 'vitest';

import {
    caseAssetTextureKey,
    preloadCaseAssets,
    type PreloadCaseAssetsTarget
} from '../../src/adapters/phaser/preloadCaseAssets';

const youngAssets = {
    manifestVersion: '1.1.0',
    entries: [
        { id: 'quantique-logo', type: 'image' as const, path: '/assets/logo.png' },
        { id: 'thea-young-portrait', type: 'image' as const, path: '/cases/young-interference/assets/characters/thea-young.png' },
        { id: 'elias-wren-portrait', type: 'image' as const, path: '/cases/young-interference/assets/characters/elias-wren.png' },
        { id: 'marianne-cole-portrait', type: 'image' as const, path: '/cases/young-interference/assets/characters/marianne-cole.png' },
        { id: 'samuel-hart-portrait', type: 'image' as const, path: '/cases/young-interference/assets/characters/samuel-hart.png' },
        { id: 'arthur-bell-portrait', type: 'image' as const, path: '/cases/young-interference/assets/characters/arthur-bell.png' },
        { id: 'narration', type: 'audio' as const, path: '/cases/young-interference/audio/narration.mp3' },
        { id: 'lecture-notes', type: 'document' as const, path: '/cases/young-interference/documents/lecture-notes.pdf' }
    ]
};

const createTarget = (existingTextureKeys: readonly string[] = []) => {
    const queued: Array<readonly [key: string, path: string]> = [];
    const target: PreloadCaseAssetsTarget = {
        load: {
            image: (key, path) => queued.push([key, path])
        },
        textures: {
            exists: (key) => existingTextureKeys.includes(key)
        }
    };

    return { queued, target };
};

describe('preloadCaseAssets', () => {
    it('queues every image in a case manifest under deterministic case-namespaced texture keys', () => {
        // This catches an incomplete bundle, an asset-ID-only key collision, or sending a non-image
        // manifest entry through Phaser's image loader. It also pins the defaulted base: with no
        // third argument the loader path comes from `import.meta.env.BASE_URL`, which is `'/'` here
        // because `vitest.config.ts` sets no `base`. That is the origin-root row of the matrix, not
        // the base a real build ships — production sets `'./'`, and the subpath case below is what
        // covers a prefix actually being applied.
        const { queued, target } = createTarget();

        preloadCaseAssets(target, { id: 'young-interference', assets: youngAssets });

        expect(queued).toEqual([
            ['case:young-interference:quantique-logo', '/assets/logo.png'],
            ['case:young-interference:thea-young-portrait', '/cases/young-interference/assets/characters/thea-young.png'],
            ['case:young-interference:elias-wren-portrait', '/cases/young-interference/assets/characters/elias-wren.png'],
            ['case:young-interference:marianne-cole-portrait', '/cases/young-interference/assets/characters/marianne-cole.png'],
            ['case:young-interference:samuel-hart-portrait', '/cases/young-interference/assets/characters/samuel-hart.png'],
            ['case:young-interference:arthur-bell-portrait', '/cases/young-interference/assets/characters/arthur-bell.png']
        ]);
    });

    it('does not requeue a manifest image whose case texture is already available', () => {
        // This catches the cache check using an unnamespaced ID (or being omitted), which would make
        // each routed restored scene request the same portrait again.
        const { queued, target } = createTarget(['case:young-interference:thea-young-portrait']);

        preloadCaseAssets(target, { id: 'young-interference', assets: youngAssets });

        expect(queued).not.toContainEqual([
            'case:young-interference:thea-young-portrait',
            '/cases/young-interference/assets/characters/thea-young.png'
        ]);
        expect(queued).toHaveLength(5);
    });

    it('resolves every queued image against an explicit deploy base', () => {
        // The authored manifest paths are root paths, and Phaser passes a loader path to the browser
        // as-is. On a subpath host they would resolve against the origin root, and a Phaser load
        // failure is silent — every portrait would fall back to vector art with nothing logged. The
        // texture keys must not move with the base: they are cache identity, not location.
        const { queued, target } = createTarget();

        preloadCaseAssets(target, { id: 'young-interference', assets: youngAssets }, '/Quantique/');

        expect(queued).toEqual([
            ['case:young-interference:quantique-logo', '/Quantique/assets/logo.png'],
            ['case:young-interference:thea-young-portrait', '/Quantique/cases/young-interference/assets/characters/thea-young.png'],
            ['case:young-interference:elias-wren-portrait', '/Quantique/cases/young-interference/assets/characters/elias-wren.png'],
            ['case:young-interference:marianne-cole-portrait', '/Quantique/cases/young-interference/assets/characters/marianne-cole.png'],
            ['case:young-interference:samuel-hart-portrait', '/Quantique/cases/young-interference/assets/characters/samuel-hart.png'],
            ['case:young-interference:arthur-bell-portrait', '/Quantique/cases/young-interference/assets/characters/arthur-bell.png']
        ]);
    });

    it('derives a case namespace even when two cases publish the same manifest asset ID', () => {
        expect(caseAssetTextureKey('young-interference', 'thea-young-portrait')).toBe('case:young-interference:thea-young-portrait');
        expect(caseAssetTextureKey('later-case', 'thea-young-portrait')).toBe('case:later-case:thea-young-portrait');
    });
});
