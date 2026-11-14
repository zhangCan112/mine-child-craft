# 收口回执：2026-11-14 两份 retro 环境改进落地（env-steward 线）

> 岗位：env-steward · 日期：2026-11-14
> worktree：`C:\Users\user\.local\share\opencode\worktree\1631a8\town-design`（branch town-design，HEAD e47d55a）
> **本线零 commit，全部改动在工作区**——对账归 scrum-master（见 §六）。
> 验收结论：**本线处置面 10 文件隔离全绿（exit 0）+ `npm run lint` 零错（exit 0）**；
> 全量套件现存 1 红属并行视觉翻新线施工中间态（非本线面），证据链见 §五撞线上报。

## 一、逐条落地清单（A3 的「hash 亲核」子项在 §二③ 有显式裁量）

### A 组 · 确定性基建

**A1 假 DOM 契约面单一来源化 〔落地〕**
- 改了什么：新建唯一工厂 `test/helpers/fake-dom.js`（mkEl + liveKids），面清单载头注释：
  className↔classList 同步、属性闭包私有（F1，公开面只走 get/setAttribute）、children 为
  live 只读集合视图（S-1，变更法缺席）、子件增删唯一通道 appendChild/removeChild
  （非子件抛 NotFoundError，换父先摘，innerHTML 赋值摘链清干净）、parentNode+parent 双名
  （parent 是 town-ui 生产 headless 历史名）、_ev 监听记录（last-wins）、__classOps 按调用次
  计数、querySelector 懒缓存同实例、click()/remove()。live 视图对非变更类 Array 读法通用透传
  （every/flatMap/reduce… 免逐个补列），变更法（push/pop/splice/sort…）保持缺席（S-1 防线）。
- 站点收敛（9 站换 require，本地工厂删除）：adventure-mode:19、adventure-nether:16、
  camp-kit:27、focus-paradigms:28、furnace-kit:35、mode-kit:15、tank-mode:11、
  showroom-mode:47、town-ui:57（家族 A 原型标准面款，liveKids/NotFoundError 契约上收进工厂）。
- 探针面清理：`._cls.has(` → `.classList.contains(`（mode-kit 53 处 + tank 12 处 + adventure-mode 2 处）、
  `slot['q_.cnt']`/`['q_.dur i']` → `.querySelector(...)`（mode-kit 3 处）、
  `children.length = 0` 直清 → `while + removeChild`（showroom:400、tank:464、tank:489，生产
  js/town-ui.js clearChildren 同款唯一通道）。
- 登记例外（专用驱动桩非通用工厂，守门断言 ALLOW 表为唯一权威）：math-world / math-paradigms /
  math-track / math-build-world 的 mkFakeEl（惰性确定性桩/id 注册表/canvas 装具）、
  focus-paradigms 的 mkFakeElDrv（定时驱动观察桩）。不在扫描面：vm 笼源码串（town-ui.test.js
  `__el`，标准面同形）、生产 headless（js/town-ui.js mkHeadlessDoc——业务文件与工厂同形，收敛走
  工程线票，见 §七未落项）。
- **装具补真面（翻红不回退的实证）**：furnace-kit.test.js:45 与 tank-mode.test.js:23 的 doc 桩补
  `body: mkEl()`——mode-kit.js:555 挂载守卫契约要求 doc.body，旧桩靠 `undefined !== undefined`
  假比较静默跳挂（装具谎言），工厂标准语义下守卫真实生效即炸出缺面；补面非软化。
- 落点：test/helpers/fake-dom.js（新建，liveKids:26/MUTATORS:40/mkEl:55/换父先摘:109/NotFoundError:118）。
- 验收：test/conventions.test.js:214 单一来源守门（含 ALLOW 例外表 + 扫描非空 ≥4 防静默失效）+
  :238 工厂 smoke（九面抽验）；my-face-check.log 10 文件 exit 0。

