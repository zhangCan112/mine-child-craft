# T-G01 数据层 · 合并回执（红方主人 tdd-engineer）

- 票：`docs/glider-tickets.md` §T-G01 数据层（唯一任务书）
- 合同：`docs/glider-spec.md` §3.1/3.2/3.3/3.7 + 红线 3/4/5/9；`docs/design/glider-ui-spec.md` §5.1–5.3；ADR 0012/0013/0015
- 分支：`glider`（worktree `1631a8/glider`，锚 9ee82e7，红测试已落盘未提交——提交序归工程经理）
- 状态：**红完工自证 → 派绿 → 验收绿 → 接管验收补缺 → 全量门禁 + 合入（本回执交派令方裁定）**

## 一、红测试清单（验收块 ↔ 测试 ↔ 红因分类，conventions §7.4）

自证口径：定向 `node --test`（开发期禁全量）。**21 红 / 488 绿，红因全部=「待实现红」（缺实现），零测试错误红。**

### equipment-core.test.js（25 测试：7 红 18 绿）——核心块 E1–E9

| # | 测试（行号） | 验收块 | 红因 |
|---|---|---|---|
| E1 | :40 五槽表断言（:41 红） | EQUIP_SLOTS 尾部追加 `glider`（ADR 0013） | 现四槽表，actual 缺 `glider` |
| E2 | :48 mkWorn 五键（:51 红） | 空穿戴五键全 null | mkWorn 现四键 |
| E3 | :298 ITEMS 行 armor 判据（:300 红） | ITEMS.glider 注册（spec §3.1 五元组） | ITEMS 未注册 glider |
| E4 | :314 话术接线（:316 红） | ITEM_HINTS.glider 逐字（UI spec §5.3） | 未接线（说明「穿上它，从高处跳下就会张开翅膀滑翔啦」，tts=名+，+说明） |
| E5 | :326 wornPut 第五槽（:332 红） | 专属不互换 + 与四甲互不排斥 | 第五槽机制未落地 |
| E6 | :355 wornWear 耐久豁免（:363 红） | **ADR 0012 红线**：glider.dur 恒 1 永不入 broke（单次/n=3/连 50 次/只穿翼/入参不动 + 盔甲对照） | wornWear 无豁免 |
| E7 | :389 盔甲合计不因翼变化（**绿**） | pts/tough/kb 零贡献 | **防回归锚**（手写五键 worn 零贡献现状即绿，回执登记非红） |
| E8/E9 | :405 wornNormalize 五键（:410 红） | 老档四键补 `glider:null` 零迁移 + 好件保真坏件丢弃 | 归一只认四键 |

### craft-core.test.js（55 测试：5 红 50 绿）——配方块 C1–C4

| # | 测试（行号） | 验收块 | 红因 |
|---|---|---|---|
| — | :99 全表计数 77（:103 红） | 76→77（spec §3.2 验收条） | RECIPES 76 条 |
| C1 | :964 配方行（:967 红） | station table / out glider×1 / 图案逐格 U-05 定稿 | RECIPES 无 glider 行 |
| C2 | :978 shapeCost（:981 红） | 金锭 4+皮革 2+线 2（PO 终版） | 同上 |
| C3 | :988 摆放语义（:991 红） | 正摆+镜像中 · 倒摆不中 · 错料不中 · 2×2 摆不出 | 同上 |
| C4 | :1015 合成执行（:1019 红） | canCraft 站点门禁+缺料清单 · gridCraft 端到端 glider×1 dur=1 | 同上 |

### mode-kit.test.js（71 测试：1 红 70 绿）——HUD 块 M1

| # | 测试（行号） | 验收块 | 红因 |
|---|---|---|---|
| M1 | :1608 装备条形状（:1612 红） | 五槽序 `…boots, glider` + data-slot | mkArmorBar 派生自现四槽表（actual 缺 `glider`） |

mode-kit 其余测试（update 节流/点槽）派生自 EQUIP_SLOTS，扩表零改动自动生效——未加测试（票面验收「出现且可用」，第五槽耐久条豁免归 T-G03/UI spec §4.4，本票不测不修）。

### armor-overlay.test.js（4 测试：0 红 4 绿）——人物观感块 A1/A2

| # | 测试 | 验收块 | 状态 |
|---|---|---|---|
| A1 | 只穿翼零贴图零网格 | 人物 overlay 零参与（红线 9） | **防回归锚**（显式四分支分支表外天然跳过，夹具假 EQUIP_SLOTS 对齐五槽后即绿） |
| A2 | 全套甲+翼逐骨 children 一致 | 甲翼互不排斥零干扰 | 同上 |

