# arch-closeout 回执 — 城镇视觉重制 Step C 交付

- 岗位: arch(城镇视觉重制) · 会话: town-design worktree
- 日期: 2026-11-15
- 交付 commit: **00359fa**(branch `town-design`, 父 f8a7213)
- 状态: **Step C 收口交付**; Step D(stash/stall)未开工

## 1. 交付物

五文件, +679/−418:

| 文件 | 内容 |
| --- | --- |
| `js/prefab-kit.js` | shop/cottage/loft 三蓝图 kernel+defaults v2 重写(落位 614/908/1031); 钟塔脸面石英主导重平衡(撤 dy5/dy9 木腰线) |
| `js/town-assembly-core.js` | TOWN_PALETTE prefab 三行 v2; 头注释 Step C 扩键登记(八新键+换值全表) |
| `test/prefab-kit.test.js` | 三段测试逐格钉值重写; T-09 审计豁免扩为槽名→旗标映射; 材质核对表增至五张(tower/windmill/cottage/shop/loft) |
| `test/town-assembly-core.test.js` | T-09 标题/豁免同步; PALETTE_WANT 三行; place 见证补 cottage bedGrass/frame 证据断言 |
| `test/town-map-core.test.js` | §4.2 体量域表 cottage 高度域 6 转 7(v2 双坡+阶梯山墙) |

## 2. 验证面

- `npm test` 全量: **2074/2078 pass**, 唯余 3 fail = 挂起同步点(见 §4, 归 light)
- 我面四件套: prefab-kit 71/71 + assembly 13/13 + map-core 14/14 + conventions 12/12 = 96/96
- `npm run lint` 三件套零错
- 图谱: code-review-graph 增量两轮(改后+提交后), built_at_sha=00359fa 对齐 HEAD
- 走查: 18 机位重拍(重拍三轮, 末轮含塔重平衡), 关键机位逐张核验:
  - shot 19(Lava Chicken 店面): 抹灰门脸/橱窗玻璃透店内/窗台 19 光带/四廊柱+横梁/蓝幔白滚边双层/橙板白徽/敞门洞 全要素成立
  - shot 12(塔北视): 塔身读「奶白石英板带+深木角柱框」, 不再似旧木墙; 与 shot 17 风车白塔读感一致
  - shot 22(北田全景): 石英广场/樱粉/蓝幔摊位/双白塔整体协调
  - shot 20(西巷): loft 双层体量+上层外挑+蓝幔点位于左, cottage 阶梯山墙红顶+浅基座条于右
- 截图: `.scratch/town-design/shots-arch/`(00~22+30); harness `.scratch/town-design/walk-arch.mjs`

## 3. 登记: 需 lead 知悉/终审

1. **shop 招牌分歧(待终审, 可低成本翻转)**: 落码按 checkpoint 定稿「端框 trim 5+板 signBg 76+icon 徽 signAccent 17@中央 2 格; blank 档全板零 17」; 总纲 §3 G 字面为「9 橙底+块状剪影+19 灯勾边」未照行(19 已克制只入窗台光带, §8 红线)。翻转成本≈kernel 一处+测试两处。
2. **shop 门前陈设省略**: 总纲「门前桶/南瓜陈设」未入蓝图(归 scene 线摊位陈设范畴, checkpoint 裁决)。
3. **扩键报备(八新键)**: shop +plaster/awningTrim, cottage +frame/doorTop/bedGrass/bedFlower1/bedFlower2, loft +frame/doorTop/awning; 均已登记 `town-assembly-core.js` 头注释(Step C 段), 行键⊆蓝图缺省键 pfMerge 校验有测试钉。
4. **换值报备**: shop awning 52→15/signBg 15→76/signAccent 38→17/window 18→68; cottage base 58→13/door 6→64/chimney 3→4; loft base 58→13/wallB 5→17/door 6→64。依据 §2 字库(窗玻璃 18 与玻璃板 68 并存分工: 大橱窗=板 68, 民居小窗=玻璃 18)。
5. **T-09 审计豁免扩为槽名映射**: `EXEMPT_SLOT_FLAGS`(prefab-kit.test)与 assembly 测试同源——door/doorTop 豁免 door 旗标(先例); bedGrass/bedFlower1/bedFlower2 豁免 thin+replaceable(40/61/62 cross 薄块点缀, config 旗标核真)。非豁免槽漏进的同族块仍违例; 收编三行空集不豁免。
6. **awningAccent 语义变更(loft)**: true=一层前窗框楣覆 awning 15 天蓝真布幔(§7.4「天蓝小布幔一角」真块化); false=落回石英框楣 frame 17(旧语义=落回窗材)。同盒差分有测试。
7. **cottage foot 高 6→7**: 平面 8×7 契约不变; 双坡+阶梯山墙(脊沿 dz)总高 7, foot y2=y+6。checkpoint 批准; map-core §4.2 表已随步, **map-design §4.2 文档「高 6」为旧值(同步点, 见 §4)**。
8. **钟塔脸面重平衡(本会话新项; 定性勘误见 §3.8a)**: 走查异常查明=非 bug——ops 链全净(palette→op v.ids 原文注入→kernel 落格), 但 4 宽塔脸角柱占 50% 宽+两道木腰线致木主导(wood 21 vs quartz 5), 远读似旧木墙。撤 dy5/dy9 周界腰线, 边中格恒石英(wood 17 vs 石英+玻璃 15), 桩/楣/檐保留。spec §3 G「石英/木板混」两读法均合规, 本项为美学抉择留痕。

   **§3.8a 勘误(2026-11-15, lead 终审要求; 同日 scrum-master 枢纽补充精确要求扩充)**: 原文措辞「PO 1115 裁决」定性有误——该决策实际通道为 arch 会话内 `ask_user` 直达终端用户(2026-11-15, 本线发起, 选项①石英主导重平衡②保持现样③折中减一线, 答复①), **未经 lead 终审与枢纽对账**, 不构成 PO 裁决。修正定性: **「会话内用户选样, lead 终审追认」**。lead 终审结论引用(2026-11-15): 「【通过】钟塔石英主导重平衡——全景远读成立, 追认」。流程修正即日生效(lead 指示原文): 「今后师会话内**禁用 ask_user 直达用户**——多方案抉择列权衡清单(方案/优劣/你的推荐)落回执→lead 裁; 确需 PO 层裁决由 lead 转呈」。本线自即日起封禁 ask_user 直达通道。

   **commit 消息标注失实记载**: commit `00359fa` 提交消息中「附钟塔脸面石英主导重平衡(PO1115裁决)」标注, 因该决策未经 PO 亲答确认(枢纽处置采信口径: 若 PO 口径返回确认非亲答), **标注相应失实**——以本勘误为准, 消息留痕不重写。若枢纽后续转回 PO 确认亲答, 本段改记「标注成立」。
