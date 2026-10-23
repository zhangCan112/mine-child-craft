'use strict';
/* ============================================================
   音量面板 (AudioVolPanel) — 应用层 adapter, 术语见 GLOSSARY.md
   ------------------------------------------------------------
   主菜单 🎵 按钮 + 音乐/音效两滑杆的装配: 滑杆位置(0..1 倍率)持久化在
   audio-core 的 mkVolState(存的是倍率, 语义见其头注释), 拨动即时经
   AudioMixer.setMusicVol/setSfxVol 乘上双端总线基准生效。
   面板 DOM 在 index.html 的 #menuMain 内(工单纪律: index.html 由集成者
   统一改, 本文件只按 id 接线) — DOM 未挂(集成前/boot 冒烟桩)时静默
   跳过, 加载零副作用。
   interface: setupVolPanel()(顶层自动执行一次, DOM 缺失即空转)
   依赖(均经全局名, 调用期解析): config.js 的 IS_TOUCH · audio-core.js 的
     mkVolState · audio.js 的 AudioMixer · 浏览器 localStorage/DOM —
     须后于 audio-core.js 加载(接线发生在调用期, 顺序要求仅为惯例归组)
   可测性声明: DOM/存储全部调用期访问, Node 测试可安全加载; adapter 无直测, 经 boot 冒烟覆盖(conventions §1.9)
   ============================================================ */

function setupVolPanel() {
  const btn = document.getElementById('volBtn');
  const panel = document.getElementById('volPanel');
  const mRow = document.getElementById('volMusicRow');
  const sRow = document.getElementById('volSfxRow');
  const mIn = document.getElementById('volMusic');
  const sIn = document.getElementById('volSfx');
  if (!btn || !panel || !mRow || !sRow || !mIn || !sIn) return; // DOM 未挂: 集成前/boot 桩, 静默跳过

  /* 音量账本: localStorage 直存 — 音量偏好是"这台设备喇叭"的事, 不进 SyncDB
     跨设备镜像(与游玩进度不同账); 音频上下文未建时 setXxxVol 只改倍率,
     建链(sfxBus/musicBus)时自然带上, 无需等手势 */
  const vol = mkVolState({
    storage: {get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v)},
    isTouch: IS_TOUCH,
  });

  /* 拨动即生效: 滑杆值先入账(0..1 钳制+持久化)再推给总线; 静到 0 时整行
     变暗 — 给不识百分数的孩子一个"关掉了"的视觉反馈 */
  function applyMusic() {
    const v = vol.setMusic(parseFloat(mIn.value));
    AudioMixer.setMusicVol(v);
    mRow.classList.toggle('muted', v <= 0);
  }
  function applySfx() {
    const v = vol.setSfx(parseFloat(sIn.value));
    AudioMixer.setSfxVol(v);
    sRow.classList.toggle('muted', v <= 0);
  }
  mIn.addEventListener('input', applyMusic);
  sIn.addEventListener('input', applySfx);

  /* 初值: 杆位摆到存档倍率并立即接上(上一台会话调过的音量开机即还原) */
  mIn.value = String(vol.music());
  sIn.value = String(vol.sfx());
  applyMusic();
  applySfx();

  /* 🎵 显式开关面板: 不做"点外部收起" — 孩子拨杆时误触关闭比多按一次更糟 */
  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
  });
}

setupVolPanel();
