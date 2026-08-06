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
    'boot.status.savedProgressUnusable': 'Saved progress could not be used. A fresh investigation is ready.',
    'boot.status.savedProgressUnavailable': 'Saved progress is unavailable right now. The investigation is ready to continue.',

    // --- Validation session -----------------------------------------------------------------------
    // Facilitator-facing chrome on the moderated `?mode=validation` route. App-owned interface text,
    // not case content, so it lives here rather than in `case.json`.
    'validation.session.title': 'Young validation session',
    'validation.session.facilitatorHeld': 'Observations are held by the facilitator and de-identified outside this application.',
    'validation.session.noCollection': 'The application does not collect session responses.',

    // --- Laboratory surface ---------------------------------------------------------------------
    'lab.title': 'Young interference — visual laboratory surface',
    'lab.guide': 'Use the semantic laboratory controls or these matching visual step controls.',
    'lab.source': 'source',
    'lab.screen': 'screen',
    'lab.control.readout': '{label}: {value}',
    'lab.control.decrease': '−',
    'lab.control.increase': '+',
    'lab.result.emptyHint': 'No fringe spacing recorded yet. Enter the experiment stage and use Run experiment in the semantic controls.',
    'lab.result.recorded': 'Recorded pattern: {value} at {wavelength} nm ({mode} path).',
    'lab.result.stale': 'Last recorded result: {value}. The changed setup is an unrecorded preview.',
    'lab.preview': 'Visual preview: {slitSpacing} slit spacing and {screenDistance} screen distance. Run experiment for an exact recorded fringe spacing.',
    'lab.pattern.recorded': 'Recorded interference pattern: bright bands are {spacing} apart in the saved Young model result.',
    'lab.wavelengthMode.minimum': 'minimum',
    'lab.wavelengthMode.advanced': 'advanced',

    // --- Deterministic experiment result --------------------------------------------------------
    // The canonical `ExperimentResult.label` stays English in the record and is compared for string
    // equality on load; only its *display* is localized. See docs/i18n-authoring.md.
    'experiment.result.fringeSpacing': 'Fringe spacing',

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
    'recognition.source-discipline.label': 'Source discipline recorded',
    'recognition.source-discipline.description': 'Each reviewed contextual source has been inspected as evidence.',
    'recognition.replication.label': 'Replication recorded',
    'recognition.replication.description': 'Two observations use the same setup for comparison.',
    'recognition.variable-curiosity.label': 'Variable curiosity recorded',
    'recognition.variable-curiosity.description': 'Two observations use different authored control settings for comparison.',
    'recognition.calibrated-conclusion.label': 'Calibrated conclusion recorded',
    'recognition.calibrated-conclusion.description': 'A reviewed revision makes a bounded claim without an overreach finding.',

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
    'theoryBoard.guide': 'Each colleague has drafted a conclusion and the limitation they would state with it. Choose one — you can change it at any time.',
    // Choosing is revisable and draws nothing; submitting is what puts the claim up for challenge.
    'theoryBoard.submit': 'Submit this conclusion',
    'proposal.limitation': 'Stated limitation: {limitation}',
    'proposal.selected': '✓ Chosen',
    'proposal.choose': 'Choose this',

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
    'conclusion.missing.duplicate-run-selection': 'Choose each supporting observation only once.',
    'conclusion.missing.unknown-run-selection': 'Remove an unavailable supporting observation.',
    'conclusion.missing.minimum-runs': 'Select at least {count} recorded observations.',
    'conclusion.missing.non-physical-young-run': 'Use recorded physical Young observations as conclusion support.',
    'conclusion.missing.distinct-run-configurations': 'Select observations from two different recorded Young configurations.',
    'conclusion.missing.saved-comparison': 'Save an intentional comparison of the two selected observations.',
    'conclusion.missing.duplicate-source-selection': 'Choose each supporting source only once.',
    'conclusion.missing.unknown-source-selection': 'Remove a source that is not currently inspected evidence.',
    'conclusion.missing.minimum-sources': 'Inspect and select at least {count} sources.',
    'conclusion.missing.conclusion': 'Write a bounded conclusion before requesting review.',
    'conclusion.missing.limitation': 'Describe at least one limitation or alternative explanation.',

    // --- Printable investigation record ---------------------------------------------------------
    'print.title': 'Investigation record',
    'print.ariaLabel': 'Printable investigation record',
    'print.settings.heading': 'Apparatus settings',
    'print.observations.heading': 'Recorded observations',
    'print.observations.item': 'Observation {index}: {label}: {value}. {timestamp}. Model {model}. {inputs}',
    'print.observations.inputs': 'Inputs: {wavelength} nm ({mode}), {screenDistance} screen distance, {slitSpacing} slit spacing.',
    'print.observations.preModel': 'Pre-model observation; not treated as a physical Young measurement.',
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
    'print.completion.heading': 'Historical completion snapshot',
    'print.completion.text': 'Completed {timestamp}. Final conclusion: {conclusion}. The historical record remains unchanged during counterfactual replay.',

    // --- Result error codes ---------------------------------------------------------------------
    // `ResultError.message` stays the dev-facing default and the last-resort fallback; the
    // presentation localizes by the stable `code` so no persisted value depends on the language.
    'error.unknown-apparatus-control': 'That laboratory control is unavailable.',
    'error.invalid-control-value': 'Enter a finite control value.',
    'error.invalid-young-model-input': 'The selected apparatus inputs cannot produce a fringe spacing.',
    'error.experiment-phase-required': 'Enter the experiment stage before running the apparatus.',
    'error.run-case-mismatch': 'That observation belongs to a different investigation.',
    'error.mismatched-experiment-record': 'The observation does not match the current validated experiment setup.',
    'error.uninspected-linked-evidence': 'Linked evidence must be inspected before recording an observation.',
    'error.unavailable-wavelength': 'That authored wavelength comparison is unavailable.',
    'error.advanced-wavelength-locked': 'Record two fixed 550 nm observations before using the optional wavelength comparison.',
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
    'error.invalid-prediction': 'Enter a tentative prediction before recording it.',
    'error.unknown-prediction-proposal': 'That prediction is not one of the proposals on offer.',
    'error.unknown-conclusion-proposal': 'That conclusion is not one of the proposals on offer.',
    'error.conclusion-phase-unavailable': 'Reach the theory board before choosing a conclusion.',
    'error.conclusion-submission-unavailable': 'Reach the theory board before submitting a conclusion.',
    'error.conclusion-choice-required': 'Choose a conclusion before submitting it.',
    'error.invalid-critique-timestamp': 'Provide a valid UTC submission timestamp.',
    'error.rival-lab-critique-unavailable': 'There is no standing challenge to answer.',
    'error.missing-prediction': 'Record a tentative prediction before continuing to experimentation.',
    'error.unknown-theory-run': 'That observation is unavailable as conclusion support.',
    'error.duplicate-theory-run': 'That observation is already supporting this conclusion.',
    'error.theory-run-not-selected': 'That observation is not selected as conclusion support.',
    'error.uninspected-theory-source': 'Inspect that reviewed source before using it as conclusion support.',
    'error.duplicate-theory-source': 'That source is already supporting this conclusion.',
    'error.theory-source-not-selected': 'That source is not selected as conclusion support.',
    'error.conclusion-not-ready': 'The bounded conclusion is not ready for review yet. The theory board lists what is still missing.',
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
    'error.replay-unavailable': 'Complete the historical debrief before starting a counterfactual replay.',
    'error.invalid-case-transition': 'That step is not available from the current stage of this investigation.',
    'error.invalid-run-controls': 'An observation needs finite snapshots of both apparatus controls.',
    'error.invalid-run-result': 'An observation needs a finite, labelled result.',
    'error.invalid-run-model-inputs': 'A physical Young observation needs complete, valid model inputs.',
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
