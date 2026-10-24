# Minecraft「玩家手持物品渲染」官方口径研究报告

> **用途**：为 my-craft-demo ⛏️「手持物与快捷栏选中一致」提供 Minecraft 官方渲染口径依据——方块怎么拿、物品怎么拿、空槽显示什么、切换时的装备（equip）动画怎么做。Java 版为主（资源包 JSON + Mojang 映射客户端源码），基岩版补充（attachable 体系）。
> **调研日期**：2026-10-24。信息时效：以当日抓取的 vanilla 资源包镜像（1.20.4 分支，display 数值自 1.9 起多年稳定未变）、minecraft.wiki 现行页、MinecraftForge 官方 patch（1.16.x / 1.18.x）、Microsoft Learn 现行文档为准。注意 1.21.4（24w45a，2024 年末）起 vanilla 重构了 item model 的组织方式（`models/item/` 下的重定向文件被移除、改用 items model definition），但 **display 变换数值与语义不变**，本报告引用 1.20.4 资源是安全口径。
> **与其它调研的关系**：手持物「主动作分派」（手持方块=放置等）见 [mc-held-item-action-research.md](mc-held-item-action-research.md)；本文只管**渲染观感**——拿在手里长什么样、怎么转、多大、切换时怎么动。

---

## 为什么调研

仓库现有手持物系统（js/held-item.js 的 16 条工具 def + 空手 def，js/avatar.js 的 `setItem(id)` 把网格挂到右臂 armR）下一场要实现「手持物与快捷栏选中一致」：选中方块 → 手里出现方块，选中食物/材料 → 手里出现薄片物，空槽 → 空手，切换 → 有装备动画。这四个观感决策都需要 MC 正典依据：方块是缩小的完整方块本体还是另行简化？食物和木棍这类「非工具物」用什么形状与握持角度？空槽在 MC 里到底渲染什么？切换时那个「手沉一下再抬起」的动画多长、和挥击怎么共存？本文逐问取证。

---

## Q1. 方块怎么拿

**结论**：

1. **是缩小的方块本体，且用的就是该方块的完整 block model**——不是任何专门为手持另做的简化模型。方块 item 模型直接 parent 到 block model，六面贴图原样带到手上（原木顶面/侧面异色在手上同样异色）。
2. **方块的 display 变换不写在各方块模型里，而是全部继承自公共父模型 `block/block.json`**（所有普通方块的 parent 链顶端）。默认数值（1.20.4 vanilla 实测抓取）：

| 位置 | rotation | translation | scale |
|---|---|---|---|
| `thirdperson_righthand` | `[75, 45, 0]` | `[0, 2.5, 0]` | `0.375` |
| `firstperson_righthand` | `[0, 45, 0]` | `[0, 0, 0]` | `0.40` |
| `firstperson_lefthand` | `[0, 225, 0]` | `[0, 0, 0]` | `0.40` |
| `gui`（物品栏图标） | `[30, 225, 0]` | `[0, 0, 0]` | `0.625` |
| `ground`（掉落物） | `[0, 0, 0]` | `[0, 3, 0]` | `0.25` |
| `fixed`（展示框） | `[0, 0, 0]` | `[0, 0, 0]` | `0.5` |

   - `block/block.json` **没有定义 `thirdperson_lefthand`**——wiki 载明左手位若未指定则回退用 `thirdperson_righthand` 的值。
   - 观感解读：**第三人称**俯仰 75° + 水平 45°（能看到顶面 + 两个侧面），缩放 0.375（= 6/16，手持方块约 0.375 格见方）；**第一人称**只水平转 45°、不俯仰，略大（0.40），贴住屏幕右下。translation 单位是 1/16 格（第三人称沿手臂方向抬高 2.5/16 ≈ 0.16 格）。
