'use strict';
/* ============================================================
   CombatKit(玩家战斗 kit, 术语见 GLOSSARY.md「玩家战斗 kit」)
   — 应用层·装配(mkHpBar 同款 THREE/DOM 惰性观感)
   一句话职责: 下界/探险两模式(击杀观感另有坦克演习场消费)各自复制的
   玩家战斗壳归一 —— 玩家战斗实体(MobCore 状态字段)、受击提醒(音+闪红+
   震屏+3s 节流话术)、近战攻击(方向门槛/伤害源/耐久磨损经 cfg 注入,
   下界「无目标也出手占冷却」经 swingOnMiss 保留)、箭矢管线(发射→
   leadAim→stepShot 步进→命中政策回调, mesh/寿命/geo 缓存自持)、
   击杀观感、死亡复位; 战斗节拍状态(冷却/受击节流/弹数组)自持, 模式
   update 只转喂 tick(dt)。怪物 AI 骨架与阵营/供怪政策留在模式层。
   mkHpBar 自 mode-kit 迁入(C6-T3 与模式切换同票原子落地 — S2 归一件
   随战斗 vocabulary 归位)。
   interface: mkFighter(policy)→ent · mkHurtAlarm(cfg)→{hit(r),tick(dt),reset()} ·
     mkMelee(cfg)→{aim(p),swing(p),swingAction(p,spec),tick(dt),reset()} ·
     mkArrows(cfg)→{shootFromMob(m,tg,spec)·shootFromAim(spec)·update(dt)·clear()·count()} ·
     killBurst(m,count,cfg?) · resetFighter(e) · mkHpBar(opts)→{update,dispose}
   依赖(均经全局名, 调用期解析): CombatCore(js/combat-core.js — leadAim/
     hitBody/stepShot) · Mobs(js/mobs.js — list/hit/debrisColor) ·
     Avatar·Fx·SpeechKit·sfx·showToast · getBlock(js/voxel.js) ·
     CameraRig·camera·scene·THREE(玩家射箭与观感, 惰性) ·
     pos/vel/yaw/PLAYER(js/voxel.js 与 config.js — 战斗实体与锥判定) ·
     drawArt(js/icons.js)·BTN_PIX(js/button-icons.js — mkHpBar 像素心)
   可测性: THREE/DOM 惰性(mkHpBar 先例); 判定与步进在 combat-core 纯核心
     (有单测); 本文件形状与契约由 test/combat-kit.test.js vm 桩直测,
     行为面由 test/nether-mode/adventure-mode 既有断言兜底(interface 即测试面)
   ============================================================ */

/* ---------- 玩家战斗实体(nether getPEnt / adventure advGetPEnt 同形归一) ----------
   MobCore 受击状态机的字段契约(hitBody/闪红/踉跄共用); 政策数值经
   policy 注入({hp, maxHp, dmg, range}), 模式自持实例缓存 */
function mkFighter(policy) {
  const p = policy || {};
  const hp = p.hp !== undefined ? p.hp : 30;
  const maxHp = p.maxHp !== undefined ? p.maxHp : hp;
  return {
    pos, vel,
    cfg: {h: PLAYER.height, fly: false, ranged: false,
      dmg: p.dmg !== undefined ? p.dmg : 3, range: p.range !== undefined ? p.range : 3,
      cd: 0, hitR: 0.55, speed: PLAYER.speed, hp, maxHp, dead: false, gone: false},
    hp, maxHp, dead: false, deadT: 0, flashT: 0, staggerT: 0, tintBase: [1, 1, 1],
  };
}

/* ---------- 受击提醒(非致命): 账本同步 + 受击音 + 闪红 + 轻震屏 + 3s 节流话术 ----------
   setHp 回调同步模式自己的血量账本(下界 NETHER.player / 探险 ADV.player);
   话术默认与两模式现行一致, 可经 line 覆盖 */
