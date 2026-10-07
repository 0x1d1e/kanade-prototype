import type { Mode, SatelliteMark } from "./model";
import { Spring, shapes, timings } from "./motion";

type Dot = {
  mark: SatelliteMark;
  place: number;
  slot: Spring;
  presence: Spring;
  faded: number;
  leaving: boolean;
};
export type ShownSatellite = {
  mark: SatelliteMark;
  slot: number;
  presence: number;
  opacity: number;
  leaving: boolean;
};

function opacity(dot: Dot, now: number) {
  return (
    dot.faded + ((dot.leaving ? 0 : 1) - dot.faded) * dot.presence.progress(now)
  );
}
function go(dot: Dot, leaving: boolean, now: number, reduced: boolean) {
  dot.faded = opacity(dot, now);
  dot.leaving = leaving;
  dot.presence.to(
    [leaving ? 0 : 1],
    leaving ? timings.collapse : timings.expand,
    now,
    reduced,
  );
}

// Port of kanade/src/island/satellites.rs, including stable overflow identity.
export class Satellites {
  private dots: Dot[] = [];
  private reduced = false;

  follow(marks: SatelliteMark[], now: number, mode: Mode) {
    this.dots = this.dots.filter(
      (dot) => !(dot.leaving && dot.presence.settled(now)),
    );
    const reduced = mode === "reduced";
    if (reduced !== this.reduced) {
      for (const dot of this.dots) {
        if (!dot.presence.settled(now)) go(dot, dot.leaving, now, reduced);
        if (!dot.slot.settled(now))
          dot.slot.to([dot.place], timings.expand, now, reduced);
      }
    }
    this.reduced = reduced;
    for (const dot of this.dots) {
      if (!dot.leaving && !marks.some((mark) => mark.key === dot.mark.key))
        go(dot, true, now, reduced);
    }
    marks.forEach((mark, place) => {
      const dot = this.dots.find((dot) => dot.mark.key === mark.key);
      if (!dot) {
        const presence = new Spring([0]);
        presence.to([1], timings.expand, now, reduced);
        this.dots.push({
          mark,
          place,
          slot: new Spring([place]),
          presence,
          faded: 0,
          leaving: false,
        });
        return;
      }
      dot.mark = mark;
      if (dot.leaving) go(dot, false, now, reduced);
      if (dot.place !== place) {
        dot.place = place;
        dot.slot.to([place], timings.expand, now, reduced);
      }
    });
  }

  shown(now: number): ShownSatellite[] {
    return [
      ...this.dots.filter((dot) => dot.leaving),
      ...this.dots.filter((dot) => !dot.leaving),
    ].map((dot) => ({
      mark: dot.mark,
      slot: dot.slot.at(now)[0],
      presence: Math.max(0, Math.min(1, dot.presence.at(now)[0])),
      opacity: Math.max(0, Math.min(1, opacity(dot, now))),
      leaving: dot.leaving,
    }));
  }
}

// island/geometry.rs::satellite_opacity: whole through Peek, gone by Media.
export function satelliteOpacity(height: number) {
  return (
    1 -
    Math.max(
      0,
      Math.min(
        1,
        (height - shapes.peek[1]) / (shapes.media[1] - shapes.peek[1]),
      ),
    )
  );
}

// Coordinates relative to the body's top center, from island/geometry.rs::satellite.
export function satellitePosition(
  width: number,
  height: number,
  slot: number,
  presence: number,
) {
  const size = 28,
    gap = 6;
  const end = Math.min(width, shapes.peek[0]) / 2;
  const tucked = end - size;
  const placed = end + gap + slot * (size + gap);
  return {
    x: tucked + (placed - tucked) * presence,
    y: (Math.min(height, shapes.peek[1]) - size) / 2,
  };
}
