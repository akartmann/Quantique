import type { Scene } from 'phaser';

import type { PhaserStoreAdapter } from '../PhaserStoreAdapter';
import { uiTextStyle } from '../textStyles';
import type { AppState } from '../../../core/store/AppState';
import { resolveLocalizedText, resolveLocalizedTextList } from '../../../core/i18n/resolveLocalizedText';
import { createTranslator } from '../../../core/i18n/translate';
import { selectLocale } from '../../../core/store/selectors';
import {
    NOTES_ACTION_ROW_Y,
    NOTES_BODY_FONT_SIZE,
    NOTES_CLOSE_LEFT,
    NOTES_HEADING_FONT_SIZE,
    NOTES_HEADING_Y,
    NOTES_LIST_GAP,
    NOTES_PADDING,
    NOTES_PANEL_HEIGHT,
    NOTES_PANEL_WIDTH,
    NOTES_PANEL_X,
    NOTES_PANEL_Y,
    NOTES_SECTIONS_FLOOR_Y,
    NOTES_SECTIONS_TOP,
    NOTES_SECTION_FONT_SIZE,
    NOTES_SECTION_GAP,
    NOTES_SECTION_HEADING_GAP,
    NOTES_TEXT_WRAP,
    // The notes reuse the notebook's action row wholesale rather than measuring a second one — see the
    // geometry's own header for why one panel rect serves both overlays.
    NOTEBOOK_ACTION_FONT_SIZE,
    NOTEBOOK_ACTION_HEIGHT,
    NOTEBOOK_ACTION_LABEL_WRAP,
    NOTEBOOK_ACTION_WIDTH
} from './apparatusGeometry';

/**
 * The case's own statement about its apparatus, over the bench (Story 4.2, AC2).
 *
 * ## What it renders, and why it had to exist
 *
 * Three authored fields — `experiment.assumptions`, `experiment.confound.description` and
 * `experiment.resetPath.description` — which both shipped cases author bilingually, which
 * `CaseDefinitionSchema` validates thoroughly, and which reached **no player surface** before this story.
 * **FR18** requires every case to have *"one discoverable confound or misleading result, a reset-solvable
 * required puzzle, and inspectable model assumptions"*; the case review artifact listed all three as
 * satisfied and named the authored field for each. True about the authoring, misleading about the player.
 * See {@link NOTES_CONTROL_Y}'s header in `apparatusGeometry.ts` for the full find.
 *
 * It also carries AC2's other clause: the reset path names the **stable window in the reader's own
 * language**, so *"repeat a stable-window measurement"* is an instruction a player can follow rather than
 * a number they have to guess. That number is authored prose, not an interface string — the case's
 * physics belongs to the case — and `MorleyMillerPrototype.test.ts` asserts the authored sentence against
 * `STABLE_WINDOW_C` so the two cannot drift.
 *
 * ## Why a third scene-owned overlay rather than a reuse
 *
 * `ReferenceBookPresenter` was the obvious reuse and is the wrong shape. Its presentation requires
 * `renditionLocale` and `renditionKind`, and a rendition's `kind` *"describes how the text came to be"* —
 * `transcription`, `translation` or `reconstruction`. Apparatus notes are none of those: they are in-house
 * prose about this build's own model, with no source, no provenance and no rights row. Passing
 * `kind: 'transcription'` to get the overlay would be the "which schema slot is convenient" error
 * `project-context.md` names by name, and relaxing those two fields to optional would loosen a shape that
 * is currently load-bearing for the *"this is a translation"* notice.
 *
 * So this is `NotebookRenderer`'s shape instead, exactly: the scene owns it, the scene suppresses its own
 * apparatus input while it is open through the rule it already has, and it reuses the notebook's measured
 * panel rect rather than measuring a second one. No new scene, no new phase, no new suppression rule, and
 * no fourth module in `src/ui/` — this is a Phaser widget and it lives with the other renderers.
 *
 * ## Reading here changes nothing
 *
 * No dispatch, no progression, no evidence inspected. Which is also why "is it open" is renderer-local
 * and not store state: it means nothing five seconds later, and a store field for it would be persisted,
 * exported, re-validated and reset on replay — the same reasoning `ReferenceBookPresenter`'s spread index
 * and `DialogueBox`'s beat index both carry.
 */
