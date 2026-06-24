# 音乐运行时数据结构规格 v0.1

> 日期：2026-06-24
> 状态：P0-1，从 `dark_alchemy_music_constraints_and_variants_v0.11.md` 把音乐语法落成「未来可实现的数据结构」。
> 边界：**只定义 schema，不写运行时代码、不接入 `src/audio.js`**（见 `music_system_next_todo_v0.1.md :: §4 暂不做`）。
> 命名约定：字段用 camelCase，贴近未来 JS 实现；枚举值用字符串常量；所有绝对音高只能作为 **profile 内部配置**，不得当全局根音（`MUS-SHARD-05`、`MUS-KEY-01`）。

---

## 0. 阅读约定

1. 每个结构都给出：**字段表（字段 / 类型 / 说明 / 合法值或示例 / 来源规则）**。
2. 来源规则列只填 v0.11 的规则 ID（如 `MUS-CLOCK-01`）或 MIDI 章节（如 `§13`），保证可追溯。
3. 文末 §10 给出「schema 字段 ← 规则 ID」反查表；§8/§9 给出普通房间与 Boss 两个完整 JSON 示例。
4. 事件只能驱动 `phrase / anchor / densityBump / sendBump / transitionRole` 五类音乐意图，**不允许碰撞直接生成随机旋律**（`MUS-PHRASE-01`、`MUS-LEAD-01`、`§3.5 禁止项`）。

---

## 1. 顶层关系与解析顺序

六个结构的归属关系：`MusicProfile` 是顶层容器，其余五个是它的字段或被它引用。

```text
MusicProfile (一个房间/Boss 的完整音乐身份)
├── identity            : id / bpm / mode / root / scale
├── laneRecipe          : low / mid / high / fx 四频段角色配方   (MUS-STEM-01)
├── effectRecipe        : 效果器 send 默认值与禁用项            (§3.4 / MUS-FX-03)
├── intensityLayers[0..5] : IntensityLayer 数组（同一 profile 内分层密度递进，不是 6 首歌）(MUS-INTENSITY-01)
├── harmonyStates[]     : HarmonyState 库（按情绪 ID 选，progression 由情绪轴决定）(MUS-CHORD-01/02)
├── phraseBookRefs[]    : 指向 PhraseBook（事件→量化乐句）      (MUS-PHRASE-01)
├── fxTransitions[]     : FXTransition 桥接角色池               (MUS-FX-01)
└── eventMap            : EventMapping（游戏事件→音乐意图，详表见 music_event_mapping_v0.1.md）
```

运行时解析顺序对齐 v0.11 `§2 变体决策树`（后状态不能推翻前硬状态）：

```text
1. Pause Veil?        → 命中则保留 fixed lane + 套 pause FX，关闭运动 lane   (MUS-PAUSE-01)
2. MusicProfile       → 锁 bpm / mode / root / scale / laneRecipe / effectRecipe / phraseBook 候选池
3. Stage + Intensity  → 选 HarmonyState（情绪 progression）+ IntensityLayer（密度档）  (§3.1 / §3.2)
4. Phrase Window 4/8  → 在受限 motif bank 抽 variation，末小节生成 transition   (MUS-PHRASE-01)
5. Section Window 8/16/32 → 控 stem 进出、FXTransition bridge role、cloud 开关  (MUS-FX-01 / MUS-SHARD-04)
6. Gameplay Event     → 量化到当前 grid/chord，触发 one-shot phrase 或 anchor   (MUS-CLOCK-01 / MUS-AUDIO-02)
```

> 时钟铁律：所有结构的时间字段一律用 `beat / bar / slot16`（16 分槽位 `0..15`）拍序语义，**墙钟秒只存在于调度边界**（`MUS-CLOCK-01`、`MUS-TEMPO-01`）。

---

## 2. MusicProfile

一个普通房间或一个 Boss 的完整音乐身份。Boss 差异必须来自 `tempo / mode / root / laneRecipe / effectRecipe / phraseBook`，不能只换 one-shot（`§3.4 限制`）。

