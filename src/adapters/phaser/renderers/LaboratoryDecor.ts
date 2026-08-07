import type { Scene } from 'phaser';

/**
 * The optics laboratory the colleagues stand in (Story 2.9, design revision).
 *
 * ## Why this is a separate object
 *
 * The same division `ReadingRoomDecor` draws, and for the same reason. `ColleagueRenderer` is about a
 * contract: project the proposals, dispatch the choice, answer a refusal, keep the transient message
 * alive. None of that changed. What changed is that the room around it was a flat dark void, and the
 * fix is a couple of hundred fill commands with nothing to say about state. Folding those in would
 * bury the load-bearing guards under scenery.
 *
 * So: this class owns pixels and nothing else. It reads no store, subscribes to nothing, holds no
 * player-facing string, and is built once and never repainted — there is no `render` here,
 * deliberately, because a backdrop that repainted on every state change would be a cost paid on every
 * keystroke for a picture that never changes.
 *
 * ## No motion, and no asset
 *
 * It registers no update loop, starts no tween and owns no timer, so the reduced-motion contract is
 * satisfied by construction rather than by a media query. Nothing here loads a texture: the whole room
 * is `Graphics` fill commands, so the offline gate covers no new file and the rights ledger gains no
 * entry (ADR-001, ADR-011).
 *
 * ## Layer order is the whole trick
 *
 * Phaser draws in creation order, so the sequence in {@link create} *is* the depth of the room: back
 * wall, windows with the city beyond, the panelled dado, the floor, then the furniture and apparatus
 * along the back, then the warm wash and the vignette that push the edges away. The renderer builds
 * this **first**, before its figures and before its cards, so everything the player reads or acts on
 * sits in front of it.
 *
 * ## Why the palette is cold where the library's is warm
 *
 * The reading room is walnut and lamplight because it is the one place in the case that is not a
 * laboratory. This *is* the laboratory: brass, slate, and a grey London window. The lamp on the bench
 * is the only warm source, and it is there to give the room a direction to its light — a uniformly
 * dim picture reads as unfinished rather than as evening.
 */

// --- Palette ---------------------------------------------------------------------------------

const WALL = 0x121c20;
const WALL_PANEL = 0x16232a;
const WALL_EDGE = 0x1d2f36;

const DADO = 0x1b2c33;
const DADO_RAIL = 0x2b4149;

const FLOOR = 0x1a2429;
const FLOOR_SEAM = 0x101719;
const FLOOR_LIT = 0x2a3a41;

const WINDOW_SKY = 0x3c5560;
const WINDOW_CITY = 0x1f3038;
const WINDOW_FRAME = 0x0e1619;
const WINDOW_GLAZE = 0x53707c;

const BRASS = 0x8a6a2f;
const BRASS_LIT = 0xc79a45;
const SLATE = 0x0d1417;
const BENCH = 0x22323a;
const BENCH_LIT = 0x354c56;

const LAMPLIGHT = 0xffcd8a;
const CHALK = 0x9fb3ae;

/** The band of wall the windows and the blackboard sit in, as a fraction of the room's height. */
const BACK_WALL_FRACTION = 0.62;

/**
 * The shortest strip the room can be composed into and still read as a room.
 *
 * Below it the props are drawn but nothing survives the scaling: at 60px the two sash windows are nine
 * pixels tall and the blackboard is a bright horizontal line. Matched to
 * `MIN_LEGIBLE_FIGURE_HEIGHT` plus the plaque, because the two thresholds answer the same question —
 * a band this short holds no cast either, and a room with no one in it has nothing to be a room *for*.
 */
const MIN_COMPOSABLE_HEIGHT = 130;

/** Back wall, furniture, lamp wash, vignette — the four depths {@link LaboratoryDecor.create} fills. */
const LAYER_COUNT = 4;

/** Flat wall colour above the composed room, so nothing shows through behind the dialogue panel. */
const graphicsFillTo = (graphics: Phaser.GameObjects.Graphics, canvasWidth: number, bottom: number): void => {
    if (bottom <= 0) return;
    graphics.fillStyle(WALL, 1);
    graphics.fillRect(0, 0, canvasWidth, bottom);
};

export class LaboratoryDecor {
    private readonly layers: Phaser.GameObjects.Graphics[] = [];
    private cursor = 0;

    public constructor(private readonly scene: Scene) {}

