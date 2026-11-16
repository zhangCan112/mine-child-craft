# 滑翔翼特性 · 现状核实报告

> 调研日期:2026-11-15 · 分支:glider(worktree `1631a8/glider`)
> 方法:逐字核对源码为准,代码知识图谱只用于收窄范围;全部行号以本 worktree 当前 HEAD 为准。
> 性质:纯现状调研,不做设计决策;第五槽落点一节只给「文档落点建议」,取舍归派令方。

## 执行摘要

1. **摔落伤害:现状没有。** 物理引擎只发 4 个事件(掉出世界/溺水/岩浆/入水),不存在落地(fall/land)事件;`fallCap: -30` 是防穿薄板的坠落限速,不是伤害。玩家伤害来源全部是怪物近战/自爆/箭、流体(溺水/岩浆)和虚空(直接死亡回出生点,不扣血)。要做摔落伤害,需要新增引擎事件或模式层采样落地速度。
2. **离地高度:没有现成函数。** `onGround` 是碰撞推出来的布尔值,不带高度。可复用的现成件:怪物侧的 `Mobs.groundUnderAt(x, z, refY)`(已导出的向下列探测)、引擎 `groundTop(x, z)`(列顶缓存,悬空/洞下会算错)、`raycastVoxel`。俯冲所需的 pitch 输入现状 physics 不读,属新增读取。
3. **装备槽怎么加:** 装备物品接线必改三处(ITEMS 行 / 提示注册表行 / 图标键),盔甲行为(wear 派生、纸娃娃、盔甲条)由 `EQUIP_SLOTS` 驱动自动生效;但**开第五专属槽**要连锁改 `equipment-core` 的槽表 + 4 个硬编码四槽的守门测试,且新配方会触发配方计数测试红。
4. **贵重材料:** 钻石(三层矿+稀有掉落)、金锭(金矿+猪灵/唤魔者/龙)、铁锭(铁矿+多重来源+拆解回炉)、下界合金(下界古残骸→碎片→+金锭合成)、皮革/线/末影珍珠(对应怪掉落)。

---

## 1. 摔落伤害现状

### 结论
现状**没有任何摔落伤害机制**。玩家 HP 账本存在(`ADV.player = {hp: 30, maxHp: 30}`),伤害结算有两条漏斗(怪物伤走盔甲折减,环境伤原值直扣),但来源清单里没有「落地」。虚高处坠落只有两道防线:坠落限速(防穿模)和入水截断,都不扣血;坠出世界直接判死回出生点。

### 证据
- 物理引擎唯一的事件出口是 `worldEvents`,只有 4 个键:`{voidFall, drownTick, lavaTick, splash}`(js/voxel.js:413-414;置位点 :411 voidFall、:329 drownTick、:338 lavaTick、:341 splash)。**没有 land/fall 事件**。
- `fallCap: -30` 注释自证用途:「坠落限速(格/秒, 防高坠穿薄板)」(js/config.js:67;钳位点 js/voxel.js:294)。
- 入水截断坠落:water 接触时 splash 事件 + 垂直速度清零(voxel.js 流体段,:341 附近)。
- HP 账本:`ADV.player: {hp: 30, maxHp: 30}`(js/modes/adventure.js:96;maxHp 语义锚见 js/items-core.js:90)。
- 现有伤害来源全集:
  - 怪物近战:advMobAI → `advHitPlayer`(adventure.js:1412);苦力怕自爆 AOE(:1303);骷髅箭经 advArrows → combat-kit `hurtPlayer` 缝(js/combat-kit.js:252)→ `onHitPlayer`(adventure.js:947-951)。
  - 流体:溺水 `advEnvHurt`(drownDps = 2,:4882);岩浆(lavaDps = 4,:4886)。参数源 js/config.js:123-125(FLUID)。
  - 虚空:`voidY = -12`(js/config.js:69)→ 引擎 voidFall(js/voxel.js:411)→ 主循环分发(main.js:388-391)→ `onVoidFall`(adventure.js:4984-4986)→ `advPlayerDied`——**回出生点满血,不扣血**。
  - TNT 明确不伤玩家(adventure.js:26 注释)。
- 结算漏斗:
  - 怪物伤 `advHitPlayer`(:1031-1037)= advArmorFold → Mobs.hit → advWearArmorOnHit → freshDead ? advPlayerDied。
  - 环境伤 `advEnvHurt`(:977-986)原值直扣,不经盔甲(:1010,D8 决策)。
