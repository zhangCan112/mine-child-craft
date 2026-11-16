# 架构方案 · ②镇侧对称门楼 + ③边缘防坠墙圈（含 U4 保护判据）

> 产出：arch 岗 · 2026-11-16
> 输入：设计定稿 `docs/design/town-side-gate-and-edge-fence-spec.md`（218 行，PASS 把关，
> 把关记录 `.scratch/town-east-boundary/gate-review-town-side.md` 标尺 10 项+注记 N4/N5/N6）
> 侦察基线：worktree `town-boundary` @ **aa2d7c8**（见 §6 基线更新——派令所写 c7eef99 已前移）
> 代码事实均实读核对：town-map-core.js / town-assembly-core.js / prefab-kit.js /
> mesh-core.js / adventure-core.js / adventure-dims-core.js / modes/adventure.js /
> test/town-map-core.test.js / test/adventure-dims-core.test.js / index.html 加载序。
> 本岗只出方案不动代码；调度岗按 §4 票图建票排期。

---

## 0. 侦察结论先行（三条改变决策的事实）

1. **基线已前移**：worktree HEAD = `aa2d7c8`（设计定稿+把关记录已入库），且 **F6 已在
   `365fb36` 并入 town-boundary trunk**（`merge: F6 观感返工并入(G1 主径石板化门墩门槛石化,
   评审双轴零修复项)`）。派令中「F6 在 f6-g1-stone @ 8ad2337 评审中未并入、spec v2 文档面
   可能小冲突」的预判**已过时**——②③直接基于 aa2d7c8 施工，与 F6 的合并冲突预判消解
   （详见 §6）。
2. **门额牌图案面在 mesh 层硬编码西面**：`pushGateSign`（js/mesh-core.js:218-241）几何=
   竖板贴格**西缘**（x∈[x,x+thin]），`faceTile = [side, back, bottom, top, back, back]`
   ——**f=0 西面=镇徽图案，其余五面木底**。home 东带门楼牌面朝西恰好成立（advEdgeEastSign
   双牌 (156,yb+5,74)/(156,yb+5,75)，东西邻 x155/x157 在 yb+5 全空）。镇侧门楼需牌面朝北
   （spec §2.2 裁定），**不能靠放置路径解决**（方块表无 per-instance 朝向元数据）——N6 的
   实质=渲染路径泛化，方案见 §1.3。
3. **守门测试有三处 `⊆ core` 判据 + 若干会误伤门楼的断言**：test/town-map-core.test.js
   ⑤脚印⊆核心区（:200-202）/⑧地表条目⊆核心区（:317-319）/⑩散布点⊆核心区（:593-595）；
   另外 ④实例映射「恰十四种」deepStrictEqual（:119-123）、⑤「锚点⊆核心区」（:154-156）与
   「脚印⊆标注分区」（:206-207）、⑦「门前可达 ≤4 格」（:287-289，门楼距 main-south 空隙
   9 格）都会因 town-gate 行变红。**白名单常量必须一次立全**（§2），且判据面改动集中一张
   先行票（§4 T0），否则 T1/T2 并行时测试文件互撞。

---

## 1. 双路径裁决

### 1.1 ②镇侧门楼：走 prefab-kit 新行 `'town-gate'`（路径 A）

**裁决：prefab-kit 蓝图路径**（TOWN_MAP.prefab 行 + prefab-kit `'town-gate'` 行 +
TOWN_PALETTE.prefab 材质行）。spec §2.6 的替代路径（town-map-core 新 ground kind
'gate-foundation' + assembly 派生 ~60 格逐笔）**不采**。

理由（按仓库惯例与测试可测性）：

1. **件库语义正**：门楼是素坯建筑件，与 cottage-gable/stall-canopy 同性质。prefab-kit
   头部自述「具名建筑蓝图的几何单一权威」，在册 15 行全是玩法建筑件——加行是既有惯例，
   无「引擎层知道玩法」问题（引擎层在此仓的语义=通用几何件库，非渲染引擎；GLOSSARY
   引擎件库词条在册）。反向：ground 段语义=「地表分类」（plaza/farm-rows/wayshrine 全是
   y=groundY 平面铺装），9 层高建筑落 ground 段是语义错位。
2. **写序零改动**：townBuildSteps 的 phase 全序（ground→backdrop→road→wayshrine 加冠→
   **prefab**→scatter→anchor）天然把桥/门楼写在基底、路网之后（后写者赢）；op 词表封闭
   {fill,tree,scrub,recolor,place,spinner} 不扩；townConsumeOp 的 place case 现成。