3. **模型链一手证据**（1.20.4 vanilla 资源，S3）：
   - `item/oak_planks.json` = `{"parent": "minecraft:block/oak_planks"}` —— 方块物品直接引用 block model；
   - `block/oak_planks.json` → parent `block/cube_all`（六面全用 `#all` 一张贴图）；
   - `block/cube_all.json` → parent `block/cube`；
   - `block/cube.json` = 单个 element `from [0,0,0]` `to [16,16,16]`，六个面各自引用 `#down/#up/#north/#south/#west/#east` 六个纹理变量，parent `block/block`（display 从这里来）；
   - 多面异色样例：`block/oak_log.json` → parent `block/cube_column`，其中 `up/down = #end`（顶面）、四侧 `= #side`（侧面）——即「顶面/侧面不同贴图」正是 vanilla 的标准做法。
4. wiki 载明（S1）："display" 里 **"Translations are applied to the model before rotations"**（先平移后旋转）；translation 限幅 ±80、scale 上限 4。

> **存疑注**：以上为 1.9–1.20.4 稳定口径。1.21.4 起（S1 History：24w45a "Models in `models/item` that only redirect to a block model have been removed"）方块 item 改由 items model definition 引用 block model，`block/block.json` 的 display 继承关系语义不变（本次未抓 26.x 资源逐一复核，标存疑）。

**来源**：S3（block/block.json、block/cube.json、block/cube_all.json、block/cube_column.json、block/oak_planks.json、block/oak_log.json、item/oak_planks.json 原文）、S1（display 字段语义、左手回退规则、display type 用途表）。

---

## Q2. 物品怎么拿（工具 / 食物 / 材料）

**结论**：

1. **非方块物品统一用「16×16 贴图生成的挤出薄片模型」**：parent 指向 `item/generated`（其自身 parent 为 `builtin/generated`，即"用指定图标生成的模型"，S1/S2 原文 *"a model that is created out of the specified icon"*）。挤出方向垂直于贴图平面；**「每个像素挤出 1/16」的深度值官方文档无明文**（见存疑注），但「由图标挤出成带厚度的薄片」这一模型形态是官方口径。工具不是独立 3D 模型——**钻石剑的 JSON 与苹果的 JSON 结构完全同构，只是 parent 不同**。
2. **两个家族的 parent 与 display 差异（1.20.4 vanilla 原文）**：

`item/generated.json`（食物/材料家族的基类）：

| 位置 | rotation | translation | scale |
|---|---|---|---|
| `thirdperson_righthand` | `[0, 0, 0]` | `[0, 3, 1]` | `0.55` |
| `firstperson_righthand` | `[0, -90, 25]` | `[1.13, 3.2, 1.13]` | `0.68` |
| `ground` | `[0, 0, 0]` | `[0, 2, 0]` | `0.5` |

（另：`gui_light: "front"`——薄片按平面打光；`head` 为 `[0,180,0] + [0,13,7]`；`fixed` 为 `[0,180,0]`。）

`item/handheld.json`（工具家族基类，parent = `item/generated`，仅覆盖手持相关 display）：

| 位置 | rotation | translation | scale |
|---|---|---|---|
| `thirdperson_righthand` | `[0, -90, 55]` | `[0, 4.0, 0.5]` | `0.85` |
| `thirdperson_lefthand` | `[0, 90, -55]` | `[0, 4.0, 0.5]` | `0.85` |
| `firstperson_righthand` | `[0, -90, 25]` | `[1.13, 3.2, 1.13]` | `0.68` |
| `firstperson_lefthand` | `[0, 90, -25]` | `[1.13, 3.2, 1.13]` | `0.68` |

3. **工具 vs 食物 vs 材料的具体归属（逐文件核实）**：
   - 工具：`diamond_sword.json`、`iron_shovel.json` → `{"parent": "minecraft:item/handheld", "textures": {"layer0": "minecraft:item/diamond_sword"}}`（仅此两行）；
   - 食物：`apple.json`、`bread.json` → parent `minecraft:item/generated`；
   - 材料：`coal.json` → parent `minecraft:item/generated`；**但 `stick.json`（木棍）→ parent `minecraft:item/handheld`**——木棍按「工具握法」拿，这是「材料不必然用 generated」的直接 vanilla 反例。
4. **观感解读**：第一人称工具与食物用**完全相同**的变换（rot Y −90°：贴图长边从竖直转为指向正前；Z 25°：向内倾贴近手指）；差别全在第三人称——工具斜握（绕 Z 55°、抬高 4/16、放大 0.85），食物竖持（无旋转、抬高 3/16、前伸 1/16、缩小 0.55）。

