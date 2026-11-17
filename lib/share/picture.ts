"use client";

/**
 * A few lines of text as a small PNG for LINE/IG (free times M12, the weekly card G4): the app's own
 * colors (UI tokens, light/dark), rounded, no black. The first line is the title.
 */
export async function textPicture(text: string): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  // The UI tokens (styles/tokens.css), so the picture matches the app in light and dark mode.
  const bg = css.getPropertyValue("--ui-bg").trim();
  const card = css.getPropertyValue("--ui-surface").trim();
  const ink = css.getPropertyValue("--ui-text").trim();
  const accent = css.getPropertyValue("--ui-primary").trim();
  const font = getComputedStyle(document.body).fontFamily;
  const lines = text.split("\n");
  const scale = 2;
  const w = 720;
  const lh = 44;
  const h = 80 + lines.length * lh;
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = card;
  g.beginPath();
  g.roundRect(20, 20, w - 40, h - 40, 24);
  g.fill();
  lines.forEach((l, i) => {
    g.fillStyle = i === 0 ? accent : ink;
    g.font = `${i === 0 ? "700 28px" : "500 22px"} ${font}`;
    g.fillText(l, 48, 70 + i * lh, w - 96);
  });
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"));
}
