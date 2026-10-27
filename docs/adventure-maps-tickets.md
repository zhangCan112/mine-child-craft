# 冒险模式生态地图 · 票据（adventure-maps-tickets）

> Spec：[adventure-maps-spec.md](adventure-maps-spec.md) · 设计定稿：[adventure-maps-design.md](adventure-maps-design.md)
> · 计划：[adventure-maps-plan.md](adventure-maps-plan.md)。
> 本文件是**本地任务图**（issue tracker 未配置，仓库先例 item-crafting-tickets.md 同款）：
> 状态随票据推进更新；implement-spec 流程以本图为准——frontier = 无未完成依赖的票。
> 集成分支：`adventure-maps`（基于 master 8b98676）。
>
> **修订记录（2026-10-27，变基吸收 master 8b98676「下界并入探险」）**：探险模式已自带
> 两界机制——`advDim('overworld'|'nether')` + `advSetDim` 切界（换桶→loadScene→applySky→
> 清怪清箭→站点重扫→光束重锚）+ journal 两界分桶（`advSceneEdits` + 档键 `netherEdits` +
> 炉键 `n|` 前缀）+ `advInPortal` O(1) 门判定（B_PORTAL 脚/头格）+ `advPortalExit` 出口
> 计算 + 死亡统一回家（D11）+ 玩家放置门物品 `nether_portal`（见 docs/nether-merge-design.md）。
> 本特性据此改道：**T6 = 把两界机制泛化为 N 图机制**（nether 保持特殊维度，不进 ADV_MAPS
> 行；advDim 之上的 advMap 层管四张主世界图）；T7 的门判定/出口/冷却复用既有件，只新增
> 站桩与遮罩。nether 门传送保持「即时 + 冷却」已交付口径，不套站桩。

## 任务图总览

| 票 | 标题 | 依赖 | 状态 |
|----|------|------|------|
| T1 | 数据层：新方块/物品/提示/图标/图集 | — | ☑ 已并入（05b852c） |
| T2 | 探险核心池参数化 | — | ☑ 已并入（b36349d） |
| T3 | 引擎高度场工具 | — | ☑ 已并入（1542576） |
| T4 | 冒险地图纯核心 + 同名单测 | T1, T2, T3 | ☑ 已并入（354147e） |
| T5 | 家园地图重设计（圈层重排） | T1, T3 | ☑ 已并入（cb8e3ab） |
| T6 | 存档分桶 + 壳切图装配 | T4, T5 | ☐ 阻塞中 |
| T7 | 传送门阵 + 站桩 + 遮罩 | T6 | ☐ 阻塞中 |
| T8 | 任务链与门解锁 | T7 | ☐ 阻塞中 |
| T9 | 雪球投掷物 | T6 | ☐ 阻塞中 |
| T10 | 收尾：GLOSSARY + 全量回归 + 手玩报告 | T7, T8, T9 | ☐ 阻塞中 |

状态图例：☐ 待领取 / ◐ 进行中（附分支名）/ ☑ 已并入集成分支（附合并序号）。

## T1 数据层（无依赖）

**内容**：
- config.js：方块 id 54~62 顺延——B_SNOW 雪块（挖掉得 4 雪球）/ B_SNOWY_GRASS 雪覆草
  （掉泥土，top 白 side 雪泥带 bottom 泥）/ B_ICE 冰（glass:true 透光透渲，**不入图集**——
  与玻璃同走纯色；半滑物理二期）/ B_CACTUS 仙人掌（儿童版无触碰伤害）/ B_SANDSTONE 砂岩
  （pick tier1）/ B_DEAD_BUSH 枯灌木（thin，掉木棍）/ B_ORCHID 兰花 · B_FLOWER_Y 蒲公英 ·
  B_FLOWER_W 雏菊（thin 十字片，掉自身）。hard/tool/tier/drop 旗标表配齐。
- items-core.js：新物品 8 条（snow/snowball/ice/cactus/sandstone/orchid/flower_y/flower_w，
  放置型带 block 字段）。
- item-hint-registry.js：ITEM_HINTS 8 条儿童提示（键集守门：漏写即红）。
- icons.js：像素图标——雪块（噪点+亮闪）/砂岩（沉积层带）/仙人掌（竖棱柱）/花共用一张
  FLOWER_ART 换三套色板/雪球复用 BALL_ART 换白色板/冰复用 GLASS_ART 形换冰色板；ITEM_PIX
  8 条（键集守门）。
- texture-atlas.js：图集格号顺延（T_SNOW=32 起）——雪块/雪覆草侧/仙人掌/砂岩/枯灌木/三花
  共 8 格 + PAINTERS；layout.tiles 增行（B_ICE 不入集）。

**验收**：`npm test` 全绿（item-hint/icons/texture-atlas 键集与像素断言自动生效）；未入集
方块纯色兜底不回归。**红线**：不动 BLOCKS 既有行、不占 id 63+。

