import type { CaseDefinition, LocalizedText, ReviewerSignOff, ReviewerState } from '../cases/CaseDefinition';
import { selectLedgerRows } from './caseLedger';
import { evaluateLedgerReleaseApproval, type LedgerBlockerKind } from './releaseApproval';
import type { Locale } from '../../core/i18n/Locale';
import { resolveLocalizedText } from '../../core/i18n/resolveLocalizedText';
import { createTranslator } from '../../core/i18n/translate';

/**
 * The reviewer's audit of one case's sources, assets, sign-off and references, as text.
 *
 * **This is a generated report, not a surface, and that is a deliberate correction.** Story 3.3 shipped
 * it as `src/ui/SourceRightsLedger.ts` — a `?ledger=1` route mounting tables into the document — which
 * added a fourth module to `src/ui/` against `project-context.md` §Engine: "`src/ui/` holds exactly
 * three modules, and that is the whole non-Phaser surface set (Story 2.12) … Do not add a fourth." The
 * story argued it joined `ValidationSessionDisclosure`'s exemption class; the code review found that
 * argument foreclosed, because ADR-007's exemption is a *capability* one — printing and file export
 * cross a boundary a canvas cannot — while a rights table is text, which this project already renders
 * in Phaser in the case file, the notebook and the theory board. `game-architecture.md` §System Location
 * Mapping also assigns rights/provenance presentation to `src/domain/sources/` and `LibraryScene`, not
 * to `src/ui/`.
 *
 * Epic 3's own acceptance criterion says "**when** a reviewer **opens** its ledger" and names no route,
 * so a generated markdown artifact satisfies it — and satisfies it better in one respect: two documents
 * already claimed their tables were "read from this case's authored `ledger` block rather than
 * transcribed", which was false of hand-written markdown and is true of this.
 *
 * `npm run audit:ledger` writes the tables into `docs/source-rights/`. Nothing here touches a document,
 * a file, or the network: the projection is pure and the writing lives in `scripts/auditLedger.mjs`.
 *
 * **The banner never stands alone.** A report that says `blocked` without saying what blocks it is not
 * visible blocking: the decision and the named blocker list are built together, always, and the blocker
 * list is the part a reviewer acts on.
 */

/**
 * One table's worth of readable text. `subject` is a stable identifier, not display text.
 *
 * Getting from a blocker to the row it names is `findLedgerRow`'s job, and it is not the identity
 * mapping: the code review found that three of the blocker kinds could not be traversed at all, because
 * every case-level blocker carries `definition.id` as its `subjectId` while the row holding that role is
 * keyed by the role name (`scholarlyReviewer`). The resolution is that a **blocker kind already names
 * its role uniquely**, so the kind decides the row. An earlier attempt at this gave every role row the
 * case ID as a second anchor, which made all three case-level rows equally matchable and resolved every
 * one of them to `contentAuthor` — visible in the generated report on the first run.
 */
export interface LedgerTableText {
    readonly testId: string;
    readonly title: string;
    readonly headers: readonly string[];
    readonly rows: readonly LedgerRowText[];
}

export interface LedgerRowText {
    /** The row's own stable identifier — a source ID, an asset ID, or a role key. */
    readonly subject: string;
    readonly cells: readonly string[];
}

export interface LedgerBlockerText {
    readonly kind: LedgerBlockerKind;
    readonly subjectId: string;
    readonly text: string;
}

export interface SourceRightsLedgerText {
    readonly title: string;
    readonly caseLine: string;
    readonly decision: 'blocked' | 'clear';
    readonly decisionText: string;
    readonly blockersTitle: string;
    /** Localized label preceding a blocker-to-row reference in the generated markdown. */
    readonly blockerRowReference: string;
    /** The statement shown when there are none, so a cleared ledger says so rather than showing a gap. */
    readonly blockersNone: string;
    readonly blockers: readonly LedgerBlockerText[];
    readonly tables: readonly LedgerTableText[];
}

/** A `de-scoped` role reads with its reference — "De-scoped (ADR-008)" — so the decision is on the page. */
const formatReviewerState = (
    state: ReviewerState,
    reference: string | undefined,
    t: ReturnType<typeof createTranslator>
): string => {
    const label = t(`ledger.reviewer.${state}` as 'ledger.reviewer.reviewed');
    return state === 'de-scoped' && reference !== undefined
        ? t('ledger.reviewer.withReference', { state: label, reference })
        : label;
};

/**
 * Everything the ledger says, in the active locale, decided without touching a document.
 *
 * `locale` is required with no `DEFAULT_LOCALE` default, for the reason
 * `mountValidationSessionDisclosure` states: a silent default turns a call site that forgot the locale
 * from a `tsc` failure into a French reviewer silently reading an English ledger.
 */
