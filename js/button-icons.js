'use strict';
/* ============================================================
   按钮像素图标工坊 (ButtonIcons) — 应用层·图标资源
   ------------------------------------------------------------
   全游戏按钮/面板 chrome 图标的唯一工坊: 16×16 手绘字符画(与像素
   图标工坊同款画法, 字符查表上色, '.'=透明) → 关平滑放大 64×64 →
   dataURL。替换全部按钮 emoji(各平台渲染不可控, 观感业余); 语义与
   视觉语言对照 Minecraft 一手来源逐条调研, 见
   docs/mc-button-icons-research.md(版权口径 D13: 只取语义与观感
   语言, 全部程序自绘, 零外部素材)。
   委托而非复画: 物品系按钮(镐/苹果/砖…)直接走 itemIcon 同一来源,
   坦克/苦力怕/鬼村长复用 tankIcon/Mobs.face/chiefFace —— 图形单一
   权威, 不做第二份像素画。
   画法约定(MC 观感语言): 白色 glyph 配近黑 1px 描边, 左上亮/右下暗
   (光源恒在左上); 彩色图标沿用本仓物品色板(木/铁/金/火/叶)。
   interface: btnIcon(name)→dataURL|'' · btnImg(name, cls)→img HTML
     · BTN_PIX(字符画数据表) · BTN_CARD_ICON(模式卡图标键表)
   依赖(均经全局名, 调用期解析): icons.js 的 drawArt/pixToURL64/
     ITEM_PIX/itemIcon/tankIcon(加载序在本文件之前) · mobs.js 的
     Mobs.face 与 focus-icons.js 的 chiefFace(跨库委托, 未加载返 '') ·
     mode-registry.js 的 ModeRegistry(静态注入按注册表驱动)
   可测性: DOM 惰性创建, Node 单测注入 canvas 桩
     (test/button-icons.test.js); 字符画数据段零依赖可直接断言。
   ============================================================ */

/* ---------- 字符画工具: 镜像/旋转/叠层(一套基画派生方向变体) ---------- */
const mirrorX = (art) => art.map((row) => [...row].reverse().join(''));
/* 顺时针 90°: 新行 i = 旧列 15-i 自上而下 — 上箭头转出右箭头 */
const rotCW = (art) => art[0].split('').map((_, i) =>
  art.map((row) => row[row.length - 1 - i]).join(''));
/* 叠层: a 有像素用 a, 空位透出 b(交叉剑 = 单剑 ⊕ 镜像单剑) */
const overlayArt = (a, b) => a.map((row, y) =>
  [...row].map((c, x) => (c !== '.' ? c : b[y][x])).join(''));

/* ---------- glyph 通用色板(白色按钮 glyph + 近黑描边) ---------- */
const BTN_GLYPH = {K: '#14161a', W: '#ffffff', L: '#eef1f5', G: '#c3c9d2'};

/* ---------- 方向箭头基画(上, 纯箭头): 左/右经几何派生; ---------- */
const ARROW_UP_ART = [
  '................',
  '......KKKK......',
  '.....KLWWGK.....',
  '....KLWWWWGK....',
  '...KLWWWWWWGK...',
  '..KLWWWWWWWWGK..',
  '.KLWWWWWWWWWWGK.',
  '.KKKKKWWWWKKKKK.',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KGGGGK.....',
  '......KKKK......',
  '................',
];

/* ---------- 跳跃(上箭头+地面线 — MC 基岩触屏跳跃键口径, 官方不画鞋/弹簧) ---------- */
const JUMP_ART = [
  '................',
  '......KKKK......',
  '.....KLWWGK.....',
  '....KLWWWWGK....',
  '...KLWWWWWWGK...',
  '..KLWWWWWWWWGK..',
  '.KLWWWWWWWWWWGK.',
  '.KKKKKWWWWKKKKK.',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KGGGGK.....',
  '.KKKKKKKKKKKKK..',
  '.KWWWWWWWWWWWK..',
  '.KKKKKKKKKKKKK..',
];

