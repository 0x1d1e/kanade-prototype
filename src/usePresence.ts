import { useLayoutEffect, useRef, useState } from "react";

type Entry<T> = {
  key: string;
  item: T;
  start: number;
  from: number;
  target: number;
};
function opacity<T>(entry: Entry<T>, now: number, duration: number) {
  const progress = duration
    ? Math.max(0, Math.min(1, (now - entry.start) / duration))
    : 1;
  return entry.from + (entry.target - entry.from) * progress;
}

// Retain exiting frames, but drive their visibility with the same clock as geometry/events.
export function usePresence<T>(
  items: T[],
  now: number,
  duration: number,
  key: (item: T) => string,
) {
  const [entries, setEntries] = useState<Entry<T>[]>(() =>
    items.map((item) => ({
      key: key(item),
      item,
      start: now,
      from: 1,
      target: 1,
    })),
  );
  const previousTime = useRef(now);
  useLayoutEffect(() => {
    const reset = now < previousTime.current;
    previousTime.current = now;
    setEntries((previous) => {
      const existing = reset ? [] : previous;
      const next = items.map((item) => {
        const found = existing.find((entry) => entry.key === key(item));
        if (!found)
          return { key: key(item), item, start: now, from: 0, target: 1 };
        if (found.target === 0)
          return {
            ...found,
            item,
            from: opacity(found, now, duration),
            target: 1,
            start: now,
          };
        return found.item === item ? found : { ...found, item };
      });
      for (const entry of existing) {
        if (items.some((item) => key(item) === entry.key)) continue;
        const exit =
          entry.target === 0
            ? entry
            : {
                ...entry,
                from: opacity(entry, now, duration),
                target: 0,
                start: now,
              };
        if (opacity(exit, now, duration) > 0) next.push(exit);
      }
      return previous.length === next.length &&
        next.every((entry, i) => entry === previous[i])
        ? previous
        : next;
    });
  }, [items, now, duration, key]);
  return entries.map((entry) => ({
    key: entry.key,
    item: entry.item,
    opacity: opacity(entry, now, duration),
    exiting: entry.target === 0,
  }));
}
