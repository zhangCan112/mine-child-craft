# Retro：2026-11-13 PO 变更工程线（T-SEAM-01..05 + T-UI-01..05 + 04F + T-CL-01，39 commits）

> 验收：2026-11-14 PO 实机走查后「暂时通过」（11 项待裁清单挂账待议，见 .scratch/handoffs/2026-11-14-town-change-closeout-receipt.md §四）
> 详细台账：.scratch/town-seam-change/retro-notes-engineering-line.md（#1-#12 全文）

## 本批最有价值教训：装具契约面纪律（两度复发，P1 级×2）

**症状**：三门全绿（Node 域）掩盖真实浏览器生产缺陷——
1. T-UI-01：town-ui-core.js 未进 index.html 装配序 → 浏览器 `TOWN_UI_CORE=null` 进镇即炸 + rAF 停摆；
2. T-UI-03：生产 `markElOf` 读装具假 DOM 私有小平面 `.attrs`（真实 Element 无此属性）→ 标记层全 dead；
3. T-UI-04：生产 `clearChildren` 用 `children.pop()`（真实 children 是 live HTMLCollection 无 pop）→ 任务会话第二次渲染即断 + 表扬残留；**且其裁决「stub 真实化」刚修过三处面仍漏 children 维度**。

**根因代码证据**：
- 双栖模块（CJS require + 经典 script）测试只覆盖 Node 分支；集成链装具自装补缺绕过了它声称守卫的装配序；
- 假 DOM 装具暴露非标准面（attrs / 裸数组 children），生产照装具形状写而非照真实 DOM 契约写；
- 「stub 真实化」按列举修（classList/attrs/click）不按面清单核，漏列维度即漏网。

**已落地的确定性防线（本线在册，勿拆）**：
- 装配守门：每新增 script 同票必扩断言（五点序锁全链）+ 集成链装具「读 index.html 真实序装载，缺席不补」；
- 源码切片守门：js/town-ui.js 禁 `.attrs` 直读 + 禁 `.children.<数组方法>(` 直调；
- 装具面契约：假 DOM 只暴露标准面（get/setAttribute/classList/live 集合语义 children+removeChild，无数组变更法）。

**按成本升序的后续建议**（2026-11-14 env-steward 线全部落地，标注见各行）：
1. （零成本·约定）新 DOM 交互代码写码前对照 MDN 标准面；「stub 真实化」后自问「还有哪个面没核」（classList/attrs/children/click/contains/removeChild/parent…）；**〔已落地〕docs/conventions.md §7.5（纪律登记）**
2. （低成本·约定）红基线红因分类留痕：装具炸（TypeError）≠断言红（AssertionError），红自证区分——派单/回执表述以日志实读为准；**〔已落地〕conventions.md §7.4 + .scratch/run-green.js `[red-cause]` 机械分类段（半机器判：分类脚本出、回执引用不手写）**
3. （中成本·测试）假 DOM 契约面单一来源化：三处+站点（fakeEl/vm 笼/E2E mkEl/mkHeadlessDoc）共享同一 mkEl 工厂，面收敛一处改处处改——根治「第四站点」式漏网；**〔已落地〕test/helpers/fake-dom.js 唯一工厂 + conventions.md §7.2 + 守门断言（test/ 九站点收敛；math 系专用驱动桩与 vm 笼源码串登记例外；js/town-ui.js mkHeadlessDoc 系业务文件不在环境处置面，与工厂同形，收敛走工程线票）**
4. （中成本·测试）GLOSSARY 确定性检查：程序化断言词条一览 declared 计数=actual（本线两度手修计数 69→70→71→74，确定性检查一次到位）。**〔已落地〕test/conventions.test.js GLOSSARY 断言（计数=actual + 一览↔正文双向对齐）——首战抓获 9 处漂移并修正（7 条目错挂分区/1 条索引名漂移/1 分区头形态不一）**

## 机械错误与环境债清单（症状→修复状态）