/* ---------- 下降(镜像下箭头+顶线 — 飞行下降键, 跳跃的镜像) ---------- */
const DESCEND_ART = [
  '.KKKKKKKKKKKKK..',
  '.KWWWWWWWWWWWK..',
  '.KKKKKKKKKKKKK..',
  '................',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.....KLWWGK.....',
  '.KKKKKWWWWKKKKK.',
  '.KLWWWWWWWWWWGK.',
  '..KLWWWWWWWWGK..',
  '...KLWWWWWWGK...',
  '....KLWWWWGK....',
  '.....KLWWGK.....',
  '......KKKK......',
];

/* ---------- 暂停(双竖条, 触屏顶栏) ---------- */
const PAUSE_ART = [
  '................',
  '................',
  '................',
  '...KKKK..KKKK...',
  '...KLWK..KLWK...',
  '...KLWK..KLWK...',
  '...KLWK..KLWK...',
  '...KLWK..KLWK...',
  '...KLWK..KLWK...',
  '...KLWK..KLWK...',
  '...KLWK..KLWK...',
  '...KLWK..KLWK...',
  '...KGGK..KGGK...',
  '...KKKK..KKKK...',
  '................',
  '................',
];

/* ---------- 关闭 ✕(面板角标) ---------- */
const CLOSE_ART = [
  '................',
  '..KK........KK..',
  '.KWWK......KWWK.',
  '.KWWWK....KWWWK.',
  '..KWWWK..KWWWK..',
  '...KWWWKKWWWK...',
  '....KWWWWWWK....',
  '.....KWWWWK.....',
  '.....KWWWWK.....',
  '....KWWWWWWK....',
  '...KWWWKKWWWK...',
  '..KWWWK..KWWWK..',
  '.KWWWK....KWWWK.',
  '.KWWK......KWWK.',
  '..KK........KK..',
  '................',
];

/* ---------- 视角切换(立方体线框 — MC 官方口径: 透视键画方块线框, 不画相机) ---------- */
const CAM_ART = [
  '................',
  '.......WW.......',
  '......W..W......',
  '.....W....W.....',
  '...WW......WW...',
  '...W.W....W.W...',
  '...W..W..W..W...',
  '...W...WW...W...',
  '...W...WW...W...',
  '...W...WW...W...',
  '...WW..WW..WW...',
  '.....W.WW.W.....',
  '......WWWW......',
  '.......WW.......',
  '................',
  '................',
];

/* ---------- 播放三角 ▶(出发/继续按钮尾缀) ---------- */
const PLAY_ART = [
  '................',
  '................',
  '................',
  '................',
  '....KK..........',
  '....KWWK........',
  '....KWWWK.......',
  '....KWWWWK......',
  '....KWWWWWK.....',
  '....KWWWWWK.....',
  '....KWWWWK......',
  '....KWWWK.......',
  '....KWWK........',
  '....KK..........',
  '................',
  '................',
];

/* ---------- 音乐音符 ♫(音量面板, 金色 — MC 唱片机/音符方块色) ---------- */
const NOTE_ART = [
  '................',
  '................',
  '................',
  '..KKKKKKKKKKKK..',
  '.KWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '..KWWK....KWWK..',
  '..KWWK....KWWK..',
  '..KWWK....KWWK..',
  '.KKWWKK..KKWWKK.',
  '.KYYYK....KYYYK.',
  '.KYYYK....KYYYK.',
  '.KyyyK....KyyyK.',
  '..KKK......KKK..',
  '................',
  '................',
];

/* ---------- 铃铛(音效滑杆行, 金色) ---------- */
const BELL_ART = [
  '................',
  '................',
  '................',
  '.......KK.......',
  '......KlYK......',
  '......KYYK......',
  '.....KYYYYK.....',
  '....KYyYYYK.....',
  '...KYYyyYYYK....',
  '..KYYYyyYYYYK...',
  '.KYYYYYyyYYYYYK.',
  '.KKKKKKKKKKKKKK.',
  '......KyyK......',
  '.......KK.......',
  '................',
  '................',
];

