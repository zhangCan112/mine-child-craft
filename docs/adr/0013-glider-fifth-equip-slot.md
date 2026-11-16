# ADR 0013 · 滑翔翼装备第五槽:EQUIP_SLOTS 四槽表扩五槽,专属不互换

日期:2026-11-15 · 状态:已采纳(滑翔翼特性立项拍板②)

## Context

装备核心 EQUIP_SLOTS 是单源四槽表(helmet/chestplate/leggings/boots;GLOSSARY「装备核心」词条、
docs/equipment-design.md §1.2 均按四槽描述,且是装备条 UI 展示序唯一权威)。滑翔翼需要自己的
穿戴位(PO 拍板②:装备栏新增一个专属槽位)。

## Considered Options

- **A. 专属第五槽(采纳)**:EQUIP_SLOTS 顺延开 glider 键,只收滑翔翼;与四件盔甲互不排斥
  (全身甲+翼同穿)。
- **B. 复用胸甲槽(否决)**:孩子会面临「护甲 vs 玩具」二选一,与滑翔快乐定位冲突,
  减伤数值口径也被搅乱。
- **C. 不进装备栏,背包持有即生效(否决)**:「穿上」的仪式感与纸娃娃/装备页呈现是拥有感的
  一部分(拍板②明确要装备栏)。

## Consequences

- HUD 装备条(mkArmorBar)与背包装备页(纸娃娃+槽位)自动多一槽;
  **4 处硬编码四槽的守门测试需同步改**(researcher 2026-11-15 现状核实)。
- 存档 worn 形状多一键;wornNormalize 对新键归一——**装备档未注册 id 会被静默丢弃,
  滑翔翼物品注册进 ITEMS 不能下线(实现红线)**。
- 穿/脱交互沿用现有 wear 政策链(wornPut/advTryWear 家族),不造第二套穿戴流程;
  第五槽在 HUD/装备页的呈现方案转 ui-designer 需求评审(PO 级输入:interview R1-13/R1-15)。
- GLOSSARY「装备核心」词条的「四槽」表述随实现修订(spec 阶段)。
