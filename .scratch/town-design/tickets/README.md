# 村民全量进镇 · 票链总说明（README）

> 产出：architect（村民全量进镇工程线），2026-11-14
> 分支 town-design @ cca8dde。本目录每票一文件，票面含：目标/文件域/接口形状/验收标准（红绿可测）/blocking edges/波次。
> **本线只立票不施工**；派工与排期归 engineer-manager。

## 0. 设计权威与冻结项（勿重问 PO）

- 角色设计定稿：`docs/town-villagers-design.md` + `docs/design/town-villagers-visual-spec.md`（§3.1 色盘/§5 角色表/§6 三视图/§7 状态与互动/§8 默认值）
- **§8 默认值已 2026-11-12 PO 拍板回落锁定**（`.scratch/town-design/PO-REVIEW-RECORD.md`）：命名/TTS 默认名、nitwit 友善化、动物 3 种各 1-2、G01 裂纹首版 2 档（完好+中裂）、10 人固定配色。**所有票不得重开这些点。**
- 资产需求权威：`docs/town-assets-requirements.md`（§3 命名/§6 资产条目/§9 动画最小集）。贴图基线：**村民 64×64、傀儡 64×80、A01/A02 32×32、A03 48×48**（1px = 1/16 格，PO 已采纳）。
- 已批产资产：`.scratch/town-design/assets/villagers-mobs/` 14 件 SVG；**生成器唯一真源 `.scratch/town-design/gen/`**（`notes-villagers-rollout.md` §5：可复跑自证，V01/G01 与打样逐 rect 全等）。
- 交互协议冻结：`js/town-interact-core.js`（kind='npc' 条目必带 sessionKind；sessionKind ∈ greet|tour|seek|help|care 五值冻结；`townTargetOf` 恰六键）。**本波实体件按协议形状产数据，不接线。**
- 对话 UI 定稿（B 侧）：`docs/design/town-ui-dialog-spec.md` + `town-ui-dialog-prebuild.md`（本波只留接口，见 T-NPC-11）。
- 并行线悬点：入口缝新 ADR（town 维度行 + 交互机宿主落位）未落地，见 `.scratch/handoffs/2026-11-13-town-seam-change-design-brief.md` §③。
- T-MAP-04 遗留：NPC 动态锚点重发节奏 PO-pending，归本线（方案见 §3.3 裁决三 + T-NPC-12）。

## 1. 票清单与依赖图

