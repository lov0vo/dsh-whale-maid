# dsh-whale-maid

把 DeepSeek 插件市场页面右下角那只**鲸鱼女仆**完整提取出来，做成 DSH（DeepSeek Harness）的桌面宠物插件。

不是一张静态图片：10 组精灵图集 + JS 状态机，眨眼、欢呼、吃东西、玩耍、思考、入睡、醒来、左右漫步、拖动摇摆全部保留。

从 1.1.0 起，她还会**跟着你的工作状态变姿势**、记心情与好感、每天签到、解锁成就、在你久坐或深夜时主动说一句——这些是在原版提取之上新增的陪伴层，原有动作与交互一个没改。

![预览：idle / joy / sleep / walk 四个姿态](assets/preview.png)

<p>
  <img alt="license: MIT (code only)" src="https://img.shields.io/badge/license-MIT%20(code%20only)-blue">
  <img alt="DSH client plugin" src="https://img.shields.io/badge/DSH-client%20plugin-6c7cff">
  <img alt="no runtime dependency" src="https://img.shields.io/badge/dependencies-none-success">
</p>

---

## 功能

- **十状态精灵动画**：`idle`（含随机眨眼）、`joy`、`eat`、`play`、`welcome`、`drag`（拖拽摇摆）、`think`（浮动 + 问号）、`sleep`（打呼噜）、`wake`、`walk`（乒乓漫步）
- **交互**：单击问候并展开菜单、按住拖动换位置、喂小鱼干（每 5 条触发里程碑台词）、陪它玩耍、爱心飘出
- **自动行为**：空闲 15–35 秒思考一次、25–45 秒随机漫步一次、60 秒无交互后入睡、点击唤醒
- **位置记忆**：拖动后的位置写进 `localStorage`，重开仍在原处
- **跟随主题**：气泡、菜单按钮用 DSH 主题 token（`--dsw-alias-*`），深色/浅色主题都自适应
- **设置面板**：`设置 → 鲸鱼女仆`，可调尺寸、动画速度、气泡停留时长、气泡语言，以及问候/漫步/睡眠开关
- **零运行时依赖**：不装任何 npm 包，不发任何网络请求，不读写文件系统

### 1.1.0 新增：陪伴层

- **工作状态联动**：观察宿主 DOM，判断「思考中 / 工具运行中 / 刚成功 / 刚失败」，自动切到 `think` 姿态并在宠物左侧冒出状态小标签（如「工具在跑…」「搞定啦」）。工作期会说话，收尾会欢呼或安慰；关掉对话视图后仍在跑的任务用宽限期兜住，不会一秒三变。
- **成长系统**：心情 / 饱食 / 好感 / 等级 / 陪伴时长 / 连续签到，全部只写本机 `localStorage`。心情随工作与互动涨落，饱食随时间下降。
- **每日任务**：三槽随机（散步、玩耍、摸头、投喂…），完成后在设置页领取奖励。
- **成就墙**：41 项成就（摸头 1/10/50、投喂、工具 1/10/50/200、代码、成功/失败、深夜、回归、陪伴天数、等级、签到、对话…），解锁即写成长日记。
- **分区点击**：点头顶 / 肚子 / 尾巴给不同反应与不同粒子；1.2 秒内三连击触发庆祝。
- **主动关怀**：久坐 25 分钟、卡住 8 分钟、深夜 23:00–5:59、饿肚子、离开后回来，各有专属台词；最小间隔 15 分钟，不啰嗦。
- **主动闲聊**：5–8 分钟一次，按话题（代码 / 报错 / 测试 / 部署 / 设计 / 文档 / 吃什么 / 困了…）挑不同的话。
- **关键词反应**：13 组关键词（谢谢、可爱、摸鱼、加油、好累、崩了、哈哈…）触发对应姿态、粒子与台词。
- **状态小标签与粒子层**：芯片式标签 + 爱心 / 星星 / 闪光 / 音符四类粒子，全部走独立图层，不抢气泡。

## 安装

DSH 桌面端的插件分两半：`index.js`（Host 半边，空实现，只为让 Loader 挂载包）和 `client.js`（浏览器半边，宠物本体）。安装即「让 profile 挂上这个 bundle」。

### 方式 A：用内置插件管理器（若你的 DSH 版本提供 `plugin_manager` 工具）

```
action: install_bundle
target: <本仓库的绝对路径>
```

