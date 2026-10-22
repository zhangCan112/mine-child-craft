"use strict";
/* ============================================================
   音效 (WebAudio 合成) + 通用特效 + 提示消息
============================================================ */
let actx = null;            // 懒创建; iOS 须在用户手势内创建+resume 才能真正出声(见 unlockAudio)
let master = null;          // 总线: 全部音效 → master → 压限器 → 扬声器, 多路叠加不再硬削波(pad 杂音根因)
const sfxLastT = {};
/* pad 小喇叭发不动低频: 触屏检测口径统一在 config.js 的 IS_TOUCH */

/* 手势解锁(常驻监听): 非手势创建/恢复的 context 在 iOS 上保持 suspended,
   挂起期间按冻结的 currentTime 排队的事件会在恢复瞬间同时炸响(爆音),
   故创建+resume+播静音采样都收在 pointerdown/touchstart/keydown 手势栈内;
   常驻而非 once: 切后台回来 context 会再次挂起, 每次手势都要续 */
function unlockAudio(){
  try{
    if(!actx){
      actx = new (window.AudioContext||window.webkitAudioContext)();
      const comp = actx.createDynamicsCompressor();   // 保险丝: 混战叠加超出 0dB 也压不出破音
      comp.threshold.value = -12; comp.knee.value = 20; comp.ratio.value = 12;
      comp.attack.value = 0.003; comp.release.value = 0.25;
      master = actx.createGain(); master.gain.value = 0.9;
      master.connect(comp); comp.connect(actx.destination);
    }
    if(actx.state === 'suspended'){
      actx.resume();
      const s = actx.createBufferSource();            // 1 采样静音: 逼 iOS 立即开动渲染管线
      s.buffer = actx.createBuffer(1, 1, actx.sampleRate);
      s.connect(master); s.start(0);
    }
  }catch(e){}
}
if(typeof document !== 'undefined' && document.addEventListener){
  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
}

/* 带线性衰减的白噪声 buffer 按时长缓存: 以前每次爆炸现生成 2 万+ 随机数,
   大规模混战高频分配 → GC 尖刺 → 音频毛刺; 现只生成一次常驻复用 */
const noiseBufs = {};
function noiseBuf(dur){
  if(!noiseBufs[dur]){
    const buf = actx.createBuffer(1, Math.floor(actx.sampleRate*dur), actx.sampleRate);
    const ch = buf.getChannelData(0);
    for(let i=0;i<ch.length;i++) ch[i] = (Math.random()*2-1)*(1-i/ch.length);
    noiseBufs[dur] = buf;
  }
  return noiseBufs[dur];
}

/* ---------- 音效定义表(SFX_DEFS): 加音效 = 加一行数据 ----------
   振荡器型: {type, f0, f1?, fT(频率滑落时长, 缺省=dur), dur, g, steps?([f@t...]), stepT?, linear?}
   噪声型:   {noise:{type(滤波), freq, dur}, g}
   win 为双振荡器琶音特例(解释器内联)。调音量/时长只改这张表 */
const SFX_DEFS = {
  boom:    { noise:{type:'lowpass',  freq:420,  dur:0.5}, g:0.2 },   // g 0.4→0.2: 与其他音效重新配平, 给压限器留余量
  fss:     { noise:{type:'highpass', freq:3000, dur:0.3}, g:0.12 },  // 引线嘶嘶声
  hit:     { type:'square',   f0:170,  f1:80,   fT:0.08, dur:0.09, g:0.08 },
  shoot:   { type:'square',   f0:820,  f1:300,  fT:0.07, dur:0.08, g:0.04 },
  zap:     { type:'sawtooth', f0:1900, f1:180,  fT:0.13, dur:0.15, g:0.09 },   // 闪电劈落(高频锯齿急坠)
  death:   { type:'sawtooth', f0:150,  f1:48,   fT:0.28, dur:0.30, g:0.10 },
  breath:  { type:'sawtooth', f0:300,  f1:90,   fT:0.35, dur:0.40, g:0.07 },
  pick:    { type:'sine',     steps:[880, 1318], dur:0.22, g:0.12 },           // 拾取叮咚(两音)
  click:   { type:'square',   f0:1200, dur:0.05, g:0.07 },                     // 转辙器咔哒
  door:    { type:'sawtooth', f0:90,   f1:220,  fT:0.30, dur:0.35, g:0.09, linear:true },  // 铁门滑开(上线性滑升)
  splash:  { type:'sine',     f0:500,  f1:120,  fT:0.15, dur:0.18, g:0.10 },   // 火花入水
  roar:    { type:'sawtooth', f0:110,  f1:45,   fT:0.35, dur:0.40, g:0.14 },   // 僵尸狂暴怒吼
  level:   { type:'sine',     steps:[660, 880, 1320], stepT:0.08, dur:0.42, g:0.12 },      // 晋升琶音
  win:     { special:'win' },                                                   // 胜利和弦(双振荡器)
};

