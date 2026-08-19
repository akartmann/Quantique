import { z } from 'zod';

import { DEFAULT_LOCALE, LOCALES } from '../core/i18n/Locale';
import { CONTROL_AFFORDANCES } from '../domain/cases/CaseDefinition';
import { CASE_PHASES } from '../domain/cases/CaseProgress';
import { unfillableTemplateTokens } from '../domain/evidence/caseSummary';
import { FIGURE_STAGING_SCENE_KEYS, SCENE_KEYS, stagesFigureColumn } from '../domain/cases/ScenarioScript';
import { EXPERIMENT_MODEL_IDS, resolveExperimentModel } from '../domain/apparatus/experimentModels';

const stableId = z.string().trim().min(1);
const sourceRef = z.string().trim().min(1);

/**
 * A case identity. Kebab-case because a case ID is also its directory name under `public/cases/`
 * and every asset path beneath it (the project's naming convention), so a case whose ID could not
 * be a path segment would be unloadable content that validated.
 *
 * Exported so `CaseRecordSchema` validates a persisted `caseId` against **this** rule rather than a
 * second copy of the pattern. The two must not drift: a record whose `caseId` the definition schema
 * would reject is a record naming a case that can never load.
 */
export const CaseIdSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'A case ID must be kebab-case.');

/**
 * The Young case's own ID, and the key of the case-scoped refinement branch at the foot of this file.
 *
 * Story 3.1 replaced `id: z.literal('young-interference')` with {@link CaseIdSchema} so a second case
 * can parse at all. FR7's exact Young bounds did not become optional in the process — they moved from
 * the shared shape into a branch that runs only for this ID. The constant is exported so a test can
 * assert the branch fires for it and does not fire for anything else, rather than repeating the string.
 */
export const YOUNG_CASE_ID = 'young-interference';

/** The Morley–Miller prototype's ID (Story 3.2). Real content under `public/cases/`, not a fixture. */
export const MORLEY_MILLER_CASE_ID = 'morley-miller';

/**
 * Every case this build ships, and the allowlist the review route resolves `?case=` against.
 *
 * An allowlist rather than a passthrough: `loadCaseDefinition` builds a `contentPath` from the ID it is
 * given, so a reviewer-supplied string reaching it would be a fetch composed from user input. Nothing
 * here is campaign order — Story 4.1 owns that, and FR2 puts Morley–Miller *before* Young — and nothing
 * here is a picker. It is the set of IDs that name a directory under `public/cases/`.
 */
export const KNOWN_CASE_IDS = [YOUNG_CASE_ID, MORLEY_MILLER_CASE_ID] as const;

/**
 * The most primary controls a case may author, and the reason it is a schema rule rather than a
 * renderer clamp.
 *
 * `ApparatusRenderer` gives each control an instrument slot at
 * `BENCH_LEFT + index * (INSTRUMENT_SLOT_WIDTH + INSTRUMENT_SLOT_GAP)` — 40, 222, 404 … with a slot
 * 168 wide. Slot index 2 therefore spans x 404–572, straight through the wavelength chooser at
 * x 410–660, and nothing in the renderer clamps it: a third authored control silently draws two
 * interactive surfaces on top of each other.
 *
 * Before this story the collision was unreachable because `primaryControls` was a two-member
 * `z.tuple`. Relaxing the tuple to an array to unblock a second case would have opened it, so the
 * ceiling the tuple was holding is re-stated here explicitly. Raising it is renderer work
 * (`deferred-work.md:100`), not authoring work.
 *
 * Exported so `ApparatusGeometry.test.ts` can prove the number against the real geometry constants
 * instead of restating 2 — the bound and its justification must fail together.
 */
export const MAX_PRIMARY_CONTROLS = 2;

/**
 * The most contextual artifacts a case may author.
 *
 * Same reasoning as {@link MAX_PRIMARY_CONTROLS}, and the same omission it was written to prevent.
 * `contextualArtifacts` was a `z.tuple([A, A])` before Story 3.1; relaxing it to an array to let a
 * later case cite its own sources removed the only thing keeping a third artifact off a case file
 * that renders exactly `CASE_FILE_SOURCE_ROWS` rows. A third source would be readable, would count
 * toward the reading gate (`evaluateContextReadiness` counts every authored artifact), and could
 * never be pinned as supporting evidence — authored content the player cannot use, and with
 * `minimumSources: 3` an unrecoverable dead end.
 *
 * Raising it is renderer work — the case file, the reading room and the debrief each reserve rows —
 * not authoring work. Exported so `ApparatusGeometry.test.ts` can prove it against the real
 * `CASE_FILE_SOURCE_ROWS`, so the bound and its justification fail together.
 */
export const MAX_CONTEXTUAL_ARTIFACTS = 2;

/**
 * Every localizable authored string must carry both shipped locales (AC3). The requirement lives in
 * the object schema itself rather than in a `superRefine`, because Zod skips refinements once the
 * base parse has failed — a missing `fr` has to be the base-parse failure, not a later one.
 */
export const LocalizedTextSchema = z.object({
    en: z.string().trim().min(1),
    fr: z.string().trim().min(1)
}).strict();

/**
 * The list variant. Equal lengths across locales is a genuine cross-field rule, so it belongs in a
 * refinement: an `assumptions` list with four English entries and three French ones is a content
 * defect, not a translation choice.
 */
export const LocalizedTextListSchema = z.object({
    en: z.array(z.string().trim().min(1)).min(1),
    fr: z.array(z.string().trim().min(1)).min(1)
}).strict().superRefine((list, context) => {
    if (list.en.length !== list.fr.length) {
        context.addIssue({
            code: 'custom',
            message: 'A localized list must provide the same number of entries in every locale.',
            path: ['fr']
        });
    }
});
/**
 * Detection phrases, not display text. Deliberately *not* {@link LocalizedTextListSchema}: that
 * schema's equal-length rule encodes a display correspondence (entry 3 of `assumptions` is the same
 * assumption in either language), and detection phrases have no such correspondence. One English
 * verb can need two French renderings, and French inflects where English does not — `prouve` and
 * `prouvent` are both required, and neither has an English counterpart to pad the list with.
 */
export const DetectionPhraseListSchema = z.object({
    en: z.array(z.string().trim().min(1)).min(1),
    fr: z.array(z.string().trim().min(1)).min(1)
}).strict();

const isOnStep = (value: number, min: number, step: number): boolean =>
    Math.abs((value - min) / step - Math.round((value - min) / step)) < 0.0000001;

const PrimaryControlSchema = z.object({
    // A stable ID, not an enum of Young's two: the control set is authored per case (Story 3.1). Every
    // predicate that names a control is checked against *this case's* authored IDs in the top-level
    // refinement, which is a stronger guarantee than the enum gave — the enum admitted
    // `screenDistanceM` even for a case that authored no such control.
    id: stableId,
    label: LocalizedTextSchema,
    /**
     * The control's name as it reads *inside a sentence*, carrying its own preposition and case.
     *
     * `label` is a display name for an instrument slot — capitalised, standalone ("Slit spacing",
     * "Écartement des fentes"). `lab.idle` and `print.observations.settings` splice a control name into
     * running prose, and interpolating the display name there produced "0,25 mm **de Écartement des
     * fentes**": no elision, wrong article, capital mid-sentence (review 2026-08-19). French elision
     * depends on the following word, so no generic transform can derive this — it is authored, per
     * control, per locale. Required rather than optional-with-fallback: falling back to `label` is
     * precisely the silent degradation that shipped the broken sentence in the first place.
     */
    inlineLabel: LocalizedTextSchema,
    unit: z.string().trim().min(1),
    min: z.number().finite(),
    max: z.number().finite(),
    step: z.number().positive().finite(),
    defaultValue: z.number().finite(),
    /**
     * Which instrument the bench draws (Story 3.4). Optional, and `knob` when absent.
     *
     * `z.enum` over the domain's own exported {@link CONTROL_AFFORDANCES} rather than a list repeated
     * here, so the type and the schema cannot drift — the shape this project has been bitten by often
     * enough to make it a rule.
     *
     * **Optional with no `.default()`**, which is the opposite call to `inlineLabel` above and for the
     * opposite reason. `inlineLabel` is required because falling back to `label` was a *silent*
     * degradation that shipped a broken French sentence; there is no locale hiding in an affordance and
     * `knob` is a real, correct default. A schema `.default('knob')` was still refused: it writes a
     * value into the parsed object the author did not write, so a `.strict()` round-trip of shipped
     * content would stop being faithful. The absence is resolved by `controlAffordance` at the one
     * place that draws.
     *
     * Every other control validation is affordance-independent and must stay that way — the authored
     * range, step and default mean exactly what they meant before (AC3).
     */
    affordance: z.enum(CONTROL_AFFORDANCES).optional()
}).strict().superRefine((control, context) => {
    if (control.max <= control.min) {
        context.addIssue({ code: 'custom', message: 'Control max must be greater than min.', path: ['max'] });
    }

    if (control.defaultValue < control.min || control.defaultValue > control.max || !isOnStep(control.defaultValue, control.min, control.step)) {
        context.addIssue({ code: 'custom', message: 'Control default must be in range and aligned to its step.', path: ['defaultValue'] });
    }
});

const RecoveryRouteSchema = z.enum(['replication', 'control-change', 'source-comparison']);
/**
 * The three artifact-classification enums are exported so `I18n.test.ts` can derive its required
 * `source.*` key roster from them rather than transcribing the members. A hand-copied list is a list
 * that stops being updated: a fourth provenance category would have been added here and not there,
 * and the test would have kept passing while the detail panel rendered a raw enum value.
 */
export const SourceProvenanceCategorySchema = z.enum(['primary-material', 'reconstruction', 'later-interpretation', 'deliberate-fiction']);
export const SourceTypeSchema = z.enum(['lecture-record', 'published-book', 'reconstruction', 'interpretive-essay', 'fictionalized-account']);
export const SourceRightsStatusSchema = z.enum(['reviewed', 'incomplete', 'unavailable']);

/**
 * The two ledger enums, exported for the same reason the three above are: `I18n.test.ts` derives its
 * required `ledger.*` key roster from them rather than transcribing the members. A hand-copied roster
 * is a roster that stops being updated — a fourth reviewer state would be added here and not there,
 * and the test would stay green while the ledger rendered a raw enum value at a reviewer.
 */
export const SourceRoleSchema = z.enum(['primary', 'secondary']);
export const ReviewerStateSchema = z.enum(['reviewed', 'pending', 'de-scoped']);

