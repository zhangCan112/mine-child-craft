'use strict';
/* ============================================================
   通用特效 Fx (视觉) + 提示消息 toast — 引擎层
   ------------------------------------------------------------
   爆炸/冲击波/闪电/碎块/震屏/传送门光束的视觉唯一入口, 外部只经
   15 个入口触碰(一次性动效 8 个 + 常驻光束 portalBeam/removeBeam +
   常驻篝火特效场 campfireField/removeField + clear/update/wobble),
   另带主菜单提示消息 showToast。
   音效段(sfx/engineHum/unlockAudio)已整体迁往 js/audio.js(工单 A4),
   本文件不再触碰 WebAudio — 视觉与听觉从此各自单一职责。
   interface: Fx{boom,pop,debrisBurst,arc,bolt,kick,fallBlock,portalBeam,removeBeam,
      beam,campfireField,removeField,clear,update,wobble} / showToast
   依赖(均经全局名, 调用期解析): THREE·scene(引擎共享) · sfx(js/audio.js, 加载序在其后亦可, 调用期解析)
     · atlasMat(js/world.js)+TextureAtlas(js/texture-atlas.js, 焰片 sheet 段专用, 惰性·调用期解析,
     加载序 texture-atlas→world→effects 已保证; 顶层零引用, Node 最小桩可单载)
   可测性声明: 顶层即建 THREE 几何(Node 需桩方可载), adapter 无直测, 经 boot 冒烟覆盖(conventions §1.9)
   ============================================================ */

/* ---------- 通用特效 Fx: 爆炸/冲击波/闪电/碎块/震屏/传送门光束的唯一入口 ----------
   条目形状/动画/衰减全部收在 implementation, 外部只经 13 个入口触碰
   (一次性动效 8 个 + 常驻光束 portalBeam/removeBeam + clear/update/wobble) */
