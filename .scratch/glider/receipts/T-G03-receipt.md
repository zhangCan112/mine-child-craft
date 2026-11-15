# T-G03 形象层 · 施工回执（tdd 主人: 红方）

> 票面: docs/glider-tickets.md「T-G03 形象层」节 · UI 视觉权威: docs/design/glider-ui-spec.md
> worktree: C:\Users\user\.local\share\opencode\worktree\1631a8\glider（分支 glider, 起点 HEAD=2bce529）
> 状态: **绿已验收——14 红全绿 · 测试零篡改 · 零 commit（2026-11-15 红方复核, §7）**

## 1. 测试缝（先于写红确认）

| 缝 | 测试面 | 抓什么 / 漏什么 |
|---|---|---|
| MobLook 档案（rig/regions/textureBuffer 公开出口） | test/mob-look.test.js 追加 | 翼骨几何规格/贴图色族/档位/共区；运行时姿态漏（归 Avatar 缝） |
| Avatar 接口（vm 装载 avatar.js + spy puppet） | test/avatar.test.js 新建 | 显隐状态机三态/动效时序/未装备红线；真实渲染观感漏（走查兜底） |
| PaperDoll 接口（宿主 global 桩 + 构造登记观测） | test/paper-doll.test.js 新建 | paint 期翼静帧/相机 z 往返；真构图观感漏 |
| mkCraftPanel equip 缝 + css 文本 | test/mode-kit.test.js 追加 | 第五槽数据边界/布局与 HUD 样式照稿 |
| SFX_KINDS 数据表 | test/audio-registry.test.js 追加 | 两键合成口径 |

桩纪律: conventions §7.1（THREE/document 桩挂宿主 global 共享实例, mob-look.test:331 先例）+ §7.2（假 DOM 走 test/helpers/fake-dom.js 的 mkEl）。paper-doll 相机/渲染器经桩侧构造登记观测（armor-overlay.test texLog 同款手法——mkPaperDoll 不吐相机, 不污染生产接口）。

## 2. 红测试清单（验收块 ↔ 测试 ↔ 红因）

定向命令: `node --test test/mob-look.test.js test/avatar.test.js test/paper-doll.test.js test/mode-kit.test.js test/audio-registry.test.js`
红基线输出: `.scratch/glider/receipts/T-G03-red.log`（110 tests: 96 pass / 14 fail; **红因分类: AssertionError×14, 零装具炸**）

| # | 测试 | 票面验收块 | 红因（AssertionError 摘要） |
|---|---|---|---|
| R1 | mob-look「玩家翼骨甲案—wingL/wingR 语义翼槽·官方 pivot·三盒规格·双翼共区」 | 要求1（§6.1 甲案/§6.2 几何表） | 玩家档无 wingL/wingR 骨 |
| R2 | mob-look「玩家翼贴图—五色同源色族·金辐条/膜主/暗折线俱现·翼尖金粒·方形 64/128 档」 | 要求1（§6.3+§5.1 色板同源防漂移） | regions 无 wing* 区/档位断言 |
| R3 | avatar「缺省 hidden—未装备翼骨恒不可见」 | 验收2 前半（§6.4 红线） | 傀儡无翼骨 |
| R4 | avatar「setArmor 装备对账—worn 有 glider → folded 收拢翼鞘(静态无微动)」 | 要求2（§6.4 hidden↔folded 对账） | 无翼骨 |
| R5 | avatar「setWings(spread)—0.25s 线性匀速展开·端点水平带·双翼反号」 | 要求3（§6.5 展开动效） | setWings 接口不存在 |
| R6 | avatar「setWings(folded)—反向同参数 0.25s 收回·端点即停」 | 要求3（§6.5 收起动效） | 同上 |
| R7 | avatar「spread 滑翔微动—±2.5~3° 正弦·双翼反相·主周期≈1.4s」 | 要求3（§6.5 微动） | 同上 |
| R8 | avatar「未装备红线—意图不越权·卸翼即隐·重穿对账复位 folded」 | 验收2 后半（任意读档顺序红线） | 同上 |
| R9 | paper-doll「paint 未装备—翼 hidden 无残影·相机原构图 z=3.55」 | 要求4 前半（§4.2 未装备逐像素一致） | 傀儡无翼骨 |
| R10 | paper-doll「paint 装备—展平静帧(不经意图接口)·相机后移 z≈4.3·lookAt 不动」 | 要求4（§4.2 展平静帧+§4.3 相机） | 同上/相机不随装备变化 |
| R11 | paper-doll「卸下构图复原 + 同 worn 幂等不重画」 | 要求4（§4.3 构图复原） | 同上 |
| R12 | mode-kit「装备页第五槽数据边界—有件显图标但永不渲染耐久条·四甲不误伤·点槽报 onSlot」 | 要求5（§4.4 第五槽永不渲染耐久条） | 第五槽 innerHTML 含 class="dur"（glider dur=1 画满条陷阱） |
| R13 | mode-kit「HUD 装备条与装备页第五槽样式照稿—css/style.css」 | 要求6（§3.4 HUD 条样式补齐+§4.1 第三行居中） | .armorbar 零 CSS/无 span 2 规则 |
| R14 | audio-registry「滑翔翼双音效—wing_open 上滑/wing_close 下滑更轻, prio 2/coolMs 300, 纯合成可回退」 | 要求7（§7.1 音效登记两行） | SFX_KINDS.wing_open 未登记 |

