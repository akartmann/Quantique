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
         * What the renderer called this object, when it called it anything.
         *
         * Empty for the objects that do not name themselves, which is most of them: a name is worth
         * setting for a layer a test needs to single out, and clutter everywhere else.
         */
        name: string;
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
        /**
         * The drawing commands issued since the last `clear()`, **by name**, in order.
         *
         * `commands` counts; this says which. Story 3.4 needed the difference: a `dial` that is a knob
         * with a different label and a `dial` that is a closed graduated ring read against a fixed index
         * mark issue the *same number* of commands, so a count could not tell AC3's "genuinely distinct
         * instruments" from three skins. `arc` versus `strokeCircle` can.
         *
         * Names only, not arguments. That is a deliberate floor rather than an oversight: a test
         * asserting coordinates through this fake would be asserting arithmetic, which is the trap
         * `height: 18` already sets in this file. Geometry belongs in `apparatusGeometry.ts` and is
         * asserted there against exported constants.
         */
        commandNames: string[];
        clears: number;
        /**
         * Where the object stands and how far it is turned, from `setPosition`/`setX`/`setY`/
         * `setRotation` (Story 3.4).
         *
         * The permissive proxy used to swallow all four, so an instrument's **moving part was
         * invisible to every test**: a knob whose indicator never rotated and a slider whose thumb
         * never moved read exactly like working ones, and `ApparatusInstrument.paintValue` could have
         * been a no-op under a green suite — the `const dark = false` shape at the instrument layer.
         *
         * Assert that a value *moved* something, not the coordinate it moved to: an exact number here
         * is arithmetic the geometry module already owns and `ApparatusGeometry.test.ts` asserts
         * against its exported constants.
         */
        x: number;
        y: number;
        rotation: number;
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
    const state = { alpha: 1, visible: true, destroyed: false, text: '', interactive: false, name: '', commands: 0, commandNames: [] as string[], clears: 0, x: 0, y: 0, rotation: 0 };
    const handlers = new Map<string, (...args: unknown[]) => void>();
    log.push({ kind, state, handlers });
    const self: Chainable & { context: { measureText: (value: string) => { width: number } }; height: number; x: number; y: number; text: string; rotation?: number } = {
        // Enough of a text metrics API for a caret to be placed. Seven pixels a character is not real,
        // and nothing here asserts a pixel — what matters is that the call does not throw.
        context: { measureText: (value: string) => ({ width: value.length * 7 }) },
        height: 18,
        x: 0,
        y: 0,
        /**
         * The object's **own** `text`, readable, not only recorded (Story 4.2).
         *
         * `state.text` has always been written by `setText`, but the property itself was not — so a read of
         * `label.text` fell through the permissive proxy and returned a **function**. Production code that
         * compares its previous text against its next one therefore saw a function where a string should be,
         * and took the "this changed" branch every time.
         *
         * That is not cosmetic. `AdvanceControl.render` uses exactly that comparison to decide whether its
         * label changed *under the player's cursor*, and arms a lockout when it did — *"a click aimed at the
         * label that was on screen a moment ago is not a click on this one"*. Under the fake the lockout
         * armed on the **first** render, when the real rule is explicitly that it must not
         * (`previous !== ''` is written for exactly that case). So every press of any `AdvanceControl` was
         * silently refused in this harness, and a test pressing one could only ever assert that nothing
         * happened — which reads identically to a dead control. Found while wiring the apparatus-notes
         * control, whose whole job is to respond to a press.
         */
        text: '',
        // Every recorded setter returns the **proxy**, not this object: Phaser's setters are chainable
        // and the renderers chain them freely, so returning the bare target would break the chain at
        // the first observed call and fail with a missing method rather than an assertion.
        setAlpha: (value) => { state.alpha = value as number; return chain; },
        setVisible: (value) => { state.visible = value as boolean; return chain; },
        // Written to the object as well as recorded, for the reason `setRotation` already is: production code
        // reads this back, and a read that misses the target returns a function from the proxy.
        setText: (value) => { self.text = String(value); state.text = self.text; return chain; },
        setInteractive: () => { state.interactive = true; return chain; },
        disableInteractive: () => { state.interactive = false; return chain; },
        setBlendMode: (value) => { (state as { blendMode?: string }).blendMode = String(value); return chain; },
        /**
         * The object's own name, recorded rather than swallowed (Story 4.2).
         *
         * The permissive proxy absorbed `setName`, so the only way for a test to reach a particular
         * `Graphics` was its **index** in creation order — and `ofKind('graphics')[0]` was written down
         * in three places as "the fringe graphics". That held only while the laboratory drew exactly one
         * apparatus. Splitting the tableau out for a second case moved index 0 on the prototype's bench
         * from the fringe field to the temperature bath, and the "the screen is blank until a run is
         * recorded" assertion started reading a bath that is painted whether or not a run exists — a test
         * measuring the wrong object while staying green for the wrong reason, which is the fabricated-index
         * form of the defect this file's own docstrings record four times over.
         *
         * So the load-bearing layers name themselves in `src/`, and a test asks for the one it means.
         */
        setName: (value) => { state.name = String(value); return chain; },
        /**
         * Where the object is and how it is turned, recorded rather than swallowed (Story 3.4).
         *
         * The permissive proxy used to absorb all four of these, so **the moving part of an instrument
         * was invisible**: a knob whose indicator never rotated and a slider whose thumb never moved
         * were indistinguishable from working ones, and `paintValue` could have been a no-op under a
         * green suite. That is the 2.10 `const dark = false` shape at the instrument layer.
         *
         * Positions are design-space numbers the geometry module already owns, so a test asserting an
         * exact coordinate here is asserting arithmetic — assert that it *moved*, and assert *where* in
         * `ApparatusGeometry.test.ts` against the exported constants.
         */
        setPosition: (x, y) => { self.x = x as number; self.y = y as number; state.x = self.x; state.y = self.y; return chain; },
        setX: (value) => { self.x = value as number; state.x = self.x; return chain; },
        setY: (value) => { self.y = value as number; state.y = self.y; return chain; },
        // Written back onto the object as well as recorded, which `setX`/`setY`/`setPosition` above
        // already do. Without it `self.rotation` was never assigned, so the proxy's `if (property in
        // target)` missed and reading `.rotation` off a faked Graphics returned a *function* — any
        // read-modify-write in production (`setRotation(indicator.rotation + delta)`, a nudge, a
        // reduced-motion snap-back) yielded `NaN` under test while behaving correctly in Phaser, and
        // every `toBeCloseTo` on it then failed as an uninformative `NaN`.
        setRotation: (value) => { self.rotation = value as number; state.rotation = self.rotation; return chain; },
        // A cleared `Graphics` holds nothing until something is drawn into it again, which is exactly what
        // the bench's unlit state is.
        clear: () => { state.commands = 0; state.commandNames.length = 0; state.clears += 1; return chain; },
        on: (event, handler) => { handlers.set(event as string, handler as (...args: unknown[]) => void); return chain; },
        destroy: () => { state.destroyed = true; }
    };
    const chain: typeof self = new Proxy(self, {
        get: (target, property) => {
            if (property in target) return (target as Record<string | symbol, unknown>)[property];
            if (typeof property === 'string' && DRAWING_COMMANDS.has(property)) {
                return () => { state.commands += 1; state.commandNames.push(property); return chain; };
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
    /** Every tween config passed to `scene.tweens.add`, so "starts no tween" can actually fail. */
    tweens: unknown[];
    /** Every target passed to `scene.tweens.killTweensOf`, so a release can be proven. */
    killedTweenTargets: unknown[];
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
    /**
     * The one object the renderer gave this name, or `undefined`.
     *
     * The alternative to indexing into {@link ofKind}, and the reason `setName` is recorded at all — see
     * that setter's own header. Deliberately singular: it asserts the name is unique, so two layers
     * claiming one name is a failure here rather than a test silently reading whichever came first.
     */
    named: (name: string) => DrawnObject | undefined;
}>;

export const makeSceneSlice = (): SceneSlice => {
    const drawn: DrawnObject[] = [];
    const updateHandlers: ((time: number, delta: number) => void)[] = [];
    const tweens: unknown[] = [];
    const killedTweenTargets: unknown[] = [];
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
        tweens: {
            /**
             * **Recorded, not swallowed.** Both new 2.11 renderers ship a test named "registers no
             * update loop and starts no tween" that asserted only the update handlers, because this
             * stub returned `undefined` and kept nothing — so the tween half of the claim was
             * unfalsifiable and the Dev Agent Record's "asserted directly" was not true of it
             * (2.11 review). The harness being the blind spot is the 2.10 finding, one field along.
             */
            add: (config: unknown) => { tweens.push(config); return undefined; },
            killTweensOf: (target: unknown) => { killedTweenTargets.push(target); return undefined; }
        },
        time: { now: 0 }
    } as unknown as Scene;

    return {
        scene,
        drawn,
        tweens,
        killedTweenTargets,
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
        ofKind: (kind: string) => drawn.filter((object) => object.kind === kind),
        named: (name: string) => {
            const matches = drawn.filter((object) => object.state.name === name);
            if (matches.length > 1) throw new Error(`More than one drawn object is named "${name}"`);
            return matches[0];
        }
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
