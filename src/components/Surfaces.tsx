import { motion } from "motion/react";
import {
  type Dispatch,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Action,
  type Detail,
  frame,
  type State,
  searchApps,
  timerClock,
  tracks,
} from "../model";
import { useDissolve } from "../useDissolve";
import { useNavigation } from "../useNavigation";
import { AppIcon, Icon } from "./Icon";

export type SurfaceProps = {
  state: State;
  dispatch: Dispatch<Action>;
  detailsEnabled: boolean;
  passive?: boolean;
};
export function Controls({
  state,
  dispatch,
  detailsEnabled,
  passive = false,
}: SurfaceProps) {
  const navigation = useNavigation(state, detailsEnabled);
  const container = useRef<HTMLDivElement>(null);
  const previousKey = useRef(navigation.key);
  const currentKey = navigation.frames.find(
    (entry) => entry.key === navigation.key,
  )?.key;
  useLayoutEffect(() => {
    if (passive || !currentKey || previousKey.current === currentKey) return;
    const target = container.current?.querySelector<HTMLElement>(
      '[data-nav-current="true"]',
    );
    if (!target) return;
    const previous = previousKey.current;
    previousKey.current = currentKey;
    const returning = currentKey === "root";
    const selector =
      previous === "audio"
        ? ".audio-details"
        : `[aria-label="${previous === "wifi" ? "Wi-Fi" : "Bluetooth"} details"]`;
    const focus =
      (returning ? target.querySelector<HTMLElement>(selector) : null) ??
      target.querySelector<HTMLElement>("button, input, select");
    focus?.focus({ preventScroll: true });
  }, [currentKey, passive]);
  return (
    <div className="controls-navigation" ref={container}>
      {navigation.frames.map((entry) => {
        const current = entry.key === navigation.key;
        const props = {
          state: entry.content,
          dispatch: current ? dispatch : () => {},
          detailsEnabled,
          passive: passive || !current,
        };
        return (
          <motion.div
            key={entry.key}
            className="navigation-layer"
            data-nav-key={entry.key}
            data-nav-current={String(current)}
            inert={!current || passive}
            aria-hidden={!current || passive}
            style={{
              x: entry.x,
              opacity: entry.opacity,
              zIndex: current ? 1 : 0,
            }}
          >
            {entry.key === "root" ? (
              <ControlsPage {...props} />
            ) : (
              <ControlsDetail {...props} />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
function ControlsPage({ state: s, dispatch, detailsEnabled }: SurfaceProps) {
  const handleToggle = (key: "wifi" | "bluetooth" | "microphone" | "dnd") => {
    dispatch({ type: "toggle", key });
    if (key === "wifi") {
      dispatch({
        type: "notice",
        urgency: "normal",
        content: {
          app: "Wi-Fi",
          title: !s.wifi ? "Wi-Fi Connected" : "Wi-Fi Turned Off",
          body: !s.wifi ? (s.network || "Connected to Studio") : "Wi-Fi is now turned off",
        },
      });
    } else if (key === "bluetooth") {
      dispatch({
        type: "notice",
        urgency: "normal",
        content: {
          app: "Bluetooth",
          title: !s.bluetooth ? "Bluetooth Connected" : "Bluetooth Turned Off",
          body: !s.bluetooth ? (s.device || "Connected to AirPods Pro") : "Bluetooth is now turned off",
        },
      });
    } else if (key === "dnd") {
      dispatch({
        type: "notice",
        urgency: !s.dnd ? "critical" : "normal",
        content: {
          app: "Do Not Disturb",
          title: !s.dnd ? "Do Not Disturb: On" : "Do Not Disturb: Off",
          body: !s.dnd ? "Notifications are silenced" : "Normal notifications",
        },
      });
    }
  };
  const tile = (
    key: "wifi" | "bluetooth" | "microphone" | "dnd",
    name: string,
    status: string,
    icon: string,
    detail?: Detail,
  ) => (
    <div className="tile-wrap" key={key}>
      <button
        type="button"
        className={`control-tile ${s[key] ? "on" : ""}`}
        aria-label={`${name}: ${status}`}
        aria-pressed={s[key]}
        onClick={() => handleToggle(key)}
      >
        <span className="tile-knob">
          <Icon name={icon} />
        </span>
        <span className="tile-words">
          <strong>{name}</strong>
          <small>{status}</small>
        </span>
      </button>
      {detailsEnabled && detail && (
        <button
          type="button"
          className="tile-detail"
          aria-label={`${name} details`}
          onClick={() => dispatch({ type: "detail", detail })}
        >
          <Icon name="forward" size={14} />
        </button>
      )}
    </div>
  );
  return (
    <div className="surface controls-content">
      <header className="surface-header">
        <h2>Controls</h2>
        {Object.values(s.privacy).some(Boolean) && (
          <span className="capturing">
            <PrivacyGlyphs state={s} />
            <span>Firefox</span>
          </span>
        )}
      </header>
      <div className="control-grid">
        {tile(
          "wifi",
          "Wi-Fi",
          s.wifi ? s.network || "Not connected" : "Off",
          "wifi-far",
          "wifi",
        )}
        {tile(
          "bluetooth",
          "Bluetooth",
          s.bluetooth ? s.device || "On" : "Off",
          "bluetooth",
          "bluetooth",
        )}
        {tile(
          "microphone",
          "Microphone",
          s.microphone ? "On" : "Muted",
          "microphone",
        )}
        {tile("dnd", "Do Not Disturb", s.dnd ? "On" : "Off", "moon")}
      </div>
      <div className="control-levels">
        <div className="level-card sound-card">
          <div className="level-header-row">
            <span className="level-title">Sound</span>
            {detailsEnabled && (
              <button
                type="button"
                className="audio-details apple-audio-route"
                aria-label="Audio details"
                onClick={() => dispatch({ type: "detail", detail: "audio" })}
              >
                <span>{s.device || "Speakers"}</span>
                <Icon name="forward" size={11} />
              </button>
            )}
          </div>
          <Level state={s} dispatch={dispatch} kind="volume" />
        </div>
        <div className="level-card brightness-card">
          <div className="level-header-row">
            <span className="level-title">Display</span>
          </div>
          <Level state={s} dispatch={dispatch} kind="brightness" />
        </div>
      </div>
      <fieldset className="profiles" aria-label="Power profile">
        {["Power saver", "Balanced", "Performance"].map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={s.profile === value}
            onClick={() => dispatch({ type: "profile", value })}
          >
            {value}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
function ControlsDetail({ state: s, dispatch }: SurfaceProps) {
  const [scanUntil, setScanUntil] = useState(0);
  const scanning = s.now < scanUntil;
  const [noiseMode, setNoiseMode] = useState<"anc" | "off" | "transparency">("anc");
  const detail = s.detail ?? "wifi";
  const title =
    detail === "wifi"
      ? "Wi-Fi"
      : detail === "bluetooth"
        ? "Bluetooth"
        : "Audio";
  const choices =
    detail === "wifi"
      ? ["Studio", "Kanade Guest", "Atelier"]
      : ["AirPods Pro", "MX Master 3", "Keychron K2"];

  const handleDetailToggle = () => {
    const isWifi = detail === "wifi";
    const currentlyOn = isWifi ? s.wifi : s.bluetooth;
    dispatch({
      type: "toggle",
      key: isWifi ? "wifi" : "bluetooth",
    });
    dispatch({
      type: "notice",
      urgency: "normal",
      content: {
        app: isWifi ? "Wi-Fi" : "Bluetooth",
        title: !currentlyOn ? `${title} Connected` : `${title} Turned Off`,
        body: !currentlyOn
          ? isWifi
            ? s.network || "Connected to Studio"
            : s.device || "Connected to AirPods Pro"
          : `${title} is now turned off`,
      },
    });
  };

  const activeMedia = s.activities.find((a) => a.kind === "media");
  const currentTrack = activeMedia ? tracks[activeMedia.track ?? 0] : tracks[0];

  return (
    <div className={`surface detail-content apple-detail-${detail}`}>
      <header className="surface-header">
        <button
          type="button"
          className="icon-button"
          aria-label="Back to Controls"
          onClick={() => dispatch({ type: "detail", detail: null })}
        >
          <Icon name="back" />
        </button>
        <h2>{title}</h2>
        <small className="experiment-label">Prototype detail</small>
      </header>
      {detail === "audio" ? (
        <div className="apple-audio-view">
          {activeMedia && (
            <div className="apple-audio-now-playing">
              <Cover art={currentTrack.art} small />
              <div className="now-playing-words">
                <strong>{currentTrack.title}</strong>
                <small>{currentTrack.artist}</small>
              </div>
              <button
                type="button"
                className="mini-play-btn"
                aria-label={activeMedia.paused ? "Play" : "Pause"}
                onClick={() => dispatch({ type: "media", command: "pause" })}
              >
                <Icon name={activeMedia.paused ? "play" : "pause"} size={13} />
              </button>
            </div>
          )}

          <div className="apple-group-card">
            <div className="group-card-header">
              <span>OUTPUT DESTINATIONS</span>
            </div>
            {[
              { id: "Built-in speakers", label: "Built-in speakers", sub: "MacBook Pro Speakers", icon: "speaker" },
              { id: "AirPods Pro", label: "AirPods Pro", sub: "Spatial Audio · 94% battery", icon: "bluetooth" },
            ].map((out) => {
              const active = (s.device || "Built-in speakers") === out.id;
              return (
                <button
                  type="button"
                  key={out.id}
                  className={`apple-route-row ${active ? "active-route" : ""}`}
                  onClick={() => dispatch({ type: "connect", key: "device", value: out.id })}
                >
                  <Icon name={out.icon} size={18} />
                  <div className="route-info">
                    <strong>{out.label}</strong>
                    <small>{out.sub}</small>
                  </div>
                  {active && <span className="apple-checkmark">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="apple-volume-card">
            <div className="volume-slider-header">
              <span className="slider-label">Master Volume</span>
              <span className="slider-val">{s.volume}%</span>
            </div>
            <Level state={s} dispatch={dispatch} kind="volume" />
          </div>

          {s.device === "AirPods Pro" && (
            <div className="apple-group-card noise-control-group">
              <div className="group-card-header">
                <span>NOISE CONTROL</span>
              </div>
              <div className="noise-mode-pills">
                {(
                  [
                    { id: "anc", label: "Noise Cancellation" },
                    { id: "off", label: "Off" },
                    { id: "transparency", label: "Transparency" },
                  ] as const
                ).map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={`noise-pill ${noiseMode === m.id ? "active" : ""}`}
                    onClick={() => setNoiseMode(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="apple-group-card">
            <div className="group-card-header">
              <span>INPUT</span>
            </div>
            <button
              type="button"
              className="detail-row apple-list-row"
              onClick={() => dispatch({ type: "toggle", key: "microphone" })}
            >
              <Icon name="microphone" />
              <span>Microphone</span>
              <small>{s.microphone ? "On" : "Muted"}</small>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="apple-toggle-card">
            <div className="apple-toggle-info">
              <Icon name={detail === "wifi" ? "wifi-far" : "bluetooth"} size={22} />
              <div>
                <strong>{title}</strong>
                <small>
                  {(detail === "wifi" ? s.wifi : s.bluetooth)
                    ? (detail === "wifi" ? s.network || "Connected" : s.device || "Connected")
                    : "Off"}
                </small>
              </div>
            </div>
            <button
              type="button"
              className={`apple-switch ${(detail === "wifi" ? s.wifi : s.bluetooth) ? "on" : ""}`}
              aria-label={(detail === "wifi" ? s.wifi : s.bluetooth) ? `Turn ${title} off` : `Turn ${title} on`}
              onClick={handleDetailToggle}
            >
              <span className="switch-knob" />
            </button>
          </div>
          <div className="detail-heading">
            <span>{detail === "wifi" ? "MY NETWORKS" : "MY DEVICES"}</span>
            <button
              type="button"
              onClick={() => setScanUntil(s.now + 700)}
              disabled={scanning}
            >
              {scanning ? "Scanning…" : "Scan"}
            </button>
          </div>
          <div className="apple-device-list">
            {choices.map((name, i) => {
              const on = detail === "wifi" ? s.wifi : s.bluetooth;
              const selected =
                (detail === "wifi" ? s.network : s.device) === name && on;
              return (
                <button
                  type="button"
                  className={`detail-row apple-list-row ${selected ? "selected-row" : ""}`}
                  key={name}
                  disabled={!on}
                  onClick={() =>
                    dispatch({
                      type: "connect",
                      key: detail === "wifi" ? "network" : "device",
                      value: selected ? "" : name,
                    })
                  }
                >
                  <Icon name={detail === "wifi" ? "wifi-far" : "bluetooth"} />
                  <span>{name}</span>
                  <small>
                    {selected
                      ? "Connected"
                      : i === 2
                        ? "Available"
                        : detail === "wifi"
                          ? "Secured"
                          : "Paired"}
                  </small>
                  {selected && <span className="apple-checkmark">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
export function Level({
  state: s,
  dispatch,
  kind,
}: {
  state: State;
  dispatch: Dispatch<Action>;
  kind: "volume" | "brightness";
}) {
  const volume = kind === "volume";
  return (
    <div className="level-row">
      {volume ? (
        <button
          type="button"
          className="icon-button"
          aria-label={s.muted ? "Unmute speaker" : "Mute speaker"}
          onClick={() => dispatch({ type: "toggle", key: "muted" })}
        >
          <Icon name={s.muted ? "mute" : "speaker"} size={20} />
        </button>
      ) : (
        <Icon name="sun" size={20} />
      )}
      <input
        className="level-input"
        aria-label={volume ? "Volume" : "Brightness"}
        type="range"
        min="0"
        max="100"
        value={s[kind]}
        style={{
          background: `linear-gradient(to right, var(--ink) ${s[kind]}%, var(--container-high) ${s[kind]}%)`,
        }}
        onChange={(e) =>
          dispatch({ type: "level", kind, value: Number(e.target.value) })
        }
      />
      <span className="level-number">{s[kind]}</span>
    </div>
  );
}
export function Launcher({ dispatch, passive }: SurfaceProps) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const found = searchApps(query);
  useEffect(() => {
    if (!passive) input.current?.focus();
  }, [passive]);
  useEffect(() => {
    list.current?.children[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <section
      aria-label="Launcher"
      className="surface launcher-content"
      onKeyDown={(e) => {
        if (["ArrowDown", "ArrowUp", "Home", "End", "Enter"].includes(e.key)) {
          e.preventDefault();
          dispatch({ type: "claim" });
          if (e.key === "Enter" && found[selected])
            dispatch({ type: "launch", name: found[selected].name });
          else
            setSelected((n) =>
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? Math.max(0, found.length - 1)
                  : Math.max(
                      0,
                      Math.min(
                        found.length - 1,
                        n + (e.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
            );
        }
      }}
    >
      <div className="search-field">
        <Icon name="search" size={20} />
        <input
          ref={input}
          aria-label="Search applications"
          placeholder="Search apps"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
            dispatch({ type: "claim" });
          }}
        />
      </div>
      {found.length ? (
        <div
          className="launcher-list"
          ref={list}
          role="listbox"
          aria-label="Applications"
        >
          {found.map((app, i) => (
            <button
              type="button"
              key={app.name}
              role="option"
              aria-selected={selected === i}
              className={`launcher-row ${selected === i ? "selected" : ""}`}
              onFocus={() => setSelected(i)}
              onClick={() => dispatch({ type: "launch", name: app.name })}
            >
              <AppIcon kind={app.icon} />
              <span>
                <strong>{app.name}</strong>
                <small>{app.description}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>No apps found</h3>
          <p>Try another name.</p>
        </div>
      )}
    </section>
  );
}
export function Notifications({ state: s, dispatch }: SurfaceProps) {
  const ref = useRef<HTMLElement>(null);
  return (
    <section
      aria-label="Notifications"
      className="surface notifications-content"
      ref={ref}
      onKeyDown={(e) => {
        const buttons = [
          ...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? []),
        ];
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          buttons[
            Math.max(
              0,
              Math.min(
                buttons.length - 1,
                index + (e.key === "ArrowDown" ? 1 : -1),
              ),
            )
          ]?.focus();
          dispatch({ type: "claim" });
        }
        if (e.key === "Backspace") {
          const id = (document.activeElement as HTMLElement)
            ?.closest("[data-notice-id]")
            ?.getAttribute("data-notice-id");
          if (id) {
            e.preventDefault();
            dispatch({ type: "dismiss", id: Number(id) });
          }
        }
      }}
    >
      <header className="surface-header">
        <h2>Notifications</h2>
        <span>{s.notices.length}</span>
      </header>
      {s.notices.length ? (
        <div className="notification-list">
          {s.notices.map((n) => (
            <article
              className="notification-card"
              key={n.id}
              data-notice-id={n.id}
            >
              <div className="notification-main">
                <span className="notification-icon">
                  <Icon name="bell" />
                </span>
                <div className="notification-words">
                  <small>
                    {n.urgency === "critical" && (
                      <b className="critical">Critical </b>
                    )}
                    {n.app}
                  </small>
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Dismiss ${n.title}`}
                  onClick={() => dispatch({ type: "dismiss", id: n.id })}
                >
                  <Icon name="dismiss" size={14} />
                </button>
              </div>
              {n.action && (
                <button
                  type="button"
                  className="notice-action"
                  onClick={() =>
                    dispatch({ type: "bannerClose", id: n.id, action: true })
                  }
                >
                  {n.action}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Icon name="bell" size={28} />
          <h3>No notifications</h3>
          <p>You're all caught up.</p>
        </div>
      )}
      <footer className="notification-footer">
        <button
          type="button"
          aria-pressed={s.dnd}
          onClick={() => dispatch({ type: "toggle", key: "dnd" })}
        >
          <Icon name="moon" size={14} /> Do Not Disturb {s.dnd ? "On" : "Off"}
        </button>
        <button
          type="button"
          disabled={!s.notices.length}
          onClick={() => dispatch({ type: "clearNotices" })}
        >
          Clear all
        </button>
      </footer>
    </section>
  );
}
export function Media({ state: s, dispatch }: SurfaceProps) {
  const activity = s.activities.find((a) => a.kind === "media");
  const track = activity ? tracks[activity.track ?? 0] : null;
  return (
    <div className="surface media-content">
      <div className="media-header">
        <DissolveCover art={track?.art} state={s} />
        <div className="media-description">
          <TrackWords
            title={track?.title ?? "Nothing playing"}
            artist={track?.artist ?? ""}
            state={s}
          />
          <span className="player-chip">Spotify</span>
        </div>
      </div>
      <div className="media-timeline">
        <div className="progress-track">
          <span style={{ width: "38%" }} />
        </div>
        <div>
          <small>2:01</small>
          <small>{timerClock(track?.length)}</small>
        </div>
      </div>
      <div className="media-transport">
        <button
          type="button"
          disabled={!activity}
          className="play-button"
          aria-label={activity?.paused ? "Play" : "Pause"}
          onClick={() => dispatch({ type: "media", command: "pause" })}
        >
          <Icon name={activity?.paused ? "play" : "pause"} size={22} />
        </button>
        <button
          type="button"
          disabled={!activity}
          className="icon-button"
          aria-label="Next track"
          onClick={() => dispatch({ type: "media", command: "change" })}
        >
          <Icon name="next" size={20} />
        </button>
        <div className="media-volume">
          <Level state={s} dispatch={dispatch} kind="volume" />
        </div>
      </div>
      <div className="media-footer-controls">
        <button
          type="button"
          className="media-cc-btn"
          aria-label="Open Control Center"
          onClick={() => dispatch({ type: "open", surface: "controls" })}
        >
          <span>Control Center</span>
          <Icon name="forward" size={11} />
        </button>
        <div className="media-output-select-wrap">
          <Icon name="speaker" size={13} />
          <select
            aria-label="Audio output destination"
            value={s.device || "Built-in speakers"}
            onChange={(e) =>
              dispatch({
                type: "connect",
                key: "device",
                value: e.target.value,
              })
            }
          >
            <option>Built-in speakers</option>
            <option>AirPods Pro</option>
          </select>
        </div>
      </div>
    </div>
  );
}
export function Cover({
  art,
  small = false,
}: {
  art?: string;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`cover cover-${art ?? "empty"} ${small ? "cover-small" : ""}`}
    >
      <span />
    </span>
  );
}
export function DissolveCover({
  art = "empty",
  small = false,
  peek = false,
  state,
}: {
  art?: string;
  small?: boolean;
  peek?: boolean;
  state: State;
}) {
  const frames = useDissolve(art, art, state);
  return (
    <div
      aria-hidden="true"
      className={`art-dissolve ${small ? "" : "large-art"} ${peek ? "peek-art" : ""}`}
    >
      {frames.from !== null && (
        <div>
          <Cover art={frames.from} small={small} />
        </div>
      )}
      <motion.div style={{ opacity: frames.rise }}>
        <Cover art={frames.target} small={small} />
      </motion.div>
    </div>
  );
}
export function TrackWords({
  title,
  artist,
  state,
}: {
  title: string;
  artist?: string;
  state: State;
}) {
  const words = useMemo(() => ({ title, artist }), [title, artist]);
  const frames = useDissolve(words, JSON.stringify(words), state);
  // Rust's swap: words cross through nothing, unlike art which rises over the old frame.
  const old = frames.from !== null && frames.rise < 0.5;
  const text = old && frames.from ? frames.from : frames.target;
  const opacity =
    frames.from === null ? 1 : old ? 1 - 2 * frames.rise : 2 * frames.rise - 1;
  return (
    <div className="track-dissolve">
      <motion.div style={{ opacity }}>
        <strong>{text.title}</strong>
        {text.artist !== undefined && <small>{text.artist}</small>}
      </motion.div>
    </div>
  );
}
export function PrivacyGlyphs({ state: s }: { state: State }) {
  return (
    <>
      {s.privacy.microphone && (
        <Icon name="microphone" size={16} className="privacy-green" />
      )}
      {s.privacy.camera && (
        <Icon name="camera" size={16} className="privacy-green" />
      )}
      {s.privacy.capture && (
        <Icon name="capture" size={16} className="capture-amber" />
      )}
    </>
  );
}
export function PeekTimer({
  state,
  dispatch,
}: {
  state: State;
  dispatch: Dispatch<Action>;
}) {
  const f = frame(state);
  const a =
    f.primary?.kind === "timer"
      ? f.primary
      : f.satellites.find((a) => a.kind === "timer");
  return a ? (
    <button
      type="button"
      onClick={() => dispatch({ type: "timer", command: "pause" })}
    >
      {a.paused ? "Resume timer" : "Pause timer"}
    </button>
  ) : null;
}
