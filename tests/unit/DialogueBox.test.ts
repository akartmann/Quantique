import type { Scene } from 'phaser';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { DialogueBox, type DialogueBeatView } from '../../src/adapters/phaser/ui/DialogueBox';
import { createTranslator } from '../../src/core/i18n/translate';

/**
 * `DialogueBox`'s reading position, tested without a browser.
 *
 * Vitest has no canvas, so the scene is the **structural slice the widget actually uses** — the pattern
 * `SceneRouterTarget` established: a fake `add` factory returning objects that record what was written
 * to them. Everything under test here (which beat is current, when the conversation restarts, when it
 * completes) is plain state machine, and the 1.12 review found it had no coverage at all: the widget's
 * required idempotence, the conversation key, the shorter-list clamp, and the completion flag were
 * exercised only through a canvas screenshot diff.
 */

type FakeText = {
    text: string;
    y: number;
    alpha: number;
    height: number;
    setText: (value: string) => FakeText;
    setY: (value: number) => FakeText;
    setPosition: () => FakeText;
    setOrigin: () => FakeText;
    setVisible: (visible: boolean) => FakeText;
    setAlpha: (value: number) => FakeText;
    setColor: () => FakeText;
    destroy: () => void;
};

type FakeRect = {
    interactive: boolean;
    fill: number;
    handlers: Record<string, () => void>;
    setOrigin: () => FakeRect;
    setPosition: () => FakeRect;
    setSize: () => FakeRect;
    setFillStyle: (fill: number) => FakeRect;
    setVisible: () => FakeRect;
    setInteractive: () => FakeRect;
    disableInteractive: () => FakeRect;
    on: (event: string, handler: () => void) => FakeRect;
    destroy: () => void;
};

const makeText = (): FakeText => {
    const self: FakeText = {
        text: '', y: 0, alpha: 1,
        // One wrapped line, which is all the arithmetic under test needs — the panel's measured height is
        // a browser concern and is asserted at 1280x720 by the e2e specs instead.
        height: 20,
        setText: (value) => { self.text = value; return self; },
        setY: (value) => { self.y = value; return self; },
        setPosition: () => self,
        setOrigin: () => self,
        setVisible: () => self,
        setAlpha: (value) => { self.alpha = value; return self; },
        setColor: () => self,
        destroy: () => undefined
    };
    return self;
};

const makeRect = (): FakeRect => {
    const self: FakeRect = {
        interactive: false, fill: 0, handlers: {},
        setOrigin: () => self,
        setPosition: () => self,
        setSize: () => self,
        setFillStyle: (fill) => { self.fill = fill; return self; },
        setVisible: () => self,
        setInteractive: () => { self.interactive = true; return self; },
        disableInteractive: () => { self.interactive = false; return self; },
        on: (event, handler) => { self.handlers[event] = handler; return self; },
        destroy: () => undefined
    };
    return self;
};

/** The widget creates its objects in a fixed order; these hold on to the ones the assertions read. */
const mount = (onAdvance?: (index: number) => void) => {
    const texts: FakeText[] = [];
    const rects: FakeRect[] = [];
    const scene = {
        add: {
            text: () => { const t = makeText(); texts.push(t); return t; },
            rectangle: () => { const r = makeRect(); rects.push(r); return r; }
        }
    } as unknown as Scene;

    const box = new DialogueBox(scene, { x: 40, y: 118, width: 944, onAdvance });
    box.create();

    // Creation order in `create()`: panel, speaker, body, counter, control, controlLabel.
    return {
        box,
        speaker: texts[0],
        body: texts[1],
        counter: texts[2],
        control: rects[1],
        controlLabel: texts[3],
        click: () => rects[1].handlers.pointerup?.()
    };
};

/**
 * `uiTextStyle` caps text resolution at `min(devicePixelRatio, 2)`, so building a style touches `window`.
 * That is a rendering concern with no bearing on the reading position under test, and the suite runs on
 * node — so it gets the one property it reads rather than a whole DOM environment.
 */
beforeAll(() => { vi.stubGlobal('window', { devicePixelRatio: 1 }); });
afterAll(() => { vi.unstubAllGlobals(); });

const t = createTranslator('en');

/**
 * `speakerId` is derived from the beat id rather than fixed, so a test can tell one beat's speaker
 * from another's — which is the whole point of the field: the owner reads it to decide which figure to
 * foreground, and a fixture that gave every beat the same speaker could not catch a `getCurrentBeat`
 * that returned the wrong one.
 */
const beats = (...ids: readonly string[]): readonly DialogueBeatView[] =>
    ids.map((id) => ({ id, speakerId: `colleague-${id}`, speaker: `Speaker ${id}`, text: `Line ${id}.` }));

