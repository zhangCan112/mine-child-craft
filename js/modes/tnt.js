"use strict";
/* ============================================================
   TNT 密室逃生模式
   捡引线 → 铺引线 → F 点火 → 火花沿线烧 → TNT 爆炸 → 炸穿出口逃出密室
============================================================ */

/* ---------- 存档 (SaveSlot: 解析/默认值/版本演化收在槽里) ---------- */
const TNT_SAVE_KEY = 'tnt_escape_progress';
const tntSlot = SyncDB.slot(TNT_SAVE_KEY, { defaults: { unlocked: 0, stars: {} } });
function loadTntSave(){ return tntSlot.load(); }
function saveTntSave(s){ tntSlot.save(s); }

/* ---------- 状态 ---------- */
let lv = null;            // 当前关数据
let levelIdx = null;      // 当前关索引
let lvState = 'idle';     // idle | playing | dead | won
let timer = 0;            // 本关用时(秒)
let resets = 0;           // 本关重置次数(昏迷/按R)
let deadT = 0;
let demoFired = false, demoT = 0;

let fuseInv = 0, tntInv = 0;   // 库存: 引线 / TNT
/* hotbar (kit 实例): 0=引线 1=TNT, 库存计数实时重读 */
const tntHb = mkHotbar({
  items: [
    {icon:'🧵', lbl:'引线', cnt:()=>fuseInv},
    {icon:'💣', lbl:'TNT',  cnt:()=>tntInv}
  ]
});

const sparks = [];        // 火花
const tnts = [];          // TNT 实体
const pickups = [];       // 收集品
const weights = [];       // 重物块
const switches = new Map();// 转辙器 key → {x,y,z,dirIdx,mesh}
let plateDoors = [];      // 压力板-铁门联动组
let doorCheckT = 0;

const fadeEl = document.getElementById('fade');
const DIRS4 = [[1,0],[-1,0],[0,1],[0,-1]];

/* ---------- 共享素材 ---------- */
const sparkGeo = new THREE.BoxGeometry(0.22,0.22,0.22);
const sparkMat = new THREE.MeshBasicMaterial({color:0xffdd55});
const tntFlashGeo = new THREE.BoxGeometry(1.06,1.06,1.06);
const tntFlashMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.8, depthWrite:false});
const weightGeo = new THREE.BoxGeometry(1,1,1);
const weightMat = new THREE.MeshLambertMaterial({color:0x33343a});
const coilGeo = new THREE.TorusGeometry(0.19,0.06,8,16);
const coilMat = new THREE.MeshLambertMaterial({color:0xe89a2f});
const tntPickGeo = new THREE.BoxGeometry(0.32,0.32,0.32);
const tntPickMat = new THREE.MeshLambertMaterial({color:0xc4301f});
const fuseTipGeo = new THREE.BoxGeometry(0.08,0.08,0.08);
const fuseTipMat = new THREE.MeshBasicMaterial({color:0xffee99});
const arrowRodGeo = new THREE.BoxGeometry(0.14,0.08,0.5);
const arrowHeadGeo = new THREE.BoxGeometry(0.24,0.1,0.2);
const switchArrowMat = new THREE.MeshBasicMaterial({color:0xff8800});

/* ---------- 小工具 ---------- */
function inZone(p, z){
  return p.x>=z.x1 && p.x<=z.x2+1 && p.y>=z.y1 && p.y<=z.y2+1 && p.z>=z.z1 && p.z<=z.z2+1;
}
function fmtTime(t){
  const m=Math.floor(t/60), s=Math.floor(t%60);
  return m+':'+(s<10?'0':'')+s;
}
function isFuseOrSwitch(x,y,z){
  const id = getBlock(x,y,z);
  return id===B_FUSE || id===B_SWITCH;
}
function findTntAt(x,y,z){
  return tnts.find(t=> t.x===x && t.y===y && t.z===z);
}
function smallPop(x,y,z,color){
  Fx.pop(x,y,z, {color, geo:new THREE.SphereGeometry(0.14,8,6), r0:0.15, r1:0.55, dur:0.3});
}

