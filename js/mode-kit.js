"use strict";
/* ============================================================
   ModeKit — 应用层 shell 服务 (术语见 GLOSSARY.md)
   ------------------------------------------------------------
   mkMode(cfg) 把四个模式各自复制的样板收进一个深 interface:
     · chrome {score,hotbar}   进入模式时施加 DOM 显隐(cleanup 无需还原)
     · hotbar (mkHotbar 实例)  digit/wheel/点选 选块全自动
     · hud(hit) → string[]     每帧 HUD 文本(hit 由主循环注入, 模式不再自行 raycast)
     · touch [...]             setTouchActions 声明 (缺省=null 隐藏)
     · KeyB 默认暂停 · 无 hud 配置则清空并跳过 · onVoidFall 默认回最近出生点
   工具: spawn(对外经 ModeKit.spawn) / lookName / confirmBtn
   引擎层(world/input)对本文件零依赖; 本文件属应用层
============================================================ */

const MK = (typeof document !== 'undefined')
  ? { hotbar: document.getElementById('hotbar'),
      score:  document.getElementById('score'),
      hud:    document.getElementById('hud') }
  : { hotbar: null, score: null, hud: null };     // Node 测试环境

/* ---------- 出生点: 设置玩家状态并记住, 供默认 onVoidFall 兜底 ----------
   (内部名 kitSpawn: 不占用共享全局里最裸的 spawn 一词, 经 ModeKit.spawn 对外) */
let mkLastSpawn = null;
function kitSpawn(x, y, z, o){
  o = o || {};
  pos.set(x, y, z);
  vel.set(0, 0, 0);
  yaw = o.yaw || 0;
  pitch = o.pitch || 0;
  onGround = false;
  mkLastSpawn = { x, y, z, yaw: o.yaw || 0, pitch: o.pitch || 0 };
}

/* "注视"方块名 — arena/build/tnt 三处重复的查询 */
function lookName(hit){
  if(!hit) return '无';
  const id = getBlock(hit.x, hit.y, hit.z);
  return BLOCKS[id] ? BLOCKS[id].name : '?';
}

/* ---------- hotbar: 两种槽型 {block:id} | {icon,lbl,cnt()} ----------
   cls:'build' 附加类名; cnt 为函数, refresh/show 时重读 (tnt 库存) */
function mkHotbar(opts){
  const o = opts || {};
  const doc = o.doc || document;                  // 可注入, 供 Node 单测
  const mount = o.mount || MK.hotbar;
  const items = o.items || [];
  let sel = 0;
  function render(){
    mount.innerHTML = '';
    mount.classList.toggle('build', o.cls === 'build');
    items.forEach((it, i)=>{
      const div = doc.createElement('div');
      div.className = 'slot';
      let html = '<span class="num">' + (i + 1 <= 9 ? i + 1 : '') + '</span>';
      if(it.block !== undefined){
        const b = BLOCKS[it.block], col = (b.all || b.side);
        html += '<div class="cube" style="background:rgb(' + col.map(c=>Math.round(c*255)).join(',') + ')"></div>'
             +  '<span class="lbl">' + b.name + '</span>';
      } else {
        html += '<span class="icon">' + it.icon + '</span>'
             +  '<span class="cnt">' + (it.cnt ? it.cnt() : '') + '</span>'
             +  '<span class="lbl">' + (it.lbl || '') + '</span>';
      }
      div.innerHTML = html;
      div.addEventListener('pointerdown', (ev)=>{ ev.preventDefault(); select(i); });
      mount.appendChild(div);
    });
    sync();
  }
  function sync(){
    [...mount.children].forEach((c, i)=>{
      c.classList.toggle('active', i === sel);
      if(items[i] && items[i].cnt){
        c.classList.toggle('empty', (items[i].cnt() || 0) <= 0);
        const cntEl = c.querySelector('.cnt');
        if(cntEl) cntEl.textContent = items[i].cnt();
      }
    });
  }
  function select(i){
    if(i < 0 || i >= items.length) return;
    sel = i;
    sync();
    if(o.onPick) o.onPick(i);
  }
  return {
    get sel(){ return sel; },
    items,
    select,
    refresh: sync,
    render,
    show(){ render(); mount.style.display = 'flex'; },
    hide(){ mount.style.display = 'none'; },
  };
}

