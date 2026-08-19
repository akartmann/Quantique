# Authoring a case

How a Quantique case is written as data: its scenario script, its colleague cast, its two proposal
sets, its significance rule, and its rival-lab lines — and what will refuse you, with the message you
will actually see.

**A new case is content, not code.** The scenes, the evaluator and the widgets are shared; a case
supplies the script they obey. Two cases ship on that basis today (`young-interference` and
`morley-miller`), and the only engine change either needed was a deterministic physics model.

Everything here is validated by `CaseDefinitionSchema` (`src/schemas/CaseDefinitionSchema.ts`) at
**load**, not at play. A case that would strand a player is refused when it is read.

## Start from the worked example

[`minimal-scenario.case.json`](minimal-scenario.case.json) is a **complete** case definition — the
smallest one that parses, with nothing removable except the two optional fields it exists to
demonstrate. Copy it and replace the content.

It is deliberately not under `public/cases/`: that directory is shipped, immutable content and the
`?case=` route gate only admits `KNOWN_CASE_IDS`, so an example there would be dead weight in the
bundle and a live route to a case that teaches nothing.

`tests/unit/ScenarioAuthoringContract.test.ts` parses it through the production schema and asserts
its minimality, so it cannot rot into an invalid example or quietly grow removable parts.

To check your own case, put it under `public/cases/<your-case-id>/case.json`, add the id to
`KNOWN_CASE_IDS`, and load `?case=<your-case-id>`. A refusal appears as a load error naming the
offending path.

## The contract, and where each rule lives

Six field groups make a case a guided adventure. Each is shaped by a schema symbol and held by
refinements — and the refinements are the interesting half, because a shape can only say "a string
goes here" while the rules below say "this string must name somebody who exists".

| Field group | Schema symbol | What the shape fixes | What the refinements enforce |
|---|---|---|---|
| `scenarioScript` | `ScenarioScriptSchema`, `ScenarioSceneSchema`, `ScenarioDialogueBeatSchema` | Ordered scenes; each names a `phase` and a `sceneKey` from the closed vocabulary | Covers every phase exactly once; beat ids unique within a scene; every `speakerId` an authored colleague and a member of that scene's `cast`; no authored copy encodes a route; the four `cast` rules below |
| `colleagues[]` | `ColleagueSchema` | At least one; a stable id, a canonical name, a role, and a portrait | Ids unique; an asset portrait must name an authored **image** asset |
| `predictionProposals[]` | `PredictionProposalSchema` | **Exactly four** (`.length(4)` — the count is the design) | Ids unique within the set; each attributed to an authored colleague; no copy encodes a route |
| `conclusionProposals[]` | `ConclusionProposalSchema`, `ConclusionSupportPredicateSchema` | **Exactly four**; each carries a claim, a limitation and a support predicate | All of the above, plus: predicates may only name authored controls and authored sources; an `all-of` needs at least one child; **at least one proposal must be defensible on some evidence** |
| `significanceRule` | `SignificanceRuleSchema` | `criticalControlIds`, and optionally `criticalModelInputIds` | May only name authored primary controls; no control or model input named twice; a recorded model input must be one the model actually records |
| `rivalLab.critiques[]` | `RivalLabSchema` | A name, an accent colour, a figure, and the critique lines | Ids unique; every critique answers an authored conclusion proposal; **every conclusion proposal carries at least one critique**; no copy encodes a route; the editorial length bound |

Two more groups are not in that list but will refuse you just as readily: `colleagueHints` (the
gate's voice) and `readingGateHints` (the reading gate's), both covered below.

## The scenario script

```jsonc
"scenarioScript": {
  "scenes": [
    { "phase": "context",    "sceneKey": "Library" },
    { "phase": "prediction", "sceneKey": "Colleagues", "cast": ["ada-reeve"],
      "dialogueBeats": [ { "id": "framing", "speakerId": "ada-reeve", "text": { "en": "…", "fr": "…" } } ] },
    { "phase": "experiment", "sceneKey": "Laboratory" },
    { "phase": "synthesis",  "sceneKey": "TheoryBoard" },
    { "phase": "review",     "sceneKey": "TheoryBoard" },
    { "phase": "debrief",    "sceneKey": "Debrief" }
  ]
}
```

**The six phases are fixed and the map must cover each exactly once.** They are
`context → prediction → experiment → synthesis → review → debrief`. The scene vocabulary is
`Library`, `Colleagues`, `Laboratory`, `TheoryBoard`, `Debrief`.

**Array order carries no meaning.** `resolveSceneKey` looks a scene up by phase; the sequence of the
adventure belongs to the phase machine. Reordering the list changes nothing, and you are free to send
any phase to any scene — the router obeys the script and nothing else, which is what lets a second
case reuse every scene without touching them.

