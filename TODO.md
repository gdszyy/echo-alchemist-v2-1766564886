# Echo Alchemist V2 改造工程 TODO 清单

**最后更新：** 2026年6月30日

**状态词口径：** `done` / `placeholder` / `contract-only` / `debt`。
**当前药剂线 done：** C1 中断与覆盖边界、C4 spellContent 解析、C6 多节点嵌套 UI、Root Orb carrier、Tower 基础系统（阻挡/承伤/范围/冷却/生命周期/互斥/非法树拒绝）、共享嵌套校验、C8 炼金台 runtime fallback 资产 polish。
**当前药剂线 contract-only：** 静态药剂 metadata 与 VFX dispatcher。
**当前药剂线 debt：** Tower 专用资产与长期平衡、正式 PNG/chroma 美术替换。

> 当前完整优化 TODO、已完成项、下一轮 P0/P1/P2 优先级与验收清单见 [`docs/p0_interaction_optimization_todo.md`](docs/p0_interaction_optimization_todo.md)。该文档承接“先打磨现有机制、修 bug、再考虑减法”的最新执行优先级。

---

## 2026-06-30 任务收尾与 Git 清洁规范入口

为避免后续 Codex 任务遗留大量未归属 modified / untracked 文件，项目规范已新增任务收尾硬闸门：

- [`AGENTS.md`](AGENTS.md) 第 2.6 节：每个任务结束前必须检查 `git status --short --branch`，文本修改后执行 `git diff --check`，并在总结中说明工作区状态。
- [`.cursor/rules/global.md`](.cursor/rules/global.md) 第 8 节：所有变脏路径必须归属为交付物、生成索引、运行时资产、归档资料或临时产物，不得静默遗留。
- [`.cursor/rules/process_insights/PI-012_task_closeout_git_hygiene.md`](.cursor/rules/process_insights/PI-012_task_closeout_git_hygiene.md)：记录仓库变脏的常见原因、命名 stash 保护方式、LF/CRLF 噪音处理和禁止误删用户成果的 SOP。

---

## 2026-06-27 药剂炼成机制整理入口

当前药剂机制的权威规则、工程现状、差距和分期计划已集中到以下文档：

- [`docs/rune_potion_spell_contract.md`](docs/rune_potion_spell_contract.md)：机制权威口径，定义“符文组合 = 法术内容，法阵 = 形态 + 嵌套合约”。
- [`docs/potion_alchemy_development_plan.md`](docs/potion_alchemy_development_plan.md)：当前代码现状、差距、P0-P5 路线图、文件影响范围与验收闸门。
- [`docs/spell_vfx_design.md`](docs/spell_vfx_design.md)：法阵形态 VFX 规格与 `combat_playSpellFormVFX()` 表现层要求。

近期 Codex 执行批次：

| 批次 | 任务 | 状态 |
| :--- | :--- | :--- |
| C1 | 中断与覆盖边界：关闭炼金台、切 Tab、进入战斗、刷新恢复时，已投入符文不返还且草稿状态可解释 | done：统一中断入口与静态契约已覆盖 |
| C2 | 法阵选择第一版：用按钮/分段控件选择 `bottle`、`orb`、`beam`、`meteor`、`tower`，不先做手绘识别 | done：`#potion-form-controls` 写入草稿形态 |
| C3 | 法阵合法性表：扩展 `_potionAlchemyDraft` 记录 `formId`、`nestingMode`、`slotType`，并校验 parent/slot/child/form/type/mode | done：`src/potion_nesting.js` 统一供 UI、封装、战斗、测试使用 |
| C4 | `spellContent` 解析：从元素宽松匹配迁移到 `RUNEWORD_DB` 的隐藏法术内容 | done：`src/potion_spell_content.js` 解析 3 符文隐藏节点，炼金台封装前仍只显示黑箱稳定性 |
| C5 | `spellTree` 存档：将 `preparedPotionSpell` 从静态 `potionId` 兼容字段升级为可持久化树结构 | done：封装结果保留 `potionId` 兼容字段并保存 root `spellTree` |
| C6 | 多节点嵌套 UI：继续投料生成新隐藏节点，合法父子查表接入 root.children，非法嵌套整炉坍塌且不返符文 | done：`src/ui/rune_launcher.js` 维护 `consumedRunes` 总账、`pendingRunes` 当前节点与 `root.children`；`tests/validate_potion_c6_nesting_ui.mjs` 覆盖合法接入、非法坍塌、失败返还和黑箱预览 |
| C7 | 战斗 `spellTree` 释放：Root Orb carrier、Tower 基础系统、旧药剂内容结算兼容 | done：`combat_updatePotionRuntime()` 驱动 carrier/tower，Tower 已覆盖阻挡/承伤、范围/冷却、生命周期、互斥和非法树拒绝；debt：Tower 专用资产与长期平衡 |
| C8 | 资产与体验 polish：炼金炉、法阵稳定/排斥、坍塌、药瓶槽、未知稳定节点 | done：runtime SVG fallback 与 CSS 状态层已接入，封装前仍只显示黑箱稳定性；debt：后续正式 PNG/chroma 美术替换 |

