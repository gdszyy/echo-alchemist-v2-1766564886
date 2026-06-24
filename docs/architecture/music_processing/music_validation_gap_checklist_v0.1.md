# 规则验证曲生产缺口清单 / Validation Gap Checklist v0.1

> 日期：2026-06-24
> 状态：P2-2，承接 v0.11 `§11 完整规则验证曲`（已验证项 + 待补验证项）、`music_asset_delivery_spec_v0.1.md`（命名）、`music_boss_biome_profiles_v0.1.md`（Boss profile）、`music_mix_fx_budget_v0.1.md`（pause veil / 留瞬态）。
> 一句话原则：**要闭合验收，需补齐两首验证曲——1 个普通房间 + 1 个 Boss 战，各自覆盖 groove / phrase / intensity / transition / pause 五类状态；缺口集中在 pad-chord 情绪层、FX-riser-impact 层、pause veil 版本、Boss 变体版本（v0.11 §11 line 489）；新素材按语义命名、记 SHA1、迁移只迁结构不复制绝对音高**（`MUS-VALID-01`、`MUS-VALID-02`、`MUS-KEY-01`、`MUS-SHARD-05`）。

> ⚠️ 边界：本清单**只规定"需要生产什么"**——实际 MIDI 音乐内容由音频/编曲端产出，不是本文件能生成的。本文件交付的是一张可勾选的采购/制作工单。

---

## 0. 现状 vs 缺口（v0.11 §11 实证）

**已验证（HAVE，G-root 150 BPM `FullRuleValidation_*` 系列）：**

| 角色 | 文件 | SHA1 | 覆盖状态 | 验证规则 |
|---|---|---|---|---|
| drum grid 床 | `FullRuleValidation_DrumGridPercussionStem.mid` | `74ce772049e2` | groove | `MUS-CLOCK-01`、`MUS-DRUM-01`、`MUS-VALID-01` |
| fill / accent | `FullRuleValidation_DrumFillAccentStem.mid` | `1f5f363d8c33` | phrase（鼓侧） | `MUS-DRUM-01`、§3.6、`MUS-VALID-01` |
| root / shard motor | `FullRuleValidation_Lead2GRootShardStem.mid` | `06a8e9258b70`（G=331） | groove/intensity（根音重力） | `MUS-KEY-01`、`MUS-SHARD-03`、`MUS-VALID-02` |

> `*_Duplicate` / `*_Redownload` 同 SHA1，只保留溯源、不加权（`MUS-VALID-02`、`MUS-SHARD-04`）。

**结论（v0.11 §11 line 488-489）：**
- 已验证：`single beat clock`、`drum grid + fill 分离`、`root gravity shard stem`、`duplicate guard`。
- **待补验证：完整 pad/chord 情绪层、FX/riser/impact 层、pause veil 版本、Boss profile 变体版本。**

即：现有素材证明了 groove 床 + phrase 分离 + 根音重力，但 **emotion 层（pad/chord）、transition 层（FX/riser/impact）、pause 状态、Boss 身份** 四块还没有可听验证曲。这四块就是本清单要补的料。

---

## 1. 两首验证曲目标（P2-2 验收口径）

验收要求（`music_system_next_todo_v0.1.md :: P2-2`）：**至少 1 个普通房间 + 1 个 Boss 战，能覆盖 groove、phrase、intensity、transition、pause 五类状态。**

| 验证曲 | profile | root / BPM / mode | 角色 | 缺口规模 |
|---|---|---|---|---|
| **Song A · 普通房间** | `FullRuleValidation`（对齐 runtime `roomDarkpsy`） | **G / 150 / darkpsy**（沿用现有系列 profile） | 续补现有 G-root 系列的缺失层 | 6 条新 MIDI |
| **Song B · Boss 战** | `BossCrucibleValidation`（对齐 `boss.crucible`） | **F / 128 / phrygian** | 整套平行新建 | 9 条新 MIDI |

> **G vs G# 说明（`MUS-VALID-02`、`MUS-KEY-01`）**：现有验证系列是 G-root 150 BPM，Song A 续补**保持 G-root**以与现有 stem 同钟同重力；runtime 普通房间 profile `roomDarkpsy` 是 G#（`Gs`）——从验证曲移植到运行时 profile 属于"**迁结构不复制绝对音高**"的重定根步骤，不在本清单内另算一首。Song B 的 F/128 与 `boss.crucible` 一致，可直接作为运行时素材路径。

