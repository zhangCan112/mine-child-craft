'use strict';
/* ============================================================
   网格化核心 (MeshCore) — 引擎层纯核心 (术语见 GLOSSARY.md)
   ------------------------------------------------------------
   区块数据 → 顶点裸数组 的纯变换: 全细节四通道(实心/玻璃/TNT贴图/
   方块图集 texture-atlas; 图集内薄块走十字面片、火把走专用小盒 pushTorch
   (MC 同款, mc-torch-model-research §1/§2)、pane 旗标走竖直薄板
   pushPane — 门/玻璃板, docs/door-window-design.md §5)与 LOD 降采样粗网格。
   零 THREE · 零 DOM ·
   加载零副作用 →
   Node 可直接加载单测; 同一份代码在主线程(world.js 兜底路径)与
   Worker(js/mesh-worker.js, http 服务下的主路径)里运行。
   依赖(均经全局名, 调用期解析): config.js 的 BLOCKS/CHUNK/faceColor。
   图集布局经 opts.atlas 注入(texture-atlas.js 的 layout, 与 tntTiles
   同惯例): 未注入时入集方块回落纯色通道, 存量调用方零侵入。
   hashRand 由调用方注入(与 combat-core 同惯例: 纯核心零全局可变依赖,
   且 Worker 不加载体素模型 — 世界数据随消息传递, 不共享)。
   输入 pack = voxel.js packChunkData 的输出:
   { cells:Uint8Array(w*d*h), sky, block, w, d, h, border, bx, bz, yMax }
   (bx/bz 为 pack 原点的世界坐标; border=1 时含邻块边界圈供跨区块剔面;
   网格顶点坐标一律用世界坐标 — 与渲染/物理同一坐标系)。
   顶点光(D3, docs/mc-daylight-torch-design.md §4.1): 四通道每顶点产出
   sky/block 两个标量(值=等级/15) — 普通面与 pane 竖直薄板取面朝向邻格光
   (关门是 opaque 挡光格、自身格恒 0, 取自身格会整扇黑——2026-10-27 修),
   十字片/薄块取自身格(火把自亮), LOD 仅天空二值 0/15·block 恒 0;
   无光照载荷的旧 pack 回落全亮(sky 15 · block 0), 存量调用方零侵入。
   ============================================================ */

