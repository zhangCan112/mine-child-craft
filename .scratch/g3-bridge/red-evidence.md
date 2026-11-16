# G3 红相留痕:桥延伸补丁四格案红测试自证

票:G3 桥延伸补丁(四格案, PO 体感诉求「像掉下去的传送」主修复, 尾批压轴)
工位:worktree t2b-guard 分支 g3-bridge;红相基座 c4a9ce1(=trunk c5728b1 开工同步 merge, 派令基座 3f4739b 已过期, adventure.js 头注释导出计数冲突取 main 侧 41 处=T-NPC-14 重构后权威)
日期:2026-11-16(红方 tdd-engineer)
红相纪律:只写测试不写实现, js 零触碰;跑法 `npm test` 全量。

## 红测试清单(7 红, 与票文改点逐一对应)

| # | 位置 | 红断言 | 实得 | 预期红因(几何未动) |
|---|------|--------|------|---------------------|
| 1 | test/adventure-dims-core.test.js :551(门楼建场逐块, :605 断言) | cell(78,24,132)===13(+133/134/135 邻接段) | 0 | prefab-kit town-gate kernel 基座桥 dz0..3(z128..131)未延伸 |
| 2 | 同文件 :811(墙圈建场, :903 断言) | nonAir(76,80,20,24,132,135)===100(豁免盒内恰 100) | 0 | 同上(+100 格未落, 计数联动实证位) |
| 3 | test/town-map-core.test.js :100(beyond 自检, pin :121) | pin('gate-south',75,128,81,135) | z2=131 | js/town-map-core.js :49 beyond 域未扩 |
| 4 | 同文件 :142(beyond 判据面, :158 增补样本) | inCoreOrBeyond(box(78,132,78,135)) 放行 | 拒绝 | 同上 |
| 5 | 同文件 :256(脚印合法, :347 精确盒断言) | footOf 精确盒 z2=135 | z2=131 | prefab-kit foot zs=[0,3] 未扩(同 test 内 FOOTPRINT max 8 联动同源被先炸遮蔽, 绿相一并转绿) |
| 6 | 同文件 :376(门楼专项, :410 断言) | cell(76,24,132)===13(循环 z128..135) | 0 | kernel 桥层未延伸 |
| 7 | 同文件 :659(U4 判据采样, :687 断言) | prot(76,22,132)=true(延伸段在保 3 采样) | false | townProtectedAt 桥段域 z+0..+3 未扩 |

## 全量计数(红相基线)

npm test:2318 tests / 2310 pass / **7 fail** / 1 skipped。
7 红恰=票文改点, 零意外红——op 层(town-assembly-core.test.js RIM_FILL_WANT)与
rim segs 对本票几何免疫实锤(G3 桥在 prefab 域, 不涉 rim segs/op rim fill)。

## 守卫④必答结论(票令 2④)

「seg ⊆ z≤131」硬红线(town-map-core.test.js :573-574)实读 RIM_SEGS_WANT 清单
(:539-552):十六段全墙圈件(pad×4/wall×4/post×2/cap×2/wing×2/pier×2),
**town-gate 桥段在 prefab 域(kernel+foot), 不属 rim.segs 清单——守卫④不红, 零改**。
红线对墙圈域继续成立(墙圈件仍全在 z≤131)。

## 判据面零触碰确认

- adventure-dims-core.test.js :609-610 ADV_TOWN_RETURN_Z=132 源码正则:未动, 绿中。
- test/adventure-mode.test.js :4961 附近同款正则:未动, 绿中。

## 绿相改点(派绿指针, 形态已自裁)

1. js/prefab-kit.js town-gate(prefab 域单源):kernel 基座桥 dz 0..3→0..6+行注
   (同构剖面实心同材质 ids.base=13, 端头齐头收);foot zs [0,3]→[0,6]+注;
   :1646-1657 行注 footprint「桥深 z128..131」→「z128..135(G3 四格案)」。
2. js/town-map-core.js :49 beyond.gate-south z2 131→135+注 G3 沿革。
3. js/town-map-core.js townProtectedAt(:622-642):分域扩——总盒 z 上界 +3→+6,
   楼段分支限 z≤gz+3(延伸段上方无楼, 楼段域不虚扩), 桥段分支吃总盒
   (y≤gy ∧ 桥体宽 x76..80, z128..135);判据纯函数形态不变(仍锚相对偏移);
   头注②与 ADR-0018 补沿革注(决策 2「扩域过票」=本票)。
4. 零触碰清单:上述判据面两正则;⑧c 对拍(town-map-core.test.js :702,
   吃 footOf 单源自动跟随新域, 楼段/桥段归属正确性由对拍自证);spec 本体;
   rim segs;墙圈域计数 1006(桥延伸不交墙圈域);main;town-boundary worktree。

绿相验收标准:红测试 7 红全转绿 + 全量 npm test 0 红 + npm run lint 零错, 不得改测试。
