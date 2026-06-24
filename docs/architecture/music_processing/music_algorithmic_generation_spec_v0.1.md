# 算法生成设计规格 / Algorithmic Generation Spec v0.1

> 日期：2026-06-24
> 状态：P3-1，**含规则修订**。承接 v0.11 `§1 变体决策树` + `MUS-LEAD-01 / MUS-KEY-01 / MUS-SECTION-01`、`music_runtime_schema_v0.1.md`（6 结构）、`music_event_mapping_v0.1.md`（五意图+限流）、`music_mix_fx_budget_v0.1.md`（融合裁决）、`music_transition_templates_v0.1.md`（桥接角色）、`music_boss_biome_profiles_v0.1.md`（profile 约束）。
> 一句话原则：**音乐由"受约束、种子化、确定性"的生成器产出——算法只在"已满足约束的候选集合"里选，从不抽原始音高；联动来自单时钟+强度+和声+事件四输入的确定映射，融合来自混音预算裁决，和谐来自调性过滤+根音重力+voice-leading；无约束随机被禁，算法本身不被禁**（`MUS-GEN-01..07`、修订后的 `MUS-LEAD-01`）。

> 范围（本次确认）：**研究 + 设计规格，聚焦"编排耦合层"**（intensity 爬升 / 事件→phrase / transition 桥接 / lane 融合）。旋律与和声走 §4 受约束生成内核，本规格定义其接口与约束、不写运行时代码。

---

## 0. 规则修订（改规则）

### 0.1 澄清：被禁的是"无约束随机"，不是"算法生成"

`MUS-LEAD-01` 原文禁的是 **"随机长旋律 / 随机漂移音高中心"**，且明确允许"算法改 rhythm、octave、gate、filter、bend、send、密度"。v0.11 `§1 决策树` 已经写了受约束生成的雏形：`4/8 小节 Phrase Window -> 在受限 motif bank 中抽下一个 variation`、`rollVariation() 应只在受限 motif pool 内改变 rhythm/octave/filter/effects`。

**结论：受约束算法生成本就是既定实现路径。** 之前会话里"Agent 不生成音乐"是对边界的过宽解读——它适用于"我不能替你作曲出成品 MIDI/音频"，但**不**适用于"系统运行时用算法在约束内编排与生成"。本节把这条路径正式化为 `MUS-GEN-*` 规则族。

### 0.2 新增 MUS-GEN-* 规则族

| 规则 | 一句话 | 落地约束 |
|---|---|---|
| **MUS-GEN-01** 受约束生成原则 | 所有自动声部由种子化、确定性、受约束的生成器产出 | 禁裸 `Math.random()` 直接决定音高/落点；随机只允许出现在 §4.5 的"约束候选集合选择器"里 |
| **MUS-GEN-02** 约束三闸 | 每个生成事件必须过三闸才发声：①时钟量化 ②调性过滤 ③motif/角色边界 | 任一闸不过→丢弃或量化回合法值；对齐 `MUS-PHRASE-01`、`MUS-KEY-01`、`MUS-CLOCK-01` |
| **MUS-GEN-03** 联动（单输入面） | 音乐状态只由 `clock + intensityState + harmonyState + gameplayEvent` 四输入驱动，确定映射 | 不引第二个时钟、不引隐藏随机种子；同输入→同状态（`MUS-CLOCK-01`） |
| **MUS-GEN-04** 融合（混音裁决） | 多声部叠加输出"意图"，由混音层按预算决定增益/频段/send/sidechain | 生成层不直接写增益；碰撞瞬态优先权不可被生成声部侵犯（`MUS-AUDIO-02`、`MUS-FX-03`） |
| **MUS-GEN-05** 和谐（调性闭包） | 生成音高只取自 `harmonyState.pitchSet`，带 root gravity 与 voice-leading | 禁全音阶随机漂移；profile 根音由 profile 决定不硬编码（`MUS-KEY-01`、`MUS-SHARD-03`） |
| **MUS-GEN-06** 可复现 | 同 `(seed, profile, state, eventLog)` → 逐音相同输出 | 用于验证/回归；接 `MUS-VALID-01/02` 的合规审计 |
| **MUS-GEN-07** 只产意图 | 算法生成"音乐意图/编排"，不在玩法/UI 直接建 `AudioContext` | 渲染交音乐门面统一调度（`MUS-AUDIO-01`） |

