"use strict";
/* ============================================================
   专注训练营 — 五范式小游戏引擎
   判别引擎(CPT警觉/Go-No-Go) · Flanker(苦力怕排队) · Corsi(钻石闪闪光)
   · 任务切换(听指挥小矿工) · 大师混合
   全部为 DOM 点选式, 零文字依赖(图标+语音), 纯鼠标可完成
============================================================ */

/* ---------- 语音 (Web Speech API 中文) ---------- */
let focusVoice = null;
function pickFocusVoice(){
  try{
    const vs = speechSynthesis.getVoices();
    focusVoice = vs.find(v=>/zh[-_]CN/i.test(v.lang)) || vs.find(v=>/^zh/i.test(v.lang)) || null;
  }catch(e){}
}
if(typeof speechSynthesis !== 'undefined'){
  pickFocusVoice();
  try{ speechSynthesis.onvoiceschanged = pickFocusVoice; }catch(e){}
}
function focusSpeak(text){
  try{
    if(typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.9; u.pitch = 1.1;
    if(focusVoice) u.voice = focusVoice;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }catch(e){}
}

/* ---------- 过程性表扬 / 中性安慰 (夸努力不夸聪明, Mueller & Dweck 1998) ---------- */
const FOCUS_PRAISE = [
  '你一直在认真看，真棒！','你等到了对的时机，好有耐心！','你刚才特别专注！',
  '你坚持做完啦，真了不起！','你的小眼睛看得真仔细！','你一直在努力，进步啦！'
];
const FOCUS_COMFORT = [
  '没关系，我们慢慢来。','深呼吸，再看仔细一点。','差一点点啦，再试一次！','休息一下眼睛，我们继续。'
];
function praiseLine(){ return FOCUS_PRAISE[Math.floor(Math.random()*FOCUS_PRAISE.length)]; }
function comfortLine(){ return FOCUS_COMFORT[Math.floor(Math.random()*FOCUS_COMFORT.length)]; }

/* ---------- 阶梯自适应:目标 70~85% 成功率;连错 3 次开挫败阀 ---------- */
function mkAdapt(initial){
  const hist = [];
  return {
    calib: initial || 1,       // 时间参数乘数:>1 更宽松(重试自动放宽)
    streak: 0,
    valveCount: 0,
    record(ok){
      hist.push(ok?1:0); if(hist.length>8) hist.shift();
      this.streak = ok ? 0 : this.streak+1;
      if(this.streak >= 3){                       // 挫败阀:立即放宽+安慰
        this.calib = Math.min(1.6, this.calib*1.15);
        this.streak = 0; this.valveCount++;
        return 'valve';
      }
      if(hist.length >= 6){
        const a = hist.reduce((s,x)=>s+x,0)/hist.length;
        if(a < 0.6)      this.calib = Math.min(1.6, this.calib*1.12);
        else if(a > 0.9) this.calib = Math.max(0.75, this.calib*0.94);
      }
      return null;
    },
    t(ms){ return Math.round(ms*this.calib); }
  };
}

/* ---------- 小工具 ---------- */
function fEl(tag, cls, html){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html !== undefined) e.innerHTML = html;
  return e;
}
function pickRand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function shuffleArr(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function mkTimers(){
  const ts = [];
  return {
    after(ms, fn){
      const id = setTimeout(()=>{ const k=ts.indexOf(id); if(k>=0) ts.splice(k,1); fn(); }, ms);
      ts.push(id); return id;
    },
    stop(){ ts.forEach(clearTimeout); ts.length = 0; }
  };
}
function median(nums){
  if(!nums.length) return 0;
  const s = [...nums].sort((a,b)=>a-b);
  return s[Math.floor(s.length/2)];
}

/* ---------- 判别引擎:CPT 警觉 / Go-No-Go 共用 ----------
   go 刺激要点, no-go 刺激不能点;击中/正确拒斥=对, 虚报/漏报=错 */
function runDiscrimination(area, params, adapt, h, framing){
  const T = mkTimers();
  const stats = { trials:0, correct:0, rts:[], maxStreakErr:0, valveCount:0 };
  const goSet = ['diamond'];                                        // 钻石=要点
  let noSet = framing==='gonogo' ? ['tnt'] : ['stone','coal','iron'];
  if(framing==='gonogo' && params.disguised) noSet = ['emerald'];   // 伪装No-Go=绿宝石
  if(framing==='cpt' && params.similar)      noSet = ['stone','emerald'];
  const goRate = framing==='gonogo' ? params.goRate : params.targetRate;
  /* 预生成整局序列: No-Go(gonogo=TNT)至少 20% 且至少 1 个,
     避免逐次独立随机导致极端情况下整局一个 TNT 都不出 */
  const minNo = framing==='gonogo' ? Math.max(1, Math.ceil(params.trials*0.2)) : 1;
  const nGo = Math.max(0, Math.min(params.trials - minNo, Math.round(params.trials*goRate)));
  const plan = shuffleArr(Array.from({length:params.trials}, (_,k)=> k < nGo));
  let comfortSaid = false;

  function showStim(iconName, hinted){
    const s = fEl('div', 'f-stim' + (hinted?' hint':''),
      '<img draggable="false" src="'+mcIcon(iconName)+'">');
    const W = area.clientWidth || 640, H = area.clientHeight || 380;
    s.style.left = (60 + Math.random()*(W-180)) + 'px';
    s.style.top  = (50 + Math.random()*(H-160)) + 'px';
    area.appendChild(s);
    return s;
  }
  function feedback(ok, el){
    if(ok){ sfx('pick'); if(el) el.classList.add('good'); }
    else  { sfx('click'); if(el) el.classList.add('bad'); }
  }

  function trial(isGo, isDemo){
    const stim = showStim(isGo ? pickRand(goSet) : pickRand(noSet), isDemo);
    const dur = adapt.t(isDemo ? params.dur*1.5 : params.dur);
    let answered = false; const t0 = performance.now();

    function resolve(clicked){
      if(answered) return; answered = true;
      const ok = isGo ? clicked : !clicked;
      if(ok && clicked) stats.rts.push(performance.now()-t0);
      if(!isDemo){
        stats.trials++;
        if(isGo) stats.goTrials = (stats.goTrials||0) + 1;
        if(isGo && clicked) stats.hits = (stats.hits||0) + 1;
        if(ok) stats.correct++;
        stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak + (ok?0:1));
        const valve = adapt.record(ok);
        feedback(ok, stim);
        if(valve==='valve'){
          stats.valveCount++;
          if(!comfortSaid){ comfortSaid = true; focusSpeak(comfortLine()); }
          h.showRule && h.showRule();
        }
      } else feedback(isGo ? clicked : true, stim);
      stim.classList.add('gone');
      T.after(240, ()=>{ stim.remove(); T.after(adapt.t(params.isi||800), next); });
    }
    stim.onmousedown = (e)=>{ e.preventDefault(); resolve(true); };
    stim.ontouchstart = (e)=>{ e.preventDefault(); resolve(true); };   // 触屏即时响应
    T.after(dur, ()=>resolve(false));

    if(isDemo){                                  // 教学演示:自动高亮正确做法
      T.after(1100, ()=>{
        if(answered) return;
        if(isGo){ stim.classList.add('hint'); focusSpeak('看，点它！'); }
        else { stim.classList.add('hint-no'); focusSpeak('看，这个不点，等它自己走。'); }
      });
    }
  }

  let idx = 0;
  function next(){
    if(isStopped) return;
    if(params.demo && idx===0){ h.progress(0, params.trials); trial(true, true);  idx=1; return; }  // 演示:该点的
    if(params.demo && idx===1){ trial(false, true); idx=2; return; }                                // 演示:不该点的
    if(idx >= params.trials){ finish(); return; }
    h.progress(idx, params.trials);
    trial(plan[idx - (params.demo ? 2 : 0)]);
    idx++;
  }
  let isStopped = false;
  function finish(){
    stats.acc = stats.trials ? stats.correct/stats.trials : 0;
    stats.mrt = median(stats.rts);
    stats.hitRate = stats.goTrials ? stats.hits/stats.goTrials : 1;   // 命中率(防挂机)
    stats.valveCount += adapt.valveCount;
    h.end(stats);
  }
  next();
  return { stop(){ isStopped = true; T.stop(); } };
}

