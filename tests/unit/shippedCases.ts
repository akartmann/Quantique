import { readFile } from 'node:fs/promises';

import { CaseDefinitionSchema, MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID } from '../../src/schemas/CaseDefinitionSchema';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

/**
 * Loads a **shipped** case definition, in one place (Story 4.2).
 *
 * ## Why this exists
 *
 * Twenty unit test files opened `public/cases/…/case.json` with their own `readFile` and their own
 * `safeParse`, each repeating the same six lines and the same *"the authored case must parse"* throw. That
 * is twenty copies of one fact, which is the habit `designSurface.ts` and `apparatusGeometry.ts` exist to
 * end one layer down — and it had a measurable cost besides.
 *
 * `tsconfig.test.json` deliberately declares no `@types/node`, so **every** file importing
 * `node:fs/promises` contributes a `TS2307` to `npm run typecheck:tests`, whose error count *"is the metric
 * and may only go down"*. Twenty files meant twenty of those errors. Adding three more test files for this
 * story would have meant three more, and the count would have gone the wrong way for a mechanical reason
 * that has nothing to do with the work. Now the import lives here, once, and a file that reads a case
 * through this helper adds none.
 *
 * The `@types/node` question is a separate, larger item — it would close 26 of the errors in one move —
 * recorded in `deferred-work.md` and deliberately not attempted mid-story.
 *
 * ## Loading, not fixturing
 *
 * These are the definitions that ship, parsed through the real schema. That is the point:
 * `ApparatusCaseVoice.test.ts`'s own header states the rule — *"a fixture would let a projection agree
 * with a case nobody plays"* — and this helper is how a file follows it without paying for it twice.
 */
const parse = async (path: string): Promise<CaseDefinition> => {
    const content: unknown = JSON.parse(await readFile(path, 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) {
        // The issues, not just the failure: a schema change that breaks shipped content should say which
        // path it broke, rather than making twenty files report the same opaque sentence.
        throw new Error(`The authored case at ${path} must parse. Issues: ${JSON.stringify(parsed.error.issues)}`);
    }
    return parsed.data as CaseDefinition;
};

/** The Young case, as it ships. */
export const loadYoungCase = (): Promise<CaseDefinition> =>
    parse(`public/cases/${YOUNG_CASE_ID}/case.json`);

/** The Morley–Miller case, as it ships. */
export const loadMorleyMillerCase = (): Promise<CaseDefinition> =>
    parse(`public/cases/${MORLEY_MILLER_CASE_ID}/case.json`);

/**
 * Both shipped cases, for a sweep that must not quietly narrow to one.
 *
 * Paired with its own id so a failure names the case rather than an index — the same reason
 * `french-typography.spec.ts` puts the case id in every sample label.
 */
export const loadShippedCases = async (): Promise<readonly Readonly<{ caseId: string; definition: CaseDefinition }>[]> => {
    const [young, morleyMiller] = await Promise.all([loadYoungCase(), loadMorleyMillerCase()]);
    return Object.freeze([
        { caseId: YOUNG_CASE_ID, definition: young },
        { caseId: MORLEY_MILLER_CASE_ID, definition: morleyMiller }
    ]);
};