**One scene may host two phases.** `TheoryBoard` hosts `synthesis` and `review` in both shipped cases,
as two separate entries. Anything that reads "the current scene's" content must therefore key on the
**phase**, not on the scene key.

**The rival lab is routable but not authorable.** It is not a phase — it is a state the theory board
enters and leaves while the phase stands still — so it is deliberately absent from the scene
vocabulary. You author his critique lines, not a scene for him.

**`dialogueBeats` is optional, and `[]` means the same as absent.** "No conversation yet" is
something an author means, so both are accepted. That is the opposite call to `cast` below, and the
asymmetry is deliberate.

## Who is in the room — `scenes[].cast`

Optional. **Absent means the whole cast.**

```jsonc
{ "phase": "prediction", "sceneKey": "Colleagues", "cast": ["ada-reeve"] }
```

It decides **presence only**. Sequence is still proposal order — the members who authored a proposal
on this board, in proposal order, then the rest of the authored cast in the order you wrote them. That
is not a detail: the two boards attribute in different orders, so staging in cast order would put most
of the cast beside somebody else's draft.

Four rules hold it, all at load:

1. Every id resolves to an authored `colleagues[]` entry. This also stops you staging the rival lab,
   who is deliberately not a member of the cast.
2. No id repeats — a duplicate would stage one figure twice and halve the slot width for everybody.
3. **An authored `[]` is refused.** Absence already means "everyone", so `[]` could only mean
   "nobody", and no scene that draws a figure column can render that.
4. Every one of that scene's `dialogueBeats` must be spoken by a member of the cast. This is the rule
   that makes the field safe: without it a beat plays with its speaker nowhere on stage.

**Only a scene that draws a figure column may author one** — `Colleagues` and `TheoryBoard`. A `cast`
on `Library`, `Laboratory` or `Debrief` is refused rather than shipped as content nothing reads.

## Which instrument a control is — `primaryControls[].affordance`

Optional, one of `knob` | `dial` | `slider`. **Absent means `knob`.**

```jsonc
{ "id": "rotationDeg", "unit": "°", "min": 0, "max": 180, "step": 15,
  "defaultValue": 0, "affordance": "dial" }
```

They are three instruments, not three labels — different geometry and a different pointer→value
conversion each. The authored `min`, `max`, `step` and `defaultValue` mean exactly what they meant
before, every affordance keeps its two discrete step controls and keyboard stepping, and every one
snaps to the authored step before dispatching.

| Affordance | Travel | Author it for |
|---|---|---|
| `knob` | A 270° arc with a hard stop and a dead zone where the shaft is | A bounded setting whose ends are real ends. Young's two. |
| `dial` | A full circle read against a fixed index mark, no dead zone | A **cyclic** quantity. The prototype's bench rotation. |
| `slider` | Linear travel along a track with a draggable thumb | A quantity read off a scale. The prototype's bath temperature. |

**A dial's travel closes**, so its minimum and its maximum stand at the index mark together and it
cannot distinguish them. That is right for a cyclic quantity and wrong for anything else. No schema
can tell which yours is — cyclicity is a property of the *model*, not of the range — so the rule is
yours to keep, and `ScenarioAuthoringContract.test.ts` checks every shipped dial against its own model
to make sure the two ends really do read the same. Author a `knob` if they do not.

## Proposals

**Four predictions and four conclusions. Not a minimum — the count is the design.** Both are 1-of-4
attributed choices, and both are revisable: re-choosing must never fail.

Each proposal is attributed to a colleague by `colleagueId`. Attribution is what the figure column
stages and what the card's byline reads, so a proposal attributed to somebody the scene's `cast`
leaves out will still be shown — the card is not the figure.

A conclusion also carries a `limitation` and a `supportPredicate`:

```jsonc
{
  "id": "example-conclude-bounded",
  "colleagueId": "ada-reeve",
  "claim":      { "en": "…", "fr": "…" },
  "limitation": { "en": "…", "fr": "…" },
  "supportPredicate": {
    "kind": "all-of",
    "predicates": [
      { "kind": "minimum-runs", "count": 2 },
      { "kind": "varied-control", "controlId": "rotationDeg" },
      { "kind": "unvaried-control-pinned", "controlId": "bathTempC" },
      { "kind": "inspected-source", "sourceId": "example-primary-note" }
    ]
  }
}
```

The vocabulary is `all-of`, `minimum-runs`, `varied-control`, `unvaried-control-pinned`,
`inspected-source`, and `never`. `all-of` may nest, up to three levels.

**`never` is a legitimate authored answer** and is how you write a proposal that overreaches: it is
offered, it is choosable, and the evaluator will not defend it. Two of the four conclusions in the
worked example are `never`, which is the usual shape — but **at least one must be satisfiable**, or
the case is uncompletable by construction and is refused at load. An `all-of` with an empty
`predicates` array is vacuously true and is separately refused.

