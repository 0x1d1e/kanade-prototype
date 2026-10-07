import {
  type MotionValue,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { type Dispatch, useLayoutEffect } from "react";
import {
  type Action,
  type Activity,
  bodyIdentity,
  frame,
  presentation,
  type State,
  timerClock,
  tracks,
} from "../model";
import { shapes } from "../motion";
import {
  type ShownSatellite,
  satelliteOpacity,
  satellitePosition,
} from "../satellites";
import { useMorph } from "../useMorph";
import { useSatellites } from "../useSatellites";
import { Icon } from "./Icon";
import {
  Controls,
  DissolveCover,
  Launcher,
  Media,
  Notifications,
  type SurfaceProps,
  TrackWords,
} from "./Surfaces";

export function Island({ state: s, dispatch, detailsEnabled }: SurfaceProps) {
  const p = presentation(s);
  const identity = bodyIdentity(s);
  const morph = useMorph(p, identity, s);
  const { outgoing } = morph;
  const satellites = useSatellites(s);
  const label = p === "rest" ? "Island clock. Open Controls" : `Island ${p}`;
  return (
    <div className="island-anchor">
      <motion.div
        className="island-hit-area"
        style={{ width: morph.width, height: morph.height }}
        onMouseEnter={() => dispatch({ type: "enter" })}
        onMouseLeave={() => dispatch({ type: "leave" })}
        onContextMenu={(e) => {
          e.preventDefault();
          const id = (e.target as HTMLElement)
            .closest("[data-activity]")
            ?.getAttribute("data-activity");
          dispatch({ type: "pin", id: id ?? undefined });
        }}
        onPointerDown={() => dispatch({ type: "claim" })}
      >
        <motion.section
          className={`island-body ${s.pinned ? "pinned" : ""} ${s.mode === "mechanical" && s.material === "glass" ? "material-glass" : ""}`}
          aria-label={label}
          data-testid="island"
          data-presentation={p}
          data-mode={s.mode}
          style={{
            width: morph.width,
            height: morph.height,
            borderRadius: morph.borderRadius,
          }}
        >
          {outgoing && (
            <motion.div
              className="island-content outgoing"
              style={{
                width: shapes[presentation(outgoing)][0],
                height: shapes[presentation(outgoing)][1],
                opacity: morph.out,
              }}
              inert
              aria-hidden="true"
            >
              <Content
                state={outgoing}
                dispatch={() => {}}
                detailsEnabled={detailsEnabled}
                passive
                frozenSwap={morph.outgoingSwap}
              />
            </motion.div>
          )}
          <motion.div
            className="island-content incoming"
            style={{
              width: shapes[p][0],
              height: shapes[p][1],
              opacity: morph.into,
            }}
          >
            <Content
              state={s}
              dispatch={dispatch}
              detailsEnabled={detailsEnabled}
              swap={morph.swap}
            />
          </motion.div>
        </motion.section>
      </motion.div>
      <div className="satellites" aria-hidden="true">
        {satellites.map((dot) => (
          <SatelliteDot
            key={dot.mark.key}
            dot={dot}
            width={morph.width}
            height={morph.height}
          />
        ))}
      </div>
    </div>
  );
}
function SatelliteDot({
  dot,
  width,
  height,
}: {
  dot: ShownSatellite;
  width: MotionValue<number>;
  height: MotionValue<number>;
}) {
  const x = useTransform(
    width,
    (w) => satellitePosition(w, height.get(), dot.slot, dot.presence).x,
  );
  const y = useTransform(
    height,
    (h) => satellitePosition(width.get(), h, dot.slot, dot.presence).y,
  );
  const opacity = useTransform(
    height,
    (h) => satelliteOpacity(h) * dot.opacity,
  );
  return (
    <motion.div
      className="satellite"
      data-mark={dot.mark.key}
      data-leaving={String(dot.leaving)}
      style={{ x, y, opacity }}
    >
      {"activity" in dot.mark ? (
        <SatelliteMark activity={dot.mark.activity} />
      ) : (
        `+${dot.mark.overflow}`
      )}
    </motion.div>
  );
}
function Content({
  state: s,
  dispatch,
  detailsEnabled,
  passive = false,
  swap,
  frozenSwap = 0,
}: SurfaceProps & { swap?: MotionValue<number>; frozenSwap?: number }) {
  const p = presentation(s),
    f = frame(s);
  const frozen = useMotionValue(frozenSwap);
  useLayoutEffect(() => frozen.set(frozenSwap), [frozen, frozenSwap]);
  const primaryX = useTransform(swap ?? frozen, (value) =>
    p === "split" ? shapes.compact[0] * value : 0,
  );
  const trailingX = useTransform(swap ?? frozen, (value) =>
    p === "split" ? -shapes.compact[0] * value : 0,
  );
  if (p === "rest") {
    const minutes = 14 * 60 + 5 + Math.floor(s.now / 60000);
    const timeStr = `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    return (
      <button
        type="button"
        className={`rest-content ${s.inside ? "rest-peeking" : ""}`}
        aria-label="Open Controls"
        onClick={() => dispatch({ type: "open", surface: "controls" })}
      >
        <span className="rest-clock-glyph">
          <Icon name="clock" size={13} />
        </span>
        <span className="rest-time-str">{timeStr}</span>
        {s.inside && <span className="rest-date-peek">Wed, Oct 7</span>}
        <IslandPrivacyDots state={s} />
      </button>
    );
  }
  if (p === "controls")
    return (
      <Controls
        state={s}
        dispatch={dispatch}
        detailsEnabled={detailsEnabled}
        passive={passive}
      />
    );
  if (p === "launcher")
    return (
      <Launcher
        state={s}
        dispatch={dispatch}
        detailsEnabled={detailsEnabled}
        passive={passive}
      />
    );
  if (p === "media")
    return (
      <Media state={s} dispatch={dispatch} detailsEnabled={detailsEnabled} />
    );
  if (p === "notifications")
    return (
      <Notifications
        state={s}
        dispatch={dispatch}
        detailsEnabled={detailsEnabled}
      />
    );
  const a =
    s.raised?.type === "peek"
      ? s.activities.find((a) => a.id === (s.raised as { id: string }).id)
      : f.primary;
  if (!a) return null;
  const open = (activity: Activity) =>
    dispatch({
      type: "open",
      surface: activity.kind === "media" ? "media" : "controls",
    });
  return (
    <div className={`small-content ${p}`}>
      <motion.button
        type="button"
        className="primary-segment"
        style={{ x: primaryX }}
        data-activity={a.id}
        aria-label={`Open ${a.kind === "media" ? "Media" : "Controls"} for ${a.kind}`}
        onMouseEnter={() => dispatch({ type: "enter", id: a.id })}
        onClick={() => open(a)}
      >
        <ActivityContent
          activity={a}
          peek={p === "peek"}
          state={s}
          dispatch={dispatch}
        />
      </motion.button>
      {p === "split" && f.satellites[0] && (
        <motion.button
          type="button"
          className="trailing-segment"
          style={{ x: trailingX }}
          key={f.satellites[0].id}
          data-activity={f.satellites[0].id}
          aria-label={`Peek ${f.satellites[0].kind}`}
          onMouseEnter={() =>
            dispatch({ type: "enter", id: f.satellites[0].id })
          }
          onClick={() => open(f.satellites[0])}
        >
          <Icon
            name={f.satellites[0].kind === "timer" ? "stopwatch" : "bolt"}
            size={14}
          />
          <SatelliteMark activity={f.satellites[0]} />
        </motion.button>
      )}
    </div>
  );
}
function ActivityContent({
  activity: a,
  peek,
  state: s,
  dispatch,
}: {
  activity: Activity;
  peek: boolean;
  state: State;
  dispatch: Dispatch<Action>;
}) {
  if (a.kind === "media") {
    const track = tracks[a.track ?? 0];
    return (
      <>
        <DissolveCover art={track.art} small peek={peek} state={s} />
        <TrackWords
          title={track.title}
          artist={peek ? track.artist : undefined}
          state={s}
        />
        <div
          className={`dynamic-equalizer ${a.paused ? "paused" : "playing"}`}
          aria-hidden="true"
        >
          <span className="eq-bar bar-1" />
          <span className="eq-bar bar-2" />
          <span className="eq-bar bar-3" />
          <span className="eq-bar bar-4" />
        </div>
        <Icon name={a.paused ? "pause" : "wave-far"} size={16} />
      </>
    );
  }
  if (a.kind === "timer")
    return (
      <>
        <span className="timer-icon-badge">
          <Icon name="stopwatch" size={peek ? 24 : 18} />
        </span>
        <span className="activity-words">
          <strong>{a.paused ? "Paused" : "Timer"}</strong>
          {peek && <small>25m timer</small>}
        </span>
        <span className={`timer-number ${a.paused ? "muted" : "active-timer"}`}>
          {timerClock(a.seconds)}
        </span>
        <div
          className="timer-inline-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="timer-action-btn"
            aria-label={a.paused ? "Resume timer" : "Pause timer"}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "timer", command: "pause" });
            }}
          >
            <Icon name={a.paused ? "play" : "pause"} size={11} />
          </button>
          <button
            type="button"
            className="timer-action-btn stop"
            aria-label="Stop timer"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "timer", command: "cancel" });
            }}
          >
            <Icon name="dismiss" size={11} />
          </button>
        </div>
        <IslandPrivacyDots state={s} />
      </>
    );
  if (a.kind === "battery")
    return (
      <>
        <Icon
          name="bolt"
          className={a.priority === 5 ? "critical" : "capture-amber"}
          size={peek ? 24 : 18}
        />
        <span className="activity-words">
          <strong>
            {a.priority === 5 ? "Critical battery" : "Low battery"}
          </strong>
          {peek && <small>Connect a charger</small>}
        </span>
        <span className={`battery-number ${a.priority === 5 ? "critical" : "capture-amber"}`}>
          {a.percent}%
        </span>
        <IslandPrivacyDots state={s} />
      </>
    );
  const minutes = 14 * 60 + 5 + Math.floor(s.now / 60000);
  const timeStr = `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return (
    <>
      <span className="workspace-clock">
        <Icon name="clock" size={13} /> {timeStr}
      </span>
      <div className="workspace-pager">
        <i />
        <i className="current" />
        <i />
        <i />
      </div>
      <IslandPrivacyDots state={s} />
    </>
  );
}
function SatelliteMark({ activity: a }: { activity: Activity }) {
  return (
    <span
      className={
        a.kind === "battery"
          ? a.priority === 5
            ? "critical"
            : "capture-amber"
          : a.paused
            ? "muted"
            : ""
      }
    >
      {a.kind === "timer"
        ? `${Math.ceil((a.seconds ?? 0) / 60)}m`
        : a.kind === "battery"
          ? `${a.percent}%`
          : "♫"}
    </span>
  );
}
export function IslandPrivacyDots({ state: s }: { state: State }) {
  const hasMic = s.privacy.microphone;
  const hasCam = s.privacy.camera;
  const hasCapture = s.privacy.capture;
  if (!hasMic && !hasCam && !hasCapture) return null;
  return (
    <span className="island-privacy-dots" aria-label="Privacy indicators">
      {hasCam && <i className="privacy-dot dot-camera" title="Camera" />}
      {hasMic && <i className="privacy-dot dot-mic" title="Microphone" />}
      {hasCapture && <i className="privacy-dot dot-capture" title="Screen Capture" />}
    </span>
  );
}
