"use strict";
/* ============================================================
   建造模式:自由建造 · 精选初始场景(巨大地下室 / 二层小楼房)
   - 全方块物品栏 · F 飞行 · R 重置场景 · 改动自动云同步存档
   - 家具全部由现有方块拼搭(床/沙发/桌椅/电视/书架/厨台…)
============================================================ */

/* ---------- 物品栏:全部基础方块 ---------- */
const BUILD_PALETTE = [6,5,17,3,4,13,9,18,19,15,16,12,11,8,2,1,7,14,10];
const BUILD_SAVE_KEY = 'build_world_save';

let buildSceneId = null;          // 当前场景 id
const buildEdits = {};            // 各场景玩家改动 { sceneId: Map("x,y,z"→id) }
let buildSel = 0;                 // 物品栏选中
let buildSaveT = 0, buildDirty = false;

/* ============================================================
   家具搭建辅助 (y 为家具底部所在层)
============================================================ */
/* 床: 石英枕头 + 羊毛垫 ×2, 沿 'x' 或 'z' 方向摆放 */
function fxBed(x,y,z,dir,wool){
  if(dir==='x'){ setBlockRaw(x,y,z,17); setBlockRaw(x+1,y,z,wool); setBlockRaw(x+2,y,z,wool); }
  else         { setBlockRaw(x,y,z,17); setBlockRaw(x,y,z+1,wool); setBlockRaw(x,y,z+2,wool); }
}
/* 沙发: len 个座位 + 墙侧靠背, face 为面朝方向 */
function fxSofa(x,y,z,len,face,wool){
  wool = wool || 15;
  for(let i=0;i<len;i++){
    let sx=x, sz=z, bx=x, bz=z;
    if(face==='n'){ sx=x+i; bx=x+i; bz=z+1; }
    if(face==='s'){ sx=x+i; bx=x+i; bz=z-1; }
    if(face==='e'){ sz=z+i; bx=x-1; bz=z+i; }
    if(face==='w'){ sz=z+i; bx=x+1; bz=z+i; }
    setBlockRaw(sx,y,sz,wool);
    setBlockRaw(bx,y+1,bz,wool);
  }
}
/* 桌子: w×d 桌面 + 四角木腿 */
function fxTable(x,y,z,w,d,top){
  for(let i=0;i<w;i++)
    for(let j=0;j<d;j++) setBlockRaw(x+i,y+1,z+j, top||17);
  setBlockRaw(x,y,z,5);               setBlockRaw(x+w-1,y,z,5);
  setBlockRaw(x,y,z+d-1,5);           setBlockRaw(x+w-1,y,z+d-1,5);
}
/* 椅子: 木板座 + 靠背, face 为面朝方向 */
function fxChair(x,y,z,face){
  setBlockRaw(x,y,z,6);
  if(face==='n') setBlockRaw(x,y+1,z+1,6);
  if(face==='s') setBlockRaw(x,y+1,z-1,6);
  if(face==='e') setBlockRaw(x-1,y+1,z,6);
  if(face==='w') setBlockRaw(x+1,y+1,z,6);
}
/* 电视: 落地支架 + 履带屏幕 2 高, alongX 屏幕沿 x 还是 z 展开 */
function fxTV(x,y,z,w,alongX){
  for(let i=0;i<w;i++){
    const sx = alongX ? x+i : x, sz = alongX ? z : z+i;
    setBlockRaw(sx,y-1,sz,6);          // 落地支架
    setBlockRaw(sx,y,sz,11);           // 屏幕
    setBlockRaw(sx,y+1,sz,11);
  }
}
/* 书架: w 宽 h 高, 彩色羊毛当"书", 木板收顶 */
function fxShelf(x,y,z,w,h,alongX){
  for(let i=0;i<w;i++)
    for(let j=0;j<h;j++){
      const sx = alongX ? x+i : x, sz = alongX ? z : z+i;
      if(j===h-1) setBlockRaw(sx,y+j,sz,6);
      else setBlockRaw(sx,y+j,sz, i%3===0 ? 16 : (i%3===1 ? 15 : 6));
    }
}
/* 衣柜: 石英柜身 2 高 + 木头顶柜 */
function fxWardrobe(x,y,z,w,alongX){
  for(let i=0;i<w;i++){
    const sx = alongX ? x+i : x, sz = alongX ? z : z+i;
    setBlockRaw(sx,y,sz,17); setBlockRaw(sx,y+1,sz,17); setBlockRaw(sx,y+2,sz,6);
  }
}
/* 床头柜 + 台灯 */
function fxNightstand(x,y,z){ setBlockRaw(x,y,z,5); setBlockRaw(x,y+1,z,19); }
/* 路灯柱: 木杆 ×2 + 灯块 */
function fxLampPost(x,y,z){ setBlockRaw(x,y,z,5); setBlockRaw(x,y+1,z,5); setBlockRaw(x,y+2,z,19); }
/* 平地毯: 把地面顶层方块替换成羊毛(与地面齐平, 可自由踩踏) */
function fxCarpet(x1,z1,x2,z2,y,id){ fillB(x1,y,z1,x2,y,z2,id); }

