# 世界轨统一设计定稿（math-track unification）

> 架构评审候选 5（世界轨宿主统一）的拍板记录与交付清单。
> 评审入口：2026-10-24 架构评审（improve-codebase-architecture 流程，HTML 报告）；
> 相关词条：GLOSSARY「世界轨驱动器」「数学世界轨」「摆与搭世界引擎」。
> 切票 T1~T5 已交付（T5 三票于 2026-10 收官，屏流迁第三插件，见「交付」）。

## 背景

两世界宿主（js/math-world.js hop 混合宿主 / js/math-build-world.js 摆与搭指针锁宿主）
与屏流引擎（js/math-paradigms.js）共享同一 h 契约（`{progress, onTrial({ok,streak}), end(st)}`），
但 timers/stats/settle/试次钳制/表扬节拍三处逐字同构；退出清场纪律一个执行一个漏
（build 的 `stop()` 不调 clearWorld，3D 残场挂到下一次装场）；boss 链的 mathCtrl 与
mathBossStop 两条命靠注释维持顺序契约；变体分发要过三张表
（MATH_VARIANTS / MATH_SCREEN_KEYS+ENGINES 同文件双表 / MATH_WORLD_RUNNERS）。

## 拍板（Q1~Q12，grilling 决策树）

| # | 决策 | 结论 |
|---|---|---|
| Q1 | 清场缺陷 | 独立小票先行（T1），不与统一绑定 |
| Q2 | 形态 | **驱动器 + 交互插件**（deep：清场纪律进 seam 的 implementation） |
| Q3 | seam 层 | 应用层（训练营家族；试次/关卡是玩法概念，不下沉引擎） |
| Q4/Q10 | 注册表 | 同文件双表并一（T2）入票；终态=驱动器持统一分发缝，MATH_VARIANTS 仍是「什么变体存在」的唯一权威，MATH_WORLD_RUNNERS 降为驱动器内部插件注册，MATH_SCREEN_ENGINES 降为屏流引擎内部实现表 |
| Q5 | seed 派生 | 不入本票（统一会改「同 seed 同输出」的具体值；留奖励基座票统一收口） |
| Q6 | 三套 teardown | 入票：退出路径归驱动器所有 |
| Q7 | 命名 | 术语「世界轨驱动器（WorldTrackDriver）」+ `js/math-track.js`；两宿主文件名不动、降级为交互插件实现 |
| Q8 | 屏流引擎 | 驱动器按三插件设计；本票只迁两个世界宿主，屏流迁移另开票（T5） |
| Q9 | boss 链 | 迁入驱动器：mathCtrl/mathBossStop 两条命合一（alive 旗） |
| Q11 | end 时序 | 统一「清完再发 end」：驱动器在 end 前先离场（clearWorld/HUD/指针/DOM），残场问题在根上消失 |
| Q12 | 测试策略 | 剥小核：纯循环骨架进 math-track-core.js（必配同名单测）+ 装配纪律 vm+THREE 放行桩直测（world-integrity 先例） |

## 交付

- **T1**（8744a74）：build `stop()` 补幂等守卫 + clearWorld；boss 链 secEnd「先离场再清柄」死路修复
  （原顺序先置 null 后 leave，世界节 stop() 成死路）；`test/math-track.test.js` 守两宿主退出纪律。
- **T2**（83e3809）：MATH_SCREEN_KEYS 键集表删除，mathScreenDispatch 以 MATH_SCREEN_ENGINES 为清单唯一权威。
- **T3**（f19c0bf）：`js/math-track-core.js` 纯循环骨架（mkTrialLoop 记分+settle 节拍决策+end 回填 acc ·
  clampTrials 1~30）；三引擎的 settle/stats/钳制逐字副本 ×3 与 modes/math.js 第四份钳制全部切换消费核心。
- **T4**（f78b54f）：`js/math-track.js` 驱动器（dispatch/run/runBoss/leave/stop/active/mouse/worldRunners）；
  modes/math.js 净减约 130 行（分发表、boss 纯函数、runMathBoss、mathStopRun/mathWorldLeave、
  mathCtrl/mathBossStop 全部收编）；MathTrackCore 增 bossPlan（分发缝注入）/aggStats；
  驱动器纪律测试 3 例（清完再发时序时间线 / leave·stop·mouse 生命周期 / boss 串链+整链中止）。
- **T5-a**（4b5321f）：屏流节纪律测试补空窗（真 runMathScreen 过 MathTrack.run，count/snapshot
  代表变体）——清完再发时间线（事件序 ['stop','end'] 且 end 到达时 area 已清空）/试次进行中
  stop 中止（settle 闸断+计时器链断）/boss 混链实跑（两屏流节夹一注入假世界节：
  每节 end 恰一次、聚合在链尾、area 装配/清场交替）；trackRun 屏流分支先立 trackScreenRunner 命名缝
  （中间态）；runMathScreen.stop 补 area 清场（Q11「清完再发 end」的 DOM 项收进 seam——
  最后试次 .m-stage 不再残留到模式层换屏）。
- **T5-b**（acdec3c）：统一注册表 **MATH_TRACK_RUNNERS**（值 {kind:'screen'|'world',
  run(section,areaEl,h)}，29 键）——世界 13 键经每宿主一份适配函数转发（math-world/
  math-build-world 两宿主签名零改动），屏流 16 键加载期自 MATH_SCREEN_ENGINES 派生
  （组合期接线，不抄第二份清单；Q4/Q10 的「MATH_WORLD_RUNNERS 降为内部注册」终态由此
  演进为统一注册表，历史名废止）；dispatch 反转纯查表（在册键返 kind，未册键返 null——
  「未知键归世界轨」废除）；trackRun 双分支/trackScreenRunner 命名缝/runMathScreen 的
  null 防御消亡；单一权威断言互锁改写（注册表 screen 键集 ⇄ 引擎表 engine 键集，防两表漂移）。
- **T5-c**（本票）：文档清账——设计稿挂账清偿与三票补记、GLOSSARY 终态（三插件+
  MATH_TRACK_RUNNERS 词条改写）、头注释与历史名（MATH_WORLD_RUNNERS/worldRunners）清账。

### T5 行为面影响登记

- 未知变体键的 dispatch 返回从 'world'（查世界表不中）变为 null（查统一表不中）——
  math.js 消费链核实**外部行为同一**（两路径同敛于 run 返 null，且该返回值被调用方忽略）。
- 屏流节 stop 清 area DOM 从「模式层换屏兜底」变为 **seam 担保**（runMathScreen.stop
  清 area，Q11 的 DOM 项进 seam；boss 400ms 接力窗内与下一节 next() 双清无害）。

## 明确不在范围

hop 的 rAF 姿态直写（玩家状态意图 seam，候选 7 领地）· seed 派生式统一（候选 2）·
屏流引擎迁为第三插件（T5 挂起——后经 T5-a/b/c 交付，见「交付」）· 话术/图标注入位（保持现状）。

## 后续钩子

- ~~T5：runMathScreen 迁为驱动器第三插件（h 契约已同形，接口留门）~~ **已交付**
  （T5-a/b/c 三票，见「交付」段）。
- seed 派生式统一（math.js `i*7919+13` / build 宿主 `seed*31+idx*101+7` / 屏流 `rnd()*2147483647`
  三套）随奖励纯函数基座票收口——测试不锁派生式（只锁 LCG 常数与同 seed 确定性），迁移窗口安全。
