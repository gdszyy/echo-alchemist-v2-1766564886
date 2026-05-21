# 3D-Main 复盘 (Retro)

> 状态：3D-Main 分支已积累 30+ commit、~4400 行新代码、~140MB 资产删除。
> 本文记录架构、已完成、已知问题、下一步建议。

## 1. 累计成果

| 项 | 数据 |
| :--- | :--- |
| commit 数 | 30+（vs main） |
| 新模块 | 13 个 `src/render3d/*.js` + 1 个 `src/ui/relic_sigil.js` |
| 新代码行 | ~3,800 (render3d) + ~600 (CSS / UI) |
| 修改 game 代码 | ~120 行（hook 点） |
| 删除资产 | 181 文件 / ~140 MB |
| Milestone | M1–M6.5 + 10+ polish PR |

## 2. 架构

```
core.js  (Game 实例)
  ├─ new Renderer3D(canvas, w, h, { eventBus })
  │     ├─ WebGLRenderer (WebGL2 if available)
  │     ├─ Scene + FogExp2
  │     ├─ PerspectiveCamera (FOV=28°, narrow → near-orthographic 玩法面板)
  │     ├─ BackgroundLayer        (L0/L1 远景天幕/光柱/粒子/炼金台环)
  │     ├─ CameraController       (state machine + spring physics)
  │     ├─ PostFX                 (Bloom + LensDistortion + VignetteGrain
  │     │                          + ACES Filmic + 5 grading 预设)
  │     ├─ QualityProfile         (high/medium/low + auto detect)
  │     └─ SceneProxy
  │           ├─ PegInstancedMesh    (M2)
  │           ├─ WallMesh             (M2)
  │           ├─ EnemyMeshPool + Factory  (M3 - 9 archetype)
  │           ├─ GPUParticleSystem    (M6 - 4096 capacity)
  │           └─ (外挂) RelicCard / RuneMesh  (M5 - 未接入实战)
  │
  └─ sys_loop (每帧):
       1. renderer3d.render()        ← 3D 全场景 + PostFX
       2. 2D phase update            ← entity.draw() 在 3D 模式首行 return
       3. clearRect (3D 模式)         ← 兜底擦掉漏网 entity
       4. floating texts / wind / UI ← 在干净 2D canvas 上绘制
```

## 3. eventBus 自动接线

| 事件 | 触发 |
| :--- | :--- |
| `damage:dealt` | 镜头 IMPACT（按伤害分档）+ spark 粒子 |
| `enemy:killed` | 镜头 KILLED + ember + shard 爆开 |
| `boss:defeated` | 镜头大震 + 大爆炸 + grading 回 combat |
| `boss:spawned` | grading 切到 boss 预设（红紫调） |
| `phase:change` | 镜头 PHASE_TRANS + grading 跟阶段切 |

## 4. 验收状态

| 项 | 状态 | 备注 |
| :--- | :---: | :--- |
| 3D 默认开 | ✅ | body 默认带 `render3d-debug` |
| 设置开关 | ✅ | 顶栏 + 暂停菜单两处 |
| LocalStorage 持久 | ✅ | `ea_render3d_enabled` |
| 0 console 错 | ✅ | 实测 headless 真游戏 |
| 0 资产 404 | ✅ | PR #120 已清理 |
| WebGL2 HDR + Bloom | ✅ | profile=high 自动启用 |
| 软渲染降级 | ✅ | SwiftShader → low 自动跳 PostFX |
| 移动端检测 | ✅ | 小屏 → medium 或 low |
| 2D entity 早 return | ✅ | 29 个 .draw() 全覆盖（除 FloatingText） |
| shadow/light 跳过 | ✅ | 本次 PR 加（前略漏） |
| 真游戏跑过 combat | ⚠️ | headless 注入假敌人成功，没手动玩过 |
| RelicCard 接选择面板 | ❌ | M5 mesh 类未在真 UI 使用 |
| RuneMesh 接符文 UI | ❌ | M5 mesh 类未在真 UI 使用 |
| DoF / Bokeh | ❌ | M4 计划但 deferred |
| Lens flares | ❌ | 未做 |

## 5. 已知 gaps / 后续候选

按"价值 × 改动成本"排序：

| 优先级 | 项 | 简述 | 成本 |
| :---: | :--- | :--- | :---: |
| 🔥 高 | 真机手动测试 | 在浏览器实际玩一局，发现 demo 测不到的问题 | 极低（你来） |
| 🔥 高 | RelicCard 接选择面板 | 让 M5 真正发挥作用 | 中 |
| 中 | 低 HP 红 vignette 脉冲 | 玩家危险时画面边缘红色告警 | 低 |
| 中 | 暴击全屏 1 帧白闪 | 大伤害 punch impact | 低 |
| 中 | RuneMesh 接符文网格 | 替换 emoji 符文图标 | 中 |
| 低 | DoF (Bokeh) | M4 deferred 项 | 高 |
| 低 | Lens flares | 亮 emissive 上水平拉光条 | 中 |
| 低 | 删 unused 模块 | RelicCard/RuneMesh 不用就删（26KB） | 低 |

## 6. 性能现状

每帧（3D 模式）：
- WebGL render: 1 次 composer.render (postFX = 6 pass)
- InstancedMesh: pegs (1 draw) + walls (2 draws) + enemy pool (N draws, N≈20)
- 2D entity .draw(): 首行 return（已优化）
- 2D shadow/light loop: 整段跳过（本 PR 优化）
- 2D clearRect: 安全网兜底（廉价）

主要 CPU 仍在：
- physics update（必须保留）
- HUD DOM 更新
- 事件处理

## 7. 调优历程要点

| PR | 关键发现 |
| :--- | :--- |
| #122 | PegInstancedMesh shader 缺 `attribute vec3 instanceColor` 声明，导致 program invalid 每帧 spam INVALID_OPERATION |
| #123-124 | 2D 不透明覆盖让 3D 完全隐藏；改成默认 3D + sys_loop 末 clearRect |
| #125 | 性能：29 个 entity .draw() 加 guard |
| #126 | bloom 阈值过低导致全场泛光；上调 + 引入 color grading |
| #127 | 阶段感知 grading 让画面随游戏状态呼吸 |
| 本 PR | shadow/light 计算还在跑（未被 .draw guard 覆盖），独立优化 |

## 8. 下一步建议

**最高 ROI**：先**真机手动测试**一局，发现 demo 测不到的问题（教程交互、状态保存、phase 转换）。  
**次高**：把 **RelicCard 接到选择面板**——M5 工作只在 demo 里被看到，没有进入玩家手里。

如继续做 polish：
- 低 HP vignette 红脉冲（5 行 shader）
- 暴击瞬白闪（1 个 ShaderPass 或简单 alpha 叠加）
- RuneMesh 接符文网格（M5 的另一半工作）
