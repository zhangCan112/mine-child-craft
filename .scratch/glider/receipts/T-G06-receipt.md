# T-G06 收尾 · 施工回执（tdd 主人: 红方）

> 票面: docs/glider-tickets.md「T-G06 收尾：GLOSSARY + 全量回归 + 手玩验收报告」节
> （要求 1–4 + 验收标准逐条）
> 权威: docs/glider-spec.md §1/§3/§6/§7 · docs/design/glider-ui-spec.md **v1.2**
> （2026-11-16——票面「四组 20 条」系 v1.1 口径，v1.2 现行四组 23 条，报告头部已登记对照）
> worktree: C:\Users\user\.local\share\opencode\worktree\1631a8\glider（分支 glider，
> 开工基线 HEAD=6d54554；GP05 并行补测 `b3ad749` 落库后终门）
> 状态: **完工待派令方裁定（门禁全绿）**

## 1. 测试面（票面预期「测试面极薄」的落法）

GLOSSARY 计数测试（test/conventions.test.js:267「GLOSSARY 词条一览 declared 计数=
实际, 一览与正文词条双向对齐」）先读现行断言形状再动——结论：**断言为自验证式**
（declared 计数=实际条目数 + 一览↔正文双向对齐，无硬编码总数），**测试零改动**；
「同步」落在 GLOSSARY.md 本体：正文词条 + 一览行 declared 计数 45→47 同步，测试自动
验平（手数漂移即红）。定向验证：`node --test --test-name-pattern "GLOSSARY"
test/conventions.test.js` → 1 pass / 0 fail。

## 2. GLOSSARY 词条落盘（要求 1）——spec §6 八概念逐条对照

| spec §6 概念 | 归并落点 | 关键内容（定义+模块落点+接口名） |
|---|---|---|
| 滑翔翼 | 「滑翔翼」词条（游戏模式区） | 专属装备道具；id=槽键=存档第五键同名 `glider`；EQUIP_SLOTS 尾部追加互不排斥（ADR 0013）；无消耗（wornWear glider 豁免，ADR 0012）；配方金锭×4+线×2+皮革×2 工作台级（引「合成核心」词条）；三件接线 ITEMS/ITEM_HINTS/ITEM_PIX；翼观感 mob-look/player.js wingL/wingR——「翼只在滑翔时可见」（v1.2 拍板） |
| 滑翔状态 | 「滑翔状态」词条（游戏模式区） | 物理唯一权威 voxel.js physics 滑翔分支；进入=装备+离地>2+未闩锁规则一元；行为=缓降/转向/动作暂停；退出四触发；信号源三件 avatar.js `setWings('hidden'\|'spread')`/`forceWingsHidden()`+金描边+wing_open/close；模式层消费缝 setGliderEquipped/isGliding 镜像差分/land 结算/FOV；参数 config.js GLIDE 块七键 |
| 展翼 | 归并进「滑翔状态」词条 | 自动=离地>2 格/主动=闩锁态空中再点跳跃；翼 spread+wing_open |
| 收翼 | 归并进「滑翔状态」词条 | 落地/入水/主动取消/卸翼四触发同点；翼 hidden+wing_close |
| 取消闩锁 | 归并进「滑翔状态」词条 | 暂停至落地/入水；空中再点=解除+再展；voxel.js 绑定 glideLatch |
| 软着陆 | 归并进「滑翔状态」词条 | 滑翔触水面收翼入水转游泳；无翼落水同样零伤（落差清零） |
| 无翼高坠 | 归并进「滑翔状态」词条 | 落差 ≤3 无伤、4 格起每格 1 血 `max(0, floor(落差)−3)` 经 advEnvHurt 原值直扣；零 TTS；ADR 0014 唯一显式例外 |
| 落差 | 归并进「滑翔状态」词条 | 连续无翼下落段峰值−落地点；voxel.js fallPeakY：展翼重置/贴地滑翔流体锚定/入水清零 |

