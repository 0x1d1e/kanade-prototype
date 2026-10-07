import { expect, type Locator, type Page, test } from "@playwright/test";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const island = (page: Page) => page.getByTestId("island");
const incoming = (page: Page) => page.locator(".incoming");
const layer = (page: Page, key: string) =>
  incoming(page).locator(`[data-nav-key="${key}"]`);
const step = (page: Page, amount = "+100ms") => button(page, amount).click();
const battery = (page: Page, name: string) =>
  page
    .locator(".event-row")
    .filter({ has: page.getByText("Battery", { exact: true }) })
    .getByRole("button", { name, exact: true })
    .click();
async function pose(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(
      style.transform === "none" ? undefined : style.transform,
    );
    return { x: matrix.m41, y: matrix.m42, opacity: Number(style.opacity) };
  });
}
async function controls(page: Page) {
  await button(page, "Controls").click();
  await button(page, "Pin").click();
  await step(page, "+1s");
  await page.getByRole("checkbox", { name: /Controls details/ }).check();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await button(page, "Pause simulation").click();
});

test("detail navigation preserves body geometry and reverses both visible layers", async ({
  page,
}) => {
  await controls(page);
  await button(page, "Wi-Fi details").click();
  await expect(layer(page, "wifi")).toHaveCSS("opacity", "0");
  await expect.poll(async () => (await pose(layer(page, "wifi"))).x).toBe(12);
  await expect(layer(page, "root")).toHaveAttribute("inert", "");
  await expect(layer(page, "root")).toHaveAttribute("aria-hidden", "true");
  await expect(button(page, "Back to Controls")).toBeFocused();
  await expect(island(page)).toHaveCSS("width", "440px");
  await expect(island(page)).toHaveCSS("height", "290px");
  await expect(incoming(page)).toHaveCSS("opacity", "1");
  await page.waitForTimeout(100);
  await expect(layer(page, "wifi")).toHaveCSS("opacity", "0");
  await step(page);
  await expect
    .poll(async () => (await pose(layer(page, "wifi"))).opacity)
    .toBeGreaterThan(0.5);
  const root = await pose(layer(page, "root")),
    wifi = await pose(layer(page, "wifi"));
  expect(root.opacity + wifi.opacity).toBeCloseTo(1);
  expect(root.x).toBeLessThan(0);
  await button(page, "Back to Controls").click();
  await expect
    .poll(async () => (await pose(layer(page, "root"))).x)
    .toBeCloseTo(root.x, 3);
  expect((await pose(layer(page, "root"))).opacity).toBeCloseTo(
    root.opacity,
    5,
  );
  expect((await pose(layer(page, "wifi"))).opacity).toBeCloseTo(
    wifi.opacity,
    5,
  );
  await expect(button(page, "Wi-Fi details")).toBeFocused();
  await step(page, "+20ms");
  await expect
    .poll(async () => (await pose(layer(page, "root"))).x)
    .toBeGreaterThan(root.x);
  await expect
    .poll(async () => (await pose(layer(page, "wifi"))).x)
    .toBeGreaterThan(wifi.x);
  await expect(incoming(page)).toHaveCSS("opacity", "1");
  await expect(island(page)).toHaveCSS("height", "290px");
  await step(page, "+1s");
  await expect(incoming(page).locator(".navigation-layer")).toHaveCount(1);
});

test("detail navigation cannot restart an unfinished body spring", async ({
  page,
}) => {
  await button(page, "Controls").click();
  await button(page, "Pin").click();
  await page.getByRole("checkbox", { name: /Controls details/ }).check();
  await step(page);
  await button(page, "Wi-Fi details").click();
  await step(page, "+20ms");
  const phase = (4.744 * 120) / 180;
  const progress = 1 - (1 + phase) * Math.exp(-phase);
  await expect
    .poll(async () =>
      parseFloat(
        await island(page).evaluate(
          (element) => getComputedStyle(element).width,
        ),
      ),
    )
    // Computed layout widths are quantized to 1/64px by Chromium.
    .toBeCloseTo(150 + (440 - 150) * progress, 1);
  await expect
    .poll(async () => (await pose(layer(page, "wifi"))).opacity)
    .toBeGreaterThan(0);
  expect((await pose(layer(page, "wifi"))).opacity).toBeLessThan(0.1);
});