### 方式 B：手工写进 profile（通用）

1. 把整个仓库目录放到 `C:\Users\Administrator\.dsh\plugins\dsh-whale-maid`（目录名要与 `package.json` 的 `name` 一致）。
2. 编辑 profile 的 `package.json`（`C:\Users\Administrator\.dsh\profiles\desktop\package.json`）：
   - `dependencies` 里加 `"dsh-whale-maid": "file:C:/Users/Administrator/.dsh/plugins/dsh-whale-maid"`
   - `dsh.profile.bundles` 数组里加 `"dsh-whale-maid"`
3. 让包出现在 profile 的 `node_modules` 里（复制目录，或在该 profile 下跑一次 `pnpm install`）。
4. 重载窗口（`Ctrl+R`）。profile 的 `dsh.profile.patchReload` 为 `live` 时，改 `client.js` 后刷新即生效，不用重启应用。

> **二选一**：`dsh.profile.bundles` 列表和 `cordis.patch.yml` 的 `insert` 是两条并行的挂载路径。同时用会让同一个 row id 被挂两次，出现两只宠物。手工安装时只选其中一种。

### 停用 / 卸载

- 停用：从 `dsh.profile.bundles` 移除 `dsh-whale-maid`（或在该 bundle 的 patch 行上加 `disabled: true`），重载窗口。
- 卸载：停用后删除 `plugins\dsh-whale-maid` 与 profile 的 `node_modules\dsh-whale-maid`，再清掉 `package.json` 里的依赖项。

## 使用

| 操作 | 效果 |
| --- | --- |
| 单击 | 随机说一句问候，展开「喂食 / 玩耍」菜单 |
| 按住拖动 | 跟着指针走，身体按指针相对位置倾斜（最多 ±10°），松手落位并记忆 |
| 喂食（🐟） | 冒爱心，播放吃东西动画；`feeds % 5 === 0` 时触发里程碑台词 |
| 玩耍（🎮） | 冒爱心，播放抛接球动画 |
| 点空白 / `Esc` | 关闭菜单 |
| 长时间不操作 | 60 秒后趴下睡觉；点击会先播「醒来」再「欢呼」 |
| 点头顶 / 肚子 / 尾巴 | 分区反应：不同台词 + 不同粒子（心 / 闪光 / 音符） |
| 1.2 秒内连点三次 | 三连击庆祝（星星 + 爱心 + 专属台词） |

宠物会自己走动，所以位置不总是右下角——这是原始行为。

## 配置

设置页：`设置（Ctrl+,）→ 左侧「鲸鱼女仆」`。改动即时生效，存在 `localStorage['dsh-whale-maid:options']`。

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `size` | `number \| null` | `null` | 像素尺寸 24–320；`null` = 响应式（桌面 110px，窄屏 72px） |
| `speed` | `number` | `1` | 动画与漫步速度倍率 0.2–3 |
| `bubbleDuration` | `number` | `4500` | 气泡停留毫秒数 1000–10000 |
| `language` | `'auto' \| 'zh' \| 'en'` | `'auto'` | 气泡文案语言，`auto` 跟随界面 |
| `greeting` | `boolean` | `true` | 首次打开是否主动打招呼 |
| `walk` | `boolean` | `true` | 是否允许随机漫步 |
| `sleep` | `boolean` | `true` | 是否允许空闲入睡 |
| `greetings` | `string[] \| null` | `null` | 自定义问候语池，`null` 用内置文案 |

### 陪伴开关（1.1.0）

设置页：`设置（Ctrl+,）→ 左侧「鲸鱼女仆 · 成长」`。存在 `localStorage['dsh-whale-maid:companion']`。

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `workLink` | `boolean` | `true` | 是否跟随工作状态换姿态（关掉后她只做原版的 idle 生活） |
| `workHold` | `number` | `6000` | 切走对话视图后的宽限毫秒数，避免后台任务被误判结束 |
| `workSpeech` | `'chatty' \| 'quiet' \| 'off'` | `'chatty'` | 工作期说话频率：话痨 15–40s / 安静 90–240s / 不说 |
| `idleChat` | `boolean` | `true` | 是否 5–8 分钟主动闲聊一次 |
| `care` | `boolean` | `true` | 主动关怀（久坐 / 卡住 / 深夜 / 饿了 / 回来） |
| `chip` | `boolean` | `true` | 是否显示宠物左侧的状态小标签 |
| `zones` | `boolean` | `true` | 是否启用分区点击反应 |
| `achievements` | `boolean` | `true` | 是否记录成就与成长日记 |
| `lateNight` | `boolean` | `true` | 深夜（23:00–5:59）是否安静一点 |

