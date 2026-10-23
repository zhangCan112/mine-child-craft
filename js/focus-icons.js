'use strict';
/* ============================================================
   Focus Icons (专注像素图标库) — 应用层
   MC 观感语言的 16×16 手绘像素 → 96×96 dataURL(pixelated), 零外部资源;
   专注训练营全部刺激/头像/图章/火苗共用, 调用方只需传键名拿 dataURL
   interface: mcIcon(name) 刺激图标 · creeperFace(dir) 苦力怕头像 ·
     pigFace() 猪中立头像 · sheepFace() 羊中立头像(Flanker 中立行 D3) ·
     chiefFace(mood) 训练师村长(mood ∈ smile/cheer/sleepy/devil, 鬼化=devil) ·
     stampIcon(kind) 图章(kind ∈ pick/gem/tnt/big/gold/devil) ·
     flameIcon(level) 探险家火苗(level ∈ 1/2/3, CSS 摇曳底图)
   依赖(均经全局名, 调用期解析): 无 — 仅 document/canvas, 随用随建
   可测性: DOM 惰性创建, Node 测试可安全加载; 像素绘制无直测惯例,
     boot.test.js 按 index.html 顺序全链冒烟兜底(conventions §1.9)
=========================================================== */
const mcIconCache = {};

/* 16×16 画布 → 96×96 dataURL(关平滑放大): 各图标共用的放大+缓存收尾 —
   画像素是各函数自己的事, 收尾管线只此一份 */
function to96(c) {
  const big = document.createElement('canvas');
  big.width = big.height = 96;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, 96, 96);
  return big.toDataURL();
}

