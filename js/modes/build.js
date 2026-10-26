'use strict';
/* ============================================================
   建造模式:自由建造 · 精选初始场景(巨大地下室 / 二层小楼房)
   - 全方块物品栏(第 1 格铁锹=挖掘入口, 手持感知主动作) · F 飞行 · R 重置场景 · 改动自动云同步存档
     (账本/脏标/5s 节流/关页兜底/双通道重放收编 js/world-journal-core.js 的
      mkWorldJournal; 本文件只剩档形政策——分桶 edits+当前场景+200KB 守卫)
   - 家具全部由现有方块拼搭(床/沙发/桌椅/电视/书架/厨台…)
============================================================ */

/* ---------- 物品栏:全部基础方块 + 第 1 格铁锹(挖掘入口, 2026-10-24 用户拍板:
    智能主动作手持感知全模式统一 — 选中方块→⛏️放置, 选中铲子→⛏️连挖;
    桌面左键恒挖不受影响, 右键拿铲子=无操作(MC 拿工具右键同构)) ---------- */
const BUILD_PALETTE = ['shovel', 6, 5, 17, 3, 4, 13, 9, 18, 19, 15, 16, 12, 11, 8, 2, 1, 7, 14, 10, 24, 25];
// ↑ 末两格 = 水/岩浆源(liquid 共识 Q17): 创造场直摆源方块, 放下即流(桶与物品链列后续票)
const BUILD_SAVE_KEY = 'build_world_save';

let buildSceneId = null; // 当前场景 id
const buildEdits = {}; // 各场景玩家改动 { sceneId: Map("x,y,z"→id) } — 分桶形状是建造私有, journal 只认当前桶
/* hotbar (kit 实例): 建造调色板, cls:'build' 换皮肤; 'shovel' 哨兵槽渲染铁锹物品图标 */
const buildHb = mkHotbar({cls: 'build',
  items: BUILD_PALETTE.map((id)=> (typeof id === 'number' ? {block: id} : {item: 'shovel_iron'})),
  onPick: () => buildHeld.sync()});
/* 手持感知五件套收编 ModeKit.mkHeldSync(评审候选 6): 哨兵槽语义/数字方块判定/
   Avatar.setItem/主动作键图标切换藏 kit 实现, 本模式与竞技场同款 */
const buildHeld = mkHeldSync(BUILD_PALETTE, buildHb);

