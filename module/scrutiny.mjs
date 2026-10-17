import { SYSTEM_ID } from "./config.mjs";

import { clearMinors as clearMinorSlots } from "./notices.mjs";
import { serial } from "./serial.mjs";
import { pushDeadline } from "./docket.mjs";
import { escapeHtml } from "./lore-text.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/**
 * Scrutiny: the GM's currency. It starts each session at one per player, and rises by 1 whenever any player's Margin comes
 * up as an Error, and is spent narratively. This module only keeps the counter:
 * a world setting visible to everyone on a small tracker.
 */

const SOCKET = `system.${SYSTEM_ID}`;
let tracker = null;
const queue = serial();

export const getScrutiny = () => game.settings.get(SYSTEM_ID, "scrutiny");

async function setScrutiny(value) {
  await game.settings.set(SYSTEM_ID, "scrutiny", Math.max(0, Math.trunc(value)));
}

/** Change Scrutiny by an amount, one change at a time, so quick changes all count. */
const changeScrutiny = delta => queue(() => setScrutiny(getScrutiny() + delta));

/** GM: spend Scrutiny. Returns false (and spends nothing) if there is not enough. */
export function spendScrutiny(n = 1) {
  if (!game.user.isGM) return Promise.resolve(false);
  return queue(async () => {
    if (getScrutiny() < n) return false;
    await setScrutiny(getScrutiny() - n);
    return true;
  });
}

export function registerScrutiny() {
  game.settings.register(SYSTEM_ID, "scrutiny", {
    scope: "world",
    config: false,
    type: Number,
    default: 0,
    onChange: () => tracker?.render()
  });

  game.settings.register(SYSTEM_ID, "showScrutiny", {
    name: "CANTICA.Scrutiny.ShowSetting",
    hint: "CANTICA.Scrutiny.ShowHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: show => (show ? showScrutiny() : tracker?.close())
  });
}

/** Players can't write world settings, so their Errors are relayed to the active GM over the socket. */
export function listenForScrutiny() {
  game.socket.on(SOCKET, data => {
    // Only +1 is accepted from other clients: that is all an Error ever gives.
    if (data?.action === "scrutiny" && data.delta === 1 && game.user.isActiveGM) changeScrutiny(1);
  });
}

/** Add 1 Scrutiny (a Margin of Error). Works from any client. */
export async function gainScrutiny() {
  if (game.user.isGM) return changeScrutiny(1);
  if (!game.users.activeGM) return console.warn("cantica | no GM is connected: this Margin of Error's Scrutiny was not recorded");
  game.socket.emit(SOCKET, { action: "scrutiny", delta: 1 });
}

export function showScrutiny() {
  tracker ??= new ScrutinyTracker();
  return tracker.render({ force: true });
}

/** Re-render the table window (the active scene's name appears on it). */
export function refreshScrutinyTracker() {
  if (tracker?.rendered) tracker.render();
}

