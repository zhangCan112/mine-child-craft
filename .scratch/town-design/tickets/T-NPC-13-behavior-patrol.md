# T-NPC-13 行为层票（G01 阿稳巡逻环 legIndex 推进者 + 本体位姿跟随 + idle/走动动画选型）

> 波次：**三（建议 villager-wave3，立票不排期；排在工程线案卷修复收口之后）**
> blocking edges：**PO 方案点拍板完成**（§7 四点清单）+ **工程线 PO 实屏验收案卷（五条）修复完成**（§8 全列）
> 上游已满足（出处登记，非阻塞）：T-NPC-12 已收口（legById 注入缝 + advTownAnchorTick 消费机在案，2026-11-15 并入集成）· ADR-0011 已落地（镇内装配宿主=adventure 壳 town 分支，形态已定）
> ⚠ **拍板前零施工**：§7 四方案点未拍板前不得动工；README §3.2 裁决二 / §3.3 裁决三不可推翻，方案只在留白面内展开。
> ⚠ **氛围 NPC 不可攻击**：本票全部 NPC 沿用「氛围 NPC 不可攻击、不入 MOB_TYPES」定位，与工程线案卷④（NPC 可拆解）修复口径一致——施工方勿做相反假设。

> **施工留档注记（2026-11-16 批收口）**：PO 拍板四点后开工即停（PO 实拍本批告一段落）——**未动工零 commit**（开工前核查已完成：票 worktree 开设/独立 npm install 非 junction/图谱全量建成/票面·拍板·intake 三件读毕）。断点核查结论（续工参考，红方 ses_e1dd1948affeVvnHyHQLpZ6p6O 会话内核实，未落盘转记）：
> ① 派令线报「G01 木头桩红测现任在库」**核实为伪**——库里只有 T-NPC-12 注入式消费机绿测（adventure-mode.test.js :5121 起）与 po-idle-fix idle 批（town-npc-idle.test.js），无本票红测，续工按「缺则自写」办理；
> ② 两处既有源切片 gate 与本票接线强相关：`town-npc-idle.test.js:698`（钉 `advTownAnchorTick();` 字面在 idle 前）+ `adventure-mode.test.js:5331`（钉该字面在 update 段内）——推进者上链后后者必红，红相内修订并票面登记；
> ③ 装具约束：harness eng 域无 kit/THREE，真实傀儡建不了，傀儡面红测循 idle 先例往账本注假行（`advTownState().puppets` / `advTownIdleState().parts` 引用注入）。
> 续工入口：README 状态列（a2 中止留档）；c2 面等 T-NPC-14 昼夜机制票（ADR-0017，原编号 0012 撞号改号）。

## 1. 目标

G01 铁守护·阿稳的巡逻环活起来 + 全体镇民 NPC 摆脱「木头」静止感：

1. **legIndex 推进者**：把 T-NPC-12 留白的「legIndex 随时间推进」补上——G01 沿四航点闭环慢巡逻，legIndex 到站推进，经既有 `advTownAnchorTick(legById)` 注入缝喂给消费机（重发节奏机器零改动）。
2. **NPC 本体位姿跟随**：傀儡实体（advTownPuppets 的 root/bones）随巡逻进度更新摆放位姿（移动方式=§7-a 方案点）。
3. **idle/走动动画选型落地**：按 §7-b 拍板的动画路径，让 14 实体有 idle 微动作（呼吸/头转/微摆等量级「稍微有点动作」），G01 巡逻时有配套走动表现（若拍板含走摆）。

## 2. 背景与事实底座（含 PO 原话出处）

### 2.1 PO 原话（实屏验收，勿重问）

PO 实屏验收原话（2026-11-15 随 villager-wave2 收口回执 §9 一揽子验收，原话经 scrum 派令转录在案，本票为落档处）：

1. 「**所有的村民 NPC，稍微要有点动作吧。都像木头一样。**」——移动没有走动/idle 表现正是「木头」病灶；**动画与移动并票**的依据（全部实体都指到了，不止 G01）。
2. 「**安稳的巡逻路线票……一起做起来**」——G01 巡逻行为从「未来票」提上日程。

PO 已批的是**改善诉求**；动画选型与移动方式是产品裁决，拍板前零施工（§7）。

### 2.2 事实底座（scrum 立票时核实；施工前复核，不符即停工上报）

- **锚点数据全在**：`js/town-npc-anchor-core.js` TOWN_NPC_ANCHORS 14 行——G01 四航点闭环 `{(66,66)E→(92,66)S→(92,92)W→(66,92)N}`（每腿 26 格轴对齐，face 沿走方向）+ 13 条单航点静态位；`anchorOf(id, legIndex)` 纯取数器（归一取模、静态恒首航点）与 `anchorChanged` 谓词在库。数据表 note 明写「日程化到站语义归行为层」。
- **消费机器全在（T-NPC-12 已收口）**：`advTownAnchorTick(legById, policy='focused')` 消费机在 `js/modes/adventure.js:3091`（update 逐帧接线 :4973）——legIndex 注入式验收：喂 `legById` 映射即按到站跳变重发 targetFocus（恰一条/六键/anchor 三键），生产路径**恒缺省 leg0**。**legIndex 随时间推进的推进者 + NPC 本体位姿跟随，正是本票的核心留白面**（T-NPC-12 §6.6 遗留指针原话）。
- **傀儡摆放现状**：`advTownPuppetsPlace()`（adventure.js:3051）进镇一次静摆 14 实体（恒 leg0 + 站立面 y+1），快照 `{id,look,x,y,z,yaw}` 经 `advTownState().puppets` 透出（T-SEAM-04 观测缝）；离镇 `advTownPuppetsLeave()` 清场。**无任何随时间更新路径**——这就是「木头」的直接病灶。
- **骨骼面现成**：`mkTownNpcPuppet(id)` 恰四键 `{root, bones, look, anchorHeight}`，bones 系 `MobLookKit.puppet` 产物**透传不改名**（显隐预留只透传不预造 API）。骨槽词表：村民 illager 基座 `head/body(槽root)/armR/armL/legR/legL` 各带 pivot（旋转关节现成）；G01 自有骨 `head/root/hip/armR/armL/legR/legL/flower`（js/mob-look/town_g01.js，头注明写「**姿态语义(供动画层选型票检索)**: 巡逻(行走摆臂)/献花(_flower) 与中裂 bind」）。**骨骼级动画可经 bones Group 旋转直接驱动，零 kit 改动。**
- **裁决约束（不可推翻）**：
  - 裁决三（README §3.3）：锚点坐标只在**到站跳变**时变化，不逐帧插值刷新——这是锚点/UI 锚/协议 payload 的节奏；**本体渲染移动方式未裁**（到站瞬移 vs 航点间滑行/骨骼位移），正是 §7-a 方案点。
  - 裁决二（README §3.2）：UV 姿态帧选型**后置**，注册表 `expression`（×4 帧元数据）/`postureNote`（姿态语义词）/G01 `crack`/`flower` 数据字段已预留；G01 花盒骨已建（显隐逻辑后置）。本次 PO 拉力即解冻时机——动画路径候选见 §7-b。
- **共享引擎面**：`js/mob-look-kit.js` + mob-look/ 是 49 既有怪共享引擎面，**改动须零漂移**（波次一先例：kit 非方形扩展带 golden 守门，守门件 `test/fixtures/town-npc-golden.json` 面内容摘要）。骨骼路径（b1）经 bones 透传驱动则 kit 冻结面零触碰。
- **小镇维度恒白天**（dayCycle:false，GLOSSARY「小镇维度」）：无可见昼夜循环——十村民日程若入批（§7-c），日程时间轴来源本身是连锁产品决策（抽象时钟/压缩周期/开昼夜）。
- **测试基线**：villager-wave2 收口终值 `npm test` 2158 测 0 红 1 skip + lint 三关零错（本票写「2158 量级零红」，施工时以当值全量为准——案卷修复会先行上浮）。
- **守门面**：镇民链装载序 gate（test/conventions.test.js:210，kit→town_*×14→interact-core→anchor-core→registry→town-npc.js 全链先于消费方；docs/conventions.md §2.1 登记先例「新增多文件链同步扩 gate」）· GLOSSARY 词条确定性断言（test/conventions.test.js:296）· 五值矩阵等接缝守门（test/town-ui.test.js ~:2061）。

## 3. 范围与边界

### 3.1 并票论证（动画与行为为何一张票；默认不拆）

**结论：并为一票。** 三轴论证：