/* ============================================================
   家具搭建辅助 (y 为家具底部所在层)
============================================================ */
/* 床: 石英枕头 + 羊毛垫 ×2, 沿 'x' 或 'z' 方向摆放 */
function propBed(x, y, z, dir, wool) {
  if (dir==='x') {
    setBlockRaw(x, y, z, 17); setBlockRaw(x+1, y, z, wool); setBlockRaw(x+2, y, z, wool);
  } else {
    setBlockRaw(x, y, z, 17); setBlockRaw(x, y, z+1, wool); setBlockRaw(x, y, z+2, wool);
  }
}
/* 沙发: len 个座位 + 墙侧靠背, face 为面朝方向 */
function propSofa(x, y, z, len, face, wool) {
  wool = wool || 15;
  for (let i=0; i<len; i++) {
    let sx=x; let sz=z; let bx=x; let bz=z;
    if (face==='n') {
      sx=x+i; bx=x+i; bz=z+1;
    }
    if (face==='s') {
      sx=x+i; bx=x+i; bz=z-1;
    }
    if (face==='e') {
      sz=z+i; bx=x-1; bz=z+i;
    }
    if (face==='w') {
      sz=z+i; bx=x+1; bz=z+i;
    }
    setBlockRaw(sx, y, sz, wool);
    setBlockRaw(bx, y+1, bz, wool);
  }
}
/* 桌子: w×d 桌面 + 四角木腿 */
function propTable(x, y, z, w, d, top) {
  for (let i=0; i<w; i++) {
    for (let j=0; j<d; j++) setBlockRaw(x+i, y+1, z+j, top||17);
  }
  setBlockRaw(x, y, z, 5); setBlockRaw(x+w-1, y, z, 5);
  setBlockRaw(x, y, z+d-1, 5); setBlockRaw(x+w-1, y, z+d-1, 5);
}
/* 椅子: 木板座 + 靠背, face 为面朝方向 */
function propChair(x, y, z, face) {
  setBlockRaw(x, y, z, 6);
  if (face==='n') setBlockRaw(x, y+1, z+1, 6);
  if (face==='s') setBlockRaw(x, y+1, z-1, 6);
  if (face==='e') setBlockRaw(x-1, y+1, z, 6);
  if (face==='w') setBlockRaw(x+1, y+1, z, 6);
}
/* 电视: 落地支架 + 履带屏幕 2 高, alongX 屏幕沿 x 还是 z 展开 */
function propTV(x, y, z, w, alongX) {
  for (let i=0; i<w; i++) {
    const sx = alongX ? x+i : x; const sz = alongX ? z : z+i;
    setBlockRaw(sx, y-1, sz, 6); // 落地支架
    setBlockRaw(sx, y, sz, 11); // 屏幕
    setBlockRaw(sx, y+1, sz, 11);
  }
}
/* 书架: w 宽 h 高, 彩色羊毛当"书", 木板收顶 */
function propShelf(x, y, z, w, h, alongX) {
  for (let i=0; i<w; i++) {
    for (let j=0; j<h; j++) {
      const sx = alongX ? x+i : x; const sz = alongX ? z : z+i;
      if (j===h-1) setBlockRaw(sx, y+j, sz, 6);
      else setBlockRaw(sx, y+j, sz, i%3===0 ? 16 : (i%3===1 ? 15 : 6));
    }
  }
}
/* 衣柜: 石英柜身 2 高 + 木头顶柜 */
function propWardrobe(x, y, z, w, alongX) {
  for (let i=0; i<w; i++) {
    const sx = alongX ? x+i : x; const sz = alongX ? z : z+i;
    setBlockRaw(sx, y, sz, 17); setBlockRaw(sx, y+1, sz, 17); setBlockRaw(sx, y+2, sz, 6);
  }
}
/* 床头柜 + 台灯 */
function propNightstand(x, y, z) {
  setBlockRaw(x, y, z, 5); setBlockRaw(x, y+1, z, 19);
}
/* 路灯柱: 木杆 ×2 + 灯块 */
function propLampPost(x, y, z) {
  setBlockRaw(x, y, z, 5); setBlockRaw(x, y+1, z, 5); setBlockRaw(x, y+2, z, 19);
}
/* 平地毯: 把地面顶层方块替换成羊毛(与地面齐平, 可自由踩踏) */
function propCarpet(x1, z1, x2, z2, y, id) {
  SceneKit.fill(x1, y, z1, x2, y, z2, id);
}
/* 石景堆: 圆石/苔石小丘, rad 为半径 */
function propBoulder(cx, cz, rad) {
  for (let dx=-rad; dx<=rad; dx++) {
    for (let dz=-rad; dz<=rad; dz++) {
      if (Math.abs(dx)+Math.abs(dz) > rad+ (rad>1?1:0)) continue; // 菱形轮廓更自然
      const h = 1 + Math.floor(SceneKit.rand(cx+dx, cz+dz, 21)*2); // 1~2 高
      for (let y=0; y<h; y++) setBlockRaw(cx+dx, 25+y, cz+dz, SceneKit.rand(cx+dx, cz+dz, 33)>0.5?4:14);
    }
  }
}

/* 平坦草原: 顶 y=grassY 草地, 下 4 层泥土, 其下石头; 保护区内不种树 */
function buildGrassField(grassY, px1, pz1, px2, pz2) {
  for (let x=0; x<WORLD_W; x++) {
    for (let z=0; z<WORLD_D; z++) {
      for (let y=0; y<=grassY-5; y++) setBlockRaw(x, y, z, 3);
      for (let y=grassY-4; y<grassY; y++) setBlockRaw(x, y, z, 2);
      setBlockRaw(x, grassY, z, 1);
      if ((x<px1||x>px2||z<pz1||z>pz2) && hashRand(x+53, z+91) > 0.988) {
        SceneKit.tree(x, grassY+1, z);
      }
    }
  }
}

