# villager-wave2 并版回执（集成批并回 main）

- 日期：2026-11-16 · 执行：engineer-manager（eng2-villager，接棒线）
- 派令方：scrum-vw2 · 性质：收口节拍（PR 就绪态 → 并版 main）

## 1. 合并执行

- **main @`4c3ff9f` ← villager-wave2 @`9989491`**（--no-ff，ort 策略，**零冲突**，32 文件 +3996/−100）
- 零冲突结构性成因：merge-base = `3f6a96d` = 并前 main HEAD（集成侧已吸收 main 最新，main 在其上零 commit）
- commit 消息：并版谱系摘要（三票+seamfix+idle批+PO验收修复批案①②④），初版 BOM 已 amend 修复
- PO 手笔文件（js/daily-budget.js、js/modes/focus.js）随基线带入，本批**未触碰**

## 2. 谱系（并版带入的集成 tip 比派令账面新一笔）

- 派令账面 tip @`8e3eafd`；实际并版 tip @`9989491`——前任追加两笔工件 commit + PO 亲落一笔：
  - `0cbd411` 票务入库：T-NPC-13 行为层票（票面+intake+README 状态列）
  - `63ac879` closeout 回执 + batch retro 入库
  - `9989491` **PO 亲落**（author=zhangcan112，2026-11-16 10:24）：po-recheck-closeout.md——PO 8091 实屏复核五条全过回执
- 谱系全链：main@3f6a96d ←（三票）← 807555f ← … ← 4a65710（案①绿）← a36e627（po-accept-fix 并入）← 8e3eafd（装具修复）← 0cbd411/63ac879/9989491（工件）← **4c3ff9f（并版 main）**

## 3. 终门（主仓亲测，并版后全量）

- `npm test`：**2192 测 / 2191 过 / 0 红 / 1 skip**（174s；与集成侧前任亲测值恰合，零漂移；1 skip=T7 env 门控常态）
- `npm run lint`：eslint + stylelint + htmlhint 三关零错
- PO 门证据：工程线自裁回执（po-accept-fix-closeout.md §六，PO 明示授权）+ PO 8091 复核五条全过回执（po-recheck-closeout.md）双双在库

## 4. T-NPC-13 票况（任务2 开工）

- 主人（tdd-engineer）已后台开工，票分支 `t-npc-13-behavior` 基于集成 tip @`9989491`
- 开工面：a2 航点间匀速滑行 + b1 走摆 + G01 四航点环推进者（legById 注入缝喂 advTownAnchorTick）
- 挂起面：c2 十村民日程（等昼夜时钟票落地，不施工）；idle 面已由 po-idle-fix 先行落地（勿重复）
- 硬线随派令：锚点/协议面零语义改动、mob-look-kit 零漂移（golden 逐字节不变）、镇内恒无怪、裁决二三不可推翻

## 5. 挂账提示

- `E:\my-craft-demo\.scratch\town-design\tickets\T-NPC-13-DECISION-RELAY.md`（PO 拍板回执）仍为主仓 **untracked**——建议随 T-NPC-13 收口批入库（主人票面回填时处置）或由 scrum 指示，本岗不擅动
- worktree 残片 `RELAY-JOIN-REQUEST.md`（untracked）：前任裁定不入库，维持原状

**并版收口。** main @`4c3ff9f` 即 villager-wave2 全量终态；T-NPC-13 施工中，票清后另行并入。
