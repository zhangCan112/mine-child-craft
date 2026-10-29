# 专注训练营·范式扩展与交互证据研究（focus-interaction-research）

> 研究型文档：为「专注训练营」在现有五维（CPT / Go/No-Go / Flanker / Corsi / Card Sort 类切换）之外
> 评估**可新增的训练范式**、儿童 UI 设计证据与习惯/家长参与机制，全部追到一手来源。
> 红线背景（不变）：纯鼠标点选、零文字依赖（图标+中文 TTS）、单关 2-3 分钟、每日 6 关/20 分钟、
> 零惩罚零倒计时压迫、n-back 排除、桌面鼠标、宣称口径诚实（技能练习，不提治疗 ADHD/提智商）。
> 本文只整理证据与可操作建议，不改代码。检索与访问日期：**2026-10-29**。

---

## 0. TL;DR 结论表

| # | 候选范式/机制 | 6 岁适用判定 | 与现有五维重叠 | 证据强度（一手） | 关键来源 |
| --- | --- | --- | --- | --- | --- |
| A1 | 视觉划消/扫描（Balloon Hunt/Map Mission 系） | **适合，首推** | 低（自定步调大集合搜索 ≠ 干扰下反应） | 强（5-7 岁常模测验子测验） | [10][11][12] |
| A1b | 视觉搜索 present/absent（Hide & Seek Visual 系） | **适合**（与 A1 同范式双模式） | 低-中 | 强 | [10][24][25] |
| A2 | 听觉持续注意（数狗叫 Barking 系）+ 听觉目标检测 | **适合**（项目有音频/TTS 通道） | 中（同"持续"构念、异通道） | 强 | [10][13] |
| A3 | 停止信号任务（SST） | 谨慎：可测不可靠计分；建议做 gonogo 高级变体而非新维度 | 高（抑制控制同构念） | 中 | [15][16][17] |
| A3b | SART | **不适合**独立成模（6 岁误击率高、易挫败；评估工具可用≠训练可玩） | 高（持续+抑制双要素） | 中 | [10][20] |
| A4 | 双任务/分散注意（Troy Dual Task 系） | **不适合**（临床常模 8+ 才施测） | — | 强（结构证据） | [10][21][22][23] |
| A5 | 加工速度/简单 RT 训练 | **不适合**独立成模（只有近迁移；TEA-Ch2 仅作基线） | 高 | 强（元分析级） | [30][31][32][33] |
| A6 | 平滑 pursuit/视追踪 | **不适合**（7-8 岁才接近成人；需眼动仪；鼠标追踪是另一构念） | — | 中 | [29] |
| B1 | SSME 式"稳定个体化难度"自适应 | 已部分实现（mkAdapt）；方向校正：**稳定化优先于均匀加难** | — | 强 | [1][3][9] |
| B2 | 非读者 UI 规范（热区/双通道指令/触底即响应/底边避让） | 适合 | — | 强（Sesame 50+ 研究 + 指向运动学） | [44][45][51][52] |
| B3 | 过程性表扬（不夸聪明） | 适合，落在反馈句式 | — | 强 | [40][41][42][43] |
| B4 | 会话节奏（25 分钟/日处方、关内短块、关间休息） | 现行 6×2-3min 在证据带内 | — | 强 | [1][3][4][13][45] |
| C1 | 习惯：固定情境+周 5 节奏+**断签不惩罚**+集章/地图可视化 | 适合（断签不罚有数据背书） | — | 强 | [48][53][54] |
| C2 | 家长参与：教练模型 + 家长端报"努力与完成" | 适合（现有家长面板方向正确） | — | 强 | [3][37][38][39] |
| ❌ | "EndeavorRx Select"（任务书提到的动机机制） | **查无此产品**（官方仅 Rx 与 OTC 两条产品线） | — | — | [3][4][5] |

---

## 1. 背景：现有五维与临床坐标

现有五维按构念对应临床持续型注意测评的结构：cpt=持续警觉、gonogo=抑制控制、flanker=干扰控制（选择性注意下的干扰抑制）、corsi=视空记忆、switch=规则切换。

一个重要的第一方结构事实：**TEA-Ch2（英国金标准儿童注意测验，2016 出版）把 5-7 岁版本（TEA-Ch2 J）的子测验只分为"选择性注意"与"持续性注意"两个域**——切换类（Red & Blues）与双任务类（Troy Dual Task）子测验**只出现在 8 岁以上版本（TEA-Ch2 A）**[10][11]。这给两条设计提示：

1. 6 岁可可靠施测/游戏化的"新范式池"基本就是 J 版子测验覆盖的构念：**划消、视觉搜索、听觉持续注意、听觉目标检测、（评估用的）SART 与简单 RT**；
2. 现有五维里的 switch 在 6 岁已属"超前满配"（与 Davidson 2006 的结论一致，见 focus-revamp-design），扩展重心应放在选择性注意（划消/搜索）与跨通道持续注意，而不是继续加执行控制类范式。

---

## 2. A 块：可新增的训练范式逐一评估

### A1 · 视觉划消 / 视觉扫描（cancellation / visual scanning）——首推

| 维度 | 评估 |
| --- | --- |
| 范式名 | Cancellation / targeted visual search（TEA-Ch2 J: Balloon Hunt, Balloons 5；TEA-Ch: Sky Search, Map Mission） |
| 认知目标 | 选择性注意 + 系统视觉扫描 + 搜索速度；自定步调下的注意维持 |
| 适用年龄证据 | **TEA-Ch2 J（5-7 岁）正式子测验**：Balloon Hunt = 4 个 15 秒时限回合，前两回合只有目标气球、后两回合混入干扰物；Balloons 5 = 同页不限时记录用时 [10]。上一代 TEA-Ch 对 6-16 岁 293 名常模儿童的因子分析把 Sky Search 归入"选择性注意"独立因子 [12]。K-CPT2（4-7 岁）也证明**图片刺激**（船/火车/球）在学前段可作 CPT 目标材料 [13][14] |
| 参数设计要点 | 短时限回合（15s/回合 × 2-4 回合）；难度轴 = ① 干扰物密度，② 目标-干扰特征相似度（同形异色 → 同色异形 → 双特征联合）；TEA-Ch2 A 版还提供了"密度梯度"的对照组设计（3 档密度重复呈现）[10]，可直接抄成 tier 曲线 |
| 6 岁纯鼠标零文字适配 | **极易**：点选目标即可，无时窗压迫（自定步调），天然满足零文字（目标用单个图标示例呈现，TTS 一句"把所有 XX 找出来"） |
| 与五维重叠 | **低**。Flanker 是"强制步调 + 邻近干扰下对中心目标反应"，划消是"自定步调 + 大集合扫描"；TEA-Ch2 的结构效度分析（SEM）把两者分属不同因子 [10] |

发展证据（决定干扰物怎么画）：联合搜索（需要整合两个特征）在儿童期持续变快，且**跨视觉通路整合（如颜色×运动）在 6 岁前后仍有额外成本**，到学龄中期才与同通路整合持平 [24]；儿童搜索速度显著慢于成人，7→10 岁才接近成人 [25][27]；ADHD/CVI 儿童的视觉搜索薄弱点综述见 [26]。→ 6 岁起步：单一特征目标 + 少量单特征干扰；高 tier 才引入轻度联合特征（同色系形状区分）。另注意色盲安全：EndeavorRx 的 IFU 明确警示色盲不适用 [3]，Lynn 等的儿童搜索研究直接剔除色盲儿童 [24]——本项目图标色板应避免纯红-绿对立编码（现有四阶工具色板同形异色方案天然安全）。