1. **依赖方向**：PO 病灶是「移动没有走动/idle 表现」——动画与移动互为表里。走动动画只有在存在移动（推进者驱动 legIndex）时才有意义；推进者若无动画配套，G01 瞬移或僵直滑行仍读作「木头」。更硬的是**接口互锁**：动画路径拍板（§7-b）直接决定推进者的输出面——骨骼走摆需要腿内进度（0..1 相位）驱动摆臂节拍，而纯 legIndex 整数跳变不够。拆两票会迫使行为票预猜动画接口，blocking edge 横竖存在，拆分只是把一次拍板撕成两次。
2. **产线成本**：两票落在同一缝簇（advTownPuppets* + 推进者 + bones 驱动）、同一测试装具（adventure-mode.test.js 镇民链）、同一零漂移纪律。一票=一轮红绿循环；两票=两轮装具搭建 + adventure.js 热文件两轮接缝翻动（该文件正被工程线案卷修复占用，翻动次数就是冲突面）。
3. **验收面**：终验是实屏观感（「PO 看 G01 巡逻 + 村民不再木头」）——单一验收面。拆分会产生中间态（行为无动画=仍木头），首票无法凭自身条款收口，等于没拆。

**拆分条件（唯一例外，预登记）**：若 PO 拍板 b2（UV 姿态帧），贴图重产是设计工产线（gen 重画+导出器再生成 14 look 文件+golden 重出），可**后置**拆出资产票沿波次一 T-NPC-01/02 谱系走——但那是拍板后的下游拆分，不是本票的前置拆分；本票仍含推进者+位姿跟随+已拍板路径的动画接线。

### 3.2 硬边界（红线清单）

- 不推翻裁决二/三；方案只在留白面（本体渲染移动方式 / 动画路径 / 日程批内范围 / 表现范围）展开。
- **不开通用动画系统**（GLOSSARY「旋转核心」_Avoid_ 先例：SpinnerCore 连第二件旋转体都须再过 PO）——本票行为/动画面只服务镇民 14 实体，不建通用注册面/缓动库/插值框架。
- mob-look-kit 与 mob-look/ 既有档案：骨骼路径下零改动；任何 kit 改动须走 seamfix 判例申报制（见 §4.3）。
- 锚点/协议面零语义改动：`anchorOf`/`anchorChanged`/`advTownAnchorTick` 重发语义、TOWN_UI_EVENTS 四名表、townTargetOf 六键、TOWN_NPC_ANCHORS 14 行数据（除非拍板 c2 且其扩表面随票获批）。
- 氛围 NPC 不可攻击（§头注）；交互语义面（到站/日程对会话的影响）并入本票方案域，不另立交互票——T-NPC-10/11 即交互票，已收口。
- 参数面（巡逻腿时长/到站停驻/微动画幅度频率）走参数表驱动、PO 后验可调（T-NPC-11 §3「B1-B8 默认值 PO 可后验推翻」先例），不逐参数拍板。

## 4. 文件域（README §6 规约逐条回应）

### 4.1 §6 固定问句（债 3）：「本票是否有生成器/导出器会再生成既有产物？有则列入文件域」

- **基线域（b1 骨骼路径拍板时的答案）：无。** 推进者/位姿/动画全走新文件与装配接线，不触碰 gen 导出链，`test/fixtures/town-npc-golden.json` 零漂移（骨骼旋转不触贴图，golden 是面内容摘要）。
- **拍板 b2（UV 姿态帧）时的答案：有，且必须列入。** `gen-export-look.js` 再生成将触碰既有产物 `js/mob-look/town_*.js` ×14 + `test/fixtures/town-npc-golden.json` 全量重出（golden 再生成纪律：按面内容对账，T-NPC-01 §3.1 先例）；gen 侧画稿改 `.scratch/town-design/gen/`（不入库——eslint ignores 不含 .scratch，勿提交）。**拍板若选 b2，本节文件域自动扩列上两项 + 设计工派工单（姿态帧画稿），开工前由红方修订票面登记。**
- **拍板 c2（日程入批）时的答案：无再生成面，但有数据表扩改。** 13 条单航点行扩多航点将触碰 `js/town-npc-anchor-core.js` 数据表 + `test/town-npc-anchor-core.test.js`（同名单测）+ 站位对账测试（21 锚↔TOWN_MAP.anchors）——同样开工前红方修订登记。**【c2 扩列登记（2026-11-17 红方，开工前落定）】扩改面八项：① `js/town-npc-anchor-core.js` 13 村民行 waypoints 扩日程航点序列（2~5 航点，首航点=工作位=TOWN_MAP.anchors 布局行恒不动——升格对账零漂移；G01 行零触碰）；② `test/town-npc-anchor-core.test.js` 同名单测扩列+翻钉（③拓扑「静态行恰单航点」翻「日程行航点序列 2~5」、⑪取数器静态锚例翻日程锚取模、⑨巡逻可走扩全部多航点锚全腿段、新语义窗=聚集点∈hub 带/家位∈西·南生活带）；③ 站位对账（②节 21 锚升格断言）零改——首航点不动即布局权威零漂移，⑥⑦⑧避让/贴地/可达域全航点遍历自动纳入新航点；④ `js/town-npc-behavior-core.js` 日程面（段表 TOWN_SCHEDULE_PLANS+参数表 TOWN_NPC_SCHEDULE+日程状态机族，导出面五名→恰十二名）与同名单测扩列；⑤ `js/modes/adventure.js` 镇民段日程消费（建账/摆放/分流），`test/adventure-mode.test.js` 端到端扩列+「静态 13 键零重发」翻钉；⑥ `test/boot.test.js` 摆放对账白天零漂移不翻钉（装具 dayTime=0=day 段恒首航点）；⑦ conventions gate 零扩列（零新文件，behavior-core 已在链）；⑧ GLOSSARY 回写随收口评估（§4.4）。数据终版=红方探针验证器全过（13 村民日程航点表+可走路段+节奏核算），登记见 §11.7。**

### 4.2 基线文件域（按拍板 b1+c1 即「G01 先行 + 骨骼微动画」口径枚举；其余口径按 §4.1 扩列）

| 文件 | 动作 | 说明 |
|---|---|---|
| `js/town-npc-behavior-core.js` | 新（建议名，红方可裁） | 推进者纯核心：巡逻计时/到站推进/位姿派生纯函数，dt 注入零墙钟（SpinnerCore.tickSpinners(dt) 先例）；同名单测必配（-core 契约）。**不扩 anchor-core**——其头注纪律「不做时间推进，消费与重发节奏归装配层」在案，时间推进是新词汇域 |
| `test/town-npc-behavior-core.test.js` | 新 | 同名单测（可执行规格） |
| `js/modes/adventure.js` | 改 | 壳装配：update 每帧喂 dt→推进→legById 注入 advTownAnchorTick→本体位姿/动画应用（挂点扩键透出）；与 advTownAnchorTick 同节拍。**热文件：排在工程线案卷修复之后施工即为此** |
| `index.html` | 改 | 新 core 文件 script 挂载（镇民链内位序，boot 冒烟自动覆盖——T-NPC-10 备忘③口径） |
| `test/conventions.test.js` | 改 | 镇民链装载序 gate 扩列新文件（:210 先例；数据跟随，非新约定） |
| `test/adventure-mode.test.js` | 改 | 新节红测：推进接线/位姿跟随/动画源守门 + 装具镜像链序（T-NPC-12 §6.1.6 先例） |
| 本票面 + `tickets/README.md` | 改 | 施工记录回填 + 台账状态列 |

### 4.2.1 c2 口径文件域扩列（2026-11-17 红方登记；基线表= b1+c1 已收口口径 §11.5，c2 面按下表施工）

| 文件 | 动作 | 说明 |
|---|---|---|
| `js/town-npc-anchor-core.js` | 改 | 13 村民行 waypoints 扩日程航点序列（工作位→[途经拐点]→聚集点→家；G01 行零触碰）；头注 interface 随扩形改真（「静态站位=单航点」→「村民锚=日程航点序列」） |
| `test/town-npc-anchor-core.test.js` | 改 | 同名单测扩列+翻钉（§4.1-② 四处；21 锚升格对账断言零改） |
| `js/town-npc-behavior-core.js` | 改 | 日程面追加：TOWN_NPC_SCHEDULE（参数表）· TOWN_SCHEDULE_PLANS（13 村民段表数据）· townScheduleState/Step/Pose/LegById/LegOf 五函数（导出面恰十二名）；巡逻五名与 G01 行为零触碰 |
| `test/town-npc-behavior-core.test.js` | 改 | 日程节扩列（段表对账/纯函数/状态机/位姿/legById/节奏可观察）+「导出面恰五名」翻「恰十二名」 |
| `js/modes/adventure.js` | 改 | 镇民段日程消费：建账按段表分流（日程锚走日程机/G01 走巡逻机）、摆放与建账带日程初始 leg（白天零漂移）、update 注入 dayTime 读数 |
| `test/adventure-mode.test.js` | 改 | 日程端到端扩列（白昼在岗/傍晚聚集/夜间归家/清晨回岗+legById 注入缝重发零漂移+夜间进镇摆放）+「静态站位 13 键零重发」翻钉 |
| 本票面 + `tickets/README.md` | 改 | §11.7 c2 施工记录回填 + 台账状态列 |
| `index.html` / `test/conventions.test.js` | 零改 | 零新文件（日程面入既有 behavior-core/镇民链），gate 零扩列 |

