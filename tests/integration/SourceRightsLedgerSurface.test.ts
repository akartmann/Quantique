import { describe, expect, it } from 'vitest';

import type { CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { LOCALES } from '../../src/core/i18n/Locale';
import { getSourceRightsLedgerText, type SourceRightsLedgerText } from '../../src/ui/SourceRightsLedger';
import { loadShippedCase } from '../shippedCases';

/**
 * What the `?ledger=1` reviewer surface actually says, for both shipped cases and in both locales.
 *
 * Asserted through `getSourceRightsLedgerText` rather than through the mounted DOM, because `vitest`
 * runs in a Node environment with no `document` and adding one is a new dependency. That split is the
 * codebase's own (`getValidationSessionDisclosureText`), and it is the half worth covering here: every
 * string a reviewer reads is decided in this function, while `mountSourceRightsLedger` turns the same
 * values into elements and is walked by `tests/e2e/source-rights-ledger.spec.ts`.
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
    content.title, content.caseLine, content.decisionText, content.blockersTitle,
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

    it('carries a replacement plan on every row whose rights are not reviewed', async () => {
        const definition = await loadShippedCase(caseId);

        for (const locale of LOCALES) {
            const content = getSourceRightsLedgerText(definition, locale);
            const assets = tableFor(content, 'ledger-assets');
            const rightsColumn = assets.headers.length - 5;
            const planColumn = assets.headers.length - 1;

            assets.rows.forEach(({ subject, cells }) => {
                const isCleared = cells[rightsColumn] === (locale === 'en' ? 'Reviewed' : 'Vérifié');
                if (isCleared) return;
                // A real plan, not the em-dash placeholder an absent one renders as.
                expect(cells[planColumn], `${locale} ${subject}`).not.toBe('—');
                expect(cells[planColumn].length, `${locale} ${subject}`).toBeGreaterThan(20);
            });
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

        for (const locale of LOCALES) {
            const content = getSourceRightsLedgerText(definition as unknown as CaseDefinition, locale);

            expect(content.decision).toBe('clear');
            expect(content.blockers).toEqual([]);
            expect(content.blockersNone.trim().length).toBeGreaterThan(0);
        }
    });
});