/* ---------- Flanker:苦力怕排队 ----------
   一排像素苦力怕, 只看中间那只的视线方向, 点左右按钮 */
function runFlanker(area, params, adapt, h){
  const T = mkTimers();
  const stats = { trials:0, correct:0, rts:[], maxStreakErr:0, valveCount:0 };
  let comfortSaid = false;

  const bar = fEl('div', 'f-flanker-row');
  area.appendChild(bar);
  const btns = fEl('div', 'f-flanker-btns');
  const bl = fEl('button', 'f-big-btn', '⬅️');
  const br = fEl('button', 'f-big-btn', '➡️');
  btns.appendChild(bl); btns.appendChild(br);
  area.appendChild(btns);

  function showRow(centerDir, congruent, hinted){
    bar.innerHTML = '';
    const n = params.len;
    for(let k=0;k<n;k++){
      const isC = k === Math.floor(n/2);
      let d = centerDir;
      if(!congruent && !isC) d = -centerDir;
      const img = fEl('img', 'f-creeper' + (isC?' center':''));
      img.src = creeperFace(d);
      if(hinted && isC) img.classList.add('hint');
      bar.appendChild(img);
    }
  }
  function trial(isDemo){
    const centerDir = Math.random()<0.5 ? -1 : 1;
    const congruent = isDemo ? true : (Math.random() < params.congruentRate);
    showRow(centerDir, congruent, isDemo);
    let answered = false; const t0 = performance.now();
    function resolve(dir){
      if(answered) return; answered = true;
      const ok = dir === centerDir;
      if(ok) stats.rts.push(performance.now()-t0);
      if(isDemo===undefined){
        stats.trials++;
        if(ok) stats.correct++;
        stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak + (ok?0:1));
        if(adapt.record(ok)==='valve'){
          stats.valveCount++;
          if(!comfortSaid){ comfortSaid=true; focusSpeak(comfortLine()); }
          h.showRule && h.showRule();
        }
        bl.classList.toggle('picked-ok', ok && dir<0);
        br.classList.toggle('picked-ok', ok && dir>0);
      }
      bar.classList.add(ok!==false && isDemo!==undefined ? 'demo-ok' : (ok?'ok':'no'));
      T.after(360, ()=>{ bar.className='f-flanker-row'; next(); });
    }
    bl.onclick = ()=>resolve(-1);
    br.onclick = ()=>resolve(1);
    T.after(adapt.t(params.window), ()=>{ if(!answered){ answered=true;
      if(isDemo===undefined){ stats.trials++; }
      bar.classList.add('no'); T.after(360, ()=>{ bar.className='f-flanker-row'; next(); });
    }});
    if(isDemo !== undefined){
      T.after(1300, ()=>{
        if(answered) return;
        focusSpeak('看，中间那只看' + (centerDir<0?'左':'右') + '边！');
        (centerDir<0?bl:br).classList.add('hint');
      });
    }
  }

  let idx = 0, isStopped = false;
  function next(){
    if(isStopped) return;
    if(params.demo && idx<2){ h.progress(0, params.trials); trial(true); idx++; return; }
    if(idx >= params.trials){ finish(); return; }
    h.progress(idx, params.trials);
    trial();
    idx++;
  }
  function finish(){
    stats.acc = stats.trials ? stats.correct/stats.trials : 0;
    stats.mrt = median(stats.rts);
    stats.valveCount += adapt.valveCount;
    bar.remove(); btns.remove();
    h.end(stats);
  }
  next();
  return { stop(){ isStopped = true; T.stop(); bar.remove(); btns.remove(); } };
}

