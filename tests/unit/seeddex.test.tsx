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
