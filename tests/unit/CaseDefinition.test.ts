import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { loadCaseDefinition } from '../../src/adapters/content/loadCaseDefinition';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { createInitialCaseProgress } from '../../src/domain/cases/CaseProgress';
import { advanceCasePhase, resetCaseProgress } from '../../src/domain/cases/caseReducer';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

const validYoungCase: CaseDefinition = {
    id: 'young-interference',
    version: '1.0.0',
    openingDispute: 'Does light travel as particles, waves, or something more subtle?',
    contextualArtifacts: [
        {
            id: 'young-lecture-1801',
            displayName: 'Thomas Young’s 1801 lecture record',
            creatorOrOrigin: 'Thomas Young, Royal Institution lecture',
            sourceType: 'lecture-record',
            provenance: { category: 'primary-material', reference: 'young-1801-lecture' },
            rightsStatus: 'reviewed',
            caseRelationship: 'Contemporary account of Young’s interference demonstration.'
        },
        {
            id: 'newton-opticks',
            displayName: 'Opticks reference',
            creatorOrOrigin: 'Isaac Newton, published work',
            sourceType: 'published-book',
            provenance: { category: 'primary-material', reference: 'newton-opticks-1704' },
            rightsStatus: 'reviewed',
            caseRelationship: 'Earlier source that frames the corpuscular account considered by Young.'
        }
    ],
    prediction: { required: true },
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: 'Slit spacing', unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: 'Screen distance', unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    experiment: {
        modelVersion: 'young-double-slit-v1',
        wavelengthNm: 550,
        assumptions: ['The light is monochromatic.', 'The slit openings are narrow and identical.'],
        confound: { id: 'misaligned-screen', description: 'The screen begins slightly misaligned.', discoverableBy: 'replication' },
        resetPath: { recoveryRoute: 'replication', description: 'Repeat the observation after aligning the screen.' }
    },
    requirements: { minimumRuns: 2, minimumSources: 2 },
    flow: {
        openingDispute: true,
        curatedRecord: true,
        labSetup: true,
        minimumExperimentCycles: 2,
        maximumExperimentCycles: 4,
        theoryBoardReview: true,
        historicalDebrief: true,
        optionalReplay: true
    },
    debrief: { summary: 'Compare the observed pattern with the available evidence before drawing a conclusion.', sourceRefs: ['young-1801-lecture'] },
    assets: { manifestVersion: '1.0.0', entries: [{ id: 'quantique-logo', type: 'image', path: '/assets/logo.png' }] }
};

const cloneValidCase = (): CaseDefinition => structuredClone(validYoungCase);

