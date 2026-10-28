# 菜单与入口 UI 设计（Menu Shell）

> 状态：活权威。描述加载屏（splash）→ 主菜单 → 各模式配置页的 UI 结构、动效与声音口径。
> 代码落点：`index.html`（结构）· `css/style.css`（桌面样式）· `css/touch.css`（触屏覆盖）·
> `js/main.js`（接线）· `js/button-icons.js`（像素图标注入）。
> 2026-10-28 首版：把 Demo 感的主菜单升级为产品门面；零新素材（像素图标全部出自既有工坊）。

## 0. 设计目标与原则

用户是 6 岁孩子（MISSION）：**图标先于文字、大点击目标、中文 TTS 兜底、零键盘依赖**。
家长是第二用户：版本号、键位说明、音量都在，但要安静。

1. **孩子第一眼就懂**：卡片=彩色像素图标徽章+模式名，扫一眼就能点；悬停 0.65s 报模式名（TTS）。
2. **一个产品一个门面**：加载屏、主菜单、模式配置页共用同一套「品牌框」——像素方块徽标、
   硬投影粗标题、MC 质感厚边按钮、统一的页脚说明条。
3. **动效克制**（训练哲学）：卡片入场一次瀑布弹入、悬停轻抬、无闪烁无循环动画
   （加载条除外，且 `prefers-reduced-motion` 时全部停用）。
4. **零新资产**：标题旁的装饰方块、卡片图标、按钮图标全部来自像素图标工坊/按钮像素图标工坊；
   背景 = 竞技场 3D 实景 + 渐变遮罩。不引字体、不加图片文件。

## 1. 入场流程（进入游戏）

```
启动 → #splash（夜空+草地像素加载屏，标题+动画进度条+提示语）
     → 全部 defer 脚本就绪，main.js init() 给 #splash 加 .done（0.45s 淡出）→ 600ms 兜底 remove
     → #overlay 显示主菜单（卡片瀑布弹入；背景已是竞技场 3D 实景 + 渐变遮罩）
```

- 加载屏文案「正在铺方块，马上就好…」与游戏语感一致；进度条为不确定式（indeterminate）
  匀速来回——脚本加载无进度事件可依，诚实做法是安抚性的动效，不是假进度。
- `init()` 淡出失败兜底：`setTimeout(600ms)` 无条件 remove（transitionend 在
  reduced-motion/旧引擎下可能不触发）。
- favicon：内联 SVG 草方块（`index.html` head，零资产；与 `grassblock` 像素方块同配色），
  标签页不再是空白页图标。

## 2. 主菜单（#menuMain）

结构（自上而下）：

| 区块 | 内容 | 要点 |
|---|---|---|
| 门面区 `.menu-hero` | 眉题「我的世界」+ 主标题「方块乐园」+ 副语「今天想去哪里玩？」 | 两侧 `.hero-art` 悬浮草方块（按钮像素图标工坊 `grassblock`，一正一镜像，缓浮动画） |
| 卡片区 `#modeCards` | 7 张 `.mode-card`（含 dev 体验馆） | grid 自适应，`minmax(230px, 320px)`；每卡：`.big` 图标徽章 + `h2` 模式名 + `small` 一句话 |
| 音量簇 `#volWrap` | 右下角浮标按钮 + 上翻面板 | id/接线不动（audio-vol-ui.js 按 id 接线），只改观感与位置 |
| 页脚 `.keys` | 键位速查 + 版本行 `.safe` | 透明度压低、单行流；版本号文本口径不变（用户靠它对版本） |

### 2.1 模式卡

- **基座**：深色面板 `rgb(15 20 28 / 82%)` + 3px 边框；像素语言的上亮下暗 inset 双影；
  圆角 16px；子元素居中。悬停（仅 `@media (hover: hover)`）：上浮 6px + 边框转模式强调色 +
  徽章图标放大 8% + 强调色柔光；按下回落。
- **强调色**（每模式一族，边框/悬停光/徽章底共用）：arena 红 `#ff7a6e` · focus 粉 `#f08a9b` ·
  math 绿 `#5abf5a` · build 金 `#e9c46a` · tank 橄榄 `#7eb45e` · adventure 深绿 `#4e9e58` ·
  showroom 紫 `#b58ae0`。类名沿用模式 id（`.mode-card.arena` 等；arena 卡补上缺的类）。