### A1b · 视觉搜索 present/absent（限时探测）——与 A1 同范式双模式

TEA-Ch2 J 的 Hide and Seek Visual：看一系列面板，在限时内报告"目标在不在"，**不要求精确点中、无动作成本**，专门测"干扰堆里的探测" [10]。学术版在 4-10 岁儿童可靠施测（89 人，含 target-absent 试次与 d' 计分）[24]；3-5 岁适配版 CPT 也有先例（Fisher et al. 2012，降刺激率、简化反应）[28]。

- 游戏化：矿洞"有没有钻石"快照关（有→点、无→点确认筐），与 A1（找完全部）构成"探测/扫描"双模式；
- 与 CPT 的区别：试次离散、无 ISI 连发，考核的是单次搜索决策，构念归"选择性注意"[10]。

### A2 · 听觉持续注意与听觉目标检测（Barking / Hide & Seek Auditory 系）——推荐（补通道）

| 维度 | 评估 |
| --- | --- |
| 范式名 | 听觉计数持续注意（TEA-Ch: Score!；TEA-Ch2 J: Barking）；听觉目标检测+听觉干扰（TEA-Ch2 J: Hide and Seek Auditory） |
| 认知目标 | **自主维持**注意（无新颖刺激自抓注意的"慢而无聊"任务）+ 跨通道注意分配 |
| 适用年龄证据 | **TEA-Ch2 J（5-7 岁）正式子测验**：Barking = 升调开场音后数一段间隔很长的狗叫声，降调收尾音后报数；官方说明"长间隔"是有意设计——任务"不抓"注意力，考核自我维持 [10]。Hide and Seek Auditory = 听短音片段，听到狗叫尽快按键，忽略其他动物叫声干扰 [10]。5-7 岁常模样本 394 人 [10] |
| 参数设计要点 | 声音间隔要**长**（秒级，官方设计意图就是" dull "）；每回合报一个总数而非逐声反应（Barking），或逐声按键（Auditory）；干扰声与目标声要在音色上可分（动物叫声天然可分） |
| 6 岁纯鼠标零文字适配 | **中**：报总数需要答案按钮组（用图标数量或格子点选，避免读数）——可以用"点选等量矿石堆"的图标化答案；逐声按键版本更简单（听到狗叫点一下）。项目已有音频/TTS 基建（game-audio），成本可控 |
| 与五维重叠 | 中：与 cpt 同属"持续"域但**异通道**（现五维全视觉）；跨通道版本对视觉疲劳和"看-听切换"是真实增量的构念，TEA-Ch2 结构分析把听觉分测与视觉分测同归"持续注意"但贡献独立子分数 [10] |

注意：TTS/合成音在"长间隔计数"里要保证音色一致性（目标音恒定同一采样，避免 TTS 每次合成音色漂移，那是知觉干扰而非注意需求）。Conners 系的听觉 CPT（CATA）从 8 岁起测 [13]，5-7 岁段的一手常模依据就是 TEA-Ch2 J 这两个子测验 [10]。

### A3 · 停止信号任务（stop-signal task）

| 维度 | 评估 |
| --- | --- |
| 认知目标 | 反应抑制的**反应式**成分（SSRT）+ 由停止概率驱动的**前瞻式**（proactive）抑制调节 |
| 适用年龄证据 | 3.5-4 岁用儿童版（简化刺激、自适应停止延迟）已能可靠测出早期抑制控制 [15]；Carver 等 2001 专为低龄改造过流程 [16]；6-17 岁 13,709 人大样本显示停止试次上的 RT 调节（前瞻抑制）在学龄期仍在发展 [17]。**但**：SSRT 计分要求"停止成功率≈50% 的阶梯收敛"，6 岁儿童反应时方差大、阶梯常不收敛，个体分数噪声大（eLife 对 ABCD 大样本数据的同类问题清单 [未直接计分儿童，方法学警示同源]） |
| 参数设计要点 | 若做：go 刺激用强吸引图标、停止信号用统一音效；停止延迟按天自适应而非按试次阶梯（绕开单关不收敛问题）；放弃 SSRT 计分，改用"停住成功率" |
| 适配难度 | 中：交互简单（点/不点），但"信号后立刻停"与现有 gonogo 的差别（延迟停止窗口）对 6 岁在理解上多一层 |
| 与五维重叠 | **高**（与 gonogo 同为抑制控制；增量在"前瞻调节"）。建议作为 gonogo 的 tier≥12 变体（TNT 已经"点了会炸"——把引信延迟 300-500ms 再落，就是儿童版 stop-signal），**不单列第六维** |

### A3b · SART —— 不适合独立成模

SART（对多数刺激持续快反应、对 rare 目标 withhold）在 TEA-Ch2 J 里有（图形流、跟 cue 同步按键、对某一形状抑制）[10]，6/8/10 岁横断研究显示 6 岁已能做但误击（commission error）显著更多 [20]；6→8 岁在不可预测 Go/No-Go 上有实质性发展台阶，可预测任务上的持续注意也在这一窗口继续爬坡 [18][19]。问题：作为**评估**它有常模，作为**训练**它把"高误击"当常态——与我们"零惩罚、失败感最低化"红线冲突，且构念与 cpt+gonogo 高度重合。**结论：不做**。其"跟节拍反应"的玩法糖衣（对齐 cue 再点）可以单独借给 A2 听觉任务做手感（节拍对齐只是表现层，不承担抑制计分）。

### A4 · 双任务 / 分散注意（divided attention）——不适合 6 岁

- **第一方结构证据（最强）**：TEA-Ch2 的双任务子测验 Troy Dual Task（划消+听计数同时做）**只在 8 岁以上版本施测**；5-7 岁版本完全没有双任务子测验 [10]。上一代 TEA-Ch 的 Sky Search DT 同样不是低龄段核心分测验 [12]。
- 学术证据：双任务代价在儿童显著大于成人，且随年龄单调缩小 [21]；认知-运动双任务表现由工作记忆承载、整个童年期仍在发展 [22]；2024 年综述结论一致（儿童双任务干扰 > 成人）[23]。
- **结论：不进 6 岁范围**。可作为产品 8+ 岁扩展时的第一候选（届时直接对标 Troy Dual Task 的"扫描+听计数"结构 [10]）。

### A5 · 加工速度 / 简单 RT 训练——不适合独立成模

- TEA-Ch2 J 里 Simple RT 只是**基线测量**（蓝色圆点出现就按空格），不参与"训练"叙事 [10]。
- 训练证据边界：认知训练元分析一致显示**只有近迁移、无远迁移**——儿童 EF 训练近迁移 g≈0.44、远迁移（含未训练成分）g≈0.11 不显著 [33]；WM 训练对智力/远端测量的元分析为零 [36]；11,430 人在线"脑训练"无未训练任务迁移 [35]；二阶元分析把"无远迁移"确认为认知训练的普遍图景 [31][32]。Egeland 2013 里唯一显著改善的"远端"测量恰恰是加工速度复合分——即最近迁移的那一项 [30]。
- **结论**：简单 RT 不做成训练模式；项目现行的"反应时趋势"家长面板指标已经是它的正确用途（测量校准），保持现状。

