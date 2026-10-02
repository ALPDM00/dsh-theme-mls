/*
 * verify-headless.cjs  (temporary dev tool)
 * Drives a real headless Chrome/Edge over CDP (no puppeteer needed; Node>=22
 * ships global fetch + WebSocket) to verify the marathon boot animation:
 *   - intro stage runs (logo / solid cover)
 *   - marathon stage starts after intro
 *   - watchdog / __mbBootDone removes #dshMarBootHost
 * Captures screenshots + DOM probes at fixed real-time sample points.
 *
 * Usage: node verify-headless.cjs [pageUrl] [sampleStepMs]
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.generated', 'shots', 'cdp', 'run-' + Date.now());
const urlArg = process.argv[2] || 'file:///' + path.join(ROOT, 'preview.html').replace(/\\/g, '/');
const STEP = parseInt(process.argv[3] || '1500', 10);
const SAMPLES_MS = [1500, 5000, 7000, 9000, 11000, 12500, 13200, 14000, 16000, 18000];

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const BROWSER = CANDIDATES.find((p) => fs.existsSync(p));
if (!BROWSER) { console.error('no chrome/edge found'); process.exit(2); }

fs.mkdirSync(OUT, { recursive: true });
const PROFILE = require('./probe-chrome.cjs').mkProfile('cdp');
fs.mkdirSync(PROFILE, { recursive: true });

const browser = spawn(BROWSER, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--window-size=1280,800', '--mute-audio', '--no-first-run', '--disable-extensions',
  '--disable-background-networking', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--remote-debugging-port=0',
  '--user-data-dir=' + PROFILE, ...require('./probe-chrome.cjs').EXTRA_FLAGS,
  urlArg,
], { stdio: ['ignore', 'ignore', 'pipe'] });

let browserErr = '';
browser.stderr.on('data', (d) => { browserErr += d.toString(); });
browser.on('exit', (c) => console.log('[browser exited] code=' + c));

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let s = ''; res.on('data', (d) => (s += d)); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function cleanup() {
  try { execFileSync('taskkill', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
}

(async () => {
  // 1) wait for DevToolsActivePort
  let port = null;
  const portFile = path.join(PROFILE, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    if (fs.existsSync(portFile)) {
      const txt = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
      port = parseInt(txt[0], 10);
    }
  }
  if (!port) { console.error('DevToolsActivePort never appeared. stderr:\n' + browserErr.slice(0, 2000)); cleanup(); process.exit(3); }

  // 2) find the page target
  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(100);
    try {
      const list = await getJSON(`http://127.0.0.1:${port}/json/list`);
      target = list.find((t) => t.type === 'page' && /preview\.html/.test(t.url || ''));
    } catch (e) {}
  }
  if (!target) { console.error('page target not found'); cleanup(); process.exit(4); }

  // 3) CDP session
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pend = new Map();
  const jsErrors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') {
      jsErrors.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) ||
                    m.params.exceptionDetails.text);
    }
  };
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pend.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async function evalJS(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
  const PROBE = `(() => {
    var host = document.getElementById('dshMarBootHost');
    var boot = document.getElementById('mb-boot');
    var intro = document.getElementById('mb-intro');
    var dbg = document.getElementById('dbg');
    var cfg = (window.__mbMarathon && window.__mbMarathon.cfg) ? window.__mbMarathon.cfg : null;
    return {
      dbg: dbg ? dbg.textContent : null,
      host: !!host,
      boot: !!boot, bootOpacity: boot ? getComputedStyle(boot).opacity : null,
      introOpacity: intro ? getComputedStyle(intro).opacity : null,
      logLines: host ? host.querySelectorAll('.mb-line').length : -1,
      runClass: host ? ((' ' + host.className + ' ').indexOf(' mb-run ') >= 0) : false,
      lockup: host ? (host.querySelector('.mb-lockup') || {}).className || '' : '',
      replay: host ? (host.querySelector('.mb-replay') || {}).className || '' : '',
      cfgEnd: cfg ? cfg.END : null, cfgRedStart: cfg ? cfg.RED_START : null,
      bodyClass: document.body.className
    };
  })()`;

  await send('Runtime.enable');
  await send('Page.enable');

  // 4) sample loop
  const report = { browser: BROWSER, stepMs: STEP, samples: [] };
  console.log('[cdp] connected pid=' + browser.pid + ' port=' + port + '\n' + '[cdp] ' + urlArg);
  for (const at of SAMPLES_MS) {
    await sleep(STEP); // approximate spacing; keep monotonic real time
    const tNow = Date.now();
    let probe = null, shotErr = null;
    try { probe = await evalJS(PROBE); } catch (e) { probe = { evalError: e.message }; }
    let png = null;
    try {
      const sh = await send('Page.captureScreenshot', { format: 'png' });
      png = sh.data;
    } catch (e) { shotErr = e.message; }
    const name = 't' + String(at).padStart(5, '0');
    if (png) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(png, 'base64'));
    report.samples.push({ at, realT: Date.now() - tNow + at, probe, shot: png ? name + '.png' : null, shotErr });
    console.log(`[cdp] t~${at}ms  host=${probe && probe.host}  bootOp=${probe && probe.bootOpacity}  ` +
      `logLines=${probe && probe.logLines}  lockup=${probe && probe.lockup.indexOf('mb-show') >= 0}  ` +
      `replay=${probe && probe.replay.indexOf('mb-show') >= 0}  shot=${png ? 'ok' : 'FAIL'}`);
    // stop once host is gone + one confirmation sample after
    if (probe && probe.host === false && at >= 12500) { console.log('[cdp] host removed confirmed, finishing'); break; }
  }

  // final state (after everything)
  try {
    const fin = await evalJS(`(() => ({ host: !!document.getElementById('dshMarBootHost'),
      dbg: (document.getElementById('dbg')||{}).textContent||null }))()`);
    report.final = fin;
    console.log('[cdp] final host=' + fin.host);
  } catch (e) {}
  report.jsErrors = jsErrors;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('[cdp] report -> ' + path.join(OUT, 'report.json') + '  (jsErrors=' + jsErrors.length + ')');
  ws.close();
  cleanup();
  process.exit(jsErrors.length ? 5 : 0);
})().catch((e) => { console.error('FATAL: ' + e.stack); cleanup(); process.exit(6); });
