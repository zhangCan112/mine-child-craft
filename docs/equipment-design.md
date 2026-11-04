# 装备系统设计定稿：盔甲四件套 × 六材质 + 工具金银阶 + 下界合金链（2026-11）

> 状态：活权威（设计定稿，随工单落地）。需求来源：2026-11-04 用户口头需求——
> 「让我们的项目也有同样的装备系统，各种材料的各阶装备也需要加上，造型要还原」。
> MC 正典数值权威：[mc-equipment-research.md](mc-equipment-research.md)（2026-11-04 一手取证，
> 本文数值表与其冲突时以调研文档为准并回改本文）。
> 术语见 [GLOSSARY.md](../GLOSSARY.md)：物品核心/手持物注册表/玩家战斗 kit/像素图标工坊/
> 造型档案/合成核心。

## §0 拍板总览

| # | 决策 | 内容 | 依据 |
|---|---|---|---|
| D1 | 盔甲六材质 | 皮革/锁链/铁/金/钻石/下界合金 × 四件套 = 24 件 | 正典六材质；海龟壳不做（无海龟怪，附录 B） |
| D2 | 工具补两阶 | 镐/斧/剑/锹 × 金/下界合金 = +8 件（与既有四阶同构） | 正典材质阶梯补全 |
| D3 | 锄不物品化 | 锄地保持「空手=锄」两步正典（adventure.js `advTryHoe` 现行），锄不进 ITEMS | 儿童两步简化是已拍板口径；锄阶位无玩法落点 |
| D4 | 锁链甲可合成 | 正典锁链甲无生存配方 → 本仓以铁粒按正典图案合成（附录 B 登记） | 儿童游戏每个装备都要有确定来路 |
| D5 | 下界合金简化锻造 | 不做锻造台/锻造模板：钻石装备 + 下界合金锭台级合成升级（附录 B 登记）；合金锭 = 4 碎片 + 4 金锭（正典 shapeless 照搬） | 不新增站点件；升级入口孩子一眼能懂 |
| D6 | 远古残骸进下界 | 新方块 B_ANCIENT_DEBRIS 散布下界地下，钻石镐可挖，烧炼出碎片 | 正典唯一产地=下界 |
| D7 | 减伤公式照搬正典 | `dmg × (1 − min(20, max(armor/5, armor − dmg/(2+tough/4)))/25)`，逐字照搬 | 造型还原同款「正典优先」纪律 |
| D8 | 环境伤害不减伤 | 溺水/岩浆走 `advEnvHurt` 原样扣血，盔甲不介入 | MC 溺水无视护甲；附录 B 登记 |
| D9 | 盔甲耐久 ≈ 正典 ×2 | 与工具「耐久 ≈ MC×2（拍板③）」同折算惯例；攻击命中扣 1，归零破碎消失（工具同款） | 一致的儿童折算口径 |
| D10 | 击退抗性移植 | 下界合金每件 0.1，总封顶 0.8：命中击退 `kpow × (1 − kbRes)` | 正典下界合金签名属性 |
| D11 | 装备态归探险档 | 穿戴四槽存探险存档 payload 新键 `armor`；死亡不清装备（零惩罚）；建造/竞技场不接入 | 战斗与 HP 只在探险 |

## §1 数据面：ITEMS 扩展 + equipment-core 纯核心

### 1.1 ITEMS 新条目（items-core.js，纯数据行）

```js
/* 盔甲条目形状——与 tool 五元组同构的 armor 五元组:
   armor: {slot, tier, pts, tough, dur, kb?}
   slot: 'helmet'|'chestplate'|'leggings'|'boots'
   tier: 'leather'|'chain'|'iron'|'gold'|'diamond'|'netherite'（色板/观感键）
   pts/tough: 正典盔甲点/韧性 · dur: 满耐久秒?不——耐久次数(与 tool.dur 同为
   「扣减次数」口径, 工具行 dur 即此口径) · kb: 击退抗性(仅下界合金 0.1) */
helmet_leather: {name: '皮革帽', icon: '🪖', armor: {slot: 'helmet', tier: 'leather', pts: 1, tough: 0, dur: 110}},
...
```

