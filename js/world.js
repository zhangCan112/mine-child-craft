'use strict';
/* ============================================================
   渲染 adapter（World · 术语见 GLOSSARY.md 的"场景装填/距离环"）— 引擎层
   ------------------------------------------------------------
   体素模型的渲染端: 场景/灯光/贴图/区块网格(全细节+LOD)/编辑管线/高亮。
   纯体素数据(存取/碰撞/物理/射线/光场存储/水位面)在 js/voxel.js — 本文件不定义游戏规则。
   interface: loadScene(建场 seam: 清场→批量建→流体激活→光场全量→渐进收尾入队) / markDirty /
     pumpRemesh(每帧按预算构建, 编辑优先于环填充) / maintainRings(距离环:
     近实远虚三档) / rebuildAll / editBlock·editBlockDirty(破坏返回方块
      级联清单, 设计稿 block-lifecycle D3; 编辑经 setBlockLit 连带双通道光场
      增量, 昼夜 §3.3/D4) / applySweep(世界卫生清扫, P14/D9)
      / applyDaylight(昼夜场景驱动: 天色/平行光强/日月轨道 + 顶点光材质
      uniforms uDim/uSkyFloor 节拍, 设计稿 mc-daylight-torch §2.3/§4.2)
      / setPlayerGlow(玩家随身光机制缝: 方块光 uniform + 实体侧 PointLight,
      政策归 D7) / dayTime·dayCycleOn(昼夜顶层绑定, 跨文件可写:
      main.js 推进·模式层换景) / pumpFluids(流体计划刻泵, 设计稿 liquid D5)
      / activateFluids(装场全场激活) / setFluidEditSink(流体写格→模式账本
      的缝, Tank 钩子先例) / raycast / camera / renderer / scene。
   依赖(均经全局名, 调用期解析): voxel.js(体素数据+光场数组+水位面) ·
   cascade-core.js(方块级联) · fluid-core.js(流体核心) ·
   light-core.js(光照核心: 装场全量 computeAll + 编辑增量 updateEdit) ·
   mesh-core.js(网格化核心, 同一份代码在 Worker 里跑) · daylight-core.js
   (Daylight/DAYLIGHT 昼夜纯函数, DAYLIGHT 常数在加载期插值进 GLSL 模板,
   单源) · config.js(VIEW/CAM/BLOCKS/FLUIDS/FLUID) · lib/three.min.js。
   THREE/DOM 惰性创建, Node 测试环境可安全加载(经 boot.test.js 冒烟)。
============================================================ */

/* ---------- 噪声哈希与世界数据已移至 js/voxel.js (体素模型) ---------- */

/* ---------- Three.js 场景 ---------- */
/* 抗锯齿策略: 体素世界的锯齿主源是远处方块轮廓与细线高亮框的高对比几何
   边缘, MSAA 恰好只平滑几何边缘、不糊像素观感, 对本画风收益最大 —
   全设备开启 (旧"触屏关 MSAA 省 1.5 填充率"假设对 2D 像素成立,
   对 3D 透视几何不成立, 已由触屏 DPR 帧率自适应取代, 见 main.js)。
   high-performance 提示移动 GPU 拉满时钟(默认不指定偏保守)。 */
const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // 初始拉满; 触屏按帧率证据自适应回落
renderer.setSize(innerWidth, innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const sky = new THREE.Color(0x8fc7ff);
scene.background = sky;
scene.fog = new THREE.Fog(sky, VIEW.fogNear, VIEW.fogFar); // 雾即渲染边界(Minecraft 同款语义): 远景到雾终点融进天色

// far 只到雾终点+余量 — 雾外顶点不再参与变换与深度精度(原 1000 白交)
const camera = new THREE.PerspectiveCamera(72, innerWidth/innerHeight, 0.1, VIEW.far);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.65); /* 具名: applyDaylight 随昼夜调强度(实体暗化) */
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xfff4e0, 0.75);
sun.position.set(60, 120, 40);
scene.add(sun);


/* ---------- 昼夜场景驱动(设计稿 mc-daylight-torch §2.2/§2.3, 消费 daylight-core) ----------
   时间本体 dayTime 与开关 dayCycleOn 是引擎级顶层绑定(跨文件可写 → let,
   conventions §2.1 先例): main.js 主循环推进与调用, modes/adventure.js
   从存档换装/复位。nether 的 applySky 是另一套静态换天(不置位 dayCycleOn,
   两边互不干扰 — applyDaylight 只在 dayCycleOn 时被主循环调用)。 */
let dayTime = 0;
let dayCycleOn = false;
let daylightKey = null; /* 上次已写入的颜色比较键(dayTime 量化 50 tick); null=首帧必写 */

/* 日/月天体(§2.4): 像素方块贴图(太阳=暖黄方块, 月亮=灰白方块带缺口),
   与按钮像素图标工坊同色板(HUD 时段图标在那边, 图形单一权威归应用层);
   轨道恒以玩家为参照, 地平线下隐藏(装饰光斑已随真日上场而移除)。 */
function makeCelestialTexture(isSun) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  if (isSun) {
    g.fillStyle = '#f2b93b'; /* 暖黄底 */
    g.fillRect(2, 2, 12, 12);
    g.fillStyle = '#ffdf6b';
    g.fillRect(3, 3, 10, 10);
    g.fillStyle = '#fff3b0'; /* 亮芯 */
    g.fillRect(5, 5, 4, 4);
  } else {
    g.fillStyle = '#e6eaf2'; /* 灰白方块, 右上斜切缺口 */
    const rowW = [6, 8, 10, 12, 12, 12, 12, 12, 12, 12, 12, 12];
    for (let i = 0; i < 12; i++) g.fillRect(2, 2 + i, rowW[i], 1);
    g.fillStyle = '#b9c2d4'; /* 底缘暗一档 */
    g.fillRect(2, 13, 12, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; /* 近处保持像素颗粒 */
  return tex;
}
function makeCelestialSprite(isSun) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: makeCelestialTexture(isSun),
    fog: false, transparent: true, depthWrite: false}));
  s.scale.set(14, 14, 1);
  s.visible = false; /* dayCycleOn 关闭的模式不显示天体(其余模式观感恒白天) */
  scene.add(s);
  return s;
}
const sunSprite = makeCelestialSprite(true);
const moonSprite = makeCelestialSprite(false);

