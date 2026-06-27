# Enemy Elite Golem Affix Combos Pass 2

本轮修正两个关键方向：

- 精英敌人应为魔像美术素材，不是方块、纹章、基座或状态标签。
- 视角统一为正视图；四个词条使用固定副色，避免全部依赖精英紫色。

## 颜色规则

- `armorSpore`：绿色副色，表现孢子、菌壳、藤蔓矿脉。
- `jump`：蓝色副色，表现反弓支架、推进器、关节能量。
- `haste`：黄色副色，表现导风、流线、速度肋。
- `berserk`：红色副色，表现裂缝、过热、失控核心。

多词条组合同时保留对应副色，例如 `armorSpore_jump_berserk` 同时出现绿、蓝、红。

## 组合覆盖

- 单条词条 x4：`armorSpore`、`jump`、`haste`、`berserk`
- 两条词条 x6：`armorSpore_jump`、`armorSpore_haste`、`armorSpore_berserk`、`jump_haste`、`jump_berserk`、`haste_berserk`
- 三条词条 x4：`armorSpore_jump_haste`、`armorSpore_jump_berserk`、`armorSpore_haste_berserk`、`jump_haste_berserk`
- 四条词条 x1：`armorSpore_jump_haste_berserk`

## 输出路径

项目候选资产位于：

- `assets/sprites/enemies/elites/golem_affix_combos/pass2/`

每个组合包含两档输出：

- `elite_golem_<combo>_front_256_pass2.png`：评审与后续动画拆分参考图。
- `elite_golem_<combo>_front_128_pass2.png`：运行时接入候选规格图。

评审对照图：

- `docs/design/concepts/enemy_elite_golem_affix_combos_pass2/elite_golem_affix_combos_front_color_contact_sheet_pass2.png`

## 接入备注

- 本轮基于现有 `assets/sprites/enemies/golem_elite.png` 的 `row2 col0` 正视站立帧生成，因此比例、透明边界和魔像读形与项目现有精英魔像保持一致。
- 本轮没有修改敌人渲染代码，也没有覆盖现有运行时资源。
- 早先方块/基座方向的 `affix_combos/pass1` 与 `variants/pass2` 不应作为本轮接入口径使用。
