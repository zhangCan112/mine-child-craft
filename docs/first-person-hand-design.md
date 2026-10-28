# 第一人称手持视图（HandView）设计定稿

> 状态：定稿（2026-10-28）。分票施工前的接口与边界裁决。
> 设计权威：本文件。正典依据：[mc-first-person-hand-research.md](mc-first-person-hand-research.md)（第一人称通道/裸臂/挥击数学）与
> [mc-held-item-render-research.md](mc-held-item-render-research.md)（display 变换/equip 时长，下称「姐妹调研」）。
> 术语：[GLOSSARY.md](../GLOSSARY.md) 的 手持物注册表（HeldItems）/ 玩家形象（Avatar）/ 相机装置（CameraRig）/ 手持物注册表新增词条 HandView（随本票落地）。

## 目标与非目标

**目标**：第一人称视角（CameraRig mode 0 且非驾驶）下渲染手持物视图模型——手+物永不插墙、
全物品族适配（16 工具 + 锄头/农具 + 手工剑 + 弓 + 方块/薄片/棒三惰性族 + 空手裸臂）、
equip 换物动画与挥击动画 MC 正典口径。**所有模式通用**（引擎层，无玩法知识）。

**非目标**（差异全量登记见附录 B）：拉弓/进食「使用中」动画、crossbow/shield 等未引入物品、
手部光照联动世界光、世界侧 view bobbing 烘焙。

## D1 模块边界：新引擎模块 js/hand-view.js（HandView）

**Module**：第一人称手持视图——玩家视角下手与物的唯一渲染入口。
**删除测试**：删掉它，「独立 scene/相机 + clearDepth 通道 + 裸臂建模 + 每族 fp 姿态施加 +
equip/swing/bob/鼠标滞后四动态 + 驾驶遮蔽」这堆复杂度会重新出现在 main.js（通道）、
avatar.js（状态第二消费者）、camera-rig.js（可见性）三处——复杂度跨 3 个调用方重现，
earning its keep。**Seam**：主循环渲染通道的插入点 + Avatar 的状态漏斗；**Adapter**：本文件
是唯一 adapter（无第二实现计划——「一个 adapter 是假想 seam」不适用，因为 seam 不是本模块
自带的而是它消费的两个既有缝：HeldItems 数据、CameraRig 状态）。
**Depth**：调用方只学 4 个方法（见 interface 契约），得到完整的第一人称手部行为。
与 Avatar 的关系：Avatar 是**第三人称**身体+手持渲染器，HandView 是**第一人称**手部渲染器——
MC 同构（`ItemInHandLayer` vs `ItemInHandRenderer`，姐妹调研 Q3/Q4 已证两层并立）。
一文件一模块成立：viewmodel 是独立 vocabulary（进 GLOSSARY），塞回 avatar.js 是「第二份
vocabulary」拆分信号（conventions §1.4）。

## D2 状态归属：Avatar 保持唯一漏斗，镜像转发（不抽 HandState）

手持物状态（当前持物 id、挥击中、装备动画中）**归属不变**：Avatar 的 setItem/swing 已是
全部 10+ 调用点的唯一漏斗（mode-kit mkHeldSync / adventure×5 / build / arena / main×2 /
input aimClick / combat-kit×3，逐一核实）。Avatar 在自家 setItem/swing 体内各加一行镜像
转发 HandView 同名入口。**为什么不抽共享 HandState**（design-it-twice 的落选方案）：
① 状态仅 3 字段+2 触发，抽层是浅模块；② test/adventure-mode、combat-kit、mode-kit 三处
伪造 Avatar 的既有断言全部碎裂；③ MC 里两层渲染器读的是实体状态，我们最贴近的既有
「实体」就是 Avatar（GLOSSARY：手持物装配与挥击是它的 interface）。rule of three：
第二个消费者出现时再抽。

## D3 数据归属：fp 姿态与挥击曲线归 HeldItems（唯一数据源）

