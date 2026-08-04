---
project_name: 'Quantique'
user_name: 'Alexis'
date: '2026-08-04'
sections_completed: ['technology_stack', 'engine_specific_rules', 'performance_rules', 'organization_rules', 'testing_rules', 'platform_build_rules', 'critical_dont_miss_rules']
existing_patterns_found: 10
status: 'complete'
rule_count: 45
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing game code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Engine:** Phaser 4.2.1
- **Language:** TypeScript
- **Build tool:** Vite 8.1.x; commit the generator-produced lockfile to pin the exact patch.
- **Local persistence:** `idb` 8.0.3 over IndexedDB.
- **Schema validation:** Zod 4.4.3.
- **Unit tests:** Vitest 4.1.10.
- **Browser E2E tests:** Playwright 1.61.1.
- **Automated accessibility checks:** `@axe-core/playwright` 4.12.1.
- **AI documentation tooling:** `@upstash/context7-mcp`; Node.js 20.18.1+ required.

## Critical Implementation Rules

### Engine-Specific Rules

- Phaser is the visual laboratory renderer, not the authoritative application state or accessibility UI.
- Semantic HTML owns all essential controls, values, instructions, notebook work, theory board, source inspection, conclusion entry, focus behavior, and announcements.
- Every essential Phaser gesture needs an equivalent semantic HTML control that dispatches the same typed action.
- Phaser scenes only mirror case phase: `context → prediction → experiment → synthesis → review → debrief`. Scenes must not define or infer progression.
- Domain code must never import Phaser classes. Phaser objects are created, updated, and destroyed only by renderer factories under `src/adapters/phaser/`.
- Use Phaser scene lifecycle for assets/rendering; clean up scene subscriptions and display objects on shutdown.
- Do not use Arcade or Matter physics for scientific results. Experiments use deterministic, versioned domain calculations.

### Performance Rules

- Target 60 FPS at 1280×720 on a representative low-end school laptop; profile the Young lab before adding visual polish.
- Keep `update()` minimal. Prefer store subscriptions, Phaser events, and timers over per-frame domain work.
- Do not log, parse JSON, access IndexedDB, manipulate the DOM, or allocate transient collections in render/update hot paths.
- Load a minimal boot shell first; load the complete selected case bundle before laboratory play. Do not stream critical in-lab assets.
- Pool only after profiling proves allocation pressure. Renderer factories own any pooled Phaser objects.
- Prefer atlases and pre-rendered assets over regenerating `Graphics` geometry every frame.
- Scientific calculation must be pure and deterministic; it is not run each frame unless a visual preview explicitly needs it.

### Code Organization Rules

- Follow the domain-driven hybrid structure in `game-architecture.md`; do not add a generic `services/`, `managers/`, or `helpers/` catch-all.
- `src/domain/` is pure TypeScript: no Phaser, DOM, `fetch`, IndexedDB, or browser API imports.
- `src/adapters/` owns all side effects. It may depend on `core/` and `domain/`; dependency direction never reverses.
- `src/ui/` and `src/adapters/phaser/` use selectors and typed actions only. They never mutate each other or store state directly.
- Only repositories fetch and validate case JSON. Only persistence adapters access IndexedDB.
- Case definitions and shared assets are immutable under `public/cases/` and `public/assets/`; player progress belongs only in IndexedDB.
- Use `PascalCase` for classes/components and their files, `camelCase` for non-class modules/functions/properties, `UPPER_SNAKE_CASE` for constants, and `kebab-case` for case IDs/assets.
- Domain event names use `noun.verb`; JSON fields use `camelCase`.

### Testing Rules

- Unit-test all pure domain calculators, reducers, validators, migrations, readiness evaluators, and peer-review rules with Vitest.
- Use fixtures for case definitions and player records; never require Phaser or a browser to test scientific logic.
- Test the same apparatus action through both DOM and Phaser intent paths, then assert identical authoritative state.
- Use Playwright for the Young completion path, import/export, offline reload, and Chromium/Firefox/WebKit acceptance flows.
- Run axe checks in Playwright, but do not treat them as sufficient accessibility proof: manually verify keyboard-only flow, announcements, focus recovery, non-colour scientific encoding, and screen-reader usability.
- Test invalid case content/imports as expected `Result` failures; valid local progress must survive a failed import or save.
- Tests assert public actions, selectors, and semantic roles/labels—not Phaser private fields or incidental pixels.

### Platform & Build Rules

- Target current desktop Chrome, Firefox, Safari, and Edge first. Tablet support requires equivalent pointer, touch, and keyboard outcomes; phones remain reading-only until lab usability is proven.
- Release as a static hosted web application. No account, analytics, cloud save, remote configuration, or network request may block core play.
- Treat offline reload as a release gate: locally saved case progress must restore without a network connection after a prior successful load.
- Use the Vite production build and cache-versioned static assets. Do not introduce a backend for MVP gameplay.
- Semantic HTML controls must expose labels, value, units, keyboard adjustment, and state announcements. Colour or sound must never be the sole carrier of scientific information.
- Export/import remains versioned JSON; print uses the semantic CSS print view. Do not generate a separate, inaccessible canvas-only record.

### Critical Don’t-Miss Rules

- Do not build a freeform physics sandbox. Apparatus controls, valid values, confounds, and experiment outcomes are authored and bounded by case data.
- Do not make canvas interaction the only way to calibrate, measure, inspect sources, or conclude. HTML controls are first-class, not a fallback.
- Do not hard-code completion in a scene or dialogue branch. The evidence-to-conclusion evaluator is the sole completion authority.
- Do not recalculate saved historical runs against a newer experiment model. Preserve controls, calculated output, timestamp, and model version in every run record.
- Do not mutate shipped case definitions or mix them with player progress.
- Do not let consultations provide the final answer. They point to missing evidence, a source, an observable, or a test.
- Do not create hard-fail states, irreversible wrong choices, speed rewards, or rewards for overclaiming.
- Do not expose raw errors or log learner-entered conclusions by default.
- Do not add unreviewed historical assets or claims. Keep provenance and rights status in case content.
- Do not optimize with pooling, streaming, or new middleware before profiling identifies a real need.

---

## Usage Guidelines

**For AI Agents:** Read this file before implementing game code. Follow all rules; when guidance conflicts or is incomplete, choose the more restrictive option and update this file when a durable new pattern is agreed.

**For Humans:** Keep this focused on project-specific agent guidance. Update it when the stack or architectural rules change; remove rules that become obvious or obsolete.

**Last Updated:** 2026-08-04
