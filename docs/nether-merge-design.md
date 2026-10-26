# 下界并入探险模式 · 设计定稿与施工契约

> 2026-10-26 用户拍板（三轮 grill 记录在案）。本文是施工期唯一契约源：
> 各轴子代理凡命名/形状/键名与本文冲突，以本文为准；本文未覆盖的实现细节，
> 遵循 AGENTS.md + docs/conventions.md + 邻近代码先例。

## 一、定性

下界冒险模式（`nether`）退役。「下界传送门」成为探险模式（`adventure`）全表
最贵的合成物：合成 → 放置 → 踏入，抵达一个与上界**同规则**、暂无资源与怪物、
改动**记账落盘**的下界远征地图（地形与原 nether 模式逐字一致：平地下界岩 +
成片熔岩池 + 固定回程门）。

## 二、决策清单（全部已拍板）

| # | 决策 |
|---|------|
| D1 | `nether` 注册行/卡片/菜单页/script/`test/nether-mode.test.js` 全删；下界 = 探险模式内部 phase |
| D2 | 波次/AI/`NETHER_MOBS`/火球管线/独立武器栏全部裁撤，无怪物，唯一危险 = 岩浆 |
| D3 | 配方：8 金锭环形 + 中心 1 钻石，station `'table'`，追加在 RECIPES **最末**（配方书压轴） |
| D4 | 传送门是放置型物品：放下长出整座 6×7 门（塔楼/门楣/步道/紫色光束照旧） |
| D5 | 门框/门面永不可破坏（声明式）+ TNT 免疫；挖它给儿童话术 |
| D6 | 可重复合成、放多座；下界内也允许放（任何下界的门都通往「最后进入的上界门」旁） |
| D7 | 下界与上界同规则：能放就放，挖不挖得动由硬度表说话（下界岩系当前均无 `hard` = 挖不动，接受） |
| D8 | 下界改动**记账落盘**：journal 分桶（建造模式 `{sceneId: Map}` 先例），下次进界原样重放 |
| D9 | 维度不进档：下界退出游戏 → 重进回上界小屋出生点（flush 时 pos 写 null） |
| D10 | 人在下界 dayTime 暂停（`dayCycleOn = false`，main.js:272 既有门）+ 恒夜暗红天 |
| D11 | 死亡统一走探险死亡计划（回家+满血+保留背包），下界死亡顺带切回上界 |
| D12 | `ADV_QUESTS` 零改动；配方卡常驻配方书、缺料亮灰（既有 canCraft 亮灰机制） |
| D13 | 活着走门回上界**不**自动回血（疗伤走小屋机制）；放置朝向固定（门面朝 ±z），不随视角旋转 |
| D14 | 炉具状态键加界前缀（下界熔炉与上界同坐标炉不串档） |
| D15 | 建场/门框/内口判定/落点/放置校验剥核进 `adventure-core.js` 纯核心；观感与装配留壳 |
| D16 | 新测试独立文件 `test/adventure-nether.test.js`（不塞 160KB 的 adventure-mode.test.js） |
| D17 | 修活下界熔岩池（2026-10-27 施工期拍板）：原版 `hashRand>0.93` 恒假（输出域截断 [0,0.5)）——退役前下界从未长过熔岩，与「唯一危险=岩浆」共识相悖；改 `SceneKit.rand` 全域散布（同 seed 同图，确定性红线不破），测试断言熔岩非零且不成海 |

微默认（已公示无人否决）：无 `hard` 方块的「挖不动」话术扩展到全部下界岩系（节流）；
「巨大地下室」场景随 nether 模式退役（建造模式原件不动）；HUD 下界阶段行 + 出发页文案。

## 三、施工契约（跨轴共享的名字与形状）

### 3.1 物品与配方（轴 A）

- ITEMS 新键 **`nether_portal`**：`{name: '下界传送门', ...}`，放置型语义但**无 `block`
  字段**（结构放置由探险壳拦截，不走单格 editHit 放置路径）。HeldItems 侧零改动
  （注册物品非工具/武器/方块/棒 → mkPlateDef 薄片，既有 defFor 分支覆盖）。
- RECIPES 追加最末一条：
  `{id: 'nether_portal', out: {item: 'nether_portal', n: 1}, station: 'table',
   shape: {rows: [['gold_ingot','gold_ingot','gold_ingot'],
                  ['gold_ingot','diamond','gold_ingot'],
                  ['gold_ingot','gold_ingot','gold_ingot']]}}`
