# 混音与效果器预算 / Mix & FX Budget v0.1

> 日期：2026-06-24
> 状态：P1-2，承接 `music_runtime_schema_v0.1.md :: §1 effectRecipe / IntensityLayer.fxSendDepth` 与 `music_transition_templates_v0.1.md :: tailBudget`，把"为什么不糊碰撞、低频不打架"落成可执行预算。
> 一句话原则：**碰撞反馈（brick/paddle one-shot）拥有瞬态优先权；pad/cloud/reverb 长尾一律让频段、走 send、上 HPF、被 sidechain；暂停是蒙纱不是静音**（`MUS-FX-03`、`MUS-AUDIO-02`、`MUS-PAUSE-01`）。

---

## 0. 四频段分工与预算

lane 划分沿用 `MUS-STEM-01`，每条 lane 有固定频段领地与占用预算：

| lane | 频段领地 | 主要占用者 | 响度预算（相对峰值） | 关键约束 |
|---|---|---|---|---|
| `low` | 20–250 Hz | kick / sub / bass spine / paddle thump | kick 0 dB 参考、bass −3~−6 dB、sub mono | 单声道求和、互相 sidechain，禁长尾效果（`MUS-AUDIO-02`） |
| `mid` | 250 Hz–2 kHz | 打击 body / cowbell / tom / chord shell 体 | −6~−9 dB | 给碰撞 click 的 1–4 kHz 让路 |
| `high` | 2–8 kHz | stabs / vox chops / shards / cue / hats 上部 | −9~−12 dB | 与 brick/paddle 瞬态 click 错峰，不铺满 |
| `fx` | send 总线（全频经 HPF） | reverb / delay 尾、long-tail cue、riser | send-only，尾音 ≤ `tailBudget.maxBeats` | HPF >300 Hz、pre-delay 保瞬态（`MUS-FX-03`） |

> 碰撞 one-shot 同时占两块地：**低频 thump（80–150 Hz 短瞬态）+ 高频 click（2–6 kHz）**。所有持续/长尾声部必须给这两块让路——这是整张预算的核心。

---

## 1. 频段避让矩阵（谁给谁让路）

| 让路方 | 受保护方 | 手段 | 规则 |
|---|---|---|---|
| bass spine | kick | sidechain duck（kick 触发 bass 短压） | `MUS-AUDIO-02`、§388 full motor |
| sub | paddle thump | sub 锁 <120 Hz mono，paddle thump 占 80–150 Hz 瞬态错峰 | `MUS-AUDIO-02` |
| pad / chord cloud | kick + 碰撞 | gate + sidechain + send HPF >300 Hz | `MUS-CHORD-04`、`MUS-FX-03` |
| reverb / delay 尾 | brick/paddle one-shot | send HPF >300 Hz + pre-delay 20–40 ms + 限尾 | `MUS-FX-03` |
| long-tail cue（roomClear/drop） | 下一段碰撞 | `tailBudget.sendOnly=true`、有限 maxBeats、不新增声部 | `MUS-FX-03`、转场 §2.5/§2.6 |
| high stabs / shards | 碰撞 click | 错峰 + 密度限流，不铺满 2–6 kHz | `MUS-AUDIO-02`、`MUS-DENSE-01` |

一句话读法：**纵轴每一行都是"持续声部让位给瞬态反馈"**，没有反向条目——碰撞反馈永不让路。

---

## 2. 效果器预算（建议范围 + 禁用场景）

| 效果器 | 建议范围 | 适用 | 禁用场景 |
|---|---|---|---|
| **reverb** | wet 0.1–0.4 常态；0.6–0.8 仅 `fx` send 尾（roomClearTail/dropTrigger）；pre-delay 20–40 ms；send HPF >300 Hz | 空间、长尾 cue、pad 迷幻 | 禁挂在碰撞 bus 或 low lane；禁在 intensity 5 / drop 的碰撞通道铺长 reverb（糊瞬态，`MUS-FX-03`） |
| **delay** | tempo-sync 1/8–1/4；feedback <0.4 常态；send HPF | 上一句尾音 throw、psy 空间 | 禁挂 low lane bass/kick（低频糊浊）；禁无同步自由 delay |
| **distortion / drive** | low bass 轻–中 drive；Boss 风味（industrial/bitcrush）按 profile | 贝斯厚度、Boss 质感 | 禁在已满的 high lane 叠失真致掩盖 cue/刺耳 |
| **filter** | lowpass veil（暂停）；resonant bandpass（psy/acid）；riser automation | 暂停纱罩、增压、迷幻手势 | 禁用 filter 自激盖过碰撞；riser 仍锁固定根音半音（`MUS-FX-02`） |
| **sidechain** | kick → bass/pad/cloud ducking，intensity 4–5/drop/frenzy **必开** | 让低频与铺底给 kick 和碰撞腾瞬态 | **禁 sidechain brick/paddle 反馈**——碰撞瞬态必须完整（`MUS-AUDIO-02`、`§388`） |