- **图标徽章 `.big`**：72px 见方内衬暗底 + 亮边内框；像素图标由 button-icons.js 注入
  （`BTN_CARD_ICON` 清单），未注入前 emoji 兜底照旧。
- **入场**：`.menu-page.active` 显示时逐卡弹入（scale 0.92→1 + 上移），nth-child 逐卡 60ms 级联；
  回主菜单每次重放（display 切换即重启动画），孩子每次回来都有「到位」感。
- **时限卡**：`.timedout` 照旧（降透明 + `.timeout-badge` 月亮徽），徽章改药丸样式。
- **可点性**：保持 `<div onclick>`（main.js buildMenu 按 id 接线）。不做键盘导航
  （MISSION：目标用户纯鼠标；登记于 §5 差异表）。

### 2.2 声音与语音

- **点击**：`sfx('click')`（既有音效键，声音清单注册表零改动）。
- **悬停报名**：桌面指针（`!IS_TOUCH`）悬停同一张卡 650ms 后 `SpeechKit.speak(模式名)`；
  移出即取消。0.65s 停留阈值把「扫过卡片」和「我想要这个」区分开——零文字依赖的
  TTS 补充（MISSION），语速音高政策归 SpeechKit，菜单不自持。

## 3. 模式配置页（menuArena / menuBuild / menuTank / menuAdventure）

- 页面容器 `.menu-page` 设 `position: relative`；返回按钮统一加 `.back-pin` 钉在左上角
  （像素左箭头已由 button-icons 注入），主按钮流仍在 `.btn-row`。
- `#overlay h1` 统一为品牌标题样式（32~36px + 硬投影），`span` 强调色沿用绿色系；
  `#overlay p` 限宽 720px、行高 1.7（探险页的长段落不再拉横幅）。
- `.keys`（各页键位说明）与主菜单页脚同款：压低透明度、小字号，家长可读、不抢孩子视线。
- 出现动效：整页 0.16s 淡入上移（比主菜单克制——Esc 暂停回来不该满屏跳动）。
- `#menuPlayTime`（时限页）加 `page-night` 类：深夜蓝渐变遮罩，h1 的 🌙 由 button-icons
  换成像素月亮（`moon` glyph 已有），文案口径不变。

## 4. 加载屏（#splash）

- 夜空渐变（`#26314e → #141b2b`）+ 底部像素草地条（亮绿帽 + 泥土身两段线性渐变，
  `::after` 伪元素，零图片）。
- 中央 `.splash-logo`（⛏️ 前缀由 button-icons 换 `grassblock` 像素方块）+ `.splash-bar`
  加载条（白色像素边框，内条来回匀速）+ `.splash-tip` 提示语。
- z-index 40 不变（高于菜单遮罩 20、低于断线层 60）。

## 5. 差异登记（刻意不做）

| 项 | 决定 | 理由 |
|---|---|---|
| Web 字体/像素字体 | 不做 | 零新资产红线；用系统粗体+硬投影逼近 MC 字感 |
| 键盘导航菜单卡 | 不做 | MISSION：6 岁纯鼠标点选；卡片保持 div onclick |
| 悬停音效 | 不做（悬停=TTS、点击=click 音） | 悬停双通道（音+语音）太吵，违背克制原则 |
| 背景改为静态图/视频 | 不做 | 竞技场 3D 实景是既有资产，是最强的「活的门面」 |
| 触屏二维卡片网格 | 触屏 media query 降为两列 | 单手/双手拇指可达宽度优先 |

## 6. 消费面速查（改菜单前先读）

- 卡片/页面/按钮 id 三元组：`js/mode-registry.js` 唯一权威，`test/mode-registry.test.js`
  对着 index.html 逐条断言——改结构别动 id。
- 像素图标注入：`js/button-icons.js` 尾部静态注入装配（模式卡 `.big`、按钮前缀 emoji、
  尾缀 ▶、门面方块、加载屏标题）。新装饰图标 = BTN_PIX 加条目 + 注入清单加一行。
- 音量面板接线：`js/audio-vol-ui.js` 按 id 找 `#volBtn/#volPanel/#volMusic(Row)/#volSfx(Row)`，
  `#menuMain` 内不可移除这些 id。
- 每日时限卡刷新：`js/main.js refreshPlayCards()` 按 `.timeout-badge` 增删。
