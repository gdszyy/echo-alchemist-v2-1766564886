# 转场模板库 / FXTransition Templates v0.1

> 日期：2026-06-24
> 状态：P1-3，承接 `music_runtime_schema_v0.1.md :: §6 FXTransition` 与 `music_event_mapping_v0.1.md :: §4`，把 7 个桥接模板逐条落成可消费的数据。
> 一句话原则：**transition 是 bridge role，只连接上一句与下一句、挂在 phrase/section 边界、给碰撞留瞬态，永远 `opensNewMelody=false`，绝不开新旋律入口**（`MUS-FX-01`、`MUS-FX-02`、`MUS-FX-03`、`§3.5 禁止项`、`§3.6`）。

---

## 0. 模板字段约定

每个模板就是一条 `FXTransition`（`music_runtime_schema_v0.1.md :: §6`），字段一一对应：

| 模板字段 | schema 字段 | 取值约束 | 规则 |
|---|---|---|---|
| `id` | `id` | `fx.<name>` 命名空间 | `MUS-FX-01` |
| `role` | `role` | `pickup`/`fill`/`riser`/`build`/`impact`/`tail`/`preRoll` | `MUS-FX-01` |
| `triggerWindow` | `triggerWindow` | 拍序边界，永不逐事件即时插入 | `MUS-FX-01`、`§3.6` |
| `targetLanes` | `targetLanes` | `low`/`mid`/`high`/`fx` 子集 | `MUS-STEM-01` |
| `pitchBoundary` | `pitchBoundary` | `profileRoot`/`semitoneFriction`/`handoffTo:*`，**永不 random** | `MUS-FX-02`、`MUS-KEY-01` |
| `densityCurve` | `densityCurve` | `stutter`/`ramp`/`oneShot`/`decay` | `§3.6` |
| `tailBudget` | `tailBudget` | `{ maxBeats, sendOnly:true }`，给碰撞留瞬态 | `MUS-FX-03`、`MUS-AUDIO-02` |
| `sendAutomation` | `sendAutomation` | 转场期间 send 包络，不挂常驻长尾 | `MUS-FX-03` |
| `opensNewMelody` | `opensNewMelody` | **恒为 `false`** | `MUS-FX-01`、`§3.5` |

附加运行时元数据（不属于 schema，但模板需声明）：`intensityRange`（适用 intensity 档）、`triggerEvent`（来自 `event_mapping §4` 的事件，或标记 `structural`/`internal`）、`midiSources`（v0.11 `§13` 桥接 MIDI）。

> `tailBudget.sendOnly:true` 的语义：转场尾音只走效果器 send，不占新声部、不糊碰撞反馈（`MUS-FX-03`、`intensity 5 transientGuard`）。

---

## 1. 七模板总览

| id | role | triggerWindow | targetLanes | densityCurve | intensityRange | triggerEvent | 主 MIDI 源 |
|---|---|---|---|---|---|---|---|
| `fx.1barPickup` | `pickup` | `lastHalfBar` | `low` `fx` | `stutter→ramp` | 1–4 | internal（句起） | `ElectricBassASharpPickupStutter` |
| `fx.2barDrumFill` | `fill` | `sectionEnd` / `bossSkillPre` | `low` `fx` | `ramp` | 2–5 | `comboUp`(里程碑) / structural | `DrumSectionFillGrid` |
| `fx.4barRiser` (`fx.tensionRamp`) | `riser` | `4barBoundary` | `fx` `mid` | `ramp` | 3–5 | `danger` | `OverdrivenGuitarFFSharpTensionRamp` |
| `fx.8barBuild` | `build` | `8barBoundary` | `low` `mid` `high` `fx` | `ramp`(长) | 2→5 | structural（持续增压） | `DrumSectionFillGrid` + `TensionRamp` + `VoiceOohsSectionHandoffArc` |
| `fx.dropTrigger` | `impact` | `nextDownbeat` | `fx` `low` | `oneShot→release` | →5 | `dropTrigger` | `DrumImpactVoiceOohsLongTailCue` |
| `fx.roomClearTail` | `tail` | `sectionBoundary` | `fx` | `decay` | 收束降档 | `roomClear` | `DrumImpactVoiceOohsLongTailCue` + `VoiceOohsSectionHandoffArc` |
| `fx.bossWarningPreRoll` | `preRoll` | `bossSkillPre` (4/8 小节) | `fx` `mid` `low` | `ramp` | 维持/微升 | `bossWarning` | `VoiceOohsSectionHandoffArc` + `ElectricBassASharpPickupStutter` + `DrumSectionFillGrid` |

