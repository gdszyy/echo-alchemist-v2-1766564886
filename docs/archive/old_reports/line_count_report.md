# 核心文件实际行数统计报告

**统计时间**：2026-04-11  
**任务 ID**：tsk-938f86de-563  
**统计工具**：`wc -l`  

## 统计结果

| 文件路径 | 实际行数 | 备注 |
| :--- | ---: | :--- |
| `src/entities.js` | 3249 | 实体系统聚合入口，已完成拆分（Task 2.2） |
| `src/entities/enemy.js` | 1702 | Enemy 类（Task 2.2 拆分） |
| `src/entities/projectile.js` | 784 | Projectile 类（Task 2.2 拆分） |
| `src/combat_system.js` | 2216 | 核心战斗流程控制 |
| `src/combat/damage_calc.js` | 257 | 纯伤害计算与统计（Task 2.3 拆分） |
| `src/combat/collision.js` | 172 | 碰撞检测逻辑（Task 2.3 拆分） |
| `src/ui_system.js` | 539 | UI 系统聚合入口 |
| `src/ui/hud.js` | 879 | HUD 渲染（UI 拆分） |
| `src/ui/shop.js` | 328 | 商店渲染（UI 拆分） |
| `src/ui/rune_launcher.js` | 661 | 符文发射器 UI（UI 拆分） |
| `src/game_phase.js` | 1674 | 游戏阶段管理 |
| `src/game_system.js` | 739 | 游戏主循环与存档管理 |
| `src/core.js` | 308 | 游戏引擎核心 |
| `src/event_bus.js` | 253 | 事件总线 |

## 与文档记录的对比

| 文件 | 文档旧值 | 实际行数 | 差异 | 状态 |
| :--- | ---: | ---: | ---: | :--- |
| `src/entities.js` | ~6140 行 | 3249 行 | -2891 | **已更新** |
| `src/combat_system.js` | ~2593 行 | 2216 行 | -377 | **已更新** |

## 本次修改说明

本次修改仅针对 `.cursor/rules/global.md`，共进行 3 处精准编辑（微型修改）：

1. **第 4 节禁止行为清单**：将 `entities.js` 的行数从"约 6140 行"更新为"约 3249 行"，将 `combat_system.js` 的行数从"约 2593 行"更新为"约 2216 行"，并补充了其他超过 500 行的子模块信息（`entities/enemy.js`、`ui/hud.js`、`game_phase.js`）。

2. **第 2 节 `game_phase.js` 依赖关系**：将错误的"依赖 `combat_system.js`、`ui_system.js` 和事件总线"更正为准确的依赖列表（`entities.js`、`config.js`、`audio.js`、`event_bus.js`、`rune_config.js`、`systems.js`），并明确说明不直接依赖 `combat_system.js` 和 `ui_system.js`，而是通过 EventBus 通信。

3. **第 2 节 `entities.js` 核心职责与依赖关系**：更新描述以反映已完成拆分的现状（`Enemy` → `entities/enemy.js`，`Projectile` → `entities/projectile.js`，工具函数 → `utils/math_utils.js`，特效类 → `effects/particles.js`），并更新依赖关系列表。

## AGENTS.md 核查结果

经核查，`AGENTS.md` 第 3 节子模块规范文档索引中所有引用的文件均存在：

| 索引文件 | 存在状态 |
| :--- | :--- |
| `.cursor/rules/global.md` | 存在 |
| `.cursor/rules/audio.md` | 存在 |
| `.cursor/rules/config.md` | 存在 |
| `.cursor/rules/rune_system.md` | 存在 |
| `.cursor/rules/game_phase.md` | 存在 |
| `.cursor/rules/events.md` | 存在 |
| `.cursor/rules/entities.md` | 存在 |
| `src/combat/combat.md` | 存在 |
| `.cursor/rules/ui_system.md` | 存在 |

`AGENTS.md` 第 54 行描述"entities.js 减少约 2004 行"与实际减少量（约 2000 行，从 ~5249 行减至 3249 行）基本吻合，无需修改。
