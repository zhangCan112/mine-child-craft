'use strict';
/* ============================================================
   Focus Paradigms (专注五范式引擎) — 引擎层
   ------------------------------------------------------------
   一句话职责: 藏住四类点选式判别游戏的试次生成/计时/自适应与结算,
   调度层只给参数与 handler, 拿回统计; 引擎不知道奖励/背包/图章。
   interface: mkAdapt(failCount) · runDiscrimination(area, params, adapt, h, framing) ·
     runFlanker(area, params, adapt, h) · runCorsi(area, params, adapt, h) ·
     runSwitch(area, params, adapt, h) · runSearch(area, params, adapt, h) ·
     withDim(h, dim) · focusDispatch(level) · runFocusLevel(level, area, h, failCount)
   依赖(均经全局名, 调用期解析): SpeechKit(js/speech.js) · sfx(js/audio.js) ·
     stimIcon→iconOf(js/icons.js)/mcIcon(js/focus-icons.js) ·
     mobFace→pigFace/sheepFace(js/focus-icons.js)/Mobs.face(js/mobs.js) ·
     FOCUS_META(js/focus-levels.js); 本文件只被模式层调用, 不反向依赖模式层
   可测性: DOM 惰性创建(仅 document) · Node 测试可安全加载, 有驱动缝单测
     (test/focus-paradigms.test.js, vm 直测)
   ------------------------------------------------------------
   F2 关内行为(参数形状权威=focus-levels.js 头注释):
   判别: No-Go 逐试次按 disguiseRate 掷骰伪装(中=绿宝石/不中=显性
   干扰), noSet 扩 coal/iron_ore · Corsi: lenMix 混出 len-1 ·
   antiChunk 展示前置换打乱格位 · gem 轮换亮格宝石 · Flanker: len9
   小尺寸档 + neutralRate 中立行(猪/羊) + mobMix 混入非苦力怕生物 ·
   Switch: choices 5 选项 + bivalent 双价干扰 + switchJitter 切换抖动 ·
   Search(2026-10 第六维): 回合制自定步调划消, 干扰按回合渐入 + 绿宝石
   similarMix 相似混入(参数形状见 paramsFor D6)
   教学脚手架(Sesame 三级反馈的教学关落地, 2026-10): 教学关(kind=tutorial,
   经 runFocusLevel 注入 params.scaffold)答错不惩罚只重教 — 判别=漏点高亮
   刺激+句尾指引/误点念「不点」; Flanker=高亮中间只+念方向; Corsi=原序列
   重演一遍; Switch=高亮正确方块。仅教学关生效, 正式关零改动
   事件缝: handler 可选 h.onTrial({ok, streak}) — 每正式试次恰一次,
   教学演示不计; 维度名由 runFocusLevel 调度层补注(引擎不知道玩法,
   分层红线); 干扰物/宝石图标走 stimIcon(iconOf 优先, mcIcon 兜底),
   生物头像走 mobFace(单一出口 seam: 中立猪/羊=训练营像素库, 混入=怪物库)
   ============================================================ */

/* 语音已归引擎侧 SpeechKit(js/speech.js): 范式引擎只调用 speak/cancel, 不再拥有语音技术
   表扬/安慰话术(FOCUS_PRAISE/COMFORT 与 praiseLine/comfortLine)按分层口径属
   应用层文案, 已移居 js/modes/focus.js(本文件加载在前, 调用期全局解析) */

/* ---------- 阶梯自适应:目标 70~85% 成功率;连错 3 次开挫败阀 ----------
   重试放宽政策只在引擎这一处: 失败次数 ×12%/次, 封顶 +40%(零惩罚哲学) */
function mkAdapt(failCount) {
  const hist = [];
  return {
    calib: 1 + Math.min(0.4, 0.12*(failCount||0)), // 时间参数乘数:>1 更宽松
    streak: 0,
    valveCount: 0,
    record(ok) {
      hist.push(ok?1:0); if (hist.length>8) hist.shift();
      this.streak = ok ? 0 : this.streak+1;
      if (this.streak >= 3) { // 挫败阀:立即放宽+安慰
        this.calib = Math.min(1.6, this.calib*1.15);
        this.streak = 0; this.valveCount++;
        return 'valve';
      }
      if (hist.length >= 6) {
        const a = hist.reduce((s, x)=>s+x, 0)/hist.length;
        if (a < 0.6) this.calib = Math.min(1.6, this.calib*1.12);
        else if (a > 0.9) this.calib = Math.max(0.75, this.calib*0.94);
      }
      return null;
    },
    t(ms) {
      return Math.round(ms*this.calib);
    },
  };
}

/* ---------- 小工具 ---------- */
function fEl(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function pickRand(arr) {
  return arr[Math.floor(Math.random()*arr.length)];
}
/* 洗牌已归一 RandCore.shuffle(js/rand-core.js, 加载序在本文件之前):
   非突变拷贝式 — 原地用法的调用点赋值回原变量 */
function mkTimers() {
  const ts = [];
  return {
    after(ms, fn) {
      const id = setTimeout(()=>{
        const k=ts.indexOf(id); if (k>=0) ts.splice(k, 1); fn();
      }, ms);
      ts.push(id); return id;
    },
    stop() {
      ts.forEach(clearTimeout); ts.length = 0;
    },
  };
}
function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b)=>a-b);
  return s[Math.floor(s.length/2)];
}

