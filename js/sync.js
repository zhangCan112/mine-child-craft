"use strict";
/* ============================================================
   进度同步层: 每台设备进度双写 (localStorage + 服务端)
   服务端按 IP 分配固定设备 ID → 浏览器清缓存后仍能找回进度
   file:// 直开(桌面)自动降级为纯 localStorage
   存档键注册制: 各存档模块在加载期顶层调 registerSyncKeys(或经
   SyncDB.slot 创建即注册)。全部 <script defer> 执行完之后才会收到
   服务器镜像, 注册永远先于回填 — "新模式存档"不再跨层改本文件。
============================================================ */
const SYNC_KEYS = [];
function registerSyncKeys(){
  for(let i=0; i<arguments.length; i++){
    const k = arguments[i];
    if(SYNC_KEYS.indexOf(k) < 0) SYNC_KEYS.push(k);
  }
}

let _readyRes = null;
const SyncDB = {
  ready: new Promise(r=>{ _readyRes = r; }),   // 服务器镜像完成后 resolve (file:// 或离线立即) — 每日预算等它, 见 main.js setupBudgets
  enabled: (typeof location !== 'undefined' && location.protocol.indexOf('http') === 0),
  deviceId: null,
  cache: {},                       // 服务端整份镜像
  dirty: new Set(),                // 本次会话本地改过的键 (防加载竞态覆盖)
  loaded: false,
  _timer: 0,

  init(){
    if(!this.enabled){ _readyRes(); return; }
    fetch('/id', {cache:'no-store'})
      .then(r=>r.json())
      .then(({id})=>{
        this.deviceId = id;
        return fetch('/progress?id=' + encodeURIComponent(id), {cache:'no-store'});
      })
      .then(r=>r.ok ? r.json() : {})
      .then(blob=>{
        for(const k in blob){
          if(!this.dirty.has(k)){
            this.cache[k] = blob[k];
            try{ localStorage.setItem(k, blob[k]); }catch(e){}
          }
        }
        // 老玩家本地有进度而服务端还没有 → 补传
        let changed = false;
        for(const k of SYNC_KEYS){
          if(this.cache[k] === undefined){
            const local = (()=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } })();
            if(local !== null){ this.cache[k] = local; changed = true; }
          }
        }
        this.loaded = true;
        if(changed) this.push();
        _readyRes();
      })
      .catch(()=>{ /* 桌面/离线: 静默降级 */ _readyRes(); });
  },

  get(key){
    if(Object.prototype.hasOwnProperty.call(this.cache, key)) return this.cache[key];
    try{ return localStorage.getItem(key); }catch(e){ return null; }
  },
  /* 存档槽: 声明即得 load/save/reset (逻辑在 js/save-slot.js, 纯函数可单测)
     创建即注册进 SYNC_KEYS(加载期顶层调用, 先于服务器镜像到达, 无回填竞态) */
  slot(key, schema){
    registerSyncKeys(key);
    return mkSaveSlot(
      { get:k=>this.get(k), set:(k,v)=>this.set(k,v), remove:k=>this.remove(k) },
      key, schema);
  },
  set(key, value){
    try{ localStorage.setItem(key, value); }catch(e){}
    this.cache[key] = value;
    this.dirty.add(key);
    this.schedule();
  },
  remove(key){
    try{ localStorage.removeItem(key); }catch(e){}
    delete this.cache[key];
    this.dirty.add(key);
    this.schedule();
  },

  schedule(){
    if(!this.enabled) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(()=>this.push(), 800);
  },
  push(){
    if(!this.enabled || !this.deviceId) return;
    try{
      fetch('/progress?id=' + encodeURIComponent(this.deviceId), {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(this.cache)
      }).catch(()=>{});
    }catch(e){}
  }
};
SyncDB.init();
addEventListener('pagehide', ()=>SyncDB.push());