/* ---------- 小屋(回家按钮/建造场景卡 — 红顶木墙) ---------- */
const HOUSE_ART = [
  '................',
  '................',
  '.......KK.......',
  '......KRrK......',
  '.....KRRrrK.....',
  '....KRRRRrrK....',
  '...KRRRRRRrrK...',
  '..KRRRRRRRRrrK..',
  '.KRRRRRRRRRRrrK.',
  '.KKKKKKKKKKKKKK.',
  '..KPPPPDDPPPPK..',
  '..KPPPPDDPPPPK..',
  '..KPpPPDDPPPpK..',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
];

/* ---------- 挂锁(家长入口, 铁质) ---------- */
const LOCK_ART = [
  '................',
  '................',
  '................',
  '.....KKKKK......',
  '....KK...KK.....',
  '....KK...KK.....',
  '...KKKKKKKKKK...',
  '...KIIIIIIIIK...',
  '...KIIIIIIIIK...',
  '...KIIIKKIIIK...',
  '...KIIIKKIIIK...',
  '...KIIIIIIIIK...',
  '...KiiiiiiiiK...',
  '...KKKKKKKKKK...',
  '................',
  '................',
];

/* ---------- 柱状图(我的进步, 绿色升势 — MC 经验条绿) ---------- */
const CHART_ART = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '...........KLLK.',
  '...........KGGK.',
  '...........KGGK.',
  '...........KGGK.',
  '......KLLK.KGGK.',
  '......KGGK.KGGK.',
  '......KGGK.KGGK.',
  '.KLLK.KGGK.KGGK.',
  '.KGGK.KGGK.KGGK.',
  '................',
  '................',
];

/* ---------- 文档页(CSV 导出, 白纸灰线) ---------- */
const DOC_ART = [
  '................',
  '................',
  '...KKKKKKKKK....',
  '..KWWWWWWWWWK...',
  '..KWgggggggWK...',
  '..KWWWWWWWWWK...',
  '..KWgggggggWK...',
  '..KWWWWWWWWWK...',
  '..KWgggggggWK...',
  '..KWWWWWWWWWK...',
  '..KWgggggWWWK...',
  '..KWWWWWWWWWK...',
  '..KKKKKKKKKKK...',
  '................',
  '................',
  '................',
];

/* ---------- 物品栏格 2×2(背包语义 — MC 背包=格子) ---------- */
const GRID_ART = [
  '................',
  '................',
  '................',
  '..KKKKK..KKKKK..',
  '..K###K..K###K..',
  '..K###K..K###K..',
  '..KKKKK..KKKKK..',
  '................',
  '..KKKKK..KKKKK..',
  '..K###K..K###K..',
  '..K###K..K###K..',
  '..KKKKK..KKKKK..',
  '................',
  '................',
  '................',
  '................',
];

/* ---------- 火焰(今日体检/熔炉火, 火把焰色板) ---------- */
const FLAME_ART = [
  '................',
  '................',
  '.......f........',
  '......fff.......',
  '.....f222f......',
  '.....f2332f.....',
  '....f223332f....',
  '....f2233332f...',
  '...f22233332f...',
  '...f22333332f...',
  '...f22233332f...',
  '....f2233332f...',
  '.....f22332f....',
  '......f22f......',
  '.......ff.......',
  '................',
];

/* ---------- 翅膀(飞行开关 — MC 鞘翅观感) ---------- */
const FLY_ART = [
  '................',
  '................',
  '................',
  '..KK............',
  '.KWWK...........',
  '.KWWWK..........',
  '.KWWWWK.........',
  '.KWWWWWK........',
  '.KWWWWWWK.......',
  '..KWWWWWWK......',
  '...KWWWWWWK.....',
  '....KWWWWWWK....',
  '.....KWWWWWK....',
  '......KWWWK.....',
  '.......KK.......',
  '................',
];

/* ---------- 爆炸星芒(开炮按钮 — 黄橙星爆) ---------- */
const BOOM_ART = [
  '................',
  '................',
  '.......yy.......',
  '.......yy.......',
  '..yy..yyyy..yy..',
  '...yyyyYYyyyy...',
  '....yYYYYYYy....',
  '.yyyyYYYYYYyyyy.',
  '.y..yYYWWYYy..y.',
  '.yyyyYYYYYYyyyy.',
  '....yYYYYYYy....',
  '...yyyyYYyyyy...',
  '..yy..yyyy..yy..',
  '.......yy.......',
  '.......yy.......',
  '................',
];