既有 96 绿零误伤（含 mob-look 布局合法/全覆盖/几何 UV 落点——新翼骨将被这些现成守门自动罩住; armor-overlay.test 的翼零参与锚不受影响）。

## 3. 裁决记录（红方预登记, 绿方照此施工; 争议报回本岗）

1. **UV 档位**: 64/128 均合法（测试断言方形 ∈{64,128}, UI spec「放不下升 128 档, 设计验收不绑档位」）; 双翼共区（wingR 复用 wingL UV 区, dragon 先例）。
2. **setWings 命名**: 照 UI spec 建议形 `Avatar.setWings('folded'|'spread')`（票面「命名归实现线」, 无强理由不改名; 语义锁死 §6.4——滑翔态切换由模式层调用, 形象层零玩法知识, 不读引擎滑翔态）。
3. **纸娃娃相机 z**: 4.3 为【实现自由度】起点, 测试容差带 [4.2,4.4]; 验收双翼尖完整+人物占画布高 ≥60% 走真机走查。
4. **spread 端点带 [60°,120°]**: UI spec 钉「收拢→水平展平」（≈90°）, 带宽容忍实现微调（翱翔上扬）。
5. **三盒尺寸按排序三元组比**: [1,1,12]骨杆 / [1,10,12]膜 / [1,1,1]翼尖——尺寸照 §6.2 钉, 轴向排布与收拢摆位归实现; 「烘焙=收拢」红线=Avatar folded 态骨旋转 0 基准（忘摆姿失败模式是「小翼鞘」而非「满屏大翼」）。
6. **色板距离阈值 32**: 噪底 0.04~0.05 + 同色相明暗派生容差; 测试持 UI spec §5.1+§6.3 六 hex 独立真值（防与 icons.js 漂移的两处钉）。
7. **微动幅度带 [2°,3.55°] / 周期带 1.17~1.75s**: ±2.5~3° 正弦、≈1.4s 的容差表达; 双翼反相全相位成立。
8. **匀速断言容差 ±7%**: 0.25s 线性匀速, 四点采样比例带。
9. **HUD 样式**: 类名复用既有 .armorbar/.armorbar-slot（DOM 零改, 纯 CSS 补齐）; CSS 数值照 §3.4 逐项。
10. **第五槽耐久条豁免**: 验收=第五槽永不渲染 .dur + 四甲照旧; 手法（槽名特判/单件豁免表）归实现线。

### 经理前置裁定两件（随票执行, 无测试面——注释/词条级零行为变化, 回执登记）
- (a) js/armor-overlay.js:35 头注释「EQUIP_SLOTS(四槽序)」→ 五槽表述（**仅 :35 行**, 该文件其余注释非授权面不动）。
- (b) GLOSSARY.md「模式面板 kit」词条（:108 区）两处「四槽」（HUD 常驻四槽穿戴条 / update 四槽 id 签名节流）→ 五槽表述（仅词条正文, 不加词条——GLOSSARY 计数守门不破）。