A1/A2 的价值=防将来分支表改成循环派生误画翼；夹具 :44 已对齐生产五槽表（同票修）。

### adventure-mode.test.js（188 测试：8 红 180 绿）——集成块 V1–V6 + q27 行为链

| # | 测试（行号） | 验收块 | 红因 |
|---|---|---|---|
| V1 | :1932 QUESTS 守门（:1934 红） | 任务数 27→28 + id 全集尾追加 q27_glider | ADV_QUESTS 27 条 |
| V2 | :5222 q27 数据行（:5225 红） | 逐字断言（icon/goal/target/hint/praise/prog/check/unlock/finale 全 undefined） | 表无 q27 |
| V3 | :4321 老档空穿（:4325 红） | `[...EQUIP_SLOTS]` 五 null | EQUIP_SLOTS 四槽 |
| 链1 | :5237 老档 step=27 接棒（:5245 红） | 合成 glider → 记账 craft_glider → update(0.55) → step 28 表外 + praise 播报 | ADV_QUESTS[27] undefined |
| 链2 | :5254 提前合成（**绿**） | step 0 提前合成不跳步、计数保留 | **防回归锚**（记账与步进解耦现状即成立） |
| V4 | :5263 第五槽穿戴（:5270 红） | 皮全套+翼 armorPoints=7 · advWornTakeOff 卸翼回包 · advTryWearSlot 槽参同效 | mkStack('glider')=null（ITEMS 未注册链） |
| V5 | :5286 战斗磨损豁免（:5293 红） | 连打 4 发 glider.dur 恒 1 槽在 · 皮帽 110→106 对照 | 同上链 |
| V6a | :5302 存档五键 roundtrip（:5312 红） | 翼随档恢复 + getSaveView().armor 五键 | 同上链 |
| V6b | :5324 老档剥键（:5333 红） | mem JSON 剥 glider 键 → freshInit → glider===null 四甲保真 | mkWorn 四键（w.glider undefined ≠ null） |

### 守门连锁（不碰的自动守门，基线全绿）

- `test/icons-item.test.js` 19/19 绿：扩表后 ITEMS 键集守门自动红，绿方补 ITEM_PIX.glider（UI spec §5.2 字符画逐字符）后自绿。
- `test/item-hint-registry.test.js` 6/6 绿：覆盖守门（≤24 字+全表覆盖），补 ITEM_HINTS.glider 后自绿。
- `test/items-core.test.js` 21/21 绿：数值表遍历断言，glider 加行不破（绿方验收时确认）。

## 二、裁决记录（本票争议与定案）

1. **配方插入位置**：spec 只约束行形状，插在 `nether_portal` 之前保住「压轴传送门」最末契约（既有测试 :776 罩住末条=nether_portal）。
2. **adventure.js 禁触零改动**：存档三缝（:241 defaults `armor:null` / :261 encode 直取 / :276 decode wornNormalize）机械满足票面「encode/decode/defaults 机械改」——扩 mkWorn/wornNormalize 五键即全链生效，已逐点源码核实。
3. **文案标点**：全角定案（U+FF0C/U+FF01/U+3001），测试期望值已对 spec 源文件字节级核对（防 markdown 显示层规范化陷阱）；话术 18 字无结尾标点，tts=名+，+说明（item-hint-registry.js:227 拼装契约）。
4. **E7/A1/A2/链2 碰巧绿**：扩表后即绿的行为锁定，非红测试，防回归锚（回执逐条登记，红因分类照 §7.4）。
5. **不写票文没有的测试**：字符画 16×16/对称/五色形状不测（UI spec §5.2 已程序验证背书；存在性由 icons-item 键集守门罩住）；第五槽耐久条豁免归 T-G03（UI spec §4.4），本票不测。
6. **老档集成模拟走 mem JSON 剥键法**（V6b），不猜 save-slot version/migrate 语义；纯核心层四键补 null 由 E8 覆盖。
7. **清单外发现**：adventure-mode.test.js:1932 任务数守门是第六处硬编码四槽/27 处——按同票纪律同步修（V1），不另开票。

## 三、文件清单（红侧已落盘）