/* ---------- 火箭(出发/部署 — MC 烟花火箭观感) ---------- */
const ROCKET_ART = [
  '................',
  '................',
  '.......KK.......',
  '......KRRK......',
  '......KRRK......',
  '.....KWWWWK.....',
  '.....KWWWWK.....',
  '.....KLWWWK.....',
  '.....KLWWWK.....',
  '.....KWWWWK.....',
  '....KRWWWWRK....',
  '...KR.KWWK.RK...',
  '...K..KGGK..K...',
  '......yGGy......',
  '....y..GG..y....',
  '................',
];

/* ---------- 太阳/月亮(昼夜时段 HUD 图标, 昼夜循环 D1 — 太阳=暖黄方块、
      月亮=灰白方块带缺口, 色板与 world.js 日月天体贴图同源) ---------- */
const SUN_ART = [
  '................',
  '................',
  '..yyyyyyyyyyyy..',
  '..yYYYYYYYYYYy..',
  '..yYYYYYYYYYYy..',
  '..yYYYYYYYYYYy..',
  '..yYYYYWWYYYYy..',
  '..yYYYWWWWYYYy..',
  '..yYYYWWWWYYYy..',
  '..yYYYYWWYYYYy..',
  '..yYYYYYYYYYYy..',
  '..yYYYYYYYYYYy..',
  '..yyyyyyyyyyyy..',
  '................',
  '................',
  '................',
];
const MOON_ART = [
  '................',
  '................',
  '..MMMMMM........',
  '..MMMMMMMM......',
  '..MMMMMMMMMM....',
  '..MMMMMMMMMMMm..',
  '..MMMMMMMMMMMm..',
  '..MMMMMMMMMMMm..',
  '..MMMMMMMMMMMm..',
  '..MMMMMMMMMMMm..',
  '..MMMMMMMMMMMm..',
  '..MMMMMMMMMMMm..',
  '..MMMMMMMMMMMm..',
  '..mmmmmmmmmmmm..',
  '................',
  '................',
];

/* ---------- 整理(一键归位 — 物品归槽: 三块散物落回槽位条, 调研稿建议
   的"物品归槽"语义, MC 无官方对应(trash=丢弃不是整理)) ---------- */
const SORT_ART = [
  '................',
  '................',
  '..KKK.....KKK...',
  '..KAK.....KBK...',
  '..KKK.....KKK...',
  '................',
  '.......KKK......',
  '.......KCK......',
  '.......KKK......',
  '................',
  '.KKKK.KKKK.KKKK.',
  '.K##K.K##K.K##K.',
  '.KKKK.KKKK.KKKK.',
  '................',
  '................',
  '................',
];

/* ---------- 装箱(自动放入 — 下箭头入箱) ---------- */
const AUTOFILL_ART = [
  '................',
  '................',
  '................',
  '......KKKK......',
  '.....KWWWWK.....',
  '....KWWWWWWK....',
  '....KKKWWKKK....',
  '......KWWK......',
  '......KWWK......',
  '......KGGK......',
  '................',
  '..KddddddddddK..',
  '..KddddddddddK..',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
];

/* ---------- 心形(mkHpBar 头顶血条左标 — MC 红心口径: 无描边三色,
   主红 #FF1313 · 右下暗 #BB1313 · 左上单像素高光 #FFC8C8, JE/BE 同源) ---------- */
const HEART_ART = [
  '................',
  '................',
  '................',
  '..RRRR..RRRR....',
  '.RWRRRRRRRRRD...',
  '.RRRRRRRRRRRD...',
  '.RRRRRRRRRRDD...',
  '..RRRRRRRRRD....',
  '...RRRRRRRD.....',
  '....RRRRDD......',
  '.....RRD........',
  '......R.........',
  '................',
  '................',
  '................',
  '................',
];

