import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { loadCaseDefinition } from '../../src/adapters/content/loadCaseDefinition';
import type { CaseDefinition, LocalizedText, LocalizedTextList, TextualRendition } from '../../src/domain/cases/CaseDefinition';
import { CASE_PHASES, createInitialCaseProgress } from '../../src/domain/cases/CaseProgress';
import { advanceCasePhase, resetCaseProgress, retreatCasePhase } from '../../src/domain/cases/caseReducer';
import { CaseDefinitionSchema, MAX_PRIMARY_CONTROLS } from '../../src/schemas/CaseDefinitionSchema';

/** Fixture helpers: every localizable authored string must carry both shipped locales. */
const bilingual = (english: string, french = `${english} [fr]`): LocalizedText => ({ en: english, fr: french });
const bilingualList = (english: readonly string[], french = english.map((entry) => `${entry} [fr]`)): LocalizedTextList =>
    ({ en: [...english], fr: [...french] });

const localLectureRendition = (sectionId = 'young-bakerian-page-12'): TextualRendition => ({
    readerLabel: bilingual('Read the lecture record'),
    citation: {
        reuseStatement: bilingual('Public Domain Mark source.'),
        citationText: 'Young, The Bakerian lecture.',
        archiveUrl: 'https://wellcomecollection.org/works/u5dr8rgg'
    },
    // One rendition per shipped locale, page-for-page aligned: the transcription of record plus a
    // translation of it.
    renditions: [
        {
            locale: 'en',
            kind: 'transcription',
            sections: [{ id: sectionId, heading: 'Printed page 12', paragraphs: ['Opening text.'], sourcePages: [12] }]
        },
        {
            locale: 'fr',
            kind: 'translation',
            sections: [{ id: sectionId, heading: 'Page imprimée 12', paragraphs: ['Texte d’ouverture.'], sourcePages: [12] }]
        }
    ]
});

