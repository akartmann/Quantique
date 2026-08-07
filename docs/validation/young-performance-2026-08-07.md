# Young low-end laptop performance check — 2026-08-07 (Story 2.10)

Filled from `young-performance-template.md` for the NFR1 re-profile AC10 requires after Story 2.10 put
drag input, the player-started light's propagation, the notebook overlay and the wavelength chooser on the
bench together.

**AC10's wording was corrected at the 2026-08-07 review.** It asked for the profile "with drag, staging,
and propagation all active", and character staging cannot happen at the bench — Story 2.9's Dev Notes and
Story 2.10's scope boundary both forbid it. The clause named a configuration the laboratory cannot enter,
so it now names what the bench actually runs. The gate is otherwise unchanged: 10 minutes, 1280×720,
representative low-end hardware, manually observed, no automated figure substituted.

| Item | Value |
| --- | --- |
| QA / release lead | **Alexis Kartmann** (assigned at code review 2026-08-07) |
| Device and browser | _Not yet run on a representative low-end school laptop_ |
| Screen size | 1280×720 |
| Laboratory loop duration | 10 minutes |
| 60-FPS target result | **Blocked — the manual gate has not been run** |
| Observation method and evidence reference | Manual observation, per the template. Not yet performed. |
| Remediation owner if blocked | **Alexis Kartmann** (assigned at code review 2026-08-07) |
| Follow-up date if blocked | **Before Story 2.12 is marked done.** Not "before Story 2.4's gate is re-run" — that was circular, because 2.4's gate is itself blocked on 2.12, so the follow-up could never come due |

## Status: not run, and deliberately not faked

The template says, in as many words: *"Do not substitute an automated test or rendered FPS estimate
for this manual gate. A blocked result blocks release."*

This story was implemented on a developer workstation. There was no representative low-end school
laptop to run a ten-minute loop on, so the gate is recorded as **Blocked** rather than filled in with
a number from the wrong machine. It needs a named person, the right hardware, and ten minutes.

Story 2.4's release gate is already Blocked until 2.12 ships, so this does not add a new blocker — it
adds a check that must be satisfied before that gate can be re-run.

**The owner and the trigger were both `Unassigned` until the 2026-08-07 code review, and the trigger was
circular**: "before the Story 2.4 release gate is re-run", where that gate is blocked on Story 2.12, so
nothing would ever have made this due. It is now owned by Alexis Kartmann and due **before Story 2.12 is
marked done** — 2.12 is the story that retires the DOM panels and is the last of Epic 2, so it is the last
point at which a performance regression on the bench can be found cheaply. Reassign the owner if someone
else takes the hardware; do not clear the trigger.

## What changed under the gate, and in which direction

The 2026-08-06 sprint change counted gating the light on a run as an NFR1 **reduction**, and that is
what shipped:

- **The idle apparatus no longer animates at all.** `syncAnimationLoop()` used to register a
  `scene.events.on('update')` handler from `create()` and run whenever motion was allowed. It now
  registers only while a run is in flight and unregisters when the run resolves (ADR-012). A player
  reading the guide, turning a knob, or sitting at the bench between observations costs nothing.
- **The light's total budget is bounded and known**: `RUN_ANIMATION_MS` = 2 400 ms per observation,
  and nothing runs between observations. A ten-minute loop with, say, twelve observations spends
  ~29 s animating out of 600 s.
- **The painted fringe preview is gone**, so `paintFringes` no longer regenerates its `Graphics` on
  every control change for a setup that was never run.
- **Added cost:** the drag. It is a `pointermove` handler doing one `atan2`, one snap and — only on a
  change of detent — one dispatch. It allocates nothing per frame and runs only while a knob is held.
- **Added cost:** the instruments themselves are `Graphics` fill/stroke commands issued **once** in
  `create()`; only the indicator's `setRotation` changes per render, and renders are store-driven, not
  per frame.
- **Character staging is not on this bench.** Story 2.9's Dev Notes rule it out and Story 2.10 did not
  add it, so the "drag, staging and propagation together" case AC10 names cannot arise in the
  laboratory as shipped. The manual gate should still exercise staging on the two boards.

## Indicative measurement — informative, NOT the gate

Recorded so the manual check has a baseline to compare against, and labelled here so nobody mistakes
it for the gate the template forbids substituting:

| Condition | Frames per second |
| --- | --- |
| Bench idle (no run) | 120.3 |
| During a run (propagation active) | 120.5 |

Chromium at 1280×720 on the development workstation, whose display refreshes at 120 Hz — so both
figures are capped by the display, not by the game, and the only thing they establish is that neither
state is dropping frames on this hardware. **They say nothing about a low-end school laptop**, which
is the machine NFR1 is written about, and they are not a substitute for ten minutes of a human
watching one.

## What the manual check should exercise

1. Reach the laboratory and leave the bench **idle** for a minute. Nothing should move; confirm it.
2. Turn each knob through its full travel by dragging, repeatedly.
3. Start the light and watch a run resolve. Repeat across at least six observations at different
   settings, so the fringe pattern is repainted each time.
4. Open and close the notebook overlay, select a pair, and type a comparison note.
5. Open and page the reference book from the bench.
6. Leave for the theory board and return via a replay, so the two boards' staged cast is exercised in
   the same session.
7. Re-run steps 1–3 under `prefers-reduced-motion: reduce`, where no update loop should register at
   all.
