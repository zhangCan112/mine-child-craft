# 体验馆设计（showroom）— dev-only 调试模式

2026-10-25 · 配套词条：GLOSSARY「体验馆」· 共识出自 grill 会话（13 问全落）

## 1. 是什么

真游戏场景去掉跑图与挖掘：平地空场 + 预置熔炉 + 满材料背包。做出来的东西
在这里上手玩一遍找 bug——开发者亲手玩，不是自动化测试管线。v1 展品：熔炉。

红线（词条已锁）：不计儿童时限（gated:false）；不读不写任何存档键（含共享
背包 inventory_save——ADR 0002）；炉态纯内存，退出即清。

## 2. 设计点 D1 · dev 可见性

**模块**：ModeRegistry 的 dev 面。**接口**：行上一个 `dev:true` 数据字段——
仅此而已，不新增派生函数。**缝**：注册表（唯一权威）→ HTML 卡 class /
CSS 规则 / main.js 解锁，三方都是派生产物，测试对着派生端断言（三重命名
同款守门路径，§1.10 升格判据的迷你应用）。

三个候选接口：

| 方案 | 形态 | 否决理由 |
|---|---|---|
| A **选定** | 卡带 `dev` class + CSS 默认藏 + `body.dev-on` 解锁 | — |
| B | main.js 运行时藏（refreshPlayCards 同款 toggle） | defer 脚本弱网下首帧闪现；显隐逻辑进 JS |
| C | 独立 lab.html | Q7 已否决：重复主循环基建、boot 冒烟不守 script 序 |

A 的分工各一层：HTML 声明身份（`class="mode-card showroom dev"`）、CSS 拥有
默认隐藏（`.mode-card.dev{display:none}` + `body.dev-on .mode-card.dev` 还原）、
main.js 只做解锁（读 `?dev=1`，config.js `?touch=1` 同款 try/catch 惯例 →
`body.classList.add('dev-on')`）。注册表 dev 事实在 HTML class 里的那份影子
由测试守门，防漂移。

深度论证：后来者加一个 dev 模式 = 注册表一行 + 卡一片（带 dev 类），
CSS/main.js/测试零改动——接口一个布尔字段，杠杆全在派生端。

## 3. 设计点 D2 · 熔炉复用

缝已经存在且是真的：adventure-core 的烧炼纯函数族（`advSmeltStep`/
`advFurnaceRefund`）+ ModeKit `mkFurnacePanel`（纯显示+意图出口：
setSlots/setProgress/setFuel 喂显示、onAutoFill 只出 plan 不动背包）。
探险的炉与体验馆的炉是同一缝上的两个 adapter——这正是"two adapters
means a real seam"。

三个候选策略：

| 方案 | 形态 | 否决理由 |
|---|---|---|
| A **选定** | 体验馆薄接线：自持炉态 Map，update 里 advSmeltStep 推进，面板照探险同源件装配 | — |
| B | 现在就抽 mkFurnaceKit，探险+体验馆双消费 | 第二个 adapter 刚出生；两侧持久化语义不同（探险落世界档/体验馆纯内存），一个半消费者时拍接口容易拍歪；还要动探险（回归风险） |
| C | 体验馆自写简化烧炼 | 第二份烧炼实现——体验馆测的就不是探险那只炉了，违立馆目的 |

**升级触发器（显式登记，不默默欠债）**：v1 落地时若接线镜像 >80 行，或炉
行为改动需要两处同步改，立即开票抽 mkFurnaceKit（mode-kit 或独立 kit，
届时接口由两个真实消费者共同塑形）。

## 4. 模块接口与装配（js/modes/showroom.js）

**interface（对 main.js）**：`ShowroomMode = mkMode({id:'showroom', ...})`
标准模式接口 + main.js MODES 表一行；无菜单页（page:false，卡点击直进——
focus/math 同款先例，main.js:155-160 通用接线天然支持）。

**interface（对维护者）**：顶部 `SHOWROOM_STOCK` 数据表（`{id, n}[]`）——
加材料=加一行，别处零改动。初始清单从 SMELTS/FUEL 派生：烧炼全原料
（iron_ore/gold_ore/log/cobble/sand/clay_ball/四种生肉）+ 代表燃料
（煤/木板/木棍）+ 各产物一样（观感对照），总数 ≤27 槽。

