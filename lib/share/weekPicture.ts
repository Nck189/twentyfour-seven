"use client";

/**
 * The "Share my week" picture (G4, docs/GROWTH.md: "farm + streak + Day score ring"; pictures
 * over words). A 4:5 card for IG/LINE stories: a daytime farm scene drawn from the app's own SVG
 * art, a Day score ring and a few numbers. Only tokens (styles/tokens.css): no black, gradients
 * only in the sky. The farm always uses its daytime palette, so the light tokens are read even in
 * dark mode.
 */

export type WeekPictureLine = { text: string; icon?: string };
export type WeekPictureInput = {
  title: string;
  /** Mean Day score 0..1, or null (no scored day this week). */
  score: number | null;
  scoreLabel: string;
  lines: readonly WeekPictureLine[];
  /** Holds the art as `<svg data-slot="…">` elements (hidden; rendered by React). */
  art: HTMLElement;
};

const W = 540;
const H = 675;
const SCALE = 2;
const GROUND = 468;

/** Every art piece stands on y = 41 of its 48×48 box (its soft shadow; parts.tsx GROUND_Y + 1). */
const ART_FEET = 41 / 48;
/** Top of a piece of `size` whose feet sit on the grass (a little into it, like the farm scene). */
export const standY = (size: number) => Math.round(GROUND + 4 - size * ART_FEET);

/** Where each art slot goes on the card (logical px): x, y, size. Everything stands on the ground. */
export const WEEK_PICTURE_SLOTS = {
  house: [392, standY(128), 128],
  som: [28, standY(116), 116],
  crop1: [150, standY(92), 92],
  crop2: [232, standY(92), 92],
  crop3: [314, standY(92), 92],
  streak: [0, 0, 28],
} as const satisfies Record<string, readonly [number, number, number]>;

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

export async function weekPicture(p: WeekPictureInput): Promise<Blob> {
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
  ]);
  for (const s of svgs) for (const n of varNames(s.outerHTML)) names.add(n);
  const tk = lightTokens(names);
  const c = (n: string) => tk.get(n) ?? "";
  const font = getComputedStyle(document.body).fontFamily;

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
  g.fillStyle = c("--art-soil-dark");
  for (let x = 30; x < W; x += 90) {
    g.beginPath();
    g.ellipse(x, GROUND + 90 + ((x / 90) % 2) * 50, 16, 5, 0, 0, Math.PI * 2);
    g.fill();
  }
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

  // The card: ring on the left, numbers on the right.
  const top = 88;
  g.fillStyle = c("--ui-surface");
  g.beginPath();
  g.roundRect(20, top, W - 40, 232, 28);
  g.fill();
  const cx = 116;
  const cy = top + 116;
  const r = 66;
  g.lineWidth = 18;
  g.lineCap = "round";
  g.strokeStyle = c("--ui-surface-2");
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  if (p.score !== null && p.score > 0) {
    g.strokeStyle = c("--ui-primary");
    g.beginPath();
    g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.score));
    g.stroke();
  }
  g.textAlign = "center";
  g.fillStyle = c("--ui-text");
  g.font = `800 32px ${font}`;
  g.fillText(p.score === null ? "–" : `${Math.round(p.score * 100)}%`, cx, cy + 8);
  g.fillStyle = c("--ui-text-muted");
  g.font = `600 13px ${font}`;
  g.fillText(p.scoreLabel, cx, cy + 30, r * 2 - 24);
  g.textAlign = "left";

  const imgs = new Map<string, HTMLImageElement>();
  await Promise.all(
    svgs.map(async (s) => {
      const slot = s.dataset.slot as keyof typeof WEEK_PICTURE_SLOTS;
      const size = WEEK_PICTURE_SLOTS[slot]?.[2];
      if (size) imgs.set(slot, await svgImage(s, tk, size * SCALE));
    }),
  );

  const x0 = 214;
  const step = Math.min(44, 196 / Math.max(1, p.lines.length));
  p.lines.forEach((l, i) => {
    const y = top + 52 + i * step;
    const icon = l.icon ? imgs.get(l.icon) : undefined;
    if (icon) g.drawImage(icon, x0 - 2, y - 22, 28, 28);
    g.fillStyle = c("--ui-text");
    g.font = `700 20px ${font}`;
    g.fillText(l.text, icon ? x0 + 32 : x0, y, W - 40 - x0 - (icon ? 52 : 20));
  });

  // The farm.
  for (const [slot, [x, y, size]] of Object.entries(WEEK_PICTURE_SLOTS)) {
    if (slot === "streak") continue;
    const img = imgs.get(slot);
    if (img) g.drawImage(img, x, y, size, size);
  }

  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"),
  );
}
