# 门与玻璃板（合成家具）设计稿

> 主题三段式：调研见 [door-window-research.md](door-window-research.md)（MC 正典事实，一手来源逐条可溯）；
> 本文是设计定稿。配方匹配语义与全表见 [mc-crafting-grid-research.md](mc-crafting-grid-research.md)。
> 日期：2026-10-27。工作分支：worktree `doors-windows`。

## 0. 一句话

探险模式合成系统新增「门」与「玻璃板（窗）」两个放置型家具：配方与外观照搬 Minecraft 正典
（6 木板 2×3 → 3 扇门；6 玻璃 3×2 → 16 玻璃板），门是 2 格高可开关的真结构，玻璃板是
竖直薄板、按邻居自动连接成窗。

## 1. 拍板记录（用户 2026-10-27 全部同意）

| # | 决策点 | 拍板 |
| --- | --- | --- |
| ① | 门做几格高 | **2 格真结构**（下界传送门 D4 结构放置先例），不做床式 1 格简化 |
| ② | 玻璃板掉落 | **掉自身**（零惩罚哲学，冰/玻璃块同款先例；偏离 MC「无精准采集不掉」） |
| ③ | 门的朝向/铰链 | v1 **固定朝向 + 开关换方块 id**（铰链固定左；不存 facing/hinge 状态） |

## 2. 数据层（三张注册表加行，无新文件）

### 2.1 号段（config.js）

方块 id 从 **63 顺延到 67**（`test/blocks-fields.test.js` 的「63+ 预留」红线按本票解禁，
红线外推到 68+；63~67 新增断言）。物品 id：`door`、`glass_pane`（snake_case 惯例）。

```js
const B_DOOR=63; const B_DOOR_TOP=64; const B_DOOR_OPEN=65; const B_DOOR_TOP_OPEN=66;
const B_GLASS_PANE=67;
```

门用 4 个 id 表达「上/下半 × 关/开」（麦四阶段 B_WHEAT_0..3 同款「状态即 id」口径）：
开关 = 下半与上半各换成对 id，两格都走 `editBlock`（关门/开门改变挡光性，必须走光场全链——
与传送门 `setBlockRaw` 的唯一分叉，传送门 light-neutral 故可直写）。

### 2.2 BLOCKS 行（语义表）

| id | name | solid | glass(透光) | pane(渲染路由) | hard/tool/tier | drop |
| --- | --- | --- | --- | --- | --- | --- |
| 63 B_DOOR | 门 | ✓ 关门挡人挡光 | — | ✓ | 3.0 / axe / 0（MC 同值） | `[['door',1,0]]` |
| 64 B_DOOR_TOP | 门(上) | ✓ | — | ✓ | 3.0 / axe / 0 | 无（整扇回收走配对政策，防双掉） |
| 65 B_DOOR_OPEN | 门(开) | **false** 可穿行→透光 | — | ✓ | 同 63 | `[['door',1,0]]` |
| 66 B_DOOR_TOP_OPEN | 门(上·开) | false | — | ✓ | 同 64 | 无 |
| 67 B_GLASS_PANE | 玻璃板 | ✓（格粒度挡人，附录 B） | **✓**（窗户透光） | ✓ | 0.3 / null / 0（MC 同值） | `[['glass_pane',1,0]]` |

- **四个门 id 与玻璃板一律不挂级联旗标**（fell/need/thin/fall 全不带）。两个原因：
  1. 级联 `isSupport = solid !== false`（cascade-core.js mkPolicy）——门上半的支撑是下半，
     而下半**开门态 solid:false**，挂 thin 会在开门瞬间被判失撑脱落、重进还会被世界卫生
     清扫当悬空违例清掉；thin 同时驱动渲染路由（贴地板/十字片），门形状也不对。
  2. 玻璃板无旗标 = 失撑浮空，**恰好与 MC 一致**（原版玻璃板挖掉脚下也浮空不掉）。
  门的成对自洽改走模式层政策（§3），身份原则不破（政策读 id，不含位置条件）。