**implementation（藏起来的）**：
- 装场：loadScene + SceneKit 平地草场，中心预置熔炉方块，出生点距炉 2~3 格
  （进场即在 4 格解锁圈内，advNearStation 同款判定）；
- 背包：InventoryCore.mkInventory() 内存实例 + 塞 SHOWROOM_STOCK +
  ModeKit.mkHotbar（数字键/滚轮/点选照常）；
- 熔炉：走近点击开面板（4 格门槛，探险同款 UX）；update(dt) 逐炉
  advSmeltStep，面板开时喂 setSlots/setProgress/setFuel；onAutoFill 的
  plan 由模式层经背包核心扣加执行；关面板/退模式 advFurnaceRefund 退料；
- HUD：坐标 + FPS 行（tank-range:450 先例，bug 报告口径）；
- cleanup：面板收、炉 Map 清（世界清场归 main.js switchMode 统一）。

**不变量**：文件内零 localStorage、零任何 `_save` 键字面量；不接指针锁定
（与探险同 UX）→ 无需 conventions §6 登记；挖掘/放置 v1 不接（需要时说一声，接线很薄）。

## 5. 落点清单

| 文件 | 改动 |
|---|---|
| js/mode-registry.js | 加行 `{id:'showroom', name:'体验馆', gated:false, page:false, dev:true, mood:'none'}` |
| index.html | #modeCards 末尾加 `cardShowroom` 卡（class 含 dev）；模式 script 段末尾（adventure.js 后、mode-registry.js 前）加 `js/modes/showroom.js` defer |
| css/style.css | `.mode-card.dev` 默认隐藏 + `body.dev-on` 还原两条规则 |
| js/main.js | MODES 表加 `showroom: ShowroomMode`；启动处读 `?dev=1` → body.dev-on |
| js/modes/showroom.js | 新建（==== 五要素头注释照 §1.7） |
| test/mode-registry.test.js | ① 每 dev 行断言卡在场且带 dev 类；② gated:false 清单 `['focus','math','showroom']`；③ playModeIds 五个不变（既有断言自动守） |
| test/showroom-mode.test.js | 新建（adventure-mode.test.js 先例）：注册行形状、main.js 接线正则、无 localStorage/save 键字面量（数据隔离守门，audio-registry 键扫同款）、SHOWROOM_STOCK 全 id ∈ ITEMS |
| GLOSSARY.md | 已立（体验馆） |

## 6. 显式推迟（免得日后当成漏）

- **展陈缝**：~~全方块/全怪物陈列是 v2 方向~~ → **v2 已落（§7 D4 展台）**；
  怪物陈列仍推迟（需要 mobs 子系统接线，与全开展馆不同缝）。
- ~~**mkFurnaceKit 抽取**~~：已落（js/furnace-kit.js，T4）。
- ~~**任意发物品面板**~~：v2 已落（§7 D3 套餐+仓库箱，走背包/箱子面板正经缝，
  不做"凭空发物品"的旁路面板）。

## 7. v2 · 冒险全开实验室（2026-10-27）

**定位升格**：体验馆从「平地+熔炉+手抄材料表」升为**「所有条件都满足的冒险
存档替身」**——合成/烧炼/物资三链全开 + 预建大房子与地下室（插满火把、
展台陈列），退出再进恢复原装。红线不变（§1）。

### D3 · 派生供给（本票的核心架构决策）

v1 的 `SHOWROOM_STOCK` 手抄表是同步漂移的根源（冒险加物品必忘改馆），
整体废除。新纯核心 `js/showroom-core.js`（-core 契约：零 THREE 零 DOM，
配同名单测）从权威注册表派生三份供给，**消费方零手抄**：

| 供给 | 派生源 | 规则 |
|---|---|---|
| 背包套餐 | `RECIPES` × `shapeCost` | 全配方材料并集（候选展开），首现序排布，每 id 一行 n=stackMax；超 `INV_SLOTS` 预算自动溢出进「套餐补箱」 |
| 仓库箱 | `ITEMS` 字段驱动 | 首中归桶：`tool‖dur`→工具·耗损箱 → `food`→食物箱 → `SMELTS∪fuel`→烧炼·燃料箱 → `block`→方块·功能箱 → 其余→材料杂物箱；桶满 27 行自动「·续」箱，空桶不建 |
| 展台展品 | `ITEMS.block` − 站点件 | 有 block 字段的物品各摆一份在展台上（站点四件 B_CRAFT/B_FURNACE/B_CHEST/B_BED 除外——它们作为真站点装在场内） |