- ITEM_HINTS['nether_portal'] 一句儿童说明（键集一致有守门测试）。
- ITEM_PIX['nether_portal'] 16×16 字符画（紫门漩涡，全量覆盖有守门测试）。
- **breakTime 声明式不可破坏**：`blockDef.hard == null` → 返回
  `{time: Infinity, drops: false}`（替代现在的 NaN 意外），模块头注释同步。
  消费侧语义：`!isFinite(bt.time)` = 不可破坏。config.js 下界方块段加一行
  注释声明「无 hard = 声明式不可破坏（含 TNT 免疫判据）」。

### 3.2 adventure-core 下界段（轴 B）

遵循文件内先例：建场函数直用全局 `setBlockRaw`/`hashRand`（同 advBuildWorld），
判定/校验函数注入 read seam（同 2026-10 政策下沉包口径）。常量与函数名**固定**：

```js
const ADV_PORTAL = {w: 6, h: 7, cd: 0.8};
//   门框宽×高(内口 4×5) + 传送冷却秒(落地时空眩晕, 两界门都不触发)
const ADV_NETHER = {ground: 20, portal: {px: 24, pz: 24}, base: {x: 25.5, z: 30.5}};
//   下界平地顶层 y(脚踩 21) / 回程门框位置 / 下界落点(离门 5 格, 避开出生环)

function advNetherBuild() {}            // 平整下界岩 + 3×3 成片熔岩池(hashRand>0.93,
                                        //   出生区 x,z<44 不铺) —— 逐字迁自 buildNetherWorld
function advPortalFrame(set, by, px, pz) {}
//   整座门: 黑曜石框+塔楼+门楣+发光岩+步道+内口 B_PORTAL 门面 —— 逐字迁自
//   buildPortalFrame; set(x,y,z,id) 注入: 场景基座传 setBlockRaw, 玩家放置传
//   「setBlockRaw+advMarkEdit 逐格记账」sink(结构以 edits 形态存在, 重放即重建)
function advInPortal(read, x, y, z) {}  // 玩家浮点坐标 → 脚格/头格任一为 B_PORTAL
                                        //   即在门内口(O(1) 判定, 免门位注册表; 玩家放置
                                        //   的门与下界回程门同一条判据)
function advPortalSiteOk(read, p, by, px, pz) {}
//   放置校验: 结构包围盒(x: px-1..px+w, y: by..by+h+2, z: pz-1..pz+1)全为空气,
//   且玩家不入盒。返回 {ok:true} | {ok:false, reason:'blocked'|'inside'}
function advPortalExit(x, y, z, yaw) {}
//   传送出口: 沿玩家来向退 2.5 格、yaw 反向(落地推前进=离开门) —— yaw 约定
//   (forward=(sin,cos), Mobs.steer 同源)在单测里钉死数值
```

exports 追加进 module.exports 清单。波次/AI/武器常量（NETHER/NETHER_MOBS/
startNetherWave/checkWaveClear/netherAI/NETHER_ATTACK_T）**不迁**，随模式退役删除。

### 3.3 探险壳装配（轴 C，文件 js/modes/adventure.js）

- 维度态：`let advDim = 'overworld'`；`const advSceneEdits = {overworld: Map, nether: Map}`。
  init 换装：overworld 桶 = `advJournal.edits`（load 收养后的 Map），nether 桶 =
  档里 `netherEdits`（缺省空 Map）。**切界 = `advJournal.edits = advSceneEdits[advDim]`
  换装**（`mark()/flush()` 动态查 `J.edits`，记账/落盘自动跟桶，建造模式同款缝）。
- payload 改：`(edits) => ({edits, netherEdits: advSceneEdits.nether,
  pos: advDim === 'nether' ? null : {x,y,z,yaw}, hp, furnaces, livestock, dayTime})`；
  decode 侧 `netherEdits` 与 edits 同形透传（Map/数组皆收养，旧档缺省空）。
