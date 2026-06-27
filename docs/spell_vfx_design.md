# 法术特效设计规格

> 状态：2026-06-27 初版设计稿。用于指导法阵形态、法术内容类型与战斗表现层实现。
> 范围：药剂炼成后的 `spellTree`、`POTION_SPELL_DB[*].vfxProfile`、后续 `SPELL_FORM_VFX_PROFILES`、`combat_system.js` 表现层 helper。
> 原则：特效只表达释放过程与结算语义，不负责伤害、状态、消耗、DOM 或存档逻辑。

## 1. 设计目标

法术特效要解决三个读感问题：

1. 玩家能在 0.3 秒内看出“这是什么形态”：药瓶、Orb、Beam、斩击、坠击、防御塔等必须有不同轮廓。
2. 玩家能看出“什么时候结算”：碎裂、破裂、引爆、传导、掠过、目标点落下、active/death 触发都要有明确瞬间。
3. 玩家能看出“这个法术偏什么内容”：爆发、状态、延迟、构筑要在同一形态上叠加不同材质，而不是只改颜色。

设计上分两层：

| 层级 | 决定内容 | 示例 |
|---|---|---|
| 法阵形态 `formId` | 运动方式、结算时机、轮廓 | 药瓶抛物线、Beam 直线传导、坠击垂直落点 |
| 法术内容 `spellType` | 材质、尾迹、余韵 | 爆发碎片、状态雾环、延迟脉冲、构筑铭刻 |

## 2. 全局视觉语法

| 法术内容 | 核心图形 | 粒子倾向 | 结算余韵 |
|---|---|---|---|
| `burst` 爆发 | 冲击环、碎片、短放射线 | `spark` / `ember` / `shard` | 快速扩张后清场，浮字短促 |
| `status` 状态 | 薄雾、铭刻环、身体标记 | `mist` / `venom` / 少量 `spark` | 留在目标身上的短标签或绕身粒子 |
| `delay` 延迟 | 二段脉冲、收束点、倒计时刻痕 | 低速 `spark` / `line` | 第一段标记，第二段爆发 |
| `construct` 构筑 | 几何骨架、玻璃/金属边、固定锚点 | `shard` / `line` | 稳定成型，弱化爆炸感 |

颜色只表达属性，不能替代形态。比如火焰 Beam 和冰霜 Beam 都必须先像 Beam，再通过火星/冰雾区分属性。

## 3. 形态设计矩阵

| 形态 | 当前状态 | 运动轮廓 | 结算动作 | 推荐复用入口 |
|---|---|---|---|---|
| `bottle` 药瓶 | 已实现 | 自发射点到目标点的短抛物线 | 碎裂、封装或过载裂解 | `combat_playPotionBottleVFX()`、`spawn_createProjectileExplosion()`、`spawn_createAssimilationPulse()` |
| `orb` Orb | 已实现首版 | 悬浮核心沿路径移动，尾部有 2-3 个残影 | 破裂释放 | `spawn_createSkillIgnition()`、`spawn_createAssimilationWave()`、`combat_playPotionShatterVFX()` |
| `mine` 地雷 | 已实现首版 | 放置后贴地法印，等待触发 | 向上引爆 | `spawn_createAssimilationWave()`、`combat_playPotionShatterVFX()`、`spawn_createParticle()` |
| `beam` Beam | 已法阵化首版 | 起点到目标/路径的直线传导 | 命中点短脉冲 | `LaserBeam`、`spawn_createAssimilationWave()`、`spawn_createSkillIgnition()` |
| `orbit` 回旋 | 已实现首版 | 中心环绕/扫过路径，轨迹可见 | 掠过结算 | `SlashAnim`、`spawn_pushParticleWithLimit()`、`combat_emitPotionTargetAccents()` |
| `slash` 斩击 | 已法阵化首版 | 一次性切线或扇面切割 | 切口闪烁 | `SlashEffect`、`PierceCutEffect`、`combat_flyingSword_addSon()` |
| `meteor` 坠击/迫击 | 已实现首版 | 目标点预警 + 垂直落线 | 落点爆发/铭刻 | `LaserBeam`、`spawn_createAssimilationWave()`、`combat_playPotionShatterVFX()` |
| `sweeping_laser` 扫射激光 | 已实现首版 | Beam 线段沿弧线或扇面扫过 | 路径传导 | `LaserBeam`、`spawn_createAssimilationWave()`、`combat_emitPotionTargetAccents()` |
| `tower` 防御塔 | 已实现首版 | 构筑体在格点成型 | active/death 从塔位释放子法术 | `spawn_createSkillIgnition()`、`spawn_createAssimilationPulse()`、子法术自己的 dispatcher |

