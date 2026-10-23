'use strict';
/* ============================================================
   像素图标工坊 — 手绘像素图标(16×16 字符画 → 64×64 dataURL)
   tankIcon: 主菜单坦克演习场卡的入口图标 — emoji 🚙 各平台渲染不可控
   (有的机器上像救护车), 换成与游戏内军绿/履带同配色的像素坦克。
   itemIcon/iconOf (T8): ITEMS 全 54 键物品图标, 一期替换全部 emoji
   占位(设计稿 D13) — 掉落物 Sprite/快捷栏槽/配方书卡片共用 iconOf
   统一出口(有像素图返 dataURL, 未画返 emoji 文本, 未注册返空串)。
   怪物头像在怪物库(Mobs.face), 坦克型号图标在载具(Tank.icon),
   专注图标在 focus-icons.js。
   ============================================================ */
function tankIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, w, h, col)=>{
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  const GREEN='#5a6b4a'; const GREEN2='#6d7f58'; const DARK='#333a2e';
  const TRACK='#22261e'; const WHEEL='#454d3e'; const METAL='#8a9184';
  px(0, 4, 7, 2, DARK); // 炮管(朝左)
  px(0, 3, 2, 4, METAL); // 炮口制退器
  px(6, 2, 5, 1, GREEN2); // 炮塔顶
  px(5, 3, 7, 4, GREEN); // 炮塔
  px(3, 7, 12, 3, GREEN); // 车体
  px(3, 7, 2, 1, GREEN2); // 斜甲高光
  px(2, 10, 13, 4, TRACK); // 履带
  for (const x of [3, 5, 7, 9, 11, 13]) px(x, 11, 1, 2, WHEEL); // 负重轮
  const big = document.createElement('canvas');
  big.width = big.height = 64;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, 64, 64);
  return big.toDataURL();
}
(function() { // 入口卡换标(main.js 组合根之前的独立装配)
  const big = document.querySelector('#cardTank .big');
  if (big) big.innerHTML = '<img alt="坦克演习场" src="' + tankIcon() + '">';
})();

/* ============================================================
   物品像素图标 (itemIcon/iconOf, 术语见 GLOSSARY.md「像素图标工坊」)
   — 应用层·T8 扩展(设计稿 D13: 一期全量替换 emoji 占位)
   ------------------------------------------------------------
   画法: 每物品一张 16 行×16 列「字符画」, 字符查表上色('.'=透明),
   走 tankIcon 同款管线(16×16 画布 → 关平滑放大 64×64 → dataURL)。
   工具 16 条共用 4 张字符画, '#'主/'+'亮/'-'暗 三字符按四阶色板
   替换 — 色板与 held-item.js mkToolDef 同源(木/石/铁/钻), 视觉
   口径单一。风格参考 MC 观感语言, 全部程序自绘(版权口径 D13)。
   interface: itemIcon(itemId)·iconOf(itemId)·ITEM_PIX(字符画数据表)
   依赖: ITEMS(items-core.js, index.html 238 行先于本文件 258 行)
   可测性: 绘制走 document.createElement, Node 单测注入 canvas 桩
   (test/icons-item.test.js); 字符画数据段零依赖可直接断言。
   ============================================================ */

/* 四阶色板 — 键名与 ITEMS 工具 id 后缀一致, 基色照抄 held-item.js */
const PIX_TIER = {
  wood: {main: '#8a5a2b', light: '#a8743d', dark: '#6b451f'},
  stone: {main: '#8a8f98', light: '#a3a8b0', dark: '#6e737c'},
  iron: {main: '#d8dde4', light: '#eef1f5', dark: '#b0b7c0'},
  diamond: {main: '#4ee1d2', light: '#7feee2', dark: '#2fb8aa'},
};
const PIX_HANDLE = {light: '#a0703c', dark: '#7a5228'}; // 木柄(比 wood 阶提亮一档区分)