### A6 · 平滑追踪 / 视追踪（smooth pursuit）类——不适合

平滑 pursuit 需眼动仪测量，儿童到 **7-8 岁才出现成人样平滑追踪，10 岁左右成熟** [29]；且"用鼠标追一个移动目标"是视动协调任务，与眼动 pursuit 不是同一构念，儿童训练证据为空白（未找到任何一手来源支持鼠标追踪能训练儿童注意）。项目约束也是桌面鼠标点选，不做持续按住拖动。**结论：不做**。（EndeavorRx 的"追踪锁住生物"是其专有引擎下的玩法，我们已有的 CPT/gonogo 已覆盖其注意内核。）

### A7 · 商业产品与临床工具对照表

| 产品/工具 | 用什么范式 | 年龄段 | 对我们的可取点 |
| --- | --- | --- | --- |
| EndeavorRx（Akili，FDA De Novo DEN200026，现适应证 8-17）[1][2][3][5] | 单一核心循环：倾斜转向 + 触点选目标（只点指定颜色目标、忽略其他）+ 同时的感觉干扰流；SSME 闭环调两个难度轴 | 8-17（授权）；AKL-T02 为自闭谱系适配版（同引擎同 UI、难度曲线另调）[3] | ① 处方剂量 25 分钟/天 × 每周 5 天，**每日用完即锁** [1][3]；② "没有通关"——难度永远校准到与个人水平一致的挑战带 [3]；③ 控制组复刻奖励但去掉 SSME，效果弱于治疗组（治疗内核是自适应干扰，不是奖励）[1][7] |
| EndeavorOTC（18+ 非处方版）[4] | 同 AKL-T01 引擎 | 成人 | 10-25 分钟/天 × 至少 5 天/周 × 6 周；收集 15 个 Guide 解锁新世界、约 4 周解锁全部，之后 Expert Mode 回访刷分 |
| Cogmed（工作记忆训练）[38] | 视空/言语 WM 广度任务（自适应 span），25 次 × 30-40 分钟 × 5 周，教练每周电话随访 | 学前版 JM 10-15 分钟（二手来源：[60][61]，官方手册未给 JM 分版时长——如实标注）；RM 7 岁+ | ① 教练/家长参与是交付标配；② 但证据口径要诚实：严格对照后只有 WM 近迁移维持（Chacko 2014 [37]；元分析远迁移为零 [36][34]）——**因此不引入 Cogmed 式 WM 新维度**，也再次支持 n-back 排除 |
| K-CPT2（Conners Kiddie CPT 2）[13][14] | 图片 CPT：对船/火车等图片反应、对足球（唯一非目标）抑制；**200 试次、5 block，每 block 内 1.5s 与 3s 两种 ISI 各 20 试次混排**（防节奏预测）；全程 **7.5 分钟** | 4-7 | ① 4-7 岁单块注意任务 7.5 分钟封顶 → 我们单关 2-3 分钟有充分余量；② 双 ISI 混排防预测——可给 cpt 的 ISI 曲线做顶格校准参考；③ 非阅读图片刺激是学前 CPT 的标准做法，佐证本项目纯图标路线 |
| TEA-Ch2（Pearson，2016）[10][11] | J 版（5-7）：划消×2、视觉搜索、听觉计数、SART、简单 RT、听觉目标检测；A 版（8+）：取消/搜索 + 双任务 + 切换 | 5-15 | **6 岁可游戏化子测验清单的直接权威**；动机包装同样值得抄：漫画故事串联 + 星星贴纸 + 证书 [10]（与我们村长/图章/宝物柜同构，第三方临床测验都承认低龄需要这些） |
| 任天堂《脑锻炼》系列 [48][50] | 每日训练 + **图章日历**（练一天盖一章，**多练不多盖**）+ 脑年龄图 + 3DS《Devilish Brain Training》（专注/工作记忆向的每日挑战） | 全年龄 | 项目图章日历与魔鬼特训的第一方同构先例；"多练不多章"正是防沉迷的正确形态（官方规则原文见 §4.1） |

---

## 3. B 块：儿童训练游戏的交互/UI 设计

### B1 · EndeavorRx 的自适应与动机呈现（一手：FDA 摘要 + 两份 IFU + 官网）

**SSME 引擎**[1][3][6]：
- 闭环算法**实时（逐秒监控）与跨会话**两级调整难度，"把每个患者持续推在预先定义的个人表现边界上，鼓励超越自己的历史表现"（DEN200026 原文 [1]；其科学与引擎谱系即 UCSF NeuroRacer/Project: EVO 一线 [8]）；
- IFU 对玩家的表述："与其他动作游戏不同，EndeavorRx **没有通关**——游戏持续调整以维持与玩家当前水平一致的恒定难度带，只要尽力玩就是在按设计接受治疗" [3]；
- 治疗内核与奖励分离：STARS-ADHD 的控制组刻意复刻奖励/参与设计但换掉 SSME 刺激，主要终点改善弱于治疗组 [1][7]；2026 年 JMIR 二次分析进一步建议自适应算法应**优先稳定化与个体化难度，而不是均匀或单调递增的难度日程** [9]。

**对项目的映射**：mkAdapt 的 calib 杠杆 + 三星校准带已是同构实现；校正方向与 focus-revamp-design 的"台阶变坡道"一致——**自适应的目标函数是"稳定在个人 70-85% 通过带"，不是把难度单调拉高** [9]。魔鬼特训（85/66 双阈）属于"超带挑战块"，与 JMIR 结论不冲突的前提是它**每日一次、可选、独立计分**（现状如此）。

**动机/选择机制**（IFU 一手细节）[3][4]：
- **Mission Minutes**：主屏显示 25 分钟倒计时，只计玩法时间（逛非任务区不扣）；当日用完 → 发当日奖励并**不能再开新任务**（硬锁防滥用）[1][3]；
- **进度结构**：捕获生物得宝石，15 宝石解锁一个新世界，设计上约 4 周解锁全部世界；解锁后自由重访刷分（Expert Mode）[3][4]；
- **收集经济**：生物进"太空农场"→ 不同生物各有专属巢穴 → 巢穴产出 Boost → 出征前**自己装备** Boost（有限库存按等级解锁）；奖励可在商店换装扮（cosmetic sink）[3]——与本项目"战利品→矿袋→宝物柜→里程碑工具"的回路逐环同构；
- **任务间内建休息**（"There are built-in rest periods between missions"）[3]；
- **家长端（EndeavorRx Insight）只报"每日努力与关卡完成"**（"track daily efforts and level completion"）[5]，不展示排名、不展示与别人孩子的比较；
- 官方给家长的话术："**这游戏本来就该是难的**（It's supposed to be difficult），孩子受挫时请鼓励他继续投入努力" [3][5]。
- **"EndeavorRx Select" 查无此产品**：截至 2026-10-29，Akili 官方产品线只有处方版 EndeavorRx（8-17 岁）与非处方版 EndeavorOTC（18+）[3][4][5]；"Select 动机机制"未找到任何一手来源。任务书中的"Select"按其字面动机机制理解时，一手可考的对应物就是上列"装备 Boost / 挑装扮 / 已解锁世界内自选环境"这些**自主选择点**（选择权全部布置在**训练块之外**，训练块内不插入选择——这一点值得本项目遵守：选装备在进关前，关卡内零菜单）。

