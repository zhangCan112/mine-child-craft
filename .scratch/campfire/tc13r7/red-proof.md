# R-7 红证直证(对 HEAD 8284a0c 未修实现, 2026-11-23)

- 运行: node --test test/light-core.test.js test/campfire-fx-core.test.js
- 汇总: tests 52 / pass 47 / fail 5 / skipped 0
- 红因分类(conventions §7.4): 恰 5 AssertionError, 零装具炸(TypeError/ReferenceError 零例)
- ✔ 计 47 行 / ✖ 计 10 行(spec reporter; ✖ 含汇总段重复列出)

## 五条红(红先红面)

- FAIL: ✖ failing tests:
- FAIL: ✖ 浇熄格回收(R-7 加带二): 浇熄格余韵期满查询面退场(燃尽同款对称) · 白汽散尽后格回收(cells 泄漏清零) · 窗口内 dig 悬空无害 · 燃尽对照回收不回退 (0.5183ms)
-   AssertionError [ERR_ASSERTION]: 浇熄 0.5s: 查询面退场(燃尽余韵期满同款对称; 旧径永在册必红)
- FAIL: ✖ lowcore 相位窗(R-7 加带一): 低核档 50 火逐时刻帧覆盖=3 — 相位·T 铺满 fs_eff 整圈(翻页非冻结; 对旧不变量 T=frames×frameS 真红: 低核相位散布只落 ≤2 个帧号档) (0.4357ms)
-   AssertionError [ERR_ASSERTION]: 低核 t=0.05s 帧分布覆盖 3 帧(实测 [33,17,0])
- FAIL: ✖ mkPolicy(真实 config BLOCKS): solid∧thin 透光族 80/81/82 不挡光(与视线 isOpaque 刻意分叉, ADR-0021; 全表恰此三 id) (0.4542ms)
-   AssertionError [ERR_ASSERTION]: 门额牌 80(thin 0.15 实心)不挡光 — 横梁朝牌面黑变亮归位的谓词面
- FAIL: ✖ H2 熄态格值面(真实 BLOCKS 小世界): 熄态篝火格 sky=15 直灌穿透(薄块归位全透光) · 火把方块光入格(block 通道不再恒 0) · 燃态源格自亮 15 与 sky 直灌双维持 (1.662ms)
-   AssertionError [ERR_ASSERTION]: 熄态篝火格 sky=15(直灌穿透 thin 格; 邻墙面采样值由此点亮)
- FAIL: ✖ H2 燃→熄过渡(玩法路径增量面): updateEdit 81→82 — 格值翻 sky15/block0, 邻面采样格恒非双零(「光晕翻黑框」闪变判据程序化) (2.2866ms)
-   AssertionError [ERR_ASSERTION]: 浇熄后 sky=15(增量 skyRegion 同步归位; 旧判挡光恒 0 必红)

## :63 翻新标题测试通过面(红先红面中的保绿对账)

- ✔ mkPolicy: lightOf 读 light 字段(缺省 0), opaque = 实心且非玻璃且非薄块(与视线 isOpaque 刻意分叉, ADR-0021) (0.5133ms)

## 红因逐条归因

1. light-core mkPolicy(真实 BLOCKS) 80/81/82: 旧判 solid∧¬glass → opaque(80/81/82)===true !== false(H2 谓词一行修的谓词面直红)
2. H2 熄态格值面: skyCompute 直灌遇旧判挡光 break → sky[熄格]===0 !== 15; bfsIncrease 邻格 skip → block[熄格]===0 !== 12(双通道恒 0 病灶直证)
3. H2 燃→熄过渡: updateEdit 81→82 后 skyRegion 旧判挡光 → sky===0 !== 15, 双零成立(黑框闪变判据直红)
4. lowcore 相位窗: 旧 T=frames×frameS=0.45s, fs_eff=0.30s → t=0.05s 帧分布 [33,17,0] 覆盖 2 !== 3(翻页冻结直证)
5. 浇熄格回收: quench 不置时间戳 → 回收门只认 burnoutAt → 0.5s 后 cells() 仍 true !== false(永不回收直证)