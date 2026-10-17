import { SYSTEM_ID } from "../config.mjs";
import {
  slotsFor, placeNotice, clearMinors as clearMinorSlots, emptySlot, isFilled, slotKind, minorsFull,
  defaultClearsBy, CHARACTER_TIER, NOTICE_TYPES, reclassify
} from "../notices.mjs";

import { escapeHtml } from "../lore-text.mjs";

const { DialogV2 } = foundry.applications.api;

/** The tier that decides which boxes an actor has: characters get the full track. */
export const tierOf = actor => (actor.type === "npc" ? actor.system.tier : CHARACTER_TIER);

/** Template context for the track partial: the visible boxes, grouped into Minor, Major and Final rows. */
export function trackContext(actor) {
  const i18n = game.i18n;
  const boxes = slotsFor(tierOf(actor)).map(slot => {
    const data = actor.system.notices[slot];
    const kind = slotKind(slot);
    return {
      slot,
      kind,
      label: i18n.localize(`CANTICA.Track.${kind}`),
      status: i18n.localize(`CANTICA.Track.${kind}Status`),
      name: data.name,
      filled: isFilled(data),
      clearsBy: data.clearsBy,
      // Shown faintly when blank: what this Notice clears by unless you write your own.
      placeholder: defaultClearsBy(kind, data.type),
      treat: kind === "major",
      hasClears: kind !== "final",
      types: NOTICE_TYPES.map(value => ({ value, label: i18n.localize(`CANTICA.Track.type${value}`), selected: data.type === value }))
    };
  });
  return ["minor", "major", "final"]
    .map(kind => ({ kind, boxes: boxes.filter(box => box.kind === kind) }))
    .filter(row => row.boxes.length);
}

/* -------------------------------------------- */
/*  Sheet actions. `this` is the sheet.         */
/* -------------------------------------------- */

/** Land a Minor or Major Notice; overflow and being taken out are handled by the track rules. */
export async function takeNotice(event, target) {
  const i18n = game.i18n;
  const actor = this.actor;
  const tier = tierOf(actor);
  const incoming = target.dataset.kind;
  let track = actor.toObject().system.notices;

  // A character with a Stamp may Reclassify a Major that lands on them directly (a Commended or Denied result),
  // making it a Minor. A Minor that overflows into a Major can't be (spec v0.11).
  const canReclassify = actor.type === "character" && actor.system.stamps > 0 && incoming === "major";

  const notice = await DialogV2.prompt({
    window: { title: i18n.format("CANTICA.Track.TakeTitle", { kind: i18n.localize(`CANTICA.Track.${incoming}`) }) },
    content: `<div class="form-group"><label>${i18n.localize("CANTICA.Track.NoticeName")}</label>
        <input type="text" name="name" autofocus></div>
      <div class="form-group"><label>${i18n.localize("CANTICA.Track.NoticeType")}</label>
        <select name="type">${NOTICE_TYPES.map(t => `<option value="${t}">${i18n.localize(`CANTICA.Track.type${t}`)}</option>`).join("")}</select></div>
      <div class="form-group"><label>${i18n.localize("CANTICA.Track.ClearsBy")}</label>
        <input type="text" name="clearsBy" placeholder="${i18n.localize("CANTICA.Track.ClearsByHint")}"></div>
      ${canReclassify ? `<label class="check" title="${i18n.localize("CANTICA.Track.ReclassifyHint")}"><input type="checkbox" name="reclassify">
        <span>${i18n.localize("CANTICA.Track.Reclassify")}</span></label>` : ""}`,
    ok: {
      label: i18n.localize("CANTICA.Track.Take"),
      callback: (event, button) => ({
        name: button.form.elements.name.value.trim() || i18n.localize("CANTICA.Track.Unnamed"),
        type: button.form.elements.type.value,
        clearsBy: button.form.elements.clearsBy.value.trim(),
        reclassify: Boolean(button.form.elements.reclassify?.checked)
      })
    },
    rejectClose: false
  });
  if (!notice) return;

  // The track may have changed while the dialog was open (the GM landed a Notice, say): work from it as it is now.
  track = actor.toObject().system.notices;
  const ChatMessage = CONFIG.ChatMessage.documentClass;
  const reclassified = canReclassify && notice.reclassify;
  const kind = reclassified ? reclassify(incoming) : incoming;

  // Reclassified away: a Minor that was never going to land. The Stamp is spent, and nothing is filed.
  if (!kind) {
    await actor.adjustStamps(-1);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${escapeHtml(i18n.format("CANTICA.Track.ReclassifiedAway", { name: actor.name, notice: notice.name }))}</p>`
    });
    return;
  }

  // Adding a Minor when all the Minor boxes are full: ask before escalating to a Major.
  if (kind === "minor" && tier === CHARACTER_TIER && minorsFull(track, tier)) {
    const majorsFull = placeNotice(track, tier, "major", { name: "x" }).out;
    const go = await DialogV2.confirm({
      window: { title: i18n.localize("CANTICA.Track.EscalateTitle") },
      content: `<p>${i18n.localize(majorsFull ? "CANTICA.Track.EscalateOut" : "CANTICA.Track.Escalate")}</p>`,
      rejectClose: false
    });
    if (!go) return;
  }

  if (reclassified) await actor.adjustStamps(-1);
  const result = placeNotice(track, tier, kind, notice);
  await actor.update({ "system.notices": result.track });

  const landed = slotKind(result.slot);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/chat/notice.hbs`, {
      actorName: actor.name,
      notice: notice.name,
      type: i18n.localize(`CANTICA.Track.type${notice.type}`),
      box: i18n.localize(`CANTICA.Track.${landed}`),
      status: i18n.localize(`CANTICA.Track.${landed}Status`),
      clearsBy: result.track[result.slot].clearsBy,
      overflowed: result.overflowed,
      out: result.out,
      reclassified
    })
  });
}