/* ---------- 刺激图标出口(F2 素材升级): 干扰物/宝石像素图统一走物品系统 ----------
   iconOf 有像素图返 data: 前缀直接用; 未注册/未画(如 emerald/羊毛——物品系统没有)
   回落训练营自有管线 mcIcon, 保证任何刺激名都有图可渲染;
   调用期解析: mcIcon 所在 focus-icons.js 先于本文件; iconOf 所在 icons.js
   加载序在本文件之后——运行期取用时已加载, typeof 守卫兜底(见 index.html) */
function stimIcon(name) {
  if (typeof iconOf === 'function') {
    const url = iconOf(name);
    if (typeof url === 'string' && url.startsWith('data:')) return url;
  }
  return mcIcon(name);
}

/* ---------- 生物头像取图(单一出口 seam) ----------
   中立行猪/羊走训练营像素库 pigFace/sheepFace(F4b 补画——温中立物不是
   怪物, 怪物库不收, 引擎层不加游戏里不存在的生物); 混入生物(非苦力怕)
   仍走怪物库 Mobs.face 的手绘像素头像(自带缓存) — 调用期解析
   (focus-icons.js/mobs.js 均先于本文件加载, 见 index.html) */
const NEUTRAL_MOBS = ['pig', 'sheep']; // 中立行: 无方向线索的温和生物
const MIXER_MOBS = ['zombie', 'skeleton', 'spider', 'slime']; // 混入生物(怪物库已有)
function mobFace(type) {
  if (type === 'pig') return pigFace();
  if (type === 'sheep') return sheepFace();
  if (typeof Mobs !== 'undefined' && Mobs.face) return Mobs.face(type);
  return '';
}

/* ---------- 逐试次事件缝(L2 契约): handler 可选 h.onTrial({ok, streak}) ----------
   每正式试次恰一次, 教学演示不计; streak=连对数(含本次, 错则归零);
   维度名由调度层 runFocusLevel 补注 — 引擎只报事件不解释玩法,
   不知道奖励/物品/背包的存在(分层红线); 不传回调零开销零影响 */
function mkTrialEvents() {
  let streak = 0;
  return {
    fire(h, ok) {
      streak = ok ? streak + 1 : 0;
      if (h.onTrial) h.onTrial({ok, streak});
    },
  };
}

/* ---------- 判别引擎:CPT 警觉 / Go-No-Go 共用 ----------
   go 刺激要点, no-go 刺激不能点;击中/正确拒斥=对, 虚报/漏报=错 */
function runDiscrimination(area, params, adapt, h, framing) {
  const T = mkTimers();
  const ev = mkTrialEvents(); // 逐试次事件缝
  const stats = {trials: 0, correct: 0, rts: [], maxStreakErr: 0, valveCount: 0};
  const goSet = ['diamond']; // 钻石=要点
  /* noSet 扩充(D2/D1 素材行): 干扰矿走物品系统像素口径 iron_ore(原自绘 iron);
     gonogo 的煤/铁矿都是"不碰"类, 只添观感丰富度不改构念 */
  let noSet = framing==='gonogo' ? ['tnt', 'coal', 'iron_ore'] : ['stone', 'coal', 'iron_ore'];
  if (framing==='cpt' && params.similar) noSet = ['stone', 'emerald'];
  /* No-Go 逐试次掷骰伪装(D2 断层→坡道): 中=绿宝石(与 Go 钻石同色系高相似),
     不中=显性干扰(从 noSet 取) — 替代旧版 tier≥8 一步全量的 params.disguised */
  function pickNoGo() {
    if (framing==='gonogo' && params.disguiseRate > 0 && Math.random() < params.disguiseRate) {
      return 'emerald';
    }
    return pickRand(noSet);
  }
  const goRate = framing==='gonogo' ? params.goRate : params.targetRate;
  /* 预生成整局序列: No-Go(gonogo=TNT)至少 20% 且至少 1 个,
     避免逐次独立随机导致极端情况下整局一个 TNT 都不出 */
  const minNo = framing==='gonogo' ? Math.max(1, Math.ceil(params.trials*0.2)) : 1;
  const nGo = Math.max(0, Math.min(params.trials - minNo, Math.round(params.trials*goRate)));
  const plan = RandCore.shuffle(Math.random, Array.from({length: params.trials}, (_, k)=> k < nGo));
  let comfortSaid = false;

  function showStim(iconName, hinted) {
    const s = fEl('div', 'f-stim' + (hinted?' hint':''),
        '<img draggable="false" src="'+stimIcon(iconName)+'">');
    const W = area.clientWidth || 640; const H = area.clientHeight || 380;
    s.style.left = (60 + Math.random()*(W-180)) + 'px';
    s.style.top = (50 + Math.random()*(H-160)) + 'px';
    area.appendChild(s);
    return s;
  }
  function feedback(ok, el) {
    if (ok) {
      sfx('pick'); if (el) el.classList.add('good');
    } else {
      sfx('click'); if (el) el.classList.add('bad');
    }
  }

  function trial(isGo, isDemo) {
    /* 教学演示固定经典样例(该点的=钻石/不该点的=显性 TNT), 不被扩充集与伪装骰分心 */
    const iconName = isGo ? pickRand(goSet) : (isDemo ? 'tnt' : pickNoGo());
    const stim = showStim(iconName, isDemo);
    const dur = adapt.t(isDemo ? params.dur*1.5 : params.dur);
    let answered = false; const t0 = performance.now();

    function resolve(clicked) {
      if (answered) return; answered = true;
      const ok = isGo ? clicked : !clicked;
      if (ok && clicked) stats.rts.push(performance.now()-t0);
      /* 教学脚手架(Sesame 三级反馈, 仅教学关正式试次): 答错只重教不惩罚 —
         漏点=刺激留场高亮+句尾动作指引; 误点=念「不点」(与演示话术同族) */
      const reteach = params.scaffold && !isDemo && !ok;
      if (reteach) {
        if (isGo) {
          stim.classList.add('hint');
          SpeechKit.speak('钻石在这里，快点点它！');
        } else {
          stim.classList.add('hint-no');
          SpeechKit.speak('这个不点，等它自己走。');
        }
      }
      if (!isDemo) {
        stats.trials++;
        if (isGo) stats.goTrials = (stats.goTrials||0) + 1;
        if (isGo && clicked) stats.hits = (stats.hits||0) + 1;
        if (ok) stats.correct++;
        stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak + (ok?0:1));
        const valve = adapt.record(ok);
        ev.fire(h, ok); // 事件缝: 超时/点击每正式试次恰一次
        feedback(ok, stim);
        if (valve==='valve') {
          stats.valveCount++;
          if (!comfortSaid) {
            comfortSaid = true; SpeechKit.speak(comfortLine());
          }
          h.showRule && h.showRule();
        }
      } else feedback(isGo ? clicked : true, stim);
      if (!reteach) stim.classList.add('gone'); // 重教路径刺激留场(高亮可读), 到点直接撤
      T.after(reteach ? 1200 : 240, ()=>{
        stim.remove(); T.after(adapt.t(params.isi||800), next);
      });
    }
    stim.onmousedown = (e)=>{
      e.preventDefault(); resolve(true);
    };
    stim.ontouchstart = (e)=>{
      e.preventDefault(); resolve(true);
    }; // 触屏即时响应
    T.after(dur, ()=>resolve(false));

    if (isDemo) { // 教学演示:自动高亮正确做法
      T.after(1100, ()=>{
        if (answered) return;
        if (isGo) {
          stim.classList.add('hint'); SpeechKit.speak('看，点它！');
        } else {
          stim.classList.add('hint-no'); SpeechKit.speak('看，这个不点，等它自己走。');
        }
      });
    }
  }

  let idx = 0;
  function next() {
    if (isStopped) return;
    if (params.demo && idx===0) {
      h.progress(0, params.trials); trial(true, true); idx=1; return;
    } // 演示:该点的
    if (params.demo && idx===1) {
      trial(false, true); idx=2; return;
    } // 演示:不该点的
    if (idx >= params.trials) {
      finish(); return;
    }
    h.progress(idx, params.trials);
    trial(plan[idx - (params.demo ? 2 : 0)]);
    idx++;
  }
  let isStopped = false;
  function finish() {
    stats.acc = stats.trials ? stats.correct/stats.trials : 0;
    stats.mrt = median(stats.rts);
    stats.hitRate = stats.goTrials ? stats.hits/stats.goTrials : 1; // 命中率(防挂机)
    stats.valveCount += adapt.valveCount;
    h.end(stats);
  }
  next();
  return {stop() {
    isStopped = true; T.stop();
  }};
}

