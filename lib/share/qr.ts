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
