# T-C13-R · R-7 裁量回执 — 黑区修复定谳 + lowcore 相位窗 + fx 场格滞留定位

> 产出：architect（2026-11-23）。输入：派令（H/C 裁量+黑区方案+拆解+ADR 建议，加带一 lowcore 相位窗并车、加带二 143 顶点 mesh 根因定位）、design-lead 归因报告 `.scratch/campfire/tc13r-review/black-region-attribution.md`、probe-light.js/json 实测。
> 票面已追加至 `tc13r-tickets.md`（R-7 节）；本回执是票面的证据链与裁量依据全文。
> 纪律：本席只读代码零改动；行号均按当前工作树复核（R-1~R-6 施工后已漂移，引用以本文为准）。

## 0. 结论速览

| 项 | 裁定 | 一句话 |
|---|---|---|
| 黑区 H/C | **H2 采纳（偏离 design-lead 草案，显式标注 §1.2）** | 光挡光谓词一处加 `¬thin`，双通道同改；C 否决（引擎语义不成立+大面积回归） |
| 加带一 lowcore 相位窗 | **一行修，并车 R-7** | fx-core:144 周期未乘 fsEff；红测「lowcore 帧覆盖=3」 |
| 加带二 143 顶点 mesh | **双层定性：观测层非泄漏免修；保留层真 bug 小修并车 R-7** | 「1→5」=瞬态池摆位残留；真 bug=浇熄格永不回收（≈37 mesh/位址滞留） |
| ADR | **建议 0021**（光挡光谓词 thin 例外与视线谓词分叉） | 随 R-7 票入册 |
| R-7 票面 | 三修并车同门槛闭 | 验收=观感三判据+lowcore 覆盖复测+泄漏清零断言 |

---

## 1. 熄态黑区 H/C 裁量定谳

### 1.1 C 否决（引擎语义不成立，非偏好）

C 案（归因报告 §3）：四通道面光采样对 `nb.thin` 邻格改取**自身格**光。否决两层：

1. **修不动病灶**。病灶链是「墙面采样到熄态篝火格（挡光格）恒 0」（归因报告 §2）。挡光判定 `opaque = solid ∧ ¬glass`（light-core.js:37-41），81/82 `solid:true`（config.js:544-545）→ 熄态格双通道恒 0（skyCompute 直灌遇 opaque 即 break 不写，light-core.js:84-94；bfsIncrease 邻格 opaque 即 skip，:64；block 无源=0）。而 C 改取的**自身格**（沙墙/横梁/地面）同样是 solid 挡光格，同样恒 0——**把采样从一个 0 格挪到另一个 0 格**，黑框原样。
2. **大面积回归**。C 作用于**所有** thin 邻格面：植物/火把/作物族是 `solid:false ∧ thin`（config.js:328-353），其格**非挡光、有真实光值**（火把格 block 14 等）；实心方块面改取自身格后=挡光恒 0 → 草地贴植物面、贴火把面全黑（黑斑式回归）。门额牌 T4 恰是从「取自身格」返工到「取面邻格」的既判先例（ADR 0012：自身格恒 0=整扇黑病根）——C 等于把 T4 病根反向铺开全表。

### 1.2 H 采纳并升格 H2 —— **偏离 design-lead 草案，显式标注**

- design-lead 草案 H（归因报告 §3）：**仅 sky 通道**对 campfire 格豁免挡光，「block 通道照旧（燃 15/熄 0）」。
- 本席裁定 **H2**：单谓词双通道——`opaque = solid ∧ ¬glass ∧ ¬thin`（light-core.js:37-41 **一处**）。

升格理由（why：机制+语义+教义，非偏好）：

