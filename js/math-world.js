'use strict';
/* ============================================================
   Math World Track (数学世界轨装配, 术语见 GLOSSARY.md「数学世界轨」
   「世界轨驱动器」) — 应用层·库(世界轨驱动器 js/math-track.js 的 hop
   交互插件 — 混合宿主; 分发/生命周期/boss 串链由驱动器统一持有)
   ------------------------------------------------------------
   一句话职责: 把 HopWorld 纯核心出的题演成 3D 数字小路关卡 —— 装场
   (线性方块路/整十旗/起终点装饰, ≤32×32 草岛)、走子(Avatar 沿路走+
   逐格读数)、相机跟随与纯鼠标点选交互, 判分与出题零逻辑(全部在
   js/hop-world-core.js)。
   宿主形态(T4 样式基座上的混合宿主): mathRoot 切透明背景(m-world 类),
   世界渲染在画布上, 点选接球层(.m-w-catcher)收全部指针事件, 任务卡
   (.m-w-card)承载题面/骰子/数字选项 —— 全程不锁指针, DOM 可点、3D
   可点, 无键盘依赖(MISSION 纯点选口径); 不锁指针=主循环不跑物理,
   走子由本层自持 rAF 直接写 pos/vel(相机装置/玩家形象仍由主循环每帧
   照常驱动, 引擎层零改动)。
   玩法流(工单 T5): 规则语音(MATH_META.rule 在入场屏, 变体补充在本层)
   → 试次循环(掷骰/跳格/间隔问答 — 间隔题点出发旗走一遍数出来, 规律跳
   看前几次落格点下一次) → 逐试次 onTrial({ok, streak}) → end(st) 交回
   结算(mathPassed/mathStars/星显零改动)。
   交互射线: 点选/悬停走 CameraRig.holdAim(屏幕点)+aim(相机) 的触屏
   口径注入 + raycastVoxel —— 相机装置瞄准 seam 的"所见即所点"用法,
   一帧性注入不污染准星口径。
   interface: runHopWorld(section, h) → {stop()} ·
     section = {family:'hop', variant 'dice'|'jumps'|'gaps', tier, kind,
     params, seed} · h = {progress(k,n)?, onTrial({ok,streak})?, end(st)}
   依赖(均经全局名, 调用期解析): HopWorld(js/hop-world-core.js) ·
     mEl(js/math-paradigms.js, 加载序在本文件之前) ·
     RandCore.mkRand(js/rand-core.js, 加载序在本文件之前) ·
     loadScene/clearWorld/scene/camera(js/world.js) ·
     setBlockRaw/getBlock/raycastVoxel/pos/vel/yaw/pitch/onGround
     (js/voxel.js) · SceneKit(js/scene-kit.js) · ModeKit(js/mode-kit.js) ·
     CameraRig(js/camera-rig.js) · SpeechKit/sfx(js/speech.js·js/audio.js) ·
     mathPraiseLine/mathComfortLine(js/modes/math.js 应用层话术, 本文件
     加载在其之前, 调用期解析 — 与 math-paradigms 同款分层口径)
   可测性: THREE/DOM 全惰性(顶层零执行), Node 测试可安全加载(vm 直载,
     boot.test.js 全链冒烟兜底); 判分纯逻辑已下沉 hop-world-core(有单测)
   ============================================================ */

/* ---------- 世界轨场景常数(装场口径, 判分不读这里) ---------- */

const MATH_W_GROUND = 12; // 草岛顶层 y(坦克演习场同款高程)
/* 方块选型(config BLOCKS): 路面石砖13 · 连接格圆石4 · 整十格石英17 ·
   起点木板6 · 终点灯块19 · 旗杆木5 · 旗面蓝羊毛15/红羊毛16/黄羊毛14 */
const MATH_W_BLOCKS = {
  path: 13, link: 4, decade: 17, start: 6, goal: 19,
  pole: 5, flagBlue: 15, flagRed: 16, flagYellow: 14,
};
const MATH_W_CAM_PITCH = -0.72; // 俯视跟随镜头(脚下与前方数格同框)
/* 走子速度(格/秒): 复位快走 / 数数慢走(unit=10 读数更长, 再慢些) */
const MATH_W_FAST = 4.2;
const MATH_W_COUNT = 1.35;
const MATH_W_COUNT10 = 1.05;

