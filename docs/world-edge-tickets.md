# home 世界边界无限化 · 工单（本地 tracker 代理）

> 本文件是 [docs/world-edge-map.md](world-edge-map.md)（wayfinder:map）的子票清单。
> 状态行承载 claim/blocked；`wayfinder:<type>` 是票型标签（research/prototype/grilling/task）。
> 规则：开票前先领（状态行写 claimed）；被挡票在所有 blocked-by 票关闭后才可动工；
> 决策沟通一律走 relay；每票一次会话只解决一张。

---

## T1 · MC 边界与群系过渡的官方观感语言调研

> 标签：`wayfinder:research`（AFK）｜状态：closed｜blocked-by：无｜blocks：T2 T3 T4 T5

### Question

MC 官方在「世界边界」与「群系过渡」上的观感语言是什么？为四位 designer 的设计提供事实底座：

1. MC 世界边界（world border）的视觉呈现：墙体材质/动画/颜色、靠近边界的警告与雾效、玩家穿越禁区的行为。
2. MC 群系过渡（biome blending）怎么渐变：地表块混铺的宽度量级、树/草/水的密度渐变、颜色 map（grass/foliage/water）的插值方式。
3. MC 对「远方暗示」的手法：雾即渲染边界（VIEW 语义）、远处剪影/天际线元素（村庄、要塞轮廓）。
4. 6 岁友好口径：MC 里边界警告的表现是否惊吓、哪些手法值得照搬/简化。

产出：`docs/mc-world-border-research.md`，格式与出处规范照 `docs/map-transition-research.md` 先例（事实性论断附来源 URL，抓取日期，二手来源标注）。**AFK：零决策，不问用户，遇到模糊处自行取保守口径并登记。**

### Resolution

调研完成，产出 [docs/mc-world-border-research.md](mc-world-border-research.md)（抓取 2026-11-06，主体 minecraft.wiki）。速览：

- **边界墙默认不是红**：半透明水蓝斜纹动画墙（#20A0FF），三态色语言=蓝不动/绿扩张/红收缩；警告是贴脸 5 格才出现的全屏红 vignette+越界掉血，无音效记载——6 岁口径**借形（动画条纹/状态色）不借罚（伤害/红屏惊吓）**，预警距离要大幅前置（天/雾色先行）。
- **群系渐变=小窗口混匀**：biome 按 4×4×4 格 cell 存储，植被/水色默认 3×3~5×5 格逐块平均（Biome Blend），天/雾色按相机 5×5×5 高斯模糊；无专门的块渐变/密度渐变带（24~40 格带≈6~10 patch，属自定义扩展，无语言冲突）；天色-温度公式 `(0.622-0.05T, 0.5+0.1T, 1)` 可作雪/沙边天色端点的 MC 同构依据。
- **远方暗示**：雾即渲染边界是官方原文口径（render distance「因此也被称为 fog」）；穿雾地标=信标光柱（渲染至视距+**随距离加粗**）→ 东向小镇远景件要大件/深色才读得出；MC 无专门天际线剪影系统（未见记载，剪影道具属扩展手法）。
- designer 速查表与 AFK 保守口径登记见报告 §5/§6。

---

## T2 · designer·北向雪原边（概念图→轻量原型定稿）

> 标签：`wayfinder:prototype`（HITL）｜状态：closed·定稿（2026-11-06 用户二轮实机通过）｜blocked-by：T1｜blocks：T7

### Question

北向（+z 或 −z 按 Q7 拍板=雪原）过渡带的视觉设计定稿。designer 子 Agent（每方向一位）经 relay 与用户逐方向确认：

- **前提**：过渡带=home 图边缘的带状区域，地表块从 home 主题渐变为雪原主题（B_SNOWY_GRASS/B_SNOW/B_ICE 可用，均已在图集），含零星云杉/雪堆；宽度由设计定稿（参考量级 24~40 格，160×160 世界）；接近尽头时天/雾色向雪原 palette（sky 0.80,0.87,0.96）渐变；尽头越线即传送（T8 机制）。
- **未解锁屏障**（拍板 8）：地图未解锁时，过渡带中段的「自然屏障」样式——雪崩堆/冰墙/裂谷等，要孩子一眼读懂「过不去，回去做任务」，配套话术建议。
- **两步确认**（Q11C）：第一步概念图（像素风 SVG 断面/远景 mockup，落 `docs/world-edge-design/north-concept.svg`，escalation 里给用户文件路径），用户通过后第二步轻量游戏内原型（临时代码，走查用），用户实机确认后定稿，锁成该方向的视觉规格（写进本票 Resolution）。

### Resolution

（2026-11-06 定稿，用户二轮实机通过）北带规格权威 = docs/world-edge-design/north-spec.md（正文 + §10 走查反馈修订）：

- **屏障** = 连绵雪山脊：`advEdgeNorthMountainH` 纯函数剖面权威（峰高 13~18、半宽 5~7、脊线 z9~11 微蜿蜒、t^2.6 凹坡），石身雪盖+檐下冰舌+南麓碎石坡；南麓 1 格缓阶起步「看着有爬的欲望」、随即 ≥2 格级差跳跃翻不过（首版「雪崩堆矮丘」被用户读作墙，二轮重做）；
- **植被** = 落雪寒带杉（原木干+树叶锥冠+冠顶/冠肩 B_SNOW 冠盖，全带杉落雪——首版绿杉被否）+ 雪根座（带内杉干基垫雪恒 ≥y27，与家园选树/砍树级联解耦）+ home 草丛/花沿带渐稀（植物过渡发生在带内）；
- 天/雾渐变锚点见 spec §3；屏障样式话术文案归 T7/T8；NW/NE 四角交接见 spec 文末「四角交接（第 5 员工，2026-11-06）」小节。