> **存疑注**：「每像素挤出 1/16」的深度数值未在官方文档/资源 JSON 中找到明文（vanilla 挤出是加载期代码生成的，无 JSON 可引）；该数值为资源包社区长期实践共识（Blockbench 的 item sprite 导出即按此），本轮未能从一手核验，标**未确证**。模型是「挤出薄片」这一点则由 `builtin/generated` 的官方语义（S1/S2）确证。

**来源**：S3（item/generated.json、item/handheld.json、item/diamond_sword.json、item/iron_shovel.json、item/apple.json、item/bread.json、item/stick.json、item/coal.json 原文）、S1/S2（`item/generated`/`builtin/generated` 语义、display 字段规则）。

---

## Q3. 空槽语义（快捷栏没选中东西时显示什么）

**结论**：

1. **第一人称：渲染裸手臂**（玩家皮肤的手臂，无任何物品模型）。证据链（三源互证）：
   - Mojang 映射 1.18.2 `net.minecraft.client.renderer.ItemInHandRenderer` 存在私有方法 `renderPlayerArm(PoseStack, MultiBufferSource, int, float equipProgress, float swingProgress, HumanoidArm)`，且有一整套**空手臂专用常量**：`ARM_POS_X 0.8 / ARM_POS_Y -0.75 / ARM_POS_Z -0.9`、`ARM_ROT_X 200° / ARM_ROT_Y -135° / ARM_ROT_Z 120°`（裸手臂第一人称姿态角）、`ARM_HEIGHT_SCALE -0.6`（装备动画下沉量，与物品的 `ITEM_HEIGHT_SCALE` 同值）（S6 常量表）；
   - 该方法内部最终调 `PlayerRenderer.renderRightHand / renderLeftHand`（1.18.2 官方映射 javadoc，S6；1.19.3 原版源码副本 S12：`renderPlayerArm` 内 `translate(f * (f2 + 0.64F), f3 + -0.6F + equipProgress * -0.6F, f4 + -0.72F)` 后调 `playerrenderer.renderRightHand(...)`）；
   - wiki Model 页（S1）"Uses of models" 表：第一/第三人称手持物模型均 *"All items excluding air"*——**空（air）不渲染任何 item model**，屏幕上看到的只是手臂本身。
2. **第三人称：什么都不额外渲染**——物品模型层（`ItemInHandLayer`，挂在 `HumanoidMobRenderer` 上的 RenderLayer，1.18.2 官方映射 javadoc 有 `renderArmWithItem(LivingEntity, ItemStack, ItemTransforms.TransformType, ...)` 签名，S6）只在有物品时工作；空手时手臂就是玩家模型的一部分，随走路/挥手自然摆动，没有「手持物」概念。
3. 语义落点：MC 中**空手是一种正常的手持状态**（有挥击、有待机摆动），不是「隐藏手持层」。对应本仓库 `HeldItems.bare`（空手等价 def）的设计与 MC 同构。

> **存疑注**：`ItemInHandLayer.render` 内部「`if (!itemstack.isEmpty())` 才渲染」的字面源码行本轮未拿到（Forge 未 patch 该段、javadoc 无方法体）；「第三人称空手不渲染物品」由 wiki Uses 表（excluding air）+ 该 Layer 仅接收物品渲染职责推证，置信度高但非逐行原文。

**来源**：S6（ItemInHandRenderer / PlayerRenderer javadoc + 常量表）、S12（1.19.3 原版 renderPlayerArm 源码副本）、S1（Uses of models 表）。

---

## Q4. 切换动画（equip）与挥击（swing）的关系

**结论**：

