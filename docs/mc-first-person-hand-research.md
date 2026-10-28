# Minecraft「第一人称手持物与手臂渲染」官方口径研究报告（续篇）

> **用途**：为 my-craft-demo 的「第一人称视图模型」（独立小场景 + 独立相机、物品挂手部组 transform、不做墙内裁剪）提供 Minecraft 正典依据——手部渲染通道怎么走、空手画什么、挥击/装备动画的数学、各族物品第一人称姿态、走路摆动、拉弓/进食/放置动态，以及基岩版第一人称手臂基准。Java 版为主（Mojang 映射客户端源码 + vanilla 资源 JSON），基岩版补充。
> **调研日期**：2026-10-28。信息时效：以当日抓取的 Forge 官方 patch（1.16.x / 1.18.x / 1.19.x，内嵌原版源码上下文行）、1.19.3 原版源码副本（社区逐行拷贝）、nekoyue ForgeJavaDocs-NG 1.18.2 javadoc/常量表、vanilla 资源镜像 1.20.4、Bedrock Wiki 现行页为准。
> **与其它调研的关系**：本文是 [mc-held-item-render-research.md](mc-held-item-render-research.md) 的**续篇**。姐妹调研已证：Q1 方块 display 变换（`block/block.json` 第一人称 `[0,45,0]`/scale 0.40）、Q2 工具/食物 display（`handheld`/`generated` 第一人称 `[0,-90,25] + [1.13,3.2,1.13] + 0.68`）、Q3 空槽=裸臂、Q4 equip ±0.4/tick 与 swing 6 tick、Q5 基岩 attachable——本文引用时写「姐妹调研 Qn 已证」，不重抄数值表。手持物「主动作分派」见 [mc-held-item-action-research.md](mc-held-item-action-research.md)。

---

## 为什么调研

姐妹调研的落点建议只覆盖「挂到第三人称右臂」的手持物 def；下一场做**第一人称视图模型**时需要更深一层的正典口径：手部层在世界渲染里的位置（决定我们「独立小场景+独立相机」是否同构）、空手裸臂的确切姿态常量、挥击 sin/sqrt 公式逐行、拉弓/进食这类「使用中」动画怎么叠上来。本文逐问取证，全部结论标注 **确证**（一手逐行/逐值）/ **推证**（一手材料上的结构推断）/ **未确证**（未拿到原文）。

---

## Q1. 渲染通道架构：手部层什么时候画、深度/光照/雾/FOV 怎么处理

**结论**：

1. **手部是同一帧里、世界渲染完之后的一个独立小通道**（确证）。GameRenderer 的渲染流程（1.16/1.18/1.19 三版 patch 上下文行完全一致）：
   ```
   camera.setup(...) → mulPose(相机 yaw/pitch) → levelRenderer.renderLevel(世界)
   → dispatchRenderLast → profiler.popPush("hand")   // 进入手部段
   → if (renderHand) { RenderSystem.clear(256, ...)  // 清深度缓冲 → 手部渲染 }
   ```
   1.19.3 起手部段抽成独立方法 `GameRenderer.renderItemInHand(PoseStack, Camera, float)`（javadoc + 崩溃栈一手），调用链 `renderLevel → renderItemInHand → ItemInHandRenderer.renderHandsWithItems`（1.19.3 崩溃栈逐帧印出，B9）。
2. **手持物不会插进墙里：手部通道先把深度缓冲整个清掉再画**（确证）。`RenderSystem.clear(256, Minecraft.ON_OSX)` 中 256 = `GL_DEPTH_BUFFER_BIT`（三版 patch 逐行一致）。也就是说手部永远画在世界之上，不需要任何世界空间求交。GameRenderer 还有一个私有调试常量 `DEPTH_BUFFER_DEBUG = false`（常量表一手），旁证深度清空是手部通道的核心机制。近裁剪面 `PROJECTION_Z_NEAR = 0.05`（格），手部在 −0.7 格量级、远在裁剪面之外。
3. **光照：与世界光联动**。`renderHandsWithItems(float partialTick, PoseStack, BufferSource.BufferSource, LocalPlayer, int packedLight)` 的末位参数就是打包光照（javadoc 签名一手）；洞穴里手会变暗、火把边上手会提亮，即光照取玩家所在位置的世界光。谁计算这个 int：1.19.3 社区复现直接用 `EntityRenderDispatcher.getPackedLightCoords(player, partialTick)`（B9 事件处理器原文），与签名语义吻合——**取玩家位置世界光：推证**（GameRenderer 手部段 clear 之后的行未获逐行原文，见「未能获取」）。
   **雾：未发现独立处理**（未确证）。三版 GameRenderer patch 全文与 1.19.3 源码副本中均无任何 fog 调用进入手部通道；手部贴脸（≈0.7 格），远在雾起始距离内，观感不受距离雾影响——但「引擎是否显式关雾」无原文。