/* 每帧昼夜驱动(§2.3 驱动表): 天色/雾/AmbientLight/sun 强度/光斑显隐按
   颜色比较键值变化才写(量化 50 tick ≈ 2.5s, 颜色阶进无感); 日月轨道逐帧
   连续跟随。dayCycleOn=false 时以 tick 0 口径复位白天观感(幂等, 探险
   cleanup/switchMode 兜底调用)。 */
function applyDaylight() {
  const t = dayCycleOn ? dayTime : 0;
  const key = dayCycleOn ? Math.floor(t / 50) : -1;
  if (key !== daylightKey) {
    daylightKey = key;
    const dim = Daylight.skyDim(t);
    const c = Daylight.skyColor(t);
    scene.background.setRGB(c[0], c[1], c[2]);
    scene.fog.color.setRGB(c[0], c[1], c[2]);
    /* 实体变暗: 怪/Avatar/掉落物走 Lambert, 环境光随时间衰减自动生效(§4.3) */
    ambientLight.intensity = 0.65 * Daylight.renderBright(15 - dim);
    sun.intensity = 0.75 * (1 - dim / 11);
    /* 顶点光材质 uniforms(D3 §4.2/§4.4): 与天色同一比较键节拍(50 tick 量化,
       夜色阶进无感); uSkyFloor 两态 — 探险(dayCycleOn)真实洞穴/夜, 其余模式
       恒 15 ≈ 现状观感(向后兼容, 关循环复位幂等) */
    VOXEL_LIGHT.uDim.value = dim;
    VOXEL_LIGHT.uSkyFloor.value = dayCycleOn ? 0 : 15;
  }
  /* 日月轨道(§2.4): a = dayTime/24000 × 2π; tick 0 太阳在东方地平线,
     6000 当顶(MC 同相位); 月在太阳对侧; 地平线下(sin a < −0.15)隐藏 */
  const a = (t / DAYLIGHT.TICKS) * Math.PI * 2;
  sunSprite.position.set(pos.x + Math.cos(a) * 170, pos.y + Math.sin(a) * 170, pos.z + 40);
  moonSprite.position.set(pos.x - Math.cos(a) * 170, pos.y - Math.sin(a) * 170, pos.z + 40);
  sunSprite.visible = dayCycleOn && Math.sin(a) >= -0.15;
  moonSprite.visible = dayCycleOn && -Math.sin(a) >= -0.15;
  /* 灯笼随身光逐帧跟随(§8.3 机制缝, setPlayerGlow 开启时): 挂点取玩家胸口
     高度 — 方块侧 uniform 顶点衰减 + 实体侧 PointLight 同位 */
  if (playerGlowOn) {
    VOXEL_LIGHT.uGlowPos.value.set(pos.x, pos.y + 1.2, pos.z);
    playerGlowLight.position.set(pos.x, pos.y + 1.2, pos.z);
  }
}

/* 材质侧面: 网格生成已剔除实心邻面且法线一律朝外, 实心/TNT 几何的
   背面永远不可见 → FrontSide 让 GPU 在光栅化前丢弃背面三角形(省约
   一半填充率)。玻璃/水需从透明体内侧观看, 保留 DoubleSide。 */
const blockMat = new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.FrontSide});
const glassMat = new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide,
  transparent: true, opacity: 0.32, depthWrite: false});

/* TNT 贴图图集: 缓冲垫/顶/底/侧 四格竖排, 像素风。
   高度取 2 的幂(256): WebGL1 下 NPOT 纹理不能生成 mipmap; 第 0 格画满
   侧格底色, 远处 mipmap 混采样时贴图边界不串色。
   图集格数 TNT_TILES 已移 config.js — 单一来源, 本画布与网格化核心的
   UV 除数共读(Worker 侧 importScripts 同源取值) */
function makeTntTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64*TNT_TILES;
  const g = c.getContext('2d');
  const red = '#c33a24'; const dark = '#8f2313';
  const speckle = (x0, y0)=>{ // 红底像素噪点
    for (let i=0; i<90; i++) {
      g.fillStyle = Math.random()<0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.08)';
      g.fillRect(x0+Math.floor(Math.random()*64), y0+Math.floor(Math.random()*64), 2, 2);
    }
  };
  // 第一格: 顶面 (红底 + 深红边框 + 中心引信孔)
  g.fillStyle = red; g.fillRect(0, 0, 64, 64);
  speckle(0, 0);
  g.fillStyle = dark;
  g.fillRect(0, 0, 64, 4); g.fillRect(0, 60, 64, 4); g.fillRect(0, 0, 4, 64); g.fillRect(60, 0, 4, 64);
  g.fillStyle = '#5b1508'; g.fillRect(24, 24, 16, 16);
  g.fillStyle = '#e8c07a'; g.fillRect(28, 28, 8, 8);
  // 第二格: 底面 (深红)
  g.fillStyle = dark; g.fillRect(0, 64, 64, 64);
  g.fillStyle = '#7a1d0f'; g.fillRect(6, 70, 52, 52);
  // 第三格: 侧面 (红底 + 白带 + 黑字 TNT)
  g.fillStyle = red; g.fillRect(0, 128, 64, 64);
  speckle(0, 128);
  g.fillStyle = dark;
  g.fillRect(0, 128, 64, 4); g.fillRect(0, 188, 64, 4);
  g.fillStyle = '#efe7dc'; g.fillRect(4, 148, 56, 24);
  g.fillStyle = '#111';
  g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('TNT', 32, 161);
  // 第 0 号格(末格): mipmap 缓冲垫, 画满侧格底色防远处混色
  g.fillStyle = red; g.fillRect(0, 64*(TNT_TILES-1), 64, 64); const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; // 近处保持像素颗粒
  tex.minFilter = THREE.NearestMipmapLinearFilter; // 远处走 mipmap, 消高频闪烁
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
const tntMat = new THREE.MeshLambertMaterial({map: makeTntTexture(), side: THREE.FrontSide});

/* 方块贴图图集 (js/texture-atlas.js): 像素在纯数据缓冲里确定性生成,
   此处只做画布壳 + CanvasTexture 包装(与 TNT 图集同款管线/滤波口径)。
   alphaTest 裁切让植物十字面片与树叶孔洞呈镂空观感(不透明像素照常
   渲染, 无透明排序负担); 256×256 正方形 2 的幂, WebGL1 mipmap 合法。
   typeof 防御与下方 ringCenter 的 Tank 同款: texture-atlas.js 的 script
   行由集成者加入 index.html, 并入前 boot 冒烟不炸(缺图集 → 纯色兜底)。 */