3. **测试可测性**：TOWN_MAP.prefab 行自动进入现有四组断言（④映射/⑤脚印合法+体量域/⑥
   两两无交/⑦不压路）——footOf 是现成的「零写纯查询校验器」，白名单判据挂在现有断言组上
   改一行检定式即可。替代路径下门楼是 ground 条目，footOf 不适用，体量域/无交/可达四组
   断言要另立平行断言组，测试面反而更厚。
4. **kernel 直排先例充分**：TIDEA 小件（clothesline :1420-1429 / woodpile :1453-1458）已
   是「局部系逐格 put 直排」形态，门楼 ~60 格 kernel 同构；基座桥垫层（y20..24）与
   piles:'slab' 语义在 kernel 内直排（spec §2.6 已留此裁量）。门额牌格 kernel 内
   `put(…, 80)` 即可（见 1.3：渲染接线与放置路径无关）。
5. **材质注入面现成**：TOWN_PALETTE.prefab 加 `'town-gate'` 行（base 13 石砖/lamp 19
   灯/cap 17 石英/roof 79 陶瓦/sign 80 牌——槽名施工票自定），缺映射 townAssemblyOps
   :417-419 会 throw，拼写域保护现成。
6. **face 语义**：行 `facing0: 'north'`（正面朝北=牌面朝向），TOWN_MAP 行 face:'north'
   恒等序 0（pfOrient 恒等路径=直写代码同构，prefab-kit.js:29-31 结构保证）。spec §2.6
   候选行 `{id:'town-gate', x:76, y:24, z:128, v:{}, face:'north', zone:'south'}` 照采。

### 1.2 ③防坠墙圈：走 ground 新 kind `'town-rim'`（map-core 数据 + assembly 派生）

**裁决：TOWN_MAP.ground 新清单段 kind `'town-rim'`**（域=显式分段列表）+
townAssemblyOps 新派生分支。spec §3.3 给的两个候选（ground kind vs backdrop 段条目）中
**选 ground**，理由：

1. **backdrop 语义错位**：backdrop=「远景剪影」mountain/cliff-home/scrub/boulder，且
   ⑨ 断言「远景不可达（山体波两山件例外）」——墙圈是可达域边缘的**功能件**（防坠），
   落 backdrop 会撞 reachable 语义断言且语义反了。
2. **ground 段已有「边界域」先例**：wayshrine 断头小坪就是「路网边界服务件」落 ground；
   墙圈=镇界服务件，同族。写序上 ground 段早于 road/prefab——墙圈在 core 界外
   （z128 行/x31/x128 列），与 road（max z118）/prefab（core 内）**零写序交叠**，不需要
   wayshrine 式加冠。
3. **保护判据同源**（U4 关键）：墙圈几何若在 TOWN_MAP.ground 条目里，`townProtectedAt`
   判据函数读同一份条目即天然满足 home 先例的「同源原则」（方案 R3：判据与建场同一坐标
   式，不抄第二份几何——adventure-core.js:1860-1870 注释段）。

**数据形态**（TOWN_MAP.ground 新条目，几何权威单源在数据、派生只翻译）：

```js
{id: 'town-rim', kind: 'town-rim',
  segs: [
    /* 墙基垫层 */ {x1,z1,x2,z2, part:'pad', y: groundY},        /* y24 单层 13 */
    /* 墙身 */     {…, part:'wall', y1: 25, y2: 26},             /* 2 格 13, 南段两截避开 x76..80 */
    /* 北端接头柱/南角柱帽/裙板翼墙/端头墩 */ {…, part:'post'|'cap'|'wing'|'pier', …},
  ]}
```

assembly 派生分支按 part 逐段出 fill（全常量坐标零盐零随机；墙头花=派生内
⌊(x+z)/8⌋ 奇偶交替 61/62，纯算术非掷点，不违「本件不掷点」红线，也不入 scatter——
scatter 点有 ⊆core 断言会红）。南缘墙身分 x32..75 与 x81..127 两段（中央 x76..80=门楼
开口），东/西缘墙 z32..128（闭南角），垫层同段登记。合法域枚举
`plaza|farm|farm-rows|wayshrine` 扩 `|town-rim`（拼写域 throw 改一行）。

### 1.3 N6 接线路径：两路径下等价，独立成 T1b（mesh 泛化，pushPane 朝向现算同构）