| 字段 | 类型 | 说明 | 合法值 / 示例 | 来源 |
|---|---|---|---|---|
| `id` | string | profile 唯一标识，按 `域.风格.角色` 命名 | `"room.darkpsy.base"`、`"boss.crucible"` | `MUS-SHARD-05`（profile 分家） |
| `bpm` | number | 战斗网格基准速度，运行层归一到单一时钟 | `120` / `150` | `MUS-TEMPO-01`、`MUS-TEMPO-02` |
| `mode` | string | 调式风味 | `"phrygian"`、`"aeolian"`、`"harmonicMinor"`、`"occultPhrygian"` | `MUS-KEY-01`、`§3.4` |
| `root` | string | **profile 内部**根音（非全局根音） | `"F"`、`"G#"` | `MUS-KEY-01`、`MUS-SHARD-05` |
| `scale` | number[] | 相对半音音程集合（root=0），motif 用相对音程存储再转调 | `[0,1,3,5,7,8,10]`（Phrygian） | `MUS-KEY-01`、`MUS-SHARD-03` |
| `laneRecipe` | LaneRecipe | 四频段角色配方，见下表 | `{ low, mid, high, fx }` | `MUS-STEM-01` |
| `effectRecipe` | EffectRecipe | 效果器 send 默认深度与禁用项 | `{ reverb, delay, distortion, filter, sidechain }` | `MUS-FX-03`、`§3.4` |
| `intensityLayers` | IntensityLayer[] | 长度 6，下标即 intensity `0..5` | 见 §3 | `MUS-INTENSITY-01` |
| `harmonyStateRefs` | string[] | 本 profile 启用的情绪状态 ID | `["suspended","darkStable","pressure"]` | `MUS-CHORD-01`、`§3.3` |
| `phraseBookRefs` | string[] | 引用的 PhraseBook id | `["pb.room.darkpsy"]` | `MUS-PHRASE-01` |
| `fxTransitionRefs` | string[] | 可用的 FXTransition 角色 id | `["fx.drumFillGrid","fx.tensionRamp"]` | `MUS-FX-01` |
| `eventMapRef` | string | 指向 EventMapping 表 id | `"em.default"` | `MUS-LAYER-01` |

### 2.1 LaneRecipe 子结构

四频段分工，每个 lane 标 `role` 与 `stemType`（固定/阶段/Boss/phrase）（`MUS-STEM-01`）。

| 字段 | 类型 | 说明 | 合法值 / 示例 | 来源 |
|---|---|---|---|---|
| `low` | LaneSpec | 低频：kick / sub / bass spine | `{ role:"bassSpine", stemType:"stage", motifId:"offbeatRootSpine" }` | `MUS-BASS-01`、`MUS-DRUM-01` |
| `mid` | LaneSpec | 中频：pad / chord / root motor | `{ role:"emotionPad", stemType:"stage", motifId:"colorDroneGate" }` | `MUS-CHORD-01`、`MUS-CHORD-04` |
| `high` | LaneSpec | 高频：lead gesture / shard cloud / ghost | `{ role:"shardCloud", stemType:"phrase", motifId:"chordShardCloudBody" }` | `MUS-SHARD-01`、`§3.5` |
| `fx` | LaneSpec | 转场 / riser / impact / 尾音 | `{ role:"transition", stemType:"phrase", motifId:"—" }` | `MUS-FX-01` |

`LaneSpec` 字段：`role`（lane 职责）、`stemType`（`fixed`/`stage`/`boss`/`phrase`）、`motifId`（指向 §3.5 motif bank）、`maxDensityTier`（该 lane 允许的最高密度档）。

### 2.2 EffectRecipe 子结构

| 字段 | 类型 | 说明 | 合法值 / 示例 | 来源 |
|---|---|---|---|---|
| `reverb` | number | 全局混响 send 基准（0-1） | `0.25` | `MUS-FX-03`、`MUS-PAUSE-01` |
| `delay` | number | 延迟 send 基准（0-1） | `0.15` | `§3.6` |
| `distortion` | number | 失真/驱动量，转场张力用 | `0.1` | `MUS-FX-02` |
| `filter` | string | 主滤波倾向 | `"lowpass"`、`"bandpass"`、`"highpass"` | `§3.4` |
| `sidechain` | boolean | 是否对 kick 做 duck | `true` | `§3.4`（Crucible duck） |
| `forbidden` | string[] | 该 profile 禁用的效果 | `["longReverbOnHigh"]`（高频长混响会糊砖块反馈） | `MUS-FX-03`、`MUS-AUDIO-02` |

---

## 3. IntensityLayer