/* ---------- 二次确认按钮 (tnt/focus 的"重置进度"共用) ---------- */
function confirmBtn(btn, o){
  let armed = false, t = 0;
  btn.textContent = o.label;
  btn.onclick = ()=>{
    if(armed){
      armed = false; clearTimeout(t);
      btn.textContent = o.label;
      o.onConfirm();
    } else {
      armed = true;
      btn.textContent = o.confirm;
      t = setTimeout(()=>{ armed = false; btn.textContent = o.label; }, o.hold || 3000);
    }
  };
}

/* ---------- 模式工厂: 模式只声明差异, 样板在此吸收 ---------- */
function mkMode(cfg){
  const hb = cfg.hotbar || null;
  function applyChrome(){
    if(MK.score) MK.score.style.display = (cfg.chrome && cfg.chrome.score) || 'none';
    /* hotbar: 'flex' 立即显示; 'deferred' 现在隐藏、由模式在合适时机自行 show()
       (如 TNT 入关卡后才现身); 缺省/none 恒隐藏 */
    if(hb && cfg.chrome && cfg.chrome.hotbar === 'flex') hb.show();
    else if(MK.hotbar) MK.hotbar.style.display = 'none';
    if(!cfg.hud && MK.hud) MK.hud.innerHTML = '';
  }
  const mode = {
    id: cfg.id,
    hotbar: hb,
    init(){
      applyChrome();
      setTouchActions(cfg.touch || null);
      if(cfg.init) cfg.init();
    },
    cleanup(){ if(cfg.cleanup) cfg.cleanup(); },
    update(dt){ if(cfg.update) cfg.update(dt); },
    onKey(code){
      if(code === 'KeyB'){ uiPause(); return; }   // 三模式共用的默认暂停键
      if(cfg.onKey) cfg.onKey(code);
    },
    onDigit(n){ if(hb) hb.select(n - 1); if(cfg.onDigit) cfg.onDigit(n); },
    onWheel(d){ if(hb) hb.select((hb.sel + d + hb.items.length) % hb.items.length); if(cfg.onWheel) cfg.onWheel(d); },
    onMouse(b, hit){ if(cfg.onMouse) cfg.onMouse(b, hit); },
    onVoidFall(){
      if(cfg.onVoidFall) cfg.onVoidFall();
      else if(mkLastSpawn) kitSpawn(mkLastSpawn.x, mkLastSpawn.y, mkLastSpawn.z, mkLastSpawn);
    },
  };
  if(cfg.onHighlight) mode.onHighlight = cfg.onHighlight;
  if(cfg.onMenu) mode.onMenu = cfg.onMenu;
  if(cfg.buildMenu) mode.buildMenu = cfg.buildMenu;
  if(cfg.hud && MK.hud){
    /* HUD 节流: 主循环每帧调用, 但文本至多 10Hz 变化 — 先限频再比对,
       内容相同直接跳过 innerHTML 写入(省去每帧 DOM 重建/布局/重绘,
       也省掉 hud() 内的全量重算, 如竞技场记分板遍历全部怪物) */
    let hudLastT = -1e9, hudLastHtml = null;
    mode.updateHud = (hit)=>{
      const now = performance.now();
      if(now - hudLastT < 100) return;
      hudLastT = now;
      const html = cfg.hud(hit).join('<br>');
      if(html === hudLastHtml) return;
      hudLastHtml = html;
      MK.hud.innerHTML = html;
    };
  }
  return mode;
}

const ModeKit = { mkMode, mkHotbar, spawn: kitSpawn, lookName, confirmBtn };
if(typeof module !== 'undefined' && module.exports) module.exports = ModeKit;
