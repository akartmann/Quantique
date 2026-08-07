import { z } from 'zod';

import type { Result } from '../core/errors/Result';
import { normalizeControlValue } from '../domain/apparatus/ApparatusControl';
import { calculateYoungFringeSpacing } from '../domain/apparatus/calculateYoungFringeSpacing';
import { isSourceEligibleForInspection, type CaseDefinition } from '../domain/cases/CaseDefinition';
import { CASE_PHASES } from '../domain/cases/CaseProgress';
import { createRunRecord } from '../domain/evidence/RunRecord';
import { evaluateConclusionReadiness } from '../domain/theory/conclusionReadiness';
import { evaluatePeerReview } from '../domain/review/peerReviewRules';
import { deriveRecognition, RECOGNITION_IDS, recognitionDefinitions } from '../domain/recognition/recognitionRules';
import { migrateCaseRecord } from './migrations/migrateCaseRecord';
import { evaluateContextReadiness, evaluatePredictionReadiness } from '../domain/cases/contextPredictionReadiness';

const text = z.string().trim().min(1);
const timestamp = z.string().refine((value) => {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}, 'Expected an ISO UTC timestamp.');
const unique = <T>(values: readonly T[]): boolean => new Set(values).size === values.length;

const RunRecordSchema = z.object({
    id: text,
    caseId: text,
    controls: z.object({ slitSpacingMm: z.number().finite(), screenDistanceM: z.number().finite() }).strict(),
    modelInputs: z.object({
        slitSpacingMm: z.number().finite(),
        screenDistanceM: z.number().finite(),
        wavelengthNm: z.union([z.literal(450), z.literal(550), z.literal(650)]),
        wavelengthMode: z.enum(['minimum', 'advanced'])
    }).strict().optional(),
    result: z.object({ label: text, value: z.number().finite(), unit: text }).strict(),
    timestamp,
    experimentModelVersion: text,
    linkedEvidenceIds: z.array(text)
}).strict();

const PeerReviewSchema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('unavailable'), message: text }).strict(),
    z.object({
        status: z.literal('reviewed'),
        issues: z.array(z.object({
            code: z.enum(['missing-evidence', 'unsupported-support', 'overreach']),
            ruleId: text,
            feedback: text,
            revisionPath: text
        }).strict())
    }).strict()
]);

const DecisionHistoryEntrySchema = z.object({
    version: z.number().int().positive(),
    priorConclusion: z.string(),
    conclusion: z.string(),
    limitation: z.string(),
    // Optional additive, so `schemaVersion` stays 3: a pre-1.11 revision simply omits it. It is
    // deliberately *not* revalidated against the current authored claim — a history entry is a
    // historical snapshot, and demanding it still match today's copy would recreate the very
    // brittleness the sanitization below removes.
    conclusionProposalId: text.optional(),
    selectedRunIds: z.array(text),
    selectedSourceIds: z.array(text),
    feedback: PeerReviewSchema,
    timestamp
}).strict();

/**
 * A rival-lab challenge, as **IDs and a timestamp only**.
 *
 * The critique's prose is deliberately absent. `PeerReviewIssue` persists authored English feedback
 * into `DecisionHistoryEntry`, and `validateCaseRecordForDefinition` recomputes it and
 * `JSON.stringify`-compares it on every load — so one copy edit to an authored feedback string
 * silently invalidates every record ever saved. Nothing here inherits that: the line is resolved from
 * `case.json` at display time, and an author may rewrite a critique freely.
 */
const RivalLabCritiqueEntrySchema = z.object({
    proposalId: text,
    critiqueId: text,
    timestamp
}).strict();

const recognitionDefinitionById = new Map(recognitionDefinitions().map((item) => [item.id, item]));
const RecognitionItemSchema = z.object({
    id: z.enum(RECOGNITION_IDS),
    label: text,
    description: text,
    achieved: z.boolean()
}).strict();

const CurrentRecognitionSchema = z.object({
    version: z.literal(1),
    items: z.array(RecognitionItemSchema).length(RECOGNITION_IDS.length)
}).strict().superRefine((recognition, context) => {
    const ids = recognition.items.map(({ id }) => id);
    if (new Set(ids).size !== ids.length || RECOGNITION_IDS.some((id) => !ids.includes(id))) {
        context.addIssue({ code: 'custom', message: 'Recognition items must include each stable recognition ID once.' });
        return;
    }
    recognition.items.forEach((item) => {
        const expected = recognitionDefinitionById.get(item.id);
        if (!expected || item.label !== expected.label || item.description !== expected.description) {
            context.addIssue({ code: 'custom', message: 'Recognition labels and descriptions must match the authored contract.' });
        }
    });
});

