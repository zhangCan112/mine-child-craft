# 回执·scene 场景师收尾(town-design-scene)

> 派单:town-design-lead · 2026-11-15 收尾
> 文件权:js/town-map-core.js + test/town-map-core.test.js(anchors 段未动一字)
> 交付节奏:按 brief「新 kind 协议」两版交——本回执含第一版交付清单、跨文件 pin 同步表、第二版新 kind 需求表。

## 一、已入库(v1,只用现有 kind)

| commit | 内容 | 仓库态 |
|---|---|---|
| aa21d7f | A 层第一笔:摊位 3→6(广场 4+主路口 2)+灯柱 2→11(广场环/北主路/进镇门廊对位/断头端点信标×3)+路标 2→4(东/南路口)+同名单测同步(摊位数/灯柱数/断头信标/密度上限 24) | 全仓 npm test 2074 pass + lint 零错 |
| 28941a1 | A 层第二笔:樱花 2→6(门廊对位×2+广场角樱×2)+B 层崖屋脊线复位(x40/x112→x56/x103,baseY 41,露出脊线 5 格)+同名单测(门廊对位/广场樱花≥3/崖屋脊线可见) | 本岗 14 test 绿;3 处跨文件过期 pin 红(见下) |

## 二、跨文件 pin 同步表(**需 arch/lead 落**,非本岗文件,勿回滚我数据)

v1 数据变化使 3 处别线测试里的字面 pin 过期。新期望值如下,照抄即可:

1. **test/town-assembly-core.test.js:222**(植被道具测)「tree op 恰两株樱花」——
   实际现在 6 株,位对齐 TOWN_MAP.scatter 全部 sakura:
   `[68,88] [78,52] [88,67] [67,69] [75,101] [83,102]`(建议改为动态派生
   scatter 清单防再漂移)。
2. **test/town-assembly-core.test.js:292**(拱形山体几何测)崖屋 fill 字面——
   旧 `x39..41/y36..41/z15..17` 与 `x111..113/y35..40/z19..21` →
   新 A:`x55..57, y41..46, z21..23`;新 B:`x102..104, y41..46, z21..23`
   (id 6,baseY..baseY+5 契约不变:47-41=6 ✓)。
3. **test/adventure-dims-core.test.js:578-581**(通廊与不可达测)崖屋格 pin——
   `cell(40,36,16)/cell(40,41,16)/cell(112,35,20)/cell(112,40,20)` →
   `cell(56,41,22) / cell(56,46,22) / cell(103,41,22) / cell(103,46,22)`(皆 id 6)。

同测试的「出生回望走廊 x78..80×z76..111×y≥25 全空」与 op 级零写入断言**已过**
(门廊 e 树让位 x83,冠幅 81..85 不入走廊);npc 避让/巡逻两测**已过**
(新摊/角樱/灯柱全部让 npc 站位 ≥2、G01 环线 x66/x92/z66/z92 零脚印)。

## 三、v1 设计拍板说明

- **进镇门廊**(出生第一眼,§3 构图层 scatter 方案):spawn(79,112) 面北,
  灯柱 x75(104)/x81(105) 紧贴路缘对位,樱花 x75(101)/x83(102) 交错。
  e 树从 brief 建议的 x81-82 让到 x83:走廊零写断言钉死 x78..80,冠幅 ±2
  在 x81 即侵入;实拍(10-spawn-birth.png)门廊框式构图成立,钟塔入画。
- **摊位落位**:东北 md 花(86,68)/东路口 sm 面包(89,87,盒 x89..90 让
  巡逻环 x92 列)/南路口 md 果(83,90,盒 z89..91 让 z92 行);三条主路口
  迎面皆有摊,广场内四摊成簇,塔走廊与 npc 约束全过。
- **崖屋**:装配侧拱形公式下 x56/x103 局部脊高恰 41,盒顶 46 露 5 格,
  分列钟塔影轴(半宽张角 ~4°)两侧 ~14°;实拍(13/22)以小剪影在脊线上,
  待 v2 白墙 52/17+橙顶 9+灯点 19 造型后才会跳出来。
- **断头信标**:main-east 东端(121,86)/main-south 南端(79,119)/lane-west
  西端(47,79);判定规则「端帽三不贴=断头」已写成可执行断言(贴建筑=
  目的地终站不算,如 lane-farm 尽头的风车)。
- **保留不动**:lamp-plaza(77,92)/lamp-west(64,67)/双路标/双 scrub/
  sakura-plaza/farm 原坐标——adventure-dims 测试 556-564 钉其格位,动一格
  即新增红;东南灯柱因此从 (91,91) 收到 (91,90) 避 g01 角点 (92,92)。

## 四、第二版新 kind 需求表(交 lead 在 assembly 侧落地;op 词表扩展由 lead 拍板)

| # | kind(落点段) | 语义 | 需要的色 id | 建议 op 派生 |
|---|---|---|---|---|
| 1 | tuft(scatter) | 草丛散布:域+步距 8,hashRand 定点,避建筑/路/广场/农田/走廊 | 40 | 单格 fill 或 scrub 族(去冠) |
| 2 | flower-y / flower-w(scatter) | 蒲公英/雏菊:域+步距 16 稀点 | 61 / 62 | 单格 fill |
| 3 | flag(scatter) | 旗:柱 2 高+旗面 1 块,钟塔脚 4 角 (76,69)(83,69)(76,76)(83,76) | 柱 5;面 78/15/17/16 各一 | 两笔 fill |
| 4 | farm-rows(ground) | 田垄:farm 域内按走向分行——41 沟底+42/43/44/45 相位混排行+(每 4 行)58 田埂+周边 5 围栏桩 | 41,42-45,58,5 | fill 组合(逐行条带) |
| 5 | curb(road 附属) | 主路两侧缘石带 13(支路 4);road 条目加 curb 字段 | 13 / 4 | 每段两侧细条 fill(须后于路体写) |
| 6 | wayshrine(ground) | 断头小坪:main-east 端 x118..124,z83..89;main-south 端 x75..83,z116..122;pad 13 芯 4 边+既存信标灯柱 | 13,4 | fill(须后于 road 写,否则被路体覆盖) |
| 7 | mountain-arch 分段+B 分色(backdrop) | 山脊五段弧形轮廓:中锋 44/两肩 38/两麓 30(x16..47/40..79/64..95/88..119/112..143,重叠域取 max 合脊)+三段分色:y≥40 雪 54,y31..39 石 3,y25..30 苔 14,南缘 z27..28 草坡 1 过渡;山脚散布 scrub+苔石 14 点(域 z26..31——现 scatter ⊆ core 断言挡住 z<32,故须落 backdrop 段新 kind) | 54,3,14,1 | 逐柱 fill(分段包络+分层着色) |
| 8 | cliff-home 造型字段(backdrop) | 白墙 52/17+橙顶 9 阶梯+灯点 19×2+窗 18 | 52,17,9,19,18 | palette cliffHome 单键拆多键+kernel 式多 fill |
| 9 | 灯柱造型升级(props) | 柱基 17 灯罩座+5 柱+19 灯头(§3 A 造型升级) | 17 | 三笔 fill |
| 10 | flowerbed/barrel/pumpkin(scatter) | 花坛(4 围 40/61/62 芯)/木桶(5)/南瓜 76:广场角+建筑门前确定性散布 | 4 或 5 围,40/61/62,5,76 | 小组合 fill |

配平项:樱花冠 16→78 只差 TOWN_PALETTE.tree.sakuraLeaf 16→78 一键(lead/arch
M 层随手改,我的清单零改动);fish/pumpkin 摊位 theme 新档需引擎 PF_STALL_CANOPY
加键(v.canopy 显式注入可先行,不必等)。