/**
 * The reviewer states a **row** may occupy — a source's `ledgerEntry` or an asset's `rights`.
 *
 * `de-scoped` is excluded because these two schemas have nowhere to record the decision that de-scoped
 * them. R3 requires a `de-scoped` role to name its own decision and lives on `ReviewerSignOffSchema`,
 * which has a `reference` field to require; neither row schema has one, and both render call sites pass
 * `undefined` for it. The code review found the consequence reachable: a row authored `de-scoped`
 * parsed clean and rendered the bare word, with nothing behind it — precisely the state R3's message
 * calls "indistinguishable from a role that was silently dropped".
 *
 * `ReviewerStateSchema` keeps all three members for the case-level roles, so the derived I18n roster is
 * unchanged and `ledger.reviewer.de-scoped` is still authored and still resolved.
 */
export const RowReviewerStateSchema = z.enum(['reviewed', 'pending']);

/** Canonical: a date of record, not display text. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A sign-off date must be YYYY-MM-DD.');

/**
 * One reviewer role, with R3, R4 and R6 enforced here rather than at the call sites — five roles share
 * this shape and five copies of the same three rules is five places for them to drift apart.
 */
const ReviewerSignOffSchema = z.object({
    state: ReviewerStateSchema,
    // Canonical: a reviewer's name is a proper noun.
    name: z.string().trim().min(1).optional(),
    date: isoDate.optional(),
    // Canonical: the ADR or document of record.
    reference: z.string().trim().min(1).optional()
}).strict().superRefine((signOff, context) => {
    // R6. A sign-off with nobody's name on it is not a sign-off, and a reviewer reading the ledger
    // cannot tell an unattributed `reviewed` from an authoring mistake.
    if (signOff.state === 'reviewed' && (signOff.name === undefined || signOff.date === undefined)) {
        context.addIssue({
            code: 'custom',
            message: 'A reviewed role must record who signed it off and on what date — an unattributed sign-off is not one.',
            path: [signOff.name === undefined ? 'name' : 'date']
        });
    }
    // R4. The ambiguity AC5 exists to stop, in its sign-off form: a name sitting beside a state that is
    // not a sign-off reads as a signature that was given, which is exactly what the state says did not
    // happen. **Both non-sign-off states, not just `pending`** — the code review found `de-scoped` with
    // a name and a date parsing clean and rendering as `De-scoped (ADR-008) | Alexis Kartmann |
    // 2026-08-19`, a row visually indistinguishable from a completed review. R4 had been written for
    // `pending` alone while the harm it names is available beside either.
    if (signOff.state !== 'reviewed' && (signOff.name !== undefined || signOff.date !== undefined)) {
        context.addIssue({
            code: 'custom',
            message: `A ${signOff.state} role must carry no reviewer name and no date — a name beside a state that is not a sign-off reads as a sign-off nobody gave.`,
            path: [signOff.name !== undefined ? 'name' : 'date']
        });
    }
    // R4, second half. A `reference` is the document that de-scoped a role, so on any other state it is
    // an authoring mistake pointing a reviewer at a decision that was never taken. `.strict()` cannot
    // catch this one: the field is legal on the shape, just not in this state.
    if (signOff.state !== 'de-scoped' && signOff.reference !== undefined) {
        context.addIssue({
            code: 'custom',
            message: `A ${signOff.state} role must carry no reference — a reference names the decision that de-scoped a role, and no such decision was taken here.`,
            path: ['reference']
        });
    }
    // R3. `de-scoped` is a decision, and a decision has a document. Without this an author could
    // write `de-scoped` with nothing behind it, which is indistinguishable from a role that was
    // quietly dropped — the thing Story 3.2 AC8 forbids and this state exists to prevent.
    if (signOff.state === 'de-scoped' && signOff.reference === undefined) {
        context.addIssue({
            code: 'custom',
            message: 'A de-scoped role must name the decision that de-scoped it — an unreferenced de-scoping is indistinguishable from a role that was silently dropped.',
            path: ['reference']
        });
    }
});

/**
 * What the ledger adds to a source. R1 and R2 are checked in the definition-level loop instead,
 * because both compare this block against the artifact's own `rightsStatus` one level up.
 */
const LedgerEntrySchema = z.object({
    sourceRole: SourceRoleSchema,
    reviewerState: RowReviewerStateSchema,
    replacementPlan: LocalizedTextSchema.optional()
}).strict();

/** The rights record for one manifest asset. R1 and R2 apply here too, against `status` beside it. */
const AssetRightsSchema = z.object({
    // Canonical: a rights holder or originating process is a proper noun.
    holderOrOrigin: z.string().trim().min(1),
    status: SourceRightsStatusSchema,
    claimOrUse: LocalizedTextSchema,
    reviewerState: RowReviewerStateSchema,
    // Canonical: the repository path of the document recording this asset's origin.
    provenanceReference: z.string().trim().min(1),
    replacementPlan: LocalizedTextSchema.optional()
}).strict().superRefine((rights, context) => {
    // R1, asset half. FR27 requires ambiguous-permission material to be replaced or linked; an
    // uncleared asset with no plan is an asset nobody intends to fix.
    if (rights.status !== 'reviewed' && rights.replacementPlan === undefined) {
        context.addIssue({
            code: 'custom',
            message: 'An asset whose rights are not reviewed must carry a replacement plan — FR27 requires ambiguous-permission material to be replaced or linked, not left standing.',
            path: ['replacementPlan']
        });
    }
    // R1, the converse — and the converse is a real defect, not symmetry for its own sake. Clearing a
    // row's rights to `reviewed` while leaving its plan in place is the likeliest edit of all, because
    // the plan is a long authored paragraph nobody wants to delete. The ledger then renders
    // `Rights: Reviewed` beside `Replacement plan: … the case stays blocked from public release`, one
    // row asserting both that it is cleared and that it is not. The plan is deleted when the row clears.
    if (rights.status === 'reviewed' && rights.replacementPlan !== undefined) {
        context.addIssue({
            code: 'custom',
            message: 'An asset whose rights are reviewed must carry no replacement plan — a cleared row with a plan to replace it states both that it may ship and that it may not.',
            path: ['replacementPlan']
        });
    }
    // R2, asset half. The converse is deliberately legal: public-domain material is `reviewed` rights
    // with nobody's signature on it, which is why these are two enums and not one.
    if (rights.reviewerState === 'reviewed' && rights.status !== 'reviewed') {
        context.addIssue({
            code: 'custom',
            message: 'A reviewer cannot have signed off an asset whose rights are not reviewed — a signature over uncleared rights represents unreviewed material as verified.',
            path: ['reviewerState']
        });
    }
});

/** The case-level ledger. Every role required, because `pending` is the honest state for an open one. */
const CaseLedgerSchema = z.object({
    signOff: z.object({
        contentAuthor: ReviewerSignOffSchema,
        scholarlyReviewer: ReviewerSignOffSchema,
        accessibilityReviewer: ReviewerSignOffSchema
    }).strict(),
    educatorContextSheet: ReviewerSignOffSchema,
    accessibleControlsReference: ReviewerSignOffSchema
}).strict();

const TextualRenditionSectionSchema = z.object({
    id: stableId,
    heading: z.string().trim().min(1),
    paragraphs: z.array(z.string().trim().min(1)).min(1),
    sourcePages: z.array(z.number().int().positive()).min(1)
}).strict();

const LocalizedTextualRenditionSchema = z.object({
    locale: z.enum(LOCALES),
    /**
     * What this rendition *is*, which is a provenance claim and not a formatting one.
     *
     * `reconstruction` was added in the review of 3.2. The prototype's 1905 artifact is prose written
     * for this investigation — its own `reuseStatement` says so — and it was nonetheless declared a
     * `transcription` with printed page attributions, because the enum offered nothing else and the
     * refinement below *required* one rendition to be a transcription. The rendition of record may now
     * say it is a reconstruction, which is what `sourceType: 'reconstruction'` was already claiming one
     * layer up.
     */
    kind: z.enum(['transcription', 'translation', 'reconstruction']),
    sections: z.array(TextualRenditionSectionSchema).min(1)
}).strict().superRefine((rendition, context) => {
    const ids = rendition.sections.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: 'custom', message: 'Rendition section IDs must be stable and unique.', path: ['sections'] });
    }
});

const TextualRenditionSchema = z.object({
    readerLabel: LocalizedTextSchema,
    citation: z.object({
        reuseStatement: LocalizedTextSchema,
        // Canonical: the citation of record and its archive link are bibliographic, not display copy.
        citationText: z.string().trim().min(1),
        archiveUrl: z.string().url().refine((url) => new URL(url).protocol === 'https:', 'Archive URLs must use HTTPS.')
    }).strict(),
    summary: LocalizedTextListSchema.optional(),
    renditions: z.tuple([LocalizedTextualRenditionSchema, LocalizedTextualRenditionSchema])
}).strict().superRefine((rendition, context) => {
    const [first, second] = rendition.renditions;
    if (new Set([first.locale, second.locale]).size !== LOCALES.length) {
        context.addIssue({ code: 'custom', message: 'A readable source must provide exactly one rendition per shipped locale.', path: ['renditions'] });
    }
    // Exactly one rendition may claim to *be* the source — a transcription of the printed pages, or a
    // reconstruction standing in for them; the rest are translations of it. Two renditions of record in
    // different languages is a provenance claim nobody has reviewed, which is what this rule stops.
    //
    // The rendition of record must be `en`. The reader-facing notice (`book.translatedRendition`) names
    // English as the original in both locales, so a French rendition of record with an English
    // translation would state the provenance backwards on the page. Pinning it here keeps that string
    // true by construction; generalising the notice is the prerequisite for relaxing this rule.
    const ofRecord = rendition.renditions.filter(({ kind }) => kind !== 'translation');
    if (ofRecord.length !== 1) {
        context.addIssue({ code: 'custom', message: 'Exactly one rendition may be the rendition of record — a transcription or a reconstruction; any others are translations.', path: ['renditions'] });
    } else if (ofRecord[0].locale !== DEFAULT_LOCALE) {
        context.addIssue({ code: 'custom', message: 'The rendition of record must be the English rendition; the reader-facing notice names English as the original.', path: ['renditions'] });
    }
    // Page-for-page alignment keeps the spread count and the printed page numbers identical in
    // either language, so "spread 3 of 19" means the same thing to every reader.
    const shape = (candidate: typeof first): string =>
        JSON.stringify(candidate.sections.map(({ id, sourcePages, paragraphs }) => [id, sourcePages, paragraphs.length]));
    if (shape(first) !== shape(second)) {
        context.addIssue({
            code: 'custom',
            message: 'Every rendition must cover the same source pages, in the same order, with the same number of paragraphs.',
            path: ['renditions']
        });
    }
});

