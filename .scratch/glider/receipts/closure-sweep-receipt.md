# 收口微扫 · 「四槽」注释残留扫平回执（GP06，收口评审标准轴发现）

> 令源：收口整体评审（标准轴，对照 AGENTS.md 注释口径一致族）——「四槽→五槽」化
> 改版漏网残留，裁准同族第四批扫平（仅注释零行为）。
> 前序：T-G06 主票 307fd20 + 微补丁 5f97b9b 均已评审通过。

## 1. 位置清单 ↔ 改法对照（10 处，行号为现行实测）

| # | 文件:行（现行） | 原文（「四槽」段） | 改法 | 性质 |
|---|---|---|---|---|
| 1 | GLOSSARY.md:148 | 「apply 按四槽 id 集签名幂等」 | →「apply 按五槽 id 集签名幂等」（对齐 armor-overlay.js:263-265 现行「五槽 id 签名」口径） | 签名口径 |
| 2 | GLOSSARY.md:152 | 「paint 四槽 id 签名幂等」 | →「paint 五槽 id 签名幂等」（paper-doll paint 签名同扩五槽，UI spec §4.4） | 签名口径 |
| 3 | js/mode-kit.js:21 | 「四槽穿戴+背包页一键穿上」 | →「五槽穿戴」（与同文件 :43 五槽侧统一） | 穿戴口径 |
| 4 | js/mode-kit.js:608 | 「+四槽穿戴(点槽报…」 | →「+五槽穿戴(…」 | 穿戴口径 |
| 5 | js/mode-kit.js:735 | 「纸娃娃定格预览 + 四槽穿戴 + 盔甲点」 | →「+ 五槽穿戴 +」 | 穿戴口径 |
| 6 | css/style.css:1720 | 「纸娃娃定格预览 + 四槽穿戴 + 盔甲点」 | →「+ 五槽穿戴 +」 | 穿戴口径 |
| 7 | test/boot.test.js:238 | 「/* 四槽全穿 */」 | →「/* 四件盔甲全穿(glider 槽空, 签名五槽) */」 | **实证改法**（见 §2） |
| 8 | test/showroom-mode.test.js:86 | 「/* 装备四槽表: … */」 | →「/* 装备五槽表: … */」 | 槽表口径 |
| 9 | js/button-icons.js:817 | 「四槽通用动作」 | →「五槽通用动作」（wear 键走 armor 判据派生，滑翔翼同管线，spec §3.1） | 动作覆盖面 |
| 10 | js/button-icons.js:867 | 「四槽通用动作键」 | →「五槽通用动作键」 | 动作覆盖面 |

## 2. boot.test.js:238 实证判定（改法偏离字面令的说明）

令文「逐处改五槽口径」，但 :238 上文实测（boot.test.js:231-238）：`w = mkWorn()` 后
仅赋值 helmet/chestplate/leggings/boots 四件盔甲，**无 `w.glider` 赋值**——改成
「五槽全穿」即成不实注释（glider 槽明明为 null）。按「以源码为准」纪律改「四件盔甲
全穿(glider 槽空, 签名五槽)」：消除「四槽」槽数口径字样（扫平意图达成），注释保真
（描述该次 setArmor 真实穿戴面 + 点明签名已是五槽口径）。请经理复核此实证改法。

## 3. grep「四槽」全树终态（清零证据）

改动前全树 grep：`.scratch/glider/receipts/sihao-grep-before.txt`（git grep -n 四槽）；
改动后生产面（GLOSSARY.md + js + css + test）：
`.scratch/glider/receipts/sihao-grep-after.txt`。**装备槽数口径失真残留 = 0**；
生产面剩余「四槽」逐条判定（均非失真，未动）：

- js/avatar.js:18「overlay 盒四槽型」——**令文明示 suppress**（甲盒几何描述非槽数口径）。
- GLOSSARY.md:148 行首「四槽盔甲骨挂 overlay 几何的唯一权威」——甲盒几何描述
  （overlay 只挂四件盔甲的盒几何是事实；同条内签名口径处已改五槽）。
- GLOSSARY.md:285 / js/town-ui.js:5/309/318/336 / css/town.css:3/265 /
  test/town-ui*.test.js ——城镇 HUD **L1-L4 四槽锚点**语义，与装备五槽化无关。
- css/style.css:1762「四槽 2×2 正下方居中独立行」/ test/mode-kit.test.js:1744
  「(四槽正下方居中独立行)」/ docs/glider-acceptance-report.md 引文——盔甲四件 2×2
  的**相对位置语义**（第五槽在盔甲四格正下方/右端），几何事实正确。
- docs/design/glider-ui-spec.md（禁触 v1.2 只读）/ docs/glider-spec.md（需求线在办
  未提交件，禁触）/ docs/glider-tickets.md（归经理）/ docs/equipment-design.md /
  .scratch/**（历史记录件）——时点事实或对比语义，未动（亦在禁触/非授权面）。

清单外发现同性质处：**无**（上列剩余均属三类正语义，非「四槽→五槽化失真」同族）。

## 4. 零行为自证

改动全在注释行（10 处 diff 逐行核对：`.scratch/glider/receipts/sihao-sweep-diff.txt`
——GLOSSARY ×2 词条正文措辞、css ×1 注释、js ×5 注释（mode-kit 3+button-icons 2）、
test ×2 行尾注释/require 行内注释）；零代码字面变化、零词条结构/一览计数变化。

## 5. 门禁数字

- 定向：`npx eslint js/mode-kit.js js/button-icons.js test/boot.test.js
  test/showroom-mode.test.js` → exit 0；`npx stylelint "css/**/*.css"` → exit 0。
- 全量 `npm test`：**tests 2196 / pass 2195 / fail 0 / skipped 1**（exit 0，
  ≈177s，sihao-sweep-full-test.log）——与 307fd20 终门基线完全一致（零行为佐证）。
- `npm run lint`：**exit 0 零错误**（eslint+stylelint+htmlhint，sihao-sweep-full-lint.log）。
- 提交哈希：即本提交自身（自引；以 git log/完工回报为准）。

## 6. 提交面

只 add 实际触碰六件（GLOSSARY.md / css/style.css / js/button-icons.js /
js/mode-kit.js / test/boot.test.js / test/showroom-mode.test.js）+ 本回执。
禁触对账：docs/glider-spec.md（需求线在办未提交件，未碰未 add——其工作树改动非本票
所为）、docs/glider-tickets.md（归经理，未碰）、js/avatar.js（suppress，未碰）。
临时证据文件（sihao-grep-before/after.txt、sihao-sweep-diff.txt、sihao-sweep-full-*.log）
工作区留档不提交（T-G05「验证日志入库归工程线簿记」先例）。
