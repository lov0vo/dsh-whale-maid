## 1.9.0 — 2026-10-26

### 变更

- **资源改由 HTTP 路由提供**：精灵表与 19 张姿势立绘不再内联为 base64，改由 host 半边注册的 `/api/dsh-whale-maid/assets` 前缀路由提供（含路径穿越防护、MIME 表、`Cache-Control: max-age=3600`、弱 ETag + 304、仅 GET/HEAD）。`client.js` 从 **4.89 MB 降到 264 KB（−94.5%）**。
- **界面文案走翻译系统**：新增 `src/locale-table.js`（`dwmT` / `dwmFill` / `dwmLocaleLanguage`），`locale/zh.json` 与 `locale/en.json` 扩到 **81 个键**（19 个 `settings.*` + 60 个 `panel.*` + 2 个 `meta.*`）。原中英文作为回落参数保留，渲染结果逐节点一致。
- **气泡优先级**：`dwmSpeak(message, tone, priority)` 支持 `normal < state < important` 三级，高优先级未过期时不被低优先级打断。
- **工作状态判定更稳**：轮询由 1.5 s 放宽到 3 s，新增 `visibilitychange` 立即重扫；「运行标记消失但文档隐藏或设置页挂载」判为**保持**而非结束，`workHold` 仍是最终兜底。
- **场合→姿势映射**：新增 `src/pose-map.js`（36 条规则 + 15 条回落表），工作相位与关怀时刻改用对应立绘，无图时回落原动作态，既有转场不变。

### 新增

- `scripts/release.mjs`：一条命令完成 bump → build → test → 同步两处安装目录 → commit → tag。
- `assets/` 目录（构建产物，随包发布）。

### 修复

- 拖拽松手的甩出与压扁回弹此前只有算法没有接线（`.is-squash` 从未被添加、`.dwm` 变换缺 `--dwm-drag-angle`），现已接通。
- 设置页每 5 s 重读本地存储 → 改为 30 s 并在切回标签页时立即刷新。
- 松手回弹的定时器不再累积。
- 羁绊动作与称号取消等级门槛，默认全部可用，称号常显于面板首屏。
# 变更记录

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## 1.4.0 — 2026-10-26

工程与体感批次：把「四批计划」里所有不需要新美术的项做完，并加上存档导出/导入。

### 新增

- `engines.dsh: ">=0.2.1-rc.1"` 声明；`.github/workflows/ci.yml`（Node 20/22/24 构建 + 产物一致性 + 测试）。
- 无障碍：`Tab` 聚焦、`Enter`/`Space` 打招呼、`Alt+方向键` 16px 微调并持久化、`:focus-visible` 描边。
- 心情分层 2 → 5 档（`moodLow/Mid/LowMid/HighMid/High`），`moodTier()` 返回 0–4；新增 `src/lines-mood.js`（每语言 5 档 × 5 条）。
- 成就 41 → 55 条。
- 工作相位呼吸光晕 `.dwm-glow`（reduced-motion 下关闭）。
- 台词 546 → 600 条/语言。
- 唤回入口：`hidden` 开关 + 右下角 🐋 按钮。
- `locale/zh.json`、`locale/en.json` 改为 gettext 风格（43 条），设置面板文案可翻译。
- `src/portable.js`：`exportSave()` / `importSave()` / `clearSave()`，`schema = "dsh-whale-maid/save"`、`version = 1`，导入做 schema/version/键白名单校验。
- 测试：结构快照（`test/snapshots/pet-tree.txt`）、`dwm-` 类与 CSS 规则一致性检查、存档往返、心情档位、`hidden` 可逆、1.4.0 API 存在性。测试 28 → 34。

### 变更

- `scripts.test` 改用 `node --test --test-force-exit`（宠物自身持有定时器，进程不会自然退出）。
- `src/pet.css` 补上 `.dwm-panel-quest-text`、`.dwm-ach-name` 两条缺失规则。

### 暂缓（等美术 / 等口径）

- 19 张姿态立绘已生成并归一化到 `src/sprites/poses/`，**未接进状态机**——需要先定「场合 → 姿态」映射（待补充）。
- 五种形态切换、拖拽惯性物理、羁绊 Lv 解锁动作：等授权。
- 节日表、小游戏范围、TTS 播报细节、区县级天气精度：等口径。

## 1.3.0 — 2026-10-26

### 新增

- **天气陪伴**：Open-Meteo 免 key 接口，启动 / 每 30 分钟 / 跨天 / 窗口重新可见 / 手动按钮五种触发；缓存 + 6 小时过期降级；失败按 1→5→15 分钟指数退避重试（最多 3 次）。
- **天气 → 姿态 / 台词 / 粒子**：晴 `joy`、多云雾 `think`、雨雪雷 `sad`；7 个中文台词库共 63 条（含「雨夜」优先）；雨雪复用粒子层，晴天撒星屑；天气变化主动播报一次。
- **城市双路径**：系统定位（8 秒超时）失败后回退到设置里的城市名（默认北京），面板可随时改。
- 设置面板「鲸鱼女仆 · 成长」新增 **天气陪伴** 区块：城市 · 天气 · 温度 + 城市输入框 + 刷新按钮。
- 新配置项 `city`；新 API `weather()` / `refreshWeather()` / `setCity()`。
- 新增 `src/weather.js`、`src/lines-weather.js`，测试 22 → **28** 个。

