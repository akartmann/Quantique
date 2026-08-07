import type { Scene } from 'phaser';

import {
    BAY_PLANK_HEIGHT,
    CASE_CORNICE_HEIGHT,
    CASE_PILASTER_WIDTH,
    FLOORBOARD_HEIGHT,
    SPINE_TINT_COUNT,
    libraryCaseAlcoves,
    libraryCaseCornice,
    libraryCaseInterior,
    libraryCasePilasters,
    libraryCasePlank,
    WAINSCOT_PANEL_WIDTH,
    WAINSCOT_RAIL_HEIGHT,
    libraryFilledShelves,
    libraryFloorBand,
    libraryLeftBayBand,
    libraryRightBayBand,
    libraryShelfLights,
    libraryWainscotBand
} from '../scenes/libraryDecorGeometry';
import {
    libraryDetailPanelBand,
    libraryReadingSurfaceBand,
    libraryShelfBand,
    type LibraryRect
} from '../scenes/libraryGeometry';

/**
 * Everything in the reading room that cannot be clicked (Story 2.8, design revision).
 *
 * ## Why this is a separate object from `LibraryRenderer`
 *
 * `LibraryRenderer` is about a contract: dispatch on pickup, paint the gate, honour a refusal. None of
 * that changed. What changed is that the room around it was four flat rectangles, and the fix is a
 * couple of hundred fill commands that have nothing to say about state. Folding those into the renderer
 * would have buried the three load-bearing guards in `pickUp()` under scenery.
 *
 * So: this class owns pixels and nothing else. It reads no store, subscribes to nothing, holds no
 * player-facing string, and is built once in `create()` and never repainted — there is no `render`
 * here, deliberately, because a backdrop that repainted on every state change would be a cost paid on
 * every keystroke for a picture that never changes.
 *
 * ## Still no motion, and still no asset
 *
 * Every reference image the direction came from is a photograph of a lamplit room; none of that
 * requires a single moving pixel. This registers no update loop, starts no tween, and owns no timer, so
 * the reduced-motion contract stays satisfied by construction rather than by a media query — which is
 * the same position the room was already in and the reason it was worth keeping.
 *
 * Nothing here loads a texture. The whole room is `Graphics` fill commands, so the offline gate covers
 * no new asset and the rights ledger gains no entry (ADR-001, ADR-011).
 *
 * ## Layer order is the whole trick
 *
 * Phaser draws in creation order, so the sequence in {@link createRoom} *is* the depth of the room:
 * wall, floor, the bays receding into the corners, the warm wash over all of it, then the vignette that
 * pushes the edges back. {@link createCase} and {@link createDesk} are called *after* by the renderer,
 * so the furniture the player acts on sits in front of the vignette rather than behind it — the focal
 * plane is the one part of the room deliberately left un-dimmed.
 */

// --- Palette ---------------------------------------------------------------------------------------

/**
 * Warm walnut and lamplight, replacing the cold teal the room shipped in.
 *
 * The old fills were the laboratory's, taken so the two rooms would look related. They made the library
 * look like an annexe of the lab, which is the wrong relationship: the reading room is the one place in
 * the case that is not a laboratory, and it should feel like somewhere a person would want to sit.
 */
const WALL = 0x150e08;
const WALL_PANEL = 0x1c130b;
const WALL_PANEL_EDGE = 0x261a0f;

const BAY_CARCASS = 0x20140b;
const BAY_BACK = 0x0f0904;

const WOOD = 0x4a2f1a;
const WOOD_LIT = 0x6b452a;
const WOOD_DARK = 0x2c1b0f;

const GILT = 0xb98f34;
const GILT_BRIGHT = 0xe8c86a;

const LAMPLIGHT = 0xffcd8a;

const FLOOR = 0x241708;
const FLOOR_SEAM = 0x140c05;