**同步不变量**（test/showroom-core.test.js 守门）：从套餐背包出发，
**每条 `RECIPES` 配方 `canCraft(inv, r, true).ok === true`**——「所有条件
都满足」的可执行表达；仓库箱五桶 = `ITEMS` 全集的划分（不漏不重）。
以后冒险加新物品 → 按字段自动落箱、新方块自动上展台、新配方自动进
配方书且材料自动进套餐——**体验馆代码零改动**。

面板全走既有 kit（同一缝多个 adapter，不造第二份实现）：合成 =
`ModeKit.mkCraftPanel`（`station:()=>true` 台级配方随处摆、`allow` 放开
全部隐藏配方——dev 全开口径）；箱子 = `mkChestPanel` + adventure-core
的 `advChestPut/advChestTake` 纯函数（每箱一个内存账户，逐箱独立）；
熔炉 = `FurnaceKit`（多炉 posKey 寻址，按点击块绑定）。

### D4 · 展馆布局（js/modes/showroom.js 顶部 SHOWROOM 常数表）

全幅平地草场（0..159，随 WORLD_W——v1 只铺 0..127 是 128 时代旧值，顺手纠偏）。
房子 32×32（木墙四高+木板顶+门+玻璃板窗），室内：北墙工作台×2 + 双炉灶台角、
西墙仓库箱一排（箱数=仓库箱派生长度，锚位自动排）、中央展台两列
（展品=派生清单，2×2 台面各摆一份）、出生圈内即测熔炉（零走动开测）。
地下室：房子下方自密封石壳（下方是清空世界，壳必须自己封住）+ 矿石样本墙 +
楼梯井（1 格台阶降/跳）。火把：室内/地下室周界+走道插满（thin 块光 14，
loadScene 全量光照自动点亮）。

### D5 · v2 显式推迟（免得日后当成漏）

- ~~**挖掘/放置/结构放置（门/下界传送门长结构）**~~ → **已落（2026-10-27
  place-kit 票 d404954，见 §8）**。
- ~~**TNT 点燃+爆炸链 / 拾取入包**~~ → **已落（2026-10-27 TNT 票 3c668bf）**：
  advTntTapStep 短按/按住二分→引信→advExplodeCells 爆炸（圈内链式接力
  点燃/70% 掷骰掉落），掀炉走 showroomMarkEdit 兜底退包；Drops.onCollect
  拾取入包（真空吸附→入包并堆/满包拒收停地重试），补「吸到即蒸发」缺口。
- ~~**玩家 HP+进食+雪球**~~ → **已落（2026-10-27 进食票 97b8761）**：右键
  使用链 站点>门开关>吃>雪球>放置（探险同序）——mkFighter HP 实体+
  advEatPolicy 进食判据+雪球弹池（dmg=0 只击退，零伤害红线）。
- ~~**怪物/昼夜**~~ → **已落（2026-10-27 昼夜票 d205f57）**：dayCycleOn
  白天起步（dayTime 绝不落盘）+入夜固定点位铺夜怪（__nightMob 标记，
  白天下降沿/睡觉唤醒温和清场）+~30 行近战 AI 薄版+左键挥击+满血原地
  复活薄死亡+床睡觉全链（击杀掉落过拾取缝入包——怪物→战斗→掉落→拾取
  全链在馆内闭环）。
- **advNightStepPool 动态夜刷环带**：展厅屋顶刷怪风险+自定义光照 read
  复杂度 → 固定点位铺怪替代（SHOWROOM.nightMobs 三点位，离床
  ≥ADV_BED_MOB_R+余量）。
- **骷髅远程箭池**：AI 薄版只做近战半边，夜怪池不排骷髅。
- **TNT 爆炸波及怪物段**：advTntWave/advTntDmg 不移植——爆炸只吃地形/
  掉落链，怪物伤害与击退不进馆。
- **探险 advMobAI 完整索敌/收队 AI**：体验馆只用 ~30 行近战薄版；未来要
  同款需另开「怪物 AI kit」抽取票（第二个真实消费者到位塑形接口，
  place-kit/FurnaceKit 先例）。
- **床边出生点**：**永久裁剪而非推迟**——体验馆无死亡/回家政策（满血原地
  复活保住调试现场），床只管睡觉不锚出生。
