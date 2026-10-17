import { SYSTEM_ID } from "../config.mjs";
import { addTrait, setActiveCard, amendScene } from "../cards.mjs";
import { locationsOf, locationOptions } from "../scene.mjs";
import { repaintCard } from "../card-art.mjs";
import * as docket from "../docket.mjs";
import * as proceedings from "../proceedings.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * A Scene Card. The GM edits everything. Players see the card and its Traits, and can add a Trait
 * by spending a Stamp. Traits are just Traits: a phrase and an optional note.
 */
export default class CardSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** Traits the viewer has expanded, so a re-render does not fold them shut mid-edit. */
  #open = new Set();

  static DEFAULT_OPTIONS = {
    classes: ["cantica", "sheet", "card"],
    position: { width: 560, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      addTrait: CardSheet.#onAddTrait,
      deleteTrait: CardSheet.#onDeleteTrait,
      setActive: CardSheet.#onSetActive,
      openCard: CardSheet.#onOpenCard,
      amend: CardSheet.#onAmend,
      repaintToken: CardSheet.#onRepaintToken,
      openDocket: CardSheet.#onOpenDocket,
      closeDocket: CardSheet.#onCloseDocket,
      docketAdjust: CardSheet.#onDocketAdjust,
      docketRound: CardSheet.#onDocketRound,
      docketPush: CardSheet.#onDocketPush,
      docketSize: CardSheet.#onDocketSize,
      openProceedings: CardSheet.#onOpenProceedings,
      closeProceedings: CardSheet.#onCloseProceedings,
      removeResult: CardSheet.#onRemoveResult
    }
  };

  static PARTS = {
    sheet: { template: `systems/${SYSTEM_ID}/templates/actor/card.hbs`, scrollable: [".cantica-body"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isGM = game.user.isGM;
    const system = this.actor.system;

    context.actor = this.actor;
    context.system = system;
    context.isGM = isGM;
    context.editable = isGM && this.isEditable;

    // The Docket, for the GM only.
    const d = system.docket;
    const i18n = game.i18n;
    context.docket = {
      ...d,
      filled: docket.filledBoxes(d),
      roundsLeft: docket.roundsLeft(d),
      status: docket.status(d),
      outcome: docket.outcome(d),
      outcomeLabel: docket.outcome(d) ? i18n.localize(`CANTICA.Docket.Result.${docket.outcome(d)}`) : "",
      statusLabel: i18n.localize(`CANTICA.Docket.Status.${docket.status(d)}`),
      pips: Array.from({ length: Math.min(d.boxes, 40) }, (_, i) => ({ filled: i < docket.filledBoxes(d) })),
      players: game.users.filter(user => !user.isGM && user.active).length || 4
    };

    // Summary Proceedings, for the GM only.
    const p = system.proceedings;
    const proceedingsStatus = proceedings.status(p);
    context.proceedings = {
      ...p,
      rolled: proceedings.rolled(p),
      approved: proceedings.approvedCount(p),
      status: proceedingsStatus,
      statusLabel: i18n.localize(`CANTICA.Proceedings.Status.${proceedingsStatus}`),
      results: p.results.map(r => ({
        who: r.who,
        tierLabel: i18n.localize(`CANTICA.Tier.${r.tier}`),
        tier: r.tier,
        story: i18n.localize(`CANTICA.Proceedings.Story.${proceedings.STORY[r.tier]}`)
      })),
      players: game.users.filter(user => !user.isGM && user.active).length || 3
    };

    // Keep each Trait's real position: the form fields are named by array index.
    context.traits = system.traits.map((trait, index) => ({ ...trait, index, open: this.#open.has(trait.id) }));

    // Locations and Sections: the place this card is part of, and the Sections that are part of it.
    const cards = game.actors.filter(a => a.type === "card");
    const lookup = id => game.actors.get(id);
    const parent = system.location ? lookup(system.location) : null;
    context.location = parent ? { id: parent.id, name: parent.name } : null;
    context.locationPath = locationsOf(this.actor, lookup).map(c => c.name).join(" · ");
    context.locationChoices = locationOptions(this.actor, cards, lookup)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => ({ id: c.id, name: c.name, selected: c.id === system.location }));
    context.sectionCards = cards.filter(c => c.system.location === this.actor.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => ({ id: c.id, name: c.name, links: c.system.links }));
    context.showPlace = isGM || parent || system.links || context.sectionCards.length;
    return context;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("details[data-trait]").forEach(details => {
      details.addEventListener("toggle", () => {
        if (details.open) this.#open.add(details.dataset.trait);
        else this.#open.delete(details.dataset.trait);
      });
    });
  }

  /** Fields named system.traits.N.field arrive keyed by N; fold them into the existing list. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const edited = data.system?.traits;
    if (edited) {
      const current = this.actor.toObject().system.traits;
      data.system.traits = current.map((trait, i) => ({ ...trait, ...(edited[i] ?? {}) }));
    }
    return data;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #onAddTrait() {
    if (!game.user.isGM) return;
    const trait = await addTrait(this.actor, { name: game.i18n.localize("CANTICA.Card.NewTrait") });
    this.#open.add(trait.id);
    this.render();
  }

  static async #onDeleteTrait(event, target) {
    if (!game.user.isGM) return;
    const { trait } = target.dataset;
    this.#open.delete(trait);
    await this.actor.update({ "system.traits": this.actor.toObject().system.traits.filter(t => t.id !== trait) });
  }

  /** Open a linked card's sheet: the Location, or one of its Sections. */
  static #onOpenCard(event, target) {
    game.actors.get(target.dataset.id)?.sheet.render(true);
  }

  static async #onSetActive() {
    if (game.user.isGM) await setActiveCard(this.actor);
  }

  static async #onAmend() {
    await amendScene(this.actor);
  }

  /** GM: open a Docket in this scene, empty, at round 1. */
  static async #onOpenDocket() {
    if (!game.user.isGM) return;
    const d = this.actor.system.docket;
    await this.actor.update({ "system.docket": docket.open({ name: d.name, boxes: d.boxes || docket.sizeFor(this.element.querySelector("#docket-players")?.value), deadline: d.deadline || 3 }) });
  }

  /** GM: close the Docket (the result is yours to narrate). */
  static async #onCloseDocket() {
    if (game.user.isGM) await this.actor.update({ "system.docket.open": false });
  }

  /** GM: add or take away successes by hand. */
  static async #onDocketAdjust(event, target) {
    if (!game.user.isGM) return;
    await this.actor.update({ "system.docket": docket.addSuccesses(this.actor.toObject().system.docket, Number(target.dataset.delta)) });
  }

  /** GM: the next round begins. */
  static async #onDocketRound() {
    if (game.user.isGM) await this.actor.update({ "system.docket": docket.nextRound(this.actor.toObject().system.docket) });
  }

  /** GM: the Deadline moves up a round (a Margin of Error, or Scrutiny). */
  static async #onDocketPush() {
    if (game.user.isGM) await this.actor.update({ "system.docket": docket.pushDeadline(this.actor.toObject().system.docket) });
  }

  /** GM: set the number of boxes for the players at the table: 3, 4 or 5 each. */
  static async #onDocketSize(event, target) {
    if (!game.user.isGM) return;
    const players = this.element.querySelector("#docket-players")?.value;
    await this.actor.update({ "system.docket.boxes": docket.sizeFor(players, target.dataset.level) });
  }

  /** GM: open Summary Proceedings in this scene, for the players at the table. */
  static async #onOpenProceedings() {
    if (!game.user.isGM) return;
    const p = this.actor.system.proceedings;
    const group = Number(this.element.querySelector("#proceedings-group")?.value) || p.group;
    await this.actor.update({ "system.proceedings": proceedings.open({ name: p.name, rating: p.rating, group }) });
  }

  /** GM: close it. */
  static async #onCloseProceedings() {
    if (game.user.isGM) await this.actor.update({ "system.proceedings.open": false });
  }

  /** GM: take one player's result back. */
  static async #onRemoveResult(event, target) {
    if (!game.user.isGM) return;
    await this.actor.update({ "system.proceedings": proceedings.remove(this.actor.toObject().system.proceedings, target.dataset.who) });
  }

  /** GM: paint the card's token(s) again from the card as it is now. */
  static async #onRepaintToken() {
    await repaintCard(this.actor);
    ui.notifications.info(game.i18n.localize("CANTICA.Card.Repainted"));
  }
}