---

## T3 · designer·南向沙漠边（概念图→轻量原型定稿）

> 标签：`wayfinder:prototype`（HITL）｜状态：closed·定稿（2026-11-06 用户二轮实机通过）｜blocked-by：T1｜blocks：T7

### Question

同 T2，方向=南（沙漠）。可用件：沙(id 8)/砂岩 B_SANDSTONE/仙人掌 B_CACTUS/枯灌木 B_DEAD_BUSH（均已入图集）；天色端点 0.90,0.82,0.62；绿洲/露头做法照 adventure-maps-core 沙漠建场先例。屏障样式=沙漠语言（岩壁/流沙带/沙暴墙等）。概念图落 `docs/world-edge-design/south-concept.svg`。

### Resolution

（2026-11-06 定稿，用户二轮实机通过）南带规格权威 = docs/world-edge-design/south-spec.md（32 列查表 §4 + 走查反馈修订段）：

- **屏障** = 连绵大沙丘：`advEdgeSouthCrest` 脊线（z144..147，脊顶高 4..10 双正弦渐次起伏）+ 坡脚/陡升（级差恒 2，跳跃翻不过）/脊顶/背风肩四段剖面 + `advEdgeSouthSwell` 沙海丘原（z148..159，0..3 高）；砂岩只做脊顶零星露头；apron z139..143 裸沙（首版「沙暴墙柱阵」被用户读作墙，二轮重做）；
- **植被** = 耐旱矮树 `advEdgeSouthScrub` ×8（矮干+扁小冠）+ 草丛梯度 121→53→5（入口密→带内渐稀→远端零星，消长发生在带内）；
- SE 四角交接（流沙半埋栅栏+草甸南侵楔）见 spec 文末「四角交接」小节；垫塔/架桥翻丘口子归 T7（T6 修订 v2 登记）。

---

## T4 · designer·西向沼泽边（概念图→轻量原型定稿）

> 标签：`wayfinder:prototype`（HITL）｜状态：closed·定稿（2026-11-06 用户二轮实机通过）｜blocked-by：T1｜blocks：T7

### Question

同 T2，方向=西（沼泽）。可用件：泥(2)/苔石(14)/兰花 B_ORCHID/水洼+泥岸/高脚木屋元素（照沼泽建场先例）；天色端点 0.62,0.66,0.64。屏障样式=沼泽语言（毒沼带/荆棘丛/迷雾深水等）。概念图落 `docs/world-edge-design/west-concept.svg`。

### Resolution

（2026-11-06 定稿，用户二轮实机通过）西带规格权威 = docs/world-edge-design/west-spec.md（正文 + 走查反馈修订段）：

- **屏障** = 迷雾深水带（k13~18）+ 高脚木屋等沼泽语言原样保留（用户未提意见，不重设计）；
- **搬家** = 苦力怕副本黑巢自北带东段 (100,8) 迁驻西带沼泽 **(26,72)**（用户拍板「蹲雪山边不合理」）：落位/避让论证见 west-spec 走查反馈修订段与 den-nest-design.md §8；副本难度改由门序承担（沼泽=解锁链末环）；
- **植被过渡** = 兰花 ramp + home 植物→沼泽植物沿带消长；
- SW 四角交接（沙洲没入沼泽+潮尾）见 spec 文末「四角交接」小节。

---

## T5 · designer·东向小镇边（概念图→轻量原型定稿）

> 标签：`wayfinder:prototype`（HITL）｜状态：closed·定稿（2026-11-06 用户二轮实机通过；首轮已认可、二轮零改动冻结）｜blocked-by：T1｜blocks：T7

### Question

东向「通向小镇」观感收尾（拍板 4：小镇本体是未来世界，本次只做观感）：土路+栅栏+告示牌「小镇建造中」，走到头被栅栏挡住+话术。需定稿：土路铺法、栅栏件（现有方块拼或新贴图格位）、告示牌形制与话术文案（走 SpeechKit/toast 通道）、远景元素（要不要一两个小镇轮廓剪影道具）。**东向没有传送，收尾感要完整**：孩子走到栅栏前能得到「这里以后会很热闹」的期待而不是「走不通」的挫败。概念图落 `docs/world-edge-design/east-concept.svg`。

### Resolution

（2026-11-06 定稿：首轮已认可、二轮零改动冻结）东带规格权威 = docs/world-edge-design/east-spec.md（§3 定稿节奏 + 走查反馈修订段）：

- **收尾件** = 土路主径 + 栅栏（x157）+ 告示牌 + 花田 ×2（主径两侧 x144~146）+ 小镇剪影 + 隔离带圆冠树 ×2（x158）；home 植物→村落风过渡三条链在场（入口土斑断草丛 / 渐密段花田涌现 / 主径连续）；
- SE 四角交接（流沙半埋栅栏——用户走查认可 + 草甸南侵楔止步 z138）见 spec 文末「四角交接」小节；
- 红花无图集格位的登记偏差归 T7。

---

## T6 · 过渡带禁挖禁建政策（grilling）

> 标签：`wayfinder:grilling`（HITL）｜状态：closed（修订 v2 2026-11-06）｜blocked-by：无｜blocks：T7 T8

### Question

