import type { Scene } from 'phaser';

import { bookTextStyle, uiTextStyle } from '../textStyles';
import {
    FIGURE_BADGE_FONT_SIZE,
    FIGURE_MAX_HEIGHT,
    FIGURE_MAX_WIDTH,
    FIGURE_NAME_FONT_SIZE,
    FIGURE_ROLE_FONT_SIZE,
    FIGURE_SIDE_INSET,
    resolveCharacterStage,
    type CharacterStageInput,
    type StageCastMember,
    type StageFigureSize,
    type StagedFigure
} from './characterStageView';
import { garmentTones, resolveFigureAppearance, shade, type FigureAppearance, type GarmentTones } from './figureAppearance';
import type { Translator } from '../../../core/i18n/translate';

/**
 * The colleagues and the rival, drawn as portrait images or coded vector fallbacks standing in the
 * room (Story 2.9).
 *
 * ## One visual lifecycle
 *
 * The case preloader owns loading. This renderer only creates an `Image` after the named texture is in
 * Phaser's cache; otherwise it paints the authored `Graphics` fallback. Both are held as one visual and
 * receive the same visibility, placement, emphasis, tween killing, rebuild, and destruction operations.
 *
 * ## Five people, not one silhouette recoloured five times
 *
 * The 2026-08-07 design board is the specification for what is drawn here, and it is the third
 * attempt. The first drew 44×78 shoulders-up busts in a margin. The second drew full-length figures,
 * which was the right size but the wrong picture: **one body, tinted per colleague**, which meant a
 * reader who could not distinguish teal from plum could not distinguish Elias Wren from Marianne Cole.
 * AC2 says in as many words that identity must not rest on colour alone, and it was resting on colour
 * alone.
 *
 * A figure is now assembled from an authored {@link FigureAppearance}: a coat and trousers or a
 * bodice and a full skirt, one of five postures, hair cropped or swept or pinned up, and optionally
 * spectacles and a moustache. Take every colour out and Wren is still the one with the clipboard and
 * the glasses, Hart is still the one with his hand out mid-explanation, Bell is still the one standing
 * with his arms folded. The accent survives as the garment because the card stripe and the dialogue
 * speaker name read the same field and all three have to agree.
 *
 * ## Cloth, by four tones of one authored colour
 *
 * A garment painted in a single flat fill is a cut-out whatever shape it is cut into. Each figure is
 * drawn in the four tones {@link garmentTones} derives from its accent — coat, trousers, linen, and a
 * lit edge on the lamp side — so a case that recolours a colleague gets a consistent figure for free
 * and cannot author a highlight darker than its own shadow.
 *
 * ## Built once; emphasis reuses the visual
 *
 * Each portrait or fallback is built in `create()` and never redrawn. `render()` only calls
 * `setScale` / `setAlpha` / `setPosition`, so a beat change costs three property writes per figure and
 * no fill commands at all (D5, and the performance rule about regenerating `Graphics`).
 *
 * ## Motion: tweens only, never an update loop
 *
 * There is **no `update()` here under any condition**, which is what makes AC5's "no update loop
 * registers" true by construction rather than by a flag someone can forget. Emphasis is one short tween
 * per figure; under `prefers-reduced-motion: reduce` the resolver reports a duration of `0` and the
 * targets are written directly, which paints the identical frame the tween would have ended on. The
 * media query is subscribed to so toggling the OS setting takes effect at runtime —
 * `ApparatusRenderer:168-205` is the reference for the cached flag plus the `change` handler.
 */

/** Bell addresses the room from a plinth and gets a frame of his own to do it in. */
export const RIVAL_FIGURE_MAX_WIDTH = 128;
export const RIVAL_FIGURE_MAX_HEIGHT = 380;
/** As a fraction of the figure's height, so the plinth scales with him rather than against him. */
const RIVAL_PLINTH_HEIGHT = 0.055;

/**
 * How the rival is told apart from the cast.
 *
 * Not a colour: AC2's rule that identity must not rest on colour alone applies to the whole surface,
 * and AC4 asks for a rival visually distinct from the four colleagues. Bell is **taller** than any
 * colleague, he stands on a **plinth** to address the room, his coat falls to a **fuller skirt**, and
 * he is authored **arms-folded**, which is the one posture on the stage that reads as judgement rather
 * than work. Four cues, all of them describable without mentioning his colour.
 *
 * The build governs proportion and staging. What he *is* — the folded arms, the grey hair, the
 * moustache — is authored on `rivalLab.figure` exactly as a colleague's is, because there is no reason
 * for a second vocabulary and every reason for the two to stay comparable.
 */
export type CharacterStageBuild = 'colleague' | 'rival';

export type CharacterStageOptions = Readonly<{
    build: CharacterStageBuild;
    /**
     * Makes the visible colleague figures direct-manipulation controls for the owning board.
     *
     * Stages are shared with the rival lab, where people are narrative dressing rather than choices,
     * so this is deliberately opt-in instead of making every rendered person interactive.
     */
    onColleagueActivate?: (colleagueId: string) => void;
    /**
     * Overrides the natural figure size, for a host with more or less room than a board's stage band.
     *
     * Passed **through to the resolver** rather than applied here, and that is load-bearing: the two
     * halves have to agree on one maximum or the figure is placed at one size and drawn at another.
     * Getting that wrong once already drew the rival at 24% of the space he occupied.
     *
     * **It defaults from the build** ({@link figureSizeForBuild}) rather than from the colleague
     * constants, so `build: 'rival'` and the rival's proportions cannot be set independently and then
     * disagree. That was the remaining half of the same defect: the size was made to agree across the
     * resolver/renderer seam, but a caller could still ask for a rival and forget to say how big one
     * is, and the class would have drawn him at a colleague's height on a plinth scaled to it.
     */
    maxFigure?: StageFigureSize;
    nameFontSize?: number;
    roleFontSize?: number;
    badgeFontSize?: number;
}>;

/** The natural size of each build, so `build` alone is enough to place a figure correctly. */
export const figureSizeForBuild = (build: CharacterStageBuild): StageFigureSize => build === 'rival'
    ? { width: RIVAL_FIGURE_MAX_WIDTH, height: RIVAL_FIGURE_MAX_HEIGHT }
    : { width: FIGURE_MAX_WIDTH, height: FIGURE_MAX_HEIGHT };

