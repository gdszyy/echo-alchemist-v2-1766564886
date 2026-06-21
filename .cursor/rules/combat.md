---
description: "combat 模块的设计规范与核心逻辑说明"
globs: ["src/combat/**/*", "src/combat_system.js"]
---

# combat 模块规范

## 1. 模块职责

`combat` 模块负责战斗系统的全部计算与执行逻辑，分为三个层次：

- **`src/combat_system.js`**：战斗系统主体，以 Mixin 形式挂载到 `Game` 实例。包含技能激活、子弹发射、激光射击、伤害结算、死亡处理等核心流程。
- **`src/combat/damage_calc.js`**：纯计算模块（`DamageCalc` mixin），负责 DDA 期望伤害评估、伤害记录统计、闪电链触发、词条 Hook 注入。
- **`src/combat/collision.js`**：碰撞检测模块（`CollisionSystem` mixin），负责敌人移动 AABB 检测、激光射线投射与折射。

三个 mixin 在 `combat_system.js` 底部通过 `Object.assign(combat_system, DamageCalc, CollisionSystem)` 合并，最终由 `Game` 实例统一挂载。

## 2. 核心数据模型 / API 接口

### 2.1 弹药配方（Recipe）

弹药配方是战斗系统的核心数据结构，由 `calc_compileCollectionToRecipe()` 从收集阶段的属性列表编译生成：

```js
{
  damage: number,        // 基础伤害（baseDamage + damage 钉子层数）
  bounce: number,        // 反弹次数（bounce 钉子层数）
  pierce: number,        // 穿透次数（pierce 钉子层数）
  scatter: number,       // 散射次数（scatter 钉子层数）
  multicast: number,     // 连射次数（额外发射次数，总量 = 1 + multicast）
  cryo: number,          // 冰属性层数
  pyro: number,          // 火属性层数
  lightning: number,     // 雷属性层数
  laser: number,         // 激光层数
  wind: number,          // 风属性层数
  isLaser: boolean,      // 是否为激光弹药
  explosive: boolean,    // 是否带爆炸效果（可由底部奖励分栏提供）
  flying_sword: number,  // 飞剑层数
  type: string,          // 弹药类型（'normal'/'flying_sword'）
  level: number,         // 弹药等级（取属性中最高等级）
}
```

### 2.2 核心 API（均为 Game 实例方法，通过 Mixin 注入）

| 方法 | 所在文件 | 说明 |
|------|---------|------|
| `combat_activateSkill(skill)` | `combat_system.js` | 激活主动/被动技能，分发到各技能分支 |
| `combat_fireNextShot(vel)` | `combat_system.js` | 从弹药队列取出下一发并发射 |
| `combat_laser_fire(x, y, vel, recipe, ...)` | `combat_system.js` | 发射激光（含折射递归） |
| `combat_damageEnemy(enemy, projectile, ...)` | `combat_system.js` | 对敌人造成伤害（含属性反应、词条 Hook、击杀处理） |
| `combat_wind_executeCircleEffect(...)` | `combat_system.js` | 执行风圈范围伤害 |
| `combat_calculatePlayerExpectedDamage()` | `damage_calc.js` | DDA 核心：计算玩家当前弹药队列的修剪均值期望伤害 |
| `combat_recordDamage(amount, attrType, sourceType, shotId)` | `damage_calc.js` | 记录伤害到回合统计和子弹历史 |
| `combat_tryMoveEnemy(enemy, delta)` | `collision.js` | 尝试移动敌人（AABB 碰撞检测） |
| `combat_laser_castRay(start, dir, maxDist)` | `collision.js` | 激光射线投射，返回最近反射面 |

### 2.3 充能符文系统常量（§8.5）

```js
const RUNE_CHARGE_THRESHOLDS = [999, 999, 6.1, 5.1, 2.6, 2.15, 0.9, 0.4];
const RUNE_CHARGE_DECAY      = 1.26 / 3;  // ≈ 0.42
const RUNE_CHARGE_MAX_LEVEL  = 3;
```

充能等级越高，门槛越低，高稀有度符文越容易入池。

## 3. 状态流转 / 业务规则

### 3.1 伤害管线（Damage Pipeline）

```
combat_damageEnemy()
  ├─ 1. damage_pre_calc      基础值 × 暴击 × 穿透
  ├─ 2. damage_element_bonus 属性效果与共鸣倍率
  ├─ 2.5 boss_vulnerability  Boss 破绽谱进度与易伤窗口
  ├─ 3. damage_runeword_hooks 词条 Hook 注入（thunderstorm / absolute_zero 等）
  ├─ 4. damage_apply_to_enemy 写入 enemy.takeDamage()
  ├─ 5. damage_kill_check    击杀 → 掉落物 / 经验 / 得分
  ├─ 6. damage_dda_feedback  DDA 数据采集（combat_reportDamage）
  └─ 7. damage_visual_and_audio 浮动文字 / 音效 / 屏幕震动
```

