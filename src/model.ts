// Single-output, local simulation. Time enters through advance, never Date.now().
export type Mode = "baseline" | "mechanical" | "reduced";
export type Surface = "controls" | "media" | "notifications" | "launcher";
export type Detail = "wifi" | "bluetooth" | "audio" | null;
export type Kind = "media" | "timer" | "battery" | "workspace";
export type Activity = {
  id: string;
  kind: Kind;
  priority: number;
  posted: number;
  sequence: number;
  expires?: number;
  track?: number;
  seconds?: number;
  timerUntil?: number;
  paused?: boolean;
  percent?: number;
};
export type Notice = {
  id: number;
  app: string;
  title: string;
  body: string;
  urgency: "low" | "normal" | "critical";
  action?: string;
};
export type Banner = { notice: Notice; remaining: number };
export type Osd = {
  kind: "volume" | "brightness" | "microphone";
  value: number;
  until: number;
};
export type Raised =
  | { type: "surface"; surface: Surface }
  | { type: "peek"; id: string };
export type State = {
  now: number;
  epoch: number;
  motionAt: number;
  satellitesAt: number;
  playing: boolean;
  mode: Mode;
  material: "solid" | "glass";
  palette: "neutral" | "iris";
  activities: Activity[];
  sequence: number;
  primary: string | null;
  since: number;
  raised: Raised | null;
  detail: Detail;
  pinned: boolean;
  inside: boolean;
  hover: { id: string; at: number } | null;
  leaveAt: number | null;
  holdAt: number | null;
  notices: Notice[];
  banners: Banner[];
  queue: Notice[];
  bannerHover: boolean;
  nextNotice: number;
  osd: Osd | null;
  privacy: { microphone: boolean; camera: boolean; capture: boolean };
  wifi: boolean;
  network: string;
  bluetooth: boolean;
  device: string;
  microphone: boolean;
  volume: number;
  muted: boolean;
  brightness: number;
  dnd: boolean;
  profile: string;
  log: { id: number; text: string }[];
  nextLog: number;
  feedback: string;
  replay: { name: ScenarioName; index: number } | null;
};
export type Event =
  | { type: "media"; command: "start" | "change" | "stop" | "pause" }
  | { type: "timer"; command: "start" | "pause" | "cancel"; seconds?: number }
  | { type: "battery"; value: number | null }
  | { type: "satellite"; add: boolean }
  | { type: "workspace" }
  | { type: "notice"; urgency?: Notice["urgency"]; content?: Partial<Notice> }
  | { type: "bannerClose"; id: number; action?: boolean }
  | { type: "dismiss"; id: number }
  | { type: "clearNotices" }
  | { type: "bannerHover"; inside: boolean }
  | { type: "open"; surface: Surface }
  | { type: "collapse" }
  | { type: "enter"; id?: string }
  | { type: "leave" }
  | { type: "pin"; id?: string }
  | { type: "claim" }
  | { type: "detail"; detail: Detail }
  | {
      type: "toggle";
      key: "wifi" | "bluetooth" | "microphone" | "muted" | "dnd";
    }
  | { type: "connect"; key: "network" | "device"; value: string }
  | { type: "level"; kind: Osd["kind"]; value: number }
  | { type: "privacy"; key: keyof State["privacy"] }
  | { type: "profile"; value: string }
  | { type: "launch"; name: string };
export type Action =
  | Event
  | { type: "advance"; ms: number }
  | { type: "playing"; value: boolean }
  | { type: "mode"; mode: Mode }
  | { type: "material"; value: State["material"] }
  | { type: "palette"; value: State["palette"] }
  | { type: "reset" }
  | { type: "replay"; name: ScenarioName };

