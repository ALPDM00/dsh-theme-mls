#!/usr/bin/env node
/* check.cjs — static validation of the plugin manifest & built client.
 * No runtime/browser needed. Exits non-zero on any failure. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname);
let failures = 0;
function fail(msg) { console.error('  ✗ ' + msg); failures++; }
function ok(msg) { console.log('  ✓ ' + msg); }

console.log('dsh-theme-mls · static check');

// package.json
const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) fail('package.json missing');
else {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'dsh-theme-mls') fail('package name mismatch: ' + pkg.name);
  else ok('package name = dsh-theme-mls');
  if (!pkg.exports || pkg.exports['./client'] !== './client.js') fail('exports["./client"] must -> ./client.js');
  else ok('exports["./client"] -> ./client.js');
  if (!pkg.dsh || !pkg.dsh.bundle || !pkg.dsh.bundle.patch) fail('package.json.dsh.bundle.patch missing');
  else ok('dsh.bundle.patch declared');
}

// cordis.patch.yml
const ymlPath = path.join(root, 'cordis.patch.yml');
if (!fs.existsSync(ymlPath)) fail('cordis.patch.yml missing');
else {
  const yml = fs.readFileSync(ymlPath, 'utf8');
  if (yml.includes('id: theme-mls') && yml.includes('dsh-theme-mls')) ok('cordis.patch.yml registers theme-mls');
  else fail('cordis.patch.yml does not register theme-mls');
}

// index.js (host half: the pre-plugin interval)
const hostPath = path.join(root, 'index.js');
if (!fs.existsSync(hostPath)) fail('index.js missing');
else {
  const host = fs.readFileSync(hostPath, 'utf8');
  const mod = require(hostPath);
  if (typeof mod.apply !== 'function') fail('index.js must export apply(ctx)');
  else ok('index.js exports apply(ctx)');
  if (!/on\(\s*'webserver\/index-inject'/.test(host)) fail("index.js does not listen on 'webserver/index-inject'");
  else ok("index.js listens on webserver/index-inject");
  //    the row has to be a structured <style> row (the seam's own vocabulary),
  //    not a raw tapIndex string transform
  if (!/table\.push\(\s*\{\s*kind:\s*'style'/.test(host)) fail('index.js must push a { kind: \'style\' } row');
  else if (/tapIndex/.test(host)) fail('index.js fell back to tapIndex; the structured row is enough');
  else ok("index.js pushes a structured style row");

  const css = mod.NATIVE_BOOT_CSS;
  if (typeof css !== 'string' || css.length === 0) fail('NATIVE_BOOT_CSS missing');
  else {
    //    the host row must hide the native boot screen *while it is loading*
    //    and leave the failure card reachable: the spinner is the marker DSH
    //    drops on failure, so gating on it is what keeps "silent animation"
    //    from turning into "silent error".
    if (!/\[data-dsh-boot\]:has\(\[data-dsh-boot-spinner\]\)/.test(css)) fail('NATIVE_BOOT_CSS must gate on [data-dsh-boot]:has([data-dsh-boot-spinner])');
    else ok('native boot screen is gated on the spinner (failure card survives)');
    if (!/\[data-dsh-boot\]:has\(\[data-dsh-boot-spinner\]\)\s*>\s*\*\{display:\s*none/.test(css)) fail('NATIVE_BOOT_CSS does not hide the boot card contents');
    else ok('boot card contents hidden while loading');
    if (!/background:\s*#0B0D0B/.test(css)) fail('NATIVE_BOOT_CSS lost the void colour');
    else ok('boot plate recoloured to the void colour (#0B0D0B)');
    const htmlBodyRule = (css.match(/html,body\{[^}]*\}/) || [''])[0];
    if (htmlBodyRule === '') fail('NATIVE_BOOT_CSS lost the html,body background rule');
    else if (/!important/.test(htmlBodyRule)) fail('the html,body rule must not be !important — the theme has to be able to take over once it loads');
    else ok('html,body background stays overridable (no !important)');
    //    guard: never hide the whole plate, that would silence load failures too
    if (/\[data-dsh-boot\]\s*\{[^}]*display:\s*none/.test(css)) fail('NATIVE_BOOT_CSS hides the whole boot plate — load failures would go silent');
    else ok('the plate itself is never display:none');
  }
}

// assets/fonts/Maratype.otf
const fontPath = path.join(root, 'assets', 'fonts', 'Maratype.otf');
if (!fs.existsSync(fontPath)) fail('assets/fonts/Maratype.otf missing');
else ok('Maratype.otf present (user-supplied decorative font)');

// built client.js
const clientPath = path.join(root, 'client.js');
if (!fs.existsSync(clientPath)) fail('client.js missing — run `node scripts/build.cjs`');
else {
  const src = fs.readFileSync(clientPath, 'utf8');
  if (src.length < 1000) fail('client.js suspiciously small (' + src.length + ' bytes)');
  else ok('client.js present (' + src.length + ' bytes)');
  if (!src.includes('window.__ModuleLoader__.load')) fail('client.js does not call __ModuleLoader__.load');
  else ok('uses window.__ModuleLoader__.load');
  if (!src.includes('overrideTokens')) fail('client.js does not call overrideTokens');
  else ok('calls theme.overrideTokens');
  if (!src.includes('@font-face') || !src.includes('base64,')) fail('Maratype not inlined as base64 @font-face');
  else ok('Maratype inlined as base64 @font-face');
  if (src.includes('__MARATYPE_BASE64__')) fail('placeholder still present in built client.js');
  else ok('no __MARATYPE_BASE64__ placeholder remains');
  // boot payload (deepseek intro + marathon stage, injected at runtime)
  if (!src.includes('dshMarBootHost')) fail('boot host id missing');
  else ok('boot host #dshMarBootHost present');
  if (!src.includes('#mb-canvas') || !src.includes('#mb-intro')) fail('boot payload DOM (mb-canvas/mb-intro) missing');
  else ok('boot payload DOM embedded');
  if (!src.includes('__mbMarathon') || !src.includes('__mbIntroStop')) fail('boot engines (__mbMarathon/__mbIntroStop) missing');
  else ok('boot engines embedded');
  if (src.includes('/*__BOOT_PAYLOAD__*/') || src.includes('__IMG_')) fail('boot placeholder/image tokens still present');
  else ok('no boot placeholder/image token remains');
  // regression guard: the marathon engine must call the driver-registered
  // __mbBootDone (an earlier build called a stale __mbMarathonDone that
  // nothing defined — the overlay then only left via the 16s watchdog)
  if (src.includes('__mbMarathonDone')) fail('stale __mbMarathonDone callback name still present');
  else ok('no stale __mbMarathonDone callback');
  // UI reveal (2026-09-20, revised on request): the plate — blue field + black
  // slabs + red sweep — now stays opaque end to end, and the ONE reveal beat is
  // the final cross-fade: render() erases the whole plate uniformly
  // (`destination-out`) so 界面整体淡入 in one piece, while the UI-anchored
  // glitch marks (十字 on the sidebar, 红填充 on the composer) leave ahead of it.
  // The old panel-by-panel "hole punching" (ctx.clearRect per dissolving region)
  // is gone for good — assert it does not come back.
  if (!src.includes("hostEl.classList.add('mb-run')") || !src.includes('#dshMarBootHost.mb-run')) fail('canvas-owned underlay (.mb-run) missing');
  else ok('canvas-owned underlay embedded (.mb-run)');
  if (/ctx\.clearRect\(\s*rh\.x0/.test(src)) fail('per-region hole punching is back — the reveal is one cross-fade now');
  else if (!src.includes('destination-out') || !src.includes('CFG.FADE_AT')) fail('the final cross-fade (destination-out @ FADE_AT) is missing');
  else ok('single reveal beat: uniform cross-fade at FADE_AT');
  // The marks must be pinned to the two UI landmarks the request named, and the
  // selectors must survive DSH renaming its CSS-module hash prefix (the user
  // quoted `hHd-Xa_quietBars` / `wSkVaW_composerStack` — both are hash-prefixed,
  // so `[class*="_quietBars"]` / `[class*="composerHero"]` is the durable form).
  // NOTE: the engine source sits inside a JSON string in client.js, so every `"`
  // in it is escaped as `\"` — hence the `\\?` in these two patterns.
  if (!/UI_ANCHORS/.test(src) || !/\[class\*=\\?"_quietBars\\?"\]/.test(src) || !/\[class\*=\\?"composerHero\\?"\]/.test(src)) fail('glitch marks are not anchored on the sidebar / composer');
  else if (!/function drawSidebarCrosses/.test(src) || !/function drawComposerBox/.test(src)) fail('mark painters (drawSidebarCrosses / drawComposerBox) missing');
  else if (!/UI_CROSS_STEP/.test(src) || !/UI_MARK_LEAD/.test(src)) fail('mark tuning knobs (UI_CROSS_* / UI_MARK_*) missing');
  // the composer mark is a GRID OF SMALL BOXES, same logic as the sidebar crosses
  // (user, 2026-09-20). Two earlier variants were tried and rejected: one single
  // outline around the composer (`strokeRect`) and one solid red plate
  // (`fillRect` + `UI_BOX_FILL`). The tell for the good version is the per-cell
  // `ctx.rect(x - half, y - half, half*2, half*2)` — same half-arm formula as the
  // crosses. Asserted on whole-source markers, not a regex window: the function
  // body is ~1.2 kB and a window would drift into the next function.
  else if (!src.includes('half * 2, half * 2') || !src.includes('UI_BOX_SCALE')) fail('composer mark is not a tiled grid of boxes (expected per-cell ctx.rect using the shared half-arm formula)');
  else if (src.includes('strokeRect') || src.includes('UI_BOX_FILL')) fail('composer mark is a single box (strokeRect) or a solid plate (UI_BOX_FILL) again — it must tile small boxes like the sidebar crosses');
  else ok('glitch marks anchored: 十字铺侧栏 + 输入框方框点阵, leaving ahead of the plate');
  // ---- ASCII background layer (2026-09-20) ---------------------------------
  // Background ONLY: one fixed canvas under #root, with the four structural
  // full-viewport containers released via .mar-bg-clear and NOTHING else;
  // two colour pairs (主白+绿 / 主黑+绿) surfaced through a settings tab this
  // plugin injects into DSH's settings dialog. The original page's '*' glyphs
  // were removed on request — they must not creep back into the palette.
  if (!src.includes("var BG_PALETTE = '")) fail('background glyph palette missing');
  else if (src.split('var BG_PALETTE =')[1].split(';')[0].indexOf('*') >= 0) fail("the '*' glyph is back in the background palette");
  else if (!src.includes("light: { field: '#FFFFFF', ink: '192,254,4', light: true }") ||
           !src.includes("dark:  { field: '#0B0D0B', ink: '192,254,4', light: false }")) fail('the two background pairs (主白+绿 / 主黑+绿) are not the pinned mirror pair');
  // The white pair still has to flip the WHOLE UI: a white field under a dark UI
  // is the mirror of the old broken pairing (there it was white ink on green).
  // Three things have to hold together or the mode is broken again:
  //   * the UI flips to a light palette whenever that pair is chosen;
  //   * the scrim over the released containers is WHITE on that pair — the plate
  //     colour, so it dims the glyphs instead of fighting the field;
  //   * --mar-solid-ink (the ink for an accent/solid fill) must NOT move with the
  //     light layer. It used to be --mar-bg-void, which flips to white — that is
  //     white on green, the exact pairing this whole round exists to remove.
  else if (!src.includes('.mar-bg-light{') || !/\.mar-bg-light\{[\s\S]{0,40}?--mar-bg-void:#FFFFFF;/.test(src) ||
           !src.includes('--mar-ink-primary:#0B0D0B;')) fail('the light UI layer is missing (white field + dark UI = white on white)');
  else if (/body\.theme-marathon\.mar-bg-light\{[\s\S]{0,520}?--mar-solid-ink/.test(src)) fail('--mar-solid-ink is re-declared by the light layer — an accent fill would lose its black ink');
  else if (!src.includes("both('var(--mar-solid-ink)')")) fail('the on-solid label tokens are no longer pinned to --mar-solid-ink');
  else if (src.includes("'--dsw-alias-label-primary-foreground': both('var(--mar-bg-void)')")) fail('label-primary-foreground is bound to a surface colour again (it flips with the light layer)');
  // 2026-09-21 第二轮（user: "我们的背景动画也需要添加上，主白+绿色"）：遮罩整套拆掉。
  // 它只对旧的酸绿场有意义，而且会**叠加** —— frame / centerCol / 该列自己的 _root
  // 三层都带 .mar-bg-clear 且互相嵌套，60% 白雾落三遍 = 0.4^3 ≈ 6% 透过率。实测：
  // 画布在画（7509 个字形像素），屏幕上绿点 0 个。两套配色现在都是"场只换底"，
  // 点阵整片穿过界面，字色是底的对照色 —— 与主黑+绿 完全同构。
  else if (!src.includes('.mar-bg-clear{background-color:transparent!important;') ||
           !src.includes('background-image:none!important;}')) fail('the released containers no longer step aside (colour + background-image)');
  else if (src.includes('.mar-bg-veil .mar-bg-clear') || src.includes("classList.add('mar-bg-veil')") ||
           src.includes("'#mar-bg-veil'") || src.includes('id="mar-bg-veil"')) {
    fail('the veil is back — it compounds over the nested marked plates and hides the white field completely');
  }
  else if (!src.includes("classList.add('mar-bg-light')")) fail('the light layer is never switched on by the pair');
  // 2026-09-21 (user: "在关闭动画中，如果选为主绿+黑，关闭后会切换为主黑+绿"): the
  // colour pair and the field switch are SEPARATE state. The UI has to be read
  // from BG_STATE.scheme — reading it off the drawn field (null once the field is
  // off) is precisely the bug: 关闭动画 tore the light layer off 主白 + 绿.
  else if (!/var ui = BG_MODES\[BG_STATE\.scheme\]/.test(src)) fail('the UI pair is not read from BG_STATE.scheme (关闭动画 would flip 主白 + 绿 back to the dark pair)');
  else if (/if \(m && m\.light\)/.test(src)) fail('the light layer is bound to the drawn field again — 关闭动画 tears it off the page');
  else if (!src.includes("if (next !== 'off') BG_STATE.scheme = next;")) fail('picking a colour pair does not persist it (关闭动画 would forget which UI to keep)');
  else if (!src.includes("if (out.mode !== 'off') out.scheme = out.mode;")) fail('the stored colour pair is not restored on load');
  // 2026-10-01: the theme must ALSO drive DSH's appearance preference. The token
  // overrides are mode-independent, but body[data-ds-dark-theme] and html's
  // color-scheme are not — 主白 + 绿 with 通用设置 left on 深色 keeps native controls
  // and DSH's dark-scoped rules dark ("颜色的切换也不完整"). Guarded so setTheme's
  // theme/change cannot make it oscillate.
  else if (!/function syncThemePreference\(wantLight\)/.test(src) ||
           !/theme\.setTheme\(wantLight \? 'light' : 'dark'\)/.test(src) ||
           !/if \(resolvedLight === !!wantLight\) return;/.test(src)) fail('the theme no longer syncs DSH\'s appearance preference to the active pair (guarded) — 通用设置 left on 深色 makes the palette switch incomplete');
  else if (!/syncThemePreference\(ui\.light\);/.test(src)) fail('bgApplyMode does not sync the appearance preference, so it would only happen on some paths');
  else if (!src.includes('#mar-ascii-bg{position:fixed;inset:0') || !src.includes('z-index:0;pointer-events:none')) fail("the background canvas is not a non-interactive bottom layer");
  else if (!src.includes('function bgAnchorTargets') ||
           !src.includes('function bgPaintTargets') ||
           !src.includes("querySelector(':scope > div > div')") ||
           !src.includes('function bgUnmarkSidebar') ||
           !src.includes('_centerCol')) fail('background clear-marks are not pinned to the frame + the centre column + its own _root (the sidebar is deliberately excluded — it stays opaque)');
  else if (!src.includes('function bgTeardown')) fail('background layer has no teardown (it would outlive the plugin)');
  else if (!src.includes('function mountSettingsTab') || !src.includes('主题设置') || !src.includes('data-mar-nav')) fail('the background settings tab is missing');
  else if (!src.includes('dsh-theme-marathon.bg.v1')) fail('background settings are not persisted');
  // Responsiveness guards (2026-09-20, user: "设置选项卡在点击后不会立马出现"):
  //  * the tab must be mounted from the MutationObserver on _settingsArea, not
  //    only from the 1.2s timer — otherwise opening 设置 pops the tab in up to
  //    1.2s late (measured 831ms before, 49ms after).
  //  * the pane must be BUILT when the tab is mounted and parked at
  //    visibility:hidden — building it lazily on the first click cost ~90ms and
  //    read as the panel "loading".
  else if (!src.includes('new MutationObserver(kickSettingsSweep)')) fail('settings tab is not mounted immediately (observer no longer kicks the sweep)');
  else if (!src.includes('function kickSettingsSweep') || !src.includes('requestAnimationFrame(function () {')) fail('the immediate settings sweep is not rAF-coalesced');
  else if (!src.includes("pane.style.visibility = 'hidden'") || !src.includes("pane.style.visibility = 'visible'")) fail('the settings pane is not pre-built / parked hidden (it would rebuild on every click)');
  else if (/function showPane\(\)[\s\S]{0,400}?style\.display = 'block'/.test(src)) fail('the pane is switched with display again — that forces a reflow on every open');
  else ok('ascii background layer: 2 palettes (no *), structure-only clear-marks, own settings tab');
  // regression guards (2026-09-18):
  //  * the floating settings drawer is gone for good — its "启用主题" checkbox
  //    dropped the body class that styled its own gear button, so turning the
  //    theme off made the button unreachable.
  //  * the FUI plate layer is gone — its strips covered the deepseek logo and
  //    the sidebar 设置 row.
  if (/mar-set-toggle|dsh-theme-marathon-enabled/.test(src)) fail('in-page settings drawer / kill switch is back');
  else ok('no in-page settings drawer / kill switch');
  if (src.includes('mar-hud') || src.includes('MARATHON // CMD TERMINAL')) fail('HUD plate layer is back');
  else ok('no HUD plate layer');
  //  * every decorative overlay is gone (2026-09-18): the 28px grid, the
  //    multiply scanlines, the CRT beam/flicker and the sweep band. They were
  //    full-viewport layers stacked on top of DSH chrome — pure texture, and the
  //    scanlines darkened every surface by a fixed amount.
  //    Match rule heads / keyframe names, NOT bare class names: the removal note
  //    left in the stylesheet names all four in prose, so a substring test would
  //    match its own comment and fail spuriously. The keyframe test therefore
  //    lists the four dead animation names instead of a bare `mar-` prefix —
  //    the live mar-tile-out keyframe (settings panel reveal) is started by an
  //    explicit user action and removes itself.
  if (/\.mar-(grid|scanlines|crt|sweep)\s*\{|\.mar-layer\s*\{|mar-layer mar-|--mar-(grid-size|int)\s*:|@keyframes\s+mar-(crt|sweep|grid|scan)/.test(src)) fail('decorative overlay layer is back');
  else ok('no decorative overlay layers');
  if (!src.includes('--mar-bg-void:#0B0D0B') || !src.includes('--mar-bg-panel:#272733') || !src.includes('--mar-bg-overlay:#2E2F38') || !src.includes('--mar-ink-primary:#DFDEE0')) fail('fixed palette (#0B0D0B / #272733 / #2E2F38 / #DFDEE0) missing');
  else ok('fixed palette present');
  //  * left rail lighting (2026-09-18, revised): the static state is DSH's own
  //    neutral surface — no accent fill at rest. Exactly two states light up:
  //    新会话 on :hover and a session row on [_selected]. Session rows are a
  //    list, not a row of buttons, so even hover must leave them alone — the
  //    rule for them mutes DSH's own hover wash instead of painting an accent.
  if (!/--mar-accent-ink\s*:/.test(src)) fail('--mar-accent-ink missing (accent fill text colour)');
  else if (!/\[class\*="_newSession"\]:hover/.test(src)) fail('新会话 does not light up on hover');
  else if (!/\[class\*="_sessionRow"\]\[class\*="_selected"\]/.test(src)) fail('selected session row is not lit');
  else if (/\[class\*="_sessionRow"\]\s*[,\{]/.test(src)) fail('session rows carry a static fill (at rest they must match DSH)');
  else if (!/\[class\*="_sessionRow"\]:hover:not\(\[class\*="_selected"\]\)\{[\s\S]{0,120}?background:transparent!important/.test(src)) fail('session row hover is not muted');
  else if (!/button\[class\*="_primary"\]:not\(:disabled\)\{[\s\S]{0,200}?background-color:var\(--mar-accent\)!important/.test(src)) fail('the send button does not take the theme accent — it used to keep DSH\'s own fill and only ink the arrow ("发送按钮的颜色没有改变")');
  else if (/::-webkit-scrollbar[^{\n]*\{/.test(src)) fail('the theme styles ::-webkit-scrollbar again — the scrollbar must stay at DSH\'s default ("滚动条不要有绿色，保持默认就行")');
  else if (/--dsw-alias-scrollbar-(?:bg|hover)-l[12]/.test(src)) fail('a --dsw-alias-scrollbar-* override is back — those were what made the scrollbar green');
  else ok('left rail: 新会话:hover lights up, rows stay neutral, only [_selected] fills');
  //  * squareness (2026-09-18): one blanket rule instead of a short list, with
  //    the boot overlay's status disc as the single documented exception.
  if (!/body\.theme-marathon \*::after\{border-radius:0!important;\}/.test(src)) fail('blanket squareness rule missing');
  else if (!/body\.theme-marathon \*::before,/.test(src)) fail('squareness rule does not cover ::before');
  else if (!/body\.theme-marathon #dshMarBootHost \.mb-status-dot\{border-radius:50%!important;\}/.test(src)) fail('boot status disc exemption missing (it would render as a square)');
  else ok('blanket squareness rule + boot status disc exemption');
  //  * settings panel mosaic reveal (2026-09-18)
  if (!/\.mar-mosaic\s*\{/.test(src) || !/@keyframes\s+mar-tile-out/.test(src)) fail('settings mosaic CSS missing');
  else if (!/function mountMosaic/.test(src) || !/MOSAIC_GRID/.test(src) || !/MOSAIC_STEP/.test(src)) fail('settings mosaic mounting missing');
  else if (!/prefers-reduced-motion/.test(src) || !/reducedMotion\(\)/.test(src)) fail('settings mosaic does not honour reduced-motion');
  //  * tiles switch off, they do not animate (2026-09-18, revised): the tile
  //    animation exists only to carry the delay — duration 0s, opacity only.
  //    A scale (1 -> .7) on every tile turned one sweep into 25 little shrinks.
  else if (!/animation:mar-tile-out 0s/.test(src)) fail('tile animation is no longer instantaneous');
  else if (/@keyframes\s+mar-tile-out\{[\s\S]{0,160}?transform/.test(src)) fail('tile keyframes scale again (tiles must switch off, not shrink)');
  //  * no content fade (2026-09-18, revised): the panel's columns carry no
  //    animation — the tiles are the whole transition. A fade sitting on top of
  //    them read as the dialog fading in, which is not the effect. Test the
  //    rule heads, not the bare name: the removal note names what was deleted.
  else if (/@keyframes\s+mar-mosaic-content/.test(src) ||
           /\[class\*="_panel"\]\.mar-mosaic-on\s*>\s*\*/.test(src)) fail('settings panel content fade is back');
  else ok('settings panel mosaic reveal wired (5x5 tiles, instantaneous, deterministic order, no content fade)');
  //  * colour-pair switch (2026-09-21): switching 主白 + 绿 <-> 主黑 + 绿 used to
  //    repaint the whole UI in a single frame. It now plays the SETTINGS MOSAIC
  //    over that frame — the same SQUARE tiles, the same fixed pseudo-random
  //    order, the same 3-tile head, the same 0.341s total — so squares turn one at
  //    a time and a square that has NOT turned yet still shows the OLD picture.
  //    The tiles are square because the panel grid is square: 800x800 / 5 = 160px
  //    there, and the natural port of "5 across, 5 down" would be 315x180 slivers
  //    over a 1574x900 viewport. So the side comes from the viewport's SHORT edge
  //    and the column / row counts are derived from it (9x5 = 45 tiles on that
  //    viewport): the beats come out shorter than the panel's 0.0155s, the total
  //    is unchanged.
  //    That last part is the requirement, and it is why the whole thing has to
  //    run on View Transitions: they are the only thing that hands us the before
  //    and the after picture at the same time. The old snapshot is pinned and the
  //    new one is clipped to the squares that have already turned.
  //    FOUR other mechanisms were built and measured on this browser and all four
  //    are unusable; the assertions below pin the working one AND keep those from
  //    coming back:
  //      · N mask layers, each with its own animation-delay — mask-image/mask-size
  //        are LIST properties and an animation animates the whole property, so
  //        every instance fought over one value: four layers on four delays read
  //        back an identical computed mask-size;
  //      · mask-composite:intersect, to intersect "rings ∩ tile grid" — never
  //        computed, on a plain div either;
  //      · clip-path:url(#svg-clip) with one rect per tile — the same shape as the
  //        path() we ship and far easier to read, but the URL is resolved once,
  //        when the snapshot is created: growing those rects afterwards (CSS or
  //        setAttribute) never moved the clip again;
  //      · a plain mask-size animation without any list — that one does work, but
  //        its front edge is smooth, so tiles get cut in half mid-beat. Whole
  //        tiles is the entire point of this effect.
  //    And one that WORKS but was rejected on look: the centre-out square ring
  //    (clip-path:inset() driven by one registered length + steps()). It is
  //    monotone, so it cannot reproduce the mosaic order.
  //    Matching CSS DECLARATIONS (quote + optional indent + property:), never
  //    bare names: the comments above name these mechanisms on purpose.
  if (!/:root\.mar-vt-on::view-transition-old\(root\)\{animation:none;opacity:1;\}/.test(src)) fail('the old snapshot is not pinned at opacity 1 — it would fade out in .25s and a square that has not turned yet would go blank instead of showing the old UI');
  else if (!/:root\.mar-vt-on::view-transition-new\(root\)\{animation:mar-vt-mosaic var\(--mar-vt-dur\) both;\}/.test(src)) fail('the mosaic is not scoped to our own transition (html.mar-vt-on) — it would clip somebody else\'s view transition');
  else if (/['"]\s*mask-composite:/.test(src)) fail('mask-composite is back — measured: never computed in this browser, plain div included');
  else if (/['"]\s*clip-path:url\(#/.test(src)) fail('clip-path:url() is back — measured: the URL resolves once at snapshot creation and never updates');
  else if (/['"]\s*mask-image:/.test(src)) fail('the reveal went back to layering masks (mask-* are list properties; per-layer delays cannot be expressed)');
  else if (/['"]\s*clip-path:inset\(/.test(src)) fail('the centre-out ring is back — it is monotone and cannot reproduce the mosaic order');
  else if (/@property --mar-vt-r/.test(src)) fail('the registered pour length is back (the ring driver removed in 2026-09-21)');
  else ok('colour-pair switch: mosaic squares via clip-path:path(), old snapshot pinned, five dead ends still banned');
  if (!/function vtPour\(apply\)/.test(src)) fail('the switch driver is gone');
  else if (!/typeof doc\.startViewTransition === 'function'/.test(src) || !/window\.CSS\.supports\('clip-path', "path\('/.test(src)) fail('the driver does not probe for View Transitions and clip-path:path() support');
  else if (!/root\.classList\.add\('mar-vt-on'\)/.test(src) || !/root\.classList\.remove\('mar-vt-on'\)/.test(src)) fail('the switch does not put the scoping class on and off');
  else if (!/BG_STATE\.scheme !== prevPair\) vtPour\(bgApplyMode\)/.test(src)) fail('the switch is not gated on the colour PAIR moving (关闭动画 repaints nothing and must stay instant)');
  //    A wall-clock fallback timer used to sit on the tail of vtPour
  //    (`setTimeout(vtPourFinish, (dur + 1) * 1000)`). It only agrees with the
  //    reveal at 1x: the timer runs on the wall clock, the reveal on the
  //    animation clock, so slowing or freezing the animation for verification
  //    let the timer fire first — measured 2026-09-21 at 50x slow motion, it
  //    dropped mar-vt-on when only 3 of 25 tiles had turned, the UA group /
  //    fade-out were instantiated, and every square still on the old palette
  //    was cross-faded away. The re-entry teardown below covers what it was for.
  else if (/setTimeout\(vtPourFinish/.test(src)) fail('a wall-clock fallback for the pour is back — it truncates the reveal the moment the wall clock and the animation clock disagree');
  else if (!/if \(vtPouring\) vtPourFinish\(\);/.test(src)) fail('a new switch no longer tears the previous pour down — the flag can wedge and every later switch would silently skip the reveal');
  else ok('switch driver: capability probe, scoping class, no wall-clock fallback, gated on the pair');
  //    The frames are a clip-path:path() with one subpath per tile on a SQUARE
  //    grid, in the panel mosaic's own order — assert the pieces, not just "a path
  //    exists":
  if (!/function vtGrid\(vw, vh\)\s*\{[\s\S]{0,200}?Math\.min\(vw, vh\) \/ MOSAIC_GRID/.test(src)) fail('the tiles are no longer sized off the viewport SHORT edge — on a wide window they go back to being long rectangles');
  else if (!/cols: Math\.max\(1, Math\.ceil\(vw \/ side\)\)/.test(src) || !/rows: Math\.max\(1, Math\.ceil\(vh \/ side\)\)/.test(src)) fail('the column / row counts are not derived from the square side (stored counts would drift from the viewport)');
  else if (!/function vtClipFor\(order, liveCount, vw, vh, g\)/.test(src)) fail('no tile-union clip builder');
  else if (!/out\.push\('M0 0H0V0H0Z'\); continue;/.test(src)) fail('an un-turned tile must collapse to a ZERO-AREA subpath, or the command count changes and the value stops being animatable');
  else if (!/'M' \+ x0 \+ ' ' \+ y0 \+ 'H' \+ x1 \+ 'V' \+ y1 \+ 'H' \+ x0 \+ 'Z'/.test(src)) fail('the turned-tile subpath changed shape (must stay M/H/V/H/Z, five commands, every frame)');
  // 2026-10-01: the rect must be built from the same `side` the counts came from,
  // or the grid is counted as square and then stretched to vw/cols by vh/rows
  // (177.8 x 190.4 on a 1600x952 window — "方格大小也不对").
  else if (!/Math\.round\(c \* g\.side\) - 1/.test(src) || !/Math\.round\(\(c \+ 1\) \* g\.side\) \+ 1/.test(src)) fail('the tiles are not built from `side` across — the grid is counted as square and then stretched ("方格大小也不对")');
  else if (!/Math\.round\(r \* g\.side\) - 1/.test(src) || !/Math\.round\(\(r \+ 1\) \* g\.side\) \+ 1/.test(src)) fail('the tiles are not built from `side` down — same stretch vertically');
  //    `var order = mosaicOrder(total);` also exists in mountMosaic (the panel
  //    reveal), so any assertion about it must be pinned INSIDE vtBuildFrames —
  //    a bare source-wide test can never fail and would look green forever.
  else if (!/function vtBuildFrames\([^)]*\)\s*\{[\s\S]{0,200}?var order = mosaicOrder\(total\);/.test(src)) fail('the frames do not use the PANEL mosaic order (mosaicOrder) — the two reveals would drift apart');
  else if (!/'@keyframes mar-vt-mosaic\{'/.test(src) || !/%\{clip-path:'/.test(src)) fail('the generated frames do not build the mar-vt-mosaic keyframes the sheet expects');
  else if (!/';animation-timing-function:steps\(1,end\);\}'/.test(src)) fail('no steps(1,end) per frame — the path would interpolate and every square would grow out of its own corner');
  else if (!/vtClipFor\(order, MOSAIC_HEAD \+ i, vw, vh, g\)/.test(src)) fail('the frames do not fire MOSAIC_HEAD tiles on the first beat and one per step after');
  // 2026-10-01: pinning the length at the panel TOTAL squeezed a 1600x952 window's
  // 42 beats into 7.9ms each (under half a 60Hz frame), so the reveal rendered a
  // couple of tiles and then looked like it jumped ("先在左上角动一下，然后突然全部
  // 切换"). One MOSAIC_STEP per tile = the panel's own cadence; 25 tiles -> 0.341s.
  else if (!/function vtDuration\(total\)\s*\{[\s\S]{0,200}?\(Math\.max\(MOSAIC_HEAD, total\) - MOSAIC_HEAD\) \* MOSAIC_STEP/.test(src)) fail('the reveal length no longer follows the tile count — the viewport beats drop below one frame each');
  else if (!/var dur = vtDuration\(vg\.cols \* vg\.rows\);/.test(src)) fail('vtPour does not hand the tile count to vtDuration');
  else if (!/vtStyle = doc\.createElement\('style'\)/.test(src) || !/vtStyle\.id = 'mar-vt-frames'/.test(src) || !/doc\.head\.appendChild\(vtStyle\)/.test(src)) fail('the generated frames are not injected per switch');
  else if (!/vtStyle\.parentNode\.removeChild\(vtStyle\)/.test(src)) fail('the generated frames are never removed — they would be left on the page');
  else if (!/vtStyle\.textContent = vtBuildFrames\(vw, vh\)/.test(src)) fail('the frames are not rebuilt for the current viewport');
  else ok('mosaic frames: square grid off the short edge, one subpath per tile, panel order, hard cut per tile, injected and removed');
  //  * third-party sidebar entries in the collapsed rail (2026-09-18): plugins
  //    cannot register a sidebar slot, so they inject a full-width row with a
  //    left-aligned icon + label (data-dsh-part="sidebar-entry"). The collapsed
  //    rail is a 56px column of centred 36x36 cells instead, and the injecting
  //    plugin's own collapsed rule is keyed on [data-dsh-frame] — an attribute
  //    this DSH build does not have anywhere — so it never fires. Measured
  //    without this rule: the task-board icon sat on x=32 while every shell
  //    icon sits on x=28.
  if (!/\[data-sidebar-collapsed\]\s+\[data-dsh-part="sidebar-entry"\]\{/.test(src)) fail('injected sidebar entries are not centred in the collapsed rail');
  else if (!/\[data-sidebar-collapsed\]\s+\[data-dsh-part="sidebar-entry"\]\s*>\s*span\s*\+\s*span\{/.test(src)) fail('injected sidebar entry label is not hidden in the collapsed rail');
  else if (!/\[data-sidebar-collapsed\]\s+\[data-dsh-part="sidebar-entry"\]\{[\s\S]{0,220}?width:36px;/.test(src)) fail('collapsed sidebar entry is not a 36px cell');
  else ok('injected sidebar entries centred in the collapsed rail (icon-only 36x36)');
  //  * task-board intro (2026-09-18, rewritten to the user's reference file):
  //    @linxin666/dsh-client-ui-task-board has no entrance animation of its
  //    own, so one plays over it. The unit is the COLUMN — each of the five
  //    选项卡 is an opaque slab with four reticles on it, a 2px frame, and a
  //    2x2 grid of four rectangles that LEAVE one at a time in 1-2-4-3.
  //    (Two earlier builds were wrong and are asserted against below: one put a
  //    single reticle over the whole board, the next cut each CARD into four
  //    horizontal strips.)
  if (!/\[data-dsh-taskboard-board\]\{position:relative;\}/.test(src)) fail('board root is not a positioning context for the intro layer');
  else if (!/@keyframes\s+mar-cross-flash/.test(src)) fail('the reticle flash keyframes are missing');
  else if (!/@keyframes\s+mar-fade-in/.test(src) || !/@keyframes\s+mar-fade-out/.test(src)) fail('the frame fade keyframes are missing');
  else if (!/\.mar-col-intro\{[\s\S]{0,160}?grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;/.test(src)) fail('a tab is not a 2x2 grid of four rectangles');
  else if (!/\.mar-col-intro \.mar-col-mask\{[\s\S]{0,200}?animation:mar-tile-out 0s/.test(src)) fail('the rectangles animate instead of leaving on their frame (mar-tile-out 0s)');
  else if (!/\.mar-col-intro \.mar-col-mask\{[\s\S]{0,200}?background:var\(--mar-bg-void\)/.test(src)) fail('the rectangles are not filled with --mar-bg-void');
  //    regression (2026-09-18 at night): the first cut filled the rectangles
  //    with --mar-bg-panel — the COLUMN'S OWN colour. Grey on grey is an absent
  //    reveal, not a subtle one: the four were laid out perfectly and nothing on
  //    screen changed, so the 1-2-4-3 was unreadable and the effect had to be
  //    reported as invisible. They must stay darker than the tab they cover.
  else if (/\.mar-col-mask\{[\s\S]{0,200}?background:var\(--mar-bg-panel\)/.test(src)) fail('the rectangles are filled with the column colour again — they would be invisible on an empty board');
  else ok('the four rectangles contrast with the tab (--mar-bg-void over #272733)');
  if (!/\.mar-col-intro \.mar-col-frame\{[\s\S]{0,200}?border:2px solid var\(--mar-accent\)/.test(src)) fail('the frame is not a 2px accent ring on the tab edge');
  else if (!/\.mar-col-frame\{[\s\S]{0,320}?mar-fade-in \.16s linear var\(--mar-frame-at/.test(src)) fail('the frame does not take its arrival delay from BOARD_FRAME_AT');
  else if (!/\.mar-col-frame\{[\s\S]{0,320}?mar-fade-out \.16s linear var\(--mar-frame-out-at/.test(src)) fail('the frame does not take its departure delay from BOARD_LAST_AT');
  else ok('the frame is a 2px ring, arriving on BOARD_FRAME_AT and leaving on BOARD_LAST_AT');
  if (!/\.mar-cross\{[\s\S]{0,140}?width:var\(--mar-cross-size\)/.test(src) || !/mar-cross-flash \.1s linear/.test(src)) fail('the reticle is not the sizing/flashing one the reference uses');
  else if (!/mar-cross \.mar-h\{/.test(src) || !/mar-cross \.mar-v\{/.test(src) || !/mar-cross \.mar-dot\{/.test(src)) fail('the reticle is not drawn from its three bars');
  else if (!/mar-dot\{[\s\S]{0,160}?rotate\(45deg\)/.test(src)) fail('the reticle centre is no longer a diamond');
  else ok('reticle = 3 bars, diamond centre, .1s flash');
  if (!/querySelectorAll\('\[data-dsh-part="column"\]'\)/.test(src)) fail('the intro does not iterate the columns');
  else if (!/BOARD_BLOCK_TURN\s*=\s*\[0,\s*1,\s*3,\s*2\]/.test(src)) fail('the 1-2-4-3 order is missing');
  else if (!/function mountBoardIntro/.test(src) || !/BOARD_CROSS_ARMS\s*=\s*\['mar-h',\s*'mar-v',\s*'mar-dot'\]/.test(src)) fail('board intro mounting is missing');
  else ok('task board intro wired (per-tab slab + 4 reticles + 2px frame + 1-2-4-3)');
  //    regressions: neither earlier shape may come back — one reticle over the
  //    whole board, or rectangles cut per CARD. Matching RULE HEADS, not bare
  //    names (the comments above name them on purpose).
  if (/\.mar-card-mask\s*\{|\.mar-card-mask\s+i\s*\{|className\s*=\s*'mar-card-mask'/.test(src)) fail('per-card rectangles are back — the intro unit is the column, not the card');
  else if (/\.mar-col-strip\s*\{|className\s*=\s*'mar-col-strip'/.test(src)) fail('the horizontal-strip cut is back — the rectangles are the tab\'s four quadrants');
  else if (/mar-reticle-in|mar-reticle-out|mar-tile-in|--mar-out-at/.test(src)) fail('dead keyframes/vars from an earlier cut are back (mar-reticle-*, mar-tile-in, --mar-out-at)');
  else ok('no per-card / per-strip / per-board leftovers');
  //    the beats must add up, and the two that matter are: the frame has to be
  //    fully in before the first rectangle returns, and the frame has to leave
  //    on the very frame the fourth one does. Budget is 2s.
  {
    const num = (re) => parseFloat((src.match(re) || [])[1]);
    const frameAt = num(/BOARD_FRAME_AT\s*=\s*([\d.]+)/);
    const at = num(/BOARD_BLOCK_AT\s*=\s*([\d.]+)/);
    const step = num(/BOARD_BLOCK_STEP\s*=\s*([\d.]+)/);
    const lastAt = num(/BOARD_LAST_AT\s*=\s*([\d.]+)/);
    const span = num(/BOARD_INTRO_SPAN\s*=\s*([\d.]+)/);
    if ([frameAt, at, step, lastAt, span].some((v) => !isFinite(v))) fail('board intro constants missing');
    else if (frameAt + 0.16 > at + 1e-9) fail('the frame is still fading in when the first rectangle returns (' + frameAt + '+.16 > ' + at + ')');
    else if (Math.abs(at + 3 * step - lastAt) > 1e-9) fail('the fourth rectangle leaves at ' + (at + 3 * step) + 's but BOARD_LAST_AT is ' + lastAt + 's');
    else if (Math.abs(lastAt + 0.16 - span) > 1e-9) fail('BOARD_INTRO_SPAN must be BOARD_LAST_AT + the .16s fade in the stylesheet');
    else if (span > 2) fail('board intro budget ' + span + 's exceeds the 2s the brief allows');
    else ok('board intro budget = ' + span + 's (frame ' + frameAt + 's, rectangles leave ' + at + '/' + (at + step) + '/' + (at + 2 * step) + '/' + (at + 3 * step) + 's)');
  }

  // ---- terminal running indicator: REMOVED (2026-09-20, on request) -------
  //    The 8-block rotating stick built from 运行动画.html was taken back out.
  //    Asserted as GONE rather than simply deleted: it was a self-contained
  //    block, and a leftover `[class*="_runState_"]` rule would quietly repaint
  //    DSH's own glyph with nobody noticing.
  if (/_runState_|mar-run-stick|mar-run-b\d|mar-run-ink|mar-run-step|mar-run-box/.test(src)) {
    fail('the 8-block running stick is back (removed on request)');
  } else ok('running stick removed — no _runState_ / mar-run-* left in the build');

  // ---- "Deep diving..." turn status: flat ink, no shimmer ------------------
  //    background-clip:text paints the WHOLE line and the clock is a CHILD of
  //    it, so the moving highlight lands on the clock (the green band the user
  //    photographed). Any background / clip / animation here brings it back.
  if (!/\[class\*="_turnStatus"\]\{[\s\S]{0,220}?background:none;/.test(src)) {
    fail('turn status paints a background again — the shimmer band returns over the clock');
  } else if (!/\[class\*="_turnStatus"\]\{[\s\S]{0,260}?-webkit-background-clip:border-box;/.test(src)) {
    fail('turn status no longer resets -webkit-background-clip (the host still clips to text)');
  } else if (!/\[class\*="_turnStatus"\]\{[\s\S]{0,340}?animation:none;/.test(src)) {
    fail('turn status still runs the host 1.8s shimmer');
  } else if (!/\[class\*="_turnStatus"\]\{[\s\S]{0,240}?color:var\(--mar-status-ink,var\(--mar-accent-text\)\)/.test(src)) {
    fail('turn status does not take its ink from --mar-status-ink / --mar-accent-text');
  } else if (!/\[class\*="_turnStatus"\] \[class\*="_turnStatusClock"\]\{[\s\S]{0,180}?-webkit-text-fill-color:var\(--dsw-alias-label-caption\)/.test(src)) {
    fail('the clock is not pinned to its own opaque fill (a parent gradient could show through it)');
  } else ok('turn status = flat --mar-status-ink, no background/clip/animation; the clock keeps a plain count');

  // ---- the accent is a SURFACE, never a letterform (2026-09-21) ------------
  //    「主绿 + 黑」 flips the UI onto a white plate. Acid green as TEXT on that
  //    plate is 1.2:1 on white and 1.06:1 on its own hover wash — measured live
  //    by hovering 插件 in the settings nav, which turned the word into a green
  //    ghost. (The user's report: "主绿 + 黑 下 看不清，而且有时候只有主黑 + 绿
  //    会生效" — on the dark plate the same rule is 8.4:1, so only the green mode
  //    broke.) So every accent-as-`color` rule reads --mar-accent-text, which
  //    the light layer re-declares as the primary ink. The accent as a FILL is
  //    untouched and stays mode-independent: --mar-accent + --mar-accent-ink.
  //    The residual-pattern guard has to exclude `background-color:` (a plain
  //    `color:var(--mar-accent)` substring match would fire on the legit
  //    accent-face fill in the selected-cell rule).
  if (!src.includes('--mar-accent-text:#C0FE04;')) {
    fail('--mar-accent-text is not declared on the base theme block');
  } else if (!/mar-bg-light\{[\s\S]{0,700}?--mar-accent-text:#0B0D0B;/.test(src)) {
    fail('the light layer does not flip --mar-accent-text — green text on the white plate is invisible');
  } else if (/(^|[^-\w])color:var\(--mar-accent\)[;!]/.test(src)) {
    fail('a rule paints the accent as text again — use --mar-accent-text, or it disappears in 「主绿 + 黑」');
  } else if (!/\[class\*="_brandName"\]\{color:var\(--mar-accent-text\);\}/.test(src)) {
    fail('the brand lockup is not on --mar-accent-text (#C0FE04 on white is 1.2:1)');
  } else if (!/\.mar-bg-light \[class\*="_brandName"\] svg rect\{fill:var\(--mar-accent\);\}/.test(src)) {
    fail('the HARNESS badge pill is not pinned to the accent — with the lockup on the ink, pill and letters both come out #0B0D0B (a blank black chip)');
  } else ok('accent-as-text goes through --mar-accent-text (light layer flips it to the ink); accent-as-fill is unchanged');

  // ---- boot marks: which element each point-cloud hugs ---------------------
  //    Read from the engine SOURCE, not the bundle: the engine is embedded as a
  //    JSON string, so its newlines arrive in client.js as literal \n and any
  //    cross-line pattern there is a trap (see the rework of mar-run-b earlier).
  const eng = fs.readFileSync(path.join(root, 'src', 'boot', 'engine-marathon.js'), 'utf8');
  if (!eng.includes("composer: ['[class*=\"uV2eYG_card\"]'")) {
    fail('the composer mark no longer anchors on uV2eYG_card first (the 1310px band comes back)');
  } else if (!eng.includes("sidebar:  ['[class*=\"_quietBars\"]', '[class*=\"_railIn\"]', '[class*=\"_sidebarCol\"]']")) {
    fail('the sidebar mark lost its _sidebarCol fallback (it vanishes once a session is open)');
  } else if (!eng.includes('function hiddenTree(el)') ||
             !eng.includes('if (!r.hidden) return r;')) {
    fail('pickRect lost its two-pass visible-first pick');
  } else ok('boot marks hug the real input card, with a sidebar anchor that survives opening a session');

  // ---- background layer: the clear-marks -----------------------------------
  //    The sidebar root is `_root _quietBars` in the hero phase and plain `_root`
  //    once a conversation is open, and it lives at depth 2 (behind a
  //    display:contents wrapper) — so neither a `_quietBars` search nor a
  //    direct-children scan finds it. That was the bug: the whole column kept an
  //    opaque rgb(11,13,11) plate and the field disappeared behind the sidebar
  //    (.generated/probe-bgwho.cjs / probe-rootes.cjs). Marks must also be
  //    re-applied the moment the DOM changes, not only on the 1.2s sweep, or a
  //    session switch reads as "the field vanishes and comes back".
  if (!/function bgAnchorTargets\(\)/.test(src) ||
      !/var plate = cc\.querySelector\('\[class\*="_root"\]'\);/.test(src)) {
    fail('the anchor pass is gone — the centre column\'s plate (depth 2, plain _root) goes unmarked again');
  } else if (/bgPaintWalker\(sc, list, 0\)/.test(src) || /list\.push\(sc\)/.test(src)) {
    fail('the sidebar is walked/cleared again — the rail must keep its own opaque plate ("侧边栏不要透明")');
  } else if (!/function bgUnmarkSidebar\(\)/.test(src) ||
             !/bgMarkAdd\(bgPaintTargets\(\)\);\s*\n\s*bgUnmarkSidebar\(\);/.test(src)) {
    fail('nothing sweeps .mar-bg-clear off the sidebar subtree: the class is only ever ADDED, so a node marked by an earlier pass would stay see-through for good');
  } else if (!/var seat = cc \? cc\.querySelector\('\[class\*="composerSeat"\]'\) : null;/.test(src) ||
             !/if \(seat\) list\.push\(seat\);/.test(src)) {
    fail('the composer seat is no longer an anchor — it is 1284x146, so the 200x200 plate floor never reaches it and its dissolve gradient blacks out the bottom of every session again');
  } else if (!/\.mar-bg-clear\{background-color:transparent!important;[\s\S]{0,60}?background-image:none!important;/.test(src)) {
    fail('clearing a plate no longer kills its background-image — the composer dissolve is a linear-gradient, and background-color:transparent cannot touch a gradient');
  } else if (!/function bgPaints\(el\)/.test(src) || !/if \(r\.width < 200 \|\| r\.height < 200\) return false;/.test(src)) {
    fail('bgPaints lost its size floor (rows / the new-session button / the list fade would be marked)');
  } else if (!/function bgMarkAdd\(list\)/.test(src) ||
             !/bgMarkAdd\(bgAnchorTargets\(\)\);/.test(src)) {
    fail('bgKick no longer re-applies the cheap anchor pass');
  } else if (!/var bgObserver = null, bgKickRaf = 0, bgKickFullAt = 0;/.test(src) ||
             !/bgObserver\.observe\(host, \{ childList: true, subtree: true, attributes: true, attributeFilter: \['class'\] \}\)/.test(src)) {
    fail('the DOM observer must also watch class changes: a session switch needs it to re-mark the rebuilt columns, and the FIRST sidebar hover drops DSH\'s _quietBars — a class-only repaint with no childList mutation — which left the rail an opaque rgb(11,13,11) plate until an unrelated node change kicked it (measured 517ms opaque; 0ms with the class filter)');
  } else if (!/if \(lost && now - bgKickFullAt >= 400\) \{/.test(src)) {
    fail('the plate scan is not gated on "a mark went offline" + the 400ms throttle');
  } else if (!/function bgModal\(el\)/.test(src) ||
             !/if \(bgModal\(el\) \|\| bgLayer\(el\)\) return;/.test(src)) {
    fail('the plate walk does not stop at the modal / layer boundary — DSH mounts the settings dialog inside the sidebar subtree, so the dialog would be marked and go see-through');
  } else if (!/el\.getAttribute\('role'\) === 'dialog'/.test(src) ||
             !/el\.getAttribute\('aria-modal'\) === 'true'/.test(src) ||
             !/_overlay\|_modal\|_dialog\|_popover/.test(src)) {
    fail('bgModal lost one of its hints (role / aria-modal / class token)');
  } else if (!/if \(cs\.position === 'fixed' \|\| cs\.position === 'absolute'\) return false;/.test(src)) {
    fail('bgPaints no longer refuses floating layers — a modal or panel without a class hint would be marked again');
  } else if (!/function bgLayer\(el\)/.test(src) ||
             !/return cs\.position === 'absolute' \|\| cs\.position === 'fixed';/.test(src)) {
    fail('bgLayer is gone — the task board view ([data-dsh-taskboard-view], position:absolute appended to the centre column) and its five 243x821 columns would be marked and the whole board would go see-through');
  } else ok('background clear-marks: cheap anchor pass on every DOM change, style-reading plate scan on mount/sweep/loss');

  // ---- the nav cells: hover + selected, OURS AND THE HOST'S ----------------
  //    Both states are accent green and both are ours (the host paints its own
  //    "active" cell the panel colour, which reads as nothing). Selected uses the
  //    accent as a FACE, so the ink has to be --mar-accent-ink — the theme's own
  //    rule. The selected rules must sit AFTER the hover rule: same specificity,
  //    so the other order would let a hover trade the solid fill back for a tint.
  //    The rules must NOT be scoped to [data-mar-nav] / .mar-nav-on: that is
  //    exactly what made the first attempt a no-op — the host's own 通用设置 /
  //    模型 / 插件 / … cells carry neither hook, so only our 主题设置 cell lit up.
  //    Our cell must also stay out of `nativeCells`, or `.mar-nav-muted`'s
  //    !important transparent background would beat the accent fill.
  //    Cross-line: the sheet lives in client.js as an array of JS string lines,
  //    so two adjacent CSS lines are separated by `',\n        '` — a plain
  //    `\s*` between them does NOT match. Use a short lazy `[\s\S]{0,N}?`.
  if (!src.includes('--mar-wash-accent:rgba(192,254,4,.14);')) {
    fail('the accent wash token is gone — the hover tint has nothing to read from');
  } else if (!/\[class\*="_navCell"\]:hover\{[\s\S]{0,20}?background-color:var\(--mar-wash-accent\)!important;color:var\(--mar-accent-text\)!important;/.test(src)) {
    fail('the nav cells have no green hover state (wash + --mar-accent-text ink)');
  } else if (/\[class\*="_navCell"\]\[data-mar-nav\]:hover\{/.test(src)) {
    fail('the hover tint is scoped to our own cell again — the host\'s own cells would get nothing');
  } else if (src.indexOf('mar-nav-on:hover') < src.indexOf('[class*="_navCell"]:hover{')) {
    fail('the selected rules come before the hover rule — source order is what keeps the fill');
  } else if (!/\[class\*="_navCell"\]\.mar-nav-on,[\s\S]{0,170}?background-color:var\(--mar-accent\)!important;color:var\(--mar-accent-ink\)!important;/.test(src)) {
    fail('the selected settings tab does not use accent-as-a-face with --mar-accent-ink');
  } else if (!/\[class\*="_navCell"\]\[class\*="_active"\][\s\S]{0,170}?background-color:var\(--mar-accent\)!important;color:var\(--mar-accent-ink\)!important;/.test(src) ||
             !/\[class\*="_navCell"\]\[aria-current="true"\]/.test(src)) {
    fail('the host\'s own selected cell is not covered (needs both the `_active` token and aria-current as hooks)');
  } else if (!/\.mar-nav-on \*,[\s\S]{0,220}?\[aria-current="true"\] \*\{color:inherit!important;\}/.test(src)) {
    fail('the selected cell\'s label / icon no longer inherit the ink — the host colours them itself, so a green fill would keep near-white text');
  } else if (!/\.mar-tab-on \[class\*="_navCell"\]\.mar-nav-muted\{[\s\S]{0,150}?color:var\(--mar-ink-primary\)!important;\}/.test(src)) {
    fail('the native-cell stand-down is gone or no longer resets the ink — a transparent cell would keep #0B0D0B text and vanish into the panel');
  } else if (!/\.mar-tab-on \[class\*="_navCell"\]\.mar-nav-muted:hover\{[\s\S]{0,20}?background-color:var\(--mar-wash-accent\)!important;/.test(src)) {
    fail('the stand-down has no explicit :hover rule — with only a :not(:hover) exemption the host\'s stale _active (0,4,1) beats the plain hover rule (0,3,1) and the tint renders as a second solid fill');
  } else if (/\.mar-nav-muted:not\(:hover\)/.test(src)) {
    fail('the stand-down is back to a :not(:hover) exemption — see above');
  } else if (!/querySelectorAll\('\[class\*="_navCell"\]:not\(\[data-mar-nav\]\)'\)/.test(src)) {
    fail('nativeCells includes our own cell again — mar-nav-muted would strip the accent fill');
  } else ok('nav cells (ours + the host\'s): green hover (wash) + green selected (accent face, dark ink), one cell at a time');
}

console.log('');
if (failures > 0) {
  console.error(failures + ' check(s) failed.');
  process.exit(1);
}
console.log('All static checks passed.');
process.exit(0);
