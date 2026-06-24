# 分层 Demo 迭代计划 / Layer Demo Iteration Plan v0.1

> 日期：2026-06-24
> 状态：P0-3，承接 `music_runtime_schema_v0.1.md`、`music_event_mapping_v0.1.md`、`music_transition_templates_v0.1.md`，把"能不能听出来"落成 4 个可独立验收的 demo 场景。
> 一句话原则：**demo 只换数据 / 调函数来驱动音乐意图，不改运行时代码、不引绝对根音、不开随机旋律；每个场景能 `file://` 直接打开听**（`MUS-AUDIO-01`、`MUS-KEY-01`、`MUS-LEAD-01`）。

---

## 0. Demo 原则

- **不改运行时代码**：场景只通过 demo 控件 / 暴露函数（`setIntensity()`、`pauseVeil()`、`emit(event)`）驱动；音乐逻辑全部走音乐门面，不散落 `AudioContext`（`MUS-AUDIO-01`）。
- **file:// 可开**：每个场景是一个静态页 + 内联 demo 数据，双击即听，不依赖 dev server（除非要验证 non-file:// 内容，本轮不需要）。
- **数据驱动**：要改表现就改 `MusicProfile` / `IntensityLayer` / `EventMapEntry` 的 demo 数据，不改调度内核。
- **可证伪验收**：每个场景给"听感判据 + 结构判据"两条，缺一不可——只靠耳朵会漏掉时钟漂移这类问题。

---

## 1. 四场景总览

| # | 场景 | 验证的核心规则 | 触发方式 | 一句话验收 |
|---|---|---|---|---|
| S1 | intensity 0→5 分层爬升 | `MUS-INTENSITY-01/02/03`、`MUS-DENSE-01` | `setIntensity(0..5)` 或连续 `comboUp` | 同一底盘逐层加 stem，不是换了 6 首曲子 |
| S2 | 暂停纱罩 Pause Veil | 决策树第 1 层、`MUS-CLOCK-01` | `pauseVeil(on/off)` / 暂停 | 蒙纱不是硬切，恢复拍点不漂 |
| S3 | 清屋长尾 + 落点冲击 | `MUS-FX-01/03`、转场 §2.5/§2.6 | `emit('roomClear')` / `emit('dropTrigger')` | drop 后碰撞仍清晰，清屋长尾不挡下房间 |
| S4 | Boss 预告 + profile 切换 | `§3.3`、`§3.4`、转场 §2.7 | `emit('bossWarning')` + `targetBossProfile` | 换风味不换情绪，swap 落在小节边界 |

---

## 2. 逐场景详解

### S1 · intensity 0→5 分层爬升

**目的**：证伪"6 首独立 loop"误解——验证 intensity 0–5 是**同一 profile 内的 layered density ramp**（`MUS-INTENSITY-01/02/03`）。

**用户操作**：用 demo 滑杆逐档 `setIntensity(0→1→2→3→4→5)`；或连续触发 `comboUp` 让强度自然推档（`event_mapping §2`，`comboUp` → `densityBump`）。

**预期听感**：底盘 groove bed 始终是同一段，逐档**叠加** stem——0 近静默/floor，1 加 drum grid，2 加 bass spine，3 加 cloud body，4 加 sparse cue，5 全开 + lead gate 放开；档间是平滑淡入，**没有曲子被整段替换的断点**。

**active lanes**：`low` →（`mid`）→ `high` → `fx` 逐步进入（`MUS-STEM-01`）。

**active rules**：`MUS-INTENSITY-01`（分层即强度）、`MUS-INTENSITY-02`（档间平滑）、`MUS-INTENSITY-03`、`MUS-STEM-01`、`MUS-DENSE-01`（密底盘少锚点）。

**demo 改动点**：调 `MusicProfile.intensityLayers[0..5]` 的 `drumDensity/bassDensity/cloudDensity/cueHandoff/leadAllowed/transientGuard`；或调 `setIntensity()` 当前档位。**不动调度内核**。

**验收方法**：
- 听感判据：从 0 拉到 5 全程底盘连续（同一 loop 在长大），不是切歌。
- 结构判据：打印每档 active stem 列表，数量随档单调上升；`intensity 5` 时 `transientGuard=true`，此时打 brick 碰撞反馈不被糊（接 S3 验证）。

### S2 · 暂停纱罩 Pause Veil

**目的**：验证暂停走**渐变纱罩**（低通 + 降密 + 送 reverb）而非 hard cut，且恢复无缝——这是决策树**第 1 层**（最高优先），且暂停不丢拍时钟（`MUS-CLOCK-01`）。

**用户操作**：暂停/恢复游戏数次；或直接 `pauseVeil(true)` / `pauseVeil(false)`。

**预期听感**：暂停瞬间整体蒙上低通 + 混响纱、密度落到 floor，但**节拍时钟不停**（在内部继续跑）；恢复时无缝接回原 phrase 位置，不重起、不错拍。

**active lanes**：全 lane 经 `fx` veil 通道（`MUS-STEM-01` 的 `fx` lane）。

**active rules**：决策树第 1 层 Pause Veil（`music_runtime_schema §决策顺序`）、`MUS-CLOCK-01`（单拍序时钟，暂停不丢）。