| 文件 | 改动 |
|---|---|
| test/equipment-core.test.js | :40/:45 五槽断言 + loadEquipment 桥接扩展（armorOf/mkStack/stackMax/durOf）+ 尾部 E1–E9 + loadGliderHints（只装 items-core+item-hint-registry） |
| test/craft-core.test.js | :99-104 计数 77 + :126 tableIds 加 glider + 尾部 C1–C4 |
| test/mode-kit.test.js | :1606-1613 四槽→五槽（M1） |
| test/armor-overlay.test.js | :44 夹具五槽 + 尾部 A1/A2 |
| test/adventure-mode.test.js | :1932-1947 守门 V1 + :4324 五 null V3 + 尾部 V2/链1/链2/V4/V5/V6a/V6b |
| .scratch/glider/receipts/T-G01-receipt.md | 本回执 |

## 四、转绿轨迹（绿方 implement-engineer 落盘，红方接管验收复核补记）

- [x] 绿方改动文件与逐文件说明（前任绿方完工返回因服务重启未送达，以下为接管
      tdd 主人逐文件 diff 复核重建）：
  - `js/items-core.js`：ITEMS 尾部加 `glider` 行——`{name: '滑翔翼', icon: '🪂',
    armor: {slot: 'glider', tier: 'gold', pts: 0, tough: 0, dur: 1}}`（spec §3.1
    五元组逐字段一致，形状照 helmet_leather 行）；头注释「盔甲五类条目」补滑翔翼。
  - `js/item-hint-registry.js`：ITEM_HINTS 尾部加 `glider: '穿上它，从高处跳下
    就会张开翅膀滑翔啦'`（UI spec §5.3 逐字，无耐久/损坏暗示——ADR 0012）。
  - `js/icons.js`：新增 `GLIDER_ART`（16 行字符画与 UI spec §5.2 逐字符一致，
    验收逐行比对）+ `ITEM_PIX.glider = {art, map}`——map 五色 g/G 取
    `PIX_TIER.gold.main/light` 常量引用（三处同源防漂移），+/-/w 为定稿 hex
    （#d08a5a/#b0553a/#e0ded4）。
  - `js/craft-core.js`：RECIPES 插 `glider` 行于 `nether_portal` 之前（保住压轴
    传送门最末契约，裁决 1）——station table / out glider×1 / U-05 图案逐格与
    spec §3.2 数据行一致；公开配方零 KIT_HIDDEN_RECIPES 改动；头注释计数对齐
    77（随身 13+台级 64）。
  - `js/equipment-core.js`：EQUIP_SLOTS 尾部追加 `'glider'`；mkWorn 扩五键；
    wornWear 槽名特判豁免（`s === 'glider'` 原样带过，不入磨损不入 broke——
    ADR 0012 红线落地点）；wornNormalize 遍历 EQUIP_SLOTS 派生自动五键（老档
    四键补 glider:null 零迁移）；头注释五槽化同步。
  - `js/adventure-core.js`：ADV_QUESTS 链尾（q26_den_chest 后）追加 q27_glider
    ——icon/goal/target/hint/praise/prog/check 七字段与 spec §3.7 代码块逐字
    一致（含全角标点），无 unlock 无 finale；零新记账机制（craft_glider 配方
    注册即有）。
  - `GLOSSARY.md`：「装备核心」词条四槽表述修订为五槽（ADR 0013 Consequences
    点名；其余新词条归 T-G06）。
- [x] 定向 node --test 全绿输出（接管验收实测，2026-11-15）：

  | 文件 | tests | pass | fail | 覆盖 |
  |---|---|---|---|---|
  | test/equipment-core.test.js | 25 | 25 | 0 | E1–E9（21 红中 7） |
  | test/craft-core.test.js | 55 | 55 | 0 | C1–C4 + 计数 77（21 红中 5） |
  | test/mode-kit.test.js | 71 | 71 | 0 | M1（21 红中 1） |
  | test/armor-overlay.test.js | 4 | 4 | 0 | A1/A2 防回归锚 |
  | test/adventure-mode.test.js | 188 | 188 | 0 | V1–V6b + 链1/链2（21 红中 8） |
  | test/icons-item.test.js（守门） | 19 | 19 | 0 | 键集连锁自绿 |
  | test/item-hint-registry.test.js（守门） | 6 | 6 | 0 | 覆盖连锁自绿 |
  | test/items-core.test.js（守门） | 21 | 21 | 0 | 见下：接管修复后自绿 |

  21 红全数转绿，零跳过零 todo。
- [x] 禁触面确认：`git diff --stat js/modes/adventure.js` 空输出=零改动；
      js/modes/ 目录全目录零改动；test/ 改动仅本票清单 + 守门同步两处（见 §四·1
      接管补记）+ T-G02 所有权文件（并行票，未触）。

### 四·1 接管验收补记（现任 tdd 主人，2026-11-15）

