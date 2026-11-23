# T-C11 听感走查记录（design-lead 把关管线）

- 走查对象：campfire_lit / campfire_out 两枚 synth（tc11 分支，audio-registry.js +4 行；三锚接线 adventure.js +11 行）
- 日期：2026-11-17 · 结论：**PASS**（三判据+配套观察项全过；参数=定稿 §7.1 冻结值，走查证实现=设计）
- **诚实边界**：本管线无耳——把 WebAudio 合成路径逐节点移植成采样缓冲，以波形/包络/频谱数值+PNG 曲线
  替代人耳；判据可测面全程序化，音色美感终审耳=PO 试玩（参数本就是 PO 评审过的定稿冻结值）。

## 登记与接线核对

- 注册表逐格=定稿 §7.1 表：lit{lowpass 480/0.18s/g0.10} out{lowpass 320/0.45s/g0.08}，
  prio 2 / coolMs 300 / g,gTouch 1,1 / 命名定稿——逐值命中
- 三锚恰位（adventure 测试 261/261 含断言）：放置即燃+重燃成功→lit 同拍；燃尽→out 与方块移除
  同帧（消失瞬间，不等渐熄粒子尾巴）；浇熄路径零 sfx 调用（缺省不配声 ✓）
- 局内零 sfx 字面量（登记清单纪律静态网）✓；双模式 dev 静默=advProfile 政策缝既有机制

## 三判据（合成移植亲验）

| # | 判据 | 结果 |
|---|------|------|
| 1 | 软噗不炸耳 | ✅ lit 峰值 0.0204（削波线余量 49×）· 质心 310Hz · >2kHz 能量 0.06% · 起音 6.1ms 滤波平滑台阶无 click |
| 2 | 轻叹不惊悚 | ✅ out 比 lit 轻 1.48× / 长 0.44s vs 0.18s / 质心低 258 vs 310Hz——「更低/更轻/更长」三 ordering 全成立=§7.1 性格转写逐项命中 |
| 3 | 连放三座无叠爆 | ✅ voiceGate.admit 同键 t-last<300ms 即 ignore（audio-core.js:51）；prio 同级严格大于才抢（翼/篝火互不抢）；测试恰位断言在库 |

- 配套观察：无循环燃烧声（§7.2 R1-15 不做清单+5990 刻零循环总账）✓；响度纪律在软家族档内
  （bubble_pop 0.07/chip_pop 0.06/wing_open 0.10 同族）✓

## 方法注记（可复跑）

- 移植链：噪声 buffer（线性衰减白噪，衰减烘焙在 buffer、gain 恒值）→ RBJ lowpass（Web Audio Q 默认
  1dB→线性 10^(1/40)，与线性 Q=1 差异 <6% 不影响定性判据）→ g → sfxBus → HPF160 → master ×0.8
  （compressor 只压峰不升峰，略去偏保守）；mulberry32 固定种子可复现
- 产物：render.js（可复跑）/ run.log（6 条）/ wave-lit-vs-out.png（0.18s vs 0.45s 长度差一眼可见）/
  onset-40ms.png（起音平滑无爆点）/ freq-response.png（双链频响+截止位）
- 程序面独立复跑：audio-registry 14/14 · adventure-mode 261/261（含 T-C11 三锚断言）；showroom 套件
  本地超时未跑完——dev 静默走既有政策缝零新代码，以 tc11 门禁全绿日志收档
