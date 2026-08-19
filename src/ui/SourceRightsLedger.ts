import type { CaseDefinition, LocalizedText, ReviewerSignOff, ReviewerState } from '../domain/cases/CaseDefinition';
import { selectLedgerRows } from '../domain/sources/caseLedger';
import { evaluateLedgerReleaseApproval, type LedgerBlockerKind } from '../domain/sources/releaseApproval';
import type { Locale } from '../core/i18n/Locale';
import { resolveLocalizedText } from '../core/i18n/resolveLocalizedText';
import { createTranslator } from '../core/i18n/translate';

/**
 * The reviewer's audit of one case's sources, assets, sign-off and references — the `?ledger=1` surface.
 *
 * **This is a reviewer surface, not a player surface**, which is what puts it here in `src/ui/` beside
 * `ValidationSessionDisclosure` rather than in a Phaser scene. It dispatches no intent and mirrors no
 * interactive gesture, so ADR-011's single-Phaser-surface rule and NFR20 do not reach it, on exactly the
 * reasoning `ValidationSessionDisclosure` already records in its own docstring. There is deliberately no
 * Phaser ledger scene: a reviewer reading a rights table wants a table.
 *
 * It renders a semantic `<table>` per section with real `<th scope="col">` headers. That is not an
 * accessibility commitment under ADR-008 — no parity assertion is added and this route is not in
 * `tests/e2e/accessibility.spec.ts` — it is simply what a table costs when the markup is written
 * correctly the first time.
 *
 * **The banner never stands alone.** A surface that says `blocked` without saying what blocks it is not
 * visible blocking: the decision and the named blocker list are built together, always, and the blocker
 * list is the part a reviewer acts on.
 *
 * **Split into a pure text projection and a renderer**, following the split
 * `getValidationSessionDisclosureText` already makes and for the same reason: `vitest` runs in a Node
 * environment with no `document`, so a surface whose strings only exist inside DOM calls is a surface
 * whose French can only be checked by a browser. Everything readable is decided in
 * `getSourceRightsLedgerText`, which needs no document, and `mountSourceRightsLedger` only turns it into
 * elements.
 */

/** One table's worth of readable text. `subject` is the stable ID a blocker names, not display text. */
export interface LedgerTableText {
    readonly testId: string;
    readonly title: string;
    readonly headers: readonly string[];
    readonly rows: readonly Readonly<{ subject: string; cells: readonly string[] }>[];
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

const cell = (value: string, kind: 'td' | 'th'): HTMLTableCellElement => {
    const element = document.createElement(kind);
    element.textContent = value;
    if (kind === 'th') element.setAttribute('scope', 'col');
    return element;
};

const renderTable = ({ testId, title, headers, rows }: LedgerTableText): HTMLTableElement => {
    const element = document.createElement('table');
    element.dataset.testid = testId;

    // The table's own caption rather than a heading beside it, so the accessible name of the table is
    // the title a reviewer reads above it.
    const caption = document.createElement('caption');
    caption.textContent = title;

    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.append(...headers.map((header) => cell(header, 'th')));
    head.append(headerRow);

    const body = document.createElement('tbody');
    rows.forEach(({ subject, cells }) => {
        const bodyRow = document.createElement('tr');
        bodyRow.dataset.subject = subject;
        bodyRow.append(...cells.map((value) => cell(value, 'td')));
        body.append(bodyRow);
    });

    element.append(caption, head, body);
    return element;
};

export const mountSourceRightsLedger = (root: HTMLElement, definition: CaseDefinition, locale: Locale): void => {
    const content = getSourceRightsLedgerText(definition, locale);

    const section = document.createElement('section');
    section.className = 'source-rights-ledger';
    section.setAttribute('aria-label', content.title);

    const heading = document.createElement('h2');
    heading.textContent = content.title;

    const caseLine = document.createElement('p');
    caseLine.dataset.testid = 'ledger-case';
    caseLine.textContent = content.caseLine;

    // `role="status"` on the one line a reviewer opened this route to read, so it is announced rather
    // than merely present. `data-decision` carries the verdict as a value a test can assert without
    // matching prose in two languages.
    const banner = document.createElement('p');
    banner.dataset.testid = 'ledger-decision';
    banner.dataset.decision = content.decision;
    banner.setAttribute('role', 'status');
    banner.textContent = content.decisionText;

    const blockers = document.createElement('div');
    blockers.dataset.testid = 'ledger-blockers';
    const blockersHeading = document.createElement('h3');
    blockersHeading.textContent = content.blockersTitle;
    blockers.append(blockersHeading);
    if (content.blockers.length === 0) {
        const none = document.createElement('p');
        none.textContent = content.blockersNone;
        blockers.append(none);
    } else {
        const list = document.createElement('ul');
        content.blockers.forEach(({ kind, subjectId, text }) => {
            const item = document.createElement('li');
            item.dataset.blocker = kind;
            item.dataset.subject = subjectId;
            item.textContent = text;
            list.append(item);
        });
        blockers.append(list);
    }

    section.append(heading, caseLine, banner, blockers, ...content.tables.map(renderTable));
    root.replaceChildren(section);
};