/* 平坦草原: 顶 y=grassY 草地, 下 4 层泥土, 其下石头; 保护区内不种树 */
function buildGrassField(grassY, px1, pz1, px2, pz2){
  for(let x=0;x<WORLD_W;x++){
    for(let z=0;z<WORLD_D;z++){
      for(let y=0;y<=grassY-5;y++) setBlockRaw(x,y,z,3);
      for(let y=grassY-4;y<grassY;y++) setBlockRaw(x,y,z,2);
      setBlockRaw(x,grassY,z,1);
      if((x<px1||x>px2||z<pz1||z>pz2) && hashRand(x+53,z+91) > 0.988)
        plantTree(x, grassY+1, z);
    }
  }
}

/* ============================================================
   场景一: 二层小楼房 (地表 y20)
============================================================ */
function buildHouseScene(){
  const G = 20;
  buildGrassField(G, 52, 54, 74, 72);
  const x1=55, x2=71, z1=57, z2=69;            // 外墙范围

  /* 地基与地面 */
  fillB(x1,G,z1,x2,G,z2,4);                    // 圆石基座
  fillB(x1+1,G,z1+1,x2-1,G,z2-1,6);            // 室内木地板(与草地齐平)

  /* 两层墙体: 木板 + 四角木柱 */
  for(const ya of [21,26]){
    fillB(x1,ya,z1,x2,ya,z1,6); fillB(x1,ya,z2,x2,ya,z2,6);
    fillB(x1,ya,z1,x1,ya,z2,6); fillB(x2,ya,z1,x2,ya,z2,6);
  }
  for(const c of [[x1,z1],[x2,z1],[x1,z2],[x2,z2]])
    fillB(c[0],21,c[1],c[0],29,c[1],5);        // 角柱贯通两层

  /* 窗户 (玻璃 2 高) */
  const win = (x,y,z,alongX,w)=>{
    for(let i=0;i<w;i++){
      const sx = alongX ? x+i : x, sz = alongX ? z : z+i;
      setBlockRaw(sx,y,sz,18); setBlockRaw(sx,y+1,sz,18);
    }
  };
  for(const ya of [22,27]){
    win(57,ya,z1,true,3);  win(66,ya,z1,true,3);           // 北墙
    win(57,ya,z2,true,2);  win(67,ya,z2,true,2);           // 南墙(避开门)
    win(x1,ya,61,false,3); win(x2,ya,61,false,3);          // 东西墙
  }
  fillB(62,21,z2,63,22,z2,0);                  // 南侧大门门洞

  /* 一层顶楼板 y25 + 楼梯口 (东侧 x67..69, z61..63) */
  fillB(x1,25,z1,x2,25,z2,6);
  fillB(67,25,61,69,25,63,0);
  /* 室内楼梯: 4 级向北爬升到楼板 */
  for(let i=0;i<4;i++) fillB(67,21+i,64-i,69,21+i,64-i,6);
  for(let z=61;z<=65;z++) setBlockRaw(66,26,z,18);   // 楼梯口玻璃护栏

  /* 人字坡屋顶 (红砖) + 山墙 + 烟囱 */
  for(let z=z1-1; z<=z2+1; z++){
    const h = 30 + Math.min(z-(z1-1), (z2+1)-z);
    fillB(x1-1,h,z,x2+1,h,z,9);
    for(let y=30;y<h;y++){ setBlockRaw(x1,y,z,6); setBlockRaw(x2,y,z,6); }
  }
  fillB(57,30,60,57,35,60,13); setBlockRaw(57,36,60,19);   // 烟囱

  /* ---- 一层: 客厅(西) + 厨房(东) ---- */
  fxCarpet(57,60,62,64,G,16);                  // 红色客厅地毯(嵌入地面)
  fxSofa(58,21,64,4,'n',15);                   // 蓝沙发面朝电视
  fxTable(59,21,61,2,2,17);                    // 石英茶几
  fxTV(58,22,58,4,true);                       // 电视挂北墙
  fxShelf(56,21,60,3,3,false);                 // 西墙书架
  fillB(70,21,58,70,21,64,12);                 // 厨台(金属)
  setBlockRaw(70,21,59,11); setBlockRaw(70,21,62,17);      // 灶台/水槽
  fillB(70,21,66,70,22,67,17);                 // 冰箱(石英)
  fxTable(65,21,63,3,2,6);                     // 餐桌
  fxChair(65,21,61,'n'); fxChair(67,21,61,'n');
  fxChair(65,21,66,'s'); fxChair(67,21,66,'s');
  for(const l of [[59,61],[66,61],[59,66],[66,66]])
    setBlockRaw(l[0],25,l[1],19);              // 一层吸顶灯
  fxCarpet(62,70,63,73,G,4);                   // 门外圆石小径
  fxLampPost(60,21,71);                        // 门廊路灯

  /* ---- 二层: 主卧(西) + 儿童房(东) ---- */
  fillB(65,26,58,65,27,62,6);                  // 隔断墙(南侧留门)
  fxBed(57,26,61,'z',16); fxBed(58,26,61,'z',16);          // 双人床(红)
  fxNightstand(56,26,61); fxNightstand(59,26,61);
  fxWardrobe(56,26,66,3,true);                 // 衣柜
  fxCarpet(57,62,63,66,25,15);                 // 卧室地毯(嵌入楼板)
  fxBed(67,26,58,'z',15);                      // 儿童床(蓝,避让楼梯口)
  fxTable(68,26,63,2,1,6);                     // 书桌
  fxChair(68,26,64,'n');
  fxShelf(70,26,66,3,false);                   // 玩具架
  for(const l of [[x1,61],[x1,65],[x2,61],[x2,65]])
    setBlockRaw(l[0],28,l[1],19);              // 二层壁灯
}