1. **机制**：两通道 BFS 共用 `bfsIncrease` 与同一 policy 对象（light-core.js:49-75/:109/:131）；装配点唯一（world.js:626 `LIGHT_POLICY`，computeAll world.js:580 与 updateEdit world.js:641 同一实例）。拆双通道谓词=每个调用点分轨+「增量===全量」不变量面（light-core.test.js:251 随机 50 步）双倍重验——光引擎最重测试区无谓 churn。
2. **语义**：sky-only 留夜间接缝——熄态格 block 仍恒 0；夜间近火把时邻格 block≥1 而熄态格 0 → 采熄态格的面（邻墙/火下地面）在夜间以暗差形式残留黑框（「光晕翻黑框」判据的夜间变体）。H2 双通道让熄态格全时跟随环境光，接缝全消。
3. **教义对齐**：light-core.js:11-12 头注自述「玻璃/水/薄块/十字片全透光不衰减」——现行代码在 `solid∧thin` 组合上**违背自述教义**；H2=代码归位。现行全表 `solid∧thin` 仅三 id：81/82/门额牌 80（config.js:527/:544-545；归因报告 §2.1 同结论），其余 thin 一律 solid:false（config.js:310 旧纪律注记）。

> **偏离声明**：H2 与草案差异=block 通道不再对熄态格恒 0（改随环境 BFS；燃态 15 源语义不变）。观感验收仍以归因报告 §3 三判据（含夜间面）为准；若 design-lead 对熄态格 block 恒 0 另有语义期待，**须在 R-7 开工前回示**，否则按 H2 施工。

### 1.3 H2 精确改动面（红→绿次序）

1. js/light-core.js:37-41 `opaque` 加 `&& !b.thin`（一行）；头注 :11-12 挡光规则句更新；:32「opaque 镜像 voxel.js isOpaque」镜像声明改写为「光挡光与视线遮挡（isOpaque）在 solid∧thin 上**刻意分叉**」。
2. test/light-core.test.js:63 mkPolicy 测试**红先**：新增 `opaque(80)===false`、`opaque(81)===false`、`opaque(82)===false`（solid∧thin 透光族），标题公式「实心且非玻璃」→「实心且非玻璃且非薄块」。既有 :70-77 断言全保绿（solid:false thin 族两向皆 false；:71/:72/:77 实心非 thin 不动）。
3. 不变量自动成立：增量===全量（:251）与增源随机编辑（:203+）共用 mkPolicy，谓词单一来源，无需改断言。
4. **不改清单**：voxel.js:88-92 `isOpaque`（相机防穿墙 camera-rig.js:70 + 怪物 LOS adventure.js:753/adventure-core.js:2806 消费——篝火物理实心 spec §3.4，视线/拾取照挡照检）；mesh-core 六处面邻格采样（:307/:348/:494/:578/:608/:639）；pushCampfireParts 采样口径（:162-190，ADR 0012 T4 同构维持）；config 81/82/80 方块行零动（light 15/0 数据驱动字段原样；燃态自亮+照常播种 BFS 的语义在 H2 下不变——computeAll 光源格无条件入队 light-core.js:123-131，opaque 过滤只作用于邻格 :64）。

### 1.4 H2 连带效应清单（验收对账面）

- **修复面**：熄态邻墙面（面邻格采样取熄格 → sky 15 点亮）；火下地面 4 顶点（归因报告 §2 表证矛盾节/probe-light.json darkAt 四点）；门额牌横梁朝下面同款潜伏面顺带修（归因报告 §3 C 行表述）。
- **光场变化面**：熄态格（82）sky 0→15、block 0→环境 BFS 值；燃态格（81）sky 0→15（部件面采样邻格口径不变，观感无差）；直灌带穿透篝火格下探一格（贴地场景止于地面块）；block BFS 可经篝火格传导（如格后火把照到格前，方向性变亮，正确向）。
- **玩法读者登记（唯一）**：adventure.js:1253-1258 `advNightRead`（夜刷怪落点光查询，groundTop+1 读双通道）——篝火柱位/邻位 sky 抬升 → 夜间刷怪 eligibility 微收紧（篝火旁更不刷怪，MC 同惯）。语义改善方向，但属**玩法可见变更**：票内申报+PO 走查项。
- **存档/重放零波及**：光场纯派生不落盘（light-core.js:112-114 头注差异#14；voxel.js:52 装场 fill(0) 归零重算）。
- **放置/挖除路径**：增源（0→81）照旧；熄格挖除（82→0）无「挖开」分支需求（旧格已透光，光流无变化，updateEdit 挖开分支 :205 条件自然不触发）；quench（81→82）撤光分支照旧（「旧格是光源」条件 :201-204 命中，与火把移除同径——probe ④ torchRemoved 已证通用撤光干净）。
- **性能**：谓词多一次属性读；熄格入 BFS 传导（+2 格/火量级）；skyRegion 半径与列扫不变。同构。
- **注记刷新（非断言）**：world-integrity.test.js:95-96「与 mkPolicy 同判据独立实现」→ 改述刻意分叉；texture-atlas.test.js:661/:1702 夹具注记「挡光格恒 0」前提刷新——**断言本身保持绿**（mkPackL 手注入光值不跑真引擎，:665-668/:1712-1719）。