### 4.3 共享面与申报制

- **mob-look-kit 零漂移约束**：骨骼路径下 kit 冻结面零改动（bones 透传即驱动缝，mkTownNpcPuppet 头注「显隐预留只透传不预造 API」在案）；golden 守门件 `test/fixtures/town-npc-golden.json` 在 b1 下**必须逐字节不变**（验收硬条款）。
- **seamfix 判例申报制（援引）**：若施工中确需触碰某模块 import/export 面，援引 villager-wave2 收口 §3 判例——「冻结面零改动、导出面可见性一项放行」可在三重约束挤压下获批（ROUTE_BY_KIND 导出实证恰 3 hunk 为先例），**先申报后动手**，红方裁决记录进票面。

### 4.4 规范回写义务（§6 债 5 条款）

- 文件域含守门测试改源（conventions.test.js gate 扩列）→ 自动追加：conventions/GLOSSARY 对应表述回写检查。gate 扩列属既有镇民链 gate 的数据跟随（§2.1 正文已登记原则，正文预计零改动，红方核实后登记）。
- **GLOSSARY 新词条**（「行为层」「legIndex 推进者」「本体位姿跟随」等若随实现定形）：按收录判据（≥2 文件引用）随实现票评估收录，一览 declared 计数同步 + `node --test test/conventions.test.js` 验平——T-NPC-12 §6.1.7「GLOSSARY 回写授权（绿方随实现落）」同款。**立票阶段零 GLOSSARY 动作**（模块 interface 未定形，词条按 interface 收词，现在写=预拍接口形状）。

## 5. 接口形状

### 5.1 定死为施工细节的部分（写明理由）

- **legById 快照注入缝：定死，不重开。** 推进者的协议输出 = `{锚id → legIndex}` 整数映射，注入既有 `advTownAnchorTick(legById, policy)` 第一参。理由：该缝是 T-NPC-12 已收口的冻结事实（生产无参=leg0 的行为层预留注释在案），重开=消费机改形=破「零协议增项」纪律；推进者只是让生产路径开始供数。静态 13 锚不进 legById（恒 leg0，零事件零漂移）。
- **推进者纯核心形态：定死方向，签名细节红方裁。** 纯函数 + dt 注入（零墙钟零随机，-core 可测契约）；建议形状 `step(state, dt) → {legById, ...}` 状态机式（SpinnerCore「注册表+tick」两件事先例），到站判定复用 `anchorChanged` 数据基础。**不扩 anchor-core**（§4.2 理由）。
- **G01 巡逻参数：参数表驱动。** 腿时长/到站停驻/朝向过渡等进 core 常量表（PO 后验可调，§3.2）；设计口径「慢速巡逻、停驻望广场、轻微点头」（docs/town-villagers-design.md §5.3）为参数初值依据。「傍晚钟塔停驻」**不入首版**（小镇恒白天，§7-c 连锁决策未裁，票面留指针）。

### 5.2 随拍板定形的部分（不在票内预写死）

- **本体位姿更新通道**：a1（到站瞬移）= 复用 `placeTownNpc` 到站重摆；a2（滑行/骨骼位移）= 逐帧位姿更新路径（root 插值 + yaw 转向 + advTownPuppets 快照同步纪律 + 「HUD 指到站锚、本体在路上」口径写进测试）。两者差异大，拍板后由红方在红测中定形。
- **动画驱动接口**：b1（骨骼微动画）= bones Group 旋转驱动（骨槽词表 §2.2 在案），idle/走摆共用驱动器；b2（UV 姿态帧）= 走 §4.1-b2 再生成产线 + regions 切换驱动。拍板后定形。
- **腿内进度**：仅当拍板含 a2/b1 走摆时，推进者需输出腿内进度（0..1）供位姿插值与摆臂相位——该输出面随拍板启用，纯 legIndex 整数缝不变。

## 6. 验收标准（红绿面）

### 6.1 红（现状即红 + 拍板方案未落即红）

1. **G01 木头桩**：生产路径（不注入测试 legById）下 G01 恒 leg0 静止、advTownPuppets 快照恒进镇初值、bones 恒 bind 姿态——推进者/位姿/动画任一缺席即红（立票日现状，红测先行钉住）。
2. **锚点逐帧插值违反裁决三**：anchorOf 语义、targetFocus 重发节奏（T-NPC-12 十二条）、锚点数据 14 行出现任何逐帧化/插值化改动即红。
3. **golden 漂移**（b1 口径）：`test/fixtures/town-npc-golden.json` 任何非再生成纪律的漂移即红。
4. **既有守门测试破**：2158 量级全量（案卷修复后当值）、镇民链 gate、五值矩阵、lint 三关——任一破即红。

### 6.2 绿（按拍板方案验收）

1. **G01 巡逻环**：按 §7-a 拍板的本体移动方式，G01 沿四航点闭环巡逻；legIndex 到站推进经 legById 注入缝喂 advTownAnchorTick，重发语义与 T-NPC-12 十二条回归零漂移；静态 13 锚零扰动。
2. **idle/走动表现**：按 §7-b 拍板路径 + §7-d 拍板范围，14 实体（或拍板子集）有 idle 微动作、G01 有配套走动表现；观感终验=PO 实屏（话术锚点：PO 原话①②）。
3. **零漂移面**：mob-look-kit 与 mob-look/ 档案零改动（b1）/按申报制获批清单（例外）；协议四表（sessionKind 五值/townTargetOf 六键/TOWN_UI_EVENTS 四名/DIALOG_EVENTS 三键）零改形。
4. **全量绿**：`npm test` 当值全量 0 红（1 skip 基线常态）+ `npm run lint` 三关零错 + boot 冒烟覆盖新挂载文件。
5. **规范收尾**：§4.4 回写义务兑现（GLOSSARY 评估/断言验平；gate 扩列登记）。

## 7. PO 拍板方案点清单（候选+权衡，不预拍）

### a) 本体移动方式（G01 巡逻的「动」怎么呈现）

| 候选 | 内容 | 权衡 |
|---|---|---|
| a1 到站瞬移 | 本体随到站跳变与锚点同步瞬移（腿间静止） | ✚ 实现最省（复用 placeTownNpc 到站重摆）；本体与锚点恒同位，裁决三节奏完全一致；测试面最小。− 2.7 格傀儡跨 26 格瞬移读作「闪现」，「巡逻」语义不可读；PO 病灶只解一半（会动但不是走），「稍微有点动作」的走动感缺席；6 岁可读性存疑（人在那→人没了→人在别处） |
| a2 航点间滑行/骨骼位移 | 本体沿腿匀速滑行（root 插值+朝向过渡），锚点/协议仍到站跳变（裁决三管锚不管本体） | ✚ 巡逻可读（走动观感），可挂走摆动画，直接回应「木头」病灶；与裁决三无冲突（本体渲染是未裁留白面）。− 需逐帧位姿通道 + advTownPuppets 快照同步纪律；到站前 HUD 标记指当前腿锚而本体在路上（需票面口径：标记=「下一站」语义，到站刷新——对 6 岁反而稳定不抖）；测试面扩（位姿断言+回归） |

### b) 动画路径（idle/走动怎么实现）

| 候选 | 内容 | 权衡 |
|---|---|---|
| b1 骨骼级微动画 | 骨骼 Group 旋转驱动：呼吸（body 微缩放/微沉浮）、头转（head yaw 小幅）、臂/腿微摆（armR/armL/legR/legL pivot 现成）、走摆（a2 时按腿内进度驱动摆臂节拍） | ✚ 骨已透传（mkTownNpcPuppet bones 在案），**零 kit 改动=共享面零漂移**；golden 不动；全 14 实体一套驱动统一覆盖；G01 头注已预留「巡逻(行走摆臂)」姿态语义。− 无表情帧切换（expression 元数据继续后置，与裁决二一致）；表现力受骨骼旋转约束（无肢体形变/无贴图细节变化） |
| b2 UV 姿态帧 | 贴图级姿态帧：gen 重画姿态帧集→导出器再生成 14 look 文件→regions 切换驱动（裁决二预留路径，expression/crack 切换同路） | ✚ 表现力强（表情/姿态细节、挥手/小跳等 postureNote 语义可全兑现）；裁决二预留钩子直接消费。− 产线长（设计工重画 gen+全量再生成+golden 重出，§4.1 债 3 问句直接触发）；每实体帧集×面数成本随实体数涨；对「稍微有点动作」的轻诉求可能过配；首版交付周期数倍于 b1 |
| b1+b2 组合 | b1 先行（本票），b2 后置（expression 帧切换本就在裁决二后置域，可后立票） | ✚ 轻诉求快满足，表现力留升级路；两路径不互斥（骨骼动画与 UV 切换可叠加）。− 动画词汇两套（驱动器+切换器），长期维护面略宽；后置票依赖 PO 再拉力 |

