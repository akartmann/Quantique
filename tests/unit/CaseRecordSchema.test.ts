import { describe, expect, it } from 'vitest';

import { CaseRecordSchema, parseAndMigrateCaseRecord, validateCaseRecordForDefinition } from '../../src/schemas/CaseRecordSchema';
import { createAppStateFromCaseRecord, createInitialAppState } from '../../src/core/store/AppState';
import { createStore } from '../../src/core/store/createStore';
import { createCaseRecordProjection } from '../../src/core/store/CaseRecordProjection';
import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';

const definition = {
    id: 'young-interference', version: '1.0.0', prediction: { required: true }, requirements: { minimumRuns: 2, minimumSources: 2, minimumSignificantRuns: 2 },
    significanceRule: { criticalControlIds: ['slitSpacingMm', 'screenDistanceM'] },
    colleagueHints: [],
    apparatus: { primaryControls: [
        { id: 'slitSpacingMm', label: { en: 'Slit spacing', fr: 'Slit spacing [fr]' }, unit: 'mm', min: 0.1, max: 0.5, step: 0.05, defaultValue: 0.25 },
        { id: 'screenDistanceM', label: { en: 'Screen distance', fr: 'Screen distance [fr]' }, unit: 'm', min: 1, max: 4, step: 0.25, defaultValue: 2 }
    ] },
    contextualArtifacts: [
        { id: 'source-1', displayName: { en: 'Source one', fr: 'Source one [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'lecture-record', provenance: { category: 'primary-material', reference: 'one' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } },
        { id: 'source-2', displayName: { en: 'Source two', fr: 'Source two [fr]' }, creatorOrOrigin: 'Archive', sourceType: 'published-book', provenance: { category: 'primary-material', reference: 'two' }, rightsStatus: 'reviewed', caseRelationship: { en: 'Evidence.', fr: 'Evidence. [fr]' } }
    ],
    experiment: { modelVersion: 'young-v1' }
} as CaseDefinition;

const validRecord = {
    schemaVersion: 3,
    caseId: 'young-interference',
    caseDefinitionVersion: '1.0.0',
    phase: 'context',
    activeControlValues: { slitSpacingMm: 0.25, screenDistanceM: 2 },
    inspectedSourceIds: ['source-1'],
    prediction: '',
    runs: [{
        id: 'run-001', caseId: 'young-interference', controls: { slitSpacingMm: 0.25, screenDistanceM: 2 },
        result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: '2026-08-05T10:00:00.000Z',
        experimentModelVersion: 'young-v1', linkedEvidenceIds: ['source-1']
    }],
    comparison: { selectedRunIds: ['run-001'], notes: [] },
    theory: { selectedRunIds: ['run-001'], selectedSourceIds: ['source-1'], conclusion: 'A bounded conclusion.', limitation: 'A limitation.' },
    decisionHistory: [],
    replay: { isCounterfactual: false },
    recognition: {
        version: 1,
        items: [
            { id: 'source-discipline', label: 'Source discipline recorded', description: 'Each reviewed contextual source has been inspected as evidence.', achieved: false },
            { id: 'replication', label: 'Replication recorded', description: 'Two observations use the same setup for comparison.', achieved: false },
            { id: 'variable-curiosity', label: 'Variable curiosity recorded', description: 'Two observations use different authored control settings for comparison.', achieved: false },
            { id: 'calibrated-conclusion', label: 'Calibrated conclusion recorded', description: 'A reviewed revision makes a bounded claim without an overreach finding.', achieved: false }
        ]
    }
};

describe('portable case records', () => {
    it('strictly parses the current projection and validates it against the loaded definition', () => {
        const parsed = CaseRecordSchema.safeParse(validRecord);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(validateCaseRecordForDefinition(parsed.data, definition)).toEqual({ ok: true, value: parsed.data });
        expect(createInitialAppState(definition).caseDefinition).toBe(definition);
    });

    // Adding `fr` to authored display text (1.5.0) and a French rendition of the archival pages
    // (1.6.0) moved no progress-bearing value, so investigations saved against any of the earlier
    // versions must still load against 1.6.0 rather than being discarded (NFR12).
    it.each(['1.2.0', '1.3.0', '1.4.0', '1.5.0'])('accepts a %s record against the 1.6.0 localized definition', (recordVersion) => {
        const localized = { ...definition, version: '1.6.0' } as CaseDefinition;
        const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: recordVersion });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(validateCaseRecordForDefinition(parsed.data, localized)).toMatchObject({ ok: true });
    });

    // --- Significant-measure gate (Story 2.6) ---------------------------------------------------

    // The rule, the hints, and the requirement count are content, not progress, so a record saved
    // before 2.6 still validates. Without this the upgrade would discard every saved investigation.
    it.each(['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0'])(
        'accepts a %s record against the 1.10.0 gated definition',
        (recordVersion) => {
            const gated = { ...definition, version: '1.10.0' } as CaseDefinition;
            const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: recordVersion });

            expect(parsed.success).toBe(true);
            if (!parsed.success) return;
            expect(validateCaseRecordForDefinition(parsed.data, gated)).toMatchObject({ ok: true });
        }
    );

    // 1.11.0 reworked the rule in review: `minimumResultDelta` removed (it made the count depend on
    // recording order) and `criticalModelInputIds` added (a wavelength change is a distinguishing
    // measurement). Still content, still not progress — and the rule only ever got *looser*, so no
    // saved record can fall short of a bar it already cleared.
    it.each(['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0'])(
        'accepts a %s record against the 1.11.0 gated definition',
        (recordVersion) => {
            const gated = { ...definition, version: '1.11.0' } as CaseDefinition;
            const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: recordVersion });

            expect(parsed.success).toBe(true);
            if (!parsed.success) return;
            expect(validateCaseRecordForDefinition(parsed.data, gated)).toMatchObject({ ok: true });
        }
    );

    // --- Reading-gate lines (Story 2.8) ---------------------------------------------------------

    // 1.12.0 added `readingGateHints`: authored prose selected at display time from
    // `inspectedSourceIds`, persisted nowhere, referenced by no record field, read by no reducer. The
    // gate they answer is older than they are — `missing-contextual-sources` has refused the
    // `context → prediction` advance since 1.2.0 against a field every listed version already saves —
    // so a restored record meets exactly the gate it met before. Only the refusal's wording changed.
    it.each(['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0', '1.11.0'])(
        'accepts a %s record against the 1.12.0 reading-room definition',
        (recordVersion) => {
            const readingRoom = { ...definition, version: '1.12.0' } as CaseDefinition;
            const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: recordVersion });

            expect(parsed.success).toBe(true);
            if (!parsed.success) return;
            expect(validateCaseRecordForDefinition(parsed.data, readingRoom)).toMatchObject({ ok: true });
        }
    );

    /**
     * The one question this bump raises that the earlier ones did not.
     *
     * A record saved before 2.6 can be sitting at `synthesis` on evidence the new gate would have
     * refused, because no gate existed when it was saved — here, two runs at an identical
     * configuration, which counts as **one** significant measurement. It must still load and still be
     * completable.
     *
     * It is, because the gate runs on the `experiment → synthesis` transition only: a record already
     * past that transition is never re-tested. This is also why the gate must not be duplicated at
     * the conclusion choice — the phase machine is one-way, so a second gate would strand exactly
     * this player with no route back to the apparatus.
     */
    it('loads a pre-2.6 record already at synthesis whose evidence would not clear the new gate', () => {
        const gated = { ...definition, version: '1.10.0' } as CaseDefinition;
        const replicatedOnly = {
            ...validRecord,
            caseDefinitionVersion: '1.9.0',
            phase: 'synthesis',
            // Reaching any phase past `context` already required every reviewed source and a
            // prediction, long before this story. Those gates are unchanged.
            inspectedSourceIds: ['source-1', 'source-2'],
            prediction: 'A wider screen distance should spread the bands.',
            runs: [
                validRecord.runs[0],
                // The same controls as run-001: a replication, not a variation.
                { ...validRecord.runs[0], id: 'run-002', timestamp: '2026-08-05T10:05:00.000Z' }
            ],
            comparison: { selectedRunIds: ['run-001', 'run-002'], notes: [] },
            theory: { ...validRecord.theory, selectedRunIds: ['run-001', 'run-002'] },
            // Recomputed and compared on load, so it has to state what these runs actually earn: two
            // identical setups are a `replication` and, precisely because they are identical, not
            // `variable-curiosity` — the same distinction the significance rule draws, and exactly
            // why this record would not have cleared the new gate.
            recognition: {
                ...validRecord.recognition,
                items: validRecord.recognition.items.map((item) =>
                    item.id === 'replication' || item.id === 'source-discipline' ? { ...item, achieved: true } : item)
            }
        };

        const parsed = CaseRecordSchema.safeParse(replicatedOnly);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        const validated = validateCaseRecordForDefinition(parsed.data, gated);
        if (!validated.ok) throw new Error(`Expected the record to load, got ${validated.error.code}: ${validated.error.message}`);
        // And the restored state really is at the theory board rather than pushed back to the lab.
        expect(validated.value.phase).toBe('synthesis');
    });

    // --- Colleague proposal IDs (Story 1.11) ----------------------------------------------------

    // The cast and the two proposal sets are content, not progress, so a record saved before 1.11
    // still validates. Without this the upgrade would discard every saved investigation (NFR12).
    it.each(['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0'])('accepts a %s record against the 1.7.0 proposal definition', (recordVersion) => {
        const withProposals = { ...definition, version: '1.7.0', predictionProposals: [], conclusionProposals: [] } as unknown as CaseDefinition;
        const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: recordVersion });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        // The pre-1.11 record carries neither field, and both stay absent after validation.
        expect(parsed.data.selectedPredictionProposalId).toBeUndefined();
        expect(parsed.data.selectedConclusionProposalId).toBeUndefined();
        expect(validateCaseRecordForDefinition(parsed.data, withProposals)).toMatchObject({ ok: true });
    });

    const proposalDefinition = {
        ...definition,
        predictionProposals: [{ id: 'p-1', colleagueId: 'thea-young', text: { en: 'Bands will appear.', fr: 'Des bandes apparaîtront.' } }],
        conclusionProposals: [{
            id: 'c-1',
            colleagueId: 'thea-young',
            claim: { en: 'A bounded conclusion.', fr: 'Une conclusion délimitée.' },
            limitation: { en: 'A limitation.', fr: 'Une limite.' },
            supportPredicate: { kind: 'minimum-runs', count: 1 }
        }]
    } as unknown as CaseDefinition;

    it('accepts a record whose proposal IDs match the canonical authored text', () => {
        const parsed = CaseRecordSchema.safeParse({
            ...validRecord,
            prediction: 'Bands will appear.',
            selectedPredictionProposalId: 'p-1',
            selectedConclusionProposalId: 'c-1'
        });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(validateCaseRecordForDefinition(parsed.data, proposalDefinition)).toMatchObject({ ok: true });
    });

    // An ID naming a proposal that does not exist describes content this build cannot render, so the
    // record is refused. A *text* mismatch is different — an authored copy edit is the ordinary cause
    // — and refusing there would destroy the investigation, because `CaseProgressPanel` autosaves over
    // the same key on the first dispatch of the recovered session.
    it.each([
        ['an unauthored prediction proposal ID', { selectedPredictionProposalId: 'p-invented', prediction: 'Bands will appear.' }],
        ['an unauthored conclusion proposal ID', { selectedConclusionProposalId: 'c-invented' }]
    ])('rejects a record carrying %s', (_description, overrides) => {
        const parsed = CaseRecordSchema.safeParse({ ...validRecord, ...overrides });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(validateCaseRecordForDefinition(parsed.data, proposalDefinition))
            .toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
    });

    it.each([
        ['a prediction whose text no longer matches its proposal',
            { selectedPredictionProposalId: 'p-1', prediction: 'Hand-edited afterwards.' },
            'selectedPredictionProposalId' as const],
        ['a conclusion whose claim no longer matches its proposal',
            { selectedConclusionProposalId: 'c-1', theory: { ...validRecord.theory, conclusion: 'Hand-edited afterwards.' } },
            'selectedConclusionProposalId' as const],
        ['a conclusion whose limitation no longer matches its proposal',
            { selectedConclusionProposalId: 'c-1', theory: { ...validRecord.theory, limitation: 'Hand-edited afterwards.' } },
            'selectedConclusionProposalId' as const]
    ])('keeps a record carrying %s, dropping only the stale attribution', (_description, overrides, staleField) => {
        const parsed = CaseRecordSchema.safeParse({ ...validRecord, ...overrides });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        const validated = validateCaseRecordForDefinition(parsed.data, proposalDefinition);

        expect(validated.ok).toBe(true);
        if (!validated.ok) return;
        // The investigation survives; only the claim about who authored the text is dropped.
        expect(validated.value[staleField]).toBeUndefined();
        expect(validated.value.runs).toEqual(parsed.data.runs);
        expect(validated.value.prediction).toBe(parsed.data.prediction);
        expect(validated.value.theory).toEqual(parsed.data.theory);
    });

    it('carries the sanitized record into app state rather than the raw argument', () => {
        const parsed = CaseRecordSchema.safeParse({
            ...validRecord,
            selectedPredictionProposalId: 'p-1',
            prediction: 'Hand-edited afterwards.'
        });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        const state = createAppStateFromCaseRecord(parsed.data, proposalDefinition);

        expect(state.ok).toBe(true);
        if (!state.ok) return;
        // Reading the argument again here would put the stale ID straight back into the next save.
        expect(state.value.selectedPredictionProposalId).toBeUndefined();
        expect(state.value.prediction).toBe('Hand-edited afterwards.');
    });

    /**
     * The 1.15.0 clause, and the reason it is not a rubber stamp (Story 2.12, D6).
     *
     * 1.15.0 changes no authored field — the bump is the code-side contract change that removed the
     * three free-text actions. What has to keep working is the direction that matters: a record saved
     * by an older build, carrying a hand-written prediction with **no** proposal ID, still loads.
     * Rejecting it would discard a saved investigation on upgrade, which is the NFR12 failure every
     * clause in this allowlist exists to avoid.
     */
    it('accepts records from every earlier version at 1.15.0, including un-attributed ones', () => {
        const current = { ...definition, version: '1.15.0' } as CaseDefinition;
        ['1.2.0', '1.7.0', '1.13.0', '1.14.0'].forEach((saved) => {
            const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: saved });
            expect(parsed.success, saved).toBe(true);
            if (!parsed.success) return;
            expect(validateCaseRecordForDefinition(parsed.data, current), saved).toMatchObject({ ok: true });
        });
        // And a version this clause does not list is still refused, so the clause is a list rather than
        // an "anything older" waiver.
        const older = CaseRecordSchema.parse({ ...validRecord, caseDefinitionVersion: '1.1.0' });
        expect(validateCaseRecordForDefinition(older, current))
            .toMatchObject({ ok: false, error: { code: 'incompatible-case-record' } });
    });

    it.each(['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0', '1.11.0', '1.12.0', '1.13.0', '1.14.0', '1.15.0'])(
        'accepts a %s record against the 1.16.0 presentational portrait definition',
        (recordVersion) => {
            const portraitDefinition = { ...definition, version: '1.16.0' } as CaseDefinition;
            const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: recordVersion });

            expect(parsed.success).toBe(true);
            if (!parsed.success) return;
            expect(validateCaseRecordForDefinition(parsed.data, portraitDefinition)).toMatchObject({ ok: true });
        }
    );

    // This catches an over-broad 1.16.0 compatibility allowlist: 1.1.0 predates the first
    // compatible saved-progress contract, so accepting it would make the bundled portrait update
    // silently reinterpret an unsupported record.
    it('rejects a 1.1.0 record against the 1.16.0 presentational portrait definition', () => {
        const portraitDefinition = { ...definition, version: '1.16.0' } as CaseDefinition;
        const parsed = CaseRecordSchema.parse({ ...validRecord, caseDefinitionVersion: '1.1.0' });

        expect(validateCaseRecordForDefinition(parsed, portraitDefinition))
            .toMatchObject({ ok: false, error: { code: 'incompatible-case-record' } });
    });

    it('still rejects a record from an unrelated definition version', () => {
        const localized = { ...definition, version: '1.6.0' } as CaseDefinition;
        const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: '0.9.0' });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(validateCaseRecordForDefinition(parsed.data, localized))
            .toMatchObject({ ok: false, error: { code: 'incompatible-case-record' } });
    });

    it('rejects unknown fields, duplicate references, and incompatible records with neutral failures', () => {
        expect(CaseRecordSchema.safeParse({ ...validRecord, unexpected: true }).success).toBe(false);
        const duplicate = CaseRecordSchema.parse({ ...validRecord, inspectedSourceIds: ['source-1', 'source-1'] });
        expect(validateCaseRecordForDefinition(duplicate, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
        const mismatch = CaseRecordSchema.parse({ ...validRecord, caseDefinitionVersion: '2.0.0' });
        expect(validateCaseRecordForDefinition(mismatch, definition)).toMatchObject({ ok: false, error: { code: 'incompatible-case-record' } });
        expect(CaseRecordSchema.safeParse({
            ...validRecord,
            recognition: { ...validRecord.recognition, items: [...validRecord.recognition.items.slice(0, 3), validRecord.recognition.items[0]] }
        }).success).toBe(false);
        const unjustifiedRecognition = CaseRecordSchema.parse({
            ...validRecord,
            recognition: {
                ...validRecord.recognition,
                items: validRecord.recognition.items.map((item) => item.id === 'source-discipline' ? { ...item, achieved: true } : item)
            }
        });
        expect(validateCaseRecordForDefinition(unjustifiedRecognition, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
    });

    it('rejects impossible historical snapshots, bypassed debriefs, and malformed history', () => {
        const impossibleRun = CaseRecordSchema.parse({
            ...validRecord,
            runs: [{ ...validRecord.runs[0], controls: { slitSpacingMm: 0.9, screenDistanceM: 2 } }]
        });
        expect(validateCaseRecordForDefinition(impossibleRun, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });

        const bypassedDebrief = CaseRecordSchema.parse({ ...validRecord, phase: 'debrief' });
        expect(validateCaseRecordForDefinition(bypassedDebrief, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });

        const malformedHistory = CaseRecordSchema.parse({
            ...validRecord,
            decisionHistory: [{
                version: 1, priorConclusion: '', conclusion: '', limitation: '', selectedRunIds: ['run-001'], selectedSourceIds: ['source-1'],
                feedback: { status: 'unavailable', message: 'Unavailable.' }, timestamp: '2026-08-05T10:01:00.000Z'
            }]
        });
        expect(validateCaseRecordForDefinition(malformedHistory, definition)).toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
    });

    it('migrates only supported prior versions and rejects malformed, future, and unsupported versions', () => {
        const { prediction: _prediction, ...legacyRecord } = validRecord;
        expect(parseAndMigrateCaseRecord(JSON.stringify({ ...legacyRecord, schemaVersion: 0 }))).toMatchObject({ ok: true, value: { schemaVersion: 3, prediction: '' } });
        expect(parseAndMigrateCaseRecord('{')).toMatchObject({ ok: false, error: { code: 'invalid-import' } });
        expect(parseAndMigrateCaseRecord(JSON.stringify({ ...legacyRecord, schemaVersion: 1 }))).toMatchObject({ ok: true, value: { schemaVersion: 3, prediction: '' } });
        const v2 = { ...validRecord, schemaVersion: 2 };
        delete (v2 as { replay?: unknown }).replay;
        expect(parseAndMigrateCaseRecord(JSON.stringify(v2))).toMatchObject({ ok: true, value: { schemaVersion: 3, replay: { isCounterfactual: false } } });
        expect(parseAndMigrateCaseRecord(JSON.stringify({ ...validRecord, schemaVersion: 4 }))).toMatchObject({ ok: false, error: { code: 'incompatible-record-version' } });
        expect(parseAndMigrateCaseRecord(JSON.stringify({ ...validRecord, schemaVersion: -1 }))).toMatchObject({ ok: false, error: { code: 'invalid-import' } });
        const migratedRecognition = parseAndMigrateCaseRecord(JSON.stringify({ ...validRecord, recognition: {} }));
        expect(migratedRecognition).toMatchObject({ ok: true, value: { recognition: { version: 0, items: [] } } });

        const legacyProgress = parseAndMigrateCaseRecord(JSON.stringify({
            ...legacyRecord,
            schemaVersion: 1,
            phase: 'experiment',
            inspectedSourceIds: ['source-1', 'source-2'],
            recognition: { version: 0, items: [] }
        }));
        expect(legacyProgress).toMatchObject({ ok: true, value: { phase: 'prediction', prediction: '' } });
        if (legacyProgress.ok) {
            const migrated = CaseRecordSchema.parse(legacyProgress.value);
            expect(validateCaseRecordForDefinition(migrated, definition)).toEqual({ ok: true, value: migrated });
        }
    });

    it('creates a frozen restored state only from a definition-compatible record', () => {
        const restored = createAppStateFromCaseRecord(CaseRecordSchema.parse(validRecord), definition);
        expect(restored).toMatchObject({ ok: true, value: { runs: [{ id: 'run-001' }], inspectedSourceIds: ['source-1'] } });
        if (restored.ok) {
            expect(Object.isFrozen(restored.value)).toBe(true);
            expect(Object.isFrozen(restored.value.runs[0])).toBe(true);
            expect(Object.isFrozen(restored.value.runs[0].controls)).toBe(true);
        }
    });

    it('projects and hydrates strict recognition with the portable record', () => {
        const projected = createCaseRecordProjection(createInitialAppState(definition));
        expect(projected).toMatchObject({ ok: true, value: { schemaVersion: 3, prediction: '', recognition: { version: 1 } } });
        if (!projected.ok) return;
        expect(projected.value.recognition.items[0]).toMatchObject({ id: 'source-discipline', achieved: false });
        const restored = createAppStateFromCaseRecord(projected.value, definition);
        expect(restored).toMatchObject({ ok: true, value: { recognition: projected.value.recognition } });
    });

    // --- Rival-lab critique history (Story 2.5) -------------------------------------------------

    const rivalDefinition = {
        ...proposalDefinition,
        version: '1.9.0',
        conclusionProposals: [
            ...(proposalDefinition.conclusionProposals as unknown as Array<Record<string, unknown>>),
            {
                id: 'c-2',
                colleagueId: 'thea-young',
                claim: { en: 'An unbounded conclusion.', fr: 'Une conclusion sans limite.' },
                limitation: { en: 'None.', fr: 'Aucune.' },
                supportPredicate: { kind: 'never' }
            }
        ],
        rivalLab: {
            name: 'Mr. Arthur Bell',
            accentColor: '#8c3b3b',
            critiques: [
                { id: 'critique-c-1', proposalId: 'c-1', line: { en: 'Thin evidence.', fr: 'Preuves minces.' } },
                { id: 'critique-c-2', proposalId: 'c-2', line: { en: 'That reaches too far.', fr: 'Cela va trop loin.' } }
            ]
        }
    } as unknown as CaseDefinition;

    it('round-trips a critique history of IDs and timestamps', () => {
        const critiqueHistory = [
            { proposalId: 'c-2', critiqueId: 'critique-c-2', timestamp: '2026-08-06T12:00:00.000Z' },
            { proposalId: 'c-1', critiqueId: 'critique-c-1', timestamp: '2026-08-06T12:05:00.000Z' }
        ];
        const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: '1.9.0', critiqueHistory });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        const validated = validateCaseRecordForDefinition(parsed.data, rivalDefinition);

        expect(validated).toMatchObject({ ok: true });
        if (!validated.ok) return;
        expect(validated.value.critiqueHistory).toEqual(critiqueHistory);
        // Never the prose: only what a rewritten critique cannot invalidate.
        expect(JSON.stringify(validated.value.critiqueHistory)).not.toMatch(/Thin evidence|Preuves minces/);

        const restored = createAppStateFromCaseRecord(validated.value, rivalDefinition);
        expect(restored).toMatchObject({ ok: true, value: { critiqueHistory } });
    });

    it.each([
        ['an unauthored critique ID', [{ proposalId: 'c-1', critiqueId: 'critique-invented', timestamp: '2026-08-06T12:00:00.000Z' }]],
        ['a critique answering a different proposal than the entry claims',
            [{ proposalId: 'c-1', critiqueId: 'critique-c-2', timestamp: '2026-08-06T12:00:00.000Z' }]],
        ['an unauthored proposal ID', [{ proposalId: 'c-invented', critiqueId: 'critique-c-1', timestamp: '2026-08-06T12:00:00.000Z' }]],
        ['out-of-order timestamps', [
            { proposalId: 'c-1', critiqueId: 'critique-c-1', timestamp: '2026-08-06T12:05:00.000Z' },
            { proposalId: 'c-2', critiqueId: 'critique-c-2', timestamp: '2026-08-06T12:00:00.000Z' }
        ]],
        ['repeated timestamps', [
            { proposalId: 'c-1', critiqueId: 'critique-c-1', timestamp: '2026-08-06T12:00:00.000Z' },
            { proposalId: 'c-2', critiqueId: 'critique-c-2', timestamp: '2026-08-06T12:00:00.000Z' }
        ]]
    ])('rejects a critique history carrying %s', (_description, critiqueHistory) => {
        const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: '1.9.0', critiqueHistory });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(validateCaseRecordForDefinition(parsed.data, rivalDefinition))
            .toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
    });

    it('rejects a critique entry carrying the authored prose alongside its IDs', () => {
        expect(CaseRecordSchema.safeParse({
            ...validRecord,
            critiqueHistory: [{ proposalId: 'c-1', critiqueId: 'critique-c-1', timestamp: '2026-08-06T12:00:00.000Z', line: 'Thin evidence.' }]
        })).toMatchObject({ success: false });
    });

    // The rival lab is content, and what a 2.5 record persists is optional — so nothing about the
    // upgrade may cost a player their investigation (NFR12).
    it.each(['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0'])('accepts a %s record with no critique history against the 1.9.0 definition', (recordVersion) => {
        const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: recordVersion });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.critiqueHistory).toBeUndefined();
        expect(validateCaseRecordForDefinition(parsed.data, rivalDefinition)).toMatchObject({ ok: true });
        // A pre-2.5 record hydrates to an empty log rather than an absent field.
        expect(createAppStateFromCaseRecord(parsed.data, rivalDefinition)).toMatchObject({ ok: true, value: { critiqueHistory: [] } });
    });

    // --- AC8: the two persisted shapes Story 3.1 widened -------------------------------------------
    //
    // `caseId` went from `z.literal('young-interference')` to a kebab-case string, and
    // `activeControlValues` from a strict two-key object to `z.record(z.string(), z.number().finite())`.
    // Both are **relaxations**, which is why `schemaVersion` stays 3 and `migrateCaseRecord.ts` is
    // untouched. These tests are what makes "relaxation" a checked claim rather than an assertion in a
    // comment — and the `SignificanceRule` docstring warns that widening `RunControls` would "fail every
    // saved record on load and let autosave overwrite it — a silent progress wipe against NFR12".
    it('still loads a record written in the exact shape older builds saved', () => {
        // Byte-for-byte the pre-3.1 projection: `caseId` the old literal, `activeControlValues` the old
        // two-key object. If this ever fails, a player's saved investigation has been made unloadable.
        const parsed = CaseRecordSchema.safeParse(validRecord);

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.caseId).toBe('young-interference');
        expect(parsed.data.activeControlValues).toEqual({ slitSpacingMm: 0.25, screenDistanceM: 2 });
        expect(validateCaseRecordForDefinition(parsed.data, definition)).toMatchObject({ ok: true });
        expect(parsed.data.schemaVersion).toBe(3);
    });

    it('rejects a record from a different case, which the literal used to do less well than this does', () => {
        // The relaxation does not lose cross-case protection — that protection never lived in the literal.
        // `validateCaseRecordForDefinition` compares `record.caseId` against `definition.id`, which is
        // *stronger*: the literal admitted a Young record while some other case was loaded, and this
        // does not.
        const foreign = CaseRecordSchema.parse({ ...validRecord, caseId: 'morley-drift-bench' });

        expect(validateCaseRecordForDefinition(foreign, definition))
            .toMatchObject({ ok: false, error: { code: 'incompatible-case-record' } });
    });

    it('accepts a record for a second case when that second case is the one loaded', () => {
        // The other half, and the point of the story: the same record and definition that were rejected
        // above are accepted when they agree. Without this, the test above would also pass against a
        // schema that simply rejected every non-Young ID.
        const secondCase = {
            ...definition,
            id: 'morley-drift-bench',
            apparatus: { primaryControls: [
                { id: 'rotationDeg', label: { en: 'Bench rotation', fr: 'Rotation du banc' }, unit: '°', min: 0, max: 90, step: 15, defaultValue: 45 }
            ] },
            significanceRule: { criticalControlIds: ['rotationDeg'] }
        } as CaseDefinition;
        const record = CaseRecordSchema.parse({
            ...validRecord,
            caseId: 'morley-drift-bench',
            activeControlValues: { rotationDeg: 45 },
            runs: [{
                id: 'run-001', caseId: 'morley-drift-bench', controls: { rotationDeg: 45 },
                result: { label: 'Observation', value: 1, unit: 'relative units' }, timestamp: '2026-08-05T10:00:00.000Z',
                experimentModelVersion: 'young-v1', linkedEvidenceIds: ['source-1']
            }],
            comparison: { selectedRunIds: ['run-001'], notes: [] },
            theory: { selectedRunIds: ['run-001'], selectedSourceIds: ['source-1'], conclusion: 'A bounded conclusion.', limitation: 'A limitation.' }
        });

        expect(validateCaseRecordForDefinition(record, secondCase)).toMatchObject({ ok: true });
    });

    it.each([
        ['a control value off its authored step', { slitSpacingMm: 0.27, screenDistanceM: 2 }],
        ['a control value outside its authored range', { slitSpacingMm: 0.25, screenDistanceM: 9 }],
        ['a control the case does not author', { slitSpacingMm: 0.25, wanderingControl: 2 }],
        ['a missing authored control', { slitSpacingMm: 0.25 }]
    ])('still rejects %s, now against the case’s own control set', (_description, activeControlValues) => {
        // The exact-key and in-bounds guarantees the `.strict()` two-key object held. They did not move
        // to nowhere: the loop in `validateCaseRecordForDefinition` iterates
        // `definition.apparatus.primaryControls` and normalises each value against its authored control,
        // which is the same guarantee stated against the *case's* controls rather than against Young's.
        const record = CaseRecordSchema.parse({ ...validRecord, activeControlValues });

        expect(validateCaseRecordForDefinition(record, definition))
            .toMatchObject({ ok: false, error: { code: 'invalid-case-record' } });
    });

    it('rejects a non-kebab-case caseId, which is not a directory name any case could load from', () => {
        expect(CaseRecordSchema.safeParse({ ...validRecord, caseId: 'Young Interference' })).toMatchObject({ success: false });
        expect(CaseRecordSchema.safeParse({ ...validRecord, caseId: '../escape' })).toMatchObject({ success: false });
    });

    it('infers a string-keyed record for activeControlValues rather than a complete one', () => {
        // The Zod 4 trap this story's notes call out: `z.record` with an *enum* key yields a record
        // requiring every member, and would have made a one-control case unparseable. Proved by reading a
        // key the type could not know, which only compiles under `Record<string, number>`.
        const parsed = CaseRecordSchema.parse({ ...validRecord, activeControlValues: { slitSpacingMm: 0.25, screenDistanceM: 2 } });
        const readByUnknownKey: number | undefined = parsed.activeControlValues['someLaterCaseControl'];

        expect(readByUnknownKey).toBeUndefined();
    });

    it('keeps every saved definition version loadable against 1.17.0', () => {
        // NFR12. Story 3.1 adds `autoSummary` and re-words one consultation rule; neither is a field any
        // record carries, so no saved investigation may be refused by the bump.
        const current = { ...definition, version: '1.17.0' } as CaseDefinition;

        ['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0',
            '1.11.0', '1.12.0', '1.13.0', '1.14.0', '1.15.0', '1.16.0'].forEach((saved) => {
            const parsed = CaseRecordSchema.safeParse({ ...validRecord, caseDefinitionVersion: saved });
            expect(parsed.success).toBe(true);
            if (!parsed.success) return;
            expect(validateCaseRecordForDefinition(parsed.data, current), saved).toMatchObject({ ok: true });
        });
    });

    it('only replaces store state through record validation and serializes progress operations', () => {
        const store = createStore(createInitialAppState(definition));
        const mismatch = CaseRecordSchema.parse({ ...validRecord, caseDefinitionVersion: '2.0.0' });
        expect(store.replaceWithValidatedRecord(mismatch)).toMatchObject({ ok: false, error: { code: 'incompatible-case-record' } });
        expect(store.getState().phase).toBe('context');

        const lock = store.acquireExclusiveOperation();
        expect(lock.ok).toBe(true);
        if (!lock.ok) return;
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' })).toMatchObject({ ok: false, error: { code: 'progress-operation-active' } });
        lock.value();
        expect(store.dispatch({ type: 'case.phaseAdvance', nextPhase: 'prediction' })).toMatchObject({ ok: false, error: { code: 'missing-contextual-sources' } });
    });
});