const ATLAS_LAYOUT = (typeof TextureAtlas !== 'undefined') ? TextureAtlas.layout : null;
function makeAtlasTexture() {
  const tex = new THREE.CanvasTexture(TextureAtlas.makeCanvas(document));
  tex.magFilter = THREE.NearestFilter; // 近处保持像素颗粒
  tex.minFilter = THREE.NearestMipmapLinearFilter; // 远处走 mipmap, 消高频闪烁
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
const atlasMat = new THREE.MeshLambertMaterial({map: ATLAS_LAYOUT ? makeAtlasTexture() : null,
  alphaTest: 0.5, side: THREE.FrontSide});

/* ---------- 顶点光烘焙材质注入 (昼夜 D3, 设计稿 mc-daylight-torch §4.2) ----------
   四材质(blockMat/atlasMat/tntMat/glassMat)统一 onBeforeCompile 注入:
   顶点属性 aSky/aBlock(mesh-core 每顶点产出, 值=等级/15) + 共享 uniforms
   uDim(当前 skyDim)/uTorch(火把暖色)/uSkyFloor(天空下限)/uGlowPos·uGlowR(灯笼)。
   光照替换 r128 Lambert 的 #include <lights_lambert_vertex>: 块几何不再消费
   场景灯(实体/怪/Avatar/掉落物仍走 ambient/sun, §4.3), 改两通道叠加
     outgoing = albedo × ( skyTint·bright(max(aSky·15 − uDim, uSkyFloor))
                          + uTorch · bright(aBlock·15 + glowTerm) )
   skyTint 由 uDim 派生(幅度与 daylight-core TINT_DROP 单源), bright(x) =
   FLOOR+SPAN·pow(x/15,POW)(= renderBright, 常数经 DAYLIGHT.BRIGHT 单源); ×PI 抵消片元侧
   BRDF_Diffuse_Lambert 的 RECIPROCAL_PI。uniform 对象四材质共享同一份引用
   — 每帧只写 value, 已编译的全部程序同时生效。
   回退: 目标 three 版本 chunk 改名(r155+ Lambert 改逐片元)找不到替换点时
   保持 stock 着色器不注入(不炸优先)。全局夜暗由 applyDaylight 对 ambient/
   sun 的同曲线衰减兜底 — 不再叠"uDim 乘 vertexColor"(场景灯已按同一曲线
   变暗, 顶点色再乘会双重变暗过黑; 对规格回退条目的字面偏离, 见差异登记) */
const LIGHT_CHUNK = '#include <lights_lambert_vertex>';
/* 单源(昼夜评审修复): 注入 GLSL 的 voxBright 多项式与夜色染色常数不手抄 —
   由 daylight-core 的 DAYLIGHT 常数模板插值同一份, 重调曲线只改 daylight-core
   一处(模板在加载期求值 → 本文件加载须晚于 daylight-core, 与 index.html 序一致)。
   glF: 整值常数补成 float 字面量(GLSL ES 的 int/float 不混算, 防未来取整常数编译炸) */
const glF = (x)=>Number.isInteger(x) ? x + '.0' : String(x);
const VOXEL_GLSL_HEAD = `
/* === 顶点光烘焙注入(D3) === */
attribute float aSky;
attribute float aBlock;
uniform float uDim;
uniform vec3 uTorch;
uniform float uSkyFloor;
uniform vec3 uGlowPos;
uniform float uGlowR;
float voxBright( float x )
{ return ${glF(DAYLIGHT.BRIGHT.FLOOR)} + ${glF(DAYLIGHT.BRIGHT.SPAN)}
    * pow( max( x, 0.0 ) / 15.0, ${glF(DAYLIGHT.BRIGHT.POW)} ); }
`;
const VOXEL_GLSL_BODY = `
{ /* === 顶点光烘焙注入(D3): 两通道叠加, 替换 lights_lambert_vertex === */
  float glowTerm = ( uGlowR > 0.001 ) ?
      max( 0.0, 1.0 - distance( position, uGlowPos ) / uGlowR ) * 9.0 : 0.0; /* 灯笼(§8.3): 半径 6·等效 9 级 */
  float dimK = uDim / 11.0;
  vec3 skyTint = vec3( 1.0 - ${glF(DAYLIGHT.TINT_DROP[0])} * dimK,
      1.0 - ${glF(DAYLIGHT.TINT_DROP[1])} * dimK, 1.0 ); /* daylight-core skyTint 同源(月光偏蓝) */
  vLightFront = PI * ( skyTint * voxBright( max( aSky * 15.0 - uDim, uSkyFloor ) )
      + uTorch * voxBright( aBlock * 15.0 + glowTerm ) );
  vIndirectFront = vec3( 0.0 );
  #ifdef DOUBLE_SIDED
    vLightBack = vLightFront;
    vIndirectBack = vec3( 0.0 );
  #endif
}
`;
/* 四材质共享的一份 uniform(单一更新点; 初始=白天全亮口径, 非 dayCycle 模式零感受) */
const VOXEL_LIGHT = {
  uDim: {value: 0},
  uTorch: {value: new THREE.Vector3(1.0, 0.60, 0.37)}, /* 火把暖色 ≈ #f39a5e(§4.2) */
  uSkyFloor: {value: 15},
  uGlowPos: {value: new THREE.Vector3(0, -1024, 0)}, /* 停机位: 远离地面, uGlowR=0 时光项恒 0 */
  uGlowR: {value: 0},
};
function injectVoxelLight(mat) {
  mat.onBeforeCompile = (shader)=>{
    if (shader.vertexShader.indexOf(LIGHT_CHUNK) === -1) return; /* 回退: stock 着色器 */
    Object.assign(shader.uniforms, VOXEL_LIGHT);
    shader.vertexShader = VOXEL_GLSL_HEAD + shader.vertexShader.replace(LIGHT_CHUNK, VOXEL_GLSL_BODY);
  };
}
injectVoxelLight(blockMat);
injectVoxelLight(glassMat);
injectVoxelLight(tntMat);
injectVoxelLight(atlasMat);

/* 玩家随身光机制缝(§8.3, 政策"何时亮"归模式层 D7 灯笼): setPlayerGlow 只开关
   机制 — 方块侧=uGlowPos/uGlowR 顶点衰减项(上方注入), 实体侧=PointLight
   (#f39a5e·1.1·距离 7)同步照亮怪/Avatar。PointLight 惰性创建、常驻隐藏;
   每帧位置跟随收在 applyDaylight 的逐帧段(其唯一消费方探险必开 dayCycle) */
let playerGlowOn = false;
let playerGlowLight = null;
function setPlayerGlow(on) {
  playerGlowOn = on;
  VOXEL_LIGHT.uGlowR.value = on ? 6 : 0; /* 半径 6 · 等效 9 级(§8.3) */
  if (on) {
    if (!playerGlowLight) {
      playerGlowLight = new THREE.PointLight(0xf39a5e, 1.1, 7);
      scene.add(playerGlowLight);
    }
    playerGlowLight.visible = true;
    /* 即刻挂到玩家胸口(挂点口径与 applyDaylight 逐帧段同一处), 免首帧在原点 */
    VOXEL_LIGHT.uGlowPos.value.set(pos.x, pos.y + 1.2, pos.z);
    playerGlowLight.position.set(pos.x, pos.y + 1.2, pos.z);
  } else if (playerGlowLight) {
    playerGlowLight.visible = false;
  }
}

/* ---------- 区块网格装配 (纯几何在 MeshCore, 此处只做 THREE 装配与场景挂载) ----------
   四通道: solid(不透明)/glass(玻璃)/tnt(TNT贴图)/atlas(方块图集); LOD 通道单网格。
   几何生成走 js/mesh-core.js 纯核心 — 同一份代码在主线程(同步兜底)与
   js/mesh-worker.js(http 服务主路径)里运行, 输出裸数组经 makeGeo 装配。 */
const chunkMeshes = new Map(); // 全细节: key → [Mesh...]
const lodMeshes = new Map(); // LOD 粗网格: key → Mesh
function chunkKey(cx, cz) {
  return cx+','+cz;
}

const makeGeo = (b)=>{
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  g.setAttribute('aSky', new THREE.Float32BufferAttribute(b.sky, 1)); /* 顶点光(D3): 每顶点等级/15 */
  g.setAttribute('aBlock', new THREE.Float32BufferAttribute(b.block, 1));
  // 显式包装: Worker 回传的 Uint32Array 不是 BufferAttribute, setIndex 直接塞会炸渲染
  g.setIndex(new THREE.Uint32BufferAttribute(b.indices, 1));
  return g;
};
const makeTexGeo = (b)=>{
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
  g.setAttribute('aSky', new THREE.Float32BufferAttribute(b.sky, 1)); /* 顶点光(D3): 同步主线程/Worker 两路径 */
  g.setAttribute('aBlock', new THREE.Float32BufferAttribute(b.block, 1));
  g.setIndex(new THREE.Uint32BufferAttribute(b.indices, 1));
  return g;
};
const addSceneMesh = (geo, mat)=>{
  const m = new THREE.Mesh(geo, mat);
  scene.add(m);
  return m;
};

/* 全细节上挂: 替换该区块全部既有网格(先统一释放再重建)。
   空结果也记账(空数组) — "已服务但无网格"与"未服务"必须可区分, 否则距离环
   会把空气区块当缺口无限重排(测试 test/world-rings.test.js 锁定此行为) */
function mountChunk(cx, cz, r) {
  const k = chunkKey(cx, cz);
  unloadChunk(k);
  const arr = [];
  if (r.solid) arr.push(addSceneMesh(makeGeo(r.solid), blockMat));
  if (r.glass) arr.push(addSceneMesh(makeGeo(r.glass), glassMat));
  if (r.tnt) arr.push(addSceneMesh(makeTexGeo(r.tnt), tntMat));
  if (r.atlas) arr.push(addSceneMesh(makeTexGeo(r.atlas), atlasMat)); // 方块图集通道
  chunkMeshes.set(k, arr); // 空区块记空数组: 环状态机的"已服务"凭据
}
/* LOD 上挂: 顶替全细节(降采样网格成本 ~1/step², 远景视觉等价 — 雾中不可辨) */
function mountChunkLod(cx, cz, r) {
  const k = chunkKey(cx, cz);
  unloadChunk(k);
  lodMeshes.set(k, r && r.solid ? addSceneMesh(makeGeo(r.solid), blockMat) : null); // null=已服务无网格(空气区块)
}

/* 区块三通道网格的统一释放(重建替换与清场共用一条规则) */
function disposeChunkArr(arr) {
  arr.forEach((m)=>{
    scene.remove(m); m.geometry.dispose();
  });
}

/* 一个区块的完整卸载(全细节 + LOD, 含空记账条目) — 上挂替换/环维护/清场的
   唯一释放入口, 两个 Map 的键必须同进同退(残留会挡住环重建) */
function unloadChunk(k) {
  const f = chunkMeshes.get(k);
  if (f) disposeChunkArr(f);
  chunkMeshes.delete(k);
  const l = lodMeshes.get(k);
  if (l) disposeChunkArr([l]);
  lodMeshes.delete(k);
}

/* ---------- 距离环 · 近实远虚 (调研与参数语义: docs/chunk-streaming-lod-research.md §7) ----------
   玩家(或驾驶中的坦克)为环心: ≤fullChunks 全细节实时构建 · 到 lodChunks
   降采样粗网格(成本 ~1/lodStep²) · 更远卸载(GPU 释放, 数据保留, 走近重建)。
   环切换在消费端(pump 出队时按当前距离决定形态), 入队侧只登记缺口 —
   队列条目不会因走远而失效(出队时按 'none' 惰性丢弃)。 */
function ringCenter() {
  if (typeof Tank === 'object' && Tank.driving && Tank.driving()) {
    const t = Tank.at(); // 驾驶中: 坦克是环心
    return {x: t.x, z: t.z};
  }
  return {x: pos.x, z: pos.z};
}
function chunkDist(cx, cz) { // 区块中心到环心的距离(区块单位)
  const c = ringCenter();
  return Math.hypot(cx + 0.5 - c.x/CHUNK, cz + 0.5 - c.z/CHUNK);
}
function desiredState(cx, cz) {
  const d = chunkDist(cx, cz);
  if (d <= VIEW.fullChunks) return 'full';
  if (d <= VIEW.lodChunks) return 'lod';
  return 'none';
}

/* ---------- 网格 Worker (http 服务主路径; file:// 直开自动降级同步构建) ----------
   同源 http 下 Worker 规范保证合法(MDN Worker: same-origin); file:// 下
   构造抛错 → try/catch 兜底走同步路径(同一队列, 只是消费者不同)。
   协议: 请求 {gen,cx,cz,token,kind,cells(ArrayBuffer 转移),sky·block(光照圈 D3 同款转移),pack 元数据} →
   响应 {gen,cx,cz,token,kind,res}。gen=清场次号(旧响应整体作废);
   token=同区块递增(在途期间再入队, 旧响应丢弃)。 */
let meshWorker = null;
let workerTried = false;
let meshGen = 0;
const inFlight = new Map(); // key → {token, gen}
const meshToken = new Map(); // key → 最新 token

function ensureWorker() {
  if (workerTried) return;
  workerTried = true;
  try {
    meshWorker = new Worker('js/mesh-worker.js');
    meshWorker.onmessage = (e)=>{
      const m = e.data;
      if (m.gen !== meshGen) return; // 清场后的旧响应: 整体作废
      const k = chunkKey(m.cx, m.cz);
      const fl = inFlight.get(k);
      if (!fl || fl.token !== m.token) return; // 已被更新的请求取代
      inFlight.delete(k);
      if (m.kind === 'full') mountChunk(m.cx, m.cz, m.res);
      else mountChunkLod(m.cx, m.cz, m.res);
    };
    meshWorker.onerror = ()=>{ // 加载失败等: 回落同步, 在途区块回队
      meshWorker = null;
      for (const k of inFlight.keys()) {
        if (!remeshQueued.has(k)) {
          remeshQueued.add(k); remeshQueue.push(k);
        }
      }
      inFlight.clear();
    };
  } catch (e) {
    meshWorker = null;
  } // file://: SecurityError / 测试桩: ReferenceError → 同步兜底
}

/* 消费一个区块 key: 按当前环形态走 Worker 或同步构建。
   kind→构建参数的映射与 js/mesh-worker.js 的 onmessage 各持一份(跨线程
   无法共享函数), 改协议须两边同步改 — test/mesh-worker.test.js 锁协议 */
/* 全细节 opts: hashRand 来自 voxel.js, 图集布局来自 texture-atlas.js — 均单一来源 */
const MESH_OPTS = {hashRand, tntTiles: TNT_TILES, atlas: ATLAS_LAYOUT};
function serveChunkKey(k) {
  const c = k.split(','); const cx = +c[0]; const cz = +c[1];
  if (cx<0||cz<0||cx>=NCX||cz>=NCZ) return false;
  const st = desiredState(cx, cz);
  if (st === 'none') return false; // 走远了: 惰性丢弃
  ensureWorker();
  if (meshWorker) {
    const pack = packChunkData(cx, cz, st === 'full' ? 1 : 0);
    const token = (meshToken.get(k) || 0) + 1;
    meshToken.set(k, token);
    inFlight.set(k, {token, gen: meshGen});
    meshWorker.postMessage(
        {gen: meshGen, cx, cz, token, kind: st, cells: pack.cells.buffer,
          sky: pack.sky.buffer, block: pack.block.buffer, /* 光照圈(D3, §3.4): 与 cells 同形, 布局即契约 */
          levels: pack.levels.buffer, /* 水位通道(liquid D7): 与 cells 同形 */
          w: pack.w, d: pack.d, h: pack.h, border: pack.border, bx: pack.bx, bz: pack.bz, yMax: pack.yMax},
        [pack.cells.buffer, pack.sky.buffer, pack.block.buffer, pack.levels.buffer]); // transferable: 所有权零拷贝转移
  } else if (st === 'full') {
    mountChunk(cx, cz, MeshCore.meshChunk(packChunkData(cx, cz, 1), MESH_OPTS));
  } else {
    mountChunkLod(cx, cz, MeshCore.meshChunkLod(packChunkData(cx, cz, 0), {step: VIEW.lodStep}));
  }
  return true;
}

/* 环维护: 卸载远区块 · 登记形态缺口/需切换的区块(近处优先)。
   环心跨界才全扫 — 同区块内的小位移不重算(消除 fullChunks 边界上的
   形态抖动, 也免大地图每帧全扫); 清场后由 rebuildAll 全量入队兜底 */
const ringQueue = []; // 距离环填充队列(已按距离排序)
const ringQueued = new Set();
let ringCcx = -1e9; let ringCcz = -1e9; // 上次全扫的环心区块
function maintainRings() {
  const c = ringCenter();
  const ncx = Math.floor(c.x/CHUNK); const ncz = Math.floor(c.z/CHUNK);
  if (ncx === ringCcx && ncz === ringCcz) return; // 未跨界: 环状态不变
  ringCcx = ncx; ringCcz = ncz;
  for (let cx=0; cx<NCX; cx++) {
    for (let cz=0; cz<NCZ; cz++) {
      const k = chunkKey(cx, cz);
      const d = chunkDist(cx, cz);
      if (d > VIEW.lodChunks) { // 卸载环: GPU 释放, 数据保留
        unloadChunk(k);
        continue;
      }
      const wantFull = d <= VIEW.fullChunks;
      const hasFull = chunkMeshes.has(k); const hasLod = lodMeshes.has(k);
      if (wantFull ? hasFull : hasLod) continue; // 已是目标形态
      if (ringQueued.has(k) || remeshQueued.has(k) || inFlight.has(k)) continue;
      ringQueued.add(k);
      ringQueue.push({k, d});
    }
  }
  ringQueue.sort((a, b)=>a.d-b.d); // 近处优先(≤ 数百项, 每帧排序无感)
}

/* 收尾纪律的渐进版: 全部区块入环队列(近处优先), 由 pump 每帧按预算构建 —
   进场先见脚下, 远景数帧内铺满; 建场不再一次性顶爆帧预算 */
function rebuildAll() {
  const all = [];
  for (let cx=0; cx<NCX; cx++) {
    for (let cz=0; cz<NCZ; cz++) {
      all.push({k: chunkKey(cx, cz), d: chunkDist(cx, cz)});
    }
  }
  all.sort((a, b)=>a.d-b.d);
  for (const it of all) {
    if (!ringQueued.has(it.k)) {
      ringQueued.add(it.k); ringQueue.push(it);
    }
  }
}

/* 场景装填 seam: 清场 → 批量建 → 流体激活 → 光场全量 → 收尾入队, 一步到位。
   "建完必须 rebuildAll 否则整场不可见"的收尾纪律收在此处, 调用方
   不可能忘(曾有模式建场漏调收尾, 进场一片天蓝 — ca3ac43)。
   流体激活在建场后、光场前(共识 Q4a): 重放账本恢复的水位先结算到不动点
   (混合产物/干涸会改方块), 光场全量再对终态一次算清 — 两层派生面的顺序
   即依存关系(光照是方块场的派生, 方块场又含流体的伴生写入)。
   光场全量计算(设计稿 §3.3): 装场必算 — 光照永远是方块场的纯派生
   (差异 #14 不落盘), buildFn 建完地形一次写满 sky/block 两通道
   (方块光源(火把/灯块/发光岩/岩浆, D4 光源表)与天空通道一并生成),
   buildFn 内的写入(地形/存档重放/装场清扫)不必管光 — 全量在最后兜底。
   clearWorld 幂等(switchMode 已清过再清无害)。 */
function loadScene(buildFn) {
  clearWorld();
  buildFn();
  activateFluids();
  LightCore.computeAll(getBlock, WORLD_W, WORLD_D, WORLD_H, LIGHT_POLICY, lightSky, lightBlock);
  rebuildAll();
}

/* 单块编辑: 挖除出同色碎屑是默认反馈; 调用方要静默挖除(如模式自己的
   定制反馈)传 opt {debris:false}。反馈政策可关, 缺省保持原行为。
   返回方块级联清单 [{x,y,z,id}... | {x,y,z,id,to:{x,y,z}}...]——破坏(id→0)
   全旗标触发; 放置仅 fall 旗标触发(P9 半空即落), 其余放置返回 []。
   带 to 的条目是移动(方块存活, 消费方记账两格), 引擎只报事件,
   掉落/记账/话术是模式政策(方块级联设计稿 D3/D4/D7)。
   既有调用方忽略返回值则行为不变(级联自动生效), 向后兼容 */
function editBlock(x, y, z, id, opt) {
  const old = getBlock(x, y, z);
  setBlockLit(x, y, z, id); /* 写格连带双通道光场增量(昼夜 §3.3, 级联结算前光先就绪) */
  setFluidLv(x, y, z, 0); // 编辑入口水位纪律(liquid D2: 放置流体=源 lv0, 其余写格清水位)
  let removed = [];
  if (id === 0 && old !== 0) {
    if (!(opt && opt.debris === false)) { // 挖除反馈: 同色碎屑(唯一入口经 Fx, 见 GLOSSARY)
      Fx.debrisBurst(x+0.5, y+0.5, z+0.5, 6, {color: packColor(old), life: 0.7});
    }
    removed = applyCascade(x, y, z, old);
    if (removed.length && !(opt && opt.debris === false)) {
      cascadeDebris(removed);
      cascadeVisuais(removed); /* 落沙/倒树原木 tumble(纯 overlay, D7/D8) */
    }
  } else if (id !== 0) {
    /* 放置触发仅 fall 旗标(P9); 原木/树叶/thin 放置零触发(建造装饰保护) */
    removed = CascadeCore.cascadePlace(getBlock, setBlockLit, x, y, z, id, CASCADE_POLICY);
    if (removed.length && !(opt && opt.debris === false)) cascadeVisuais(removed);
  }
  FLUID_SIM.notifyEdit(x, y, z); // 流体挂点: 邻接排程(与方块级联同一触发面, liquid D5)
  markDirty(x, z); // 单块编辑与批量同走队列(连续挖掘同样摊平)
  flushDirty();
  return removed;
}

/* ---------- 方块级联(编辑后世界自洽, docs/block-lifecycle-design.md) ----------
   机制在 cascade-core(纯核心), 身份旗标在 config BLOCKS(D1), 这里只做装配:
   破坏结算后按身份连锁(原木组件接地砍倒/树叶失依而落/依附块随底座脱落)。
   全模式破坏路径都收敛在 editBlock / editBlockDirty 两入口(设计稿 D3 已
   逐一核实: 探险挖掘·探险 TNT·建造·竞技场→editBlock, 坦克炮击→editBlockDirty);
   新的破坏路径必须走这两入口——绕过=世界不变量破洞(world-integrity 兜底)。 */
const CASCADE_POLICY = CascadeCore.mkPolicy(BLOCKS);
/* 光照政策(BLOCKS 派生, 装配一次 — LightCore.mkPolicy 与单测共用同一装配
   防两份漂移, CASCADE_POLICY 同款缝制): lightOf 读 light 字段(火把 14/
   灯块·发光岩·岩浆 15, config 光源表), opaque 镜像 isOpaque */
const LIGHT_POLICY = LightCore.mkPolicy(BLOCKS);
/* ---------- 编辑期光照增量(设计稿 §3.3, D4): 唯一编辑 choke point 的光场缝制 ----------
   setBlockLit = setBlockRaw + LightCore.updateEdit: 写格(setBlockRaw 之后、
   applyCascade 之前)即增量更新双通道光场, 返回脏格包围盒 → 覆盖区块与既有
   编辑同一 dirtyChunks 队列(pumpRemesh 同一消费, 编辑优先于距离环的既有
   纪律自然生效)。级联连带: cascadeRemove/cascadePlace/cascadeSweep 的级联
   条目不回环 editBlock, 而是经 write 回调直写 setBlockRaw —— 把本包装作为
   write 传入即全覆盖(移动条目落点的旧值在写入前读得, 逐条目事后补账拿
   不到); 火把失撑脱落撤光、落沙沉底遮光由此白送。装场期(buildFn 内, 全量
   computeAll 之前)同走本包装无害: 干净世界清扫零写入, 脏档多付的区域重算
   随全量覆盖 —— 光场恒为方块场的纯派生(差异 #14)。 */
function setBlockLit(x, y, z, id) {
  const old = getBlock(x, y, z);
  setBlockRaw(x, y, z, id);
  if (old === id) return; /* 方块场无变化 → 光场不动(省一次区域重算) */
  const box = LightCore.updateEdit(getBlock, WORLD_W, WORLD_D, WORLD_H, LIGHT_POLICY,
      x, y, z, old, lightSky, lightBlock);
  if (box) markLightDirty(box);
}
/* 光照脏格包围盒 → 覆盖区块记脏: 光传播半径至多 14(15 级逐格衰减), ±1
   边界圈对齐 markDirty 的跨区块剔面口径(packChunkData 含邻块边界圈) */
function markLightDirty(b) {
  const cx0 = Math.floor((b.x0 - 1) / CHUNK); const cx1 = Math.floor((b.x1 + 1) / CHUNK);
  const cz0 = Math.floor((b.z0 - 1) / CHUNK); const cz1 = Math.floor((b.z1 + 1) / CHUNK);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) dirtyChunks.add(chunkKey(cx, cz));
  }
}
function applyCascade(x, y, z, oldId) {
  if (oldId === 0) return [];
  const removed = CascadeCore.cascadeRemove(getBlock, setBlockLit, x, y, z, oldId, CASCADE_POLICY);
  for (const r of removed) markDirty(r.x, r.z); // 级联块各自区块入脏(同区块多块由 Set 去重)
  return removed;
}
/* 世界卫生清扫(P14, 设计稿 D9): 全图不变量违例一次治愈——装场期迁移 seam
   (探险 init 在确定性重建 + edits 重放后调; 建造不调, 装饰保护口径不变)。
   结算在级联核心, 这里同 applyCascade 装配 + 脏记账(网格未建时记账无害,
   rebuildAll/pumpRemesh 兜底重建); 返回清单契约与 editBlock 相同(移动条目
   带 to)。本入口不是运行期破坏路径——玩家破坏仍必须走 editBlock/editBlockDirty
   两入口(D3 纪律不变)。 */