- 切界函数 `advSetDim(dim)`：换桶 → `loadScene(基座建场 + 重放当前桶 edits)` →
  天空（NETHER_SKY/OVERWORLD_SKY 迁壳，applySky 逐字迁）→ `dayCycleOn` 置位
  （下界 false / 上界 true）→ `Mobs.clear()` + 箭矢 clear → 出生点（进下界 =
  ADV_NETHER.base；回上界 = advPortalExit(进门时刻记录) 或死亡计划小屋）→
  站点缓存重扫当前桶（advStations 只反映当前界）→ 传送门光束重锚
  （扫 worldCells B_PORTAL 列簇，每内口一束 Fx.portalBeam）。
- 传送触发：update 里 `portalCd` 递减 + `advInPortal(read, pos.x, pos.y, pos.z)`
  → 切界（冷却 ADV_PORTAL.cd；进下界时记录 `advPortalExit(...)` 供回程）。
- 放置拦截：手持 `nether_portal` 时放置分支不走 editHit，改 `advPlacePortal(hit)`：
  by/px/pz 取放置目标格 → `advPortalSiteOk` → 失败给儿童话术（「这里太挤啦，
  找块大空地」/「站远一点再放哦」）→ 成功 `advPortalFrame(记账 sink)` + 扣 1 物品
  （InventoryCore.remove/take 既有接口）+ TTS 表扬。
- 岩浆伤害：既有 `worldEvents.lavaTick → advEnvHurt(FLUID.lavaDps, ...)` 路径已
  覆盖（nether 模式的同款逻辑删除，不并第二份）。
- 死亡：既有死亡流前插 `if (advDim === 'nether') advSetDim('overworld')`
  （出生点用死亡计划的回家语义，不用 advPortalExit）。
- 怪物：回上界需重播上界怪（nest/牲畜 seeding 从 init 里提出为可重调函数，
  init 与回界共用；下界无怪）。牲畜 dead 索引照旧只增不减。
- 炉具键：下界 posKey 前缀 `'n|'`（上界键不前缀 → 旧档天然兼容）；advFurnaceValid
  类校验对 nether 键在下界建场后顺路核销。
- HUD：下界时首行 `🌌 下界 · 黑漆漆亮晶晶`（或同味文案），时段行下界态不显示白日夜历。
- cleanup：dayCycleOn 复位 true、天空复位、光束句柄摘除、桶引用复位（journal.edits
  换回 overworld 桶）。

### 3.4 模式退役（轴 D）

- js/modes/nether.js 删除；test/nether-mode.test.js 删除。
- js/mode-registry.js：删 nether 行；index.html：删 cardNether（~64-67 行）、
  menuNether 页（~176-186 行）、nether script 标签（~337 行）——mode-registry.test
  的三重命名断言自动收敛，不必改测试。
- index.html 探险出发页文案加一句下界指引（攒 8 金锭 1 钻石合成传送门去下界看看）。

## 四、轴与文件所有权（互斥，防编辑冲突）

| 轴 | 文件（独占写） | 产物 |
|----|----------------|------|
| A | js/craft-core.js · js/items-core.js · js/item-hint-registry.js · js/icons.js · js/config.js（仅注释）· test/craft-core.test.js（追加） | §3.1 |
| B | js/adventure-core.js · test/adventure-nether.test.js（新建） | §3.2 |
| C | js/modes/adventure.js · test/adventure-nether.test.js（追加模式级断言） | §3.3 |
| D | js/mode-registry.js · index.html · 删 js/modes/nether.js · 删 test/nether-mode.test.js | §3.4 |
| E | GLOSSARY.md · docs 收尾（收尾波，主会话执行） | 词条更新 |

波次：A/B/D 并行 → C（依赖 A 的物品键 + B 的核心函数）→ E + 全量 `npm test`
+ `npm run lint` 收尾（主会话）。施工期各轴只跑自己名下的定向测试
（`node --test test/<file>.test.js`），全量测试统一由收尾波执行。

## 五、红线

- 确定性重放红线：下界基座建场零 `Math.random`（hashRand 种子化）；同一份桶 edits
  经重放后两界状态必一致（test 对症断言）。
- 旧档兼容：无 `netherEdits`/pos 为 null 的旧档照常载入（缺省空桶/小屋出生）。
- 互锁：结构放置只以 edits 形态存在（放置 sink 逐格记账），基座建场不记账——
  与「journal 互锁红线」同构。
- 引擎不知道玩法：门/传送/维度全是应用层政策，不进引擎层任何文件。