/** The desk: oiled wood with a green leather writing pad, which is the classic reading-room cue. */
const DESK_TOP = 0x422a19;
const DESK_EDGE = 0x6a4429;
const BLOTTER = 0x18291f;
const BLOTTER_EDGE = 0x2a4131;

/**
 * Eight bindings, which is exactly {@link SPINE_TINT_COUNT}.
 *
 * A period library's spines are leather and buckram in a narrow warm range with two or three cool
 * outliers — not a rainbow. Getting that ratio right is most of why a wall of rectangles reads as
 * books, so the palette is deliberately dominated by russet, tan and olive with one slate and one
 * aubergine to break it up.
 */
const SPINE_TINTS: readonly number[] = [
    0x5e2c22, 0x473a22, 0x27402f, 0x6d5321, 0x3a2940, 0x7a5530, 0x25344a, 0x622c36
];

const spineTint = (index: number): number => SPINE_TINTS[index % SPINE_TINTS.length]!;

export class ReadingRoomDecor {
    private readonly layers: Phaser.GameObjects.Graphics[] = [];

    public constructor(private readonly scene: Scene) {}

    /** The shell: wall, floor, the two wall bays, the warm wash, and the vignette that frames it all. */
    public createRoom(canvasWidth: number, canvasHeight: number): void {
        const back = this.layer();
        back.fillStyle(WALL, 1);
        back.fillRect(0, 0, canvasWidth, canvasHeight);
        this.paintWallPanelling(back, canvasWidth, canvasHeight);
        this.paintWainscotAndFloor(back, canvasWidth, canvasHeight);

        const bays = this.layer();
        this.paintBay(bays, libraryLeftBayBand(canvasHeight), 0x51b3a7);
        this.paintBay(bays, libraryRightBayBand(canvasWidth, canvasHeight), 0x2f8d41);

        // One warm source high in the room, so the whole picture has a direction to its light rather
        // than being uniformly dim. Centred above the case, which is where the eye should land first.
        const glow = this.layer();
        this.paintRadialGlow(glow, canvasWidth / 2, canvasHeight * 0.14, canvasHeight * 1.05, 0.011, 16);

        this.paintVignette(this.layer(), canvasWidth, canvasHeight);
    }

