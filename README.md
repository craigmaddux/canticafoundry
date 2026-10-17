# Cantica (Foundry VTT system)

A native system for **Cantica**, a generational ark ship run by a tired AI that is also an angel of Order. Experimental: the table plays Savage Worlds, and this is for prototyping the rules in Foundry.

Implements the Cantica rules (see `system-design-changelog.md` in the design notes), plus Scene Cards, Dockets, Register With Gloss, Station Briefs and the Ledger. Targets Foundry **v14** (minimum v13). Optional: the **Dice So Nice** module for amber, white and violet dice.

## Install

Setup → Game Systems → Install System → paste the manifest URL:

```
https://github.com/craigmaddux/canticafoundry/releases/latest/download/system.json
```

New releases appear as in-app updates. On Molten, the same URL works; no CloudCommander upload is needed.

## The rules in short

- **Pool** = the Margin (1 amber die, always) + Skill (0–2) + one Trait (its rank) + one scene Trait (+1) + Help (+1) + Expedite (+1) − obstacles. **Cap 7.**
- **Skills** (16, rated 0–2): Body (Athletics, Scuffle, Sneak, Aim) · Mind (Lore, Science, Notice, Composure, Systems) · Hands (Hullcraft, Mend, Pilot) · People (Persuade, Procedure) · Worlds (Survival, Navigate). There is no skill for the Bound: Attune was retired in spec v0.12, and characters that had it get its rating as Composure (the owners are told once, in a whisper from Gloss).
- **White dice succeed on 7+.** **Violet (Bound) dice succeed on 6+.** Violet dice replace white dice; they never add to the count. At most **two** dice are violet: one from the Gift and one from **Bound gear** (a checkbox in the roll dialog). A violet 1 is **Dissonance**.
- **Gear** is permission, not a bonus: it never adds dice: the right tools let you roll at all. Bound gear with no white die to turn does nothing.
- **The Margin** succeeds on 7+ at Grades I–III, 6+ at IV–VI, 5+ at VII–IX, 4+ at X. Its 10 is always **Grace** (the roller gains a Stamp, automatically) and its 1 always an **Error** (the GM gains a Scrutiny, to spend on a twist later).
- **Difficulty = successes needed to succeed at all.** Below it is *Denied*; meeting it is *Approved, With Conditions*; one more is *Approved*; two or more is *Commended*. D0 Easy never Denies; D4 Unprecedented is for the wildly improbable.
- **Traits:** Station plus two open Traits (buy more, up to six, 4 Tenure each; characters made before keep their third). Every Trait has a **rank**, 1 or 2 (two pips on the sheet; rank 2 costs 6 Tenure and needs Grade III). On a roll you pick **one**, and it adds dice equal to its rank. **Stretch** (a checkbox beside it, anyone can tick it) makes it count as 1 die whatever its rank.
- **Hindrances:** two (Personal, Circumstantial), plus a Touched character's Drawback. With any in play the roller earns a **Stamp whatever the dice show**, and the Margin of Error widens to 1–2; on an Error the flaw bites (the GM gains Scrutiny and complicates the scene through it). They never add dice and never touch violet dice. **Greater Bound** (Dissonance on 1–2) is a separate checkbox in the builder, the GM's call for an especially large or volatile Bound.
- **Gift** (Touched): adds no die. It turns one white die violet, or, if the pool is only the Margin, adds one violet die. If there is no white die to turn, it does nothing extra.
- **Every Margin of Error** gives the GM **+1 Scrutiny**, and the GM starts each session with one Scrutiny per player (the Scrutiny window's **Start session** button sets it, tops every player character's Stamps up, and clears their Minor Notices). **Spend Scrutiny** in the same window spends one out loud on the spends that have no button of their own (push a Docket's Deadline, a Minor NPC acting as Major for one exchange, something arriving from offscreen) and posts what it is in the story.
- **The Hum** (GM only): every Dissonance adds 1 to a hidden counter (always 1, even under Greater Bound). Bands: Still 0–4, Murmur 5–9, Refrain 10–14, Swell 15–19, and at 20 *something gives*. From the Refrain, every violet die causes Dissonance on 1–2. Only the GM gets a window for it (it opens by itself, and there is a **The Hum** button in the Actors directory), and the GM gets a private chat note when it enters a new band. At 20, write the event, then reset it. Players are never shown the Hum or told it exists in the UI; the Ledger doesn't mention it.
- **Stamps:** **Expedite** is a checkbox in the roll dialog (+1 die before you roll, once per roll); **Refile** is a button on a roll's chat card; **Countersign** (give one of your Stamps to an ally, to use as their Expedite or Refile) is a button on the sheet. Cite a Clause was removed in spec v0.11. The GM can **Award** a Trait for free (after a major story moment), and **Resolve** beside a Hindrance turns it into a Trait and asks for the new Hindrance. **Reclassify** is a checkbox when you take a Major directly (it lands as a Minor; a Minor that overflows can't be Reclassified), and **Withdraw** is a button on the Notice track (narrate your exit, skip the Final box, earn a Stamp). You start each session with 2, +1 at Grades III, VI and IX.
- **Notices:** one track of two Minor boxes, two Major boxes and a Final box. Each Notice is named, typed **B** (Body) or **S** (Standing), and has a *clears by* line.
- **Grade** follows lifetime Tenure earned (every 6). **Skills** run 0–2 and cost 1, then 3 more. **Commendations** arrive at Grades II, V and VIII; one of the rule-breaks is *a second Trait also applies*.

