# 音频资产交付规格 / Asset Delivery Spec v0.1

> 日期：2026-06-24
> 状态：P2-1，承接 `music_runtime_schema_v0.1.md`（profile/role/intensity 取值）、`music_mix_fx_budget_v0.1.md`（dry/wet 分轨依据）、v0.11 `§14 外部 MIDI 命名规范`。
> 一句话原则：**stem / one-shot / MIDI 三类资产按语义命名、bar 对齐、干湿分轨、留 loop 与瞬态；同 SHA 重复只保留溯源不加权；文件名里的绝对调号不当全局根音**（`MUS-VALID-02`、`MUS-KEY-01`、`MUS-SHARD-05`）。

---

## 0. 三类资产与命名模板

| 资产类 | 命名模板 | 示例 |
|---|---|---|
| **stem**（loop 床 / 分层声部） | `Profile_Role_Intensity_Bars_BPM_Key.wav` | `bossCrucible_bass_i3_8bars_128_F.wav` |
| **one-shot**（碰撞 / 事件反馈） | `Event_Profile_Variant_Tail.wav` | `brickBreak_roomDarkpsy_crystal_short.wav` |
| **MIDI 研究样本** | `MusicName_TrackRole.mid`（+ 记录 `原始名` + `SHA1`） | `FXTransition_DrumSectionFillGrid.mid` |

> 三类共用「语义可读、程序可解析」两条底线：人能从文件名读出用途，程序能用 §5 的 regex 自动归档/校验。

---

## 1. 命名字段字典

每个 token 的合法取值锁定到上游 schema，**不自由发挥**：

| token | 取值来源 | 取值范围 |
|---|---|---|
| `Profile` | `MusicProfile.id`（去点驼峰化） | `roomDarkpsy` / `bossCrucible` / `bossVenom` / `bossAbyssRite` |
| `Role` | `laneRecipe` 声部角色 | `kick` / `sub` / `bass` / `perc` / `cloud` / `cue` / `stab` / `lead` / `pad` |
| `Intensity` | `IntensityLayer.level` | `i0`–`i5`（单档）或 `i2to5`（跨档 ramp 素材） |
| `Bars` | loop 小节数 | `1bars` / `2bars` / `4bars` / `8bars` / `16bars` / `32bars` |
| `BPM` | `MusicProfile.bpm` | 整数，如 `128` / `140` / `150` |
| `Key` | `MusicProfile.root`（**profile 内配置**） | `F` / `A` / `Gs`（G#）等；**不当全局根音**（`MUS-KEY-01`） |
| `Event` | `EventMapping.sourceEvent` | 13 事件名，如 `brickBreak` / `dropTrigger` |
| `Variant` | 元素/风味变体 | `crystal` / `poison` / `fire` / `armor` / `plain` |
| `Tail` | 尾音长度类 | `short`（碰撞，留瞬态）/ `med` / `longTail`（仅 fx send 用） |
| `MusicName` | 研究曲名 | `FXTransition` / `PsyBassSpine` / `PadChordDirector` / `ChordShardCloud` / `FullRuleValidation` / `IntensityLadder` |
| `TrackRole` | MIDI 轨语义角色 | 如 `DrumSectionFillGrid`、`ElectricBassASharpPickupStutter` |

> `Key=Gs` 用 `s` 表示升号（文件系统友好，避免 `#`）。调号只是该 profile 内配置，迁移到别的 profile 只迁结构不复制绝对音高（`MUS-VALID-02`、`MUS-SHARD-05`）。

---

## 2. 技术规格

| 维度 | 规定 | 说明 |
|---|---|---|
| **格式** | 交付母版 `WAV (PCM)`；运行时再转 `ogg/mp3` | 母版不压缩，保留动态 |
| **采样率 / 位深** | `48 kHz / 24-bit` | 全资产统一 |
| **BPM** | 写进文件名，stem 必须严格等于 profile bpm | 便于程序对齐拍序时钟（`MUS-CLOCK-01`） |
| **bar 长度** | stem 必须整 bar（1/2/4/8/16/32），首尾零交叉对齐 | loop 无爆音 |
| **loop 点** | stem 标注 loop start/end（整 bar 边界）；sustain 类无缝循环 | 运行时按 bar 循环 |
| **tail 裁切** | 碰撞 one-shot `Tail=short`，尾音裁到瞬态后即收；`longTail` 仅供 fx send | 给碰撞留瞬态（`MUS-FX-03`） |
| **dry / wet 分轨** | **交付 dry 干声 stem**，不烘焙母线 reverb/delay；wet 由运行时 send 决定 | 让 `mix_fx_budget §2` 的 send 预算生效 |
| **响度** | 床 stem 积分 `−18 LUFS` 参考、one-shot 峰值管理；真峰 `≤ −1 dBTP` | 留 headroom 给叠层与 sidechain |
| **声道** | 低频（kick/sub/bass）`<120 Hz 单声道`；其余可立体声 | 低频避让（`mix_fx_budget §1`） |