/* ============================================================
   场景二: 巨大地下室 (地表 y24 · 大厅立足层 y18)
============================================================ */
function buildBasementScene(){
  const G = 24;
  buildGrassField(G, 42, 42, 86, 86);

  /* ---- 地下大厅: 42×34 石砖壳, 内部 40×32 × 高5 ---- */
  const x1=43, x2=84, z1=43, z2=76;
  fillB(x1,17,z1,x2,23,z2,13);                 // 石砖整块
  fillB(x1+1,18,z1+1,x2-1,22,z2-1,0);          // 掏空内部 (y18..22)
  fillB(56,17,50,73,17,63,6);                  // 客厅区木地板(嵌入)

  /* 立柱 + 吊灯 + 壁灯 */
  for(const p of [[52,46],[52,64],[52,72],[60,46],[60,72],[76,46],[76,64],[76,72]])
    fillB(p[0],18,p[1],p[0],22,p[1],4);
  for(const lx of [48,56,64,72,80])
    for(const lz of [48,58,68]) setBlockRaw(lx,23,lz,19);
  for(const w of [[43,50],[43,62],[84,50],[84,62],[50,43],[64,43],[75,43]])
    setBlockRaw(w[0],20,w[1],19);

  /* ---- 地表入口小屋 (红砖) ---- */
  fillB(62,25,80,66,27,84,9);
  fillB(63,25,81,65,27,83,0);
  fillB(62,28,80,66,28,84,6);                  // 木板顶
  setBlockRaw(64,28,82,19);
  fillB(63,25,84,64,26,84,0);                  // 南门洞

  /* ---- 下行阶梯隧道: 7 级台阶 y24→y18 直通大厅 ---- */
  for(let i=0;i<=6;i++){
    const z=80-i, sY=23-i, cT=sY+4;
    fillB(63,12,z,64,sY,z,13);                 // 台阶及基座
    fillB(63,sY+1,z,64,cT,z,0);                // 头顶净空
    const wallTop = Math.min(cT, 24);          // 近地表处与草地齐平
    fillB(62,12,z,62,wallTop,z,13);            // 侧墙
    fillB(65,12,z,65,wallTop,z,13);
    if(i%3===1){ setBlockRaw(62,sY+2,z,19); setBlockRaw(65,sY+2,z,19); }  // 阶梯壁灯
  }

  /* ---- 客厅区 (西) ---- */
  fxCarpet(45,53,52,61,17,16);                 // 红地毯
  fxTV(44,19,54,4,false);                      // 大电视靠西墙
  fxSofa(48,18,54,4,'w',15);                   // 主沙发
  fxSofa(46,18,60,3,'n',15);                   // L 型副沙发
  fxSofa(48,18,58,1,'w',15);
  fxTable(46,18,55,2,2,17);                    // 茶几

  /* ---- 卧室区 (东北角) ---- */
  fxCarpet(77,45,82,50,17,15);
  fxBed(78,18,46,'z',16); fxBed(80,18,46,'z',15);
  fxNightstand(77,18,46); fxNightstand(81,18,46);
  fxWardrobe(78,18,44,3,true);

  /* ---- 厨房 + 餐厅 (东南) ---- */
  fillB(50,18,74,62,18,74,12);                 // 厨台
  setBlockRaw(54,18,74,11); setBlockRaw(58,18,74,17);
  fillB(63,18,74,63,19,74,17);                 // 冰箱
  fxTable(53,18,67,3,3,6);                     // 大餐桌
  fxChair(52,18,67,'e'); fxChair(56,18,67,'w');
  fxChair(52,18,69,'e'); fxChair(56,18,69,'w');
  fxChair(53,18,70,'n'); fxChair(55,18,70,'n');

  /* ---- 书房区 (西北) ---- */
  fxShelf(45,18,44,3,3,true); fxShelf(49,18,44,3,3,true);
  fxTable(45,18,47,2,1,17); fxChair(45,18,48,'n');
  fxTable(49,18,47,2,1,17); fxChair(49,18,48,'n');
  setBlockRaw(46,20,47,19);                    // 桌上台灯

  /* ---- 中央游戏区: 8×8 棋盘 + 观棋座 ---- */
  for(let i=0;i<8;i++)
    for(let j=0;j<8;j++)
      setBlockRaw(62+i,17,66+j, (i+j)%2 ? 15 : 16);
  for(const s of [[61,67],[70,67],[61,72],[70,72]]) setBlockRaw(s[0],18,s[1],5);
  fxLampPost(45,18,72); fxLampPost(82,18,44);
}

