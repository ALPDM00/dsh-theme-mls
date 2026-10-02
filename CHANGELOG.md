# Changelog

所有显著改动都列在这。版本号遵循 [SemVer](https://semver.org/)：
主版本号 = 不兼容的 API/视觉变更；
次版本号 = 向后兼容的新功能；
修订号 = 向后兼容的 bug 修复。

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