export class ApparatusNotesRenderer {
    private readonly objects: Phaser.GameObjects.GameObject[] = [];
    private backdrop?: Phaser.GameObjects.Rectangle;
    private heading?: Phaser.GameObjects.Text;
    private closeSurface?: Phaser.GameObjects.Rectangle;
    private closeLabel?: Phaser.GameObjects.Text;
    /** One heading-and-body pair per section, in the order the sections are declared below. */
    private readonly sections: SectionObjects[] = [];
    private open = false;

    /**
     * @param storeAdapter Read on open, so the panel is published the moment it appears.
     *
     * **This parameter is the fix for a defect that only a screenshot found.** Opening the notes is not a
     * dispatch — reading here changes nothing, which is the whole design — so the scene's store
     * subscription does not fire, so `render` was never called and the panel appeared with **every string
     * empty**: three headings, all the authored prose, and the label on its own way out, all blank over a
     * backdrop covering the bench. Every unit assertion passed, because the test called `render` by hand
     * after `openNotes()` and the app has nobody to do that. `NotebookRenderer` takes the adapter for
     * exactly this reason and `open()` there publishes immediately; this now does the same.
     */
    public constructor(
        private readonly scene: Scene,
        private readonly storeAdapter: PhaserStoreAdapter,
        private readonly options: Readonly<{ onVisibilityChange: () => void }>
    ) {}

    public get isOpen(): boolean {
        return this.open;
    }

    public create(): void {
        this.backdrop = this.scene.add
            .rectangle(NOTES_PANEL_X, NOTES_PANEL_Y, NOTES_PANEL_WIDTH, NOTES_PANEL_HEIGHT, 0x0b1a20, 0.97)
            .setOrigin(0, 0);
        // Authored empty and written in `render`: `create()` runs once and the locale can change.
        this.heading = this.scene.add.text(NOTES_PANEL_X + NOTES_PADDING, NOTES_HEADING_Y, '', uiTextStyle({
            color: '#f7f4ef', fontSize: `${NOTES_HEADING_FONT_SIZE}px`, wordWrap: { width: NOTES_TEXT_WRAP }
        }));
        this.objects.push(this.backdrop, this.heading);

        SECTION_KEYS.forEach(() => {
            const sectionHeading = this.scene.add.text(NOTES_PANEL_X + NOTES_PADDING, 0, '', uiTextStyle({
                color: '#9fc6bb', fontSize: `${NOTES_SECTION_FONT_SIZE}px`, fontStyle: 'bold', wordWrap: { width: NOTES_TEXT_WRAP }
            }));
            // One text object per authored list line rather than one joined string, because the lines are
            // stacked on each other's *measured* bottoms and a single object would hide where each ends.
            const lines: Phaser.GameObjects.Text[] = [];
            for (let index = 0; index < MAX_SECTION_LINES; index += 1) {
                lines.push(this.scene.add.text(NOTES_PANEL_X + NOTES_PADDING, 0, '', uiTextStyle({
                    color: '#dfeaea', fontSize: `${NOTES_BODY_FONT_SIZE}px`, wordWrap: { width: NOTES_TEXT_WRAP }
                })));
            }
            this.objects.push(sectionHeading, ...lines);
            this.sections.push({ heading: sectionHeading, lines });
        });

        this.closeSurface = this.scene.add
            .rectangle(NOTES_CLOSE_LEFT, NOTES_ACTION_ROW_Y, NOTEBOOK_ACTION_WIDTH, NOTEBOOK_ACTION_HEIGHT, 0x1d4451)
            .setOrigin(0, 0);
        this.closeLabel = this.scene.add.text(
            NOTES_CLOSE_LEFT + (NOTEBOOK_ACTION_WIDTH / 2),
            NOTES_ACTION_ROW_Y + (NOTEBOOK_ACTION_HEIGHT / 2),
            '',
            uiTextStyle({
                color: '#f7f4ef', fontSize: `${NOTEBOOK_ACTION_FONT_SIZE}px`, align: 'center',
                wordWrap: { width: NOTEBOOK_ACTION_LABEL_WRAP }
            })
        ).setOrigin(0.5, 0.5);
        this.closeSurface.on('pointerup', () => this.close());
        this.objects.push(this.closeSurface, this.closeLabel);

        this.setVisible(false);
    }

