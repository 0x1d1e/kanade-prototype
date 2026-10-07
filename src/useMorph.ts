import { useMotionValue } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { bodyIdentity, frame, initialState, type State } from "./model";
import {
  Crossfade,
  handoff,
  type Presentation,
  response,
  Spring,
  shapes,
} from "./motion";
import { type SplitPair, SplitSwap } from "./splitSwap";

type Frame = { identity: string; state: State; swap: number };
export function useMorph(
  presentation: Presentation,
  identity: string,
  state: State,
) {
  const spring = useRef(new Spring(shapes[presentation]));
  const swapSpring = useRef(new SplitSwap());
  const swap = useMotionValue(0);
  const fade = useRef(
    new Crossfade<Frame>(
      { identity, state, swap: 0 },
      (a, b) => a.identity === b.identity,
    ),
  );
  const previous = useRef({
    presentation,
    identity,
    mode: state.mode,
    epoch: state.epoch,
  });
  const [outgoing, setOutgoing] = useState<Frame | null>(null);
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
      swapSpring.current = new SplitSwap();
      const rest = initialState(mode);
      fade.current = new Crossfade(
        { identity: bodyIdentity(rest), state: rest, swap: 0 },
        (a, b) => a.identity === b.identity,
      );
      old.presentation = "rest";
      old.identity = bodyIdentity(rest);
      old.mode = mode;
    }
    const changed = old.identity !== identity || old.mode !== mode;
    const f = frame(state);
    const pair: SplitPair =
      presentation === "split" && f.primary && f.satellites[0]
        ? [f.primary.id, f.satellites[0].id]
        : null;
    const at = changed ? state.motionAt : now;
    fade.current.target.swap = swapSpring.current.at(at);
    const swapped = swapSpring.current.follow(pair, at, mode);
    if (changed && !swapped) {
      fade.current.to(
        { identity, state, swap: swapSpring.current.at(at) },
        spring.current.progress(at),
        handoff(old.mode),
        old.mode !== mode,
      );
      spring.current.to(
        shapes[presentation],
        response(old.presentation, presentation, mode),
        at,
        mode === "reduced",
      );
      setOutgoing(fade.current.from?.content ?? null);
    } else
      fade.current.target = {
        identity,
        state,
        swap: swapSpring.current.at(now),
      };
    previous.current = { presentation, identity, mode, epoch: state.epoch };
    const [w, h, r] = spring.current.at(now);
    const p = spring.current.progress(now);
    const alpha = fade.current.opacity(p, handoff(mode));
    swap.set(swapSpring.current.at(now));
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
    swap,
  ]);

  return {
    width,
    height,
    borderRadius: radius,
    progress,
    out,
    into,
    outgoing: outgoing?.state ?? null,
    outgoingSwap: outgoing?.swap ?? 0,
    swap,
  };
}