### 0.3 MUS-LEAD-01 修订文字（同步改 v0.11）

> 解释列追加一句：**「v0.1 修订：受约束算法生成是既定实现路径（见 `music_algorithmic_generation_spec_v0.1.md :: MUS-GEN-*`）；被禁的是无约束随机漂移，不是算法本身。Lead variation 由 §4 内核在 scale/root/voice-leading 约束内生成。」**

---

## 1. 生成对象分层（聚焦编排耦合层）

把"生成"切成两层，本规格主攻第一层、定义第二层接口：

| 层 | 职责 | 本规格 | 产物 |
|---|---|---|---|
| **编排耦合层** orchestration/coupling | 决定此刻哪些 lane 开、密度多少、事件落成什么意图、何时桥接、各 lane 如何融合 | **主攻（§3）** | 五类音乐意图 + 混音裁决 |
| **受约束生成内核** constraint kernel | 在调性/节奏/motif 约束内产出具体音符 | 定义接口与约束（§4），具体 motif bank 由素材端提供 | 合法 note 序列 |

五类音乐意图（承 `event_mapping`）由哪层产生：

| 意图 | 产生层 | 触发源 |
|---|---|---|
| `phrase` | 编排层调度 + 内核取音 | section/phrase window、聚合后的事件 |
| `anchor` | 编排层（量化）+ 内核（root 重力） | 玩家事件 countToAnchor |
| `densityBump` | 编排层 intensity 生成器 | intensityState 变化 / combo |
| `sendBump` | 编排层融合裁决 | 事件 sendBump / transition tail |
| `transitionRole` | 编排层桥接选择器 | 边界 / boss skill |

---

## 2. 三个目标的算法定义

### 2.1 联动 coupling —— 四输入确定映射（`MUS-GEN-03`）

```
musicState(t) = F( clock(t), intensityState(t), harmonyState(t), eventQueue(t) )
```

- **事件耦合**：`eventRouter` 按 `event_mapping` 把 13 事件路由到意图，并走 `cooldownBeats / priority / maxStack / aggregate`（高频碰撞聚合，不逐碰撞发声）。
- **强度耦合**：`intensityState∈0..5` 是全局标量，驱动每条 lane 的密度函数（§3.2），房间身份不因强度切换断裂（`MUS-INTENSITY-01`）。
- **确定性**：F 是纯函数，无隐藏时钟、无未种子化随机（`MUS-CLOCK-01`）。

### 2.2 融合 fusion —— 混音预算裁决（`MUS-GEN-04`）

算法层只输出"哪些意图在响"，**增益/频段/send/sidechain 由混音层按 `mix_fx_budget` 裁决**：

```
mixResolve(activeIntents) ->
  per lane: band 领地(§0) + 让路矩阵(§1) + sidechain(kick→bass/pad/cloud) + send(HPF>300Hz)
  invariant: 碰撞 one-shot 瞬态优先，永不被生成声部 sidechain/掩盖
```

声部"融"在一起靠的是频段避让 + sidechain 动态窗口，不是把音量堆满（`MUS-DENSE-01`、`MUS-FX-03`）。

### 2.3 和谐 harmony —— 调性闭包（`MUS-GEN-05`）

任何生成音高必须落在 `harmonyState` 决定的闭包内：

```
legalPitches = pitchSet(progression, shellFamily) ∩ profile.scale,  以 root 为重力中心
quantizePitch(rawDegree) -> nearest legal pitch，root 权重最高，avoid-note 规避
```

和谐不是"碰巧好听"，是**机器保证**：音池受限 + 根音重力 + voice-leading（§4），禁全音阶随机漂移（`MUS-SHARD-03`、`MUS-CHORD-06`）。