const validYoungCase: CaseDefinition = {
    id: 'young-interference',
    version: '1.0.0',
    openingDispute: bilingual('Does light travel as particles, waves, or something more subtle?'),
    contextualArtifacts: [
        {
            id: 'young-lecture-1801',
            displayName: bilingual('Thomas Young’s 1801 lecture record'),
            creatorOrOrigin: 'Thomas Young, Royal Institution lecture',
            sourceType: 'lecture-record',
            provenance: { category: 'primary-material', reference: 'young-1801-lecture' },
            rightsStatus: 'reviewed',
            caseRelationship: bilingual('Contemporary account of Young’s interference demonstration.'),
            textualRendition: localLectureRendition('young-bakerian-page-12')
        },
        {
            id: 'newton-opticks',
            displayName: bilingual('Opticks reference'),
            creatorOrOrigin: 'Isaac Newton, published work',
            sourceType: 'published-book',
            provenance: { category: 'primary-material', reference: 'newton-opticks-1704' },
            rightsStatus: 'reviewed',
            caseRelationship: bilingual('Earlier source that frames the corpuscular account considered by Young.'),
            textualRendition: localLectureRendition('newton-opticks-page-1')
        }
    ],
    prediction: { required: true },
    apparatus: {
        primaryControls: [
            { id: 'slitSpacingMm', label: bilingual('Slit spacing', 'Écartement des fentes'), unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
            { id: 'screenDistanceM', label: bilingual('Screen distance', 'Distance à l’écran'), unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
        ]
    },
    experiment: {
        modelVersion: 'young-double-slit-v1',
        wavelengthNm: 550,
        assumptions: bilingualList(['The light is monochromatic.', 'The slit openings are narrow and identical.']),
        confound: { id: 'misaligned-screen', description: bilingual('The screen begins slightly misaligned.'), discoverableBy: 'replication' },
        resetPath: { recoveryRoute: 'replication', description: bilingual('Repeat the observation after aligning the screen.') }
    },
    requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'], criticalModelInputIds: ['wavelengthNm'] },
    colleagueHints: [
        { id: 'h-1', colleagueId: 'elias-wren', predicate: { kind: 'no-recorded-runs' }, line: bilingual('Take a reading and write it down.') },
        { id: 'h-2', colleagueId: 'marianne-cole', predicate: { kind: 'below-significant-measures' }, line: bilingual('Change a setting and record it beside the first.') }
    ],
    readingGateHints: [
        { id: 'r-1', colleagueId: 'samuel-hart', predicate: { kind: 'missing-artifact', artifactId: 'young-lecture-1801' }, line: bilingual('Young’s own lecture record is still unopened.') },
        { id: 'r-2', colleagueId: 'thea-young', predicate: { kind: 'any-missing-reading' }, line: bilingual('There is something on that shelf you have not opened.') }
    ],
    colleagues: [
        { id: 'thea-young', name: 'Dr. Thea Young', role: 'lead', portrait: { kind: 'silhouette', accentColor: '#c9a227' } },
        { id: 'elias-wren', name: 'Elias Wren', role: 'builder', portrait: { kind: 'silhouette', accentColor: '#4f8a8b' } },
        { id: 'marianne-cole', name: 'Marianne Cole', role: 'analyst', portrait: { kind: 'silhouette', accentColor: '#9c6b98' } },
        { id: 'samuel-hart', name: 'Samuel Hart', role: 'communicator', portrait: { kind: 'silhouette', accentColor: '#b8653f' } }
    ],
    predictionProposals: [
        { id: 'p-1', colleagueId: 'thea-young', text: bilingual('Alternating bright and dark bands will appear.') },
        { id: 'p-2', colleagueId: 'elias-wren', text: bilingual('Two bright patches will appear, one behind each opening.') },
        { id: 'p-3', colleagueId: 'marianne-cole', text: bilingual('A single blurred band will appear at the centre.') },
        { id: 'p-4', colleagueId: 'samuel-hart', text: bilingual('The screen will brighten evenly with no structure.') }
    ],
    conclusionProposals: [
        {
            id: 'c-1',
            colleagueId: 'marianne-cole',
            claim: bilingual('The recorded band spacing changes with the apparatus settings as a wave account predicts.'),
            limitation: bilingual('These observations bound one apparatus over a few settings.'),
            supportPredicate: {
                kind: 'all-of',
                predicates: [
                    { kind: 'minimum-runs', count: 2 },
                    { kind: 'varied-control', controlId: 'slitSpacingMm' },
                    { kind: 'inspected-source', sourceId: 'young-lecture-1801' },
                    { kind: 'inspected-source', sourceId: 'newton-opticks' }
                ]
            }
        },
        {
            id: 'c-2',
            colleagueId: 'elias-wren',
            claim: bilingual('Both apparatus settings shift the bands in the direction a wave account predicts.'),
            limitation: bilingual('Only the settings actually varied are covered by this statement.'),
            supportPredicate: {
                kind: 'all-of',
                predicates: [
                    { kind: 'minimum-runs', count: 2 },
                    { kind: 'varied-control', controlId: 'slitSpacingMm' },
                    { kind: 'varied-control', controlId: 'screenDistanceM' }
                ]
            }
        },
        {
            id: 'c-3',
            colleagueId: 'thea-young',
            claim: bilingual('Light is a wave and the particle account is settled.'),
            limitation: bilingual('No limitation is offered for this statement.'),
            supportPredicate: { kind: 'never' }
        },
        {
            id: 'c-4',
            colleagueId: 'samuel-hart',
            claim: bilingual('Every optical phenomenon follows from this demonstration.'),
            limitation: bilingual('No limitation is offered for this statement.'),
            supportPredicate: { kind: 'never' }
        }
    ],
    rivalLab: {
        name: 'Mr. Arthur Bell',
        accentColor: '#8c3b3b',
        critiques: [
            { id: 'critique-c-1', proposalId: 'c-1', line: bilingual('You measured one setting twice and call it a trend.') },
            { id: 'critique-c-2', proposalId: 'c-2', line: bilingual('I see no record of either setting varied on its own.') },
            { id: 'critique-c-3', proposalId: 'c-3', line: bilingual('One bench, one lamp, and the matter is settled? State where your bands stop.') },
            { id: 'critique-c-4', proposalId: 'c-4', line: bilingual('Which effect you never observed does this bench account for?') }
        ]
    },
    consultationRules: [
        { id: 'missing-run', predicate: { kind: 'missing-run' }, layers: { observation: bilingual('Fewer than two observations are recorded.'), plainLanguage: bilingual('Record another observation.'), technicalDetail: bilingual('Use another bounded setting.') }, nextStep: bilingual('Record an observation.') },
        { id: 'missing-source', predicate: { kind: 'missing-source', sourceId: 'young-lecture-1801' }, layers: { observation: bilingual('A source is not inspected.'), plainLanguage: bilingual('Inspect the source.'), technicalDetail: bilingual('Check its provenance.') }, nextStep: bilingual('Inspect the lecture record.') },
        { id: 'alternative-test', predicate: { kind: 'alternative-test', controlId: 'screenDistanceM' }, layers: { observation: bilingual('Settings are unchanged.'), plainLanguage: bilingual('Change one setting.'), technicalDetail: bilingual('Preserve the observation record.') }, nextStep: bilingual('Adjust screen distance.') },
        { id: 'missing-limit', predicate: { kind: 'missing-limitation' }, layers: { observation: bilingual('No limitation is stated.'), plainLanguage: bilingual('State a limitation.'), technicalDetail: bilingual('Distinguish evidence from a broader claim.') }, nextStep: bilingual('Add a limitation.') }
    ],
    peerReviewRules: [
        { id: 'missing-evidence', predicate: { kind: 'missing-evidence' }, feedback: bilingual('More evidence is needed.'), revisionPath: bilingual('Select evidence.') },
        { id: 'unsupported', predicate: { kind: 'unsupported-support' }, feedback: bilingual('Support is unavailable.'), revisionPath: bilingual('Use current evidence.') },
        { id: 'overreach', predicate: { kind: 'overreach', overreachPhrases: bilingualList(['proves'], ['prouve']) }, feedback: bilingual('The claim may overreach.'), revisionPath: bilingual('Use a bounded claim.') }
    ],
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
    autoSummary: bilingual(
        'Observations recorded: {runCount}. Distinct settings: {configurationCount}. Sources read: {sourceCount}. Sources: {sourceNames}. Revisions: {revisionCount}.',
        'Observations enregistrées : {runCount}. Réglages distincts : {configurationCount}. Sources consultées : {sourceCount}. Sources : {sourceNames}. Révisions : {revisionCount}.'
    ),
    scenarioScript: {
        scenes: [
            { phase: 'context', sceneKey: 'Library' },
            { phase: 'prediction', sceneKey: 'Colleagues' },
            { phase: 'experiment', sceneKey: 'Laboratory' },
            { phase: 'synthesis', sceneKey: 'TheoryBoard' },
            { phase: 'review', sceneKey: 'TheoryBoard' },
            { phase: 'debrief', sceneKey: 'Debrief' }
        ]
    },
    debrief: {
        summary: bilingual('Compare the observed pattern with the available evidence before drawing a conclusion.'), sourceRefs: ['young-1801-lecture'],
        historicalComparison: { title: bilingual('Young and Opticks'), text: bilingual('The authored records remain fixed.'), sourceIds: ['young-lecture-1801', 'newton-opticks'] },
        deeperTheory: { title: bilingual('Deeper theory'), text: bilingual('A reconstruction is not the historical record.') }, replayLabel: bilingual('Start counterfactual replay')
    },
    assets: {
        manifestVersion: '1.1.0',
        entries: [
            { id: 'quantique-logo', type: 'image', path: '/assets/logo.png' },
            { id: 'thea-young-portrait', type: 'image', path: '/cases/young-interference/assets/characters/thea-young.png' },
            { id: 'elias-wren-portrait', type: 'image', path: '/cases/young-interference/assets/characters/elias-wren.png' },
            { id: 'marianne-cole-portrait', type: 'image', path: '/cases/young-interference/assets/characters/marianne-cole.png' },
            { id: 'samuel-hart-portrait', type: 'image', path: '/cases/young-interference/assets/characters/samuel-hart.png' },
            { id: 'arthur-bell-portrait', type: 'image', path: '/cases/young-interference/assets/characters/arthur-bell.png' }
        ]
    }
};

const cloneValidCase = (): CaseDefinition => structuredClone(validYoungCase);

/**
 * The same canonical fixture, re-authored as a case that shares **none** of Young's specifics — a
 * different kebab-case ID, a different control set with different bounds and units, no wavelength at
 * all, its own significance rule, and its own evidence floor (AC3).
 *
 * Derived from `validYoungCase` rather than written out beside it, deliberately. A parallel 200-line
 * fixture is a fixture that stops tracking the contract: the next authored field would be added to one
 * and not the other, and the "a second case still parses" guarantee would quietly start testing an
 * older shape. Deriving means every field Story 3.2 adds is inherited here for free, and anything that
 * *cannot* be de-Younged shows up immediately as a parse failure in this file.
 *
 * It also carries counts Young does not: `minimumRuns: 3` proves the requirement floors really are
 * floors rather than literals, and a 2-to-6 cycle range proves the same of FR3's range.
 */
const cloneSecondCase = (): CaseDefinition => {
    const definition = structuredClone(validYoungCase) as unknown as Record<string, unknown>;
    definition.id = 'morley-drift-bench';

    // A rotating bench with one temperature control: a genuinely different apparatus, and one of the
    // two IDs is a *single* control so the `.min(1)` end of the range is exercised too.
    (definition.apparatus as { primaryControls: unknown }).primaryControls = [
        { id: 'rotationDeg', label: { en: 'Bench rotation', fr: 'Rotation du banc' }, unit: '°', min: 0, max: 90, step: 15, defaultValue: 45 },
        { id: 'bathTempC', label: { en: 'Bath temperature', fr: 'Température du bain' }, unit: '°C', min: 10, max: 30, step: 2, defaultValue: 20 }
    ];

    // No wavelength, and no wavelength comparison: this apparatus has neither.
    const experiment = definition.experiment as Record<string, unknown>;
    delete experiment.wavelengthNm;
    delete experiment.wavelengthComparison;
    experiment.modelVersion = 'morley-drift-v1';

    definition.requirements = { minimumRuns: 3, minimumSources: 2, minimumSignificantRuns: 2 };
    definition.flow = { ...(definition.flow as Record<string, unknown>), minimumExperimentCycles: 2, maximumExperimentCycles: 6 };
    definition.significanceRule = { criticalControlIds: ['rotationDeg', 'bathTempC'] };

    // Every predicate that names a control names one of *this* case's controls. Before Story 3.1 these
    // were `z.enum(['slitSpacingMm', 'screenDistanceM'])` and each of them made this fixture unparseable.
    (definition.consultationRules as Array<{ predicate: { kind: string; controlId?: string } }>)
        .filter(({ predicate }) => predicate.kind === 'alternative-test')
        .forEach(({ predicate }) => { predicate.controlId = 'bathTempC'; });
    (definition.conclusionProposals as Array<{ supportPredicate: unknown }>).forEach((proposal) => {
        proposal.supportPredicate = renameControls(proposal.supportPredicate);
    });

    return definition as unknown as CaseDefinition;
};

/** Rewrites every `varied-control` leaf to one authored ID, at every depth. */
const replaceControlId = (predicate: unknown, controlId: string): unknown => {
    const node = predicate as { kind: string; predicates?: unknown[] };
    if (node.kind === 'all-of') {
        return { ...node, predicates: (node.predicates ?? []).map((child) => replaceControlId(child, controlId)) };
    }
    return node.kind === 'varied-control' ? { ...node, controlId } : node;
};

/** Rewrites Young's control IDs to the second case's, at every depth of an authored support predicate. */
const renameControls = (predicate: unknown): unknown => {
    const node = predicate as { kind: string; controlId?: string; predicates?: unknown[] };
    if (node.kind === 'all-of') {
        return { ...node, predicates: (node.predicates ?? []).map(renameControls) };
    }
    if (node.kind === 'varied-control') {
        return { ...node, controlId: node.controlId === 'slitSpacingMm' ? 'rotationDeg' : 'bathTempC' };
    }
    return node;
};

/**
 * The valid case with `dialogueBeats` attached to the `prediction` scene (index 1), as a loose record
 * so a test can author a deliberately invalid beat without fighting the type.
 */
const withBeats = (beats: readonly unknown[]): Record<string, unknown> => {
    const definition = cloneValidCase() as unknown as Record<string, unknown>;
    ((definition.scenarioScript as { scenes: Array<Record<string, unknown>> }).scenes[1]).dialogueBeats = beats;
    return definition;
};


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
        // Story 3.1 replaced `z.literal('young-interference')` with a kebab-case rule, so a *different*
        // case ID is no longer a rejection — that is AC3, asserted positively in `describe('a second
        // case')` below. What still has to be rejected is an ID that could not be a directory name
        // under `public/cases/`, because a case whose assets cannot be addressed is unloadable content.
        ['a case ID that is not kebab-case', (definition: Record<string, unknown>) => { definition.id = 'Young Interference'; }],
        ['a case ID with an underscore', (definition: Record<string, unknown>) => { definition.id = 'young_interference'; }],
        ['a case ID with a leading hyphen', (definition: Record<string, unknown>) => { definition.id = '-young-interference'; }],
        ['a case ID with a path segment', (definition: Record<string, unknown>) => { definition.id = 'cases/young-interference'; }],
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
        ['blank source relationship', (definition: Record<string, unknown>) => { ((definition.contextualArtifacts as Array<{ caseRelationship: { en: string } }>)[0]).caseRelationship.en = ''; }],
        ['duplicate source ID', (definition: Record<string, unknown>) => { ((definition.contextualArtifacts as Array<{ id: string }>)[1]).id = 'young-lecture-1801'; }],
        ['unknown source field', (definition: Record<string, unknown>) => { (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].unreviewedClaim = true; }],
        ['unknown top-level field', (definition: Record<string, unknown>) => { definition.laterCaseField = true; }]
    ])('rejects %s', (_description, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it.each([
        ['duplicate consultation ID', (definition: Record<string, unknown>) => { ((definition.consultationRules as Array<{ id: string }>)[1]).id = 'missing-run'; }],
        ['unsupported consultation predicate', (definition: Record<string, unknown>) => { ((definition.consultationRules as Array<{ predicate: { kind: string } }>)[0]).predicate.kind = 'answer'; }],
        ['missing progressive layer', (definition: Record<string, unknown>) => { delete ((definition.consultationRules as Array<{ layers: { technicalDetail?: string } }>)[0]).layers.technicalDetail; }],
        ['missing source ID from a missing-source predicate', (definition: Record<string, unknown>) => { delete ((definition.consultationRules as Array<{ predicate: { sourceId?: string } }>)[1]).predicate.sourceId; }],
        ['missing control ID from an alternative-test predicate', (definition: Record<string, unknown>) => { delete ((definition.consultationRules as Array<{ predicate: { controlId?: string } }>)[2]).predicate.controlId; }],
        ['unknown consultation source', (definition: Record<string, unknown>) => { ((definition.consultationRules as Array<{ predicate: { sourceId?: string } }>)[1]).predicate.sourceId = 'unknown'; }],
        ['phase path in authored English help', (definition: Record<string, unknown>) => { ((definition.consultationRules as Array<{ nextStep: LocalizedText }>)[0]).nextStep = { en: 'Move to review phase.', fr: 'Passez à la relecture.' }; }],
        ['arrow path in authored French help', (definition: Record<string, unknown>) => { ((definition.consultationRules as Array<{ nextStep: LocalizedText }>)[0]).nextStep = { en: 'Record an observation.', fr: 'Carnet -> tableau de théorie.' }; }],
        ['arrow path in French peer-review copy', (definition: Record<string, unknown>) => { ((definition.peerReviewRules as Array<{ revisionPath: LocalizedText }>)[0]).revisionPath = { en: 'Select evidence.', fr: 'Preuves → conclusion.' }; }]
    ])('rejects %s', (_description, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);
        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it('accepts a scenario script that maps every case phase to an authored scene', () => {
        const definition = cloneValidCase();

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        // Asserted on the parse output, not the input fixture: reading `definition` back would pass
        // even if the schema stripped or defaulted `scenarioScript` entirely.
        expect(parsed.data.scenarioScript.scenes.map(({ phase }) => phase).sort())
            .toEqual([...CASE_PHASES].sort());
    });

    it('names the coverage rule when a phase is missing rather than reporting a length failure', () => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        const script = definition.scenarioScript as { scenes: Array<{ phase: string }> };
        script.scenes = script.scenes.filter(({ phase }) => phase !== 'synthesis');

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message))
            .toContain('The scenario script must map every case phase exactly once.');
    });

    it('accepts authored dialogue beats on a scenario scene and preserves their prose', () => {
        const definition = withBeats([
            { id: 'intro', speakerId: 'thea-young', text: bilingual('Two openings, one lamp, and a disagreement worth settling.') },
            { id: 'caution', speakerId: 'marianne-cole', text: bilingual('Say what you expect before we light it, and we can tell whether we were right.') }
        ]);

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        // Asserted on the parse output, not the fixture: reading the input back would pass even if
        // the schema stripped `dialogueBeats` or its `text` entirely.
        expect(parsed.data.scenarioScript.scenes[1].dialogueBeats?.map(({ id, speakerId, text }) => [id, speakerId, text.en]))
            .toEqual([
                ['intro', 'thea-young', 'Two openings, one lamp, and a disagreement worth settling.'],
                ['caution', 'marianne-cole', 'Say what you expect before we light it, and we can tell whether we were right.']
            ]);
    });

    it('accepts the same beat ID reused in a different scene', () => {
        const definition = withBeats([{ id: 'intro', speakerId: 'thea-young', text: bilingual('An opening line.') }]);
        (definition.scenarioScript as { scenes: Array<Record<string, unknown>> }).scenes[3].dialogueBeats =
            [{ id: 'intro', speakerId: 'samuel-hart', text: bilingual('Another opening line.') }];

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    // Each rule asserted by its authored message rather than a bare `success: false`: these mutations
    // sit next to one another, and a boolean could neither say which rule fired nor fail if the rule
    // under test were deleted.
    it.each([
        [
            'a beat spoken by nobody in the cast',
            'Every dialogue beat must be spoken by an authored colleague.',
            [{ id: 'intro', speakerId: 'arthur-bell', text: bilingual('A line from outside the cast.') }]
        ],
        [
            'two beats sharing an ID within one scene',
            'Dialogue beat IDs must be unique within a scene.',
            [
                { id: 'intro', speakerId: 'thea-young', text: bilingual('A first line.') },
                { id: 'intro', speakerId: 'elias-wren', text: bilingual('A second line reusing the id.') }
            ]
        ],
        [
            'an English phase path in a beat',
            'Authored dialogue copy must not encode a scene, route, or phase path.',
            [{ id: 'intro', speakerId: 'thea-young', text: { en: 'Move to the experiment phase.', fr: 'Allumons la lampe.' } }]
        ],
        [
            'a French route encoded in words in a beat',
            'Authored dialogue copy must not encode a scene, route, or phase path.',
            [{ id: 'intro', speakerId: 'thea-young', text: { en: 'Let us light the lamp.', fr: 'Ouvrez la scène du laboratoire.' } }]
        ],
        [
            'an arrow encoding a path in a beat',
            'Authored dialogue copy must not encode a scene, route, or phase path.',
            [{ id: 'intro', speakerId: 'thea-young', text: { en: 'Prediction -> result.', fr: 'Prédiction, puis résultat.' } }]
        ]
    ])('rejects %s', (_description, expectedMessage, beats) => {
        const parsed = CaseDefinitionSchema.safeParse(withBeats(beats));

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message)).toContain(expectedMessage);
    });

    /**
     * An empty `dialogueBeats` array is accepted, and it is accepted **so that the cross-field messages
     * stay reachable**. As a `.min(1)` base-parse failure it reported a generic `too_small` and — because
     * Zod skips `superRefine` once the base parse fails — silenced every authored-content rule in the
     * definition at the same time, including the ones with nothing to do with beats (1.12 review). An
     * author fixing "no conversation yet" the natural way lost every other message they needed.
     */
    it('accepts an empty dialogue beat list, which means the same as authoring none', () => {
        const parsed = CaseDefinitionSchema.safeParse(withBeats([]));

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.scenarioScript.scenes[1].dialogueBeats).toEqual([]);
    });

    it('still reports the authored cross-field message when another scene authors an empty beat list', () => {
        const definition = withBeats([{ id: 'intro', speakerId: 'arthur-bell', text: bilingual('A line from outside the cast.') }]);
        // The empty list must not intercept the real defect above it. This is the exact shape that used
        // to collapse into a bare `too_small` naming neither problem.
        (definition.scenarioScript as { scenes: Array<Record<string, unknown>> }).scenes[3].dialogueBeats = [];

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message))
            .toContain('Every dialogue beat must be spoken by an authored colleague.');
    });

    it.each([
        ['a missing French translation', (beat: Record<string, unknown>) => { delete (beat.text as Record<string, unknown>).fr; }],
        ['a blank French translation', (beat: Record<string, unknown>) => { (beat.text as Record<string, string>).fr = '   '; }],
        ['a missing speaker', (beat: Record<string, unknown>) => { delete beat.speakerId; }],
        ['a beat still carrying the retired textKey shape', (beat: Record<string, unknown>) => { delete beat.text; beat.textKey = 'young.prediction.intro'; }],
        ['an unknown beat field', (beat: Record<string, unknown>) => { beat.portrait = 'thea'; }]
    ])('rejects a dialogue beat with %s', (_description, mutate) => {
        const beat: Record<string, unknown> = { id: 'intro', speakerId: 'thea-young', text: bilingual('An opening line.') };
        mutate(beat);

        expect(CaseDefinitionSchema.safeParse(withBeats([beat]))).toMatchObject({ success: false });
    });

    it.each([
        ['a missing scenario script', (definition: Record<string, unknown>) => { delete definition.scenarioScript; }],
        ['a scenario script that skips a phase', (definition: Record<string, unknown>) => {
            const script = definition.scenarioScript as { scenes: Array<{ phase: string }> };
            script.scenes = script.scenes.filter(({ phase }) => phase !== 'synthesis');
        }],
        ['a scenario script that maps a phase twice', (definition: Record<string, unknown>) => {
            const script = definition.scenarioScript as { scenes: Array<{ phase: string; sceneKey: string }> };
            script.scenes.push({ phase: 'debrief', sceneKey: 'Library' });
        }],
        ['an unknown scene key', (definition: Record<string, unknown>) => {
            ((definition.scenarioScript as { scenes: Array<{ sceneKey: string }> }).scenes[0]).sceneKey = 'RivalLab';
        }],
        ['an unknown case phase', (definition: Record<string, unknown>) => {
            ((definition.scenarioScript as { scenes: Array<{ phase: string }> }).scenes[0]).phase = 'onboarding';
        }],
        ['an unknown scenario scene field', (definition: Record<string, unknown>) => {
            ((definition.scenarioScript as { scenes: Array<Record<string, unknown>> }).scenes[0]).transition = 'fade';
        }],
        ['an empty scenario script', (definition: Record<string, unknown>) => { (definition.scenarioScript as { scenes: unknown[] }).scenes = []; }]
    ])('rejects %s', (_description, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    // --- Colleague cast and proposals (Story 1.11) ----------------------------------------------

    it('parses the authored cast and both proposal sets', () => {
        const parsed = CaseDefinitionSchema.safeParse(validYoungCase);

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        // Asserted on the parse output, not the fixture: reading the input back would pass even if
        // the schema stripped the three new fields entirely.
        expect(parsed.data.colleagues.map(({ id }) => id))
            .toEqual(['thea-young', 'elias-wren', 'marianne-cole', 'samuel-hart']);
        expect(parsed.data.predictionProposals).toHaveLength(4);
        expect(parsed.data.conclusionProposals).toHaveLength(4);
        expect(parsed.data.conclusionProposals[0].supportPredicate).toMatchObject({ kind: 'all-of' });
    });

    /**
     * The figure block is **additive**: this fixture is the cast as it stood before the vocabulary
     * existed, and it still validates. That is what lets a case ship without one and get four people
     * who differ anyway, from their roles alone.
     */
    it('accepts a silhouette portrait that authors no figure at all', () => {
        const parsed = CaseDefinitionSchema.safeParse(validYoungCase);

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.colleagues[0].portrait).toMatchObject({ kind: 'silhouette' });
    });

    it('parses an authored figure through to the output rather than stripping it', () => {
        const definition = cloneValidCase();
        definition.colleagues = definition.colleagues.map((colleague, index) => index === 0
            ? {
                ...colleague,
                portrait: { kind: 'silhouette', accentColor: '#c9a227', figure: { build: 'gowned', pose: 'raising-instrument', hair: 'upswept' } }
            }
            : colleague);

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        // Read off the parse output, not the fixture: a schema that dropped `figure` would pass an
        // assertion made against the input and ship four identical silhouettes.
        expect(parsed.data.colleagues[0].portrait).toMatchObject({
            kind: 'silhouette',
            figure: { build: 'gowned', pose: 'raising-instrument', hair: 'upswept' }
        });
    });

    it('accepts an image portrait with its vector fallback and a separate rival portrait asset', () => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        ((definition.colleagues as Array<{ portrait: unknown }>)[0]).portrait = {
            kind: 'asset',
            assetId: 'thea-young-portrait',
            accentColor: '#c9a227',
            figure: { build: 'gowned', pose: 'raising-instrument', hair: 'upswept' }
        };
        (definition.rivalLab as Record<string, unknown>).portraitAssetId = 'arthur-bell-portrait';

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.colleagues[0].portrait).toMatchObject({
            kind: 'asset', assetId: 'thea-young-portrait', accentColor: '#c9a227', figure: { pose: 'raising-instrument' }
        });
        expect(parsed.data.rivalLab).toMatchObject({ portraitAssetId: 'arthur-bell-portrait', accentColor: '#8c3b3b' });
    });

    it('accepts an asset portrait without a vector fallback for legacy authored data', () => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        ((definition.colleagues as Array<{ portrait: unknown }>)[0]).portrait = { kind: 'asset', assetId: 'thea-young-portrait' };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    it.each(['audio', 'document'])('rejects a colleague portrait that references a %s asset', (type) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        const asset = (definition.assets as { entries: Array<{ id: string; type: string }> }).entries
            .find(({ id }) => id === 'thea-young-portrait');
        if (asset) asset.type = type;
        ((definition.colleagues as Array<{ portrait: unknown }>)[0]).portrait = { kind: 'asset', assetId: 'thea-young-portrait' };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it.each(['audio', 'document'])('rejects a rival portrait that references a %s asset', (type) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        const asset = (definition.assets as { entries: Array<{ id: string; type: string }> }).entries
            .find(({ id }) => id === 'arthur-bell-portrait');
        if (asset) asset.type = type;
        (definition.rivalLab as Record<string, unknown>).portraitAssetId = 'arthur-bell-portrait';

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    // This catches removal of the rival-specific manifest lookup; unlike a colleague portrait,
    // Arthur is not in `colleagues[]`, so the cast loop cannot protect this reference.
    it('rejects a rival portrait that is missing from the authored manifest', () => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        (definition.rivalLab as Record<string, unknown>).portraitAssetId = 'missing-rival-portrait';

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it('accepts a nested all-of predicate within the bounded depth', () => {
        const definition = cloneValidCase();
        definition.conclusionProposals = definition.conclusionProposals.map((proposal, index) => index === 0
            ? {
                ...proposal,
                supportPredicate: {
                    kind: 'all-of',
                    predicates: [
                        { kind: 'minimum-runs', count: 2 },
                        { kind: 'all-of', predicates: [{ kind: 'inspected-source', sourceId: 'young-lecture-1801' }] }
                    ]
                }
            }
            : proposal);

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    it.each([
        ['no colleagues at all', (definition: Record<string, unknown>) => { definition.colleagues = []; }],
        ['three prediction proposals', (definition: Record<string, unknown>) => { (definition.predictionProposals as unknown[]).pop(); }],
        ['five prediction proposals', (definition: Record<string, unknown>) => {
            const proposals = definition.predictionProposals as Array<{ id: string }>;
            proposals.push({ ...proposals[0], id: 'p-5' });
        }],
        ['three conclusion proposals', (definition: Record<string, unknown>) => { (definition.conclusionProposals as unknown[]).pop(); }],
        ['an unknown colleague field', (definition: Record<string, unknown>) => { (definition.colleagues as Array<Record<string, unknown>>)[0].pronouns = 'she/her'; }],
        ['an unknown colleague role', (definition: Record<string, unknown>) => { (definition.colleagues as Array<{ role: string }>)[0].role = 'sceptic'; }],
        ['a non-hex silhouette accent', (definition: Record<string, unknown>) => { (definition.colleagues as Array<{ portrait: { accentColor: string } }>)[0].portrait.accentColor = 'gold'; }],
        // The figure vocabulary is closed on purpose: the room is lit warm and dark, and an authored
        // value outside these ramps is a person who does not sit in that light. A typo in a pose is
        // rejected at the content boundary rather than silently falling back to a default pose.
        ['an unknown figure pose', (definition: Record<string, unknown>) => {
            (definition.colleagues as Array<{ portrait: Record<string, unknown> }>)[0].portrait.figure = { pose: 'brooding' };
        }],
        ['a free-form figure hair colour', (definition: Record<string, unknown>) => {
            (definition.colleagues as Array<{ portrait: Record<string, unknown> }>)[0].portrait.figure = { hairColor: '#c9a227' };
        }],
        ['an unknown figure field', (definition: Record<string, unknown>) => {
            (definition.colleagues as Array<{ portrait: Record<string, unknown> }>)[0].portrait.figure = { hat: 'top' };
        }],
        ['an unknown support predicate kind', (definition: Record<string, unknown>) => { (definition.conclusionProposals as Array<{ supportPredicate: { kind: string } }>)[2].supportPredicate.kind = 'always'; }],
        ['a non-positive minimum-runs count', (definition: Record<string, unknown>) => {
            (definition.conclusionProposals as Array<{ supportPredicate: unknown }>)[2].supportPredicate = { kind: 'minimum-runs', count: 0 };
        }],
        ['an all-of nested deeper than the bounded depth', (definition: Record<string, unknown>) => {
            (definition.conclusionProposals as Array<{ supportPredicate: unknown }>)[2].supportPredicate = {
                kind: 'all-of',
                predicates: [{ kind: 'all-of', predicates: [{ kind: 'all-of', predicates: [{ kind: 'never' }] }] }]
            };
        }]
    ])('rejects %s', (_description, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    // Each cross-field rule is asserted by its authored message: several of these mutations would
    // also trip a neighbouring rule, and a bare `success: false` could not tell which rule fired —
    // nor fail if the rule under test were deleted.
    it.each([
        [
            'duplicate colleague IDs',
            'Colleague IDs must be stable and unique.',
            (definition: Record<string, unknown>) => { (definition.colleagues as Array<{ id: string }>)[1].id = 'thea-young'; }
        ],
        // --- Significant-measure gate and colleague hints (Story 2.6) ---------------------------
        [
            'a significance rule naming an unauthored control',
            'The significance rule may only name authored primary controls.',
            (definition: Record<string, unknown>) => {
                // Both authored controls become `slitSpacingMm`, so `screenDistanceM` is no longer
                // part of this case's apparatus even though the enum still admits the literal — the
                // same shape the `varied-control` case below uses, and the only way to reach the
                // cross-field rule rather than the field-level enum.
                (definition.apparatus as { primaryControls: Array<{ id: string }> }).primaryControls[1].id = 'slitSpacingMm';
                (definition.significanceRule as { criticalControlIds: string[] }).criticalControlIds = ['screenDistanceM'];
            }
        ],
        [
            'a significance rule naming the same control twice',
            'The significance rule must not name the same control twice.',
            (definition: Record<string, unknown>) => {
                (definition.significanceRule as { criticalControlIds: string[] }).criticalControlIds = ['slitSpacingMm', 'slitSpacingMm'];
            }
        ],
        [
            'duplicate colleague hint IDs',
            'Colleague hint IDs must be stable and unique.',
            (definition: Record<string, unknown>) => { (definition.colleagueHints as Array<{ id: string }>)[1].id = 'h-1'; }
        ],
        [
            'a hint attributed to nobody in the cast',
            'Every colleague hint must be attributed to an authored colleague.',
            // The rival lab specifically: he is deliberately not a member of `colleagues[]`, and a
            // helpful nudge in the challenger's voice would misread the whole design.
            (definition: Record<string, unknown>) => { (definition.colleagueHints as Array<{ colleagueId: string }>)[0].colleagueId = 'arthur-bell'; }
        ],
        [
            'a hint naming an unauthored control',
            'Colleague hints may only reference authored controls.',
            (definition: Record<string, unknown>) => {
                (definition.apparatus as { primaryControls: Array<{ id: string }> }).primaryControls[1].id = 'slitSpacingMm';
                (definition.colleagueHints as Array<{ predicate: unknown }>)[1].predicate = { kind: 'unvaried-control', controlId: 'screenDistanceM' };
            }
        ],
        [
            'a scene path encoded in a hint line',
            'Colleague hint copy must not encode a scene, route, or phase path.',
            (definition: Record<string, unknown>) => {
                (definition.colleagueHints as Array<{ line: LocalizedText }>)[0].line = { en: 'Go back to the laboratory scene.', fr: 'Reprenez une mesure.' };
            }
        ],
        [
            'a hint set with no catch-all floor',
            'Colleague hints must include a below-significant-measures hint, so the gate always has something to say.',
            // The floor that keeps the gate from refusing in silence. With only `unvaried-control`
            // hints authored, a player at zero runs is refused and told nothing — a dead end.
            (definition: Record<string, unknown>) => {
                (definition.colleagueHints as Array<{ predicate: unknown }>)
                    .forEach((hint) => { hint.predicate = { kind: 'unvaried-control', controlId: 'slitSpacingMm' }; });
            }
        ],
        [
            'a hint set whose only zero-run answer is no-recorded-runs',
            'Colleague hints must include a below-significant-measures hint, so the gate always has something to say.',
            // The review case (2026-08-06). `no-recorded-runs` *does* answer an empty notebook, so an
            // earlier version of this rule accepted it as the floor — but it holds only there. Record
            // one run and the gate refuses with nothing to say, which is the dead end the rule exists
            // to prevent, reached through the rule itself.
            (definition: Record<string, unknown>) => {
                (definition.colleagueHints as Array<{ predicate: unknown }>)
                    .forEach((hint) => { hint.predicate = { kind: 'no-recorded-runs' }; });
            }
        ],
        [
            'a catch-all floor authored before the hints it would shadow',
            'The below-significant-measures hint must be the last authored hint, or it shadows every hint after it.',
            // Selection is first-match and this predicate is unconditionally true, so anywhere but
            // last it silently collapses the escalation ladder to one generic line and turns every
            // hint after it into unreachable content.
            (definition: Record<string, unknown>) => {
                const hints = definition.colleagueHints as unknown[];
                hints.reverse();
            }
        ],
        [
            'a hint asking the player to vary a control the significance rule ignores',
            'A colleague hint may only ask the player to vary a control the significance rule treats as critical.',
            // The advice cannot work: the player varies exactly what they were told to, the
            // configuration key never moves, and the gate refuses again with the same line.
            (definition: Record<string, unknown>) => {
                (definition.significanceRule as { criticalControlIds: string[] }).criticalControlIds = ['slitSpacingMm'];
                (definition.colleagueHints as Array<{ predicate: unknown }>)[0].predicate = { kind: 'unvaried-control', controlId: 'screenDistanceM' };
            }
        ],
        [
            'duplicate reading-gate line IDs',
            'Reading-gate line IDs must be stable and unique.',
            (definition: Record<string, unknown>) => { (definition.readingGateHints as Array<{ id: string }>)[1].id = 'r-1'; }
        ],
        [
            'a reading-gate line attributed to nobody in the cast',
            'Every reading-gate line must be attributed to an authored colleague.',
            // The rival lab specifically, for the same reason the colleague-hint case names him: he is
            // deliberately not a member of `colleagues[]`, and a helpful nudge in the challenger's
            // voice would misread the whole design.
            (definition: Record<string, unknown>) => { (definition.readingGateHints as Array<{ colleagueId: string }>)[0].colleagueId = 'arthur-bell'; }
        ],
        [
            'a reading-gate line naming an unauthored artifact',
            'A reading-gate line may only name an authored contextual artifact.',
            // Unreachable content: the predicate is matched against `missingArtifactIds`, drawn from
            // `contextualArtifacts`, so a line naming anything else can never be shown to a player.
            (definition: Record<string, unknown>) => {
                (definition.readingGateHints as Array<{ predicate: unknown }>)[0].predicate =
                    { kind: 'missing-artifact', artifactId: 'an-artifact-this-case-does-not-carry' };
            }
        ],
        [
            'a scene path encoded in a reading-gate line',
            'Reading-gate copy must not encode a scene, route, or phase path.',
            (definition: Record<string, unknown>) => {
                (definition.readingGateHints as Array<{ line: LocalizedText }>)[0].line =
                    { en: 'Go back to the library scene.', fr: 'Reprenez votre lecture.' };
            }
        ],
        [
            'a reading-gate set with no catch-all floor',
            'Reading-gate lines must include an any-missing-reading line, so the gate always has something to say.',
            // The floor that keeps this gate from refusing in silence. With only artifact-specific
            // lines authored, a case that later adds a third artifact and forgets its line refuses
            // with nothing to say — the dead end the rule exists to prevent.
            (definition: Record<string, unknown>) => {
                (definition.readingGateHints as Array<{ predicate: unknown }>)
                    .forEach((hint) => { hint.predicate = { kind: 'missing-artifact', artifactId: 'young-lecture-1801' }; });
            }
        ],
        [
            'a catch-all floor authored before the lines it would shadow',
            'The any-missing-reading line must be the last authored line, or it shadows every line after it.',
            // Selection is first-match and this predicate is unconditionally true, so anywhere but
            // last it collapses the escalation ladder to one generic line and turns every line after
            // it into unreachable content. Authoring two floors is caught here too, because the
            // earlier of them cannot be last.
            (definition: Record<string, unknown>) => {
                const hints = definition.readingGateHints as unknown[];
                hints.reverse();
            }
        ],
        [
            'a significance rule naming no critical control at all',
            'Too small: expected array to have >=1 items',
            (definition: Record<string, unknown>) => {
                (definition.significanceRule as { criticalControlIds: string[] }).criticalControlIds = [];
            }
        ],
        [
            'a significance rule naming the same model input twice',
            'The significance rule must not name the same model input twice.',
            (definition: Record<string, unknown>) => {
                (definition.significanceRule as { criticalModelInputIds: string[] }).criticalModelInputIds = ['wavelengthNm', 'wavelengthNm'];
            }
        ],
        [
            'duplicate prediction proposal IDs',
            'Proposal IDs must be unique within each proposal set.',
            (definition: Record<string, unknown>) => { (definition.predictionProposals as Array<{ id: string }>)[1].id = 'p-1'; }
        ],
        [
            'duplicate conclusion proposal IDs',
            'Proposal IDs must be unique within each proposal set.',
            (definition: Record<string, unknown>) => { (definition.conclusionProposals as Array<{ id: string }>)[1].id = 'c-1'; }
        ],
        [
            'a prediction proposal attributed to nobody in the cast',
            'Every proposal must be attributed to an authored colleague.',
            (definition: Record<string, unknown>) => { (definition.predictionProposals as Array<{ colleagueId: string }>)[0].colleagueId = 'arthur-bell'; }
        ],
        [
            'a conclusion proposal attributed to nobody in the cast',
            'Every proposal must be attributed to an authored colleague.',
            (definition: Record<string, unknown>) => { (definition.conclusionProposals as Array<{ colleagueId: string }>)[0].colleagueId = 'arthur-bell'; }
        ],
        [
            'a portrait naming an asset outside the manifest',
            'A colleague asset portrait must name an authored asset.',
            (definition: Record<string, unknown>) => {
                (definition.colleagues as Array<{ portrait: unknown }>)[0].portrait = { kind: 'asset', assetId: 'thea-portrait' };
            }
        ],
        [
            'an inspected-source predicate naming an unauthored source',
            'Conclusion proposals may only reference authored sources.',
            (definition: Record<string, unknown>) => {
                (definition.conclusionProposals as Array<{ supportPredicate: unknown }>)[2].supportPredicate = { kind: 'inspected-source', sourceId: 'huygens-treatise' };
            }
        ],
        [
            'a varied-control predicate naming an unauthored control',
            'Conclusion proposals may only reference authored controls.',
            (definition: Record<string, unknown>) => {
                // Both authored controls become `slitSpacingMm`, so `screenDistanceM` is no longer
                // part of this case's apparatus even though the enum still admits the literal.
                (definition.apparatus as { primaryControls: Array<{ id: string }> }).primaryControls[1].id = 'slitSpacingMm';
                (definition.conclusionProposals as Array<{ supportPredicate: unknown }>)[2].supportPredicate = { kind: 'varied-control', controlId: 'screenDistanceM' };
            }
        ],
        [
            'an empty all-of, which would be vacuously true',
            'An all-of support predicate needs at least one child predicate.',
            (definition: Record<string, unknown>) => {
                (definition.conclusionProposals as Array<{ supportPredicate: unknown }>)[2].supportPredicate = { kind: 'all-of', predicates: [] };
            }
        ],
        [
            'a conclusion set in which no proposal can ever be defensible',
            'At least one conclusion proposal must be defensible on some evidence.',
            (definition: Record<string, unknown>) => {
                (definition.conclusionProposals as Array<{ supportPredicate: unknown }>)
                    .forEach((proposal) => { proposal.supportPredicate = { kind: 'never' }; });
            }
        ],
        [
            'a phase path encoded in a prediction proposal',
            'Authored proposal copy must not encode a scene, route, or phase path.',
            (definition: Record<string, unknown>) => {
                (definition.predictionProposals as Array<{ text: LocalizedText }>)[0].text = { en: 'Move to the experiment phase and see.', fr: 'Voyons ce que montre l’appareil.' };
            }
        ],
        [
            'an arrow path encoded in a conclusion claim',
            'Authored proposal copy must not encode a scene, route, or phase path.',
            (definition: Record<string, unknown>) => {
                (definition.conclusionProposals as Array<{ claim: LocalizedText }>)[0].claim = { en: 'Bands widen.', fr: 'Preuves → conclusion.' };
            }
        ],
        [
            'a route encoded in a conclusion limitation',
            'Authored proposal copy must not encode a scene, route, or phase path.',
            (definition: Record<string, unknown>) => {
                (definition.conclusionProposals as Array<{ limitation: LocalizedText }>)[0].limitation = { en: 'One apparatus only.', fr: 'Ouvrez la scène du laboratoire pour vérifier.' };
            }
        ],
        // --- FR7's exact Young bounds (Story 3.1) -----------------------------------------------
        //
        // Nothing pinned these two messages before this story, and Story 3.1 moves the check that
        // raises them from the shared shape into a branch scoped to `id === 'young-interference'`.
        // A branch that never runs would delete FR7's enforcement in silence, so each bound is
        // mutated on its own here: three per control, because a check that only looked at `min`
        // would still pass a test that only moved `min`.
        ...(['min', 'max', 'step'] as const).flatMap((field) => ([
            [
                `Young's slit spacing with a wrong ${field}`,
                'Young slit spacing must be 0.10–0.50 mm in 0.05 mm steps.',
                (definition: Record<string, unknown>) => {
                    const controls = (definition.apparatus as { primaryControls: Array<Record<string, number>> }).primaryControls;
                    // 0.1 keeps `defaultValue` in range and on step for every one of the three, so the
                    // failure that fires is the Young bound and not `PrimaryControlSchema`'s own rules.
                    controls[0][field] = controls[0][field] + 0.1;
                }
            ],
            [
                `Young's screen distance with a wrong ${field}`,
                'Young screen distance must be 1.0–4.0 m in 0.25 m steps.',
                (definition: Record<string, unknown>) => {
                    const controls = (definition.apparatus as { primaryControls: Array<Record<string, number>> }).primaryControls;
                    controls[1][field] = controls[1][field] + 1;
                }
            ]
        ] as Array<[string, string, (definition: Record<string, unknown>) => void]>))
    ])('rejects %s', (_description, expectedMessage, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message)).toContain(expectedMessage);
    });

    it.each([
        ['a prediction proposal text', (definition: Record<string, unknown>) => { delete (definition.predictionProposals as Array<{ text: Record<string, unknown> }>)[0].text.fr; }],
        ['a conclusion claim', (definition: Record<string, unknown>) => { delete (definition.conclusionProposals as Array<{ claim: Record<string, unknown> }>)[0].claim.fr; }],
        ['a conclusion limitation', (definition: Record<string, unknown>) => { delete (definition.conclusionProposals as Array<{ limitation: Record<string, unknown> }>)[0].limitation.fr; }]
    ])('rejects a case missing the French locale on %s', (_description, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it('accepts a reviewed, locale-tagged local rendition and preserves its stable section IDs', () => {
        const definition = cloneValidCase();
        definition.contextualArtifacts[0] = { ...definition.contextualArtifacts[0], textualRendition: localLectureRendition() };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    it('accepts an authored one-page summary on a reviewed rendition', () => {
        const definition = cloneValidCase();
        definition.contextualArtifacts[0] = {
            ...definition.contextualArtifacts[0],
            textualRendition: { ...localLectureRendition(), summary: bilingualList(['A concise overview.', 'A second paragraph.']) }
        };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    // AC3: Zod rejects a case missing a required locale before any domain logic runs.
    it.each([
        ['the opening dispute', (definition: Record<string, unknown>) => { delete (definition.openingDispute as Record<string, unknown>).fr; }],
        ['a source display name', (definition: Record<string, unknown>) => { delete ((definition.contextualArtifacts as Array<{ displayName: Record<string, unknown> }>)[0]).displayName.fr; }],
        ['a source case relationship', (definition: Record<string, unknown>) => { delete ((definition.contextualArtifacts as Array<{ caseRelationship: Record<string, unknown> }>)[0]).caseRelationship.fr; }],
        ['a control label', (definition: Record<string, unknown>) => { delete ((definition.apparatus as { primaryControls: Array<{ label: Record<string, unknown> }> }).primaryControls[0]).label.fr; }],
        ['the experiment assumptions', (definition: Record<string, unknown>) => { delete (definition.experiment as { assumptions: Record<string, unknown> }).assumptions.fr; }],
        ['the confound description', (definition: Record<string, unknown>) => { delete ((definition.experiment as { confound: { description: Record<string, unknown> } }).confound).description.fr; }],
        ['a consultation help layer', (definition: Record<string, unknown>) => { delete ((definition.consultationRules as Array<{ layers: { plainLanguage: Record<string, unknown> } }>)[0]).layers.plainLanguage.fr; }],
        ['a consultation next step', (definition: Record<string, unknown>) => { delete ((definition.consultationRules as Array<{ nextStep: Record<string, unknown> }>)[0]).nextStep.fr; }],
        ['peer-review feedback', (definition: Record<string, unknown>) => { delete ((definition.peerReviewRules as Array<{ feedback: Record<string, unknown> }>)[0]).feedback.fr; }],
        ['the overreach detection phrases', (definition: Record<string, unknown>) => { delete ((definition.peerReviewRules as Array<{ predicate: { overreachPhrases: Record<string, unknown> } }>)[2]).predicate.overreachPhrases.fr; }],
        ['the debrief summary', (definition: Record<string, unknown>) => { delete (definition.debrief as { summary: Record<string, unknown> }).summary.fr; }],
        ['the replay label', (definition: Record<string, unknown>) => { delete (definition.debrief as { replayLabel: Record<string, unknown> }).replayLabel.fr; }],
        ['a rendition reader label', (definition: Record<string, unknown>) => {
            const rendition = localLectureRendition() as unknown as { readerLabel: Record<string, unknown> };
            delete rendition.readerLabel.fr;
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        ['a rendition reuse statement', (definition: Record<string, unknown>) => {
            const rendition = localLectureRendition() as unknown as { citation: { reuseStatement: Record<string, unknown> } };
            delete rendition.citation.reuseStatement.fr;
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        // AC4 names this check by hand: "Zod rejects a hint missing either locale at the content
        // boundary". Both directions, because a surface shipped English-only is the project's
        // most-repeated defect and the French-only case is the one nobody thinks to try.
        ['a colleague hint line', (definition: Record<string, unknown>) => { delete (definition.colleagueHints as Array<{ line: Record<string, unknown> }>)[0].line.fr; }],
        ['a colleague hint line missing its English', (definition: Record<string, unknown>) => { delete (definition.colleagueHints as Array<{ line: Record<string, unknown> }>)[1].line.en; }],
        // Story 2.8's AC8 asks the same of the reading-gate lines, and for the same reason: they are a
        // new player-facing content surface, and a content surface shipped in one language is the
        // defect this project repeats most often.
        ['a reading-gate line', (definition: Record<string, unknown>) => { delete (definition.readingGateHints as Array<{ line: Record<string, unknown> }>)[0].line.fr; }],
        ['a reading-gate line missing its English', (definition: Record<string, unknown>) => { delete (definition.readingGateHints as Array<{ line: Record<string, unknown> }>)[1].line.en; }]
    ])('rejects a case missing the French locale on %s', (_description, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it.each([
        ['blank', ''],
        ['whitespace-only', '   ']
    ])('rejects a %s French translation', (_description, french) => {
        const definition = cloneValidCase();
        definition.contextualArtifacts[0] = { ...definition.contextualArtifacts[0], displayName: { en: 'Lecture record', fr: french } };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it('rejects a localized list whose locales hold different numbers of entries', () => {
        const definition = cloneValidCase() as unknown as { experiment: { assumptions: { fr: string[] } } };
        definition.experiment.assumptions.fr = ['Une seule hypothèse.'];

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message))
            .toContain('A localized list must provide the same number of entries in every locale.');
    });

    // `route` and `phase` are ordinary French words: applying the English word list to French copy
    // would produce only false positives and pressure to mangle the translation.
    it('accepts legitimate French copy containing “route” and “phase”', () => {
        const definition = cloneValidCase();
        definition.consultationRules[0] = {
            ...definition.consultationRules[0],
            nextStep: { en: 'Record an observation.', fr: 'Notez la phase de l’onde en route vers l’écran.' }
        };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    // The other half of that trade: French is guarded at the phrase level instead, so a route
    // encoded in words does not ship just because the word list had to be dropped.
    it.each([
        ['ouvrez la scène', 'Ouvrez la scène du carnet pour comparer les mesures.'],
        ['passez à l’étape', 'Passez à l’étape de synthèse une fois les deux mesures notées.'],
        ['allez à la phase', 'Allez à la phase de révision pour demander un retour.']
    ])('rejects French help that encodes a route in words (%s)', (_label, frenchCopy) => {
        const definition = cloneValidCase();
        definition.consultationRules[0] = {
            ...definition.consultationRules[0],
            nextStep: { en: 'Record an observation.', fr: frenchCopy }
        };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it.each([
        ['en', '→'], ['en', '->'], ['en', '=>'], ['en', '⇒'], ['en', '⟶'],
        ['fr', '→'], ['fr', '->'], ['fr', '=>'], ['fr', '⇒'], ['fr', '⟶']
    ])('rejects an arrow encoding a path in %s (%s)', (locale, arrow) => {
        const definition = cloneValidCase();
        const nextStep = { en: 'Record an observation.', fr: 'Notez une observation.' };
        definition.consultationRules[0] = {
            ...definition.consultationRules[0],
            nextStep: { ...nextStep, [locale]: `${nextStep[locale as 'en' | 'fr']} ${arrow} suite` }
        };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    // Detection phrases are not display text: French inflects where English does not, so the two
    // lists are sized independently. This is the one localized list where that is allowed.
    it('accepts overreach detection lists of different lengths per locale', () => {
        const definition = cloneValidCase() as unknown as { peerReviewRules: Array<{ predicate: { overreachPhrases: { en: string[]; fr: string[] } } }> };
        definition.peerReviewRules[2].predicate.overreachPhrases = {
            en: ['proves'],
            fr: ['prouve', 'prouvent', 'prouvé']
        };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    it.each([
        ['unreviewed reader source', (definition: Record<string, unknown>) => {
            const source = (definition.contextualArtifacts as Array<Record<string, unknown>>)[0];
            source.rightsStatus = 'incomplete';
            source.textualRendition = localLectureRendition();
        }],
        /**
         * The converse rule, and the one that closes a soft-lock rather than a provenance claim
         * (Story 2.8 review).
         *
         * `isSourceEligibleForInspection` is `rightsStatus === 'reviewed'` alone, so context readiness
         * demands this artifact be inspected — while the reading room refuses to open an artifact with
         * nothing to read and therefore never dispatches `source.inspected` for it. Authored this way,
         * the case could never be finished: the gate stays shut forever and the colleague keeps naming
         * a reference the room has just said cannot be read. Rejecting it at load is what makes that
         * unauthorable.
         */
        ['a reviewed source with nothing to read', (definition: Record<string, unknown>) => {
            const source = (definition.contextualArtifacts as Array<Record<string, unknown>>)[0];
            source.rightsStatus = 'reviewed';
            delete source.textualRendition;
        }],
        ['duplicate stable section ID', (definition: Record<string, unknown>) => {
            const rendition = structuredClone(localLectureRendition()) as unknown as { renditions: Array<{ sections: Array<{ id: string; heading: string; paragraphs: string[]; sourcePages: number[] }> }> };
            rendition.renditions.forEach((entry) => entry.sections.push({ ...entry.sections[0] }));
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        ['a source with only one rendition', (definition: Record<string, unknown>) => {
            const rendition = structuredClone(localLectureRendition()) as unknown as { renditions: unknown[] };
            rendition.renditions.pop();
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        ['two renditions in the same language', (definition: Record<string, unknown>) => {
            const rendition = structuredClone(localLectureRendition()) as unknown as { renditions: Array<{ locale: string }> };
            rendition.renditions[1].locale = 'en';
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        // Two transcriptions of the same pages is a provenance claim nobody has reviewed.
        ['a translation presented as a second transcription', (definition: Record<string, unknown>) => {
            const rendition = structuredClone(localLectureRendition()) as unknown as { renditions: Array<{ kind: string }> };
            rendition.renditions[1].kind = 'transcription';
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        // `book.translatedRendition` names English as the original in both locales, so a French
        // transcription with an English translation would state the provenance backwards on the page.
        ['a French transcription of record', (definition: Record<string, unknown>) => {
            const rendition = structuredClone(localLectureRendition()) as unknown as { renditions: Array<{ kind: string }> };
            rendition.renditions[0].kind = 'translation';
            rendition.renditions[1].kind = 'transcription';
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        ['renditions that cover different source pages', (definition: Record<string, unknown>) => {
            const rendition = structuredClone(localLectureRendition()) as unknown as { renditions: Array<{ sections: Array<{ sourcePages: number[] }> }> };
            rendition.renditions[1].sections[0].sourcePages = [13];
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        ['a translation that drops a paragraph', (definition: Record<string, unknown>) => {
            const rendition = structuredClone(localLectureRendition()) as unknown as { renditions: Array<{ sections: Array<{ paragraphs: string[] }> }> };
            rendition.renditions[1].sections[0].paragraphs.push('Un paragraphe de trop.');
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        ['invalid reader archive URL', (definition: Record<string, unknown>) => {
            const rendition = localLectureRendition();
            rendition.citation.archiveUrl = 'http://example.test/archive';
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        ['unregistered rendition locale', (definition: Record<string, unknown>) => {
            const rendition = structuredClone(localLectureRendition()) as unknown as { renditions: Array<{ locale: string }> };
            rendition.renditions[0].locale = 'zz';
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        ['unknown rendition field', (definition: Record<string, unknown>) => {
            const rendition = localLectureRendition() as Record<string, unknown>;
            rendition.unreviewed = true;
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = rendition;
        }],
        ['empty reader summary', (definition: Record<string, unknown>) => {
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = { ...localLectureRendition(), summary: { en: [], fr: [] } };
        }],
        ['blank reader summary paragraph', (definition: Record<string, unknown>) => {
            (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].textualRendition = { ...localLectureRendition(), summary: bilingualList(['  ']) };
        }]
    ])('rejects %s', (_description, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);
        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    // --- Rival lab (Story 2.5) -------------------------------------------------------------------

    it('parses the authored rival lab and its critiques', () => {
        const parsed = CaseDefinitionSchema.safeParse(validYoungCase);

        expect(parsed).toMatchObject({
            success: true,
            data: { rivalLab: { name: 'Mr. Arthur Bell', accentColor: '#8c3b3b' } }
        });
    });

    /**
     * `RivalLab` is routable but not *authorable*: it is not a phase, so a scenario script must not be
     * able to map one to it. This is the same case as the `'an unknown scene key'` mutation above, kept
     * explicit — Story 2.5 widened the runtime registry (`ROUTABLE_SCENE_KEYS`) and deliberately left
     * `SCENE_KEYS`, the content vocabulary, exactly as it was.
     */
    it('still rejects RivalLab as an authored scene key', () => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        ((definition.scenarioScript as { scenes: Array<{ sceneKey: string }> }).scenes[3]).sceneKey = 'RivalLab';

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it.each([
        ['a missing rival lab', (definition: Record<string, unknown>) => { delete definition.rivalLab; }],
        ['an empty critique list', (definition: Record<string, unknown>) => {
            (definition.rivalLab as { critiques: unknown[] }).critiques = [];
        }],
        ['a critique answering an unauthored proposal', (definition: Record<string, unknown>) => {
            ((definition.rivalLab as { critiques: Array<{ proposalId: string }> }).critiques[0]).proposalId = 'c-99';
        }],
        ['a conclusion proposal with no critique', (definition: Record<string, unknown>) => {
            const rival = definition.rivalLab as { critiques: Array<{ proposalId: string }> };
            rival.critiques = rival.critiques.filter(({ proposalId }) => proposalId !== 'c-3');
        }],
        ['duplicate critique IDs', (definition: Record<string, unknown>) => {
            const critiques = (definition.rivalLab as { critiques: Array<{ id: string }> }).critiques;
            critiques[1].id = critiques[0].id;
        }],
        ['an English path encoded in a critique line', (definition: Record<string, unknown>) => {
            ((definition.rivalLab as { critiques: Array<{ line: LocalizedText }> }).critiques[0]).line =
                bilingual('Go back to the theory board scene and try again.');
        }],
        ['a French route encoded in words in a critique line', (definition: Record<string, unknown>) => {
            ((definition.rivalLab as { critiques: Array<{ line: LocalizedText }> }).critiques[0]).line =
                { en: 'Come back with another measurement.', fr: 'Retournez à la scène du tableau et recommencez.' };
        }],
        ['an arrow encoding a path in a critique line', (definition: Record<string, unknown>) => {
            ((definition.rivalLab as { critiques: Array<{ line: LocalizedText }> }).critiques[0]).line =
                bilingual('Board → bench → board again.');
        }],
        ['a critique line missing its French', (definition: Record<string, unknown>) => {
            ((definition.rivalLab as { critiques: Array<Record<string, unknown>> }).critiques[0]).line = { en: 'One locale only.' };
        }],
        ['an upper-case rival accent', (definition: Record<string, unknown>) => {
            (definition.rivalLab as { accentColor: string }).accentColor = '#8C3B3B';
        }],
        ['a three-digit rival accent', (definition: Record<string, unknown>) => {
            (definition.rivalLab as { accentColor: string }).accentColor = '#8b3';
        }],
        ['a blank rival name', (definition: Record<string, unknown>) => {
            (definition.rivalLab as { name: string }).name = '   ';
        }],
        ['an unknown rival lab field', (definition: Record<string, unknown>) => {
            (definition.rivalLab as Record<string, unknown>).colleagueId = 'arthur-bell';
        }],
        ['an unknown critique field', (definition: Record<string, unknown>) => {
            ((definition.rivalLab as { critiques: Array<Record<string, unknown>> }).critiques[0]).severity = 'high';
        }],
        // The body is deliberately unclamped in the renderer — truncating the objection is the one thing
        // that surface must not do — so an over-long line runs off a non-scrolling canvas at runtime.
        // Caught here instead, where the failure names the critique and an author can act on it.
        ['an over-long English critique line', (definition: Record<string, unknown>) => {
            ((definition.rivalLab as { critiques: Array<{ line: LocalizedText }> }).critiques[0]).line =
                bilingual(`He objects at length. ${'Again and again. '.repeat(50)}`);
        }],
        ['an over-long French critique line', (definition: Record<string, unknown>) => {
            ((definition.rivalLab as { critiques: Array<{ line: LocalizedText }> }).critiques[0]).line =
                { en: 'Come back with another measurement.', fr: `Il objecte longuement. ${'Encore et encore. '.repeat(50)}` };
        }]
    ])('rejects %s', (_description, mutate) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        mutate(definition);

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });
});

/**
 * AC3, AC4 and the rules Story 3.1 had to *add* because the shapes that used to hold them were relaxed.
 *
 * Every test here is against `cloneSecondCase`, where the `id === 'young-interference'` branch does not
 * run. That matters: three existing rejection tests in this file use a duplicate control ID as their
 * lever and pass only because Young's bounds refinement notices `screenDistanceM` has gone missing —
 * they never exercised uniqueness, and they would keep passing if the uniqueness rule were deleted.
 */
describe('a second case', () => {
    it('parses with no Young-specific field authored anywhere', () => {
        const parsed = CaseDefinitionSchema.safeParse(cloneSecondCase());

        // The whole point of the story: the failure list, not just the boolean, so a regression says which
        // field re-Younged the contract rather than only that something did.
        expect(parsed.success ? [] : parsed.error.issues.map(({ message, path }) => `${path.join('.')}: ${message}`)).toEqual([]);
    });

    it('carries its own control set, evidence floor and cycle range through to the parsed output', () => {
        const parsed = CaseDefinitionSchema.safeParse(cloneSecondCase());

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.apparatus.primaryControls.map(({ id }) => id)).toEqual(['rotationDeg', 'bathTempC']);
        expect(parsed.data.experiment.wavelengthNm).toBeUndefined();
        // Not 2: the requirement counts are floors now, and a second case may ask for more evidence.
        expect(parsed.data.requirements.minimumRuns).toBe(3);
        expect(parsed.data.flow.maximumExperimentCycles).toBe(6);
    });

    it('accepts a single authored control', () => {
        const definition = cloneSecondCase() as unknown as Record<string, unknown>;
        const controls = (definition.apparatus as { primaryControls: Array<{ id: string }> }).primaryControls;
        (definition.apparatus as { primaryControls: unknown }).primaryControls = [controls[0]];
        definition.significanceRule = { criticalControlIds: ['rotationDeg'] };
        (definition.consultationRules as Array<{ predicate: { kind: string; controlId?: string } }>)
            .filter(({ predicate }) => predicate.kind === 'alternative-test')
            .forEach(({ predicate }) => { predicate.controlId = 'rotationDeg'; });
        (definition.conclusionProposals as Array<{ supportPredicate: unknown }>).forEach((proposal) => {
            proposal.supportPredicate = replaceControlId(proposal.supportPredicate, 'rotationDeg');
        });

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    it.each([
        [
            'a duplicate control ID, which would silently halve the apparatus',
            'Primary control IDs must be stable and unique.',
            (definition: Record<string, unknown>) => {
                const controls = (definition.apparatus as { primaryControls: Array<{ id: string }> }).primaryControls;
                controls[1].id = controls[0].id;
            }
        ],
        [
            'a cycle range that runs backwards',
            'The minimum experiment cycle count must not exceed the maximum.',
            (definition: Record<string, unknown>) => {
                definition.flow = { ...(definition.flow as Record<string, unknown>), minimumExperimentCycles: 7, maximumExperimentCycles: 6 };
            }
        ],
        [
            'a significance rule naming a control this case does not author',
            'The significance rule may only name authored primary controls.',
            (definition: Record<string, unknown>) => {
                // Young's control ID specifically. Before Story 3.1 the field enum admitted it for every
                // case; now it is checked against the case's own apparatus, which is the stronger rule.
                definition.significanceRule = { criticalControlIds: ['slitSpacingMm'] };
            }
        ],
        [
            'a consultation rule naming a control this case does not author',
            'Consultation rules may only reference authored controls.',
            (definition: Record<string, unknown>) => {
                (definition.consultationRules as Array<{ predicate: { kind: string; controlId?: string } }>)
                    .filter(({ predicate }) => predicate.kind === 'alternative-test')
                    .forEach(({ predicate }) => { predicate.controlId = 'screenDistanceM'; });
            }
        ],
        [
            'a conclusion proposal naming a control this case does not author',
            'Conclusion proposals may only reference authored controls.',
            (definition: Record<string, unknown>) => {
                (definition.conclusionProposals as Array<{ supportPredicate: unknown }>)[1]
                    .supportPredicate = { kind: 'varied-control', controlId: 'slitSpacingMm' };
            }
        ]
    ])('rejects %s', (_description, expectedMessage, mutate) => {
        const definition = cloneSecondCase() as unknown as Record<string, unknown>;
        mutate(definition);

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message)).toContain(expectedMessage);
    });

    it('rejects a third control, which the bench would draw over the wavelength chooser', () => {
        const definition = cloneSecondCase() as unknown as Record<string, unknown>;
        const controls = (definition.apparatus as { primaryControls: Array<Record<string, unknown>> }).primaryControls;
        controls.push({ ...controls[0], id: 'tiltMrad' });

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        // The code and path rather than Zod's wording: the ceiling is a `.max()` on the field, so the
        // message is generated and would change under a Zod upgrade while the rule had not moved.
        expect(parsed.error.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'too_big', path: ['apparatus', 'primaryControls'] })
        ]));
    });

    // The negative pair AC3 asks for, in both directions: the case-scoped branch must fire on the ID and
    // only on the ID. Without the second half, a refinement that had quietly become unconditional would
    // still pass every test above.
    it('fails Young’s bounds refinement the moment it claims to be Young', () => {
        const definition = cloneSecondCase() as unknown as Record<string, unknown>;
        definition.id = 'young-interference';

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message)).toEqual(expect.arrayContaining([
            'Young slit spacing must be 0.10–0.50 mm in 0.05 mm steps.',
            'Young screen distance must be 1.0–4.0 m in 0.25 m steps.',
            'The Young case runs at a fixed 550 nm.',
            'The Young case requires exactly two runs, two sources, and two significant measurements.',
            'The Young case runs two to four experiment cycles.'
        ]));
    });

    it('holds Young to its own bounds when a foreign control ID appears in Young content', () => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        (definition.apparatus as { primaryControls: Array<{ id: string }> }).primaryControls[1].id = 'bathTempC';

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message)).toContain('Young screen distance must be 1.0–4.0 m in 0.25 m steps.');
    });

    // --- AC6: no authored content may leave the context gate unsatisfiable --------------------------
    //
    // `deferred-work.md:75`, assigned to this story by review decision 2026-08-07. Both halves are the
    // same defect: `evaluateContextReadiness` counts an artifact missing while it is ineligible *or*
    // uninspected, so an artifact that can never be inspected is counted missing forever and the
    // reading room can never be left. The selector is correct in both cases — see the reconciled test
    // in `ReadingGateHints.test.ts` — so the fix is that the content becomes unauthorable.
    it.each([
        ['incomplete', 'rightsStatus', 'is not reviewed, so it can never be inspected'],
        ['unavailable', 'rightsStatus', 'is not reviewed, so it can never be inspected']
    ])('rejects a %s artifact, which context readiness would count missing forever', (rightsStatus, path, reason) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        const artifacts = definition.contextualArtifacts as Array<Record<string, unknown>>;
        artifacts[1].rightsStatus = rightsStatus;
        // The rendition has to go too, or the *rights* rule fires first and this test would pass
        // without the readiness rule existing at all.
        delete artifacts[1].textualRendition;

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                message: `Context readiness requires every authored source to be inspected, and this one ${reason} — the gate could never open.`,
                path: ['contextualArtifacts', 1, path]
            })
        ]));
    });

    it('rejects a reviewed artifact with nothing to read, by the same rule and with its own reason', () => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        const artifacts = definition.contextualArtifacts as Array<Record<string, unknown>>;
        delete artifacts[0].textualRendition;

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message)).toContain(
            'Context readiness requires every authored source to be inspected, and this one has no local textual rendition, so it can never be read — the gate could never open.'
        );
    });

    it('still names the rights violation when an unreviewed artifact ships a transcription', () => {
        // The one rule of the three that is genuinely about rights rather than readiness, kept separate
        // because reusing someone's text without clearing it is a defect whatever the gate does.
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        (definition.contextualArtifacts as Array<Record<string, unknown>>)[0].rightsStatus = 'incomplete';

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message)).toContain('Only reviewed sources may provide a local textual rendition.');
    });

    // --- AC5: the neutral auto-summary's authored template ------------------------------------------
    it.each([
        ['en', 'The auto-summary template names {runsRecorded}, which is not a value the summary can fill.'],
        ['fr', 'The auto-summary template names {runsRecorded}, which is not a value the summary can fill.']
    ])('rejects an auto-summary naming an unknown placeholder in %s', (locale, message) => {
        // Both locales, because the check is per locale: a template whose English is right and whose
        // French carries the typo is the exact asymmetry this project keeps producing, and validating the
        // English alone would ship the literal token to French players only.
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        (definition.autoSummary as Record<string, string>)[locale] = 'Observations: {runsRecorded}.';

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ message, path: ['autoSummary', locale] })
        ]));
    });

    it('rejects an auto-summary that encodes a scene, route, or phase path', () => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        definition.autoSummary = { en: 'Return to the laboratory scene to see {runCount}.', fr: 'Observations : {runCount}.' };

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message))
            .toContain('The auto-summary template must not encode a scene, route, or phase path.');
    });

    it.each(['en', 'fr'])('rejects an auto-summary missing its %s content', (locale) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        delete (definition.autoSummary as Record<string, string>)[locale];

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it('accepts a template that names no placeholder at all', () => {
        // Authoring is not obliged to use every value on offer, and prose with no counts in it is still a
        // neutral summary. The rule is "name nothing unknown", not "name everything".
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        definition.autoSummary = { en: 'This record lists the observations and references it carries.', fr: 'Ce dossier liste les observations et les références qu’il contient.' };

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    // --- AC7 row 1: the asset path regex (deferred-work.md:146) --------------------------------------
    it.each([
        // Protocol-relative with a backslash. Browsers normalise `\` to `/` in the authority position,
        // so this fetches from `evil.example` — and the old `/^\/(?!\/)/` accepted it, because it only
        // ruled out a second forward slash. The reason it matters at all is the Pages deploy: assets now
        // go through `resolveAssetUrl`, and at a domain root there is no subpath to contain them.
        ['a backslash protocol-relative path', '/\\evil.example/x.png'],
        ['a parent-directory segment', '/cases/../../etc/passwd'],
        ['a bare parent-directory segment', '/../secrets.png'],
        ['a trailing parent-directory segment', '/cases/young-interference/..']
    ])('rejects %s in the asset manifest', (_description, path) => {
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        (definition.assets as { entries: Array<{ path: string }> }).entries[0].path = path;

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: false });
    });

    it('still accepts an ordinary same-origin asset path with a dotted filename', () => {
        // The `..` rule is a *segment* rule, not a substring rule: `young..v2.png` is a filename, and a
        // regex hunting for `..` anywhere would have rejected it.
        const definition = cloneValidCase() as unknown as Record<string, unknown>;
        (definition.assets as { entries: Array<{ path: string }> }).entries[0].path = '/cases/young-interference/young..v2.png';

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
    });

    it('states the control ceiling once, where the bench geometry can be checked against it', () => {
        // Guards the number itself: `ApparatusGeometry.test.ts` proves 2 is the largest count whose
        // instrument slots clear the wavelength chooser, and reads this same constant to do it.
        expect(MAX_PRIMARY_CONTROLS).toBe(2);
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
        if (result.ok) {
            const rendition = result.value.contextualArtifacts[0].textualRendition;
            expect(rendition?.renditions.map(({ locale, kind }) => `${locale}:${kind}`))
                .toEqual(['en:transcription', 'fr:translation']);
            expect(rendition?.renditions[0].sections.map(({ id }) => id)).toEqual(
                Array.from({ length: 37 }, (_, index) => `young-bakerian-page-${index + 12}`)
            );
            expect(rendition?.renditions[0].sections.map(({ sourcePages }) => sourcePages)).toEqual(
                Array.from({ length: 37 }, (_, index) => [index + 12])
            );
            expect(rendition?.renditions[0].sections.find(({ id }) => id === 'young-bakerian-page-39')?.paragraphs[1]).toContain(
                'Extreme red — .0000266 — 37640 — 463'
            );
            expect(rendition?.summary?.en.length).toBeGreaterThan(0);
            expect(rendition?.summary?.fr.length).toBe(rendition?.summary?.en.length);
            const opticksRendition = result.value.contextualArtifacts[1].textualRendition;
            expect(opticksRendition).toMatchObject({
                readerLabel: { en: 'Read the Opticks reference', fr: 'Lire la référence à l’Opticks' },
                citation: { archiveUrl: 'https://archive.org/details/opticksortreatis1730newt' }
            });
            expect(opticksRendition?.renditions[0].sections.map(({ id }) => id)).toEqual(
                Array.from({ length: 6 }, (_, index) => `newton-opticks-page-${index + 371}`)
            );
            expect(opticksRendition?.renditions[0].sections.map(({ heading, sourcePages }) => ({ heading, sourcePages }))).toEqual(
                Array.from({ length: 6 }, (_, index) => ({ heading: `Printed page ${index + 371}`, sourcePages: [index + 371] }))
            );
            expect(opticksRendition?.renditions[0].sections[0].paragraphs[0].startsWith('Light at a distance in refracting')).toBe(true);
            expect(opticksRendition?.renditions[0].sections[5].paragraphs[0].endsWith('or Vitriol,')).toBe(true);
            expect(opticksRendition?.summary?.en.length).toBeGreaterThan(0);
            expect(opticksRendition?.summary?.fr.length).toBe(opticksRendition?.summary?.en.length);

            // The French pages are authored, page-for-page, against the transcription of record.
            for (const artifact of result.value.contextualArtifacts) {
                const [transcription, translation] = artifact.textualRendition!.renditions;
                expect(translation.locale).toBe('fr');
                expect(translation.kind).toBe('translation');
                expect(translation.sections.map(({ id, sourcePages }) => ({ id, sourcePages })))
                    .toEqual(transcription.sections.map(({ id, sourcePages }) => ({ id, sourcePages })));
                expect(translation.sections.every(({ heading }) => heading.startsWith('Page imprimée'))).toBe(true);
                // Nothing left untranslated: no French page may simply echo its English counterpart.
                expect(translation.sections.filter((section, index) =>
                    section.paragraphs.join(' ') === transcription.sections[index].paragraphs.join(' ')
                    && section.paragraphs.join(' ').length > 8)).toEqual([]);
                // And the reuse statement says plainly what the French reader is looking at.
                expect(artifact.textualRendition!.citation.reuseStatement.fr).toContain('Traduction française');
            }
        }
        expect(JSON.parse(manifestContent)).toEqual(validYoungCase.assets);
        expect(fetchCase).toHaveBeenNthCalledWith(1, '/cases/young-interference/case.json');
        expect(fetchCase).toHaveBeenNthCalledWith(2, '/cases/young-interference/asset-manifest.json');
    });

    /**
     * The authored debrief, in both locales (Story 2.11, AC8).
     *
     * The debrief is the last surface on `EXPERIENCE.md`'s own list of places the "chrome gets
     * localized and content does not" defect recurs, and every string checked here is **content** —
     * `LocalizedText` in `case.json`, resolved by `selectLocalizedDebrief` rather than by `translate`.
     * The interface half of AC8 is `I18n.test.ts`; the French *widths* are `french-typography.spec.ts`.
     * Canvas text cannot be read from the DOM, so this is where "asserted present in EN and FR" is
     * actually met for the room's prose.
     *
     * `summary` in particular has been authored in both locales since 1.14.0 and rendered by **nothing**
     * until this story; a test naming it is how it stops being possible for that to happen quietly.
     */
    it('authors every debrief string the canvas renders, in both locales', async () => {
        const caseContent = await readFile(new URL('../../public/cases/young-interference/case.json', import.meta.url), 'utf8');
        const definition = CaseDefinitionSchema.parse(JSON.parse(caseContent));
        const { debrief } = definition;

        const authored: readonly (readonly [string, LocalizedText])[] = [
            ['summary', debrief.summary],
            ['historicalComparison.title', debrief.historicalComparison.title],
            ['historicalComparison.text', debrief.historicalComparison.text],
            ['deeperTheory.title', debrief.deeperTheory.title],
            ['deeperTheory.text', debrief.deeperTheory.text],
            ['replayLabel', debrief.replayLabel]
        ];

        authored.forEach(([name, text]) => {
            expect(text.en.trim().length, `${name} (en)`).toBeGreaterThan(0);
            expect(text.fr.trim().length, `${name} (fr)`).toBeGreaterThan(0);
            // A French value byte-identical to its English one is an untranslated placeholder, and
            // every one of these is a full sentence rather than a cognate or a punctuation template.
            expect(text.fr, `${name} was never translated`).not.toBe(text.en);
        });

        // The two cited sources resolve against `contextualArtifacts`, which is what the debrief reads.
        // `debrief.sourceRefs` is deliberately **not** checked: its two ids match no artifact and the
        // schema validates them only as non-empty strings, which is Open Question 3 rather than
        // something to assert either way here.
        const artifactIds = definition.contextualArtifacts.map(({ id }) => id);
        debrief.historicalComparison.sourceIds.forEach((sourceId) => {
            expect(artifactIds, `${sourceId} is cited but not authored`).toContain(sourceId);
        });

        // The counterfactual warning has to read as one in both locales — it is the only thing telling
        // a replaying player that what they are building is not the record.
        expect(debrief.replayLabel.en.toLowerCase()).toContain('not the recorded historical result');
        expect(debrief.replayLabel.fr.toLowerCase()).toContain('il ne s’agit pas du résultat historique enregistré');

        // And the challenge lines the debrief pages through, for the same reason.
        definition.rivalLab.critiques.forEach((critique) => {
            expect(critique.line.en.trim().length, `${critique.id} (en)`).toBeGreaterThan(0);
            expect(critique.line.fr.trim().length, `${critique.id} (fr)`).toBeGreaterThan(0);
            expect(critique.line.fr, `${critique.id} was never translated`).not.toBe(critique.line.en);
        });
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

    it.each([
        ['experiment', 'prediction'],
        ['synthesis', 'experiment'],
        ['review', 'experiment']
    ] as const)('allows the authored revisit from %s to %s without changing the definition', (phase, previousPhase) => {
        expect(retreatCasePhase({ definition: validYoungCase, phase }, previousPhase))
            .toEqual({ ok: true, value: { definition: validYoungCase, phase: previousPhase } });
    });

    it.each([
        ['prediction', 'context'],
        ['synthesis', 'prediction'],
        ['debrief', 'review']
    ] as const)('rejects an unsupported revisit from %s to %s', (phase, previousPhase) => {
        expect(retreatCasePhase({ definition: validYoungCase, phase }, previousPhase))
            .toMatchObject({ ok: false, error: { code: 'invalid-case-retreat' } });
    });
});

/**
 * The guarantees the Story 3.1 review found unheld (2026-08-19).
 *
 * Every case here was **impossible before this story** and became reachable when a shape was relaxed
 * without re-stating what it held. They live in one block so the pattern is visible: relaxing
 * `contextualArtifacts`, the three requirement counts, `criticalModelInputIds` and the asset-path rule
 * each moved a guarantee to nowhere. `MAX_PRIMARY_CONTROLS` is the one the story did re-state, and it is
 * the template the rest now follow.
 */
describe('what the relaxed shapes were silently holding', () => {
    const rejects = (mutate: (definition: Record<string, unknown>) => void, expectedMessage: string): void => {
        const definition = cloneSecondCase() as unknown as Record<string, unknown>;
        mutate(definition);

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message)).toContain(expectedMessage);
    };

    it('rejects a third contextual artifact, which the case file has no row to cite', () => {
        // `CASE_FILE_SOURCE_ROWS` is 2. A third source would be readable, would count toward the reading
        // gate, and could never be pinned as supporting evidence — with `minimumSources: 3`, a dead end.
        const definition = cloneSecondCase() as unknown as Record<string, unknown>;
        const artifacts = definition.contextualArtifacts as Array<Record<string, unknown>>;
        artifacts.push({ ...artifacts[0], id: 'a-third-source' });

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ path }) => path.join('.'))).toContain('contextualArtifacts');
    });

    it('rejects a source requirement above the sources the case authors', () => {
        rejects(
            (definition) => { definition.requirements = { minimumRuns: 3, minimumSources: 3, minimumSignificantRuns: 2 }; },
            'The source requirement must not exceed the sources the case authors.'
        );
    });

    it('rejects a significant-measure requirement above the configurations the controls can produce', () => {
        // `rotationDeg` is 0–90 in steps of 15 (7 positions) and `bathTempC` 10–30 in steps of 2 (11), so
        // the reachable space is 77. A requirement of 78 can never be met and the colleague would repeat
        // its floor hint forever.
        rejects(
            (definition) => { definition.requirements = { minimumRuns: 3, minimumSources: 2, minimumSignificantRuns: 78 }; },
            'The significant-measure requirement must not exceed the configurations the authored controls can produce.'
        );
    });

    it('accepts a significant-measure requirement exactly at the reachable ceiling', () => {
        const definition = cloneSecondCase() as unknown as Record<string, unknown>;
        definition.requirements = { minimumRuns: 3, minimumSources: 2, minimumSignificantRuns: 77 };

        expect(CaseDefinitionSchema.safeParse(definition).success).toBe(true);
    });

    it.each([
        ['a backslash-separated traversal', '/cases\\..\\..\\etc/passwd'],
        ['a percent-encoded traversal', '/cases/%2e%2e/%2e%2e/etc/passwd'],
        ['an uppercase percent-encoded traversal', '/cases/%2E%2E/etc/passwd']
    ])('rejects %s in an asset path', (_case, path) => {
        // `deferred-work.md:146` named `/\` and `..` in one sentence. Story 3.1 closed the backslash in the
        // *authority* position and the `..` segment when slash-delimited, and left their intersection open:
        // `resolveAssetUrl` is string concatenation, and the browser normalises both forms to a traversal.
        const definition = cloneSecondCase() as unknown as Record<string, unknown>;
        const entries = (definition.assets as { entries: Array<Record<string, unknown>> }).entries;
        entries[0] = { ...entries[0], path };

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message))
            .toContain('Asset paths must not contain a parent-directory segment.');
    });

    it('still accepts an ordinary authored asset path', () => {
        expect(CaseDefinitionSchema.safeParse(cloneSecondCase()).success).toBe(true);
    });
});

/**
 * `criticalModelInputIds` lost its `z.enum(['wavelengthNm'])` and gained only a duplicate check, so a
 * single transposed letter loaded clean and resolved to `UNRECORDED_INPUT` for every run — silently
 * collapsing the wavelength dimension out of `configurationKey`. Checked in the Young branch, because the
 * vocabulary is the Young model's own and no shared one exists yet.
 */
describe('the Young significance rule against the Young model inputs', () => {
    it('rejects a misspelled model input', () => {
        const definition = structuredClone(validYoungCase) as unknown as Record<string, unknown>;
        definition.significanceRule = {
            ...(definition.significanceRule as Record<string, unknown>),
            criticalModelInputIds: ['wavelenghtNm']
        };

        const parsed = CaseDefinitionSchema.safeParse(definition);

        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        expect(parsed.error.issues.map(({ message }) => message))
            .toContain('The Young significance rule may only name a recorded Young model input.');
    });

    it('accepts every name the Young model actually records', () => {
        // Asserted against a real recorded run rather than a second copy of the list, so the schema's set
        // and `YoungModelInputs` cannot drift apart silently.
        const recorded = { slitSpacingMm: 0.25, screenDistanceM: 2, wavelengthNm: 550 as const, wavelengthMode: 'minimum' as const };
        const definition = structuredClone(validYoungCase) as unknown as Record<string, unknown>;
        definition.significanceRule = {
            ...(definition.significanceRule as Record<string, unknown>),
            criticalModelInputIds: Object.keys(recorded)
        };

        expect(CaseDefinitionSchema.safeParse(definition).success).toBe(true);
    });

    it('pins the comparison baseline for Young and leaves it authored for anyone else', () => {
        const young = structuredClone(validYoungCase) as unknown as Record<string, unknown>;
        (young.experiment as { wavelengthComparison: Record<string, unknown> })
            .wavelengthComparison = { fixedMinimumPathNm: 500, advancedChoicesNm: [450, 650] };

        const parsedYoung = CaseDefinitionSchema.safeParse(young);
        expect(parsedYoung.success).toBe(false);
        if (!parsedYoung.success) {
            expect(parsedYoung.error.issues.map(({ message }) => message))
                .toContain('The Young comparison measures against the fixed 550 nm path.');
        }

        // The same shape on a second case parses: the baseline is authored, which is the whole point.
        const second = cloneSecondCase() as unknown as Record<string, unknown>;
        (second.experiment as Record<string, unknown>).wavelengthComparison = { fixedMinimumPathNm: 500, advancedChoicesNm: [450, 650] };

        expect(CaseDefinitionSchema.safeParse(second).success).toBe(true);
    });
});
