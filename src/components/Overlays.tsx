import { motion } from "motion/react";
import type { Dispatch } from "react";
import type { Action, State } from "../model";
import { usePresence } from "../usePresence";
import { Icon } from "./Icon";
import { PrivacyGlyphs } from "./Surfaces";

export function Overlays({
  state: s,
  dispatch,
}: {
  state: State;
  dispatch: Dispatch<Action>;
}) {
  const experiment = s.mode === "mechanical";
  const duration = s.mode === "reduced" ? 80 : experiment ? 180 : 0;
  const banners = usePresence(
    s.banners.map((b) => b.notice),
    s.now,
    duration,
    (n) => String(n.id),
  );
  const osd = usePresence(s.osd ? [s.osd] : [], s.now, duration, () => "osd");
  return (
    <>
      {Object.values(s.privacy).some(Boolean) && (
        <div
          className="privacy-cluster"
          role="status"
          aria-label={`Privacy: ${Object.entries(s.privacy)
            .filter(([, on]) => on)
            .map(([key]) => key)
            .join(", ")} active`}
        >
          <PrivacyGlyphs state={s} />
        </div>
      )}
      <section
        className={`banner-stack overlay-palette ${experiment && s.material === "glass" ? "material-glass-children" : ""}`}
        aria-label="Notification Banners"
        onMouseEnter={() => dispatch({ type: "bannerHover", inside: true })}
        onMouseLeave={() => dispatch({ type: "bannerHover", inside: false })}
      >
        {banners.map(({ item: n, key, opacity, exiting }) => (
          <motion.article
            className="banner"
            key={key}
            data-testid="banner"
            inert={exiting}
            aria-hidden={exiting || undefined}
            style={{
              opacity,
              y: (1 - opacity) * -28,
              scaleY: 0.4 + 0.6 * opacity,
              scaleX: 0.55 + 0.45 * opacity,
              transformOrigin: "top center",
            }}
          >
            <div className="banner-top">
              <span className="notification-icon">
                <Icon name="bell" />
              </span>
              <div className="banner-words">
                <small>
                  {n.urgency === "critical" && (
                    <b className="critical">Critical </b>
                  )}
                  {n.app}
                </small>
                <button
                  type="button"
                  className="banner-default"
                  onClick={() => dispatch({ type: "bannerClose", id: n.id })}
                >
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                </button>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={`Close Banner ${n.id}`}
                onClick={() => dispatch({ type: "bannerClose", id: n.id })}
              >
                <Icon name="dismiss" size={14} />
              </button>
            </div>
            {n.action && (
              <button
                type="button"
                className="banner-action"
                onClick={() =>
                  dispatch({ type: "bannerClose", id: n.id, action: true })
                }
              >
                {n.action}
              </button>
            )}
          </motion.article>
        ))}
      </section>
      {osd.map(({ key, item, opacity, exiting }) => (
        <motion.div
          className={`osd overlay-palette ${experiment && s.material === "glass" ? "material-glass" : ""}`}
          key={key}
          data-testid="osd"
          role="status"
          aria-hidden={exiting || undefined}
          aria-label={`${item.kind} ${item.value}`}
          style={{ opacity, y: experiment ? 10 * (1 - opacity) : 0 }}
        >
          <Icon
            name={
              item.kind === "brightness"
                ? "sun"
                : item.kind === "microphone"
                  ? "microphone"
                  : item.value === 0
                    ? "mute"
                    : "speaker"
            }
            size={22}
          />
          {item.kind === "microphone" ? (
            <strong>{item.value ? "Microphone on" : "Microphone muted"}</strong>
          ) : (
            <>
              <div className="progress-track">
                <span style={{ width: `${item.value}%` }} />
              </div>
              <small>{item.value}</small>
            </>
          )}
        </motion.div>
      ))}
    </>
  );
}