---

## 3. 留瞬态机制（为什么 pad/reverb 不糊碰撞）

四道闸门叠加，确保高强度下碰撞反馈仍清晰（对应 `IntensityLayer.transientGuard`）：

1. **send-only 长尾**：转场/cue 尾音只走 `fx` send 总线，不占新声部（`tailBudget.sendOnly=true`）。
2. **send HPF**：reverb/delay send 高通 >300 Hz，长尾不进低频，不掩盖 kick/thump（`MUS-FX-03`）。
3. **pre-delay 保瞬态**：reverb pre-delay 20–40 ms，让碰撞的初始 click 先于尾音到达。
4. **sidechain ducking**：kick/碰撞触发 pad/cloud/bass 短压，给瞬态让出动态窗口（`§388`）。

`intensity 5` 时四道闸门全开（`transientGuard=true`），这是 `dropTrigger` 抬到 5 仍能听清碰撞的硬保证（转场 §2.5）。

---

## 4. intensity 0–5 混音变化表

同一 profile 内随强度递进的混音参数（不是换歌，只改 gate/send/sidechain，`MUS-INTENSITY-01`）：

| level | 新增声部 | sidechain | send 深度 (`fxSendDepth`) | transientGuard | headroom 策略 |
|---|---|---|---|---|---|
| 0 | drone / pad floor | 无 | reverb 0.3（空间感） | false | 最大余量，稀疏 |
| 1 | + kick | pad 轻压 | 0.25 | false | kick 占低频中心 |
| 2 | + bass spine | bass→kick duck 开始 | 0.2 | false | 收紧低频 |
| 3 | + mid 打击 | + pad/mid duck | 0.2，send HPF 收紧 | false | 中频开始拥挤，错峰 |
| 4 | + chord cloud | + cloud→kick duck | 0.15 | **true** | reverb pre-delay 介入 |
| 5 | 全开 + lead gate | 重 sidechain + 短 gate | 0.15（碰撞通道为长尾让位） | **true** | 上限幅 / 短 gate，碰撞优先 |

> 趋势：强度越高，**send 越浅、sidechain 越重、瞬态保护越硬**——热闹来自声部数与密度，不是把尾音铺满（`MUS-DENSE-01`、`MUS-FX-03`）。

---

## 5. Pause Veil 混音（MUS-PAUSE-01）

暂停是**蒙纱不是静音**——关运动层、留固定层、加效果器，时钟不丢（`MUS-PAUSE-01`、`MUS-CLOCK-01`）：

| 处理 | 对象 | 参数 |
|---|---|---|
| **关（mute）** 运动层 | hats / acid / roll / riser / lead | 立即淡出 |
| **留（keep）** 固定层 | pulse / root drone / pad | 维持，降密到 floor |
| **加（add）** veil 效果 | 全残留层 | lowpass cutoff 落到 ~500–800 Hz；reverb wet 抬到 0.6–0.8；delay feedback 抬 |
| **不动** | 拍序时钟 | 内部继续跑，恢复无缝接回（`MUS-CLOCK-01`） |

恢复时反向：cutoff 拉回、wet 回落、运动层淡入，接回暂停时的 beat/slot16。

---

## 6. 验收问答（P1-2 验收标准）

**Q：为什么 pad/reverb 不会糊住碰撞反馈？**
A：因为长尾走 §3 四道闸门——send-only + send HPF >300 Hz + pre-delay 20–40 ms + sidechain ducking；碰撞的低频 thump 与高频 click 两块领地被 §1 避让矩阵保护，没有任何持续声部反向占用（`MUS-FX-03`）。

**Q：低频 kick / sub / bass / paddle thump 如何避免打架？**
A：见 §1 前两行——bass sidechain duck 给 kick；sub 锁 <120 Hz 单声道；paddle thump 占 80–150 Hz 瞬态与 sub 错峰；low lane 全程禁挂 delay/reverb 长尾，避免低频糊浊（`MUS-AUDIO-02`）。

---

## 7. 边界与禁止

- 不 sidechain / 不压碰撞反馈：brick/paddle one-shot 瞬态必须完整（`MUS-AUDIO-02`）。
- 不在 low lane 或碰撞 bus 挂长 reverb/delay：低频糊浊、瞬态被糊（`MUS-FX-03`）。
- 暂停不静音：veil 是低通+混响+delay 的渐变纱罩，不是 hard cut（`MUS-PAUSE-01`）。
- 高强度不靠铺满尾音求热闹：靠声部数 + 密度 + sidechain，send 反而更浅（`MUS-DENSE-01`、`MUS-INTENSITY-01`）。
- 不在本文件接运行时代码：这是混音预算规格，实现进音乐门面统一调度，玩法/UI 不直接建 `AudioContext`（`MUS-AUDIO-01`）。