> 触发优先级沿用 `event_mapping §2.2`：`dropTrigger`(10) > `bossWarningPreRoll`/`roomClearTail`(9) > `4barRiser`(danger 8) > `2barDrumFill`(comboUp 7) > 其余。高优先转场抢占低优先转场，同一边界只落一个。

---

## 2. 逐模板详解

### 2.1 `fx.1barPickup` — 句起拾音

```json
{
  "id": "fx.1barPickup",
  "role": "pickup",
  "triggerWindow": "lastHalfBar",
  "targetLanes": ["low", "fx"],
  "pitchBoundary": "profileRoot",
  "densityCurve": "stutter→ramp",
  "tailBudget": { "maxBeats": 0.5, "sendOnly": true },
  "sendAutomation": { "filter": [0.3, 0.6] },
  "opensNewMelody": false,
  "intensityRange": [1, 4],
  "triggerEvent": "internal",
  "midiSources": ["FXTransition_ElectricBassASharpPickupStutter.mid"]
}
```

上一句末半小节的低音拾音，把动量交给下一句的 downbeat。取音锁 `profileRoot`（跨段时改 `handoffTo:bVII`），bass stutter 收束成 ramp。几乎不留尾（`maxBeats:0.5`），不占碰撞瞬态。**纯内部句法**，不绑玩法事件、不抢占任何事件转场。
追溯：`MUS-FX-01`、`MUS-FX-02`、`§3.6`。MIDI 的绝对根音 A#（`ElectricBassASharpPickupStutter`）只是 profile 内配置，**不当全局根音**（`MUS-KEY-01`）。

### 2.2 `fx.2barDrumFill` — 过桥鼓花

```json
{
  "id": "fx.2barDrumFill",
  "role": "fill",
  "triggerWindow": "sectionEnd",
  "targetLanes": ["low", "fx"],
  "pitchBoundary": "profileRoot",
  "densityCurve": "ramp",
  "tailBudget": { "maxBeats": 1, "sendOnly": true },
  "sendAutomation": { "reverb": [0.1, 0.3] },
  "opensNewMelody": false,
  "intensityRange": [2, 5],
  "triggerEvent": "comboUp",
  "midiSources": ["FXTransition_DrumSectionFillGrid.mid"]
}
```

section 末或 Boss 技能前的鼓花过桥，纯打击无音高内容。只在**显著连击里程碑**（`comboUp` 里程碑帧）用 fill 过桥，平时连击只走 `densityBump`、不放 fill（`event_mapping §4`）。reverb 浅、尾短，保留下一段碰撞空间。
追溯：`MUS-DRUM-01`、`MUS-FX-01`、`§3.6`。

### 2.3 `fx.4barRiser`（别名 `fx.tensionRamp`）— 危险增压

```json
{
  "id": "fx.4barRiser",
  "role": "riser",
  "triggerWindow": "4barBoundary",
  "targetLanes": ["fx", "mid"],
  "pitchBoundary": "semitoneFriction",
  "densityCurve": "ramp",
  "tailBudget": { "maxBeats": 1, "sendOnly": true },
  "sendAutomation": { "filter": [0.2, 0.8], "distortion": [0.1, 0.5] },
  "opensNewMelody": false,
  "intensityRange": [3, 5],
  "triggerEvent": "danger",
  "midiSources": ["FXTransition_OverdrivenGuitarFFSharpTensionRamp.mid"]
}
```

进入危险态后最近 4 小节边界触发的增压。**固定根音 F→F# 的半音摩擦**（`semitoneFriction`），是张力 riser，**不是 lead**——没有自由旋律，只在根音上半音摩擦推 filter/distortion 升压（`MUS-FX-02`）。`danger` 在 `event_mapping` 中 `debounce` 限流，避免反复触发风暴。
追溯：`MUS-FX-02`、`MUS-FX-01`、`§3.3 pressure`。别名 `fx.tensionRamp` 用于 `event_mapping §4 danger` 行的引用对齐。

### 2.4 `fx.8barBuild` — 长段爬升