- 死亡处理 `advPlayerDied`(:1602-1631):'home' 切图回出生点满血 / 'inPlace' 原地满血(showroom 体验馆);死亡零惩罚不掉装备(docs/equipment-design.md §6)。

### 不确定处
- 「玩家从多高开始该受伤」的数值政策:源码与设计文档均无先例(现状无任何摔落伤害),属设计决策,本报告不代答。

---

## 2. 玩家运动与离地高度

### 结论
运动参数集中在 `PLAYER` 配置块;`pos/vel` 是普通对象,`onGround` 是无传感器的碰撞推导布尔值。**离地高度没有现成函数**,但有三个可复用件:怪物侧 `groundUnderAt`(最接近「向下探测地面高度」)、引擎 `groundTop`(列顶缓存,悬空时会算错)、`raycastVoxel`。飞行(flyMode)是现成的「无重力恒速」先例分支。

### 证据
- 参数全集(js/config.js:60-73):speed 5.0、sprint 8.5、jump 8.6、gravity 26.0、flyVert 7.0、fallCap -30、substep 0.25、voidY -12、height 1.8、eye 1.62、hx/hz 0.2、autoJump = IS_TOUCH。跳高约 1.42 格(adventure.js:1634 注释)。
- `pos/vel` 普通对象(js/voxel.js:208-213);`onGround`(:214):每步先置 false(:321),Y 向下行进被碰撞拦住即贴地置 true(:359-367);飞行(:269)/跳起(:296)显式置 false。无独立地面传感器。
- **离地高度可用件**:
  - `Mobs.groundUnderAt(x, z, refY)`(js/mobs.js:309-318,导出于 :641)——现成的向下列探测,怪物移动/下坎判据在用(:336/:412-413/:445/:475),洞底/地下空间感知正确;
  - `groundTop(x, z)`(js/voxel.js:95-104)——列顶扫描带缓存,**悬空或站在洞下时会算错**(取的是列最高实心);
  - `raycastVoxel`(js/voxel.js:154-190)、`collides`(:231-245)。
- 飞行:flyMode 标志(:216)/ `setFly`(:226-229);触发仅建造模式 F 键(js/build.js:458);切模式复位(main.js:231)、探险进入各处 `setFly(false)`(adventure.js:2465/2478/2514)。飞行分支(voxel.js:264-270):恒速、无重力、vel.y 由 Space/Shift 直设、流体不生效。
- `onGround` 消费方:引擎内部 + js/avatar.js:155(姿态)+ js/hand-view.js:178(手持摆动);**adventure.js 不读 onGround**。

### 不确定处
- `groundUnderAt` 是 mobs.js 的导出,引擎(voxel.js)未用它;滑翔若在引擎层复用会形成「引擎依赖应用侧模块」的分层问题,引用方向需在设计时裁决(现状事实:引擎不知道 mobs)。

---

## 3. 装备系统

### 结论
装备四槽由 `EQUIP_SLOTS` 单源驱动,`worn` 是形状固定的四键对象;穿/脱/同步各有唯一入口,存档键为 `armor`。**新加一个普通盔甲物品零槽表改动;新开第五专属槽则槽表与四个守门测试连锁必改**,但老存档兼容是机械的(wornNormalize 逐槽补 null)。

### 证据
- `EQUIP_SLOTS = ['helmet', 'chestplate', 'leggings', 'boots']`(js/equipment-core.js:26,数组序即 UI 序)。
- `worn` 形状:四键全在 `{slot: {id, dur} | null}`(`mkWorn` equipment-core.js:29-31);`wornPut`(:109-125)栈形→槽形、旧件 out 交还;`wornNormalize`(:134-145)补 null / 丢坏件 / **丢 ITEMS 未注册 id 的件**(:139-141)。
- 穿脱入口:`advTryWear`(adventure.js:3530-3552)、`advWornTakeOff`(:3554-3571)、`advSyncArmor`(:3513-3518);改写口红线(只能经这三个口改 worn,:999-1002)。
- 装备页 = `mkCraftPanel` 三页签 背包|装备|造物(js/mode-kit.js:666-708),纸娃娃+四槽+盔甲点(:735-780);equip 缝注入 `{worn, pts, onSlot, onWearAt, mkPreview}`(adventure.js:814-824);纸娃娃 js/paper-doll.js:25-84。
- HUD 盔甲条 `mkArmorBar`(mode-kit.js:1502-1549)槽序 = EQUIP_SLOTS、点槽报 onUnequip 意图;接线 adventure.js:4695、每帧刷新(:4889)。
- 存档:payload 键 `armor`(adventure.js:353),defaults 全 null(:241),encode(:261)/decode = wornNormalize(:276);journal → SyncDB slot 'adventure_world_save'(:121/:219/:333)。落盘时机:5 秒节流/flush/pageHide + 穿戴动作即时(:1029/:3547/:3568);`advSaveView.armor`(:5055)。
- **新槽兼容性**:`wornNormalize` 对缺失槽逐个补 null,老档加载后机械兼容,无需迁移脚本。