---

## 阶段一：基础设施与知识库搭建 ✅ 全部完成

- [x] **Task 1.1** 初始化 Git 知识库目录结构 ✅ 已验收 (commit bfcbf28)
- [x] **Task 1.2** 提取并归档历史文档（23个任务 + 4个模块规范 MD）✅ 已验收
- [x] **Task 1.3** 开发统一开发者 Skill（echo-developer）✅ 已验收

---

## 阶段二：核心模块物理拆分 ✅ 全部完成

| 任务 | 关键交付物 | 结果 |
| :--- | :--- | :--- |
| Task 2.1 entities.js 工具/特效 | `math_utils.js`(170行) + `particles.js`(781行) | ✅ 已验收 |
| Task 2.2 entities.js 核心实体 | `enemy.js`(1321行) + `projectile.js`(784行)，entities.js 降至 3245 行 | ✅ 已验收 |
| Task 2.3 combat_system.js 拆分 | `damage_calc.js`(273行) + `collision.js`(172行) | ✅ 已验收 |
| Task 2.4 ui_system.js 拆分 | `hud.js`(690行) + `shop.js`(328行) + `rune_launcher.js`(615行) | ✅ 已验收 |

**阶段二成果：** entities.js 从 6141 行降至 3245 行（降幅 47%），ui_system.js 从 ~2021 行降至 519 行（降幅 74%）。

---

## 阶段三：架构解耦与通信重构 ✅ 全部完成

- [x] **Task 3.1** 完善 EventBus + 定义标准事件字典 ✅ 已验收
  - 16 个标准事件（三段式命名），覆盖 119 处 TODO[Task 3.2] 标记
  - event_bus.js 新增 EVENT_TYPES 常量、调试模式、错误隔离

- [x] **Task 3.2** 消除 UI 层与业务层的强耦合 ✅ 已验收（commit 2d8b226）
  - combat_system.js 新增 11 处 eventBus.emit，hud.js 注册 8 个监听器
  - 所有 TODO[Task 3.2] 标记已清零（119 → 0）

- [x] **Task 3.3** 移除 `Object.assign` Mixin 模式 ✅ 已验收（PR #48 已合并）
  - core.js 末尾的 Object.assign(Game.prototype, ...) 已完全移除
  - 改为构造函数中 bind(this) 组合模式，10 个子系统全部迁移
  - global.md 新增第 5 节「子系统扩展规范」，明确禁止 Mixin 模式

---

## 阶段四：掉落驱动主流程闭环与抽象收尾 ⏳ 进行中

当前仓库已经补上了 **round-start reward queue**、**非 Boss 掉落驱动**、**混沌精华 / 纯净精华命运时刻**、**纯净精华 x2 同化率**、**存档恢复上下文** 等核心闭环，但内部仍存在一层尚未彻底抽离的旧语义：特殊流程在实现层仍大量复用 `selection` 阶段和历史入口。这一抽象工作并不是“代码美化”，而是为了避免后续继续在 UI、教程、暂停、存档、overlay 返回流中到处追加 `if (selectionMode === ...)` 之类的分支，最终重新形成新的隐性耦合。

| 任务 | 必要性 | 计划内容 | 当前状态 |
| :--- | :--- | :--- | :--- |
| Task 4.1 命运时刻阶段语义抽象 | 目前 `selection` 仍同时承载常规选择与命运时刻，阶段语义不够单一，后续维护成本高 | 统一梳理 `phase`、标题、教程、暂停、overlay 返回、顶部栏标签中的命运时刻语义，明确哪些继续复用 `selection` overlay，哪些上升为 `fate_moment` 语义层 | ⏳ 待检查后拆分 |
| Task 4.2 选择态与命运时刻状态模型收口 | 目前 `selectionMode`、`pendingSelectionMode`、`fateMomentContext`、`selectionPreviewState` 已可用，但职责边界仍需进一步收敛 | 明确“待触发上下文”“运行中上下文”“UI 预览态”“overlay 返回态”的边界，避免后续继续散落到多个模块各自判断 | ⏳ 待检查后收口 |
| Task 4.3 round-start resolver 与阶段切换契约固化 | 当前主流程已通，但仍需确认所有恢复入口、关闭入口、失败回退入口都不会重新跳回旧固定流程 | 系统检查 `sys_startRoundStartResolver()`、`ui_closeRelicSelection()`、继续游戏、教程等待点、暂停限制、游戏结束清档等链路 | ⏳ 正在检查 |
| Task 4.4 TODO / 文档 / 测试清单同步 | 旧 TODO 已显示“全部完成”，不再反映当前修复与抽象工作的真实状态 | 持续把新增闭环、抽象必要性、验证范围和待办项回写到 TODO 与规则文档，并补测试检查清单 | ⏳ 进行中 |