### 变更

- `drag` / `think` / `work` / `sad` 由单帧改为 **3 帧伪帧**（缩放 1.00→1.02、上下 2px、旋转 ±1°，锚点脚底中心），十二个动作全部有逐帧动画；未新增任何美术。
- `client.js` 体积 2,401,140 → **3,161,926 B**（四张表各变三帧，精灵数据 1.66 → 2.22 MB）。

### 暂缓（等美术）

- 撑伞 / 缩脖子 / 发抖 / 流汗四种天气专属姿态；19 个新姿态立绘（已生成 `success`、`celebrate`，尚未接入）。

## 1.2.2 — 2026-10-26

修掉 1.2.1 里的致命回归：**点击宠物后整个桌宠消失**。

### 修复

- **点击即崩溃**（`ReferenceError: useState is not defined`）：1.2.1 新增的打字机气泡组件 `Bubble` 在模块作用域，但 React hook 别名 `var useState = React_.useState` 等声明在 `WhaleGirl()` 函数体内，作用域不可见 → 渲染气泡时抛错，`shell.overlay` 槽位整棵子树被卸载，桌宠消失（重载后复现）。现在 hook 别名提升到模块作用域。
- **气泡被挤成窄列**：`.dwm-pop` 是 110px 根节点里的 shrink-to-fit 绝对定位元素，长句会折成两行。现在按内容宽度布局，上限 250px（仍受视口宽度约束）。

### 测试

- 新增静态回归测试「hook aliases are hoisted above every component」：断言别名存在且声明位置在 `function Bubble` 之前。测试数 21 → 22。
## 1.2.1 — 2026-10-26

三个体验修复 + 一个气泡效果。**只增量**：包名、cordis row id、存储键、事件名、公开 API、`.dwm-*` 前缀、十状态精灵动画全部未改。

### 修复

- **走动被打断后会卡在走动帧里不再移动**：`stopWalk()` 此前只取消动画帧，姿态仍停在 `walk`，于是画面一直播走动帧、位置却不再变化。工作状态检测每 1.5 s 会主动中止散步（避免工作时乱走），正是最常见的触发路径。现在 `stopWalk()` 会把状态恢复成 `idle`。
- **点击时同时冒出两个气泡**：分区点击反应（头/肚子/尾巴）原来占用状态胶囊 `.dwm-chip`，和点击问候的对话气泡同时出现。现在分区反应改走对话气泡，且同一次点击里若分区已发声，就不再叠加随机问候——一次点击只说一句话。
- **原地踏帧的退化散步**：起点离边界过近时距离可能为 0，会闪一下走动帧。现在距离小于 8 px 直接放弃这次散步。

### 新增

- **气泡打字机效果**（`typewriter`，默认开启）：文字逐字显示并带闪烁光标；设置面板可关闭，`prefers-reduced-motion` 下自动整句显示。
## 1.2.0 — 2026-10-26

新增两张专属姿态，替掉 1.1.0 里的「借图」。**纯增量**：原有十张精灵表、十状态语义、四种播放模式、包名、cordis row id、`dsh-whale-maid:*` 存储键与事件名、`window.dshWhaleMaid` 既有方法、`.dwm-*` 前缀与 `--dwm-*` 变量全部未改。

### 新增

- **`work` 姿态**（`src/sprites/work.png`，1 帧，`loop + float`）：双手敲半透明浅蓝全息面板，头微低、眉心微蹙。工具 `preparing` / `running` 相位显示，不再借 `play`。
- **`sad` 姿态**（`src/sprites/sad.png`，1 帧，`loop`）：垂肩、双手身前交叠、上眼睑下垂、眉心内侧上挑、嘴角下撇、太阳穴一滴汗。工具报错 / 任务失败 / 心情触底显示，不再借 `drag`。
- **`dwmPlaySequence(steps)`**（`src/signals.js`）：姿态序列播放的统一入口，优先 `DWM_RUNTIME.api.runSequence`，宠物未挂载时回退 `dwmForceState` 并仍广播 `dsh-whale-maid:state`。

### 变更

- `src/signals.js`：`dwmWorkPose` 映射改为 `tool → work`、`failure → sad`；会话结束分支由 `[['drag', 2000]]` 改为 `[['sad', 2000]]`，成功分支改走 `dwmPlaySequence([['joy', 1500]])`。
- `src/pet.js`：`ANIM` 增 `work` / `sad` 两项（十状态 → 十二状态，索引与语义不变）。
- `build.mjs`：`SHEETS` 增 `work: 1`、`sad: 1`，构建时照旧校验每张表 `width === frames × 256`、`height === 256`。

### 体积

- `client.js` 由 2,189,669 B 增至 **2,361,079 B**（两张新图共 128,050 B，base64 内联后 +171,410 B）。

### 测试

- `test/companion.test.mjs` 增 2 个用例：运行中的工具切 `work`、新错误切 `sad`，并断言不再出现 `play` / `drag`。合计 **20 个用例全部通过**。

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