---

## 2. Song A · 普通房间补样清单（G-root 150 BPM，6 条）

命名遵循 MIDI 研究样本规范 `MusicName_TrackRole.mid`（`asset_delivery §0/§5`）；MusicName 沿用 `FullRuleValidation`。

| # | TrackRole（目标文件名） | 覆盖状态 | intensity 窗口 | 验证规则 | 验收判据 |
|---|---|---|---|---|---|
| A1 | `FullRuleValidation_BassGRootSpineStem.mid` | groove（低频脊柱） | i2 起常驻 | `MUS-STEM-01`、`MUS-TEMPO-02`、`MUS-AUDIO-02` | bass spine 按 beat slot 表达、可重定时；与 kick sidechain 不糊低频 |
| A2 | `FullRuleValidation_PadChordEmotionStem.mid` | groove/emotion（**待补①**） | i0 floor → i4 cloud | `MUS-CHORD-01..07`、§3.3、`MUS-CHORD-04` | pad/chord 走 suspended→darkStable→pressure 情绪轴；send HPF>300Hz、gate+sidechain 不糊碰撞 |
| A3 | `FullRuleValidation_CloudShardDensityStem.mid` | intensity（高强 cloud/shard 密度） | i4–i5 | `MUS-SHARD-01..04`、`MUS-DENSE-01`、`MUS-INTENSITY-01` | shard cloud 靠密度递进而非铺满；角色与 lead shard 分工成立 |
| A4 | `FullRuleValidation_FXTransitionImpactStem.mid` | transition（**待补②**） | i1–i5 各 section 边界 | `MUS-FX-01`、`MUS-FX-02`、`MUS-FX-03` | riser/impact/cue 只桥接、挂边界、`opensNewMelody=false`、tail send-only 留瞬态 |
| A5 | `FullRuleValidation_IntensityDensityRampStem.mid` | intensity（0–5 密度爬升） | i0–i5 全程 | `MUS-INTENSITY-01`、`MUS-INTENSITY-02` | 同 profile 内 drum/bass/cloud 密度递进，不是 6 首独立 loop；房间身份不断裂 |
| A6 | `FullRuleValidation_PauseVeilStem.mid` | pause（**待补③**） | 任一强度暂停态 | `MUS-PAUSE-01`、`MUS-CLOCK-01` | 运动层 mute、固定层 keep、加低通+混响 veil；拍序时钟不丢，恢复无缝接回 |

---

## 3. Song B · Boss 战补样清单（boss.crucible，F-root 128 BPM phrygian，9 条）

整套平行新建；MusicName 用 `BossCrucibleValidation`。Boss 身份差异来自 tempo/grid/timbre/effects/phrase book，不是只换 one-shot（`§3.4`、`MUS-KEY-01`）。

| # | TrackRole（目标文件名） | 覆盖状态 | 验证规则 | 验收判据 |
|---|---|---|---|---|
| B1 | `BossCrucibleValidation_DrumGridPercussionStem.mid` | groove | `MUS-CLOCK-01`、`MUS-DRUM-01` | acid techno/industrial 网格成立，128 BPM 同钟 |
| B2 | `BossCrucibleValidation_DrumFillAccentStem.mid` | phrase | `MUS-DRUM-01`、§3.6 | fill/accent 独立于主 grid，作 section 提示 |
| B3 | `BossCrucibleValidation_BassFRootSpineStem.mid` | groove（低频脊柱） | `MUS-STEM-01`、`MUS-AUDIO-02` | F-root motor，industrial drive；与 kick 错峰 |
| B4 | `BossCrucibleValidation_LeadFPhrygianShardStem.mid` | groove/intensity（根音重力） | `MUS-KEY-01`、`MUS-SHARD-03`、`MUS-VALID-02` | phrygian 压力色，F 重心；不复制 G-root 绝对音高 |
| B5 | `BossCrucibleValidation_PadChordRitualStem.mid` | emotion（**待补①·Boss**） | `MUS-CHORD-01..07`、§3.3、§3.4 | bossRitual 情绪轴，diminished/phrygian pressure shell |
| B6 | `BossCrucibleValidation_CloudShardDensityStem.mid` | intensity（cloud/shard 密度） | `MUS-SHARD-*`、`MUS-DENSE-01` | 高强密度递进，metallic shard 风味 |
| B7 | `BossCrucibleValidation_FXTransitionPreRollStem.mid` | transition（含 bossWarning 预滚） | `MUS-FX-01..03` | preRoll/riser/impact 桥接，`handoffTo` 指向 Boss profile，留瞬态 |
| B8 | `BossCrucibleValidation_IntensityDensityRampStem.mid` | intensity（0–5 密度） | `MUS-INTENSITY-01..02` | 同 profile 内密度爬升，Boss 身份贯穿 |
| B9 | `BossCrucibleValidation_PauseVeilStem.mid` | pause | `MUS-PAUSE-01`、`MUS-CLOCK-01` | veil 蒙纱不静音，时钟续跑 |

