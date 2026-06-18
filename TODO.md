# Echo Alchemist V2 改造工程 TODO 清单

**最后更新：** 2026年6月18日 | **状态：⏳ P0 交互优化推进中 · 掉落驱动闭环修复进行中 · 位图化视觉重构规划中**

> 当前 P0 交互优化拆解与验收清单见 [`docs/p0_interaction_optimization_todo.md`](docs/p0_interaction_optimization_todo.md)。该文档承接“先打磨现有机制、修 bug、再考虑减法”的最新执行优先级。

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
| 2026-04-18 | 继续游戏 / 新开局 / 游戏结束入口 | `sys_loadRunState()` 恢复后会重新进入 `sys_startRoundStartResolver()`；`meta_startRun()` 与 `_gameover_triggerPhase()` 也都先清除局内存档，再进入新局或结算 | 入口层没有发现重新跳回旧固定选择流程的问题，当前判断为通过 |

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

### Phase 5.0：核心页面体验重设与流程优化 🧭 新增记录

> 目标：在继续补素材之前，先固定核心页面的体验场景、视觉层级和模块流程边界，避免美术资产零散接入后仍然缺少统一页面语言。

| 优先级 | 页面 / 场景 | 后续优化重点 | 当前状态 |
| :--- | :--- | :--- | :--- |
| P0 | 战斗主界面（`#phase-combat`） | 明确战场、敌人、发射器、技能栏、符文充能、伤害反馈的首屏层级；作为全局美术基调锚点 | 🎨 概念图待定稿 |
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

- [x] `#phase-selection` / 子弹替换：补齐禁用确认原因、已选数量提示、键盘选择和护盾状态可见性。
- [x] `#phase-gathering` / `#module-editor-layer`：模块选择浮层现在会提前禁用不可放置模块并显示原因；应用模块前先校验再修改布局，避免误点非法大模块导致原模块被清空。
- [ ] 下一步 P0：继续处理战斗主界面与敌人视觉状态的首屏层级、危险反馈和可读性。
