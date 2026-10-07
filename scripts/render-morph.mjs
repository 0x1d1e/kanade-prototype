import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'renders');
const full = process.argv.includes('--full');
const help = process.argv.includes('--help');
if (help) {
  console.log('node scripts/render-morph.mjs [--full]\nWithout --full: exact-beat frames, settled frames, contact sheet and standalone HTML.\n--full: also render 1440 square, 60fps, four subframes, audio. Requires ffmpeg; no dev server needed.');
  process.exit(0);
}
await mkdir(path.join(out, 'beats'), { recursive: true });
await mkdir(path.join(out, 'settled'), { recursive: true });
let html = await readFile(path.join(root, 'public/morph.html'), 'utf8');
for (const [name, mime] of [['geist.woff2', 'font/woff2'], ['soundtrack.mp3', 'audio/mpeg']]) {
  const asset = await readFile(path.join(root, 'public/morph', name));
  html = html.replace(`./morph/${name}`, `data:${mime};base64,${asset.toString('base64')}`);
}
const notices = `${await readFile(path.join(root, 'public/morph/NOTICE.txt'), 'utf8')}\n${await readFile(path.join(root, 'public/morph/OFL.txt'), 'utf8')}`;
html = html.replace('</head>', `<script type="text/plain" id="asset-notices">${notices.replace(/<\/script/gi, '<\\/script')}</script>\n</head>`);
const standalone = path.join(out, 'kanade-0.3.5.html');
await writeFile(standalone, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1440 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(pathToFileURL(standalone).href);
  await page.evaluate(async () => { await document.fonts.ready; window.setRenderMode(true); });
  const stage = page.locator('#stage');
  for (let beat = 0; beat < 28; beat++) {
    const filename = `beat-${String(beat).padStart(2, '0')}.png`;
    await page.evaluate(t => window.seek(t), beat * .5);
    await stage.screenshot({ path: path.join(out, 'beats', filename) });
    await page.evaluate(t => window.seek(t), beat * .5 + .24);
    await stage.screenshot({ path: path.join(out, 'settled', filename) });
  }
  // Contact sheet retains all 28 beats in chronological order, four beats per row.
  const sheet = spawn('ffmpeg', ['-y', '-v', 'error', '-framerate', '1', '-i', path.join(out, 'settled/beat-%02d.png'),
    '-vf', 'scale=360:360,tile=4x7', '-frames:v', '1', path.join(out, 'beat-sheet.png')]);
  const [sheetCode] = await once(sheet, 'exit');
  if (sheetCode) throw new Error(`Contact sheet ffmpeg failed: ${sheetCode}`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Beat frames and standalone HTML: ${out}`);
  if (full) {
    const audio = path.join(root, 'public/morph/soundtrack.mp3');
    const ffmpeg = spawn('ffmpeg', ['-y', '-v', 'warning', '-f', 'image2pipe', '-framerate', '240', '-vcodec', 'mjpeg', '-i', 'pipe:0',
      '-i', audio, '-vf', "tmix=frames=4:weights='1 1 1 1',select='eq(mod(n,4),3)',setpts=N/(60*TB)",
      '-r', '60', '-frames:v', '840', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-t', '14', '-movflags', '+faststart', path.join(out, 'kanade-0.3.5.mp4')],
    { stdio: ['pipe', 'inherit', 'inherit'] });
    const complete = once(ffmpeg, 'exit');
    let held = false;
    let eventIndex = 0;
    const events = [[.5, 'click'], [2.5, 'click'], [3, 'click'], [3.5, 'down'], [4.5, 'up'],
      [5, 'down'], [6, 'up'], [7, 'click'], [8, 'click'], [11, 'click'],
      [11.5, 'f'], [12, 'o'], [12.5, 'Enter']];
    const inputLog = [];
    // Native input actuates each beat cue before capture. Between cues, seek samples
    // the recorded choreography directly, keeping every subframe history-independent.
    for (let frame = 0; frame < 840; frame++) {
      for (let sub = 0; sub < 4; sub++) {
        const time = frame / 60 + (sub - 1.5) / 240;
        while (eventIndex < events.length && events[eventIndex][0] <= time) {
          const [at, kind] = events[eventIndex++];
          const p = await page.evaluate(t => window.study.pose(t), at);
          const x = 720 + p.cursor.x * p.z, y = 664 + p.cursor.y * p.z;
          await page.mouse.move(x, y);
          const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[role]')?.id, [x, y]);
          const expected = { '0.5': 'button', '2.5': 'island', '3': 'play-control', '3.5': 'scrub-control', '5': 'volume', '7': 'toggle', '8': 'tab-week', '11': 'command' }[at];
          if (expected && hit !== expected) throw new Error(`Cue ${at}s hits ${hit}, expected ${expected}`);
          if (kind === 'down') { await page.mouse.down(); held = true; }
          else if (kind === 'up') { await page.mouse.up(); held = false; }
          else if (kind === 'click') await page.mouse.click(x, y);
          else await page.keyboard.press(kind);
          inputLog.push({ time: at, kind, hit: hit ?? null });
        }
        const p = await page.evaluate(t => window.seek(t), time);
        if (held) {
          await page.mouse.move(720 + p.cursor.x * p.z, 664 + p.cursor.y * p.z);
          await page.evaluate(t => window.seek(t), time);
        }
        // The square stage fills this fixed viewport. Avoid element-stability waits
        // on every subframe; seek and the awaited animation frame already settle it.
        const image = await page.screenshot({ type: 'jpeg', quality: 95 });
        if (!ffmpeg.stdin.write(image)) await once(ffmpeg.stdin, 'drain');
      }
      if (frame % 60 === 0) console.log(`Render ${frame / 60}/14 seconds`);
    }
    ffmpeg.stdin.end();
    const [code] = await complete;
    if (code) throw new Error(`Video ffmpeg failed: ${code}`);
    if (errors.length) throw new Error(errors.join('\n'));
    await writeFile(path.join(out, 'browser-input.json'), `${JSON.stringify(inputLog, null, 2)}\n`);
    console.log(`Rendered ${path.join(out, 'kanade-0.3.5.mp4')}`);
  }
} finally {
  await browser.close();
}
