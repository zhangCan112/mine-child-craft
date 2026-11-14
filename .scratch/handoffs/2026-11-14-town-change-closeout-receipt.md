# 收口回执：2026-11-13 PO 变更工程线（撤小镇独立模式→主路白闪进镇第三维度）

> 提交：engineer-manager → PO（用户）验收 · 2026-11-14
> 分支：town-design · HEAD=**e47d55a** · 区间 25efa0c...e47d55a（**39 commits**）
> 三门终态：`npm test` **2071 tests / 2070 pass / 0 fail / 1 skipped（既有 T7_PERF env 门控）** + `npm run lint` 零错（eslint+stylelint+htmlhint）——均 @e47d55a 亲跑

## 一、线总目标与端到端闭环

2026-11-13 PO 变更：**撤小镇独立游戏模式**（入口卡退场），入口缝改为主路尽头白闪维度过场——玩家路径=主菜单进冒险 home 图→沿东向主路步行到尽头→踩线白闪→town 成为 ADV_DIMS 第三维度→镇内 HUD/方位指引/交互高亮/会话四套 UI 全程 adventure 壳承载→回程带回 home 图。

整体评审（两轴并行）裁定：**端到端闭环成立**——七段旅程逐段实证（撤卡守门/带式判据/踩线白闪零弹窗/维度分流 spawn/进镇建机 emit/回程带/回程到达分支），零 scope creep，票间无缝（四态叠加有测试覆盖、参数两源消费面不相交、到达分支次序红测锁定）。标准轴：本线形态纪律优秀（三族命名边界/参数单源/装配序三方一致/壳层零字面量判据全过）。

## 二、票务账（全清）

| 票 | 内容 | 终态 commit | 评审 |
|---|---|---|---|
| T-SEAM-01 | ADV_DIMS 注册 town 维度行 | c4bb084/4f1012e/ba75557 | 票清 |
| T-SEAM-02 | east 带式触发线+恒开放+门口开间 | 0046c8a/b6d1c82 | 票清 |
| T-SEAM-03 | 回程带 z132+east 来向锚+回程到达分支 | 73861a4/83290b6 | 票清 |
| T-SEAM-04 | 交互机宿主挂载壳层 town 分支 | 48a762a/0f15fab/d16559a | 票清 |
| T-SEAM-05 | 撤独立模式缝三件套+装配件迁移 | 3893313/a024e24 | 票清 |
| T-UI-01 | HUD 布局与任务提示容器 | 3a460fb→07ea937（八笔含返工） | 打回→票清 |
| T-UI-02 | 方位指引 Landmark Pointer | 3de7ee1→e033ce2（四笔） | 票清 |
| T-UI-03 | 交互高亮/标记与点选反馈 | e17bf65→0dd414e（五笔含 03F） | 打回→票清 |
| T-UI-04 | 会话 UI 三件套+A/B 接口闭环 | 6b48b51→991870e（四笔含修复批） | 打回→票清 |
| T-UI-04F | 真清单同锚遮挡修复（前置销号） | a2925ca | 票清 |
| T-UI-05 | 联调走查+参数收口+文案/TTS 默认值 | 772e4de/8f91fe0/bdf73d8 | 票清（文档订正闭环） |
| T-CL-01 | 收口修复小票（整体评审发现） | e47d55a | 派令方逐行核收 |

三轮打回修复全部按「不换岗追令原主」办理（01：装配缺失 P1；03：装具面泄漏；04：children live-collection）；红绿协议全程在轨（红因分类留痕、装具收紧制红、绿方零测试改动）。

## 三、工程裁定与遗留登记

### 工程侧已裁（评审复核成立）
- dialog-close「非 done+taskRef 一律恢复 prev」（spec §2.2 无条件主句忠实读法）；
- 同锚命中并列优先 task 条目（04F 契约改约，表序机器红线未动；done 后仍优先=状态盲纯几何）；
- 机械等价背书口径（装具面与真实 DOM 同构=机械等价；人工实机归 PO）。