function applySweep() {
  const removed = CascadeCore.cascadeSweep(getBlock, setBlockLit, CASCADE_POLICY,
      WORLD_W, WORLD_H, WORLD_D);
  for (const r of removed) {
    markDirty(r.x, r.z);
    if (r.to) markDirty(r.to.x, r.to.z); // 移动条目两格可能跨区块
  }
  return removed;
}
/* 方块顶面色 → Fx 用 0xRRGGBB(碎屑/落块共用; 方块注册表单一来源) */
function packColor(id) {
  const c = faceColor(id, [0, 1, 0]);
  return (Math.round(c[0]*255)<<16) | (Math.round(c[1]*255)<<8) | Math.round(c[2]*255);
}
/* 级联碎屑: 同 id 聚一撮取质心, 一次加量(单棵树至多两三撮, 上限 24 粒/撮);
   移动条目(带 to)不碎——方块存活, 观感归 cascadeVisuais 的落块 */
function cascadeDebris(removed) {
  const groups = new Map();
  for (const r of removed) {
    if (r.to) continue;
    if (!groups.has(r.id)) groups.set(r.id, []);
    groups.get(r.id).push(r);
  }
  for (const [gid, rs] of groups) {
    let gx = 0; let gy = 0; let gz = 0;
    for (const r of rs) {
      gx += r.x + 0.5; gy += r.y + 0.5; gz += r.z + 0.5;
    }
    Fx.debrisBurst(gx / rs.length, gy / rs.length, gz / rs.length, Math.min(rs.length * 2, 24), {
      color: packColor(gid), life: 0.7});
  }
}
/* 级联落块观感(D7/D8, 纯 overlay——数据已即时结算, 动画不承载语义):
   移动条目(带 to)=色块自原位坠到落位; fell 条目=倒树原木逐节 tumble 到
   地形顶(groundTop 之后即树倒后的地表, 60ms/节阶梯)。上限 24 块超出静默 */