- `pane: true` 是渲染身份旗标（B_PORTAL 的 `portal: true` 同款先例）：mesh-core 在
  fluid/atlas/thin/tnt 分支**之前**路由到竖直薄板路径。

### 2.3 ITEMS 行（items-core.js）

```js
door: {name: '门', icon: '🚪'},                    // 无 block 字段: 结构放置(壳拦截, D4 先例)
glass_pane: {name: '玻璃板', icon: '🪟', block: 67}, // 常规单格放置路径
```

手持观感零接线：`door` 走 HeldItems 的 mkPlateDef 薄片缺省，`glass_pane` 走 mkBlockDef。

### 2.4 RECIPES 行（craft-core.js，图案逐条对照正典配方 JSON）

```js
// 门(MC 正典 oak_door.json): 6 木板 2 列×3 行 → 3 扇; 需 3 行 → 工作台级
{id: 'door', out: {item: 'door', n: 3}, station: 'table',
  shape: {rows: [['planks', 'planks'], ['planks', 'planks'], ['planks', 'planks']]}},
// 玻璃板(MC 正典 glass_pane.json): 6 玻璃 3 列×2 行 → 16 块; 需 3 列 → 工作台级
{id: 'glass_pane', out: {item: 'glass_pane', n: 16}, station: 'table',
  shape: {rows: [['glass', 'glass', 'glass'], ['glass', 'glass', 'glass']]}},
```

追加在 `nether_portal` 之后（配方表尾部）。全表 35 → **37**（随身 10 + 工具 16 + 站点件 8 +
传送门 1 + 门/玻璃板 2），craft-core 头注释与 GLOSSARY 词条计数同步。原材料链现成：
`SMELTS.sand → glass` 已存在，玻璃板教学点 =「窗比墙省料」（6 块玻璃出 16 块板）。

## 3. 政策纯函数（adventure-core.js 新增三件，全走注入 seam，有单测）

### 3.1 advDoorSiteOk(read, x, y, z) → {ok, cells} | {ok: false}

结构放置校验（advPortalSiteOk 同款缝）：目标格与上格必须为空气、目标格下方为实心支撑
（`solid !== false`，含门不叠门的自然排除）、玩家两格皆不占（防把门放自己身上）。
返回 `cells = [{x,y,z,id:63},{x,y,z:y+1,id:64}]`（闭合态对）。

### 3.2 advDoorTogglePlan(read, x, y, z, lookId, playerCell) → {ok, writes} | {ok: false, why}

开关计划：命中门任一半 → 定位下半格 → 读下半 id 得当前态 → 产出两格的**对换写入**
（63↔65、64↔66 恒成对）→ 若关门且玩家站在门洞两格任一格 → 拒（`why:'occupied'`，
壳出儿童话术；怪物不查，附录 B）。开/关都走此函数（幂等：id 即状态）。

### 3.3 advDoorBreakPlan(read, x, y, z) → {cells, drop}

配对破坏政策（MC 口径：挖任一半=整扇消失、掉 1 扇门；挖门正下方支撑=门整扇弹出）：
挖掉的格是门 → 连带另半格；挖掉的格**正上方**是门下半 → 连带整扇；`drop` 恒 `'door'` ×1
（上半不掉、双半不双掉——上半 drop 字段留空即自洽）。壳在挖方与 TNT 两个移除点之后
调用，对 cells 逐格 `advMarkEdit + editBlock`，drop 走既有掉落物通道。

## 4. 壳接线（modes/adventure.js，全部有先例）

1. **放置**：`isPlaceable` 判定加 `|| s.id === 'door'`（L302 先例行）；`advTryPlace` 在
   nether_portal 分支旁加 `if (s && s.id === 'door') return advPlaceDoor(hit);`——
   走 advDoorSiteOk → 两格 `advMarkEdit + editBlock`（非 setBlockRaw，见 2.1）→
   TTS「门放好啦」+ door_swing 音。
2. **交互**：`onMouse` 两条链（左/右键）在 `advTrySleep` 之后插 `advTryDoor(hit, lookId)`
   （「使用先于放置」链序，床先例）——读 lookId ∈ 4 门 id 即走 advDoorTogglePlan，
   `editBlock` 两格 + door_swing 音 + 话术「吱呀～门开啦/关门啦」。