Appeal and Precedent are deliberately not in the system.

## The character sheet

Four tabs:

- **Record:** Grade, Stamps and Tenure up top; Station and open Traits; the two Hindrances; Notices; Commendations; and skills. Click a skill's name to roll it; click its pips to set a rating. At first a character is in **creation**: a 15 Tenure budget, maximum rating 2. *Finish creation* when done; after that, skills are bought with Tenure.
- **Gift:** Gift, Drawback and Registered. Only when the character is **Touched**.
- **Notes:** free text.
- **History:** the Tenure log. Anyone who can edit the sheet can award Tenure, run **Compline** (three questions, 1 Tenure per yes) or award an **arc milestone** (+3). A Grade-up is highlighted in the log and announced in chat.

## Rolling

The pool builder asks you to pick one Trait (Station or an open Trait, with a Stretch checkbox), and offers the Gift, one checkbox per Hindrance (and the Drawback), your Commendations, the Scene you're in (and one scene Trait), and Bound gear. A **Penalty** row (None, −1, −2, −3) says "I have a −2 to this roll": each point costs a die, down to the Margin alone. Two checkboxes add dice: **Help** (others are assisting: +1 in total, however many help) and **A Notice on the target** (you are using an NPC's Notice against them: +1). Anything else that helps is a scene Trait, or the table's call. **Turn order** is its own button on the character sheet (beside Skills), not part of the builder: it rolls Notice straight away (everyone rolls, the most successes goes first), the Margin's Grace and Error don't count, and the card shows only the successes. The builder is tall, so it scrolls, and the pool and the Roll button stay in view. Difficulty is D0–D4, or the Rating of an NPC you've targeted. **What kind of roll** (an ordinary roll, acting against someone, resisting someone or a hazard, or a Request for Record) puts what the result means on the card, from the rules' tables: *they take a Minor*, *you take a Major*, *Chorus answers two questions*. A Request for Record switches the skill to Procedure. An NPC's **Tags** are not calculated into the roll: when one applies (a *Sharpshooter* when you defend against their shot), the table names it as a penalty in the Penalty row. **Only one Tag ever applies to a roll.** The NPC sheet has a **Role Tag** (who they are: *Veteran Proctor*) and other Tags by tier: a Background NPC none, a Minor one, a Major two. Older NPCs' Action Tag becomes their Role Tag. A Commendation that ignores one obstacle removes one point of the Penalty.

## Register With Gloss

A new character is created by a short conversation with Gloss. The full sheet stays closed while you do it, and appears when you finish, skip or close the walkthrough. Each step asks one thing (your name, your role, two Traits, two Hindrances, whether you're Touched, and last your skills), says what the answer does in the game, and offers a few examples you can click. Every answer is saved as you give it, so **Skip to the full sheet** is always there and loses nothing. It opens by itself for a brand-new character (there's a setting to turn that off), and a **Register With Gloss** button on the sheet reopens it during creation.