const ContextualArtifactSchema = z.object({
    id: stableId,
    displayName: LocalizedTextSchema,
    creatorOrOrigin: z.string().trim().min(1),
    sourceType: SourceTypeSchema,
    provenance: z.object({
        category: SourceProvenanceCategorySchema,
        reference: sourceRef
    }).strict(),
    rightsStatus: SourceRightsStatusSchema,
    caseRelationship: LocalizedTextSchema,
    textualRendition: TextualRenditionSchema.optional(),
    ledgerEntry: LedgerEntrySchema
}).strict();

const ConsultationPredicateSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('missing-run') }).strict(),
    z.object({ kind: z.literal('missing-source'), sourceId: stableId }).strict(),
    z.object({ kind: z.literal('alternative-test'), controlId: stableId }).strict(),
    z.object({ kind: z.literal('missing-limitation') }).strict()
]);

const ConsultationRuleSchema = z.object({
    id: stableId,
    predicate: ConsultationPredicateSchema,
    layers: z.object({
        observation: LocalizedTextSchema,
        plainLanguage: LocalizedTextSchema,
        technicalDetail: LocalizedTextSchema
    }).strict(),
    nextStep: LocalizedTextSchema
}).strict();

const PeerReviewRuleSchema = z.object({
    id: stableId,
    predicate: z.object({
        kind: z.enum(['missing-evidence', 'unsupported-support', 'overreach']),
        // Detection phrases, not display text: both locales are always matched as a union, and the
        // two lists are sized independently. See {@link DetectionPhraseListSchema}.
        overreachPhrases: DetectionPhraseListSchema.optional()
    }).strict(),
    feedback: LocalizedTextSchema,
    revisionPath: LocalizedTextSchema
}).strict();

/**
 * When a run counts as a distinguishing measurement (Story 2.6).
 *
 * `criticalControlIds` is `.min(1)` and its entries are checked against the authored controls in the
 * top-level refinement, where the message can name the offending ID. `criticalModelInputIds` is
 * `.min(1)` when present for the same reason an empty control list is rejected: an empty list is an
 * author writing a field that does nothing, which is worth failing on rather than silently accepting.
 *
 * There is no reading-distance field. One existed (`minimumResultDelta`) and was removed in review
 * (2026-08-06) because it made the count depend on recording order; see {@link SignificanceRule}.
 */
const SignificanceRuleSchema = z.object({
    criticalControlIds: z.array(stableId).min(1),
    criticalModelInputIds: z.array(stableId).min(1).optional()
}).strict();

const ColleagueHintPredicateSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('no-recorded-runs') }).strict(),
    z.object({ kind: z.literal('repeated-configuration') }).strict(),
    z.object({ kind: z.literal('unvaried-control'), controlId: stableId }).strict(),
    z.object({ kind: z.literal('below-significant-measures') }).strict()
]);

/**
 * The same bound, and the same reason, as {@link RivalLabCritiqueSchema}'s: the hint is drawn into a
 * fixed lab surface with no scroll, and clamping the prose at runtime would truncate the one thing
 * the player needs to read. Failing at case load puts the problem where an author can see it.
 */
const MAX_HINT_LINE_LENGTH = 320;

const ColleagueHintSchema = z.object({
    id: stableId,
    colleagueId: stableId,
    predicate: ColleagueHintPredicateSchema,
    line: LocalizedTextSchema.refine(
        ({ en, fr }) => en.length <= MAX_HINT_LINE_LENGTH && fr.length <= MAX_HINT_LINE_LENGTH,
        `A colleague hint must be at most ${MAX_HINT_LINE_LENGTH} characters in each locale.`
    )
}).strict();

const ReadingGateHintPredicateSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('missing-artifact'), artifactId: stableId }).strict(),
    z.object({ kind: z.literal('any-missing-reading') }).strict()
]);

/**
 * The same bound, and the same reason, as {@link ColleagueHintSchema}'s: the line is drawn into a
 * fixed reading-room band with no scroll, and clamping the prose at runtime would truncate the one
 * thing the player needs to read. Failing at case load puts the problem where an author can see it.
 */
const MAX_READING_GATE_LINE_LENGTH = 320;

const ReadingGateHintSchema = z.object({
    id: stableId,
    colleagueId: stableId,
    predicate: ReadingGateHintPredicateSchema,
    line: LocalizedTextSchema.refine(
        ({ en, fr }) => en.length <= MAX_READING_GATE_LINE_LENGTH && fr.length <= MAX_READING_GATE_LINE_LENGTH,
        `A reading-gate line must be at most ${MAX_READING_GATE_LINE_LENGTH} characters in each locale.`
    )
}).strict();

const ColleagueRoleSchema = z.enum(['lead', 'builder', 'analyst', 'communicator']);

/**
 * How a figure is drawn, as a closed vocabulary rather than free-form art direction.
 *
 * Enums and booleans only, and **no authored colour** beyond the accent that is already there: the
 * room is lit warm and dark, and a free `hairColor` would eventually carry one that does not sit in
 * that light. Every field is optional and the whole block is optional, so this is additive — no case
 * that validated before this schema changed stops validating now.
 */
const ColleagueFigureSchema = z.object({
    build: z.enum(['suited', 'gowned']).optional(),
    pose: z.enum(['at-rest', 'arms-folded', 'holding-paper', 'raising-instrument', 'presenting']).optional(),
    hair: z.enum(['cropped', 'swept', 'upswept']).optional(),
    hairColor: z.enum(['dark', 'auburn', 'fair', 'grey']).optional(),
    skinTone: z.enum(['light', 'tan', 'brown', 'deep']).optional(),
    spectacles: z.boolean().optional(),
    moustache: z.boolean().optional()
}).strict();

const ColleaguePortraitSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('asset'),
        assetId: stableId,
        accentColor: z.string().regex(/^#[0-9a-f]{6}$/, 'An asset portrait fallback accent must be a lower-case #rrggbb colour.').optional(),
        figure: ColleagueFigureSchema.optional()
    }).strict(),
    // Lower-case six-digit hex only: the renderer parses it with `Number.parseInt(…, 16)`, and a
    // single canonical spelling keeps authored accents comparable at a glance.
    z.object({
        kind: z.literal('silhouette'),
        accentColor: z.string().regex(/^#[0-9a-f]{6}$/, 'A silhouette accent must be a lower-case #rrggbb colour.'),
        figure: ColleagueFigureSchema.optional()
    }).strict()
]);

const ColleagueSchema = z.object({
    id: stableId,
    // Canonical: a proper noun, following the `creatorOrOrigin` precedent. The *role* is what gets
    // localized, by stable enum value.
    name: z.string().trim().min(1),
    role: ColleagueRoleSchema,
    portrait: ColleaguePortraitSchema
}).strict();

/**
 * Support predicates, built as three explicit nested levels rather than `z.lazy`.
 *
 * The bound is the point: an authored `all-of` tree has no business nesting deeper than this, and an
 * unbounded recursive schema would accept one. Writing the levels out also sidesteps Zod 4's `lazy`
 * inference gap — no `z.ZodType<T>` annotation is needed, so the inferred type stays a real
 * discriminated union that structurally matches `ConclusionSupportPredicate`.
 *
 * An empty `predicates` array is rejected in the top-level refinement rather than with `.min(1)`
 * here, so the failure carries the authored explanation instead of a generic `too_small`.
 */
const leafSupportPredicates = [
    z.object({ kind: z.literal('never') }).strict(),
    z.object({ kind: z.literal('minimum-runs'), count: z.number().int().positive() }).strict(),
    z.object({ kind: z.literal('varied-control'), controlId: stableId }).strict(),
    // Scoped to the runs pinned to the conclusion, not to every recorded run — see the union.
    z.object({ kind: z.literal('unvaried-control-pinned'), controlId: stableId }).strict(),
    z.object({ kind: z.literal('inspected-source'), sourceId: stableId }).strict()
] as const;

const allOfSchema = <T extends z.ZodTypeAny>(child: T) =>
    z.object({ kind: z.literal('all-of'), predicates: z.array(child) }).strict();

/** Depth 3: leaves, an `all-of` over leaves, and an `all-of` over those. */
const SupportPredicateDepth3Schema = z.discriminatedUnion('kind', [...leafSupportPredicates]);
const SupportPredicateDepth2Schema = z.discriminatedUnion('kind', [...leafSupportPredicates, allOfSchema(SupportPredicateDepth3Schema)]);
const ConclusionSupportPredicateSchema = z.discriminatedUnion('kind', [...leafSupportPredicates, allOfSchema(SupportPredicateDepth2Schema)]);

const PredictionProposalSchema = z.object({
    id: stableId,
    colleagueId: stableId,
    text: LocalizedTextSchema
}).strict();

const ConclusionProposalSchema = z.object({
    id: stableId,
    colleagueId: stableId,
    claim: LocalizedTextSchema,
    limitation: LocalizedTextSchema,
    supportPredicate: ConclusionSupportPredicateSchema
}).strict();

/**
 * One rival-lab critique. `line` is {@link LocalizedTextSchema} and deliberately **not**
 * {@link DetectionPhraseListSchema}: this is prose the player reads, so both locales carry one
 * corresponding string, not two independently-sized match lists.
 */
/**
 * The bound on an authored objection, in characters, per locale.
 *
 * `RivalLabRenderer` anchors its revise control to the canvas floor so the way back always exists, and
 * clamps the guide just above it — but the body itself is deliberately unclamped, because truncating
 * the objection is the one thing that surface must not do. That leaves the prose as the only thing that
 * can overrun: past roughly 3000 characters it reaches the guide and then runs off a non-scrolling
 * 1024×768 `Scale.FIT` surface, where nobody can read it and no author can see that it happened.
 *
 * So the bound is enforced here, at case load, where a failure names the critique and an author can act
 * on it. It sits well under the geometric ceiling on purpose: it is an editorial bound, not a last line
 * of defence. The longest authored line today is 404 characters (2.5 review).
 */
const MAX_CRITIQUE_LINE_LENGTH = 700;

const RivalLabCritiqueSchema = z.object({
    id: stableId,
    proposalId: stableId,
    line: LocalizedTextSchema.refine(
        ({ en, fr }) => en.length <= MAX_CRITIQUE_LINE_LENGTH && fr.length <= MAX_CRITIQUE_LINE_LENGTH,
        `A rival-lab critique must be at most ${MAX_CRITIQUE_LINE_LENGTH} characters in each locale.`
    )
}).strict();

const RivalLabSchema = z.object({
    // Canonical: a proper noun, following the `Colleague.name` and `creatorOrOrigin` precedent.
    name: z.string().trim().min(1),
    portraitAssetId: stableId.optional(),
    // The same lower-case #rrggbb rule the colleague silhouette uses: the renderer parses it with
    // `Number.parseInt(…, 16)`, and one canonical spelling keeps authored accents comparable.
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/, 'A rival-lab accent must be a lower-case #rrggbb colour.'),
    // The same optional block a colleague's portrait carries, validated by the same schema — he is
    // drawn by the same renderer and there is no second vocabulary for him to be authored in.
    figure: ColleagueFigureSchema.optional(),
    // `.min(1)` only. Full coverage of the conclusion proposals is a cross-field rule and lives in the
    // top-level refinement, where the message can name what is actually missing.
    critiques: z.array(RivalLabCritiqueSchema).min(1)
}).strict();