- 词条命名与分区：两词条落「游戏模式」区末尾（同类先例：「下界传送门」「大宝箱」
  ——玩法道具/子系统词条家）；一览行 declared 45→47。
- 交叉引用增补：「体素模型」词条 +1 句滑翔分支指向（物理段含滑翔分支+意图入口+
  spec 红线 1 指回）；「装备核心」词条核查——T-G01 已写齐五槽/wornWear glider 豁免/
  wornNormalize 五键，与现状一致，**零改动**（票面验收标准「表述与五槽现状一致」已满足）。
- 登记项 2（「合成核心」配方句）：词条配方清单补「滑翔翼 1 条=金锭×4+线×2+皮革×2
  工作台级 3×3 镜像图案（翼尖骨/中脊鞍/侧膜绳，glider-spec §3.2/ADR 0015，
  craft-core.js RECIPES 头注释同记——全表 77 条）」（craft-core.js:42 头注释已在，
  词条此前未记——已补平）。

## 3. spec 收口核查（要求 2，核查非代填）

- §7 U-01 回填核查：`git show 4a00290 -- docs/glider-spec.md` 实证 **diff 仅 §7
  一行**（U-01 行）；结论「路径 B 第一人称退化」与 §3.6 路径 B 自洽（FOV +6°~8°/
  0.3s+准星常显+金描边，与 GLIDE.fovKick/fovTime 与 T-G04 FOV 测试同源）。
- 状态表核查：§7 处置表全部行已终态（U-01 已回填/U-02·U-03·U-05 已收口/U-04 归
  调参/移交 A·B 已收口）——**无待更新状态列，spec 零改动**。spec 头部生命周期括注
  「U-01 由实现票评估后回填」为历史描述文字非状态列，不在所有权内未动（票外发现 2）。
- docs/glider-tickets.md 状态列归经理：零接触（工作区现存 M 系经理登记 ◐ 所致）。

## 4. 手玩验收报告（要求 4）：docs/glider-acceptance-report.md（新建）

结构八节：§0 v1.1→v1.2 作废/改写对照登记（§4.2 纸娃娃无翼/§4.3 相机作废/§6.2 预角
撤销/§6.4 四态机/§6.7 双门改写——规格驱动差异非漏做）→ §1 验收画面锚+九项手玩重点
映射表 → §2 走查清单 23 条按 v1.2 现行四组（§6.7 双门 4+6 吸收 T-G03-walkthrough
标注 / §3.5 五条 / §4.5 四条 / §5.4 四条，每项两栏=自动已覆盖（票据+单测名）+
必须真机）→ §3 双场景要求 → §4 PO hands-on 证据 → §5 spec 收口核查结论 →
§6 已知局限/工程债五项 → §7 门禁数字 → §8 结论记录区（**待 PO，本票不填结论**）。

## 5. 经理随令登记项 1–6 落点

| # | 登记项 | 落点 |
|---|---|---|
| 1① | T-G04 评审顺延手玩项（§6.7 五要素：双翼对称/不裁尖/0.25s 平滑/三背景可辨/6 岁审美） | 报告 §2.2 第 10 条「必须真机」内显式列五要素+标注「T-G04 评审顺延显式入清单」 |
| 1② | 同一手玩清单双场景过（探险+体验馆 ?dev=1） | 报告 §3 专节+§8 结论记录区全 33 行双列勾选（探险：　体验馆：）+自动面同口径证据（T-G04 体验馆同口径测试） |
| 2 | 「合成核心」配方句 | 本回执 §2 末条=GLOSSARY.md 合成核心词条已补（craft-core.js:42 同记） |
| 3 | armor-overlay.js :27/:215「四槽」注释 | 已改「五槽 id 集」(:27)、「五槽 id 签名」(:215)——与 :35 五槽序同性质，仅注释零行为（apply 签名实为 EQUIP_SLOTS.map 全槽，:264 实证） |
| 4 | 存量空转事实登记（mob-look.test.js:371-377 Group 骨静默跳过） | 报告 §6 工程债 #1（翼骨 Group 形态不入逐顶点采样、翼贴图专项断言兜底、不修票外） |
| 5 | PO hands-on 证据（2026-11-15 深夜 8081 合成成功） | 报告 §4（capture-guide.md §② 「已实核」注记转登） |
| 6 | capture-guide.md 已在库（v1.2 双门口径） | 报告头注「PO 实屏指南」引用+§2 清单判据与其 §④ 十条一致（双门 4+6 同构） |