过渡带与屏障的方块保护政策：孩子能不能在过渡带挖/放方块？（背景：可挖则可能挖穿未解锁屏障绕过任务解锁；挖穿地形会破坏确定性建场的重放一致性口径——edits 账本允许玩家改动，但屏障若被挖穿，解锁判定是否失效。）经 relay 问用户拍板，候选：

- A. 过渡带全域禁挖禁建（editHit 校验拒绝+儿童话术「这片大地还在生长中」）——最稳；
- B. 可挖但屏障件不可破坏（屏障方块加保护旗标）——保留一点自由度；
- C. 全放开（不推荐）。

### Resolution

（2026-11-06，用户拍板 A）**过渡带全域禁挖禁建**：

- 挖：挖掘链整链拒绝——照 2026-11-04「挖不动就是真挖不动」既定口径：蓄力链不起进度、破坏链整链拒绝、方块原地不动；
- 放：放置校验拒绝（editHit 放置守卫同点拦截）；
- 话术：拒绝时儿童话术「这片大地还在生长中」（最终文案随 T8 话术过目环节一并确认）；
- 推论：未解锁屏障件与东向栅栏/告示牌**无需单独保护清单**（全域政策天然覆盖）；探险无儿童飞行，无越障口径要补；
- 给 T7/T8 的前提：带内判定=坐标判据（四缘 band 矩形，带宽读 T2~T5 设计定稿），守卫加在探险使用链（PlaceKit/mode-kit editHit 已有守卫族，不造第二份拒绝机制）。

**修订 v2（2026-11-06，用户看过概念图后改口，经 relay 追问两题拍板）**：

- 带内**可挖可建全放开**（孩子可以在过渡带挖矿、盖房）；原「全域禁挖禁建」与拒挖话术「这片大地还在生长中」**作废**；
- 唯一保护清单（不可挖、不可替换，像基岩）：**各方向未解锁屏障件 + 东向栅栏/告示牌**——拍板 8 的解锁语义由保护清单守住；
- 遗留口子（登记给 T7 落位，不另开用户轮次）：带内可放 ⇒ 理论上可垫塔/架桥翻越屏障——T7 给出口径（屏障正上方禁放延伸带，或接受物理难度），轻量原型走查验收；
- 实施前提更新：保护件判据归 T7 定（旗标或坐标+件判据，沿 east-spec 的旗标保护思路）；带内玩家改动全走 edits 账本（可挖可建使「老档带内 edits 兼容」雾区更相关，T7 一并落）。

---

## T7 · 四方向过渡带转正 + 天/雾调色板边缘渐变

> 标签：`wayfinder:task`（HITL，实机走查环节需用户）｜状态：closed·转正完成（2026-11-06 G2 实机走查通过；三波次施工+性能钉测入库）｜blocked-by：T2 T3 T4 T5 T6｜blocks：T8 T10

### Question

把四位 designer 定稿的轻量原型转正为正式实现：四方向过渡带进建场函数族（确定性红线：两次建场逐字节一致；edits 记账兼容重放）；接近边缘时天/雾色按玩家到边距离向目标图 palette 渐变（机制口径参考 T1 调研与「Not yet specified·渐变机制」的升格结论）；未解锁自然屏障按定稿落位；东向小镇收尾件落位。更新/新增单测（adventure-maps-core 建场确定性、渐变纯函数）。

**性能红线（用户 2026-11-06 拍板追加，硬要求）**：转正不得劣化运行时表现——①建场一次性耗时：转正前后 advBuildWorld 对比实测，量化验收阈值由施工方案给出；②每帧路径零新增：逐帧分配/世界读/setSkyBase 冗余调用不得增加（天雾插值续走量化 memo 缝）；③零新贴图格位、零新常驻大对象；④性能验收进测试或给出可复现的回归钉测法。

**拍板记录（2026-11-06，施工方案 docs/world-edge-t7-plan.md 审查通过后）**：
- Q1 三处图集登记偏差（东带红花格位/告示牌写字/剪影深蓝灰）→ **全部维持走查通过现状销项**（零新贴图符性能红线③；任一升级需新机制+再走查）；
- Q2 过渡带夜怪 → **按主题换怪**（雪边流浪者/沙边尸壳等，用户未采纳「全域同池」推荐）——属玩法扩展，按方案建议另开 **T11** 实施，不塞 T7；T7 范围内夜怪口径维持 home 同池不变。

### Resolution

（2026-11-06 转正完成）施工方案 docs/world-edge-t7-plan.md（审查通过）→ 三波次实施，总原则「转正≠重写」（观感层定稿冻结原样收编，只加政策层/工程层）：

