# Kanade prototype

Standalone React + TypeScript desktop simulation for comparing Kanade interactions and motion. All data is mocked; nothing connects to the shell, IPC, network, or system settings.

## Run

Use Node.js 24 LTS. Node.js 22.12+ on the 22.x line is also supported.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Desktop-first; use a viewport of at least 1100 × 700.

## Compare

- Select **Baseline**, **0.3.5 Mechanical Morph**, or **Reduced Motion**. Switching modes preserves application state. Mechanical keeps Baseline response timings to isolate choreography.
- Use the scenario panel to trigger Activities, Surfaces, Banners, OSD and privacy, or replay a scripted sequence. Replay resets simulation state.
- Pause, then step +20ms, +100ms or +1s to inspect geometry, content fades and album-art transitions. Playback speed changes simulation time, not spring parameters.
- Hover an Activity to Peek; click to expand; right-click to Pin. Click the Rest clock for Controls.
- Open Controls / Launcher / Notifications / Media with **Ctrl+Alt+C / L / N / M**. **Escape** backs out or collapses; **Ctrl+Alt+Escape** forces collapse. Tab reaches controls; arrows navigate Launcher and Notifications.
- Enable **Controls details** for mock navigation inside a fixed body. Back or Escape reverses its slide/fade. Material and overlay-palette experiments apply only in Mechanical Morph. Clean view hides comparison tools.

## 0.3.5 beat study

Open **0.3.5 Beat Study** in the toolbar, or `/morph.html`. This separate motion study preserves the comparison prototype. It starts paused; click to step, drag the media sliders, or use the timeline. Space plays/pauses, Ctrl/⌘K opens commands, Escape returns to the button.

```sh
npm run morph:beats   # inspect renders/beat-sheet.png before the full render
npm run morph:render  # 1440 square, 60fps, four blended subframes
```

Both commands export `renders/kanade-0.3.5.html` with embedded Geist and audio; no server or network needed. The full render produces `renders/kanade-0.3.5.mp4`. Requires Chromium and ffmpeg. To regenerate audio, install Python numpy and run `npm run morph:audio`; source music downloads temporarily, never into the repository.

`public/morph.html` owns the beat choreography and pure `window.seek(seconds)` renderer. Mouse/keyboard inputs drive the preview clock; export replays native inputs at beat cues and samples the same choreography independently. `public/morph/audio-analysis.json` records measured tempo, downbeat, processing offset and sound peaks. Source/license notices live in `public/morph/NOTICE.txt`.

## Baseline and limits

Geometry, tokens, SVG icons, interaction policy and spring/fade behavior were taken from the initial working tree of `../kanade` at commit `08f6e1c`. For upstream intent, read its `CONTEXT.md` and `docs/design.md`; current Rust code takes precedence over planned features.

The source checkout had uncommitted changes and continued evolving during prototyping. Its newer Wi-Fi network/password sub-surfaces are not mirrored here. Optional Wi-Fi, Bluetooth and audio detail views are simplified mocks. Mechanical Morph is an unapproved prototype candidate, not a discovered v0.3.5 specification or a Rust port.

The simulation is in-memory and resets on reload. Launcher actions report a mock launch; notification actions are simulated. No v0.4/v0.5 features or multi-monitor shell integration. SVG icons come from the Kanade checkout.

## Verify

```sh
npx playwright install chromium
npm run check
```

`package.json` owns the individual lint, unit-test, build and browser-test commands. Behavior and motion regressions live in `src/*.test.ts` and `tests/`.