function mcIcon(name) {
  if (mcIconCache[name]) return mcIconCache[name];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, w, h, col)=>{
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  const stoneBase = ()=>{
    px(0, 0, 16, 16, '#7d7d7d');
    [[2, 1], [9, 2], [13, 5], [5, 6], [12, 9], [3, 11], [8, 13], [1, 8]].forEach(([x, y])=>px(x, y, 2, 1, '#8c8c8c'));
    [[6, 2], [11, 7], [2, 13], [13, 3], [8, 10], [4, 4]].forEach(([x, y])=>px(x, y, 1, 1, '#6e6e6e'));
  };
  switch (name) {
    case 'stone': stoneBase(); break;
    case 'coal': case 'iron': {
      stoneBase();
      const base = name==='coal' ? '#1e1e1e' : '#d8af93';
      const hi = name==='coal' ? '#333333' : '#e6c5a5';
      [[2, 3], [9, 2], [5, 10], [11, 11]].forEach(([x, y])=>{
        px(x, y, 2, 2, base); px(x, y, 1, 1, hi);
      });
      px(13, 6, 2, 2, base); px(6, 7, 1, 1, base);
      break;
    }
    case 'diamond': case 'emerald': {
      const a = name==='diamond' ?
        ['#e6fdfa', '#9ff5ec', '#54d7cd', '#2ba69e'] :
        ['#dcffe6', '#84ea9e', '#3cc06d', '#1f8f4a'];
      px(4, 3, 8, 2, a[1]); px(6, 2, 4, 1, a[0]); // 顶部亮面
      px(3, 4, 1, 2, a[1]); px(12, 4, 1, 2, a[1]); // 两侧翼
      px(5, 5, 6, 2, a[2]); // 中段
      px(4, 6, 1, 1, a[2]); px(11, 6, 1, 1, a[2]);
      px(5, 7, 2, 1, a[3]); px(9, 7, 2, 1, a[3]); // 收底
      px(6, 8, 4, 1, a[3]); px(7, 9, 2, 1, a[3]);
      px(5, 3, 2, 1, a[0]); px(6, 5, 1, 1, a[0]); // 高光
      break;
    }
    case 'tnt': {
      px(0, 0, 16, 16, '#c33a24');
      [[1, 2], [5, 1], [9, 3], [13, 2], [3, 12], [12, 11]].forEach(([x, y])=>px(x, y, 1, 1, '#a52c18'));
      px(0, 5, 16, 5, '#efe7dc'); // 白带
      px(2, 6, 3, 1, '#141414'); px(3, 7, 1, 2, '#141414'); // T
      px(6, 6, 1, 3, '#141414'); px(8, 6, 1, 3, '#141414'); px(7, 7, 1, 1, '#141414'); // N
      px(10, 6, 3, 1, '#141414'); px(11, 7, 1, 2, '#141414'); // T
      px(0, 0, 16, 1, '#8f2313'); px(0, 15, 16, 1, '#8f2313');
      break;
    }
    case 'wool_red': case 'wool_blue': case 'wool_yellow': {
      const base = {wool_red: '#b5332c', wool_blue: '#35399d', wool_yellow: '#e0b526'}[name];
      const light = {wool_red: '#c94a41', wool_blue: '#4a4eb5', wool_yellow: '#eec845'}[name];
      const dark = {wool_red: '#96271f', wool_blue: '#282c7d', wool_yellow: '#bd921a'}[name];
      px(0, 0, 16, 16, base);
      for (let y=0; y<16; y++) {
        for (let x=0; x<16; x++) {
          if ((x+y)%4===0) px(x, y, 1, 1, light);
          else if ((x+y)%4===2) px(x, y, 1, 1, dark);
        }
      }
      break;
    }
    case 'cobble': {
      px(0, 0, 16, 16, '#4f4f4f');
      [[1, 1], [5, 2], [10, 1], [2, 6], [7, 5], [12, 6], [1, 11], [6, 10], [11, 11], [4, 14], [13, 14]]
          .forEach(([x, y])=>{
            px(x, y, 3, 2, '#8a8a8a'); px(x, y, 2, 1, '#9a9a9a');
          });
      break;
    }
    case 'planks': {
      px(0, 0, 16, 16, '#b8945f');
      [3, 7, 11, 15].forEach((y)=>px(0, y, 16, 1, '#8a6b3d'));
      px(5, 0, 1, 3, '#8a6b3d'); px(11, 4, 1, 3, '#8a6b3d');
      px(3, 8, 1, 3, '#8a6b3d'); px(9, 12, 1, 3, '#8a6b3d');
      [[2, 1], [8, 5], [13, 9], [5, 13]].forEach(([x, y])=>px(x, y, 3, 1, '#c9a672'));
      break;
    }
    case 'brick': {
      px(0, 0, 16, 16, '#8a8a8a');
      [0, 5, 10, 15].forEach((y)=>px(0, y, 16, 1, '#5f5f5f'));
      px(7, 1, 1, 4, '#5f5f5f'); px(3, 6, 1, 4, '#5f5f5f'); px(11, 6, 1, 4, '#5f5f5f');
      px(7, 11, 1, 4, '#5f5f5f');
      [[1, 1], [8, 2], [4, 7], [12, 8], [1, 11], [9, 12]].forEach(([x, y])=>px(x, y, 2, 1, '#9c9c9c'));
      break;
    }
    case 'torch': {
      px(7, 6, 2, 10, '#8a6b3d'); px(8, 6, 1, 10, '#6e5430'); // 手柄
      px(6, 3, 4, 3, '#ffd83d'); px(7, 2, 2, 1, '#fff2a8'); // 火焰
      px(7, 6, 2, 1, '#ff9d2e'); px(5, 4, 1, 1, '#ffb52e'); px(10, 4, 1, 1, '#ffb52e');
      break;
    }
    case 'pickaxe': {
      for (let i=0; i<8; i++) px(5+i-2, 13-i, 2, 2, '#8a6b3d'); // 斜柄
      px(3, 1, 10, 2, '#9c9c9c'); px(2, 2, 2, 3, '#9c9c9c'); px(12, 2, 2, 3, '#9c9c9c');
      px(1, 4, 2, 2, '#7d7d7d'); px(13, 4, 2, 2, '#7d7d7d');
      px(4, 3, 8, 1, '#b8b8b8');
      break;
    }
    case 'flag': {
      px(7, 3, 2, 12, '#8a6b3d'); px(8, 3, 1, 12, '#6e5430'); // 旗杆
      px(9, 3, 6, 5, '#c33a24'); px(9, 3, 6, 1, '#d94a35'); px(14, 3, 1, 5, '#96271f');
      px(7, 2, 2, 1, '#ffd83d'); // 顶球
      break;
    }
  }
  const url = to96(c);
  mcIconCache[name] = url;
  return url;
}