- **波次一**：P2 保护判据 `advEdgeProtectedAt`（坐标+件纯函数，与建场权威同源零状态；三向受解锁开关门控、东向恒保护）+ P3 翻越拦截 `advEdgeProtectedZone`（三向足迹列整列禁放——垫塔/架桥第一格必落禁放列，东向不设禁放柱=翻栅栏彩蛋）+ PK/ADV 守卫缝（hardText 扩签名统一问询、opts.placeGuard 新注入缝、TNT sink 四出口豁免 + cascadeGuard 级联补口〔堵「连桩放倒栈桩」旁路〕）；
- **波次二**：断言群（判据逐坐标/开关门控/TNT 不破不掉物/edits 重放玩家赢/分向文案占位）+ P5 天/雾升格（整数双键 memo 零分配+腹地旁路零分配，量化档位逐比特不变）；
- **波次三**：P6 性能钉测（env 门控 `T7_PERF=1`：带建场增量倍率 ≤0.93〔实测 0.784〕+ 全量 ≤1500ms 防呆〔实测 692.1ms〕）+ P1 原型标记清理（js/ 下「边界原型/走查用」零残留，升格〔边界转正·T7〕）+ P8 挂账销项（Q1 三偏差维持现状/南带沙暴不做/夜怪转 T11/老档口径=玩家赢）；
- **性能红线四条全兑现**：建场倍率钉测入库、每帧路径零新增（审计+消减）、零新贴图（T12 用户拍板例外一格覆雪树叶）、回归钉测法可复现；
- **G2 实机走查通过**（2026-11-06 用户「整体满意」）；走查反馈小 bug 已开 **T12** 修复（覆雪杉级联残留→白色树叶方块，1705 绿）；
- 后续：T8（话术终稿/advSetEdgeBarriersHidden 换解锁进度驱动）、T11（主题夜怪）、T12（实机复验覆雪杉后 closed）。

---

## T8 · 边缘传送机制 + 解锁判定 + 回程门挪边

> 标签：`wayfinder:task`（HITL，话术文案需用户过目）｜状态：closed（2026-11-07 三波次施工完成 + G3 实机走查通过）｜blocked-by：T7 T6｜blocks：T9 T10

### Question

实现拍板 6/8：越线瞬间传送（触发线贴现有碰撞钳制面，白闪 overlay 300~800ms+音效，冷却沿用下界门 0.8s 先例防抖）；**未解锁走到屏障=挡住+话术**（引导回任务，不传送）；**远征图回程门挪到面向 home 的那条边缘**（雪原图=南缘、沙漠图=北缘、沼泽图=东缘，落点=回程门内侧 2.5 格面朝图内，沿用 advPortalExit/advMapArriveAt 口径）；解锁判定复用 advMapUnlocked 不绕过。相关政策纯函数进 adventure-maps-core/adventure-core（可单测），壳只装配。

**T7 交接（2026-11-06 转正完成时登记）**：①`advSetEdgeBarriersHidden` 现为单一开关缝（URL `?edgeUnlocked=1` 走查参数驱动；政策判据三向受其门控、东向恒保护）——本票把驱动源换成解锁进度时，清场重建按新参数走（world-edge-t7-plan §5 R6：与既有换图重播机制同构零新机制）；②屏障拒绝话术占位已挂四向（挖掘分向三条+东栅栏一条原文+放置通用一条，js 内注释标 R8），**称谓与终稿归本票话术过目环节**（北 spec §6「雪崩堆」称谓失准待按雪山脊新形态改词）。

### Resolution

（2026-11-07 三波次施工完成 + G3 实机走查通过；施工方案 [world-edge-t8-plan.md](world-edge-t8-plan.md) §7 六拍板题+三波次编排+G1~G4 门禁）

- **波次一（纯函数/常量）**：adventure-core 边缘纯函数群——advEdgeTransitDirAt（触发线贴碰撞钳制面，east 恒 null）/advEdgeHintAt（近前引导区）/advEdgeOpenDir（单一开放判据=强制缝 OR 解锁派生）/advSetEdgeUnlockCounts（政策缝，null=全锁与 T7 现状逐位一致，老档零迁移）；adventure-maps-core ADV_EDGE_DIR_MAP/advEdgeDirUnlocked（复用 advMapUnlocked 不绕过）。
- **波次二（壳装配）**：advEdgeTick 传送链（advVeilFire kind='edge' 白闪+0.8s 冷却防抖；到达链零改动落挪边回程门）+近前话术（分级不剧透未来步，advGateLockTick 踩坑教训同款）+解锁让开演出（advUnlockRite 末尾 kind='rite' → advVeilArrive 同图重建 advOverworldReload，R6 背书零新机制；不切图不记账不清场实体）+回程门挪边（advPortalFrameX x 平面泛化+ADV_GATE_FACE_*+advMapArriveAt face 泛化；沙漠北缘 (58,3)/雪原南缘 (58,155)/沼泽东缘 (154,70)，旧位 (58,70) 无门体）+#portalVeil.edge 白闪 CSS 变体。
- **六拍板题**（HITL 经济：五题技术定档代裁走查未遭否决——白闪 0.8s 沿用门阵节拍/复用到达琶音/解锁演出=白闪+同图重建（R6）/`?edgeUnlocked=1` 保留 OR 强制全开调试缝/回程门三坐标如上；**Q3 用户拍板维持西向软屏障**：锁定态可蹚水到西缘，不传送零伤害，T10 复核）。
- **G3 实机走查拍板（2026-11-07）**：话术终稿通过（拟人+指回任务+给期待占位未遭否决即终稿）；**密度拍板节流 6s→30s**（ADV_EDGE_HINT_CD=30，组 6 断言重写 30s 时序——观察窗必须 > CD，消化帧大步长 30.1）；走查附加拍板**冰贴图升级**（B_ICE 原 glass 纯色半透在雪原读作「脏渍」→入集 T_ICE=54 整格冰裂纹+摘 glass 走 74 同款标准不透明通道，「零新贴图」第二次用户授权突破〔74 覆雪树叶先例〕；摘旗标连带挡光/不透明副作用已接受，岸边观感列入 T12 复验）。
- **门禁**：npm test 全量 1717（1716 pass/0 fail/1 skip=T7_PERF 默认跳）+ lint 零错误 + T7_PERF 钉测原阈值过（6.4s）；GLOSSARY 四词条（边缘传送/触发线/回程门挪边/白闪变体）+ 总账 Decisions T8 行随波次三收口。