1. **切换快捷栏选中 → 触发「装备动画」（equip / reequip）：手臂带旧物下沉，沉到底后换上新物再抬起**。实现口径（Mojang 映射名，1.16.5 `FirstPersonRenderer` 与 1.18.2 `ItemInHandRenderer` 逐行一致，经 Forge 官方 patch 内嵌的原版上下文行取证，S4/S5）：
   - 装备进度由字段对 `mainHandHeight / oMainHandHeight`（1–1.16 旧名 `equippedProgress`）驱动，每 game tick 更新：
     ```java
     // 物品发生切换的分支：直接匀速下沉
     this.mainHandHeight = Mth.clamp(this.mainHandHeight - 0.4F, 0.0F, 1.0F);
     // 物品未变的分支：朝目标值（攻击蓄力 f 的立方）回归，同样限速 ±0.4
     float f = localplayer.getAttackStrengthScale(1.0F);
     this.mainHandHeight += Mth.clamp((this.mainHandItem == itemstack ? f*f*f : 0.0F) - this.mainHandHeight, -0.4F, 0.4F);
     ```
   - **换物时机**：`if (this.mainHandHeight < 0.1F) { this.mainHandItem = itemstack; }`——旧物必须先沉到 0.1 以下才切换成新物品，随后回归 1。**速率 ±0.4/tick**：1 → 0.1 约 3 tick（≈0.15 s），全程（下沉 + 抬起）约 5–6 tick ≈ **0.25–0.3 秒**。
   - **下沉量**：渲染时 `equipProgress = 1.0 - Mth.lerp(partialTick, oMainHandHeight, mainHandHeight)`（`renderHandsWithItems` 内，S4 patch / S12 源码副本原文），传入 `renderArmWithItem` 后按 `ITEM_HEIGHT_SCALE / ARM_HEIGHT_SCALE = -0.6` 施加 y 偏移（`+ equipProgress * -0.6F`，S12 源码副本 + S6 常量表互证）——**最多下沉 0.6 格的 equipProgress 倍**（观感约小半格）。
2. **挥击（swing）与装备动画独立并行、加法叠加、互不打断**：`renderHandsWithItems` 同一帧把 `swingProgress`（`player.getAttackAnim(partialTick)`）与 `equipProgress` 作为两个独立参数传入 `renderArmWithItem`（S4/S5 patch 上下文原文：`float f4 = interactionhand == MAIN_HAND ? f : 0.0F; float f5 = 1.0F - Mth.lerp(...); this.renderArmWithItem(..., f4 /*swing*/, this.mainHandItem, f5 /*equip*/, ...)`）。挥击自身的位移/旋转由常量曲线驱动：物品 `ITEM_SWING_X_POS_SCALE -0.4`、`ITEM_PRESWING_ROT_Y 45°`；空手臂 `ARM_SWING_Y_ROT_AMOUNT 70°`、`ARM_SWING_Z_ROT_AMOUNT -20°`、`ARM_SWING_X/Y/Z_POS_SCALE -0.3/0.4/-0.4`（S6 常量表）。
3. **挥击时长**：由 `LivingEntity#getCurrentSwingDuration()` 控制，vanilla 硬编码（mod "Strike After Swing" 文档明言 *"the number vanilla hard-codes in LivingEntity#getCurrentSwingDuration"*, S11），**基线 6 tick = 0.3 秒**（wikily `/swing` 命令文档 *"Defaults to 6 ticks"*、GeckoLib wiki *"default swing time (6 ticks)"* 双社区源一致）。挖掘疲劳每级 +2 tick、急迫每级 −1（Haste 页仅给出攻速/挖速倍率佐证效果确实作用于挥击体系，S13）。
4. **切换槽位本身不触发 swing**：切槽触发的是 reequip（Forge 的 `shouldCauseReequipAnimation` 钩子即为此设计，S4/S5 patch 上下文可见该判定包裹整个进度更新）；挥击只由攻击/使用动作触发。第三人称**没有装备动画**（物品直接替换），equip 动画是纯第一人称行为。

> **存疑注**：6 tick 基线与 ±0.4/tick 中，±0.4 有逐行一手（S4/S5 patch 原文）；6 tick 仅有社区二手源（S11）+ 方法名一手存在（S6），未从反编译文件逐行核验，标**部分未确证**。本仓库 HELD_BARE 的 swing `dur: 0.24`、工具 `dur: 0.20–0.30` 与 0.3 s 基线同一量级，无需改。

**来源**：S4、S5（Forge 官方 patch 内嵌原版源码行）、S6（字段/方法/常量）、S12（1.19.3 源码副本）、S11（6 tick 社区双源）、S13（Haste 页旁证）。

---