### 红方顺带裁决（本票所有权文件内「四槽」过期注释同步, 与经理裁定两件同性质）
js/mode-kit.js（:43 头注释 mkArmorBar 描述 / :762 renderEquip 槽序注释 / :1493-1527 mkArmorBar 段注释）、js/avatar.js（:24）、js/paper-doll.js（:16/:60）——本票必改文件内的「四槽」字样随实现同步五槽化（注释级, 零行为变化）。

## 4. 票外发现（不扩票, 报经理）

1. **js/armor-overlay.js :27/:215 注释「四槽 id 集/id 签名」同为五槽化失真**——非本票授权面（仅 :35 授权）, 未动; 建议随 T-G04 或工程簿记顺带。
2. **index.html 装载序**: icons.js(:381) 晚于 avatar.js(:326)/player.js(:244)——player paint 期引用 icons.js 侧常量（PIX_TIER）会 ReferenceError（boot 炸）; 翼色板实现须在 player.js 自持常量或字面 hex（已写入派令约束, 测试以独立真值钉两处同源）。
3. docs/glider-tickets.md 当前已是 modified 状态（并行线/经理簿记, 非本岗改动, 未触碰）。
4. **「几何 UV 落点」测试玩家分支存量空转**（评审追令 A3 补登）——mob-look.test.js:371-377 遍历 puppet('player') 骨, `if (g.geometry)` 对 Group 包装骨静默跳过（玩家全骨皆 Group 包装）, 该分支 check 实际不执行; 存量行为, 非本票引入（本票 R1/R2 翼守护不经此路径, 见 §7.3 勘误注记）。**经理已路由 T-G06 处理。**

## 5. 转绿轨迹

最小实现逐切片转绿（每步定向验证; 实现要点与裁决对齐）:

| 切片 | 实现 | 红转绿 | 中间验证 |
|---|---|---|---|
| ① 翼骨+贴图 | player.js: wingL/wingR 语义翼槽三盒骨（骨杆[1,1,12]/膜[1,10,12]/翼尖[1,1,1], 收拢翼鞘=折叠 0 基准摆位烘焙, 裁决5）; 贴图升 128 档三区（骨杆[68,68]/膜[76,68]/翼尖[68,86], 互不重叠且不挤既有 ≤64 身份件区）; WG_* 五色画笔自持（与 icons.js ITEM_PIX.glider.map 同值——icons.js 载入晚于 player.js, 引用侧常量必 boot 炸, §4.2 预判兑现） | R1 R2 | mob-look 15/15 |
| ② Avatar 状态机 | avatar.js: 载入期引翼骨+缺省 hidden; syncWings 仅装备态边界变化时复位 folded/角度归零（单一入口: 意图不越权·卸翼即隐·重穿复位）; setWings 意图接口; updWings（0.25s 线性展开/收回 + spread 微动 ±0.05rad 正弦 1.4s 双翼反号, 裁决7/8 带内）; setArmor 扩展对账; update() 内 root.visible 判定前挂 updWings（隐藏期间动画走完, swing 同惯例） | R3~R8 | avatar 6/6 |
| ③ 纸娃娃静帧 | paper-doll.js: paint 直写翼骨展平静帧（不经意图接口, R10 口径）; 相机 z 未装备 3.55/装备 4.3 往返, lookAt(0,0.9,0) 恒定（裁决3 带内） | R9~R11 | paper-doll 3/3 |
| ④ 装备页+HUD CSS | mode-kit.js renderEquip 第五槽耐久条豁免（slot!=='glider' 特判, 裁决10）; css/style.css 补 .armorbar 族四规则（§3.4 数值）+ .mkp-eslot:last-child 跨列居中（§4.1; 描述性注释全在规则块内——选择器前置注释会被 ruleOf 粘连进选择器段而炸） | R12 R13 | mode-kit 74/74 |
| ⑤ 双音效 | audio-registry.js: wing_open 上滑/wing_close 下滑更轻纯合成条目（prio 2/coolMs 300, 无 sfx 调用字面量） | R14 | audio-registry 12/12 |
| ⑥ 注释五槽化 | mode-kit :43/:762/:1509、avatar :24、paper-doll :16/:60（红方顺带裁决）+ armor-overlay :35、GLOSSARY「模式面板 kit」词条两处（经理前置裁定 a/b）——注释级零行为变化 | — | 各文件测试复跑仍绿 |