export const tracks = [
  { title: "A Walk", artist: "Tycho", album: "Dive", art: "dive", length: 316 },
  {
    title: "Weightless",
    artist: "Marconi Union",
    album: "Ambient Transmissions",
    art: "weightless",
    length: 489,
  },
  {
    title: "First Breath After Coma",
    artist: "Explosions in the Sky",
    album: "The Earth Is Not a Cold Dead Place",
    art: "earth",
    length: 573,
  },
];
export const apps = [
  { name: "Files", description: "Browse your files", icon: "folder" },
  { name: "Firefox", description: "Web browser", icon: "browser" },
  { name: "Foot", description: "Terminal emulator", icon: "terminal" },
  { name: "Spotify", description: "Listen to music", icon: "music" },
  { name: "Visual Studio Code", description: "Code editor", icon: "code" },
  { name: "Zed", description: "Code editor", icon: "code" },
];
export type ScenarioName = "morph" | "split" | "interrupt" | "overlays";
export const scenarios: Record<
  ScenarioName,
  { label: string; duration: number; steps: { at: number; event: Event }[] }
> = {
  morph: {
    label: "Rest → Expanded",
    duration: 7000,
    steps: [
      { at: 600, event: { type: "media", command: "start" } },
      { at: 1800, event: { type: "enter", id: "media" } },
      { at: 3000, event: { type: "open", surface: "media" } },
      { at: 4000, event: { type: "open", surface: "controls" } },
      { at: 4900, event: { type: "open", surface: "launcher" } },
      { at: 6000, event: { type: "collapse" } },
      { at: 6600, event: { type: "media", command: "stop" } },
    ],
  },
  split: {
    label: "Split + Satellites",
    duration: 8000,
    steps: [
      { at: 400, event: { type: "media", command: "start" } },
      { at: 1900, event: { type: "timer", command: "start" } },
      { at: 2400, event: { type: "battery", value: 18 } },
      { at: 3500, event: { type: "enter", id: "timer" } },
      { at: 4400, event: { type: "leave" } },
      { at: 4700, event: { type: "satellite", add: true } },
      { at: 5000, event: { type: "battery", value: 18 } },
      { at: 5300, event: { type: "satellite", add: true } },
      { at: 6200, event: { type: "timer", command: "cancel" } },
      { at: 6600, event: { type: "satellite", add: false } },
      { at: 7200, event: { type: "battery", value: null } },
    ],
  },
  interrupt: {
    label: "Interrupt + Reversal",
    duration: 7000,
    steps: [
      { at: 400, event: { type: "media", command: "start" } },
      { at: 1500, event: { type: "open", surface: "controls" } },
      { at: 1600, event: { type: "collapse" } },
      { at: 1680, event: { type: "open", surface: "launcher" } },
      { at: 3000, event: { type: "battery", value: 5 } },
      { at: 4400, event: { type: "battery", value: null } },
      { at: 5300, event: { type: "workspace" } },
    ],
  },
  overlays: {
    label: "Banners + OSD + Privacy",
    duration: 9000,
    steps: [
      { at: 400, event: { type: "privacy", key: "microphone" } },
      { at: 900, event: { type: "notice" } },
      { at: 1700, event: { type: "level", kind: "volume", value: 72 } },
      { at: 2300, event: { type: "level", kind: "brightness", value: 48 } },
      { at: 3200, event: { type: "notice", urgency: "low" } },
      { at: 4100, event: { type: "toggle", key: "dnd" } },
      { at: 4600, event: { type: "notice", urgency: "critical" } },
      { at: 5500, event: { type: "privacy", key: "capture" } },
      { at: 6500, event: { type: "open", surface: "notifications" } },
    ],
  },
};
export function initialState(mode: Mode = "baseline"): State {
  return {
    now: 0,
    epoch: 0,
    motionAt: 0,
    satellitesAt: 0,
    playing: true,
    mode,
    material: "solid",
    palette: "neutral",
    activities: [],
    sequence: 0,
    primary: null,
    since: 0,
    raised: null,
    detail: null,
    pinned: false,
    inside: false,
    hover: null,
    leaveAt: null,
    holdAt: null,
    notices: [],
    banners: [],
    queue: [],
    bannerHover: false,
    nextNotice: 1,
    osd: null,
    privacy: { microphone: false, camera: false, capture: false },
    wifi: true,
    network: "Studio",
    bluetooth: true,
    device: "AirPods Pro",
    microphone: true,
    volume: 64,
    muted: false,
    brightness: 80,
    dnd: false,
    profile: "Balanced",
    log: [],
    nextLog: 0,
    feedback: "",
    replay: null,
  };
}
export function frame(s: State) {
  const ranked = [...s.activities].sort(
    (a, b) => b.priority - a.priority || b.sequence - a.sequence,
  );
  const primary = ranked.find((a) => a.id === s.primary) ?? ranked[0];
  const all = ranked.filter(
    (a) =>
      a.id !== primary?.id &&
      !a.expires &&
      (a.priority === 3 || a.priority === 5),
  );
  return {
    primary,
    satellites: all.slice(0, 2),
    overflow: Math.max(0, all.length - 2),
  };
}
export function presentation(s: State) {
  if (s.raised?.type === "surface") return s.raised.surface;
  if (s.raised?.type === "peek") return "peek";
  const f = frame(s);
  return !f.primary ? "rest" : f.satellites.length ? "split" : "compact";
}
export function bodyIdentity(s: State) {
  const p = presentation(s),
    f = frame(s);
  if (s.raised?.type === "surface") return p;
  return `${p}:${s.raised?.type === "peek" ? s.raised.id : (f.primary?.id ?? "")}:${p === "split" ? (f.satellites[0]?.id ?? "") : ""}`;
}
export function contentIdentity(s: State) {
  return presentation(s) === "controls"
    ? `controls:${s.detail ?? "root"}`
    : bodyIdentity(s);
}

