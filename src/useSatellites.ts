import { useLayoutEffect, useRef, useState } from "react";
import { type State, satelliteMarks } from "./model";
import { Satellites, type ShownSatellite } from "./satellites";

export function useSatellites(state: State) {
  const motion = useRef(new Satellites());
  const previous = useRef({ keys: "", mode: state.mode, epoch: state.epoch });
  const [shown, setShown] = useState<ShownSatellite[]>([]);
  useLayoutEffect(() => {
    const marks = satelliteMarks(state);
    const keys = marks.map((mark) => mark.key).join(":");
    const old = previous.current;
    const reset = old.epoch !== state.epoch;
    if (reset) motion.current = new Satellites();
    const changed = reset || keys !== old.keys || state.mode !== old.mode;
    motion.current.follow(
      marks,
      changed ? state.satellitesAt : state.now,
      state.mode,
    );
    // Prune exits that completed inside a large simulation step.
    motion.current.follow(marks, state.now, state.mode);
    previous.current = { keys, mode: state.mode, epoch: state.epoch };
    setShown(motion.current.shown(state.now));
  }, [state]);
  return shown;
}