/* ============================================================
   场景一: 二层小楼房 (地表 y20)
============================================================ */
function buildHouseScene() {
  const G = 20;
  buildGrassField(G, 52, 54, 74, 72);
  const x1=55; const x2=71; const z1=57; const z2=69; // 外墙范围

  /* 地基与地面 */
  SceneKit.fill(x1, G, z1, x2, G, z2, 4); // 圆石基座
  SceneKit.fill(x1+1, G, z1+1, x2-1, G, z2-1, 6); // 室内木地板(与草地齐平)

  /* 两层墙体: 木板 + 四角木柱 */
  for (const ya of [21, 26]) {
    SceneKit.fill(x1, ya, z1, x2, ya, z1, 6); SceneKit.fill(x1, ya, z2, x2, ya, z2, 6);
    SceneKit.fill(x1, ya, z1, x1, ya, z2, 6); SceneKit.fill(x2, ya, z1, x2, ya, z2, 6);
  }
  for (const c of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) {
    SceneKit.fill(c[0], 21, c[1], c[0], 29, c[1], 5);
  } // 角柱贯通两层

  /* 窗户 (玻璃 2 高) */
  const win = (x, y, z, alongX, w)=>{
    for (let i=0; i<w; i++) {
      const sx = alongX ? x+i : x; const sz = alongX ? z : z+i;
      setBlockRaw(sx, y, sz, 18); setBlockRaw(sx, y+1, sz, 18);
    }
  };
  for (const ya of [22, 27]) {
    win(57, ya, z1, true, 3); win(66, ya, z1, true, 3); // 北墙
    win(57, ya, z2, true, 2); win(67, ya, z2, true, 2); // 南墙(避开门)
    win(x1, ya, 61, false, 3); win(x2, ya, 61, false, 3); // 东西墙
  }
  SceneKit.fill(62, 21, z2, 63, 22, z2, 0); // 南侧大门门洞

  /* 一层顶楼板 y25 + 楼梯口 (东侧 x67..69, z61..63) */
  SceneKit.fill(x1, 25, z1, x2, 25, z2, 6);
  SceneKit.fill(67, 25, 61, 69, 25, 63, 0);
  /* 室内楼梯: 4 级向北爬升到楼板 */
  for (let i=0; i<4; i++) SceneKit.fill(67, 21+i, 64-i, 69, 21+i, 64-i, 6);
  for (let z=61; z<=65; z++) setBlockRaw(66, 26, z, 18); // 楼梯口玻璃护栏

  /* 人字坡屋顶 (红砖) + 山墙 + 烟囱 */
  for (let z=z1-1; z<=z2+1; z++) {
    const h = 30 + Math.min(z-(z1-1), (z2+1)-z);
    SceneKit.fill(x1-1, h, z, x2+1, h, z, 9);
    for (let y=30; y<h; y++) {
      setBlockRaw(x1, y, z, 6); setBlockRaw(x2, y, z, 6);
    }
  }
  SceneKit.fill(57, 30, 60, 57, 35, 60, 13); setBlockRaw(57, 36, 60, 19); // 烟囱

  /* ---- 一层: 客厅(西) + 厨房(东) ---- */
  propCarpet(57, 60, 62, 64, G, 16); // 红色客厅地毯(嵌入地面)
  propSofa(58, 21, 64, 4, 'n', 15); // 蓝沙发面朝电视
  propTable(59, 21, 61, 2, 2, 17); // 石英茶几
  propTV(58, 22, 58, 4, true); // 电视挂北墙
  propShelf(56, 21, 60, 3, 3, false); // 西墙书架
  SceneKit.fill(70, 21, 58, 70, 21, 64, 12); // 厨台(金属)
  setBlockRaw(70, 21, 59, 11); setBlockRaw(70, 21, 62, 17); // 灶台/水槽
  SceneKit.fill(70, 21, 66, 70, 22, 67, 17); // 冰箱(石英)
  propTable(65, 21, 63, 3, 2, 6); // 餐桌
  propChair(65, 21, 61, 'n'); propChair(67, 21, 61, 'n');
  propChair(65, 21, 66, 's'); propChair(67, 21, 66, 's');
  for (const l of [[59, 61], [66, 61], [59, 66], [66, 66]]) {
    setBlockRaw(l[0], 25, l[1], 19);
  } // 一层吸顶灯
  propCarpet(62, 70, 63, 73, G, 4); // 门外圆石小径
  propLampPost(60, 21, 71); // 门廊路灯
  /* 院子: 两棵树 + 门前花坛 */
  SceneKit.tree(52, 21, 64); SceneKit.tree(74, 21, 64);
  for (let i=0; i<4; i++) {
    setBlockRaw(57+i, 21, 72, i%2?16:15);
    setBlockRaw(66+i, 21, 72, i%2?16:15);
  }

  /* ---- 二层: 主卧(西) + 儿童房(东) ---- */
  SceneKit.fill(65, 26, 58, 65, 27, 62, 6); // 隔断墙(南侧留门)
  propBed(57, 26, 61, 'z', 16); propBed(58, 26, 61, 'z', 16); // 双人床(红)
  propNightstand(56, 26, 61); propNightstand(59, 26, 61);
  propWardrobe(56, 26, 66, 3, true); // 衣柜
  propCarpet(57, 62, 63, 66, 25, 15); // 卧室地毯(嵌入楼板)
  propBed(67, 26, 58, 'z', 15); // 儿童床(蓝,避让楼梯口)
  propTable(68, 26, 63, 2, 1, 6); // 书桌
  propChair(68, 26, 64, 'n');
  propShelf(70, 26, 66, 3, false); // 玩具架
  for (const l of [[x1, 61], [x1, 65], [x2, 61], [x2, 65]]) {
    setBlockRaw(l[0], 28, l[1], 19);
  } // 二层壁灯
}