**Station Briefs** are offered at the role step: ten primers (Engineering, the Proctor's Office, Lottery Survey, the Hospice, the Compline Walk, the Greens, the Bay Floor, the Sump, the Navigator's Tower, the Registry) for people who want help building a class-like character. Picking one fills in Station and the skills (the standard spread, exactly 15 Tenure) and offers its Traits, Hindrances and Gift as clickable suggestions at the steps that follow; **Quick create** takes the whole Brief at once (Station, two Traits, two Hindrances and skills, and its Gift and Drawback if you say you're Touched) and goes straight to the read-back. "Something else" starts from nothing. The sheet remembers the Brief (History tab), and at Grade II offers its Commendation as a suggestion with a *Take it* button. The Briefs are the module's copy of the website's `station-briefs-data.js` (in `lore-src/`), bundled into the release with the lore. The module's copy has the v0.12 skills; `scripts/sync-lore.mjs` would overwrite it with the website's, so update the website's copy first.

Gloss's words are all in `module/registration-steps.mjs`: edit the text between the quotes.

## Dockets

A **Docket** is a job that builds up over several rounds against a Deadline (venting a compartment before the jump). It lives on a Scene Card, in a **Docket** panel on the card's sheet that **only the GM sees**: the job, the boxes, the Deadline in rounds, the round, and the successes. *Size for N players* sets the boxes (Routine 3, Standard 4, Hard 5 each for a 3-round Deadline). When a roll is made in a scene with an open Docket, the GM gets a **Count** button on the roll's chat card: every success fills a box (the card is counted by what it shows now, so a later Refile or Complication changes the count by the difference), and a Margin of Error on it moves the Deadline up a round. At the Deadline it ends on a graded scale: full works cleanly, ¾ works at a real cost, half half works, less fails. The table never sees the boxes or the Deadline. It sees only the running tally of successes, on the card's token (a small SUCCESSES tag in the corner).

## Summary Proceedings

A whole situation settled with **one roll per player** against a Rating (a chase through Stem-Side). Like a Docket it lives on a Scene Card, in a panel only the GM sees: the situation, the Rating, and how many players are rolling. On each roll's chat card the GM gets an **Add to Summary Proceedings** button that records the roll as that player's one result (rolling again, or a Refile that changes the tier, replaces it). The panel lists each result with its part in the story (Commended carries the moment, Approved contributes, With Conditions takes a Minor Notice, Denied takes a Major or something slips) and says when the scene is **won** (at least half the group reached Approved) or **lost** (it can no longer happen).

## Gear

Each character has a **Gear** list on the Record tab: a name, a note, and a **Bound** flag. Gear never adds dice (the right tools let you roll at all). In the roll builder, if the character has Bound gear, a menu picks which one is in play and it turns one white die violet, as the Gift does; the card names it. New characters can't mark gear Bound during creation (the GM can). Bound gear is **on loan** until the GM clicks **Keep it (3 Tenure)**, which charges the character's unspent Tenure.

## Scenarios

**Hurting on Deck 22** (the GM Primer's one-shot) imports in one click from the GM-only **Hurting on Deck 22** button in the Actors directory: nine NPCs with Rating, Tier and Tags (hidden from players), seven Scene Cards with their scene Traits, and a GM-only journal of the beats, the Clause, how it ends, and Chorus's literal answers. An NPC that already exists under the same name (Tamsin Voy and Proctor Halvard come from the lore import) is given its stat block if it has no Tags yet, and otherwise left alone. Run it again and only what's missing is added. The scenario's secrets are in the system's files, so anyone who browses the repository can read them.

## Scene Cards

A Scene Card is a place. Its **Traits are just Traits**: short phrases (*Steam Everywhere*, *A Spare Coupling in the Locker*).

- **For the roller:** the scene is the card your token is standing on, or else the **active** card (*Make active*). The roll dialog's **Scene** dropdown shows that guess and you can change it. You may pick **one** of the scene's Traits for +1 die.
- **After the roll, on its chat card:** the card keeps buttons for what can still be done to it. The roller can **Refile** (spend a Stamp: reroll one failed white die, once per roll; the Margin and violet dice are never refiled). The GM can **Raise the Rating** (1 Scrutiny, on a roll against a targeted NPC: its Rating is one higher for this roll) or **Complicate** (below). The tier is worked out again each time. Players' clicks on someone else's card go through the GM's client, so a GM has to be connected.
- **Against the roller:** after a roll in a scene, the GM can click **Complicate (1 Scrutiny)** on the roll's chat card and choose one of the scene's Traits: the roll has one success fewer. The player sees a **Negate (spend a Stamp)** button on the same card and can cancel it. The Scrutiny is spent either way.
- **Amend the Scene:** players can **Add Trait · spend a Stamp**. The request goes through the GM's client, so a GM has to be online.
- **Locations and Sections:** when the space matters, give each Section its own card and set its **Part of** to the Location's card, then lay the Section cards on top of the Location's on the canvas. A token is on the smallest card under it, so it is in the Section; the roll dialog offers the Section's Traits and the Location's (still one per roll), Complicate can use either, and and the Section's sheet links to its Location's. Each card also has a **Links** line (*Base (Hazard) · Control*). Amend the Scene adds to the card you're on.

Two ways to see a card at the table, and you can use both:

- **On the map:** drag the card onto the canvas. Cards are **12 × 9 grid squares** (three times as wide and as tall as before v0.8.1); cards already made at the old 4 × 3 are enlarged once, the first time a GM opens the world, and a size you set yourself is left alone (`game.cantica.resizeCards()` runs it again). To get rid of the grid, open the scene's configuration, Grid tab, and set Grid Type to Gridless. The token's picture is the whole card, painted into one image: your art **trimmed to the token's shape**, fading into a dark plate with the name, the place and the Traits. Resize the token and it repaints to match; edit the card and it repaints too. Because it's an ordinary token picture, characters stand on top of it. A GM's browser does the painting and saves the image in the world's `cantica-cards` folder (a GM has to be connected, and the folder writable). Double-click opens the sheet. `game.cantica.repaintCards()` repaints every card on the scene, and the **Repaint token** button on a card's sheet (GM) repaints that card's tokens right away. Paints of one token run one at a time and always end on the latest card, so a slow save of an older version can no longer overwrite a newer one.

## The Ledger and the lore

Gloss's searchable entries, inside Foundry: open it from the **Ledger** button in the Actors directory or on the Scrutiny window, or with `game.cantica.openLedger()`.

- **Search** and filter by People, Places, Groups, Terms, Rumors and Rules. Entries link to each other.
- **Share to chat** posts an entry to the table in Gloss's voice.
- **Import Cantica lore** (GM, one click) makes an **NPC** for every person and a **Scene Card** for every place, in a "Cantica" folder. Rating, Tags and Tier are left for you to set. Running it again only adds what's new; nothing you've edited is touched.
- Imported people and places show their picture in the Ledger. **Drag the picture onto the tabletop**, or use **Show to players** to put it on everyone's screen.

The lore (the Ledger's entries, the Station Briefs and the art they use) is written for the website, and this repository keeps its own copy in `lore-src/` so it builds on its own. When the website's lore changes, run `node scripts/sync-lore.mjs --site <path to the website checkout>` and commit the result. Releases bundle `lore-src/` into the system; for a local copy of the repo, run `node scripts/bundle-lore.mjs` first.

## Not in this version

Compendiums, and anything in the design notes marked "later".

## Development

There is no build step. This repository is the system: symlink or copy it into Foundry's `Data/systems/cantica` (after `bundle-lore`), or push a tag to build a release.

```
npm test                          # unit tests: dice rules, Grade table, odds table, Notice track, scenes, lore search, Briefs
node scripts/bundle-lore.mjs      # build lore/ (ledger data, Briefs and art) from lore-src/
node scripts/sync-lore.mjs --site ../cantica   # refresh lore-src/ from the website repository
git tag v0.11.0 && git push --tags   # builds system.json + system.zip on GitHub
```

The release workflow (`.github/workflows/release.yml`) runs the tests, stamps the version and this repository's URLs into `system.json`, bundles the lore, zips the system and publishes it.

`module/rules.mjs`, `module/progression.mjs`, `module/notices.mjs`, `module/scene.mjs` and `module/lore-text.mjs` are pure functions with no Foundry dependency, so they are tested in Node.
