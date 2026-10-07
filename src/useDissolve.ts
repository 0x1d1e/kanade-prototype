import { useLayoutEffect, useRef, useState } from "react";
import type { State } from "./model";
import { Dissolve } from "./motion";

type Frame<T> = { key: string; value: T };
export function useDissolve<T>(value: T, key: string, state: State) {
  const dissolve = useRef(
    new Dissolve<Frame<T>>({ key, value }, (a, b) => a.key === b.key),
  );
  const previousEpoch = useRef(state.epoch);
  const [shown, setShown] = useState({
    from: null as T | null,
    target: value,
    rise: 1,
  });
  useLayoutEffect(() => {
    if (state.epoch !== previousEpoch.current)
      dissolve.current = new Dissolve(
        { key, value },
        (a, b) => a.key === b.key,
      );
    previousEpoch.current = state.epoch;
    dissolve.current.to({ key, value }, state.now, state.mode);
    const from = dissolve.current.from(state.now)?.value ?? null;
    const rise = dissolve.current.rise(state.now);
    setShown((previous) =>
      previous.from === from &&
      previous.target === value &&
      previous.rise === rise
        ? previous
        : { from, target: value, rise },
    );
  }, [value, key, state.now, state.mode, state.epoch]);
  return shown;
}
