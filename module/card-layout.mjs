/**
 * The card on the tabletop, laid out. Pure: no Foundry, no canvas. Given the card's words and a way
 * to measure text, it returns a list of drawing commands, so the layout (wrapping, truncating,
 * "+3 more") is unit-tested in Node. card-art.mjs paints the commands onto a canvas.
 *
 * With art, the card is the art cropped to the token's shape, a fade into a dark information plate over the lower
 * part, then the name, the place, and the Traits. With no art, the plate is the whole card.
 *
 * At least four Traits always show (or all of them, if there are fewer): a wide card sets them in two columns, and
 * the type shrinks, and the plate rises over the art, until they fit. Whatever still doesn't fit is counted.
 */

/** Bumped whenever the layout changes, so every card token on the table is painted again. */
export const LAYOUT_VERSION = 2;

/** Traits a card always shows, when it has that many. */
export const MIN_TRAITS = 4;

/** How far the type may shrink, step by step, to fit the Traits. */
const SCALES = [1, 0.9, 0.8, 0.72, 0.65, 0.58, 0.52, 0.46, 0.4, 0.35];

export const COLOR = {
  void: "#050810", hull: "#0c1320", rule: "#2c3a55", ink: "#c8d4e6", bright: "#e8eef8", dim: "#5a6a86", warm: "#ffb340"
};

const SERIF = "Spectral, Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** Where the plate starts, as a share of the card's height. A short, wide card starts it higher. */
export const PLATE_START = 0.42;
export const plateStartFor = (w, h) => (h < w * 0.65 ? 0.28 : PLATE_START);

/** Split text into lines no wider than `maxWidth`, breaking at spaces. */
export function wrap(text, font, maxWidth, measure) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (!line || measure(attempt, font) <= maxWidth) line = attempt;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/** At most `max` lines; if the text runs on, the last line ends in an ellipsis that still fits. */
export function clampLines(lines, max, font, maxWidth, measure) {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last.length > 1 && measure(`${last}…`, font) > maxWidth) last = last.slice(0, -1).trimEnd();
  kept[max - 1] = `${last}…`;
  return kept;
}

/**
 * @param {{name: string, description: string, traits: string[], tally?: number|null, width: number, height: number,
 *   art?: boolean}} card
 *   `tally` is the successes a Docket in this scene has had (the table sees that, and nothing else of the Docket).
 *   `art` is whether the card has a picture behind it (default true); without one the plate fills the card.
 * @param {(text: string, font: string) => number} measure  Width of text in the given CSS font.
 * @returns {{ops: object[], plateTop: number, shown: number, more: number, scale: number, columns: number}}
 */
export function layoutCard(card, measure) {
  const { traits = [], width: w, height: h, art = true } = card;
  const target = Math.min(MIN_TRAITS, traits.length);
  // With art, the plate starts low and may rise to make room; without, it is the whole card.
  const first = plateStartFor(w, h);
  const shares = art ? [first, 0.3, 0.2, 0.12].filter(share => share <= first) : [0];
  // One column reads best; a wide card may use two when one won't hold them.
  const columnChoices = traits.length > 1 && w >= h * 1.15 ? [1, 2] : [1];
  const tries = minScale => {
    const out = [];
    for (const scale of SCALES.filter(s => s >= minScale)) {
      for (const share of shares) for (const columns of columnChoices) out.push(attempt(card, measure, scale, share, columns));
    }
    return out;
  };
  // First, every Trait at a comfortable size; failing that, at least four at any size; failing that, the most.
  const comfortable = tries(0.72).find(r => r.more === 0);
  if (comfortable) return comfortable;
  const all = tries(0);
  return all.find(r => r.shown >= target) ?? all.reduce((a, b) => (b.shown > a.shown ? b : a));
}

