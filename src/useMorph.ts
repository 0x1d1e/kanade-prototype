import { useMotionValue } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { contentIdentity, initialState, type State } from "./model";
import {
  Crossfade,
  type Presentation,
  response,
  Spring,
  shapes,
} from "./motion";

type Frame = { identity: string; state: State };
export function useMorph(
  presentation: Presentation,
  identity: string,
  state: State,
) {
  const spring = useRef(new Spring(shapes[presentation]));
  const fade = useRef(
    new Crossfade<Frame>(
      { identity, state },
      (a, b) => a.identity === b.identity,
    ),
  );
  const previous = useRef({
    presentation,
    identity,
    mode: state.mode,
    epoch: state.epoch,
  });
  const [outgoing, setOutgoing] = useState<State | null>(null);
  const width = useMotionValue(shapes[presentation][0]);
  const height = useMotionValue(shapes[presentation][1]);
  const radius = useMotionValue(shapes[presentation][2]);
  const progress = useMotionValue(1),
    out = useMotionValue(0),
    into = useMotionValue(1);

  useLayoutEffect(() => {
    const { now, mode } = state;
    const old = previous.current;
    if (state.epoch !== old.epoch) {
      // Reset/replay rewinds the whole visual timeline, not just event deadlines.
      spring.current = new Spring(shapes.rest);
      const rest = initialState(mode);
      fade.current = new Crossfade(
        { identity: contentIdentity(rest), state: rest },
        (a, b) => a.identity === b.identity,
      );
      old.presentation = "rest";
      old.identity = contentIdentity(rest);
      old.mode = mode;
    }
    const changed = old.identity !== identity || old.mode !== mode;
    if (changed) {
      const at = state.motionAt;
      fade.current.to(
        { identity, state },
        spring.current.progress(at),
        old.mode === "mechanical" ? 0.6 : 0.5,
        old.mode !== mode,
      );
      spring.current.to(
        shapes[presentation],
        response(old.presentation, presentation, mode),
        at,
        mode === "reduced",
      );
      setOutgoing(fade.current.from?.content.state ?? null);
    } else fade.current.target = { identity, state };
    previous.current = { presentation, identity, mode, epoch: state.epoch };
    const [w, h, r] = spring.current.at(now);
    const p = spring.current.progress(now);
    const alpha = fade.current.opacity(p, mode === "mechanical" ? 0.6 : 0.5);
    width.set(w);
    height.set(h);
    radius.set(r);
    progress.set(p);
    out.set(alpha.out);
    into.set(alpha.into);
  }, [
    presentation,
    identity,
    state,
    width,
    height,
    radius,
    progress,
    out,
    into,
  ]);

  return { width, height, borderRadius: radius, progress, out, into, outgoing };
}
