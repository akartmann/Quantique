import type { CaseDefinition } from '../../domain/cases/CaseDefinition';

/** The Phaser slice required to queue case images without a canvas-backed Scene in unit tests. */
export type PreloadCaseAssetsTarget = Readonly<{
    load: Readonly<{
        image: (key: string, path: string) => unknown;
    }>;
    textures: Readonly<{
        exists: (key: string) => boolean;
    }>;
}>;

type CaseAssetDefinition = Pick<CaseDefinition, 'id' | 'assets'>;

/**
 * Namespacing keeps authored asset IDs reusable across cases while giving each Phaser texture a
 * stable cache key.
 */
export const caseAssetTextureKey = (caseId: string, assetId: string): string => `case:${caseId}:${assetId}`;

/**
 * Queues the selected case's complete image bundle before its routed scene creates. Loader failures
 * remain Phaser's normal non-throwing load result: renderers may inspect the texture cache and use
 * their authored vector fallback.
 */
export const preloadCaseAssets = (target: PreloadCaseAssetsTarget, definition: CaseAssetDefinition): void => {
    definition.assets.entries.forEach((asset) => {
        if (asset.type !== 'image') return;

        const textureKey = caseAssetTextureKey(definition.id, asset.id);
        if (!target.textures.exists(textureKey)) {
            target.load.image(textureKey, asset.path);
        }
    });
};
