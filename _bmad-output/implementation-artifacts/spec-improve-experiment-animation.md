---
title: 'Spectacular-yet-realistic Young double-slit animation'
type: 'feature'
created: '2026-08-05'
status: 'done'
context: []
baseline_commit: 'f8f1a05881dc4030cc0a861372e1c44a58e1a485'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The visual laboratory surface renders the Young experiment as a few static arcs, a source dot, and a column of gold/grey dots. It reads as a diagram, not an experiment — there are no light rays, no sense of light propagating through the slits, and the "fringes" are discrete dots rather than a recognisable interference pattern.

**Approach:** Overhaul the Phaser apparatus visuals into a spectacular-but-physically-faithful scene: a wavelength-coloured source emitting an animated light beam, two Huygens wavefront sources at the slits emitting continuously travelling circular wavefronts that visibly interfere, and a real interference **fringe pattern** on the screen rendered from the physics (cos²·sinc² intensity) rather than dots. Colour tracks the selected wavelength (450/550/650 nm → blue/green/red). Motion is continuous and additive-glow lit for spectacle, but degrades to a rich static frame under `prefers-reduced-motion`.

## Boundaries & Constraints

**Always:** Preserve the `ApparatusRenderer` public lifecycle (`create`/`render(state)`/`destroy`/`setInputEnabled`) and the existing `+`/`−` controls, readouts, and result-readout text. Keep all physics values sourced from domain code — the renderer only visualises, it must not recompute or alter recorded results. Fringe band spacing must stay proportional to the recorded/preview `Δy = λL/d` geometry already computed. Wavelength colour and fringe intensity must come from pure, unit-tested functions. Honour `prefers-reduced-motion: reduce` with a static rich frame (no ongoing tweens/RAF motion). Clean up every per-frame hook, tween, timer, texture, and event listener in `destroy` (no leaks across scene restarts). Stay static/offline — no new assets, network, or dependencies.

**Ask First:** Adding a new npm dependency; changing the 1024×768 canvas size or `game/main.ts` config; touching the semantic DOM controls (`ApparatusControls.ts`) or any store/domain result logic.

**Never:** Alter fringe-spacing physics or recorded run values. Break the accessibility contract (Phaser stays visual-only; semantic controls remain the source of truth). Introduce shader files, WebGL-only features that break the `AUTO` canvas fallback, or continuous animation that ignores reduced-motion. Add telemetry, accounts, or remote config.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Wavelength → colour | 450 / 550 / 650 nm | RGB in the blue / green / red spectral region respectively; monotonic hue shift across the range | Clamp out-of-range nm to nearest visible bound |
| Fringe intensity profile | offset y, fringe spacing Δ>0, envelope w>0 | value in [0,1]; =1 at y=0; local maxima at integer multiples of Δ; central maximum brightest via sinc² envelope | Δ≤0 or w≤0 → return 0 (no divide-by-zero/NaN) |
| Preview vs recorded | active setup differs from last run | continuous preview pattern updates live with controls; recorded run locks exact spacing and plays a measurement pulse | N/A |
| Reduced motion | `prefers-reduced-motion: reduce` | full scene visible as a static frame; no travelling wavefronts, no RAF/tween loop running | N/A |

</frozen-after-approval>

## Code Map

- `src/adapters/phaser/renderers/ApparatusRenderer.ts` -- primary overhaul: source beam, travelling Huygens wavefronts, physics-driven fringe pattern, continuous + reduced-motion paths, lifecycle cleanup.
- `src/domain/apparatus/opticalVisualModel.ts` -- NEW pure helpers: `wavelengthToRgb(nm)` and `interferenceIntensity(offsetPx, spacingPx, envelopePx)`; no Phaser imports.
- `src/adapters/phaser/scenes/LaboratoryScene.ts` -- reference only; confirms create/render/destroy wiring (no change expected).
- `src/core/store/AppState.ts` / `selectors.ts` -- source of `selectedWavelengthNm`, `activeControlValues`, latest run inputs/result (read-only).
- `tests/unit/opticalVisualModel.test.ts` -- NEW unit tests for the I/O matrix.

## Tasks & Acceptance

**Execution:**
- [x] `src/domain/apparatus/opticalVisualModel.ts` -- add `wavelengthToRgb` (approximate visible-spectrum mapping) and `interferenceIntensity` (cos²(π·offset/spacing) × sinc² envelope, guarded against ≤0 inputs) as pure functions returning plain numbers.
- [x] `src/adapters/phaser/renderers/ApparatusRenderer.ts` -- replace `createRichPattern`/`fringeDots`/static arcs with: wavelength-coloured source + emitted beam rays through the slits; a pool of expanding circular wavefronts per slit animated on a per-frame update hook (`scene.events.on('update')`), additive-blend glow; a fringe pattern drawn as a smooth vertical stack of intensity-coloured bands on the screen via `interferenceIntensity` (recomputed only when geometry/wavelength changes, not every frame); wavelength-driven colours throughout; a stronger measurement pulse reusing `animateRecordedRun` timing. Under reduced motion, draw one static representative frame and register no update hook.
- [x] `src/adapters/phaser/renderers/ApparatusRenderer.ts` -- in `destroy`, remove the `update` listener, kill tweens/timers, destroy graphics/textures, and null references so scene restarts leak nothing.
- [x] `tests/unit/opticalVisualModel.test.ts` -- unit-test the I/O & Edge-Case Matrix rows for both pure functions.

