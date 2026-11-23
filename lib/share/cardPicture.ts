"use client";

/**
 * Shared pictures (G4, docs/GROWTH.md: "farm + streak + Day score ring"; pictures over words). A
 * 4:5 card for IG/LINE stories: a daytime farm scene drawn from the app's own SVG art, a Day score
 * ring (the week) or one big piece of art (a proud moment), a few lines, and a footer with the
 * app's address and a QR code so the picture leads back to the app (review fix A1). Only tokens
 * (styles/tokens.css): no black, gradients only in the sky. The farm always uses its daytime
 * palette, so the light tokens are read even in dark mode.
 */
import { qrBox, qrMatrix } from "./qr";

export type CardLine = { text: string; icon?: string };
export type CardInput = {
  title: string;
  /** The week: mean Day score 0..1 (null = no scored day) in a ring. */
  ring?: { value: number | null; label: string };
  /** A proud moment: the slot of one piece of art shown large instead of the ring. */
  hero?: string;
  lines: readonly CardLine[];
  /** Slots that stand between Som and the farmhouse (her crops and animals), left to right. */
  scene: readonly string[];
  footer: { host: string; caption: string; url: string };
  /** Holds the art as `<svg data-slot="…">` elements (hidden; rendered by React). */
  art: HTMLElement;
};

export const CARD = { w: 540, h: 675 } as const;
const W = CARD.w;
const H = CARD.h;
const SCALE = 2;
const GROUND = 468;
/** The address + QR card on the soil. */
export const FOOTER = { x: 20, y: 531, w: 500, h: 124 } as const;

/** Every art piece stands on y = 41 of its 48×48 box (its soft shadow; parts.tsx GROUND_Y + 1). */
const ART_FEET = 41 / 48;
/** Top of a piece of `size` whose feet sit on the grass (a little into it, like the farm scene). */
export const standY = (size: number) => Math.round(GROUND + 4 - size * ART_FEET);

type Box = readonly [x: number, y: number, size: number];

/**
 * Where each piece of the farm goes (logical px). Som stands on the left, the farmhouse on the
 * right, and up to five crops or animals between them, smaller when there are more.
 */
export function layoutScene(middle: readonly string[]): Record<string, Box> {
  const out: Record<string, Box> = { som: [28, standY(116), 116], house: [392, standY(128), 128] };
  const n = middle.length;
  const size = n <= 3 ? 92 : n === 4 ? 76 : 64;
  // Evenly spaced around the middle of the gap, so two pieces don't stand at its far ends.
  const gap = n <= 3 ? 82 : n === 4 ? 60 : 46;
  const mid = 278;
  middle.forEach((slot, i) => {
    const cx = mid + (i - (n - 1) / 2) * gap;
    out[slot] = [Math.round(cx - size / 2), standY(size), size];
  });
  return out;
}

/**
 * The font size (px) at which a line fits `maxWidth`: the base size when it fits, smaller when it
 * doesn't, never under 14. `measure(px)` is the line's width at that size. Letters are never
 * squeezed (G7 R-A-4).
 */
export function fitFont(base: number, maxWidth: number, measure: (px: number) => number): number {
  const w = measure(base);
  if (w <= maxWidth) return base;
  return Math.max(14, Math.floor((maxWidth / w) * base * 10) / 10);
}

/** The innermost `var(--x)` or `var(--x, fallback)` (a fallback with no parentheses left). */
const INNER_VAR = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*?))?\s*\)/;

/** Every token name used in `markup`, nested fallbacks too. */
export function varNames(markup: string): Set<string> {
  return new Set([...markup.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]!));
}

/**
 * Inlines tokens into markup drawn outside the page (an <img> can't see the page's CSS
 * variables). Innermost first, so `var(--shadow-on, var(--art-shadow))` works; an unset token
 * takes its fallback, else "transparent" (never the browser's default black).
 */
export function resolveVars(markup: string, tokens: ReadonlyMap<string, string>): string {
  let out = markup;
  for (let m = INNER_VAR.exec(out); m; m = INNER_VAR.exec(out)) {
    const value = tokens.get(m[1]!) || m[2]?.trim() || "transparent";
    out = out.slice(0, m.index) + value + out.slice(m.index + m[0].length);
  }
  return out;
}

/** The light (daytime) value of every token in `names`, without a visible theme flash. */
function lightTokens(names: Iterable<string>): Map<string, string> {
  const root = document.documentElement;
  const before = root.getAttribute("data-theme");
  root.setAttribute("data-theme", "light");
  try {
    const css = getComputedStyle(root);
    return new Map([...names].map((n) => [n, css.getPropertyValue(n).trim()]));
  } finally {
    if (before === null) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", before);
  }
}

async function svgImage(svg: SVGElement, tokens: Map<string, string>, px: number) {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(px));
  clone.setAttribute("height", String(px));
  clone.removeAttribute("class");
  const markup = resolveVars(clone.outerHTML, tokens);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();
  return img;
}

