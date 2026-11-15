# 滑翔翼施工线进度回执 #1（engr-mgr → scrum）

> 通道说明：relay server 随本会话服务重启后未恢复（tools.relay 消失，目录仅余
> code-review-graph）。恢复前施工线→scrum 的进度/回执一律落本目录持久归档。
> 本文件对应时点：2026-11-15，T-G01/T-G02 frontier 并行收尾阶段。

## 已完成
1. 现场对账与准备：worktree 原 HEAD 游离 → 已立集成分支 `glider`；需求线工件
   （spec/tickets/UI spec/ADR 0012–0016/research 证据）落基线提交 **9ee82e7**；
   npm 独立安装（213 包，未 junction）；代码图谱全量建成（锚 9ee82e7）；
   绿基线 npm test：**2122 测 / 2121 过 / 0 红 / 1 skip**。
2. T-G02（引擎层）完工返回已送达：13 红测试全绿 + 既有 29 条 voxel 零回归 +
   conventions/boot 定向绿；证据 `.scratch/glider/receipts/T-G02-receipt.md`；
   票外发现：引擎 splash 门在游泳钳制后求值致高速入水永不触发，因票面验收
   「入水触发 splash 且落差清零」为票内必改点，绿方最小修正（帧首 vyStart
   快照+滑翔触水显式置位），main.js 零改动。**未提交，等经理合入窗口。**

## 事故与处置（服务重启）
- 派发 T-G01/T-G02 后服务重启：T-G02 完工返回完整送达；T-G01 完工送达被切断
  （返回 aborted），原 sessionID 丢失且无会话清单工具可寻回。
- 盘上实况核验：T-G01 红侧回执（21 红清单/裁决/票外发现）+ 绿方实现改动全部
  在盘（items/icons/craft/equipment/adventure-core/GLOSSARY + 五测试文件），
  仅回执 §4 转绿轨迹未勾。
- 处置：新起 tdd 主人接管收尾（sessionID ses_e20d74b4effeJidYMiyue1t0AH），
  授权到合入窗口（核实现↔红清单对应→定向转绿→补回执 §4→全量门禁→只提交
  本票所有权文件）。
- T-G01 红侧回执票外发现两条已裁定：js/armor-overlay.js:35 过期「四槽序」
  注释 → 归 T-G03 顺带修；adventure.js:5011 历史注释 → 不动。

## 下一步
- T-G01 收尾主人完工提交后：追令 T-G02 主（ses_e211429b6ffd0Oz9Nrmrlb0n8I）
  走合入窗口（全量门禁+只提交其所有权文件+回执补哈希）。
- 两票 ☑ 后 frontier 前进：T-G03（形象层，needs T-G01）∥ T-G05（摔落伤害，
  needs T-G02）并行派发；随后 T-G04（needs T-G02+T-G03）；最后 T-G06。
- 票图状态列随合并推进更新（当前 T-G01/T-G02 ◐）。

## 环境债登记（供收口 retro）
- 服务重启会切断 subagent 完工送达且 sessionID 无法寻回（无会话清单工具）；
  本票以「盘上状态核验+接管收尾」恢复，建议后续编制考虑送达失败的幂等协议。
- relay server 重启后不自动恢复，跨线同步需持久兜底通道（本文件即兜底实践）。
