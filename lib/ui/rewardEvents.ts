import type { BlockKey } from "@/content/blocks";

/**
 * A tiny in-page signal for reward animations (review fix F2): the block card says "done", the
 * farm strip makes that plot bounce. No state shared, nothing saved.
 */
const BLOCK_DONE = "247:block-done";

export function emitBlockDone(key: BlockKey) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(BLOCK_DONE, { detail: key }));
}

export function onBlockDone(fn: (key: BlockKey) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<BlockKey>).detail);
  window.addEventListener(BLOCK_DONE, h);
  return () => window.removeEventListener(BLOCK_DONE, h);
}
