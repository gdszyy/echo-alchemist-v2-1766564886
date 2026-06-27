# Enemy Affix Base Variants Pass 2

本轮针对 `armorSpore`、`jump`、`haste`、`berserk` 四个基座变体进行定向修正，目标是保留 1x1 敌人的正方形边界读形，同时让词条差异更多来自基底细节、材质、肢体/部件和纹路，而不是敌人上方的小标签。

## 设计调整

- `armorSpore`：弱化规整机械感，改为更自然的菌壳弧线、矿脉曲线和孢子结节，但仍保留四角锚点与方形基座。
- `jump`：减轻整体重量感，使用反弓式下肢支架、折叠稳定翼和小型推进器，避免厚重双足。
- `haste`：加入流线装甲、导风槽、斜向速度肋和侧翼切片，让速度感来自结构本身。
- `berserk`：强化失控与狂暴感，使用外翻裂板、爆热核心、熔红裂缝和烧蚀边缘，但主体仍维持方形轮廓。

## 输出资产

游戏候选资产位于：

- `assets/sprites/enemies/variants/pass2/enemy_variant_armorSpore_residue_1x1_128_pass2.png`
- `assets/sprites/enemies/variants/pass2/enemy_variant_jump_residue_1x1_128_pass2.png`
- `assets/sprites/enemies/variants/pass2/enemy_variant_haste_residue_1x1_128_pass2.png`
- `assets/sprites/enemies/variants/pass2/enemy_variant_berserk_residue_1x1_128_pass2.png`

同目录还保留了：

- `*_chroma_pass2.png`：原始绿幕图。
- `*_alpha_pass2.png`：去背后的未规格化透明图。
- `*_256_pass2.png`：概念评审用透明大图。

评审对照图：

- `docs/design/concepts/enemy_affix_variants_pass2/enemy_affix_variants_residue_1x1_contact_sheet_pass2.png`

## 接入备注

- 本轮没有覆盖现有运行时资源，也没有修改敌人渲染代码。
- 所有 128/256 输出均按 alpha 包围盒裁切后重新补成正方形画布。
- `berserk` 与 `haste` 都有较强外缘细节，后续接入动画时应避免再叠加过多外侧 overlay，以免 1x1 读形过噪。
