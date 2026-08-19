/**
 * English interface resources — the reference locale and the runtime fallback.
 *
 * Flat, dotted keys on purpose: `keyof typeof en` then types the French resource directly, so a
 * missing translation is a `tsc` failure rather than a runtime discovery, and the completeness test
 * stays a one-line key comparison.
 *
 * Bundled TypeScript rather than fetched JSON: `public/sw.js` is a fetch-through worker with no
 * atomic pre-cache, so an unfetched locale file would be a 503 on an offline reload.
 *
 * Player-facing case content (dialogue, source labels, debrief, authored help) is NOT here — it is
 * `LocalizedText` in `case.json`. See `docs/i18n-authoring.md`.
 */
export const en = {
    // --- Boot shell -----------------------------------------------------------------------------
    'boot.eyebrow': 'Quantique',
    'boot.title': 'Historical science laboratory',
    'boot.intro': 'Open the starter laboratory shell to begin the Young validation slice.',
    'boot.enter': 'Enter laboratory',
    'boot.status.ready': 'Laboratory shell ready.',
    'boot.status.loadFailed': 'This page did not load correctly. Please reload it.',
    'boot.status.savedProgressUnusable': 'Saved progress could not be used. A fresh investigation is ready.',
    'boot.status.savedProgressUnavailable': 'Saved progress is unavailable right now. The investigation is ready to continue.',
    // NFR12, in the region the other two persistence messages already speak from (Story 2.12). The
    // autosave used to report into `CaseProgressPanel`'s status text; deleting that panel without
    // re-homing this would have made a failed save silent, which is the one thing NFR12 forbids.
    'boot.status.saveFailed': 'Progress could not be saved on this device right now. Your current work is unchanged.',

    // --- Validation session -----------------------------------------------------------------------
    // Facilitator-facing chrome on the moderated `?mode=validation` route. App-owned interface text,
    // not case content, so it lives here rather than in `case.json`.
    'validation.session.title': 'Young validation session',
    'validation.session.facilitatorHeld': 'Observations are held by the facilitator and de-identified outside this application.',
    'validation.session.noCollection': 'The application does not collect session responses.',

    // --- Laboratory surface ---------------------------------------------------------------------
    // Three of these named "the semantic laboratory controls" until Story 2.10. That surface is the
    // canvas now: the bench is turned with its own instruments and started with its own control, so a
    // line pointing at a retired DOM panel was telling the player to use something that is not there.
    'lab.guide': 'Turn each instrument to set the bench up, then start the light to record what the screen shows.',
    'lab.source': 'source',
    'lab.screen': 'screen',
    'lab.control.readout': '{label}: {value}',
    // The glyphs on the discrete step affordances, which every draggable instrument keeps (ADR-012).
    // They survive the retirement of the old text buttons because the affordance still carries them.
    'lab.control.decrease': '−',
    'lab.control.increase': '+',
    // Generic across cases: this is the *empty* state, so there is no run whose label could name the
    // quantity, and naming Young's told an interferometer's player their bench measures a fringe
    // spacing (review 2026-08-19). The other two branches of this ternary were de-Younged by 3.2.
    'lab.result.emptyHint': 'No measurement recorded yet. Start the light to record one.',
    'lab.result.recorded': 'Recorded pattern: {value} at {wavelength} nm ({mode} path).',
    'lab.result.stale': 'Last recorded result: {value}. The changed setup has not been run.',
    // The wavelength-free readout, for a case whose model records no optical inputs (Story 3.2).
    'lab.result.recordedPlain': 'Recorded {label}: {value}.',
    // A result unit that is prose rather than an SI symbol, so it needs a key on both sides. Declared by
    // the interferometer model as `resultUnitKey`; `mm` and `°C` need no such key.
    'experiment.unit.fringeWidths': 'fringe widths',
    // AC4's in-scene invitation, and what replaced `lab.preview`. The painted fringe preview went with
    // it: a screen pattern with no run behind it is exactly what "dark until the player starts it"
    // forbids, and the sentence had to stop promising one.
    // Composed from the case's own `apparatus.primaryControls` (Story 3.2), one `lab.idle.setting` per
    // authored control, joined with `list.separator`. It used to name Young's two quantities as literals.
    'lab.idle': 'The bench is dark at {settings}. Start the light to record an observation.',
    // Takes the control's authored *inline* form, which carries its own preposition and case. The
    // display label was interpolated here until review 2026-08-19 and produced a capital mid-sentence.
    'lab.idle.setting': '{value} {inlineLabel}',
    /**
     * The locale's own list separator.
     *
     * Identical in both bundles today, and kept as a key rather than a literal because the join sits in
     * shared code that must not assume it. An earlier docstring claimed French "sets a thin space before
     * its semicolons and commas alike"; French takes a thin space before `;` `:` `!` `?` and **none**
     * before a comma, so the rule as stated was wrong and the two values were already identical
     * (review 2026-08-19).
     */
    'list.separator': ', ',
    'lab.running': 'The light is crossing the bench…',
    // The **control's** in-flight label, which is a different string from the guidance line above it
    // for a measurable reason: the control is a fixed-height rectangle and the French sentence
    // overflows its 216px label bound at 15px, while the guidance line wraps at 620px and does not.
    'lab.start.running': 'Light running…',
    'lab.pattern.recorded': 'Recorded observation: {label} of {value} in the saved model result.',
    'lab.wavelengthMode.minimum': 'minimum',
    'lab.wavelengthMode.advanced': 'advanced',
    // The bench's own controls (Story 2.10; the reset joins them in 2.12). All three are fixed-height
    // hit targets, so all three are in the whole-string French sweep — a label that wraps past the
    // rectangle's own reserve clips, and a per-token sweep provably cannot see that.
    'lab.start': 'Start the light',
    'lab.notebook.open': 'Measurement notebook',
    // Story 2.2's "reset is immediate and does not erase saved observations", finally reachable from the
    // canvas (Story 2.12, D3). It names what it puts back — the setup — rather than the phase or scene
    // it stands in, which is the `encodesPath` rule.
    'lab.reset': 'Reset the setup',
    // The optional wavelength comparison, chosen in-scene (AC7). The advanced choices stay locked
    // until two fixed-550 nm observations exist; a click on a locked one is answered by
    // `error.advanced-wavelength-locked`, which already existed in both bundles.
    'lab.wavelength.heading': 'Wavelength',
    'lab.wavelength.fixed': '{value} nm — minimum path',
    'lab.wavelength.comparison': '{value} nm — comparison',
    'lab.wavelength.comparisonLocked': '{value} nm — locked',
    // The references kept to hand at the bench (Story 2.8). Re-reading one here records nothing and
    // changes no progression — the reading is recorded once, in the reading room.
    'lab.reference.heading': 'References to hand',

    // --- The bench notebook (Story 2.10) ---------------------------------------------------------
    // An overlay the player opens, not a permanent panel: the bench has no 620×364 band left for a run
    // list with two selections and a note field, and this surface does not scroll (D3). It renders
    // `record.result` and `record.experimentModelVersion` exactly as stored — no saved run is ever
    // recalculated against a newer model.
    'notebook.heading': 'Measurement notebook',
    'notebook.guide': 'Every saved observation keeps the setup and the result it was recorded with. Choose two to compare them.',
    'notebook.empty': 'No observation saved yet. Start the light at the bench to record one.',
    'notebook.observation': 'Observation {order}',
    /** One readout per authored control, joined by `notebook.row.settingsSeparator` (Story 3.2). */
    'notebook.row.settingsSeparator': ' · ',
    'notebook.row.result': '{label}: {value}',
    'notebook.row.meta': '{timestamp} · {wavelength} nm ({mode} path) · model {version}',
    'notebook.select': 'Compare',
    'notebook.selected': 'Chosen',
    'notebook.page.earlier': 'Earlier',
    'notebook.page.later': 'Later',
    'notebook.page.counter': '{from}–{to} of {total}',
    'notebook.note.label': 'Comparison note',
    'notebook.note.empty': 'Type your comparison here, then save it.',
    'notebook.note.save': 'Save the comparison',
    'notebook.note.saved': 'Comparison note saved.',
    'notebook.pairRequired': 'Choose two saved observations to compare.',
    // A third click needs its own answer: telling a player holding two to "choose two" is an instruction
    // to do what they have just done, and it does not say which one to let go of.
    'notebook.releaseOneFirst': 'Two are already chosen — release one first.',
    'notebook.close': 'Close the notebook',

    // --- In-scene advance affordance (Story 2.7) -------------------------------------------------
    // One label per forward transition. Every phase's scene carries one of these controls, because a
    // transition reachable only from outside the canvas does not exist.
    //
    // Each names what the player is moving **toward in the fiction** — a place, a person, or an act —
    // and never a scene key, a phase, a route, or an arrow. That is the `encodesPath` rule, which
    // rejects "scene", "phase", and "route" in authored case copy; interface copy holds to the same
    // line so the two never contradict each other on screen. `Colleagues`, `Laboratory`, `TheoryBoard`,
    // `Library`, and `Debrief` are scene keys; "the theory board" and "your colleagues" are furniture
    // and people. `advance.toTheoryBoard` is Story 2.6's `lab.advance` verbatim, and it is the
    // calibration point the rest were written against.
    //
    // Kept short deliberately. Each labels a fixed-height rectangle, and a label that wraps to two
    // lines inside one clips — the defect class the per-token typography sweep provably cannot catch.
    // `french-typography.spec.ts` measures every one of these as a **whole string** in French.
    'advance.toColleagues': 'To your colleagues',
    'advance.toBench': 'To the bench',
    'advance.toTheoryBoard': 'To the theory board',
    'advance.toReviewers': 'To your reviewers',
    'advance.closeTheCase': 'Close the case',
    'advance.replay': 'Investigate it again',
    'revisit.toColleagues': 'Revisit your colleagues',
    'revisit.toBench': 'Return to the bench',
    'revisit.back': 'Back',
    'error.rival-lab-revision-required': 'Answer the rival laboratory before returning to the investigation.',

    // --- The reading room (Story 2.8) ------------------------------------------------------------
    // Room chrome and the labels on the artifact metadata only. The *content* — every display name,
    // creator, case relationship, and the colleague's line at the door — is `LocalizedText` in
    // `case.json`, and the provenance/type/rights enums resolve through the `source.*` families below.
    // Nothing here names a scene, a phase, or a route: "the reading room" is furniture, `Library` is a
    // scene key, and the two must never meet on screen.
    'library.heading': 'The reading room',
    'library.guide': 'Take a reference down from the shelf to read it. What you read is recorded as evidence you can cite later.',
    // Shown on an object whose reading is already on the record. Re-opening one is always allowed.
    'library.artifact.read': 'Read',
    'library.detail.creator': 'Creator or originating context: {value}',
    'library.detail.classification': '{type} · {provenance}',
    'library.detail.rights': 'Rights status: {status}',
    // Both are neutral by design: an artifact that cannot be read is a fact about the archive, never a
    // mistake the player made, and neither line may present it as evidence.
    'library.artifact.unavailable': 'The rights for this one have not been reviewed, so it cannot be read here or cited as evidence.',
    'library.artifact.noRendition': 'No local copy of this one is held here, so there is nothing to read from the shelf. Its provenance is described above, but it cannot be entered on the record as a reading.',

    // --- Deterministic experiment result --------------------------------------------------------
    // The canonical `ExperimentResult.label` stays English in the record and is compared for string
    // equality on load; only its *display* is localized. See docs/i18n-authoring.md.
    'experiment.result.fringeSpacing': 'Fringe spacing',
    'experiment.result.fringeDisplacement': 'Fringe displacement',

    // --- Archival book chrome (the pages themselves are authored per locale; see book.translatedRendition) ---
    'book.previous': '‹ Previous',
    'book.next': 'Next ›',
    'book.close': 'Close book',
    'book.summary.show': 'Show summary',
    'book.summary.close': 'Close summary',
    'book.summary.heading': 'Summary',
    'book.caption.spread': '{source} · spread {index} of {total}',
    'book.caption.summary': '{source} · summary',
    'book.sourcePage.one': 'Source page {pages}.',
    'book.sourcePage.many': 'Source pages {pages}.',
    'book.printedPage': 'Printed page {pages}.',
    'book.translatedRendition': 'French translation of the English original. The cited source of record remains the English text.',

    // --- Source provenance categories (enum ids rendered as prose) ------------------------------
    'source.provenance.primary-material': 'primary material',
    'source.provenance.reconstruction': 'reconstruction',
    'source.provenance.later-interpretation': 'later interpretation',
    'source.provenance.deliberate-fiction': 'deliberate fiction',
    'source.unavailable': 'Unavailable source',

    // --- Curated Record (semantic source panel) -------------------------------------------------
    'curatedRecord.heading': 'Curated Record',
    'curatedRecord.statusLabel': 'Curated Record status',
    'curatedRecord.prompt': 'Inspect the available contextual sources and note how each one is presented.',
    'curatedRecord.term.creator': 'Creator or originating context',
    'curatedRecord.term.sourceType': 'Source type',
    'curatedRecord.term.provenanceReference': 'Provenance reference',
    'curatedRecord.term.caseRelationship': 'Case relationship',
    'curatedRecord.provenanceLabel': 'Provenance: {category}',
    'curatedRecord.rightsLabel': 'Rights status: {status}',
    'curatedRecord.inspect': 'Inspect {name}',
    'curatedRecord.inspected': 'Inspection recorded',
    'curatedRecord.status.recorded': '{name} is recorded as inspected evidence.',
    'curatedRecord.status.alreadyRecorded': '{name} is already recorded as inspected evidence.',
    'curatedRecord.status.duplicate': 'This source is already recorded as inspected evidence.',
    'curatedRecord.status.notEligible': 'This source cannot be inspected as verified evidence right now. Try another contextual source.',
    'curatedRecord.status.unavailable': 'This source is unavailable. Your existing inspected evidence is unchanged.',

    // Provenance shown as a standalone label, so sentence case rather than the mid-sentence form above.
    'source.provenanceName.primary-material': 'Primary material',
    'source.provenanceName.reconstruction': 'Reconstruction',
    'source.provenanceName.later-interpretation': 'Later interpretation',
    'source.provenanceName.deliberate-fiction': 'Deliberate fiction',
    'source.marker.primary-material': 'Primary-source marker',
    'source.marker.reconstruction': 'Reconstruction marker',
    'source.marker.later-interpretation': 'Later-interpretation marker',
    'source.marker.deliberate-fiction': 'Deliberate-fiction marker',
    'source.type.lecture-record': 'Lecture record',
    'source.type.published-book': 'Published book',
    'source.type.reconstruction': 'Reconstruction',
    'source.type.interpretive-essay': 'Interpretive essay',
    'source.type.fictionalized-account': 'Fictionalized account',
    'source.rights.reviewed': 'Reviewed',
    'source.rights.incomplete': 'Incomplete',
    'source.rights.unavailable': 'Unavailable',

    // --- Inquiry recognition (canonical labels stay in the record; display resolves by id) -------
    // The trailing "recorded" left these labels when the debrief gave them a surface (Story 2.11): the
    // row's own status column says `Recorded` or `Not this time` beside the label, so carrying it in
    // both was the same word twice — and the French "relevée" pushed every label onto a second line
    // inside a fixed row, which the 1280×720 pass caught. Shortened in both locales rather than the
    // bound relaxed.
    'recognition.source-discipline.label': 'Source discipline',
    'recognition.source-discipline.description': 'Each reviewed contextual source has been inspected as evidence.',
    'recognition.replication.label': 'Replication',
    'recognition.replication.description': 'Two observations use the same setup for comparison.',
    'recognition.variable-curiosity.label': 'Variable curiosity',
    'recognition.variable-curiosity.description': 'Two observations use different authored control settings for comparison.',
    'recognition.calibrated-conclusion.label': 'Calibrated conclusion',
    'recognition.calibrated-conclusion.description': 'A reviewed revision makes a bounded claim without an overreach finding.',

    // --- The debrief (Story 2.11) ---------------------------------------------------------------
    // Room chrome only. The summary, the comparison, the deeper theory and the counterfactual warning
    // are `LocalizedText` in case.json, like every other string a player reads as content.
    //
    // Nothing here names a scene, a phase, or a route (`encodesPath`): "the historical record" and
    // "the case" are things in the fiction, where `Debrief` is a scene key.
    'debrief.heading': 'Closing the case against the historical record',
    'debrief.sources.heading': 'Sources cited in this comparison',
    // Provenance said out loud beside every citation (AC2). The middle dot is canonical in both
    // locales; the three values are resolved from the `source.*` families the reading room uses.
    'debrief.sources.line': '{provenance} · {type} · {rights}',
    // The optional deeper-theory layer's state label. Short on purpose: it shares a fixed-height strip
    // with the authored title beside it, and a wrapped label inside a fixed rectangle clips.
    'debrief.deeperTheory.show': 'Show more',
    'debrief.deeperTheory.hide': 'Show less',
    'debrief.recognition.heading': 'What you recorded along the way',
    // The framing that keeps four ticked lines from reading as a tally. The design forbids a score,
    // and a list of achievements with no framing is one by another name (AC3).
    'debrief.recognition.intro': 'Not a score. An account of the practices this investigation shows.',
    'debrief.recognition.achieved': 'Recorded',
    'debrief.recognition.notRecorded': 'Not this time',
    // Inquiry, not failure (AC3) — carried by the heading itself rather than by a disclaimer under it.
    // "Where your claim was tested" is what a challenge *was*; a heading naming the objections and a
    // line underneath explaining that they do not count against you is the same fact said twice, and
    // the second half is the one that sounds defensive.
    'debrief.critiques.heading': 'Where your claim was tested',
    // The paged counter lives in the heading, so the row carries one interface string rather than a
    // heading and a separate counter sharing a measured budget with two controls.
    'debrief.critiques.headingCounted': 'Where your claim was tested — {index} of {total}',
    'debrief.critiques.empty': 'No challenge was raised against the conclusion you submitted. Nothing was scored either way.',
    'debrief.critiques.earlier': 'Earlier',
    'debrief.critiques.later': 'Later',
    'debrief.record.unavailable': 'This record has no completed investigation attached to it.',

    // --- The case file (Story 2.11) ---------------------------------------------------------------
    // The overlay the theory board hosts, carrying the four support/review intents that had no canvas
    // dispatcher and the readiness list `error.conclusion-not-ready` promises (AC5, AC7).
    //
    // "The case file" is a thing on the desk; `TheoryBoard` is a scene key. Nothing here names a scene,
    // a phase, or a route.
    'caseFile.open': 'Open the case file',
    'caseFile.heading': 'The case file',
    'caseFile.guide': 'Pin the observations and references your conclusion rests on. Pinning changes nothing else, and you can unpin at any time.',
    'caseFile.close': 'Close the case file',
    'caseFile.observations.heading': 'Recorded observations',
    'caseFile.observations.empty': 'No observation recorded yet.',
    'caseFile.observation': 'Observation {order}',
    // One list of authored readouts, then the result — not two Young-named slots (review 2026-08-19).
    'caseFile.observation.detail': '{settings} · {result}',
    'caseFile.sources.heading': 'References you have read',
    'caseFile.sources.empty': 'No reference read yet.',
    'caseFile.source.detail': '{type} · {provenance}',
    // Both fixed-height labels on the same control, so both are in the whole-string French sweep.
    'caseFile.pin': 'Pin as support',
    'caseFile.unpin': 'Unpin',
    'caseFile.page.earlier': 'Earlier',
    'caseFile.page.later': 'Later',
    'caseFile.page.counter': '{from}–{to} of {total}',
    // AC7: `error.conclusion-not-ready` names **the case file**, and this is the case file. It used to
    // name the theory board, which is where the retired DOM panel listed this and where the canvas
    // board lists nothing — so a refused player read the message, looked at the board and found no
    // account of what was missing (2.11 review). The list reports the player's own record and never
    // which conclusion it defends (ADR-006).
    // These lines are clamped into `CASE_FILE_READINESS_ROW_HEIGHT` at `CASE_FILE_RIGHT_COLUMN_WIDTH`,
    // so both locales are written to fit one line there; `french-typography.spec.ts` holds them to it.
    'caseFile.readiness.heading': 'What is still missing',
    'caseFile.readiness.complete': 'Your record carries everything the review asks for.',
    'caseFile.review.heading': 'Peer review',
    'caseFile.review.request': 'Ask for feedback',
    'caseFile.review.save': 'Save the revision',
    'caseFile.review.none': 'The reviewers raised nothing on this draft.',
    'caseFile.review.notRequested': 'No feedback has been asked for on this draft yet.',
    'caseFile.review.issue': '{feedback} — {revisionPath}',
    'caseFile.review.saved': 'Reviewed revision saved.',
    'caseFile.review.clearedBySupport': 'Your support changed, so the feedback on this draft was cleared.',
    // The consultation (Story 2.12, D4), in the band the peer-review pane holds during review. FR22's
    // three progressive-help layers plus the authored next step. The prose itself is `LocalizedText` in
    // `case.json` and is resolved by rule id — these are only the labels that introduce each layer.
    'caseFile.consultation.heading': 'Ask a colleague',
    'caseFile.consultation.request': 'Ask what is missing',
    'caseFile.consultation.notRequested': 'Nobody has been asked about this draft yet.',
    'caseFile.consultation.nextStep': 'Next step: {text}',
    'caseFile.consultation.observation': 'What they notice: {text}',
    'caseFile.consultation.plainLanguage': 'In plain terms: {text}',
    'caseFile.consultation.technicalDetail': 'In more detail: {text}',
    // The record itself (Story 2.12, Task 2). Fixed-height controls, so all three are in the
    // whole-string French sweep. `CaseProgressPanel` was the only caller of all three adapters.
    'caseFile.record.export': 'Export the case file',
    'caseFile.record.import': 'Open a saved file',
    'caseFile.record.print': 'Print the case file',
    'caseFile.record.exported': 'Case file exported as a portable record.',
    'caseFile.record.imported': 'Case file opened and saved on this device.',
    'caseFile.record.printed': 'Printable case file opened.',

    // --- Colleagues and proposals ---------------------------------------------------------------
    // Colleague *names* are canonical proper nouns authored in case.json; only the role is resolved
    // here, by its stable enum value, so nothing a record persists depends on the language.
    'colleague.role.lead': 'Lead',
    'colleague.role.builder': 'Instrument maker',
    'colleague.role.analyst': 'Analyst',
    'colleague.role.communicator': 'Communicator',
    'colleague.attribution': '{name} — {role}',
    'colleague.unattributed': 'Unattributed proposal',
    // The same degraded-content fallback, for a spoken line rather than a written proposal. A dialogue
    // speaker slot cannot borrow the label above it: "Unattributed proposal" over a line of prose
    // describes the wrong kind of thing (1.12 review).
    'colleague.unattributedSpeaker': 'Unattributed speaker',
    'colleagues.heading': 'What do you expect to see?',
    'colleagues.guide': 'Your colleagues each expect something different. Choose the one you want to test — you can change it at any time.',
    'theoryBoard.heading': 'Which conclusion will you put your name to?',
    // Names the submit control, because the two acts are separate and nothing else tells the player so:
    // without this the challenge the whole rival lab exists for may never be invited (2.5 review).
    'theoryBoard.guide': 'Each colleague has drafted a conclusion and the limitation they would state with it. Choose one — you can change it at any time — then submit it to put your name to it.',
    // Choosing is revisable and draws nothing; submitting is what puts the claim up for challenge.
    'theoryBoard.submit': 'Submit this conclusion',
    // A submission that draws no challenge changes nothing any surface reads, so without this the
    // control's success path is indistinguishable from a dead button (2.5 review).
    'theoryBoard.submitAcknowledged': 'Submitted. Your evidence supports this conclusion — carry on to review when you are ready.',
    'proposal.limitation': 'Stated limitation: {limitation}',
    'proposal.selected': '✓ Chosen',
    'proposal.choose': 'Choose this',

    // --- Character staging (Story 2.9) ------------------------------------------------------------
    // The marker under the foregrounded figure. It is what makes the speaker identifiable by a *label*
    // and not by scale and colour alone (AC2) — the dialogue panel's own speaker slot names them, but a
    // slot at the top of the panel cannot say which of the four figures below it is the one talking.
    //
    // It sits in a fixed-width figure column beside the cards, so it has to hold one line in French at
    // its authored size; `french-typography.spec.ts` measures it as a whole string for that reason. The
    // figure's *name and role* are not repeated here — they are the attribution line drawn on the same
    // row, immediately to its right. See `CharacterStage`'s docstring for the measurement.
    'stage.speaking': 'Speaking',

    // --- Rival lab --------------------------------------------------------------------------------
    // Interface chrome only. The critique *lines* are content and live in case.json as `LocalizedText`,
    // like every other prose a player reads. The rival's name is a canonical proper noun and is
    // authored there too; only his role is resolved here, the way a colleague's is.
    'rivalLab.role': 'Rival laboratory',
    'rivalLab.heading': 'A challenge from across the way',
    'rivalLab.guide': 'Nothing is lost, and nothing is scored. Go back and put a claim your evidence can carry — or gather what would answer the objection.',
    'rivalLab.revise': 'Return to your conclusion',

    // --- Dialogue ---------------------------------------------------------------------------------
    // Widget chrome only. The beats themselves are `LocalizedText` in case.json, like every other
    // string a player reads as content.
    'dialogue.advance': 'Continue',
    // Shown on the last beat instead of the control vanishing, so the reader can see the conversation
    // has finished rather than wondering where the control went. Further clicks are no-ops.
    'dialogue.end': 'End of conversation',
    'dialogue.counter': '{index} / {total}',

    // --- Peer review projection -----------------------------------------------------------------
    'review.unavailable': 'Peer feedback is temporarily unavailable. Your evidence and draft have been kept unchanged.',

    // --- Conclusion readiness (localized by requirement code, not by pre-formatted message) ------
    'conclusion.missing.duplicate-run-selection': 'Pin each observation only once.',
    'conclusion.missing.unknown-run-selection': 'Remove an unavailable observation.',
    'conclusion.missing.minimum-runs': 'Select at least {count} recorded observations.',
    'conclusion.missing.foreign-model-run': 'Pin observations taken on this apparatus.',
    'conclusion.missing.distinct-run-configurations': 'Pin observations from two different setups.',
    'conclusion.missing.saved-comparison': 'Save a deliberate comparison of the two.',
    'conclusion.missing.duplicate-source-selection': 'Pin each reference only once.',
    'conclusion.missing.unknown-source-selection': 'Remove a reference you have not inspected.',
    'conclusion.missing.minimum-sources': 'Inspect and select at least {count} sources.',
    'conclusion.missing.conclusion': 'Write a bounded conclusion first.',
    'conclusion.missing.limitation': 'Describe one limitation or alternative.',

    // --- Printable investigation record ---------------------------------------------------------
    'print.title': 'Investigation record',
    'print.ariaLabel': 'Printable investigation record',
    'print.settings.heading': 'Apparatus settings',
    'print.observations.heading': 'Recorded observations',
    'print.observations.item': 'Observation {index}: {label}: {value}. {timestamp}. Model {model}. {inputs}',
    'print.observations.inputs': 'Inputs: {wavelength} nm ({mode}), {screenDistance} screen distance, {slitSpacing} slit spacing.',
    'print.observations.settings': 'Apparatus settings: {settings}.',
    'print.observations.empty': 'No observations recorded.',
    'print.observation.label': 'Observation {index}',
    'print.observation.unavailable': 'Unavailable observation',
    'print.sources.heading': 'Inspected sources',
    'print.sources.item': '{name} — {category}; {reference}.',
    'print.sources.empty': 'No sources inspected.',
    'print.prediction.heading': 'Tentative prediction',
    'print.prediction.term': 'Recorded prediction',
    'print.prediction.empty': 'No prediction recorded.',
    'print.comparison.heading': 'Comparison notes',
    'print.comparison.item': '{runs}: {note}',
    'print.comparison.join': ' and ',
    'print.comparison.empty': 'No comparison notes saved.',
    'print.conclusion.heading': 'Conclusion and limitation',
    'print.conclusion.term': 'Conclusion',
    'print.conclusion.empty': 'No conclusion recorded.',
    'print.limitation.term': 'Stated limitation',
    'print.limitation.empty': 'No limitation recorded.',
    'print.history.heading': 'Decision history',
    'print.history.item': 'Version {version}, saved {timestamp}. Conclusion: {conclusion}. Limitation: {limitation}. Supporting observations: {runs}. Supporting sources: {sources}. Peer feedback: {feedback}',
    'print.history.noRuns': 'No observations',
    'print.history.noSources': 'No sources',
    'print.history.noIssues': 'Peer review found no issues.',
    'print.history.empty': 'No reviewed revisions saved.',
    // The neutral auto-summary's section chrome (FR23, Story 3.1). The heading is interface text and
    // lives here; the summary sentence itself is authored `case.json` content filled from the player's
    // own evidence, so it carries `LocalizedText` rather than a key.
    'print.summary.heading': 'What this investigation recorded',
    'print.completion.heading': 'Historical completion snapshot',
    'print.completion.text': 'Completed {timestamp}. Final conclusion: {conclusion}. The historical record remains unchanged during counterfactual replay.',

    // --- Result error codes ---------------------------------------------------------------------
    // `ResultError.message` stays the dev-facing default and the last-resort fallback; the
    // presentation localizes by the stable `code` so no persisted value depends on the language.
    'error.unknown-apparatus-control': 'That laboratory control is unavailable.',
    'error.invalid-control-value': 'Enter a finite control value.',
    'error.invalid-young-model-input': 'The selected apparatus inputs cannot produce a fringe spacing.',
    'error.invalid-experiment-model-input': 'The selected apparatus inputs cannot produce a measurement.',
    'error.unknown-experiment-model': 'This investigation names an apparatus model this build cannot run.',
    'error.experiment-phase-required': 'Enter the experiment stage before running the apparatus.',
    'error.run-case-mismatch': 'That observation belongs to a different investigation.',
    'error.mismatched-experiment-record': 'The observation does not match the current validated experiment setup.',
    'error.uninspected-linked-evidence': 'Linked evidence must be inspected before recording an observation.',
    'error.unavailable-wavelength': 'That authored wavelength comparison is unavailable.',
    'error.advanced-wavelength-locked': 'Record {count} fixed {baseline} nm observations before using the optional wavelength comparison.',
    'error.unknown-run-id': 'That observation is unavailable for comparison.',
    'error.duplicate-comparison-run': 'Choose two different observations to compare.',
    'error.too-many-comparison-runs': 'Choose only two observations to compare at once.',
    'error.comparison-run-not-selected': 'That observation is not selected for comparison.',
    'error.comparison-pair-required': 'Select two observations before saving a comparison note.',
    'error.invalid-comparison-note': 'Enter a comparison note before saving it.',
    'error.unknown-source-id': 'That source is unavailable in this investigation.',
    'error.source-not-eligible': 'That source cannot be inspected as verified evidence right now. Try another contextual source.',
    'error.duplicate-inspected-source': 'That source is already recorded as inspected.',
    'error.missing-contextual-sources': 'Inspect {label} before continuing.',
    'error.unknown-prediction-proposal': 'That prediction is not one of the proposals on offer.',
    'error.unknown-conclusion-proposal': 'That conclusion is not one of the proposals on offer.',
    'error.conclusion-phase-unavailable': 'Reach the theory board before choosing a conclusion.',
    'error.conclusion-submission-unavailable': 'Reach the theory board before submitting a conclusion.',
    'error.conclusion-choice-required': 'Choose a conclusion before submitting it.',
    'error.invalid-critique-timestamp': 'Provide a valid UTC submission timestamp.',
    // Reachable without any player error: the submission is stamped from the device clock, so a clock
    // that has moved backwards refuses until it catches up. The copy says what happened, not what to type.
    'error.critique-timestamp-not-later': 'This submission is stamped earlier than the last challenge. Check the device clock, then submit again.',
    'error.rival-lab-critique-unavailable': 'There is no standing challenge to answer.',
    'error.missing-prediction': 'Record a tentative prediction before continuing to experimentation.',
    // The significant-measure gate (Story 2.6). Deliberately plain and non-punitive: the colleague
    // hint rendered beside it is what says *what* to vary, in-fiction. This only says the bench is
    // not finished with you yet, and it never implies a mistake was made.
    'error.significant-measures-required': 'Two measurements that differ are needed before the conclusion opens.',
    'error.unknown-theory-run': 'That observation is unavailable as conclusion support.',
    'error.duplicate-theory-run': 'That observation is already supporting this conclusion.',
    'error.theory-run-not-selected': 'That observation is not selected as conclusion support.',
    'error.uninspected-theory-source': 'Inspect that reviewed source before using it as conclusion support.',
    'error.duplicate-theory-source': 'That source is already supporting this conclusion.',
    'error.theory-source-not-selected': 'That source is not selected as conclusion support.',
    'error.conclusion-not-ready': 'The bounded conclusion is not ready for review yet. The case file lists what is still missing.',
    'error.consultation-unavailable': 'No additional authored consultation applies to the current evidence.',
    'error.peer-review-unavailable': 'Move the bounded theory draft to review before requesting peer feedback.',
    'error.revision-review-required': 'Request available peer feedback before saving a revision.',
    'error.invalid-revision-timestamp': 'Provide a valid UTC revision timestamp.',
    'error.invalid-revision-runs': 'Revision support must reference unique recorded observations.',
    'error.invalid-revision-sources': 'Revision support must reference unique inspected sources.',
    'error.debrief-review-required': 'Save a reviewed revision before opening the historical debrief.',
    'error.debrief-completion-required': 'Open the historical debrief only through the reviewed completion action.',
    'error.reviewed-revision-required': 'Save the reviewed revision before opening the historical debrief.',
    'error.invalid-completion-timestamp': 'Provide a valid UTC completion timestamp.',
    // Split out of `invalid-completion-timestamp` (Story 2.11 AC6), the way
    // `critique-timestamp-not-later` already is: the malformed-stamp message above keeps describing
    // the malformed case, and the ordering failure gets device-clock copy the player can act on.
    'error.completion-timestamp-not-later': 'This completion is stamped earlier than the reviewed revision it closes. Check the device clock, then try again.',
    'error.replay-unavailable': 'Complete the historical debrief before starting a counterfactual replay.',
    'error.invalid-case-transition': 'That step is not available from the current stage of this investigation.',
    'error.invalid-run-controls': 'An observation needs finite snapshots of both apparatus controls.',
    'error.invalid-run-result': 'An observation needs a finite, labelled result.',
    // Emitted from `RunRecord.ts`, which validates *any* case's run — so it must not name Young. The
    // sibling `error.invalid-young-model-input` is genuinely Young's (it names a fringe spacing, and the
    // Young calculator is its only emitter) and stays as it is; both were swept by Task 6 of Story 3.2
    // and neither was decided, which the review of that story recorded (2026-08-19).
    'error.invalid-run-model-inputs': 'A recorded observation needs complete, valid model inputs.',
    'error.invalid-linked-evidence': 'Linked evidence identifiers must be unique and non-empty.',
    'error.invalid-run-record': 'An observation needs a complete evidence record.',
    'error.invalid-run-id': 'An observation needs a stable identifier.',
    'error.duplicate-run-id': 'That observation has already been recorded.',
    'error.invalid-case-id': 'An observation needs a case identifier.',
    'error.invalid-run-timestamp': 'An observation needs an ISO timestamp.',
    'error.invalid-experiment-model-version': 'An observation needs an experiment model version.',
    'error.progress-operation-active': 'Please wait for the progress operation to finish.',
    'error.persistence-unavailable': 'Progress could not be saved right now. Your current work is unchanged.',
    'error.invalid-import': 'This progress record could not be used. Your current work is unchanged.',
    'error.invalid-case-record': 'This progress record could not be used. Your current work is unchanged.',
    'error.incompatible-case-record': 'This progress record is for a different version of this investigation. Your current work is unchanged.',
    'error.export-unavailable': 'Progress could not be exported right now. Your current work is unchanged.',
    'error.print-unavailable': 'The printable record could not be opened right now. Your current work is unchanged.',
    'error.content-unavailable': 'Laboratory content is unavailable. Please try again when it is available.',
    'error.case-not-found': 'That investigation is unavailable. Please try again when it is available.',
    'error.invalid-case-definition': 'Laboratory content could not be read. Please try again when it is available.'
} as const;

export type TranslationKey = keyof typeof en;
