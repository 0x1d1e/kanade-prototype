import { expect, type Page, test } from "@playwright/test";

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Scenario panel" });
const island = (page: Page) => page.getByTestId("island");
async function pause(page: Page) {
  await panel(page)
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
}
async function mode(page: Page, name: string) {
  await page
    .getByRole("group", { name: "Prototype mode" })
    .getByRole("button", { name, exact: true })
    .click();
}

test("baseline geometry, click, Escape, right-click Pin and hover grace", async ({
  page,
}) => {
  await page.goto("/");
  await expect(island(page)).toHaveAttribute("data-presentation", "rest");
  await expect(island(page)).toHaveCSS("width", "150px");
  await page
    .getByRole("button", { name: "Open Controls", exact: true })
    .click();
  await expect(island(page)).toHaveAttribute("data-presentation", "controls");
  await expect(island(page)).toHaveCSS("width", "440px");
  await expect(island(page)).toHaveCSS("height", "290px");
  await page.keyboard.press("Escape");
  await expect(island(page)).toHaveAttribute("data-presentation", "rest");
  await expect(island(page)).toHaveCSS("width", "150px");
  await island(page).click({ button: "right" });
  await expect(island(page)).toHaveClass(/pinned/);
  await expect(island(page)).toHaveCSS("width", "440px");
  await pause(page);
  await page.mouse.move(900, 700);
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(island(page)).toHaveAttribute("data-presentation", "controls");
  await panel(page)
    .getByRole("button", { name: "Collapse", exact: true })
    .click();
  await panel(page).getByRole("button", { name: "Start", exact: true }).click();
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(island(page)).toHaveAttribute("data-presentation", "compact");
  await island(page).hover();
  await panel(page)
    .getByRole("button", { name: "+100ms", exact: true })
    .click();
  // Leaving before hover delay cancels Peek.
  await expect(island(page)).toHaveAttribute("data-presentation", "compact");
  await panel(page)
    .getByRole("button", { name: "Play simulation", exact: true })
    .click();
  await island(page).hover();
  await expect(island(page)).toHaveAttribute("data-presentation", "peek");
  await page.mouse.move(950, 700);
  await expect(island(page)).toHaveAttribute("data-presentation", "compact");
});

test("keyboard Launcher search, no-results, selection and mock launch", async ({
  page,
}) => {
  await page.goto("/");
  await pause(page);
  await page.keyboard.press("Control+Alt+l");
  await expect(island(page)).toHaveAttribute("data-presentation", "launcher");
  const query = page.getByRole("textbox", { name: "Search applications" });
  await expect(query).toBeFocused();
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await query.fill("no-such-app");
  await expect(
    island(page).getByText("No apps found", { exact: true }),
  ).toBeVisible();
  await query.fill("fire");
  await expect(island(page).getByRole("option")).toHaveCount(1);
  await query.press("Enter");
  await expect(island(page)).toHaveAttribute("data-presentation", "rest");
  await expect(
    page.getByText("Mock launch: Firefox", { exact: true }).last(),
  ).toBeVisible();
});