const Fx = (function() {
  let shake = 0;
  const effects = []; // 冲击波球
  const debris = []; // 物理碎块
  const debrisGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const debrisMat = new THREE.MeshLambertMaterial({color: 0x4a4a48});

  /* 单个膨胀淡出球: 冲击波/升级环/狂暴环/小火花的通用形状
     o: {color, r0, r1, dur, opacity}
     几何共享单位球(膨胀靠 scale), 只逐实例建材质(透明度独立);
     高频爆炸路径零几何分配 → 几何不 dispose, 常驻复用 */
  const popGeo = new THREE.SphereGeometry(1, 12, 10);
  function pop(x, y, z, o) {
    o = o || {};
    const mesh = new THREE.Mesh(popGeo,
        new THREE.MeshBasicMaterial({color: o.color!==undefined ? o.color : 0xffd9a0,
          transparent: true, opacity: o.opacity!==undefined ? o.opacity : 0.9, depthWrite: false}));
    mesh.position.set(x, y, z); scene.add(mesh);
    effects.push({mesh, t: 0, dur: o.dur||0.4,
      r0: o.r0!==undefined ? o.r0 : 0.6, r1: o.r1!==undefined ? o.r1 : 5});
  }

  /* 物理碎块: ring=径向低速(震地掀尘), 默认均匀高抛(爆炸);
     color=本批专用色(每批一份共享材质, 存活归零才 dispose) */
  function debrisBurst(x, y, z, n, o) {
    o = o || {};
    const custom = o.color !== undefined;
    const mat = custom ? new THREE.MeshLambertMaterial({color: o.color}) : debrisMat;
    const ref = {n}; // 本批存活计数
    const done = custom ? ()=>{
      if (--ref.n <= 0) mat.dispose();
    } : null;
    for (let i=0; i<n; i++) {
      const d = new THREE.Mesh(debrisGeo, mat);
      d.position.set(x, y, z);
      scene.add(d);
      let vel;
      if (o.ring) {
        const a = Math.random()*Math.PI*2;
        vel = new THREE.Vector3(Math.cos(a)*(2+Math.random()*3), 2+Math.random()*4, Math.sin(a)*(2+Math.random()*3));
      } else {
        vel = new THREE.Vector3((Math.random()-0.5)*9, 3+Math.random()*6, (Math.random()-0.5)*9);
      }
      debris.push({mesh: d, life: o.life||0.9, vel, done});
    }
  }

  /* 闪电弧: 围绕一点的锯齿电弧(飞行弹体的电花) — 快闪即逝;
     每道线自带几何(ownGeo), 存活期满连几何一起释放(与共享球几何区分) */
  function arc(x, y, z, o) {
    o = o || {};
    const pts = [];
    let px = x; let py = y; let pz = z;
    for (let i=0; i<(o.pts||4); i++) {
      pts.push(new THREE.Vector3(px, py, pz));
      px += (Math.random()-0.5)*(o.spread||0.8);
      py += (Math.random()-0.5)*(o.spread||0.8);
      pz += (Math.random()-0.5)*(o.spread||0.8);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({color: o.color!==undefined ? o.color : 0x9fe8ff,
      transparent: true, opacity: 0.95});
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    effects.push({mesh: line, t: 0, dur: o.dur||0.09, r0: 1, r1: 1, ownGeo: true}); // r0=r1: 不缩放
  }

  /* 落雷: 主干+分叉两道锯齿闪电自天而降劈到命中点 + 地面电光环 + zap 音。
     闪电由沿折线摆放的细长盒段拼成 — 真实截面厚度(WebGL 会忽略线宽, 线永远
     1px), 每段两层: 亮芯(core) + 半透光晕(halo); 单位盒共享, 段只缩放旋转 */
  const boltBox = new THREE.BoxGeometry(1, 1, 1); // 单位盒共享
  const _bz = new THREE.Vector3(0, 0, 1); // 盒纵轴
  const _bd = new THREE.Vector3();
  function bolt(x, y, z, o) {
    o = o || {};
    const col = o.color!==undefined ? o.color : 0xbff4ff;
    const H = o.h || 9;
    const w = o.w || 0.1; // 亮芯截面粗细(格)
    const core = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 1});
    const halo = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.3});
    const group = new THREE.Group();
    const mkBolt = (ox)=>{ // 一道锯齿闪电(顶端起始带横向偏移)
      let px = x + ox; let pz = z + (Math.random()-0.5)*0.8; let py = y + H;
      for (let i=0; i<7; i++) {
        const nx = x + (Math.random()-0.5)*1.2;
        const nz = z + (Math.random()-0.5)*1.2;
        const ny = y + H - H*(i+1)/7;
        _bd.set(nx - px, ny - py, nz - pz);
        const len = _bd.length();
        if (len > 1e-4) {
          _bd.divideScalar(len);
          for (const cv of [[core, w], [halo, w*2.2]]) { // 亮芯 + 光晕两层
            const seg = new THREE.Mesh(boltBox, cv[0]);
            seg.scale.set(cv[1], cv[1], len);
            seg.position.set((px+nx)/2, (py+ny)/2, (pz+nz)/2);
            seg.quaternion.setFromUnitVectors(_bz, _bd);
            group.add(seg);
          }
        }
        px = nx; py = ny; pz = nz;
      }
    };
    mkBolt(0); mkBolt((Math.random()-0.5)*2); // 主干 + 分叉
    scene.add(group);
    effects.push({mesh: group, mats: [core, halo], t: 0, dur: 0.22, r0: 1, r1: 1,
      onEnd() {
        core.dispose(); halo.dispose();
      }}); // 几何共享常驻, 只释放两份材质
    pop(x, y, z, {color: col, r0: 0.4, r1: o.r1||3, dur: 0.35}); // 地面电光环
    sfx('zap');
  }

  /* 传送门紫色光束: 常驻动效(非爆炸类一次性) — 句柄制, removeBeam(h) 摘除,
     clear() 模式切换连带清场; 悬空句柄再 remove 无害(清场后找不到即跳过)。
     观感 = 两层竖直光柱(亮芯 + 光晕)缓慢脉动 + 一簇绕柱盘旋上升的微粒
     (到顶回卷, 漩涡感)。柱体用 boltBox 单位盒共享缩放, 零几何分配。
     2026-10-30 芯柱加宽提亮(用户复核: 既有束几乎看不出——「稍微再添加点
     光柱」口径, 全部回程门/巢门的光束一并更醒目) */
  const beams = [];
  function portalBeam(x, y, z, o) {
    o = o || {};
    const col = o.color !== undefined ? o.color : 0xa855f7;
    const H = o.h || 3; const W = o.w || 2;
    const coreMat = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.55, depthWrite: false});
    const haloMat = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.2,
      depthWrite: false, side: THREE.DoubleSide});
    const moteMat = new THREE.MeshBasicMaterial({color: 0xd9b3ff, transparent: true, opacity: 0.8, depthWrite: false});
    const core = new THREE.Mesh(boltBox, coreMat); // 亮芯: 细高柱
    core.scale.set(0.5, H, 0.5); core.position.set(x, y + H/2, z);
    const halo = new THREE.Mesh(boltBox, haloMat); // 光晕: 粗一圈的半透明柱
    halo.scale.set(1.05, H, 1.05); halo.position.copy(core.position);
    const group = new THREE.Group();
    group.add(core, halo);
    const motes = []; // 环绕微粒: 各自带相位/速率/半径(读时算位置, 免逐帧分配)
    const n = Math.round(Math.min(16, Math.max(8, W*3)));
    for (let i=0; i<n; i++) {
      const m = new THREE.Mesh(boltBox, moteMat);
      m.scale.setScalar(0.09 + Math.random()*0.12);
      motes.push({m, ph: Math.random()*Math.PI*2, sp: 0.7 + Math.random()*0.9,
        r: 0.3 + Math.random()*(0.6 + W*0.22), up: 0.35 + Math.random()*0.5, k: Math.random()});
      group.add(m);
    }
    scene.add(group);
    const h = {group, core, halo, coreMat, haloMat, mats: [coreMat, haloMat, moteMat],
      x, y, z, H, motes, t: Math.random()*10}; // t 随机起步: 多座门脉动不同相
    beams.push(h);
    return h;
  }
  function removeBeam(h) {
    const i = beams.indexOf(h);
    if (i < 0) return; // 已随 clear() 清场: 悬空句柄无害
    beams.splice(i, 1);
    scene.remove(h.group);
    for (const m of h.mats) m.dispose();
  }
  function stepBeams(dt) {
    for (const b of beams) {
      b.t += dt;
      const pulse = 0.5 + 0.5*Math.sin(b.t*1.7); // 0..1 缓慢脉动(周期 ~3.7s)
      b.core.scale.x = b.core.scale.z = 0.4 + pulse*0.3;
      b.coreMat.opacity = 0.45 + pulse*0.35;
      b.halo.scale.x = b.halo.scale.z = 1.1 + pulse*0.6;
      b.haloMat.opacity = 0.14 + pulse*0.16;
      for (const p of b.motes) { // 盘旋上升, 到顶回卷(取模循环)
        p.ph += dt*p.sp;
        const yy = (p.k + b.t*p.up) % 1;
        p.m.position.set(b.x + Math.cos(p.ph)*p.r, b.y + yy*b.H, b.z + Math.sin(p.ph)*p.r);
        p.m.rotation.y += dt*2;
      }
    }
  }

  /* 篝火特效场(T-C9): CampfireFxCore 管理器的场景适配 — 句柄制
     (portalBeam/removeBeam 同形态: campfireField(fx) 挂场, removeField(h)/
     clear() 摘, 悬空句柄无害)。管理器是纯逻辑(鸭型注入, 本段不识别篝火
     语义、零应用符号依赖), 逐帧读 fx.cells()/fx.particles()/fx.emitters()
     把状态摆进场景: 柔柱轮廓盒+火苗/烟/旋涡/过渡尾粒子池; 色彩/尺寸/
     透明度全取核心产物, 这里零观感参数副本(参数表单源在 fx-core)。 */
  const fields = [];
  function campfireField(fx) {
    const held = fields.find((f) => f.fx === fx);
    if (held) return held; /* 单例句柄(幂等): switchMode 序 Fx.clear 摘场后 init 重挂同一
       管理器是常态路径(T-C13-R5 A 区装配缺口修复), 同 fx 二次挂必须返回既有句柄 —
       否则一场双挂=粒子双绘+双 sheet(dc 翻倍); removeField 摘除后 find 不到,
       再挂是真新挂(句柄语义不变: 摘=整场摘) */
    const h = {fx, cells: new Map()};
    fields.push(h);
    return h;
  }
  function disposeFieldCell(st) {
    scene.remove(st.group);
    for (const m of st.mats) m.dispose();
  }
  function removeField(h) {
    const i = fields.indexOf(h);
    if (i < 0) return; // 已随 clear() 清场: 悬空句柄无害
    if (h.sheet) { // 焰片 sheet 产权随句柄: 只摘本场并 dispose(新增段)
      disposeSheet(h.sheet);
      h.sheet = null;
    }
    fields.splice(i, 1);
    for (const st of h.cells.values()) disposeFieldCell(st);
    h.cells.clear();
  }
  function mkFieldItem(geo, color, opacity) {
    const mat = new THREE.MeshBasicMaterial({color, transparent: true, opacity,
      depthWrite: false});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    return {mesh, mat};
  }
  function mkFieldCell(fx) {
    const P = fx.params;
    const group = new THREE.Group();
    const mats = [];
    const colMat = new THREE.MeshBasicMaterial({color: P.column.color, transparent: true,
      opacity: 0, depthWrite: false});
    const column = new THREE.Mesh(boltBox, colMat);
    group.add(column);
    mats.push(colMat);
    const st = {group, mats, column: {mesh: column, mat: colMat},
      flame: [], smoke: [], vortex: [], trans: []};
    for (let i = 0; i < 12; i++) {
      const it = mkFieldItem(boltBox, 0xffffff, 0.9);
      st.flame.push(it); group.add(it.mesh); mats.push(it.mat);
    }
    for (let i = 0; i < 12; i++) {
      const it = mkFieldItem(boltBox, P.smoke.color, P.smoke.opacity0);
      st.smoke.push(it); group.add(it.mesh); mats.push(it.mat);
    }
    for (let i = 0; i < P.vortex.count; i++) {
      const it = mkFieldItem(boltBox, P.vortex.color, P.vortex.opacity);
      st.vortex.push(it); group.add(it.mesh); mats.push(it.mat);
    }
    for (let i = 0; i < 10; i++) {
      const it = mkFieldItem(popGeo, 0xffffff, 0.6);
      st.trans.push(it); group.add(it.mesh); mats.push(it.mat);
    }
    scene.add(group);
    return st;
  }
  function syncFieldPool(pool, ps) {
    for (let i = 0; i < pool.length; i++) {
      const it = pool[i];
      const p = ps[i];
      if (!p) {
        it.mesh.visible = false;
        continue;
      }
      it.mesh.visible = true;
      it.mesh.position.set(p.x, p.y, p.z);
      it.mesh.scale.setScalar(Math.max(0.02, p.size));
      it.mat.opacity = p.opacity;
      if (p.color) it.mat.color.set(p.color);
    }
  }
  function syncFieldTrans(pool, trs) {
    for (let i = 0; i < pool.length; i++) {
      const it = pool[i];
      const tr = trs[i];
      if (!tr) {
        it.mesh.visible = false;
        continue;
      }
      it.mesh.visible = true;
      it.mat.color.set(tr.color);
      if (tr.kind === 'pop') {
        const u = Math.min(1, tr.t / tr.dur);
        it.mesh.position.set(tr.x, tr.y, tr.z);
        it.mesh.scale.setScalar(Math.max(0.02, tr.r0 + (tr.r1 - tr.r0) * u));
        it.mat.opacity = tr.opacity * (1 - u);
      } else { // steam / tailSmoke: 小粒上升散尽
        it.mesh.position.set(tr.x, tr.y, tr.z);
        it.mesh.scale.setScalar(Math.max(0.02, tr.size));
        it.mat.opacity = 0.6 * Math.max(0, 1 - (tr.age || 0) / (tr.life || 1));
      }
    }
  }
  /* ---------- 焰片 sheet(T-C13-R4, 方案 §2.1/§3-d/§3-i/§4): campfireField 场内
     全场景恰一张共享 mesh — 静态部件驻 chunk 批(ADR-0020), 焰片单独成 sheet:
     惰性建(场内首格在册才建, 零在册格零 mesh; 在册格必曾 open(见下方门注释), 容量按需翻倍(mobs growMobBatch
     惯例); membership=fx.cells() 过滤 open===true(浇熄/燃尽余韵/挖后格在册但
     零 plane——h 类禁令); 帧号单源 fx.flameFrameAt(tile=74+帧号, UI 定稿 §4.1
     接线表 T_FLAME_F1~F3), tint 单源 fx.emitters().flame.tint, 零相位副本零墙钟;
     UV/顶点色脏检: 该火帧号或渐弱档变化才重写该火 8 顶点, 稳态摊 O(1)/帧;
     材质 MeshBasic{map:atlasMat.map, alphaTest 0.5, DoubleSide, vertexColors}
     不透明队列(transparent 缺省假, 与烟 alpha blend 分队列免排序); 顶点直写
     世界系(mesh 无旋转缩放); 产权=field 句柄: removeField/clear 摘除并 dispose。 */
  const SHEET_TILE0 = 74; /* 焰帧 tile 接线基号(v1.10 §4.1: 74+帧号 0/1/2) */
  function buildSheet(f) {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial({map: atlasMat.map, alphaTest: 0.5,
      side: THREE.DoubleSide, vertexColors: true});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; // 单 mesh 恒绘: 三角≈8/火可忽略, 免包围球维护
    scene.add(mesh);
    f.sheet = {mesh, geo, mat, fires: new Map(), n: 0, cap: 0,
      pos: null, uv: null, col: null, idx: null,
      posAttr: null, uvAttr: null, colAttr: null,
      dirty: true}; // 首拍必 rebuild: 零火 sheet 也有空属性面(count=0 可读)
    growSheetBuf(f.sheet, 1); // 预分配最小缓冲(rebuild 的 subarray 源就绪)
    mkSheetAttrs(f.sheet); // 恒定属性对象就位(R5-c4: 满容量一次建, 绘段由 drawRange)
  }
  function disposeSheet(s) { // sheet 专用几何/材质可释放; map 属共享图集零触碰
    scene.remove(s.mesh);
    s.geo.dispose();
    s.mat.dispose();
  }
  function rebuildSheetAttrs(s) { // 成员集变后重定绘段+标脏上传(恒定属性, 稳态零 GL 替换 — R5-c4)
    s.geo.setDrawRange(0, s.n * 12);
    s.posAttr.needsUpdate = true;
    s.uvAttr.needsUpdate = true;
    s.colAttr.needsUpdate = true;
  }
  function fillSheetIndex(s) { // 每火 12 索引=2 片×2 三角(形状恒定, 扩容时全量预写)
    for (let i = 0; i < s.cap; i++) {
      const b = i * 8; const o = i * 12;
      s.idx[o] = b; s.idx[o + 1] = b + 1; s.idx[o + 2] = b + 2;
      s.idx[o + 3] = b; s.idx[o + 4] = b + 2; s.idx[o + 5] = b + 3;
      s.idx[o + 6] = b + 4; s.idx[o + 7] = b + 5; s.idx[o + 8] = b + 6;
      s.idx[o + 9] = b + 4; s.idx[o + 10] = b + 6; s.idx[o + 11] = b + 7;
    }
  }
  function growSheetBuf(s, need) { // 容量按需翻倍(mobs growMobBatch 惯例)
    let cap = Math.max(1, s.cap);
    while (cap < need) cap *= 2;
    const pos = new Float32Array(cap * 24);
    const uv = new Float32Array(cap * 16);
    const col = new Float32Array(cap * 24);
    if (s.pos) { // 搬旧有效段(base 前缀紧凑, 扩容不丢早挂火)
      pos.set(s.pos.subarray(0, s.n * 24));
      uv.set(s.uv.subarray(0, s.n * 16));
      col.set(s.col.subarray(0, s.n * 24));
    }
    s.pos = pos; s.uv = uv; s.col = col;
    s.idx = new Uint32Array(cap * 12);
    s.cap = cap;
    fillSheetIndex(s);
  }
  /* 恒定属性对象(R5-c4): 满容量一次建、只随缓冲扩容重建 — 绘制段数由
     drawRange 控制(r128 渲染 indexed geometry 取 index.count 与 drawRange
     的较小者画前段, 活段之后的数据是 swap-remove 留下的 stale 块, 不画)。
     背景(评审 c4 查证): r128 全文件唯一 gl.deleteBuffer 在内部
     WebGLAttributes.remove, 它只由「被渲染过 geometry 的 dispose 事件」
     触发且只遍历当前 attributes——setAttribute 换新 attr 后旧 GL 缓冲
     无任何产品可及的释放口(经 GC finalizer 兜底, 时机不定)。此前
     rebuildSheetAttrs 每次成员变化 new BufferAttribute 替换=稳态滞留;
     恒定复用从结构上消除该路径。 */
  function mkSheetAttrs(s) {
    const posAttr = new THREE.BufferAttribute(s.pos, 3);
    const uvAttr = new THREE.BufferAttribute(s.uv, 2);
    const colAttr = new THREE.BufferAttribute(s.col, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    uvAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    s.geo.setAttribute('position', posAttr);
    s.geo.setAttribute('uv', uvAttr);
    s.geo.setAttribute('color', colAttr);
    s.geo.setIndex(new THREE.BufferAttribute(s.idx, 1));
    s.geo.setDrawRange(0, s.n * 12);
    s.posAttr = posAttr;
    s.uvAttr = uvAttr;
    s.colAttr = colAttr;
  }
  function writeSheetFirePos(s, slot, c) { // 形状恒定: 挂片写一次(建议值 §4, ⊆自有格)
    const p = s.pos; const b = slot.base * 3;
    const x0 = c.x + 0.325; const x1 = c.x + 0.675; // 片 A 沿 X 展开 0.35
    const z0 = c.z + 0.325; const z1 = c.z + 0.675; // 片 B 沿 Z 展开 0.35
    const y0 = c.y + 0.26; const y1 = c.y + 0.71; // 高 0.45, 顶 0.71 不出格
    const xa = c.x + 0.5; const za = c.z + 0.5; // 两片轴在格内中缝(真交叉非并排)
    p[b] = x0; p[b + 1] = y0; p[b + 2] = za;
    p[b + 3] = x1; p[b + 4] = y0; p[b + 5] = za;
    p[b + 6] = x1; p[b + 7] = y1; p[b + 8] = za;
    p[b + 9] = x0; p[b + 10] = y1; p[b + 11] = za;
    p[b + 12] = xa; p[b + 13] = y0; p[b + 14] = z0;
    p[b + 15] = xa; p[b + 16] = y0; p[b + 17] = z1;
    p[b + 18] = xa; p[b + 19] = y1; p[b + 20] = z1;
    p[b + 21] = xa; p[b + 22] = y1; p[b + 23] = z0;
  }
  function writeSheetFireUv(s, slot, frame) { // 该火 8 顶点全幅帧窗(tile=74+帧号)
    const q = TextureAtlas.tileUV(SHEET_TILE0 + frame);
    const a = s.uv; const b = slot.base * 2;
    const u0 = q[0]; const v0 = q[1]; const u1 = q[2]; const v1 = q[3];
    a[b] = u0; a[b + 1] = v0; a[b + 2] = u1; a[b + 3] = v0;
    a[b + 4] = u1; a[b + 5] = v1; a[b + 6] = u0; a[b + 7] = v1;
    a[b + 8] = u0; a[b + 9] = v0; a[b + 10] = u1; a[b + 11] = v0;
    a[b + 12] = u1; a[b + 13] = v1; a[b + 14] = u0; a[b + 15] = v1;
    s.uvAttr.needsUpdate = true;
  }
  function writeSheetFireColor(s, slot, tint) { // 渐弱=顶点色亮度插值(§5.8 扩含面片)
    const k = 1 - Math.max(0, Math.min(1, tint)); // tint=0 恒白(1,1,1), tint↑亮度单调降
    const a = s.col; const b = slot.base * 3;
    for (let i = 0; i < 8; i++) {
      a[b + i * 3] = k; a[b + i * 3 + 1] = k; a[b + i * 3 + 2] = k;
    }
    s.colAttr.needsUpdate = true;
  }
  function attachFire(s, k, c) { // 挂火: 分槽+写形状; frame/tint 初值 -1=首帧必写
    if (s.n === s.cap) {
      growSheetBuf(s, s.n + 1);
      mkSheetAttrs(s); // 扩容换缓冲: 恒定属性随缓冲重建(log2 次数级, 非稳态路径)
    }
    const slot = {base: s.n * 8, frame: -1, tint: -1};
    s.fires.set(k, slot);
    writeSheetFirePos(s, slot, c);
    s.n++;
    s.dirty = true;
  }
  function detachFire(s, k) { // 摘火: 末火顶点段搬入空槽(swap-remove, 紧凑布局)
    const slot = s.fires.get(k);
    const lastBase = (s.n - 1) * 8;
    if (slot.base !== lastBase) {
      s.pos.copyWithin(slot.base * 3, lastBase * 3, lastBase * 3 + 24);
      s.uv.copyWithin(slot.base * 2, lastBase * 2, lastBase * 2 + 16);
      s.col.copyWithin(slot.base * 3, lastBase * 3, lastBase * 3 + 24);
      for (const other of s.fires.values()) {
        if (other.base === lastBase) {
          other.base = slot.base;
          break;
        }
      }
    }
    s.fires.delete(k);
    s.n--;
    s.dirty = true;
  }
  function syncSheetMembership(f, cellsAll) { // 惰性建+成员增摘(open 格集同拍)
    if (!f.sheet) {
      if (cellsAll.length === 0) return; // 惰性: 场内首格在册才建(零在册格零 sheet — 在册格必曾 open: quench/dig 悬空无害, R5-c2 口径)
      buildSheet(f);
    }
    const s = f.sheet;
    const want = new Set();
    for (const c of cellsAll) {
      if (c.open === true) want.add(c.x + ',' + c.y + ',' + c.z);
    }
    for (const [k, slot] of s.fires) { // 摘: 浇熄/燃尽/挖后格退出 sheet
      if (!want.has(k)) detachFire(s, k);
    }
    for (const c of cellsAll) { // 挂: 新 open 格入册(扩容不另立 mesh)
      const k = c.x + ',' + c.y + ',' + c.z;
      if (c.open === true && !s.fires.has(k)) attachFire(s, k, c);
    }
    if (s.dirty) {
      rebuildSheetAttrs(s);
      s.dirty = false;
    }
  }

  function stepFields() {
    /* 正序遍历(fields 遍历序无生产语义: 场间独立, opaque 队列序与 children 序
       无关): 先挂场先入 scene.children —— 原倒序是迎合 T-C13-R4 红装具 R4-8
       find 探针谓词内抛错的权宜(评审收敛窗 c3 撤销, 探针改非抛错格匹配),
       粒子同步路径零触碰 */
    for (const f of fields) {
      const fx = f.fx;
      const live = new Set();
      const t = fx.now();
      syncSheetMembership(f, fx.cells()); // 焰片 sheet: 惰性建+成员增摘(open 格集同拍)
      for (const c of fx.cells()) {
        const k = c.x + ',' + c.y + ',' + c.z;
        live.add(k);
        let st = f.cells.get(k);
        if (!st) {
          st = mkFieldCell(fx);
          f.cells.set(k, st);
        }
        const em = fx.emitters(c.x, c.y, c.z);
        if (em && em.column.opacityScale > 0) { // 柔柱轮廓恒满高(遮挡穿模=已知边界)
          const P = fx.params.column;
          st.column.mesh.visible = true;
          st.column.mesh.scale.set(P.diameter, P.h, P.diameter);
          st.column.mesh.position.set(c.x, c.y + P.h / 2, c.z);
          st.column.mat.opacity = em.column.opacityScale * fx.columnOpacityAt(t);
        } else {
          st.column.mesh.visible = false;
        }
        /* 焰片 sheet 脏检(T-C13-R4 新增段): 帧号/tint 全走 fx 单源查询,
           变化才重写该火 8 顶点 uv/color(不整帧重写, 稳态摊 O(1)/帧) */
        const sh = f.sheet;
        if (sh && c.open) {
          const slot = sh.fires.get(k);
          if (slot) {
            const frame = fx.flameFrameAt(c.x, c.y, c.z);
            if (frame !== slot.frame) {
              writeSheetFireUv(sh, slot, frame);
              slot.frame = frame;
            }
            const tint = (em && em.flame) ? em.flame.tint : 0;
            if (tint !== slot.tint) {
              writeSheetFireColor(sh, slot, tint);
              slot.tint = tint;
            }
          }
        }
        const ps = fx.particles(c.x, c.y, c.z);
        syncFieldPool(st.flame, ps.flame);
        syncFieldPool(st.smoke, ps.smoke);
        syncFieldPool(st.vortex, ps.vortex);
        syncFieldTrans(st.trans, ps.transients);
      }
      for (const [k, st] of f.cells) {
        if (!live.has(k)) {
          disposeFieldCell(st);
          f.cells.delete(k);
        }
      }
    }
  }

  /* 爆炸视觉(不伤人): 音效 + 震屏 + 冲击波 + 碎块; o.color 可整场换配色(坦克型号爆风) */
  function boom(x, y, z, o) {
    o = o || {};
    sfx('boom'); kick(o.kick!==undefined ? o.kick : 0.6);
    pop(x, y, z, {r0: 0.6, r1: o.r1||5, dur: 0.4, color: o.color});
    debrisBurst(x, y, z, o.n||10, {life: 0.9, color: o.color});
  }

  function kick(a) {
    shake = Math.max(shake, a);
  }

  /* 条目收尾: 自带 onEnd(落雷组等)优先, 否则释放私有材质/ownGeo 几何 —
     clear 与 update 超时共用一条释放规则 */
  function disposeFxEntry(e) {
    scene.remove(e.mesh);
    if (e.onEnd) e.onEnd();
    else {
      e.mesh.material.dispose(); if (e.ownGeo) e.mesh.geometry.dispose();
    }
  }

  /* 直线光束(守卫一家·蓄力激光): 单位圆柱拉长 A→B, 只淡出不膨胀 —
     共享几何常驻(高频路径零几何分配), 逐实例材质(透明度独立) */
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  const UP = new THREE.Vector3(0, 1, 0);
  function beam(x1, y1, z1, x2, y2, z2, o) {
    o = o || {};
    const a = new THREE.Vector3(x1, y1, z1); const b = new THREE.Vector3(x2, y2, z2);
    const dir = b.clone().sub(a);
    const len = dir.length() || 0.01;
    const mesh = new THREE.Mesh(beamGeo,
        new THREE.MeshBasicMaterial({color: o.color!==undefined?o.color:0xffa040,
          transparent: true, opacity: 0.95, depthWrite: false}));
    const r = o.r!==undefined ? o.r : 0.12;
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.scale.set(r, len, r);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    scene.add(mesh);
    effects.push({mesh, t: 0, dur: o.dur||0.25, r0: 0, r1: 0, noScale: true});
  }

  /* 落块(方块级联移动观感: 落沙/倒树原木 tumble): 0.94³ 色块自 y0 坠至 y1,
     位移 ∝ t²(重力加速), 着地前淡出; o={color, delay, dur}。
     纯 overlay——体素数据已即时结算(设计稿 D7/P12), 动画不承载语义 */
  const fallers = [];
  const fallGeo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
  function fallBlock(x, y0, y1, z, o) {
    o = o || {};
    const dy = Math.max(0.01, y0 - y1);
    const dur = o.dur !== undefined ? o.dur : Math.min(0.55, Math.max(0.16, Math.sqrt(dy / 9)));
    const mat = new THREE.MeshLambertMaterial({color: o.color !== undefined ? o.color : 0xd9cf9a,
      transparent: true});
    const m = new THREE.Mesh(fallGeo, mat);
    m.position.set(x, y0, z);
    m.visible = false; /* delay 未到不露面 */
    scene.add(m);
    fallers.push({m, mat, y0, y1, t: -(o.delay || 0), dur});
  }
  function stepFallers(dt) {
    for (let i = fallers.length - 1; i >= 0; i--) {
      const f = fallers[i];
      f.t += dt;
      if (f.t < 0) continue; /* 延迟阶梯(倒树 60ms/节) */
      f.m.visible = true;
      const p = f.t / f.dur;
      if (p >= 1) {
        scene.remove(f.m); f.mat.dispose();
        fallers.splice(i, 1);
        continue;
      }
      f.m.position.y = f.y0 + (f.y1 - f.y0) * p * p; /* 重力加速 */
      f.mat.opacity = p > 0.8 ? 0.9 * (1 - p) / 0.2 : 0.9; /* 着地前淡出 */
    }
  }

  /* 清空全部特效(模式切换用); 共享 geo/mat 不可 dispose, 专用色/闪电线/落雷组/光束组/篝火场除外 */
  function clear() {
    for (const e of effects) disposeFxEntry(e);
    effects.length = 0;
    for (const d of debris) {
      scene.remove(d.mesh); if (d.done) d.done();
    }
    debris.length = 0;
    for (const b of beams) {
      scene.remove(b.group); for (const m of b.mats) m.dispose();
    }
    beams.length = 0;
    for (const f of fallers) {
      scene.remove(f.m); f.mat.dispose();
    }
    fallers.length = 0;
    for (const f of fields) {
      if (f.sheet) { // 焰片 sheet 连带清场 dispose(新增段)
        disposeSheet(f.sheet);
        f.sheet = null;
      }
      for (const st of f.cells.values()) disposeFieldCell(st);
      f.cells.clear();
    }
    fields.length = 0;
  }

  /* 生命周期推进(主循环游玩门内, 每帧) */
  function update(dt) {
    stepBeams(dt); // 常驻光束先行(不依赖一次性条目)
    stepFields(); // 篝火特效场同步(读纯核心产物摆位, 零状态自持)
    stepFallers(dt); // 落块(级联移动观感)
    for (let i=effects.length-1; i>=0; i--) {
      const e = effects[i];
      e.t += dt;
      const p = e.t/e.dur;
      if (p >= 1) {
        disposeFxEntry(e);
        effects.splice(i, 1); continue;
      }
      if (!e.noScale) { // 光束类只淡出不膨胀(长度定死在创建时)
        const r = e.r0 + (e.r1-e.r0)*p;
        e.mesh.scale.set(r, r, r);
      }
      if (e.mats) { // 组条目逐材质淡出
        for (const m of e.mats) m.opacity = 0.85*(1-p);
      } else e.mesh.material.opacity = 0.85*(1-p);
    }
    for (let i=debris.length-1; i>=0; i--) {
      const d = debris[i];
      d.life -= dt;
      d.vel.y -= 20*dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += dt*7;
      d.mesh.rotation.z += dt*5;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        if (d.done) d.done();
        debris.splice(i, 1);
      }
    }
  }

  /* 震屏消费: 衰减 + 相机抖动(主循环每帧, 相机位姿设定之后调用) */
  function wobble(dt, camera) {
    if (shake > 0) {
      shake -= dt;
      const s = Math.max(0, shake)*0.4;
      camera.position.x += (Math.random()-0.5)*s;
      camera.position.y += (Math.random()-0.5)*s;
    }
  }

  return {boom, pop, debrisBurst, arc, bolt, kick, fallBlock, portalBeam, removeBeam,
    beam, campfireField, removeField, clear, update, wobble};
})();

/* ---------- 提示消息 ---------- */
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function showToast(msg, ms) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toastEl.style.opacity = 0, ms||2500);
}
