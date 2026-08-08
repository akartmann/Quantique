import type { Scene } from 'phaser';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CharacterStage, RIVAL_FIGURE_MAX_HEIGHT, RIVAL_FIGURE_MAX_WIDTH } from '../../src/adapters/phaser/renderers/CharacterStage';
import {
    EMPHASIS_TWEEN_MS,
    FIGURE_MAX_HEIGHT,
    RECEDED_ALPHA,
    SPEAKER_ALPHA,
    SPEAKER_LIFT,
    figureLabelHeight,
    resolveCharacterStage,
    type StageCastMember
} from '../../src/adapters/phaser/renderers/characterStageView';
import { garmentTones, resolveFigureAppearance } from '../../src/adapters/phaser/renderers/figureAppearance';
import { createTranslator } from '../../src/core/i18n/translate';

/**
 * `CharacterStage`'s reduced-motion contract, asserted without a browser (Story 2.9, AC5 and AC7).
 *
 * The scene is the **structural slice the renderer actually uses** — `{ add: { graphics, text } }` and
 * `{ tweens: { add, killTweensOf } }` — which is the pattern `SceneRouterTarget` established and
 * `DialogueBox.test.ts` follows. A real `Phaser.Game` cannot be constructed here and is not what is
 * under test: what is under test is that no tween is started under `reduce`, that the static frame
 * matches the frame the motion path ends on, and that `destroy()` lets go of everything.
 *
 * The media query is stubbed rather than mocked at the module boundary, because the renderer caches
 * `matches` at construction and subscribes to `change` — both of which are the behaviour, not an
 * implementation detail.
 */

type FakeGraphics = {
    x: number; y: number; scale: number; alpha: number; visible: boolean; destroyed: boolean;
    fills: number;
    fillStyle: (color: number, alpha?: number) => FakeGraphics;
    fillRect: () => FakeGraphics;
    fillCircle: () => FakeGraphics;
    fillTriangle: () => FakeGraphics;
    lineStyle: (width: number, color: number, alpha?: number) => FakeGraphics;
    strokeCircle: () => FakeGraphics;
    lineBetween: () => FakeGraphics;
    /**
     * Every drawing command in order, with its colour and its rounded coordinates.
     *
     * A count of fills is not enough to say two figures were drawn differently — two quite different
     * people came out at 44 commands each, and the first version of the AC2 test passed on that
     * coincidence rather than on the pictures. The log is what actually distinguishes them.
     */
    ops: string[];
    setPosition: (x: number, y: number) => FakeGraphics;
    setScale: (value: number) => FakeGraphics;
    setAlpha: (value: number) => FakeGraphics;
    setVisible: (value: boolean) => FakeGraphics;
    destroy: () => void;
};

type FakeText = {
    text: string; x: number; y: number; alpha: number; visible: boolean; destroyed: boolean; wrapWidth?: number;
    setText: (value: string) => FakeText;
    setPosition: (x: number, y: number) => FakeText;
    setAlpha: (value: number) => FakeText;
    setOrigin: () => FakeText;
    setVisible: (value: boolean) => FakeText;
    setStyle: (style: { wordWrap?: { width: number } }) => FakeText;
    destroy: () => void;
};

type FakeImage = {
    textureKey: string;
    x: number; y: number; scaleX: number; scaleY: number; alpha: number; visible: boolean; destroyed: boolean;
    originX: number; originY: number;
    setOrigin: (x: number, y: number) => FakeImage;
    setPosition: (x: number, y: number) => FakeImage;
    setScale: (x: number, y?: number) => FakeImage;
    setAlpha: (value: number) => FakeImage;
    setVisible: (value: boolean) => FakeImage;
    destroy: () => void;
};

type TweenConfig = { targets: unknown; x?: number; y?: number; scale?: number; alpha?: number; duration?: number };

/** Coordinates to the nearest pixel: sub-pixel drift is not a difference anyone can see. */
const round = (args: readonly number[]): string => args.map((value) => Math.round(value)).join(',');

