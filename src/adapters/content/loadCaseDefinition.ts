import type { Result } from '../../core/errors/Result';
import type { CaseDefinition } from '../../domain/cases/CaseDefinition';
import { AssetManifestSchema, CaseDefinitionSchema } from '../../schemas/CaseDefinitionSchema';

type FetchCaseDefinition = (input: string) => Promise<Response>;

const contentPath = (baseUrl: string, caseId: string, fileName: string): string =>
    `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}cases/${encodeURIComponent(caseId)}/${fileName}`;

/**
 * Whether the case's declared asset block and the manifest file agree, field for field.
 *
 * `rights` is compared as well as `id`, `type` and `path` (Story 3.3). The two files each declare the
 * same entries, so every field either file gains is a field they can silently disagree about — and a
 * rights record is precisely the kind an author would update in one file and not the other. Compared
 * whole rather than key by key so the next field added to `AssetRights` is covered without this function
 * being remembered.
 *
 * **`JSON.stringify` is order-sensitive, and this is safe only because both sides are already parsed.**
 * The comparison used to be described as "structural", which it is not. `z.object` emits keys in
 * schema-declaration order, so two files authoring the same `rights` block with keys in different orders
 * both normalise to the same string — verified against `zod@4.4.3` during review, along with a reordered
 * `claimOrUse`. Compare anything here that has *not* been through `AssetRightsSchema` and the invariant
 * is gone, with a `manifest-mismatch` reported for two files that agree.
 */
const manifestsMatch = (definition: CaseDefinition, manifest: CaseDefinition['assets']): boolean =>
    definition.assets.manifestVersion === manifest.manifestVersion
    && definition.assets.entries.length === manifest.entries.length
    && definition.assets.entries.every((asset) => {
        const manifestAsset = manifest.entries.find((entry) => entry.id === asset.id);
        return manifestAsset?.type === asset.type
            && manifestAsset.path === asset.path
            && JSON.stringify(manifestAsset.rights) === JSON.stringify(asset.rights);
    });

const deepFreeze = <T>(value: T): T => {
    if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
        return value;
    }

    Object.freeze(value);
    for (const nestedValue of Object.values(value)) {
        deepFreeze(nestedValue);
    }
    return value;
};

const loadCaseDefinition = async (
    caseId: string,
    fetchCase: FetchCaseDefinition = (input) => fetch(input),
    baseUrl = import.meta.env.BASE_URL
): Promise<Result<CaseDefinition>> => {
    let response: Response;

    try {
        response = await fetchCase(contentPath(baseUrl, caseId, 'case.json'));
    } catch {
        return { ok: false, error: { code: 'content-unavailable', message: 'Case content is unavailable.' } };
    }

    if (response.status === 404) {
        return { ok: false, error: { code: 'case-not-found', message: 'The requested case was not found.' } };
    }

    if (!response.ok) {
        return { ok: false, error: { code: 'content-unavailable', message: 'Case content is unavailable.' } };
    }

    let content: unknown;
    try {
        content = await response.json();
    } catch {
        return { ok: false, error: { code: 'invalid-case-definition', message: 'Case content is not valid JSON.' } };
    }

    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) {
        // Not "the Young case contract" any more (Story 3.1): the contract is shared and a second case
        // loads through this same boundary, so naming Young would misreport which case failed. Verified
        // nothing asserts the old string.
        return { ok: false, error: { code: 'invalid-case-definition', message: 'Case content does not match the case contract.' } };
    }

    let manifestResponse: Response;
    try {
        manifestResponse = await fetchCase(contentPath(baseUrl, caseId, 'asset-manifest.json'));
    } catch {
        return { ok: false, error: { code: 'content-unavailable', message: 'Case content is unavailable.' } };
    }

    if (!manifestResponse.ok) {
        return { ok: false, error: { code: 'content-unavailable', message: 'Case content is unavailable.' } };
    }

    let manifestContent: unknown;
    try {
        manifestContent = await manifestResponse.json();
    } catch {
        return { ok: false, error: { code: 'invalid-case-definition', message: 'Case asset manifest is not valid JSON.' } };
    }

    const manifest = AssetManifestSchema.safeParse(manifestContent);
    if (!manifest.success || !manifestsMatch(parsed.data as CaseDefinition, manifest.data as CaseDefinition['assets'])) {
        return { ok: false, error: { code: 'invalid-case-definition', message: 'Case asset manifest does not match the case definition.' } };
    }

    return { ok: true, value: deepFreeze(parsed.data as CaseDefinition) };
};

export { loadCaseDefinition };
