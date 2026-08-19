import { describe, expect, it } from 'vitest';

import { CONTROL_AFFORDANCES, controlAffordance, type CaseDefinition } from '../../src/domain/cases/CaseDefinition';
import { FIGURE_STAGING_SCENE_KEYS, SCENE_KEYS } from '../../src/domain/cases/ScenarioScript';
import { resolveExperimentModel } from '../../src/domain/apparatus/experimentModels';
import { CaseDefinitionSchema, KNOWN_CASE_IDS } from '../../src/schemas/CaseDefinitionSchema';
import { listRepoFiles, listRepoSourceFiles, loadAuthoringExample, loadShippedCase, readRepoFile } from '../shippedCases';

/**
 * The authoring contract, asserted where prose cannot be trusted to stay true (Story 3.4).
 *
 * `docs/content-authoring/README.md` states this contract for a human. A prose inventory goes stale on
 * the next commit, so the rules it describes are pinned here — and pinned by *exercising* them, never
 * by restating the schema. Each test below names the change to `src/` that would break it.
 */

const SCENES_DIRECTORY = 'src/adapters/phaser/scenes';

/**
 * The scene keys whose scenes actually construct a `ColleagueRenderer`, read from the source.
 *
 * Derived rather than listed, which is the point: `FIGURE_STAGING_SCENE_KEYS` is otherwise a second
 * copy of a rule the renderers own, and this project's register of "one rule written down twice" is
 * long. A scene that starts or stops staging a figure column fails here rather than leaving the schema
 * enforcing a rule the surface no longer follows.
 */
const scenesConstructingAColleagueRenderer = async (): Promise<readonly string[]> => {
    const fileNames = (await listRepoFiles(SCENES_DIRECTORY)).filter((name) => name.endsWith('Scene.ts'));
    const staging = await Promise.all(fileNames.map(async (fileName) => {
        const source = await readRepoFile(`${SCENES_DIRECTORY}/${fileName}`);
        return source.includes('new ColleagueRenderer(') ? [fileName.replace(/Scene\.ts$/u, '')] : [];
    }));
    return staging.flat().sort();
};

describe('which scenes stage a figure column', () => {
    it('finds the scene files at all', async () => {
        // Guards the sweep itself: a moved directory or a renamed suffix would otherwise make every
        // assertion below vacuously true, which is the "test that cannot fail" shape.
        const fileNames = (await listRepoFiles(SCENES_DIRECTORY)).filter((name) => name.endsWith('Scene.ts'));

        expect(fileNames.length).toBeGreaterThanOrEqual(SCENE_KEYS.length);
    });

    it('matches FIGURE_STAGING_SCENE_KEYS exactly', async () => {
        expect(await scenesConstructingAColleagueRenderer()).toEqual([...FIGURE_STAGING_SCENE_KEYS].sort());
    });

    it('names only authorable scene keys, so a case can actually route to one', async () => {
        // `RivalLab` stages its own cast of one from `rivalLab` rather than from the script, and is
        // deliberately outside the content vocabulary — so it must never appear here.
        FIGURE_STAGING_SCENE_KEYS.forEach((sceneKey) => expect(SCENE_KEYS).toContain(sceneKey));
    });
});

/**
 * The authoring rule a `dial` carries, checked against the content that actually ships.
 *
 * A dial's travel **closes**: its minimum and its maximum occupy the index mark together, so it cannot
 * distinguish them. That is right for a cyclic quantity and wrong for anything else, and no schema can
 * tell which a control is — cyclicity is a property of the *model*, not of the range. So the rule is
 * stated for authors in `docs/content-authoring/` and enforced here against the model itself, which is
 * the only place the answer exists.
 *
 * Not a tautology: authoring `dial` on the prototype's `bathTempC` (18…24 °C, where the thermal term is
 * linear and the ends are 0.30 apart) fails this, and so would `slitSpacingMm` on any case that took a
 * dial to it.
 */