describe('CaseDefinitionSchema', () => {
    it('accepts focused source records in the minimal Young contract', () => {
        expect(CaseDefinitionSchema.safeParse(validYoungCase)).toMatchObject({ success: true });
    });

    it.each([
        ['primary-material', 'lecture-record'],
        ['reconstruction', 'reconstruction'],
        ['later-interpretation', 'interpretive-essay'],
        ['deliberate-fiction', 'fictionalized-account']
    ])('accepts the %s provenance category', (category, sourceType) => {
        const definition = cloneValidCase();
        definition.contextualArtifacts[0] = {
            ...definition.contextualArtifacts[0],
            sourceType: sourceType as typeof definition.contextualArtifacts[0]['sourceType'],
            provenance: { ...definition.contextualArtifacts[0].provenance, category: category as typeof definition.contextualArtifacts[0]['provenance']['category'] }
        };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    it.each([
        ['bad ID', (definition: Record<string, unknown>) => { definition.id = 'another-case'; }],
        ['empty version', (definition: Record<string, unknown>) => { definition.version = ''; }],
        ['not exactly two artifacts', (definition: Record<string, unknown>) => { definition.contextualArtifacts = [definition.contextualArtifacts instanceof Array ? definition.contextualArtifacts[0] : undefined]; }],
        ['off-step control', (definition: Record<string, unknown>) => { ((definition.apparatus as { primaryControls: Array<{ defaultValue: number }> }).primaryControls[0]).defaultValue = 0.23; }],
        ['missing model version', (definition: Record<string, unknown>) => { delete (definition.experiment as { modelVersion?: string }).modelVersion; }],
        ['missing debrief source', (definition: Record<string, unknown>) => { (definition.debrief as { sourceRefs: string[] }).sourceRefs = []; }],
        ['invalid asset manifest', (definition: Record<string, unknown>) => { ((definition.assets as { entries: Array<{ path: string }> }).entries[0]).path = 'relative.png'; }],
        ['protocol-relative asset path', (definition: Record<string, unknown>) => { ((definition.assets as { entries: Array<{ path: string }> }).entries[0]).path = '//example.test/asset.png'; }],
        ['missing confound', (definition: Record<string, unknown>) => { delete (definition.experiment as { confound?: unknown }).confound; }],
        ['missing assumptions', (definition: Record<string, unknown>) => { delete (definition.experiment as { assumptions?: unknown }).assumptions; }],
        ['missing reset path', (definition: Record<string, unknown>) => { delete (definition.experiment as { resetPath?: unknown }).resetPath; }],
        ['invalid flow', (definition: Record<string, unknown>) => { (definition.flow as { maximumExperimentCycles: number }).maximumExperimentCycles = 5; }],
        ['blank source creator context', (definition: Record<string, unknown>) => { ((definition.contextualArtifacts as Array<{ creatorOrOrigin: string }>)[0]).creatorOrOrigin = ' '; }],
        ['unsupported provenance category', (definition: Record<string, unknown>) => { ((definition.contextualArtifacts as Array<{ provenance: { category: string } }>)[0]).provenance.category = 'unlabelled'; }],
        ['unsupported rights status', (definition: Record<string, unknown>) => { ((definition.contextualArtifacts as Array<{ rightsStatus: string }>)[0]).rightsStatus = 'verified-somewhere'; }],
        ['blank source relationship', (definition: Record<string, unknown>) => { ((definition.contextualArtifacts as Array<{ caseRelationship: string }>)[0]).caseRelationship = ''; }],
        ['duplicate source ID', (definition: Record<string, unknown>) => { ((definition.contextualArtifacts as Array<{ id: string }>)[1]).id = 'young-lecture-1801'; }],
        ['unknown source field', (definition: Record<string, unknown>) => { (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].unreviewedClaim = true; }],
        ['unknown top-level field', (definition: Record<string, unknown>) => { definition.laterCaseField = true; }]
    ])('rejects %s', (_description, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });
});

describe('loadCaseDefinition', () => {
    it('loads the immutable authored Young content and its declared manifest', async () => {
        const caseContent = await readFile(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf8');
        const manifestContent = await readFile(new URL('../../public/cases/young-interference/asset-manifest.json', import.meta.url), 'utf8');
        const fetchCase = vi.fn()
            .mockResolvedValueOnce(new Response(caseContent, { status: 200 }))
            .mockResolvedValueOnce(new Response(manifestContent, { status: 200 }));

        const result = await loadCaseDefinition('young-interference', fetchCase);

        expect(result).toMatchObject({ ok: true, value: { id: 'young-interference' } });
        expect(JSON.parse(manifestContent)).toEqual(validYoungCase.assets);
        expect(fetchCase).toHaveBeenNthCalledWith(1, '/cases/young-interference/case.json');
        expect(fetchCase).toHaveBeenNthCalledWith(2, '/cases/young-interference/asset-manifest.json');
    });

    it('returns a validated definition from the only content boundary', async () => {
        const fetchCase = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(validYoungCase), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(validYoungCase.assets), { status: 200 }));

        await expect(loadCaseDefinition('young-interference', fetchCase)).resolves.toEqual({ ok: true, value: validYoungCase });
        expect(fetchCase).toHaveBeenCalledWith('/cases/young-interference/case.json');
        expect(fetchCase).toHaveBeenCalledWith('/cases/young-interference/asset-manifest.json');
    });

    it.each([
        ['not found', new Response(null, { status: 404 }), 'case-not-found'],
        ['unavailable content', new Response(null, { status: 503 }), 'content-unavailable'],
        ['malformed JSON', { ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad JSON')) }, 'invalid-case-definition'],
        ['invalid schema content', new Response(JSON.stringify({ id: 'wrong' }), { status: 200 }), 'invalid-case-definition']
    ])('maps %s to a recoverable Result', async (_description, response, code) => {
        const fetchCase = vi.fn().mockResolvedValue(response);

        await expect(loadCaseDefinition('young-interference', fetchCase)).resolves.toMatchObject({ ok: false, error: { code } });
    });

    it('maps a network failure to a recoverable Result', async () => {
        const fetchCase = vi.fn().mockRejectedValue(new Error('offline'));

        await expect(loadCaseDefinition('young-interference', fetchCase)).resolves.toMatchObject({ ok: false, error: { code: 'content-unavailable' } });
    });

    it('uses a relative Vite base when loading static case content', async () => {
        const fetchCase = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(validYoungCase), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(validYoungCase.assets), { status: 200 }));

        await expect(loadCaseDefinition('young-interference', fetchCase, './')).resolves.toMatchObject({ ok: true });
        expect(fetchCase).toHaveBeenNthCalledWith(1, './cases/young-interference/case.json');
        expect(fetchCase).toHaveBeenNthCalledWith(2, './cases/young-interference/asset-manifest.json');
    });

    it.each([
        ['missing manifest', new Response(null, { status: 404 }), 'content-unavailable'],
        ['malformed manifest', { ok: true, json: () => Promise.reject(new SyntaxError('bad JSON')) }, 'invalid-case-definition'],
        ['mismatched manifest', new Response(JSON.stringify({ manifestVersion: '1.0.0', entries: [{ id: 'quantique-logo', type: 'image', path: '/assets/bg.png' }] }), { status: 200 }), 'invalid-case-definition']
    ])('rejects a %s before returning a definition', async (_description, manifestResponse, code) => {
        const fetchCase = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(validYoungCase), { status: 200 }))
            .mockResolvedValueOnce(manifestResponse);

        await expect(loadCaseDefinition('young-interference', fetchCase)).resolves.toMatchObject({ ok: false, error: { code } });
    });

    it('freezes a loaded authored definition recursively', async () => {
        const fetchCase = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify(validYoungCase), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(validYoungCase.assets), { status: 200 }));

        const result = await loadCaseDefinition('young-interference', fetchCase);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(Object.isFrozen(result.value)).toBe(true);
            expect(Object.isFrozen(result.value.assets.entries)).toBe(true);
            expect(Object.isFrozen(result.value.contextualArtifacts[0].provenance)).toBe(true);
            expect(() => (result.value.assets.entries as Array<unknown>).push({})).toThrow();
        }
    });
});