**关键认知：N6 与双路径裁决无关**。门额牌无论走 place op（prefab 路径）还是 fill op
（assembly 路径），落世界都是「一格 id 80」；渲染时 mesh-core 按 `b.gateSign` 旗标走
pushGateSign（mesh-core.js:468-474）——**渲染只看方块 id + 邻接，不知道 prefab 存在**。
所以 N6 的接线面固定在 mesh-core，不构成路径差异因素。

**方案：邻接现算泛化（推荐）**——pushTorch 的 lean 现算（mesh-core.js:457-463）与
pushPane 的门朝向现算（:296-309）双先例同构，「零存储」：

- 调用点（:468-473）在 pushGateSign 前用 lget 现算牌格**东西邻**（x±1）是否 solid
  （solid!==false 判据同 pushPane）；
- 东西邻实心 → 板贴**北缘**横跨 x（z∈[z,z+thin]）、faceTile 图案位从 f=0（西）挪
  f=4（北）；东西邻空 → **恒等现状**（贴西缘、图案面朝西，逐字节不变）；
- 自洽性核验（实读钉死）：home 双牌 (156,yb+5,74/75) 东西邻 x155/x157 在 yb+5 全空
  → 恒等分支，home 渲染零字节变化；镇侧单牌 (78,29,129) 东西邻 x77/x79=门额配块
  石砖 y29 实心 → 北向分支 ✓。判据只看 x± 不看 z±，两门楼无歧义；未来贴东西向墙的
  牌自动拿北向，几何泛化无玩法语义，**引擎层不知道玩法纪律保持**（mesh-core 只认
  「墙沿轴向→图案面朝开阔向」的纯几何规则）；
- config.js（B_GATE_SIGN 旗标不变）与 texture-atlas.js（T_GATE_SIGN 复用）**零改动**。

**UV 细节**：FACES 标准盒面映射保证「法线朝外看纹理不镜像」，北面同 tile 映射从北看
与西面从西看同读法；走查验收项含「镇徽图案不镜像、塔尖朝上」（T1b 票面）。

**fallback（N6 既定，超预算时）**：石英白底+嵌灯（v2 §2 S2 fallback 同款，纯方块写入
零渲染改动），**降级须经 design-lead**（把关注记 N6 原文）。

**T1b 独立拆票依据**：mesh-core.js + test/mesh-core.test.js 与 T1a 几何面
（prefab-kit/town-map-core/town-assembly-core）**零文件交叉**；泛化对 home 双牌恒等，
可独立先行独立测试（假邻接夹具），不阻塞 T1a 红绿。T1a 走查验收「牌面朝北」时 T1b
必须已落地——软依赖，走查排 T1b 之后即可。

---

## 2. 白名单判据方案（N5 兑现）

### 2.1 落点与形态

**TOWN_MAP 顶层新常量段 `beyond`**（与 core/plaza 同级的显式越界域清单，
town-map-core.js 单一权威）：

```js
/* core 外显式合法域(白名单, 布局守门判据「⊆ core ∪ beyond」的 beyond 单源):
   每段=一件越界件的声明域, 加段须先过判据(ADR-0013): 缓冲带服务面/
   回程判据服务面/防坠功能件——不是「写越界的通行证」。 */
beyond: [
  {id: 'gate-south', x1: 75, z1: 128, x2: 81, z2: 131},  /* ②门楼+基座桥域(含檐口出挑 x75/x81) */
  {id: 'rim-south',  x1: 32, z1: 128, x2: 127, z2: 128}, /* ③南缘墙线 z128 行(墙身+垫层, 开口段含于域) */
  {id: 'rim-west',   x1: 31, z1: 32, x2: 31, z2: 128},   /* 西缘墙线(含北端接头柱 z32..33 与南角) */
  {id: 'rim-east',   x1: 128, z1: 32, x2: 128, z2: 128}, /* 东缘墙线(同上) */
  {id: 'rim-skirt',  x1: 16, z1: 29, x2: 143, z2: 31},   /* 裙板翼墙+端头墩域(实际写入仅翼段) */
]
```

（段的切分与坐标施工票按 spec §3.3 终稿微调，**形态与落点为定案**：TOWN_MAP 顶层段、
每越界件一段、显式闭域矩形。镇侧门楼 zone 归属 'south' 维持 spec §2.6——不新开 zone，
理由见 2.3。）