### 3.2 词条 Hook 体系

所有词条 Hook 方法均以 `combat_runeword_` 前缀命名，在 `combat_damageEnemy()` 的 `damage_runeword_hooks` 节点集中调用：

| 词条 | 方法 | 触发条件 |
|------|------|---------|
| `thunderstorm`（雷暴之语） | `combat_runeword_thunderstorm_check` | 闪电链触发时提升衰减系数 |
| `thunder_scatter`（雷霆散射） | `combat_runeword_thunderScatter_check` | 闪电链成功后额外触发一次（`isExtraChain` 防循环） |
| `absolute_zero`（绝对零度） | `combat_runeword_absoluteZero_check` | 冰冻状态下伤害随命中次数加深 |
| `elemental_fusion`（元素聚变） | `combat_runeword_elementalFusion_check` | 火+冰+雷三元素同时存在时触发爆炸（真实伤害 = `maxHp × trueDamageRatio`） |

### 3.2.1 Boss 破绽机制

Boss 不再使用旧 `weakness` 静态字段。`combat_damageEnemy()` 在 `enemy.takeDamage()` 前调用 `combat_applyBossVulnerability()`：

- `combat_getBossVulnerabilityProfile()` 从 `CONFIG.balance.bossConfigs[bossId].vulnerability` 读取当前破绽谱、累积模式与阈值；`ouroboros` 会按 `rotationIndex` 动态切换。
- `combat_applyBossVulnerability()` 在 `Enemy.takeDamage()` 前判断本次命中是否匹配破绽谱，并消费已有易伤窗口。
- `combat_updateBossVulnerabilityProgress()` 在实际伤害产生后推进进度：`hits` 模式按实际造成伤害的命中次数累积，`damage` 模式按 `damageResult.actualDamage` 累积。
- 回合缩放由 `CONFIG.balance.bossVulnerability.roundScaling*` 控制：回合越高，命中次数阈值或最大生命百分比阈值越高。
- 命中破绽谱属性并达到当前阈值后进入 `_bossVulnerabilityExposedHits` 易伤窗口。
- 易伤窗口内伤害乘以 `exposedDamageMult`，每次命中消耗 1 次。
- 若 Boss 尚未狂暴，破绽触发会设置 `_bossVulnerabilitySuppressedEnrage`，延后一次 50% 血量狂暴检测。
- 命中反馈标签为 `破绽+` / `破绽` / `易伤`；该机制不新增粒子、渐变或常驻 Canvas 光效。

### 3.3 DDA（动态难度调整）规则

- `combat_calculatePlayerExpectedDamage()` 使用**修剪均值 + 1.5σ 离群值过滤**，避免极端弹药扭曲评估。
- `calc_getRecentAverageDamage(window=3)` 取近 3 回合滑动平均，比历史峰值均值更及时反映当前战力。
- `calc_getPeakAverageDamage()` 已废弃，仅作兼容别名，内部委托给 `calc_getRecentAverageDamage(3)`。

### 3.4 激光折射规则

- 激光碰到左/右墙壁时，X 方向速度取反（镜面反射）。
- 激光碰到带护盾敌人时，触发折射任务，消耗 `bounce` 层数。
- 折射最大深度由 `recipe.bounce` 控制，防止无限递归。

## 4. 禁止行为

- **严禁**在 `damage_calc.js` 或 `collision.js` 中直接操作 DOM 或调用 `audio`，这两个文件是纯计算模块，所有副作用必须通过 `EventBus` 事件或返回值传递给调用方。
- **严禁**在词条 Hook 方法中调用其他词条 Hook（防止循环触发），`thunder_scatter` 已有 `isExtraChain` 标志作为保护，新增词条必须遵循同样的防循环机制。
- **严禁**在 `combat_damageEnemy()` 之外直接调用 `enemy.takeDamage()`，所有伤害必须经过完整的伤害管线（含 DDA 记录和词条 Hook）。
- **严禁**删除或绕过 `combat_recordDamage()` 调用，DDA 系统依赖完整的伤害历史数据。

## 5. 详细设计文档索引

- 函数级索引：[auto_index/src_combat_system_js_index.md](auto_index/src_combat_system_js_index.md)
- 属性系统：[attribute_index.md](attribute_index.md)
- 符文词条：[runeword_index.md](runeword_index.md)
- 性能规范：[performance.md](performance.md)
