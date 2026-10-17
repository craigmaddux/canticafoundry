/**
 * World migrations that need more than a data model's migrateData: telling people what changed.
 *
 * v0.12 (spec): Attune is retired, and a character's Attune rating moves to Composure. The data model makes the move
 * as the character loads; here the active GM tells each such character's owners once, in a whisper, and saves the
 * move so it is not made (or announced) again.
 */
import { SYSTEM_ID } from "./config.mjs";

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
