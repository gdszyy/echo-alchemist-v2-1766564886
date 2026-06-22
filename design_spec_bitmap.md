# Echo Alchemist V2 - UI 与敌人位图化设计规格文档

本文档基于对 `echo-alchemist-v2` 现有代码库的深入分析，为后续的 UI 自动生成切图与敌人 Sprite 序列化提供精确的设计规格与实施指南。

## 1. 整体视觉风格定位

当前游戏采用了深色背景、高对比度发光（Glow/Neon）以及带有暗黑奇幻（Dark Fantasy）与炼金术（Alchemy）元素的视觉语言。代码中大量使用了 `slate-900`、`purple-500`、`emerald-400` 等 Tailwind 色彩，并配合 `Cinzel` 衬线字体与 `backdrop-blur` 毛玻璃效果。

**位图化风格建议：**
为了与现有的高对比度发光特效（如激光、爆炸、护盾网格）完美融合，建议采用 **「暗黑赛博炼金」** 或 **「高精度像素风（Hi-Res Pixel Art）」**。
- **UI 材质**：深色金属、黑曜石、暗紫/暗金镶边，带有微弱的自发光纹理。
- **敌人材质**：统一改为 **「几何磨石块基座 + 镶嵌核心」**。主体必须像经过切削和研磨的几何石块，带倒角、磨损边、矿脉和裂纹；机制核心嵌入石槽内部，发光只作为核心、裂缝和词条覆层的强调。详见 [`docs/design/enemy_geometric_whetstone_style.md`](docs/design/enemy_geometric_whetstone_style.md)。

---

## 2. UI 位图化切图清单

当前 UI 主要由 HTML/CSS DOM 构成。为了在保留 DOM 灵活性的同时提升视觉表现，建议采用 **「九宫格背景图（9-Slice） + 装饰性 Sprite」** 的混合方案。

### 2.1 核心面板与背景（建议 9-Slice 切图）

> 2026-06-23 补充：`#phase-combat` 进入战斗场地与 UI 重绘设计阶段。新一轮不以“补缺”为目标，而是统一战斗背景、墙体、防线、态势条、技能栏、符文充能与战斗图标的资产语言；执行设计、首轮概念清单、prompt 草案与性能边界见 [`docs/design/combat_battlefield_ui_asset_redesign.md`](docs/design/combat_battlefield_ui_asset_redesign.md)。

| 组件名称 | 对应 DOM 元素 | 尺寸建议 | 视觉描述 |
|---------|-------------|---------|---------|
| **顶部状态栏** | `#unified-top-bar` | 高度 52px，横向拉伸 | 暗色半透明金属底板，底部带有微弱的科技感刻线。 |
| **底部弹药栏** | `.bottom-panel` | 高度 80px，横向拉伸 | 带有凹槽设计的炼金操作台边缘，两侧有金属铆钉。 |
| **通用弹窗面板** | `#phase-rune-launcher`, `#phase-shop` | 最小 300x400 | 黑曜石质感底板，四周有暗金色或紫色的繁复炼金阵纹理边框。 |
| **卡片底板** | `.rune-card`, `.relic-card` | 120x160 | 带有不同稀有度（铁、铜、银、金、炫彩）镶边的金属卡牌底座。 |

### 2.2 独立装饰性图标（建议固定尺寸 Sprite）

| 组件名称 | 对应 DOM 元素 | 尺寸建议 | 视觉描述 |
|---------|-------------|---------|---------|
| **SP 宝石（空/满）** | `.sp-gem` | 24x24 | 空状态为暗淡的晶体凹槽；满状态为散发翠绿光芒的菱形宝石。 |
| **回合数胶囊** | `.round-pill` | 64x24 | 带有金属边框的椭圆指示器，内部数字区域发光。 |
| **弹药图标** | `.ammo-icon` | 32x32 | 各种属性（火、冰、雷、穿透等）的炼金法球，带有对应的元素光晕。 |
| **功能按钮** | `#settings-btn`, `#speed-btn` | 40x40 | 带有机械齿轮或炼金符号的圆形金属按钮，包含按下（Active）状态。 |

