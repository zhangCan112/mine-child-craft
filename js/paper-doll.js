'use strict';
/* ============================================================
   纸娃娃预览 (PaperDoll, 装备 T9 / 设计稿 §9.3) — 引擎层
   ------------------------------------------------------------
   背包面板装备页的 3D 定格预览: MobLookKit.puppet('player') 独立小人 +
   mkArmorOverlay 穿戴几何(共享权威, 与玩家身上同款), 自建小 WebGLRenderer
   画一帧——零 rAF 循环(worn 变化按需重画, 省电口径照顾低配 iPad, 用户
   拍板「3D 定格不转」), 面板 unmount 时 dispose(渲染器 forceContextLoss +
   遍历释放, 免 WebGL 上下文泄漏)。惰性建: mkPaperDoll 只建容器 el,
   首次 paint 才碰 THREE/DOM——mode-kit 经 equip.mkPreview 工厂缝注入
   本件(设计稿 §9.3), 桩工厂替身让 mode-kit 单测保持零 THREE。
   interface: mkPaperDoll(opts) → {el · paint(worn) · dispose()}
     opts.doc    文档注入(缺省 document)
     opts.w/h    画布尺寸 px(缺省 116×150, CSS 同款观感)
     paint(worn) 声明穿戴并按需重画一帧(四槽 id 签名幂等——同穿戴不重画)
     dispose()   释放渲染器/几何/材质; 幂等(重复调无害)
   依赖(均经全局名, 调用期解析): mob-look-kit.js 的 MobLookKit.puppet,
     armor-overlay.js 的 mkArmorOverlay, equipment-core.js 的 EQUIP_SLOTS
     (签名序), lib/three.min.js(THREE 惰性使用)
   可测性: THREE/DOM 全惰性, Node 不直测, 由 test/boot.test.js 冒烟罩
     (桩环境下装备页不 show 即零触碰)
   ============================================================ */

function mkPaperDoll(opts) {
  const o = opts || {};
  const doc = o.doc || document;
  const W = o.w || 116;
  const H = o.h || 150;
  const el = doc.createElement('div');
  el.className = 'mkp-dollcv';
  let built = null; // {renderer, scene, camera, puppet, overlay, sig} 惰性首建
  /* 首次 paint 才建: THREE 全家 + 小人 + 穿戴层(构造可能发生在模式
     加载早期——boot 桩环境零触碰) */
  function build() {
    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    renderer.setPixelRatio(Math.min(
      (typeof devicePixelRatio === 'number' && devicePixelRatio > 0) ? devicePixelRatio : 1, 2));
    renderer.setSize(W, H);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    /* 打光: 环境光保底 + 前上主光塑形(小人已转向观众, 光随正面) */
    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(-2.2, 4.4, 3.4);
    scene.add(sun);
    const puppet = MobLookKit.puppet('player');
    puppet.root.rotation.y = Math.PI; /* 玩家原生朝 -Z, 转 180° 正面示人 */
    scene.add(puppet.root);
    const overlay = mkArmorOverlay(puppet);
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 20);
    camera.position.set(0, 0.95, 3.55); /* 眼高居中, 距离罩住头到靴 */
    camera.lookAt(0, 0.9, 0);
    built = {renderer, scene, camera, puppet, overlay, sig: ''};
  }
  return {
    el,
    paint(worn) {
      if (!built) build();
      /* 四槽 id 签名(装备核心表序): 同穿戴不重画——预览按需一帧 */
      const s = EQUIP_SLOTS.map((k) => (worn && worn[k] ? worn[k].id : '')).join(',');
      if (s === built.sig) return;
      built.sig = s;
      built.overlay.apply(worn);
      built.renderer.render(built.scene, built.camera);
    },
    dispose() {
      if (!built) return;
      const b = built;
      built = null;
      b.overlay.dispose();
      b.scene.traverse((n) => {/* 小人皮肤材质与 overlay 几何一并释放 */
        if (n.geometry && n.geometry.dispose) n.geometry.dispose();
        const m = n.material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      });
      if (b.renderer.domElement && b.renderer.domElement.parentNode) {
        b.renderer.domElement.parentNode.removeChild(b.renderer.domElement);
      }
      b.renderer.dispose();
      if (b.renderer.forceContextLoss) b.renderer.forceContextLoss();
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {mkPaperDoll};
}
