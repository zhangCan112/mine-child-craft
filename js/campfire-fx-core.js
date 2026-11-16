'use strict';
/* ============================================================
   篝火特效核心 (CampfireFxCore) — 应用层 (术语见 GLOSSARY「篝火特效核心」)
   ------------------------------------------------------------
   篝火世界特效的观感状态单源(观感权威 docs/design/campfire-visual-spec.md §5):
   三常驻发射器(火苗/烟柱/柔柱+旋涡)的参数表+发射节拍+粒子推进、三过渡
   (点燃 pop+渐起/燃尽渐熄/浇熄白汽即刻摘)、燃尽临近渐弱窗与多篝火预算分档。
   藏住粒子怎么生怎么灭——调用方只拿句柄(开/三态摘/clear/喂刻/喂余量)与
   查询面(发射器快照/粒子清单/纯函数); 渲染归 js/effects.js 适配器, 玩法账
   (台账/燃尽时钟)归 campfire-kit, 本核心零玩法判定纯表现层。
   interface: CampfireFxCore.mkCampfireFx(opts{lowcore,columnH,fullTicks,
     distOf,seed}) → fx{open,quench,burnout,dig,clear,tick,active,activeCount,
     emitters,particles,setLeft,fadeState,columnOpacityAt,cells,now,params} /
     flameColorAt(u) / fadeTint(hex,k) / smokeRiseAt(u)
   依赖(全经 opts 注入, 调用期解析): lowcore 低核档旗标/columnH 柱满高/
     fullTicks 燃尽满刻/distOf(x,y,z)→玩家距/seed 确定性 rng 根——零全局名
     零引擎(THREE)零 DOM 零墙钟零裸随机
   可测性声明: 纯逻辑有同名单测(test/campfire-fx-core.test.js); 粒子随机走
     mulberry32 每源派生(texture-atlas 同款), 同格同流异格异流
   ============================================================ */