/** One try at the layout, at a type scale, a plate position and a number of Trait columns. */
function attempt({ name, description, traits = [], tally = null, width: w, height: h }, measure, scale, share, columns = 1) {
  const ops = [];
  // Type scales with the card's smaller dimension, so a low, wide card doesn't get oversized text.
  const u = Math.min(w, h * 1.25);
  const pad = Math.max(8, Math.round(u * 0.04));
  const inner = w - pad * 2;
  const plateTop = Math.round(h * share);
  const bottom = h - pad;
  const size = (k, min) => Math.max(min, Math.round(u * k * scale));
  const text = (t, x, y, font, fill, extra = {}) => ops.push({ t: "text", text: t, x, y, font, fill, ...extra });

  // The plate: a fade out of the art, the plate itself, and an amber rule along its top edge. No art: all plate.
  if (plateTop > 0) {
    ops.push({ t: "fade", y: plateTop - Math.round((h - plateTop) * 0.35), h: Math.round((h - plateTop) * 0.35) });
    ops.push({ t: "rect", x: 0, y: plateTop, w, h: h - plateTop, fill: "rgba(5, 8, 16, 0.9)" });
    ops.push({ t: "rect", x: 0, y: plateTop, w, h: 2, fill: COLOR.warm, alpha: 0.7 });
  } else {
    ops.push({ t: "rect", x: 0, y: 0, w, h, fill: "rgba(5, 8, 16, 0.9)" });
  }

  // The tally: a small tag in the top right corner.
  let tallyBottom = 0;
  if (tally !== null && tally !== undefined) {
    const px = Math.max(10, Math.round(u * 0.04));
    const label = `SUCCESSES ${tally}`;
    const font = `${px}px ${MONO}`;
    const bw = Math.ceil(measure(label, font) + px * 1.8);
    const bh = Math.round(px * 2.1);
    ops.push({ t: "rect", x: w - pad - bw, y: pad, w: bw, h: bh, fill: "rgba(5, 8, 16, 0.88)" });
    ops.push({ t: "rect", x: w - pad - bw, y: pad, w: bw, h: 2, fill: COLOR.warm, alpha: 0.9 });
    text(label, w - pad - bw + Math.round(px * 0.9), pad + Math.round((bh - px) / 2) + 1, font, COLOR.warm);
    tallyBottom = pad + bh;
  }

  let y = plateTop + Math.round(pad * 0.8);

  // Eyebrow.
  const eyebrowPx = size(0.028, 9);
  text("◆ SCENE", pad, y, `${eyebrowPx}px ${MONO}`, COLOR.dim, { spacing: 2 });
  y += Math.round(eyebrowPx * 1.5);
  // The name never runs under the tally tag.
  if (tallyBottom && y < tallyBottom + Math.round(pad * 0.4)) y = tallyBottom + Math.round(pad * 0.4);

  // Name: at most two lines.
  const titlePx = size(0.07, 14);
  const titleFont = `${titlePx}px ${SERIF}`;
  for (const line of clampLines(wrap(name || "—", titleFont, inner, measure), 2, titleFont, inner, measure)) {
    text(line, pad, y, titleFont, COLOR.bright);
    y += Math.round(titlePx * 1.2);
  }
  y += Math.round(pad * 0.35);

  // The place: at most two lines.
  if (description) {
    const px = size(0.036, 10);
    const font = `italic ${px}px ${SERIF}`;
    for (const line of clampLines(wrap(description, font, inner, measure), 2, font, inner, measure)) {
      text(line, pad, y, font, COLOR.ink);
      y += Math.round(px * 1.4);
    }
    y += Math.round(pad * 0.45);
  }

  // The Traits: in one column or two, as many rows as fit, and the rest counted on a line of its own.
  let shown = 0;
  if (traits.length) {
    const headerPx = size(0.028, 9);
    text("TRAITS", pad, y, `${headerPx}px ${MONO}`, COLOR.warm, { spacing: 3 });
    y += Math.round(headerPx * 1.6);

    const px = size(0.04, 10);
    const font = `${px}px ${SERIF}`;
    const rowH = Math.round(px * 1.35);
    const morePx = Math.round(px * 0.85);
    const moreH = Math.round(morePx * 1.3);
    const gap = pad;
    const colW = (inner - gap * (columns - 1)) / columns;
    for (let i = 0; i < traits.length; i += columns) {
      const row = traits.slice(i, i + columns).map(t => clampLines(wrap(`◆ ${t}`, font, colW, measure), 2, font, colW, measure));
      const needed = Math.max(...row.map(lines => lines.length)) * rowH;
      const left = traits.length - (i + row.length);
      if (y + needed + (left > 0 ? moreH : 0) > bottom) break;
      row.forEach((lines, c) => {
        lines.forEach((line, n) => text(line, pad + Math.round(c * (colW + gap)), y + n * rowH, font, COLOR.bright));
      });
      y += needed;
      shown += row.length;
    }
    if (shown < traits.length && y + morePx <= bottom) {
      text(`+ ${traits.length - shown} more`, pad, y + Math.round(px * 0.15), `italic ${morePx}px ${SERIF}`, COLOR.dim);
    }
  }

  // Frame.
  for (const [x, yy, ww, hh] of [[0, 0, w, 2], [0, h - 2, w, 2], [0, 0, 2, h], [w - 2, 0, 2, h]]) {
    ops.push({ t: "rect", x, y: yy, w: ww, h: hh, fill: COLOR.rule });
  }

  return { ops, plateTop, shown, more: traits.length - shown, scale, columns };
}

/** A short stable hash of whatever makes the card look the way it does (FNV-1a, base 36). */
export function cardHash(value) {
  const s = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** Pixels per grid square for the card's image, and the largest the image will be. */
export const PX_PER_SQUARE = 200;
export const MAX_PX = 1600;

/** The card image's size for a token's size in grid squares. */
export function imageSize(squaresWide, squaresHigh) {
  const w = squaresWide * PX_PER_SQUARE;
  const h = squaresHigh * PX_PER_SQUARE;
  // A big card is scaled down as a whole, so its shape is kept; only a tiny one is lifted to a minimum.
  const k = Math.min(1, MAX_PX / Math.max(w, h));
  const floor = n => Math.max(200, Math.round(n * k));
  return { width: floor(w), height: floor(h) };
}

/** Where a crop window sits so the art covers the whole card, a little above centre (focal 0.4). */
export function coverCrop(imageW, imageH, width, height, focalY = 0.4) {
  const scale = Math.max(width / imageW, height / imageH);
  const w = width / scale;
  const h = height / scale;
  return { sx: (imageW - w) / 2, sy: (imageH - h) * focalY, sw: w, sh: h };
}
