# Minecraft「门」与「窗（玻璃板）」调研笔记

> 本文件由调研代理（research subagent）生成，日期：2026-10-27。
> 事实部分均取自一手来源：minecraft.wiki（Minecraft 官方 wiki）、misode/mcmeta（镜像 Mojang 官方版本数据 JSON 的知名仓库）、InventivetalentDev/minecraft-assets（镜像原版游戏资产文件的仓库）。每条事实后附 `[来源](URL)`；`## 对本游戏的启示` 一节为调研代理的推断，不是 Minecraft 事实。

## 结论速览

| 物品 | 合成配方（3×3 格） | 一次产出 | 形状要点 |
| --- | --- | --- | --- |
| Oak Door（橡木门） | 6 块同种 Oak Planks，摆成 2 列 × 3 行（`["##","##","##"]`） | 3 扇门 | 占 2 格高、厚 3/16 格（16px 中约 3px）；上下两张贴图；开关 = 绕铰链转 90° |
| Glass Pane（玻璃板，即「窗」） | 6 块 Glass，摆成 3 列 × 2 行（`["###","###"]`） | 16 块玻璃板 | 厚 2px（16px 中占 x=7~9）、全格高；随邻居自动连接成平线/转角/T 形/十字 |
| Glass（玻璃块，玻璃板的前置） | Sand 或 Red Sand + 任意燃料，熔炼（Smelting） | 1 块玻璃 | 完整透明方块 |

## 门（以 Oak Door 为代表）

### 合成配方

