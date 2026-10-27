# 美术管线（`tools/art`）

把「绿幕生图」变成 `src/sprites/` 里那 256×256 的一格一格：**生图 → 抠图 → 拼表 → 修帧序 → 质检**。

这套脚本原来散在仓库外的 `_tmp/whale-gen/` 里，只有作者本机有，clone 下来的人没法复现 `src/sprites/` 里的帧。现在它们在这里，路径自己推导，不再写死 `E:\ovo\DSH\...`。

## 前置

- **Python 3.10+ 与 Pillow**，这是唯一依赖，没有第二个包
- **仓库根**：默认从 `__file__` 往上两级推（`tools/art/x.py` → 仓库根），也可以 `--repo PATH` 指定
- 只有 `gen.py` 需要联网和密钥，其余脚本全部离线

Windows 上 `python` 不一定在 PATH 里，可以直接用解释器绝对路径：

```bash
C:/Users/<you>/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe tools/art/qc_look.py
```

下面所有例子都简写成 `python tools/art/xxx.py`。

## 脚本一览

| 脚本 | 作用 | 写盘 | 联网 |
| --- | --- | --- | --- |
| `gen.py` | 按 job 文件提交生图任务、轮询、落盘、抠图、拼表 | 是（`src/sprites/**` + `.work/`） | **是** |
| `key_pose.py` | 绿幕抠图 + 归一化成 256×256 单帧 | 是 | 否 |
| `compose_frames.py` | 把若干 256×256 单帧拼成 `帧数×256 × 256` | 是 | 否 |
| `fix_anim.py` | 同表内身高拉平、按循环 IoU 重排帧序、重写 `DWM_HIT_REG` | 是（**含 `src/zones.js`**） | 否 |
| `qc_look.py` | 配色 / 耳朵 / 发冠 / 袜子筛查，阈值由 8 张原始表标定 | 否 | 否 |
| `verify_frames.py` | 剪影 IoU：三帧到底是不是三张画 | 否 | 否 |
| `audit_assets.py` | 尺寸、贴底、帧高、残留绿幕、代码引用交叉检查 | 否 | 否 |
| `conform_sheets.py` | 只修表内的离群帧（矮 12px 以上、离底 4px 以上） | 是 | 否 |
| `contact_sheet.py` | 若干张表拼成一张对照图，人眼过一遍 | 是（只写你指定的那张） | 否 |

每个脚本都支持 `--help`，会打印自己的说明。

## 管线顺序

顺序是有意义的，后一步量的是前一步改过的图：

1. **生图** —— `gen.py` 拿 `idle.png` 第 0 帧（铺在纯绿上）当身份参考，逐帧提交，轮询异步任务，原图落在 `tools/art/.work/raw/`（`.work/` 已 gitignore）
2. **抠图 + 归一化** —— `key_pose.py` 把绿幕键掉，按下面的契约缩进 256×256
3. **拼表** —— `compose_frames.py` 把若干单帧横向拼成一张表；没重新生成的帧原样保留
4. **修帧序** —— `fix_anim.py` 拉平同表身高、按循环 IoU 选帧序、重写 `src/zones.js` 里的 `DWM_HIT_REG`
5. **质检** —— `qc_look.py` + `verify_frames.py` + `audit_assets.py`，三张网都过才算收工

`gen.py` 已经把这 1–3 步串成一条命令，第 4、5 步单独跑。

## 归一化契约

`key_pose.py` 的输出就是全仓库默认的那套几何，`zones.js` 的点击配准表、`qc_look.py` 的绝对矩形、`build.mjs` 的尺寸校验全都建立在这上面：

| 项 | 值 |
| --- | --- |
| 画布 | 256×256 RGBA，剪影外全透明 |
| 角色高度 | 225 px |
| 脚底 | 贴底，墨迹 `bottom == 256` |
| 水平 | 墨迹中心在 `x = 128`，宽度上限 246 px |
| 绿幕 | 按 `g - max(r, b)` 判绿，8 以下全不透明、72 以上全透明，中间线性过渡；判绿的像素把 G 压到 `max(r, b)` 去溢色 |
| 表 | 768×256，三格横排，格子之间不透明重叠 |

`key_pose.py --band top,bottom` 可以把量身高的范围限制在一条横带里。头顶有漂浮物（星光、省略号、怒气符号）时用它，否则那些装饰会被算进身高，人就被压矮了。

## 质量闸门

改完图先跑这三条，全部通过再提交：

```bash
python tools/art/qc_look.py            # 配色与袜子
python tools/art/verify_frames.py src/sprites src/sprites/poses
python tools/art/audit_assets.py
```

判据：

- **绿幕必须干净** —— `key_pose.py` 每帧都会打印 `green_left`，必须为 `0`；`audit_assets.py` 也会逐帧复查残留绿像素。有绿边说明背景不够平，重生成，不要靠调阈值硬压。
- **袜子必须是浅色** —— 这是最容易跑偏的一处：模型很爱把过膝袜画成深藏青。`qc_look.py` 里有一条不依赖阈值的硬规则：腿带（`LEGS`）里深藏青占比 > 0.55 且浅色占比 < 0.15 就判 `navy stockings`，直接重生成。
- **三帧必须真的不一样** —— `verify_frames.py` 看剪影 IoU：伪帧（缩放/旋转出来的）通常在 0.95 以上，真重绘在 0.5–0.95。低于 5% 的形变会被标 `SUSPECT pseudo`。
- **同表身高一致** —— `fix_anim.py` 只缩小不放大，把最高的那帧压到同表最矮的那帧；差值 ≤ 2px 视为手绘抖动，原样保留。
- **贴底 + 居中** —— `audit_assets.py` 要求每帧 `bottom == 256`、帧高与表内中位数相差不超过 12px。
- **别画串** —— 生成后自己看一眼 `contact_sheet.py` 拼出来的对照图，确认还是同一个角色、同一套衣服。