class ScrutinyTracker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cantica-scrutiny",
    classes: ["cantica", "scrutiny"],
    position: { width: 190, top: 120, left: 120 },
    window: { title: "CANTICA.Scrutiny.Label", icon: "fa-solid fa-eye", minimizable: true, resizable: false },
    actions: {
      adjust: ScrutinyTracker.#onAdjust,
      reset: ScrutinyTracker.#onReset,
      startSession: ScrutinyTracker.#onStartSession,
      spend: ScrutinyTracker.#onSpend,
      openLedger: () => game.cantica?.openLedger()
    }
  };

  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/app/scrutiny.hbs` }
  };

  async _prepareContext() {
    const card = game.actors.find(a => a.type === "card" && a.system.active);
    return { value: getScrutiny(), isGM: game.user.isGM, activeCard: card?.name ?? "" };
  }

  static async #onAdjust(event, target) {
    if (game.user.isGM) await changeScrutiny(Number(target.dataset.delta));
  }

  static async #onReset() {
    if (game.user.isGM) await setScrutiny(0);
  }

  /**
   * Spend Scrutiny out loud. The spends that need no button of their own (a Complication, Raise the Rating and a
   * Dissonance have theirs): push a Docket's Deadline, have a Minor NPC act as Major for one exchange, or bring
   * something in from offscreen. One Scrutiny, and a card in chat that says what it is in the story.
   */
  static async #onSpend() {
    if (!game.user.isGM) return;
    const i18n = game.i18n;
    if (getScrutiny() < 1) return ui.notifications.warn(i18n.localize("CANTICA.Complication.NoScrutiny"));
    const docketCard = game.actors.find(a => a.type === "card" && a.system.docket?.open && a.system.active)
      ?? game.actors.find(a => a.type === "card" && a.system.docket?.open);
    const kinds = ["push", "stepUp", "arrival", "other"].filter(kind => kind !== "push" || docketCard);
    const answer = await DialogV2.prompt({
      window: { title: i18n.localize("CANTICA.Scrutiny.SpendTitle") },
      content: `<p class="hint">${i18n.localize("CANTICA.Scrutiny.SpendHint")}</p>
        <div class="form-group"><label>${i18n.localize("CANTICA.Scrutiny.SpendOn")}</label>
          <select name="kind">${kinds.map(kind => `<option value="${kind}">${i18n.format(`CANTICA.Scrutiny.Spends.${kind}`, { card: docketCard?.name ?? "" })}</option>`).join("")}</select></div>
        <div class="form-group"><label>${i18n.localize("CANTICA.Scrutiny.SpendStory")}</label>
          <input type="text" name="story" placeholder="${i18n.localize("CANTICA.Scrutiny.SpendStoryPlaceholder")}" autofocus></div>`,
      ok: {
        label: i18n.localize("CANTICA.Scrutiny.SpendConfirm"),
        callback: (event, button) => ({ kind: button.form.elements.kind.value, story: button.form.elements.story.value.trim() })
      },
      rejectClose: false
    });
    if (!answer) return;
    if (!(await spendScrutiny(1))) return;
    if (answer.kind === "push" && docketCard) {
      await docketCard.update({ "system.docket": pushDeadline(docketCard.toObject().system.docket) });
    }
    const ChatMessage = CONFIG.ChatMessage.documentClass;
    await ChatMessage.create({
      speaker: { alias: i18n.localize("CANTICA.Scrutiny.Label") },
      content: `<div class="cantica cantica-card scrutiny-card"><header><div class="what">${i18n.localize("CANTICA.Scrutiny.Spent")}</div></header>
        <p class="note"><strong>${escapeHtml(i18n.format(`CANTICA.Scrutiny.Spends.${answer.kind}`, { card: docketCard?.name ?? "" }))}</strong></p>
        ${answer.story ? `<blockquote>${escapeHtml(answer.story)}</blockquote>` : ""}</div>`
    });
  }

  /**
   * Start a session: Scrutiny becomes one per player (the GM can change the number), and every player's
   * character is topped up to the Stamps its Grade begins a session with.
   */
  static async #onStartSession() {
    if (!game.user.isGM) return;
    const i18n = game.i18n;
    const players = game.users.filter(user => !user.isGM && user.active).length || game.users.filter(user => !user.isGM).length || 1;
    const characters = game.actors.filter(actor => actor.type === "character" && actor.hasPlayerOwner);
    const answer = await DialogV2.prompt({
      window: { title: i18n.localize("CANTICA.Scrutiny.StartTitle") },
      content: `<p class="hint">${i18n.localize("CANTICA.Scrutiny.StartHint")}</p>
        <div class="form-group"><label>${i18n.localize("CANTICA.Scrutiny.StartPlayers")}</label>
          <input type="number" name="scrutiny" value="${players}" min="0" autofocus></div>
        <label class="check"><input type="checkbox" name="stamps" checked> <span>${i18n.format("CANTICA.Scrutiny.StartStamps", { n: characters.length })}</span></label>
        <label class="check"><input type="checkbox" name="minors" checked> <span>${i18n.format("CANTICA.Scrutiny.StartMinors", { n: characters.length })}</span></label>`,
      ok: {
        label: i18n.localize("CANTICA.Scrutiny.Start"),
        callback: (event, button) => ({
          scrutiny: Number(button.form.elements.scrutiny.value),
          stamps: button.form.elements.stamps.checked,
          minors: button.form.elements.minors.checked
        })
      },
      rejectClose: false
    });
    if (!answer) return;
    await setScrutiny(answer.scrutiny);
    if (answer.stamps) for (const actor of characters) await actor.startSession();
    // Minor Notices clear at the end of a session.
    if (answer.minors) {
      for (const actor of characters) await actor.update({ "system.notices": clearMinorSlots(actor.toObject().system.notices) });
    }
    ui.notifications.info(i18n.format("CANTICA.Scrutiny.Started", { n: Math.max(0, Math.trunc(answer.scrutiny) || 0) }));
  }
}