## Q5. 基岩版补充（attachable + render_offsets）

**结论**：

1. **基岩版手持物的官方控制面是 attachable（`minecraft:attachable`）**：一个 JSON 定义 `description`（identifier / materials / textures / geometry / animations / scripts / render_controllers），挂到资源包 `attachables/` 目录；identifier 匹配物品 id 时激活并**替换**该物品手持时的默认模型（S7、S10）。
2. **手持挂点是玩家几何骨架上的 `rightItem`（主手）/ `leftItem`（副手）骨骼**。两种挂法：
   - 骨架法：把模型 cube 直接挂在玩家骨架的 `rightItem` 骨骼下；
   - 绑定法（vanilla 自用）：几何根骨骼写 `"binding": "q.item_slot_to_bone_name(context.item_slot)"`，Molang 自动转换（`'main_hand' → "rightitem"`、`'off_hand' → "leftitem"`）。Microsoft Learn 官方原句（S7）："*The `rightItem` is a place for an attachable to attach to.*"
3. **第一/第三人称用动画区分**：attachable 的 `scripts.animate` 里用 Molang 条件选择动画（`context.is_first_person`）。vanilla 官方实例（S9，Mojang/bedrock-samples 一手）`resource_pack/attachables/bow.json`：
   ```json
   "scripts": { "animate": [ "wield",
     { "wield_first_person_pull": "query.main_hand_item_use_duration > 0.0f && c.is_first_person" } ] }
   ```
   即第三人称常驻 `wield` 姿态动画，第一人称拉弓时叠加专用动画。
4. **render_offsets 是旧机制且已官方弃用**：item 组件 `minecraft:render_offsets`（字段仅 `main_hand` / `off_hand` 两组变换）——Microsoft Learn 现行页顶注 *"This type is now deprecated, and no longer in use in the latest versions of Minecraft."*（S8；弃用于 json 格式 1.20.10+）。新物品一律走 attachable + 动画。
5. **基岩版「默认手持」也是挤出薄片/方块模型**：Bedrock Wiki（社区，S10）："*Minecraft will build a model from a template … the item's sprite being an extruded texture mesh, or blocks displaying with their model.*"——不写 attachable 时，物品 = 精灵贴图挤出网格、方块 = 方块模型缩小，与 Java 口径同构。**vanilla 基岩资源包只为特殊物品提供 attachable**（`bow.json` 存在；`diamond_sword.json` / `apple.json` / 普通方块均无 attachable 文件，普通工具/食物/方块手持为引擎内置），因此基岩**不存在与 Java display JSON 数值一一对应的东西**——它的手持姿态由骨骼动画（如 `animation.bow.wield`）驱动。

> **存疑注**：`minecraft:render_offsets` 内部子字段（third_person/first_person 的具体键名与单位）未展开取证（官方页已弃用且正文极简）；基岩第一人称手臂基准姿态数值（社区测量：右臂 rot(95, −45, 115)、trans(13.5, −10, 12)、绑定骨骼 −24 y 修正）来自 Bedrock Wiki（S10），标社区二手。

**来源**：S7（MS Learn attachable 参考 + Using Attachables）、S8（MS Learn render_offsets）、S9（Mojang/bedrock-samples bow.json 原文 + diamond_sword/apple 缺失事实）、S10（Bedrock Wiki，社区）。

---

## 落点建议（映射到本仓库四个设计决策）

以下把上文结论折算成 js/held-item.js def 体系（`{label, parts, grip, swing, sway}`，部件坐标系以握点为原点、−Z 为前，grip 由 Avatar 施加到 armR 手部枢轴）可用的数值口径。**单位换算基准**：MC 的 display translation 单位 = 1/16 格（1 格 = 1 m）；玩家臂长约 0.7 格。本仓库手臂/工具件宽 0.055 量级（≈ MC 手臂宽 4 px 的观感），故下面直接给「格」语义的观感建议而非机械换算。

**(a) 方块 def：单 box + `BLOCKS` 单/双色 ↔ MC 完整 block model——形状等价，贴图面降档，可接受**