### 阶段四检查记录（持续更新）

| 日期 | 检查点 | 发现 | 结论 |
| :--- | :--- | :--- | :--- |
| 2026-04-18 | 顶部栏与阶段语义一致性 | 已新增 `ui_isFateMomentPhase()`，并让 `ui_updateUI()`、阶段标题、顶部短标签统一通过该语义判断控制显示；命运时刻期间不再被 `selection` 的旧隐藏规则整体吞掉 | 该项已完成第一轮抽象收口，后续仅需视是否正式引入 `fate_moment` phase 再做深化 |
| 2026-04-18 | 教程系统与命运时刻兼容性 | 教程进入弹珠选择的等待条件已补上“非命运时刻”过滤，避免 `PHASE_CHANGED -> selection` 在命运时刻期间误推进旧教程 | 主要误触发风险已收口，但 `phase: 'selection'` / `targetId: 'phase-selection'` 仍是后续深化抽象时的关注点 |
| 2026-04-18 | 遗物 overlay 返回 resolver 链路 | `ui_closeRelicSelection()` 已能在 `returnState.phase === 'round_start_resolver'` 时回到 `sys_continueRoundStartResolver()`，在 `returnState.phase === 'selection'` 时恢复当前命运时刻界面 | 该链路当前已基本闭环，属于已验证通过项 |
| 2026-04-18 | 继续游戏 / 新开局 / 游戏结束入口 | `sys_loadRunState()` 会先判断存档是否来自 `selection` / 命运时刻；若是则恢复候选卡片、已选索引、注入符文和预览 UI，只有普通回合恢复才进入 `sys_startRoundStartResolver()`；`meta_startRun()` 与 `_gameover_triggerPhase()` 仍会先清除局内存档，再进入新局或结算 | 继续游戏不再把命运时刻误落回 resolver；静态契约已覆盖 |

## 改造工程总结

| 指标 | 改造前 | 改造后 | 变化 |
| :--- | :--- | :--- | :--- |
| entities.js 行数 | 6,141 行 | 3,245 行 | **-47%** |
| ui_system.js 行数 | ~2,021 行 | 519 行 | **-74%** |
| 最大单文件 Token 估算 | ~63,000 | ~33,000 | **-48%** |
| 模块规范文档 | 0 个 | 9 个 | +9 |
| 标准事件类型 | 0 个 | 26 个 | +26 |
| Game.prototype 方法来源 | Mixin（全局污染） | bind 组合（实例隔离） | 架构升级 |



## 阶段五：位图化视觉重构 🎨 规划中

> 将现有纯矢量/CSS 绘制的 UI 与敌人，逐步替换为自动生成的位图（9-Slice 切图 + Sprite Sheet），在不破坏现有动态特效逻辑的前提下大幅提升视觉表现力。
> 完整设计规格见 [`design_spec_bitmap.md`](./design_spec_bitmap.md)。
> 具体生成规范见 [`docs/art_asset_generation_guidelines.md`](docs/art_asset_generation_guidelines.md)，用于约束场景、效果、材质、透明管线、Prompt 模板与验收标准。
> 当前资产缺口、覆盖状态与生成排期见 [`docs/asset_gap_index.md`](docs/asset_gap_index.md)。该索引是后续生成 UI、ICON、Toast、遗物图标与敌人重绘 pass 的执行入口。

### Phase 5 当前资产生成优先级（2026-06-25）