/* ---------- Flanker:苦力怕排队 ----------
   一排像素苦力怕, 只看中间那只的视线方向, 点左右按钮 */
function runFlanker(area, params, adapt, h) {
  const T = mkTimers();
  const ev = mkTrialEvents(); // 逐试次事件缝
  const stats = {trials: 0, correct: 0, rts: [], maxStreakErr: 0, valveCount: 0};
  let comfortSaid = false;

  const bar = fEl('div', 'f-flanker-row');
  area.appendChild(bar);
  const btns = fEl('div', 'f-flanker-btns');
  const bl = fEl('button', 'f-big-btn', btnImg('left'));
  const br = fEl('button', 'f-big-btn', btnImg('right'));
  btns.appendChild(bl); btns.appendChild(br);
  area.appendChild(btns);

  function showRow(centerDir, congruent, hinted, neutralRow, mixSet) {
    bar.innerHTML = '';
    const n = params.len;
    /* len9 行用小尺寸贴图(D3): 9×(56+14)=616px, 760px 区域放得下 */
    const base = 'f-creeper' + (n >= 9 ? ' f-creeper-sm' : '');
    for (let k=0; k<n; k++) {
      const isC = k === Math.floor(n/2);
      if (!isC && (neutralRow || mixSet.includes(k))) {
        /* 中立行/混入位换生物头像(无方向线索), 构念不变: 只看中间 */
        const pool = neutralRow ? NEUTRAL_MOBS : MIXER_MOBS;
        const img = fEl('img', base);
        img.src = mobFace(pool[Math.floor(Math.random()*pool.length)]);
        bar.appendChild(img);
        continue;
      }
      let d = centerDir;
      if (!congruent && !isC) d = -centerDir;
      const img = fEl('img', base + (isC?' center':''));
      img.src = creeperFace(d);
      if (hinted && isC) img.classList.add('hint');
      bar.appendChild(img);
    }
  }
  function trial(isDemo) {
    const centerDir = Math.random()<0.5 ? -1 : 1;
    const congruent = isDemo ? true : (Math.random() < params.congruentRate);
    /* 中立行/混入生物掷骰(D3): 仅正式试次, 教学演示保持经典苦力怕行 */
    let neutralRow = false; const mixSet = [];
    if (isDemo === undefined) {
      neutralRow = Math.random() < (params.neutralRate || 0);
      if (!neutralRow && params.mobMix > 0 && Math.random() < params.mobMix) {
        let flankers = [];
        for (let k=0; k<params.len; k++) {
          if (k !== Math.floor(params.len/2)) flankers.push(k);
        }
        flankers = RandCore.shuffle(Math.random, flankers);
        const cnt = 1 + (Math.random()<0.5 ? 0 : 1); // 混入 1~2 只(知觉噪声)
        for (let k=0; k<cnt; k++) mixSet.push(flankers[k]);
      }
    }
    showRow(centerDir, congruent, isDemo, neutralRow, mixSet);
    let answered = false; const t0 = performance.now();
    function resolve(dir) {
      if (answered) return; answered = true;
      const ok = dir === centerDir;
      if (ok) stats.rts.push(performance.now()-t0);
      /* 教学脚手架(仅教学关正式试次): 答错高亮中间只+念方向(Sesame 重述目标级) */
      const reteach = params.scaffold && isDemo===undefined && !ok;
      if (reteach) {
        const c = bar.children[Math.floor(params.len/2)];
        if (c && c.classList) c.classList.add('hint');
        SpeechKit.speak('先找中间那一只，它看' + (centerDir<0?'左':'右') + '边！');
      }
      if (isDemo===undefined) {
        stats.trials++;
        if (ok) stats.correct++;
        stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak + (ok?0:1));
        ev.fire(h, ok); // 事件缝: 点击路径每正式试次恰一次
        if (adapt.record(ok)==='valve') {
          stats.valveCount++;
          if (!comfortSaid) {
            comfortSaid=true; SpeechKit.speak(comfortLine());
          }
          h.showRule && h.showRule();
        }
        bl.classList.toggle('picked-ok', ok && dir<0);
        br.classList.toggle('picked-ok', ok && dir>0);
      }
      bar.classList.add(ok!==false && isDemo!==undefined ? 'demo-ok' : (ok?'ok':'no'));
      T.after(reteach ? 1200 : 360, ()=>{
        bar.className='f-flanker-row'; next();
      });
    }
    /* mousedown 即判定(Sesame「触点即响应」的鼠标等价物, 2026-10 手感翻新):
       6 岁连点场景 click(抬手判定)有迟滞感; answered 互斥使 click 兜底
       (键盘/辅助点击同通道)不会双计 */
    const tapL = ()=>resolve(-1);
    const tapR = ()=>resolve(1);
    bl.onmousedown = tapL; bl.onclick = tapL;
    br.onmousedown = tapR; br.onclick = tapR;
    T.after(adapt.t(params.window), ()=>{
      if (!answered) {
        answered=true;
        if (isDemo===undefined) {
          stats.trials++;
          ev.fire(h, false); // 事件缝: 窗口耗尽也报(算错, 连对归零)
        }
        bar.classList.add('no'); T.after(360, ()=>{
          bar.className='f-flanker-row'; next();
        });
      }
    });
    if (isDemo !== undefined) {
      T.after(1300, ()=>{
        if (answered) return;
        SpeechKit.speak('看，中间那只看' + (centerDir<0?'左':'右') + '边！');
        (centerDir<0?bl:br).classList.add('hint');
      });
    }
  }

  let idx = 0; let isStopped = false;
  function next() {
    if (isStopped) return;
    if (params.demo && idx<2) {
      h.progress(0, params.trials); trial(true); idx++; return;
    }
    if (idx >= params.trials) {
      finish(); return;
    }
    h.progress(idx, params.trials);
    trial();
    idx++;
  }
  function finish() {
    stats.acc = stats.trials ? stats.correct/stats.trials : 0;
    stats.mrt = median(stats.rts);
    stats.valveCount += adapt.valveCount;
    bar.remove(); btns.remove();
    h.end(stats);
  }
  next();
  return {stop() {
    isStopped = true; T.stop(); bar.remove(); btns.remove();
  }};
}

