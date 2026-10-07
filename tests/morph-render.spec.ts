import { execFile } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));

test('clean checkout with URL-sensitive path renders the full film without audio preparation', async ({ page }) => {
  test.setTimeout(600_000);
  const checkout = await mkdtemp(path.join(tmpdir(), 'kanade # render-test-'));
  try {
    await mkdir(path.join(checkout, 'scripts'));
    await mkdir(path.join(checkout, 'public'));
    for (const file of ['package.json', 'scripts/render-morph.mjs', 'public/morph.html']) {
      await cp(path.join(root, file), path.join(checkout, file));
    }
    await cp(path.join(root, 'public/morph'), path.join(checkout, 'public/morph'), { recursive: true });
    await symlink(path.join(root, 'node_modules'), path.join(checkout, 'node_modules'), 'dir');
    await expect(access(path.join(checkout, 'renders'))).rejects.toThrow();

    // Exercise the documented command, not a separate smoke implementation.
    await run('npm', ['run', 'morph:render'], { cwd: checkout, timeout: 540_000, maxBuffer: 1024 * 1024 });
    const output = path.join(checkout, 'renders');
    await expect(access(path.join(output, 'soundtrack.wav'))).rejects.toThrow();
    const probe = await run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries',
      'stream=codec_type,width,height,r_frame_rate,nb_read_frames,duration', '-of', 'json',
      path.join(output, 'kanade-0.3.5.mp4')]);
    const streams = JSON.parse(probe.stdout).streams;
    expect(streams).toEqual(expect.arrayContaining([
      expect.objectContaining({ codec_type: 'video', width: 1440, height: 1440, r_frame_rate: '60/1', nb_read_frames: '840', duration: '14.000000' }),
      expect.objectContaining({ codec_type: 'audio', duration: '14.000000' }),
    ]));
    const inputs = JSON.parse(await readFile(path.join(output, 'browser-input.json'), 'utf8'));
    expect(inputs).toHaveLength(13);
    expect(inputs.filter((input: { kind: string }) => input.kind === 'click').map((input: { hit: string }) => input.hit))
      .toEqual(['button', 'island', 'play-control', 'toggle', 'tab-week', 'command']);

    const requests: string[] = [], errors: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http*://**', route => route.abort());
    await page.setViewportSize({ width: 1440, height: 1440 });
    await page.goto(pathToFileURL(path.join(output, 'kanade-0.3.5.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.locator('#audio').evaluate(el => (el as HTMLAudioElement).duration)).toBe(14);
    expect(await page.evaluate(() => document.fonts.check('500 23px Geist'))).toBe(true);
    expect(await page.locator('#asset-notices').textContent()).toContain('SIL OPEN FONT LICENSE');
    await page.evaluate(() => { window.setRenderMode(true); window.seek(0); });
    const first = await page.locator('#stage').screenshot();
    await page.evaluate(() => window.seek(14 - 1 / 60));
    expect((await page.locator('#stage').screenshot()).equals(first)).toBe(true);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await page.goto('about:blank');
    await rm(checkout, { recursive: true, force: true });
  }
});