### 2.2 守门测试判据改动面（集中 T0 票）

| 断言 | 现状 | 改动 |
|---|---|---|
| ⑤脚印 ⊆ 核心区（:200-202） | `zone==='far-north' \|\| ⊆core` | 扩为 `far-north \|\| ⊆core \|\| ⊆∪beyond`（helper `inCoreOrBeyond(box)` 单份，测试文件内） |
| ⑤锚点 ⊆ 核心区（:154-156） | `zone==='far-north' \|\| 锚⊆core` | 同上扩 beyond |
| ⑤脚印 ⊆ 标注分区（:206-207） | 全件硬断言 | town-gate 注记豁免（锚 z128 在 south 带 z2=127 外 1 格=南缓冲带服务面，beyond 注释同源；不新开 zone 不动「六带」设计权威 map-design §4.1） |
| ⑦门前可达 ≤4 格（:287-289） | 非 hub/far-north/PROPS 全辖 | town-gate 入豁免名单（GATE 注记：出镇门楼=动线终点仪式件，可达性由 main-south 轴线 x76..80 直连承担，路口距离断言不适用——spec §2.7 已预此注记） |
| ⑧地表条目 ⊆ 核心区（:317-319） | 全条目硬断言 | 扩 `kind==='town-rim' → ⊆∪beyond(seg 域)`（town-rim 条目主域含 segs，逐 seg 判） |
| ⑩散布点 ⊆ 核心区 | 全点硬断言 | **不扩**——墙头花走 town-rim 派生不入 scatter，镇域散布维持不越界 |
| ④实例映射恰十四种（:119-123） | deepStrictEqual | T1 票改十五种（+town-gate）；与 T0 解耦（T0 落地时 town-gate 行未加不红） |
| beyond 自检 | 无 | 新增：beyond 各段 ⊆ 世界界；beyond 与 core 交集逐段非空（贴界越界，防「域飞出」）；beyond 段与消费方互证（gate-south ⊇ town-gate 脚印、rim-* ⊇ town-rim 各 seg——几何第二份防御） |

### 2.3 语义边界（「core ∪ beyond」的纪律边界）

- **beyond 不是通行证**：每段必须对应一件「有正当语义的越界件」（回程判据服务面/防坠
  功能件），且段域=该件外接盒（**含**其全部几何：门楼含檐口出挑 x75/x81、桥 z128..131）。
  判据收录进 ADR-0013（§5），后续加段须过同判据。
- **开放通道不设白名单**：wayshrine/路网/散布/锚点维持 ⊆core 严判（本批只开⑤⑧两组+
  两处注记豁免）；墙头花不入 scatter 即此纪律的体现。
- **与 far-north 豁免的关系**：far-north（山域件整带豁免）与 beyond（显式域豁免）并存，
  far-north 是 zone 语义豁免、beyond 是域豁免，互不吞并；测试 helper 两个分支分开写。
- **zone 不动**：不新开 'gate-south' zone——south 带 z94..127 是「南彩蛋带」设计权威
  （回程判据注释「南彩蛋带整段在线北零误触」引用此域），扩带或加带都动设计权威面；
  town-gate zone:'south' + 分区断言注记豁免（锚=南带界外服务面自然延伸）是最小改动。

---

## 3. U4 保护判据接线方案（镇域第一例）

### 3.1 落点：`townProtectedAt(x, y, z)` 纯函数，落 town-map-core.js

- **复用 home 域 advEdgeProtectedAt 模式**（adventure-core.js:1872-1921「坐标+件纯函数」
  选型 P2：零状态/零 THREE/DOM/随机/建场改动），**不新发明形态**；但不塞进
  adventure-core（那是 home 域文件，且 index.html 加载序 adventure-core 在 town-map-core
  **之前**——文件语义与装载语义都错位）。
- **同源原则**（home 先例方案 R3 原文「判据直接调用建场权威/同一坐标式，不抄几何第二份」）：
  townProtectedAt 读 TOWN_MAP.ground 的 town-rim segs + prefab 的 town-gate 脚印盒
  （PrefabKit.footOf 调用期解析——town-map-core 头注已声明「脚印合法性由测试侧以
  PrefabKit.footOf 校验」，判据侧同款调用形态；或判据只吃 beyond 域+part 派生式，
  施工票按实现自裁，**几何第二份禁止**是红线）。
- 可测性声明现成：town-map-core 纯核心零依赖，同名单测扩断言组；module.exports 扩出口
  （:509-511 惯例）供 Node 测试装载。

