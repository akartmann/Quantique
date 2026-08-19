import { readFile } from 'node:fs/promises';

import type { CaseDefinition } from '../src/domain/cases/CaseDefinition';
import { CaseDefinitionSchema } from '../src/schemas/CaseDefinitionSchema';

/**
 * Reads the **real** content under `public/cases/` for the tests that assert facts about what ships.
 *
 * One module rather than a `node:fs/promises` import in each caller, and the reason is the typecheck
 * backlog rather than tidiness. `@types/node` is deliberately not a dependency of this project
 * (`tsconfig.test.json` says so and explains why), so every file importing a `node:` module contributes
 * a `TS2307` to `npm run typecheck:tests` — the single most common entry in that backlog, 26 files
 * carrying exactly that one error. Consolidating the read here means new tests that need shipped content
 * cost nothing rather than one more each.
 *
 * Paths are resolved against this file rather than the working directory: `readFile('public/…')` is
 * correct only when `vitest` happens to be invoked from the repository root, which is a property of how
 * the suite is run and not of the suite.
 */
const contentUrl = (caseId: string, fileName: string): URL =>
    new URL(`../public/cases/${caseId}/${fileName}`, import.meta.url);

/** The raw bytes, for a test that needs to assert on the file as authored rather than as parsed. */
export const readShippedCaseFile = (caseId: string, fileName: string): Promise<string> =>
    readFile(contentUrl(caseId, fileName), 'utf8');

/**
 * The shipped case, parsed through the production schema.
 *
 * Parsing rather than casting is the point: a test that reads shipped content and asserts on it is only
 * a statement about the release if the content also *validates*, and a content edit that breaks a
 * refinement fails here rather than at the caller's first assertion.
 */
export const loadShippedCase = async (caseId: string): Promise<CaseDefinition> =>
    CaseDefinitionSchema.parse(JSON.parse(await readShippedCaseFile(caseId, 'case.json'))) as CaseDefinition;