---

## 2. 加带一：lowcore 相位窗修复（并车 R-7）

- **根因（实锤）**：campfire-fx-core.js:144 `const period = fp.frames * fp.frameS`——翻页周期取**基值**，未随 :143 `fsEff`（低核 ×lowMul=2，参数行 :109）放大。相位偏移 `phase·T` 跨度 [0, 3×0.15s)=0.45s，而低核步长 fsEff=0.3s → 相位散布只落 ≤2 个帧号档——「帧率减半」降档被放大成「翻页冻结」，超出降档授权（派令裁定语义）。:134-135 注记把错误不变量写进了教义（「T=frames·frameS 翻页周期」）。
- **修法**：:144 改 `const period = fp.frames * fsEff;`，:134 注记同步「T=frames·fs_eff（相位 [0,1) 恰铺满一整圈帧）」。桌面档 fsEff 含 tint 渐弱因子，period 随之逐火微变——这正是「相位铺满整圈」的正确数学；R-6 基准 5 测的桌面档错相断言复跑应保持绿。
- **红先红（fx-core 单元面）**：新结构断言「lowcore 多时刻帧覆盖=3」——mk lowcore 实例、N 火（异 seed 相位散布）、多时刻采样 `flameFrameAt`，断言 3 帧全出现；现行代码覆盖 ≤2 → 红。
- **验收**：R-6 基准套件错相面补 **lowcore 档复测**（原 5 测跑桌面档）——同双口径装具改档重跑，覆盖=3 归 R-7 收口。

---

## 3. 加带二：143 顶点 mesh 定位（双层定性，小修并车 R-7）

### 3.1 观测层「1→5」= 瞬态池摆位残留，**非新建非泄漏，免修**

- **143 顶点对号**：effects.js:33 `popGeo = new THREE.SphereGeometry(1, 12, 10)` = (12+1)×(10+1) = **143 顶点**；场格瞬态池**固定 10 个 popGeo mesh**（effects.js:256-259，建格一次分配；boltBox 24 顶点族是柱/火苗/烟/旋涡，另计）。
- **「1→5」机制**：点燃瞬态=1 pop（fx-core:208-209）→ 1 池槽摆位篝火旁；quench 瞬态集=**1 pop+4 steam**（fx-core:232-239）→ **5 池槽**摆位；散尽后 `syncFieldTrans` 只 `visible=false` 不复位位置（effects.js:282-284）→ design-lead 探针按 bbox 清点缺光属性 mesh（probe-light.js:54-58 口径）数出 5。零分配增长、零渲染开销（不可见）、上限 10/格——归因报告 §5「1 变 5」全文解释毕。**免修**（探针读数口径注记可选项，不动代码）。
- 排除：design-lead 报告「体验馆自带装饰 or campfire fx 残留」二选一——定为后者（场格瞬态池），前者（21 个 n:24 恒在 mesh）与其初判一致不追。

### 3.2 保留层（真 bug，修）：浇熄格永不回收