- 形状：MC `block/cube.json` 本身就是**单个 16³ element**（S3），本仓库「一个 box」与正典完全同构，无需拆件。
- 贴图：MC 每面独立纹理变量，最多六面六色；本仓库 `b.all`（六面单色）与 `b.side`（侧面/顶底两色）两档。`b.side` 恰好覆盖最典型的「顶/侧异色」方块（原木= cube_column 的 `up/down=#end` + 四侧 `#side`，S3 原文），比 MC 少的只是「四种侧面各一色」这类花色，6 岁观感下损失极小。**结论：偏差可接受，不值得引入逐面色。**
- 大小：MC 手持方块 scale 第三人称 0.375 / 第一人称 0.40（S3）。本仓库手臂以「格」感观标定的话，**方块 def 边长取 ≈ 0.38–0.40**（与拳头相当、明显小于 0.55 的木柄全长 0.55+0.3 的工具），即 `parts: [{w:0.38, h:0.38, d:0.38, color: 顶侧双色时可用两个嵌套 box 或单色}]`。
- 姿态（grip 建议）：第一人称口径 `rotation [0,45,0]`——**只水平转 45°，让方块两面对着视线，不俯仰**；第三人称口径 `[75,45,0]`（本仓库第三人称即角色自身右手，可折中取 x ≈ −0.9~−1.2 rad（≈ −55°~−70°）俯仰 + y 45°，让别的孩子能看到方块顶面）。位置：MC 第三人称沿手臂上抬 2.5/16 ≈ 0.16、无前后偏移——**方块中心放握点上方 ≈ 0.1–0.15、贴掌心（−Z 方向 ≈ −0.05）**，不要悬空高于拳头。

**(b) 食物/材料通用 def：平面薄片，第一人称沿手臂前伸 + 内倾 25°**

- MC 语义：食物/材料（apple/bread/coal）= 16×16 贴图挤出薄片，第一人称 `rotation [0, −90, 25]`（S3）——贴图长边由竖直转为**指向正前（−Z）**，再向内倾 25° 贴近手指；第三人称竖持不转（`[0,0,0]` + scale 0.55）。
- 建议形状：无贴图体系下用**单个薄 box 近似**——`{w: 0.30, h: 0.30, d: 0.06}`（面积感 ≈ MC 16 px × 0.55 缩放后的观感，厚度 1/16 挤出的近似），颜色走 def 的 color。
- 建议 grip：第一人称观感 `rot: [-Math.PI/2 + 0.44, 0, 0]` 不好直接对上 MC 的欧拉序——按观感落地即可：**长轴沿 −Z 前伸（绕 X ≈ −90°），再绕前伸轴内倾 ≈ 25°（0.44 rad）**，pos 放握点前上 `[0, −0.45, −0.10]` 量级（与现有 TOOL_GRIPS 同参考系微调）。若嫌欧拉难调，退化为「竖持薄片」（= MC 第三人称观感）也完全正统。
- 木棍教训（S3 `stick.json` 用 handheld）：**按用途而非类目选握法**——会被当工具挥的棒状物用工具 grip，入口食物用薄片 grip。本仓库二期通用 def 建议两个工厂：`mkFoodDef`（薄片 generated 式）与棒状材料复用木柄件。

**(c) 空槽 = 空手：MC 一手依据充分，现有设计不用改**

- 第一人称渲染裸手臂（`renderPlayerArm` + `ARM_*` 常量，S6；wiki "excluding air"，S1）、第三人称只渲染手臂不渲染物品（S1/S6）——即**空槽不是「隐藏什么」，而是「手臂本来就在」**。本仓库 `HeldItems.bare`（有 swing/sway 的空手 def）+ `setItem(null)` 卸网格的语义与此一致；唯一要对齐的口径是：**空手也参与切换动画**（MC 从方块切到空槽同样下沉再抬，因为 equipProgress 与物品是否为空无关，S4/S5 的 tick 逻辑只比较 stack 是否变化）。

**(d) 切换时做「下沉再抬」equip 动画：MC 行为依据与时长**