export const getSourceRightsLedgerText = (definition: CaseDefinition, locale: Locale): SourceRightsLedgerText => {
    const t = createTranslator(locale);
    const text = (value: LocalizedText): string => resolveLocalizedText(value, locale);
    const { sources, assets } = selectLedgerRows(definition);
    const approval = evaluateLedgerReleaseApproval(definition);
    const absent = t('ledger.absent');
    const plan = (value: LocalizedText | undefined): string => value === undefined ? absent : text(value);

    const signOffRoles: readonly (readonly [string, ReviewerSignOff])[] = [
        ['contentAuthor', definition.ledger.signOff.contentAuthor],
        ['scholarlyReviewer', definition.ledger.signOff.scholarlyReviewer],
        ['accessibilityReviewer', definition.ledger.signOff.accessibilityReviewer]
    ];
    // The two FR26 references that are neither a source, an asset nor a sign-off. Both are listed
    // whatever their state: a `de-scoped` reference is recorded and not dropped, which is the whole
    // reason `de-scoped` is a state rather than an absence.
    const references: readonly (readonly [string, ReviewerSignOff])[] = [
        ['educatorContextSheet', definition.ledger.educatorContextSheet],
        ['accessibleControlsReference', definition.ledger.accessibleControlsReference]
    ];

    return {
        title: t('ledger.title'),
        caseLine: t('ledger.caseLine', { title: text(definition.title), id: definition.id, version: definition.version }),
        decision: approval.decision,
        decisionText: t(`ledger.decision.${approval.decision}` as 'ledger.decision.blocked'),
        blockersTitle: t('ledger.blockers.title'),
        blockerRowReference: t('ledger.blocker.rowReference'),
        blockersNone: t('ledger.blockers.none'),
        blockers: approval.blockers.map(({ kind, subjectId }) => ({
            kind,
            subjectId,
            text: t(`ledger.blocker.${kind}` as 'ledger.blocker.source-rights-incomplete', { subject: subjectId })
        })),
        tables: [
            {
                testId: 'ledger-sources',
                title: t('ledger.sources.title'),
                headers: [
                    t('ledger.column.source'), t('ledger.column.role'), t('ledger.column.type'),
                    t('ledger.column.provenance'), t('ledger.column.reference'), t('ledger.column.rights'),
                    t('ledger.column.reviewer'), t('ledger.column.claimOrUse'), t('ledger.column.citation'),
                    t('ledger.column.replacementPlan')
                ],
                rows: sources.map((source) => ({
                    subject: source.id,
                    cells: [
                        `${text(source.displayName)} — ${source.creatorOrOrigin}`,
                        t(`ledger.role.${source.sourceRole}` as 'ledger.role.primary'),
                        t(`source.type.${source.sourceType}` as 'source.type.lecture-record'),
                        t(`source.provenanceName.${source.provenanceCategory}` as 'source.provenanceName.primary-material'),
                        // Canonical: a stable provenance key, never display text.
                        source.provenanceReference,
                        // The existing `source.rights.*` family, not a second one: one vocabulary for
                        // rights status across the reading room, the debrief and the ledger.
                        t(`source.rights.${source.rightsStatus}` as 'source.rights.reviewed'),
                        formatReviewerState(source.reviewerState, undefined, t),
                        text(source.claimOrUse),
                        // Canonical, both halves: a bibliographic citation and an archive link do not
                        // change language.
                        source.citationText === undefined
                            ? absent
                            : `${source.citationText}${source.archiveUrl === undefined ? '' : ` · ${source.archiveUrl}`}`,
                        plan(source.replacementPlan)
                    ]
                }))
            },
            {
                testId: 'ledger-assets',
                title: t('ledger.assets.title'),
                headers: [
                    t('ledger.column.asset'), t('ledger.column.path'), t('ledger.column.holder'),
                    t('ledger.column.rights'), t('ledger.column.reviewer'), t('ledger.column.claimOrUse'),
                    t('ledger.column.reference'), t('ledger.column.replacementPlan')
                ],
                rows: assets.map((asset) => ({
                    subject: asset.id,
                    cells: [
                        asset.id,
                        asset.path,
                        asset.holderOrOrigin,
                        t(`source.rights.${asset.status}` as 'source.rights.reviewed'),
                        formatReviewerState(asset.reviewerState, undefined, t),
                        text(asset.claimOrUse),
                        asset.provenanceReference,
                        plan(asset.replacementPlan)
                    ]
                }))
            },
            {
                testId: 'ledger-sign-off',
                title: t('ledger.signOff.title'),
                headers: [t('ledger.column.role'), t('ledger.column.state'), t('ledger.column.name'), t('ledger.column.date')],
                rows: signOffRoles.map(([key, signOff]) => ({
                    subject: key,
                    cells: [
                        t(`ledger.role.${key}` as 'ledger.role.contentAuthor'),
                        formatReviewerState(signOff.state, signOff.reference, t),
                        // Canonical: a reviewer's name and a sign-off date are not display copy.
                        signOff.name ?? absent,
                        signOff.date ?? absent
                    ]
                }))
            },
            {
                testId: 'ledger-references',
                title: t('ledger.references.title'),
                headers: [t('ledger.column.reference'), t('ledger.column.state'), t('ledger.column.decision')],
                rows: references.map(([key, reference]) => ({
                    subject: key,
                    cells: [
                        t(`ledger.role.${key}` as 'ledger.role.educatorContextSheet'),
                        formatReviewerState(reference.state, reference.reference, t),
                        reference.reference ?? absent
                    ]
                }))
            }
        ]
    };
};