const makeGraphics = (): FakeGraphics => {
    const self: FakeGraphics = {
        x: 0, y: 0, scale: 1, alpha: 1, visible: true, destroyed: false, fills: 0, ops: [],
        fillStyle: (color) => { self.ops.push(`style:${color.toString(16)}`); return self; },
        fillRect: (...args: number[]) => { self.fills += 1; self.ops.push(`rect:${round(args)}`); return self; },
        fillCircle: (...args: number[]) => { self.fills += 1; self.ops.push(`circle:${round(args)}`); return self; },
        fillTriangle: (...args: number[]) => { self.fills += 1; self.ops.push(`tri:${round(args)}`); return self; },
        lineStyle: (_width, color) => { self.ops.push(`line:${color.toString(16)}`); return self; },
        strokeCircle: (...args: number[]) => { self.fills += 1; self.ops.push(`ring:${round(args)}`); return self; },
        lineBetween: (...args: number[]) => { self.fills += 1; self.ops.push(`seg:${round(args)}`); return self; },
        setPosition: (x, y) => { self.x = x; self.y = y; return self; },
        setScale: (value) => { self.scale = value; return self; },
        setAlpha: (value) => { self.alpha = value; return self; },
        setVisible: (value) => { self.visible = value; return self; },
        destroy: () => { self.destroyed = true; }
    };
    return self;
};

const makeText = (initial = ''): FakeText => {
    const self: FakeText = {
        text: initial, x: 0, y: 0, alpha: 1, visible: true, destroyed: false,
        setText: (value) => { self.text = value; return self; },
        setPosition: (x, y) => { self.x = x; self.y = y; return self; },
        setAlpha: (value) => { self.alpha = value; return self; },
        setOrigin: () => self,
        setVisible: (value) => { self.visible = value; return self; },
        setStyle: (style) => { self.wrapWidth = style.wordWrap?.width; return self; },
        destroy: () => { self.destroyed = true; }
    };
    return self;
};

const makeImage = (textureKey: string): FakeImage => {
    const self: FakeImage = {
        textureKey,
        x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1, visible: true, destroyed: false,
        originX: 0.5, originY: 0.5,
        setOrigin: (x, y) => { self.originX = x; self.originY = y; return self; },
        setPosition: (x, y) => { self.x = x; self.y = y; return self; },
        setScale: (x, y = x) => { self.scaleX = x; self.scaleY = y; return self; },
        setAlpha: (value) => { self.alpha = value; return self; },
        setVisible: (value) => { self.visible = value; return self; },
        destroy: () => { self.destroyed = true; }
    };
    return self;
};

const CAST: readonly StageCastMember[] = [
    { colleagueId: 'thea-young', accentColor: 0xc9a227, name: 'Dr. Thea Young', roleLabel: 'Lead' },
    { colleagueId: 'elias-wren', accentColor: 0x4f8a8b, name: 'Elias Wren', roleLabel: 'Instrument maker' }
];

/** A band with room for a full-height figure and its plaque, as the prediction board provides. */
const BAND = { top: 120, height: FIGURE_MAX_HEIGHT + figureLabelHeight() + 20 } as const;
const AREA = { x: 40, width: 944 } as const;
const t = createTranslator('en');
const stage = (
    over: Partial<{ speakerColleagueId: string; selectedColleagueId: string; cast: readonly StageCastMember[] }> = {}
) => ({ band: BAND, area: AREA, cast: CAST, t, ...over });
const RIVAL_CAST: readonly StageCastMember[] = [
    { colleagueId: 'rival-lab', accentColor: 0x8c3b3b, name: 'Mr. Arthur Bell', roleLabel: 'Rival laboratory' }
];

/** Bell's own band, sized from the constants his renderer declares rather than restated here. */
const RIVAL_BAND = { top: 78, height: RIVAL_FIGURE_MAX_HEIGHT + figureLabelHeight() + 20 } as const;

/** The `change` listeners the renderer registered, so a test can toggle the OS setting at runtime. */
let mediaListeners: (() => void)[] = [];
let prefersReduce = false;

