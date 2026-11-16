# 滑翔翼集成分支收口整体评审 · 两轴聚合（工程经理归档）

- 固定点：`3f6a96d`（main tip，PR 基线）；对象：`git diff 3f6a96d..HEAD`（17 提交 / 135 文件，到达先 `git log` 对账）
- 双轴子评审并行（后台）：标准轴 `ses_e1dacfa64ffeKMlUop7MP40ABX`、规格轴 `ses_e1dacfa64ffdd6HWlIESa5sGVF`（全文照录于后）
- 时序注记：评审起跑时 T-G08（−1.5→−1.2 二次调参）在办；其落地 `ef0a1e4` 由回执门禁自证（定向 voxel 42/42 + adventure 27/27、全量 2196/2195/0/1、lint 零错误、窗口零放宽实测余量足）——机械同步票不重审，PR 面终态含 `ef0a1e4` 与收口微扫。
- 聚合裁定：**PR 就绪**（两轴零阻塞；标准轴「四槽」残留由收口微扫 GP06 落地后随本档一并入库）。

---

## 标准轴结论：收口级零硬阻塞（全文照录）

核查完毕，证据链闭合。出具收口评审结论。

### 结论：收口级零硬阻塞。1 项低危文档标准发现 + 4 项 judgement call + 2 项簿记观察。

#### (a) 文档标准违反（低危·注释级）

**[标准] §1.7/§1.8「四槽」口径残留未清零**（AGENTS.md 硬规则「注释口径一致」族）：
- **GLOSSARY.md:148/152**：穿戴几何 overlay 词条「apply 按四槽 id 集签名幂等」、纸娃娃词条「paint 四槽 id 签名幂等」——与 js/armor-overlay.js:263-264、js/paper-doll.js:61 已改的「五槽 id 签名」同机制两口径。T-G03/T-G06 已扫装备核心/模式面板 kit 词条及 armor-overlay.js 注释，漏此两处。
- **js/mode-kit.js:21/608/735**：「四槽穿戴」vs 同文件 :43/:762/:1533 已改五槽——同文件分裂口径。
- 次要同族：css/style.css:1720、test/boot.test.js:238、test/showroom-mode.test.js:86、js/button-icons.js:817/867（均注释，零行为）。
- 修复建议：一处 5 分钟簿记顺带扫平；avatar.js:18「overlay 盒四槽型」描述甲盒几何本身，suppress。

#### (b) baseline smell（judgement call，均不阻塞）

1. **Duplicated Code**：test/avatar.test.js 与 test/paper-doll.test.js 各自持 ~1.8KB 近同 `stubThree`（仅差 log 参）；加 mob-look.test.js 已第三份——触 §1.10「≥3 处」低语，可议 test/helpers 收口，但 §7.2 单源令只覆盖假 DOM，先例在。
2. **Duplicated Code**：.scratch/glider/helpers/fake-dom.js 为 test/helpers/fake-dom.js 字节级复制（4934B 全同），工厂演进即漂移；scratch 域不违 §7.2，建议头注释标注「快照副本+日期」。
3. **Duplicated Code（微）**：js/modes/adventure.js 收沿四连（advWings('hidden')+advSfx+advGoldEdge(false)+phase='back'）在 advGlideTick 收沿与 advGlideUnequipEdge 双写，可提取，但镜像前收有注释论证。
4. **Repeated Switches（suppress 倾向）**：`slot === 'glider'` 特判四处（equipment-core.js:100 豁免、mode-kit.js:766 耐久条、adventure.js advTryWear/advWornTakeOff TTS、advGlideSlotUnequip 抑制）——各据其层（§1.6 覆盖 baseline），n=1 特例建槽元数据表属 Speculative Generality；若开第二特例槽应升格。

#### 合并/簿记卫生观察

- 工作区带未提交 T-G08（−1.5→−1.2 二次调参六文件 modified）——不在 17 commits PR 面内；HEAD 七值终态自洽（config:82 −1.5 ↔ GLOSSARY:482 ↔ voxel.test:350 镜像 ↔ spec §3.9 按「初始建议值，调整不回本 spec」契约保留 −3.0，互证不矛盾）。请经理确保在途改动独立落票，勿随 PR 误提或遗失；另有瞬态未跟踪文件 .rev-cfg-head-tmp.js。（经理注：T-G08 已落地 ef0a1e4，瞬态文件已自查消失。）
- .scratch 两日志被 git 判二进制（疑 GBK 管道产物，§7.3）；.bak/诊断大件入库合 .scratch 惯例，仅记。

#### 已核实干净面

①四链路命名/消费方向全链一致（setGliderEquipped/isGliding、setWings/forceWingsHidden、land 三字段消费即清、GLIDE 七键 2/−1.5/5.0/3/1/7/0.3 分层消费与 voxel.js:81 注释一致）；②引擎零玩法知识、模式层零六绑定直写（conventions.test.js:129 正则已纳 gliding 守门）、形象层单向；③sink 两处测试口径一镜像一读源无矛盾；配方 77=13+64 对账吻合；任务 q27/28 项守门同步；effdce1 合并无冲突标记残留。