```json
{
  "id": "fx.8barBuild",
  "role": "build",
  "triggerWindow": "8barBoundary",
  "targetLanes": ["low", "mid", "high", "fx"],
  "pitchBoundary": "handoffTo:profileRoot",
  "densityCurve": "ramp",
  "tailBudget": { "maxBeats": 2, "sendOnly": true },
  "sendAutomation": { "reverb": [0.2, 0.5], "filter": [0.3, 0.9] },
  "opensNewMelody": false,
  "intensityRange": [2, 5],
  "triggerEvent": "structural",
  "midiSources": [
    "FXTransition_DrumSectionFillGrid.mid",
    "FXTransition_OverdrivenGuitarFFSharpTensionRamp.mid",
    "FXTransition_VoiceOohsSectionHandoffArc.mid"
  ]
}
```

8 小节边界上的长爬升，把 intensity 从 2 一路推到 5。**结构性触发**（持续危险/强度爬坡的累积态），不绑单个玩法事件；三段 MIDI 分工——鼓花给节奏推进、tension ramp 给和声摩擦、voice oohs 给段末交接弧线。全 lane 参与但仍是 build 桥接，不开新旋律。
追溯：`MUS-FX-01`、`MUS-FX-02`、`MUS-INTENSITY-01`、`§3.6`。

### 2.5 `fx.dropTrigger` — 落点冲击

```json
{
  "id": "fx.dropTrigger",
  "role": "impact",
  "triggerWindow": "nextDownbeat",
  "targetLanes": ["fx", "low"],
  "pitchBoundary": "profileRoot",
  "densityCurve": "oneShot→release",
  "tailBudget": { "maxBeats": 2, "sendOnly": true },
  "sendAutomation": { "reverb": [0.5, 0.1], "delay": [0.3, 0.05] },
  "opensNewMelody": false,
  "intensityRange": [5, 5],
  "triggerEvent": "dropTrigger",
  "midiSources": ["FXTransition_DrumImpactVoiceOohsLongTailCue.mid"]
}
```

下一个 downbeat 上的 impact 落点，同时把 intensity 抬到 5。`oneShot→release` 单击后迅速回落，send 从高位快速衰减（reverb 0.5→0.1），**给碰撞反馈留瞬态**——这是 intensity 5 `transientGuard` 的硬约束（`MUS-FX-03`）。`dropTrigger` 在 `event_mapping` 中 `priority 10` 抢占一切、`cooldown once`。
追溯：`MUS-FX-01`、`MUS-FX-03`、`§3.2 intensity 5`。

### 2.6 `fx.roomClearTail` — 清屋长尾

```json
{
  "id": "fx.roomClearTail",
  "role": "tail",
  "triggerWindow": "sectionBoundary",
  "targetLanes": ["fx"],
  "pitchBoundary": "profileRoot",
  "densityCurve": "decay",
  "tailBudget": { "maxBeats": 4, "sendOnly": true },
  "sendAutomation": { "reverb": [0.3, 0.8], "delay": [0.2, 0.6] },
  "opensNewMelody": false,
  "intensityRange": [0, 3],
  "triggerEvent": "roomClear",
  "midiSources": [
    "FXTransition_DrumImpactVoiceOohsLongTailCue.mid",
    "FXTransition_VoiceOohsSectionHandoffArc.mid"
  ]
}
```

清屋后在 section 边界收尾：impact 一击 + voice 长尾（最长 4 拍），随后整体降档收束。长尾**只走 send（`sendOnly:true`），不占新声部**，所以即便 4 拍尾音也不挡下一房间起拍（`MUS-FX-03`、`§3.6`）。
追溯：`MUS-FX-03`、`MUS-FX-01`、`§3.6`。

### 2.7 `fx.bossWarningPreRoll` — Boss 预告

```json
{
  "id": "fx.bossWarningPreRoll",
  "role": "preRoll",
  "triggerWindow": "bossSkillPre",
  "targetLanes": ["fx", "mid", "low"],
  "pitchBoundary": "handoffTo:targetBossProfile",
  "densityCurve": "ramp",
  "tailBudget": { "maxBeats": 2, "sendOnly": true },
  "sendAutomation": { "reverb": [0.2, 0.6], "filter": [0.4, 0.8] },
  "opensNewMelody": false,
  "intensityRange": [3, 5],
  "triggerEvent": "bossWarning",
  "midiSources": [
    "FXTransition_VoiceOohsSectionHandoffArc.mid",
    "FXTransition_ElectricBassASharpPickupStutter.mid",
    "FXTransition_DrumSectionFillGrid.mid"
  ]
}
```

