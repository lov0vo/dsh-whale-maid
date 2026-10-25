# dsh-whale-maid

把 DeepSeek 插件市场页面右下角那只**鲸鱼女仆**完整提取出来，做成 DSH（DeepSeek Harness）的桌面宠物插件。

不是一张静态图片：10 组精灵图集 + JS 状态机，眨眼、欢呼、吃东西、玩耍、思考、入睡、醒来、左右漫步、拖动摇摆全部保留。

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

### 公开 API

渲染进程里可用 `window.dshWhaleMaid`：

```js
dshWhaleMaid.getOptions()                  // 当前配置
dshWhaleMaid.setOptions({ speed: 1.5 })    // 合并写入并广播
dshWhaleMaid.say('自定义台词')              // 让宠物说一句
dshWhaleMaid.resetPosition()               // 回到右下角
dshWhaleMaid.feeds()                       // 已投喂数量
dshWhaleMaid.forget()                      // 清空位置/投喂/已问候记录
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
│   └── sprites/*.png     10 组精灵图集（每帧 256×256，横向排列）
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

## 与网页原版的差异

| 差异 | 原因 |
| --- | --- |
| 精灵图 base64 内联进 `client.js` | 渲染进程是 sandbox，`nodeIntegration: false`，读不了磁盘；DSH 也不为插件提供静态资源路由 |
| 样式变量桥接到 `--dsw-alias-*` | 原站用站点自己的 CSS 变量；插件内改用 DSH 主题 token，并保留原值作兜底 |
| 所有选择器加 `.dwm-root` 前缀 | 宿主 shell 有 `button[attr]` 这类特异性 `0,1,1` 的规则，会压过单类选择器，导致菜单按钮变形 |
| 高光层用当前帧做 `mask-image` | 原站浅色页面下 `#ffffff42` 高光几乎不可见，深色主题下会变成一个浅色圆角方块 |
| 新增设置页分区 | 原站没有可调项；这里把尺寸/速度/语言暴露出来 |

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
- `client.js` 约 2.0 MB，其中 1.53 MB 是精灵图；这是「无静态资源路由」的必然代价。
- 系统开启「减少动态效果」时，帧动画与摇摆会自动停用，只保留静态姿态。

## 许可

代码：[MIT](LICENSE) · 角色美术：见上文[形象来源与授权](#形象来源与授权)