/* ---------- 脑(专注训练营卡 — 粉色脑回沟) ---------- */
const BRAIN_ART = [
  '................',
  '................',
  '................',
  '....KKKKKKK.....',
  '..KKPlPPPPPKK...',
  '.KPPllPPPPpPPK..',
  '.KPlPKKPPPPpPK..',
  'KPPpKPPPPKPPpPK.',
  'KPPlKPPPPKPPpPK.',
  'KPPpKPPpPPKPPpPK',
  '.KPPKPPpPPKPPK..',
  '.KPPPPpppPPPPK..',
  '..KKPPPPPPPKK...',
  '....KKKKKKK.....',
  '................',
  '................',
];

/* ---------- 锤(建造模式卡 — 铁头木柄) ---------- */
const HAMMER_ART = [
  '................',
  '................',
  '....KKKKKKK.....',
  '...KIlIIIIIK....',
  '...KIIIIIiIK....',
  '...KIIIIIiIK....',
  '..KKKKKKKKKKK...',
  '.....KhwK.......',
  '.....KhwK.......',
  '.....KhwK.......',
  '.....KhwK.......',
  '.....KhwK.......',
  '.....KhwK.......',
  '.....KKKK.......',
  '................',
  '................',
];

/* ---------- 传送门涡(下界卡/出发 — 紫涡白芯) ---------- */
const PORTAL_ART = [
  '................',
  '................',
  '......pppp......',
  '....ppPPPPpp....',
  '...pPPPPPPPPp...',
  '..pPPPmmmmPPPp..',
  '..pPPmmWWmmPPp..',
  '.pPPPmmWWmmPPPp.',
  '.pPPPPmmmmPPPPp.',
  '..pPPPPPPPPPPp..',
  '...pPPPPPPPPp...',
  '....ppPPPPpp....',
  '......pppp......',
  '................',
  '................',
  '................',
];

/* ---------- 松树(探险模式卡 — 三层塔冠) ---------- */
const TREE_ART = [
  '................',
  '................',
  '......ggg.......',
  '.....ggggg......',
  '....gGggggg.....',
  '.....ggggg......',
  '....ggggggg.....',
  '...ggGgggggg....',
  '.....ggggg......',
  '...ggggggggg....',
  '..ggGgggggggg...',
  '......tttt......',
  '......tttt......',
  '.....tttttt.....',
  '................',
  '................',
];

/* ---------- 地下室入口(建造场景卡 — 石框暗廊 + 下行台阶) ---------- */
const BASEMENT_ART = [
  '................',
  '................',
  '................',
  '.SSSSSSSSSSSSSS.',
  '.SKKKKKKKKKKKKS.',
  '.SKLLLKKKKKKKKS.',
  '.SKKKKLLLKKKKKS.',
  '.SKKKKKKKLLLKKS.',
  '.SKKKKKKKKKKLLS.',
  '.SKKKKKKKKKKKKS.',
  '.SSSSSSSSSSSSSS.',
  '................',
  '................',
  '................',
  '................',
  '................',
];

/* ---------- 方块阶梯(数学冒险岛卡 — 1/2/3 递增的草方块塔, "数一数"语义;
     像素全部自绘, 版权口径 D13(只取语义与观感语言, 见 docs/mc-button-icons-research.md)) ---------- */
const STEPS_ART = [
  '................',
  '................',
  '................',
  '...........KKKK.',
  '...........KGGK.',
  '...........KggK.',
  '......KKKK.KKKK.',
  '......KGGK.KGGK.',
  '......KggK.KggK.',
  '.KKKK.KKKK.KKKK.',
  '.KGGK.KGGK.KGGK.',
  '.KggK.KggK.KggK.',
  '.KKKK.KKKK.KKKK.',
  '................',
  '................',
  '................',
];

/* ---------- 烧瓶(体验馆卡 — 锥形瓶绿液起泡, 调试/试验语义; 像素全部自绘,
      版权口径 D13, 与 tree 同绿系沿用仓内物品色板) ---------- */
