import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface StudyPose {
  t: number;
  w: number;
  h: number;
  r: number;
  z: number;
  cursor: { x: number; y: number };
  progress: number;
  volume: number;
  beat: number;
  scene: { id: string };
}
declare global {
  interface Window {
    seek(time: number): StudyPose;
    inspectAt(time: number): void;
    setRenderMode(value: boolean): void;
    finishStudyPlay?: () => void;
    firstStudyFrame?: { visual: number; audioAtTimestamp: number; startupMilliseconds: number };
    study: { duration: number; pose(time: number): StudyPose; spring(time: number, w?: number): number; steps(time: number, initial: number, changes: number[][], w?: number): number };
  }
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1440 });
  await page.goto('/morph.html');
  await page.evaluate(async () => { await document.fonts.ready; });
});

test('out-of-order seeking is pixel deterministic; surface and liquid element persist', async ({ page }) => {
  const surface = await page.locator('#surface').elementHandle();
  const liquid = await page.locator('#liquid-shape').elementHandle();
  await page.evaluate(() => window.seek(8.12));
  const first = await page.locator('#stage').screenshot();
  for (const time of [13.99, .1, 11.74, 5.8, 0, 9.3, 7.15, 8.12]) {
    await page.evaluate(t => window.seek(t), time);
    const valid = await page.locator('#surface').evaluate(el => ['x', 'y', 'width', 'height', 'rx'].every(key => Number.isFinite(Number(el.getAttribute(key)))));
    expect(valid).toBe(true);
  }
  expect(await page.locator('#stage').screenshot()).toEqual(first);
  expect(await surface?.evaluate(el => el.isConnected && el === document.getElementById('surface'))).toBe(true);
  expect(await liquid?.evaluate(el => el.isConnected && el === document.getElementById('liquid-shape'))).toBe(true);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('last video frame and negative subframes match first pixels and cursor velocity', async ({ page }) => {
  await page.evaluate(() => window.seek(0));
  const first = await page.locator('#stage').screenshot();
  for (const t of [14, 14 - 1 / 60, -.00625, .002083333, .00625, 13.95]) {
    await page.evaluate(time => window.seek(time), t);
    expect((await page.locator('#stage').screenshot()).equals(first), `seam at ${t}`).toBe(true);
  }
  const velocities = await page.evaluate(() => {
    const a = window.seek(0), b = window.seek(.001), c = window.seek(13.999);
    return [b.cursor.x - a.cursor.x, b.cursor.y - a.cursor.y, c.cursor.x - a.cursor.x, c.cursor.y - a.cursor.y];
  });
  expect(velocities).toEqual([0, 0, 0, 0]);
});

test('all beat actions stay legible; entering and exiting text never overlap', async ({ page }) => {
  const scenes = ['button', 'loader', 'check', 'island', 'player', 'volume', 'toggle', 'tabs', 'chart', 'command', 'palette', 'toast'];
  for (let frame = 0; frame < 840; frame++) {
    const sample = await page.evaluate(({ t, scenes }) => {
      const p = window.seek(t);
      const visible = scenes.filter(id => Number(document.getElementById(id)?.style.opacity) > .02);
      const surface = document.getElementById('surface');
      if (!surface) throw new Error('Missing morph surface');
      const body = surface.getBoundingClientRect();
      return { visible, left: body.left, right: body.right, top: body.top, bottom: body.bottom, w: p.w, h: p.h };
    }, { t: frame / 60, scenes });
    expect(sample.visible.length, `overlap at ${frame / 60}`).toBeLessThanOrEqual(1);
    expect(sample.left).toBeGreaterThan(70);
    expect(sample.right).toBeLessThan(1370);
    expect(sample.top).toBeGreaterThan(180);
    expect(sample.bottom).toBeLessThan(1140);
    expect(sample.w).toBeGreaterThan(0);
    expect(sample.h).toBeGreaterThan(0);
  }
});

test('held values follow cursor; released overdrag is continuous and near-critical', async ({ page }) => {
  for (const t of [3.5, 3.65, 3.9, 4.1, 5, 5.2, 5.5, 5.7, 5.85]) {
    const result = await page.evaluate(time => {
      const p = window.seek(time);
      const knob = document.getElementById(time < 5 ? 'progress-knob' : 'volume-knob');
      if (!knob) throw new Error('Missing slider knob');
      return { x: p.cursor.x, knob: Number(knob.getAttribute('cx')) };
    }, t);
    expect(result.x).toBeCloseTo(result.knob, 0);
  }
  const values = await page.evaluate(() => [5.999999, 6, 6.01, 6.3].map(t => window.seek(t).volume));
  expect(values[1]).toBeCloseTo(values[0], 7);
  expect(values[2]).toBeLessThan(values[1]);
  expect(values[3]).toBeCloseTo(1, 2);
  const overshoot = await page.evaluate(() => Math.max(...Array.from({ length: 1000 }, (_, i) => window.study.spring(i / 1000))));
  expect(overshoot).toBeLessThan(1.001);
});

test('real click, keyboard, drag and transport drive the study clock', async ({ page }) => {
  await page.getByRole('button', { name: 'Start morph', exact: true }).click();
  await expect(page.locator('#state-label')).toHaveText('02 / LOADER');
  await page.evaluate(() => window.inspectAt(2.24));
  await page.getByRole('button', { name: 'Expand music player' }).click();
  await expect(page.locator('#state-label')).toHaveText('05 / MUSIC PLAYER');
  await page.getByRole('button', { name: 'Play or pause music' }).click();
  await page.evaluate(() => window.inspectAt(5));
  const slider = page.getByRole('slider', { name: 'Volume', exact: true });
  const knob = await page.locator('#volume-knob').boundingBox();
  if (!knob) throw new Error('Missing volume knob bounds');
  const x = knob.x + knob.width / 2, y = knob.y + knob.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 260, y, { steps: 8 });
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  const before = await page.locator('#volume-knob').getAttribute('cx');
  await page.mouse.up();
  expect(Number(await page.locator('#volume-knob').getAttribute('cx'))).toBeCloseTo(Number(before), 4);
  await page.keyboard.press('Control+k');
  await expect(page.locator('#state-label')).toHaveText('11 / COMMAND PALETTE');
  await page.keyboard.press('f');
  await page.keyboard.press('o');
  await expect(page.locator('#query')).toHaveText('fo');
  await page.keyboard.press('Enter');
  await expect(page.locator('#state-label')).toHaveText('12 / CONFIRMATION');
  await page.keyboard.press('Escape');
  await expect(page.locator('#state-label')).toHaveText('01 / BUTTON');
  await page.getByRole('button', { name: 'Play study', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause study' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause study' }).click();
  const time = await page.locator('#timeline').inputValue();
  await page.waitForTimeout(100);
  await expect(page.locator('#timeline')).toHaveValue(time);
});

test('native focus cannot change exported geometry or stroke weights', async ({ page }) => {
  await page.evaluate(() => window.setRenderMode(true));
  await expect(page.locator('.controls')).toBeHidden();
  await expect(page.locator('.credits')).toBeHidden();
  for (const [time, id] of [[3.25, 'play-control'], [8.25, 'tab-week'], [11.24, 'focus-result']] as const) {
    await page.evaluate(t => window.seek(t), time);
    const before = await page.locator('#stage').screenshot();
    expect((await page.screenshot()).equals(before), 'viewport matches square stage').toBe(true);
    await page.locator(`#${id}`).click();
    await page.evaluate(t => window.seek(t), time);
    expect((await page.locator('#stage').screenshot()).equals(before), `pointer focus on ${id}`).toBe(true);
    await page.keyboard.press('Tab');
    await page.locator(`#${id}`).focus();
    expect(await page.locator(`#${id}`).evaluate(el => el.matches(':focus-visible'))).toBe(true);
    expect((await page.locator('#stage').screenshot()).equals(before), `keyboard focus on ${id}`).toBe(true);
    await page.evaluate(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement || active instanceof SVGElement) active.blur();
    });
  }
});

