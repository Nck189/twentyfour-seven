// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it } from "vitest";
import { WeekStep } from "@/components/onboarding/WeekStep";
import type { TemplateRow } from "@/lib/today/day";
import en from "@/messages/en.json";

afterEach(cleanup);

const kind = (id: string, wake: string, sleepMin: number) =>
  ({
    id,
    key: id,
    name: id,
    weekdays: [1],
    auto_apply: true,
    target_wake: `${wake}:00`,
    options: {},
    blocks: { sleep: { duration_min: sleepMin } },
    fixed_events: [],
    sort: 1,
  }) as unknown as TemplateRow;

const renderWeek = (templates: TemplateRow[]) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WeekStep
        templates={templates}
        version={0}
        nameOf={(t) => t.name ?? t.key}
        onSleep={() => {}}
        onAllSleep={() => {}}
        onMoveDay={() => {}}
        onRemoveDay={() => {}}
        onEvents={() => {}}
        onAddKind={() => {}}
        onImportIcs={async () => ""}
      />
    </NextIntlClientProvider>,
  );

it("the same-sleep shortcut every kind of day uses now shows as picked (Minnie)", () => {
  renderWeek([kind("a", "07:00", 480), kind("b", "07:00", 480)]);
  const group = screen.getByRole("group", { name: en.onboarding.sameSleep });
  const buttons = within(group).getAllByRole("button");
  expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false", "false"]);
});

it("no shortcut shows as picked when the kinds of day differ", () => {
  renderWeek([kind("a", "07:00", 480), kind("b", "10:00", 450)]);
  const group = screen.getByRole("group", { name: en.onboarding.sameSleep });
  expect(
    within(group)
      .getAllByRole("button")
      .every((b) => b.getAttribute("aria-pressed") === "false"),
  ).toBe(true);
});