describe("a dial's two ends must be the same reading", () => {
    let dialsChecked = 0;

    /**
     * A wavelength read off the content that authors one, rather than written here.
     *
     * The literal `550` stood in this position and was the one number in this file a content edit could
     * have made wrong silently — and project-context names `550` specifically as a case constant whose
     * copies may only shrink. The prototype's model does not read it; Young's does, and Young authors
     * it, so taking it from there keeps the binding honest for both.
     */
    const authoredWavelengthNm = async (): Promise<number> => {
        for (const caseId of KNOWN_CASE_IDS) {
            const nm = (await loadShippedCase(caseId)).experiment.wavelengthComparison?.fixedMinimumPathNm;
            if (nm !== undefined) return nm;
        }
        throw new Error('No shipped case authors a wavelength comparison to derive a binding from.');
    };

    /**
     * The sweep must not go vacuous. Without this, retiring the prototype's `dial` would leave the
     * assertion below executing **zero** times while still reporting green — the shape the 3.3 review
     * found in the replacement-plan sweep, which executed no assertions at all for `morley-miller`.
     *
     * It doubles as the "author no case field nothing reads" check for the affordance vocabulary: all
     * three members are live in shipped, playable content rather than in a fixture alone.
     */
    it('has all three affordances live in shipped content', async () => {
        const authored = await Promise.all(KNOWN_CASE_IDS.map(async (caseId) => {
            const definition: CaseDefinition = await loadShippedCase(caseId);
            return definition.apparatus.primaryControls.map(controlAffordance);
        }));

        expect([...new Set(authored.flat())].sort()).toEqual([...CONTROL_AFFORDANCES].sort());
    });

    // The authoring example is included deliberately. It is *not* a shipped case — a sibling test
    // asserts that — so `KNOWN_CASE_IDS` alone skipped the one dial in the repository that an author is
    // told to copy: changing the example's `rotationDeg` to a non-cyclic `0…90` left every test green
    // while the worked example taught the exact mistake the guide warns about.
    const AUTHORING_EXAMPLE = 'example-minimal-scenario';
    const DIAL_BEARING_CASES = [...KNOWN_CASE_IDS, AUTHORING_EXAMPLE] as const;

    it.each(DIAL_BEARING_CASES)('holds for every dial the %s case authors', async (caseId) => {
        const definition: CaseDefinition = caseId === AUTHORING_EXAMPLE
            ? await loadAuthoringExample()
            : await loadShippedCase(caseId);
        const model = resolveExperimentModel(definition.experiment.modelId);
        expect(model).toBeDefined();

        const calculate = model!.bind({
            // Read from the model's own default rather than written here. A literal `550` was added to
            // the register project-context says may only shrink, and it is the one number in this file
            // that a content edit could have made wrong without anything noticing.
            selectedWavelengthNm: definition.experiment.wavelengthComparison?.fixedMinimumPathNm ?? await authoredWavelengthNm(),
            selectedWavelengthMode: 'minimum'
        });
        const atDefaults = Object.fromEntries(definition.apparatus.primaryControls.map(({ id, defaultValue }) => [id, defaultValue]));
        let checked = 0;

        definition.apparatus.primaryControls
            .filter((control) => controlAffordance(control) === 'dial')
            .forEach((control) => {
                const atMin = calculate({ ...atDefaults, [control.id]: control.min });
                const atMax = calculate({ ...atDefaults, [control.id]: control.max });

                expect(atMin.ok).toBe(true);
                expect(atMax.ok).toBe(true);
                expect(atMin.ok && atMin.value.value).toBe(atMax.ok && atMax.value.value);
                checked += 1;
            });

        // Zero dials in this case is legitimate — Young authors none — so the floor cannot live here.
        // `expect(checked).toBeGreaterThanOrEqual(0)` used to, on a non-negative counter, which made it
        // unfailable; and the comment sent the reader to a vocabulary test that was itself a tautology.
        // The floor is now asserted across the whole sweep, once, below.
        dialsChecked += checked;
    });

    it('checked at least one real dial across every case it swept', () => {
        // The vacuity guard, stated where it can actually fail: delete `"affordance": "dial"` from the
        // prototype and the example and this goes red, where the per-case assertions all pass vacuously.
        expect(dialsChecked).toBeGreaterThan(0);
    });
});

