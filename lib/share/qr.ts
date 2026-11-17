import qrcode from "qrcode-generator";

/**
 * The QR code for `text` as a square of dark (true) / light modules, quiet zone not included.
 * Error correction M: it survives the picture being re-compressed by a chat app.
 */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/**
 * How to draw a QR of `modules` × `modules` near `target` logical px: whole-pixel modules of at
 * least 3 px (6 real px on the 2× canvas), so it survives a chat app's re-compression, and the
 * 4-module light margin the standard asks for (G7 R-A-1).
 */
export function qrBox(modules: number, target: number): { cell: number; size: number; margin: number } {
  const cell = Math.max(3, Math.round(target / modules));
  return { cell, size: cell * modules, margin: 4 * cell };
}
