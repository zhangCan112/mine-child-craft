# ADR 0018: 镇域保护判据——townProtectedAt 纯坐标函数与「判据=纯函数+同源+三缝」模式

日期：2026-11-16 · 状态：**草案**（随 T2b U4 落）

## 背景

U4「防 child 破坏」要求镇墙圈（T2，spec §3.3 十六段 segs）与镇侧门楼（T1a，prefab-kit town-gate）本体不可被挖/放置/TNT 破坏，穿行契约（门洞净空）除外。判据消费方是行为面三条缝：挖掘话术（advMineHardText）、TNT 爆炸豁免（advEdgeTntProtected）、放置守卫（placeGuard）。约束三条：几何唯一权威已定（TOWN_MAP 单源，ADR-0013 N5「防第二份几何」纪律延伸）；壳层维度判据零 town 字面特判（test/adventure-dims-core.test.js 守门）；home 侧既有保护面（advEdgeProtectedAt/advEdgeProtectedZone，T7 转正）零漂移。把关裁决与实现要点已由红方预裁（.scratch/t2b-guard/red-evidence.md 判据形态裁决 9 条），本 ADR 立档其架构决策。

## 决策

1. **判据形态=纯坐标函数 `townProtectedAt(x,y,z)` 住 town-map-core（part 派生式，零依赖）**：不引 PrefabKit（头注「零件库符号引用」纪律保持）——墙圈吃 `TOWN_MAP.ground` town-rim segs（几何唯一权威）part 白名单 `pad/wall/post`；门楼吃 `TOWN_MAP.prefab` town-gate 行锚（单源）+ 保护域政策偏移（楼段 dy+1..+9 全宽含檐口出挑 dx-1..+5 / 桥段 dy-4..0 桥体宽 dx0..+4 / 门洞净空 gx+1..+3×gy+1..+3×gz+1 排除，出处=prefab-kit town-gate foot/kernel + town-side-gate-and-edge-fence-spec §2.2/§2.6 + 架构方案 §3.3 表）。**几何第二份禁令的满足形态=footOf 逐格对拍锁**：政策偏移是 footOf 盒的第二份表述，漂移由 town-map-core.test.js ⑧c「footOf 盒对拍」断言锁死（prefab-kit foot 若变，对拍红=强制同步）——第二份表述不是免罪，是带锁的登记。
2. **保护域拍板（§3.3 表逐行外推）**：在保=墙身 y25..26 / 垫层 y24（墙的地基，挖垫层=墙浮空穿帮+钻缝）/ 接头柱 y25..27 全高（防登墙功能件）/ 门楼全盒（楼段+桥段）。**不在保**=柱帽 cap（纯装饰顶格）/ 墙头花（派生装饰面，不在 segs 天然出圈）/ 翼墙 wing + 端头墩 pier（裙板域防坠件，非镇墙本体——home「端帽/花不保」先例对称）/ 门洞净空（穿行契约，建场同式禁填）。白名单是**枚举允许**而非枚举禁止：新 part 落 segs 默认不在保，扩白名单须过票。
3. **镇维度门=行身份比对 `advDimRow(advDim) === ADV_TOWN_DIM_ROW`**（壳层先例口径，dims-core 在册）：**`advMap === 'town'` 是死门禁用**——advSetDim 进镇时 advMap 不动（T6，adventure.js 镇态 advMap 恒 'home'），用它做门=镇分支永不生效或 home 分支被误吞。守门 test/adventure-dims-core.test.js「维度判据零 town 特判」同步满足（行身份不是字面特判）。
4. **话术缝早返形态**：镇维度下 advMineHardText **只消费镇判据，早返**（命中→镇话术；未命中→`''`），绝不落 home 方位分支——镇态坐标喂 home 几何判据（高度场/方位桶）=跨图误判语义错位（pier/翼墙域 z29..31 撞 home 北雪桶 z≤31、x16..18 撞西雾塘带）。比「缝前插镇分支」更严：早返把「镇态绝不消费 home 判据」变成结构保证而非分支顺序巧合。话术文案=design-lead 定稿 2026-11-16(见把关记录「U4 话术定稿」节);测试只锁非空+零 home 方位特征词,定稿换字面不破测试。
5. **三缝接线形态定型（「维度保护判据=纯坐标函数+同源+三缝」可复用模式）**：挖掘缝=advMineHardText 早返（决策 4）；TNT 缝=advEdgeTntProtected 镇分支**前置**（行身份门+townProtectedAt），既有 home 门原样保留其后；放置缝=镇侧守卫**具名提取** `advTownPlaceGuardAt(x,y,z)`（挂点导出，测试挂点纪律），placeGuard 表达式 OR 并列（镇/home 判据坐标域不相交，并列授权=架构方案 §3.2；home 侧表达式零改动）。三缝同吃 townProtectedAt 单源，口径天然一致；模式要点=**判据纯函数化 + 坐标单源 + 三缝各取所需**，后续维度（副本/下界本体保护）按此复用。
6. **挂点扩**：adv 导出清单 + `advEdgeTntProtected` + `advTownPlaceGuardAt` 两行（头注 interface 键计数照实同步）。判据出口 townProtectedAt 经 module.exports 扩（Node 域测试桥）+ vm 域 typeof 桥（红方装具已落），浏览器域经经典 script 全局词法环境调用期解析（advEdgeProtectedAt 同款形态）。