/* ---------- Corsi:钻石闪闪光(视空记忆) ---------- */
function runCorsi(area, params, adapt, h){
  const T = mkTimers();
  const stats = { trials:0, correct:0, rts:[], maxStreakErr:0, valveCount:0 };
  const side = params.grid===16 ? 4 : 3;
  const hint = fEl('div', 'f-corsi-hint', '👀 看顺序…');
  const grid = fEl('div', 'f-corsi-grid g'+side);
  area.appendChild(hint); area.appendChild(grid);
  const tiles = [];
  for(let k=0;k<params.grid;k++){
    const t = fEl('div', 'f-corsi-tile');
    grid.appendChild(t); tiles.push(t);
  }
  let inputOn = false, comfortSaid = false;

  function light(k, ms){
    tiles[k].classList.add('lit');
    tiles[k].style.backgroundImage = 'url(' + mcIcon('diamond') + ')';
    T.after(Math.max(220, ms*0.65), ()=>{
      tiles[k].classList.remove('lit');
      tiles[k].style.backgroundImage = '';
    });
  }
  function runSeq(seqIdx, seq){
    inputOn = false;
    hint.textContent = '👀 看顺序…';
    tiles.forEach(t=>{ t.onclick = null; });            // 展示期禁点
    const pace = adapt.t(params.pace);
    seq.forEach((k, s)=>T.after(400 + s*pace, ()=>light(k, pace)));
    T.after(400 + seq.length*pace + 200, ()=>{
      hint.textContent = '👉 按顺序点！';
      inputOn = true;
      let step = 0; const t0 = performance.now();
      tiles.forEach((t, k)=>{
        t.onclick = ()=>{
          if(!inputOn) return;
          if(k === seq[step]){
            light(k, 400); t.classList.add('good');
            T.after(300, ()=>t.classList.remove('good'));
            stats.rts.push(performance.now()-t0);
            stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak);
            adapt.record(true);
            step++;
            if(step >= seq.length){                      // 整序列完成
              inputOn = false;
              stats.trials++; stats.correct++;
              sfx('pick');
              T.after(700, ()=>nextSeq(++seqIdx));
            }
          } else {
            inputOn = false;
            t.classList.add('bad');
            stats.trials++;
            stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak+1);
            if(adapt.record(false)==='valve'){
              stats.valveCount++;
              if(!comfortSaid){ comfortSaid=true; focusSpeak(comfortLine()); }
            }
            T.after(600, ()=>{ t.classList.remove('bad'); nextSeq(++seqIdx); });
          }
        };
      });
    });
  }
  let seqIdx = 0, isStopped = false;
  function nextSeq(n){
    if(isStopped) return;
    if(n >= params.seqs){
      stats.acc = stats.trials ? stats.correct/stats.trials : 0;
      stats.mrt = median(stats.rts);
      stats.valveCount += adapt.valveCount;
      h.end(stats);
      return;
    }
    h.progress(n, params.seqs);
    const len = params.demo && n===0 ? 2 : params.len;
    const pool = tiles.map((_,k)=>k);
    const seq = [];
    while(seq.length < len && pool.length){ seq.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]); }
    if(params.demo && n===0){
      focusSpeak('看，钻石亮了两次，你也点两下！');
      T.after(600, ()=>runSeq(n, seq));
    } else runSeq(n, seq);
  }
  nextSeq(0);
  return { stop(){ isStopped = true; T.stop(); } };
}

