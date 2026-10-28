# iPad 5（2017 · A9 · 2GB）+ iPadOS 16.7.x Safari 渲染性能优化 · 调研报告

> 调研问题：iPad 第 5 代（A9 · 2GB RAM · 2048×1536）+ iPadOS 16.7.x 的 Safari/WKWebView 上，对 本仓库的 Three.js r128 体素游戏做设备专项性能优化，应该怎么做。
> 来源纪律：事实性论断附来源 URL 与来源性质；只有二手证据的地方明确标注；确证不了的进 §6，不冒充结论。
> 本仓库现状以源码为准：world.js:37-38（renderer 构造与初始 DPR）· main.js:260-265（adaptDpr 施加点）· main.js:303（pumpRemesh(2)）· quality-core.js（QualityCore 档位决策）· config.js:79-85（VIEW/距离环参数）· texture-atlas.js:24-26（256×256 图集）。读于 2026-10-28。
> 抓取方法：Apple/WebKit/three.js 官方页面与源码经 HTTPS 逐页抓取核对；three.js r128 源码与 WebKit 源码抓自官方 tag/主干 raw 文件；浏览器兼容数据取自 MDN browser-compat-data 原始 JSON（本次抓取日期 2026-10-28）。

## 0. 结论先行

1. **iPad 5 的系统终点就是 iPadOS 16.7.x**（iPadOS 17 起要求 iPad 6 代+/A10+，Apple 官方口径），16.7.x 是 Apple 仍在维护的安全支线：16.7.15（2026-03-11）之后还有 16.7.16（2026-05-11，截至抓取日的最新）。用户报告的 16.7.15 属实，只是已落后一个小版本；两版公开安全内容均不含渲染/内存行为变化，对性能调优无差别（§1.2）。
2. **这个设备上首要约束是内存不是算力**：WebKit 自己就把「物理内存」钳制到内核给的 jetsam 限值上（WTF/AvailableMemory.cpp 一手源码），超限不是变卡而是**整个页面进程被杀**（ jetsam per-process-limit → 白屏/重载）。Apple 不公布具体数值；不同年代的实测汇编从「整页约 1GB 级」到「JS 堆 200-450MB」都有，且随 iOS 版本在收紧。**iPad 5 档的内存预算只能按「几百 MB」设计，不能按物理 2GB 设计**（§2.1/§2.2）。
3. **GPU 路线上，真正的旋钮是 pixelRatio，不是 antialias**：GT7600 是 PowerVR Rogue TBDR 架构，Imagination 官方材料明确 4x MSAA 全程在片上按 tile 完成、带宽影响极小，且 HSR 会把不透明 overdraw 剔干净——本仓 world.js 全设备开 MSAA 的既定策略在 A9 上是站得住的。dpr=2 全屏（2048×1536 ≈ 3.15M 像素）才是填充率大头，初始 DPR 上限降到 1.5 直接省 44% 像素成本（§3.2/§3.3）。
4. **r128 在该机默认跑 WebGL2**（r118 起 WebGL2 上下文优先；Safari 15 起 WebKit 支持 WebGL2 且 WebGL 实现已迁到 Metal 之上）——项目实际获得的是较新的渲染后端，这不需要改任何代码（§3.1）。
5. **「把渲染挪进 Worker」不可行**：OffscreenCanvas 在 Safari 16.x 只支持 2D 上下文（Apple 16.4 release notes 原文 "2D-only OffscreenCanvas"；16.5/16.6 release notes 零增量），WebGL 上下文进不了 Worker。本仓的 Worker 只跑 MeshCore 网格构建（零 THREE 纯核心），设计已经天然规避了这条红线（§2.5）。
6. **省电模式（Low Power Mode）会把 rAF 压到 30fps**（WebKit bug 168837 一手），且无任何 API 可查询；这会让 QualityCore 的 45fps 降档阈值一路把 DPR 打到下限 1 并永不回升。需要「rAF 间隔 ≈33ms」特征检测来冻结降档（§2.4、建议⑥）。
7. **验收只能页内自测**：iOS Safari 没有 `performance.memory`（MDN BCD 确认 Safari 不支持），Web Inspector 远程调试要求 macOS（Apple/WebKit 官方口径），Windows 开发机没有正规远程调试路径。stats.js + `renderer.info` + `webglcontextlost` 监听 + 「异常重载」频次统计，是本仓现实的验收手段（§2.6、建议②）。
8. **不要给 iPad 5 加阴影贴图、压缩纹理**：shadowMap 现状未启用且在 A9 上是最贵的开关（整场景二次几何 pass）；压缩纹理对本仓 256×256 程序图集零收益，PVRTC 扩展还已被 Khronos 废弃（§3.4/§3.5、§5）。

---

## 1. 设备与系统基线

### 1.1 硬件规格

| 项 | 值 | 来源性质 |
| --- | --- | --- |
| SoC | A9（64 位）+ M9 协处理器 | Apple 官方规格页（一手）：<https://support.apple.com/en-us/111960> |
| GPU | PowerVR GT7600（Rogue/Series7XT，6 核、12 pixel/cycle） | 二手（Apple 从不公布 GPU 型号与核数）：Tom's Hardware iPhone 6s 评测 <https://www.tomshardware.com/reviews/apple-iphone-6s-6s-plus,4437-7.html>；Notebookcheck 规格/频率页 <https://www.notebookcheck.net/Imagination-PowerVR-GT7600-in-the-Apple-A9-Benchmarks-and-Specs.150859.0.html>（iPhone SE 汇总口径 450MHz；iPad (2017) 同 A9） |
| RAM | 2GB | 二手（Apple 规格页不列内存）：Wikipedia iPad (5th generation) <https://en.wikipedia.org/wiki/IPad_(5th_generation)>；EveryMac <https://everymac.com/systems/apple/ipad/specs/apple-ipad-9-7-inch-early-2017-wi-fi-only-specs.html> |
| 屏幕 | 9.7" Retina，2048×1536 @264ppi | Apple 官方规格页（一手），同上 111960 |
| devicePixelRatio | 2（2048×1536 物理 ÷ 1024×768 CSS 点） | 派生：Apple 屏幕规格（一手）+ MDN devicePixelRatio 定义（规范性文档）<https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio> |
| 发布/停售 | 2017-03-24 / 2018-03-27 | 二手：Wikipedia 同上 |

