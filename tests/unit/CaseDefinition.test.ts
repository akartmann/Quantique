import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { loadCaseDefinition } from '../../src/adapters/content/loadCaseDefinition';
import type { CaseDefinition, LocalizedText, LocalizedTextList, TextualRendition } from '../../src/domain/cases/CaseDefinition';
import { CASE_PHASES, createInitialCaseProgress } from '../../src/domain/cases/CaseProgress';
import { advanceCasePhase, resetCaseProgress } from '../../src/domain/cases/caseReducer';
import { CaseDefinitionSchema } from '../../src/schemas/CaseDefinitionSchema';

/** Fixture helpers: every localizable authored string must carry both shipped locales. */
const bilingual = (english: string, french = `${english} [fr]`): LocalizedText => ({ en: english, fr: french });
const bilingualList = (english: readonly string[], french = english.map((entry) => `${entry} [fr]`)): LocalizedTextList =>
    ({ en: [...english], fr: [...french] });

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
            caseRelationship: bilingual('Contemporary account of Young’s interference demonstration.')
        },
        {
            id: 'newton-opticks',
            displayName: bilingual('Opticks reference'),
            creatorOrOrigin: 'Isaac Newton, published work',
            sourceType: 'published-book',
            provenance: { category: 'primary-material', reference: 'newton-opticks-1704' },
            rightsStatus: 'reviewed',
            caseRelationship: bilingual('Earlier source that frames the corpuscular account considered by Young.')
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
    requirements: { minimumRuns: 2, minimumSources: 2 },
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
    assets: { manifestVersion: '1.0.0', entries: [{ id: 'quantique-logo', type: 'image', path: '/assets/logo.png' }] }
};

const cloneValidCase = (): CaseDefinition => structuredClone(validYoungCase);

const localLectureRendition = (): TextualRendition => ({
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
            sections: [{ id: 'young-bakerian-page-12', heading: 'Printed page 12', paragraphs: ['Opening text.'], sourcePages: [12] }]
        },
        {
            locale: 'fr',
            kind: 'translation',
            sections: [{ id: 'young-bakerian-page-12', heading: 'Page imprimée 12', paragraphs: ['Texte d’ouverture.'], sourcePages: [12] }]
        }
    ]
});

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

    it('accepts an optional dialogue beat placeholder on a scenario scene', () => {
        const definition = cloneValidCase() as unknown as { scenarioScript: { scenes: Array<Record<string, unknown>> } };
        definition.scenarioScript.scenes[1].dialogueBeats = [{ id: 'colleague-intro', speakerId: 'colleague-1', textKey: 'young.prediction.intro' }];

        expect(CaseDefinitionSchema.safeParse(definition)).toMatchObject({ success: true });
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
        }]
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
