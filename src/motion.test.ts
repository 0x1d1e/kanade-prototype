import { describe, expect, it } from "vitest";
import {
  Crossfade,
  Dissolve,
  handoff,
  type Presentation,
  response,
  Spring,
  shapes,
} from "./motion";

describe("Rust content transition port", () => {
  it("preserves the showing frame and opacity on every interruption and reversal", () => {
    for (const first of ["rest", "compact", "controls"])
      for (const next of ["rest", "compact", "launcher"]) {
        for (let step = 0; step <= 100; step++) {
          const fade = new Crossfade("rest", (a, b) => a === b);
          fade.to(first, 1);
          fade.to("controls", 0);
          const before = fade.shown(step / 100);
          fade.to(next, step / 100);
          expect(fade.shown(0)).toEqual(before);
          for (let progress = 0; progress <= 1; progress += 0.1)
            expect(fade.shown(progress).length).toBeLessThanOrEqual(1);
        }
      }
  });
  it("returning to the visible frame grows from its inherited alpha, without dipping", () => {
    const fade = new Crossfade("compact", (a, b) => a === b);
    fade.to("controls", 1);
    fade.to("compact", 0.2);
    expect(fade.opacity(0).into).toBeCloseTo(0.6);
    for (let p = 0; p <= 1; p += 0.01) {
      expect(fade.opacity(p).into).toBeGreaterThanOrEqual(0.6);
      expect(fade.opacity(p).out).toBe(0);
    }
  });
  it("Mechanical uses one 35% handoff, with no positive-length empty-content interval", () => {
    for (const mode of ["baseline", "mechanical"] as const) {
      const split = handoff(mode);
      const fade = new Crossfade("rest", (a, b) => a === b);
      fade.to("controls", 1, split);
      for (let index = 0; index <= 1000; index++) {
        const p = index / 1000;
        const alpha = fade.opacity(p, split);
        if (p !== split) expect(alpha.out + alpha.into).toBeGreaterThan(0);
        expect(alpha.out === 0 || alpha.into === 0).toBe(true);
      }
      expect(fade.opacity(split, split)).toEqual({ out: 0, into: 0 });
      const before = fade.shown(split / 2, split);
      fade.to("launcher", split / 2, split);
      expect(fade.shown(0, split)).toEqual(before);
    }
    expect(handoff("mechanical")).toBe(0.35);
  });
  it("Reduced retimes unchanged active art, preserving rise and finishing in 80ms", () => {
    const dissolve = new Dissolve("first", (a, b) => a === b);
    dissolve.to("second", 0, "baseline");
    const before = dissolve.rise(20);
    dissolve.to("second", 20, "reduced");
    expect(dissolve.rise(20)).toBe(before);
    expect(dissolve.rise(60)).toBeCloseTo(before + (1 - before) * 0.5);
    expect(dissolve.rise(100)).toBe(1);
    expect(dissolve.from(100)).toBeNull();
  });
  it("restoring baseline during a reduced dissolve preserves its visible rise", () => {
    const dissolve = new Dissolve("first", (a, b) => a === b);
    dissolve.to("second", 0, "reduced");
    expect(dissolve.rise(20)).toBe(0.25);
    dissolve.to("second", 20, "baseline");
    expect(dissolve.rise(20)).toBe(0.25);
    expect(dissolve.rise(240)).toBeCloseTo(0.25 + 0.75 * 0.95, 3);
  });
  it("Dissolve retains the old opaque art and takes over the same spring before halfway", () => {
    const dissolve = new Dissolve("first", (a, b) => a === b);
    dissolve.to("second", 0, "baseline");
    expect(dissolve.from(20)).toBe("first");
    const alpha = dissolve.spring.progress(20);
    dissolve.to("third", 20, "baseline");
    expect(dissolve.from(20)).toBe("first");
    expect(dissolve.spring.progress(20)).toBe(alpha);
    dissolve.to("fourth", 200, "baseline");
    expect(dissolve.from(200)).toBe("third");
    expect(dissolve.spring.progress(200)).toBe(0);
    expect(dissolve.from(1200)).toBeNull();
  });
});

describe("Rust spring port", () => {
  it("covers 95% at configured response and settles without overshoot", () => {
    const spring = new Spring(shapes.rest);
    spring.to(shapes.controls, 180, 0);
    expect(spring.progress(180)).toBeCloseTo(0.95, 3);
    for (let t = 0; t < 1000; t++) {
      const [w, h] = spring.at(t);
      expect(w).toBeGreaterThanOrEqual(150);
      expect(w).toBeLessThanOrEqual(440);
      expect(h).toBeLessThanOrEqual(290);
    }
    expect(spring.settled(1000)).toBe(true);
    expect(spring.at(1000)).toEqual(shapes.controls);
  });
  it("retargets from current position and velocity", () => {
    const spring = new Spring(shapes.rest);
    spring.to(shapes.controls, 180, 0);
    const position = spring.at(65),
      velocity = spring.velocity(65);
    spring.to(shapes.rest, 180, 65);
    expect(spring.at(65)).toEqual(position);
    spring.velocity(65).forEach((v, i) => {
      expect(v).toBeCloseTo(velocity[i], 8);
    });
  });
  it("same-shape Surface changes still progress a content fade", () => {
    const spring = new Spring(shapes.launcher);
    spring.to(shapes.notifications, 220, 0);
    expect(spring.progress(0)).toBe(0);
    expect(spring.progress(220)).toBeCloseTo(0.95, 3);
  });
  it("Reduced Motion snaps geometry and fades only over 80ms", () => {
    const spring = new Spring(shapes.rest);
    spring.to(shapes.launcher, 180, 0, true);
    expect(spring.at(0)).toEqual(shapes.launcher);
    expect(spring.progress(40)).toBe(0.5);
    expect(spring.settled(80)).toBe(true);
  });
  it("experiment does not alter baseline targets or response", () => {
    expect(response("rest", "controls", "baseline")).toBe(180);
    expect(response("controls", "launcher", "baseline")).toBe(220);
    expect(response("rest", "controls", "mechanical")).toBe(180);
    expect(response("controls", "launcher", "mechanical")).toBe(220);
    expect(response("controls", "rest", "mechanical")).toBe(180);
    for (const from of Object.keys(shapes) as Presentation[])
      for (const to of Object.keys(shapes) as Presentation[])
        expect(response(from, to, "mechanical")).toBe(
          response(from, to, "baseline"),
        );
    expect(shapes.launcher).toEqual([520, 330, 32]);
  });
});