/* ============================================================
   场景二: 巨大地下室 (地表 y24 · 大厅立足层 y18)
============================================================ */
function buildBasementScene() {
  const G = 24;
  buildGrassField(G, 40, 26, 108, 92); // 保护大厅/入口/花园/池塘区域

  /* ---- 地下大厅: 42×34 石砖壳, 内部 40×32 × 高5 ---- */
  const x1=43; const x2=84; const z1=43; const z2=76;
  SceneKit.fill(x1, 17, z1, x2, 23, z2, 13); // 石砖整块
  SceneKit.fill(x1+1, 18, z1+1, x2-1, 22, z2-1, 0); // 掏空内部 (y18..22)
  SceneKit.fill(56, 17, 50, 73, 17, 63, 6); // 客厅区木地板(嵌入)

  /* 立柱 + 吊灯 + 壁灯 */
  for (const p of [[52, 46], [52, 64], [52, 72], [60, 46], [60, 72], [76, 46], [76, 64], [76, 72]]) {
    SceneKit.fill(p[0], 18, p[1], p[0], 22, p[1], 4);
  }
  for (const lx of [48, 56, 64, 72, 80]) {
    for (const lz of [48, 58, 68]) setBlockRaw(lx, 23, lz, 19);
  }
  for (const w of [[43, 50], [43, 62], [84, 50], [84, 62], [50, 43], [58, 43], [75, 43]]) {
    setBlockRaw(w[0], 20, w[1], 19);
  }

  /* ---- 地表入口小屋 (红砖) ---- */
  SceneKit.fill(62, 25, 80, 66, 27, 84, 9);
  SceneKit.fill(63, 25, 81, 65, 27, 83, 0);
  SceneKit.fill(62, 28, 80, 66, 28, 84, 6); // 木板顶
  setBlockRaw(64, 28, 82, 19);
  SceneKit.fill(63, 25, 84, 64, 26, 84, 0); // 南门洞

  /* ---- 下行阶梯隧道: 7 级台阶 y24→y18 直通大厅 ---- */
  for (let i=0; i<=6; i++) {
    const z=80-i; const sY=23-i; const cT=sY+4;
    SceneKit.fill(63, 12, z, 64, sY, z, 13); // 台阶及基座
    SceneKit.fill(63, sY+1, z, 64, cT, z, 0); // 头顶净空
    const wallTop = Math.min(cT, 24); // 近地表处与草地齐平
    SceneKit.fill(62, 12, z, 62, wallTop, z, 13); // 侧墙
    SceneKit.fill(65, 12, z, 65, wallTop, z, 13);
    if (i%3===1) {
      setBlockRaw(62, sY+2, z, 19); setBlockRaw(65, sY+2, z, 19);
    } // 阶梯壁灯
  }

  /* ---- 客厅区 (西) ---- */
  propCarpet(45, 53, 52, 61, 17, 16); // 红地毯
  propTV(44, 19, 54, 4, false); // 大电视靠西墙
  propSofa(48, 18, 54, 4, 'w', 15); // 主沙发
  propSofa(46, 18, 60, 3, 'n', 15); // L 型副沙发
  propSofa(48, 18, 58, 1, 'w', 15);
  propTable(46, 18, 55, 2, 2, 17); // 茶几

  /* ---- 卧室区 (东北角) ---- */
  propCarpet(77, 45, 82, 50, 17, 15);
  propBed(78, 18, 46, 'z', 16); propBed(80, 18, 46, 'z', 15);
  propNightstand(77, 18, 46); propNightstand(81, 18, 46);
  propWardrobe(78, 18, 44, 3, true);

  /* ---- 厨房 + 餐厅 (东南) ---- */
  SceneKit.fill(50, 18, 74, 62, 18, 74, 12); // 厨台
  setBlockRaw(54, 18, 74, 11); setBlockRaw(58, 18, 74, 17);
  SceneKit.fill(63, 18, 74, 63, 19, 74, 17); // 冰箱
  propTable(53, 18, 67, 3, 3, 6); // 大餐桌
  propChair(52, 18, 67, 'e'); propChair(56, 18, 67, 'w');
  propChair(52, 18, 69, 'e'); propChair(56, 18, 69, 'w');
  propChair(53, 18, 70, 'n'); propChair(55, 18, 70, 'n');

  /* ---- 书房区 (西北) ---- */
  propShelf(45, 18, 44, 3, 3, true); propShelf(49, 18, 44, 3, 3, true);
  propTable(45, 18, 47, 2, 1, 17); propChair(45, 18, 48, 'n');
  propTable(49, 18, 47, 2, 1, 17); propChair(49, 18, 48, 'n');
  setBlockRaw(46, 20, 47, 19); // 桌上台灯

  /* ---- 中央游戏区: 8×8 棋盘 + 观棋座 ---- */
  for (let i=0; i<8; i++) {
    for (let j=0; j<8; j++) {
      setBlockRaw(62+i, 17, 66+j, (i+j)%2 ? 15 : 16);
    }
  }
  for (const s of [[61, 67], [70, 67], [61, 72], [70, 72]]) setBlockRaw(s[0], 18, s[1], 5);
  propLampPost(45, 18, 72); propLampPost(82, 18, 44);

  /* ---- 北侧大阶梯: 大厅直上地面 (3宽 x63..65, 7 级) ---- */
  for (let i=0; i<=6; i++) {
    const z=43-i; const top=19+i; const sY=top-1;
    SceneKit.fill(63, sY, z, 65, sY, z, 13); // 台阶
    SceneKit.fill(63, top, z, 65, top+3, z, 0); // 头顶净空
    const wTop=Math.min(top+3, 24);
    SceneKit.fill(62, sY, z, 62, wTop, z, 13); // 侧墙
    SceneKit.fill(66, sY, z, 66, wTop, z, 13);
    if (i%3===1) {
      setBlockRaw(62, top+1, z, 19); setBlockRaw(66, top+1, z, 19);
    } // 壁灯
  }
  /* 地面出口凉亭 + 圆石广场小径 */
  for (const p of [[61, 36], [67, 36], [61, 41], [67, 41]]) {
    SceneKit.fill(p[0], 25, p[1], p[0], 27, p[1], 5); setBlockRaw(p[0], 28, p[1], 19); // 木柱+柱灯
  }
  SceneKit.fill(60, 28, 35, 68, 28, 41, 6); // 凉亭木板顶
  propCarpet(61, 34, 67, 36, 24, 4); // 圆石广场(嵌地面)
  propCarpet(63, 26, 64, 33, 24, 4); // 北向小径
  propCarpet(63, 85, 64, 88, 24, 4); // 小屋南向小径
  propLampPost(61, 25, 29); propLampPost(66, 25, 29);
  /* 花坛 + 绿篱 */
  for (let i=0; i<8; i++) setBlockRaw(71+(i%4)*2, 25, 33+Math.floor(i/4)*3, i%2?16:15);
  setBlockRaw(70, 25, 35, 7); setBlockRaw(70, 25, 38, 7); setBlockRaw(79, 25, 36, 7);
  /* 小树林: 大厅草坪上空 + 东侧野外 */
  for (let x=45; x<=82; x++) {
    for (let z=45; z<=74; z++) {
      if (x>=62&&x<=65&&z>=70) continue; // 南口阶梯区留空
      if (SceneKit.rand(x, z, 7) > 0.982) SceneKit.tree(x, 25, z);
    }
  }
  for (let x=88; x<=100; x++) {
    for (let z=45; z<=74; z++) {
      if (SceneKit.rand(x, z, 13) > 0.987) SceneKit.tree(x, 25, z);
    }
  }
  /* 池塘: 沙岸 + 清水(可趟水) */
  for (let x=93; x<=104; x++) {
    for (let z=28; z<=38; z++) {
      const r=Math.hypot(x-98.5, z-33);
      if (r<4.4) {
        setBlockRaw(x, 24, z, r<3.5?B_WATER:8); setBlockRaw(x, 23, z, 8);
      }
    }
  }
  propLampPost(92, 25, 33);
  /* 石景堆 */
  propBoulder(48, 88, 2); propBoulder(100, 84, 2); propBoulder(91, 28, 1);
}