- 依据：切槽 → 旧物沉到底（进度 < 0.1）→ 换新物 → 抬回；速率 ±0.4/tick，全程 ≈ 0.25–0.3 s；下沉量 ≈ 0.6 × 进度（观感小半格，S4/S5/S6/S12）。
- 建议实现（复用现有加法式叠加，与 swingPose 同风格）：`equipPose(p) = {y: −0.2 × sin(p·π)}` 之类单段 sin 包络，**总时长 0.28 s**（沉 0.13 s + 抬 0.15 s，或对称 0.14+0.14），下沉幅度取本仓库手臂尺度的 ≈ 0.15–0.2（MC 的 −0.6 格按 1.8 m 身高折算约等于本仓库 0.66 尺度单位的 0.2 左右）；动画期间**新网格在中点（沉到底）才替换**，复刻 MC「沉到 0.1 才换物」的细节。与挥击叠加：直接相加（MC 即两参数独立施加，S4），切换不打断进行中的挥击、挥击也不打断 equip。

---

## 来源清单

| # | 来源 | 类型 | URL | 支撑的结论 |
|---|------|------|-----|-----------|
| S1 | Minecraft Wiki — Model（资源包模型格式现行页） | Wiki（官方格式文档） | https://minecraft.wiki/w/Model | Q1–Q3（display 字段语义/限幅/先平移后旋转、左手回退、Uses of models 表 "excluding air"、display type → 手持位映射、1.21.4 重构史） |
| S2 | Minecraft Wiki — Tutorial:Models | Wiki（教程页，权威度略低于 S1） | https://minecraft.wiki/w/Tutorial:Models | Q2（`item/generated`/`builtin/generated` 语义、layer0、torch 手持 display 示例） |
| S3 | InventivetalentDev/minecraft-assets @ 1.20.4（vanilla 客户端资源提取镜像；原计划用 Ingramz/minecraft-assets，本轮仓库不可达，见「未能获取」） | **vanilla 资源一手** | https://github.com/InventivetalentDev/minecraft-assets/tree/1.20.4 （raw 直链示例：https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.4/assets/minecraft/models/block/block.json ；同路径下 block/cube.json、block/cube_all.json、block/cube_column.json、block/oak_planks.json、block/oak_log.json、item/oak_planks.json、item/generated.json、item/handheld.json、item/diamond_sword.json、item/iron_shovel.json、item/apple.json、item/bread.json、item/stick.json、item/coal.json） | Q1、Q2（全部 display 数值、parent 链、stick 用 handheld） |
| S4 | MinecraftForge（1.18.x 分支）官方 patch — ItemInHandRenderer.java.patch（patch 内嵌 Mojang 官方映射原版源码上下文行） | **源码一手**（经 Forge patch 引用） | https://raw.githubusercontent.com/MinecraftForge/MinecraftForge/1.18.x/patches/minecraft/net/minecraft/client/renderer/ItemInHandRenderer.java.patch | Q4（tick 的 ±0.4 速率、requip 判定、renderHandsWithItems 的 equipProgress=1−lerp） |
| S5 | MinecraftForge（1.16.x 分支）官方 patch — FirstPersonRenderer.java.patch（同上，1.16.5 类名） | **源码一手**（经 Forge patch 引用） | https://raw.githubusercontent.com/MinecraftForge/MinecraftForge/1.16.x/patches/minecraft/net/minecraft/client/renderer/FirstPersonRenderer.java.patch | Q4（同 S4，双版本互证逐行一致） |
| S6 | nekoyue ForgeJavaDocs-NG — 1.18.2 (forge 40.2.1) javadoc（Mojang 官方映射名） | **映射一手**（类/字段/方法/常量值；无方法体） | 类页 https://nekoyue.github.io/ForgeJavaDocs-NG/javadoc/1.18.2/net/minecraft/client/renderer/ItemInHandRenderer.html ；PlayerRenderer https://nekoyue.github.io/ForgeJavaDocs-NG/javadoc/1.18.2/net/minecraft/client/renderer/entity/player/PlayerRenderer.html ；常量表 https://nekoyue.github.io/ForgeJavaDocs-NG/javadoc/1.18.2/constant-values.html | Q3、Q4（renderPlayerArm/renderRightHand 存在、ITEM_*/ARM_*/EAT_*/BOW_* 全部常量数值、mainHandHeight 字段、ItemInHandLayer.renderArmWithItem 签名） |
| S7 | Microsoft Learn — Attachables Documentation（minecraft:attachable 参考页）+ Using Attachables（创作者教程页） | **官方第一手** | https://learn.microsoft.com/en-us/minecraft/creator/reference/content/attachablereference/examples/attachabledefinitions/attachable?view=minecraft-bedrock-stable ；https://learn.microsoft.com/en-us/minecraft/creator/documents/attachables?view=minecraft-bedrock-stable | Q5（attachable 字段表、binding Molang、rightItem 挂点原句） |
| S8 | Microsoft Learn — Items Documentation: minecraft:render_offsets | **官方第一手** | https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_render_offsets?view=minecraft-bedrock-stable | Q5（render_offsets 仅 main_hand/off_hand、官方 deprecated 声明） |
| S9 | Mojang/bedrock-samples（Mojang 官方示例仓库，main 分支） | **官方第一手** | https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/attachables/bow.json （另：同目录 diamond_sword.json / apple.json / trident.json / shield.json 均 404——普通物品无 attachable 的消极证据） | Q5（vanilla attachable 实例、第一/三人称 Molang 条件动画、仅特殊物品有 attachable） |
| S10 | Bedrock Wiki — Attachables | 社区（权威度次之，标注使用） | https://wiki.bedrock.dev/items/attachables | Q5（默认手持=挤出薄片/方块模型、rightItem/leftItem 骨骼名、−24 y 绑定修正、第一人称手臂基准姿态社区测量值） |
| S11 | wikily `/swing` 命令文档（wiki 镜像）+ GeckoLib wiki + Modrinth "Strike After Swing" | 社区二手（多源一致） | https://wikily.gg/minecraft/commands/swing ；https://github.com/bernie-g/geckolib/wiki/Geckolib-Entities-(Geckolib4) ；https://modrinth.com/mod/strike-after-swing | Q4（swing 基线 6 tick；vanilla 硬编码于 LivingEntity#getCurrentSwingDuration） |
| S12 | Minecraft Forge Forums 帖 "[1.19.3] Displaying hands in first-person"（楼主粘贴的 1.19.3 原版 ItemInHandRenderer 源码副本） | 社区二手（原版代码逐行拷贝，与 S6 常量互证吻合） | https://forums.minecraftforge.net/topic/121014-1193-displaying-hands-in-first-person/ | Q3、Q4（renderPlayerArm 源码行：`+ equipProgress * -0.6F`、调 renderRightHand） |
| S13 | Minecraft Wiki — Haste | Wiki | https://minecraft.wiki/w/Haste | Q4（急迫作用于攻速/挥击体系的旁证） |