**Read the scope difference carefully, because getting it wrong makes a conclusion unreachable.**
`unvaried-control-pinned` reads only the runs the player has **pinned**; every other support predicate
reads the whole notebook. That distinction is the one this project got wrong once and nearly shipped:
an all-runs "was this held steady?" made the prototype's headline conclusion impossible for any player
who followed the case's own `experiment.resetPath`, which tells them to move the bath and come back.
"Did you ever vary this?" is a whole-notebook question. "Was this held steady?" is a pinned one.

## The significance rule

```jsonc
"significanceRule": { "criticalControlIds": ["rotationDeg", "bathTempC"] }
```

It answers one question: *are these two runs the same configuration?* Two runs whose critical control
values all match count once. The conclusion unlocks on **two significant measures**, so this rule
decides what counts as a second one.

- `criticalControlIds` may only name controls the case authors, and none twice.
- `criticalModelInputIds` — optional — may only name inputs the case's model actually records. A
  one-letter typo here used to load clean and silently collapse a dimension out of the comparison.

**Ask the reachability question of every rule you write:** can a player reach
`requirements.minimumSignificantRuns` distinct configurations with the controls this case authors? The
schema now refuses a requirement larger than the configuration space, but it cannot check that the
route there is one your case actually teaches. If your `resetPath` tells the player to move a control,
that control had better be one the rule counts.

## Colleague hints and reading-gate lines

A refused action always says why, and where the player can act on it the answer comes from a colleague
in fiction rather than from an error.

```jsonc
"colleagueHints": [
  { "id": "…", "colleagueId": "ada-reeve", "predicate": { "kind": "no-recorded-runs" },   "line": { "en": "…", "fr": "…" } },
  { "id": "…", "colleagueId": "ada-reeve", "predicate": { "kind": "below-significant-measures" }, "line": { "en": "…", "fr": "…" } }
]
```

Hint predicates: `no-recorded-runs`, `repeated-configuration`, `unvaried-control` (naming a control),
`below-significant-measures`. Reading-gate predicates: `missing-artifact` (naming an artifact),
`any-missing-reading`.

**Order matters, and the catch-all goes last.** The first matching line wins, so a
`below-significant-measures` hint written before a narrower one shadows it — and the schema requires
it to be last for exactly that reason. `any-missing-reading` is under the same rule. Both are
**required**: the gate must always have something to say.

Hints point at missing evidence, a source, an observable or a test. They never supply the answer.

## Rival-lab lines

```jsonc
"rivalLab": {
  "name": "Mr. Silas Crow",
  "accentColor": "#8c3b3b",
  "figure": { "build": "suited", "pose": "arms-folded", "hair": "cropped", "hairColor": "grey", "skinTone": "light", "moustache": true },
  "critiques": [ { "id": "…", "proposalId": "example-conclude-bounded", "line": { "en": "…", "fr": "…" } } ]
}
```

**Every conclusion proposal must carry at least one critique.** Coverage has to be total because
critique selection is: a conclusion he had nothing to say about would submit into silence, and there
is deliberately no generic fallback line to cover for you.

He is **narrative dressing and never a fail state** — no score, no game over, no penalty. He challenges
an unsupported claim and routes the player back to revision, and that is the whole of his power.

Each line is bounded at 700 characters, enforced at load, because it is painted into a fixed canvas
band with no scroll.

## What will refuse you

The messages below are quoted from the schema, so searching for one you have hit lands here. Every
issue names the offending path — `scenarioScript.scenes.1.cast.0`, and so on.

### The scenario script and its cast

| Message | Cause |
|---|---|
| `The scenario script must map every case phase exactly once.` | A phase is missing or listed twice. |
| `Dialogue beat IDs must be unique within a scene.` | Two beats in one scene share an id. Across scenes a repeat is fine — `prediction` and `review` may both open with `intro`. |
| `Every dialogue beat must be spoken by an authored colleague.` | A `speakerId` is not in `colleagues[]`. |
| `Every dialogue beat must be spoken by a member of its own scene's cast.` | The speaker is authored, but this scene's `cast` leaves them out. |
| `Every scene cast member must be an authored colleague.` | A `cast` id is not in `colleagues[]` — the rival lab included. |
| `A scene cast must not name the same colleague twice.` | A duplicate in `cast`. |
| `An authored scene cast must name at least one colleague. Omit the field to stage the whole cast.` | `"cast": []`. |
| `Only a scene that stages a figure column may author a cast (Colleagues, TheoryBoard).` | A `cast` on `Library`, `Laboratory` or `Debrief`. |

