'use strict';
/* ============================================================
   贴图图集 (TextureAtlas) — 引擎层 (术语见 GLOSSARY.md 的"网格化核心")
   ------------------------------------------------------------
   程序化 16×16 像素画风方块贴图图集: 新方块 36~52 全量(四矿嵌斑/草丛/
   耕地/麦四阶段/工作台/熔炉/火把/树苗/黏土/箱子/羊毛) + 生态地图 54~62
   (雪块/雪覆草侧/仙人掌/砂岩/枯灌木/三花/冰——冰原 glass 纯色半透,
   2026-11-07 G3 走查拍板入集画裂纹, 见 B_ICE 映射注) +
   门与玻璃板 64~68(门板上下两张/玻璃板框图, docs/door-window-design.md §5.3) +
   床 53/69(床头顶枕毯/床尾顶全毯/床侧毯木框, 两格床改版) +
   存量基础方块升级款(草顶/泥土/石头颗粒/圆石/苔石/木板缝/木头年轮树皮/树叶孔洞/沙子颗粒) +
   黑巢地上件(黑曜石/发光岩——巢穴观感票; 门面/熄门贴图三试三否, 2026-10-30
   拍板回退玻璃通道平紫半透明, 见 docs/den-nest-design.md §2.1) +
   战利品宝箱 71(红金双格, den-nest §7.5) + 远古残骸 73(正典上下螺旋纹,
   装备系统 T7, docs/equipment-design.md §4.4) + 覆雪树叶 74(深绿针叶底+白雪
   覆盖大部, 世界边界 T12——北带落雪杉冠盖件, 级联随冠消散, north-spec §11) +
   怪物合成材料件 75~77(南瓜分面/雕刻刻脸/铁块金属框, mob-crafting T1) +
   粉羊毛 78(城镇重制公共件, revamp-spec §2——羊毛画法换樱粉底, 樱花树冠/布幔/旗阵) +
   篝火 62~67(燃烧 81/熄灭 82, 篝火 T-C8 落旧全脸同图两格 62/63——T-C13 v1.9 分面
   返工作废存档不删; 新增分面双 tile 四格 64~67: 燃灶面/燃侧脸/熄灶面/熄侧脸,
   顶=灶面俯视/四侧=侧脸正视/底不绘, 观感权威 docs/design/campfire-visual-spec.md §4) +
   篝火几何建模九格 68~76(T-C13-R1, v1.10: 端面/皮侧/燃顶/燃侧/熄顶/熄侧/焰帧×3,
   燃熄成对 fallback=70↔72、71↔73, 权威同上 §4.2/§4.3)。
   风格参考
   我的世界的观感语言, 像素全部自绘(零外部素材, 版权口径见设计稿 D13)。
   像素先写进纯数据缓冲(Uint8ClampedArray), 画布只是壳(makeCanvas 惰性
   创建) — Node 可逐像素直测; 噪点/斑点全用种子化伪随机, 同 seed 同图。
   layout(方块id→格号)是网格化核心的 UV 契约: 经 opts.atlas 注入
   MeshCore(与 tntTiles 同惯例), Worker 侧 importScripts 本文件共读;
   未入集方块(水等玻璃透渲件与未升级存量)仍走 faceColor 纯色兜底。
   interface: layout{cols,rows,tiles} / count 已绘制格数 / paintAll()→
     {w,h,pixels} / tileUV(idx)→[u0,v0,u1,v1] / makeCanvas(doc)→canvas
   依赖(均经全局名, 加载序解析): config.js 的 B_* 方块 id 常量
     (index.html 里在 mesh-core.js 之后、world.js 之前加载)。
   可测性声明: 零 THREE · 零 Math.random · 像素段零 DOM 有单测
     (test/texture-atlas.test.js); 画布壳的 doc 由调用方注入(测试桩)。
   ============================================================ */