### B2 · 非读者儿童 UI 权威指南（逐条给一手出处）

**Sesame Workshop《Best Practices: Designing Touch Tablet Experiences for Preschoolers》（2012，基于 40+ 年媒体测试、20+ 年数字平台测试、50+ 触屏研究）**[44]——虽为触屏场景写成，以下条款可迁移到鼠标（迁移注意见后）：

| 条款（原文要点） | 本项目落地 |
| --- | --- |
| 假设学前儿童**不识字**；主指令口播+视觉双通道 | 已满足（TTS+图标）；保持 |
| 指令**简短、关键动作放句尾**（"To give Elmo a crayon, tap on the X!"） | TTS 文案检查点：动作词收尾（"点金块！快！"而非"快地去点那个金块哦"） |
| 无文字 Help；用**情境化语音提示**；给家长写 How-To | 村长语音提示已有；家长面板补"怎么陪玩"一节（§C2） |
| **Time-out 提示**：故事 3-5 秒、游戏 6-8 秒无操作后给出下一步提示 | 训练关内不做（防倒计时压迫感），但在**过场/宝物柜**可做 8 秒静止提示 |
| 错误反馈 = **三级脚手架的"学习时刻"**：①指出+鼓励 ②重述目标+提示 ③重述+**高亮正确答案**；绝不惩罚 | 训练计分关不适用（错=漏，无即时纠错）；**教学关/新范式首关**照此实现（新范式教学成本大降） |
| 正确反馈要**指向孩子的选择/行为**（"Nice job **choosing** the letter A!"）+ 音效 + 动画 | 现有连对琶音/爆星符合；句式校准见 §B3 |
| 热区**大且互相隔离**；可点元素要"看起来就能点"（黄色高亮/描边/微动画），**不可点时不要长得能点** | 训练图标已是命中区大图标；按钮态三态（normal/hover 可点/不可点变灰）需要对齐"只有能点时才亮"原则 |
| 屏幕底边不放活动图标（儿童手腕搁底边易误触） | 鼠标场景误触不存在，但**底部横条**（矿袋/进度条）应保持非交互装饰定位——现状正确 |
| 竖向滚动对儿童反直觉；重要交互首屏可见 | 训练场单屏无滚动——现状正确 |
| 交互注册要在**触点即响应**（touch-down 而非抬手） | 鼠标等价物：**mousedown 即判定**比 click（mouseup）体感更快；需评估现有 handler 是否 mousedown（若为 click，在 6 岁"连点"场景会放大迟滞感）[44] |
| 非必要语音可打断（重玩时） | 星级结算演出允许点击跳过——建议保留 |
| 家长区要有"baby gate"；家长提示单独成区 | 已满足（家长面板独立入口） |

**儿童鼠标指向的运动学证据（决定目标最小尺寸）**：
- Hourcade 等（IDC 2004）：4 岁、5 岁儿童 vs 成人的点选对比——**目标尺寸显著影响准确率与"指针回炉"次数**，儿童路径更弯、过冲更多 [51]；
- Donker & Reitsma（2007）：学前儿童瞄准-点击能力未发育完全，需要**显著大于成人常规**的点击目标 [52]。
- → 项目内所有可点图标保持"图标即热区、热区≥图标绘制区"，高 tier 压缩**视觉尺寸**（如 flanker len9 用 56px）时，**判定热区不要同比缩**——视觉变小、热区保留余量，是"提顶但不惩罚运动系统"的关键实现细节。

**其余机构**：
- PBS KIDS：官方公开材料只有"课程优先（curriculum-based）、适龄发展目标"的总体立场 [46][47]；其内部 UX 规范未公开——**未找到一手设计规范文档**，如实标注。
- Microsoft：《Inclusive 101》指南为官方一手，但为**全年龄包容性设计**框架（Recognize exclusion / Learn from diversity / Solve for one, extend to many），**没有儿童专门章节** [49]——可用于色弱/听觉冗余等无障碍检查，不作为儿童 UI 依据。
- Common Sense Media：2025 版《Common Sense Census 0-8》提供使用画像（0-8 岁移动端游戏日均约 21 分钟 [59]），佐证"每日 20 分钟"处方在社会常轨内；其评分标准是内容分级，不是交互规范。

### B3 · 过程性表扬（process praise）在训练反馈里的落地

- Mueller & Dweck 1998（6 个实验，五年级）：夸"聪明"组后续偏好表现目标、遇挫坚持差、把智力当固定特质；夸"努力/过程"组相反 [40]。幼儿段同样成立：对 4 岁儿童的"你真聪明"类**人物表扬**会让他们在挫折后更糟、选择更保守（Kamins & Dweck 1999）[41]；**泛化句式**（"你是那种画得好的孩子"）本身就会在失败后瓦解动机（Cimpian et al. 2007，4 岁起）[42]。
- Dweck 的后续修正（对游戏反馈最重要的一条）：**失败的情境里别只夸努力**——"你已经很努力了"若被听成"反正你没能力"，同样有害；应该指向**策略、进度、下一次的具体做法**（"你这次把队排对了 9 个，下次试试先看中间那只"）[43]。
- 落地清单（全部是句式级改动）：
  1. 三星结算语校准：永远包含**具体行为计数**（"连对 8 个""这一关你等住了 5 个 TNT"），禁止"你真聪明/真厉害"类人物句；
  2. 连败（日体检火苗下行档）时的话术指向策略与进度，**不说"没关系你努力了"**（听感=安慰=能力低）[43]；
  3. 村长播报"本日最棒的一次"用"选择正确"句式（对标 Sesame 的 "Nice job choosing…" [44]）；
  4. 家长面板口径同样用过程指标（正确率趋势/反应时趋势，已是）——避免任何"智商/聪明度"字样（宣称红线）。

### B4 · 流程节奏：单关时长、每日结构、难度呈现

**时长证据带（全部一手）**：

| 结构 | 数值 | 来源 |
| --- | --- | --- |
| EndeavorRx 处方剂量 | ~25 分钟/日 × 5 日/周 × 4 周，硬锁 | [1][3] |
| EndeavorOTC | 10-25 分钟/日 × ≥5 日/周 × 6 周 | [4] |
| K-CPT2（4-7 岁注意测验） | 全程 7.5 分钟（200 试次、5 block） | [13] |
| TEA-Ch2 J 全套（5-7 岁） | 35-40 分钟（成人陪测、可分次） | [11] |
| Cogmed RM | 25 次 × 30-40 分钟 × 5 周 | [38] |
| Cogmed JM（学前） | 10-15 分钟/次（二手来源 [60][61]） | 二手 |
| 0-8 岁儿童移动端游戏现实用量 | 日均约 21 分钟 | [59] |