/* ============================================================
   场景注册 / 存档
============================================================ */
const BUILD_SCENES = [
  { id:'basement', name:'巨大地下室', icon:'🕳️',
    desc:'40×32 超大地下大厅<br>客厅·卧室·厨房·书房·棋盘室',
    spawn:{x:65.5, y:18, z:69.5, yaw:0},
    build: buildBasementScene },
  { id:'house', name:'二层小楼房', icon:'🏡',
    desc:'带院子的小家<br>一层客厅厨房 · 二层两间卧室',
    spawn:{x:63.5, y:21, z:66.5, yaw:0},
    build: buildHouseScene }
];
function buildSpawnAt(sc){
  pos.set(sc.spawn.x, sc.spawn.y, sc.spawn.z);
  vel.set(0,0,0); yaw = sc.spawn.yaw; pitch = 0;
  flyMode = false;
}

/* 存档: 当前场景 + 各场景改动表 (跨设备云同步) */
function buildSaveNow(){
  const edits = {};
  for(const id in buildEdits) edits[id] = [...buildEdits[id].entries()];
  try{
    SyncDB.set(BUILD_SAVE_KEY, JSON.stringify({scene:buildSceneId, edits}));
  }catch(e){}
  buildDirty = false;
}
function buildLoadSave(){
  try{
    const s = JSON.parse(SyncDB.get(BUILD_SAVE_KEY));
    if(s && s.edits){
      for(const id in s.edits) buildEdits[id] = new Map(s.edits[id]);
      return s.scene || null;
    }
  }catch(e){}
  return null;
}

