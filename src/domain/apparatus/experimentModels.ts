import { calculateInterferometerDrift, INTERFEROMETER_CONTROL_IDS } from './calculateInterferometerDrift';
import { calculateYoungFringeSpacing, YOUNG_CONTROL_IDS } from './calculateYoungFringeSpacing';
import { decimalPlaces, formatMeasurement } from '../../core/i18n/formatNumber';
import type { Locale } from '../../core/i18n/Locale';
import type { TranslationKey, Translator } from '../../core/i18n/translate';
import type { WavelengthMode } from '../cases/CaseDefinition';
import type { CalculateExperimentResult, RunRecord } from '../evidence/RunRecord';

/**
 * Which deterministic model a case's bench runs, resolved from the case's own `experiment.modelId`.
 *
 * Before this, `reduceExperimentRun` called {@link calculateYoungFringeSpacing} directly, fed from two
 * written-down control names. A case authoring `rotationDeg`/`bathTempC` read both as `undefined`, the
 * calculator's own input guard fired, and the player was told their apparatus "cannot produce a fringe
 * spacing" — for an apparatus that has no fringe spacing. The store had one case's physics compiled
 * into it.
 *
 * **A lookup, not a registry (D3).** At two models the list *is* the mechanism; a plugin layer, a model
 * factory or a per-case module loader here would be the all-purpose framework epic AC1 forbids. When a
 * third and fourth model arrive, this stays a list.
 *
 * **Keyed on `modelId`, never on the case ID and never on `modelVersion`.** The case ID would put a
 * second per-case branch in the *store*, which is the layer Story 3.1 deliberately kept one out of; and
 * `modelVersion` is the per-run provenance stamp, so keying on it would mean bumping a version silently
 * changed which physics ran (`project-context.md`: never recalculate a saved run against a newer model).
 */

/**
 * The models this build implements. Closed, and validated at load by `CaseDefinitionSchema` — so a case
 * naming a model that does not exist is refused with its own path named, rather than reaching the
 * player as a refusal at the moment they press start.
 */
export const EXPERIMENT_MODEL_IDS = ['young-double-slit', 'morley-miller-interferometer'] as const;

export type ExperimentModelId = typeof EXPERIMENT_MODEL_IDS[number];

/**
 * What a model may read besides the bench snapshot.
 *
 * Both members are the *store's* own fields rather than Young's model shape: `AppState` initialises
 * `selectedWavelengthNm`/`selectedWavelengthMode` for every case, and a model whose apparatus has no
 * wavelength simply never reads them — the interferometer does not. Passing the mode rather than
 * deriving it from `=== 550` matters: that comparison would have been an eleventh copy of a case
 * constant the project is trying to delete, and the store already holds the answer.
 */
export type ExperimentModelSession = Readonly<{ selectedWavelengthNm: number; selectedWavelengthMode: WavelengthMode }>;

export type ExperimentModel = Readonly<{
    id: ExperimentModelId;
    /**
     * The authored control IDs this model reads. Checked against the case's `apparatus.primaryControls`
     * at load, because a model reading a control the case does not author is exactly the silent
     * `undefined` this seam exists to make impossible — and it is unauthorable content, so it belongs
     * at load beside every other "no authored content may leave a gate unsatisfiable" rule.
     */
    requiredControlIds: readonly string[];
    /**
     * The interface key for this model's result label.
     *
     * `ExperimentResult.label` is a *canonical* English string persisted in every run record so saved
     * runs revalidate, which makes it exactly the wrong thing to show a French reader. Young already
     * solved this by localizing its one label by key; stating the key on the model generalises that
     * without anyone having to match on the canonical prose (ADR-010, and AC6's "no player-readable
     * string exists in one language only").
     */
    resultLabelKey: TranslationKey;
    /**
     * The interface key for this model's result *unit*, when that unit is prose rather than a symbol.
     *
     * Same split as {@link ExperimentModel.resultLabelKey}, for the half that was missed: the label was
     * localized by key while `ExperimentResult.unit` — equally canonical, equally persisted — was
     * rendered straight from the record, so the French bench read "0,1100 fringe widths" (review
     * 2026-08-19). Omitted where the unit is an SI symbol (`mm`, `m`, `°C`), which every locale writes
     * the same way and which `formatMeasurement` is already licensed to pass through untranslated.
     */
    resultUnitKey?: TranslationKey;
    /**
     * The precision this model's *results* are shown at, when the value's own precision is the wrong
     * answer.
     *
     * Same shape and same reason as {@link ExperimentModel.resultUnitKey}: declared by the one model that
     * needs it, omitted by the model that does not. `formatRecordedValue` sizes a number from the decimals
     * it carries, which is right for a control (it carries its authored step) and wrong for a result (it
     * carries whatever its arithmetic left). The interferometer's drift spans 0 to 0.21, so one sweep of
     * the dial rendered `0`, `0.01`, `0.1` and `0.11` — four precisions for one quantity, with an exact
     * `0` at the two on-step angles where `cos(2θ)` vanishes, reading as *no measurement* rather than as
     * the null result the case is about (4.2 review).
     *
     * **Young deliberately declares none.** Its fringe spacing is a few millimetres (`4.4 mm` at the
     * authored defaults), where per-value precision is both meaningful and what the case has shipped
     * since Story 2.2 — declaring a number here would change a shipped readout for no gain.
     */
    resultDecimalPlaces?: number;
    /** Binds whatever the model needs beyond the bench, yielding the pure controls→result seam. */
    bind: (session: ExperimentModelSession) => CalculateExperimentResult;
    /**
     * The model's own persisted inputs, when it has any.
     *
     * `RunRecord['modelInputs']` is `YoungModelInputs` — the *Young optical model's* shape, persisted in
     * `CaseRecordSchema` and unwidenable without a record migration (D4). So it is authored here, on the
     * one model it belongs to, and omitted by every model that records none. That is what keeps
     * `reduceExperimentRun` free of a per-case branch while leaving `modelInputs` genuinely optional
     * rather than nominally optional.
     */
    recordInputs?: (session: ExperimentModelSession, controls: Readonly<Record<string, number>>) => RunRecord['modelInputs'];
}>;