注意一个对本项目重要的结构性事实：iPad 5 与 iPhone 6s 同为 A9/GT7600，但屏幕是 2048×1536（≈3.15M 像素），是 6s（1334×750）的 3 倍——**同代 GPU 被要求驱动 3 倍的填充量**，这决定了 dpr 是本机第一旋钮。

### 1.2 系统支持线与 16.7.x 现状（核对用户报告的 16.7.15）

- **iPadOS 17 起不再支持 iPad 5**：Apple Newsroom 官方口径——"iPadOS 17 is available for iPad (**6th generation** and later)…"（一手：<https://www.apple.com/newsroom/2023/09/ipados-17-is-now-available/>）。即 iPad 5 的系统终点线 = iPadOS 16.7.x，与该机出现在 16.7.x 安全更新适用设备清单里互为印证（下条）。
- **16.7.x 是仍在维护的安全支线**，适用设备固定为 "iPhone 8, iPhone 8 Plus, iPhone X, **iPad 5th generation**, iPad Pro 9.7-inch, and iPad Pro 12.9-inch 1st generation"：
  - 16.7.15：2026-03-11 发布，安全内容页 <https://support.apple.com/en-us/126646>（一手，已抓取）；
  - **16.7.16：2026-05-11 发布**，安全内容页 <https://support.apple.com/en-us/127113>、Apple 安全发布总索引 <https://support.apple.com/en-us/100100>（两页均一手，已抓取；截至 2026-10-28 索引中 16.7.x 最新即 16.7.16）；
  - iPadOS 16 更新索引：<https://support.apple.com/en-us/108050>（一手）。
- **对用户报告 "16.7.15" 的核对**：属实，该版本存在且明确适配 iPad 5；只是截至 2026-10-28 已有 16.7.16。两版的公开安全内容（上列两页）均不涉及渲染/内存行为——**性能优化的结论对 16.7.15/16.7.16 一体适用**（注：Apple 安全内容页只列已披露 CVE，不排除未披露的小改动）。

### 1.3 对本项目的画像

双核 CPU（A9 Twister ×2，二手口径见上）+ TBDR GPU + 2GB 内存 + dpr2 全屏 + 只能停在 iPadOS 16.x 的 WebKit。翻译成工程约束：**CPU 时间要靠 Worker 挡（本仓已有）；GPU 时间靠 DPR 挡；内存靠「按几百 MB 预算」挡；平台特性按 Safari 16.4 特性集认知**（16.7.x 的 WebKit 包含 16.4 及之前的一切，16.5/16.6 无大功能增量，见 §2.5 的抓取核对）。

---

## 2. WebKit / iOS Safari 硬约束

### 2.1 内存上限的机制（一手源码链）

Apple 不公布 jetsam 数值，但 WebKit 是开源的，机制可以逐行核对（以下三个文件均抓自 WebKit/WebKit 主干 raw 源码）：

- **`Source/WTF/wtf/AvailableMemory.cpp`**：<https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/wtf/AvailableMemory.cpp>
  - iOS 上 `jetsamLimit()` 直接问内核要配额：读 `task_vm_info` 的 `phys_footprint + limit_bytes_remaining`；源码注释明言 "Jetsam limits can differ based on whether a process is in the foreground or the background"（并注：WebKit 进程目前前后台同限值）。
  - `computeAvailableMemory()` = `min( 物理内存, jetsamLimit() )`，查询失败回落 `availableMemoryGuess`（非手表/电视平台 = **1536MB**），再向上取整到 128MB。**即：WebKit 眼中的「可用内存」从一开始就被 jetsam 限值封顶， iPad 5 上绝不会是 2GB。**
- **`Source/WTF/wtf/MemoryPressureHandler.cpp`**：<https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/wtf/MemoryPressureHandler.cpp>
  - kill 阈值 = `baseThreshold × killThresholdFraction`；`shrinkOrDie()` 收缩失败即 `"Unable to shrink memory footprint ... below the kill threshold ... Killed"` → `m_memoryKillCallback()`。**超限的结局是被杀，不是变卡。**
- **`Source/WTF/wtf/cocoa/MemoryPressureHandlerCocoa.mm`**：<https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/wtf/cocoa/MemoryPressureHandlerCocoa.mm>
  - 内核 jetsam 事件（`DISPATCH_MEMORYPRESSURE_WARN/CRITICAL/PROC_LIMIT_WARN/PROC_LIMIT_CRITICAL`）逐一接线到 WebKit 的响应逻辑——**进程配额告警/临界是操作系统推给 WebKit 的事件，不是 WebKit 自己猜的**。
- Apple 官方侧印证：jetsam 事件报告文档定义 `per-process-limit` = "The process crossed the resident memory limit imposed by the system on all apps"，并给出 rpages × pageSize 的内存核算方法（一手，经检索快照核对原文）：<https://developer.apple.com/documentation/xcode/identifying-high-memory-use-with-jetsam-event-reports>；运行时查询配额的官方 API 是 `os_proc_available_memory()`（iOS 13+，Apple 文档：<https://developer.apple.com/documentation/os/3191911-os_proc_available_memory>；此页未逐字抓取）。

### 2.2 内存上限的数值（实测汇编，二手，全部标注性质）

一手数值不存在（Apple 不公布，页面 JS 也读不到，见 §2.6），能拿到的是不同年代、不同口径的实测：

