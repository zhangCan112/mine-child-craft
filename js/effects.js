"use strict";
/* ============================================================
   音效 (WebAudio 合成) + 通用特效 + 提示消息
============================================================ */
let actx = null;
const sfxLastT = {};
function sfx(kind){
  try{
    const nowMs = performance.now();                  // 大规模混战时限制同类音效频率
    if(kind!=='win' && nowMs - (sfxLastT[kind]||0) < 60) return;
    sfxLastT[kind] = nowMs;
    if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)();
    if(actx.state==='suspended') actx.resume();
    const t = actx.currentTime;
    const g = actx.createGain(); g.connect(actx.destination);
    if(kind==='boom'){
      const dur = 0.5, buf = actx.createBuffer(1, Math.floor(actx.sampleRate*dur), actx.sampleRate);
      const ch = buf.getChannelData(0);
      for(let i=0;i<ch.length;i++) ch[i] = (Math.random()*2-1)*(1-i/ch.length);
      const src = actx.createBufferSource(); src.buffer = buf;
      const f = actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420;
      src.connect(f); f.connect(g);
      g.gain.setValueAtTime(0.4, t);
      src.start(t);
      return;
    }
    if(kind==='fss'){                                 // 引线嘶嘶声
      const dur = 0.3, buf = actx.createBuffer(1, Math.floor(actx.sampleRate*dur), actx.sampleRate);
      const ch = buf.getChannelData(0);
      for(let i=0;i<ch.length;i++) ch[i] = (Math.random()*2-1)*(1-i/ch.length);
      const src = actx.createBufferSource(); src.buffer = buf;
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