function sfx(kind){
  try{
    const nowMs = performance.now();                  // 大规模混战时限制同类音效频率
    if(kind!=='win' && nowMs - (sfxLastT[kind]||0) < 60) return;
    sfxLastT[kind] = nowMs;
    unlockAudio();
    if(!actx || actx.state !== 'running') return;     // 挂起中不排队: 免得恢复瞬间扎堆炸响
    const t = actx.currentTime;
    const g = actx.createGain(); g.connect(master);
    const d = SFX_DEFS[kind];
    if(!d) return;

    if(d.noise){                                      // 噪声型: 滤波白噪(衰减 buffer 按时长缓存)
      const src = actx.createBufferSource(); src.buffer = noiseBuf(d.noise.dur);
      const f = actx.createBiquadFilter(); f.type = d.noise.type; f.frequency.value = d.noise.freq;
      src.connect(f); f.connect(g);
      g.gain.setValueAtTime(d.g, t);
      src.start(t);
      return;
    }
    if(d.special === 'win'){                          // 胜利和弦: 双正弦琶音 523→659→784
      const o1 = actx.createOscillator(); o1.connect(g);
      const o2 = actx.createOscillator(); o2.connect(g);
      o1.type = o2.type = 'sine';
      o1.frequency.setValueAtTime(523, t);  o1.frequency.setValueAtTime(659, t+0.16);
      o2.frequency.setValueAtTime(784, t+0.32);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.85);
      o1.start(t); o1.stop(t+0.85); o2.start(t+0.32); o2.stop(t+0.85);
      return;
    }
    const o = actx.createOscillator(); o.connect(g);  // 振荡器型
    o.type = d.type;
    if(d.steps){                                      // 多音定格(叮咚/琶音)
      for(let i=0; i<d.steps.length; i++)
        o.frequency.setValueAtTime(d.steps[i], t + (d.stepT||0)*i);
    } else if(d.f0 !== undefined){
      o.frequency.setValueAtTime(d.f0, t);
      if(d.f1 !== undefined){
        const fT = d.fT !== undefined ? d.fT : d.dur;
        if(d.linear) o.frequency.linearRampToValueAtTime(d.f1, t+fT);
        else         o.frequency.exponentialRampToValueAtTime(d.f1, t+fT);
      }
    }
    g.gain.setValueAtTime(d.g, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+d.dur);
    o.start(t); o.stop(t+d.dur);
  }catch(e){}
}

/* ---------- 坦克引擎嗡鸣: 连续音, level 0..1(怠速微响 → 油门渐强渐升) ----------
   level 量化后比较, 同值免重设; 停驶/下车/切模式须传 0 归零 */
let humOsc = null, humGain = null, humLvl = -1;
function engineHum(level){
  try{
    unlockAudio();
    if(!actx || actx.state !== 'running') return;    // 挂起中不动 humLvl: 恢复后同油门也能续上嗡鸣
    const q = Math.round(level*8)/8;
    if(q === humLvl) return;
    humLvl = q;
    if(!humOsc){
      humOsc = actx.createOscillator(); humOsc.type = 'sawtooth';
      const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      humGain = actx.createGain(); humGain.gain.value = 0;
      humOsc.connect(f); f.connect(humGain); humGain.connect(master);
      humOsc.start();
    }
    const t = actx.currentTime;
    /* pad 小喇叭还原 50~100Hz 低频只会嗡嗡失真: 触屏设备引擎嗡鸣增益减半 */
    const g0 = IS_TOUCH ? 0.022 : 0.045, gk = IS_TOUCH ? 0.045 : 0.085;
    humGain.gain.setTargetAtTime(g0 + q*gk, t, 0.12);
    humOsc.frequency.setTargetAtTime(52 + q*46, t, 0.18);
  }catch(e){}
}

