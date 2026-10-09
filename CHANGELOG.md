# Changelog

所有显著改动都列在这。版本号遵循 [SemVer](https://semver.org/)：
主版本号 = 不兼容的 API/视觉变更；
次版本号 = 向后兼容的新功能；
修订号 = 向后兼容的 bug 修复。

## [0.2.0] - 2026-10-08

「主题设置」页的两项重做：点阵动画变成独立开关，两组配色成为互斥单选。

### 变更
- **背景动画** 从原来的三段式 `关闭动画 / 主白 + 绿 / 主黑 + 绿` 里拆出来，成为**独立开关**，
  **默认关闭**（新装 / 清空 `localStorage` 后不播放点阵场，用户自己开）。
- **主白 + 绿 / 主黑 + 绿** 变成单选组：恒有且只有一个被选中，和动画开关互不影响 ——
  关掉动画不会把配色弹回主黑 + 绿（这正是历史上「关闭后会切换为主黑+绿」那类报告的根因），
  换配色也不会顺带把动画打开。
- 状态模型由 `BG_STATE.mode (off|light|dark)` 拆成 `BG_STATE.anim`（布尔）+ `BG_STATE.scheme`
  （light|dark）；点阵色的读取改为 `BG_MODES[BG_STATE.scheme]`，字段底色统一取配色的 `field`
  （场关掉时不再有第二条分支）。
- 存储形状 `dsh-theme-marathon.bg.v1` 从 `{mode, scheme, cell, speed}` 变为
  `{anim, scheme, cell, speed}`；旧形状读取时按语义迁移：`mode: off` → `anim: false` 且保留
  它带的 `scheme`，`mode: light|dark|green` → `anim: true` + 对应配色。
- 点阵密度 / 呼吸速度在场关闭时变暗并 `disabled`（数值保留），它们的值只描述场。
- 换配色只在**真的换了**另一对时重放马赛克灌注；点同一对是无操作。
- 面板文案精简为：`主题设置` 标题 + 背景动画开关 + 配色单选 + 两个滑杆，
  与桌面版 `dsh-theme-mls-desktop` 的 `buildPane` 逐字节一致。

### 工程质量
- `check.cjs` 增加断言：默认关闭、旧状态迁移、配色是单选组、
  `data-bg=` / `aria-pressed` 旧三段式不得回来、灌注只在配色真变时触发。
- `test/plugin.test.cjs` 113 项：新增默认关闭、四种存储形状迁移、
  以及通过真实面板控件驱动的「开关不影响配色 / 配色不影响开关」交互回归。

## [0.1.0] - 2026-10-03

首次正式发布（GitHub 上传前的整理快照）。

### 主题
- 单一中性平面（`#0B0D0B` / `#272733` / `#2E2F38` / `#DFDEE0`）+ 单一酸绿强调色
  （`#C0FE04`），全站圆角归零，强调色只用在品牌锁定区与两种「点亮」态。
- 两组配色对在设置面板的**主题设置**页切换：主白 + 绿（白底、墨字、UI 整体翻白）
  与主黑 + 绿（黑底、绿字形、深色 UI 不动），互为精确镜像。
- 一次性启动序列：反转蓝 DeepSeek 像素标闪烁 → 蓝 `#4D6CFE` → 绿鲸鱼 + `INTO THE UNKNOWN`
  → 三区蓝色点阵迷宫 → `#FF003C` 红色横扫 → 红色点云贴合真实 DOM 矩形
  （侧边栏 `+` 网格、输入框小方块网格）→ 整体淡入并在 16s 看门狗前自拆。
- ASCII 点阵呼吸场背景层（`position:fixed`、`z-index:0`、`pointer-events:none`）：
  200×200 地板、模态与绝对/固定浮动层剪枝、`prefers-reduced-motion` 下单帧静止。
- 设置对话框 5×5 方块马赛克入场（0.5s）；任务板五张选项卡各 1.9s 的
  reticle + 2px 边框 + 2×2 象限 1-2-4-3 揭幕；配色切换经 View Transitions
  重放同一套马赛克（0.341s）。
- Host 半边（`index.js`）通过 `webserver/index-inject` 往 `index.html` 的 `<head>`
  注入一行 `<style>`，抹平插件加载前 DSH 原生启动画面的闪白；不改 `node_modules`、
  不改宿主文件，卸载即撤回。

### 工程质量
- `npm run build` → `npm run check`（静态断言）→ `npm test`（jsdom 加载器 +
  启动载荷结构测试）全过。
- `client.js` 由 `src/client.template.js` + `assets/` 构建产出；Maratype 字体与三张
  启动贴图在构建时 base64 内联，运行时零网络请求。
- `.gitignore` 屏蔽 9 个 `client.js.bak-*`、9 个 `src/client.template.js.bak-*`、
  `preview.html`、`.generated/` 等开发期遗留。
- `package.json` 加 `repository` / `bugs` / `homepage` 指向 `github.com/ALPDM00/dsh-theme-mls`。

### 命名
- 包名 / 插件 id / bundle row 由 `dsh-theme-marathon` 改为 `dsh-theme-mls`，
  与桌面版 `dsh-theme-mls-desktop` 成套。
- **内部命名空间刻意保持不变**：`body.theme-marathon`、`#dshMarBootHost`、
  `mar-*` / `mb-*`，以及 `dsh-theme-marathon.bg.v1` localStorage 键。
  桌面版同样保留这套命名空间，两边共用同一个设置存储 —— 来回切换不丢配色。

### 与桌面版的边界
- 本包是网页/浏览器版；桌面专版见
  [`dsh-theme-mls-desktop`](https://github.com/ALPDM00/dsh-theme-mls-desktop)。
- 视觉一致，差异在**启动那一刻**（网页版纯黑板启动；桌面版真透明 + 绿鲸鱼先行 +
  原生窗口按钮交接）。
- 不同时启用两者 —— 同时挂载会重复注入启动覆盖层。
