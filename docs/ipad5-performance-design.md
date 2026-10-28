# iPad 5（A9 · iPadOS 16.7）性能优化 · 设计定稿

> 依据：[ipad5-performance-research.md](ipad5-performance-research.md)（2026-10-28，一手来源调研）。
> 范围：调研 §4 建议 ①②③⑥ 的落地；④（VIEW 环收紧）随后落地为低核档专属（§0 表⑤ · §7）。
> 首要约束（用户拍板 2026-10-28）：**机队全设备零回归**——每条改动的触发条件必须严格
> 窄于"现状已出问题的设备"；不满足窄化条件的方案（如一刀切触屏 DPR≤1.5，会误伤
> 有能力跑 dpr2 的现代触屏设备）不出设计。

## 0. 决策总表

| 票 | 内容 | 触发条件（=影响面） | 触发外设备 |
|---|---|---|---|
| ① | 低核触屏初始 DPR 上限 1.5 | 触屏 且 `hardwareConcurrency`≤2 | 行为逐字节同现状 |
| ② | `?perf=1` 页内性能 HUD | URL 显式带 `?perf=1` | tick 早退零成本 |
| ③ | GL 上下文丢失提示条+计数 | `webglcontextlost` 发生（原表现=白屏疑云） | 零行为变化 |
| ④ | LPM 降档冻结守卫 | 连续 60 帧间隔紧带 31.5~36ms | 守卫永不锁存=不变 |
| ⑤ | 低核档 VIEW 环收紧（full 8→6 · lod 15→10） | 同票①判据（触屏 且 ≤2 逻辑核） | 桌面/强触屏保持 8/15 |

## 1. 票①：低核触屏分档（IS_LOWCORE_TOUCH）

- **判据**：`IS_TOUCH && navigator.hardwareConcurrency ∈ (0, 2]`（config.js，与
  IS_TOUCH 同款防御式 IIFE；API 缺失/读取异常 → 不分档保持现状）。Safari iOS
  15.4+ 已支持该 API（caniuse 已核，目标机 16.7 必有）；A9 = 2 逻辑核（调研
  §1.1 拆解口径）。只认硬件信号不读 UA——iPad 桌面形态 UA 呈 Mac（调研 §5-5）。
- **施加**：world.js 初始 `setPixelRatio(Math.min(devicePixelRatio,
  IS_LOWCORE_TOUCH ? LOWCORE_DPR_MAX : 2))`，`LOWCORE_DPR_MAX = 1.5` 在 config.js。
- **封顶 vs 爬升的取舍**：mk 语义=初始即本场封顶。备选"起步 1.5、允许证据爬回
  2.0"被否：iPad 5 在 dpr1.5 下大概率能撑 60fps → 每次会话都白付一轮
  "升到 2.0 → 帧率崩 → 观察窗封顶"的卡顿参观（观察窗封顶不跨会话记忆），
  目标设备天天付这个代价，与"稳字优先"相悖。硬封顶：开场即稳定，档内仍可
  自适应回落 1.25/1.0（调研 §4① 同判）。
- **零回归论证**：桌面（非触屏）分支不动；强触屏（>2 核）不动；无 API 老浏览器
  不动。误伤面 = 触屏且 ≤2 核 = 目标机型本身（小屏 A9 iPhone 若访问，dpr1.5
  观感略软——非目标设备，可接受）。`?touch=1` 桌面强制预览下同样生效，
  顺带成为低核档的桌面预览口。

## 2. 票②：性能观测件（PerfKit，js/perf-kit.js）

- **默认关闭**：`?perf=1` 显式开启（?dev=1/?touch=1 同款防御式读取）；未开启时
  init 空转、tick 一行早退，零 DOM 零定时器（boot 冒烟安全）。
- **HUD（1Hz 一行）**：fps / 当前 DPR（低核档标记）/ renderer.info（calls/
  triangles/geometries/textures）/ LPM 锁存态 / contextlost 计数 / 疑似击杀
  重载计数 / 逻辑核数 / MAX_TEXTURE_SIZE + MAX_RENDERBUFFER_SIZE（调研 §6
  页内自查项本机落地）。
- **击杀代理**：3s 心跳写 sessionStorage；启动时"上一跳 <15s 新鲜 且 无 pagehide
  干净旗标" → 判定上一会话被整页静默重载（jetsam/崩溃特征）→ 计数累计。
  代理指标非精确值，只作内存压力的方向信号。
- **数据来源**全部只读复用既有顶层绑定（fps/lpmOn/glLostCount/renderer），
  不另持影子状态。

## 3. 票③：GL 上下文丢失 UX（main.js）

- renderer.domElement 挂 `webglcontextlost`/`webglcontextrestored`。lost：计数
  （glLostCount，PerfKit 读）+ 儿童话术提示条（runtimeErr 同款内联样式先例）+
  TTS 安抚；restored：收条 + toast「画面回来啦」。
