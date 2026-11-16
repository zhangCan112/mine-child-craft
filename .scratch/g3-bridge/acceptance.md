# G3 验收裁决档(tdd-engineer 红方主人, 2026-11-16)

## 绿方打回缺口裁定(两处测试面缺陷, 均成立、红方修)

1. **prefab-kit.test.js foot 精确盒旧锚**(绿方报 :3765, 红方实读扩及同族):
   - :3765-3769 footOf 精确盒 z2:131(测试名 7×14×4/消息桥深 4);
   - :3775 place 返回盒 z2:131(绿方 2 fail 中该文件计 1 test, :3765 先炸遮蔽此连坐);
   - :3783-3791 逐格桥体循环 z128..131(子集仍绿但口径过时, 顺势扩 z128..135
     =票文「同构剖面实心」prefab 路径互证补位)。
   - 裁定: 红相(d6464dd)漏排查的同族 pin——红相只收了 dims/town-map-core 两
     文件, prefab-kit.test.js 未排查, 属红方漏; 三处一并收口(z2 135/桥深 8/G3 注)。
2. **town-map-core.test.js :761 对拍 tower 公式无 z 界**: trunk 既有公式
   `y >= g.y+1 && y <= g.y+9`, footOf 盒扩到 z135 后 (75,25,132) 等延伸段上方
   格进对拍域, 公式判 true 而实现(楼段政策域 z+0..3)返回 false, 互斥。
   裁定: 公式补 `&& z <= g.z + 3`——与 townProtectedAt 头注②楼段政策域及红相
   :691 对称守卫(prot(78,25,133)=false)同口径, 非放宽(楼段域本就不含延伸段上方)。
3. **偏离采纳**: 派令绿相形态「dz 0..6 / zs[0,6] / g.z+6」系派令笔误(锚 z=128
   时 dz≤7 才达 z135), 绿方按红测试权威(z135===13 / z2=135)取 dz≤7 / zs=[0,7] /
   g.z+7——裁定采纳, 红测试是唯一权威。
4. **:352 max-len 149>120**: 红相自带 lint 债, 红方折行三段字符串。

## 追令②注释对齐亲核(合并回执要件)

adventure.js 头注释现值 41 键(main 侧 T-NPC-14 时点旧数)vs merge 后语法层实数
**56 键**(AdventureMode.adv :5671-5729, 顶层键逐键清单自证)——**改注释侧**:
41→56 键+沿革归因注(T2b 后 54+T-NPC-13 两挂点 advTownPatrolTick/advTownPatrolApply)。
js 代码体零触碰(只动头注释一行)。

## 完工门(红方亲跑, 收口提交 cbe96c4 终态)

- npm test: **2318 tests / 2317 pass / 0 fail / 1 skipped**(EXIT=0);
- npm run lint: **eslint+stylelint+htmlhint 三件套零错**(EXIT=0);
- 红测试 7 红全绿零触碰(红相断言自 d6464dd 逐字未动, 收口只补同族 pin/对拍公式/
  折行/注释, 不涉七红任何断言);
- 基座: trunk 2e588d4 已含于 HEAD(绿方 56de072 并入), 收尾复验 is-ancestor=0。

## 提交链(本票 g3-bridge)

d6464dd 红相(七面守卫红测+红因档) → c4a9ce1 基座同步 merge(trunk c5728b1) →
8b6a426 绿相(js 三处+ADR-0018) → 56de072 基座同步 merge(trunk 2e588d4) →
b1d5965 绿相留痕 → cbe96c4 红方收口(裁定修复+折行+注释对齐)。
