# 专注训练营 2.0 · 一期工单（本地 issue tracker 代理）

> 状态标记：`[ ]` 待认领 · `[~]` 进行中（子代理已派）· `[x]` 已并入 `feature/focus-revamp`
> **triage：ready-for-agent 已打**（本地 tracker 无标签系统，以本注记 + `[ ]` 状态等效）。
> 本文件是 implement-spec 流程的 tracker 代理：工单完成 = 分支并入集成分支 + 勾选状态。
>
> **上下文指针（实现者必读，勿复述）**
> - Spec（合同）：`docs/focus-revamp-spec.md`——Implementation Decisions 19 条 + Testing Decisions（测试缝已与用户确认，基线核对后零新缝）
> - 实现设计与全部数值：`docs/focus-revamp-design.md`（§2 难度曲线 D1~D5 · §3 战利品 L1~L6 · §4 观感清单 · §8 结构层 B1~B8）
> - 决策记录：`docs/adr/0002-focus-loot-integration.md`（共享背包推翻 D1 口径）
> - 工程规范：`AGENTS.md` 硬规则 + `docs/conventions.md`（§1.7 模块头 `====` 五要素；`-core` 必配同名单测）
> - 基线：音频重建已收官、探险模式已上线并经背包薄壳接入物品系统（训练营为共享背包第二消费方）
>
> **通用纪律（每单生效）**
> 1. worktree 基于 `feature/focus-revamp`（集成者建），开工前核对基点，不符则 `reset --hard` 回集成分支顶端。
> 2. 开发用 Skill 工具加载 `tdd` 技能（红绿重构）；加载失败则手动 TDD——新逻辑先写测试。
> 3. 中文注释；文件名 kebab-case；顶层默认 `const`，会被外部写的用 `let`。
> 4. **不改 `index.html`**：需要加载行时在报告/提交信息里声明「应在 index.html 哪一行之后加什么 script」，由集成者统一添加（boot 冒烟按 index.html 顺序执行，单一写入者防冲突）。
> 5. `npm test`（= `node --test`，无需 node_modules）在 worktree 全绿才算完；lint 由集成者合并时在主仓库统一跑。
> 6. 范围只限本单；发现的跨单问题写进报告，不顺手做。
> 7. 报告格式：分支名 / 提交哈希 / 测试结果 / index.html 加载声明 / 给后续工单的备注。不自行并入集成分支。

---

## 任务图

```mermaid
flowchart TD
    F1["F1 关卡曲线再平衡+数据表"]:::w1
    F2["F2 范式引擎新参数+事件缝"]:::w2
    F3["F3 背包壳对接核对(薄壳已存在)"]:::w1
    F4["F4 像素资产包(村长/图章/火苗)"]:::w1
    F5["F5 矿袋+战利品政策"]:::w3
    F6["F6 里程碑工具+宝物柜"]:::w3
    F7["F7 图章日历+集章解锁"]:::w3
    F8["F8 每日体检+魔鬼特训"]:::w3
    F9["F9 观感升级(矿洞皮肤/动效)"]:::w3
    F10["F10 回归收尾+GLOSSARY"]:::w4
    F1 --> F2
    F1 --> F5
    F2 --> F5
    F3 --> F5
    F3 --> F6
    F4 --> F6
    F1 --> F7
    F4 --> F7
    F1 --> F8
    F4 --> F8
    F4 --> F9
    F2 --> F10
    F5 --> F10
    F6 --> F10
    F7 --> F10
    F8 --> F10
    F9 --> F10
    classDef w1 fill:#e8f4e8
    classDef w2 fill:#e8f0fa
    classDef w3 fill:#faf0e8
    classDef w4 fill:#f0f0f0
```

---

## 第一波（frontier·可并行）