### 3.2 与现有 protection 面的关系（消费缝三处）

挖掘/放置/TNT 三缝现状与镇域接线（modes/adventure.js）：

| 缝 | 现状 | 镇域接线 |
|---|---|---|
| 挖掘话术 `advMineHardText`（:3188-3211） | typeof 守卫调 advEdgeProtectedAt，命中后**按方位分话术**（z≤31 北雪/z≥128 南沙丘/x≤31 西雾塘/else 东栅栏） | **缝前插镇判据**：`typeof townProtectedAt==='function' && townProtectedAt(x,y,z)` 命中 → 镇域话术（**必须先于 home 方位分支**——镇墙圈 z≥128/x≤31 坐标带与 home 方位阈值重叠，不插前会误中「沙丘/雾塘」话术语义错位）；话术文案骨架归 design-lead 定稿（票面留缝，参照 home「挖不动」同族儿童口径） |
| 放置替换守卫（placeGuard 注入缝，:4181 注释「场景门与 placeGuard 同款」） | typeof 守卫调 advEdgeProtectedAt | 同款扩镇判据（先问镇再问 home，或并列 OR——镇/ home 判据坐标域不相交，OR 即可；施工票逐缝核对 place-kit 注入点） |
| TNT 豁免 `advEdgeTntProtected`（:4185-4188） | 维度门 `advDim!=='overworld' \|\| advMap!=='home'` → false | 对称扩：`advMap==='town'` 时改调 townProtectedAt（镇维度 TNT 掀墙圈同属绕过守卫口，R10 同族；维度门形态照抄） |

纯坐标判据在镇维度命中前提=镇建场后那些格有方块（清场重建，判据命中的空格无准星目标），
与 home 现状同构，无新增风险。

### 3.3 在保域拍板建议（首例定规，票面过 PO/design-lead 知情）

home 先例参照：矮墙全高在保、门框柱全高在保、**墙头花/端帽层不在保**（:1893-1894「花/
端帽层 y0+2 不在保，N2 带内可挖可放维持」）。镇侧对称+功能补强：

| 部位 | 建议在保 | 理由 |
|---|---|---|
| 墙身 y25..26 | **在保** | U6 闭销要求（开口两侧墙被挖穿=绕开门楼侧向触发回程）；防坠本体 |
| 墙基垫层 y24 | **在保** | 墙的地基同件同源；挖垫层=墙浮空穿帮+钻缝 |
| 北端接头柱 y25..27 | **全高在保** | 防登墙功能件——挖顶格 y27=y27 级可登，防坠失效（home 无此对应件，按功能语义定） |
| 南角柱帽 y27 | 不在保 | 纯装饰顶格，home「端帽不保」先例对称；挖帽不破防坠（墙身 y25..26 在保） |
| 墙头花 y27 | 不在保 | home「花不保」先例对称（N2 口径维持） |
| 门楼 town-gate 脚印盒 | **全盒在保**（门洞净空格除外） | home 门楼 x156 全列在保先例（:1914-1918：柱列/门额带/檐角列分段在保）；镇侧更简=footOf 盒 y25..33 在保+桥 y20..24 在保，**门洞净空 x77..79×y25..27×z129 排除**（穿行契约，建场同式禁填） |

### 3.4 测试面

- test/town-map-core.test.js 新增断言组：townProtectedAt 在保域采样（墙身/垫层/接头柱/
  门楼柱牌檐瓦/桥身 ===true）＋不在保采样（门洞净空/core 内草地/柱帽/墙头花格/y 域外
  ===false）＋**同源互证**（在保格 ⊆ 建场写入域——两次建场 worldCells 对拍或 seg 域
  复算）。
- 集成面（adventure-dims-core.test.js）：镇建场逐块断言天然覆盖「判据命中的格有实块」。
- 行为缝单测：advMineHardText 镇命中话术分支（话术骨架定稿后）；TNT/放置缝的镇维度门。

---

## 4. 票图拆解

> 与 spec §6（T1..T4）的映射：T0=spec §2.7 判型首项独立成票（T1「首项」抽出）；
> T1=T1a+T1b（N6 渲染独立）；T2b=spec §6「U4 若 PO 裁通过则 T2 扩保护判据子票」兑现
> （PO 已裁）；T3/T4 同名。

