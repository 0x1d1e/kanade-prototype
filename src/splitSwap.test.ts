import { describe, expect, it } from "vitest";
import { SplitSwap } from "./splitSwap";

describe("Rust Split swap port", () => {
  it("only reversed Split pairs start a slide", () => {
    const swap = new SplitSwap();
    expect(swap.follow(["media", "timer"], 0, "baseline")).toBe(false);
    expect(swap.follow(["timer", "media"], 0, "baseline")).toBe(true);
    expect(swap.at(0)).toBe(1);
    expect(swap.at(180)).toBeCloseTo(0.05, 3);
    expect(swap.at(1000)).toBe(0);
    expect(swap.follow(["battery", "media"], 1000, "baseline")).toBe(false);
    expect(swap.follow(null, 1000, "baseline")).toBe(false);
  });
  it("trading back mid-slide reverses from the two actual segment positions", () => {
    const swap = new SplitSwap();
    swap.follow(["media", "timer"], 0, "baseline");
    swap.follow(["timer", "media"], 0, "baseline");
    const stood = swap.at(60);
    swap.follow(["media", "timer"], 60, "baseline");
    expect(swap.at(60)).toBeCloseTo(1 - stood);
    expect(220 * swap.at(60)).toBeCloseTo(220 - 220 * stood);
    expect(swap.at(80)).toBeLessThan(swap.at(60));
  });
  it("Reduced snaps an unchanged-target active swap", () => {
    const swap = new SplitSwap();
    swap.follow(["media", "timer"], 0, "baseline");
    swap.follow(["timer", "media"], 0, "baseline");
    expect(swap.at(20)).toBeGreaterThan(0);
    expect(swap.follow(["timer", "media"], 20, "reduced")).toBe(false);
    expect(swap.at(20)).toBe(0);
    swap.follow(["media", "timer"], 40, "reduced");
    expect(swap.at(40)).toBe(0);
  });
});