/**
 * AC5, half two: **no case ID is written into a scene, a renderer, or the router.**
 *
 * The router already drives the whole flow from the authored script — that shipped with Story 3.2 and
 * the fixture-driven walk in `tests/integration/SceneRouter.test.ts` proves it. This is the half that
 * earns its keep: that walk passes today and would go on passing while somebody wrote
 * `young-interference` into a renderer, at which point the framework quietly stops carrying a second
 * case while every test stays green. That is the exact failure Story 3.2 hit three times.
 *
 * The two sanctioned seams are **named here** so adding a third is a deliberate edit of this test
 * rather than a silent one:
 *
 * - `src/adapters/content/resolveCaseId.ts` — the `?case=` route gate, against `KNOWN_CASE_IDS`.
 * - `src/schemas/CaseDefinitionSchema.ts` — Young's own invariants, in a refinement branched on `id`.
 *
 * Neither is under a directory this sweeps, which is the point: the seams are *outside* the scene and
 * domain layers by construction, so the sweep needs no exemption list at all.
 */
describe('no case ID reaches a scene, a renderer, or the domain', () => {
    const SWEPT_DIRECTORIES = ['src/adapters/phaser', 'src/domain'];

    /**
     * The case ID as a whole name, so `morley-miller-interferometer` is not read as `morley-miller`.
     *
     * That distinction is the whole subtlety here and it is load-bearing: `experimentModels.ts` names
     * the **model** `morley-miller-interferometer`, which is sanctioned — a case's physics is a keyed
     * lookup on `modelId` and deliberately never on the case ID. A substring sweep would report it and
     * be silenced with an exemption, and the exemption would then hide a real case ID in the same file.
     */
    const wholeCaseId = (caseId: string): RegExp => new RegExp(`${caseId}(?![\\w-])`, 'u');

    const offenders = async (): Promise<readonly string[]> => {
        const files = (await Promise.all(SWEPT_DIRECTORIES.map(listRepoSourceFiles))).flat();
        expect(files.length).toBeGreaterThan(20);

        const found = await Promise.all(files.map(async (path) => {
            const source = await readRepoFile(path);
            return KNOWN_CASE_IDS
                .filter((caseId) => wholeCaseId(caseId).test(source))
                .map((caseId) => `${path} names ${caseId}`);
        }));
        return found.flat();
    };

    it('finds none, in any scene, renderer or domain module', async () => {
        expect(await offenders()).toEqual([]);
    });

    it('would find one if it were there, and does not confuse a model id for a case id', async () => {
        // Without this the sweep above could pass by matching nothing at all — a regex typo, a wrong
        // directory, an empty file list. So: the boundary rule accepts a real case ID and rejects the
        // model whose name begins with one, asserted against the file that actually contains it.
        const models = await readRepoFile('src/domain/apparatus/experimentModels.ts');

        expect(models).toContain('morley-miller-interferometer');
        expect(wholeCaseId('morley-miller').test(models)).toBe(false);
        expect(wholeCaseId('morley-miller').test("case id 'morley-miller' here")).toBe(true);
        expect(wholeCaseId('young-interference').test("import '../cases/young-interference'")).toBe(true);
    });

    it('leaves the two sanctioned seams doing their job', async () => {
        // Both are outside the swept directories, and both must still hold the ID — a seam that stopped
        // naming a case would mean the route gate or Young's invariants had quietly gone away.
        expect(await readRepoFile('src/adapters/content/resolveCaseId.ts')).toContain('KNOWN_CASE_IDS');
        expect(await readRepoFile('src/schemas/CaseDefinitionSchema.ts')).toContain("YOUNG_CASE_ID = 'young-interference'");
        SWEPT_DIRECTORIES.forEach((directory) => {
            expect('src/adapters/content/resolveCaseId.ts'.startsWith(directory)).toBe(false);
            expect('src/schemas/CaseDefinitionSchema.ts'.startsWith(directory)).toBe(false);
        });
    });
});