    /**
     * Adds the room's empty `Graphics` layers to the display list, before anything else is built.
     *
     * **Reserving and painting are separate acts, and they have to be.** Creation order is the only
     * depth mechanism these renderers use, and a `Graphics` joins the display list at the moment
     * `scene.add.graphics()` runs — not when it is filled. The room cannot be *painted* in `create()`,
     * because the strip it composes into is bounded above by the dialogue panel and the panel has no
     * measured height until it has copy in it. Painting on the first render instead put every layer on
     * top of the entire surface: the chrome, the cards and the whole cast disappeared behind a picture
     * of a laboratory.
     *
     * So the layers are claimed here, at the bottom of the list where the room belongs, and
     * {@link create} fills the ones already claimed.
     */
    public reserve(): void {
        for (let index = this.layers.length; index < LAYER_COUNT; index += 1) {
            this.layers.push(this.scene.add.graphics());
        }
    }

    /**
     * Paints the room into the strip between `visibleTop` and `floorY`.
     *
     * Takes both lines rather than deriving either. The floor is where the figures stand, and only the
     * owner knows where that is — it is measured up from what the cards below need. `visibleTop` is the
     * bottom of the dialogue panel, and passing it is what puts the windows and the blackboard where
     * they can be seen instead of behind the panel.
     *
     * Everything inside is a fraction of the strip it is given, so the same room composes correctly on
     * the prediction board (a tall strip) and the conclusion board (a short one) without a second set
     * of numbers.
     */
    public create(canvasWidth: number, floorY: number, visibleTop = 0): void {
        const height = Math.max(0, floorY - visibleTop);
        if (height <= 0 || canvasWidth <= 0) return;

        this.cursor = 0;
        this.layers.forEach((layer) => layer.clear());
        const roomTop = visibleTop;
        const wallBottom = roomTop + (height * BACK_WALL_FRACTION);
        const back = this.layer();

        // Below the composing floor the room is wall colour and nothing else.
        //
        // Every prop here is a fraction of the strip, which composes correctly right up until the strip
        // is shorter than the props are tall. On the conclusion board — whose four cards each carry a
        // stated limitation, leaving about 60px of room — the same numbers produced sash windows nine
        // pixels high and a blackboard flattened into a bright line. It read as a rendering fault, not
        // as a short room. This is the same judgement `MIN_LEGIBLE_FIGURE_HEIGHT` makes about the cast,
        // made in the same place and for the same reason: an unreadable picture is worse than none.
        if (height < MIN_COMPOSABLE_HEIGHT) {
            graphicsFillTo(back, canvasWidth, floorY);
            this.paintVignette(this.layer(), canvasWidth, roomTop, floorY);
            return;
        }
        // Flat wall all the way to the top of the canvas, then the composed room inside the strip the
        // player can actually see. The dialogue panel covers the upper part of this surface, and a room
        // laid out over the full height put its windows and its blackboard entirely behind the panel —
        // leaving the visible strip empty and a stray frame edge poking out beside it. What is above
        // `visibleTop` therefore gets colour and nothing else, so there is no seam if the panel shrinks.
        graphicsFillTo(back, canvasWidth, roomTop);
        this.paintWall(back, canvasWidth, roomTop, wallBottom);
        this.paintWindows(back, canvasWidth, roomTop, wallBottom);
        this.paintBlackboard(back, canvasWidth, roomTop, wallBottom);
        this.paintDadoAndFloor(back, canvasWidth, wallBottom, floorY);

        const furniture = this.layer();
        this.paintBackBench(furniture, canvasWidth, wallBottom, floorY);
        this.paintApparatus(furniture, canvasWidth, wallBottom, floorY);

        const light = this.layer();
        this.paintRadialGlow(light, canvasWidth * 0.16, wallBottom, height * 1.1, 0.012, 14);
        this.paintVignette(this.layer(), canvasWidth, roomTop, floorY);
    }

    public destroy(): void {
        this.layers.forEach((layer) => layer.destroy());
        this.layers.length = 0;
        this.cursor = 0;
    }

    // --- Painting -----------------------------------------------------------------------------

    /** The next reserved layer, or a fresh one for a host that never called {@link reserve}. */
    private layer(): Phaser.GameObjects.Graphics {
        const reserved = this.layers[this.cursor];
        this.cursor += 1;
        if (reserved) return reserved;
        const graphics = this.scene.add.graphics();
        this.layers.push(graphics);
        return graphics;
    }

