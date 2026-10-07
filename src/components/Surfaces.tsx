import { motion } from "motion/react";
import { type Dispatch, useEffect, useMemo, useRef, useState } from "react";
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
import { AppIcon, Icon } from "./Icon";

export type SurfaceProps = {
  state: State;
  dispatch: Dispatch<Action>;
  detailsEnabled: boolean;
  passive?: boolean;
};
export function Controls({ state: s, dispatch, detailsEnabled }: SurfaceProps) {
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
        onClick={() => dispatch({ type: "toggle", key })}
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
  if (s.detail && detailsEnabled)
    return (
      <ControlsDetail
        state={s}
        dispatch={dispatch}
        detailsEnabled={detailsEnabled}
      />
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
        <Level state={s} dispatch={dispatch} kind="volume" />
        <Level state={s} dispatch={dispatch} kind="brightness" />
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
      {detailsEnabled && (
        <button
          type="button"
          className="audio-details"
          onClick={() => dispatch({ type: "detail", detail: "audio" })}
        >
          Audio details <Icon name="forward" size={12} />
        </button>
      )}
    </div>
  );
}
function ControlsDetail({ state: s, dispatch }: SurfaceProps) {
  const [scanUntil, setScanUntil] = useState(0);
  const scanning = s.now < scanUntil;
  const [output, setOutput] = useState("Built-in speakers");
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
  return (
    <div className="surface detail-content">
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
        <>
          <label className="device-select">
            Output{" "}
            <select
              aria-label="Audio output"
              value={output}
              onChange={(e) => setOutput(e.target.value)}
            >
              <option>Built-in speakers</option>
              <option>AirPods Pro</option>
            </select>
          </label>
          <Level state={s} dispatch={dispatch} kind="volume" />
          <label className="device-select">
            Input{" "}
            <select aria-label="Audio input">
              <option>Built-in microphone</option>
              <option>USB microphone</option>
            </select>
          </label>
          <button
            type="button"
            className="detail-row"
            onClick={() => dispatch({ type: "toggle", key: "microphone" })}
          >
            <Icon name="microphone" />
            <span>Microphone</span>
            <small>{s.microphone ? "On" : "Muted"}</small>
          </button>
        </>
      ) : (
        <>
          <div className="detail-heading">
            <span>{detail === "wifi" ? "Networks" : "Devices"}</span>
            <button
              type="button"
              onClick={() => setScanUntil(s.now + 700)}
              disabled={scanning}
            >
              {scanning ? "Scanning…" : "Scan"}
            </button>
          </div>
          {choices.map((name, i) => {
            const on = detail === "wifi" ? s.wifi : s.bluetooth;
            const selected =
              (detail === "wifi" ? s.network : s.device) === name && on;
            return (
              <button
                type="button"
                className="detail-row"
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
              </button>
            );
          })}
          <button
            type="button"
            className="detail-radio"
            onClick={() =>
              dispatch({
                type: "toggle",
                key: detail === "wifi" ? "wifi" : "bluetooth",
              })
            }
          >
            {(detail === "wifi" ? s.wifi : s.bluetooth)
              ? `Turn ${title} off`
              : `Turn ${title} on`}
          </button>
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
          className="icon-button"
          aria-label="Previous track"
          onClick={() => dispatch({ type: "media", command: "change" })}
        >
          <Icon name="previous" size={20} />
        </button>
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