### c) 十村民日程（G01 先行还是日程入批）

| 候选 | 内容 | 权衡 |
|---|---|---|
| c1 G01 先行（日程后置） | 本票只做 G01 巡逻环 + 全员 idle（b1/d 范围内）；十村民静态站位天然成立（T-NPC-12 会师条件 3 口径：日程落地前静态锚即日程） | ✚ 锚点表/对账测试零扩；村民「木头」病灶靠 idle 微动画直接回应（PO 原话「稍微」量级契合）；批面小、风险低、案卷修复后可即开工。− 「热闹祥和」群像（设计 §7.4 姿态错落+小簇组）只到 idle 层级；日程语义（到岗/聚集/休息）后置 |
| c2 十村民日程入批 | 13 条单航点扩多航点日程计划（anchor-core 数据表扩形）+ 日程时钟 | ✚ 群像表现满配（广场聚集/傍晚钟塔等场景语义直接兑现）；「活的小镇」一步到位。− **恒白天维度下日程时间轴本身是连锁产品决策**（抽象时钟孩子看不见动机/压缩周期失真/开昼夜是大改——须先裁）；数据表扩形牵动 21 锚对账+注册表+测试链；产线成本数倍于 c1；PO 诉求「稍微有点动作」未必需要日程满配 |

### d) 动画表现范围（idle 覆盖到哪层）

| 候选 | 内容 | 权衡 |
|---|---|---|
| d1 通用微动画全家桶 | 14 实体统一 idle 驱动：呼吸/头转/臂腿微摆（b1 骨槽通用）+ G01 走摆（若 a2） | ✚ 「所有的村民 NPC 稍微有点动作」逐字满足；一套参数表驱动，PO 后验可调；成本与实体数解耦。− 个体差异弱（同款呼吸同款转头），postureNote 特化语义（挥手/小跳/啄地/伸懒腰/咀嚼）不兑现 |
| d2 含 postureNote 特化姿态 | d1 + 注册表 postureNote 姿态语义逐实体编排（V01 挥手/V10 小跳/A01 啄地/A02 伸懒腰/A03 咀嚼…） | ✚ 观感差异化满配（每个 NPC 有「自己的动作」，设计 §7.4 姿态错落直接兑现）；postureNote 元数据消费闭环。− 每姿态逐实体调参/逐骨编排，成本随姿态数线性涨；部分姿态语义（蹲下喂食/递花）接近裁决二后置域，边界易渗漏；「稍微」量级有超配风险 |

> 磨票补充说明：a×b 有交互（a1 时走摆无意义，b1 的走摆面随之收窄；a2 时 b1 走摆直接配套）；c×d 独立（日程与 idle 范围可分别拍）。PO 可组合拍板（如 a2+b1+c1+d1 为「轻量全活」组合），四点各拍各的亦可。

> **c2 拍板与施工登记（终局口径）**：c2 十村民日程入批已拍（DECISION-RELAY PO 实答，§11 注记）——日程时钟机制连锁随 ADR-0017 昼夜解冻（PO 亲裁③开昼夜）落地（T-NPC-14 已收口）。c2 面施工排期=wave4 主件（本票续工），接口缝=ADR-0017 决策 4 四条（日程=纯函数 f(dayTime)；时段枚举=Daylight.clockPhase 四段零新枚举；细锚点 tick 常量进行为核参数表；时间源=全局 dayTime 单钟禁新钟/缩放/抽象钟）。本表 c1/c2 权衡历史留档不回改。

## 8. blocking edges（全列）

| # | 边 | 性质 | 说明 |
|---|---|---|---|
| 1 | **PO 方案点拍板完成**（§7 a/b/c/d 四点） | 硬边 | 拍板前零施工（PO 已批诉求，方案未裁）；拍板结果回填本票 §5.2/§4.1 后销号 |
| 2 | **工程线 PO 实屏验收案卷（五条）修复完成**（engr-mgr-vw2 同群） | 硬边 | ①对话卡失焦 ②NPC 跨场景残留 ③「像木头」④NPC 可拆解 ⑤对话卡视觉——案卷②④与本票同缝（advTownPuppets* 摆放/清场与攻击面口径），adventure.js/town-ui.js 为其热文件；**本票施工排其后**，避免同文件双线冲突；案卷④修复定义「不可攻击」终局口径，本票 §头注口径以其为准 |
| 3 | T-NPC-12（legById 注入缝 + 消费机） | 已满足（非阻塞） | 2026-11-15 已收口并入集成（villager-wave2 @807555f）；本票为该票 §6.6 遗留指针「legIndex 推进+傀儡行走观感归未来行为层」的承接票 |
| 4 | 入口缝 ADR-0011（装配宿主形态） | 已满足（非阻塞） | 宿主=adventure 壳 town 分支在案；本票装配接线沿其惯例 |

## 9. 波次建议

**villager-wave3**（村民线波次三），排在工程线案卷五条修复收口之后、PO 拍板完成之后。开工顺序建议：拍板回填票面 → 红测先行（§6.1 四面红）→ 绿方施工（core → 装配 → 动画驱动）→ 实屏 PO 验收（话术锚点=原话①②）。若拍板 b2，先与设计工线对齐姿态帧画稿派工（§3.1 拆分条件）。

## 10. 注意事项

1. **ROUTE_BY_KIND 澄清句**（tour 映射，T-NPC-11 seamfix 收口入档）：`ROUTE_BY_KIND={tour:'guide',seek:'seek',help:'help'}`，tour 为**在册显式派发非兜底**；若施工中实测推翻此口径，以源码+测试实证**停工上报**，不得顺手改。
2. 傀儡位姿更新若走 a2，快照账本（advTownPuppets 纯标量行）与 root 实位的一致性是观测缝契约（T-SEAM-04），测试需锁「快照=实位」防漂移。
3. 「HUD 指到站锚、本体在路上」若拍板 a2，此口径写入票面施工记录并在测试注释固化（6 岁可读性论证：标记稳定不抖=裁决三原论证）。
4. 头顶锚高度（anchorHeight）与本票位姿更新正交，勿顺手改（V 系 2.0/G01 2.7 票面权威字面）。
5. 本票不涉 iconkey-decision.md（已回退主仓正本 @3c89723）；两份 RELAY-JOIN-REQUEST.md 残片非规范工件，勿引用。

## 11. 施工记录（红方红相，2026-11-16，红方 ses_e1ca94ba8ffe4r1zOXXSPVLDFM）

> 施工分支 `t-npc-13-patrol`（自 a30f7f6 开设；分支上另有异线随车 commit 00b701a=需求线簿记 ADR-0012（撞号后改号 0017）+T-NPC-14 立票+台账行，非本线产出，本线不触碰、原样保留）。
> 拍板口径（DECISION-RELAY PO 终拍）：**a2 航点间匀速滑行 + b1 动画面收窄为「走摆」**（idle 面已由 po-idle-fix 先行落地，本票勿重做）；**c2 日程面已拆 T-NPC-14 昼夜解冻票**（时钟机制连锁裁决随该票，本票零涉）；d 面同 po-idle-fix 先行落地。本节只登记红相；绿相施工记录由绿方随完工回执回填。

### 11.1 红相落盘清单（§4.2 文件域逐项对账）