| 票 ID | 票名 | 波次 | blocking edges | 状态 |
|---|---|---|---|---|
| T-NPC-01 | 贴图管线票（kit 非方形扩展 + gen→look 导出器 + V01 试点 + box 几何尺寸表 + golden 自证） | 一 | 无 | **frontier（可立即派）** |
| T-NPC-02 | 14 实体 look 落库票（剩余 13：V02~V10/G01/A01~A03） | 一 | T-NPC-01 | 待 01 |
| T-NPC-03 | 14 实体模型注册表票（js/town-npc-registry.js） | 一 | T-NPC-02（测试可随 01 先写红） | 待 02 |
| T-NPC-04 | 站位锚点数据表票（js/town-npc-anchor-core.js + anchorOf 取数器） | 一 | 无 | **frontier（可立即派，与 01 并行）** |
| T-NPC-05 | 渲染适配件票（js/town-npc.js，可选降风险件） | 一 | T-NPC-03 | 可选 |
| T-NPC-10 | townInteractBoot 接线票（交互机宿主落位 + NPC 条目入册 + 站位锚升格会师） | 二 | **入口缝新 ADR** + T-NPC-03 + T-NPC-04 | **已收口**（施工+双轴评审通过，2026-11-15 并入集成；失实销号修正见票面 §6.5） |
| T-NPC-11 | 对话 UI 挂载票（town-dialog-core + 三件套装配 + TTS 排队） | 二 | **入口缝新 ADR** + T-NPC-10（+T-UI 链对口） | **已收口**（施工+双轴评审+接缝修复，2026-11-15 并入集成；三段式修正见票面 §7.5 第 7 条） |
| T-NPC-12 | 锚点动态化消费票（anchorOf 消费 + focus 重发节奏） | 二 | **入口缝新 ADR** + T-NPC-04 + T-NPC-10 | **已收口**（施工+双轴评审通过，2026-11-15 并入集成） |
| T-NPC-13 | 行为层票（G01 巡逻环 legIndex 推进者 + 本体位姿跟随 + idle/走动动画选型 + **c2 十三村民日程时间轴**） | 三 | **PO 方案点拍板完成**（票面 §7 四点+c2 日程入批拍板）+ **工程线验收案卷五条修复完成**；上游 T-NPC-12/ADR-0011 已满足非阻塞 | **施工完成待评审（c2 面双轴评审已过）**（红+绿同票交付两波：a2/b1 面 2026-11-16 分支 `t-npc-13-patrol` @0b01586，26 红全绿；c2 面 2026-11-17 分支 `t-npc-13-c2-schedule`，30 红全绿——npm test 2350 测/0 红/1 skip + lint 三关零错 + conventions 13/13，红相 36e4c16 + 绿相 5f1e4d4 + 双轴评审通过（三轻微修复项随本行台账 commit 修字，零重派绿）；施工/裁决记录见票面 §11（§11.7=c2 面）；日程时间轴本体不再由 T-NPC-14 承接（旧口径销号）；PO 实屏终验归上游排期） |
| T-NPC-14 | 镇昼夜解冻施工票（ADR-0017 §6 T-DAY-01 面终名落此：town 行 dayCycle 翻正 + setSkyBase 改道 + 钉测/文档债收口；日程时间轴本体归 T-NPC-13 c2） | 三+ | 上游无硬边（ADR-0017 决策 7 PO 终拍 2026-11-16 全通过，ADR 状态行已回填）；下游解锁 T-NPC-13 c2 面与 T-NPC-15 | **施工完成待评审**（红+绿同票交付：2 红全绿——dims-core 27 测/0 红 + adventure-mode 245 测/0 红；npm test 2292 测/0 红/1 skip + lint 三关零错 + conventions GLOSSARY 验平 + world-vertexlight 两钉零漂移 + 零夹带五挡回文件零改动/镇民段单 hunk 零触碰实证，2026-11-16 分支 `t-npc-14-day-cycle` 工作树全绿未提交态交回（提交归红方验收后单条执行）；红相自证与绿相记录见票面 §8；c2 面硬边「T-DAY-01 落地」随本票销号；PO 实屏终验归上游排期） |
| T-NPC-15 | 镇夜间氛围票组（案②「灯火归家」定稿 2026-11-16 拆三票：**15a** E3 门控机制 js 票（clockPhase 四段渐变窗/烘焙灯块零门控/零逐帧护栏）+ **15b** E1/E2/E5 落位票（TOWN_PALETTE 灯罩键登记+belfry 夜态增补一行+窗光 2-4 扇/钟塔灯 1 落位，灯柱零新增）+ **15c** E4 灯罩造型笔资产子票（设计/资产线，派工走 scrum 转设计线，工程票不施工灯罩造型）） | 三+ | **无硬边**（定稿已定）；票内软边注记：15b 含载体 B（自发光面片）则该面依赖 15a 机制先行、15c 用色键引 15b-E1 产出键（键名回填）；**施工排期注记：串行排在 T-NPC-13 c2 面之后（同 worktree 单线纪律），终裁归 scrum（票面 §6）** | **已立票（待派工）**（票面 `T-NPC-15-night-gating.md` / `T-NPC-15-night-placement.md` / `T-NPC-15-lamp-shade-asset.md`，2026-11-17；权威=docs/design/town-night-ambiance-design.md §5-E1..E5+公共裁决四条；原占位行翻正为本行零新增行；安全叙事 19 项对账口径见各票验收）；**15a 施工完成待评审**（红+绿同票交付：8 红全绿——daylight-core nightGlow 组 4 测+world-night-glow 专题 4 测，绿方打回 3 处均裁决为红方测试缺陷并修正留痕；npm test 当值 2358 测/0 红/1 skip+lint 三关零错+conventions GLOSSARY 验平+world-vertexlight 7 测零漂移，2026-11-17 分支 `t-npc-15a-night-gating`（红相 3966b8f+绿相 c8bc367）；施工/裁决记录见票面 §8；机制不绑点位，面片落位=15b 消费方）；**15b 施工完成待评审**（红+绿同票交付：3 红全绿——钉值 pin+E1 键在册/债 5 同收口+E5 落位全谱系（偏移逐字面/密度三值/避让/序/零门控）；定案=载体 A only 烘焙零载体 B ⇒ N1 注销缝零触发（15a §8.5-4 移交条款随本票销号）+E1 值=80 门额牌兜底零新增块/件+台账口径=装置数 13（13+4=17≤18）；npm test 当值 2360 测/0 红/1 skip+lint 三关零错+conventions 验平，2026-11-17 分支 `t-npc-15b-night-placement`（红相 1fcb2ac+绿相 8aa7a19+裁决修正 ec80914）；绿方打回 1 处裁决成立=红件 lint 缩进红方自修留痕；N3 走查机械执行 PASS（夜昼 render.calls 184/184 差 0+tris 差 0=纯烘焙零新 mesh，证据引文票面 §8.6）；施工/裁决/N3 记录见票面 §8；PO 实屏夜档终验归上游排期）；**15c 资产定稿已入库**（docs/design/town-lamp-shade-styling-spec.md @ 9dfc145+完工回执 in-repo；机械自证脚本 scratch 不入库可复跑；设计线待回填②项——scrum 口径照登）；**15c 执行面施工完成待评审**（scrum 终裁激活票面 §4 预设路径=工程执行微票，红+绿同票交付：5 红全绿——15c 节六测（直译对账 75 笔/111 体素五表·罩形不包顶 11/11·衔接序零覆写·密度护栏·走廊钉·全量装配见证显影）；npm test 当值 2366 测/0 红/1 skip+lint 三关零错+conventions 验平+机械自证脚本复跑 10/10 PASS+白天档 N3 走查（夜昼 calls 184/184 差 0=零门控零瞬亮+两态截图冠形/珠串读法留痕），2026-11-17 分支 `t-npc-15c-shade-exec`（红相 8d0e947+绿相 5e7fdd6+裁决修正 feb1ac1）；绿方打回 1 处裁决成立=旧测植被道具整列谓词分层盲视、红方 y 域收窄修测留痕（断言面零放松）；占位键回填对账=lampShade 零对账差·债 5 不触发·town-map-core 零 diff；施工/裁决/走查记录见票面 §6；PO 实屏终验归上游排期） |
| T-UI-DLG-01 | 对话卡视觉实装票（案⑤转正：方向乙·毛边绘本对话泡 + spec §4.6 公共欠账三项一次装，css/town.css 唯一施工文件/DOM-JS 零改） | 三+（UI 线） | **无硬边**（PO 2026-11-16 六问实答选乙 + spec 修订定稿 @9440be4）；注记：npm test 装具 8080 撞车面→串行排在 T-NPC-14 施工之后，终裁归 scrum（票面 §6） | **施工完成待评审**（红+绿同票交付：§3.3 两守门面开工复核零翻新预判成立（test/ 零改、债 5 未触发）+ 18 项硬数字对账全落（票面 §8.2 带 spec 出处与 file:line）+ 结构守门清单全过 + 零警示红/guide 字面锁/A 侧零漂移/缺席锁四串继续缺席；npm test 2294 测/0 红/1 skip + lint 三关零错 + conventions 13/13，2026-11-16 分支 `t-ui-dlg-01-dialog-card`（簿记 d84ce2a + 施工一笔随车）；施工/裁并记录见票面 §8；PO 实屏终验（1280×720/1920×1080/窄窗三档，骑缝名牌出界裁切重点）归上游排期；行内 receipts 指针修正仍归下班车簿记（§7 注记①）） |
| T-TEST-T11 | 沙漠图间歇债 test-only 小票（adventure-mode.test.js「T11 同池回落」沙漠分支「至少出一只」概率断言无种子化，同树跨轮次 4 绿 1 红消红；候选二档成本升序：①铺怪窗口加宽 ②测试内确定性随机源置换；生产代码零改） | 三+ | **无硬边**；排期注记：串行排 T-NPC-14 施工之后（同文件相邻作业减翻动），终裁归 scrum（票面 §6） | **已收口**（test-only 消红同票交付：铺怪窗口 110→220 帧（同池回落腹地/沙漠两分支+三带姊妹加固），断言逐字零放松、生产代码零改；2026-11-16 并入集成 @2e588d4；票面 `T-TEST-T11-desert-spawn-flake.md`） |
| T-TEST-T14 | 镇天缝覆盖钉 test-only 小票(adventure-mode.test.js 进 town 分支「setSkyBase 改道调用+实参=行色端点」与「分支内 applyDaylight 恰一次首拍」无直接钉——mode 装具缺 setSkyBase,生产侧 typeof 守卫静默跳过,回归仅 PO 实屏肉眼兜底;装具面开 setSkyBase 注入缝,mkEl 不动,注入方式红方裁;生产代码零改) | 三+ | **无硬边**;排期注记:串行队列 T11 → 本票 → T-UI-DLG-01(同文件相邻作业减翻动),终裁归 scrum(票面 §6) | **已立票（待派工）**（票面 `T-TEST-T14-sky-seam-pin.md`，2026-11-16；证据：T-NPC-14 票面 §8.5 + 合并预告自证 engmgr-vw3-2 群内 2026-11-16 + ADR-0017 决策 1） |

