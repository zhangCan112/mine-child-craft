'use strict';
/* ============================================================
   造型档案 (MobLookKit) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   怪物/人物「一怪一对象」的造型唯一权威: js/mob-look/<type>.js 每怪
   一文件 declare {base 基座骨, bones 追加骨, tex 自绘贴图, armStyle,
   weaponArm, debris, scale}(全部官方模型像素, 数据源与逐怪规格见
   docs/mc-mob-models-research.md — Mojang bedrock-samples 核对,
   版权口径 D13: 只取结构比例, 像素自绘)。本 kit 负责: 基座生成 →
   px 换算(怪物 z 镜像成 +Z 朝向 / 玩家 −Z 原生傀儡) → 六面 UV 铺展
   → 程序贴图(纯数据缓冲+种子化随机, 画布惰性, texture-atlas 同惯例)
   → 头像裁切(head 正面 16×16, 替代手绘 face) → 碎块色查询。
   UV 铺展约定(kit 自有口径, 非 MC 换皮兼容; 面均按「自立方体外部看」定向):
     front=[u+d,v+d,w,h](官方北面=脸) · back=[u+2d+w,v+d,w,h]
     left=[u,v+d,d,h] · right=[u+d+w,v+d,d,h] · top=[u+d,v,w,d] · bottom=[u+d+w,v,w,d]
   interface: declare / has / keys / rig / puppet / regions /
     textureBuffer / facePixels / debrisOf / PX
   依赖: 声明期零依赖(look 文件加载序任意, 需先于消费方 mobs/avatar);
     THREE/document 全惰性(几何/材质/傀儡期) — 引导桩与 Node 测试可安全加载
   可测性声明: 声明/基座/换算/UV/贴图缓冲/裁切全纯逻辑, 有单测
     (test/mob-look.test.js); 几何与傀儡的 THREE 段经 boot 冒烟覆盖
   ============================================================ */