调研结论（正典报告关键数值清单）：第一人称姿态**坍缩为两族**——方块 `[0,45,0]`/scale 0.40；
手持物全族（handheld：镐/斧/剑/锹/**锄头**+generated：食物/材料/棒+**弓**）统一
`[0,-90,25]+[1.13,3.2,1.13]/16+0.68`。因此：
- defs 各条目嵌入 `fp: {pos, rot, scale}`（工厂从两份族常量展开，零逐条复制；与 grip 同
  地位——display 变换本就长在 model 上，MC 正典）；
- 新增纯函数 `HeldItems.swingView(p, def)` → 第一人称挥击偏移 `{px,py,pz,rx,ry}`：曲线
  形状照正典 sin(π√p)/sin(2π√p)/sin(πp) 家族（报告 Q3），幅度按 def.swing.amp 归一；
  **契约不变量：p=0 与 p=1 全零（端点归零，与 swingPose 同纪律）、0<p<1 时 px<0（前送）**；
- 缺 `fp` 的 def（未来手滑新增）回落手持物族常量——不炸、观感可用。
HeldItems 保持 Node 可测（顶层零 THREE 不破）；hand-view.js 只做装配与施加，不做数据决策。
另收编两 renderer 的共同生命周期：`HeldItems.swap(oldGroup, def)` = 释放旧网格（traverse
dispose）+ 按新 def mount——Avatar.mountItem 与 HandView 两个 adapter 同一套「沉底换网格」
舞步，收口一份（两个消费者=真 seam）。

## D4 渲染通道：独立 scene + 独立相机 + clearDepth（MC 同构）

HandView 自建 `handScene`（环境光+方向光固定灯）与 `handCam`；`render(renderer, camera)`
在主渲染**之后**调用：`autoClear=false → clearDepth() → render(handScene, handCam) →
autoClear 恢复`。与正典逐条对齐：清深度=永不插墙（报告 Q1.2 确证）；投影每帧从主 camera
同步 fov/aspect/near/far（正典共用投影，报告 Q1.4）；handScene 无雾（正典手部不受距离
雾影响）。**刻意差异**：光照用固定灯不采样玩家位置世界光（正典为 packedLight）——洞穴里
手不变暗，对 6 岁用户是更友好的观感，登记附录 B #4。

## D5 可见性：`mode===0 && !CameraRig.mounted`

camDist=0 有两义（第一人称 / 载具锚），只看返回值区分不开。CameraRig interface 增一个
只读 `get mounted()`（mountFn 状态现有字段的一行暴露）；HandView.update 自行判定可见性
（视图模型的可见性政策是它的内聚知识，不上收 main.js——否则调用方多学一个参数，变浅）。
非第一人称帧：动画照常推进（对齐 Avatar「隐藏期间也走完」纪律），render 走 no-op——
第三人称下切快捷栏，转回第一人称时手已是新物，无补动画跳变。

## D6 动画口径（全部常数引正典，数值=观感折算起点，调参不判红）

- **equip**：沉 0.6（正典 −0.6×progress 视空间直取）→ 沉底换网格（`HeldItems.swap`）→ 抬起；
  半程 0.14s 与 Avatar 的 EQUIP_HALF 同值（两层同拍）。
- **挥击**：swingView 曲线（D3），dur 沿 def.swing.dur（剑 0.2s … 弓 0.3s）；连挖节拍
  （ADV_MINE_SWING 注入 Avatar.swing）镜像后自动连续循环（正典 continueAttack 同义）。
- **裸臂**：空手 = 只渲染小臂模型（正典 renderPlayerArm，报告 Q2 逐行常量折算：基座
  ≈(0.64,−0.6,−0.72)、旋转链 rotZ120→rotX200→rotY−135）；盒子建模（肤+蓝衫袖口，对齐
  玩家皮肤身份色），不剖官方 64×64 皮肤 UV。持物时臂照画（正典 arm+item 同栈渲染）。
- **持物基点**：ITEM_POS (0.56,−0.52,−0.72) 视空间直取（正典常量，格单位同刻度）。
- **鼠标滞后**：视角角与平滑角差 ×0.1 施加于手部组（正典 xBob/yBob 机制，报告 Q1.5 确证）。
- **走路 bob**：步频相位（vel/onGround 自读 voxel.js 玩家段，引擎同侪合法）驱动的小幅
  平移椭圆；幅度常数 hand-view 本地（装配常数，非物品数据、非玩法政策，不入 config.js）。

## Interface 契约（调用方唯一须知）

```
HandView{                       // js/hand-view.js · 引擎层 · 加载序 held-item → hand-view → avatar
  setItem(id)                   // 词表同 Avatar.setItem（id|null）；同目标幂等；equip 动画自持
  swing()                       // 触发一次第一人称挥击；连触发=连挥
  update(dt)                    // 主循环每帧恰一次：推进动画+可见性自判（D5）；隐藏帧只推进不渲染
  render(renderer, camera)      // 恰在 renderer.render(scene,camera) 之后一次：可见=clearDepth 通道，否则 no-op
}
```
- 消费方仅两处：main.js（update+render 各一行）、avatar.js（setItem/swing 各一行镜像）——
  模式层与输入层零改动、零感知。
- 触发时序自由（update 前后皆可）；跨帧不持有 render 返回；HandView 不改写主相机与主场景。
- 可测性：held-item.js 侧（fp 数据 + swingView + swap 形状）Node 直测；hand-view.js 本体
  THREE 顶层装配，boot 冒烟覆盖（同 avatar.js 惯例），不直测。

## 附录 B 差异登记表（§1.12 伴生机制清点：不移植项与后果）

| # | MC 机制 | 处置 | 后果 |
|---|---|---|---|
| 1 | 拉弓张弓动画（BOW_CHARGE_Z/SHAKE、pulling 换贴图） | 不移植 | 弓第一人称静态持握+放箭一次 swing；蓄力反馈仍由第三人称层与准星承担 |
| 2 | 进食抖动（EAT_JIGGLE 指数 27 曲线） | 不移植 | 进食瞬间一次 swing 观感 |
| 3 | 放置专用动画 | 无需（正典=一次标准 swing，确证） | 无差异 |
| 4 | 手部光照取玩家位置 packedLight | 不移植（固定灯） | 洞穴里手不随环境变暗（儿童友好，刻意保留） |
| 5 | 世界侧 view bobbing 烘焙进共享投影 | 不移植（仅手部滞后+bob） | 走路时世界不晃、手轻晃；晕动更少 |
| 6 | crossbow/shield/spyglass/totem 等 display | 不移植 | 游戏未引入这些物品；新物品若加，走 def.fp 两族常量即自动适配 |
| 7 | 左手（offhand） | 不移植 | 单右手，正典 main-hand 口径 |
| 8 | FOV 速度效果管线作用于手部 | 随主相机自然共享 | 无差异（我们同步投影，效果自动传导） |
| 9 | 图腾发动/还elapsed 40tick 特殊动画 | 不移植 | 无图腾物品 |

## 分票计划（施工序，票票独立绿）

| 票 | 内容 | 守门 |
|---|---|---|
| T1 | HeldItems：两族 fp 常量 + 工厂/条目嵌入 + defFor 回落；swingView 纯函数；swap 生命周期收口 | held-item.test.js：全族 fp 形状/两族数值断言、swingView 端点归零+前送、swap 幂等释放 |
| T2 | js/hand-view.js 新模块（scene/cam/裸臂/装配/四动态/通道）+ index.html 装载序 | boot 冒烟 + conventions 横幅契约 |
| T3 | 接线：avatar.js 镜像 ×2 + camera-rig `get mounted()` + main.js 两行 + 三处头注释增补 | 既有 Avatar 伪造测试全绿（零改动预期）；boot 全链 |
| T4 | 文档收口：GLOSSARY 新词条 HandView + Avatar/HeldItems 词条 interface 增补 + docs/README 登记 | conventions 文档死链断言；`npm test` + `npm run lint` 全绿 |

## 验收

- V 键切第一人称：手+物可见、不插墙；16 工具/锄/剑/弓/方块/食物/木棍/空手逐族观感正确；
  切快捷栏有 equip 下沉换物；挖/放/攻击有挥击；驾驶坦克手消失；第三人称零回归。
- `npm test`（含 boot 全链 + 规范守门）与 `npm run lint` 零错误。
