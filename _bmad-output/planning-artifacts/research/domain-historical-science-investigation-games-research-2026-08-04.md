---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - '../briefs/brief-Quantique-2026-08-04/brief.md'
  - '../../brainstorming-session-2026-08-04.md'
workflowType: 'research'
lastStep: 6
research_type: 'domain'
research_topic: 'Historical science-investigation games and the open-source, browser-based educational-game sector'
research_goals: 'Select the most viable MVP and platform/distribution strategy for Fracture of Certainty; identify comparable games, classroom and accessibility expectations, open-source licensing/distribution implications, and historical-source requirements.'
user_name: 'Alexis'
date: '2026-08-04'
web_research_enabled: true
source_verification: true
---

# Research Report: Historical Science-Investigation Games

**Date:** 2026-08-04
**Author:** Alexis
**Research Type:** Game domain

---

## Research Overview

This research supports the desktop-web MVP of *Fracture of Certainty: Cases from the Quantum Age* before detailed GDD work. It examines the practical intersection of historical inquiry, rigorous light-interference simulation, open educational distribution, accessibility, and archival provenance for a global 16–25 learner audience.

The central conclusion is deliberately narrow: build one short, no-login historical laboratory case rather than a general physics sandbox. It should let learners make an observation, explain it from evidence, and inspect the sources and assumptions behind it. The full executive synthesis and decision framework appear in **Research Synthesis and Strategic Recommendations** below.

---

<!-- Content will be appended sequentially through research workflow steps -->

## Game Domain Research Scope Confirmation

**Research Topic:** Historical science-investigation games and the open-source, browser-based educational-game sector

**Research Goals:** Select the smallest viable light-interference case and its success criteria; define desktop-web distribution with tablet/mobile constraints; identify comparable games and differentiation; establish open-source licensing, contributor, attribution, and archival-rights needs; understand expectations of learners, educators, and physics-curious players; and recommend suitable technology and accessibility patterns.

**Game Domain Research Scope:**

- Genre & Platform Analysis — historical investigation, science-learning, and browser-game conventions; desktop-web first, with tablet/mobile constraints.
- Regulatory Environment — age ratings, regional compliance, archival permissions, and attribution requirements.
- Technology Trends — web-engine, interaction, rendering, and accessibility practices appropriate for an interactive laboratory.
- Economic Factors — practical solo-developer models, discoverability, sustainable open-source maintenance, and educator adoption rather than broad market-size forecasting.
- Ecosystem & Distribution — web storefronts and hosting, open-source communities, educator channels, archives, and contributor relationships.

**Research Methodology:**

- Current public sources will verify claims.
- Critical claims will be cross-checked where primary or authoritative sources are available.
- Findings will distinguish evidence from design inference and flag confidence where evidence is limited.
- Recommendations will remain MVP-oriented for the global 16–25 learner audience, with educators and adult learners as secondary audiences.

**Scope Confirmed:** 2026-08-04

## Game Industry Analysis

### Market Size and Revenue