### F1 关卡曲线再平衡 + 数据表 `[x]`（并入 `54b5b6a`，478 全绿；给 F2 的参数形状备注见下）
- 备注（给 F2）：新参数 `disguiseRate`（gonogo，替代**已删除**的旧布尔 `disguised`，引擎接上前 tier≥8 无伪装安全不炸）/ `lenMix`（corsi 过渡档 0.5、次档 0.25）/ `antiChunk`（tier16 起 0.3→0.6）/ `neutralRate`（tier13 起 0.25）/ `mobMix`（tier15 起 0.3）/ `bivalent`（tier8 起 0.5→1.0）/ `switchJitter`（tier≥14 布尔）/ `choices`（4|5）/ `gem`（奇偶轮换，paramsFor 第三参 `li`）；`FOCUS_LOOT[dim]={pool,rare}`、`FOCUS_CHECK_PARAMS=[{dim,params}]` 可直接喂 runFocusLevel、`focusFlame(acc,baseline)→{flame,brighter}`、`devilParams(dim,tier)`。形状权威= focus-levels.js 头注释。
- 依赖：无。
- 交付：关卡参数表的 paramsFor 五维新曲线与全部新参数（伪装率 disguiseRate / 长度混编 lenMix / 反组块 antiChunk / 中立行 neutralRate / 混生物 mobMix / 双价 bivalent / 切换抖动 switchJitter / 选项数 choices / 宝石轮换 gem）+ FOCUS_LOOT 五维掉落表与稀有池 + FOCUS_MILESTONES 里程碑工具表 + FOCUS_CHECK_PARAMS 体检短参数 + 纯函数 focusFlame(acc, baseline)（火苗三档）与 devilStep(level, acc)（鬼等级双阈进退）+ 图章/集章里程碑数据。数值全部照抄设计稿 §2 D1~D5、§3 L3/L4、§8 B3/B8，不自创。
- 测试（范式引擎 vm 缝扩展）：**渐进无断层断言族**——每个 qualitative 参数在引入档必须 0<值<1、单调不降至封顶（"qualitative 跳变必须混编"由此锁死）；档位边界（corsi len≤6 且 grid16 仅 tier≥14；flanker len≤9 且 len9 仅 tier≥18、congruentRate≥0.35、window≥1500；switch rules≤3、choices∈{4,5}）；掉落表概率和=1 且全部 id 在 ITEMS 注册（交叉断言，先例：物品系统掉落表测试）且 stackMax>0；里程碑 6 条且 isTool 全真；focusFlame 边界（85/70）；devilStep 边界（85↑/66 保持/65↓、等级 1 不下探、10 不上溢）；体检参数时长上界（试次数×时长封顶）；既有测试（门槛/编排/三星/自适应）必须原样全绿。
- 备注：gonogo 规则文案随 disguiseRate 改为「钻石快挖！别的矿和 TNT 都不要碰。」；focusTip 同步微调。

### F3 背包壳对接核对（薄壳已存在）`[x]`（并入 `0f0efd6`，选型 B 口径已回填 spec/工单/设计稿）
- 依赖：无。
- 现状：`js/backpack.js` 已由 code-review 轮 S6 装配（`mkBackpack()→{inv, load 原地换槽, save}`，
  存档键唯一持有，ADR 0002），index.html 已挂载，`test/backpack.test.js` 已存在——**本单不新建文件不加新缝**。
