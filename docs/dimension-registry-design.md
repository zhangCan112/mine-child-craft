# 维度规格注册表（ADV_DIMS）· 设计定稿

> **需求**（用户 2026-10-30）：以后会做更多副本，把这次做副本可复用的部分收口成一个「kit 级」
> 注册表，以后做副本快一些；此外为未来的「贴图场景+建模」素材预留一个坑（素材对象）。
> **状态**：已实施（本文为施工契约与拍板记录；grilling 三轮共识的落账）。
> **参照先例**：冒险地图注册表（docs/adventure-maps-design.md 的 ADV_MAPS 行化——
> 地图侧早已数据化，维度侧补齐同款口径）· ADR 0005（壳统一，本表是壳的纯数据段）。
> **日期**：2026-10-30。

---

## 0. 一句话架构

**下界 nether 与巢穴副本 den 两个维度相位的切界政策（建场序列/天穹/曲目/昼夜开关/
落点/HUD 横幅）收进 `js/adventure-dims-core.js` 的维度注册表 `ADV_DIMS`——一行注册
一个维度；壳层 `advSetDim`/`advPlayerDied`/HUD/`advSyncMood`/分桶键全部读表驱动，
维度政策不再散在壳层 if 分支。维度 vocabulary（下界/副本/涌出的结构常量、建场、
刷怪纯函数、mood 桥接）随迁归家；行上预留 `assets` 字段作为「副本素材」的坑。**

---

## 1. 决策清单（全部已拍板）

| # | 决策 | 理由 |
|---|------|------|
| D1 | 新文件 `js/adventure-dims-core.js`（应用层纯核心，同名单测），表名 `ADV_DIMS`；加载序 adventure-core → adventure-maps-core → 本文件 → 壳 | 一文件一模块；adventure-core 已是全仓最大文件；地图先例 adventure-maps-core 就是「注册表+建场核心」 |
| D2 | **行为等价红线**：nether/den 两行落地后既有行为逐字等价，唯一例外是 D3 | 既有测试（adventure-nether/den/mode）零改动全绿是收口正确性的证明 |
| D3 | **D8 偏差修复**：journal payload 与 advSaveView 的 pos 判据单点化为 `advDim !== 'overworld' ? null : {...}` | den-nest D8 明文「pos 副本期间存 null（维度不进档）」，实现只判 nether——den 坐标落档重进会出生在主世界地下岩层（收口前探索发现的出血点） |
| D4 | 表只收**纯数据字段 + build 建场闭包**，不设生命周期钩子（onEnter/tick 等）；维度差异（nether 回程门框、den 矿位白名单先清后建）收进 build 闭包 | 带钩子的表 interface 会与 implementation 一样宽（shallow）；「update 里跑什么」是否值得缝，等第三个副本现身再定 |
| D5 | 三条**全局判据**不设行字段（不变量不是每维政策）：pos 进档（D3）、死亡语义（nether/den 逐字相同折叠为单分支）、`ADV_SCENE_KEYS` 派生 | 「维度不进档」是维度概念的不变量；行字段冗余 |
| D6 | `advMusicMood` 随迁 dims-core（vocabulary 归家）；`ADV_FURN_PREFIX` **维持 S2 单份权威不动**，加守门测试（维度行 id ⊆ 前缀表键集） | 前缀知识拆两份会破坏 S2 修复的「单份」性质；守门同样达成忘配即炸 |
| D7 | 派生收口杀四处手抄清单：`ADV_SCENE_KEYS`（地图行+维度行派生）、livestock 运行账与档 defaults 桶集（ADV_SCENE_KEYS 生成）、decode 坏键兜底（map 键 ∈ ADV_MAPS id）、showroom `showroomSceneKeys`（两注册表派生+回落清单补 den） | 加维度的边际成本=「一行注册+一处前缀」，桶/键/兜底自动跟随；showroom 漏 den 桶是收口前探索发现的第四处清单漂移（原先靠壳 decode 归一兜住） |
| D8 | 维度 vocabulary 随迁 dims-core：`ADV_NETHER`/`advNetherBuild`、`ADV_DEN`/`advDenBuild`/`advDenMineRoom`/刷怪四件套、`ADV_ERUPT`/`advEruptStep`、`advMusicMood`；**不搬**：`ADV_PORTAL`/`advPortalFrame`/`advInPortal`/`advPortalSiteOk`/`advPortalExit`（门词汇三家共用）、`ADV_NESTS`/`advBuildDenNest`/`ADV_DEN_NEST_DOOR`（home 图巢穴词汇） | 同一种东西同一个家：地图建场住 maps-core 先例 → 维度建场住 dims-core；机械搬移零逻辑改动 |
| D9 | **素材对象占坑**：行预留 `assets: null` 字段 + GLOSSARY 词条「副本素材（Den Assets）」声明 interface 契约（方块行/贴图格/建场/建模四供给）；**不建空注册表、不定字段细形** | one adapter = hypothetical seam：第一个带专属贴图+建模的副本来之前，坑只占 vocabulary；conventions §1.10（清单 ≥3 处才升格）同口径 |
| D10 | 一票交付，提交说明三段：收口（等价）/ D3 修复（唯一行为变更）/ 占坑 | D3 修复极小，拆票反而制造「表已收口但 pos 判据还在壳层」的中间态 |

---

## 2. 字段契约（行的 interface）