> **登记不执行（件十簿记 2026-11-16）**：① T-TEST-T14 与 T-UI-DLG-01 两行的「已收口」翻正 + T-UI-DLG-01 行 receipts 指针修正（§7.7 存量偏差）——登记不执行，待两票工程收口后随下班车簿记一并执行；② 镇昼夜解冻 ADR 原编号 0012 因撞号改号 **0017**（滑翔翼群 0012–0016 在先不动，编号单调不复用），本台账及全仓引文已随扫改指 0017，考据注记见 docs/adr/0017 文头。

```
        ┌─────────── T-NPC-01 贴图管线 ───────┐
        │                                     │
        ▼                                     ▼
  T-NPC-02 look 落库 ──► T-NPC-03 注册表 ──► T-NPC-05 渲染适配(可选)
                                                │
  T-NPC-04 站位锚点表(并行) ─────────┬──────────┼──────────┐
                                     ▼          ▼          │
              [入口缝新 ADR]──► T-NPC-10 接线 ◄───────────┘
                                     │
                     ┌───────────────┼───────────────┐
                     ▼               ▼
              T-NPC-11 对话挂载   T-NPC-12 锚点动态消费
                                      │ (已收口: legById 注入缝)
                                      ▼
        [PO 方案点拍板 + 工程线案卷五条修复] ──► T-NPC-13 行为层(待拍板)
```

