import { readFile, readdir } from 'node:fs/promises';

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

/**
 * The authoring example under `docs/content-authoring/`, parsed through the production schema.
 *
 * **Not** under `public/cases/`: that directory is shipped, immutable content and `resolveCaseId` gates
 * on `KNOWN_CASE_IDS` anyway, so a fixture there would be dead weight in the bundle. It lives beside the
 * guide that explains it, and parsing *is* the assertion — the example's whole job is to be valid, and a
 * schema change that invalidates it fails here rather than misleading the next author.
 */
export const loadAuthoringExample = async (): Promise<CaseDefinition> =>
    CaseDefinitionSchema.parse(JSON.parse(
        await readFile(new URL('../docs/content-authoring/minimal-scenario.case.json', import.meta.url), 'utf8')
    )) as CaseDefinition;

/**
 * The repository's own source, for the few tests whose subject is a rule that spans files.
 *
 * Here for the same reason the case readers are, and it is the whole reason this module is not called
 * something narrower: `@types/node` is deliberately absent, so each file importing a `node:` module
 * adds a `TS2307` to `npm run typecheck:tests`, whose count may only go down. One module carries that
 * cost for the suite. Paths are repository-relative (`src/adapters/phaser/scenes/LibraryScene.ts`) and
 * resolved against this file, never against the working directory.
 */
export const readRepoFile = (relativePath: string): Promise<string> =>
    readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

/** The file names directly inside a repository directory, unsorted, for a source-level sweep. */
export const listRepoFiles = async (relativeDirectory: string): Promise<readonly string[]> =>
    readdir(new URL(`../${relativeDirectory}/`, import.meta.url));

/**
 * Every `.ts` file at or below a repository directory, repository-relative, sorted.
 *
 * A sweep that silently missed a subdirectory would report "no case ID appears in `src/domain/**`"
 * while never having opened half of it, which is the shape of assertion this project has been bitten
 * by repeatedly — so the recursion is here rather than left to each caller.
 */
export const listRepoSourceFiles = async (relativeDirectory: string): Promise<readonly string[]> => {
    const entries = await readdir(new URL(`../${relativeDirectory}/`, import.meta.url), { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
        const path = `${relativeDirectory}/${entry.name}`;
        if (entry.isDirectory()) return listRepoSourceFiles(path);
        return entry.name.endsWith('.ts') ? [path] : [];
    }));
    return files.flat().sort();
};
