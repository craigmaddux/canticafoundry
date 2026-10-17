/**
 * World migrations that need more than a data model's migrateData: telling people what changed.
 *
 * v0.12 (spec): Attune is retired, and a character's Attune rating moves to Composure. The data model makes the move
 * as the character loads; here the active GM tells each such character's owners once, in a whisper, and saves the
 * move so it is not made (or announced) again.
 */
import { SYSTEM_ID, RETIRED_ART, DEFAULT_NPC_IMG, DEFAULT_CARD_IMG } from "./config.mjs";

/**
 * v0.15.2: the system ships no art. Actors and tokens that pointed at the pictures it used to bundle (the lore's art,
 * the emblem) get Foundry's plain icons instead, so nothing shows a broken image. Your own pictures are untouched. A
 * Scene Card's token repaints by itself when its card's picture changes.
 */
export async function retireBundledArt() {
  if (!game.user.isActiveGM) return;
  const retired = src => typeof src === "string" && RETIRED_ART.some(prefix => src.startsWith(prefix));
  const fallback = type => (type === "card" ? DEFAULT_CARD_IMG : DEFAULT_NPC_IMG);

  const actorUpdates = [];
  for (const actor of game.actors) {
    const update = { _id: actor.id };
    if (retired(actor.img)) update.img = fallback(actor.type);
    if (retired(actor.prototypeToken?.texture?.src)) update["prototypeToken.texture.src"] = fallback(actor.type);
    if (Object.keys(update).length > 1) actorUpdates.push(update);
  }
  if (actorUpdates.length) await CONFIG.Actor.documentClass.updateDocuments(actorUpdates);

  for (const scene of game.scenes) {
    const tokens = scene.tokens.contents
      .filter(token => retired(token.texture?.src))
      .map(token => ({ _id: token.id, "texture.src": fallback(token.actor?.type) }));
    if (tokens.length) await scene.updateEmbeddedDocuments("Token", tokens);
  }
}

export async function announceSkillMoves() {
  if (!game.user.isActiveGM) return;
  const i18n = game.i18n;
  const ChatMessage = CONFIG.ChatMessage.documentClass;
  for (const actor of game.actors.filter(a => a.type === "character" && a.system.skillsMoved)) {
    const owners = game.users.filter(user => actor.testUserPermission(user, "OWNER")).map(user => user.id);
    await ChatMessage.create({
      whisper: owners,
      speaker: { alias: i18n.localize("CANTICA.Migration.Speaker") },
      content: `<div class="cantica cantica-card"><p>${i18n.format("CANTICA.Migration.AttuneMoved", {
        name: foundry.utils.escapeHTML(actor.name), rating: actor.system.skills.composure
      })}</p></div>`
    });
    // diff: false, so the moved rating is written even though the loaded character already shows it.
    await actor.update({ "system.skills.composure": actor.system.skills.composure, "system.skillsMoved": false }, { diff: false });
  }
}