function cascadeVisuais(removed) {
  let n = 0; let log = 0;
  for (const r of removed) {
    if (r.to) {
      if (n++ < 24) Fx.fallBlock(r.x + 0.5, r.y + 0.5, r.to.y + 0.5, r.z + 0.5, {color: packColor(r.id)});
    } else if (BLOCKS[r.id] && BLOCKS[r.id].fell) {
      const gy = groundTop(r.x, r.z) + 1.5;
      if (r.y + 0.5 > gy && n++ < 24) {
        Fx.fallBlock(r.x + 0.5, r.y + 0.5, gy, r.z + 0.5, {color: packColor(r.id), delay: 0.06 * log++});
      }
    }
  }
}

/* ---------- 流体装配(docs/liquid-design.md D5, 机制在 fluid-core 纯核心) ----------
   与方块级联同一挂点哲学: 机制在核心, 身份旗标在 config BLOCKS(fluid 字段),
   这里只做装配——sim 实例 + 编辑挂点 + 每帧计划刻泵 + 装场全场激活 + 事件分发。
   流体写格统一走 fluidWrite(id+水位双写 + 脏区块记账 + 模式账本缝),
   掉落(冲毁 thin)与音效(混合嘶嘶)是引擎内消费, 任务计数/话术不经过这里。 */
