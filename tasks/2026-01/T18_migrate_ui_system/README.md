# 任务说明书：迁移完整UI系统 (T18)

**任务 ID:** T18
**优先级:** 高
**创建日期:** 2026-01-11
**分支:** `feature/T18-migrate_ui_system`

## 1. 任务描述

将 JavaScript UI 系统 (ui_system.js) 迁移到 Godot 4.x GDScript。

## 2. 源文件

`src/ui_system.js` (约 1180 行)

## 3. 需要迁移的功能模块

### 3.1 资源飞入动画
| 函数名 | 行号 | 描述 |
|:---|:---|:---|
| `ui_playResourceFlyEffect` | 15-54 | 资源获取时的飞入动画 |

### 3.2 真理之书界面
| 函数名 | 行号 | 描述 |
|:---|:---|:---|
| `ui_openTruthBook` | 56-62 | 打开真理之书 |
| `ui_closeTruthBook` | 64-71 | 关闭真理之书 |

### 3.3 慢动作系统
| 函数名 | 行号 | 描述 |
|:---|:---|:---|
| `ui_updateSlowMotion` | 77-114 | 更新慢动作效果 |

### 3.4 货币和商店
| 函数名 | 行号 | 描述 |
|:---|:---|:---|
| `ui_updateMetaCurrency` | 119-124 | 更新货币显示 |
| `ui_renderShop` | 129-196 | 渲染商店界面 |

### 3.5 伤害统计
| 函数名 | 行号 | 描述 |
|:---|:---|:---|
| `ui_saveShotDamage` | 217-230 | 保存伤害统计 |
| `ui_updateRoundDamage` | 236-280 | 更新回合伤害显示 |
| `ui_updateDamageStats` | 284-458 | 更新伤害统计面板 |
| `ui_switchDamageRound` | 464-471 | 切换伤害统计回合 |
| `ui_toggleDamagePanel` | 477-493 | 切换伤害面板显示 |

### 3.6 阶段UI管理
| 函数名 | 行号 | 描述 |
|:---|:---|:---|
| `ui_updateUI` | 499-576 | 更新阶段UI显示 |

### 3.7 遗物选择
| 函数名 | 行号 | 描述 |
|:---|:---|:---|
| `ui_showRelicSelection` | 584-661 | 显示遗物选择界面 |
| `ui_selectRelic` | 666-708 | 选择遗物 |
| `ui_skipRelic` | 714-717 | 跳过遗物选择 |
| `ui_closeRelicSelection` | 723-746 | 关闭遗物选择界面 |

### 3.8 配方和弹药HUD
| 函数名 | 行号 | 描述 |
|:---|:---|:---|
| `ui_renderRecipeHUD` | 763-852 | 渲染配方HUD |
| `ui_renderRecipeCard` | 862-949 | 渲染配方卡片 |
| `ui_updateUICache` | 954-971 | 更新UI缓存 |
| `ui_updateGatheringQueueUI` | 978-988 | 更新收集队列UI |
| `ui_updateAmmoUI` | 994-1035 | 更新弹药UI |
| `ui_renderAmmoIcon` | 1040-1087 | 渲染弹药图标 |

### 3.9 Meta系统
| 函数名 | 行号 | 描述 |
|:---|:---|:---|
| `meta_applyUpgrades` | 1092-1112 | 应用局外升级 |
| `meta_addCurrency` | 1117-1121 | 增加货币 |
| `meta_startRun` | 1126-1130 | 开始新局 |
| `meta_openShop` | 1135-1139 | 打开商店 |
| `meta_calculateUpgradeCost` | 1144-1150 | 计算升级价格 |
| `meta_buyUpgrade` | 1155-1179 | 购买升级 |

## 4. 技术要求

1. 使用 Godot 4.x 的 `Control` 节点作为UI基类
2. 使用信号机制进行UI事件通信
3. 使用 `Tween` 实现动画效果
4. 使用 `Theme` 和 `StyleBox` 进行样式管理

## 5. 输出目录

- `godot_project/scripts/ui/ui_system.gd` - 主UI系统脚本
- `godot_project/scripts/ui/damage_panel.gd` - 伤害统计面板
- `godot_project/scripts/ui/shop_panel.gd` - 商店面板
- `godot_project/scripts/ui/relic_selection.gd` - 遗物选择界面

## 6. 验收标准 (Acceptance Criteria)

- [ ] 资源飞入动画已迁移
- [ ] 伤害统计面板已迁移
- [ ] 商店界面已迁移
- [ ] 遗物选择界面已迁移
- [ ] 配方/弹药HUD已迁移
- [ ] Meta系统已迁移
- [ ] 代码风格符合 GDScript 规范

## 7. 相关文档

- 原始 JS 代码: `src/ui_system.js`
