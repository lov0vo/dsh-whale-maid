# 变更记录

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