- **根因链**（全带现行行号）：
  1. `quench()` 只置 `open=false` 清发射器换瞬态（fx-core:224-240），**不删格**——对比 `dig()` 即刻删（:267-271）、`burnout()` 走余韵期满回收（:245-263 + 回收门 :405-408）。
  2. 回收门只认 `burnoutAt !== undefined`（:405-408）；查询面过滤同款（cellsList :435 只滤燃尽余韵期满格）。浇熄格 `burnoutAt === undefined` → **永不回收、永在 cells() 清单**。
  3. `dig()` 对非 open 格早退（:269 `if (!c || !c.open) return;`）→ **挖掉熄灭篝火（82）也不回收**（第二路径实锤）。
  4. effects `stepFields` 按 `fx.cells()` 的 live 集保 Group（effects.js:481-528）→ 每个浇熄过的篝火位址保留整套场格 Group（1 柱+12 火苗+12 烟+旋涡 count+10 瞬态 ≈**37 mesh+37 材质**，effects.js:233-262），直至模式切换/读档 `Fx.clear`（fx-core:274-276）。冒险模式 82 是常驻世界块——**逐熄火位址累积的慢性无界滞留**。
- **排除项**（对派令候选方向逐一关账）：R-5 幂等重挂路径无责——open() 对已闭格 `cellsMap.set` 覆盖旧格（:200-220），effects 同 key 复用 st，同址循环零累积；R-4 sheet 句柄无责——成员只认 open 格（effects.js:454-463），熄格即摘；mkFieldCell/mkFieldItem 状态切换重建路径无责——重建由 cells() 驱动，病灶在 cells() 不吐回熄格；fx.clear 与重挂时序无责——clear 全清无残留。**病灶单一：回收门谓词不完备。**
- **修法**（fx-core 内 ~3 行+注记，**粒子参数零触碰**）：
  1. `quench()` 置 `c.quenchAt = now`（时间戳标记）。
  2. 回收门 :405-408 扩展：`const closedAt = c.burnoutAt !== undefined ? c.burnoutAt : c.quenchAt;` 条件改 `!c.open && closedAt !== undefined && now - closedAt >= BURN_FLAME_S(0.4s, :99) && 四数组空` → 删格。浇熄路径 flame/smoke/vortex 已即清（:228-230），瞬态 ≤0.8s 主导等待 → 实际回收 ≈0.8~0.9s。
  3. cellsList :435 过滤镜像扩展（燃尽余韵过滤同款对称：`closedAt` 期满即从查询面退场）。
  4. `dig()` **不动**——五纪律测试 :365-384「渐熄中再 dig 不取消尾巴」语义保留；熄格 0.8s 窗口内被挖的残余由回收门兜底。
- **测试锁核实**：campfire-fx-core.test.js:341-363（浇熄过渡形状/白汽 0.8s 散尽）**未锁熄格滞留语义**；:388+（句柄五纪律/clear/悬空）未涉 cellsList 滞留——新红测无既有锁冲突。grep 全测面无 `.cells(` 直接断言。
- **并车判定**：与加带一**同文件（campfire-fx-core.js）、同测试套、生命周期-only**——并车 R-7。票面申明「通用回收分支条件扩展、粒子参数不动」（烟零改动红线续任）。

---

## 4. R-7 票面

已追加至 `tc13r-tickets.md` R-7 节（三修并车：H2+lowcore+熄格回收；红先红三条；验收=观感三判据+lowcore 覆盖复测+泄漏清零断言）。派工备注补第 5 条（偏离声明回示口）。

## 5. ADR 建议（不可逆决策，随 R-7 票入册）

**ADR-0021（建议号）：光挡光谓词 thin 例外——光挡光与视线遮挡分叉**

- **背景**：熄态黑框归因链（归因报告 §2）+门额牌 T4 先例（ADR 0012「挡光格自身格恒 0」）+头注教义与代码在 solid∧thin 上的分叉（light-core.js:11-12 vs :37-41）。
- **决策**：`opaque = solid ∧ ¬glass ∧ ¬thin` 单谓词双通道（H2）；视线/拾取谓词 isOpaque（voxel.js:88-92）**不分叉**——solid∧thin 物理实心（spec §3.4），挡视线不挡光。
- **不可逆性论证**：光场技术可逆（纯派生可全量重算，voxel.js:52）；但「熄态格透光」进入 PO 走查记忆与后续设计引用后，回退=观感回归+教义再分叉。镜像是**文档级分叉**：light-core.js:32 头注、voxel.js:87 注记、world-integrity.test.js:95-96 注记三处同步（断言零改）。
- **后果**：连带效应全表见本回执 §1.4；受影响块全集=81/82/80 三 id（数据驱动：新增 solid∧thin 块自动继承）。
- 次要：fx-core 回收门扩展（§3.2）为生命周期语义补全，无跨模块契约变更，**不升 ADR**，票内注记即可。

