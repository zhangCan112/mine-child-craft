# T-C13-R7 复验报告（design-lead 管线复验，2026-11-23）

> 依据：`.scratch/campfire/tc13r-review/r7-acceptance-recheck.md` 七条清单。
> 纪律：不转抄施工自验——probe-r7-light.js 亲跑逐值对撞、四图目验、测试亲跑、代码落点亲读。
> **结论：七条全过，R-7 复验 PASS**（附一条走查中新暴露的既有边界登记，不阻塞）。

## 逐条复验结果

### ① 黑区对照图组（修复主判据）✅

- **亲跑对撞**：probe-r7-light.js 复跑与施工 json 逐值一致——
  `a1_outGroundDarkN=0`（out 态地面 252 顶点全亮，对照 R-7 前 272 顶点 4 个 0/0）；
  `a1_outWallFireMinSky=1`（沙壁病灶面 8 顶点 sky=15 满值）；
  `out.ground.darkAt="(none)"`、`missing=[]`（0 缺光 mesh=熄格回收生效直证）。
- **目验**：r7-out.png（熄态靠墙场景，施工探针比原平地版更能凸显沙壁病灶面）——
  墙面病灶段正常亮色、脚下无黑框。
- **代码落点亲读**：light-core.js `opaque: solid ∧ ¬glass ∧ ¬thin` 一行在位（H2）。

### ② 燃态光晕回归 ✅

- `a2_litWallFireAll="1/0.933~1/1"`（燃态光晕满值连续）；
- r7-lit.png 目验：焰片动画正常、墙面被 light 15 光晕照满（贴墙距离内满值合理）、烟粒子工作中。

### ③ 夜拍（H2 相对 sky-only 的增量验证面）✅

- `a3_nightWallFireMinBlk=0.733~0.8`（夜间熄态格吃到火把 block 光传播=11/15~12/15，连续无暗差）；
- r7-night.png 目验：墙面暖光均匀、无暗框接缝——sky-only 方案会在此留夜间变体黑框，
  H2 双通道的优越性落图实证。

### ④ 门额牌 80 归位 ✅（本条判据内 PASS；走查中新暴露一条既有边界，见 §附）

- `c_gateLintelMinSky=0.933`（横梁朝牌格底面 4 顶点全亮=从黑变亮归位）；
- 牌格 `signCell sky=14`（H2 透光生效，BFS 侧源绕入）、南北邻空气 15（定址自诊断齐）。

### ⑤ 焰帧 lowcore 档复测 ✅

- campfire-fx-core.test.js **35/35** 亲跑全绿——红测转绿断言亲读：
  「lowcore 相位窗: 低核档 50 火逐时刻帧覆盖=3——相位·T 铺满 fs_eff 整圈（对旧不变量
  T=frames×frameS 真红）」；桌面恒档对称断言保全。
- campfire-bench.test.js **8/8** 亲跑全绿（R-6 桌面档 5 测保绿在内）。
- 代码落点亲读：fx-core `const period = fp.frames * fsEff;`（fsEff 含 lowMul/渐弱因子）。

### ⑥ 泄漏清零断言 ✅

- 断言亲读（campfire-fx-core.test.js :365+）：浇熄格余韵期满查询面退场+cells 泄漏清零+
  窗口内 dig 悬空无害（五纪律保全）+燃尽对照回收不回退——四路径锁死。
- 回收门代码亲读：`closedAt = burnoutAt ?? quenchAt` + 四数组空才删（与裁量 §3.2 一致）。
- 直证：out.ground missing=[]（0 件）；probe-r7-missing-attribution.md 51 行收讫
  （真未回收件 0，旧探针「1 变 5+恒在件」全闭环——瞬态池摆位残留+展品火合法燃烧）。
  **旧归因报告 §5「21 件恒在=装饰」更正为旧回收 bug 滞留池，以新注记为权威指针。**

### ⑦ PO 复验实机（材料面）✅

七条中本侧复验部分全过，材料齐（四图+json+本报告）；8090 桌面档+刷怪知情面走查归 sm 转 PO。

## 守门复跑（抽样）

- light-core.test.js **17/17**（含真表集成面：opaque(80/81/82)=false+「全表恰此三 id」直证——
  新断言真的在测新语义，抽验非空转）；
- campfire-bench-c6.test.js **5/5**；texture-atlas.test.js **54/54**（R-7 新增夹具注记后仍全绿）。

## 附：走查中新暴露的既有边界（不阻塞 R-7，登记候选）

**门额牌贴柱缝黑面**：r7-gate.png 目验发现门洞左缘纯黑竖面；gate-diag.js 诊断探针定位
（tc13r-review/gate-diag.json + gatediag-*.png）——低光顶点簇 x=71/71.15 恰=牌板厚度区间，
**黑面=门额牌自身东西主面**：pushGateSign 取「面朝向邻格」（T4 裁定，防自身格全黑），
但牌两面紧贴 opaque 木柱格→邻格恒 0→主面黑；南薄边采样 z 向空气 sky15 亮橙（与图吻合）。

定性：**T4 语义残余边界，非 R-7 引入、非回归**（H2 前后该面都黑；此前无门额牌近景走查图，
本次首次被看见）。修复窗口已被 H2 打开：牌格透光 sky=14 后，「取自身格」从当年 T4 的
全黑病根变为可行（=0.933 亮）；修法≈一行采样改动+texture-atlas T4 断言翻新。

处置建议：**登记候选，立否+优先级归 PO**（同粒子收敛挂单模式）——触发场景窄
（牌两面贴柱的窄门洞；宽门洞/独立牌不触发），门洞顶角暗面观感自然度由 PO 实机定。

## 证据文件（.scratch/campfire/tc13r-review/ 本轮新增）

- gate-diag.js / gate-diag.json / gatediag-gateWide.png / gatediag-gateClose.png —— 黑面定位诊断
- r7-recheck-report.md —— 本报告
