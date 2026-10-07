import { useLayoutEffect, useRef, useState } from "react";
import type { State } from "./model";
import { Navigation } from "./navigation";

export function useNavigation(state: State, detailsEnabled: boolean) {
  const key = detailsEnabled ? (state.detail ?? "root") : "root";
  const channel = useRef(new Navigation(state, key));
  const previous = useRef({
    key,
    mode: state.mode,
    epoch: state.epoch,
    detailsEnabled,
  });
  const [frames, setFrames] = useState(() => channel.current.shown(state.now));
  useLayoutEffect(() => {
    const old = previous.current;
    if (old.epoch !== state.epoch) channel.current = new Navigation(state, key);
    const changed = old.key !== key || old.mode !== state.mode;
    // Local preference changes in either direction happen now, not at motionAt.
    const at =
      old.detailsEnabled !== detailsEnabled
        ? state.now
        : changed
          ? state.motionAt
          : state.now;
    channel.current.to(state, key, at, state.mode, key === "root" ? -1 : 1);
    previous.current = {
      key,
      mode: state.mode,
      epoch: state.epoch,
      detailsEnabled,
    };
    setFrames(channel.current.shown(state.now));
  }, [state, key, detailsEnabled]);
  return { key, frames };
}
