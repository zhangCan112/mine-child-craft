# T-C5 验收裁决记录（红方主岗）

## 一、绿方一期回执（ses_e1a1e6178ffeOXETQ2wu5iuPFI，验收请示）
- 验红 2400/2381/18/1 与红证一致 ✓
- 门禁①（主体后）：2400/2395/4/1——预期外 3 fail = 三条异议（见二）
- final（merge+fx 接线后）：2458/2454/3/1（2458=2400+58 随 merge 进的 C9/C4/C10b 自绿增量）
- merge feat/campfire 一次（tip 中途由 ceda529→cee7062 上游并入 C9 后），冲突两处均并集/双保，解法合理
- 提交：7b6902a（主体+红测+证据）、f4a8b42（merge+fx 接线+advLedgerReset 别名缝）
- 服务冒烟 8091 HTTP 200；图谱增量 ok（27 文件/3155 节点）；lint 三门零错（绿方报）
- 票外发现 5 项（键形两笔/readd 登记册/C9 守门别名缝/对账键体口径/C9 无 fx.clear 按最低要求接线）——均属施工裁量，追认

## 二、三条异议裁决（均为红方落盘红测自身缺陷，红方亲修，绿方零越权）
1. `adventure-nether.test.js` 跨图燃尽 `A.advCampfires` → `AN.advCampfires`（笔误，no-undef；红跑死于前一行故未暴露）
2. 同文件误淬门禁 `(ns.x,21,ns.z)===0` → `notStrictEqual(..., IDS.out)`（上界该格自然地形为地下石，绝对 0 物理不可达；判「非熄灭态」保意图，地形无关）
3. `showroom-mode.test.js` 退场即清 `mem.size===0` → 相对断言 `mem.size===memBefore`（与既有 U4 真档落盘测试在满跑序下结构性互斥；「dev 会话不新增介质写入」意图保真）

## 三、键形漂移缺陷裁决（绿方一期修复范围外的实现缺陷，重派新起修复）
- 实证：修异议 1 后燃尽测推进到 `advSceneEdits.nether.get('n|…')===0` 断言 → undefined；单测模式（--test-name-pattern）同样红 → 非满跑顺序效应
- 根因：`campfire-kit.js` 燃尽回调第 4 参 `key(e.x,e.y,e.z)` **当下场景重拼**——跨图燃尽时人在上界，key 重拼成裸键 → mode 层 advFurnKeyDim 判 home → 误走本图收尾（落 home 桶+写上界世界），nether 桶零记账
- 裁决：台账键=身份（放置时拼形），回调必须携条目实际 map 键（浇熄路径的迭代键即正确先例）；修复=step 前采样到期键（判据 left≤1 与 step ticks=1 精确一致，zip 同迭代序）
- 红测锚正确性确认：nether 燃尽测断言（前缀键记账+上界零碰+回下界火格消失）正是该缺陷的捕获网，测试零改

## 四、终验（修复票 ses_e16586767ffe1AU3r7J23cle91 回执后本岗亲跑复核）
- [x] 修复票提交边界亲核：`8b15782` 只动 `js/campfire-kit.js`（+9/−3），未裹红方未提交测试修订；提交消息无 ~ # em-dash
- [x] diff 亲读：dueK 采样在浇熄循环后/step 前、判据 `e.left<=1`、同 Map 迭代序 zip、onBurnout 携 `dueK[i]`、注释写明禁当下重拼——与裁决逐字一致
- [x] 裁量追认：`simKeys.delete(dueK[i])`——同病灶（登记册键须条目实际键，否则跨图燃尽留死键、同格 replant 被幂等挡住）
- [x] 定向亲跑：`--test-name-pattern=跨图燃尽` → 1 tests / 1 pass / 0 fail
- [x] lint 三门本岗亲跑：eslint 0 / stylelint 0 / htmlhint 0（LINT-ALL-CLEAN）
- [x] 全量 TAP 本岗亲跑：**2458 tests / 2457 pass / 0 fail / 1 skipped / 0 cancelled，not-ok 零条**（日志 `.scratch/tc5-final-full-tap.log`）——与验收线逐字吻合
- [x] 红测修订提交（§7.3，全量绿后执行）：见提交清单

## 五、修复票回执裁定（ses_e16586767ffe1AU3r7J23cle91）
- 验红起步属实（开工前燃尽测 1 fail，红因与裁决一致）✓
- 票文遵守：只改 kit、零测试改动（git show --stat 亲证）✓
- 谱增量 ok（built_at_sha=8b15782=HEAD, head_matches_build=true）✓
- **放行判定：放行。** 终验五门全过（提交边界/diff 亲读/定向 1 绿/lint 三门 0/全量 2458-2457-0-1），键形漂移缺陷闭环

## 六、终验后提交清单（红方）
- 红测自修三处（test/adventure-nether.test.js ×2、test/showroom-mode.test.js ×1）+ 验收工件（tc5-acceptance.md、tc5-final-full-tap.log）随 §7.3 提交，消息扫查无 ~ # em-dash