describe('caseReducer', () => {
    it('starts a fresh case in context and preserves the definition on reset', () => {
        const progress = createInitialCaseProgress(validYoungCase);
        const moved = advanceCasePhase(progress, 'prediction');

        expect(progress).toEqual({ definition: validYoungCase, phase: 'context' });
        expect(moved).toMatchObject({ ok: true, value: { phase: 'prediction' } });
        expect(resetCaseProgress(moved.ok ? moved.value : progress)).toEqual({ definition: validYoungCase, phase: 'context' });
    });

    it.each([
        ['context', 'prediction'],
        ['prediction', 'experiment'],
        ['experiment', 'synthesis'],
        ['synthesis', 'review'],
        ['review', 'debrief']
    ] as const)('allows the adjacent %s → %s transition', (phase, nextPhase) => {
        const result = advanceCasePhase({ definition: validYoungCase, phase }, nextPhase);

        expect(result).toEqual({ ok: true, value: { definition: validYoungCase, phase: nextPhase } });
    });

    it.each([
        ['context', 'experiment'],
        ['experiment', 'prediction'],
        ['debrief', 'debrief']
    ] as const)('rejects invalid %s → %s transitions', (phase, nextPhase) => {
        expect(advanceCasePhase({ definition: validYoungCase, phase }, nextPhase)).toMatchObject({ ok: false, error: { code: 'invalid-case-transition' } });
    });
});