/* 苦力怕头像(左/右视线) — Flanker 刺激 */
const creeperCache = {};
function creeperFace(dir) {
  if (creeperCache[dir]) return creeperCache[dir];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#4fae4f'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#3d8f3d';
  [[1, 2], [5, 1], [9, 3], [13, 2], [3, 7], [11, 6], [2, 12], [7, 14], [12, 11], [14, 14], [6, 9], [9, 13]]
      .forEach(([x, y])=>g.fillRect(x, y, 1, 1));
  const eyeY = 5;
  [[3], [10]].forEach(([x])=>{
    g.fillStyle = '#f4f4f4'; g.fillRect(x, eyeY, 3, 3);
    g.fillStyle = '#101510';
    g.fillRect(dir<0 ? x : x+2, eyeY+1, 1, 2);
  });
  g.fillStyle = '#101510';
  g.fillRect(6, 9, 4, 3); g.fillRect(7, 12, 2, 2);
  const url = to96(c);
  creeperCache[dir] = url;
  return url;
}

/* 猪中立头像(无方向) — Flanker 中立行(D3): 粉皮+中央大鼻, 双瞳看镜头;
   左右镜像对称不给任何方向线索, 苦力怕同管线 16×16→96×96 */
const pigCache = {face: ''};
function pigFace() {
  if (pigCache.face) return pigCache.face;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, w, h, col)=>{
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  px(0, 0, 16, 16, '#eda3a3'); // 粉皮底
  [[1, 1], [6, 2], [12, 1], [14, 3], [1, 4], [2, 8], [13, 8], [1, 12], [7, 13], [12, 13], [14, 12], [5, 3]]
      .forEach(([x, y])=>px(x, y, 1, 1, '#d98d8a')); // 深粉噪点(避五官)
  px(4, 5, 2, 2, '#f4f4f4'); px(5, 6, 1, 1, '#101510'); // 左眼(瞳朝中=看镜头)
  px(10, 5, 2, 2, '#f4f4f4'); px(10, 6, 1, 1, '#101510'); // 右眼(镜像)
  px(5, 9, 6, 3, '#d17f7c'); // 中央猪鼻
  px(6, 10, 1, 2, '#7d4644'); px(9, 10, 1, 2, '#7d4644'); // 双鼻孔
  const url = to96(c);
  pigCache.face = url;
  return url;
}

/* 羊中立头像(无方向) — Flanker 中立行(D3): 白绒框+浅脸板+粉鼻,
   绒纹同 mcIcon 羊毛手法; 双瞳看镜头, 左右镜像对称无方向线索 */
const sheepCache = {face: ''};
function sheepFace() {
  if (sheepCache.face) return sheepCache.face;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, w, h, col)=>{
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  px(0, 0, 16, 16, '#e8e8e8'); // 白绒底
  for (let y=0; y<16; y++) {
    for (let x=0; x<16; x++) {
      if ((x+y)%4===0) px(x, y, 1, 1, '#f7f7f7');
      else if ((x+y)%4===2) px(x, y, 1, 1, '#d2d2d2');
    }
  }
  px(4, 5, 8, 7, '#eadfcb'); // 浅脸板(四周留绒)
  px(5, 7, 2, 2, '#f4f4f4'); px(6, 8, 1, 1, '#101510'); // 左眼(瞳朝中)
  px(9, 7, 2, 2, '#f4f4f4'); px(9, 8, 1, 1, '#101510'); // 右眼(镜像)
  px(7, 10, 2, 2, '#e0a3a0'); // 粉鼻(居中)
  const url = to96(c);
  sheepCache.face = url;
  return url;
}

/* 训练师村长头像 — 白胡子+矿工帽+头灯的老矿工(设计稿 §8 B4 主持人格)
   mood: smile 微笑(默认) / cheer 喝彩(眯眼张嘴笑) / sleepy 打盹(闭眼+z)
         devil 鬼化变体(帽加小鬼角+红瞳+坏笑, B8 魔鬼特训专属上岗造型) */