`intensityLayers[0..5]`，描述**同一 profile 内**从待机到爆发的分层密度递进。换档只改密度/gate/stem/send，不切到另一首歌（`MUS-INTENSITY-01`）；强度上升**先改密度再改音高集合**（`MUS-INTENSITY-02`）。

| 字段 | 类型 | 说明 | 合法值 / 示例 | 来源 |
|---|---|---|---|---|
| `level` | number | 强度档，等于数组下标 | `0`-`5` | `MUS-INTENSITY-01` |
| `drumDensity` | string | 鼓网格密度档 | `"anchor"`(0/4/8/12) / `"pickup"` / `"subdivide"` / `"roll"` | `MUS-DRUM-01`、`§12` |
| `bassDensity` | string | bass spine 密度档 | `"none"` / `"offbeat"`(2/6/10/14) / `"even"`(0..14) / `"fullMotor"`(16分) | `MUS-BASS-01`、`MUS-BASS-02` |
| `cloudDensity` | string | chord-shard cloud 密度 | `"off"` / `"sparse"` / `"body"` / `"dense"` | `MUS-SHARD-01`、`MUS-SHARD-03` |
| `cueHandoff` | boolean | 是否允许稀疏 cue 提示本档进出 | `true` / `false` | `MUS-INTENSITY-03` |
| `fxSendDepth` | number | 本档整体 FX send 缩放（0-1） | `0.2`(低) → `0.8`(高) | `MUS-FX-03`、`§3.2` |
| `leadAllowed` | boolean | 是否允许 lead 手势进入（仅 ≥4 且短手势） | `false`(0-3) / `true`(4-5) | `§3.5 禁止项` |
| `transientGuard` | boolean | 是否强制为碰撞反馈保留瞬态空间 | `true`（intensity 5 必须 true） | `MUS-AUDIO-02`、`§3.2` |

档位语义（来自 `§3.2` + `§12`）：`0` 暗脉冲+稀疏 voice/pad；`1` 加 low bass spine offbeat；`2` 加暗色 pad/stab；`3` 连击层+acid+ghost perc；`4` roll/riser/滤波打开、lead 短进入；`5` Drop/Frenzy 全频爆发但保留瞬态。

> 反例守护：稀疏 cue（`cueHandoff`）只提示边界，不能单独当成完整强度层（`MUS-INTENSITY-03`）。

---

## 4. HarmonyState

按情绪 ID 选取的 section 级和声状态。**progression 由情绪轴（stage+intensity）决定，Boss profile 只改风味不改情绪职责**（`§3.3 限制`、`§3.4 限制`）。情绪不是每小节抽卡，先定状态再在状态内生成 voicing/gate/filter 变体（`MUS-CHORD-02`）。

| 字段 | 类型 | 说明 | 合法值 / 示例 | 来源 |
|---|---|---|---|---|
| `emotionId` | string | 情绪状态键 | `"suspended"`/`"darkStable"`/`"pressure"`/`"bossRitual"`/`"frenzy"` | `§3.3` |
| `progression` | string[] | 相对级数进行（非绝对和弦） | `["i","bII","i","VII"]`(darkStable) | `MUS-CHORD-01`、`§3.3` |
| `shellFamily` | string | section shell 家族类型 | `"pedal"`/`"partialTriad"`/`"borrowedTriad"`/`"chordCloud"`/`"sparseCue"` | `MUS-CHORD-03`、`MUS-CHORD-05` |
| `pitchSet` | number[] | 该状态可用的相对半音色彩集（root=0） | `[0,3,7]`(root/b3/5) | `MUS-CHORD-06`、`MUS-SHARD-03` |
| `voicingDensity` | string | 和声密度 | `"single"`/`"dyad"`/`"triad"`/`"cluster"` | `MUS-CHORD-03`、`MUS-SHARD-06` |
| `padGate` | object | pad gate 律动 | `{ grid:"0.5beat", pattern:"motor" }` | `MUS-CHORD-04` |
| `pedalTone` | string\|null | section pedal 音（相对级数） | `"bVI"` / `null` | `MUS-CHORD-07` |
| `fxMotion` | string[] | 该状态允许的和声运动效果 | `["phaser","reverb","filterSweep"]` | `MUS-CHORD-04`、`colorDroneGate` |
| `rootGravity` | string | 身体重心音（防止密音漂浮） | `"root"`（F profile=F/C；G# profile=G#） | `MUS-CHORD-06`、`MUS-SHARD-03` |