- 新材料 3 行：`ancient_debris`（远古残骸，烧炼原料）、`netherite_scrap`（下界合金碎片）、
  `netherite_ingot`（下界合金锭）。
- 新工具 8 行：`pick_gold / axe_gold / sword_gold / shovel_gold / pick_netherite / axe_netherite /
  sword_netherite / shovel_netherite`——tool 五元组同构，无新字段。
- **items-core 纯函数对等扩展**：`isArmor(id)` / `armorOf(id)`（镜像 `isTool`/`toolOf`）；
  `durOf` 补 armor 分支（`it.armor ? it.armor.dur`）——`mkStack` 满耐久、`stackMax`=1、
  快捷栏耐久条、`add`/`take` 全链**自动生效，零改动**（durOf 是「可耗损」判定唯一权威）。

### 1.2 equipment-core.js（引擎层·纯核心，零 THREE 零 DOM，有同名单测）

**为什么独立成核**（深度判据）：穿戴槽模型、减伤公式、磨损破碎、存档归一四件事
有且只有装备系统用，但消费方跨三处（探险模式扣血、存档 encode/decode、装备条 UI）——
不收核则 MC 公式与归一规则在模式层散第二份。删除测试：删掉本核，公式/归一/破碎语义
会在 ≥3 个调用点重现， earned its keep。

```
interface: EQUIP_SLOTS · mkWorn() · wornPut(worn, slot, stack) → {worn, out}
         · armorPoints(worn) · toughPoints(worn) · armorReduce(dmg, pts, tough)
         · kbResist(worn) · wornWear(worn, n=1) → {worn, broke:[slot...]}
         · wornNormalize(raw)
依赖(均经全局名, 调用期解析): items-core 的 ITEMS/armorOf(加载序在后)
```

- `worn` 形状：`{helmet: {id, dur}|null, chestplate: ..., leggings: ..., boots: ...}`
  （穿戴件不可堆叠，省 n 字段——`wornPut` 出入都带 n:1 的栈形，与槽形 `{id,n,dur}` 兼容）。
- `wornPut`：物品非盔甲/槽不匹配 → 原样返回 `{worn, out: null}`（防手滑，不抛——
  存档 decode 侧另有 `wornNormalize` 全量兜底）；正常换装 `out`=被换下的旧件（含耐久）。
- `wornNormalize(raw)`：老档/坏档/半形状 → 合法 `worn`；未注册 id、非盔甲、
  slot 键不对、dur 非正数逐条丢弃（save-slot decode 惯例，幂等）。
- `armorReduce` 照搬正典公式（D7）；`armorPoints`/`toughPoints` 同口径遍历
  （合计走 armorOf 判据，未穿满/未注册件按 0 计；TDD 中细化——tough 合计归核心
  而非调用方手搓第二遍遍历，与 kbResist 口径对称）。
- 引用纪律：工具五元组判据单份在 items-core（号段交叉断言在单测），本核只读不复制。

## §2 合成、烧炼与下界合金链（craft-core.js）

### 2.1 RECIPES 新增 33 条（2026-11-04 实施数：直配方 25 + 升级 8）

- **盔甲 20 条**（station 全 `table`，图案逐条对照 minecraft.wiki 正典；2026-11-04
  实施修正：原稿「24 条」未扣下界 4 件——下界合金装备**无直配方**，正典锻造
  升级是唯一来路，见升级 8 条）：
  - 头盔 = 5 材料桥形（上行 3 + 中行 2 侧）；胸甲 = 8 材料环形缺中上；护腿 = 7 材料
    （上行 3 + 中行 2 侧 + 下行 2 侧）；靴子 = 4 材料双侧柱对（正典 3 宽 2 高，中列空）。
  - 材质映射：皮革→leather · 铁链→iron_nugget（D4）· 铁→iron_ingot · 金→gold_ingot ·
    钻→diamond（五材质直合成；下界合金见升级段）。
