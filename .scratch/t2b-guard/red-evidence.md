# T2b · U4 镇域保护判据 — 红自证留痕(红方 tdd-engineer)

- 票: T2b U4 镇域保护判据(行为面, 墙圈+门楼本体防 child 破坏)
- 基座: t2b-guard @ ced31a8(town-boundary tip, 零增量报备属实)
- 日期: 2026-11-16

## 红测试清单(两文件, 红先行, 零实现)

### test/town-map-core.test.js(24 tests → 3 红 21 绿)

| # | test 名 | 红因 | 分类 |
|---|---|---|---|
| 1 | ⑧b `town-rim 红线: 散布零连累…U4 townProtectedAt 在位(T2b 落地)…` | `strictEqual(typeof c.townProtectedAt, 'function')` actual `'object'`(=typeof null, 装具 typeof 桥) — 判据出口未落 | 实现未落 |
| 2 | ⑧c `U4 判据: townProtectedAt 出口在位 · 在保采样…不在保采样…` | 同上(出口未落 → 桥返 null) | 实现未落 |
| 3 | ⑧c `U4 同源互证: 白名单 part segs 全格 ⊆ 判据 · cap 全格不在保 · 门楼盒=footOf 对拍…` | `TypeError: P is not a function`(P=null) | 实现未落 |

### test/adventure-mode.test.js(240 tests → 3 红 237 绿)

| # | test 名 | 红因 | 分类 |
|---|---|---|---|
| 4 | `U4 话术缝: 镇态镇域命中出镇域话术…零误中沙丘/雾塘…` | `镇域命中非空: 南墙身 (60,25,128)` — 现状 advMineHardText 返 `''`(镇分支未接线) | 接线未落 |
| 5 | `U4 TNT 缝: advEdgeTntProtected 镇维度同守(挂点在位)…` | 挂点 `undefined` ≠ `function` — 挂点未扩 | 挂点未落 |
| 6 | `U4 放置缝: advTownPlaceGuardAt 镇守卫(挂点在位)…` | 挂点 `undefined` ≠ `function` — 具名守卫未提取 | 挂点未落 |

- 既有测试零误伤: map-core 21 绿 / adventure-mode 237 绿(含全部镇态/建场/home 话术既有面)。
- 装具改动(随红): loadCore 返回桥 + adv-mode :57 提取清单桥(均 typeof 桥形, 判据未落返 null 不炸装具)。

## 判据形态裁决(红方预裁, 绿方按此转绿)

1. **part 派生式**(架构方案 §3.1 两选项中之后者): town-map-core 头注「零件库符号
   引用」纪律 + module.exports require 兜底域(adventure-dims-core 自举)双保持——
   判据**不引** PrefabKit; 门楼锚(x,y,z)读 `TOWN_MAP.prefab` town-gate 行(单源),
   保护域政策偏移(楼段 dy+1..+9 全宽含檐口出挑 dx-1..+5 / 桥段 dy-4..0 桥体宽
   dx0..+4 / 净空 dx+1..+3×dy+1..+3×dz+1 排除)带出处注(prefab-kit town-gate
   foot/kernel + spec §2.2/§2.6 + 架构方案 §3.3 表); **第二份漂移由 ⑧c footOf
   逐格对拍断言锁死**(prefab-kit foot 若变, 对拍红=强制同步)。
2. **墙圈**: 吃 `TOWN_MAP.ground` town-rim segs(几何唯一权威), part 白名单
   `pad/wall/post`; `cap/wing/pier` 不在保(§3.3 表逐行拍板外推+ADR-0018 记录);
   墙头花=派生面不在 segs, 天然不在保(采样钉 (40,27,128)/(90,27,128))。
3. **在保拍板**(§3.3 表): 墙身 y25..26 / 垫层 y24 / 接头柱 y25..27 全高 / 门楼
   全盒(楼段+桥段, 门洞净空 x77..79×y25..27×z129 除外——穿行契约)。
4. **三缝接线门形态**: **行身份比对** `advDimRow(advDim) === ADV_TOWN_DIM_ROW`
   (壳层先例 :321/:612/:2448/:3016; 守门 test/adventure-dims-core.test.js:289 禁
   advDim 字面量 town 特判)。**`advMap === 'town'` 是死门禁用**——advSetDim 进镇
   时 advMap 不动(T6, adventure.js:2444), 镇态 advMap 恒 'home'。