/** What `render` needs that the resolver does not: the band, the speaker, the cast, and a translator. */
export type CharacterStageRender = Readonly<{
    band: CharacterStageInput['band'];
    area: CharacterStageInput['area'];
    speakerColleagueId?: string;
    selectedColleagueId?: string;
    /**
     * The cast, re-resolved by the owner on every render.
     *
     * It used to be passed once to `create()` and never again, which made two things wrong at once: a
     * locale change left every plaque in the old language, because the role is interface copy that had
     * already been resolved and was never re-set; and a scene hosting two phases — the theory board
     * hosts `synthesis` and `review` — kept the cast it derived at create time, so a beat spoken by
     * somebody outside that set could never be staged.
     *
     * The display objects are still built once and only rebuilt if the *set* of people changes, so the
     * common case is three string writes and no fill commands (2.9 review).
     */
    cast: readonly StageCastMember[];
    /**
     * Writes the one piece of interface copy on this surface: the speaking marker, which is AC2's
     * **label** and the reason the speaker is not identified by scale and colour alone.
     *
     * It was declared and deliberately unused for two revisions, while `stage.speaking` sat authored in
     * both locales and rendered by nothing. Required rather than optional, because a stage that cannot
     * translate is a stage that cannot satisfy AC2.
     */
    t: Translator;
}>;

type Figure = {
    member: StageCastMember;
    visual: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
    visualKind: 'vector' | 'portrait';
    /** A visual must be placed before it can meaningfully animate between emphasis states. */
    isStaged: boolean;
    name: Phaser.GameObjects.Text;
    role: Phaser.GameObjects.Text;
    badge: Phaser.GameObjects.Text;
    /** Transparent, figure-sized hit target. Omitted for inert stages such as the rival lab. */
    activationTarget?: Phaser.GameObjects.Rectangle;
};

/** Shared normalization contract recorded in docs/validation/young-character-assets.md. */
const PORTRAIT_CANVAS_HEIGHT = 768;
const PORTRAIT_FEET_BASELINE = 720;
const PORTRAIT_VISIBLE_HEIGHT = 680;
/** Widest normalized Young subject (Samuel); fitting against it prevents visible neighbour overlap. */
const PORTRAIT_VISIBLE_MAX_WIDTH = 351;

/**
 * The plaque, restyled to the design board: the name in the same amber serif the board sets its
 * cartouches in, the role under it in a muted warm grey so it reads as a caption and not a second name.
 */
const NAME_COLOR = '#e8bc63';
const ROLE_COLOR = '#a89478';
/** The speaking marker, in the lamp's own warm white so it reads as lit rather than as another name. */
const BADGE_COLOR = '#f7f4ef';

const SHADOW = 0x000000;
/** The contact shadow pooled under a figure's feet, which is what puts it *on* the floor. */
const CONTACT_ALPHA = 0.34;
const PLINTH = 0x2a1d1d;
const RIM = 0xffffff;
const RIM_ALPHA = 0.15;
/** Leather, and the dark of a lash — both far enough below the room's floor to read as detail. */
const LEATHER = 0x241a14;
const INK = 0x14100c;
/** Paper under lamplight is warm, never white; a white page out-reads every face on the stage. */
const PAPER = 0xd6c7a6;
/** The lens Thea holds up: glass with a light behind it. */
const GLASS = 0xbfe0e6;

/** The appearance a cast member drawn before this vocabulary existed still gets. */
const FALLBACK_APPEARANCE = resolveFigureAppearance('lead');

/**
 * Writes a string only when it differs from the one already drawn.
 *
 * `Text.setText` re-renders the object's texture whether or not the string changed, and this stage
 * repaints on every store notification and every dialogue advance — so an unconditional write is a
 * dozen texture redraws per dispatch for content that changes on a locale switch and a speaker change
 * and at no other time. The project's performance rule is that a render path allocates nothing and
 * redraws nothing it does not have to.
 */
const setTextIfChanged = (target: Phaser.GameObjects.Text, value: string): void => {
    if (target.text !== value) target.setText(value);
};

export class CharacterStage {
    private readonly figures: Figure[] = [];
    private readonly reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    private motionAllowed = !this.reducedMotionQuery.matches;
    /** The last input, so a media-query change can re-stage without the owner being involved. */
    private lastRender?: CharacterStageRender;
    /** The bound the plaques are currently styled at; see {@link render}. */
    private labelWrapWidth?: number;
    private inputEnabled = true;

    public constructor(
        private readonly scene: Scene,
        private readonly options: CharacterStageOptions
    ) {}

    /** One maximum, read by the renderer and passed to the resolver, defaulted from the build. */
    private get maxFigure(): StageFigureSize {
        return this.options.maxFigure ?? figureSizeForBuild(this.options.build);
    }

    private get maxWidth(): number {
        return this.maxFigure.width;
    }

    private get maxHeight(): number {
        return this.maxFigure.height;
    }

    /**
     * Toggling the OS setting mid-play takes effect: the flag is re-cached and the stage repaints, at
     * a duration of zero if motion has just been switched off.
     */
    private readonly onReducedMotionChange = (): void => {
        this.motionAllowed = !this.reducedMotionQuery.matches;
        if (this.lastRender) this.render(this.lastRender);
    };