> 这些开关只影响**陪伴层**。关掉全部开关后，宠物的行为与 1.0.0 完全一致。

### 公开 API

渲染进程里可用 `window.dshWhaleMaid`：

```js
dshWhaleMaid.getOptions()                  // 当前配置
dshWhaleMaid.setOptions({ speed: 1.5 })    // 合并写入并广播
dshWhaleMaid.say('自定义台词')              // 让宠物说一句
dshWhaleMaid.resetPosition()               // 回到右下角
dshWhaleMaid.feeds()                       // 已投喂数量
dshWhaleMaid.forget()                      // 清空全部存储（位置/投喂/配置/成长/陪伴开关）
```

1.1.0 追加（原有方法签名一个未改）：

```js
dshWhaleMaid.companion()                   // 陪伴开关快照
dshWhaleMaid.setCompanion({ chip: false }) // 改开关
dshWhaleMaid.growth()                      // 等级/心情/饱食/好感/任务/成就/日记快照
dshWhaleMaid.signin()                      // 今日签到（已签返回 null）
dshWhaleMaid.claimQuest(0)                 // 领取第 1 个已完成任务
dshWhaleMaid.resetGrowth()                 // 清空成长数据
dshWhaleMaid.work()                        // 工作状态探测器当前判断
dshWhaleMaid.scanNow()                     // 立刻重扫一次 DOM（排查用）
dshWhaleMaid.diagnose()                    // 上面全部 + 当前姿态/帧，一次性 dump
dshWhaleMaid.zoneAt(0.85, 0.7)             // 归一化坐标落在哪个区（'tail'）
dshWhaleMaid.probe('今天写了好多代码')      // 这句话会被判成什么话题 / 命中哪个关键词
dshWhaleMaid.chip('工具在跑…', 'work', 3000)// 手动弹一个状态小标签
dshWhaleMaid.fx('star', 6)                 // 手动撒粒子：heart / star / sparkle / note
dshWhaleMaid.pose('joy', 1500)             // 强制某个姿态（hold=true 则一直保持）
```

## 动作表

| 状态 | 精灵图 | 帧数 | fps | 播放方式 | 触发 |
| --- | --- | --- | --- | --- | --- |
| `idle` | `idle.png` | 3 | 2 | `blink`（随机眨眼） | 默认待机 |
| `joy` | `joy.png` | 2 | 5 | loop | 点击、动作收尾 |
| `eat` | `eat.png` | 3 | 8 | loop | 喂食 |
| `play` | `play.png` | 3 | 4 | loop | 玩耍 |
| `welcome` | `welcome.png` | 2 | 3 | loop | 首次问候 |
| `drag` | `drag.png` | 1 | 5 | loop + tilt | 拖动中 |
| `think` | `think.png` | 1 | 2 | loop + float | 空闲思考 |
| `sleep` | `sleep.png` | 2 | 1 | loop | 空闲 60s |
| `wake` | `wake.png` | 2 | 3 | once | 睡眠中被点击 |
| `walk` | `walk.png` | 3 | 6 | ping-pong | 随机漫步 |

## 目录结构