const MobLookKit = (() => {
  const PX = 1 / 16; // 1 模型像素 = 1/16 格(官方口径)

  /* ---------- 声明注册表 ---------- */
  const looks = {};
  function declare(type, def) {
    looks[type] = def;
  }
  function has(type) {
    return !!looks[type];
  }
  function keys() {
    return Object.keys(looks);
  }

  /* ---------- 种子化伪随机(mulberry32, texture-atlas 同款) ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedOf(type) {
    let s = 7;
    for (let i = 0; i < type.length; i++) s = (s * 31 + type.charCodeAt(i)) | 0;
    return s >>> 0;
  }

  /* ---------- 画师: 纯数据 RGBA 缓冲, 零 DOM ----------
     g.fill(rect, c) 整区填色 · g.noise(rect, c, amp) 明暗噪底 ·
     g.px(x, y, c) 单像素 · g.mul(rect, f) 区内明暗乘 · g.rng 种子随机。
     rect = [u, v, w, h](贴图像素矩形, 一般取自 regions()); c = [r,g,b] 0..255 */
  function mkSheet(size, seed) {
    const buf = new Uint8ClampedArray(size * size * 4);
    const rng = mulberry32(seed);
    const put = (x, y, c) => {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const o = (y * size + x) * 4;
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255;
    };
    const each = (rect, fn) => {
      for (let y = 0; y < rect[3]; y++) {
        for (let x = 0; x < rect[2]; x++) fn(rect[0] + x, rect[1] + y);
      }
    };
    return {
      buf, rng,
      fill: (rect, c) => each(rect, (x, y) => put(x, y, c)),
      noise: (rect, c, amp) => each(rect, (x, y) => {
        const v = 1 + (rng() * 2 - 1) * amp;
        put(x, y, [c[0] * v, c[1] * v, c[2] * v]);
      }),
      mul: (rect, f) => each(rect, (x, y) => {
        const o = (y * size + x) * 4;
        if (buf[o + 3] === 0) return;
        buf[o] *= f; buf[o + 1] *= f; buf[o + 2] *= f;
      }),
      px: put,
    };
  }

  /* ---------- 基座: 官方像素骨架(研究笔记 §3/§4; 脸朝 −Z, origin=角点) ----------
     humanoid: 人形(玩家/僵尸系) — 玩家版 64×64 UV 布局(左右肢各有独立区,
     不用官方 mirror 共区——自绘贴图无需省位); 官方腿位 ±1.9 取整 ±2(0.2 缝贴地无感);
     headW 参数 = 头半宽覆写(猪灵官方宽头 10×8×8 → 5)
     skeleton: 细骨(骷髅系) — 同布局, 四肢 2×12×2
     illager: 灾厄村民(卫道士系) — 头 8×10×8+鼻 2×4×2 前突+身 8×12×6 加厚+
     长袍 overlay(inflate 0.5, 下摆收到 y6 让腿露一段——引擎步态可见优先,
     官方下摆 y0 会把摆腿动画整个罩没); 官方交叉臂是 idle 姿态语言, 与引擎
     挥击摆臂互斥, 取摆臂(持械怪持械手必须垂臂)
     quad: 四足(牛/猪/羊…) — 官方「竖模 bind_pose 90°」的等价水平盒(预躺平,
     推导注引研究笔记 §5); wool 参数 = 身/头同盒 + inflate 的 overlay(羊);
     bodyUV/headUV/legUVs 参数 = 大怪 128 档的布局重排覆写 */
  const BASES = {
    humanoid(o) {
      o = o || {};
      const hw = o.headW || 4; /* 头半宽(px) */
      return {
        head: {pivot: [0, 24, 0], cubes: [{origin: [-hw, 24, -4], size: [hw * 2, 8, 8], uv: [0, 0]}]},
        root: {pivot: [0, 24, 0], cubes: [{origin: [-4, 12, -2], size: [8, 12, 4], uv: [16, 16]}]},
        armR: {pivot: [-5, 22, 0], cubes: [{origin: [-8, 12, -2], size: [4, 12, 4], uv: [40, 16]}]},
        armL: {pivot: [5, 22, 0], cubes: [{origin: [4, 12, -2], size: [4, 12, 4], uv: [32, 48]}]},
        legR: {pivot: [-2, 12, 0], cubes: [{origin: [-4, 0, -2], size: [4, 12, 4], uv: [0, 16]}]},
        legL: {pivot: [2, 12, 0], cubes: [{origin: [0, 0, -2], size: [4, 12, 4], uv: [16, 48]}]},
      };
    },
    skeleton(o) {
      const b = BASES.humanoid(o);
      b.armR.cubes[0] = {origin: [-6, 12, -1], size: [2, 12, 2], uv: [40, 16]};
      b.armL.cubes[0] = {origin: [4, 12, -1], size: [2, 12, 2], uv: [32, 48]};
      b.legR.cubes[0] = {origin: [-3, 0, -1], size: [2, 12, 2], uv: [0, 16]};
      b.legL.cubes[0] = {origin: [1, 0, -1], size: [2, 12, 2], uv: [16, 48]};
      return b;
    },
    illager(o) {
      o = o || {};
      return {
        head: {pivot: [0, 24, 0], cubes: [
          {origin: [-4, 24, -4], size: [8, 10, 8], uv: [0, 0]},
          {origin: [-1, 23, -6], size: [2, 4, 2], uv: [40, 0]}, /* 鼻(前突, 官方立体脸件) */
        ]},
        root: {pivot: [0, 24, 0], cubes: [
          {origin: [-4, 12, -3], size: [8, 12, 6], uv: [0, 20]},
          {origin: [-4, 6, -3], size: [8, 12, 6], inflate: 0.5, uv: [32, 20]}, /* 长袍 overlay */
        ]},
        armR: {pivot: [-5, 22, 0], cubes: [{origin: [-8, 12, -2], size: [4, 12, 4], uv: [48, 0]}]},
        armL: {pivot: [5, 22, 0], cubes: [
          {origin: [4, 12, -2], size: [4, 12, 4], uv: [48, 0]}, /* 与右臂共区(对称袖) */
        ]},
        legR: {pivot: [-2, 12, 0], cubes: [{origin: [-4, 0, -2], size: [4, 12, 4], uv: [0, 40]}]},
        legL: {pivot: [2, 12, 0], cubes: [
          {origin: [0, 0, -2], size: [4, 12, 4], uv: [0, 40]}, /* 与右腿共区(同色靴) */
        ]},
      };
    },
    quad(o) {
      const body = {
        origin: [-o.w / 2, o.bodyCY - o.h / 2, o.bodyCZ - o.len / 2],
        size: [o.w, o.h, o.len], uv: o.bodyUV || [0, 16],
      };
      const bodyCubes = [body];
      const head = {
        origin: [-o.headW / 2, o.headCY - o.headH / 2, o.headCZ - o.headD / 2],
        size: [o.headW, o.headH, o.headD], uv: o.headUV || [0, 0],
      };
      const headCubes = [head];
      /* 羊毛 overlay: 身/头同盒 + inflate(官方手法, 研究笔记 §5 农场一家) */
      if (o.wool) {
        bodyCubes.push({...body, inflate: o.wool.inflate, uv: o.wool.bodyUV});
        headCubes.push({...head, inflate: o.wool.headInflate, uv: o.wool.headUV});
      }
      const legUVs = o.legUVs || /* 四腿各一区(左前/左后/右前/右后) */
        [[32, 0], [48, 0], [32, 16], [48, 16]];
      const leg = (x, z, uv) => ({
        origin: [x - o.legW / 2, 0, z - o.legW / 2], size: [o.legW, o.legH, o.legW], uv,
      });
      return {
        head: {pivot: [0, o.headPY !== undefined ? o.headPY : o.headCY,
          o.headPZ !== undefined ? o.headPZ : o.headCZ], cubes: headCubes},
        root: {pivot: [0, o.bodyCY, o.bodyCZ], cubes: bodyCubes},
        legR: {pivot: [-o.legX, o.legH, 0],
          cubes: [leg(-o.legX, o.legZF, legUVs[2]), leg(-o.legX, o.legZB, legUVs[3])]},
        legL: {pivot: [o.legX, o.legH, 0],
          cubes: [leg(o.legX, o.legZF, legUVs[0]), leg(o.legX, o.legZB, legUVs[1])]},
      };
    },
  };

  /* ---------- 骨架组装: 基座 + 追加骨(无 base = 全部骨自声明, 苦力怕/蜘蛛式) ---------- */
  function bonesOf(type) {
    const look = looks[type];
    const base = (look.base && BASES[look.base[0]]) ?
        BASES[look.base[0]](look.base[1] || {}) : {};
    if (look.bones) {
      for (const name of Object.keys(look.bones)) {
        const spec = look.bones[name] || {};
        if (!base[name]) base[name] = {pivot: spec.pivot || [0, 0, 0], axis: spec.axis, cubes: []};
        if (spec.add) base[name].cubes = base[name].cubes.concat(spec.add);
      }
    }
    return base;
  }

  /* ---------- 换算: 官方 px(−Z) → 引擎槽位(世界单位; mirror=true 镜像成 +Z) ----------
     槽位形状与 mobs.js 旧 MOB_RIG 同构(joint/axis/boxes) — render/gait/hasSlot 零改动;
     slot.cubes 附 px 原始数据(几何/贴图用)。z 镜像时 rx 取负(手性翻转)。 */
  function toSlots(type, mirror) {
    const look = looks[type];
    const bones = bonesOf(type);
    const s = (look.scale || 1) * PX;
    const slots = {};
    for (const name of Object.keys(bones)) {
      const bone = bones[name];
      const mz = mirror ? -1 : 1;
      const nz = (v) => v || 0; /* 镜像乘出 -0 归零(deepStrictEqual 可辨) */
      const slot = {
        joint: [bone.pivot[0] * s, bone.pivot[1] * s, nz(bone.pivot[2] * s * mz)],
        axis: bone.axis, boxes: [], cubes: bone.cubes,
      };
      for (const c of bone.cubes) {
        const w = c.size[0]; const h = c.size[1]; const d = c.size[2];
        const cx = (c.origin[0] + w / 2 - bone.pivot[0]) * s;
        const cy = (c.origin[1] + h / 2 - bone.pivot[1]) * s;
        const cz = nz(((c.origin[2] + d / 2) - bone.pivot[2]) * s * mz);
        slot.boxes.push({w: w * s, h: h * s, d: d * s, hex: 0xffffff,
          x: cx, y: cy, z: cz,
          rx: c.rx ? (mirror ? -c.rx : c.rx) : 0,
          rz: c.rz || 0}); /* rz 与 z 镜像交换不变(绕 z 轴), 不取负 */
      }
      slots[name] = slot;
    }
    return slots;
  }

  /* ---------- UV 区域表: 每骨每立方体六面矩形(贴图像素坐标) ---------- */
  function faceRects(c) {
    const w = c.size[0]; const h = c.size[1]; const d = c.size[2];
    const u = c.uv[0]; const v = c.uv[1];
    return {
      front: [u + d, v + d, w, h],
      back: [u + 2 * d + w, v + d, w, h],
      left: [u, v + d, d, h],
      right: [u + d + w, v + d, d, h],
      top: [u + d, v, w, d],
      bottom: [u + d + w, v, w, d],
    };
  }
  function regions(type) {
    const bones = bonesOf(type);
    const out = {};
    for (const name of Object.keys(bones)) {
      bones[name].cubes.forEach((c, i) => {
        out[name + (i ? i + 1 : '')] = faceRects(c);
      });
    }
    return out;
  }

  /* ---------- 贴图: 纯数据缓冲(缓存, Node 可逐像素直测) ---------- */
  const bufCache = {};
  function textureBuffer(type) {
    if (bufCache[type]) return bufCache[type];
    const look = looks[type];
    const size = (look.tex && look.tex.size) || 64;
    const sheet = mkSheet(size, seedOf(type));
    look.tex.paint(sheet, regions(type));
    bufCache[type] = {size, buf: sheet.buf};
    return bufCache[type];
  }

  /* ---------- 几何(THREE 惰性): 逐立方体盒 + as-seen UV → 合并 BufferGeometry ---------- */
  function asSeen(x, y, z, nx, ny, nz, ex, ey, ez, rects, mirror) {
    let r; let u; let v;
    if (nz > 0.5 || nz < -0.5) {
      const front = (mirror ? nz > 0.5 : nz < -0.5); /* 镜像后 +Z 面=官方北面(脸) */
      r = front ? rects.front : rects.back;
      u = front ? (x + ex) / (2 * ex) : (ex - x) / (2 * ex);
      v = (ey - y) / (2 * ey);
    } else if (nx > 0.5 || nx < -0.5) {
      r = nx > 0.5 ? rects.right : rects.left; /* +X 面=官方 +X 区(研究笔记 §2 的官方坐标) */
      u = nx > 0.5 ? (ez - z) / (2 * ez) : (z + ez) / (2 * ez);
      v = (ey - y) / (2 * ey);
    } else {
      r = ny > 0.5 ? rects.top : rects.bottom;
      u = ny > 0.5 ? (x + ex) / (2 * ex) : (ex - x) / (2 * ex);
      v = mirror ? (ez - z) / (2 * ez) : (z + ez) / (2 * ez); /* 区顶边=官方北缘(镜像后=+Z 缘) */
    }
    return [r[0] + u * r[2], r[1] + v * r[3]];
  }
  function slotGeo(slot, texSize, mirror, scale) {
    const positions = []; const normals = []; const uvs = []; const indices = [];
    const s = (scale || 1) * PX;
    let n = 0;
    for (const c of slot.cubes) {
      const inf = (c.inflate || 0) * s;
      const g = new THREE.BoxGeometry(c.size[0] * s + inf * 2, c.size[1] * s + inf * 2,
          c.size[2] * s + inf * 2);
      if (c.rx) g.rotateX(c.rx);
      if (c.rz) g.rotateZ(c.rz); /* 立方体级倾斜(猪灵耳/劫掠兽角/幻翼翼尖) */
      const off = slot.boxes[slot.cubes.indexOf(c)];
      g.translate(off.x, off.y, off.z);
      const rects = faceRects(c);
      const pos = g.attributes.position; const nor = g.attributes.normal;
      const ex = c.size[0] * s / 2 + inf; const ey = c.size[1] * s / 2 + inf;
      const ez = c.size[2] * s / 2 + inf;
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        const t = asSeen(pos.getX(i), pos.getY(i), pos.getZ(i),
            nor.getX(i), nor.getY(i), nor.getZ(i), ex, ey, ez, rects, mirror);
        uvs.push(t[0] / texSize, 1 - t[1] / texSize); /* canvas 顶行 = v 大(THREE flipY) */
      }
      const idx = g.index;
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + n);
      n += pos.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  /* ---------- 材质(每型一份, 惰性缓存): NearestFilter 保像素画风+防邻区串色 ---------- */
  const matCache = {};
  function material(type) {
    if (matCache[type]) return matCache[type];
    const tex = textureBuffer(type);
    const cv = document.createElement('canvas');
    cv.width = cv.height = tex.size;
    const ctx2d = cv.getContext('2d');
    const img = ctx2d.createImageData(tex.size, tex.size); /* 不用 new ImageData(引导桩沙箱无此全局) */
    img.data.set(tex.buf);
    ctx2d.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    matCache[type] = new THREE.MeshLambertMaterial({map: t});
    return matCache[type];
  }

  /* ---------- rig: mobs.js 消费(缓存; +Z 镜像; 附惰性材质出口) ---------- */
  const rigCache = {};
  function rig(type) {
    if (!looks[type]) return null;
    if (rigCache[type]) return rigCache[type];
    const look = looks[type];
    rigCache[type] = {
      slots: toSlots(type, true),
      armStyle: look.armStyle,
      weaponArm: look.weaponArm,
      look: type,
      mat: () => material(type),
    };
    return rigCache[type];
  }
  /* 怪物路径逐槽几何(+Z 镜像, 尺寸含 inflate) */
  function slotGeoOf(type, slot) {
    const look = looks[type];
    const size = (look.tex && look.tex.size) || 64;
    return slotGeo(slot, size, true, look.scale);
  }

  /* ---------- puppet: avatar.js 消费(−Z 原生; 逐骨 Group+Mesh, 手持物挂臂骨) ---------- */
  function puppet(type) {
    const look = looks[type];
    const s = (look.scale || 1) * PX;
    const slots = toSlots(type, false);
    const mat = material(type);
    const size = (look.tex && look.tex.size) || 64;
    const root = new THREE.Group();
    const bones = {};
    for (const name of Object.keys(slots)) {
      const g = new THREE.Group();
      g.position.fromArray(slots[name].joint);
      g.add(new THREE.Mesh(slotGeo(slots[name], size, false, look.scale), mat));
      root.add(g);
      bones[name === 'root' ? 'body' : name] = g; /* 槽位 root(身体)改名 body 让位傀儡根 */
    }
    bones.root = root; /* 傀儡根组(挂场景/整体位姿用) */
    return {root, bones, material: mat, scale: s};
  }

  /* ---------- 头像裁切: head 首立方体 front 区 → 16×16 [r,g,b]|null 网(居中) ---------- */
  function facePixels(type) {
    if (!looks[type]) return null;
    const reg = regions(type);
    if (!reg.head) return null;
    const rect = reg.head.front;
    const tex = textureBuffer(type);
    const out = new Array(16 * 16).fill(null);
    const ox = Math.floor((16 - rect[2]) / 2); const oy = Math.floor((16 - rect[3]) / 2);
    for (let y = 0; y < rect[3]; y++) {
      for (let x = 0; x < rect[2]; x++) {
        const gx = rect[0] + x; const gy = rect[1] + y;
        const o = (gy * tex.size + gx) * 4;
        out[(oy + y) * 16 + (ox + x)] = [tex.buf[o], tex.buf[o + 1], tex.buf[o + 2]];
      }
    }
    return out;
  }

  /* ---------- 碎块色(可选声明, 回落 mobs.js MOB_DEBRIS) ---------- */
  function debrisOf(type) {
    return (looks[type] && looks[type].debris) || null;
  }

  return {PX, declare, has, keys, rig, slotGeoOf, puppet, regions, textureBuffer,
    facePixels, debrisOf};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MobLookKit;