9. **axle 76 勘误(继承报备)**: 风车 axle=76 南瓜亮橙(总纲 §2「亮橙-趣味光」), 沿 Step B 已提交值。

## 4. 同步点清单(移交 light 线/文档线)

1. **palette→light 测试同步点(挂起红, 勿由 arch 修)**: `test/adventure-dims-core.test.js` 三处 fail——现行号 **439/462/531**(handoff 时号 447/534/465, 行号漂移因 light 线并行改版; 同为三处)。典型失败态 `actual: 17, expected: 58`(旧砂岩 pin → v2 石英/石砖)。light 吸收姿势参照 `test/town-assembly-core.test.js` PALETTE_WANT 三行。
2. **文档同步点**: `docs/town-map-design.md` §4.2 体量域表 cottage 高度列 6→7(被总纲 §3 G 几何升级取代, 测试已随步, 文档未动——文档权不在本票)。

## 5. 环境与通道

- 走查: `node .scratch/town-design/walk-arch.mjs`(CDP 9225/服务 8092); 塔异常核验探针: `.scratch/town-design/probe-tower.js`+`probe-ops.js`+`probe-ops2.js`(vm 沿 ops 真实路径逐格证伪「覆写/陈旧世界」两假设)
- 切片中间产物: `.scratch/town-design/*-v2-seg.txt`+`*-test-v2-seg.txt`+`probe-*.js`+`*.log`(落库后可清理)
- 通信: 本回执 + `.scratch/town-design/arch-relay-fallback.md` 双通道

## 6. 下一步

- Step D: stash/stall 两蓝图 v2(kernel+defaults+测试+palette 无行变更待查证)——手法同本票(node 切片+逐格钉值+槽名豁免表复用)
- light 线: 吸收 §4.1 三同步点后 adventure-dims 回绿, 全量 npm test 应 2078/2078

---

# 7. Step D 交付(2026-11-15 同日追加)

- 交付 commit: **91704ae**(branch `town-design`, 父 e6c958e; checkpoint 记 00359fa 后有并行提交 e6c958e/3ececc5, 本轮基于最新 HEAD 无冲突)
- 状态: **Step D 收口交付**(shop 招牌返工+stash/stall v2)
- 规模: 六文件 +516/−260

## 7.1 交付物

| 文件 | 内容 |
| --- | --- |
| `js/prefab-kit.js` | shop 招牌段(dy6..7 鸡剪影立板 8×2 行图+滚边缩两端); stash 段 v2 整段(10 槽); stall 段 v2 整段(双层阶梯顶 kernel+PF_STALL_TRIM 新表+pfMerge canopyTrim 注入块) |
| `js/town-assembly-core.js` | palette shop/stash/stall 三行 v2 值; 头注释 Step D 扩键登记 |
| `test/prefab-kit.test.js` | shop 九处就地改(新号段/行图/blank 三零断言/逐朝向 16); stash 段整段重写(含缺省逐槽核对); stall 段整段重写(脚印/形状双档/theme 四档/逐朝向/确定性/错误两档); EXEMPT 增 goodsLeaf1/2 |
| `test/town-assembly-core.test.js` | PALETTE_WANT 三行 v2; T-09 豁免条件增 goodsLeaf 两槽 |
| `test/town-map-core.test.js` | L168 摊位高度域钉 y:[4,5](注释引漂移登记源) |
| `test/adventure-dims-core.test.js` | 建筑件实拼格位 v2 对齐(新连带, 见 7.4) |

## 7.2 验证面