const FLASK_ART = [
  '................',
  '......KKKK......',
  '......KWWK......',
  '......KWWK......',
  '......KWWK......',
  '......KWWK......',
  '.....KLWWWK.....',
  '....KLWWWWWK....',
  '...KLWWWWWWWK...',
  '..KLWWWWWWWWWK..',
  '..KWGGGGGGGGWK..',
  '.KWggggggggggWK.',
  '.KWgggGggGgggWK.',
  '.KWggggggggggWK.',
  '.KKKKKKKKKKKKKK.',
  '................',
];

/* ---------- 派生: 左右箭头(纯箭头基画几何派生防手抖; 跳跃/下降因带
   地面线/顶线, 各自手绘不参与旋转派生) ---------- */
const ARROW_RIGHT_ART = rotCW(ARROW_UP_ART);
const ARROW_LEFT_ART = mirrorX(ARROW_RIGHT_ART);

/* ---------- 交叉剑(竞技场卡 = 物品工坊单剑字符画 ⊕ 其镜像, 色板同源) ---------- */
const SWORDS_ART = overlayArt(SWORD_ART, mirrorX(SWORD_ART));

/* ------------------------------------------------------------
   BTN_PIX 字符画数据表 — 键集=全游戏按钮图标清单(test 防错网:
   消费端 icon/btnImg 字面量必须 ⊆ 此处键集)
   ------------------------------------------------------------ */
const BTN_PIX = {
  /* 方向与播放 */
  left: {art: ARROW_LEFT_ART, map: BTN_GLYPH},
  right: {art: ARROW_RIGHT_ART, map: BTN_GLYPH},
  jump: {art: JUMP_ART, map: BTN_GLYPH},
  down: {art: DESCEND_ART, map: BTN_GLYPH},
  play: {art: PLAY_ART, map: BTN_GLYPH},
  pause: {art: PAUSE_ART, map: BTN_GLYPH},
  close: {art: CLOSE_ART, map: BTN_GLYPH},
  cam: {art: CAM_ART, map: {W: '#ffffff'}},
  /* 菜单与面板 */
  note: {art: NOTE_ART, map: {...BTN_GLYPH, Y: '#f0c53a', y: '#c79a22'}},
  bell: {art: BELL_ART, map: {K: '#14161a', Y: '#f0c53a', l: '#f8e08a', y: '#c79a22'}},
  house: {art: HOUSE_ART, map: {K: '#14161a', R: '#b5533c', r: '#8f3a2a', P: '#b1804f', p: '#7d5432', D: '#5d3f21'}},
  lock: {art: LOCK_ART, map: {K: '#14161a', I: '#b0b7c0', i: '#8a9198'}},
  chart: {art: CHART_ART, map: {K: '#14161a', G: '#58c14e', L: '#8ce07e'}},
  doc: {art: DOC_ART, map: {K: '#14161a', W: '#ffffff', g: '#9aa3ad'}},
  grid: {art: GRID_ART, map: {'K': '#14161a', '#': '#3a4149'}},
  sort: {art: SORT_ART, map: {'K': '#14161a', 'A': '#c9a06b', 'B': '#8a8f98', 'C': '#d83a2e', '#': '#3a4149'}},
  autofill: {art: AUTOFILL_ART, map: {...BTN_GLYPH, d: '#3a4149'}},
  heart: {art: HEART_ART, map: {R: '#ff1313', W: '#ffc8c8', D: '#bb1313'}},
  /* 功能动作 */
  flame: {art: FLAME_ART, map: {f: '#e8632c', 2: '#ff9d2e', 3: '#ffd83d'}},
  fly: {art: FLY_ART, map: BTN_GLYPH},
  boom: {art: BOOM_ART, map: {y: '#ff9d2e', Y: '#ffd83d', W: '#ffffff'}},
  rocket: {art: ROCKET_ART, map: {K: '#14161a', R: '#d0342c', W: '#ffffff', L: '#eef1f5', G: '#8a8f98', y: '#ffd83d'}},
  sun: {art: SUN_ART, map: {y: '#f2b93b', Y: '#ffdf6b', W: '#fff3b0'}}, /* 昼夜时段 HUD(探险, D1) */
  moon: {art: MOON_ART, map: {M: '#e6eaf2', m: '#b9c2d4'}},
  swords: {art: SWORDS_ART, map: null}, /* 色板经委托装配(见下, 与物品工坊剑同源) */
  /* 模式卡 */
  brain: {art: BRAIN_ART, map: {K: '#14161a', P: '#f08a9b', l: '#ffb8c4', p: '#c05a6e'}},
  hammer: {art: HAMMER_ART, map: {K: '#14161a', I: '#b0b7c0', l: '#d8dde4', i: '#8a9198', h: '#a0703c', w: '#7a5228'}},
  portal: {art: PORTAL_ART, map: {p: '#5a1f8f', P: '#8a3fd4', m: '#6a2ba8', W: '#e8d5ff'}},
  tree: {art: TREE_ART, map: {g: '#3f8f3f', G: '#5abf5a', t: '#7d5730'}},
  basement: {art: BASEMENT_ART, map: {S: '#8a8f98', L: '#c8cdd4', K: '#14161a'}},
  steps: {art: STEPS_ART, map: {K: '#14161a', G: '#5abf5a', g: '#3f8f3f'}}, /* 数学冒险岛卡(草方块阶梯, 与 tree 同绿系) */
  flask: {art: FLASK_ART, map: {...BTN_GLYPH, g: '#3f8f3f', G: '#5abf5a'}}, /* 体验馆卡(锥形瓶绿液; G 覆写为亮绿=液面/气泡) */
};

