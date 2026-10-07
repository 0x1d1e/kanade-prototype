import { useEffect, useReducer, useState } from "react";
import { DebugPanel } from "./components/DebugPanel";
import { Icon } from "./components/Icon";
import { Island } from "./components/Island";
import { Overlays } from "./components/Overlays";
import {
  initialState,
  type Mode,
  reducer,
  type ScenarioName,
  type Surface,
} from "./model";

const modes: { key: Mode; name: string }[] = [
  { key: "baseline", name: "Baseline" },
  { key: "mechanical", name: "0.3.5 Mechanical Morph" },
  { key: "reduced", name: "Reduced Motion" },
];
export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "reduced"
        : "baseline",
    ),
  );
  const [panelOpen, setPanelOpen] = useState(true),
    [speed, setSpeed] = useState(1);
  const details = true;
  const [windows, setWindows] = useState(false);
  const [scenario, setScenario] = useState<ScenarioName>("morph");
  const [clean, setClean] = useState(false);
  const s = state;
  useEffect(() => {
    if (!s.playing) return;
    const id = setInterval(
      () => dispatch({ type: "advance", ms: 20 * speed }),
      20,
    );
    return () => clearInterval(id);
  }, [s.playing, speed]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      if (media.matches) dispatch({ type: "mode", mode: "reduced" });
    };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey) {
        const surfaces: Record<string, Surface> = {
          c: "controls",
          l: "launcher",
          n: "notifications",
          m: "media",
        };
        const surface = surfaces[e.key.toLowerCase()];
        if (surface) {
          e.preventDefault();
          dispatch({ type: "open", surface });
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "collapse" });
          return;
        }
      }
      const target = e.target as HTMLElement;
      if (target.closest(".debug-panel, .mode-toolbar")) return;
      if (e.key === "Escape" && (!s.pinned || target.closest(".island-body"))) {
        e.preventDefault();
        if (
          details &&
          s.raised?.type === "surface" &&
          s.raised.surface === "controls" &&
          s.detail
        ) {
          dispatch({ type: "detail", detail: null });
          return;
        }
        dispatch({ type: "collapse" });
        return;
      }
      if (
        s.holdAt &&
        s.raised?.type === "surface" &&
        ["controls", "media"].includes(s.raised.surface) &&
        !s.inside &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      )
        dispatch({ type: "collapse" });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [s.pinned, s.holdAt, s.raised, s.inside, s.detail, details]);
  return (
    <main
      className={`desktop mode-${s.mode} palette-${s.palette}`}
      aria-label="Kanade simulated desktop"
    >
      <div className="wallpaper" aria-hidden="true" />
      {windows && <MockDesktop />}
      <Island state={s} dispatch={dispatch} detailsEnabled={details} />
      <Overlays state={s} dispatch={dispatch} />
      {!clean && (
        <DebugPanel
          state={s}
          dispatch={dispatch}
          open={panelOpen}
          setOpen={setPanelOpen}
          speed={speed}
          setSpeed={setSpeed}
          windows={windows}
          setWindows={setWindows}
          scenario={scenario}
          setScenario={setScenario}
        />
      )}
      <div className={`mode-toolbar ${clean ? "clean-toolbar" : ""}`}>
        {!clean && (
          <>
            <fieldset className="mode-tabs" aria-label="Prototype mode">
              {modes.map((mode) => (
                <button
                  type="button"
                  key={mode.key}
                  aria-pressed={s.mode === mode.key}
                  onClick={() => dispatch({ type: "mode", mode: mode.key })}
                >
                  {mode.name}
                </button>
              ))}
            </fieldset>
            <a className="beat-study-link" href="/morph.html">
              0.3.5 Beat Study ↗
            </a>
            <span className="toolbar-divider" />
          </>
        )}
        <button
          type="button"
          className="clean-button"
          aria-label={
            clean ? "Show prototype controls" : "Hide prototype controls"
          }
          onClick={() => setClean(!clean)}
        >
          <Icon name={clean ? "sun" : "capture"} size={16} />
          {clean ? "Show controls" : "Clean view"}
        </button>
      </div>
      {!clean && (
        <div className="desktop-caption">
          <span>niri / eDP-1</span>
          <small>1920 × 1080 reference · 1× logical pixels</small>
        </div>
      )}
      {!clean && !panelOpen && (
        <div className="interaction-hint">
          Hover to Peek · Click to expand · Right-click to Pin
          <br />
          <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + C / L / N / M
        </div>
      )}
      <div className="sr-only" role="status">
        {s.feedback}
      </div>
      {s.feedback &&
        !clean &&
        !s.feedback.toLowerCase().includes("wallpaper") &&
        !s.feedback.toLowerCase().includes("dark gradient") && (
          <div className="mock-feedback" key={s.feedback}>
            {s.feedback}
          </div>
        )}
    </main>
  );
}
function MockDesktop() {
  return (
    <div className="mock-desktop" aria-hidden="true">
      <div className="mock-window editor-window">
        <div className="window-title">
          <span>kanade / src / island / motion.rs</span>
          <span>− · □ · ×</span>
        </div>
        <div className="editor-body">
          <nav>
            EXPLORER
            <br />
            <br />▾ kanade
            <br />
            &nbsp; ▾ src
            <br />
            &nbsp; &nbsp; ▾ island
            <br />
            &nbsp; &nbsp; &nbsp; activity.rs
            <br />
            &nbsp; &nbsp; &nbsp; arbiter.rs
            <br />
            &nbsp; &nbsp; &nbsp; geometry.rs
            <br />
            <b>&nbsp; &nbsp; &nbsp; motion.rs</b>
            <br />
            &nbsp; &nbsp; &nbsp; presentation.rs
          </nav>
          <pre>
            <span className="code-muted">
              {"// Geometry and content move as one."}
            </span>
            {"\n\n"}
            <span className="code-purple">pub const</span> RESPONSE_FACTOR: f32
            = <span className="code-amber">4.744</span>;{"\n\n"}
            <span className="code-purple">pub fn</span> at(&amp;self, now:
            Instant) → [f32; N] {"{"}
            {"\n"} <span className="code-purple">let</span> t =
            self.elapsed(now);{"\n"} <span className="code-purple">let</span>{" "}
            decay = (-self.w * t).exp();{"\n\n"}{" "}
            <span className="code-muted">
              {"// No overshoot. No idle frames."}
            </span>
            {"\n"} target - (a + b * t) * decay{"\n"}
            {"}"}
          </pre>
        </div>
        <div className="window-status">main · Rust · UTF-8</div>
      </div>
      <div className="mock-window terminal-window">
        <div className="window-title">foot / ~/Projects/kanade</div>
        <pre>
          <span className="code-purple">~/Projects/kanade</span> git:(main)
          {"\n"}❯ cargo test{"\n\n"}
          <span className="code-muted">running tests</span>
          {"\n"}test island::motion::tests::reversal …{" "}
          <span className="code-green">ok</span>
          {"\n"}test island::service::tests::split …{" "}
          <span className="code-green">ok</span>
          {"\n\n"}
          <span className="code-green">test result: ok.</span>
          {"\n\n"}❯ <span className="terminal-caret">▌</span>
        </pre>
      </div>
    </div>
  );
}