- **金阶工具 4 条**：与既有四条形状模板同构（材质列替换 gold_ingot）；下界合金
  工具 4 条同样无直配方（升级唯一来路）。
- **下界合金升级 8 条**（D5，台级 shapeless 双格）：`{any: ['pick_diamond', 'netherite_ingot']}`
  等八件钻石装备（工具 4 + 盔甲 4）逐一升级，配方 id = 产物 id（下界装备唯一来路，
  无同名直配方）。产物耐久**继承钻石件余量**不是正典语义（正典锻造保留耐久），
  本仓 `gridCraft` 产栈走 `add`（满耐久新件）。**取舍**：升级件当「重铸」——话术
  「铸造成崭新的下界合金」对齐实现，不做耐久继承（附录 B 登记）。升级件刻意
  台级（终局重铸仪式不进随身格，图案双格本放得下 2×2——不变式测试例外登记）。
- **合金锭 1 条**（正典 shapeless 4 碎片 + 4 金锭，台级 any 八格）。
- **体验馆供给口径**（2026-11-04 实施裁决）：升级 8 配方不计入 `showroomPocket`
  材料并集——材料是钻石装备成品，8 件不可堆叠行把并集撑到 33 行 > 27 格背包；
  体验馆语义 = 两步可达（先用包内材料合成钻石件，再拾级升级），判据
  `isNetheriteUpgrade`（any 双格含锭且产物=自身）单份收 showroom-core。

### 2.2 SMELTS 新增 1 条

`ancient_debris → netherite_scrap`（正典高炉/熔炉同产物；烧炼时长同表 SMELT_T）。

### 2.3 新方块与掉落（config.js + drops）

- `B_ANCIENT_DEBRIS`（下界号段顺延）：`hard` 挖掘时长对齐同档矿石、`tool: 'pick'`、
  `tier: 4`（钻石镐门槛，正典一致）、`drop: [['ancient_debris', 1, 0]]`。
- 贴图：texture-atlas 新格（正典上下螺旋纹面，像素自绘观感语言，与黑曜石/下界岩同批调色）。
- 散布：adventure-dims-core 下界地形段（现平整地面循环旁），种子化散布地下层
  （RandCore.seedAt 口径，重进同图同分布——确定性重放红线）。

## §3 数值表（正典 → 儿童折算）

**盔甲（helmet/chestplate/leggings/boots；pts 正典逐字 · dur = 正典 ×2 取整）**

| 材质 | pts（头/胸/腿/靴） | 合计 | tough/件 | dur（头/胸/腿/靴） | kb/件 |
|---|---|---|---|---|---|
| 皮革 | 1/3/2/1 | 7 | 0 | 110/160/150/130 | — |
| 锁链 | 2/5/4/1 | 12 | 0 | 330/480/450/390 | — |
| 铁 | 2/6/5/2 | 15 | 0 | 330/480/450/390 | — |
| 金 | 2/5/3/1 | 11 | 0 | 154/224/210/182 | — |
| 钻石 | 3/8/6/3 | 20 | 2 | 726/1056/990/858 | — |
| 下界合金 | 3/8/6/3 | 20 | 3 | 814/1184/1110/962 | 0.1 |

**工具金银阶（与既有四阶同列；speed 照搬正典 · dmg/tier 折算见注）**

| 阶 | tier | dmg 镐/斧/剑/锹 | dur | speed |
|---|---|---|---|---|
| 金 | 1（=木阶采集门禁，正典口径） | 3/5/7/2 | 80 | 12 |
| 下界合金 | 5（> 钻 4） | 10/12/15/6 | 2000 | 9 |

> 折算注（2026-11-04 与调研文档逐格核对后锁定）：正典金工具 dmg 与木阶持平、速度 12
> （全阶最快但最脆）——儿童折算保持这个「快而脆」的教学对比（金 dur 80 < 木 120）。
> 本仓 dmg 折算惯例逐类核对：剑 = 2×正典 −1（金 4→7、下界 8→15）；镐/斧沿既有行内
> 邻阶 +2（下界=钻 +2）；锹 = 正典 −0.5 整数化（下界 6.5→6）。speed 列 = 正典效率逐字
> （金 12/下界 9，既有四阶本就逐字）。dur 2000 对齐本仓钻 1500 基（正典比例 ≈1.3）。
> 正典攻速不移植（模式统一冷却，见附录 B #11）。

