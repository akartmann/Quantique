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
    /**
     * Mutable on purpose: the fake writes these, and a test reads them after the fact.
     *
     * `interactive` is recorded because the bench's whole lock/unlock behaviour is expressed through
     * `setInteractive` / `disableInteractive`, and the permissive proxy below swallowed both — so "the
     * bench is locked" and "the bench is usable" were indistinguishable to every test in this suite.
     * That is what let a run stranded by a mid-flight reduced-motion toggle leave every control dead
     * with an assertion still green (review 2026-08-07).
     */
    state: {
        alpha: number;
        visible: boolean;
        destroyed: boolean;
        text: string;
        interactive: boolean;
        blendMode?: string;
        /**
         * Drawing commands issued since the last `clear()`, which is how "nothing is painted here" is
         * asserted (review 2026-08-07).
         *
         * AC4 says the source is dark, no wavefronts propagate and no pattern is on the screen. Every
         * one of those is a `Graphics` that has been cleared and not refilled — and the permissive proxy
         * swallowed `clear`, `fillStyle`, `fillTriangle` and the rest, so replacing the whole dark branch
         * with `const dark = false` left 982 tests green. Counting the fill and stroke commands makes the
         * unlit bench an assertion instead of a screenshot.
         */
        commands: number;
        clears: number;
    };
    /**
     * The pointer handlers the renderer attached to this object, so a test can press a control the
     * way a player does rather than reaching past it into the renderer's private methods.
     */
    handlers: Map<string, (...args: unknown[]) => void>;
}>;

/**
 * One registration on `scene.input` or `scene.input.keyboard`, kept whole.
 *
 * **Keyed by identity, not by event name** (review 2026-08-07). The fake used to hold one `Map` per
 * target and `set(event, handler)`, so the *second* registration for an event silently replaced the
 * first and `off(event)` deleted whatever was there regardless of which handler or context was passed.
 * Production registers two `keydown` handlers on `scene.input.keyboard` — the bench's and the notebook's
 * — and one `pointermove`, `pointerup` and `pointerupoutside` per instrument on `scene.input`. So the
 * arrangement under test could not be represented, `expect(keyboardHandlers.size).toBe(0)` proved
 * nothing about removal-by-identity, and `ApparatusInstrument`'s scene-level listeners had no coverage
 * at all.
 */
export type SceneListener = Readonly<{ event: string; handler: (...args: never[]) => void; context?: unknown }>;

/** The listeners registered for one event, in registration order. */
const listenersFor = (all: SceneListener[], event: string): SceneListener[] =>
    all.filter((listener) => listener.event === event);

type Chainable = Record<string, (...args: unknown[]) => unknown>;

/**
 * The `Graphics` calls that put ink on the canvas.
 *
 * Enumerated rather than "anything not recognised", so a positioning or styling call (`setPosition`,
 * `setOrigin`, `setDepth`, `setFontSize`) does not read as painting. Anything genuinely new that draws
 * will simply not be counted, which fails an "is painted" assertion rather than passing an "is dark" one
 * — the safe direction for this fake to be wrong in.
 */
const DRAWING_COMMANDS = new Set([
    'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle',
    'fillTriangle', 'strokeTriangle', 'fillEllipse', 'fillRoundedRect', 'strokeRoundedRect',
    'lineBetween', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'strokePath', 'fillPath',
    'fillPoints', 'strokePoints', 'strokeLineShape'
]);

