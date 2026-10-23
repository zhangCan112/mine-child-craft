'use strict';
/* ============================================================
   贴图图集 (TextureAtlas) — 引擎层 (术语见 GLOSSARY.md 的"网格化核心")
   ------------------------------------------------------------
   程序化 16×16 像素画风方块贴图图集: 新方块 36~50 全量(四矿嵌斑/草丛/
   耕地/麦四阶段/工作台/熔炉/火把/树苗/黏土) + 存量基础方块升级款(草顶/
   泥土/石头颗粒/圆石/木板缝/木头年轮树皮/树叶孔洞/沙子颗粒)。风格参考
   我的世界的观感语言, 像素全部自绘(零外部素材, 版权口径见设计稿 D13)。
   像素先写进纯数据缓冲(Uint8ClampedArray), 画布只是壳(makeCanvas 惰性
   创建) — Node 可逐像素直测; 噪点/斑点全用种子化伪随机, 同 seed 同图。
   layout(方块id→格号)是网格化核心的 UV 契约: 经 opts.atlas 注入
   MeshCore(与 tntTiles 同惯例), Worker 侧 importScripts 本文件共读;
   未入集方块(下界系/羊毛/装饰)仍走 faceColor 纯色兜底。
   interface: layout{cols,rows,tiles} / count 已绘制格数 / paintAll()→
     {w,h,pixels} / tileUV(idx)→[u0,v0,u1,v1] / makeCanvas(doc)→canvas
   依赖(均经全局名, 加载序解析): config.js 的 B_* 方块 id 常量
     (index.html 里在 mesh-core.js 之后、world.js 之前加载)。
   可测性声明: 零 THREE · 零 Math.random · 像素段零 DOM 有单测
     (test/texture-atlas.test.js); 画布壳的 doc 由调用方注入(测试桩)。
   ============================================================ */