### Proposals, predicates and the gate

| Message | Cause |
|---|---|
| `Every proposal must be attributed to an authored colleague.` | A `colleagueId` is not in `colleagues[]`. |
| `Proposal IDs must be unique within each proposal set.` | Two predictions, or two conclusions, share an id. |
| `At least one conclusion proposal must be defensible on some evidence.` | All four are `never`, or all are unsatisfiable. |
| `An all-of support predicate needs at least one child predicate.` | An empty `predicates` array — vacuously true. |
| `Conclusion proposals may only reference authored controls.` | A predicate names a control the case does not author. |
| `Conclusion proposals may only reference authored sources.` | A predicate names a source the case does not author. |
| `Every conclusion proposal must carry at least one rival-lab critique.` | A conclusion he has nothing to say about. |
| `Every rival-lab critique must answer an authored conclusion proposal.` | A `proposalId` that does not exist. |
| `The significance rule may only name authored primary controls.` | A `criticalControlIds` entry the case does not author. |
| `The significance rule must not name the same control twice.` | A duplicate. |
| `Colleague hints must include a below-significant-measures hint, so the gate always has something to say.` | The gate's catch-all is missing. |
| `The below-significant-measures hint must be the last authored hint, or it shadows every hint after it.` | It is not last. |
| `Reading-gate lines must include an any-missing-reading line, so the gate always has something to say.` | The reading gate's catch-all is missing. |
| `The any-missing-reading line must be the last authored line, or it shadows every line after it.` | It is not last. |
| `A colleague hint may only ask the player to vary a control the significance rule treats as critical.` | Advice that cannot work: the player varies exactly what they were told to and the gate refuses again. |

### Copy that names a route

| Message | Cause |
|---|---|
| `Authored dialogue copy must not encode a scene, route, or phase path.` | An arrow (`→ ⇒ ⟶ -> =>`), or the words `scene`, `phase` or `route` in English copy. |
| `Authored proposal copy must not encode a scene, route, or phase path.` | The same, in a proposal. |
| `Colleague hint copy must not encode a scene, route, or phase path.` | The same, in a hint. |
| `Rival-lab copy must not encode a scene, route, or phase path.` | The same, in a critique. |
| `The case title must not encode a scene, route, or phase path.` | The same, in the title. |

Authored copy says **what to do next in fiction**, never the route the app takes to get there. "Read
the 1887 paper" is fine; "move to the next scene" is not. The word list is English-only on purpose —
`route` and `phase` are ordinary French words, and `scène` reads naturally in "mise en scène" — so
French is guarded at phrase level instead.

### Controls and the experiment

| Message | Cause |
|---|---|
| `Control max must be greater than min.` | Inverted or equal bounds. |
| `Control default must be in range and aligned to its step.` | A default the control cannot actually take. |
| `Primary control IDs must be stable and unique.` | A duplicate control id. |
| `The significant-measure requirement must not exceed the configurations the authored controls can produce.` | A gate no player could pass. |
| `The source requirement must not exceed the sources the case authors.` | The same, for sources. |
| `The minimum experiment cycle count must not exceed the maximum.` | Inverted cycle bounds. |

**The experiment model is a closed list.** `experiment.modelId` must be one this build implements —
`young-double-slit` or `morley-miller-interferometer` — and the model's own `requiredControlIds` must
all be authored by the case. A case naming a model that does not exist is refused when it is read
rather than when the player presses start. **A new physics model is engine work**, and the one thing on
this page that a case cannot supply by itself.

Sources and rights have their own page: [`docs/source-rights/README.md`](../source-rights/README.md).
Every case needs a `ledger`, and `npm run audit:ledger` is the gate.

## Every string you write is written twice

**EN + FR from the first release.** This is a property of authoring, not follow-up i18n work: a case
whose French is missing does not ship, and a case whose French is English with accents is the defect
this project has repeated more than any other.

Zod checks locale *completeness* when the case loads. It cannot check that the French is French, and
neither can any test — that part is yours.

Three things worth knowing before you start:

- **Scientific values are canonical across locales.** Author the number once; the display layer
  formats it. Never author `"0,25"` in the French column.
- **Never build a French phrase by joining a preposition to a label.** Elision depends on the following
  word, so no template gets it right — `de Écartement des fentes` shipped once, on content that had read
  correctly for two epics. That is why every control authors an `inlineLabel` per locale carrying its
  own in-prose form. Generalize it: when a sentence is assembled around your content, author the joined
  form rather than building it.
- **Proper nouns stay plain strings.** A colleague's name, an archive, a rights holder — these are not
  `LocalizedText` and are not translated.

The full rules, and where interface text lives as opposed to case content, are in
[`docs/i18n-authoring.md`](../i18n-authoring.md).