| 文件 | 动作 | 内容 |
|---|---|---|
| `test/town-npc-behavior-core.test.js` | 新（15 测） | 推进者核心可执行规格：导出面恰五名+参数表六键字面锁/状态机边界（起步·到站·过冲单过渡·闭环回归）/位姿线性插值/朝向最短弧过渡/legById 键域与序列/纯度（入参零突变+step 恒新对象）/dt 边界（零步恒等·非有限回落·确定性重放）/走摆相位幅度/源文本卫生（零 THREE·DOM·墙钟·随机·定时器） |
| `test/adventure-mode.test.js` | 改（+8 测+装具扩装+1 钉修订） | ①装具：behavior-core 入 eng 链（镜像 index.html：anchor-core→behavior-core→registry）+红期容差双门（existsSync+四函数全名 typeof，bridgeIdleFns 同款口径）；②T-NPC-12 接线钉修订（注记②授权）：升级为「`advTownAnchorTick(带实参)` 供数契约」（零参字面随推进者上链退役）；③新 T-NPC-13 节 8 测：挂点在位+advTownState 恰三键扩形/推进者+位姿木头桩红本体（35s 到站 wp1+leg 0→1+V01 零扰动）/位姿跟随+快照=实位+零写 y/走摆+flower·hip 零触碰+停驻零写四肢/到站事件节奏守门（裁决三：首拍对齐一跳+每腿恰一跳+腿中零事件+anchor 恒精确航点值）/离镇清账+place·leave 源切片/全链端到端真 update 泵/接线钉四站序 |
| `test/town-npc-idle.test.js` | 改（钉修订，注记②明示授权） | 案卷③④源切片钉：零参字面定位改 update 段内定位+实参形态兼容（钉的意图不变=消费机挂点在 update 链内且先于 idle；今绿、绿后仍绿） |
| `test/conventions.test.js` | 改（gate 扩列，§4.2 已列） | 镇民链装载序 gate CHAIN 扩 behavior-core（anchor-core 后、registry 前；数据跟随，§2.1 登记先例）；现红=漏挂归因 |
| `test/boot.test.js` | 改（**偏离登记**，§4.2 域外） | townFiles 18→19 + 链上符号清单 +townPatrolState——与 gate CHAIN 是同链两份枚举，随动防漂移（T-NPC-10 备忘③「boot 冒烟自动覆盖」的清单面兑现；理由同 gate 行「数据跟随，非新约定」） |
| 本票面 | 改 | 本节（§11） |

偏离登记汇总（均基线域外）：`test/town-npc-idle.test.js`（注记②两钉修订授权，其一）· `test/boot.test.js`（数据跟随第二份枚举）。GLOSSARY 本阶段零动作（§4.4 立票口径维持，词条随绿相实现定形后评估）。

### 11.2 红基线自证（全量）

`npm test` 全量（日志 `.scratch/t13-red-full.log` 不入库）：**2292 测 / 2265 过 / 26 红 / 1 skip**（施工前绿底 2269/2268/0/1 核实在案；+15 core +8 adventure 新测）。26 红归因零杂散：

- `town-npc-behavior-core.test.js` 15 红（模块缺席守卫，红因归各测首断言，零装具炸）；
- `adventure-mode.test.js` 9 红（8 新测 + 1 修订钉@:5378「带实参供数契约」）；
- `conventions.test.js` 1 红@:214（index.html 漏挂 behavior-core）；
- `boot.test.js` 1 红@:276（boot 扫描清单漏 behavior-core）。

分片自证轨迹：core 首验文件级装载炸（dims-core 装载期消费 TOWN_MAP）→循 `test/town-npc.test.js:197` 链序补齐后归位 15/15 断言红；idle 钉修订 19/19 绿（中性）；conventions 13 测 12 过 1 红；boot 10 测 9 过 1 红；adventure 245 测 236 过 9 红（既有面零扰动实证）。

### 11.3 红方裁决记录（§5.1「签名细节红方裁」授权，随票面归档；绿方签名与行为以下列为准）

1. **core 导出面恰五名**：`TOWN_NPC_PATROL`（参数表）/`townPatrolState`/`townPatrolStep`/`townPatrolPose`/`townPatrolLegById`。§5.1 建议形状「step(state,dt)→{legById,...}」收窄为状态机式（step 恒返新对象、入参零突变）+legById 独立导出（消费机逐帧取账直用，免拆包）。
2. **推进者=纯时间状态机**：到站判定=t 计时沿；锚点身份判定单源留在消费机 anchorChanged（T-NPC-12 零改动）——不复制重发判定（判据单份红线）。§5.1「到站判定复用 anchorChanged 数据基础」落为：航点读取经 anchorOf 单源，身份判定不复制。
3. **state 平键恰七**：`{anchorId,leg,t,phase,dwellT,yaw,yawFrom}`——leg=当前腿出发航点索引；phase∈'dwell'|'walk'；t=腿内进度 0..1；yaw=最近朝向；yawFrom=起步朝向（过渡插值起点）。
4. **pose 恰七键**：`{x,z,yaw,moving,progress,swingPhase,walkPose}`——零 y 键（y 通道归 idle 呼吸，装配层零写）；walkPose 恰六键同 idle 形，floatY 恒 0。
5. **legById 语义=「HUD 下一站」**（拍板回执原话口径）：`(leg+1)%n`——行走中标记=到站锚（本体在路上），停驻中=下一站；停驻→行走跨界恒值（离站零跳变），仅到站帧变值；键域恰巡逻锚（静态 13 锚不进表=零扰动零事件的数据前提）。§10-3 口径已固化进测试注释。
6. **参数表六键初值**（PO 后验可调，§3.2）：LEG_T=26（26 格≈1 格/秒慢巡逻）/DWELL_T=3/TURN_T=1.2/SWING_HZ=0.9/WALK_ARM_AMP=0.55/WALK_LEG_AMP=0.7——依据 docs/town-villagers-design.md §5.3「慢速巡逻·停驻望广场·稍微有点动作」。
7. **走摆复用 townNpcIdleApply 幂等面**（不开通用动画系统红线）：armL=+armSwing/armR=−armSwing/legL=+legSwing/legR=−legSwing（与 idle 同号约定=左臂右腿同相自然步态）；腿幅>臂幅；摆臂=sin(t·LEG_T·SWING_HZ·2π)·WALK_ARM_AMP。
8. **朝向过渡**：行走前 TURN_T 秒 lerpAngle(yawFrom→townYawOfFace(行进 face)) 最短弧回绕，之后恒行进方向；到站 yaw=行进方向，停驻保持。townYawOfFace 单源 `js/adventure-dims-core.js:527`（north=0/south=π/west=π/2/east=−π/2），核心不桥第二份。
9. **dt 边界**：大 dt 单过渡（到站不连跳两腿）+过冲钳制（进度归零无残留）；dt=0 恒等（新对象同值）；负/非有限 dt 回落零步零炸；同 dt 序列确定性重放。
10. **未知锚 id 抛中文域错**（anchorOf 拼写域同款）。
11. **apply 契约（消费机侧）**：恒写 root.x/z/yaw+快照同步（快照=实位，T-SEAM-04 一致性缝）；仅 moving 帧写四肢——停驻帧零写（idle 接管，通道分账）。
12. **挂点扩形**：`advTownState()` 恰三键 `{targets,puppets,patrol}`（T-SEAM-04 先例扩形）；patrol 账行 `{id,anchorId,root,bones,state}`（root/bones 含 THREE 柄=非纯标量，advTownIdleState().parts 同口径）；place 建/leave 清与 puppets 同节拍。
13. **绿方 update 链四站字面**（接线钉已锁，绿方照落勿改形）：`const advLegById = advTownPatrolTick(dt);` → `advTownAnchorTick(advLegById);` → `advTownNpcIdleTick(dt);` → `advTownPatrolApply();`。
14. **core 挂载位序**：index.html 镇民链 anchor-core 之后、registry 之前（消费 anchor-core+dims-core，恒晚于依赖；gate CHAIN 与 boot 清单已按此扩列）。
15. **红测稳健性策略**：精确值断言用单步大 dt（13/26=0.5 二进制精确零累积误差）；节奏测按「腿变帧集合=事件帧集合+首帧」断言，不钉具体帧号（0.5/26 累加浮点 ±1 帧漂移容忍）。

### 11.4 绿相施工域指针（§4.2 域内，红测已全数钉形）

`js/town-npc-behavior-core.js`（新，签名=§11.3-1/3/4，行为=同名单测逐条）· `js/modes/adventure.js`（接线四站+挂点扩形+place/leave 建清账）· `index.html`（挂载一行）——绿方照钉落实现，**不得改任何测试**；测试争议回红方裁决。

### 11.5 绿相施工记录与红方裁决（2026-11-16，绿相收口）

**绿相交付**（implement-engineer `ses_e1c730625ffelBI35oaR3NV7HP` 施工，中途撞平台限额一次，现场保全后续收口）：commit `0b01586`——三文件域恰边界（core 新 190 行 / adventure.js 接线+挂点+建清账 / index.html 挂载+链注释）；绿方首报 26 红转 24 + 2 红申报「测试侧缺件」待裁决，红方亲验裁决后全绿。

**终值（红方亲验，非转抄）**：`npm test` 2292 测 / 2291 过 / **0 红** / 1 skip；`npm run lint` 三关零错；零漂移三证明（golden 逐字节不变、mob-look-kit 与 mob-look/ 零改动、协议四表+anchor 机零改形——全 diff 关键词扫描 sessionKind/townTargetOf/TOWN_UI_EVENTS/DIALOG_EVENTS/anchorChanged/ROUTE_BY_KIND 零触）；测试文件改动全部出自红方裁决（见下），绿方零改测试。

**红方裁决记录（两条测试缺件，均裁决成立、测试由红方亲修，断言语义零改动）**：

