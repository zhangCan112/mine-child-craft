'use strict';
/* ============================================================
   穿戴层几何 (ArmorOverlay, 装备 T9 / 设计稿 §9.4) — 引擎层
   ------------------------------------------------------------
   骨挂盔甲 overlay 盒的唯一几何权威(自 avatar.js setArmor 内联闭包
   抽件): 头盔=头骨盒+面具前脸(额带+眼窗+护颊+护鼻造型, 前脸贴图
   alphaTest 抠窗露五官) · 胸甲=身骨主盒+臂骨挂甲袖(正典肩甲语言=
   臂上段袖筒, 2026-11-05 用户反馈撤双肩帽改甲袖) · 护腿=双腿骨上
   2/3 盒 · 靴子=双腿骨下段盒。尺寸=对应
   骨盒(官方等比 8/12/4px, 与 mob-look player 档案同源)各向 +1px;
   位置=骨枢轴 + 显式偏移(头/身/腿盒中心相对枢轴 +4/−6/−6px, player
   官方等比常量——**不可 copy 骨 children[0]**: puppet 每骨盒体烘成
   合体 mesh、自身恒零位, copy 即全挂枢轴=「头盔卡脖/胸甲套头」错位
   根因, 2026-11-05 修复)。
   **贴图观感**(2026-11-05 用户反馈二修——单色盒「刷漆」→ 双色描边条
   仍不够, 上程序生成像素贴图): 每 tier 两张 16×16 CanvasTexture——
   盒身一张(键 tier; 板缝/铆钉/锁子网纹/晶纹按材质风格差异化, 明暗
   层次画在图里, 纯派生不引第二色源——底色仍取 §7.3 层色板, 六面
   同图横板缝跨面对齐), 前脸一张(键 tier#front, 仅贴头盔 -z 面,
   额带+眼窗+护颊+护鼻面具造型, alphaTest 抠窗——三修详见 §9.4),
   NearestFilter 关平滑保像素风; 画布/THREE 不可用回落纯色(Node
   冒烟口径, held-item mkArtMats 同款纪律)。消费方两个: Avatar(玩家
   身上的穿戴观感)与背包面板纸娃娃(js/paper-doll.js, 装备页预览)
   ——几何单份, 不落双份。
   interface: mkArmorOverlay(puppet) → {apply(worn) · dispose()}
     apply(worn)  声明目标穿戴({helmet:{id,dur}|null, ...}); 同目标
                  幂等——四槽 id 集不变即不动(磨损只变 dur, 不重建
                  网格); 穿/卸即时贴身
     dispose()    卸全部 overlay 网格并释放几何/材质(贴图模块级共享
                  缓存不释放——全表至多十二张(六 tier × 盒身/前脸),
                  生命周期=页面; Avatar 不消费 dispose——跨模式存活,
                  纸娃娃随场景释放)
   依赖(均经全局名, 调用期解析): js/items-core.js 的 armorOf(判据
     单份), js/held-item.js 的 HeldItems.ARMOR_TIER_COLORS(层色板,
     贴图底色唯一来源), js/equipment-core.js 的 EQUIP_SLOTS(四槽序),
     lib/three.min.js(THREE 只在 apply/dispose 期使用, mk 零依赖
     ——Node 冒烟安全)
   可测性: test/armor-overlay.test.js 直测(document+THREE 双桩走
     浏览器路径: 贴图缓存命中复用/前脸 index5/甲袖挂臂骨——2026-11-05
     换件炸点回归, Node 冒烟测不到缓存命中分支), test/boot.test.js 按
     index.html 真实顺序全链冒烟(setArmor 回落路径, 装备 T4 段)
   ============================================================ */

/* 明暗派生(纯比例, 不引第二色板——§7.3 层色板仍是唯一色源):
   shade 压暗作板缝/暗缘, tint 提亮作高光/铆钉 */
function armorShade(c, f) {
  const ch = (v) => Math.min(255, Math.round(v * f));
  return (ch(c >> 16 & 255) << 16) | (ch(c >> 8 & 255) << 8) | ch(c & 255);
}
function armorTint(c, f) {
  const mix = (v) => Math.min(255, Math.round(v + (255 - v) * f));
  return (mix(c >> 16 & 255) << 16) | (mix(c >> 8 & 255) << 8) | mix(c & 255);
}

