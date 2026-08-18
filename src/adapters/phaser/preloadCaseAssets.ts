import { resolveAssetUrl } from '../content/resolveAssetUrl';
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
 *
 * `baseUrl` defaults the way `loadCaseDefinition` already defaults it, so the four scene call sites
 * stay unchanged. Authored paths are root paths (`/assets/…`) and Phaser hands them to the browser
 * as-is, so without this resolution a subpath host requests them from the origin root — and because
 * a loader failure falls back silently, the only symptom is a missing portrait.
 */
export const preloadCaseAssets = (
    target: PreloadCaseAssetsTarget,
    definition: CaseAssetDefinition,
    baseUrl = import.meta.env.BASE_URL
): void => {
    definition.assets.entries.forEach((asset) => {
        if (asset.type !== 'image') return;

        const textureKey = caseAssetTextureKey(definition.id, asset.id);
        if (!target.textures.exists(textureKey)) {
            target.load.image(textureKey, resolveAssetUrl(asset.path, baseUrl));
        }
    });
};