4. **相机/FOV：与主世界共用投影矩阵**（推证）。patch 上下文显示：世界渲染前 `Matrix4f matrix4f = posestack.last().pose(); resetProjectionMatrix(matrix4f)`，同一个 `matrix4f` 传进 `levelRenderer.renderLevel(...)`，手部段内（可见上下文范围）**没有任何新的投影/ortho 计算**——手部沿用世界投影，即 FOV 设置（含速度 FOV 效果管线，1.18/1.19 patch 的 `getFov` 上下文可见 `d0 *= lerp(fovEffectScale, 1.0, 0.857…)`）对手部同样生效。手部的**姿态常量全部定义在视图空间**（原点=相机，−Z 朝前），说明手部与世界不共用手势/位移，只共用投影。1.19.3 抽出 `renderItemInHand` 后内部是否重算投影未取证（未确证）；观感上「FOV 滑条影响手部大小」是稳定行为。
5. **view bobbing 对手部的作用 = 「共享矩阵 + 手部专属滞后」**（混合分级）：
   - 世界侧的 view bobbing（走路摆动 + 受伤倾斜 `bobHurt`/`bobView`）施加在手部与世界**共享的那个变换矩阵**上（bobbing 在世界渲染前烘焙、手部在其后用同一矩阵——施加位置行未获逐行原文，**推证**；但「走路时手跟着屏幕一起晃」是可复现的游戏观感）。
   - 手部**另有**一个专属的鼠标滞后摆动（**确证**，1.19.3 源码副本逐行）：`renderHandsWithItems` 在画手之前先
     ```java
     float f2 = lerp(partialTick, player.xBobO, player.xBob);
     float f3 = lerp(partialTick, player.yBobO, player.yBob);
     pose.mulPose(XP.rotationDegrees((player.getViewXRot(partialTick) - f2) * 0.1F));
     pose.mulPose(YP.rotationDegrees((player.getViewYRot(partialTick) - f3) * 0.1F));
     ```
     即手部朝向比相机慢 10%（`xBob/yBob` 是平滑后的视线角），快速甩鼠标时手会「追」上来——这就是「手部跟随」手感的核心，且只在手部层施加。

**来源**：B3、B4、B5（三版 GameRenderer.java.patch）、B6（常量表：PROJECTION_Z_NEAR/DEPTH_BUFFER_DEBUG）、B7（renderHandsWithItems 签名）、B9（1.19.3 源码副本 + 崩溃栈）。

---

## Q2. 第一人称空手裸臂：renderPlayerArm 的完整姿态

**结论**：

1. **空手第一人称确实渲染裸手臂**（确证）。1.18.x ItemInHandRenderer.patch 上下文：`renderArmWithItem` 的分支链以「空手 → `renderPlayerArm(...)`」结束（patch 行 `else { this.m_109353_(...); }`，m_109353_ = renderPlayerArm）；加上姐妹调研 Q3 已证 wiki「空(air)不渲染任何 item model」。空手 = 只画玩家皮肤手臂，不是什么都不画。
2. **1.19.3 `renderPlayerArm` 逐行原文**（B9 源码副本，确证）——这是空手裸臂的正典姿态代码：
   ```java
   private void renderPlayerArm(PoseStack pose, MultiBufferSource buf, int light,
                                float equipProgress, float swingProgress, HumanoidArm arm) {
      boolean flag = arm != HumanoidArm.LEFT;          // 右侧 = true
      float f = flag ? 1.0F : -1.0F;
      float f1 = Mth.sqrt(swingProgress);              // √p
      float f2 = -0.3F * Mth.sin(f1 * PI);             // 挥击 x 偏移
      float f3 =  0.4F * Mth.sin(f1 * 2PI);            // 挥击 y 偏移
      float f4 = -0.4F * Mth.sin(swingProgress * PI);  // 挥击 z 偏移
      pose.translate(f * (f2 + 0.64F), f3 + -0.6F + equipProgress * -0.6F, f4 + -0.72F);
      pose.mulPose(YP.rotationDegrees(f * 45.0F));                      // 预摆基角
      float f5 = Mth.sin(swingProgress * swingProgress * PI);           // sin(p²·π)
      float f6 = Mth.sin(f1 * PI);                                      // sin(√p·π)
      pose.mulPose(YP.rotationDegrees(f * f6 * 70.0F));                 // 挥击 yaw
      pose.mulPose(ZP.rotationDegrees(f * f5 * -20.0F));                // 挥击 roll
      // —— 以下把玩家模型的肩部枢轴搬到相机前 ——
      this.minecraft.getTextureManager().bind(player.getSkinTextureLocation()); // 玩家皮肤
      pose.translate(f * -1.0F, 3.6F, 3.5F);
      pose.mulPose(ZP.rotationDegrees(f * 120.0F));
      pose.mulPose(XP.rotationDegrees(200.0F));
      pose.mulPose(YP.rotationDegrees(f * -135.0F));
      pose.translate(f * 5.6F, 0.0F, 0.0F);
      PlayerRenderer pr = (PlayerRenderer) dispatcher.getRenderer(player);
      if (flag) pr.renderRightHand(pose, buf, light, player);
      else      pr.renderLeftHand(pose, buf, light, player);
   }
   ```
