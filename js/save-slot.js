"use strict";
/* ============================================================
   存档槽 (SaveSlot) — 应用层: 简单形状存档的深 interface
   ------------------------------------------------------------
   mkSaveSlot(storage, key, schema) → { load(), save(state), reset() }
     storage: { get(key)->str|null, set(key,str), remove(key) }   ← seam, 测试注入假存储
     schema : { version=1, defaults, migrate(saved, fromVer), encode, decode }
   约定:
     · load()  永不抛、永不返回 null — 损坏/未来版本 → defaults 深拷贝
     · save()  encode → 注入 _v → JSON.stringify → set
     · 老数据无 _v 视为版本 0, 沿 migrate(s,0)…migrate(s,v-1) 链升级
     · defaults 只补缺失字段(浅并入顶层), 已存字段保留
   生产接线在 sync.js 的 SyncDB.slot (SYNC_KEYS 随之自动注册)。
   ============================================================ */

function mkSaveSlot(storage, key, schema){
  const sc = schema || {};
  const version = sc.version || 1;
  const clone = (o)=> JSON.parse(JSON.stringify(o));

  function load(){
    let s = null;
    try{ s = JSON.parse(storage.get(key) || 'null'); }catch(e){ s = null; }
    if(!s || typeof s !== 'object' || Array.isArray(s)) return clone(sc.defaults || {});
    const v = (typeof s._v === 'number') ? s._v : 0;
    if(v > version) return clone(sc.defaults || {});        // 未来版本: 不猜形状
    try{
      for(let from = v; from < version; from++){
        if(sc.migrate) s = sc.migrate(s, from) || s;
      }
    }catch(e){ return clone(sc.defaults || {}); }
    delete s._v;                                            // 版本号不进入调用方状态
    const base = clone(sc.defaults || {});
    for(const k in base) if(s[k] === undefined) s[k] = base[k];
    try{ return sc.decode ? sc.decode(s) : s; }
    catch(e){ return clone(sc.defaults || {}); }
  }

  function save(state){
    const plain = sc.encode ? sc.encode(state) : state;
    storage.set(key, JSON.stringify(Object.assign({}, plain, { _v: version })));
  }

  function reset(){ storage.remove(key); }

  return { load, save, reset };
}

const SaveSlot = { mkSaveSlot };
if(typeof module !== 'undefined' && module.exports) module.exports = SaveSlot;