test('export cues hit real controls and native inputs actuate the cue clock', async ({ page }) => {
  await page.evaluate(() => window.setRenderMode(true));
  const events: [number, string, string | null, string][] = [
    [.5, 'click', 'button', 'LOADER'], [2.5, 'click', 'island', 'MUSIC PLAYER'],
    [3, 'click', 'play-control', 'MUSIC PLAYER'], [3.5, 'down', 'scrub-control', 'MUSIC PLAYER'],
    [4.5, 'up', null, 'VOLUME'], [5, 'down', 'volume', 'VOLUME'], [6, 'up', null, 'VOLUME'],
    [7, 'click', 'toggle', 'TOGGLE'], [8, 'click', 'tab-week', 'LIQUID TABS'],
    [11, 'click', 'command', 'COMMAND PALETTE'], [11.5, 'f', null, 'COMMAND PALETTE'],
    [12, 'o', null, 'COMMAND PALETTE'], [12.5, 'Enter', null, 'CONFIRMATION'],
  ];
  for (const [at, kind, expected, label] of events) {
    await page.evaluate(t => window.seek(t - .001), at);
    const p = await page.evaluate(t => window.study.pose(t), at);
    const x = 720 + p.cursor.x * p.z, y = 664 + p.cursor.y * p.z;
    await page.mouse.move(x, y);
    if (expected) {
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[role]')?.id, [x, y]);
      expect(hit, `cue at ${at}`).toBe(expected);
    }
    if (kind === 'down') await page.mouse.down();
    else if (kind === 'up') await page.mouse.up();
    else if (kind === 'click') await page.mouse.click(x, y);
    else await page.keyboard.press(kind);
    await expect(page.locator('#state-label')).toContainText(label);
  }
});