/* ---------- 实体注册 ---------- */
function registerTnt(x,y,z, demo){
  if(findTntAt(x,y,z)) return;
  tnts.push({x,y,z, fuse:null, demo:!!demo, mesh:null});   // null=未点燃
}
function addPickup(p){
  const g = new THREE.Group();
  if(p.kind==='tnt'){
    const b = new THREE.Mesh(tntPickGeo, tntPickMat);
    const tip = new THREE.Mesh(fuseTipGeo, fuseTipMat); tip.position.set(0,0.2,0);
    g.add(b, tip);
  } else {
    const c = new THREE.Mesh(coilGeo, coilMat);
    c.rotation.x = Math.PI/2;
    g.add(c);
  }
  g.position.set(p.x+0.5, p.y+0.5, p.z+0.5);
  scene.add(g);
  pickups.push({x:p.x, y:p.y, z:p.z, kind:p.kind, n:p.n||1, mesh:g, t:Math.random()*6});
}
function registerSwitch(s){
  const g = new THREE.Group();
  const rod = new THREE.Mesh(arrowRodGeo, switchArrowMat); rod.position.set(0,0,-0.15);
  const head = new THREE.Mesh(arrowHeadGeo, switchArrowMat); head.position.set(0,0,-0.42);
  g.add(rod, head);
  g.position.set(s.x+0.5, s.y+1.12, s.z+0.5);
  const sw = {x:s.x, y:s.y, z:s.z, dirIdx:s.dir||0, mesh:g};
  updateSwitchArrow(sw);
  scene.add(g);
  switches.set(blockKey(s.x,s.y,s.z), sw);
}
function updateSwitchArrow(sw){
  const [dx,dz] = DIRS4[sw.dirIdx];
  sw.mesh.rotation.y = Math.atan2(dx,dz);
}

/* ---------- 实体清理 ---------- */
function clearTntEntities(){
  for(const s of sparks){ scene.remove(s.mesh); if(s.light) scene.remove(s.light); }
  sparks.length = 0;
  for(const t of tnts){ if(t.mesh) scene.remove(t.mesh); }
  tnts.length = 0;
  for(const p of pickups) scene.remove(p.mesh);
  pickups.length = 0;
  for(const w of weights){ if(w.mesh) scene.remove(w.mesh); }
  weights.length = 0;
  for(const sw of switches.values()) scene.remove(sw.mesh);
  switches.clear();
  plateDoors = [];
  fadeEl.style.opacity = 0;
}

/* ---------- 关卡流程 ---------- */
function startLevel(i, fresh){
  clearTntEntities();
  clearWorld();
  levelIdx = i;
  lv = LEVELS[i];
  lvState = 'playing';
  timer = 0;
  if(fresh !== false) resets = 0;
  fuseInv = 0; tntInv = 0; tntHb.select(0);
  demoFired = false; demoT = 0;

  lv.build();                                   // 关卡自己铺方块
  rebuildAll();

  for(const t of (lv.tnts||[])){
    setBlockRaw(t.x, t.y, t.z, B_TNT);                        // 预放置 TNT 方块
    registerTnt(t.x, t.y, t.z, t.demo);
  }
  for(const p of (lv.pickups||[])) addPickup(p);
  for(const s of (lv.switches||[])) registerSwitch(s);
  plateDoors = (lv.doors||[]).map(d=>({plates:d.plates, cells:d.cells, open:false}));
  weights.length = 0;
  for(const w of (lv.weights||[])) weights.push({x:w.x, y:w.y, z:w.z, state:'rest', mesh:null, vy:0});

  ModeKit.spawn(lv.spawn.x+0.5, (lv.spawn.y||11)+0.01, lv.spawn.z+0.5, {yaw: lv.spawn.yaw||0});   // 固定楼层出生(密室有顶,不能扫顶)

  tntHb.show();
  fadeEl.style.opacity = 0;
  showToast('第 ' + (i+1) + ' 关 · ' + lv.name, 2000);
}

/* ---------- TNT 点火与爆炸 ---------- */
function igniteTnt(t, delay){
  if(t.fuse !== null) return;                    // 已点燃/已在延迟中
  t.fuse = -(delay||0);
  sfx('fss');
}
function removeTnt(t){
  const i = tnts.indexOf(t);
  if(i>=0) tnts.splice(i,1);
  if(t.mesh) scene.remove(t.mesh);
}

