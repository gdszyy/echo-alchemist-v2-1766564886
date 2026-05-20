# Promare 视觉模式技术规范

> **状态**：v1.0 - Phase 1-9 + 后续 follow-up 已落地
> **触发条件**：本文档**必读**于以下场景：
> - 修改 `src/render/promare_*.js` 任意文件
> - 新增元素 / 词缀 / Boss 的视觉
> - 调整 `CONFIG.visualMode` / `CONFIG.promare.*` flag
> - 修改 `body.promare-mode` 作用域的 CSS 选择器
> - 在 `enemy.js` / `entities.js` / `projectile.js` / `particles.js` 内修改 draw 方法

## 1. 设计契约（不可违反）

### 1.1 五色硬切板（PROMARE_PALETTE）

所有 promare 路径只能用下列 5 色，**绝不引入第六色**：

| Token | Hex | 语义 |
|---|---|---|
| `PINK`   | `#FF0090` | pyro / bounce / explosive / 危险 / matryoshka |
| `CYAN`   | `#00E5FF` | cryo / wind / laser / 工具 |
| `YELLOW` | `#FFD600` | lightning / scatter / venom / 警示 |
| `WHITE`  | `#FFFFFF` | pierce / damage / 中性高亮 / 核心 |
| `BLACK`  | `#0a0a0a` | 背景 / 阴影 / 实体填充 |

`CONFIG.colorsPromareOverride` 是这个 palette 在游戏旧 CONFIG.colors 字段上的映射，渲染层读它而非 `CONFIG.colors`，gameplay 逻辑不变。

### 1.2 几何与运动正交（元素辨识 三重保险）

元素辨识必须做到「**蒙色看形、蒙形看色、蒙两者看运动**」三种状态下都能 0.5s 内识别。任何新元素必须在 12 元素 codex 之外引入**正交的形状或运动 signature**，不能与已有元素重叠。

### 1.3 禁用列表（promare 路径绝不用）

- ❌ `ctx.shadowBlur` / `ctx.shadowColor`（性能差且违反「硬边」美学）
- ❌ `createRadialGradient` / `createLinearGradient`（违反「硬切」）
- ❌ 圆角（`border-radius` > 0、`rounded-*` Tailwind 类）
- ❌ `backdrop-filter` / `backdrop-blur`（违反平面化）
- ❌ Tailwind 灰阶以外的彩色 token（border-blue-500 等 — 用 CSS attribute selector 强制覆盖）

替代方案：
- 发光 → `ctx.globalCompositeOperation = 'lighter'` + 多次半透明 fill
- 内描边 → `stroke` 在 `fill` 之后，颜色为 accent（WHITE 或对比色）
- 渐变 → 离散色块拼贴（如 FortuneWheel 的硬切扇形）

---

## 2. 架构概览

### 2.1 模块图

```
src/render/
├── promare_tokens.js       — 5 色 palette + ELEMENT_CODEX(12) + AFFIX_CODEX(10)
│                             + BOSS_GRAMMAR(8) + BURST + HIT_FEEDBACK + perf 预算
├── promare_shapes.js       — 11 个几何 path drawer + drawRadialImpact
│                             + fillStroke_promare 加法填充+内描边 helper
├── promare_background.js   — 离屏 canvas 45° 扫描线 + 透视梯形网格 + 滚动
├── promare_burst.js        — spawnPromareBurst(4 规则) + spawnRadialImpact
│                             + ensurePromareGlobals (子粒子桥接)
│                             + _spawnElementSignature(元素仪式特效)
├── promare_explosion.js    — spawnPromareKillExplosion(三层切片+三角碎片+
│                             烟雾+金田光斑+色差) + spawnPromareOnomatopoeia(拟声词)
├── promare_peg_draw.js     — Peg 钻石 + 元素 glyph
├── promare_dropball_draw.js — 6 边面化弹珠 + billboard 光环
├── promare_projectile_draw.js — 元素形状子弹 dispatcher
├── promare_enemy_draw.js   — 黑底+白边敌人体 + 10 词缀 overlay + 状态 overlay
├── promare_boss_draw.js    — 8 boss silhouette glyph dispatcher
src/styles/
└── promare_ui.css          — body.promare-mode 作用域 CSS（DOM UI 覆盖）
```

