import type { LocalizedText, PrimaryControl } from './CaseDefinition';

/**
 * The authored cast that voices the prediction and conclusion proposals, and the proposals
 * themselves.
 *
 * Pure content types — no Phaser, no DOM, no Zod. `src/schemas/CaseDefinitionSchema.ts` validates
 * the JSON against these shapes at the content boundary (ADR-003), and the pure evaluator in
 * `src/domain/theory/conclusionProposals.ts` interprets `supportPredicate`.
 */

/**
 * A stable enum, not authored prose: the role is resolved for display through
 * `t('colleague.role.<role>')`, so a saved value never depends on the interface language. The four
 * values are the voice distinctions the Young team is written around (`narrative-design.md`
 * §Young Team).
 */
export type ColleagueRole = 'lead' | 'builder' | 'analyst' | 'communicator';

/**
 * How an authored figure differs from every other figure on the stage, with colour taken away.
 *
 * AC2 of Story 2.9 requires that identity never rest on colour alone. The first two implementations
 * drew one silhouette recoloured per colleague, which satisfied the rule on the cards and broke it on
 * the stage; this is the fix. Each field is a **closed vocabulary**, never free-form art direction:
 * the room is lit warm and dark, and an authored `#hair` would eventually be a colour that does not
 * sit in that light. `src/adapters/phaser/renderers/figureAppearance.ts` maps each value to a tone.
 *
 * Every field is optional and unauthored figures still differ, because the role implies the pose —
 * an instrument maker holds a clipboard, a communicator explains with their hands. What a role must
 * **not** imply is build, hair or face: nothing about being an analyst implies a gown, and inferring a
 * character's presentation from their role or their name is how a named character gets drawn wrong.
 */
export type FigureBuild = 'suited' | 'gowned';

/**
 * What the figure is doing with their hands.
 *
 * Five, because five is what the design board shows and because each is a silhouette still distinct at
 * 76px wide — a sixth would be a difference nobody could see.
 */
export type FigurePose =
    | 'at-rest'
    | 'arms-folded'
    | 'holding-paper'
    | 'raising-instrument'
    | 'presenting';

/** Cropped and combed, swept with a fringe, or pinned up with a bun. */
export type FigureHair = 'cropped' | 'swept' | 'upswept';
export type FigureHairColor = 'dark' | 'auburn' | 'fair' | 'grey';
export type FigureSkinTone = 'light' | 'tan' | 'brown' | 'deep';

export type ColleagueFigure = Readonly<{
    build?: FigureBuild;
    pose?: FigurePose;
    hair?: FigureHair;
    hairColor?: FigureHairColor;
    skinTone?: FigureSkinTone;
    spectacles?: boolean;
    moustache?: boolean;
}>;

/**
 * A discriminated union so a case can ship a cast without commissioning portrait art.
 *
 * `silhouette` draws an accent-coloured stand-in from the case data alone; `asset` names an entry
 * that must already exist in `assets.entries`, because `loadCaseDefinition`'s `manifestsMatch`
 * requires `case.json` and `asset-manifest.json` to agree exactly.
 *
 * `figure` refines the silhouette and never replaces it: the accent is still the garment, because the
 * card stripe, the dialogue speaker name and the figure all read that one field and have to agree.
 */
export type ColleaguePortrait =
    | Readonly<{ kind: 'asset'; assetId: string }>
    | Readonly<{ kind: 'silhouette'; accentColor: string; figure?: ColleagueFigure }>;

export type Colleague = Readonly<{
    /** Canonical: a stable key, never display text. */
    id: string;
    /** Canonical: a proper noun, following the `creatorOrOrigin` precedent — not translated copy. */
    name: string;
    role: ColleagueRole;
    portrait: ColleaguePortrait;
}>;

export type PredictionProposal = Readonly<{
    id: string;
    colleagueId: string;
    text: LocalizedText;
}>;

/**
 * A declarative predicate over authoritative evidence, authored as data (ADR-003/ADR-006).
 *
 * `game-architecture.md` sketches `supportPredicate(progress)` as a call; that is pseudo-code. Case
 * content is versioned JSON, a JSON file cannot carry a function, and `eval`/`new Function` is not
 * an option — so this mirrors the existing `ConsultationPredicate` union and is interpreted by a
 * pure evaluator.
 *
 * `never` marks an overreaching claim that no amount of recorded evidence defends.
 */
