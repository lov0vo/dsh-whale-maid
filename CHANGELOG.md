# 变更记录

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 1.1.0 — 2026-10-25

新增陪伴层。**纯增量**：包名、cordis row id、`dsh-whale-maid:*` 存储键与事件名、`window.dshWhaleMaid` 既有方法、`.dwm-*` 类前缀、`dwm-*` 关键帧、`--dwm-*` 变量、十状态 `ANIM` 表与四种播放模式语义全部未改；关掉全部新开关后行为与 1.0.0 一致。

### 新增

- **工作状态联动**（`src/signals.js`）：观察宿主 DOM（`[data-chat-running]` / `[data-tool][data-state]` / `[data-variant="think"]`），判定 `thinking → tool → success/failure`，自动切 `think` 姿态、在宠物左侧冒状态小标签、工作期按话痨/安静两档说话、收尾欢呼或安慰；用 `workHold` 宽限期兜住「切到设置页导致信号消失」；用计数基线区分「新错误」与「历史错误卡残留」。
- **成长系统**（`src/growth.js`）：心情 / 饱食 / 好感 / 等级 / 陪伴时长 / 连续签到 / 每日任务 3 槽 / 41 项成就 / 成长日记，全部只写本机 `localStorage['dsh-whale-maid:growth']`。
- **台词与话题**（`src/lines.js`）：中英各约 260 句原创台词（问候、闲聊、工作态、关怀、分区点击、情绪分层），13 组关键词反应，13 类话题分类。
- **主动关怀**（`src/care.js`）：久坐 25 分钟、卡住 8 分钟、深夜 23:00–5:59、饿了、离开后回来，最小间隔 15 分钟；另有 5–8 分钟一次主动闲聊。
- **分区点击**（`src/zones.js`）：头顶 / 肚子 / 尾巴三个归一化命中区，各自台词与粒子；1.2 秒内三连击触发庆祝。不 `preventDefault`、不 `stopPropagation`，原有点击/拖动/菜单逻辑一行未动。
- **状态小标签与粒子层**（`src/fx.js`）：`.dwm-chip` 与 `.dwm-fx` 两个独立图层，四类粒子（heart / star / sparkle / note）。
- **设置页「鲸鱼女仆 · 成长」分区**（`src/panel.js`，`order: 61`）：等级与羁绊称号、三条进度条、每日任务领取、本周签到、成就墙、成长日记、九个陪伴开关、四个试玩按钮。原「鲸鱼女仆」分区完全未改。
- **公开 API 追加**（均为新增键，旧键签名不变）：`companion` / `setCompanion` / `growth` / `signin` / `claimQuest` / `resetGrowth` / `work` / `scanNow` / `diagnose` / `zoneAt` / `probe` / `chip` / `fx` / `pose`；`forget()` 现在也会清 `:growth` 与 `:companion`。
- **测试**：`test/companion.test.mjs`，18 个 `node:test` 用例，把真实 `client.js` 载进 stub DOM 跑真实 `apply(ctx)`。`npm test` 即 `node --test test/companion.test.mjs`。

### 变更

- `client.js` 体积 2 090 695 B → 2 189 669 B（新增陪伴层代码，精灵图未变）。
- `package.json` 版本 1.0.0 → 1.1.0，新增 `scripts.test`。

### 未纳入

参考实现里的五种形态切换、拖拽惯性物理、TTS 播报、天气陪伴、三个小游戏、跨端存档迁移、唤回入口按钮——原因见 README「未纳入的功能」：前两项需要改既有行为，其余与「零依赖 / 零网络 / 只写本机」的口径冲突。

## 1.0.0 — 2026-10-25

首个发布版本。

- 从 DeepSeek 插件市场页面提取鲸鱼女仆桌宠，1:1 移植十状态精灵动画状态机：
  `idle`（随机眨眼）、`joy`、`eat`、`play`、`welcome`、`drag`（摇摆）、`think`（浮动）、
  `sleep`、`wake`、`walk`（乒乓漫步）
- 交互：单击问候并展开菜单、拖动换位（6px 判定阈值）、喂食、玩耍、爱心飘出、`Esc`/点空白关闭菜单
- 自动行为：空闲思考、随机漫步、60 秒无交互入睡、点击唤醒
- 位置、投喂数、已问候标记持久化到 `localStorage`
- 设置页「鲸鱼女仆」分区：尺寸、动画速度、气泡停留时长、气泡语言、问候/漫步/睡眠开关
- 公开 API：`window.dshWhaleMaid`（`getOptions` / `setOptions` / `say` / `resetPosition` / `feeds` / `forget`）
- 样式变量桥接到 DSH 主题 token（`--dsw-alias-*`），深色/浅色主题自适应
- 高光层改用当前精灵帧做 `mask-image`，修复深色主题下角色背后出现浅色圆角方块的问题
- 所有选择器作用域提升到 `.dwm-root`，避免被宿主 `button[attr]` 规则覆盖
- 精灵图 base64 内联进 `client.js`，无静态资源路由、无网络请求、无第三方依赖
- 支持 `prefers-reduced-motion`