/* 加载场景: 生成 → 应用玩家改动 → 重建 → 出生 */
function buildLoadScene(id){
  const sc = BUILD_SCENES.find(s=>s.id===id) || BUILD_SCENES[0];
  buildSceneId = sc.id;
  if(!buildEdits[sc.id]) buildEdits[sc.id] = new Map();
  clearWorld();
  sc.build();
  for(const [k,v] of buildEdits[sc.id]){
    const p = k.split(',');
    setBlockRaw(+p[0], +p[1], +p[2], v);
  }
  rebuildAll();
  buildSpawnAt(sc.spawn);
  buildDirty = true;                            // 记住当前场景
}
function buildResetScene(){
  buildEdits[buildSceneId].clear();
  const sc = BUILD_SCENES.find(s=>s.id===buildSceneId);
  clearWorld(); sc.build(); rebuildAll(); buildSpawnAt(sc.spawn);
  buildDirty = true;
  buildSaveNow();
  showToast('已重置「' + sc.name + '」', 2000);
}

/* ---------- 物品栏 ---------- */
const buildHotbarEl = document.getElementById('hotbar');
function buildHotbarUI(){
  buildHotbarEl.innerHTML = '';
  buildHotbarEl.classList.add('build');
  BUILD_PALETTE.forEach((id,i)=>{
    const b = BLOCKS[id];
    const col = (b.all||b.side);
    const div = document.createElement('div');
    div.className='slot';
    div.innerHTML = `<span class="num">${i+1<=9?i+1:''}</span>
      <div class="cube" style="background:rgb(${col.map(c=>Math.round(c*255)).join(',')})"></div>
      <span class="lbl">${b.name}</span>`;
    div.addEventListener('pointerdown',(ev)=>{ ev.preventDefault(); buildSel=i; buildHotbarSel(); });
    buildHotbarEl.appendChild(div);
  });
  buildHotbarSel();
}
function buildHotbarSel(){
  [...buildHotbarEl.children].forEach((el,i)=> el.classList.toggle('active', i===buildSel));
}

/* ---------- 场景选择页 ---------- */
function buildSceneMenu(){
  const grid = document.getElementById('buildScenes');
  grid.innerHTML = '';
  BUILD_SCENES.forEach(sc=>{
    const div = document.createElement('div');
    div.className = 'sceneCard' + (sc.id===buildSceneId ? ' active' : '');
    div.innerHTML = `<div class="big">${sc.icon}</div><h2>${sc.name}</h2><small>${sc.desc}</small>`;
    div.onclick = ()=>{
      if(buildSceneId !== sc.id){ buildLoadScene(sc.id); buildSaveNow(); }
      requestLock();
    };
    grid.appendChild(div);
  });
  const enter = document.getElementById('buildEnterBtn');
  if(enter) enter.onclick = ()=> requestLock();
}