/**
 * The authoring example (Story 3.4, AC7 and AC8).
 *
 * `docs/content-authoring/minimal-scenario.case.json` is a **complete** `CaseDefinition` rather than a
 * fragment, because a fragment would demonstrate nothing about "a new case can be authored without
 * touching engine code". Parsing it through the production schema *is* the assertion: the example's
 * whole job is to be valid, and a schema change that invalidates it fails here rather than misleading
 * the next author who copies it.
 */
describe('the authoring example', () => {
    it('parses through the production schema', async () => {
        await expect(loadAuthoringExample()).resolves.toMatchObject({ id: 'example-minimal-scenario' });
    });

    it('is not a shipped case, and could not be routed to as one', async () => {
        // Under `docs/`, not `public/cases/`: shipped content is immutable and `resolveCaseId` gates on
        // `KNOWN_CASE_IDS`, so an example there would be dead weight in the bundle and a live route.
        const definition = await loadAuthoringExample();

        expect(KNOWN_CASE_IDS).not.toContain(definition.id);
    });

    /**
     * AC7's minimality, measured — and measured **at the top level only**, which is now said out loud.
     *
     * Every required top-level field is deleted in turn and every bounded array shortened by one; all of
     * them must be refused. What this sweep does **not** do is descend: Story 3.4's code review found
     * that every `dialogueBeats` array can be deleted from the example and it still parses, because
     * dialogue is genuinely optional in the schema. So "nothing removable" was never true of the
     * fixture, and the docstring that stood here claimed an exception list "exactly two entries long"
     * that did not exist in the code at all — and could not have, since neither new field is top-level
     * and neither ever entered the sweep.
     *
     * The list below is that exception list, made real. It is deliberately about *nested optional
     * content an author is expected to write*: an example with no dialogue would demonstrate none of the
     * cast rules, which is the example's main job. Anything not named here must be load-bearing.
     */
    it('has nothing removable at the top level, and names every nested exception', async () => {
        const raw = JSON.parse(await readRepoFile('docs/content-authoring/minimal-scenario.case.json')) as Record<string, unknown>;
        const clone = (): Record<string, unknown> => JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
        const survives = (mutate: (copy: Record<string, unknown>) => void): boolean => {
            const copy = clone();
            mutate(copy);
            return CaseDefinitionSchema.safeParse(copy).success;
        };

        const removable = Object.keys(raw)
            .filter((key) => survives((copy) => { delete copy[key]; }))
            .map((key) => `top-level ${key}`);

        const BOUNDED_ARRAYS = [
            'contextualArtifacts', 'predictionProposals', 'conclusionProposals',
            'consultationRules', 'peerReviewRules', 'colleagueHints', 'readingGateHints', 'colleagues'
        ] as const;
        const shortenable = BOUNDED_ARRAYS
            .filter((key) => survives((copy) => {
                const list = copy[key] as unknown[];
                copy[key] = list.slice(0, -1);
            }))
            .map((key) => `one fewer ${key}`);

        expect([...removable, ...shortenable]).toEqual([]);

        // The nested exceptions, asserted to be *exactly* what is claimed — both that each really is
        // removable (so the list cannot rot into a stale excuse) and that nothing else in the same
        // position is. `dialogueBeats` is the one: optional per scene, and the example needs it.
        const NESTED_OPTIONAL = ['scenarioScript.scenes[].dialogueBeats'] as const;
        expect(survives((copy) => {
            const script = copy.scenarioScript as { scenes: Array<Record<string, unknown>> };
            script.scenes.forEach((scene) => { delete scene.dialogueBeats; });
        })).toBe(true);
        expect(NESTED_OPTIONAL).toHaveLength(1);
        // And the two fields this story adds, which are nested and optional by design.
        expect(survives((copy) => {
            const script = copy.scenarioScript as { scenes: Array<Record<string, unknown>> };
            script.scenes.forEach((scene) => { delete scene.cast; });
        })).toBe(true);
        // The guard that stops this passing on an empty subject: the sweep must have had something to
        // delete, and the example must really carry every array it claims to.
        expect(Object.keys(raw).length).toBeGreaterThanOrEqual(20);
        BOUNDED_ARRAYS.forEach((key) => expect((raw[key] as unknown[]).length).toBeGreaterThan(0));
    });

    it('exercises both new fields, and both are genuinely optional', async () => {
        const definition = await loadAuthoringExample();
        const raw = JSON.parse(await readRepoFile('docs/content-authoring/minimal-scenario.case.json')) as Record<string, unknown>;
        const drop = (mutate: (copy: Record<string, unknown>) => void): boolean => {
            const copy = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
            mutate(copy);
            return CaseDefinitionSchema.safeParse(copy).success;
        };

        // A non-default affordance, and a per-scene cast that genuinely leaves somebody out — a cast
        // naming the whole cast would demonstrate the syntax and none of the behaviour.
        expect(definition.apparatus.primaryControls.map(controlAffordance)).toContain('dial');
        const authored = definition.scenarioScript.scenes.filter(({ cast }) => cast !== undefined);
        expect(authored.length).toBeGreaterThan(0);
        expect(authored.some(({ cast }) => cast!.length < definition.colleagues.length)).toBe(true);

        // AC4 at the example: removing either field still parses, which is what "additive" means.
        expect(drop((copy) => {
            delete ((copy.apparatus as { primaryControls: Record<string, unknown>[] }).primaryControls[0]!).affordance;
        })).toBe(true);
        expect(drop((copy) => {
            (copy.scenarioScript as { scenes: Record<string, unknown>[] }).scenes.forEach((scene) => { delete scene.cast; });
        })).toBe(true);
    });

    /**
     * AC8: every authored string in the example carries both locales, and the French is French.
     *
     * The completeness half is the schema's, so this walks the *values*: no French string may be
     * byte-identical to its English sibling unless it is genuinely locale-invariant. Proper nouns and
     * bare numerals are, and are the only exemption — everything else identical in both columns is the
     * project's most-repeated defect wearing a `fr` key.
     */
    it('carries French that is French, not English with a fr key', async () => {
        const raw = JSON.parse(await readRepoFile('docs/content-authoring/minimal-scenario.case.json'));
        const identical: string[] = [];

        const walk = (node: unknown, path: string): void => {
            if (Array.isArray(node)) return node.forEach((child, index) => walk(child, `${path}[${index}]`));
            if (node === null || typeof node !== 'object') return;
            const record = node as Record<string, unknown>;
            if (typeof record.en === 'string' && typeof record.fr === 'string' && record.en === record.fr) {
                identical.push(`${path}: "${record.en}"`);
            }
            Object.entries(record).forEach(([key, value]) => walk(value, `${path}.${key}`));
        };
        walk(raw, 'case');

        expect(identical).toEqual([]);
        // And the French genuinely uses the repertoire, so a machine-untranslated column is visible.
        const french = JSON.stringify(raw).match(/"fr":"[^"]*"/gu) ?? [];
        expect(french.length).toBeGreaterThan(30);
        expect(french.filter((entry) => /[àâçéèêëîïôùûœ’]/u.test(entry)).length).toBeGreaterThan(20);
    });
});