The global games market is useful context but a poor proxy for the opportunity here: it rewards scale, established IP, and live-service monetisation, whereas this project needs a small, trusted educational audience. Newzoo estimates 2025 consumer revenue at **$201.6B**: mobile $113.3B, console $44.7B, and PC $43.6B. Its forecasts indicate PC/console growth, but these are commercial-analyst estimates rather than public statistics. _Confidence: medium._ [Source: Newzoo, 18 June 2026](https://newzoo.com/resources/blog/global-games-market-q2-2026)

**MVP implication:** desktop web is a deliberate focus within the PC ecosystem—not an attempt to compete with mass-market mobile. Do not import the sector’s dominant microtransaction model into a laboratory game. Preserve the scientifically complete core as free/no-ad play; test grants, partners, and voluntary support before paid case packs.

### Market Dynamics and Growth

The 2025 GDC survey found that 80% of surveyed developers were building for PC and 16% for web browsers (up from 9% in 2024). It also found 21% working solo and 82% of indie respondents self-funding. The survey covers 1,500 developers in 86 countries but is US-weighted, so it is directional rather than a global census. _Confidence: medium-high for the surveyed population._ [Source: GDC State of the Game Industry 2025, pp. 7, 19–20, 30](https://investgame.net/wp-content/uploads/2025/03/0794a269-d5c4-4994-9bcf-8c5730d0815e_2025_GDC_State_of_the_Game_Industry_report-1.pdf)

For a solo project, the material barriers are discoverability and sustainable funding rather than a platform publishing fee. GDC respondents reported word of mouth, social channels, and communities far more often than storefront promotion as discovery routes. This favours a short, shareable case demo, an educator landing page, and relationships with teachers, physics communicators, museums, and open-education communities. [Source: GDC 2025, p. 28](https://investgame.net/wp-content/uploads/2025/03/0794a269-d5c4-4994-9bcf-8c5730d0815e_2025_GDC_State_of_the_Game_Industry_report-1.pdf)

### Market Structure and Segmentation

**Primary segment:** students and independent learners using a desktop browser, reached by a direct URL. This avoids download and account friction, gives educators a stable lesson link, and permits rapid correction of scientific or archival content.

**Secondary segment:** educators, whose need is not a large game catalogue but a clear learning objective, a short time commitment, a facilitator handout, and low-risk deployment. UNESCO describes game-based courses as most effective when games are supported by learning objectives, reflection, assessment, and collaboration. [Source: UNESCO MGIEP, Games for Learning](https://mgiep.unesco.org/games-for-learning)

**Future segments:** tablet learners benefit from responsive layout and touch input; native mobile should wait for evidence that the interaction model survives a small screen without compromising evidence reading or experiment control. A progressive web app can retain URL discoverability and browser play while becoming installable and offline-capable where the browser supports it. [Source: MDN PWA guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

### Game Industry Trends and Evolution

The relevant technology trend is progressive enhancement, not a large engine or native-client race. A normal web build remains playable by URL; a manifest, HTTPS, and caching/service worker can subsequently provide installation and offline use. Browser support varies—desktop Firefox does not offer manifest-based PWA installation—so installability must never be a dependency for the case. [Source: MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

For a light-interference case, use Canvas or SVG for the visual field and semantic HTML for controls, text, and explanations. Build click/tap, keyboard, and touch alternatives from the start. WCAG 2.2 requires keyboard-operable functionality and adds criteria for dragging alternatives and minimum target sizes; this is especially consequential when a learning mechanic is visual or gesture-based. [Source: W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

### Competitive Dynamics

Direct hosting is the MVP channel. Curated browser portals can later support public discovery, but their economics and constraints are different: CrazyGames requires an HTML5 build, SDK integration, and quality/performance review; Poki publishes web-game guidance targeting a 5 MB initial download and 8 MB total. Those targets argue for lazy-loaded archival assets even if the direct build is richer. Portal audience figures are platform self-reports, so no commercial forecast should rely on them. [Sources: CrazyGames developer FAQ](https://docs.crazygames.com/faq/), [Poki engine guide](https://developers.poki.com/guide/web-game-engines)

For lightweight support rather than access gating, itch.io permits free, paid, and pay-what-you-want releases and lets sellers choose the platform revenue share. Steam is a later, premium-facing channel: every app requires a US$100 Steam Direct fee and visibility depends on customer response rather than mere publication. [Sources: itch.io pricing](https://itch.io/docs/creators/pricing), [Steam Direct](https://partner.steamgames.com/doc/gettingstarted/appfee), [Steam visibility](https://partner.steamgames.com/doc/marketing/visibility?language=english)

**Industry decision:** launch a free, direct-hosted, no-login desktop case with an educator guide and an optional itch.io support page. Treat PWA/offline support, tablet layout, and export/import progress as early constraints; defer native mobile, cloud accounts, LMS grade passback, portals, and Steam until playtests establish a compelling loop and educator demand. This preserves low friction, privacy, and scientific credibility while keeping a viable path to wider distribution.

## Competitive Landscape

### Key Studios and Market Leaders

There is no coherent market-share dataset for the intersection of historical-science inquiry, open-source browser games, and physics education. The useful landscape is therefore a set of adjacent product patterns rather than revenue competitors:

- **PhET Interactive Simulations** is the incumbent interaction benchmark for physics learning. Its *Wave Interference* simulation offers manipulable water, sound, and light waves, including two-source interference and graphs; PhET reports 167 simulations, 121 translations, and 3,433 teacher lessons across its catalogue. Its strength is immediate conceptual exploration, not narrative, historical interpretation, or a case structure. [Sources: PhET](https://phet.colorado.edu/?locales=en), [Wave Interference](https://phet.colorado.edu/sims/html/wave-interference/latest/)
- **Quantum Game / Quantum Flytrap** is the closest physics-game comparison: a free browser puzzle game that frames photons, superposition, entanglement, and measurement as play, with an older version available as source code. Its strength is true physics expressed through puzzles; its scope is quantum optics rather than historical investigation, archival evidence, or classroom facilitation. [Source: Quantum Game](https://quantumgame.io/)
- **iCivics + Filament Games’ *Investigation Declaration*** is the clearest historical-inquiry pattern. It casts adolescents as investigators examining primary-source evidence, connecting ideas across time and place, and reconstructing conclusions. It demonstrates that evidence handling, a mission frame, and explicit learning outcomes can coexist in a web/mobile game. [Source: Filament Games](https://www.filamentgames.com/project/investigation-declaration)
- **Open-source physics projects** such as VisuPhy and PhysicsHub show an active browser-simulation ecosystem, but their value proposition is breadth of free simulations rather than authored cases with a narrative arc. [Sources: VisuPhy](https://www.visuphy.org/about-visuphy.html), [PhysicsHub](https://physicshub.github.io/about)

Additional reference patterns strengthen the same boundary. Concord Consortium’s high-school *Interference with Light* material represents the conventional simulation-plus-teacher-guide approach; *Odyssey: The Story of Science* validates history-of-science puzzles but is a broad commercial desktop adventure; and the Smithsonian/MIT’s legacy *VANISHED* shows the appeal of science mystery while also showing why accounts, social moderation, and multi-week scope do not belong in this MVP. [Sources: Concord ITSI](https://guides.itsi.concord.org/waves.html), [Odyssey](https://store.steampowered.com/app/558110/Odyssey__The_Story_of_Science/), [VANISHED](https://www.smithsonianeducation.org/vanished/)

### Market Share and Competitive Positioning

Comparable titles do not publish directly comparable learner, revenue, or retention figures. Do not invent a market-share claim. The practical positioning map is instead:

| Pattern | Player promise | Gap for *Fracture of Certainty* |
|---|---|---|
| Physics simulation (PhET) | Change variables and see the phenomenon | Why a real experiment mattered; how evidence becomes a scientific claim |
| Quantum puzzle (Quantum Game) | Solve apparatus puzzles with real rules | A historically grounded, document-led case for non-specialists |
| Historical inquiry game (iCivics) | Analyze sources to solve a mission | Hands-on scientific apparatus and quantitative evidence |
| Open simulation library | Browse and reuse many free tools | A coherent, reusable authored case framework and educator-ready explanations |

**Differentiation thesis:** make the player a historically situated investigator who must align a tactile virtual apparatus, an observed interference pattern, measurement notes, and archival claims. The learning outcome is not merely “interference exists,” but “why this evidence compelled a model-level conclusion.” This should be tested as a hypothesis, not assumed to be a unique category.

**Minimum compelling loop:** receive a disputed observation; inspect two contextual archival clues; set slit configuration plus one or two physical variables; record two measurements; compare predicted and observed fringes; issue a defensible conclusion; then reveal deeper explanation and provenance. This deliberately merges the science interaction of PhET with the evidence mission of historical inquiry games while remaining a 20–40 minute self-contained case.

### Monetization Strategies and Differentiation

The closest comparisons primarily use free access: PhET distributes free educational simulations; Quantum Game is free and presents open source as part of its identity; iCivics-style products are generally mission- and partner-supported. Their public pages do not support reliable title-level revenue comparisons. [Sources: Quantum Game](https://old.quantumgame.io/), [Filament/iCivics collection](https://www.filamentgames.com/client-collection/icivics)

For this project, differentiation must come from trustworthy synthesis rather than content volume or F2P retention: a playable historical experiment, a source ledger that distinguishes quotation from interpretation, three depth layers (play, explanation, primary material), and an educator-ready debrief. Avoid ads, consumables, streaks, and paywalls in the first case; each conflicts with an archival laboratory’s credibility and classroom use.

### Business Models and Value Propositions

The viable initial model is an openly playable public-good core, complemented by support that does not fragment the learning case: grant/partner sponsorship, donations or pay-what-you-want, and possibly paid implementation support or optional educator materials. *Antura* offers a useful open-education precedent: it frames open source as enabling communities to adapt an educational game rather than as a substitute for stewardship. [Source: Antura Game Project](https://antura.org/en/about/open-source)

**Value proposition:** “A short, rigorous historical laboratory where learners make and defend an observation before being told its modern explanation.” For students, that is agency and intelligibility; for educators, a bounded, source-citable activity; for adult learners, an archival story they can interrogate rather than a worksheet disguised as a game.

### Competitive Dynamics and Entry Barriers

The main competitive risk is not another small title copying a double-slit apparatus. It is comparison with polished, free simulations and classroom products that have substantial research, translation, design, and distribution capacity. The defensible elements are: vetted archival interpretation, an honest uncertainty model, a reusable case schema, accessibility treated as core interaction design, and teacher trust.

Entry barriers to address deliberately:

- **Scientific and historical validity:** recruit domain review early; record claim-to-source links and version them.
- **Classroom trust:** publish objectives, run time, prerequisite knowledge, and a no-login privacy posture alongside the play link.
- **Accessibility:** build semantic controls and equivalent non-visual/keyboard interactions rather than trying to retrofit a canvas-only lab.
- **Discoverability:** earn distribution through teacher and science-history communities; neither a repository nor a storefront substitutes for a classroom-ready guide.

### Ecosystem and Distribution Analysis

The ecosystem rewards modularity. A public URL is the canonical experience; the source repository should separate engine code, case data, citations/rights metadata, and translations so future contributors can add cases without rewriting the game. The direct build should remain standards-based and light enough to run on school hardware. A later browser portal build is optional, because portals impose SDK and performance constraints that can conflict with archival-rich teaching material.

**Competitive decision:** do not compete with PhET on simulation breadth or with iCivics on a large game catalogue. Deliver one exceptionally well-scoped interference case that combines their missing halves—experimental manipulation plus historical-source reasoning—then prove its reusable case framework through a second case only after the first meets learning, accessibility, and educator-use success criteria.

**Build-versus-fork decision:** build the small optics interaction from original code. PhET’s own source guidance estimates a moderately complex simulation at roughly 160 design hours, 500+ development hours, and 40 testing hours; it warns that its codebase has a 6–12 month onboarding curve and that forks can become stale. Most PhET simulation repositories are GPL, with specific attribution and copyleft conditions for modified simulations. Borrow design principles, not code or assets, unless those obligations are intentional. [Sources: PhET source-code guidance](https://phet.colorado.edu/en/about/source-code), [PhET software agreement](https://phet.colorado.edu/about/software-agreement_v7.htm)

**Accessibility benchmark:** PhET’s current programme tests alternate input, touch, keyboard, screen readers, descriptions, and scientific-control interaction patterns. Treat this as the quality bar: each apparatus operation needs a keyboard stepper/slider alternative, labelled state, sufficiently large touch target, and non-colour-only depiction of the fringe pattern. [Source: PhET accessibility statement](https://phet.colorado.edu/en/inclusive-design/accessibility-statement)

## Regulatory Requirements

_This is implementation research, not legal advice. Obtain jurisdiction-specific advice before commercial release, collecting identifiable learner data, or using archival assets whose reuse terms are unclear._

### Age Rating Systems

For a free browser case with no violence, sexual content, gambling mechanics, online communication, or purchases, age-rating risk is low. The intended audience is 16–25, but the content should be suitable for wider classroom access if historical material is contextualised and no disturbing imagery is required. PEGI uses 3, 7, 12, 16, and 18 categories; ESRB uses categories and content descriptors, and digitally delivered games may be rated through the IARC process. [Sources: French Ministry of the Interior on PEGI](https://www.interieur.gouv.fr/actualites/actualites-du-ministere/jeux-video-choisissez-sereinement-avec-pegi), [ESRB ratings](https://www.esrb.org/ratings/), [ESRB rating process](https://www.esrb.org/ratings/ratings-process/)

**MVP decision:** do not seek a rating merely for a direct, educational web page unless a distribution partner requires it; publish a clear audience/content note instead. Before a Steam, mobile-store, console, or monetised release, complete the relevant rating questionnaire and re-evaluate every added feature, particularly chat, ads, purchases, and user-generated content.

### Loot Box and Monetization Laws

The cleanest solution is structural: the MVP contains no random paid items, virtual currency, time-limited offers, advertising, or progression designed to compel return. This is aligned with both educational trust and the direction of age-rating scrutiny of interactive monetisation. It also avoids having to implement payment disclosures, purchase parental controls, or gambling-law analysis for the first case.

If optional financial support is added, make it a transparent donation or fixed-price transaction outside the learning loop. Do not make access to scientific explanations, source material, or completion contingent on payment. Treat any future paid randomised reward, NFT/blockchain feature, or open unmoderated chat as a new regulatory review gate.

### Platform Certification Requirements

Direct web hosting has no console-style certification. It does create responsibilities for accurate public claims, accessible terms/privacy information, secure hosting, and rights clearance. A future PWA preserves browser access while allowing optional installation, but platform support differs and should not change the game’s no-login core. [Source: MDN PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

For later storefront releases: Steam requires a per-app Steam Direct fee; app stores and console platforms add their own review, business, rating, privacy, and technical-certification paths. Budget those steps only after the browser case proves demand. [Source: Steam Direct](https://partner.steamgames.com/doc/gettingstarted/appfee)

### Data Protection and Privacy

The current MVP can avoid most privacy risk by collecting no account data and storing progress locally in the browser. Do not silently add third-party analytics, error tracking, embedded video, fonts, or social widgets without auditing their data flows; a persistent identifier can be personal information under COPPA.

COPPA applies to covered operators collecting personal information from children under 13, including general-audience services with actual knowledge; it requires notice, verifiable parental consent in most cases, minimisation, security, and deletion. A school may consent only for an educational use, not for the developer’s separate commercial use. [Source: FTC COPPA FAQs](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)

Under GDPR, child consent thresholds for online services vary by EU member state from 13 to 16; child-facing information must be clear and plain. [Source: European Commission](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en) Because teachers may use the game with younger learners despite the primary 16–25 target, the safer default is a no-login, no-tracking build and a concise privacy page stating that local progress never leaves the device.

### Regional Content Restrictions

No global content restriction is presently material to a non-violent historical physics case. The residual risks are representational rather than genre-driven: historically accurate but disturbing imagery, biased framing, defamatory claims about identifiable modern people, and use of culturally sensitive or restricted archival material. Use neutral contextual language, expert review, captions/alt text, and a content note where source documents contain historical terminology or imagery.

### Archival Rights, Attribution, and Open-Source Licensing

Public availability of a scan is not permission to reuse it globally. Every incorporated archival asset must have a rights assessment distinct from the historical work itself and distinct from the digital reproduction. RightsStatements.org provides standard rights-status vocabulary for cultural-heritage objects and emphasises that a rights statement complements, rather than replaces, detailed rights information. [Source: RightsStatements.org documentation](https://rightsstatements.org/en/documentation/)

Create a machine-readable `ASSET_RIGHTS` ledger before any public build. Required fields: item ID; source repository URL and accession/call number; creator/date; source title; underlying-work status; digital-surrogate status; licence or rights-statement URI; permitted use; required attribution; modifications/crop; reviewer/date; and a replacement asset. Link the same record from the in-game object and credits page.

For project-owned material, a practical separation is a permissive code licence such as MIT or Apache-2.0, CC BY 4.0 for original prose/lesson material, and asset-specific terms for all third-party material. CC BY 4.0 permits sharing and adaptation, including commercially, but requires credit, a licence link, and indication of changes; it does not resolve privacy, publicity, moral-rights, or other permissions. [Source: Creative Commons CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.en) Do not represent an asset as open merely because the application source is open.

### Implementation Considerations and Risk Assessment

| Risk | MVP exposure | Required control |
|---|---|---|
| Undesired age classification | Low | Keep content non-violent and non-monetised; reassess before store release. |
| Loot-box/payment regulation | None if excluded | Maintain a hard “no random paid mechanics” rule. |
| Child/student privacy | Low if no data leaves device; high if accounts/analytics are added | No login or third-party tracking; publish a data-flow inventory and privacy notice. |
| Archival copyright/contract limits | Medium to high | Rights ledger, source-specific clearance, attribution, and fallback assets; remove unclear material. |
| Open-source contributor confusion | Medium | `LICENSE`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, DCO/CLA decision, and asset provenance policy before accepting external assets. |
| Store/platform rejection | Low for direct web; deferred elsewhere | Treat every new platform as a fresh compliance pass. |

**Compliance decision:** keep the first case non-commercial in its learning experience, no-login, locally saved, no-chat, no-ad, and source-provenanced. This is not only the safest legal position—it is the clearest classroom value proposition. Add accounts, telemetry, payments, social features, app-store distribution, or third-party services only behind a written data/rights/compliance review.

## Game Technical Trends and Innovation

### Game Engine Landscape

For this MVP, “engine choice” is mainly a scope-control decision. The scientific interaction is a 2D parameterised visualisation with document and notebook UI; it does not need 3D scenes, physics middleware, multiplayer, or an editor-centric asset pipeline.

**Recommendation: standards-first web application.** Use TypeScript, semantic HTML/CSS for narrative, controls, and explanation layers, plus Canvas or SVG for the interference field. This makes the accessible interface the primary interface rather than an overlay around a full-screen game canvas. Render the pattern deterministically from explicit case parameters so a saved observation can be reproduced and cited.

**Framework threshold:** add Phaser only if the prototype demonstrably needs scene lifecycle, input abstraction, tweening, or asset management beyond small custom modules. Phaser is an open-source HTML5 framework supporting WebGL and Canvas across desktop and mobile browsers, making it the best low-overhead framework fallback for a 2D game-like shell. [Source: Phaser documentation](https://docs.phaser.io/)

Godot and PlayCanvas remain credible future choices, not MVP defaults. Godot is MIT-licensed and can export to web, desktop, and mobile; PlayCanvas is MIT-licensed, standards-based, and supports WebGL2/WebGPU. Both introduce a more canvas/WebGL-centric UI and build/runtime complexity that this case does not need; PlayCanvas additionally requires WebGL 2. [Sources: Godot licence](https://godotengine.org/license/), [Godot repository](https://github.com/godotengine/godot), [PlayCanvas Engine](https://playcanvas.com/products/engine), [supported browsers](https://developer.playcanvas.com/user-manual/engine/supported-browsers/)

### Rendering and Graphics Technology

Do not pursue ray tracing, WebGPU, 3D optics, or physically complete wave propagation for the first case. They make the product harder to validate, less broadly compatible, and no more educationally convincing than a carefully bounded model. Use a 2D analytical or sampled interference pattern that visibly links slit spacing, wavelength, screen distance, and measured fringe spacing. State its assumptions in the explanation layer.

Canvas is suitable for a dense visual field; SVG is suitable for labelled apparatus elements and responsive diagrams. Keep the laboratory controls in HTML, not as unlabelled canvas hotspots. If WebGL is used later for performance, retain a Canvas/DOM fallback and preserve exact semantic equivalents.

### AI in Game Development

Generative AI is not a core implementation opportunity for this case. It risks invented archival claims, inconsistent scientific explanation, licensing ambiguity, and a moderation/privacy burden. Do not use an LLM to improvise historical sources, evaluate a learner’s conclusion, or generate scientific feedback in the MVP.

Useful bounded automation is conventional rather than generative: deterministic calculation of expected fringe spacing; schema validation for case data and citations; automated accessibility and regression tests; and editorial tooling that flags a claim with no source ledger entry. Any later AI-assisted production tool must be reviewed for data use, source provenance, and contributor disclosure.

### Platform-Specific Technology

Desktop web is the primary target: pointer precision and reading space suit a laboratory plus evidence notebook. Build responsive layout and Pointer Events so the same components work by mouse, pen, or touch; controls must also have keyboard equivalents. On tablet, collapse side panels into labelled drawers and replace drag-only alignment with tap/select plus stepper controls. On phone, let users read material and revisit notes, but do not promise the full lab until testing proves it works.

PWA is the distribution bridge, not a second product. A manifest and HTTPS support installation in compatible browsers; service-worker caching can provide offline resilience after first load. Browser behaviour varies, so keep every core action available through the ordinary URL. [Source: MDN PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

### Online and Multiplayer Technology

There is no MVP requirement for multiplayer, real-time networking, server reconciliation, accounts, leaderboards, or cloud saves. Store a compact case state locally and provide an explicit export/import file or printable observation record. This supports classroom hand-off without turning the project into identity or student-data infrastructure.

If educator pilots later require assessment integration, treat LMS/LTI and aggregated, consented completion data as a separate institutional product. Do not add them to the player-facing laboratory before validating demand and privacy governance.

### Future Outlook

The near-term opportunity is not novel rendering technology; it is resilient, accessible web delivery. A URL-playable case with offline caching, responsive layout, and a declarative case format can outlast a fast-moving engine trend and is easier for an open-source contributor community to inspect.

Over 3–5 years, native packaging or a richer engine becomes worthwhile only if later cases require immersive spatial manipulation that cannot be represented honestly in 2D, or validated demand establishes mobile/offline institutional deployment as essential. WebGPU and 3D engines are optional enhancements, not architectural premises.

### Implementation Opportunities

**High impact, low cost:**

- A deterministic `ExperimentModel` with explicit inputs, outputs, units, assumptions, and test fixtures.
- A declarative `CaseDefinition` (narrative beats, evidence items, sources, parameters, success criteria, explanation layers, rights IDs) that makes a second case possible without a fork.
- Semantic control surfaces beside the visual field: slider/number input plus keyboard steppers, announced values, reset, compare, and save-observation actions.
- An evidence notebook that records *the player’s own* settings and observations, then connects them to source-cited interpretations.
- Local-only persistence, export/import, small lazy-loaded case bundles, and an offline-ready shell.

### Challenges and Risks

| Risk | Mitigation |
|---|---|
| A visually impressive but scientifically opaque animation | Publish the equation/model assumptions, expose measured variables, and test against known cases. |
| Canvas-only accessibility failure | Keep controls, state, and explanations in semantic HTML; follow keyboard-accessible interaction guidance. [MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Keyboard) |
| Premature engine lock-in | Prototype in browser-native modules; introduce Phaser only after a measured need. |
| Tablet/mobile retrofit | Use responsive layout, Pointer Events, large targets, and non-drag alternatives from day one. |
| Future cases becoming bespoke rewrites | Define and validate `CaseDefinition` against the first case before building content-heavy tooling. |
| Third-party or AI dependency risk | Prefer local deterministic code and auditable content; review every external service. |

## Recommendations

### Technology Adoption Strategy

Build the first light-interference case as a TypeScript web application with Canvas/SVG rendering and HTML controls. Ship it as a normal static site; progressively add a web manifest and offline cache. Use a lightweight 2D framework only when the prototype shows a specific need. Do not choose Unity, Unreal, 3D engines, ray tracing, AI-driven feedback, multiplayer, or cloud services for the MVP.

### Innovation Roadmap

1. **Prototype (2–3 weeks):** one apparatus, one pattern, keyboard/touch alternatives, a two-clue notebook, local save, and a model-verification test set.
2. **Vertical slice:** full 20–40 minute case; layered explanation; source/rights ledger; accessible debrief; 15–30 learner/educator tests.
3. **Harden:** PWA/offline support, export/import, performance and accessibility audits, and a documented `CaseDefinition` schema.
4. **Only after evidence:** second case; optional educator integrations; tablet-first refinement; native packaging or a heavier engine only for demonstrated needs.

### Risk Mitigation

Set performance budgets for initial download and low-end school laptops; test keyboard-only, touch-only, and screen-reader-adjacent paths before visual polish; ensure every released case is reproducible from its parameters and source ledger; and maintain a no-external-data MVP so a deployment can be trusted, mirrored, and archived.

**Narrative-and-archive benchmark:** Mission US reports historian, community, youth, and educator review in mission development, alongside curricular support and primary-source material. Its desktop Unity WebGL delivery and account/progress model demonstrate features to avoid in the MVP, while its review process demonstrates the standard to adopt. Make expert review, a source ledger, an uncertainty note, and a classroom context sheet mandatory gates for every reusable case. [Sources: Mission US](https://www.mission-us.org/about/), [development process](https://www.mission-us.org/about/creating-mission-us/process-and-development/), [help](https://www.mission-us.org/help/)

## Research Synthesis and Strategic Recommendations

### Executive Summary

*Fracture of Certainty* should not attempt to out-scale general physics simulations, commercial educational-game platforms, or narrative adventures. Its opportunity is a credible hybrid none of those categories fully supplies: a compact historical investigation in which the learner manipulates an experiment, records evidence, weighs primary-source context, and makes an argument before receiving a modern explanation. PhET establishes the value of intuitive, dynamic exploration; historical inquiry titles establish the value of source-led missions; the MVP should join those strengths in one reproducible 20–40 minute case. [PhET research](https://phet.colorado.edu/translation/2657/research), [Investigation Declaration](https://www.filamentgames.com/project/investigation-declaration)

Desktop web is the right launch surface. A direct, no-login URL reduces classroom friction, makes the case easy to share and correct, and avoids turning an educational prototype into identity, payment, or platform-certification infrastructure. Tablet readiness is a present constraint—responsive layout, pointer/touch/keyboard equivalence—not a separate build. Native mobile, accounts, LMS integration, portals, and storefronts are later options contingent on validated demand. [MDN PWA guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

The decisive quality bar is trust: learners need an intelligible scientific model; educators need a bounded, accessible activity; contributors need a reusable case format; and archives need source-specific provenance and rights treatment. The recommended MVP therefore remains free in its learning path, no-ad, no-chat, no-tracking, locally saved, and explicit about what is reconstructed versus historically sourced.

### Key Findings

- **Smallest viable case:** disputed observation → two archival clues → configure slit setup and one or two variables → take two measurements → compare prediction and fringe pattern → issue a conclusion → unlock layered explanation and provenance.
- **Differentiation:** historical evidence plus tactile scientific inquiry, rather than a parameter sandbox, trivia game, or broad 3D adventure.
- **Technology:** TypeScript with semantic HTML/CSS and Canvas/SVG; a deterministic `ExperimentModel`; a declarative `CaseDefinition`; local persistence and optional PWA caching. Introduce Phaser only if the prototype demonstrates a concrete need.
- **Accessibility:** all lab actions must be available by keyboard, pointer, and touch, with semantic controls, announced values, non-colour-only evidence, drag alternatives, and no flashing hazards. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- **Open-source and archive practice:** license project-owned code and learning material separately; record asset-level rights, attribution, modification, and replacement data; never infer reuse permission from a public scan.

### Table of Contents

1. Game Domain Research Scope Confirmation
2. Game Industry Analysis
3. Competitive Landscape
4. Regulatory Requirements
5. Game Technical Trends and Innovation
6. Research Synthesis and Strategic Recommendations
7. Implementation Scorecard and Decision Gates
8. Research Methodology, Confidence, and Limitations
9. Research Conclusion

### GDD-Ready MVP Definition

**Player promise:** “Investigate why a surprising pattern changed what scientists could credibly claim about light.”

**Case premise:** a lab record and related historical material leave a scientific claim in doubt. The player has enough apparatus access and archival context to reproduce a simplified observation, measure it, and decide what conclusion the evidence supports.

**In scope:** one apparatus; one scientifically bounded interference model; two meaningful adjustable variables; two archival evidence items; an evidence notebook; three explanation depths (in-play prompt, accessible plain-language explanation, source/technical detail); local progress; educator handout; rights ledger; keyboard/touch/pointer completion.

**Out of scope:** a full optics course, social play, accounts, freeform LLM dialogue, user-generated cases, 3D laboratory navigation, native mobile app, adaptive assessment, live telemetry, and premium gating of learning content.

### Implementation Scorecard and Decision Gates

| Dimension | MVP success criterion | Evidence required before expanding scope |
|---|---|---|
| Scientific understanding | Most pilot learners can use their recorded settings and observation to support the intended conclusion in their own words. | A short pre/post or explanation-rubric result from 15–30 learner sessions. |
| Compelling loop | Learners voluntarily explore at least one variable beyond the minimum path and can state why it mattered. | Observation notes and session feedback, not only completion rate. |
| Accessibility | Keyboard-only, touch-first, and pointer-first paths reach the same conclusion without a workaround. | Manual acceptance runs and accessibility review on representative devices. |
| Educator fit | A teacher can understand objective, preparation, duration, and debrief from one page. | At least five educator reviews and willingness to share/use the activity. |
| Historical rigor | Each source-backed statement and asset links to a reviewed provenance/rights record; reconstructed material is labelled. | Expert/archivist review of the first case ledger. |
| Technical reuse | A second case can be represented in `CaseDefinition` without copying core UI/experiment logic. | A paper/schema exercise or thin second-case spike. |
| Sustainable distribution | Case loads from a canonical URL without login or external dependency critical to play. | Low-end school-laptop and offline/reload testing. |

**Go/no-go rule:** do not add a second full case until the first meets the scientific-understanding, accessibility, educator-fit, and historical-rigor criteria. Do not add accounts, analytics, payments, portals, Steam, or native packaging until a pilot establishes a concrete unmet need they solve.

### Platform, Distribution, and Funding Path

1. **Launch:** own-domain/static hosting; shareable URL; downloadable or printable educator sheet; source repository; local-only progress.
2. **Validate:** 15–30 learner/educator sessions across at least two contexts; collect consented qualitative observations before any product analytics.
3. **Harden:** PWA cache, export/import record, lazy-loaded archival assets, documented accessibility and source/rights policies.
4. **Sustain:** grant, museum/university, or open-education partnership; optional itch.io donation/support page. Do not adopt advertising or in-game purchases.
5. **Expand only on evidence:** tablet-first refinements; optional LMS integration for institutional pilots; later storefront or native release only with a clearly distinct audience and support plan.

### Contributor and Rights Operating Model

- Publish `LICENSE`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, and a contribution policy that requires provenance for every non-code asset.
- Keep source code, original instructional prose, source transcriptions, and third-party media in separate directories with separate licences/rights metadata.
- Require every case to include a scholarly reviewer, a source ledger, an uncertainty/interpretation note, an educator context sheet, and accessibility acceptance criteria.
- Treat archive rights as an editorial gate: unknown or ambiguous reuse status means link to the item or use a replacement—not “use until challenged.” RightsStatements.org’s vocabulary is useful for recording cultural-heritage object status, but it does not itself grant a licence. [RightsStatements.org](https://rightsstatements.org/en/documentation/)

### Future Outlook

The next 12–24 months should be spent establishing a small trusted corpus, not pursuing novelty technology. The most valuable asset is a repeatable editorial-and-technical case framework that lets future contributors add evidence-led investigations without weakening scientific, historical, or accessibility standards. Open educational resources are defined around access, reuse, adaptation, and redistribution under clear permission; this project can participate meaningfully in that ecosystem only if its own provenance is equally clear. [UNESCO OER mandate](https://www.unesco.org/en/open-educational-resources/mandate)

### Research Methodology, Confidence, and Limitations

**Method.** Research used current public web sources, prioritising official standards, platform documentation, primary project pages, and institutional sources. The work covered global desktop-web distribution with tablet/mobile constraints, primary learners aged 16–25, and educators/adult learners as secondary audiences. Market figures are contextual rather than demand forecasts for this niche.

**Confidence.** High: technical standards, accessibility requirements, licence terms, PhET/Mission US/Quantum Game product descriptions, platform fees, and privacy guidance. Medium: GDC survey findings and commercial market estimates. Medium-low: browser-portal audience and revenue claims, which are platform self-reports. The report distinguishes these accordingly.

**Limitations.** This is domain research, not legal advice, a learning-outcome study, a usability test, or archival clearance. The next empirical work is pilot testing with learners and educators, expert review of the historical/scientific framing, and asset-by-asset rights review.

### Research Conclusion

The most defensible MVP is a small, source-transparent, accessible historical laboratory. Its success will not be measured by downloads or graphic complexity, but by whether learners can use their own observation to explain why a light-interference result matters, and whether an educator or future contributor can trust how that experience was made.

**Immediate next actions:** write the first `CaseDefinition`; choose the historical framing and two source items subject to rights review; implement the deterministic experiment prototype and accessible control surface; draft the educator sheet and source ledger; then run the first 15–30 participant pilot before committing to additional cases or platforms.

---

**Research Completion Date:** 2026-08-04  
**Research Type:** Game domain research  
**Source Verification:** Current public sources cited inline  
**Overall Confidence:** High for MVP recommendations; market-size claims contextual only
