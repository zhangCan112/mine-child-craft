# T-C13 完工材料(交 design-lead 管线复验 + thin 核实结论落盘)

票面: docs/campfire-tickets.md T-C13 · 分支 tc13 · 提交序 845e542(红)→77306b8(绿)→c00f60c(裁决)
日期: 2026-11-22 · 权威: docs/design/campfire-visual-spec.md §4 v1.9

## 一、§4.4 判据数值复验(真图集实测, 固定种子 0x5EED0001 派生可复跑)

| 判据 | spec §4.4 | 实测 | 结论 |
|---|---|---|---|
| 焰四档两 tile 合计 | ≥80(静态 94=灶面 44+侧脸 50) | **94**(64 格 44+65 格 50, 逐像素点数) | PASS 且精确命中静态值 |
| 白芯/亮黄(W/w)合计 | ≥36(静态 46=灶面 26+侧脸 20) | **46**(26+20) | PASS 且精确命中 |
| 余烬红 e | 8px(灶面双弧 r4/r10) | **8**(64 格 8+65 格 0) | PASS 精确 |
| 熄态两 tile 零焰色零 e | 双零 | 双零(66/67 全 256px 扫描) | PASS |
| 熄态最高亮像素 | =灰烬灰 #b9b4a8(luma 180.2) | =a(66+67 合并扫描) | PASS |
| 确定性(§4.5-3) | 同 seed 两次逐像素一致 | 六格 62~67 全一致 | PASS |

复跑方式: `node --test test/texture-atlas.test.js`(可辨性测+v1.9 四像素测即上表程序面)。

## 二、§4.5 五锚实机走查材料(headless Chrome 探针, 固定路径可复跑)

复跑: `node .scratch/campfire/tc13-verify/probe.js`(自起 server 8091+headless Chrome 9223,
自清场; 8090 是 PO 服务不相扰)。

| 锚 | 程序面实测 | 材料 |
|---|---|---|
| ① 矮半格不占满格 | 两态 maxYrel=**0.4375**(=7/16, thin 经 config→mesh-worker 实机生效), 石块对照格=1.0 自证测量法 | probe.json(lit/out/stone/thin 四测)+probe-lit.png/probe-out.png |
| ② 木框底座木质主视觉 | 65 格原木区(r10~r15)不透明木色像素为主体, 顶面 L 环+D 内缘围合 | probe-lit.png(远景)+tile65 逐字符测 |
| ③ 火焰只从中心区冒 | 65 格火舌 r2~r9 集中中心列(col3~12), 上半区 alpha=0 真透; 顶面焰团限 r5~r9 中心 | tile65 alpha **122/256(47.7%)**=256-134 个 '.' 精确吻合 |
| ④ 顶面灰烬+炭心 | 66 格 a 坑+k 心(r6~r9 对称炭心)+a 散斑 per-tile | tile66 alpha 256/256(灶面无镂空)+66 像素测 |
| ⑤ 木头主体火焰点缀 | 65 格焰色仅 50/256(19.5%), 木区+框占主导 | tile65 逐字符测+可辨性测 |

六格 alpha 审读(probe.json): 62/63(v1.0 存档)=256/256 满格不透明; 64/66(灶面)=256/256;
65=122/256; 67=90/256(=256-172 个 '.'+6 散斑粒落透明带, 自洽)。
人眼五锚终验归 design-lead 管线/PO 复验(票面 §4.5-6), 本材料为其提供可复跑程序面+截图。

## 三、thin 几何实机核实结论(票面要求 4, 结论落盘)

**采用 0.4375(=7/16 正典), 引擎全链可吃, 已实机生效。**

- 引擎消费端核实: 全仓 `.thin` 消费端(mesh-core 扁盒几何/adventure-core/cascade-core/
  fluid-core/world.js 选框)均为 truthiness 或算术, 任意浮点可吃; thin 不参与物理
  (spec §3.4 勘误: 站立面=voxel 整格贴齐), 两态篝火顶防叠放由 thin≠null 机械达成,
  0.4375 同样满足。
- 实机证据: config.js 两态行 0.4375 → 页面重载 → mesh-worker(importScripts 独立词法)
  装载新值 → headless 探针实测两态 maxYrel=0.4375(probe.json)。
- 红期曾试主线程热改 BLOCKS[81].thin 复测: 不达 Worker(独立 BLOCKS 副本), 属架构认知
  非缺陷——热切换验证必须走「改 config+页面重载」路径, 已按此路径复核。

## 四、「全尺寸实心」根因定案(票面验收第 3 项)

**根因=旧 v1.0 贴图满格不透明, 非网格 bug。** 证据链:

1. 几何面: 红前探针实测当前 tip(61da456)两态篝火 maxYrel=**0.5**(半格扁盒成立,
   pushCampfireBox thin 参数化机器正常工作), 石块对照 1.0 排除测量假象;
2. 贴图面: 旧 62/63 画师格 alpha≥128 可见像素 **256/256(100%)满格不透明**——灶面俯视
   图贴满四侧+顶, 无 alpha 造型孔, 半格盒观感即「实心火焰方块」(PO 手玩读感);
3. 定性: 与定稿 v1.9 背景节判定一致(「定稿缺陷非施工缺陷」), 本票以分面双 tile+
   侧脸 alpha 真透修复(65 格可见率降至 47.7%, 67 格 35.2%), 几何机器零改动。

## 五、票面锚点修正申报

- pushCampfireBox 实际在 **js/mesh-core.js**(票面源码挂靠点写 js/voxel.js)——mesh 消费端
  小改已落该处, voxel.js 零触碰;
- thin 常数在 **js/config.js** BLOCKS 两态行(非 voxel.js);
- 测试名裁定记录: 11 个新测试名中带「v1.9」者 9、带「T-C13」者 3、两标齐全者 2——授权字样非全称覆盖,
  但裁定授权全链可溯(票文 T-C13 要求 5/红提交 COMMIT_RED/red-cause.md 均载「PO 不过项 #1+定稿 v1.9 授权」原文)。

## 六、遗留陈旧点申报(不擅自改, 归各主管线)

1. campfire-spec §3.4「thin: 0.5」行——物理形态裁定面, 渲染值已 0.4375;
2. GLOSSARY 篝火词条(62/63 表述)——词条随 v1.9 变陈旧;
3. campfire-visual-spec §7 画师格注册表「画师格=62/63」行——注册表现状描述;
4. texture-atlas.js 头部 count 注释绿方已同步(0~67), 无遗留。

## 七、门禁终态

- 定向: node --test test/texture-atlas.test.js test/campfire-kit.test.js = **68/68/0**
- 全量: npm test = **2476 tests / 2475 pass / 0 fail / 1 skipped**(基线 2472/2471/0/1,
  净增 4 测全绿, 零回退; 1 skip=既有预期)
- lint: npm run lint exit 0(eslint+stylelint+htmlhint 三门零错误)
- 日志: gate-full.log / gate-lint.log / accept-final.log(本目录)
