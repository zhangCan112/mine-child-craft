'use strict';
/* ============================================================
   怪物库 (Mobs, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   全游戏唯一的怪物实体模块(竞技场与坦克演习场共用):
   · 建模: 造型档案唯一权威(MobLookKit, js/mob-look/<type>.js 一怪一文件 —
     官方像素骨架+自绘贴图, docs/mob-look-design.md; 票③已拆内联 MOB_RIG
     旧轨) → (类型×关节槽) InstancedMesh 合批渲染(每型一份贴图材质)
   · 数值: mob-registry.js 的 MOB_TYPES(血量/速度/身高/碰撞半径/旗标)
   · 本能: 血量/受击(闪白·踉跄·击退)/死亡(倒地沉没; 存活→死亡瞬间逐
     onDeath 回调报事件, 引擎不解释死因不做掉落)/游荡(wander 可关)
   interface: spawn / update / render / hit / near / clear / onDeath /
              list / face / hasSlot / gait / stagger / pulseTint / scaleTo /
               debrisColor / spawnable /
               move / shift / setPos / steer / heal / setMaxHp / remove / settle
   玩法(战斗AI/阵营/晋升/表扬话术)在模式层; 模式可在 spawn 返回的
   mob 上挂私有字段(tierNode/tierGeos 等挂件, dispose 时若存在一并回收)。
   模式可写引擎字段的白名单(除此之外引擎字段对模式只读):
   · tintBase    持久色(狂暴红晕, 本模块 update 每帧消费)
   · labelScale  名牌整体放大(本模块 update 每帧套用)
   · attackCd / attackT / target  战斗节拍与索敌(引擎 spawn 置零/置空,
     模式读写 — 曾有模式漏初始化 attackCd 致怪物永不攻击, 初始化已收归引擎)
   · pose 等关节角 经 gait() 写入(战斗覆盖在其返回值之上叠加)
     · pos.y       垂直特技(跃起砸地/悬浮压制)直写; 水平位移一律走意图 API
     · 瞬时效果与结构变更一律走意图 API: pulseTint(引信白闪) / stagger(硬直) /
       scaleTo(引信膨胀·阶级放大) / move·shift·setPos(水平位移) / steer(面向) /
       heal·setMaxHp(生命) / remove(立即移除) / settle(贴地回巡航) —
       不直写 tr/tg/tb/staggerT/drawScale/pos.x/pos.z/yaw/hp/maxHp/gone,
     免得正确性依赖"Mobs.update → 模式 → Mobs.render"的帧序。
   实例数组归本模块私有: list() 返回内部引用(只读约定),
   clear() 原地清空并冲刷批次, 引用保持稳定(竞技场的 mobs 别名长期有效)。
   帧序契约: update(本能)与模式 AI 的相对顺序是宽容的 — 两侧都以
   dead||gone 判据自兜底, 谁先谁后一帧不改变行为; render(存活怪位姿
   写入实例批次)必须在最后, 否则本帧 AI 位移不上屏(各模式壳 update 的
   "本能→AI→合批渲染"三拍以此为准, 壳内不再各自立顺序纪律)。
   THREE/DOM 全部惰性创建: 引导桩与 Node 测试环境可安全加载本文件。
   硬依赖全局 MobLookKit(引擎层同层依赖): index.html 里 kit+42 份造型
   声明先于本文件加载; Node 测试桩需先注入 kit 与声明(见各 test 头注释)。
   ============================================================ */
