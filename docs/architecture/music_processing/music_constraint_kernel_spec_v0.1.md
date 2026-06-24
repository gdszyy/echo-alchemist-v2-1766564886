# 受约束生成内核详规 / Constraint Kernel Spec v0.1

> 日期：2026-06-24
> 状态：P3-2，深化 `music_algorithmic_generation_spec_v0.1.md :: §4`。承接 `music_runtime_schema_v0.1.md :: §4 HarmonyState`（emotionId/progression/shellFamily/pitchSet/voicingDensity/padGate/rootGravity）、`MUS-KEY-01`、`MUS-CHORD-03/06`、`MUS-SHARD-03`、`MUS-BASS-03`、`MUS-DRUM-01`、`MUS-GEN-01..06`。
> 一句话原则：**内核把"音乐意图 + harmonyState"翻译成合法音符——音高只从 progression×shellFamily×scale 算出的带权闭包里取，节奏只吸附 slot16 网格，变化只走 motif 闭合文法，随机只在已合法候选里选；profile.root 决定绝对音、内核全用相对级数**（`MUS-GEN-05`、`MUS-KEY-01`）。

> 范围：纯设计规格 / 伪代码，不写运行时代码。内核是 `tick()`（generation_spec §3）每次取音时调用的下层；它只保证"和谐 + 可复现"，不决定"何时开哪条 lane"（那是编排层）。

---

## 0. 内核职责与五原语

编排层产生"意图"（lane + slot + intentType），内核把意图实例化为合法 note：

```
intent { lane, slot, intentType, harmonyState, motifRef? }
   │
   ▼  五原语（全部确定性、受约束）
quantizePitch ─ quantizeRhythm ─ transformMotif ─ voiceLead ─ seededPick
   │
   ▼
note { pitchAbs, onsetSlot, durSlots, velocity, register }  // 必过三闸
```

| 原语 | 职责 | 保证 |
|---|---|---|
| `quantizePitch` | 相对级数 → 最近合法绝对音 | 音 ∈ 闭包，root 重力（`MUS-GEN-05`） |
| `quantizeRhythm` | 时间 → slot16 | onset ∈ 网格（`MUS-DRUM-01`） |
| `transformMotif` | motif → 受约束变体 | 只动 rhythm/octave/gate/density，不动音高中心（修订 `MUS-LEAD-01`） |
| `voiceLead` | 前后 voicing → 最小移动 | register 分层 + root lock（`MUS-BASS-03`） |
| `seededPick` | 合法候选集 → 一个 | 同 seed 同结果（`MUS-GEN-06`） |

---

## 1. pitchSet 推导：从情绪到带权合法音池

内核不直接用 `harmonyState.pitchSet`（那是色彩集），而是先算**带权合法闭包 `legalSet`**：

```
legalSet(harmony, profile) =
    base   = scaleDegrees(profile.scale, profile.root)        // 调内音（绝对 pitch class）
    color  = mapRelative(harmony.pitchSet, profile.root)      // root=0 的相对集 → 绝对
    shell  = shellPitches(harmony.shellFamily, harmony.progression, profile.root)
    closure = (base ∩ (color ∪ shell))                        // 调内 ∩ (色彩∪shell)
    weight(p) = rootGravity(p, profile.root, harmony.rootGravity)   // root 最高，5th 次之，色彩低
    return { pitch:p, w:weight(p) } for p in closure
```

`rootGravity` 权重梯度（默认，可被 `harmony.rootGravity` 覆盖）：

| 角色 | 相对级 | 权重 |
|---|---|---|
| root | 0 | 1.00 |
| fifth | 7 | 0.70 |
| third（b3/3） | 3 / 4 | 0.55 |
| shell color | progression 给的 | 0.40 |
| phrygian b2 / 邻接色 | 1 / 邻接 | 0.25 |
| 其余调内音 | — | 0.15 |
| 调外 | — | 0（禁，`MUS-SHARD-03`） |

> 例 · roomDarkpsy（root **G#**, G# minor）：`base = {G#,A#,B,C#,D#,E,F#}`；`harmony.pitchSet=[0,3,7]`(darkStable) → color `{G#,B,D#}`；shell `partialTriad → {G#,B,D#}`。`legalSet` 加权后 G#=1.0、D#=0.7、B=0.55，其余调内色 0.15。**调外（如 G♮ 当根、F♮）权重 0，永不取**（`MUS-KEY-01`）。

---

## 2. quantizePitch —— 最近合法 + 根音重力