| # | 症状 | 根因 | 修复状态 |
|---|---|---|---|
| 1 | 假绿门：cmd `%ERRORLEVEL%` 解析期展开，链式 `&` 只反映链尾 | cmd 变量解析期展开 | ✅ 已修入 `.scratch/run-green.js`（原生 summary 为准）；纪律=分门捕获不混链 |
| 2 | PowerShell 拒分号串联多语句 | 语法 | 约定：拆单条；commit 多 `-m`（2026-11-14 已模板化入 conventions §7.3） |
| 3 | 日志/管道中文 GBK 乱码致测试名探针漏报 | 控制台编码 | 约定：中文核对 grep 直读文件；失败定位用 `test at ...:行号`（2026-11-14 已模板化入 conventions §7.3：日志落盘一律工具直写禁 `| Out-File`） |
| 4 | glob 不搜点开头目录 → 「证据文件不存在」误判（T-UI-03 F2 实录，评审员自己也踩） | glob 工具行为 | 约定：查 .scratch 用 Get-ChildItem/直读路径 |
| 5 | subagent 派令四字段缺一即报错 | API 契约 | 已知，照填 |
| 6 | 回执/文档声明字面失准（T-UI-05 F-A..F-E 五项：文件职责错挂/红因 800ms 失真/引文非原文） | 速记转写未核实物 | 约定：回执声明逐条对实物核后再写；引文照抄原文 |
| 7 | 幻影 hash（T-UI-05 速记 a3f8e21/f0c1b7d 不存在） | 上下文压缩后速记失真 | ✅ reflog 核实+订正记录入回执；约定：hash 一律 git 亲核 |
| 8 | 撤除类 commit 后 `git show HEAD:<path>` 失效 | 基线漂移 | ✅ 约定：等价证明钉基线 hash（tseam05 示范在册） |
| 9 | vm harness 裸 `return ctx` 断言空转假绿 | 装具返回形状 | ✅ 约定：harness 返回 `{ctx}`；红自证必抽验红因 |
| 10 | 红测 commit 先行自带 lint 红 | 三段式固有形态 | 裁定：按「清偿轨迹完整」称重不判违规；04 起红测 commit 自带 lint 绿（改进形态） |
| 11 | eslint indent 规则不对称（assert.ok 换行首实参→消息 2 列） | 规则实现 | 约定：红方断言用 strictEqual 简单首实参形态，勿 --fix |
| 12 | Windows Node 24 spawnSync npm 需 shell:true | spawn 语义 | ✅ 已修入 `.scratch/run-green.js`（可复用 runner） |
| 13 | 8080 端口多分区共用冲突（EADDRINUSE） | 多分区同机 | 约定：起服务先探占用，`node server.js <port>` 换口 |
| 14 | .opencode/ 杂物（.lnk 快捷方式等）混入工作区 | 环境卫生 | ✅ 已清理（2026-11-14 env-steward D12：`.opencode/agents/WPS云盘 - 快捷方式.lnk` 已删） |

**环境债只进不出的反例警示**

本线 retro #1-#9 多为「约定」型修复（靠纪律），确定性检查只落地两条（源码切片守门+装配守门）。**判断题变编码规范的转化率偏低**——下批工程开工前建议：把上表「约定」列里可机器判的三条（红因分类形态/装具面清单/hash 亲核）做成 lint 类脚本或测试断言，目标=下次 retro 此表不再增长同族条目。

**〔2026-11-14 env-steward 转化评估落地〕**三条逐条因果裁量：① 红因分类形态=半机器判——run-green.js 自动输出 `[red-cause]` 分类段（§7.4），表述纪律随 §7.4 登记；② 装具面清单=已机器化且由 A1 承载（唯一工厂+守门断言即面清单的执法形态，不另立清单脚本——第二份清单必漂移）；③ hash 亲核=不可机器判（回执是散文体，正则 hash 校验器会造虚假信心）——如实维持约定登记（§7.3 邻域，随回执纪律执行），不硬造防线。