/* 交叉剑色板: 与物品工坊铁剑同源(字符画直接 ⊕ 自那里, 色板也一并) */
BTN_PIX.swords.map = ITEM_PIX.sword_iron.map;

/* 委托表: 复用既有图标库, 单一像素来源不二画(未加载的库返 '' 静默) */
const BTN_DELEGATE = {
  pick: () => itemIcon('pick_iron'), /* 主动作键(挖/打): 铁镐 */
  sword: () => itemIcon('sword_iron'), /* 下界攻击键: 铁剑 */
  shovel: () => itemIcon('shovel_iron'), /* 智能主动作·铲子态: 建造/竞技场挖掘入口 */
  apple: () => itemIcon('apple'), /* 配方书·食物页签 */
  brick: () => itemIcon('brick'), /* 配方书·方块页签 */
  table: () => itemIcon('craft_table'), /* 工作台站点徽标 */
  furnace: () => itemIcon('furnace'), /* 熔炉站点徽标/标题 */
  chest: () => itemIcon('chest'), /* 宝物柜/宝箱面板 */
  tank: () => tankIcon(), /* 坦克(载具工坊同源) */
  creeper: () => (typeof Mobs !== 'undefined' && Mobs.face) ? Mobs.face('creeper') : '', /* 选怪物 */
  devil: () => (typeof chiefFace !== 'undefined') ? chiefFace('devil') : '', /* 魔鬼特训(鬼村长) */
};

/* ---------- 渲染与出口 ---------- */

/* 按钮图标缓存 — 同名只画一次 */
const BTN_ICON_CACHE = {};

/* 按钮图标统一出口: 手绘返 dataURL; 委托库未加载/未知名返 ''(调用方自决兜底) */
function btnIcon(name) {
  if (Object.prototype.hasOwnProperty.call(BTN_ICON_CACHE, name)) {
    return BTN_ICON_CACHE[name];
  }
  let url = '';
  if (BTN_DELEGATE[name]) {
    url = BTN_DELEGATE[name]() || '';
  } else if (BTN_PIX[name] && BTN_PIX[name].map) {
    const small = document.createElement('canvas');
    small.width = small.height = 16;
    drawArt(small.getContext('2d'), BTN_PIX[name].art, BTN_PIX[name].map);
    url = pixToURL64(small);
  }
  BTN_ICON_CACHE[name] = url;
  return url;
}

/* img HTML 片段(按钮 innerHTML 直拼); cls 缺省 'bi' — CSS 按钮图标统一钩子 */
function btnImg(name, cls) {
  const url = btnIcon(name);
  return url ? '<img class="' + (cls || 'bi') + '" alt="" draggable="false" src="' + url + '">' : '';
}