const TextureAtlas = (() => {
  const TILE = 16; // 每格格边(像素): MC 经典方块贴图分辨率
  const COLS = 16; const ROWS = 16; // 16×16 格 = 29 格余量充足
  const SIZE = TILE * COLS; // 256: 正方形 2 的幂 — WebGL1 mipmap 约束(TNT 图集同款)

  /* ---------- 确定性伪随机(mulberry32): 每格派生一个种子 ----------
     同 seed 同图 — "程序化生成"的存档口径: 两次开局图集逐像素一致 */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 格号分配(行优先, 16 格/行) ----------
     布局即渲染契约(MeshCore UV 与本表共读); 相邻格刻意同色系,
     降低远处 mipmap 混采样时的跨格串色(TNT 图集"缓冲垫"同源问题)。 */
  const T_GRASS_TOP = 0; const T_GRASS_SIDE = 1; const T_DIRT = 2;
  const T_STONE = 3; const T_COBBLE = 4; const T_SAND = 5;
  const T_LOG_TOP = 6; const T_LOG_SIDE = 7; const T_PLANKS = 8; const T_LEAVES = 9;
  const T_COAL_ORE = 10; const T_IRON_ORE = 11; const T_GOLD_ORE = 12; const T_DIAMOND_ORE = 13;
  const T_TUFT = 14; const T_FARMLAND_TOP = 15;
  const T_FARMLAND_SIDE = 16; const T_WHEAT_0 = 17; const T_WHEAT_1 = 18;
  const T_WHEAT_2 = 19; const T_WHEAT_3 = 20;
  const T_CRAFT_TOP = 21; const T_CRAFT_SIDE = 22;
  const T_FURNACE_TOP = 23; const T_FURNACE_SIDE = 24; const T_FURNACE_BOTTOM = 25;
  const T_TORCH = 26; const T_CLAY = 27; const T_SAPLING = 28;

  /* ---------- 像素绘制工具(全在 16×16 RGBA 缓冲上, 无 2d 上下文) ---------- */
  const mkTile = ()=> new Uint8ClampedArray(TILE * TILE * 4); // 默认全 0 = 透明
  function setP(px, x, y, c, a) {
    if (x < 0 || x >= TILE || y < 0 || y >= TILE) return;
    const o = (y * TILE + x) * 4;
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = a === undefined ? 255 : a;
  }
  /* 底色 + 明暗噪点(amp=波动幅度): 石/土/沙"颗粒感"的铺底笔触 */
  function noiseFill(px, rng, base, amp) {
    for (let y=0; y<TILE; y++) {
      for (let x=0; x<TILE; x++) {
        const v = 1 + (rng() * 2 - 1) * amp;
        setP(px, x, y, [base[0] * v, base[1] * v, base[2] * v]);
      }
    }
  }
  /* 石头底: 浅噪 + 深色小坑簇(矿石四格共用的底子) */
  const STONE = [128, 128, 135]; // 锚定 config faceColor 石头色 ×255, 观感连续
  function stoneBase(px, rng) {
    noiseFill(px, rng, STONE, 0.05);
    for (let i=0; i<14; i++) {
      const x = Math.floor(rng() * TILE); const y = Math.floor(rng() * TILE);
      setP(px, x, y, [110, 110, 117]);
      if (rng() < 0.5) setP(px, x + 1, y, [110, 110, 117]);
    }
  }
  /* 矿斑: n 簇 2×2 主斑 + 尾巴像素 + 1 像素高光(MC 矿石嵌斑观感) */
  function oreSpots(px, rng, dark, light, n) {
    for (let i=0; i<n; i++) {
      const x = 1 + Math.floor(rng() * (TILE - 4)); const y = 1 + Math.floor(rng() * (TILE - 4));
      setP(px, x, y, dark); setP(px, x + 1, y, dark);
      setP(px, x, y + 1, dark); setP(px, x + 1, y + 1, dark);
      if (rng() < 0.7) setP(px, x + (rng() < 0.5 ? -1 : 2), y + (rng() < 0.5 ? 0 : 1), dark);
      setP(px, x, y, light);
    }
  }
  /* 木板底: 4 行一板, 板缝/竖缝错位/钉点(工作台两格复用) */
  function planksBase(px, rng) {
    for (let b=0; b<4; b++) {
      const y0 = b * 4; const tint = 1 + (rng() * 2 - 1) * 0.05; // 板条各自基调
      for (let y=y0; y<y0+4; y++) {
        for (let x=0; x<TILE; x++) {
          const v = tint * (1 + (rng() * 2 - 1) * 0.04);
          setP(px, x, y, [168 * v, 133 * v, 84 * v]);
        }
      }
      for (let x=0; x<TILE; x++) setP(px, x, y0 + 3, [120, 92, 55]); // 板缝横线
      const sx = 2 + Math.floor(rng() * 12);
      for (let y=y0; y<y0+3; y++) setP(px, sx, y, [132, 102, 62]); // 竖缝(逐板错位)
      setP(px, sx < 8 ? 1 : 14, y0 + 1, [96, 72, 42]); // 钉点
    }
  }
  /* 麦: 自底向上 h 高的秸秆, head=麦穗色(熟麦加粗穗头) */
  function wheatBase(px, rng, h, stalk, head) {
    for (let i=0; i<7; i++) {
      const x = 1 + Math.floor(rng() * 14);
      for (let y=0; y<h; y++) setP(px, x, 15 - y, stalk);
      if (head) {
        const top = 15 - h;
        setP(px, x, top, head);
        setP(px, x - 1, top + 1, head); setP(px, x + 1, top + 1, head);
      }
    }
  }

  /* ---------- 逐格画师: PAINTERS[格号] = (px, rng) => void ---------- */
  const PAINTERS = [];
  PAINTERS[T_GRASS_TOP] = (px, rng)=>{
    noiseFill(px, rng, [110, 189, 87], 0.07); // 草地绿锚定 faceColor
    for (let i=0; i<18; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [86, 152, 66]);
  };
  PAINTERS[T_GRASS_SIDE] = (px, rng)=>{
    noiseFill(px, rng, [140, 102, 69], 0.09); // 泥土壁
    for (let x=0; x<TILE; x++) {
      for (let y=0; y<3; y++) { // 顶 3 行草皮(带噪)
        const v = 1 + (rng() * 2 - 1) * 0.08;
        setP(px, x, y, [110 * v, 189 * v, 87 * v]);
      }
      if (rng() < 0.45) setP(px, x, 3, [100, 170, 78]); // 草沿下垂的牙齿
    }
  };
  PAINTERS[T_DIRT] = (px, rng)=>{
    noiseFill(px, rng, [140, 102, 69], 0.09);
    for (let i=0; i<8; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [116, 82, 55]);
    for (let i=0; i<5; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [162, 122, 84]);
  };
  PAINTERS[T_STONE] = stoneBase;
  PAINTERS[T_COBBLE] = (px, rng)=>{
    noiseFill(px, rng, [96, 96, 102], 0.04); // 深灰缝底
    for (let i=0; i<5; i++) { // 圆石块: 3~5px 见方, 顶缘亮
      const w = 3 + Math.floor(rng() * 3); const h = 3 + Math.floor(rng() * 2);
      const x = Math.floor(rng() * (TILE - w)); const y = Math.floor(rng() * (TILE - h));
      for (let dy=0; dy<h; dy++) {
        for (let dx=0; dx<w; dx++) {
          const v = 1 + (rng() * 2 - 1) * 0.05;
          setP(px, x + dx, y + dy, [138 * v, 138 * v, 145 * v]);
        }
      }
      for (let dx=0; dx<w; dx++) setP(px, x + dx, y, [158, 158, 166]);
    }
  };
  PAINTERS[T_SAND] = (px, rng)=>{
    noiseFill(px, rng, [219, 201, 140], 0.05);
    for (let i=0; i<10; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [190, 170, 110]);
  };
  PAINTERS[T_LOG_TOP] = (px, rng)=>{
    noiseFill(px, rng, [102, 77, 51], 0.06); // 树皮边
    for (let y=2; y<14; y++) {
      for (let x=2; x<14; x++) { // 内里木色
        const v = 1 + (rng() * 2 - 1) * 0.04;
        setP(px, x, y, [158 * v, 128 * v, 84 * v]);
      }
    }
    const ring = (r)=>{ // 同心年轮(方环)
      for (let i=8-r; i<=8+r; i++) {
        setP(px, i, 8-r, [128, 100, 62]); setP(px, i, 8+r, [128, 100, 62]);
        setP(px, 8-r, i, [128, 100, 62]); setP(px, 8+r, i, [128, 100, 62]);
      }
    };
    ring(3); ring(1);
    setP(px, 8, 8, [170, 140, 94]); // 木心
  };
  PAINTERS[T_LOG_SIDE] = (px, rng)=>{
    for (let x=0; x<TILE; x++) { // 竖条纹: 每列基调深浅 + 行内微噪
      const colV = 1 + (rng() * 2 - 1) * 0.16;
      for (let y=0; y<TILE; y++) {
        const v = colV * (1 + (rng() * 2 - 1) * 0.05);
        setP(px, x, y, [102 * v, 77 * v, 51 * v]);
      }
    }
    for (let i=0; i<5; i++) { // 亮疤
      const x = Math.floor(rng()*TILE); const y = Math.floor(rng()*TILE);
      setP(px, x, y, [140, 110, 74]);
      if (rng() < 0.5) setP(px, x, y + 1, [140, 110, 74]);
    }
  };
  PAINTERS[T_PLANKS] = planksBase;
  PAINTERS[T_LEAVES] = (px, rng)=>{
    noiseFill(px, rng, [51, 128, 56], 0.14); // 强噪叶团
    for (let i=0; i<10; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [34, 96, 40]);
    for (let i=0; i<9; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [0, 0, 0], 0); // 孔洞透隙
  };
  PAINTERS[T_COAL_ORE] = (px, rng)=>{
    stoneBase(px, rng); oreSpots(px, rng, [30, 30, 32], [70, 70, 74], 4);
  };
  PAINTERS[T_IRON_ORE] = (px, rng)=>{
    stoneBase(px, rng); oreSpots(px, rng, [196, 156, 126], [226, 190, 162], 4);
  };
  PAINTERS[T_GOLD_ORE] = (px, rng)=>{
    stoneBase(px, rng); oreSpots(px, rng, [238, 190, 62], [255, 232, 130], 4);
  };
  PAINTERS[T_DIAMOND_ORE] = (px, rng)=>{
    stoneBase(px, rng); oreSpots(px, rng, [70, 200, 194], [158, 244, 240], 4);
  };
  PAINTERS[T_TUFT] = (px, rng)=>{ // 草丛十字面片: 透明底 + 9 根草叶
    for (let i=0; i<9; i++) {
      const x = 1 + Math.floor(rng() * 14); const h = 4 + Math.floor(rng() * 7);
      const g = rng() < 0.5 ? [96, 164, 72] : [70, 140, 58];
      for (let y=0; y<h; y++) { // 近顶随机弯头
        const bend = (y > h - 3 && rng() < 0.4) ? (rng() < 0.5 ? -1 : 1) : 0;
        setP(px, x + bend, 15 - y, g);
      }
    }
  };
  PAINTERS[T_FARMLAND_TOP] = (px, rng)=>{
    noiseFill(px, rng, [92, 62, 36], 0.07); // 深湿土
    for (const y of [1, 5, 9, 13]) { // 沟垄
      for (let x=0; x<TILE; x++) {
        setP(px, x, y, [66, 44, 25]); setP(px, x, y + 1, [74, 50, 29]);
      }
    }
    for (let i=0; i<6; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [116, 84, 52]); // 土坷垃
  };
  PAINTERS[T_FARMLAND_SIDE] = (px, rng)=>{
    PAINTERS[T_DIRT](px, rng);
    for (let x=0; x<TILE; x++) {
      for (let y=0; y<2; y++) { // 顶 2 行湿土沿
        const v = 1 + (rng() * 2 - 1) * 0.06;
        setP(px, x, y, [92 * v, 62 * v, 36 * v]);
      }
    }
  };
  PAINTERS[T_WHEAT_0] = (px, rng)=>wheatBase(px, rng, 4, [122, 180, 66], null);
  PAINTERS[T_WHEAT_1] = (px, rng)=>wheatBase(px, rng, 7, [104, 170, 60], null);
  PAINTERS[T_WHEAT_2] = (px, rng)=>wheatBase(px, rng, 11, [150, 170, 54], null);
  PAINTERS[T_WHEAT_3] = (px, rng)=>wheatBase(px, rng, 14, [201, 174, 61], [232, 204, 92]);
  PAINTERS[T_CRAFT_TOP] = (px, rng)=>{
    planksBase(px, rng);
    for (let i=0; i<TILE; i++) { // 外框
      setP(px, i, 0, [110, 84, 50]); setP(px, i, 15, [110, 84, 50]);
      setP(px, 0, i, [110, 84, 50]); setP(px, 15, i, [110, 84, 50]);
    }
    for (let i=4; i<12; i++) { // 台面网格框
      setP(px, i, 4, [128, 98, 60]); setP(px, i, 11, [128, 98, 60]);
      setP(px, 4, i, [128, 98, 60]); setP(px, 11, i, [128, 98, 60]);
    }
    setP(px, 4, 4, [96, 72, 42]); setP(px, 11, 4, [96, 72, 42]);
    setP(px, 4, 11, [96, 72, 42]); setP(px, 11, 11, [96, 72, 42]);
  };
  PAINTERS[T_CRAFT_SIDE] = (px, rng)=>{
    planksBase(px, rng);
    for (let x=0; x<TILE; x++) { // 顶沿深带
      setP(px, x, 0, [110, 84, 50]); setP(px, x, 1, [122, 94, 58]);
    }
    for (let x=2; x<7; x++) { // 左: 锯条剪影
      setP(px, x, 6, [190, 190, 196]); setP(px, x, 7, [150, 150, 158]);
    }
    setP(px, 7, 7, [96, 72, 42]); setP(px, 8, 8, [96, 72, 42]); // 锯柄
    for (let y=5; y<8; y++) { // 右: 锤头 + 锤柄
      for (let x=10; x<13; x++) setP(px, x, y, [120, 120, 128]);
    }
    for (let y=8; y<11; y++) setP(px, 11, y, [96, 72, 42]);
  };
  PAINTERS[T_FURNACE_TOP] = (px, rng)=>{
    noiseFill(px, rng, [89, 89, 94], 0.05); // 深灰身
    for (let y=5; y<11; y++) { // 中心炉火口(橙顶口径, 设计稿附录 A)
      for (let x=5; x<11; x++) setP(px, x, y, [255, 120, 30]);
    }
    for (let y=7; y<9; y++) for (let x=7; x<9; x++) setP(px, x, y, [255, 200, 80]); // 炽芯
  };
  PAINTERS[T_FURNACE_SIDE] = (px, rng)=>{
    noiseFill(px, rng, [89, 89, 94], 0.05);
    for (let y=9; y<14; y++) { // 炉口黑拱
      for (let x=4; x<12; x++) setP(px, x, y, [22, 22, 25]);
    }
    for (let x=5; x<11; x++) setP(px, x, 13, rng() < 0.6 ? [255, 140, 30] : [255, 200, 80]); // 炉火
    setP(px, 5, 12, [255, 140, 30]); setP(px, 10, 12, [255, 200, 80]);
  };
  PAINTERS[T_FURNACE_BOTTOM] = (px, rng)=>{
    noiseFill(px, rng, [89, 89, 94], 0.05); // 素深灰底(与顶/侧同身色, 无炉口)
    for (let i=0; i<8; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [74, 74, 79]);
  };
  PAINTERS[T_TORCH] = (px, rng)=>{
    for (let y=7; y<16; y++) { // 木棍
      setP(px, 7, y, [143, 90, 44]); setP(px, 8, y, [128, 78, 38]);
    }
    setP(px, 7, 7, [168, 112, 60]); // 棍顶高光
    setP(px, 7, 3, [255, 220, 90]); setP(px, 8, 3, [255, 200, 80]); // 火焰
    setP(px, 7, 4, [255, 220, 90]); setP(px, 8, 4, [255, 180, 50]);
    setP(px, 7, 5, [255, 140, 20]); setP(px, 8, 5, [255, 140, 20]);
    setP(px, 6, 4, [255, 180, 50]); setP(px, 9, 4, [255, 180, 50]);
    setP(px, 7, 6, [255, 140, 20]); setP(px, 8, 6, [210, 100, 20]);
  };
  PAINTERS[T_CLAY] = (px, rng)=>{
    noiseFill(px, rng, [148, 153, 173], 0.06); // 灰蓝底
    for (let i=0; i<8; i++) { // 紫灰斑团
      const x = Math.floor(rng() * 15); const y = Math.floor(rng() * 15);
      setP(px, x, y, [130, 132, 160]); setP(px, x + 1, y, [130, 132, 160]);
    }
    for (let i=0; i<6; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [172, 178, 196]);
  };
  PAINTERS[T_SAPLING] = (px, rng)=>{
    for (let y=10; y<16; y++) setP(px, 8, y, [110, 80, 44]); // 细干
    const blob = [[8, 4], [7, 5], [8, 5], [9, 5], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
      [7, 7], [8, 7], [9, 7], [8, 8]]; // 菱形叶团
    for (const p of blob) setP(px, p[0], p[1], rng() < 0.3 ? [90, 170, 80] : [60, 140, 60]);
  };

  /* ---------- 布局: 方块 id → 格号(MeshCore opts.atlas 载荷) ----------
     number = 全格同图; {top,side,bottom} = 分面。底面共享泥土/木板格是
     刻意复用: 面朝下几乎不可见, 省格即少一处 mipmap 串色面。 */
  const layout = {
    cols: COLS, rows: ROWS,
    tiles: {
      /* 存量升级款(1~8): 一期一并上图集(工单 T9), LOD 远景仍走 faceColor */
      1: {top: T_GRASS_TOP, side: T_GRASS_SIDE, bottom: T_DIRT},
      2: T_DIRT, 3: T_STONE, 4: T_COBBLE,
      5: {top: T_LOG_TOP, side: T_LOG_SIDE, bottom: T_LOG_TOP},
      6: T_PLANKS, 7: T_LEAVES, 8: T_SAND,
      /* 新方块 36~50(附录 A): 纯色近似升级为像素贴图 */
      [B_COAL_ORE]: T_COAL_ORE, [B_IRON_ORE]: T_IRON_ORE,
      [B_GOLD_ORE]: T_GOLD_ORE, [B_DIAMOND_ORE]: T_DIAMOND_ORE,
      [B_GRASS_TUFT]: T_TUFT,
      [B_FARMLAND]: {top: T_FARMLAND_TOP, side: T_FARMLAND_SIDE, bottom: T_DIRT},
      [B_WHEAT_0]: T_WHEAT_0, [B_WHEAT_1]: T_WHEAT_1,
      [B_WHEAT_2]: T_WHEAT_2, [B_WHEAT_3]: T_WHEAT_3,
      [B_CRAFT]: {top: T_CRAFT_TOP, side: T_CRAFT_SIDE, bottom: T_PLANKS},
      [B_FURNACE]: {top: T_FURNACE_TOP, side: T_FURNACE_SIDE, bottom: T_FURNACE_BOTTOM},
      [B_TORCH]: T_TORCH, [B_CLAY]: T_CLAY, [B_SAPLING]: T_SAPLING,
    },
  };

  /* 整图: 未用格填中性深灰(远处 mipmap 混色不刺眼), 已用格逐格绘制 */
  function paintAll() {
    const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
    for (let i=0; i<pixels.length; i+=4) {
      pixels[i] = 74; pixels[i + 1] = 74; pixels[i + 2] = 78; pixels[i + 3] = 255;
    }
    for (let idx=0; idx<PAINTERS.length; idx++) {
      const fn = PAINTERS[idx];
      if (!fn) continue;
      const tile = mkTile();
      fn(tile, mulberry32(0x5EED0001 ^ Math.imul(idx + 1, 2654435761))); // 每格派生种子
      const cx = (idx % COLS) * TILE; const cy = Math.floor(idx / COLS) * TILE;
      for (let y=0; y<TILE; y++) {
        for (let x=0; x<TILE; x++) {
          const o = (y * TILE + x) * 4; const q = ((cy + y) * SIZE + (cx + x)) * 4;
          pixels[q] = tile[o]; pixels[q + 1] = tile[o + 1];
          pixels[q + 2] = tile[o + 2]; pixels[q + 3] = tile[o + 3];
        }
      }
    }
    return {w: SIZE, h: SIZE, pixels};
  }

  /* 格号 → UV 矩形: 画布 y 向下、纹理 v 向上 — 第 0 行格占 v 最高段
     (与 MeshCore 的 (rows-1-r+fv)/rows 同一换算, 跨线程契约) */
  function tileUV(idx) {
    const c = idx % COLS; const r = Math.floor(idx / COLS);
    return [c / COLS, (ROWS - 1 - r) / ROWS, (c + 1) / COLS, (ROWS - r) / ROWS];
  }

  /* 画布壳: doc 由调用方注入(world.js 传 document, 测试传桩);
     putImageData 一次落图 — CanvasTexture 直接吃这张画布 */
  function makeCanvas(doc) {
    const c = doc.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const g = c.getContext('2d');
    const img = g.createImageData(SIZE, SIZE);
    img.data.set(paintAll().pixels);
    g.putImageData(img, 0, 0);
    return c;
  }

  return {layout, count: PAINTERS.length, paintAll, tileUV, makeCanvas};
})();