/* ---------- Corsi:钻石闪闪光(视空记忆) ---------- */
function runCorsi(area, params, adapt, h) {
  const T = mkTimers();
  const ev = mkTrialEvents(); // 逐试次事件缝(试次=序列)
  const stats = {trials: 0, correct: 0, rts: [], maxStreakErr: 0, valveCount: 0};
  const side = params.grid===16 ? 4 : 3;
  const hint = fEl('div', 'f-corsi-hint', '👀 看顺序…');
  const grid = fEl('div', 'f-corsi-grid g'+side);
  area.appendChild(hint); area.appendChild(grid);
  const tiles = [];
  for (let k=0; k<params.grid; k++) {
    const t = fEl('div', 'f-corsi-tile');
    grid.appendChild(t); tiles.push(t);
  }
  let inputOn = false; let comfortSaid = false;

  function light(k, ms, hinted) {
    tiles[k].classList.add('lit');
    if (hinted) tiles[k].classList.add('hint'); // 教学重演: 亮格带提示脉动(css/focus.css)
    tiles[k].style.backgroundImage = 'url(' + stimIcon(params.gem || 'diamond') + ')';
    T.after(Math.max(220, ms*0.65), ()=>{
      tiles[k].classList.remove('lit');
      tiles[k].classList.remove('hint');
      tiles[k].style.backgroundImage = '';
    });
  }
  function runSeq(seqIdx, seq, hinted) {
    const isDemo = params.demo && seqIdx===0;
    inputOn = false;
    hint.textContent = '👀 看顺序…';
    tiles.forEach((t)=>{
      t.onclick = null; t.onmousedown = null;
    }); // 展示期禁点(mousedown 即判定后两通道同锁)
    const pace = adapt.t(params.pace);
    seq.forEach((k, s)=>T.after(400 + s*pace, ()=>light(k, pace, hinted)));
    T.after(400 + seq.length*pace + 200, ()=>{
      hint.textContent = '👉 按顺序点！';
      inputOn = true;
      let step = 0; const t0 = performance.now();
      tiles.forEach((t, k)=>{
        /* mousedown 即判定 + click 键盘兜底(inputOn/step 互斥不双计, 2026-10 手感翻新) */
        const tap = ()=>{
          if (!inputOn) return;
          if (k === seq[step]) {
            light(k, 400); t.classList.add('good');
            T.after(300, ()=>t.classList.remove('good'));
            stats.rts.push(performance.now()-t0);
            stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak);
            adapt.record(true);
            step++;
            if (step >= seq.length) { // 整序列完成
              inputOn = false;
              stats.trials++; stats.correct++;
              if (!isDemo) ev.fire(h, true); // 事件缝: 序列完成报对(教学演示不计)
              sfx('pick');
              T.after(700, ()=>nextSeq(++seqIdx));
            }
          } else {
            inputOn = false;
            t.classList.add('bad');
            stats.trials++;
            if (!isDemo) ev.fire(h, false); // 事件缝: 点错即本序列终止报错
            stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak+1);
            if (adapt.record(false)==='valve') {
              stats.valveCount++;
              if (!comfortSaid) {
                comfortSaid=true; SpeechKit.speak(comfortLine());
              }
            }
            T.after(600, ()=>{
              t.classList.remove('bad');
              /* 教学脚手架(仅教学关): 原序列重演一遍(亮格带提示), 不推进 —
                 Sesame「重述目标+示范」级; 正式关照旧推进 */
              if (params.scaffold && !isDemo) {
                SpeechKit.speak('再看一遍这一串哦。');
                runSeq(seqIdx, seq, true);
              } else nextSeq(++seqIdx);
            });
          }
        };
        t.onmousedown = tap;
        t.onclick = tap;
      });
    });
  }
  const seqIdx = 0; let isStopped = false;
  function nextSeq(n) {
    if (isStopped) return;
    if (n >= params.seqs) {
      stats.acc = stats.trials ? stats.correct/stats.trials : 0;
      stats.mrt = median(stats.rts);
      stats.valveCount += adapt.valveCount;
      h.end(stats);
      return;
    }
    h.progress(n, params.seqs);
    const isDemo = params.demo && n===0;
    /* lenMix 长度混编(D4 台阶变坡道): 过渡档按概率混出 len-1, 教学演示不吃 */
    let len = isDemo ? 2 : params.len;
    if (!isDemo && len > 1 && params.lenMix > 0 && Math.random() < params.lenMix) len--;
    /* antiChunk 反组块(D4 顶格新杠杆): 展示前按概率打乱格位布局 — 置换重排
       (格位互异不丢格), "哪些格子按什么顺序亮"不变故序列仍可解,
       只阻断"记位置组合"的组块化取巧 */
    if (!isDemo && params.antiChunk > 0 && Math.random() < params.antiChunk) {
      RandCore.shuffle(Math.random, tiles).forEach((t)=>grid.appendChild(t));
    }
    const pool = tiles.map((_, k)=>k);
    const seq = [];
    while (seq.length < len && pool.length) {
      seq.push(pool.splice(Math.floor(Math.random()*pool.length), 1)[0]);
    }
    if (params.demo && n===0) {
      SpeechKit.speak('看，钻石亮了两次，你也点两下！');
      T.after(600, ()=>runSeq(n, seq));
    } else runSeq(n, seq);
  }
  nextSeq(0);
  return {stop() {
    isStopped = true; T.stop();
  }};
}