- `npm test` 全量: **2078 pass / 0 fail**(1 skipped 既有惯例)——**§4.1 挂起三红随本轮转绿**(旧值 pin 在 dims 建筑件测试内, 与 v2 对齐一并更新, 非独立修复)
- 我面: prefab-kit 72/72(lint --fix 后复验); lint 三件套零错
- 图谱: 提交后增量, built_at_sha=91704ae 对齐 HEAD
- 走查(walk-arch.mjs 重拍 19 张, 新增 21b 机位):
  - shot 19(店正面): 鸡剪影立板 8×2 行图逐格可读——dy7 红冠+白身两格构成鸡头颈剪影, dy6 灯点两枚对称, 端框/板面/主幔/橱窗暖光/门 64 全要素成立
  - shot 13/14(广场东视): 双层阶梯顶对偶可读——左摊 bread 奶油顶+粉滚边, 右摊 flower 樱粉顶+白滚边(奶油×樱粉互映即设计意图); 石英面包堆/粉花货品在摊面
  - shot 21+21b(stash 正面+东南斜视新机位): 门洞/门叶/檐层/基座形态成立; 门侧铁灰配件可辨
- 截图: `.scratch/town-design/shots-arch/`(含 21b); 修复脚本 `.scratch/town-design/fix-*.mjs`+`step-d-*.mjs`(切片通道留档)

## 7.3 登记: 需 lead 知悉

1. **招牌定案**: 鸡剪影立板 8×2(signBird 52/signComb 16/signLight 19 三新槽); checkpoint「或 17 勾勒」可选项未取省格, 徽记 signAccent 案撤(键已从 shop 行删除)。
2. **flower 16→78**: 樱粉落 78 粉羊毛(树 pinkLeaf 先例, 16 大红出局); PF_STALL_CANOPY flower 档与 goodsFlower/flag 同值。
3. **摊位增高**: sm 总高 3→4/md 4→5(双层阶梯顶+1); map-core 测试钉 y:[4,5]; **map-design §4.2「高 3-4」为旧值(文档同步点, 见 7.4)**。
4. **sm 无叶饰约束**: goodsLeaf 中景仅 md(sm dy2 即 tier1 顶无空间)——几何硬约束非偷工, 测试注释钉。
5. **PF_STALL_TRIM 新表**: {bread:78, flower:52, fruit:52, generic:78}, tier2 滚边按 theme 注入(奶油×樱粉对偶); 与 PF_STALL_CANOPY 同法单源, canopy/canopyTrim 双键不入 palette 行(引擎侧 theme 映射单源, 双源即漂移——行注释已载)。
6. **扩键报备(十二新键+一删)**: shop -signAccent +signBird/signComb/signLight; stash +doorTop/barrel/chest/mossy; stall -goods +goodsBread/goodsFlower/goodsFruit/goodsLeaf1/goodsLeaf2/flag+canopyTrim(不入行)。均已登记 assembly 头注释 Step D 段, 行键⊆缺省键校验有测试钉。
7. **Uint8Array 号段教训(测试装具域)**: 世界场 worldCells 为字节域, 方块 id 硬上限 255——STALL_IDS 首版 250..259 段写笔账正确但落格回卷(256→0..259→3), 三红假象(写笔 spy 与落格读数分裂, 复现脚本 repro-stall2.cjs 实证); 换号 220..229(tower 210..219/stash 240..249 互异), 部分注入散值 230/231 同域。**后续任何测试注入号段须 ≤255**。
8. **dims 建筑件连带对齐**: shop 招牌行图 16 格循环(west 旋转手算 z=75..82)/stash 门叶 64-65/摊位货品新位新值(face 旋转坐标经 k1/k2 手算复核, 首版两处坐标误判已纠)。实拼 pin 的维护姿势: 蓝图几何变更须连带核对该测试全部受累格。
9. **桶堆弱可读观察(设计观察, 非 bug)**: stash 桶堆 2+2+1/chest 内嵌前墙格齐平(定稿几何「后写覆写前墙格」), 材质 5/51 与墙 6 同族木色, 21b 斜视判读弱可读; 如需强化(外凸一格/换材质)归后续派令, 本轮不动定稿。

## 7.4 同步点更新(覆盖 §4)

1. **§4.1 三红已清**: adventure-dims 建筑件测试本轮对齐后全绿, light 线无挂起吸收项。
2. **文档同步点(两项)**: `docs/town-map-design.md` §4.2 体量域表 cottage 高度列 6→7(§4.2 旧项仍在)+摊位高度列 3-4→4-5(本轮新增; 测试已随步, 文档未动——文档权不在本票)。
3. **勘误段(§3.8a)状态不变**: 「标注成立」翻转条件仍悬置(枢纽转回 PO 确认亲答则改记), 随本段再次报备。

# 8. op 派生 v2 交付(2026-11-15 同日追加; lead 第二单, scene 需求表 10 项)

## 8.1 交付物