| 来源 | 口径 | 数值 | 性质 |
| --- | --- | --- | --- |
| Catchmetrics《Deep Dive: RAM Internals in WebKit》（2026-01） | 各机型「页面可用堆」汇总表 | iPhone 6s/SE1（2GB）≈ **200-250MB**；iPhone 8/X ≈ 300-350MB；iPhone 13/14 ≈ 400-450MB | 二手（Web 性能厂商实测汇编，视频页场景）：<https://www.catchmetrics.io/blog/deep-dive-ram-internals-webkit> |
| Jeff Johnson（Lapcat，2026-01-22） | iOS 26.2 移动 Safari 页内 JS 数组撑爆测试 | iPhone SE3 ≈ **100MB**、iPad 8 ≈ **200MB** 即整页崩溃，且**无 JS 异常可捕获** | 一手实测博文（独立开发者，iOS 26 环境口径）：<https://lapcatsoftware.com/articles/2026/1/7.html> |
| EmulatorJS issue #1220 | WebGL 游戏在 iPhone（iOS 17+）的 jetsam 死亡路径 | canvas 后备存储每帧 `texSubImage2D` 累计 ≈14MB/s，WebContent 进程以 `per-process-limit` 被杀、tab 自动重载 | 二手（公开 issue 复盘）：<https://github.com/EmulatorJS/EmulatorJS/issues/1220> |

口径提示：上表分别是「JS 堆可用」「整页进程」两种不同测量面，且 iOS 各年代在收紧，**不能互相换算**；共同结论只有一个——iPad 5 这代设备的安全预算按「几百 MB」计。对本仓的可执行推论：**iPad 5 档把「页面总 footprint（含 canvas/几何/纹理后备）控制在 ~300MB 内」作为工程目标**（此目标值是本仓建议值，非引用值）；canvas/GPU 后备存储计入进程 footprint（EmulatorJS 案例即此死法），`geometry.dispose()` 的距离环卸载（GLOSSARY「距离环」词条，已有）因此不只是帧率手段，也是保命手段。

### 2.3 WebGL 能力线

- **WebGL2：Safari/iOS 15 起可用**，且 WebGL 实现同期迁到 Metal 之上——WebKit 官方博客原话 "WebKit now supports WebGL2 … the WebGL implementation now runs on top of Metal"（一手：<https://webkit.org/blog/11989/new-webkit-features-in-safari-15/>）；MDN BCD 同口径（Safari 15，已核 JSON）。iPad 5 的 16.7.x ≥ 15，**WebGL2 可用**。
- **`MAX_TEXTURE_SIZE` / `MAX_RENDERBUFFER_SIZE`**：A9 代 iOS GPU 的实测汇编普遍报 **4096**（MDN《WebGL best practices》把 4096 列为当代移动 GPU 的典型值，<https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices>；该机逐台实测值本次未取得——**页内一行自查：`gl.getParameter(gl.MAX_TEXTURE_SIZE)`**，见 §2.6）。本仓图集 256×256（texture-atlas.js:26），与任何上限都差一个数量级，此约束对本仓**不绑定**。
- **canvas 尺寸/面积上限**：canvas-size 项目实测汇编——Mobile Safari 9+：max area = **4,096×4,096（16,777,216 px）**，宽/高上限分别为 4,194,303 / 8,388,607（实测汇编项目，非官方文档：<https://github.com/jhildenbiddle/canvas-size>，结果表在其文档站 <https://jhildenbiddle.github.io/canvas-size/>，本次已抓取核对）。本仓 dpr2 全屏 canvas = 2048×1536 ≈ 3.15M px，远在限内；dpr 降到 1.5（1536×1152 ≈ 1.77M）更宽裕。注意该表测的是 2D canvas，WebGL canvas 另受 `MAX_RENDERBUFFER_SIZE` 约束（同上 4096 口径）。
- **压缩纹理扩展**：
  - `WEBGL_compressed_texture_pvrtc`（PowerVR 全系，含 A9）：扩展存在，但 Khronos 官方注册表已**标注 deprecated**，建议改用 ASTC/ETC（一手注册表页：<https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_pvrtc/>）。PVRTC 仅 WebGL1 上下文提供（WebGL2 无此扩展）。
  - `WEBGL_compressed_texture_astc`：A8 及以后 的 Apple GPU 硬件支持 ASTC LDR（gpuweb 规范讨论，权威二手：<https://github.com/gpuweb/gpuweb/issues/144>；Unity 实测佐证 A9 可用：<https://gametorrahod.com/pvrtc-vs-astc-texture-compression-on-an-ios-device>）。
  - **对本仓的结论：都不需要**。图集是程序生成的 256×256（texture-atlas.js），纹理内存本来就是 KB 级，压缩纹理的收益（省显存/带宽）在这里为零，还要引入编码工具链。详见 §5。

### 2.4 Low Power Mode 与后台节流

- **低电量模式把 `requestAnimationFrame` 压到 30fps**：WebKit bug 一手记录，标题即结论——"[iOS] Throttle requestAnimationFrame to 30fps in low power mode"（Chris Dumez，2017，含补丁）：<https://bugs.webkit.org/show_bug.cgi?id=168837>；CSS 动画同压 30fps：<https://bugs.webkit.org/show_bug.cgi?id=169138>；iOS 14 仍在的后续确认：<https://bugs.webkit.org/show_bug.cgi?id=215745>。
- **没有任何 API 能查到低电量模式状态**（社区实证 "low power mode seems to be effectively undetectable"：<https://github.com/gkjohnson/js-framerate-optimizer/issues/38>，二手）。唯一可行的页内探测是测 rAF 时间戳间隔是否持续 ≈33.3ms（同一来源的实践方向，二手）。
- **对本仓 QualityCore 的直接后果（源码推演）**：LPM 下 fps 恒 ≈30 < `DOWN_FPS:45`（quality-core.js:16）→ 每 3 秒降 0.25 档，一路降到 `MIN:1`，且 45~55 死区（quality-core.js:16-18）永不入带、永不升档。**不加防护时，LPM 用户会被「合法地」降到最糊档并钉死**。对策见建议⑥。
- **后台/熄屏**：页面不可见即停止 rAF 渲染回调（HTML 规范 animation frames 一节，规范性文档：<https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames>；MDN Page Visibility API：<https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API>）。本仓已有两层兜底：`dt>0.05` 钳制吞掉回前台的时间跳变（main.js:271），pagehide 关页存档兜底（WorldJournal，GLOSSARY 词条）。**无需新增动作**，仅登记为约束。