1. **木头桩测观测窗预算错（:5454）**：绿方实证——29s 到站 wp1（精确落 (92,66)）→32s 起步第二腿→35s 实态 walk leg1 z=69，而原测断言 35s 时 dwell@wp1。硬证明：与节奏测（:5539）互斥——节奏测约束停驻 D≈(120−29−78)/3≈4.33s<6s，原 :5454 字面要求 29+D>35 即 D>6s，参数表无解。**裁决**：原测预算错（只算首腿行程、漏算到站后停驻再起步），节奏测与参数表字面为准。修法=观测窗 35s→30s（停驻窗口 [29,32) 内），全部断言逐字不动。
2. **位姿跟随测装具桥接缺件（:5475）**：绿方实证——mkIdleRow（:6748）依赖 idle 桥接纯面（townNpcIdlePhaseOffset 等），须先调 idleImplGuard()；文件内既有调用点（走摆测 :5507 及三处既有测）均先调 guard，唯本测漏调，红因实为 TypeError 装具炸而非断言红（红相归因失真，红方自认）。**裁决**：补 idleImplGuard() 一行（先例同款），断言零改动。

**§11.3 落法注记（裁决随施工定形的微修订）**：裁决 8「核心不桥第二份 townYawOfFace」在装具现实下落为「同式源生」——adventure-mode 装具 eng 链不含 dims-core（townYawOfFace 不可达），核心内自铸同式纯函数，行为面由同名单测 15/15 以权威值（EAST=−π/2 等）锚定对照，单源语义不破（权威仍在 dims-core，核心副本仅装具可达性所限，测试锚定值防漂）。

**绿方 lint 遗留与裁决修清账**：绿方自报 lint 零错与亲验不符（29 错：绿方 js 两文件 operator-linebreak×5 + 红方测试三文件卫生债×24——红相时未跑 lint 门所致）。处置：js 侧 eslint --fix 机械样式修（修后复跑全量证行为零漂）；测试侧红方亲修（P→pTbl 改名避 new-cap / optional catch binding 先例形 / deepStrictEqual 重排同构合法形 / 块注释挪行 / WP_ANCHORS 启用进断言（引用值=原字面逐键同）/ gate 标题拆行）。**教训登记**：红相收口即跑 lint 门，卫生债不过夜。

**台账**：README T-NPC-13 行状态改「施工完成待评审」（评审/集成归上游，本岗边界止于红+绿同票交付）。

### 11.6 评审修复项与本线外债附记（2026-11-16，评审「有条件通过」后收口）

- **评审修复四条全兑现**（单条 commit）：①GLOSSARY 回写（新词条「镇民行为层核心（TownNpcBehaviorCore）」+ 一览 declared 68→69，interface 恰五名以 core 导出面实测为准，`_Avoid_` 四条按词条纪律；conventions GLOSSARY 确定性断言验平过）；②gate 扩列注释失准改真（「与维度段 townYawOfFace」→「同式自铸 patrolYawOfFace，语义锚定 dims-core 同式」，与本节注记及 core 头注对齐，零语句改动）；③advTownAnchorTick 体内头注「生产恒缺省 leg0」改真（生产现由 advLegById 每帧供数；同事实的 :3154 变量段块注释同批改真防半修矛盾，仅注释零语句）；④本条即 T11 附记。
- **T11 间歇债附记（债责不归本票）**：收口核验发现 adventure-mode.test.js T11「沙漠图到拍」（:4766-4797）为既有间歇性测试（同树跨轮次 4 绿 1 红，本线 diff 未触铺怪路径——绿方与红方多轮全量运行均未见其红，评审轮撞红一例）。处置归独立小票/债册，后续轮次撞红勿误归因到本线改动。

### 11.7 c2 面施工记录（2026-11-17，红方 ses_本岗；分支 `t-npc-13-c2-schedule`，基点 c1adb13=81c2806+npc15 随车立票 md-only commit，本线零触碰其内容）

> 拍板口径：c2 十村民日程入批（wave4 主件）；接口缝=ADR-0017 决策 4 四条（§7-c 注记）；上游=T-NPC-14 昼夜解冻已收口（town 行 dayCycle:true 在库）。硬约束不变：裁决二/三不可推翻（锚点到站跳变+本体滑行）；legById 注入缝定死；协议四表零改形；氛围 NPC 不可攻击。

#### 11.7.0 数据定案与红方裁决（登记先落，随本 commit 归档；绿方签名与行为以下列为准）

**① 日程航点数据终版（13 村民，红方探针验证器全过=problems 0）**——约束面全量复算：驻留点（聚集/家）过核心区/可达带/不压脚印/避散布≥2/避导览锚≥2/距 G01 环全格点≥2（铁傀儡不穿站立村民观感约束）/新驻留互距≥2；路段轴对齐全格点不穿脚印+不穿他村驻留点；节奏=每段行程秒数≤段时长（SECONDS_PER_GRID=1，20 tick/秒）。`w`=工作位（首航点=布局行恒不动）·`g`=聚集点（∈hub 带，face=面钟塔主轴）·`h`=家位（∈西·南生活带，face='north' 面镇心）·`t`=途经拐点（无驻留，face=行进轴）：

| npc | 航点序列（x,z @ face） | 点数 | dusk/night/dawn 行程秒（段长 81.5/433/83.5） |
|---|---|---|---|
| V01 | w(79,94)→g(79,80,north)→h(79,96,north) | 3 | 14/16/30 |
| V02 | w(69,57)→t(69,65)→t(73,65)→g(73,72,east)→h(56,72,north) | 5 | 19/17/36 |
| V03 | w(91,85)→g(68,85,east)→h(56,85,north) | 3 | 23/12/35 |
| V04 | w(76,69)→g(74,69,south)→h(74,96,north) | 3 | 2/27/29 |
| V05 | w(90,68)→g(90,71,west)→t(88,71)→h(88,96,north) | 4 | 3/27/30 |
| V06 | w(87,76)→g(87,80,west)→h(87,94,north) | 3 | 4/14/18 |
| V07 | w(103,79)→g(68,79,east)→h(56,79,north) | 3 | 35/12/47 |
| V08 | w(83,76)→g(76,76,east)→h(76,96,north) | 3 | 7/20/27 |
| V09 | w(83,59)→g(83,78,west)→h(34,78,north) | 3 | 19/49/68 |
| V10 | w(84,86)→g(78,86,north)→h(64,86,north) | 3 | 6/14/20 |
| A01 | w(72,60)→g(72,70,east)→h(48,70,north) | 3 | 10/24/34 |
| A02 | w(45,76)→g(70,76,east)→h(56,76,north) | 3 | 25/14/39 |
| A03 | w(73,92)→t(75,92)→t(80,92)→g(80,84,north)→h(80,98,north) | 5 | 15/14/29 |

**【c2 绿相施工微调追认（约束赢微调 §3.3：建议坐标与约束冲突时约束赢；腿和不变故节奏断言零改；绿方申报、红方追认）】**：V02 途经拐点 (69,66)/(73,66)→(69,65)/(73,65)（原 (73,66) 距 signpost-plaza (73,67) 切比 1 违避散布≥2）；A03 首拐点 (76,92)→(75,92)（原值恰落 V08 聚集→家段格点 (76,92) 违互穿守门）——两处均 t 拐点无驻留语义，上表已随更新为终版字面（腿和 19/17/36 与 15/14/29 逐行复核不变）。

首航点（工作位）x/y/z/face 逐行不动=TOWN_MAP.anchors 布局行零漂移（21 锚升格对账断言原样绿）；聚集点沿广场缘一排（z76~80 行）+钟塔旁（V01/V09/V02/V08/V10/A01），「傍晚向广场/钟塔聚集」（villagers 设计 §5.1）群像=围广场集会；家位沿西生活带民居街（x56 列 x48~64 带）+南带村舍行（z94~98），「夜间回屋休息姿态」语义。**工作位豁免环距与 SEM 语义窗**（V03(91,85)/A03(73,92) 本贴 G01 环邻格=既有拍板现状，非本票新约束对象；SEM 语义窗只查 waypoints[0] 原样保留）。

**② face 双语义拆分裁决**：G01 巡逻环 face=第 i 腿行进方向（沿走方向）；村民工作位 face=**SEM 工作朝向**（V01 面南迎客等，测试语义窗锁定）——日程腿行进方向**不得复用 waypoint.face**。裁决：日程锚停驻朝向=锚点 face 语义（day 段@工作位面工作朝向=现网镇貌零扰动；到站聚集/家=面塔/面镇）；**行进朝向=几何派生**（`legYawOf(from,to)` 主轴四正交：dx 主轴=东西、dz 主轴=南北，与 townYawOfFace 前向向量同式）——face 词表五值零扩。

