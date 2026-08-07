# Young low-end laptop performance check — Story 2.12 (the DOM-panel retirement)

Filled from `young-performance-template.md` for the NFR1 re-profile **AC9 of Story 2.12** requires
before that story is marked done. It supersedes nothing: `young-performance-2026-08-07.md` records the
same gate for Story 2.10 and is still Blocked, and this file is the Story 2.12 instance of it with the
delta this story introduces.

| Item | Value |
| --- | --- |
| QA / release lead | **Alexis Kartmann** (assigned at the 2.10 code review, 2026-08-07; unchanged) |
| Device and browser | _Not yet run on a representative low-end school laptop_ |
| Screen size | 1280×720 |
| Laboratory loop duration | 10 minutes |
| 60-FPS target result | **Blocked — the manual gate has not been run** |
| Observation method and evidence reference | Manual observation, per the template. Not yet performed. |
| Remediation owner if blocked | **Alexis Kartmann** |
| Follow-up date if blocked | **Before Story 2.12 is marked `done`.** The trigger is unchanged and is deliberately non-circular |

## Status: not run, and deliberately not faked

The template says, in as many words: *"Do not substitute an automated test or rendered FPS estimate for
this manual gate. A blocked result blocks release."*

Story 2.12 was implemented on the same developer workstation as Story 2.10 — a 120 Hz display and far
more headroom than the machine NFR1 is written about. There is no representative low-end school laptop
here, so the gate stays **Blocked** rather than being filled in with a number from the wrong hardware.
It needs the named owner, the right machine, and ten minutes.

**This is the one clause of Story 2.12's AC9 the implementation could not satisfy.** Everything else in
that criterion — `npm run typecheck`, `npm test`, `npm run test:e2e`, the offline reload, and the
cross-browser sweep — is run and recorded in the story file.

## What changed under the gate, and in which direction

Story 2.12 **removes** work from every render path and adds none to a hot one.

- **Eleven DOM presentation panels are deleted, with their store subscriptions.** Each one held a
  `store.subscribe` that rebuilt its subtree on **every** dispatch — `CaseProgressPanel` alone
  re-created a `<section>` with five controls per state change, and `NotebookPanel`, `TheoryBoard`,
  `CuratedRecord` and `DecisionHistoryPanel` each rebuilt lists. A knob turn used to repaint the canvas
  *and* eleven DOM trees. It now repaints the canvas and one: the retained printable record.
- **~200 lines of CSS are deleted with them**, including four `@keyframes` animations and the
  `.young-phase-visual.is-running` compositing that ran alongside every recorded run.
- **The autosave is unchanged in shape and in cost.** It moved from `CaseProgressPanel`'s subscription
  into `attachAutosave`, with the same selector, the same repository and the same `pendingWrite`
  serialization. One IndexedDB write per dispatch, exactly as before — and, as before, off the render
  path.
- **Added cost: one bench control.** The reset is a `Rectangle` and a `Text` created once in `create()`
  and re-labelled in `render(state)`, which is store-driven rather than per-frame. It registers no
  update loop and starts no tween.
- **Added cost: one case-file pane and one action row.** Both are built once when the overlay is
  constructed and painted only while it is open — and the overlay deliberately has no animation at all,
  so it costs nothing under `prefers-reduced-motion` and nothing while closed.
- **Removed cost: the sub-768px media query.** `ApparatusRenderer` read `matchMedia` on every keydown
  and every start or wavelength press, in a file §Performance holds to no DOM work in a render path.
  That read is gone with the suppression itself (D7), and the `resize` listener that existed only to
  re-evaluate it is gone too.
- **Removed cost: the two-column layout, and with it a permanent compositing layer.** The panels'
  column outlived them. Until the layout follow-up the browser laid out and painted a 34rem grid
  column beside a `position: sticky` canvas on every frame the page scrolled, and the printable record
  — the one DOM subtree still subscribed to the store — was **on screen**, so every dispatch triggered
  a real layout and paint of it. It is now clipped to a pixel: the subtree is still rebuilt, but it
  composites nothing. The canvas is `position: fixed` at the full viewport, so there is no document
  scroll and no sticky recalculation left at all.
- **Added cost: two DOM elements that are almost always absent.** The boot frame is `hidden` after
  entry, and `#boot-status` is `:empty`-hidden until something fails; the entry notice paints a single
  bar for `BOOT_NOTICE_MS` and then removes itself. Neither is in the render path afterwards.
- **Neutral: the input gate.** `game.input.enabled` is set twice per session — once at construction and
  once on entry. The game is still constructed on load, so nothing about scale, scene boot, or the
  offline path changed shape.

The layout follow-up therefore moves the expectation further in the same direction: **strictly less DOM
work per dispatch than at first completion, which was already less than at 2.10.**

The net expectation is that the bench is **cheaper** than it was at 2.10, and that nothing this story
adds runs per frame. That is an expectation, not a measurement, and it is exactly what the ten minutes
are for.

## Indicative measurement — informative, NOT the gate

None recorded. The 2.10 file's figures were capped by a 120 Hz display and established only that
neither state dropped frames on that hardware; repeating them here would add nothing and would risk
being read as the gate. See `young-performance-2026-08-07.md` for the reasoning.

## What the manual check should exercise

The Story 2.10 list still applies in full. Story 2.12 adds three steps to it:

8. **Press the bench's reset control** repeatedly, including when the setup is already the authored one
   — the surface guards that case and dispatches nothing, and this is where a per-press cost would show.
9. **Open the case file and ask for a consultation**, then close and re-open it several times. The
   overlay is built once and shown, not constructed on open, so repeated opens should cost nothing new.
10. **Export and print the case file from the overlay**, and open the file chooser from it. Each creates
    and disposes one transient element; a leak would accumulate across a ten-minute session.
11. **Resize the window during play**, including across the 720px width. The canvas is now `position:
    fixed` at the full viewport and Phaser owns its own centring, so a resize is a `Scale.FIT`
    recalculation and nothing else — no grid reflow, no sticky recomputation. Watch for the canvas
    drifting off centre, which is the shape the double-centring defect took.