## 6. 风险清单（逐测试面对象）

| 测试面 | 断言内容 | H2 | 加带一 | 加带二 | 处置 |
|---|---|---|---|---|---|
| light-core.test.js:63-77 | mkPolicy opaque 判据 | **预期红**（新断言 80/81/82 false+标题公式） | — | — | 翻新（红先红①） |
| light-core.test.js:203/:251 | 增源/随机 50 步增量===全量 | 自动绿（共用谓词） | — | — | 复跑对账 |
| world-integrity.test.js:97-127 | scanLightViolations（独立判据，只查挡光块**以上**） | 绿（直灌带只扩不缩） | — | — | :95-96 注记刷新 |
| texture-atlas.test.js:659-678/:1701+ | T4/SPEC-1 面邻格采样（mkPackL 注入光值） | 绿（不跑真引擎） | — | — | :661/:1702 注记刷新 |
| campfire-fx-core.test.js:341-363 | 浇熄过渡形状/0.8s 散尽 | — | 绿 | 绿（未锁滞留） | 既有锁保全 |
| campfire-fx-core.test.js（新增） | — | — | **红**（lowcore 覆盖=3） | **红**（熄格回收+重燃） | 红先红②③ |
| campfire-fx-core.test.js:365-384 | dig 五纪律 | — | — | 绿（dig 不动） | 保全 |
| effects-campfire-sheet.test.js | R-4 sheet 成员/翻页 | 绿（open-only 口径） | 复跑（桌面档帧号数学） | 绿（sheet 与回收无涉） | 复跑守门 |
| campfire-bench(.test).js / tc13r-c6 套件 | R-6 基准 5 测 | — | **lowcore 档复测归 R-7**（桌面档保持绿） | — | 验收③ |
| adventure-core.test.js:1563-1581 | LOS（注入式 opaque） | 零影响（独立装配） | — | — | 复跑 |
| mesh-core.test.js:516 | 关门自身格恒 0（非 thin） | 绿（door 非 thin） | — | — | 复跑 |
| campfire-kit.test.js:81-82 | thin 0.4375 锚 | 绿（config 零动） | — | — | 红线在职证明 |
| boot.test.js / conventions.test.js | 全链冒烟+规范门禁 | 复跑 | 复跑 | 复跑 | 收尾三连 |

## 7. 证据索引（本回执引用面）

- js/light-core.js:11-12/:32/:37-41/:49-75/:84-94/:112-131/:199-208 · js/voxel.js:52/:88-92 · js/world.js:580/:623-641 · js/config.js:310/:527/:544-545 · js/mesh-core.js:162-190/:307/:348/:494/:578/:608/:639 · js/campfire-fx-core.js:95-109/:134-145/:200-240/:245-276/:405-408/:431-438/:479-482 · js/effects.js:33/:226-262/:278-298/:448-469/:471-528 · js/modes/adventure.js:753/:1253-1258 · js/adventure-core.js:2806 · js/camera-rig.js:70
- test/light-core.test.js:63-77/:203/:251 · test/world-integrity.test.js:95-127 · test/texture-atlas.test.js:659-678/:1701-1724 · test/campfire-fx-core.test.js:341-363/:365-384/:388+ · test/adventure-core.test.js:1563-1581 · test/campfire-kit.test.js:81-82
- docs/adr/0012-gate-sign-t4-light-neighbor-sampling.md · docs/design/campfire-visual-spec.md §4.4/§4.5 · .scratch/campfire/tc13r-review/black-region-attribution.md §2/§3/§5 · probe-light.js:43-72/:74-174