/* 计时器收口: stop 一次清空(math-paradigms mTimers 同构的本地副本,
   不跨引擎复用是刻意的 — 两轨生命周期不同) */
function mWTimers() {
  const ts = [];
  return {
    after(ms, fn) {
      const id = setTimeout(() => {
        const k = ts.indexOf(id);
        if (k >= 0) ts.splice(k, 1);
        fn();
      }, ms);
      ts.push(id);
      return id;
    },
    stop() {
      ts.forEach((id) => clearTimeout(id));
      ts.length = 0;
    },
  };
}

/* 数字贴片: canvas → CanvasTexture → Sprite(mkHpBar 同款管线, 静态一次
   绘制), 白字黑边任何底色可读; 大号金色用于整十格(位值醒目) */
function mWNumSprite(text, x, y, z, big) {
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 96;
  const c = cv.getContext('2d');
  c.font = 'bold ' + (big ? 54 : 46) + 'px "Segoe UI", Arial, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = big ? 9 : 7;
  c.strokeStyle = 'rgba(20,22,30,0.9)';
  c.strokeText(String(text), 48, 50);
  c.fillStyle = big ? '#ffd83d' : '#ffffff';
  c.fillText(String(text), 48, 50);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true, depthWrite: false}));
  const s = big ? 1.5 : 1.06;
  sp.scale.set(s, s, 1);
  sp.position.set(x, y, z);
  return sp;
}

function mWDisposeSprite(sp) {
  sp.material.map.dispose();
  sp.material.dispose();
}

/* ---------- 掷骰前进 / 跳格子 / 间隔问题 的世界装配 ---------- */