    /** Tall panels behind everything, giving the back wall a scale to be read against. */
    private paintWall(
        graphics: Phaser.GameObjects.Graphics,
        canvasWidth: number,
        top: number,
        bottom: number
    ): void {
        graphics.fillStyle(WALL, 1);
        graphics.fillRect(0, top, canvasWidth, bottom - top);

        const PANEL_WIDTH = 148;
        for (let x = 0; x < canvasWidth; x += PANEL_WIDTH) {
            graphics.fillStyle(WALL_PANEL, 1);
            graphics.fillRect(x + 5, top, PANEL_WIDTH - 10, bottom - top);
            graphics.fillStyle(WALL_EDGE, 1);
            graphics.fillRect(x + 5, top, 2, bottom - top);
        }
    }

    /**
     * Two tall sash windows on the left, with a grey city beyond them.
     *
     * The city is three overlapping bands of roofline rather than drawn buildings: at this size and
     * this contrast the eye reads silhouetted depth, and anything more detailed competes with the
     * people standing in front of it. The glazing bars are what say "window" — a plain lit rectangle
     * reads as a screen.
     */
    private paintWindows(
        graphics: Phaser.GameObjects.Graphics,
        canvasWidth: number,
        top: number,
        bottom: number
    ): void {
        const height = bottom - top;
        const windowTop = top + (height * 0.10);
        const windowHeight = height * 0.72;
        const windowWidth = Math.min(canvasWidth * 0.13, 132);
        const gap = windowWidth * 0.22;

        for (let index = 0; index < 2; index += 1) {
            const x = (canvasWidth * 0.035) + (index * (windowWidth + gap));

            graphics.fillStyle(WINDOW_SKY, 1);
            graphics.fillRect(x, windowTop, windowWidth, windowHeight);

            // The city, receding: each band lower, darker, and offset from the one behind it.
            for (let band = 0; band < 3; band += 1) {
                const bandTop = windowTop + (windowHeight * (0.42 + (band * 0.13)));
                graphics.fillStyle(WINDOW_CITY, 0.4 + (band * 0.2));
                for (let block = 0; block < 5; block += 1) {
                    const blockWidth = windowWidth / 5;
                    const rise = ((block + band) % 3) * (windowHeight * 0.05);
                    graphics.fillRect(
                        x + (block * blockWidth),
                        bandTop - rise,
                        blockWidth - 1,
                        (windowTop + windowHeight) - bandTop + rise
                    );
                }
            }

            // A cold wash down the glass, so the window is a light source and not a picture.
            graphics.fillStyle(WINDOW_GLAZE, 0.14);
            graphics.fillRect(x, windowTop, windowWidth, windowHeight * 0.45);

            // Frame and glazing bars.
            graphics.fillStyle(WINDOW_FRAME, 1);
            graphics.fillRect(x - 5, windowTop - 5, windowWidth + 10, 5);
            graphics.fillRect(x - 5, windowTop + windowHeight, windowWidth + 10, 6);
            graphics.fillRect(x - 5, windowTop - 5, 5, windowHeight + 11);
            graphics.fillRect(x + windowWidth, windowTop - 5, 5, windowHeight + 11);
            graphics.fillRect(x + (windowWidth / 2) - 2, windowTop, 4, windowHeight);
            for (let bar = 1; bar < 4; bar += 1) {
                graphics.fillRect(x, windowTop + (windowHeight * (bar / 4)) - 1, windowWidth, 3);
            }
            // The sill catches what light there is.
            graphics.fillStyle(DADO_RAIL, 1);
            graphics.fillRect(x - 9, windowTop + windowHeight + 6, windowWidth + 18, 5);
        }
    }

