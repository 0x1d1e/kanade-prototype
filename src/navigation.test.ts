import { describe, expect, it } from "vitest";
import { Navigation } from "./navigation";

describe("content-only Controls navigation", () => {
  it("translates 12px and crossfades without a blank frame", () => {
    const nav = new Navigation("Controls", "root");
    nav.to("Wi-Fi", "wifi", 0, "baseline", 1);
    expect(
      nav.shown(0).map(({ key, x, opacity }) => ({ key, x, opacity })),
    ).toEqual([
      { key: "root", x: 0, opacity: 1 },
      { key: "wifi", x: 12, opacity: 0 },
    ]);
    for (let now = 0; now <= 500; now++) {
      const frames = nav.shown(now);
      expect(frames.reduce((sum, frame) => sum + frame.opacity, 0)).toBeCloseTo(
        1,
      );
    }
    expect(nav.shown(100)[0].x).toBeLessThan(0);
    expect(nav.shown(100)[1].x).toBeGreaterThan(0);
    expect(nav.shown(1000)).toEqual([
      { key: "wifi", content: "Wi-Fi", x: 0, opacity: 1 },
    ]);
  });
  it("Back reverses direction, preserving both visible layers on rapid reversal", () => {
    const nav = new Navigation("Controls", "root");
    nav.to("Wi-Fi", "wifi", 0, "baseline", 1);
    const before = nav.shown(100);
    nav.to("Controls", "root", 100, "baseline", -1);
    expect(nav.shown(100)).toEqual(before);
    const back = nav.shown(120);
    expect(back[0].x).toBeGreaterThan(before[0].x);
    expect(back[1].x).toBeGreaterThan(before[1].x);
    const reverse = nav.shown(120);
    nav.to("Wi-Fi", "wifi", 120, "baseline", 1);
    expect(nav.shown(120)).toEqual(reverse);
  });
  it("updates live controls without restarting a navigation leg", () => {
    const nav = new Navigation("Controls", "root");
    nav.to("Wi-Fi", "wifi", 0, "baseline", 1);
    const before = nav.shown(40);
    nav.to("Connected", "wifi", 40, "baseline", 1);
    expect(nav.shown(40)[1]).toEqual({ ...before[1], content: "Connected" });
    expect(nav.shown(220)[1].opacity).toBeCloseTo(0.95, 3);
  });
  it("Reduced snaps translation, preserves alpha, and completes in 80ms", () => {
    const nav = new Navigation("Controls", "root");
    nav.to("Wi-Fi", "wifi", 0, "baseline", 1);
    const before = nav.shown(20);
    nav.to("Wi-Fi", "wifi", 20, "reduced", 1);
    expect(nav.shown(20).map(({ opacity }) => opacity)).toEqual(
      before.map(({ opacity }) => opacity),
    );
    expect(nav.shown(20).every(({ x }) => x === 0)).toBe(true);
    expect(nav.shown(100)).toEqual([
      { key: "wifi", content: "Wi-Fi", x: 0, opacity: 1 },
    ]);
  });
  it("restoring normal motion mid-reduced fade does not jump alpha or position", () => {
    const nav = new Navigation("Controls", "root");
    nav.to("Wi-Fi", "wifi", 0, "reduced", 1);
    const before = nav.shown(20);
    nav.to("Wi-Fi", "wifi", 20, "baseline", 1);
    expect(nav.shown(20)).toEqual(before);
    expect(nav.shown(1000)).toHaveLength(1);
  });
});
