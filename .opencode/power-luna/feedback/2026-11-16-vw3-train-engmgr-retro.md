# villager-wave3 三小票 train（T-TEST-T11 / T-TEST-T14 / T-UI-DLG-01）· 工程线复盘（engmgr 第二棒 · 2026-11-16）

三票全部 FF 并入 main、两轴评审零修复项、合并 tip gates 绿（终态 2321 测/0 红/1 skip + lint 三关零错 + conventions 13/13）。以下按「症状 / 根因（证据）/ 按成本升序修法」记录本波施工与跨线协调暴露的机械错误与环境债。

## 1. 「npm test 绑 8080」神话三连击（陈旧记载反复误导排期）

- **症状**：票面 §6、派令模板、conventions §7.3 三处记载「测试装具占 8080」→ 串行排期过度保守；本波两票独立实证 `npm test` 全链零端口绑定（boot 冒烟纯 vm 装载，test/ 全目录零 createServer；施工日 8080 上并行的 `node server` 与三道门零交互）。
- **根因**：手工验证流程（node server.js 手测）的端口纪律被误记成测试纪律，三处文档互相引用以讹传讹。
- **修法（成本升序）**：①conventions §7.3 一句勘误（8080 仅涉手工 server.js）→ ②存量票面陈旧注记由需求线顺改（DLG-01 票面 §8.4-8 已登记销号归需求线）→ ③派令模板删「8080 串行」条款，保留全量串行纯资源纪律。

## 2. rider 落点错班车（6370ae5 stranded 实录）

- **症状**：需求线件十追补 commit 6370ae5 落在已收口的旧分支 t-test-t14-sky-seam-pin，错过当期班车与 main。
- **根因**：随车方持过期分支引用，落盘前未核实当期在飞分支名。
- **处置实录**：彼时在飞分支零自有 commit 且树净 → 经理线分支指针前移救援（rider 提交原样保全，无 rebase/reset/amend）；随后按 scrum 令 FF main→6370ae5 补并，stranded 清零。
- **修法**：scrum 已采纳为派令模板条款「随车 commit 落当期在飞分支；落错班车报工程经理处置，勿自行追提交」（指针，不展开）。

## 3. cmd `%ERRORLEVEL%` 同命令行提前展开 = 假 0

- **症状**：T11 施工首轮 `echo LINT_EXIT=%ERRORLEVEL%` 打出假 0，日志实读见 2 个 max-len 错；被迫 N=5 于终态整体重跑，消除「交付树≠受测树」争议面。
- **根因**：cmd.exe 对 %VAR% 在整条命令解析期展开，非执行期取值。
- **修法**：gate 判读一律下一行单独取 `$LASTEXITCODE`（PowerShell）或直读日志尾（机械输出）；conventions §7.3 既有「直读文件」条款已覆盖，无需改规范。

## 4. 派令计数类指令未经考古（DLG-01「4 处」vs 实 3 处）

- **症状**：ADR-0012 引文派令口径 4 处，施工方逐 commit 考古实为 3 处（第 4 处系语义引无编号引；另一处「ADR 0012」属滑翔翼群在先编号，改指才是错）；reviewer 独立复核判施工方正确。
- **根因**：派令链（评审→预告→终裁→派令）多手转述计数，未逐 commit 复核；行号/计数随版本漂移。
- **修法**：①派令含计数时标注「立令日口径，施工前考古为准」→ ②鼓励施工方挑战计数类断言——本次挑战-裁决闭环零返工，是好样本。

## 5. ★ 公共 main 跨线坏档处置实录（scrum 指定条目）

