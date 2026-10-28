# 农田闭环与配方补全 · 实现设计

> 需求：物品系统合成链盘点（2026-10-28，worktree item-system）后补全——配方链缺口、
> 隐藏配方解锁、农田交互闭环、无出口物品登记。
> 盘点方法：供给侧（BLOCKS.drop 42 条 + MOB_DROPS 9 键）× 消耗侧（RECIPES 37 +
> SMELTS 10 + FUEL + food + block 字段放置）全量对账，逐键核实 js 源码。
> 用户拍板（2026-10-28）：
> 1. **隐藏配方挂账解锁**——面包=首收小麦、骨粉=首杀骷髅、弓=首杀蜘蛛，解锁本身是教学时刻；
> 2. **农田闭环本轮做掉**，交互形态走**锄头两步正典**（空手锄地→耕地，再播种）；
> 3. **slimeball/皮革/羽毛登记在案不动**（收集品定位，不硬造出口）；
> 4. **四件正典候选全上**：砂岩、铁粒回炉、线→羊毛、树苗当燃料。

---

## 0. 盘点结论（事实出处）

| # | 断点 | 源码事实 |
| --- | --- | --- |
| 1 | 农田链半截 | `adventure-core.js advBuildFarm` 只建 4×3 教学农田+熟麦；锄地/播种/生长/催熟零实现，`wheat_seeds` 全仓无消费者 |
| 2 | 三配方默认永久隐藏 | `mode-kit.js KIT_HIDDEN_RECIPES=['bread','bone_meal','bow_item']`，`advProfile.hiddenRecipesOpen` 缺省 false——只有体验馆可见；弓物品化已完成却合不出来 |
| 3 | 铁粒单向死路 | 1 铁锭→9 铁粒有配方（灯笼用 8 粒），9→1 反向缺失，多余铁粒永久积压 |
| 4 | 三物品无出口 | slimeball（零消费者）、leather（三期护甲 Out of Scope）、feather（标注三期箭，但弓已是无弹药设计——出口被架空） |

熔炉表体检：现有 10 条映射在当前资源面下无缺口（下界岩烧下界砖被「下界岩不可破坏」
政策关闭，属有意为之；染料/陶瓦依赖新方块，本轮不做）。

---

## D1 · 配方四件（全部 MC 正典，零新物品）

| 配方 | 图案 | 站点 | 出处 | 价值 |
| --- | --- | --- | --- | --- |
| 砂岩 | 4 沙子 2×2（rows） | hand | sandstone.json | 沙子新去向；沙漠建材从「只能挖」转「可合成」 |
| 线→羊毛 | 4 线（any 无序） | hand | white_wool.json | 线双出口；没羊也能做床 |
| 铁粒回炉 | 9 铁粒（any 无序） | table | iron_ingot 正典 shapeless（9 格需 3×3） | 闭合铁粒单向死路（灯笼 8 粒余料可回锭） |
| 树苗燃料 | ITEMS `sapling` 加 `fuel: 0.5` | — | MC 正典 100 ticks=半件 | 树苗积压天然出口；FUEL 派生序自动收入（同值 0.5 稳定排序在木棍后） |

RECIPES 37→40（随身 10→12：砂岩+羊毛；工作台级 27→28：铁粒回炉）；新配方全部用既有物品，
图标/提示/图鉴零新增（ITEM_PIX/ITEM_HINTS 键集不变，既有守门测试自然通过）。

## D2 · 隐藏配方挂账解锁（拍板①）

- 解锁表 `ADV_RECIPE_UNLOCK`（adventure-core，纯数据+纯谓词，读 counts 七类记账键）：
  `bread: collect_wheat≥1`（收成→食物链入口）· `bone_meal: kill_skeleton≥1`（骨头→骨粉）
  · `bow_item: kill_spider≥1`（线→弓，因果同构）。
- 壳侧 `allow` getter：体验馆（`hiddenRecipesOpen:true`）仍全开不变；探险缺省改为
  `advUnlockedRecipes(counts)` 动态子集——mode-kit 可见集缝零改动。
- **解锁播报**：任务节拍（0.5s 谓词查）顺带做差集，新解锁 → `gate_unlock` 音 +
  TTS「XX配方解锁啦」+ toast；已解锁集合 init 时从 counts 播种（老档不重复播报）。
- 任务表**不加步**：插入步序会移档老档 step 下标（远征章追加不插入的先例），
  解锁 riding 在既有记账键上零存档迁移。

## D3 · 农田闭环（拍板②：锄头两步正典，D7 二期设计稿落地）

**状态机**（纯函数全在 adventure-core，行为在探险壳）：