情绪→progression 对照（`§3.3` 表，相对级数，转调由 profile.root 决定）：

| emotionId | progression | 触发逻辑 |
|---|---|---|
| `suspended` | `i5 drone` | pause 或 intensity ≤ 1 |
| `darkStable` | `i - bII - i - VII` | room 且 intensity ≈ 2 |
| `pressure` | `i - bII - i - V7` | surge 或 intensity ≥ 3 |
| `bossRitual` | `i - bII - V7 - i` | boss 中低强度 |
| `frenzy` | `i - bII - dim - V7` | boss 且 intensity ≥ 4 |

---

## 5. PhraseBook

事件→量化乐句的映射库。Phrase 是吸附到当前 chord/grid 的量化乐句，不是孤立碰撞声堆叠（`MUS-PHRASE-01`）；高频事件必须聚合限流（`MUS-AUDIO-02`）。一个 PhraseBook 是若干 `PhraseEntry` 的集合。

| 字段 | 类型 | 说明 | 合法值 / 示例 | 来源 |
|---|---|---|---|---|
| `id` | string | PhraseBook 标识 | `"pb.room.darkpsy"` | `MUS-PHRASE-01` |
| `entries` | PhraseEntry[] | 乐句条目数组 | 见下 | — |

`PhraseEntry` 字段：

| 字段 | 类型 | 说明 | 合法值 / 示例 | 来源 |
|---|---|---|---|---|
| `eventType` | string | 触发该乐句的游戏事件 | `"brickBreak"`、`"comboUp"` | `MUS-LAYER-01` |
| `quantizeGrid` | string | 吸附栅格 | `"1/16"`/`"1/8"`/`"1/4"`/`"1bar"` | `MUS-CLOCK-01`、`MUS-PHRASE-01` |
| `motifId` | string | 指向 §3.5 motif bank | `"minorChordShard"`、`"offbeatRootSpine"` | `§3.5` |
| `cooldownBeats` | number | 同一乐句最小冷却（拍） | `0.5`、`2` | `MUS-AUDIO-02` |
| `priority` | number | 抢占优先级（高覆盖低） | `0`(低)–`10`(高) | `MUS-AUDIO-02` |
| `maxPolyphony` | number | 同时发声上限（限流） | `1`–`4` | `MUS-AUDIO-02`、`MUS-DENSE-01` |
| `aggregate` | string | 高频聚合策略 | `"throttle"`/`"debounce"`/`"countToAnchor"` | `MUS-AUDIO-02`、`MUS-DENSE-01` |
| `pitchSource` | string | 取音来源（禁止随机） | `"currentChordShell"`/`"profilePitchSet"`/`"rootOnly"` | `MUS-SHARD-01`、`§3.5 禁止项` |

> `template ⊇ anchors`：玩家只驱动少数 anchor，其余 autoFill 是自动音乐层（`MUS-DENSE-01`）。`pitchSource` 永远不能是 `"random"`。

---

## 6. FXTransition

转场桥接角色，只挂在 phrase/section 边界，不能变成持续前景旋律（`MUS-FX-01`）。它连接上一句和下一句，不开新旋律入口（`§3.5 禁止项`）。

| 字段 | 类型 | 说明 | 合法值 / 示例 | 来源 |
|---|---|---|---|---|
| `id` | string | 角色标识 | `"fx.drumFillGrid"`、`"fx.tensionRamp"` | `MUS-FX-01` |
| `role` | string | 桥接角色类型 | `"drumFillGrid"`/`"tensionRamp"`/`"bassPickup"`/`"voiceHandoff"`/`"impactTail"` | `§3.6`、`§13` |
| `triggerWindow` | string | 触发窗口（拍序） | `"lastHalfBar"`/`"4barBoundary"`/`"8barBoundary"`/`"bossSkillPre"` | `MUS-FX-01` |
| `targetLanes` | string[] | 作用 lane | `["fx"]`、`["low","fx"]` | `MUS-STEM-01` |
| `pitchBoundary` | string | 音高边界（继承 profile 或明确 handoff） | `"profileRoot"`/`"semitoneFriction"`/`"handoffTo:bVII"` | `MUS-FX-02` |
| `densityCurve` | string | 密度曲线 | `"ramp"`/`"stutter"`/`"oneShot"`/`"decay"` | `§3.6` |
| `tailBudget` | object | 尾音预算（给碰撞留瞬态） | `{ maxBeats:2, sendOnly:true }` | `MUS-FX-03`、`MUS-AUDIO-02` |
| `sendAutomation` | object | 转场期间 send 自动化 | `{ reverb:[0.2,0.6], delay:[0.1,0.4] }` | `MUS-FX-03` |
| `opensNewMelody` | boolean | 是否开新旋律（必须恒为 false） | `false` | `MUS-FX-01`、`§3.5 禁止项` |

