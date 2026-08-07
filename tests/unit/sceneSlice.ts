import type { Scene } from 'phaser';

/**
 * The structural slice of a Phaser scene the laboratory's renderers actually use, shared by the two
 * unit tests that drive them (Story 2.10).
 *
 * A real `Phaser.Game` cannot be constructed in Vitest — Phaser touches `window` at import time and
 * there is no canvas — and it is not what is under test. `SceneRouterTarget` established this pattern
 * and `CharacterStage.test.ts` follows it; this is the same idea for a renderer that builds text,
 * graphics, rectangles and zones and listens on `events`, `input` and `input.keyboard`.
 *
 * It lives beside the tests rather than inside one because both `ApparatusRun.test.ts` and
 * `NotebookRenderer.test.ts` need it, and two copies of a fake are two chances for one to drift into
 * answering differently from the other — which is the same argument `canvasHelpers.ts` was created on.
 *
 * **Deliberately permissive.** Any setter the renderers call returns the object so the chain keeps
 * going, and only the handful a test actually asks about — text, visibility, alpha, destruction — are
 * recorded. A fake that had to enumerate every Phaser setter would break on any drawing change while
 * saying nothing about the behaviour under test.
 */

export type DrawnObject = Readonly<{
    kind: string;
    /** Mutable on purpose: the fake writes these, and a test reads them after the fact. */
    state: { alpha: number; visible: boolean; destroyed: boolean; text: string };
    /**
     * The pointer handlers the renderer attached to this object, so a test can press a control the
     * way a player does rather than reaching past it into the renderer's private methods.
     */
    handlers: Map<string, (...args: unknown[]) => void>;
}>;

type Chainable = Record<string, (...args: unknown[]) => unknown>;

const makeObject = (kind: string, log: DrawnObject[]) => {
    const state = { alpha: 1, visible: true, destroyed: false, text: '' };
    const handlers = new Map<string, (...args: unknown[]) => void>();
    log.push({ kind, state, handlers });
    const self: Chainable & { context: { measureText: (value: string) => { width: number } }; height: number; x: number; y: number } = {
        // Enough of a text metrics API for a caret to be placed. Seven pixels a character is not real,
        // and nothing here asserts a pixel — what matters is that the call does not throw.
        context: { measureText: (value: string) => ({ width: value.length * 7 }) },
        height: 18,
        x: 0,
        y: 0,
        // Every recorded setter returns the **proxy**, not this object: Phaser's setters are chainable
        // and the renderers chain them freely, so returning the bare target would break the chain at
        // the first observed call and fail with a missing method rather than an assertion.
        setAlpha: (value) => { state.alpha = value as number; return chain; },
        setVisible: (value) => { state.visible = value as boolean; return chain; },
        setText: (value) => { state.text = String(value); return chain; },
        on: (event, handler) => { handlers.set(event as string, handler as (...args: unknown[]) => void); return chain; },
        destroy: () => { state.destroyed = true; }
    };
    const chain: typeof self = new Proxy(self, {
        get: (target, property) => {
            if (property in target) return (target as Record<string | symbol, unknown>)[property];
            return () => chain;
        }
    });
    return chain;
};

export type SceneSlice = Readonly<{
    scene: Scene;
    drawn: DrawnObject[];
    /** Every `scene.events.on('update')` handler currently registered. */
    updateHandlers: ((time: number, delta: number) => void)[];
    /** Handlers passed to `scene.events.off('update')`, so teardown can be asserted. */
    removedUpdateHandlers: unknown[];
    /** Handlers registered on `scene.input.keyboard`, by event name. */
    keyboardHandlers: Map<string, (event: KeyboardEvent) => void>;
    /** Handlers registered on `scene.input`, by event name. */
    pointerHandlers: Map<string, (...args: unknown[]) => void>;
    keyCaptures: unknown[];
    /** Advances the scene clock by `ms`, in frames the size a 60 FPS machine would deliver. */
    tick: (ms: number) => void;
    /** The text every drawn object currently holds, for asserting what the player reads. */
    texts: () => string[];
    /**
     * Every object carrying a `pointerup` handler, in **creation order**.
     *
     * That order is the renderer's own and is documented where it builds them, so a test can press the
     * third observation row's control rather than calling a private method — which is the difference
     * between testing the surface and testing the code behind it.
     */
    pressable: () => DrawnObject[];
}>;

