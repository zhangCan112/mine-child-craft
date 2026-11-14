# 工程线节拍 retro 累积（T-SEAM 链施工期随手记，收口时按角色格式落 .opencode/power-luna/feedback/）

> 维护：engineer-manager · 每票收执/评审后追加 · 收口时汇总升格

## 机械错误（症状/根因/修复建议按成本升序）

1. **假绿门：cmd `%ERRORLEVEL%` 解析期展开**（T-SEAM-01 主票收口暴露）
   - 症状：lint 日志明明记着 `1793:1 error max-len`，捕获的 EXIT 却=0；npm test 双轮 EXIT=0 同不可信。
   - 根因：`cmd /c "... & echo EXIT=%ERRORLEVEL%"` 的 `%ERRORLEVEL%` 在解析期展开成进入时旧值；须 `/v:on` + `!ERRORLEVEL!` 延迟展开。
   - 修复建议（成本升序）：①约定：Windows 下捕获退出码一律 `/v:on` 延迟展开或直接读 runner 原生 summary 行（tests/pass/fail），不自制 echo EXIT；②**链式不混捕**：`cmd /v:on` 下 `&` 串联时 `!ERRORLEVEL!` 只反映链尾命令——test 与 lint 两门分开执行、各自捕获（T-SEAM-01 S1 轮二次暴露）；③日志 summary 复核：收口 commit 前对照 runner 原生 tests/pass/fail 行与预期；④确定性检查：给 .scratch 常用门命令做包装脚本（gate.cmd）统一延迟展开+分门捕获；⑤环境债登记进 docs/worktree-pitfalls.md 或 conventions 附注。
2. **中间 commit 带 lint 红进库**（c4bb084 带入 max-len 红，追令 4f1012e 自愈）
   - 根因：收口门跑的是假绿（同上根因），真红漏过；commit 粒度纪律「零错误才算过」失守一次。
   - 修复建议：①假绿根因修掉即大概率消失；②可选：pre-commit 钩子跑 eslint --max-warnings=0（成本中）；③约定：master 收口 commit 前以 runner 原生输出为准复核一遍。
3. **commit 消息含全角「·」触发 shell scanner 拒析**
   - 症状：git commit -m 消息里「·」被拒析；半角标点可过。
   - 修复建议：①约定：commit 消息半角标点（先例消息本就偏半角）；②scanner 侧放行全角间隔号（成本高，不急）。
4. **模块头横幅契约漂移无守门**（评审 S1：dims-core 头注释漏新导出与依赖；**二次**：F1 adventure-core.js:78-80「东向恒保护」句失真；**三次**：S-1/S-2 adventure.js interface 清单漏 advTownInteractBoot/advTownTargets/advTownState + adv 键类目漏 advTownState——本次派令已明示「03 判例同标准核」仍未防住，人工清单+派令强调均告失效）
   - 根因：==== 五要素靠人工同步，绿方做实现、红方自检均不把头注释当交付面；漂移在评审轴才暴露。
   - 修复建议（成本升序）：①**确定性检查（强烈建议）**：conventions 守门测试断言 module.exports 键集 ⊆ 头注释 interface 清单（机器可判，一劳永逸）；②adv 键类目清单同理（新增 adv* 键必须有类目条目）；③语义变更句（「恒保护」类绝对化表述）评审轴专项扫；④升格进 conventions §1.7 附注。
6. **回执声明字面准确性**（评审 F2：施工方称「R1-R7 红测试本体未动一字」，实际端到端测试标题在红相内做过措辞修订——断言零弱化、实质纪律成立，但声明失准）
   - 修复建议：①约定：回执中「未动 X」类全称断言以 git hunk 为准自查后再写；②测试文件任何 hunk（含标题/格式）须在回执逐条声明用途。
7. **键计数漂移**（04 评审观察项：adventure.js 头注释「33 键」与史句「现 37 键」均失真，实测 49 键——区间外 e77fa8c/e5549e9 引入后从未更新）
   - 修复建议：①删注释中的活计数（改指派生面或「见源」），数字注释天然易腐；②或随 #4 的确定性守门一并覆盖；③另立清扫票处理存量。