/* ---------- 任务切换:听指挥的小矿工 ----------
   旗子=当前规则(羊毛颜色 / 方块材质 / 大小), 点符合目标的方块;旗子会变 */
const SW_WOOLS = ['wool_red','wool_blue','wool_yellow'];
const SW_MATS  = ['cobble','planks','brick'];
function runSwitch(area, params, adapt, h){
  const T = mkTimers();
  const stats = { trials:0, correct:0, rts:[], maxStreakErr:0, valveCount:0 };
  const ruleNames = ['color','mat','size'].slice(0, params.rules);
  let rule = ruleNames[0], comfortSaid = false;

  const flag = fEl('div', 'f-switch-flag');
  area.appendChild(flag);
  const board = fEl('div', 'f-switch-board');
  area.appendChild(board);

  function flagHTML(target){
    if(rule==='size')
      return mcIconTag('flag') + '<img class="tgt '+(target.attr==='big'?'tgt-big':'tgt-small')+'" src="'+mcIcon('stone')+'">';
    return mcIconTag('flag') + '<img class="tgt" src="'+mcIcon(target.attr)+'">';
  }
  function mcIconTag(n){ return '<img class="flagpole" draggable="false" src="'+mcIcon(n)+'">'; }

  function trial(isDemo){
    const family = rule==='color' ? SW_WOOLS : rule==='mat' ? SW_MATS
                 : (Math.random()<0.5 ? SW_WOOLS : SW_MATS);
    const target = { attr:null };
    let isCorrect;
    if(rule==='color'){ target.attr = pickRand(SW_WOOLS); isCorrect = b=>b.icon===target.attr; }
    else if(rule==='mat'){ target.attr = pickRand(SW_MATS); isCorrect = b=>b.icon===target.attr; }
    else { target.attr = pickRand(['big','small']); isCorrect = b=>b.size===target.attr; }
    flag.innerHTML = flagHTML(target);
    board.innerHTML = '';

    const choices = [];
    if(rule==='size'){
      const wrongSize = target.attr==='big' ? 'small' : 'big';
      const shuffled = [...family].sort(()=>Math.random()-0.5);
      for(let k=0;k<params.choices-1;k++)
        choices.push({icon: shuffled[k%shuffled.length], size: wrongSize});
      choices.push({icon: pickRand(family), size: target.attr});   // 唯一正确
    } else {
      choices.push({icon: target.attr, size: pickRand(['big','small'])});
      const others = family.filter(x=>x!==target.attr);
      let k = 0;
      while(choices.length < params.choices){
        choices.push({icon: others[k%others.length], size: pickRand(['big','small'])});
        k++;
      }
    }
    for(let k=choices.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); [choices[k],choices[j]]=[choices[j],choices[k]]; }

    let answered = false; const t0 = performance.now();
    choices.forEach(c=>{
      const el = fEl('div', 'f-block block ' + (c.size==='big'?'big':'small'),
        '<img draggable="false" src="'+mcIcon(c.icon)+'">');
      el.onclick = ()=>{
        if(answered) return; answered = true;
        const ok = isCorrect(c);
        if(ok){ stats.rts.push(performance.now()-t0); el.classList.add('good'); sfx('pick'); }
        else { el.classList.add('bad'); sfx('click'); }
        if(isDemo===undefined){
          stats.trials++;
          if(ok) stats.correct++;
          stats.maxStreakErr = Math.max(stats.maxStreakErr, adapt.streak + (ok?0:1));
          if(adapt.record(ok)==='valve'){
            stats.valveCount++;
            if(!comfortSaid){ comfortSaid=true; focusSpeak(comfortLine()); }
            flag.classList.add('bounce');
            T.after(800, ()=>flag.classList.remove('bounce'));
          }
        }
        T.after(420, next);
      };
      board.appendChild(el);
      if(isDemo && isCorrect(c))
        T.after(1200, ()=>{ if(!answered){ el.classList.add('hint'); focusSpeak('看，点这个！'); } });
    });
  }

  let idx = 0, sinceSwitch = 0, isStopped = false;
  function next(){
    if(isStopped) return;
    if(params.demo && idx<2){ h.progress(0, params.trials); trial(true); idx++; return; }
    if(idx >= params.trials){ finish(); return; }
    h.progress(idx, params.trials);
    // 切换规则?
    if(ruleNames.length>1 && sinceSwitch >= Math.max(1, params.switchEvery + (Math.random()<0.3?-1:0))){
      const old = rule;
      rule = pickRand(ruleNames.filter(r=>r!==old));
      sinceSwitch = 0;
      flag.classList.add('bounce');
      sfx('click');
      focusSpeak('旗子变啦！');
      T.after(800, ()=>flag.classList.remove('bounce'));
    } else sinceSwitch++;
    trial();
    idx++;
  }
  function finish(){
    stats.acc = stats.trials ? stats.correct/stats.trials : 0;
    stats.mrt = median(stats.rts);
    stats.valveCount += adapt.valveCount;
    flag.remove(); board.remove();
    h.end(stats);
  }
  next();
  return { stop(){ isStopped = true; T.stop(); flag.remove(); board.remove(); } };
}