**frontier（当前可派票）**：T-NPC-01、T-NPC-04（互不依赖，可并行）。01 收尾后依序放 02 → 03（03 的红测可提前随 01 写）。
T-NPC-13 待两条硬边（PO 方案点拍板 + 工程线案卷五条修复）销号后即 frontier；拍板结果须回填票面 §5.2/§4.1 再开工。

## 2. 并行隔离声明（违反即废票）

- 入口缝工程线正并行改 **index.html / js/town.js / js/mode-registry.js** —— 本线全部 8 票的文件域**均不含这三个文件**，index.html script 挂载推迟到波次二接线票（且届时以 ADR 后宿主形态为准）。
- 本线文件域全集：`js/mob-look-kit.js`（仅 T-NPC-01 的非方形扩展）、`js/mob-look/town_*.js`（14 个新文件）、`js/town-npc-registry.js`、`js/town-npc-anchor-core.js`、`js/town-npc.js`、`test/mob-look.test.js`（白名单断言改源）、`test/town-npc-*.test.js`（新）、`test/fixtures/town-npc-golden.json`（新）、`.scratch/town-design/gen/gen-export-look.js`（新，导出器）。
- 波次二票的文件域含 `js/town-interact-core.js` / `js/town-map-core.js`（均非禁触文件，且属停工令明文的「保留面」）与 ADR 裁定后的宿主文件——票面已注明「文件域在 ADR 落地后由 engineer-manager 修订」，本线现在不锁。

## 3. 三个裁决（票文记录，实现服从）

### 3.1 裁决一：贴图管线选型 = **复跑 gen 导出为 mob-look 声明数据**（否决一次性转 PNG 落盘）

