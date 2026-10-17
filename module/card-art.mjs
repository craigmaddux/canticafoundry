import { SYSTEM_ID, CARD_TOKEN, OLD_CARD_TOKEN } from "./config.mjs";
import { layoutCard, cardHash, imageSize, coverCrop, COLOR } from "./card-layout.mjs";

/**
 * The card on the tabletop. The whole card (art cropped to the token's shape, the fade, the name, the
 * place, the Traits) is painted into one image, saved in the world's folder, and used as the token's
 * picture. Foundry then treats it like any token art: trimmed to the token, and underneath the
 * characters standing on it.
 *
 * Only one GM's client does the painting, whenever a card token is dropped, resized, or its card is
 * edited. If painting or saving fails, the token simply keeps showing the plain art.
 */

const FOLDER = "cantica-cards";
let lastWarned = 0;

/** Placeholder pictures that mean "no art set yet". */
const hasArt = img => Boolean(img) && !/(mystery-man|emblem)\.svg$/.test(img);

const isCard = token => token?.actor?.type === "card";
const isPainter = () => game.user.isActiveGM;

function warn(error) {
  console.warn(`${SYSTEM_ID} | could not paint a card for the tabletop`, error);
  // Tell the GM, but not on every attempt.
  if (Date.now() - lastWarned < 30000) return;
  lastWarned = Date.now();
  ui.notifications.warn(game.i18n.localize("CANTICA.Card.PaintFailed"));
}

/* -------------------------------------------- */
/*  Painting                                    */
/* -------------------------------------------- */

async function loadImage(src) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  await image.decode();
  return image;
}