| 步 | 触发 | 前置（纯函数） | 结算 |
| --- | --- | --- | --- |
| 锄地 | 空手点击（桌面右键/触屏🪓锄地键）目标块 | `advHoeOk(id, aboveId)`：草地(1)/泥土(2) 且上方空 | 该格→耕地(41)，记账，`sand_collapse` 翻土声，TTS 引导播种 |
| 播种 | 手持种子使用档（item-use-registry `wheat_seeds` act 'plant'） | `advPlantOk(id, aboveId)`：耕地且上方空 | 上格→麦苗0(42)，扣 1 种子，挂 20s 计时，记账 |
| 生长 | 计时到期（复用 `advSapDue` 通用步进） | `advWheatNext(id)`：42→43→44→45 | 换 id + 记账 + 收口，未熟重挂 20s |
| 催熟 | 手持骨粉使用档（`bone_meal` act 'ripen'） | `advRipenOk(id)`：麦苗 0~2 | +1 阶段（D7：确定性 +1，MC 随机 2-5 的差异登记在案），扣 1 骨粉，未熟重挂计时 |

**持久化与重放**（确定性重放红线）：
- 播种/生长/催熟/锄地全部经 `advMarkEdit` 记账（逐格 last-write-wins，重放即重建）；
- 生长计时**不落盘**（树苗计时同款），重进 `advRescanWheats` 全图扫 42~44 重挂 20s
  （与 `advRescanSaplings` 同款三调用点）；
- 撤表三通道：破坏直接挖（place-kit `breakBlock` 经 sink）· 级联脱落（耕地被挖→
  麦苗 thin 失撑，`advCascadeLedger`）· TNT 掀掉（`advExplodeCells`）——判据用
  config 新身份旗标 `crop: true`（B_WHEAT_0..3，方块级联「身份即白名单」同款），
  sink 契约扩可选键 `crop`。
- 成熟麦(45)无计时；收割掉小麦+种子走 config 既有 drop 表（B_WHEAT_3 已登记）。

**入口接线**：
- 桌面：`onMouse(2)` 使用链在 `advTryUseHeld` 之后插 `advTryHoe`（空手且指可垦块才命中，
  否则回落放置链=空手 noop）；种子/骨粉走使用动作注册表（点击恒算 attempt，同弓口径）。
- 触屏：`advTouchList` 空手追加「锄地」专用键（BTN 新 `hoe` 图标）；手持种子/骨粉时
  使用动作键自动出现（既有边沿重声明机制，状态签名从布尔升级为「选中物+有无使用档」
  字符串，空手↔持物也触发重声明）。
- 音效：锄地 `sand_collapse`（翻土声）· 播种 `snow_throw`（轻噗）· 催熟 `pick`（正反馈叮）·
  解锁 `gate_unlock`（既有解锁琶音）——全部在 audio-registry 键集内（守门测试锁）。

**与 MC 差异登记**（改动即有意为之）：锄头不是物品（默认手持观感即锄，无耐久无 tier）·
耕地不需水不退化 · 骨粉确定 +1 阶段 · 收割手撕即可（无「结实阶段」）。

## D4 · 无出口物品登记（拍板③）

`items-core.js` 注释登记收集品定位：slimeball（备用收集品，MC 出口=粘液块/拴绳，
均依赖不存在的功能）· leather（出口三期护甲，Out of Scope）· feather（原「三期箭」
出口已被弓无弹药设计架空，改登记收集品）。零行为变化。

---

## 测试计划

| 测试文件 | 覆盖 |
| --- | --- |
| `test/craft-core.test.js` | 全表 37→40、随身级清单 +3、FUEL 序 +树苗、同摆多配对账自动覆盖新配方 |
| `test/adventure-core.test.js` | advHoeOk/advPlantOk/advWheatNext/advRipenOk 边界、ADV_WHEAT_GROW、ADV_RECIPE_UNLOCK 三谓词、advUnlockedRecipes/差集 |
| `test/adventure-mode.test.js` | 锄/种/长/催壳接线（记账+扣件+计时表+撤表三通道）、解锁播报一次| 
| `test/place-kit.test.js` | sink.crop 可选键（破坏成熟/未熟麦撤表） |
| `test/item-use-registry.test.js` | 新键 wheat_seeds/bone_meal（既有防错网自动覆盖形状） |
| `test/button-icons.test.js` | icon 字面量 ⊆ 工坊键集（新增 hoe/plant/ripen 三键） |

## 分期

| 期 | 内容 |
| --- | --- |
| 本轮 | D1 配方四件 + D2 解锁 + D3 农田闭环 + D4 登记 + GLOSSARY/设计稿收口 |
| 后议 | slimeball 出口（粘液块需弹跳物理/拴绳需系留功能）、石英链（下界岩可破坏政策）、羊毛剪刀剪羊、陶瓦 |