/** Walks an authored predicate tree, including nested `all-of` children. */
const flattenSupportPredicates = (
    predicate: z.infer<typeof ConclusionSupportPredicateSchema>
): readonly z.infer<typeof SupportPredicateDepth3Schema>[] => predicate.kind === 'all-of'
    ? predicate.predicates.flatMap((child) => flattenSupportPredicates(child as z.infer<typeof ConclusionSupportPredicateSchema>))
    : [predicate];

/** True only where some evidence could satisfy the predicate — an empty `all-of` is not "some". */
const isSatisfiablePredicate = (predicate: z.infer<typeof ConclusionSupportPredicateSchema>): boolean => predicate.kind === 'never'
    ? false
    : predicate.kind !== 'all-of'
        || (predicate.predicates.length > 0
            && predicate.predicates.every((child) => isSatisfiablePredicate(child as z.infer<typeof ConclusionSupportPredicateSchema>)));

const hasEmptyAllOf = (predicate: z.infer<typeof ConclusionSupportPredicateSchema>): boolean => predicate.kind === 'all-of'
    && (predicate.predicates.length === 0
        || predicate.predicates.some((child) => hasEmptyAllOf(child as z.infer<typeof ConclusionSupportPredicateSchema>)));

const ScenarioDialogueBeatSchema = z.object({
    id: stableId,
    speakerId: stableId,
    // Authored prose, not a bundle key. See `ScenarioDialogueBeat` for why the key shape could not work.
    text: LocalizedTextSchema
}).strict();

const ScenarioSceneSchema = z.object({
    phase: z.enum(CASE_PHASES),
    sceneKey: z.enum(SCENE_KEYS),
    // Who is in the room, authored rather than derived (Story 3.4). **No `.min(1)`**, and no default.
    //
    // The floor belongs in the top-level refinement for the same reason it does below: a base-parse
    // failure makes Zod skip the whole `superRefine`, so a `too_small` here would silence every
    // authored-content message at once. An authored `[]` is genuinely refused — unlike `dialogueBeats`,
    // where empty and absent mean the same thing — because absence already means "the whole cast" and
    // "nobody" is not a state a figure-staging scene can render. The refinement says that in words.
    //
    // No `.default([...])` either: a schema default writes content into the parsed object that the
    // author did not write, and `.strict()` round-trips stop being faithful. The one place that stages
    // figures resolves the absence instead.
    cast: z.array(stableId).optional(),
    // No `.min` here either, for the same reason it is absent on `scenes` below. `"dialogueBeats": []`
    // is the natural way to write "no conversation yet", and as a base-parse failure it reported a
    // generic too_small *and* skipped the whole top-level superRefine — silencing every authored-content
    // message at once (unresolved speakerId, encodesPath, duplicate beat ids, and the rules that have
    // nothing to do with this field), so an author fixed one problem at a time from a message that named
    // none of them (1.12 review). An empty array and an absent field both mean "no beats", which
    // `selectDialogueBeats` already treats identically.
    dialogueBeats: z.array(ScenarioDialogueBeatSchema).optional()
}).strict();

// No `.min` on `scenes`: Zod skips a superRefine once the base parse has failed, so a length rule
// would intercept the most common authoring mistake — a missing phase — and report a generic
// too_small instead of the authored message. The refinement below is the single coverage rule.
const ScenarioScriptSchema = z.object({
    scenes: z.array(ScenarioSceneSchema)
}).strict().superRefine((script, context) => {
    const phases = script.scenes.map(({ phase }) => phase);
    if (new Set(phases).size !== phases.length || CASE_PHASES.some((phase) => !phases.includes(phase))) {
        context.addIssue({
            code: 'custom',
            message: 'The scenario script must map every case phase exactly once.',
            path: ['scenes']
        });
    }
});

/**
 * Authored help content must describe *what to do next*, never the route the app takes to get there.
 *
 * Arrows are the reliable cross-language signal and are matched identically in both locales.
 *
 * The *word* list has to be locale-specific: `route` and `phase` are ordinary French words (and
 * `scène` reads naturally in "mise en scène"), so applying the English list to French copy produces
 * only false positives and pressure to mangle the translation. French is guarded at the phrase level
 * instead — "ouvrez la scène" encodes a route, "la mise en scène de l'expérience" does not — which
 * catches the real failure without punishing legitimate copy.
 */
const FORBIDDEN_ARROWS = /(?:→|⇒|⟶|->|=>)/;

/**
 * A word boundary that understands accents. `\b` is ASCII-only, so `\bétape` never matches — the
 * position before `é` is not a boundary because `é` is not a `\w` character. Every French pattern
 * here has to use this instead.
 */
const word = (pattern: string): string => `(?:^|[^\\p{L}\\p{N}_])(?:${pattern})(?=$|[^\\p{L}\\p{N}_])`;

const forbiddenPath: Readonly<Record<'en' | 'fr', readonly RegExp[]>> = {
    en: [FORBIDDEN_ARROWS, new RegExp(word('scene|phase|route'), 'iu')],
    fr: [
        FORBIDDEN_ARROWS,
        new RegExp(`${word('ouvrez|allez|rendez-vous|retournez|naviguez|passez')}[^.!?]{0,20}${word('scène|phase|étape|écran|route')}`, 'iu')
    ]
};

const encodesPath = (text: Readonly<{ en: string; fr: string }>): boolean =>
    forbiddenPath.en.some((pattern) => pattern.test(text.en))
    || forbiddenPath.fr.some((pattern) => pattern.test(text.fr));

/**
 * The Young optical model's own input names, for the case-scoped `criticalModelInputIds` check.
 *
 * Mirrors `YoungModelInputs` in `src/domain/evidence/RunRecord.ts`. A schema cannot read a type, so
 * this is the one place the two are written down separately; `CaseDefinition.test.ts` asserts the set
 * against a real recorded run so they cannot drift apart silently.
 */
const YOUNG_MODEL_INPUT_IDS = new Set(['slitSpacingMm', 'screenDistanceM', 'wavelengthNm', 'wavelengthMode']);

/**
 * An authored asset path with percent-encoding resolved, for the traversal check only.
 *
 * `decodeURIComponent` throws on a malformed escape (`%zz`), and a path we cannot decode is one we
 * cannot clear — so the raw string is returned and the caller's `..` check runs against it. A
 * malformed path fails the fetch anyway; what matters is that a decode failure never reads as "safe".
 */
const decodeAssetPath = (path: string): string => {
    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
};

export const AssetManifestSchema = z.object({
    manifestVersion: z.string().trim().min(1),
    entries: z.array(z.object({
        id: stableId,
        type: z.enum(['image', 'audio', 'document']),
        // Same-origin static root paths only, and three hostile shapes rejected by name:
        //
        // - `//evil.com/x.png` is a protocol-relative URL, which a browser resolves against the
        //   *scheme* and fetches cross-origin. Rejected before this story, by the `(?!\/)`.
        // - `/\evil.com/x.png` is the same attack with a backslash. Browsers normalise `\` to `/` in
        //   the authority position, so this is protocol-relative too — and the old pattern accepted
        //   it, because it only ruled out a second forward slash.
        // - `/cases/../../etc/passwd` walks out of the static root. `resolveAssetUrl` (added by the
        //   Pages deploy) prefixes a base path, so at a domain root a `..` segment escapes the app.
        //
        // A path is rejected outright rather than normalised: an author who wrote `..` meant something,
        // and silently resolving it would ship an asset reference nobody authored.
        //
        // The traversal check decodes first and splits on *both* separators, because the same two
        // normalisations the authority rule above guards against apply to the rest of the path:
        // `/cases\..\..\etc/passwd` and `/cases/%2e%2e/%2e%2e/etc/passwd` both reach the loader as
        // traversals once the browser is done with them, and `resolveAssetUrl` is string concatenation
        // that normalises nothing. Splitting on `/` alone left the third hostile shape half-closed
        // (`deferred-work.md:146` named `/\` and `..` in one sentence; only one was rejected).
        path: z.string()
            .regex(/^\/(?![/\\])/, 'Asset paths must be same-origin static root paths.')
            .refine((path) => !decodeAssetPath(path).split(/[/\\]/).includes('..'), 'Asset paths must not contain a parent-directory segment.'),
        /**
         * Who holds this asset and whether its reuse has been cleared (Story 3.3, AC5).
         *
         * The manifest carried `id`, `type` and `path` and nothing else, so no surface could answer
         * either question — which is why the ledger is the first surface to read asset rights rather
         * than the fifth. Required: an asset nobody audited is what this field exists to make impossible.
         */
        rights: AssetRightsSchema
    }).strict()).min(1)
}).strict().superRefine((manifest, context) => {
    if (new Set(manifest.entries.map((asset) => asset.id)).size !== manifest.entries.length) {
        context.addIssue({ code: 'custom', message: 'Asset IDs must be stable and unique.', path: ['entries'] });
    }
});

