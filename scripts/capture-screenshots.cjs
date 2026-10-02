/* capture-screenshots.cjs -- CDP capture of 4 boot-animation moments */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SHOTS_DIR = path.join(ROOT, 'assets', 'screenshots');
const OUT_JSON = path.join(ROOT, 'screenshots.json');
const urlArg = process.argv[2] || ('file:///' + path.join(ROOT, 'preview.html').replace(/\\/g, '/'));

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const BROWSER = CANDIDATES.find((p) => fs.existsSync(p));
if (!BROWSER) { console.error('no chrome/edge found'); process.exit(2); }

fs.mkdirSync(SHOTS_DIR, { recursive: true });
fs.rmSync(OUT_JSON, { force: true });
for (const f of fs.readdirSync(SHOTS_DIR)) fs.rmSync(path.join(SHOTS_DIR, f), { force: true });

const PROFILE = require('./probe-chrome.cjs').mkProfile('cdp');
fs.mkdirSync(PROFILE, { recursive: true });

const TARGETS = [
  { name: '01-intro-logo',     phase: 'intro',  atIntroOffset: 1500, desc: 'Intro - DeepSeek horned logo + caption over black' },
  { name: '02-marathon-dots',  phase: 'logN',   atLogLines: 2,      desc: 'Marathon - three-zone blue dot maze in DOT/LOADING phase' },
  { name: '03-marathon-red',   phase: 'logN',   atLogLines: 3,      desc: 'Marathon - RED sweep redacting loaded sectors' },
  { name: '04-red-dissolve-reveal', phase: 'logN', atLogLines: 5, desc: 'Marathon - red sweep washing back out to black; the plate stays opaque, the UI only rises in the closing cross-fade' },
  { name: '05-after-boot',     phase: 'after',  waitMs: 15000,      desc: 'After boot - overlay removed, DSH UI visible' },
];

const browser = spawn(BROWSER, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--window-size=1280,800', '--mute-audio', '--no-first-run', '--disable-extensions',
  '--disable-background-networking', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--remote-debugging-port=0', '--user-data-dir=' + PROFILE, ...require('./probe-chrome.cjs').EXTRA_FLAGS, urlArg,
], { stdio: ['ignore', 'ignore', 'pipe'] });
browser.stderr.on('data', () => {});
browser.on('exit', () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJSON(u) {
  return new Promise((res, rej) => http.get(u, (r) => {
    let s = ''; r.on('data', d => s += d); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } });
  }).on('error', rej));
}
function cleanup() {
  try { execFileSync('taskkill', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
}

(async () => {
  let port = null;
  const portFile = path.join(PROFILE, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    if (fs.existsSync(portFile)) port = parseInt(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0], 10);
  }
  if (!port) { console.error('DevToolsActivePort never appeared'); cleanup(); process.exit(3); }

  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(100);
    try {
      const list = await getJSON('http://127.0.0.1:' + port + '/json/list');
      target = list.find((t) => t.type === 'page' && /preview\.html/.test(t.url || ''));
    } catch (e) {}
  }
  if (!target) { console.error('page target not found'); cleanup(); process.exit(4); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pend = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq;
    pend.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  const shot = async (format, quality) => {
    const r = await send('Page.captureScreenshot', { format, quality });
    return r.data;
  };

  await send('Runtime.enable');
  await send('Page.enable');

  // Event-driven timeline:
  //   introStart  = performance.now() at intro injection (proxy: page now - elapsedSinceNav)
  //   marathonStart = the moment we first see #mb-boot opacity == 1 (poll every 50ms)
  //   hostGone    = the moment #dshMarBootHost is removed
  const introStart = await evalJS('performance.now()');
  console.log('[cdp] introStart perfT=' + introStart);

  // phase 'intro' targets: schedule relative to introStart
  async function waitForIntroOffset(ms) {
    while (true) {
      const p = await evalJS('performance.now()');
      if (p - introStart >= ms) return p;
      await sleep(40);
    }
  }
  // phase 'logN' targets: poll host.querySelectorAll('.mb-line').length until it
  //   reaches `atLogLines` (log lines are appended by the engine's updateChrome,
  //   one per frame as scheduled in LOG[]; reading count tells us where in the
  //   sequence we are without depending on cold-start wall time).
  async function waitForLogLines(n) {
    const startPoll = Date.now();
    while (Date.now() - startPoll < 14000) {
      const cnt = await evalJS("(document.getElementById('dshMarBootHost') ? document.getElementById('dshMarBootHost').querySelectorAll('.mb-line').length : 0)");
      if (cnt >= n) return Date.now();
      await sleep(40);
    }
    throw new Error('logLines never reached ' + n + ' within 14s');
  }
  // phase 'after' targets: wait until host is removed
  async function waitHostGone(maxMs) {
    const startPoll = Date.now();
    while (Date.now() - startPoll < maxMs) {
      const has = await evalJS('!!document.getElementById("dshMarBootHost")');
      if (!has) return Date.now();
      await sleep(80);
    }
    throw new Error('host not removed within ' + maxMs + 'ms');
  }

  const captures = [];
  for (const t of TARGETS) {
    let perfNow = null;
    if (t.phase === 'intro') perfNow = await waitForIntroOffset(t.atIntroOffset);
    else if (t.phase === 'logN') perfNow = await waitForLogLines(t.atLogLines);
    else if (t.phase === 'after') { await waitHostGone(t.waitMs); perfNow = await evalJS('performance.now()'); }

    const probe = await evalJS("(() => ({ host: !!document.getElementById('dshMarBootHost'), boot: (document.getElementById('mb-boot') ? getComputedStyle(document.getElementById('mb-boot')).opacity : null), t: Math.round(performance.now()) }))()");
    let webp = null, png = null, err = null;
    try { webp = await shot('webp', 85); } catch (e) { err = 'webp:' + e.message; }
    try { png  = await shot('png'); } catch (e) { err = (err ? err + ' ' : '') + 'png:' + e.message; }
    const webpName = t.name + '.webp';
    const pngName  = t.name + '.png';
    if (webp) fs.writeFileSync(path.join(SHOTS_DIR, webpName), Buffer.from(webp, 'base64'));
    if (png)  fs.writeFileSync(path.join(SHOTS_DIR, pngName),  Buffer.from(png,  'base64'));
    captures.push(Object.assign({}, t, { probe: probe, webp: webp ? webpName : null, png: png ? pngName : null, err: err }));
    console.log('[shot] ' + t.name + ' (' + t.phase + ')  bootOp=' + probe.boot + '  perfT=' + probe.t + 'ms' + (err ? '  ERR: ' + err : ''));
  }

  const json = captures.map((c) => 'assets/screenshots/' + c.webp);
  fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2) + '\n');
  console.log('[json] -> ' + OUT_JSON);
  console.log('[shots] -> ' + SHOTS_DIR + '  (5 stages, .webp + .png)');
  ws.close();
  cleanup();
  process.exit(0);
})().catch((e) => { console.error('FATAL: ' + e.stack); cleanup(); process.exit(6); });