3. **1.18.2 常量表给同一姿态的「常量化」命名**（B6，确证；与上面逐值吻合）：

   | 常量 | 值 | 语义 |
   |---|---|---|
   | `ARM_HEIGHT_SCALE` | −0.6 | equip 进度对 y 的下沉倍率（与物品 `ITEM_HEIGHT_SCALE` 同值，见 Q5） |
   | `ARM_POS_X / Y / Z` | 0.8 / −0.75 / −0.9 | 空手裸臂的**基座平移**（右 0.8、下 0.75、前 0.9，单位=格） |
   | `ARM_PRESWING_ROT_Y` | 45° | 预摆基角（对应上文 `f * 45`） |
   | `ARM_SWING_X_POS_SCALE / Y / Z` | −0.3 / 0.4 / −0.4 | 挥击位移系数（对应 f2/f3/f4） |
   | `ARM_SWING_Y_ROT_AMOUNT` | 70° | 挥击 yaw 幅度（`f * f6 * 70`） |
   | `ARM_SWING_Z_ROT_AMOUNT` | −20° | 挥击 roll 幅度（`f * f5 * -20`） |
   | `ARM_PREROTATION_X/Y/Z_OFFSET` | −1.0 / 3.6 / 3.5 | 肩部重定位的**旋转前**平移（对应 `translate(-1, 3.6, 3.5)`） |
   | `ARM_ROT_X / Y / Z` | 200 / −135 / 120 | 肩部重定位的**旋转**（roll 200°、yaw −135°、pitch 120°，把手臂从「垂在身侧」转向「指向画面内」） |
   | `ARM_POSTROTATION_X_OFFSET` | 5.6 | 旋转后沿臂向平移 5.6（把「手」推到画面里） |
   | `ARM_POS_SCALE` | 0.8 | 名义上为基座平移的缩放系数（使用行未获原文，**推证**） |

   > 两版本差异说明：1.18.2 常量把基座写成 `ARM_POS_* 0.8/-0.75/-0.9`，1.19.3 源码把基座写为字面量 `0.64/-0.6/-0.72 + 挥击偏移`、把肩部重定位拆成 `PREROTATION→ROT→POSTROTATION`——**旋转三兄弟 200/−135/120 与全部挥击系数逐值一致**（确证互证），基座平移的确切组合随版本重排（不影响观感结论）。以 1.19.3 逐行为准。
4. **渲染的是哪只手臂**：主手槽渲染 `player.getMainArm()`（默认右手）侧，副手槽渲染对侧（1.19.3 副本：`humanoidarm = flag ? player.getMainArm() : getMainArm().getOpposite()`，确证）；`renderPlayerArm` 内按侧调 `PlayerRenderer.renderRightHand / renderLeftHand`（1.18.2 javadoc 签名一手），纹理绑定 `player.getSkinTextureLocation()`——**画的是玩家皮肤的手臂**（确证）。
5. **袖口细节**：`renderRightHand` 方法体未获逐行原文；按 PlayerModel 结构（手臂本体 + `rightSleeve` 第二层「袖子」覆盖层，外层缩放 1.1/0.25 系），裸臂应渲染「皮肤手臂 + 袖子覆盖层」两层——**推证**（方法体见「未能获取」）。对手感结论无影响：观感=玩家皮肤完整手臂。

**来源**：B2（1.18 patch：空手分支调 renderPlayerArm）、B6（常量表全表）、B7/B8（javadoc 签名）、B9（1.19.3 源码副本逐行）。

---

## Q3. 第一人称挥击（swing）数学：sin/sqrt 公式与常量参与

**结论**：

1. **裸臂挥击公式（逐行确证**，见 Q2 引文**）**。设 p = swingProgress ∈ [0,1]，√p 记 s，f = 右手 +1 / 左手 −1：
   - 位移（加在基座 `0.64 / −0.6+equip·(−0.6) / −0.72` 上）：
     - x += f · (−0.3 · sin(π·s)) 　→ 峰值 0.3 格、横扫
     - y += 0.4 · sin(2π·s) 　→ 先抬后落（整周期）
     - z += −0.4 · sin(π·p) 　→ 峰值前伸 0.4 格
   - 旋转（在基座 yRot=f·45 之后）：
     - yRot += f · 70° · sin(π·s)
     - roll(Z) += f · (−20°) · sin(π·p²)
2. **物品挥击常量（1.18.2 常量表，确证）与参与方式**：`ITEM_POS_X/Y/Z = 0.56 / −0.52 / −0.72` 是持物基点；挥击在其上叠加：

   | 常量 | 值 | 角色 |
   |---|---|---|
   | `ITEM_PRESWING_ROT_Y` | 45° | 预摆基角（挥击前先摆出的「引臂」角，对应裸臂 45°） |
   | `ITEM_SWING_X_POS_SCALE` | −0.4 | 挥击 x 位移系数（`0.56 + sin(·)·(−0.4)`，峰值横扫 0.4 格） |
   | `ITEM_SWING_Y_POS_SCALE` | 0.2 | 挥击 y 位移系数 |
   | `ITEM_SWING_Z_POS_SCALE` | −0.2 | 挥击 z 位移系数（前伸 0.2 格，比裸臂的 0.4 小） |
   | `ITEM_SWING_Y_ROT_AMOUNT` | −20° | 挥击 yaw 增量 |
   | `ITEM_SWING_Z_ROT_AMOUNT` | −20° | 挥击 roll 增量 |
   | `ITEM_SWING_X_ROT_AMOUNT` | −80° | 挥击 pitch 主力——「劈砍」的 80° 俯仰甩动 |
   | `ITEM_HEIGHT_SCALE` | −0.6 | equip 下沉（见 Q5） |

   - **三角函数配对（推证）**：`applyItemArmAttackTransform(PoseStack, HumanoidArm, float swingProgress)` 方法体逐行原文本轮未获（1.19.3 源码副本删去了物品路径，Forge patch 未覆盖该区域）；「位移用 sin(π·p) 横扫 + 旋转用 sin(√p·π) 先快后慢」的经典社区公式与常量值吻合，但**每个常量精确挂在哪个 sin 上未逐行确证**——落点实现按观感对齐即可（见「落点建议」）。结构结论不受影响：物品挥击 = 基座平移 + sin 包络位移 + 三轴旋转，与裸臂同构。