- 结论一句话：生成器 `.scratch/town-design/gen/*.js` 保持唯一真源，新增加一次性导出器把字符行像素数据机械移植为 `js/mob-look/town_*.js` 的声明数据（与既有 48 怪 paint 同构），以提交入 git 的 golden 像素摘要 fixture 锁死「游戏贴图 = 已批产 SVG 像素」，手改即红。
- 否决 PNG 落盘的理由：(1) 仓库先例是全程序化贴图（mob-look paint + texture-atlas），运行时零依赖零异步加载；PNG 路径要新建贴图加载器/材质旁路/assets 目录约定，是**第二套贴图 vocabulary**；(2) 引擎侧 rig/UV 铺展/材质/facePixels（头像裁切，正好供给话 UI Speaker 头像位）全链复用零成本；(3) 表情帧集与 G01 裂纹叠加本质是像素域操作，程序化路径天然支持。
- 自证机制：gen 模块在 `.scratch`（设计工域，不入 git js 域——eslint 不豁免 `.scratch`，勿把 gen js 提交进仓库）；导出器每次运行同步产出 look 文件 + `test/fixtures/town-npc-golden.json`（逐实体逐面内容摘要；按**面内容**对账而非整幅坐标——look 文件的 UV 布局按 kit `regions()` 公式重排，与 gen 手排坐标不同，像素内容逐纹素等值）。
- 贴图基线：村民 10 张 64×64；G01 64×80（kit 现为方形画布，**T-NPC-01 扩展非方形支持**，存量 49 怪零漂移）；A01/A02 32×32；A03 48×48。

### 3.2 裁决二：姿态帧不入本批（挥手/工作/小跳/指路全部后置）

- 结论一句话：本批 14 实体只交付**中性 bind 静态模型 + 表情帧元数据（×4，不实现切换）**；挥手/工作/小跳/指路/献花姿态、裂纹状态切换全部后置到「动画层选型票」（未来立票）。
- 依据（`docs/town-assets-requirements.md` §9 头注，铺开 N5 结论，PO 默认已采纳）：**「贴图级姿态帧不做，姿态表现归动画层选型」**；§9 把 idle/走路/挥手/点头/工作循环列为 P0 基础循环但明写「帧动画或骨骼简化，**由实现选型**」——选型本身（骨骼 pose vs UV 区切换）是一个独立裁决，不属于「渲染实体件」数据票的交付面，混入会迫使我线提前锁动画方案。
- 本批留好的钩子：注册表带 `expression`（帧元数据：greet 模式 browlift/eyesmile）与 G01 `crack`（四档语义、首版 2 档）/`flower`（4×4×4 花盒）**数据字段**；G01 花盒骨与花贴图随 T-NPC-02 建好（显隐逻辑后置）；V10 小跳、V01 挥手等姿态语义记入注册表 `postureNote`，供动画层选型票直接消费。

### 3.3 裁决三：NPC 动态锚点节奏 = **anchorOf 纯取数器 + 航点量化更新**（非逐帧插值，非纯静态锚）

- 结论一句话：锚点数据层提供 `anchorOf(id, legIndex)` 纯函数——静态站位是「单航点」特例，G01 巡逻环是多航点；锚点坐标**只在到站（航点切换）时变化**，不随移动逐帧/插值刷新；消费侧（谁推进 legIndex、何时重发事件）归波次二接线票，本票面标**「待入口缝 ADR 会师」**。
- 论证四条：(1) 6 岁可读——HUD 标记/气泡锚不抖动，逐帧跟随会让 2.7 格的 G01 拖着 UI 乱晃；(2) 事件稀疏——到站切换是秒级低频，重发 `interactFocus`/`targetFocus` 不会刷屏（协议零改动：事件 payload 的 anchor 本就是快照值，重发同形状事件即可）；(3) 纯函数零墙钟零随机（-core 可测，legIndex 由装配层注入，本层不做时间推进）；(4) 纯静态锚被否决的理由——G01 常驻巡逻（villagers 设计 §5.3），静态锚会让交互标记长期指着空地，交互协议的「锚点在册性」名存实亡。
- T-MAP-04 遗留销号口径：A-01 协议定稿 ③「NPC 动态锚点本票全静态、重发节奏归村民接线票」——本裁决即村民线给出的方案，**最终会师点在 T-NPC-12**（宿主 tick 归属 + 重发挂既有 focus 事件还是新事件，推荐前者=零协议增项）。

## 4. worktree 评估结论

**结论：可在本 worktree（town-design）施工，无需独立 worktree。**