    /**
     * The bookcase the featured references stand in.
     *
     * Takes the placements the renderer is about to draw into it, so the pockets of ordinary books
     * either side are derived from where the references actually landed. A case with four artifacts
     * leaves no room for them and gets none — the room does not assume the shipped count.
     */
    public createCase(canvasWidth: number, placements: readonly LibraryRect[]): void {
        const shelf = libraryShelfBand(canvasWidth);
        const interior = libraryCaseInterior(shelf);
        const graphics = this.layer();

        // Back of the case first, then everything that stands in front of it.
        graphics.fillStyle(WOOD_DARK, 1);
        graphics.fillRect(shelf.x, shelf.y, shelf.width, shelf.height);
        graphics.fillStyle(BAY_BACK, 1);
        graphics.fillRect(interior.x, interior.y, interior.width, interior.height);

        // The two picture lights, washing down the inside of the case. Painted before the books so the
        // books sit *in* the light rather than under a veil of it.
        libraryShelfLights(shelf).forEach(({ x }) => this.paintShelfWash(graphics, interior, x));

        libraryCaseAlcoves(shelf, placements).forEach((alcove, index) => {
            libraryFilledShelves(alcove, { seed: 0x51b3 + (index * 977), rowHeight: alcove.height, plankHeight: 0, padding: 2 })
                .forEach((row) => this.paintShelfRow(graphics, row));
        });

        // Uprights, cornice and plank, each with a lit top edge — a single flat fill reads as a
        // rectangle, and one highlight line is what turns it into a piece of joinery.
        libraryCasePilasters(shelf).forEach((pilaster) => {
            graphics.fillStyle(WOOD, 1);
            graphics.fillRect(pilaster.x, pilaster.y, pilaster.width, pilaster.height);
            graphics.fillStyle(WOOD_LIT, 0.55);
            graphics.fillRect(pilaster.x, pilaster.y, 3, pilaster.height);
            graphics.fillStyle(GILT, 0.5);
            graphics.fillRect(pilaster.x + (pilaster.width / 2) - 1, pilaster.y + 10, 2, pilaster.height - 20);
        });

        const cornice = libraryCaseCornice(shelf);
        graphics.fillStyle(WOOD, 1);
        graphics.fillRect(cornice.x, cornice.y, cornice.width, cornice.height);
        graphics.fillStyle(WOOD_LIT, 1);
        graphics.fillRect(cornice.x, cornice.y, cornice.width, 5);
        graphics.fillStyle(GILT, 0.65);
        graphics.fillRect(cornice.x, cornice.y + cornice.height - 3, cornice.width, 2);

        // The fixtures themselves, sitting under the moulding they hang from.
        libraryShelfLights(shelf).forEach(({ x }) => {
            graphics.fillStyle(GILT, 1);
            graphics.fillRect(x - 16, shelf.y + CASE_CORNICE_HEIGHT - 1, 32, 5);
            graphics.fillStyle(LAMPLIGHT, 0.9);
            graphics.fillRect(x - 13, shelf.y + CASE_CORNICE_HEIGHT + 3, 26, 2);
        });

        const plank = libraryCasePlank(shelf);
        graphics.fillStyle(WOOD, 1);
        graphics.fillRect(plank.x, plank.y, plank.width, plank.height);
        graphics.fillStyle(WOOD_LIT, 0.85);
        graphics.fillRect(plank.x, plank.y, plank.width, 3);
        graphics.fillStyle(WOOD_DARK, 1);
        graphics.fillRect(plank.x, plank.y + plank.height - 3, plank.width, 3);
    }

    /**
     * The reading desk, and the pool of lamplight on it.
     *
     * The detail panel's text is written on the blotter this draws, so the two have to agree about
     * where the blotter is — which they do by both reading {@link libraryDetailPanelBand} rather than
     * by both knowing the same number.
     */
    public createDesk(canvasWidth: number, canvasHeight: number): void {
        const surface = libraryReadingSurfaceBand(canvasWidth, canvasHeight);
        const blotter = libraryDetailPanelBand(canvasWidth, canvasHeight);
        const graphics = this.layer();

        // A lit front edge and a shadow under it, so the desk has a thickness.
        graphics.fillStyle(DESK_TOP, 1);
        graphics.fillRect(surface.x, surface.y, surface.width, surface.height);
        graphics.fillStyle(DESK_EDGE, 1);
        graphics.fillRect(surface.x, surface.y, surface.width, 3);
        graphics.fillStyle(0x000000, 0.35);
        graphics.fillRect(surface.x, surface.y + surface.height - 5, surface.width, 5);

        // The shadow the desk throws down the wall behind it, fading out over 40px. Without it the
        // floor below reads as a second flat panel rather than as the space under a piece of furniture.
        const CAST_STEPS = 20;
        for (let step = 0; step < CAST_STEPS; step += 1) {
            graphics.fillStyle(0x000000, 0.3 * (1 - (step / CAST_STEPS)));
            graphics.fillRect(surface.x - 8, surface.y + surface.height + (step * 2), surface.width + 16, 3);
        }

        // Grain, at low alpha and irregular spacing. Evenly spaced lines read as corduroy.
        graphics.fillStyle(WOOD_DARK, 0.16);
        [0.14, 0.23, 0.41, 0.52, 0.68, 0.79, 0.91].forEach((fraction) => {
            graphics.fillRect(surface.x, surface.y + (surface.height * fraction), surface.width, 1);
        });

        // The lamp pool, centred on the blotter and wider than it, so the light falls off onto bare
        // wood rather than stopping at the leather's edge.
        this.paintRadialGlow(graphics, blotter.x + (blotter.width * 0.42), blotter.y + (blotter.height / 2), surface.height * 1.6, 0.016, 16);

        graphics.fillStyle(BLOTTER, 1);
        graphics.fillRect(blotter.x, blotter.y, blotter.width, blotter.height);
        graphics.lineStyle(2, BLOTTER_EDGE, 1);
        graphics.strokeRect(blotter.x, blotter.y, blotter.width, blotter.height);

        // Brass corner tacks: four small triangles, which is how a leather desk pad is actually held
        // down and the cheapest possible signal that this is one.
        const TACK = 11;
        ([
            [blotter.x, blotter.y, 1, 1],
            [blotter.x + blotter.width, blotter.y, -1, 1],
            [blotter.x, blotter.y + blotter.height, 1, -1],
            [blotter.x + blotter.width, blotter.y + blotter.height, -1, -1]
        ] as const).forEach(([x, y, dx, dy]) => {
            graphics.fillStyle(GILT, 0.55);
            graphics.fillTriangle(x, y, x + (TACK * dx), y, x, y + (TACK * dy));
        });
    }