**A2 GLOSSARY 确定性检查 〔落地〕**
- 改了什么：守门新增「词条一览 declared 计数=实际 + 一览↔正文词条双向对齐」断言（解析器容忍
  词条头的生命周期退役标注括号，§1.11 内容保真）。
- **首战抓获 9 处漂移并修正**：7 条目（指令模拟器/棋盘世界宿主/怪物巢穴/维度规格/小镇维度/
  副本素材/刷怪核心）索引错挂「大分块」而正文在「游戏模式」——以正文为权威归位，
  游戏模式 38→45、大分块 74→67（GLOSSARY.md:7/:9）；1 条索引名漂移（「城镇地图核心（TownMapCore
  数据件）」→「城镇地图核心（TownMapCore）」，正文头被 town-assembly-core.test.js:349 既有守门
  钉死，GLOSSARY.md:252）；1 个分区头形态不一（玩法时间预算正文列表式 → 标准 `**词条**:` 头，
  GLOSSARY.md:476/:479，内容零改）。
- 连带修：town-assembly-core.test.js:349 定位锚改正文词条头形态
  `'\n**城镇地图核心（TownMapCore）**:'`（A2 对齐后索引行也含同名条目，裸名 indexOf 先命中索引
  行致切片失效）——**精确化锚非放宽断言**，九段/_Avoid_ 断言原样。
- 落点：test/conventions.test.js:263。
- 验收：conventions.test.js 全绿；手数漂移史（69→70→71→74 两度手修）自此程序化验平。

**A3 「约定→可机器判」转化评估 〔落地，三条裁量见 §二〕**
- 红因分类形态已机械半判：.scratch/run-green.js:15 redCauseSummary——捕获到失败输出自动在日志
  尾段追加 `[red-cause]`（:24）断言红（AssertionError）vs 装具炸嫌疑（TypeError 等）分类 +
  失败测试清单；本线四轮全量日志全程实战验证（42 装具炸→逐轮收敛，回执表述全部引用机械段）。
- 落点：.scratch/run-green.js（加法扩展，既有 runner 行为不变）。

**A4 Node 测试 vm 装载规约 〔落地〕**
- 改了什么：conventions.md 新 §7.1（:260）——三条铁律（宿主域摊平门面/跨域断言走桥接查询/
  桩挂宿主 global+共享实例保 instanceof）+ 六处先例指针 file:line（prefab-kit:122、
  town-npc-registry:72、adventure-mode:150、math-levels:1128、tank-mode:41、mob-look:331）；
  新红测立票默认引用本节；AGENTS.md:25 加指引行。

### B 组 · 文档/模板规约

- **B5** 〔落地〕.scratch/town-design/tickets/README.md §6（:93）第一条（:99）：文件域固定问句
  「本票是否有生成器/导出器会再生成既有产物？有则列入文件域」，判例 T-NPC-02。
- **B6** 〔落地〕同 §6 第二条（:103）：文件域含白名单/守门测试改源 → 验收标准自动追加
  「conventions.md/GLOSSARY 对应表述回写」；GLOSSARY 收录判据（≥2 文件引用）并入；词条计数
  勿手数、跑守门断言。**自下批立票生效，波次二 T-NPC-10/11/12 未回改**（派令红线遵守）。
- **B7** 〔落地〕conventions.md §7.3（:291）：提交纪律（拆单条/多个 -m/消息避免 ~ # em-dash）+
  日志落盘一律工具直写禁 `| Out-File` 管道 + 中文核对 grep/read 直读 + 8080 换口条。
- **B8** 〔落地〕conventions.md §7.4（:300）：装具炸 ≠ 断言红，红自证区分表述、以日志实读为准；
  机械面=A3 的 run-green `[red-cause]` 段，回执引用不手写。
