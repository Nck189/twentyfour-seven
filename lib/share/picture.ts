"use client";

import { qrBox, qrMatrix } from "./qr";

export type PictureFooter = {
  /** What the QR opens (her own share link, so a friend can ask for a time; else the app). */
  url: string;
  /** One line next to the QR, e.g. "Scan to ask for a time". */
  caption: string;
  /** The address shown under it (short, readable). */
  host: string;
};

/**
 * A few lines of text as a small PNG for LINE/IG (free times, M12): the app's own colors (UI
 * tokens, light/dark), rounded, no black. The first line is the title. With a footer, a QR code
 * and the address make the picture lead somewhere (review fix A1).
 */
export async function textPicture(text: string, footer?: PictureFooter): Promise<Blob> {
  await document.fonts?.ready;
  const css = getComputedStyle(document.documentElement);
  // The UI tokens (styles/tokens.css), so the picture matches the app in light and dark mode.
  const bg = css.getPropertyValue("--ui-bg").trim();
  const card = css.getPropertyValue("--ui-surface").trim();
  const ink = css.getPropertyValue("--ui-text").trim();
  const muted = css.getPropertyValue("--ui-text-muted").trim();
  const accent = css.getPropertyValue("--ui-primary").trim();
  const font = getComputedStyle(document.body).fontFamily;
  const lines = text.split("\n");
  const scale = 2;
  const w = 720;
  const lh = 44;
  const body = 80 + lines.length * lh;
  // The QR: whole-pixel modules of at least 3 px and a 4-module light margin (G7 R-A-1).
  const m = footer ? qrMatrix(footer.url) : null;
  const q = m ? qrBox(m.length, 110) : null;
  const tile = q ? q.size + 2 * q.margin : 0;
  const h = body + (q ? tile + 4 : 0);
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
  if (footer && m && q) {
    // The code sits on a light tile in both themes, with dark modules (never black): a camera
    // needs dark on light.
    const x = w - 44 - tile;
    const y = body - 24;
    g.fillStyle = css.getPropertyValue("--art-white").trim();
    g.beginPath();
    g.roundRect(x, y, tile, tile, 12);
    g.fill();
    g.fillStyle = css.getPropertyValue("--art-qr").trim();
    m.forEach((row, r) =>
      row.forEach((dark, col) => {
        if (dark) g.fillRect(x + q.margin + col * q.cell, y + q.margin + r * q.cell, q.cell, q.cell);
      }),
    );
    g.fillStyle = ink;
    g.font = `700 20px ${font}`;
    g.fillText(footer.caption, 48, y + tile / 2 - 6, x - 48 - 24);
    g.fillStyle = muted;
    g.font = `500 17px ${font}`;
    g.fillText(footer.host, 48, y + tile / 2 + 24, x - 48 - 24);
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"));
}
