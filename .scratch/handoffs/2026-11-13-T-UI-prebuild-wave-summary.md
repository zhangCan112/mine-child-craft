# T-UI-01..05 预排波次汇总回执（致 scrum-master · 转 engineer-manager 验收归口）

> 汇总岗位：analyst-manager（需求线/设计线）
> 日期：2026-11-13
> 波次：工程线转来的 5 张 UI 票 **预排规格细化 + 资产预备**（PO 指示；实现动工等 T-MAP 链解阻，不在本波）
> worktree：`C:\Users\user\.local\share\opencode\worktree\1631a8\town-design` @ 分支 `town-design`

## 1. 结果一览（5/5 齐收，无阻塞票）

| 票 | 结果 | 预排产物 | commit | 回执 |
|---|---|---|---|---|
| T-UI-01 HUD 布局与任务提示容器（A） | ✅ 预排收口 | `docs/design/town-ui-hud-prebuild.md` §1/§2 | `a740e75` | 2026-11-13-T-UI-01-receipt.md |
| T-UI-02 Landmark Pointer 方位指引（A） | ✅ 预排收口 | 同上 §3（三票并区同源一份） | `a740e75` | 2026-11-13-T-UI-02-receipt.md |
| T-UI-03 可交互高亮/点选反馈（A） | ✅ 预排收口 | 同上 §4 | `a740e75` | 2026-11-13-T-UI-03-receipt.md |
| T-UI-04 会话 UI 与 A/B 接口闭环（A+B） | ✅ 预排收口 | `docs/design/town-ui-dialog-prebuild.md` | `229466c` | 2026-11-13-T-UI-04-receipt.md |
| T-UI-05 联调走查+参数总表（A+B） | ✅ 预备段收口（联调按票面挂起） | `docs/design/town-ui-polish-prebuild.md` | `4ca3c0c` | 2026-11-13-T-UI-05-receipt.md |

- **实现票均未动工**（最早可开工条件均未满足，符合派单）；三份预排稿让 T-MAP 链解阻后实现票即插即用。
- **门禁**：三笔提交均过 `npm run lint` 零错 + `node --test test/conventions.test.js` 9/9（含文档指针零死链）；analyst-manager 收口统一复跑复核通过。纯文档票，全量 `npm test` 按 T-UI-00 先例不跑。
- **docs/README.md 索引已同步**：城镇 bullet 增三行 prebuild 链接（逐笔随各自提交入库）。
- **冲突规避**：`js/prefab-kit.js`、`test/prefab-kit.test.js` 全程零触碰；`js/`、`css/`、`test/`、`index.html` 零改动；工程线 `1486c62` 主线合并与本波无冲突。README 曾发生预期内交错（B 实例行随 A 实例 `a740e75` 入库），内容经核无损（见 T-UI-04 回执 §6）。

## 2. 归口事项（请按线分发）

### 2.1 engineer-manager（验收+台账）
- 五份回执逐票验收（文件清单/逐节对齐说明/参数表/三门/commit 号均在）；台账更新归工程线，本波只出回执不碰台账。
- 实现票派工时注意：**core 落点** A 函数→`js/town-ui-core.js`、B 会话状态机→`js/town-dialog-core.js`（架构 §11「或等价」容许，两票零文件冲突，见 dialog-prebuild §5.1 论证）；**资产零新增位图可开工**（`.scratch/town-design/assets/ui/` 24 张 SVG 未入库，入库与否归资产票线；👋🔊🏘️ emoji 占位后续替换）。

### 2.2 T-MAP-04 派单须并进（解阻前销号清单）
- **A-01 目标 id 协议**：A 侧期望接口形状草案 `townTarget` + `town-ui/target/focus|update` + 5 子项歧义（hud-prebuild §2.6）。
- **B 侧协议歧义**：`town-ui/dialog/*`↔`town:dialogue:*` 双事件名关系、`target-found` 触发源、Bubble 渲染路径（默认建议 dom）、`taskRef` 形状、`sessionKind` 枚举（N4，随 T-MAP-04 定稿）、close 三值语义确认（N1）（dialog-prebuild §2.4/§9）。

### 2.3 PO 勘误线（文档指针，不改行为）
- 派单 brief 两处漂移：dialog-spec B1-B8 实在 **§10**（brief 写 §8）；「会话收敛」实际落点 **§4.3 末段+§6.2+§0.3**（brief 写 §4.6）。
- dialog-spec 自身：§2.1/§2.2 引「A §6.4」错位（实际 §4.3 末段+§6.2）；§5.2 `BubbleHint` vs §11 `bubble` 同态异名建议归一。

### 2.4 PO 最终验收知情批次（核对底稿 = polish-prebuild §1 总表）
- **U1-U8 / B1-B8 / N1-N5 / P 七项**：默认值全部已落可排期，逐项核对（28 行并表，含「PO 一处改动」入口列）。
- **CS 三项裁决**：CS-1 会话中 L2 处置（A 稿默认暂隐 vs B 稿建议 Seek 保留指向；owner=A/T-UI-02）；CS-2a 高亮金双色（#FFD89A vs #F6C96B，B 稿已给语义分工第三数据点）；CS-2b 完成绿双档（#7FB069 vs #9BCF7A）。
- 知悉项：A-05（L2=上中默认）、A-06（L2 常驻口径并读）、T-UI-02「屏幕边缘指向=视野边缘方位」解读、对比度静态预估 6.48/5.51/5.90:1（WCAG AA，联调实测覆盖）。

## 3. 跨分区一致性核（analyst-manager 已核，两项登记均不阻塞）
A/B 两稿接口逐行对上（open/update/close 载荷与 close 三值、interact/focus、task/context、TTS 仲裁、core 落点、资产结论）；CS-1/CS-2 为仅有着力点差异，双方均已参数化（改参数不改结构），已入 §2.4 裁决批次。

## 4. 执行谱系（后续同分区追令续用）
- A 区实例：`ses_e2c39b14fffeYq9O2rgZFaCgGq`（T-UI-01..03）· AB 区实例：`ses_e2c3a51e1ffeHNcbpPxamLoufQ`（T-UI-04）· 05 预备实例：`ses_e2c2bfe27ffeXgKCjVQojebt0K`
- 流程备注：T-UI-00 的 ui-designer 旧会话经 handoff 换根后跨树不可续，A 区按环境实情新起，分区连续性经 `town-ui-entry-tokens.md` 先例+预排稿显式取色溯源承载（回执 01 审核结论已登记）。
- 本波 5 份派单 brief 与 5 份回执随本汇总一并归档提交（票面证据链持久化；工程线此前未提交 brief，特此说明防重复提交困惑）。