- **B9** 〔落地〕conventions.md §7.5（:308）：新 DOM 交互码写前对照 MDN 标准面；「stub 真实化」
  后自问「还有哪个面没核」；T-UI-04 判例在案；生产禁读装具私有小平面（既有源码切片守门执法，
  面扩列随守门走不另立清单——第二份清单必漂移）。

### D 组 · 环境卫生

- **D12** 〔落地〕`.opencode/agents/WPS云盘 - 快捷方式.lnk` 已删；`Get-ChildItem -Filter *.lnk`
  剩 0 校验过（ASCII 通配路径避开 GBK 显示层坑）。

### 规范与索引同步

- docs/conventions.md：§0 速览补「装具与环境」行（:18）；新增 §7 全节（:254）；变更记录
  新条目（:355 起）。AGENTS.md 硬规则补装具工厂强制行 + §7 指针（:24-25）。
- 两份 retro 债行状态回写（不改历史、只标注）：缝线 retro 建议 1-4 标〔已落地〕（:24-27）、
  债 14 标 ✅ 已清理（:46）、警示段后补「转化评估落地」三条裁量（:52）；村民 retro 债 2/3/4/5
  标〔已落地 2026-11-14〕+落点（:18/:25/:32/:39）、债 1 注明归 C 组流程纪律由 scrum-master
  自理、本岗不代落（:16）。

## 二、A3 转化裁量表（判断题→可机器判的边界，如实登记不硬造）

| # | 候选 | 裁量 | 依据 |
|---|---|---|---|
| ① | 红因分类形态 | **半机器判**：run-green.js 自动 `[red-cause]` 分类段 + 回执表述纪律（§7.4） | 分类脚本出、人只引用，表述失真面（T-UI-05 红因 800ms 先例）被机械段压住 |
| ② | 装具面清单 | **已机器化且由 A1 承载**：唯一工厂 + 守门断言即面清单的执法形态，不另立清单脚本 | 第二份清单必漂移；工厂头注释即单一权威 |
| ③ | hash 亲核 | **不可机器判，维持约定登记**（随 §7.3 邻域回执纪律执行） | 回执是散文体，正则 hash 校验器会造虚假信心——不硬造防线 |

落字位置：缝线 retro :52。③ 即派令点名的「hash 亲核子项」显式落点。

## 三、验收证据链（红→绿全程，日志均在盘）

| 轮次 | 日志 | exit | 红因分类（run-green 机械段） | 说明 |
|---|---|---|---|---|
| 基线 | .scratch/baseline-before-env-steward.log | 0 | — | 动工前全量绿 |
| 收敛后首轮 | .scratch/full-test-after-conversion.log | 1 | TypeError ×42（装具炸嫌疑）+ AssertionError ×2 | 旧桩探针/缺 body/锚错位，逐项诊断 |
| 修复一轮 | .scratch/full-test-final.log | 1 | 2 失败：mode-kit:533（断言红）+ tank:328（装具炸） | factory 三处标准语义升级后 adventure T11 同池回落已绿 |
| 修复二轮 | .scratch/full-test-final2.log | 1 | 3 失败全部外部（见 §五） | 我的 mode-kit:533/tank:328 修复生效 |
| 外部三文件复跑 | .scratch/external-three-check.log | 1 | 仅 blocks-fields:91（外部施工中间态） | texture-atlas 与 adventure-mode（含 T11 双子测）已绿 |
| **本线处置面** | **.scratch/my-face-check.log** | **0** | — | **九收敛文件 + conventions + town-assembly 隔离全绿** |
| lint | .scratch/lint-final3.log | 0 | — | eslint + stylelint + htmlhint 零错 |

修复三件套的定性（全部是「测试探针照旧桩形状写、工厂已照真实契约」，不软化工厂）：
- mode-kit.test.js:533 `typeof onclick === 'undefined'` → `!onclick`（真 DOM 未接 handler=null，
  断 falsy 语义不变）；
