# 我的世界火把方块模型与贴墙实现 · 调研报告

> 调研问题：为 my-craft-demo「火把从明显方块 → MC 式细贴片」取证——Minecraft（Java 版为主、Bedrock 差异为辅）火把方块的**模型几何**（立式/墙式确切尺寸与格内位置）、**贴图映射与像素画法**、**放置与支承规则**、**碰撞箱/选中轮廓**、**粒子与物品形态**，并尽量引入 Mojang 官方资产 JSON 原文。光照等级/合成/燃料/手持不发光/刷怪光照等已由 [mc-daylight-torch-research.md](mc-daylight-torch-research.md) 覆盖，本文直接引用不重查。
> 来源性质：事实性论断来自 ① minecraft.wiki 各条目 wikitext 一手原文（2026-10-28 用 `index.php?title=…&action=raw` 抓取，标「已抓取」）；② Mojang 官方资产原文——Java 客户端资产镜像 [InventivetalentDev/minecraft-assets](https://github.com/InventivetalentDev/minecraft-assets)（**引用版本 tag 1.21.11**；火把两份模型模板已在 **26.1** 复核**逐字节一致**，浏览可用 [mcasset.cloud](https://mcasset.cloud)，路径同 `assets/minecraft/…`），Bedrock 用官方 [Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples)；③ 贴图逐像素数据由本调研用脚本解码官方 PNG（标「资产解码」）。由模型 JSON 计算出的坐标标「推算」；无一手原文的点明确标「未能核实」，不凭记忆补写。
> 调研日期：2026-10-28。

## 0. 结论先行（TL;DR）

1. **火把不是植物 cross 模型，是专用 3D 小盒模型**：16×16×16 像素模型空间内一根 **2 宽 × 10 高 × 2 深** 的细棒（`from [7,0,7] to [9,10,9]`——水平居中、贴地、占格高 10/16 = 0.625 格）。立式火把（Java `torch`）**没有任何方块状态**，blockstate 只有一个空 variant；Bedrock 单 id 50 用 `torch_facing_direction` 的 `top` 值表达立式。（§1）
2. **墙火把 = 同一根 2×10×2 细棒平移到墙面 + 整体旋转 −22.5°**：模板 `template_torch_wall.json` 元素 `from [-1,3.5,7] to [1,13.5,9]`，绕底面中心 `(0,3.5,8)` 绕 z 轴转 −22.5°——**底端中心贴在墙面上（嵌入墙块 1px）**、底边距格底 3.5px，**顶端向离开墙的方向倾出**（tan22.5° ≈ 0.414）。基础模型朝东，四种朝向靠 blockstate 的 y 旋转 0/90/180/270。（§2）
3. **Java 现行是两个方块 id**（`torch` + `wall_torch`，点击侧面放置的是 `wall_torch`）；1.13 拆分史原文：「The non-up facing block states for the `torch` ID have been split up into `wall_torch`. Prior to The Flattening, this block's numeral ID was 50.」Bedrock 始终单 id 50，状态取值 `west/east/north/south/top`——**没有 bottom，两版都不能挂天花板**。（§2.3/§3.3）
4. **放置支承判据（现行 Java，Opacity/Placement 明文）**：顶面立火把只需「**小方形实心面**」（small square——栅栏柱、墙顶、带眼末地门框都行）；侧面贴墙必须「**完整方形面**」（full square——玻璃可以，玻璃板/铁栏杆侧面不行）。不能放天花板、不能叠在另一火把（非实心）上。版本史：玻璃顶 1.2.1、倒置台阶/楼梯顶 1.3.1（12w25a）、栅栏顶 1.7、铁栏杆+玻璃板顶 1.14.3。（§3）
5. **支承破坏 = 直接脱落成掉落物**（依附块被移动/移除/破坏、水流入、活塞推挤；熔岩流入则直接销毁无掉落）。历史注脚：**indev 早期火把恰好有「转依」行为**（失撑后自动换到其他可附着面），2010-02-12（20100212-1210）被移除。本项目「底座挖掉转依墙存活」的有意偏差已在 [block-lifecycle-design.md](block-lifecycle-design.md) 附录 B 登记——**正当偏差，不当问题**（有趣的是 MC 原作曾短暂同款后删除）。（§4）
6. **碰撞箱：无**（wiki noCollision 清单原文在列）；**选中轮廓箱的精确数值 wiki 未刊载**——Hitbox 页明言所有命中箱尺寸硬编码于游戏代码，且页面挂着「缺方块交互箱数值清单」的 Missing information 模板。本报告给出由模型 JSON 推算的 AABB：立式 2×10×2 @ 格中心贴地；墙式（facing=east）x∈[−0.92, 4.75]px、y∈[3.12, 13.12]px、厚 2px（即入墙 0.06 格、探出 0.30 格）。（§5）
7. **「细贴片」观感的配方**：贴图只画一根 2px 宽、10px 高的棍条（火焰区仅 2×2 px 的黄白色），**火苗观感主要来自 `flame` 粒子，烟观感来自 `smoke` 粒子**（「floats off the top of torches and soul torches」）。物品/手持形态是**平面 sprite**（`item/generated`，直接复用块贴图）。灵魂火把 = 同布局同棍身、火焰 2×2 换青蓝色（#32e8ee 系），光 10。（§1.3/§6）
8. **对本项目的核心差距**（详见 §7 落地启示）：①几何占满格（MC 只有 2×10×2 小盒）②贴图火焰画得太大（MC 仅 2×2 px，大焰观感靠粒子）③**斜倚方向相反**——MC 是「底贴墙、顶外倾 22.5°」，本项目 pushCross 是「顶边朝墙 LEAN_TAN=0.3 剪切」④墙式底边未抬高（MC 底距格底 3.5px = 0.219 格）。MC 在 1.8（14w07a）自己把墙火把从「剪切平行六面体」改成了「旋转立方体」——「剪切 → 旋转」正是本项目可以照走的同一条路。

---

## 1. 立式火把：专用盒模型（不是 cross）

### 1.1 资产 JSON 原文（三件套，@1.21.11，已抓取）

`assets/minecraft/blockstates/torch.json`：

```json
{
  "variants": {
    "": {
      "model": "minecraft:block/torch"
    }
  }
}
```

→ 立式火把**无方块状态**（唯一空 variant）；Bedrock 用同一 id 的 `torch_facing_direction=top` 表达（见 §2.3）。

`assets/minecraft/models/block/torch.json`：

```json
{
  "parent": "minecraft:block/template_torch",
  "textures": {
    "torch": "minecraft:block/torch"
  }
}
```

`assets/minecraft/models/block/template_torch.json`（几何本体，全文）：

```json
{
    "ambientocclusion": false,
    "textures": {
        "particle": "#torch"
    },
    "elements": [
        {   "from": [ 7, 0, 7 ],
            "to": [ 9, 10, 9 ],
            "shade": false,
            "faces": {
                "down":  { "uv": [ 7, 13, 9, 15 ], "texture": "#torch", "cullface": "down" },
                "up":    { "uv": [ 7,  6, 9,  8 ], "texture": "#torch" },
                "north": { "uv": [ 7,  6, 9, 16 ], "texture": "#torch" },
                "east":  { "uv": [ 7,  6, 9, 16 ], "texture": "#torch" },
                "south": { "uv": [ 7,  6, 9, 16 ], "texture": "#torch" },
                "west":  { "uv": [ 7,  6, 9, 16 ], "texture": "#torch" }
            }
        }
    ]
}
```

（26.1 复核：与 1.21.11 逐字节一致——火把模板未随 26.1 snap7 的贴图格式改版变化。）

### 1.2 几何与贴图映射解读

| 项 | 数值（像素） | 换算（格，1 格 = 16px） |
| --- | --- | --- |
| 盒体 from/to | (7, 0, 7) → (9, 10, 9) | — |
| 宽 × 高 × 深 | **2 × 10 × 2** | 0.125 × 0.625 × 0.125 |
| 格内位置 | x、z ∈ [7, 9]（**水平居中**，中心 (8, 8)）；y ∈ [0, 10]（**贴地**） | x/z ∈ [0.4375, 0.5625]；y ∈ [0, 0.625] |
| 侧面 UV | [7, 6, 9, 16]——采样贴图 x∈[7,9)、y∈[6,16) 的 2×10 棍条 | 与面尺寸 1:1，无缩放 |
| 顶面 UV | [7, 6, 9, 8]——棍条最上 2×2（火色像素） | 2×2 面 |
| 底面 UV | [7, 13, 9, 15]——棍身下部 2×2（深木色） | 2×2 面 |

- **down 面带 `cullface: "down"`**：贴地放置时底面被相邻面剔除，不渲染（省一面；Model 页对 cullface 的定义原文："Specifies whether a face does not need to be rendered when there is a block touching it in the specified position."）。墙火把模板的 down 面**没有** cullface（悬空可见）。
- **`shade: false` + `ambientocclusion: false`**：整根火把不受方向性面光照/环境光遮蔽，等效全亮度渲染（Model 页「Uses of models」表确认放置态方块尊重 `shade=false`）。这配合「火把自身格 block light = 14」构成 MC 火把永远亮堂的观感。
- **不是 cross 模型**：植物（花/树苗/草丛）用的 `models/block/cross.json`（已抓取，@1.21.11）是**两块绕 y 轴旋转 45°、占满 16×16 UV 的双面片**（元素 `from [0.8,0,8] to [15.2,16,8]` + `rotation {axis:"y", angle:45, rescale:true}`，共两块）。火把模板与它没有任何 parent 关系——**火把是实心 3D 小盒，贴图只在棍条区取样**，植物才是「贴图透明区裁切面片」。这也是「火把观感比植物更『实体』」的资产级原因。

### 1.3 官方贴图逐像素（资产解码，torch.png @1.21.11，16×16 RGBA）

| 贴图行 y（自上而下） | x = 7 | x = 8 | 含义 |
| --- | --- | --- | --- |
| 0 – 5 | 透明 | 透明 | 物品 sprite 的留白 |
| 6 | `#ffd800` | `#ff8f00` | 火焰顶（橙黄） |
| 7 | `#ffff97` | `#ffffff` | 火焰亮芯（近白） |
| 8 | `#9f7f50` | `#6d5736` | 棍顶 |
| 9 | `#957546` | `#55452e` | 棍身 |
| 10 | `#9f7f50` | `#423522` | 棍身 |
| 11 | `#9f7f50` | `#55452e` | 棍身 |
| 12 | `#957546` | `#55452e` | 棍身 |
| 13 | `#6d5736` | `#3d301d` | 棍身 |
| 14 | `#9f7f50` | `#3b2e1b` | 棍身 |
| 15 | `#6d5736` | `#372a17` | 棍底 |

- 整根火把 = **2px 宽、10px 高**（行 6–15），其中火焰区只有 **2×2 px**（行 6–7），棍身 2×8 px（行 8–15）。x=7 列整体偏亮、x=8 列偏暗——2px 宽的棍自带受光面/背光面立体感。
- 侧面 UV 采样的 `[7,6]–[9,16]` 恰是这根棍条（1:1）；**物品 sprite（§6.2）显示的也是同一根棍条**，透明区只是给图标留白。**「火苗很大」的观感不是贴图画出来的，是粒子（§6.1）叠出来的**。
- 灵魂火把 `soul_torch.png`（资产解码）：布局逐行相同，仅火焰 2×2 换色——行 6 `#32e8ee`/`#01a7ac`、行 7 `#7bfafe`/`#ffffff`（青蓝火焰），棍身颜色完全一致。

### 1.4 渲染层（render type 是不是 cutout？）：**未能核实（一手），且有结构性理由说明它不重要**

- **1.21.11 与 26.1 的模型 JSON 均无 `render_type` 字段**（template_torch.json 如上；对照组 leaves.json 也没有）——渲染层**不是**资源包数据。wiki [Model](https://minecraft.wiki/w/Model) 页现行块模型格式文档（parent/ambientocclusion/display/textures/elements/…）同样没有该字段。
- Model 页 History 侧证：「**26.1** (snap7): Any block model can now support cutout or translucent (partially transparent pixels) textures.」——26.1 起才允许任意块模型使用 cutout/半透明纹理，反证此前块渲染层由客户端硬编码决定。
- 结构性论证（推断）：火把**块模型只采样棍条区的实心像素**（UV 从不触及透明区），几何是实心小盒——块形态本身不需要 alpha 测试；真正需要 alpha 处理的是**物品 sprite**（`item/generated` 全幅贴图含大片透明像素）。所以「火把块是不是 cutout 层」对观感无影响。本项目 `world.js` 图集材质的 `alphaTest` 通道已等价覆盖两侧需求。
- wiki 口径可引用的部分：Torch 页 infobox `transparent = Yes`；[Opacity](https://minecraft.wiki/w/Opacity) 页把火把归入「Non-solids」透明方块清单（已抓取）。

### 1.5 模型史（版本分界）

（来源：[Torch](https://minecraft.wiki/w/Torch) Data history + [Model](https://minecraft.wiki/w/Model) History，已抓取）

- **1.8 14w06a 之前：火把几何硬编码在游戏代码里**——Torch 页原文：「Torches now have dedicated model JSON files; previously the geometry was defined in the game code itself.」（14w06a 同版 Model 页：「Added custom block models.」）
- **14w07a 模型格式重写**（Model 页原文）：「The model format has now been rewritten. Instead of having just "planes", it now has "planes" and "cubes". **The rotation of objects are now limited to one directional rotation per object in increments of 22.5 degrees.**」——**墙火把的 22.5° 倾角正是这个步进约束的产物**（见 §2.2）。
- **1.21.6 25w16a**：旋转不再限定 22.5° 的倍数；**1.21.11 25w46a**：元素可多轴旋转、角度解除 ±45° 限制——但官方火把模板至今仍用 −22.5°，未改。
- **1.21.4 24w45a**：块模型与物品模型统一（「the game makes no distinction between block models and item models」），`models/block` 与 `models/item` 目录只剩组织意义。

---

## 2. 墙火把：平移到墙面 + 旋转 −22.5°

### 2.1 资产 JSON 原文（@1.21.11，已抓取）

`assets/minecraft/blockstates/wall_torch.json`：

```json
{
  "variants": {
    "facing=east": {
      "model": "minecraft:block/wall_torch"
    },
    "facing=north": {
      "model": "minecraft:block/wall_torch",
      "y": 270
    },
    "facing=south": {
      "model": "minecraft:block/wall_torch",
      "y": 90
    },
    "facing=west": {
      "model": "minecraft:block/wall_torch",
      "y": 180
    }
  }
}
```

`assets/minecraft/models/block/wall_torch.json`：

```json
{
  "parent": "minecraft:block/template_torch_wall",
  "textures": {
    "torch": "minecraft:block/torch"
  }
}
```

`assets/minecraft/models/block/template_torch_wall.json`（几何本体，全文）：

```json
{
    "ambientocclusion": false,
    "textures": {
        "particle": "#torch"
    },
    "elements": [
        {   "from": [ -1, 3.5, 7 ],
            "to": [ 1, 13.5, 9 ],
            "rotation": { "origin": [ 0, 3.5, 8 ], "axis": "z", "angle": -22.5 },
            "shade": false,
            "faces": {
                "down":  { "uv": [ 7, 13, 9, 15 ], "texture": "#torch" },
                "up":    { "uv": [ 7,  6, 9,  8 ], "texture": "#torch" },
                "north": { "uv": [ 7,  6, 9, 16 ], "texture": "#torch" },
                "east":  { "uv": [ 7,  6, 9, 16 ], "texture": "#torch" },
                "south": { "uv": [ 7,  6, 9, 16 ], "texture": "#torch" },
                "west":  { "uv": [ 7,  6, 9, 16 ], "texture": "#torch" }
            }
        }
    ]
}
```

（灵魂墙火把 `blockstates/soul_wall_torch.json` 与上表逐字段同构，仅模型名换 `soul_wall_torch`，已抓取。）

### 2.2 几何解读（基础朝向 = facing=east，墙在火把格的西侧）

变换分两步：

1. **平移**：同一根 2×10×2 盒，但 x ∈ [−1, 1]——**骑跨在本格西边界（墙面 x=0）上，嵌入墙块空间 1px**（消除贴墙缝）；y ∈ [3.5, 13.5]——**底边距格底 3.5px**（0.219 格）；z ∈ [7, 9] 不变。
2. **旋转**：绕「底面中心」(0, 3.5, 8) 绕 z 轴 **−22.5°**——顶端向 **+x（东，离开墙）** 倾出，底端留在墙面。

**推算关键点**（由上述 JSON 计算，cos22.5° = 0.9239、sin22.5° = 0.3827）：

| 量 | 像素 | 格 |
| --- | --- | --- |
| 倾角（与竖直方向夹角） | **22.5°**（tan ≈ 0.414） | — |
| 底面中心（支点） | (0, 3.5, 8)——在墙面上 | 距格底 0.219 |
| 顶端中心 | (3.83, 12.74, 8) | 离墙 0.239、高 0.796 |
| 旋转后整体 AABB | x ∈ [−0.92, 4.75]，y ∈ [3.12, 13.12]，z ∈ [7, 9] | 入墙 0.058 / 探出 0.297；高 0.195–0.820；厚 0.125 |

**方向语义链（三重一手互证）**：① Torch 页 block states 原文：`facing` 的含义是「**The direction the top of the torch is facing.**」（火把顶部指向）；② blockstate 里 `facing=east` 对应**模型不旋转**；③ 模型几何旋转 −22.5° 使顶端朝 +x。三条合起来 ⇒ **facing=east 的墙火把顶端朝东、墙必在西侧**——即 **MC 墙火把是「底贴墙、顶端向外倾出」**。它不是「斜靠在墙上的棍」（顶端搭墙），而是「插在墙根向外探的棍」。

- **14w07a 的关键改动**（Torch 页 History 原文，已抓取）：「Torches placed on walls are now **rotated cuboids rather than a parallelepiped**. Their top texture now also rotates accordingly.」（译：墙上的火把从平行六面体（剪切盒）改为旋转立方体，顶面贴图也随之旋转。）——**剪切 → 旋转是 MC 自己在 1.8 走过的改版路线**，墙火把几何自那以后未再变过。

### 2.3 朝向：状态、id 与放置判定

- **Java（现行）**：`wall_torch` 独立 id，`facing ∈ {east, south, west, north}`，默认 north；四朝向 = 基础模型（朝东）绕 y 转 0/90/180/270。**点击侧面时放置的是 `wall_torch` 方块**——1.13 拆分史原文（Torch 页 Data history，已抓取）：「**The non-up facing block states for the `torch` ID have been split up into `wall_torch`.** Prior to [[1.13/Flattening|The Flattening]], this block's numeral ID was 50.」（译：torch id 里非朝上的状态拆分为 wall_torch； flattening 前 torch 数字 id 是 50。）即 **1.13 前墙火把=同一 id 50 的方块状态变体，1.13 起是两个独立方块**。立式火把则一直无状态。
- **Bedrock（现行）**：单 id 50，状态 `torch_facing_direction`，取值 `west / east / north / south / top`（另有一个 unused 的 aux=0）。Torch 页 block states 原文（已抓取）：「**The face of the block that the torch is attached to.** If the torch is a wall torch, the top of the torch faces opposite to this direction.」（译：该值是火把附着的面；若是墙火把，顶部朝它的反方向。）附 bug 引 MCPE-152036。——语义与 Java 相反：**BE 存「附着面」、JE 存「顶指向」**，但描述的是同一姿态；「附着面 = 玩家点击的面」由这句直接可得。
- **两版都没有 bottom/ceiling 值** ⇒ 不能挂天花板（与 [mc-daylight-torch-research.md](mc-daylight-torch-research.md) §3.4 结论一致，不重查）。
- 放置通则（Torch 页 Usage 原文，已抓取）："Torches can be placed on the **top or the sides** of most solid blocks, although some blocks require {{control|sneaking}}. Being non-solid, torches have no collision box."（译：可放在多数实体方块的顶面或侧面，个别方块需潜行；火把非实心、无碰撞箱。）

### 2.4 Bedrock 墙火把几何：**未能核实**

- 官方 [bedrock-samples](https://github.com/Mojang/bedrock-samples) 资源包 `resource_pack/models/blocks/` 目录**只有 4 个 geo 文件**（straw_bed_foot/head、shelf_mushroom_large/small，2026-10-28 实查目录清单）——**火把没有数据驱动几何文件，形状在 Bedrock 引擎内硬编码**；`resource_pack/blocks.json` 的火把条目只有材质与音效（原文：`{"torch": {"sound": "wood", "textures": "torch_on"}}`）。
- wiki Torch 页图廊把 JE/BE 墙火把动图**分列两帧**（「Wall Torch.gif｜An image of a wall torch」「Wall Torch BE.gif｜Ditto, but {{in|be}}」）——两版渲染确有可见差异，但 wiki 无文字数值描述。**Bedrock 墙火把的倾角/位移数值：无公开一手来源，未能核实。**

---

## 3. 放置规则（现行 Java 为主，附版本史）

### 3.1 支承面判据：顶面「小方形」，侧面「完整方形」

（来源：[Opacity/Placement](https://minecraft.wiki/w/Opacity/Placement)「Block placement mechanics → Blocks and placement surfaces」表，已抓取）

- 表中两行原文：

  > `| {{BlockLink|Torch|Torch (side placement)}} || full square ||`
  > `| {{BlockLink|Torch|Torch (top placement)}} || small square ||`

  （译：火把侧面放置 → 需「完整方形」面；顶面放置 → 只需「小方形」面。）

- 面型定义（同页 Surface types 节原文）：「**Full square solid surface**: A solid surface with a square-shaped support shape that is a full block wide.」「**Small square solid surface**: A solid surface with a square-shaped support shape that covers a smaller surface than a full block (e.g. fence post). **Any block that can be placed on a small square solid surface can also be placed on a full square solid surface.**」（译：完整方形面=整格宽的方形支承面；小方形面=小于整格的方形支承面（如栅栏柱顶），能放小方形的也必然能放完整方形。）
- **这就是「栅栏柱/墙顶能立火把、玻璃板侧面不能贴火把」的统一判据**：立式只要求一个小方形的「立足点」，贴墙则要求整面方形的「粘贴面」。
- 「实体（可作支承）」的判定（同页 Solid block 节原文，Java）：满足其一即算实体——① 在强制实体清单（栅栏、墙、锁链、灯笼等）；② 碰撞箱在 x/y/z 三轴的跨度之和 ≥ 35px；③ 碰撞箱垂直跨度 ≥ 16px。另有强制**非**实体清单（杜鹃花、紫颂花/植株、大垂滴叶、梯子、雪层等）。树叶是特例：「leaves, which have a full block collision shape but an **empty support shape**」（碰撞箱满格但支承形状为空——所以任何面都放不了火把）。

### 3.2 例外矩阵（已抓取并逐行解析 Torch 列，2026-10-28）

Opacity/Placement 的两张矩阵（行=支承块、列=被放块）中 Torch 列解析结果（页面自身标注只收录「有特殊行为的方块」，普通整块默认全可放）：

**顶面立火把（Torch 列）**——可放的例外块：栅栏、栅栏门、墙、玻璃板、铁栏杆、锁链、砂轮、悬挂牌（wall variant 不行，仅落地牌）、杜鹃花、紫颂花、紫颂植株（up=true）、龙蛋、末地传送门框（**带眼**，无眼则否）、末地烛、钟、铁砧、屏障、冰、浮冰、避雷针、脚手架、嗅探兽蛋、饰纹陶罐、雪层（**8 层**，2–7 层不行）。
不可放：楼梯（默认朝向，见下）、台阶类条目（见 3.4 推断）、酿造台、炼药锅、漏斗、堆肥桶、门、蜂蜜块、梯子、树叶、讲台、耕地、土径、竹子、仙人掌、蛛网、雪层（2–7）。
- **台阶/楼梯的朝向细节**：Torch 页 History 原文（1.3.1 12w25a）：「Torches can now be placed on top of **upside down slabs and stairs**.」（倒置台阶/楼梯顶可放。）结合面型判据：**倒置（顶半）台阶/楼梯的顶面是完整 16×16 方形面 → 可放；普通（底半）楼梯的顶面是 8×16 长方形（非方形）→ 不可放**（矩阵 Stairs 行 Torch=红即默认朝向口径）；底台阶顶面为完整方形 → 按判据应可放，但矩阵未列 Slabs 行（该页挂 WIP/cleanup 模板，行有缺漏）——**此点标推断**。
- 图例：铁砧/钟/玻璃板/铁栏杆四行的 Torch=绿，与 Torch 页源码中一段**已被注释停用**的放置草表（编辑注 "Inconsistent with other pages"）给出的 JE/BE 分叉（如铁栏杆顶面 JE 可 / BE 不可）方向一致，但后者非现行定论，仅作线索（见 3.5）。

**侧面贴墙（Torch 列）**——例外块里**全部为红（不可）**，仅两处特殊：紫颂花（绿，附注「the chorus flower may break, depending on its placement」）、仙人掌（附着即毁被附块）。**即：除完整方块外，几乎没有任何非整块能承接贴墙火把**（栅栏/墙/玻璃板/铁栏杆/台阶/楼梯等的侧面都不行）。
- 完整方块默认可贴——同页明列（原文）："Everything can be placed on the side of: Beacon, **Glass**, Tinted Glass, Glowstone, Ice, Sea Lantern, Doors, Trapdoors (top or bottom, open), Barrier, Composter, Observer."（**玻璃/萤石/冰的侧面都能贴火把**。）
- 顶面同理有 "Everything can be placed on [top of]: Beacon, Blue Ice, Trapdoors (top, closed), Observer, **Glass**, Tinted Glass, Soul Sand."

**底面（天花板）**：「Placement on bottom of blocks」表**没有 Torch 列**——没有任何块能从底面承接火把（与 §2.3 无 bottom 状态互证）。

### 3.3 版本史（Torch 页 History 原文摘录，已抓取）

| 版本 | 变更（原文摘录/译） |
| --- | --- |
| Alpha v1.1.0 | "Torches can no longer be placed on leaves when fancy graphics are enabled."（华丽树叶模式下树叶不可放） |
| Beta 1.6 TB3 | 树叶快速模式同样禁放；"Torches can no longer be placed on glowstone."（萤石被禁） |
| Beta 1.6.6 | 萤石恢复可放 |
| 1.2.1 (12w07a) | "Torches can now be placed on top of glass blocks."（玻璃顶可放） |
| 1.3.1 (12w25a) | "Torches can now be placed on top of upside down slabs and stairs."（倒置台阶/楼梯顶可放） |
| 1.4.4 (1.4.3) | "Torches now have a bottom texture, visible on wall torches or torches placed on top of glass."（补了底面贴图） |
| 1.7 | "Torches and redstone torches can now be placed on top of fences."（栅栏顶可放） |
| 1.8 (14w18a) | "Torches can now be placed on stained glass."（染色玻璃可放） |
| 1.12 pre4 → 1.13 (17w48a) | 南瓜灯顶先禁后复（MC-118408） |
| 1.13 (17w47a) | **The Flattening：torch 的非朝上状态拆分为 wall_torch**（数字 id 50 成历史） |
| 1.14.3 (pre3) | "Torches can now be placed on iron bars and glass panes."（铁栏杆、玻璃板顶可放） |
| 1.14 (18w43a) | 贴图更新（现行 Torch JE7 / 纹理 JE3 BE2） |

### 3.4 非整块与「火把上放火把」

- **火把自身不能当支承**：火把在 noCollision 清单（§5）无碰撞箱，三条「实体判定」全部不满足（无碰撞箱即无跨度可算），也不在强制实体清单 → 非实体 → **不能在火把上叠火把/贴火把**。
- **非整块承接**见 §3.2 矩阵：栅栏柱、墙柱等「小方形面」可立；玻璃板/铁栏杆只有**顶面**的窄条算特例可立（1.14.3 特批），**侧面**不行。
- 潜行：通则句「although some blocks require sneaking」——对着有交互的方块（如箱子）放火把需潜行（通用放置规则，非火把特有）。

### 3.5 Bedrock 差异

- Opacity/Placement 页头挂着 `{{cleanup|reason=Information about Bedrock Edition.}}`——**Bedrock 的逐块放置矩阵 wiki 尚未系统覆盖**，下列为可引证的零散差异：
  - BE History（Torch 页，已抓取）：v0.9.0 build 2 "Torches can now be placed on monster spawners."（**BE 可把火把放在刷怪笼上**，Java 矩阵中刷怪笼属"rendering only"类）。
  - Torch 页源码中**被注释停用**的放置草表（编辑注 "Inconsistent with other pages and the transparency documentation is still WIP"）给出过 JE/BE 分叉：铁砧、钟、玻璃板、铁栏杆的**顶面**均为 JE 可 / BE 不可；玻璃顶/侧两版均可。——**草表已停用，仅作线索，不作定论**；逐块 BE 口径整体「未能核实」。
  - BE 的墙/立由单 id 状态区分（§2.3），放置语义（点击面=附着面）同 Java。

---

## 4. 支承破坏（与「转依」小史）

（来源：[Torch](https://minecraft.wiki/w/Torch)，已抓取；水/熔岩部分与 [mc-daylight-torch-research.md](mc-daylight-torch-research.md) §3.4 一致，交叉引用）

- 脱落条件原文："A torch is removed and drops itself as an item if: Its attachment block is moved, removed, or destroyed; [[Water]] flows into its space; A [[piston]] pushes it or moves a block into its space."（译：依附方块被移动/移除/破坏、水流入其格、活塞推挤或推入方块时，火把移除并掉落为物品。）熔岩特例："When lava flows into a torch's space, it will be destroyed **without dropping anything**."（熔岩流入则直接销毁、无掉落。）
- **「转依」小史（对本项目特别有意思）**：indev 20100212-1210 原文："**Torches no longer snap to other potential valid attachments once their supporting block is removed.**"（译：支承块被移除后，火把不再自动吸附到其他可用附着面。）——即 **MC 在 2010 年初恰好实现过本项目现在的「转依」行为（失撑自动换面），两周后主动移除**，此后火把失撑一律直接掉落至今。重力方块彩蛋（同页）："Gravity-affected blocks like sand and gravel will not start falling if the space immediately beneath is occupied by a torch."（沙/砾石不会在火把上空开始下落——落在火把上会被「pop」成掉落物。）
- **本项目偏差登记**（按任务要求注明，不当问题）：本项目 wall 旗标薄块的支承口径是「底座实心 ∨ 四水平实心邻任一」——地面火把墙边挖底座会**转依**为墙火把存活。该有意偏差（理由：无方块元数据下保确定性重放红线 + 存档零迁移）已登记于 [block-lifecycle-design.md](block-lifecycle-design.md) 附录 B「火把附着面」行。取向不存档、由邻块现况按固定优先序派生（mesh-core/cascade 同判据）——这属于已拍板的既定设计，本报告不再展开。

---

## 5. 碰撞箱与选中轮廓

（来源：[Torch](https://minecraft.wiki/w/Torch)、[Hitbox](https://minecraft.wiki/w/Hitbox)，已抓取）

- **无碰撞箱（两版一致，一手）**：Torch 页原文 "Being non-solid, torches have no collision box."；Hitbox 页 noCollision 清单（Java）原文逐项在列 `*{{BlockLink|Torches}} **{{BlockLink|Torches|Wall Torches}}`（与草丛、按钮、拉杆等同类）。玩家/实体可直接穿行。
- **选中轮廓（interaction box）数值：未能核实**。三条一手依据：
  1. Hitbox 页开头原文："**Unlike with block models, all hitboxes' sizes are hard-coded and cannot be changed independently without modification.**"（与块模型不同，所有命中箱尺寸都是硬编码的。）——数值不在任何资产 JSON 里。
  2. 同页挂着 `{{Missing information|List of interaction boxes for the blocks.}}`（「缺方块交互箱清单」）——wiki 尚未整理各块轮廓箱数值。
  3. 轮廓箱的定义与可见性（原文）："The interaction box manages block interactions with players… When looking at the given block, the interaction box is shown as a **black outline** around the block's edges."（瞄准方块时的黑色描边框。）
- **替代：由模型推算的 AABB（标「推算」**，方法与数值见 §1.2/§2.2）：

| 形态 | AABB（像素） | 换算（格） | 备注 |
| --- | --- | --- | --- |
| 立式 | x,z ∈ [7,9]；y ∈ [0,10] | 中心 0.125×0.125 水平截面，高 0.625 | 即模型盒本身 |
| 墙式 facing=east | x ∈ [−0.92, 4.75]；y ∈ [3.12, 13.12]；z ∈ [7,9] | 入墙 0.058 / 探出 0.297 / 高 0.195–0.820 / 厚 0.125 | 旋转盒的外接盒；其余朝向对称旋转 |

  实际游戏的轮廓箱**不必等于模型 AABB**（可另行为点击体验放宽/收紧），且社区流传的源码口径（立式约 4×10×4、墙式约 5×10×5 的贴墙盒）无 wiki/资产一手原文可引——按约定不写入论断，仅在此记录「存在更宽于模型的源码口径」这一传闻线索，**以模型推算值为本报告基准**。
- 历史花絮（Torch 页图廊图注原文）："Floor torch old hitbox.png｜A torch from a Pocket Edition Alpha version with a **cross outline box**." / "Wall torch old hitbox.png｜Ditto…"——**Pocket Edition Alpha 时代火把用的是十字形轮廓箱**（渲染与命中都是十字面片，与本项目现状同款）。

---

## 6. 观感细节

### 6.1 粒子：火苗 = flame，烟 = smoke（一手）

（来源：[Particles](https://minecraft.wiki/w/Particles) 粒子类型表，已抓取）

- **flame**（JE `flame` / BE `basic_flame_particle`）原文："…**represents the flame of torches**, emitted by furnaces…"（译：……表现火把的火焰……）。
- **smoke**（JE `smoke` / BE `basic_smoke_particle`）原文（长列表节选）："…**floats off the top of torches and soul torches**, emitted by the end portal when active…"（译：从火把和灵魂火把的顶端飘出……）。
- **soul_fire_flame**（BE `blue_flame_particle`）原文："**Represents the flame of soul torches.**"（表现灵魂火把的火焰。）
- 顺带：铜火把（1.21.9+ 新方块）的火苗是 `copper_fire_flame`（"Represents the flame of copper torches."，绿火）；教育版开关下灵魂火把的火焰粒子是**白色**（Soul Torch 页 Trivia，bug MCPE-66946）。
- **结论**：MC 火把的「火苗」= 贴图上 2×2 火色像素（§1.3）+ 顶端持续 flame 粒子 + 顶上飘 smoke 粒子，三者叠出的观感。**火焰不是画在贴图上的大团像素。**

### 6.2 物品形态与手持渲染：平面 sprite

（来源：资产 @1.21.11，已抓取；[Model](https://minecraft.wiki/w/Model)，已抓取）

- `assets/minecraft/models/item/torch.json`（全文）：

  ```json
  {
    "parent": "minecraft:item/generated",
    "textures": {
      "layer0": "minecraft:block/torch"
    }
  }
  ```

  → 物品模型是 **`item/generated` 平面挤出 sprite**，贴图**直接复用块贴图** torch.png（含透明区）——这就是 GUI/掉落物/手持形态，**不是 3D 小盒**。这也解释了 §1.4：需要 alpha 处理的是这个 sprite，不是块模型。
- 1.21.4+ 的新式物品定义 `assets/minecraft/items/torch.json`（全文）：

  ```json
  {
    "model": {
      "type": "minecraft:model",
      "model": "minecraft:item/torch"
    }
  }
  ```

  仍指向同一个 item/torch 模型——只是定义层换壳，形态未变。
- 手持渲染：Model 页「Uses of models」表——手持物走 `firstperson_righthand` 等 display transform，平面 sprite 按 item 通道渲染（不尊重 `shade=false`，属 item 光照）。
- 历史：indev 20091223-1459 原文 "Torches currently render **3D in the inventory**."→ 十天后改 2D（"Torches now render 2D in the inventory."，dev=20091231-1856）——**物品栏 3D 火把是最初的临时实现，从未延续**。

### 6.3 遇水脱落 / 熔岩销毁

见 §4 原文（水流入→掉落、熔岩流入→销毁无掉落）；既有报告 [mc-daylight-torch-research.md](mc-daylight-torch-research.md) §3.4 已登记，不重查。

### 6.4 灵魂火把对照（与普通火把逐项 diff）

（来源：[Soul Torch](https://minecraft.wiki/w/Soul_Torch) 已抓取 + 资产解码/抓取；光级/配方引既有报告 §3.5）

| 项 | 火把 | 灵魂火把 | 出处 |
| --- | --- | --- | --- |
| 模型模板 | `template_torch` / `template_torch_wall` | **同款模板**（`soul_torch.json` = `{"parent": "minecraft:block/template_torch", "textures": {"torch": "minecraft:block/soul_torch"}}`，已抓取） | 资产 |
| 贴图 | 火焰 2×2 橙黄白（#ffd800 系） | **布局相同，火焰 2×2 青蓝**（#32e8ee / #01a7ac / #7bfafe / #ffffff），棍身同色 | 资产解码 |
| 粒子 | flame + smoke | soul_fire_flame（蓝）+ smoke（同页：烟同样从灵魂火把顶飘出） | Particles 页 |
| 光等级 | 14 | **10**（不融雪冰） | 既有报告 §3.5 |
| 放置/破坏 | 顶/侧、无天花板、失撑脱落 | **逐句同文**（"Soul torches can be placed on the top or the sides of most solid blocks…"） | Soul Torch 页 |
| Java id | `torch` + `wall_torch` | `soul_torch` + `soul_wall_torch`（BE 单 id 523） | Soul Torch 页 ID 表 |
| 方块标签 | `wall_post_override` | `piglin_repellents` + `wall_post_override`（**驱赶猪灵**，不含蛮兵） | Soul Torch 页 |
| Vibrant Visuals 点光 | #f39a5e（暖橙） | **#36d9e6**；BE 实验期色值变迁 #00FFFF → #75ebf2 → #36d9e6（1.20.40.20 → 1.21.120.20 → 26.0.23） | 两页 Light/History |

- 两页 Light 节同款注记（原文）："…the top part of torches emits colored point lighting with #f39a5e. This causes the bottom part of the torch to render a small square shadow."（点光挂在火把顶端，底段会投出一个小方形阴影——点光只挂「方块中心/顶部」的又一例证，见既有报告 §3.3 手持不发光论证。）
- 花絮（Torch 页 Trivia，附 GDC Vault 引用）：PBR 渲染下火把的块光为 **1262.665039 流明**（来源：GDC 2026 演讲 "Modernizing the rendering of Minecraft"）。

### 6.5 wall_post_override 标签

Torch 页 ID 表显示 `torch` 的唯一方块标签是 `wall_post_override`（灵魂火把同标签）。该标签的语义条目在 wiki「Block tag (Java Edition)」页（块标签属数据包侧，客户端资产仓库无 tags/block/ 目录，实抓 404）——本轮未抓取该巨型页，**语义未能核实**；它与火把自身的模型/贴墙渲染无直接关系，仅随 ID 表记录于此。

---

## 7. 对本项目的落地启示

> **性质声明**：本节是**推断性设计建议**，不是 §1–§6 那样的事实论断；目的是把 MC 的官方几何翻译成 my-craft-demo（体素世界、Three.js r128 经典 script 架构、目标用户 6 岁、无构建步骤、无方块元数据）能直接用的改动清单。**本报告只调研不改码**；「MC 实测数值」与「需本项目决策」分开列。

### 7.1 现状对照（差距定位）

| 维度 | 本项目现状（代码位置） | MC（一手数值） | 差距 |
| --- | --- | --- | --- |
| 几何 | `mesh-core.js` pushCross：十字交叉面片，对角面 (0.1,0.1)–(0.9,0.9)，**全格高**（观感靠贴图 alpha 裁切） | **2×10×2 px 实心小盒**（0.125×0.625×0.125 格，居中贴地） | 面片占满格 → 「明显方块」感的第一来源 |
| 贴图 | `texture-atlas.js` T_TORCH：棍 2px×9 行 + **火焰 4 行、最宽 4px**（可见总高 13 行 ≈ 0.81 格） | 棍 2px×8 行 + **火焰仅 2×2 px**（总高 10 行 = 0.625 格），大焰观感靠粒子 | 火焰画大 + 全高偏高 |
| 墙贴姿态 | pushCross `lean`：**顶边朝墙**平移 LEAN_TAN=0.3 剪切（十字片斜靠墙） | **底端贴墙（嵌墙 1px）+ 顶端向离墙方向倾 22.5°**；底边距格底 3.5px | **斜倚方向相反**、无基线抬高 |
| 命中 | `voxel.js` raycastVoxel 格级 DDA → **整格命中** | 无碰撞箱；选中轮廓远小于整格（精确数值 wiki 未载，模型 AABB 推算见 §5） | 本项目更容易点中 |
| 放置 | advPlaceCheck：顶面/侧面认实心支承，无天花板 | 顶面=小方形面、侧面=完整方形面、无天花板 | 语义已对齐 ✓ |
| 光照/掉落 | light:14、失撑脱落（转依为登记偏差） | 光 14、失撑脱落（无转依） | 已对齐/已登记 ✓ |

### 7.2 MC 实测数值（照抄即可的部分）

| 参数 | 值 | 出处 |
| --- | --- | --- |
| 立式火把盒 | 2×10×2 px，x/z ∈ [7,9] 居中，y ∈ [0,10] 贴地 | §1.1 资产 |
| 墙式倾角 | **22.5°**（tan ≈ 0.4142；等效剪切量 10·sin22.5°/16 ≈ **0.239 格**） | §2.1 资产 |
| 墙式底边 | 距格底 **3.5px = 0.219 格**；底面中心贴墙面，嵌入墙 1px | §2.1 资产 |
| 墙式顶端中心 | 离墙 3.83px = 0.239 格、高 12.74px = 0.796 格；整体探出 ≤ 4.75px = 0.30 格 | §2.2 推算 |
| 贴图火焰 | **2×2 px**（火把 #ffd800/#ff8f00/#ffff97/#ffffff；灵魂 #32e8ee/#01a7ac/#7bfafe/#ffffff） | §1.3 资产解码 |
| 贴图棍身 | 2px 宽 × 8 行；左列亮右列暗（x=7 亮系 #9f7f50…，x=8 暗系 #6d5736…） | §1.3 资产解码 |
| 顶/底端面 | 2×2 px：顶=火色（UV [7,6,9,8]）、底=深木色（UV [7,13,9,15]）；立式底面贴地可剔除（cullface） | §1.1 资产 |
| 渲染 | `shade:false` + `ambientocclusion:false`——不受方向光/AO，全亮 | §1.1 资产 |
| 粒子 | 顶端 flame 粒子 + 顶上飘 smoke 粒子 | §6.1 |
| 命中 | 无碰撞箱；轮廓箱小于整格（精确值未载） | §5 |

### 7.3 需本项目决策的取舍（建议清单）

1. **几何路线（核心决策）**：
   - **方案 A（观感最正，MC 同款）**：为火把新增小盒几何（如 `pushTorch`）：立式 6 面小盒 0.125×0.625×0.125 格居中贴地；墙式同盒贴墙面+旋转 22.5°（Three.js 里直接建旋转后的 8 顶点，或复用 BoxGeometry 加变换）。贴图映射照 §1.1 UV（侧面 2×10 条、顶/底 2×2）。方块感彻底消失——因为**它真的不再是方块**。
   - **方案 B（改动最小）**：保留 pushCross 十字面片，只重画 T_TORCH：可见棍条收窄到 2px 宽、总高 10 行（火焰 2×2 在顶），其余全透明。改动只在画师一处；代价是对角视角下两片交叉会显出「两根棍」（MC 是单根实心盒），且面片 45° 站位使棍宽视角相关。
   - 建议主线 A、B 作回退档（B 可先行验证贴图观感）。**两条路线的贴图/粒子改动相同**。
2. **墙贴姿态反转（两案通用）**：现 lean 是「顶边朝墙」；MC 是「**底边贴墙、顶边离墙**」。若沿用剪切近似：底边平移到墙面所在格边（如墙在 +x，则底边 x=1、顶边 x=1−0.239），剪切量取 **LEAN_TAN≈0.24**（=10·sin22.5°/16，现行 0.3 略大）且方向取反；若走方案 A 则直接真旋转 22.5°，无需剪切参数（MC 在 14w07a 正是这么改的，§2.2）。取向仍从邻块派生不存档（附录 B 既定口径，不变）。
3. **墙式基线抬高**：底边（支点）距格底 **0.219 格**（可简化 0.22）；立式保持贴地 y=0。
4. **贴图重画**（T_TORCH 画师）：棍 2×8、火焰 2×2（色值可照抄 §7.2 官方 hex 或就近取本项目色板）；火焰刻意画小——**火苗观感交给粒子**。灵魂火把若未来引入：同布局换青蓝火焰即可。
5. **粒子（新增，小成本大观感）**：火把顶端持续一个小火苗粒子（橙色、贴着顶端）+ 低频上飘烟粒子（灰、从顶端上方生成）。这正是 MC「细贴片却很生动」的秘诀（§6.1）。
6. **命中箱（有意偏离候选）**：MC 用远小于整格的轮廓箱；本项目整格命中（raycastVoxel 格级 DDA）。**对 6 岁用户整格更好点中，建议保留为有意偏离**（按惯例在设计稿登记）；代价是火把格会挡住穿格射线（MC 的小箱允许点到火把后面的方块），本项目场景里影响很小。若日后要精确命中，需在 DDA 命中后再做 ray-box 精测（盒取 §5 推算 AABB），改动面较大，不建议本期做。
7. **无需改动的项**：放置判据（顶/侧、无天花板）已与 MC 语义对齐；light:14、失撑脱落/转依（登记偏差）、`shade` 等价物（pushCross 顶点光取自身格 block=14，夜间自亮）均已就位；物品图标走图标工坊像素画，与 MC 平面 sprite 语义一致。
8. **不建议照抄的项**：JE/BE 双 id 拆分（本项目单 id + wall 旗标派生已定案）；逐块放置例外矩阵（本项目的方块种类少，顶面=实心、侧面=实心的简化判据已覆盖主场景）。

### 7.4 参数速查（实现时直接抄）

| 参数 | 建议值 | 性质 |
| --- | --- | --- |
| 立式火把盒 | 0.125 × 0.625 × 0.125 格，居中贴地 | MC 实测（§1.1） |
| 墙式倾角 | 22.5°（真旋转）或剪切量 0.24 格 | MC 实测（§2.1）/ 等价换算 |
| 墙式底边高度 | 0.219 格（简化 0.22） | MC 实测（§2.1） |
| 墙式底边水平位置 | 贴墙面（嵌墙 1px 可省，直接贴边即可） | MC 实测（§2.1） |
| 贴图可见棍条 | 2px 宽 × 10 行（火焰 2×2 顶置） | MC 实测（§1.3） |
| 火焰贴图色 | #ffd800/#ff8f00/#ffff97/#ffffff（近端两级） | MC 实测（§1.3） |
| 粒子 | 顶点 flame（橙）+ 上飘 smoke（灰），1–2 个/秒量级 | MC 行为（§6.1），频率自定 |
| 命中箱 | 整格（现状保留，登记有意偏离） | 本项目决策（§7.3-6） |
| LEAN_TAN 去留 | 方案 A 下删除；方案 B 下改 0.24 且方向反转 | 本项目决策 |

---

## 附：未能核实清单（2026-10-28 终态）

1. **选中轮廓箱（interaction box）精确数值**：wiki 无刊载——Hitbox 页原文「all hitboxes' sizes are hard-coded」（硬编码）+ 页面挂 `Missing information|List of interaction boxes for the blocks.`；模型推算 AABB（§5）作为替代基准。已尝试：Torch/Hitbox/Opacity 三页 raw 全文检索、模型/方块状态资产全查（无 shape 字段）。社区源码口径（立式 4×10×4、墙式 5×10×5）无一手出处，未采信为论断。
2. **渲染层 cutout 的一手原文**：1.21.11 与 26.1 模型 JSON 均无 `render_type` 字段（对照组 leaves.json 亦无）；Model 页现行格式文档无该字段、History 只记 26.1 snap7 起块模型才支持 cutout/半透明纹理。结论以结构性论证呈现（块模型只采实心像素、物品 sprite 才需 alpha），「cutout」一词未作为事实写入。
3. **Bedrock 墙火把几何数值**：官方 bedrock-samples 的 `resource_pack/models/blocks/` 仅 4 个 geo 文件（床/蘑菇架），火把无数据驱动几何（引擎硬编码）；blocks.json 火把条目仅 sound/textures。wiki 图廊分列 JE/BE gif 证明渲染有差异，但无文字数值。
4. **wall_post_override 标签语义**：块标签在数据包侧（客户端资产仓库 `tags/block/wall_post_override.json` 实抓 404），语义条目在「Block tag (Java Edition)」巨型页，本轮未抓；与模型/贴墙渲染无直接关系，仅随 Torch 页 ID 表记录标签名。
5. **Bedrock 逐块放置差异**：Opacity/Placement 页挂 `{{cleanup|reason=Information about Bedrock Edition.}}`；Torch 页源码中被注释停用的放置草表（铁砧/钟/玻璃板/铁栏杆顶面 JE 可 BE 不可）因「与其他页面不一致」被编辑停用，仅作线索。已核实的行为级差异只有：BE 可放刷怪笼（v0.9.0 build 2）、无 bottom 状态（不能挂天花板）。
6. **底（半）台阶顶面可否立火把**：放置矩阵无 Slabs 行（页面 WIP 缺行）；按「顶面=小方形面」判据（底台阶顶为完整 16×16 方形面）推断为可放，12w25a 原文只明说倒置台阶/楼梯。标注为推断，不影响本项目（无台阶方块）。

（本报告为一号文件交付：仅新增 `docs/mc-torch-model-research.md`，不改动任何代码/测试/其他文档。）
