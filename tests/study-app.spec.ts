import { expect, test } from "@playwright/test";

async function freshStart(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("study-shell")).toHaveAttribute("data-study-ready", "true");
}

async function clickOption(page: import("@playwright/test").Page, text: string) {
  const option = page.locator('[data-testid^="option-"]').filter({ hasText: text });
  await expect(option).toHaveCount(1);
  await option.click();
  await expect(option).toHaveAttribute("aria-pressed", "true");
}

async function openTopics(page: import("@playwright/test").Page) {
  await page.locator('[data-testid="mode-topics"]:visible').click();
  await expect(page.getByPlaceholder("Search topics or questions")).toBeVisible();
}

async function openMode(page: import("@playwright/test").Page, mode: "review" | "progress") {
  await page.locator(`[data-testid="mode-${mode}"]:visible`).click();
}

test("opens directly into a study session without technical copy", async ({ page }) => {
  await freshStart(page);

  await expect(page.getByText("Surgery Qbank")).toBeVisible();
  await expect(page.getByText("Submit answer")).toBeVisible();
  await expect(page.getByText("Clinical note")).toHaveCount(0);

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/\b(extracted|generated|json|pdf|vercel|github|internet|source)\b/i);

  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflowX).toBe(false);
});

test("answers a single-best question and shows feedback", async ({ page }) => {
  await freshStart(page);

  const correctOption = page.getByText("They can become damaged, even though urine output exceeds 1500 mL/d.", {
    exact: true,
  });

  if ((await correctOption.count()) > 0) {
    await clickOption(page, "They can become damaged, even though urine output exceeds 1500 mL/d.");
  } else {
    await clickOption(page, "Low central venous pressure");
  }

  await expect(page.getByTestId("submit-answer")).toBeEnabled();
  await page.getByTestId("submit-answer").click();
  await expect(page.getByText("Correct")).toBeVisible();
  await expect(page.getByText("Best answer:")).toBeVisible();
  await expect(page.getByText("Clinical note")).toBeVisible();
});

test("supports multi-answer questions", async ({ page }) => {
  await freshStart(page);

  await openTopics(page);
  await page.getByPlaceholder("Search topics or questions").fill("retarded wound healing");

  if ((await page.getByText("Q94.").count()) > 0) {
    await page.locator("button").filter({ hasText: "Q94." }).click();
    await clickOption(page, "Zinc deficiency");
    await clickOption(page, "Vitamin A deficiency");
    await clickOption(page, "Vitamin C deficiency");
  } else {
    await page.getByPlaceholder("Search topics or questions").fill("appendicitis");
    await page.locator("button").filter({ hasText: "Which findings are classic for acute appendicitis?" }).click();
    await clickOption(page, "Periumbilical pain migrating to the right lower quadrant");
    await clickOption(page, "Localized tenderness at McBurney point");
    await clickOption(page, "Fever with leukocytosis");
  }

  await expect(page.getByText("Select all that apply.")).toBeVisible();
  await expect(page.getByTestId("submit-answer")).toBeEnabled();
  await page.getByTestId("submit-answer").click();
  await expect(page.getByText("Correct")).toBeVisible();
  await expect(page.getByText("Clinical note")).toBeVisible();
});

test("missed questions appear in review", async ({ page }) => {
  await freshStart(page);

  await clickOption(page, "They tolerate satisfactorily ischemia of 3-4 hours duration.");
  await expect(page.getByTestId("submit-answer")).toBeEnabled();
  await page.getByTestId("submit-answer").click();
  await expect(page.getByText("Review this one")).toBeVisible();

  await openMode(page, "review");
  await expect(page.getByText("Review this one")).toBeVisible();
});

test("progress view summarizes completion and accuracy", async ({ page }) => {
  await freshStart(page);

  await clickOption(page, "They can become damaged, even though urine output exceeds 1500 mL/d.");
  await expect(page.getByTestId("submit-answer")).toBeEnabled();
  await page.getByTestId("submit-answer").click();
  await openMode(page, "progress");

  await expect(page.getByText("Complete", { exact: true })).toBeVisible();
  await expect(page.getByText("Accuracy", { exact: true })).toBeVisible();
  await expect(page.getByText("Chapter performance")).toBeVisible();
});

test("desktop layout uses the chapter rail and no bottom navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only layout assertion");
  await freshStart(page);

  await expect(page.getByText("Skin, Soft Tissue, and Breast")).toBeVisible();
  await expect(page.getByRole("button", { name: "Practice", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Progress", exact: true })).toBeVisible();

  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflowX).toBe(false);
});