五个 v0.11 MIDI 桥接角色（`§13`）：`drumFillGrid`←`FXTransition_DrumSectionFillGrid.mid`；`tensionRamp`←`FXTransition_OverdrivenGuitarFFSharpTensionRamp.mid`；`bassPickup`←`FXTransition_ElectricBassASharpPickupStutter.mid`；`voiceHandoff`←`FXTransition_VoiceOohsSectionHandoffArc.mid`；`impactTail`←`FXTransition_DrumImpactVoiceOohsLongTailCue.mid`。

---

## 7. EventMapping

游戏事件→音乐意图的总表。**任一事件只能落到 `phrase / anchor / densityBump / sendBump / transitionRole` 五类之一**，不允许映射成随机 lead 音符（`MUS-PHRASE-01`、`§3.5 禁止项`）。完整 13 事件逐条规格见 `music_event_mapping_v0.1.md`，此处只定义结构。

`EventMapping` 字段：`id`、`entries: EventMapEntry[]`。

`EventMapEntry` 字段：

| 字段 | 类型 | 说明 | 合法值 / 示例 | 来源 |
|---|---|---|---|---|
| `sourceEvent` | string | 玩法事件名（`music:*` 消费 `ball:*`/`brick:*`/`combo:*`/`boss:*`） | `"brickBreak"` | `MUS-LAYER-01`、`MUS-EVENT-01` |
| `musicIntent` | string | 音乐意图类别 | `"phrase"`/`"anchor"`/`"densityBump"`/`"sendBump"`/`"transitionRole"` | `MUS-PHRASE-01` |
| `targetLane` | string | 目标 lane | `"low"`/`"mid"`/`"high"`/`"fx"` | `MUS-STEM-01` |
| `quantizeGrid` | string | 量化栅格 | `"1/16"`/`"1/8"`/`"1/4"`/`"1bar"` | `MUS-CLOCK-01` |
| `cooldownBeats` | number | 冷却（拍） | `0`–`4` | `MUS-AUDIO-02` |
| `priority` | number | 优先级 | `0`–`10` | `MUS-AUDIO-02` |
| `maxStack` | number | 叠加/复音上限 | `1`–`4` | `MUS-AUDIO-02` |
| `aggregate` | string | 聚合策略 | `"throttle"`/`"debounce"`/`"countToAnchor"`/`"none"` | `MUS-AUDIO-02` |
| `triggersTransition` | string\|null | 触发的 FXTransition id | `"fx.impactTail"` / `null` | `MUS-FX-01` |
| `ruleRefs` | string[] | 追溯规则 | `["MUS-PHRASE-01","MUS-DENSE-01"]` | — |

---

## 8. 普通房间 Profile JSON 示例

低强度暗黑房间，G# minor/bVII profile，开场稀疏悬浮，随 section 增密（`MUS-LOW-01`、`MUS-STEM-02`、`§3.5 Low-room G# profile`）。