### 末次验证（2026-11-15, worktree glider）

- §2 原定向命令（五文件）: **110 tests: 110 pass / 0 fail**——基线 96 绿全保 + 14 红全转绿, 编号对应 #6→ok6 · #13-18→ok13-18 · #32/33→ok40/41 · #106→ok114 · #107→ok115 · #108-110→ok116-118（红日志 T-G03-red.log）
- 追加 boot 冒烟（六文件合跑）: **118 tests: 118 pass / 0 fail**——boot.test.js 八条零回归（引导链/MODES 影子/装备 T4/开战部署等, boot 整体跑为本次首入）
- `npx stylelint css/style.css`: **零错误**
- 零 commit（票面禁提交, 门禁归经理）

## 6. 文件清单

| 文件 | 改动 |
|---|---|
| js/mob-look/player.js | 翼骨甲案（wingL/wingR 三盒/官方 pivot/UV 三区共区）+ 贴图 128 档 + WG_* 色板自持 |
| js/avatar.js | 翼显隐状态机（syncWings/setWings/updWings）+ setArmor 扩展 + update 挂点 + return 增 setWings + :24 注释五槽化 |
| js/paper-doll.js | paint 翼静帧 + 相机构图往返 + :16/:60 注释五槽化 |
| js/mode-kit.js | renderEquip 第五槽耐久条豁免 + :43/:762/:1509 注释五槽化 |
| css/style.css | .armorbar/.armorbar-slot/.armorbar-slot.off/.armorbar-slot img（§3.4）+ .mkp-eslot:last-child 跨列居中（§4.1） |
| js/audio-registry.js | wing_open/wing_close 纯合成条目 |
| js/armor-overlay.js | 仅 :35 注释五槽化（裁定 a, 单行） |
| GLOSSARY.md | 「模式面板 kit」词条两处五槽化（裁定 b, 不加词条——计数守门不破） |

测试六文件零改动（只读合同）; docs/glider-tickets.md 并行线改动未触碰; 未提交任何 commit。

## 7. 红方验收（2026-11-15, 绿方完工回执后的亲自复核）

### 7.1 复核证据（红方本机重跑, 非转抄绿方）

| 验证 | 命令 | 结果 | 日志 |
|---|---|---|---|
| 定向五文件（§2 同口径） | `node --test test/mob-look.test.js test/avatar.test.js test/paper-doll.test.js test/mode-kit.test.js test/audio-registry.test.js` | **110/110 pass, 0 fail, not ok 空** | T-G03-green-verify.log |
| 追加 boot 冒烟（六文件合跑） | 上命令 + `test/boot.test.js` | **118/118 pass, 0 fail** | T-G03-green-boot.log |
| CSS lint | `npx stylelint css/style.css` | **exit 0 零错误** | — |
| 工作区 | `git status` / `git log` | HEAD=2bce529 未移, 零 commit, 改动文件与 §6 一一对应 | — |

### 7.2 测试零篡改核验

- `git diff -- test/`: 3 个既有测试文件**零删除行**, 165 行纯追加（24+75+66, 与红方落盘一致）; 新建 test/avatar.test.js / test/paper-doll.test.js 原文在盘。
- 关键断言锚点抽查全在: A1「玩家翼骨甲案」测试+wingL/wingR 官方 pivot 断言（mob-look :385-407）; A2 五色板 `[0xe9,0xb1,0x15]…[0x8a,0x40,0x28]`+邻域 ≤32+排序三元组 `'1,10,12'` 膜盒+翼尖粒 `#fdff76`; D1/D2 `dur`/`glider`/`armorbar-slot`; E1 `220`/`520`/`wing_close`。
- 实现侧关键约束兑现抽查: **player.js 零 PIX_TIER 引用**（票外发现 2/装载序红线, WG_* 色板自持）; mode-kit.js:770 `slot !== 'glider'` 耐久条豁免（注释引 §4.4/ADR 0012, 裁决 10）。

