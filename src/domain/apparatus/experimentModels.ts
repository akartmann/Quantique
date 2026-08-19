import { calculateInterferometerDrift, INTERFEROMETER_CONTROL_IDS } from './calculateInterferometerDrift';
import { calculateYoungFringeSpacing, YOUNG_CONTROL_IDS } from './calculateYoungFringeSpacing';
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