3. **连挖时 swing 是连续循环**（确证）。1.18.x Minecraft.java.patch 上下文：`continueAttack`（按住左键时每 tick 由主循环调用）里 `gameMode.continueDestroyBlock(...)` 成功 → `addBlockHitEffects + player.swing(MAIN_HAND)`——**挖掘期间每 tick 都触发一次 swing**，而单次 swing 时长 6 tick（姐妹调研 Q4 已证），于是表现为连续不断的挥动循环。
4. **attack 蓄力不影响挥击观感时长**：`getAttackStrengthScale` 的立方只进 equip 回归（姐妹调研 Q4 已证）。

**来源**：B6（ITEM_SWING_* / ITEM_POS_* / ITEM_PRESWING_ROT_Y 全值）、B9（裸臂公式逐行 + ARM_SWING_* 对应）、B2（equip/挥击双参数并行）、B10（continueAttack 每 tick swing）。

---

## Q4. 第一人称每族物品的完整 display（特殊物品补充 + 农具逐文件验证）

**结论**（全部为 1.20.4 vanilla 资源 JSON 原文，确证）：

1. **特殊物品 `firstperson_righthand` 完整 display**：

   | 物品 | rotation | translation | scale | 备注 |
   |---|---|---|---|---|
   | `bow` | `[0, -90, 25]` | `[1.13, 3.2, 1.13]` | `0.68` | 与 handheld/generated 第一人称完全同值（等价于继承） |
   | `crossbow` | `[-90, 0, -55]` | `[1.13, 3.2, 1.13]` | `0.68` | **平举**（x −90°、z −55°），像端枪，不是斜握 |
   | `shield` | `[0, 180, 5]` | `[-10, 2, -10]` | `1.25` | parent `builtin/entity`——**手上是完整 3D 盾模型**（BEWLR 渲染），不是挤出薄片 |
   | `shield_blocking` | `[0, 180, -5]` | `[-15, 5, -11]` | `1.25` | 举盾：模型整体抬高前顶、roll 翻向 |
   | `spyglass` | 继承 `item/generated` | `[1.13, 3.2, 1.13]` | `0.68` | **无自定义 display**（JSON 仅 parent+layer0） |
   | `totem_of_undying` | 继承 `item/generated` | `[1.13, 3.2, 1.13]` | `0.68` | **无自定义 display** |
   | （对照）`item/generated` / `item/handheld` | `[0, -90, 25]` | `[1.13, 3.2, 1.13]` | `0.68` | 姐妹调研 Q2 已证 |

   - **盾的第三人称对照**：`[0,90,0] + [10,6,-4] + 1.0`（右）/ `[10,6,12]`（左）——第一人称 translation 的 ±10/−10 量级远大于薄片族（±1.13），因为盾模型本体是原尺寸几何。
2. **弓的拉弓模型机制**（确证）：`bow.json` 用 `overrides` 按使用状态换**整套模型**（贴图），不是变形动画：
   ```json
   "overrides": [
     { "predicate": { "pulling": 1 },                "model": "item/bow_pulling_0" },
     { "predicate": { "pulling": 1, "pull": 0.65 },  "model": "item/bow_pulling_1" },
     { "predicate": { "pulling": 1, "pull": 0.9 },   "model": "item/bow_pulling_2" }
   ]
   ```
   `bow_pulling_0/1/2.json` 均 `parent: "item/bow"`、只换 `layer0` 贴图——**display 变换原样继承**，即拉弓只是换更弯的弓贴图，位置/角度不变。`pulling=1` 表示正在拉弓（使用中），`pull` 是张弓进度 0→1；满蓄力 1 秒（wiki Bow 页：full charge 0.9s / critical charge 1s，确证）。