### 7.3 绿方测试疑义裁决（绿方报: 「几何 UV 落点」傀儡路径对 Group 骨静默跳过, 翼若做成 Group 会漏检其顶点 UV）

**裁决: 不补 Group 遍历, 测试不改。** 理由:
1. ~~本实现翼为档案 cubes 盒骨直挂（非 Group 装配）, 傀儡路径无实际缺口~~
   **【勘误 2026-11-15, 评审追令 A3: 前提失真——玩家傀儡路径 puppet('player') 所有骨皆 Group 包装, 「几何 UV 落点」玩家分支（mob-look.test.js:371-377）对 Group 骨静默跳过, 该分支存量空转, 并无「直挂所以无缺口」可言。本条理由作废; 绿方与红方复核通过系由 R1/R2 断言成立, 与傀儡路径无关。】**
2. 翼 UV 的守护断言是 R1（rig 档案结构: cubes 三盒/双翼共区）+ R2（regions 六面区逐像素五色）, **均不经傀儡装配路径**——未来若实现改走 Group 装配且与档案脱钩, R1 的档案结构断言先红, 不会静默漏检。
3. 给既有「几何 UV 落点」装具补 Group 遍历属票外观测面增强——登记不扩票, 留待后续票（如真机走查票）按需处理。

> 勘误注记（评审追令 A3）: 裁决结论不变, 由理由 2/3 单独支撑。存量空转事实已补登票外发现 §4-4, 经理已路由 T-G06。

### 7.4 验收结论

14 红全绿 + 既有 96 绿（+boot 8 条）零回归 + stylelint 零错误 + 测试零篡改——**验收通过, 请派令方（经理）裁定收工**; 门禁窗口（全量 npm test/lint、commit、合入集成分支）归经理。

## 8. 合入窗口记录（2026-11-15, 经理窗口令执行）

### 8.1 lint 复核点（首轮 7 错 → 自修复 → 整树零错误）

- 首轮 `npm run lint` exit 1, **7 错全部在所有权文件**（T-G03-full-lint.log 清单）:
  - js/mob-look/player.js :117/:118/:119/:125 `new-cap` ×4 — 绿方实现局部镜像折算函数命名 `X`（大写开头作普通调用）;
  - test/avatar.test.js:244 / test/mode-kit.test.js:1744 / test/paper-doll.test.js:244 `indent` ×3 — 红方断言消息行缩进笔误（8/6/8 → 4/2/4）。
- 自修复（零语义变化, 不属「改测试迁就实现」）: `X` 重命名 `xAt`（定义+4 调用+:113 注释同步）; 三处缩进归位。
- 复跑 `npm run lint` exit 0 **整树零错误**（ESLint(google) + Stylelint + htmlhint, T-G03-full-lint2.log）; 修复后定向六文件复跑 118/118（T-G03-postfix.log）。

### 8.2 门禁数字（修复后终态口径）

- `npm test`: **tests 2169 / pass 2168 / fail 0 / skipped 1**（exit 0, duration ≈153s, T-G03-full-test2.log）——基线 2154 + 本票 14 红转绿 + T-G01 修复窗 1 守门 = 2169, skipped 1 为基线固有, 与窗口令预期逐项一致。
- `npm run lint`: **整树零错误**（8.1）。

### 8.3 提交

- add 范围: 8 实现/文档所有权文件 + 5 测试文件（新建 2 / 扩展 3）+ 本回执 + 证据 log 8 份（T-G03-red / T-G03-green-verify / T-G03-green-boot / verify-test-diff / T-G03-full-lint / T-G03-full-lint2 / T-G03-full-test2 / T-G03-postfix, 均本票产物）。
- **不 add**: docs/glider-tickets.md（并行线/经理簿记）及任何他人文件; 写红期中间日志（t-*.log 等）留工作区不入库。
- 提交信息（一行中文, 无 `~`/`#`/em-dash, conventions §7.3）:
  `T-G03 形象层合入: 翼骨/显隐状态机/纸娃娃/第五槽布局/HUD 装备条样式/双音效登记（14红转绿+stylelint绿+裁定a/b顺带）`
