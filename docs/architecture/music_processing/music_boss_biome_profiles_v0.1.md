# Boss / Biome 音乐配置 / Boss Biome Profiles v0.1

> 日期：2026-06-24
> 状态：P1-1，承接 `music_runtime_schema_v0.1.md :: §1 MusicProfile / §9 Boss JSON`，把 3 个 Boss 生态逐条落成可消费的 `MusicProfile`。
> 一句话原则：**Boss profile 只换风味（音色 / voicing / shellFamily / BPM / mode），不直接覆盖情绪轴；根音是 profile 内配置不是全局根音；分层是同 profile 内的密度爬升，转场只桥接不开新旋律**（`§3.3`、`§3.4`、`MUS-KEY-01`、`MUS-SHARD-05`、`MUS-INTENSITY-01`、`MUS-FX-01`）。

---

## 0. 三 Boss 总览

| id | 主题 | genre / 质感 | bpm | root | mode | emotionId（情绪职能） |
|---|---|---|---|---|---|---|
| `boss.crucible` | 机械炼金 | acid techno / industrial · 金属 | 128 | F | phrygian | `bossRitual → pressure` |
| `boss.venom` | 毒性腐化 | trap / phonk · 黏液 | 140 (半拍 70 感) | A | phrygianDominant | `pressure → frenzy` |
| `boss.abyssRite` | 深渊仪式 | dark psy / gothic · 教堂 | 150 | G# | harmonicMinor | `bossRitual` |

> 三者 `emotionId` 取自共享情绪轴（`§3.3`）；Boss 之间的差异是**风味**（genre/音色/mode/voicing），不是新造情绪（`§3.4`）。`boss.crucible` 与 `music_runtime_schema §9` 的坩埚示例同源、在此细化到 intensity 全档。

---

## 1. 三 Boss 共享约束（先读）

落地任一 Boss profile 前，下列约束对三者一致生效：

- **根音是 profile 内配置**：`root`（F / A / G#）只在该 profile 内有效，MIDI 文件名里的绝对音高（A#、F/F#）按本 profile `root` 重新定位，**绝不当全局根音**（`MUS-KEY-01`、`MUS-SHARD-05`）。
- **intensity 0–5 是同 profile 内的分层密度爬升**，不是 6 首独立 loop（`MUS-INTENSITY-01/02/03`）。
- **取音永远锁** `rootOnly / currentChordShell / profilePitchSet`，lead/shard 即便是该 Boss 的标志音色也不开随机旋律（`MUS-LEAD-01`、`MUS-SHARD-01/05`）。
- **转场只桥接**：Boss 用的 `fx.*` 模板永远 `opensNewMelody=false`、挂边界、留瞬态（`MUS-FX-01/03`，见 `music_transition_templates_v0.1.md`）。
- **Pause Veil 是决策树第 1 层**：每个 Boss 给自己的纱罩风味，但语义一致——渐变蒙纱、密度落 floor、时钟不丢（`MUS-CLOCK-01`）。
- **情绪轴不被 Boss 覆盖**：Boss 切换走 profile swap 改风味，`emotionId` 的职能（suspended/pressure/bossRitual/frenzy）由情绪轴决定（`§3.3`、`§3.4`、`MUS-CHORD-01/02`）。

---

## 2. `boss.crucible` · 机械炼金

acid techno / 工业金属。冷峻、机械、不停歇的高压感。

```json
{
  "id": "boss.crucible",
  "bpm": 128,
  "mode": "phrygian",
  "root": "F",
  "scale": "F phrygian",
  "laneRecipe": {
    "low":  "four-on-floor kick + acid303 bass motor",
    "mid":  "metallic clank percussion grid",
    "high": "resonant acid stabs (chord shell)",
    "fx":   "filter sweep + metallic plate send"
  },
  "effectRecipe": { "reverb": "metallicPlate", "delay": "tightSync", "drive": "industrial" },
  "intensityLayers": [
    { "level": 0, "drumDensity": 0.0, "bassDensity": 0.0, "cloudDensity": 0.1, "cueHandoff": false, "leadAllowed": false, "transientGuard": false },
    { "level": 1, "drumDensity": 0.4, "bassDensity": 0.0, "cloudDensity": 0.1, "cueHandoff": false, "leadAllowed": false, "transientGuard": false },
    { "level": 2, "drumDensity": 0.5, "bassDensity": 0.6, "cloudDensity": 0.2, "cueHandoff": false, "leadAllowed": false, "transientGuard": false },
    { "level": 3, "drumDensity": 0.7, "bassDensity": 0.7, "cloudDensity": 0.3, "cueHandoff": true,  "leadAllowed": false, "transientGuard": false },
    { "level": 4, "drumDensity": 0.8, "bassDensity": 0.8, "cloudDensity": 0.6, "cueHandoff": true,  "leadAllowed": false, "transientGuard": true  },
    { "level": 5, "drumDensity": 1.0, "bassDensity": 1.0, "cloudDensity": 0.8, "cueHandoff": true,  "leadAllowed": true,  "transientGuard": true  }
  ],
  "harmonyStateRefs": ["pressure", "bossRitual"],
  "fxTransitionRefs": ["fx.4barRiser", "fx.2barDrumFill", "fx.dropTrigger", "fx.bossWarningPreRoll"],
  "phraseBookRefs": ["crucible.acidStab", "crucible.metalCue"],
  "eventMapRef": "default13"
}
```