const makeObject = (kind: string, log: DrawnObject[]) => {
    // `interactive` starts false: nothing Phaser creates is interactive until `setInteractive` is called,
    // and starting it true would make a renderer that never armed a control look armed.
    const state = { alpha: 1, visible: true, destroyed: false, text: '', interactive: false, commands: 0, clears: 0 };
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
        setInteractive: () => { state.interactive = true; return chain; },
        disableInteractive: () => { state.interactive = false; return chain; },
        setBlendMode: (value) => { (state as { blendMode?: string }).blendMode = String(value); return chain; },
        // A cleared `Graphics` holds nothing until something is drawn into it again, which is exactly what
        // the bench's unlit state is.
        clear: () => { state.commands = 0; state.clears += 1; return chain; },
        on: (event, handler) => { handlers.set(event as string, handler as (...args: unknown[]) => void); return chain; },
        destroy: () => { state.destroyed = true; }
    };
    const chain: typeof self = new Proxy(self, {
        get: (target, property) => {
            if (property in target) return (target as Record<string | symbol, unknown>)[property];
            if (typeof property === 'string' && DRAWING_COMMANDS.has(property)) {
                return () => { state.commands += 1; return chain; };
            }
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
    /** Every live registration on `scene.input.keyboard`, in order, kept by identity. */
    keyboardListeners: SceneListener[];
    /** Every live registration on `scene.input`, in order, kept by identity. */
    pointerListeners: SceneListener[];
    /** Every keyboard handler currently registered for `event` — more than one is the normal case. */
    keyboardHandlersFor: (event: string) => ((keyEvent: KeyboardEvent) => void)[];
    /** Every pointer handler currently registered for `event`. */
    pointerHandlersFor: (event: string) => ((...args: never[]) => void)[];
    /**
     * The key codes currently captured, as a set rather than a log of `addCapture` calls.
     *
     * Phaser's captures are global and `preventDefault` is driven off this list, so what a test needs to
     * know is whether the capture is *held right now* — not how many times it was taken. The previous
     * append-only log could not tell a capture that had been released from one that had not, and
     * `removeCapture` was a no-op in the fake.
     */
    capturedKeys: () => string[];
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
    /** Every drawn object of one kind, in creation order. */
    ofKind: (kind: string) => DrawnObject[];
}>;

export const makeSceneSlice = (): SceneSlice => {
    const drawn: DrawnObject[] = [];
    const updateHandlers: ((time: number, delta: number) => void)[] = [];
    const removedUpdateHandlers: unknown[] = [];
    const keyboardListeners: SceneListener[] = [];
    const pointerListeners: SceneListener[] = [];
    const captured = new Set<string>();

    /**
     * Removes by (event, handler, context) exactly as Phaser's `EventEmitter.off` does.
     *
     * Removing by event name alone is what made the old fake unable to see a leak: a renderer that
     * removed the *wrong* listener, or that removed one and left its sibling behind, looked identical to
     * one that cleaned up properly.
     */
    const removeListener = (all: SceneListener[], event: string, handler?: unknown, context?: unknown): void => {
        const index = all.findIndex((listener) => listener.event === event
            && (handler === undefined || listener.handler === handler)
            && (context === undefined || listener.context === context));
        if (index >= 0) all.splice(index, 1);
    };

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
            on: (event: string, handler: (...args: never[]) => void, context?: unknown) => {
                pointerListeners.push({ event, handler, context });
            },
            off: (event: string, handler?: unknown, context?: unknown) => {
                removeListener(pointerListeners, event, handler, context);
            },
            keyboard: {
                on: (event: string, handler: (...args: never[]) => void, context?: unknown) => {
                    keyboardListeners.push({ event, handler, context });
                },
                off: (event: string, handler?: unknown, context?: unknown) => {
                    removeListener(keyboardListeners, event, handler, context);
                },
                addCapture: (keys: string[]) => { keys.forEach((key) => captured.add(key)); },
                removeCapture: (keys: string[]) => { keys.forEach((key) => captured.delete(key)); }
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
        keyboardListeners,
        pointerListeners,
        keyboardHandlersFor: (event) => listenersFor(keyboardListeners, event)
            .map(({ handler }) => handler as (keyEvent: KeyboardEvent) => void),
        pointerHandlersFor: (event) => listenersFor(pointerListeners, event).map(({ handler }) => handler),
        capturedKeys: () => [...captured],
        tick: (ms: number) => {
            let remaining = ms;
            while (remaining > 0 && updateHandlers.length > 0) {
                const delta = Math.min(16, remaining);
                remaining -= delta;
                [...updateHandlers].forEach((handler) => handler(0, delta));
            }
        },
        texts: () => drawn.map(({ state }) => state.text).filter((text) => text.length > 0),
        pressable: () => drawn.filter(({ handlers }) => handlers.has('pointerup')),
        ofKind: (kind: string) => drawn.filter((object) => object.kind === kind)
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