/* ============================================================
   场景注册 / 存档
============================================================ */
const BUILD_SCENES = [
  {id: 'basement', name: '巨大地下室', icon: 'basement', /* 按钮像素图标键(button-icons.js) */
    desc: '40×32 超大地下大厅<br>客厅·卧室·书房·棋盘室<br>北侧阶梯直达地面花园',
    spawn: {x: 65.5, y: 18, z: 69.5, yaw: 0},
    build: buildBasementScene},
  {id: 'house', name: '二层小楼房', icon: 'house',
    desc: '带院子的小家<br>一层客厅厨房 · 二层两间卧室',
    spawn: {x: 63.5, y: 21, z: 66.5, yaw: 0},
    build: buildHouseScene},
];
function buildSpawnAt(sc) {
  ModeKit.spawn(sc.spawn.x, sc.spawn.y, sc.spawn.z, {yaw: sc.spawn.yaw}); // 经 kit 记住出生点
  setFly(false); // 出生步行(飞行态走意图入口, 白名单见 voxel.js 玩家段)
}

/* 存档: 当前场景 + 各场景改动表 (跨设备云同步); Map↔entries 编解码收进槽 */
const buildSlot = SyncDB.slot(BUILD_SAVE_KEY, {
  defaults: {scene: null, edits: {}},
  encode: (st) => ({scene: st.scene,
    edits: Object.fromEntries(Object.keys(st.edits).map((id) => [id, [...st.edits[id].entries()]]))}),
  decode: (sv) => ({scene: sv.scene,
    edits: Object.fromEntries(Object.keys(sv.edits || {}).map((id) => [id, new Map(sv.edits[id])]))}),
});
/* 世界改动日志(WorldJournal, js/world-journal-core.js): 账本/脏标/5s 节流/
   关页兜底/双通道重放收编深模块; 建造适配器只出档形政策——payload 带当前
   场景与全部分桶, 超限守卫(toast)拦下则不落盘不清脏(下个节流窗重试) */