---

## 3. 编排耦合层算法（主攻 · 伪代码）

把 v0.11 `§1 决策树` 正式化为命名函数。四级调度沿用"单拍序时钟"。

### 3.1 主循环 tick()

```js
// 纯函数语义：相同输入逐音可复现（MUS-GEN-06）
function tick(clock, intensityState, harmonyState, eventQueue, profile, seed) {
  const intents = [];

  // A. 边界调度（section/phrase）
  if (clock.atSectionBoundary())                       // 8/16/32 bar
    intents.push(...resolveSection(intensityState, harmonyState, profile, seed));
  if (clock.atPhraseBoundary())                        // 4/8 bar
    intents.push(...resolvePhrase(harmonyState, profile, seed, clock));
  if (clock.atTransitionWindow(intensityState))        // 边界前 1-4 bar
    intents.push(selectTransition(clock.boundary, intensityState, /*event*/null));

  // B. 每 lane 按强度生成密度（联动）
  for (const lane of profile.laneRecipe.lanes)
    intents.push(...generateLaneDensity(lane, intensityState, harmonyState, clock, profile, seed));

  // C. 事件 → 意图（聚合 + 量化）
  for (const ev of drainAggregated(eventQueue))
    intents.push(...routeEvent(ev, harmonyState, clock));   // §3.3

  // D. 三闸过滤（MUS-GEN-02）→ 融合裁决（§2.2）
  const legal = intents.filter(passesThreeGates);            // clock∧key∧role
  return mixResolve(legal);                                  // 输出带混音参数的意图流
}
```

### 3.2 intensity 爬升生成器 generateLaneDensity()

```js
// densityCurve 单调随 intensity 升高；读 IntensityLayer 字段，不换歌（MUS-INTENSITY-01/02）
function generateLaneDensity(lane, i, harmony, clock, profile, seed) {
  const layer = profile.intensityLayers[i];               // {drumDensity,bassDensity,cloudDensity,cueHandoff,fxSendDepth}
  const tier  = densityTier(lane, layer);                 // anchor/offbeat/even-slot/full-motor（v0.11 spine ladder）
  const slots = slotsForTier(tier, clock.barGrid);        // 0/4/8/12 → 2/6/10/14 → 全16分
  return slots.map(slot => ({
    lane, slot,
    pitch: kernel.pick(lane, harmony, seed, slot),        // §4 受约束取音，非随机
    role : lane === 'cloud' ? 'cloudBody' : 'motor',
    intent: 'densityBump'
  }));
}
```

### 3.3 事件→phrase 调度器 routeEvent()

```js
function routeEvent(ev, harmony, clock) {
  const m = EventMapping[ev.type];                        // {targetLane,quantizeGrid,cooldownBeats,priority,maxStack,aggregate,intent}
  if (onCooldown(m, clock) || overStack(m)) return [];    // 限流（MUS-AUDIO-02）
  const t = clock.quantize(ev.time, m.quantizeGrid);      // 吸附网格/和弦（MUS-PHRASE-01）
  const intentType = m.aggregate === 'countToAnchor' && belowAnchorCount(m)
        ? null : m.intent;                                // 高频碰撞聚合，不逐碰撞发声
  if (!intentType) return [];
  return [{ lane: m.targetLane, slot: t, intent: intentType,
            pitch: intentType==='anchor' ? kernel.rootPick(harmony) : kernel.pick(m.targetLane,harmony) }];
}
```

### 3.4 transition 桥接选择器 selectTransition()

```js
function selectTransition(boundary, intensity, event) {
  // 命中 music_transition_templates 的 7 模板之一；opensNewMelody=false（MUS-FX-01）
  if (event === 'dropTrigger')        return T['fx.dropTrigger'];
  if (event === 'roomClear')          return T['fx.roomClearTail'];
  if (event === 'bossWarning')        return T['fx.bossWarningPreRoll'];
  if (boundary === 8 && intensity>=2) return T['fx.8barBuild'];
  if (boundary === 4 && intensity>=3) return T['fx.4barRiser'];     // alias fx.tensionRamp
  if (boundary === 2)                 return T['fx.2barDrumFill'];
  return T['fx.1barPickup'];                                        // 默认 pickup
  // 每个模板自带 triggerWindow/pitchBoundary/tailBudget(sendOnly)/densityCurve，留瞬态（MUS-FX-03）
}
```