const MeshCore = (() => {
  /* 六面朝向表: dir 法线 · corners 四角(0/1 单位立方, 三角化序 0,1,2, 2,1,3 法线恒朝外) */
  const FACES = [
    {dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]]},
    {dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]]},
    {dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]]},
    {dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]]},
    {dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]]},
    {dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]},
  ];

  /* 面朝向 → UV (保证侧面文字不镜像; 从 world.js 原样迁入) */
  function faceUV(dir, cor) {
    let u; let v;
    if (dir[1] === 1) { // 顶
      u = cor[0]; v = 1-cor[2];
    } else if (dir[1] === -1) { // 底
      u = 1-cor[0]; v = 1-cor[2];
    } else if (dir[0] === 1) { // 东
      u = 1-cor[2]; v = cor[1];
    } else if (dir[0] === -1) { // 西
      u = cor[2]; v = cor[1];
    } else if (dir[2] === 1) { // 南
      u = cor[0]; v = cor[1];
    } else { // 北
      u = 1-cor[0]; v = cor[1];
    }
    return [u, v];
  }

  const mkCh = () => ({positions: [], colors: [], normals: [], indices: [], sky: [], block: [], n: 0});
  const mkTexCh = () => ({positions: [], uvs: [], normals: [], indices: [], sky: [], block: [], n: 0});

  /* 贴地薄块(引线/压力板/床): 不参与面剔除, 始终绘制一个扁盒子(跳过底面)。
     顶点光取自身格(设计稿 §4.1: 薄块无"面朝向邻格"概念, 光值=所在格)。
     逐面取 faceColor(昼夜 D3 兑现 D6 惰性 top 字段, §7.1): 床顶面=红毯 /
     侧=床架; 存量薄块(引线等)只有 all → 颜色零变化 */
  function pushThin(t, x, y, z, id, h, tint, lvSky, lvBlk) {
    for (let f=0; f<6; f++) {
      if (f===2) continue;
      const face = FACES[f];
      const col = faceColor(id, face.dir);
      for (let c=0; c<4; c++) {
        const cor = face.corners[c];
        t.positions.push(x+cor[0], y+cor[1]*h, z+cor[2]);
        t.normals.push(face.dir[0], face.dir[1], face.dir[2]);
        t.colors.push(col[0]*tint, col[1]*tint, col[2]*tint);
        t.sky.push(lvSky);
        t.block.push(lvBlk);
      }
      t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
      t.n += 4;
    }
  }

  /* 通用四边形: 按面朝向取单位角点, 各轴按尺寸缩放(cor∈{0,1} → 0/尺寸)
     y 轴用 y0+cor[1]*sy — 顶面 sy=0(共面), 裙边 y0=邻格顶 · sy=高差。
     LOD 顶点光: 仅天空二值(设计稿 §4.1, block 恒 0 — 火把点光不进 LOD) */
  function pushQuad(t, f, x, y0, z, sx, sy, sz, col, lvSky) {
    const face = FACES[f];
    for (let c=0; c<4; c++) {
      const cor = face.corners[c];
      t.positions.push(x+cor[0]*sx, y0+cor[1]*sy, z+cor[2]*sz);
      t.normals.push(face.dir[0], face.dir[1], face.dir[2]);
      t.colors.push(col[0], col[1], col[2]);
      t.sky.push(lvSky);
      t.block.push(0);
    }
    t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
    t.n += 4;
  }

  /* 十字面片(草丛/麦/树苗等入集薄块): 两个对角面各正反两绘 —
     FrontSide 材质下双面可见; 几何占满格高, 视觉高度由贴图 alpha 裁切
     (world.js atlasMat 的 alphaTest), 麦四阶段的"渐高"画在像素里而非
     压扁几何(压扁会让植株比例失真)。顶点光取自身格(设计稿 §4.1)。
     火把曾是十字片一员, 2026-10-28 起改走下方专用小盒 pushTorch
     (MC 火把不是 cross 模型, 资产级差异见 mc-torch-model-research §1.2) */
  function pushCross(t, x, y, z, tile, cols, rows, lvSky, lvBlk) {
    const c = tile % cols; const r = Math.floor(tile / cols);
    const u0 = c/cols; const u1 = (c+1)/cols;
    const v0 = (rows-1-r)/rows; const v1 = (rows-r)/rows;
    const s = 0.7071; // 对角面法线水平分量(1/√2)
    /* corners 序 [bl, br, tl, tr]; 反向面角点镜像(UV 随之镜像, 背面图案不反) */
    const planes = [
      {p: [[0.1, 0, 0.1], [0.9, 0, 0.9], [0.1, 1, 0.1], [0.9, 1, 0.9]], n: [-s, 0, s], mirror: false},
      {p: [[0.9, 0, 0.9], [0.1, 0, 0.1], [0.9, 1, 0.9], [0.1, 1, 0.1]], n: [s, 0, -s], mirror: true},
      {p: [[0.9, 0, 0.1], [0.1, 0, 0.9], [0.9, 1, 0.1], [0.1, 1, 0.9]], n: [-s, 0, -s], mirror: false},
      {p: [[0.1, 0, 0.9], [0.9, 0, 0.1], [0.1, 1, 0.9], [0.9, 1, 0.1]], n: [s, 0, s], mirror: true},
    ];
    for (const pl of planes) {
      const us = pl.mirror ? [u1, u0, u1, u0] : [u0, u1, u0, u1];
      for (let i=0; i<4; i++) {
        t.positions.push(x+pl.p[i][0], y+pl.p[i][1], z+pl.p[i][2]);
        t.normals.push(pl.n[0], pl.n[1], pl.n[2]);
        t.uvs.push(us[i], i < 2 ? v0 : v1);
        t.sky.push(lvSky);
        t.block.push(lvBlk);
      }
      t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
      t.n += 4;
    }
  }

  /* 火把专用小盒(mc-torch-model-research §1/§2, MC 资产 @1.21.11 同款):
     2×10×2 像素(0.125×0.625×0.125 格)实心小盒——MC 火把是专用盒模型, 与植物
     cross 面片无 parent 关系; 「明显方块」感的根治 = 它真的不再是方块。
     立式(lean=null): 水平居中贴地(from[7,0,7]→to[9,10,9])。
     墙式 lean{ax,d}(ax 0=x/1=z, d=墙在 ± 向): 用户拍板「不外倾, 直接贴墙」
     (2026-10-28)——整盒平移满贴支承墙面, 底边距格底 3.5px(读作「挂」在
     墙上而非立在地上); 贴墙侧面与墙面共面(会 z-fight)且不可见 → 剔除不绘。
     MC 原版此姿态是旋转 −22.5° 顶端外倾, 本项目弃旋转——登记偏差见
     block-lifecycle-design.md 附录 B。
     贴图采样窗(research §1.1 UV 原文, 像素自格左/顶起): 侧面棍条[7,6,9,16]
     ·顶面[7,6,9,8] 火色·底面[7,13,9,15] 深木。cullDown=立式垫块贴合 → 底面
     剔除(MC cullface:down); 墙式悬空底面可见(MC 墙模板无 cullface)。
     顶点光取自身格(block=14 夜间自亮); 无旋转, 法线=轴对齐面法线。 */
  const TORCH_HALF = 1/16; /* 盒半宽: 2px */
  const TORCH_LEN = 10/16; /* 盒轴长: 10px */
  const TORCH_LIFT = 3.5/16; /* 墙式底边距格底: 3.5px(MC 墙式基线) */
  function pushTorch(t, x, y, z, tile, cols, rows, lvSky, lvBlk, lean, cullDown) {
    const c = tile % cols; const r = Math.floor(tile / cols);
    const uT = c/cols; const vT = (rows-1-r)/rows; /* 格左下角 UV */
    const WINS = [[7, 6, 2, 10], [7, 6, 2, 2], [7, 13, 2, 2]]; /* 侧面/顶/底采样窗 */
    /* 盒中心: 立式水平居中; 墙式整盒贴支承墙面(贴墙侧盒面恰在墙面上) */
    const ax = lean ? lean.ax : 0; const d = lean ? lean.d : 0;
    const cx = lean && ax === 0 ? x + (d > 0 ? 1 - TORCH_HALF : TORCH_HALF) : x + 0.5;
    const cz = lean && ax === 1 ? z + (d > 0 ? 1 - TORCH_HALF : TORCH_HALF) : z + 0.5;
    const cy = y + (lean ? TORCH_LIFT : 0); /* 立式贴地 · 墙式底抬 3.5px */
    /* 贴墙面剔除: 墙式朝墙那面与支承墙面共面(z-fight)且不可见(lean 派生自
       实心墙, 剔除安全) → FACES 序 0:-x/1:+x/4:-z/5:+z */
    const wallFace = !lean ? -1 : (ax === 0 ? (d > 0 ? 1 : 0) : (d > 0 ? 5 : 4));
    for (let f=0; f<6; f++) {
      if ((f === 2 && cullDown) || f === wallFace) continue;
      const face = FACES[f];
      const w = WINS[f === 2 ? 2 : (f === 3 ? 1 : 0)];
      for (let i=0; i<4; i++) {
        const cor = face.corners[i];
        const lx = (cor[0]*2-1)*TORCH_HALF; /* 角点 0/1 → ±半宽 */
        const ly = cor[1]*TORCH_LEN; /* 0/1 → 0/轴长 */
        const lz = (cor[2]*2-1)*TORCH_HALF;
        t.positions.push(cx+lx, cy+ly, cz+lz);
        t.normals.push(face.dir[0], face.dir[1], face.dir[2]);
        /* 面内 [0,1]² → 像素窗: u 左起 · v 底起(fv=0 采样窗底行) */
        const fuv = faceUV(face.dir, cor);
        t.uvs.push(uT + (w[0] + fuv[0]*w[2])/16/cols,
            vT + (16 - w[1] - (1 - fuv[1])*w[3])/16/rows);
        t.sky.push(lvSky);
        t.block.push(lvBlk);
      }
      t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
      t.n += 4;
    }
  }

  /* 竖直薄板(门/玻璃板, docs/door-window-design.md §5): 图集通道 alphaTest 真透明。
     朝向拍板③固定: 门闭=板贴北缘(z 0..3/16)横跨 x 全宽, 开=绕西北角铰链转到
     西缘(x 0..3/16)横跨 z —— 开态由 solid:false 派生(64↔66 状态即 id), 零存储;
     上/下半贴图由 layout 的 side 格号区分。玻璃板 = 中柱 + 按邻接出臂(邻格玻璃板
     或实心即连, 网格化现算 = MC 东南西北四布尔的免存档版); UV 按世界分数取窗,
     贴图边框恰好落在格缘。复用 FACES 角点绕序(法线恒朝外)×缩放偏移。 */
  /* pane 竖直薄板(门/玻璃板): 面光取面朝向邻格(lsky/lblk 注入, 与实心面同口径
     ——关门自身格恒 0, 取自身格整扇黑); 几何/贴图与历史逐字一致 */
  function pushPane(t, x, y, z, lx, lz, b, ae, atlas, lget, lsky, lblk) {
    const tile = atlasTileOf(ae, [0, 0, 1]);
    const u0 = (tile % atlas.cols) / atlas.cols;
    const v0 = (atlas.rows - 1 - Math.floor(tile / atlas.cols)) / atlas.rows;
    const du = 1 / atlas.cols; const dv = 1 / atlas.rows;
    function quad(f, sc, of, win) {
      const face = FACES[f];
      const nx = lx + face.dir[0]; const ny = y + face.dir[1]; const nz = lz + face.dir[2];
      const fSky = lsky(nx, ny, nz) / 15; const fBlk = lblk(nx, ny, nz) / 15;
      for (let c=0; c<4; c++) {
        const cor = face.corners[c];
        const uv = faceUV(face.dir, cor);
        t.positions.push(x + cor[0]*sc[0] + of[0], y + cor[1]*sc[1] + of[1], z + cor[2]*sc[2] + of[2]);
        t.normals.push(face.dir[0], face.dir[1], face.dir[2]);
        t.uvs.push(u0 + (win[0] + uv[0]*(win[2]-win[0]))*du, v0 + (win[1] + uv[1]*(win[3]-win[1]))*dv);
        t.sky.push(fSky);
        t.block.push(fBlk);
      }
      t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
      t.n += 4;
    }
    if (b.glass) { // 玻璃板: 中柱 + 四向连接臂(顶底薄边/臂端帽省略, 附录 B)
      const T = 0.125; const a = 0.5 - T / 2; const c1 = 0.5 + T / 2; // 中柱厚 2px(MC 口径)
      const link = (dx, dz) => {
        const nid = lget(lx + dx, y, lz + dz);
        const nb = nid !== 0 ? BLOCKS[nid] : null;
        return !!(nb && ((nb.pane && nb.glass) || (nb.solid !== false && !nb.pane)));
      };
      const xL = link(-1, 0) ? 0 : a; const xR = link(1, 0) ? 1 : c1;
      const zT = link(0, -1) ? 0 : a; const zB = link(0, 1) ? 1 : c1;
      quad(4, [xR - xL, 1, T], [xL, 0, a], [xL, 0, xR, 1]); // 北向大面(z=a)
      quad(5, [xR - xL, 1, T], [xL, 0, a], [xL, 0, xR, 1]); // 南向大面
      quad(0, [T, 1, zB - zT], [a, 0, zT], [zT, 0, zB, 1]); // 西向大面(x=a)
      quad(1, [T, 1, zB - zT], [a, 0, zT], [zT, 0, zB, 1]); // 东向大面
      return;
    }
    const T = 0.1875; // 门厚 3/16(MC 口径)
    if (b.solid === false) { // 开: 板贴西缘, 大面朝东西, 铰链在北端
      quad(1, [T, 1, 1], [0, 0, 0], [0, 0, 1, 1]); // 东向大面
      quad(0, [T, 1, 1], [0, 0, 0], [0, 0, 1, 1]); // 西向大面
      quad(3, [T, 1, 1], [0, 0, 0], [0, 0, T, 1]); // 顶边条
      quad(2, [T, 1, 1], [0, 0, 0], [0, 0, T, 1]); // 底边条
      quad(4, [T, 1, 1], [0, 0, 0], [0, 0, T, 1]); // 北端帽(铰链侧)
      quad(5, [T, 1, 1], [0, 0, 0], [0, 0, T, 1]); // 南端帽
      return;
    }
    // 闭: 板贴北缘, 大面朝南北, 横跨 x 全宽
    quad(5, [1, 1, T], [0, 0, 0], [0, 0, 1, 1]); // 南向大面(门正面)
    quad(4, [1, 1, T], [0, 0, 0], [0, 0, 1, 1]); // 北向大面
    quad(3, [1, 1, T], [0, 0, 0], [0, 0, 1, T]); // 顶边条
    quad(2, [1, 1, T], [0, 0, 0], [0, 0, 1, T]); // 底边条
    quad(1, [1, 1, T], [0, 0, 0], [0, 0, 1, T]); // 东端帽
    quad(0, [1, 1, T], [0, 0, 0], [0, 0, 1, T]); // 西端帽(铰链侧)
  }

  /* 图集条目 → 面朝向格号(number 简写=六面同格; 分面条目按朝向取) */
  function atlasTileOf(entry, dir) {
    if (typeof entry === 'number') return entry;
    return dir[1] === 1 ? entry.top : (dir[1] === -1 ? entry.bottom : entry.side);
  }

  /* ---------- 全细节: 区块 → 实心/玻璃/TNT/图集 四通道顶点裸数组 ----------
     与原 world.js buildChunkGeometries 的几何逐字节同构(仅把 getBlock
     换成 pack 内读取 — 含边界圈, 跨区块剔面数据随消息自带) */
  function meshChunk(pack, opts) {
    const hashRand = opts.hashRand; const tiles = opts.tntTiles;
    const atlas = opts.atlas || null; // 图集布局可选: 缺省全走纯色通道(存量行为)
    const S = mkCh(); const G = mkCh(); const T = mkTexCh(); const A = mkTexCh();
    const cells = pack.cells; const w = pack.w; const d = pack.d; const h = pack.h;
    const levels = pack.levels || null; // 水位通道(liquid D7): 缺省视为源(lv0)——存量调用方零侵入
    const border = pack.border; const bx = pack.bx; const bz = pack.bz; const yMax = pack.yMax;
    const lget = (lx, y, lz)=>{
      if (y<0 || y>=h || lx<0 || lz<0 || lx>=w || lz>=d) return 0;
      return cells[(y*d+lz)*w+lx];
    };
    const lgetLv = (lx, y, lz)=>{
      if (!levels || y<0 || y>=h || lx<0 || lz<0 || lx>=w || lz>=d) return 0;
      return levels[(y*d+lz)*w+lx];
    };
    /* 光照取样(设计稿 §4.1): pack 的 sky/block 圈与 cells 同形(D2 契约),
       越界口径与 lightSkyAt/lightBlockAt 一致(sky 15 · block 0);
       无光照载荷的旧 pack 回落全亮(sky 15 · block 0) */
    const skyArr = pack.sky || null;
    const blkArr = pack.block || null;
    const lsky = (lx, y, lz)=>{
      if (!skyArr || y<0 || y>=h || lx<0 || lz<0 || lx>=w || lz>=d) return 15;
      return skyArr[(y*d+lz)*w+lx];
    };
    const lblk = (lx, y, lz)=>{
      if (!blkArr || y<0 || y>=h || lx<0 || lz<0 || lx>=w || lz>=d) return 0;
      return blkArr[(y*d+lz)*w+lx];
    };
    for (let lx=border; lx<border+CHUNK; lx++) {
      for (let lz=border; lz<border+CHUNK; lz++) {
        const wx = bx+lx; const wz = bz+lz; // 世界坐标: tint 哈希与现状连续
        for (let y=0; y<=yMax; y++) {
          const id = lget(lx, y, lz);
          if (id===0) continue;
          const b = BLOCKS[id];
          if (b.fluid) { // 流体通道(设计稿 liquid D7): 顶面高度=水量/9(上方同流体=整格),
            // 水入玻璃通道(透渲), 岩浆入实心通道(不透明); 同流体邻接/不透明实心邻接剔面,
            // 玻璃相邻保留面(水族箱观感)。侧面按本格高度画满, 邻格 1/9 高差呈台阶(MC 同款近似);
            // 光照与标准面同口径——面邻格采样 sky/block(岩浆 light:15 自发光由此点亮夜面)
            const lv = lgetLv(lx, y, lz);
            const sameAbove = lget(lx, y+1, lz) === id;
            const hh = sameAbove ? 1 : (lv===8 ? 8 : 8-lv) / FLUID.renderDiv;
            const target = b.fluid === 'water' ? G : S;
            const fcol = faceColor(id, [0, 1, 0]);
            for (let f=0; f<6; f++) {
              const face = FACES[f];
              const nx = lx+face.dir[0]; const ny = y+face.dir[1]; const nz = lz+face.dir[2];
              const nid = lget(nx, ny, nz);
              if (nid === id) continue; // 同流体邻接: 剔面
              const nb = nid!==0 ? BLOCKS[nid] : null;
              if (nb && !nb.glass && !nb.thin && !nb.pane) continue; // 不透明实心遮挡
              const fSky = lsky(nx, ny, nz)/15; const fBlk = lblk(nx, ny, nz)/15;
              for (let c=0; c<4; c++) {
                const cor = face.corners[c];
                target.positions.push(wx+cor[0], y+cor[1]*hh, wz+cor[2]);
                target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                target.colors.push(fcol[0], fcol[1], fcol[2]);
                target.sky.push(fSky);
                target.block.push(fBlk);
              }
              target.indices.push(target.n, target.n+1, target.n+2, target.n+2, target.n+1, target.n+3);
              target.n += 4;
            }
            continue;
          }
          const ae = atlas ? atlas.tiles[id] : undefined;
          if (b.pane && ae) { // 竖直薄板(门/玻璃板): 图集通道 alphaTest 真透明(设计稿 §5)
            pushPane(A, wx, y, wz, lx, lz, b, ae, atlas, lget, lsky, lblk);
            continue;
          }
          if (ae) { // 图集方块: 第 4 通道(薄块走十字面片/火把走专用小盒, 立方体按面取格)
            if (b.thin) {
              if (b.wall) { // 火把(wall 全表唯一): 专用小盒 pushTorch(MC 同款)
                /* 贴墙取向: 底下无实心支承 → 按固定优先级(+x/-x/+z/-z, 与
                   cascade NEIGH_HOR 同序)取首个实心水平邻, 小盒底面贴该墙
                   +外倾旋转; 支承判据镜像 CascadeCore mkPolicy.isSupport
                   (单一权威在彼处, 此处只读同一 BLOCKS 派生)。
                   取向不存档——同世界状态必同取向(确定性重放红线) */
                const sup = (nid) => !!(nid !== 0 && BLOCKS[nid] && BLOCKS[nid].solid !== false);
                const onBase = sup(lget(lx, y - 1, lz));
                let lean = null;
                if (!onBase) {
                  if (sup(lget(lx + 1, y, lz))) lean = {ax: 0, d: 1};
                  else if (sup(lget(lx - 1, y, lz))) lean = {ax: 0, d: -1};
                  else if (sup(lget(lx, y, lz + 1))) lean = {ax: 1, d: 1};
                  else if (sup(lget(lx, y, lz - 1))) lean = {ax: 1, d: -1};
                }
                pushTorch(A, wx, y, wz, atlasTileOf(ae, [0, 0, 1]), atlas.cols, atlas.rows,
                    lsky(lx, y, lz)/15, lblk(lx, y, lz)/15, lean, onBase);
                continue;
              }
              pushCross(A, wx, y, wz, atlasTileOf(ae, [0, 0, 1]), atlas.cols, atlas.rows,
                  lsky(lx, y, lz)/15, lblk(lx, y, lz)/15);
              continue;
            }
            for (let f=0; f<6; f++) {
              const face = FACES[f];
              const nx = lx+face.dir[0]; const ny = y+face.dir[1]; const nz = lz+face.dir[2];
              const nid = lget(nx, ny, nz);
              const nb = nid!==0 ? BLOCKS[nid] : null;
              if (nb && !nb.glass && !nb.thin && !nb.pane) continue; // 剔面规则与实心通道一致
              const tile = atlasTileOf(ae, face.dir);
              const tc = tile % atlas.cols; const tr = Math.floor(tile / atlas.cols);
              const fSky = lsky(nx, ny, nz)/15; const fBlk = lblk(nx, ny, nz)/15;
              for (let c=0; c<4; c++) {
                const cor = face.corners[c];
                A.positions.push(wx+cor[0], y+cor[1], wz+cor[2]);
                A.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                const uv = faceUV(face.dir, cor);
                // 画布 y 向下、纹理 v 向上: 第 0 行格占 v 最高段(与 tileUV 同换算)
                A.uvs.push((tc+uv[0])/atlas.cols, (atlas.rows-1-tr+uv[1])/atlas.rows);
                A.sky.push(fSky);
                A.block.push(fBlk);
              }
              A.indices.push(A.n, A.n+1, A.n+2, A.n+2, A.n+1, A.n+3);
              A.n += 4;
            }
            continue;
          }
          if (b.thin) { // 引线 / 压力板 / 床(顶点光取自身格, §4.1)
            pushThin(S, wx, y, wz, id, b.thin, 0.92 + hashRand(wx*3+wz, y)*0.12,
                lsky(lx, y, lz)/15, lblk(lx, y, lz)/15);
            continue;
          }
          if (b.tnt) { // TNT: 走贴图通道
            for (let f=0; f<6; f++) {
              const face = FACES[f];
              const nx = lx+face.dir[0]; const ny = y+face.dir[1]; const nz = lz+face.dir[2];
              const nid = lget(nx, ny, nz);
              const nb = nid!==0 ? BLOCKS[nid] : null;
              if (nb && !nb.glass && !nb.thin && !nb.pane) continue;
              // 顶/底/侧 (0 号格是 mipmap 缓冲垫)
              const tileV = face.dir[1]===1 ? tiles-1 : (face.dir[1]===-1 ? tiles-2 : tiles-3);
              const fSky = lsky(nx, ny, nz)/15; const fBlk = lblk(nx, ny, nz)/15;
              for (let c=0; c<4; c++) {
                const cor = face.corners[c];
                T.positions.push(wx+cor[0], y+cor[1], wz+cor[2]);
                T.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                const uv = faceUV(face.dir, cor);
                T.uvs.push(uv[0], (tileV+uv[1])/tiles);
                T.sky.push(fSky);
                T.block.push(fBlk);
              }
              T.indices.push(T.n, T.n+1, T.n+2, T.n+2, T.n+1, T.n+3);
              T.n += 4;
            }
            continue;
          }
          const isGlass = !!b.glass;
          for (let f=0; f<6; f++) {
            const face = FACES[f];
            const nx = lx+face.dir[0]; const ny = y+face.dir[1]; const nz = lz+face.dir[2];
            const nid = lget(nx, ny, nz);
            const nb = nid!==0 ? BLOCKS[nid] : null;
            let target;
            if (isGlass) {
              if (nb && !nb.thin && !nb.pane) continue; // 玻璃只对着空气/薄块/薄板显示面
              target = G;
            } else {
              if (nb && !nb.glass && !nb.thin && !nb.pane) continue; // 实心面被实心邻居遮挡才剔除
              target = S;
            }
            const col = faceColor(id, face.dir);
            const tint = isGlass ? 1 : (0.92 + hashRand(wx*3+wz, y)*0.12);
            const fSky = lsky(nx, ny, nz)/15; const fBlk = lblk(nx, ny, nz)/15;
            for (let c=0; c<4; c++) {
              const cor = face.corners[c];
              target.positions.push(wx+cor[0], y+cor[1], wz+cor[2]);
              target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
              target.colors.push(col[0]*tint, col[1]*tint, col[2]*tint);
              target.sky.push(fSky);
              target.block.push(fBlk);
            }
            target.indices.push(target.n, target.n+1, target.n+2, target.n+2, target.n+1, target.n+3);
            target.n += 4;
          }
        }
      }
    }
    return {solid: S.n>0 ? S : null, glass: G.n>0 ? G : null, tnt: T.n>0 ? T : null, atlas: A.n>0 ? A : null};
  }

  /* ---------- LOD 降采样: 区块 → 顶面+侧裙粗网格 (Distant Horizons 思路) ----------
     每格 step×step 列合并: 格高 = 列表面最大高(薄块不算表面), 顶色取
     最高列的顶面方块。相邻格矮差处出裙边; 区块周界对 0 出裙边(藏在
     地形内部不可见, 格差处呈现为阶梯 — 体素风允许的误差)。 */
  function meshChunkLod(pack, opts) {
    const step = (CHUNK % opts.step === 0) ? opts.step : 2; // 非整除护栏: 静默丢边缘格不如回落
    const cells = pack.cells; const w = pack.w; const d = pack.d;
    const bx = pack.bx; const bz = pack.bz; const yMax = pack.yMax;
    /* 合并列顶面之上的天空光 → 二值 0/15(设计稿 §4.1): 直灌带恒 15, 阈值 8
       只是量化口径; 无光照载荷回落全亮。aBlock 恒 0 由 pushQuad 落实 */
    const skyArr = pack.sky || null;
    const lodSky = (lx, lz, top)=>{
      if (!skyArr) return 15;
      const sy = top + 1;
      if (sy >= pack.h) return 15; // 世界顶之上 = 敞开天光
      return skyArr[(sy*d + lz)*w + lx] >= 8 ? 15 : 0;
    };
    const n = Math.floor(CHUNK/step);
    const hs = new Int16Array(n*n); // 格高(-1=空格)
    const ids = new Uint8Array(n*n); // 格顶面方块 id
    for (let gx=0; gx<n; gx++) {
      for (let gz=0; gz<n; gz++) {
        let hTop = -1; let idTop = 0;
        for (let sx=0; sx<step; sx++) {
          for (let sz=0; sz<step; sz++) {
            const lx = gx*step+sx; const lz = gz*step+sz;
            for (let y=yMax; y>=0; y--) { // 自上而下找表面(跳过薄块)
              const id = cells[(y*d+lz)*w+lx];
              if (id!==0 && !BLOCKS[id].thin) {
                if (y > hTop) {
                  hTop = y; idTop = id;
                }
                break;
              }
            }
          }
        }
        hs[gx*n+gz] = hTop; ids[gx*n+gz] = idTop;
      }
    }
    const S = mkCh();
    for (let gx=0; gx<n; gx++) {
      for (let gz=0; gz<n; gz++) {
        const h = hs[gx*n+gz]; const id = ids[gx*n+gz];
        if (h < 0) continue;
        const X = bx+gx*step; const Z = bz+gz*step; const topY = h+1;
        const lvSky = lodSky(gx*step, gz*step, h)/15; // 合并列一格一值: 顶面与裙边共用
        pushQuad(S, 3, X, topY, Z, step, 0, step, faceColor(id, [0, 1, 0]), lvSky); // 顶面
        const side = faceColor(id, [1, 0, 0]);
        const nh = (nx, nz)=> (nx<0||nz<0||nx>=n||nz>=n) ? -1 : hs[nx*n+nz]; // 周界外按 -1 → 裙边到地
        const emit = (f, X0, Z0, sx, sz, hN)=>{ // 邻格顶 hN+1..topY
          if (h > hN) pushQuad(S, f, X0, hN+1, Z0, sx, topY-(hN+1), sz, side, lvSky);
        };
        emit(1, X+step, Z, 0, step, nh(gx+1, gz)); // +X
        emit(0, X, Z, 0, step, nh(gx-1, gz)); // -X
        emit(5, X, Z+step, step, 0, nh(gx, gz+1)); // +Z
        emit(4, X, Z, step, 0, nh(gx, gz-1)); // -Z
      }
    }
    return {solid: S.n>0 ? S : null};
  }

  return {meshChunk, meshChunkLod};
})();