/* ---------- 静态 DOM 注入(index.html 保留 emoji 文案兜底, 加载后换像素图标) ----------
   纪律同 icons.js 入口卡装配: 本段只按 id/选择器换装, 不重建含接线的
   元素(滑杆行的 input 监听在 audio-vol-ui.js 早已挂上, 只做"文本节点
   前插图 + 去 emoji"的手术, 不动子元素)。 */
const BTN_CARD_ICON = {arena: 'swords', focus: 'brain', math: 'steps', build: 'hammer',
  tank: 'tank', nether: 'portal', adventure: 'tree', showroom: 'flask'};

/* 首个文本节点的 emoji 前缀 → 像素图(保留中文文案; 无 emoji 则原样) */
function btnSwapLeadEmoji(el, key) {
  if (!el) return;
  const url = btnIcon(key);
  if (!url) return;
  for (const node of el.childNodes) {
    if (node.nodeType !== 3) continue;
    const t = node.nodeValue;
    /* 前缀=符号区/增补区字符(箭头·杂项·emoji), 中文与拉丁不匹配 */
    const lead = t.match(/^\s*(?:[\u2100-\u2BFF\uFE0F]|[\uD800-\uDBFF][\uDC00-\uDFFF])\s?/);
    if (!lead) return;
    const img = document.createElement('img');
    img.alt = ''; img.draggable = false; img.className = 'bi'; img.src = url;
    el.insertBefore(img, node);
    node.nodeValue = t.slice(lead[0].length);
    return;
  }
}

/* 尾缀几何三角 ▶(U+25B6) → 像素播放三角 */
function btnSwapTrailPlay(el) {
  if (!el) return;
  const url = btnIcon('play');
  if (!url) return;
  for (const node of el.childNodes) {
    if (node.nodeType !== 3) continue;
    const t = node.nodeValue;
    const trail = t.match(/\s*[\u25A0-\u25FF]\s*$/);
    if (!trail) return;
    node.nodeValue = t.slice(0, trail.index);
    const img = document.createElement('img');
    img.alt = ''; img.draggable = false; img.className = 'bi'; img.src = url;
    el.appendChild(img);
    return;
  }
}

(function() {/* 静态注入装配(boot 前独立执行; DOM 缺失时静默跳过) */
  if (typeof document === 'undefined' || !document.querySelector) return;
  const q = (s) => document.querySelector(s);
  /* 模式卡: 清单走模式注册表(唯一权威), 漏配键保持原 emoji */
  if (typeof ModeRegistry !== 'undefined') {
    for (const m of ModeRegistry.all) {
      const key = BTN_CARD_ICON[m.id];
      const big = q('#' + ModeRegistry.cardId(m) + ' .big');
      if (key && big && btnIcon(key)) {
        big.innerHTML = '<img alt="' + m.name + '" draggable="false" src="' + btnIcon(key) + '">';
      }
    }
  }
  /* 按钮 emoji 前缀 → 像素图标(文案保留) */
  [['#volBtn', 'note'],
    ['#arenaBackBtn', 'left'], ['#buildBackBtn', 'left'], ['#tankBackBtn', 'left'],
    ['#netherBackBtn', 'left'], ['#adventureBackBtn', 'left'],
    ['#tankGoBtn', 'rocket'], ['#netherEnterBtn', 'portal'], ['#adventureEnterBtn', 'tree'],
    ['#playTimeHomeBtn', 'house'], ['#pkGo', 'rocket'], ['#pkClose', 'close'],
    ['.pk-title', 'creeper'],
    ['#volMusicRow', 'note'], ['#volSfxRow', 'bell'],
    ['#tankPickTitle', 'tank'], ['#mobPickTitle', 'creeper'],
  ].forEach(([sel, key]) => btnSwapLeadEmoji(q(sel), key));
  /* 尾缀 ▶ → 像素三角 */
  ['#buildEnterBtn', '#netherEnterBtn', '#adventureEnterBtn'].forEach((sel) => btnSwapTrailPlay(q(sel)));
})();