/**
 * Where each blocker kind's row lives: its table, and — for a case-level role — which row.
 *
 * A role blocker's `subjectId` is the *case* ID, because the case is what is blocked; the row stating the
 * role is keyed by the role. So the kind carries the row key and the `subjectId` is not used for the
 * lookup. The two row kinds keyed by `subjectId` (`subject: null`) are the per-source and per-asset ones,
 * where the ID in the blocker genuinely is the row's own ID.
 */
const LEDGER_BLOCKER_ROWS: Readonly<Record<LedgerBlockerKind, Readonly<{ testId: string; subject: string | null }>>> = {
    'source-rights-incomplete': { testId: 'ledger-sources', subject: null },
    'asset-rights-incomplete': { testId: 'ledger-assets', subject: null },
    'content-author-unrecorded': { testId: 'ledger-sign-off', subject: 'contentAuthor' },
    'scholarly-review-pending': { testId: 'ledger-sign-off', subject: 'scholarlyReviewer' },
    'accessibility-review-pending': { testId: 'ledger-sign-off', subject: 'accessibilityReviewer' },
    'educator-context-sheet-pending': { testId: 'ledger-references', subject: 'educatorContextSheet' },
    'accessible-controls-reference-pending': { testId: 'ledger-references', subject: 'accessibleControlsReference' }
};

/**
 * The row a blocker names, or `undefined` when no row claims it.
 *
 * Resolved by kind rather than by identifier alone, for the reason `LEDGER_BLOCKER_ROWS` states. This
 * also sidesteps a namespace collision the review probed: source IDs and asset IDs share one space, and
 * nothing prevents a future case from authoring the same ID in both — pairing the table with the kind
 * keeps the lookup unambiguous without imposing a cross-collection uniqueness rule on authors.
 */
export const findLedgerRow = (
    content: SourceRightsLedgerText,
    blocker: LedgerBlockerText
): LedgerRowText | undefined => {
    const { testId, subject } = LEDGER_BLOCKER_ROWS[blocker.kind];
    return content.tables
        .find((table) => table.testId === testId)
        ?.rows.find((row) => row.subject === (subject ?? blocker.subjectId));
};

/** A markdown cell: pipes and newlines would otherwise break the row they sit in. */
const markdownCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/**
 * The report as markdown, for `npm run audit:ledger` to write into `docs/source-rights/`.
 *
 * Pure, and separate from the projection above so the tables can be asserted as *text* — the same reason
 * `getSourceRightsLedgerText` is separate from what used to render it. `generatedNotice` is passed in
 * rather than built here because it names the command that produced the file, which is the script's
 * business, and because a timestamp inside a pure function would make this untestable.
 */
export const renderLedgerMarkdown = (content: SourceRightsLedgerText, generatedNotice: string): string => {
    const lines: string[] = [`# ${content.title}`, '', generatedNotice, '', content.caseLine, ''];

    lines.push(`**${content.decisionText}**`, '', `## ${content.blockersTitle}`, '');
    if (content.blockers.length === 0) {
        lines.push(content.blockersNone, '');
    } else {
        // The row reference is the point of the list: a named blocker a reviewer cannot locate is the
        // defect this report exists to avoid.
        content.blockers.forEach((blocker) => {
            const row = findLedgerRow(content, blocker);
            const where = row === undefined ? '' : ` — ${content.blockerRowReference} \`${row.subject}\``;
            lines.push(`- ${blocker.text}${where}`);
        });
        lines.push('');
    }

    content.tables.forEach((table) => {
        lines.push(`## ${table.title}`, '');
        lines.push(`| ${table.headers.map(markdownCell).join(' | ')} |`);
        lines.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
        table.rows.forEach((row) => lines.push(`| ${row.cells.map(markdownCell).join(' | ')} |`));
        lines.push('');
    });

    return `${lines.join('\n').trimEnd()}\n`;
};