3. **挖方**：挖方结算点（L1471 附近）在 advCascadeApply 之后调 advDoorBreakPlan；
   TNT 的 `edit` 回调（L1895）同款补调（TNT 掀门=整扇消失+掉 1，掀掉的不进任务 P6 口径）。
4. **音效**：audio-registry 新 kind **`door_swing`**（纯 synth：低频方木叩 `{type:'square',
   f0:180, f1:95, fT:0.09, dur:0.12, g:0.09}`，prio 1，coolMs 150 防连点爆音）。
   **不得叫 `door`**——那是 TNT 密室时代的死键，`test/audio-registry.test.js` 断言其不迁。
5. **体验馆**：SHOWROOM_STOCK 加 `door×2、glass_pane×16、glass×8`（加行=加材料惯例，
   开发者上手验开关/连接）。

## 5. 渲染（mesh-core.js 新增竖直薄板路径 pushPane）

### 5.1 路由与通道

`if (b.pane)` 分支插在 fluid 之后、atlas 之前；几何推入**图集通道 A**（alphaTest 材质：
玻璃板中间全透明像素被裁掉 = 免费的真透明，植物管线同款），顶点光取自身格（薄块口径 §4.1）。

### 5.2 几何变体（v1 固定朝向，拍板③）

- **门·关**（63/64）：门板贴格子**北缘**——`z ∈ [0, 0.1875]`（MC 厚 3/16），横跨 x 全宽，
  全格高；铰链=西北角。
- **门·开**（65/66）：门板绕西北角竖轴转到**西缘**——`x ∈ [0, 0.1875]`，横跨 z 全宽
  （= MC `_open` 模型的 y 轴 90° 旋转，无扫击动画、瞬间换姿，MC 同口径）。
- **玻璃板**（67）：MC 正典几何——无邻接 = 中柱 `x/z ∈ [7/16, 9/16]`；四方向按需出连接臂
  延伸到格缘。**连接判据在网格化时现算**：邻格是玻璃板或实心方块（`solid !== false`）即连接，
  纯几何判定零存储、重放安全（= MC 的 east/north/south/west 四布尔，但我们不存状态）。
  邻格读取用既有 `lget`（packChunkData 边界圈保证跨区块正确）。
- 每个面片 = 一个四边形双面（FrontSide 材质下正反各绘，pushCross 同款手法）；
  门板正面/背面贴 tile，薄侧面复用 tile 边缘列 UV（3px 拉伸不可辨）。

### 5.3 贴图（texture-atlas.js，程序自绘 16×16，零外部素材）

- `door_bottom`：橡木板竖纹 + 底部踢脚深色带（对齐 MC oak_door_bottom 观感语言）；
- `door_top`：橡木板竖纹 + 右下门把手 2×3 深色块（oak_door_top 口径）；
- `glass_pane`：2px 浅色不透明边框 + 中间全透明 + 1~2 道斜高光线（对齐 MC「玻璃=不透明
  框+透明芯」的窗框观感）；
- layout 加 3 条（id 63~67 → tile 号），节点：图集 count 与单测同步。

### 5.4 LOD

门/玻璃板无 thin 旗标 → LOD 列采样**不算薄块、当普通格参与**：远处关门=木色实心立方
（嵌在墙上即墙）、开门格=空气（门洞）。可接受，附录 B 登记。

## 6. 光照与碰撞（免费获得，零引擎改动）

- 玻璃板 `glass: true` → LightCore `opaque = 实心且非玻璃` 不命中 → **窗户透光**；
- 开门格 `solid: false` → 同式透光 → **开门放光进屋**；
- 关门格实心 → 挡光挡人挡怪（夜怪进不了关着的门——儿童注意力游戏的正向小策略）；
- 玻璃板格粒度挡人（MC 是 2px 碰撞箱）——附录 B。

## 7. 测试计划