**未能获取/未确证（如实说明）**：

- **Ingramz/minecraft-assets**：GitHub 仓库页与 raw（master/1.20.4/1.21.4 分支）均 404，本轮不可达；改用 InventivetalentDev/minecraft-assets 1.20.4 分支（同为 vanilla 客户端资源提取镜像，文件原文一致）。
- **Mojang 反编译源码完整文件**：公开反编译全文镜像（grep.app / Sourcegraph / nms.screamingsandals.org / api.github.com）本轮均不可达（403/404/429）；tick() 与 renderHandsWithItems() 的关键行经 **Forge 官方 patch 内嵌上下文行（S4/S5）** 取得，方法体其余部分（如 renderArmWithItem 的 `isEmpty()` 分支字面、ItemInHandLayer 的 `isEmpty()` 检查字面）未获逐行原文，相关结论已在正文标注推证链。
- **「每像素挤出 1/16」深度数值**：官方文档与 vanilla JSON 均无明文（加载期代码生成），仅社区实践共识，标未确证。
- **swing 6 tick 的官方文档明文**：无官方页逐字记载，仅有 S11 社区多源 + 源码方法名存在（S6），标部分未确证。
- **基岩 render_offsets 的内部子字段语法**：官方页已 deprecated 且正文仅两个字段名，未展开取证。
- **github.com 网页版与 api.github.com**：网络层不可达（404），仅 raw.githubusercontent.com 可用；故 GitHub 仓库内目录列表（如 bedrock-samples attachables 完整清单）未能列出，以「逐文件探测存在/404」代替。