const mount = (
    build: 'colleague' | 'rival' = 'colleague',
    loadedTextureKeys: readonly string[] = []
) => {
    const graphics: FakeGraphics[] = [];
    const images: FakeImage[] = [];
    const texts: FakeText[] = [];
    const tweens: TweenConfig[] = [];
    const killed: unknown[] = [];

    const scene = {
        add: {
            graphics: () => { const g = makeGraphics(); graphics.push(g); return g; },
            image: (_x: number, _y: number, textureKey: string) => {
                const sprite = makeImage(textureKey);
                images.push(sprite);
                return sprite;
            },
            text: (_x: number, _y: number, content: string) => { const text = makeText(content); texts.push(text); return text; }
        },
        textures: {
            exists: (textureKey: string) => loadedTextureKeys.includes(textureKey)
        },
        tweens: {
            add: (config: TweenConfig) => { tweens.push(config); return config; },
            killTweensOf: (target: unknown) => { killed.push(target); }
        }
    } as unknown as Scene;

    // **No `maxFigure`, deliberately** — `build` alone must settle the rival's proportions. Passing it
    // here would let the class lose its own default and the suite would never notice, which is half of
    // how the rival came to be drawn at 24% of his space in the first place.
    const subject = new CharacterStage(scene, { build });
    // Creation order per figure: visual, name, role, badge.
    return {
        stage: subject, graphics, images, texts, tweens, killed,
        name: (i: number) => texts[i * 3]!,
        role: (i: number) => texts[(i * 3) + 1]!,
        badge: (i: number) => texts[(i * 3) + 2]!
    };
};