### 3.5 lane 融合裁决 mixResolve()（接 §2.2）

```js
function mixResolve(intents) {
  for (const it of intents) {
    it.band     = LANE_BAND[it.lane];                     // low/mid/high/fx 领地
    it.gain     = budgetGain(it.lane, it.intensity);      // mix_fx_budget §0/§4
    it.send     = it.intent==='sendBump' ? it.depth : laneSend(it.lane);   // HPF>300Hz
    it.sidechain= ['bass','pad','cloud'].includes(it.lane); // kick 触发 duck
  }
  // 不变量：碰撞 one-shot 不进 sidechain、瞬态完整（MUS-GEN-04 / MUS-AUDIO-02）
  return intents;
}
```

---

## 4. 受约束生成内核（旋律/和声接口）

编排层每次取音都调内核；内核保证"和谐"。

| 函数 | 输入 | 输出 | 约束 |
|---|---|---|---|
| `quantizePitch(rawDegree, harmony)` | 相对音级 + 和声态 | 最近合法 pitch | ∈ `pitchSet ∩ scale`，root 权重最高，avoid-note 规避（`MUS-GEN-05`） |
| `quantizeRhythm(t, grid)` | 时间 + 网格 | slot16 | 吸附 `0/4/8/12 → 2/6/10/14 → 全16分`（`MUS-DRUM-01`） |
| `transformMotif(motif, op, c)` | motif + 操作 + 约束 | 变体 motif | `op∈{transpose,invert,retrograde,augment,density,octave,gate}`，全在调性内；**禁 op=randomPitch** |
| `voiceLead(prev, next)` | 前后 voicing | 最小移动 voicing | 相邻声部最小位移、register 分层、root lock（`MUS-BASS-03`、`MUS-CHORD-03`） |
| `seededPick(candidates, seed, state)` | **已合法**候选集 + 种子 | 一个候选 | RNG **只在合法候选里选**，从不生成原始音高（`MUS-GEN-01/06`） |

> §4.5 `seededPick` 是"和谐≠随机"的机器分界线：随机性被关进"已过三闸的候选集合"里，只决定**控制变化**（哪个 rhythm/octave/gate 变体），永不决定**音高本身**。

---

## 5. 数据流总览

```
            ┌───────── 四输入（MUS-GEN-03）─────────┐
clock ──┐   intensityState   harmonyState   eventQueue
        ▼            ▼              ▼             ▼
   ┌──────────────── 编排耦合层 tick() ────────────────┐
   │ resolveSection / resolvePhrase / selectTransition │  §3.1
   │ generateLaneDensity（强度→密度）                  │  §3.2 联动
   │ routeEvent（聚合+量化+限流）                       │  §3.3
   └───────────────────────┬───────────────────────────┘
                           │ 每次取音
                           ▼
   ┌──────── 受约束生成内核（§4）和谐 ────────┐
   │ quantizePitch / quantizeRhythm           │
   │ transformMotif / voiceLead / seededPick  │  音高永远合法
   └───────────────────────┬──────────────────┘
                           ▼ 意图流
   ┌──── 三闸过滤 passesThreeGates（MUS-GEN-02）────┐
   │   clock量化 ∧ 调性过滤 ∧ motif/角色边界          │
   └───────────────────────┬─────────────────────────┘
                           ▼
   ┌──── 融合裁决 mixResolve（§2.2 / MUS-GEN-04）────┐
   │  频段领地 + 让路矩阵 + sidechain + send(HPF)     │  碰撞瞬态优先
   └───────────────────────┬─────────────────────────┘
                           ▼
                 带混音参数的意图流 ──►（音乐门面渲染，MUS-GEN-07）
```

---