8. **取旧源工具脚本必须钉基线 hash**（T-SEAM-05：等价证明验收复跑翻车——`git show HEAD:js/modes/town.js` 在撤除类 commit 后取不到旧源，环境性失败非实质失败）
   - 修复建议：①约定：等价证明/对照类工具脚本取旧源一律钉具体基线 hash（tseam05-equivalence-proof-rerun.js 已留档示范）；②脚本头部自注基线依据。
9. **.scratch 被 git 跟踪且多票共用**（T-SEAM-05 票外发现：误扫/误提交风险靠白名单式逐文件 add 纪律规避）
   - 修复建议：①约定延续：涉及 .scratch 的 commit 一律白名单逐文件 add，禁 `git add .scratch`/`git add .`；②长期可选：收敛 .scratch 跟踪范围（handoffs 归档继续跟踪，临时件目录不跟踪）——成本较高，登记供上游裁量。
10. **GLOSSARY 索引计数漂移**（05 评审 F1：大分块 69→71、游戏模式 39→38——撤卡类变更天然改词条数，手维护计数必漂；另 F2 css 死规则残留（撤卡孤儿）、F3 三处冻结文件注释旧引用归注释卫生票）
   - 修复建议：①确定性检查（强烈建议）：conventions 守门或独立检数测试，程序化断言 GLOSSARY 各分块 declared 计数=actual 词条数（机器可判）；②撤卡类票的票面文件清单模板补「css 孤儿规则/注释旧引用」扫描项；③注释卫生小票清 F3 存量。
11. **Node 全绿 ≠ 浏览器装配绿**（T-UI-01 P1 实录：town-ui-core.js 未进 index.html 装配序，浏览器 TOWN_UI_CORE=null 进镇即炸+rAF 停摆；但三门全绿——测试走 require 分支、集成链装具自装 core，把唯一能抓装配缺失的守门测试弄瞎了）
   - 根因：双栖模块（CJS require + 经典 script）的测试只覆盖 Node 分支；装具自装绕过了它声称守卫的装配序；守门三点序锁不住「某件缺席」型缺口。
   - 修复建议：①约定：每新增一个 index.html script，装配守门断言同票必加（四点序锁全链）；②集成链装具装载序与 index.html 对齐（禁自装补缺，装具即装配的镜像）；③红基线红因分类留痕：装具炸（TypeError）≠ 断言红（AssertionError），红自证须区分——派单/回执中「红因=实现缺席」类表述以日志实读为准（T-UI-01 core 半边红因实为装具 TypeError，评审 F7 更正留痕）。