const chiefCache = {};
function chiefFace(mood) {
  if (chiefCache[mood]) return chiefCache[mood];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, w, h, col)=>{
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  // 矿工帽(暗黄) + 中央头灯(亮黄, 灯芯奶白)
  px(4, 0, 8, 1, '#d9a334'); px(5, 0, 2, 1, '#eec845'); // 帽顶+高光
  px(3, 1, 10, 2, '#d9a334'); // 帽体
  px(7, 1, 2, 2, '#ffd83d'); px(7, 2, 2, 1, '#fff2a8'); // 头灯
  px(2, 3, 12, 1, '#bd921a'); // 帽檐
  // 脸(村民肤色) + 淡眉 + 睁眼(瞳看镜头, 表情层可覆盖)
  px(3, 4, 10, 1, '#c99a7f'); // 额头亮肤
  px(3, 5, 10, 1, '#bd8b72');
  px(4, 5, 2, 1, '#a57761'); px(10, 5, 2, 1, '#a57761'); // 淡眉
  px(3, 6, 10, 1, '#bd8b72');
  px(7, 6, 2, 4, '#a57761'); // 村民长鼻(垂进胡子)
  px(4, 6, 2, 2, '#f4f4f4'); px(5, 7, 1, 1, '#101510'); // 左眼
  px(10, 6, 2, 2, '#f4f4f4'); px(10, 7, 1, 1, '#101510'); // 右眼
  // 白胡子(U 形包裹下半脸, 暗点示蓬松)
  px(3, 8, 2, 1, '#e8e8e8'); px(5, 8, 2, 1, '#bd8b72');
  px(9, 8, 1, 1, '#bd8b72'); px(10, 8, 3, 1, '#e8e8e8');
  px(2, 9, 12, 1, '#e8e8e8'); px(7, 9, 2, 1, '#a57761'); // 鼻末压胡
  px(2, 10, 12, 2, '#e8e8e8');
  px(3, 12, 10, 1, '#e8e8e8'); px(4, 13, 8, 1, '#c9c9c9'); // 下巴收边
  [[4, 10], [8, 11], [11, 10], [3, 11]].forEach(([x, y])=>px(x, y, 1, 1, '#c9c9c9'));
  [[5, 10], [9, 11]].forEach(([x, y])=>px(x, y, 1, 1, '#ffffff'));
  if (mood === 'cheer') {
    px(4, 6, 2, 2, '#bd8b72'); px(10, 6, 2, 2, '#bd8b72'); // 抹掉睁眼
    px(4, 7, 2, 1, '#101510'); px(10, 7, 2, 1, '#101510'); // 眯眼横杠
    px(6, 10, 4, 1, '#6b2a1c'); // 张嘴暗腔
    px(6, 11, 1, 1, '#6b2a1c'); px(9, 11, 1, 1, '#6b2a1c');
    px(7, 11, 2, 1, '#d9776e'); px(7, 12, 2, 1, '#6b2a1c'); // 舌头
  } else if (mood === 'sleepy') {
    px(4, 6, 2, 2, '#bd8b72'); px(10, 6, 2, 2, '#bd8b72'); // 抹掉睁眼
    px(4, 7, 2, 1, '#101510'); px(10, 7, 2, 1, '#101510'); // 闭眼横杠
    px(7, 10, 2, 2, '#8c8c8c'); // 微张小圆嘴
    px(13, 0, 3, 1, '#ffd83d'); px(14, 1, 1, 1, '#ffd83d');
    px(13, 2, 3, 1, '#ffd83d'); // 帽角 z z
  } else if (mood === 'devil') {
    px(2, 0, 2, 1, '#c33a24'); px(12, 0, 2, 1, '#c33a24'); // 小鬼角尖
    px(2, 1, 1, 1, '#a52c18'); px(13, 1, 1, 1, '#a52c18'); // 角底
    px(4, 5, 2, 1, '#bd8b72'); px(10, 5, 2, 1, '#bd8b72'); // 抹掉淡眉
    px(4, 4, 1, 1, '#101510'); px(5, 5, 1, 1, '#101510'); // 左凶眉 \
    px(11, 4, 1, 1, '#101510'); px(10, 5, 1, 1, '#101510'); // 右凶眉 /
    px(5, 7, 1, 1, '#e05252'); px(10, 7, 1, 1, '#e05252'); // 红瞳
    px(5, 9, 1, 1, '#c9c9c9'); px(10, 9, 1, 1, '#c9c9c9'); // 嘴角上翘
    px(6, 10, 4, 1, '#f4f4f4'); // 露齿坏笑
    px(6, 11, 1, 1, '#f4f4f4'); px(9, 11, 1, 1, '#f4f4f4'); // 两颗尖牙
  } else { // smile 微笑(默认)
    px(6, 10, 1, 1, '#8c8c8c'); px(9, 10, 1, 1, '#8c8c8c');
    px(7, 11, 2, 1, '#8c8c8c'); // 胡中浅笑弧
  }
  const url = to96(c);
  chiefCache[mood] = url;
  return url;
}

