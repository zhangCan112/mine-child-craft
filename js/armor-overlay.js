'use strict';
/* ============================================================
   穿戴层几何 (ArmorOverlay, 装备 T9 / 设计稿 §9.4) — 引擎层
   ------------------------------------------------------------
   骨挂盔甲 overlay 盒的唯一几何权威(自 avatar.js setArmor 内联闭包
   抽件): 头盔=头骨五面盒(前开脸露五官, 正典盔甲层语言) · 胸甲=身骨
   主盒+双肩帽 · 护腿=双腿骨上 2/3 盒+髋带(挂身骨) · 靴子=双腿骨下
   1/4 盒+鞋头。尺寸=对应骨盒(官方等比 8/12/4px, 与 mob-look player
   档案同源)各向 +1px; 位置=复制本体盒中心再按段偏移(数据驱动对齐,
   零硬编码关节)。颜色=ARMOR_TIER_COLORS 穿戴层色板(held-item.js,
   §7.3 层板——与图标色板两套独立调色)。消费方两个: Avatar(玩家身上的
   穿戴观感)与背包面板纸娃娃(js/paper-doll.js, 装备页预览)——几何
   单份, 不落双份。
   interface: mkArmorOverlay(puppet) → {apply(worn) · dispose()}
     apply(worn)  声明目标穿戴({helmet:{id,dur}|null, ...}); 同目标
                  幂等——四槽 id 集不变即不动(磨损只变 dur, 不重建
                  网格); 穿/卸即时贴身
     dispose()    卸全部 overlay 网格并释放几何/材质(Avatar 不消费
                  ——跨模式存活; 纸娃娃 dispose 时随场景一并释放)
   依赖(均经全局名, 调用期解析): js/items-core.js 的 armorOf(判据
     单份), js/held-item.js 的 HeldItems.ARMOR_TIER_COLORS(层色板),
     js/equipment-core.js 的 EQUIP_SLOTS(四槽序), lib/three.min.js
     (THREE 只在 apply/dispose 期使用, mk 零依赖——Node 冒烟安全)
   可测性: THREE 调用期使用, Node 不直测, 由 test/boot.test.js 按
     index.html 真实顺序全链冒烟(setArmor 路径, 装备 T4 段)
   ============================================================ */

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

  /* 挂一只 overlay 盒: 尺寸 px×SCALE · 位置=本体盒中心 + opts 偏移(dx/dy
     段内 px) · hideFront 前脸透明(头盔开脸——BoxGeometry 材质数组 -z=index 5) */
  function addBox(bone, w, h, d, color, opts) {
    opts = opts || {};
    const geo = new THREE.BoxGeometry(w * SCALE, h * SCALE, d * SCALE);
    const solid = new THREE.MeshLambertMaterial({color});
    let mesh;
    if (opts.hideFront) {
      const open = new THREE.MeshLambertMaterial({transparent: true, opacity: 0});
      mesh = new THREE.Mesh(geo, [solid, solid, solid, solid, solid, open]);
    } else {
      mesh = new THREE.Mesh(geo, solid);
    }
    const src = bone.children[0]; /* 本体盒 mesh: 位置=骨盒中心(相对关节) */
    mesh.position.copy(src.position);
    if (opts.dx) mesh.position.x += opts.dx * SCALE;
    if (opts.dy) mesh.position.y += opts.dy * SCALE;
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
      const colorOf = (id) => HeldItems.ARMOR_TIER_COLORS[armorOf(id).tier];
      /* 头盔: 头盒 8×8×8 +1px → 9×9×9, 前开脸 */
      if (worn.helmet) addBox(head, 9, 9, 9, colorOf(worn.helmet.id), {hideFront: true});
      /* 胸甲: 身盒 8×12×4 +1px → 主盒 9×13×5 + 双肩帽 5×2×5(顶上两角对称) */
      if (worn.chestplate) {
        const c = colorOf(worn.chestplate.id);
        addBox(body, 9, 13, 5, c);
        addBox(body, 5, 2, 5, c, {dx: -2.5, dy: 7});
        addBox(body, 5, 2, 5, c, {dx: 2.5, dy: 7});
      }
      /* 护腿: 腿盒 4×12×4 上 2/3 → 每腿 5×9×5(段内上移对齐上部) + 髋带 9×3×5(挂身骨下缘) */
      if (worn.leggings) {
        const c = colorOf(worn.leggings.id);
        addBox(legL, 5, 9, 5, c, {dy: 1});
        addBox(legR, 5, 9, 5, c, {dy: 1});
        addBox(body, 9, 3, 5, c, {dy: -5});
      }
      /* 靴子: 腿盒下 1/4 → 每腿 5×4×5(段内下移) + 鞋头前伸 5×2×3(-z 前) */
      if (worn.boots) {
        const c = colorOf(worn.boots.id);
        addBox(legL, 5, 4, 5, c, {dy: -4});
        addBox(legR, 5, 4, 5, c, {dy: -4});
        addBox(legL, 5, 2, 3, c, {dy: -5});
        addBox(legR, 5, 2, 3, c, {dy: -5});
      }
    },
    dispose() {
      for (const e of meshes) {
        e.bone.remove(e.mesh);
        e.mesh.geometry.dispose();
        const m = e.mesh.material;
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
      meshes.length = 0;
      sig = '';
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {mkArmorOverlay};
}