---

## 3. duplicate SHA 处理（MUS-VALID-02）

- 入库前算 `SHA1`；与已存在 SHA1 相同的，**标记为重复导出记录**，文件名加 `_Duplicate` / `_Redownload` 后缀，**只保留溯源，不提高任何规则/统计权重**（`MUS-VALID-02`、v0.11 `§MIDI duplicateGuard`）。
- 已知重复案例（v0.11 实测）：`PadChordDirector_*ChromaticCell_Duplicate`、`*BorrowedTriadSectionArc_Duplicate`、`ChordShardCloud_FretlessBass*_Duplicate`、`FullRuleValidation_*_Redownload*`——均同 SHA1，只作记录。
- 入库登记四元组：`{ 语义名, 原始名, SHA1, 角色描述 }`，写进 INDEX 的 MIDI 参考素材表。

---

## 4. 与上游规格对齐

| 文件名 token | 对齐到 | 规则 |
|---|---|---|
| `Role` | `MusicProfile.laneRecipe` 的声部 | `MUS-STEM-01` |
| `Intensity` | `IntensityLayer.level` 0–5（同 profile 分层，非 6 首独立曲） | `MUS-INTENSITY-01` |
| `Event` / `Variant` | `EventMapping.sourceEvent` + 元素砖 | `event_mapping §2` |
| `Tail` | `FXTransition.tailBudget` / 碰撞瞬态 | `MUS-FX-03` |
| dry/wet 分轨 | `mix_fx_budget` 的 send-only + HPF + sidechain | `MUS-FX-03`、`MUS-AUDIO-02` |
| `Key` | `MusicProfile.root`（profile 内） | `MUS-KEY-01`、`MUS-SHARD-05` |

---

## 5. 程序归档 / 校验规则

供程序自动归档与校验的正则（命中即合法、可解析归档；未命中拒收并报错）：

```
stem:     ^(?<profile>[a-zA-Z]+)_(?<role>kick|sub|bass|perc|cloud|cue|stab|lead|pad)_(?<intensity>i[0-5](to[0-5])?)_(?<bars>\d+bars)_(?<bpm>\d{2,3})_(?<key>[A-G]s?)\.wav$
oneShot:  ^(?<event>[a-zA-Z]+)_(?<profile>[a-zA-Z]+)_(?<variant>[a-zA-Z]+)_(?<tail>short|med|longTail)\.wav$
midi:     ^(?<music>[A-Za-z]+)_(?<trackRole>[A-Za-z0-9]+)(_(Duplicate|Redownload\d?))?\.mid$
```

校验三连：(1) 文件名正则命中；(2) `profile/role/intensity/bpm/key` 与该 profile 的 schema 一致（bpm/root 必须吻合）；(3) 入库算 SHA1 查重，重复则只记录不加权。任一不过 → 拒收 + 报错原因。

---

## 6. 验收（P2-1 验收标准）

- **美术 / 音频可按此导出**：§0–§2 给全命名模板、字段取值、格式/loop/tail/响度，制作端无歧义。
- **程序可自动归档 / 校验**：§5 三条正则 + 三连校验，文件名即元数据，违规即拒收。

---

## 7. 边界与禁止

- 不烘焙母线效果到 stem：交付 dry 干声，wet 留给运行时 send 预算（`mix_fx_budget §2`、`MUS-FX-03`）。
- 不把文件名调号当全局根音：`Key` 只是 profile 内配置（`MUS-KEY-01`、`MUS-SHARD-05`）。
- 不把同 SHA 重复当新增证据：只保留溯源、不加权（`MUS-VALID-02`）。
- 不为每个 intensity 交付独立整曲：交付的是同 profile 内的分层 stem（`MUS-INTENSITY-01`）。
- 碰撞 one-shot 不交付长尾：`Tail=short` 留瞬态，长尾仅 fx send 用（`MUS-FX-03`、`MUS-AUDIO-02`）。
- 本文件只规定交付规格，不在此接运行时代码（`MUS-AUDIO-01`）。