| 优先级 | 内容 | 当前状态 | 下一步 |
| :--- | :--- | :--- | :--- |
| P0 | 遗物图标缺口 | `RELIC_DB` 44 个中 14 个仍走 emoji fallback；本轮已生成 6 个 P0 遗物图标；符文/弹药/属性图标已覆盖 | 继续分批生成 `assets/icons/relic/<id>.png` 并写入 `RELIC_ICON_MAP` |
| P0 | 暂停菜单与首页首屏 | `#phase-pause` 完全缺位图；首页缺标题徽章与开始按钮底板 | 生成 `pause_menu_bg.png`、`pause_menu_btn_9s.png`、`title_badge.png`、`start_btn_metal.png` |
| P0 | 设置弹窗收口 | 面板与 toggle 已有，滑条与关闭按钮缺 Sprite | 生成 `slider_track.png`、`slider_thumb.png`、`modal_close_btn.png` |
| P1 | 回合 Toast 状态化二批 | Pass 1 已有标题牌、威胁槽与 Boss 小像；状态横幅与高危边框仍缺 | 按 `round_start_boss_toast_asset_contract.md` 生成 `round_toast_*`、danger plate、danger frame |
| P1 | Meta / Shop / Gathering 中频页面 | 背景与卡片部分覆盖，分类/货币/价格/钉盘外框缺 | 补 Tab、SP 货币、价格标签、钉盘外框 |
| P2 | 图鉴 / 结算 / 数据页 / Runeword | 低频页面仍有 CSS fallback | 生成真理之书侧标、统计卡片、数据徽章、Runeword 图标 |

### Phase 5.0：核心页面体验重设与流程优化 🧭 新增记录

> 目标：在继续补素材之前，先固定核心页面的体验场景、视觉层级和模块流程边界，避免美术资产零散接入后仍然缺少统一页面语言。

| 优先级 | 页面 / 场景 | 后续优化重点 | 当前状态 |
| :--- | :--- | :--- | :--- |
| P0 | 战斗主界面（`#phase-combat`） | 明确战场、敌人、发射器、技能栏、符文充能、伤害反馈的首屏层级；作为全局美术基调锚点；战斗场地与 UI 重绘设计见 `docs/design/combat_battlefield_ui_asset_redesign.md` | 🟡 背景 V2 保留；墙体/HUD/V4 发射器已撤回，等待绿幕源图重做 |
| P0 | 敌人视觉系统（战斗碰撞边界 / 基底 / 状态 Overlay） | 将敌人从战斗 UI 中单独拆出设计，明确可反弹物理边界、多格占位、血条、护盾、温度、词缀与 Boss 层级 | 🎨 概念图待定稿 |
| P0 | 钉板收集 / 配置编辑态（`#phase-gathering` + `#module-editor-layer`） | 区分钉盘运行态与编辑态，梳理 4×3 模块槽、模块选择浮层、符文融合、开始采集的编辑流程；后续应补入 UI 素材清单 | 🎨 概念图待定稿 |
| P0 | 弹珠选择 / 命运时刻（`#phase-selection`） | 区分常规弹珠选择、子弹替换、混沌/纯净精华命运时刻的视觉状态与操作动线 | 🎨 概念图待定稿 |
| P1 | 符文发射器（`#phase-rune-launcher`） | 统一配置、管理、词条图鉴三个 Tab 的信息架构，并与钉板符文融合流程建立清晰关联 | ⬜ 待梳理 |
| P1 | 遗物 / 商店 / 真理之书 | 固定奖励、购买、图鉴三个系统页的共同面板语言和卡片语法 | ⬜ 待梳理 |

### Phase A：UI 静态装饰层替换（无交互风险，优先启动）

> 目标：用位图替换纯色/纯 CSS 的装饰性背景，保留所有 DOM 结构与事件逻辑不变。

| 任务 | 内容 | 状态 |
| :--- | :--- | :--- |
| **Task 5.A1** 生成 UI 基础素材集 | 使用 AI 生成顶部状态栏底板、底部弹药栏底板、通用弹窗面板底板（9-Slice 规格 128px 边距）；暗色金属 + 炼金阵纹边框风格 | ⬜ 待开始 |
| **Task 5.A2** 接入顶部状态栏位图 | 将 `#unified-top-bar` 的 `background` 替换为 9-Slice PNG；验证在不同屏幕宽度下拉伸正常 | ⬜ 待开始 |
| **Task 5.A3** 接入弹窗/卡片面板位图 | 将 `.rune-card`、`.relic-card`、`#phase-rune-launcher` 等面板替换为对应稀有度（铁/铜/银/金/炫彩）的 9-Slice 边框图 | ⬜ 待开始 |
| **Task 5.A4** 接入 SP 宝石与功能按钮图标 | 替换 `.sp-gem`（空/满两态）、`#settings-btn`、`#speed-btn` 为固定尺寸 Sprite；保留 JS 状态切换逻辑 | ⬜ 待开始 |
| **Task 5.A5** 接入弹药属性图标 | 为 laser / explosive / pyro / cryo / lightning / pierce / bounce / scatter 8 种属性各生成 32x32 炼金法球图标，替换 `hud.js → ui_renderAmmoIcon()` 中的纯色圆形 | ⬜ 待开始 |
| **Task 5.A6** 生成符文图标集 | 为 RUNE_DB 中 14 种基础符文（rune_pyro_1/2、rune_cryo_1/2、rune_lightning_1/2、rune_bounce_1/2、rune_pierce_1/2、rune_scatter_1、rune_laser_1/2）各生成专属 48x48 位图图标，替换 `_ui_buildRuneIconHTML()` 中的 emoji；图标需体现元素属性（火/冰/雷/弹/穿/散/激光）与稀有度（common/epic/rare/legendary）的视觉差异 | ⬜ 待开始 |
| **Task 5.A7** 生成遗物图标集 | 为 config.js 中 39 种遗物各生成 64x64 位图图标，替换 `shop.js → relic-icon` 与遗物选择界面中的 emoji；图标需体现遗物效果语义（如「力场护盾」→ 六边形护盾纹章，「时光沙漏」→ 炼金沙漏），并通过边框颜色区分稀有度（common/rare/legendary/cursed） | ⬜ 待开始 |
| **Task 5.A8** 生成符文词条（Runeword）图标集 | 为 RUNEWORD_DB 中 22 种词条各生成 64x64 专属图标，用于图鉴已发现卡片的图标位置（当前为 🔒 占位）；图标需体现词条效果语义（如「熔毁」→ 熔岩裂纹，「绝对零度」→ 冰晶封印），并与组成该词条的符文元素色调一致 | ⬜ 待开始 |