describe('DialogueBox reading position', () => {
    it('opens on the first beat and counts from one', () => {
        const ui = mount();

        ui.box.render(beats('a', 'b', 'c'), t, 'synthesis');

        expect(ui.body.text).toBe('Line a.');
        expect(ui.counter.text).toBe('1 / 3');
        expect(ui.controlLabel.text).toBe('Continue');
    });

    it('advances one beat per click and repaints before reporting', () => {
        const ui = mount();
        ui.box.render(beats('a', 'b', 'c'), t, 'synthesis');

        ui.click();

        // The repaint is the defect this pins: the index moved without the panel redrawing, so the
        // counter stayed at 1 / 3 and the conversation looked frozen.
        expect(ui.body.text).toBe('Line b.');
        expect(ui.counter.text).toBe('2 / 3');
    });

    /** The property the story states most emphatically: the owner re-renders on every notification. */
    it('keeps the reader in place when re-rendered with the same conversation', () => {
        const ui = mount();
        ui.box.render(beats('a', 'b', 'c'), t, 'synthesis');
        ui.click();

        ui.box.render(beats('a', 'b', 'c'), t, 'synthesis');

        expect(ui.counter.text).toBe('2 / 3');
    });

    it('keeps the reader in place across a locale change', () => {
        const ui = mount();
        ui.box.render(beats('a', 'b', 'c'), t, 'synthesis');
        ui.click();

        ui.box.render(beats('a', 'b', 'c'), createTranslator('fr'), 'synthesis');

        expect(ui.counter.text).toBe('2 / 3');
        expect(ui.controlLabel.text).toBe('Continuer');
    });

    /**
     * The 1.12 review finding, directly: keyed on the beat ids this restarts only when the ids differ,
     * and the case schema deliberately permits a beat id to repeat across scenes while `TheoryBoard`
     * hosts two conversations in one scene instance. Reverting `render` to an id-derived key fails here.
     */
    it('restarts the conversation when the phase changes even though the beat ids are identical', () => {
        const ui = mount();
        ui.box.render(beats('intro', 'close'), t, 'synthesis');
        ui.click();
        expect(ui.counter.text).toBe('2 / 2');

        ui.box.render(beats('intro', 'close'), t, 'review');

        expect(ui.counter.text).toBe('1 / 2');
        expect(ui.body.text).toBe('Line intro.');
    });

    it('clamps the index when the same conversation arrives shorter', () => {
        const ui = mount();
        ui.box.render(beats('a', 'b', 'c'), t, 'synthesis');
        ui.click();
        ui.click();
        expect(ui.counter.text).toBe('3 / 3');

        ui.box.render(beats('a'), t, 'synthesis');

        // Never past the end, and never reading `undefined.text`.
        expect(ui.counter.text).toBe('1 / 1');
        expect(ui.body.text).toBe('Line a.');
    });
});

/**
 * The accessor character staging reads (Story 2.9).
 *
 * The reading position is widget-local and deliberately not in the store, so this is the only way an
 * owner can learn *whose* line is showing — and the alternative it exists to prevent is reverse-matching
 * the formatted, localized, degradable `speaker` string back to a cast member.
 *
 * It has to be valid at the two moments the owner uses it: straight after `render()`, and inside
 * `onAdvance`. Both are asserted, along with the two cases where the index moves without a click.
 */
describe('DialogueBox.getCurrentBeat', () => {
    it('reports the beat on screen, and follows the reader', () => {
        const ui = mount();
        ui.box.render(beats('a', 'b', 'c'), t, 'synthesis');
        expect(ui.box.getCurrentBeat()?.speakerId).toBe('colleague-a');

        ui.click();

        expect(ui.box.getCurrentBeat()?.speakerId).toBe('colleague-b');
    });

    /**
     * Read from inside `onAdvance`, which is where `ColleagueRenderer` re-stages from. `advance()`
     * repaints *before* notifying, so the accessor must already be reporting the new beat by then — a
     * callback that saw the old one would foreground the previous speaker on every advance.
     */
    it('already reports the new beat when onAdvance fires', () => {
        const seen: (string | undefined)[] = [];
        const ui = mount(() => seen.push(ui.box.getCurrentBeat()?.speakerId));
        ui.box.render(beats('a', 'b', 'c'), t, 'synthesis');

        ui.click();

        expect(seen).toEqual(['colleague-b']);
    });

    it('resets to the first beat when the conversation changes', () => {
        const ui = mount();
        ui.box.render(beats('intro', 'close'), t, 'synthesis');
        ui.click();
        expect(ui.box.getCurrentBeat()?.speakerId).toBe('colleague-close');

        ui.box.render(beats('intro', 'close'), t, 'review');

        expect(ui.box.getCurrentBeat()?.speakerId).toBe('colleague-intro');
    });

    it('follows the defensive clamp when the same conversation arrives shorter', () => {
        const ui = mount();
        ui.box.render(beats('a', 'b', 'c'), t, 'synthesis');
        ui.click();
        ui.click();

        ui.box.render(beats('a'), t, 'synthesis');

        expect(ui.box.getCurrentBeat()?.speakerId).toBe('colleague-a');
    });

    /** A scene that authors no conversation foregrounds nobody, and the owner has nothing to guard. */
    it('reports nothing when no conversation is authored', () => {
        const ui = mount();
        ui.box.render([], t, 'context');

        expect(ui.box.getCurrentBeat()).toBeUndefined();
    });
});

