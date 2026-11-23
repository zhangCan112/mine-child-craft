# T-C13 红因直证(red-cause)
日期: 2026-11-22 · 分支: tc13 · 基线: 61da456(基线对账 2472/2471/0/1 见 .scratch/tc13-baseline.log)
红测试: test/texture-atlas.test.js + test/campfire-kit.test.js → `node --test` 结果 **68 tests / 59 pass / 9 fail**
日志: red-first.log(初跑)/ red-final.log(折行自修后复跑, 数字同)——红因全部为「票文 v1.9 要求未实现」型, 零「测试错误」型。

## 逐条红因(9)

| # | 测试(行号=red-final) | 红因(实测 vs 期望) | 类型 |
|---|---|---|---|
| 1 | campfire-kit.test.js:69(81 行断言) | `BLOCKS[81/82].thin` 实测 **0.5** !== 期望 **0.4375**(config.js 两态行未改) | 功能缺失 |
| 2 | texture-atlas.test.js:63(78 行断言) | `TextureAtlas.count` 实测 **64** !== 期望 **68**(PAINTERS 未加 64~67 四格) | 功能缺失 |
| 3 | texture-atlas.test.js:824(布局测) | `layout.tiles[81]` 实测 **number 62** !== 期望 **object {top:64,side:65,bottom:65}**(分面接线未改) | 功能缺失 |
| 4 | texture-atlas.test.js:913(64 燃灶面) | 固定像素 (0,0) 实测 **74,74,78,255**(paintAll 中性深灰底=该格无画师)——64 格画师未画 | 功能缺失 |
| 5 | texture-atlas.test.js:932(65 燃侧脸) | 透明区 (0,0) **alpha 255 !== 0**(同上: 65 格无画师, 中性灰全不透明) | 功能缺失 |
| 6 | texture-atlas.test.js:969(66 熄灶面) | 同 #4(66 格无画师) | 功能缺失 |
| 7 | texture-atlas.test.js:995(67 熄侧脸) | 同 #5(67 格无画师) | 功能缺失 |
| 8 | texture-atlas.test.js:1032(可辨性 v1.9) | 焰四档两 tile 合计实测 **0** < 期望 **≥80**(64/65 格无焰画, §4.4 静态 94) | 功能缺失 |
| 9 | texture-atlas.test.js:1094(meshChunk v1.9) | 扁盒顶 y 实测 **{6, 6.5}**(thin 0.5)≠ 期望 **{6, 6.4375}**(config thin 未改, mesh 读 BLOCKS 驱动) | 功能缺失 |

## 保留测零弱化自证(本票零改动锚, 全绿)

- 62/63 作废存档像素两测(固定索引重定向后)pass——旧画师格仍逐字符 v1.0 旧稿 ✓
- 篝火图集相邻格测(62/63 vs 61 灰度差)pass ✓
- 篝火顶点光三测(自身格/面朝向邻格/口径不回退)pass ✓
- 篝火确定性测(循环扩 [62..67])pass——64~67 现为中性灰底两次绘制一致; 绿方画师落地后该测转守 rng 纪律 ✓
- 布局覆盖面测(usedTiles 循环)pass——证明现 81/82 number 条目在该循环下存活, 分面 object 化后需三键齐(新布局测已断言 bottom=side)

## 红因与票文映射

§4.1 分面接线(红因 2/3/9)· §4.2 四画稿燃态(红因 4/5/8)· §4.3 熄态(红因 6/7)·
§4.4 判据 94/46/8/双零(红因 8)· §4.5-5 四张行宽(绿)· §3.4 thin 0.4375(红因 1/9, 申报:
campfire-spec §3.4「thin:0.5」行与 GLOSSARY 篝火词条随本票变陈旧, 如实申报不擅自改)。

## 探针前置实证(.scratch/campfire/tc13-verify/probe.json + probe-{lit,out,thin}.png)

- 当前 tip 燃/熄两态实测几何 maxYrel=**0.5**(半格成立), 石块对照 1.0(测量法自证)
- tile 62/63 画师格 alpha≥128 可见像素 **256/256(100%)满格不透明**——「PO 手玩读作全尺寸实心」
  根因定案: **不在几何(thin 0.5 生效), 在贴图(旧稿满格不透明无 alpha 造型)**
- thin 热切换主线程改 BLOCKS 不达 Worker(mesh-worker.js 独立词法环境, importScripts 装载自己的
  BLOCKS 副本)——thin 0.4375 实机几何验证天然归绿后重跑探针(页面重载→Worker 装新 config 值)