### 2.2 Feature Flag 网关

所有 promare 路径必须由 **`CONFIG.visualMode === 'promare'`** 守门。Classic 路径保留不删，便于一键回退。

子开关（`CONFIG.promare.*`）允许独立控制各子系统：
- `useGeometricEnemies` — Enemy.draw 是否走 promare
- `useGeometricPegs` — Peg / DropBall 是否走 promare
- `useGeometricProjectiles` — Projectile.drawVisuals 是否走 promare
- `hideSprites` — SpriteRenderer.draw 全 short-circuit
- `hideBackgroundBitmap` — 跳过 BG_MAIN_CANVAS_SRC

Console toggle：`window.__promare(true/false)`（运行时也会切 `document.body.promare-mode` class）。

### 2.3 Patch 入口（高频修改点）

| 文件:行 | 入口 | 修改场景 |
|---|---|---|
| `entities.js:1040` | Peg.draw early-return → drawPromarePeg | 改钉子视觉 |
| `entities.js:3048` | DropBall.draw early-return → drawPromareDropBall | 改弹珠 |
| `entities.js:150` | SpecialSlot.draw in-place gate | 改槽位 |
| `entities.js:422` | FortuneWheel.draw → _drawPromare | 改命运轮盘 |
| `entities/enemy.js:1418` | Enemy.draw early-return → drawPromareEnemyBody | 改敌人体 + 词缀 |
| `entities/enemy.js:4748` | _drawBossDecoration gate → drawPromareBoss（通过 drawPromareEnemyBody §5）| 改 Boss |
| `entities/projectile.js:922` | Projectile.draw 飞剑残影 + drawVisuals 入口 | 改子弹 |
| `entities/projectile.js:1011` | drawVisuals early-return → drawPromareProjectile | 改单 bullet |
| `effects/particles.js:115-225` | Particle._init 新 mode 添加点 | 新增粒子类型 |
| `effects/particles.js:300-440` | Particle.draw 新 mode 渲染点 | 改粒子视觉 |
| `effects/particles.js:935` | FloatingText.draw promare 分支 | 改伤害数字 / 拟声词 |
| `render_system.js:32` | render_clearCanvas | 改背景 |
| `render_system.js:65` | render_background | 改非战斗背景 |
| `render_system.js:395` | render_combat_launcherOrbitals → _render_promareLauncherOrbitals | 改弹药轨道 |
| `render_system.js:639` | render_combat_launcherEmitterBase | 改发射台 |
| `core.js:381+` | EventBus damage/kill 监听器 | 改命中/击杀反馈 |
| `combat_system.js:1554` | enemy._lastHitVel / _lastHitElement 写入 | 让击杀爆炸知道元素 |

---

## 3. Element Codex（12 元素，禁止增删现有 row）

| 元素 | 形状 | 主色 | 内描边 | 运动 | Signature 二次特效 |
|---|---|---|---|---|---|
| **pyro** | cone3 | PINK | WHITE | 反重力 vy-=1.2dt + drag 0.94 | 内核 YELLOW 小三角（双层灼烧） |
| **cryo** | oct2 | CYAN | WHITE | 慢落 vy+=0.3dt + drag 0.97 | 白十字内饰 + 寿命接近 0 时分裂 2 微晶 |
| **lightning** | zigzagZ | YELLOW | WHITE | jitter ±0.04 + strobe 0.65 概率 | 30% 帧随机短分支闪电 |
| **pierce** | lance4 沿速度 | WHITE | PINK | 几乎无重力 直线 | 身后 4× WHITE 半透明尾迹线 |
| **bounce** | hex6 | PINK | YELLOW | 强重力 vy+=3dt + 单次反弹 *-0.55 | 反弹瞬间 scaleY 0.4 / scaleX 1.4 |
| **scatter** | star4 spin | YELLOW | PINK | 中 drag + 快旋 + 形变缩放 | life=0.5 二次爆裂 3 子粒子（_promareScatterSubSpawn） |
| **damage** | diamond | WHITE | YELLOW | 类 spark 慢衰 0.04 | 白心 + 1.5× YELLOW 加法外圈 + pulse alpha |
| **wind** | crescent 沿速度 | CYAN | WHITE | 高速 streak + 无重力 | 5 条更长的 wind_slash 沿 ±17° 喷出 |
| **laser** | laser_beam(新) | WHITE | CYAN | 直线 长度 20-32px | 8 道呈 360° 放射 + 末端尖三角 + 起点黄圆斑 |
| **venom** | triDown | YELLOW | PINK | 反重力 + x-wobble | 每 0.3 life 留腐蚀印记（YELLOW 小圆点） |
| **echo** | ringDouble | PINK | CYAN | 静止 + 半径扩张 | 3 层错时同心环（0/80/160ms 启动） |
| **flying_sword** | sword 几何 | WHITE | YELLOW | 现有 autohunt 物理 | trail 中 4 个 ghost 残影（递减 alpha + scale） |