- 交付：训练营接入核对——①授予流走背包核心纯函数直接作用于 `bp.inv` + `bp.save()`（不在壳上叠包装）；②宝物柜渲染落在训练营模式层（分组网格 + iconOf + 数量角标）；③**混装容量核定**：与探险模式共用 27 槽，复核「里程碑 6 件工具 + 双模式战利品」的容量共存；不足则里程碑工具改存宝物柜展示位不占背包槽（在报告里写明选型）；④满包语义核对（add 返余量>0 → 静默忽略 + 每关至多一次 toast，政策归 F5）。
- 测试：既有 `test/backpack.test.js` 保持全绿；本单不新增缝。
- 备注（F3 核定结论，供 F5/F6 执行）：①授予流核对无障碍——`add(bp.inv, id, n)` 返余量 +
  `bp.save()` 直接成立（`inv` 引用跨 load 稳定，模式层闭包不脱钩）；口径 = 进训练营 `init()` 时
  `bp.load()` 一次（双消费方共用存档介质，重进必重读，探险同款），授予即 save（频率低、
  训练营无 5s 节流基础设施、掉档窗口最小），不批量。②满包语义落点 = 模式层直接用 `add` 后
  忽略余量（部分入包已发生且无害，无需容量预检），`left > 0` 触发每关至多一次 toast，零改壳。
  ③混装容量核定：可堆叠种类并集 35 = 探险 33（挖掘 22 + 击杀 6 + 烧炼 4 + 合成 tnt 1，全部
  stackMax=64）+ 专注新增仅 bone_meal/bread 2（FOCUS_LOOT 其余 16 id 全与探险重叠）；再加探险
  工具同时持有 1~3（stackMax=1，会破板自愈）+ 里程碑 6 件不并堆（训练营只产不耗 = 永久死占用），
  稳态最坏 ~35 槽 > 27，**余量不足 → 选型 B：里程碑工具改存宝物柜展示位、不占背包槽**（附带
  免疫「白送铁镐/钻镐贬值探险合成任务链」；走 B 后典型占用 20~25 槽，贴 24/27 快满线但全部
  有消耗出口可自愈 + 满包静默兜底）。**F6 口径**：授予仪式照旧但不经 `add`，记账进训练营存档
  新增 `tools` 字段（已授 id 集合；存量补授 = 里程碑表与该字段的差集，幂等），宝物柜工具组从
  该字段渲染——训练营存档新增字段由三块变四块（spec 第 17 条随之 +1）。

### F4 像素资产包 `[x]`（并入 `9fb0896`，接口：`chiefFace(mood∈smile|cheer|sleepy|devil)` · `stampIcon(kind∈pick|gem|tnt|big|gold|devil)` · `flameIcon(level∈1|2|3)`）
- 依赖：无。
- 交付：训练营像素图标库扩充——训练师村长三表情（微笑/喝彩/打盹，白胡子+矿工帽+头灯，16×16→96px 既有管线）+ 鬼化变体（矿工帽加鬼角+坏笑）；图章组（⛏️💎🧨 三图案 + 大图章 + 金图章 + 鬼图章）；火苗三态（小/中/大，做摇曳帧基础图）。中立头像（猪/羊）**仅当 F2 报告声明怪物库头像接口不合用时**补画。
- 测试：像素图标库无直测惯例——boot 冒烟兜底；函数形状沿用既有缓存模式（同键只画一次）。

---

## 第二波

### F2 范式引擎新参数 + 逐试次事件缝 `[ ]`
- 依赖：F1（paramsFor 形状）。
- 交付：①判别引擎：No-Go 逐试次按 disguiseRate 掷骰伪装（绿宝石/TNT）、noSet 扩充 coal/iron_ore；②Corsi：lenMix 过渡档混出上一档长度、antiChunk 序列展示前按概率打乱格位（打乱后格子互异、序列仍可解）、gem 轮换；③Flanker：len9 小尺寸档、neutralRate 中立行、mobMix 行内混入非苦力怕生物；④Switch：tier≥10 五选项、bivalent 无关维度匹配（颜色规则下干扰项与目标同大小 / 大小规则下干扰项用目标同族图标）、switchJitter 随机切换间隔；⑤handler 契约新增**可选** `onTrial({ok, streak, dim})`——不传零影响，引擎不知道奖励存在（分层红线）。
- 测试（vm 缝行为断言）：disguiseRate=0 时整局无伪装出现；lenMix 过渡档确实产出两种长度；antiChunk 打乱不产生重复格位；onTrial 每试次恰一次且字段正确（教学演示不计）；既有全绿。
- 备注：**开工第一件事验证怪物库头像接口形状**（Mobs.face 返回 HTML 片段 or URL）；中立行优先复用它，不合用则报告声明、由 F4 补画接管。

