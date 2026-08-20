import type { Locale } from './Locale';

/**
 * Locale-aware presentation of scientific values (AC6). The *recorded* run values stay canonical
 * numbers in the record — only their rendering changes with the language.
 *
 * `Intl` is a JavaScript built-in, so this module keeps `core/` free of platform dependencies and
 * exercises the same code path in Node (full ICU) and in the browser.
 */

/** U+202F. French keeps the value and its unit on one line and never breaks between them. */
const NARROW_NO_BREAK_SPACE = '\u202F';

/**
 * U+00A0. Unbreakable like {@link NARROW_NO_BREAK_SPACE} and full width, for a unit that is a *word*.
 *
 * Exported so a test asserts the character rather than pasting one: an ordinary space here would read
 * identically in a diff and would let the value and its unit land on two lines, which is the property
 * the narrow space was chosen for and which this must not give up in order to be legible.
 */
export const NO_BREAK_SPACE = '\u00A0';

/** The arc-degree sign, exported so no caller writes the character twice. Not `°C`, which is a symbol. */
export const ARC_DEGREE = '\u00B0';

/**
 * Codepoints an author may reach for when they mean {@link ARC_DEGREE}, and which render almost
 * identically at a bench's font size.
 *
 * U+00BA is the masculine ordinal indicator, which several keyboard layouts emit for a degree; U+02DA is
 * the ring above. Both are whitespace-free, so `unitSeparatorClass` would have called them symbols and
 * written a separator before them — reprinting `0 °` in English and `0 U+202F °` in French, on content
 * that parses clean at load. Classified as degrees here so the *rendering* is right whatever an author
 * typed, and **refused at load** by `CaseDefinitionSchema`'s `unit` check so the author is told to write
 * the canonical sign rather than being silently corrected forever.
 */
const DEGREE_LIKE = Object.freeze(['\u00B0', '\u00BA', '\u02DA']);

/** True for {@link ARC_DEGREE} and for the homoglyphs {@link DEGREE_LIKE} lists. */
export const isArcDegreeUnit = (unit: string): boolean => DEGREE_LIKE.includes(unit);

/**
 * How a unit takes its separator. Three classes, because French typography has three answers.
 *
 * - `degree` — the arc-degree sign takes **no** separator in either locale: `0°`, never `0 °`. This was
 *   `deferred-work.md:224`: the separator was written before every unit, which is right for `°C` and for
 *   `mm` and wrong here, so the prototype's rotation dial read `0 °`.
 * - `symbol` — an SI symbol (`mm`, `m`, `nm`, `°C`). A plain space in English, U+202F in French. This is
 *   the whole of what shipped before, and it must stay byte-identical: it is Young's typography.
 * - `prose` — a spelled-out unit (`fringe widths`, `largeurs de frange`). A plain space in English, and in
 *   French a **full** no-break space, because U+202F before a word renders too tight to read as a space
 *   at all — the case file read `0,11largeurs de frange` (`deferred-work.md:277`). Same defect as the
 *   degree, opposite direction, one function.
 */
export type UnitSeparatorClass = 'degree' | 'symbol' | 'prose';

/**
 * Classifies a unit for {@link formatMeasurement}, on the unit's own shape rather than on an enumerated
 * list of the units that happen to ship today.
 *
 * **The classification is whitespace, and that is deliberate rather than merely easy.** Any SI symbol is
 * one whitespace-free token (`mm`, `min`, `mol`, `rad`, `°C`), and any spelled-out unit this project can
 * author is a noun phrase with a space in it — `fringe widths`, `largeurs de frange`. A rule keyed on
 * length or on "is it all letters" misfires on `min`, `mol` and `rad`, which are three-letter symbols and
 * would have been given a word's spacing. Whitespace cannot misfire on any symbol.
 *
 * **Its stated limitation:** a *single-word* prose unit — a hypothetical `degrés` or `tours` — classifies
 * as a symbol and takes the narrow space. Nothing either shipped case authors is of that shape, and the
 * degree sign, the one place it would have bitten, is handled by its own class. Recorded in
 * `deferred-work.md` rather than guessed at, because the fix is to author the class, not to widen a regex.
 *
 * Exported so the classification is a thing a test can assert directly, instead of being inferred from
 * the formatted output of the units that happen to be authored right now.
 */