## 五、自查与证据

- 重拍:`.scratch/town-design/shots-scene/`(walk-scene.mjs,PORT 9226,
  服务 8091 已收,未覆盖 lead 原 shots/)。重点:10(门廊成立)/13(广场
  密度+崖屋脊线小剪影)/22(市集全景);樱花冠仍是 16 红羊毛——palette
  78 一改即粉,属上表配平项。
- 数值探针:`.scratch/town-design/probe-scene.mjs`(vm 链直验 TOWN_MAP 现状,
  685 项全过:脚印/避让/走廊/可见性/构图断言口径)。
- 门:两笔各自 npm test(2074)+npm run lint 零错;第二笔后全仓恰余上表
  3 处他线过期 pin 红。

## 六、遗留与风险

- 3 处 pin 同步前,全仓 npm test 恒红 3 项(都在 town-assembly-core.test.js
  与 adventure-dims-core.test.js)——arch 一改即全绿,我数据不再动。
- 农田 18 机位无变化(田垄=v2 #4);山体弧形/分色=v2 #7。
- 巡逻环设计注:g01 环线穿广场铺装边缘,现有灯柱环已让线;若后续 npc
  实装碰撞,摊位 A 盒(x84..87,z67..69)距环 1 格,可能需再让 1 格。

# 七、v2 收官(scene 两笔, 2026-11-15)

## 7.1 交付物(对照 §四 需求表十项)

提交 `656a2fe`(第一步, 十项之九)+第二步 bands/崖屋(见 7.5, 随后提交):

| # | 项 | 落地 |
| --- | --- | --- |
| 1 | tuft 全域散布 | 112 件(12×12 块锚 8×8 步距, 确定性偏移 (bx*73+bz*151+3)%8, 全约束过滤后存量) |
| 2 | flower 双色散布 | 26 件(6×6 块 16×16 步距, 盐 5/9), v.tone 按块索引 (i+j)%2 混排, y/w 各 13 |
| 3 | 旗阵四色 | 4 杆贴钟塔足印半环 (78,68)/(80,68)/(76,71)/(83,71), v.cloth sakura/blue/quartz/red |
| 4 | farm-rows 田垄 | farm-a/b kind 升格, 域不变(npc 站位与巡逻面零连累) |
| 5 | curb 路缘石 | roads 六段全 curb:true |
| 6 | wayshrine 断头小坪 | ×2: 东 (121,84)-(125,88) 贴 main-east 端 / 南 (76,119)-(80,123) 贴 main-south 端; 各含既有驿站灯柱恰 1 |
| 7 | 山缘植被 | scrub×4 (17,25,26)/(19,26,26)/(21,27,27)/(141,25,26) + boulder×3 (18,25,28)/(139,26,27)/(143,24,26), y=拱形列顶 |
| 8 | mountain bands + 崖屋 v2 | mountain-arch bands:true + cliff-home-a/b style:'v2'(第二步) |
| 9 | 灯柱造型 | v1 三笔已满足, 零改动(arch §8.3 同判) |
| 10 | 花坛/桶/南瓜 | flowerbed×3: (90,92) 广场东南+(42,76) cottage 门+(42,80) loft 门; barrel×2: (54,100)/(58,46); pumpkin×2: (40,77)/(89,58) |

## 7.2 设计拍板(v2 新)

1. **写序契约落地**: townBuildSteps 拆两笔——非 wayshrine 地表照常打头,
   wayshrine 加冠于 road 段后(后写者赢不被路体/缘石覆盖); phase 标签不变,
   分组视图 townAssemblyPhases 归并不受影响(两测 phase 断言「首现序」口径不红)。
2. **空隙带保持零写入**: 山缘点缀落 z24..28 低柱段墙顶(y=拱形列顶, 脚下
   实心), 不落 z29..31 虚空带——虚空带无地表, 贴地点缀落虚空=浮空穿帮;
   严于派生侧 op 层「单格贴地豁免」口径, 美学拍板留痕。
3. **广场家具自动分层**: 规划谓词对广场域内家具点豁免广场/农田谓词
   (花坛本来立铺装上), 地被类(tuft/flower)全禁广场——零手标豁免表。
4. **flower 双色调坑**: 块锚+偏移恒奇 → (x+z) 恒偶 → 首版全 'y';
   改按块索引 (i+j)%2 混排, 终版 13/13。
5. **旗阵避让**: 南面被回望走廊(z≥76)封死, 旗压 z68/71; 两角让 npc
   v04(76,69)/v08 站位切比 2。旗贴塔足印外切比 1..2(测试钉)。
6. **足印实测纠偏**: flowerbed-loft 挪 (42,81)→(42,80)(loft 实际足印
   x38..47 z82..89 比需求表预估大); barrel-stash 挪 (54,98)→(54,100)
   (stash 足印 x46..51)。footOf 实测先于拍板。
7. **山缘支撑单源**: rimTop(列顶)从现行 ops 反查(128 列), 数据字面
   y=列顶(17→25, 19→26, 21→27, 141→25, 18→25, 139→26, 143→24);
   测试侧以拱形公式独立重算对账(同式双源互证)。
8. **作物不入 palette**: farm-rows 作物 42..45 走派生字面(arch §8.3
   登记), pin 补丁必须用字面量。
9. lamp-plaza (77,92) 不移(v1 拍板沿用, npc v03/G01 环已让)。

## 7.3 第一步三处过期 pin 精确补丁(待 arch 抄; 他线文件我不改)

全仓 2076 pass / 3 fail, 三红全为数据形态 pin(v1 先例: 带文档化 pin 提交):

1. `test/adventure-dims-core.test.js` 448/449:
```js
// 原:
assert.strictEqual(cell(70, 24, 50), 41, '农田 A 耕地 41');
assert.strictEqual(cell(84, 24, 50), 41, '农田 B 耕地 41');
// 新(farm-rows 行轮转: r=z-z1, id=42+(r%5)-1; 50-44=6→42, 50-46=4→45):
assert.strictEqual(cell(70, 24, 50), 42, '农田 A 田垄作物 42(farm-rows 行 r=6 轮转)');
assert.strictEqual(cell(84, 24, 50), 45, '农田 B 田垄作物 45(farm-rows 行 r=4 轮转)');
```
2. `test/town-assembly-core.test.js` 86(SCRUBS 常量, op 序=backdrop 先于
   scatter; salt 派生式 x*131+z 不变自动算对):
```js
// 原:
const SCRUBS = [{id: 'scrub-west', x: 60, y: 24, z: 70}, {id: 'scrub-east', x: 98, y: 24, z: 92}];
// 新(山缘 4 丛入列, y=列顶):
const SCRUBS = [{id: 'scrub-rim-w1', x: 17, y: 25, z: 26},
  {id: 'scrub-rim-w2', x: 19, y: 26, z: 26}, {id: 'scrub-rim-w3', x: 21, y: 27, z: 27},
  {id: 'scrub-rim-e1', x: 141, y: 25, z: 26},
  {id: 'scrub-west', x: 60, y: 24, z: 70}, {id: 'scrub-east', x: 98, y: 24, z: 92}];
```
   330 行断言消息 'scrub op 两丛带确定性盐' → 'scrub op 六丛带确定性盐'。
3. `test/town-assembly-core.test.js` 369/370(fillAt=末笔覆盖; 作物字面
   不入 palette, 勿用 PALETTE_WANT.ground.farm):
```js
// 原:
assert.strictEqual(fillAt(70, 50, 24).id, PALETTE_WANT.ground.farm, '农田 A 铺耕地');
assert.strictEqual(fillAt(84, 50, 24).id, PALETTE_WANT.ground.farm, '农田 B 铺耕地');
// 新:
assert.strictEqual(fillAt(70, 50, 24).id, 42, '农田 A 田垄作物 42(farm-rows 轮转, 作物字面不入 palette)');
assert.strictEqual(fillAt(84, 50, 24).id, 45, '农田 B 田垄作物 45(farm-rows 轮转)');
```

## 7.4 自查与证据(第一步)

- 规划: `.scratch/town-design/scene-plan-v2.mjs` 确定性落点规划,
  problems=0 / 回望走廊零命中 / 空隙带零命中 / 山缘 7 点全实心支撑;
  报告 `scene-plan-v2-report.txt`(含全部字面量与弃点明细 42 条)。
- 门: 本测 14/14 · `npm run lint` 零错 · 全仓 2076 pass 3 fail(=7.3)。
- 走查: `shots-scene-v2/` 16 机位(walk-scene-v2.mjs, 服务 8091 静态读盘
  内容即 656a2fe 已验证)。证据机位: 18 田垄条带+围栏 / 26 缘石线+山缘丛
  同框 / 27 西缘低柱段丛石近观(两丛绿 scrub+苔石立墙顶阶梯) / 25 塔脚
  旗阵+钟塔全景 / 24 南路端缘石+驿站坪 / 23 东驿站坪+灯柱 / 22 全景
  (旗阵+草丛群) / 13 广场北望塔脚红旗。
- 环境: 8091 被既有进程占用(EADDRINUSE, 非本会话所起), 走查直接复用;
  静态服务读盘即最新提交, 内容一致性已由截图证实; 未动他线进程。

## 7.5 第二步: mountain bands + cliff-home v2(同日随交付)

数据两处: mountain-arch 加 `bands: true`; cliff-home-a/b 加 `style: 'v2'`。
派生侧(e749405)全就绪: bands 五段=基段石 3(y0..23)/表层苔 14(y24..min(top,30),
z≤26)/草坡 1(z27..28 两行)/石 3(y31..39)/雪 54(y40..top), 空段跳笔;
崖屋 v2=白墙 52(y baseY..topY-2)+角柱 17×4+窗 18 十字(baseY+2)+橙顶 9
双层(topY-1 3×3+topY 芯)+顶缘灯 19(topY, x-1..x+1)。

**第二步必红面(推演已获全仓实测证实, 2026-11-15 批次 2074 pass / 5 fail)**:
- `test/adventure-dims-core.test.js` 584/585: 山脊 cell(79/80,44,20) 3→54(雪段)
  ——584 实测 54!==3 红见见证; 586/588: 两缘 cell(16/143,24,20) 3→14(苔段);
  587 西缘 y25=0 不红; 589..592: 崖屋 cell(56/103, 41/46, 22) 6→52/9/52/9
  (墙 52 四格+顶 9 两格)。
- `test/town-assembly-core.test.js` 379 测试(拱形山体逐柱满覆盖·崖屋
  3×3×6): topAt(79)/(80) 期望 44 → bands 后基段笔 y2=23 红(实测 23!==44
  见证); topAt(16)/(143) 期望 24 → 23 红; cliffHome id===6 两笔 deepEqual
  → v2 拆多笔 id52/17/18/9/19, filter 空 → 红(394..397)。
- 连同第一步三 pin(dims 448/449 · assembly 86/330 · assembly 369/370),
  全仓第二步批次 5 fail = 两步全部过期 pin(其余 2074 全绿), arch 按
  §7.3+本节一次抄清即全绿。
- 我测侧: 远景测试加 bands/style 字段门控两断言(数据侧开关钉死, 分段
  几何归派生), 列顶/脊可见性断言与颜色分段无关不红(实测 14/14 绿)。

### 7.5.1 被遮蔽行精确补丁(arch 抄写底稿)

node:assert 首错即中断, 每个测试内最先红行之后的续行全被遮蔽; 以下按
派生公式推演补全(已红两行有实测见证, 被遮蔽行与见证行同段同式)。

(1) `test/adventure-dims-core.test.js` 山脊崖屋测试 584..592(587 不动):

```js
// 原:
assert.strictEqual(cell(79, 44, 20), 3, '山脊石 3 @(79,44,20)(顶高过钟塔 38)');
assert.strictEqual(cell(80, 44, 20), 3, '山脊石 3 @(80,44,20)');
assert.strictEqual(cell(16, 24, 20), 3, '山体西缘 topY=24 @(16,24,20)');
assert.strictEqual(cell(143, 24, 20), 3, '山体东缘 topY=24 @(143,24,20)');
assert.strictEqual(cell(56, 41, 22), 6, '崖屋 A 底 6 @(56,41,22)');
assert.strictEqual(cell(56, 46, 22), 6, '崖屋 A 顶 6 @(56,46,22)');
assert.strictEqual(cell(103, 41, 22), 6, '崖屋 B 底 6 @(103,41,22)');
assert.strictEqual(cell(103, 46, 22), 6, '崖屋 B 顶 6 @(103,46,22)');
// 新(bands: 脊顶 y44 落雪段 54, 两缘列顶 y24 落苔段 14;
//    崖屋 v2: y41 落白墙 52, y46 落橙顶 9; 587 西缘柱顶 0 不动):
assert.strictEqual(cell(79, 44, 20), 54, '山脊雪 54 @(79,44,20)(顶高过钟塔 38)');
assert.strictEqual(cell(80, 44, 20), 54, '山脊雪 54 @(80,44,20)');
assert.strictEqual(cell(16, 24, 20), 14, '山体西缘苔 14 topY=24 @(16,24,20)');
assert.strictEqual(cell(143, 24, 20), 14, '山体东缘苔 14 topY=24 @(143,24,20)');
assert.strictEqual(cell(56, 41, 22), 52, '崖屋 A 墙 52 @(56,41,22)');
assert.strictEqual(cell(56, 46, 22), 9, '崖屋 A 顶 9 @(56,46,22)');
assert.strictEqual(cell(103, 41, 22), 52, '崖屋 B 墙 52 @(103,41,22)');
assert.strictEqual(cell(103, 46, 22), 9, '崖屋 B 顶 9 @(103,46,22)');
```

(2) `test/town-assembly-core.test.js` 379 测试 topAt 四断言 389..392:
id===3 且 y1===0 的列过滤在 bands 后每柱恰命中基段笔(y1=0, y2=23;
石段笔 y1=31 不入选), 故 385 逐柱满覆盖与 393 每柱自 y0 两断言不红,
唯 topAt 语义变为基段笔顶(389 实测 23!==44 见证):

```js
// 原:
assert.strictEqual(topAt(79), MOUNTAIN.topCenter, '山脊中心 44(压钟塔 38, 顶高过钟塔)');
assert.strictEqual(topAt(80), MOUNTAIN.topCenter, '双中心列同高 44');
assert.strictEqual(topAt(16), MOUNTAIN.topEdge, '西缘 24(二次拱形落地)');
assert.strictEqual(topAt(143), MOUNTAIN.topEdge, '东缘 24');
// 新(最小改动案: 期望改基段笔顶 23; 山体真实顶 44/24 改由雪段笔表达,
//    arch 若想保留顶高语义可另补 id===54 笔的顶断言, 二选一):
assert.strictEqual(topAt(79), 23, '山脊基段笔顶 23(bands 拆笔后 id3 每柱首笔)');
assert.strictEqual(topAt(80), 23, '双中心列基段笔顶 23');
assert.strictEqual(topAt(16), 23, '西缘基段笔顶 23(两缘列顶 24 由苔段表达)');
assert.strictEqual(topAt(143), 23, '东缘基段笔顶 23');
```

(3) 同测试 394..400 崖屋两笔 deepEqual: v2 拆笔后 id===6 过滤得空数组
直接红, 无逐行改值的最小补丁, 须按 arch 回执 §8 崖屋 v2 契约(墙 52 +
角柱 17×4 + 窗 18 十字 + 顶 9 双层 + 顶缘灯 19)重列 op 清单或改断言
语义。底稿导出(勿手抄文字, 以实际 op 序为准): node 落盘脚本 loadCore
后取
`ops.filter((o) => o.op === 'fill' && o.z2 <= 28 && [52,17,18,9,19].includes(o.id))`
即两屋全部 v2 笔(z2≤28 排核心区, id 集排山体 3/14/1/54)。

# 八、TIDEA 波次一·scene 五件数据项(2026-11-15)

派单五件全部落地,形态=「现成 kind 活件+字段契约先行件」:派生侧
(town-assembly-core)对未知 kind 抛错、对未知字段静默忽略——故新几何
一律以既有条目的新字段表达(op 零变化,全仓零新红),派生实现需求清单
见 8.3,arch 抄清即视觉生效。落点全部经 `scene-plan-tidea1.mjs` 确定性
规划 problems=0(报告 scene-plan-tidea1-report.txt)。

## 8.1 五件交付对账

| 件 | 提案 | 落地形态 | 落点 |
| --- | --- | --- | --- |
| TIDEA-05 | W-05 瀑布白线 | mountain-arch 加 `waterfall:{x1:63,x2:64}` 字段契约 | 列域 x63..64(列顶 43,雪段 40..43 在场) |
| TIDEA-06 | W-06 南门回程件 | 活件: scatter `signpost-home` (75,126) + 灯复用既有 lamp-end-south | 坪南 3 格路西侧 |
| TIDEA-07 | W-07 镇徽+花带 | plaza-paving 加 `emblem`+`axisBloom` 字段契约 | 徽 (77..80,109..112) / 带 x79..80 z76..107 |
| TIDEA-09 | W-09 寻宝记号 | stash-hut 顶层 `tidea:{porchLamp,groundMark}` 契约 | 挂灯门楣 dx2 / chevron z102..104 |
| TIDEA-04 前半 | W-04① 丰收角 | farm-a 加 `harvest:{x1:66,z1:44,x2:69,z2:47}` 字段契约 | farm-a 西北角(风车侧) |

## 8.2 设计拍板

1. **派生容错边界实测**: 未知 kind 抛错(ground/backdrop/scatter 三段
   else throw)→ 五件零新 kind;未知字段静默忽略→字段契约挂在既有条目。
2. **pfMerge v 键集守门**: stash-hut 契约初版挂 v 内被 prefab-kit
   pfMerge 抛「未知 v 键」(合法键 face/mirror/roofPitch/door/ids)——
   改挂条目顶层 `tidea:` 命名空间键:footOf 只读 v/face、派生 place 只带
   v/ids,顶层新键全链静默(教训留痕:prefab 协议键=严格白名单)。
3. **南门件位置内收**: ADR-0011 原案「z130 一带」出核心区(z2=127),
   内收 z126 保「散布 ⊆ 核心区」纪律,语义不变(回程触发线 z≥132 前最后
   视觉告别件);牌在路西侧草地(缘石线 x75 只到 z118,z126 线外)。
4. **南门灯零新增**: W-06「配一盏灯柱」由既有 lamp-end-south(79,119)
   坪芯承担(v1 断头信标先例),恰读作「门内灯」,不再落第二盏。
5. **瀑布贴面不穿山**: 派生契约=54 柱仅 z24..28 南缘薄片(非全深度柱),
   山体北面剪影不被涂白;顶接雪带下缘(y40 雪段底,柱 y25..39),底
   y25 山脚;17 石英水花两翼 x62/x65×y25..26×z26(列顶 42/43 苔面上)。
6. **镇徽含 spawn 格**: emblem (77..80,109..112) 以 spawn(79,112) 为
   南缘中央——「落地低头脚下即徽」;图样回字环纹逐行死注释在数据
   (78 樱粉 8 格+17 石英 8 格);花带序列 r=(z-76)%4 取 r<2→13 石砖
   否则 4 圆石,北端 z76 贴塔足 z75=「直抵塔前台阶」。
7. **地面重排豁免立体件避让**: emblem/axisBloom/groundMark 是 y24 平嵌
   重排,不适用「npc/锚切比 ≥2」立体件纪律(不挡站位不挡视线,走廊
   断言辖 y≥25 零冲突);v01(79,94) 站花带上=「迎客立地毯」、记号格
   距 stash 锚切比仍 ≥2(交互位留玩家)。豁免单列于此供复核。
8. **记号南移一档**: chevron 初排门侧正位(z98..101)被 under-room 埋室
   足印 x55..64 z97..101 整面挤占(footOf 实测,兼 z97 是 lane-stash
   缘石线),南移 z102..104 贴院角;chevron 顶点(55,103)朝西仍读
   「屋在此侧」,「指向门洞」降级为「指向屋角」,叙事召唤保留。
9. **丰收角 4×4 贴西缘**: farm-a 西北角 (66..69)×(44..47) 风车侧
   (W-04 语义);域内非埂行强制 45 三阶金黄(埂行 58 不动),角区含埂行
   z44 故实际金黄作物 3 行×4 列;零几何变化,npc/巡逻零连累。

## 8.3 派生实现需求清单(arch 抄清即视觉生效; 全部「未知字段静默」现状)

1. **瀑布**(mountain 分支,bands 块末尾追加): 条目带 `waterfall` 时,
   逐柱循环后追加三笔——`fill x63..64 y25..39 z24..28 id 54`(柱)+
   `fill x62 y25..26 z26 id 17` + `fill x65 y25..26 z26 id 17`(水花)。
   通用式: 柱=域列×z24..28×y(groundY+1)..39;水花=域两翼列×y(groundY+1)
   ..(groundY+2)×z26。
2. **镇徽**(ground plaza 分支): 条目带 `emblem` 时,铺装笔后按死注释
   图样逐格覆写——z109 [78,17,17,78] / z110 [17,78,78,17] / z111
   [17,78,78,17] / z112 [78,17,17,78](域内逐格 fill id 78/17)。
3. **花带**(同分支): 条目带 `axisBloom` 时,铺装笔后按域逐行覆写——
   r=(z-z 基)%4,r<2 → 13 否则 4(x79..80 两列同相横纹,z76..107)。
4. **丰收角**(ground farm-rows 分支): 行轮转覆写后,条目带 `harvest`
   时按域再覆写——非埂行(r%5!==0)fill 域×行 id 45(埂行跳过)。
5. **stash 记号**(prefab 后/散布前或调用方专步): 读 stash-hut 条目
   `tidea.groundMark`,tiles 逐格 `fill (x+dx) y24 (z+dz) id 4` 四笔;
   `tidea.porchLamp` 归蓝图面(prefab-kit 波次一在制): stash-hut 蓝图
   门楣 (锚+dx2, 基+dy2, 锚+dz0) 挂单格 19。
6. **南门栅栏桩**(无字段,新增需裁): 现成 kind 无栅栏桩,三案见 8.4。

## 8.4 权衡清单(呈 lead 裁)

| 决策点 | 选项 | 权衡 |
| --- | --- | --- |
| 南门栅栏桩 | a) 维持本笔(牌+灯,桩缓) / b) arch 加 scatter kind fence-stub(两桩单笔 fill id5,派生小改) / c) 归波次二与 TIDEA-08/10 落位同票 | a 零成本但门口件少一半; b 派生加分支+词表测试扩; c 波次二有落位票顺路 |
| 瀑布主色 | a) 54 雪白(本笔契约) / b) 17 石英 | 54 与雪带同色接续自然但雪瀑难分;17 石英对比强但偏冷灰;本笔按 W-05 首选 54,waterfall 契约可加 tone 字段后调 |
| 花带序列 | a) 横纹 r=(z-76)%4(本笔契约) / b) 纵纹 x 异色 | a 读作地毯横带,B 底片视角清晰; b 竖条拉纵深但 spawn 低视角难读 |
| 记号朝向 | a) chevron 指西(本笔) / b) 加尾点双石强化 | a 恰 4 圆石合 W-09; b 更醒目但超「4 圆石」口径 |

