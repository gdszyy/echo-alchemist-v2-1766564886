# 实体系统规范 (entities.md)

本文档是 Echo Alchemist V2 项目中实体系统（`entities.js` 及相关拆分文件）的开发规范。

## 1. 模块职责
实体系统负责游戏中所有"会动的东西"的定义和更新，包括：
*   **核心实体**：弹珠（MarbleDefinition）、敌人（Enemy）、玩家（Player）、特殊槽位（SpecialSlot）、命运轮盘（FortuneWheel）、钉子（Peg）等。
*   **战斗实体**：子弹（Projectile）、飞剑系统（SwordQi, SlashAnim, SonSword）、分身孢子（CloneSpore）。
*   **视觉特效**：粒子（Particle）、光束（LaserBeam）、冲击波（Shockwave）等。
*   **掉落物**：符文掉落（RuneLoot）。

## 2. 架构拆分状态

随着 Task 2.1 和 Task 2.2 的完成，巨型的 `entities.js` 已完成主要拆分：

| 文件 | 职责 | 主要内容 |
|------|------|----------|
| `src/entities.js` | 入口聚合文件（约 3245 行） | 保留 DropBall、SwordQi、SlashAnim、SonSword、CloneSpore、Player、RuneLoot 等；通过 import/export 聚合所有拆分模块 |
| `src/entities/enemy.js` | 敌人实体（约 1322 行） | Enemy 类（含所有词缀逻辑、AI 行为、温度系统、视觉渲染） |
| `src/entities/projectile.js` | 子弹实体（约 737 行） | Projectile 类（含碰撞检测、伤害计算、视觉效果） |
| `src/utils/math_utils.js` | 纯数学工具函数 | Vec2、lerp、lerpColor、rotateTowards 等 |
| `src/effects/particles.js` | 纯视觉特效类 | Particle、SlashEffect、FireWave、LaserBeam 等 |

**拆分进度统计：**
- Task 2.1 前：entities.js 约 5249 行
- Task 2.1 后：entities.js 约 5249 行（提取了 math_utils.js 和 particles.js）
- Task 2.2 后：entities.js 约 3245 行（提取了 enemy.js 和 projectile.js，减少约 2004 行）

## 3. 音频注入机制

由于 `enemy.js` 和 `projectile.js` 是独立模块，它们各自维护独立的音频代理：

- `entities/enemy.js` 导出 `setEnemyAudioProvider(provider)` 函数
- `entities/projectile.js` 导出 `setProjectileAudioProvider(provider)` 函数
- `entities.js` 的 `setAudioProvider(provider)` 会同时调用上述两个函数，确保音频注入传播到所有子模块
- `core.js` 只需调用 `setAudioProvider`，无需感知子模块的存在

## 4. 开发规范
*   **依赖管理**：
    *   `math_utils.js` 和 `particles.js` 作为底层模块，**严禁**引入 `entities.js`、`config.js` 或 `audio.js` 等高层业务模块，以避免循环依赖。
    *   `entities.js` 通过 ES Modules (`import`) 引入拆分出的工具和特效类，并对外重新导出 (`export`) 以保持对其他子系统（如 `combat_system.js`）的向后兼容性。
    *   新增实体类时，应在 `src/entities/` 目录下创建独立文件，并在 `entities.js` 中 import + re-export。
*   **性能要求**：实体类的 `update` 和 `draw` 方法会在每一帧高频调用，严禁在这些方法中执行高开销操作（如复杂的 DOM 操作或大规模对象创建）。
*   **音频注入**：`entities.js` 不再直接依赖 `window.audio`，而是通过 `setAudioProvider` 接收来自 `core.js` 的音频实例注入。子模块（`enemy.js`、`projectile.js`）各自维护独立的音频代理，由 `entities.js` 的 `setAudioProvider` 统一分发。
*   **状态同步**：实体状态的改变（如敌人死亡、玩家受伤）应通过事件总线 (`event_bus.js`) 广播，而不是直接修改全局状态。
*   **向后兼容**：`entities.js` 的 export 列表必须保持完整，确保 `core.js` 等上层模块无需修改即可使用。

## 5. 敌人视觉重设计 (Layer 结构)

根据 Task 敌人视觉重设计，`Enemy` 类的 `draw` 方法已更新，采用全新的 Layer 分层结构以支持复杂的词缀特效和底层纹理。新的 Layer 结构如下：

| Layer 层级 | 绘制内容说明 | 备注 |
| :--- | :--- | :--- |
| **Layer 1** | 圆角矩形容器裁剪（`#0f172a` 深色背景） | 基础裁剪层 |
| **Layer 1.5** | 静态底层纹理（OffscreenCanvas） | **新增**，基于 `visualSeed` 预计算（金属拉丝/矿石斑点/能量流线） |
| **Layer 2** | 液体血条（含延迟白条、绿色回血条） | 真实血量与动画血量 |
| **Layer 3** | 内部覆盖层（过热橙色发光 / 过冷蓝色雾化） | 状态反馈 |
| **Layer 3.5** | 内部词缀特效（如 `Clone` 的细胞斑点） | **新增**，基于 `visualSeed` 保证布局固定 |
| **Layer 4** | 裂纹绘制（过热岩浆裂纹 / 过冷冰晶裂纹） | 状态反馈 |
| **Layer 5** | 内部边框（普通 / elite / boss） | 包含预警闪烁 |
| **Layer 5.5** | 插在身上的子剑（Stuck Swords） | 包含母剑剑穗 |
| **Layer 6** | 外部特效（过热炙热光圈 / 过冷冰封外壳） | 状态反馈 |
| **Layer 7** | 扫描反馈（准星动画） | 状态反馈 |
| **Layer 8** | 外部词缀光环层 | **新增**，包含 `shield`/`regen`/`haste`/`devour`/`healer`/`jump` 特效 |
| **文字层** | 血量数字 | 已移除 emoji 角标 |

**性能优化说明**：
*   **Layer 1.5**：使用 `OffscreenCanvas` 在 `Enemy` 构造函数中进行预计算，每帧仅执行一次 `drawImage`，性能开销极低。
*   **动态特效**：所有动态效果（如呼吸脉冲、微位移）均使用基于 `Date.now()` 的数学函数（如 `Math.sin`）计算，频率限制在 1Hz 以内，无需引入复杂的粒子系统。
*   **多词缀叠加**：当词缀数量超过 3 个时，所有词缀特效的透明度自动乘以 0.8，防止视觉过曝。