- 依据：(1) 本线文件域（§2 清单）与并行线正在改的三文件零交集，新文件全为新路径；(2) 本线唯一共享引擎件改动是 `js/mob-look-kit.js` 非方形扩展——并行线（维度注册/入口缝/adventure 侧）不触渲染引擎件，冲突面为零；(3) 提交纪律：只 `git add` 本线文件域，每票收尾 `npm test` + `npm run lint` 全绿再交（PowerShell 下 git 多语句链会炸，拆单条、commit 用多个 -m）；(4) 本线零 npm install 需求（运行时零依赖），**junction 借 node_modules 高压线不适用**；若未来确需独立 worktree，按 `docs/worktree-pitfalls.md`：独立 `npm install --ignore-scripts --strict-ssl=false`，禁 junction，删 worktree 前 `cmd /c rmdir <worktree>\node_modules`，删后 `session_move` 回主仓库。
- 每票收尾必跑：`npm test`（含 boot 全链冒烟与规范守门）+ `npm run lint`。

## 5. 关键事实底座（立票时已核实，施工前可复核）

- `js/mob-look-kit.js` 村民血统对照：`illager` 基座 = 头 8×10×8 + 鼻 2×4×2 前突 + 身 8×12×6 + 长袍 overlay（inflate 0.5，下摆收 y6）+ 臂 4×12×4 + 腿 4×12×4——与 villagers 设计 §5.1 基准比例**逐字吻合**，V01~V10 直接复用。
- `js/mob-look/golem.js` 是官方铁傀儡（身 18×12×11），G01 阿稳 town 规格（躯干 14×12×8 + 髋盒 10×5×7 + 鼻 2×4×2）与之**不同**，须自有骨新声明，不共用。
- `MobLookKit.keys()` 的消费面仅 `test/mob-look.test.js` 白名单；`js/mobs.js:617` 按 MOB_TYPES 反查 look 存在性（键集超集不受影响）。
- **村民不进 `MOB_TYPES`**：那是战斗/掉落注册表（hp/dmg/family/掉落反向守门），14 实体是氛围 NPC，入册会拖垮掉落表/竞技场不变量——走独立注册表（T-NPC-03），引擎 kit 共享。
- `js/town-assembly-core.js:143`：TOWN_MAP.anchors 的 anchor 装配段**零 op**（出生归模式层）——未来站位锚升格并入 TOWN_MAP.anchors 时装配层零副作用，已核实（T-NPC-10 会师条件之一）。
- gen 产出 UV 域：村民 `check(0,0,63,63)`（64×64）、G01 `check(0,0,63,79)`（64×80）、A01/A02 32×32、A03 48×48——与贴图基线一致，导出器直接按此落 tex 尺寸。
- eslint ignores 不含 `.scratch`（`eslint.config.mjs:99`）——**勿把 gen/*.js 提交进仓库**，工程持久真源 = look 文件 + golden fixture。
- `.scratch/town-design/gen` 与 `assets/villagers-mobs` 目前未被 git 跟踪（`git ls-files` 为空）——批产像素的唯一持久副本将是本线产出的 look 文件 + golden fixture，故 T-NPC-01 的「入库锁死」是硬要求不是锦上添花。

## 6. 立票规约（2026-11-14 retro 固化——自下批立票生效，存量票不回改）

> 出处：村民波次一 retro 债 3（文件域漏「导出器同步再生成」面）与债 5（守门改源后
> conventions/GLOSSARY 滞后）。波次二 T-NPC-10/11/12 已立票在册不回改（旧票回改由
> scrum-master 会师时统筹）；本规约对新立票（含未来工程线）生效。

- **文件域固定问句（债 3）**：立票填文件域小节时必答——**「本票是否有生成器/导出器会再生成
  既有产物？有则列入文件域」**。判例：T-NPC-02 施工必改 `js/mob-look/town_v01.js`（导出器
  全量再生成的机械必要）但票文 §2 未列，靠验收 §4.5 反推授权——文件域枚举必须含
  「工具再生成会触碰的既有产物」这一类，不止「新文件 + 直接改动」。
- **守门改源必附规范回写（债 5）**：凡文件域含白名单/守门测试改源（如
  `test/mob-look.test.js` 白名单断言），验收标准**自动追加一条**「conventions.md / GLOSSARY
  对应表述回写」——测试是事实权威，正文必须有人在改动链上负责（判例：T-NPC-01/03 两轮
  改源后 conventions §1.1 与 GLOSSARY「造型档案」滞后，T-NPC-06 补账标 F1 硬缺口）。
  GLOSSARY 新词条收录判据（≥2 文件引用）检查并入同条；词条计数勿手数，跑
  `node --test test/conventions.test.js` 的 GLOSSARY 断言（2026-11-14 起在库）。