### 不确定处
- `advArmorBar` 的 cleanup/dispose 路径未逐行确认(次要,不影响现状结论)。

---

## 4. 合成系统与贵重材料

### 结论
配方表是 `{id, out, station, shape}` 声明式条目,匹配支持有序(平移+镜像)与无序(多重集恰等)两类;**全表实际 76 条(以守门测试为准,文件头注释 84 已漂移)**。贵重材料获取链:钻石/金锭/铁锭靠挖矿+熔炼+怪掉落,下界合金是「古残骸→碎片→+金锭」两段合成,皮革/线/珍珠纯怪掉落。

### 证据
- RECIPES 条目结构(js/craft-core.js:37-52):`{id, out: {item, n}, station: 'hand' | 'table', shape: {rows 有序} | {any 无序}}`,格子规约 = '物品id' 或候选数组,cost 派生。
- `matchGrid`:有序 = 裁剪平移 + 镜像(craft-core.js:403-433);无序 = 多重集恰等。`gridCraft`(:485-501):首个命中 + 站点门禁(工作台 4 格,advStationGate 注入)+ 扣料 + 产栈。
- **计数真相:76 条**,由 js/craft-core.test.js:99-105 钉死;craft-core.js:38 文件头注释写 84 = 漂移(以测试为准,记入 §9 风险)。
- 隐藏配方:`KIT_HIDDEN_RECIPES = ['bread', 'bone_meal', 'bow_item', 'bag_upgrade']`(js/mode-kit.js:366),仅 allow 集合含其 id 才显示(mode-kit.js:980-983);探险 allow getter(adventure.js:797-813):hiddenRecipesOpen → 全开(体验馆),缺省按任务挂账解锁 + 大背包未扩容放开。
- 贵重材料获取链(全部带源):
  - **diamond**:挖钻石矿(tier3,js/config.js:294)+ 龙/守卫 rare 掉落(js/mob-registry.js:262/:273);
  - **gold_ingot**:金矿熔炼(config.js:293 → craft-core.js:271)+ piglin/evoker/dragon 掉落(mob-registry.js:248/:267/:273)+ zombified_piglin 5%(:250);
  - **iron_ingot**:铁矿熔炼 + 僵尸 5%(mob-registry.js:218)+ golem 3-5 个(:261)+ vindicator(:266)+ iron_block 拆解(craft-core.js:257-258)+ 铁粒 9→1 回炉(:95-97);
  - **下界合金链**:ancient_debris 仅下界挖(tier4,config.js:435-436)→ 烧成 scrap(craft-core.js:280)→ 4 碎片 + 4 金锭合成(:248-250);
  - **leather**:cow/ravager(mob-registry.js:276/:269);**string**:spider 族(:236-244);**ender_pearl**:enderman(:258)。
- 工作台级配方实例:pick_iron(craft-core.js:106-107)、helmet_diamond(:159-160)、nether_portal(:260-261)。

### 不确定处
- 文件头注释计数漂移的原因未深究(不影响行为,以测试为准)。

---

## 5. 新物品接线清单(装备型)

### 结论
新装备物品的**必改最小集是三件**:ITEMS 注册行、提示注册行、图标键。盔甲类行为(handuse wear 派生、held 渲染、装备页/盔甲条/overlay/纸娃娃)全部由 EQUIP_SLOTS + ITEMS 派生,**自动生效,不需要手写使用逻辑**。开第五槽、加新配方、加专属使用动作各有明确的连锁改动与守门测试。

### 证据(必改三件)
1. **ITEMS 行**(js/items-core.js)——注册表本体;
2. **ITEM_HINTS 行**(js/item-hint-registry.js)——守门:item-hint-registry.test.js 断言全键 ⊆ ITEMS;
3. **ITEM_PIX 键**(js/icons.js)——守门:icons-item.test.js:74-77 断言键集 = ITEMS;未画图标会回落 emoji 显示但测试红(js/icons.js:1404-1423)。