function mkHurtAlarm(cfg) {
  const o = cfg || {};
  const line = o.line || '哎呀被打中了！快躲开！';
  let t = 0;
  return {
    hit(r) {
      if (o.setHp && r) o.setHp(r.hp);
      sfx('hurt'); /* 受击专属音(与"主人公打怪"的 hit 区分) */
      Avatar.flash(0.4); /* 主提醒: 身体变红(剩血走头顶血条) */
      Fx.kick(0.35);
      if (t <= 0) {
        t = 3;
        SpeechKit.speak((r && r.line) || line); /* 语音 3 秒节流(iOS TTS 频繁 cancel 是掉帧源); r.line=来源话术(liquid D9 环境伤害) */
      }
    },
    tick(dt) {
      t = Math.max(0, t - dt);
    },
    reset() {
      t = 0;
    },
  };
}

/* ---------- 近战攻击: 冷却自持 · 方向门槛可选 · 伤害/磨损/击杀经注入 ----------
   aim(p) 单独导出(探险「锥内有怪也占住点击不落挖」的占位判定);
   swingOnMiss=下界口径(无目标也出手观感并占冷却 — 剑/弓点击即反馈);
   aimCos 给准星锥门槛(缺省纯最近 — 下界口径);
   onHit(m,res)=命中即报的受击回调(存活/死亡都报 — F4 牧场受击逃窜用, 缺省不挂) */
function mkMelee(cfg) {
  const o = cfg || {};
  const range = o.range !== undefined ? o.range : 3;
  const cooldown = o.cooldown !== undefined ? o.cooldown : 0.38;
  let cd = 0;
  function aim(p) {
    let best = null; let bd = range * range;
    const fx = -Math.sin(yaw); const fz = -Math.cos(yaw); /* 朝向(camera-rig lookDir 同式) */
    for (const m of Mobs.list()) {
      if (m.dead || m.gone) continue;
      const dx = m.pos.x - p.pos.x; const dz = m.pos.z - p.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > bd) continue;
      if (Math.abs(m.pos.y - p.pos.y) > 2.5) continue;
      if (o.aimCos !== undefined) {
        const d = Math.sqrt(d2) || 1e-9;
        if ((dx / d) * fx + (dz / d) * fz < o.aimCos) continue; /* 不在准星锥内 */
      }
      bd = d2; best = m;
    }
    return best;
  }
  function swing(p) {
    if (cd > 0) return false;
    const m = aim(p);
    if (!m) {
      if (o.swingOnMiss) {
        cd = cooldown;
        Avatar.swing(); /* 下界口径: 无目标也出手(观感即反馈) */
      }
      return false; /* 探险口径: 锥内无怪不出手不占冷却(点击落挖掘/放置) */
    }
    cd = cooldown;
    Avatar.swing();
    const r = Mobs.hit(m, typeof o.dmg === 'function' ? o.dmg(m) : (o.dmg || 3),
        m.pos.x - p.pos.x, m.pos.z - p.pos.z, 0.35);
    sfx('hit');
    if (o.onWear) o.onWear(); /* 命中才扣耐久(探险; 非工具不扣在模式侧判) */
    if (o.onHit) o.onHit(m, r); /* 受击回调(存活/死亡都报, 携 hit 结果——F4 牧场受击逃窜用) */
    if (r.freshDead && o.onKill) o.onKill(m);
    return true;
  }
  /* 占冷却 + 出手观感 + 自定义动作(不扫近战目标) — 下界弓口径: 拉弓冷却
     与剑同一条轨道(换武器不躲冷却), 弹由箭矢管线沿准星出膛 */
  function swingAction(p, spec) {
    const s = spec || {};
    if (cd > 0) return false;
    cd = s.cooldown !== undefined ? s.cooldown : cooldown;
    Avatar.swing();
    if (s.act) s.act();
    return true;
  }
  return {aim, swing, swingAction, tick(dt) {
    cd = Math.max(0, cd - dt);
  }, reset() {
    cd = 0;
  }};
}

/* ---------- 箭矢管线: 发射(leadAim/沿准星) → stepShot 步进 → 命中政策回调 ----------
   一实例一弹种: mesh('box' 箭|'sphere' 火球)·lookAt·targets 分开配 ——
   下界=两实例(玩家箭 hitMobs / 怪火球 hitPlayer 不 lookAt), 探险=一实例
   (骷髅箭 hitPlayer); spec 逐发给 {speed, dmg, kpow, g, life};
   onHitMob(m,res)/onHitPlayer(res) 携 Mobs.hit 结果(含 freshDead),
   死亡/受击政策归模式; clear() 收全部在场弹(进场/清场纪律) */