```js
function quantizePitch(rawDegree, harmony, profile, register) {
  const legal = legalSet(harmony, profile);            // §1，带权
  const target = profile.root + degreeToSemitone(rawDegree); // 相对级→绝对
  // 取闭包内最近音；并列时按 root 重力权重打破平局
  const cands = legal
    .map(e => ({...e, dist: Math.abs(pc(e.pitch) - pc(target))}))
    .sort((a,b) => a.dist - b.dist || b.w - a.w);
  let p = cands[0].pitch;
  p = avoidNoteGuard(p, harmony);                       // 落在 avoid-note → 推到相邻 shell 音
  return toRegister(p, register);                       // 套八度（§5 register 分层）
}
```

- **avoid-note**：phrygian 的 ♮2、和声小调的 ♮6 等若不在 shellFamily 内，推到最近 shell 音（`MUS-CHORD-03`）。
- **永不返回调外音**：闭包外权重为 0，排序后不可能命中。

---

## 3. quantizeRhythm —— slot16 网格 + 密度档

```js
function quantizeRhythm(t, grid, densityTier) {
  const slot = round(t / grid.slotDur);                // 吸附到 0..15
  if (!tierSlots(densityTier).includes(slot)) return null;  // 不在该密度档的合法 slot → 不发声
  return { onsetSlot: slot, durSlots: gateDur(densityTier) };
}
```

密度档 → 合法 slot（承 v0.11 spine ladder / `MUS-DRUM-01`）：

| densityTier | 合法 slot | 用途 |
|---|---|---|
| `anchor` | 0/4/8/12 | 主 pulse |
| `offbeat` | 2/6/10/14 | 离拍脊柱 |
| `even` | 0/2/4/6/8/10/12/14 | even-slot motor |
| `full` | 0..15 | 全 16 分 stutter（仅高强度/transition） |

> 落点只能在档内 slot；密度递进=换档（`MUS-INTENSITY-01`），不是随机加点。

---

## 4. transformMotif —— 闭合变换文法

motif = 相对级序列 + 节奏 + gate。变换是**闭合文法**：输入合法 motif → 输出仍合法 motif。

| op | 定义 | 约束 |
|---|---|---|
| `transpose(n)` | 整体按**音阶级数** n 平移 | 仍在 scale 内（非半音平移） |
| `invert(axis=root)` | 关于 root 镜像 | 镜像后过 `quantizePitch` 收回闭包 |
| `retrograde` | 时间倒序 | 音高不变 |
| `augment/diminish(k)` | 时值 ×k / ÷k | 落点仍吸附 slot16 |
| `density(±)` | 加/减 motif 内音 | 加音从 `legalSet` 取，减音先减色彩后减 root |
| `octave(±)` | 八度移位 | 不出 lane 的 register 带 |
| `gate(g)` | 改 gate grid | 不脱离同一拍序时钟 |

**禁止**（硬约束，`MUS-GEN-05`、修订 `MUS-LEAD-01`）：

```
✗ op=randomPitch            // 不许凭空抽音高
✗ transpose 用半音而非音阶级  // 会漂出调性
✗ density 加调外音           // 闭包外权重 0
✗ 整条 motif 重抽            // 变体来自变换，不来自重采样
```

> 例 · 一个 G# motif `[0,3,0,-2]`（G#-B-G#-F#）做 4 个变体：`transpose(+2 级)→[D#,F#,D#,C#]`、`invert→[0,-3,0,2]`、`density(+)→插 5th D#`、`octave(+1)`——四个都仍在 G# minor 闭包内，听感是"同一句的不同说法"，不是新旋律。

---

## 5. voiceLead —— 最小移动 + register 分层 + root lock

```js
function voiceLead(prevVoicing, nextDegrees, harmony, profile, lane) {
  const reg = LANE_REGISTER[lane];                     // bass:1-2 / pad:3-4 / cloud:4-5 / lead:4-5 / cue:3
  let voicing = nextDegrees.map(d => quantizePitch(d, harmony, profile, reg));
  if (lane === 'bass' || lane === 'cue')
    voicing = lockRoot(voicing, profile.root, reg);    // 低频/cue root lock（MUS-BASS-03）
  // 相邻 voicing 取最小总移动（避免大跳）
  voicing = minimalMotion(prevVoicing, voicing);
  return voicing;
}
```

- **register 分层**：每 lane 有固定 register 带，避免频段打架（接 `mix_fx_budget §0`）。
- **root lock**：bass/cue 的 root 在 register 间镜像（G#1/G#2/G#3），pitch 变化少于 rhythm/density 变化（`MUS-BASS-03`）。

---

## 6. seededPick —— 确定性随机（"和谐≠随机"的分界线）

```js
// 紧凑可复现 PRNG（mulberry32 类）；seed 由确定性键派生
function makeRng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function seedKey(profileId, sectionIdx, barIdx, lane, slot) {
  return hash32(`${profileId}|${sectionIdx}|${barIdx}|${lane}|${slot}`);
}
function seededPick(candidates, key) {            // candidates 已是合法候选（过三闸）
  if (candidates.length === 0) return null;
  const r = makeRng(key)();
  return candidates[Math.floor(r * candidates.length)];
}
```