- **仓库箱扩容行**：体验馆箱恒顶格 27（dev 全开），`next:()=>null` 隐藏。

## 8. place-kit · 放置链两消费者收编（2026-10-27）

**触发**：§7 D5 显式推迟条款兑现——体验馆要测冒险的挖/放/门，唯一消费者
的缝是假缝；第二个真实消费者（体验馆）到位，按「两 adapter 塑形接口」
抽取。规则早已全在纯函数（adventure-core 的 advPlaceCheck/advDoorSiteOk/
advDoorTogglePlan/advDoorBreakPlan/advPortalSiteOk/advPortalFrame/advIsDoor/
advMineStep/advCascadeLedger + craft-core breakTime + drops rollBlockDrop），
本票只把两模式镜像的**壳段**收进 `js/place-kit.js`（PlaceKit）：

| editor 面 | 收编自 adventure.js | 说明 |
|---|---|---|
| `tryPlace(hit)` | advTryPlace | 单格放置 + 门/传送门结构拦截分支 |
| `placeDoor(hit)` / `placePortal(hit)` | advPlaceDoor / advPlacePortal | 结构放置（门走 editBlock 光场链；传送门 setBlockRaw+网格收口） |
| `tryDoorToggle(hit, lookId)` | advTryDoor | 点击开关（成对换 id） |
| `breakBlock(x,y,z,id,bt)` | advBreakBlock | 破坏结算：级联+门配对+掉落+磨损 |
| `applyCascade` / `doorBreakApply` | advCascadeApply / advDoorBreakApply | TNT 链在探险侧继续直调（不进 kit） |
| `mineTick(mine,hit,dt,view)` / `mineStop(mine)` | advMineTick / advMineStop | 蓄力循环保守编排（TNT/面板守卫留探险，panelOpen 走 view） |
| `tickTimers(dt)` | update 的节流递减 | 话术节流账本封装在 kit 实例 |
| `PlaceKit.aimHit()` | advAimHit | 准星命中（CameraRig+raycastVoxel，Node 守卫返 null） |

政策缝（与 FurnaceKit 语义事件同一收编思路，全走 opts）：`onEdit`（世界档
journal——体验馆 noop，放/挖只活当次进场=恢复原装红线不受影响）、`onPlaced`
（任务 tally+树苗挂表）、`onConsume`（快捷栏同步）、`cascade` 四键 sink、
`onFelled`、`wear`、`say/speak/sfx`（体验馆 dev 降噪全静默）、`ring/swing`、
`mesh{touch,flush}`、`hardText`。探险侧原函数名全部保留为薄转发（挂点与
既有测试零改动），行为逐字不变。体验馆侧：onMouse 左键=蓄力挖（站点/门
使用优先）、右键=使用→放置、onHighlight 放开、Drops 实体接入（update 喂
真空拾取）、桌面按住检测（document capture 监听）+触屏 onHold 同款。

## 9. v3 · 冒险壳统一（2026-10-28，设计权威移交）

本稿 §1–§8 描述的 v1/v2 形态（镜像装配的第二壳）已于 2026-10-28 统一治理
收编：体验馆从「逐票追赶冒险面的镜像装配」改为**统一冒险壳的 dev profile
门面**——v2 的 ~600 行镜像编排段全删，世界以「home 基座 + 展馆 edits 账本
重放」形成（世界即存档），数据隔离由全内存 dev store 保证（ADR 0002 守恒）。

- 设计权威：docs/adventure-shell-unification-design.md（拍板记录/票表/行为变化
  清单）与 ADR 0005；GLOSSARY 新词「冒险存档 store」「冒险壳政策缝」、
  「体验馆」词条已改写为终态。
- 行为变化（对 v2）：大宝箱全局单账户（顶格预填，多箱同账户）/怪物 AI 完整版
  （固定点位夜怪与池不排骷髅保留）/TNT 波及怪物段进馆/点击工作台不再开面板
  （入口归 Tab/🎒）/任务链·地图·门阵·下界·牧场·灯笼全部进馆。
- D5 拍板保留项（用户 2026-10-28 拍板①）：原地满血复活、床边不设出生点、
  夜怪固定点位铺法——经政策缝长期保真。

本稿自此保留作 v1/v2 的决策考古；体验馆后续演进以统一设计稿为准。