3. **弩同理**：`pull` 阈值 0.58 / 1.0 三态 + `charged=1` → `crossbow_arrow`、`charged=1 & firework=1` → `crossbow_firework`（确证）。
4. **.spyglass 瞄准是全屏贴图覆盖，不是物品变换**：`textures/misc/spyglass_scope.png` 存在（探测 200），而 `models/item/spyglass_scope.json` 404——镜筒效果不走 item model。配合 Q1 的 `isScoping()` 分支：**瞄准时第一人称手部整个不渲染**（确证，源码副本首行 `if (!player.isScoping())`）。
5. **农具/工具家族逐文件验证——全部 parent `item/handheld`**（确证，每个文件仅 parent+layer0 两行）：

   | 文件 | parent |
   |---|---|
   | `item/wooden_hoe.json` | `minecraft:item/handheld` ✓（用户点名的锄） |
   | `item/diamond_hoe.json` | `minecraft:item/handheld` ✓ |
   | `item/iron_axe.json` / `item/diamond_axe.json` | `minecraft:item/handheld` ✓ |
   | `item/diamond_shovel.json` | `minecraft:item/handheld` ✓ |
   | `item/diamond_pickaxe.json` | `minecraft:item/handheld` ✓ |
   | `item/diamond_sword.json` | `minecraft:item/handheld` ✓（姐妹调研 Q2 已证，本轮复核） |

   即 hoe/axe/shovel/pickaxe/sword **无一例外**走 handheld 第一人称 `[0,-90,25] + [1.13,3.2,1.13] + 0.68`，没有农具专用的 display。
6. **图腾的 40 tick 动画在别处**：常量表 GameRenderer 段有 `ITEM_ACTIVATION_ANIMATION_LENGTH = 40`（确证）——图腾发动（第一人称「物品浮起到眼前」的全屏动画）由 GameRenderer 的 itemActivation 体系播放，时长 40 tick = 2 秒；与手持 display 无关。

**来源**：B1（全部 JSON 原文 + spyglass 资源探测）、B11（wiki Bow 蓄力时长）、B6（ITEM_ACTIVATION_ANIMATION_LENGTH）。

---

## Q5. equip 进度如何作用到手部位移

**结论**：

1. **下沉量 −0.6 × equipProgress，只作用于 y 轴；物品与裸臂同值**（确证）：
   - 物品：`applyItemArmTransform(pose, arm, equipProgress)` → `translate(±0.56, -0.52 + equipProgress * -0.6F, -0.72)`（常量 `ITEM_HEIGHT_SCALE = -0.6`，1.19.3 结构 + 常量表互证）。
   - 裸臂：`renderPlayerArm` 的 translate 第二项 `f3 + -0.6F + equipProgress * -0.6F`（1.19.3 逐行，确证；常量 `ARM_HEIGHT_SCALE = -0.6` 同值）。
   - x/z 不受 equip 影响——装备动画是纯竖直下沉，没有前后/左右分量，也没有旋转分量。
2. **equipProgress 的来源**（姐妹调研 Q4 已证 + 本轮 patch 复核）：`equipProgress = 1 - lerp(partialTick, oMainHandHeight, mainHandHeight)`（1.18 patch 行 `f5 = 1.0F - Mth.lerp(...)` 确证）；速率 ±0.4/tick、沉到 0.1 以下才换新物。装备动画只存在于第一人称（第三人称直接替换模型）。

**来源**：B2（f5/f7 行 + tick ±0.4）、B6（ITEM_HEIGHT_SCALE/ARM_HEIGHT_SCALE = −0.6）、B9（renderPlayerArm translate 行）。

---

## Q6. 走路 bobbing 与手部

**结论**：

1. **view bobbing 走路摆动作用在共享投影矩阵上**（推证，机制链条见 Q1 第 5 条）：手部用与主世界同一个投影矩阵（patch 上下文），`bobView` 的走路摆动在世界渲染前烘焙进该矩阵——因此走路时手部与画面一起上下摆动。`bobView` 方法体（经典公式 `translate(sin(walkDist·π)·bob·0.5, -|cos(walkDist·π)·bob|, 0)` 等）本轮未获逐行原文，标**未逐行确证**。
2. **手部专属动态只有一个：鼠标滞后 ±0.1°/度**（确证，Q1 第 5 条引文）。`(当前视线角 − 平滑视线角) × 0.1` 施加在 pitch 与 yaw 两轴——这是手部层唯一的「额外」摆动。
3. **跳跃/落地没有专用手部动画**（未发现，如实标注）：手部通道的全部输入就是 `partialTick / poseStack / bufferSource / player / packedLight` 加 `swingProgress / equipProgress` 两个动画参数（javadoc 签名 + 源码副本），其中没有任何跳跃/落地相关量；`bob`/`oBob` 字段由水平移动驱动。落地手感来自世界侧（如有）而非手部。

**来源**：B7（renderHandsWithItems 签名）、B9（±0.1° 滞后逐行）、B3/B4/B5（共享投影上下文）。

---

## Q7. 拉弓 / 进食 / 放置的第一人称动态（简要）

**结论**：

1. **拉弓**：`renderArmWithItem` 对「正在使用且是弓」走专用分支——张弓进度由 `useDuration(72000)` 与剩余时间换算出 `pull ∈ [0,1]`（满蓄力 20 tick = 1 秒，wiki 确证），一是驱动模型 overrides 换 `bow_pulling_0/1/2` 贴图（Q4），二是施加第一人称手部变形，常量（1.18.2 常量表，确证）：
   - `BOW_CHARGE_Z_POS_SCALE = 0.04`（拉弓时沿深度方向回缩的系数）
   - `BOW_CHARGE_Z_SCALE = 0.2`（z 向缩放修正）
   - `BOW_CHARGE_SHAKE_Y_SCALE = 0.004` + `BOW_MIN_SHAKE_CHARGE = 0.1`（charge > 0.1 后开始 y 向满弓颤抖；x/z shake = 0）
   另有分支规则（1.16 patch 上下文 + javadoc 方法 `selectionUsingItemWhileHoldingBowLike`，确证）：**用弓时只渲染使用手**——主手拉弓则副手整只不渲染。