export const CaseDefinitionSchema = z.object({
    id: CaseIdSchema,
    version: z.string().trim().min(1),
    /**
     * The investigation's own name, shown by the laboratory in place of a hard-coded interface string.
     *
     * Authored rather than translated, because a case's title is content: the bench used to read
     * `lab.title` — "Young interference — the optical bench" — for whatever case was loaded.
     * `encodesPath` applies to it like every other authored string.
     */
    title: LocalizedTextSchema,
    openingDispute: LocalizedTextSchema,
    // FR4 requires *two* contextual artifacts before a prediction. An array rather than a 2-tuple so
    // the count is authored rather than structural — but bounded above as well as below, because the
    // case file, the reading room and the debrief all reserve a fixed number of rows. See
    // {@link MAX_CONTEXTUAL_ARTIFACTS}: a third artifact parses as valid content the player can read
    // and never cite.
    contextualArtifacts: z.array(ContextualArtifactSchema).min(2).max(MAX_CONTEXTUAL_ARTIFACTS),
    prediction: z.object({ required: z.literal(true) }).strict(),
    // An array rather than a 2-tuple, so a case may author its own pair or a single control. The
    // ceiling stays 2 for the bench-geometry reason recorded on {@link MAX_PRIMARY_CONTROLS}.
    apparatus: z.object({ primaryControls: z.array(PrimaryControlSchema).min(1).max(MAX_PRIMARY_CONTROLS) }).strict(),
    experiment: z.object({
        /**
         * Which implemented deterministic model this case's bench runs (Story 3.2).
         *
         * A `stableId` refined against {@link EXPERIMENT_MODEL_IDS} rather than a `z.enum`, so the
         * rejection carries an authored message naming the offending path and the models that do exist.
         * Required of every case, and validated here rather than at run time on purpose: a case naming a
         * model this build cannot run is content that leaves a gate unsatisfiable, and the player would
         * otherwise meet it as a refusal at the moment they press start.
         */
        modelId: stableId,
        modelVersion: z.string().trim().min(1),
        // Optional at the shared shape and required for Young in the case-scoped refinement below: a
        // case whose apparatus is a rotating interferometer or a flying clock has no wavelength, and
        // making every case declare one would be exactly the all-purpose schema epic AC1 forbids.
        // Nothing in `src/` reads this field — only `wavelengthComparison` is read — so the relaxation
        // costs no behaviour.
        wavelengthNm: z.number().positive().finite().optional(),
        wavelengthComparison: z.object({
            // Authored rather than pinned: a second case comparing two path lengths has its own
            // baseline, and `isAdvancedWavelengthUnlocked` reads this as a plain number. Young's 550
            // is re-stated in the case-scoped refinement below.
            //
            // `advancedChoicesNm` stays pinned deliberately: it feeds `AppState.selectedWavelengthNm`,
            // whose `450 | 550 | 650` union is persisted in `CaseRecordSchema` and cannot be widened
            // without a record migration (`deferred-work.md`, deferred from this review).
            fixedMinimumPathNm: z.number().positive().finite(),
            advancedChoicesNm: z.tuple([z.literal(450), z.literal(650)])
        }).strict().optional(),
        assumptions: LocalizedTextListSchema,
        confound: z.object({
            id: stableId,
            description: LocalizedTextSchema,
            discoverableBy: RecoveryRouteSchema
        }).strict(),
        resetPath: z.object({
            recoveryRoute: RecoveryRouteSchema,
            description: LocalizedTextSchema
        }).strict()
    }).strict(),
    // Floors of two rather than literal twos. For Young all three are still pinned at exactly 2 by the
    // case-scoped refinement — the count really is the design *for this case* — but a later case may
    // legitimately require more evidence, and the shared shape has no business deciding that.
    requirements: z.object({
        minimumRuns: z.number().int().min(2),
        minimumSources: z.number().int().min(2),
        minimumSignificantRuns: z.number().int().min(2)
    }).strict(),
    significanceRule: SignificanceRuleSchema,
    // `.min(1)` only. "At least one hint applies with no runs recorded" is a cross-field rule and
    // lives in the top-level refinement, where the message can say what is missing and why.
    colleagueHints: z.array(ColleagueHintSchema).min(1),
    // `.min(1)` only, for the same reason: "a floor is authored and authored last" is a cross-field
    // rule and lives in the top-level refinement, where the message can say what is missing and why.
    readingGateHints: z.array(ReadingGateHintSchema).min(1),
    colleagues: z.array(ColleagueSchema).min(1),
    // `.length(4)`, not `.min(4)`: the pivot makes both the prediction and the conclusion a 1-of-4
    // attributed choice, and a wrong count is unambiguous enough that a generic length failure reads
    // correctly without an authored message.
    predictionProposals: z.array(PredictionProposalSchema).length(4),
    conclusionProposals: z.array(ConclusionProposalSchema).length(4),
    rivalLab: RivalLabSchema,
    consultationRules: z.array(ConsultationRuleSchema).min(4),
    peerReviewRules: z.array(PeerReviewRuleSchema).min(3),
    flow: z.object({
        openingDispute: z.literal(true),
        curatedRecord: z.literal(true),
        labSetup: z.literal(true),
        // Positive ints with `min <= max` checked in the refinement below. FR3's two-to-four range is
        // Young's, and is pinned case-scoped rather than shape-wide.
        minimumExperimentCycles: z.number().int().positive(),
        maximumExperimentCycles: z.number().int().positive(),
        theoryBoardReview: z.literal(true),
        historicalDebrief: z.literal(true),
        optionalReplay: z.literal(true)
    }).strict(),
    // No `.max()` bound, unlike `colleagueHints` and the rival-lab critiques. Those are clamped because
    // they are painted into a fixed canvas band with no scroll, where over-long prose would crop the one
    // thing the player needs to read. This one is a paragraph in the printable record, which is HTML that
    // reflows and prints across pages — so a bound here would refuse valid authoring for no reason.
    autoSummary: LocalizedTextSchema,
    scenarioScript: ScenarioScriptSchema,
    debrief: z.object({
        summary: LocalizedTextSchema,
        sourceRefs: z.array(sourceRef).min(1),
        historicalComparison: z.object({
            title: LocalizedTextSchema,
            text: LocalizedTextSchema,
            sourceIds: z.tuple([stableId, stableId])
        }).strict(),
        deeperTheory: z.object({ title: LocalizedTextSchema, text: LocalizedTextSchema }).strict(),
        replayLabel: LocalizedTextSchema
    }).strict(),
    assets: AssetManifestSchema,
    /**
     * The source-and-rights ledger `evaluateLedgerReleaseApproval` reads (Story 3.3, FR26).
     *
     * Required, and required is the point: an optional ledger would let real content under
     * `public/cases/` ship a row nobody audited, which is the whole reason the story exists.
     */
    ledger: CaseLedgerSchema
}).strict().superRefine((definition, context) => {
    const controls = Object.fromEntries(definition.apparatus.primaryControls.map((control) => [control.id, control]));

    // --- What every case shares --------------------------------------------------------------------
    //
    // Uniqueness was free while `primaryControls` was a 2-tuple whose two members had to carry Young's
    // two different sets of bounds; an array of one schema will happily take the same control twice.
    // It has to be a rule now, because a duplicate ID silently halves the apparatus: `activeControlValues`
    // and `RunControls` are keyed by ID, so the second control would overwrite the first everywhere,
    // and the bench would draw two knobs that move together.
    if (new Set(definition.apparatus.primaryControls.map((control) => control.id)).size !== definition.apparatus.primaryControls.length) {
        context.addIssue({ code: 'custom', message: 'Primary control IDs must be stable and unique.', path: ['apparatus', 'primaryControls'] });
    }

    // --- The declared experiment model (Story 3.2) --------------------------------------------------
    //
    // Two rules, both at load, both about content that would otherwise fail in front of a player.
    //
    // The first: a `modelId` this build does not implement. `reduceExperimentRun` resolves the model on
    // every run, so an unknown ID would refuse the bench for the whole case with a message about the
    // *build* — the shape of "no authored content may leave a gate unsatisfiable" applied to the model.
    //
    // The second: a model fed controls the case does not author. Every model reads its inputs by
    // authored control ID, and a missing one resolves to `undefined` — which is precisely wall 1, one
    // layer down. Naming the model's own required IDs is what makes the pairing a load-time claim rather
    // than a convention two files apart happen to keep.
    const model = resolveExperimentModel(definition.experiment.modelId);
    if (!model) {
        context.addIssue({
            code: 'custom',
            message: `An experiment model must be one this build implements: ${EXPERIMENT_MODEL_IDS.join(', ')}.`,
            path: ['experiment', 'modelId']
        });
    } else {
        const missingControlIds = model.requiredControlIds.filter((controlId) => !controls[controlId]);
        if (missingControlIds.length > 0) {
            context.addIssue({
                code: 'custom',
                message: `The ${model.id} model reads ${missingControlIds.join(', ')}, which this apparatus does not author.`,
                path: ['apparatus', 'primaryControls']
            });
        }
    }

    if (encodesPath(definition.title)) {
        context.addIssue({ code: 'custom', message: 'The case title must not encode a scene, route, or phase path.', path: ['title'] });
    }

    if (definition.flow.minimumExperimentCycles > definition.flow.maximumExperimentCycles) {
        context.addIssue({
            code: 'custom',
            message: 'The minimum experiment cycle count must not exceed the maximum.',
            path: ['flow', 'minimumExperimentCycles']
        });
    }

    // --- What is true of Young alone (Story 3.1) ---------------------------------------------------
    //
    // Epic AC1's second clause: hardening the contract must not make Young "depend on a future
    // all-purpose schema". The shared shape above therefore holds only what every case shares, and
    // FR7's exact numbers — which are a claim about *this apparatus*, not about apparatus in general —
    // live in a branch keyed on the case ID. Young loses no guarantee; a second case inherits none of
    // Young's.
    //
    // Deliberately one `if`, not a registry of per-case rule modules: at two cases a branch is the
    // whole mechanism, and an indirection layer here would be the all-purpose schema by another name.
    if (definition.id === YOUNG_CASE_ID) {
        const slitSpacing = controls.slitSpacingMm;
        const screenDistance = controls.screenDistanceM;

        if (!slitSpacing || slitSpacing.min !== 0.1 || slitSpacing.max !== 0.5 || slitSpacing.step !== 0.05) {
            context.addIssue({ code: 'custom', message: 'Young slit spacing must be 0.10–0.50 mm in 0.05 mm steps.', path: ['apparatus', 'primaryControls'] });
        }

        if (!screenDistance || screenDistance.min !== 1 || screenDistance.max !== 4 || screenDistance.step !== 0.25) {
            context.addIssue({ code: 'custom', message: 'Young screen distance must be 1.0–4.0 m in 0.25 m steps.', path: ['apparatus', 'primaryControls'] });
        }

        // The optical model is not injected for Young: `reduceExperimentRun` calls
        // `calculateYoungFringeSpacing` directly and `RunRecord`'s `YoungModelInputs` names a
        // wavelength, so the field is load-bearing here even though a case with no wavelength at all
        // must be able to omit it. `z.literal(550)` required is re-stated as exactly that, no weaker.
        //
        // `wavelengthComparison` is deliberately **not** required alongside it. It was already
        // `.optional()` before this story and the code reads it as absent-tolerant
        // (`wavelengthComparison?.advancedChoicesNm ?? []`), so requiring it here would tighten the
        // contract rather than preserve it — and would reject Young content that has always been valid.
        // Story 3.1 re-states the guarantees it removes; it does not add new ones.
        // The optical model is Young's by name, pinned here beside its fixed wavelength: the two are one
        // claim about this apparatus, and a Young case running the interferometer would be nonsense that
        // the shared shape has no way to see.
        if (definition.experiment.modelId !== 'young-double-slit') {
            context.addIssue({ code: 'custom', message: 'The Young case runs the young-double-slit model.', path: ['experiment', 'modelId'] });
        }

        if (definition.experiment.wavelengthNm !== 550) {
            context.addIssue({ code: 'custom', message: 'The Young case runs at a fixed 550 nm.', path: ['experiment', 'wavelengthNm'] });
        }

        // FR6's counts and FR3's cycle range, still exact — just exact *for Young* rather than for
        // every case that will ever exist.
        if (definition.requirements.minimumRuns !== 2 || definition.requirements.minimumSources !== 2 || definition.requirements.minimumSignificantRuns !== 2) {
            context.addIssue({ code: 'custom', message: 'The Young case requires exactly two runs, two sources, and two significant measurements.', path: ['requirements'] });
        }

        if (definition.flow.minimumExperimentCycles !== 2 || definition.flow.maximumExperimentCycles !== 4) {
            context.addIssue({ code: 'custom', message: 'The Young case runs two to four experiment cycles.', path: ['flow'] });
        }

        // The comparison's baseline is authored in the shared shape, so Young's own 550 is pinned here
        // beside its fixed wavelength rather than in the field schema.
        if (definition.experiment.wavelengthComparison && definition.experiment.wavelengthComparison.fixedMinimumPathNm !== 550) {
            context.addIssue({
                code: 'custom',
                message: 'The Young comparison measures against the fixed 550 nm path.',
                path: ['experiment', 'wavelengthComparison', 'fixedMinimumPathNm']
            });
        }

        // `criticalModelInputIds` is a free-form stable ID in the shared shape, because model inputs are
        // each case's own model shape and no shared vocabulary exists to check against. For Young the
        // vocabulary IS known — `YoungModelInputs` — so it is checked here. Without this, a single
        // transposed letter (`wavelenghtNm`) loads clean and resolves to `UNRECORDED_INPUT` for every
        // run, silently collapsing the wavelength dimension out of `configurationKey`: runs at 450 and
        // 550 nm at one knob position count as one configuration, the gate quietly gets harder, and the
        // printable record under-reports. The enum this replaced was the only thing holding it.
        //
        // A second case's model inputs stay unchecked until Story 3.2 gives the contract a way to
        // declare them; that gap is recorded rather than closed by widening this list.
        (definition.significanceRule.criticalModelInputIds ?? []).forEach((inputId, index) => {
            if (!YOUNG_MODEL_INPUT_IDS.has(inputId)) {
                context.addIssue({
                    code: 'custom',
                    message: 'The Young significance rule may only name a recorded Young model input.',
                    path: ['significanceRule', 'criticalModelInputIds', index]
                });
            }
        });
    }

    if (new Set(definition.contextualArtifacts.map((artifact) => artifact.id)).size !== definition.contextualArtifacts.length) {
        context.addIssue({ code: 'custom', message: 'Contextual artifact IDs must be stable and unique.', path: ['contextualArtifacts'] });
    }

    // --- Requirement counts against what the case can actually supply (Story 3.1 review) ------------
    //
    // The three counts were `z.literal(2)` beside a two-artifact tuple, so they were consistent by
    // construction. Both sides were relaxed independently and nothing related them again — the same
    // "can an author fill this in a way that makes the case unfinishable?" question the readiness and
    // defensibility rules already ask, asked of the numbers.

    if (definition.requirements.minimumSources > definition.contextualArtifacts.length) {
        context.addIssue({
            code: 'custom',
            // `evaluateConclusionReadiness` counts *inspected authored* sources, so a requirement above
            // the number authored can never be met and the theory board never unlocks.
            message: 'The source requirement must not exceed the sources the case authors.',
            path: ['requirements', 'minimumSources']
        });
    }

    // The reachable configuration space is the product, over the controls the significance rule calls
    // critical, of each control's distinct authored positions. A requirement above it makes
    // `isSignificantMeasureGateMet` permanently false and leaves the colleague repeating a floor hint
    // the player cannot act on.
    //
    // Controls only, deliberately: `criticalModelInputIds` can only *add* dimensions, so this bound is
    // conservative. A case that reaches its count by varying a model input rather than a control would
    // be rejected here — an accepted trade (review decision 4a, 2026-08-19), because a false rejection
    // is an authoring error message and a false acceptance is an unfinishable case.
    const criticalControls = definition.significanceRule.criticalControlIds
        .map((controlId) => controls[controlId])
        .filter((control): control is NonNullable<typeof control> => Boolean(control));
    if (criticalControls.length === definition.significanceRule.criticalControlIds.length) {
        const reachableConfigurations = criticalControls.reduce(
            (total, control) => total * (Math.floor((control.max - control.min) / control.step) + 1),
            1
        );
        if (definition.requirements.minimumSignificantRuns > reachableConfigurations) {
            context.addIssue({
                code: 'custom',
                message: 'The significant-measure requirement must not exceed the configurations the authored controls can produce.',
                path: ['requirements', 'minimumSignificantRuns']
            });
        }
    }

    // --- The neutral auto-summary (FR23, Story 3.1) -------------------------------------------------
    //
    // Checked per locale, not on the English alone. The two renderings need not name the same
    // placeholders in the same order — French and English put a count in different places — but each has
    // to name only values the composer supplies.
    //
    // The failure mode this exists for: `interpolate` leaves an unknown `{token}` verbatim (its own
    // docstring, `translate.ts:39`), so a typo'd placeholder would print itself into the player's
    // printable record with nothing warning anyone. Named here, at load, once.
    //
    // `unfillableTemplateTokens` rather than a placeholder walk, because the first version of this check
    // shared the composer's `\w+` and so was blind to every token an author is most likely to get wrong:
    // `{run-count}` (this project's ids are kebab-case), `{ runCount }`, an unclosed `{runCount`, and
    // `{{runCount}}` — which renders `{2}`. None were enumerated, so none were rejected, and each printed
    // itself into the record the check exists to protect (review 2026-08-19).
    LOCALES.forEach((locale) => {
        unfillableTemplateTokens(definition.autoSummary[locale]).forEach((token) => {
            context.addIssue({
                code: 'custom',
                message: `The auto-summary template names ${token}, which is not a value the summary can fill.`,
                path: ['autoSummary', locale]
            });
        });
    });
    if (encodesPath(definition.autoSummary)) {
        context.addIssue({ code: 'custom', message: 'The auto-summary template must not encode a scene, route, or phase path.', path: ['autoSummary'] });
    }

    const consultationIds = definition.consultationRules.map((rule) => rule.id);
    const peerReviewIds = definition.peerReviewRules.map((rule) => rule.id);
    if (new Set(consultationIds).size !== consultationIds.length || new Set(peerReviewIds).size !== peerReviewIds.length) {
        context.addIssue({ code: 'custom', message: 'Consultation and peer-review rule IDs must be unique.', path: ['consultationRules'] });
    }
    const sourceIds = new Set(definition.contextualArtifacts.map((artifact) => artifact.id));
    definition.contextualArtifacts.forEach((artifact, index) => {
        // A rights rule, and the only one of the two below that is about rights: shipping a local
        // transcription of material whose reuse has not been cleared is a provenance defect whatever
        // the reading room does with it.
        if (artifact.textualRendition && artifact.rightsStatus !== 'reviewed') {
            context.addIssue({ code: 'custom', message: 'Only reviewed sources may provide a local textual rendition.', path: ['contextualArtifacts', index, 'textualRendition'] });
        }

        // **Context readiness must be able to become ready.** One rule, stated as the general shape,
        // because the two ways an author can break it have one cause and one consequence.
        //
        // `evaluateContextReadiness` counts an artifact missing while it is *ineligible or uninspected*,
        // and requires none missing before the player may leave the reading room. So every authored
        // artifact must be reachably inspectable, which takes two things at once:
        //
        // - `rightsStatus === 'reviewed'`, because that is the whole of `isSourceEligibleForInspection`.
        //   An artifact that is not reviewed is counted forever-missing, and `reduceSourceInspection`
        //   refuses `source.inspected` for it with `source-not-eligible` — so no surface can ever clear
        //   it. Assigned to this story by review decision 2026-08-07 (`deferred-work.md:75`).
        // - a `textualRendition`, because the reading room refuses to open an artifact with nothing to
        //   read (correctly, per Story 2.8 AC3) and so never dispatches `source.inspected` for it,
        //   while the reducer would have accepted it. Found in the 2.8 review.
        //
        // Either alone shuts the context gate permanently: readiness can never reach `ready`, and the
        // colleague's reading-gate line keeps naming a reference the room has just said cannot be read.
        // The selector is right in both cases — it is the *content* that is unauthorable, which is why
        // this is a load-time rule and `contextPredictionReadiness.ts` is untouched.
        //
        // Closed at load, once, with the offending artifact's own path: a case that cannot be finished
        // is a content defect, and an author needs to see it before a player does.
        const blocksReadiness = artifact.rightsStatus !== 'reviewed'
            ? 'is not reviewed, so it can never be inspected'
            : !artifact.textualRendition ? 'has no local textual rendition, so it can never be read' : undefined;
        if (blocksReadiness) {
            context.addIssue({
                code: 'custom',
                message: `Context readiness requires every authored source to be inspected, and this one ${blocksReadiness} — the gate could never open.`,
                path: ['contextualArtifacts', index, artifact.rightsStatus !== 'reviewed' ? 'rightsStatus' : 'textualRendition']
            });
        }

        // R1 and R2, source half (Story 3.3). Checked here rather than inside `LedgerEntrySchema`
        // because both compare the entry against the artifact's own `rightsStatus` one level up, which
        // a nested schema cannot see. The asset half of each lives in `AssetRightsSchema`, where the
        // status *is* beside the entry.
        //
        // Note the interaction with the readiness rule above, which is deliberate rather than
        // redundant: today every shipped source must be `reviewed` to be inspectable at all, so R1's
        // source half can only fire alongside it. It is authored anyway because it is a *different*
        // rule with a different owner — if the reading room ever gains an uninspectable source class,
        // the readiness rule relaxes and this one must not.
        if (artifact.rightsStatus !== 'reviewed' && artifact.ledgerEntry.replacementPlan === undefined) {
            context.addIssue({
                code: 'custom',
                message: 'A source whose rights are not reviewed must carry a replacement plan — an uncleared source with no plan is one nobody intends to fix.',
                path: ['contextualArtifacts', index, 'ledgerEntry', 'replacementPlan']
            });
        }
        // R1's converse, source half. Same defect as the asset half: a cleared row keeping the plan it
        // no longer needs states both that it may ship and that it may not.
        if (artifact.rightsStatus === 'reviewed' && artifact.ledgerEntry.replacementPlan !== undefined) {
            context.addIssue({
                code: 'custom',
                message: 'A source whose rights are reviewed must carry no replacement plan — a cleared row with a plan to replace it states both that it may ship and that it may not.',
                path: ['contextualArtifacts', index, 'ledgerEntry', 'replacementPlan']
            });
        }
        if (artifact.ledgerEntry.reviewerState === 'reviewed' && artifact.rightsStatus !== 'reviewed') {
            context.addIssue({
                code: 'custom',
                message: 'A reviewer cannot have signed off a source whose rights are not reviewed — a signature over uncleared rights represents unreviewed material as verified.',
                path: ['contextualArtifacts', index, 'ledgerEntry', 'reviewerState']
            });
        }
    });

    // R5. At least one primary source — **not** one of each. `MAX_CONTEXTUAL_ARTIFACTS` is 2 and
    // Young's two are *both* primary material (the 1801 Bakerian lecture and Newton's `Opticks`), so a
    // rule requiring a secondary would force a false provenance claim onto content that has shipped.
    if (!definition.contextualArtifacts.some(({ ledgerEntry }) => ledgerEntry.sourceRole === 'primary')) {
        context.addIssue({
            code: 'custom',
            message: 'At least one source must be primary material — a case built entirely on secondary sources cites nothing at first hand.',
            path: ['contextualArtifacts']
        });
    }
    if (definition.debrief.historicalComparison.sourceIds.some((sourceId) => !sourceIds.has(sourceId)
        || definition.debrief.historicalComparison.sourceIds[0] === definition.debrief.historicalComparison.sourceIds[1])) {
        context.addIssue({ code: 'custom', message: 'Historical comparison must cite two distinct authored sources.', path: ['debrief', 'historicalComparison', 'sourceIds'] });
    }
    const controlIds = new Set(definition.apparatus.primaryControls.map((control) => control.id));
    definition.consultationRules.forEach((rule, index) => {
        if (rule.predicate.kind === 'missing-source' && !sourceIds.has(rule.predicate.sourceId)) {
            context.addIssue({ code: 'custom', message: 'Consultation rules may only reference authored sources.', path: ['consultationRules', index, 'predicate', 'sourceId'] });
        }
        if (rule.predicate.kind === 'alternative-test' && !controlIds.has(rule.predicate.controlId)) {
            context.addIssue({ code: 'custom', message: 'Consultation rules may only reference authored controls.', path: ['consultationRules', index, 'predicate', 'controlId'] });
        }
        if (Object.values(rule.layers).some(encodesPath) || encodesPath(rule.nextStep)) {
            context.addIssue({ code: 'custom', message: 'Authored help content must not encode a scene, route, or phase path.', path: ['consultationRules', index] });
        }
    });
    definition.peerReviewRules.forEach((rule, index) => {
        if (encodesPath(rule.feedback) || encodesPath(rule.revisionPath)) {
            context.addIssue({ code: 'custom', message: 'Peer-review content must not encode a scene, route, or phase path.', path: ['peerReviewRules', index] });
        }
        if (rule.predicate.kind === 'overreach' && !rule.predicate.overreachPhrases) {
            context.addIssue({ code: 'custom', message: 'An overreach rule needs authored signal phrases.', path: ['peerReviewRules', index, 'predicate'] });
        }
    });

    // --- Colleague cast and proposals -----------------------------------------------------------

    const colleagueIds = new Set(definition.colleagues.map(({ id }) => id));
    if (colleagueIds.size !== definition.colleagues.length) {
        context.addIssue({ code: 'custom', message: 'Colleague IDs must be stable and unique.', path: ['colleagues'] });
    }
    const assetsById = new Map(definition.assets.entries.map((asset) => [asset.id, asset]));
    definition.colleagues.forEach((colleague, index) => {
        // A portrait naming an absent asset would pass the strict parse and then fail
        // `manifestsMatch` at load with a message about the manifest rather than the cast.
        const portraitAsset = colleague.portrait.kind === 'asset'
            ? assetsById.get(colleague.portrait.assetId)
            : undefined;
        if (colleague.portrait.kind === 'asset' && !portraitAsset) {
            context.addIssue({ code: 'custom', message: 'A colleague asset portrait must name an authored asset.', path: ['colleagues', index, 'portrait', 'assetId'] });
        }
        if (colleague.portrait.kind === 'asset' && portraitAsset?.type !== 'image') {
            context.addIssue({ code: 'custom', message: 'A colleague asset portrait must name an authored image asset.', path: ['colleagues', index, 'portrait', 'assetId'] });
        }
    });

    if (definition.rivalLab.portraitAssetId) {
        const portraitAsset = assetsById.get(definition.rivalLab.portraitAssetId);
        if (!portraitAsset) {
            context.addIssue({ code: 'custom', message: 'A rival-lab portrait must name an authored asset.', path: ['rivalLab', 'portraitAssetId'] });
        } else if (portraitAsset.type !== 'image') {
            context.addIssue({ code: 'custom', message: 'A rival-lab portrait must name an authored image asset.', path: ['rivalLab', 'portraitAssetId'] });
        }
    }

    // Unique *within* each set: a prediction and a conclusion proposal may share an id without
    // ambiguity, because each is looked up against its own set.
    ([['predictionProposals', definition.predictionProposals], ['conclusionProposals', definition.conclusionProposals]] as const)
        .forEach(([field, proposals]) => {
            if (new Set(proposals.map(({ id }) => id)).size !== proposals.length) {
                context.addIssue({ code: 'custom', message: 'Proposal IDs must be unique within each proposal set.', path: [field] });
            }
            proposals.forEach((proposal, index) => {
                if (!colleagueIds.has(proposal.colleagueId)) {
                    context.addIssue({ code: 'custom', message: 'Every proposal must be attributed to an authored colleague.', path: [field, index, 'colleagueId'] });
                }
            });
        });

    definition.predictionProposals.forEach((proposal, index) => {
        if (encodesPath(proposal.text)) {
            context.addIssue({ code: 'custom', message: 'Authored proposal copy must not encode a scene, route, or phase path.', path: ['predictionProposals', index, 'text'] });
        }
    });

    definition.conclusionProposals.forEach((proposal, index) => {
        if (encodesPath(proposal.claim) || encodesPath(proposal.limitation)) {
            context.addIssue({ code: 'custom', message: 'Authored proposal copy must not encode a scene, route, or phase path.', path: ['conclusionProposals', index] });
        }
        // An empty `all-of` is vacuously true, which would silently make an overreaching claim
        // defensible — the exact failure the `never` kind exists to express explicitly.
        if (hasEmptyAllOf(proposal.supportPredicate)) {
            context.addIssue({ code: 'custom', message: 'An all-of support predicate needs at least one child predicate.', path: ['conclusionProposals', index, 'supportPredicate'] });
        }
        flattenSupportPredicates(proposal.supportPredicate).forEach((leaf) => {
            if (leaf.kind === 'inspected-source' && !sourceIds.has(leaf.sourceId)) {
                context.addIssue({ code: 'custom', message: 'Conclusion proposals may only reference authored sources.', path: ['conclusionProposals', index, 'supportPredicate'] });
            }
            if ((leaf.kind === 'varied-control' || leaf.kind === 'unvaried-control-pinned') && !controlIds.has(leaf.controlId)) {
                context.addIssue({ code: 'custom', message: 'Conclusion proposals may only reference authored controls.', path: ['conclusionProposals', index, 'supportPredicate'] });
            }
        });
    });

    // Without this the case is uncompletable by construction: every conclusion on offer would be
    // one the evaluator can never defend, and no evidence the player gathers would change that.
    if (definition.conclusionProposals.length > 0 && !definition.conclusionProposals.some(({ supportPredicate }) => isSatisfiablePredicate(supportPredicate))) {
        context.addIssue({ code: 'custom', message: 'At least one conclusion proposal must be defensible on some evidence.', path: ['conclusionProposals'] });
    }

    // --- Significant-measure gate and colleague hints (Story 2.6) -------------------------------
    //
    // Here rather than in the field schemas: every rule below is about the rule and the hints
    // *against the authored controls and cast*, which neither schema can see.

    definition.significanceRule.criticalControlIds.forEach((controlId, index) => {
        if (!controlIds.has(controlId)) {
            context.addIssue({
                code: 'custom',
                message: 'The significance rule may only name authored primary controls.',
                path: ['significanceRule', 'criticalControlIds', index]
            });
        }
    });
    if (new Set(definition.significanceRule.criticalControlIds).size !== definition.significanceRule.criticalControlIds.length) {
        context.addIssue({
            code: 'custom',
            message: 'The significance rule must not name the same control twice.',
            path: ['significanceRule', 'criticalControlIds']
        });
    }
    const criticalModelInputIds = definition.significanceRule.criticalModelInputIds ?? [];
    if (new Set(criticalModelInputIds).size !== criticalModelInputIds.length) {
        context.addIssue({
            code: 'custom',
            message: 'The significance rule must not name the same model input twice.',
            path: ['significanceRule', 'criticalModelInputIds']
        });
    }

    const hintIds = definition.colleagueHints.map(({ id }) => id);
    if (new Set(hintIds).size !== hintIds.length) {
        context.addIssue({ code: 'custom', message: 'Colleague hint IDs must be stable and unique.', path: ['colleagueHints'] });
    }
    definition.colleagueHints.forEach((hint, index) => {
        if (!colleagueIds.has(hint.colleagueId)) {
            context.addIssue({
                code: 'custom',
                // The rival lab is deliberately not in `colleagues[]`, so this also stops an author
                // putting the challenger's voice behind a helpful nudge.
                message: 'Every colleague hint must be attributed to an authored colleague.',
                path: ['colleagueHints', index, 'colleagueId']
            });
        }
        if (hint.predicate.kind === 'unvaried-control' && !controlIds.has(hint.predicate.controlId)) {
            context.addIssue({
                code: 'custom',
                message: 'Colleague hints may only reference authored controls.',
                path: ['colleagueHints', index, 'predicate', 'controlId']
            });
        }
        // Naming a control the significance rule does not consider critical produces advice that
        // cannot work: the player varies exactly what they were told to, the configuration key never
        // changes, the count never moves, and the gate refuses again with the same hint. A colleague
        // must not send someone to do something that provably cannot open the way on.
        if (hint.predicate.kind === 'unvaried-control'
            && controlIds.has(hint.predicate.controlId)
            && !new Set<string>(definition.significanceRule.criticalControlIds).has(hint.predicate.controlId)) {
            context.addIssue({
                code: 'custom',
                message: 'A colleague hint may only ask the player to vary a control the significance rule treats as critical.',
                path: ['colleagueHints', index, 'predicate', 'controlId']
            });
        }
        if (encodesPath(hint.line)) {
            context.addIssue({
                code: 'custom',
                message: 'Colleague hint copy must not encode a scene, route, or phase path.',
                path: ['colleagueHints', index, 'line']
            });
        }
    });

    // The floor that makes the gate honest, and the two things that have to be true about it.
    //
    // Only `below-significant-measures` actually delivers the guarantee. An earlier version of this
    // rule accepted `no-recorded-runs` as an alternative (review, 2026-08-06), but that predicate
    // holds *only* with an empty notebook: a case authoring it alone passes validation and then goes
    // silent the instant the player records their first run — the advance refused, nothing said, no
    // way to learn what would help. That is the silent dead end AC2 forbids, reached through a rule
    // written to prevent it.
    const floorIndex = definition.colleagueHints.findIndex(({ predicate }) => predicate.kind === 'below-significant-measures');
    if (floorIndex === -1) {
        context.addIssue({
            code: 'custom',
            message: 'Colleague hints must include a below-significant-measures hint, so the gate always has something to say.',
            path: ['colleagueHints']
        });
    } else if (floorIndex !== definition.colleagueHints.length - 1) {
        // Selection is first-match in authored order and this predicate is unconditionally true, so
        // anywhere but last it shadows every hint after it: the escalation ladder silently collapses
        // to one generic line at every stage, and the specific hints become unreachable content that
        // no test and no validation would otherwise notice. Authoring more than one is caught here
        // too, because the earlier of them cannot be last.
        context.addIssue({
            code: 'custom',
            message: 'The below-significant-measures hint must be the last authored hint, or it shadows every hint after it.',
            path: ['colleagueHints', floorIndex]
        });
    }

    // --- Reading-gate lines (Story 2.8) -----------------------------------------------------------
    //
    // Every guarantee `colleagueHints` gets, for the same reasons, against the artifacts rather than
    // the runs. The two lists are siblings and their validation is deliberately symmetrical: a defect
    // found in one is a defect in the other, and asymmetric rules are how the pair would drift.
    const readingGateHintIds = definition.readingGateHints.map(({ id }) => id);
    if (new Set(readingGateHintIds).size !== readingGateHintIds.length) {
        context.addIssue({ code: 'custom', message: 'Reading-gate line IDs must be stable and unique.', path: ['readingGateHints'] });
    }
    definition.readingGateHints.forEach((hint, index) => {
        if (!colleagueIds.has(hint.colleagueId)) {
            context.addIssue({
                code: 'custom',
                // The rival lab is deliberately not in `colleagues[]`, so this also stops an author
                // putting the challenger's voice behind a helpful nudge.
                message: 'Every reading-gate line must be attributed to an authored colleague.',
                path: ['readingGateHints', index, 'colleagueId']
            });
        }
        // Naming an artifact this case does not carry produces a line no player can ever be shown:
        // the predicate is matched against `missingArtifactIds`, which is drawn from
        // `contextualArtifacts`, so the entry is silently unreachable content.
        if (hint.predicate.kind === 'missing-artifact' && !sourceIds.has(hint.predicate.artifactId)) {
            context.addIssue({
                code: 'custom',
                message: 'A reading-gate line may only name an authored contextual artifact.',
                path: ['readingGateHints', index, 'predicate', 'artifactId']
            });
        }
        if (encodesPath(hint.line)) {
            context.addIssue({
                code: 'custom',
                message: 'Reading-gate copy must not encode a scene, route, or phase path.',
                path: ['readingGateHints', index, 'line']
            });
        }
    });

    // The floor that makes this gate honest, on exactly the terms `colleagueHints` states above: only
    // `any-missing-reading` is unconditionally true for an unmet gate, and selection is first-match in
    // authored order, so anywhere but last it shadows every line after it.
    const readingFloorIndex = definition.readingGateHints.findIndex(({ predicate }) => predicate.kind === 'any-missing-reading');
    if (readingFloorIndex === -1) {
        context.addIssue({
            code: 'custom',
            message: 'Reading-gate lines must include an any-missing-reading line, so the gate always has something to say.',
            path: ['readingGateHints']
        });
    } else if (readingFloorIndex !== definition.readingGateHints.length - 1) {
        context.addIssue({
            code: 'custom',
            message: 'The any-missing-reading line must be the last authored line, or it shadows every line after it.',
            path: ['readingGateHints', readingFloorIndex]
        });
    }

    // --- Rival lab ------------------------------------------------------------------------------
    //
    // Here rather than in `RivalLabSchema`'s own refinement: every rule below is about the critiques
    // *against the conclusion proposals*, which that schema cannot see.

    const critiqueIds = definition.rivalLab.critiques.map(({ id }) => id);
    if (new Set(critiqueIds).size !== critiqueIds.length) {
        context.addIssue({ code: 'custom', message: 'Rival-lab critique IDs must be stable and unique.', path: ['rivalLab', 'critiques'] });
    }
    const conclusionIds = new Set(definition.conclusionProposals.map(({ id }) => id));
    definition.rivalLab.critiques.forEach((critique, index) => {
        if (!conclusionIds.has(critique.proposalId)) {
            context.addIssue({
                code: 'custom',
                message: 'Every rival-lab critique must answer an authored conclusion proposal.',
                path: ['rivalLab', 'critiques', index, 'proposalId']
            });
        }
        if (encodesPath(critique.line)) {
            context.addIssue({
                code: 'custom',
                message: 'Rival-lab copy must not encode a scene, route, or phase path.',
                path: ['rivalLab', 'critiques', index, 'line']
            });
        }
    });
    // Total coverage is what makes critique selection total, and it is why no generic fallback line
    // exists: a conclusion the rival has nothing to say about would submit into silence.
    const critiquedProposalIds = new Set(definition.rivalLab.critiques.map(({ proposalId }) => proposalId));
    if (definition.conclusionProposals.some(({ id }) => !critiquedProposalIds.has(id))) {
        context.addIssue({
            code: 'custom',
            message: 'Every conclusion proposal must carry at least one rival-lab critique.',
            path: ['rivalLab', 'critiques']
        });
    }

    // --- Scenario cast and dialogue beats ---------------------------------------------------------
    //
    // Here rather than in `ScenarioScriptSchema`'s own refinement: that one cannot see `colleagues`,
    // and neither a speaker nor a cast is meaningful except against the authored cast.

    definition.scenarioScript.scenes.forEach((scene, sceneIndex) => {
        const scenePath = ['scenarioScript', 'scenes', sceneIndex];
        const cast = scene.cast;

        if (cast) {
            const castPath = [...scenePath, 'cast'];

            // Absence means "the whole cast"; `[]` would have to mean "nobody", and no scene that draws
            // a figure column can render that. See the shape's own note for why the floor is here and
            // not a `.min(1)`, and for the deliberate asymmetry with `dialogueBeats`.
            if (cast.length === 0) {
                context.addIssue({
                    code: 'custom',
                    message: 'An authored scene cast must name at least one colleague. Omit the field to stage the whole cast.',
                    path: castPath
                });
            }

            // A repeat would stage one figure twice and halve the slot width for everybody on the board.
            if (new Set(cast).size !== cast.length) {
                context.addIssue({
                    code: 'custom',
                    message: 'A scene cast must not name the same colleague twice.',
                    path: castPath
                });
            }

            // A cast on a scene that draws no figure column is shipped-and-dead content. It is also the
            // authoring mistake this field invites most: `cast` reads like "who appears in this part of
            // the story" rather than "who stands in this board's figure column".
            if (!stagesFigureColumn(scene.sceneKey)) {
                context.addIssue({
                    code: 'custom',
                    message: `Only a scene that stages a figure column may author a cast (${FIGURE_STAGING_SCENE_KEYS.join(', ')}).`,
                    path: castPath
                });
            }

            cast.forEach((colleagueId, castIndex) => {
                if (!colleagueIds.has(colleagueId)) {
                    context.addIssue({
                        code: 'custom',
                        // The rival lab is deliberately not a member of `colleagues[]`, so this also
                        // stops an author staging the challenger among the colleagues — the same
                        // reasoning the colleague-hint rule gives above.
                        message: 'Every scene cast member must be an authored colleague.',
                        path: [...castPath, castIndex]
                    });
                }
            });

            // **The sixth rule, added by Story 3.4's code review.** A board attributes proposals to
            // colleagues, and selecting a proposal brings its author forward — 2.9's AC3. That emphasis
            // is a match on `colleagueId` against the staged set, with no fallback: a proposal whose
            // author the scene's cast leaves out is selectable, is attributed on the card, and
            // foregrounds nobody. Silent, and the same graceful-degradation shape as a `cast` that is
            // ignored or an `affordance` drawn as a knob.
            //
            // Keyed on **phase**, not on scene key, for the reason `selectDialogueBeats` is: the theory
            // board hosts `synthesis` and `review` as separate script entries, and a key-based lookup
            // would read one board's proposals for the other's.
            //
            // The reverse rule is deliberately *not* imposed — a cast may include somebody who authored
            // no proposal on this board. Staging is who is in the room; attribution is who wrote a card.
            if (cast.length > 0) {
                const boardProposals = scene.phase === 'prediction'
                    ? definition.predictionProposals
                    : (scene.phase === 'synthesis' || scene.phase === 'review')
                        ? definition.conclusionProposals
                        : undefined;
                boardProposals?.forEach((proposal, proposalIndex) => {
                    if (!cast.includes(proposal.colleagueId)) {
                        context.addIssue({
                            code: 'custom',
                            message: "Every proposal on a staged board must be attributed to a member of that scene's cast, or selecting it brings nobody forward.",
                            path: [
                                scene.phase === 'prediction' ? 'predictionProposals' : 'conclusionProposals',
                                proposalIndex,
                                'colleagueId'
                            ]
                        });
                    }
                });
            }
        }

        const beats = scene.dialogueBeats;
        if (!beats) return;
        const beatPath = [...scenePath, 'dialogueBeats'];
        // Unique *within* a scene. Across scenes a beat id may repeat: a scene is the unit a
        // conversation belongs to, and `prediction` and `review` both reasonably open with `intro`.
        if (new Set(beats.map(({ id }) => id)).size !== beats.length) {
            context.addIssue({ code: 'custom', message: 'Dialogue beat IDs must be unique within a scene.', path: beatPath });
        }
        beats.forEach((beat, beatIndex) => {
            if (!colleagueIds.has(beat.speakerId)) {
                context.addIssue({
                    code: 'custom',
                    message: 'Every dialogue beat must be spoken by an authored colleague.',
                    path: [...beatPath, beatIndex, 'speakerId']
                });
            }
            // Narrower than the rule above, and the one that makes an authored cast safe: a beat spoken
            // by somebody the scene does not stage plays with nobody on stage. Skipped for an empty
            // cast, which is already refused above — one defect, one message.
            if (cast && cast.length > 0 && !cast.includes(beat.speakerId)) {
                context.addIssue({
                    code: 'custom',
                    message: "Every dialogue beat must be spoken by a member of its own scene's cast.",
                    path: [...beatPath, beatIndex, 'speakerId']
                });
            }
            if (encodesPath(beat.text)) {
                context.addIssue({
                    code: 'custom',
                    message: 'Authored dialogue copy must not encode a scene, route, or phase path.',
                    path: [...beatPath, beatIndex, 'text']
                });
            }
        });
    });
});