## 4. 各形态表现规格

### 4.1 药瓶 `bottle`

已落地。表现分四拍：

1. 药匣/发射点点火。
2. 药瓶抛物线残影。
3. 目标点按 `shatterStyle` 分支碎裂。
4. 语义浮字与目标短反馈。

当前 `shatterStyle`：

| 样式 | 表现 |
|---|---|
| `mist_bloom` | 雾环/毒雾铺场 |
| `blast` | 投射物爆破 |
| `mark` | 铭刻标记 + 短电弧 |
| `shard_sigil` | 碎片法印 |
| `collapse_ring` | 内收坍缩环 |
| `seal` | 弹药封装脉冲 |
| `overload_blast` | 过载爆破 + 短电弧 |

### 4.2 Orb `orb`

Orb 是“移动容器”，不是普通子弹。视觉上要像带内容物的炼金核心。

释放过程：

1. 起点生成稳定核心，外圈有 3-6 个符文刻痕。
2. 移动时拖出短尾迹；`status` 使用薄雾，`burst` 使用碎星，`construct` 使用几何线。
3. 破裂时先出现一圈细裂纹，再调用子法术结算表现。

实现建议：

- `high`：核心 + 外环 + 3 层尾迹 + 破裂碎片。
- `medium`：核心 + 外环 + 2 层尾迹。
- `low`：核心 + 1 层尾迹，破裂只保留冲击/铭刻波。
- 不允许 Orb 破裂后再生成 Orb；若规则要求产出，改为 `meteor` 或 `tower`。

### 4.3 地雷 `mine`

地雷是“布设物”，要让玩家知道它在等待触发。

释放过程：

1. 放置时地面出现低矮法印，中心有小药核。
2. 待机时只保留慢速脉冲，不持续撒粒子。
3. 触发时先向内收束，再向上爆发，避免看成普通地面光圈。

实现建议：

- `burst`：触发时 `spawn_createImpactWave()` + 少量碎片。
- `status`：触发时低矮雾环，向敌人身体贴标签。
- `delay`：法印第二圈亮起后结算。
- `construct`：地雷触发后生成一次性屏障/塔基，不做长期地形。

### 4.4 Beam `beam`

Beam 是“传导形态”，读感必须来自持续线段而不是一串爆点。

释放过程：

1. 起点先有半秒内的细线锁定。
2. 主 Beam 贯通到目标/路径，用 `LaserBeam` 承载。
3. 结算点只做小脉冲，不在每帧制造爆炸。

实现建议：

- `status`：Beam 命中目标身上出现短铭刻/温度/毒层标签。
- `delay`：Beam 结束点留下 1 个延迟烙印，二段结算。
- `burst` 默认折叠，不做 Beam tick 爆炸。
- 禁止 Beam 生成 Orb。

### 4.5 回旋 `orbit`

回旋是“轨迹形态”，强调掠过路线和覆盖区，而不是终点。

释放过程：

1. 出现旋转中心或路径锚点。
2. 1-3 条短弧扫过目标区。
3. 每个目标只给一次掠过反馈，避免高频刷屏。

实现建议：

- 可复用 `BladeStormVortex` 的环绕轮廓，但要缩短生命周期。
- `status` 用薄环/身体短标签。
- `delay` 只允许少量目标获得延迟烙印。
- 禁止“回旋终点触发法术”。

### 4.6 斩击 `slash`

斩击是“瞬发切割”，必须有方向感。

释放过程：

1. 施法点到目标方向出现极短预切线。
2. `SlashEffect` 或 `PierceCutEffect` 画出主切口。
3. 命中目标身体出现 1-2 个碎屑或状态短标签。