2. **进食抖动**：专用常量组（1.18.2 常量表，确证）：`EAT_JIGGLE_X_POS_SCALE 0.6 / EAT_JIGGLE_Y_POS_SCALE -0.5 / Z 0`，旋转 `X 10° / Y 90° / Z 30°`，`EAT_JIGGLE_EXPONENT 27`（随进食剩余比例的 27 次幂增长——越快吃完抖得越猛），`EAT_EXTRA_JIGGLE_SCALE 0.1 / CUTOFF 0.8`（收尾额外抖动）。观感：食物周期性朝嘴部戳动、末段幅度骤增。方法体逐行未获，配对细节**推证**。
3. **放置方块 = 触发一次标准 swing**（确证）：1.18.x Minecraft.java.patch 上下文，`startUseItem`（右键）→ `gameMode.useItemOn(...)` 结果 `consumesAction() && shouldSwing()` → `player.swing(interactionhand)`——放置成功的摆手动画与攻击挥击**共用同一条 swing 管线**（同 6 tick 曲线、同 Q3 公式），没有专门的「放置动画」。副手使用/与实体交互成功同样按 `shouldSwing()` 决定。
4. **持续挖掘 = 每 tick 重触发 swing**（确证，Q3 第 3 条），因此挖掘观感是「连续循环」而放置/攻击是「单次」。

**来源**：B6（BOW_*/EAT_* 常量）、B1（bow overrides 阈值）、B10（startUseItem / continueAttack）、B11（满蓄力 1s）、B7（selectionUsingItemWhileHoldingBowLike 存在）。

---

## Q8. 基岩版第一人称（简要补充）

**结论**：

1. **第一人称手臂基准姿态是引擎内置，无官方数值文档**：vanilla 基岩资源包 `player.animation.json`（本轮全文抓取，确证）**不含任何 first_person 动画键**——手臂进画面不靠动画文件。社区测量值（Bedrock Wiki，社区一手）：
   > "It applies a rotation of **(95, -45, 115)** and a translation of **(13.5, -10, 12)** to the right arm bone, perfectly mimicking how the arm is positioned in first-person."

   其配套引导动画 JSON（wiki 资产原文，确证）：
   ```json
   { "format_version": "1.8.0",
     "animations": { "animation.wiki.first_person_guide.right_arm.method_one": {
       "loop": true,
       "bones": {
         "rightArm": { "rotation": [95, -45, 115], "position": [13.5, -10, 12] },
         "rightItem": { "position": [0, 0, -1] } } } } }
   ```
   可信度：Bedrock Wiki 创作者社区的标准教程方法（用于在 Blockbench 里对齐第一人称），非 Mojang 官方口径——标**社区测量值**。
2. **绑定骨骼的 −24 y 修正**（wiki 原句，确证为「社区经验」）："they apply a **-24 offset to the y-position of the right item bone** to counteract a similar -24 y-position offset Minecraft applies to bound bones. **We are unsure at this time why this happens.**" ——即 wiki 自己承认机制未明，引用时保持同等级别谨慎。
3. **第一/第三人称切换条件**：attachable 的 `scripts.animate` 里用 Molang `context.is_first_person`（示例原文 `"hold_first_person": "context.is_first_person == 1.0"`；姐妹调研 Q5 已证 vanilla bow attachable 用 `c.is_first_person`）。模型绑定用 `q.item_slot_to_bone_name(context.item_slot)` → `'main_hand' → "rightitem"`（wiki 原句，确证）。
4. 基岩 vanilla 用模型绑定的 attachable 仅限特殊物品：**trident、spyglass、bow、shield**（wiki 原句，确证）——与 Java「特殊物品才特殊处理」同构。

**来源**：B12（player.animation.json 消极证据 + 姐妹调研 S9）、B13（Bedrock Wiki 原句）、B14（引导动画 JSON 原文）。

---

## 落点建议（折算到本仓库第一人称视图模型）

本仓库口径：第一人称=独立小场景+独立相机（不做墙内裁剪）、物品挂「手部组」transform、部件以握点为原点、−Z 为前、1 格 ≈ 1 单位、玩家臂长 0.66、工具全长 ~0.85、方块手持 ~0.38。MC 全部第一人称常量单位就是「格」，可直接借用观感比例。

**(a) 手部组基座（持物）**：MC 持物基点 `ITEM_POS (0.56, −0.52, −0.72)`（相机空间，右/下/前）。本仓库臂长略短，建议手部组 pos ≈ **`(0.45, −0.42, −0.58)`** 量级（80% 折算），物品 def 的 grip 直接施加在手部组下。