const FLUID_POLICY = FluidCore.mkPolicy(BLOCKS);
let fluidEditSink = null; // 流体写格 → 模式 edits 账本(探险/建造 init 注册, Tank 钩子先例)
function setFluidEditSink(fn) {
  fluidEditSink = fn;
}
const fluidWrite = (x, y, z, id, lv) => {
  const lv2 = FLUID_POLICY.kindOf(id) ? lv : 0; // 非流体格水位纪律(ADR 0004)
  setBlockLit(x, y, z, id); /* 写格连带光场增量(昼夜 §3.3): 混合产物/干涸改透光性 */
  setFluidLv(x, y, z, lv2);
  markDirty(x, z);
  if (fluidEditSink) fluidEditSink(x, y, z, id, lv2);
};
const FLUID_SIM = FluidCore.mkSim({
  read: getBlock, write: fluidWrite, readLv: getFluidLv, policy: FLUID_POLICY, params: FLUIDS,
  ids: {water: B_WATER, lava: B_LAVA}, mixIds: {obsidian: B_OBSIDIAN, cobble: 4, stone: 3},
  w: WORLD_W, h: WORLD_H, d: WORLD_D,
});
/* 事件分发: mix=水岩混合(嘶嘶+产物碎屑) · wash=冲毁依附块(掉落物照发, 儿童拾取乐趣) */
function handleFluidEvents(evs) {
  for (const ev of evs) {
    if (ev.type === 'mix') {
      sfx('lava_hiss');
      Fx.debrisBurst(ev.x + 0.5, ev.y + 0.5, ev.z + 0.5, 4, {color: packColor(ev.to), life: 0.5});
    } else if (ev.type === 'wash') {
      const def = BLOCKS[ev.id];
      if (def) {
        const drops = rollBlockDrop(def);
        for (const d of drops) Drops.spawn(d.id, d.n, ev.x + 0.5, ev.y + 0.5, ev.z + 0.5);
      }
    }
  }
}
/* 每帧计划刻泵(主循环调用): dt 累积成 20tps 游戏刻, 每刻步进 FLUID.budgetCells 格,
   空队列零成本; 一帧至多追 8 刻(掉帧防螺旋)。传播速率=MC 口径(水 0.25s/格) */