## 8.5 自查与红面

- 规划: scene-plan-tidea1.mjs problems=0(初版记号 4 格压 under-room
  埋室足印被脚本拦截,南移后复跑零问题——规划器拦截一次设计错误的
  实证); probe-foot.mjs 足印实测 13 盒留档。
- 门: 本测 15/15(新增 ⑪b 五件契约测试约 40 断言) · eslint 零错 ·
  全仓红面=8.6。
- 教训: prefab v 键=严格白名单(pfMerge 抛未知键),协议扩展走顶层
  命名空间键;「蓝图对未知 v 静默」的假设不成立,实测先行救了一课。

## 8.6 全仓红面小节(提交前新批口径)

- 两批全仓 npm test(旧批 sh_1dcbf2fd 与新批 sh_1dcc0bebc, 均含 arch/light
  波次一在途 WIP)口径一致: 2081 测 2077 pass / 3 fail / 1 skip。
- 3 红全部归 arch 在途 WIP 两文件(js/prefab-kit.js + js/town-assembly-core.js),
  与本笔数据零关联:
  1. test/prefab-kit.test.js:380 源守门「零 config 方块常量」——arch 新蓝图
     行触引擎层红线守门(WIP 中间态);
  2. test/town-assembly-core.test.js:138 palette 完整性「prefab 八行对齐实例
     清单」——arch 新增 5 行(scarecrow/clothesline/woodpile/hencoop/
     board-pool) vs 测试字面量 8 行未同步;
  3. test/town-assembly-core.test.js:198 钉值 TOWN_PALETTE 全表逐键相等——
     同因(prefab 5 新行 + props 3 新键 crateBox/glassPane/plank)。