- 提交 e749405(4 文件 +408/−49): js/town-assembly-core.js(palette 扩键+ground/backdrop/road/scatter 四段派生+合脊预扫+头注释 Step E 段) · js/prefab-kit.js(stall theme 六档配平) · test/town-assembly-core.test.js(PALETTE_WANT 全表同步+⑥b 合成 steps 契约新块+⑦ 空隙带豁免修正) · test/prefab-kit.test.js(theme 错误档 fish→shark+头注释六档登记)。
- 10 项全落: tuft/flower/flag/farm-rows/curb/wayshrine/mountain-arch 分色+合脊/cliff-home v2/灯柱(需求 #9 经核 v1 三笔造型已满足, 零改动)/花坛木桶南瓜。词表零扩展(全用现有 {fill,tree,scrub,recolor,place} 派生), 新能力=kind/字段。

## 8.2 验证面

- npm test 2079 pass/0 fail(较上轮 +2: 合成 steps 契约块含全部新 kind 几何直验); npm run lint 零错。adventure-dims 0 fail 同套内实证=「dims 零连累」预判兑现, lead 预留的「受累转 light」通道未动用。
- 图谱手动增量完成(worktree 无 hook): built_at=e749405=HEAD, status ok。
- ⑥b 契约块装具: 合成 steps 直喂纯函数(vm 内剥全域垫底三笔后逐笔断言), 覆盖各 kind 派生几何/字段缺省/合脊 max/错误域消息抽查。

## 8.3 登记: 需 lead 知悉

1. **⑦ 空隙带断言豁免修正(权衡报备, 可翻)**: 原「z29..31 全域零写入」改为「体块零写入, 单格贴地点缀豁免」——体块(tree/recolor/跨 y fill/y>27 fill/scrub top>27)仍全拦, 豁免仅单格 fill(y1===y2 且 y≤27)与贴地 scrub(top≤27)。理由: scene 山脚散布域 z26..31 跨空隙带, 「远景不可达=无立地面, 非无装饰」。现真 steps 无触点(改后仍绿), 实际约束生效要等 scene 清单落数据。
2. **cliffHome: 6 键保留**: legacy 分支(缺省路径)仍引用 pal.backdrop.cliffHome——首版切片脚本曾拟删键, 自审抓回(删键=旧条目 undefined)。v2 造型走 style:'v2' 字段门控, 缺省 legacy 几何逐字节不变。
3. **作物 42..45 不入 palette**: 派生字面(42+(r%5)-1 轮转), 理由=T-09 审计辖 prefab 段, ground 段场景叙事块不注册旗标豁免; 注释已在派生分支登记。若 scene 后续要作物变体, 再议入册口径。
4. **stall theme 配平细节**: fish→goodsBread 石英堆(银白冰台读法)+canopy 15 天蓝(鱼水色); pumpkin→goodsFruit 南瓜橙。叶饰 else 分支从「固定 goodsBread」改「跟案面货走(GOODS_OF[e.theme])」——bread/generic/fish 三档落格逐字节不变, pumpkin 摊顶=南瓜堆两格高(fruit 单叶堆叠读法先例)。PF_ENUMS 顺序扩为 bread/flower/fruit/fish/pumpkin/generic(错误消息派生同步, 测试已随)。
5. **灯柱(需求 #9)已满足**: v1 lamp 三笔造型(座 17×1+柱 5×3+头 19×1, 总高 5)与需求「17 座+5 柱+19 头」完全一致, 零改动, 测试既有钉值在。
6. **合脊语义**: 派生侧预扫(列→max top), mountain 逐柱统一取合脊顶——五段重叠弧形自动合脊, 单条目=自身行为数值不变。契约测试首版用例数值设计错(B 拱心 11.5 不落整数列, 两端点全落地致「max>自身」不可观测)已修——机制本身首验即对。
7. **勘误 §3.8a 状态**: 仍悬置, 随身携带下次报备。

## 8.4 同步点

1. **scene 下轮切第二版清单**: 10 项全部可落(字段契约见交付报告); map-core steps 数据不在本轮文件权内, scene 出清单后按契约落数据——wayshrine 条目须排在 road 段之后(steps 序即写序)。
2. **斩单边界**: 本轮零触碰 map-core/dims/引擎; prefab-kit 仅 stall theme 面(fish/pumpkin 配平为需求表配平项, 避免下轮开票)。

# 9. TIDEA 波次一 arch 静态陈设批交付(2026-11-15 同日追加; lead 第三单, PO 批 19 条本波四件)

## 9.1 交付物

- 提交 a73623c(4 文件 +684/−14): js/prefab-kit.js(PF_ROWS 十行→十五行: scarecrow/clothesline/woodpile/hencoop/board-pool+pfMerge boardLen 6..8/poolSize 2..3 钳+行表注释登记) · js/town-assembly-core.js(palette.prefab 五行逐键同形+props +plank/glassPane/crateBox+scatter 三新 kind+头注释 Step F 段与 interface 行数口径) · test/prefab-kit.test.js(76→85 测: TIDEA 五行组九测+T-09 townRows 七行→十二行) · test/town-assembly-core.test.js(PALETTE_WANT 同步+T-09/完整性对账+⑥c Step F 契约块)。
- 四件对应: TIDEA-04 稻草人=scarecrow 行(5 笔); TIDEA-08=clothesline(13 笔)/woodpile(5 笔)/hencoop(8 笔)三行(windowbox 花窗箱复用 scatter kind 不建行, 单源); TIDEA-10=board-pool 行(§4.8 契约实装, 缺省 6/2 池 10×4 高 7 旗顶); TIDEA-03 素墙立面三笔=wallflag/windowbox/crates 三 scatter kind(assembly 侧, 零蓝图行)。

## 9.2 验证面

- npm test 2094 pass/0 fail(scene 线挂账的 3 红全在本批在途文件, 随本笔清账——其 §b65d1e0 报备的「3 红归 arch 在途」兑现闭环); npm run lint 零错; 本两测文件 100/100(prefab-kit 85+assembly 15)。
- 图谱手动增量完成(worktree 无 hook): built_at_sha=a73623c=HEAD, freshness_advanced=true。
- 守门插曲一处: 首版 board-pool 注释含字面 B_WATER 撞源守门 /B_[A-Z]/ 正则, 改措辞「流体身份块禁作缺省」后过——判据本身未动。

## 9.3 登记: 需 lead 知悉(裁决项)

1. **board-pool ids 契约微扩(本批唯一偏离 §4.8 原文处)**: ids 3 键→5 键(+flagPole/flag)——板顶小旗材质不焊死, 供场景调色; 其余条款(几何/boardLen 6-8/poolSize 2-3/静态水不绑流体)逐字照 §4.8。请裁: 认可即闭环, 不认可退回改行(测试已钉 5 键面, 退回成本一行)。
2. **水缺省=15 蓝羊毛**: 流体身份块禁作缺省是 T-09 红线(写入即触流体机制); v.ids.water 可注覆任何 id。池沿 17 石英(shop plaster 浅石先例)。跳板高公式 dy=round(i·4/(len−1)) 三档顶格恒 dy4=高 5∈契约「高 4-5」域; len 6 档 dy 序 0,1,2,2,3,4(中段有平台读感), len 8 档 0,1,1,2,2,3,3,4(匀梯读感)——落位选档归 scene。
3. **hencoop 静态鸡剪影**: 52 白身+16 红冠两只并排立干草色砂岩台 58(58 经 config 直读实证=砂岩零旗标, 非耕地)——「帮阿面数小鸡」(map-design §6.2)的现成视觉底; 零 spawn 零 town-npc* 触, 玩法接线不在本件。
4. **wallflag 色轮转口径**: 三色 78/15/17 i%3(W-03 原文「78 樱粉/15 蓝/17 奶油交替」逐字), red 16 不入立面轮转(flagCloth.red 槽保留给既有 flag kind)。
5. **勘误 §3.8a**: 仍悬置, 随身携带(第 3 次报备)。

## 9.4 同步点(待 scene 落位清单——本批四件全能力/蓝图, TOWN_MAP 零改动)

1. 落位建议与 steps 条目契约: scarecrow→农田角(W-04, prefab 段 {id:'scarecrow',x,y,z,face}) · clothesline/woodpile/hencoop→镇西/镇东民居门前(W-08 分两组) · board-pool→镇南彩蛋带 z94~127 回程触发线以北(W-10; PO「动骨架-轻」审批指落位增量入 TOWN_MAP, 本笔只立蓝图) · wallflag/windowbox/crates→广场西/南缘素墙(W-03, 11 号底片那面墙; scatter 段 {id,phase:'scatter',kind,x,y,z,v?}, wallflag v.len 钳 2..6 缺省 4)。
2. scene 师注意: board-pool 脚印含池 10×4(缺省 6/2)~13×5(8/3 档), 旗顶高 7; 南带落位勿压回程触发线, 池沿环贴地面 dy0。
3. light 线零交集确认: 本批四文件全在 arch 权内, adventure.js/index.html/css 零触碰; scene 线本波(瀑布/南门件/镇徽花带/记号/丰收角)与零文件交集, 其落位依赖的本批能力已就绪。

# 10. TIDEA 波次二 arch 机制与派生批交付(2026-11-15 同日; lead 第四波, TIDEA-01+§8.3 五件派生)

## 10.1 交付面

- **新件 js/spinner-core.js+同名单测**(旋转核心, ADR-0011 增补① PO 亲裁破例件):
  注册表纯核四件——clampPeriod(≥1s 下限/非有限回落 5=4-6s 带中点/无上限) ·
  register({mesh,axis,period?,phase?}(axis 白名单 x|z 余落 z/phase 缺省 0)) ·
  tickSpinners(dt)(phase 折算圈数绕回, rotation[axis]=phase·2π) · drain(排空交
  引用, remove/dispose 归消费方)。零 THREE 零 DOM, 尾部 CJS 守卫导出。
- **prefab-kit 两笔**: ①windmill 行 spin 声明+spinnerOf 第三门——值敏感终态
  Map 差分(A/B 两面各收后写者赢的终态再按键+值比对; 两教训实证: 逐笔收集
  把 kernel 同格多笔写中间态漏进结果 34 格、仅键差分丢覆写格 30 格, 终态+
  值敏感=31 精确); 返回 {center,axis,cells} 世界系(orient 门内置), 非 spin 行
  抛拼写域错。②stash-hut porchLamp 键组(defaults:false/ids:19/pfMerge 布尔钳/
  kernel 灯笔置于门叶笔后——door:false+porchLamp:true=敞门挂灯已测); 门面
  「恰好两个入口」拍板自此**三门**(interface 变更登记本节)。
- **town-assembly-core 波次二**: palette stash 行+porchLamp:19; 五件派生落
  地(mountain.waterfall 瀑布三笔/plaza.emblem 16 笔回字环纹死字面+axisBloom
  32 笔行相位/farm-rows.harvest 非埂行覆 45 埂行跳/stash tidea.porchLamp→
  v 注入+groundMark 四笔); **spinner op**(place 双胞胎: v.sailStatic===
  false 严格判据→spinner 替代 place, period 顶层钩穿透缺省 undefined→
  SpinnerCore 5); **路面嵌花 inlay 补记**(emblem/axisBloom 收集延后全 steps
  循环后补记——map-core 条目注「嵌 main-south 路面」读法实证: 原 ground
  相位派生被 main-south(x76..80 z94..118 id13)后写覆埋, 本笔实现序 bug
  自纠, 补记后徽/花带在路域内世界态可见)。
- **adventure-dims-core**: townConsumeOp spinner case(place 半边塔体照建+
  mkSpinnerMesh 网格半边——SPIN_BOX 六面 CCW 顶点表×31 组件格折叠单
  BufferGeometry, BLOCKS 面色 all||top/bottom/side 缺档灰×MC 风格固定面亮度
  烘焙(顶1.0/±z0.8/±x0.6/底0.5), MeshBasicMaterial vertexColors——仓库零
  THREE 灯, 云朵 Basic 同款先例; THREE/SpinnerCore/scene 三守卫, 装具域
  退化纯塔体)+townBuild 重入 drain(remove+dispose 收口)+合法域消息加
  spinner; 头注释 interface/依赖/可测性三行随更。
- **main.js +1 行**(帧循环 pumpFluids 邻行 SpinnerCore.tickSpinners(dt),
  暂停冻结=不喂 dt 同 fluids/昼夜口径); **index.html +1 script**(spinner-core,
  prefab-kit 后 world.js 前); **world.js 零改**(预判成立)。
- **GLOSSARY**: 新增旋转核心词条(护栏红线随身)+索引 67→68; PrefabKit 词条
  interface 加 spinnerOf 三门+行表「十行→十五行」+board-pool「推迟未实现→
  转正」事实校正(波次一遗留措辞, assembly ⑨ 微改守门先例随本笔清)。

## 10.2 验证

- 四核心文件(spinner/prefab-kit/assembly/dims 各自 test)合计 **138/138 绿**
  (--fix 后复跑同数); 全仓 npm test **2114 tests / 0 fail**(lint 修前);
  npm run lint **零错**(49 起手: 48 auto-fixable --fix 吸收+1 max-len 手修,
  全归本笔六文件, light 在途面零涉)。
- 装具手法登记: spinnerOf 断言跨 vm 域逐字段(center 三轴 strictEqual, 原型
  链异 deepStrictEqual 必败); dims test B 桩 THREE/scene 网格半边全链
  (mesh 构造 31×24 顶点/组原点 (56.5,32.5,45.5)/注册 axis=z period=5/
  tick 半圈 π/二次建场 remove 恰一次旧 mesh)。

## 10.3 测试面(新增/同步)

- 新增: spinner-core 6 例(钳域/注册/tick 绕回/x 轴/排空/表态隔离);
  prefab-kit porchLamp 四态块+spinnerOf 块(31 格计数/零写/世界系抽格/
  east 旋转轴 x/S=3→23/错误两档/覆写格随组件/sailStatic 入参无关);
  assembly ⑥d 两块(合成契约: spinner op 判据+period 穿透+porchLamp 注入+
  groundMark 四笔; 真实五件显影: 瀑布三笔/emblem 六抽格/bloom 三抽格/
  harvest 四抽格/记号四抽格+灯); dims 五件显影 voxel 抽格块+spinner 消费
  全链块(词表封闭 pin/无桩退化/桩全链/重入清场)。
- 同步(既有 pin, 契约面): dims :517 stash 门上叶 65→**19 门楣挂灯**; dims
  广场铺装 pin (79,79)→(70,70); assembly 广场 pin 同点同挪; 崖屋
  deepStrictEqual 期望数组**前置瀑布两翼两笔**(id17 撞 cliffFrame 入过滤
  集, 柱笔 54 不在 id 集排外); assembly place 计数 13→**18**(见 10.4③)。

## 10.4 登记项

1. **PrefabKit 门面两门→三门**: 「恰好两个入口」系波次一前拍板, spinnerOf
   增为第三门(纯查询零写同 footOf), GLOSSARY 已随更; 下一票引用门面措辞
   时以三门为准。
2. **cells 权威值=31**(轴3+肋16+帆12; 源 prefab-kit.test「31 组件格」注释;
   S=3→23)。会话摘要曾误记 33——手算/转述一律对仓内 pin 核对。
3. **place 13→18**: 计数红=波次一落位五件(b65d1e0 已入库)撞波次一数字面
   断言, scene §10.4 补丁底稿随 lead 转派本笔吸收(「数据变更方披露+权属
   主落条款」); 底稿措辞「7 建筑+埋室+摊位 6+陈设 5」合计 19 与实拆
   6+1+6+5=18 差 1, 测试消息按实拆落并注明底稿来源; 同测试标题 stale
   「13 实例」字面一并校正。
4. **旋转方向=+向**: ADR-0011 未定口径, 取 rotation[axis] 正向, 注释登记;
   走查若觉反转改符号一处。
5. **mkSpinnerMesh 材质取舍**: Basic+烘焙面亮度(仓库零灯光, Lambert 必黑);
   夜间不随天光暗(视觉读作「地标常亮」, 走查反馈再议, 不扩机制不挂
   applyDaylight)。
6. **period=op 顶层钩**: 条目顶层键全链静默先例(§8.2.2 同款), pfMerge
   白名单外(蓝图纯几何不收动画参数); 缺省 undefined→clampPeriod 回落 5。
7. **tidea 命名空间键消费**: porchLamp/groundMark 自 map-core 数据经
   assembly 读 s.tidea→v 注入/直接派生(pfMerge 对 v 未知键抛错故永不入
   v 原样); 对账成立: scene (dx2,dy2,dz0)+锚 (49,24,98)→世界 (51,26,98)
   =蓝图门上叶位(半门挂灯读法, 挂点非门楣 dy3——数据「基+dy2」逐字执行)。
8. **inlay 补记**: 派生序变更登记(ground 相位收集→全 steps 后补记),
   补记序=收集序确定性不破; assembly/dims 显影抽格以补记后世界态为准
   (徽角 (77,24,109)=78、花带嵌路 (80,24,102)=4 等已验)。

## 10.5 红清单(scene flip 预演, 只列不改——转 lead→light)

scene 数据翻 v.sailStatic=false 时: dims 建筑件测试 **:500-505 六条叶片
pin 即红**(轴3 (56,32,43/44/45)=76→实得 9/0/0; 上/下臂帆 (55,35,45)/
(57,29,45)=6→0; 叶框 (56,35,45)=17→0)——归 light 同步(消费路径语义已由
本笔 dims test B 全链预演: 翻转后塔体 voxel 照建、叶片归 mesh 半边);
**:506-510 塔体五 pin 存活**(基座/塔身/门洞/小窗照建)。map-core 测试
:166 windmill 体量 y 域 [12,14] 若随 foot 拆叶口径变更是 scene 自裁面。
翻转本身零 arch 依赖——本笔后 scene 可随时翻。

## 10.6 涉面声明(共享文件, lead 确认面)

index.html(+1 script 行) · main.js(+1 tick 行) · GLOSSARY(+1 词条+索引
计数+PrefabKit 措辞)——三处均机械最小笔; light 在途文件(adventure.js/
town-ui.js/town.css/light-closeout.md)全程零触碰。

# 12. PO 亲需批能力面契约(2026-11-15 追加; lead 第五批: PO 三条亲需+scene 探勘定案 6413b00 吸收)

## 12.1 字段契约(scene 切数据依据)

**① mountain-arch 条目 +southCorridor**(攀登走廊, PO 亲需②):

    {id: 'mountain-arch', kind: 'mountain', x1: 16, z1: 8, x2: 143, z2: 28,
     topY: 44, bands: true, waterfall: {x1: 63, x2: 64}, reachable: false,
     southCorridor: {x1: 60, x2: 61}},   /* ← 唯一新增键, 其余不动 */

- 值 = {x1,x2} 台阶列域(数据化不焊死; lead 裁定中带 x60..61, 东带备胎
  x68..70 换值即可, 西带 x54..56 崖屋死)。水花列 x62 天然域外=拱形原样。
- 派生: 走廊列 z 向阶梯, 包络 h(z)=min(合脊顶(z), h(z+1)+1) 自南缘 z28
  贴地(y24=镇草/裙板平接)北行 ≤1 阶, 北端 z10 接山肩平台(y42),
  z8..10 维持列顶——与 scene 探勘「z28→z10 恰容 17..20 级」逐点吻合。
- 缺键 = 字节级零变化(既有全 pin 门控下存活+真布局显式见证 test);
  非 bands 带键 → 派生即抛拼写域错(不静默埋假阶梯)。
- reachable: 置 southCorridor 时同步 reachable:true(现无消费方, 语义预留)。

**② mountain-skirt 裙板条目**(PO 亲需①连接, scene 提案逐字采纳零映射差):

    {id: 'mountain-skirt', kind: 'mountain', x1: 16, z1: 29, x2: 143, z2: 31,
     topY: 25, bands: true, reachable: true},

- 合脊预扫键 x→(x,z)(方案 a, scene 倾向案已拍板): z 域不重叠条目各归各
  ——裙板拱顶 24..25 不被主山拱高顶穿(旧 x 单键 max 会变全高墙);
  主山柱笔与单条目版逐笔全等(测试钉死=单条目逐字节不变)。
- 裙板 bands 苔段自然成立: 拱顶 25<30 → 表层 y24..25 苔 14 单段(石/雪
  段空域跳笔), 与 z28 草坡→苔过渡正是她要的「材质随山体分带」读法。
- 满填 y0 无浮空(与主山同款崖体纪律); 走廊南端 z28 h=24 ↔ 裙板 z29
  拱顶 24..25 衔接 ≤1 ✓ 攀登动线贯通。
- zero-assembly-改动的裙板不存在——本契约即派生方案, 她按 ② 逐字落
  map-core 条目即可(等本批入库后随协同波次)。

**③ iron-golem-head 蓝图**(prefab-kit 新行, PO 亲需③守卫雕像):

- place('iron-golem-head', x, y, z) 全缺省面朝 south(镇侧)。
- 体量: 基座 7×7×1 石头 3(dy0, 全插桩面)+面颅 7×7×6 石英 17(dy1..6
  实心)高 7; footprint 7×8(长鼻 dx0 dy1..4 凸出面 dz+4 一线)。
- 识别特征=轮廓: 凸鼻(远读)±眼窝两格(±2, dy4, 面侧 dz+3, 铁灰 12)
  ——7 宽颅从广场 z66+ 远读可辨傀儡头(3 格高鼻是唯一非对称凸出)。
- 苔 6 格岁月死位(顶后角×2/颊×2/顶心×2, id14)——点缀非破损。
- v 键 face|mirror|ids 同构无新开关; mirror 无视觉差(行几何 x 向对称,
  转向用 face 即可)。ids 槽位: skull/nose/eye/moss/plinth。
- 点位: 山肩 x61 一带(scene 探勘 [E]: 顶 y42, z12..20 平顶 9 线, 南向
  注视镇景视线直达); 落位后基座下埋 1-2 格插桩(dy0 全 7×7 id3 就是
  给这个用的); 走廊北端出口 z10..12 一带→山肩平顶直行即达雕像。

## 12.2 测试面(assembly ⑩ 块+T-PREFAB-10)

- assembly test/town-assembly-core.test.js ⑩ 块四 test: 缺省零变化
  (真布局走廊列无 z 单线笔)/走廊包络镜像逐点全扫(两列 ≤1 阶全扫+
  南端 24+北端 42+域外全笔与缺省版逐笔全等=两侧壁/水花列/瀑布零扰)/
  裙板合脊独立(skirt 段双单条目全等+拱顶 24..25 钉+主山逐笔全等)/
  非 bands 拼写域抛。
- prefab-kit test T-PREFAB-10: 抽格钉值(基座/实心颅/凸鼻/眼窝/苔)
  +footprint 7×8+face east 转向 spot+确定性+未知 v 键抛。
- palette 双源同形: TOWN_PALETTE.prefab 与 PALETTE_WANT 各 +1 行
  (十四行); TOWN_ROWS/townRows 清单十三行; iron-golem-head 全零旗标
  (17/3/12/14 全安全字库)。

## 12.3 取舍登记(lead 追认面)

1. **女儿墙不设**: 我初版南缘步道案带 z28 女儿墙防摔; lead 裁定走廊
   形态+摔伤问已闭(引擎无摔落伤害, voidFall 零惩罚回出生点
   adventure.js :5001)——走廊两侧列整柱拱形=崖壁凹槽天然防护,
   儿童口径达标, 女儿墙冗余撤。
2. **南缘全带步道案废弃**: 初版落了 x80..143 全南缘步道(东半跨西行
   接脊); lead 中带裁定后整案重写为走廊切崖。初版只存在于本 worktree
   工作区(未出库), 零外部可见零迁移成本。
3. **合脊键 x→(x,z)**: scene 倾向方案 a, 拍板理由=单条目逐字节不变
   (测试钉)+裙板零独立改动+「同列同线重叠取 max」语义精确化(键域
   显式化); 方案 b(新 kind/逐条目 top 覆盖)引入第二派生路径, 违反
   单源纪律, 弃。
4. **雕像材质**: 眼=铁灰 12(红眼否决——§8 去威胁红线, 守卫叙事沉稳);
   颅=石英 17「雕成」读法(雪 54 否决防雪堆混淆); 苔=14 岁月点缀;
   基座=石头 3 与山体同色。全 TOWN_PALETTE 现有字库, 零新 palette
   键值(行本身是 prefab 段第十四行)。
5. **走廊段位式分段堆叠**: 走廊列每 z 线柱笔保持 base 0..23+苔(24..30)
   /石(31..39)/雪(40..h) 分段——山体质感沿攀登动线延续, 低段踏面读
   苔色, 高段石/雪, 与山体分带同源。
6. **place 执行见证**: 现值 17(她 6413b00 同步后); scene 落位头后她
   批次自 +1=18(本批不预动, 见证 pin 归落位批次)。

## 12.4 scene 切数据清单(本批入库后随协同波次执行)

- map-core mountain-arch 条目: +southCorridor:{x1:60, x2:61},
  reachable:false→true; 其余键零动。
- map-core +mountain-skirt 条目: §12.1② 逐字落(她提案零映射差)。
- townBuildSteps 落位 iron-golem-head: 山肩 x61 一带南向(布局清单
  权限归她; 基座下埋 1-2 格)。
- 翻红清单: **无**——southCorridor/skirt 均缺省零变化设计, 既有 pin
  不翻转; 唯一注意=两键拼写真域(拼写错会抛错不是静默, 红了查字段名)。

## 12.5 涉面声明

js/town-assembly-core.js(合脊键 (x,z)+southCorridor 走廊派生+palette
行+Step G 注) · js/prefab-kit.js(+iron-golem-head 行) ·
test/town-assembly-core.test.js(⑩ 块+palette pin 四处同步) ·
test/prefab-kit.test.js(T-PREFAB-10+townRows 十三行) ·
GLOSSARY.md(PrefabKit 行表十五→十六行)。
零触碰: index.html/main.js/adventure.js/town-ui.js/town.css/light 与
scene 在途文件; scene/light 同步(6413b00/beea384)全程保真——
词表第六词 spinner 在场实证(:327), sailStatic 严格判据三处在场。

