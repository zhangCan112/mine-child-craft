# G4 · 裙板护件补底(翼墙/端头墩三格化) — 红自证留痕(红方 tdd-engineer)

- 票: G4 裙板护件补底(design-lead 裁路径 B: 翼/墩加底块 y25, 终形三格 y25..27, 顶面 y28 级不变, +36 格)
- 票面权威: .scratch/town-east-boundary/gate-review-town-side.md「补录·G4 翼/墩补缝裁决」节
  + docs/design/town-side-gate-and-edge-fence-spec.md 勘误五处(已入库 606322b, 本票 spec 零触)
- 基座: t2b-guard 工位, 分支 g4-skirt @ f8a45c9(town-boundary tip, 零增量报备属实; 本线 trunk 未前进)
- 日期: 2026-11-16

## 红测试清单(三文件三面, 红先行, 零实现)

全量口径: 三文件合计 75 tests → **3 红 72 绿**(exit 1), 红因逐条=票文改点, 零票外误伤。

### ⑧b test/town-map-core.test.js — segs 几何权威层

| # | test 名 | 红因 | 分类 |
|---|---|---|---|
| 1 | `town-rim 条目: segs 十六段一次立全…` | RIM_SEGS_WANT 四字面 `wing/pier #26..27→#25..27` vs 实际 segs 仍 `y1:26` — diff 恰四行(pier:16/143, wing:16..30/129..143), 其余十二段字面零差 | 实现未落(G4 底块未加) |

### ⑪ test/town-assembly-core.test.js — op 层派生层

| # | test 名 | 红因 | 分类 |
|---|---|---|---|
| 2 | `town-rim 派生: 按段出 fill 恰 48 笔…` | RIM_FILL_WANT 四字面 `#26-27→#25-27` vs 实际 fill 笔仍 y26..27 — 笔数 48 不变(同 16 段派生), 仅翼/墩四笔 y 域差 | 实现未落(同上, 派生源=segs) |

### 世界层 test/adventure-dims-core.test.js — 实拼见证层

| # | test 名 | 红因 | 分类 |
|---|---|---|---|
| 3 | `墙圈建场(T2): …体量恰 1001…`(首红即断) | `cell(20,25,31)` 期望 13(G4 补底=T2c 露缝 pin 对偶翻转) 实际 0 — 缝仍在; 后续 (16,25,30) 底块 pin 与分域计数(翼 30×2→45×2/墩 6×2→9×2/合计 970→1006)在同 test 内排队, 绿方转绿后一并见证 | 实现未落 |

- 原貌 pin `(20,24,31)=14` 保持零触(票文钉「仍绿」), 红相运行零触自证。
- 既有测试零误伤: 72 绿含 ⑪ 同文件「通廊与不可达」(:826 豁免注=纯注记改, 判据 isRimWingPier 零触)与全部 pad/wall/post/cap 字面。

## 计数机械联动(+36, 分域对账)

- 翼墙域: 每缘 15 格(x16..30 / x129..143)× z31 × 2 层(26..27)→3 层(25..27) = **30→45 ×2**
- 端头墩域: 每缘 3 格(z29..31)× x16/x143 × 2 层→3 层 = **6→9 ×2**
- 南缘 288 / 东西缘 305×2 零涉(翼 z31、墩 z29..31 均不在计域), **合计 970→1006**
- T2 自有: 285+570+4+2+90+18+32 = **965→1001**(+T1a 入域 5 = 1006); spec §4 已在 606322b 落 **1225→1261**, 本票零触 spec。

## 红因分类(§7 口径)

三红皆**预期红(字面翻转型)**: 测试断言超前于实现, js 零触碰; 非测试错误、非装具债。
转绿唯一路径=js/town-map-core.js segs 翼×2/墩×2 四段 `y1:26→y1:25`(终形 y25..27)+
段注/裁定注同步 — 派令已按此写死, 绿方禁改测试。

## 附: 运行留痕

- `node --test test/town-map-core.test.js test/town-assembly-core.test.js test/adventure-dims-core.test.js`
  → `tests 75 | pass 72 | fail 3`(g4-red-run.txt 同目录, 瞬态不入册可弃)