### Phase B：敌人 Sprite 框架搭建（需要美术资源，独立于 Phase A）

> 目标：在 `enemy.js` 中引入 `SpriteRenderer`，接管基础形体绘制（Layer 1），保留血条（Layer 2）与词缀特效（Layer 3/4）的现有 Canvas 逻辑。

| 任务 | 内容 | 状态 |
| :--- | :--- | :--- |
| **Task 5.B1** 生成普通魔像基础 Sprite Sheet | 生成 128x128 基准尺寸的普通魔像 Sprite Sheet：待机 6 帧 + 移动 4 帧 + 受击 2 帧；暗黑赛博炼金风格，几何体外壳包覆发光核心 | ⬜ 待开始 |
| **Task 5.B2** 实现 `SpriteRenderer` 模块 | 新建 `src/render/sprite_renderer.js`；提供 `load(sheet, meta)`、`play(anim)`、`draw(ctx, x, y, w, h)` 接口；按 `enemy.type` 和 `actionPhase` 自动切换动画状态 | ⬜ 待开始 |
| **Task 5.B3** 在 `enemy.js` 中接入 `SpriteRenderer` | 在 `draw()` 的 Layer 1（基础形体）处调用 `SpriteRenderer.draw()`，以 `this.type` 为 key 查找对应 Sprite；无 Sprite 时 fallback 到现有矢量绘制 | ⬜ 待开始 |
| **Task 5.B4** 生成精英魔像 Sprite Sheet | 在普通魔像基础上增加紫色晶化变异装饰；待机 8 帧 + 移动 6 帧 + 受击 3 帧 + 施法 4 帧 | ⬜ 待开始 |
| **Task 5.B5** 验证血条 + 词缀特效 Overlay 兼容性 | 确认 Layer 2（液体血条）、Layer 3（温度/词缀特效）、Layer 4（裂纹）在 Sprite 替换后仍能正确叠加显示 | ⬜ 待开始 |

### Phase C：Boss 专属 Sprite（依赖 Phase B 完成）

> 目标：为 8 种 Boss 各自生成专属的高精度 Sprite 序列，替换现有的 `_drawBossDecoration()` 矢量装饰。

| 任务 | Boss | 核心视觉特征 | 状态 |
| :--- | :--- | :--- | :--- |
| **Task 5.C1** | 伊格尼斯 (Ignis) | 熔炉重型装甲 + 护盾格栅 + 火焰喷口 | ⬜ 待开始 |
| **Task 5.C2** | 格拉西斯 (Glacies) | 霜晶缝合体 + 冰刺外壳 + 跳跃弹簧腿 | ⬜ 待开始 |
| **Task 5.C3** | 米克罗 (Mikro) | 雷电核心 + 多触手分裂体 + 治疗光环 | ⬜ 待开始 |
| **Task 5.C4** | 噬神者 (Devourer) | 深渊巨口 + 暗物质漩涡 + 吞噬触手 | ⬜ 待开始 |
| **Task 5.C5** | 维里迪斯 (Viridis) | 剧毒植物藤蔓 + 共生体寄生外壳 | ⬜ 待开始 |
| **Task 5.C6** | 特斯拉 (Tesla) | 机械核心 + 雷电残影 + 极速轨迹 | ⬜ 待开始 |
| **Task 5.C7** | 奇美拉 (Chimera) | 多核心融合体 + 混沌火焰 + 狂暴裂变 | ⬜ 待开始 |
| **Task 5.C8** | 奥罗波罗斯 (Ouroboros) | 衔尾蛇环形体 + 全属性轮转光环 | ⬜ 待开始 |