const buildJournal = mkWorldJournal(buildSlot, {
  payload: () => ({scene: buildSceneId, edits: buildEdits}),
  overSize: (p) => {
    /* 服务端 POST 上限 200KB(server.js): 超限会被静默拒收 — 存前粗测并提示,
       免得重度建造的进度"看起来存了其实没存" */
    try {
      if (JSON.stringify(p).length > 190000) {
        showToast('⚠ 存档太大了，试试按 R 重置场景', 3000);
        return true;
      }
    } catch (e) {}
    return false;
  },
});
function buildLoadSave() {
  const s = buildJournal.load(); /* edits 是分桶对象 → journal 不收养, 这里合并各桶 */
  if (s && s.edits) {
    for (const id of Object.keys(s.edits)) buildEdits[id] = s.edits[id]; return s.scene || null;
  }
  return null;
}

/* 加载场景: 生成 → 应用玩家改动 → 重建 → 出生 */
function buildLoadScene(id) {
  const sc = BUILD_SCENES.find((s)=>s.id===id) || BUILD_SCENES[0];
  buildSceneId = sc.id;
  if (!buildEdits[sc.id]) buildEdits[sc.id] = new Map();
  buildJournal.edits = buildEdits[sc.id]; /* 当前桶换装进 journal(记账/重放/尺寸全走它) */
  loadScene(()=>{
    sc.build();
    buildJournal.replay({block: setBlockRaw, fluid: setFluidLv}); /* 双通道重放(liquid D8): 流体格→方块+水位 */
  });
  buildSpawnAt(sc);
  buildJournal.touch(); // 记住当前场景(scene 随档走, 脏标驱动 5s 节流)
}
function buildResetScene() {
  buildJournal.edits.clear();
  const sc = BUILD_SCENES.find((s)=>s.id===buildSceneId);
  loadScene(()=> sc.build()); buildSpawnAt(sc);
  buildJournal.touch();
  buildJournal.flush();
  showToast('已重置「' + sc.name + '」', 2000);
}