    /**
     * The blackboard behind the cast, carrying the diagram the case is actually about.
     *
     * A converging pencil of rays through a lens, splitting into a fan on the far side — chromatic
     * aberration, drawn in chalk. It is scenery, not content: it carries **no text**, because a
     * player-facing string painted here would be a surface outside the i18n layer, and every string
     * the player reads has to go through `translate` or be authored `LocalizedText` (ADR-010). The
     * diagram says what it says in any language.
     */
    private paintBlackboard(
        graphics: Phaser.GameObjects.Graphics,
        canvasWidth: number,
        top: number,
        bottom: number
    ): void {
        const height = bottom - top;
        const boardWidth = Math.min(canvasWidth * 0.21, 210);
        const boardHeight = height * 0.58;
        // Centred in the surface, where the gap between the two middle figures falls.
        //
        // It used to sit at 0.30 of the width, which is where the second of four colleagues stands: a
        // bright brass frame closed around Elias Wren's head and the board read as something he was
        // wearing. Décor is not told where the cast is standing and should not be, but the cast is laid
        // out in equal slots across the same surface, so the **middle** is the one place a prop of this
        // size is guaranteed to fall between two people rather than on one.
        const x = (canvasWidth - boardWidth) * 0.5;
        const y = top + (height * 0.12);
        if (boardHeight <= 0) return;

        // The frame is dimmed to a shadowed brass rather than the lit one. At the brightness it had, a
        // rectangle behind the cast out-read every face in front of it.
        graphics.fillStyle(BRASS, 0.55);
        graphics.fillRect(x - 5, y - 5, boardWidth + 10, boardHeight + 10);
        graphics.fillStyle(SLATE, 1);
        graphics.fillRect(x, y, boardWidth, boardHeight);
        graphics.fillStyle(BRASS_LIT, 0.18);
        graphics.fillRect(x - 5, y - 5, boardWidth + 10, 2);

        // The lens, as a pointed oval built from two overlapping arcs' worth of stacked bars.
        const centreY = y + (boardHeight * 0.5);
        const lensX = x + (boardWidth * 0.42);
        const lensHalf = boardHeight * 0.26;
        const SLICES = 14;
        graphics.fillStyle(CHALK, 0.55);
        for (let slice = 0; slice < SLICES; slice += 1) {
            const t = (slice / (SLICES - 1)) - 0.5;
            const halfWidth = (1 - (4 * t * t)) * (boardWidth * 0.028);
            graphics.fillRect(lensX - halfWidth, centreY + (t * 2 * lensHalf), halfWidth * 2, (2 * lensHalf) / SLICES + 1);
        }

        // Rays in, and a fan out — the aberration the case turns on.
        graphics.fillStyle(CHALK, 0.4);
        for (let ray = -2; ray <= 2; ray += 1) {
            const entryY = centreY + (ray * (lensHalf * 0.4));
            graphics.fillRect(x + (boardWidth * 0.08), entryY, boardWidth * 0.31, 1);
        }
        for (let ray = -3; ray <= 3; ray += 1) {
            const spread = ray * (lensHalf * 0.22);
            const length = boardWidth * 0.4;
            for (let step = 0; step < 12; step += 1) {
                graphics.fillStyle(CHALK, 0.34);
                graphics.fillRect(
                    lensX + (boardWidth * 0.04) + (step * (length / 12)),
                    centreY + (spread * (step / 12)),
                    length / 12,
                    1
                );
            }
        }
    }

    /** The panelled dado below the wall, and the boards of the floor the cast stands on. */
    private paintDadoAndFloor(
        graphics: Phaser.GameObjects.Graphics,
        canvasWidth: number,
        wallBottom: number,
        floorY: number
    ): void {
        const dadoHeight = (floorY - wallBottom) * 0.34;
        graphics.fillStyle(DADO, 1);
        graphics.fillRect(0, wallBottom, canvasWidth, dadoHeight);
        graphics.fillStyle(DADO_RAIL, 1);
        graphics.fillRect(0, wallBottom, canvasWidth, 4);
        graphics.fillStyle(0x000000, 0.35);
        graphics.fillRect(0, wallBottom + dadoHeight - 3, canvasWidth, 3);

        const floorTop = wallBottom + dadoHeight;
        graphics.fillStyle(FLOOR, 1);
        graphics.fillRect(0, floorTop, canvasWidth, floorY - floorTop);

        // Boards in perspective: the seams widen as they come nearer, which is the one trick that stops
        // a horizontal band reading as more wall.
        let y = floorTop + 4;
        let spacing = (floorY - floorTop) * 0.10;
        while (y < floorY) {
            graphics.fillStyle(FLOOR_LIT, 0.16 * ((y - floorTop) / Math.max(1, floorY - floorTop)));
            graphics.fillRect(0, y - spacing, canvasWidth, spacing);
            graphics.fillStyle(FLOOR_SEAM, 0.7);
            graphics.fillRect(0, y, canvasWidth, 2);
            spacing *= 1.5;
            y += spacing;
        }
        // The contact shadow where the dado meets the boards.
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillRect(0, floorTop, canvasWidth, 4);
    }