---

## 规格轴结论：合同级零阻塞（全文照录）

三条高危链、授权链、票图、门禁全部核完。评审期间工作树被需求线并发改写（T-G08 在办）已如实隔离。

### 门禁亲验

`npm test` **2196/2195/0/1 全绿**✓（跑在脏工作树上——评审期间需求线并发改写，T-G08 调参在办）。`npm run lint` 完整跑现红仅因**未提交的** config.js:82（−1.2 注释 128>120）；HEAD 版 config/voxel/voxel.test 三脏文件逐一 eslint 直验**零错误**——分支提交态 lint 干净，红属在办 T-G08，入库前必修。（经理注：T-G08 已入库 ef0a1e4，注释超长已自修，lint 零错误。）

### (a) 缺失/残缺：无阻塞项

§3.1–§3.9 逐块有交付有测试（物品三件 items-core.js:216·item-hint-registry.js:190·icons.js GLIDER_ART；配方 craft-core.js:261；五槽+耐久豁免 equipment-core.js:27/:96；状态机 voxel.js 滑翔分支；伤害结算 adventure.js update land 消费；U-01 路径 B 已回填 spec §7+config `GLIDE.fovKick:7`；q27 adventure-core.js:2960 逐字；体验馆零场景分支）。§3.9 链自洽：spec 钉初值 −3.0＋U-04「调整不回本 spec」＋T-G07 令＋GLOSSARY 现值三环吻合。23 条 v1.2 对照在报告 §0 如实登记；§6 八概念全入 GLOSSARY（六概念显式归并）；老档/任务链/存档五键端到端均有票有测。

**[建议]** HEAD spec §4.1「§6.7 七条」·§4.2「装备态对账 hidden↔folded」「纸娃娃 paint 直读」仍 v1.1 措辞，与 v1.2 十条双门/setArmor 解耦相抵——靠 spec 头「冲突以 UI spec 为准」＋报告 §0 兜底，建议确认在办记账含 §4 顺平。

**[观察]** 报告 §8 真机结论区空置待 PO，系已声明终裁非漏项。

### (b) scope creep：四个已知票外点全部核到授权链，无裸 creep

splash 门 vyStart 修正（存量高速入水由无声变有声）链＝spec §3.4「软着陆=收翼+溅水」＋T-G02 票 T10/T11 红测＋回执 §3-A 留痕＋c670997 提交注明——已授权，存量外溢已声明，建议经理知悉；传送免疫 advTeleport＝§3.5 落差口径必要蕴含＋b3ad749 追令＋报告 §6#2 债登记✓；FOV/穿卸零话术/删模式层防抖分别由 §3.6 路径 B、R1-09+「TTS 零条目」、§4.2 coolMs 条款授权✓。

### (c) 三链端到端读码均成立

① voxel.js（deploy>2/sink/落地收翼）→ advGlideTick 镜像沿 → avatar.js updWings folding 到位 forceWingsHidden（visible=false 角恰 0），无残影闭环；② land 置位（landFall/landGliding）→免疫窗→max(0,floor−3)×1→advEnvHurt{mute} 保观感三件零 TTS→advPlayerDied（home 挂免疫）；③ 五路径零翼（穿零 setWings/卸非滑翔早退/读档 reconcile 吸收/切模式 cleanup/死亡 deathReset＋载入即 visible=false）。未发现错实现。

### (d) 票图纪律

七票 ☑ 与提交/回执对账一致；T-G07 微票（总览行+回执+簿记 c0c3790+微补丁 718bcdd）回执三件齐，断言零改语义、帧窗放宽有逐条核算。

### 结论：合同级零阻塞

建议清单：①确认在办 spec 记账覆盖 §4.1/§4.2 v1.2 顺平；②知悉 splash 存量行为外溢；③T-G08 在办改动当前 lint 红，合入前必修。（经理注：③已闭环于 ef0a1e4。）

---

## 工程经理路由与裁定

1. 「四槽」注释残留（标准轴 a 项，10 处）→ GP06 收口微扫（收口链内清零，见 closure-sweep-receipt.md；avatar.js:18 suppress）。
2. spec §4.1/§4.2 v1.1 措辞残留 + §6「收翼 folded」半句（规格轴建议① + T-G06 评审 observation 1）→ 已转 scrum 并入需求线在办的 spec §3.9/§6 记账批，同一次触点顺平。
3. splash 门存量外溢（高速入水由无声变有声，规格轴建议②）→ 授权链完整，列 PR 收口回执知悉项。
4. 4 项 judgement call（标准轴 b 项）→ retro 登记 E1–E4（.opencode/power-luna/feedback/2026-11-16-glider-engmgr-retro.md）。
5. 簿记卫生观察 → 瞬态文件 .rev-cfg-head-tmp.js 已自查消失；.scratch 二进制日志已随簿记入库留档。