```json
{
  "id": "room.darkpsy.base",
  "bpm": 150,
  "mode": "occultPhrygian",
  "root": "G#",
  "scale": [0, 2, 3, 5, 7, 8, 10],
  "laneRecipe": {
    "low":  { "role": "bassSpine",  "stemType": "stage",  "motifId": "spineDensityLadder", "maxDensityTier": "even" },
    "mid":  { "role": "emotionPad", "stemType": "stage",  "motifId": "colorDroneGate",     "maxDensityTier": "triad" },
    "high": { "role": "ghostMirror","stemType": "phrase", "motifId": "octaveMirrorGhost",  "maxDensityTier": "sparse" },
    "fx":   { "role": "transition", "stemType": "phrase", "motifId": "-",                  "maxDensityTier": "oneShot" }
  },
  "effectRecipe": {
    "reverb": 0.3, "delay": 0.15, "distortion": 0.05,
    "filter": "lowpass", "sidechain": false,
    "forbidden": ["longReverbOnHigh"]
  },
  "intensityLayers": [
    { "level": 0, "drumDensity": "anchor",    "bassDensity": "none",     "cloudDensity": "off",    "cueHandoff": true,  "fxSendDepth": 0.2, "leadAllowed": false, "transientGuard": true },
    { "level": 1, "drumDensity": "anchor",    "bassDensity": "offbeat",  "cloudDensity": "off",    "cueHandoff": true,  "fxSendDepth": 0.3, "leadAllowed": false, "transientGuard": true },
    { "level": 2, "drumDensity": "pickup",    "bassDensity": "offbeat",  "cloudDensity": "sparse", "cueHandoff": true,  "fxSendDepth": 0.4, "leadAllowed": false, "transientGuard": true },
    { "level": 3, "drumDensity": "pickup",    "bassDensity": "even",     "cloudDensity": "body",   "cueHandoff": true,  "fxSendDepth": 0.55,"leadAllowed": false, "transientGuard": true },
    { "level": 4, "drumDensity": "subdivide", "bassDensity": "even",     "cloudDensity": "body",   "cueHandoff": true,  "fxSendDepth": 0.7, "leadAllowed": true,  "transientGuard": true },
    { "level": 5, "drumDensity": "roll",      "bassDensity": "fullMotor","cloudDensity": "dense",  "cueHandoff": false, "fxSendDepth": 0.8, "leadAllowed": true,  "transientGuard": true }
  ],
  "harmonyStateRefs": ["suspended", "darkStable", "pressure"],
  "phraseBookRefs": ["pb.room.darkpsy"],
  "fxTransitionRefs": ["fx.drumFillGrid", "fx.bassPickup", "fx.impactTail"],
  "eventMapRef": "em.default"
}
```

## 9. Boss Profile JSON 示例

机械炼金 Boss（Crucible），techno/acid/metallic，Phrygian pressure，duck + 短 rumble（`§3.4 Crucible`、`MUS-SHARD-05`）。情绪 progression 仍由情绪轴给，Boss 只接管风味与 PhraseBook。

```json
{
  "id": "boss.crucible",
  "bpm": 128,
  "mode": "phrygian",
  "root": "F",
  "scale": [0, 1, 3, 5, 7, 8, 10],
  "laneRecipe": {
    "low":  { "role": "bassSpine",  "stemType": "boss",   "motifId": "shardRootMotor",      "maxDensityTier": "fullMotor" },
    "mid":  { "role": "chordCloud", "stemType": "boss",   "motifId": "chordShardCloudBody", "maxDensityTier": "cluster" },
    "high": { "role": "acidLead",   "stemType": "phrase", "motifId": "b2Sting",             "maxDensityTier": "sparse" },
    "fx":   { "role": "transition", "stemType": "phrase", "motifId": "-",                   "maxDensityTier": "ramp" }
  },
  "effectRecipe": {
    "reverb": 0.18, "delay": 0.12, "distortion": 0.25,
    "filter": "bandpass", "sidechain": true,
    "forbidden": ["longReverbOnHigh", "wholeToneRandomLead"]
  },
  "intensityLayers": [
    { "level": 0, "drumDensity": "anchor",    "bassDensity": "offbeat",  "cloudDensity": "off",    "cueHandoff": true,  "fxSendDepth": 0.25, "leadAllowed": false, "transientGuard": true },
    { "level": 1, "drumDensity": "pickup",    "bassDensity": "even",     "cloudDensity": "sparse", "cueHandoff": true,  "fxSendDepth": 0.35, "leadAllowed": false, "transientGuard": true },
    { "level": 2, "drumDensity": "pickup",    "bassDensity": "even",     "cloudDensity": "body",   "cueHandoff": true,  "fxSendDepth": 0.45, "leadAllowed": false, "transientGuard": true },
    { "level": 3, "drumDensity": "subdivide", "bassDensity": "fullMotor","cloudDensity": "body",   "cueHandoff": true,  "fxSendDepth": 0.6,  "leadAllowed": true,  "transientGuard": true },
    { "level": 4, "drumDensity": "subdivide", "bassDensity": "fullMotor","cloudDensity": "dense",  "cueHandoff": true,  "fxSendDepth": 0.75, "leadAllowed": true,  "transientGuard": true },
    { "level": 5, "drumDensity": "roll",      "bassDensity": "fullMotor","cloudDensity": "dense",  "cueHandoff": false, "fxSendDepth": 0.9,  "leadAllowed": true,  "transientGuard": true }
  ],
  "harmonyStateRefs": ["pressure", "bossRitual", "frenzy"],
  "phraseBookRefs": ["pb.boss.crucible"],
  "fxTransitionRefs": ["fx.drumFillGrid", "fx.tensionRamp", "fx.bassPickup", "fx.impactTail"],
  "eventMapRef": "em.boss"
}
```