- 本笔面绿证: town-map-core.test 15/15(含 ⑪b 五件契约); dims/assembly
  既有 pin 全绿(v2 遗留 5 pin 已被 arch WIP 顺手同步转绿)——五件字段
  对派生全静默、op 面零变化的推演被全仓批证实。
- lint: 全仓 6 错全在 arch 两文件(prefab-kit 1474/1521 block-spacing
  `{ x`; assembly 90..93 quote-props 四键引号), 本笔两文件零错。
- 判定: 本笔零新红零新错; arch 红与 lint 属其 WIP 中间态, 交付自转绿,
  不在本笔责任面(lead 2026-11-15 复核口径一致)。

## 十、TIDEA 波次二落位批(五 prefab 陈设件+素墙立面三笔; §7 v2 体例)

### 10.1 交付物

- js/town-map-core.js(+9 条目): prefab 段五实例——scarecrow(68,24,45)
  face:south 立丰收角金黄区(farm-a.harvest 构图互证) / clothesline(41,24,75)
  face:south cottage 门脸西段(衣格投影⊆墙段, 端桩出段 1 格避 a02) /
  woodpile(44,24,81) face:south loft 北墙门前(花坛邻格) / hencoop(105,24,76)
  face:west 鸡店西门侧贴墙(W-08④ 原案「鸡店门前小鸡窝」, 声景区位与
  TIDEA-11② 鸡叫声对齐, v07 切比 2) / board-pool(86,24,106) face:west
  v{boardLen:6,poolSize:2} 南彩蛋带东侧空域(回程触发线 z≥132 以北);
  scatter 段四条目——wallflag-loft(42,24,82) v{len:4}+windowbox-loft-w(38)/
  -e(44)+crates-loft(46) 挂 house-loft 北墙线 z82(W-03「西窗-旗-东窗-角箱」
  节奏, 全⊆墙段 x38..47 互不重格); 头注释 15→16 test。