/**
 * Withdraw: before a roll that could take you out, concede. Narrate your own exit, skip the Final box, and a
 * character earns a Stamp. (A Major NPC can Withdraw too, with no Stamp to earn.)
 */
export async function withdraw() {
  const i18n = game.i18n;
  const actor = this.actor;
  const answer = await DialogV2.prompt({
    window: { title: i18n.localize("CANTICA.Track.WithdrawTitle") },
    content: `<p class="hint">${i18n.localize(actor.type === "character" ? "CANTICA.Track.WithdrawHint" : "CANTICA.Track.WithdrawNpcHint")}</p>
      <div class="form-group"><label>${i18n.localize("CANTICA.Track.WithdrawHow")}</label>
        <input type="text" name="how" autofocus></div>`,
    ok: { label: i18n.localize("CANTICA.Track.Withdraw"), callback: (event, button) => ({ how: button.form.elements.how.value.trim() }) },
    rejectClose: false
  });
  if (!answer) return;

  const earns = actor.type === "character";
  if (earns) await actor.adjustStamps(1);
  const ChatMessage = CONFIG.ChatMessage.documentClass;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await foundry.applications.handlebars.renderTemplate(`systems/${SYSTEM_ID}/templates/chat/withdraw.hbs`, {
      actorName: actor.name, how: answer.how, earns
    })
  });
}

/** Clear one box: the Notice is resolved, treated, or reclassified away. */
export async function clearNotice(event, target) {
  await this.actor.update({ [`system.notices.${target.dataset.slot}`]: emptySlot() });
}

/** Treat a Major Notice: it is dealt with and its box clears. */
export const treatNotice = clearNotice;

/** End of session: clear all Minor Notices. */
export async function clearMinors() {
  await this.actor.update({ "system.notices": clearMinorSlots(this.actor.toObject().system.notices) });
}