### 登记待升格窗口（不阻塞验收）
- town-ui.js 939 行四域合一（HUD/指引/高亮/会话）、双栖解析同构两段、advNetherState 名实——三条轻 smell，judgement call；
- adventure-core advEdgeProtectedAt x===156 段告示牌板面 z74/75 字面量（语义=牌面宽度非门口开间，未收编；是否独立常量留后续裁量）。

## 四、PO 待裁清单（11 项，随验收批裁决）

1. **#townHud 挂载位置规格回改**——站装配不改（prebuild §1.1 自declares 落点建议；mode-kit 10Hz 重写 #hud 实证挂内必被冲掉）；回改内容=prebuild §1.1 记录 body 级挂载。
2. **dialog-close 转移语义 spec 回写**——站实装（spec §2.2「A 恢复 HUD」无条件主句）；回写=prebuild §2.3 mermaid 补「其他 result→恢复 prev」边。
3. **HL_AIM_DEG=8 / HL_AIM_MAX_DIST=24 参数核准**——施工裁量默认（依据链：6 岁宽容热区→准星锥角映射；广场尺度外缘「走到跟前才亮」，与 P_D2_NEAR=40 留级差）；调参位=core townHlHit 第三参注入。随附口径：§4.6「悬停切光标」在准星世界模型下豁免（准星即光标）。
4. **GLOSSARY 收词债**——TownUi 词条缺 camRef/hlSource/onInteract、TownUiCore 缺 townPointer*×4+townHl*×5+HL_ 两键（poseRef 已由 T-CL-01 补齐；索引已挂）；归 docs 清扫票，请裁开票时机。
5. **T-UI-04 视觉值族 ui-designer 快裁**——六处偏离定稿/prebuild（panel 宽 420 vs 720、距底 ≈20.5px vs 24-40、panel-bg 不透明、gap 10px vs ≥16、圆角 16 vs 20、praise 徽章 56px）：追认入偏离登记或开票改值。
6. **话术风格总裁**——§7.1 明文导向已落地（标签式禁词守门锚在册），六态句自撰部分与 greet chip「挥手再见」之辨归 PO/ui-designer 终审。
7. **TTS 范围批**——ttsPlanFor/hudConvergenceFor 参数面在册、装配层未接线（首版语义由 cancel-then-speak+冻结闸达成）；SpeechKit queue/drop 完整排队=增强项。praise 截断已消解（dwell 默认 praiseTotalMs[1]=2000ms）。
8. **同锚遮挡交互语义追认**——04F 已按「并列优先 task」销号三处（真清单接任务全链 E2E 在册）；PO 追认此交互语义（含 done 后仍优先、prop 观察降级）。
9. **NPC greet 轻问候留白**——core 协议就绪已测，真清单无 npc 条目真机不可达；归 villagers 线后续。
10. **GLOSSARY 确定性检查**——计数漂移本次已校准（71→74），程序化断言 declared=actual 的守门测试建议仍立（防再犯）；css 孤儿已清（T-SEAM-05）、注释旧引用归注释卫生票。
11. **east-spec.md 改稿归属追认**——§13.2 承诺随撤卡节拍收口「主话术退役+告示牌改读」文档侧改稿，无下家认领且归属表述矛盾（ui-designer vs BA/地图线）；代码侧同族改稿已兑现。请裁归属后开文档小票。

## 五、待 PO 实机验收项（12 项，走查清单 §13 全单）

机械可核段已全数自动化并票清；以下人工项在走查清单标注待实机（.scratch/handoffs/2026-11-14-T-UI-05-walkthrough.md）：白闪体感、2000ms 表扬听感、实机手感/录屏、TTS 发音、banner 终值、接线决策类裁决等——清单 §13 逐项可勾。

## 六、retro 与反馈债

- 工程线 retro 台账：`.scratch/town-seam-change/retro-notes-engineering-line.md`（机械错误 #1-#12 含两次装具契约面复发实录、票务账、PO 待裁清单全文）；
- 验收通过后按岗规写 `.opencode/power-luna/feedback/`（症状/根因/修复建议）收尾。

**请 PO 验收**：整线通过/不通过 + 上述 11 项逐项裁决。