### 阶段五依赖关系

```
Phase A（UI 静态层）  ─── 独立，可立即启动
                             ↓
Phase B（敌人框架）  ─── 需要美术资源，B1 完成后才能推进 B2/B3
                             ↓
Phase C（Boss 专属）─── 依赖 Phase B 框架完成
```

---

## 维护与修复记录 (2026.04.12) ✅

- [x] **BugFix 4.1** 生产环境 UI 崩溃修复 ✅
  - 修复了 `systems.js` 和 `shop.js` 在缺失 DOM 元素时的脚本中断问题。
  - 统一了商店购买接口 `meta_buyUpgrade` 的命名与参数传递。
  - 补全了 `systems.js` 中 `UIManager`、`TruthBook`、`TrainingGround` 的空值防御。
- [x] **BugFix 4.2** 修复 `src/ui_system.js` 语法错误 ✅
  - 修复了 `src/ui_system.js` 因缺失闭合括号 `};` 导致的 `Uncaught SyntaxError: Unexpected end of input`。
  - 验证了项目中所有 `.js` 文件的语法完整性。
## 2026-06-18 P0 Interaction Pass

- [x] `局内商人`：改为第 3 回合固定首访、后续按 3..当前回合数随机等待、每次停留 2 回合；底部 UI 显示到访/离开倒计时，首访提供免费临时援助包占位（基础伤害临时持续 2 回合）。
- [x] `#phase-selection` / 子弹替换：补齐禁用确认原因、已选数量提示、键盘选择和护盾状态可见性。
- [x] `#phase-gathering` / `#module-editor-layer`：模块选择浮层现在会提前禁用不可放置模块并显示原因；应用模块前先校验再修改布局，避免误点非法大模块导致原模块被清空。
- [x] `#phase-combat`：新增战斗态势条，聚合防线危险、敌人/精英/Boss 数量、护盾层数、弹药余量与下一发弹药。
- [x] 敌人视觉状态：大体型/特殊形状/Boss 增加足迹描边与占格分隔线；护盾、屏障、狂暴、毒素、温度以短标签聚合显示。
- [x] 敌人威胁层级：Boss、精英和大型基底新增左上角短标签，和右上角状态标签分离。
- [x] 命中语义反馈：伤害数字旁新增屏障、护盾、暴击、克制、有效、弹射、穿透短标签，帮助玩家理解本次命中收益。
- [x] 大型基底专属外形：V2 基底轮廓美术已接入性能降级，low 档关闭 `screen` / 径向渐变但保留身份线面。
- [x] 发射器下一发可读性：Canvas 发射器改为扇形弹丸展示散射、能量条展示连射、装填格展示属性构成；HUD/态势条同步显示主属性、散射弹数与连射次数。
- [x] 技能栏层级：战斗技能栏改为紧凑两列工具组，显示当前 SP、技能成本、可用状态和禁用原因，减少首屏遮挡。
- [x] 阶段残留首轮收口：`ui_updateUI()` 离开 combat 后统一清理战斗态势外的配方 HUD、技能栏、伤害数字、符文充能和伤害统计抽屉；训练场仅保留态势面板。
- [x] 暂停/放弃本局收口：暂停页现在真正冻结/恢复主循环；放弃本局统一清局内存档、运行态和临时 UI 后返回 meta。
- [x] PC 侧栏残留收口：左右侧栏只在 gathering/combat/selection/training 显示，meta/shop/gameover 等阶段不保留常驻符文发射器或战斗侧栏。
- [x] Gameover/meta 高层浮层收口：Boss 入场、混沌轮盘、遗物层、符文选择器、模块编辑器和终局 Toast 在结算/回首页/局外阶段主动清理。
- [x] 大型基底预设波次首轮接入：新增 `src/wave_presets.js`，生成行优先尝试首批 V2 大型基底导演镜头，失败回退旧随机大型基底。
- [x] 大型基底训练场入口：`enemy_v2` 分类新增 `ev2_wave_preset_spawn`，固定 Round 12 调用真实 preset 生成入口，便于后续调参复现。
- [x] 大型基底 preset 静态校验：新增 `tests/validate_wave_presets.mjs`，检查 preset ID、尺寸/词条匹配、lane 放置、越界/重叠和单 preset 大型数量上限。
- [x] 大型基底运行期生成模拟：新增 `tests/validate_enemy_spawn_runtime.mjs`，覆盖 preset 与旧随机大型基底回退路径，验证同屏上限、`gravityWell` 互斥、碰撞足迹和网格尺寸。
- [x] 大型基底足迹契约校验：运行期脚本逐类验证 8 种 V2 基底的占格元数据、实际尺寸、专属词条、碰撞形状和关键初始化。
- [x] 阶段/命运时刻静态契约校验：新增 `tests/validate_phase_contracts.mjs`，锁定 HUD 清理、terminal overlay 清理、暂停放弃统一入口、gameover 清浮层、命运时刻 active 标记、round-start relic 返回目标与继续游戏 selection 恢复。
- [x] Overlay 浏览器回归套件：`tests/ai_test_runner.js` 新增 `--suite overlay`，覆盖符文发射器、遗物选择、真理之书、商店遗物选择与 round-start resolver 的真实打开/关闭返回链路。
- [x] 真理之书返回语义收口：从命运时刻打开真理之书时记录并恢复原 `selectionMode` / `fateMomentContext`；从局外入口打开仍默认回 meta。
- [x] 继续游戏恢复收口：`sys_saveRunState()` 已持久化 `phase`、`marblesPool`、`selectedMarbles`；`sys_loadRunState()` 对命运时刻/selection 存档优先恢复卡片 DOM、已选状态、注入符文与预览，避免落回 round-start resolver。
- [x] 钉板编辑闭环浏览器脚本：`tests/ai_test_runner.js --suite pinboard` 覆盖编辑器打开、无效开始采集阻塞、模块禁用原因、符文融合预览/确认、有效开始采集关闭编辑器。
- [ ] 下一步 P1：把钉板符文融合结果与发射器可用词条建立明确反馈链，并复查移动端长列表/底部安全区。

