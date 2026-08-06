import type { Translator } from './translate';

/**
 * Who said a thing, formatted for display: `'{name} — {role}'`, or the name alone when a degraded
 * cached `case.json` leaves the role empty.
 *
 * Shared rather than reimplemented per surface — the two-part template would otherwise render a
 * trailing em dash with nothing after it, and the proposal cards and the dialogue speaker line need
 * the same fallback.
 *
 * **It lives here, and not in `selectors.ts`, on purpose.** The Phaser widgets under
 * `adapters/phaser/ui/` are required to import no selector at all: a widget that could reach
 * `selectDefensibleConclusionProposalIds` could mark the "right" answer, which ADR-006 forbids. While
 * this function sat in the selectors module, `ProposalChoice` needed a *value* import from it, which
 * put every selector in the widget's module graph and left that rule enforced by convention rather
 * than by structure (1.12 review). It takes a `Translator` and a plain attribution pair — never
 * `AppState` — so it belongs to the i18n layer, which both sides may depend on.
 *
 * Which label an *unresolved* attribution falls back to is the projection's decision, not this
 * function's: "Unattributed proposal" is right on a proposal card and wrong above a line of spoken
 * prose. See `projectAttribution` in `selectors.ts`.
 */
export type Attribution = Readonly<{ colleagueName: string; roleLabel: string }>;

export const formatAttribution = (t: Translator, attribution: Attribution): string =>
    attribution.roleLabel
        ? t('colleague.attribution', { name: attribution.colleagueName, role: attribution.roleLabel })
        : attribution.colleagueName;