```
ADV_DIMS = [
  { id: 'nether' | 'den',       # 桶键/炉键/BGM 判定的维度标识(≠ 'overworld')
    build: () => {...},          # 建场序列闭包(ADV_MAPS 行带 build 同款先例):
                                 #   nether = advNetherBuild + advPortalFrame(回程门)
                                 #   den    = advOreSpotsReset(矿位白名单先清后建) + advDenBuild
    sky: {color, fogNear, fogFar, sunI},   # 天穹四参数(壳层 ADV_SKY_* 常量已退役)
    mood: 'nether',              # BGM 曲目键(AudioRegistry 域)
    dayCycle: false,             # dayTime 暂停+恒夜(日月天体随之隐藏)
    spawn: {x, y, z, yaw},       # 进场落点(加载期从 ADV_NETHER/ADV_DEN 结构常量派生,
                                 #   坐标唯一权威仍在结构常量)
    hud: {banner, showMobs},     # 横幅行 + 怪物行显隐(维度态不显时段行)
    assets: null},               # 副本素材预留缝(坑, D9)
]
```

- `advDimRow(id)` 是壳层与桥接政策的取行唯一入口。
- `advMusicMood(dim, isNight)`：维度行恒行值 mood；上界按昼夜切 night/adventure。

## 3. 全局判据（刻意的非行字段）

| 判据 | 口径 | 落点 |
|---|---|---|
| pos 进档 | `advDim !== 'overworld' ? null : {...}` | journal payload + advSaveView（同判据两处） |
| 死亡语义 | 单分支 `advDim !== 'overworld'` → 作废 advExitSpot + 切回主世界回家 | advPlayerDied |
| 分桶键 | `ADV_SCENE_KEYS = ADV_MAPS ids + ADV_DIMS ids` | 壳层一行派生；livestock 两处桶集、showroomSceneKeys 同源派生 |

## 4. 偏差登记（收口前探索发现，本票修复）

| # | 偏差 | 修复 |
|---|------|------|
| 1 | **den-nest D8 pos 漏判**（壳层两处只判 nether，den 坐标落档重进困在主世界岩层；test/adventure-den.test.js 无 pos 断言） | 判据单点化（§3）+ nether/den 双回归锁（adventure-nether C-DR） |
| 2 | **showroomSceneKeys 漏 den 桶**（den-nest D15 声明「den 桶随 ADV_SCENE_KEYS 进 dev store」，实现是自抄清单 minus den，靠壳 decode 归一兜住） | 两注册表派生 + 回落清单补 den（D7） |
| 3 | 档 defaults 的 livestock 五桶字面量缺 den 桶（无档路径隐患，decode 兜住） | 桶集派生消灭该类漂移（D7） |
| 4 | nether 分支 loadScene 内 `furnaceSettle→rescanStations` 与 den 分支次序相反 | 归一为 rescan→settle：两调用分属 advStations/advFurnaces 不相交状态，先后无观测差（advSetDim 内注释登记） |

## 5. 「不进表」清单（刻意的壳层保留分支）

第三个副本出现时再据实决定是否升格为缝——**勿提前补钩子**：

1. update 门禁 `if (advDim === 'den') advDenTick(dt)`（副本刷怪补员）；
2. 入口门认领 `advDenDoorAt`（home 图黑巢 POI 专属）；
3. 涌出接线 `advEruptTick`（home 图夜间第二通道）；
4. `advSetDim` 内 den 专属步：`advDenT` 复位 + `advDenSeed()` 首刷；
5. `advBeamsRelayout` 的维度分支（回程门光束锚：nether 取 `portal`、den 取 `gate`，
   键名不齐——收口时新编目的第 13 处触点，读 dims-core 全局照常工作，登记备查）。

## 6. 新副本施工单（本表的成立理由）

加一个副本 = ① dims-core 加一行（含 build 闭包与结构常量）② `ADV_FURN_PREFIX` 加
一前缀键（守门测试锁）③ 入口门认领（若走站桩仪式，复用 advGateHold/advVeil）。
桶键/livestock/HUD/存档兜底/BGM/切界装配全部自动跟随——壳层只在有真差异时才写分支。

## 7. 文件清单（实施落点）

| 文件 | 动作 | 内容 |
|---|---|---|
| js/adventure-dims-core.js | **新增** | ADV_DIMS 表 + advDimRow + advMusicMood + 随迁的维度段（下界/副本/涌出：常量、建场、刷怪纯函数） |
| js/adventure-core.js | 删段 | 维度段迁出（~200 行）；头注释与导出面同步；传送门段横幅改题 |
| js/modes/adventure.js | 改 | 12+1 处维度触点读表：ADV_SCENE_KEYS 派生/pos 判据/死亡分支/advSetDim/HUD/天穹常量退役/livestock 桶派生/decode 兜底 |
| js/showroom-core.js | 改 | showroomSceneKeys 两注册表派生+回落补 den |
| index.html | 加行 | `js/adventure-dims-core.js`（adventure-maps-core 之后） |
| test/adventure-dims-core.test.js | **新增** | 行完备性/迁移等价锁/mood 桥接/行建场确定性/炉键守门（源文本） |
| test/adventure-den.test.js | 改 | require 重指 Dims（黑巢 POI 断言留 Core） |
| test/adventure-nether.test.js | 改 | require 重指 Dims + C-DR 存档 pos 双锁 |
| test/adventure-mode.test.js | 改 | 壳前铺 dims-core + 分桶键派生断言 |
| test/adventure-core.test.js | 删块 | advMusicMood 测试随迁 dims-core 测试 |
| test/showroom-core.test.js · showroom-mode.test.js | 改 | 桶键集六桶对齐 + 壳 fixture 铺 dims-core |
| GLOSSARY.md | 加词条 | 「维度规格（ADV_DIMS）」「副本素材（Den Assets）」 |
