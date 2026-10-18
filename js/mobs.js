"use strict";
/* ============================================================
   怪物库 (Mobs, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   全游戏唯一的怪物实体模块(竞技场与坦克演习场共用):
   · 建模: MOB_RIG 骨架注册表 → (类型×关节槽) InstancedMesh 合批渲染
   · 数值: config.js 的 MOB_TYPES(血量/速度/身高/碰撞半径/旗标)
   · 本能: 血量/受击(闪白·踉跄·击退)/死亡(倒地沉没)/游荡(wander 可关)
   interface: spawn / update / render / hit / near / clear /
              list / face / hasSlot / types
   玩法(战斗AI/阵营/晋升/表扬话术)在模式层; 模式可在 spawn 返回的
   mob 上挂私有字段(tierNode/tierGeos 等挂件, dispose 时若存在一并回收)。
   实例数组归本模块私有: list() 返回内部引用(只读约定),
   clear() 原地清空并冲刷批次, 引用保持稳定(竞技场的 mobs 别名长期有效)。
   THREE/DOM 全部惰性创建: 引导桩与 Node 测试环境可安全加载本文件。
   ============================================================ */
const Mobs = (() => {
  const mobList = [];
  let mobId = 0;
  const LABEL_CULL_D = 64;                 // 名牌相机距离剔除(格): 远处名牌本就小到难读
  const LABEL_CULL_D2 = LABEL_CULL_D * LABEL_CULL_D;

  /* ---------- 建模: 骨架注册表 ----------
     slot = {joint:[枢轴], axis:'x'|'z', boxes:[部件]}
     部件 = B(宽,高,深, 颜色hex, x,y,z 偏移, 可选绕X预旋)
     —— 尺寸/偏移/枢轴与竞技场旧 build* 函数逐字一致, 视觉不变 */
  function B(w,h,d,hex,x,y,z,rx){ return {w,h,d,hex,x,y,z,rx}; }
  const MOB_RIG = (()=>{
    const SKIN=0x5e9440, SHIRT=0x2e7a70, PANTS=0x4a3f70, DARKZ=0x1c2b16;
    const BONE=0xd8d8d2, BONE2=0xb8b8b0, DARKS=0x1a1a1a, WOOD=0x6b4a2a;
    const GREEN=0x4fae4f, GREEN2=0x3d8f3d, DARKC=0x101510;
    const IRON=0xcdd0d8, IRON2=0xaab0bb, DARKG=0x555a63, EYEG=0xff2a1a;
    const BODY=0x16161f, DARKD=0x262633, MEMB=0x3a2055, EYED=0xd06bff;
    return {
      zombie: { slots: {
        root: { joint:[0,0,0], boxes:[ B(0.5,0.75,0.26,SHIRT, 0,1.12,0) ] },
        legL: { joint:[-0.13,0.75,0], boxes:[ B(0.24,0.75,0.24,PANTS, 0,-0.375,0) ] },
        legR: { joint:[ 0.13,0.75,0], boxes:[ B(0.24,0.75,0.24,PANTS, 0,-0.375,0) ] },
        armL: { joint:[-0.37,1.42,0], boxes:[ B(0.2,0.72,0.2,SKIN, 0,-0.34,0) ] },
        armR: { joint:[ 0.37,1.42,0], boxes:[ B(0.2,0.72,0.2,SKIN, 0,-0.34,0) ] },
        head: { joint:[0,1.5,0], boxes:[
          B(0.5,0.5,0.5,SKIN, 0,0.25,0),
          B(0.1,0.08,0.04,DARKZ, -0.12,0.3,0.26), B(0.1,0.08,0.04,DARKZ, 0.12,0.3,0.26) ] },
      }},
      skeleton: { slots: {
        root: { joint:[0,0,0], boxes:[ B(0.5,0.72,0.24,BONE, 0,1.11,0) ] },
        legL: { joint:[-0.1,0.75,0], boxes:[ B(0.16,0.75,0.16,BONE2, 0,-0.375,0) ] },
        legR: { joint:[ 0.1,0.75,0], boxes:[ B(0.16,0.75,0.16,BONE2, 0,-0.375,0) ] },
        armL: { joint:[-0.34,1.4,0], boxes:[ B(0.16,0.72,0.16,BONE, 0,-0.34,0),
          B(0.07,0.6,0.09,WOOD, 0,-0.72,0.1) ] },                        // 弓
        armR: { joint:[ 0.34,1.4,0], boxes:[ B(0.16,0.72,0.16,BONE, 0,-0.34,0) ] },
        head: { joint:[0,1.47,0], boxes:[
          B(0.5,0.5,0.5,BONE, 0,0.25,0),
          B(0.12,0.1,0.04,DARKS, -0.12,0.3,0.26), B(0.12,0.1,0.04,DARKS, 0.12,0.3,0.26),
          B(0.08,0.08,0.04,DARKS, 0,0.18,0.26) ] },
      }},
      creeper: { slots: {
        root: { joint:[0,0,0], boxes:[ B(0.44,0.9,0.3,GREEN, 0,0.85,0) ] },
        legL: { joint:[0,0.42,0], boxes:[                                // 对角腿对
          B(0.26,0.42,0.28,GREEN2, -0.14,-0.21, 0.18), B(0.26,0.42,0.28,GREEN2, 0.14,-0.21,-0.18) ] },
        legR: { joint:[0,0.42,0], boxes:[
          B(0.26,0.42,0.28,GREEN2,  0.14,-0.21, 0.18), B(0.26,0.42,0.28,GREEN2, -0.14,-0.21,-0.18) ] },
        head: { joint:[0,1.28,0], boxes:[
          B(0.5,0.5,0.5,GREEN, 0,0.25,0),
          B(0.12,0.12,0.05,DARKC, -0.13,0.32,0.26), B(0.12,0.12,0.05,DARKC, 0.13,0.32,0.26),
          B(0.26,0.1,0.05,DARKC, 0,0.13,0.26), B(0.1,0.16,0.05,DARKC, 0,0.05,0.26) ] },
      }},
      golem: { slots: {
        root: { joint:[0,0,0], boxes:[ B(1.35,1.5,0.85,IRON, 0,1.6,0) ] },
        legL: { joint:[-0.34,0.85,0], boxes:[ B(0.5,0.85,0.5,IRON2, 0,-0.425,0) ] },
        legR: { joint:[ 0.34,0.85,0], boxes:[ B(0.5,0.85,0.5,IRON2, 0,-0.425,0) ] },
        armL: { joint:[-0.87,2.28,0], boxes:[ B(0.45,1.55,0.45,IRON, 0,-0.775,0) ] },
        armR: { joint:[ 0.87,2.28,0], boxes:[ B(0.45,1.55,0.45,IRON, 0,-0.775,0) ] },
        head: { joint:[0,2.35,0], boxes:[
          B(0.72,0.66,0.72,IRON, 0,0.35,0),
          B(0.16,0.34,0.16,DARKG, 0,0.28,0.42),
          B(0.13,0.09,0.05,EYEG, -0.17,0.44,0.37), B(0.13,0.09,0.05,EYEG, 0.17,0.44,0.37) ] },
      }},
      dragon: { slots: {
        root: { joint:[0,0,0], boxes:[                                 // 躯干+腹板+颈(预旋)+尾三节+后腿
          B(1.7,1.3,3.4,BODY, 0,1.15,0), B(1.5,0.35,3.0,DARKD, 0,0.45,0),
          B(0.75,0.75,1.7,BODY, 0,1.5,2.3, 0.25),
          B(0.95,0.85,1.5,BODY, 0,1.15,-2.3), B(0.7,0.6,1.4,DARKD, 0,1.2,-3.5),
          B(0.45,0.4,1.3,DARKD, 0,1.25,-4.6),
          B(0.32,1.0,0.45,DARKD, -0.55,0.25,-1.1), B(0.32,1.0,0.45,DARKD, 0.55,0.25,-1.1) ] },
        head: { joint:[0,1.85,3.3], boxes:[
          B(0.95,0.85,1.2,BODY, 0,0,0), B(0.6,0.45,0.7,DARKD, 0,-0.12,0.9),
          B(0.14,0.12,0.1,EYED, -0.32,0.18,0.35), B(0.14,0.12,0.1,EYED, 0.32,0.18,0.35),
          B(0.16,0.55,0.16,DARKD, -0.3,0.6,-0.35), B(0.16,0.55,0.16,DARKD, 0.3,0.6,-0.35) ] },
        wingL: { joint:[-0.85,1.75,0.2], axis:'z', boxes:[
          B(3.2,0.12,2.2,MEMB, -1.6,0,0), B(1.8,0.1,1.4,MEMB, -3.9,-0.05,-0.2) ] },
        wingR: { joint:[ 0.85,1.75,0.2], axis:'z', boxes:[
          B(3.2,0.12,2.2,MEMB,  1.6,0,0), B(1.8,0.1,1.4,MEMB,  3.9,-0.05,-0.2) ] },
      }},
    };
  })();

  /* 槽部件盒子合并为一份带顶点色的几何(逐槽一份, 全类型共享材质) */
  function buildRigGeo(boxes){
    const positions=[], normals=[], colors=[], indices=[];
    let n = 0;
    for(const b of boxes){
      const g = new THREE.BoxGeometry(b.w,b.h,b.d);
      if(b.rx) g.rotateX(b.rx);
      g.translate(b.x, b.y, b.z);
      const pos = g.attributes.position, nor = g.attributes.normal, idx = g.index;
      const c = new THREE.Color(b.hex);          // hex → 线性 [r,g,b](与旧 setHex 同口径, r128 无色彩管理)
      for(let i=0;i<pos.count;i++){
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        colors.push(c.r, c.g, c.b);
      }
      for(let i=0;i<idx.count;i++) indices.push(idx.getX(i)+n);
      n += pos.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors,3));
    geo.setIndex(indices);
    return geo;
  }

  /* ---------- 批次管理: (类型×槽) → InstancedMesh, 容量按需翻倍(矩阵每帧
     全量重写, 扩容无需搬运); 空批次 count=0 不产生绘制 ---------- */
  let mobMat = null;                             // 惰性创建: 引导桩环境不建材质
  const mobBatches = [];
  function getMobBatch(slot){
    let b = slot.batch;
    if(b) return b;
    if(!mobMat) mobMat = new THREE.MeshLambertMaterial({vertexColors:true});
    if(!slot.geo) slot.geo = buildRigGeo(slot.boxes);
    const mesh = new THREE.InstancedMesh(slot.geo, mobMat, 16);
    mesh.frustumCulled = false;                  // 实例散布全场, 按几何包围球剔除会误裁
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _tintCol.setRGB(1,1,1));  // 预建 instanceColor, 避免首次着色才编译变体
    scene.add(mesh);
    b = { mesh, cap:16, n:0 };
    slot.batch = b;
    mobBatches.push(b);
    return b;
  }
  function growMobBatch(b, need){
    let cap = b.cap;
    while(cap < need) cap *= 2;
    scene.remove(b.mesh);
    if(b.mesh.dispose) b.mesh.dispose();         // 几何/材质共享不在此动
    const mesh = new THREE.InstancedMesh(b.mesh.geometry, mobMat, cap);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _tintCol.setRGB(1,1,1));
    scene.add(mesh);
    b.mesh = mesh; b.cap = cap;
  }

  /* 每帧把存活怪的各槽实例矩阵/颜色写入批次(密集重排, 无空闲表):
     位姿 = 位置(yaw/tilt) × 关节角(pose) × 体型(drawScale), 着色 = tint */
  const _wm=new THREE.Matrix4(), _jm=new THREE.Matrix4(), _im=new THREE.Matrix4();
  const _wq=new THREE.Quaternion(), _jq=new THREE.Quaternion(), _we=new THREE.Euler();
  const _wp=new THREE.Vector3(), _jp=new THREE.Vector3(), _ws=new THREE.Vector3();
  const _one=new THREE.Vector3(1,1,1);
  const _axisX=new THREE.Vector3(1,0,0), _axisZ=new THREE.Vector3(0,0,1);
  const _tintCol=new THREE.Color();

  function render(){
    for(const b of mobBatches) b.n = 0;          // 也覆盖清场后: count 归零, 残余实例不再绘制
    for(const m of mobList){
      if(m.gone) continue;
      if(m.dead && m.deadT > 2.2){               // 原 visible=false 的隐藏期
        if(m.tierNode) m.tierNode.visible = false;   // 挂件随尸体一起隐去
        continue;
      }
      const rig = MOB_RIG[m.type];
      const s = m.drawScale;
      const sink = (m.dead && m.deadT > 0.8)
        ? Math.min(1,(m.deadT-0.8)/1.4)*1.3 : 0; // 原"透明淡出"的实例化等价: 下沉入地
      _we.set(0, m.yaw, m.deadTilt);             // Euler(0,yaw,tilt) 默认序 = Ry·Rz, 与旧 group 一致
      _wq.setFromEuler(_we);
      _wm.compose(_wp.set(m.pos.x, m.pos.y - sink, m.pos.z), _wq, _ws.set(s,s,s));
      for(const name in rig.slots){
        const slot = rig.slots[name];
        const b = getMobBatch(slot);
        if(b.n >= b.cap) growMobBatch(b, b.n+1);
        _jq.setFromAxisAngle(slot.axis==='z' ? _axisZ : _axisX, name==='root' ? 0 : (m.pose[name]||0));
        _jm.compose(_jp.fromArray(slot.joint), _jq, _one);
        _im.multiplyMatrices(_wm, _jm);
        b.mesh.setMatrixAt(b.n, _im);
        b.mesh.setColorAt(b.n, _tintCol.setRGB(m.tr, m.tg, m.tb));
        b.n++;
      }
      if(m.tierNode){                            // 阶级挂件(稀有, 普通 mesh)对齐实例位姿
        m.tierNode.visible = true;
        m.tierNode.position.set(m.pos.x, m.pos.y - sink, m.pos.z);
        m.tierNode.rotation.set(0, m.yaw, m.deadTilt);
        m.tierNode.scale.setScalar(s);
      }
    }
    for(const b of mobBatches){
      b.mesh.count = b.n;
      if(b.n > 0){
        b.mesh.instanceMatrix.needsUpdate = true;
        if(b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /* ---------- 名牌: 阵营前缀/颜色由调用方给(竞技场红蓝, 演习场无前缀) ---------- */
  function drawLabel(m){
    const g = m.labelCanvas.getContext('2d');
    g.clearRect(0,0,160,40);
    g.font='bold 15px sans-serif';
    g.shadowColor='#000'; g.shadowBlur=4;
    const pre = m.labelCfg ? m.labelCfg.prefix : '';
    const col = m.labelCfg ? m.labelCfg.color : '#ffd44d';
    const full = pre + m.cfg.name + (m.level>1?'★'.repeat(m.level-1):'');
    if(m.dead){
      g.textAlign='center'; g.fillStyle='#9a9a9a'; g.fillText(full, 80, 15);
    } else if(m.level>1){
      const wPre = g.measureText(pre).width, wFull = g.measureText(full).width;
      const x0 = 80 - wFull/2;
      g.textAlign='left';
      g.fillStyle = col;                             // 前缀保持调用方色
      g.fillText(pre, x0, 15);
      g.fillStyle = '#ffd44d';                       // 晋升金光
      g.shadowColor='#ffb018'; g.shadowBlur=8;
      g.fillText(full.slice(pre.length), x0+wPre, 15);
    } else {
      g.textAlign='center'; g.fillStyle = col;
      g.fillText(full, 80, 15);
    }
    g.shadowBlur = 0;
    g.fillStyle='rgba(0,0,0,.65)'; g.fillRect(30,22,100,10);
    const r = Math.max(0, m.hp/m.maxHp);
    g.fillStyle = r>0.5 ? '#48d848' : (r>0.25 ? '#e8c030' : '#e04030');
    g.fillRect(32,24,96*r,6);
    m.labelTex.needsUpdate = true;
  }

  function dispose(m){
    if(m.label){
      scene.remove(m.label);
      m.label.material.map.dispose(); m.label.material.dispose();
    }
    if(m.tierNode) scene.remove(m.tierNode);    // 模式挂件(竞技场阶级光环等, 稀有物)
    if(m.tierGeos) m.tierGeos.forEach(g=>g.dispose());
    if(m.tierMats) m.tierMats.forEach(mt=>mt.dispose());
  }

  /* ---------- 生命周期 ---------- */
  function spawn(type, x, z, opts){
    opts = opts || {};
    const cfg = MOB_TYPES[type];
    const gy = groundTop(Math.floor(x), Math.floor(z)) + 1;
    const m = {
      id: mobId++, type, cfg,
      labelCfg: opts.label || null,
      pose:{legL:0,legR:0,armL:0,armR:0,head:0,wingL:0,wingR:0},  // 关节角(弧度), render 组实例矩阵
      drawScale:1, deadTilt:0,                       // 体型(挂件缩放/引信膨胀) 与 倒地角
      tr:1, tg:1, tb:1, tintBase:[1,1,1],            // instanceColor 着色(闪白/狂暴等持久色)
      pos:(typeof THREE !== 'undefined')
      ? new THREE.Vector3(x, cfg.fly ? (opts.flyY !== undefined ? opts.flyY : gy + 6) : gy, z)
      : { x, y: cfg.fly ? (opts.flyY !== undefined ? opts.flyY : gy + 6) : gy, z },
      yaw: opts.yaw || 0,
      hp:cfg.hp, maxHp:cfg.hp, dead:false, deadT:0, gone:false,
      flashT:0, staggerT:0,
      walkPhase:Math.random()*6, speedNow:0, flyPhase:Math.random()*6,
      wander: opts.wander || null,                   // 游荡配置(栅栏), 无则站立/由模式驱动
      wanderT:0, wanderDir:Math.random()*Math.PI*2,
      clamp: opts.clamp || null,                     // 飞行单位击退后的边界约束(竞技场圆形)
      tierNode:null, tierGeos:[], tierMats:[],       // 模式挂件位(dispose 一并回收)
      lastLabelHp:-1, lastLabelDead:false, labelT:0
    };
    if(opts.hpMult){ m.hp = m.maxHp = Math.round(cfg.hp * opts.hpMult); }
    if(typeof document !== 'undefined' && typeof THREE !== 'undefined'){
      const lc = document.createElement('canvas'); lc.width=160; lc.height=40;
      const ltex = new THREE.CanvasTexture(lc);
      m.label = new THREE.Sprite(new THREE.SpriteMaterial({map:ltex, transparent:true, depthTest:false}));
      m.label.scale.set(2.6, 0.65, 1);
      m.labelCanvas = lc; m.labelTex = ltex;
      scene.add(m.label);
      drawLabel(m);
    }
    mobList.push(m);
    return m;
  }

  /* 通用本能(每帧, 模式战斗逻辑之前调):
     名牌剔除/跟随 · 血条节流重绘 · 受击闪白与踉跄计时 · 着色
     死亡动画(倒地/坠落/下沉) · 游荡移动(配置了 wander 的怪)
     尸体与残骸回收(gone 或 deadT>2.4) */
  function update(dt){
    for(const m of mobList){
      if(m.gone) continue;
      const gp = m.pos;
      if(m.label){
        const ldx = gp.x - camera.position.x, ldz = gp.z - camera.position.z;
        m.label.visible = (ldx*ldx + ldz*ldz) < LABEL_CULL_D2;
        if(m.label.visible) m.label.position.set(gp.x, gp.y + m.cfg.h + 0.55, gp.z);
      }
      if(m.dead){
        m.deadT += dt;
        if(m.cfg.fly){                               // 飞行单位死亡坠落
          const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
          if(gp.y > gy) gp.y = Math.max(gy, gp.y - 16*dt);
        }
        m.deadTilt = Math.min(Math.PI/2, m.deadT*3); // 倒地角(render 组矩阵)
        if(m.deadT > 0.8 && m.label) m.label.visible = false;  // 尸体淡出即收牌
        if(!m.lastLabelDead && m.labelCanvas){ drawLabel(m); m.lastLabelDead = true; }
        continue;
      }
      if(m.label && m.lastLabelHp !== m.hp){          // 大兵团时血条节流重绘
        m.labelT -= dt;
        if(m.labelT <= 0){ drawLabel(m); m.lastLabelHp = m.hp; m.labelT = 0.3; }
      }
      const t = MobCore.tintFlash(m);                // 受击闪白 > 持久色(模式写入 tintBase)
      m.tr = t[0]; m.tg = t[1]; m.tb = t[2];
      if(m.flashT > 0) m.flashT -= dt;
      if(m.staggerT > 0) m.staggerT -= dt;
      if(m.cfg.fly && m.staggerT > 0){               // 被震落的飞行单位下沉
        const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
        if(gp.y > gy) gp.y = Math.max(gy, gp.y - 10*dt);
      }
      if(m.wander) wanderStep(m, dt);
    }
    for(let i=mobList.length-1; i>=0; i--){
      const m = mobList[i];
      if(m.gone || (m.dead && m.deadT > 2.4)){
        dispose(m);
        mobList.splice(i,1);
      }
    }
  }

  /* 游荡(演习场靶怪): 随机换向 · 栅栏/撞墙回头 · 贴地爬坡 · 步态关节 */
  function wanderStep(m, dt){
    const gp = m.pos, f = m.wander;
    m.wanderT -= dt;
    if(m.wanderT <= 0){
      m.wanderDir = Math.random()*Math.PI*2;
      m.wanderT = 1 + Math.random()*2;
    }
    const sp = 1.1;
    const nx = gp.x + Math.cos(m.wanderDir)*sp*dt, nz = gp.z + Math.sin(m.wanderDir)*sp*dt;
    if((f && (nx < f.x0 || nx > f.x1 || nz < f.z0 || nz > f.z1)) ||
       isSolid(getBlock(Math.floor(nx), Math.floor(gp.y + 1), Math.floor(nz)))){
      m.wanderT = 0;                                 // 撞墙/出界 → 原地换向
      return;
    }
    m.yaw = Math.atan2(Math.cos(m.wanderDir), Math.sin(m.wanderDir));   // 模型面朝 +Z
    MobCore.stepMove(m, nx-gp.x, nz-gp.z, groundTop);
    if(!m.cfg.fly){
      const ty = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
      gp.y += (ty-gp.y)*Math.min(1, dt*10);          // 爬坡下坎自然贴地
    }
    m.speedNow = sp;
    m.walkPhase += sp*dt*3.4;
    const sw = Math.sin(m.walkPhase)*0.5*Math.min(1, sp/2.2);
    const J = m.pose;
    if(MOB_RIG[m.type].slots.legL){ J.legL =  sw; J.legR = -sw; }
    if(m.type==='dragon'){
      m.flyPhase += dt*6;
      const wf = Math.sin(m.flyPhase)*0.5;
      J.wingL =  wf + 0.15; J.wingR = -(wf + 0.15);
    } else if(m.type==='zombie'){
      J.armL = -1.45; J.armR = -1.45;                // 僵尸前伸手
    } else if(m.type==='skeleton'){
      J.armL = -0.15 + sw*0.3; J.armR = -sw*0.5;
    }
  }

  /* 受击: 扣血/闪白/踉跄(MobCore) + 击退(地面走台阶规则, 飞行直线+clamp)
     血量归零进入死亡流程并播死亡音; freshDead 供调用方只结算一次 */
  function hit(m, dmg, kdx, kdz, kpow){
    kpow = kpow || 0;
    const r = MobCore.hitState(m, dmg);
    const l = Math.hypot(kdx,kdz) || 1;
    if(m.cfg.fly){
      m.pos.x += kdx/l*0.9*kpow;
      m.pos.z += kdz/l*0.9*kpow;
      if(m.clamp) m.clamp(m);
    } else {
      MobCore.stepMove(m, kdx/l*0.9*kpow, 0, groundTop);
      MobCore.stepMove(m, 0, kdz/l*0.9*kpow, groundTop);
    }
    if(r.freshDead) sfx('death');
    return r;
  }

  /* 圆域查询: 爆炸波及/坦克碾压共用; y+maxDy 给高度差过滤(可选) */
  function near(x, z, r, y, maxDy){
    const out = [];
    for(const m of mobList){
      if(m.dead || m.gone) continue;
      if(Math.hypot(m.pos.x-x, m.pos.z-z) > r) continue;
      if(y !== undefined && maxDy !== undefined && Math.abs(m.pos.y - y) > maxDy) continue;
      out.push(m);
    }
    return out;
  }

  /* 清场: 回收全部(含挂件与名牌)并冲刷批次(菜单/切模式页可用) */
  function clear(){
    for(const m of mobList) dispose(m);
    mobList.length = 0;
    render();
  }

  /* ---------- 怪物像素头像 (16×16 手绘 → 64×64 dataURL, 面板按钮用) ---------- */
  const mobFaceCache = {};
  function face(type){
    if(mobFaceCache[type]) return mobFaceCache[type];
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const px = (x,y,w,h,col)=>{ g.fillStyle = col; g.fillRect(x,y,w,h,col); };
    const mottle = (col, pts)=>pts.forEach(([x,y])=>px(x,y,1,1,col));
    switch(type){
      case 'zombie': {
        px(0,0,16,16,'#5e9440');
        mottle('#4a7a33',[[2,1],[6,3],[11,2],[14,5],[3,9],[8,8],[12,12],[5,14],[1,12],[9,14],[13,8]]);
        px(3,5,3,3,'#14200f'); px(10,5,3,3,'#14200f');      // 黑眼窝
        px(7,8,2,2,'#3d6b2e');                               // 鼻影
        px(5,12,6,2,'#1c2b16');                              // 嘴
        break;
      }
      case 'skeleton': {
        px(0,0,16,16,'#d8d8d2');
        mottle('#b8b8b0',[[3,1],[9,2],[13,4],[1,7],[6,6],[11,9],[4,14],[13,12],[8,15]]);
        px(3,5,3,3,'#1a1a1a'); px(10,5,3,3,'#1a1a1a');      // 深眼窝
        px(7,8,2,2,'#8a8a84');                               // 鼻孔
        px(4,11,8,3,'#b8b8b0');                              // 牙床
        for(let x=5;x<=11;x+=2) px(x,11,1,3,'#1a1a1a');      // 牙缝
        break;
      }
      case 'creeper': {
        px(0,0,16,16,'#4fae4f');
        mottle('#3d8f3d',[[1,2],[5,1],[9,3],[13,2],[3,7],[11,6],[2,12],[7,14],[12,11],[14,14],[6,9]]);
        px(3,5,3,3,'#101510'); px(10,5,3,3,'#101510');       // 眼
        px(6,9,4,2,'#101510');                               // 嘴(上)
        px(5,11,2,3,'#101510'); px(9,11,2,3,'#101510');      // 嘴(垂腿)
        break;
      }
      case 'golem': {
        px(0,0,16,16,'#cdd0d8');
        mottle('#aab0bb',[[2,2],[7,1],[12,3],[1,9],[13,10],[4,13],[10,14],[14,2]]);
        px(2,1,2,2,'#3d8f3d'); px(3,1,1,1,'#5e9440');        // 蔓藤
        px(3,5,3,2,'#2a2e36'); px(10,5,3,2,'#2a2e36');       // 眼窝
        px(4,5,1,2,'#ff2a1a'); px(11,5,1,2,'#ff2a1a');       // 红瞳
        px(7,6,2,5,'#555a63');                               // 长鼻
        px(5,13,6,1,'#555a63');                              // 嘴
        break;
      }
      case 'dragon': {
        px(0,0,16,16,'#16161f');
        mottle('#262633',[[2,3],[6,2],[10,4],[13,7],[1,10],[5,12],[9,13],[14,11]]);
        px(2,0,2,3,'#3a2055'); px(12,0,2,3,'#3a2055');       // 双角
        px(7,0,2,2,'#3a2055');
        px(3,5,3,2,'#d06bff'); px(10,5,3,2,'#d06bff');       // 紫瞳
        px(4,5,1,2,'#e8a4ff'); px(11,5,1,2,'#e8a4ff');
        px(5,9,6,3,'#262633');                               // 吻部
        px(6,10,1,1,'#0a0a10'); px(9,10,1,1,'#0a0a10');      // 鼻孔
        px(5,12,6,1,'#0a0a10');                              // 颚线
        break;
      }
    }
    const big = document.createElement('canvas');
    big.width = big.height = 64;
    const bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;
    bg.drawImage(c, 0, 0, 64, 64);
    mobFaceCache[type] = big.toDataURL();
    return mobFaceCache[type];
  }

  function hasSlot(type, name){ return !!MOB_RIG[type].slots[name]; }

  return { types: MOB_TYPES, spawn, update, render, hit, near, clear,
           list: ()=>mobList, face, hasSlot };
})();
if(typeof module !== 'undefined' && module.exports) module.exports = Mobs;