export const makeSceneSlice = (): SceneSlice => {
    const drawn: DrawnObject[] = [];
    const updateHandlers: ((time: number, delta: number) => void)[] = [];
    const removedUpdateHandlers: unknown[] = [];
    const keyboardHandlers = new Map<string, (event: KeyboardEvent) => void>();
    const pointerHandlers = new Map<string, (...args: unknown[]) => void>();
    const keyCaptures: unknown[] = [];

    const scene = {
        scale: { width: 1024, height: 768 },
        add: {
            text: () => makeObject('text', drawn),
            graphics: () => makeObject('graphics', drawn),
            circle: () => makeObject('circle', drawn),
            rectangle: () => makeObject('rectangle', drawn),
            zone: () => makeObject('zone', drawn)
        },
        events: {
            on: (event: string, handler: (time: number, delta: number) => void) => {
                if (event === 'update') updateHandlers.push(handler);
            },
            off: (event: string, handler: unknown) => {
                if (event !== 'update') return;
                removedUpdateHandlers.push(handler);
                const index = updateHandlers.indexOf(handler as (time: number, delta: number) => void);
                if (index >= 0) updateHandlers.splice(index, 1);
            }
        },
        input: {
            on: (event: string, handler: (...args: unknown[]) => void) => { pointerHandlers.set(event, handler); },
            off: (event: string) => { pointerHandlers.delete(event); },
            keyboard: {
                on: (event: string, handler: (keyEvent: KeyboardEvent) => void) => { keyboardHandlers.set(event, handler); },
                off: (event: string) => { keyboardHandlers.delete(event); },
                addCapture: (keys: unknown) => { keyCaptures.push(keys); },
                removeCapture: () => undefined
            }
        },
        tweens: { add: () => undefined, killTweensOf: () => undefined },
        time: { now: 0 }
    } as unknown as Scene;

    return {
        scene,
        drawn,
        updateHandlers,
        removedUpdateHandlers,
        keyboardHandlers,
        pointerHandlers,
        keyCaptures,
        tick: (ms: number) => {
            let remaining = ms;
            while (remaining > 0 && updateHandlers.length > 0) {
                const delta = Math.min(16, remaining);
                remaining -= delta;
                [...updateHandlers].forEach((handler) => handler(0, delta));
            }
        },
        texts: () => drawn.map(({ state }) => state.text).filter((text) => text.length > 0),
        pressable: () => drawn.filter(({ handlers }) => handlers.has('pointerup'))
    };
};

/**
 * The two `window` properties these renderers read, and nothing else.
 *
 * `uiTextStyle` caps text resolution at `min(devicePixelRatio, 2)` and every animated renderer holds a
 * `matchMedia` query from construction. `matches` is a **getter**, as it is on a real
 * `MediaQueryList`: a frozen value could never report the change the `change` listener fires about,
 * and the runtime-toggle test would pass for the wrong reason.
 */
export type MediaStub = Readonly<{
    window: Record<string, unknown>;
    listeners: () => (() => void)[];
    setReducedMotion: (value: boolean) => void;
    setNarrowViewport: (value: boolean) => void;
}>;

export const makeWindowStub = (): MediaStub => {
    let listeners: (() => void)[] = [];
    let prefersReduce = false;
    let narrowViewport = false;
    return {
        window: {
            devicePixelRatio: 1,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            matchMedia: (query: string) => ({
                get matches() {
                    return query.includes('reduce') ? prefersReduce : narrowViewport;
                },
                addEventListener: (_event: string, handler: () => void) => { listeners.push(handler); },
                removeEventListener: (_event: string, handler: () => void) => {
                    listeners = listeners.filter((registered) => registered !== handler);
                }
            })
        },
        listeners: () => listeners,
        setReducedMotion: (value: boolean) => { prefersReduce = value; },
        setNarrowViewport: (value: boolean) => { narrowViewport = value; }
    };
};