- 所有门的做法一致：「All doors are made the same, with 6 of the same blocks or items making 3 doors of the type」——6 个相同材料合成 3 扇同类型的门。[来源](https://minecraft.wiki/w/Door)
- Oak Door 的原版配方 JSON（Mojang 官方数据镜像）：shaped 配方，pattern 为 `["##", "##", "##"]`（2 列 × 3 行），key `#` = `minecraft:oak_planks`，结果 `minecraft:oak_door` × 3，配方 group 为 `wooden_door`。[来源](https://github.com/misode/mcmeta/blob/data/data/minecraft/recipe/oak_door.json)
- 也就是说：在 3×3 合成格里，把 6 块木板摆成相邻的两竖列（每列 3 块），空着第三列。
- 不同木种（Spruce、Birch、Jungle、Acacia、Dark Oak、Mangrove、Cherry、Pale Oak、Bamboo、Crimson、Warped 等）配方形状完全相同，只是把「匹配的同种 Planks」换掉；Iron Ingot、Copper Ingot 也用同样的 2×3 摆法做 Iron Door / Copper Door。[来源](https://minecraft.wiki/w/Door)

### 形状与占位

- 门占**两个方块空间**（放置时下半格对准所指望的位置，上半格向上延伸一格），下半格下方必须是完整实心方块面，否则放不下。[来源](https://minecraft.wiki/w/Door)
- 门厚 **0.1875 格（3⁄16）**（Bedrock 版为 0.1825），其余空间可以自由通行。以 16px/格计即约 **3 像素厚**。[来源](https://minecraft.wiki/w/Door)
- 放置时门贴在「离玩家最近的方块侧边」上（玩家自身位置放门时贴在身后）。[来源](https://minecraft.wiki/w/Door)
- 关门时门板贴着格边；开门时「立即改变朝向，不影响它扫过的空间」（无扫击体积动画，直接切换姿态）。[来源](https://minecraft.wiki/w/Wooden_Door)

### 方块状态与铰链机制

- 门由 `facing`（朝向）、`half`（lower/upper，门是两个独立方块，上半依附下半）、`hinge`（left/right 铰链侧）、`open`（布尔）四个方块状态描述。[来源](https://minecraft.wiki/w/Door)
- 原版 blockstate JSON 中，每种「铰链侧 × 开关」对应不同模型：`oak_door_bottom_left` / `oak_door_bottom_right` / `oak_door_top_left` / `oak_door_top_right`，以及 `_open` 变体（通过对模型加 y 轴 90°/180°/270° 旋转表现门扇转开的姿态）。[来源](https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/blockstates/oak_door.json)
- 铰链侧自动判定规则：相邻有同种门且把手相对 → 组成双开门（铰链相反）；否则铰链放在相邻实心方块面更多的一侧；Java 版在无法判定时放在更接近玩家视线的一侧。[来源](https://minecraft.wiki/w/Door)

### 贴图布局

- 门模型由上下两部分组成，各用一张贴图：Oak Door 下半模型 `oak_door_bottom_left.json` 引用 `minecraft:block/oak_door_bottom` 与 `minecraft:block/oak_door_top` 两张贴图（分别用于门扇下半和上半）。[来源](https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/models/block/oak_door_bottom_left.json)
- Minecraft 方块/物品贴图通常为 **16×16 像素**，默认资源包的全部方块贴图都是 16×16。[来源](https://minecraft.wiki/w/Texture) [来源](https://minecraft.wiki/w/Texture_Pack)
- 即一扇门 = 两张 16×16 贴图（door_bottom + door_top），各覆盖一个方块格。

### 交互行为

- 木门可被**徒手或任意工具**破坏（斧头最快），硬度 3；破坏后**掉落自身**（下方支撑方块被移除时也掉落）。[来源](https://minecraft.wiki/w/Wooden_Door)
- 木门按「使用物品/放置方块」键（默认右键）即可开关；也可由红石信号开关；门被红石控制时玩家和生物仍可手动开闭。[来源](https://minecraft.wiki/w/Wooden_Door)
- 村民（Villager）会开、关木门，但不能开活板门、栅栏门和铁门。[来源](https://minecraft.wiki/w/Villager)
- 用 `/setblock` 只放半扇门时下半仍工作但有图形问题、上半完全失效——上半依附于下半；破坏时上半不掉落、下半掉一扇正常的门。[来源](https://minecraft.wiki/w/Door)
- 木门可作熔炉燃料，每扇烧炼 1 个物品（下界木门与金属门不行）。[来源](https://minecraft.wiki/w/Door)

## 窗（玻璃板 Glass Pane）

Minecraft 没有「窗」物品——**英文 wiki 的 Glass Pane 页面明确写着「"Window" redirects here」**（"Window" 重定向到玻璃板），玻璃板就是游戏里承担窗户功能的方块。[来源](https://minecraft.wiki/w/Glass_Pane)

### 配方链：沙子 → 玻璃 → 玻璃板

1. **熔炼玻璃**：Sand 或 Red Sand + 任意燃料，放入熔炉熔炼得到 Glass（每个沙子产出 1 块玻璃）。[来源](https://minecraft.wiki/w/Glass)
2. **合成玻璃板**：原版配方 JSON——shaped，pattern `["###", "###"]`（3 列 × 2 行），key `#` = `minecraft:glass`，结果 `minecraft:glass_pane` × **16**。[来源](https://github.com/misode/mcmeta/blob/data/data/minecraft/recipe/glass_pane.json)
3. wiki 文字佐证：「six glass blocks can be crafted into sixteen glass panes」（6 块玻璃合成 16 块玻璃板），平均每块玻璃出 2⅔ 块玻璃板，比直接用玻璃块砌窗省料约 267%。[来源](https://minecraft.wiki/w/Glass_Pane)

### 游戏若没有熔炉，玻璃还有别的来路（查证结果）

- **村民交易**：图书管理员（Librarian，Journeyman 级）会用绿宝石收 1 颗、给玩家 4 块 Glass（Java 概率 67% / Bedrock 50%，库存 12 次）。[来源](https://minecraft.wiki/w/Glass)
- **自然生成**：玻璃出现在林地府邸的秘密房间和远古城市中；玻璃板则是村庄、林地府邸、远古城市的现成窗户。[来源](https://minecraft.wiki/w/Glass) [来源](https://minecraft.wiki/w/Glass_Pane)
- 玻璃本身不可合成（只能熔炼/交易/拆环境），原版没有「不经过熔炼直接合成玻璃」的配方。[来源](https://minecraft.wiki/w/Glass)

### 形状与连接机制

- 玻璃板**永不水平放置**，永远是竖直面；水平「玻璃面」只能用玻璃块拼。[来源](https://minecraft.wiki/w/Glass_Pane)
- 四周无邻接时，玻璃板呈现为一个 **2×2 像素**的细小中柱；有邻接方块/玻璃板时，自动变成平板、转角（Curve）、T 形或十字形。碰撞箱与可见形状一致。[来源](https://minecraft.wiki/w/Glass_Pane)
- 连接用 4 个布尔方块状态表达：`east` / `north` / `south` / `west`（为 true 表示从中柱向该方向延伸）。[来源](https://minecraft.wiki/w/Glass_Pane)
- 原版模型几何（`template_glass_pane_post.json`）：中柱从 `[7,0,7]` 到 `[9,16,9]`，即**2px 厚、全格 16px 高**的细柱；侧向部件（`template_glass_pane_side.json`）从 `[7,0,0]` 到 `[9,16,7]`，同样是 2px 厚（x 方向 7→9），从中柱延伸到格边。[来源](https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/models/block/template_glass_pane_post.json) [来源](https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/models/block/template_glass_pane_side.json)

### 贴图特点

- 玻璃板模型用**两张贴图**拼成：边缘（edge）用 `minecraft:block/glass_pane_top`，板面（pane）用 `minecraft:block/glass`——由 `glass_pane_post.json` 的 textures 字段直接可见。[来源](https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/models/block/glass_pane_post.json)
- wiki 更新记录也印证这一结构：「玻璃贴图更新改变了玻璃板的外观，但边缘贴图保持不变」（edge texture 单独存在）。[来源](https://minecraft.wiki/w/Glass_Pane)
- 玻璃类贴图的视觉特征是：不透明的浅色边框 + 大面积透明中间（玻璃/玻璃板infobox均为 Transparent: Yes），这是 Minecraft「窗」看起来有窗框的原因。[来源](https://minecraft.wiki/w/Glass) [来源](https://minecraft.wiki/w/Glass_Pane)

### 交互行为

- 徒手（或任何工具）可打碎玻璃板；**没有精准采集附魔时打碎什么也不掉**，有精准采集才掉自身。玻璃块同理。[来源](https://minecraft.wiki/w/Glass_Pane) [来源](https://minecraft.wiki/w/Glass)
- 硬度 0.3，无指定工具，用什么都一样快。[来源](https://minecraft.wiki/w/Glass_Pane)

## 对本游戏的启示

> 本节是调研代理基于以上 Minecraft 事实，对「把门/窗搬进一个简易体素游戏（Three.js r128、无构建步骤）」的推断与建议，**不是** Minecraft 事实本身。

- **配方可以直接照搬 2D 部分**：门「6 木板 2 列 × 3 行 → 3 扇」、玻璃板「6 玻璃 3 列 × 2 行 → 16 块」都是纯 shaped 配方，映射到 2D 合成格零成本；产出倍率（3 扇 / 16 块）建议保留，玻璃板 16 倍产出本身就是「窗比墙省料」的直观教学点。
- **没有熔炉时的玻璃来源是设计决策而非事实约束**：原版玻璃必须熔炼（或交易/拆结构）。给 6 岁孩子的游戏若想跳过熔炉，可选简化：a) 直接用「沙子 ×N → 玻璃」合成替代熔炼；b) 更激进地省掉玻璃块层，改为「木板/沙子直接合玻璃板」。建议在游戏内保持「沙→玻璃→玻璃板」的两步感，但把熔炼换成合成。
- **门的 3D 结构建议**：照搬「2 格高 + 3px 薄板 + 贴格边」最省事——用一个单元格边缘的薄 Box（厚约 3/16 格）加上方第二格的拷贝；开关做成绕铰链竖轴旋转 90°（原版的 `_open` 本质就是同一模型加 y 轴旋转）。铰链左右判定可先不做自动推断，固定左铰链即可（孩子感知不到差异）。
- **门的贴图照搬两张制**：上半/下半各一张 16×16，拼接处自然形成门的分节；本项目若已有 16×16 方块贴图管线，门不需要新管线。
- **玻璃板照搬「薄面 + 邻接连接」**：核心数据结构就是 4 个布尔（东西南北连接），生成 mesh 时按邻居查表拼 2px 厚的短面片即可；无邻居时退化成 2×2 小柱。这是原版机制，实现简单且视觉效果大幅优于「一整块半透明方块」。
- **破坏掉落建议偏离原版**：原版玻璃板无精准采集不掉落（对幼儿游戏偏惩罚性），建议直接掉落自身；门掉落自身与原版一致。
- ** villagers 开门这类 NPC 行为**可暂缓，一句话事实备查：原版村民会开木门、不会开铁门。

## 引用来源清单

| 来源 | 类型 | URL |
| --- | --- | --- |
| Door — Minecraft Wiki | 官方 wiki | https://minecraft.wiki/w/Door |
| Wooden Door — Minecraft Wiki | 官方 wiki | https://minecraft.wiki/w/Wooden_Door |
| Glass Pane — Minecraft Wiki | 官方 wiki | https://minecraft.wiki/w/Glass_Pane |
| Glass — Minecraft Wiki | 官方 wiki | https://minecraft.wiki/w/Glass |
| Texture — Minecraft Wiki | 官方 wiki | https://minecraft.wiki/w/Texture |
| Texture Pack — Minecraft Wiki | 官方 wiki | https://minecraft.wiki/w/Texture_Pack |
| Villager — Minecraft Wiki | 官方 wiki | https://minecraft.wiki/w/Villager |
| oak_door.json（配方数据镜像） | 官方数据镜像 | https://github.com/misode/mcmeta/blob/data/data/minecraft/recipe/oak_door.json |
| glass_pane.json（配方数据镜像） | 官方数据镜像 | https://github.com/misode/mcmeta/blob/data/data/minecraft/recipe/glass_pane.json |
| oak_door.json（blockstate） | 原版资产镜像 | https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/blockstates/oak_door.json |
| oak_door_bottom_left.json（模型） | 原版资产镜像 | https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/models/block/oak_door_bottom_left.json |
| glass_pane_post.json（模型） | 原版资产镜像 | https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/models/block/glass_pane_post.json |
| template_glass_pane_post.json（模型模板） | 原版资产镜像 | https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/models/block/template_glass_pane_post.json |
| template_glass_pane_side.json（模型模板） | 原版资产镜像 | https://github.com/InventivetalentDev/minecraft-assets/blob/1.21.4/assets/minecraft/models/block/template_glass_pane_side.json |