const YOUNG_DOUBLE_SLIT: ExperimentModel = Object.freeze({
    id: 'young-double-slit',
    requiredControlIds: YOUNG_CONTROL_IDS,
    resultLabelKey: 'experiment.result.fringeSpacing',
    bind: (session) => (controls) => calculateYoungFringeSpacing({
        slitSpacingMm: controls.slitSpacingMm,
        screenDistanceM: controls.screenDistanceM,
        wavelengthNm: session.selectedWavelengthNm
    }),
    recordInputs: (session, controls) => ({
        slitSpacingMm: controls.slitSpacingMm,
        screenDistanceM: controls.screenDistanceM,
        wavelengthNm: session.selectedWavelengthNm as 450 | 550 | 650,
        wavelengthMode: session.selectedWavelengthMode
    })
});

const MORLEY_MILLER_INTERFEROMETER: ExperimentModel = Object.freeze({
    id: 'morley-miller-interferometer',
    requiredControlIds: INTERFEROMETER_CONTROL_IDS,
    resultLabelKey: 'experiment.result.fringeDisplacement',
    // 'fringe widths' is English prose, not an SI symbol, so unlike Young's `mm` it needs a key.
    resultUnitKey: 'experiment.unit.fringeWidths',
    // Two decimals: the drift's whole authored range is 0 to ~0.21 fringe widths, so two places separate
    // every reachable reading while a null reads `0.00` — a measurement that came out at zero, which is
    // what the 1907 result was, rather than a bare `0` that reads as an absence.
    resultDecimalPlaces: 2,
    // The session is ignored on purpose: this apparatus has no wavelength to select, which is the whole
    // reason `experiment.wavelengthNm` had to become optional in the shared contract.
    bind: () => calculateInterferometerDrift
});

const MODELS: Readonly<Record<ExperimentModelId, ExperimentModel>> = Object.freeze({
    'young-double-slit': YOUNG_DOUBLE_SLIT,
    'morley-miller-interferometer': MORLEY_MILLER_INTERFEROMETER
});

export const isExperimentModelId = (modelId: string): modelId is ExperimentModelId =>
    (EXPERIMENT_MODEL_IDS as readonly string[]).includes(modelId);

/**
 * The model a case declares, or `undefined` for an ID this build does not implement.
 *
 * Fallible in its type rather than throwing, but in practice total for loaded content: the schema
 * refuses an unknown ID at load, so the `undefined` branch is unreachable from a validated definition
 * and exists only so that fact is stated rather than assumed.
 */
export const resolveExperimentModel = (modelId: string): ExperimentModel | undefined =>
    isExperimentModelId(modelId) ? MODELS[modelId] : undefined;


/**
 * The unit to *show* for a recorded result: the model's declared key where it has one, else the
 * canonical unit the run persisted.
 *
 * Takes the already-version-matched model so every surface applies one rule. Pass `undefined` when the
 * run's `experimentModelVersion` does not match the case's — a run from another model keeps its own
 * canonical unit rather than borrowing this build's word for it.
 */
export const resolveResultUnit = (model: ExperimentModel | undefined, canonicalUnit: string, t: Translator): string =>
    model?.resultUnitKey ? t(model.resultUnitKey) : canonicalUnit;

/**
 * The precision to *show* a recorded result at: the model's declared places where it has one, else the
 * precision the recorded value itself carries.
 *
 * The `undefined` model is the same case {@link resolveResultUnit} handles — a run whose
 * `experimentModelVersion` does not match the case's keeps its own canonical rendering rather than
 * borrowing this build's, so it falls through to the value's own precision.
 */
export const resolveResultDecimalPlaces = (model: ExperimentModel | undefined, value: number): number =>
    model?.resultDecimalPlaces ?? decimalPlaces(value);

/**
 * Renders a recorded result the one way every surface renders it: the model's label, the model's unit and
 * the model's precision, or the run's own canonical values where the model does not match.
 *
 * Five surfaces compose this — the bench readout twice, the notebook, the case file and the printable
 * record — and before this they each spelled out `formatRecordedValue(locale, value, resolveResultUnit(…))`
 * themselves. Story 3.2's defect was one of those five surfaces being missed because it was the only one
 * absent from a story's file list; a fifth copy is a fifth chance to miss one, so the composition lives
 * here and the surfaces call it.
 */
export const formatRecordedResult = (
    locale: Locale,
    model: ExperimentModel | undefined,
    result: Readonly<{ value: number; unit: string }>,
    t: Translator
): string => formatMeasurement(
    locale,
    result.value,
    resolveResultDecimalPlaces(model, result.value),
    resolveResultUnit(model, result.unit, t)
);