    /** A working bench along the back wall, so the cast is standing in a laboratory and not a corridor. */
    private paintBackBench(
        graphics: Phaser.GameObjects.Graphics,
        canvasWidth: number,
        wallBottom: number,
        floorY: number
    ): void {
        const benchHeight = (floorY - wallBottom) * 0.30;
        const y = wallBottom - (benchHeight * 0.25);
        if (benchHeight <= 0) return;

        graphics.fillStyle(BENCH, 1);
        graphics.fillRect(0, y, canvasWidth * 0.24, benchHeight);
        graphics.fillRect(canvasWidth * 0.72, y, canvasWidth * 0.28, benchHeight);
        graphics.fillStyle(BENCH_LIT, 1);
        graphics.fillRect(0, y, canvasWidth * 0.24, 3);
        graphics.fillRect(canvasWidth * 0.72, y, canvasWidth * 0.28, 3);
        graphics.fillStyle(0x000000, 0.4);
        graphics.fillRect(0, y + benchHeight - 4, canvasWidth * 0.24, 4);
        graphics.fillRect(canvasWidth * 0.72, y + benchHeight - 4, canvasWidth * 0.28, 4);
    }

    /**
     * Brass on the benches: an optical rail with a lens on the right, a lamp on the left.
     *
     * Two objects, not a clutter of them. The room has to say "optics" in the half-second before the
     * reader's eye goes to the people, and then get out of the way.
     */
    private paintApparatus(
        graphics: Phaser.GameObjects.Graphics,
        canvasWidth: number,
        wallBottom: number,
        floorY: number
    ): void {
        const benchHeight = (floorY - wallBottom) * 0.30;
        const benchTop = wallBottom - (benchHeight * 0.25);
        const unit = Math.max(6, benchHeight * 0.42);

        // The rail and its lens, on the right-hand bench.
        const railX = canvasWidth * 0.78;
        graphics.fillStyle(BRASS, 1);
        graphics.fillRect(railX, benchTop - (unit * 0.28), unit * 3.4, unit * 0.28);
        graphics.fillRect(railX + (unit * 0.5), benchTop - (unit * 1.5), unit * 0.5, unit * 1.25);
        graphics.fillRect(railX + (unit * 2.3), benchTop - (unit * 1.5), unit * 0.5, unit * 1.25);
        graphics.fillStyle(BRASS_LIT, 1);
        graphics.fillRect(railX, benchTop - (unit * 0.28), unit * 3.4, 2);
        // The lens in its mount, catching the window light.
        graphics.fillStyle(WINDOW_GLAZE, 0.75);
        graphics.fillCircle(railX + (unit * 1.5), benchTop - (unit * 1.15), unit * 0.52);
        graphics.fillStyle(BRASS_LIT, 1);
        graphics.fillCircle(railX + (unit * 1.5), benchTop - (unit * 1.15), unit * 0.2);

        // The lamp on the left bench: the one warm source in the room.
        const lampX = canvasWidth * 0.13;
        graphics.fillStyle(BRASS, 1);
        graphics.fillRect(lampX - (unit * 0.28), benchTop - (unit * 1.2), unit * 0.56, unit * 1.2);
        graphics.fillRect(lampX - (unit * 0.6), benchTop - (unit * 0.12), unit * 1.2, unit * 0.12);
        graphics.fillStyle(LAMPLIGHT, 0.95);
        graphics.fillCircle(lampX, benchTop - (unit * 1.45), unit * 0.34);
        graphics.fillStyle(LAMPLIGHT, 0.22);
        graphics.fillCircle(lampX, benchTop - (unit * 1.45), unit * 0.72);
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
     * Darkens the edges so the room has corners, and the bottom hardest of all.
     *
     * The bottom ramp is doing a second job: it is what the proposal cards sit against, so the room
     * fades into the band below it instead of ending at a hard line across the middle of the surface.
     */
    private paintVignette(
        graphics: Phaser.GameObjects.Graphics,
        canvasWidth: number,
        top: number,
        floorY: number
    ): void {
        const height = floorY - top;
        const STEPS = 22;
        const horizontal = canvasWidth * 0.2;
        const vertical = height * 0.26;
        for (let step = 0; step < STEPS; step += 1) {
            const depth = 1 - (step / STEPS);
            const bandWidth = (horizontal / STEPS) + 1;
            const bandHeight = (vertical / STEPS) + 1;
            graphics.fillStyle(0x000000, 0.07 * depth);
            graphics.fillRect(step * (horizontal / STEPS), top, bandWidth, height);
            graphics.fillRect(canvasWidth - (step * (horizontal / STEPS)) - bandWidth, top, bandWidth, height);
            graphics.fillRect(0, top + (step * (vertical / STEPS)), canvasWidth, bandHeight);
            graphics.fillStyle(0x000000, 0.11 * depth);
            graphics.fillRect(0, floorY - (step * (vertical / STEPS)) - bandHeight, canvasWidth, bandHeight);
        }
    }
}
