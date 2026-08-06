import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { selectRivalLabCritique } from '../../src/domain/review/rivalLabRules';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/**
 * The authored Young content, not a hand-built fixture: selection is a lookup into shipped case data,
 * so a critique quietly dropped for one of the four conclusions has to fail here.
 *
 * No Phaser, no store, no locale, and no browser — which is the whole point of keeping the rule pure.
 */
let definition: CaseDefinition;

beforeAll(async () => {
    const content: unknown = JSON.parse(await readFile('public/cases/young-interference/case.json', 'utf8'));
    const parsed = CaseDefinitionSchema.safeParse(content);
    if (!parsed.success) throw new Error('The authored Young case must parse.');
    definition = parsed.data as CaseDefinition;
});

describe('selectRivalLabCritique', () => {
    it.each([
        'conclusion-spacing-varies',
        'conclusion-both-settings',
        'conclusion-wave-settled',
        'conclusion-universal-optics'
    ])('selects an authored critique for %s', (proposalId) => {
        const selection = selectRivalLabCritique(definition, proposalId);

        expect(selection).toBeDefined();
        expect(selection?.proposalId).toBe(proposalId);
        expect(definition.rivalLab.critiques.some(({ id }) => id === selection?.critiqueId)).toBe(true);
    });

    it('covers every authored conclusion proposal, so selection is total', () => {
        const uncovered = definition.conclusionProposals.filter(({ id }) => !selectRivalLabCritique(definition, id));

        expect(uncovered).toEqual([]);
    });

    it('takes the first authored critique for a proposal, in authored order', () => {
        const authored = definition.rivalLab.critiques.find(({ proposalId }) => proposalId === 'conclusion-wave-settled');

        expect(selectRivalLabCritique(definition, 'conclusion-wave-settled')?.critiqueId).toBe(authored?.id);
    });

    it('is deterministic across repeated calls', () => {
        const first = selectRivalLabCritique(definition, 'conclusion-universal-optics');
        const second = selectRivalLabCritique(definition, 'conclusion-universal-optics');

        expect(first).toEqual(second);
    });

    it('returns undefined for a proposal the definition does not carry', () => {
        expect(selectRivalLabCritique(definition, 'conclusion-not-authored')).toBeUndefined();
    });

    /**
     * Stable IDs, never prose. The line is resolved from the definition at display time so an author
     * can rewrite a critique without invalidating a single saved investigation — the `peerReviewRules`
     * trap this rule exists to avoid repeating.
     */
    it('carries IDs only, never the authored line', () => {
        const selection = selectRivalLabCritique(definition, 'conclusion-spacing-varies');

        expect(Object.keys(selection ?? {}).sort()).toEqual(['critiqueId', 'proposalId']);
    });

    /** He is the rival, not the cast: nothing may attribute a proposal or a dialogue beat to him. */
    it('names a rival who is not a member of the colleague cast', () => {
        expect(definition.colleagues.some(({ name }) => name === definition.rivalLab.name)).toBe(false);
    });
});
