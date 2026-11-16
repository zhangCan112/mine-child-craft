# Retro·PO 验收修复批(案①②④)并入收口

> 产出:工程线(engineer-manager) · 2026-11-16 · 批次:po-accept-fix 并入 villager-wave2

## 症状 1:合并后 3 红——「单跑掩盖、全量才暴露」装具互扰新变体

- 症状:po-accept-fix 单独树上全绿(2170/2169/0 红),并入含案卷③的集成 tip 后同文件 PO 块 3 红。
- 根因代码证据:test/adventure-mode.test.js 两票测试块同文件同进程;先到的 poArm() 永久装
  globalThis.MobLookKit/town-npc 两件(js/town-npc.js),案卷③ idle tick 生产路径
  (advTownNpcIdleTick→townNpcIdleHeadTarget→townNpcIdleParams)对非空傀儡账做参数懒解析,
  TOWN_UI_PARAMS 缺席即抛(js/town-npc.js:96 中文域错,设计行为)。
- 流程评价:评审预检**预言**了此风险(「poArm 永久装具与 ③ 块装具假设有互扰可能——合并后全量
  验证」),合并线首次全量即抓到——惯例有效,保持。
- 修复(按成本升序):
  1. (零成本,已做)合并涉测试文件 → 全量 npm test 作为合并线硬步骤(既有惯例,写进回执);
  2. (低成本,建议)收敛一条确定性备忘命令:合并后跑
     `git grep -n "globalThis\." test/ | sort` 人工扫一遍装具面装/卸配对——把「谁装了
     globalThis 键」从隐式知识变显式清单;
  3. (中成本,建议)新守门测试:扫描 test/*.js 顶层 globalThis 写入点,断言每个装具函数
     (poArm 类)有对应卸载或「永久装具」报备注释——把判断题变编码规范。

## 症状 2:「双尾追加」型合并冲突的公共尾归属判定易骗

- 症状:adventure-mode.test.js 冲突拼接时,启发式计数(test 数 vs `});` 数)一度骗过——
  嵌套 `});`、HEAD 侧最后一个 test 的收尾落在 git 公共尾区。
- 根因:手工拼装无确定性配平工具;计数法对嵌套结构不鲁棒。
- 修复(按成本升序):
  1. (零成本,已做)逐行枚举 `/^test\(/` 开行与顶层 `});` 收尾行(非计数),拼后 node --check
     兜底——本次实操有效;
  2. (低成本,建议)把「逐行枚举配平」固化为 node 一行命令模板,落 docs/worktree-pitfalls.md
     合并冲突小节,下回直接抄;
  3. (中成本,可选)小工具脚本:输入冲突文件,输出两侧 test/顶层结构配平差——收益边际,
     暂缓(双尾追加型冲突本仓库低频)。

## 症状 3:派令方事实底座过时(SM 报 main 82b22b6,实况 3f6a96d/31 文件)

- 症状:合并前收到的 main 指针与实况不符,若照单全收会造成合并基线误判。
- 根因:SM 侧报数时点早于 main 推进,无自核动作。
- 修复(按成本升序):
  1. (零成本,已做)本岗惯例「SM 事实底座先自核再动(git rev-parse + diff 面实数)」再次生效,
     保持;
  2. (低成本,建议)给 scrum 线的建议:派令报 git 指针时附 `git rev-parse HEAD` 原样输出+
     生成时点,消费方一眼可辨新旧。

## 环境债(已知,未新增)

- 中文长多 `-m` commit 消息触发 shell 扫描器 invalid-structure(本次再用短英文单条绕过,
  docs/conventions.md §7.3 已载纪律,零新增);
- 管道/Select-String 吞测试输出(conventions 首跑空输出,裸跑绕过,已知坑);
- PowerShell Set-Content -Encoding UTF8 毁中文(文件手术一律 node,本次遵守零事故)。

## 结论

本批三起症状全部被既有流程惯例(全量复跑/逐行配平/底座自核)在正确环节捕获并修复,零带病出闸;
环境债清单无新增项,三条低成本建议(装具面清单备忘/配平命令模板/指针报数带时点)供下批采纳。
