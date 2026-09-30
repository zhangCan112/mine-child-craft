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

/* ---------- 通用特效 ---------- */
let shake = 0;
const effects = [];   // 冲击波球
const debris = [];    // 物理碎块
const debrisGeo = new THREE.BoxGeometry(0.16,0.16,0.16);
const debrisMat = new THREE.MeshLambertMaterial({color:0x4a4a48});

/* 爆炸视觉(不伤人):音效 + 震屏 + 冲击波 + 碎块 */
function boomVisual(x,y,z,r1,nDebris){
  sfx('boom'); shake = Math.max(shake, 0.6);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1,12,10),
    new THREE.MeshBasicMaterial({color:0xffd9a0, transparent:true, opacity:0.9, depthWrite:false}));
  mesh.position.set(x,y,z); scene.add(mesh);
  effects.push({mesh, t:0, dur:0.4, r0:0.6, r1: r1||5});
  for(let i=0;i<(nDebris||10);i++){
    const d = new THREE.Mesh(debrisGeo, debrisMat);
    d.position.set(x,y,z);
    scene.add(d);
    debris.push({mesh:d, life:0.9,
      vel:new THREE.Vector3((Math.random()-0.5)*9, 3+Math.random()*6, (Math.random()-0.5)*9)});
  }
}

function updateEffects(dt){
  for(let i=effects.length-1;i>=0;i--){
    const e = effects[i];
    e.t += dt;
    const p = e.t/e.dur;
    if(p >= 1){
      scene.remove(e.mesh); e.mesh.geometry.dispose(); e.mesh.material.dispose();
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
      debris.splice(i,1);
    }
  }
}

/* ---------- 提示消息 ---------- */
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function showToast(msg, ms){
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toastEl.style.opacity = 0, ms||2500);
}