export type SatelliteMark =
  | { key: string; activity: Activity }
  | { key: "overflow"; overflow: number };

export function satelliteMarks(s: State): SatelliteMark[] {
  const p = presentation(s);
  const f = frame(s);
  const marks: SatelliteMark[] = f.satellites
    .slice(p === "split" || p === "peek" ? 1 : 0)
    .map((activity) => ({ key: activity.id, activity }));
  if (f.overflow) marks.push({ key: "overflow", overflow: f.overflow });
  return marks;
}

function stampMotion(previous: State, next: State): State {
  const oldMarks = satelliteMarks(previous)
    .map((mark) => mark.key)
    .join(":");
  const newMarks = satelliteMarks(next)
    .map((mark) => mark.key)
    .join(":");
  return {
    ...next,
    motionAt:
      contentIdentity(previous) === contentIdentity(next)
        ? next.motionAt
        : next.now,
    satellitesAt: oldMarks === newMarks ? next.satellitesAt : next.now,
  };
}
function collapse(s: State): State {
  return {
    ...s,
    raised: null,
    pinned: false,
    detail: null,
    hover: null,
    leaveAt: null,
    holdAt: null,
  };
}
function settle(s: State): State {
  const activities = s.activities.filter(
    (a) => !a.expires || a.expires > s.now,
  );
  const ranked = [...activities].sort(
    (a, b) => b.priority - a.priority || b.sequence - a.sequence,
  );
  const current = activities.find((a) => a.id === s.primary);
  const best = ranked[0];
  const keep =
    current && best?.priority === current.priority && s.now - s.since < 1500;
  const primary = (keep ? current : best)?.id ?? null;
  let next: State = {
    ...s,
    activities,
    primary,
    since: primary !== s.primary ? s.now : s.since,
  };
  if (next.raised?.type === "peek") {
    const f = frame(next);
    if (![f.primary?.id, f.satellites[0]?.id].includes(next.raised.id))
      next = collapse(next);
  }
  return next;
}
function post(s: State, item: Omit<Activity, "posted" | "sequence">): State {
  const old = s.activities.find((a) => a.id === item.id);
  let next = {
    ...s,
    sequence: s.sequence + 1,
    activities: [
      ...s.activities.filter((a) => a.id !== item.id),
      { ...item, posted: s.now, sequence: s.sequence + 1 },
    ],
  };
  // Critical battery preempts only on arrival/escalation, never on an in-place update.
  if (item.priority === 5 && old?.priority !== 5) next = collapse(next);
  return settle(next);
}
function notice(
  s: State,
  urgency: Notice["urgency"],
  content: Partial<Notice> = {},
): State {
  const n: Notice = {
    id: s.nextNotice,
    urgency,
    app: urgency === "critical" ? "System" : "Messages",
    title:
      urgency === "critical"
        ? "Connection needs attention"
        : "A new message from Hana",
    body:
      urgency === "critical"
        ? "Your session is still running. Check your connection."
        : "The next build is ready when you are.",
    action: urgency === "critical" ? undefined : "Reply",
    ...content,
  };
  const next = {
    ...s,
    nextNotice: s.nextNotice + 1,
    notices: [n, ...s.notices].slice(0, 100),
  };
  if (s.dnd && urgency !== "critical") return next;
  if (s.banners.length >= 3)
    return {
      ...next,
      queue: [...s.queue, n].sort(
        (a, b) =>
          Number(b.urgency === "critical") - Number(a.urgency === "critical"),
      ),
    };
  return {
    ...next,
    banners: [{ notice: n, remaining: duration(n) }, ...s.banners],
  };
}
function duration(n: Notice) {
  return n.urgency === "critical"
    ? Infinity
    : n.urgency === "low"
      ? 4000
      : 6000;
}
function fillQueue(s: State): State {
  const queue = [...s.queue],
    banners = [...s.banners];
  while (banners.length < 3 && queue.length) {
    const n = queue.shift();
    if (!n) break;
    banners.unshift({ notice: n, remaining: duration(n) });
  }
  return { ...s, queue, banners };
}
function event(s: State, a: Event): State {
  switch (a.type) {
    case "media": {
      const old = s.activities.find((a) => a.id === "media");
      if (a.command === "stop")
        return settle({
          ...s,
          activities: s.activities.filter((a) => a.id !== "media"),
        });
      return post(s, {
        id: "media",
        kind: "media",
        priority: 1,
        track:
          a.command === "change"
            ? ((old?.track ?? 0) + 1) % tracks.length
            : (old?.track ?? 0),
        paused: a.command === "pause" ? !old?.paused : false,
        expires:
          a.command === "pause" && !old?.paused ? s.now + 30000 : undefined,
      });
    }
    case "timer": {
      const old = s.activities.find((a) => a.id === "timer");
      if (a.command === "cancel")
        return settle({
          ...s,
          activities: s.activities.filter((a) => a.id !== "timer"),
        });
      if (a.command === "pause" && !old) return s;
      if (a.command === "pause")
        return {
          ...s,
          activities: s.activities.map((a) =>
            a.id === "timer"
              ? {
                  ...a,
                  paused: !a.paused,
                  timerUntil: a.paused
                    ? s.now + (a.seconds ?? 0) * 1000
                    : undefined,
                }
              : a,
          ),
        };
      return post(s, {
        id: "timer",
        kind: "timer",
        priority: 3,
        seconds: a.seconds ?? 25 * 60,
        timerUntil: s.now + (a.seconds ?? 25 * 60) * 1000,
        paused: false,
      });
    }
    case "battery":
      return a.value === null
        ? settle({
            ...s,
            activities: s.activities.filter((a) => a.id !== "battery"),
          })
        : post(s, {
            id: "battery",
            kind: "battery",
            priority:
              a.value <= 10 ||
              s.activities.find((a) => a.id === "battery")?.priority === 5
                ? 5
                : 3,
            percent: a.value,
          });
    case "satellite":
      return a.add
        ? post(s, {
            id: `timer-${s.sequence + 1}`,
            kind: "timer",
            priority: 3,
            seconds: 300,
            timerUntil: s.now + 300000,
            paused: false,
          })
        : settle({
            ...s,
            activities: s.activities.filter((a) => !a.id.startsWith("timer-")),
          });
    case "workspace":
      return post(s, {
        id: "workspace",
        kind: "workspace",
        priority: 2,
        expires: s.now + 1200,
      });
    case "notice":
      return notice(s, a.urgency ?? "normal", a.content);
    case "bannerClose": {
      const next = fillQueue({
        ...s,
        banners: s.banners.filter((b) => b.notice.id !== a.id),
        queue: s.queue.filter((n) => n.id !== a.id),
      });
      return a.action
        ? {
            ...next,
            notices: next.notices.filter((n) => n.id !== a.id),
            feedback: "Mock notification action invoked",
          }
        : next;
    }
    case "dismiss":
      return fillQueue({
        ...s,
        notices: s.notices.filter((n) => n.id !== a.id),
        banners: s.banners.filter((b) => b.notice.id !== a.id),
        queue: s.queue.filter((n) => n.id !== a.id),
      });
    case "clearNotices":
      return { ...s, notices: [], banners: [], queue: [] };
    case "bannerHover":
      return { ...s, bannerHover: a.inside };
    case "open":
      return {
        ...s,
        raised: { type: "surface", surface: a.surface },
        detail: null,
        pinned: false,
        hover: null,
        leaveAt: null,
        holdAt: s.inside ? null : s.now + 5000,
      };
    case "collapse":
      return collapse(s);
    case "enter":
      return {
        ...s,
        inside: true,
        leaveAt: null,
        holdAt: null,
        hover: a.id && !s.raised ? { id: a.id, at: s.now + 120 } : s.hover,
      };
    case "leave":
      return {
        ...s,
        inside: false,
        hover: null,
        leaveAt: s.raised && !s.pinned ? s.now + 250 : null,
      };
    case "pin": {
      if (s.raised)
        return {
          ...s,
          pinned: !s.pinned,
          holdAt: null,
          leaveAt: s.pinned && !s.inside ? s.now + 250 : null,
        };
      return {
        ...s,
        raised: a.id
          ? { type: "peek", id: a.id }
          : { type: "surface", surface: "controls" },
        pinned: true,
        holdAt: null,
        hover: null,
        leaveAt: null,
      };
    }
    case "claim":
      return { ...s, holdAt: s.holdAt ? s.now + 5000 : null };
    case "detail":
      return { ...s, detail: a.detail };
    case "toggle": {
      let next = { ...s, [a.key]: !s[a.key] };
      if (a.key === "dnd" && !s.dnd)
        next = {
          ...next,
          banners: s.banners.filter((b) => b.notice.urgency === "critical"),
          queue: s.queue.filter((n) => n.urgency === "critical"),
        };
      if (a.key === "microphone")
        next.osd = {
          kind: "microphone",
          value: Number(!s.microphone),
          until: s.now + 1200,
        };
      if (a.key === "muted")
        next.osd = {
          kind: "volume",
          value: s.muted ? s.volume : 0,
          until: s.now + 1200,
        };
      return next;
    }
    case "connect":
      return { ...s, [a.key]: a.value };
    case "level":
      return {
        ...s,
        ...(a.kind === "microphone" ? {} : { [a.kind]: a.value }),
        osd: { kind: a.kind, value: a.value, until: s.now + 1200 },
      };
    case "privacy":
      return { ...s, privacy: { ...s.privacy, [a.key]: !s.privacy[a.key] } };
    case "profile":
      return { ...s, profile: a.value };
    case "launch": {
      const isWallpaper =
        a.name.toLowerCase().includes("wallpaper") ||
        a.name.toLowerCase().includes("dark gradient");
      return {
        ...collapse(s),
        feedback: isWallpaper ? "" : `Mock launch: ${a.name}`,
      };
    }
  }
}
function record(s: State, a: Event): State {
  const next = stampMotion(s, event(s, a));
  const quiet = ["enter", "leave", "claim", "bannerHover"].includes(a.type);
  return quiet
    ? next
    : {
        ...next,
        nextLog: s.nextLog + 1,
        log: [
          {
            id: s.nextLog,
            text: `${(s.now / 1000).toFixed(1)}s  ${describe(a)}`,
          },
          ...s.log,
        ].slice(0, 8),
      };
}
function describe(a: Event) {
  if ("command" in a) return `${a.type} ${a.command}`;
  if ("surface" in a) return `open ${a.surface}`;
  if ("kind" in a) return `${a.kind} ${a.value}`;
  if ("key" in a) return `${a.type} ${a.key}`;
  return a.type;
}
function advanceChunk(s: State, ms: number): State {
  let next = {
    ...s,
    now: s.now + ms,
    activities: s.activities.map((a) => {
      if (a.seconds === undefined || a.paused) return a;
      // Derive from one deadline; repeated fractional subtraction drifts at second boundaries.
      const timerUntil = a.timerUntil ?? s.now + a.seconds * 1000;
      return {
        ...a,
        timerUntil,
        seconds: Math.max(0, (timerUntil - (s.now + ms)) / 1000),
      };
    }),
  };
  // Age existing Banners before posting anything that arrives at this chunk's endpoint.
  next = fillQueue({
    ...next,
    banners: next.banners
      .map((b) => ({
        ...b,
        remaining: b.remaining - (next.bannerHover ? 0 : ms),
      }))
      .filter((b) => b.remaining > 0),
  });
  const ended = next.activities.filter(
    (a) => a.kind === "timer" && a.seconds === 0,
  );
  if (ended.length) {
    next = {
      ...next,
      activities: next.activities.filter((a) => a.seconds !== 0),
    };
    next = notice(next, "normal", {
      app: "Kanade",
      title: "Timer finished",
      body: "Your timer has ended.",
      action: undefined,
    });
  }
  next = settle(next);
  if (next.hover && next.now >= next.hover.at && !next.raised)
    next = {
      ...next,
      raised: { type: "peek", id: next.hover.id },
      hover: null,
    };
  if (
    !next.pinned &&
    ((next.leaveAt !== null && next.now >= next.leaveAt) ||
      (next.holdAt !== null && next.now >= next.holdAt))
  )
    next = collapse(next);
  if (next.osd && next.now >= next.osd.until) next.osd = null;
  return stampMotion(s, next);
}
function advance(s: State, ms: number): State {
  const target = s.now + ms;
  let next = s;
  // Process exact deadlines, so stepping 8s equals eighty 100ms steps.
  while (next.now < target) {
    const current = next.activities.find((a) => a.id === next.primary);
    const newerEqual = next.activities.some(
      (a) => a.priority === current?.priority && a.sequence > current.sequence,
    );
    const deadlines = [
      ...next.activities.flatMap((a) => [
        a.expires,
        a.seconds !== undefined && !a.paused
          ? (a.timerUntil ?? next.now + a.seconds * 1000)
          : undefined,
      ]),
      ...(!next.bannerHover
        ? next.banners.map((b) => next.now + b.remaining)
        : []),
      next.hover?.at,
      next.leaveAt,
      next.holdAt,
      next.osd?.until,
      newerEqual ? next.since + 1500 : undefined,
    ].filter((t): t is number => t !== undefined && t !== null && t > next.now);
    const at = Math.min(target, ...deadlines);
    next = advanceChunk(next, at - next.now);
  }
  return next;
}
export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "mode":
      return {
        ...s,
        mode: a.mode,
        motionAt: a.mode === s.mode ? s.motionAt : s.now,
        satellitesAt: a.mode === s.mode ? s.satellitesAt : s.now,
      };
    case "material":
      return { ...s, material: a.value };
    case "palette":
      return { ...s, palette: a.value };
    case "playing":
      return { ...s, playing: a.value };
    case "reset":
      return {
        ...initialState(s.mode),
        epoch: s.epoch + 1,
        material: s.material,
        palette: s.palette,
        playing: s.playing,
      };
    case "replay":
      return {
        ...initialState(s.mode),
        epoch: s.epoch + 1,
        material: s.material,
        palette: s.palette,
        replay: { name: a.name, index: 0 },
      };
    case "advance": {
      // Split large manual steps at event boundaries, preserving event timestamps and expiry.
      const target = s.now + Math.max(0, a.ms);
      let next = s;
      while (next.replay) {
        const scenario = scenarios[next.replay.name];
        const step = scenario.steps[next.replay.index];
        if (!step || step.at > target) break;
        next = advance(next, step.at - next.now);
        const replay = next.replay;
        if (!replay) break;
        next = record(next, step.event);
        next.replay = { ...replay, index: replay.index + 1 };
      }
      next = advance(next, target - next.now);
      if (next.replay && next.now >= scenarios[next.replay.name].duration)
        next = { ...next, replay: null, playing: false };
      return next;
    }
    default:
      return record({ ...s, replay: null }, a);
  }
}
export type LauncherItem = {
  name: string;
  description: string;
  icon: string;
};

