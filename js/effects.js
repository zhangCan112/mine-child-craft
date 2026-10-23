'use strict';
/* ============================================================
   通用特效 Fx (视觉) + 提示消息 toast — 引擎层
   ------------------------------------------------------------
   爆炸/冲击波/闪电/碎块/震屏/传送门光束的视觉唯一入口, 外部只经
   13 个入口触碰(一次性动效 8 个 + 常驻光束 portalBeam/removeBeam +
   clear/update/wobble), 另带主菜单提示消息 showToast。
   音效段(sfx/engineHum/unlockAudio)已整体迁往 js/audio.js(工单 A4),
   本文件不再触碰 WebAudio — 视觉与听觉从此各自单一职责。
   interface: Fx{boom,pop,debrisBurst,arc,bolt,kick,fallBlock,portalBeam,removeBeam,
      beam,clear,update,wobble} / showToast
   依赖(均经全局名, 调用期解析): THREE·scene(引擎共享) · sfx(js/audio.js, 加载序在其后亦可, 调用期解析)
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
     (到顶回卷, 漩涡感)。柱体用 boltBox 单位盒共享缩放, 零几何分配 */
  const beams = [];
  function portalBeam(x, y, z, o) {
    o = o || {};
    const col = o.color !== undefined ? o.color : 0xa855f7;
    const H = o.h || 3; const W = o.w || 2;
    const coreMat = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.45, depthWrite: false});
    const haloMat = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.15,
      depthWrite: false, side: THREE.DoubleSide});
    const moteMat = new THREE.MeshBasicMaterial({color: 0xd9b3ff, transparent: true, opacity: 0.8, depthWrite: false});
    const core = new THREE.Mesh(boltBox, coreMat); // 亮芯: 细高柱
    core.scale.set(0.34, H, 0.34); core.position.set(x, y + H/2, z);
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
      b.core.scale.x = b.core.scale.z = 0.28 + pulse*0.26;
      b.coreMat.opacity = 0.32 + pulse*0.34;
      b.halo.scale.x = b.halo.scale.z = 0.95 + pulse*0.45;
      b.haloMat.opacity = 0.10 + pulse*0.12;
      for (const p of b.motes) { // 盘旋上升, 到顶回卷(取模循环)
        p.ph += dt*p.sp;
        const yy = (p.k + b.t*p.up) % 1;
        p.m.position.set(b.x + Math.cos(p.ph)*p.r, b.y + yy*b.H, b.z + Math.sin(p.ph)*p.r);
        p.m.rotation.y += dt*2;
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

  /* 清空全部特效(模式切换用); 共享 geo/mat 不可 dispose, 专用色/闪电线/落雷组/光束组除外 */
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
  }

  /* 生命周期推进(主循环游玩门内, 每帧) */
  function update(dt) {
    stepBeams(dt); // 常驻光束先行(不依赖一次性条目)
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

  return {boom, pop, debrisBurst, arc, bolt, kick, fallBlock, portalBeam, removeBeam, beam, clear, update, wobble};
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