- **症状**：DLG-01 合并执行时 FF 失败——main 已被推进至 7966484（镇东带收线真合并），该 tip 的 test/adventure-mode.test.js 为坏档：7449 行 EOF「Unexpected end of input」，全量门文件级红 + lint Parsing error，对全部后续线构成公共阻塞。
- **定位证据**（二分截断扫描，.scratch/t14-repair-scan.js；blob 经 node execFileSync git show 提取绕 PS 重定向编码坑）：6370ae5=7263 行/247 开/247 收 OK；cf54609（spinner tip）=7360 行/248/248 **完满**；7966484=7449 行/**251 开/250 收**，坏块起点 line 7280=T-SPINNER-LEAK 离场排空块——手并「两测试块并存」时丢失该块收口。
- **处置时间线**：我线升级报告（坏档实证 + 三修复选项，基于 7966484 时点观测）→ scrum 终裁 (b) 案授权我线机械修复 + 归属线知会 → **归属线（镇东带）抢先自修 9e86c3b**（并版后即跑全量门、恰获同款红、即诊即修，补回 finally+test 两行闭合；4236a67/88ad74d 两笔 retro 教训自账）→ scrum 紧急拦令撤销 (b) 授权（修复 commit 勿落，防双重闭合二次坏 main）→ 我线授权转**验证方**：按终裁①判据独立核验——cf54609 spinner 块 85 行与修复后 blob **逐字节全等**（补回的恰为尾 2 行 `  }` + `});`）、251 块逐块前缀解析全过（证据 .scratch/t14-verify-fix.js/.log）。归属线修复恰好通过我线为 (b) 案预建的机械验收线，零语义裁量双方都守住。
- **时点差教训（跨线窗口观测，双入粮仓对子=东带 retro 13「no-commit 先门后提交 + 窗口主动通报制」）**：坏档是窗口期瞬时态（7966484..9e86c3b），我线二分扫描撞上的是中间快照；scrum 与我线据快照推定「并版未跑 gates」有误——东带跑了、修了、收线通报已明载。**跨线判坏档/判缺位前必须 re-scan main 现 tip 再下结论，时点差=假病灶**；同理，升级报告与修复授权之间应带「以落令时点 re-scan 为准」有效期条款。
- **机械修复判据（留档，同型事件直接复用）**：①与完好基线 commit 同块逐字对照（补行数=对照差，通常 1-2 行）；②node --check 全文件 + 逐块前缀解析双验证；③修复后全量 gates 于工程 worktree 复证；④commit message 引证事件链与归属知会。
- **结构性根因与修法（成本升序）**：真合并时代（FF-only 惯例已破）无「并版必先跑门」口径——东带 retro 第 12/13 条已自账（先提交后跑门=流程缺口；后继并版一律 no-commit 先门后提交）。工程侧补充：①合并预检三件套（node --check 秒级 + 全量 npm test + lint）在任何真合并/手裁并版前必跑并留痕；②本口径升格 conventions 条款，归规约线裁量。

## 6. 多线共用 main 仓 checkout（本波三次冲突同根源）

- **症状**：①7966484 手并坏档（在 main 仓手裁冲突）②6370ae5 错落旧分支 ③DLG-01 FF 窗口被在飞施工占用（6 tracked 文件未提交横在合并路径上，其中恰含 FF 必更新文件；经理线合并前状态护栏正确 ABORT）④**红 main 复发**：1a050a1（雪球投掷 affordance 用户票）落地即红——showroom-mode.test.js:1192「零伤害红线 雪球永不扣血」dmg 1≠0，确定性 3/3 同签名（非间歇债）；据实归因链=我线 88ad74d 并集态 gates 0 红 → 唯一增量 1a050a1 → 红，且我线两笔零 js 触碰。东带 retro 13 的「no-commit 先门后提交」只约束了并版（merge commit）形态，**普通 commit 直落 main 同样需先跑门**——门纪律口径需扩到全部落 main 提交。
- **根因**：main 仓 checkout 被当施工区用；多线各自在其上施工/簿记/合并，仓状态在两条命令之间即可突变（本波实证：tip-gate 曾被外来脏态污染、HEAD 三度易手）。
- **修法（已报 scrum 建议纳入派令模板；成本升序）**：①施工一律在各自 worktree，main checkout 只做合并与簿记落档；②FF/合并窗口经 scrum 认领（简短占窗声明即可）；③合并前状态护栏条款化（branch==main && HEAD==预期 && tracked-clean，违者 ABORT）。本波窗口最终以 PO 授权 stash 清窗解局（6 tracked 在飞文件暂存可恢复，恢复指针经 scrum 转呈占用会话）——权宜有效，但恰好反证①：若施工本就在线内 worktree，此窗根本无需清。

## 7. .scratch 瞬态 .js 会被 eslint 扫到（gates 卫生）

- **症状**：DLG-01 重铸 tip lint 3 errors，全部来自我线诊断瞬态件（两个 PS `>` 重定向 UTF-16 坏档 blob + 一个带顶层 return 的判据脚本）——`eslint .` 不豁免 .scratch；T11 探针能过纯因写法本身 lint-clean。
- **根因**：§7.7 只约定「不入册（git）」，未约定 lint 视角；诊断脚本语法/风格不受控。
- **修法（成本升序）**：①个人纪律：gates 前清场或把诊断件写成 lint-clean（本次删 3 件归零，判据证据保留在 lint-clean 的 scan/verify 脚本与 .log）→ ②建议 eslint config ignores 增加 `.scratch/**`（一行，归规约线裁量）。

## 8. PowerShell `>` 重定向写 UTF-16LE（再度中招）

- **症状**：`git show … > file` 产物 node 读成乱码，诊断脚本首跑即炸（本波第二次踩中）。
- **根因**：Windows PowerShell 5.1 `>` 默认 UTF-16LE 输出编码。
- **修法**：blob/文本提取一律 node 内 `execFileSync('git',…)`；建议升 conventions §7.3 显式条款（归规约线裁量）。

## 环境债核对

- 认证一律自家 worktree：本波再次实证（main 仓 tip-gate 曾被外来脏态污染出假象）——已是惯例，建议随第 6 条一并条款化。
- worktree 图谱 hook 缺失（手动增量）——在案，未出新坑。
- 限额中断 SOP——本波未触发，无新增输入。

## 挂账指针（均已在册，不重复展开）

- DLG-01 两条可选优化（降级块锚定档动画字面补行、豆影 `--town-dlg-shadow-far` 单源化）：scrum 终裁登记不立票，T-NPC-15 若触 css 面由当值线顺改（票面 §8 在册）。
- T-TEST-T14 班车路由项三裁（micro rider 归工程线自办→已落地 2dbb37d 前身 d84ce2a；Node 24 spec 报告器→登记备案）。
