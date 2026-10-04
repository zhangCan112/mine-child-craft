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
function mkAdapt(){
  const hist = [];
  return {
    calib: 1,                 // 时间参数乘数:>1 更宽松
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
  const goSet = ['💎'];
  let noSet = framing==='gonogo' ? ['🧨'] : ['🪨','⬛','🟫'];
  if(framing==='gonogo' && params.disguised) noSet = ['💠'];
  if(framing==='cpt' && params.similar)      noSet = ['🪨','💠'];
  const goRate = framing==='gonogo' ? params.goRate : params.targetRate;
  let comfortSaid = false;

  function showStim(emoji, hinted){
    const s = fEl('div', 'f-stim' + (hinted?' hint':''), emoji);
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
    trial(Math.random() < goRate);
    idx++;
  }
  let isStopped = false;
  function finish(){
    stats.acc = stats.trials ? stats.correct/stats.trials : 0;
    stats.mrt = median(stats.rts);
    stats.valveCount += adapt.valveCount;
    h.end(stats);
  }
  next();
  return { stop(){ isStopped = true; T.stop(); } };
}

/* ---------- Flanker:苦力怕排队 ----------
   一排像素苦力怕, 只看中间那只的视线方向, 点左右按钮 */
let creeperCache = {};
function creeperFace(dir){
  if(creeperCache[dir]) return creeperCache[dir];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#4fae4f'; g.fillRect(0,0,16,16);
  g.fillStyle = '#3d8f3d';                                  // 噪点(固定图案)
  [[1,2],[5,1],[9,3],[13,2],[3,7],[11,6],[2,12],[7,14],[12,11],[14,14],[6,9],[9,13]]
    .forEach(([x,y])=>g.fillRect(x,y,1,1));
  const eyeY = 5;
  [[3],[10]].forEach(([x])=>{                               // 眼白+瞳孔(瞳孔位置=方向)
    g.fillStyle = '#f4f4f4'; g.fillRect(x, eyeY, 3, 3);
    g.fillStyle = '#101510';
    g.fillRect(dir<0 ? x : x+2, eyeY+1, 1, 2);
  });
  g.fillStyle = '#101510';                                  // 嘴
  g.fillRect(6,9,4,3); g.fillRect(7,12,2,2);
  const big = document.createElement('canvas');
  big.width = big.height = 96;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, 96, 96);
  creeperCache[dir] = big.toDataURL();
  return creeperCache[dir];
}
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
    T.after(Math.max(220, ms*0.65), ()=>tiles[k].classList.remove('lit'));
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
   旗子=当前规则(颜色/形状/大小), 点符合目标的方块;旗子会变 */
function runSwitch(area, params, adapt, h){
  const T = mkTimers();
  const stats = { trials:0, correct:0, rts:[], maxStreakErr:0, valveCount:0 };
  const ruleNames = ['color','shape','size'].slice(0, params.rules);
  const colors = ['red','blue','yellow'];
  const shapes = ['square','circle'];
  let rule = ruleNames[0], comfortSaid = false;

  const flag = fEl('div', 'f-switch-flag', '🚩');
  area.appendChild(flag);
  const board = fEl('div', 'f-switch-board');
  area.appendChild(board);

  function flagContent(target){
    if(rule==='color') return '🚩<span class="sw big '+target.color+'"></span>';
    if(rule==='shape') return '🚩<span class="outline big '+target.shape+'"></span>';
    return '🚩<span class="dot '+(target.size==='big'?'big':'small')+'"></span>';
  }
  function mkBlock(color, shape, size, isTarget){
    return fEl('div', 'sw block '+color+' '+shape+' '+(size==='big'?'big':'small'));
  }
  function trial(isDemo){
    const target = { color:pickRand(colors), shape:pickRand(shapes), size:pickRand(['big','small']) };
    flag.innerHTML = flagContent(target);
    board.innerHTML = '';
    const choices = [];
    choices.push({...target});                             // 唯一正确项
    while(choices.length < params.choices){
      const c = { color:pickRand(colors), shape:pickRand(shapes), size:pickRand(['big','small']) };
      const wrongOnRule = rule==='color' ? c.color!==target.color
                        : rule==='shape' ? c.shape!==target.shape
                        : c.size!==target.size;
      if(wrongOnRule && !choices.some(x=>x.color===c.color&&x.shape===c.shape&&x.size===c.size))
        choices.push(c);
    }
    // 打乱
    for(let k=choices.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); [choices[k],choices[j]]=[choices[j],choices[k]]; }

    let answered = false; const t0 = performance.now();
    choices.forEach(c=>{
      const el = mkBlock(c.color, c.shape, c.size);
      el.onclick = ()=>{
        if(answered) return; answered = true;
        const ok = c.color===target.color && c.shape===target.shape && c.size===target.size;
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
      if(isDemo){
        const isT = c.color===target.color && c.shape===target.shape && c.size===target.size;
        if(isT) T.after(1200, ()=>{ if(!answered){ el.classList.add('hint'); focusSpeak('看，点这个！'); } });
      }
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
function runFocusLevel(level, area, h){
  const adapt = mkAdapt();
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
    const agg = { trials:0, correct:0, rts:[], maxStreakErr:0, valveCount:0 };
    let sec = 0;
    function runSection(){
      if(isStopped) return;
      if(sec >= level.sections.length){
        agg.acc = agg.trials ? agg.correct/agg.trials : 0;
        agg.mrt = median(agg.rts);
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
          agg.maxStreakErr = Math.max(agg.maxStreakErr, st.maxStreakErr);
          agg.valveCount += st.valveCount;
          sec++;
          T.after(600, runSection);
        }
      };
      const p2 = {...s.params};
      area.innerHTML = '';
      const engine = runFocusLevel({dim:s.dim, kind:'normal', params:p2}, area, sub);
      curStop = engine ? engine.stop : null;
    }
    let curStop = null;
    runSection();
    return { stop(){ isStopped = true; T.stop(); if(curStop) curStop(); } };
  }
}
