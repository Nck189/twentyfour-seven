// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Sheet } from "@/components/today/BlockSheet";
import en from "@/messages/en.json";

afterEach(cleanup);

/** Like the real parents: a new inline onClose on every render, and a field that re-renders it. */
function Harness({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState("");
  return (
    <Sheet title="Edit" onClose={() => onClose()}>
      <input aria-label="Field" value={value} onChange={(e) => setValue(e.target.value)} />
    </Sheet>
  );
}

const renderSheet = (onClose = vi.fn()) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Harness onClose={onClose} />
    </NextIntlClientProvider>,
  );

it("opens with focus on Close (keyboard and screen-reader users land inside the sheet)", () => {
  renderSheet();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
});

it("typing keeps focus in the field: a parent re-render must not move it to Close (R-M4-2)", () => {
  renderSheet();
  const field = screen.getByLabelText("Field");
  field.focus();
  for (const v of ["O", "Op", "Ope", "Open"]) {
    fireEvent.change(field, { target: { value: v } });
    expect(document.activeElement).toBe(field);
  }
  expect(field).toHaveProperty("value", "Open");
});

it("Escape closes once, with the latest onClose", () => {
  const onClose = vi.fn();
  renderSheet(onClose);
  fireEvent.change(screen.getByLabelText("Field"), { target: { value: "x" } });
  fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});