    public destroy(): void {
        this.layers.forEach((layer) => layer.destroy());
        this.layers.length = 0;
    }

    // --- Painting -----------------------------------------------------------------------------------

    private layer(): Phaser.GameObjects.Graphics {
        const graphics = this.scene.add.graphics();
        this.layers.push(graphics);
        return graphics;
    }

    /** Tall wall panels behind everything, giving the back wall a scale to be read against. */
    private paintWallPanelling(graphics: Phaser.GameObjects.Graphics, canvasWidth: number, canvasHeight: number): void {
        const PANEL_WIDTH = 132;
        for (let x = 0; x < canvasWidth; x += PANEL_WIDTH) {
            graphics.fillStyle(WALL_PANEL, 1);
            graphics.fillRect(x + 6, 0, PANEL_WIDTH - 12, canvasHeight);
            graphics.fillStyle(WALL_PANEL_EDGE, 1);
            graphics.fillRect(x + 6, 0, 2, canvasHeight);
        }
    }

    /**
     * The panelled wainscot behind and below the desk, and the strip of floor under it.
     *
     * Raised-and-fielded panels: a recessed field with a lit top-left bevel and a shadowed bottom-right
     * one. Those two bevels are the entire illusion — the same field with a flat outline reads as a
     * drawn rectangle, and with the bevels it reads as joinery, which is worth four extra fills a panel.
     *
     * The floor strip gets the one trick that stops a horizontal band reading as more wall: the seams
     * widen as the boards come nearer. Evenly spaced seams *are* a panelled wall seen head-on, which is
     * exactly what the first pass of this looked like.
     */
    private paintWainscotAndFloor(graphics: Phaser.GameObjects.Graphics, canvasWidth: number, canvasHeight: number): void {
        const wainscot = libraryWainscotBand(canvasWidth, canvasHeight);
        const floor = libraryFloorBand(canvasWidth, canvasHeight);

        graphics.fillStyle(WOOD_DARK, 1);
        graphics.fillRect(wainscot.x, wainscot.y, wainscot.width, wainscot.height);

        // The dado rail across the top, which is what the desk visually sits against.
        graphics.fillStyle(WOOD, 1);
        graphics.fillRect(wainscot.x, wainscot.y, wainscot.width, WAINSCOT_RAIL_HEIGHT);
        graphics.fillStyle(WOOD_LIT, 0.7);
        graphics.fillRect(wainscot.x, wainscot.y, wainscot.width, 2);

        const panelTop = wainscot.y + WAINSCOT_RAIL_HEIGHT + 10;
        const panelHeight = (wainscot.y + wainscot.height) - panelTop - 10;
        const panelCount = Math.max(1, Math.round(wainscot.width / WAINSCOT_PANEL_WIDTH));
        const panelPitch = wainscot.width / panelCount;
        if (panelHeight > 0) {
            for (let panel = 0; panel < panelCount; panel += 1) {
                const x = wainscot.x + (panel * panelPitch) + 12;
                const width = panelPitch - 24;
                graphics.fillStyle(0x000000, 0.32);
                graphics.fillRect(x, panelTop, width, panelHeight);
                graphics.fillStyle(WOOD_LIT, 0.28);
                graphics.fillRect(x, panelTop, width, 2);
                graphics.fillRect(x, panelTop, 2, panelHeight);
                graphics.fillStyle(0x000000, 0.4);
                graphics.fillRect(x, panelTop + panelHeight - 2, width, 2);
                graphics.fillRect(x + width - 2, panelTop, 2, panelHeight);
            }
        }

        graphics.fillStyle(FLOOR, 1);
        graphics.fillRect(floor.x, floor.y, floor.width, floor.height);
        // Skirting, and the contact shadow where it meets the boards.
        graphics.fillStyle(WOOD, 1);
        graphics.fillRect(floor.x, floor.y - 9, floor.width, 9);
        graphics.fillStyle(WOOD_LIT, 0.45);
        graphics.fillRect(floor.x, floor.y - 9, floor.width, 2);
        graphics.fillStyle(0x000000, 0.6);
        graphics.fillRect(floor.x, floor.y, floor.width, 4);

        let y = floor.y + 6;
        let spacing = FLOORBOARD_HEIGHT * 0.4;
        while (y < floor.y + floor.height) {
            graphics.fillStyle(0xffffff, 0.014 * ((y - floor.y) / floor.height));
            graphics.fillRect(floor.x, y - spacing, floor.width, spacing);
            graphics.fillStyle(FLOOR_SEAM, 0.75);
            graphics.fillRect(floor.x, y, floor.width, 2);
            spacing *= 1.45;
            y += spacing;
        }
    }

