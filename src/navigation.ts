import type { Mode } from "./model";
import { Spring, timings } from "./motion";

type Layer<T> = {
  key: string;
  content: T;
  x: number;
  opacity: number;
  goalX: number;
  goalOpacity: number;
};
export type NavigationFrame<T> = {
  key: string;
  content: T;
  x: number;
  opacity: number;
};

// Content-only navigation: body geometry and its crossfade never enter this channel.
export class Navigation<T> {
  private layers: Layer<T>[];
  private spring = new Spring([1]);
  private reduced = false;
  constructor(
    value: T,
    private key: string,
  ) {
    this.layers = [
      { key, content: value, x: 0, opacity: 1, goalX: 0, goalOpacity: 1 },
    ];
  }

  to(value: T, key: string, now: number, mode: Mode, direction: 1 | -1) {
    const reduced = mode === "reduced";
    if (
      key === this.key &&
      (reduced === this.reduced || this.spring.settled(now))
    ) {
      const target = this.layers.find((layer) => layer.key === key);
      if (target) target.content = value;
      this.reduced = reduced;
      return;
    }
    const showing = this.shown(now);
    this.reduced = reduced;
    // Retain every visible layer on interruption, including both sides of a reversal.
    this.layers = showing
      .filter((layer) => layer.opacity > 0 || layer.key === key)
      .map((layer) => ({
        ...layer,
        content: layer.key === key ? value : layer.content,
        goalX: layer.key === key ? 0 : -12 * direction,
        goalOpacity: layer.key === key ? 1 : 0,
      }));
    if (!this.layers.some((layer) => layer.key === key))
      this.layers.push({
        key,
        content: value,
        x: 12 * direction,
        opacity: 0,
        goalX: 0,
        goalOpacity: 1,
      });
    this.key = key;
    this.spring = new Spring([0]);
    this.spring.to([1], timings.surface, now, reduced);
  }

  shown(now: number): NavigationFrame<T>[] {
    const progress = this.spring.progress(now);
    return this.layers
      .filter((layer) => !this.spring.settled(now) || layer.key === this.key)
      .map((layer) => ({
        key: layer.key,
        content: layer.content,
        x: this.reduced ? 0 : layer.x + (layer.goalX - layer.x) * progress,
        opacity: layer.opacity + (layer.goalOpacity - layer.opacity) * progress,
      }));
  }
}