`qc_look.py` 的容差不是拍的：它先拿 8 张**从未重新生成过**的原始表（`idle` / `joy` / `eat` / `play` / `welcome` / `sleep` / `wake` / `walk`）算出「姿势导致的正常波动」包络，再放宽 15%，只有跳出包络才报错。换了参考帧或换了角色，这 8 张和 `ORIGINAL` 常量要一起换，否则包络是别人的。

## 生图：job 文件

`gen.py` 只认数据，不认代码里的姿态表——加一张表就是改 JSON：

```json
{
  "reference": "src/sprites/idle.png",
  "reference_frame": 0,
  "jobs": [
    { "sheet": "poses/waiting", "frame": 1, "pose": "她重心挪到一条腿上，双手仍背在身后，头再抬高一点，尾巴向右上翘" },
    { "sheet": "poses/waiting", "frame": 2, "pose": "……", "band": [0, 1024] }
  ]
}
```

- `sheet` 是相对 `src/sprites/` 的路径（不带 `.png`），`frame` 从 0 开始
- **没列出来的帧保持磁盘上的原样**，所以「三帧表只重画后两帧」就写两条 job
- `pose` 只写姿势；身份锁（发型、女仆帽、鲸鳍耳、袜子颜色、绿幕要求）由 `gen.py` 的 `MASTER` 常量拼在前面，不要重复写
- `band` 可选，透传给 `key_pose.normalise()`
- `reference` / `reference_frame` 可选，默认 `src/sprites/idle.png` 第 0 帧

先看计划，不联网、不写盘：

```bash
python tools/art/gen.py tools/art/jobs.example.json --dry-run
```

确认无误再真跑：

```bash
python tools/art/gen.py tools/art/jobs.example.json
```

密钥与端点：

- 密钥从凭据文件的 `DSH_IMAGE_GEN_OPENAI_COMPAT_KEY` 行读，路径用 `--credentials` 或环境变量 `DSH_CREDENTIALS` 指定（默认 `~/.dsh/.credentials.yaml`）；同名环境变量存在时直接用
- 端点 `--base-url`、模型 `--model` 分别默认取 `$DSH_IMAGE_GEN_BASE_URL` / `$DSH_IMAGE_GEN_MODEL`，两个环境变量都没设时用脚本内置的默认值
- 提交走 `POST /images/edits`，返回 `data[].url` 就是同步完成，返回 `id` 就是异步任务，每 6 秒轮询一次 `/images/jobs/<id>`，默认 30 分钟超时

一次生成一张，`--only poses/waiting` 可以只跑表里的某一张。

## 常用命令

```bash
# 单张图：抠图 + 归一化（生图模型给的 1024×1024 绿幕图）
python tools/art/key_pose.py raw.png src/sprites/poses/waiting.png

# 两帧新图 + 原第 0 帧 → 三帧表
python tools/art/compose_frames.py src/sprites/poses/waiting.png f1.png f2.png /tmp/waiting.png

# 修帧序并重写点击配准表（先 dry-run 看 diff）
python tools/art/fix_anim.py --dry-run
python tools/art/fix_anim.py

# 只修某张表里的离群帧
python tools/art/conform_sheets.py src/sprites/poses --dry-run

# 拼一张对照图，人眼过一遍
python tools/art/contact_sheet.py /tmp/contact.png src/sprites/poses/waiting.png src/sprites/idle.png
```

`fix_anim.py` 会**直接改写** `src/sprites/*.png` 和 `src/zones.js` 的 `DWM_HIT_REG` 块（`BEGIN`/`END` 之间，不要手改）。跑完记得看 `git diff`，尤其确认 `zones.js` 只动了那个块。

## 授权：这些工具不是给你用现成美术的

**角色美术不在 MIT 许可范围内**，详见根目录 `NOTICE` 与 README 的「形象来源与授权」一节：`src/sprites/*.png` 与 `assets/preview.png` 的著作权归原站点及原作者，本仓库不构成任何授权。

所以这套脚本存在的意义是：**让你渲染自己的角色**。改 `gen.py` 的 `MASTER` 身份锁、换掉参考帧，或者干脆不用 `gen.py`、自己画好 256×256 的帧再跑 `compose_frames.py` 和 `fix_anim.py`。脚本是 MIT，产出的图不是。

## 已知限制

- `getdata()` 在 Pillow 14 会被移除（现在会打 `DeprecationWarning`），到时把几处 `getdata()` 换成 `get_flattened_data()` 即可，算法不用动
- 全部是纯 Python 逐像素循环，一张表几秒，不算快，但只跑一次
- `qc_look.py` 的矩形是按 256×256 格子写死的比例（`LEGS` / `EAR_L` / `EAR_R` / `HORN`），角色比例变了要一起改
- 脚本不会替你 `git add`：改完图、跑完 `node build.mjs`，自己看 diff 再提交