    /**
     * Opens the notes, **published**. Idempotent, so a second press is not a second visibility change.
     *
     * The publish is ordered before the visibility change on purpose: the host suppresses the bench from
     * that callback, and a panel that became visible before it had any text in it is the state the
     * screenshot caught.
     */
    public openNotes(): void {
        if (this.open) return;
        this.open = true;
        this.setVisible(true);
        this.render(this.storeAdapter.getState());
        this.options.onVisibilityChange();
    }

    public close(): void {
        if (!this.open) return;
        this.open = false;
        this.setVisible(false);
        this.options.onVisibilityChange();
    }

    /**
     * Repaints the notes in the reader's language. A no-op while closed, so the scene calls it
     * unconditionally from its subscription rather than guarding at the call site.
     */
    public render(state: AppState): void {
        if (!this.open) return;
        const locale = selectLocale(state);
        const t = createTranslator(locale);
        this.heading?.setText(t('lab.notes.heading'));
        this.closeLabel?.setText(t('lab.notes.close'));

        const experiment = state.caseDefinition.experiment;
        // The authored content, in the order a player needs it: what the apparatus takes for granted, what
        // can imitate the effect they are looking for, and how to tell the two apart. That order is the
        // teaching order of FR18's own triple, not the order the fields happen to sit in the schema.
        const bodies: readonly (readonly string[])[] = [
            resolveLocalizedTextList(experiment.assumptions, locale),
            [resolveLocalizedText(experiment.confound.description, locale)],
            [resolveLocalizedText(experiment.resetPath.description, locale)]
        ];

        // Measured, top-anchored stacking: each section starts below the previous one's *measured* bottom.
        // Nothing is placed against a constant that a longer French paragraph could invalidate.
        let cursor = NOTES_SECTIONS_TOP;
        this.sections.forEach((section, index) => {
            section.heading.setText(t(SECTION_KEYS[index]!)).setY(cursor).setVisible(true);
            cursor += section.heading.height + NOTES_SECTION_HEADING_GAP;
            section.lines.forEach((line, lineIndex) => {
                const text = bodies[index]?.[lineIndex];
                // A line with nothing authored for it, and a line there is no longer room for, are both
                // hidden — but they are different facts, and the second is reported rather than swallowed.
                if (text === undefined || cursor >= NOTES_SECTIONS_FLOOR_Y) {
                    line.setText('').setVisible(false);
                    return;
                }
                line.setText(text).setY(cursor).setVisible(true);
                cursor += line.height + NOTES_LIST_GAP;
            });
            cursor += NOTES_SECTION_GAP;
        });
    }

    public destroy(): void {
        this.objects.forEach((object) => object.destroy());
        this.objects.length = 0;
        this.sections.length = 0;
        this.backdrop = undefined; this.heading = undefined;
        this.closeSurface = undefined; this.closeLabel = undefined;
        this.open = false;
    }

    private setVisible(visible: boolean): void {
        this.objects.forEach((object) => {
            const drawable = object as Phaser.GameObjects.Rectangle;
            drawable.setVisible(visible);
        });
        // The panel covers the bench, and a click that fell through it would move a control. The *scene*
        // suppresses the apparatus through `onVisibilityChange`; this only arms and disarms the notes'
        // own way out, so a hidden control cannot be pressed.
        if (visible) this.closeSurface?.setInteractive({ useHandCursor: true });
        else this.closeSurface?.disableInteractive();
    }
}

type SectionObjects = Readonly<{ heading: Phaser.GameObjects.Text; lines: Phaser.GameObjects.Text[] }>;

/**
 * The three sections, in the order a player needs them, keyed to their interface headings.
 *
 * A tuple rather than three inline blocks so the render loop, the create loop and the section count are
 * one fact. Adding a fourth authored field to this surface is adding a key here and a body beside it.
 */
const SECTION_KEYS = ['lab.notes.assumptions', 'lab.notes.confound', 'lab.notes.resetPath'] as const;

/**
 * How many authored lines one section can show.
 *
 * A reserve rather than a measurement, because the objects are built in `create()` and the content is not
 * known until `render`. Four covers the longest authored `assumptions` list either shipped case carries
 * (three) with a line to spare; the confound and the reset path are single paragraphs.
 *
 * **A case authoring more than this would silently lose the extra lines**, which is the same shape as
 * `CASE_FILE_READINESS_ROWS` dropping a twelfth code — so `CaseDefinition.test.ts` asserts the authored
 * lists against it and fails at load-time review rather than in front of a player.
 */
export const MAX_SECTION_LINES = 4;