**新增元素时**：
1. 在 `promare_tokens.js` ELEMENT_CODEX 加 row
2. 在 `promare_shapes.js` 加新 path drawer
3. 在 `particles.js` _init/update/draw 加新 mode 分支
4. 在 `promare_burst.js` ELEMENT_TO_MODE 映射 + 可选的 _spawnElementSignature 分支
5. 在 `promare_explosion.js` KILL_PALETTE + ONOMATOPOEIA 加色板 + 拟声词
6. **必须**通过形状或运动正交于已有 12 元素，3 重保险都成立

---

## 4. Affix Codex（10 词缀）

每词缀有专属几何 + 锚点区域，多 affix 共存时锚点正交不重叠：

| Affix | 几何 | 锚点 | 颜色 |
|---|---|---|---|
| shield | 六边蜂巢网格 | 全身 | WHITE |
| regen | 上行 chevron 条带 | 底→顶 | WHITE |
| haste | 45° 双速度斜条 | 中心 | YELLOW |
| clone | 5 菱形 + ±2px 镜像 | 分布 | WHITE |
| healer | 8 辐射线星爆 | 中心 | WHITE |
| devour | 4 角内向 chevron | 4 角 | PINK |
| jump | 底 3 行向上 chevron 梯 | 底 30% | YELLOW |
| berserk | 顶边横滚锯齿牙 | 顶 15% | PINK |
| heavyArmor | 交叉 × | 全身 | WHITE |
| deflectionWard | 单 chevron + halo 环 | 上半 | CYAN |

实现位置：`promare_enemy_draw.js` `AFFIX_DRAWERS` 对象。

---

## 5. Boss Silhouette Grammar（8 boss）

每 boss 独特 glyph，狂暴态 = 几何 2× 脉冲 + 加速 + 加 spoke，**不换色**：

| Boss | Glyph | 狂暴 |
|---|---|---|
| boss_ignis | 三尖塔 + 3 内嵌同心三角 | +3 喷射 cone |
| boss_glacies | 八面体 + 3 向上 shard | shard 3→6, 长度 ×1.5 |
| boss_micro | 3×3 hex 群 | 三帧色相 flicker |
| boss_devourer | 倒三角 destination-out + 8 内向 chevron | chevron 8→12, spin ×1.6 |
| boss_viridis | 6 辐射线星号 | scale 1.0↔1.15 pulse |
| boss_tesla | 三重嵌套反旋多边形 | 内 △ ×4 转速 |
| boss_chimera | 双对开 chevron 蝴蝶结 | +垂直 zigzag 尾 |
| boss_ouroboros | 厚环切 1/4 缺口 + 三角头 | rotate ×2 + 缺口 ×1.5 |

实现位置：`promare_boss_draw.js` BOSS_DRAWERS 对象。

---

## 6. 命中 / 击杀反馈三层

### 6.1 命中（damage:dealt）

按伤害强度分层：
- **normal**: 0 帧停顿 + flash α=0.35 4f + shake 5px + spawnPromareBurst('normal') + spawnRadialImpact(8 spoke) + _spawnElementSignature
- **big** (amount ≥30): 3 帧停顿 + flash α=0.35 + shake 9px + spawnPromareBurst('big')
- **kill**: 4 帧停顿 + flash α=0.55 5f + shake 14px + + 击杀爆炸