```
T0(beyond 判据先行) ──┬── T1a(门楼蓝图几何) ──┬── T3(TIDEA-06 退役)
                      │    └ T1b(mesh 朝向泛化) │      （依赖 T1a）
                      └── T2(墙圈 town-rim) ────┴── T2b(U4 保护判据)
                                                   （依赖 T1a+T2）
T4(文档收口) —— 最后收口（依赖全部）
```

### T0 · beyond 白名单判据先行（判据面）

- **文件面**：js/town-map-core.js（beyond 常量段，**全量五段一次立全**）；test/
  town-map-core.test.js（⑤⑧两组判据扩 beyond+锚点断言+beyond 自检组；helper
  inCoreOrBeyond 单份）。
- **模块边界**：纯数据段+测试判据面；不动 town-assembly/prefab-kit；几何未落时 beyond
  段空转（消费方未上不红——自检组「beyond 与消费方互证」随 T1a/T2 各自补全互证断言）。
- **验收**：npm test+lint 绿；beyond 五段在册且 ⊆ 世界界、贴界越界；ADR-0013 草案随票
  （§5）。
- **为什么先行**：T1a/T2 都要动 town-map-core.js 与 town-map-core.test.js，beyond 段
  与判据面不先钉，两票并行必撞测试文件。

### T1a · 镇侧门楼几何（prefab 路径）

- **文件面**：js/prefab-kit.js（'town-gate' 行：facing0 'north'/defaults ids 槽/kernel
  直排 ~60 格含基座桥垫层/foot 模板）；js/town-map-core.js（prefab 行 {id:'town-gate',
  x:76,y:24,z:128,v:{},face:'north',zone:'south'}）；js/town-assembly-core.js
  （TOWN_PALETTE.prefab['town-gate'] 材质行）；test/prefab-kit.test.js（行断言：foot/
  逐格/门洞净空禁填/越界守卫）；test/town-map-core.test.js（④十五种+⑤体量域 FOOTPRINT
  行+⑥无交+⑦豁免+门楼专项：z129 墙身平面/净空 x77..79×y25..27/桥面 y24 与 core 草地
  同高/牌格 (78,29,129)===80）；test/adventure-dims-core.test.js（建场逐块断言组，spec
  §2.7 锚 3：柱/壁灯/牌/檐/瓦/桥面）；test/town-assembly-core.test.js（palette 行）。
- **验收**（含 spec §2.7 联动+§6 T1 行）：npm test+lint 绿；走查四拍时序（预告 z126→
  见门→穿门 z129→白闪 z132）/牌面朝北（需 T1b 落地，否则走 fallback 或排后）/壁灯夜观/
  桥面无缝/背面素面/N4 注记（门洞 3 格差异留走查终审通道）。
- **回程判据零触碰核对**：几何 z≤131 全在判据内侧；ADV_TOWN_RETURN_Z/advTownReturnTick
  相关零改动（票面显式断言「判据行为面零改动」）。

### T1b · S2 门额牌朝向泛化（mesh 渲染，N6）

- **文件面**：js/mesh-core.js（pushGateSign 轴向参数化+调用点 :468-473 东西邻现算，
  pushTorch lean 同构）；test/mesh-core.test.js（先查既有渲染测试锚——本仓 mesh 测试
  在 mesh-core.test.js/world-vertexlight.test.js，红测先行）。
- **模块边界**：纯几何泛化（墙沿轴向→图案面朝开阔向），零玩法语义，零 config/
  texture-atlas 改动。
- **验收**：home 双牌渲染逐字节恒等（恒等分支断言）；镇侧牌北向、图案不镜像塔尖朝上
  （夹具：东西邻 solid）；fallback 通道在票（超预算→石英+嵌灯，**须经 design-lead**）。

### T2 · 防坠墙圈（town-rim 派生）

- **文件面**：js/town-map-core.js（ground 段 town-rim 条目：segs 显式分段清单——垫层/
  墙身两截/东西缘墙/北端接头柱/南角柱帽/裙板翼墙/端头墩）；js/town-assembly-core.js
  （town-rim 派生分支+合法域枚举扩+墙头花奇偶派生）；test/town-map-core.test.js（⑧
  town-rim 域判据+专项：开口段 x76..80 无墙/闭南角 (31,128)(128,128)/接头柱 3 格无帽/
  rim 走道 z29..30 保留+翼墙封口/散布零连累）；test/town-assembly-core.test.js（派生
  逐段 fill 断言：段数/材质/奇偶花色/全常量零盐）；test/adventure-dims-core.test.js
  （逐块+体量 ~965 格核对）。