### 证据(盔甲型自动生效)
- item-use-registry 从 ITEMS 派生 wear 动作(js/item-use-registry.js:48-50);
- held 渲染 `mkArmorDef` 惰性生成(js/held-item.js:493);
- 装备页/盔甲条/overlay/纸娃娃全由 EQUIP_SLOTS 驱动(见 §3)。

### 证据(若开第五专属槽——连锁清单)
- **必改源码**:`EQUIP_SLOTS` 数组 + `mkWorn` 形状(js/equipment-core.js:26/:29-31);
- **必红的守门测试(硬编码四槽/四序)**:js/equipment-core.test.js:40(恰四槽)、js/mode-kit.test.js:1613(四槽序)、js/armor-overlay.test.js:44(硬编码四槽);items-core.test.js:196 的 24 键数值表只查标准行,加行不破;
- 若新槽装备可合成:craft-core.test.js:99-105 的 **76 计数必改** + 形状防错网(:135 起)+ 两两不同构检查(:188 起);
- 若有专属使用动作(非穿戴):ItemUseRegistry 手抄 + advUseRun(adventure.js:3573-3581)——盔甲不需要这条;
- 工具类 kinds 需 HeldItems.defs(js/drops.test.js:403-416 参照);放置型走 blocks-fields 号段;新 js 文件过 conventions.test.js(命名/同名单测 :29/:55、GLOSSARY 计数 :263)+ index.html 加 script。

### 证据(迁移语义警示)
- `wornNormalize` 静默丢弃 ITEMS 未注册的穿戴件(equipment-core.js:139-141)——物品将来下线时,玩家档内该件**无提示消失**;新物品设计须显式接受或另行处理此语义。

### 不确定处
- 无(接线面已全部落到源码与测试断言)。

---

## 6. 输入通道

### 结论
桌面与触屏双通道齐备,且**移动输入在 physics 层是同一入口**(摇杆输出合成到与 WASD 相同的意图),滑翔的姿态控制可直接复用;**唯 pitch(俯仰)现状 physics 不读**,俯冲判据属新增读取。

### 证据
- 桌面:WASD 移动(js/voxel.js:249-252)、Space 跳(:295)、鼠标视角/指针锁(js/input.js:73-79)、V/C 切视角(:85-88)、Shift = 步行疾跑(voxel.js:279)/飞行下降(:268)、左键挖右键放(input.js:131-143)、数字键/滚轮换手(:89-104)、Tab 背包 / KeyQ 任务 / KeyH 回家(adventure.js onKey)。
- 触屏:虚拟摇杆(input.js:270-330,推满 = 疾跑 :307)、跳跃大键 → Space(:247)、下降键 → ShiftLeft(:248,仅飞行显 :341)、画布轻点/拖动视角(:192-197)、⛏️ 主动作键(adventure.js:670)、顶部小键 🎒/❗/🏠(:671-673)。
- 摇杆/WASD 同源:摇杆输出写进与键盘相同的移动意图,physics 单一读取点(voxel.js:249-255)。
- **pitch 现状**:input.js 写 pitch(:78 鼠标、:191 拖动),但 physics 的移动分支不读 pitch——俯仰影响滑翔属新增读取。

### 不确定处
- 无。

---

## 7. 主循环与滑翔可挂点

### 结论
主循环喂序固定:物理在前、模式 update 在后(模式层对 pos/vel 只读)。滑翔的三类现成挂点:①唯一重力积分点 = 步行分支重力段;②`worldEvents` 是现成的「引擎→应用事件」模式(但无 land/fall 事件);③flyMode 分支是「无重力恒速」先例。**硬约束:模式文件禁直写玩家六绑定(守门测试执法),滑翔物理只能进引擎层或新意图入口,不能写进 adventure.js。**