    /**
     * One wall bay: a carcass, a shadowed back, and shelves packed to the ceiling.
     *
     * A dark scrim goes over the finished bay. Without it the sheer number of spines competes with the
     * two references that actually matter, which is the failure mode of putting this much detail in the
     * background at all — the bays are supposed to say "library" at a glance and then be ignored.
     */
    private paintBay(graphics: Phaser.GameObjects.Graphics, bay: LibraryRect, seed: number): void {
        graphics.fillStyle(BAY_CARCASS, 1);
        graphics.fillRect(bay.x, bay.y, bay.width, bay.height);
        graphics.fillStyle(BAY_BACK, 1);
        graphics.fillRect(bay.x + 4, bay.y, bay.width - 8, bay.height);

        libraryFilledShelves(bay, { seed }).forEach((row) => {
            this.paintShelfRow(graphics, row);
            graphics.fillStyle(WOOD, 1);
            graphics.fillRect(row.plank.x, row.plank.y, row.plank.width, row.plank.height);
            graphics.fillStyle(WOOD_LIT, 0.6);
            graphics.fillRect(row.plank.x, row.plank.y, row.plank.width, 2);
        });

        // Recede: darker toward the corner of the room, and dimmed overall.
        graphics.fillStyle(0x000000, 0.52);
        graphics.fillRect(bay.x, bay.y, bay.width, bay.height);
        graphics.fillStyle(WOOD_DARK, 1);
        graphics.fillRect(bay.x + bay.width - 4, bay.y, 4, bay.height);
    }

