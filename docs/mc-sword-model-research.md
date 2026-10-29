# Minecraft 剑的物品建模与渲染 · 调研报告

> 调研问题：为 my-craft-demo「剑的建模做成和我的世界里一样」取证——Minecraft（Java 版为主）正典里**剑的物品模型到底是 3D 盒还是平面薄片**（parent 链与 JSON 原文）、**16×16 贴图的逐像素结构**（剑刃走向/护手/握柄/透明角）、**手持 display 变换**（剑与镐斧锹是否同族）、**四阶贴图是同形换色板还是各画各的**，以及基岩版是否同构。
> 来源性质：事实性论断来自 ① vanilla 资产镜像 [InventivetalentDev/minecraft-assets](https://github.com/InventivetalentDev/minecraft-assets)（**主引版本 1.20.4**，与 [mc-held-item-render-research.md](mc-held-item-render-research.md) 同源；**稳定性用 1.21.11 复核**，方法同 [mc-torch-model-research.md](mc-torch-model-research.md)）；② 贴图逐像素数据由本调研用 Node 临时脚本解码官方 PNG（标「资产解码」——zlib inflate + 手写 unfilter，支持 RGBA 与调色板两种容器；脚本与 PNG 均存会话临时目录 `Temp/opencode/mc-sword/`，不入仓库）；③ minecraft.wiki Model 页 wikitext（2026-10-29 `action=raw` 抓取）。由模型/贴图推算的结构解读标「推算」；无一手原文的点明确标「未能核实」，不凭记忆补写。
> 调研日期：2026-10-29。

## 0. 结论先行（TL;DR）

1. **原版剑不是 3D 盒模型，是「16×16 平面贴图挤出薄片」**：五份剑模型 JSON（wooden/stone/iron/diamond/golden/netherite 全查）逐份核实**全部只有 `parent: minecraft:item/handheld` + `layer0` 贴图两行，没有任何自定义 `elements`**；`handheld` 自身 `parent: item/generated`，而 `generated` 是 `builtin/generated`（官方原句 *"a model that is created out of the specified icon"*）——即按图标程序化生成的挤出薄片。与苹果/木棍的唯一差别只是 parent 换了 handheld 族（display 不同）。（§1）
2. **手持 display 真值（1.20.4 一手）**：第三人称右手 `rotation [0,-90,55] + translation [0,4.0,0.5] + scale 0.85`，第一人称右手 `[0,-90,25] + [1.13,3.2,1.13] + 0.68`。**剑与镐斧锹锄完全同族同值**——vanilla 没有任何剑专用 display；本仓库 `FP_HANDHELD` 两族常量已与正典一致，剑沿用即可。（§3）
3. **六张贴图逐像素解码（资产解码，全部成功）**：木/石/铁/钻/金/下界合金六张剑贴图**透明布局逐像素同形**（各 84 个不透明像素，脚本逐像素断言），**纯换色板**——四阶策略上「同形换色板」就是正典做法，本仓库 ITEM_PIX 的既有策略与 vanilla 完全一致。结构：**柄在左下角、尖在右上角的对角线剑**；3px 厚剑刃带、上缘一条通长亮线（铁/金为纯白 #ffffff，钻石为冰蓝 #a4fdf0）、下缘暗描边；护手是**垂直于剑刃的粗斜杆**（从 (2,6) 到 (9,13) 跨刃两侧）；护手与柄尾之间 **7px 木柄**（五阶共用同一组木色 hex）；左下角 **3×3 柄尾圆头**；左上/右下两个三角透明角。唯一例外：下界合金连**握柄也换成暗色调色板**（形状仍同形）。（§2）
4. **版本稳定性**：1.21.11 复核——`handheld.json` 与 1.20.4 **逐字节一致**（fc /b 无差异）；六张剑贴图**逐像素一致**（可见 RGB 差异 0、alpha 差异 0；部分文件仅 PNG 容器重编码：RGBA → 索引色）；`iron_sword.json` 在 1.21.11 仍是同构两行。「以 1.20.4 一手资产为准」与「1.21.11 复核一致」同时成立。（§1.4/§2.5）
5. **挤出厚度**：官方文档与 vanilla JSON 均无明文（wiki Model 页 raw 本轮全文检索无 extrude/thickness 字样）——维持姐妹调研原判：「由图标挤出成薄片」是官方口径，**「每像素挤出 1/16 格」是社区长期实践共识，标未确证**。（§1.5）
6. **基岩版同构（一句话）**：vanilla 基岩资源包没有任何剑的 attachable（姐妹调研逐文件 404 探测的消极证据），不写 attachable 时基岩手持默认也是「精灵贴图挤出网格」——与 Java 口径同构，本报告以 Java 一手资产为准。（§4）
7. **对本仓库的判决**：剑应从「纯色盒体拼装」改走**像素薄片管线**（bow_item/shears 已趟平的 `art` 部件 + `mkArtMats` + alphaTest 通路，零管线改动）；ITEM_PIX 的 `sword_wood/stone/iron/diamond` 四键已存在可直接复用，但现有 `SWORD_ART` 是「图标级简化画」（1–2px 细刃线、细横条护手、无柄尾圆头）——手持建议新画一张正典结构的剑字符画供四阶共用换色板；def 侧只动 `parts`（盒体组 → 单 art 薄片）与 `grip` 校准，`fp/swing` 不动。（§5）

---

## 1. 物品模型 JSON：parent 链与 display（一手原文）

### 1.1 五份剑 JSON：只有两行，无 elements（@1.20.4，已抓取）

`assets/minecraft/models/item/iron_sword.json`（全文）：

```json
{
  "parent": "minecraft:item/handheld",
  "textures": {
    "layer0": "minecraft:item/iron_sword"
  }
}
```

其余四份逐一抓取核实，**结构逐字节同构**，仅 id 字符串不同：

| 文件 | parent | layer0 | 自定义 elements |
| --- | --- | --- | --- |
| `item/wooden_sword.json` | `minecraft:item/handheld` | `minecraft:item/wooden_sword` | **无** |
| `item/stone_sword.json` | 同上 | `minecraft:item/stone_sword` | 无 |
| `item/iron_sword.json` | 同上 | `minecraft:item/iron_sword` | 无 |
| `item/diamond_sword.json` | 同上 | `minecraft:item/diamond_sword` | 无 |
| `item/golden_sword.json` | 同上 | `minecraft:item/golden_sword` | 无 |
| `item/netherite_sword.json` | 同上 | `minecraft:item/netherite_sword` | 无 |

**对照结论（推算，但由原文直接可得）**：钻石剑的 JSON 与苹果/面包的 JSON 结构完全同构（姐妹调研 Q2 已证苹果=parent `item/generated`），剑只是把 parent 换成工具族 `handheld`——**正典里剑的「模型」根本不是手工建模的几何体，而是一张贴图交给引擎按图标程序化生成薄片**。所谓「剑的 3D 模型」在 vanilla 资产里不存在。

### 1.2 handheld.json 全文与 display 真值（@1.20.4，已抓取）

`assets/minecraft/models/item/handheld.json`（全文）：

```json
{
    "parent": "item/generated",
    "display": {
        "thirdperson_righthand": {
            "rotation": [ 0, -90, 55 ],
            "translation": [ 0, 4.0, 0.5 ],
            "scale": [ 0.85, 0.85, 0.85 ]
        },
        "thirdperson_lefthand": {
            "rotation": [ 0, 90, -55 ],
            "translation": [ 0, 4.0, 0.5 ],
            "scale": [ 0.85, 0.85, 0.85 ]
        },
        "firstperson_righthand": {
            "rotation": [ 0, -90, 25 ],
            "translation": [ 1.13, 3.2, 1.13 ],
            "scale": [ 0.68, 0.68, 0.68 ]
        },
        "firstperson_lefthand": {
            "rotation": [ 0, 90, -25 ],
            "translation": [ 1.13, 3.2, 1.13 ],
            "scale": [ 0.68, 0.68, 0.68 ]
        }
    }
}
```

未列出的 display 位（ground/head/fixed/gui）与左手位回退规则继承自 `item/generated`（`gui_light: "front"`——薄片按平面打光），姐妹调研 Q2 已给全表，不重抄。

### 1.3 parent 链（推算，逐环一手）

```
item/iron_sword.json      = parent: item/handheld + layer0   （§1.1 原文）
item/handheld.json        = parent: item/generated + display （§1.2 原文）
item/generated.json       = parent: builtin/generated + gui_light: "front"（姐妹调研 Q2 + 本轮原文复核）
builtin/generated         = 引擎按图标生成的挤出模型（wiki Model 页原句 "a model that is
                            created out of the specified icon. Only the first layer is
                            supported"，本轮 raw 抓取复核）
```

### 1.4 版本稳定性复核（1.20.4 ↔ 1.21.11）

- `models/item/handheld.json`：两版本**逐字节一致**（`fc /b` 比对无差异，2026-10-29 实测）。
- `models/item/iron_sword.json`：1.21.11 仍是同构两行（`parent: minecraft:item/handheld` + layer0，已抓取）——即 1.21.4 起的 items model definition 组织重构（姐妹调研 S1 History 口径）之后，`models/item/` 下的重定向文件在 1.21.11 仍在且内容未变。
- 六张贴图：**逐像素一致**（§2.5）。

> 版本口径：**以 1.20.4 一手资产为准**（与姐妹调研同源）；关键文件已用 1.21.11 复核一致。display 数值自 1.9 起多年稳定的判断沿用姐妹调研口径，本轮 1.21.11 实测为其再添一证。

### 1.5 挤出厚度：官方无明文，维持「未确证」

- wiki Model 页 wikitext（本轮 `action=raw` 全文抓取）只载明 `builtin/generated` 的语义原句（§1.3），**全文无 extrude/thickness/每像素深度的任何数值**。
- vanilla 的挤出模型在加载期由客户端代码生成，资产 JSON 里没有可引用的几何字段（姐妹调研已论证，本轮无新证据）。
- 结论：**「由图标挤出成带厚度薄片」是官方口径（一手）；「每像素挤出 1/16 格（1 px = 1/16 block）」是资源包社区长期实践共识（Blockbench 的 item sprite 挤出导出即按此），官方文档无明文，标未确证**。本仓库薄片件厚 0.05（bow_item/shears 现行）在观感上即「1px 挤出」的合理折算，无需改。

---

## 2. 贴图逐像素结构（资产解码）

### 2.1 解码方法与可信度

- 对象：`textures/item/<tier>_sword.png` @ **1.20.4** 分支，六张全解码；复核集 1.21.11 六张（§2.5）。
- 脚本：Node 内建模块（`fs` + `zlib`）——解析 chunk（IHDR/PLTE/tRNS/IDAT）、inflate、按 PNG 规范 unfilter（None/Sub/Up/Average/Paeth），支持本批出现的两种容器：**colorType 6 RGBA（depth 8）**与 **colorType 3 索引色（depth 4/8 调色板 + tRNS 透明）**。iron 铁剑另做了 20× 最近邻放大人工目检，与解码网格互证一致。
- 诚实注：六张贴图容器格式不一（1.20.4 里 wooden/stone/netherite 是 depth-4 调色板、iron/diamond/golden 是 RGBA），解码脚本两种都支持并逐张出网格；「同形」断言由脚本对透明坐标集做逐像素比较得出，非目测。

### 2.2 iron_sword 16×16 像素网格（资产解码 @1.20.4）

坐标约定：x 向右、y 向下，(0,0) 在左上角（与 PNG 存储一致）；`.` = 透明。

```
y=0  .............###
y=1  ............mnno
y=2  ...........mnpno
y=3  ..........mnpno.
y=4  .........mnpro..
y=5  ........mnpro...
y=6  ..mm...mrpro....
y=7  ..msm.mrpro.....
y=8  ...mtortro......
y=9  ...mttsro.......
y=10 ....msmo........
y=11 ...bcommo.......
y=12 ..bde.oomo......
y=13 mmce....oo......
y=14 mso.............
y=15 ooo.............
```

图例（10 色，84 个不透明像素）：`m`=#444444(24) · `n`=#ffffff(8) · `o`=#181818(22) · `p`=#bebebe(6) · `r`=#d8d8d8(9) · `s`=#6b6b6b(4) · `t`=#969696(4) · **木柄**：`b`=#493615 · `c`=#684e1e · `d`=#896727 · `e`=#281e0b。

### 2.3 结构解读（推算，逐格由 §2.2 网格直接读出）

| 部件 | 像素位置 | 画法要点 |
| --- | --- | --- |
| **整体走向** | 柄在左下角、尖在右上角，长轴 = 反对角线 x+y≈15 | 与本仓库 `SWORD_ART` 同向 ✓ |
| **尖端暗帽** | (13,0)–(15,0) 3px，刃色最深档 | 尖端收在一角，占满 16×16 对角 |
| **剑刃** | 沿对角线的带状区（横向切每行 3–5px，垂直厚度 ≈3px） | 上缘一条**通长亮线**（iron = 纯白 #ffffff，8px 贯穿 y=1–9），亮线内侧 1–2px 中亮面（#d8d8d8/#bebebe），下缘 1px 暗描边（#181818，22px 通长）+ 外缘 #444444 |
| **护手** | 垂直于剑刃的粗斜杆：从 (2,6)（左上臂尖）跨过刃根到 (9,13)（右下臂尖），杆厚 2–3px、两臂均有台阶状收分 | **跨在刃两侧**，不是单侧贴片；总跨距 8px |
| **握柄（木）** | 7px：(3,11) (4,11) (2,12) (3,12) (4,12) (2,13) (3,13) | 沿对角线短棒；**木色四阶共用**（§2.4） |
| **柄尾圆头** | 左下角 3×3 角块去掉靠柄一侧 2 格 ≈ 8px：(0,13) (1,13) (0,14) (1,14) (2,14) (0,15) (1,15) (2,15) | 刃色最暗档，兜住木柄末端 |
| **透明角** | 左上三角（剑刃带左上侧）与右下三角（护手右下侧）两片连通透明区 | alphaTest 裁角后的观感即正典 |
| **比例** | 全对角 ≈ 22px 杆长：柄尾+木柄 ≈ 7px，护手 ≈ 2px 厚，**剑刃 ≈ 13px** | 刃:柄 ≈ 2:1，刃长柄短是「剑感」的来源 |

### 2.4 六阶对比：同形换色板（资产解码，脚本断言）

**透明布局逐像素同形**——六张贴图不透明坐标集完全一致（各 84px，脚本输出「与 wooden_sword 逐像素同形」六行全过）。色板按材质独立配色，同位色槽映射到相近明度的材质色；低色深贴图（depth-4 调色板 ≤16 色）会把相邻明度槽位并合，故各阶色数略异，但**结构位置一一对应**（如描边槽恒为 24px+22px 两条通长边）。

| 阶 | 刃/护手/柄尾体色 | 亮缘（通长高光线） | 暗描边 | 握柄 |
| --- | --- | --- | --- | --- |
| 木 wooden | #755821 主 · #866526 亮 · #594319 次 · #372910 深描 | #866526（无白） | #20180a / #372910 | **共用木柄 4 色** |
| 石 stone | #787777 · #5a5a5a · #95918d · #494949 | #b3b1af（浅灰） | #212121 / #494949 | 同上 |
| 铁 iron | #bebebe · #d8d8d8 · #969696 · #6b6b6b | **#ffffff 纯白 ×8px** | #181818 / #444444 | 同上 |
| 金 golden | #e9b115 · #dc9613 · #eaee57 · #fdff76 | **#ffffff 纯白 ×8px** | #3f2e0e / #825d16 | 同上 |
| 钻 diamond | #2bc7ac · #33ebcb · #1e8a77 · #156355 | **#a4fdf0 冰蓝 ×8px** | #082520 / #0e3f36 | 同上 |
| 下界合金 netherite | #706770 · #51444e · #5d565d · #4f3c3e · #322727 · #867b86 | #867b86 | #231012 / #4a2940 | **例外：暗柄** #2f2122 · #603432 · #734543 · #3b393b · #160814 |
| （五阶共用）木柄 | — | — | — | **#493615 / #684e1e / #896727 / #281e0b** |

要点提炼：

1. **四阶策略上「同形换色板」就是正典做法**——不存在「每阶独立重画」。本仓库 ITEM_PIX「工具 16 条 = 4 张字符画 × 四阶色板」的机制与 vanilla 同构。
2. 五阶连**木柄色值都逐字共用**（hex 完全相同），换的只是刃/护手/柄尾；netherite 是唯一连柄一起换色的（暗色柄 + 微红褐 #603432/#734543，配合下界材质观感）。
3. 铁/金有**纯白高光**，钻石高光是冰蓝 #a4fdf0，木/石没有白高光——「白刃线」是金属剑「帅感」的关键像素语言。
4. 正典 hex 与本仓库 `PIX_TIER` 色板不同值（如 repo 铁 #d8dde4 vs 正典铁面 #bebebe/#d8d8d8）——落地方向见 §5.2（照抄 hex 或沿用 repo 色板皆可，D13 版权口径见该节）。

### 2.5 1.21.11 复核（资产解码 + 逐字节比对）

- 六张贴图 1.20.4 vs 1.21.11 **逐像素一致**：可见 RGB 差异 0、alpha 布局差异 0（六张全过，2026-10-29 脚本实测）。
- 部分文件仅 **PNG 容器重编码**：如 iron 1.20.4 = colorType 6 RGBA（196B）→ 1.21.11 = colorType 3 索引色 depth 8（194B）——像素内容不变，只是 Mojang 资产管线的存储优化。
- 结论：本报告的像素证据对 1.21.11 同样有效；引用时写「以 1.20.4 一手资产为准（1.21.11 复核逐像素一致）」。

### 2.6 与本仓库 SWORD_ART 的差异（「不够帅」的资产级根源）

（repo 侧为 js/icons.js `SWORD_ART` 一手代码对照；正典侧为 §2.2 解码。）

| 维度 | 正典（解码实测） | 本仓库 SWORD_ART | 观感影响 |
| --- | --- | --- | --- |
| 刃厚 | 垂直 3px 带 + 通长白亮线 | 1–2px 细线（`+#-` 三档明暗） | 细线「玩具感」，无金属刃面 |
| 高光 | 白/冰蓝 8px 通长线（铁/金/钻） | 无独立白高光槽 | 缺「金属反光」语言 |
| 护手 | 垂直于刃的粗斜杆（跨 8px、两臂带台阶） | `WWWWw` 细横条 5px、贴在刃根一侧 | 结构感弱 |
| 柄尾 | 3×3 圆头角块兜底 | 无（木柄直接画到角） | 剑「没有重心」 |
| 刃:柄 | ≈ 13:7（刃长柄短） | ≈ 8:6 | 正典更修长 |
| 尖端 | 3px 暗帽收尖 | 直接断头 | 尖不锐利 |

---

## 3. 手持显示变换：剑与镐斧锹同族、无专属 display

1. **族归属（本轮重验 + 姐妹调研 Q4）**：六份剑 JSON 全部 parent `item/handheld`（§1.1）；镐/斧/锹/锄亦全部 handheld 且第一人称与剑**完全同值**（姐妹调研 Q4 农具逐文件验证表）。**vanilla 不存在任何剑专用 display**——「剑的握法」与「镐的握法」在正典里是同一组数字。
2. **正典 → 本仓库折算对照**（数值出处 §1.2；折算口径为 js/held-item.js 既有注释自述）：

| 正典（1.20.4 一手） | 本仓库现有对应 | 状态 |
| --- | --- | --- |
| 第一人称 `[0,-90,25] + [1.13,3.2,1.13]/16 + 0.68` | `FP_HANDHELD = {pos:[1.13/16,3.2/16,1.13/16], rot:[0,-1.5708,0.4363], scale:0.8}`（[-90,25]° 折弧度；scale 按全长比例折 0.8） | **已一致**，剑 def 的 `fp: fpOf(FP_HANDHELD)` 沿用即可 |
| 第三人称 `[0,-90,55] + [0,4.0,0.5]/16 + 0.85` | `TOOL_GRIPS.sword = {pos:[0,-0.50,-0.10], rot:[-0.76,0,0]}`（前移离臂 + 前倾 ≈43.5° 的自定义口径） | **部分折算**：现值只有「前倾」，缺绕 Y −90°（长轴转前）与绕 Z 55° 斜握的正典分量；改薄片后照 bow_item 的三轴折算路线补齐（§5.4） |

3. 观感解读（推算）：第一人称 −90° 绕 Y = 贴图长轴由竖直转为指向正前，+25° 绕 Z = 向内倾贴手指；第三人称 55° 斜握 + scale 0.85 是「斜提着剑」的经典剪影。**薄片的长轴画在贴图对角线上**，故实际施加时与 bow_item 一样需要把对角线朝向折算进 grip 的欧拉序（观感调参，见 §5.4）。

---

## 4. 基岩版（一句话）

vanilla 基岩资源包**没有剑的 attachable**（姐妹调研 Q5 对 bedrock-samples 的逐文件 404 消极证据：`attachables/diamond_sword.json` 不存在），不写 attachable 的物品默认手持形态即「精灵贴图挤出网格」（Bedrock Wiki 口径）——**与 Java 同构；本报告以 Java 一手资产为准**。

---

## 5. 对本仓库的落地方向

> **性质声明**：本节是推断性设计建议，不是 §1–§4 的事实论断；目的是把正典证据翻译成 my-craft-demo（Three.js r128、经典 `<script>` 共享词法环境、无构建步骤）能直接用的改动清单。**本报告只调研不改码**；「正典实测数值」与「需本项目决策」分开列。范围只含剑（`sword` 手工模板 + `sword_wood/stone/iron/diamond` 四阶），镐/斧/锹不在本次。

### 5.1 管线判决：像素薄片，不走盒体改造

**证据链**：① 正典剑 = `item/handheld → builtin/generated` 挤出薄片，无 3D 盒几何（§1）；② 本仓库薄片管线已由 bow_item/shears 趟平——`parts` 加 `art` 字段 → `mkArtMats` 画 `ITEM_PIX` 字符画上 CanvasTexture → 正反面贴图 + `alphaTest` 裁透明角 + 侧面 color 单色近似，`mount/swap` 消费方零改动（js/held-item.js 现行）；③ 盒体改造路线（把四件盒拼成剑形）永远到不了「白刃线/透明角/斜杆护手」这层像素语言——那正是用户要的「和我的世界里一样」。

**结论**：剑的手持 def 改为**单个 art 薄片部件**（形制照 bow_item/shears：`w:h:d ≈ 0.62×0.62×0.05`），贴图源用 ITEM_PIX 剑字符画。手工 `sword` 条目（观感族模板，`defFor` 永不命中）与 `mkToolDef` 的 `TOOL_HEAD_PARTS.sword` 分支同步换，四阶仍由同一字符画 × `PIX_TIER` 色板生成——与正典「同形换色板」机制逐字对齐。

### 5.2 16×16 剑像素画要点（画师清单）

新画一张手持级剑字符画（建议常量名 `SWORD_ART` 原地升级或新增 `SWORD_HELD_ART`，见 §5.3 的防错网约束），要点全部照 §2.3 解码结构：

1. **对角线走向**：柄左下、尖右上（repo 现画已同向，保留）；长轴贴反对角线 x+y≈15。
2. **透明角**：左上、右下两片三角透明区，字符画用 `.` 留空——`mkArtMats` 的 alphaTest 会裁出正典剪影。
3. **剑刃**：垂直 3px 带（约 13px 长）；**上缘一条通长亮线**（四阶色板给一档「白/近白」：铁/石可白 #ffffff 系、钻石冰蓝 #a4fdf0、木浅木色——正典里木石无白线，金属剑才有）；下缘 1px 暗描边通长压边；尖端 3px 暗帽收尖。
4. **护手**：垂直于剑刃的粗斜杆，跨刃两侧（左上臂 + 右下臂各 3–4px，台阶收分），不是单侧细横条。
5. **握柄**：沿对角线短棒 6–7px，用固定的「木柄色板」槽位（正典五阶共用同一组木色——repo 的 `W/w` 槽机制即此，可扩成 3–4 档木色槽）。
6. **柄尾圆头**：左下角 3×3 圆头角块兜住木柄末端，用刃色最暗档。
7. **四阶策略 = 同形换色板**（正典一手结论）：一张字符画 × 四组 `#/+/-` 色板，机制照现 `mkToolDef`/ITEM_PIX 工具循环，不画四张。
8. **色板来源**：可直接照抄 §2.4 正典 hex，或沿用 repo `PIX_TIER`（色值与正典不同但明度结构相近）。**版权口径（GLOSSARY D13 既有裁决）**：MC 资产版权限制，**只取语义与观感语言、像素全部自绘**——照抄 hex 色值属于「观感语言参考」的既有做法范畴（火把调研 §7.2 同款口径），贴图本体必须字符画自绘，不打包原 PNG。

### 5.3 ITEM_PIX 现状登记（可复用键清单 + 防错网）

- **已存在、可直接复用给手持薄片的键**：`sword_wood` / `sword_stone` / `sword_iron` / `sword_diamond`——由 js/icons.js 工具循环 `ITEM_PIX[kind + '_' + tier]` 生成，`art` 均为同一张 `SWORD_ART`，`map` 为 `#/+/-` 三档 `PIX_TIER`（wood #8a5a2b/#a8743d/#6b451f · stone #8a8f98/#a3a8b0/#6e737c · iron #d8dde4/#eef1f5/#b0b7c0 · diamond #4ee1d2/#7feee2/#2fb8aa）+ `W/w` 木柄槽（PIX_HANDLE #a0703c/#7a5228）。`mkArtMats` 消费 `ITEM_PIX[p.art]`，故 def 的 `art:'sword_iron'` 等四键**今天就能通**。
- **但 `SWORD_ART` 是图标级简化画**（§2.6 五条差异）：快捷栏 16px 下可接受，手持放大 10 倍后「不帅」会被放大。**建议**：手持与图标共用升级后的同一张字符画（正典本来就是同一张贴图既当图标又当手持薄片源——§1.1 layer0 复用语义）；若要图标暂稳、手持先换，则需新增 art 常量但**不新增 ITEM_PIX 键**（见下）。
- **防错网约束（动码前必读）**：
  - `test/icons-item.test.js` 断言 **ITEM_PIX 键集 === ITEMS 键集**——新增/删除键必须与 items-core 同步，只换 `SWORD_ART` 内容或其 `map` 则安全；
  - js/button-icons.js `BTN_PIX.swords.map = ITEM_PIX.sword_iron.map`（战斗按钮剑图标引用铁剑色板）——换 art 不换 map 不受影响，若重排色板槽位需同步检查；
  - `test/held-item.test.js` 断言每个 part 的 `w/h/d/color` 为数字、且工具 def 的 parts 中**必须出现该阶 `TIER_HEAD_COLORS[tier]` 色**——art 薄片部件保留 `color = 阶色`（挤出侧面单色沿用）即可同时满足两侧。

### 5.4 手持 def 需要动的字段（逐字段清单）

| 字段 | 改不改 | 建议 |
| --- | --- | --- |
| `parts` | **改（核心）** | 四阶 + 手工模板：从「木柄+柄尾+护手+剑身」4 盒 → 单 art 薄片 `{w:0.62, h:0.62, d:0.05, color:<阶色>, art:'sword_'+tier, pos:[…], }`。**pos 抬移把握点对准柄段**：贴图握柄段中心 ≈ (3,12)px，相对片中心偏 (−5,−4)px ≈ (−0.19,−0.16)（1px≈0.039），故 `pos ≈ [0.19, 0.16, 0]` 让柄段落座握点、剑尖伸向右上前方（shears 的 `pos:[0,0.14,0]` 同款手法；数值调参不判红）。对角线全长 0.62·√2 ≈ 0.88 ≈ 现剑全长 0.84，尺度感不跳变 |
| `grip` | **微调** | 正典第三人称 `[0,-90,55]`：现 sword `rot:[-0.76,0,0]` 缺斜握分量。照 bow_item 折算路线取 `rot ≈ [0, -1.5708, 0.9599]`（Y −90° 长轴转前 + Z 55° 斜握，折弧度），再按「长轴在贴图对角线上」做 ≈45° 预旋转修正、`pos` 沿用工具组前移离臂口径 `[0,-0.50,-0.10]`（2026-10-24 用户观感两轮反馈的既定口径不动）。**两条可接受路线**：A. 全折算（更正典）；B. 保留现前倾口径只换形状（改动最小）——观感调参不判红，先 A 后 B 皆可 |
| `fp` | **不改** | 正典剑第一人称 = handheld 族值（§3），`fpOf(FP_HANDHELD)` 已逐值一致；薄片长轴朝向的适配 bow_item 已趟平 |
| `swing` | **不改** | 剑档 `{dur:0.20, amp:1.6, curlZ:0.05}`（快而阔）与正典挥击体系无冲突（姐妹调研 Q3/Q4：swing 时长与 display 是两套参数） |
| `sway` | 不改 | 通用待机浮动 |
| 管线 | **零改动** | `mkArtMats/mount/swap` 现成；Node 单测口径（无 document/THREE）自动回落纯色薄板，与弓/剪刀同纪律 |
| 配套 | 登记 | `drops.test` 工具观感豁免集（剪刀票先例）：若单测断言「工具 def 形状」依赖盒体数量需同步；`TOOL_HEAD_PARTS.sword` 注释改为指向本报告 |

### 5.5 明确不做（本次范围外）

- 镐/斧/锹的薄片化（同管线可复制，但用户只点了剑；且镐斧锹的 `SWORD_ART` 对应字符画差异分析不在本次证据内）。
- 金剑/下界合金剑（ITEMS 无对应 id，`PIX_TIER` 无此二阶；§2.4 色板留档仅作未来参考）。
- 挤出厚度的一手确证（§1.5 无新证据，维持未确证；repo 0.05 片厚不动）。

---

## 附录 A：其余五张剑贴图字符画全录（资产解码 @1.20.4）

（坐标约定同 §2.2；木柄槽 `b/c/d/e` 五阶同色，netherite 为 `S/U/V/W/X` 暗柄。）

**wooden_sword**（depth-4 调色板，11 色）：`#`=#372910 · `@`=#755821 · `%`=#866526 · `&`=#20180a · `$`=#594319 · `a`=#473614

```
.............###
............#@%&
...........#@%@&
..........#@%@&.
.........#@%@&..
........#@%@&...
..##...#$%@&....
..#a#.#$%$&.....
...#$&$@$&......
...#$$a$&.......
....#a#&........
...bc&##&.......
..bde.&&#&......
##ce....&&......
#a&.............
&&&.............
```

**stone_sword**（depth-4 调色板，11 色）：`f`=#494949 · `g`=#95918d · `i`=#b3b1af · `j`=#212121 · `k`=#787777 · `l`=#5a5a5a

```
.............fff
............fgij
...........fgigj
..........fgigj.
.........fgigj..
........fgigj...
..ff...fkigj....
..flf.fkikj.....
...fkjkgkj......
...fkklkj.......
....flfj........
...bcjffj.......
..bde.jjfj......
ffce....jj......
flj.............
jjj.............
```

**diamond_sword**（depth-8 调色板，12 色）：`u`=#0e3f36 · `v`=#a4fdf0 · `w`=#082520 · `x`=#2bc7ac · `y`=#33ebcb · `z`=#156355 · `A`=#1e8a77

```
.............uuu
............uvvw
...........uvxvw
..........uvxvw.
.........uvxyw..
........uvxyw...
..uu...uyxyw....
..uzu.uyxyw.....
...uAwyAyw......
...uAAzyw.......
....uzuw........
...bcwuuw.......
..bde.wwuw......
uuce....ww......
uzw.............
www.............
```

**golden_sword**（RGBA，11 色）：`B`=#825d16 · `n`=#ffffff · `C`=#3f2e0e · `D`=#eaee57 · `E`=#fdff76 · `F`=#dc9613 · `H`=#e9b115

```
.............BBB
............BnnC
...........BnDnC
..........BnDnC.
.........BnDEC..
........BnDEC...
..BB...BEDEC....
..BFB.BEDEC.....
...BHCEHEC......
...BHHFEC.......
....BFBC........
...bcCBBC.......
..bde.CCBC......
BBce....CC......
BFC.............
CCC.............
```

**netherite_sword**（depth-4 调色板，14 色；**握柄同为暗色，非共用木柄**）：`J`=#4a2940 · `K`=#867b86 · `L`=#231012 · `M`=#706770 · `N`=#51444e · `O`=#5d565d · `Q`=#322727 · `R`=#4f3c3e · 柄：`S`=#2f2122 · `U`=#603432 · `V`=#734543 · `W`=#3b393b · `X`=#160814

```
.............JJJ
............JKKL
...........JKMKL
..........JKNKL.
.........JMNML..
........JONOL...
..JJ...JNQRL....
..JOJ.JNQRL.....
...JMJRQRL......
...JMMQRL.......
....JONL........
...SULRQL.......
..SVL.LLQL......
JJWL....LL......
JQL.............
XLL.............
```

---

## 附录 B：未能核实清单（2026-10-29 终态）

1. **挤出厚度的一手数值**：官方文档与 vanilla JSON 均无（§1.5）；Forge 官方 patch 镜像未覆盖 `ItemModelGenerator`（1.18.x 分支 raw 探测 404），客户端生成代码的方法体无公开逐行一手副本——「1px = 1/16 格」维持社区共识口径，标未确证。
2. **1.21.11 全部六张贴图的容器格式清单**：本轮只逐字节记录了 iron（ct6→ct3 重编码）与像素级一致性六张全过；其余五张的容器类型未逐张登记（不影响像素结论）。
3. **基岩版剑手持的骨骼/位移数值**：无官方文档，姐妹调研 Q8 已证基岩第一人称手臂姿态为引擎内置 + 社区测量值，本文不重查（以 Java 一手资产为准）。
4. **26.1（当前快照周期）剑贴图**：未抓取（火把模板在 26.1 逐字节一致的先例 + 1.21.11 复核一致已给足够稳定性置信）；如需对齐 26.1 再补一轮同款比对即可。

---

## 来源清单

| # | 来源 | 类型 | URL / 位置 | 支撑的结论 |
| --- | --- | --- | --- | --- |
| S1 | InventivetalentDev/minecraft-assets @ **1.20.4**（vanilla 客户端资源提取镜像） | **资源一手** | https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.4/assets/minecraft/ 下 `models/item/{iron,wooden,stone,diamond,golden,netherite}_sword.json`、`models/item/handheld.json`、`models/item/generated.json`、`textures/item/<tier>_sword.png` 六张 | §1 全部 JSON 原文与 parent 链、§1.2 display 真值、§2 全部像素解码 |
| S2 | 同镜像 @ **1.21.11**（复核集） | **资源一手** | https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.11/assets/minecraft/ 下 `models/item/handheld.json`、`models/item/iron_sword.json`、`textures/item/<tier>_sword.png` 六张 | §1.4 逐字节/逐像素复核一致、§2.5 容器重编码记录 |
| S3 | Minecraft Wiki — Model（资源包模型格式现行页 wikitext，2026-10-29 `action=raw` 抓取） | Wiki（官方格式文档） | https://minecraft.wiki/w/Model | §1.3/§1.5（`builtin/generated` 语义原句 "a model that is created out of the specified icon. Only the first layer is supported"；全文无挤出厚度明文） |
| S4 | [mc-held-item-render-research.md](mc-held-item-render-research.md)（姐妹调研，1.20.4 同源） | 本仓库调研 | docs/ 内 | Q2（generated/handheld 全表 display、苹果/木棍对照）、Q5（基岩 attachable 消极证据 + 默认挤出薄片口径） |
| S5 | [mc-first-person-hand-research.md](mc-first-person-hand-research.md)（姐妹调研续篇） | 本仓库调研 | docs/ 内 | §3（Q4 农具/工具族逐文件验证：hoe/axe/shovel/pickaxe/sword 无一例外 handheld、第一人称同值） |
| S6 | [mc-torch-model-research.md](mc-torch-model-research.md) | 本仓库调研 | docs/ 内 | 方法先例（资产解码标注、版本复核手法、落地节性质声明格式）；§5.2 色值参考的 D13 版权口径同源 |
| S7 | 本仓库代码与术语表（一手现状） | 代码一手 | js/icons.js（`SWORD_ART`/`PIX_TIER`/`PIX_HANDLE`/ITEM_PIX 工具循环/`drawArt`）、js/held-item.js（`mkArtMats`/`mount`/`FP_HANDHELD`/`TOOL_GRIPS`/`mkToolDef`）、js/items-core.js（sword_* id）、test/icons-item.test.js、test/held-item.test.js、GLOSSARY.md「手持物注册表（HeldItems）」「像素图标工坊」词条、js/button-icons.js（BTN_PIX.swords 委托） | §2.6 现状对照、§5.3/§5.4 全部登记与防错网约束 |

**解码可复现性说明**：解码/比对脚本（`decode.js` / `compare.js` / `upscale.js`）与官方 PNG 原件存会话临时目录 `C:\Users\user\AppData\Local\Temp\opencode\mc-sword\`（按环境约定不入仓库）；解码分支 = **1.20.4**（复核 1.21.11）。§1.4 的「逐字节一致」用 `fc /b` 得出；§2.5 的「逐像素一致」由 compare.js 对 RGBA 四元组逐像素比较（可见 RGB 差异 0、alpha 差异 0）得出。

（本报告只新增 `docs/mc-sword-model-research.md`，不改动任何代码/测试/其他文档。）
