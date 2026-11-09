import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/** G4: axe with 0 serious/critical violations. */
export async function expectNoSeriousA11y(page: Page) {
  const results = await new AxeBuilder({
    // axe types target a newer Playwright; 1.61 is pinned for macOS 14 WebKit (see DECISIONS).
    page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"],
  })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** G4: every visible interactive control is at least 44×44 CSS px. */
export async function expectTouchTargets(page: Page, min = 44) {
  const small = await page.evaluate((minSize) => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button, [role="button"], [role="radio"], [role="tab"], input, select, textarea',
      ),
    );
    return (
      els
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        })
        // Layout size, not the on-screen box: a just-tapped control is mid press animation
        // (.tap:active scales to 0.96), which isn't its real touch-target size.
        .filter((el) => el.offsetWidth < minSize - 0.5 || el.offsetHeight < minSize - 0.5)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${el.offsetWidth}×${el.offsetHeight}`,
        )
    );
  }, min);
  expect(small).toEqual([]);
}

/** R4: no horizontal scroll. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * Waits until `target` is fully faded in (its own and its ancestors' opacity multiply to 1), so
 * axe doesn't measure contrast mid-animation (a reveal fading in reads as low contrast).
 */
export async function expectFadedIn(target: Locator) {
  await expect
    .poll(() =>
      target.evaluate((el) => {
        let o = 1;
        for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
        return o;
      }),
    )
    .toBe(1);
}
