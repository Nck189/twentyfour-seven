// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import { DayKind } from "@/components/onboarding/WeekStep";
import type { TemplateRow } from "@/lib/today/day";
import en from "@/messages/en.json";

afterEach(cleanup);

const tpl = {
  id: "k1",
  key: "free_weekday",
  name: null,
  weekdays: [1, 2],
  auto_apply: true,
  target_wake: "10:00",
  options: {},
  blocks: {},
  fixed_events: [],
  sort: 1,
} as unknown as TemplateRow;
const letters = ["M", "T", "W", "Th", "F", "Sa", "Su"];

it("tapping a picked weekday again takes it off; tapping an unpicked one adds it (Minnie)", () => {
  const onMoveDay = vi.fn();
  const onRemoveDay = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ul>
        <DayKind
          tpl={tpl}
          name="Free weekday"
          letters={letters}
          onSleep={() => {}}
          onMoveDay={onMoveDay}
          onRemoveDay={onRemoveDay}
          onEvents={() => {}}
        />
      </ul>
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "M", pressed: true }));
  expect(onRemoveDay).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole("button", { name: "W", pressed: false }));
  expect(onMoveDay).toHaveBeenCalledWith(3);
});