- 提交哈希: 即本提交自身（自引; 哈希以 git log/完工回报为准）。

## 9. 有界返工记录（2026-11-15, A1 需求线裁决落地——scr 回流追令）

### 9.1 裁决要点（.scratch/glider/ui-design/notes.md §5）

- **(a) 文字修订+收拢外张预角增补**（吸收 (c) 作过线门）：v1.1 §6.2 承认
  收拢态=弦向竖板凸出 ≈12px（绕 z 单轴+弦向 10px 刚体膜+展开水平膜面
  约束组下 z 分量守恒，凸出 ≈弦深物理必然；原「≤2.5px」是定稿内部矛盾）；
  预角=每侧翼绕 y 静态基偏 ≈±18°（MC idle 鞘翅 yRot 同款），「两块平行
  竖板」→「两片斜靠背角的收拢翼」。
- **(b) 几何回炉否决**：三条压凸出路（膜分段折收/ry 45° 预旋/缩弦 10→6px）
  全不划算且仍不达标；MC 正典收拢翼有可观厚度是品类正典观感——
  **错在定稿不在实现，实现无责不回炉**。
- 顺序=修订定稿→补预角常量→走查（过线门四判据+四截图待 PO 异步判，
  见 T-G03-walkthrough.md 第 2 条）。

### 9.2 v1.1 修订点 → 落地

| v1.1 修订处 | 落地 |
|---|---|
| §6.2 收拢态烘焙行（凸出 ≈12px+外张预角 ±18°+红线保留） | player.js wingL/wingR 三盒各 `ry: ±Math.PI/10` 烘焙——kit 现成 ry 通道（盒中心绕枢轴 y 转+自转同参=刚体旋转, 蜘蛛腿同款）, 纯档案数据零代码、不触 §6.5 单轴动画契约; 头/骨注释同步 v1.1 口径 |
| §6.4 folded 行（收拢竖板翼+外张预角） | 数据烘焙即双端（Avatar/纸娃娃）生效, avatar/paper-doll 文件零改动 |
| §6.5 注记（预角=静态基姿态非动画轴） | ry 落 cubes 声明（数据）, 非动效路径; avatar.test 17 条零改动零误伤（17/17 复跑） |
| §6.7 走查项（收拢态三口径+过线标准） | T-G03-walkthrough.md §6.7 引用一律改 v1.1, 第 2 条记录区续写过线门+四截图 |

### 9.3 断言重钉说明（spec 驱动的期望修订, 非断言弱化）

- mob-look.test.js「翼骨甲案」**追加** v1.1 断言：三盒同 ry=±18°（±3° 带,
  刚体同角）·盒自转 ry 透传（rig +Z 镜像系取负）·膜板外偏 |x|∈[1.5,2.5]px
  （外张）·中心 |z|∈[4.5,6.5]px（斜靠背）·侧面凸出 ∈[10,13]px（v1.1
  鞘翅家族量级, 独立真值显式算弦向+厚 z 投影）·翼尖粒缀枢轴（|x|,|z|<1.5px
  不外甩）。
- 既有断言（pivot/axis/三盒排序尺寸/共区/贴图五色）与 v1.1 零冲突, 全部
  保留原值——本次纯新增断言面, 无一处期望弱化。

### 9.4 验证与提交（窗口随令: 全量门禁不跑, T-G05 在飞由经理统排）

- 定向 `node --test test/mob-look.test.js`: **15/15 pass, 0 fail**。
- 追加下游复核 `node --test test/avatar.test.js test/paper-doll.test.js
  test/boot.test.js`: **17/17 pass, 0 fail**（ry 数据烘焙零误伤）。
- `npx eslint js/mob-look/player.js test/mob-look.test.js`: **零错误**。
- 改动面: 仅 js/mob-look/player.js + test/mob-look.test.js + 本回执 +
  T-G03-walkthrough.md; 严禁面（js/modes//config.js/voxel.js/adventure
  两测试/css/audio-registry）零触碰。
- 提交哈希: 即本次返工提交自身（自引; 以 git log 为准）。**待窗**: 全量
  npm test/lint 门禁与集成分支合入由经理在 T-G05 落地后统排。