**demo 改动点**：`pauseVeil()` 暴露函数 + veil 的 `sendAutomation`（filter/reverb 包络）demo 值。

**验收方法**：
- 听感判据：暂停是"蒙纱渐暗"不是"咔嚓静音"；恢复无缝。
- 结构判据：暂停 N 拍后恢复，比对恢复点的 beat/slot16 是否 = 暂停点 + N（时钟连续，无漂移）。

### S3 · 清屋长尾 + 落点冲击

**目的**：验证两个结构转场——`fx.roomClearTail`（清屋 section 边界 impact + voice 长尾后降档）与 `fx.dropTrigger`（下一 downbeat impact 抬 intensity 5 且**给碰撞留瞬态**）（转场 §2.5/§2.6，`MUS-FX-01/03`）。

**用户操作**：`emit('roomClear')`；分别 `emit('dropTrigger')`；drop 后立刻连打 brick 观察碰撞反馈。

**预期听感**：`roomClear` → section 边界一击 impact + voice 长尾（≤4 拍）后整体降档收束；`dropTrigger` → 下一 downbeat impact 抬到 intensity 5，**此时碰撞反馈依然清晰不被长尾糊住**。

**active lanes**：`fx`（drop 额外 `low`）。

**active rules**：`MUS-FX-01`（转场只桥接不开新旋律）、`MUS-FX-03`（留瞬态、尾音走 send）、`§3.6`、转场库 §2.5 / §2.6。

**demo 改动点**：`emit('roomClear')` / `emit('dropTrigger')`；`tailBudget.sendOnly=true`、`maxBeats` demo 值。

**验收方法**：
- 听感判据：drop 后打 brick，碰撞瞬态清楚 = 通过；被长尾盖住 = 失败（`transientGuard` 没生效）。
- 结构判据：`roomClearTail` 的尾音只在 `fx` send 总线、不新增声部；`dropTrigger` 落点精确对齐 `nextDownbeat`，不是即时插入。

### S4 · Boss 预告 + profile 切换

**目的**：验证 `fx.bossWarningPreRoll` pre-roll 后的 **Boss profile swap 只换风味、不换情绪职能**（`§3.3`、`§3.4`，转场 §2.7）。

**用户操作**：`emit('bossWarning')` 并指定 `targetBossProfile`；等 pre-roll 走完观察 swap。

**预期听感**：Boss 前 4/8 小节 voice 弧线 + bass 拾音 + 鼓花预告，音高交接到目标 Boss `root`；随后切 Boss profile（换音色 / voicing / BPM），但情绪职能（pressure / bossRitual）**连续**，不是硬切到一首不相关的曲子。

**active lanes**：`fx` `mid` `low` →（swap 后）目标 profile 全 lane。

**active rules**：`§3.3`（情绪轴驱动和声）、`§3.4`（Boss profile 只改风味不覆盖情绪轴）、`MUS-CHORD-01/02`、转场库 §2.7、`MUS-KEY-01`（Boss root 是 profile 内配置）。

**demo 改动点**：`emit('bossWarning')` + `targetBossProfile` 指向 `music_boss_biome_profiles_v0.1.md` 里的某个 Boss profile（任务 #5 产出）。

**验收方法**：
- 听感判据：pre-roll → swap 情绪连续；换的是风味（音色/voicing），不是情绪职能。
- 结构判据：profile swap 落在 `4barBoundary`/`8barBoundary` 而非即时；`pitchBoundary` = `handoffTo:targetBossProfile`，swap 后根音 = Boss profile `root`。

---

## 3. 验收方法汇总

| 维度 | 通用判据 | 工具 |
|---|---|---|
| 时钟连续 | 暂停/转场前后 beat/slot16 对齐，无漂移（`MUS-CLOCK-01`） | demo 打印时钟读数 |
| 分层非换歌 | 底盘 loop 连续，stem 数随 intensity 单调变化 | active stem 列表打印 |
| 留瞬态 | 高 intensity / drop 后碰撞反馈不被糊（`MUS-FX-03`） | 听感 + `transientGuard` 标志 |
| 转场挂边界 | 转场只在 phrase/section/bar 边界发生，非即时 | 触发帧 vs 边界帧比对 |
| 情绪连续 | Boss swap 换风味不换情绪职能（`§3.4`） | 听感 + `emotionId` 不变 |
| 无随机旋律 | 全程 `pitchSource ∈ {rootOnly, currentChordShell, profilePitchSet}` | 检查 demo 数据无 `random` |

---

## 4. 边界与不做

- 不改运行时调度内核：demo 只换 `MusicProfile`/`IntensityLayer`/`EventMapEntry` 数据与调暴露函数（`MUS-AUDIO-01`）。
- 不为 demo 临时引绝对根音：Boss/房间根音都走 profile `root` 配置（`MUS-KEY-01`、`MUS-SHARD-05`）。
- 不为"听着热闹"加随机 lead：分层和转场都不开随机旋律（`MUS-LEAD-01`、`MUS-FX-01`）。
- 不在本文件写实现：这是验收剧本，运行时实现以 schema 为准。
- S4 依赖任务 #5 的 Boss profile 产出；在 #5 完成前 S4 用占位 `targetBossProfile` 跑结构判据，听感判据待 Boss profile 落地后补。