```
dsh-whale-maid/
├── index.js              Host 半边：空 apply，只为让 Loader 挂载并暴露 dsh.client
├── client.js             浏览器产物（约 2.0 MB，由 build.mjs 生成，勿手改）
├── cordis.patch.yml      手工安装用的 insert 行
├── package.json          清单：exports / files / dsh.bundle / dsh.client
├── build.mjs             构建脚本：校验 PNG 尺寸 → base64 内联 → 拼 client.js
├── src/
│   ├── pet.js            宠物组件：ANIM 表、切帧、遮罩高光、拖拽、漫步、投喂、玩耍、气泡
│   ├── pet.css           原站样式 + 主题变量桥接（全部规则作用域在 .dwm-root 下）
│   ├── settings.js       设置页「鲸鱼女仆」分区
│   ├── plugin.js         apply(ctx)：注入样式、注册 slot、挂公开 API
│   ├── runtime.js        共享运行时状态、存储键、事件名、随机与时间工具
│   ├── lines.js          台词库（中/英各约 260 句）、关键词表、话题分类
│   ├── growth.js         成长：心情/饱食/好感/等级/签到/每日任务/41 项成就/日记
│   ├── signals.js        工作状态探测器：读宿主 DOM → 姿态 + 状态标签 + 工作期台词
│   ├── care.js           主动关怀与闲聊心跳
│   ├── zones.js          分区点击与三连击
│   ├── fx.js             状态小标签与粒子层（两个独立组件）
│   ├── panel.js          设置页「鲸鱼女仆 · 成长」分区
│   └── sprites/*.png     10 组精灵图集（每帧 256×256，横向排列）
├── test/companion.test.mjs   node:test 单测：18 例，真实 client.js + stub DOM
├── locale/{en,zh}.json   插件名/描述的本地化
├── icon.svg              插件图标
├── assets/preview.png    README 预览图（由精灵图合成，非界面截图）
├── CHANGELOG.md
├── LICENSE               MIT（仅代码）
└── README.md
```

### 重新构建

```bash
node build.mjs
```

产物写入 `client.js`。构建时会校验每张精灵图的像素尺寸是否等于 `帧数 × 256`，尺寸不符直接失败——防止放错图导致画面错位。

`build.mjs` 按固定顺序把 `src/` 下的十个脚本拼进同一个闭包（`runtime → lines → growth → fx → pet → settings → panel → signals → care → zones → plugin`），所以它们之间可以直接互相调用函数声明，但**不能写 `import` / `export`**（构建会直接报错）。

### 测试

```bash
node --test test/companion.test.mjs
```

测试不是 mock 组件，而是把真实的 `client.js` 载进一个 stub DOM（`window` / `document` / `localStorage` / `MutationObserver` / `requestAnimationFrame` + React stub），跑真实的 `apply(ctx)`，再通过公开 API 驱动。覆盖：三个 slot 注册、样式注入与清理、1.0.0 API 默认值不变、陪伴开关持久化、成长快照形状、签到幂等、任务领取门禁、工作状态机（含宽限期与错误基线）、`forget` 清键、所有 effect 的 disposer 不抛。

## 与 dsh-whale-musume 的关系