## 挡回的替代方案

- **判据引 PrefabKit**（footOf 运行时对拍当判据）：town-map-core 头注「零运行时依赖」纪律破——挡回；政策偏移手写+对拍锁（决策 1）。
- **几何判据进壳层**（adventure.js 直接读 town-rim segs/门楼锚）：⑧b 红线「modes/adventure.js 零 town-rim 字面」明令判据单源 town-map-core——挡回；壳层只消费 townProtectedAt 出口。
- **`advMap === 'town'` 做维度门**：死门（镇态 advMap 恒 'home'，T6）——挡回，见决策 3。
- **三缝各自内联镇判据**：三处坐标式副本，漂移面×3——挡回；具名提取+OR 并列（决策 5）。
- **镇态话术落到 home 方位分支后**（缝前插而非早返）：分支顺序巧合不锁语义，pier/翼墙域坐标误中 home 文案——挡回，见决策 4。

## 后果

- 正面：U4 三缝行为可测（红面 6 条，⑧b 守卫转正强度不降）；「挖/放/炸」同口径单源；home 面零漂移（既有门原样）。
- 不可逆性：中——判据出口形状（(x,y,z)→boolean）与三缝挂点名已成测试契约，废改须连测试面过票；白名单枚举形态使「默认不在保」成为安全缺省，扩域通道=过票。
- 已知边界：政策偏移为 footOf 盒的第二份表述，与白名单 segs 在檐口列×垫层行（x75/x81, y24, z128）存在 2 格表述域交叠——⑧c 对拍以 segs 全格循环优先（判据吃 segs 单源优先），交叠格的归属表述随红方裁决收口。
- 待办（不阻塞本票）：话术文案定稿（design-lead）；「镇内物件细粒度保护」（钟塔/摊位等 core 域件）若立项按本模式复用（判据扩展走 town-map-core 过票）。

## 证据与关联

- 架构方案：.scratch/town-east-boundary/arch-town-side-gate-and-edge-fence.md §3.1（判据形态两选项）/ §3.2（三缝接线+并列 OR 授权）/ §3.3（在保拍板表）——工作区留档，未随 git（0013 同款引用形态）。
- 红方预裁：.scratch/t2b-guard/red-evidence.md（判据形态裁决 9 条+守卫重构+派绿验收门）。
- 设计定稿：[docs/design/town-side-gate-and-edge-fence-spec.md](../design/town-side-gate-and-edge-fence-spec.md) §2.2/§2.6（town-gate 几何）/ §3.3（墙圈块级规格）/ §6（U4 验收）。
- 先例 ADR：[0013](0013-town-beyond-whitelist.md)（beyond 白名单+「防第二份几何」N5）；home 侧先例=T7 边界屏障（advEdgeProtectedAt/advEdgeProtectedZone，adventure-core 头注「边界保护政策」段）。
- 测试：test/town-map-core.test.js ⑧b（转正守卫）/⑧c（判据采样+同源互证+footOf 对拍）；test/adventure-mode.test.js 文件尾 U4 三缝行为测试三组。