    private paintShelfRow(
        graphics: Phaser.GameObjects.Graphics,
        row: ReturnType<typeof libraryFilledShelves>[number]
    ): void {
        row.spines.forEach((spine) => {
            graphics.fillStyle(spineTint(spine.tintIndex), 1);
            graphics.fillRect(spine.x, spine.y, spine.width - 1, spine.height);
            // A lit left edge gives every spine a rounded look for one pixel of cost.
            graphics.fillStyle(0xffffff, 0.07);
            graphics.fillRect(spine.x, spine.y, 1, spine.height);
            if (!spine.hasGiltBands) return;
            // The two gilt rules near the head of the spine. This is the single detail that stops a
            // packed row reading as a barcode.
            graphics.fillStyle(GILT, 0.55);
            graphics.fillRect(spine.x + 2, spine.y + (spine.height * 0.17), spine.width - 5, 2);
            graphics.fillRect(spine.x + 2, spine.y + (spine.height * 0.27), spine.width - 5, 1);
        });
        row.flat.forEach((book) => {
            graphics.fillStyle(spineTint(book.tintIndex), 1);
            graphics.fillRect(book.x, book.y, book.width, book.height);
            graphics.fillStyle(0x000000, 0.3);
            graphics.fillRect(book.x, book.y + book.height - 1, book.width, 1);
        });
    }

    /**
     * A picture light's cone, painted as horizontal slices clamped to the case interior.
     *
     * Slices rather than a circle with a mask: a circular glow would spill over the uprights and out
     * onto the wall, and a Phaser geometry mask to stop it would be a second display object with its
     * own lifetime to get wrong. The arithmetic is four lines and cannot leak.
     */
    private paintShelfWash(graphics: Phaser.GameObjects.Graphics, interior: LibraryRect, lightX: number): void {
        const SLICES = 24;
        const sliceHeight = interior.height / SLICES;
        for (let slice = 0; slice < SLICES; slice += 1) {
            const depth = slice / SLICES;
            const halfWidth = (0.09 + (0.62 * depth)) * interior.width;
            const left = Math.max(interior.x, lightX - halfWidth);
            const right = Math.min(interior.x + interior.width, lightX + halfWidth);
            if (right <= left) continue;
            graphics.fillStyle(LAMPLIGHT, 0.062 * ((1 - depth) ** 1.4));
            graphics.fillRect(left, interior.y + (slice * sliceHeight), right - left, sliceHeight + 1);
        }
    }

    /** Concentric discs at low alpha. The accumulated overlap is the falloff. */
    private paintRadialGlow(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        radius: number,
        peakAlpha: number,
        steps: number
    ): void {
        for (let step = steps; step > 0; step -= 1) {
            graphics.fillStyle(LAMPLIGHT, peakAlpha);
            graphics.fillCircle(x, y, (radius * step) / steps);
        }
    }

    /**
     * Darkens the four edges so the room has corners.
     *
     * Ramped rectangles rather than a radial gradient, because the corners doubling up is what a
     * vignette wants anyway: the darkest points end up where two ramps overlap.
     */
    private paintVignette(graphics: Phaser.GameObjects.Graphics, canvasWidth: number, canvasHeight: number): void {
        const STEPS = 26;
        const horizontal = canvasWidth * 0.22;
        const vertical = canvasHeight * 0.24;
        const ALPHA = 0.075;
        for (let step = 0; step < STEPS; step += 1) {
            const depth = 1 - (step / STEPS);
            const bandWidth = (horizontal / STEPS) + 1;
            const bandHeight = (vertical / STEPS) + 1;
            const alpha = ALPHA * depth;
            graphics.fillStyle(0x000000, alpha);
            graphics.fillRect(step * (horizontal / STEPS), 0, bandWidth, canvasHeight);
            graphics.fillRect(canvasWidth - (step * (horizontal / STEPS)) - bandWidth, 0, bandWidth, canvasHeight);
            graphics.fillRect(0, step * (vertical / STEPS), canvasWidth, bandHeight);
            graphics.fillRect(0, canvasHeight - (step * (vertical / STEPS)) - bandHeight, canvasWidth, bandHeight);
        }
    }
}

export { CASE_PILASTER_WIDTH, BAY_PLANK_HEIGHT, GILT, GILT_BRIGHT, LAMPLIGHT, WOOD, WOOD_DARK, WOOD_LIT };