## §4 造型还原

### 4.1 物品图标（icons.js 像素图标工坊）

- 新增色板 4 阶进 `PIX_TIER`：`leather`/`chain`/`gold`/`netherite`——色值以调研文档
  §7.2 图标色板为准（金 #fdff76/#e9b115/#825d16 系、下界 #766a76/#312828 暗紫灰系、
  锁链 #d8d8d8/#969696 灰系、皮革染色默认 #A06540 + 扣带 #955e3b 系——观感语言
  参考 D13，像素自绘）。
- 新增字符画 4 张（`HELMET_ART / CHESTPLATE_ART / LEGGINGS_ART / BOOTS_ART`）：
  正典图标形状逐像素转写（同 SWORD_ART 先例）——头盔护颈缺口+面甲开口、胸甲肩甲
  双肩+腰线、护腿腰带+双裤腿、靴子成对短靴；`#`主/`+`亮/`-`暗/`o`描边四字符
  按材质色板替换（工具四画共用先例同款），生成 24 个 `ITEM_PIX` 键。
  还原密度锚：正典不透明像素数 头 78/胸 138/腿 104/靴 88（调研 §7.2，自绘逼近不逐像素追）。
- 下界合金图标点缀正典金粒高光（`+` 槽位个别点金）。

### 4.2 手持观感（held-item.js）

- `mkArmorDef(id)` 工厂：盔甲手持 = 图标挤出薄片（正典 item/generated 口径——
  手持盔甲就是图标贴图薄片，与弓/剪刀/剑同管线），art 键=对应 `ITEM_PIX` 键，
  grip/swing 走手持物族档；24 条经 `defFor` **惰性首做驻 `HELD_DEFS`**
  （2026-11-04 实施修正：原稿「加载期生成」违反 held-item 顶层零表依赖纪律——
  index.html 加载序 held-item 在 items-core 之前，顶层读 ITEMS/armorOf 必炸；
  惰性首做效果等同注册：defs 最终含 24 条、defFor 返回恒等引用、新增盔甲行
  零手工清单），未注册回落薄片兜底不变。

### 4.3 穿戴观感（avatar.js）

- `Avatar.setArmor(worn)`：声明目标穿戴（同目标幂等）；实现为骨挂 overlay 盒——
  头盔=头骨挂五面盒（前开脸，正典盔甲层语言）；胸甲=身骨挂主盒+双肩帽；
  护腿=双腿骨挂上 2/3 盒+髋带（挂身骨）；靴子=双腿骨挂下 1/4 盒+鞋头。
  尺寸=对应骨盒 inflate +1px（长袍 overlay 先例），颜色=材质 tier 的**穿戴层
  色板**（`ARMOR_TIER_COLORS` 表收 held-item.js，TOOL_HEAD_COLORS 同居同惯例）。
  色值取调研 §7.3 盔甲层贴图色板——与 §4.1 图标色板是两套独立调色（金：层
  #e0b230 系 vs 图标 #fdff76 系），穿戴观感必须用层板，勿混用图标板。
- 零玩法知识：Avatar 只收 `worn` 槽对象、按 `armorOf(id)` 取 tier/slot 上色——
  「何时穿脱」是模式政策；第一人称不渲染穿戴层（手视图只有手持物，MC 同构）。

### 4.4 远古残骸块贴图

texture-atlas 新格：正典「上下螺旋纹、侧面斑驳」观感语言像素自绘（黑曜石/发光岩
同批次调色惯例），`layout` 表登记——网格化核心 UV 契约自动生效。

## §5 穿戴交互

- **穿上**：`ITEM_USES` 盔甲行（由 ITEMS 盔甲键集**派生生成**，FUEL 派生同惯例——
  手抄 24 行必漂移）`{act: 'wear', icon: 'wear', label: '穿上'}`；执行器在探险层
  （行为不进注册表——注册表红线）：`wornPut` 换装 → 被换下旧件回背包（满包=拒绝
  穿戴并话术提示，零损失红线）→ 手持件消耗进槽 → sfx + toast + TTS。