---

## 第三波（可并行）

### F5 矿袋 + 战利品政策 `[ ]`
- 依赖：F1（掉落表）、F2（事件缝）、F3（背包对接核对）。
- 交付：训练营模式层接 onTrial→按 FOCUS_LOOT 掷骰（正确 p=0.45 / 3 连对保底稀有池 / 教学关豁免 / 通关 torch|apple 二选一 / 三星追加 1 钻石）→ 背包核心 add 作用于 bp.inv + bp.save → 矿袋 HUD 槽位飞入动画（贝塞尔弧线，复刻掉落物真空吸附观感）+ 落袋音；结算页战利品列队回顾；满包静默忽略 + 每关至多一次 toast「背包满啦」。
- 测试：掷骰政策抽成种子可注入的顶层纯函数进 vm 缝（概率边界/保底触发/豁免分支/满包余量）；DOM 动画不直测。
- 数值：设计稿 §3 L3 + §4。

### F6 里程碑工具 + 宝物柜 `[x]`（并入 `94ba69b`，接口：`tools:string[]` 字段 · `focusGrantMilestones(save)→due[]` 幂等差集 · `showFocusAward(ids,after)` 仪式串播 · `focusBackfillMilestones(after)` 存量补授 · `focusProgress(save)` 有效通关数（大师关封顶兜底，F8 复用勿开第二口径） · `showFocusCabinet()` 收集柜（数据源=focusBag+tools 字段））
- 依赖：F3、F4。
- 交付：unlocked 首次越线 → 全屏授予仪式（像素工具大图 + level 琶音 + TTS「你获得了铁镐！」）；**存量档按当前 unlocked 一次性补授、不重授**；**工具不进共享背包（F3 核定选型 B）**——记账进训练营存档 `tools` 字段（补授=里程碑表与已授差集，幂等），宝物柜工具组从该字段渲染；今日页 🎒 宝物柜：分组网格（材料/矿物/食物/工具/方块）+ 数量角标 + 点击 TTS 读物品名 + 村长导览台词。
- 测试：补授幂等纯函数进 vm 缝（对既有档计算应授集合=里程碑表与已授的差集）。

### F7 图章日历 + 集章解锁 `[x]`（并入 `9c25b5a`，接口：`stamps={日期:当日关数(1~6 取 max)}` · `stampClaimed=[达成线]` · 纯函数 stampRecord/stampTrim/stampCount/stampMilestones/stampRewardsDue · 常量 FOCUS_STAMP_KIND/FOCUS_STAMP_KEEP_DAYS · 钩子 `body.f-bag-iron`（F5 消费）。**给 F8**：鬼章同日落 stamps 取 max（每天至多 1 章的并集口径，勿双计）；checks/devil 滚动裁剪复用 FOCUS_STAMP_KEEP_DAYS 同型）
- 依赖：F1、F4。
- 交付：今日页本月日历条——当日完成 ≥1 关得像素图章、满 3 关大图章、漏签**无任何负面标记**；stamps 记录滚动 90 天；集章里程碑（3/7/14/30…章）授予观感奖励（自选图章图案/矿袋皮肤/宝物柜烟花/金图章）+ 村长仪式。**红线：永不解锁关卡/范式/难度**。
- 测试：落账（当日计数 1~6 钳制）/ 裁剪 / 集章计数纯函数进 vm 缝。

