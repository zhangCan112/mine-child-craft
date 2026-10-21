"use strict";
/* ============================================================
   音效 (WebAudio 合成) + 通用特效 + 提示消息
============================================================ */
let actx = null;            // 懒创建; iOS 须在用户手势内创建+resume 才能真正出声(见 unlockAudio)
let master = null;          // 总线: 全部音效 → master → 压限器 → 扬声器, 多路叠加不再硬削波(pad 杂音根因)
const sfxLastT = {};
const sfxTouch = (()=>{ try{ return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); }catch(e){ return false; } })();   // pad 小喇叭发不动低频

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

function sfx(kind){
  try{
    const nowMs = performance.now();                  // 大规模混战时限制同类音效频率
    if(kind!=='win' && nowMs - (sfxLastT[kind]||0) < 60) return;
    sfxLastT[kind] = nowMs;
    unlockAudio();
    if(!actx || actx.state !== 'running') return;     // 挂起中不排队: 免得恢复瞬间扎堆炸响
    const t = actx.currentTime;
    const g = actx.createGain(); g.connect(master);
    if(kind==='boom'){
      const src = actx.createBufferSource(); src.buffer = noiseBuf(0.5);
      const f = actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420;
      src.connect(f); f.connect(g);
      g.gain.setValueAtTime(0.2, t);                  // 0.4→0.2: 与其他音效重新配平, 给压限器留余量
      src.start(t);
      return;
    }
    if(kind==='fss'){                                 // 引线嘶嘶声
      const src = actx.createBufferSource(); src.buffer = noiseBuf(0.3);
      const f = actx.createBiquadFilter(); f.type='highpass'; f.frequency.value=3000;
      src.connect(f); f.connect(g);
      g.gain.setValueAtTime(0.12, t);
      src.start(t);
      return;
    }
    const o = actx.createOscillator(); o.connect(g);
    if(kind==='hit'){
      o.type='square';
      o.frequency.setValueAtTime(170,t); o.frequency.exponentialRampToValueAtTime(80,t+0.08);
      g.gain.setValueAtTime(0.08,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.09);
      o.start(t); o.stop(t+0.09);
    } else if(kind==='shoot'){
      o.type='square';
      o.frequency.setValueAtTime(820,t); o.frequency.exponentialRampToValueAtTime(300,t+0.07);
      g.gain.setValueAtTime(0.04,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.08);
      o.start(t); o.stop(t+0.08);
    } else if(kind==='death'){
      o.type='sawtooth';
      o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(48,t+0.28);
      g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
      o.start(t); o.stop(t+0.3);
    } else if(kind==='breath'){
      o.type='sawtooth';
      o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(90,t+0.35);
      g.gain.setValueAtTime(0.07,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4);
      o.start(t); o.stop(t+0.4);
    } else if(kind==='pick'){                         // 拾取叮咚
      o.type='sine';
      o.frequency.setValueAtTime(880,t); o.frequency.setValueAtTime(1318,t+0.07);
      g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.22);
      o.start(t); o.stop(t+0.22);
    } else if(kind==='click'){                        // 转辙器咔哒
      o.type='square';
      o.frequency.setValueAtTime(1200,t);
      g.gain.setValueAtTime(0.07,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.05);
      o.start(t); o.stop(t+0.05);
    } else if(kind==='door'){                         // 铁门滑开
      o.type='sawtooth';
      o.frequency.setValueAtTime(90,t); o.frequency.linearRampToValueAtTime(220,t+0.3);
      g.gain.setValueAtTime(0.09,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
      o.start(t); o.stop(t+0.35);
    } else if(kind==='splash'){                       // 火花入水
      o.type='sine';
      o.frequency.setValueAtTime(500,t); o.frequency.exponentialRampToValueAtTime(120,t+0.15);
      g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
      o.start(t); o.stop(t+0.18);
    } else if(kind==='roar'){                         // 僵尸狂暴怒吼
      o.type='sawtooth';
      o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(45,t+0.35);
      g.gain.setValueAtTime(0.14,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4);
      o.start(t); o.stop(t+0.4);
    } else if(kind==='level'){                        // 晋升琶音
      o.type='sine';
      o.frequency.setValueAtTime(660,t); o.frequency.setValueAtTime(880,t+0.08);
      o.frequency.setValueAtTime(1320,t+0.16);
      g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.42);
      o.start(t); o.stop(t+0.42);
    } else if(kind==='win'){
      const o2 = actx.createOscillator(); o2.connect(g);
      o.type='sine'; o2.type='sine';
      o.frequency.setValueAtTime(523,t);  o.frequency.setValueAtTime(659,t+0.16);
      o2.frequency.setValueAtTime(784,t+0.32);
      g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.85);
      o.start(t); o.stop(t+0.85); o2.start(t+0.32); o2.stop(t+0.85);
    }
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
    const g0 = sfxTouch ? 0.022 : 0.045, gk = sfxTouch ? 0.045 : 0.085;
    humGain.gain.setTargetAtTime(g0 + q*gk, t, 0.12);
    humOsc.frequency.setTargetAtTime(52 + q*46, t, 0.18);
  }catch(e){}
}

/* ---------- 通用特效 Fx: 爆炸/冲击波/碎块/震屏的唯一入口 ----------
   条目形状/动画/衰减全部收在 implementation, 外部只经 7 个入口触碰 */
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

  /* 爆炸视觉(不伤人): 音效 + 震屏 + 冲击波 + 碎块 */
  function boom(x,y,z,o){
    o = o || {};
    sfx('boom'); kick(o.kick!==undefined ? o.kick : 0.6);
    pop(x,y,z, {r0:0.6, r1: o.r1||5, dur:0.4});
    debrisBurst(x,y,z, o.n||10, {life:0.9});
  }

  function kick(a){ shake = Math.max(shake, a); }

  /* 清空全部特效(模式切换用); 碎块共享 geo/mat 不可 dispose, 专用色除外 */
  function clear(){
    for(const e of effects){ scene.remove(e.mesh); e.mesh.material.dispose(); }   // 几何共享常驻
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
        scene.remove(e.mesh); e.mesh.material.dispose();
        effects.splice(i,1); continue;
      }
      const r = e.r0 + (e.r1-e.r0)*p;
      e.mesh.scale.set(r,r,r);
      e.mesh.material.opacity = 0.85*(1-p);
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

  return {boom, pop, debrisBurst, kick, clear, update, wobble};
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