- test/town-map-core.test.js: 16/16 绿——新增 ⑫ 波次二落位契约(①⊆harvest
  域 ②门前贴墙+避花坛南瓜 ③贴店脸段 ④南带/回程线北+dy 序钉+变体钳
  len8/ps3 盒 5×13 ⑤立面墙段内+互不重格+间隔≥2+通用切比≥2+脚印两两
  无交=动骨架-轻); 五处既有钉面同步(ids 八→十三种+board-pool 推迟→转正、
  FOOTPRINT+5 行、散布词表十→十三类、门前可达豁免 PROPS 五件、散布不落
  脚印豁免立面三 kind=挂墙覆写语义、实体带宽 40→44、零 DOM `\bwindow\b`
  词边界防误伤 kind 名)。
- `.scratch/town-design/scene-plan-tidea2.mjs`: 确定性规划脚本 problems=0
  (装配 ops 模拟器 fill+place(经重绑 setBlockRaw 导探测 Map)+recolor 三通道;
  全约束矩阵: 核心区/脚印两两/路缘/广场/驿站坪/空隙带/走廊/散布零重格/
  npc·G01 环线全格点·锚切比≥2/五件特检/墙线探测); 数据落盘后复算仍 0
  (FACADE_KINDS/NEW_IDS 滤自撞)。
- `.scratch/town-design/walk-tidea2-scene.mjs`+`shots-tidea2-scene/`:
  走查 harness(v2 骨架+第一人称 CameraRig.cycle hack 避玩家模型挡镜头;
  文件名带 -scene 避 light 线同名撞车——walk-tidea2.mjs 已被 light 覆写
  为 arrive-card harness, 不属本线)。

### 10.2 验证面

- 定向 node --test test/town-map-core.test.js: 16/16(⑫ 新增即绿)。
- 定向 eslint 两文件: 零错(--fix 后; 7 错全为缩进已修)。
- 全仓 npm test 批(2101 测 2096 pass/4 fail/1 skip): 本笔面全绿;
  4 红归属——arch 1(place 执行见证 13≠18=本笔落位撞其数字面断言, 见 10.4
  补丁底稿)+light 3(TIDEA-15/16/19 全在其在途文件 adventure.js/town-ui.js,
  与波次一归档时同款 WIP 噪音)。
- 全仓 eslint: 4 文件红全归他线(spinner-core.js+test=共享区新 WIP 两件、
  assembly-core.js+test=arch 在途 2 错 1 警); 本笔两文件零错。

### 10.3 走查底片与拍板(shots-tidea2-scene/, 底片留证)

- **board-pool 选档定稿: 保持缺省档 len6/ps2**(arch §9.3② 授权实拍自裁)。
  底片: 21b-boardpool-mid.png(主拍: 板阶 0,1,2,2,3,4 爬升+顶旗+池贴板尾
  西侧+白沙圈蓝水心, 比例幽默完整)/21-boardpool-near.png(近观)/
  20-boardpool-route.png(回程动线)。判据: len8 伸至 z118 池至 z120, 压
  驿站坪(z119..123)邻域构图变挤; len6 回程 3 秒读完。