### 2.5 OffscreenCanvas：Safari 16.x 只有 2D——「渲染进 Worker」不可行

- Safari 16.4（2023-03）加入 OffscreenCanvas，Apple 官方 release notes 原文："**Added support for 2D-only OffscreenCanvas.**"（一手：<https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes>）；WebKit 官方博客同批宣布（Worker 内渲染的定位描述）：<https://webkit.org/blog/13966/webkit-features-in-safari-16-4/>。
- **16.x 支线此后无增量**：Safari 16.5 / 16.6 release notes 全文检索 "OffscreenCanvas" 零命中（两页均已抓取：<https://developer.apple.com/documentation/safari-release-notes/safari-16_5-release-notes> 、 <https://developer.apple.com/documentation/safari-release-notes/safari-16_6-release-notes>）。16.7.x 的 WebKit 即 16.4 特性集 + 安全修复，**WebGL 上下文在 OffscreenCanvas/Worker 里不可用**（后续哪个 Safari 版本补上未查证，与本档设备无关，见 §6）。
- 对本仓：主渲染循环**不能**搬进 Worker，也不必搬——本仓 Worker（http 主路径）只跑 MeshCore 顶点生成（零 THREE 纯核心，GLOSSARY「网格化核心」词条），主线程只做「收数组 → 挂 BufferGeometry → render」，这已经是 iPad 5 双核 CPU 下正确的分工。

### 2.6 测量手段：Windows 开发机的现实边界与页内自测方案