## 6. 为什么"算法生成"仍"和谐"不"随机"

| 维度 | 无约束随机（禁） | 受约束生成（本规格） |
|---|---|---|
| 音高 | `Math.random()` 选半音 | 取自 `pitchSet`，root 重力 + voice-leading（`MUS-GEN-05`） |
| 落点 | 任意时间 | 吸附 slot16 网格（`MUS-GEN-02`、`MUS-DRUM-01`） |
| 变化 | 整条旋律重抽 | `transformMotif` 在 motif bank 内改 rhythm/octave/gate（修订 `MUS-LEAD-01`） |
| 随机位置 | 决定音符 | 只在"已合法候选集"里选控制变化（§4.5） |
| 可复现 | 不可复现 | 同 seed/state 逐音相同（`MUS-GEN-06`） |

五条机器保证：时钟量化、音池过滤、根音重力、motif 变换（非重采样）、种子化确定性。任一生成事件违反 → 三闸拦截。

---

## 7. 与现有规格的接口（生成器只是消费者）

| 生成器读取 | 来自结构 | 字段 |
|---|---|---|
| 房间/Boss 身份、根音、音阶、lane 配方 | `MusicProfile` | `id/bpm/mode/root/scale/laneRecipe/effectRecipe` |
| 强度→密度曲线 | `IntensityLayer[0..5]` | `drumDensity/bassDensity/cloudDensity/cueHandoff/fxSendDepth/transientGuard` |
| 调性闭包/情绪轴 | `HarmonyState` | `progression/shellFamily/pitchSet/voicingDensity/padGate/fxMotion` |
| 事件路由/限流 | `EventMapping` + `PhraseBook` | `targetLane/quantizeGrid/cooldownBeats/priority/maxStack/aggregate/intent/motifId` |
| 桥接模板 | `FXTransition`（7 模板） | `role/triggerWindow/pitchBoundary/tailBudget/sendAutomation/opensNewMelody` |
| 融合预算 | `mix_fx_budget` | 频段领地 / 让路矩阵 / sidechain / send HPF |

生成器**不新建并行系统**——它是上述 schema 的纯消费者（`MUS-GEN-07`）。

---

## 8. 生成合规验证

对生成输出跑四类审计（接 `MUS-VALID-01/02`、`MUS-GEN-06`）：

1. **调性合规**：每个 note.pitch ∈ `pitchSet ∩ scale`，否则 fail。
2. **时钟合规**：每个 onset ∈ slot16 网格；无墙钟驱动（`MUS-CLOCK-01`）。
3. **瞬态合规**：碰撞 one-shot 通道未被 sidechain、未挂长 reverb（`MUS-AUDIO-02`、`MUS-FX-03`）。
4. **无随机审计**：同 `(seed,profile,state,eventLog)` 跑两遍，逐音 diff 必须为空（`MUS-GEN-06`）；扫码禁裸 `Math.random()` 决定音高/落点。
5. **状态覆盖**：一个生成 session 能覆盖 groove/phrase/intensity/transition/pause 五态（接 `validation_gap_checklist`）。

---

## 9. 边界与禁止（修订版）

- **受约束生成允许；无约束随机仍禁**：随机只能进 §4.5 `seededPick` 的合法候选集（`MUS-GEN-01/05`）。
- 生成必须读 profile 约束，不硬编码全局根音；motif 用相对音程，迁移重定根（`MUS-KEY-01`、`MUS-SHARD-05`）。
- 碰撞瞬态优先权不可侵犯：生成声部一律让路（`MUS-AUDIO-02`、`MUS-FX-03`、`MUS-GEN-04`）。
- 不为每个 intensity 写独立整曲：强度=同 profile 内密度爬升（`MUS-INTENSITY-01`）。
- 算法只产"意图"，不在玩法/UI 建 `AudioContext`；渲染交音乐门面（`MUS-AUDIO-01`、`MUS-GEN-07`）。
- 本规格不写运行时代码：下一步才把 `tick()` 接进 demo/façade 做可听验证（接 `music_layer_demo_iteration_plan`）。