---

## 3. 敌人 Sprite 序列设计方案

当前敌人完全由 Canvas 2D 矢量绘制（`ctx.fillRect`, `ctx.arc` 等），通过复杂的数学公式计算呼吸、浮动、受击形变和状态特效。转换为 Sprite 序列后，需要将这些数学动画烘焙为帧动画。

### 3.1 敌人基础规格

游戏中的敌人基于网格系统，基础尺寸由 `enemyWidth` 和 `enemyHeight` 决定（通常为屏幕宽度的 1/6）。
- **基础尺寸**：建议基准切图尺寸为 **128x128 像素**（可根据实际屏幕缩放）。
- **锚点（Anchor）**：中心点 `(0.5, 0.5)`，因为现有代码中的坐标变换（`ctx.translate`）都是基于中心点进行的。

### 3.2 敌人类型与变体

根据 `enemy.js` 和 `config.js`，敌人分为三个主要层级，需要不同的 Sprite 复杂度：

| 敌人层级 | 视觉特征 | 动画帧需求 |
|---------|---------|-----------|
| **普通魔像 (Normal)** | 已重做：单格几何磨石块主体，外缘磨损石材即物理边界感；中心为嵌入式炼金核心，橙色裂缝和少量紫色符文只作强调。不使用独立 1×1 空心边框。 | 静态主体包装为 Sprite Sheet：待机 (Idle): 6帧<br>移动 (Move): 4帧<br>受击 (Hit): 2帧 |
| **精英魔像 (Elite)** | 更清晰的磨石切面和镶嵌核心，紫色只作为裂缝、边槽或核心光，不覆盖主体 silhouette。 | 待机 (Idle): 6-8帧<br>移动 (Move): 6帧<br>受击 (Hit): 3帧<br>施法 (Cast): 4帧 |
| **首领 (Boss)** | 多层几何磨石基座与多核心镶嵌体，体积更大，专属结构来自石槽、环壁、装甲梁或轨道石片。 | 待机 (Idle): 8-12帧<br>移动 (Move): 8帧<br>受击 (Hit): 4帧<br>特殊技能 (Skill): 8-10帧 |

### 3.3 Boss 专属形象清单

游戏内定义了 8 种独特的 Boss，需要为每种 Boss 设计专属的 Sprite 形象：

1. **伊格尼斯 (Ignis)**：熔炉守卫。特征：火焰、护盾、重型装甲。
2. **格拉西斯 (Glacies)**：霜晶缝合怪。特征：冰晶、跳跃、再生组织。
3. **米克罗 (Mikro)**：裂变母体。特征：雷电、多重分身、治疗光环。
4. **噬神者 (Devourer)**：贪婪之渊。特征：深渊巨口、吞噬、暗物质。
5. **维里迪斯 (Viridis)**：翠绿共生体（大 Boss）。特征：剧毒、植物藤蔓、强力再生。
6. **特斯拉 (Tesla)**：雷霆幻影（大 Boss）。特征：极速、雷电残影、机械核心。
7. **奇美拉 (Chimera)**：混沌融合体（大 Boss）。特征：多头/多核心、狂暴火焰、混沌能量。
8. **奥罗波罗斯 (Ouroboros)**：永恒回声（大 Boss）。特征：衔尾蛇形态、动态弱点、全属性轮转。

### 3.4 状态与特效叠加层 (Overlay)

为了保持灵活性，**不建议**将所有状态（如冰冻、燃烧）直接画死在基础 Sprite 中。建议采用 **「基础 Sprite + 状态特效层」** 的渲染方式：