- **lane 配方**：`low` four-on-floor kick 锁拍 + acid 303 根音马达（16 分音 octave 推进）；`mid` 金属敲击网格；`high` 共振 acid stabs，锁 `currentChordShell`；`fx` filter sweep + 金属板混响 send。
- **intensity 计划**：0 底噪金属 tick → 1 进 kick → 2 进 303 bass spine（root motor）→ 3 进金属打击网格 + cue handoff → 4 进 acid stabs 云体、`transientGuard` 开 → 5 全开 + acid lead gate 放开（仍锁 chord shell）。
- **pad shell family**：phrygian bII shell（F–G♭ 摩擦），金属共振音色。
- **bass spine**：acid 303 on root F，octave-driven 16th motor（`rootOnly`/root motor，`MUS-SHARD` 根音引力）。
- **lead / shard 上限**：stabs 与 acid lead 全锁 `currentChordShell`，仅 intensity 5 放 lead gate，**不自由旋律**（`MUS-SHARD-05`、`MUS-LEAD-01`）。
- **transition 角色**：危险 `fx.4barRiser`、里程碑 `fx.2barDrumFill`、落点 `fx.dropTrigger`、入场 `fx.bossWarningPreRoll`。
- **pause veil**：低通 + 金属板混响冻结，密度落 floor，时钟不丢。
- **emotionId**：`pressure`（机械不停歇）为主、入场仪式段借 `bossRitual`——职能取自情绪轴，acid/金属只是风味（`§3.3`、`§3.4`）。

---

## 3. `boss.venom` · 毒性腐化

trap / phonk，黏液腐蚀质感。半拍沉重、失真 808、cowbell 旋律。本 Boss 持有 `poisonBreak` 元素（`§3.4 Venom`）。

```json
{
  "id": "boss.venom",
  "bpm": 140,
  "mode": "phrygianDominant",
  "root": "A",
  "scale": "A phrygian dominant",
  "laneRecipe": {
    "low":  "distorted 808 slide bass (slime)",
    "mid":  "phonk cowbell motif + trap hat rolls",
    "high": "pitched vox chops (chord shell)",
    "fx":   "slime delay/filter + bitcrush send"
  },
  "effectRecipe": { "reverb": "darkRoom", "delay": "slimeFilter", "drive": "bitcrush" },
  "intensityLayers": [
    { "level": 0, "drumDensity": 0.0, "bassDensity": 0.1, "cloudDensity": 0.0, "cueHandoff": false, "leadAllowed": false, "transientGuard": false },
    { "level": 1, "drumDensity": 0.4, "bassDensity": 0.1, "cloudDensity": 0.0, "cueHandoff": false, "leadAllowed": false, "transientGuard": false },
    { "level": 2, "drumDensity": 0.5, "bassDensity": 0.7, "cloudDensity": 0.1, "cueHandoff": false, "leadAllowed": false, "transientGuard": false },
    { "level": 3, "drumDensity": 0.6, "bassDensity": 0.8, "cloudDensity": 0.2, "cueHandoff": true,  "leadAllowed": false, "transientGuard": false },
    { "level": 4, "drumDensity": 0.8, "bassDensity": 0.9, "cloudDensity": 0.5, "cueHandoff": true,  "leadAllowed": false, "transientGuard": true  },
    { "level": 5, "drumDensity": 1.0, "bassDensity": 1.0, "cloudDensity": 0.7, "cueHandoff": true,  "leadAllowed": true,  "transientGuard": true  }
  ],
  "harmonyStateRefs": ["pressure", "frenzy"],
  "fxTransitionRefs": ["fx.4barRiser", "fx.dropTrigger", "fx.roomClearTail", "fx.bossWarningPreRoll"],
  "phraseBookRefs": ["venom.cowbell", "venom.voxChop", "venom.poisonCell"],
  "eventMapRef": "default13"
}
```