const Mobs = (() => {
  const mobList = [];
  let mobId = 0;
  const LABEL_CULL_D = 64; // 名牌相机距离剔除(格): 远处名牌本就小到难读
  const LABEL_CULL_D2 = LABEL_CULL_D * LABEL_CULL_D;
  const LABEL_W = 160; const LABEL_H = 40; // 名牌画布(血条坐标按此布局, 两处共用)
  const LABEL_BASE_W = 2.6; const LABEL_BASE_H = 0.65; // 名牌世界尺寸(× labelScale)
  /* 死亡时序(秒): 倒地 → 收名牌并下沉 → 隐藏绘制 → 回收, 互相关联故提常量 */
  const DEAD_FADE_T = 0.8; const DEAD_SINK_DUR = 1.4; const DEAD_SINK_DEPTH = 1.3;
  const DEAD_HIDE_T = 2.2; const DEAD_RECYCLE_T = 2.4;


  /* 骨架解析的唯一入口: 直查造型档案(MobLookKit · 一怪一文件, 官方像素
     骨架+自绘贴图) — 消费点(render/gait/hasSlot/自检)一律经此。
     未声明键(如 mix 伪类型)返回 null, 调用方自兜底。 */
  function rigOf(type) {
    return MobLookKit.rig(type);
  }

  /* ---------- 批次管理: (类型×槽) → InstancedMesh, 容量按需翻倍(矩阵每帧
     全量重写, 扩容无需搬运); 空批次 count=0 不产生绘制 ---------- */
  const mobBatches = [];
  function getMobBatch(slot, rig) {
    let b = slot.batch;
    if (b) return b;
    if (!slot.geo) slot.geo = MobLookKit.slotGeoOf(rig.look, slot); /* 逐槽 UV 几何 */
    const mesh = new THREE.InstancedMesh(slot.geo, rig.mat(), 16); /* 每型一份贴图材质 */
    mesh.frustumCulled = false; // 实例散布全场, 按几何包围球剔除会误裁
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _tintCol.setRGB(1, 1, 1)); // 预建 instanceColor, 避免首次着色才编译变体
    scene.add(mesh);
    b = {mesh, cap: 16, n: 0};
    slot.batch = b;
    mobBatches.push(b);
    return b;
  }
  function growMobBatch(b, need) {
    let cap = b.cap;
    while (cap < need) cap *= 2;
    scene.remove(b.mesh);
    if (b.mesh.dispose) b.mesh.dispose(); // 几何/材质共享不在此动
    const mesh = new THREE.InstancedMesh(b.mesh.geometry, b.mesh.material, cap);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _tintCol.setRGB(1, 1, 1));
    scene.add(mesh);
    b.mesh = mesh; b.cap = cap;
  }

  /* 每帧把存活怪的各槽实例矩阵/颜色写入批次(密集重排, 无空闲表):
     位姿 = 位置(yaw/tilt) × 关节角(pose) × 体型(drawScale), 着色 = tint */
  const _wm=new THREE.Matrix4(); const _jm=new THREE.Matrix4(); const _im=new THREE.Matrix4();
  const _wq=new THREE.Quaternion(); const _jq=new THREE.Quaternion(); const _we=new THREE.Euler();
  const _wp=new THREE.Vector3(); const _jp=new THREE.Vector3(); const _ws=new THREE.Vector3();
  const _one=new THREE.Vector3(1, 1, 1);
  const _axisX=new THREE.Vector3(1, 0, 0); const _axisZ=new THREE.Vector3(0, 0, 1);
  const _tintCol=new THREE.Color();

  function render() {
    for (const b of mobBatches) b.n = 0; // 也覆盖清场后: count 归零, 残余实例不再绘制
    for (const m of mobList) {
      if (m.gone) continue;
      if (m.dead && m.deadT > DEAD_HIDE_T) { // 原 visible=false 的隐藏期
        if (m.tierNode) m.tierNode.visible = false; // 挂件随尸体一起隐去
        continue;
      }
      const rig = rigOf(m.type);
      const s = m.drawScale;
      const sink = (m.dead && m.deadT > DEAD_FADE_T) ?
        Math.min(1, (m.deadT-DEAD_FADE_T)/DEAD_SINK_DUR)*DEAD_SINK_DEPTH : 0; // 原"透明淡出"的实例化等价: 下沉入地
      _we.set(0, m.yaw, m.deadTilt); // Euler(0,yaw,tilt) 默认序 = Ry·Rz, 与旧 group 一致
      _wq.setFromEuler(_we);
      _wm.compose(_wp.set(m.pos.x, m.pos.y - sink, m.pos.z), _wq, _ws.set(s, s, s));
      for (const name of Object.keys(rig.slots)) {
        if (m.hideSlots && m.hideSlots.indexOf(name) >= 0) continue; /* 逐实例隐藏槽(模式政策: 剪毛羊不写羊毛批次=裸身示人) */
        const slot = rig.slots[name];
        const b = getMobBatch(slot, rig);
        if (b.n >= b.cap) growMobBatch(b, b.n+1);
        const pk = slot.poseKey || name; /* 共姿槽: 羊毛头骨随 head 关节角(造型档案 poseKey 声明) */
        _jq.setFromAxisAngle(slot.axis==='z' ? _axisZ : _axisX, pk==='root' ? 0 : (m.pose[pk]||0));
        _jm.compose(_jp.fromArray(slot.joint), _jq, _one);
        _im.multiplyMatrices(_wm, _jm);
        b.mesh.setMatrixAt(b.n, _im);
        b.mesh.setColorAt(b.n, _tintCol.setRGB(m.tr, m.tg, m.tb));
        b.n++;
      }
      if (m.tierNode) { // 阶级挂件(稀有, 普通 mesh)对齐实例位姿
        m.tierNode.visible = true;
        m.tierNode.position.set(m.pos.x, m.pos.y - sink, m.pos.z);
        m.tierNode.rotation.set(0, m.yaw, m.deadTilt);
        m.tierNode.scale.setScalar(s);
      }
    }
    for (const b of mobBatches) {
      b.mesh.count = b.n;
      if (b.n > 0) {
        b.mesh.instanceMatrix.needsUpdate = true;
        if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /* ---------- 名牌: 阵营前缀/颜色由调用方给(竞技场红蓝, 演习场无前缀) ----------
     labelCfg 可选 suffix(m)/hot(m): 名字后追加的文案(如晋升星级)与
     金色高亮开关 — 星级语义归模式层, 引擎只画调用方给的字符串 */
  function drawLabel(m) {
    const g = m.labelCanvas.getContext('2d');
    g.clearRect(0, 0, LABEL_W, LABEL_H);
    g.font='bold 15px sans-serif';
    g.shadowColor='#000'; g.shadowBlur=4;
    const cfg = m.labelCfg || {};
    const pre = cfg.prefix || '';
    const col = cfg.color || '#ffd44d';
    const suffix = (cfg.suffix && cfg.suffix(m)) || '';
    const hot = !!(cfg.hot && cfg.hot(m));
    const full = pre + m.cfg.name + suffix;
    if (m.dead) {
      g.textAlign='center'; g.fillStyle='#9a9a9a'; g.fillText(full, 80, 15);
    } else if (hot) {
      const wPre = g.measureText(pre).width; const wFull = g.measureText(full).width;
      const x0 = 80 - wFull/2;
      g.textAlign='left';
      g.fillStyle = col; // 前缀保持调用方色
      g.fillText(pre, x0, 15);
      g.fillStyle = '#ffd44d'; // 高亮金光(晋升)
      g.shadowColor='#ffb018'; g.shadowBlur=8;
      g.fillText(full.slice(pre.length), x0+wPre, 15);
    } else {
      g.textAlign='center'; g.fillStyle = col;
      g.fillText(full, 80, 15);
    }
    g.shadowBlur = 0;
    g.fillStyle='rgba(0,0,0,.65)'; g.fillRect(30, 22, 100, 10);
    const r = Math.max(0, m.hp/m.maxHp);
    g.fillStyle = r>0.5 ? '#48d848' : (r>0.25 ? '#e8c030' : '#e04030');
    g.fillRect(32, 24, 96*r, 6);
    m.labelTex.needsUpdate = true;
  }

  function dispose(m) {
    if (m.label) {
      scene.remove(m.label);
      m.label.material.map.dispose(); m.label.material.dispose();
    }
    if (m.tierNode) scene.remove(m.tierNode); // 模式挂件(竞技场阶级光环等, 稀有物)
    if (m.tierGeos) m.tierGeos.forEach((g)=>g.dispose());
    if (m.tierMats) m.tierMats.forEach((mt)=>mt.dispose());
  }

  /* ---------- 生命周期 ---------- */
  function spawn(type, x, z, opts) {
    opts = opts || {};
    const cfg = MOB_TYPES[type];
    const gy = groundTop(Math.floor(x), Math.floor(z)) + 1;
    const y0 = cfg.fly ? (opts.flyY !== undefined ? opts.flyY : gy + 6) : gy; // 巡航高度(游荡飞行被震落后回这里)
    const m = {
      id: mobId++, type, cfg,
      labelCfg: opts.label || null,
      pose: {legL: 0, legR: 0, armL: 0, armR: 0, head: 0, wingL: 0, wingR: 0}, // 关节角(弧度), render 组实例矩阵
      drawScale: 1, deadTilt: 0, // 体型(挂件缩放/引信膨胀) 与 倒地角
      tr: 1, tg: 1, tb: 1, tintBase: [1, 1, 1], // instanceColor 着色(闪白/狂暴等持久色)
      pos: (typeof THREE !== 'undefined') ?
      new THREE.Vector3(x, y0, z) :
      {x, y: y0, z},
      yaw: opts.yaw || 0,
      hp: cfg.hp, maxHp: cfg.hp, dead: false, deadT: 0, gone: false,
      /* 战斗节拍(攻击冷却/挥击动画计时/索敌目标): 引擎初始化, 模式可写可读 —
         下界模式曾因模式层漏初始化 attackCd(undefined<=0 恒 false)导致怪物
         永不攻击且零报错, 故收归引擎置零 */
      attackCd: 0, attackT: 0, target: null,
      flashT: 0, staggerT: 0,
      walkPhase: Math.random()*6, speedNow: 0, flyPhase: Math.random()*6, flyHome: y0,
      wander: opts.wander || null, // 游荡配置(栅栏), 无则站立/由模式驱动
      wanderT: 0, wanderDir: Math.random()*Math.PI*2,
      clamp: opts.clamp || null, // 飞行单位击退后的边界约束(竞技场圆形)
      labelScale: 1, // 名牌放大倍率(模式可写, 白名单字段)
      tierNode: null, tierGeos: [], tierMats: [], // 模式挂件位(dispose 一并回收)
      lastLabelHp: -1, lastLabelDead: false, labelT: 0,
    };
    if (opts.hpMult) {
      m.hp = m.maxHp = Math.round(cfg.hp * opts.hpMult);
    }
    if (typeof document !== 'undefined' && typeof THREE !== 'undefined') {
      const lc = document.createElement('canvas'); lc.width=LABEL_W; lc.height=LABEL_H;
      const ltex = new THREE.CanvasTexture(lc);
      /* 名牌读深度(默认 depthTest: true): 被地形正常遮挡 — 地下不再透视
         看到地表怪物名牌(2026-10 视野 bug; combat-kit mkHpBar 血条同口径) */
      m.label = new THREE.Sprite(new THREE.SpriteMaterial({map: ltex, transparent: true}));
      m.labelCanvas = lc; m.labelTex = ltex;
      applyLabelScale(m);
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
  function update(dt) {
    for (const m of mobList) {
      if (m.gone) continue;
      const gp = m.pos;
      if (m.label) {
        const ldx = gp.x - camera.position.x; const ldz = gp.z - camera.position.z;
        m.label.visible = (ldx*ldx + ldz*ldz) < LABEL_CULL_D2;
        if (m.label.visible) {
          m.label.position.set(gp.x, gp.y + m.cfg.h + 0.55, gp.z);
          applyLabelScale(m); // labelScale(模式白名单字段)每帧套用
        }
      }
      if (m.dead) {
        m.deadT += dt;
        if (m.cfg.fly) { // 飞行单位死亡坠落
          const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
          if (gp.y > gy) gp.y = Math.max(gy, gp.y - 16*dt);
        }
        m.deadTilt = Math.min(Math.PI/2, m.deadT*3); // 倒地角(render 组矩阵)
        if (m.deadT > DEAD_FADE_T && m.label) m.label.visible = false; // 尸体淡出即收牌
        if (!m.lastLabelDead && m.labelCanvas) {
          drawLabel(m); m.lastLabelDead = true;
        }
        continue;
      }
      if (m.label && m.lastLabelHp !== m.hp) { // 大兵团时血条节流重绘
        m.labelT -= dt;
        if (m.labelT <= 0) {
          drawLabel(m); m.lastLabelHp = m.hp; m.labelT = 0.3;
        }
      }
      const t = MobCore.tintFlash(m); // 受击闪白 > 持久色(模式写入 tintBase)
      m.tr = t[0]; m.tg = t[1]; m.tb = t[2];
      if (m.flashT > 0) m.flashT -= dt;
      if (m.staggerT > 0) m.staggerT -= dt;
      if (m.cfg.fly && m.staggerT > 0) { // 被震落的飞行单位下沉
        const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
        if (gp.y > gy) gp.y = Math.max(gy, gp.y - 10*dt);
      }
      if (m.wander) wanderStep(m, dt);
    }
    for (let i=mobList.length-1; i>=0; i--) {
      const m = mobList[i];
      if (m.gone || (m.dead && m.deadT > DEAD_RECYCLE_T)) {
        dispose(m);
        mobList.splice(i, 1);
      }
    }
  }

  /* 名牌尺寸 = 基准 × labelScale(spawn 初始与 update 每帧共用一条式) */
  function applyLabelScale(m) {
    const ls = m.labelScale || 1;
    m.label.scale.set(LABEL_BASE_W*ls, LABEL_BASE_H*ls, 1);
  }

  /* 游荡(演习场靶怪): 随机换向 · 栅栏/撞墙回头 · 贴地爬坡 · 步态关节 */
  function wanderStep(m, dt) {
    const gp = m.pos; const f = m.wander;
    m.wanderT -= dt;
    if (m.wanderT <= 0) {
      m.wanderDir = Math.random()*Math.PI*2;
      m.wanderT = 1 + Math.random()*2;
    }
    const sp = 1.1;
    const nx = gp.x + Math.cos(m.wanderDir)*sp*dt; const nz = gp.z + Math.sin(m.wanderDir)*sp*dt;
    if ((f && (nx < f.x0 || nx > f.x1 || nz < f.z0 || nz > f.z1)) ||
       isSolid(getBlock(Math.floor(nx), Math.floor(gp.y + 1), Math.floor(nz)))) {
      m.wanderT = 0; // 撞墙/出界 → 原地换向
      return;
    }
    m.yaw = Math.atan2(Math.cos(m.wanderDir), Math.sin(m.wanderDir)); // 模型面朝 +Z
    MobCore.stepMove(m, nx-gp.x, nz-gp.z, groundTop);
    settle(m, dt);
    m.speedNow = sp;
    gait(m, dt, sp);
  }

  /* 步态(引擎/模式共用): 走路摆腿(蜘蛛式八腿相位交错) · 飞行扇翅 · 按骨架表 armStyle 摆臂。
     返回摆幅 sw — 模式的攻击挥臂等战斗姿态在 gait 写入的 pose 之上覆盖叠加。
     第 4 参 atkDur(可缺省)= attackT 满时长 → 通用战斗姿态一并收在此:
     有臂挥臂(僵尸式下劈/弓手举持/通用人形抡臂 — 挥击手=持械手: 骨架表
     weaponArm 声明持械臂, 缺省抡右拳), 无臂有头则头部前扑 —
     骨架知识本就住在引擎, 模式不再各自手抄 sin 公式(竞技场曾硬编码
     /0.45, attackT 超时长时相位为负; 此处钳制到 [0,1]) */
  function gait(m, dt, sp, atkDur) {
    m.walkPhase += sp*dt*3.4;
    const sw = Math.sin(m.walkPhase)*0.5*Math.min(1, sp/2.2);
    const J = m.pose;
    const rig = rigOf(m.type);
    if (rig.slots.legL1) { // 蜘蛛式: 八腿一腿一骨, 相位交错(同侧前→后传动, 对侧反相)
      const amp = 0.5*Math.min(1, sp/2.2);
      const PH = [0, 1.6, 3.1, 4.7];
      for (let i = 0; i < 4; i++) {
        J['legL'+(i+1)] = Math.sin(m.walkPhase+PH[i])*amp;
        J['legR'+(i+1)] = Math.sin(m.walkPhase+PH[i]+Math.PI)*amp;
      }
    }
    if (rig.slots.legL) {
      J.legL = sw; J.legR = -sw;
    }
    if (rig.slots.wingL) { // 通用飞行扇翅(末影龙/幻翼/恼鬼)
      m.flyPhase += dt*6;
      const wf = Math.sin(m.flyPhase)*0.5;
      J.wingL = wf + 0.15;
      J.wingR = -(wf + 0.15);
    }
    if (rig.armStyle === 'zombie') { // 僵尸前伸手
      J.armL = -1.45; J.armR = -1.45;
    } else if (rig.armStyle === 'archer') { // 骷髅弓手(持弓臂前伸)
      J.armL = -0.15 + sw*0.3; J.armR = -sw*0.5;
    } else if (rig.slots.armL) { // 通用摆臂(人形怪/守卫者侧刺/凋灵肩头)
      J.armL = sw*0.5; J.armR = -sw*0.5;
    }
    if (atkDur) { // 战斗姿态叠加(每帧幂等: 攻/不攻都写, 无残留)
      const s = m.attackT > 0 ?
        Math.sin(Math.max(0, Math.min(1, 1 - m.attackT/atkDur)) * Math.PI) : 0;
      if (rig.armStyle === 'zombie') { // 僵尸式: 平举前臂下劈
        J.armR = m.attackT > 0 ? -1.45 - s*0.9 : -1.45;
      } else if (rig.armStyle === 'archer') { // 弓手式: 攻击中持弓臂定住瞄准
        J.armR = m.attackT > 0 ? -1.3 : -sw*0.5;
      } else if (rig.slots.armL) { // 通用: 抡臂挥击 — 持械臂抡(缺省右拳), 另一臂反向平衡
        J.armL = -sw*0.5; J.armR = sw*0.5; // 两臂步态基线(相位互补)
        if (m.attackT > 0) J[rig.weaponArm || 'armR'] = -s*1.9; // 挥击手=持械手
      } else if (rig.slots.head) { // 四足/恶魂式: 头部前扑
        J.head = m.attackT > 0 ? -0.55 : 0;
      }
    }
    return sw;
  }

  /* ---------- 模式层的意图 API(替代直写引擎字段, 帧序契约收在此) ---------- */
  function pulseTint(m, r, g, b) {
    m.tr = r; m.tg = g; m.tb = b;
  } // 帧内瞬时着色(下一帧 update 的着色管线接管)
  function stagger(m, t) {
    m.staggerT = Math.max(m.staggerT||0, t);
  } // 踉跄/硬直(取大, 不缩短更长的既有硬直)
  function scaleTo(m, s) {
    m.drawScale = s;
  } // 体型(引信膨胀/阶级放大)
  /* 位移族: 战斗 AI 不再直写 pos/yaw —
     move   地面步进(x/z 分轴走台阶规则, 爬坡/拦高墙)
     shift  无碰撞平移(飞行单位的巡航/盘旋)
     setPos 几何回弹的绝对落位(边界约束把单位拉回场内) */
  function move(m, dx, dz) {
    MobCore.stepMove(m, dx, 0, groundTop);
    MobCore.stepMove(m, 0, dz, groundTop);
  }
  function shift(m, dx, dz) {
    m.pos.x += dx; m.pos.z += dz;
  }
  function setPos(m, x, z) {
    m.pos.x = x; m.pos.z = z;
  }
  function steer(m, yaw) {
    m.yaw = yaw;
  } // 面向(render 消费)
  /* 生命族: heal 回血(封顶 maxHp) · setMaxHp 晋升改上限(现血超出即截断) */
  function heal(m, hp) {
    m.hp = Math.min(m.maxHp, m.hp + hp);
  }
  function setMaxHp(m, maxHp) {
    m.maxHp = maxHp; if (m.hp > maxHp) m.hp = maxHp;
  }
  /* 立即移除(下帧走引擎回收管线: 自爆残留/清场单只) */
  function remove(m) {
    m.gone = true;
  }
  /* 贴地/回巡航高度(游荡本能的同一条式, 战斗 AI 收尾复用) */
  function settle(m, dt) {
    const gp = m.pos;
    if (!m.cfg.fly) {
      const ty = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
      gp.y += (ty-gp.y)*Math.min(1, dt*10); // 爬坡下坎自然贴地
    } else if (gp.y !== m.flyHome) {
      gp.y += (m.flyHome-gp.y)*Math.min(1, dt*2); // 被震落后缓慢回到巡航高度(不贴地怪飞)
    }
  }

  /* 逐怪种碎块配色(击杀碎块观感, 竞技场/演习场共用) — 造型档案 debris
     字段唯一权威(票③: 41 键内联表已前移进各 look 文件, 迁移前逐键对账
     零漂移), 缺省灰兜底 */
  function debrisColor(type) {
    return MobLookKit.debrisOf(type) || 0x8a8f98;
  }

  /* 受击: 扣血/闪白/踉跄(MobCore) + 击退(地面走台阶规则, 飞行直线+clamp)
     血量归零进入死亡流程并播死亡音; freshDead 供调用方只结算一次 */
  function hit(m, dmg, kdx, kdz, kpow) {
    kpow = kpow || 0;
    const r = MobCore.hitState(m, dmg);
    const l = Math.hypot(kdx, kdz) || 1;
    if (m.cfg.fly) {
      m.pos.x += kdx/l*0.9*kpow;
      m.pos.z += kdz/l*0.9*kpow;
      if (m.clamp) m.clamp(m);
    } else {
      MobCore.stepMove(m, kdx/l*0.9*kpow, 0, groundTop);
      MobCore.stepMove(m, 0, kdz/l*0.9*kpow, groundTop);
    }
    if (r.freshDead) {
      sfx('death');
      for (const cb of deathCbs) cb(m);
    } // 存活→死亡瞬间: 击杀事件只报实体, 死因解释/掉落掷骰归消费方
    return r;
  }

  /* ---------- 击杀事件(引擎只报不解释): onDeath(cb) 可注册多个回调,
     hit() 判定存活→死亡的瞬间每个回调恰调一次(参数=怪物实体 m —
     此时 m.dead 已置位, 位置/类型等字段仍可读); 死因/掉落归模式层
     (巢穴掉落掷骰走 drops.rollDrops, 引擎不掺和); clear() 清场一并
     解除注册(切模式页时旧模式的闭包不残留到新场景) ---------- */
  const deathCbs = [];
  function onDeath(cb) {
    deathCbs.push(cb);
  }

  /* 圆域查询: 爆炸波及/坦克碾压共用; y+maxDy 给高度差过滤(可选) */
  function near(x, z, r, y, maxDy) {
    const out = [];
    for (const m of mobList) {
      if (m.dead || m.gone) continue;
      if (Math.hypot(m.pos.x-x, m.pos.z-z) > r) continue;
      if (y !== undefined && maxDy !== undefined && Math.abs(m.pos.y - y) > maxDy) continue;
      out.push(m);
    }
    return out;
  }

  /* 可部署清单=可战斗部署(排除 mix 伪类型与 passive 牧场动物, F4 二期设计稿 §4.2):
     竞技场 MIX_POOL 与坦克演习场 RANGE_MOB_KEYS 都读本清单——农场一家零改动自然排除;
     "什么算可战斗部署"的过滤归引擎, 调用方不再各自判 */
  function spawnable() {
    return Object.keys(MOB_TYPES).filter((k) => k !== 'mix' && !MOB_TYPES[k].passive);
  }

  /* 谱系分组查询: 面板分组渲染的唯一入口(竞技场/演习场共用, 与 spawnable 同地位)。
     按主族(family 首位)归组 — 一怪只归一桶(多族怪的展示位由主族决定);
     无兜底族(独行侠已撤, 每怪必归种族): 真出现无 family 怪时以键名兜底不静默丢桶;
     空桶跳过; 顺序按 FAMILIES.order, 未注册键排最后 */
  function families() {
    const buckets = {};
    for (const k of spawnable()) {
      const fam = (MOB_TYPES[k].family || [])[0] || 'other';
      (buckets[fam] = buckets[fam] || []).push(k);
    }
    const meta = (f) => (typeof FAMILIES !== 'undefined' && FAMILIES[f]) || {name: f, order: 99};
    return Object.keys(buckets)
        .map((f) => ({key: f, name: meta(f).name, members: buckets[f]}))
        .sort((a, b) => meta(a.key).order - meta(b.key).order);
  }

  /* 清场: 回收全部(含挂件与名牌)并冲刷批次(菜单/切模式页可用);
     死亡回调一并解除(与实例数组同生命周期, 旧模式闭包不残留) */
  function clear() {
    for (const m of mobList) dispose(m);
    mobList.length = 0;
    deathCbs.length = 0;
    render();
  }

  /* ---------- 怪物像素头像 (头贴图正面裁切 → 16×16 → 64×64 dataURL, 面板按钮用;
     无档案键画问号兜底 — 票③已拆 319 行手绘 switch, 头像与皮肤同源) ---------- */
  const mobFaceCache = {};
  function face(type) {
    if (mobFaceCache[type]) return mobFaceCache[type];
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const px = (x, y, w, h, col)=>{
      g.fillStyle = col; g.fillRect(x, y, w, h, col);
    };
    /* 16→64 最近邻放大(贴图裁切/问号兜底共用出口) */
    const faceUpscale = ()=>{
      const big = document.createElement('canvas');
      big.width = big.height = 64;
      const bg = big.getContext('2d');
      bg.imageSmoothingEnabled = false;
      bg.drawImage(c, 0, 0, 64, 64);
      mobFaceCache[type] = big.toDataURL();
      return mobFaceCache[type];
    };
    /* 造型档案: 头贴图正面裁切居中 → 16×16(皮肤与头像同源, 面板自动跟皮肤) */
    const lookPix = MobLookKit.facePixels(type);
    if (lookPix) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const p = lookPix[y*16+x];
          if (p) px(x, y, 1, 1, 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')');
        }
      }
      return faceUpscale();
    }
    /* 兜底: 无造型档案的键(如 mix 伪类型)画显眼问号 — 不再静默空白 */
    px(0, 0, 16, 16, '#4a4f58');
    px(3, 2, 10, 2, '#e8ecf2'); px(3, 5, 10, 2, '#e8ecf2'); px(3, 8, 6, 2, '#e8ecf2');
    px(7, 10, 2, 3, '#e8ecf2'); px(7, 14, 2, 2, '#ff5a30');
    return faceUpscale();
  }

  function hasSlot(type, name) {
    const r = rigOf(type);
    return !!(r && r.slots[name]);
  }

  /* 注册表一致性自检: MOB_TYPES(非伪类型) ↔ 造型档案 — 漏建 look 文件的怪
     render 会崩帧, 在加载期就把漏配喊出来(新增怪"改 3 处"里的静默失败变
     即时报错; 漏配 face 则由问号兜底) */
  (function() {
    if (typeof MOB_TYPES === 'undefined' || typeof console === 'undefined') return;
    const missing = Object.keys(MOB_TYPES).filter((k) => k!=='mix' && !MobLookKit.has(k));
    if (missing.length) console.warn('[Mobs] MOB_TYPES 有而造型档案缺(渲染会崩):', missing.join(','));
    /* 谱系自检: family 引用未注册键 / proto 不在合法值表 / mix 带谱系 —
       新怪加行时漏声明或拼错键在这里即报(与 RIG 自检同一道理) */
    if (typeof FAMILIES === 'undefined' || typeof PROTOS === 'undefined') return;
    const famKeys = Object.keys(FAMILIES);
    for (const k of Object.keys(MOB_TYPES)) {
      const def = MOB_TYPES[k];
      if (k === 'mix') {
        if (def.family || def.proto) console.warn('[Mobs] mix 伪类型不应带谱系字段');
        continue;
      }
      if (!PROTOS.includes(def.proto)) {
        console.warn('[Mobs] ' + k + ' 的 proto 非法(合法值见 mob-registry.js PROTOS):', def.proto);
      }
      for (const f of (def.family || [])) {
        if (!famKeys.includes(f)) console.warn('[Mobs] ' + k + ' 引用未注册族:', f);
      }
    }
  })();

  return {types: MOB_TYPES, spawn, update, render, hit, near, clear, onDeath,
    list: ()=>mobList, face, hasSlot, gait, stagger, pulseTint, scaleTo,
    debrisColor, spawnable, families,
    move, shift, setPos, steer, heal, setMaxHp, remove, settle};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Mobs;