describe('DialogueBox completion', () => {
    it('labels the last beat as the end while it is still being read', () => {
        const ui = mount();
        ui.box.render(beats('a', 'b'), t, 'synthesis');

        ui.click();

        expect(ui.counter.text).toBe('2 / 2');
        expect(ui.controlLabel.text).toBe('End of conversation');
        // Still readable and still live: arriving at the last line is not finishing it.
        expect(ui.box.isComplete()).toBe(false);
        expect(ui.control.interactive).toBe(true);
    });

    /**
     * A one-beat conversation is where this went wrong: keyed on "showing the last beat", the end state
     * was painted before the reader had clicked anything and the click that completed it produced a
     * pixel-identical frame — a hand cursor over a control with no response.
     */
    it('responds observably to the click that completes a single-beat conversation', () => {
        const ui = mount();
        ui.box.render(beats('only'), t, 'synthesis');

        const fillBefore = ui.control.fill;
        const alphaBefore = ui.controlLabel.alpha;
        expect(ui.box.isComplete()).toBe(false);
        expect(ui.control.interactive).toBe(true);

        ui.click();

        expect(ui.box.isComplete()).toBe(true);
        expect(ui.control.fill).not.toBe(fillBefore);
        expect(ui.controlLabel.alpha).not.toBe(alphaBefore);
        // The control stops inviting a click it can no longer act on.
        expect(ui.control.interactive).toBe(false);
    });

    it('fires onComplete once, however many further clicks arrive', () => {
        let completions = 0;
        const texts: FakeText[] = [];
        const rects: FakeRect[] = [];
        const scene = {
            add: {
                text: () => { const x = makeText(); texts.push(x); return x; },
                rectangle: () => { const r = makeRect(); rects.push(r); return r; }
            }
        } as unknown as Scene;
        const box = new DialogueBox(scene, { x: 40, y: 118, width: 944, onComplete: () => { completions += 1; } });
        box.create();
        box.render(beats('only'), t, 'synthesis');

        rects[1].handlers.pointerup?.();
        rects[1].handlers.pointerup?.();
        rects[1].handlers.pointerup?.();

        expect(completions).toBe(1);
    });

    it('reports complete and takes no vertical space when no conversation is authored', () => {
        const ui = mount();

        ui.box.render([], t, 'context');

        expect(ui.box.isComplete()).toBe(true);
        // The owner lays out exactly as it would with no dialogue box at all.
        expect(ui.box.getBottomY()).toBe(118);
        expect(ui.control.interactive).toBe(false);
    });

    it('restarts as incomplete when a new conversation arrives after one finished', () => {
        const ui = mount();
        ui.box.render(beats('only'), t, 'synthesis');
        ui.click();
        expect(ui.box.isComplete()).toBe(true);

        ui.box.render(beats('a', 'b'), t, 'review');

        expect(ui.box.isComplete()).toBe(false);
        expect(ui.counter.text).toBe('1 / 2');
        expect(ui.control.interactive).toBe(true);
    });
});

describe('DialogueBox input suppression', () => {
    it('drops the advance control while the overlaying reference book is open', () => {
        const ui = mount();
        ui.box.render(beats('a', 'b'), t, 'synthesis');
        expect(ui.control.interactive).toBe(true);

        ui.box.setInputEnabled(false);

        expect(ui.control.interactive).toBe(false);
    });

    /**
     * `ColleaguesScene.create()` calls `setInputEnabled` *before* the first `render`, so a suppressed
     * surface must not be re-enabled by the paint that follows.
     */
    it('stays suppressed across a later render', () => {
        const ui = mount();
        ui.box.setInputEnabled(false);

        ui.box.render(beats('a', 'b'), t, 'synthesis');

        expect(ui.control.interactive).toBe(false);
    });

    it('is inert before create and after destroy', () => {
        const scene = { add: { text: makeText, rectangle: makeRect } } as unknown as Scene;
        const box = new DialogueBox(scene, { x: 40, y: 118, width: 944 });

        // No display objects yet: every path is optional-chained rather than throwing. `create()` runs
        // inside dispatch -> notify, so a throw would advance the phase and break dispatch's contract.
        expect(() => box.render(beats('a'), t, 'synthesis')).not.toThrow();
        expect(() => box.setInputEnabled(false)).not.toThrow();

        box.create();
        box.destroy();

        expect(() => box.render(beats('a'), t, 'synthesis')).not.toThrow();
        expect(() => box.destroy()).not.toThrow();
    });
});