- 本项目 6 关 × 2-3 分钟 ≈ 12-18 分钟 + 过场 ≈ 20 分钟，落在"处方带（25 分钟）"与"现实用量带（21 分钟）"之间，且单关粒度（2-3 分钟）远低于 4-7 岁单块注意任务的经验上限（7.5 分钟）[13]——**节奏结构不需要改动，维持**。
- **关间休息**：EndeavorRx 在任务间内建休息 [3]；本项目的宝物柜/矿袋过场天然就是休息层——保持"训练块之间必有非训练过场"。
- **每日结构**：EndeavorRx 的"每日 5 天/周"节奏 + 锁定 [1][3] 与本项目 6 关/20 分钟防沉迷同构；不加码。
- **难度呈现（可见地图 vs 线性推进）**：
  - 一手先例：EndeavorRx 用 **Galaxy Map 展示总体进度**，但**可玩环境只限已解锁世界**，解锁由宝石数（≈表现+剂量）驱动，不是自选跳关 [3]；任天堂脑锻炼用图章日历展示连续性而非关卡地图 [48]。
  - 行为证据：目标梯度效应（离奖励越近动力越强）支持把**进度可视化**（已走过的路/已收集的宝物）而不是提供自由选关 [62]；Cooney Center 给开发者的建议也是"提供目标与激励让人回来 + 关卡制让目标行为有指向"，同时"app 不应在一个目标达成后就结束" [45]。
  - → 对本项目：**线性推进不动**（防刷约束），可加的是"已解锁进度"的**可视化图层**（如矿洞深度图/宝物柜陈列墙），即"看得到地图、走不了捷径"。是否值得做见 §5 清单 P2。

---

## 4. C 块：习惯回路与"明天再来"

### 4.1 图章/日历/收集之外有实证的习惯机制

| 机制 | 一手证据 | 对项目的转译 |
| --- | --- | --- |
| **固定情境重复（context-dependent repetition）** | 习惯=情境线索触发的自动化行为；自动化曲线渐近上升，中位 **66 天**（个体 18-254 天）到 95% 平台（成人样本）[53][54] | ① "明天再来"的正确目标是**启动**自动化（孩子自己要求开游戏），不是全程自动化；② 别做"21 天成就"承诺——数据不支持 [53] |
| **漏一天无大碍** | 单次错过机会对自动化曲线的拖累 <0.5 分，次日即恢复，"不会实质性破坏习惯形成"（Lally 2010 原文结论）[53] | **集章规则补丁**：断签日不产生任何负面状态（不熄火苗、不清零、不显示"断"）；回来当天正常补章。这是有数据背书的"零惩罚"细则 |
| **简单行为先自动化** | 同重复次数下，简单行为习惯分更高；复杂行为（运动）到平台的时间 ×1.5 [53][54] | 习惯锚点做成**单一简单动作**（"坐好→点村长问候→第一关"三步仪式），不要把"计划今天练什么"塞进启动流程 |
| **固定时间/前置事件线索** | EndaevorRx IFU 给家长的处方建议原文："把训练塞进家庭日程、养成习惯，用提醒工具" [3] | 家长面板加一条**固定时段提示**（如"晚饭后 6 点是村长等你的时间"），由家长选一次，之后不再打扰 |
| **周节奏（5 天/周）** | 处方级先例：EndeavorRx 25min×5d、EndeavorOTC ≥5d/周 [1][3][4]；Cogmed 5 天/周×5 周 [38] | 现行"每日 6 关"无周结构；可选加**周末轻量日**（图章照盖、关卡减半）——但这是新玩法决策，只列证据不拍板 |
| **进度可视化/集章** | 任天堂官方手册：Stamp Calendar 屏，"训练的日子盖章；**一天多练不多章**；可换章的图案"；脑年龄曲线随日历展示 [48] | 与现有图章日历一致；"多练不多章"即防沉迷的官方同款；图章图案解锁（收集向）是低成本增量 |
| **目标梯度** | 离目标越近加速冲刺（Kivetz et al. 2006）[62] | 已解锁进度做**可见图层**（§B4）比发"连续 30 天"徽章更符合证据（徽章缺失=隐性惩罚，违反红线） |
| **每日一次的高强度挑战块** | 任天堂《Devilish Brain Training》官方定位=每日专注/工作记忆挑战 [50]；EndeavorRx 的"每日超个人难度带"由 SSME 保证 [3] | 魔鬼特训（每日一次 5 分钟、85/66 双阈）与此同构——维持"每日一次"上限不放开 |
| **变率奖励+保底+硬上限** | 已在 [reward-model-research.md](reward-model-research.md) 完成取证（Ferster & Skinner；保底干燥计时器；EndeavorRx 锁定先例），本文不重复 | 引用该文档结论，无新增 |

### 4.2 家长参与在儿童认知训练中的角色

- **Cogmed 教练模型（一手）**：官方交付=初始访谈+启动会+**5 周每周教练电话**+收尾+6 个月随访；教练"分析结果、提供鼓励"，Training Web 给家长看进度 [38]。即：家长/教练参与是产品**交付结构**的一部分，不是可选装饰。
- **效果证据（诚实口径）**：Chacko et al. 2014（JCPP，85 名 7-11 岁 ADHD，严格对照条件）——Cogmed 对部分 WM 测量有效，但**在更严格对照下远端获益消失** [37]；元分析层面儿童 WM 训练近迁移 g≈0.44、无可靠远迁移 [33][36]。→ 家长参与的价值主要体现在**依从性/剂量**（把 25 次练完），而不是把训练变成疗效放大器。宣称口径继续压在"技能练习"上。
- **学前亲子版的正面信号**：Foy & Mann 2014（ beginnings readers，Cogmed 系自适应训练+家长监督）报告执行控制与视空/言语 WM 提升且与阅读起点相关 [39]（单一研究，力度有限，列出供参考）。
- **EndeavorRx 家长端的设计口径（一手）**：Insight app 给家长看"**daily efforts and level completion**"（努力与完成），加上"陪玩时鼓励投入努力、游戏本来就该难"的指导 [3][5]——**刻意不展示分数比较**。
- **对本项目家长面板的建议**（在"正确率/反应时趋势+CSV"现状上）：
  1. 新增**努力口径区块**：本周练了几关、火苗三档天数、魔鬼特训尝试次数——对齐"报努力不报聪明"的表扬学 [40][43] 与 EndeavorRx 先例 [5]；
  2. 加"**今日陪玩一句话**"：从过程性表扬句式库轮播（§B3），给家长现成的话术，避免"你怎么又错了"；
  3. 不加任何跨儿童比较/百分位（零惩罚红线 + 家长比较会传导成绩压力，产品先例都不做 [5]）；
  4. 联合参与（JME）有儿童学习收益的机构级共识（Sesame Workshop 立场："通过共同参与媒体，孩子学得更多"）[44][45]——家长在场的最小形态就是"同一张桌子"，不需要家长操作。

---

## 5. 建议落地清单（证据强度 × 实现成本排序）

> 构念列标注与五维的关系；参数起点给出可直接进 `paramsFor` 讨论的初值；均为建议，拍板另走设计文档。