### 证据
- main.js loop(main.js:374-409):dt 钳 0.05(:380)→ physics(:384)→ Tank/pumpFluids/spinners → voidFall 分发(:388-391)→ splash → `MODES.cur.update`(:396)→ dayTime(:400-403)→ Fx。
- adventure.update 喂序(adventure.js:4848-4921):store.tick → 天气/边界 → timers → 站点/任务/背包 → 熔炉 → 火焰/引信/TNT/睡觉 → 传送 → 陷阱 → 挖掘 → 近战冷却 → 受击节流 → **drown/lava 结算(:4880-4887)** → 气泡/装备条(:4888-4889) → 维度门禁 → advMobAI+golem(:4906-4911) → Mobs → 箭矢 → 拾取 → advHpBar(:4912-4920)。
- 挂点事实:
  1. 唯一重力积分点 = 步行分支重力段(js/voxel.js:292-298,fallCap 钳在 :294);
  2. `worldEvents` 是现成引擎→应用事件模式(main.js:388-391 分发先例);**无 land/fall 事件**(§1);
  3. 模式 update 在物理之后,模式层对 pos/vel 只读——落地速度采样必须在物理步内或引擎事件里做;
  4. flyMode 分支(voxel.js:264-270)是「关重力恒速」的引擎内先例。
- **守门红线**:模式文件禁直写玩家六绑定,test/conventions.test.js:131-148(正则含 flyMode)——滑翔物理/飞行态写进 adventure.js 会直接红测试。

### 不确定处
- 无。

---

## 8. equipment-design.md 结构与第五槽文档落点

### 结论
装备设计定稿按 T1-T9 工单演进,`EQUIP_SLOTS` 的设计权威在 §1.2;**文档没有现成的「槽位扩展」章节**。若要写第五专属槽,建议新增独立小节(如 §1.3 槽位模型)并同步 §1.1/§3/§5/§9.3/附录 B——**此为落点建议,是否开槽属设计决策,归派令方**。

### 证据
- docs/equipment-design.md 章节骨架:§1 数据面(含 §1.1 ITEMS / §1.2 equipment-core)、§2 合成、§3 数值表、§5 穿戴交互、§9 装备页、附录 B 差异登记(T1-T9 工单演进)。
- EQUIP_SLOTS 设计权威自引:equipment-core.js:5-9 指回 §1.2。
- 影响面分布(若扩展槽位):§1.1(ITEMS 行)、§1.2(槽表/mkWorn)、§3(数值表)、§5(穿戴交互)、§9.3(装备页/盔甲条)、附录 B(差异登记)。

### 不确定处
- 无。

---

## 9. 其他风险与全局不确定处

### 结论
三项值得显式记录:①craft-core 文件头注释计数漂移(84 vs 实测 76);②落地速度存在一个可读窗口但无对外事件——摔落伤害必须新增引擎事件或模式层采样;③体验馆政策(death inPlace / hiddenRecipesOpen)是现成的「政策缝」,新机制须过 AdventureProfile 而非硬编码。

### 证据
- **注释漂移**:craft-core.js:38 头注释写 84 条,craft-core.test.js:99-105 钉死 76 条;文件头「随身 12 + 工作台 28」也是旧数。行为无影响,CI 真相源是测试。
- **落地速度窗口**:hitY 分支里 `onGround = true` 与 `vel.y = 0` 之间可读到落地速度(js/voxel.js:359-367),但这是引擎内部瞬间,无对外 land/fall 事件——摔落伤害需新引擎事件(照 worldEvents 模式)或物理步内采样,不能靠模式层事后读。
- **体验馆政策缝**:death inPlace / hiddenRecipesOpen 集中在 adventure.js:547-558(AdventureProfile)——滑翔翼若要「体验馆先试」或「按任务解锁」,须走同一政策缝。
- 其他:§3 的 wornNormalize 静默丢未注册件语义(档内件消失)、§5 的四槽守门测试连锁、§7 的模式文件禁写六绑定红线。

### 不确定处
- advArmorBar cleanup dispose 未逐行确认(小,不阻塞现状结论);
- craft-core 注释漂移原因未深究(以测试为准)。

---

## 附:引用文件清单

js/voxel.js · js/config.js · js/input.js · js/main.js · js/mode-kit.js · js/mode-kit.test.js(经 test/ 断言引用) · js/mobs.js · js/combat-kit.js · js/equipment-core.js · js/items-core.js · js/craft-core.js · js/item-hint-registry.js · js/item-use-registry.js · js/icons.js · js/paper-doll.js · js/held-item.js · js/avatar.js · js/hand-view.js · js/build.js · js/modes/adventure.js · js/mob-registry.js · test/conventions.test.js · test/craft-core.test.js · test/equipment-core.test.js · test/icons-item.test.js · test/armor-overlay.test.js · test/item-hint-registry.test.js · test/drops.test.js · docs/equipment-design.md