/* ---------- 工具字符画: 柄统一斜 45° 左下→右上, 头在右上(MC 惯例) ---------- */
const PICK_ART = [ // 镐: 「⌒」弧头扣柄顶, 两翼尖下垂
  '................',
  '................',
  '.....++++++.....',
  '....########....',
  '...-########-...',
  '..--..WW....--..',
  '..-...Ww.....-..',
  '....Ww..........',
  '...Ww...........',
  '..Ww............',
  '.Ww.............',
  'Ww..............',
  '................',
  '................',
  '................',
  '................',
];
const AXE_ART = [ // 斧: 块状刃挂柄顶左侧, 刃口朝下
  '................',
  '................',
  '...++++.........',
  '..+#####........',
  '..+###Ww........',
  '...##Ww.........',
  '....Ww..........',
  '...Ww...........',
  '..Ww............',
  '.Ww.............',
  'Ww..............',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const SWORD_ART = [ // 剑: 斜 45° 长刃(左亮右暗)+ 木色护手横条
  '................',
  '...........+#...',
  '..........+#-...',
  '.........+#-....',
  '........+#-.....',
  '.......+#-......',
  '......+#-.......',
  '.....+#-........',
  '...W+#-w........',
  '..WWWWw.........',
  '..Ww............',
  '.Ww.............',
  'Ww..............',
  '................',
  '................',
  '................',
];
const SHOVEL_ART = [ // 锹: 圆角铲斗 + 斜柄
  '................',
  '................',
  '.....++++.......',
  '....+####-......',
  '....+####-......',
  '....+#Ww........',
  '.....Ww.........',
  '....Ww..........',
  '...Ww...........',
  '..Ww............',
  '.Ww.............',
  'Ww..............',
  '................',
  '................',
  '................',
  '................',
];

/* ---------- 材料与物品字符画(正交视角, MC 观感语言) ---------- */
const LOG_ART = [ // 原木: 竖圆柱, 顶面浅色年轮带
  '................',
  '................',
  '....tttttttt....',
  '...bttttttttb...',
  '...bmlmmmlmmb...',
  '...bmmmmlmmmb...',
  '...bmlmmmlmmb...',
  '...bmmmlmmmmb...',
  '...bmlmmmlmmb...',
  '...bmmmmlmmmb...',
  '...bmlmmmlmmb...',
  '...bmmmlmmmmb...',
  '...bmlmmmlmmb...',
  '...bmmmmmmmmb...',
  '................',
  '................',
];
const PLANKS_ART = [ // 木板: 横板条 + 错位竖缝
  '................',
  '................',
  '..llllllllllll..',
  '..mmmmmmmmdmmm..',
  '..mmmmmmmmdmmm..',
  '..dddddddddddd..',
  '..llllllllllll..',
  '..mmmdmmmmmmmm..',
  '..mmmdmmmmmmmm..',
  '..dddddddddddd..',
  '..llllllllllll..',
  '..mmmmmmmmmmdm..',
  '..mmmmmmmmmmdm..',
  '..dddddddddddd..',
  '................',
  '................',
];
const STICK_ART = [ // 木棍: 斜 45° 双色棍
  '................',
  '................',
  '................',
  '...........Ww...',
  '..........Ww....',
  '.........Ww.....',
  '........Ww......',
  '.......Ww.......',
  '......Ww........',
  '.....Ww.........',
  '....Ww..........',
  '...Ww...........',
  '..Ww............',
  '................',
  '................',
  '................',
];
const SAPLING_ART = [ // 树苗: 叶团 + 细杆(L=亮叶)
  '................',
  '......gg........',
  '.....gLgg.......',
  '....gggLgg......',
  '....gdgggg......',
  '.....gwgw.......',
  '......ww........',
  '......ww........',
  '......ww........',
  '......ww........',
  '......ww........',
  '.....wwww.......',
  '................',
  '................',
  '................',
  '................',
];
const COAL_ART = [ // 矿炭共用团块形: coal 黑亮 / charcoal 褐灰
  '................',
  '................',
  '................',
  '.....cccc.......',
  '....cccccc......',
  '...cccLcccc.....',
  '...ccccccccc....',
  '..cccLcccccc....',
  '..cccccccdcc....',
  '..cccccccccc....',
  '...ccdccccc.....',
  '....cccccc......',
  '.....cccc.......',
  '................',
  '................',
  '................',
];
const ORE_ART = [ // 矿石共用形: 石底 + 嵌斑(铁斑米粉 / 金斑明黄)
  '................',
  '................',
  '..ssLssssssdss..',
  '..sssssssssssd..',
  '..soosssssssss..',
  '..soOossssooss..',
  '..soosssssssss..',
  '..sssssssoosss..',
  '..sssssssoOoss..',
  '..sssssssoosss..',
  '..sssssdssssss..',
  '..ssssssssdsss..',
  '..sdssssssssss..',
  '..ssssssssdsss..',
  '................',
  '................',
];
const INGOT_ART = [ // 锭共用形: 上窄下宽梯形 + 亮顶
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....++++.......',
  '....+####-......',
  '...+######-.....',
  '...+######-.....',
  '..-########-....',
  '..----------....',
  '................',
  '................',
  '................',
  '................',
];
const DIAMOND_ART = [ // 钻石: 青蓝宝石, 亮台面 + 渐收底尖
  '................',
  '................',
  '................',
  '.....llll.......',
  '....l####d......',
  '...l######d.....',
  '...l#llll#d.....',
  '....m####d......',
  '.....m##d.......',
  '......md........',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const FLESH_ART = [ // 腐肉: 暗红不规则块 + 粉洞
  '................',
  '................',
  '................',
  '....mmmmm.......',
  '...mmlmmmm......',
  '..mmmmmpmmmmm...',
  '..mlmmmmmmmdm...',
  '..mmmpmmmmmmm...',
  '..mmmmmmmpmmm...',
  '..dmmmmmmmmdm...',
  '...mmmmpmmmm....',
  '....dmmmmm......',
  '................',
  '................',
  '................',
  '................',
];
const BONE_ART = [ // 骨头: 两端球 + 中间亮杆
  '................',
  '................',
  '................',
  '................',
  '..mmm......mmm..',
  '.mmmm......mmmm.',
  '.mmmmmmmmmmmmmm.',
  '.mmmllllllllmmm.',
  '.mmmmddddddmmmm.',
  '..mmm......mmm..',
  '..ddd......ddd..',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const PILE_ART = [ // 粉堆共用形: gunpowder 灰 / bone_meal 白
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......ll.......',
  '......lmml......',
  '.....lmmlml.....',
  '....lmmlmmml....',
  '...lmmdmmmmdl...',
  '..lmmdmmmmddml..',
  '.lddddddddddddl.',
  '................',
  '................',
  '................',
  '................',
];
const STRING_ART = [ // 线: S 形弯线
  '................',
  '................',
  '.....lm.........',
  '.....mm.........',
  '....mm..........',
  '....mm..........',
  '.....mm.........',
  '......mm........',
  '.......mm.......',
  '........mm......',
  '........mm......',
  '.........mm.....',
  '.........md.....',
  '................',
  '................',
  '................',
];
const BALL_ART = [ // 圆球共用形: slimeball 绿 / clay_ball 灰蓝
  '................',
  '................',
  '................',
  '.....mmmm.......',
  '....mmmmmm......',
  '...mmlmmmmm.....',
  '...mlmmmmmmm....',
  '...mmmmmmmmm....',
  '...mmmmmmmmm....',
  '...mmmmmmmmd....',
  '....mmmmdd......',
  '.....dddd.......',
  '................',
  '................',
  '................',
  '................',
];
const WHEAT_ART = [ // 小麦: 三束穗 + 秆
  '................',
  '..l.l...l.l...l.',
  '...mm...mm...mm.',
  '...lm...lm...lm.',
  '...mm...mm...mm.',
  '...ml...ml...ml.',
  '...mm...mm...mm.',
  '...s....ss....s.',
  '...s....ss....s.',
  '...s....ss....s.',
  '...s....ss....s.',
  '...s....ss....s.',
  '...s....ss....s.',
  '................',
  '................',
  '................',
];
const SEEDS_ART = [ // 种子: 散落绿籽粒
  '................',
  '................',
  '................',
  '....mm......mm..',
  '....ml......mm..',
  '................',
  '................',
  '......mm........',
  '......lm........',
  '................',
  '...mm.......mm..',
  '...ml.......ml..',
  '................',
  '.....mm.........',
  '.....lm.........',
  '................',
];
const BRICK_ART = [ // 红砖: 单砖横放 + 孔痕
  '................',
  '................',
  '................',
  '................',
  '................',
  '..llllllllllll..',
  '..mmmmmmmmmmmm..',
  '..mmmddmmmddmm..',
  '..mmmmmmmmmmmm..',
  '..mmddmmmmmddm..',
  '..dddddddddddd..',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const WALL_ART = [ // 砖墙共用形: bricks 红 / stone_bricks 灰, 错缝砌墙
  '................',
  '................',
  '..mmmmmmfmmmmm..',
  '..mmmmmmlfmmmm..',
  '..mmmmmmfmmmmm..',
  '..ffffffffffff..',
  '..mmfmmmmmmmmf..',
  '..mlfmmmmmmmlf..',
  '..mmfmmmmmmmmf..',
  '..ffffffffffff..',
  '..mmmmmmfmmmmm..',
  '..mmmmmmlfmmmm..',
  '..mmmmmmfmmmmm..',
  '..ffffffffffff..',
  '................',
  '................',
];
const SHEARS_ART = [ // 剪刀: 张开双刃 + 合流柄 + 空心双指环
  '................',
  '....ii......ii..',
  '....iiI....iiI..',
  '....iii....iii..',
  '....iii....iii..',
  '....iii....iii..',
  '.....iii..iii...',
  '......iii.iii...',
  '.......iiii.....',
  '......diid......',
  '..dddd....dddd..',
  '..d..d....d..d..',
  '..d..d....d..d..',
  '..dddd....dddd..',
  '................',
  '................',
];
const APPLE_ART = [ // 苹果: 红果 + 柄 + 叶
  '................',
  '.......st.......',
  '.......st.EEE...',
  '.....mmmmm......',
  '....mlmmmmm.....',
  '....mlmmmmmd....',
  '...mmmmmmmmdd...',
  '...mmmmmmmmdd...',
  '...mmmmmmmmmmd..',
  '...mmmmmmmmmmd..',
  '....mmmmmmmmdd..',
  '....mmmmmmddd...',
  '.....ddddd......',
  '................',
  '................',
  '................',
];
const BREAD_ART = [ // 面包: 长圆条 + 斜切纹
  '................',
  '................',
  '................',
  '................',
  '....llllllll....',
  '...llllllllll...',
  '...mmmllmmmmm...',
  '...mllmmmmmdm...',
  '...mmmmllmmmm...',
  '...mmmmmlllmm...',
  '...dmmmmmmdmm...',
  '....dddddddd....',
  '................',
  '................',
  '................',
  '................',
];
const DIRT_ART = [ // 泥土: 土色块 + 深浅噪点
  '................',
  '................',
  '..lmmlmmmmlmmm..',
  '..mmmmdmmmmmmd..',
  '..mdmmmmmmmmmm..',
  '..mmmmmlmmmdmm..',
  '..dmmmmmmmmlmm..',
  '..mmmdmmmmmmmm..',
  '..mmmmmmdmmmmm..',
  '..mmmmmmmmdmmm..',
  '..mlmmmmmmmmmd..',
  '..mmmmdmmmmmmm..',
  '..dmmmmmlmmmmm..',
  '..mmmmmmmmmmdm..',
  '................',
  '................',
];
const SAND_ART = [ // 沙子: 沙色块 + 噪点
  '................',
  '................',
  '..mmlmmmmmmlmm..',
  '..mmmmmdmmmmmm..',
  '..mdmmmmmmlmmm..',
  '..mmmmdmmmmmmd..',
  '..mlmmmmmmmmmm..',
  '..mmmmmmdmmmmm..',
  '..mmmmmmmmmdmm..',
  '..mmdmmmmmlmmm..',
  '..mmmmmmlmmmmm..',
  '..mdmmmmmmmmdm..',
  '..mmmmdmmmmmml..',
  '..mlmmmmmmmmmm..',
  '................',
  '................',
];
const COBBLE_ART = [ // 圆石: 大石面 + 蜈蚣状裂缝
  '................',
  '................',
  '.llllllllllllll.',
  '.llmmmmmmmmmmll.',
  '.lmmmmdddmmmmml.',
  '.mmmmdddddmmmmm.',
  '.mmddmmmmdddmmm.',
  '.mmmmmmmmdddmmm.',
  '.mmmdddmmmmmmmm.',
  '.mmddddmmmmmmmm.',
  '.mmmmmmmmmdddmm.',
  '.dmmmmmmmmmdddm.',
  '.ddmmmddddmmmmd.',
  '.dddddddddddddd.',
  '................',
  '................',
];
const STONE_ART = [ // 石头: 整石面 + 稀疏颗粒(比圆石干净)
  '................',
  '................',
  '..ssLsssssssds..',
  '..ssssssssssss..',
  '..ssdsssssssss..',
  '..ssssssdsssss..',
  '..sLssssssssss..',
  '..ssssssssssss..',
  '..ssssssLsssss..',
  '..sdssssssssss..',
  '..ssssssssdsss..',
  '..ssssssssssss..',
  '..ssdssssssLss..',
  '..ssssssssssds..',
  '................',
  '................',
];
const GLASS_ART = [ // 玻璃: 亮框 + 半透明面 + 斜高光(透明底)
  '................',
  '................',
  '..ffffffffffff..',
  '..fggggggggggf..',
  '..fghggggggggf..',
  '..fgghgggggggf..',
  '..fggghggggggf..',
  '..fgggghgggggf..',
  '..fggggghggggf..',
  '..fgggggghgggf..',
  '..fdgggggggggf..',
  '..fggggggggggf..',
  '..fddddddddddf..',
  '................',
  '................',
  '................',
];
const MOSSY_ART = [ // 苔石: 圆石面 + 绿苔斑覆盖
  '................',
  '................',
  '.vllllllllllllv.',
  '.llvmmmmmmmmml..',
  '.lmmmmdddmmmvml.',
  '.mmmvdddddVmmmm.',
  '.mmddmvmmdddmmm.',
  '.mmvmmmmmdddmmm.',
  '.mmmdddmmmmvmmm.',
  '.mmvdddmmmmmmmm.',
  '.mmmmmmmmvdddmm.',
  '.dVmmmmmmmmdddm.',
  '.ddmvvddddmmmmd.',
  '.dddddddddddddd.',
  '................',
  '................',
];
const LEAVES_ART = [ // 树叶: 叶团 + 透明孔洞(透隙观感)
  '................',
  '................',
  '....lmmmml......',
  '..lmmlmmmmmll...',
  '.lmmmmmlmmmmml..',
  '.mmml.mmmmmlmmm.',
  'lmmdmm.mmmmmdlmm',
  'lmmdmmm.mmmmdlmm',
  '.mmm.mmmlmm.mmm.',
  '.lmmmm.mmmm.mm..',
  '..lmm.mmmlm.ml..',
  '...lm.mm..m.l...',
  '....l..l...l....',
  '................',
  '................',
  '................',
];
const TORCH_ART = [ // 火把: 木杆 + 燃焰(外橙中亮心黄)
  '................',
  '.......ff.......',
  '......ffff......',
  '.....f2222f.....',
  '.....f2332f.....',
  '......f22f......',
  '.......WW.......',
  '.......Ww.......',
  '.......Ww.......',
  '.......Ww.......',
  '.......Ww.......',
  '.......Ww.......',
  '.......Ww.......',
  '.......Ww.......',
  '................',
  '................',
];
const TABLE_ART = [ // 工作台: 十字网格桌面板 + 拼缝侧板
  '................',
  '................',
  '..gggggggggggg..',
  '..gmmmmggmmmmg..',
  '..gmmmmggmmmmg..',
  '..gggggggggggg..',
  '..ssssssssssss..',
  '..sllsssssslls..',
  '..ssssssssssss..',
  '..ssdssssssdss..',
  '..ssssssssssss..',
  '..sllsssssslls..',
  '..ssssssssssss..',
  '..sdsdsdsdsdsd..',
  '................',
  '................',
];
const FURNACE_ART = [ // 熔炉: 石体 + 黑炉口 + 炉膛火
  '................',
  '................',
  '..ssLsssssssds..',
  '..ssssssssssss..',
  '..ssssssssssss..',
  '..sdssssssssds..',
  '..sskkkkkkkkss..',
  '..skkkkkkkkkks..',
  '..skkkkkkkkkks..',
  '..skkFFFFFFkks..',
  '..skkffffffkks..',
  '..skkkkkkkkkks..',
  '..ssssssssssss..',
  '..sdssssssdsss..',
  '................',
  '................',
];
const TNT_ART = [ // TNT: 红柱 + 白标带 + 三个黑字块(16px 画不下字母)
  '................',
  '................',
  '...rrrrrrrrrr...',
  '...rrRrrrrrrr...',
  '...rrrrrrrrrr...',
  '...wwwwwwwwww...',
  '...wkkwwkkwwk...',
  '...wkkwwkkwwk...',
  '...wwwwwwwwww...',
  '...rrrrrdrrrr...',
  '...rrrrrrrrrr...',
  '...rrRrrrrdrr...',
  '...rrrrrrrrrr...',
  '...rdrdrdrdrd...',
  '................',
  '................',
];
const BOW_ART = [ // 弓: 左弧木弓臂 + 右侧竖弦
  '................',
  '................',
  '......WWWss.....',
  '.....WW...s.....',
  '....WW....s.....',
  '...WW.....s.....',
  '...Ww.....s.....',
  '...Ww.....s.....',
  '...Ww.....s.....',
  '...Ww.....s.....',
  '....Ww....s.....',
  '....Ww....s.....',
  '.....WW...s.....',
  '......WWWss.....',
  '................',
  '................',
];

/* ------------------------------------------------------------
   ITEM_PIX 字符画数据表 — 键集与 ITEMS 完全一致(test 防错网断言),
   共用形状(矿炭/矿石/锭/粉堆/圆球/砖墙)多条目复用同 art 换色板
   ------------------------------------------------------------ */
const ITEM_PIX = {
  /* 木材链 */
  log: {art: LOG_ART, map: {b: '#5d3f21', m: '#7d5730', l: '#96693c', t: '#c9a06b'}},
  planks: {art: PLANKS_ART, map: {m: '#b1804f', l: '#caa06e', d: '#7d5432'}},
  stick: {art: STICK_ART, map: {W: PIX_HANDLE.light, w: PIX_HANDLE.dark}},
  sapling: {art: SAPLING_ART, map: {g: '#3f8f3f', L: '#5abf5a', d: '#2e6b2e', w: PIX_HANDLE.dark}},
  /* 矿物链 */
  coal: {art: COAL_ART, map: {c: '#242424', L: '#454545', d: '#101010'}},
  charcoal: {art: COAL_ART, map: {c: '#3a2a1e', L: '#7d746a', d: '#1f140c'}},
  iron_ore: {art: ORE_ART, map: {s: '#8a8f98', L: '#a3a8b0', d: '#6e737c', o: '#d8af93', O: '#e8cbb5'}},
  iron_ingot: {art: INGOT_ART, map: {'#': PIX_TIER.iron.main, '+': PIX_TIER.iron.light, '-': PIX_TIER.iron.dark}},
  gold_ore: {art: ORE_ART, map: {s: '#8a8f98', L: '#a3a8b0', d: '#6e737c', o: '#f0c53a', O: '#f8e08a'}},
  gold_ingot: {art: INGOT_ART, map: {'#': '#f0c53a', '+': '#f8e08a', '-': '#c79a22'}},
  diamond: {art: DIAMOND_ART, map: {'#': PIX_TIER.diamond.main, 'l': '#a5f3ea', 'd': '#2fb8aa', 'm': '#3ac4b4'}},
  /* 怪物掉落材料 */
  rotten_flesh: {art: FLESH_ART, map: {m: '#8a3a2e', l: '#a85446', d: '#5c1f14', p: '#c9877b'}},
  bone: {art: BONE_ART, map: {m: '#e8e5d8', l: '#f8f6ee', d: '#c0bcae'}},
  gunpowder: {art: PILE_ART, map: {m: '#5d5d5d', l: '#8a8a8a', d: '#3a3a3a'}},
  string: {art: STRING_ART, map: {m: '#e0ded4', l: '#f5f4ee', d: '#b5b2a6'}},
  slimeball: {art: BALL_ART, map: {m: '#5fae3f', l: '#a4e08a', d: '#3f7a28'}},
  /* 农耕链(二期开放, 图标先就位) */
  wheat: {art: WHEAT_ART, map: {m: '#d4b445', l: '#e8d477', s: PIX_HANDLE.light}},
  wheat_seeds: {art: SEEDS_ART, map: {m: '#7fae3f', l: '#a4d06b'}},
  bone_meal: {art: PILE_ART, map: {m: '#ece9dd', l: '#fbfaf3', d: '#c4c0b0'}},
  /* 补给包一期件 */
  clay_ball: {art: BALL_ART, map: {m: '#9aa3b5', l: '#bcc4d2', d: '#767f92'}},
  brick: {art: BRICK_ART, map: {m: '#9a4e35', l: '#b5604a', d: '#7a3a26'}},
  bricks: {art: WALL_ART, map: {m: '#9a4e35', l: '#b5604a', f: '#6e6e6e'}},
  stone_bricks: {art: WALL_ART, map: {m: '#8a8f98', l: '#a3a8b0', f: '#5f646c'}},
  shears: {art: SHEARS_ART, map: {i: PIX_TIER.iron.main, I: PIX_TIER.iron.light, d: '#5c6169'}},
  /* 食物 */
  apple: {art: APPLE_ART, map: {m: '#d83a2e', l: '#f06a4f', d: '#a02418', s: '#5d3f21', t: '#7a5228', E: '#4a8f35'}},
  bread: {art: BREAD_ART, map: {m: '#c68e4e', l: '#e0b072', d: '#9c6a34'}},
  /* 放置型方块物品 */
  dirt: {art: DIRT_ART, map: {m: '#866043', l: '#a07b56', d: '#6b4a33'}},
  sand: {art: SAND_ART, map: {m: '#dbcf9c', l: '#efe6bb', d: '#c4b47a'}},
  cobble: {art: COBBLE_ART, map: {m: '#7a7f88', l: '#93989f', d: '#5c6169'}},
  stone: {art: STONE_ART, map: {s: '#8a8f98', L: '#a3a8b0', d: '#6e737c'}},
  glass: {art: GLASS_ART, map: {f: '#cfe8ef', g: 'rgba(205,235,245,0.30)', h: '#ffffff', d: '#9fc4cf'}},
  mossy_cobble: {art: MOSSY_ART, map: {m: '#7a7f88', l: '#93989f', d: '#5c6169', v: '#5a8f3f', V: '#7fbf62'}},
  leaves: {art: LEAVES_ART, map: {m: '#3f7f34', l: '#57a34a', d: '#2c5c24'}},
  /* 站点件与功能件 */
  torch: {art: TORCH_ART, map: {f: '#e8632c', 2: '#ff9d2e', 3: '#ffd83d', W: PIX_HANDLE.light, w: PIX_HANDLE.dark}},
  craft_table: {art: TABLE_ART, map: {g: '#6b451f', m: '#b1804f', s: '#8a5a2b', l: '#caa06e', d: '#7d5432'}},
  furnace: {art: FURNACE_ART, map: {s: '#8a8f98', L: '#a3a8b0', d: '#6e737c', k: '#1a1a1a', F: '#ffc04d', f: '#ff8c1a'}},
  tnt: {art: TNT_ART, map: {r: '#d0342c', R: '#f05545', w: '#ececec', k: '#1a1a1a', d: '#a02018'}},
  /* 二期占位 */
  bow_item: {art: BOW_ART, map: {W: PIX_HANDLE.light, w: PIX_HANDLE.dark, s: '#e0ded4'}},
};

/* 工具 16 条 = 4 种字符画 × 四阶色板('#'主/'+'亮/'-'暗), 柄色固定 */
for (const [kind, art] of [['pick', PICK_ART], ['axe', AXE_ART],
  ['sword', SWORD_ART], ['shovel', SHOVEL_ART]]) {
  for (const [tier, pal] of Object.entries(PIX_TIER)) {
    ITEM_PIX[kind + '_' + tier] = {art, map: {
      '#': pal.main, '+': pal.light, '-': pal.dark,
      'W': PIX_HANDLE.light, 'w': PIX_HANDLE.dark,
    }};
  }
}

/* ---------- 渲染与出口 ---------- */

/* 字符画上画布: 每字符一格 1×1, '.' 透明跳过 */
function drawArt(g, art, map) {
  for (let y = 0; y < art.length; y++) {
    const row = art[y];
    for (let x = 0; x < row.length; x++) {
      const col = map[row[x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
}

/* 16×16 小图关平滑放大 64×64 → dataURL(tankIcon 同款管线) */
function pixToURL64(small) {
  const big = document.createElement('canvas');
  big.width = big.height = 64;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(small, 0, 0, 64, 64);
  return big.toDataURL();
}

/* 物品图标缓存 — 同 id 只画一次(页面生命周期内色板不变) */
const ITEM_ICON_CACHE = {};

/* 物品像素图标: 有手绘返 dataURL; 未手绘回落 ITEMS[id].icon 的 emoji
   渲染; 未注册画 '?' — 保证已注册物品永不空白。 */
function itemIcon(itemId) {
  if (Object.prototype.hasOwnProperty.call(ITEM_ICON_CACHE, itemId)) {
    return ITEM_ICON_CACHE[itemId];
  }
  const small = document.createElement('canvas');
  small.width = small.height = 16;
  const g = small.getContext('2d');
  const def = ITEM_PIX[itemId];
  if (def) {
    drawArt(g, def.art, def.map);
  } else { // 回落: emoji 文字居中上画布(各平台字形有差但形状可辨)
    const emo = (typeof ITEMS !== 'undefined' && ITEMS[itemId]) ?
      (ITEMS[itemId].icon || '?') : '?';
    g.font = '13px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emo, 8, 8);
  }
  const url = pixToURL64(small);
  ITEM_ICON_CACHE[itemId] = url;
  return url;
}

/* 图标统一出口(T7 drops/T10 槽位运行时协议):
   有像素图 → dataURL 字符串; 未画像素图的已注册物品 → emoji 文本;
   未注册 → 空串(调用方判空跳过)。判别建议 startsWith('data:')。 */
function iconOf(itemId) {
  if (ITEM_PIX[itemId]) return itemIcon(itemId);
  if (typeof ITEMS !== 'undefined' && ITEMS[itemId]) {
    return ITEMS[itemId].icon || '';
  }
  return '';
}