export type ConclusionSupportPredicate =
    | Readonly<{ kind: 'never' }>
    | Readonly<{ kind: 'minimum-runs'; count: number }>
    /** At least two distinct recorded values for that control. */
    | Readonly<{ kind: 'varied-control'; controlId: PrimaryControl['id'] }>
    | Readonly<{ kind: 'inspected-source'; sourceId: string }>
    | Readonly<{ kind: 'all-of'; predicates: readonly ConclusionSupportPredicate[] }>;

export type ConclusionProposal = Readonly<{
    id: string;
    colleagueId: string;
    claim: LocalizedText;
    limitation: LocalizedText;
    /**
     * Read by the evaluator and, later, the rival-lab critique. Never by a scene: a surface must
     * not display or imply which conclusion is defensible before the critique does (ADR-006).
     */
    supportPredicate: ConclusionSupportPredicate;
}>;

/**
 * When an authored colleague hint applies, evaluated against the recorded runs and nothing else
 * (Story 2.6).
 *
 * Authored data rather than a function, for the same reason {@link ConclusionSupportPredicate} is:
 * case content is versioned JSON, a JSON file cannot carry a function, and `eval` is not an option.
 * The shape deliberately mirrors `ConsultationPredicate` — this is its sibling, not its replacement.
 *
 * `below-significant-measures` is the catch-all floor: it applies whenever the gate is unmet, so an
 * author can guarantee the gate always has something to say without enumerating every evidence
 * shape. Authored order is the escalation order, so put the specific predicates first.
 */
export type ColleagueHintPredicate =
    /** Nothing recorded at all. */
    | Readonly<{ kind: 'no-recorded-runs' }>
    /** At least two runs share one critical configuration — a replication, not a variation. */
    | Readonly<{ kind: 'repeated-configuration' }>
    /** Every recorded run shares a single value for that control. */
    | Readonly<{ kind: 'unvaried-control'; controlId: PrimaryControl['id'] }>
    /** True whenever the significant-measure gate is unmet. Always satisfiable. */
    | Readonly<{ kind: 'below-significant-measures' }>;

/**
 * One authored in-fiction nudge, spoken by a member of the cast when the significant-measure gate
 * is unmet.
 *
 * `line` is display prose — `LocalizedText`, resolved from the definition at display time — and a
 * hint is never persisted, so an author may rewrite one without touching a saved investigation.
 *
 * A hint names a measurement or a variable to vary. It never states a conclusion, never ranks the
 * proposals, and never names a scene, phase, or route (`encodesPath` rejects the last).
 */
export type ColleagueHint = Readonly<{
    id: string;
    colleagueId: string;
    predicate: ColleagueHintPredicate;
    line: LocalizedText;
}>;

/**
 * When an authored reading-gate line applies, evaluated against the inspected contextual artifacts and
 * nothing else (Story 2.8).
 *
 * The sibling of {@link ColleagueHintPredicate}, not a widening of it. The two answer different gates
 * from different evidence — this one reads `inspectedSourceIds`, that one reads `runs` — and
 * `selectColleagueHint` short-circuits on the significant-measure count before its predicates run at
 * all, so a `missing-artifact` entry added there would never be reached in the `context` phase.
 *
 * `any-missing-reading` is the catch-all floor: it applies whenever the gate is unmet, so an author
 * can guarantee the gate always has something to say without enumerating every artifact. Authored
 * order is the escalation order, so put the specific predicates first.
 */
export type ReadingGateHintPredicate =
    /** That one contextual artifact is still outstanding — unread, or not reviewable as evidence. */
    | Readonly<{ kind: 'missing-artifact'; artifactId: string }>
    /** True whenever any required reading is outstanding. Always satisfiable. */
    | Readonly<{ kind: 'any-missing-reading' }>;

/**
 * One authored in-fiction nudge, spoken by a member of the cast when the required reading is
 * incomplete and the player tries to leave the reading room (Story 2.8, AC4).
 *
 * Shaped exactly like {@link ColleagueHint} — `line` is display prose resolved at display time, and a
 * line is never persisted, so an author may rewrite one without touching a saved investigation.
 *
 * A line names a *reading*. It never names a scene, phase, or route (`encodesPath` rejects the last),
 * and it never states a conclusion or ranks the proposals.
 */
export type ReadingGateHint = Readonly<{
    id: string;
    colleagueId: string;
    predicate: ReadingGateHintPredicate;
    line: LocalizedText;
}>;
