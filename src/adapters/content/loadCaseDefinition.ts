import type { Result } from '../../core/errors/Result';
import type { CaseDefinition } from '../../domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../../schemas/CaseDefinitionSchema';

type FetchCaseDefinition = (input: string) => Promise<Response>;

const loadCaseDefinition = async (
    caseId: string,
    fetchCase: FetchCaseDefinition = (input) => fetch(input)
): Promise<Result<CaseDefinition>> => {
    let response: Response;

    try {
        response = await fetchCase(`/cases/${caseId}/case.json`);
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

    return { ok: true, value: parsed.data as CaseDefinition };
};

export { loadCaseDefinition };