## T2 探险核心池参数化（无依赖）

**内容**：adventure-core.js 的 ADV_NESTS kinds 与 ADV_NIGHT.POOL 从「模块常量被壳直读」
改为「home 地图行缺省数据」：导出口径不变（ADV_NESTS/ADV_NIGHT 仍存在且值不变），
advNestStep/advNightStep 纯函数签名**零改动**（池经入参注入的通道补齐，供 T4 地图行覆盖）。
壳（modes/adventure.js）对这两个常量的引用改为经参数/注册表读取（最小侵入）。

**验收**：既有 test/adventure-core.test.js / test/adventure-mode.test.js 全绿——**home 池行为
逐字节不变是本票红线**（T5 才动布局）。

## T3 引擎高度场工具（无依赖）

**内容**：scene-kit.js 新增确定性高度场纯函数（SceneKit.heightAt 或同风格命名）：16×16
控制格哈希幅度 ±3 + 双线性插值 + 整格阶梯化 + 压平区列表遮罩（{cx,cz,r} 内回落基准）；
任意相邻格高差 ≤1（坡度红线）；零 THREE 零 DOM 零玩法知识（引擎层分层红线）。新建
test/scene-kit.test.js 直测（头注释写明镜像 scene-kit.js 模块——非 -core 后缀的直测偏差，
world-rings 先例）。

**验收**：新单测绿（确定性：同参同值；压平区归基准；全图相邻高差 ≤1；幅度界 ±3）；
`npm test` 全绿。

## T4 冒险地图纯核心（依赖 T1+T2+T3）

**内容**：新增 js/adventure-maps-core.js（应用层纯核心，零 THREE 零 DOM，模块头五要素）：
- ADV_MAPS 注册表：home/desert/snow/swamp 四行，每行 id/名/调色板四元组（地表/植被/水/天
  基准色）/建场函数/巢穴池/夜怪池（**替换语义**：desert 无 zombie 有 husk；snow 无
  skeleton 有 stray；swamp 无 skeleton 有 bogged + witch 小屋常驻 + slime 夜池）/门位与
  回程门位/HUD 名。
- 沙漠/雪原/沼泽建场函数族（确定性，SceneKit 散布 + T3 高度场轻用：沙丘/雪堆），五件套：
  调色板地表（沙漠九成列沙+砂岩层+绿洲小水泊；雪原雪覆草+云杉+冰面；沼泽浅水池+垂藤
  橡树+兰花）+ 专属怪巢穴 + 唯一结构（沙漠神殿金字塔+地下宝箱室+「可疑地板」踩塌入口；
  雪屋圆顶+地下宝箱；女巫小屋高脚木屋+宝箱——宝箱全部用既有 B_CHEST 接大宝箱阶梯）+
  专属资源（仙人掌/枯灌木/雪/冰/兰花）。
- 政策纯函数：门解锁判定（任务档 counts 键）· 站桩步进（2s 可反悔，纯数据进出）· 落点
  计算（回程门内侧、面朝外——复用 adventure-core 的 `advPortalExit` 口径）· 死亡回家
  计划（远征图死亡 → 满血+home 门口——nether 合并 D11 已统一回家，本票只补地图行化）。
  门几何常量复用 adventure-core 的 `ADV_PORTAL`（6×7/内口 4×5/冷却），不另定义。
- index.html 加 script 行（adventure-core 之后、modes/adventure.js 之前）。
- 新建 test/adventure-maps-core.test.js（S1 缝，镜像 adventure-core.test.js 的 vm 惯例）。

**验收**：每图建场两次逐字节一致；地表抽样断言；替换语义池断言；注册表完整性（id 唯一/
门位不落水不撞结构/四行齐）；boot 冒烟全链过；`npm test` 全绿。

## T5 家园地图重设计（依赖 T1+T3）

**内容**：adventure-core.js home 建场族按设计稿 §2.4 同心圈层重排：
- 坐标迁移：湖 (22,24)→(36,58)；煤坑 (98,28)→(100,52)；铁坑 (30,96)→(24,44)；山洞口
  (97,72)→(62,10)（隧道向南深潜）；三巢 → 近僵尸 (44,60) / 中蜘蛛 (96,36) / 远苦力怕
  (20,16)。
- **小屋 (58-64,78-84) 与家园核心圈坐标/压平 y24 不动**（老档出生语义红线）。
- 高度场接入（T3）：圈层越远丘越高（核心圈 0 → 深险圈 ±3）；湖盆/坑口/洞口/巢丘/广场
  各带压平半径。
- 新增建场件：门阵广场压平区（屋东 x70-84 z74-88，圆石铺装三门位——门体本票不建，T7
  建）；初始农田（屋南 4×3 耕地+熟麦）；畜牧围栏（屋西原木柱+木板栏）；花丛草场
  （B_FLOWER_Y/W 散布）；圆石小径（小屋↔广场↔农田）。