---

## 阶段六：PixiJS 渲染管线迁移 🚀 规划中

> 将粒子系统和特效对象的渲染从 Canvas 2D 渐进迁移至 PixiJS (WebGL)，彻底解决 `shadowBlur` / `createRadialGradient` / `lighter` 混合模式的 API 级性能天花板。
> 完整迁移计划、33 个子任务与 36 条验收标准见 [`docs/pixijs_migration_todo.md`](docs/pixijs_migration_todo.md)。

| 阶段 | 目标 | 状态 |
| :--- | :--- | :--- |
| **阶段一** PixiJS 基础设施 | 引入 PixiJS 依赖、创建 overlay canvas、建立 Bridge 层 | ⬜ 待开始 |
| **阶段二** 粒子系统迁移 | 6 种粒子模式迁移到 `ParticleContainer`，GPU 批渲染 | ⬜ 待开始 |
| **阶段三** 特效对象迁移 | 15 种特效类迁移到 `Container + Sprite + Filter` | ⬜ 待开始 |
| **阶段四** 性能验证与调优 | 压测场景帧率基准、内存/GC 对比、移动端真机验证 | ⬜ 待开始 |
| **阶段五** 文档收尾 | 更新 performance.md / perf-optimization-index.md / 流程洞察 | ⬜ 待开始 |

**预期收益**：桌面 high 档同场景 avgFps 提升 ≥ 40%；GC 频率从 ~8-15 次/5分钟降至 ≤ 2 次。

---

## 阶段七：元素视觉重做 ✨ Phase 1 已完成

> 让 11 种元素属性在战斗中拥有"一眼可辨"的视觉身份，充分利用 PixiJS WebGL 管线。
> 完整设计方案见 [`docs/element_visual_redesign.md`](docs/element_visual_redesign.md)。
> PIXI Filter 基础设施已就绪：[`src/render/pixi_filter_manager.js`](src/render/pixi_filter_manager.js)。

### 已完成 — Phase 1：持续效果类基础

| 交付物 | 文件 | 状态 |
| :--- | :--- | :--- |
| ElectrocuteEffect 类 + 适配器 | particles.js + pixi_effect_adapter.js | ✅ |
| VenomEffect 类 + 适配器 | particles.js + pixi_effect_adapter.js | ✅ |
| WindMarkEffect 类 + 适配器 | particles.js + pixi_effect_adapter.js | ✅ |
| 6 张预烘焙元素纹理 | pixi_bridge.js | ✅ |
| enemy.js 全生命周期接入 | enemy.js | ✅ |
| combat_system.js 命中 Hook × 3 | combat_system.js | ✅ |
| PIXI Filter 管理器 | pixi_filter_manager.js (新建) | ✅ |
| entities.js re-export 桥接 | entities.js | ✅ |

### Phase 2：弹体与命中增强（1-2 轮）⬜ 待开始