前任绿方完工返回未送达，接管后逐项复核发现三处守门/注释缺口，按票面要求 7
「守门测试同步……全以 npm test 全绿为准」（spec 红线 4 同文）当场修复，均已
入定向自证：

1. `test/items-core.test.js:105` armor.slot 合法槽集合硬编码四槽——glider 加行
   即红（红侧回执「加行不破」判断失实）。裁决：期望对齐五槽（实现对 spec、
   期望是旧槽表化石，非迁就实现）。**此文件因本票守门同步需要随票提交**（原
   派令提交清单未列，偏离理由=全量门禁必需，见尾注）。
2. `test/mode-kit.test.js:823` craft 面板装备页断言槽数 4/槽序四槽——EQUIP_SLOTS
   扩五后从绿转红（红侧时实现未落故不红，红清单外第六处硬编码守门，spec 红线 4
   「验收以 npm test 全绿为准，不以本清单穷举为准」正中此情形）。同步五槽断言
   +worn 夹具补第五键。
3. 注释失真两处：`js/equipment-core.js` wornNormalize 头注释「四键全在」→五键；
   `test/equipment-core.test.js` 测试标题「归全四键」→五键（断言本已五键）。

## 五、票外发现（如实登记，不扩票）

- `js/armor-overlay.js:35` 头注释仍写「EQUIP_SLOTS(四槽序)」——扩表后注释失真，armor-overlay.js 不在本票绿方所有权清单。**经理已裁定（2026-11-15）：归 T-G03 顺带修，本票不动**。
- adventure.js:5011 尾部导出清单注释提及「装备 T9 追加 advTryWearSlot…」为历史注释，与本票无关。**经理已裁定：不动。**
- （接管补记）红侧回执「守门连锁」节曾预判 items-core.test.js「加行不破」——实测 :105
  槽位集合守门即红，属红侧预判失实非票文缺口，修复记录见 §四·1。

## 六、合入窗口执行记录（红方，2026-11-15 工程经理窗口令+补充令）

1. **绿方收缴**：ses_e20fbc30cfferYygYru7vLX2sG 追令收兵，回执「无未报告改动、已停止，
   不再触碰 T-G01 任何文件」——与红方逐 diff 核查一致，僵尸态解除。
2. **盘面稳定复核**：所有权清单（7 实现+6 测试+GLOSSARY+回执 5 文件）自终验后零漂移；
   新增仅 .scratch/handoffs/ 移交文档（编排侧产物，不入票）。
3. **第六处清单外硬编码同票修**（补充令）：test/adventure-core.test.js:1397 任务总数
   27→28 + [26]「末条」消息纠偏 + 补 [27] 末条=q27_glider 断言（口径同 V1）；
   定向 adventure-core.test.js 123 测试 fail=0。
4. **全量门禁**：npm test → **tests=2154 pass=2153 fail=0 skipped=1**（skipped 基线固有）
   全绿；npm run lint → 红方所有权 3 处已修（equipment-core.js:99 块注释外移 /
   adventure-mode.test.js:1943 max-len 拆行 / equipment-core.test.js:412 未用解构摘除），
   定向复跑 213/213 零扰动；**余 8 errors 全在 test/voxel.test.js:497（T-G02 所有权，
   按令报回经理裁决，不代修不回滚；该文件不在本票 add 清单，8 errors 不进本票提交快照）**。
5. **提交**：待经理对 T-G02 lint 8 errors 裁决后执行（add 清单=窗口令 15 文件+补充令
   2 文件=test/items-core.test.js + test/adventure-core.test.js；提交信息在提交记录
   见第 6 条）。
6. **裁定 A 执行完毕（经理裁定 2026-11-15）**：lint 余 8 errors 归 T-G02 自己的窗口
   清零（提交快照不含 test/voxel.test.js，快照口径门禁全绿成立）。提交
   **`41f187f`**：19 文件（6 实现+GLOSSARY+7 测试+回执 5 文件）+740/−53；
   提交信息=「T-G01 数据层合入: 物品/配方/第五槽/存档五键/wornWear 耐久豁免/任务 q27
   （21红转绿+守门连锁绿）+守门连锁三处同票修」（末节覆盖 :1397/:105/:823 三处
   清单外修复）；最终门禁：npm test **tests=2154 pass=2153 fail=0 skipped=1
   （全绿）**；lint 本票名下文件**零错误**（余 8 errors 全在 T-G02 的
   test/voxel.test.js:497，未 add 未触碰）。本条补记系提交后落笔（哈希自指），
   留工作树待下个窗口顺带入库。

