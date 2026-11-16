import { expect, test } from "@playwright/test";
import { setPrefs, signIn, uniqueEmail } from "../helpers/auth";
import { leaveAfterSignIn } from "../helpers/day";
import { IS_PROD_RUN } from "../helpers/env";

/**
 * M14 error states (QA_QC: every list has empty / loading / error). A failed load must say so,
 * never show a default as if it were the user's own value. Found by the M14 states audit.
 */
test.skip(IS_PROD_RUN, "creates dedicated users");

test("CJ-STATE-1 More: a failed load of the exercise goal and the requests inbox says so; Try again fixes it", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await setPrefs(page, { locale: "en", theme: "light" });
  await signIn(page, uniqueEmail("states"));
  await leaveAfterSignIn(page);
  const broken = /\/rest\/v1\/(settings|booking_requests)\?/;
  await page.route(broken, (route) =>
    route.request().method() === "GET" ? route.abort("failed") : route.fallback(),
  );
  await page.goto("/more");

  const exercise = page.getByRole("region", { name: "Weekly exercise" });
  await expect(exercise.getByRole("alert")).toContainText("Couldn't load your weekly goal.");
  await expect(exercise.getByText("3 times a week")).toHaveCount(0); // no default shown as yours
  const share = page.getByRole("region", { name: "Share my free time" });
  await expect(share.getByRole("alert")).toContainText("Couldn't load your requests.");
  await expect(share.getByText("Requests (0)")).toHaveCount(0);

  await page.unroute(broken);
  await exercise.getByRole("button", { name: "Try again" }).click();
  await expect(exercise.getByText("3 times a week")).toBeVisible();
  await expect(exercise.getByRole("alert")).toHaveCount(0);
  await share.getByRole("button", { name: "Try again" }).click();
  await expect(share.getByText("Requests (0)")).toBeVisible();
  await expect(share.getByText("No requests waiting.")).toBeVisible();
  await expect(share.getByRole("alert")).toHaveCount(0);
});