test('local assets load, study starts paused and prototype links to study', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(r.url()); });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('button', { name: 'Play study', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check('500 20px Geist'))).toBe(true);
  await expect.poll(() => page.locator('#audio').evaluate(el => (el as HTMLAudioElement).readyState)).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
  await page.goto('/');
  await page.getByRole('link', { name: '0.3.5 Beat Study' }).click();
  await expect(page).toHaveURL(/morph\.html$/);
});

test('reduced motion steps all 28 beats without autoplay, audio or ongoing choreography', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.getElementById('audio') as HTMLAudioElement).play = () => { throw new Error('Reduced Motion must not start audio'); };
  });
  await expect(page.locator('#cursor')).toHaveCSS('display', 'none');
  const next = page.getByRole('button', { name: 'Next beat', exact: true });
  await expect(next).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play study', exact: true })).toHaveCount(0);
  for (let beat = 1; beat <= 28; beat++) {
    await next.click();
    expect(Number(await page.locator('#timeline').inputValue())).toBeCloseTo((beat % 28) * .5 + .24, 3);
  }
  await page.locator('#stage').focus();
  await page.keyboard.press('Space');
  expect(Number(await page.locator('#timeline').inputValue())).toBeCloseTo(.74, 3);
  await expect(page.locator('#state-label')).toHaveText('02 / LOADER');
  const time = await page.locator('#timeline').inputValue();
  const frame = await page.locator('#stage').screenshot();
  await page.waitForTimeout(200);
  await expect(page.locator('#timeline')).toHaveValue(time);
  expect((await page.locator('#stage').screenshot()).equals(frame)).toBe(true);
  expect(await page.locator('#audio').evaluate(el => (el as HTMLAudioElement).paused)).toBe(true);
  await page.getByRole('button', { name: 'Restart study' }).click();
  await expect(page.locator('#timeline')).toHaveValue('0');
  await expect(next).toBeVisible();
});

