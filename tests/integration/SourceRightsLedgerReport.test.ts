import { describe, expect, it } from 'vitest';

import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { LOCALES } from '../../src/core/i18n/Locale';
import { findLedgerRow, getSourceRightsLedgerText, renderLedgerMarkdown, type SourceRightsLedgerText } from '../../src/domain/sources/ledgerReport';
import { en } from '../../src/core/i18n/locales/en';
import { fr } from '../../src/core/i18n/locales/fr';
import { loadShippedCase } from '../shippedCases';

/**
 * What the generated source-and-rights ledger actually says, for both shipped cases and both locales.
 *
 * `getSourceRightsLedgerText` decides every string a reviewer reads and needs no document, which is why
 * it survived the code review's removal of the `?ledger=1` surface intact: the projection was already the
 * tested half, and only the DOM rendering went. `renderLedgerMarkdown` turns the same values into the
 * files `npm run audit:ledger` writes.
 *
 * These assertions read the **real** `case.json`, so a content edit that drops a row or leaves a French
 * cell in English fails here rather than reaching a reviewer.
 */
const tableFor = (content: SourceRightsLedgerText, testId: string): SourceRightsLedgerText['tables'][number] => {
    const table = content.tables.find((candidate) => candidate.testId === testId);
    expect(table, testId).toBeDefined();
    return table!;
};

/** Every readable string on the surface, flattened — the roster the blank/English checks below sweep. */
const everyString = (content: SourceRightsLedgerText): readonly string[] => [
    // `blockersNone` is in this list because it was **not**, which is how the French `clear` banner and
    // its companion shipped unread: both shipped cases are blocked, so no test ever resolved a
    // cleared-state string and the sweep could not have noticed. Nothing here may depend on which
    // decision the shipped content happens to have.
    content.title, content.caseLine, content.decisionText, content.blockersTitle, content.blockersNone,
    content.blockerRowReference,
    ...content.blockers.map(({ text }) => text),
    ...content.tables.flatMap((table) => [table.title, ...table.headers, ...table.rows.flatMap(({ cells }) => cells)])
];