let fluidAcc = 0;
let fluidTick = 0;
function pumpFluids(dt) {
  fluidAcc += dt;
  const stepLen = 1 / FLUID.tickHz;
  let guard = 8;
  while (fluidAcc >= stepLen && guard-- > 0) {
    fluidAcc -= stepLen;
    fluidTick++;
    if (FLUID_SIM.pending()) handleFluidEvents(FLUID_SIM.step(fluidTick, FLUID.budgetCells));
  }
}
/* 装场全场激活(共识 Q4a): 全部流体格入列并同步结算到不动点——进场即终态,
   零流动噪声; 既有场景是稳定源阵, 实测 no-op。迭代上限 2000 刻(等价 100s
   传播, 远超全图任何可达路径), 超限余量留给运行时泵继续(优雅降级不丢) */
function activateFluids() {
  FLUID_SIM.activate(WORLD_W, WORLD_H, WORLD_D);
  for (let t = 1; t <= 2000 && FLUID_SIM.pending(); t++) {
    handleFluidEvents(FLUID_SIM.step(t, FLUID.settleCap));
  }
}

/* ---------- 编辑管线: 单块/批量统一走重建队列 ----------
   重建一个 16×16×48 区块在移动端要数毫秒, 爆炸(1~4 区块)或连续挖掘
   同帧全量重建会顶爆帧预算(pad 真机开炮顿挫的主因) → 统一入队,
   主循环每帧按预算出队(视觉滞后 ≤2 帧 ≈ 33ms, 不可感知)。 */