---

## T9 · home 三扇门阵移除与导航收尾

> 标签：`wayfinder:task`｜状态：closed（2026-11-07 实施完成，主会话以 git diff 全量核实收口；三门退场+新话术实机观感并入 T10 总走查）｜blocked-by：T8｜blocks：T10

### Question

移除 home 三扇门阵（含 look 塔/冠建材与门锁提示半径逻辑），边缘传送成为唯一入口（拍板 7）：清 advGatesBuild 的 home 门段、检查任务文案/HUD/话术里所有「去门阵」指向并改为指向对应方向的地平线；远征图回程门与下界门/玩家自放门**不动**。回归测试更新（门阵相关断言）。

### Resolution

（2026-11-07 实施完成，后台 subagent 施工、主会话以 git diff 全量核实收口——12 文件 +354/−456，未预授权文件（effects/showroom 两 js 一 css）核实为纯注释措辞零行为）

- **数据源摘除（js/adventure-maps-core.js）**：home 行 `gates`→`[]`——查表机制原样保留（advGatesBuild/advGateAt/advGateHoldStep 对空表天然零命中，壳循环空转；远征图回程门仍走同一份机制）；回程门/下界门/玩家自放门/巢穴之门全链路未动（票面红线）。
- **回家落点唯一权威易主**：新增 `ADV_HOME_EDGE_GATES` 三锚（north {px:58,pz:23}/south {px:54,pz:128}/west {px:31,pz:70}，与 T11 主题带矩形同源口径）+ `advHomeArriveGate(fromMapId)` 来向反查（经 ADV_EDGE_DIR_MAP 反查不抄方向表，未知图兜底南锚）；壳 advVeilArrive 落点二分——回 home 走来向缘锚（从哪缘越线出去回哪缘：落点 (60.5,26)/(56.5,126)/(34,72.5) 探针实测平草实底净空）、去远征图走对应回程门；锚位刻意不落触发线口袋（落脚即距「一步再传送」过近，北缘还会落山脊背侧）。旧 `gates.find||gates[0]` 路径对空表会炸 undefined，已随二分移除。
- **门体通用化（js/adventure-core.js）**：`advPortalFrame`/`advPortalFrameX` look 四建材换装退役（签名 4 参，恒经典下界建材——唯一消费方 home 门阵没了；tw/cr 常量名保留=B_OBSIDIAN/NETHER_BRICK 映射，place-kit/dims-core 调用方全 4 参核实零改动）；`ADV_GATE_PLAZA.gates` 副本与 `ADV_GATE_PLAZA_PAD` 整删，树/草/花避让改用 PLAZA 整矩形（铺装 id4≠1 的地面检查天然排除，广场建场逻辑零变）。
- **锁门机制整体退役（js/modes/adventure.js）**：`advGateLockTick` 全家（半径/节流常量、两处复位、update hook）；近前引导职责归 advEdgeHintAt 30s 分级话术独自承担（G3 拍板节流不变）。
- **解锁仪式改版**：`advUnlockRite` 拆二分——home=gate_unlock 琶音+白闪让开（T8 Q4 拍板 rite 骨架原样保留，方向句归到达段 0.4s 播，白闪满格同图重建=建场读键新地貌）；远征图=纯播报「○○的路打开啦！回到家里就能看到！」。旧「点亮门面」（运行时熄→亮 B_PORTAL 覆写）与 Fx.pop 冲击波随门退役。
- **任务文案方向化（R9 兑现）**：q16「去东边的广场看一看」；q17/q20/q23 解锁 hint 改「南/北/西边的路打开啦！朝○○一直走，○○就会让开，送你去○○咯」——全部指向方向+地平线，零门引用。
- **测试（6 文件）**：删 T7-1b（rite 门面 mesh 特写）/T7-3b（锁门话术）两项——机制不存在即无覆盖对象，覆盖损失有意接受；替代覆盖=旧门区零门体钉+三锚落点数值钉+「T8 边缘传送真任务链」端到端（广场真踩点→rite 泵→南缘越线→desert+q17 接棒）。全量 `npm test` **1720 tests：1719 pass / 0 fail / 1 skip**（T7_PERF 门控默认跳）+ `npm run lint` 零错误 + `T7_PERF=1` 性能钉测原阈值过（subagent 实跑，改动面为纯删除+表行新增，无逐帧新增路径）。
- **登记（不修）**：①GLOSSARY「传送门阵」词条与交叉引用过时——归主会话本次收口改写；②「门阵」字样 js/test 内余 28 处均为合法拆除说明/沿革留档注释（GATE_PLAZA 标识符更名波及四方判定不值）；③docs/ 历史工件旧「门阵」叙述按约定不改；④`advMapArriveAt` 硬编码 y=ADV_GROUND+1=25——三锚落点已实测实底，后续再动锚值必须重探（环境陷阱）。

---

## T11 · 过渡带主题夜怪（邻接世界主题换怪）

> 标签：`wayfinder:task`（HITL，实机走查环节需用户）｜状态：open（2026-11-06 用户拍板立票；2026-11-07 实施完成，待实机走查后 closed）｜blocked-by：T7｜blocks：无

### Question