- 单测更新：形状断言随新坐标成批更新 + 新增圈层断言（巢穴难度距小屋单调递增）。

**验收**：单测全绿；湖心/坑底/洞室等关键坐标断言过；`npm test` 全绿。

## T6 存档分桶泛化 + 壳切图装配（依赖 T4+T5）

**内容**：modes/adventure.js（在既有两界机制上泛化，**不推倒**）：
- 状态层：`advDim` 之上引入 `advMap`（home/desert/snow/swamp，nether 期间保持最后主世界
  图）；`advSceneEdits` 从两桶泛化为按图分桶（含 nether 桶——旧档 `netherEdits` 迁入，
  decode 兼容）。切图/切界统一经泛化后的 `advSetMap`/`advSetDim`（换桶→loadScene(地图行
  建场+当前桶重放)→applyMapPalette→清怪清箭→站点重扫→节拍器复位→光束重锚）。
- 档形：payload 的 edits 按图分桶 + `map` 当前图键（老档裸 edits/两界档自动迁移）；pos
  仅在主世界图随当前图存（nether 沿用 D9 pos=null；退出时在 nether → map 保持最后图、
  pos=null → 该图回程门出生）；dayTime 全局单钟（nether 暂停口径 D10 不变）。
- applyMapPalette：天/雾/水色基准从 ADV_MAPS 行取（NETHER_SKY/OVERWORLD_SKY 迁壳后的
  applySky 同款缝扩展）。
- 壳对 ADV_NESTS/ADV_NIGHT 的消费改走当前地图行（T2 通道）；巢穴/牲畜 seeding 重调函数
  复用（nether 合并既有件）。
- HUD 图名行随地图行。

**验收**：壳测试扩展——分桶 encode/decode 往返一致 · 老档迁移（裸 edits 档与 netherEdits
档两代）· **切走再切回世界逐字节一致**（分桶账本互锁红线）· 重进幂等；既有
test/adventure-nether.test.js 全绿（nether 行为零回归）；`npm test` 全绿。

## T7 传送门阵 + 站桩 + 遮罩（依赖 T6）

**内容**：modes/adventure.js + 必要的 css：
- home 门阵建场：三扇 6×7 门经 `advPortalFrame(setBlockRaw 基座版)`（T5 广场位），门框/
  门面走 nether 合并的「声明式不可破坏」口径；**门→目标图**的绑定 = 门阵固定坐标表
  （ADV_MAPS 各行 gatePos）；玩家放置的 nether 门（非门阵坐标）→ nether，即门面格落在
  门阵包围盒内查表、否则 nether（保持「任何下界的门回最后进入的主世界门旁」D6 语义）。
- 站桩状态机壳装配（消费 T4 核心步进，只对**地图门**生效；nether 门保持即时+0.8s 冷却）：
  门面内 2s 站桩可反悔 + 冷却复用 ADV_PORTAL.cd。
- 遮罩观感：CSS 渐晕（紫白，忌纯黑）400ms 双段 + audio-registry 两段音效（synth 回退）+
  TTS 到达播报。
- 切图全链：站满→遮罩满→advSetMap(目标图)→spawn 回程门内（advPortalExit 口径）→遮罩收。

**验收**：boot 全链过；audio-registry sfx 字面量守门绿；`npm test` + `npm run lint` 全绿。
手玩项（站桩反悔/≤5s/无黑帧）留 T10 清单。

## T8 任务链与门解锁（依赖 T7）

**内容**：adventure-core.js ADV_QUESTS 扩表（每图 2-3 条 + home 圈层引导 1-2 条）+ 解锁链
数据（home→desert→snow→swamp 线性）+ advQuestSlot counts 键 + 未解锁门熄灭/锁定 TTS +
点亮仪式（Fx.portalBeam + sfx + TTS）接线。

**验收**：任务档往返；门状态随任务进度点亮（壳断言）；`npm test` 全绿。

## T9 雪球投掷物（依赖 T6）

**内容**：combat-kit.js mkArrows 第二实例（雪球弹种：零伤害+击退，低初速高重力，命中观感
白絮）+ adventure.js 壳接线（手持雪球右键投掷；update 双实例都 tick、清理都收口）+
audio-registry 音效条目 + 4 雪球↔雪块配方（craft-core RECIPES 两行）。

**验收**：sfx 守门绿；配方进 RECIPES 且 canCraft 预检过；`npm test` 全绿。

## T10 收尾（依赖 T7+T8+T9）

**内容**：GLOSSARY.md 两词条（冒险地图/传送门阵，含 _Avoid_ 行）；全量 `npm test` +
`npm run lint` 零错误；按 plan 手玩清单逐项真机验收并出报告（含切图时感、遮罩无黑帧、
反悔 ×5、四图巡游、死亡回家、存档保留）。

**验收**：全绿 + 手玩报告落 docs/（或随票据记录）。
