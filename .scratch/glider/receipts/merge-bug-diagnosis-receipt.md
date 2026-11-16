# 修因回执 — glider×main 合并后 2 红（PO④-2/PO④-3 蓄力不起）

日期: 2026-11-16 · 诊断岗: bug-doctor · 合并态: HEAD=689d246(glider) × MERGE_HEAD=342704c(main)，未提交

## 1. 红信号与复现命令（紧反馈回路）

- 全量基线（修复前）: `node --test test/adventure-mode.test.js` → 234 pass / **2 fail**
  （失败= PO④-2 :6890「前置: C 蓄力已起步(进度>0)」与 PO④-3 :6914「C 照常挖穿」）
- **最小复现（2 测）**: `node --test --test-name-pattern="T-G04 死亡重生|PO④-2" test/adventure-mode.test.js`
  → 2 测 1 红（PO④-2）。同款 `…|PO④-3` 亦红。修复后两者转绿。
- PowerShell 中文 argv 有截断风险，可靠形态: `node .scratch/glider/receipts/merge-bug-probe.js --file <pattern清单>`
  （探针脚本与本次全部 bisect 证据均在 .scratch/glider/receipts/merge-bug-*.log）。
- 二分轨迹: 全文件 2 红 → `T-G04|PO.-2` 红（T-G01/T-G05/案卷段均绿）→ 段内 6 组对分 →
  `T-G04 死亡重生|PO.-2` 红（单污染源钉死）→ 插桩 `[DEBUG-mb1]` 实证泄漏链 → 撤桩。

## 2. 根因（一段话）

`test/adventure-mode.test.js` 的 `T-G04 死亡重生`(:6314) 在 `:6327 glideFrame(3)` 的
「物理收滑翔态」注释假设不成立——重生传送后玩家仍悬空、装备位仍在（死亡保留装备），
voxel.js 滑翔状态机(:319-338) 收翼四路（落地/触流/主动取消/卸翼）在三帧内一条都没走到，
eng 域 `gliding` 残留 **true**；随后 `:6330 AdventureMode.cleanup()` 卸装备，但卸翼收滑翔
是 **physics 帧级判定**（voxel.js:323-324 `!gliderEquipped→gliding=false`，:244-245 注释自证），
测试在 cleanup 后零物理帧（浏览器主循环下一帧就会收），残留就此冻结。glider 侧尾块桥接件
`:5767 globalThis.isGliding = G.isGliding`（铺真件直通 vm，**铺后不撤**）把残留直通模式层，
后续所有测试里 `adventure.js:5409` 合并守卫行 `if (hit && !advGlideOn() && !advTownAimBlocked())
advMine.down = true` 的 `advGlideOn()`(:3851 → isGliding()) 恒 true → 蓄力永不起。
`freshInit` 只复位模式态与相机桩，够不到 eng 域物理绑定，残留跨测试存活至 PO④。
插桩实证（修复前）: `isGliding()=true, G.gliding=true, G.gliderEquipped=false → down=false → t=0`。

## 3. 为何 main 单独绿 / glider 单独绿 / 合并红

- **main@342704c 单独绿**: 无 glider 段、无 `:5767` 桥接件——`typeof isGliding==='undefined'`，
  `advGlideOn()`（main 侧当时无此守卫，合并行取并集后引入）恒不拦截，PO④-2/3 绿。
- **glider@689d246 单独绿**: 桥接件与残留都在，但 glide 尾块排在文件末尾，其后没有挖掘蓄力类
  测试（后续仅源码切片检查/案卷 idle 段），无人消费 `advGlideOn()` 的误判。
- **合并红**: glider 的「尾块桥接×死亡重生残留」× main 的「PO④ 挖掘测试」在同一进程跑序里
  首次相遇——跨段全局污染，定向跑任一侧都不显。

## 4. 修复（最小 diff，已实测）

**归属裁定: 测试装具面**（freshInit 复位件缺失），非产品行为缺陷、非守卫语义缺陷——
浏览器主循环下该残留一帧即被收掉；修复不动 adventure.js、不动两侧已授权行为面
（滑翔守卫/镇傀儡豁免均保真）、不改任何断言。

改动仅 `test/adventure-mode.test.js` 两处（~17 行含注释）:

1. 新增 `glideHygiene()`（紧邻 `glideCamStub()`，同款「公共入口统一复位」先例的姊妹件）:
   ```js
   function glideHygiene() {
     if (!G.gliding) return;            /* 无残留零开销(不跑帧) */
     const keep = G.gliderEquipped;
     G.setGliderEquipped(false);
     G.physics(GDT);                    /* voxel.js:323 卸翼路径, 浏览器主循环同款一帧 */
     G.setGliderEquipped(keep);         /* 还原装备位(保 init 对账后的原值) */
   }
   ```
2. `freshInit()` 末尾追加一行 `glideHygiene();`。

为何选公共入口而非污染源单点: 「不再犯」——任何未来测试收尾在滑翔态（悬空、装备在）
都会经下一次 freshInit 自愈；与文件内相机桩复位(:486, glideCamStub 注释)是同一问题类
（老段残留×全量跑序）的同一解法。PO④ 段装具自清是打地鼠；`advGlideOn()` 加装备位守卫
属行为面改动（滑翔守卫语义须保真），均排除。

回归钉死方式: 本 bug 的红信号即仓内既有测试在全量跑序下的 PO④-2/PO④-3（合并把两条
红拼了出来）——修复让全量序恒绿且定向序仍绿，无需新增重复测试；证据=下节门禁数字。

## 5. 门禁（数字落 .scratch/glider/receipts/merge-bug-fix-gate.log）

- 最小复现对偶: `T-G04 死亡重生|PO④-2` 与 `|PO④-3` → 双双 2 测 2 绿
  （merge-bug-fix-pair.log）
- 本文件全量: `node --test test/adventure-mode.test.js` → **tests 236 / pass 236 / fail 0**
  （merge-bug-fix-perfile.log；修复前同命令 234/2 红）
- 全量套件: `node --test`（=npm test 脚本体） → **tests 2266 / pass 2265 / fail 0 / skipped 1**
  — 正中派令目标 2266/2265/0/1
- lint: `npm run lint`（ESLint+Stylelint+htmlhint）→ **exit 0 零错误**
  （merge-bug-fix-lint.log）

## 6. 票外发现（如实记，未擅动）

- **PO④-1 在本污染下会「假绿」**: 它只断言 `advMine.down===false`，滑翔残留拦截时
  因错误理由通过——修复后此隐患消除，但若未来再引入同类残留，PO④-1 无哨兵作用。
- **T-G04 死亡重生测试的隐含假设未断言**: 「:6327 物理收滑翔态」从未被
  `G.gliding===false` 断言钉住（本回不扩票；如需加固属 glider 侧测试票）。
- base 体六处 camera/CameraRig 挂载多数无清理（:1322/:1490/:3972/:4004/:4107）——
  本次实证非本 bug 病因（poTownGun 每测自挂可覆盖），维持经理预诊断「已核实安全面」结论。

## 7. 工作树状态

- 唯一代码改动: `test/adventure-mode.test.js`（保持 UU 未暂存态，提交权在经理）。
- 诊断工件: .scratch/glider/receipts/merge-bug-*（log/txt/probe.js，未跟踪）。
- 插桩 `[DEBUG-mb1]` 已全部撤除（grep 仅余 log 回执内证据行）。