/* ---------- 物品栏: hotbar 由 mode-kit 的 buildHb 接管 ---------- */

/* ---------- 场景选择页 ---------- */
function buildSceneMenu() {
  const grid = document.getElementById('buildScenes');
  grid.innerHTML = '';
  BUILD_SCENES.forEach((sc)=>{
    const div = document.createElement('div');
    div.className = 'scene-card' + (sc.id===buildSceneId ? ' active' : '');
    div.innerHTML = `<div class="big">${btnImg(sc.icon)}</div><h2>${sc.name}</h2><small>${sc.desc}</small>`;
    div.onclick = ()=>{
      if (buildSceneId !== sc.id) {
        buildLoadScene(sc.id); buildJournal.flush();
      }
      requestLock();
    };
    grid.appendChild(div);
  });
  const enter = document.getElementById('buildEnterBtn');
  if (enter) enter.onclick = ()=> requestLock();
}

/* 飞行开关 (键盘 F 与触屏 ✈️ 按钮共用, 不再自引用 BuildMode) */
function buildToggleFly() {
  setFly(!flyMode); // 读旧值定新态(读不是写), 清坠速语义收在意图入口
  showToast(flyMode ? '✈️ 飞行开启：空格上升 · Shift 下降' : '🚶 飞行关闭', 2200);
  if (typeof Input !== 'undefined' && Input && typeof Input.refreshUI === 'function') {
    Input.refreshUI(); /* 触屏下降键随飞行亮出(MC: 下箭头飞行中变下降) */
  }
}

/* ---------- 触屏长按连挖(每 250ms 一块; 与桌面单击同路) ----------
    目标跟随指尖(CameraRig.aim 在长按期间被 holdAim 覆盖); 基岩层静默跳过
    (单击仍有"挖不动"提示, 连挖不刷屏)。防误触不在连挖上加延迟(MC 创造
    800ms 的目的): 本作轻点=放置(可逆无损) 而非破坏, 且长按需静止满
    250ms 才成手势 — 门槛本身即防误触, 见 docs/touch-controls-design.md §6。 */
let buildHoldOn = false; let buildHoldT = 0;
function buildHoldStep(dt) {
  if (!buildHoldOn) return;
  buildHoldT += dt;
  if (buildHoldT < 0.25) return;
  buildHoldT = 0;
  const aim = CameraRig.aim(camera);
  const hit = raycastVoxel(aim.origin, aim.dir, PLAYER.reach);
  if (!hit || hit.y === 0) return; /* 指空/基岩: 静默等下一拍 */
  BuildMode.onMouse(0, hit);
}