- **验收**（spec §6 T2 行）：四缘墙线完整含垫层无缝/门楼开口衔接（**联验注记：与 T1a
  都落地后走查「墙线接门楼两翼 (75,128)(81,128) 戗柱合角」**）/裙板端头墩+翼墙合角/
  rim 走道畅行且南缘封口/墙头花节奏（开口段跳空、相邻簇异色）/登北山不受阻/自裙板
  不得登墙脊（接头柱 y28 级 2 跳不可达复算）。

### T2b · U4 镇域保护判据（行为面）

- **文件面**：js/town-map-core.js（townProtectedAt 纯函数+module.exports 扩）；
  js/modes/adventure.js（挖掘/放置/TNT 三缝扩——§3.2 表）；test/town-map-core.test.js
  （§3.4 断言组）；test/adventure-mode.test.js 或 adventure-core.test.js（话术/TNT 缝
  单测，按既有测试归属裁）。
- **依赖**：T1a+T2 几何落地（判据吃几何数据）；**不依赖 T1b**。
- **验收**：墙身/垫层/接头柱/门楼全盒在保（净空除外）；柱帽/墙头花不在保；镇域命中
  出镇域话术（不误中 home「沙丘/雾塘」）；TNT/放置同守；话术文案 design-lead 定稿；
  ADR-0014 随票（§5）。

### T3 · TIDEA-06 吞并退役

- **文件面**：js/town-map-core.js（scatter 段删 signpost-home 行 :291-298）；test/
  town-map-core.test.js（⑪b ②段断言改「已退役不在册」+lamp-end-south 保留断言维持
  :710-711）；test/adventure-dims-core.test.js（逐块断言删 signpost 两块，若有）。
- **依赖**：T1a（门楼建成才拆旧件——spec §6 原文）。
- **验收**：门楼前无冗余件/lamp-end-south 照明在；留档备选（迁 (75,124)）不做、走查
  触发再裁（spec §2.5）；沿革注记=ADR-0011 决策 6c 预授权路径升格兑现（不落新 ADR，
  见 §5）。

### T4 · 文档收口

- **文件面**：docs/design/town-side-gate-and-edge-fence-spec.md（索引/状态行更新）；
  docs/design/town-prefab-specs.md（town-gate 蓝图规格沿革登记+signpost-home 退役
  批注）；GLOSSARY.md（town-map-core 词条 interface 补 beyond 段+townProtectedAt
  出口；prefab-kit 词条十五行计数更新——**只改计数与 interface 描述，不改词条结构**）；
  docs/adr/0013、0014 终稿（若未随各自票落）。
- **依赖**：全部落地后收口。

### 并行面与交叠手裁点（调度排期要点）

- **可并行**：T0 后 T1a ∥ T2 ∥ T1b 三线（文件面：T1a∩T2=town-map-core.js+town-
  assembly-core.js+town-map-core.test.js 三文件**同文件不同段**——T0 已把判据面与
  beyond 段钉死，剩余冲突为 prefab/ground 条目行与 palette/派生分支，git 合并可控；
  T1b 与两者零交叉）。
- **几何交叠手裁点**（派令点名项）：①南缘墙开口接门楼两翼——数据面零交叠（T2 墙身
  seg 显式排除 x76..80，T1a 桥/楼只写 x76..80），**观感面联验**（戗柱合角）排
  T1a+T2 双落后走查；②基座桥 y20..24 垫层与墙基垫层 y24 交汇——z128 行 x76..80 归桥
  （T1a）、其余归墙垫层（T2），y24 同层同材质 13 无缝，合并序无关。
- **建议合并序**：T0 →（T1a、T1b、T2 任序，建议 T1a 先绿给 T3 解锁）→ T3（T1a 后
  即可，与 T2 可并行）→ T2b（T1a+T2 后）→ T4。

---

## 5. 不可逆决策 ADR 建议（库现 0001..0012 已占）