function explodeTnt(t){
  removeTnt(t);
  editBlockDirty(t.x, t.y, t.z, 0);
  const cx=t.x+0.5, cy=t.y+0.5, cz=t.z+0.5;
  Fx.boom(cx, cy, cz, {r1: TNT_CFG.radius+1.5, n: 14});
  destroySphere(cx, cy, cz, t);
  flushDirty();
}

/* 球形破坏:裂纹砖必毁 · 软方块概率毁 · 功能方块免疫 · 支架被毁触发落石 · TNT 链爆 */
function destroySphere(cx, cy, cz, srcTnt){
  const R = TNT_CFG.radius;
  const bx = Math.floor(cx), by = Math.floor(cy), bz = Math.floor(cz);
  const r = Math.ceil(R);
  for(let x=bx-r; x<=bx+r; x++){
    for(let y=by-r; y<=by+r; y++){
      for(let z=bz-r; z<=bz+r; z++){
        const d = Math.hypot(x+0.5-cx, y+0.5-cy, z+0.5-cz);
        if(d > R) continue;
        const id = getBlock(x,y,z);
        if(id===0) continue;
        const b = BLOCKS[id];
        if(b.tnt){                               // 链式引爆
          const t = findTntAt(x,y,z);
          if(t) igniteTnt(t, TNT_CFG.chainDelay);
          continue;
        }
        if(b.fuse || b.crack){                   // 引线/裂纹砖必毁
          editBlockDirty(x,y,z,0);
          continue;
        }
        if(b.support){                           // 支架被毁 → 上方重物下落
          editBlockDirty(x,y,z,0);
          continue;
        }
        if(b.soft){                              // 软方块按距离概率破坏
          if(Math.random() < TNT_CFG.breakBase*(1-d/R)) editBlockDirty(x,y,z,0);
          continue;
        }
        // 石质外壳/玻璃/水/岩浆/门/压力板/转辙器/重物 不可破坏
      }
    }
  }
  // 重物:支架没了就落
  for(const w of weights){
    if(w.state==='rest' && getBlock(w.x, w.y-1, w.z)===0) startWeightFall(w);
  }
  // 玩家伤害(演示 TNT 不伤人)
  if(!srcTnt || !srcTnt.demo){
    const d = Math.hypot(pos.x-cx, pos.y+PLAYER.height/2-cy, pos.z-cz);
    if(d < TNT_CFG.hurtR) knockout();
  }
  // 顺便清掉爆炸圈里的火花
  for(let i=sparks.length-1;i>=0;i--){
    const s = sparks[i];
    if(Math.hypot(s.x+0.5-cx, s.y+0.5-cy, s.z+0.5-cz) < R+1){
      scene.remove(s.mesh); if(s.light) scene.remove(s.light);
      sparks.splice(i,1);
    }
  }
}

/* ---------- 火花 ---------- */
function spawnSpark(x,y,z){
  const mesh = new THREE.Mesh(sparkGeo, sparkMat);
  mesh.position.set(x+0.5, y+0.2, z+0.5);
  const light = new THREE.PointLight(0xffaa33, 0.9, 5);
  light.position.copy(mesh.position);
  scene.add(mesh); scene.add(light);
  sparks.push({x, y, z, px:x, py:y, pz:z, prog:1, mesh, light,
    speed: (lv && lv.fast) ? TNT_CFG.sparkFast : TNT_CFG.sparkSpeed, fssT:0, life:0});
  sfx('fss');
}

function killSpark(s, water){
  if(water){
    sfx('splash');
    smallPop(s.x+0.5, s.y+0.3, s.z+0.5, 0x66aaff);
    showToast('💦 火花被水浇灭了！', 1800);
  } else {
    smallPop(s.x+0.5, s.y+0.3, s.z+0.5, 0x888888);
  }
  scene.remove(s.mesh); scene.remove(s.light);
}

