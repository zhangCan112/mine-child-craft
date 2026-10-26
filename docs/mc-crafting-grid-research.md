# Minecraft（Java 版）九宫格合成机制与逐配方图案调研报告

> **调研说明**
> - 调研日期：2026-10-26。全部结论来自第一手权威来源 **Minecraft Wiki**（[minecraft.wiki](https://minecraft.wiki)）的词条页（直读页面渲染稿，配方图案逐格取自页面内嵌的配方图形），未使用任何二手博客。
> - 版本口径：Wiki 当前反映最新 Java 版（26.x 分支，与[既有调研稿](./minecraft-item-crafting-research.md)一致）。本文涉及的九宫格匹配机制（平移、镜像、无序、tag）自 1.13"扁平化"配方数据包化起稳定；版本相关处单独标注。
> - **不重复既有稿已覆盖的内容**：物品系统、堆叠、燃料、矿物分布、烧炼、配方 JSON 字段概览见 [minecraft-item-crafting-research.md](./minecraft-item-crafting-research.md)（下称"既有稿"）。本文只做增量：**九宫格机制细节 + 我们全部 32 条配方的逐条图案查证**。
> - 本文引用的英文原文均为词条原句，供实现时直接对齐口径。

---

## 1. 合成格机制：2×2 随身格 vs 3×3 工作台

### 1.1 两格的确切关系与"≤2×2"判定标准

- 生存/冒险模式玩家的**物品栏界面自带 2×2 合成格**，判定标准是**配方图案"至多 2×2"**。Wiki 原文："Small crafting recipes that are **at most 2×2** can be made there, including wooden planks, sticks, crafting tables, and torches."（来源：[Crafting § Manual crafting – Minecraft Wiki](https://minecraft.wiki/w/Crafting)）。
- **工作台**：放置并打开后提供 **3×3 合成格**，可合成游戏中全部配方；**2×2 配方也能在 3×3 里完成**。Wiki 原文："This brings up an interface with a larger 3×3 crafting grid in which the player can use to craft any crafting recipe in the game. Recipes fitting the 2×2 grid can also be crafted in the crafting table's 3×3 grid."（来源：同上）。
- **2×2 不需要走近/打开任何方块**——它就是物品栏界面的一部分；Java 版创造/旁观模式的物品栏界面没有这块 2×2（来源：[Crafting § Manual crafting](https://minecraft.wiki/w/Crafting)；[Inventory – Minecraft Wiki](https://minecraft.wiki/w/Inventory)："This is not available in Creative or Spectator mode in Java Edition."）。
- 配方书联动口径：**"2×2 尺寸"的配方才会出现在物品栏界面的配方书里，其余配方只在工作台界面出现**。Wiki 原文："Recipes appear in the inventory's recipe book if they are 2×2 in size, otherwise they will only appear if the player is using a crafting table."（来源：[Recipe (Java Edition) § Usage – Minecraft Wiki](https://minecraft.wiki/w/Recipe_(Java_Edition))）。

### 1.2 判定标准落到数据层

- 有序配方的图案尺寸 = JSON `pattern` 的行列数（每行 ≤3 字符、所有行等宽、空格=空位；来源：[Recipe (Java Edition) § crafting_shaped](https://minecraft.wiki/w/Recipe_(Java_Edition))）。**配方可随身 2×2 完成 ⇔ 图案宽 ≤2 且高 ≤2**；无序配方 ⇔ 材料数 ≤4（2×2 只有 4 格）。

### 1.3 我们现有 32 条配方的正典归属

按"图案尺寸 ≤2×2"逐条核对（图案依据见 §3）：

| 配方（我们 RECIPES id） | 图案尺寸 | 正典属 2×2 随身格？ | 我们现 station | 是否一致 |
| --- | --- | --- | --- | --- |
| planks | 1×1 | ✅（Wiki 点名的例子） | hand | ✅ |
| stick | 1×2 | ✅（Wiki 点名的例子） | hand | ✅ |
| craft_table | 2×2 | ✅（Wiki 点名的例子） | hand | ✅ |
| torch | 1×2 | ✅（Wiki 点名的例子） | hand | ✅ |
| 16 条工具（镐/斧/剑/锹 × 4 阶） | 3×3 / 2×3 / 1×3 | ❌（高或宽 >2） | table | ✅ |
| furnace / chest | 3×3 | ❌ | table | ✅ |
| bed | 3×2 | ❌（宽 3） | table | ✅ |
| lantern / golden_apple / tnt / bow_item | 3×3 | ❌ | table | ✅ |
| bread | 3×1 | ❌（宽 3） | table | ✅ |
| **stone_bricks** | 2×2 | ✅ | table | ⚠️ 正典可随身 |
| **bricks** | 2×2 | ✅ | table | ⚠️ 正典可随身 |
| **shears** | 2×2（对角） | ✅ | table | ⚠️ 正典可随身 |
| **bone_meal** | 1×1 | ✅ | table | ⚠️ 正典可随身 |

（图案依据与来源见 §3；2×2 判定标准来源见 §1.1。）

**结论**：我们现有 hand/table 双站点与正典方向一致，但有 **4 条（stone_bricks / bricks / shears / bone_meal）在正典口径下属于 2×2 随身可做**，现标 'table'。是迁回 hand 还是保留工作台教学门槛，属设计决策（见 §7）。

---

## 2. 有序合成（shaped）的匹配语义 — 可直接写成代码

以下口径除特别标注外，均出自 [Crafting § Manual crafting – Minecraft Wiki](https://minecraft.wiki/w/Crafting) 与 [Recipe (Java Edition)](https://minecraft.wiki/w/Recipe_(Java_Edition))。

### 2.1 平移（图案可在格内任意平移，空位可在四周）

- Wiki 原文："Ingredients in shaped recipes **can be moved up, down, left, or right**."——图案**不必顶格在左上角**，整体在合成格内任意平移后仍匹配；图案四周的空格不影响。
- Wiki 给的例子："a 3×1 recipe, such as bread, can be made using the **top, middle, or bottom row** of the 3×3 grid"（面包一排小麦可放 3×3 的任意一行）。
- 代码口径：把「玩家摆放」和「配方图案」都**裁剪掉全空的外围行/列**后逐格比较即可（等价于尝试所有平移）。

### 2.2 镜像（匹配器自动水平翻转；不是注册双份配方文件）

- Wiki 原文："They can also be **flipped horizontally, but not vertically**."——水平镜像自动尝试匹配，垂直翻转不匹配。
- 例子（同页）："a bow may be made with the strings placed on the **left instead of on the right**"（弓的弦列可左可右）。
- 斧页有逐条原文："…axes are crafted using 2 sticks and 3 identical units of tool material. **This recipe can be flipped horizontally.**"（来源：[Axe § Crafting – Minecraft Wiki](https://minecraft.wiki/w/Axe)）。
- **归属判定：镜像是匹配期的行为，不是数据层为左右手版各注册一个配方文件**。依据：① 上引 Crafting 页把"可水平翻转"表述为一切有序配方的通则（而非个别配方注册了双份）；② 原版每个配方只存一个 JSON 文件（"Vanilla recipes are stored as separate JSON files in the data/minecraft/recipe folder"，来源：[Recipe (Java Edition) § JSON format](https://minecraft.wiki/w/Recipe_(Java_Edition))），斧/弓等只有一个图案却两个方向都能摆。**原版不存在需要"镜像版配方文件"的特例**；我们也不必为斧/弓/剪刀另存镜像数据。
- 代码口径：匹配时若原图案不中，把图案**每行逆序**（水平镜像）再试一次；不做垂直翻转。

### 2.3 图案之外的格子必须为空

- Crafting 页定义有序配方为材料须处在"**correct relative positions**"（正确的相对位置）；Recipe 页定义 `pattern` 就是配方的全部占用格（空格=空位）。两者合起来：**摆放中图案之外不能有多余物品，否则不匹配任何配方**。（此条为两条原文的定义性推论，Wiki 无单独成句——见 §9 悬置。）

### 2.4 材料规约：tag 与候选数组（火把 = 煤/木炭）

- Recipe 页对 `key`/`ingredients` 的规定："Can be one of an **ID**, a **tag with #**, or an **array containing IDs**."——一格的材料规约可以是单个物品、一个 tag、或一个物品数组，三者都是"任一满足即可"。
- 火把的正典写法：Torch 页配方材料列为 "**Coal or Charcoal** + Stick → 4"（来源：[Torch § Crafting – Minecraft Wiki](https://minecraft.wiki/w/Torch)）——即"煤或木炭"以候选集合（tag/数组）挂在同一个图案符号上，而不是两条配方。我们 `cost {fuel: [['coal','charcoal'],1], …}` 的任选语义与正典同构，迁移到九宫格时把候选数组直接放进格子规约即可。
- 同符号多格**逐格独立匹配**（每格各自满足规约即可）。注：斧页行文"3 identical units of tool material"（3 件同种材料）是描述性说法；正典数据层同一符号共用同一 tag 键、逐格独立判定（MC 里木板混用不同树种可合成工具）。我们只有单一 `planks` id，此差异无影响。

### 2.5 无序合成（shapeless）的匹配语义

- 定义："Some recipes don't require their ingredients to be arranged in a specific way… players may craft a fermented spider eye by placing its ingredients **anywhere within the grid**."（来源：[Crafting § Manual crafting](https://minecraft.wiki/w/Crafting)）。
- 数据约束："The ingredients list must have **at least one and at most nine entries**."（来源：[Recipe (Java Edition) § crafting_shapeless](https://minecraft.wiki/w/Recipe_(Java_Edition))）。
- 确切口径：**格子里非空物品构成的多重集合必须恰好等于配方材料表**——多一件不行（多一件则摆放入不了任何无序配方的集合），空格数量无所谓（位置任意）。"恰好相等"同样是定义性推论（材料表就是配方的全部），Wiki 无单独成句——见 §9。

### 2.6 多个配方同时匹配同一摆放时的优先级

- **Wiki 未记录任何优先级规则**（Crafting / Recipe 两页均无 priority/conflict 相关表述；见 §9 悬置）。原版通过图案互不重叠回避了该问题。工程建议：按配方表数组序取第一个匹配（确定性、可单测），并保证我们的 32 条图案两两不冲突（§7 核查结论：不冲突）。

### 2.7 消耗语义与连续合成

- **每次合成、每个占用格扣 1 件**：Wiki 词条未单独成句（见 §9 悬置），但这是与"图案匹配"唯一自洽的扣减口径，且与下条 Shift 行为相容。
- **Shift 点产出槽 = 按材料最大量连续合成**：Inventory 页 History（Beta 1.6）："Shift + clicking while crafting **makes the maximum amount possible** of that item and m[oves it to the inventory]"（来源：[Inventory § History – Minecraft Wiki](https://minecraft.wiki/w/Inventory)）。
- 配方书侧的连做口径（Bedrock 版配方书）："pressing Shift **crafts all items based on how many materials the player has** in their inventory"（来源：[Recipe book § Bedrock Edition – Minecraft Wiki](https://minecraft.wiki/w/Recipe_Book)）。

### 2.8 产出槽行为

- Wiki 词条对"摆对后产出槽出现预览、点产出槽才扣料、取出产物后格内材料保留"没有逐字成句的描述（见 §9 悬置）；可查证的相关事实是：
  - 产出槽是合成界面的固定组成部分（Crafting Table GUI 截图与说明，来源：[Crafting § Manual crafting](https://minecraft.wiki/w/Crafting)）；
  - 取走产物后**材料仍留在格内**（因此才有 §2.7 的连做与 §6 的"关界面退料"），与上述 Inventory/Crafting 页记录一致。
- 工程口径（与全部已引 Wiki 记录相容）：**摆对 → 产出槽出现预览；点击产出槽 → 每个占用格扣 1 件、产出进背包；材料剩余部分留在格内**。

---

## 3. 逐配方图案数据表（32 条全量查证）

> 图例：`M` = 该阶工具材料；`S` = 木棍（stick）；`·` = 空格。各图按图案的最小包围盒绘制（部分按 3×3 视图居中排版），实际摆放**可整体平移**（§2.1），2×2 图案在 3×3 台上同样成立。"材料 id"列用**我们项目的物品 id**（MC 对应关系在括注中说明）。

### 3.1 手搓级 4 条

| 配方 id | 图案 | 尺寸 | 类型 | 产物 | ≤2×2 | 镜像 | 材料（我们 id） | 来源 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| planks | 3.1.1 | 1×1 | 有序* | 木板 ×4 | ✅ | — | log | [Planks](https://minecraft.wiki/w/Planks) |
| stick | 3.1.2 | 1×2 | 有序 | 木棍 ×4 | ✅ | — | planks ×2 | [Stick](https://minecraft.wiki/w/Stick) |
| craft_table | 3.1.3 | 2×2 | 有序 | 工作台 ×1 | ✅ | — | planks ×4 | [Crafting Table](https://minecraft.wiki/w/Crafting_Table) |
| torch | 3.1.4 | 1×2 | 有序 | 火把 ×4 | ✅ | — | `['coal','charcoal']` ×1 + stick ×1 | [Torch](https://minecraft.wiki/w/Torch) |

\* 单材料配方（planks/bone_meal/铁粒）在 Wiki 图形上不标 shapeless 记号；单格图案可平移到任意格，语义与无序等价，实现上任取其一。

```
3.1.1 planks          3.1.2 stick          3.1.3 craft_table    3.1.4 torch
· · ·                 · · ·                · · ·                · · ·
· 原·                 · 板·                板 板 ·               · 煤·
· · ·                 · 板·                板 板 ·               · 棍·
```

（planks：1 原木 → 4 木板，MC 里原木种类对应产出同树种木板，来源：[Planks § Crafting](https://minecraft.wiki/w/Planks)；stick：2 木板竖排 → 4 木棍，来源：[Stick § Crafting](https://minecraft.wiki/w/Stick)；craft_table：4 木板填满 2×2 → 1 工作台，"filling the 2×2 grid with any type of wooden planks"，来源：[Crafting § Manual crafting](https://minecraft.wiki/w/Crafting)；torch：煤/木炭在上、木棍在下 → 4 火把，来源：[Torch § Crafting](https://minecraft.wiki/w/Torch)。）

### 3.2 工具 16 条（4 个形状模板 × 4 材质阶）

形状模板（对 4 阶通用；镐页原文 "crafted using two sticks and three of the tier's material"，斧页原文 "2 sticks and 3 identical units of tool material. This recipe can be flipped horizontally."，剑页原文 "crafted using a stick and two of the tier's material"；来源：[Pickaxe](https://minecraft.wiki/w/Pickaxe) · [Axe](https://minecraft.wiki/w/Axe) · [Sword](https://minecraft.wiki/w/Sword) · [Shovel](https://minecraft.wiki/w/Shovel)）：

```
镐 pickaxe (3×3)      斧 axe (2×3, 可镜像)  剑 sword (1×3)        锹 shovel (1×3)
M M M                 M M ·                 · M ·                 · M ·
· S ·                 M S ·                 · M ·                 · S ·
· S ·                 · S ·                 · S ·                 · S ·
```

| 配方 id（×4 阶） | M = | 图案 | 产物 | ≤2×2 | 镜像 | 来源 |
| --- | --- | --- | --- | --- | --- | --- |
| pick_wood / pick_stone / pick_iron / pick_diamond | planks / cobble / iron_ingot / diamond | 镐 3×3 | 1 件 | ❌ | — | [Pickaxe § Crafting](https://minecraft.wiki/w/Pickaxe) |
| axe_wood / axe_stone / axe_iron / axe_diamond | 同上 | 斧 2×3 | 1 件 | ❌ | ✅（斧页原文） | [Axe § Crafting](https://minecraft.wiki/w/Axe) |
| sword_wood / sword_stone / sword_iron / sword_diamond | 同上 | 剑 1×3 | 1 件 | ❌ | — | [Sword § Crafting](https://minecraft.wiki/w/Sword) |
| shovel_wood / shovel_stone / shovel_iron / shovel_diamond | 同上 | 锹 1×3 | 1 件 | ❌ | — | [Shovel § Crafting](https://minecraft.wiki/w/Shovel) |

- 全部 **shaped**、产物 1 件、不可堆叠。16 条均高或宽 >2 → 全部 table 级。
- 材质口径：木质=任意木板（tag）；石质=圆石/黑石/深板岩圆石任一（"Any stone-tier block"）；铁/钻=铁锭/钻石（各工具页 Ingredients 列）。我们只有单一 `planks`/`cobble`，无缺口。
- 工具皆 3 材料 + 2 木棍（镐/斧）或 2 材料 + 1 木棍（剑）或 1 材料 + 2 木棍（锹），与我们现有 cost 完全一致。

### 3.3 站点件与补给 12 条

```
3.3.1 furnace 3×3     3.3.2 chest 3×3       3.3.3 bed 3×2         3.3.4 lantern 3×3
圆 圆 圆               板 板 板               毛 毛 毛               粒 粒 粒
圆 · 圆               板 · 板               板 板 板               粒 火 粒
圆 圆 圆               板 板 板                                     粒 粒 粒

3.3.5 stone_bricks 2×2  3.3.6 bricks 2×2   3.3.7 shears 2×2      3.3.8 golden_apple 3×3
石 石                   砖 砖               · 铁·                 金 金 金
石 石                   砖 砖               铁 ··                 金 果 金
                                           （对角，可镜像）        金 金 金

3.3.9 tnt 3×3          3.3.10 bow 3×3      3.3.11 bread 3×1      3.3.12 bone_meal 1×1
药 沙 药                · 棍 线              麦 麦 麦               · 骨·
沙 药 沙                棍 · 线                                     · · ·
药 沙 药                · 棍 线
```

| 配方 id | 类型 | 尺寸 | 产物 | ≤2×2 | 镜像 | 材料（我们 id） | MC 细节 | 来源 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| furnace | 有序 | 3×3 | 1 | ❌ | — | cobble ×8 | MC 材料可为圆石/黑石/深板岩圆石任一；**不需要煤** | [Furnace](https://minecraft.wiki/w/Furnace) |
| chest | 有序 | 3×3 | 1 | ❌ | — | planks ×8 | 任意木板环形围一圈、中心空 | [Chest](https://minecraft.wiki/w/Chest) |
| bed | 有序 | 3×2 | 1 | ❌ | — | wool ×3 + planks ×3 | **三羊毛必须同色**（1.12 17w15a 起："Beds can now only be crafted using wool of the same color"）；不同色羊毛→同色床。我们只开白羊毛，天然满足 | [Bed](https://minecraft.wiki/w/Bed) |
| lantern | 有序 | 3×3 | 1 | ❌ | — | **iron_nugget ×8（缺）** + torch ×1 | 正典 8 铁粒环形 + 中心火把；我们现折算 2 铁锭（差异 #6），见 §4 | [Lantern](https://minecraft.wiki/w/Lantern) |
| stone_bricks | 有序 | 2×2 | **4** | ✅ | — | stone ×4 | 4 石头 → 4 石砖；**正典随身可做**（我们现标 table） | [Stone Bricks](https://minecraft.wiki/w/Stone_Bricks) |
| bricks | 有序 | 2×2 | 1 | ✅ | — | brick ×4 | 4 红砖（物品）→ 1 红砖块（方块）；正典随身可做 | [Bricks](https://minecraft.wiki/w/Bricks) |
| shears | 有序 | 2×2 | 1 | ✅ | ✅ | iron_ingot ×2 | **右上+左下对角**两铁锭（非竖排/横排）；正典随身可做 | [Shears](https://minecraft.wiki/w/Shears) |
| golden_apple | 有序 | 3×3 | 1 | ❌ | — | gold_ingot ×8 + apple ×1 | 8 金锭环形 + 中心苹果 | [Golden Apple](https://minecraft.wiki/w/Golden_Apple) |
| tnt | 有序 | 3×3 | 1 | ❌ | — | gunpowder ×5 + sand ×4 | 棋盘格交错；MC 的沙可为普通沙/红沙 | [TNT](https://minecraft.wiki/w/TNT) |
| bow_item | 有序 | 3×3 | 1 | ❌ | ✅ | stick ×3 + string ×3 | 木棍左列蛇形、线右列；**弦可左可右**（镜像，Crafting 页原文例） | [Bow](https://minecraft.wiki/w/Bow) |
| bread | **有序** | 3×1 | 1 | ❌ | — | wheat ×3 | **当前版本仍是有序** 3×1（Crafting 页原文将其作为 shaped 平移例："a 3×1 recipe, such as bread, can be made using the top, middle, or bottom row"）；历史上"变无序"的只有打火石/蘑菇煲/书/兔肉煲/甜菜汤（[Crafting § Changed recipes](https://minecraft.wiki/w/Crafting)） | [Bread](https://minecraft.wiki/w/Bread) |
| bone_meal | 无序* | 1×1 | **3** | ✅ | — | bone ×1 | **1 骨头 → 3 骨粉**；正典随身可做 | [Bone Meal](https://minecraft.wiki/w/Bone_Meal) |

\* bone_meal 同 3.1 注：单材料，Wiki 图形单格居中、不标 shapeless；摆放语义 = 任意一格放 1 骨头。

**32 条与我们现有 `cost`/`out` 的核对结果**：材料种类与数量、产物数量全部一致（含 torch 4、planks 4、stick 4、stone_bricks 4、bone_meal 3 的产物数）。唯一实质差异是 **lantern 的材料构成**（正典 8 铁粒 + 1 火把 vs 我们 2 铁锭 + 1 火把）与 §1.3 的 4 条站点归属。

---

## 4. 缺失物品清单

对 §3 全部图案引用的材料与 `js/items-core.js` 的 ITEMS 逐一比对，**缺口只有 1 个**：

| MC id | 是什么 | MC 里怎么获得 | 引入我们项目需要什么 | 来源 |
| --- | --- | --- | --- | --- |
| `minecraft:iron_nugget` 铁粒 | 铁锭的 1/9 小件物品（可堆叠 64） | ① 合成：**1 铁锭 → 9 铁粒**（单格配方）；② 熔炼：任意铁质工具/盔甲/锁链盔甲 + 燃料 → 铁粒；③ 战利品箱（堡垒遗迹等） | **纯数据行即可**：ITEMS 加一行（name/icon/fuel 可不设）+ RECIPES 加一条 `1 iron_ingot → 9 iron_nugget`（hand 级，1×1）。无需新方块、无需新掉落、无需新贴图（emoji 占位与其他材料一致）。若要回正典灯笼配方，再把 lantern 的 cost 改为 8 铁粒 + 1 火把 | [Iron Nugget § Obtaining](https://minecraft.wiki/w/Iron_Nugget) |

其余图案材料的核对说明（均**无缺口**）：

- `log / planks / stick / cobble / stone / brick / sand / wool / wheat / bone / string / gunpowder / apple / gold_ingot / iron_ingot / diamond / coal / charcoal / torch` 均已在 ITEMS 注册。
- MC 的多候选集合在我们项目里天然收敛为单一 id：木板 13+ 树种 → `planks`；石质材料（圆石/黑石/深板岩圆石）→ `cobble`；沙/红沙 → `sand`；煤/木炭（唯一需要保留的候选组）→ `['coal','charcoal']`。
- 床的 16 色羊毛 → 我们只开白羊毛（`wool`），同色约束自动满足。

---

## 5. 配方书与九宫格的联动（儿童 UX 关键）

### 5.1 MC 原生行为（Java 版口径，照抄对象）

来源：[Recipe book § Java Edition – Minecraft Wiki](https://minecraft.wiki/w/Recipe_Book)。

- 打开方式：进入合成界面（物品栏或工作台）后**按界面上的知识书图标**，配方书显示在网格左侧。
- **单击配方条目 = 在网格中展示该配方**（摆放预览）。Wiki 原文："**Clicking on an item in the list displays its recipe in the grid.** The item can then be crafted if the materials are available; otherwise, the button containing the item is **highlighted red**."——材料不足时条目**红色高亮**。
- **Shift+单击 = 把背包里现有的材料放入合成格**。Wiki 原文："**Shift-clicking an item in the list puts all available materials in the crafting grid.**"
- 同一配方有多个图案时**逐次点击轮换显示**（"Each click shows alternate patterns for the same crafting recipe…"；右键直接轮换）。
- 右上角按钮切换"显示全部 / 只显示可合成"；左上角有搜索框。
- 该"点条目自动填入"能力的加入版本：1.12 17w13a——"The player is now able to **automatically fill in the desired recipe into the crafting table by clicking on the item**."（来源：[Crafting Table § History](https://minecraft.wiki/w/Crafting_Table)）。

### 5.2 Bedrock 版口径（更贴近"一键摆入"）

来源：[Recipe book § Bedrock Edition](https://minecraft.wiki/w/Recipe_Book)。Wiki 原文："**Clicking on an item in the list puts all available materials in the crafting grid**, displaying the recipe… **Right-clicking the item automatically crafts it**, and pressing Shift **crafts all items** based on how many materials the player has."

- BE 的单击=直接放入材料（比 JE 更"一键"），右键=自动合成一次，Shift=连做到材料耗尽。

### 5.3 对我们的口径建议

我们保留配方卡 UI 作为教学入口，点卡片把材料摆进九宫格。两版正典行为都支持"点卡片 → 网格出现该配方"；对 6 岁儿童（无 Shift 概念、触屏友好），**建议采用 BE 口径：单击卡片 = 直接把背包材料自动摆入九宫格**（缺口格子空着或灰显），材料不足的卡片红色/灰显沿用我们现有 `canCraft.missing` 驱动的亮灰逻辑；JE 的"预览/轮换图案"可作为二期增强。不引入 MC 的"解锁才能用"限制（`doLimitedCrafting` 对应口径默认关闭，来源：[Recipe book § Unlocking](https://minecraft.wiki/w/Recipe_Book)："By default, the player does not need the recipes to craft a specific item"）。

---

## 6. 其他实现要点

### 6.1 合成格物品的取出/退回

- **工作台 3×3：关闭界面时，格内物品退回背包（背包放得下时）**。版本口径：1.12 17w13a——"**Closing the crafting interface now returns the items from the crafting grid to the inventory, if space allows.**"（来源：[Crafting Table § History](https://minecraft.wiki/w/Crafting_Table)）。放不下时掉落/丢弃是"if space allows"的自然反面（Wiki 未展开）。
- **物品栏自带 2×2：物品在关闭背包后保留在格里**——历史版本即如此设计且沿用（"The player can now place items in the 2×2 crafting grid and **they stay there when the inventory was closed** (internally slots number 80 to 83)"，来源：[Inventory § History](https://minecraft.wiki/w/Inventory)）；且该格"allows any recipe that fits to be crafted **but does not offer item storage**"（来源：[Inventory](https://minecraft.wiki/w/Inventory)）。
- 对我们的映射：工作台面板关闭 → 格内材料退回背包（放不下转掉落物，对齐我们 `craft().leftover` 的零惩罚口径）；随身 2×2 若做成常驻面板可照 MC 保留摆放。

### 6.2 儿童友好相关的设计参照（原版口径）

- **解锁提示 toast**：配方解锁时屏幕右上角弹通知（"Once a recipe has been unlocked, the player is alerted of it via a **notification that appears in the top right-hand corner**"，来源：[Recipe book § Unlocking](https://minecraft.wiki/w/Recipe_Book)）。原版解锁判据多为"**获得某材料物品**"，与我们"配方卡随材料齐备点亮"的现行逻辑同构。与我们 32 条相关的正典判据摘录（同页表格）：

| 配方 | 正典解锁条件 |
| --- | --- |
| 工作台 | 开新世界即解锁（1.19.4 23w07a 起，来源：[Crafting Table § History](https://minecraft.wiki/w/Crafting_Table)） |
| 木质工具 | 获得木棍 |
| 石质工具 / 熔炉 | 获得圆石（黑石/深板岩圆石任一） |
| 铁质工具 / 剪刀 / 铁粒 | 获得铁锭 |
| 钻石工具 | 获得钻石 |
| 金苹果 | 获得金锭 |
| 火把 | **获得石镐**（引导链：先有镐才有火把） |
| 弓 | 获得线 |
| TNT | 获得火药 |
| 灯笼 | 获得铁锭或铁粒 |
| 石砖 / 切石机 | 获得石头 |
| 面包 | 获得小麦 |
| 骨粉（骨磨） | 获得骨头 |
| 红砖块 / 花盆 | 获得红砖 |
| 木板 | 获得对应原木（tag 判定） |
| 箱子 | **背包占满 10 格**（少数非"持物"判据的例子） |
| 床 | 获得对应颜色羊毛 |

- 配方书"只显示可合成"过滤开关（§5.1）本身就是儿童友好设计：孩子不会被做不了的配方干扰。
- Wiki 对配方图形的补充记号（仅 Wiki 展示用，不出现在游戏里）："shapeless recipes are marked with a pair of intertwined arrows on the crafting table graphic"（来源：[Crafting § Complete recipe list](https://minecraft.wiki/w/Crafting)）——若我们想在配方卡上区分"摆放任意/必须照图案"，可借鉴这类视觉记号。

---

## 7. 对本次改造的直接结论

### 7.1 图案数据结构建议（纯数据、可单测、贴合现有 craft-core 风格)

在 RECIPES 条目上把 `cost` 升级为 `shape` 字段（保留 `out`/`station` 不动；匹配与扣料由新增纯函数承担）：

```js
/* 有序：rows = 行数组（元素 = 材料规约 | null）。材料规约 = 'id' 或候选数组（tag 语义） */
{id: 'pick_wood', out: {item: 'pick_wood', n: 1}, station: 'table',
 shape: {rows: [['planks', 'planks', 'planks'],
                [null, 'stick', null],
                [null, 'stick', null]]}},
{id: 'torch', out: {item: 'torch', n: 4}, station: 'hand',
 shape: {rows: [[['coal', 'charcoal'], null, null],   // 候选数组 = 煤或木炭任一
                ['stick', null, null]]}},
/* 无序：any = 材料多重集合（1–9 项，候选用数组） */
{id: 'bone_meal', ..., shape: {any: [['bone', 1]]}},
```

- 候选组写法沿用 inventory-core 的 `costEntry` 形状：`[['coal','charcoal'], 1]` 或直接把 `['coal','charcoal']` 放进格子——建议**格子规约 = id 字符串或 id 数组**（与 MC 的 "ID / tag / array" 三选一同构）。
- **匹配函数（建议与 canCraft/craft 并列的纯函数 `matchGrid(cells, recipe)`）**，按 §2 口径：
  1. `any`：cells 非空格材料的多重集合 == 配方表（逐项 id∈候选）；
  2. `rows`：cells 与 rows 各自**裁剪全空外圈**后形状与逐格必须相等（平移语义）；不中则**每行逆序再试一次**（水平镜像语义；斧/弓/剪刀依赖）；
  3. 站点门禁不变：hand 站点的摆放台是 2×2 规格（4 格），table 是 3×3（9 格）。
- 32 条图案数据可直接从 §3 的表抄录（每条一个字面量，单测断言三重命名/形状/产物即可）。
- 冲突核查：32 条图案两两不同构（含镜像），无"同摆多配"歧义；即便如此仍建议匹配器按 RECIPES 数组序返回首个命中（§2.6 悬置的工程兜底）。

### 7.2 hand/table 双站点与 2×2/3×3 的对应

- **hand = 2×2 随身格**（不需要任何方块，正典口径 §1.1）；**table = 3×3**（走近工作台打开）。现有 `station` 字段语义无需改名，只是判定从"扣背包计数"变为"在对应规格的摆放台上摆出图案"。
- **4 条正典属 2×2 但现标 table 的配方（stone_bricks / bricks / shears / bone_meal）**：若严格贴正典应迁 hand；若保留"工作台教学门槛"则登记为已知名差异（与灯笼折算同列）。二选一，建议在 conventions.md §6 偏离表登记 whichever。
- 配方书联动照正典：hand 面板的配方卡只列 2×2 配方，table 面板列全部（§1.1 第 4 条口径）。

### 7.3 缺失物品最小引入集

- **仅 `iron_nugget` 一个**（§4）：ITEMS 一行 + RECIPES 一条（1 铁锭 → 9 铁粒，hand 级 1×1）。引入后灯笼可回正典 `8 铁粒 + 1 火把`；若不想加物品，维持现状"2 铁锭 + 1 火把"并在偏离表登记。
- 其余材料零缺口；MC 的多树种/多石材/双色沙/16 色羊毛候选集在我们单一 id 下天然消失，唯一要保留的候选组是煤/木炭。

### 7.4 版本稳定性

- 本文化的机制（2×2/3×3 分级、平移+水平镜像匹配、无序、tag/候选、配方书填入、关界面退料）自 1.12–1.13 起未再变动，可作为长期口径实现；床同色羊毛（1.12 17w15a）、配方书单击填入/关界面退料（1.12 17w13a）为各自引入版本，已在正文标注。

---

## 8. 来源汇总（均为 Minecraft Wiki，minecraft.wiki，2026-10-26 抓取）

| 主题 | URL |
| --- | --- |
| 合成系统（2×2/3×3、平移镜像、无序、变更史） | https://minecraft.wiki/w/Crafting |
| 工作台（配方、历史：退料/自动填入/开局解锁） | https://minecraft.wiki/w/Crafting_Table |
| 配方系统（JSON、shaped/shapeless 规格、2×2 配方书口径） | https://minecraft.wiki/w/Recipe_(Java_Edition) |
| 配方书（JE/BE 点击行为、解锁判据表） | https://minecraft.wiki/w/Recipe_Book |
| 物品栏（2×2 格、Shift 连做史、格内物品保留） | https://minecraft.wiki/w/Inventory |
| 木板 / 木棍 / 火把 | https://minecraft.wiki/w/Planks 、/Stick 、/Torch |
| 镐 / 斧 / 剑 / 锹 | https://minecraft.wiki/w/Pickaxe 、/Axe 、/Sword 、/Shovel |
| 熔炉 / 箱子 / 床 / 灯笼 | https://minecraft.wiki/w/Furnace 、/Chest 、/Bed 、/Lantern |
| 石砖 / 红砖块 / 剪刀 / 金苹果 | https://minecraft.wiki/w/Stone_Bricks 、/Bricks 、/Shears 、/Golden_Apple |
| TNT / 弓 / 面包 / 骨粉 / 铁粒 | https://minecraft.wiki/w/TNT 、/Bow 、/Bread 、/Bone_Meal 、/Iron_Nugget |

---

## 9. 悬置问题（Wiki 未成文，无法一手查实）

1. **多配方匹配同一摆放的优先级**（§2.6）：Crafting / Recipe 两页均无表述。工程建议：RECIPES 数组序首个命中（已在 §7.1 给出）。
2. **"图案外格子必须为空"与"无序恰好集合相等"**（§2.3/§2.5）：为 pattern/ingredients 定义与"correct relative positions"的定义性推论，Wiki 无单独成句。语义无争议，标注供审计。
3. **产出槽"预览→点击执行→材料保留"三段行为**（§2.8）：词条页无逐字描述（GUI 截图与退料/连做记录间接支持）；按工程口径实现即可。
4. **每次合成每格扣 1 件**（§2.7）：无成文原句；是唯一与图案匹配自洽的口径（Shift 最大量连做记录与之相容）。
5. **火把"煤/木炭"的确切 tag 名**：Torch 页只写 "Coal or Charcoal"（材料候选组呈现），未写 tag 标识符；对我们无影响（候选数组直接枚举两个 id）。