| 优先 | 事项 | 构念（新增/增强） | 证据强度 | 成本 | 参数起点 / UI 要点 | 来源 |
| --- | --- | --- | --- | --- | --- | --- |
| **P0** | **新范式：矿洞大扫除（视觉划消）** | 选择性注意+视觉扫描（新增第六范式，五维之外） | 强（5-7 岁常模子测验） | 低 | 回合制：15s/回合 × 3-4 回合（首回合纯目标、后回合混干扰）；图标网格 4×6 起步；tier 轴=干扰密度→干扰相似度（同形异色→同色异形）→轻度联合特征（顶格）；目标用单图标示例+TTS；无时窗压迫（回合内自定步调，回合间结算） | [10][24][25] |
| **P0** | **同范式双模式：探测快照（present/absent）** | 选择性注意（划消的姊妹模式，可同引擎复用） | 强 | 低 | 单屏 ≤2s 呈现后问"有没有钻石"，两枚大按钮（有→点矿堆/无→点空筐）；target-absent 50%；d' 类计分只进家长 CSV 不进儿童 UI | [10][24][28] |
| **P0** | **习惯补丁：断签不惩罚** | 习惯连续性（去惩罚） | 强 | 极低 | 断签日无任何状态恶化，复训日正常补章；不显示"中断 N 天" | [52] |
| **P0** | **反馈句式校准（过程性表扬）** | 动机（间接护持练习意愿） | 强 | 极低 | 结算语含具体计数；禁人物句；连败话术指向策略/进度 | [40][42][43] |
| **P1** | **新范式：回声矿洞（听觉持续注意）** | 自主持续注意（跨通道增量） | 强（5-7 岁常模子测验） | 中 | 数狗叫式：3-6 声/回，声间隔 1.5-3s；答案用图标数量点选；进阶加干扰声（Hide & Seek Auditory 式逐声按键模式）；目标音色恒定采样 | [10] |
| **P1** | **家长面板·努力口径区块** | 家长参与（依从性） | 强 | 低 | 本周关数/火苗天数/魔鬼尝试；轮播过程性表扬话术；无跨儿童比较 | [3][5][37][38] |
| **P1** | **RLPL 式"灯色翻转"混合复习关** | 情境依赖抑制+规则翻转（**复习层**，不新开维度） | 强（学前 RCT 两轮） | 低 | 音乐+三色灯：绿灯=点目标、紫灯=点空筐、灯色随机切换；现有 gonogo/switch 素材复用；定位=每 5 关一次的嘉年华复习（与 camp-rotation 兼容） | [55][56][57][58] |
| **P2** | **gonogo 停止信号变体（tier≥12）** | 前瞻性抑制（gonogo 增强档） | 中 | 中 | TNT 点中后引信延迟 300-500ms 才爆，此窗内可"拆弹"（二次点击）撤销；按天自适应延迟，放弃 SSRT 计分，只记拆弹率 | [15][16][17] |
| **P2** | **已解锁进度可视化图层** | 习惯（目标梯度） | 中 | 中 | 矿洞深度图/宝物柜陈列墙展示已走过的路；**不做选关**（防刷约束不动） | [3][48][62] |
| **P2** | **mousedown 即判定 + 判定热区独立于视觉尺寸** | 手感（非读儿童指向运动学） | 中 | 低 | 检查现有 click handler；len9 压视觉尺寸时热区保留 ≥64px 等效 | [44][51][52] |
| **P2** | **新范式教学关三级脚手架** | 新范式上手成本 | 中（机构级最佳实践） | 中 | 首关不计时：①指出+鼓励 ②重述+提示 ③高亮正确；仅教学关启用 | [44] |

---

## 6. 不适合做清单（与"适合"同样重要）

| 不做 | 理由（一手） |
| --- | --- |
| **n-back**（维持既有排除） | <8 岁无验证（既有结论）；训练层面儿童 WM/EF 训练无可靠远迁移 [33][36][31][32] |
| **双任务/分散注意范式** | TEA-Ch2 的双任务子测验 8 岁起施测 [10]；儿童双任务代价显著大于成人且贯穿童年 [21][22][23]。产品扩展到 8+ 时再评估 |
| **SART 独立成模** | 6 岁高误击、易挫败，与零惩罚红线冲突；构念被 cpt+gonogo 覆盖 [10][19][20] |
| **加工速度/简单 RT 独立范式** | 只有近迁移；临床工具里仅作基线 [10][30][31]；RT 继续做家长面板指标 |
| **平滑 pursuit / 视追踪** | 7-8 岁才成人样、需眼动测量；鼠标追踪异构且无训练证据 [29]（未找到支持性一手来源，如实标注） |
| **Cogmed 式 WM 广度新维度** | 严格对照后远端获益不成立 [37]；元分析零远迁移 [36]；Corsi 已覆盖视空记忆 |
| **触屏化 / 手势交互** | 硬约束排除；且 Sesame 触屏最佳实践（直接指点）**不能**反推到鼠标（间接指向更难，见 §B2 运动学）[44][51][52] |
| **倒计时压迫/惩罚性反馈/差额奖励** | 既有红线；Sesame 错误反馈脚手架与 Lally 断签证据均同向 [44][53] |
| **"EndeavorRx Select"** | 查无此产品（截至 2026-10-29）；勿在文档/注释中引用此名。官方仅 EndeavorRx（Rx）与 EndeavorOTC（OTC）[3][4] |

---

## 7. 检索口径与局限

- 一手来源判定：官方监管文件（FDA）、官方 IFU/官网、出版社技术报告/手册、同行评审论文原文；二手（媒体转述、第三方诊所页）仅用于标注"官方未公开"的字段（如 Cogmed JM 时长），均已注明。
- 未找到一手来源的事项（如实记录）：① "EndeavorRx Select"；② PBS KIDS 内部 UX 设计规范；③ Microsoft 面向儿童的专门设计规范（Inclusive 101 为全年龄通用 [49]）；④ EndeavorRx 真实世界大样本依从性研究（2024-2026 检索范围内未定位到可引用的一手论文；临床合规数据用 IFU 内的 STARS-Adjunctive 数字 [3]：均值完成 100 次处方会话中的 83 次）。
- 年龄外推局限：Lally 习惯时间线为成人样本 [53]；Cogmed/EndeavorRx 的剂量结构是设计参照，不构成 6 岁疗效证据。

---

## 参考来源总表（访问日期均为 2026-10-29）

**监管与产品一手资料**

1. FDA. De Novo Classification Request for EndeavorRx（DEN200026 摘要）. <https://www.accessdata.fda.gov/cdrh_docs/reviews/DEN200026.pdf>
2. FDA Press Announcement (2020). FDA permits marketing of first game-based digital therapeutic… <https://www.fda.gov/news-events/press-announcements/fda-permits-marketing-first-game-based-digital-therapeutic-improve-attention-function-children-adhd>
3. Akili. EndeavorRx Instructions for Use（IFU 5011 Commercial Rev U, 2024-01）. <https://www.endeavorrx.com/wp-content/uploads/2024/01/EndeavorRx-IFU5011-Commercial-RevU.pdf>
4. Akili. EndeavorOTC Instructions for Use（IFU 5015 v3.0.0, 2025-04）. <https://www.endeavorotc.com/wp-content/uploads/2025/04/EndeavorOTC-IFU-5015-3.0.0.pdf>
5. Akili. EndeavorRx 官网 The Treatment / 首页（家长端 Insight、剂量、"supposed to be difficult"）. <https://www.endeavorrx.com/treatment/>
6. Akili. Product Development（SSME 技术描述）. <https://www.akiliinteractive.com/product-development>
7. Kollins, S. H., Childress, A., Heusser, A. C., et al. (2020). Effectiveness of a digital therapeutic as adjunctive treatment in pediatric ADHD (STARS-ADHD): a randomized controlled trial. *The Lancet Digital Health, 2*(4), e168–e178. DOI: 10.1016/S2589-7500(20)30017-0
8. Anguera, J. A., Boccanfuso, J., Rintoul, J. L., et al. (2013). Video game training enhances cognitive control in older adults. *Nature, 501*, 97–101. DOI: 10.1038/nature12486（DEN200026 引用的引擎科学来源）
9. JMIR Serious Games (2026). Association between task difficulty regulation in game-based digital therapeutics and ADHD symptoms in children. <https://games.jmir.org/2026/1/e83932>