- **脱下/查看**：HUD 常驻**装备条**（mode-kit 新件 `mkArmorBar`）：四槽像素图标
  （`iconOf` 统一出口）+ 空槽虚位；点槽=脱下意图 → 模式层回包（满包拒绝+话术）。
  签名节流重画（炉三槽推进同惯例）。
- **手持同步**：穿上后手持物若即被消耗，走既有 `mkHeldSync` 同步（哨兵语义不变）；
  破碎同款（§6）。
- 话术：穿/脱/破三句（儿童口径，夸装备不夸人——反馈哲学）；ItemHint 表补全部
  新物品说明（全键覆盖守门测试会拦漏）。

## §6 战斗减伤（模式层政策 + kit 最小缝）

- **单一漏斗**：探险玩家受击两链收口 `advHitPlayer(dmg, kdx, kdz, kpow, line?)`——
  `armorReduce(dmg, armorPoints(worn), toughPoints(worn))` 先折 → `Mobs.hit(p, 折后值, ...)` →
  `wornWear`（命中磨损 1/件）→ 破碎件 sfx+toast+槽清空+手持同步。怪物近战两处
  调用点（`Mobs.hit(p, advMobDmg(m), ...)`）与巢穴武点位改走漏斗；箭矢链经
  CombatKit.mkArrows 新可选缝 `hurtPlayer(dmg, kpow) → {dmg, kpow}`（kit 不知盔甲——
  通用变换缝，探险注入减伤函数，dmg/kpow 都过缝）。
- `kbResist`：`kpow × (1 − min(0.8, Σ kb))`（D10）。
- 环境伤害 `advEnvHurt` 不改（D8）。
- 破碎 = 消失（工具同款「归零消失」）；死亡不掉装备（零惩罚）。

## §7 存档与状态伴生清点（conventions §1.12）

- payload 新键 `armor`（`worn` 归一形状）；`defaults.armor = mkWorn()`、encode 直取、
  decode 走 `wornNormalize`（老档缺键 → 空槽，半形状丢弃，幂等）；`advSaveView` 同步
  透出（可断言快照缝）。
- 伴生状态逐条：**磨损**（命中-1，仅战斗链）✓；**破碎**（归零消失+槽清空）✓；
  **死亡**（保留）✓；**退场/换模式**（随 payload 落盘，重进重读——ADR 0002 重进必重读
  同款）✓；**换装与手持互斥**（穿上=从背包移除，不做第二份槽）✓；**跨模式**
  （建造/竞技场不读不写，装备件在探险档内自洽）✓。

## §8 工单分解（TDD：每单先红后绿）

| 单 | 交付 | 测试先行 |
|---|---|---|
| T1 | equipment-core.js + items-core 盔甲字段/isArmor/armorOf/durOf + 数值行锁定 | test/equipment-core.test.js（公式/槽/磨损/归一逐条）+ items-core 增量断言 |
| T2 | RECIPES 36 条 + SMELTS + 金银阶工具行 + 材料行 | craft-core 配方图案/派生 cost 断言 |
| T3 | 像素图标 4 画×6 板 + 24 键 + mkArmorDef 手持薄片 | icons-item 字符画/键集断言 + held-item defFor 断言 |
| T4 | Avatar.setArmor 穿戴 overlay + ARMOR_TIER_COLORS | held-item 工厂直测 + boot 冒烟（THREE 段） |
| T5 | wear 使用档 + 装备条 UI（mkArmorBar）+ 探险换装编排 + 存档 armor 键 | item-use-registry 派生行断言 + mode-kit 假 doc 契约 + 探险档 roundtrip |
| T6 | advHitPlayer 漏斗 + mkArrows hurtPlayer 缝 + 磨损破碎仪式 | combat-kit 缝契约 + 探险减伤/磨损行为断言 |
| T7 | B_ANCIENT_DEBRIS 块/贴图/散布/掉落 | config 号段交叉 + dims-core 散布确定性断言 |
| T8 | ItemHint 全量补齐 + GLOSSARY 词条 + docs/README 登记 + 全量回归 | item-hint 守门自动拦漏；npm test + lint 清零 |