- **lane 配方**：`low` 失真 808 滑音贝斯（黏液下坠）；`mid` phonk cowbell 动机 + trap hat rolls；`high` 变调 vox chops，锁 `currentChordShell`；`fx` slime delay/filter + bitcrush send。
- **intensity 计划**：0 失谐 drone + 稀疏 808 thud → 1 进 trap hi-hat 骨架 → 2 进失真 808 滑音 spine → 3 进 cowbell 动机（root motor、chord-locked）+ cue handoff → 4 进 vox chop 云体、`transientGuard` 开 → 5 全开 hat-roll frenzy + slime lead gate（chord-locked）。
- **pad shell family**：phrygian-dominant shell（A–B♭ 摩擦 + C# 异国色），腐蚀失谐。
- **bass spine**：失真 808 滑音 on root A，半拍重拍驱动。
- **lead / shard 上限**：cowbell 动机与 vox chops 全锁 chord shell；`poisonBreak` 的 phrase 取 `currentChordShell` 的半音 cell（`event_mapping` poison 行），**不随机**（`MUS-SHARD-05`、`MUS-CHORD-03`）。
- **transition 角色**：危险 `fx.4barRiser`、黏液落点 `fx.dropTrigger`、清屋 `fx.roomClearTail`、入场 `fx.bossWarningPreRoll`。
- **pause veil**：slime 低通 + bitcrush wash，密度落 floor，时钟不丢。
- **emotionId**：`pressure → frenzy`（腐蚀逼近时升 frenzy）——职能取自情绪轴，trap/phonk/黏液只是风味（`§3.3`、`§3.4`）。

---

## 4. `boss.abyssRite` · 深渊仪式

dark psy / gothic，教堂仪式质感。滚动 psy bass、和声小调的增二度色、哥特合唱长尾。与基础房间 `room.darkpsy.base`（G# occultPhrygian）同调心、mode 暗化为和声小调，作为 Boss 风味升级（`§3.4`）。

```json
{
  "id": "boss.abyssRite",
  "bpm": 150,
  "mode": "harmonicMinor",
  "root": "G#",
  "scale": "G# harmonic minor",
  "laneRecipe": {
    "low":  "rolling psy bass (offbeat 16th)",
    "mid":  "ritual tom / gong grid",
    "high": "harmonic-minor cloud shards + gothic choir (chord shell)",
    "fx":   "cathedral reverb long-tail send"
  },
  "effectRecipe": { "reverb": "cathedral", "delay": "dottedRitual", "drive": "soft" },
  "intensityLayers": [
    { "level": 0, "drumDensity": 0.0, "bassDensity": 0.0, "cloudDensity": 0.2, "cueHandoff": false, "leadAllowed": false, "transientGuard": false },
    { "level": 1, "drumDensity": 0.4, "bassDensity": 0.0, "cloudDensity": 0.2, "cueHandoff": false, "leadAllowed": false, "transientGuard": false },
    { "level": 2, "drumDensity": 0.5, "bassDensity": 0.7, "cloudDensity": 0.3, "cueHandoff": false, "leadAllowed": false, "transientGuard": false },
    { "level": 3, "drumDensity": 0.7, "bassDensity": 0.8, "cloudDensity": 0.4, "cueHandoff": true,  "leadAllowed": false, "transientGuard": false },
    { "level": 4, "drumDensity": 0.8, "bassDensity": 0.9, "cloudDensity": 0.6, "cueHandoff": true,  "leadAllowed": false, "transientGuard": true  },
    { "level": 5, "drumDensity": 1.0, "bassDensity": 1.0, "cloudDensity": 0.9, "cueHandoff": true,  "leadAllowed": true,  "transientGuard": true  }
  ],
  "harmonyStateRefs": ["bossRitual", "frenzy"],
  "fxTransitionRefs": ["fx.8barBuild", "fx.roomClearTail", "fx.dropTrigger", "fx.bossWarningPreRoll"],
  "phraseBookRefs": ["abyss.choirSwell", "abyss.shardCloud"],
  "eventMapRef": "default13"
}
```