test("Escape goes Back before collapsing; all mock details use navigation", async ({
  page,
}) => {
  await controls(page);
  for (const [name, key] of [
    ["Wi-Fi details", "wifi"],
    ["Bluetooth details", "bluetooth"],
    ["Audio details", "audio"],
  ]) {
    await button(page, name).click();
    await expect(layer(page, key)).toHaveAttribute("data-nav-current", "true");
    await expect.poll(async () => (await pose(layer(page, key))).x).toBe(12);
    await step(page, "+1s");
    await button(page, "Back to Controls").focus();
    await page.keyboard.press("Escape");
    await expect(layer(page, "root")).toHaveAttribute(
      "data-nav-current",
      "true",
    );
    await expect(island(page)).toHaveAttribute("data-presentation", "controls");
    await expect
      .poll(async () => (await pose(layer(page, "root"))).x)
      .toBe(-12);
    await expect(button(page, name)).toBeFocused();
    await step(page, "+1s");
  }
  await button(page, "Audio details").focus();
  await page.keyboard.press("Escape");
  await expect(island(page)).toHaveAttribute("data-presentation", "rest");
});

test("Mechanical handoff has no blank interval and keeps Baseline geometry timing", async ({
  page,
}) => {
  await button(page, "Controls").click();
  await step(page);
  const baselineWidth = parseFloat(
    await island(page).evaluate((element) => getComputedStyle(element).width),
  );
  await button(page, "Reset").click();
  await button(page, "0.3.5 Mechanical Morph").click();
  await button(page, "Controls").click();
  for (let i = 0; i < 10; i++) {
    await step(page, "+20ms");
    await expect
      .poll(async () => {
        const out = await pose(page.locator(".outgoing"));
        const into = await pose(incoming(page));
        return out.opacity + into.opacity;
      })
      .toBeGreaterThan(0);
    if (i === 4) {
      await expect
        .poll(async () =>
          parseFloat(
            await island(page).evaluate(
              (element) => getComputedStyle(element).width,
            ),
          ),
        )
        .toBeCloseTo(baselineWidth, 3);
    }
  }
});

test("Split swaps slide instead of fading, including a mid-slide reversal", async ({
  page,
}) => {
  await battery(page, "Low");
  await button(page, "25m").click();
  await step(page, "+1s");
  for (let i = 0; i < 5; i++) await step(page);
  const lead = incoming(page).locator(".primary-segment");
  const trail = incoming(page).locator(".trailing-segment");
  await expect(lead).toHaveAttribute("data-activity", "timer");
  await expect(incoming(page)).toHaveCSS("opacity", "1");
  await expect.poll(async () => (await pose(lead)).x).toBe(220);
  await expect.poll(async () => (await pose(trail)).x).toBe(-220);
  await step(page, "+20ms");
  await expect.poll(async () => (await pose(lead)).x).toBeLessThan(220);
  const timerX = (await pose(lead)).x;
  await battery(page, "Critical");
  await expect(lead).toHaveAttribute("data-activity", "battery");
  await expect(incoming(page)).toHaveCSS("opacity", "1");
  await expect
    .poll(async () => (await pose(lead)).x)
    .toBeCloseTo(220 - timerX, 3);
  await expect
    .poll(async () => (await pose(trail)).x + 220)
    .toBeCloseTo(timerX, 3);
  await button(page, "Reduced Motion").click();
  await expect.poll(async () => (await pose(lead)).x).toBe(0);
  await expect.poll(async () => (await pose(trail)).x).toBe(0);
  await expect(incoming(page)).toHaveCSS("opacity", "1");
});