1.1.0 的陪伴层是参考 [Sutera-Diffusus/dsh-whale-musume](https://github.com/Sutera-Diffusus/dsh-whale-musume) 的**功能行为**做的，仅此而已：

| 项目 | 情况 |
| --- | --- |
| 参考了什么 | 功能清单与交互范式：忙闲联动、心情/好感/饱食、每日任务、签到、成就、分区点击、主动关怀、话题闲聊 |
| 没参考什么 | 它的代码、立绘、台词、数值表。台词全部为本仓库原创撰写，立绘仍是原站那 10 组精灵图 |
| 没有照搬的能力 | 五种形态切换（悬浮/侧栏/底栏/迷你）、拖拽惯性物理、TTS 播报、天气陪伴、三个小游戏、跨端存档迁移——见下方「未纳入的功能」 |
| 素材授权 | 参考插件是 MIT，但其立绘不适用；本仓库不引入它的任何素材，故不受其影响 |

### 未纳入的功能（及原因）

| 功能 | 为什么不加 |
| --- | --- |
| 五种形态切换（悬浮/侧栏/底栏/迷你/自动） | 要改 `shell.overlay` 的定位模型与现有拖拽落位逻辑，属于**改既有行为**，超出「只增不改」的边界 |
| 拖拽惯性物理、边缘抓住 | 同上，会重写现有 pointer 三件套 |
| TTS 播报 | 依赖第三方 `dsh-xiaomi-tts` 插件，装了才有声音；无依赖原则下不做 |
| 天气陪伴（Open-Meteo） | 需要联网请求，与「零网络」冲突 |
| 三个小游戏 | 需要新美术与计分 UI，工作量与素材风险都大 |
| 跨端存档迁移 | 与「只写本机 localStorage」的隐私口径冲突 |
| 唤回入口（关掉后留 🐋 按钮） | 需要新增浮层常驻按钮，属于新 UI 面，留待后续 |

## 与网页原版的差异

| 差异 | 原因 |
| --- | --- |
| 精灵图 base64 内联进 `client.js` | 渲染进程是 sandbox，`nodeIntegration: false`，读不了磁盘；DSH 也不为插件提供静态资源路由 |
| 样式变量桥接到 `--dsw-alias-*` | 原站用站点自己的 CSS 变量；插件内改用 DSH 主题 token，并保留原值作兜底 |
| 所有选择器加 `.dwm-root` 前缀 | 宿主 shell 有 `button[attr]` 这类特异性 `0,1,1` 的规则，会压过单类选择器，导致菜单按钮变形 |
| 高光层用当前帧做 `mask-image` | 原站浅色页面下 `#ffffff42` 高光几乎不可见，深色主题下会变成一个浅色圆角方块 |
| 新增设置页分区 | 原站没有可调项；这里把尺寸/速度/语言暴露出来 |
| 新增陪伴层（1.1.0） | 原站只有基础桌宠行为；陪伴层是新增，全部可关，关掉后与原版一致 |

## 形象来源与授权

> **角色美术不属于本仓库，也不在 MIT 许可范围内。**

- **角色**：DSH 1024Store whale girl（中文俗称「鲸鱼女仆」）
- **出处页面**：<https://deepseek1024.com/plugins/imsai-sh/awesome-deepseek-harness-plugins> —— 该页面右下角的桌宠
- **原始资源路径**：`/pet/whale-girl/{idle,joy,eat,play,welcome,drag,think,sleep,wake,walk}.png`，单帧 256×256，横向排列
- **权利归属**：角色形象与精灵图的著作权归原站点及其原作者所有。本仓库作者对上述素材**不主张任何权利**。
- **授权状态**：原始资源**未附带任何开源许可或使用条款声明**。因此本仓库不构成任何形式的授权，也不代表已获得权利人的许可。
- **使用限制**：
  - 仅限个人学习、研究与自用；
  - 请勿将 `src/sprites/*.png` 或 `assets/preview.png` 用于商业用途、二次分发、周边制作或再授权；
  - 转载、引用本项目时请保留本节来源说明。
- **移除承诺**：若权利人提出异议，请开 issue，我会立即删除 `src/sprites/` 下的全部素材。删除后插件代码仍可运行，只需换成你自己的同名精灵图。

### 代码许可

`index.js`、`build.mjs`、`src/*.js`、`src/pet.css`、`client.js` 等**代码**部分以 MIT 发布，见 [LICENSE](LICENSE)。MIT 仅覆盖代码，不覆盖 `src/sprites/` 与 `assets/preview.png` 中的角色美术。

### 换成你自己的角色

1. 准备 10 张横向精灵图，单帧 256×256，文件名与 `src/sprites/` 现有文件一致；
2. 帧数不同的话，同步修改 `build.mjs` 的 `SHEETS` 表与 `src/pet.js` 的 `ANIM` 表（`frames` 字段）；
3. 运行 `node build.mjs` 重新生成 `client.js`。

## 已知限制

- 宠物渲染在 `shell.overlay` 层（`z-index: 20`，自成层叠上下文），**DSH 的弹窗与吐司会盖住它**，这是宿主层级决定的。
- 拖到屏幕边缘时会被夹回视口内（留 12px 边距），窗口缩小时也会被夹取。
- `client.js` 约 2.1 MB，其中 1.53 MB 是精灵图；这是「无静态资源路由」的必然代价。
- 系统开启「减少动态效果」时，帧动画与摇摆会自动停用，只保留静态姿态。
- **工作状态联动依赖宿主 DOM 契约**（1.1.0）。探测器读的是 `[data-chat-running]`、`[data-tool][data-state]`、`[data-variant="think"]` 这些属性；宿主改版后可能失效。失效时的表现是「她不再跟着工作换姿态」，其余功能不受影响——用 `dshWhaleMaid.scanNow()` 一看就知道是不是探测不到。探测器只读 DOM，不发请求、不碰 host 总线。
- 探测间隔 1.5 秒（`MutationObserver` 去抖），所以姿态切换有最多 1.5 秒延迟，这是刻意的：轮询太密会让长会话掉帧。
- 成长数据只存在本机 `localStorage`，换机器/清缓存就没了，也没有云端同步。
- 台词是按话题随机挑的，不读对话内容原文——只做关键词与话题的粗分类，不做语义理解。

## 许可

代码：[MIT](LICENSE) · 角色美术：见上文[形象来源与授权](#形象来源与授权)