### 6.2 击杀（enemy:killed）

**额外触发**（在 damage:dealt 之上）：
1. `spawnPromareBurst(..., 'kill')` — 更多碎片
2. `spawnRadialImpact(..., element)` — 8 spoke
3. `spawnPromareKillExplosion(...)` — 三层切片堆叠 + 12 三角碎片群 + 3 暗紫烟雾环 + 3 金田白光斑
4. `spawnPromareOnomatopoeia(...)` — 拟声词（boss 64px / elite 44px / normal 28px）
5. `body.promare-chromatic` class 150ms（pyro/lightning/scatter/bounce only） — CSS filter 色差通道偏移

### 6.3 拟声词字典

`promare_explosion.js` 中的 ONOMATOPOEIA dict：BURN/FREEZE/ZAP/PIERCE/BOUNCE/SPLIT/CRIT/SLASH/FLASH/POISON/ECHO/STRIKE。修改时保持元素→词的一对一映射。

---

## 7. 性能预算

每个新代码路径必须打 `// @perf-impact:` 注释（AGENTS.md §1.5）。

预算表（按 `getPromarePerf(game.perfQualityLevel)`）：

| 项 | high | medium | low |
|---|---|---|---|
| burstBigN | 3 | 2 | 1 |
| burstSmallN | 16 | 10 | 5 |
| radialSpokes | 8 | 6 | 4 |
| hitstopMax | 4 | 3 | 0 (跳过) |
| flashFrames | 4 | 4 | 2 |
| useStagger | true | true | false (跳过 setTimeout 错落) |

实测在 medium 设备 12 元素同帧爆发无掉帧。预期 FPS **净改善**：删除 `_textureCanvas` + `createLinearGradient` + 所有 `shadowBlur` 后比 classic 路径更便宜。

---

## 8. 桥接：粒子 update 调 game

部分粒子需要在自身 update 时 spawn 子粒子（scatter 二次爆裂 / cryo 落地分裂）。粒子本身没有 game 引用，通过 `globalThis._promareXSubSpawn` 桥接：

```js
// 在 promare_burst.js
export function ensurePromareGlobals(game) {
    globalThis._promareScatterSubSpawn = (x, y, color) => { ... };
    globalThis._promareCryoSubSpawn    = (x, y, color) => { ... };
}

// 在 core.js Game 构造器内调用一次
ensurePromareGlobals(this);
```

子粒子必须设 `_splitFired = true` 防止链式爆炸。

**新增子粒子桥接时**：1) 在 `ensurePromareGlobals` 加 `_promareXSubSpawn` 2) 在 `particles.js` update 内对应 mode 加触发条件 3) 子粒子标 `_splitFired = true`。

---

## 9. 已知未优化点（可接续）

1. **真理之书 (Truth Book)** — `systems.js` `TruthBook` 类 + `#truth-demo-canvas`，元素图鉴动画演示还是 classic
2. **Game Over 屏幕** — `src/ui/game_over.js` 还未 promare 化
3. **Run Shop**（局内小商店）— `src/ui/run_shop.js` 已部分覆盖但未专门 patch
4. **顶部 HUD 详细元素** — score multiplier popup / SP gem 动效
5. **结算阶段伤害分析面板**（DPS panel）
6. **真机移动端 FPS 实测** — playwright headless 与真机 GPU 差异

---

## 10. 修改流程（强制）

1. **改前**：必读本文档 + `AGENTS.md` §1.5 + `.cursor/rules/performance.md`
2. **改色**：只能用 `PROMARE_PALETTE` 5 色之一
3. **改形**：保证 12 元素 / 10 affix / 8 boss 三重保险仍成立
4. **改性能**：每个新代码路径打 `// @perf-impact:` 注释，跑性能预算
5. **改完**：
   - 在 `claude/game-visual-redesign-plan-*` 分支提交
   - Commit message 末尾加 `https://claude.ai/code/session_<id>`
   - 跑 playwright headless smoke test（参考 `/tmp/_*_test.cjs` 模板）确认 0 JS error
6. **新增元素 / Boss / Affix**：必须同步更新本文档 §3/§4/§5 表格