export const unitSeparatorClass = (unit: string): UnitSeparatorClass => {
    if (isArcDegreeUnit(unit)) return 'degree';
    return /\s/.test(unit) ? 'prose' : 'symbol';
};

/**
 * The separator each locale writes for each unit class.
 *
 * **English is unbreakable too, since the 4.2 review.** It used to write U+0020 for both `symbol` and
 * `prose`, and the consequence was photographed rather than argued: the English bench wrapped
 * `Bath temperature: 20.0` / `°C`, splitting a value from its unit across two lines — the exact property
 * {@link NARROW_NO_BREAK_SPACE} was chosen to protect in French, given up in English for no stated
 * reason. English takes U+00A0 in both classes rather than U+202F, because the narrow space is a French
 * typographic convention and English simply wants an ordinary-width space that does not break.
 *
 * This *is* a visible change to Young's shipped English output at the byte level, and it was taken as a
 * decision in the 4.2 review (amending that story's AC5 clause, which required the English bytes to be
 * untouched). `I18n.test.ts` pins the characters deliberately so the next change here is also a decision.
 * The `degree` class stays empty in both locales: there is nothing to break between `0` and `°`.
 */
const UNIT_SEPARATOR: Readonly<Record<Locale, Readonly<Record<UnitSeparatorClass, string>>>> = {
    en: { degree: '', symbol: NO_BREAK_SPACE, prose: NO_BREAK_SPACE },
    fr: { degree: '', symbol: NARROW_NO_BREAK_SPACE, prose: NO_BREAK_SPACE }
};

// Constructing an Intl.NumberFormat is the expensive part; the set of (locale, precision) pairs a
// case can produce is tiny and bounded by the authored control steps.
const formatters = new Map<string, Intl.NumberFormat>();

const formatterFor = (locale: Locale, decimals: number): Intl.NumberFormat => {
    const cacheKey = `${locale}|${decimals}`;
    const cached = formatters.get(cacheKey);
    if (cached) return cached;
    const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    formatters.set(cacheKey, formatter);
    return formatter;
};

/** Formats a bare number at the authored precision, trailing zeros included. */
export const formatNumber = (locale: Locale, value: number, decimals: number): string =>
    formatterFor(locale, decimals).format(value);

/**
 * Formats a measured value with its unit — `0.25 mm` in English, `0,25 mm` in French, `0°` in both.
 *
 * The separator is a function of **`(locale, unit)`**, not of the locale alone; see
 * {@link unitSeparatorClass} for the three classes and the two shipped defects that made this a rule
 * rather than a constant.
 */
export const formatMeasurement = (locale: Locale, value: number, decimals: number, unit: string): string =>
    `${formatNumber(locale, value, decimals)}${UNIT_SEPARATOR[locale][unitSeparatorClass(unit)]}${unit}`;

/** The precision a number already carries. Used to size a control's readout from its authored step. */
export const decimalPlaces = (value: number): number => value.toString().split('.')[1]?.length ?? 0;

/**
 * Formats a value the domain already rounded, at exactly the precision it carries. Recorded run
 * results keep their canonical number; only the separators change with the language.
 *
 * **Precision from the value is right for a control and wrong for a result.** A control's value carries
 * its authored step, so `22` at a step of `0.5` renders `22.0` and means it. A *result* carries whatever
 * its arithmetic happened to leave: the interferometer's drift spans 0 to 0.21, so one travel of the dial
 * rendered `0`, `0.01`, `0.1` and `0.11` — four precisions for one quantity, and an exact `0` at the two
 * positions where `cos(2θ)` vanishes, which reads as *no measurement* rather than as a null result. So a
 * model may declare the precision its results are shown at (`ExperimentModel.resultDecimalPlaces`), and
 * a caller rendering a **result** passes it through {@link formatMeasurement} with that number. Young
 * declares none and keeps this per-value behaviour, which is why its readout is unchanged.
 */
export const formatRecordedValue = (locale: Locale, value: number, unit: string): string =>
    formatMeasurement(locale, value, decimalPlaces(value), unit);