**Acceptance Criteria:**
- Given the experiment surface is visible with default settings, when it renders, then a wavelength-coloured beam travels from the source through both slits and expanding wavefronts visibly overlap between the slits and the screen.
- Given the screen, when the pattern renders, then it shows a smooth central-bright, symmetrically fading fringe pattern (not discrete dots) whose band spacing tracks the current Δy geometry.
- Given the wavelength is changed among 450/550/650 nm, when it renders, then the beam, wavefronts, and fringes recolour to the matching spectral hue.
- Given `prefers-reduced-motion: reduce`, when the surface renders, then the full scene is visible as a static frame with no ongoing motion.
- Given the scene is destroyed and recreated, when it re-renders, then there are no duplicated update hooks, orphaned graphics, or console errors.
- Given the existing suite, when `npm run typecheck && npm test && npm run test:e2e` run, then all pass unchanged.

## Design Notes

Fringe geometry reuse: keep the current mapping (`screenX`, preview vs `recordedSpacingMm*4.6` clamped) as the band-spacing source so the pattern stays consistent with the recorded number; render intensity by sampling `interferenceIntensity(y - centreY, bandSpacingPx, envelopePx)` per ~2px row over the screen height and setting per-row fill alpha/colour.

`wavelengthToRgb`: a standard piecewise visible-spectrum approximation (e.g. Bruton's) is sufficient and testable; return `{ r, g, b }` 0–255. The renderer converts to a Phaser `0xRRGGBB` int.

Performance: only the wavefront ring pool animates per frame (small fixed count, pooled — no per-frame allocation); the fringe band graphic is redrawn solely on geometry/wavelength change flagged from `render(state)`. Additive glow via `setBlendMode(Phaser.BlendModes.ADD)` on soft-circle wavefronts.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no type errors.
- `npm test` -- expected: all unit/integration tests pass, including new `opticalVisualModel.test.ts`.
- `npm run test:e2e` -- expected: Young experiment + accessibility e2e pass (semantic controls unaffected).

**Manual checks:**
- `npm run dev`, enter the experiment: confirm travelling rays/wavefronts, a smooth fringe pattern, live colour change across 450/550/650 nm, and — with OS reduced-motion enabled — a static rich frame with no motion.

## Suggested Review Order

**Optical model (pure, testable core)**

- Entry point: the physics that drives every visual — colour + interference intensity, no framework.
  [`opticalVisualModel.ts:85`](../../src/domain/apparatus/opticalVisualModel.ts#L85)
- Visible-spectrum colour mapping with clamping so lab wavelengths never render black.
  [`opticalVisualModel.ts:32`](../../src/domain/apparatus/opticalVisualModel.ts#L32)

**Renderer — light propagation & fringes**

- The per-frame painter: converging beam rays + expanding Huygens wavefronts (additive glow).
  [`ApparatusRenderer.ts:241`](../../src/adapters/phaser/renderers/ApparatusRenderer.ts#L241)
- Fringe pattern as intensity-shaded rows, memoised by signature so it never repaints per frame.
  [`ApparatusRenderer.ts:213`](../../src/adapters/phaser/renderers/ApparatusRenderer.ts#L213)
- Geometry + wavelength refresh feeding both painters from store state (physics untouched).
  [`ApparatusRenderer.ts:184`](../../src/adapters/phaser/renderers/ApparatusRenderer.ts#L184)
- Measurement flash; kills its own `this` tween first to prevent concurrent-boost flicker.
  [`ApparatusRenderer.ts:162`](../../src/adapters/phaser/renderers/ApparatusRenderer.ts#L162)

**Lifecycle & accessibility (highest-risk)**

- Single source of truth for the loop: runs only when motion is allowed AND apparatus is visible.
  [`ApparatusRenderer.ts:62`](../../src/adapters/phaser/renderers/ApparatusRenderer.ts#L62)
- Runtime reduced-motion toggle handled live via a media-query change listener.
  [`ApparatusRenderer.ts:55`](../../src/adapters/phaser/renderers/ApparatusRenderer.ts#L55)
- Teardown kills every tween (incl. `this`) and removes both listeners — no leaks on scene restart.
  [`ApparatusRenderer.ts:113`](../../src/adapters/phaser/renderers/ApparatusRenderer.ts#L113)

**Tests**

- Covers the I/O & Edge-Case Matrix for both pure functions, incl. monotonic hue and ≤0 guards.
  [`opticalVisualModel.test.ts:1`](../../tests/unit/opticalVisualModel.test.ts#L1)
