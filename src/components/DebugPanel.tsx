import type { Dispatch } from "react";
import {
  type Action,
  frame,
  presentation,
  type ScenarioName,
  type State,
  type Surface,
  scenarios,
} from "../model";
import { shapes } from "../motion";
import { Icon } from "./Icon";

type Props = {
  state: State;
  dispatch: Dispatch<Action>;
  open: boolean;
  setOpen: (open: boolean) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  details: boolean;
  setDetails: (details: boolean) => void;
  windows: boolean;
  setWindows: (windows: boolean) => void;
  scenario: ScenarioName;
  setScenario: (name: ScenarioName) => void;
};
export function DebugPanel({
  state: s,
  dispatch,
  open,
  setOpen,
  speed,
  setSpeed,
  details,
  setDetails,
  windows,
  setWindows,
  scenario,
  setScenario,
}: Props) {
  const f = frame(s),
    p = presentation(s),
    shape = shapes[p];
  return (
    <aside
      className={`debug-panel ${open ? "" : "collapsed"}`}
      aria-label="Scenario panel"
    >
      <header className="debug-header">
        <button
          type="button"
          className="debug-disclosure"
          aria-expanded={open}
          aria-controls="scenario-body"
          onClick={() => setOpen(!open)}
        >
          <span className="kanade-mark">k.</span>
          <span>
            <strong>Kanade</strong>
            <small>0.3.5 / motion lab</small>
          </span>
          <span className="disclosure-arrow">{open ? "−" : "+"}</span>
        </button>
      </header>
      {open && (
        <div id="scenario-body" className="debug-scroll">
          <section className="debug-section">
            <div className="debug-section-heading">
              <h2>Simulation</h2>
              <span className={s.playing ? "live-dot" : "paused-dot"}>
                {s.playing ? "Running" : "Paused"}
              </span>
            </div>
            <div className="time-controls">
              <button
                type="button"
                aria-label={s.playing ? "Pause simulation" : "Play simulation"}
                onClick={() => dispatch({ type: "playing", value: !s.playing })}
              >
                <Icon name={s.playing ? "pause" : "play"} size={14} />
              </button>
              <output>
                {(s.now / 1000).toFixed(1)}
                <small>s</small>
              </output>
              <button
                type="button"
                onClick={() => dispatch({ type: "advance", ms: 20 })}
              >
                +20ms
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "advance", ms: 100 })}
              >
                +100ms
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "advance", ms: 1000 })}
              >
                +1s
              </button>
              <button
                type="button"
                className="reset-button"
                onClick={() => dispatch({ type: "reset" })}
              >
                Reset
              </button>
            </div>
            <div className="scenario-select">
              <label htmlFor="scenario">Sequence</label>
              <select
                id="scenario"
                value={scenario}
                onChange={(e) => setScenario(e.target.value as ScenarioName)}
              >
                {Object.entries(scenarios).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => dispatch({ type: "replay", name: scenario })}
              >
                Replay
              </button>
            </div>
            {s.replay && (
              <div className="replay-progress">
                <span
                  style={{
                    width: `${Math.min(100, (s.now / scenarios[s.replay.name].duration) * 100)}%`,
                  }}
                />
              </div>
            )}
            <label className="debug-select">
              Playback{" "}
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={0.25}>0.25×</option>
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
              </select>
            </label>
          </section>
          <section className="debug-section">
            <h2>Surfaces</h2>
            <div className="trigger-grid surface-triggers">
              {(
                ["controls", "launcher", "notifications", "media"] as Surface[]
              ).map((surface) => (
                <button
                  type="button"
                  key={surface}
                  aria-pressed={p === surface}
                  onClick={() => dispatch({ type: "open", surface })}
                >
                  {surface[0].toUpperCase() + surface.slice(1)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => dispatch({ type: "collapse" })}
              >
                Collapse
              </button>
              <button type="button" onClick={() => dispatch({ type: "pin" })}>
                {s.pinned ? "Unpin" : "Pin"}
              </button>
            </div>
          </section>
          <section className="debug-section">
            <h2>Activities</h2>
            <div className="event-row">
              <span>Media</span>
              <div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "media", command: "start" })}
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "media", command: "change" })}
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "media", command: "stop" })}
                >
                  Stop
                </button>
              </div>
            </div>
            <div className="event-row">
              <span>Timer</span>
              <div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "timer", command: "start" })}
                >
                  25m
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "timer", command: "start", seconds: 5 })
                  }
                >
                  5s
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "timer", command: "pause" })}
                >
                  {s.activities.find((a) => a.id === "timer")?.paused
                    ? "Resume"
                    : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "timer", command: "cancel" })}
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="event-row">
              <span>Satellites</span>
              <div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "satellite", add: true })}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "satellite", add: false })}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="event-row">
              <span>Battery</span>
              <div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "battery", value: 18 })}
                >
                  Low
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "battery", value: 5 })}
                >
                  Critical
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "battery", value: null })}
                >
                  Clear
                </button>
              </div>
            </div>
            <button
              type="button"
              className="wide-trigger"
              onClick={() => dispatch({ type: "workspace" })}
            >
              Workspace switch <span>1.2s transient</span>
            </button>
          </section>
          <section className="debug-section">
            <h2>Overlays</h2>
            <div className="event-row">
              <span>Banner</span>
              <div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "notice", urgency: "low" })}
                >
                  Low
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "notice" })}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "notice", urgency: "critical" })
                  }
                >
                  Critical
                </button>
              </div>
            </div>
            <div className="event-row">
              <span>OSD</span>
              <div>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "level",
                      kind: "volume",
                      value: (s.volume + 10) % 101,
                    })
                  }
                >
                  Volume
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "level",
                      kind: "brightness",
                      value: (s.brightness + 10) % 101,
                    })
                  }
                >
                  Brightness
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "toggle", key: "microphone" })
                  }
                >
                  Mic
                </button>
              </div>
            </div>
            <div className="event-row">
              <span>Privacy</span>
              <div>
                {(["microphone", "camera", "capture"] as const).map((key) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={s.privacy[key]}
                    onClick={() => dispatch({ type: "privacy", key })}
                  >
                    {key === "microphone"
                      ? "Mic"
                      : key === "camera"
                        ? "Cam"
                        : "Capture"}
                  </button>
                ))}
              </div>
            </div>
            <label className="debug-check">
              <input
                type="checkbox"
                checked={s.dnd}
                onChange={() => dispatch({ type: "toggle", key: "dnd" })}
              />
              Do Not Disturb <span>Critical still shows</span>
            </label>
          </section>
          <section className="debug-section">
            <h2>Variants</h2>
            <label className="debug-select">
              Overlay palette{" "}
              <select
                aria-label="Overlay palette"
                value={s.palette}
                onChange={(e) =>
                  dispatch({
                    type: "palette",
                    value: e.target.value as State["palette"],
                  })
                }
              >
                <option value="neutral">Black / white</option>
                <option value="iris">Iris wallpaper tone</option>
              </select>
            </label>
            <label className="debug-select">
              Material{" "}
              <select
                aria-label="Material"
                value={s.material}
                disabled={s.mode !== "mechanical"}
                onChange={(e) =>
                  dispatch({
                    type: "material",
                    value: e.target.value as State["material"],
                  })
                }
              >
                <option value="solid">Opaque baseline</option>
                <option value="glass">Glass experiment</option>
              </select>
            </label>
            <label className="debug-check">
              <input
                type="checkbox"
                checked={details}
                onChange={(e) => setDetails(e.target.checked)}
              />
              Controls details <span>Optional mock navigation</span>
            </label>
            <label className="debug-check">
              <input
                type="checkbox"
                checked={windows}
                onChange={(e) => setWindows(e.target.checked)}
              />
              Mock niri windows
            </label>
            <p className="variant-note">
              {s.mode === "baseline"
                ? "Rust geometry + coupled spring. Opaque Island."
                : s.mode === "reduced"
                  ? "Geometry snaps. Content fades over 80ms."
                  : "Candidate: 260ms expansion, 200ms collapse, 280ms Surface change. Later content reveal. Not an approved Rust spec."}
            </p>
          </section>
          <section className="debug-section inspector">
            <h2>Inspector</h2>
            <dl>
              <dt>Presentation</dt>
              <dd>
                {p === "rest"
                  ? "Rest"
                  : p === "compact"
                    ? "Compact"
                    : p === "split"
                      ? "Split"
                      : p === "peek"
                        ? "Peek"
                        : `Expanded (${p})`}
              </dd>
              <dt>Target</dt>
              <dd>
                {shape[0]} × {shape[1]} / r{shape[2]}
              </dd>
              <dt>Primary</dt>
              <dd>{f.primary?.id ?? "none"}</dd>
              <dt>Satellites</dt>
              <dd>
                {f.satellites.length}
                {f.overflow ? ` +${f.overflow}` : ""}
              </dd>
              <dt>Input</dt>
              <dd>
                {s.pinned
                  ? "Pinned"
                  : s.holdAt
                    ? "Keyboard Hold"
                    : s.inside
                      ? "Pointer inside"
                      : "Released"}
              </dd>
            </dl>
            <ol className="event-log" aria-label="Event log">
              {s.log.length ? (
                s.log.map((line) => <li key={line.id}>{line.text}</li>)
              ) : (
                <li>No events yet.</li>
              )}
            </ol>
          </section>
          <footer className="debug-footer">
            Local simulation. No IPC. Source: 08f6e1c.
            <br />
            Switch modes to compare the same state.
          </footer>
        </div>
      )}
    </aside>
  );
}
