# Young character asset provenance and validation

Date: 2026-08-08

## Provenance and rights status

The visual reference was supplied by the user as
`C:\Users\alexi\Downloads\characters_design.png`. It was used only as a style and
fictional-character identity reference. The complete board was not cropped or shipped as a
production asset.

Each production PNG is a newly generated derivative made with Codex's built-in image-generation
path, one character per call. Every call used the supplied board as a reference and requested a
single opaque, label-free pixel-art character on a flat `#ff00ff` chroma-key background. The key
was removed locally with the installed imagegen `remove_chroma_key.py` helper using border
auto-sampling, soft matte, thresholds 12/220, and despill. No CLI/API image-generation fallback or
native-transparency claim was used.

| Material | Status | Rights review | Public clearance |
| --- | --- | --- | --- |
| `characters_design.png` | User-supplied reference | Not reviewed | Not cleared |
| Five production character PNGs | Built-in generated derivatives | Not reviewed | Not cleared |

These assets depict fictional case characters. They are not presented or documented as historical
likenesses. Rights review and any decision to clear the reference or derivatives for public use
remain outstanding.

## Files and character direction

| File | Character direction preserved from the reference |
| --- | --- |
| `public/cases/young-interference/assets/characters/thea-young.png` | Dr. Thea Young, dark period dress and jacket, lens raised beside her face |
| `public/cases/young-interference/assets/characters/elias-wren.png` | Elias Wren, dark suit, spectacles, clipboard/papers held in both hands |
| `public/cases/young-interference/assets/characters/marianne-cole.png` | Marianne Cole, plum period dress, upswept auburn hair, papers held at mid-torso |
| `public/cases/young-interference/assets/characters/samuel-hart.png` | Samuel Hart, dark suit, moustache, open-hand presenting gesture |
| `public/cases/young-interference/assets/characters/arthur-bell.png` | Mr. Arthur Bell, brown suit, moustache, folded arms |

## Normalization and technical validation

All source generations were 1024 x 1536. After key removal, each alpha subject was cropped to its
visible bounds, resized with nearest-neighbour sampling to 680 px high, horizontally centred on a
512 x 768 RGBA canvas, and placed with its final visible row at y=719 (exclusive alpha-bound feet
baseline y=720). This leaves 40 px above every subject and 48 px below the common baseline. PNGs
were saved with maximum Pillow compression and optimization.

The generation prompt requested exact `#ff00ff`. The built-in generator encoded visually flat
near-magenta borders; border auto-sampling detected the values shown below before clean removal.
This is recorded to avoid implying byte-exact source pixels. It does not remain in the production
alpha PNGs.

| Character | Sampled source key | Final alpha bounds (left, top, right, bottom-exclusive) | Visible subject coverage | Partially transparent pixels | Optimized bytes | Corner alpha |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Thea | `#f504f3` | `(132, 40, 379, 720)` | 29.02% | 1,930 | 172,522 | `0, 0, 0, 0` |
| Elias | `#fb03f9` | `(129, 40, 383, 720)` | 25.42% | 1,501 | 182,530 | `0, 0, 0, 0` |
| Marianne | `#f903f8` | `(130, 40, 382, 720)` | 29.93% | 9,259 | 214,103 | `0, 0, 0, 0` |
| Samuel | `#f804f7` | `(80, 40, 431, 720)` | 29.19% | 2,083 | 174,463 | `0, 0, 0, 0` |
| Arthur | `#f705f4` | `(147, 40, 365, 720)` | 24.61% | 1,541 | 169,795 | `0, 0, 0, 0` |

`Corner alpha` lists top-left, top-right, bottom-left, and bottom-right. Every file is 512 x 768
RGBA, every corner is fully transparent, every subject is contained within the canvas, and all
five subjects share the same feet baseline.

## Visual inspection

Each final production PNG was inspected individually at original resolution after normalization.
The five files are full-body, label-free, watermark-free, and contain exactly one character. Thea's
raised lens, Elias's spectacles and clipboard/papers, Marianne's papers and upswept auburn hair,
Samuel's presenting gesture and moustache, and Arthur's folded arms and moustache are clear. Shoes
are complete, silhouettes remain separated from the canvas edges, period outfits remain coherent,
and no obvious key-colour fringe is visible.

Status: generated and technically validated; not rights-reviewed and not publicly cleared.