> 两个 profile 的 `root`/`scale` 不同（G# vs F），**dense cloud 不混成全局音池**（`MUS-SHARD-05`）；迁移只保留结构，不复制绝对音高（`MUS-VALID-02`）。

---

## 10. Schema 字段 ← 规则 ID 反查表

| schema 字段 | 落地的规则 |
|---|---|
| `MusicProfile.bpm` / 所有时间字段 | `MUS-CLOCK-01`、`MUS-TEMPO-01`、`MUS-TEMPO-02` |
| `MusicProfile.root` / `scale` / profile 分家 | `MUS-KEY-01`、`MUS-SHARD-05`、`MUS-VALID-02` |
| `LaneRecipe`（low/mid/high/fx + stemType） | `MUS-STEM-01` |
| `IntensityLayer.*Density` / `level` | `MUS-INTENSITY-01`、`MUS-INTENSITY-02`、`§12` |
| `IntensityLayer.cueHandoff` | `MUS-INTENSITY-03` |
| `IntensityLayer.transientGuard` | `MUS-AUDIO-02`、`§3.2`（intensity 5 留瞬态） |
| `HarmonyState.progression` / `emotionId` | `MUS-CHORD-01`、`§3.3` |
| `HarmonyState.shellFamily` / `pitchSet` / `rootGravity` | `MUS-CHORD-03`、`MUS-CHORD-05`、`MUS-CHORD-06`、`MUS-SHARD-03` |
| `HarmonyState.padGate` / `pedalTone` | `MUS-CHORD-04`、`MUS-CHORD-07` |
| `PhraseBook.entries.quantizeGrid` | `MUS-CLOCK-01`、`MUS-PHRASE-01` |
| `PhraseBook.entries.cooldown/priority/maxPolyphony/aggregate` | `MUS-AUDIO-02`、`MUS-DENSE-01` |
| `PhraseBook.entries.pitchSource`（禁随机） | `MUS-SHARD-01`、`MUS-LEAD-01`、`§3.5 禁止项` |
| `FXTransition.role` / `triggerWindow` / `opensNewMelody=false` | `MUS-FX-01`、`§3.6`、`§13` |
| `FXTransition.pitchBoundary` | `MUS-FX-02` |
| `FXTransition.tailBudget` / `sendAutomation` | `MUS-FX-03` |
| `EventMapping.musicIntent`（五类） | `MUS-PHRASE-01`、`MUS-LAYER-01` |
| `EventMapping.aggregate` / `maxStack` | `MUS-AUDIO-02` |
| Pause 行为（保留 fixed + pause FX） | `MUS-PAUSE-01` |

---

## 11. 边界与不做

- 本文件**不写运行时代码**，不接入 `src/audio.js`；字段命名贴近未来 JS 实现，供后续 demo data 层与门面参考。
- 不引入外部音乐 DSL / Strudel runtime；作者层 mini-notation 只在加载层编译（`MUS-DSL-01`）。
- 不把任何绝对音高硬编码为全局根音（`MUS-KEY-01`、`MUS-SHARD-05`）。
- 不为每个 intensity 写独立歌曲；`intensityLayers` 是同一 profile 内的密度递进（`MUS-INTENSITY-01`）。
- 不把碰撞映射成随机旋律；`PhraseEntry.pitchSource` 禁止 `"random"`（`§3.5 禁止项`）。
- 后续如实现，应同步更新 `.cursor/rules/audio.md` 并保持玩法事件与音乐表现层分离（`MUS-LAYER-01`、`MUS-AUDIO-01`）。


