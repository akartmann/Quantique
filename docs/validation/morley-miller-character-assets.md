# Morley–Miller character asset provenance and validation

Date: 2026-08-21

## Provenance and rights status

The visual reference was supplied by the user as
`/Users/akartmann/Downloads/characters_design.png`. It was used only as
late-19th-century pixel-art style direction. Its labels, black background, named
people, and identities were not copied, cropped, or shipped.

Five production PNGs were newly generated with Codex's built-in image-generation
path, one fictional character per call. Each prompt requested a label-free,
full-body Victorian pixel-art figure with a transparent background, then named the
existing Morley–Miller figure cue as the identity source of truth. The generator
returned an opaque neutral checkerboard despite that request. A local, project-bound
cleanup removed the neutral near-white source backdrop and its large enclosed
checkerboard islands, while preserving smaller costume, skin, paper, and optical
instrument highlights. The four colleague PNGs were rechecked on a high-contrast
background after that correction; no source-sheet pixels or labels remain in the
production alpha PNGs.

| Material | Status | Rights review | Public clearance |
| --- | --- | --- | --- |
| `characters_design.png` | User-supplied reference | Not reviewed | Not cleared |
| Five production character PNGs | Built-in generated derivatives | Not reviewed | Not cleared |

These figures are fictional case characters, including the fictional representative
of the Cleveland bench. They are not historical likenesses of Morley, Miller, or any
person depicted by the supplied reference. Rights review and any decision to clear
the reference or derivatives for public use remain outstanding.

## Files and character direction

| File | Character direction preserved from authored fallback |
| --- | --- |
| `public/cases/morley-miller/assets/characters/edith-vance.png` | Dr. Edith Vance, ochre period dress, dark upswept hair, brass instrument raised beside her face |
| `public/cases/morley-miller/assets/characters/tomas-reyes.png` | Tomás Reyes, teal suit, brown complexion, cropped dark hair, reserved at-rest stance |
| `public/cases/morley-miller/assets/characters/harriet-lowe.png` | Harriet Lowe, plum period dress, swept auburn hair, papers held at mid-torso |
| `public/cases/morley-miller/assets/characters/nils-abrahamsen.png` | Nils Abrahamsen, green suit, fair swept hair, spectacles, open presenting gesture |
| `public/cases/morley-miller/assets/characters/cleveland-bench.png` | Fictional Cleveland-bench representative, rust suit, grey cropped hair, moustache, folded arms |

## Built-in generation prompts

Every call used `illustration-story` for a transparent full-body Phaser portrait,
with the common constraints **one fictional adult, no text, no watermark, no frame,
no black or chroma background, no other people, and no historical likeness**. The
character-specific requests were:

- Edith: gold/ochre gowned lead; dark upswept hair; raised brass optical instrument.
- Tomás: teal suited builder; brown complexion; cropped dark hair; reserved at-rest stance.
- Harriet: plum gowned analyst; swept auburn hair; papers held at mid-torso.
- Nils: green suited communicator; fair swept hair; spectacles; open presenting hand.
- Cleveland bench: rust suited rival representative; grey cropped hair; moustache; folded arms.

## Normalization and technical validation

The cleaned figure bounds were resized with nearest-neighbour sampling to a 680 px
visible height, horizontally centred on a 512 x 768 RGBA canvas, and placed with
their final visible row at y=719 (exclusive feet baseline y=720). This preserves the
`CharacterStage` portrait contract: 40 px above every subject and 48 px below the
shared baseline. The conservative widths keep every asset at or below the renderer's
351 px visible-width ceiling.

| Character | Cleaned source alpha bounds | Final alpha bounds (left, top, right, bottom-exclusive) | Visible width | Partially transparent pixels | Optimized bytes | Corner alpha |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Edith | `(251, 56, 780, 1489)` | `(106, 40, 406, 720)` | 300 | 0 | 272,755 | `0, 0, 0, 0` |
| Tomás | `(271, 50, 721, 1469)` | `(96, 40, 416, 720)` | 320 | 0 | 258,122 | `0, 0, 0, 0` |
| Harriet | `(208, 71, 749, 1632)` | `(111, 40, 401, 720)` | 290 | 0 | 236,512 | `0, 0, 0, 0` |
| Nils | `(70, 28, 759, 1559)` | `(80, 40, 431, 720)` | 351 | 0 | 210,085 | `0, 0, 0, 0` |
| Cleveland bench | `(259, 68, 684, 1556)` | `(96, 40, 416, 720)` | 320 | 0 | 239,361 | `0, 0, 0, 0` |

All files are 512 x 768 RGBA. Every corner is fully transparent, every subject is
inside its canvas, and all five subjects share the feet baseline. Native-resolution
inspection confirmed a single full-body figure with complete shoes, no text or
watermark, transparent edges without checkerboard residue, and distinct cues that
match the retained vector fallback.

Status: generated and technically validated; not rights-reviewed and not publicly
cleared.
