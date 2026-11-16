# glider 批次工程 retro（engineer-manager · 2026-11-16）

批次：滑翔翼特性八票（T-G01–T-G06 施工票 + T-G07/T-G08 PO 调参微票）+ v1.2 规格迭代返工 + PO 压令并 main；分支 `glider` 收口于 `ef0a1e4` 之后（门禁基线 2196/2195/0/1 + lint 零错）。
体例：症状 / 根因代码证据 / 修复建议（按成本升序）。目标：机械错误变确定性检查、判断题变编码规范。

## 一、机械错误

### M1 注释字面参数值随调参过期
- 症状：sink 两刀调参（−3.0→−1.5→−1.2）各带出一处注释余波——js/voxel.js:403「缓降(−3.0)过不了高速门」数值过时（T-G07 微补丁 `718bcdd` 平账）；js/config.js:82 调参注释超长 128>120 致 lint 红（T-G08 自修后复过）。
- 根因：同一字面值散布注释区，config 单点改值后注释区无同步信号。
- 修复建议（成本升序）：① conventions 加一条「参数注释引 spec 锚/机制，不写会过期的字面值；字面值只留 config 参数块与测试镜像常量两处」；② 守门测试候选：对 GLIDE 已知参数字面值做注释区负向 grep（确定性检查，防第三刀再漏）。

### M2 大口径变更注释漏扫成批再现（「四槽」三批才净）
- 症状：五槽化后「四槽」口径残留分三批扫出——armor-overlay.js:27/:215（T-G06）→ 同文件 :263（票外发现）→ GLOSSARY.md:148/152、js/mode-kit.js:21/608/735、css/style.css:1720、test/boot.test.js:238、test/showroom-mode.test.js:86、js/button-icons.js:817/867（收口评审标准轴）。mode-kit.js 出现同文件分裂（:21 四槽 vs :43 五槽）无人察觉。
- 根因：口径变更票的验收块不含「全树旧口径清零」检查项；逐票评审各扫各票所有权面，跨票残留只能靠收口整体评审兜底。
- 修复建议：① 票面验收块模板：凡槽数/键数/任务数级口径变更，加验收项「git grep 旧口径 全树零命中（含注释与文档）」；② GLOSSARY/注释守门测试纳入已知被替换口径词负向断言。

### M3 全量首跑一次未复现断言红（时序型偶发）
- 症状：T-G08 改值后全量首跑一次 ERR_ASSERTION；同代码状态连跑 4 遍全基线稳定，无法复现定位。
- 根因证据：T-G07/T-G08 回执备查节；疑定帧窗与真实计时竞态（装具内帧步/定时混合）。
- 修复建议：① 票面纪律升格：遇不可复现红，同状态连跑 ≥3 遍再判，仍红才开诊断（本批已照此执行）；② 候下次触点给全量装具做时序审计（定位具体测试钉时序，成本高暂挂起）。

### M4 PowerShell 管道对 node 输出不可信（多次踩坑）
- 症状：管道丢行/GBK 乱码——两份 .scratch 日志被判二进制；npm test 汇总块（行首非 ASCII 标记）Select-String 抓不到；lint 错误列表截断。
- 根因：node stdout 经 PowerShell 管道转码丢字符，汇总标记行非 ASCII。
- 修复建议：① conventions §7 候选条款「npm/node 输出一律 `> 文件 2>&1` 落盘再解析，不走交互管道」（GP04 回执已建议，本批全程按此规避）；② 测试汇总行改 ASCII 前缀（`# tests 2196`）降低解析脆弱性。

### M5 评审/施工瞬态文件散落
- 症状：评审子代理曾留 .rev-cfg-head-tmp.js（后自消失）；GP04 期诊断 tap/脚本十数份散落 .scratch（后随簿记收拢入库）。
- 修复建议：① reviewer/tdd 主岗纪律加「临时文件落 .scratch 或用完即删，返回前 git status 自查」；② 经理侧「返回必亲自 status 扫尾」保持（本批零残留事故）。

### M6 测试装具全局桩跨段污染
- 症状：定向绿/全量红——camera 桩（globalThis.camera）老段残留污染新段，级联 2 红。
- 根因证据：GP04 回执验收期二次裁决（freshInit 统一复位收口后自愈）。
- 修复建议：新装具桩一律经 freshInit 复位出口；候下次触点全树排查同类 globalThis 桩（小票）。

## 二、环境债 / judgement call（不阻塞，列后续票建议）

- E1 stubThree 三份重复（test/avatar.test.js、paper-doll.test.js、mob-look.test.js 各 ~1.8KB 近同）：达 conventions §1.10「≥3 处」升格阈值——建议开小票抽 test/helpers/three-stub.js（§7.2 单源令扩围需先过 §1.10 判据）。
- E2 .scratch/glider/helpers/fake-dom.js 为 test/helpers/fake-dom.js 字节级复制（4934B 全同）：加快照头注（来源+日期），防工厂演进后无源可考。
- E3 adventure.js 收沿四连（advWings+advSfx+advGoldEdge+phase）双写：有镜像前收注释论证，suppress；第三处出现再提取。
- E4 slot==='glider' 特判四处（equipment-core/mode-kit/adventure×2）：各据其层，n=1 不升格；开第二特例槽时必须升格槽元数据表（conventions 候选条款）。
- E5 spec 残留措辞（§4.1/§4.2 v1.1 口径、§6「收翼 folded」半句）：需求线 spec 触点顺平，已转 scrum 并入在办记账批。
- E6 引擎面已知局限（空中续档首落点漏伤一格）：docs/glider-acceptance-report.md §6 已登记，候引擎触点根治。
- E7 splash 门存量外溢（高速入水由无声变有声）：授权链完整（spec §3.4 + T-G02 红测 + c670997 提交注明），PR 回执知悉项。

## 三、流程面（本岗自用沉淀，下批沿用）

- 调参微票清单化：改值=config 单点+测试镜像常量+按滞空比例复核定帧窗+引用值 grep——T-G07 建、T-G08 复用（窗口零放宽实测余量足），分钟级闭环。
- 共树并行纪律有效：文件面正交判定+全量门禁错峰，八票零争用事故；簿记显式点名文件，需求线在办件（glider-spec.md 未提交改动）全程零触碰。
- PO 调参走 spec §3.9「实现期可调」参数面微票不判需求变更；spec 正式记账归需求线——两刀验证链路顺畅。