function updateSparks(dt){
  for(let i=sparks.length-1;i>=0;i--){
    const s = sparks[i];
    let dead = false;
    s.life += dt;
    if(s.life > 60){ killSpark(s,false); sparks.splice(i,1); continue; }
    s.fssT -= dt;
    if(s.fssT <= 0){ sfx('fss'); s.fssT = 0.28; }

    s.prog += dt * s.speed;
    while(s.prog >= 1){
      s.prog -= 1;
      // 烧掉脚下的引线(转辙器保留可复用)
      if(getBlock(s.x, s.y, s.z) === B_FUSE) editBlockDirty(s.x, s.y, s.z, 0);
      // 邻接 TNT → 点燃
      for(const [dx,dz] of DIRS4){
        if(getBlock(s.x+dx, s.y, s.z+dz) === B_TNT){
          const t = findTntAt(s.x+dx, s.y, s.z+dz);
          if(t) igniteTnt(t);
        }
      }
      // 决定下一格
      let next = null;
      if(getBlock(s.x, s.y, s.z) === B_SWITCH){
        const sw = switches.get(blockKey(s.x,s.y,s.z));
        const [dx,dz] = sw ? DIRS4[sw.dirIdx] : [0,1];
        next = {x:s.x+dx, y:s.y, z:s.z+dz};
      } else {
        const cands = [];
        for(const [dx,dz] of DIRS4){
          const nx=s.x+dx, nz=s.z+dz;
          if(isFuseOrSwitch(nx, s.y, nz) && !(nx===s.px && nz===s.pz))  // 不走回头路
            cands.push({x:nx, y:s.y, z:nz});
        }
        const sx = s.x + (s.x-s.px), sz = s.z + (s.z-s.pz);
        next = cands.find(c=> c.x===sx && c.z===sz) || cands[0] || null;
      }
      if(next && isFuseOrSwitch(next.x, next.y, next.z)){
        s.px=s.x; s.py=s.y; s.pz=s.z;
        s.x=next.x; s.y=next.y; s.z=next.z;
      } else {
        // 烧到头:正对水 → 被浇灭;否则自然熄灭
        let water=false;
        for(const [dx,dz] of DIRS4){
          if(getBlock(s.x+dx, s.y, s.z+dz)===B_WATER){ water=true; break; }
        }
        killSpark(s, water);
        sparks.splice(i,1);
        dead = true;
        break;
      }
    }
    if(dead) continue;
    // 平滑移动
    const m = s.mesh;
    m.position.set(s.px+0.5 + (s.x-s.px)*s.prog,
                   s.py+0.2 + (s.y-s.py)*s.prog,
                   s.pz+0.5 + (s.z-s.pz)*s.prog);
    const blink = 0.85 + Math.sin(performance.now()/40)*0.2;
    m.scale.set(blink, blink, blink);
    s.light.position.copy(m.position);
  }
  flushDirty();
}

/* ---------- 重物块 / 压力板 / 铁门 ---------- */
function startWeightFall(w){
  w.state = 'fall';
  editBlockDirty(w.x, w.y, w.z, 0);
  const m = new THREE.Mesh(weightGeo, weightMat);
  m.position.set(w.x+0.5, w.y+0.5, w.z+0.5);
  scene.add(m);
  w.mesh = m; w.vy = 0;
  flushDirty();
}
function updateWeights(dt){
  let dirty = false;
  for(const w of weights){
    if(w.state!=='fall') continue;
    w.vy -= 22*dt;
    let y = w.mesh.position.y + w.vy*dt;
    // 向下找落点:solid 或 压力板 都能托住
    const fx = Math.floor(w.mesh.position.x), fz = Math.floor(w.mesh.position.z);
    let land = -1;
    for(let cy = Math.floor(y-0.5); cy >= 0; cy--){
      const id = getBlock(fx, cy, fz);
      if(isSolid(id) || BLOCKS[id] && BLOCKS[id].plate){ land = cy+1; break; }
    }
    if(land >= 0 && y <= land+0.5){
      y = land+0.5;
      w.state = 'landed';
      scene.remove(w.mesh); w.mesh = null;
      editBlockDirty(fx, land, fz, B_WEIGHT);   // 直写留点了结: 与手动 setBlockRaw+markDirty 逐字等价
      dirty = true;
      Fx.kick(0.35);
      sfx('boom');
      // 砸到玩家
      if(Math.floor(pos.x)===fx && Math.floor(pos.z)===fz
         && Math.abs(pos.y - land) < 1.2) knockout();
    }
    if(w.mesh) w.mesh.position.y = y;
  }
  if(dirty) flushDirty();
}