- tank-mode.test.js:326 flatMap 回调返回 live Proxy（真实 HTMLCollection 本就非数组无 flatMap）→
  `[...children]` 标准迭代面拷实数组（math-levels:1128 同款先例）；
- 前轮的 furnace/tank 补 body、town-assembly 锚精确化见 §一 A1/A2。

## 四、环境陷阱新证（本线实战沉淀，均已吸收进动作）

- grep 默认截断（前 20 条）再坑一轮：mode-kit 55 处 `_cls`/`q_` 探针第一轮清扫漏网直接全量翻红——
  残留清点必须显式高 limit 分模式跑（第二轮 limit 60 全量清点才抓全）。
- live 视图透传的边界：flatMap 只摊平真 Array，Proxy 返回值不摊平——测试侧 `[...]` 解；变更法
  缺席（S-1）经 MUTATORS 集合（fake-dom.js:40）保持，不为省事放行。

## 五、撞线上报（并行视觉翻新线，非本线红，交 scrum-master 会师）

派令称「当前无并行施工线」，验证窗口内实测**视觉翻新线在本 worktree 活跃施工**：

- 证据：git status `M js/config.js` + `M js/texture-atlas.js` + `M test/texture-atlas.test.js`
  ——**均非本线改动**（本线零 js/ 触碰，红线在守）；diff 内容 = `B_PINK_WOOL=78`（js/config.js，
  「城镇重制公共件」town-visual-revamp-spec.md §2 樱花粉羊毛）；未跟踪新文件
  `docs/design/town-visual-revamp-spec.md`。
- 时间线：js 两文件 mtime 23:32:34/45 → 我的 full-test-final2 抓到不一致窗口 3 红
  （texture-atlas PAINTERS 计数 / blocks-fields id 锚 / adventure T11 主题换怪）→
  其 23:32:49 补 texture-atlas.test.js、23:36:28 补 blocks-fields.test.js → 复跑
  texture-atlas 与 adventure-mode 已绿，**blocks-fields:91 现 still 红（expected: 78），
  系其施工中间态，其文件其活，本岗不代修**。
- adventure T11 主题换怪三连跑「红→绿→绿」= 已知 flaky（先例在册
  .scratch/town-seam-change/t11-flaky-check.js + t11-full-run1/2.log），非确定性缺陷，
  建议其线或工程线按既有先例处置。
- 本岗处置：只取证不动手（不动它的 js/ 与业务测试），证据全在 §三日志 + 本节指针。

## 六、对账指针（归 scrum-master）

- 本线零 commit；工作区含本线改动 + C 组流程纪律文件（.scratch/handoffs/
  2026-11-14-retro-process-discipline-scrum-master.md，未 commit 未动）+ 波次一 retro 等未跟踪
  工件——原样保留，会师时统一对账归档。
- 红线遵守声明：未动 js/ 业务文件与 index.html；未拆既有防线（装配守门/源码切片守门/装具面
  契约/run-green.js 全部保持，run-green 只做加法扩展）；B5/B6 未回改旧票。
- 图谱：本会话入口已 full_rebuild（e47d55a，255 文件/6690 节点）；本线改动集中在 test/docs，
  工程线下次用图前增量补一次即可。

## 七、未落项与原因

1. js/town-ui.js mkHeadlessDoc（生产 headless 假 DOM）不收敛——业务文件在红线外，且与工厂
   同形（本就是家族 A 原型）。收敛属工程线票（改生产文件），已进守门注释与 §7.2 的「不在扫描面」
   登记；建议 scrum-master 转需求线立票候选。
2. blocks-fields.test.js:91 红——并行翻新线施工中间态（§五），其线处置面。
3. A3 ② 之「Grep 截断导致清扫漏网」本轮未立新规——§7.3 已有「日志直读文件」邻域纪律，
   截断坑已两次实战记录（交接文 + 本回执 §四），暂以约定承载；若三度复发再议升格（§1.10 判据）。