/* ---------- 任务切换:听指挥的小矿工 ----------
   旗子=当前规则(羊毛颜色 / 方块材质 / 大小), 点符合目标的方块;旗子会变 */
const SW_WOOLS = ['wool_red', 'wool_blue', 'wool_yellow'];
/* 材质族五件(D5 素材行, 配 choices5: 干扰项图标不两两重复; 全走 iconOf 像素版) */
const SW_MATS = ['cobble', 'planks', 'brick', 'glass', 'stone_bricks'];
function runSwitch(area, params, adapt, h) {
  const T = mkTimers();
  const ev = mkTrialEvents(); // 逐试次事件缝
  const stats = {trials: 0, correct: 0, rts: [], maxStreakErr: 0, valveCount: 0};
  const ruleNames = ['color', 'mat', 'size'].slice(0, params.rules);
  let rule = ruleNames[0]; let comfortSaid = false;

  const flag = fEl('div', 'f-switch-flag');
  area.appendChild(flag);
  const board = fEl('div', 'f-switch-board');
  area.appendChild(board);
  let correctEl = null; // 教学脚手架用: 本试次正确方块元素(每试次在摆台时刷新)

  function flagHTML(target) {
    if (rule==='size') {
      return mcIconTag('flag') +
          '<img class="tgt '+(target.attr==='big'?'tgt-big':'tgt-small')+'" src="'+stimIcon('stone')+'">';
    }
    return mcIconTag('flag') + '<img class="tgt" src="'+stimIcon(target.attr)+'">';
  }
  function mcIconTag(n) {
    return '<img class="flagpole" draggable="false" src="'+stimIcon(n)+'">';
  }

  function trial(isDemo) {
    const family = rule==='color' ? SW_WOOLS : rule==='mat' ? SW_MATS :
                 (Math.random()<0.5 ? SW_WOOLS : SW_MATS);
    const target = {attr: null};
    let isCorrect;
    if (rule==='color') {
      target.attr = pickRand(SW_WOOLS); isCorrect = (b)=>b.icon===target.attr;
    } else if (rule==='mat') {
      target.attr = pickRand(SW_MATS); isCorrect = (b)=>b.icon===target.attr;
    } else {
      target.attr = pickRand(['big', 'small']); isCorrect = (b)=>b.size===target.attr;
    }
    flag.innerHTML = flagHTML(target);
    board.innerHTML = '';

    const choices = [];
    /* 双价干扰(D5): 概率使干扰项在无关维度匹配目标 — 颜色/材质规则下与目标
       同大小(大小线索失效), 大小规则下用目标同族图标(材质线索失效),
       逼孩子只看旗子说的当前维度; 教学演示不掷 */
    const biva = (isDemo) => !isDemo && Math.random() < (params.bivalent || 0);
    if (rule==='size') {
      const wrongSize = target.attr==='big' ? 'small' : 'big';
      const correct = {icon: pickRand(family), size: target.attr};
      const shuffled = [...family].sort(()=>Math.random()-0.5);
      for (let k=0; k<params.choices-1; k++) {
        choices.push({icon: biva(isDemo) ? correct.icon : shuffled[k%shuffled.length], size: wrongSize});
      }
      choices.push(correct); // 唯一正确
    } else {
      choices.push({icon: target.attr, size: pickRand(['big', 'small'])});
      const others = family.filter((x)=>x!==target.attr);
      let k = 0;
      while (choices.length < params.choices) {
        choices.push({icon: others[k%others.length],
          size: biva(isDemo) ? choices[0].size : pickRand(['big', 'small'])});
        k++;
      }
    }
    for (let k=choices.length-1; k>0; k--) {
      const j=Math.floor(Math.random()*(k+1)); [choices[k], choices[j]]=[choices[j], choices[k]];
    }

    let answered = false; const t0 = performance.now();
    correctEl = null;
    choices.forEach((c)=>{
      const el = fEl('div', 'f-block block ' + (c.size==='big'?'big':'small'),
          '<img draggable="false" src="'+stimIcon(c.icon)+'">');
      if (isCorrect(c)) correctEl = el; // 教学脚手架: 记下正确方块(答错后高亮重教)
      /* mousedown 即判定 + click 键盘兜底(answered 互斥不双计, 2026-10 手感翻新) */
      const tap = ()=>{
        if (answered) return; answered = true;
        const ok = isCorrect(c);
        if (ok) {
          stats.rts.push(performance.now()-t0); el.classList.add('good'); sfx('pick');
        } else {
          el.classList.add('bad'); sfx('click');
          /* 教学脚手架(仅教学关正式试次): 高亮正确方块(Sesame「重述+示范正确答案」级) */
          if (params.scaffold && isDemo===undefined && correctEl) {
            correctEl.classList.add('hint');
            SpeechKit.speak('看旗子上画的是什么——点这个！');
          }
        }
        if (isDemo===undefined) {
          stats.trials++;
          if (ok) stats.correct++;
          stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak + (ok?0:1));
          ev.fire(h, ok); // 事件缝: 每正式试次恰一次
          if (adapt.record(ok)==='valve') {
            stats.valveCount++;
            if (!comfortSaid) {
              comfortSaid=true; SpeechKit.speak(comfortLine());
            }
            flag.classList.add('bounce');
            T.after(800, ()=>flag.classList.remove('bounce'));
          }
        }
        T.after(420, next);
      };
      el.onmousedown = tap;
      el.onclick = tap;
      board.appendChild(el);
      if (isDemo && isCorrect(c)) {
        T.after(1200, ()=>{
          if (!answered) {
            el.classList.add('hint'); SpeechKit.speak('看，点这个！');
          }
        });
      }
    });
  }

  let idx = 0; let sinceSwitch = 0; let isStopped = false;
  function next() {
    if (isStopped) return;
    if (params.demo && idx<2) {
      h.progress(0, params.trials); trial(true); idx++; return;
    }
    if (idx >= params.trials) {
      finish(); return;
    }
    h.progress(idx, params.trials);
    // 切换规则?
    /* switchJitter(D5): 切换点抖动 — 阈值随机 1~3(与 switchEvery 同尺度), 不可预测 */
    const gap = params.switchJitter ?
        1 + Math.floor(Math.random()*3) :
        Math.max(1, params.switchEvery + (Math.random()<0.3?-1:0));
    if (ruleNames.length>1 && sinceSwitch >= gap) {
      const old = rule;
      rule = pickRand(ruleNames.filter((r)=>r!==old));
      sinceSwitch = 0;
      flag.classList.add('bounce');
      sfx('click');
      SpeechKit.speak('旗子变啦！');
      T.after(800, ()=>flag.classList.remove('bounce'));
    } else sinceSwitch++;
    trial();
    idx++;
  }
  function finish() {
    stats.acc = stats.trials ? stats.correct/stats.trials : 0;
    stats.mrt = median(stats.rts);
    stats.valveCount += adapt.valveCount;
    flag.remove(); board.remove();
    h.end(stats);
  }
  next();
  return {stop() {
    isStopped = true; T.stop(); flag.remove(); board.remove();
  }};
}

