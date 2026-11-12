// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import { SeedDexSheet } from "@/components/farm/SeedDexSheet";
import en from "@/messages/en.json";
import type { GachaState } from "@/lib/farm/useGacha";

afterEach(cleanup);

const state: GachaState = {
  tickets: 0,
  pity: { since_rare: 0, since_epic: 0, since_legendary: 0 },
  shards: { tomato: 15 },
  dex: { tomato: { crop: "tomato", count: 3, star: 1 } },
  seeds: {},
  harvested: false,
};

it("a double-tap on Star up stars up once (R-M7-4)", () => {
  const starUp = vi.fn(() => new Promise<boolean>(() => {}));
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SeedDexSheet state={state} starUp={starUp} onClose={() => {}} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Tomato/ }));
  const btn = screen.getByRole("button", { name: /Star up/ });
  fireEvent.click(btn);
  fireEvent.click(btn);
  expect(starUp).toHaveBeenCalledTimes(1);
});

it("the crop calendar: 12 months, the current one marked, unannounced months as silhouettes", () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SeedDexSheet state={state} starUp={vi.fn()} today="2026-11-12" onClose={() => {}} />
    </NextIntlClientProvider>,
  );
  const cal = screen.getByRole("region", { name: "Crop calendar" });
  const months = cal.querySelectorAll("li");
  expect(months).toHaveLength(12);
  const now = cal.querySelector('[aria-current="date"]')!;
  expect(now.getAttribute("aria-label")).toBe("Nov: Candle Lotus, Seeds in the shop until the 14th");
  expect(months[11]!.getAttribute("aria-label")).toBe("Dec: Snow Strawberry, Next in Dec 2026");
  expect(months[0]!.getAttribute("aria-label")).toBe("Jan: not announced yet");
  // The capsule grid never lists seasonal crops.
  expect(screen.getByText("1 of 20 found · 5%")).toBeTruthy();
});
