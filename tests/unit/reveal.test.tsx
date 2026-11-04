// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

const jingle = vi.fn();
vi.mock("@/lib/sound/sfx", () => ({
  sfx: { shake: vi.fn(), crack: vi.fn(), jingle: (r: number) => jingle(r) },
}));

import { Reveal } from "@/components/farm/CapsuleSheet";

beforeEach(() => {
  vi.useFakeTimers();
  jingle.mockClear();
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const one = [{ crop: "tomato" as const, rarity: "uncommon" as const, new: true, shards: 0 }];
const renderReveal = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Reveal results={one} onDone={() => {}} />
    </NextIntlClientProvider>,
  );

it("Skip during the shake shows the results and they stay shown (R-M7-1)", () => {
  renderReveal();
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  expect(jingle).toHaveBeenCalledTimes(1);
  // The shake's timers must not pull the reveal back into the crack.
  for (const ms of [800, 600, 1600]) {
    act(() => vi.advanceTimersByTime(ms));
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
  }
  expect(jingle).toHaveBeenCalledTimes(1);
});

it("is a modal dialog: focus starts on Skip, moves to Done, results are announced (R-M7-7)", () => {
  renderReveal();
  const dialog = screen.getByRole("dialog");
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Skip" }));
  act(() => vi.advanceTimersByTime(3000));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("status").textContent).toContain("Tomato");
});

it("a double-tap on Pull ×1 starts one pull (CJ-12)", async () => {
  const { CapsuleSheet } = await import("@/components/farm/CapsuleSheet");
  const pull = vi.fn(() => new Promise<null>(() => {}));
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CapsuleSheet
        state={{
          tickets: 3,
          pity: { since_rare: 0, since_epic: 0, since_legendary: 0 },
          shards: {},
          dex: {},
          seeds: {},
          harvested: false,
        }}
        pull={pull}
        onClose={() => {}}
      />
    </NextIntlClientProvider>,
  );
  const btn = screen.getByRole("button", { name: "Pull ×1" });
  // Both taps in one tick, before React can disable the button: only the guard stops the 2nd.
  act(() => {
    btn.click();
    btn.click();
  });
  expect(pull).toHaveBeenCalledTimes(1);
});