/* ---------- 视觉搜索:矿洞大扫除(2026-10 第六维, D6) ----------
   自定步调划消(TEA-Ch2 J Balloon Hunt 系, 证据链 docs/focus-interaction-research.md §A1):
   石头堆里把全部钻石点出来。回合制 — 首回合纯目标(纯检测), 后回合混入干扰
   矿石(密度读 params.density)与绿宝石相似混入(similarMix, 与 cpt similar 同族);
   无时窗压迫(红线: 自定步调, 速度只进家长面板 mrt, 不驱动任何计分);
   记分 = 找到数与误点数(乱扫会压 acc, 防连点通吃); 漏找不存在 — 找齐才进
   下一回合(自定步调的"回合"是干扰密度梯度, 不是时限)。
   事件缝: 中的=fire(ok), 误点=fire(!ok) — 连对显示/掉落掷骰照常工作,
   试次总量 3×6=18 与其他维对齐(FOCUS_REWARD_TRIAL_REF) */
function runSearch(area, params, adapt, h) {
  const T = mkTimers();
  const ev = mkTrialEvents(); // 逐试次事件缝(事件=一次点选判定)
  const stats = {trials: 0, correct: 0, rts: [], maxStreakErr: 0, valveCount: 0,
    falseTaps: 0}; // falseTaps=误点数(石头/他矿/绿宝石), 结算按 找到−误点 折 acc
  const total = params.rounds*params.targets;
  let found = 0; let comfortSaid = false; let scaffoldSaid = false; let isStopped = false;

  const hint = fEl('div', 'f-search-hint');
  /* 列数走类名(c5~c8, css/focus.css 映射 --cols)而非内联样式 — DOM 惰性
     可测性约定(假环境无 CSSStyleDeclaration), 与格阵 g9/g16 同款手法 */
  const grid = fEl('div', 'f-search-grid c' + params.cols);
  area.appendChild(hint);
  area.appendChild(grid);

  /* 目标提示条: 大钻石 + 本回合剩余小钻石图标行(零文字 — 数图标即知还差几颗;
     按回合显示 6 颗封顶, 不铺全程 18 颗) */
  function hintHTML(left) {
    let chips = '';
    for (let k=0; k<left; k++) {
      chips += '<img class="f-search-chip" draggable="false" alt="" src="' + stimIcon('diamond') + '">';
    }
    return '<img class="f-search-goal" draggable="false" alt="" src="' + stimIcon('diamond') + '">' +
        '<span class="f-search-left">' + chips + '</span>';
  }

  function buildRound(r) {
    grid.innerHTML = '';
    hint.innerHTML = hintHTML(params.targets);
    const cells = params.cols*params.rows;
    const idxs = RandCore.shuffle(Math.random, Array.from({length: cells}, (_, k)=>k));
    const targetSet = idxs.slice(0, params.targets);
    /* 干扰率: 首回合恒 0(Balloon Hunt 前段=纯目标), 后回合读 density[r-1] */
    const dens = r === 0 ? 0 : (params.density[r-1] || 0);
    let roundLeft = params.targets;
    const t0 = performance.now(); // 回合起始(每颗钻石的反应时基准, 只进家长面板)
    if (params.demo && r === 0) { // 教学关首回合: 目标脉动高亮 + 一句口播
      T.after(900, ()=>SpeechKit.speak('闪光的钻石全都点掉，一颗都别漏！'));
    }
    idxs.forEach((cell) => {
      const isTarget = targetSet.includes(cell);
      let kind;
      if (isTarget) {
        kind = 'diamond';
      } else if (Math.random() < dens) {
        /* 干扰矿石: 按相似混入率掷骰 — 中=绿宝石(同形异色高相似), 不中=他矿 */
        kind = Math.random() < (params.similarMix || 0) ? 'emerald' :
            pickRand(['coal', 'iron_ore']);
      } else {
        kind = 'stone'; // 中性填料(不吸引点选, 构成扫描负载)
      }
      const cellCls = 'f-search-cell' + (isTarget && params.demo && r === 0 ? ' hint' : '');
      const el = fEl('button', cellCls,
          '<img draggable="false" alt="" src="' + stimIcon(kind) + '">');
      let taken = false; // 每格至多记一次(连点/mousedown+click 双通道不双计)
      const tap = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (isStopped || taken || el.dataset.found) return;
        if (isTarget) {
          taken = true;
          el.dataset.found = '1';
          el.classList.add('found');
          found++; stats.correct++; roundLeft--;
          stats.rts.push(performance.now()-t0);
          stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak);
          adapt.record(true);
          ev.fire(h, true); // 事件缝: 中的(streak 由缝自持)
          sfx('pick');
          hint.innerHTML = hintHTML(roundLeft);
          h.progress(found, total);
          if (roundLeft <= 0) { // 回合找齐: 短促庆祝格阵闪光, 进下一回合
            grid.classList.add('clear');
            T.after(750, ()=>{
              grid.classList.remove('clear');
              next(r+1);
            });
          }
        } else {
          /* 误点(石头/他矿/绿宝石): 记误点压 acc(防乱扫通吃)但零惩罚 —
             轻微摇摆一晃即回, 不扣不罚; 3 连误点触发挫败阀安慰(mkAdapt 统一) */
          taken = true;
          stats.falseTaps++;
          stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak+1);
          el.classList.add('miss');
          T.after(340, ()=>el.classList.remove('miss'));
          if (adapt.record(false)==='valve') {
            stats.valveCount++;
            if (!comfortSaid) {
              comfortSaid = true; SpeechKit.speak(comfortLine());
            }
            h.showRule && h.showRule();
          }
          /* 教学脚手架(Sesame 重述目标级, 仅教学关): 首次误点念一句「找钻石」 */
          if (params.scaffold && !scaffoldSaid) {
            scaffoldSaid = true;
            SpeechKit.speak('那些是石头，别点它们——找闪光的钻石！');
          }
          ev.fire(h, false);
        }
      };
      /* mousedown 即判定(Sesame「触点即响应」鼠标等价) + click 键盘兜底 */
      el.onmousedown = tap;
      el.onclick = tap;
      grid.appendChild(el);
    });
  }

  function next(r) {
    if (isStopped) return;
    if (r >= params.rounds) {
      finish();
      return;
    }
    buildRound(r);
  }
  function finish() {
    /* 分母=目标总数(自定步调无漏测试次); acc=(找到−误点)/总数 钳 0 —
       全找齐是必然事件, 分数差异全由误点率承载(精确搜索=星级来源) */
    stats.trials = total;
    stats.acc = Math.max(0, (stats.correct - stats.falseTaps)/total);
    stats.mrt = median(stats.rts);
    stats.valveCount += adapt.valveCount;
    hint.remove(); grid.remove();
    h.end(stats);
  }
  next(0);
  return {stop() {
    isStopped = true; T.stop(); hint.remove(); grid.remove();
  }};
}

