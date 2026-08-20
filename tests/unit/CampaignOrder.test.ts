import { describe, expect, it } from 'vitest';

import {
    CAMPAIGN_ORDER,
    isCampaignCase,
    isCampaignCaseUnlocked,
    resolveCampaignEntryCaseId
} from '../../src/domain/cases/campaignOrder';
import { readCompletedCampaignCaseIds } from '../../src/adapters/persistence/completedCampaignCases';
import { CaseRecordRepository, type CaseRecordStorage } from '../../src/adapters/persistence/caseRecordRepository';
import { KNOWN_CASE_IDS, MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The campaign lock order (Story 4.1, AC6).
 *
 * Three clauses to prove, and each is written against `CAMPAIGN_ORDER` rather than against a repeated
 * string, so a reordering moves the expectation with the rule instead of leaving a literal behind.
 *
 * The change to `src/` that breaks each assertion is named at the test, because a test whose subject
 * cannot be broken is the "reads as coverage" shape `project-context.md` §Testing calls out.
 */
describe('the campaign lock order', () => {
    /**
     * AC6 clause 1. Breaks if `CAMPAIGN_ORDER` is reordered to build order — which is the mistake worth
     * guarding, because Young was the first production slice *and* the validated one, so every instinct
     * in the repository points at Young being first.
     */
    it('puts Morley–Miller before Young, against FR2 rather than build order', () => {
        expect(CAMPAIGN_ORDER.indexOf(MORLEY_MILLER_CASE_ID)).toBeLessThan(CAMPAIGN_ORDER.indexOf(YOUNG_CASE_ID));
        expect(CAMPAIGN_ORDER[0]).toBe(MORLEY_MILLER_CASE_ID);
    });

    /**
     * The claim `campaignOrder.ts`'s docstring makes about itself: the order and the allowlist hold the
     * same ids, so a third case added to `KNOWN_CASE_IDS` and not to the campaign fails here rather than
     * quietly falling out of the campaign. Breaks if either list gains a member the other lacks.
     */
    it('covers exactly the cases the build ships', () => {
        expect([...CAMPAIGN_ORDER].sort()).toEqual([...KNOWN_CASE_IDS].sort());
    });

    it('recognizes only campaign cases as campaign cases', () => {
        CAMPAIGN_ORDER.forEach((caseId) => expect(isCampaignCase(caseId)).toBe(true));
        ['unknown-case', '', 'Morley-Miller', 'morley-drift-bench'].forEach((caseId) => {
            expect(isCampaignCase(caseId)).toBe(false);
        });
    });

    describe('unlocking', () => {
        it('unlocks the first case with nothing completed, and nothing after it', () => {
            expect(isCampaignCaseUnlocked(MORLEY_MILLER_CASE_ID, [])).toBe(true);
            expect(isCampaignCaseUnlocked(YOUNG_CASE_ID, [])).toBe(false);
        });

        it('unlocks a case once every case before it is completed', () => {
            expect(isCampaignCaseUnlocked(YOUNG_CASE_ID, [MORLEY_MILLER_CASE_ID])).toBe(true);
        });

        /**
         * AC6 clause 2 — the clause the story states twice, because it is the one a well-meaning change
         * would break. Young is the validated slice, so "unlock Young, it's the finished one" is the
         * plausible edit; it would make this fail. Note it asserts *completing* Young specifically: a
         * completion of a later case must not reach back and unlock itself past an earlier one.
         */
        it('does not let a completed Young unlock or reorder anything ahead of Morley–Miller', () => {
            expect(isCampaignCaseUnlocked(YOUNG_CASE_ID, [YOUNG_CASE_ID])).toBe(false);
            expect(isCampaignCaseUnlocked(MORLEY_MILLER_CASE_ID, [YOUNG_CASE_ID])).toBe(true);
            expect(resolveCampaignEntryCaseId([YOUNG_CASE_ID])).toBe(MORLEY_MILLER_CASE_ID);
            // The order itself is authored, never derived from progress.
            expect([...CAMPAIGN_ORDER]).toEqual([MORLEY_MILLER_CASE_ID, YOUNG_CASE_ID]);
        });

        /**
         * AC6 clause 3. Monotonicity over every subset of the campaign: adding a completion may only ever
         * unlock more. Breaks the moment an unlock rule reads anything other than "every earlier case is
         * done" — an `every` flipped to `some` passes the two cases above and fails here.
         */
        it('is monotonic in the completed set', () => {
            const subsets = [[], [MORLEY_MILLER_CASE_ID], [YOUNG_CASE_ID], [...CAMPAIGN_ORDER]];
            subsets.forEach((completed) => {
                CAMPAIGN_ORDER.forEach((caseId) => {
                    if (!isCampaignCaseUnlocked(caseId, completed)) return;
                    // Unlocked here, so it must stay unlocked under every superset of this set.
                    subsets
                        .filter((larger) => completed.every((done) => larger.includes(done)))
                        .forEach((larger) => expect(isCampaignCaseUnlocked(caseId, larger)).toBe(true));
                });
            });
        });

        /** A case outside the campaign answers to its own route, not to campaign gating. */
        it('does not gate a case the campaign does not contain', () => {
            expect(isCampaignCaseUnlocked('morley-drift-bench', [])).toBe(true);
        });
    });

    describe('the campaign entry', () => {
        it('is the first uncompleted case in order', () => {
            expect(resolveCampaignEntryCaseId([])).toBe(MORLEY_MILLER_CASE_ID);
            expect(resolveCampaignEntryCaseId([MORLEY_MILLER_CASE_ID])).toBe(YOUNG_CASE_ID);
        });

        /** No "campaign finished" phase is authored, so a finished campaign lands on its last case. */
        it('lands on the last case when every case is completed', () => {
            expect(resolveCampaignEntryCaseId([...CAMPAIGN_ORDER])).toBe(CAMPAIGN_ORDER[CAMPAIGN_ORDER.length - 1]);
        });

        it('ignores completions of cases the campaign does not contain', () => {
            expect(resolveCampaignEntryCaseId(['morley-drift-bench'])).toBe(MORLEY_MILLER_CASE_ID);
        });
    });
});

/**
 * The boot path's half of AC6: assembling the completed set without an enumerating repository.
 *
 * A fake `CaseRecordStorage` rather than IndexedDB — the repository takes one by constructor injection
 * for exactly this, and `readCompletedCampaignCaseIds` is the only thing under test.
 */
describe('reading the completed campaign cases', () => {
    const storage = (read: CaseRecordStorage['read']): CaseRecordStorage => ({
        read,
        write: async () => ({ ok: true, value: undefined })
    });
    const repositoryReturning = (records: Readonly<Record<string, unknown>>): CaseRecordRepository =>
        new CaseRecordRepository(storage(async (caseId) => ({ ok: true, value: records[caseId] })));

    it('reports no completions when nothing has been saved', async () => {
        expect(await readCompletedCampaignCaseIds(repositoryReturning({}))).toEqual([]);
    });

    /**
     * A record that cannot be read is not a completion. Breaks if the `loaded.ok` guard is dropped or the
     * `completion !== undefined` test is loosened to "a record exists" — either would route a player past
     * a case on the strength of a record nothing could parse, which is the graceful-degradation shape
     * §Testing warns about rather than a loud failure.
     */
    it('does not count an unreadable or incomplete record as a completion', async () => {
        const repository = repositoryReturning({
            [MORLEY_MILLER_CASE_ID]: { nonsense: true },
            [YOUNG_CASE_ID]: undefined
        });

        expect(await readCompletedCampaignCaseIds(repository)).toEqual([]);
    });

    it('asks only for the cases the campaign contains', async () => {
        const asked: string[] = [];
        const repository = new CaseRecordRepository(storage(async (caseId) => {
            asked.push(caseId);
            return { ok: true, value: undefined };
        }));

        await readCompletedCampaignCaseIds(repository);

        expect(asked.sort()).toEqual([...CAMPAIGN_ORDER].sort());
    });
});