describe.each(['young-interference', 'morley-miller'])('the source and rights ledger surface for %s', (caseId) => {
    it('states the decision as BLOCKED and lists every blocker by name', async () => {
        const definition = await loadShippedCase(caseId);

        for (const locale of LOCALES) {
            const content = getSourceRightsLedgerText(definition, locale);

            expect(content.decision).toBe('blocked');
            expect(content.decisionText.trim().length).toBeGreaterThan(0);
            // "blocked" with no statement of what blocks it is not visible blocking: the surface must
            // carry a named row for every blocker the gate emitted.
            expect(content.blockers.length).toBeGreaterThan(0);
            content.blockers.forEach(({ subjectId, text }) => {
                expect(text, `${locale} ${subjectId}`).toContain(subjectId);
            });
        }
    });

    it('renders one row per authored source and one per manifest asset, dropping none', async () => {
        const definition = await loadShippedCase(caseId);
        const content = getSourceRightsLedgerText(definition, 'en');

        expect(tableFor(content, 'ledger-sources').rows.map(({ subject }) => subject))
            .toEqual(definition.contextualArtifacts.map(({ id }) => id));
        expect(tableFor(content, 'ledger-assets').rows.map(({ subject }) => subject))
            .toEqual(definition.assets.entries.map(({ id }) => id));

        // Every row is as wide as its own header row: a short row is a column silently dropped.
        content.tables.forEach((table) => {
            table.rows.forEach(({ subject, cells }) => {
                expect(cells.length, `${table.testId} ${subject}`).toBe(table.headers.length);
            });
        });
    });

    it('shows all six FR26 fields, and the two de-scoped ones as de-scoped with their reference', async () => {
        const definition = await loadShippedCase(caseId);
        const content = getSourceRightsLedgerText(definition, 'en');

        // Primary and secondary source roles, per source.
        const roleColumn = tableFor(content, 'ledger-sources').rows.map(({ cells }) => cells[1]);
        expect(roleColumn.every((role) => role === 'Primary' || role === 'Secondary')).toBe(true);
        expect(roleColumn).toContain('Primary');

        // The scholarly reviewer and the educator context sheet — both genuinely pending today.
        const signOff = tableFor(content, 'ledger-sign-off');
        expect(signOff.rows.map(({ subject }) => subject)).toEqual(['contentAuthor', 'scholarlyReviewer', 'accessibilityReviewer']);
        expect(signOff.rows.find(({ subject }) => subject === 'scholarlyReviewer')!.cells[1]).toBe('Pending');

        const references = tableFor(content, 'ledger-references');
        expect(references.rows.map(({ subject }) => subject)).toEqual(['educatorContextSheet', 'accessibleControlsReference']);
        expect(references.rows.find(({ subject }) => subject === 'educatorContextSheet')!.cells[1]).toBe('Pending');

        // AC2's distinct third state, rendered as itself and carrying the decision that de-scoped it —
        // never dropped, and never spelled `Signed off`.
        const accessibility = signOff.rows.find(({ subject }) => subject === 'accessibilityReviewer')!.cells[1];
        const controls = references.rows.find(({ subject }) => subject === 'accessibleControlsReference')!.cells[1];
        expect(accessibility).toBe('De-scoped (ADR-008)');
        expect(controls).toBe('De-scoped (ADR-008)');
        expect(accessibility).not.toContain('Signed off');
    });

    /**
     * **Sources as well as assets, and it must actually assert something.**
     *
     * As written for Story 3.3 this iterated `ledger-assets` alone and skipped every cleared row, so for
     * `morley-miller` — one manifest asset, `quantique-logo`, `reviewed` — the body executed **zero
     * assertions** and passed with no content behind it, despite being named "every row". The Sources
     * table's Replacement plan column was never checked for either case.
     *
     * The cleared-row check is also asserted rather than skipped, in both directions: a row that is
     * cleared must carry **no** plan (the converse R1 the review added), and a row that is not must carry
     * a real one. And the "is it cleared" test reads the translated label from the bundle instead of the
     * hard-coded `'Vérifié'` it used to compare against — that literal would have made a reworded
     * translation demand a plan on a correctly-cleared row, failing for a reason unrelated to the rule.
     */
    it('carries a replacement plan on exactly the rows whose rights are not reviewed', async () => {
        const definition = await loadShippedCase(caseId);

        for (const locale of LOCALES) {
            const content = getSourceRightsLedgerText(definition, locale);
            const cleared = (locale === 'en' ? en : fr)['source.rights.reviewed'];
            let checked = 0;

            for (const testId of ['ledger-sources', 'ledger-assets']) {
                const table = tableFor(content, testId);
                const rightsColumn = table.headers.indexOf((locale === 'en' ? en : fr)['ledger.column.rights']);
                const planColumn = table.headers.indexOf((locale === 'en' ? en : fr)['ledger.column.replacementPlan']);
                expect(rightsColumn, `${testId} rights column`).toBeGreaterThanOrEqual(0);
                expect(planColumn, `${testId} plan column`).toBeGreaterThanOrEqual(0);
                expect(table.rows.length, `${testId} has rows`).toBeGreaterThan(0);

                table.rows.forEach(({ subject, cells }) => {
                    checked += 1;
                    if (cells[rightsColumn] === cleared) {
                        // The em-dash placeholder an absent plan renders as. A cleared row stating how it
                        // would be replaced contradicts itself.
                        expect(cells[planColumn], `${locale} ${subject} is cleared and must carry no plan`).toBe('—');
                        return;
                    }
                    expect(cells[planColumn], `${locale} ${subject}`).not.toBe('—');
                    expect(cells[planColumn].length, `${locale} ${subject}`).toBeGreaterThan(20);
                });
            }

            // The guard that makes the loop above a test rather than a formality.
            expect(checked, `${locale} rows examined`).toBeGreaterThan(0);
        }
    });

    /**
     * The markdown `npm run audit:ledger` writes — the artifact a reviewer actually opens.
     *
     * Asserted as text because that is what it is. The tables must survive serialisation with their rows
     * intact, every blocker must name the row it points at, and a cell containing a pipe must not break
     * the row it sits in — authored `claimOrUse` and `replacementPlan` are free prose and a pipe in either
     * would otherwise silently split a column.
     */
    it('renders the audit artifact as markdown with every table and blocker intact', async () => {
        const definition = await loadShippedCase(caseId);

        for (const locale of LOCALES) {
            const content = getSourceRightsLedgerText(definition, locale);
            const markdown = renderLedgerMarkdown(content, '_Generated for a test._');

            expect(markdown.startsWith(`# ${content.title}`)).toBe(true);
            expect(markdown.endsWith('\n')).toBe(true);
            expect(markdown).toContain(content.decisionText);

            content.tables.forEach((table) => {
                expect(markdown, `${locale} ${table.testId} title`).toContain(`## ${table.title}`);
                // One body line per row, plus the header and its separator.
                table.rows.forEach((row) => {
                    expect(markdown, `${locale} ${table.testId} row ${row.subject}`)
                        .toContain(row.cells[0].replace(/\|/g, '\\|').replace(/\r?\n/g, ' '));
                });
            });

            content.blockers.forEach((blocker) => {
                const row = findLedgerRow(content, blocker);
                expect(markdown, `${locale} ${blocker.kind} names its row`)
                    .toContain(`${content.blockerRowReference} \`${row!.subject}\``);
            });

            // No row may carry a raw newline or an unescaped pipe into the table it belongs to.
            const bodyLines = markdown.split('\n').filter((line) => line.startsWith('|'));
            const expectedRows = content.tables.reduce((total, table) => total + table.rows.length + 2, 0);
            expect(bodyLines.length, `${locale} table line count`).toBe(expectedRows);
        }
    });

    /**
     * Every blocker can be traversed to the row that states it — the claim the surface always made.
     *
     * The code review found it false for three of the kinds. A case-level blocker carries the *case* ID as
     * its `subjectId`, because the case is what is blocked, while the row holding the role is keyed by the
     * role name — so "scholarly review pending" pointed at nothing. Resolving by blocker *kind* fixes it,
     * and an earlier attempt that gave every role row the case ID as a second anchor made all three rows
     * equally matchable and resolved every one of them to `contentAuthor`.
     */
    it('resolves every blocker to the row that states it', async () => {
        const definition = await loadShippedCase(caseId);

        for (const locale of LOCALES) {
            const content = getSourceRightsLedgerText(definition, locale);
            expect(content.blockers.length).toBeGreaterThan(0);

            const resolved = content.blockers.map((blocker) => [blocker, findLedgerRow(content, blocker)] as const);
            resolved.forEach(([blocker, row]) => {
                expect(row, `${locale} ${blocker.kind}/${blocker.subjectId} resolved to no row`).toBeDefined();
            });

            // Distinct blockers must not collapse onto one row, which is how the first fix failed.
            const subjects = resolved.map(([, row]) => row!.subject);
            expect(new Set(subjects).size, `${locale} blockers collapsed onto the same row`).toBe(subjects.length);
        }
    });

    it('authors every string in both locales, with nothing blank and nothing left in English', async () => {
        const definition = await loadShippedCase(caseId);
        const english = everyString(getSourceRightsLedgerText(definition, 'en'));
        const french = everyString(getSourceRightsLedgerText(definition, 'fr'));

        expect(french.length).toBe(english.length);
        expect(english.filter((value) => value.trim().length === 0)).toEqual([]);
        expect(french.filter((value) => value.trim().length === 0)).toEqual([]);

        // French is not a follow-up (the lesson from 3.2's `de Écartement des fentes`). Most cells are
        // canonical by design — IDs, paths, dates, citations, provenance references — so this counts how
        // many *did* change rather than requiring every one to, and a bundle or content edit that left a
        // translatable column in English drops that count.
        const translated = english.filter((value, index) => french[index] !== value);
        expect(translated.length).toBeGreaterThanOrEqual(english.length / 3);
    });

    it('reads the case its own title and version, so a reviewer knows which content they audited', async () => {
        const definition = await loadShippedCase(caseId);
        const content = getSourceRightsLedgerText(definition, 'en');

        expect(content.caseLine).toContain(definition.id);
        expect(content.caseLine).toContain(definition.version);
        expect(content.caseLine).toContain(definition.title.en);
    });
});

describe('the ledger surface when a case clears', () => {
    it('says nothing blocks release rather than showing an empty gap', async () => {
        const definition = structuredClone(await loadShippedCase('morley-miller')) as unknown as Record<string, unknown>;
        const signOff = (definition.ledger as { signOff: Record<string, unknown> }).signOff;
        signOff.scholarlyReviewer = { state: 'reviewed', name: 'A. Reviewer', date: '2026-08-19' };
        (definition.ledger as Record<string, unknown>).educatorContextSheet = { state: 'reviewed', name: 'An Educator', date: '2026-08-19' };
        ((definition.assets as { entries: Array<Record<string, unknown>> }).entries).forEach((entry) => {
            entry.rights = { ...(entry.rights as Record<string, unknown>), status: 'reviewed', replacementPlan: undefined };
        });

        for (const locale of LOCALES) {
            const content = getSourceRightsLedgerText(definition as unknown as CaseDefinition, locale);

            expect(content.decision).toBe('clear');
            expect(content.blockers).toEqual([]);
            expect(content.blockersNone.trim().length).toBeGreaterThan(0);
        }
    });
});