/** Paint the card onto a new canvas. */
export async function renderCardImage({ name, description, traits, tally, art }, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // The card's fonts, so the text is drawn in them and not in a fallback.
  await Promise.all(["20px Spectral", "italic 20px Spectral", "12px 'JetBrains Mono'"].map(font => document.fonts.load(font))).catch(() => {});

  ctx.fillStyle = COLOR.hull;
  ctx.fillRect(0, 0, width, height);

  if (art) {
    try {
      const image = await loadImage(art);
      const { sx, sy, sw, sh } = coverCrop(image.naturalWidth, image.naturalHeight, width, height);
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    } catch (error) { console.warn(`${SYSTEM_ID} | the card's art could not be loaded`, error); }
  }

  const measure = (text, font) => { ctx.font = font; return ctx.measureText(text).width; };
  const { ops } = layoutCard({ name, description, traits, tally, width, height }, measure);

  ctx.textBaseline = "top";
  for (const op of ops) {
    if (op.t === "fade") {
      const fade = ctx.createLinearGradient(0, op.y, 0, op.y + op.h);
      fade.addColorStop(0, "rgba(5, 8, 16, 0)");
      fade.addColorStop(1, "rgba(5, 8, 16, 0.55)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, op.y, width, op.h);
    } else if (op.t === "rect") {
      ctx.globalAlpha = op.alpha ?? 1;
      ctx.fillStyle = op.fill;
      ctx.fillRect(op.x, op.y, op.w, op.h);
      ctx.globalAlpha = 1;
    } else if (op.t === "text") {
      ctx.font = op.font;
      ctx.fillStyle = op.fill;
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${op.spacing ?? 0}px`;
      ctx.fillText(op.text, op.x, op.y);
    }
  }
  return canvas;
}

/** Save the painted card in the world's folder. @returns {Promise<string>} its path */
async function upload(canvas, filename) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.92));
  if (!blob) throw new Error("the card could not be encoded as an image");

  const FilePicker = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  const directory = `worlds/${game.world.id}/${FOLDER}`;
  try { await FilePicker.createDirectory("data", directory); } catch { /* it already exists */ }

  const file = new File([blob], `${filename}.webp`, { type: "image/webp" });
  const response = await FilePicker.upload("data", directory, file, {}, { notify: false });
  // An upload that fails can return nothing rather than throw: then there is no picture to point the token at.
  if (!response?.path) throw new Error(`the card's picture could not be saved in ${directory}`);
  return response.path;
}

/** What a card token should show right now: the words, the size, and a hash of both. */
function describe(token) {
  const actor = token.actor;
  const { width, height } = imageSize(token.width, token.height);
  const data = {
    name: actor.name,
    description: actor.system.description,
    traits: actor.system.traits.map(trait => trait.name).filter(Boolean),
    // Only the running tally of a Docket's successes is shown on the table, never its boxes or Deadline.
    tally: actor.system.docket.open ? actor.system.docket.successes : null,
    art: hasArt(actor.img) ? actor.img : null
  };
  return { data, width, height, hash: cardHash([data, width, height]) };
}

/**
 * Paint once. Returns "stale" if the card changed while it was being painted and uploaded, in which case the
 * picture is not applied (it would show an older card) and the caller paints again.
 */
async function paintOnce(token, force) {
  const actor = token.actor;
  if (actor?.type !== "card") return null;

  const { data, width, height, hash } = describe(token);
  if (!force && token.getFlag(SYSTEM_ID, "painted") === hash) return null;

  const canvas = await renderCardImage(data, width, height);
  const path = await upload(canvas, `${actor.id}-${width}x${height}-${hash}`);
  if (describe(token).hash !== hash) return "stale";
  await token.update({ "texture.src": path, "texture.fit": "fill", [`flags.${SYSTEM_ID}.painted`]: hash });
  return null;
}

/** Tokens being painted now, so two paints of one token never race. */
const painting = new Map();

/**
 * Paint a card token's picture, unless it already shows the card as it now is. A paint takes a while (the picture is
 * saved to the world's folder), and the card can be edited again meanwhile. Paints of one token therefore run one at a
 * time, and an edit that arrives during one makes it go round again, so the token always ends up showing the latest card
 * and never an older one that happened to finish last.
 */
export async function paintToken(token, { force = false } = {}) {
  const running = painting.get(token.uuid);
  if (running) {
    running.again = true;
    running.force ||= force;
    return;
  }

  const run = { again: false, force: false };
  painting.set(token.uuid, run);
  try {
    let next = force;
    for (let round = 0; round < 5; round++) {
      run.again = false;
      run.force = false;
      const result = await paintOnce(token, next);
      next = run.force;
      if (result !== "stale" && !run.again) break;
    }
  } catch (error) {
    warn(error);
  } finally {
    painting.delete(token.uuid);
  }
}

/** Repaint every token of one card, on every scene (the GM's Repaint button on the card's sheet). */
export async function repaintCard(actor) {
  if (!game.user.isGM) return;
  for (const scene of game.scenes) {
    for (const token of scene.tokens) if (token.actorId === actor.id) await paintToken(token, { force: true });
  }
}

/* -------------------------------------------- */
/*  When to paint                               */
/* -------------------------------------------- */

const timers = new Map();

/** Paint soon, once edits have settled. */
function queue(token, delay = 1200) {
  if (!isPainter()) return;
  clearTimeout(timers.get(token.uuid));
  timers.set(token.uuid, setTimeout(() => { timers.delete(token.uuid); paintToken(token); }, delay));
}

/**
 * Every token of a card, on every scene. (Foundry's collections have no flatMap, so this goes through their
 * arrays: calling flatMap on game.scenes threw, and so no edit to a card ever repainted its token.)
 */
export const tokensOf = actor => game.scenes.contents.flatMap(scene => scene.tokens.contents.filter(token => token.actorId === actor.id));

/** Repaint every card token in the scene being viewed. */
export function repaintCards({ force = true } = {}) {
  if (!isPainter() || !canvas?.scene) return;
  for (const token of canvas.scene.tokens) if (isCard(token)) paintToken(token, { force });
}

/**
 * Make the Scene Cards from before v0.8.1 the new, larger size: a card actor's prototype token, and any
 * of its tokens on a scene, that are still exactly the old default. A size you chose yourself is left alone.
 */
export async function resizeCards() {
  if (!game.user.isGM) return;
  const old = OLD_CARD_TOKEN;
  const isOld = t => t.width === old.width && t.height === old.height;

  for (const actor of game.actors.filter(a => a.type === "card")) {
    if (isOld(actor.prototypeToken)) await actor.update({ "prototypeToken.width": CARD_TOKEN.width, "prototypeToken.height": CARD_TOKEN.height });
  }
  for (const scene of game.scenes) {
    const updates = scene.tokens
      .filter(token => token.actor?.type === "card" && isOld(token))
      .map(token => ({ _id: token.id, width: CARD_TOKEN.width, height: CARD_TOKEN.height }));
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
  }
}

export function registerCardArt() {
  // Existing cards are made the larger size once, by the first GM to open the world after the update.
  game.settings.register(SYSTEM_ID, "cardSizeV081", { scope: "world", config: false, type: Boolean, default: false });
  Hooks.once("ready", async () => {
    if (!game.user.isActiveGM || game.settings.get(SYSTEM_ID, "cardSizeV081")) return;
    try {
      await resizeCards();
      await game.settings.set(SYSTEM_ID, "cardSizeV081", true);
    } catch (error) { warn(error); }
  });

  // New card tokens: fitted to the token, drawn beneath characters, with no name label (it's on the card).
  Hooks.on("preCreateToken", token => {
    if (!isCard(token)) return;
    token.updateSource({
      "texture.src": token.actor.img,
      "texture.fit": "fill",
      sort: -1000,
      displayName: CONST.TOKEN_DISPLAY_MODES.NONE
    });
  });

  Hooks.on("createToken", token => { if (isCard(token)) queue(token, 200); });

  // The card is a different shape now.
  Hooks.on("updateToken", (token, changes) => {
    // A card token that is not linked to its card keeps its own edits (a "delta"): those change what it shows too.
    if (isCard(token) && ("width" in changes || "height" in changes || "delta" in changes)) queue(token);
  });

  // The card's words or art changed: repaint wherever it sits.
  Hooks.on("updateActor", (actor, changes) => {
    if (actor.type !== "card") return;
    const system = changes.system ?? {};
    if (!("name" in changes || "img" in changes || "description" in system || "traits" in system || "docket" in system)) return;
    try {
      for (const token of tokensOf(actor)) queue(token);
    } catch (error) { warn(error); }
  });

  // Cards placed before this existed, or while no GM was around, are painted when the scene opens.
  Hooks.on("canvasReady", () => {
    if (!isPainter()) return;
    for (const token of canvas.scene?.tokens ?? []) if (isCard(token)) queue(token, 500);
  });
}
