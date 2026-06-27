# Enemy Elite Affix Combo Assets Pass 1

本轮资产用于修正此前方向：带词条的敌人按“精英敌人”处理，而不是普通敌人的基座微变体。四个词条 `armorSpore`、`jump`、`haste`、`berserk` 全组合生成，共 15 张完整精英敌人美术资产。

## 组合覆盖

- 单条词条 x4：`armorSpore`、`jump`、`haste`、`berserk`
- 两条词条 x6：`armorSpore_jump`、`armorSpore_haste`、`armorSpore_berserk`、`jump_haste`、`jump_berserk`、`haste_berserk`
- 三条词条 x4：`armorSpore_jump_haste`、`armorSpore_jump_berserk`、`armorSpore_haste_berserk`、`jump_haste_berserk`
- 四条词条 x1：`armorSpore_jump_haste_berserk`

## 设计口径

- 这些资产是完整的精英敌人视觉，不是 `variants/pass2` 中的普通基座候选。
- 每张图都维持 1x1 正方形足迹：四角、边界和主体读形保留方形稳定性。
- 词条不使用小标签、漂浮徽章、文字或血条表达，而是内化为装甲、材质、推进器、导风件、裂缝和核心状态。
- `armorSpore` 使用自然弧线、菌壳矿化、孢子结节和藤蔓式炼金脉络。
- `jump` 使用轻量反弓支架、小型推进器、折叠稳定翼和悬挂间隙。
- `haste` 使用流线装甲、导风槽、斜向速度肋和嵌入式速度光纹。
- `berserk` 使用外翻裂板、熔红裂隙、烧蚀边缘、暴露核心和失控结构。

## 输出路径

项目候选资产位于：

- `assets/sprites/enemies/elites/affix_combos/pass1/`

每个组合都有四类输出：

- `elite_<combo>_1x1_chroma_pass1.png`：原始绿幕源图。
- `elite_<combo>_1x1_alpha_pass1.png`：去背后的未规格化透明图。
- `elite_<combo>_1x1_256_pass1.png`：评审与后续动画拆分参考图。
- `elite_<combo>_1x1_128_pass1.png`：运行时接入候选规格图。

评审对照图：

- `docs/design/concepts/enemy_elite_affix_combos_pass1/elite_affix_combos_contact_sheet_pass1.png`

## 接入备注

- 本轮没有覆盖现有运行时资源，也没有修改敌人渲染代码。
- 128/256 输出均按 alpha 包围盒裁切后重新补成正方形画布。
- 四词条组合视觉密度较高，若后续接入战斗场景，建议先在 128 尺寸下检查可读性，再决定是否需要降噪或拆分动态层。