const dirtyChunks = new Set(); // 本批已记账、尚未入队的区块
const remeshQueue = []; // 重建队列(FIFO)
const remeshQueued = new Set(); // 在队去重(同区块多次标记只排一次)
function markDirty(x, z) {
  const cx=Math.floor(x/CHUNK); const cz=Math.floor(z/CHUNK);
  dirtyChunks.add(chunkKey(cx, cz));
  if (x % CHUNK === 0) dirtyChunks.add(chunkKey(cx-1, cz));
  if (x % CHUNK === CHUNK-1) dirtyChunks.add(chunkKey(cx+1, cz));
  if (z % CHUNK === 0) dirtyChunks.add(chunkKey(cx, cz-1));
  if (z % CHUNK === CHUNK-1) dirtyChunks.add(chunkKey(cx, cz+1));
}
function editBlockDirty(x, y, z, id) {
  const old = getBlock(x, y, z);
  setBlockLit(x, y, z, id); /* 写格连带双通道光场增量(昼夜 §3.3) */
  setFluidLv(x, y, z, 0); // 编辑入口水位纪律(与 editBlock 同款)
  let removed = [];
  if (id === 0 && old !== 0) {
    removed = applyCascade(x, y, z, old);
  } else if (id !== 0) {
    removed = CascadeCore.cascadePlace(getBlock, setBlockLit, x, y, z, id, CASCADE_POLICY);
  }
  FLUID_SIM.notifyEdit(x, y, z); // 流体挂点(批量链注入此入口, 级联已生效同拍)
  markDirty(x, z);
  return removed; // 坦克批量链注入此入口: 级联已生效(炸林区整树倒), 返回值按需消费; 批量路径不放动画(自带爆风观感)
}
function flushDirty() { // 记账收口: 脏区块转入重建队列
  for (const k of dirtyChunks) {
    if (!remeshQueued.has(k)) {
      remeshQueued.add(k); remeshQueue.push(k);
    }
  }
  dirtyChunks.clear();
}
function pumpRemesh(n) { // 每帧出队(主循环每帧调用; 同步预算 n, Worker 派发上限 VIEW.dispatch)
  flushDirty(); // 自动收口: 漏调 flushDirty 的脏区块最迟本帧入队(不再永远不可见); 批量编辑后手动 flush 仍是可选的即时提交
  ensureWorker();
  maintainRings();
  /* 编辑优先(玩家正看着), 环填充其次; Worker 路径下"出队"只是打包+派发,
     帧成本极低 — 网格在后台算, 响应异步回来挂载(视觉滞后 ≤2 帧不变) */
  let budget = meshWorker ? VIEW.dispatch : n;
  while (budget > 0 && remeshQueue.length) {
    const k = remeshQueue.shift();
    remeshQueued.delete(k);
    if (serveChunkKey(k)) budget--;
  }
  while (budget > 0 && ringQueue.length) {
    const it = ringQueue.shift();
    ringQueued.delete(it.k);
    if (serveChunkKey(it.k)) budget--;
  }
}

/* 清空世界(切换模式/重置关卡用) */
function clearWorld() {
  world.clear();
  FLUID_SIM.reset(); // 流体队列与时间基归零(世界数据已清, 残留条目作废)
  meshGen++; // 在途 Worker 响应整体作废
  inFlight.clear();
  meshToken.clear();
  dirtyChunks.clear();
  remeshQueue.length = 0;
  remeshQueued.clear();
  ringQueue.length = 0;
  ringQueued.clear();
  ringCcx = ringCcz = -1e9; // 环缓存作废: 新世界的环维护必须重新全扫
  for (const k of chunkMeshes.keys()) unloadChunk(k);
  chunkMeshes.clear();
  lodMeshes.clear();
}

/* ---------- 水下/岩浆内雾色(liquid D10, 头部口径) ----------
   头没水 → 雾与天色切水下蓝(近距浓雾, 孩子读得出"我在水里"); 头入岩浆 →
   橙红浓雾; 出水复原。状态机三态防逐帧重设(仅切换时写) */
let fluidFogState = '';
function updateFluidFog() {
  const f = fluidAt(pos.x, pos.y + PLAYER.eye, pos.z);
  const want = f === 'water' ? 'water' : (f === 'lava' ? 'lava' : '');
  if (want === fluidFogState) return;
  fluidFogState = want;
  if (want === 'water') {
    scene.fog.color.setHex(0x1e4f92); scene.background.setHex(0x1e4f92);
    scene.fog.near = 1; scene.fog.far = 26;
  } else if (want === 'lava') {
    scene.fog.color.setHex(0x9c3a00); scene.background.setHex(0x9c3a00);
    scene.fog.near = 0.1; scene.fog.far = 4.5;
  } else {
    scene.fog.color.copy(sky); scene.background.copy(sky);
    scene.fog.near = VIEW.fogNear; scene.fog.far = VIEW.fogFar;
  }
}

/* ---------- 方块高亮 ---------- */
const hlGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
const hlEdges = new THREE.EdgesGeometry(hlGeo);
const highlight = new THREE.LineSegments(hlEdges,
    new THREE.LineBasicMaterial({color: 0x000000, transparent: true, opacity: 0.5}));
highlight.visible = false;
scene.add(highlight);