/* ---------- 模式对象 ---------- */
const BuildMode = mkMode({
  id: 'build',
  chrome: {score: 'none', hotbar: 'flex'},
  hotbar: buildHb,
  touch: [ /* ⛏️ 智能主动作键(手持感知, 用户拍板 2026-10-24): 选中方块→放置一次
     (mkMainAct 返 false 不连发 — 儿童向刻意偏离: MC 按住实为连放, 见
     docs/mc-held-item-action-research.md Q3), 铲子槽→挖起步+按住连挖
     (250ms/块); 画布轻点仍是放置; ✈️ 飞行开关 */
    {icon: 'shovel', label: '挖/放', holdAct: mkMainAct(buildHeld.isBlock)},
    {icon: 'fly', label: '飞行', act: ()=>buildToggleFly()},
  ],
  init() {
    if (!buildSceneId) buildSceneId = buildLoadSave() || BUILD_SCENES[0].id;
    /* 流体账本缝(liquid D8): 流体写格(流动/消退/混合/冲毁)即时入当前场景 edits
       账本——逐格最后写赢, 重进精确恢复水位; 流体格带 {id,lv}, 其余保持数字 */
    setFluidEditSink((x, y, z, id, lv) => {
      buildJournal.mark(blockKey(x, y, z), fluidCell(id, lv, BLOCKS));
      /* 流体写格入节流窗: 漏置位 → 只动水时永不触发 5s 落盘, 关页即丢水位(mark 自带置脏) */
    });
    buildLoadScene(buildSceneId);
    buildSceneMenu();
    buildHb.select(1); /* 默认选中第 2 格方块: 第 1 格铁锹是显式挖掘入口, 拿方块进场即放置态 */
    buildHeld.sync(); /* 手持观感对齐选中槽(select 同格不触发 onPick, 显式兜底) */
  },
  onPageHide() {/* 关页兜底存档(main.js pagehide 收口, 2026-10 树苗丢档修复同款):
      世界档 5s 节流窗口内直接关页/刷新 → 窗口内的建造改动全丢; 这里同步落盘
      (localStorage 同步写, pagehide 内安全), 服务器 push 由 main.js 统一补发 */
    buildJournal.pageHide();
  },
  cleanup() {
    buildJournal.flush();
    setFluidEditSink(null); /* 流体账本缝解除(liquid D8: 不渗进其他模式) */
    setFly(false); /* 飞行态复位走意图入口 */
    buildHoldOn = false; /* 长按连挖场: 退出模式即收 */
    Avatar.setItem(PLAYER.heldItem); /* 手持物复位(Avatar 跨模式存活, 照下界先例) */
  },
  buildMenu() {
    buildSceneMenu();
  }, // 打开菜单页时刷新高亮
  update(dt) {
    buildHoldStep(dt); /* 触屏长按连挖(桌面不触发: buildHoldOn 恒 false) */
    buildJournal.tick(); /* 世界存档节流 5s(探险同款, 时序收编 journal) */
  },
  /* 触屏长按起止(input.js 手势路由): 连挖计时器复位 */
  onHold(active) {
    buildHoldOn = active;
    buildHoldT = 0;
  },
  onKey(code) {
    if (code==='KeyF') buildToggleFly();
    if (code==='KeyR') buildResetScene();
  },
  onMouse(button, hit) {
    if (!hit) return;
    let x; let y; let z; let id;
    if (button === 0) { // 挖
      if (hit.y === 0) {
        showToast('🪨 底层基岩挖不动哦'); return;
      } // 底层保护, 防挖穿坠出世界
      x=hit.x; y=hit.y; z=hit.z; id=0;
    } else if (button === 2) { // 放
      if (!buildHeld.isBlock()) return; // 铲子槽不放置(手持感知: 拿铲子=挖, MC 拿工具右键无操作同构)
      x=hit.x+hit.nx; y=hit.y+hit.ny; z=hit.z+hit.nz;
      if (getBlock(x, y, z)!==0) return;
      if (collidesAtPlayer(x, y, z)) return;
      id = BUILD_PALETTE[buildHb.sel];
    } else return;
    const removed = editBlock(x, y, z, id);
    /* 记账供存档(liquid D8): 流体格带 {id,lv}(放置=源 lv0), 其余保持数字
       (编码判据单份在 world-journal-core 的 fluidCell); mark 自带置脏 */
    buildJournal.mark(blockKey(x, y, z), fluidCell(id, 0, BLOCKS));
    for (const r of removed) {/* 级联同记(D5/D7): 移动两格(原格 0+落格 id), 移除一格 */
      buildJournal.mark(blockKey(r.x, r.y, r.z), 0);
      if (r.to) buildJournal.mark(blockKey(r.to.x, r.to.y, r.to.z), r.id);
    }
  },
  onVoidFall() { // 保留自定义: 回出生点时需同时关飞行
    const sc = BUILD_SCENES.find((s)=>s.id===buildSceneId);
    if (sc) buildSpawnAt(sc);
  },
  hud(hit) {
    const sc = BUILD_SCENES.find((s)=>s.id===buildSceneId);
    return [
      `场景: ${sc?sc.name:'-'} · 已建造 ${buildEdits[buildSceneId].size} 块`,
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      `FPS: ${fps}${flyMode?' · <b>✈️ 飞行中</b>':''}`,
      `手持: ${buildHeld.isBlock() ? BLOCKS[buildHeld.itemId()].name : '铁锹'} · 注视: ${ModeKit.lookName(hit)}`,
      `F 飞行 · R 重置场景 · B 菜单`,
    ];
  },
});