**关键不变量**：`candidates` 必须是**已过三闸的合法集**（合法音高/合法 slot/合法 motif 变体）。随机只决定"选哪个控制变化"，从不生成原始音高或落点。同 `(profile,section,bar,lane,slot,seed)` → 逐音相同（`MUS-GEN-06`）。

---

## 7. 每 lane 内核画像（同内核，不同调法）

| lane | quantizePitch 偏好 | densityTier 来源 | transformMotif 主用 op | 对齐规则 |
|---|---|---|---|---|
| `bass` | root lock，色彩仅 section 边界 | `IntensityLayer.bassDensity` | octave / density / gate | `MUS-BASS-03` |
| `pad`/chord | partial shell（root/3/5），cluster 仅高强 | `voicingDensity` | gate / density / invert | `MUS-CHORD-03/06` |
| `cloud` | 闭包内可极密，强 root gravity | `IntensityLayer.cloudDensity` | density / octave | `MUS-SHARD-03` |
| `lead` | 短手势，root 中心 | phrase window | transpose(级)/retrograde/gate | 修订 `MUS-LEAD-01` |
| `cue`/pedal | 单音 root/pedal | `cueHandoff` | gate / augment | `MUS-CHORD-07` |

> 同一内核，五条 lane 靠"偏好 + register 带 + 主用 op"区分角色；没有任何一条调内核去抽调外音。

---

## 8. 端到端 worked example（roomDarkpsy · G# · intensity 3 · 1 bar）

```
输入: profile=roomDarkpsy(root=G#, scale=G#minor), harmony=darkStable(pitchSet[0,3,7],shell=partialTriad),
      intensity=3, sectionIdx=2, barIdx=9, seed=固定

legalSet = { G#:1.0, D#:0.7, B:0.55, C#:0.15, A#:0.15, E:0.15, F#:0.15 }   // §1

lane=bass, tier=offbeat → slots {2,6,10,14}
  slot2  quantizePitch(root) → G#1   (root lock, MUS-BASS-03)
  slot6  → G#1
  slot10 transformMotif octave(+1) → G#2
  slot14 → G#1
  // 全 root，register 镜像；零调外音

lane=pad, tier(anchor) → slots {0,8}, voicingDensity=dyad
  slot0 voiceLead → [G#3, D#4]     (root+5th, 最小移动)
  slot8 seededPick({[G#3,B3],[G#3,D#4]}, key) → [G#3,B3]   // 在两个合法 dyad 里选其一
  // 两个候选都合法；随机只换 shell 着色，不离闭包

输出 8 个 note，全部 ∈ legalSet、全部落 slot 网格、同 seed 可复现。
```

换 Boss（bossCrucible, root **F**, F phrygian）同一套内核：`legalSet` 重算到 F 中心（F=1.0, C=0.7, Ab=0.55, Gb=0.25 phrygian b2…），motif 用相对级**迁结构不复制 G# 绝对音**（`MUS-KEY-01`、`MUS-SHARD-05`）。

---

## 9. 验证钩子（接 generation_spec §8）

```
assert ∀ note: pc(note.pitchAbs) ∈ pc(legalSet)        // 调性合规（MUS-GEN-05）
assert ∀ note: note.onsetSlot ∈ tierSlots(tier)        // 时钟合规（MUS-DRUM-01）
assert run(seed) === run(seed)                          // 确定性（MUS-GEN-06）
assert noRawRandomDecidesPitch(codeScan)               // 无随机审计（MUS-GEN-01）
assert motifVariant ∈ closure(transformMotif ops)      // 变换闭合（MUS-LEAD-01 修订）
```

---

## 10. 边界与禁止

- 内核**永不发明闭包外音高**：调外权重 0，avoid-note 推回 shell（`MUS-GEN-05`、`MUS-SHARD-03`）。
- root 来自 `profile.root`，内核全用相对级数；迁 profile 只迁结构、重定根（`MUS-KEY-01`、`MUS-SHARD-05`）。
- motif 变体来自闭合文法变换，**不来自重采样/随机重抽**（修订 `MUS-LEAD-01`）。
- 随机只进 `seededPick` 的合法候选集，决定控制变化不决定音高/落点（`MUS-GEN-01/06`）。
- 内核只产 note 意图，不决定 lane 开关（编排层职责）、不建 `AudioContext`（`MUS-GEN-07`、`MUS-AUDIO-01`）。
- 本规格不写运行时代码：落地时作为 `tick()` 下层被调用（接 generation_spec §3、demo 迭代计划）。
