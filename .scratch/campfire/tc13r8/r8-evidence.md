# T-C13-R8 对照证据注记（门额牌贴柱缝黑面修复, 2026-11-23）

票文归因与裁定语境: `.scratch/campfire/tc13r-review/r7-recheck-report.md` §附 +
gate-diag 诊断件(同目录) + docs/adr/0012(T4 旧裁定) + docs/adr/0021(H2 开修复窗口)。

## 对照复拍(同机位直证)

- 装具: gate-reshoot.js = tc13r-review/gate-diag.js 同骨架(同选址逻辑/同机位/
  同端口口径 8098/9229, 输出改名落本目录), 对修复后代码复跑。
- 场景自洽: 探针自搭门架(木柱×2+横梁+牌 80), 两次选址逐字同址 gate(70,58,30),
  格值同信(signCell sky=14 · 双柱邻格 0) — 前后对照单变量=pushGateSign 采样口径。
- 读数对照: 顶点总数 192(同) · 低光(0/0)顶点 **12 → 0**
  (病前 12 簇全部落牌板东西主面 x=71/71.15, 修复后清零)。
- 目验: gatediag-gateClose.png(病前, 门洞左缘纯黑竖面) 对 r8-gateClose.png
  (修后, 同机位暖亮竖面) — r8-gateWide.png 为广角全景对照。

## 门禁与提交对账

| 项 | 值 |
| --- | --- |
| 基线(checkout 后) | tests 2516 pass 2515 fail 0 skipped 1 |
| 红相提交 | 8e4c246(测试翻新+红测, texture-atlas 55 测 53 绿 2 红皆 AssertionError) |
| 绿相提交 | b590f52(js/mesh-core.js +9/−6 单文件) |
| 票尾对齐 | merge feat/campfire(e544282 docs 面) 零冲突 |
| 完工门禁(merge 后终树亲证) | tests 2517 pass 2516 fail 0 skipped 1 |
| lint 三门 | ESLint+Stylelint+htmlhint 零错误(merge 仅 docs 面不触及三门扫位) |
| 净增列名 | 「meshChunk: 门额牌主面顶点光非全零 — 贴柱缝语境双贴柱邻格 0 自身格透光 14(gate-diag 探针口径, T-C13-R8)」(texture-atlas 54→55) |

运行日志(未入库): accept-gate1..4 / final-gate-full / red-evidence-raw 等本目录 log 文件。