function mkArrows(cfg) {
  const o = cfg || {};
  const shots = [];
  let geo = null; let mat = null;
  function ensureMesh() {
    if (geo || typeof THREE === 'undefined' || typeof scene === 'undefined') return;
    if (o.mesh === 'sphere') {
      geo = new THREE.SphereGeometry(0.16, 6, 6);
    } else {
      geo = new THREE.BoxGeometry(0.06, 0.06, 0.62); /* 箭杆尺寸(两模式现行同款) */
    }
    mat = new THREE.MeshBasicMaterial({color: o.color !== undefined ? o.color : 0xd8d8d0});
  }
  function spawn(rec) {
    ensureMesh();
    let mesh = null;
    if (geo) {
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(rec.from.x, rec.from.y, rec.from.z);
      scene.add(mesh);
    }
    shots.push(Object.assign({mesh}, rec));
  }
  function shootFromMob(m, tg, spec) {
    const s = spec || {};
    sfx('shoot');
    const from = {x: m.pos.x, y: m.pos.y + (m.cfg.h || 1.8) * 0.55, z: m.pos.z};
    const speed = s.speed !== undefined ? s.speed : 16;
    const dir = CombatCore.leadAim(from, {x: tg.pos.x, y: tg.pos.y, z: tg.pos.z,
      vx: tg.vel.x, vz: tg.vel.z, h: tg.cfg.h}, speed,
    s.g !== undefined ? s.g : 6, 0.5);
    spawn({from, vel: {x: dir.x * speed, y: dir.y * speed, z: dir.z * speed},
      life: s.life !== undefined ? s.life : 2.5, dmg: s.dmg,
      kpow: s.kpow !== undefined ? s.kpow : 0.6,
      g: s.g !== undefined ? s.g : 6, owner: m});
  }
  function shootFromAim(spec) {
    const s = spec || {};
    sfx('shoot');
    const a = CameraRig.aim(camera);
    const dx = a.dir.x; const dy = a.dir.y; const dz = a.dir.z;
    const from = {x: a.origin.x + dx * 0.3, y: a.origin.y + dy * 0.3, z: a.origin.z + dz * 0.3};
    const speed = s.speed !== undefined ? s.speed : 22;
    spawn({fromPlayer: true, from,
      vel: {x: dx * speed, y: dy * speed, z: dz * speed},
      life: s.life !== undefined ? s.life : 3, dmg: s.dmg,
      kpow: s.kpow !== undefined ? s.kpow : 0.35,
      g: s.g !== undefined ? s.g : 9.5});
  }
  function removeAt(i) {
    const a = shots[i];
    if (a.mesh && typeof scene !== 'undefined') scene.remove(a.mesh);
    shots.splice(i, 1);
  }
  function update(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const a = shots[i];
      const r = CombatCore.stepShot(a, dt, getBlock);
      a.vel = r.vel; a.life = r.life; a.from = {x: r.x, y: r.y, z: r.z};
      if (a.mesh) {
        a.mesh.position.set(r.x, r.y, r.z);
        if (o.lookAt !== false) a.mesh.lookAt(r.x + r.vel.x, r.y + r.vel.y, r.z + r.vel.z);
      }
      if (r.dead) {
        /* 撞块或寿命尽(不触发命中政策, 巨石类 AoE 留模式侧) */
        removeAt(i);
        continue;
      }
      if (a.fromPlayer) {
        /* 玩家弹 → 打怪(首个盒命中即止) */
        let hitMob = null;
        for (const m of Mobs.list()) {
          if (m.dead || m.gone) continue;
          if (CombatCore.hitBody(r, m)) {
            hitMob = m; break;
          }
        }
        if (hitMob) {
          const res = Mobs.hit(hitMob, a.dmg, hitMob.pos.x - r.x, hitMob.pos.z - r.z, a.kpow);
          sfx('hit');
          if (o.onHitMob) o.onHitMob(hitMob, res);
          removeAt(i);
        }
      } else if (o.player) {
        /* 怪弹 → 打玩家(致命走死亡政策, 受击走提醒) */
        const p = o.player();
        if (p && !p.dead && CombatCore.hitBody(r, p)) {
          const res = Mobs.hit(p, a.dmg, p.pos.x - r.x, p.pos.z - r.z, a.kpow);
          if (o.onHitPlayer) o.onHitPlayer(res);
          removeAt(i);
        }
      }
    }
  }
  function clear() {
    while (shots.length) removeAt(0);
  }
  return {shootFromMob, shootFromAim, update, clear, count: () => shots.length};
}