---

## 4. 五状态覆盖矩阵（验收用勾选表）

| 状态 | Song A（普通房间） | Song B（Boss 战） |
|---|---|---|
| **groove** | A1 bass spine + 现有 DrumGrid `74ce77` | B1 DrumGrid + B3 bass spine |
| **phrase** | 现有 DrumFillAccent `1f5f36` + 事件→accent 映射 | B2 DrumFillAccent |
| **intensity** | A3 cloud/shard + A5 density ramp + 现有 Lead2 shard `06a8e9` | B4 lead shard + B6 cloud + B8 density ramp |
| **transition** | A4 FX/riser/impact | B7 FX/preRoll（含 bossWarning） |
| **pause** | A6 pause veil | B9 pause veil |
| **emotion 轴（贯穿）** | A2 pad/chord 情绪层 | B5 pad/chord ritual |

> 五行（不含 emotion 贯穿行）每格非空 = P2-2 验收通过。emotion 层（A2/B5）是 line 489 点名的"完整 pad/chord 情绪层"，横跨 groove→intensity 支撑情绪轴，单列以便核对。

---

## 5. 入库规范（每条新 MIDI 必走）

承 `asset_delivery_spec §3/§5`、`MUS-VALID-02`：

1. **语义命名**：按 §2/§3 的 `MusicName_TrackRole.mid` 落名，能被 `asset_delivery §5` 的 midi 正则命中。
2. **记溯源四元组**：`{ 语义名, 原始名, SHA1, 角色描述 }` 写进 `INDEX.md` 的 MIDI 参考素材表。
3. **查重不加权**：入库算 SHA1，撞已存在 SHA 的标 `_Duplicate`/`_Redownload`，只留溯源不提权重（`MUS-VALID-02`）。
4. **迁移只迁结构**：跨 profile 复用 motif 时保留相对拍位/相对音程，重定根到目标 profile，不硬绑源 BPM、不复制绝对音高（`MUS-TEMPO-02`、`MUS-KEY-01`、`MUS-SHARD-05`）。
5. **验证后转交付**：MIDI 验证通过后，可听 WAV stem 按 `Profile_Role_Intensity_Bars_BPM_Key.wav` 导出（`asset_delivery §0`），dry 干声、整 bar、留 loop。

---

## 6. 验收（P2-2 验收标准）

- **覆盖五状态**：§4 矩阵两列各五格（groove/phrase/intensity/transition/pause）非空——普通房间与 Boss 战各成一首完整验证曲（`MUS-VALID-01`）。
- **补齐 line 489 四缺口**：pad/chord 情绪层（A2/B5）、FX/riser/impact（A4/B7）、pause veil（A6/B9）、Boss 变体（B1–B9）全部落单。
- **profile 边界清晰**：G-root 验证不冒充 F/G# profile；F Boss 不复制 G 绝对音高（`MUS-VALID-02`、`MUS-KEY-01`）。

---

## 7. 边界与禁止

- 本文件只出**工单**，不产音乐：实际 MIDI 编曲内容由音频端制作，Agent 不生成音频。
- 不把同 SHA 重复当新增证据：只保留溯源、不加权（`MUS-VALID-02`）。
- 不把验证曲调号当全局根音：G-root 只证 G-root 路径，迁移重定根（`MUS-KEY-01`、`MUS-SHARD-05`）。
- 不为每个 intensity 写独立整曲：intensity 覆盖靠 density ramp（A5/B8）同 profile 内爬升（`MUS-INTENSITY-01`）。
- 不在本文件接运行时代码：这是制作缺口清单，实现进音乐门面统一调度（`MUS-AUDIO-01`）。