- **lane 配方**：`low` 滚动 psy bass（offbeat 16 分音）；`mid` 仪式 tom / gong 网格；`high` 和声小调云 shards + 哥特合唱，锁 `profilePitchSet`；`fx` 教堂混响长尾 send。
- **intensity 计划**：0 sub drone + 远处合唱 pad → 1 进 psy kick → 2 进滚动 psy bass spine（root motor offbeat）→ 3 进仪式 tom/gong 网格 + cue handoff → 4 进和声小调云 shards（增二度色）、`transientGuard` 开 → 5 全开 + 哥特合唱 lead gate（chord-locked）+ cathedral fx。
- **pad shell family**：和声小调 shell（升 7 级导音的仪式压迫感），哥特合唱音色。
- **bass spine**：滚动 psy bass on root G#，offbeat 16th。
- **lead / shard 上限**：合唱与 shards 全锁 `profilePitchSet`（和声小调集）；增二度是色彩但仍 chord-locked，**不随机**（`MUS-SHARD-05`、`MUS-LEAD-01`）。
- **transition 角色**：长仪式爬升 `fx.8barBuild`、清屋教堂长尾 `fx.roomClearTail`、落点 `fx.dropTrigger`、入场 `fx.bossWarningPreRoll`。
- **pause veil**：cathedral 混响冻结 + 低通，密度落 floor，时钟不丢。
- **emotionId**：`bossRitual`（仪式压迫）为主、收束段借 `frenzy`——职能取自情绪轴，dark psy/gothic 只是风味（`§3.3`、`§3.4`）。

---

## 5. 情绪轴 vs 风味（为什么 Boss 不另起情绪）

| 维度 | 谁决定 | 三 Boss 的差异 | 规则 |
|---|---|---|---|
| 情绪职能（suspended/pressure/bossRitual/frenzy） | 共享情绪轴 `HarmonyState` | **相同职能**，不另造 | `§3.3`、`MUS-CHORD-01/02` |
| 和声进行骨架 | 情绪轴 progression | 共用同一情绪的 progression 家族 | `§3.3` |
| 风味：genre / 音色 / mode / voicing / shellFamily / bpm | Boss profile | crucible=acid 金属 / venom=trap 黏液 / abyss=psy 教堂 | `§3.4` |
| 根音 root | Boss profile 内配置 | F / A / G#，仅 profile 内有效 | `MUS-KEY-01`、`MUS-SHARD-05` |

一句话：**三个 Boss 是同一套情绪职能的三种风味皮**，profile swap 换皮、不换情绪引擎（`§3.4`）。

---

## 6. MIDI 源映射（v0.11 §12 / §13）

三 Boss 复用 §13 的 5 个桥接 MIDI 与 profile 内 pad/bass/drum 素材，**落地时按各自 `root` / `mode` 重定位音高**：

| MIDI 角色（§13） | crucible (F phryg) | venom (A phrygDom) | abyss (G# harmMin) |
|---|---|---|---|
| `drumFillGrid` (`DrumSectionFillGrid`) | 金属 fill | phonk fill | 仪式 tom fill |
| `tensionRamp` (`OverdrivenGuitarFFSharpTensionRamp`) | acid 摩擦 riser | slime 摩擦 riser | —（用 8barBuild） |
| `bassPickup` (`ElectricBassASharpPickupStutter`) | 303 拾音 | 808 拾音 | psy bass 拾音 |
| `voiceHandoff` (`VoiceOohsSectionHandoffArc`) | 金属 pad 交接 | vox chop 交接 | 哥特合唱交接 |
| `impactTail` (`DrumImpactVoiceOohsLongTailCue`) | 金属板长尾 | 黏液长尾 | 教堂长尾 |

铁律：MIDI 文件名里的 A#、F/F# 是该片段**内部配置音高**，不是全局根音（`MUS-KEY-01`）。同 SHA 的重复 MIDI 只保留一次溯源、不叠权重（`MUS-VALID-02`）。重定位只换音高映射，不改桥接的 `opensNewMelody=false` 语义。

---

## 7. 边界与禁止

- 不让 Boss profile 覆盖情绪轴：只换风味（音色/mode/voicing/bpm/shellFamily），情绪职能由 `HarmonyState` 决定（`§3.4`、`§3.3`）。
- 不把 Boss `root`（F/A/G#）当全局根音：只在该 profile 内有效，MIDI 绝对音高按 profile 重定位（`MUS-KEY-01`、`MUS-SHARD-05`）。
- 不把 intensity 0–5 做成 6 首独立 loop：同 profile 内分层密度爬升，底盘连续（`MUS-INTENSITY-01/02/03`）。
- 不为 Boss 标志音色开随机旋律：acid lead / cowbell / 合唱全锁 chord shell 或 profilePitchSet（`MUS-LEAD-01`、`MUS-SHARD-05`）。
- 不让转场开新旋律或糊碰撞：`opensNewMelody=false` + `tailBudget.sendOnly` 留瞬态（`MUS-FX-01/03`）。
- 不在本文件接运行时代码：这是 `MusicProfile` 的数据规格，实现进音乐门面统一调度（`MUS-AUDIO-01`）。