## 6. 门禁数字（终门，GP05 b3ad749 落库后）

- 定向：GLOSSARY 计数测试 1 pass / 0 fail（开工即验，§1）。
- 全量 `npm test`：**tests 2196 / pass 2195 / fail 0 / skipped 1**（exit 0，
  duration≈168s）——与经理确认基线 2196/2195/0/1 严丝合缝（GLOSSARY 自验证式测试
  随词条同步，零新增测试数）。
- `npm run lint`：**exit 0 零错误**（eslint . → stylelint css/** → htmlhint
  index.html 三件全过）。
- 提交哈希: 即本提交自身（自引——amend 回填会自噬哈希; 以 git log/完工回报为准）。

## 7. 文件清单（提交面=所有权清单，逐一对账）

| 文件 | 改动 | 所有权对账 |
|---|---|---|
| GLOSSARY.md | 两词条+一览 45→47+体素模型指向句+合成核心配方句 | ✓ 所有权内 |
| js/armor-overlay.js | :27/:215 注释 四槽→五槽（仅注释零行为） | ✓ 所有权内（仅 :27/:215） |
| docs/glider-acceptance-report.md | 新建（手玩验收报告） | ✓ 所有权内 |
| .scratch/glider/receipts/T-G06-receipt.md | 本回执 | ✓ 所有权内 |
| test/conventions.test.js | **零改动**（自验证式断言，§1） | 所有权内未动 |
| docs/glider-spec.md | **零改动**（§7 全终态无状态列可更，核查写入报告 §5） | 所有权内未动 |
| 禁触面 | js/modes/adventure.js、test/adventure-mode.test.js（GP05 b3ad749 后未触）、docs/glider-tickets.md、docs/design/glider-ui-spec.md、其他 js/css | 零接触 ✓ |

## 8. 票外发现（交派令方裁，未擅动）

1. **armor-overlay.js:263 尚存一处同性质「四槽 id 签名」注释**（`/* 四槽 id 签名:
   槽形…*/`，紧邻 :264 EQUIP_SLOTS.map 全槽签名行）——与 :27/:215 同失真性质，
   但经理路由清单仅列 :27/:215，所有权「仅 :27/:215 注释」，**未动**，建议随下次
   触点顺手补平。
2. **glider-spec.md 头部生命周期括注**（「U-01 相机形态由实现票评估后回填 §7」）
   已成历史描述（U-01 已回填）——非状态列、非所有权清单授权面，未动。
3. 报告 §6 工程债五项（登记项 4+T-G05 票外两项+空中续档漏伤一格+节流窗正面登记）
   均按随令路由收录，未扩未删。

## 9. 微补丁登记（GP06 微补丁令，票外发现 1 裁准落地）

- js/armor-overlay.js:263「四槽 id 签名」注释已补平为「五槽 id 签名」（同 :27/:215
  族第三处，与 :264 EQUIP_SLOTS.map 全槽签名行实证对齐，仅注释零行为）；
  `npx eslint js/armor-overlay.js` exit 0 零错误；纯注释件不另跑全量——终门数字
  以 307fd20 为准。微补丁提交按令只 add js/armor-overlay.js，本登记行留工作区
  归工程线簿记（哈希以完工返回/git log 为准）。
