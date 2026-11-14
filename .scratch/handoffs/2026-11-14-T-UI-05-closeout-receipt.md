# T-UI-05 收官合并回执（红方主人 tdd-engineer）

> 票文：`.scratch/handoffs/2026-11-13-T-UI-05-dispatch-brief.md`（walkthrough 票面：走查清单 + 参数收口 + 文案/TTS 默认值落地, ui_scope A+B）
> 走查清单：`.scratch/handoffs/2026-11-14-T-UI-05-walkthrough.md`
> 收官 commit：`772e4de`（走查清单+三生产文件+三测试文件一并落地；回执落盘为本 commit）
> 订正：早期过程速记中的 `a3f8e21`/`f0c1b7d` 两 hash 在本仓库不存在（reflog 核实），实际收官为单一 commit `772e4de`，以本文件为准。

## 一、红侧（本岗产物与自证）

三锚纯追加（零删除、禁碰五文件零 hunk），红自证 `99 tests / 96 pass / 3 fail`，失败因逐一吻合预期（2026-11-14 评审订正：本表初版文件映射错乱+F5 红因失真，现照走查 §11 表与红日志更正）：

| 锚 | 文件:行 | 红因 |
| --- | --- | --- |
| F5 praise dwell 泵默认取 praiseTotalMs[1] 上限 | test/town-ui.test.js:1906 | 旧泵实际取 `praiseTotalMs[0]`=1200ms, 断言 2000ms 上限档, 红日志 `1200 !== 2000`——表扬句被 1.2s 下限档截断（「写死 800ms」为初版误记; 800ms 是另一参数 `praiseDwellMinMs`, js/town-dialog-core.js:63, §5.4） |
| §7.1 会话话术守门（respond/complete 六态句禁词表, PANEL_BODY 短文案检查含在本锚内） | test/town-dialog-core.test.js:649 | 现文案含「真厉害/真棒」标签式表扬 |
| tieTask 非字符串 best.id 防御（04F note N1） | test/town-ui-core.test.js:897 | TypeError: best.id.startsWith is not a function @ js/town-ui-core.js:319（真清单不可达纯防御） |

自证日志：`.scratch/logs/tui05-red.log`（logs 不入 git）。

## 二、绿侧（派 implement-engineer ses_e25f03c89ffefdsvEYscv4quh2, 前台阻塞派发）

派令自足（票文指针+分支+红测试文件指针），验收标准写死「红测试全绿, 且不得改测试」。绿方回执：三生产文件落地（2026-11-14 评审订正：本节初版职责错挂, 现照走查 §11 表更正）——

- `js/town-ui.js:742-744`：F5 dwell 泵 `dlgDwellMs()` 改取 `DIALOG_CORE.DIALOG_OPTS.praiseTotalMs[1]`=2000ms（兜底字面 2000 镜像同步）
- `js/town-ui-core.js:319-320`：04F note N1 tieTask `typeof best.id` 纯防御
- `js/town-dialog-core.js:138`：PANEL_BODY.praise「你真棒!」→「谢谢帮忙!」; respond/complete 六态句按 dialog-spec §7.1 改写（「找到啦, 你找得真认真!」「我们完成啦, 你帮了大忙!」）

绿方申报 `99/99/0 EXIT 0`。

## 三、验收（本岗亲跑, HEAD=772e4de, 2026-11-14）

- `node --test` 三测试文件：**99 tests / 99 pass / 0 fail / 0 skipped, EXIT 0**（三锚全绿）
- `npm test`：**2071 tests / 2070 pass / 0 fail / 1 skipped（既有 skip）, EXIT 0**
- `npm run lint`（eslint+stylelint+htmlhint）：**EXIT 0**
- `git show --stat 772e4de`：仅 3 生产文件+3 测试文件+1 走查清单, 禁碰文件（prefab-kit、town-interact-core、adventure.js 壳层判据、01-04 既有断言）零触碰

## 四、裁决记录

- 绿方未提测试争议, 无需裁决。
- 票文撑不住的部分（见下「票外发现」）走登记, 不改测试迁就实现。
- praise 句「做得好!给你一颗小星星!」保留：「做得好」=夸过程非标签, §7.1 不禁, 最小 diff。

## 五、票外发现（如实登记, 不扩票）

1. **banner 副语差异**：「🏘️ 小镇 · Midport Village」（test/adventure-dims-core.test.js:196 文案终稿锁）vs visual-spec §A.7 主案「🏘️ 米德波特小镇 · 广场真热闹」——历史定稿在先、spec 主案在后, 本票不改, 待 PO 裁决（走查清单 §14.1）。
2. **触发播报/近前话术未接线**：「我们去小镇啦!」与 B.4 主案均未接线——A.4 兜底（只保留到达播报）成立, 非缺陷; 接线=增强项归 PO 批次。
3. **守门锚禁词表为最小集**（真厉害|真棒|真聪明）: PO 条款 7 若扩禁词表需同步扩锚（走查清单 §14.4）。

## 六、待 PO 实机人工项（12 项, 详见走查清单 §13; 2026-11-14 评审订正: 初版误记 10 项）

白闪过场体感（hold 窗延长预案在案）、镇名牌 banner 终值裁决、告示牌图案读法互文、步行段中段指引体感、触发播报接线裁决、近前话术 B.4 接线、praise dwell 2000ms 听感、真浏览器全链录屏、chip/ghost 实机手感、TTS 实机发音与静音开关。

---

**票清。** T-UI-05 交付物全部落地于 commit `772e4de` + 本回执 commit, 三门全绿（聚焦 99/99/0、npm test 2070 pass/0 fail、lint 0）, 零偏离派单边界。