- **W-03 素墙活化读感定稿**: 41b-wall-west.png(主拍: windowbox 白框玻璃
  窗+窗台花件挂墙清晰+深木大墙语言)/11b-wall-front.png(东段窗+墙脚箱堆)/
  11d-wall-from-lane.png(lane-west 路上看西生活带街面连续)。
- **登记①(设计发现, 需 lead 知悉): W-03 南门读法在当前密度下不成立**——
  底片 11-gate-west-facade.png+11c-gate-high.png(高机位越障仍被挡):
  v2 波次落的南门双樱(sakura-gate-e)+门柱阵把 loft 北墙从南门视点完全
  遮蔽; 该墙的可读观察点已移至广场西南侧(lane-west 一线)。W-03 原文
  「南门机位左视一面空墙」的前提被 v2 植被蚕食, 素墙活化价值改由西侧
  动线兑现(窗箱+箱堆读感不受影响)。
- **登记②(构图取舍, 本岗拍板): wallflag 旗列大部被 cottage 体量遮蔽**——
  三镜证据(11b/11d/11e-flag-closeup 仰拍撞檐口): 旗列 x42 竖排 y25..28
  在南侧所有合法机位下被 cottage(盒到 z74 高 y31, 北檐悬挑)遮挡 2/3,
  仅 11b 中景露出蓝色段半截。落位不动(数据侧合法+派生蓝色段作为窗间
  点缀), 旗列定位降格为「近观彩蛋」; W-03 主读=窗箱×2+箱堆, 三眼有
  发现分层兑现(远景素墙活化→中景窗箱→近观旗列)。
- 其余件底片: 30-scarecrow(金黄区稻草人+风车山缘同框, 构图完美)/
  40b-clothesline-front(衣绳横梁+蓝衣块与门脸分离)/50b-hencoop-near
  (红冠白身鸡剪影+踏板+店脸同框)/60-spawn-panorama(镇容对照)/
  10-gate-north(南门基线)。
- 走查注意事项兑现: 波次一五件(瀑布/镇徽/花带/记号)派生未实现不显影
  =正常未当回归(10-gate-north 中南门回程件区域仅记号 groundMark 未现)。

### 10.4 arch 钉面补丁底稿(本笔落位撞其数字面, 报 lead 转派 arch)

- test/town-assembly-core.test.js:281 `place 执行见证: 13 实例全落场`:
  `assert.strictEqual(places.length, 13)` → 实得 18(本笔 +5 prefab 实例)。
  建议改法: 数字面 13→18, 措辞「7 建筑+埋室+摊位 6+波次二陈设 5」;
  同测试同文件 palette 完整性行(T-09 十五行)与钉值面本批已自绿(arch
  波次一加过五行), 唯此一处数字面。
- 归属: arch 文件本岗不越权, 底稿如上; 若 lead 裁归本岗补, 一行数字面
  改动随下波带走。

### 10.5 自查行(全仓批+lint 归属)

- 本笔两文件(js/town-map-core.js+test/town-map-core.test.js): 16/16 绿+
  eslint 零错+规划脚本 problems=0(落盘前)+0(落盘后复算)。
- 他线红面清单: arch——assembly place 见证 13≠18(本笔造成, 10.4 底稿)、
  assembly lint 2 错 1 警(quote-props/operator-linebreak, WIP 中间态非
  本笔); light——TIDEA-15 到达时刻卡/TIDEA-16 回望脉冲/TIDEA-19 首访引导
  三测红+spinner-core.js/test lint 红(共享区新 WIP, 文件本笔未触碰);
  共享区 walk-tidea2.mjs 已被 light 覆写为 arrive-card harness(本线走查
  工件已改名 walk-tidea2-scene.mjs 隔离, shots 目录亦隔离 shots-tidea2-scene/)。
- 精确提交面: js/town-map-core.js+test/town-map-core.test.js+
  .scratch/town-design/receipts/scene-closeout.md 三件, 他线 WIP 零接触。

## 十一、尾段笔·风车数据翻转(sailStatic=false 入 spinner 时代; 对表 arch §10.5)

### 11.1 数据与派生连锁(两处数据+两面测试, 实测先行)

- js/town-map-core.js: ①windmill-tower 条目 v={}→{sailStatic:false}
  (叶片组件轴/框/帆整体退场不入格, 旋转 mesh 接管; assembly :352 严格
  判据 ===false 派生 spinner op, 浏览器真数据链 eval 实证 op=spinner)。
  ②lane-farm 北端 z1 46→45(翻转连带): 叶片盒(含 z45 扫掠面)退场后塔体
  foot 收至 z44, 路端帽 (55,46) 与盒 gap=1 不再「贴建筑」, §3 E 断头
  判据触发灯柱红(map-core test :508)——依测试注释设计权威「贴建筑=
  目的地终站, 如 lane-farm 尽头的风车」北延一格贴塔正面恢复终站语义
  (z45 格与旋转叶零冲突: mesh 扫掠最低 y≈28.8 远高于路面 y24; 录入前
  probe 缘石线 x53/x57 列不压塔盒、无 scatter/prefab 撞格)。
- test/town-map-core.test.js :166(自裁面): 体量域 {6..9,[12,14]}→
  {6,6,[11,11]}(prefab-kit 动态档 footOf 实测恰 6×6×11, 锥尖 dy10 兜底;
  测试 footOf 实参含条目 v, 随翻转自动换防)。
- test/adventure-dims-core.test.js :499..505(lead 授权机械同步): 六条
  叶片 pin 翻值: 轴根位 (56,32,43) 76→9(檐层显出, 与 arch 预演 B 同值)、
  (56,32,44/45) 76→0、上/下臂 (55,35,45)/(57,29,45) 6→0、叶框
  (56,35,45) 17→0; :506..510 塔体五 pin 存活不动(基座/塔身/门洞×2/
  小窗全绿)。

### 11.2 arch 测试面同步(第四件, 随步改条款交付披露)

- test/town-assembly-core.test.js 三处: arch §10.5 红清单只列了 dims
  面, 他自己的真实数据链计数 pin 同在翻转半径内, 机械同步并披露:
  ①place 调用面 steps 过滤补同一严格判据 !(s.v&&s.v.sailStatic===false)
  保索引对齐(计数 13→12); ②执行见证 18→17, windmill 见证从 places.find
  换防 ops.find(新 pin op==='spinner', accent 槽见证挂双胞胎 v;
  assembly :350 v 在分支前并入 ids 有据); ③词表封闭 VOCAB 补第六词
  spinner(:319+表头:18; arch 更新了 dims 消费端六词, 自己派生端仍五词,
  本笔真实数据链首次产出 spinner op 顶出来)。

### 11.3 验证与存证

- 定向四件(map-core/dims/assembly/prefab-kit)148/148 绿; 全仓 2119 测
  2116 pass/2 fail, 2 红全归 light 在途 WIP(adventure-mode.test.js
  TIDEA-11 重进计数 1!==2 + conventions 守门点名 adventure.js:3035
  顶层直写), 本笔四文件全仓批内零红; lint 本面零错(自查抓出 map-core
  :156 行长 130 自修), 全仓余 1 错=light 在途 adventure-mode.test.js
  :5170 缩进。
