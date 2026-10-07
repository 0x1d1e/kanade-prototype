import { describe, expect, it } from "vitest";
import type { SatelliteMark } from "./model";
import { Satellites, satellitePosition } from "./satellites";

const activity = (key: string): SatelliteMark => ({
  key,
  activity: { id: key, kind: "timer", priority: 3, posted: 0, sequence: 1 },
});
const overflow = (count: number): SatelliteMark => ({
  key: "overflow",
  overflow: count,
});
const a = activity("a"),
  b = activity("b");

describe("Rust Satellite spring port", () => {
  it("emerges with the baseline presence spring and tucked geometry", () => {
    const dots = new Satellites();
    dots.follow([a], 0, "baseline");
    expect(dots.shown(0)[0]).toMatchObject({
      slot: 0,
      presence: 0,
      opacity: 0,
    });
    expect(satellitePosition(300, 38, 0, 0)).toEqual({ x: 122, y: 5 });
    expect(satellitePosition(300, 38, 0, 1)).toEqual({ x: 156, y: 5 });
    expect(dots.shown(180)[0]).toMatchObject({ slot: 0 });
    expect(dots.shown(180)[0].presence).toBeCloseTo(0.95, 3);
    expect(dots.shown(180)[0].opacity).toBeCloseTo(0.95, 3);
    expect(satellitePosition(440, 290, 1, 1)).toEqual({ x: 190, y: 12 });
  });
  it("preserves opacity and position through withdrawal and return", () => {
    const dots = new Satellites();
    dots.follow([a], 0, "baseline");
    const before = dots.shown(60)[0];
    dots.follow([], 60, "baseline");
    const leaving = dots.shown(60)[0];
    expect(leaving.opacity).toBeCloseTo(before.opacity);
    expect(leaving.presence).toBeCloseTo(before.presence);
    const turning = dots.shown(80)[0];
    dots.follow([a], 80, "baseline");
    expect(dots.shown(80)[0].opacity).toBeCloseTo(turning.opacity);
    expect(dots.shown(80)[0].presence).toBeCloseTo(turning.presence);
    expect(dots.shown(1000)[0]).toMatchObject({
      presence: 1,
      opacity: 1,
      leaving: false,
    });
  });
  it("reorders via a slot spring, independently of opacity", () => {
    const dots = new Satellites();
    dots.follow([a, b], 0, "baseline");
    dots.follow([b, a], 1000, "baseline");
    expect(dots.shown(1000).map(({ slot }) => slot)).toEqual([0, 1]);
    const moving = dots.shown(1060);
    expect(moving[0].slot).toBeGreaterThan(0);
    expect(moving[0].slot).toBeLessThan(1);
    expect(moving[1].slot).toBeGreaterThan(0);
    expect(moving[1].slot).toBeLessThan(1);
    expect(moving.every(({ opacity }) => opacity === 1)).toBe(true);
    const before = dots.shown(1080);
    dots.follow([a, b], 1080, "baseline");
    expect(dots.shown(1080)).toEqual(before);
    expect(dots.shown(2000).map(({ slot }) => slot)).toEqual([0, 1]);
  });
  it("draws leaving marks below staying marks, pruning only settled exits", () => {
    const dots = new Satellites();
    dots.follow([a, b], 0, "baseline");
    dots.follow([b], 1000, "baseline");
    expect(
      dots.shown(1020).map(({ mark, leaving }) => [mark.key, leaving]),
    ).toEqual([
      ["a", true],
      ["b", false],
    ]);
    dots.follow([b], 2000, "baseline");
    expect(dots.shown(2000)).toHaveLength(1);
  });
  it("overflow count updates keep the existing mark and motion leg", () => {
    const dots = new Satellites();
    dots.follow([a, overflow(1)], 0, "baseline");
    const before = dots.shown(20)[1];
    dots.follow([a, overflow(4)], 20, "baseline");
    expect(dots.shown(20)[1]).toEqual({ ...before, mark: overflow(4) });
    expect(dots.shown(180)[1].opacity).toBeCloseTo(0.95, 3);
    dots.follow([overflow(2)], 1000, "baseline");
    expect(
      dots.shown(1060).find(({ mark }) => mark.key === "overflow")?.slot,
    ).toBeLessThan(1);
  });
  it("Reduced retimes active presence without jumping opacity and snaps slots", () => {
    const dots = new Satellites();
    dots.follow([a, b], 0, "baseline");
    const before = dots.shown(20);
    dots.follow([b, a], 20, "reduced");
    const after = dots.shown(20);
    expect(after.map(({ opacity }) => opacity)).toEqual(
      before.map(({ opacity }) => opacity),
    );
    expect(after.map(({ presence }) => presence)).toEqual([1, 1]);
    expect(after.map(({ slot }) => slot)).toEqual([1, 0]);
    expect(dots.shown(100).every(({ opacity }) => opacity === 1)).toBe(true);
    dots.follow([], 100, "reduced");
    expect(
      dots
        .shown(140)
        .every(({ opacity, presence }) => opacity === 0.5 && presence === 0),
    ).toBe(true);
    dots.follow([], 180, "reduced");
    expect(dots.shown(180)).toHaveLength(0);
  });
});
