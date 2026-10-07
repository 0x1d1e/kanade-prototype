import type { Mode } from "./model";

// Ported from kanade/src/island/geometry.rs. Screen CSS pixels correspond to Amane logical pixels.
export const shapes = {
  rest: [150, 32, 16],
  compact: [220, 38, 19],
  split: [300, 38, 19],
  peek: [300, 52, 26],
  controls: [440, 290, 32],
  media: [440, 216, 32],
  notifications: [520, 330, 32],
  launcher: [520, 330, 32],
} satisfies Record<string, number[]>;
export type Presentation = keyof typeof shapes;
export const timings = {
  expand: 180,
  collapse: 180,
  surface: 220,
  hover: 120,
  grace: 250,
  hold: 5000,
  osd: 1200,
  reduced: 80,
};

// Closed-form critically damped group, including velocity continuity on retarget.
// This intentionally does not substitute Motion's spring defaults for the Rust model.
export class Spring {
  target: number[];
  a: number[];
  b: number[];
  w = 0;
  start: number | null = null;
  reduced = false;
  constructor(value: number[]) {
    this.target = [...value];
    this.a = value.map(() => 0);
    this.b = [...this.a];
  }
  to(target: number[], response: number, now: number, reduced = false) {
    const position = this.at(now),
      velocity = this.velocity(now);
    this.w = reduced ? 0 : 4.744 / (response / 1000);
    this.a = target.map((v, i) => v - position[i]);
    this.b = this.a.map((v, i) => this.w * v - velocity[i]);
    this.target = [...target];
    this.start = now;
    this.reduced = reduced;
  }
  elapsed(now: number) {
    return this.start === null ? 0 : Math.max(0, now - this.start) / 1000;
  }
  settled(now: number) {
    if (this.start === null) return true;
    const t = this.elapsed(now);
    if (this.reduced) return t >= 0.08;
    const decay = Math.exp(-this.w * t);
    return (
      (1 + this.w * t) * decay <= 1 / 256 &&
      this.a.every(
        (a, i) =>
          Math.abs((a + this.b[i] * t) * decay) <= 0.5 &&
          Math.abs((this.w * (a + this.b[i] * t) - this.b[i]) * decay) <= 5,
      )
    );
  }
  at(now: number) {
    if (this.reduced || this.settled(now)) return [...this.target];
    const t = this.elapsed(now),
      decay = Math.exp(-this.w * t);
    return this.target.map((v, i) => v - (this.a[i] + this.b[i] * t) * decay);
  }
  velocity(now: number) {
    if (this.reduced || this.settled(now)) return this.target.map(() => 0);
    const t = this.elapsed(now),
      decay = Math.exp(-this.w * t);
    return this.a.map(
      (v, i) => (this.w * (v + this.b[i] * t) - this.b[i]) * decay,
    );
  }
  progress(now: number) {
    if (this.settled(now)) return 1;
    const t = this.elapsed(now);
    if (this.reduced) return Math.min(1, t / 0.08);
    const decay = Math.exp(-this.w * t);
    const i = this.a.reduce(
      (best, a, i) => (Math.abs(a) > Math.abs(this.a[best]) ? i : best),
      0,
    );
    const left =
      this.a[i] === 0
        ? (1 + this.w * t) * decay
        : ((this.a[i] + this.b[i] * t) * decay) / this.a[i];
    return Math.max(0, Math.min(1, 1 - left));
  }
}
export function handoff(mode: Mode) {
  return mode === "mechanical" ? 0.35 : 0.5;
}

function contentOpacity(progress: number, split: number) {
  return {
    out: Math.max(0, 1 - progress / split),
    into: Math.max(0, Math.min(1, (progress - split) / (1 - split))),
  };
}

// kanade/src/island/fade.rs: take over the visible frame at its current opacity.
export class Crossfade<T> {
  from: { content: T; opacity: number } | null = null;
  start = 1;
  constructor(
    public target: T,
    private same: (a: T, b: T) => boolean,
  ) {}
  shown(progress: number, split = 0.5): { content: T; opacity: number }[] {
    const { out, into } = contentOpacity(progress, split);
    return [
      this.from && {
        content: this.from.content,
        opacity: this.from.opacity * out,
      },
      { content: this.target, opacity: this.start + (1 - this.start) * into },
    ].filter((v): v is { content: T; opacity: number } => !!v && v.opacity > 0);
  }
  to(next: T, progress: number, reveal = 0.5, force = false) {
    if (!force && this.same(this.target, next)) {
      this.target = next;
      return false;
    }
    const showing = this.shown(progress, reveal)[0];
    if (showing && this.same(showing.content, next)) {
      this.from = null;
      this.start = showing.opacity;
    } else {
      this.from = showing ?? null;
      this.start = 0;
    }
    this.target = next;
    return true;
  }
  opacity(progress: number, split = 0.5) {
    const { out, into } = contentOpacity(progress, split);
    return {
      out: (this.from?.opacity ?? 0) * out,
      into: this.start + (1 - this.start) * into,
    };
  }
}

// A new in-place frame rises over the old on its own spring, with no opacity dip.
export class Dissolve<T> {
  previous: T | null = null;
  spring = new Spring([1]);
  private startRise = 0;
  private reduced = false;
  constructor(
    public target: T,
    private same: (a: T, b: T) => boolean,
  ) {}
  to(next: T, now: number, mode: Mode) {
    const reduced = mode === "reduced";
    // Equal art still needs retiming when Reduced Motion changes mid-dissolve.
    if (reduced !== this.reduced && !this.spring.settled(now)) {
      this.startRise = this.rise(now);
      this.spring = new Spring([this.startRise]);
      this.spring.to([1], timings.surface, now, reduced);
    }
    this.reduced = reduced;
    if (this.same(this.target, next)) {
      this.target = next;
      return;
    }
    const previous = this.target;
    this.target = next;
    if (
      this.previous !== null &&
      !this.spring.settled(now) &&
      this.rise(now) < 0.5
    )
      return;
    this.previous = previous;
    this.startRise = 0;
    this.spring = new Spring([0]);
    this.spring.to([1], timings.surface, now, reduced);
  }
  rise(now: number) {
    return this.startRise + (1 - this.startRise) * this.spring.progress(now);
  }
  from(now: number) {
    return this.spring.settled(now) ? null : this.previous;
  }
}

export function response(from: Presentation, to: Presentation, mode: Mode) {
  if (mode === "reduced") return timings.reduced;
  const surface = (p: Presentation) =>
    ["controls", "media", "notifications", "launcher"].includes(p);
  const change = surface(from) && surface(to);
  const shrinking =
    shapes[to][0] < shapes[from][0] || shapes[to][1] < shapes[from][1];
  return change
    ? timings.surface
    : shrinking
      ? timings.collapse
      : timings.expand;
}