**③ 日程核心签名与语义（behavior-core 追加，导出面恰十二名——「恰十名」为登记笔误随红相 commit 修字）**：
- `TOWN_NPC_SCHEDULE` 参数表（PO 后验可调）：`{SPEED_GPT: 1, DUSK_T: 12040, NIGHT_T: 13670, DAWN_T: 22330}`——三 tick 常量=DAYLIGHT.DIM_KEYS 转折值字面（零新魔法数；权威=ADR-0017 §2-8 clockPhase 断点）；SPEED_GPT=秒/格=1（与 G01 LEG_T=26/26 格同速口径）。
- `TOWN_SCHEDULE_PLANS`：13 锚 id 键控段表，每行恰四段 `[{from:0,leg:0,phase:'day'},{from:12040,leg:g,phase:'dusk'},{from:13670,leg:h,phase:'night'},{from:22330,leg:0,phase:'dawn'}]`——phase 词表=Daylight.clockPhase id 四值字面（零新枚举）；`from` 升序覆盖全天 [0,24000)；leg 引用行内航点索引。
- `townScheduleLegOf(anchorId, dayTime)` → `{leg, phase}`：纯函数 f(dayTime) 本体；dayTime 归一 [0,24000) 回绕；段=最后一个 from≤t 的段。
- `townScheduleState(anchorId, dayTime)` → 初始状态恰七键 `{anchorId, leg, t, phase:'dwell', dir:0, yaw, yawFrom}`——leg=当前段目标 leg（**夜间进镇直接在家**，摆放同源）；dwell 无时长（停驻到段切换，无 dwellT 键——与巡逻七键差异点）；dir∈{-1,0,1} 行进方向（walk 有效，dwell 恒 0）；yaw=face 朝向（停驻语义）。
- `townScheduleStep(state, dayTime, dt)`：恒新对象入参零突变；dt≤0/非有限回落零步；dwell+leg==target 恒等保持；dwell+leg≠target 起步（dir=sign(target-leg)，起步帧 t=0 余量弃——巨 dt 只起步，G01 同款）；walk 相 t+=dt/（腿格数×SPEED_GPT），t≥1 到站 leg+=dir 单沿交接（**到站不连跳两腿**），leg==target 转 dwell（yaw=到站航点 face），否则续 walk（t=0 拐点转身，yaw=下一腿几何行进方向）；**腿中段切沿延迟响应**（walk 相不中途改向，当前腿走到站才重新判 target——滑行惯性语义，段切响应延迟≤一腿时长≤68s，日程粒度可接受）。
- `townSchedulePose(state)` → 位姿恰七键同巡逻形 `{x,z,yaw,moving,progress,swingPhase,walkPose}`（walkPose 恰六键 idle 同形 floatY 恒 0）——停驻=精确落航点；行走=航点线性插值（from=wp[leg]，to=wp[leg+dir]）；走摆相位=sin(t·腿秒数·SWING_HZ·2π)·摆幅（复用 TOWN_NPC_PATROL 的 SWING_HZ/WALK_ARM_AMP/WALK_LEG_AMP 三参数，不复制第二份摆频表）。
- `townScheduleLegById(state)` → `{锚id: legIndex}`：walk=leg+dir（行进目标腿=「下一站」）；**dwell=leg（本体位）**——与 G01「停驻中=下一站」的差异裁决：村民停驻以小时计（白天在岗 10 分钟），停驻期 HUD/交互锚必须=本体位（6 岁可读：点谁气泡在谁脚下）；G01 停驻 3 秒短驻沿旧口径不动。到站帧 legById 同值零跳变（到站帧零重发）=消费机账本幂等语义自然结果；重发节奏=每腿起步帧恰一跳。
- 源文本守门沿用同文件既有卫生断言（零 THREE/DOM/墙钟/随机/定时器——dayTime 经参数注入非墙钟）。

**④ 装配层裁决（adventure.js 镇民段，消费机零改形）**：
- 分流判据=「段表在册」：`TOWN_SCHEDULE_PLANS` 含该 anchorId → 日程机；否则巡逻机（G01）。账行五键 `{id,anchorId,root,bones,state}` 零扩形（§11.3-12 维持）。
- 摆放/建账带日程初始 leg：`anchorOf(row.anchorId, 初始leg)`（白天 dayTime∈day 段恒 leg0=工作位=**现网零漂移**；夜间进镇村民直接在家位+账本同源零首拍跳变）。dayTime 读全局 `typeof dayTime!=='undefined'` 守卫（沙盒容差惯例）。
- `advTownPatrolTick(dt)` 内逐行分流（日程行 `townScheduleStep(state, dayTime, dt)`；G01 行 `townPatrolStep(state, dt)` 原样）；`advTownPatrolApply()` 零改动（日程 pose 恰七键同形，位姿/快照/四肢通道分账全部复用）；`advTownAnchorTick(legById)` 零改动（legById 供数面不变，重发语义=T-NPC-12 十二条零漂移）。
- 【c2 绿相追认】`advTownPatrolApply()` pose 供给一行按机种分流（日程行走 `townSchedulePose`，G01 行 `townPatrolPose` 原样）——上条「零改动」字面过严，意图=循环体位姿/快照/四肢通道分账逐字复用；不分流则 townPatrolPose 对日程逆行腿（dir=-1）反向插值，且 townSchedulePose 导出无消费方。循环体本身零触碰（追认裁定：通道分账复用意图达成，分流=供给面一行）。
- update 链四站字面零改动（§11.3-13 钉维持：patrolTick→anchorTick→idleTick→patrolApply）。

**⑤ 节奏约束断言（验收「日程锚点可观察」的测试面）**：每村民 dusk 段行程（工作位→聚集）≤81.5s、night 起步腿（聚集→家）≤433s、dawn 全程（家→工作位）≤83.5s——段表+航点数据+参数表三方对账可编程断言（数据终版表 §11.7.0-① 逐行秒数即断言期望）；24000tick=1200s（20 分钟）/夜段 8660tick=433s（7.2 分钟）换算锚定断言在案。

#### 11.7.1 红相落盘清单（红相 commit 回填）

三测试文件一次落盘（红相 commit），红面与翻钉点逐文件对账：

| 文件 | 测数 | 红 | 落盘面 |
|---|---|---|---|
| `test/town-npc-anchor-core.test.js` | 24（+3） | 2 | ③ 拓扑翻钉=13 村民日程航点序列字面锁（SEQ_N 逐行 2~5 点/互异/轴对齐/首航点=工作位=布局行恒不动）；⑨ 可走扩列全部多航点锚（脚印+互穿守门，**G01 环既有腿×他锚既有工作位窄域豁免**——G01 南腿 z92 恰过 A03 站位 (73,92)，既有共存现状非本票引入，与 §11.7.0-① 工作位豁免同源；村民日程腿与一切新驻留点全查）；⑨-2 驻留语义窗三测（聚集/家字面+face 语义/hub·西·南生活带域/距 G01 环≥2+驻留互距≥2）；⑪ 取数器翻钉=日程锚线性取数+越界两端钳制（线性序列非环——取模会「末段绕回首段」错位，钳制保夜间恒在家语义；n=1 旧数据上退化重合，数据扩列后真绑定）；头注断言组描述随扩形改真 |
| `test/town-npc-behavior-core.test.js` | 35（+20） | 21 | 导出面翻钉恰**十二名**（巡逻 5+日程 7=两表+五函数；票面 §4.2.1-④/§11.7.0-③「恰十名」为登记算术笔误，**本 commit 随修**——7 个新名逐项可数，实测面为准）；日程节 20 测=TOWN_NPC_SCHEDULE 四键字面锁+DIM_KEYS 转折值/Daylight.TICKS 跨表对账（装具链加装 daylight-core）· PLANS 13 键域对账（无 g01）+行形状（恰四段×恰三键/from 字面升序/phase=clockPhase id 词表/leg 界内且 day·dawn=0·night=末·dusk∈hub 带）· legOf 四段取样+边界沿（from≤t 左闭/24000 回绕/负值归一）+域错（未知锚与 G01 均抛「未知」）· State 七键（无 dwellT=与巡逻机差异点）白天在岗+段切初值（dusk→聚集/night→家/dawn→工作位，夜间进镇摆放同源）· Step dwell 恒等保持+段切起步（起步帧余量弃/巨 dt 只起步）+walk 线性行进（V01 北行/V03 西行证行进朝向=几何派生不复用 face）+到站（leg+=dir 单沿/落点精确/停驻 yaw=face 语义）+过冲单步（V02 五点 dawn 逆行 leg4→3 不连跳）+腿中段切沿延迟到腿尾（拨 night 不中途改向，到站重判续走）+全日端到端泵（dt=1s×1260 帧跨回绕，恰三到站序列 1→2→0）· LegById dwell=本体位/walk=下一站/起步帧恰一跳/到站帧同值零跳变 · Pose 恰七键+dwell 全零+起步摆过零+swingPhase=t·腿秒·SWING_HZ·2π（复用 PATROL 摆频表）· 纯度+dt 边界+跨段切确定性重放 · 节奏三方对账（13 村民 dusk≤81.5s/night≤433s/dawn≤83.5s，20tick/秒换算锚定）；日程节专用 schedGuard 红因守卫（巡逻节 behaviorGuard 零污染——日程红在日程语义上，巡逻 14 测保持绿） |
| `test/adventure-mode.test.js` | +7 面 | 7 | 「静态 13 键零重发」翻钉=白天账本域（leg0=工作位）13 村民注入零重发+离谱腿注入=真跳变重发恰一条（旧「任意 legIndex 零重发」死语废除）；日程账行推进+快照跟随（注账式 injectScheduleRow 装具——state 由桥接真核心构造判据单份；红期桥接缺席返 null 红因归首断言）；分流守门源切片（advTownPatrolTick 体内 PLANS 在册→townScheduleStep(state,dayTime,dt)/G01 行 townPatrolStep 原样）；注入缝事件节奏（起步帧恰一跳/行走零事件/到站帧零事件）；夜间进镇摆放同源（dayTime=night 建账 leg=家(79,96)+注入账本 leg 零重发）；全日端到端真 update 泵（globalThis.dayTime 注入裸名全局，finally 清除；恰三到站 1→2→0）；建账分流源切片（advTownPuppetsPlace 按段表在册+townScheduleState 初始 leg，13 村民全入账）；装具日程桥接守卫式扩装（五函数+两表独立 every 分组，红期缺席跳过——巡逻桥接零触碰，既有 T-NPC-13 八测保持绿） |
| `test/town-map-core.test.js` | 0（既有测改装——红相未在册，绿相裁决补列） | 1→0（绿相期计划外红） | TIDEA 波次二 :1240 pts 环线构造改口径（c2 波及：该测消费 TOWN_NPC_ANCHORS 形状，数据扩列自动波及，红相扩列登记漏列）——原「全部多航点锚末→首闭环+对角线插值」只适用 G01 环，村民线性序列产生末→首对角线假格点（V09 家(34,78)→工作位(83,59) 对角线 (38,74) 距 clothesline 足印切比 1）假红，而该对角线根本不是日程行进路径；改「G01 闭环、村民行相邻腿段+非轴对齐段防御」与 anchor-core ⑨ 可走口径对齐（红方亲修） |