实现建议：

- `burst`：斩击后在切口中心追加小爆破。
- `status`：切口颜色随属性变化，余韵短。
- `construct`：可表现为飞剑出鞘，但不生成长期周期场。
- `low` 下只保留主切线和浮字。

### 4.7 坠击/迫击 `meteor`

坠击是“指定敌人打击”，替代看不清的产出嵌套。

释放过程：

1. 目标点出现预警环，持续很短。
2. 垂直落线或斜落弹道进入目标点。
3. 落点调用爆发/状态/构筑结算表现。

实现建议：

- `burst`：落点 `spawn_createProjectileExplosion()`。
- `status`：落点 `spawn_createAssimilationWave()` + 身体标记。
- `delay`：预警环变成延迟烙印。
- `construct`：落点生成塔基/护盾，不再坠击。

### 4.8 扫射激光 `sweeping_laser`

扫射激光是 Beam + 回旋的复合形态，不是 Beam 嵌套回旋。

释放过程：

1. 给出扇面或弧线路径预示。
2. Beam 沿路径分段扫过。
3. 目标只响应“被路径扫到”的一次传导反馈。

实现建议：

- 只允许 `status` 与 `delay`。
- `high` 可有 3-4 段 Beam；`medium` 2-3 段；`low` 1-2 段。
- 不允许生成弹体、Orb 或隐藏扣血。

### 4.9 防御塔 `tower`

防御塔是“构筑载体”，重点是站位、承伤和互斥触发。

释放过程：

1. 塔基从法阵中成型，出现固定锚点。
2. `active` 槽：回合开始从塔位释放一次子法术。
3. `death` 槽：死亡时从塔位释放一次子法术。

实现建议：

- 塔自己不负责索敌、射程、冷却或复制施法。
- 子法术表现仍走自己的形态 dispatcher。
- `active` 和 `death` 只能二选一。
- `low` 下塔体只保留轮廓、血量/阻挡读感和触发脉冲。

## 5. 配置字段建议

后续可以在 `src/config.js` 中新增静态表现表，不直接把所有形态写死在分支里：

```js
const SPELL_FORM_VFX_PROFILES = {
    bottle: {
        releaseVerb: 'shatter',
        carrier: 'arc',
        supportedSpellTypes: ['burst', 'status', 'delay', 'construct'],
        budget: { trailHigh: 7, trailMedium: 5, trailLow: 3 }
    },
    orb: {
        releaseVerb: 'rupture',
        carrier: 'floating_core',
        supportedSpellTypes: ['burst', 'status', 'delay', 'construct']
    }
};
```

运行态草稿树只引用 `formId` / `nestingMode` / `spellType` / `vfxProfile`。具体粒子数量、复用入口和降级策略由表现表与 combat helper 决定。

## 6. 实现顺序

| 阶段 | 内容 | 验收 |
|---|---|---|
| P0 | 保持药瓶已实现；新增通用 `combat_playSpellFormVFX()` 设计入口但不改变结算 | 静态测试覆盖所有 `formId` |
| P1 | 实现 `slash`、`beam`、`meteor` 三个高读感形态 | 每个形态有 cast/carrier/release 三段表现 |
| P2 | 实现 `orb`、`mine`、`orbit` | 不违反禁用嵌套清单 |
| P3 | 实现 `sweeping_laser`、`tower` | 复合形态和 active/death 互斥清晰 |
| P4 | 炼金台绘阵 UI 接入形态预览 | 封装前仍不泄露具体药剂名与数值 |

## 7. 验收清单

- 每个形态都有独立轮廓，不只换颜色。
- 每个形态都有明确结算瞬间。
- `spellType` 只改变材质和余韵，不改变形态合法性。
- 表现层不修改伤害、状态、消耗、DOM 或存档。
- 新增高开销粒子、波、Beam、电弧、持续对象时必须写 `// @perf-impact`。
- 新增持续对象时必须接入 `CONFIG.performance` 对应预算；短粒子优先复用现有分类上限。
- `low` 档必须保留玩法读感，不能只关掉特效。