过渡带夜间刷怪按相邻世界主题换怪（2026-11-06 T7 方案拍板环节，用户选「按主题换怪」、未采纳「全域同池」推荐）：北雪原带刷流浪者（stray）、南沙漠带刷尸壳（husk）等——怪物皮肤资产已在册（mob-look）。需设计：①夜怪池按玩家落点邻接主题查表的判据（带矩形→主题映射，与四带坐标同源纯函数）；②各带怪种配置表（西沼泽带/东小镇带配什么怪，东向或维持 home 同池）；③与既有夜怪封顶的兼容（ADV_NIGHT.CAP 不松动，儿童红线）；④性能口径：判据 O(1) 查表、刷怪走既有夜怪铺法事件路径、零逐帧新增（性能红线同 T7）。

### Resolution

（2026-11-07 实施，主会话以 git diff 核实收口）

- **判据（js/adventure-core.js 〔世界边界·T11〕段）**：`advEdgeThemeAt(x,z)` 落点→邻接带主题 O(1) 纯函数——带矩形与建场权威同源（北 z∈[0,24) / 南 z∈[128,160) / 西 x∈[0,32)，与 T7 保护判据 advEdgeProtectedZone 的落位坐标口径同文；角区检序北→南→西承 T8 先例），腹地与东带（x≥128）=null；`ADV_EDGE_NIGHT_POOL` 主题池表（snow=stray / desert=husk / swamp=bogged，[种,权重] 二元组与 ADV_NIGHT.POOL 同构，权重位留同构不改配额语义）；`advEdgeNightPoolAt` 池解析缝（命中返共享引用零分配）。
- **西带选型：沼骸 bogged**——在册怪种全表核对（MOB_TYPES + mob-look/bogged.js 均在册）按沼泽主题选型：MC 官方沼泽骷髅变体，且与远征沼泽图夜池主角同款（adventure-maps-core swamp 行 nightPool 同怪），主题语言跨「home 过渡带/远征图」一致，零新资产。北流浪者/南尸壳照用户拍板落表；**东向维持 home 同池**（栅栏彩蛋收尾方向，票面两案取维持）。
- **壳装配（js/modes/adventure.js 仅 advNightLayRing 一处）**：池来源换装——home 图按落点查主题池、未命中/远征图回落当前行池（`advMapRow.id==='home'` 门控防远征图坐标撞带矩形串装）；节拍/环带/光照门/CAP/清场/家锚全未动——只换「铺什么怪」不换「怎么铺」，CAP 儿童红线不松动。体验馆 dev 固定点位铺法（D5 拍板①）独立缝不受影响。
- **性能红线**：判据 O(1) 整数比较、零逐帧新增——T7_PERF 钉测原阈值过。
- **测试**：adventure-core 判据组 ×3（主题逐带钉+边界值+角区检序 / 配置表+在册交叉+CAP 不动 / 池解析缝零分配+注入出单）+ adventure-mode 铺法组 ×2（三带实铺 / 腹地同池回落+远征图行池防串装）；全量 npm test 1722（1721 pass/0 fail/1 skip=T7_PERF 默认跳）+ lint 零错误。
- **登记（顺带发现，未修）**：①黑巢涌出通道固定苦力怕（den-nest 副本主题语义，与过渡带主题不同源，现状正确）；②环带掷点可落带外仍按玩家所邻主题铺怪（与票面「按玩家落点邻接主题查表」语义一致，实机走查留意观感）；③带缘常量三处并存（主题带矩形/近前引导区/触发线，语义不同已互指同源出处，改带需随建场同步）。

---

## T12 · 落雪杉覆雪级联残留修复（白色树叶方块）

> 标签：`wayfinder:task`（HITL 走查 bug 反馈）｜状态：open（2026-11-06 G2 走查用户反馈立票；实施完成，待实机复验后 closed——复验清单见 Resolution 复验注）｜blocked-by：无｜blocks：无

### Question

G2 实机走查用户反馈（2026-11-06）：「树上的雪树砍了后我还树上」——北带落雪杉（原木干+树叶锥冠+B_SNOW 冠盖）被砍倒后，冠上的 B_SNOW 雪盖块不随树叶级联消失，悬空残留在原树冠位置（雪块无「树叶」级联性质，不在级联清单收集范围）。**用户拍板方案**：新增一种「白色树叶」性质的方块（覆雪树叶），落雪杉冠盖直接用它——树倒即随冠一起消散。注：T7 拍板 Q1 曾定「零新贴图」，本票为新观察后的新拍板，覆盖口径仅限此一处（覆雪树叶一个新格位）。

### Resolution

（2026-11-06 实施）核实级联口径=cascade-core `mkPolicy` 从 BLOCKS 派生性质字段（非 id 白名单），树叶走 `need:{id:5,dist:4}`（规则③失依即落）→ 新方块 B_SNOWY_LEAVES（id 74）逐字段对齐树叶 7、need 同口径，树倒冠雪随冠消散。改动：config.js 新方块段（号段顺延 74，红线外推 75+）· texture-atlas.js 新格位 T_SNOWY_LEAVES=53（松针深绿底+白雪覆盖大部，count 54）· adventure-core.js advEdgeNorthSpruce 冠盖三处落位换 id（雪根座/山体雪盖/冰崖不动）· 测试：blocks-fields（号段 75+ 红线+字段档）· texture-atlas（count+像素判据：全不透明/雪层过半/底层露绿）· cascade-core（needRules 恰两条+isSupport）· adventure-core（三连剖面 5→7→74+北带覆雪级联行为断言：挖干→干柱+树冠包围盒无残叶残雪+雪根座保留）· 建场件消费的五个测试文件 api 清单补挑（require 链全局名供给）。north-spec.md §11 登记修订 · GLOSSARY.md 图集词条顺笔。npm test 全量 1705 绿 + lint 零错误。