5. **话术缝早返形态**(红方裁决, 比架构方案 §3.2「缝前插」更严): 镇维度下
   advMineHardText **只消费镇判据, 早返**(命中→镇话术; 未命中→`''`), 绝不落
   home 方位分支——镇态坐标喂 home 几何判据(高度场/方位桶)=跨图误判语义错位
   (pier/翼墙域 z29..31 撞 home 北雪桶 z≤31 / x16..18 撞西雾塘带)。ADR-0018 记录。
6. **TNT 缝**: 维度门形态照抄——镇分支前置(行身份门+townProtectedAt), 既有
   home 门 `advDim !== 'overworld' || advMap !== 'home'` 原样保留。
7. **放置缝**: 镇侧守卫具名提取 `advTownPlaceGuardAt(x,y,z)`(行身份门+
   townProtectedAt, 挂点导出), placeGuard 表达式 OR 并列(镇/home 判据坐标域不
   相交, 架构方案 §3.2「并列 OR」授权); home 侧表达式零改动。
8. **挂点扩**(测试挂点纪律, advMineHardText 挂点先例 :5569): adv 导出清单 +
   `advEdgeTntProtected` + `advTownPlaceGuardAt` 两行, 头注 interface 键计数
   39 键同步(如锁则如实更新)。
9. **话术占位文案**(home 同族儿童口径, spec :173「镇的城墙牢固」读法):
   `'镇的城墙牢固实实, 挖不动——走大门进镇, 里面热闹着呢!'` ——
   **TODO 话术待 design-lead 定稿**(spec/把关记录/架构方案均无定稿字面; 测试
   断言「非空+零误中特征词」不锁字面, 定稿追令换文案不破测试)。

## 守卫重构(⑧b, 票令第 5 条)

- 原「U4 townProtectedAt 不落 · modes/adventure.js 零触碰」→ 转正:
  - 「不落」→「出口在位+源文本在位」双断言(强度不降, 语义转正而非删除);
  - adv 面反断 → `includes('townProtectedAt')` 接线在位 + `!includes('town-rim')`
    零字面维持(回程判据行为面零触碰守卫语义保留);
  - 散布零连累断言原样维持。

## 派绿验收门

- 红测试 6 条全绿(不改测试); 两文件 0 红;
- npm test 全量 0 红(计数如实) + npm run lint 三件套零错;
- 禁触: 回程判据/armed/ADV_TOWN_RETURN_Z 相关面、index.html 加载序、main 分支。

## 绿方打回与本岗裁决(2026-11-16, 缺口 1/2 均红方产物红方自修)

- **缺口 1(绿方打回)⑧c 同源互证测试内矛盾**: segs 全格循环与 footOf 对拍循环在
  (75,24,128)/(81,24,128)(南垫层端格——pad seg x32..75/x81..127 延伸进门楼 foot
  盒檐口出挑列脚下)对同一纯函数要求 true 且 ===false, 任一归属形态必红其一。
  **裁定: 测试自身对拍公式缺陷**(公式没表达判据的并集归属语义), 非迁就实现——
  垫层在保=§3.3 表行 2 票面语义, 判据 true 正确。修法=对拍循环跳过白名单 seg
  格(两循环各管各域: seg=墙圈域全 true / 对拍=门楼独有域公式值), 并加覆盖
  完整性断言(m+skipped===foot 盒全集且 skipped≥2)——强度不减反升。
- **缺口 2 红测面 lint 21 错**: ⑧c P 大写单字母别名(new-cap ×20)→prot; adv 装
  具桥行 124 字符(max-len)→折行。红方产物红方自修, 绿方实现零触碰。
- 收口提交 f5bf112; 复核亲跑: map-core 24/24 + adv-mode 240/240 + 全量
  2295/2294 绿/0 红/1 skip(T7_PERF env 门控既有) + lint 三件套零错。
- 基座报备: 绿方已并 town-boundary tip 606322b(G4 裁定文档先行, segs 数据未动,
  townProtectedAt 零改动兼容将来 G4 落数据)→ 分支终态 f5bf112; 收尾时点 trunk
  未再前进, 同步纪律闭合。