> 2026-06-22 补充：奖励边框和词条 Overlay 必须拆层。当前敌人奖励美术只面向带遗物敌人的独立“金边”奖励框；`shield`、`regen`、`jump` 等词条只作为机制覆层或触发反馈，不承担掉落价值表达。详细规格见 [`docs/design/enemy_affix_visual_iteration_plan.md`](docs/design/enemy_affix_visual_iteration_plan.md)。

> 2026-06-22 补充：Boss 破绽视觉先按透明 PNG Overlay 接入，不替换 Boss 基础 Sprite。统一使用 `384 × 256`、中心锚点 `(192, 128)`、`assets/sprites/enemies/bosses/<bossId>/vulnerability/` 目录与 `vuln_25/50/75/break/exposed/recover/weak_mask` 命名；完整契约与 Ignis 样板 Prompt 见 [`docs/boss_vulnerability_asset_contract.md`](docs/boss_vulnerability_asset_contract.md)。

> 2026-06-22 补充：Boss 本体也进入重绘契约。现有 `assets/sprites/bosses/boss_<bossId>.png/.json` 的 `256 × 256` 方形帧仍视为 legacy 可运行资源；新重绘目标为 `384 × 256` 横向帧，JSON 必须声明 `frameWidth/frameHeight`，渲染器会按 3×2 占格绘制。完整规格见 [`docs/boss_sprite_redraw_asset_contract.md`](docs/boss_sprite_redraw_asset_contract.md)。
> 2026-06-23 补充：Boss 重绘必须贴合物理碰撞外轮廓。8 个 Boss 当前运行时 `collisionShape/collisionData` 已整理为 `assets/sprites/bosses/redraw_drafts/boss_collision_guides_v2_no_three_rings_384x256.png`，后续生成基础本体和破绽 Overlay 时都要以该图作为外轮廓验收参考，避免视觉主体与弹珠反弹/命中范围偏差过大。当前只有最终 Boss `ouroboros` 使用完整闭合环来承载 6 个附体槽；`mikro` 与 `devourer` 已改为实体 polygon，不再按环形 Boss 生成。旧同名图已归档到 `assets/sprites/bosses/redraw_drafts/archive/`，不要继续引用。

> 2026-06-22 补充：敌人针对词缀进入生成前资产契约。`carrier` 显示名固定为“铸巢母架”，第 5 格空舱必须在 Sprite、collision frame 与头像中可见；`livingArmor` 需要普通/叠加强化各三档状态资产；完整清单见 [`docs/enemy_targeting_asset_todo.md`](docs/enemy_targeting_asset_todo.md)。

- **血量显示**：保留现有的 Canvas 绘制逻辑（液体血条 + 绿色回血条 + 白色延迟条），将其作为 Overlay 盖在 Sprite 上方。
- **战损裂纹**：当血量低于 30% 时，在 Sprite 上方叠加一层半透明的「裂纹」PNG，或者使用 Shader/混合模式处理。
- **温度状态**：
  - **过热 (Temp > 60)**：叠加橙红色发光层（`globalCompositeOperation = 'lighter'`）。
  - **过冷 (Temp < -30)**：叠加冰霜雾气层（`globalCompositeOperation = 'screen'`）。
- **词缀特效**：如护盾的六边形网格、再生的绿色波纹，建议保留现有的 Canvas 矢量绘制，或者提供单独的特效 Sprite 序列进行叠加。

---

## 4. 实施路径建议

1. **UI 改造**：先从静态 UI（如卡片底板、顶部状态栏）开始，使用 CSS `border-image` 或 `background-image` 替换现有的纯色背景。
2. **敌人框架**：在 `enemy.js` 中引入 `SpriteRenderer` 类，接管 `draw()` 函数中的基础形体绘制部分（Layer 1），但保留血条（Layer 2）和特效（Layer 3/4）的绘制逻辑。
3. **资源生产**：根据上述清单，使用 AI 图像生成工具（或美术手绘）批量生成 128x128 的基础魔像 Sprite Sheet，并进行测试。
4. **Boss 定制**：最后为 8 个 Boss 逐一替换专属的高精度 Sprite 序列。