- 存证 shots-tidea2-scene/: windmill-flip-1..3.png(机位 lane-farm 路
  中段 (56,26.8,56) 面北: 塔体静态十字叶消失=翻转显影; 三帧同姿系
  headless 无 pointer lock, main.js :383 locked||touchPlaying 门不喂
  dt 的暂停伪影, 与 fluids 同门)+windmill-probe-before/after.png
  (手喂 SpinnerCore.tickSpinners(0.5) 帆叶跳转约 36 度=旋转路径活证)。
  终审两帧对比归 lead: 交互会话 locked 态即转, 缺省周期 5s(spinner-core
  clampPeriod 缺省=ADR 4-6s 带中点), 条目未带 period 走缺省即可。
- 脚本: windmill-flip-tidea2-scene.mjs(存证 harness: 新鲜度门 sailStatic
  在场校验+派生见证 eval)+windmill-tick-probe-tidea2-scene.mjs(机制
  探针), 均一次性设计工具不入库。

### 11.4 精确提交面(五件, 第四件披露如 11.2)

- js/town-map-core.js+test/town-map-core.test.js+test/adventure-dims-core.test.js
  (lead 字面三件)+test/town-assembly-core.test.js(全仓绿验收强迫, 随步改
  条款先例=place 13→18 补丁底稿)+本回执 §十一(波次一/二惯例回执并入
  同批)。他线 WIP 零接触(light 六文件在途改原样留场)。

## 十三、山体连接攀登票·接缝探勘与裙板方案(PO 亲需; ①② 步, ③ 待 arch §十二)

### 13.1 接缝几何真相(mountain-seam-probe-tidea2.cjs 确定性实测, 建场=复刻
     dims prelude+clearWorld+Dims.townBuild, 工件与输出留档 .scratch/town-design/)

- 鸿沟: z29..31 三列**全空到底**(x48..64 逐列全高 solid=0, 连 y0 都无)。
  镇北缘 z32 草地 y24(id1); 山南脸 z28 起垂直悬崖, 柱顶 y38..44——拱形
  沿 x 变(x54..56 顶 41 / x60..62 顶 42 / x68..70 顶 43..44)、沿 z 恒平
  (z10..28 同 x 同顶), **南脸零自然坡度**(雪 54 盖顶+石 3 身)。
- 现状北行可达性: 1 格跳跃 vs 3 列全空=几何挡死(far-north 整带 z0..31
  reachable:false 语义由虚空执行, 非边界墙); 世界 160×160×48, 山背后
  z0..7 世界缘=虚空(voidFall)。
- 摔落伤害(PO 问④, lead 裁点): **引擎无摔落伤害机制**——伤害常量全是
  怪击侧(ADV_DMG_CAP=10 单击封顶等), 玩家坠落唯一出口=voidFall 事件→
  零惩罚回出生点(adventure.js :5001「与死亡同一零惩罚出口」, mode-kit
  :11 缺省兜底)。儿童安全口径天然达标, 无需裁; 山顶建成后高处跳落也无伤,
  与「镇=安全的地方」一致。
- 山体真身: 镇维度远山=map-core backdrop `mountain-arch`(x16..143 z8..28
  topY44 bands+瀑布 x63..64+崖屋 a/b x56/x103 z22+缘丛石), 派生在
  assembly: 合脊预扫按 **x 单键** max(:137-148)+逐柱 y0 满填(:243)+bands
  三段分色(表苔 14 / 南缘 z27..28 草 1 两行 / 石 3 / 顶雪 54)。

### 13.2 裙板方案(PO ticket ②, 数据提案已备; **派生依赖发现=本节核心**)

- 数据提案: backdrop 增 `mountain-skirt` 条目 {kind:'mountain', x1:16,
  z1:29, x2:143, z2:31, topY:25, bands:true, reachable:true}——拱形顶
  24..25 全带 ≤1 步高衔接镇草 y24; 材质走山体既有分带语言(表苔 14,
  与 z28 草坡行相邻成 草→苔 过渡); 满填自 y0 无浮空。
- **零 assembly 改动的裙板不存在(实测结论)**: 合脊预扫按 x 单键 max,
  第二山条目 z29..31 柱顶会被 max 顶成拱高 y38..44=裙板变全高墙(场景
  错误); 既有 ground/road 派生全 y24 单层, 虚空上=浮空穿帮(map-core
  :218 自己的纪律注)。需派生侧二选一: (a) 合脊预扫键 x→(x,z)(「同列
  重叠域取 max」语义不变, 单条目行为逐字节不变); (b) 新 kind 或逐条目
  顶覆盖。归 arch 派生面(零文件交集红线), 提案随其 §十二契约吸收;
  **map-core 条目不预写**(派生未落地先写=场景坏), 协同波次落。
- 纪律修订登记(lead 收口回执载笔): z29..31 零写入纪律因 PO 明示连接
  废止于裙板路径(全带宽 x16..143); 连带同步面: dims test :700..705
  「空隙带无立地」执行见证随裙板落地翻值(随步改条款); far-north zone
  reachable 翻 true 与 ③ 同波(裙板只达山脚, 山脊可达归攀登契约)。

### 13.3 攀登走廊与雕像点位事实(PO ticket ③ 输入, 供 arch §十二契约)

- 南脸 1:1 阶梯预算: 镇 y24→脊顶 y41..44 ≈ 17..20 级, z28→z10 恰容
  (每级 +1y+1z, ≤1 步高契约可满足, 需派生切崖)。
- 走廊候选(探针 [C] 剖面): 西 x54..56 **撞崖屋 a**(实占 x55..57 z21..23
  y41..47, 探针 [E] 实测); 中 x60..62 净空(顶恒 42, 走廊底草地 y24);
  东 x68..70 净空(顶 43..44); 瀑布 x63..64 柱(y25..39 z24..28 贴面)+水花
  翼 x62/x65(y25..26 z26)——越廊绕行或穿瀑(设计取舍归 arch 契约)。
- 雕像点位候选: 山肩 x61 一带顶面(y42, z12..20 平顶直行可达)、南向注视
  镇景(广场 z66+ 视线直达, 山体本就是镇南望北背景); 备选崖屋间鞍部。
  iron-golem-head 蓝图+落位契约(prefab id/footOf/palette 行)待 arch
  §十二; 连带预告: 雕像若入 prefab 清单, 其足印在 far-north(z<32)出
  core, map-core test 「盒 ⊆ 核心区」断言需山域豁免(本岗文件面, 随 ③)。
- ③ 走查取证(山脚无鸿沟/步道可攀至顶/雕像入画)待契约落地后按本节
  走廊事实执行。

### 13.4 本步交付面

- 零代码零数据落盘(探勘步+裙板提案步的诚实形态: 派生依赖未决不预写);
  工件: mountain-seam-probe-tidea2.cjs+mountain-seam-probe-out8.txt
  (确定性可复跑); 本节回执。翻转笔已先行收官入库 67a7634(§十一)。

## 十三·五 山体数据波落位批(lead 派单七条全执行; arch §十二契约兑现)

### 13.5.1 交付物(map-core 数据四处)

- mountain-arch 条目 +`southCorridor:{x1:60,x2:61}`+`reachable:false→true`
  (其余键零动, waterfall 域原样; §12.1① 逐字)。
- +mountain-skirt 条目 `{x1:16,z1:29,x2:143,z2:31,topY:25,bands:true,
  reachable:true}`(§12.1② 逐字, lead 确认零映射差)。
- prefab 表尾 +iron-golem-head `{x:65,y:41,z:16,v:{},face:'south',
  zone:'far-north'}`+落位几何依据注释(见 13.5.2)。
- far-north zone `reachable:false→true`(+注释: 随走廊+裙板落位北带转可达,
  消费方语义预留)。

### 13.5.2 落位几何解算(雕像 x65/y41/z16; lead 口头 x61 的修正与授权)