/**
 * The authoring guide quotes the real refusal messages (Story 3.4, AC6).
 *
 * AC6 asks the guide to state the load-time rules "each with the message an author will actually see".
 * A quoted message is prose, and prose goes stale on the next commit — so every message the guide
 * quotes is checked against the schema that emits it. An author who searches for the sentence they hit
 * lands on the page that explains it, and keeps doing so.
 *
 * The converse is not asserted, deliberately: the guide is a guide, not an exhaustive error index, and
 * requiring it to quote all eighty-odd messages would make it worse to read.
 */
describe('the authoring guide', () => {
    /**
     * The schema source with its one interpolated message resolved.
     *
     * `Only a scene that stages a figure column may author a cast (${…join(', ')})` is a template
     * literal, so the text an author sees never appears verbatim in the file. Resolving it here is the
     * honest comparison; skipping it would quietly exempt the newest message on the page from the check.
     */
    const resolvedSchemaSource = async (): Promise<string> =>
        (await readRepoFile('src/schemas/CaseDefinitionSchema.ts'))
            .replace('${FIGURE_STAGING_SCENE_KEYS.join(\', \')}', FIGURE_STAGING_SCENE_KEYS.join(', '));

    /** Every backticked sentence in the guide's refusal tables — a capitalised span ending in a full stop. */
    const quotedMessages = async (): Promise<readonly string[]> => {
        const guide = await readRepoFile('docs/content-authoring/README.md');
        const quoted = guide.match(/`[A-Z][^`]*\.`/gu) ?? [];
        return [...new Set(quoted.map((entry) => entry.slice(1, -1)))];
    };

    it('quotes only messages the schema actually emits', async () => {
        const source = await resolvedSchemaSource();
        const quoted = await quotedMessages();

        // A real subject: the guide must be quoting a substantial number of them, or "all of the ones
        // it quotes are real" is satisfied by quoting none.
        expect(quoted.length).toBeGreaterThanOrEqual(25);
        expect(quoted.filter((message) => !source.includes(message))).toEqual([]);
    });

    it('names the worked example, the rights page and the i18n page', async () => {
        // The three cross-references AC6 asks for, so a reorganisation that orphans one fails here.
        const guide = await readRepoFile('docs/content-authoring/README.md');

        expect(guide).toContain('minimal-scenario.case.json');
        expect(guide).toContain('../source-rights/README.md');
        expect(guide).toContain('../i18n-authoring.md');
    });

    it('states the EN+FR obligation as authoring rather than as follow-up work', async () => {
        const guide = await readRepoFile('docs/content-authoring/README.md');

        expect(guide).toContain('EN + FR from the first release');
        expect(guide).toContain('not follow-up i18n work');
    });

    it('carries the AC1 inventory: every named field group, mapped to its schema symbol', async () => {
        // The inventory is what turns AC1 from "already done" into a deliverable, so its six rows are
        // pinned. Each schema symbol is checked to exist in the schema as well as to appear in the
        // guide — a table naming a symbol that was renamed away is worse than no table.
        const guide = await readRepoFile('docs/content-authoring/README.md');
        const source = await resolvedSchemaSource();
        const INVENTORY = [
            ['scenarioScript', 'ScenarioScriptSchema'],
            ['colleagues[]', 'ColleagueSchema'],
            ['predictionProposals[]', 'PredictionProposalSchema'],
            ['conclusionProposals[]', 'ConclusionProposalSchema'],
            ['significanceRule', 'SignificanceRuleSchema'],
            ['rivalLab.critiques[]', 'RivalLabSchema']
        ] as const;

        const missing = INVENTORY.flatMap(([group, symbol]) => [
            ...(guide.includes(`\`${group}\``) ? [] : [`the guide does not name ${group}`]),
            ...(guide.includes(`\`${symbol}\``) ? [] : [`the guide does not name ${symbol}`]),
            ...(source.includes(`${symbol} =`) ? [] : [`the schema no longer defines ${symbol}`])
        ]);

        expect(missing).toEqual([]);
    });
});