#### 11.7.2 红基线自证（红相 commit 回填）

全量 `node --test`（=npm test）红基线实测：**2350 测 = 2319 绿 + 30 红 + 1 skipped**（skip=既有容差位，非本票）——fail 分布恰落本票三文件：anchor-core 2 + behavior-core 21 + adventure-mode 7 = 30，**零计划外红**（其余 2319 既有测全绿：T-NPC-12/13 既有段/boot 摆放对账/conventions 守门链无一被翻动）。分文件红计数：anchor 24 测 22 绿 2 红（③ 数据未扩+⑨-2 字面未落=票文要求本身）；behavior 35 测 14 绿 21 红（1 翻钉恰十二名+20 日程面未施工 schedGuard 红因）；adventure T-NPC-13 段 15 测 8 绿 7 红（1 翻钉静态死语+4 注账式桥接缺席+2 源切片判据缺席）。红因归类：**数据扩列红**（③⑨-2——绿相扩 anchor 表即绿）/**签名缺席红**（behavior 20+adventure 4——绿相落日程面即绿）/**装配接线红**（源切片 2+注入缝 3——绿相分流施工即绿）/**翻钉红**（导出面+零重发死语——随绿相新形状自然转绿）。红相证据：`git show <red-commit> --stat` 三测试文件 diff；全量跑日志见本节计数（复跑命令 `npm test`，ℹ 行汇总）。

#### 11.7.3 绿相施工记录（绿方完工回执后回填）

绿相施工（implement-engineer ses_e1a9a6d91ffeiMglrfkRrf3zn2，HEAD=红相 36e4c16 之上，js 三文件域内；改动未提交，随收口 commit 落盘）：

**施工面**：`js/town-npc-anchor-core.js` 13 村民行扩日程航点序列（§11.7.0-① 终版字面照抄）+`anchorOf` 双语义（日程锚线性取数+越界两端钳制/G01 环取模归一，n=1 防御位保留）+头注 interface 改真；`js/town-npc-behavior-core.js` 日程面七名追加（两表+五函数，§11.7.0-③ 签名逐条）+`legYawOf` 几何派生（face 双语义拆分②）+导出面恰十二名+头注改真；`js/modes/adventure.js` 四处装配——建账分流（advTownPuppetsPlace 段表在册+初始 leg+摆放同源）/tick 逐行分流（townScheduleStep vs townPatrolStep，dayTime 裸名 typeof 守卫）/interactBoot prev 建账带日程初始 leg（夜间进镇 prev=家）/patrolApply pose 供给按机种分流（追认条 §11.7.0-④）。

**绿方打回六项裁决（全部采纳——测试是本岗产物该修就修，红方亲修测试侧，绿方零改测试 ✓）**：

1. **⑨ 互穿豁免口径（三版收敛）**：红相首版「G01 行×k=0 窄域」→绿方证 V09 上班直列 x83 必经 V08 工作位 (83,76)（V09 四面字面锁死无微调空间）→二版「k=0 全行豁免」→绿相次级残红暴露 A03 t1 (75,92) 撞 G01 环南腿整行（z=92 全行皆环格），k>0 全查仍超票文口径——**终版=驻留判定**：豁免域=非聚集/家的一切航点（工作位=既有拍板现状、途经拐点=路过形态），执法点=站立重叠只查聚集/家字面集（票文 §11.7.0-① 约束原文「路段不穿他村驻留点」驻留点=聚集/家，测试执法面终于与票文精确对齐）。
2. **behavior :588 入参笔误** `step(s,…)→step(w,…)`：自起步帧续泵（红方注释「巨 dt 行进帧」自证意图）；红方归一心算误注（42331 归一 18331∈night→target=2 非 0）已随修注。
3. **全日泵窗算术**：1260 帧窗会把次日 dusk 起步帧（i=1212）后的第 4 次到站卷入（arrivals=[1,2,0,1]）——behavior 收 1260→**1210**、adventure 收 1260→**1205**，恰含当日三次到站。
4. **装具 dayTime 清理方式**：c2 装具三处 `delete globalThis.dayTime` 与既有域物理冲突——adventure.js 严格模式 30+ 处既有裸读靠装具 `:213 globalThis.dayTime=0` 存活，delete 即 ReferenceError 连环掀翻后续 45 测（红相未暴露：c2 测试全红在 try 块前的 `assert.ok(inj)`，delete 从未执行）→统一改赋 0 重置（全文件既有惯例）。
5. **夜间进镇测前提缺漏（两修）**：一修补 `globalThis.dayTime=15000` 前置（prev 建账同读全局，freshInit 后 advSetDim 前）；二修（次级残红 B）注入键域扩全 13 村民 night leg——单键注入 `{'npc:v01':2}` 会让其余 12 行 undefined→缺省工作位、对 prev(家)=12 行假跳变（**注入键域=prev 键域口径**），改从 TOWN_SCHEDULE_PLANS night 段逐行取 leg 全键注入。
6. **town-map-core TIDEA pts 构造**（计划外红，扩列登记漏列）：见 §11.7.1 补列行——「末→首闭环+对角线插值」对村民线性序列产生假格点假红，改 G01 闭环/村民相邻腿/轴对齐防御。

**两项申报追认**：V02/A03 途经拐点微调（约束赢 §3.3，腿和 19/17/36 与 15/14/29 不变故节奏断言零改，§11.7.0-① 表已随更新终版字面）；patrolApply pose 分流一行（§11.7.0-④ 追认条——「零改动」字面过严，意图=通道分账复用）。

**绿基线自证（红方亲跑复核）**：全量 `node --test` **2350 测 = 2349 绿 + 1 skipped + 0 fail**（skip=既有容差位）；分文件 anchor-core 24/24、behavior-core 35/35、adventure-mode T-NPC-13 段 15/15、town-map-core 全绿；test/ 目录相对红相 commit 的改动=仅本节裁决修复四文件（anchor ⑨ 驻留判定/behavior ②③/adventure ③④⑤/town-map ⑥——全部红方亲修亲认）。

**收口**：lint 三关+`.scratch/g-c2-*.js` 探针清理+单条 commit（消息文件先例 `git commit -F`）由绿方续会话执行（授权随本记录），红方终验（复跑全量+域核对+conventions gate）通过后本票归档。