/* ---------- 模式对象 ---------- */
const buildHudEl = document.getElementById('hud');
const BuildMode = {
  id:'build',
  init(){
    if(!buildSceneId) buildSceneId = buildLoadSave() || BUILD_SCENES[0].id;
    buildLoadScene(buildSceneId);
    buildHotbarUI();
    buildSceneMenu();
    document.getElementById('score').style.display = 'none';
    buildHotbarEl.style.display = 'flex';
    setTouchActions([
      {label:'⬆️', hold:'Space'},
      {label:'⬇️', hold:'ShiftLeft'},
      {label:'✈️', act:()=>BuildMode.onKey('KeyF')},
      {label:'⛏️', act:()=>doCenterClick(0)},
      {label:'🧱', act:()=>doCenterClick(2)}
    ]);
  },
  cleanup(){
    buildSaveNow();
    flyMode = false;
    buildHotbarEl.classList.remove('build');
    buildHotbarEl.style.display = 'none';
  },
  buildMenu(){ buildSceneMenu(); },            // 打开菜单页时刷新高亮
  update(){
    if(buildDirty && performance.now() - buildSaveT > 5000){
      buildSaveT = performance.now(); buildSaveNow();
    }
  },
  onKey(code){
    if(code==='KeyF'){
      flyMode = !flyMode; vel.y = 0;
      showToast(flyMode ? '✈️ 飞行开启：空格上升 · Shift 下降' : '🚶 飞行关闭', 2200);
    }
    if(code==='KeyR') buildResetScene();
    if(code==='KeyB') uiPause();
  },
  onDigit(n){
    if(n>=1 && n<=Math.min(9, BUILD_PALETTE.length)){ buildSel = n-1; buildHotbarSel(); }
  },
  onWheel(d){
    buildSel = (buildSel + d + BUILD_PALETTE.length) % BUILD_PALETTE.length;
    buildHotbarSel();
  },
  onMouse(button, hit){
    if(!hit) return;
    let x, y, z, id;
    if(button === 0){                                   // 挖
      x=hit.x; y=hit.y; z=hit.z; id=0;
    } else if(button === 2){                            // 放
      x=hit.x+hit.nx; y=hit.y+hit.ny; z=hit.z+hit.nz;
      if(getBlock(x,y,z)!==0) return;
      if(collidesAtPlayer(x,y,z)) return;
      id = BUILD_PALETTE[buildSel];
    } else return;
    editBlock(x,y,z,id);
    buildEdits[buildSceneId].set(key(x,y,z), id);       // 记录改动供存档
    buildDirty = true;
  },
  onVoidFall(){
    const sc = BUILD_SCENES.find(s=>s.id===buildSceneId);
    if(sc) buildSpawnAt(sc.spawn);
  },
  updateHud(){
    const sc = BUILD_SCENES.find(s=>s.id===buildSceneId);
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const hit = raycastVoxel(camera.position, dir, 6);
    let target = '无';
    if(hit){ const id=getBlock(hit.x,hit.y,hit.z); target = BLOCKS[id]?BLOCKS[id].name:'?'; }
    buildHudEl.innerHTML =
      `场景: ${sc?sc.name:'-'} · 已建造 ${buildEdits[buildSceneId].size} 块<br>`+
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}<br>`+
      `FPS: ${fps}${flyMode?' · <b>✈️ 飞行中</b>':''}<br>`+
      `手持: ${BLOCKS[BUILD_PALETTE[buildSel]].name} · 注视: ${target}<br>`+
      `F 飞行 · R 重置场景 · B 菜单`;
  }
};

