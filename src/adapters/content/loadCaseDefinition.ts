import type { Result } from '../../core/errors/Result';
import type { CaseDefinition } from '../../domain/cases/CaseDefinition';
import { AssetManifestSchema, CaseDefinitionSchema } from '../../schemas/CaseDefinitionSchema';

type FetchCaseDefinition = (input: string) => Promise<Response>;

const contentPath = (baseUrl: string, caseId: string, fileName: string): string =>
    `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}cases/${encodeURIComponent(caseId)}/${fileName}`;

const manifestsMatch = (definition: CaseDefinition, manifest: CaseDefinition['assets']): boolean =>
    definition.assets.manifestVersion === manifest.manifestVersion
    && definition.assets.entries.length === manifest.entries.length
    && definition.assets.entries.every((asset) => {
        const manifestAsset = manifest.entries.find((entry) => entry.id === asset.id);
        return manifestAsset?.type === asset.type && manifestAsset.path === asset.path;
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
        return { ok: false, error: { code: 'invalid-case-definition', message: 'Case content does not match the Young case contract.' } };
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
