/* probe-chrome.cjs — 探针脚本共用的临时 Chrome profile 管理
 *
 * 背景：以前每个探针都写 `--user-data-dir=.generated/<x>-profile-<pid>`，
 *       跑一次留 ~25MB Chrome 缓存（Cache 12M + 组件缓存 + 优化模型 tflite），
 *       94 次累积 = 2.32GB，把 .generated 撑到 2.4G。
 *
 * 现在：① profile 建在系统临时目录（不再进项目）；
 *       ② node 进程退出/中断即删；
 *       ③ 每次启动先清扫 1 小时前的遗留（硬杀进程时留下的）。
 *
 * 用法：
 *   const { mkProfile, EXTRA_FLAGS } = require('../scripts/probe-chrome.cjs');
 *   const PROFILE = mkProfile('bf');
 *   spawn(BROWSER, [ ...'--user-data-dir=' + PROFILE, ...EXTRA_FLAGS, url ]);
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(os.tmpdir(), 'dsh-mar-probe');
const MAX_AGE_MS = 60 * 60 * 1000;

const tracked = [];

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 });
    return true;
  } catch (e) {
    return false; // 被占用就留给下一次 sweep()
  }
}

// 清扫上一次没走 exit 留下的目录
function sweep() {
  let names = [];
  try { names = fs.readdirSync(ROOT); } catch (e) { return 0; }
  const now = Date.now();
  let n = 0;
  for (const name of names) {
    const p = path.join(ROOT, name);
    try {
      const st = fs.statSync(p);
      if (st.isDirectory() && now - st.mtimeMs > MAX_AGE_MS) { if (rmrf(p)) n++; }
    } catch (e) {}
  }
  return n;
}

let hooked = false;
function hook() {
  if (hooked) return;
  hooked = true;
  const bye = () => { while (tracked.length) rmrf(tracked.pop()); };
  process.on('exit', bye);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => { bye(); process.exit(1); });
  }
}

function mkProfile(prefix) {
  sweep();
  const dir = path.join(ROOT, (prefix || 'probe') + '-' + process.pid);
  rmrf(dir);                                   // 同 pid 残留先清掉
  fs.mkdirSync(dir, { recursive: true });
  tracked.push(dir);
  hook();
  return dir;
}

// 少往磁盘写：组件更新 / 优化指南模型 / 各种后台下载
const EXTRA_FLAGS = [
  '--disable-component-update',
  '--disable-background-networking',
  '--disable-domain-reliability',
  '--disable-sync',
  '--no-pings',
  '--disable-client-side-phishing-detection',
  '--disable-gpu-shader-disk-cache',
  '--disk-cache-size=1',
  '--media-cache-size=1',
  '--disable-features=OptimizationGuideModelDownloading,OptimizationHints,Translate,MediaRouter,InterestFeedContentSuggestions,CalculateNativeWinOcclusion',
];

module.exports = { mkProfile, EXTRA_FLAGS, ROOT, sweep, rmrf, MAX_AGE_MS };