/* ---------- 调度入口 ---------- */
/* dim 补注包装: 引擎报 {ok, streak}(不知道自己叫什么), 维度名由本调度层
   统一补进事件对象 — 调用方(modes/focus.js)拿到完整的 {ok, streak, dim} */
function withDim(h, dim) {
  if (!h.onTrial) return h;
  return Object.assign({}, h, {
    onTrial(t) {
      h.onTrial(Object.assign({dim}, t));
    },
  });
}
/* 分发判定(纯函数, 单测锁住顺序): master/check 必须先于 dim 判定 —
   第 100 关 dim='search'(六维最后一个), 若先按 dim 分发, master 分支
   永远不可达(曾经的死码 bug); check=每日体检(F8), 与 master 同走六维
   连跑(sections 分发, 短参数来自 FOCUS_CHECK_PARAMS) */
function focusDispatch(level) {
  if (level.kind === 'master' || level.kind === 'check') return {kind: 'master'};
  if (level.dim==='cpt') return {kind: 'engine', engine: 'discrimination', framing: 'cpt'};
  if (level.dim==='gonogo') return {kind: 'engine', engine: 'discrimination', framing: 'gonogo'};
  if (level.dim==='flanker') return {kind: 'engine', engine: 'flanker'};
  if (level.dim==='corsi') return {kind: 'engine', engine: 'corsi'};
  if (level.dim==='switch') return {kind: 'engine', engine: 'switch'};
  if (level.dim==='search') return {kind: 'engine', engine: 'search'};
  return {kind: 'none'};
}
function runFocusLevel(level, area, h, failCount) {
  const d = focusDispatch(level);
  if (d.kind === 'master') { // 六维连续小节
    const T = mkTimers();
    let isStopped = false;
    const agg = {trials: 0, correct: 0, rts: [], maxStreakErr: 0, valveCount: 0, goTrials: 0, hits: 0};
    let sec = 0;
    function runSection() {
      if (isStopped) return;
      if (sec >= level.sections.length) {
        agg.acc = agg.trials ? agg.correct/agg.trials : 0;
        agg.mrt = median(agg.rts);
        agg.hitRate = agg.goTrials ? agg.hits/agg.goTrials : 1;
        h.end(agg);
        return;
      }
      const s = level.sections[sec];
      /* 零文字依赖: 小节播报连带规则与档位提示一起念——大师关 gonogo
         tier8 起就有绿宝石伪装, 只报名不念规则=零文字孩子裸进新游戏
         (tip 是档位感知的, 伪装/4×4 等规则变化只在 tip 里) */
      SpeechKit.speak('新游戏：' + FOCUS_META[s.dim].game + '！' +
          FOCUS_META[s.dim].rule + ' ' + FOCUS_META[s.dim].tip(s.params));
      const sub = withDim({
        progress(k, n) {
          h.progress(sec + k/Math.max(1, n), level.sections.length);
        },
        showRule() {
          h.showRule && h.showRule(s.dim);
        },
        onTrial(t) { // 先透传调用方事件, dim 补注交给 withDim 统一实现
          h.onTrial && h.onTrial(t);
        },
        end(st) {
          agg.trials += st.trials; agg.correct += st.correct;
          agg.rts.push(...st.rts);
          agg.goTrials += st.goTrials||0; agg.hits += st.hits||0;
          agg.maxStreakErr = Math.max(agg.maxStreakErr, st.maxStreakErr);
          agg.valveCount += st.valveCount;
          sec++;
          T.after(600, runSection);
        },
      }, s.dim); // 事件缝补注该小节维度(与普通关卡同一实现, 不再手抄)
      const p2 = {...s.params};
      area.innerHTML = '';
      const engine = runFocusLevel({dim: s.dim, kind: 'normal', params: p2}, area, sub, failCount);
      curStop = engine ? engine.stop : null;
    }
    let curStop = null;
    runSection();
    return {stop() {
      isStopped = true; T.stop(); if (curStop) curStop();
    }};
  }

  if (d.kind === 'none') return null;
  const adapt = mkAdapt(failCount);
  const p = {...level.params};
  if (level.kind==='tutorial') {
    p.demo = true;
    p.scaffold = true; // 教学脚手架(Sesame 三级反馈, 仅教学关正式试次生效)
  }
  const hd = withDim(h, level.dim); // 事件缝补注维度名(不传 onTrial 时零包装)
  if (d.engine==='discrimination') return runDiscrimination(area, p, adapt, hd, d.framing);
  if (d.engine==='flanker') return runFlanker(area, p, adapt, hd);
  if (d.engine==='corsi') return runCorsi(area, p, adapt, hd);
  if (d.engine==='search') return runSearch(area, p, adapt, hd);
  return runSwitch(area, p, adapt, hd);
}
