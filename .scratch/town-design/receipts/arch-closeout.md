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