const CampfireFxCore = (function() {
  /* ---------- 确定性伪随机(mulberry32, texture-atlas 同款) + 每源派生 ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* 格坐标 → 独立种子: 同格同流(重开重放), 异格异流(多火相位错开, §5.2 建议) */
  function cellSeed(root, x, y, z) {
    let h = (root ^ 0x5EEDC9) >>> 0;
    h = Math.imul(h ^ x, 2654435761) >>> 0;
    h = Math.imul(h ^ y, 2654435761) >>> 0;
    h = Math.imul(h ^ z, 2654435761) >>> 0;
    return (h ^ (h >>> 13)) >>> 0;
  }

  /* ---------- 焰色三锚与插值纯函数(§5.2 色生命周期 / §5.8 渐弱插值) ---------- */
  const FLAME_A = '#ffff97';
  const FLAME_B = '#ff8f00';
  const FLAME_C = '#e05a1a';
  function mixHex(h1, h2, k) {
    const ch = (s, i) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
    const to = (v) => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    const out = [];
    for (let i = 0; i < 3; i++) out.push(to(ch(h1, i) + (ch(h2, i) - ch(h1, i)) * k));
    return '#' + out.join('');
  }
  /* 寿命进度 u∈[0,1] → 焰色: 出生/40%/80% 三锚段间连续插值, 段尾持色 */
  function flameColorAt(u) {
    const p = Math.max(0, Math.min(1, u));
    if (p <= 0.4) return mixHex(FLAME_A, FLAME_B, p / 0.4);
    if (p <= 0.8) return mixHex(FLAME_B, FLAME_C, (p - 0.4) / 0.4);
    return FLAME_C;
  }
  /* 渐弱插值: k=0 原色, k=1 全 #e05a1a(「火小了」的焰色通道) */
  function fadeTint(hex, k) {
    const t = Math.max(0, Math.min(1, k));
    return t <= 0 ? hex : mixHex(hex, FLAME_C, t);
  }
  /* 烟上升速度曲线: 初速 1.4 线性减速至 0.4(前快后慢=热烟, §5.3) */
  function smokeRiseAt(u) {
    const p = Math.max(0, Math.min(1, u));
    return 1.4 + (0.4 - 1.4) * p;
  }

  /* ---------- 渐弱窗纯状态(§5.8): 剩余刻 → 档位(双写口径 ≤10% ⇔ 最后 30s) ---------- */
  function mkFade(fullTicks) {
    const thr = fullTicks * 0.1;
    return function(left) {
      const rest = Math.max(0, left);
      if (rest > thr) {
        return {active: false, flameScale: 1, tint: 0, smokeScale: 1, columnScale: 1};
      }
      const prog = thr > 0 ? Math.min(1, (thr - rest) / thr) : 1;
      return {active: true, flameScale: 1 - 0.6 * prog, tint: prog,
        smokeScale: 1, columnScale: 1};
    };
  }

  function mkCampfireFx(opts) {
    const o = opts || {};
    const lowcore = !!o.lowcore;
    const columnH = (o.columnH > 0) ? o.columnH : 20;
    const fullTicks = (o.fullTicks > 0) ? o.fullTicks : 6000;
    const distOf = (typeof o.distOf === 'function') ? o.distOf : null;
    const rootSeed = (o.seed >>> 0) || 20261117;
    const fadeOf = mkFade(fullTicks);
    const RAMP_S = 0.5; /* 点燃渐起时长(§5.5-2: 火「噗」地起来, 不是瞬满) */
    const FAR_D = 40; /* 只留烟柱的距离界(§5.9) */
    const NEAR_N = 3; /* 全额档座数(§5.9: 第 4 座起降档) */
    const VORTEX_DIE_S = 0.8; /* 燃尽后旋涡存量散尽时长(≤2s 全清预算内) */

    /* ---------- 参数表单源(§5.2/§5.3/§5.4 定稿数值, 低核档速率减半 §5.9) ---------- */
    const params = {
      lowcore,
      flame: {rate: lowcore ? 3 : 6, rateLow: 3, lifeMin: 0.5, lifeMax: 0.7,
        riseMin: 0.9, riseMax: 1.3, driftAmp: 0.15, launchY: 0.4, scatter: 0.25,
        sizeMin: 0.10, sizeMax: 0.16, sizeEnd: 0.02, opacity: 0.9},
      smoke: {rate: lowcore ? 1 : 2, rateLow: 1, launchY: 1.2, scatter: 0.2,
        lifeMin: 3.5, lifeMax: 4.5, rise0: 1.4, rise1: 0.4, swayAmp: 0.35,
        swayPeriod: 2.5, size0: 0.14, size1: 0.55, color: '#d6d2c8', opacity0: 0.45},
      column: {diameter: 2.6, h: columnH, color: '#f5f7f3', opacityBase: 0.10,
        pulseAmp: 0.05, pulsePeriod: 3.7, lowOpacity: 0.06},
      vortex: {count: lowcore ? 8 : 16, countLow: 8, angVel: 1.3, radiusMin: 0.5,
        radiusMax: 1.1, rise: 3.0, riseJitter: 0.5, startH: 0.5, sizeMin: 0.08,
        sizeMax: 0.13, color: '#f5f7f3', opacity: 0.75, dir: -1},
    };

    let now = 0; /* 核心内时钟: 只由 tick(dt) 推进(零墙钟, 确定性重放) */
    const cellsMap = new Map(); /* posKey → 格特效态(开/摘共存, 摘后只余过渡尾巴) */

    const key = (x, y, z) => x + ',' + y + ',' + z;

    /* 柔柱脉动(§5.4): 0.10±0.05 正弦周期 3.7s; 低核档 0.06 常值(脉动砍) */
    function columnOpacityAt(t) {
      if (lowcore) return params.column.lowOpacity;
      return params.column.opacityBase +
        params.column.pulseAmp * Math.sin(2 * Math.PI * t / params.column.pulsePeriod);
    }

    /* ---------- 预算分档(§5.9): 同屏活跃 >3 座才按距排序降档(独火/少量火全额,
       渐弱窗内远火气柱不衰减的走查基线); >40 格只留烟柱同样只在降档席生效;
       distOf 缺席=全额档 ---------- */
    function computeBudget() {
      const out = new Map();
      const openKeys = [];
      for (const c of cellsMap.values()) if (c.open) openKeys.push(c);
      if (!distOf || openKeys.length <= NEAR_N) {
        for (const c of openKeys) out.set(key(c.x, c.y, c.z), 'full');
        return out;
      }
      const ranked = [];
      for (const c of openKeys) {
        const d = distOf(c.x, c.y, c.z);
        if (typeof d !== 'number' || !isFinite(d)) {
          out.set(key(c.x, c.y, c.z), 'full'); /* 距离缝无值=全额(装配前/测试语境容忍) */
          continue;
        }
        ranked.push({k: key(c.x, c.y, c.z), d});
      }
      ranked.sort((a, b) => a.d - b.d || (a.k < b.k ? -1 : 1));
      for (let i = 0; i < ranked.length; i++) {
        out.set(ranked[i].k, ranked[i].d > FAR_D ? 'far' : (i < NEAR_N ? 'full' : 'near'));
      }
      return out;
    }

    /* ---------- 发射粒子(确定性: 每粒固定序抽 rng, 错龄入场) ---------- */
    function spawnFlame(c, age0) {
      const fP = params.flame;
      const r = c.rng;
      c.flame.push({x0: c.x + (r() * 2 - 1) * fP.scatter, x: 0,
        y: c.y + fP.launchY, z0: c.z + (r() * 2 - 1) * fP.scatter, z: 0,
        life: fP.lifeMin + (fP.lifeMax - fP.lifeMin) * r(), age: age0,
        rise: fP.riseMin + (fP.riseMax - fP.riseMin) * r(),
        ph: r() * Math.PI * 2,
        size0: fP.sizeMin + (fP.sizeMax - fP.sizeMin) * r(),
        size: 0, opacity: fP.opacity, color: ''});
    }
    function spawnSmoke(c, age0) {
      const sP = params.smoke;
      const r = c.rng;
      c.smoke.push({x0: c.x + (r() * 2 - 1) * sP.scatter, x: 0,
        y: c.y + sP.launchY, z0: c.z + (r() * 2 - 1) * sP.scatter, z: 0,
        life: sP.lifeMin + (sP.lifeMax - sP.lifeMin) * r(), age: age0,
        ph: r() * Math.PI * 2, size: sP.size0, opacity: sP.opacity0, color: sP.color});
    }

    /* ---------- 句柄五纪律(§5.1): 开(幂等)/三态摘/clear/悬空无害/摘后重开 ---------- */
    function open(x, y, z) {
      const k = key(x, y, z);
      const prev = cellsMap.get(k);
      if (prev && prev.open) return; /* 幂等: 不重置渐起不重发 pop 不翻倍(恰一次) */
      const rng = mulberry32(cellSeed(rootSeed, x, y, z));
      const c = {x, y, z, open: true, openAt: now, rng,
        accF: rng() / params.flame.rate, /* 发射累积器初相按源派生(多火不齐闪) */
        accS: rng() / params.smoke.rate,
        emittedF: 0, emittedS: 0, left: fullTicks, tint: 0,
        flame: [], smoke: [], vortex: [], transients: []};
      /* §5.5-1 点燃 pop: 膨胀淡出球(hold=观感时长+淡出余持, 摘除面按 presence) */
      c.transients.push({kind: 'pop', color: '#ff8f00', r0: 0.3, r1: 1.6, dur: 0.35,
        opacity: 0.9, t: 0, hold: 0.35 + 0.25, x, y: y + params.flame.launchY, z});
      /* §5.4 旋涡粒子预建: 渐起期按下标序激活(确定性), 相位/半径/升速一次定格 */
      const v = params.vortex;
      for (let i = 0; i < v.count; i++) {
        c.vortex.push({ang: rng() * Math.PI * 2,
          r: v.radiusMin + (v.radiusMax - v.radiusMin) * rng(),
          rs: v.rise + (rng() * 2 - 1) * v.riseJitter,
          k0: rng(), size: v.sizeMin + (v.sizeMax - v.sizeMin) * rng(),
          born: (i + 1) / v.count, active: false, dying: 0,
          x, y, z, opacity: v.opacity, angleDir: v.dir});
      }
      cellsMap.set(k, c);
    }

    /* §5.7 浇熄: 三发射器即刻摘(无火苗残帧)+白汽 pop+4 粒 0.8s 上升 1 格/s */
    function quench(x, y, z) {
      const c = cellsMap.get(key(x, y, z));
      if (!c || !c.open) return; /* 悬空无害: 已摘/未知零炸零副作用 */
      c.open = false;
      c.flame.length = 0;
      c.smoke.length = 0;
      c.vortex.length = 0;
      c.transients.length = 0; /* 旧观感尾巴让位新过渡(白汽是摘除时刻的唯一事件面) */
      c.transients.push({kind: 'pop', color: '#f5f7f3', r0: 0.3, r1: 1.4, dur: 0.4,
        opacity: 0.6, t: 0, hold: 0.4 + 0.25, x, y: y + 0.6, z});
      for (let i = 0; i < 4; i++) {
        const r = c.rng;
        c.transients.push({kind: 'steam', color: '#f5f7f3', life: 0.8, hold: 0.8,
          age: 0, rise: 1.0, x: x + (r() * 2 - 1) * 0.2, y: y + 0.6,
          z: z + (r() * 2 - 1) * 0.2, size: 0.12 + r() * 0.1});
      }
    }

    /* §5.6 燃尽: 渐熄(火苗自然散/烟压帽/旋涡停补零补员)+轻灰 pop+尾烟一撮 3 粒 */
    function burnout(x, y, z) {
      const c = cellsMap.get(key(x, y, z));
      if (!c || !c.open) return; /* 悬空无害 */
      c.open = false;
      for (const p of c.smoke) p.life = Math.min(p.life, p.age + 1.6); /* ≤2s 全清预算 */
      for (const p of c.vortex) if (p.active) p.dying = 1e-6; /* 存量散散启动, 不补员 */
      c.transients.length = 0; /* 旧观感尾巴让位新过渡(轻灰散掉是本格此刻唯一事件面) */
      c.transients.push({kind: 'pop', color: '#d6d2c8', r0: 0.4, r1: 1.2, dur: 0.5,
        opacity: 0.5, t: 0, hold: 0.5 + 0.25, x, y: y + params.flame.launchY, z});
      for (let i = 0; i < 3; i++) {
        const r = c.rng;
        const life = 1.0 + r() * 0.5;
        c.transients.push({kind: 'tailSmoke', color: '#d6d2c8', life, hold: life,
          age: 0, rise: 0.6 + r() * 0.4,
          x: x + (r() * 2 - 1) * 0.25, y: y + 0.9, z: z + (r() * 2 - 1) * 0.25,
          size: 0.2 + r() * 0.2});
      }
    }

    /* 挖掘=回收非事件(§5.1): 即刻摘+零过渡零 pop; presence 口径——已摘格
       零副作用(燃尽渐熄尾巴不被后续记账路径吞掉, 摘除幂等) */
    function dig(x, y, z) {
      const c = cellsMap.get(key(x, y, z));
      if (!c || !c.open) return;
      cellsMap.delete(key(x, y, z));
    }

    /* clear 连带清场(§5.1): 模式切换/读档复位, 粒子零残留 */
    function clear() {
      cellsMap.clear();
    }

    /* ---------- 喂刻: 发射节拍/粒子推进/预算重排(§5.9)/渐弱窗生效(§5.8) ---------- */
    function tick(dt) {
      if (!(dt > 0)) return;
      now += dt;
      const budget = computeBudget();
      const fP = params.flame;
      const sP = params.smoke;
      const vP = params.vortex;
      for (const c of cellsMap.values()) {
        const k = key(c.x, c.y, c.z);
        const tier = budget.get(k) || 'full';
        const ramp = Math.max(0, Math.min(1, (now - c.openAt) / RAMP_S));
        if (c.open) {
          const fadeS = fadeOf(c.left);
          c.tint = fadeS.tint;
          const rateF = tier === 'far' ? 0 : (tier === 'near' ? fP.rate / 2 : fP.rate);
          /* 火苗发射: 渐弱窗内速率线性降档(§5.8); 渐起不侵计数(emitted=rate×t 口径) */
          c.accF += rateF * fadeS.flameScale * dt;
          let n = Math.floor(c.accF + 1e-9);
          if (n > 0) {
            c.accF -= n;
            c.emittedF += n;
            /* 错龄入场: 负预龄=本帧将老化掉的量, 老化后恰落在窗口内的发射时点 */
            for (let j = 0; j < n; j++) spawnFlame(c, -dt * (j + 1) / n);
          }
          /* 烟发射: 恒满额(降档清单没它/渐弱不衰减, §5.8/§5.9) */
          c.accS += sP.rate * dt;
          n = Math.floor(c.accS + 1e-9);
          if (n > 0) {
            c.accS -= n;
            c.emittedS += n;
            for (let j = 0; j < n; j++) spawnSmoke(c, -dt * (j + 1) / n);
          }
          /* 旋涡补员: 档位数×渐起(§5.5 渐起/§5.9 半数/远火 0), 摘后停补 */
          const target = Math.round((tier === 'far' ? 0 :
            (tier === 'near' ? vP.count / 2 : vP.count)) * ramp);
          for (let i = 0; i < c.vortex.length; i++) {
            const p = c.vortex[i];
            if (!p.active && !p.dying && i < target) p.active = true;
            else if (p.active && !p.dying && i >= target) p.active = false;
          }
        }
        /* 旋涡推进: 公转+上升, 柱顶回卷取模(portalBeam motes 同款); 摘后 dying 散散 */
        for (const p of c.vortex) {
          if (!p.active) continue;
          if (p.dying > 0) {
            p.dying += dt;
            p.opacity = vP.opacity * Math.max(0, 1 - p.dying / VORTEX_DIE_S);
            if (p.dying >= VORTEX_DIE_S) {
              p.active = false;
              continue;
            }
          }
          p.ang += vP.angVel * dt;
          p.k0 = (p.k0 + p.rs * dt / (columnH - vP.startH)) % 1;
          p.x = c.x + Math.cos(vP.dir * p.ang) * p.r;
          p.z = c.z + Math.sin(vP.dir * p.ang) * p.r;
          p.y = c.y + vP.startH + p.k0 * (columnH - vP.startH);
        }
        /* 火苗推进: 上升+正弦漂移, 尺寸收火/透明度线性降/焰色三锚随寿命 */
        for (let i = c.flame.length - 1; i >= 0; i--) {
          const p = c.flame[i];
          p.age += dt;
          if (p.age >= p.life) {
            c.flame.splice(i, 1);
            continue;
          }
          const u = p.age / p.life;
          p.y += p.rise * dt;
          p.x = p.x0 + fP.driftAmp * Math.sin(p.ph + now * 5.7);
          p.z = p.z0 + fP.driftAmp * Math.cos(p.ph * 1.7 + now * 4.3);
          p.size = p.size0 + (fP.sizeEnd - p.size0) * u;
          p.opacity = fP.opacity * (1 - u);
          p.color = fadeTint(flameColorAt(u), c.tint);
        }
        /* 烟推进: 前快后慢升+正弦摆, 膨胀散开/透明度线性降 */
        for (let i = c.smoke.length - 1; i >= 0; i--) {
          const p = c.smoke[i];
          p.age += dt;
          if (p.age >= p.life) {
            c.smoke.splice(i, 1);
            continue;
          }
          const u = p.age / p.life;
          p.y += smokeRiseAt(u) * dt;
          p.x = p.x0 + sP.swayAmp * Math.sin(p.ph + 2 * Math.PI * p.age / sP.swayPeriod);
          p.z = p.z0 + sP.swayAmp * Math.cos(p.ph * 1.3 + 2 * Math.PI * p.age / sP.swayPeriod);
          p.size = sP.size0 + (sP.size1 - sP.size0) * u;
          p.opacity = sP.opacity0 * (1 - u);
        }
        /* 过渡尾巴推进: pop 按观感时长(hold 内淡出余持), 汽/尾烟上升散尽 */
        for (let i = c.transients.length - 1; i >= 0; i--) {
          const tr = c.transients[i];
          if (tr.kind === 'pop') {
            tr.t += dt;
            if (tr.t >= tr.hold) c.transients.splice(i, 1);
          } else {
            tr.age += dt;
            tr.y += tr.rise * dt;
            if (tr.age >= tr.hold) c.transients.splice(i, 1);
          }
        }
      }
    }

    /* ---------- 查询面 ---------- */
    function active(x, y, z) {
      const c = cellsMap.get(key(x, y, z));
      return !!(c && c.open);
    }
    function activeCount() {
      let n = 0;
      for (const c of cellsMap.values()) if (c.open) n++;
      return n;
    }
    function setLeft(x, y, z, left) {
      const c = cellsMap.get(key(x, y, z));
      if (!c || !c.open) return; /* 未知格零炸(presence 口径) */
      c.left = left;
    }
    function fadeState(left) {
      return fadeOf(left);
    }
    function cellsList() {
      const out = [];
      for (const c of cellsMap.values()) out.push({x: c.x, y: c.y, z: c.z, open: c.open});
      return out;
    }
    function particles(x, y, z) {
      const c = cellsMap.get(key(x, y, z));
      if (!c) return {flame: [], smoke: [], vortex: [], transients: []};
      const vs = [];
      for (const p of c.vortex) if (p.active) vs.push(p);
      return {flame: c.flame, smoke: c.smoke, vortex: vs, transients: c.transients};
    }
    /* 发射器快照: budget 档位/rate 档后速率/rateScale=渐起×渐弱/emitted 守恒计数 */
    function emitters(x, y, z) {
      const c = cellsMap.get(key(x, y, z));
      if (!c || !c.open) return null;
      const tier = computeBudget().get(key(x, y, z)) || 'full';
      const fadeS = fadeOf(c.left);
      const ramp = Math.max(0, Math.min(1, (now - c.openAt) / RAMP_S));
      const rateF = tier === 'far' ? 0 : (tier === 'near' ? params.flame.rate / 2 : params.flame.rate);
      const countV = tier === 'far' ? 0 : (tier === 'near' ? params.vortex.count / 2 : params.vortex.count);
      return {budget: tier,
        flame: {rate: rateF, rateScale: ramp * fadeS.flameScale, emitted: c.emittedF,
          tint: fadeS.tint},
        smoke: {rate: params.smoke.rate, rateScale: ramp * fadeS.smokeScale,
          emitted: c.emittedS},
        vortex: {count: countV},
        column: {opacityScale: tier === 'far' ? 0 : 1,
          opacity: (tier === 'far' ? 0 : 1) * columnOpacityAt(now)}};
    }

    return {open, quench, burnout, dig, clear, tick, active, activeCount,
      emitters, particles, setLeft, fadeState, columnOpacityAt,
      cells: cellsList, now: () => now, params};
  }

  return {mkCampfireFx, flameColorAt, fadeTint, smokeRiseAt};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CampfireFxCore;