/* ---------- 击杀观感(下界/探险/坦克演习场三份同形): 碎块 + 计数 toast + 尾回调 ----------
   尾回调挂模式政策(下界波次判定 / 探险任务记账 / 演习场清场表扬);
   verb 缺省「消灭」, 探险传「击杀」 */
function killBurst(m, count, cfg) {
  const o = cfg || {};
  Fx.debrisBurst(m.pos.x, m.pos.y + 0.8, m.pos.z, 6,
      {color: Mobs.debrisColor(m.type), life: 0.6});
  showToast('👾 ' + (o.verb || '消灭') + ' ' + count);
  if (o.after) o.after();
}

/* ---------- 死亡复位(复活不变量): 五字段清干净 — 阵亡去向政策留模式 ---------- */
function resetFighter(e) {
  e.dead = false; e.deadT = 0; e.flashT = 0; e.staggerT = 0; e.tintBase = [1, 1, 1];
}

/* ---------- 头顶血条(mkHpBar, S2): canvas 贴图 Sprite 的深接口 ----------
    探险/下界两模式的同形实现归一(自 mode-kit 迁入, C6-T3): 血量变化才重绘
    (逐帧纹理上传是移动端掉帧源); update 惰性建条(THREE/DOM/scene 缺任一即
    静默待命——Node 单测无渲染环境不参与行为断言), opts.visible() 可选回调
    控制显隐(下界: 只在下界显示; 缺省恒显)。Sprite 挂 scene/位置随玩家都收
    在 update 里, 调用方每帧只喂 {hp, maxHp, x, y, z}。128×16 贴图 →
    世界尺寸 1.5×0.19, 头顶 y+2.2 的口径由调用方给坐标。 */
function mkHpBar(opts) {
  const o = opts || {};
  let bar = null; let ctx = null; let tex = null; let last = -1;
  function ensure() {
    if (bar || typeof THREE === 'undefined' || typeof document === 'undefined' ||
        typeof scene === 'undefined') return;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 16;
    ctx = cv.getContext('2d');
    tex = new THREE.CanvasTexture(cv);
    bar = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true}));
    bar.scale.set(1.5, 0.19, 1); /* 128×16 的等比世界尺寸 */
    scene.add(bar);
  }
  function update(hp, maxHp, x, y, z) {
    ensure();
    if (!bar) return;
    bar.visible = o.visible ? o.visible() : true;
    if (!bar.visible) return;
    const h = Math.max(0, Math.ceil(hp));
    if (h !== last) {/* 血量变化才重绘 */
      last = h;
      const c = ctx; const W = 128;
      c.clearRect(0, 0, W, 16);
      c.fillStyle = 'rgba(16,16,20,0.82)'; c.fillRect(14, 3, W - 16, 10); /* 底槽 */
      c.fillStyle = '#e83a3a'; c.fillRect(16, 5, Math.max(0, (W - 20) * h / maxHp), 6); /* 血量 */
      c.strokeStyle = '#f0f0f0'; c.lineWidth = 1; c.strokeRect(14.5, 3.5, W - 17, 9);
      drawArt(c, BTN_PIX.heart.art, BTN_PIX.heart.map); /* 像素红心(字体 ❤ 各平台渲染不可控) */
      tex.needsUpdate = true;
    }
    bar.position.set(x, y, z); /* 头顶(身高 1.8 + 余量; billboard 正面视角也常读) */
  }
  function dispose() {
    if (!bar) return;
    if (typeof scene !== 'undefined') scene.remove(bar);
    bar.material.dispose(); tex.dispose();
    bar = null; ctx = null; tex = null; last = -1;
  }
  return {update, dispose};
}

const CombatKit = {mkFighter, mkHurtAlarm, mkMelee, mkArrows, killBurst, resetFighter, mkHpBar};
if (typeof module !== 'undefined' && module.exports) module.exports = CombatKit;
