# dsh-theme-mls

> Marathon-inspired FUI theme for **deepseekHarness** (the `web` profile).
> One flat neutral surface (`#0B0D0B` / `#272733` / `#2E2F38` / `#DFDEE0`),
> a single acid-green accent (`#C0FE04`) used in exactly two ways — the brand
> lockup, and two *lit* states (hovering 新会话, the selected session row) with
> `#0B0D0B` ink on top — every corner in the UI squared off, plus a one-shot
> boot sequence, a 0.5s 5×5 tile reveal when the settings dialog opens, and a
> 1.6s reticle-and-rectangle intro on each of the task board's five 选项卡.
>
> Two colour pairs, chosen in the settings tab: **主白 + 绿** (white field,
> green glyphs, and the whole UI flips to a white plate with ink text) and
> **主黑 + 绿** (black field, green glyphs, dark UI untouched). They are exact
> mirrors — only the *plate* flips, the glyph ink is the same acid green and the
> UI ink is the plate's opposite. In the light pair the accent is a **surface
> and nothing else** — see "The accent is a surface, never a letterform".

> **Web vs. desktop**: the desktop edition of the same theme —
> [`dsh-theme-mls-desktop`](https://github.com/ALPDM00/dsh-theme-mls-desktop) —
> shares this visual language and the `mar-*` namespace, but differs at the
> cold start (transparent window, whale-logo-first reveal, native
> caption-button handoff). Enable one or the other, never both: they inject
> the same boot overlay.

> **Asset policy**: this plugin is a *style tribute*. It contains **no**
> Bungie / Marathon copyrighted artwork, fonts, logos, audio, or trademarks.
> Every visual is programmatic (CSS, SVG, base64-embedded OTF). See
> [`docs/ASSET_POLICY.md`](docs/ASSET_POLICY.md).

## Install

```bash
dsh plugin --profile web add github:ALPDM00/dsh-theme-mls
```

Restart / reload the `web` profile. The theme is unconditional — there is no
in-page switch; enable or disable it from DSH's plugin list.

## Design language

See [`docs/design-language.md`](docs/design-language.md) — palette, the two
green rules (§2.0), component treatment, the settings mosaic reveal (§8.1),
the task-board intro (§8.2), the colour-pair pour (§8.3), and third-party
sidebar-entry alignment (§7.1).

### Reveal choreography

All three reveals are one-shot and self-deleting — no orphan animations are
left behind.

| Surface | Cue | Sequence | Budget |
| ------- | --- | -------- | ------ |
| Settings dialog | dialog opens | 5×5 tile mosaic wipes away in a fixed pseudo-random order | 0.5s |
| Task board | `data-dsh-taskboard-active` flips on | **each of the five 选项卡** (待规划 / 待办 / 进行中 / 已完成 / 已失败) gets its own set, and all five run on one clock: the tab is an opaque slab carrying 4 reticles, each flashing for 0.1s → a 2px green frame arrives (1.20→1.36s) → the slab's 2×2 quadrants are lifted one at a time in order **1-2-4-3** (TL, TR, **BR**, BL at 1.50 / 1.58 / 1.66 / 1.74s), each taking its reticle with it → the frame leaves on the very frame the fourth one does (1.74→1.90s) | 1.90s (≤2s) |
| Colour pair | the settings segment switches to another pair | the **settings mosaic itself is replayed over the palette**: the same fixed order, the same 3-tile head, the same 0.341s total, each square arriving whole — and the colour pair changes underneath as it plays. The tiles are **squares** (the side comes off the viewport's short edge, so a 1574×900 window gets 9×5 = 45 tiles of 174.9×180, not the panel's 315×180 slivers), which makes the beats 8.12ms instead of the panel's 15.5ms. The pre-switch snapshot stays pinned at opacity 1, so every square the mosaic has not reached yet still shows the **old** colours; only the squares that have turned show the new ones. Runs through View Transitions (which freezes the canvas field for those 0.341s), and the root group's own UA animation is killed so the reveal's length is the only clock. Only fires when the *pair* actually changes — 关闭动画 leaves the palette alone and switches instantly | 0.341s |

The choreography is the reference file's, ported from the card onto the column
(see `docs/design-language.md` §8.2).

The board rectangles use `animation: mar-tile-out 0s linear both` — the mosaic's
own keyframes — so the delay *is* the entire effect: a rectangle is there until
its frame and then simply gone, never fading, sliding or scaling. They are filled
with `--mar-bg-void` (**darker** than the column's `--mar-bg-panel`), which is
what makes them visible at all; filling them with the column colour, as an early
cut did, renders the whole effect invisible. A reticle is a child of its own
rectangle, so its lifetime is the rectangle's: it goes the moment its quadrant
comes back.

## Compatibility

Target: `deepseekHarness 0.1.0-rc.8+`. See
[`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md).

## The pre-plugin interval

DSH paints its own boot screen before any plugin bundle is fetched — the
`HARNESS` wordmark, a spinning arc, `Loading plugins…`. No client plugin can
reach it (it is on screen before the first plugin URL is requested), so the
Host half (`index.js`) hands the webserver a structured index-injection row
instead: one `<style>` element in the served `index.html` `<head>`, ahead of
every stylesheet and every script.

| Rule | Why |
| ---- | --- |
| `html,body{background:#0B0D0B}` | the plate is recoloured to the theme's void colour rather than removed, so the interval reads as "a dark screen" — which is already this theme's background |
| `[data-dsh-boot]:has([data-dsh-boot-spinner]){background:#0B0D0B!important}` | `[data-dsh-boot]` is the boot plate's own attribute (stable across builds, unlike its hashed class names) |
| `[data-dsh-boot]:has([data-dsh-boot-spinner]) > *{display:none!important}` | the wordmark/spinner/hint are hidden **only while the native spinner is still in the card** — DSH drops it when the boot fails, so a real plugin-load failure still paints its *Failed to load plugins* card |

Nothing is patched in `node_modules` and no host file is edited: unloading the
plugin withdraws the row and the native boot screen comes back untouched.

## Boot sequence

The plugin ships a fullscreen boot overlay that runs once when DSH injects the
client bundle. It is **self-contained**, namespaced under `#dshMarBootHost`,
and unconditionally tears itself down before the 16s watchdog so it can never
stall harness input.

| Phase | Time (design) | What happens |
| ----- | ------------- | ------------ |
| Intro  | 0.0–7.0s | Black backdrop, inverted-blue DeepSeek pixel logo flicker, fade to blue `#4D6CFE`, then green DeepSeek horned logo + `INTO THE UNKNOWN` caption zooms in and fades out |
| Marathon | 7.0–8.9s | Three-zone blue dot maze builds up panel by panel, then a `#FF003C` red sweep redacts each panel. The plate is **opaque end to end** — the app is live underneath, but nothing of it shows through yet |
| Glitch marks | 8.9–10.6s | The red washes back out to black, leaving two marks pinned to real DOM rects on that black plate: a `#FF003C` `+` grid filling the **sidebar** (`_quietBars` → `_railIn` → `_sidebarCol`) and a **grid of small `#FF003C` boxes tiling the input box** (`uV2eYG_card` → `uV2eYG_root` → `composerStack` → `composerHero`) — same grid, phase and size logic as the crosses, only the glyph differs |
| Exit | 10.6–11.4s | **One** cross-fade: the whole plate dissolves uniformly toward the live app (界面整体淡入) while the marks leave ~1.7× faster (十字先走、界面随后). `__mbBootDone` fires, the host fades and is removed |

The marks are measured from `getBoundingClientRect()` on every frame, so they
follow a collapsed sidebar, a window resize, or a composer that has moved to the
bottom of the window; the selectors are class-substring matches (`_quietBars` /
`uV2eYG_card`) rather than the hash-prefixed forms DSH prints
(`hHd-Xa_quietBars` / `uV2eYG_card`), because the hash prefix is a build artefact.
See "Boot marks: which element each point-cloud hugs" below for why each anchor
list is ordered the way it is.

Timings are design points (per-`region` timing adapts to viewport); real time adds
cold-start offset.

The boot PNGs (`assets/boot/*.png`) and `Maratype.otf` are inlined at build time
so no runtime network request is made. See [`docs/ASSET_POLICY.md`](docs/ASSET_POLICY.md)
for asset provenance.

## Background layer (ASCII dot field)

An animated field of monospace glyphs breathing behind the whole app. Ported from
a standalone page ("ASCII 点阵呼吸场"); the glyph strength comes from four
superposed sine waves, so dense characters pool where the field is strong and
nothing is drawn where it is weak. **It is a background and nothing else** — a
`position:fixed` canvas that is the first child of `<body>` (`z-index:0`,
`pointer-events:none`), sitting under `#root`.

| Piece | Detail |
| ----- | ------ |
| Canvas | `#mar-ascii-bg` carries the field colour itself (`--mar-bg-field`), so `clearRect` only wipes glyphs — the field is never repainted per frame |
| What steps aside | the frame, both columns, each column's own root, the composer's dissolve seat, plus anything that paints a ≥200×200 plate inside them — marked `.mar-bg-clear` at runtime, **never** a button, row, card, modal or floating panel (see "Background layer: who steps aside" below) |
| Colour pairs | 主白 + 绿 → white field `#FFFFFF` with acid-green glyphs, **and a light UI** (white plate, ink text, `--mar-accent-text` = the ink); 主黑 + 绿 → black field with the same acid-green glyphs, UI untouched. No scrim on either: the field runs through the chrome at full strength (see [Background layer](#background-layer)) |
| Glyphs | `   ...:::---+++◦◦••▢▣` — the original page's `***` tier was removed on request |
| Cost | rAF loop capped at 30fps; the field clock runs on wall time, so the cap drops frames rather than slowing the animation. Pauses on `document.hidden`; under `prefers-reduced-motion` it draws one static frame and never starts the loop |

Settings live in DSH's settings dialog, under the **主题设置** tab this plugin
injects into the nav column (the cell copies its className off a real sibling at
mount time). Both of its states are ours, and both are accent green over **every**
cell in that column — ours *and* the host's seven (通用设置 / 模型 / 插件 /
Agent 预设 / 插件市场 / Skill Inject / 技能市场) — because the host paints its
own "active" cell the panel colour and that reads as nothing:

* **hover** — the accent as a *wash* (`--mar-wash-accent`, the `--mar-wash-*`
  family) with the label lighting up to `--mar-accent-text`.
* **selected** — the accent as a *face*: solid `--mar-accent` with
  `--mar-accent-ink` (#0B0D0B) as the ink, which is this theme's own rule for a
  solid accent control, plus a dark inset marker (a green notch on a green fill
  is not a notch).

`--mar-accent-text` is what keeps the hover legible in **主白 + 绿**: it resolves
to the accent on the dark plate (8.35:1 on the wash) and to the primary ink on the
light one, where the same green on the same wash measures **1.06:1** — hovering a
cell made its label vanish into a green ghost. Same wash, different letterform:
that is the dark mode's logic with the plate swapped black → white.

Three selector details carry that, and each one is a bug that was caught live:

* The host's selection is matched by **two** hooks — its `_active` class token and
  `aria-current="true"` — either alone is a single point of failure across a DSH
  rebuild. Ours is matched by `.mar-nav-on`.
* The selected rules sit **after** the hover rule on purpose: they carry the same
  specificity, so the other order would let a hover trade the solid fill back for a
  tint. The cell is also kept out of the `nativeCells` list
  (`:not([data-mar-nav])`) — it used to be caught by that query and handed
  `.mar-nav-muted`, whose `!important` transparent background beats the accent fill.
* While our pane owns the content column, the host's own cell must **stand down**:
  DSH never learns that we switched, so it still counts its cell as active and two
  cells would light at once. The stand-down resets the fill, the marker shadow
  **and the ink** (a transparent cell wearing #0B0D0B text just disappears), and it
  has its own explicit `:hover` rule rather than a `:not(:hover)` exemption — the
  selected selector scores (0,4,1) against the plain hover rule's (0,3,1), so an
  exemption lets the stale `_active` win and the tint renders as a second solid
  fill instead of a wash.

### The accent is a surface, never a letterform

Every rule that draws the accent as `color` reads `--mar-accent-text`, **not**
`--mar-accent`. On the dark plate the two are the same green; on the light one the
variable is re-declared as the primary ink, because acid green on a white plate is
1.2:1 and on its own hover wash 1.06:1. Three places use it:

| Where | Why it is not `--mar-accent` |
| ----- | ---------------------------- |
| settings nav hover | the wash stays the accent; only the label flips — see above |
| brand lockup (`_brandMark` / `_brandName` / `_brandIdentity`) | #C0FE04 on white is a smudge; the lockup goes to the ink |
| "Deep diving…" line | `--mar-status-ink` falls back to it, so the status line is not green-on-white either |

One shape is deliberately **exempt**, and it is a trap worth spelling out: the
HARNESS badge inside the wordmark SVG is a single `<rect fill="currentColor">`
(`x=129.348 w=52 h=14 rx=2` — the only `<rect>` in that SVG) whose letters are
paths filled with `var(--dsw-alias-label-primary-inverted)`, i.e. `--mar-solid-ink`
`#0B0D0B` in **both** modes. Painting the whole lockup with the ink therefore makes
pill and letters the same colour and the badge becomes a blank black chip
(caught live, screenshot in `.generated/probe/brand-final.png`). So the pill is
pinned back to the accent under `.mar-bg-light`: in both modes the badge is a
**green face carrying black letters**, and only the wordmark changes colour.

`check.cjs` guards all of it: the token must exist, the light layer must flip it,
no rule may paint `color:var(--mar-accent)` (a `background-color:`-aware pattern,
so the legit accent-face fills do not trip it), the lockup must be on the token,
and the badge pill must be pinned to the accent.
`.generated/probe-accentink.cjs` measures it live in a headless Chrome on the real
page — idle vs hovered nav cell, the lockup, the badge pill, and the same three
after a **live** mode switch — and exits non-zero if any of them fails.
Evidence: `.generated/probe/hover-final.png`, `.generated/probe/brand-final.png`.

Left open on purpose, not overlooked: the host's own `--dsw-alias-state-business-primary`
(links, active tab labels) and `--dsw-alias-state-warn-label` still resolve to the
accent in both modes, so a link or an amber label is green-on-white in 主白 + 绿.
Both tokens are also used as **fills** (the trajectory timeline bars use
`warn-label` as a background, `business-primary` paints 2 switch tracks), so
flipping them to a text-only variable is a design decision rather than a bug fix.


Choosing a native tab hands the content column straight back to DSH. Options:
关闭动画 / 主白 + 绿 / 主黑 + 绿, plus 点阵密度 (grid px) and 呼吸速度. 关闭动画 only stops the field — the colour pair (and therefore the UI) stays where it is.
All of it is persisted under the `dsh-theme-marathon.bg.v1` localStorage key —
the key keeps its historical `marathon` spelling on purpose so this web edition
and [`dsh-theme-mls-desktop`](https://github.com/ALPDM00/dsh-theme-mls-desktop)
share one settings store and moving between them keeps your palette.

### Both halves of opening it are event-driven

The tab used to appear only on the theme's 1.2s sweep, so opening 设置 could show
the tab popping in half a second late (measured 831ms cold); the pane used to be
built on the first click, adding ~90ms of `innerHTML` parsing that read as the
panel "loading". Neither is timing-dependent now:

* the tab is mounted from the `MutationObserver` already watching
  `_settingsArea` (the permanent sidebar footer the dialog mounts into) — the
  observer calls `kickSettingsSweep()`, rAF-coalesced, so the tab lands on the
  same frame the dialog paints. Measured: **49ms cold, 23ms warm**, vs 831ms.
* the pane is built when the tab is mounted and parked at `visibility:hidden`
  (not `display:none`, so its layout box survives) — pressing the tab is a
  paint-only switch. Measured: visible on the next frame.

`probe/tablat` in `.generated/probe-tablat.cjs` measures both with real mouse
events via CDP; it is the regression test for "the tab feels slow".

## "Deep diving…" line and its clock

The host paints the turn-status line as a gradient clipped to the text, between
two `--dsw-static-deepseek-*` stops (a blue this theme never overrode) and slides
it with a 1.8s shimmer. That is gone: the line is **flat accent ink**
(`--mar-status-ink`, defaulting to `--mar-accent-text` — the accent on the dark
plate, the primary ink on the light one) with no background, no
`background-clip` and no animation.

Not a style preference — a `background-clip:text` background is painted for the
**whole line, children included**, and the clock is a child of it. The clock's own
fill is `--dsw-alias-label-caption`, which is 45% opaque (measured live), so the
moving highlight reads straight through the digits: 15s into a run the timer
arrived with a green band across it. Any background / gradient / clip on that
element brings the band back, which is why `check.cjs` fails if one reappears.
Evidence: `.generated/probe-turn.cjs` (before/after render + pixel counts).

The clock itself is untouched otherwise — it still counts, in the host's font and
caption colour, and its own background/animation are explicitly cleared.

## Boot marks: which element each point-cloud hugs

The closing beat of the boot animation lays a red grid over two real UI rects: a
cross grid over the sidebar and a small-box grid over the input field. Both are
measured from the live DOM every frame, so the anchors decide everything:

* **input field**: anchored on DSH's own card `uV2eYG_card` first, then
  `uV2eYG_root`, `composerStack`, `composerHero`. The two old anchors were both
  wrong in different phases — `composerHero`/`composerStack` are the same 242px
  wrapper in the hero phase (92px taller than the card), and once a conversation
  is open `composerHero` does not exist at all while `composerStack` becomes a
  full-column 1310px band (the card is 780px). The user's report — "the dialog
  moved down and the boxes no longer sit on it" — was exactly that.
* **sidebar**: `_quietBars` → `_railIn` → `_sidebarCol`. The rail drops
  `_quietBars` on pointer-enter and drops it for good once a conversation is
  open, so the column itself is the only anchor that always exists.
* `pickRect` walks the candidates in order, two passes: visible ones first, and
  only if none qualifies does it accept a hidden-but-laid-out element (DSH parks
  the composer seat with `visibility:hidden` while settling; that geometry is
  still correct and refusing it would drop the marks entirely).

Measured card rects: hero `780×118 @ y471`, session open `780×94 @ y854`.
Evidence: `.generated/probe-marks2.cjs` + `probe/` (`.generated/probe-rootes.cjs`
enumerates the anchors in both phases).

## Background layer: who steps aside

The ASCII field is a canvas at `z-index:0`, so any opaque plate above it hides it.
Those plates are found two ways, because they have very different costs:

* **anchors** (selector only, no style reads): the frame, both columns, each
  column's own root, and the composer's dissolve seat. For the sidebar the root is
  the *first* `_root` descendant in document order, which is always the outermost
  container — `_root _quietBars` in the hero phase and plain `_root` **at depth 2**
  (behind a `display:contents` wrapper) once a conversation is open.
* **paint scan** (reads computed style + layout): walks both columns and marks
  anything that paints a plate of its own, floored at 200×200 so session rows
  (254×34), the new-session button (252×38) and the list's bottom fade (256×24)
  keep their colours — selection and hover live on those.

**Clearing a plate kills its `background-image` too, not just its colour**, and
that is what the composer needs. In a session `wSkVaW_composerSeat` turns
`position:sticky` and paints `linear-gradient(transparent 0px, rgb(11,13,11) 36px)`
so the conversation dissolves under the composer; past the 36px stop that gradient
is fully opaque page colour. The seat is 1284×146 — full width, only 146 tall — so
the 200×200 floor never reached it, and the bottom ~110px of every session stayed a
dead black strip while the rest of the viewport breathed: the "the field does not
cover the message area at the bottom" report. It is an *anchor* now (a selector is
exact and free), and because `background-color:transparent` cannot touch a
gradient, the cleared rule also sets `background-image:none`. On the home page the
same node is `static` with no gradient (the hero composer is centred, nothing to
dissolve), so marking it is a no-op there.
Measured on `.generated/probe-composer-ab.cjs` (same session, same viewport, the
gradient re-injected as the only difference): the band below the card goes from
**0.00% to 7.9% animated pixels**, and the dead-zone map in
`.generated/probe/_map.py` shows the lower third of the page alive instead of blank.
The trade-off: content scrolling under the composer is no longer faded, so the
~36px band just above the card now shows through at full strength.

**A modal is never marked, and the walk never enters one.** DSH mounts its
settings dialog *inside the sidebar's own subtree* — measured path
`hHd-Xa_root > hHd-Xa_footArea > hHd-Xa_settingsArea > div > VOzbGW_overlay
(position:fixed, z-index:1000) > VOzbGW_panel (800×800)` — so the paint scan used
to reach it and strip its plate. The opening mosaic hid that (opaque tiles over
the whole panel); the moment the reveal finished, the tiles wiped off to nothing
but a see-through dialog, with our own `.mar-set-pane` transparent too. That is
the "the settings tab turns transparent once the animation ends, but it still
clicks" report. `bgModal()` prunes the walk at the boundary (`role="dialog"`,
`aria-modal="true"`, or a `_overlay`/`_modal`/`_dialog`/`_popover` class token),
and `bgPaints()` additionally refuses any floating layer as a backstop for a modal
that carries none of those hints. Evidence: `.generated/probe-navtab2.cjs`.

**Neither is an out-of-flow layer, and the walk never enters one.** Same bug,
different plugin: `@linxin666/dsh-client-ui-task-board` mounts its board as a panel
*appended to the centre column*
(`[data-dsh-taskboard-view]{position:absolute; inset:0; z-index:60}`, and
`[class*=centerCol] > :not([data-dsh-taskboard-view]){display:none!important}` hides
the conversation behind it — see the plugin's `board-mount.tsx`). Pruning only the
layer itself would have been enough to save nothing: the board root
(`position:relative`, 1294×900) and its five 243×821 columns sit *underneath* it, and
all seven nodes were on the `.mar-bg-clear` list. The board therefore lost
`bg-base` **and** `bg-layer-2` and the dot field ran straight through it — the
"the task board turns transparent once the animation ends" report (its own intro
covered the damage until it wiped off, exactly like the settings dialog).
`bgLayer()` prunes the walk at any `position:absolute|fixed` node — **mark it
never, descend into it never**. Chrome is always in flow (frame `relative`, both
columns `static`/`relative`, each column's `_root` `static`, the composer seat
`sticky`), so this costs nothing: across the home page, an open session and an open
board the paint scan's contribution beyond the anchors is **0 nodes**, while those
three states used to leak 1 / 0 / 7. Evidence: `.generated/probe-boardbg.cjs`,
`.generated/probe-boardbg2.cjs`; A/B with the bug re-injected:
`.generated/probe-board-ab.cjs` → board region **7.73% → 0.00% animated pixels**
and green **1.16% → 0.02%**, sidebar field untouched (9.3%).

The old code only knew `_quietBars`, so with a conversation open the sidebar kept
its opaque `rgb(11,13,11)` plate and the field vanished behind it: that is the
"sometimes the sidebar has the animation, sometimes it doesn't" report. Evidence:
`.generated/probe-bgwho.cjs`, `.generated/probe-rootes.cjs`, and the before/after
pixel counts from `.generated/probe-marks2.cjs` (sidebar shows the field in
**7.1%** of its pixels in *both* phases now; 4.7% before, i.e. UI colours only).

The marks sit on nodes DSH replaces on every session switch, so they are
re-applied when the DOM changes rather than on the 1.2s sweep: the mutation
observer runs the cheap anchor pass on every batch (rAF-coalesced) and the
style-reading paint scan only when a mark has gone offline, throttled to 400ms.
A node that loses its mark is recovered in **38ms** (measured).

Tuning constants live in the `BG_*` block of `src/client.template.js`:
`BG_PALETTE`, `BG_FLOOR` (strength cut-off), `BG_ALPHA0`/`BG_ALPHA1` (glyph
alpha ramp) and `BG_FPS`.

## Develop

```bash
npm run build       # base64-inline font + boot PNGs into client.js
npm run check       # static sanity over the build + manifest
npm run test        # jsdom loader + boot-payload structural tests
npm run selftest    # convenience runner for test/plugin.test.cjs (same suite as npm test)
npm run screenshots # regenerate assets/screenshots/*.webp + screenshots.json (headless CDP)
npm run verify:boot # headless CDP lifecycle check (intro -> marathon -> host removed)
```

`client.js` ships pre-built from `src/client.template.js`; only re-run `build`
if you touched the boot payload, the boot CSS, or the Maratype font.

The `probe/*.cjs` scripts and before/after screenshots quoted throughout this
document were design-iteration scratch kept in a gitignored `.generated/`
directory. They are **not** part of the repository — the paths are left in
place as provenance for the measurements, not as shipped files.

### Headless probes

Every CDP script takes its Chrome profile from `scripts/probe-chrome.cjs`:

```js
const { mkProfile, EXTRA_FLAGS } = require('../scripts/probe-chrome.cjs');
const PROFILE = mkProfile('bf');   // %TEMP%\dsh-mar-probe\bf-<pid>
spawn(BROWSER, [ ...'--user-data-dir=' + PROFILE, ...EXTRA_FLAGS, url ]);
```

The profile lives in the OS temp dir, is removed when the process exits or is
interrupted, and stale ones are swept on the next `mkProfile()` call. **Never
point `--user-data-dir` at the repo**: a throwaway profile carries a full Chrome
user dir (12 MB `Default/Cache`, component caches, optimization-guide `.tflite`
models, Crowd Deny …), so a single run used to leave ~25 MB behind — 94 runs had
accumulated **2.3 GB** in `.generated/`. `EXTRA_FLAGS` keeps a run near 1 MB.

## Storefront

Storefront previews live in `assets/screenshots/` (webp + png), with the
relative-path list in `screenshots.json` (matching the dsh-market convention
used by `dsh-theme-endfield`):

```bash
npm run screenshots
```

Regenerates 4 frames (intro logo, marathon dots, marathon red, post-boot UI)
plus the manifest. Run after theme changes before publishing.

## License

MIT for plugin source. Maratype font licensing is the responsibility of the
distributor; see `docs/ASSET_POLICY.md`.

---

_Inspiration: Marathon (Bungie) · Ash Thorp · editorial Glitch · Swiss/Bauhaus grid._
_This is an unofficial, unaffiliated fan project._
