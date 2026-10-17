import { NPC_TIERS } from "../config.mjs";
import { noticeTrackField, migrateOldNotices } from "./track.mjs";
import { migrateNpcTags } from "../npc-tags.mjs";

const { NumberField, StringField } = foundry.data.fields;

/**
 * Stat block: Name, Rating, Tier, Role Tag, other Tags (spec v0.11). The GM never rolls; NPCs act through their Rating,
 * which is used directly as the Difficulty of any roll against or to resist them.
 */
export default class NpcData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["CANTICA.Npc"];

  static defineSchema() {
    return {
      // 1 ordinary, 2 tough, 3 nemesis, 4 reserved.
      rating: new NumberField({ required: true, nullable: false, integer: true, min: 1, max: 4, initial: 1 }),
      // Who they are (Veteran Proctor, Liturgist Cantor). Acting within that role, or against them in it: the player loses a die.
      roleTag: new StringField({ required: true, blank: true, initial: "" }),
      // What else they're good at: a Minor has one, a Major two, a Background none. Only one Tag ever applies to a roll.
      otherTag1: new StringField({ required: true, blank: true, initial: "" }),
      otherTag2: new StringField({ required: true, blank: true, initial: "" }),
      // Background: any Notice takes them out. Minor: one Minor box. Major: the full track.
      tier: new StringField({ required: true, choices: NPC_TIERS, initial: "minor" }),
      notices: noticeTrackField(),
      notes: new StringField({ required: true, blank: true, initial: "" })
    };
  }

  static migrateData(source) {
    // v0.11: tag1-tag3 and the Action Tag become the Role Tag and the other Tags.
    return super.migrateData(migrateNpcTags(migrateOldNotices(source)));
  }
}