export async function cardPicture(p: CardInput): Promise<Blob> {
  // Draw with the app's fonts, not a fallback (looped Thai especially; G7 R-M14-15).
  await document.fonts?.ready;
  const svgs = [...p.art.querySelectorAll<SVGElement>("svg[data-slot]")];
  const names = new Set<string>([
    "--sky-day-top",
    "--sky-day-bottom",
    "--art-leaf-2",
    "--art-leaf-3",
    "--art-soil",
    "--art-soil-dark",
    "--ui-surface",
    "--ui-surface-2",
    "--ui-text",
    "--ui-text-muted",
    "--ui-primary",
    "--art-qr",
  ]);
  for (const s of svgs) for (const n of varNames(s.outerHTML)) names.add(n);
  const tk = lightTokens(names);
  const c = (n: string) => tk.get(n) ?? "";
  const font = getComputedStyle(document.body).fontFamily;
  const scene = layoutScene(p.scene);
  /** Drawn size of each slot: the farm pieces, plus the small and large art in the cards. */
  const sizeOf = (slot: string) => scene[slot]?.[2] ?? (slot === p.hero ? 168 : 56);
  const imgs = new Map<string, HTMLImageElement>();
  await Promise.all(
    svgs.map(async (s) => {
      const slot = s.dataset.slot!;
      imgs.set(slot, await svgImage(s, tk, sizeOf(slot) * SCALE));
    }),
  );

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const g = canvas.getContext("2d")!;
  g.scale(SCALE, SCALE);

  // Sky (the only gradient), then grass and soil.
  const sky = g.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, c("--sky-day-top"));
  sky.addColorStop(1, c("--sky-day-bottom"));
  g.fillStyle = sky;
  g.fillRect(0, 0, W, GROUND);
  g.fillStyle = c("--art-soil");
  g.fillRect(0, GROUND, W, H - GROUND);
  g.fillStyle = c("--art-leaf-3");
  g.fillRect(0, GROUND, W, 16);
  g.fillStyle = c("--art-leaf-2");
  g.beginPath();
  g.roundRect(0, GROUND - 6, W, 14, 7);
  g.fill();

  // Title.
  g.fillStyle = c("--ui-text");
  g.font = `800 30px ${font}`;
  g.fillText(p.title, 32, 60, W - 64);

  // The card: the ring (or the big art) on the left, the lines on the right.
  const top = 88;
  g.fillStyle = c("--ui-surface");
  g.beginPath();
  g.roundRect(20, top, W - 40, 232, 28);
  g.fill();
  const cx = 116;
  const cy = top + 116;
  const hero = p.hero ? imgs.get(p.hero) : undefined;
  if (hero) {
    g.drawImage(hero, cx - 84, cy - 84, 168, 168);
  } else if (p.ring) {
    const r = 66;
    g.lineWidth = 18;
    g.lineCap = "round";
    g.strokeStyle = c("--ui-surface-2");
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    if (p.ring.value !== null && p.ring.value > 0) {
      g.strokeStyle = c("--ui-primary");
      g.beginPath();
      g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.ring.value));
      g.stroke();
    }
    g.textAlign = "center";
    g.fillStyle = c("--ui-text");
    g.font = `800 32px ${font}`;
    g.fillText(p.ring.value === null ? "–" : `${Math.round(p.ring.value * 100)}%`, cx, cy + 8);
    g.fillStyle = c("--ui-text-muted");
    g.font = `600 13px ${font}`;
    g.fillText(p.ring.label, cx, cy + 30, r * 2 - 24);
    g.textAlign = "left";
  }

  const x0 = 214;
  const step = Math.min(44, 196 / Math.max(1, p.lines.length));
  // Few lines sit in the middle of the card, not at its top.
  const first = top + 116 - ((p.lines.length - 1) * step) / 2 + 7;
  p.lines.forEach((l, i) => {
    const y = first + i * step;
    const icon = l.icon ? imgs.get(l.icon) : undefined;
    if (icon) g.drawImage(icon, x0 - 2, y - 22, 28, 28);
    g.fillStyle = c("--ui-text");
    const room = W - 40 - x0 - (icon ? 52 : 20);
    const px = fitFont(20, room, (size) => {
      g.font = `700 ${size}px ${font}`;
      return g.measureText(l.text).width;
    });
    g.font = `700 ${px}px ${font}`;
    g.fillText(l.text, icon ? x0 + 32 : x0, y, room);
  });

  // The farm.
  for (const [slot, [x, y, size]] of Object.entries(scene)) {
    const img = imgs.get(slot);
    if (img) g.drawImage(img, x, y, size, size);
  }

  // Footer: the app's mark and address, and a QR code that opens it.
  g.fillStyle = c("--ui-surface");
  g.beginPath();
  g.roundRect(FOOTER.x, FOOTER.y, FOOTER.w, FOOTER.h, 24);
  g.fill();
  const mark = imgs.get("mark");
  if (mark) g.drawImage(mark, FOOTER.x + 18, FOOTER.y + 34, 56, 56);
  // Dark brown modules on the white card (never black). Whole-pixel modules; the card is the
  // light margin around the code.
  const m = qrMatrix(p.footer.url);
  const cell = Math.max(2, Math.min(qrBox(m.length, 96).cell, Math.floor((FOOTER.h - 16) / m.length)));
  const qrSize = cell * m.length;
  const qrX = FOOTER.x + FOOTER.w - qrSize - 16;
  const qrY = FOOTER.y + Math.round((FOOTER.h - qrSize) / 2);
  const textX = FOOTER.x + 88;
  const textW = qrX - textX - 16;
  g.fillStyle = c("--ui-text");
  g.font = `800 19px ${font}`;
  g.fillText(p.footer.host, textX, FOOTER.y + 58, textW);
  g.fillStyle = c("--ui-text-muted");
  g.font = `600 14px ${font}`;
  g.fillText(p.footer.caption, textX, FOOTER.y + 82, textW);
  g.fillStyle = c("--art-qr");
  m.forEach((row, r) =>
    row.forEach((dark, col) => {
      if (dark) g.fillRect(qrX + col * cell, qrY + r * cell, cell, cell);
    }),
  );

  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"),
  );
}