const emojiCatalog: LauncherItem[] = [
  { name: "✨ Sparkles", description: "Emoji", icon: "browser" },
  { name: "🚀 Rocket", description: "Emoji", icon: "browser" },
  { name: "💡 Idea", description: "Emoji", icon: "browser" },
  { name: "🎉 Party", description: "Emoji", icon: "browser" },
  { name: "☕ Coffee", description: "Emoji", icon: "browser" },
];

const wallpaperCatalog: LauncherItem[] = [
  { name: "Wallpaper: Iris", description: "Change wallpaper", icon: "browser" },
];

export function searchApps(query: string): LauncherItem[] {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  // Provider: Calculator (e.g. "12 * 8", "45 + 55", "100 / 4")
  if (/^[\d\s+\-*/().^]+$/.test(trimmed) && /[+\-*/]/.test(trimmed)) {
    try {
      const sanitized = trimmed.replace(/\^/g, "**");
      if (/^[\d\s+\-*/().]+$/.test(sanitized)) {
        const val = Function(`"use strict"; return (${sanitized})`)();
        if (typeof val === "number" && !Number.isNaN(val) && Number.isFinite(val)) {
          return [
            {
              name: `= ${val}`,
              description: `Calculator · ${trimmed} = ${val}`,
              icon: "terminal",
            },
          ];
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  // Provider: Emoji (e.g. ":rocket", ":sparkles" or "emoji")
  if (lower.startsWith(":") || lower === "emoji") {
    const term = lower.replace(/^:/, "");
    const matched = emojiCatalog.filter((e) =>
      !term || e.name.toLowerCase().includes(term) || e.description.toLowerCase().includes(term),
    );
    if (matched.length > 0) return matched;
  }

  // Provider: Wallpaper (e.g. "wallpaper" or "wall")
  if (lower.startsWith("wallpaper") || lower === "wall") {
    return wallpaperCatalog;
  }

  // Provider: Apps
  return apps
    .filter((a) =>
      words.every((w) =>
        `${a.name} ${a.description}`.toLowerCase().includes(w),
      ),
    )
    .sort(
      (a, b) =>
        Number(!a.name.toLowerCase().startsWith(lower)) -
          Number(!b.name.toLowerCase().startsWith(lower)) ||
        a.name.localeCompare(b.name),
    );
}
export function timerClock(seconds = 0) {
  const n = Math.ceil(seconds);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