/* 集章图章 — 圆角方章面+亮内框+中央图案(设计稿 §8 B1 日历/B6 集章/B8 通关章)
   kind: pick ⛏ / gem 💎 / tnt 🧨 普通章(底色呼应材料) ·
         big 大图章(华蓝底+金镐, 当日 3 关) · gold 金图章(30 章) ·
         devil 鬼图章(暗紫底+鬼面, 魔鬼特训通关) */
const stampCache = {};
function stampIcon(kind) {
  if (stampCache[kind]) return stampCache[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, w, h, col)=>{
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  const PAL = {
    pick: ['#5a6f9e', '#3d4d73', '#8fa3c9'], // 岩蓝底·石镐章
    gem: ['#2ba69e', '#1f8f8a', '#54d7cd'], // 钻青底·宝石章
    tnt: ['#c33a24', '#96271f', '#d94a35'], // TNT 红底·炸药章
    big: ['#35399d', '#282c7d', '#ffd83d'], // 华蓝底+金内框·大图章
    gold: ['#d9a334', '#bd921a', '#fff2a8'], // 金底奶白框·金图章
    devil: ['#3d2d4d', '#2a1e36', '#8a5cb0'], // 暗紫底·鬼图章
  }[kind];
  const [base, edge, frame] = PAL;
  px(1, 0, 14, 1, edge); px(1, 15, 14, 1, edge); // 深色外缘(四角透光)
  px(0, 1, 1, 14, edge); px(15, 1, 1, 14, edge);
  px(1, 1, 14, 14, base); // 底色
  px(2, 2, 12, 1, frame); px(2, 13, 12, 1, frame); // 亮色内框
  px(2, 2, 1, 12, frame); px(13, 2, 1, 12, frame);
  if (kind === 'pick' || kind === 'big') { // 镐章(大图章用金镐)
    const head = kind === 'big' ? '#ffd83d' : '#d8d8d8';
    const hi = kind === 'big' ? '#fff2a8' : '#f4f4f4';
    px(4, 5, 8, 1, head); px(5, 5, 3, 1, hi); // 镐头
    px(4, 6, 2, 1, head); px(10, 6, 2, 1, head); // 两端弯钩
    for (let i=0; i<5; i++) px(9-i, 7+i, 2, 2, '#8a6b3d'); // 斜柄
    if (kind === 'big') {
      px(4, 4, 1, 1, '#ffd83d'); px(11, 4, 1, 1, '#ffd83d'); // 四角金饰
      px(4, 11, 1, 1, '#ffd83d'); px(11, 11, 1, 1, '#ffd83d');
    }
  } else if (kind === 'gem') { // 迷你钻石(同 mcIcon 四色)
    px(6, 5, 4, 1, '#9ff5ec'); px(7, 5, 2, 1, '#e6fdfa');
    px(5, 6, 6, 1, '#9ff5ec');
    px(5, 7, 6, 1, '#54d7cd'); px(6, 7, 1, 1, '#e6fdfa');
    px(6, 8, 4, 1, '#54d7cd');
    px(6, 9, 4, 1, '#2ba69e'); px(7, 10, 2, 1, '#2ba69e');
  } else if (kind === 'tnt') { // 迷你 TNT
    px(4, 5, 8, 1, '#c33a24');
    px(4, 6, 8, 3, '#efe7dc'); // 白带
    px(6, 7, 1, 1, '#141414'); px(9, 7, 1, 1, '#141414'); // 两点示字
    px(4, 9, 8, 1, '#c33a24');
  } else if (kind === 'gold') { // 白五星
    px(8, 4, 1, 1, '#fff2a8'); px(8, 5, 1, 1, '#f4f4f4');
    px(5, 6, 7, 1, '#f4f4f4'); px(6, 7, 5, 1, '#f4f4f4');
    px(7, 8, 3, 1, '#f4f4f4'); px(6, 9, 1, 1, '#f4f4f4'); px(10, 9, 1, 1, '#f4f4f4');
  } else { // devil 鬼面
    px(4, 4, 2, 1, '#a52c18'); px(10, 4, 2, 1, '#a52c18'); // 鬼角
    px(4, 5, 1, 1, '#a52c18'); px(11, 5, 1, 1, '#a52c18');
    px(6, 5, 4, 1, '#c33a24'); px(5, 6, 6, 4, '#c33a24'); // 红脸
    px(6, 10, 4, 1, '#c33a24');
    px(6, 7, 1, 2, '#ffd83d'); px(9, 7, 1, 2, '#ffd83d'); // 发光黄眼
    px(7, 9, 2, 1, '#7a1f12'); // 坏笑暗嘴
    px(6, 10, 1, 1, '#f4f4f4'); px(9, 10, 1, 1, '#f4f4f4'); // 獠牙
  }
  const url = to96(c);
  stampCache[kind] = url;
  return url;
}

/* 探险家火苗 — 1 小/2 中/3 大(设计稿 §8 B3 体检三档), CSS 摇曳动画底图
   四层色由外焰轮廓逐层机械收缩叠出, 轮廓满帧清晰、底宽顶尖 */
const flameCache = {};
function flameIcon(level) {
  if (flameCache[level]) return flameCache[level];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, w, h, col)=>{
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  const LAYERS = ['#ff6b2e', '#ff9d2e', '#ffd83d', '#fff2a8']; // 外焰→芯
  const OUTLINE = {
    1: [[8, 7, 8], [9, 6, 9], [10, 6, 9], [11, 5, 10], [12, 5, 10],
      [13, 5, 10], [14, 4, 11], [15, 4, 11]],
    2: [[5, 7, 8], [6, 6, 9], [7, 6, 9], [8, 5, 10], [9, 5, 10],
      [10, 4, 11], [11, 4, 11], [12, 4, 11], [13, 3, 12], [14, 3, 12], [15, 3, 12]],
    3: [[2, 7, 8], [3, 6, 9], [4, 6, 9], [5, 5, 10], [6, 5, 10], [7, 5, 10],
      [8, 3, 12], [9, 3, 12], [10, 3, 12], [11, 3, 12],
      [12, 2, 13], [13, 2, 13], [14, 2, 13], [15, 2, 13]],
  }[level];
  let rows = OUTLINE;
  for (const col of LAYERS) {
    for (const [y, a, b] of rows) px(a, y, b - a + 1, 1, col);
    rows = rows.map(([y, a, b])=>[y, a + 1, b - 1]).filter(([y, a, b])=>a <= b);
  }
  if (level === 3) { // 左右副尖, 凑成大火炬三尖
    px(3, 6, 2, 1, LAYERS[0]); px(4, 7, 1, 1, LAYERS[0]);
    px(11, 6, 2, 1, LAYERS[0]); px(11, 7, 1, 1, LAYERS[0]);
  } else if (level === 2) { // 中苗左右小瓣
    px(4, 9, 1, 1, LAYERS[0]); px(11, 9, 1, 1, LAYERS[0]);
  }
  const big = document.createElement('canvas');
  big.width = big.height = 96;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, 96, 96);
  flameCache[level] = big.toDataURL();
  return flameCache[level];
}