test("Satellites emerge with springs, reverse without alpha jumps, and retime in Reduced", async ({
  page,
}) => {
  await button(page, "25m").click();
  await battery(page, "Low");
  await button(page, "Add").click();
  const dot = page.locator('.satellite[data-mark="battery"]');
  await step(page);
  await expect.poll(async () => (await pose(dot)).opacity).toBeGreaterThan(0.7);
  expect((await pose(dot)).opacity).toBeLessThan(0.8);
  const first = await pose(dot);
  const width = parseFloat(
    await island(page).evaluate((element) => getComputedStyle(element).width),
  );
  expect(first.x).toBeCloseTo(width / 2 - 28 + 34 * first.opacity, 2);
  await button(page, "Controls").click();
  await expect(dot).toHaveAttribute("data-leaving", "true");
  expect((await pose(dot)).opacity).toBeCloseTo(first.opacity, 5);
  await step(page, "+20ms");
  await expect
    .poll(async () => (await pose(dot)).opacity)
    .toBeLessThan(first.opacity);
  const leaving = await pose(dot);
  await button(page, "Collapse").click();
  await expect(dot).toHaveAttribute("data-leaving", "false");
  expect((await pose(dot)).opacity).toBeCloseTo(leaving.opacity, 5);
  await button(page, "Reduced Motion").click();
  expect((await pose(dot)).opacity).toBeCloseTo(leaving.opacity, 5);
  await step(page);
  await expect(dot).toHaveCSS("opacity", "1");
});

test("overflow is an animated stable mark, not an instant counter", async ({
  page,
}) => {
  await button(page, "25m").click();
  for (let i = 0; i < 3; i++) await button(page, "Add").click();
  const dot = page.locator('.satellite[data-mark="overflow"]');
  await expect(dot).toHaveText("+1");
  await expect(dot).toHaveCSS("opacity", "0");
  await step(page);
  await expect.poll(async () => (await pose(dot)).opacity).toBeGreaterThan(0.7);
  const before = await pose(dot);
  const element = await dot.elementHandle();
  await button(page, "Add").click();
  await expect(dot).toHaveText("+2");
  expect(await element?.evaluate((node) => node.isConnected)).toBe(true);
  expect((await pose(dot)).opacity).toBeCloseTo(before.opacity, 5);
});

test("Reduced retimes unchanged album art and active detail navigation", async ({
  page,
}) => {
  await button(page, "Start").click();
  await step(page, "+1s");
  await button(page, "Change").click();
  await step(page, "+20ms");
  const art = incoming(page).locator(".art-dissolve > div").last();
  await expect.poll(async () => (await pose(art)).opacity).toBeGreaterThan(0);
  const before = (await pose(art)).opacity;
  await button(page, "Reduced Motion").click();
  expect((await pose(art)).opacity).toBeCloseTo(before, 5);
  await step(page);
  await expect(incoming(page).locator(".art-dissolve > div")).toHaveCount(1);
  await expect(art).toHaveCSS("opacity", "1");
  await button(page, "Baseline").click();
  await controls(page);
  await button(page, "Wi-Fi details").click();
  await step(page, "+20ms");
  const wifi = layer(page, "wifi");
  await expect.poll(async () => (await pose(wifi)).opacity).toBeGreaterThan(0);
  const alpha = (await pose(wifi)).opacity;
  await button(page, "Reduced Motion").click();
  await expect.poll(async () => (await pose(wifi)).x).toBe(0);
  expect((await pose(wifi)).opacity).toBeCloseTo(alpha, 5);
  await step(page);
  await expect(wifi).toHaveCSS("opacity", "1");
  await expect(incoming(page).locator(".navigation-layer")).toHaveCount(1);
});

test("Reduced retimes active overlay fades without changing their current alpha", async ({
  page,
}) => {
  await button(page, "0.3.5 Mechanical Morph").click();
  await button(page, "Normal").click();
  await step(page, "+20ms");
  const banner = page.locator(".banner");
  await expect
    .poll(async () => (await pose(banner)).opacity)
    .toBeGreaterThan(0);
  const alpha = (await pose(banner)).opacity;
  await button(page, "Reduced Motion").click();
  expect((await pose(banner)).opacity).toBeCloseTo(alpha, 5);
  await step(page);
  await expect(banner).toHaveCSS("opacity", "1");
});

test("20ms timer stepping agrees with a single 1s step at the displayed second boundary", async ({
  page,
}) => {
  await button(page, "25m").click();
  for (let i = 0; i < 50; i++) await step(page, "+20ms");
  await expect(incoming(page).locator(".timer-number")).toHaveText("24:59");
  await button(page, "Reset").click();
  await button(page, "25m").click();
  await step(page, "+1s");
  await expect(incoming(page).locator(".timer-number")).toHaveText("24:59");
});