12. **装具契约面泄漏进生产代码**（T-UI-03 F1 实录：生产 markElOf 读装具假 DOM 的私有小平面 `.attrs`，真实浏览器 Element 无此属性 → 标记层全 dead，三门全绿假绿——与 #11 同族但根因不同：#11 是装具绕过守卫对象，#12 是生产照装具形状写而非照真实 DOM 契约写；**T-UI-04 S-1 二次复发**：三处 stub children 全是裸数组，生产 clearChildren 用 `children.pop()`——真实浏览器 children 是 live HTMLCollection 无 pop，任务会话第二次渲染即断+praise 残留，2064 绿零感知。裁决③刚真实化三处 stub 面，仍漏 children 维度——装具纪律须按**逐 DOM 面清单**核对而非按列举修）
   - 根因：假 DOM 装具暴露了非标准面（attrs/裸数组 children），生产读路径照装具形状写；Node 域测试全绿掩盖浏览器行为缺失。
   - 修复建议：①约定：假 DOM 装具只暴露标准 DOM 面（getAttribute/setAttribute/classList/**children=live 集合语义[无数组方法]+removeChild**），禁私有小平面；②生产代码禁读装具私有面——源码切片守门断言可机器判（「禁 .attrs」已在册，T-UI-04F 补「禁 children 数组方法直调」）；③新 DOM 交互代码的红测装具以真实 DOM 标准面为契约源，写码前先核 MDN 面；④**装具真实化按面清单逐项过**（classList/attrs/children/click/contains/removeChild…），每次「stub 真实化」后自问还有哪个面没核。
5. **T11 疑似 flaky（掷骰断言「到拍至少出一只」）**——test/adventure-core.test.js :3067-3106 域
   - 证据：全链红样本仅 1 次；量化 10/10 绿 + 全链 12 连绿不可复现；实现域零交集。
   - 修复建议：①量化改造断言（固定种子或统计阈值+N 次采样）；②归世界边界票测试域，开小票修，不混入 T-SEAM 链。

## 环境债（缺的确定性检查/规范空白）

- 三门证据形态无统一捕获口径（假绿根因）→ 见机械错误 #1。
- 头注释契约无机器守门 → 见机械错误 #4。
- （持续追加）

## PO 统一验收待裁清单（收口时随回执呈报）

1. **#townHud 挂载位置**（T-UI-01 登记）：hud-prebuild 字面「#hud 内挂子容器」vs 实装「body 下 #hud 兄弟节点」——**评审称重：站装配不改、规格回改**（prebuild §1.1 自declares「落点建议，实现票可微调」非硬约束；mode-kit :1707 在 cfg.hud 时 10Hz 重写 #hud.innerHTML + :1642 模式页收口整面清空，镇宿主恰好提供 cfg.hud → 挂 #hud 内必被冲掉，实治理由实证成立）。回改内容=prebuild §1.1 记录 body 级挂载+理由+「#townHud 全模式常驻、显隐归 adapter」。
2. **dialog-close 转移语义**（T-UI-01 登记）：brief 转移表「其他值→不变」vs 实装「非 done+taskRef 一律恢复 prev」（裁决测试为准，理由=卡死收敛违反零惩罚底线）——**评审称重：站实装侧**（dialog-spec §2.2 close 行原文「A 恢复 HUD」为无条件主句、done+taskRef 只是升级例外，实装是权威忠实读法且失败安全更优）。回写内容=prebuild §2.3 mermaid 补「其他 result → 恢复 prev」边+brief 转移表同步，归需求线，实现零返工。
3. **HL_AIM_DEG=8 / HL_AIM_MAX_DIST=24 参数核准**（T-UI-03 登记，依据链全文已获）：8°=6 岁宽容热区→准星锥角映射（体素锚点 10-20 格张角 1.5-2.5° 取约 4 倍宽容）；24 格=广场尺度外缘「走到跟前才亮」（钟塔 20/农场 10），与 P_D2_NEAR=40 留 16 格级差不抢戏；性质=施工裁量默认、无新增 U 编号、代码参数表同表单源；PO 调参位=core `townHlHit` 第三参注入。随附口径：§4.6「悬停切可点选态光标」在准星世界模型下豁免（准星即光标，准星本体反馈归票线新立）。
4. **GLOSSARY 收词债**（T-UI-03 评审 O1）：TownUi 词条缺 camRef/hlSource/onInteract、TownUiCore 缺 5 个 townHl* 函数+HL_ 两键、T-UI-02 四个 townPointer* 函数未收词——收词归 docs 清扫票（评审判不阻票清）。（原条款「done 态暖金点缀」已由 T-UI-03F 补齐落涂，出清单。）
6. **T-UI-04 视觉值族偏离 ui-designer 快裁**（评审 F1）：panel 宽 min(420px,92vw) vs 定稿 min(720px,92vw)、距底用 --town-hud-safe(≈20.5px@1280×720) vs 24-40、panel-bg #fff9ec 不透明 vs Bread Cream/Stone Light 90-96%、chip/ghost gap 10px vs ≥16、Panel 圆角 16 vs 上限 20、praise 徽章 56px emoji vs 96-160 宽——prebuild §0 明文「不在施工端改视觉」，待 ui-designer 追认入偏离登记或开票改值。
7. **T-UI-04 自撰话术文案批**（评审 F3）：dialogUtterFor 六态句全施工自撰（与 §8 模板/§2.2 矩阵示例句全部不同）；含「真厉害」「你真棒」标签式表扬 vs §7.1 夸过程导向；greet chip「挥手再见」vs 模板「挥手回应」且与 B5 wave-bye ghost 语义重复——入 PO/ui-designer 文案核批。
8. **T-UI-04 范围与走查项**（评审 F5）：ttsPlanFor/hudConvergenceFor 参数面在册、装配层未接线（首版 B 通道走 cancel-then-speak+既有冻结闸，语义达成）；praise 句可能被 1.2s dwell 步进 speech.cancel() 截断——T-UI-05 走查确认或 dwell 取 praiseTotalMs[1]；SpeechKit queue/drop 完整排队=增强项待 PO 批次。
9. **同锚遮挡三处·功能阻断（评审 F6，T-UI-05 前置小票）**：真清单 tour-plaza/find-bread/visit-stash 三个 task 条目全部被同锚 prop 条目遮挡（源序 bell-tower…market…stash…task@同锚…），townHlHit 并列取源序 → **真清单点选接任务全不可达**（E2E 过滤消歧在册、无真清单点选覆盖）。工程侧裁决方向=命中并列优先 sessionKind/task 条目（townHlHit 契约改约+锁定测试改约+真清单 E2E 补测；清单表序不动=机器红线）——**PO 追认此项交互语义**。
10. **NPC greet 轻问候留白**（评审 F7，低）：core 协议就绪已测，真清单无 npc 条目真机不可达——留白登记落盘（villagers 线后续）。
11. **east-spec.md 文档侧改稿归属追认**（整体评审规格轴新缺口，低·纯文档）：§13.2 明文「主话术退役与告示牌改读归 ui-designer 域随撤卡节拍收口（T-SEAM-05 票尾知会）」——撤卡节拍已落但零 commit 触及 docs/world-edge-design/（east-spec.md:17/20/111 仍载「小镇建造中」退役文案+过期定稿标记）；归属自相矛盾（§13.2 归 ui-designer vs ui-seam-notes.md:57 归 BA/地图线）、T-SEAM-05/走查回执均无知会工件。代码侧同族改稿已兑现（拒绝话术与视觉 spec §B.4 逐字一致）。请 PO 追认归属（ui-designer/BA/地图线）后开文档小票；不阻塞收口。
12. （持续追加）

## 票务面备忘

- T-SEAM-01：c4bb084（主体）+ 4f1012e（追令：showroom 回落清单补 town + 尾注释枚举 + 尾注）+ ba75557（S1 头注释同步）。评审：票清（16/16 锚）。
- T-SEAM-02：0046c8a（主体）+ b6d1c82（F1 头注释）。评审：票清。
- T-SEAM-03：73861a4（实现+红测）+ 83290b6（红方 lint 自收口）。评审：票清（零必修）。
- T-SEAM-04：48a762a（红）+ 0f15fab（绿）+ d16559a（S-1/S-2 注释，窄复审兑现）。评审：打回（轻）→ 票清。
- T-SEAM-05：3893313（原子收口）+ a024e24（F1 计数+F2 死 CSS）。评审：票清（F3 注释卫生票登记）。
- 残留消解记录：残留#1（mood calm 补曲）——calm-piano 在册，就地消解；残留#5（showroom town 桶）——派生+回落两面均已验证，消解。
- T-UI-01：3a460fb/77ebc82/fdb54c7/e9fc101 → 返工 4058a97（红侧守门扩锁+装具镜像+F3 红测）/7fb5084（F4 GLOSSARY）/07ea937（绿侧 script+落地闸）→ **窄复审票清**（F1-F5 全兑现；F6 spec 回写+F7 表述更正留登记线）。
- T-UI-02：3de7ee1（红 12）/d491c6f（绿）/2a903ab（红侧 lint 对齐）/e033ce2（O1 快照分支直测+突变自证+O2 缩进）→ **完全票清**。P1/P2 视觉落细两处归 T-UI-04/05 走查批次+PO 验收核对。票外约定：红方断言用 strictEqual 简单首实参形态（eslint indent 对 assert.ok 换行首实参强制消息 2 列不对称，勿 --fix）；失败测试定位用 `test at ...:行号` 探针（日志中文乱码致测试名探针漏报）。另：.opencode/ 有非本票杂物（.lnk 等）登记未处置。
- T-UI-03：e17bf65 → 71990e9 → fb68202 → **03F** c578abd/0dd414e → **窄复审票清**（F1 根除+F4 兑现+F2 降格结案；F3/O1/O3 已在 PO 待裁清单条款 3/4，勿静默丢项）。
- T-UI-04：6b48b51 → 4d1a4e2 → **04F 修复批** 2f96fff（live-collection 装具四处+双守门）/991870e（removeChild 标准面+双蓝拨正）→ **窄复审票清**（六项全兑现；第四站点票内延伸正当；断言适配零弱化；登记五项维持原路由已在 PO 待裁清单条款 6-10）。
- T-UI-04F：a2925ca → **评审票清**（改约正当实锤/六项断言变更零弱化/done ①案成立/真清单 E2E 三锚；note 三条留档：①tieTask 防御不对称 best.id 无 typeof[顺手补齐项] ②done 锁对真机器 states 变体覆盖缺口[登记] ③「任务接取=核心玩法」系演绎非 MISSION 原文[引用注明]）。+verdict 补账 2c9168d。
- T-UI-05：772e4de（红三锚转绿+走查清单 288 行+文案 §7.1 落地+dwell 2000ms+N1 防御）→ 8f91fe0（回执+幻影 hash 订正）→ **评审票清**（代码零缺陷；F-A..F-E 五项文档失准）→ **bdf73d8 文档订正闭环**（五项全核属实照改+订正痕 5/5）→ **全线票清**。
- **收口整体评审**：两轴聚合完毕——**端到端闭环成立（规格轴七段全✓零 scope creep 票间无缝）、形态纪律优秀（标准轴三族边界/参数单源/装配序三方一致/壳层零字面量全过）**；新发现=文档同步尾程半拍：硬违规 2（37 键计数漂移 §1.7/TownUi 词条缺 poseRef §1.8 新缺项）+smell 4 judgement call（最重=z74/75 四处内联双标）+索引漏挂 1 note+规格轴 east-spec 归属 1 低缺口（PO 条款 11）。
- **T-CL-01 收口修复小票：e47d55a 票清**（派令方逐行核收：计数 38/poseRef 参序正确/索引 74 自洽/常量四处等价/第 5 处牌面段未动=按票/测试面零触碰）。票外登记：ADV_TOWN_RETURN_Z 先例实在 adventure.js:2876（勘误不受影响）；牌面 z74/75 第 5 处语义不同留后续裁量；行号漂移指认无错位。
- **全线收口**：39 commits（25efa0c...e47d55a）全票清；三门终态 2071/2070/0/1+lint 0 @e47d55a。收口回执落盘（.scratch/handoffs/2026-11-14-town-change-closeout-receipt.md）。
- **验收：2026-11-14 PO 实机走查（本地服务 8088）后「暂时通过」**；11 项待裁清单挂账待议（条款全文在收口回执 §四）；待 PO 实机 12 项在走查清单 §13。服务已关。
- **retro 落盘**：.opencode/power-luna/feedback/2026-11-14-town-change-retro.md（装具契约面纪律三度实录+机械错误 14 条症状/根因/修复状态+确定性检查转化率偏低的警示）。**工程线收口完毕。**
- T-UI-05：收官走查票（brief 已实质改写：走查首步=主路尽头白闪进镇/禁焦虑清单/告示牌改读；前置依赖=04F 销号）。
- T-UI-04：待 T-UI-03 追令收口后派（会话三件套；依赖 01/02/03 齐）。