- **不碰恢复机制本身**：r128 已注册同款监听并 preventDefault+自复位渲染状态
  （调研 §3.1）；CanvasTexture 图集源画布在内存中，恢复后自动重传。若恢复
  迟迟不来（罕见），提示条已含"刷新这一页"的人话指引。
- **零回归**：事件不发生 = 行为零变化；发生时从"白屏疑云"变"有话术"——纯增强。

## 4. 票④：LPM（低电量模式）降档冻结（QualityCore.mkLpmGuard + main.js 接线）

- **问题**：WebKit 在低电量模式把 rAF 钉在 30fps 且无查询 API（调研 §2.4）——
  30 < DOWN_FPS(45) 会让降档逻辑"合法地"把 DPR 打到下限 1.0，且 45~55 死区
  永不积累升档证据 = 钉死最糊档。
- **守卫**（quality-core.js 纯状态机，不碰既有 mk/step，既有 7 测零改动锚定）：
  吃主循环每帧原始 rAF 间隔（毫秒，钳制前）。锁存 = 连续 60 帧全部落在
  [31.5, 36]ms（30fps 下约 2 秒）；解锁 = 锁存期间出现任一 <31.5ms 快帧
  （60fps 回来了）；单发慢帧（>36ms）不解锁（LPM 仍在，只是调度 hiccup）；
  解锁后证据清零重攒。
- **区分度论证**：LPM 的间隔是紧带 33.3±2ms；负载型 30fps 是快慢帧宽抖动——
  连续 2 秒全落紧带实际不发生。用原始间隔而非半秒 fps 聚合值（聚合值 29~31
  区分不了 LPM 与负载），就是为了这点区分度。
- **时序安全**：锁存需 2 秒 < 降档需 3 秒连续低帧采样——开场即 LPM 时锁存先于
  首次降档；中途开 LPM 最多多降一档然后冻结（此前积累的低帧证据本来就该降）。
- **接线**：main.js `lpmOn` 顶层绑定（PerfKit 读，conventions §2.1 跨文件读先例）；
  loop 钳制前喂 guard；adaptDpr 锁存期直接 return。桌面 lpmGuard=null 不参与。
- **误锁存的代价方向** = 不降档（保守，不伤害）；真·稳定 30fps 负载设备被冻结
  是可接受的假阳性（该场景下降档收益本就存疑）。

## 5. 明确不做（调研 §5 全单照办）

阴影贴图 / 压缩纹理 / OffscreenCanvas 渲染 Worker 化 / UA 设备分档 /
powerPreference 调优 / performance.memory 类内存读取 / Windows 上找 Safari 远程
调试 / 贸然关 antialias / 指望 16.7.16 改善性能 / SharedArrayBuffer。另：渲染进
Worker 在 Safari 16.x 不可行（仅 2D OffscreenCanvas，调研 §2.5），现有
"Worker 只跑 MeshCore 网格构建"分工保持；iPad 5 场景必须走 http 主路径
（file:// 同步兜底在双核 A9 上建场卡死，运营纪律非代码）。

## 6. 测试与验收

- **单测**（test/quality-core.test.js 新增 4 测）：60 帧锁存边界（59 不锁/60 锁）/
  60fps 与宽抖动流永不锁存 / 锁存滞回（慢帧不解锁·快帧解锁·清零重攒）/
  紧带边界（31.5/36 含，31.4/36.1 排除且打断连击）。
- **boot 冒烟**：perf-kit.js 进 index.html 列表，未启用路径零副作用。
- **真机验收**（iPad 5 + http 主路径）：`?perf=1` 看 fps 稳 55+（dpr1.5 档）、
  ctxLost=0、kills 不增长；开低电量模式玩 5 分钟 → LPM=ON 且 dpr 不下滑；
  桌面 + 强触屏回归各一轮，行为与现状无差异。

## 7. 后续票（本轮不做）

- **调研④ VIEW 环收紧——已落地（2026-10-28 用户拍板）**：低核档专属，判据同票①
  （config.js VIEW 的 `fullChunks: IS_LOWCORE_TOUCH ? 6 : 8` · `lodChunks: 10 : 15`，
  雾/lodStep/dispatch 不动；桌面与强触屏零回归）。收益=驻留几何/显存按环面积收缩
  + 环外区块提前卸载；观感代价=粗网格更早出现（雾 90 格起浓，全细节边界 96 格，
  感知有限）。真机若仍见 fps 掉档，再按 ② 的 calls 数据评估下一步旋钮。
- 16.7.x 若再有安全更新（调研 §6 动态事实），本设计结论不受影响（安全支线
  无渲染/内存行为变化）。