const TextureAtlas = (() => {
  const TILE = 16; // 每格格边(像素): MC 经典方块贴图分辨率
  const COLS = 16; const ROWS = 16; // 16×16 格 = 最高格号 76(count=77, 篝火几何建模九格 v1.10), 余量充足
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
  const T_CHEST_SIDE = 29; const T_CHEST_TOP = 30;
  const T_WOOL = 31;
  const T_SNOW = 32; const T_SNOWY_SIDE = 33; const T_CACTUS = 34; const T_SANDSTONE = 35;
  const T_DEAD_BUSH = 36;
  const T_ORCHID = 37; const T_FLOWER_Y = 38; const T_FLOWER_W = 39;
  const T_DOOR_BOTTOM = 40; const T_DOOR_TOP = 41; const T_GLASS_PANE = 42;
  const T_BED_TOP = 43; const T_BED_SIDE = 44; const T_BED_TOP_FOOT = 45;
  const T_SPAWNER = 46; /* 怪物巢穴之心(den-nest-design D9): 铁笼网格+暗红核 */
  const T_MOSSY = 47; /* 苔石(14): 圆石底+苔斑——巢穴丘体/副本祭坛/石阵共用 */
  const T_OBSIDIAN = 48; /* 黑曜石(31): 近黑紫底+紫辉斑+品红高光(黑巢丘冠/门框) */
  const T_GLOWSTONE = 49; /* 发光岩(34): 琥珀底+亮金斑团(MC 萤石马赛克观感) */
  const T_LOOT_SIDE = 50; /* 战利品宝箱侧(71): 深红箱体+上下金箍带+中央金锁扣(den-nest §7.5 D16) */
  const T_LOOT_TOP = 51; /* 战利品宝箱顶盖: 红盖+金边框+中央金扣横条(双格同图=MC 双箱观感) */
  const T_DEBRIS = 52; /* 远古残骸(73): 正典上下螺旋纹——暗棕底同心方环亮带(装备系统 T7) */
  const T_SNOWY_LEAVES = 53; /* 覆雪树叶(74): 深绿针叶底+白雪覆盖大部(世界边界 T12) */
  const T_ICE = 54; /* 冰(56): 淡蓝冰面+深蓝裂纹折线+霜斑高光(世界边界·T8 G3 走查拍板) */
  const T_PUMPKIN_TOP = 55; /* 南瓜顶(76): 棱瓣底+深色边环+中央棕短茎 */
  const T_PUMPKIN_SIDE = 56; /* 南瓜侧(76): 橙底竖棱瓣(MC 南瓜观感) */
  const T_CARVED_PUMPKIN = 57; /* 雕刻南瓜(77): 棱瓣底+刻脸(倒三角眼+竖齿嘴) */
  const T_IRON_BLOCK = 58; /* 铁块(75): 银灰金属底+深框线+内亮方+四角铆点 */
  const T_PINK_WOOL = 59; /* 粉羊毛(78, 城镇重制公共件): 樱粉绒毛底+绒团+蓬松亮点 */
  const T_GATE_SIGN = 60; /* 门额牌(80, 东带 v2 S2): 牌木底+镇徽钟塔图(西面图案) */
  const T_GATE_WOOD = 61; /* 门额牌纯木底(其余五面): #C89858 平涂(design-lead 预授权第二格位) */
  const T_CAMPFIRE_LIT = 62; /* 篝火燃烧态旧全脸同图格(T-C8 落, T-C13 v1.9 起作废存档不删) */
  const T_CAMPFIRE_OUT = 63; /* 篝火熄灭态旧全脸同图格(T-C8 落, T-C13 v1.9 起作废存档不删) */
  /* T-C13 v1.9 分面双 tile 四格(UI 定稿 §4.1: 顶=灶面俯视/四侧=侧脸正视/底不绘;
     旧 62/63 单 tile 作废存档——灶面俯视图贴满四侧后侧面读「火焰糊满墙」的根因格) */
  const T_CAMPFIRE_TOP = 64; /* 篝火燃烧态·灶面顶(81, T-C13): 木框围合 C 灶地+中心焰团+灰烬斑 */
  const T_CAMPFIRE_SIDE = 65; /* 篝火燃烧态·侧脸(81, T-C13): 上半透明+中心火舌+原木横梁 */
  const T_CAMPFIRE_OUT_TOP = 66; /* 篝火熄灭态·灶面顶(82, T-C13): 同构木框+灰烬坑+中央炭心 */
  const T_CAMPFIRE_OUT_SIDE = 67; /* 篝火熄灭态·侧脸(82, T-C13): 零火舌+暗炭缝+原木同位形 */
  /* T-C13-R1 v1.10 几何建模九格(68~76 连续落集, count=77; T_LOG_SIDE 名已被 7 号格
     占用, 本段一律 T_CF_ 前缀避撞); 接线归 R-2, 本票只落画师 */
  const T_CF_LOG_END = 68; /* 原木端面: 外皮 d 环+年轮 L/l 三重方环+中心 k 节疤 */
  const T_CF_LOG_SIDE = 69; /* 原木皮侧: 上下皮缘 d/L 底横纹+l 受光长条+短划纹 */
  const T_CF_TOP_LIT = 70; /* 炭堆燃顶: a 灰烬地+k 炭斑三群+f 橙芯嵌炭内+e 灼点 */
  const T_CF_SIDE_LIT = 71; /* 炭堆燃侧: 顶底 a 灰缘+k 炭主体+中央竖向橙缝 f/F+e 灼点 */
  const T_CF_TOP_OUT = 72; /* 炭堆熄顶: a 灰主导+k 露头斑(与 70 同构三群位), 零焰色零 e */
  const T_CF_SIDE_OUT = 73; /* 炭堆熄侧: a 灰主体+竖向 k 暗缝(橙缝冷灭残迹), 零焰色零 e */
  const T_CF_FLAME_F1 = 74; /* 焰帧 F1: 中立位相火舌(外 f→F→W→w 白芯/焰根 e, alpha 真透) */
  const T_CF_FLAME_F2 = 75; /* 焰帧 F2: 左倾位相火舌(同一火舌摆动/翻页帧) */
  const T_CF_FLAME_F3 = 76; /* 焰帧 F3: 右倾位相火舌(同一火舌摆动/翻页帧) */

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
  /* 花: 绿茎双叶 + 7×5 花头(外圈瓣/中心), 三花共用形换色板(票据 T1) */
  function flowerBase(px, rng, petal, petalLight, center) {
    const stem = [63, 143, 63]; const leaf = [88, 164, 75];
    for (let y=8; y<16; y++) setP(px, 8, y, stem); // 茎
    for (const p of [[6, 11], [7, 11], [10, 12], [9, 12]]) setP(px, p[0], p[1], leaf); // 双叶
    for (let y=3; y<=7; y++) {
      for (let x=5; x<=11; x++) {
        const inCenter = x>=7 && x<=9 && y>=4 && y<=6;
        if (!inCenter) setP(px, x, y, rng() < 0.25 ? petalLight : petal); // 花瓣(带亮斑)
      }
    }
    for (let y=4; y<=6; y++) for (let x=7; x<=9; x++) setP(px, x, y, center); // 花心
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
  PAINTERS[T_SNOWY_LEAVES] = (px, rng)=>{ // 覆雪树叶(74, 世界边界 T12): 松针深绿底+
    // 白雪覆盖大部(MC 覆雪针叶语言)——树冠上的雪叶与绿冠同语言, 只差雪层观感;
    // 逐列雪深 9~14 像素(确定性掷深, 下缘参差露针叶底色), 雪色近雪块(0.93,0.95,0.98)
    noiseFill(px, rng, [51, 128, 56], 0.14); // 针叶底(树叶同款强噪)
    for (let i=0; i<10; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [34, 96, 40]); // 深叶斑
    for (let x=0; x<TILE; x++) {
      const depth = 9 + Math.floor(rng() * 6); // 本列雪深 9~14
      for (let y=0; y<depth; y++) {
        const v = 1 + (rng() * 2 - 1) * 0.04; // 雪面微噪(雪花颗粒感)
        setP(px, x, y, [237 * v, 242 * v, 250 * v]);
      }
    }
  };
  PAINTERS[T_ICE] = (px, rng)=>{ // 冰(56, 世界边界·T8): 淡蓝冰面底+贯穿裂纹折线+霜斑
    // G3 走查拍板(2026-11-07): 原 glass 纯色半透在雪原上读作「脏渍」——入集画裂纹
    // 让冰一眼读得出。底色近注册表 all(0.63,0.78,0.94), 裂纹深蓝随机游走折线,
    // 白亮霜斑=反光; 73/74 先例同款整格同图
    noiseFill(px, rng, [161, 199, 240], 0.05); // 淡蓝冰底(微噪, 颗粒感克制)
    for (let c = 0; c < 3; c++) { // 裂纹: 自上而下的左右抖动折线(深蓝主干+浅蓝伴影)
      let cx = Math.floor(rng() * TILE); let cy = Math.floor(rng() * 4);
      while (cy < TILE) {
        setP(px, cx, cy, [126, 162, 210]);
        if (rng() < 0.4) setP(px, cx + 1, cy, [142, 176, 220]); // 裂纹伴影
        cy += 1;
        cx += rng() < 0.5 ? -1 : 1;
        if (cx < 0) cx = 0;
        if (cx >= TILE) cx = TILE - 1;
      }
    }
    for (let i = 0; i < 7; i++) setP(px, Math.floor(rng() * TILE), Math.floor(rng() * TILE), [234, 244, 252]); // 霜斑高光
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
  PAINTERS[T_TORCH] = (px)=>{
    /* MC 火把贴图逐像素复刻(torch.png @1.21.11 资产解码, mc-torch-model-research
       §1.3): 2px 宽棍条——x7 亮列(受光)/x8 暗列(背光), 火焰仅 2×2(行 6-7);
       MC 大焰观感靠 flame/smoke 粒子叠出, 本期不加粒子(research §7.3-5)。
       行 0-5 与两侧留透明(小盒采样窗只取 [7,6]-[9,16], 余量给图标与防溢出) */
    const rows = [
      [6, [255, 216, 0], [255, 143, 0]], // 火焰顶(橙黄)
      [7, [255, 255, 151], [255, 255, 255]], // 火焰亮芯(近白)
      [8, [159, 127, 80], [109, 87, 54]], // 棍顶
      [9, [149, 117, 70], [85, 69, 46]],
      [10, [159, 127, 80], [66, 53, 34]],
      [11, [159, 127, 80], [85, 69, 46]],
      [12, [149, 117, 70], [85, 69, 46]],
      [13, [109, 87, 54], [61, 48, 29]],
      [14, [159, 127, 80], [59, 46, 27]],
      [15, [109, 87, 54], [55, 42, 23]], // 棍底
    ];
    for (const [y, lite, dark] of rows) {
      setP(px, 7, y, lite); setP(px, 8, y, dark);
    }
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
  /* 箱子正面: 木板底 + 上下深箍 + 中央锁扣 */
  PAINTERS[T_CHEST_SIDE] = (px, rng)=>{
    planksBase(px, rng);
    for (const y of [4, 11]) for (let x=0; x<TILE; x++) setP(px, x, y, [96, 66, 36]);
    for (const p of [[6, 7], [7, 7], [8, 7], [9, 7], [6, 8], [7, 8], [8, 8], [9, 8],
      [6, 9], [7, 9], [8, 9], [9, 9]]) setP(px, p[0], p[1], [64, 44, 22]); // 扣座
    setP(px, 7, 8, [222, 222, 228]); setP(px, 8, 8, [168, 168, 178]); // 锁眼高光/暗面
  };
  /* 箱子顶面: 木板底 + 深色围边(盖沿) */
  PAINTERS[T_CHEST_TOP] = (px, rng)=>{
    planksBase(px, rng);
    for (let i=0; i<TILE; i++) {
      setP(px, i, 0, [96, 66, 36]); setP(px, i, 15, [96, 66, 36]);
      setP(px, 0, i, [96, 66, 36]); setP(px, 15, i, [96, 66, 36]);
    }
  };
  /* 羊毛(F4 二期设计稿 §4.7): 绒毛噪点纹理 — 白底微噪 + 暗点绒团 + 蓬松亮点 */
  PAINTERS[T_WOOL] = (px, rng)=>{
    noiseFill(px, rng, [235, 235, 235], 0.05); // 锚定 faceColor 羊毛白, 观感连续
    for (let i=0; i<12; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [218, 218, 221]);
    for (let i=0; i<8; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [248, 248, 250]);
  };
  /* 粉羊毛(78, 城镇重制公共件 revamp-spec §2): 白羊毛同绒毛画法换樱粉底
     (#F2C2D9 锚定 config faceColor 0.95,0.76,0.85) — 樱花树冠/布幔/旗阵专用件 */
  PAINTERS[T_PINK_WOOL] = (px, rng)=>{
    noiseFill(px, rng, [242, 194, 217], 0.05);
    for (let i=0; i<12; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [224, 172, 200]);
    for (let i=0; i<8; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [252, 222, 235]);
  };
  /* 门额牌(80, 东带 v2 野心版 S2): 牌木底+镇徽钟塔小图——塔身暖褐 4 宽 8 行+
     瓦顶两笔阶梯收分(陶橙)+顶上一粒暖金钟点 2px, 「牌上画的就是门后那座塔」;
     木作线=planksBase 族语言(4 行一板/横缝板末行/竖缝逐板错位/钉点对侧)。
     零 noiseFill 零 rng(确定性红线: 不依赖派生种子, 邻居条目增删不改变本格
     输出); 坐标规格权威 .scratch/town-east-boundary/assets/gate-sign/
     pixel-spec.md §5 伪码逐字直译(工具断言与 §2 逐像素网格 diff=0);
     镇徽漆在木作线之上(over-paint), 塔门=木底透出零新增色 */
  PAINTERS[T_GATE_SIGN] = (px)=>{
    const W = [200, 152, 88]; const D = [146, 109, 60]; /* 牌木底/深木缝线 */
    const B = [139, 90, 60]; const R = [217, 122, 74]; const G = [227, 178, 60]; /* 塔身/瓦顶/金点 */
    for (let y=0; y<TILE; y++) for (let x=0; x<TILE; x++) setP(px, x, y, W); /* 木底满铺 */
    for (const y of [3, 7, 11, 15]) for (let x=0; x<TILE; x++) setP(px, x, y, D); /* 横缝满行 */
    for (const [sx, y0] of [[2, 0], [13, 4], [2, 8], [13, 12]]) { // 竖缝逐板错位
      for (let y=y0; y<y0+3; y++) setP(px, sx, y, D);
    }
    for (const [nx, ny] of [[14, 1], [1, 5], [14, 9], [1, 13]]) setP(px, nx, ny, D); /* 钉点 */
    for (const y of [2, 3]) for (let x=5; x<=10; x++) setP(px, x, y, R); /* 瓦顶上笔(6 宽) */
    for (const y of [4, 5]) for (let x=4; x<=11; x++) setP(px, x, y, R); /* 瓦顶下笔(8 宽阶梯收分) */
    setP(px, 7, 1, G); setP(px, 8, 1, G); /* 顶钟金点(2px 横对居 x=7.5 对称轴) */
    for (let y=6; y<=13; y++) for (let x=6; x<=9; x++) setP(px, x, y, B); /* 塔身(4 宽 8 行) */
    for (const y of [12, 13]) for (const x of [7, 8]) setP(px, x, y, W); /* 塔门(木底透出) */
  };
  /* 门额牌纯木底(61): 五面木底 #C89858 平涂——与 60 号格底色同值, 分格仅为
     分面采样契约独立; 零 rng(与 60 同一确定性口径) */
  PAINTERS[T_GATE_WOOD] = (px)=>{
    for (let y=0; y<TILE; y++) for (let x=0; x<TILE; x++) setP(px, x, y, [200, 152, 88]);
  };
  /* ---------- 篝火旧全脸同图两格(T-C8 落; T-C13 v1.9 分面返工起【作废存档】) ----------
     存档纪律(T-C13 票): 62/63 两格画师原样保留不接线(layout 已改分面四格
     64~67), 存档测试逐字符守着它们——历史备查, 修正票不得照抄。
     原观感权威=UI 定稿 §4.2/§4.3 节尾存档稿(v1.0 旧稿); 色板与画笔纪律注释
     保留原文口径(暗炭底 C=#231a12 / 灰烬灰 a=#b9b4a8 / C 底 noiseFill amp 0.06)。 */
  const CF_C = [35, 26, 18]; /* 暗炭底 #231a12 */
  const CF_A = [185, 180, 168]; /* 灰烬灰 #b9b4a8 */
  const CF_D = [107, 69, 31]; /* 原木背光(木纹短划)#6b451f */
  /* char art 全色板(固定像素与 rng 笔触共用) */
  const CF_PAL8 = {
    w: [255, 255, 255], /* 焰心白 */
    W: [255, 255, 151], /* 焰芯亮黄 */
    f: [255, 216, 0], /* 焰亮黄 */
    F: [255, 143, 0], /* 焰橙 */
    e: [224, 90, 26], /* 余烬红 */
    k: [47, 42, 38], /* 炭黑 */
    l: [168, 116, 61], /* 原木受光 */
    L: [138, 90, 43], /* 原木主 */
    d: CF_D, C: CF_C, a: CF_A,
  };
  const CF_LIT_ART = [ /* §4.2 燃烧态: 焰四档+余烬带+原木床 */
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCfFCCCCCCC',
    'CCCCCCfFFfCCCCCC',
    'CCCCCfFWWFfCCCCC',
    'CCCCCFWwwWFCCCCC',
    'CCCCfFWwwWFfCCCC',
    'CCCCFWwwwwWFCCCC',
    'CCCfFFWwwWFFfCCC',
    'CCCFFFWWWWFFFCCC',
    'CCeFFFWWWWFFFeCC',
    'CCekeFFeeFFekeCC',
    'kllllllllllllllk',
    'dLLLLLLLLLLLLLLd',
    'dddddddddddddddd',
    'dLLLLLLLLLLLLLLd',
    'dddddddddddddddd',
  ];
  const CF_OUT_ART = [ /* §4.3 熄灭态: 同位形去焰(灰烬带+原木床去受光档) */
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCC',
    'CCaCCCaCCaCCaCCC',
    'CCCCaCCCCCaCCCCC',
    'kLLLLLLLLLLLLLLk',
    'dLLLLLLLLLLLLLLd',
    'dddddddddddddddd',
    'dLLLLLLLLLLLLLLd',
    'dddddddddddddddd',
  ];
  PAINTERS[T_CAMPFIRE_LIT] = (px, rng)=>{
    noiseFill(px, rng, CF_C, 0.06); /* 暗炭坑底 ±6% 值噪 */
    for (let y=0; y<TILE; y++) {
      for (let x=0; x<TILE; x++) {
        const ch = CF_LIT_ART[y][x];
        if (ch !== 'C') setP(px, x, y, CF_PAL8[ch]); /* 固定像素零 rng */
      }
    }
    /* 原木床木纹: 4~5 道 rng d 短划(1px 粒; x 取 1~14 避开两端 art 固定 d 列,
       保证每道都盖中一个 L 行像素; 只落 r12/r14, 不越 r11) */
    const dashes = 4 + Math.floor(rng() * 2);
    for (let i=0; i<dashes; i++) {
      const x = 1 + Math.floor(rng() * (TILE - 2));
      const y = rng() < 0.5 ? 12 : 14;
      setP(px, x, y, CF_D);
    }
  };
  PAINTERS[T_CAMPFIRE_OUT] = (px, rng)=>{
    noiseFill(px, rng, CF_C, 0.06); /* 同款暗炭底 */
    for (let y=0; y<TILE; y++) {
      for (let x=0; x<TILE; x++) {
        const ch = CF_OUT_ART[y][x];
        if (ch !== 'C') setP(px, x, y, CF_PAL8[ch]); /* 固定像素零 rng */
      }
    }
    /* r0~r8 C 区补撒 8 粒 rng 灰烬散斑(6~10 粒纪律内; y∈[2,8], 1px 粒;
       Set 去重防叠粒, 保证实撒粒数不缩水) */
    const placed = new Set();
    while (placed.size < 8) {
      const x = Math.floor(rng() * TILE);
      const y = 2 + Math.floor(rng() * 7);
      const key = y * TILE + x;
      if (placed.has(key)) continue;
      placed.add(key);
      setP(px, x, y, CF_A);
    }
  };
  /* ---------- 篝火分面双 tile 四格(81/82, 篝火 T-C13, UI 定稿 §4.1 v1.9 分面返工) ----------
     v1.9 废「全脸同图」(PO 实机手玩: 灶面俯视图贴满四侧→侧面读「火焰方块」):
     顶=灶面(俯视)/四侧=侧脸(正视)/底不绘(接线见 layout tiles[81]/[82] 分面表)。
     观感唯一权威=§4.2(燃烧 64 灶面/65 侧脸)/§4.3(熄灭 66 灶面/67 侧脸) char art
     逐字符照抄; 色板复用 CF_PAL8(§3.1 九色 + 暗炭底 C + 灰烬灰 a, 零新色)。
     画笔纪律(T-C13 票): 灶面 C 地 noiseFill amp 0.06(mulberry32 派生种子同 seed
     同图); 65/67 原木木纹 d 短划 rng 撒 2~3 道(r12 起 1px 宽 2px 高=r12-r13 同列
     双 d, 只落 col3..12——端头 col2/13 是结构 d); 66/67 a 灰烬散斑 per-tile 补撒
     4~8 粒(rng, 1px 粒, 只落 C 地/透明区); 焰团/火舌/灰烬斑/木框/炭心固定像素
     零 rng; 侧脸透明区 alpha=0 真透(mkTile 缺省全 0 即透明, '.' 位不绘制,
     world.js atlasMat alphaTest 0.5 管线吃 alpha 位——不用 C 暗底回退)。 */
  const CF_TOP64_ART = [ /* UI 定稿 §4.2 燃灶面 64: 木框 L 环+d 内缘+焰团+e 双弧+a 斑 */
    'LLLLLLLLLLLLLLLL',
    'LddddddddddddddL',
    'LdCCCCCCCCCCCCdL',
    'LdCCCaCCCCCaCCdL',
    'LdCCCeeCCCeeCCdL',
    'LdCffWWWWffCCCdL',
    'LdfFWwwwwWFfCCdL',
    'LdFWwwwwwwWFCCdL',
    'LdfFWwwwwWFfCCdL',
    'LdCffWWffCCCCCdL',
    'LdCCCCeeeeCCCCdL',
    'LdCCCaCCCCCaCCdL',
    'LdCCCCCCCCCCCCdL',
    'LdCCCCCCCCCCCCdL',
    'LddddddddddddddL',
    'LLLLLLLLLLLLLLLL',
  ];
  const CF_SIDE65_ART = [ /* UI 定稿 §4.2 燃侧脸 65: 上半 '.' 透明+中心火舌+原木横梁 */
    '................',
    '................',
    '.......f........',
    '......fFf.......',
    '.....fFWFf......',
    '.....FWwWF......',
    '....fFWwwWFf....',
    '....FFWwwWFF....',
    '...fFFWwwWFFf...',
    '...FFFWwwWFFF...',
    '..dddddddddddd..',
    '..dLLLLLLLLLLd..',
    '..dLLdLLLLdLLd..',
    '..dLLLLLLLLLLd..',
    '..dddddddddddd..',
    '..dddddddddddd..',
  ];
  const CF_OUT_TOP66_ART = [ /* UI 定稿 §4.3 熄灶面 66: 同构木框+灰烬坑 a+中央炭心 k(4-6-6-4 对称) */
    'LLLLLLLLLLLLLLLL',
    'LddddddddddddddL',
    'LdCCCCCCCCCCCCdL',
    'LdCCCaCCCCCaCCdL',
    'LdCCCaaCCCCaaCdL',
    'LdCaaaaaaaaaaCdL',
    'LdCaaakkkaaaaCdL',
    'LdCaakkkkkkaaCdL',
    'LdCaakkkkkkaaCdL',
    'LdCaaakkkaaaaCdL',
    'LdCaaaaaaaaaaCdL',
    'LdCCCaCCCCCaCCdL',
    'LdCCCCCCCCCCCCdL',
    'LdCCCCCCCCCCCCdL',
    'LddddddddddddddL',
    'LLLLLLLLLLLLLLLL',
  ];
  const CF_OUT_SIDE67_ART = [ /* UI 定稿 §4.3 熄侧脸 67: r0~r6 全透+暗炭缝+原木同 65 */
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......aa.......',
    '......akka......',
    '.....aakkaa.....',
    '..dddddddddddd..',
    '..dLLLLLLLLLLd..',
    '..dLLdLLLLdLLd..',
    '..dLLLLLLLLLLd..',
    '..dddddddddddd..',
    '..dddddddddddd..',
  ];
  /* char art 固定像素落格(T-C13 新四格共用): 非 C 非 '.' 字符零 rng 精确——
     '.' 留给 mkTile 缺省透明(侧脸真透), 'C' 留给 noiseFill 底噪 */
  function cfStamp(px, art) {
    for (let y=0; y<TILE; y++) {
      for (let x=0; x<TILE; x++) {
        const ch = art[y][x];
        if (ch !== 'C' && ch !== '.') setP(px, x, y, CF_PAL8[ch]);
      }
    }
  }
  /* 灶面 C 地/侧脸透明区收集: a 散斑只落候选位(固定像素零 rng 纪律——撒中
     非 C 非 '.' 固定像素即毁稿); transparentOnly=true 收 '.'(侧脸散斑走透明区),
     rowMax 限定行域(67 散斑纪律=炭缝外围即原木上方透明带, 不撒原木行域) */
  function cfGroundSpots(art, transparentOnly, rowMax) {
    const spots = [];
    for (let y=0; y<TILE; y++) {
      for (let x=0; x<TILE; x++) {
        const ch = art[y][x];
        if (transparentOnly ? ch === '.' : ch === 'C') spots.push([x, y]);
      }
    }
    return rowMax === undefined ? spots : spots.filter((s) => s[1] <= rowMax);
  }
  /* 原木木纹 d 短划(65/67 共用): rng 撒 2~3 道, r12 起 1px 宽 2px 高(r12-r13
     同列双 d), 只落 col3..12(端头 col2/13 是结构 d 不算木纹); Set 去重防叠道 */
  function cfWoodDashes(px, rng) {
    const dashes = 2 + Math.floor(rng() * 2);
    const cols = new Set();
    while (cols.size < dashes) {
      const x = 3 + Math.floor(rng() * 10);
      if (cols.has(x)) continue;
      cols.add(x);
      setP(px, x, 12, CF_D);
      setP(px, x, 13, CF_D);
    }
  }
  /* a 灰烬散斑(66/67 共用): per-tile 补撒 4~8 粒(rng, 1px 粒), 候选位由
     cfGroundSpots 给出; Set 去重保证实撒粒数不缩水(63 存档画师同款先例) */
  function cfAshSpecks(px, rng, spots) {
    const placed = new Set();
    const n = 4 + Math.floor(rng() * 5);
    while (placed.size < n) {
      const [x, y] = spots[Math.floor(rng() * spots.length)];
      const key = y * TILE + x;
      if (placed.has(key)) continue;
      placed.add(key);
      setP(px, x, y, CF_A);
    }
  }
  PAINTERS[T_CAMPFIRE_TOP] = (px, rng)=>{
    noiseFill(px, rng, CF_C, 0.06); /* §4.2: C 灶地 ±6% 值噪 */
    cfStamp(px, CF_TOP64_ART); /* 木框/焰团/e 双弧/a 斑固定像素零 rng */
  };
  PAINTERS[T_CAMPFIRE_SIDE] = (px, rng)=>{
    cfStamp(px, CF_SIDE65_ART); /* '.' 位不绘制=alpha 0 真透; 火舌/原木固定零 rng */
    cfWoodDashes(px, rng); /* 原木木纹 rng d 短划(§4.2 画笔纪律) */
  };
  PAINTERS[T_CAMPFIRE_OUT_TOP] = (px, rng)=>{
    noiseFill(px, rng, CF_C, 0.06); /* §4.3: 同款 C 灶地值噪 */
    cfStamp(px, CF_OUT_TOP66_ART); /* 木框/灰烬坑 a/炭心 k 固定像素零 rng */
    cfAshSpecks(px, rng, cfGroundSpots(CF_OUT_TOP66_ART, false)); /* a 散斑只落 C 地 */
  };
  PAINTERS[T_CAMPFIRE_OUT_SIDE] = (px, rng)=>{
    cfStamp(px, CF_OUT_SIDE67_ART); /* r0~r6 全透零火舌; 炭缝/原木固定零 rng */
    cfAshSpecks(px, rng, cfGroundSpots(CF_OUT_SIDE67_ART, true, 9)); /* a 散斑落炭缝外围透明带(y≤9) */
    cfWoodDashes(px, rng); /* 原木木纹与 65 同构 */
  };
  /* ---------- 篝火几何建模九格(68~76, 篝火 T-C13-R1, UI 定稿 §4.2/§4.3 v1.10) ----------
     篝火改「几何建模」的贴图物料格: 原木端面/皮侧 68/69、炭堆燃顶/燃侧 70/71、
     炭堆熄顶/熄侧 72/73、焰帧 F1~F3 74~76(翻页动画源)。
     观感唯一权威=§4.2(端面/皮侧/燃顶/燃侧/焰帧)/§4.3(熄顶/熄侧) char art 逐字符照抄。
     画笔纪律(票面红线): 全格固定像素零 rng——画师签名 (px)=> 不接 rng, 同 seed
     同图天然成立; 色板复用 CF_PAL8(九色+C+a), 零新色; 九稿无 'C', cfStamp 直落;
     焰帧 '.' 位不绘制=mkTile 缺省 alpha 0 真透(65/67 同口径)。
     fallback 燃熄成对(接线归 R-2): 顶 70↔72 同构灰烬盖顶翻页不刺眼、
     侧 71↔73 成对可辨(k 主+橙缝 vs a 主+暗缝)。 */
  const CF_LOG_END68_ART = [ /* UI 定稿 §4.2 原木端面 68: 外皮 d 环+年轮 L/l 三重方环+中心 k 节疤 */
    'dddddddddddddddd',
    'dLLLLLLLLLLLLLLd',
    'dLllllllllllllLd',
    'dLlLLLLLLLLLLlLd',
    'dLlLllllllllLlLd',
    'dLlLlLLLLLLlLlLd',
    'dLlLlLkkkkLlLlLd',
    'dLlLlLkkkkLlLlLd',
    'dLlLlLkkkkLlLlLd',
    'dLlLlLkkkkLlLlLd',
    'dLlLlLLLLLLlLlLd',
    'dLlLllllllllLlLd',
    'dLlLLLLLLLLLLlLd',
    'dLllllllllllllLd',
    'dLLLLLLLLLLLLLLd',
    'dddddddddddddddd',
  ];
  const CF_LOG_SIDE69_ART = [ /* UI 定稿 §4.2 原木皮侧 69: 上下皮缘 d+L 底横纹+l 受光长条+短划纹 */
    'dddddddddddddddd',
    'dLLLLLLLLLLLLLLd',
    'dLLdLLLLLLLLdLLd',
    'dLLLLLLLLLLLLLLd',
    'dLllllllllllllLd',
    'dLLLLLLLLLLLLLLd',
    'dLLLLLdddddLLLLd',
    'dLLLLLLLLLLLLLLd',
    'dLLdLLLLLLLLdLLd',
    'dLLLLLLLLLLLLLLd',
    'dLllllllllllllLd',
    'dLLLLLLLLLLLLLLd',
    'dLLLLLLLddLLLLLd',
    'dLLLLLLLLLLLLLLd',
    'dLLLLLLLLLLLLLLd',
    'dddddddddddddddd',
  ];
  const CF_TOP_LIT70_ART = [ /* UI 定稿 §4.2 炭堆燃顶 70: a 灰烬地满铺+k 炭斑三群+f 橙芯嵌炭内+e 灼点 */
    'aaaaaaaaaaaaaaaa',
    'aaaaakkkaaaaaaaa',
    'aaaakkkkkkaaaaaa',
    'aaaakkfkkkkaaaaa',
    'aaaaakkkkkaaaaaa',
    'aaaaaaaaakkkkaaa',
    'aaaaaaaakfkkkaaa',
    'aaaaaaaafkkkkaaa',
    'aaaaaaaaakkekaaa',
    'aaaakkkkaaaaaaaa',
    'aaaakkfkkaaaaaaa',
    'aaaakkkkkaaaaaaa',
    'aaaaaakkaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
  ];
  const CF_SIDE_LIT71_ART = [ /* UI 定稿 §4.2 炭堆燃侧 71: 顶底 a 灰缘+k 炭主体+中央竖向橙缝 f/F+e 灼点 */
    'aaaaaaaaaaaaaaaa',
    'akkkkkkkkkkkkkka',
    'akkkkkffkkkkkkka',
    'akkkkfFFfkkkkkka',
    'akkkkfFFfkkkkkka',
    'akkkkkffkkkkkkka',
    'akkekkkkkkkkekka',
    'akkkkkkkkkkkkkka',
    'akkkkffkkkkkkkka',
    'akkkfFFfkkkkkkka',
    'akkkkkffkkkkkkka',
    'akkkkkkkkkkkkkka',
    'akkekkkkkkkkkkka',
    'akkkkkkkkkkkkkka',
    'akkkkkkkkkkkkkka',
    'aaaaaaaaaaaaaaaa',
  ];
  const CF_TOP_OUT72_ART = [ /* UI 定稿 §4.3 炭堆熄顶 72: a 灰烬主+k 露头斑(与 70 同构三群位), 零焰色零 e */
    'aaaaaaaaaaaaaaaa',
    'aaaaakkkkaaaaaaa',
    'aaaakkkkkkaaaaaa',
    'aaaakkkkkkkaaaaa',
    'aaaaakkkkkaaaaaa',
    'aaaaaaaaakkkaaaa',
    'aaaaaakkkkaaaaaa',
    'aaaaaaakkkaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaakkkaaaaaaaaaa',
    'aaakkkkkaaaaaaaa',
    'aaaakkkkkkaaaaaa',
    'aaaaaakkkaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
  ];
  const CF_SIDE_OUT73_ART = [ /* UI 定稿 §4.3 炭堆熄侧 73: a 灰主体+竖向 k 暗缝(橙缝冷灭残迹), 零焰色零 e */
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaakkkaaaakkaaa',
    'aaaakkkaaaakkaaa',
    'aaaakkkaaaakkaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaakkaaaaaaaa',
    'aaaaaakkaaaaaaaa',
    'aaaaaakkaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaakkkkaaaaaaaa',
    'aaaakkkkaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
  ];
  const CF_FLAME74_ART = [ /* UI 定稿 §4.2 焰帧 F1 74: 中立位相火舌(外 f→F→W→w 白芯/焰根 e/alpha 真透) */
    '................',
    '.......f........',
    '.......F........',
    '......fFf.......',
    '......FWF.......',
    '.....fFWWf......',
    '.....FWwWF......',
    '....fFWwWFf.....',
    '....FWwwWF......',
    '...fFWwwWFf.....',
    '...FFWwwWFF.....',
    '...FFFWwWFFF....',
    '..fFFFWWWFFFf...',
    '..FFeFWWWeFF....',
    '..FFeFFFFFeFF...',
    '................',
  ];
  const CF_FLAME75_ART = [ /* UI 定稿 §4.2 焰帧 F2 75: 左倾位相火舌(同一火舌摆动/翻页帧) */
    '................',
    '.....f..........',
    '.....F..........',
    '....fFf.........',
    '....FWF.........',
    '...fFWWf........',
    '...FWwWF........',
    '...FWwwWFf......',
    '..fFWwwWF.......',
    '..FFWwwWFF......',
    '..FFFWwWFFF.....',
    '.fFFFWWWFFFf....',
    '.FFeFWWWeFF.....',
    '.FFeFFFFFeFF....',
    '..FFFFFFFFF.....',
    '................',
  ];
  const CF_FLAME76_ART = [ /* UI 定稿 §4.2 焰帧 F3 76: 右倾位相火舌(同一火舌摆动/翻页帧) */
    '................',
    '..........f.....',
    '..........F.....',
    '.........fFf....',
    '.........FWF....',
    '........fFWWf...',
    '........FWwWF...',
    '......fFWwwWF...',
    '.......FWwwWFf..',
    '......FFWwwWFF..',
    '.....FFFWwWFFF..',
    '....fFFFWWWFFFf.',
    '.....FFeFWWWeFF.',
    '....FFeFFFFFeFF.',
    '.....FFFFFFFFF..',
    '................',
  ];
  /* 九格画师: v1.10 九稿全固定像素(无 'C' 底噪无 rng 笔触), cfStamp 一笔直落;
     '.' 位不绘制留缺省透明(焰帧真透), 68~73 全不透明稿零 '.' */
  PAINTERS[T_CF_LOG_END] = (px)=>{
    cfStamp(px, CF_LOG_END68_ART); /* 外皮环/年轮方环/k 节疤固定像素零 rng */
  };
  PAINTERS[T_CF_LOG_SIDE] = (px)=>{
    cfStamp(px, CF_LOG_SIDE69_ART); /* 皮缘/底横纹/l 受光条/短划纹固定像素零 rng */
  };
  PAINTERS[T_CF_TOP_LIT] = (px)=>{
    cfStamp(px, CF_TOP_LIT70_ART); /* a 灰地/k 炭斑三群/f 橙芯/e 灼点固定像素零 rng */
  };
  PAINTERS[T_CF_SIDE_LIT] = (px)=>{
    cfStamp(px, CF_SIDE_LIT71_ART); /* a 缘/k 主体/竖向橙缝 f/F/e 灼点固定像素零 rng */
  };
  PAINTERS[T_CF_TOP_OUT] = (px)=>{
    cfStamp(px, CF_TOP_OUT72_ART); /* a 主导+k 露头斑(与 70 同构位)固定像素零 rng */
  };
  PAINTERS[T_CF_SIDE_OUT] = (px)=>{
    cfStamp(px, CF_SIDE_OUT73_ART); /* a 主体+竖向 k 暗缝固定像素零 rng */
  };
  PAINTERS[T_CF_FLAME_F1] = (px)=>{
    cfStamp(px, CF_FLAME74_ART); /* 中立位相火舌固定像素零 rng; '.' 位 alpha 0 真透 */
  };
  PAINTERS[T_CF_FLAME_F2] = (px)=>{
    cfStamp(px, CF_FLAME75_ART); /* 左倾位相火舌固定像素零 rng; '.' 位 alpha 0 真透 */
  };
  PAINTERS[T_CF_FLAME_F3] = (px)=>{
    cfStamp(px, CF_FLAME76_ART); /* 右倾位相火舌固定像素零 rng; '.' 位 alpha 0 真透 */
  };
  /* ---------- 生态地图(冒险模式生态地图设计稿 §6, 票据 T1): 雪原/沙漠/沼泽 ---------- */
  /* 雪块: 低噪雪白底 + 阴影微点 + 对角双像素亮闪(锚定 faceColor 雪白) */
  PAINTERS[T_SNOW] = (px, rng)=>{
    noiseFill(px, rng, [237, 242, 250], 0.02);
    for (let i=0; i<9; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [214, 222, 234]);
    for (let i=0; i<4; i++) { // 亮闪: 主闪点 + 斜下残影
      const x = 1 + Math.floor(rng() * 14); const y = 1 + Math.floor(rng() * 14);
      setP(px, x, y, [255, 255, 255]);
      setP(px, x + 1, y + 1, [248, 250, 252]);
    }
  };
  /* 雪覆草侧: 泥土壁(草地侧同底) + 顶 4 行雪被 + 雪沿下垂的牙齿 */
  PAINTERS[T_SNOWY_SIDE] = (px, rng)=>{
    noiseFill(px, rng, [140, 102, 69], 0.09);
    for (let x=0; x<TILE; x++) {
      for (let y=0; y<4; y++) {
        const v = 1 + (rng() * 2 - 1) * 0.04;
        setP(px, x, y, [237 * v, 242 * v, 250 * v]);
      }
      if (rng() < 0.5) setP(px, x, 4, [220, 228, 238]);
    }
  };
  /* 仙人掌: 仙人掌绿底 + 亮竖棱/棱间暗缝相间 + 棱尖刺点 + 上下缘暗收 */
  PAINTERS[T_CACTUS] = (px, rng)=>{
    noiseFill(px, rng, [74, 135, 56], 0.05); // 锚定 faceColor 仙人掌绿
    for (const x of [2, 6, 10, 14]) { // 亮棱柱
      for (let y=1; y<15; y++) {
        const v = 1 + (rng() * 2 - 1) * 0.05;
        setP(px, x, y, [104 * v, 168 * v, 72 * v]);
      }
    }
    for (const x of [4, 8, 12]) for (let y=0; y<16; y++) setP(px, x, y, [46, 92, 30]); // 棱间暗缝
    for (let i=0; i<8; i++) { // 棱尖刺点(米白)
      const x = [2, 6, 10, 14][Math.floor(rng() * 4)]; const y = 2 + Math.floor(rng() * 12);
      setP(px, x + (rng() < 0.5 ? -1 : 1), y, [228, 230, 210]);
    }
    for (let x=0; x<16; x++) { // 上下缘暗收
      setP(px, x, 0, [46, 92, 30]); setP(px, x, 15, [46, 92, 30]);
    }
  };
  /* 砂岩: 沉积层带 — 四带基调微差 + 层间缝横线(MC 砂岩分层观感) */
  PAINTERS[T_SANDSTONE] = (px, rng)=>{
    const bands = [[224, 206, 152], [214, 195, 139], [220, 201, 146], [208, 188, 132]];
    for (let b=0; b<4; b++) {
      for (let y=b*4; y<b*4+4; y++) {
        for (let x=0; x<16; x++) {
          const v = 1 + (rng() * 2 - 1) * 0.04;
          setP(px, x, y, [bands[b][0] * v, bands[b][1] * v, bands[b][2] * v]);
        }
      }
      for (let x=0; x<16; x++) setP(px, x, b*4+3, [182, 162, 112]); // 层间缝
    }
  };
  /* 枯灌木: 透明底 + 褐色枯枝(主茎 + 双上叉 + 横叉, 色深浅随 rng 抖动) */
  PAINTERS[T_DEAD_BUSH] = (px, rng)=>{
    const twig = ()=> rng() < 0.35 ? [96, 66, 30] : [128, 90, 46];
    for (let y=8; y<16; y++) setP(px, 8, y, twig()); // 主茎
    for (let i=1; i<=5; i++) setP(px, 8 - i, 8 - i, twig()); // 左上分叉
    for (let i=1; i<=4; i++) setP(px, 8 + i, 9 - i, twig()); // 右上分叉
    for (const p of [[9, 11], [10, 11], [11, 10]]) setP(px, p[0], p[1], twig()); // 右横小叉
    for (const p of [[6, 4], [4, 2], [12, 5]]) setP(px, p[0], p[1], twig()); // 梢头延长
  };
  PAINTERS[T_ORCHID] = (px, rng)=>flowerBase(px, rng, [74, 168, 216], [142, 207, 240], [43, 111, 150]); // 兰花: 蓝瓣深心
  PAINTERS[T_FLOWER_Y] = (px, rng)=>flowerBase(px, rng, [240, 207, 48], [248, 232, 120], [216, 160, 32]); // 蒲公英: 黄瓣
  PAINTERS[T_FLOWER_W] = (px, rng)=>flowerBase(px, rng, [244, 244, 240], [255, 255, 255], [232, 200, 50]); // 雏菊: 白瓣黄心

  /* 门板: 竖木板纹 + 中缝 + 外框(MC oak_door 观感语言); 上半加门把手(右下,
     与 mesh 铰链西北角配对 —— 把手在远铰链侧)。下半底部踢脚深色带 */
  function doorBase(px, rng) {
    for (let y=0; y<TILE; y++) {
      for (let x=0; x<TILE; x++) {
        const seam = (x === 0 || x === 15 || x === 5 || x === 10 || y === 15);
        const v = 1 + (rng() * 2 - 1) * 0.06;
        setP(px, x, y, seam ? [110, 84, 50] : [168 * v, 133 * v, 84 * v]);
      }
    }
  }
  PAINTERS[T_DOOR_BOTTOM] = (px, rng)=>doorBase(px, rng);
  PAINTERS[T_DOOR_TOP] = (px, rng)=>{
    doorBase(px, rng);
    for (const p of [[11, 8], [11, 9]]) setP(px, p[0], p[1], [70, 62, 55]); // 门把手(右下, 远铰链侧)
    setP(px, 11, 8, [150, 140, 130]); // 把手高光
  };
  /* 玻璃板: 2px 不透明浅框 + 中间全透明 + 斜高光(MC「玻璃=不透明框+透明芯」
     的窗框观感)。中间 alpha=0 交 alphaTest 裁掉 —— pushPane 按世界分数映射
     UV, 框恰好落在格缘/格界上(单张贴图服务中柱与任意连接臂) */
  PAINTERS[T_GLASS_PANE] = (px, rng)=>{
    const edge = [205, 232, 240];
    for (let i=0; i<TILE; i++) {
      for (const [x, y] of [[i, 0], [i, 1], [i, 14], [i, 15], [0, i], [1, i], [14, i], [15, i]]) {
        setP(px, x, y, edge);
      }
    }
    for (let i=2; i<10; i++) setP(px, 2 + i, 3 + i, [255, 255, 255]); // 斜高光线(透明芯里的一笔)
    setP(px, 4, 4, [255, 255, 255]);
  };

  /* 床(昼夜 D6 床观感票, 2026-10-28; 两格床改版 2026-10-29): 配色锚定 icons.js
     的 BED_ART 色板(P 白/p 浅灰/r 亮毯/R 深毯)与 planksBase 木色, 三张图同一
     语言。canvas 行 0 = 纹理 v 顶端 = 世界 −Z(北)端 —— 床头枕固定画在北端,
     床头块由 mesh 按床尾方位旋转顶面 UV(取向不存档, 世界状态派生); 老档
     lone 床头无床尾邻 → 缺省北端(既有观感)。 */
  /* 床头顶: 北端 4 行白枕(底行浅灰收沿) + 亮毯折沿 + 毯身两道褶皱 + 毯尾深线 */
  PAINTERS[T_BED_TOP] = (px, rng)=>{
    for (let y=0; y<TILE; y++) {
      for (let x=0; x<TILE; x++) {
        const v = 1 + (rng() * 2 - 1) * 0.04;
        if (y < 3) setP(px, x, y, [255 * v, 255 * v, 255 * v]); // 枕身(白)
        else if (y === 3) setP(px, x, y, [236, 236, 236]); // 枕沿(浅灰)
        else if (y < 6) setP(px, x, y, [224 * v, 85 * v, 69 * v]); // 折沿亮毯(盖过枕脚)
        else if (y === 15) setP(px, x, y, [184, 58, 48]); // 毯尾深线
        else setP(px, x, y, [224 * v, 85 * v, 69 * v]); // 毯身
      }
    }
    for (const y of [9, 12]) { // 毯面褶皱横线(带断续更像布纹)
      for (let x=0; x<TILE; x++) if (rng() < 0.8) setP(px, x, y, [196, 66, 54]);
    }
  };
  /* 床尾顶: 全毯面(无枕) + 两道褶皱 + 与床头接缝处的折沿深线(canvas 行 0 = 靠床头端) */
  PAINTERS[T_BED_TOP_FOOT] = (px, rng)=>{
    for (let y=0; y<TILE; y++) {
      for (let x=0; x<TILE; x++) {
        const v = 1 + (rng() * 2 - 1) * 0.04;
        if (y === 0) setP(px, x, y, [184, 58, 48]); // 接缝折沿深线(贴床头端)
        else if (y === 15) setP(px, x, y, [184, 58, 48]); // 床尾沿深线
        else setP(px, x, y, [224 * v, 85 * v, 69 * v]); // 毯身
      }
    }
    for (const y of [6, 11]) { // 毯面褶皱横线(床头顶同语言)
      for (let x=0; x<TILE; x++) if (rng() < 0.8) setP(px, x, y, [196, 66, 54]);
    }
  };
  /* 床侧(床头/床尾共用): 上段毯沿垂边(0..2)+毯木分界深线(3)+下段木框(4..15,
     板缝横线)。几何侧面只采 tile 顶部 h=0.55 段(行 0..8.8, 与 pushBedBox 的
     比例窗同口径), 行 9+ 照填木框防 thin 调参后露底 */
  PAINTERS[T_BED_SIDE] = (px, rng)=>{
    for (let y=0; y<TILE; y++) {
      for (let x=0; x<TILE; x++) {
        const v = 1 + (rng() * 2 - 1) * 0.05;
        if (y < 3) setP(px, x, y, [224 * v, 85 * v, 69 * v]); // 毯沿垂边
        else if (y === 3) setP(px, x, y, [184, 58, 48]); // 毯木分界深线
        else if (y === 7 || y === 15) setP(px, x, y, [120, 92, 55]); // 木框板缝
        else setP(px, x, y, [168 * v, 133 * v, 84 * v]); // 木框
      }
    }
  };
  /* 怪物巢穴之心(den-nest-design D9): 暗铁笼网格(竖/横笼条) + 中央暗红核
      (跳动的心——内核亮斑+外圈渐暗); 底色近黑衬光(light 5 自发光观感底) */
  PAINTERS[T_SPAWNER] = (px, rng)=>{
    noiseFill(px, rng, [30, 24, 26], 0.06); // 近黑底(铁笼缝隙的暗腔)
    for (let i=0; i<TILE; i++) {
      for (const b of [1, 6, 11, 15]) { // 竖笼条 x 与横笼条 y 同网格
        const v = 1 + (rng() * 2 - 1) * 0.08;
        setP(px, b, i, [86 * v, 82 * v, 88 * v]); setP(px, i, b, [86 * v, 82 * v, 88 * v]);
        if (rng() < 0.25) setP(px, b, i, [62, 58, 64]); // 笼条锈斑
      }
    }
    for (let dy=-3; dy<=3; dy++) { // 中央 7×7 红核: 距心渐暗(心脏光晕)
      for (let dx=-3; dx<=3; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 3.2) continue;
        setP(px, 8 + dx, 8 + dy, d < 1.2 ? [228, 64, 64] : (d < 2.2 ? [168, 34, 44] : [104, 18, 28]));
      }
    }
    setP(px, 7, 7, [255, 120, 110]); setP(px, 8, 7, [240, 90, 84]); // 内核高光(跳动亮点)
  };
  /* 苔石(巢穴丘体/副本祭坛/石阵共用): 圆石底 + 绿苔斑团(斑缘残缺) + 苔点
     ——苔色锚定 config faceColor [0.45,0.52,0.38] 观感连续, LOD 远景不串调 */
  PAINTERS[T_MOSSY] = (px, rng)=>{
    PAINTERS[T_COBBLE](px, rng);
    for (let i=0; i<5; i++) {
      const w = 2 + Math.floor(rng() * 3); const h = 2 + Math.floor(rng() * 2);
      const x = Math.floor(rng() * (TILE - w)); const y = Math.floor(rng() * (TILE - h));
      for (let dy=0; dy<h; dy++) {
        for (let dx=0; dx<w; dx++) {
          if (rng() < 0.2) continue; // 斑缘残缺(苔不盖满)
          const v = 1 + (rng() * 2 - 1) * 0.08;
          setP(px, x + dx, y + dy, [96 * v, 116 * v, 74 * v]);
        }
      }
    }
    for (let i=0; i<6; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [78, 96, 58]);
  };
  /* 黑曜石(黑巢丘冠/门框): 近黑紫底强噪 + 紫辉 2px 斑团 + 稀品红高光碎点
     (MC 黑曜石「黑里透紫」观感; 底色锚 faceColor [0.10,0.08,0.16]) */
  PAINTERS[T_OBSIDIAN] = (px, rng)=>{
    noiseFill(px, rng, [26, 20, 41], 0.12);
    for (let i=0; i<6; i++) {
      const x = Math.floor(rng() * 15); const y = Math.floor(rng() * 15);
      setP(px, x, y, [46, 32, 70]); setP(px, x + 1, y, [46, 32, 70]);
      if (rng() < 0.5) setP(px, x, y + 1, [38, 28, 56]);
    }
    for (let i=0; i<3; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [96, 66, 140]);
  };
  /* 发光岩(门楣/巢厅角落路标): 琥珀底 + 亮金 2×2 斑团 + 炽白点
     (MC 萤石马赛克观感; 底色偏暗衬 light 15 自发光的亮斑) */
  PAINTERS[T_GLOWSTONE] = (px, rng)=>{
    noiseFill(px, rng, [188, 144, 66], 0.08);
    for (let i=0; i<7; i++) {
      const x = Math.floor(rng() * 14); const y = Math.floor(rng() * 14);
      for (let dy=0; dy<2; dy++) {
        for (let dx=0; dx<2; dx++) {
          setP(px, x + dx, y + dy, rng() < 0.5 ? [255, 214, 118] : [240, 186, 90]);
        }
      }
    }
    for (let i=0; i<4; i++) setP(px, Math.floor(rng()*TILE), Math.floor(rng()*TILE), [255, 244, 182]);
  };
  /* 远古残骸(73, 装备系统 T7): 正典上下螺旋纹——暗棕斑驳底 + 同心方环亮带
     (距中心切比雪夫半径 1/5 两道「回」形环, 环线带小抖动; MC 残骸顶面的
     方环漩涡观感), 中心 2×2 撒 2 粒亮棕晶粒(侧面斑驳语言)。与黑曜石/
     下界岩同批暗调 */
  PAINTERS[T_DEBRIS] = (px, rng)=>{
    noiseFill(px, rng, [56, 38, 32], 0.08);
    const band = (x, y) => {
      const j = 1 + (rng() * 2 - 1) * 0.05;
      setP(px, x, y, [92 * j | 0, 64 * j | 0, 50 * j | 0]);
    };
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) - 0.5;
        if (ring === 1 || ring === 5) band(x, y);
      }
    }
    for (let i = 0; i < 2; i++) {
      setP(px, 7 + Math.floor(rng() * 2), 7 + Math.floor(rng() * 2), [104, 74, 54]);
    }
  };
  /* 战利品宝箱(副本通关奖励, den-nest §7.5 D16): 红金经典配色——深红木板箱体
      (planksBase 同行构红色版) + 上下金箍带 + 中央金锁扣; 顶盖红底金边框+中央
      金扣横条。双格同图(左右同款)=MC 双箱观感, 系统刷出固定贴墙无朝向语义 */
  function redPlanksBase(px, rng) {
    for (let b=0; b<4; b++) {
      const y0 = b * 4; const tint = 1 + (rng() * 2 - 1) * 0.05; // 板条各自基调
      for (let y=y0; y<y0+4; y++) {
        for (let x=0; x<TILE; x++) {
          const v = tint * (1 + (rng() * 2 - 1) * 0.05);
          setP(px, x, y, [164 * v, 46 * v, 40 * v]);
        }
      }
      for (let x=0; x<TILE; x++) setP(px, x, y0 + 3, [118, 30, 26]); // 板缝横线(深红)
      const sx = 2 + Math.floor(rng() * 12);
      for (let y=y0; y<y0+3; y++) setP(px, sx, y, [134, 38, 32]); // 竖缝(逐板错位)
    }
  }
  PAINTERS[T_LOOT_SIDE] = (px, rng)=>{
    redPlanksBase(px, rng);
    for (const y of [1, 2, 13, 14]) { // 上下金箍带(亮金斑混色)
      for (let x=0; x<TILE; x++) setP(px, x, y, rng() < 0.3 ? [248, 208, 108] : [222, 176, 62]);
    }
    for (const y of [7, 8, 9]) for (let x=6; x<=9; x++) setP(px, x, y, [184, 140, 44]); // 中央锁座
    setP(px, 7, 8, [255, 232, 150]); setP(px, 8, 8, [120, 88, 24]); // 锁眼高光/暗面
  };
  PAINTERS[T_LOOT_TOP] = (px, rng)=>{
    redPlanksBase(px, rng);
    for (let i=0; i<TILE; i++) { // 金边框围一圈(盖沿)
      for (const [x, y] of [[i, 0], [i, 1], [i, 14], [i, 15], [0, i], [1, i], [14, i], [15, i]]) {
        setP(px, x, y, rng() < 0.3 ? [248, 208, 108] : [222, 176, 62]);
      }
    }
    for (let y=7; y<=8; y++) for (let x=5; x<=10; x++) setP(px, x, y, [184, 140, 44]); // 中央扣横条
    setP(px, 7, 7, [255, 232, 150]); // 扣面高光
  };
  /* ---------- 怪物合成材料件(mob-crafting-design D1): 南瓜三格 + 铁块一格 ----------
     南瓜侧画一次(pumpkinSide)三格共用底: 顶面叠边环+短茎, 雕刻侧叠刻脸——
     同一格底保证棱纹连续(整块南瓜三面观感一致)。 */
  const PUMPKIN_BODY = [204, 122, 32]; const PUMPKIN_DARK = [156, 88, 18]; const PUMPKIN_LIGHT = [232, 160, 62];
  function pumpkinSide(px, rng) { // 橙底+四条竖深棱+错位亮斑(MC 南瓜侧的瓣纹)
    noiseFill(px, rng, PUMPKIN_BODY, 0.06);
    for (const x of [2, 6, 10, 14]) {
      for (let y=0; y<TILE; y++) setP(px, x, y, PUMPKIN_DARK);
      for (let y=0; y<TILE; y++) if (rng() < 0.4) setP(px, x + 1, y, PUMPKIN_DARK);
    }
    for (const x of [0, 4, 8, 12]) {
      for (let y=0; y<TILE; y++) if (rng() < 0.3) setP(px, x, y, PUMPKIN_LIGHT);
    }
  }
  PAINTERS[T_PUMPKIN_SIDE] = (px, rng)=>pumpkinSide(px, rng);
  PAINTERS[T_PUMPKIN_TOP] = (px, rng)=>{ // 顶面: 棱瓣底+深色边环+中央短茎(3×4 棕块)
    pumpkinSide(px, rng);
    for (let i=0; i<TILE; i++) {
      setP(px, i, 0, PUMPKIN_DARK); setP(px, i, TILE - 1, PUMPKIN_DARK);
      setP(px, 0, i, PUMPKIN_DARK); setP(px, TILE - 1, i, PUMPKIN_DARK);
    }
    for (let y=6; y<=9; y++) for (let x=6; x<=9; x++) setP(px, x, y, [124, 96, 44]);
    setP(px, 7, 6, [150, 120, 58]); // 茎高光
  };
  PAINTERS[T_CARVED_PUMPKIN] = (px, rng)=>{ // 刻脸: 两只倒三角眼+三行竖齿嘴(暗棕内芯)
    pumpkinSide(px, rng);
    const CARVE = [74, 44, 14];
    for (const cx of [3, 10]) { // 眼: 3 宽顶行+中央 1 像素收尖
      setP(px, cx, 5, CARVE); setP(px, cx + 1, 5, CARVE); setP(px, cx + 2, 5, CARVE);
      setP(px, cx + 1, 6, CARVE);
    }
    for (let y=10; y<=12; y++) { // 嘴: 横带内留竖齿缝(中行 x%3==1 不画=牙)
      for (let x=3; x<=12; x++) {
        const tooth = (y === 11 && x % 3 === 1);
        if (!tooth) setP(px, x, y, CARVE);
      }
    }
  };
  PAINTERS[T_IRON_BLOCK] = (px, rng)=>{ // 铁块: 银灰底+深框+内亮方+四角铆点(MC 铁块观感)
    noiseFill(px, rng, [212, 214, 218], 0.04);
    for (let i=0; i<TILE; i++) {
      setP(px, i, 0, [156, 160, 168]); setP(px, i, TILE - 1, [156, 160, 168]);
      setP(px, 0, i, [156, 160, 168]); setP(px, TILE - 1, i, [156, 160, 168]);
    }
    for (let i=3; i<=12; i++) { // 内芯方框: 上/左亮线+下/右暗线(浮雕感)
      setP(px, i, 3, [228, 230, 234]); setP(px, 3, i, [228, 230, 234]);
      setP(px, i, 12, [198, 200, 206]); setP(px, 12, i, [198, 200, 206]);
    }
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { // 四角铆点(2×2)
      setP(px, x, y, [110, 114, 122]); setP(px, x + 1, y, [110, 114, 122]);
      setP(px, x, y + 1, [110, 114, 122]); setP(px, x + 1, y + 1, [140, 144, 152]);
    }
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
      14: T_MOSSY, /* 苔石(巢穴丘体/副本祭坛/石阵) */
      /* 新方块 36~50(附录 A): 纯色近似升级为像素贴图; 51 箱子/52 羊毛号段顺延入集 */
      [B_COAL_ORE]: T_COAL_ORE, [B_IRON_ORE]: T_IRON_ORE,
      [B_GOLD_ORE]: T_GOLD_ORE, [B_DIAMOND_ORE]: T_DIAMOND_ORE,
      [B_GRASS_TUFT]: T_TUFT,
      [B_FARMLAND]: {top: T_FARMLAND_TOP, side: T_FARMLAND_SIDE, bottom: T_DIRT},
      [B_WHEAT_0]: T_WHEAT_0, [B_WHEAT_1]: T_WHEAT_1,
      [B_WHEAT_2]: T_WHEAT_2, [B_WHEAT_3]: T_WHEAT_3,
      [B_CRAFT]: {top: T_CRAFT_TOP, side: T_CRAFT_SIDE, bottom: T_PLANKS},
      [B_FURNACE]: {top: T_FURNACE_TOP, side: T_FURNACE_SIDE, bottom: T_FURNACE_BOTTOM},
      [B_TORCH]: T_TORCH, [B_CLAY]: T_CLAY, [B_SAPLING]: T_SAPLING,
      [B_CHEST]: {top: T_CHEST_TOP, side: T_CHEST_SIDE, bottom: T_PLANKS},
      [B_WOOL]: T_WOOL, /* F4 羊毛(52) */
      /* 生态地图新方块 54~62(冒险模式设计稿 §6): 雪覆草顶复用雪块格/底共享泥土格
         (面朝下几乎不可见, 省格即少一处 mipmap 串色面); B_ICE 不入集(glass 纯色透渲) */
      [B_SNOW]: T_SNOW,
      [B_SNOWY_GRASS]: {top: T_SNOW, side: T_SNOWY_SIDE, bottom: T_DIRT},
      [B_CACTUS]: T_CACTUS, [B_SANDSTONE]: T_SANDSTONE,
      [B_DEAD_BUSH]: T_DEAD_BUSH,
      [B_ORCHID]: T_ORCHID, [B_FLOWER_Y]: T_FLOWER_Y, [B_FLOWER_W]: T_FLOWER_W,
      /* 门与玻璃板 64~68(docs/door-window-design.md §5.3): 门四态共用两张门板图
         (下半/上半, 竖直薄板按世界分数取 UV); 玻璃板一张(框在贴图边缘) */
      [B_DOOR]: T_DOOR_BOTTOM, [B_DOOR_TOP]: T_DOOR_TOP,
      [B_DOOR_OPEN]: T_DOOR_BOTTOM, [B_DOOR_TOP_OPEN]: T_DOOR_TOP,
      [B_GLASS_PANE]: T_GLASS_PANE,
      /* 床 53/69(两格床改版): 床头/床尾薄块扁盒分面 —— 床头顶=枕+毯 / 床尾顶=全毯 /
         侧=毯沿+木框(两半共用); 底面盒路径不绘(推床盒跳 f=2), 条目补 side 兜底
         防 atlasTileOf 越界。床头顶的枕按床尾方位由 mesh 旋转 UV */
      [B_BED]: {top: T_BED_TOP, side: T_BED_SIDE, bottom: T_BED_SIDE},
      [B_BED_FOOT]: {top: T_BED_TOP_FOOT, side: T_BED_SIDE, bottom: T_BED_SIDE},
      /* 怪物巢穴之心 70(den-nest-design): 铁笼+红核整格同图 */
      [B_SPAWNER]: T_SPAWNER,
      /* 黑巢地上件入集(巢穴观感票): 黑曜石/发光岩此前走 faceColor 纯色兜底是
         「黑巢读不出黑」的根因。门面/熄门不入集(贴图三试三否——斜纹平紫块/
         逐块小漩涡/宏格大漩涡, 2026-10-30 拍板回退): glass 旗标走玻璃通道
         平紫半透明(贴图前观感, 2 格门/3 格门天然均匀), 辨识度补常驻光柱 */
      [B_OBSIDIAN]: T_OBSIDIAN, [B_GLOWSTONE]: T_GLOWSTONE,
      /* 战利品宝箱 71(den-nest §7.5 D16): 红金经典配色整格立方体——双格同图
         (左右同款=MC 双箱观感), 标准图集通道渲染(mesh-core 零特殊几何);
         顶盖分格(金边框+扣横条), 底面几乎不可见复用侧格 */
      [B_LOOT_CHEST]: {top: T_LOOT_TOP, side: T_LOOT_SIDE, bottom: T_LOOT_SIDE},
      /* 低档奖励箱 72(den-nest §7.5 D18): 单格低档款复用 71 红金同格(零新增
         画师格位, count 仍 52)——「新 id 好认物, 红金好认箱」, 单格 vs 双格
         一眼分大小 */
      [B_LOOT_CHEST_SMALL]: {top: T_LOOT_TOP, side: T_LOOT_SIDE, bottom: T_LOOT_SIDE},
      /* 远古残骸 73(装备系统 T7): 正典上下螺旋纹整格同图(上下/四面同纹,
         MC 残骸各面同款观感), 标准图集通道渲染 */
      [B_ANCIENT_DEBRIS]: T_DEBRIS,
      /* 覆雪树叶 74(世界边界 T12): 深绿针叶底+白雪覆盖大部整格同图, 标准图集
         通道渲染(树叶 7 同款立方体通道); 北带落雪杉冠盖专用件 */
      [B_SNOWY_LEAVES]: T_SNOWY_LEAVES,
      /* 冰 56(世界边界·T8): 淡蓝冰面+裂纹折线整格同图, 标准图集通道渲染。
         G3 走查拍板 2026-11-07: 原 glass 纯色半透在雪原上读作「脏渍」——摘
         glass 旗标走 74 同款不透明通道入集(73/74 先例第二次用户授权突破
         「零新贴图」); 冰湖缘混铺/山足冰崖/檐下冻舌/雪原冻湖四处共用 */
      [B_ICE]: T_ICE,
      /* 怪物合成材料件 75~77(mob-crafting T1): 南瓜分面(顶=茎图/侧=棱瓣, 底
         复用顶格——面朝下几乎不可见同款省格), 雕刻南瓜侧换刻脸格(四面同脸,
         取向不存档红线, 设计稿差异 B19); 铁块整格同图 */
      [B_PUMPKIN]: {top: T_PUMPKIN_TOP, side: T_PUMPKIN_SIDE, bottom: T_PUMPKIN_TOP},
      [B_CARVED_PUMPKIN]: {top: T_PUMPKIN_TOP, side: T_CARVED_PUMPKIN, bottom: T_PUMPKIN_TOP},
      [B_IRON_BLOCK]: T_IRON_BLOCK,
      /* 粉羊毛 78(城镇重制公共件 revamp-spec §2): 樱花树冠/布幔/旗阵的规格樱粉,
         白羊毛(52)同画法换粉底整格同图 */
      [B_PINK_WOOL]: T_PINK_WOOL,
      /* 门额牌 80(东带 v2 野心版 S2): 西面=60 镇徽钟塔图, back=61 纯木底(东/
         南/北三面——back 为 mesh 专用小盒路径读的新分面字段, atlasTileOf 对
         未知字段无感); top/bottom 同格木底。陶橙瓦 79 不入集(纯色行 faceColor
         兜底, S1 零贴图成本) */
      [B_GATE_SIGN]: {side: T_GATE_SIGN, back: T_GATE_WOOD, top: T_GATE_WOOD, bottom: T_GATE_WOOD},
      /* 篝火两态 81/82(篝火 T-C13 分面返工, UI 定稿 §4.1 v1.9 分面接线表): 顶=灶面
         (俯视)/四侧=侧脸(正视)/底=side 兜底(贴地不绘, 三键齐守 usedTiles 覆盖面
         循环拿 undefined——床/宝箱分面条目同款先例); 旧全脸同图格 62/63 作废存档
         不接线(画师保留, 存档测试守) */
      [B_CAMPFIRE]: {top: T_CAMPFIRE_TOP, side: T_CAMPFIRE_SIDE, bottom: T_CAMPFIRE_SIDE},
      [B_CAMPFIRE_OUT]: {top: T_CAMPFIRE_OUT_TOP, side: T_CAMPFIRE_OUT_SIDE, bottom: T_CAMPFIRE_OUT_SIDE},
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

  /* 已绘制格数: PAINTERS 从 0 起连续(1 格一位), 数组长即格数 */
  return {layout, count: PAINTERS.length, paintAll, tileUV, makeCanvas};
})();