beforeEach(() => {
    mediaListeners = [];
    prefersReduce = false;
    // `uiTextStyle` caps text resolution at `min(devicePixelRatio, 2)`, so building a style touches
    // `window` — it gets the one property it reads rather than a whole DOM environment, as
    // `DialogueBox.test.ts` does.
    vi.stubGlobal('window', {
        devicePixelRatio: 1,
        // `matches` is a **getter**, as it is on a real `MediaQueryList`. Snapshotting it at
        // `matchMedia()` time instead would make the runtime-toggle test unwritable and, worse, would
        // make it pass for the wrong reason: the renderer holds the query object from construction, so
        // a frozen `matches` can never report the change the `change` listener fires about.
        matchMedia: (query: string) => ({
            get matches() { return query.includes('reduce') && prefersReduce; },
            addEventListener: (_event: string, handler: () => void) => { mediaListeners.push(handler); },
            removeEventListener: (_event: string, handler: () => void) => {
                mediaListeners = mediaListeners.filter((listener) => listener !== handler);
            }
        })
    });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('CharacterStage under prefers-reduced-motion: reduce', () => {
    it('starts no tween and writes the targets straight in', () => {
        prefersReduce = true;
        const ui = mount();
        ui.stage.create(CAST);

        ui.stage.render(stage({ speakerColleagueId: 'thea-young' }));

        // The assertion AC5 actually names. A renderer that tweened here would paint a moving frame on
        // a machine whose owner asked for none.
        expect(ui.tweens).toHaveLength(0);
        expect(ui.graphics[0]!.alpha).toBe(SPEAKER_ALPHA);
        expect(ui.graphics[1]!.alpha).toBe(RECEDED_ALPHA);
    });

    /**
     * First paint is already the final frame. A new visual that starts at Phaser's default origin and
     * only names this target in a tween enters the room from the upper-right before the tween finishes.
     */
    it('writes a new visual directly to the normal-motion target before later emphasis tweens', () => {
        prefersReduce = true;
        const still = mount();
        still.stage.create(CAST);
        still.stage.render(stage({ speakerColleagueId: 'thea-young' }));

        prefersReduce = false;
        const moving = mount();
        moving.stage.create(CAST);
        moving.stage.render(stage({ speakerColleagueId: 'thea-young' }));

        expect(moving.tweens).toHaveLength(0);
        moving.graphics.forEach((visual, index) => {
            expect(visual.x).toBe(still.graphics[index]!.x);
            expect(visual.y).toBe(still.graphics[index]!.y);
            expect(visual.scale).toBeCloseTo(still.graphics[index]!.scale, 10);
            expect(visual.alpha).toBe(still.graphics[index]!.alpha);
        });

        moving.stage.render(stage({ speakerColleagueId: 'elias-wren' }));

        expect(moving.tweens).toHaveLength(2);
        moving.tweens.forEach((tween, index) => {
            expect(tween.duration).toBe(EMPHASIS_TWEEN_MS);
            expect(tween.targets).toBe(moving.graphics[index]);
        });
    });

    /** Toggling the OS setting mid-play has to take effect — that is what the `change` listener is for. */
    it('re-stages without motion when the setting is turned on at runtime', () => {
        const ui = mount();
        ui.stage.create(CAST);
        ui.stage.render(stage({ speakerColleagueId: 'thea-young' }));
        expect(ui.tweens).toHaveLength(0);

        prefersReduce = true;
        mediaListeners.forEach((listener) => listener());

        // No tween is introduced, and the figures remain at their resolved static targets.
        expect(ui.tweens).toHaveLength(0);
        expect(ui.graphics[0]!.alpha).toBe(SPEAKER_ALPHA);
        expect(ui.graphics[1]!.alpha).toBe(RECEDED_ALPHA);
    });
});

describe('CharacterStage staging', () => {
    const portraitCast = (portraitTextureKey: string): readonly StageCastMember[] => [{
        colleagueId: 'thea-young',
        accentColor: 0xc9a227,
        name: 'Dr. Thea Young',
        roleLabel: 'Lead',
        portraitTextureKey
    }];

    it('creates a loaded portrait at its visible feet baseline with one uniform scale', () => {
        prefersReduce = true;
        const textureKey = 'case:young-interference:thea-young-portrait';
        const cast = portraitCast(textureKey);
        const ui = mount('colleague', [textureKey]);
        ui.stage.create(cast);

        ui.stage.render(stage({ cast, speakerColleagueId: 'thea-young' }));

        expect(ui.images).toHaveLength(1);
        expect(ui.graphics).toHaveLength(0);
        expect(ui.images[0]!.textureKey).toBe(textureKey);
        // The normalized canvas is 768px high and its shared exclusive feet baseline is y=720.
        expect([ui.images[0]!.originX, ui.images[0]!.originY]).toEqual([0.5, 720 / 768]);
        expect(ui.images[0]!.scaleX).toBe(ui.images[0]!.scaleY);
        // The visible subject is 680px high and the full-height colleague slot is 230px high. Canvas
        // padding must not make the person smaller, and independent x/y fitting must not stretch them.
        expect(ui.images[0]!.scaleX).toBeCloseTo(230 / 680, 10);
        expect(ui.images[0]!.y).toBe(resolveCharacterStage({
            cast, speakerColleagueId: 'thea-young', band: BAND, area: AREA, motionAllowed: false
        }).figures[0]!.y - SPEAKER_LIFT);
    });

    it('paints the vector fallback when a named portrait texture is unavailable', () => {
        const textureKey = 'case:young-interference:thea-young-portrait';
        const cast = portraitCast(textureKey);
        const ui = mount();

        expect(() => ui.stage.create(cast)).not.toThrow();

        expect(ui.images).toHaveLength(0);
        expect(ui.graphics).toHaveLength(1);
        expect(ui.graphics[0]!.fills).toBeGreaterThan(0);
    });

    it('applies the same reduced-motion visibility and emphasis targets to a portrait', () => {
        prefersReduce = true;
        const textureKey = 'case:young-interference:thea-young-portrait';
        const cast = portraitCast(textureKey);
        const ui = mount('colleague', [textureKey]);
        ui.stage.create(cast);

        ui.stage.render(stage({ cast, speakerColleagueId: 'thea-young' }));
        expect(ui.tweens).toHaveLength(0);
        expect(ui.images[0]!.alpha).toBe(SPEAKER_ALPHA);

        ui.stage.render({ band: { top: 120, height: 50 }, area: AREA, cast, t });
        expect(ui.images[0]!.visible).toBe(false);
    });

    it('stages a new portrait at the normal-motion target before later emphasis tweens', () => {
        const textureKey = 'case:young-interference:thea-young-portrait';
        const cast = portraitCast(textureKey);

        prefersReduce = true;
        const still = mount('colleague', [textureKey]);
        still.stage.create(cast);
        still.stage.render(stage({ cast, speakerColleagueId: 'thea-young' }));

        prefersReduce = false;
        const moving = mount('colleague', [textureKey]);
        moving.stage.create(cast);
        moving.stage.render(stage({ cast, speakerColleagueId: 'thea-young' }));

        expect(moving.tweens).toHaveLength(0);
        expect(moving.images[0]).toMatchObject({
            x: still.images[0]!.x,
            y: still.images[0]!.y,
            scaleX: still.images[0]!.scaleX,
            scaleY: still.images[0]!.scaleY,
            alpha: still.images[0]!.alpha
        });

        moving.stage.render(stage({ cast }));

        expect(moving.tweens).toHaveLength(1);
        expect(moving.tweens[0]).toMatchObject({ targets: moving.images[0], duration: EMPHASIS_TWEEN_MS });
    });

    it('rebuilds the visual when a cast member portrait texture key changes', () => {
        prefersReduce = true;
        const firstKey = 'case:young-interference:thea-young-portrait';
        const secondKey = 'case:later-case:thea-young-portrait';
        const firstCast = portraitCast(firstKey);
        const secondCast = portraitCast(secondKey);
        const ui = mount('colleague', [firstKey, secondKey]);
        ui.stage.create(firstCast);
        const firstImage = ui.images[0]!;

        ui.stage.render(stage({ cast: secondCast }));

        expect(firstImage.destroyed).toBe(true);
        expect(ui.killed).toContain(firstImage);
        expect(ui.images.map(({ textureKey }) => textureKey)).toEqual([firstKey, secondKey]);
        expect(ui.images[1]!.visible).toBe(true);
    });

    it('lifts the speaker clear of the floor line the others stand on', () => {
        prefersReduce = true;
        const ui = mount();
        ui.stage.create(CAST);

        ui.stage.render(stage({ speakerColleagueId: 'elias-wren' }));

        // Upward, so the speaker's `y` is the smaller of the two by exactly the lift.
        expect(ui.graphics[0]!.y - ui.graphics[1]!.y).toBe(SPEAKER_LIFT);
    });

    /**
     * Every figure carries its name and role permanently — that is AC1, and it is what the row layout
     * bought that the rejected column could not afford. What changes with the speaker is *emphasis*,
     * not whether the reader can name them: a receded colleague is still someone to be identified
     * ("diegetic never means hidden").
     */
    it('names every figure and its role, whoever is speaking', () => {
        prefersReduce = true;
        const ui = mount();
        ui.stage.create(CAST);

        ui.stage.render(stage({ speakerColleagueId: 'thea-young' }));

        expect([ui.name(0).text, ui.role(0).text]).toEqual(['Dr. Thea Young', 'Lead']);
        expect([ui.name(1).text, ui.role(1).text]).toEqual(['Elias Wren', 'Instrument maker']);
        // The speaker's plaque comes up to full strength; the other stays legible rather than fading out.
        expect(ui.name(0).alpha).toBeGreaterThan(ui.name(1).alpha);
        expect(ui.name(1).alpha).toBeGreaterThan(0.5);
    });

    it('moves the emphasis when the speaker changes', () => {
        prefersReduce = true;
        const ui = mount();
        ui.stage.create(CAST);

        ui.stage.render(stage({ speakerColleagueId: 'thea-young' }));
        expect(ui.graphics[0]!.alpha).toBe(SPEAKER_ALPHA);

        ui.stage.render(stage({ speakerColleagueId: 'elias-wren' }));

        expect(ui.graphics[0]!.alpha).toBe(RECEDED_ALPHA);
        expect(ui.graphics[1]!.alpha).toBe(SPEAKER_ALPHA);
    });

    it('foregrounds nobody when the beat names a colleague who is not on stage', () => {
        prefersReduce = true;
        const ui = mount();
        ui.stage.create(CAST);

        ui.stage.render(stage({ speakerColleagueId: 'someone-who-left' }));

        expect(ui.graphics.map(({ alpha }) => alpha)).not.toContain(SPEAKER_ALPHA);
        // And still names them: the plaque is identity, not emphasis.
        expect(ui.name(0).text).toBe('Dr. Thea Young');
    });

    /** Choosing a proposal brings its author forward — AC3's connection, made by acting. */
    it('brings the chosen colleague forward', () => {
        prefersReduce = true;
        const ui = mount();
        ui.stage.create(CAST);

        ui.stage.render(stage({ speakerColleagueId: 'thea-young', selectedColleagueId: 'elias-wren' }));
        const chosenScale = ui.graphics[1]!.scale;

        ui.stage.render(stage({ speakerColleagueId: 'thea-young' }));

        expect(chosenScale).toBeGreaterThan(ui.graphics[1]!.scale);
    });

    it('hides the cast entirely when the band is below the legibility floor', () => {
        prefersReduce = true;
        const ui = mount();
        ui.stage.create(CAST);

        ui.stage.render({ band: { top: 120, height: 50 }, area: AREA, cast: CAST, t });

        expect(ui.graphics.every(({ visible }) => !visible)).toBe(true);
        expect(ui.texts.every(({ visible }) => !visible)).toBe(true);
    });

    /**
     * AC2, asserted the way AC2 is actually worded: **with colour taken away**.
     *
     * Both members here carry the *same* accent, so every garment tone the two figures are painted in
     * is identical and the only thing that can separate them is how they are built and posed. The
     * version this replaces would have failed it — it drew one silhouette per figure and tinted it, so
     * two colleagues sharing an accent were pixel-for-pixel the same person.
     *
     * `fills` is the count of drawing commands and `palette` the colours they were issued in. A gowned
     * figure holding a paper and a suited figure with his arms folded cannot agree on both.
     */
    it('draws two figures differently when only their appearance differs, not their colour', () => {
        prefersReduce = true;
        const ui = mount();
        const accentColor = 0x4f8a8b;
        ui.stage.create([
            {
                colleagueId: 'a', accentColor, name: 'A', roleLabel: 'Analyst',
                appearance: resolveFigureAppearance('analyst', { build: 'gowned', hair: 'upswept', pose: 'holding-paper' })
            },
            {
                colleagueId: 'b', accentColor, name: 'B', roleLabel: 'Lead',
                appearance: resolveFigureAppearance('lead', { build: 'suited', hair: 'cropped', pose: 'arms-folded', spectacles: true })
            }
        ]);

        const [gowned, suited] = ui.graphics;
        // Both are cut from the same cloth — literally: the four tones derived from the shared accent
        // appear in both figures, so nothing about the garment colour can be doing the distinguishing.
        const tones = garmentTones(accentColor);
        Object.values(tones).forEach((tone) => {
            expect(gowned!.ops).toContain(`style:${tone.toString(16)}`);
            expect(suited!.ops).toContain(`style:${tone.toString(16)}`);
        });
        // And yet they are not the same picture.
        expect(gowned!.ops).not.toEqual(suited!.ops);
    });

    /** Spectacles and a moustache are drawn, not merely accepted and dropped on the floor. */
    it('draws the face marks the appearance asks for', () => {
        prefersReduce = true;
        const ui = mount();
        const accentColor = 0xb8653f;
        const plain = { colleagueId: 'a', accentColor, name: 'A', roleLabel: 'Lead', appearance: resolveFigureAppearance('lead') };
        ui.stage.create([
            plain,
            { ...plain, colleagueId: 'b', appearance: resolveFigureAppearance('lead', { spectacles: true, moustache: true }) }
        ]);

        expect(ui.graphics[1]!.fills).toBeGreaterThan(ui.graphics[0]!.fills);
    });

    it('names the rival and his role on his own plaque', () => {
        prefersReduce = true;
        const ui = mount('rival');
        ui.stage.create(RIVAL_CAST);

        ui.stage.render({ band: RIVAL_BAND, area: { x: 784, width: 200 }, speakerColleagueId: 'rival-lab', cast: RIVAL_CAST, t });

        expect([ui.name(0).text, ui.role(0).text]).toEqual(['Mr. Arthur Bell', 'Rival laboratory']);
    });

    /**
     * The size-override regression, from the renderer's side.
     *
     * The renderer strokes its silhouette at `maxFigure` and scales by
     * `min(staged.width / max, staged.height / max)`. If the resolver were still capping at the
     * default 76×230 while the renderer stroked at 128×380, that ratio would come out at ≈0.6 and the
     * rival would be drawn well inside the space he occupies. Asserting the scale is **1** in a band
     * with room to spare is what pins the two maxima to the same number.
     */
    it('draws the rival at full size when his band has room for it', () => {
        prefersReduce = true;
        const ui = mount('rival');
        ui.stage.create(RIVAL_CAST);

        ui.stage.render({ band: RIVAL_BAND, area: { x: 784, width: 200 }, speakerColleagueId: 'rival-lab', cast: RIVAL_CAST, t });

        expect(ui.graphics[0]!.scale).toBe(1);
    });

    it('stages a new rival at his final position without an entrance tween', () => {
        const renderRival = (ui: ReturnType<typeof mount>) => ui.stage.render({
            band: RIVAL_BAND,
            area: { x: 784, width: 200 },
            speakerColleagueId: 'rival-lab',
            cast: RIVAL_CAST,
            t
        });

        prefersReduce = true;
        const still = mount('rival');
        still.stage.create(RIVAL_CAST);
        renderRival(still);

        prefersReduce = false;
        const moving = mount('rival');
        moving.stage.create(RIVAL_CAST);
        renderRival(moving);

        expect(moving.tweens).toHaveLength(0);
        expect(moving.graphics[0]).toMatchObject({
            x: still.graphics[0]!.x,
            y: still.graphics[0]!.y,
            scale: still.graphics[0]!.scale,
            alpha: still.graphics[0]!.alpha
        });
    });

    it('fits Arthur portrait uniformly by width in the rival column', () => {
        prefersReduce = true;
        const textureKey = 'case:young-interference:arthur-bell-portrait';
        const cast: readonly StageCastMember[] = [{ ...RIVAL_CAST[0]!, portraitTextureKey: textureKey }];
        const ui = mount('rival', [textureKey]);
        ui.stage.create(cast);

        ui.stage.render({
            band: RIVAL_BAND,
            area: { x: 784, width: 200 },
            speakerColleagueId: 'rival-lab',
            cast,
            t
        });

        const expectedScale = 180 / 351;
        expect([ui.images[0]!.originX, ui.images[0]!.originY]).toEqual([0.5, 720 / 768]);
        expect(ui.images[0]!.scaleX).toBeCloseTo(expectedScale, 10);
        expect(ui.images[0]!.scaleY).toBeCloseTo(expectedScale, 10);
        expect(680 * ui.images[0]!.scaleY).toBeCloseTo(680 * expectedScale, 10);
    });

    /** Silhouettes are stroked once in `create()` and never redrawn: emphasis reuses the geometry (D5). */
    it('never re-strokes a figure on a re-stage', () => {
        prefersReduce = true;
        const ui = mount();
        ui.stage.create(CAST);
        const afterCreate = ui.graphics.map(({ fills }) => fills);

        expect(afterCreate.every((count) => count > 0)).toBe(true);
        ui.stage.render(stage({ speakerColleagueId: 'thea-young' }));
        ui.stage.render(stage({ speakerColleagueId: 'elias-wren' }));

        expect(ui.graphics.map(({ fills }) => fills)).toEqual(afterCreate);
    });
});

describe('CharacterStage.destroy', () => {
    it('releases a loaded portrait and kills its tweens', () => {
        const textureKey = 'case:young-interference:thea-young-portrait';
        const cast: readonly StageCastMember[] = [{
            colleagueId: 'thea-young', accentColor: 0xc9a227, name: 'Dr. Thea Young', roleLabel: 'Lead', portraitTextureKey: textureKey
        }];
        const ui = mount('colleague', [textureKey]);
        ui.stage.create(cast);
        ui.stage.render(stage({ cast, speakerColleagueId: 'thea-young' }));

        ui.stage.destroy();

        expect(ui.images[0]!.destroyed).toBe(true);
        expect(ui.killed).toContain(ui.images[0]);
    });

    /**
     * AC6 in full: every object, tween and listener, **including tweens whose target is the renderer
     * itself**. That last one is called out because it is the case this codebase has already been
     * bitten by — a tween still writing to an object after it was torn down.
     */
    it('releases every object, tween, and listener it created', () => {
        const ui = mount();
        ui.stage.create(CAST);
        ui.stage.render(stage({ speakerColleagueId: 'thea-young' }));
        expect(mediaListeners).toHaveLength(1);

        ui.stage.destroy();

        expect(mediaListeners).toHaveLength(0);
        expect(ui.graphics.every(({ destroyed }) => destroyed)).toBe(true);
        expect(ui.texts.every(({ destroyed }) => destroyed)).toBe(true);
        // The renderer itself, plus each graphics and each badge.
        expect(ui.killed).toContain(ui.stage);
        ui.graphics.forEach((graphics) => expect(ui.killed).toContain(graphics));
        ui.texts.forEach((text) => expect(ui.killed).toContain(text));
    });

    /** A media-query `change` after teardown must not repaint destroyed objects. */
    it('stops responding to the media query once destroyed', () => {
        const ui = mount();
        ui.stage.create(CAST);
        ui.stage.render(stage({ speakerColleagueId: 'thea-young' }));
        const listeners = [...mediaListeners];

        ui.stage.destroy();
        prefersReduce = true;
        listeners.forEach((listener) => listener());

        expect(ui.graphics.every(({ destroyed }) => destroyed)).toBe(true);
    });
});