- **没有 `performance.memory`**：MDN BCD 确认 Safari/Safari iOS 从未支持（Chrome 系专属，已核 JSON；MDN 页：<https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory>）。iOS Safari 上也没有任何等价内存 API——内存压力只能靠**行为信号**间接观测。
- **远程调试要求 macOS**：设备端开启 Web Inspector 后，设备出现在「已连接 Mac 的 Safari Develop 菜单」里（Apple 官方：<https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios>；WebKit 官方：<https://webkit.org/web-inspector/enabling-web-inspector/>）。Windows 机器不在任何官方路径里，第三方代理工具（ios-webkit-debug-proxy 一类）年代久远且不可靠（二手口碑，不建议投入）。
- **本仓现实的页内自测清单**（建议落点见 ②）：
  1. **帧率**：本仓已有半秒 fps 采样（main.js:324-326）——调试期把它常显到 HUD 或挂 [stats.js](https://github.com/mrdoob/stats.js)（mrdoob 官方 FPS 表）。
  2. **draw call / 三角形 / 显存估算**：`renderer.info.render.calls`、`renderer.info.render.triangles`、`renderer.info.memory`（three.js 官方文档 WebGLRenderer.info：<https://threejs.org/docs/#api/en/renderers/WebGLRenderer.info>）。每秒采样一次打日志，iPad 5 档调 VIEW 参数（建议④）就靠它验收。
  3. **上下文丢失**：`renderer.domElement` 上监听 `webglcontextlost`/`webglcontextrestored`（MDN：<https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event>）。iOS 上 context lost 的常见诱因正是内存压力/GPU 资源回收（§2.2），**这个事件是 iPad 5 上最便宜的「内存红线报警器」**。r128 内部已监听同事件并 `preventDefault()`（§3.1），但只在 console 打日志——恢复 UX 要项目自己做。
  4. **LPM 探测**：连续采样 rAF 间隔 ≈33.3ms（§2.4，二手实践）。
  5. **GL 参数自查**：`gl.getParameter(gl.MAX_TEXTURE_SIZE / gl.MAX_RENDERBUFFER_SIZE)` + `gl.getSupportedExtensions()`（含 pvrtc/astc 探测），一次埋点、永久受益（在真机上补齐 §6 的待实测项）。
  6. **异常重载检测**： jetsam 杀进程的表现是整页静默重载——`sessionStorage` 记时间戳，启动时发现「无操作刷新」即计数，作为内存压力的代理指标（工程做法，本仓建议，无引用）。

---

## 3. Three.js r128 针对性核查（对照 r128 官方源码/发布注记）

以下 r128 源码引用均抓自官方 tag：<https://raw.githubusercontent.com/mrdoob/three.js/r128/src/renderers/WebGLRenderer.js>（另注：本仓 lib/three.min.js 头部 `REVISION=128` 与官方 r128 同版）。

### 3.1 渲染器上下文：WebGL2 优先、contextlost 已内置、powerPreference 只是透传

- **WebGL2 优先**：r128 建上下文的候选序是 `[ 'webgl2', 'webgl', 'experimental-webgl' ]`（源码 L213），r118 起默认如此（官方 release note："Create WebGL 2 context by default. #19620…"，<https://github.com/mrdoob/three.js/releases/tag/r118>）。**iPadOS 16.7 上本仓实际拿到 WebGL2 + Metal 后端**，无需任何代码。
- **上下文丢失**：r128 在创建上下文**之前**就注册了 `webglcontextlost`/`webglcontextrestored` 监听（源码 L208-209，注释明言 "event listeners must be registered before WebGL context is created, see #12753"）；`onContextLost` 做的是 `preventDefault()` + console 日志 + 置位（r128 不向业务层转发该事件），`onContextRestore` 复位内部状态。**结论：r128 自身能从 context loss 中恢复渲染状态，但「提示用户/统计埋点」要项目自己在 `renderer.domElement` 上加监听**（建议②③）。
- **powerPreference**：r128 只是把它原样透传进 `getContext` 属性（源码 L64、L202）。它是 WebGL 规范里的性能**提示**（MDN：<https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getContextAttributes>）；WebKit 在 iOS 上如何处置没有任何一手文档，且 iOS 双 GPU 切换的场景不存在——**不要把它当优化手段**（world.js:37 现有 `'high-performance'` 写法无害，保留即可）。其余上下文属性（`antialias` 等）同样在此透传（§3.2）。

### 3.2 antialias（MSAA）在 PowerVR TBDR 上的真实代价：相对便宜

- Imagination 官方架构文档：TBDR 按 tile 渲染、读写都在片上缓冲完成，且 HSR（隐藏面消除）"allow overdraw to be removed **entirely** for completely opaque renders"（官方文档站：<https://docs.imgtec.com/starter-guides/powervr-architecture/html/topics/tile-based-deferred-rendering-index.html>；官方 SDK《PowerVR Hardware Architecture Overview for Developers》同口径：<http://powervr-graphics.github.io/WebGL_SDK/WebGL_SDK/Documentation/Architecture%20Guides/PowerVR%20Hardware.Architecture%20Overview%20for%20Developers.pdf>）。
- Imagination 官方培训材料（2012，镜像转载）关于 MSAA 的原话："**4x MSAA performed completely on-chip, per-tile … Minimal impact on memory bandwidth**"，子样本由 ISP 逐个做 HSR、最后合成单像素写回：<https://imgtec.eetrend.com/sites/imgtec.eetrend.com/files/download/201402/1458-2110-1385011428.pdf>（厂商一手材料，镜像站转载）。
- **结论**：GT7600 上 MSAA 的增量成本主要是「采样 ×4 的片上处理」，不是传统 IMR 上那种成倍的显存带宽——本仓 world.js:32-35 头注释「MSAA 恰好只平滑几何边缘、对体素画风收益最大，全设备开启」的既定策略**与 A9 架构事实一致，iPad 5 档不必关**。两点保留：① 「便宜」指带宽/处理，WebGL 层的 MSAA 是否组织成显式多重采样缓冲（影响显存占用）在 WebKit/ANGLE-Metal 路径上未确证（§6）；② 若实测降到 DPR=1 仍 <45fps，关 antialias 是最后手段（代价是细线高亮框的锯齿，world.js 头注释同款权衡）。

### 3.3 pixelRatio 2 的填充率成本（量级算术，自行推导）

- dpr=2 全屏：2048×1536 = **3,145,728 px/帧**；60fps 下不透明 1x 覆盖即 ≥ **188.7M px/s**，几何边缘处 MSAA 4x 还要 ×4 采样；再叠加半透明（水/玻璃/特效）的混合带宽。
- dpr=1.5：1536×1152 = **1,769,472 px/帧（56.2%）**——单点省 **44%**；dpr=1.0：786,432 px（25%）。
- GT7600 理论吞吐 ~12 px/cycle × ~450MHz ≈ 5.4G px/s（二手规格推导，§1.1；实际效率受 shader/带宽约束远低于理论值）。量级结论：全屏 dpr2 + MSAA + 特效 overdraw 已接近该 GPU 的舒适区边界，**dpr 是唯一「一次改动、全局线性减负」的旋钮**。帧缓冲量级参考（自算估算）：dpr2 下 4xMSAA 帧后备 ≈ 百 MB 级，dpr1.5 ≈ 六成——在 §2.2 的几百 MB 总预算里占比可观。
- 本仓施加路径已就绪：初始值在 world.js:38（`setPixelRatio(Math.min(devicePixelRatio, 2))`），运行期换档在 main.js:260-265（`QualityCore.step` → `renderer.setPixelRatio(next)`），60 帧 pacing 锁在 main.js:255（`FRAME_MIN=16.4`，对 30fps 的 LPM 节奏无冲突：33ms 间隔 > 16.4ms 阈值，每帧放行）。

### 3.4 阴影贴图：现状为零，保持为零

- 全仓检索 `shadowMap/castShadow/receiveShadow` 零命中——**本项目当前没有任何阴影贴图**，光照走「顶点光烘焙（light-core → MeshCore）+ 平行光」路线（GLOSSARY「光照核心/网格化核心」词条）。
- r128 的 WebGLShadowMap 机制 = 第二个相机把整场景重画进深度贴图 + 逐片元 PCF 采样（three.js 官方文档：<https://threejs.org/docs/#api/en/renderers/WebGLRenderer.shadowMap>）。在 A9 上这是「几何 pass 翻倍 + 全屏采样开销」的高回归风险开关，TBDR 的片上优化救不了第二个 pass 的顶点成本。**iPad 5 档不做阴影；将来要立体感应走现有的顶点光/贴图路线**（§5）。

### 3.5 draw call / InstancedMesh / 纹理图集

- **draw call 现状已是合并几何**：每 chunk 少数几条合并 BufferGeometry（MeshCore 四通道输出），对象级视锥剔除默认开启（r128 `Object3D.frustumCulled=true`，源码：<https://raw.githubusercontent.com/mrdoob/three.js/r128/src/core/Object3D.js>），加上距离环三档（world.js:492 `maintainRings`），GPU 对象数按环面积封顶（config VIEW 注释）。**基线健康，无需引入新机制**；调优抓手是环半径参数（建议④）与 `renderer.info.render.calls` 实测（§2.6）。
- **InstancedMesh：r128 可用但本仓无用武之地**：r128 源码在 <https://raw.githubusercontent.com/mrdoob/three.js/r128/src/objects/InstancedMesh.js>（已抓取，`class InstancedMesh extends Mesh`），r109 引入（官方 release note "InstancedMesh — Added new class. #17505"：<https://github.com/mrdoob/three.js/releases/tag/r109>）。它解决「同一几何海量重复」——对已经合并成 chunk 网格的体素世界无收益；仅当未来出现草丛/火把一类的海量小物时再评估。
- **纹理图集已是最优形态**：256×256 单图集（texture-atlas.js:24-26 注释 "256: 正方形 2 的幂"）+ TNT 竖排小图集（config.js:89 `TNT_TILES=4`）+ NearestFilter 像素观感（world.js:97 天体贴图即此口径）。纹理内存 KB 级、单次上传、无逐帧更新——iPad 5 上**不是瓶颈，也不需要压缩纹理**（§2.3/§5）。唯一登记在案的反面教材是「逐帧重绘 canvas 贴图」（GLOSSARY「头顶血条」词条已注明是移动端掉帧源，现实现已惰性重绘）。

### 3.6 fog + far plane：已到位

world.js:45-48：雾（VIEW.fogNear/fogFar = 90/230）即渲染边界，`camera.far = 240` 已收紧到雾终点+余量——这正是本仓 docs/chunk-streaming-lod-research.md §4.4 的结论落地后的现状。**无动作**；iPad 5 档进一步收 fogFar/环半径属于参数题（建议④），不是新机制。

---

## 4. 对照本项目的落地建议（按 预期收益/成本 排序）

> 只给建议不改代码。每条注明：落点文件/模块 · 预期代价 · 依据（指向本文章节）。

### ① 触屏初始 DPR 上限降到 1.5（收益：最大 · 成本：一行）

- **落点**：`js/world.js:37-38`。把 `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` 的触屏分支上限从 2 改为 1.5（如 `Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2)`，或经 config 加常量），并同步更新该处「触屏按帧率证据自适应回落」注释。
- **为什么有效**：像素成本 −44%（§3.3），帧后备显存同步 −44%（§3.3 估算），是唯一全局线性减负的单点。
- **机制兼容性（要先想清楚再动手）**：`QualityCore.mk(dprMax)` 以「初始 DPR」同时定档与上限（quality-core.js:26 `dpr = dprMax = floor(dpr/0.25)*0.25`，main.js:262 用 `renderer.getPixelRatio()` 建）——初始 1.5 意味着**本场自适应永远不会再爬回 2.0**。对儿童设备这是「稳字优先」的可接受语义；若要「起步 1.5、允许回升 2.0」需要改 quality-core 的 mk 语义，不建议（纯核心现有行为有单测锚定）。
- **预期代价**：Retina 上文字/UI 不受影响（DOM 层），3D 画面清晰度小幅下降；QualityCore 仍可继续降到 1.0/1.25。
- **依据**：§1.1（dpr2/3.15M px）、§3.3、§2.2（显存预算）。

### ② 页内验收测量件（收益：是③④⑥的前提 · 成本：小）

- **落点**：`js/main.js`（或调试缝新件）。加载 stats.js 或复用现成 fps 采样常显；每秒采一次 `renderer.info`（calls/triangles/memory）打日志；`renderer.domElement` 挂 `webglcontextlost/restored` 监听做计数；`sessionStorage` 异常重载检测（§2.6 清单）。
- **预期代价**：几十行调试代码 + 一点 HUD 空间；建议挂 `location.search` 开关，默认关闭。
- **依据**：§2.6（Windows 无远程调试、无 performance.memory——这是唯一验收路径）。

### ③ contextlost 恢复 UX（收益：防「白屏疑云」· 成本：小）

- **落点**：`js/main.js`（全局层）或 `js/world.js`（渲染 adapter）。监听 `webglcontextlost` → 弹儿童可懂的提示条（"内存紧张，正在恢复…点此继续/刷新"），`webglcontextrestored` → 依赖 r128 自身状态复位（§3.1），必要时重建场景/回主菜单。
- **为什么值得**：iOS 上 context lost 是 jetsam/内存压力的前兆信号（§2.1/§2.2），且 iOS 16.6 时代曾有 WebGL context lost 回归报告（Unity 论坛，二手：<https://discussions.unity.com/t/webgl-context-lost-ios-17-safari/930432?page=2>；16.7.x 是否完全免除未确证）——没有 UX 时用户只会看到闪白屏。
- **预期代价**：一个提示条 + 两个监听。
- **依据**：§2.2、§2.6-3、§3.1。

### ④ iPad 5 档 VIEW/环参数收紧（收益：中 · 成本：参数，但须先实测）

- **落点**：`js/config.js:79-85`（VIEW）——候选：`fullChunks: 8→6`、`lodChunks: 15→10`（GPU 对象/draw call 数约按 πr² 降到四成级）；`fogNear/fogFar/far` 不动（观感边界不变，只收「构建/驻留半径」）；`lodStep: 2` 保持。
- **前置条件**：先用 ② 的 `renderer.info.render.calls` 实测——若 calls 本来就低（视锥剔除吃掉了大部分），此项收益有限，不必动。
- **预期代价**：远景 LOD 粗网格更早出现（体素风可接受，GLOSSARY「距离环」口径）。
- **依据**：§3.5、§2.2（驻留几何也是内存）。

### ⑤ 保持网格 Worker 的 http 主路径（收益：iPad 5 帧率稳定性的底盘 · 成本：零代码，运营纪律）

- **落点**：无需改动；`pumpRemesh(2)`（main.js:303）+ MeshCore 双路复用现状即正确。
- **要点**：iPad 5 是双核 A9——file:// 直开（Worker 不可用 → 同步兜底分帧建网格）在这种 CPU 上会把建场卡成幻灯片。**iPad 5 场景必须走 server.js 的 http 访问**（Worker 同源合法性与降级链路见 chunk-streaming-lod 调研 §5.4/§5.5）。
- **依据**：§1.3、§2.5（Worker 只装得下 mesh 构建，渲染进不去——现状分工正好合法）。

### ⑥ LPM（低电量模式）降档冻结（收益：防误降档 · 成本：小）

- **落点**：`js/main.js:260-265`（adaptDpr 前置一个检测，不动 quality-core.js 的纯核心）。连续 2-3 个半秒采样测得 rAF 间隔 ≈33.3ms → 判定 LPM → **停止给 QualityCore 喂采样**（冻结当前档位），间隔恢复 ≈16.7ms 再恢复喂。
- **为什么**：LPM 把 rAF 钉在 30fps（§2.4），30 < 45 会让 QualityCore 合法地把 DPR 一路降到 1 且永不回升——把「系统级省电」误诊为「设备带不动」，白牺牲清晰度。
- **预期代价**：十几行；检测依据是二手实践（无官方 API，§2.4），应做成保守判定（连续多帧才触发、单次误判无害）。
- **依据**：§2.4、quality-core.js 阈值。

---

## 5. 不建议做 / 无效手段

1. **OffscreenCanvas 渲染 Worker 化**——Safari 16.x 仅 2D 上下文，`getContext('webgl')` 在该设备 Worker 里拿不到（§2.5，一手 release notes）。做了也是白做。
2. **开启 shadowMap 阴影**——现状为零且 A9 上是最贵开关（几何 pass 翻倍 + 全屏采样，§3.4）；要立体感走现有顶点光/贴图烘焙路线。
3. **压缩纹理（PVRTC/ASTC/ETC2）**——图集 256×256 程序生成，纹理内存 KB 级，压缩零收益；PVRTC 扩展已被 Khronos 废弃（§2.3），ASTC 引入编码工具链纯属成本。唯一例外：未来若引入大尺寸外部贴图素材，再按 §2.3 的能力线评估。
4. **依赖 `performance.memory` / 电池 API / LPM 查询 API**——Safari 全都没有（§2.4/§2.6）；任何「读内存做降级」的设计在该设备上无法实现，只能靠行为信号（②⑥）。
5. **用 UA 识别 iPad/做设备分档**——iPadOS 起 Safari 默认以 Mac 形态 UA 呈现（"iPad will now present itself to websites as a Mac"，Apple WWDC19 官方：<https://developer.apple.com/videos/play/wwdc2019/203>；UA 字符串实录：<https://nielsleenheer.com/articles/2025/the-user-agent-string-of-safari-on-ios-26-and-macos-26>，二手）。设备判定必须走 `maxTouchPoints` 路径——本仓 `IS_TOUCH`（config.js:18-21，`maxTouchPoints > 0`）在 iPad 桌面形态 UA 下依然成立，现状正确。
6. **把 `powerPreference` 当性能手段**——r128 只透传，WebKit 行为无一手文档，iOS 单 GPU 无意义（§3.1）。
7. **在 Windows 上找 Safari 远程调试**——官方路径只有 macOS（§2.6）；别为它搭第三方工具链，投入产出不成比例。
8. **贸然全局关 antialias**——与 world.js 既定策略和 TBDR 架构事实相悖（§3.2）；仅当 DPR=1.0 仍持续 <45fps 时作为最后手段单独评估（届时再权衡细线高亮框的锯齿代价）。
9. **指望升级 16.7.16 改善性能**——安全支线，公开安全内容不含渲染/内存行为变化（§1.2）。
10. **SharedArrayBuffer 共享世界数据**——局域网 IP 的 http 非 secure context，构造器被隐藏（chunk-streaming-lod 调研 §5.4 已否决，维持）；transferable postMessage 已够用。

---

## 6. 未确证事项

| 项 | 状态 | 说明 |
| --- | --- | --- |
| iPad 5 + iPadOS 16.7 的 WebContent 进程 jetsam 精确限值 | 无法一手确证 | Apple 不公布；页面 JS 无内存 API。机制已一手核实（§2.1），数值只能按 §2.6 的页内手段实测逼近。工程上按「几百 MB 预算」设计即可不依赖该数值 |
| 该机 `MAX_TEXTURE_SIZE` / `MAX_RENDERBUFFER_SIZE` 实测值 | 待页内自查 | A9 代 4096 为实测汇编/MDN typical 口径（§2.3）；对本仓不绑定（图集 256px），但值得在 ② 埋点时顺手读出 |
| `antialias:true` 在 WebKit（ANGLE-on-Metal）下的 MSAA 缓冲组织方式 | 未确证 | 影响 §3.3 显存估算的精度，不影响「降 DPR 优先于关 MSAA」的方向 |
| GT7600 在 iPad 5 上的实际时钟 | 二手 | 450MHz 为 iPhone SE 汇总口径（Notebookcheck）；Apple/Imagination 均未公布，仅用于 §3.3 的量级推导 |
| OffscreenCanvas 的 WebGL 支持最终落在哪个 Safari 版本 | 未查证 | 与 16.7.x 无关（16.x 全系已证只有 2D，§2.5）；仅影响未来换设备时的重新评估 |
| iOS 16.6 时代的 WebGL context lost 回归在 16.7.x 是否完全修复 | 二手 | Unity 论坛报告（§建议③）；正是 ③ 的监听不可省的原因之一 |
| 16.7.x 在 16.7.16（2026-05-11）之后是否还有更新 | 动态事实 | 截至 2026-10-28 抓取 Apple 安全发布索引无后续条目；不预测未来 |
| Lapcat/catchmetrics 的 iOS 26 实测数值是否适用于 iOS 16.7 | 不假设适用 | iOS 版本差异大，仅作「收紧方向」的定性参考；iPad 5 的 16.7 老内核只会更宽松，但预算口径不变 |

---

## 附：来源索引（本次实际抓取/核对过的页面）

**Apple 官方（一手）**：
- [iPad (5th generation) 技术规格](https://support.apple.com/en-us/111960) · [iPadOS 17 is now available（设备兼容口径）](https://www.apple.com/newsroom/2023/09/ipados-17-is-now-available/)
- [Apple 安全发布索引](https://support.apple.com/en-us/100100) · [iOS 16.7.15 安全内容](https://support.apple.com/en-us/126646) · [iOS 16.7.16 安全内容](https://support.apple.com/en-us/127113) · [iOS 16 更新索引](https://support.apple.com/en-us/101566) · [iPadOS 16 更新索引](https://support.apple.com/en-us/108050)
- [jetsam 事件报告（per-process-limit 定义）](https://developer.apple.com/documentation/xcode/identifying-high-memory-use-with-jetsam-event-reports) · [Safari 16.4 Release Notes（"2D-only OffscreenCanvas"）](https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes) · [Safari 16.5 Release Notes](https://developer.apple.com/documentation/safari-release-notes/safari-16_5-release-notes) · [Safari 16.6 Release Notes](https://developer.apple.com/documentation/safari-release-notes/safari-16_6-release-notes)
- [Inspecting iOS and iPadOS（Web Inspector 需连接 Mac）](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios) · [WWDC19：Desktop-class Browsing on iPad（iPad 呈现 Mac UA）](https://developer.apple.com/videos/play/wwdc2019/203)

**WebKit 官方（一手）**：
- 源码：[WTF/wtf/AvailableMemory.cpp（jetsamLimit/computeAvailableMemory）](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/wtf/AvailableMemory.cpp) · [WTF/wtf/MemoryPressureHandler.cpp（shrinkOrDie/kill 阈值）](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/wtf/MemoryPressureHandler.cpp) · [WTF/wtf/cocoa/MemoryPressureHandlerCocoa.mm（jetsam 事件接线）](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/wtf/cocoa/MemoryPressureHandlerCocoa.mm)
- 博客/bug：[New WebKit Features in Safari 15（WebGL2 + Metal 后端）](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/) · [WebKit Features in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/) · [bug 168837（LPM 压 rAF 至 30fps）](https://bugs.webkit.org/show_bug.cgi?id=168837) · [bug 169138（CSS 动画同压）](https://bugs.webkit.org/show_bug.cgi?id=169138) · [bug 215745（iOS 14 仍在）](https://bugs.webkit.org/show_bug.cgi?id=215745) · [Enabling Web Inspector](https://webkit.org/web-inspector/enabling-web-inspector/)

**three.js 官方（一手）**：
- r128 源码：[WebGLRenderer.js](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/renderers/WebGLRenderer.js)（webgl2 优先 L213 / contextlost 监听 L208-209 / powerPreference 透传 L64·L202）· [InstancedMesh.js](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/objects/InstancedMesh.js) · [Object3D.js](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/core/Object3D.js)
- 发布注记：[r118（WebGL2 默认）](https://github.com/mrdoob/three.js/releases/tag/r118) · [r109（InstancedMesh 引入）](https://github.com/mrdoob/three.js/releases/tag/r109) · 文档：[WebGLRenderer.info](https://threejs.org/docs/#api/en/renderers/WebGLRenderer.info) · [WebGLRenderer.shadowMap](https://threejs.org/docs/#api/en/renderers/WebGLRenderer.shadowMap) · 工具：[stats.js](https://github.com/mrdoob/stats.js)

**规范/兼容数据**：
- [WHATWG HTML：Animation frames（隐藏页停 rAF）](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames) · [Khronos WebGL 扩展注册表：WEBGL_compressed_texture_pvrtc（deprecated）](https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_pvrtc/)
- MDN（规范性文档 + BCD JSON 已核）：[devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) · [Performance.memory（Safari 不支持）](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory) · [webglcontextlost 事件](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event) · [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) · [WebGL best practices（纹理尺寸典型值）](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) · [getContextAttributes（powerPreference 语义）](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getContextAttributes)

**厂商文档（GPU 架构一手）**：
- [Imagination：Tile-Based Deferred Rendering 官方文档](https://docs.imgtec.com/starter-guides/powervr-architecture/html/topics/tile-based-deferred-rendering-index.html) · [PowerVR Hardware Architecture Overview for Developers（官方 SDK 文档）](http://powervr-graphics.github.io/WebGL_SDK/WebGL_SDK/Documentation/Architecture%20Guides/PowerVR%20Hardware.Architecture%20Overview%20for%20Developers.pdf) · [Imagination 官方培训材料：4x MSAA on-chip（镜像转载 PDF）](https://imgtec.eetrend.com/sites/imgtec.eetrend.com/files/download/201402/1458-2110-1385011428.pdf)

**实测汇编 / 社区（二手，均已标注）**：
- [canvas-size（canvas 尺寸/面积实测汇编，Mobile Safari 9+ max area 4096×4096）](https://github.com/jhildenbiddle/canvas-size) · [结果表（文档站）](https://jhildenbiddle.github.io/canvas-size/)
- [Catchmetrics: Deep Dive RAM Internals in WebKit（机型堆内存汇总）](https://www.catchmetrics.io/blog/deep-dive-ram-internals-webkit) · [Jeff Johnson（Lapcat）：Mobile Safari 页面内存实测（iOS 26.2）](https://lapcatsoftware.com/articles/2026/1/7.html) · [EmulatorJS issue #1220（WebContent jetsam 死亡路径复盘）](https://github.com/EmulatorJS/EmulatorJS/issues/1220)
- [Tom's Hardware：iPhone 6s 评测（GT7600 6 核 / 12 px/cycle）](https://www.tomshardware.com/reviews/apple-iphone-6s-6s-plus,4437-7.html) · [Notebookcheck：GT7600 规格（频率）](https://www.notebookcheck.net/Imagination-PowerVR-GT7600-in-the-Apple-A9-Benchmarks-and-Specs.150859.0.html) · [Wikipedia：iPad (5th generation)（2GB RAM / 当前系统 16.7.16）](https://en.wikipedia.org/wiki/IPad_(5th_generation)) · [EveryMac：iPad 5 规格（2GB RAM）](https://everymac.com/systems/apple/ipad/specs/apple-ipad-9-7-inch-early-2017-wi-fi-only-specs.html)
- [gpuweb issue #144（Metal 上 ASTC A8+/PVRTC 仅 iOS）](https://github.com/gpuweb/gpuweb/issues/144) · [PVRTC vs ASTC 在 iOS 的实测（A9 支持 ASTC）](https://gametorrahod.com/pvrtc-vs-astc-texture-compression-on-an-ios-device) · [js-framerate-optimizer issue #38（LPM 无 API 可查）](https://github.com/gkjohnson/js-framerate-optimizer/issues/38) · [Niels Leenheer：iPadOS Safari UA 字符串实录](https://nielsleenheer.com/articles/2025/the-user-agent-string-of-safari-on-ios-26-and-macos-26) · [Unity 论坛：iOS 16.6 时代 WebGL context lost 回归报告](https://discussions.unity.com/t/webgl-context-lost-ios-17-safari/930432?page=2)