**(b) swing 落地**：把 Q3 公式折成手部组上的两段：
- 位移包络：`x += −0.4·sin(π·p)`（横扫）、`z += −0.2·sin(π·p)`（前伸）、`y += 0.2·sin(π·p)`（轻微上挑）——本仓库 swing.amp 取 0.2–0.4 格弧即可；
- 旋转包络：`xRot = −80°·sin(√p·π)`（劈砍主力，0.44 前文工具内倾之外的动态项）、`yRot 增量 = −20°·sin(√p·π)`、`zRot 增量 = −20°·sin(π·p²)`；预摆基角 45° 并入 grip 静态角。单次时长 0.3 s（姐妹 Q4），**挖掘态每帧重触发**（连续循环），放置/攻击单次。
- 裸臂版差异：前伸更大（−0.4）且 y 是 0.4·sin(2π·√p) 的「先抬后劈」，空手 swing 可单独调 amp。

**(c) equip**：`y += −0.6 × equipProgress`（纯 y 轴、无旋转），折算本仓库 ≈ 0.15–0.2（姐妹调研 (d) 已给 0.28 s 方案，正典数值本轮复核无变化）。

**(d) 空手裸臂**：空手也要画手臂网格（正典行为）；姿态折算——手臂网格指向画面内可用 MC 的重定位旋转 **roll 200° / yaw −135° / pitch 120°**（或等价欧拉），基座放在 `(0.5, −0.45, −0.6)` 量级（1.18.2 `ARM_POS 0.8/−0.75/−0.9` 与 1.19.3 `0.64/−0.6/−0.72` 之间取中）。臂材质直接用玩家皮肤色单色即可（正典=玩家皮肤手臂）。

**(e) 进食/拉弓折算**：进食抖动 `x 0.6 / y −0.5` 的正弦抖 + 末段增幅（指数感用 `p^4` 近似即可）；拉弓 `z 回缩 0.04·charge + y 微颤 0.004·(charge−0.1)`、贴图三态可不做（本仓库无弓则跳过）。两类都是「使用中」叠加在手部组上、与 swing/equip 独立并行。

**(f) 手感三件套**：① 手部组挂相机子节点 → 自动继承 view bobbing（正典「共享矩阵」结构的直接映射）；② 叠加 `(当前视线角 − 平滑视线角) × 0.1°` 的鼠标滞后（正典 ±0.1 系数）；③ 不需要任何墙内裁剪/深度技巧——正典就是清深度硬画（本仓库独立场景天然同构）。FOV 与主相机一致即可。

---

## 来源清单