### F8 每日体检 + 魔鬼特训 `[x]`（并入 `7957e5e`，接口：`checks={日期:{acc,flame}}` · `devil={levels,days}` · 纯函数 focusDayIndex/trimFocusLog/devilDimFor/focusCheckEntry/checkBaseline/devilEntry/devilTierFor · 常量 FOCUS_LOG_KEEP_DAYS/FOCUS_DEVIL_TIME_MS · check 走 focusDispatch sections 连跑；基线窗口=近 7 天不含今天；两 KEEP_DAYS 同值分立可由 F10 收口）
- 依赖：F1（体检参数/火苗/鬼等级阶梯）、F4（鬼化村长）。
- 交付：①体检——今日页「🔥 今日体检」每日一次约 90 秒，复用大师关五维连跑机制（sections 短参数），产出三档探险家火苗（≥85 大/≥70 中/其余小，小火苗配中性温暖文案）；只与自己近 7 天均值比、只显示变亮；计入时长**不占**关数额度；当日做完入口消失。②魔鬼特训——「👹 魔鬼特训」每日一次 **5 分钟硬顶**（到点当前小节打完强制结束、当日锁定）；计 2 关额度 + 计入时长；维度按日轮换（天数%5）；参数取当前档+2（封顶 19），mkAdapt 与挫败阀照常生效（失败无扣损/重置）；每维度鬼等级 1~10 按双阈进退，降级文案中性（鬼村长坏笑「下次再来！」）；通关得鬼图章。checks/devil 记录滚动 90 天。
- 测试：入口锁定与计费决策、时长上界、轮换维度选择纯函数进 vm 缝。
- 数值：设计稿 §8 B3/B8；不搬 n-back（合同 Out of Scope）。

### F9 观感升级 `[x]`（并入 `0600194`，F5/F8 挂钩：`.f-streak(+.bump)` 连对 · `.f-flame-sway` 火苗摇曳 · 游标 `#fProgCursor` 设 left:% · 皮肤变量 `--f-atlas/--f-tile-stone/--f-tile-cobble/--f-tile-dirt`；prefers-reduced-motion 全域降级）
- 依赖：F4。
- 交付：训练场矿洞皮肤（贴图图集 makeCanvas→dataURL→CSS 雪碧，石头带/圆石带/顶缘泥土/四角火把贴片闪烁）；MC 立体按钮（亮暗边 bevel+按压位移）；进度条分段刻度+⛏️游标；连对⛏️×N 弹跳+琶音；三星爆星粒子；今日页/星屏像素云缓移。
- 测试：不直测——boot 冒烟 + 手工验收（node server.js 起 8080 逐屏走查）；可与逻辑工单分提交降低回归压力。

---

## 第四波

### F10 回归收尾 + GLOSSARY `[ ]`
- 备注（F6 转记）：宝物柜工具组只认 `tools` 字段——探险合成所得工具不进柜（选型 B 口径），是否补充该展示在此再议并记录结论。
- 备注（F9 转记）：①**lint 债**——集成分支 eslint 既有 60 错待集成者收（F4 focus-icons no-multi-spaces×56+indent×4、F1 focus-levels max-len×1、F6 modes/focus.js:329 brace-style/block-spacing×4），stylelint 已过；②**真人走查三项**——corisi 4×4/flanker len9 下石壁对比度、底部火把光晕是否干扰刺激、游标窄屏（80vw）两端裁切。
- 依赖：全部。
- 交付：index.html 加载声明核对（仅背包壳一行，位置见 F3）；GLOSSARY 词条（共享背包 Backpack/矿袋/宝物柜/图章日历/魔鬼特训/训练师村长，含 _Avoid_ 别名）；核对 item-crafting-design 变更记录与 ADR 0002 交叉引用；npm test + npm run lint 全绿汇总。
- 手工验收剧本（设计稿 §6）：造档 L37/L49 体验伪装渐入与长度混编的坡道感；矿袋飞行/3 连保底/结算回顾/宝物柜计数/满包 toast 一次性；unlocked=50 存量档首入补授铁镐；顶格关（tier 18/19）len9 行宽与双价干扰可读性；家长面板 CSV 列与免责声明不变。
- 首周观察项：魔鬼特训鬼等级分布——某维度连续降级占多数则该维度挑战档回退 +1（设计稿 §8 风险条款）。