/* ---------- 调度入口 ---------- */
function runFocusLevel(level, area, h, calib0){
  const adapt = mkAdapt(calib0);
  const p = {...level.params};
  if(level.kind==='tutorial') p.demo = true;
  if(level.dim==='cpt')         return runDiscrimination(area, p, adapt, h, 'cpt');
  if(level.dim==='gonogo')      return runDiscrimination(area, p, adapt, h, 'gonogo');
  if(level.dim==='flanker')     return runFlanker(area, p, adapt, h);
  if(level.dim==='corsi')       return runCorsi(area, p, adapt, h);
  if(level.dim==='switch')      return runSwitch(area, p, adapt, h);
  if(level.kind==='master'){                             // 五维连续小节
    const T = mkTimers();
    let isStopped = false;
    const agg = { trials:0, correct:0, rts:[], maxStreakErr:0, valveCount:0, goTrials:0, hits:0 };
    let sec = 0;
    function runSection(){
      if(isStopped) return;
      if(sec >= level.sections.length){
        agg.acc = agg.trials ? agg.correct/agg.trials : 0;
        agg.mrt = median(agg.rts);
        agg.hitRate = agg.goTrials ? agg.hits/agg.goTrials : 1;
        h.end(agg);
        return;
      }
      const s = level.sections[sec];
      focusSpeak('新游戏：' + FOCUS_META[s.dim].game + '！');
      const sub = {
        progress(k,n){ h.progress(sec + k/Math.max(1,n), level.sections.length); },
        showRule(){ h.showRule && h.showRule(s.dim); },
        end(st){
          agg.trials += st.trials; agg.correct += st.correct;
          agg.rts.push(...st.rts);
          agg.goTrials += st.goTrials||0; agg.hits += st.hits||0;
          agg.maxStreakErr = Math.max(agg.maxStreakErr, st.maxStreakErr);
          agg.valveCount += st.valveCount;
          sec++;
          T.after(600, runSection);
        }
      };
      const p2 = {...s.params};
      area.innerHTML = '';
      const engine = runFocusLevel({dim:s.dim, kind:'normal', params:p2}, area, sub, calib0);
      curStop = engine ? engine.stop : null;
    }
    let curStop = null;
    runSection();
    return { stop(){ isStopped = true; T.stop(); if(curStop) curStop(); } };
  }
}