**复验注（2026-11-07）**：复验清单随 T8 冰贴图扩大为两项——①覆雪杉级联（原定项：砍北带落雪杉看覆雪随树消散）；②冰贴图岸边观感（T8 G3 拍板冰入集+摘 glass：冰下垫水变暗/对实心邻居剔面为已接受副作用，岸边过渡观感待实机复核）——两项可并入下次走查一并看，通过即 closed。

---

## T13 · 雪原远处纹理沸腾（实机「斑驳块疯狂闪动」排查）

> 标签：`wayfinder:task`（实机走查 bug 排查）｜状态：open（2026-11-07 双根因实锤：①无 mip 纹理沸腾=本票拆双材质修复，实施待派；②距离环形态翻转=转 T14 退役）｜blocked-by：无｜blocks：无

### Question

用户实机反馈（2026-11-07，配高清截图）：雪地地图「一些地和雪斑驳出现的块，很容易走动的时候疯狂的闪动」——截图特征：白面散布土黄斑驳块与成排锯齿状蓝色斑块、中景土黄高墙、纯色大块（绿/蓝）。同地点前次报障（判为 home 北带设计内地貌）补充的新信息是「闪动」——渲染层 bug 而非地貌问题。

### Resolution

（2026-11-07 排查完成，根因定位；修复待实施）

**排除项（Node 探针实测全绿）**：
- **几何损坏**：两图（雪原/home）各 100 区块 × (full+lod) 全量网格体检——零索引越界、零 NaN/Inf、零 UV 越界（垃圾三角形假说排除）。
- **流体永动**：FluidCore.mkSim 照 world.js 装配复刻实测——两图激活分别 55/65 刻收敛到不动点，稳态后 100 刻零写入（永动振荡假说排除）。
- **冰格 alphaTest 镂空**：T_ICE 画师仅 noiseFill/setP 不透明写入（排除）。
- **图集布局/mount 状态机**：world.js 上挂均先 unloadChunk 同键互斥，跨界全扫有防抖（无双层叠加缝）。

**根因（代码登记过的已知遗留代价）**：world.js `makeAtlasTexture` 为修 2026-10-28「幽灵透明边/串色」**禁用了 mipmap**（`minFilter=Nearest, generateMipmaps=false`，原因=镂空薄块透明底 α=0 经 mip 链混采会越过 alphaTest 阈值），注释原文登记代价：**「远处实心图集块轻微像素闪烁——像素风可接受；若不可接受再拆双材质（实心留 mip/镂空禁用）」**。当时图集块仅零星矿物/工作台，闪烁不显；**T8 后雪原图整片雪覆草微噪纹理+新入集冰裂纹锯齿纹理（高频纹理大面积连续）使 NearestFilter 无 mip 的远处欠采样（纹理沸腾 shimmering/crawling）从「零星轻微」升级为「整片雪地走动时疯狂闪动」**。与 T12 复验注②「冰贴图岸边观感待实机复核」同源，应并案走查。

**修复方向（待实机确认后实施）**：
1. **正解=拆双材质**（注释预留方案）：图集按格「全不透明/含镂空」分流——实心格材质开 mip（NearestMipmapLinearFilter+anisotropy，防格间串色需格间 padding 或实心块独立画布），镂空薄块（花草/火把/门板/树叶孔洞）维持禁 mip 保 alphaTest 边缘。工程面：texture-atlas 布局（per-tile 不透明表/padding）、mesh-core atlas 通道分流（协议随动）、world.js 双材质挂载、测试面广——中等工程量，宜立施工票排期。
2. **轻量缓解（可先行）**：雪原/北带雾距适度拉近，把 shimmer 高发区推进雾中（观感代价=能见度下降）。

**待实机分诊（2026-11-07 用户已答）**：①设备=**电脑**（桌面浏览器，排除低核档因素）；②**沙漠图也有同类问题**（非雪原独有）；③用户第二张高清截图拍到关键实证：**中景巨大纯绿/纯白无纹理方块墙**=LOD 粗网格树冠/雪盖（meshChunkLod「高塔抬升+裙边」把树冠拉成纯色大墙）——**第二根因实锤：距离环形态翻转**。探针 v5 实测（照抄 world.js 形态机语义）：沙漠图北缘→南缘往返一趟 **158 chunk·次翻转、最大单批 100 chunk（整图重排）**、同批区块去程降 lod/回程升 full；原地小范围晃动 20 次亦触发 100 chunk·次。桌面档 full=8 chunk vs 地图 10×10 chunk——玩家每次跨区块边界都可能触发批量形态翻转=「斑驳出现的块疯狂闪动」。

**根因②（LOD 形态翻转）转 T14 退役处置（用户拍板「放弃这种技术」）**；根因①（无 mip 纹理沸腾）仍待拆双材质实施。

---

## T14 · 距离环 LOD 层退役（用户拍板「放弃这种技术」）

> 标签：`wayfinder:task`（引擎机制退役，用户实机拍板）｜状态：closed（2026-11-07 拍板当日施工完成，主会话 git diff 全量核实收口；实机复验〔雪原/沙漠走动闪动应消失〕与 iPad 内存注并入 T10 总走查）｜blocked-by：无｜blocks：无

### Question