| # | 决策 | 落 ADR？ | 编号建议 | 理由 |
|---|---|---|---|---|
| 1 | **beyond 白名单判据**：TOWN_MAP.beyond 显式域+「⊆ core ∪ beyond」守门语义+加段判据（缓冲带/回程服务面/防坠功能件三准入语义） | **落** | **ADR-0013**（随 T0 草案、T4 终稿） | 布局纪律「⊆core」是 town-map-design 立图以来的不变量，开白名单=永久放宽通道，判据面不可逆；不落档会被当「写越界的通行证」滥用（N5 的「防第二份几何」只是其一） |
| 2 | **镇域保护第一例**：townProtectedAt 纯函数+与建场同源+挖掘/放置/TNT 三缝接线形态+在保域拍板（§3.3 表） | **落** | **ADR-0014**（随 T2b） | 镇维度从「全可挖」转「有保护判据」是维度行为面纪律的首例变更；home 先例（advEdgeProtectedAt）的决策没落 ADR（T6 时代），镇域首例落档可把「维度保护判据=纯坐标函数+同源+三缝」定型为可复用模式，后续 den/新维度照抄 |
| 3 | **TIDEA-06 升格吞并**（signpost-home 退役/门楼接棒/ADR-0011 决策 6c 升格兑现） | **不落新 ADR** | — | 件级沿革非架构决策；ADR-0011 决策 6c 的预授权路径上的**形态升级非语义撤销**（把关标尺 4 已核）；留痕=票面+T4 的 town-prefab-specs.md 沿革批注（仓库先例：ADR-0009 决策被 0011 批注性裁决引用，但那是因为撤销了决策——本案无撤销） |

---

## 6. 合并序与基线

- **施工基线=aa2d7c8**（town-boundary trunk 终态）：aa2d7c8=设计权威入库 → 365fb36=
  F6 已并入 → 8ad2337=同步 trunk（c7eef99 已含）。**派令所写「c7eef99、F6 未并入、
  spec v2 文档面可能小冲突」三处预判均已过时**：F6 经 365fb36 进 trunk，spec v2 附录
  批注（2a1a840）与设计定稿入库（aa2d7c8）同线，②③基于 aa2d7c8 起步无合并冲突面。
- **②③与 F6 文件交叉复核**（维持零交叉结论）：F6 动 adventure-core.js（G1 材质面）+
  spec v2 附录；②③动 town 系+mesh-core+modes/adventure.js 判据缝——**mesh-core 是
  ②新增接触面（F6 未动），modes/adventure.js ②动三缝（F6 未动）**，零交叉维持。
- **主线回并**：②③全部落地后 town-boundary trunk 一次性回并 main；F6 已在同线无二次
  合并面。
- **收尾同步纪律执行点**（每票验收必跑）：`npm test`（全量+boot 冒烟+规范守门）+ 
  `npm run lint` 三件套零错；worktree 内施工票各自全绿后合票再全绿（同文件不同段的三线
  并行，合票节点必须重跑全量——§4 并行面）；GLOSSARY/docs 更新随 T4 收口一次性过
  conventions.test.js 守门。

---

## 引用与对齐（施工票引用路径前置）

- 设计权威：`docs/design/town-side-gate-and-edge-fence-spec.md`（aa2d7c8 已入库，主仓库
  同路径同步归 T4 核对——设计入库提交 aa2d7c8 注记「定稿落共享区建议执行」尚未兑现到
  主仓库，T4 收口时主仓库 docs/design/ 落一份或以 git 合并自然同步，调度岗裁）。
- 把关记录：`.scratch/town-east-boundary/gate-review-town-side.md`（N4/N5/N6 随票）。
- 代码事实锚（aa2d7c8 行号）：回程判据 adventure.js:2958/:2986-2987；home 保护先例
  adventure-core.js:1872-1931；门额牌渲染 mesh-core.js:218-241/:468-474；home 门楼
  adventure-core.js:1511-1544；装配 town-assembly-core.js:133-541（kind 拼写域
  :244-246/:377-379、palette throw :417-419）；建场 adventure-dims-core.js:668-686；
  加载序 index.html（prefab-kit→adventure-core→town-map-core→adventure-dims-core→
  modes/adventure.js→town-assembly-core）；守门测试 town-map-core.test.js:119-123/
  :154-156/:200-207/:287-289/:317-319/:593-595/:706-717。
- 引擎层纪律核对结论：mesh-core 泛化=纯几何（邻接现算轴向、零玩法语义）；prefab-kit
  town-gate 行=件库惯例第 16 行；config/texture-atlas 零改动；town-map-core 新增
  beyond 段/townProtectedAt=纯数据+纯函数，可测性声明不变。

---

**文档结束**（arch 岗回执，调度岗按 §4 建票排期；裁决理由与事实锚均已逐条落文，票面
直接引用本文件路径即可）