/** Legacy marker is emitted only by explicit migration and is canonicalized on the next projection. */
const RecognitionSchema = z.discriminatedUnion('version', [
    z.object({ version: z.literal(0), items: z.tuple([]) }).strict(),
    CurrentRecognitionSchema
]);

export const CaseRecordSchema = z.object({
    schemaVersion: z.literal(3),
    caseId: z.literal('young-interference'),
    caseDefinitionVersion: text,
    phase: z.enum(CASE_PHASES),
    activeControlValues: z.object({ slitSpacingMm: z.number().finite(), screenDistanceM: z.number().finite() }).strict(),
    selectedWavelengthNm: z.union([z.literal(450), z.literal(550), z.literal(650)]).optional(),
    selectedWavelengthMode: z.enum(['minimum', 'advanced']).optional(),
    inspectedSourceIds: z.array(text),
    prediction: z.string().refine((value) => value === value.trim(), 'Prediction must be trimmed.'),
    // Optional additive fields, so `schemaVersion` stays 3 and `migrateCaseRecord` is untouched —
    // the same precedent as `selectedWavelengthNm` above. A pre-1.11 record simply omits them.
    selectedPredictionProposalId: text.optional(),
    selectedConclusionProposalId: text.optional(),
    runs: z.array(RunRecordSchema),
    comparison: z.object({
        selectedRunIds: z.array(text).max(2),
        notes: z.array(z.object({ runIds: z.tuple([text, text]), text }).strict())
    }).strict(),
    theory: z.object({ selectedRunIds: z.array(text), selectedSourceIds: z.array(text), conclusion: z.string(), limitation: z.string() }).strict(),
    // Optional additive again, so `schemaVersion` stays 3 and `migrateCaseRecord` is untouched: a
    // pre-2.5 record simply omits it, exactly as a pre-1.11 one omits the proposal IDs above.
    critiqueHistory: z.array(RivalLabCritiqueEntrySchema).optional(),
    decisionHistory: z.array(DecisionHistoryEntrySchema),
    completion: z.object({
        completedAt: timestamp,
        finalDecision: DecisionHistoryEntrySchema,
        decisionHistory: z.array(DecisionHistoryEntrySchema).min(1),
        runs: z.array(RunRecordSchema),
        inspectedSourceIds: z.array(text),
        comparison: z.object({
            selectedRunIds: z.array(text).max(2),
            notes: z.array(z.object({ runIds: z.tuple([text, text]), text }).strict())
        }).strict(),
        critiqueHistory: z.array(RivalLabCritiqueEntrySchema).optional(),
        recognition: RecognitionSchema
    }).strict().optional(),
    replay: z.object({ isCounterfactual: z.boolean() }).strict(),
    recognition: RecognitionSchema
}).strict();

export type CaseRecord = z.infer<typeof CaseRecordSchema>;

const failure = (code: 'invalid-import' | 'invalid-case-record' | 'incompatible-case-record', message: string): Result<never> => ({
    ok: false,
    error: { code, message }
});

const validIds = (values: readonly string[], available: ReadonlySet<string>): boolean => unique(values) && values.every((value) => available.has(value));

/**
 * Checks a persisted challenge log by **lookup only**: the proposal is authored, the critique is
 * authored *and answers that proposal*, and the log is in order.
 *
 * That is the whole contract, and the restraint is the point. Recomputing which conclusions were
 * defensible at the moment of each submission would need evidence this record no longer distinguishes
 * by time, and recomputing-and-comparing the authored prose is precisely the `peerReviewRules` trap
 * that makes a copy edit reject every saved investigation.
 */
const validCritiqueHistory = (
    entries: readonly { proposalId: string; critiqueId: string; timestamp: string }[] | undefined,
    definition: CaseDefinition
): boolean => {
    // An absent or empty log needs no authored content consulted at all, which is also what keeps this
    // off the hot path of every ordinary load.
    if (!entries || entries.length === 0) return true;
    const conclusionIds = new Set(definition.conclusionProposals.map(({ id }) => id));
    const critiques = new Map(definition.rivalLab.critiques.map((critique) => [critique.id, critique]));
    let previousTimestamp = '';
    return entries.every((entry) => {
        const critique = critiques.get(entry.critiqueId);
        const ordered = !previousTimestamp || entry.timestamp > previousTimestamp;
        previousTimestamp = entry.timestamp;
        return conclusionIds.has(entry.proposalId) && critique?.proposalId === entry.proposalId && ordered;
    });
};