function updateDoors(){
  for(const pd of plateDoors){
    let pressed = false;
    for(const p of pd.plates){
      // 重物压板
      for(const w of weights){
        if(w.state==='landed' && w.x===p.x && w.z===p.z && w.y===p.y+1){ pressed=true; break; }
      }
      if(pressed) break;
      // 玩家踩板
      if(Math.floor(pos.x)===p.x && Math.floor(pos.z)===p.z
         && Math.abs(pos.y - p.y) < 0.9){ pressed=true; break; }
    }
    if(pressed && !pd.open){
      pd.open = true;
      sfx('door');
      for(const c of pd.cells) editBlockDirty(c.x, c.y, c.z, 0);
      flushDirty();
      showToast('🚪 轰隆…铁门开了！', 1800);
    } else if(!pressed && pd.open){
      // 关门防夹:玩家站在门里就不关
      let block = false;
      for(const c of pd.cells){
        if(pos.x>c.x-0.4 && pos.x<c.x+1.4 && pos.z>c.z-0.4 && pos.z<c.z+1.4
           && pos.y>c.y-0.4 && pos.y<c.y+1.4){ block=true; break; }
      }
      if(!block){
        pd.open = false;
        sfx('door');
        for(const c of pd.cells) editBlockDirty(c.x, c.y, c.z, B_DOOR);
        flushDirty();
      }
    }
  }
}

/* ---------- 收集品 ---------- */
function updatePickups(dt){
  for(let i=pickups.length-1;i>=0;i--){
    const p = pickups[i];
    p.t += dt;
    p.mesh.rotation.y += dt*2;
    p.mesh.position.y = p.y+0.5 + Math.sin(p.t*2.2)*0.12;
    const dx = pos.x-(p.x+0.5), dz = pos.z-(p.z+0.5), dy = pos.y+0.9-(p.y+0.5);
    if(dx*dx+dz*dz < 1.45 && Math.abs(dy) < 1.6){
      if(p.kind==='tnt') tntInv += p.n; else fuseInv += p.n;
      sfx('pick');
      smallPop(p.x+0.5, p.y+0.8, p.z+0.5, p.kind==='tnt'?0xff6644:0xffcc44);
      scene.remove(p.mesh);
      pickups.splice(i,1);
      tntHb.refresh();
    }
  }
}

/* ---------- 玩家操作 ---------- */
function tryIgnite(){
  if(lvState!=='playing') return;
  const aim = CameraRig.aim();
  const hit = raycastVoxel(aim.origin, aim.dir, 6);
  if(!hit) return;
  const id = getBlock(hit.x, hit.y, hit.z);
  if(id===B_TNT){
    const t = findTntAt(hit.x, hit.y, hit.z);
    if(t && !t.demo) igniteTnt(t);
  } else if(id===B_FUSE){
    spawnSpark(hit.x, hit.y, hit.z);
  }
}
function tryLeftClick(hit){
  if(lvState!=='playing' || !hit) return;
  const id = getBlock(hit.x, hit.y, hit.z);
  if(id===B_FUSE){                          // 捡回引线
    editBlock(hit.x, hit.y, hit.z, 0);
    fuseInv++; sfx('pick'); tntHb.refresh();
  } else if(id===B_TNT){                    // 捡回 TNT (未点燃的)
    const t = findTntAt(hit.x, hit.y, hit.z);
    if(t && !t.demo && t.fuse===null){
      removeTnt(t);
      editBlock(hit.x, hit.y, hit.z, 0);
      tntInv++; sfx('pick'); tntHb.refresh();
    }
  } else if(id===B_SWITCH){                 // 扳转辙器
    const sw = switches.get(blockKey(hit.x, hit.y, hit.z));
    if(sw){
      sw.dirIdx = (sw.dirIdx+1) % 4;
      updateSwitchArrow(sw);
      sfx('click');
    }
  }
}
function tryPlace(hit){
  if(lvState!=='playing' || !hit) return;
  const px=hit.x+hit.nx, py=hit.y+hit.ny, pz=hit.z+hit.nz;
  if(getBlock(px,py,pz)!==0) return;
  if(!isSolid(getBlock(px,py-1,pz))) return;          // 必须铺在实心地上
  if(tntHb.sel===0){
    if(fuseInv<=0) return;
    fuseInv--;
    editBlock(px,py,pz, B_FUSE);
  } else {
    if(tntInv<=0) return;
    if(collidesAtPlayer(px,py,pz)) return;            // 别把自己埋进去
    tntInv--;
    editBlock(px,py,pz, B_TNT);
    registerTnt(px,py,pz,false);
  }
  sfx('click');
  tntHb.refresh();
}