test('enabling reduced motion stops active playback and disabling it stays paused', async ({ page }) => {
  await page.getByRole('button', { name: 'Play study', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause study' })).toBeVisible();
  await expect.poll(async () => Number(await page.locator('#timeline').inputValue())).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Next beat' })).toBeVisible();
  const time = await page.locator('#timeline').inputValue();
  await page.waitForTimeout(150);
  await expect(page.locator('#timeline')).toHaveValue(time);
  expect(await page.locator('#audio').evaluate(el => (el as HTMLAudioElement).paused)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Play study', exact: true })).toBeVisible();
  await page.waitForTimeout(150);
  await expect(page.locator('#timeline')).toHaveValue(time);
});

for (const start of [0, 3.24]) {
  test(`delayed successful playback aligns its first frame with audio when starting at ${start}s`, async ({ page }) => {
    await expect.poll(() => page.locator('#audio').evaluate(el => (el as HTMLAudioElement).readyState)).toBeGreaterThanOrEqual(2);
    await page.evaluate(time => {
      window.inspectAt(time);
      const audio = document.getElementById('audio') as HTMLAudioElement;
      const nativePlay = audio.play.bind(audio);
      const nativeFrame = window.requestAnimationFrame.bind(window);
      audio.play = async () => {
        const requestedAt = performance.now();
        await new Promise(resolve => setTimeout(resolve, 150)); // Audio has not started yet.
        await nativePlay();
        // Wait for real media advancement before resolving the delayed play promise.
        while (audio.currentTime < time + .075) await new Promise(resolve => setTimeout(resolve, 10));
        const startupMilliseconds = performance.now() - requestedAt;
        window.requestAnimationFrame = callback => nativeFrame(stamp => {
          window.requestAnimationFrame = nativeFrame;
          // RAF timestamps precede callback execution; compare both clocks at that timestamp.
          const audioAtTimestamp = audio.currentTime - (performance.now() - stamp) / 1000;
          callback(stamp);
          window.firstStudyFrame = {
            visual: Number((document.getElementById('timeline') as HTMLInputElement).value),
            audioAtTimestamp,
            startupMilliseconds,
          };
        });
      };
    }, start);
    await page.getByRole('button', { name: 'Play study', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.firstStudyFrame)).toBeTruthy();
    const frame = await page.evaluate(() => window.firstStudyFrame);
    if (!frame) throw new Error('Missing first playback frame');
    expect(frame.startupMilliseconds).toBeGreaterThanOrEqual(200);
    expect(frame.audioAtTimestamp - start).toBeGreaterThan(.025);
    expect(Math.abs(frame.visual - frame.audioAtTimestamp)).toBeLessThan(.025);
    await page.getByRole('button', { name: 'Pause study' }).click();
  });
}

test('pending audio play cannot restart playback after preference change or pause', async ({ page }) => {
  await page.evaluate(() => {
    (document.getElementById('audio') as HTMLAudioElement).play = () => new Promise<void>(resolve => { window.finishStudyPlay = resolve; });
  });
  await page.getByRole('button', { name: 'Play study', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!window.finishStudyPlay)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Next beat' })).toBeVisible();
  await page.evaluate(() => window.finishStudyPlay?.());
  await page.waitForTimeout(100);
  await expect(page.getByRole('button', { name: 'Next beat' })).toBeVisible();
  await expect(page.locator('#timeline')).toHaveValue('0');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const play = page.getByRole('button', { name: 'Play study', exact: true });
  await play.click();
  await play.click(); // Pause while audio.play() is still pending.
  await page.evaluate(() => window.finishStudyPlay?.());
  await page.waitForTimeout(100);
  await expect(play).toBeVisible();
  await expect(page.locator('#timeline')).toHaveValue('0');
});

test('period preview exposes only the functional Week button, not dead tabs', async ({ page }) => {
  await page.evaluate(() => window.inspectAt(7.74));
  const preview = page.getByRole('group', { name: 'Activity period preview' });
  await expect(preview.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  for (const id of ['tab-day', 'tab-month']) {
    const label = page.locator(`#${id}`);
    expect(await label.getAttribute('tabindex')).toBeNull();
    expect(await label.getAttribute('role')).toBeNull();
    expect(await label.getAttribute('aria-selected')).toBeNull();
    await expect(label).toHaveCSS('cursor', 'auto');
    await label.click();
    expect(Number(await page.locator('#timeline').inputValue())).toBeCloseTo(7.74, 3);
  }
  const week = preview.getByRole('button', { name: 'Select Week' });
  await expect(preview.locator('[tabindex="0"]')).toHaveCount(1);
  await expect(week).toHaveAttribute('aria-current', 'false');
  await week.click();
  expect(Number(await page.locator('#timeline').inputValue())).toBeCloseTo(8.24, 3);
  await expect(week).toHaveAttribute('aria-current', 'true');
  await page.evaluate(() => window.inspectAt(7.74));
  await week.focus();
  await page.keyboard.press('Enter');
  await expect(week).toHaveAttribute('aria-current', 'true');
  await page.evaluate(() => window.inspectAt(7.74));
  await week.focus();
  await page.keyboard.press('Space');
  await expect(week).toHaveAttribute('aria-current', 'true');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('tab-week');
});

test('measured soundtrack peaks land exactly on the approved 120 BPM grid', () => {
  const report = JSON.parse(readFileSync('public/morph/audio-analysis.json', 'utf8'));
  expect(report.output_bpm).toBe(120);
  expect(report.duration_seconds).toBe(14);
  expect(report.measured_bpm).toBeCloseTo(128, 0);
  expect(report.beat_grid).toEqual(Array.from({ length: 28 }, (_, i) => i * .5));
  for (const cue of report.ui_cues) {
    expect(cue.measured_peak_seconds).toBe(cue.beat_seconds);
    expect(cue.measured_peak_seconds % .5).toBe(0);
  }
});