**临床注意测评工具（子测验可游戏化）**

10. Pearson Clinical UK (2018). TEA-Ch2 Technical Report（J/A 两版子测验结构、常模样本、动机包装）. <https://www.pearsonclinical.co.uk/content/dam/school/global/clinical/uk-clinical/files/tea-ch2-technical-report-update-dec2018.pdf>
11. Pearson Assessments US. Test of Everyday Attention for Children | Second Edition 产品页（5-15 岁；5-7 岁 35-40 分钟）. <https://www.pearsonassessments.com/en-us/Store/Professional-Assessments/Behavior/Test-of-Everyday-Attention-for-Children-%7C-Second-Edition/p/100001942>
12. Manly, T., Anderson, V., Nimmo-Smith, I., et al. (2001). The differential assessment of children's attention: The Test of Everyday Attention for Children (TEA-Ch), normative sample and ADHD performance. *Journal of Child Psychology and Psychiatry, 42*(2), 237–253. DOI: 10.1111/1469-7610.00714
13. PAA (MHS 澳洲代理). Conners K-CPT2 产品页（4-7 岁、7.5 分钟、200 试次、双 ISI 1.5/3s、图片目标）. <https://paa.com.au/product/conners-k-cpt2/>
14. NINDS Common Data Elements. Conners Kiddie Continuous Performance Test 2 (K-CPT 2). <https://cde-fe.ninds.nih.gov/ninds/noc-report/F1487/Conners%20Kiddie%20Continuous%20Performance%20Test%202%20(K-CPT%202)>

**范式发展证据（按范式）**

15. Lee, W. S. W., Cho, S., Baik, N., et al. (2015). The relationship between the development of response inhibition and intelligence in preschool children. *Frontiers in Psychology, 6*, 802. DOI: 10.3389/fpsyg.2015.00802（3.5-4 岁儿童版停止信号任务可可靠施测）
16. Carver, A. C., Livesey, D. J., & Charles, M. (2001). Further manipulation of the stop-signal task: developmental changes in the extent to which inhibitory control is modeled by the task. PubMed 11913336. <https://pubmed.ncbi.nlm.nih.gov/11913336/>
17. Dupuis, A., Indramohan, M., Brian, J., et al. (2019). Response time adjustment in the stop signal task: development of inhibitory control in 13,709 children and adolescents aged 6-17. <https://lab.research.sickkids.ca/crosbie/wp-content/uploads/sites/157/2024/01/Dupuis-2019-Response-time-adjustment-in-the-stop-signal-task-accepted.pdf>
18. Lewis, F. C., Reeve, R. A., Stafford, J. L., & Johnson, K. A. (2017). Sustained attention to a predictable, unengaging Go/No-Go task in children. *Attention, Perception, & Psychophysics, 79*. DOI: 10.3758/s13414-017-1351-4
19. *Journal of Experimental Child Psychology* (2017). Evidence of substantial development of inhibitory control and sustained attention between 6 and 8 years of age on an unpredictable Go/No-Go task. <https://www.sciencedirect.com/science/article/abs/pii/S0022096516303186>
20. Frontiers in Human Neuroscience 会议摘要 (2015). Children's performance on the Sustained Attention to Response Task: a cross-sectional analysis of age-related changes（129 名 6/8/10 岁儿童）. <https://www.frontiersin.org/10.3389/conf.fnhum.2015.217.00269/event_abstract>
21. Anderson, M., Anderson, V., Northam, E., et al. (2011). Effect of age on dual-task performance in children and adults. *Memory & Cognition, 39*. DOI: 10.3758/s13421-011-0099-7
22. Möhring, W., et al. (2021). Age-related changes in children's cognitive–motor dual task performance. *Developmental Psychology*. <https://doi.apa.org/record/2021-25995-001>
23. Strobach, T. (2024). Investigating dual-task interference during motor and cognitive tasks in children… *Journal of Cognition and Development*. DOI: 10.1080/15248372.2024.2326103
24. Lynn, A., Festa, E. K., Heindel, W. C., & Amso, D. (2020). What underlies visual selective attention development? Evidence that age-related improvements in visual feature integration influence visual search performance. *Journal of Experimental Child Psychology, 191*, 104732. DOI: 10.1016/j.jecp.2019.104732
25. Donnelly, N., Cave, K., Greenway, R., et al. (2007). Visual search in children and adults: top-down and bottom-up mechanisms. *Quarterly Journal of Experimental Psychology, 60*(1), 120–136. DOI: 10.1080/17470210600625362
26. Hokken, M. J., Krabbendam, E., et al. (2023). Visual selective attention and visual search performance in children with CVI, ADHD, and dyslexia: a scoping review. *Child Neuropsychology*. DOI: 10.1080/09297049.2022.2057940
27. Trick, L. M., & Enns, J. T. (1998). Lifespan changes in attention: the visual search task. *Cognitive Development, 13*. <https://www.sciencedirect.com/science/article/pii/S0885201498900168>
28. Fisher, A., et al. (2012). Assessing selective sustained attention in 3- to 5-year-old children… PMC3508142. <https://pmc.ncbi.nlm.nih.gov/articles/PMC3508142/>
29. Viñuela-Navarro, V., et al. (2019). Quantitative characterization of smooth pursuit eye movements in children（7-8 岁接近成人样，约 10 岁成熟）. *Translational Vision Science & Technology*; PMC6753964. <https://pmc.ncbi.nlm.nih.gov/articles/PMC6753964/>
30. Egeland, J., et al. (2013). Few effects of far transfer of working memory training in ADHD… PMC3790857. <https://pmc.ncbi.nlm.nih.gov/articles/PMC3790857/>

**训练效应边界（宣称口径依据）**