/* 每 tier 一张 16×16 盔甲纹理(程序生成, 模块级缓存——Avatar/纸娃娃
   所有 overlay 实例共享, 全表至多六张): 底色=层色板主色, 明暗全走
   派生。风格差异(正典盔甲层语言的手绘近似):
   - leather  皮革: 缝线虚线代板缝, 无铆钉, 角落磨斑
   - chain    锁子: 无板缝, 2×2 交错网点阵
   - iron/gold 板甲: 双横板缝+四铆钉+顶部高光行(gold 铆钉更亮)
   - diamond  钻甲: 斜向晶纹+晶体亮点(高光最亮)
   - netherite 黑曜: 暗底弱板缝+红棕斑(下界合金的火山纹) */
const ARMOR_TEX_CACHE = new Map(); // tier(+('#front')) → THREE.CanvasTexture | null(回落标记也缓存, 免重复探测)
/* 贴图画笔(底色派生三件套, 两类贴图共用): dark 压暗/lite 提亮/px 单点 */
function armorTexPainter(c) {
  const dark = (f) => {
    return '#' + armorShade(c, f).toString(16).padStart(6, '0');
  };
  const lite = (f) => {
    return '#' + armorTint(c, f).toString(16).padStart(6, '0');
  };
  const px = (g, x, y, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  return {dark, lite, px};
}
function armorTexSetup(tier, key) {
  const ck = tier + key;
  /* 三态返回: {c, paint}=首次建(调 paint 画图并缓存) · CanvasTexture=
     命中已建缓存 · null=回落标记——调用方以 setup.paint 判别 */
  if (ARMOR_TEX_CACHE.has(ck)) return ARMOR_TEX_CACHE.get(ck);
  if (typeof document === 'undefined' || typeof THREE === 'undefined' ||
      typeof HeldItems === 'undefined' || !HeldItems.ARMOR_TIER_COLORS[tier]) {
    ARMOR_TEX_CACHE.set(ck, null);
    return null; /* Node 冒烟/桩环境: 回落纯色(held-item mkArtMats 同款) */
  }
  const c = HeldItems.ARMOR_TIER_COLORS[tier];
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 16;
  const paint = (body) => {
    const g = cv.getContext('2d');
    const {dark, lite, px} = armorTexPainter(c);
    g.fillStyle = '#' + c.toString(16).padStart(6, '0');
    g.fillRect(0, 0, 16, 16); /* 底色 */
    for (let x = 0; x < 16; x++) px(g, x, 0, lite(0.42)); /* 顶部高光行 */
    for (let x = 0; x < 16; x++) px(g, x, 15, dark(0.5)); /* 底部暗缘 */
    body(g, {dark, lite, px});
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; /* 像素风: 关平滑(held-item 同款) */
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    ARMOR_TEX_CACHE.set(ck, tex);
    return tex;
  };
  return {c, paint};
}

/* 盒身通用纹理(六面同图)——风格差异(正典盔甲层语言的手绘近似):
   - leather  皮革: 缝线虚线代板缝, 无铆钉, 角落磨斑
   - chain    锁子: 无板缝, 2×2 交错网点阵
   - iron/gold 板甲: 双横板缝+四铆钉(gold 铆钉更亮)
   - diamond  钻甲: 斜向晶纹+晶体亮点(高光最亮)
   - netherite 黑曜: 暗底弱板缝+红棕斑(下界合金的火山纹) */
function armorTierTexture(tier) {
  const setup = armorTexSetup(tier, '');
  if (!setup || !setup.paint) return setup; /* null=回落标记; 无 paint=二次
    取已缓存纹理(2026-11-05 换件炸点: 首穿建缓存, 次取是纹理非画笔组) */
  return setup.paint((g, {dark, lite, px}) => {
    if (tier === 'chain') {
      /* 锁子甲: 2×2 交错网点(偶行偶列/奇行奇列错位), 点=暗芯+亮缘 */
      for (let y = 1; y < 15; y++) {
        for (let x = (y % 2); x < 16; x += 2) {
          px(g, x, y, dark(0.6));
          px(g, x + 1, y, lite(0.18));
        }
      }
    } else if (tier === 'leather') {
      /* 皮革: 双缝线虚线(暗棕) + 四角磨斑(暗点) */
      for (let x = 1; x < 15; x++) {
        if (x % 4 !== 3) px(g, x, 5, dark(0.62));
        if (x % 4 !== 1) px(g, x, 10, dark(0.62));
      }
      [[2, 2], [13, 3], [3, 13], [12, 12]].forEach(([x, y]) => px(g, x, y, dark(0.7)));
    } else if (tier === 'diamond') {
      /* 钻甲: 板缝暗线(断开让位晶纹) + 斜向晶体亮点(最亮高光) */
      for (let x = 1; x < 15; x++) {
        if (x % 5 !== 2) px(g, x, 5, dark(0.62));
        if (x % 5 !== 4) px(g, x, 10, dark(0.62));
      }
      [[3, 3], [11, 4], [6, 8], [13, 9], [4, 12], [9, 13]].forEach(([x, y]) => {
        px(g, x, y, lite(0.62));
        px(g, x + 1, y + 1, lite(0.3));
      });
    } else if (tier === 'netherite') {
      /* 黑曜: 弱板缝(近底色) + 火山红棕斑 */
      for (let x = 1; x < 15; x++) {
        if (x % 6 !== 3) px(g, x, 6, dark(0.78));
        if (x % 6 !== 0) px(g, x, 11, dark(0.78));
      }
      [[5, 3], [12, 7], [3, 9], [10, 13]].forEach(([x, y]) => px(g, x, y, lite(0.22)));
    } else {
      /* iron / gold: 板甲——双横板缝(铆钉断位) + 四铆钉 + 亮缘 */
      for (let x = 1; x < 15; x++) {
        const rivet5 = (x === 4 || x === 11);
        const rivet10 = (x === 5 || x === 12);
        if (!rivet5) px(g, x, 5, dark(0.6));
        if (!rivet10) px(g, x, 10, dark(0.6));
      }
      const rp = (tier === 'gold') ? 0.6 : 0.45; /* 金铆钉更扎眼 */
      [[4, 5], [11, 5], [5, 10], [12, 10]].forEach(([x, y]) => px(g, x, y, lite(rp)));
    }
  });
}

/* 头盔前脸纹理(带面具造型, 仅贴 -z 前脸——BoxGeometry 面序 -z=index 5):
   额头盔壳横带 + 眼窗(alphaTest 抠透明露五官) + 护颊柱 + 中央护鼻竖脊 +
   下颌带——正典盔甲层的「脸窗」语言(2026-11-05 用户反馈: 额头要有遮挡
   且有造型, 参考原版效果)。窗区=列 4~11 行 5~8 clearRect 全透明。 */
function armorFrontTexture(tier) {
  const setup = armorTexSetup(tier, '#front');
  if (!setup || !setup.paint) return setup; /* 同 armorTierTexture: 命中直返 */
  return setup.paint((g, {dark, lite, px}) => {
    const c = setup.c;
    /* 额头盔壳横带(行 1~4): 行 1 沿高光、行 4 下缘暗, 中央铆钉两颗 */
    for (let x = 0; x < 16; x++) {
      px(g, x, 1, lite(0.3));
      px(g, x, 4, dark(0.6));
    }
    [[3, 2], [12, 2]].forEach(([x, y]) => {
      px(g, x, y, lite(tier === 'gold' ? 0.6 : 0.45));
    });
    /* 眼窗(行 5~8 列 4~11): 全透明(alphaTest 抠窗) + 窗框暗缘 */
    g.clearRect(4, 5, 8, 4);
    for (let y = 5; y < 9; y++) {
      px(g, 3, y, dark(0.55));
      px(g, 12, y, dark(0.55));
    }
    /* 护颊柱(窗两侧列 0~2/13~15): 暗一档实甲 + 内缘竖纹 */
    for (let y = 5; y < 9; y++) {
      for (const x of [0, 1, 2, 13, 14, 15]) {
        px(g, x, y, dark(0.85));
      }
    }
    /* 中央护鼻竖脊(列 7~8, 行 1~14 贯通): 亮色凸脊造型 */
    for (let y = 1; y < 15; y++) {
      px(g, 7, y, lite(0.3));
      px(g, 8, y, lite(0.14));
    }
    /* 下颌带(行 12~14): 实甲 + 底缘暗 */
    for (let x = 0; x < 16; x++) {
      px(g, x, 12, dark(0.88));
      px(g, x, 14, dark(0.6));
    }
    [[4, 13], [11, 13]].forEach(([x, y]) => px(g, x, y, lite(0.3)));
  });
}

/* mkArmorOverlay: 在 puppet(MobLookKit.puppet 产物, {bones, scale}) 上
   挂一只穿戴层管理器。脚本序: 本文件先于 avatar.js(Avatar 载入即建)。 */
function mkArmorOverlay(puppet) {
  const SCALE = puppet.scale || 1; // 官方 px → 格(mob-look-kit 建模换算, 缺省 1)
  const meshes = []; // [{bone, mesh}] 卸甲/换件的全量清单
  let sig = ''; // 当前穿戴四槽 id 签名(幂等判据; ''=空穿)
  const head = puppet.bones.head;
  const body = puppet.bones.body; /* 躯干骨(mob-look-kit 槽位 root 改名 body) */
  /* 骨架名 ≠ 解剖学左右(镜像装配, avatar.js 头注释详述): overlay 几何
     对双腿对称, 沿用 Avatar 同款绑定字面防漂移 */
  const legL = puppet.bones.legR;
  const legR = puppet.bones.legL;
  /* 双臂(player 档案 armR=世界右 −x / armL=世界左 +x): 甲袖挂臂骨——
     正典胸甲层的肩部覆盖=臂上段袖筒, dx 逐臂配平臂盒中心 */
  const armR = puppet.bones.armR;
  const armL = puppet.bones.armL;

  /* 挂一只 overlay 盒: 尺寸 px×SCALE · 位置=骨枢轴 + opts 偏移(dx/dy 段内
     px, 已含本体盒中心相对枢轴的偏移——见 apply 各件注释)。贴图路径:
     opts.tex 提供 CanvasTexture → 实甲材质六面同图; opts.frontTex 提供
     前脸纹理 → -z 面(BoxGeometry 面序 index 5, 玩家脸朝 -z)换 alphaTest
     抠窗材质(头盔面具, 窗区=贴图 clearRect 透明像素), 其余五面仍实甲;
     缺省纯色(Node 冒烟回落)。
     **不可 copy 骨 children[0] 的 position**(2026-11-05 错位根因): puppet
     每骨的全部盒体烘成一只合体 mesh(slotGeo g.translate 进顶点), mesh
     自身恒零位——copy 到 (0,0,0) = overlay 全挂骨枢轴(head 枢轴在颈部/
     body 枢轴在肩部 → 「头盔卡脖、胸甲套头」)。改用 player 官方等比
     常量显式定位(overlay 只服务 player 身形: 头/身/腿盒中心相对骨枢轴
     = +4/−6/−6px, 与 mob-look-kit player 档案同源)。 */
  function addBox(bone, w, h, d, color, opts) {
    opts = opts || {};
    const geo = new THREE.BoxGeometry(w * SCALE, h * SCALE, d * SCALE);
    const solid = opts.tex ?
      new THREE.MeshLambertMaterial({map: opts.tex}) :
      new THREE.MeshLambertMaterial({color});
    let mesh;
    if (opts.frontTex) {
      /* 面具前脸: alphaTest 抠透明像素(免 transparent 透明排序), 其余
         五面共用实甲材质 */
      const front = new THREE.MeshLambertMaterial(
          {map: opts.frontTex, alphaTest: 0.5});
      mesh = new THREE.Mesh(geo, [solid, solid, solid, solid, solid, front]);
    } else {
      mesh = new THREE.Mesh(geo, solid);
    }
    mesh.position.set((opts.dx || 0) * SCALE, (opts.dy || 0) * SCALE,
        (opts.dz || 0) * SCALE);
    bone.add(mesh);
    meshes.push({bone, mesh});
  }

  return {
    apply(worn) {
      /* 四槽 id 签名: 槽形 {id, dur}|null → id|''(armorOf 判据单份在 items-core) */
      const s = EQUIP_SLOTS.map((k) => (worn && worn[k] ? worn[k].id : '')).join(',');
      if (s === sig) return; /* 同目标幂等(磨损/重声明不动网格) */
      sig = s;
      for (const e of meshes) e.bone.remove(e.mesh); /* 卸旧全量 */
      meshes.length = 0;
      if (!worn) return;
      /* 贴图观感: 每 tier 一张程序生成纹理(明暗层次画在图里——板缝/
         铆钉/网纹/晶纹, 顶部高光行+底部暗缘通用), 纯色仅作画布/THREE
         不可用时的回落(2026-11-05 用户反馈二修: 上贴图替代描边条) */
      const tierOf = (id) => armorOf(id).tier;
      const texOf = (id) => armorTierTexture(tierOf(id));
      const colorOf = (id) => HeldItems.ARMOR_TIER_COLORS[tierOf(id)];
      /* 头盔: 头盒 8×8×8 +1px → 9×9×9, 前脸面具(额带+眼窗+护颊+护鼻,
         armorFrontTexture 抠窗露五官); dy=+4 头盒中心相对 head 枢轴
         (pivot y24, 盒 y24~32 中心 28) */
      if (worn.helmet) {
        addBox(head, 9, 9, 9, colorOf(worn.helmet.id),
            {frontTex: armorFrontTexture(tierOf(worn.helmet.id)),
              tex: texOf(worn.helmet.id), dy: 4});
      }
      /* 胸甲: 身盒 8×12×4 +1px → 主盒 9×13×5 + 臂骨挂甲袖(肩部覆盖=
         正典肩甲语言——臂上段袖筒, 2026-11-05 用户反馈撤双肩帽);
         身盒中心相对 body(root) 枢轴 = −6(pivot y24, 盒 y12~24 中心 18) */
      if (worn.chestplate) {
        const t = texOf(worn.chestplate.id);
        const c = colorOf(worn.chestplate.id);
        addBox(body, 9, 13, 5, c, {tex: t, dy: -6});
        /* 甲袖: 臂盒 4×12×4 挂 y12~24(中心 y18), 臂枢轴 y22 → 臂盒中心
           dy=−4; 袖筒 5×5×5 取 dy=0 → 盖 y19.5~24.5(肩段, 上缘恰过肩头);
           dx=∓1 配平臂盒中心(armR 世界右 −x / armL 世界左 +x) */
        addBox(armR, 5, 5, 5, c, {dx: -1, dy: 0, tex: t});
        addBox(armL, 5, 5, 5, c, {dx: 1, dy: 0, tex: t});
      }
      /* 护腿: 腿盒 4×12×4 上 2/3 → 每腿 5×9×5(贴图顶部亮行即髋带感);
         腿盒中心相对腿骨枢轴 = −6(pivot y12, 盒 y0~12 中心 6), 段内上移
         +1 → −5 */
      if (worn.leggings) {
        const t = texOf(worn.leggings.id);
        const c = colorOf(worn.leggings.id);
        addBox(legL, 5, 9, 5, c, {dy: -5, tex: t});
        addBox(legR, 5, 9, 5, c, {dy: -5, tex: t});
      }
      /* 靴子: 腿盒下段 → 每腿 5×4×5(贴图底部暗缘即鞋底);
         腿盒中心 −6 + 段内下移 −4 → −10 */
      if (worn.boots) {
        const t = texOf(worn.boots.id);
        const c = colorOf(worn.boots.id);
        addBox(legL, 5, 4, 5, c, {dy: -10, tex: t});
        addBox(legR, 5, 4, 5, c, {dy: -10, tex: t});
      }
    },
    dispose() {
      for (const e of meshes) {
        e.bone.remove(e.mesh);
        e.mesh.geometry.dispose();
        const m = e.mesh.material;
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); /* 贴图共享
          缓存不释放(material.dispose 不连带 texture), 生命周期=页面 */
      }
      meshes.length = 0;
      sig = '';
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {mkArmorOverlay};
}