/* hop 世界关卡主入口: 返回 {stop()}; 判分/出题在 HopWorld, 本函数只演 */
function runHopWorld(section, h) {
  const hh = h || {};
  const p = Object.assign({}, section.params || {});
  const plan = HopWorld.hopPathPlan(p);
  const rnd = RandCore.mkRand(section.seed !== undefined ? section.seed : p.seed);
  const T = mWTimers();
  const G = MATH_W_GROUND;
  const pathMax = plan.value(plan.last);
  const n = MathTrackCore.clampTrials(p.trials);
  const loop = MathTrackCore.mkTrialLoop(); /* 试次循环骨架(T3 并一): 记分与节拍决策在纯核心 */
  const stats = loop.stats;
  const speak = (s) => {
    if (typeof SpeechKit !== 'undefined' && SpeechKit) SpeechKit.speak(s);
  };
  const sfxSafe = (k) => {
    if (typeof sfx === 'function') sfx(k);
  };

  /* ===== 装场(场景装填纪律: 进场装场, 退出清场, 不写建造存档) ===== */
  const squareAt = new Map(); // "x,z" → 格下标(点选命中换算)
  const sprites = [];
  const marks = []; // 试次临时标记 [{x,y,z,prev}] — 下一试次/退场恢复
  let hoverBox = null;

  function buildScene() {
    loadScene(() => {
      const b = plan.bounds;
      const m = HopWorld.HOP_MARGIN;
      /* 草岛基底(浮岛观感): 泥土芯 + 草顶, 幅面 ≤32×32(纯核心测试锁定) */
      SceneKit.fill(b.x1 - m, G - 3, b.z1 - m, b.x2 + m, G - 1, b.z2 + m, 2);
      SceneKit.fill(b.x1 - m, G, b.z1 - m, b.x2 + m, G, b.z2 + m, 1);
      /* 数格入表(点选命中的唯一权威), 再铺全路(含蛇行折返连接格=圆石) */
      for (let i = 0; i <= plan.last; i++) {
        const c = plan.at(i);
        squareAt.set(c.x + ',' + c.z, i);
      }
      const route = HopWorld.hopRoute(plan, 0, plan.last);
      for (const c of route) {
        const sq = squareAt.get(c.x + ',' + c.z);
        let id = MATH_W_BLOCKS.path;
        if (sq === undefined) id = MATH_W_BLOCKS.link;
        else if (sq === 0) id = MATH_W_BLOCKS.start;
        else if (sq === plan.last) id = MATH_W_BLOCKS.goal;
        else if (plan.isDecade(sq)) id = MATH_W_BLOCKS.decade;
        setBlockRaw(c.x, G + 1, c.z, id);
      }
      /* 路侧装饰全部放南侧(z+1 — 相机侧, 孩子看得清; 路面留净给走子):
         起点拱门骑在 0 号格上 · 终点大旗 · 整十一档红旗(位值) */
      const s0 = plan.at(0);
      SceneKit.fill(s0.x, G + 1, s0.z + 1, s0.x, G + 3, s0.z + 1, MATH_W_BLOCKS.pole);
      SceneKit.fill(s0.x, G + 1, s0.z - 1, s0.x, G + 3, s0.z - 1, MATH_W_BLOCKS.pole);
      SceneKit.fill(s0.x, G + 4, s0.z - 1, s0.x, G + 4, s0.z + 1, MATH_W_BLOCKS.start);
      const gl = plan.at(plan.last);
      SceneKit.fill(gl.x, G + 1, gl.z + 1, gl.x, G + 4, gl.z + 1, MATH_W_BLOCKS.pole);
      setBlockRaw(gl.x + 1, G + 4, gl.z + 1, MATH_W_BLOCKS.flagBlue);
      if (p.landmark) { // 整十小旗: 曲线 tier6 起开(十格一档标位值)
        for (let i = 10; i < plan.last; i += HopWorld.HOP_ROW) {
          const c = plan.at(i);
          SceneKit.fill(c.x, G + 1, c.z + 1, c.x, G + 2, c.z + 1, MATH_W_BLOCKS.pole);
          setBlockRaw(c.x, G + 3, c.z + 1, MATH_W_BLOCKS.flagRed);
        }
      }
      /* 岛缘两棵树(先路后树: SceneKit.tree 只种空格, 不压路; 放北侧避开
         南侧相机与路侧旗) */
      SceneKit.tree(b.x1 - 2, G + 1, b.z1 - 2);
      SceneKit.tree(b.x2 + 2, G + 1, b.z1 - 2);
      /* 每格数字贴片(整十格大号金色 — 十格一档的位值读法)。贴片悬于
         路面上方防遮挡: 路块占 y∈[G+1,G+2], 原锚点 G+1+0.62/2.05 落在
         路块内部, 字面几乎被块顶盖住 — 锚点口径对齐 hoverBox(G+2+0.14,
         块顶之上), 整十格再抬一层保持错层关系 */
      for (let i = 0; i <= plan.last; i++) {
        const c = plan.at(i);
        const sp = mWNumSprite(plan.value(i), c.x + 0.5,
            G + 2 + (plan.isDecade(i) ? 1 : 0) + 0.12, c.z + 0.5, plan.isDecade(i));
        scene.add(sp);
        sprites.push(sp);
      }
    });
  }

  function clearMarks() {
    for (const mk of marks) setBlockRaw(mk.x, mk.y, mk.z, mk.prev);
    marks.length = 0;
  }
  function addMark(x, y, z, id) {
    marks.push({x, y, z, prev: getBlock(x, y, z)});
    setBlockRaw(x, y, z, id);
  }
  /* 试次旗标(路侧南侧 z+1: 短杆+色旗, 不挡走子; 点旗=点格, 见命中换算) */
  function markSquare(i, id) {
    const c = plan.at(i);
    if (!c) return;
    addMark(c.x, G + 1, c.z + 1, MATH_W_BLOCKS.pole);
    addMark(c.x, G + 2, c.z + 1, id);
  }

  /* ===== 混合宿主 DOM: 点选接球 + 任务卡 + 反馈闪条 ===== */
  const rootEl = (typeof document !== 'undefined') ? document.getElementById('mathRoot') : null;
  let catcher = null; let card = null; let flash = null; let crosshairEl = null;
  const areaEl = (typeof document !== 'undefined') ? document.getElementById('mArea') : null;

  function buildDom() {
    if (!rootEl) return;
    rootEl.classList.add('m-world');
    catcher = mEl('div', 'm-w-catcher');
    card = mEl('div', 'm-w-card');
    flash = mEl('div', 'm-w-flash');
    rootEl.appendChild(catcher);
    rootEl.appendChild(card);
    rootEl.appendChild(flash);
    if (areaEl) areaEl.style.display = 'none'; // boss 世界节: 屏流训练区让位
    crosshairEl = document.getElementById('crosshair');
    if (crosshairEl) crosshairEl.style.display = 'none'; // 点选跟手, 准星退役
    catcher.addEventListener('pointerdown', onPointerDown);
    catcher.addEventListener('pointermove', onPointerMove);
    catcher.addEventListener('pointerleave', onPointerLeave);
  }
  function teardownDom() {
    if (catcher) {
      catcher.removeEventListener('pointerdown', onPointerDown);
      catcher.removeEventListener('pointermove', onPointerMove);
      catcher.removeEventListener('pointerleave', onPointerLeave);
    }
    for (const el of [catcher, card, flash]) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    catcher = null; card = null; flash = null;
    if (crosshairEl) crosshairEl.style.display = '';
    if (areaEl) areaEl.style.display = '';
    if (rootEl) rootEl.classList.remove('m-world');
  }

  /* 悬停高亮盒(点选目标的即时反馈; 命中色/答案揭示色复用同一盒) */
  function ensureHover() {
    if (hoverBox || typeof THREE === 'undefined' || typeof scene === 'undefined') return;
    hoverBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.26, 1.08),
        new THREE.MeshBasicMaterial({color: 0xffd83d, transparent: true, opacity: 0.5, depthWrite: false}));
    hoverBox.visible = false;
    scene.add(hoverBox);
  }
  function showHover(i, color) {
    ensureHover();
    if (!hoverBox) return;
    const c = plan.at(i);
    hoverBox.material.color.setHex(color || 0xffd83d);
    hoverBox.position.set(c.x + 0.5, G + 2 + 0.14, c.z + 0.5);
    hoverBox.visible = true;
  }
  function hideHover() {
    if (hoverBox) hoverBox.visible = false;
  }

  /* ===== 交互射线: 屏幕点 → holdAim 注入 → 相机装置 aim → 体素射线;
     路侧旗(z+1)命中折算回它的格 — 点旗=点格 ===== */
  function squareFromScreen(px, py) {
    CameraRig.holdAim({x: px, y: py, w: innerWidth, h: innerHeight});
    const aim = CameraRig.aim(camera);
    CameraRig.holdAim(null); // 一帧性注入, 不污染主循环准星口径
    const hit = raycastVoxel(aim.origin, aim.dir, 64);
    if (!hit) return null;
    const direct = squareAt.get(hit.x + ',' + hit.z);
    if (direct !== undefined) return direct;
    const viaFlag = squareAt.get(hit.x + ',' + (hit.z - 1));
    return viaFlag === undefined ? null : viaFlag;
  }

  /* ===== 走子: 沿 hopRoute 逐格推进, 逐格读数 ===== */
  let walk = null; // {pts:[{x,z,sq}], i, prog(段内已走,跨帧记账), speed, count(fn?), onDone, to}
  let cur = 0; // 当前所在格下标(试次间延续, 走满一条路的数序)
  let phase = 'idle'; // idle|die|pick-target|pick-start|choice|walking|done
  let trial = null; // 当前试次数据(HopWorld 纯核心产物)

  function startWalk(fromIdx, toIdx, opts) {
    const o = opts || {};
    const route = HopWorld.hopRoute(plan, fromIdx, toIdx);
    const pts = route.map((c) => ({x: c.x + 0.5, z: c.z + 0.5,
      sq: squareAt.get(c.x + ',' + c.z)}));
    phase = 'walking';
    walk = {pts, i: 0, prog: 0, speed: o.speed || MATH_W_FAST,
      count: o.count || null, onDone: o.onDone || null, to: toIdx};
    pos.set(pts[0].x, G + 2, pts[0].z);
  }
  function stepWalk(dt) {
    if (!walk) return;
    /* 本帧预算并入段内已走 prog: dt 被 frame() 钳到 ≤0.05s, 单帧
       speed×dt 凑不足一格, 段内进度必须跨帧记账 — 否则每帧从段起点
       重算, 走子永远停在首段一小截(掷骰后不前进的死锁根源) */
    let dist = walk.speed * dt + walk.prog;
    while (dist > 0 && walk.i < walk.pts.length - 1) {
      const a = walk.pts[walk.i];
      const b = walk.pts[walk.i + 1];
      const dx = b.x - a.x; const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      if (dist >= len) { // 走完这一段
        dist -= len;
        walk.i++;
        walk.prog = 0;
        const hitSq = walk.pts[walk.i];
        pos.set(hitSq.x, G + 2, hitSq.z);
        if (hitSq.sq !== undefined && walk.count) walk.count(hitSq.sq);
        continue;
      }
      walk.prog = dist; // 残余进度留在段内, 下帧续走
      pos.set(a.x + dx / len * dist, G + 2, a.z + dz / len * dist);
      vel.set(dx / len * 2.6, 0, dz / len * 2.6); // 走路动画喂数(玩家形象)
      dist = 0;
    }
    if (walk.i >= walk.pts.length - 1) {
      const done = walk.onDone;
      const to = walk.to;
      walk = null;
      vel.set(0, 0, 0);
      cur = to;
      if (done) done();
    }
  }

  /* ===== 试次循环 ===== */
  let idx = 0;
  let stopped = false;
  let rafId = 0;
  let lastT = 0;
  let flashT = 0;

  function settle(ok) {
    const ev = loop.settle(ok); /* 记分+节拍决策(表扬/安慰口径唯一在核心) */
    sfxSafe(ev.ok ? 'pick' : 'click');
    if (hh.onTrial) hh.onTrial({ok: ev.ok, streak: ev.streak});
    if (ev.praise && typeof mathPraiseLine === 'function') {
      speak(mathPraiseLine()); // 过程性表扬(话术住模式层)
    }
    if (ev.comfort && typeof mathComfortLine === 'function') {
      speak(mathComfortLine());
    }
    flashFeedback(ok);
  }

  function flashFeedback(ok) {
    if (!flash) return;
    flash.textContent = ok ? '✅ 真棒！' : '🙂 没关系，再想一想';
    flash.className = 'm-w-flash show ' + (ok ? 'good' : 'bad');
    clearTimeout(flashT);
    flashT = setTimeout(() => {
      if (flash) flash.className = 'm-w-flash';
    }, 900);
  }

  function nextTrial() {
    if (stopped) return;
    clearMarks();
    hideHover();
    if (idx >= n) {
      phase = 'done';
      loop.end();
      T.after(500, () => {
        teardown();
        if (hh.end) hh.end(stats);
      });
      return;
    }
    if (hh.progress) hh.progress(idx, n);
    idx++;
    trial = null;
    if (section.variant === 'dice') trialDice();
    else if (section.variant === 'jumps') trialJump();
    else trialGap();
  }

  /* ---- 掷骰前进: 点骰子 → 骰值+出发点 → 走子念步数(1格2格…) → 问落格数字 ---- */
  function trialDice() {
    phase = 'die';
    setCard('<div class="m-w-q">🎲 掷骰子，走一走！</div>' +
        '<button class="m-w-die" id="mWDie"><span class="m-w-pips" id="mWPips"></span>掷骰子</button>');
    const btn = document.getElementById('mWDie');
    if (btn) {
      btn.onclick = () => {
        if (phase !== 'die') return;
        const st = HopWorld.hopDiceStep(plan, rnd, cur);
        const rollDie = () => {
          paintPips(st.roll);
          speak('掷出了 ' + st.roll + '！从第 ' + plan.value(st.from) + ' 格出发！');
          T.after(2000, () => {
            startWalk(st.from, st.to, {
              speed: countSpeed(),
              /* 念步数不念格号(用户 2026-10-25 建议): 题面是"站在哪格",
                 念格号(哪怕少最后一拍)仍是变相报答案; 念"从第 4 格出发,
                 走 1 格、2 格、3 格"把加法结构 4+3 唱给孩子听, 落格由
                 孩子自己算。大数带(unit=10)念累计数 10/20/30(整十数加减
                 同款脚手架), 不带"格"字 — 走 3 块石板不是 10 格 */
              count: (sq) => {
                const k = sq - st.from;
                speak(plan.unit === 1 ? k + ' 格' : String(k * plan.unit));
              },
              onDone() {
                /* 落格截断(min(from+roll,last)): 念出的步数少于骰面,
                   补一句说明 — 否则孩子以为念漏了或骰子骗人 */
                if (st.to - st.from < st.roll) speak('到头啦，停在这里！');
                const q = '现在站在哪块石板？数字是几？';
                askChoices(q, plan.value(st.to), pathMax, null);
                speak(q); // 零文字依赖: 题面随卡读出(jumps/gaps 变体同款)
              },
            });
          });
        };
        if (st.wrap && cur !== st.from) { // 临近终点: 先回起点再掷(数序走满整条路)
          speak('我们回到起点，再走一次！');
          T.after(600, () => startWalk(cur, 0, {speed: MATH_W_FAST, onDone: rollDie}));
        } else {
          cur = st.from;
          rollDie();
        }
      };
    }
    if (idx === 1) speak('点骰子，掷一掷，看看走几格！');
  }

  function paintPips(v) {
    const el = document.getElementById('mWPips');
    if (!el) return;
    el.innerHTML = '';
    el.dataset.v = v;
    const cells = {1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]}[v] || [4];
    for (let k = 0; k < 9; k++) {
      const d = document.createElement('i');
      if (cells.includes(k)) d.className = 'on';
      el.appendChild(d);
    }
  }

  /* ---- 跳格子任务: 前跳/往回跳点落格, 倒推答步数(两端旗) ---- */
  function trialJump() {
    const t = HopWorld.hopJumpTrial(plan, p, rnd, cur);
    trial = t;
    const begin = () => {
      const fromV = plan.value(t.from);
      if (t.form === 'rev') {
        markSquare(t.to, MATH_W_BLOCKS.flagBlue);
        const q = '从小旗 ' + fromV + ' 到小旗 ' + plan.value(t.to) + '，要跳几格？';
        askChoices(q, t.answer, 12, () => demoCount(t.from, t.to, 'fwd'));
        speak(q);
      } else {
        const back = t.form === 'back';
        const q = '从 ' + fromV + ' 出发，' + (back ? '往回' : '向前') + '跳 ' + t.n + ' 格，落在哪里？';
        phase = 'pick-target';
        setCard('<div class="m-w-q">' + q + '</div><div class="m-w-hint">👆 点要落在的那块石板</div>');
        speak(q);
        if (idx === 1 && !back) speak('听题目，点一点要跳到的那块石板！');
      }
    };
    if (t.from !== cur) { // 无前跳空间回起点 / 试次衔接: 先走到出发点
      startWalk(cur, t.from, {speed: MATH_W_FAST, onDone: begin});
    } else {
      begin();
    }
  }

  /* 答题后的示范走子(答案在脚下走一遍 — 往回跳倒着数) */
  function demoCount(fromIdx, toIdx, form) {
    startWalk(fromIdx, toIdx, {
      speed: countSpeed(),
      count: (sq) => {
        if (sq === fromIdx) return;
        if (form !== 'back' || sq <= toIdx) speak(plan.value(sq));
      },
      onDone: () => T.after(600, nextTrial),
    });
  }

  /* ---- 间隔问题+规律跳(挑战): 先走一遍数出来 / 看规律点下一落格 ---- */
  function trialGap() {
    const g = HopWorld.hopGapTrial(plan, p, rnd);
    trial = g;
    if (g.sub === 'interval') {
      const aV = plan.value(g.aIdx);
      const bV = plan.value(g.bIdx);
      markSquare(g.aIdx, MATH_W_BLOCKS.flagRed);
      markSquare(g.bIdx, MATH_W_BLOCKS.flagBlue);
      const qs = {
        neither: '从小旗 ' + aV + ' 走到小旗 ' + bV + '，中间经过几块石板？',
        both: '从小旗 ' + aV + ' 走到小旗 ' + bV + '，一共踩到几块石板？',
        one: '从小旗 ' + aV + ' 跳到小旗 ' + bV + '，要跳几格？',
      };
      const begin = () => {
        phase = 'pick-start';
        setCard('<div class="m-w-q">' + qs[g.mode] + '</div>' +
            '<div class="m-w-hint">👆 先点红色出发小旗，走一走数一数</div>');
        speak(qs[g.mode] + '先点红色出发小旗！');
      };
      if (cur !== g.aIdx) startWalk(cur, g.aIdx, {speed: MATH_W_FAST, onDone: begin});
      else begin();
    } else {
      /* 规律跳: 依次亮出前几次落格(黄旗+落地读数), 问下一次落哪 */
      const vals = g.seq.map((v) => plan.value(v));
      const begin = () => {
        let k = 0;
        const hopNext = () => {
          if (stopped) return;
          if (k >= g.seq.length) {
            const q = '按这个规律，第 ' + (g.seq.length + 1) + ' 次落在哪里？';
            phase = 'pick-target';
            setCard('<div class="m-w-q">' + q + '</div>' +
                '<div class="m-w-seq">' +
                vals.map((v) => '<span class="m-slot m-numslot">' + v + '</span>').join('') +
                '<span class="m-slot m-blank">?</span></div>' +
                '<div class="m-w-hint">👆 点下一块落脚的石板</div>');
            speak(q);
            return;
          }
          const to = g.seq[k];
          markSquare(to, MATH_W_BLOCKS.flagYellow);
          startWalk(k === 0 ? g.seq[0] : g.seq[k - 1], to, {
            speed: MATH_W_FAST,
            onDone() {
              speak('第 ' + (k + 1) + ' 次落在 ' + vals[k]);
              k++;
              T.after(700, hopNext);
            },
          });
        };
        hopNext();
      };
      if (cur !== g.seq[0]) startWalk(cur, g.seq[0], {speed: MATH_W_FAST, onDone: begin});
      else begin();
      if (idx === 1) speak('看一看每次落在哪，找找规律！');
    }
  }

  /* 间隔题的"走一遍": 点出发旗 → 走到终点旗, 读数口径随两端模式 */
  function walkInterval(g) {
    startWalk(g.aIdx, g.bIdx, {
      speed: countSpeed(),
      count: (sq) => {
        if (g.mode === 'both') speak(plan.value(sq)); // 两端都踩: 全读
        else if (g.mode === 'neither') { // 只数中间: 出发与终点都不读
          if (sq > g.aIdx && sq < g.bIdx) speak(plan.value(sq));
        } else if (sq > g.aIdx) speak(plan.value(sq)); // 只算一端: 跳过的每格都读
      },
      onDone() {
        askChoices('', g.answer, 12, null);
        speak('数好了吗？点出你的答案！');
      },
    });
  }

  /* ---- 问答小卡: 数字选项(恰 4 项, ≤4 组块红线) ---- */
  function askChoices(q, answer, hi, after) {
    phase = 'choice';
    const vals = HopWorld.hopChoices(rnd, answer, hi);
    let html = '<div class="m-w-q">' + (q || '🔢 点出答案') + '</div><div class="m-nums">';
    for (const v of vals) html += '<button class="m-choice m-num" data-v="' + v + '">' + v + '</button>';
    html += '</div>';
    setCard(html);
    card.querySelectorAll('.m-choice').forEach((b) => {
      b.onclick = () => {
        if (phase !== 'choice') return;
        const ok = +b.dataset.v === answer;
        b.classList.add(ok ? 'good' : 'bad');
        settle(ok);
        if (after) after(ok);
        else T.after(900, nextTrial);
      };
    });
  }

  function countSpeed() {
    return plan.unit === 1 ? MATH_W_COUNT : MATH_W_COUNT10;
  }

  function setCard(html) {
    if (!card) return;
    card.innerHTML = html;
    /* pick 阶段任务卡放行点击(css .m-w-card.pick-through =
       pointer-events:none): 下缘落格被卡带遮住时点击穿透到接球层,
       不再落卡上无反馈; choice/die 阶段恢复可点(数字选项/骰钮在卡内)。
       每条 setCard 路径都先定 phase 再写卡, 类名跟 phase 同步 */
    if (phase === 'pick-target' || phase === 'pick-start') {
      card.classList.add('pick-through');
    } else {
      card.classList.remove('pick-through');
    }
  }

  /* ===== 指针事件(点选接球层): 点格(=点路侧旗) / 悬停 ===== */
  function onPointerDown(e) {
    if (stopped || (phase !== 'pick-target' && phase !== 'pick-start')) return;
    const i = squareFromScreen(e.clientX, e.clientY);
    if (i === null) return;
    if (phase === 'pick-start') { // 间隔题: 只认出发旗(点错不判分, 温柔指路)
      if (i === trial.aIdx) {
        hideHover();
        walkInterval(trial);
      } else {
        speak('点红色出发小旗哦！');
      }
      return;
    }
    /* pick-target: 一次点击定对错, 答错即时揭示正确落格再走过去 */
    const target = trial.to !== undefined ? trial.to : trial.next;
    const ok = i === target;
    settle(ok);
    if (!ok) {
      showHover(target, 0x7cfc00);
      speak('看，落在这里！');
    }
    const from = cur;
    T.after(ok ? 350 : 1200, () => {
      hideHover();
      startWalk(from, target, {
        speed: countSpeed(),
        count: (sq) => {
          if (sq !== from) speak(plan.value(sq));
        },
        onDone: () => T.after(450, nextTrial),
      });
    });
  }

  function onPointerMove(e) {
    if (stopped) return;
    if (phase !== 'pick-target' && phase !== 'pick-start') {
      hideHover();
      if (catcher) catcher.style.cursor = 'default';
      return;
    }
    const i = squareFromScreen(e.clientX, e.clientY);
    const wanted = phase === 'pick-start' ? trial.aIdx : null;
    if (i === null || (wanted !== null && i !== wanted)) {
      hideHover();
      if (catcher) catcher.style.cursor = 'default';
      return;
    }
    showHover(i);
    if (catcher) catcher.style.cursor = 'pointer';
  }
  function onPointerLeave() {
    hideHover();
  }

  /* ===== 自持 rAF: 走子推进 + 姿态(相机/形象由主循环照常驱动) ===== */
  function frame(t) {
    if (stopped) return;
    rafId = requestAnimationFrame(frame);
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    lastT = t;
    stepWalk(dt);
    onGround = true; // 不锁指针主循环不跑物理: 姿态由本层自持
    pitch = MATH_W_CAM_PITCH; // 俯视: 直路跟在身后(yaw 朝东), 蛇行朝北俯瞰
    yaw = plan.line ? -Math.PI / 2 : 0;
    if (!walk) vel.set(0, 0, 0);
  }

  /* ===== 生命周期 ===== */
  function teardown() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(rafId);
    T.stop();
    clearTimeout(flashT);
    walk = null;
    clearMarks();
    hideHover();
    for (const sp of sprites) {
      scene.remove(sp);
      mWDisposeSprite(sp);
    }
    sprites.length = 0;
    if (hoverBox) {
      scene.remove(hoverBox);
      hoverBox.geometry.dispose();
      hoverBox.material.dispose();
      hoverBox = null;
    }
    vel.set(0, 0, 0);
    teardownDom();
    clearWorld(); // 场景装填纪律: 退出清场(幂等), 不写建造存档
  }

  /* ===== 起场 ===== */
  buildScene();
  buildDom();
  const s0 = plan.at(0);
  ModeKit.spawn(s0.x + 0.5, G + 2, s0.z + 0.5, {yaw: plan.line ? -Math.PI / 2 : 0});
  vel.set(0, 0, 0);
  onGround = true;
  pitch = MATH_W_CAM_PITCH;
  yaw = plan.line ? -Math.PI / 2 : 0;
  rafId = requestAnimationFrame(frame);
  nextTrial();
  return {stop: teardown};
}

if (typeof module !== 'undefined' && module.exports) module.exports = {runHopWorld};