- **x=65 非 x61**: 走廊切列 x60..61 的 trench 顶在雕像盒窗 z13..20 达
  39..28(h(z)=24+(28−z) 递减), x61 锚(盒 x58..64)必跨切列→基座悬空
  2..13 格=违反崖体无悬空; x65 锚(盒 x62..68)与切列净隔 1 列(x61 列
  与 x62 盒缘相邻不重叠)。落位权限 lead 已授(布局清单权限归本岗)。
- **y=41 下埋 2 格是硬约束**: WORLD_H=48 合法域 0..47, 7 高件 y=42 起
  顶 y48 出界——契约「1-2 格」容差被世界高锁死为 2; dy0 基座 7×7 石头
  3 插桩面全埋入山肩(顶 42>41)不显影=坠感防护本意。
- **z=16**: 盒 z13..20 ⊆ lead 点位窗 z12..20; face south 鼻面齐平 z20
  南向注视镇景。西岸 x56 方案否决: face 距崖屋 a(x55..57 z21..23)背仅
  1 格视线挡死; 瀑布 x63..64 z24..28 无 z 交不冲突。
- 「走廊北端出口 z10..12 出来直行即达」叙事让位几何: 攀者出 trench 后
  雕像在东邻位(x62 起步入盒), 披露此项松动。

### 13.5.3 翻红清单实际执行(随步改条款; lead ⑦ 判「无」之外的数据侧连带)

lead ⑦ 判定的是 arch 派生面(缺省零变化)——正确; 本批数据落位翻红的
**测试断言面**按随步改条款机械同步, 全披露:

- test/town-map-core.test.js 九处:
  ① 实例词表十三→十四种(+iron-golem-head);
  ② FOOTPRINT +`{min:7,max:8,y:[7,7]}`(footOf 实测: 颅盒 7×7+鼻 dz+4);
  ③ 脚印「盒⊆核心区」+far-north 山域豁免(§13.3 预告兑现);
  ④ 「实例 y=地面基高」+「锚点⊆核心区」同款豁免(锚 y41=山肩面);
  ⑤ 门前可达豁免 +far-north(可达性由攀登走廊承担不辖路网);
  ⑥ 「远景层不可达」翻 true+消息更新(§13.1 实测翻案的执行);
  ⑦ 「拱形山体恰一处」1→2(主山+裙板, z 域不重叠断言+skirt.z1=arch.z2+1);
  ⑧ 新增「山体波数据契约」test: 三 deepStrictEqual 全键 pin(arch/skirt/
    golem 位姿)+footOf 盒避走廊切列+世界高界内+far-north 翻旗;
    **vm 对象 JSON 归化后比对**(deepStrictEqual 比原型, 跨 realm 必红;
    probe 同款手法, prefab-kit.test.js 先例)。
  ⑨ 定向 17/17 绿。
- test/town-assembly-core.test.js 四处:
  ① 「place op 数=实例数」12→13(+golem);
  ② 「place 执行见证」17→18 实例+分解+雕像(§12.3.6 预告的本批 pin);
  ③ 「southCorridor 缺省零变化」见证**翻转为激活见证**(原断言前提=
    map-core 未落键, 已兑现即翻: 拆线笔 122=两列各 61+南端苔顶笔
    y24+北端雪顶笔 y40..42; corridor-ops-probe-tidea2.cjs 实测);
  ④ 「拱形山体逐柱满覆盖」xs 豁免走廊两列(柱笔被 carve 拆 z 单线笔,
    由激活见证另钉); 「通廊与不可达 op 层」空隙带见证翻转(裙板域
    x16..143 山体笔合法, 域外两缘 x0..15/x144..159 体块零写入不变)。
  定向与 dims 合跑 21/21 绿。
- test/adventure-dims-core.test.js 两处:
  「通廊与不可达(世界层)」空隙带断言翻新——全域零方块→两缘零方块
  (x0..15/x144..159)+裙板分段色 pin 七笔(中带拱顶 25 苔/基段石顶 23/
  端点顶 24/走廊口 z28 苔 14 平接镇草/北端 z10 雪 54 接山肩)。
  **分段色取值=mountain-seam-probe-tidea2.cjs 复跑实测, 勿按契约文字猜**
  (纪律兑现; 首拍两处猜值被 test actual 纠偏: 裙板石段顶 23 非 24、
  角外点 (31,24,31) 已被裙板苔覆盖改用 (31,26,31) 零基底)。

### 13.5.4 走查四证(walk-mountain-tidea2-scene.mjs → shots-mountain-tidea2/)

- mtn1-foot-corridor: 山脚仰拍——走廊口 x60..61 阶梯自裙板平接面直上,
  瀑布白柱右邻入画, 脚下苔顶连续无鸿沟(PO 亲需① 执行见证)。
- mtn2d-shoulder-town: 山肩回望——雕像颅 3/4 视角(顶后角苔+顶心苔)+
  走廊全阶俯瞰+崖屋 A 红顶+走廊缝尽头镇缘绿(山顶回望全镇+可攀至顶)。
- mtn3b-plaza-golem-far: 广场 z66 远读全景——山体雪脊+两崖屋+瀑布白线
  +走廊 V 形凹槽可见; **雕像轮廓远读披露**: swiftshader 平光+42 格距下
  颅顶露棱线段弱(数据在场=getBlock 八点全中: 颅 17/鼻 17/眼 12×2/
  苔 14/基座 3; 露头几何=颅顶 47>山棱 43 约 4 格), 真机方向光阴影下
  轮廓可辨度更好——arch §12.1③ 的「远读可辨」验收建议以 mtn5 特写+
  mtn2d 中景为执行口径, 远读弱对比登记为渲染光照限制非数据缺陷。
- mtn5-golem-face-closeup: 山肩平台面部特写(4 格正脸)——7 宽颅+双眼
  铁灰 12 对称+凸鼻柱+双颊苔 14 全要素入画(§12.1③ 验收主证)。
- 诊断工件: diag-mountain-tidea2.mjs(getBlock 八点采样+8 方位环拍——
  第一轮误判「雕像未显影」实为 diag 漏切第一人称玩家挡镜+远读平光弱;
  数据/渲染双在场后定位到构图问题, 终轮三张定稿)。

### 13.5.5 验证面与纪律

- 定向三件(town-map-core/assembly/dims): 65/65 绿。
- 全仓 npm test(tap 口径): **2122 tests / 2121 pass / 0 fail**(skip 1 为
  既有 todo); lint(eslint+stylelint+htmlhint) 零错(纯缩进 12 错 --fix 收)。
- town-ui-core.test.js:385(light 返工尾笔)本批跑绿——22660a6 已收官,
  无跨线红面。
- 环境 traps 新沉淀: ① PowerShell `>` 重定向=UTF-16, node 读必炸——
  一律 `cmd /c` 重定向; ② CDP 走查 pos.set 后相机物理不回拉(headless
  无 dt), 机位构图以照片内容为准非坐标回读; ③ 服务 8091 被旧会话占用
  时静态现读仍新鲜(curl 验落位字段), 但「蓝图行在≠落位数据在」, 验
  新鲜度要 grep 未提交字段。

### 13.5.6 待 lead 收口

- §13.2 纪律修订(z29..31 零写入废止于裙板/far-north 旗翻)仍挂账, 本批
  执行即其兑现面, 收口回执载笔时请并卷。
- far-north reachable 旗与 southCorridor/skirt 两键均为语义预留(现无
  消费方), 后续玩法接线(攀登触发/导览锚)归下波需求。

