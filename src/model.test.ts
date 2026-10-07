import { describe, expect, it } from "vitest";
import {
  type Action,
  frame,
  initialState,
  presentation,
  reducer,
  type State,
  searchApps,
} from "./model";

function run(actions: Action[], s: State = initialState()) {
  return actions.reduce(reducer, s);
}
describe("local Kanade simulation", () => {
  it("starts at Rest and preserves state across mode switches", () => {
    const s = run([
      { type: "media", command: "start" },
      { type: "mode", mode: "mechanical" },
    ]);
    expect(presentation(initialState())).toBe("rest");
    expect(presentation(s)).toBe("compact");
    expect(s.activities[0].track).toBe(0);
  });
  it("uses actual priority order: ongoing timer above media, media never a Satellite", () => {
    const s = run([
      { type: "media", command: "start" },
      { type: "timer", command: "start" },
    ]);
    expect(frame(s).primary?.kind).toBe("timer");
    expect(frame(s).satellites).toHaveLength(0);
  });
  it("dwells for 1500ms before equal-priority arrival changes primary", () => {
    let s = run([
      { type: "timer", command: "start" },
      { type: "battery", value: 18 },
    ]);
    expect(s.primary).toBe("timer");
    expect(presentation(s)).toBe("split");
    s = reducer(s, { type: "advance", ms: 1500 });
    expect(s.primary).toBe("battery");
    expect(frame(s).satellites[0].id).toBe("timer");
  });
  it("caps Satellites and counts overflow", () => {
    const s = run([
      { type: "timer", command: "start" },
      ...Array.from(
        { length: 4 },
        (): Action => ({ type: "satellite", add: true }),
      ),
    ]);
    expect(frame(s).satellites).toHaveLength(2);
    expect(frame(s).overflow).toBe(2);
  });
  it("workspace expires and previous media returns without repost", () => {
    const s = run([
      { type: "media", command: "start" },
      { type: "workspace" },
      { type: "advance", ms: 1200 },
    ]);
    expect(s.primary).toBe("media");
  });
  it("critical battery preempts once and remains critical until cleared", () => {
    let s = run([
      { type: "open", surface: "controls" },
      { type: "battery", value: 5 },
    ]);
    expect(s.raised).toBeNull();
    s = run(
      [
        { type: "open", surface: "launcher" },
        { type: "battery", value: 18 },
      ],
      s,
    );
    expect(s.raised).toEqual({ type: "surface", surface: "launcher" });
    expect(s.activities[0].priority).toBe(5);
  });
  it("peeks after 120ms, collapses after 250ms grace", () => {
    let s = run([
      { type: "media", command: "start" },
      { type: "enter", id: "media" },
      { type: "advance", ms: 119 },
    ]);
    expect(presentation(s)).toBe("compact");
    s = reducer(s, { type: "advance", ms: 1 });
    expect(presentation(s)).toBe("peek");
    s = run([{ type: "leave" }, { type: "advance", ms: 249 }], s);
    expect(presentation(s)).toBe("peek");
    expect(presentation(reducer(s, { type: "advance", ms: 1 }))).toBe(
      "compact",
    );
  });
  it("right-click Rest opens Controls pinned and does not hold", () => {
    const s = run([
      { type: "pin" },
      { type: "leave" },
      { type: "advance", ms: 10000 },
    ]);
    expect(presentation(s)).toBe("controls");
    expect(s.pinned).toBe(true);
    expect(s.holdAt).toBeNull();
    expect(reducer(s, { type: "open", surface: "launcher" }).pinned).toBe(
      false,
    );
  });
  it("keyboard opens hold for 5s; pointer entry trades hold for grace", () => {
    const s = run([
      { type: "open", surface: "controls" },
      { type: "advance", ms: 4999 },
    ]);
    expect(presentation(s)).toBe("controls");
    expect(presentation(reducer(s, { type: "advance", ms: 1 }))).toBe("rest");
    expect(
      presentation(run([{ type: "enter" }, { type: "advance", ms: 10000 }], s)),
    ).toBe("controls");
  });
  it("withdrawal of peeked activity clears Pin", () => {
    const s = run([
      { type: "media", command: "start" },
      { type: "pin", id: "media" },
      { type: "media", command: "stop" },
    ]);
    expect(s.pinned).toBe(false);
    expect(presentation(s)).toBe("rest");
  });
  it("paused media withdraws after 30s", () => {
    const s = run([
      { type: "media", command: "start" },
      { type: "media", command: "pause" },
      { type: "advance", ms: 30000 },
    ]);
    expect(s.activities).toHaveLength(0);
  });
  it("timer pause preserves remaining time and expiry posts notification", () => {
    let s = run([
      { type: "timer", command: "start", seconds: 5 },
      { type: "timer", command: "pause" },
      { type: "advance", ms: 6000 },
    ]);
    expect(s.activities[0].seconds).toBe(5);
    s = run(
      [
        { type: "timer", command: "pause" },
        { type: "advance", ms: 5000 },
      ],
      s,
    );
    expect(s.activities).toHaveLength(0);
    expect(s.notices[0].title).toBe("Timer finished");
    expect(s.banners[0]?.notice.title).toBe("Timer finished");
    expect(s.banners[0]?.remaining).toBe(6000);
  });
  it("OSD replaces and restarts expiry", () => {
    let s = run([
      { type: "level", kind: "volume", value: 42 },
      { type: "advance", ms: 1000 },
      { type: "level", kind: "brightness", value: 80 },
      { type: "advance", ms: 1100 },
    ]);
    expect(s.osd?.kind).toBe("brightness");
    s = reducer(s, { type: "advance", ms: 100 });
    expect(s.osd).toBeNull();
  });
  it("Banner closes and expires without removing history", () => {
    let s = run([{ type: "notice" }, { type: "bannerClose", id: 1 }]);
    expect(s.notices).toHaveLength(1);
    s = run(
      [
        { type: "notice", urgency: "low" },
        { type: "advance", ms: 4000 },
      ],
      s,
    );
    expect(s.banners).toHaveLength(0);
    expect(s.notices).toHaveLength(2);
  });
  it("hover pauses every Banner and queues more than three", () => {
    const s = run([
      { type: "notice" },
      { type: "notice" },
      { type: "notice" },
      { type: "notice", urgency: "critical" },
      { type: "bannerHover", inside: true },
      { type: "advance", ms: 10000 },
    ]);
    expect(s.banners).toHaveLength(3);
    expect(s.queue).toHaveLength(1);
    const closed = reducer(s, { type: "bannerClose", id: 1 });
    expect(closed.banners[0].notice.urgency).toBe("critical");
  });
  it("DND drops normal Banners and queued ones, not history or Critical", () => {
    const s = run([
      { type: "notice" },
      { type: "toggle", key: "dnd" },
      { type: "notice" },
      { type: "notice", urgency: "critical" },
    ]);
    expect(s.notices).toHaveLength(3);
    expect(s.banners).toHaveLength(1);
    expect(s.banners[0].notice.urgency).toBe("critical");
  });
  it("privacy never enters arbitration", () => {
    const s = run([
      { type: "privacy", key: "microphone" },
      { type: "privacy", key: "capture" },
    ]);
    expect(s.activities).toHaveLength(0);
    expect(presentation(s)).toBe("rest");
  });
  it("large steps process timer expiry and queued Banner deadlines at their actual times", () => {
    const start = run([
      { type: "timer", command: "start", seconds: 5 },
      { type: "notice" },
      { type: "notice" },
      { type: "notice" },
      { type: "notice" },
    ]);
    const one = reducer(start, { type: "advance", ms: 8000 });
    const many = run(
      Array.from({ length: 80 }, (): Action => ({ type: "advance", ms: 100 })),
      start,
    );
    expect(one).toEqual(many);
  });
  it("replays deterministically with large or small steps", () => {
    const start = reducer(initialState(), { type: "replay", name: "overlays" });
    const one = reducer(start, { type: "advance", ms: 9000 });
    const many = run(
      Array.from({ length: 90 }, (): Action => ({ type: "advance", ms: 100 })),
      start,
    );
    expect(one).toEqual(many);
  });
  it("search ranks name starts and supports empty results", () => {
    expect(searchApps("fire")[0].name).toBe("Firefox");
    expect(searchApps("not-an-app")).toHaveLength(0);
  });
});