test("Banners leave history; DND preserves Critical; OSD and privacy are independent", async ({
  page,
}) => {
  await page.goto("/");
  await pause(page);
  await panel(page)
    .getByRole("button", { name: "Normal", exact: true })
    .click();
  await expect(page.getByTestId("banner")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Close Banner 1", exact: true })
    .click();
  await expect(page.getByTestId("banner")).toHaveCount(0);
  await panel(page)
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(
    island(page).getByText("A new message from Hana", { exact: true }),
  ).toBeVisible();
  await panel(page)
    .getByRole("checkbox", { name: /Do Not Disturb/ })
    .check();
  await panel(page)
    .getByRole("button", { name: "Normal", exact: true })
    .click();
  await expect(page.getByTestId("banner")).toHaveCount(0);
  const bannerRow = panel(page)
    .locator(".event-row")
    .filter({ has: page.getByText("Banner", { exact: true }) });
  await bannerRow
    .getByRole("button", { name: "Critical", exact: true })
    .click();
  await expect(page.getByTestId("banner")).toHaveCount(1);
  await panel(page)
    .getByRole("button", { name: "Volume", exact: true })
    .click();
  await expect(page.getByTestId("osd")).toBeVisible();
  const privacy = panel(page)
    .locator(".event-row")
    .filter({ has: page.getByText("Privacy", { exact: true }) });
  await privacy.getByRole("button", { name: "Mic", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Privacy: microphone active" }),
  ).toBeVisible();
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(page.getByTestId("osd")).toHaveCount(0);
});

test("switchable detail experiment and materials never silently change Baseline", async ({
  page,
}) => {
  await page.goto("/");
  await pause(page);
  await panel(page)
    .getByRole("button", { name: "Controls", exact: true })
    .click();
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(
    island(page).getByRole("button", { name: "Wi-Fi details" }),
  ).toHaveCount(0);
  await panel(page)
    .getByRole("checkbox", { name: /Controls details/ })
    .check();
  await island(page)
    .getByRole("button", { name: "Wi-Fi details", exact: true })
    .click();
  await expect(
    island(page).getByText("Prototype detail", { exact: true }),
  ).toBeVisible();
  await island(page)
    .getByRole("button", { name: "Kanade Guest Secured", exact: true })
    .click();
  await island(page)
    .getByRole("button", { name: "Back to Controls", exact: true })
    .click();
  await expect(
    island(page).getByRole("button", {
      name: "Wi-Fi: Kanade Guest",
      exact: true,
    }),
  ).toBeVisible();
  await mode(page, "0.3.5 Mechanical Morph");
  await panel(page)
    .getByLabel("Material", { exact: true })
    .selectOption("glass");
  await expect(island(page)).toHaveClass(/material-glass/);
  await mode(page, "Baseline");
  await expect(island(page)).not.toHaveClass(/material-glass/);
  await expect(
    island(page).getByRole("button", {
      name: "Wi-Fi: Kanade Guest",
      exact: true,
    }),
  ).toBeVisible();
});

test("Reduced Motion snaps geometry immediately; clean view restores controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await pause(page);
  await expect(island(page)).toHaveAttribute("data-mode", "reduced");
  await panel(page)
    .getByRole("button", { name: "Launcher", exact: true })
    .click();
  await expect(island(page)).toHaveCSS("width", "520px");
  await expect(island(page)).toHaveCSS("height", "330px");
  await page.getByRole("button", { name: "Hide prototype controls" }).click();
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Show prototype controls" }).click();
  await expect(panel(page)).toBeVisible();
});

test("scripted replay resets, finishes and can replay in another mode", async ({
  page,
}) => {
  await page.goto("/");
  await pause(page);
  await panel(page)
    .getByRole("button", { name: "Replay", exact: true })
    .click();
  await pause(page);
  for (let i = 0; i < 7; i++)
    await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(island(page)).toHaveAttribute("data-presentation", "rest");
  await mode(page, "0.3.5 Mechanical Morph");
  await panel(page)
    .getByRole("button", { name: "Replay", exact: true })
    .click();
  await pause(page);
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(island(page)).toHaveAttribute("data-presentation", "compact");
  await expect(island(page)).toHaveAttribute("data-mode", "mechanical");
});

test("timer completion Banner gets its full six seconds after expiry", async ({
  page,
}) => {
  await page.goto("/");
  await pause(page);
  await panel(page).getByRole("button", { name: "5s", exact: true }).click();
  for (let i = 0; i < 5; i++)
    await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(page.getByTestId("banner")).toHaveCount(1);
  for (let i = 0; i < 5; i++)
    await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(page.getByTestId("banner")).toHaveCount(1);
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(page.getByTestId("banner")).toHaveCount(0);
});

test("pause and manual steps drive geometry, inherited opacity, art and experiment overlays", async ({
  page,
}) => {
  await page.goto("/");
  await pause(page);
  await panel(page)
    .getByRole("button", { name: "Controls", exact: true })
    .click();
  await expect(island(page)).toHaveCSS("width", "150px");
  await page.waitForTimeout(200); // Prove that wall time cannot move a paused morph.
  await expect(island(page)).toHaveCSS("width", "150px");
  await panel(page)
    .getByRole("button", { name: "+100ms", exact: true })
    .click();
  const width = await island(page).evaluate(
    (el) => el.getBoundingClientRect().width,
  );
  expect(width).toBeGreaterThan(150);
  expect(width).toBeLessThan(440);
  const incoming = island(page).locator(".incoming");
  const alpha = Number(
    await incoming.evaluate((el) => getComputedStyle(el).opacity),
  );
  expect(alpha).toBeGreaterThan(0);
  expect(alpha).toBeLessThan(1);
  await page.waitForTimeout(200);
  expect(
    await island(page).evaluate((el) => el.getBoundingClientRect().width),
  ).toBe(width);
  await panel(page)
    .getByRole("button", { name: "Launcher", exact: true })
    .click();
  expect(
    Number(
      await island(page)
        .locator(".outgoing")
        .evaluate((el) => getComputedStyle(el).opacity),
    ),
  ).toBeCloseTo(alpha, 5);
  expect(
    await island(page).evaluate((el) => el.getBoundingClientRect().width),
  ).toBe(width);
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await expect(island(page)).toHaveCSS("width", "520px");
  await panel(page)
    .getByRole("button", { name: "Collapse", exact: true })
    .click();
  await panel(page).getByRole("button", { name: "Start", exact: true }).click();
  await panel(page).getByRole("button", { name: "+1s", exact: true }).click();
  await panel(page)
    .getByRole("button", { name: "Change", exact: true })
    .click();
  const art = island(page).locator(".incoming .art-dissolve > div").last();
  await expect(art).toHaveCSS("opacity", "0");
  await panel(page)
    .getByRole("button", { name: "+100ms", exact: true })
    .click();
  const artAlpha = await art.evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(artAlpha)).toBeGreaterThan(0);
  expect(Number(artAlpha)).toBeLessThan(1);
  await page.waitForTimeout(200);
  await expect(art).toHaveCSS("opacity", artAlpha);
  await mode(page, "0.3.5 Mechanical Morph");
  await panel(page)
    .getByRole("button", { name: "Normal", exact: true })
    .click();
  await expect(page.getByTestId("banner")).toHaveCSS("opacity", "0");
  await panel(page)
    .getByRole("button", { name: "+100ms", exact: true })
    .click();
  const bannerAlpha = await page
    .getByTestId("banner")
    .evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(bannerAlpha)).toBeGreaterThan(0);
  expect(Number(bannerAlpha)).toBeLessThan(1);
  await page.waitForTimeout(200);
  await expect(page.getByTestId("banner")).toHaveCSS("opacity", bannerAlpha);
});

test("all shipped assets load and browser reports no errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await panel(page)
    .getByRole("button", { name: "Controls", exact: true })
    .click();
  await panel(page).getByRole("button", { name: "Start", exact: true }).click();
  await panel(page)
    .getByRole("button", { name: "Normal", exact: true })
    .click();
  await page.getByRole("button", { name: "Hide prototype controls" }).click();
  await page.getByRole("button", { name: "Show prototype controls" }).click();
  expect(errors).toEqual([]);
});