31. Sala, G., & Gobet, F. (2019). Near and far transfer in cognitive training: a second-order meta-analysis. *Collabra: Psychology, 5*(1), 18. DOI: 10.1525/collabra.203
32. Gobet, F., & Sala, G. (2023). Cognitive training: a field in search of a phenomenon. *Perspectives on Psychological Science, 18*(1), 125–141. DOI: 10.1177/17456916221091830
33. Kassai, R., Futo, J., Demetrovics, Z., & Takacs, Z. K. (2019). A meta-analysis of the experimental evidence on the near- and far-transfer effects among children's executive function skills. *Psychological Bulletin, 145*(2), 165–188. DOI: 10.1037/bul0000175
34. Simons, D. J., Boot, W. R., Charness, N., et al. (2016). Do "brain-training" programs work? *Psychological Science in the Public Interest, 17*(5), 641–677. DOI: 10.1177/1529100616661983
35. Owen, A. M., Hampshire, A., Grahn, J. A., et al. (2010). Putting brain training to the test. *Nature, 465*, 775–778. DOI: 10.1038/nature09086
36. Melby-Lervåg, M., & Hulme, C. (2013). Is working memory training effective? A meta-analytic review. *Developmental Psychology, 49*(2), 270–281. DOI: 10.1037/a0028228
37. Chacko, A., Bedard, A. C., Marks, D. J., et al. (2014). A randomized clinical trial of Cogmed Working Memory Training in school-age children with ADHD: a replication in a diverse sample using a control condition. *Journal of Child Psychology and Psychiatry, 55*(3). PubMed 24117656. <https://pubmed.ncbi.nlm.nih.gov/24117656/>
38. Pearson. Cogmed Working Memory Training 官方手册（25 次 × 30-40 分钟 × 5 周；教练周电话；Training Web）. <https://www.pearsonassessments.com/content/dam/school/global/clinical/us/assets/cogmed/cogmed-trifold-brochure.pdf>
39. Foy, J. G., & Mann, V. A. (2014). Adaptive cognitive training enhances executive control and visuospatial and verbal working memory in beginning readers. *International Education Research, 2*(2), 19–43. DOI: 10.12735/ier.v2i2p19

**表扬与动机**

40. Mueller, C. M., & Dweck, C. S. (1998). Praise for intelligence can undermine children's motivation and performance. *Journal of Personality and Social Psychology, 75*(1), 33–52. DOI: 10.1037/0022-3514.75.1.33（全文：<https://www.columbia.edu/cu/psychology/courses/3615/Readings/Mueller_Dweck.pdf>）
41. Kamins, M. L., & Dweck, C. S. (1999). Person versus process praise and criticism: implications for contingent self-worth and coping. *Developmental Psychology, 35*(3), 835–847.
42. Cimpian, A., Arce, H.-M. C., Markman, E. M., & Dweck, C. S. (2007). Subtle linguistic cues affect children's motivation. *Psychological Science, 18*(4), 314–316. DOI: 10.1111/j.1467-9280.2007.01896.x
43. Dweck, C. S. (2007). The perils and promises of praise. *Educational Leadership, 65*(2)（转引 PDF：<https://teaching.temple.edu/sites/teaching/files/resource/pdf/Dweck-Perils%20&%20Promises%20of%20Praise.pdf>）

**儿童 UI/交互一手资料**

44. Sesame Workshop (2012). Best Practices: Designing Touch Tablet Experiences for Preschoolers（50+ 触屏研究）. <https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf>
45. Shuler, C., Levine, Z., & Ree, J. (2010). Is There an App for That? *The Joan Ganz Cooney Center at Sesame Workshop*. <https://clalliance.org/wp-content/uploads/files/learningapps_final_110410.pdf>
46. PBS KIDS for Parents. About（课程优先的总体立场）. <https://www.pbs.org/parents/about>
47. ZERO TO THREE. Getting the Most Out of Screen Time: The PBS KIDS Approach to Learning Through Media. <https://www.zerotothree.org/resource/journal/getting-the-most-out-of-screen-time-the-pbs-kids-approach-to-learning-through-media/>
48. Nintendo (2006). Dr. Kawashima's Brain Training: How Old Is Your Brain?（DS 版官方说明书：Stamp Calendar 图章日历、"Stamps are awarded on days you have trained / 多练不多章"、脑年龄曲线）. <https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_ds_21/Manual_NintendoDS_DrKawashimasBrainTraining_EN.pdf>
49. Microsoft Design. Inclusive 101 Guidebook（全年龄包容性设计，无儿童专章——如实标注）. <https://inclusive.microsoft.design/tools-and-activities/Inclusive101Guidebook.pdf>
50. Nintendo AU. Dr Kawashima's Devilish Brain Training: Can you stay focused? 官方页. <https://www.nintendo.com/au/games/nintendo-3ds/dr-kawashimas-devilish-brain-training-can-you-stay-focused/>
51. Hourcade, J. P., Bederson, B. B., Druin, A., & Guimbretière, F. (2004). Differences in pointing task performance between preschool children and adults using mice. *ACM IDC '04*. DOI: 10.1145/1035575.1035577
52. Donker, A., & Reitsma, P. (2007). Aiming and clicking in young children's use of the computer mouse. *Computers in Human Behavior*. <https://www.sciencedirect.com/science/article/abs/pii/S0747563206000872>

**习惯、节奏与家长参与**

53. Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J. (2010). How are habits formed: modelling habit formation in the real world. *European Journal of Social Psychology, 40*(6), 998–1009. DOI: 10.1002/ejsp.674（全文转载：<https://emotionalfirstaidacademy.com/wp-content/uploads/2023/10/How-habits-are-formed.pdf>）
54. Gardner, B., Whittington, C., McAteer, J., et al. (2012). Making health habitual: the psychology of 'habit-formation' and general practice. *British Journal of General Practice*; PMC3505409. <https://pmc.ncbi.nlm.nih.gov/articles/PMC3505409/>
55. Tominey, S. L., & McClelland, M. M. (2011). Red light, purple light: findings from a randomized trial using circle time games to improve behavioral self-regulation in preschool. *Early Education & Development, 22*(3), 489–519. DOI: 10.1080/10409289.2011.574258
56. Schmitt, S. A., McClelland, M. M., Tominey, S. L., & Acock, A. C. (2015). Strengthening school readiness for Head Start children: evaluation of a self-regulation intervention. *Early Childhood Research Quarterly, 30*, 118–130. DOI: 10.1016/j.ecresq.2014.09.002
57. Schmitt, S. A., Duncan, R. J., Korucu, I., et al. (2019). Red light, purple light! Results of an intervention to promote school readiness for children from low-income backgrounds. *Frontiers in Psychology, 10*, 2365. DOI: 10.3389/fpsyg.2019.02365
58. What Works Clearinghouse (IES). Red Light, Purple Light Intervention Report. <https://ies.ed.gov/ncee/wwc/Docs/InterventionReports/WWC-red-light-purple-light_report.pdf>
59. Rideout, V., & Robb, M. B. (2025). The Common Sense Census: Media Use by Kids Zero to Eight. Common Sense Media. <https://www.commonsensemedia.org/sites/default/files/research/report/2025-common-sense-census-web-2.pdf>（0-8 岁移动端游戏日均约 21 分钟）
60. ADDITUDE Magazine. Cogmed Working Memory Training for ADHD and LD（JM 版 4-6 岁、10-15 分钟——**二手来源**，官方未公开分版时长）. <https://www.additudemag.com/treatment/cogmed/>
61. MET PhD Clinic. Cogmed Working Memory Training（JM 版"每工作日 10-15 分钟 × 5 周"——**二手来源**）. <https://metphd.ca/cogmed/>
62. Kivetz, R., Urminsky, O., & Zheng, Y. (2006). The goal-gradient hypothesis resurrected. *Journal of Marketing Research, 43*(1), 39–58.

**本项目既有文档（复用结论，本文不重复取证）**

- [reward-model-research.md](reward-model-research.md) — 掉落曲线、变率奖励+保底+硬上限、EndeavorRx 锁定先例、JMIR 2026 难度调控（本文编号 [9] 同源）
- [focus-revamp-design.md](focus-revamp-design.md) — 五维现行参数、mkAdapt 校准带、台阶变坡道