/* ---------- 失败 / 通关 ---------- */
function knockout(){
  if(lvState!=='playing') return;
  lvState = 'dead';
  deadT = 0;
  sfx('death');
  fadeEl.style.opacity = 1;
}
function doWin(){
  lvState = 'won';
  sfx('win');
  const stars = 1 + (timer<=lv.par ? 1:0) + (resets===0 ? 1:0);
  const save = loadTntSave();
  save.unlocked = Math.max(save.unlocked, Math.min(levelIdx+1, LEVELS.length-1));
  save.stars[levelIdx] = Math.max(save.stars[levelIdx]||0, stars);
  saveTntSave(save);
  document.getElementById('winTitle').textContent = '第 ' + (levelIdx+1) + ' 关 · ' + lv.name + ' 逃出来啦！';
  document.getElementById('winStars').innerHTML =
    [1,2,3].map(n=> '<span class="'+(n<=stars?'':'off')+'">⭐</span>').join('');
  document.getElementById('winTime').textContent =
    '用时 ' + fmtTime(timer) + ' · 目标 ' + fmtTime(lv.par) + (resets===0 ? ' · 全程无重置 ✨' : '');
  const nextBtn = document.getElementById('winNextBtn');
  if(levelIdx+1 < LEVELS.length){
    nextBtn.style.display = '';
    nextBtn.textContent = '下一关 ➡';
  } else {
    nextBtn.style.display = '';
    nextBtn.textContent = '🎉 全部通关！选关';
  }
  showPage('win');
  uiPause();                                       // 桌面=退出指针锁, 触屏=直接显示覆盖层
}

/* ---------- HUD / 物品栏: hotbar 由 mode-kit 的 tntHb 接管 ---------- */

/* ---------- 菜单 ---------- */
function buildTntMenu(){
  const grid = document.getElementById('levelGrid');
  grid.innerHTML = '';
  const save = loadTntSave();
  LEVELS.forEach((L,i)=>{
    const btn = document.createElement('button');
    btn.className = 'lvBtn';
    if(i <= save.unlocked){
      const st = save.stars[i]||0;
      btn.innerHTML = `<span class="no">${i+1}</span><span class="stars">${'⭐'.repeat(st)}</span>`;
      btn.onclick = ()=>{ startLevel(i); requestLock(); };
    } else {
      btn.classList.add('locked');
      btn.innerHTML = `<span class="lock">🔒</span>`;
    }
    grid.appendChild(btn);
  });
  document.getElementById('tntResumeBtn').disabled = (levelIdx==null);
  document.getElementById('tntResumeBtn').onclick = requestLock;
  ModeKit.confirmBtn(document.getElementById('tntResetBtn'), {
    label: '重置进度 ↺', confirm: '⚠ 再点一次确认重置',
    onConfirm(){ tntSlot.reset(); showToast('进度已重置', 1800); buildTntMenu(); }
  });
  document.getElementById('winNextBtn').onclick = ()=>{
    if(levelIdx+1 < LEVELS.length) startLevel(levelIdx+1);
    else { showPage('tnt'); buildTntMenu(); return; }
    requestLock();
  };
  document.getElementById('winReplayBtn').onclick = ()=>{ startLevel(levelIdx); requestLock(); };
  document.getElementById('winMenuBtn').onclick = ()=>{ showPage('tnt'); buildTntMenu(); };
}

/* R 重置本关 (键盘/触屏共用) */
function tntReset(){
  if(lvState !== 'playing') return;
  resets++;
  startLevel(levelIdx, false);
  showToast('↺ 本关已重置', 1500);
}