用户实机反馈「雪地/沙漠斑驳块走动时疯狂闪动」（T13 排查，双根因）。根因②=距离环形态翻转（探针 v5 实锤：沙漠图北缘→南缘往返 **158 chunk·次翻转、最大单批 100 chunk 整图重排**；原地晃动 20 次亦 100 chunk·次；树冠/雪盖在 LOD 纯色裙边大墙与 full 纹理间批量切换=「斑驳出现的块」）。用户拍板原文：**「如果你为了边界交互处好看用了什么特殊技术的话，我建议放弃这种方式，看起来体验不好，可能对性能影响也大」**。

### Resolution

（2026-11-07 拍板采纳，派工实施）

**澄清记录**：距离环 LOD（近实远虚 chunk 流送）非为世界边界观感而设——系引擎建场即有的性能机制（docs/chunk-streaming-lod-research.md，立项动机含 iPad5 内存压力，docs/ipad5-performance-design.md §7）。但本游戏地图定型为 160×160（10×10 chunk）：桌面档 full 环=8 chunk **几乎覆盖全图**，LOD 层收益趋零（仅玩家贴边时对侧半图降 lod），代价（形态批量翻转闪动+树冠裙边纯色大墙观感冲击）真实。用户拍板成立：**全局退役 LOD 层，全图全细节常驻**。

**实施范围**（subagent 施工，git diff 为准）：
- js/world.js：`lodMeshes`/`desiredState`/`maintainRings` 形态机/`mountChunkLod`/serveChunkKey 的 kind 分支退役；meshGen/token 防陈旧响应机制**保留**（编辑重建仍走 Worker）；rebuildAll 渐进铺满保留（初始装载 amortized）。
- js/mesh-worker.js：kind=lod 协议分支退役。
- js/mesh-core.js：`meshChunkLod` 删除（T9 先例：机制不存在即无覆盖对象）。
- js/config.js：`VIEW.lodStep`/`lodChunks`/`fullChunks`（若无消费方）与 `IS_LOWCORE_TOUCH` 环半径分档退役；**VIEW 其余字段（fog/far 等）禁碰**。
- 测试面：world-rings.test.js（「距离环」语义→「全图常驻」或随机制删）、mesh-worker.test.js lod 协议断言删、画质降档环联动断言删。
- 文档：GLOSSARY「距离环」词条改写、ipad5-performance-design.md 修订登记、本票 Resolution、map.md。
- 门禁：npm test 全量绿 + lint 零错 + T7_PERF=1 过。

**风险登记（复验注）**：iPad5（A9 低核）全图全细节常驻 GPU 内存上升——LOD 立项动机即此；预期量级数十 MB 可承受，但需 **iPad 实机复验**（初始装载铺满时长+帧率），并入 T10 走查清单。

**红线**：T13 双材质修复（无 mip 纹理沸腾）不在本票掺和；config B_* 方块段禁碰；确定性红线不动。

**施工结果（2026-11-07 拍板当日完成，主会话 git diff 全量核实）**：
- 10 文件 M、净 -231 行：world.js 形态机（lodMeshes/desiredState/maintainRings/mountChunkLod/serveChunkKey kind 分支/『none』惰性丢弃）全拆，**meshGen+token 防陈旧响应与 rebuildAll 渐进铺满保留**；mesh-worker kind 协议字段（请求+响应）整体删除（留死字段正是本票要退役的东西），恒走 meshChunk；mesh-core `meshChunkLod` 删 + **pushQuad 孤儿一并删**（grep 证实 LOD 独占）；config VIEW 三参数与 IS_LOWCORE_TOUCH 环分档退役（**本体保留**——world.js DPR 分档与 perf-kit 仍消费）；ringCenter/ringQueue→distCenter/fillQueue 改名（「环」随退役消失）。
- 测试面：world-rings.test.js 语义改写（全图 100 区块驻留/走远零翻转/**VIEW 三参数 undefined 防复活钉**+低核与桌面 VIEW 键集一致），mesh-worker 协议锁同步，mesh-core LOD 四测删（T9 先例），vertexlight 注释同步。
- 文档：GLOSSARY「距离环」词条退役改写（_Avoid_ 挂旧名与死参数，「复活须先立票」）+「场景装填」「网格化核心」两词条同步；ipad5-performance-design.md §7 修订登记（立项动机→拍板退役+内存预期数十 MB+iPad 复验归 T10）。
- 收口清理（主会话）：config.js B_PORTAL/物品段两处「LOD 降采样跳过 thin」过时告诫改退役注记——施工时红线禁碰、收口时解禁，纯注释行为零变化。
- 门禁：npm test **1715 tests / 1714 pass / 0 fail / 1 skip**（T7_PERF env 门控，常态）+ `T7_PERF=1` 定向过 + lint 零错。
- 留置拍板：world-rings.test.js **文件名不改**（rings 成历史词，GLOSSARY _Avoid_ 已登记；改名牵连 world.js 注释与 GLOSSARY 引用点，不值）。历史调研/计划文档（chunk-streaming-lod-research.md 等）保留原文。

---

## T10 · 验收收尾

> 标签：`wayfinder:task`（HITL）｜状态：open｜blocked-by：T13 T14｜blocks：无（图终点）

### Question

`npm test` + `npm run lint` 全绿；用户实机走查四方向：三向各走一遍「过渡→（解锁态）越线传送→到达回程门旁→回程门站桩回家」与「未解锁态屏障+话术」，东向走到栅栏收尾；新术语入 GLOSSARY.md；地图 Decisions so far 补齐，目的地达成。
`T7_PERF=1 npm test` 性能钉测（T7 P6 交付：env 门控，带建场增量倍率与全量防呆线钉死）。

### Resolution

（待解）