    /**
     * Draws one figure per cast member, once, with its plaque.
     *
     * Flat display objects rather than a `Phaser.GameObjects.Container`, for the reason `DialogueBox`'s
     * docstring sets out: a Container declares no hit area of its own and brings a second lifecycle to
     * get right on top of the renderer contract.
     *
     * **Nothing here is made interactive, and nothing here may be.** Phaser hit-tests topmost-first
     * among interactive objects, so an interactive figure over a control would swallow its click — an
     * inert control under a live hand cursor, which is the defect class the 1.12 review found in
     * `DialogueBox`. The figures are scenery that identifies; the cards below are the controls.
     *
     * **Every string is created empty and written in `render`**, like every other surface in this
     * codebase and for the reason every other one states: `create()` runs once and the locale can
     * change at any time. This class used to write the name and the role here, on the argument that the
     * name is a proper noun and the owner rebuilds the stage when the cast changes — the first half is
     * true and the second was not, so a locale change left four plaques reading `Instrument maker`
     * under French copy (2.9 review).
     */
    public create(cast: readonly StageCastMember[]): void {
        this.buildFigures(cast);
        this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);
    }

    /**
     * Builds one visual per cast member. Called by `create`, and again by `render` only when the set of
     * people or a portrait key changes; a fallback rebuild issues fill commands and belongs off the
     * ordinary render path.
     */
    private buildFigures(cast: readonly StageCastMember[]): void {
        this.releaseFigures();
        cast.forEach((member) => {
            const hasPortrait = member.portraitTextureKey !== undefined
                && this.scene.textures?.exists(member.portraitTextureKey) === true;
            const visual = hasPortrait
                ? this.scene.add.image(0, 0, member.portraitTextureKey!).setOrigin(
                    0.5,
                    PORTRAIT_FEET_BASELINE / PORTRAIT_CANVAS_HEIGHT
                )
                : this.scene.add.graphics();
            if (!hasPortrait) {
                this.paintFigure(
                    visual as Phaser.GameObjects.Graphics,
                    member.accentColor,
                    member.appearance ?? FALLBACK_APPEARANCE
                );
            }

            const name = this.scene.add.text(0, 0, '', bookTextStyle({
                color: NAME_COLOR, fontSize: `${this.nameFontSize}px`, align: 'center'
            })).setOrigin(0.5, 0);
            const role = this.scene.add.text(0, 0, '', uiTextStyle({
                color: ROLE_COLOR, fontSize: `${this.roleFontSize}px`, align: 'center'
            })).setOrigin(0.5, 0);
            const badge = this.scene.add.text(0, 0, '', uiTextStyle({
                color: BADGE_COLOR, fontSize: `${this.badgeFontSize}px`, align: 'center'
            })).setOrigin(0.5, 0);

            // The portrait or vector body has no stable Phaser hit shape of its own: a Graphics
            // fallback's bounds depend on its fill commands and an asset portrait includes archival
            // canvas padding. A transparent rectangle follows the resolved visible figure instead.
            const activationTarget = this.options.build !== 'colleague' || this.options.onColleagueActivate === undefined
                ? undefined
                : this.scene.add.rectangle(0, 0, 1, 1, 0xffffff, 0).setOrigin(0.5, 1);
            activationTarget?.on('pointerup', () => {
                if (this.inputEnabled) this.options.onColleagueActivate?.(member.colleagueId);
            });

            this.figures.push({
                member,
                visual,
                visualKind: hasPortrait ? 'portrait' : 'vector',
                isStaged: false,
                name,
                role,
                badge,
                activationTarget
            });
        });
        // A rebuild re-measures at the new slot width, so the cached bound must not suppress it.
        this.labelWrapWidth = undefined;
    }

    /** Whether this stage is already drawing exactly these people, in this order. */
    private stagesSameCast(cast: readonly StageCastMember[]): boolean {
        return cast.length === this.figures.length
            && cast.every((member, index) => this.figures[index]?.member.colleagueId === member.colleagueId
                && this.figures[index]?.member.accentColor === member.accentColor
                && this.figures[index]?.member.portraitTextureKey === member.portraitTextureKey);
    }

    private get nameFontSize(): number {
        return this.options.nameFontSize ?? FIGURE_NAME_FONT_SIZE;
    }

    private get roleFontSize(): number {
        return this.options.roleFontSize ?? FIGURE_ROLE_FONT_SIZE;
    }

    private get badgeFontSize(): number {
        return this.options.badgeFontSize ?? FIGURE_BADGE_FONT_SIZE;
    }

    public render({ band, area, speakerColleagueId, selectedColleagueId, cast, t }: CharacterStageRender): void {
        this.lastRender = { band, area, speakerColleagueId, selectedColleagueId, cast, t };
        // Only when the people or requested portraits changed. A dialogue advance, a selection, a
        // resize and a reduced-motion toggle all land here and none of them is a reason to rebuild.
        if (!this.stagesSameCast(cast)) this.buildFigures(cast);

        const view = resolveCharacterStage({
            cast,
            speakerColleagueId,
            selectedColleagueId,
            band,
            area,
            motionAllowed: this.motionAllowed,
            maxFigure: this.maxFigure,
            nameFontSize: this.nameFontSize,
            roleFontSize: this.roleFontSize,
            badgeFontSize: this.badgeFontSize
        });

        // Applied to every plaque when the bound changes and to none when it has not. `setStyle`
        // rebuilds the text style and re-measures, and a board re-stages on every dialogue advance —
        // but the slot width is a constant per host, so after the first paint this costs nothing. The
        // flag is checked once for the whole stage rather than per figure: checked inside the loop it
        // would latch on the first figure and leave the others unstyled.
        const rewrap = view.figures.length > 0 && this.labelWrapWidth !== view.figures[0]!.labelWrapWidth;
        if (rewrap) this.labelWrapWidth = view.figures[0]!.labelWrapWidth;

        // Whatever the resolver withheld is hidden rather than left wherever it last stood — a stage
        // below the legibility floor shows an empty room, not four dots.
        this.figures.slice(view.figures.length).forEach(({ visual, name, role, badge, activationTarget }) => {
            visual.setVisible(false);
            name.setVisible(false);
            role.setVisible(false);
            badge.setVisible(false);
            activationTarget?.setVisible(false).disableInteractive();
        });

        view.figures.forEach((figure, index) => {
            const target = this.figures[index];
            if (!target) return;
            target.name.setVisible(true);
            target.role.setVisible(true);
            this.applyEmphasis(target, figure, view.transitionMs);

            // Written through the translator, because both are interface-facing: the role is a
            // translated label and the marker is a translated word.
            //
            // **Only when the string actually changed.** `Text.setText` re-renders the object's whole
            // texture, and a board re-stages on every store notification *and* every dialogue advance —
            // so writing three unchanged strings per figure unconditionally put twelve texture redraws
            // on a path that had none, and cost enough wall-clock to push `canvas-transitions` past its
            // timeout under a loaded machine. Guarding the write keeps the locale correct (the whole
            // point of moving these out of `create`) at the cost of a string compare.
            setTextIfChanged(target.name, figure.name);
            setTextIfChanged(target.role, figure.roleLabel);
            target.name.setPosition(figure.labelX, figure.nameY);
            target.role.setPosition(figure.labelX, figure.roleY);

            // **AC2's label.** The speaker is foregrounded by scale and by this word — two signals,
            // neither of which is a colour, so a reader who cannot separate
            // the four accents loses nothing. Its height is reserved on every plaque and its text is
            // written on one, so nothing moves when the speaker changes.
            setTextIfChanged(target.badge, figure.isSpeaker ? t('stage.speaking') : '');
            target.badge.setPosition(figure.labelX, figure.badgeY);
            target.badge.setVisible(figure.isSpeaker);

            this.positionActivationTarget(target, figure);

            // The speaker's plaque comes up to full strength with them; the rest hold at a legible
            // floor rather than fading with the figure. Diegetic never means hidden: a receded
            // colleague is still someone the reader must be able to name (EXPERIENCE.md §HUD).
            target.name.setAlpha(figure.isSpeaker ? 1 : 0.82);
            target.role.setAlpha(figure.isSpeaker ? 0.9 : 0.68);
            if (rewrap) {
                target.name.setStyle({ wordWrap: { width: figure.labelWrapWidth } });
                target.role.setStyle({ wordWrap: { width: figure.labelWrapWidth } });
                target.badge.setStyle({ wordWrap: { width: figure.labelWrapWidth } });
            }
        });
    }

    /** Enables or suppresses optional direct colleague activation with the rest of a board's input. */
    public setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.figures.forEach(({ activationTarget }) => {
            if (!activationTarget) return;
            if (enabled && activationTarget.visible) activationTarget.setInteractive({ useHandCursor: true });
            else activationTarget.disableInteractive();
        });
    }

    /** Keeps the transparent target aligned to the displayed, emphasized figure rather than its slot. */
    private positionActivationTarget(target: Figure, staged: StagedFigure): void {
        const hit = target.activationTarget;
        if (!hit) return;
        const fit = this.figureFit(target, staged);
        const width = target.visualKind === 'portrait' ? PORTRAIT_VISIBLE_MAX_WIDTH : this.maxWidth;
        const height = target.visualKind === 'portrait' ? PORTRAIT_VISIBLE_HEIGHT : this.maxHeight;
        hit.setPosition(staged.x, staged.y - staged.lift)
            .setSize(Math.max(1, width), Math.max(1, height))
            .setScale(fit * staged.scale)
            .setVisible(true);
        if (this.inputEnabled) hit.setInteractive({ useHandCursor: true });
        else hit.disableInteractive();
    }

    /** The target uses the same visible bounds as its figure, including portraits' cropped source canvas. */
    private figureFit(figure: Figure, staged: StagedFigure): number {
        return figure.visualKind === 'portrait'
            ? Math.min(
                Math.max(0, staged.labelWrapWidth - (2 * FIGURE_SIDE_INSET)) / PORTRAIT_VISIBLE_MAX_WIDTH,
                staged.height / PORTRAIT_VISIBLE_HEIGHT
            )
            : Math.min(staged.width / this.maxWidth, staged.height / this.maxHeight);
    }

    /**
     * Moves a figure to its emphasis target, by tween or directly.
     *
     * The band fit and emphasis are one multiplication rather than two transforms. Vector fallbacks
     * retain their existing natural-size fit. Portraits fit their documented visible bounds inside the
     * available slot and height; transparent canvas padding is deliberately not treated as subject.
     *
     * **The figure's own tweens are killed first, on both paths.** A board re-stages on every store
     * notification *and* every dialogue advance, so without this a reader advancing quickly through a
     * conversation stacked several 180ms tweens on the same four properties of the same `Graphics`,
     * each interpolating from a different start toward a different target, and the figures fought
     * rather than moved. The reduced-motion path needs it just as much and for a sharper reason: a
     * tween started before the OS setting was toggled goes on writing to `x`/`y`/`scale`/`alpha` for
     * up to 180ms *after* the reader asked for no motion, painting over the static frame that had just
     * been written (2.9 review).
     */
    private applyEmphasis(figure: Figure, staged: StagedFigure, transitionMs: number): void {
        const fit = this.figureFit(figure, staged);
        const scale = fit * staged.scale;
        const y = staged.y - staged.lift;

        figure.visual.setVisible(true);
        this.scene.tweens.killTweensOf(figure.visual);

        if (transitionMs === 0 || !figure.isStaged) {
            // Reduced motion and a new/rebuilt visual both begin at the resolved target. Starting a
            // tween from Phaser's default coordinates makes a character visibly enter from the canvas
            // origin; only an already staged visual has a meaningful prior emphasis state to animate.
            figure.visual.setPosition(staged.x, y).setScale(scale).setAlpha(staged.alpha);
            figure.isStaged = true;
            return;
        }
        this.scene.tweens.add({
            targets: figure.visual,
            x: staged.x,
            y,
            scale,
            alpha: staged.alpha,
            duration: transitionMs,
            ease: 'Cubic.easeOut'
        });
    }

    /**
     * Releases everything this renderer created — objects, tweens, and the media-query listener.
     *
     * `killTweensOf(this)` is here even though nothing currently tweens the renderer itself. AC6 names
     * that case, and the renderer contract names it, because it is the one the codebase has already
     * been bitten by: a tween whose target is the object being torn down keeps writing to it after
     * `destroy()`. It costs one call and it cannot become wrong.
     */
    public destroy(): void {
        this.reducedMotionQuery.removeEventListener('change', this.onReducedMotionChange);
        this.scene.tweens.killTweensOf(this);
        this.releaseFigures();
        this.lastRender = undefined;
    }

    /** Every display object and tween a figure owns. Shared by `destroy` and by a cast rebuild. */
    private releaseFigures(): void {
        this.figures.forEach(({ visual, name, role, badge, activationTarget }) => {
            this.scene.tweens.killTweensOf(visual);
            this.scene.tweens.killTweensOf(name);
            this.scene.tweens.killTweensOf(role);
            this.scene.tweens.killTweensOf(badge);
            if (activationTarget) this.scene.tweens.killTweensOf(activationTarget);
            visual.destroy();
            name.destroy();
            role.destroy();
            badge.destroy();
            activationTarget?.destroy();
        });
        this.figures.length = 0;
        this.labelWrapWidth = undefined;
    }

    // --- Painting -------------------------------------------------------------------------------

    /**
     * One figure, in local coordinates with the origin at its **feet**.
     *
     * The origin matters: `setScale` scales a `Graphics` about its position, so a figure anchored at
     * its base grows upward out of the floor when it is foregrounded, and every figure shares one
     * floor line whatever its height.
     *
     * Built from `fillRect` / `fillCircle` / `fillTriangle`, plus `strokeCircle` for a pair of
     * spectacles — the same primitives `ReadingRoomDecor` and `LibraryRenderer` draw with. `fillPoints`
     * would express a coat's outline in one call, but its typings take `Phaser.Math.Vector2[]`, and
     * reaching them needs a *value* import of Phaser, which is the thing every module in this folder is
     * arranged to avoid.
     *
     * Painted back to front, the way the body occludes itself: the shadow pooled on the floor, the
     * plinth if there is one, the skirt or trousers, the torso, then whichever arms the pose calls for,
     * and the head last because the collar has to sit under the chin.
     */
    private paintFigure(
        graphics: Phaser.GameObjects.Graphics,
        accentColor: number,
        appearance: FigureAppearance
    ): void {
        const isRival = this.options.build === 'rival';
        const tones = garmentTones(accentColor);
        // Everything above the plinth, so Bell's own floor is that much above the figure's base.
        const floor = isRival ? -(RIVAL_PLINTH_HEIGHT * this.maxHeight) : 0;
        const body = this.metrics(appearance, floor, isRival);

        this.paintContactShadow(graphics);
        if (isRival) this.paintPlinth(graphics);

        if (appearance.build === 'gowned') this.paintSkirt(graphics, tones, body);
        else this.paintTrousers(graphics, tones, body);

        this.paintTorso(graphics, tones, body, appearance.skinTone);
        this.paintArms(graphics, tones, body, appearance);
        this.paintHead(graphics, tones, body, appearance);
    }

    /**
     * Every measurement one figure is built from, derived once.
     *
     * Derived rather than restated per shape because the parts have to meet: an arm computed from one
     * shoulder line and a sleeve computed from another leaves a gap at the elbow, and that is the class
     * of defect that already put a rim light in the air beside the rival's waist.
     *
     * The proportions are the classical ones — the head is about an eighth of the height, the shoulders
     * about two and a half head-widths — because an earlier pass got them exactly wrong and drew a head
     * wider than the shoulders it sat on.
     */
    private metrics(appearance: FigureAppearance, floor: number, isRival: boolean): FigureMetrics {
        const width = this.maxWidth;
        const height = this.maxHeight;
        const gowned = appearance.build === 'gowned';
        // Deliberately larger than the classical eighth-of-the-height head.
        //
        // A board's band gives a colleague around 130px, not the full 230 the figure is stroked at, and
        // at that size a correctly-proportioned head is 16px across — too small to carry hair, a pair of
        // spectacles or a moustache, which is to say too small to carry the identity the whole revision
        // is for. Nudging it up to a sixth is the same stylization the reference art uses, and it is
        // what keeps the face legible at the size the surface actually renders.
        const headRadius = height * (isRival ? 0.058 : 0.064);
        const headY = floor - height * (isRival ? 0.845 : 0.925) + headRadius;
        // The jaw reaches about 1.25 head-radii below the head's centre, so this leaves half a radius of
        // neck. At 2.05 it left four fifths of one, and every figure came out craning.
        const shoulderY = headY + (headRadius * 1.78);

        return {
            width,
            height,
            gowned,
            isRival,
            floor,
            headRadius,
            headY,
            shoulderY,
            // Narrower than the first pass, which set the yoke at 0.40 and let the chest taper away
            // from it: that put a hard horizontal edge four-fifths of the figure's width across the top
            // of a much narrower body, and every colleague came out with wings.
            shoulderHalf: width * (gowned ? 0.30 : 0.35),
            waistY: floor - (height * (gowned ? 0.50 : isRival ? 0.44 : 0.46)),
            waistHalf: width * (gowned ? 0.22 : 0.29),
            // The rival's coat is longer than a colleague's, but not floor-length: at 0.10 it stopped
            // just above his plinth and he read as robed rather than as a gentleman in a long frock
            // coat. 0.26 keeps the cue and gives him legs to stand on.
            hemY: floor - (height * (isRival ? 0.26 : 0.38)),
            hemHalf: width * (gowned ? 0.50 : isRival ? 0.48 : 0.37),
            armWidth: width * (gowned ? 0.095 : 0.115)
        };
    }

    /** Grounds the figure. Without it a full-length body reads as hovering over the floorboards. */
    private paintContactShadow(graphics: Phaser.GameObjects.Graphics): void {
        const width = this.maxWidth;
        const STEPS = 5;
        for (let step = STEPS; step > 0; step -= 1) {
            const spread = (width * 0.62) * (step / STEPS);
            graphics.fillStyle(SHADOW, CONTACT_ALPHA / STEPS);
            graphics.fillRect(-spread, -(spread * 0.14), spread * 2, spread * 0.28);
        }
    }

    /** The lectern-height block Bell speaks from — one of the four cues that are not his colour. */
    private paintPlinth(graphics: Phaser.GameObjects.Graphics): void {
        const width = this.maxWidth;
        const height = RIVAL_PLINTH_HEIGHT * this.maxHeight;

        graphics.fillStyle(PLINTH, 1);
        graphics.fillRect(-width * 0.46, -height, width * 0.92, height);
        graphics.fillStyle(RIM, RIM_ALPHA);
        graphics.fillRect(-width * 0.46, -height, width * 0.92, 2);
    }

    /** Trousers to the ankle and a pair of shoes, both a shade below the coat that hangs over them. */
    private paintTrousers(graphics: Phaser.GameObjects.Graphics, tones: GarmentTones, m: FigureMetrics): void {
        const legHalf = m.width * 0.115;
        const ankleY = m.floor - (m.height * 0.028);
        const top = m.waistY;

        graphics.fillStyle(tones.deep, 1);
        graphics.fillRect(-legHalf * 2.1, top, legHalf * 1.85, ankleY - top);
        graphics.fillRect(legHalf * 0.25, top, legHalf * 1.85, ankleY - top);

        graphics.fillStyle(LEATHER, 1);
        graphics.fillRect(-legHalf * 2.3, ankleY, legHalf * 2.2, m.floor - ankleY);
        graphics.fillRect(legHalf * 0.15, ankleY, legHalf * 2.2, m.floor - ankleY);
    }

    /**
     * A full skirt from the waist to the floor, and no visible feet.
     *
     * The single strongest silhouette cue on the stage, and the reason it is authored rather than
     * inferred: a floor-length trapezoid is unmistakable at any size the band allows, right down to the
     * point where the head is only a few pixels across.
     */
    private paintSkirt(graphics: Phaser.GameObjects.Graphics, tones: GarmentTones, m: FigureMetrics): void {
        graphics.fillStyle(tones.deep, 1);
        graphics.fillRect(-m.waistHalf, m.waistY, m.waistHalf * 2, m.floor - m.waistY);
        graphics.fillTriangle(-m.hemHalf, m.floor, -m.waistHalf, m.floor, -m.waistHalf, m.waistY);
        graphics.fillTriangle(m.hemHalf, m.floor, m.waistHalf, m.floor, m.waistHalf, m.waistY);

        // A darker band along the hem, where the skirt gathers and the lamp does not reach.
        graphics.fillStyle(shade(tones.deep, 0.4), 1);
        graphics.fillRect(-m.hemHalf, m.floor - (m.height * 0.016), m.hemHalf * 2, m.height * 0.016);
        // The lit fold down the lamp side, which is what stops the trapezoid reading as a traffic cone.
        graphics.fillStyle(tones.highlight, 0.5);
        graphics.fillTriangle(
            -m.waistHalf * 0.55, m.waistY,
            -m.waistHalf * 0.15, m.waistY,
            -m.hemHalf * 0.62, m.floor
        );
    }

    /**
     * Shoulders, coat or bodice, collar and shirt front.
     *
     * The coat's skirt is drawn here rather than with the trousers because it hangs *over* them: the
     * order of these two calls is the difference between a frock coat and a pair of trousers worn
     * outside it.
     */
    private paintTorso(
        graphics: Phaser.GameObjects.Graphics,
        tones: GarmentTones,
        m: FigureMetrics,
        skinTone: number
    ): void {
        // Read from the metrics, never recovered from them — see {@link FigureMetrics.gowned}. A
        // fuller-hemmed build (a gown, or the rival's long coat) carries a slightly shallower yoke.
        const shoulderDepth = m.height * (m.gowned || m.isRival ? 0.045 : 0.05);
        const chestY = m.shoulderY + shoulderDepth;
        const gowned = m.gowned;

        // The neck, in **skin** — it is a neck. Painted in a shade of the coat it left a dark bar under
        // every chin and the head read as floating a little above the shoulders.
        graphics.fillStyle(shade(skinTone, 0.22), 1);
        graphics.fillRect(-m.width * 0.055, m.headY, m.width * 0.11, m.shoulderY - m.headY + 2);

        graphics.fillStyle(tones.base, 1);
        graphics.fillRect(-m.shoulderHalf, m.shoulderY, m.shoulderHalf * 2, shoulderDepth);
        // Sloped, not square: two triangles off the yoke and a rounded cap at each end, so the line
        // from the neck runs out to the arm the way a shoulder does.
        graphics.fillTriangle(-m.shoulderHalf, m.shoulderY, -m.width * 0.10, m.shoulderY, -m.shoulderHalf, m.shoulderY - (shoulderDepth * 0.5));
        graphics.fillTriangle(m.shoulderHalf, m.shoulderY, m.width * 0.10, m.shoulderY, m.shoulderHalf, m.shoulderY - (shoulderDepth * 0.5));
        // Set **inside** the shoulder line rather than centred on it: centred, each cap added its own
        // radius to the silhouette and the coat came out with puffed sleeves.
        const capRadius = shoulderDepth * 0.45;
        graphics.fillCircle(-m.shoulderHalf + (capRadius * 0.5), m.shoulderY + (shoulderDepth * 0.5), capRadius);
        graphics.fillCircle(m.shoulderHalf - (capRadius * 0.5), m.shoulderY + (shoulderDepth * 0.5), capRadius);
        // The chest, tapering to the waist.
        graphics.fillRect(-m.waistHalf, chestY, m.waistHalf * 2, m.waistY - chestY);
        graphics.fillTriangle(-m.shoulderHalf, chestY, -m.waistHalf, chestY, -m.waistHalf, m.waistY);
        graphics.fillTriangle(m.shoulderHalf, chestY, m.waistHalf, chestY, m.waistHalf, m.waistY);

        if (!gowned) {
            // The coat's skirt, closing over the trousers to the hem.
            graphics.fillRect(-m.waistHalf, m.waistY, m.waistHalf * 2, m.hemY - m.waistY);
            graphics.fillTriangle(-m.hemHalf, m.hemY, -m.waistHalf, m.hemY, -m.waistHalf, m.waistY);
            graphics.fillTriangle(m.hemHalf, m.hemY, m.waistHalf, m.hemY, m.waistHalf, m.waistY);
        }

        // The shirt front between the coat's lapels — a narrow wedge, so it reads as an opening rather
        // than as a stripe painted on the coat.
        graphics.fillStyle(tones.linen, 1);
        graphics.fillTriangle(
            -m.width * 0.055, chestY - (shoulderDepth * 0.4),
            m.width * 0.055, chestY - (shoulderDepth * 0.4),
            0, m.waistY - ((m.waistY - chestY) * 0.25)
        );
        // The collar, standing at the throat as every figure on the board wears one.
        graphics.fillRect(-m.width * 0.085, m.shoulderY - (m.height * 0.014), m.width * 0.17, m.height * 0.018);

        // A cravat, dark against the linen. Reads at a glance as the knot every period collar carries.
        graphics.fillStyle(INK, 0.75);
        graphics.fillTriangle(
            -m.width * 0.035, m.shoulderY + (m.height * 0.006),
            m.width * 0.035, m.shoulderY + (m.height * 0.006),
            0, m.shoulderY + (m.height * 0.055)
        );

        // The lit edge, on the lamp side and following the geometry above rather than guessing at it.
        graphics.fillStyle(tones.highlight, 0.55);
        graphics.fillTriangle(
            -m.shoulderHalf + (m.width * 0.01), chestY,
            -m.shoulderHalf + (m.width * 0.055), chestY,
            -m.waistHalf + (m.width * 0.03), m.waistY
        );
        // The unlit edge, opposite. Together the two turn a flat panel into a torso.
        graphics.fillStyle(shade(tones.base, 0.45), 0.7);
        graphics.fillTriangle(
            m.shoulderHalf - (m.width * 0.01), chestY,
            m.shoulderHalf - (m.width * 0.05), chestY,
            m.waistHalf - (m.width * 0.025), m.waistY
        );
    }

    /**
     * The pose — which is to say the whole of what separates one figure from another once colour is
     * taken away.
     *
     * Each branch draws both arms, rather than a shared pair plus a variation: an arm that is *not*
     * doing the thing has to be somewhere, and "wherever the default left it" is how a raised hand ends
     * up growing out of a hip.
     */
    private paintArms(
        graphics: Phaser.GameObjects.Graphics,
        tones: GarmentTones,
        m: FigureMetrics,
        appearance: FigureAppearance
    ): void {
        const armX = m.shoulderHalf - (m.armWidth * 0.5);
        const armTop = m.shoulderY + (m.height * 0.02);
        const handRadius = m.width * 0.062;
        const cuffHeight = m.height * 0.012;
        const restLength = (m.waistY - armTop) * 1.12;

        const sleeve = (x: number, top: number, length: number): void => {
            graphics.fillStyle(tones.base, 1);
            graphics.fillRect(x - (m.armWidth * 0.5), top, m.armWidth, length);
            graphics.fillStyle(tones.linen, 0.9);
            graphics.fillRect(x - (m.armWidth * 0.5), top + length - cuffHeight, m.armWidth, cuffHeight);
        };
        const hand = (x: number, y: number): void => {
            graphics.fillStyle(appearance.skinTone, 1);
            graphics.fillCircle(x, y, handRadius);
        };
        const hanging = (x: number): void => {
            sleeve(x, armTop, restLength);
            hand(x, armTop + restLength + (handRadius * 0.4));
        };

        switch (appearance.pose) {
            case 'arms-folded': {
                // Two short upper arms, then one bar of forearm across the chest with a hand tucked at
                // each end. The clearest posture on the stage at any size, which is why it is the
                // rival's.
                const foldY = m.shoulderY + ((m.waistY - m.shoulderY) * 0.46);
                sleeve(-armX, armTop, foldY - armTop);
                sleeve(armX, armTop, foldY - armTop);
                graphics.fillStyle(tones.base, 1);
                graphics.fillRect(-m.shoulderHalf * 0.98, foldY, m.shoulderHalf * 1.96, m.armWidth * 1.15);
                graphics.fillStyle(shade(tones.base, 0.35), 0.8);
                graphics.fillRect(-m.shoulderHalf * 0.98, foldY + (m.armWidth * 1.15), m.shoulderHalf * 1.96, m.height * 0.006);
                // Fingers at the ends of the bar, not two discs in the middle of the chest. Folded
                // arms tuck each hand under the opposite elbow, so what shows is small and at the edge;
                // hands at full size sat on the coat like a pair of buttons.
                graphics.fillStyle(appearance.skinTone, 1);
                graphics.fillCircle(-m.shoulderHalf * 0.88, foldY + (m.armWidth * 0.6), handRadius * 0.62);
                graphics.fillCircle(m.shoulderHalf * 0.88, foldY + (m.armWidth * 0.6), handRadius * 0.62);
                break;
            }
            case 'holding-paper': {
                // One arm at rest, one bent to bring a sheet up in front of the waist where the figure
                // can actually read it.
                hanging(-armX);
                const elbowY = m.shoulderY + ((m.waistY - m.shoulderY) * 0.62);
                sleeve(armX, armTop, elbowY - armTop);
                graphics.fillStyle(tones.base, 1);
                graphics.fillRect(-m.width * 0.04, elbowY, armX + (m.width * 0.04), m.armWidth * 0.92);

                const paperWidth = m.width * 0.42;
                const paperHeight = m.height * 0.075;
                const paperY = elbowY - (paperHeight * 0.52);
                graphics.fillStyle(shade(PAPER, 0.55), 1);
                graphics.fillRect(-m.width * 0.24 + 2, paperY + 2, paperWidth, paperHeight);
                graphics.fillStyle(PAPER, 1);
                graphics.fillRect(-m.width * 0.24, paperY, paperWidth, paperHeight);
                graphics.fillStyle(INK, 0.35);
                graphics.fillRect(-m.width * 0.20, paperY + (paperHeight * 0.3), paperWidth * 0.66, m.height * 0.005);
                graphics.fillRect(-m.width * 0.20, paperY + (paperHeight * 0.58), paperWidth * 0.48, m.height * 0.005);
                hand(-m.width * 0.22, paperY + (paperHeight * 0.5));
                break;
            }
            case 'raising-instrument': {
                // One hand up to the light with a lens in it, the other set on the hip — the gesture the
                // board gives Thea Young, and the one that says *this is the person examining the thing*.
                const hipY = m.waistY - (m.height * 0.01);
                const elbowX = m.shoulderHalf + (m.width * 0.16);
                graphics.fillStyle(tones.base, 1);
                graphics.fillTriangle(-armX, armTop, -armX - (m.width * 0.02), armTop, -elbowX, hipY);
                graphics.fillRect(-elbowX, hipY - (m.armWidth * 0.5), m.armWidth, m.armWidth);
                graphics.fillRect(-elbowX, hipY - (m.armWidth * 0.5), elbowX - m.waistHalf, m.armWidth * 0.9);
                hand(-m.waistHalf - (handRadius * 0.4), hipY);

                const raisedTop = m.headY - (m.headRadius * 1.4);
                sleeve(armX + (m.width * 0.02), raisedTop, (armTop + (m.height * 0.02)) - raisedTop);
                graphics.fillStyle(tones.base, 1);
                graphics.fillRect(armX - (m.armWidth * 0.5), armTop, m.armWidth, m.height * 0.03);
                hand(armX + (m.width * 0.02), raisedTop - (handRadius * 0.2));

                graphics.fillStyle(GLASS, 0.45);
                graphics.fillCircle(armX + (m.width * 0.02), raisedTop - (handRadius * 1.5), m.width * 0.085);
                graphics.fillStyle(0xffffff, 0.5);
                graphics.fillCircle(armX - (m.width * 0.01), raisedTop - (handRadius * 1.8), m.width * 0.026);
                break;
            }
            case 'presenting': {
                // One arm out, palm open — Samuel Hart mid-sentence.
                //
                // The forearm goes **out and down** from a bent elbow, not straight out at shoulder
                // height. Level with the shoulder it made a T against the vertical resting arm, and at
                // the size a board's band allows a T does not read as a gesture; it reads as a
                // scarecrow. The drop is what turns the same three rectangles into a hand held out.
                hanging(-armX);
                const elbowY = m.shoulderY + ((m.waistY - m.shoulderY) * 0.42);
                // Well clear of the shoulder. At `0.52 × width` the hand came out barely 13px past the
                // sleeve it grew from — a stub, not a gesture. The figure's slot is three times its
                // width, so there is room for an arm that is actually extended.
                const reachTo = m.width * 0.92;
                const reachY = elbowY + ((m.waistY - m.shoulderY) * 0.22);
                sleeve(armX, armTop, elbowY - armTop);
                graphics.fillStyle(tones.base, 1);
                graphics.fillTriangle(
                    armX - (m.armWidth * 0.5), elbowY,
                    armX + (m.armWidth * 0.5), elbowY,
                    reachTo, reachY + (m.armWidth * 0.9)
                );
                graphics.fillTriangle(
                    armX + (m.armWidth * 0.5), elbowY,
                    reachTo, reachY,
                    reachTo, reachY + (m.armWidth * 0.9)
                );
                hand(reachTo + (handRadius * 0.6), reachY + (m.armWidth * 0.45));
                break;
            }
            default: {
                hanging(-armX);
                hanging(armX);
            }
        }
    }

    /**
     * The head: skin, hair, and the two or three marks that make it a face.
     *
     * Painted last, because the collar has to run under the chin rather than over it. The face is the
     * one thing never drawn in the accent — a head filled with the coat's colour reads as a hood, and
     * that was true of every version before this one.
     */
    private paintHead(
        graphics: Phaser.GameObjects.Graphics,
        tones: GarmentTones,
        m: FigureMetrics,
        appearance: FigureAppearance
    ): void {
        const r = m.headRadius;
        const cy = m.headY;

        // Hair as a skull cap first, with the face laid over it, so the hairline falls where a hairline
        // falls instead of sitting on top of the forehead like a hat.
        graphics.fillStyle(appearance.hairColor, 1);
        graphics.fillCircle(0, cy - (r * 0.14), r * 1.07);
        if (appearance.hair === 'upswept') {
            // The bun, and the volume gathered at the sides to reach it.
            graphics.fillCircle(r * 0.08, cy - (r * 1.28), r * 0.46);
            graphics.fillCircle(0, cy - (r * 0.32), r * 1.14);
        }

        graphics.fillStyle(appearance.skinTone, 1);
        graphics.fillCircle(0, cy, r);
        // The jaw, a touch narrower than the skull.
        graphics.fillCircle(0, cy + (r * 0.42), r * 0.82);

        graphics.fillStyle(appearance.hairColor, 1);
        if (appearance.hair === 'swept') {
            // A fringe combed across the brow — the parting is the whole cue.
            graphics.fillTriangle(
                -r * 0.98, cy - (r * 0.30),
                r * 0.98, cy - (r * 0.66),
                r * 0.98, cy - (r * 0.02)
            );
        } else {
            // Cropped and upswept both keep a straight hairline across the top of the forehead.
            graphics.fillRect(-r * 0.94, cy - (r * 0.86), r * 1.88, r * 0.34);
        }
        // Sideburns: two short strips, which is what keeps a cropped head from reading as a bald one.
        graphics.fillRect(-r * 0.98, cy - (r * 0.5), r * 0.22, r * 0.7);
        graphics.fillRect(r * 0.76, cy - (r * 0.5), r * 0.22, r * 0.7);

        graphics.fillStyle(INK, 0.8);
        graphics.fillCircle(-r * 0.34, cy - (r * 0.02), Math.max(0.8, r * 0.11));
        graphics.fillCircle(r * 0.34, cy - (r * 0.02), Math.max(0.8, r * 0.11));

        if (appearance.moustache) {
            graphics.fillStyle(appearance.hairColor, 1);
            graphics.fillRect(-r * 0.44, cy + (r * 0.34), r * 0.88, Math.max(1, r * 0.18));
        }

        if (appearance.spectacles) {
            const lineWidth = Math.max(1, r * 0.09);
            graphics.lineStyle(lineWidth, INK, 0.85);
            graphics.strokeCircle(-r * 0.34, cy - (r * 0.02), r * 0.30);
            graphics.strokeCircle(r * 0.34, cy - (r * 0.02), r * 0.30);
            graphics.lineBetween(-r * 0.04, cy - (r * 0.02), r * 0.04, cy - (r * 0.02));
        }

        // A warm catch-light on the lamp side of the face, matching the lit edge down the coat.
        graphics.fillStyle(tones.highlight, 0.22);
        graphics.fillCircle(-r * 0.5, cy - (r * 0.3), r * 0.34);
    }
}

/** Every measurement one figure is assembled from. Local coordinates, origin at the feet. */
type FigureMetrics = Readonly<{
    width: number;
    height: number;
    /**
     * The two categorical facts every painter needs, carried rather than recovered.
     *
     * `paintTorso` used to re-derive both from measurements — `waistHalf < width * 0.25` for the build,
     * `hemHalf > width * 0.45` for the shoulder depth — recovering a fact that was known one frame
     * earlier from a coefficient that straddles an unrelated threshold. Widening a gowned figure's waist
     * to a quarter of her width in a tuning pass would have flipped `gowned` to false and painted a
     * frock coat over her skirt, with nothing in the suite to fail (2.9 review).
     */
    gowned: boolean;
    isRival: boolean;
    /** Where this figure's own feet rest — below zero for the rival, who stands on a plinth. */
    floor: number;
    headRadius: number;
    headY: number;
    shoulderY: number;
    shoulderHalf: number;
    waistY: number;
    waistHalf: number;
    /** The bottom of a coat's skirt. Unused by a gowned figure, whose skirt reaches the floor. */
    hemY: number;
    hemHalf: number;
    armWidth: number;
}>;