Boss 出现前 4/8 小节的 pre-roll：voice 弧线预告 + bass 拾音 + 鼓花推进，`pitchBoundary` 交接到**目标 Boss profile 的根音**（`handoffTo:targetBossProfile`），pre-roll 结束后随即 Boss profile swap（`§3.4`）。pre-roll 本身不开新旋律，只把动量与音高边界交给即将切入的 Boss profile。
追溯：`MUS-FX-01`、`§3.4`、`§3.6`。Boss 切换是 profile swap 改风味，**不直接覆盖情绪轴**（`§3.3`、`§3.4`）。

---

## 3. 模板 → 事件 / 转场触发映射

与 `music_event_mapping_v0.1.md :: §2.1 / §4` 双向对齐：

| 来源事件 | 触发模板 | 触发窗口 | 抢占优先级 | 备注 |
|---|---|---|---|---|
| `danger` | `fx.4barRiser`(`fx.tensionRamp`) | 危险态后最近 `4barBoundary` | 8 | `debounce`，半音摩擦增压 |
| `bossWarning` | `fx.bossWarningPreRoll` | Boss 前 4/8 小节 | 9 | pre-roll 后 profile swap |
| `dropTrigger` | `fx.dropTrigger` | `nextDownbeat` | 10 | impact + 抬到 intensity 5，留瞬态 |
| `roomClear` | `fx.roomClearTail` | `sectionBoundary` | 9 | impact + voice 长尾，尾音走 send |
| `comboUp`（里程碑） | `fx.2barDrumFill` | 里程碑所在 phrase 末 | 7 | 仅显著里程碑用 fill，平时 `densityBump` |
| —（结构性持续增压） | `fx.8barBuild` | `8barBoundary` | 结构层 | intensity 2→5 长爬升 |
| —（内部句起） | `fx.1barPickup` | `lastHalfBar` | 句法层 | 不绑事件、不抢占 |

> 同一边界若多模板候选，按 `event_mapping §2.2` 优先级取最高一个落地；其余仅更新状态不发声（`MUS-AUDIO-02`）。

---

## 4. MIDI 源交叉引用（v0.11 §13）

5 个桥接 MIDI 角色与模板的多对多映射：

| MIDI 文件 | 桥接角色 (schema §6) | 被哪些模板消费 |
|---|---|---|
| `FXTransition_DrumSectionFillGrid.mid` | `drumFillGrid` | `2barDrumFill`、`8barBuild`、`bossWarningPreRoll` |
| `FXTransition_OverdrivenGuitarFFSharpTensionRamp.mid` | `tensionRamp` | `4barRiser`、`8barBuild` |
| `FXTransition_ElectricBassASharpPickupStutter.mid` | `bassPickup` | `1barPickup`、`bossWarningPreRoll` |
| `FXTransition_VoiceOohsSectionHandoffArc.mid` | `voiceHandoff` | `8barBuild`、`roomClearTail`、`bossWarningPreRoll` |
| `FXTransition_DrumImpactVoiceOohsLongTailCue.mid` | `impactTail` | `dropTrigger`、`roomClearTail` |

铁律：MIDI 文件名里的绝对音高（A#、F/F#）只是该桥接片段的**内部配置**，落地时按当前 profile 的 `root` / `pitchBoundary` 重新定位，**绝不当成全局根音**（`MUS-KEY-01`、`MUS-SHARD-05`）。同 SHA 的重复 MIDI 只保留一次溯源，不叠权重（`MUS-VALID-02`）。

---

## 5. 边界与禁止

- transition 永远 `opensNewMelody=false`：只连接上一句与下一句，不作新旋律入口（`MUS-FX-01`、`§3.5 禁止项`）。
- 不逐玩法事件即时插转场：只挂 `phrase`/`section`/`bar` 边界窗口（`MUS-FX-01`、`§3.6`）。
- 不堆常驻长尾糊碰撞：`tailBudget.sendOnly=true` + 有限 `maxBeats`，给 brick/paddle 留瞬态（`MUS-FX-03`、`MUS-AUDIO-02`）。
- 不用随机音高做增压：riser/build 的张力来自固定根音半音摩擦，不是自由 lead（`MUS-FX-02`、`MUS-LEAD-01`）。
- 不在本文件接运行时代码：这是 `FXTransition` 池的数据规格，实现时进音乐门面统一调度（`MUS-AUDIO-01`）。
- 仅结构性/句法事件可触发转场；paddle/wall/brick 等碰撞只做 anchor，不触发转场（`event_mapping §6`、`MUS-AUDIO-02`）。