| # | 来源 | 类型 | URL | 支撑的结论 |
|---|------|------|-----|-----------|
| B1 | InventivetalentDev/minecraft-assets @ 1.20.4 raw（vanilla 资源一手镜像） | **资源一手** | https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.4/assets/minecraft/models/item/ 下 bow.json、bow_pulling_0/1/2.json、crossbow.json、crossbow_pulling_0/1/2.json、shield.json、shield_blocking.json、spyglass.json、totem_of_undying.json、wooden_hoe.json、diamond_hoe.json、iron_axe.json、diamond_axe.json、diamond_shovel.json、diamond_pickaxe.json、diamond_sword.json、handheld.json、generated.json；另探测 textures/misc/spyglass_scope.png（200）与 models/item/spyglass_scope.json（404） | Q4 全部 display 数值、overrides 机制、农具验证、spyglass 无模型 |
| B2 | MinecraftForge（1.18.x）ItemInHandRenderer.java.patch | **源码一手**（Forge patch 内嵌原版上下文行） | https://raw.githubusercontent.com/MinecraftForge/MinecraftForge/1.18.x/patches/minecraft/net/minecraft/client/renderer/ItemInHandRenderer.java.patch | Q2（空手分支调 renderPlayerArm）、Q5（f5=1−lerp、±0.4、<0.1 换物）、Q3（swing/equip 双参数） |
| B3 | MinecraftForge（1.16.x）GameRenderer.java.patch | **源码一手** | https://raw.githubusercontent.com/MinecraftForge/MinecraftForge/1.16.x/patches/minecraft/net/minecraft/client/renderer/GameRenderer.java.patch | Q1（"hand" 分析段、clear(256)、共享投影上下文——1.16 形态） |
| B4 | MinecraftForge（1.18.x）GameRenderer.java.patch | **源码一手** | https://raw.githubusercontent.com/MinecraftForge/MinecraftForge/1.18.x/patches/minecraft/net/minecraft/client/renderer/GameRenderer.java.patch | Q1（同 B3，1.18 形态；getFov 管线上下文） |
| B5 | MinecraftForge（1.19.x）GameRenderer.java.patch | **源码一手** | https://raw.githubusercontent.com/MinecraftForge/MinecraftForge/1.19.x/patches/minecraft/net/minecraft/client/renderer/GameRenderer.java.patch | Q1（三版逐行一致；1.19 形态） |
| B6 | nekoyue ForgeJavaDocs-NG — 1.18.2 constant-values.html | **映射一手**（常量全表） | https://nekoyue.github.io/ForgeJavaDocs-NG/javadoc/1.18.2/constant-values.html | Q2/Q3/Q5/Q7 全部常量：ARM_POS_*/ARM_ROT_*/ARM_PREROTATION_*/ARM_POSTROTATION_*/ARM_PRESWING_ROT_Y/ARM_SWING_*/ARM_HEIGHT_SCALE、ITEM_POS_*/ITEM_SWING_*/ITEM_PRESWING_ROT_Y/ITEM_HEIGHT_SCALE、BOW_CHARGE_*/BOW_MIN_SHAKE_CHARGE、EAT_JIGGLE_*/EAT_EXTRA_JIGGLE_*、MAP_*；GameRenderer 段 PROJECTION_Z_NEAR 0.05 / DEPTH_BUFFER_DEBUG false / ITEM_ACTIVATION_ANIMATION_LENGTH 40 |
| B7 | nekoyue ForgeJavaDocs-NG — 1.18.2 ItemInHandRenderer javadoc | **映射一手**（方法签名） | https://nekoyue.github.io/ForgeJavaDocs-NG/javadoc/1.18.2/net/minecraft/client/renderer/ItemInHandRenderer.html | Q1（renderHandsWithItems 末参 packedLight）、Q3/Q7（applyItemArmTransform / applyItemArmAttackTransform / applyEatTransform / renderOneHandedMap / renderTwoHandedMap / selectionUsingItemWhileHoldingBowLike 存在） |
| B8 | nekoyue ForgeJavaDocs-NG — 1.18.2 PlayerRenderer javadoc | **映射一手** | https://nekoyue.github.io/ForgeJavaDocs-NG/javadoc/1.18.2/net/minecraft/client/renderer/entity/player/PlayerRenderer.html | Q2（renderRightHand/renderLeftHand 签名、getArmPose 存在） |
| B9 | Minecraft Forge Forums 帖 "[1.19.3] Displaying hands in first-person"（原版源码逐行副本 + 崩溃栈） | 社区二手（原版代码拷贝） | https://forums.minecraftforge.net/topic/121014-1193-displaying-hands-in-first-person/ | Q1（±0.1° 视角滞后行、renderLevel→renderItemInHand→renderHandsWithItems 调用链栈帧）、Q2（renderPlayerArm 全文逐行）、Q5（equip·−0.6 行）、Q3（ARM 挥击公式逐行） |
| B10 | MinecraftForge（1.18.x）Minecraft.java.patch | **源码一手** | https://raw.githubusercontent.com/MinecraftForge/MinecraftForge/1.18.x/patches/minecraft/net/minecraft/client/Minecraft.java.patch | Q3（continueAttack 每 tick swing→连挖循环）、Q7（startUseItem 成功且 shouldSwing → swing；放置=一次 swing） |
| B11 | Minecraft Wiki — Bow | Wiki | https://minecraft.wiki/w/Bow | Q4/Q7（full charge 0.9s / critical charge 1s） |
| B12 | Mojang/bedrock-samples — resource_pack/animations/player.animation.json（main 分支） | **官方一手**（消极证据） | https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/animations/player.animation.json | Q8（全文无 first_person 动画键→基岩第一人称手臂为引擎内置） |
| B13 | Bedrock Wiki — Items: Attachables | 社区（权威度次之，标注使用） | https://wiki.bedrock.dev/items/attachables | Q8（rot(95,−45,115)/trans(13.5,−10,12) 原句、−24 y 绑定修正原句、context.is_first_person 示例、绑定 bone 名转换、vanilla 绑定物品=trident/spyglass/bow/shield） |
| B14 | Bedrock Wiki 资产 — method_one 引导动画 JSON | 社区资产原文 | https://wiki.bedrock.dev/assets/packs/items/attachables/method_one/attachable_guide.animation.json | Q8（引导动画数值原文） |

## 未能获取 / 未确证（如实清单）

- **`applyItemArmAttackTransform` / `applyEatTransform` / `renderArmWithItem` 物品路径（含 bow 分支）的逐行原文**：1.19.3 源码副本帖删去了物品渲染路径、Forge patch 未覆盖这些区域、searchcode/screamingsandals 等镜像均已失效。ITEM_SWING_*/EAT_JIGGLE_* 常量值为一手，**三角函数配对与公式结构为推证**（已在正文标注）。
- **GameRenderer 手部段 `clear(256)` 之后的行**（光照 int 的计算式、是否有 `turnOnLightLayer`/`endBatch`、是否有雾处理）：三版 patch 均未覆盖。「光照=玩家位置世界光」为签名语义+社区复现的**推证**；「雾无独立处理」标**未确证**。
- **`PlayerRenderer.renderRightHand` 方法体**（`setAllVisible(false)` + 仅右臂/袖子可见的字面行）：未获原文；「裸臂=手臂+袖子两层」为**推证**。
- **`bobView`/`bobHurt` 方法体与施加位置行**：未获逐行原文；「走路 bobbing 烘焙进手部与世界共享的投影矩阵」为**推证**（观感行为可复现，机制链条部分一手）。
- **`ARM_POS_SCALE 0.8` 的使用行**：常量值一手，语义（基座缩放系数）为按名**推证**。
- **1.19.4+ / 1.21.x 的手部通道重构**（renderItemInHand 内部、独立 hand render target 等）：本轮未取证；正文相关结论均标明版本边界（1.16–1.19.3）。
- **nekoyue 常量表仅 1.18.2 可用**：1.19.4/1.20.4/1.21.4 的 constant-values 页 404（该镜像只托管部分版本），ARM_* 等常量在更高版本的存续未核对。
- **基岩第一人称手臂数值**：引擎内置、官方无文档，仅社区测量值（wiki 明言 −24 修正成因「We are unsure」）。
