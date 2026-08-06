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
 * A discriminated union so a case can ship a cast without commissioning portrait art.
 *
 * `silhouette` draws an accent-coloured stand-in from the case data alone; `asset` names an entry
 * that must already exist in `assets.entries`, because `loadCaseDefinition`'s `manifestsMatch`
 * requires `case.json` and `asset-manifest.json` to agree exactly.
 */
export type ColleaguePortrait =
    | Readonly<{ kind: 'asset'; assetId: string }>
    | Readonly<{ kind: 'silhouette'; accentColor: string }>;

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
