# T-C5 红方自证（红因直证）

- worktree: `C:\Users\user\.local\share\opencode\worktree\1631a8\campfire-mech`，branch `tc5`@`0ae9e53`（集成分支当时 tip）
- 基线（开工实测）：2382 tests / 2381 pass / 0 fail / 1 skipped
- 红测落盘后定向跑批（五文件 TAP）：**519 tests / 500 pass / 18 fail** —— fail 恰好=本票 18 条新红测，基线其余 501 条全绿
- 全量跑（`node --test --test-reporter=tap .`）：`.scratch/tc5-red-full-tap.log`（完工段补记）
## 全量跑（红自证收尾）
`node --test --test-reporter=tap`（默认扫 test/）→ `.scratch/tc5-red-full-tap.log`：
```
# tests 2400   # pass 2381   # fail 18   # skipped 1   # cancelled 0
```
- 2400 = 基线 2382 + 新红 18（位序吻合）
- 2381 pass = 基线 2381 全数保住（装具修订零回归）
- 18 fail = 本票 18 条新红测，not-ok 清单与上节清单一一对齐
- 红自证结论：**红齐、红因合格、基线零回归** —— 派绿条件满足


## 红测清单（18 条）与 [red-cause]

### test/adventure-core.test.js（纯函数 3 条，追加于 advCampfiresClean 测试后）
1. `T-C5 档键解码 advCampfiresDecode: [[posKey,{left}]]→Map(...)` — red-cause: `advCampfiresDecode` 在场断言 `expected:'function' actual:'undefined'`（纯函数缺席）
2. `T-C5 解码拒收(整条拒收不抛)` — red-cause: 同上守卫（首行 typeof，干净红）
3. `T-C5 重放对账 advCampfiresReconcile: 纯查询三清单` — red-cause: `advCampfiresReconcile` 在场断言（缺席）

### test/campfire-kit.test.js（kit 缝 4 条，追加于 read 缺席容忍测试后）
4. `T-C5 opts.key 注入` — red-cause: `map.has('n|1,2,3')===false`（基点裸键，无前缀注入）
5. `T-C5 opts.sceneGate 门禁` — red-cause: 跨图条目被上界水**误淬删条** `actual:0 expected:1`（缺陷行为实证）
6. `T-C5 回调第 4 参 posKey` — red-cause: 回调第 4 参 `actual:undefined expected:'n|1,2,1'`
7. `T-C5 ledger.readd` — red-cause: `typeof ledger.readd==='undefined'`

### test/adventure-mode.test.js（集成 6 条，追加于文件尾；装具修订 2 处见下）
8. `T-C5 存档往返` — red-cause: `saved.campfires` 缺键（payload 无 campfires 键，deepStrictEqual 失败）
9. `T-C5 熄灭态重进` — red-cause: `saved.campfires` ≠ `[]`
10. `T-C5 重放对账: 缺账燃块补满+非法拒收` — red-cause: 台账缺条 `map.get(k1).left` 读 undefined
11. `T-C5 僵账核销` — red-cause: 对照组 keep 条缺（台账空，读 undefined）
12. `T-C5 气流重注册` — red-cause: 重进后 sim 注册 `actual:0 expected:2`（无 readd 缝）
13. `T-C5 fx 增项` — red-cause: `A.advCampfireFx` 缝导出断言 false（fx 段在 feat/campfire 线，基点缺席=干净红）

### test/adventure-nether.test.js（跨图 3 条，追加于文件尾）
14. `C5 跨图同烧` — red-cause: `台账键带 n| 图前缀` 断言失败（基点裸键）
15. `C5 误淬门禁` — red-cause: `跨图条目存活` 失败（无门禁被上界水误淬）
16. `C5 跨图燃尽` — red-cause: 亏刻布景 `map.get(k)` undefined（n| 键缺条；TypeError 指认键形缺陷）

### test/showroom-mode.test.js（dev 口径 2 条，追加于浇熄同拍测试后）
17. `体验馆 T-C5 发放与内存态` — red-cause: `ShowroomMode.stock` 无 campfire 行（dev 套餐未发放）
18. `体验馆 T-C5 退场即清+零污染` — red-cause: cleanup 后台账残留 `actual:1 expected:0`

## 装具修订（报备，红方权限内）
1. `test/adventure-mode.test.js` 铺 `globalThis.UPDRAFT_SIM`（Node 侧键控录制器，镜像 world.js 装配消费面 add/remove/clear；**在 require adventure.js 之前**——adventure.js 顶层构造 advCampfires 时捕获，C3 装载序陷阱同款）
2. `test/adventure-mode.test.js` loadScene 桩加 `UPDRAFT_SIM.clear()`（镜像生产 clearWorld→world.js:844 链；残留注册会掩盖 readd 缺陷）

## 红因核验结论
18/18 红因全部落在「票面要求的缝缺席或缺陷行为」上，无装具炸、无误红：
- 纯函数面 3 条 = 函数缺席守卫（干净红）
- kit 面 4 条 = opts/缝缺席或缺陷行为（sceneGate 红因直接实证了误淬行为）
- 集成面 6 条 = payload 键缺失/对账缺失/readd 缺失/fx 缝缺席
- 跨图 3 条 = 键形缺陷/误淬实证/跨图收尾缺失
- showroom 2 条 = 发放缺失/退场残留
