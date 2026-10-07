import type { Mode } from "./model";
import { Spring, timings } from "./motion";

export type SplitPair = readonly [string, string] | null;

// kanade/src/island/service.rs: reversed segments slide in place, never crossfade.
export class SplitSwap {
  private pair: SplitPair = null;
  private spring = new Spring([0]);
  private reduced = false;

  follow(pair: SplitPair, now: number, mode: Mode) {
    const reduced = mode === "reduced";
    if (reduced !== this.reduced && !this.spring.settled(now))
      this.spring.to([0], timings.expand, now, reduced);
    this.reduced = reduced;
    const swapped = !!(
      pair &&
      this.pair &&
      pair[0] !== pair[1] &&
      pair[0] === this.pair[1] &&
      pair[1] === this.pair[0]
    );
    if (swapped) {
      this.spring = new Spring([1 - this.at(now)]);
      this.spring.to([0], timings.expand, now, reduced);
    } else if (
      !pair ||
      !this.pair ||
      pair.some((id, i) => id !== this.pair?.[i])
    ) {
      this.spring = new Spring([0]);
    }
    this.pair = pair;
    return swapped;
  }

  at(now: number) {
    return this.spring.at(now)[0];
  }
}