/* ---------- 模式对象 ---------- */
const TntMode = mkMode({
  id: 'tnt',
  chrome: { score:'none', hotbar:'none' },          // 进关卡后由 tntHb.show() 现身
  hotbar: tntHb,
  touch: [                                           // 平板动作按钮
    {label:'⬆️', hold:'Space'},
    {label:'🔥', act:()=>tryIgnite()},
    {label:'🧨', act:()=>doCenterClick(2)},
    {label:'✋', act:()=>doCenterClick(0)},
    {label:'↺',  act:()=>tntReset()}
  ],
  cleanup(){
    clearTntEntities();
    highlight.material.color.set(0x000000);
    highlight.material.opacity = 0.5;
    levelIdx = null; lv = null; lvState = 'idle';
  },
  update(dt){
    if(!lv) return;
    if(lvState==='playing'){
      timer += dt;
      // 开场自动演示
      if(lv.demo && !demoFired){
        demoT += dt;
        if(demoT >= lv.demo.t){
          demoFired = true;
          spawnSpark(lv.demo.from.x, lv.demo.from.y, lv.demo.from.z);
          showToast('👀 看！点火后要快跑！', 3000);
        }
      }
      updateSparks(dt);
      updateWeights(dt);
      updatePickups(dt);
      doorCheckT -= dt;
      if(doorCheckT <= 0){ doorCheckT = 0.15; updateDoors(); }
      // TNT 引信计时
      for(let i=tnts.length-1;i>=0;i--){
        const t = tnts[i];
        if(t.fuse===null) continue;              // 未点燃
        if(t.fuse < 0){ t.fuse += dt; continue; } // 链爆延迟中
        t.fuse += dt;
        if(!t.mesh){
          t.mesh = new THREE.Mesh(tntFlashGeo, tntFlashMat.clone());
          t.mesh.position.set(t.x+0.5, t.y+0.5, t.z+0.5);
          scene.add(t.mesh);
        }
        const p = Math.min(1, t.fuse/TNT_CFG.tntFuse);
        const s = 1 + p*0.3;
        t.mesh.scale.set(s,s,s);
        t.mesh.material.opacity = Math.sin(t.fuse*25)>0 ? 0.75 : 0.12;
        if(t.fuse >= TNT_CFG.tntFuse) explodeTnt(t);
      }
      // 岩浆 / 出口
      const feet = getBlock(Math.floor(pos.x), Math.floor(pos.y+0.1), Math.floor(pos.z));
      if(feet===B_LAVA) knockout();
      if(lv.exit && inZone(pos, lv.exit)) doWin();
    } else if(lvState==='dead'){
      for(const k in keys) keys[k] = false;      // 昏迷期间冻结输入
      deadT += dt;
      if(deadT > 1.3){
        resets++;
        startLevel(levelIdx, false);
      }
    }
  },
  onKey(code){
    if(code==='KeyF') tryIgnite();
    if(code==='KeyR') tntReset();
  },
  onMouse(button, hit){
    if(button===0) tryLeftClick(hit);
    else if(button===2) tryPlace(hit);
  },
  onVoidFall(){ knockout(); },
  onHighlight(hit){
    const id = getBlock(hit.x, hit.y, hit.z);
    if(id===B_TNT || id===B_FUSE){
      highlight.material.color.set(0xff9900);
      highlight.material.opacity = 0.95;
    } else {
      highlight.material.color.set(0x000000);
      highlight.material.opacity = 0.5;
    }
  },
  onMenu(){
    showPage('tnt');
    buildTntMenu();
  },
  buildMenu: buildTntMenu,
  hud(hit){
    if(!lv) return [];
    let hint = '';
    if(hit){
      const id = getBlock(hit.x, hit.y, hit.z);
      if(id===B_FUSE || id===B_TNT) hint = '🔥 F 点火';
      else if(id===B_SWITCH) hint = '☝ 左键 扳动';
      else hint = BLOCKS[id] ? BLOCKS[id].name : '';
    }
    return [
      `第 ${levelIdx+1}/${LEVELS.length} 关 · ${lv.name}`,
      `⏱ ${fmtTime(timer)} / ${fmtTime(lv.par)}`,
      `🧵×${fuseInv} 💣×${tntInv}`,
      ...(hint ? ['👉 '+hint] : []),
      `R 重置 · Esc 菜单`
    ];
  }
});