| # | 任务 | 涉及文件 | 优先级 |
| :--- | :--- | :--- | :--- |
| 2.1 | **Pyro 微调**：BurnEffect 共鸣时弧线 6→8、色温升高；三阶共鸣地面灼烧印记；ember_fuse 增加小型 FireWave 扩散环 | particles.js / pixi_effect_adapter.js | P1 |
| 2.2 | **Cryo 微调**：冰封壳施加 ColorMatrixFilter 冷蓝偏移；共鸣时冰裂纹→六角雪花；三阶共鸣冰棱锥体 | enemy.js / pixi_filter_manager.js | P1 |
| 2.3 | **Lightning 弹体增强**：共鸣时弧数量 +2、全白闪光概率 20%→40%；三阶链式闪电分叉树状 | projectile.js / particles.js | P1 |
| 2.4 | **Venom 命中增强**：命中粒子数 1-4→2-6、尺寸 +20%；共鸣时粒子变为向上毒泡 | combat_system.js | P1 |
| 2.5 | **Wind 弹体增强**：月牙轨道半径随 wind 层数扩大；共鸣时风刃变双刃交错 60° | projectile.js | P1 |
| 2.6 | **Laser 命中灼点**：命中留下 0.5s 灼烧光点（复用 muzzleCore 纹理）；三阶共鸣十字准星 | particles.js / pixi_effect_adapter.js | P2 |
| 2.7 | **Bounce 重做**：弹跳动能弧线（贝塞尔 + 2 层 glow）+ 弹跳计数标记；三阶双螺旋 + 绿色 Shockwave | particles.js / combat_system.js | P0 |
| 2.8 | **Pierce 增强**：穿透路径红色裂痕线连接被穿透敌人（1s 衰减）；三阶 PierceCutEffect ×1.5 | particles.js | P2 |
| 2.9 | **Scatter 重做**：星爆标记（4-6 条辐射线 + spark）；三阶金色残影 | particles.js / combat_system.js | P0 |
| 2.10 | **Overcharge 增强**：弹体脉冲电场（5%概率电弧）；双环爆炸（二级冲击波延迟 100ms）；三阶全屏闪光 | particles.js | P1 |
| 2.11 | **Echo 重做**：扩散声波波纹（3 圈同心圆依次扩散）；幽灵弹蓝色残影；三阶声波特效 | particles.js | P0 |

### Phase 3：共鸣全局视觉（1 轮）⬜ 待开始

| # | 任务 | 涉及文件 | 优先级 |
| :--- | :--- | :--- | :--- |
| 3.1 | **共鸣脉冲基础设施**：在 `_effectContainer` 顶层创建全屏 Sprite/Graphics，监听 `resonance:activated` EventBus 事件 | pixi_bridge.js / event_bus.js | P1 |
| 3.2 | **6 元素专属脉冲**：pyro 热浪内缩 / cryo 冰霜扩散 / lightning 白闪 / venom 毒雾渗入 / wind 风线旋转 / laser 十字闪烁 | pixi_filter_manager.js (presetResonancePulse) | P1 |
| 3.3 | **各元素共鸣层级视觉升级**：cryo 雪花图案 / pyro 地面灼烧 / lightning 分叉树 / venom 荧光黄绿 + 毒雾 | particles.js / pixi_effect_adapter.js | P2 |

### Phase 4：PIXI Filter 实战接入（0.5-1 轮）⬜ 待开始

> 基础设施（pixi_filter_manager.js）已就绪，本阶段将预设滤镜实际接入游戏效果。

| # | 任务 | 对应滤镜 API | 优先级 |
| :--- | :--- | :--- | :--- |
| 4.1 | **Cryo 冰封壳 ColorMatrixFilter**：对 temp ≤ -100 的敌人施加冷蓝色偏移 | `presetCryoTint()` + `filterApply()` | P1 |
| 4.2 | **Pyro BurnEffect 暖调滤镜**：对 BurnEffect auraSprite 施加暖红增强 | `presetPyroTint()` + `filterApply()` | P1 |
| 4.3 | **Lightning 电弧脉冲滤镜**：对 ElectrocuteEffect 施加高频亮度振荡 | `presetLightningPulse()` + `filterApply()` | P2 |
| 4.4 | **自定义 Heat Haze Shader**：pyro 高温区域正弦波位移扭曲 | `createHeatHazeFilter()` | P2 |
| 4.5 | **自定义 Frost Overlay Shader**：cryo 冰封区域冰晶噪声 + 边缘光晕 | `createFrostOverlayFilter()` | P2 |
| 4.6 | **全局 Bloom/Glow 后处理**（可选）：对 pixiApp.stage 施加 BlurFilter 叠加 | `createBlurFilter()` | P3 |