/* ---------- 通用特效 Fx: 爆炸/冲击波/闪电/碎块/震屏的唯一入口 ----------
   条目形状/动画/衰减全部收在 implementation, 外部只经 9 个入口触碰 */
const Fx = (function(){
  let shake = 0;
  const effects = [];   // 冲击波球
  const debris = [];    // 物理碎块
  const debrisGeo = new THREE.BoxGeometry(0.16,0.16,0.16);
  const debrisMat = new THREE.MeshLambertMaterial({color:0x4a4a48});

  /* 单个膨胀淡出球: 冲击波/升级环/狂暴环/小火花的通用形状
     o: {color, r0, r1, dur, opacity}
     几何共享单位球(膨胀靠 scale), 只逐实例建材质(透明度独立);
     高频爆炸路径零几何分配 → 几何不 dispose, 常驻复用 */
  const popGeo = new THREE.SphereGeometry(1,12,10);
  function pop(x,y,z,o){
    o = o || {};
    const mesh = new THREE.Mesh(popGeo,
      new THREE.MeshBasicMaterial({color: o.color!==undefined ? o.color : 0xffd9a0,
        transparent:true, opacity: o.opacity!==undefined ? o.opacity : 0.9, depthWrite:false}));
    mesh.position.set(x,y,z); scene.add(mesh);
    effects.push({mesh, t:0, dur: o.dur||0.4,
      r0: o.r0!==undefined ? o.r0 : 0.6, r1: o.r1!==undefined ? o.r1 : 5});
  }

  /* 物理碎块: ring=径向低速(震地掀尘), 默认均匀高抛(爆炸);
     color=本批专用色(每批一份共享材质, 存活归零才 dispose) */
  function debrisBurst(x,y,z,n,o){
    o = o || {};
    const custom = o.color !== undefined;
    const mat = custom ? new THREE.MeshLambertMaterial({color:o.color}) : debrisMat;
    const ref = { n };                            // 本批存活计数
    const done = custom ? ()=>{ if(--ref.n <= 0) mat.dispose(); } : null;
    for(let i=0;i<n;i++){
      const d = new THREE.Mesh(debrisGeo, mat);
      d.position.set(x,y,z);
      scene.add(d);
      let vel;
      if(o.ring){
        const a = Math.random()*Math.PI*2;
        vel = new THREE.Vector3(Math.cos(a)*(2+Math.random()*3), 2+Math.random()*4, Math.sin(a)*(2+Math.random()*3));
      } else {
        vel = new THREE.Vector3((Math.random()-0.5)*9, 3+Math.random()*6, (Math.random()-0.5)*9);
      }
      debris.push({mesh:d, life: o.life||0.9, vel, done});
    }
  }

  /* 闪电弧: 围绕一点的锯齿电弧(飞行弹体的电花) — 快闪即逝;
     每道线自带几何(ownGeo), 存活期满连几何一起释放(与共享球几何区分) */
  function arc(x,y,z,o){
    o = o || {};
    const pts = [];
    let px = x, py = y, pz = z;
    for(let i=0; i<(o.pts||4); i++){
      pts.push(new THREE.Vector3(px, py, pz));
      px += (Math.random()-0.5)*(o.spread||0.8);
      py += (Math.random()-0.5)*(o.spread||0.8);
      pz += (Math.random()-0.5)*(o.spread||0.8);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: o.color!==undefined ? o.color : 0x9fe8ff,
      transparent:true, opacity:0.95 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    effects.push({ mesh: line, t:0, dur: o.dur||0.09, r0:1, r1:1, ownGeo:true });   // r0=r1: 不缩放
  }

  /* 落雷: 主干+分叉两道锯齿闪电自天而降劈到命中点 + 地面电光环 + zap 音。
     闪电由沿折线摆放的细长盒段拼成 — 真实截面厚度(WebGL 会忽略线宽, 线永远
     1px), 每段两层: 亮芯(core) + 半透光晕(halo); 单位盒共享, 段只缩放旋转 */
  const boltBox = new THREE.BoxGeometry(1, 1, 1);       // 单位盒共享
  const _bz = new THREE.Vector3(0, 0, 1);               // 盒纵轴
  const _bd = new THREE.Vector3();
  function bolt(x,y,z,o){
    o = o || {};
    const col = o.color!==undefined ? o.color : 0xbff4ff;
    const H = o.h || 9;
    const w = o.w || 0.1;                               // 亮芯截面粗细(格)
    const core = new THREE.MeshBasicMaterial({ color: col, transparent:true, opacity:1 });
    const halo = new THREE.MeshBasicMaterial({ color: col, transparent:true, opacity:0.3 });
    const group = new THREE.Group();
    const mkBolt = (ox)=>{                              // 一道锯齿闪电(顶端起始带横向偏移)
      let px = x + ox, pz = z + (Math.random()-0.5)*0.8, py = y + H;
      for(let i=0; i<7; i++){
        const nx = x + (Math.random()-0.5)*1.2;
        const nz = z + (Math.random()-0.5)*1.2;
        const ny = y + H - H*(i+1)/7;
        _bd.set(nx - px, ny - py, nz - pz);
        const len = _bd.length();
        if(len > 1e-4){
          _bd.divideScalar(len);
          for(const cv of [[core, w], [halo, w*2.2]]){  // 亮芯 + 光晕两层
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
    mkBolt(0); mkBolt((Math.random()-0.5)*2);           // 主干 + 分叉
    scene.add(group);
    effects.push({ mesh: group, mats: [core, halo], t:0, dur:0.22, r0:1, r1:1,
      onEnd(){ core.dispose(); halo.dispose(); } });    // 几何共享常驻, 只释放两份材质
    pop(x, y, z, { color: col, r0:0.4, r1: o.r1||3, dur:0.35 });   // 地面电光环
    sfx('zap');
  }

  /* 爆炸视觉(不伤人): 音效 + 震屏 + 冲击波 + 碎块; o.color 可整场换配色(坦克型号爆风) */
  function boom(x,y,z,o){
    o = o || {};
    sfx('boom'); kick(o.kick!==undefined ? o.kick : 0.6);
    pop(x,y,z, {r0:0.6, r1: o.r1||5, dur:0.4, color: o.color});
    debrisBurst(x,y,z, o.n||10, {life:0.9, color: o.color});
  }

  function kick(a){ shake = Math.max(shake, a); }

  /* 条目收尾: 自带 onEnd(落雷组等)优先, 否则释放私有材质/ownGeo 几何 —
     clear 与 update 超时共用一条释放规则 */
  function disposeFxEntry(e){
    scene.remove(e.mesh);
    if(e.onEnd) e.onEnd();
    else { e.mesh.material.dispose(); if(e.ownGeo) e.mesh.geometry.dispose(); }
  }

  /* 清空全部特效(模式切换用); 共享 geo/mat 不可 dispose, 专用色/闪电线/落雷组除外 */
  function clear(){
    for(const e of effects) disposeFxEntry(e);
    effects.length = 0;
    for(const d of debris){ scene.remove(d.mesh); if(d.done) d.done(); }
    debris.length = 0;
  }

  /* 生命周期推进(主循环游玩门内, 每帧) */
  function update(dt){
    for(let i=effects.length-1;i>=0;i--){
      const e = effects[i];
      e.t += dt;
      const p = e.t/e.dur;
      if(p >= 1){
        disposeFxEntry(e);
        effects.splice(i,1); continue;
      }
      const r = e.r0 + (e.r1-e.r0)*p;
      e.mesh.scale.set(r,r,r);
      if(e.mats){ for(const m of e.mats) m.opacity = 0.85*(1-p); }   // 组条目逐材质淡出
      else e.mesh.material.opacity = 0.85*(1-p);
    }
    for(let i=debris.length-1;i>=0;i--){
      const d = debris[i];
      d.life -= dt;
      d.vel.y -= 20*dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += dt*7;
      d.mesh.rotation.z += dt*5;
      if(d.life <= 0){
        scene.remove(d.mesh);
        if(d.done) d.done();
        debris.splice(i,1);
      }
    }
  }

  /* 震屏消费: 衰减 + 相机抖动(主循环每帧, 相机位姿设定之后调用) */
  function wobble(dt, camera){
    if(shake > 0){
      shake -= dt;
      const s = Math.max(0, shake)*0.4;
      camera.position.x += (Math.random()-0.5)*s;
      camera.position.y += (Math.random()-0.5)*s;
    }
  }

  return {boom, pop, debrisBurst, arc, bolt, kick, clear, update, wobble};
})();

/* ---------- 提示消息 ---------- */
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function showToast(msg, ms){
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toastEl.style.opacity = 0, ms||2500);
}
