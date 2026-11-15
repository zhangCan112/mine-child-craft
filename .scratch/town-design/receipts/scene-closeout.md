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