/** Revalidates untrusted progress against the immutable definition already loaded by the app. */
export const validateCaseRecordForDefinition = (record: CaseRecord, definition: CaseDefinition): Result<CaseRecord> => {
    // Case-definition versions whose *progress-bearing* contract is unchanged, so a record saved
    // against the older version still validates. 1.5.0 added `fr` to authored display text, 1.6.0
    // added a French rendition of the archival pages, 1.7.0 added the colleague cast and the two
    // proposal sets, and 1.8.0 gave scenario scenes authored dialogue beats — no run, decision, or
    // recognition value moved in any of them, the proposal IDs a 1.7.0 record can carry are optional,
    // and nothing about reading a beat is persisted at all. Rejecting the older versions here would
    // discard every saved investigation on upgrade (NFR12).
    const compatibleDefinitionVersion = record.caseDefinitionVersion === definition.version
        || (definition.version === '1.2.0' && ['1.0.0', '1.1.0'].includes(record.caseDefinitionVersion))
        || (definition.version === '1.6.0' && ['1.2.0', '1.3.0', '1.4.0', '1.5.0'].includes(record.caseDefinitionVersion))
        || (definition.version === '1.7.0' && ['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0'].includes(record.caseDefinitionVersion))
        || (definition.version === '1.8.0' && ['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0'].includes(record.caseDefinitionVersion))
        // 1.9.0 added the rival lab and its critiques. The allowlist rests on the assumption that the
        // canonical English strings a record *recomputes and compares* are byte-identical across the
        // listed versions — `feedback` and `revisionPath` from `peerReviewRules`, and the proposal
        // claims and limitations. Story 2.5 changed none of them: it only added content, and what
        // `critiqueHistory` persists is IDs, which are checked by lookup rather than by comparison.
        || (definition.version === '1.9.0' && ['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0'].includes(record.caseDefinitionVersion))
        // 1.10.0 added `significanceRule`, `colleagueHints`, and `requirements.minimumSignificantRuns`.
        // Additive again, on the same terms: no run, decision, or recognition value moved, and the
        // canonical English strings this function recomputes and compares — `peerReviewRules`'
        // `feedback` and `revisionPath`, and the proposal claims and limitations — are byte-identical
        // to 1.9.0.
        //
        // Worth stating plainly, because this bump raises a question the earlier ones did not: a
        // pre-1.10.0 record can be sitting at `synthesis` on evidence the new gate would have
        // refused, because no gate existed when it was saved. That is fine and must stay fine. The
        // gate runs on the `experiment → synthesis` transition only, so a record already past it is
        // never re-tested, and choose / submit / review / revise / complete are all untouched by
        // Story 2.6. Rejecting those records instead would discard saved investigations (NFR12), and
        // gating the conclusion choice to "fix" them would strand the player with no route back to
        // the apparatus — the phase machine is one-way.
        || (definition.version === '1.10.0' && ['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0'].includes(record.caseDefinitionVersion))
        // 1.11.0 reworked the significance rule in review: `minimumResultDelta` was removed because it
        // made the count depend on recording order, and `criticalModelInputIds` was added so a
        // wavelength change counts as the distinguishing measurement it physically is. Additive on the
        // same terms — no run, decision, or recognition value moved, and the canonical English strings
        // this function recomputes and compares are byte-identical to 1.10.0.
        //
        // The gate is *stricter* under 1.11.0 than under 1.10.0 for exactly one shape of evidence: two
        // runs at one arrangement but different wavelengths used to count 1 and now count 2, which is
        // looser, not stricter — nothing that counted before counts for less. So no saved record can
        // be retroactively short of a bar it already cleared, and the 1.10.0 note above continues to
        // hold unchanged for everything at or past `synthesis`.
        || (definition.version === '1.11.0' && ['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0'].includes(record.caseDefinitionVersion))
        // 1.12.0 added `readingGateHints` — the in-fiction lines the reading room answers its gate with
        // (Story 2.8). Purely additive, and **not progress-bearing**: a line is authored prose selected
        // at display time from `inspectedSourceIds`, nothing about it is persisted, no record field
        // references one, and no reducer reads the collection. The canonical English strings this
        // function recomputes and compares — `peerReviewRules`' `feedback` and `revisionPath`, and the
        // proposal claims and limitations — are byte-identical to 1.11.0.
        //
        // The gate itself is older than the lines: `missing-contextual-sources` has refused the
        // `context → prediction` advance since 1.2.0, against `inspectedSourceIds`, which every listed
        // version already persists. So a record restored from any of them meets exactly the gate it
        // met before; 1.12.0 only changes what the refusal *says*.
        || (definition.version === '1.12.0' && ['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0', '1.11.0'].includes(record.caseDefinitionVersion));
    if (record.caseId !== definition.id || !compatibleDefinitionVersion) {
        return failure('incompatible-case-record', 'This progress record is for a different version of this investigation. Your current work is unchanged.');
    }

    for (const control of definition.apparatus.primaryControls) {
        const value = record.activeControlValues[control.id];
        const normalized = normalizeControlValue(control, value);
        if (!normalized.ok || normalized.value !== value) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
    }

    const sources = new Map(definition.contextualArtifacts.map((source) => [source.id, source]));
    if (!validIds(record.inspectedSourceIds, new Set(sources.keys()))
        || record.inspectedSourceIds.some((sourceId) => !isSourceEligibleForInspection(sources.get(sourceId)!))) {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    // A proposal ID is a claim about where the text came from, so it must not outlive the text it
    // describes: a record naming `conclusion-spacing-varies` while carrying a hand-edited conclusion
    // would attribute someone else's words to a colleague.
    //
    // But the repair is to drop the claim, not to discard the investigation. The ordinary cause of a
    // mismatch is an authored copy edit, and the compatibility allowlist above exists precisely so
    // authors can change display text without costing players their work (NFR12) — while
    // `CaseProgressPanel` autosaves on the first dispatch of the recovered session, so a rejection
    // here does not merely refuse the record, it overwrites it. An ID naming a proposal that does not
    // exist at all is a different matter: that record describes content this build cannot render.
    let sanitized = record;
    if (record.selectedPredictionProposalId !== undefined) {
        const proposal = definition.predictionProposals.find(({ id }) => id === record.selectedPredictionProposalId);
        if (!proposal) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        if (proposal.text.en !== record.prediction) {
            sanitized = { ...sanitized, selectedPredictionProposalId: undefined };
        }
    }
    if (record.selectedConclusionProposalId !== undefined) {
        const proposal = definition.conclusionProposals.find(({ id }) => id === record.selectedConclusionProposalId);
        if (!proposal) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        if (proposal.claim.en !== record.theory.conclusion || proposal.limitation.en !== record.theory.limitation) {
            sanitized = { ...sanitized, selectedConclusionProposalId: undefined };
        }
    }

    if (record.phase !== 'context' && evaluateContextReadiness(definition, record.inspectedSourceIds).status !== 'ready') {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }
    if (['experiment', 'synthesis', 'review', 'debrief'].includes(record.phase)
        && evaluatePredictionReadiness(definition, record.prediction).status !== 'ready') {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    const runIds: string[] = [];
    for (const run of record.runs) {
        const validatedRun = createRunRecord(run, runIds);
        if (!validatedRun.ok || validatedRun.value.caseId !== definition.id
            || validatedRun.value.experimentModelVersion !== definition.experiment.modelVersion
            || !validatedRun.value.linkedEvidenceIds.every((sourceId) => record.inspectedSourceIds.includes(sourceId))
            || definition.apparatus.primaryControls.some((control) => {
                const normalized = normalizeControlValue(control, validatedRun.value.controls[control.id]);
                return !normalized.ok || normalized.value !== validatedRun.value.controls[control.id];
            })) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        const modelInputs = validatedRun.value.modelInputs;
        const calculated = modelInputs && calculateYoungFringeSpacing(modelInputs);
        if (modelInputs && (modelInputs.slitSpacingMm !== validatedRun.value.controls.slitSpacingMm
            || modelInputs.screenDistanceM !== validatedRun.value.controls.screenDistanceM
            || (modelInputs.wavelengthMode === 'minimum' && modelInputs.wavelengthNm !== 550)
            || (modelInputs.wavelengthMode === 'advanced' && !definition.experiment.wavelengthComparison?.advancedChoicesNm.includes(modelInputs.wavelengthNm as 450 | 650))
            || !calculated?.ok
            || calculated.value.label !== validatedRun.value.result.label
            || calculated.value.value !== validatedRun.value.result.value
            || calculated.value.unit !== validatedRun.value.result.unit)) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        runIds.push(validatedRun.value.id);
    }

    const selectedWavelengthMode = record.selectedWavelengthMode ?? 'minimum';
    const selectedWavelengthNm = record.selectedWavelengthNm ?? 550;
    const fixedMinimumRunCount = record.runs.filter((run) =>
        run.modelInputs?.wavelengthMode === 'minimum' && run.modelInputs.wavelengthNm === 550
    ).length;
    if ((selectedWavelengthMode === 'minimum' && selectedWavelengthNm !== 550)
        || (selectedWavelengthMode === 'advanced'
            && (!definition.experiment.wavelengthComparison?.advancedChoicesNm.includes(selectedWavelengthNm as 450 | 650)
                || fixedMinimumRunCount < definition.requirements.minimumRuns))) {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    const knownRunIds = new Set(runIds);
    if (!validIds(record.comparison.selectedRunIds, knownRunIds)
        || !record.comparison.notes.every((note) => note.runIds[0] !== note.runIds[1]
            && validIds(note.runIds, knownRunIds) && note.text.trim().length > 0)
        || new Set(record.comparison.notes.map((note) => JSON.stringify([...note.runIds].sort()))).size !== record.comparison.notes.length
        || !validIds(record.theory.selectedRunIds, knownRunIds)
        || !validIds(record.theory.selectedSourceIds, new Set(record.inspectedSourceIds))) {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    if (!validCritiqueHistory(record.critiqueHistory, definition)) {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    let previousTimestamp = '';
    let previousConclusion = '';
    for (let index = 0; index < record.decisionHistory.length; index += 1) {
        const entry = record.decisionHistory[index];
        if (entry.version !== index + 1 || !validIds(entry.selectedRunIds, knownRunIds)
            || !validIds(entry.selectedSourceIds, new Set(record.inspectedSourceIds))
            || !entry.conclusion.trim() || !entry.limitation.trim()
            || entry.priorConclusion !== previousConclusion
            || (previousTimestamp && entry.timestamp <= previousTimestamp)) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        const feedback = evaluatePeerReview(definition, {
            runs: record.runs,
            inspectedSourceIds: record.inspectedSourceIds
        }, {
            selectedRunIds: entry.selectedRunIds,
            selectedSourceIds: entry.selectedSourceIds,
            conclusion: entry.conclusion,
            limitation: entry.limitation
        });
        if (feedback.status !== 'reviewed' || entry.feedback.status !== 'reviewed'
            || JSON.stringify(feedback.issues) !== JSON.stringify(entry.feedback.issues)) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        previousTimestamp = entry.timestamp;
        previousConclusion = entry.conclusion;
    }

    if ((record.phase === 'review' || record.phase === 'debrief') && evaluateConclusionReadiness(definition, {
        runs: record.runs,
        inspectedSourceIds: record.inspectedSourceIds,
        comparisonNotes: record.comparison.notes
    }, record.theory).status !== 'ready') {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    if (record.completion) {
        const completion = record.completion;
        if (!isTimestampAfterHistory(completion.completedAt, completion.decisionHistory)
            || completion.finalDecision.version !== completion.decisionHistory.length
            || JSON.stringify(completion.finalDecision) !== JSON.stringify(completion.decisionHistory[completion.decisionHistory.length - 1])
            || !validIds(completion.inspectedSourceIds, new Set(sources.keys()))
            || !completion.inspectedSourceIds.every((sourceId) => isSourceEligibleForInspection(sources.get(sourceId)!))
            || !validCritiqueHistory(completion.critiqueHistory, definition)
            || completion.recognition.version !== 1) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        const completionRuns = new Map(completion.runs.map((run) => [run.id, run]));
        let priorRunTimestamp = '';
        let fixedMinimumRunCount = 0;
        const validCompletionRuns = completion.runs.every((run) => {
            const parsedRun = createRunRecord(run);
            if (!parsedRun.ok || !parsedRun.value.modelInputs
                || parsedRun.value.caseId !== definition.id
                || parsedRun.value.experimentModelVersion !== definition.experiment.modelVersion
                || !parsedRun.value.linkedEvidenceIds.every((sourceId) => completion.inspectedSourceIds.includes(sourceId))
                || parsedRun.value.modelInputs.slitSpacingMm !== parsedRun.value.controls.slitSpacingMm
                || parsedRun.value.modelInputs.screenDistanceM !== parsedRun.value.controls.screenDistanceM
                || (parsedRun.value.modelInputs.wavelengthMode === 'advanced'
                    && (!definition.experiment.wavelengthComparison?.advancedChoicesNm.includes(parsedRun.value.modelInputs.wavelengthNm as 450 | 650)
                        || fixedMinimumRunCount < definition.requirements.minimumRuns))
                || definition.apparatus.primaryControls.some((control) => {
                    const normalized = normalizeControlValue(control, parsedRun.value.controls[control.id]);
                    return !normalized.ok || normalized.value !== parsedRun.value.controls[control.id];
                })) return false;
            const calculated = calculateYoungFringeSpacing(parsedRun.value.modelInputs);
            const validResult = calculated.ok && calculated.value.label === parsedRun.value.result.label
                && calculated.value.value === parsedRun.value.result.value && calculated.value.unit === parsedRun.value.result.unit;
            const chronological = !priorRunTimestamp || parsedRun.value.timestamp >= priorRunTimestamp;
            priorRunTimestamp = parsedRun.value.timestamp;
            if (parsedRun.value.modelInputs.wavelengthMode === 'minimum' && parsedRun.value.modelInputs.wavelengthNm === 550) fixedMinimumRunCount += 1;
            return validResult && chronological;
        });
        const validCompletionHistory = completion.decisionHistory.every((entry, index) => {
            const prior = completion.decisionHistory[index - 1];
            const feedback = evaluatePeerReview(definition, { runs: completion.runs, inspectedSourceIds: completion.inspectedSourceIds }, entry);
            return (!prior || entry.timestamp > prior.timestamp)
                && entry.version === index + 1
                && (index === 0 ? entry.priorConclusion === '' : entry.priorConclusion === prior.conclusion)
                && feedback.status === 'reviewed' && entry.feedback.status === 'reviewed'
                && JSON.stringify(feedback.issues) === JSON.stringify(entry.feedback.issues);
        });
        const derivedCompletionRecognition = deriveRecognition(definition, completion);
        if (completionRuns.size !== completion.runs.length || !validCompletionRuns || !validCompletionHistory
            || !completion.decisionHistory.every((entry) => validIds(entry.selectedRunIds, new Set(completionRuns.keys())) && validIds(entry.selectedSourceIds, new Set(completion.inspectedSourceIds)))
            || !completion.comparison.notes.some((note) => note.runIds.includes(completion.finalDecision.selectedRunIds[0]!) && note.runIds.includes(completion.finalDecision.selectedRunIds[1]!))
            || completion.recognition.items.some((item) => item.achieved !== derivedCompletionRecognition.items.find(({ id }) => id === item.id)?.achieved)) {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
        const completionReadiness = evaluateConclusionReadiness(definition, { runs: completion.runs, inspectedSourceIds: completion.inspectedSourceIds, comparisonNotes: completion.comparison.notes }, completion.finalDecision);
        if (completionReadiness.status !== 'ready') {
            return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
        }
    } else if (record.phase === 'debrief' || record.replay.isCounterfactual) {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    const derivedRecognition = deriveRecognition(definition, record);
    if (record.recognition.version === 1 && record.recognition.items.some((item) =>
        item.achieved !== derivedRecognition.items.find(({ id }) => id === item.id)?.achieved)) {
        return failure('invalid-case-record', 'This progress record could not be used. Your current work is unchanged.');
    }

    // `sanitized`, not `record`: a stale proposal ID was dropped above rather than costing the player
    // the whole investigation.
    return { ok: true, value: sanitized };
};

const isTimestampAfterHistory = (completedAt: string, history: readonly { timestamp: string }[]): boolean => !history.length || completedAt >= history[history.length - 1]!.timestamp;

/** Parses a selected JSON payload, migrates a supported record, and validates the current schema again. */
export const parseAndMigrateCaseRecord = (json: string): Result<CaseRecord> => {
    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(json) as unknown;
    } catch {
        return failure('invalid-import', 'This progress record could not be used. Your current work is unchanged.');
    }

    return migrateAndValidateCaseRecord(parsedJson);
};

/** Applies the supported migration boundary to already-decoded untrusted data. */
export const migrateAndValidateCaseRecord = (input: unknown): Result<CaseRecord> => {
    const migrated = migrateCaseRecord(input);
    if (!migrated.ok) return migrated;
    const parsed = CaseRecordSchema.safeParse(migrated.value);
    return parsed.success
        ? { ok: true, value: parsed.data }
        : failure('invalid-import', 'This progress record could not be used. Your current work is unchanged.');
};