> 进度注（2026-11-04）：T1–T4 收官——T1 落 equipment-core 八接口 + items 增量
> （24 盔甲行 + 金银阶工具 8 行 + 下界材料 3 行）+ 提示行 35 条；T2 落 RECIPES
> 33 条（§2.1 实施修正：下界装备 8 件无直配方=升级唯一来路）+ SMELTS 1 条；
> T3 落像素图标（盔甲 4 画×6 板 + 金银工具两阶 + 下界材料 3 键，两豁免集已
> 清空收紧）+ mkArmorDef 惰性首做（§4.2 实施修正）+ mkToolDef 扩金/下界两阶；
> T4 落 ARMOR_TIER_COLORS 穿戴层色板（§7.3 层板，双色板纪律两阶逐对钉）+
> Avatar.setArmor 骨挂 overlay（五面盒前开脸/主盒+双肩帽/上 2/3 盒+髋带/
> 下 1/4 盒+鞋头，尺寸=骨盒 +1px，同目标幂等——四槽 id 签名，磨损不重建）
> + boot 冒烟（THREE 段全路径）；T6 的 kit 侧缝提前完成。余 T5 → T6 → T7 → T8。

## 附录 B：MC 差异登记表

| # | MC 正典 | 本仓 | 后果 |
|---|---|---|---|
| 1 | 锁链甲无生存配方（战利品/交易限定） | 铁粒正典图案合成（D4） | 来路确定，无交易系统 |
| 2 | 锻造台+锻造模板升级下界合金 | 台级双格合成（D5） | 少一个站点件；升级产物满耐久（正典保留耐久，§2.1） |
| 3 | 海龟壳（水呼吸全套奖） | 不做 | 无海龟怪；水下呼吸机制不存在 |
| 4 | 锄五材质工具 | 锄地=空手两步正典（D3） | 无锄物品阶位 |
| 5 | 盔甲架/附魔/修理 | 不做（不在本票） | 装备获取=合成唯一通道 |
| 6 | 溺水/摔落伤害部分吃甲 | 环境伤害全不减（D8） | 儿童简化，岩浆/溺水靠躲避 |
| 7 | 盔甲磨损含摔落等 | 仅战斗命中磨损（§6） | 磨损更慢，耐久感知集中在战斗 |
| 8 | 怪物穿甲/掉甲 | 怪物不掉盔甲 | 装备来路=合成，无掉落噪声 |
| 9 | 附魔能力（enchantability） | 不做 | 金甲「附魔高」的正典甜头不移植（数值表不收该列） |
| 10 | 远古残骸 Y 轴分布带 | 下界地下层均匀种子散布 | 无 Y 轴地质分层（探险地下层现有简化口径） |
| 11 | 每类工具独立攻速（0.8–4.0） | 不移植——模式统一冷却 0.38s | 攻速阶差对 6 岁孩子无感知意义（调研 §8 建议②，统一为固定节奏） |
| 12 | 铜装备（1.21.9 新材质，套装 10 点） | 不实现，登记备查（调研 §4 全节留档） | 本仓六材质封顶下界合金；将来若需「铁前过渡阶」，铜数值拿来即用 |
| 13 | 正典 id 前缀 wooden_/golden_，盔甲 = `<材质>_helmet` | 本仓 kind_tier 惯例：`pick_wood`/`helmet_leather`（tier 词 = wood/gold/chain 短名） | 与既有 ITEMS 键同构（mkToolDef 生成循环直接复用）；_Avoid_ 正典名硬套 |
| 14 | 减伤简化「每点 −4% 封顶 80%」（调研 §8 建议③） | 不采纳，保持正典公式（D7，已实现有测试锚） | 公式差异孩子不可感知；正典公式对小额伤害保护更好，还原纪律优先 |
