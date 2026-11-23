# T-C13-R4 红方证据链(红因直证落盘, conventions §7.4)

日期: 2026-11-22~23 | 分支 tc13r4(基点 d86965d=feat/campfire tip) | 红方=本票主人

## 1. 基线实测(开工第一步, 照票面门禁)

- 全量 `node .scratch/run-green.js --label tc13r4-baseline`(基点 d86965d):
  tests 2489 / pass 2487 / fail 1 / skipped 1。
- 预期口径 2489/2488/0/1 有一例出入: fail=「T11 主题换怪铺场」(adventure-mode.test.js:5393,
  西带环带出怪断言 AssertionError)。定性=负载性抖动: 该文件单跑复跑 ×2
  (.scratch/tc13r4-retest1.log / tc13r4-retest2.log)均 exit=0 全绿。
  结论: 基线成立(排除 flake 后 2489/2488/0/1), flake 如实记录在案。

## 2. 红测清单(test/effects-campfire-sheet.test.js, 8 条)

| # | 测名(截取) | 守门点(票面验收映射) |
|---|---|---|
| R4-1 | 惰性建+材质面 | 范围 1/5: 惰性建·恰一张共享 sheet·MeshBasic{map=atlasMat.map, alphaTest .5, DoubleSide, vertexColors, transparent≠true}·frustumCulled=false |
| R4-2 | 几何不变量 | §4.4: 单火 8 顶点 12 索引, 2 片 90° 交叉(4 共 z+4 共 x), 高 0.4~0.5×宽 0.35, 全顶点 ⊆ 自有格 |
| R4-3 | membership 全路径同步 | 验收 ③: open 挂/浇熄摘/重燃再挂/燃尽摘/挖掘摘, 顶点数与 fx open 格集同拍恒一张 |
| R4-4 | open=false 永不贡献 plane | 验收 ②(h 类禁令): 浇熄格/燃尽余韵格 cells() 在册(open=false)但零 plane |
| R4-5 | UV 翻页镜像 | 验收 ④: 帧窗=tileUV(74+flameFrameAt) 全幅, 帧推进换窗 74/75/76 依次, 单源一致 |
| R4-6 | 错相镜像+容量 | 验收 ①+范围 1: 50 火逐火 tile 镜像, 帧分布 ≥2 帧零齐翻, 容量翻倍仍一张 sheet 400 顶点全员在绘 |
| R4-7 | 渐弱顶点色 | 范围 4/§5.8: tint=0 恒白, tint 增大亮度单调下降 |
| R4-8 | 释放纪律 | 范围 7/验收 ②探针: clear 摘 sheet+geo/mat dispose 零残留, removeField 只摘本场, 清后再建零污染 |

守门映射补充: 验收 ⑤(烟/火星粒子路径零改动)=回执 git diff 走查面, 非机器断言
(装具无法从行为侧区分「谁没被改」); 由绿方回执 hunk 级走查自证+评审复核。

## 3. 红因直证(机械生成, 非手写)

- 最终红跑: `node .scratch/run-green.js --label tc13r4-red-final test/effects-campfire-sheet.test.js`
- 结果: tests 8 / pass 0 / fail 8 / skipped 0。
- [red-cause] 段(.scratch/tc13r4-red-final.log 尾): error_class_counts =
  {"AssertionError":8}, verdict=断言红(AssertionError=8)——恰 8 AssertionError
  零装具炸(§7.4 纯度达标)。
- 逐条红因: 全部红在「焰片 sheet 未在场/未实现」语义
  (sheetOf() 空 → 恰一张/顶点分桶/顶点色读等断言红), 与实现缺席一一对应, 无假红。
- 装具演进记录(透明): tc13r4-red.log=首跑 ReferenceError(texture-atlas 顶层引用
  config 全局块 id, CommonJS require 不可载)→改共享词法装载(texture-atlas.test.js
  loadAtlas 同惯例); tc13r4-red2.log=ERR_INVALID_ARG_TYPE(漏 vm.createContext)→修;
  tc13r4-red3/4.log=3 处 fireCount(undefined) TypeError 装具炸→助手改断言红。
  最终 red-final 达成纯断言红后才提交红线。

## 4. 红的正当性(授权链)

- UI 定稿 docs/design/campfire-visual-spec.md v1.10 §4.1(交叉动画面片+tile 74~76
  接线表)/§5.8(渐弱扩含面片)=观感权威。
- 施工方案 .scratch/campfire/tc13r-arch/tc13r-arch.md §2.1(装配图: 全场景共享单
  sheet)/§3-a(恒绘 frustumCulled=false)/§3-d(材质+alphaTest+队列口径)/§3-i(错相
  确定性·脏检)/§4(几何建议值+不变量)/§6(y-scale 自选题)=票面技术合同。
- 票册 tc13r-tickets.md R-4 段=票面本体。
- ADR-0020 尚未入册(随 R-2 在途, 票册 R-2 段明载)——本票按派令以方案 §3/票册 R-4
  为授权引用, ADR 入册后由 R-5 对账, 此处如实注明。

## 5. 红方已做的裁定(绿方派令随附)

- y-scale 渐起自选题=**不做**(方案 §6 明示「pop 已承担噗事件面, 此项可裁, 验收不
  挂」; 红测未挂; 做则徒增逐帧写顶点维度, 复杂度不成比例)。
- 焰帧 tile 映射锁「帧号 0/1/2 → tile 74+帧号」(接线表 F1 中立/F2 左倾/F3 右倾顺
  序唯一合理读法; R-1 画师已锁格号)。
- UV 窗单源=TextureAtlas.tileUV(effects 只传格号, 不复制换算公式——跨线程契约
  唯一权威)。
- 装具公共语义(绿实现必须迎合): sheet 世界顶点=position+mesh.position(mesh 无旋
  转缩放); 火的顶点归属按格包含识别; color itemSize 3/4 兼容。

## 6. 红线遵守自证(红方侧)

- 红线提交=只新增 test/effects-campfire-sheet.test.js(git show --stat 可证),
  js/ 产品面零改动; fx-core/mesh-core/texture-atlas/烟粒子路径零触碰。