| 测试 | 改动 |
| --- | --- |
| test/craft-core.test.js | 35→**37**（头注释 breakdown 同步）；新断言：door/pane 图案、station、产出 3/16、镜像可摆、matchGrid 往返 |
| test/blocks-fields.test.js | 「不占 63+」红线 → **68+**；新增 63~67 字段断言（pane 旗标、开关 solid 对、drop 缺省、glass 旗标只在 67） |
| test/items-core.test.js | block 字段值域 1~62 → **1~67**；注册表全量清单补 2 键 |
| test/adventure-core.test.js | 新增 advDoorSiteOk / advDoorTogglePlan / advDoorBreakPlan 纯函数断言（站点拒放四态、上/下半命中、玩家占位拒关、挖下连上、挖地弹门、drop 恒 1） |
| test/mesh-core.test.js | pushPane 几何：玻璃板中柱/连接臂四边形数与坐标、门开/关顶点位置、邻实心连接 |
| test/icons-item.test.js · test/item-hint-registry.test.js | 键集全量等价自动守门——补 ITEM_PIX 字符画 ×2、ITEM_HINTS ×2 即绿 |
| test/audio-registry.test.js | 字面量扫描自动守门——注册 door_swing 即绿；死键断言（'door' 不迁）保持并加注释 |
| test/boot.test.js · test/conventions.test.js | 冒烟/规范自动 |
| test/drops.test.js | item.block ↔ BLOCKS 交叉校验动态派生，67 入表即绿 |

## 附录 A：与 MC 差异登记表（conventions §1.12 伴生机制清单）

移植对象伴生机制逐条清点（调研 §门/§玻璃板 → 结论）：

| MC 机制 | 移植 | 后果/说明 |
| --- | --- | --- |
| half（上下两半，上半依附下半） | ✓ | 2 格结构放置 + 配对破坏政策（advDoorBreakPlan） |
| open（开关状态） | ✓ | 「状态即 id」：63↔65 / 64↔66 成对换 |
| facing（朝向） | ✗ | 固定贴北缘；门放在东西向墙上时观感平行于走道（v1 接受，拍板③） |
| hinge（左右铰链） | ✗ | 固定左铰链（拍板③，孩子感知不到） |
| 双门联动（相邻同种门自动对铰链） | ✗ | 两扇门各自独立开关 |
| 红石开关 / 村民开关门 | ✗ | 无红石系统；探险无村民 NPC |
| 失撑掉落（挖门下支撑→门掉） | ✓ | 经配对政策钩（挖方/TNT 移除点后扫正上方），不走级联（§2.2 原因 1） |
| 门作燃料（烧 1 件） | ✗ | 不设 fuel 字段 |
| 水与门（关门挡水） | 部分 | 关门格实心天然挡流；开门格非空气、按液体「目标=空气」口径不导水——开门挡水偏离 MC，登记不动（fluid-core 零改动） |
| 玻璃板连接（east/north/south/west 四布尔） | ✓ | 网格化时读邻格现算，零存储（比 MC 更省：无 blockstate） |
| 玻璃板无精准采集不掉落 | ✗ | 掉自身（拍板②，零惩罚哲学） |
| 玻璃板 2px 碰撞箱 | ✗ | 整格碰撞（格粒度引擎口径，与所有方块一致） |
| 玻璃板失撑浮空 | ✓ | 无级联旗标 = 浮空，恰好 MC 一致 |
| 门硬度 3/斧头、玻璃板硬度 0.3/无工具 | ✓ | breakTime 数值直抄 MC，儿童封顶 8s 兜底 |
| 开关音效 | ✓ | 合成 door_swing（MC 门吱呀声的观感语言，像素全部自绘的音频同款原则） |

## 附录 B：登记为已知 v1 限制（非偏离，备忘）

- LOD 远景：关门=木色立方（当墙）、玻璃板=无细节立方；走进全细节环恢复薄板真身。
- 玩家站门洞时拒关门（有话术）；**怪物**站门洞时关门不查——怪物卡门洞为极端个案，
  物理逐帧推出，观察后再议。
- TNT 掀门走配对政策（整扇消失+掉 1），掀掉的门不进任务（P6「TNT 掀掉的不算」口径）。
