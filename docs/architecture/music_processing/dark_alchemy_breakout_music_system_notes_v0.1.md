# 暗黑炼金打砖块音乐系统迁移笔记 v0.1

> 日期：2026-06-23
> 目标：从节奏塔防资料中提炼可迁移到 Echo Alchemist V2 的音乐处理逻辑。

## 0. 一句话结论

不要把外部项目理解成“塔防 BGM 方案”，也不要把目标简化成“做一条循环 BGM”。最有价值的迁移对象是方法论：

**BGM 是底床，碰撞是乐句，连击是编曲，肉鸽成长是加层，炼金主题是把噪声精炼成音乐。**

对暗黑炼金打砖块来说，音乐系统应该服务于“破碎物质被重新炼成节奏”这个主题。球、挡板、砖块、Boss、连击、遗物触发都不只是音效触发点，而是同一张拍序网格上的音乐事件。

## 1. 核心不变量

### 1.1 单一拍序时钟

所有音乐、敌人、攻击、持续效果与阶段变化，都应尽量用 `beat / bar / abs` 表达，而不是用墙钟秒直接驱动。

迁移到本项目时的含义：

- 球速变化、砖块破裂、连击加速、Boss 阶段、危险警告应吸附到同一个音乐网格。
- 墙钟秒只应出现在底层 Web Audio 调度和视觉补偿边界；玩法真相使用拍序语义。
- 音乐层只能消费核心事件，不能重发或伪造核心玩法事件。
- 音乐内部事件统一保留 `music:*` 命名空间，避免和 `phase:*`、`wave:*`、`combat:*` 等玩法事件混名。

### 1.2 音乐层是表现层消费者

音乐系统不应直接写伤害、改砖块状态、改 Boss 状态。它应通过一个类似 `MusicDriver` 的桥接层订阅玩法事件，再调用音频门面：

- 输入：`ball:paddleHit`、`ball:wallHit`、`brick:hit`、`brick:break`、`combo:milestone`、`boss:phase`、`room:clear` 等事件。
- 输出：`setIntensity`、`setBandLevel`、`cuePhrase`、`cueFill`、`startGroove`、`stopGroove` 等音乐意图。
- 边界：玩法模块继续只认识游戏事件，不认识音符、调式、采样路径或 AudioContext。

### 1.3 作者层 DSL，运行层零感知

Strudel 值得借鉴的是 Pattern 思维：模式是时间函数，Pattern 可查询某段时间里发生的事件。但不建议直接引入 `@strudel/*` 包。

可迁移策略：

- 作者层可以用 mini-notation 或类似 DSL 写节奏型。
- 加载层把字符串编译成数组、步号集或事件表。
- 运行层只消费编译后的结构，不认识 DSL 字符串。
- 短期优先支持 groove lane 与 phrase anchor，不急着让 VFX/伤害也吃 Pattern。

## 2. Groove 床 + Phrase 反应层

### 2.1 Groove 层

Groove 是持续循环的音乐床，负责稳定风格身份与身体律动。它由 `low / mid / high / fx` 几组 lane 构成，按强度逐层打开。

对打砖块的适配：

| 组 | 职责 | 游戏映射 |
|---|---|---|
| low | kick、sub、808、rumble，提供地基与重击 | 挡板命中、重砖受击、Boss 重击、低血压迫 |
| mid | pad、chord stab、暗色和声身体 | 普通砖破裂、护盾变化、炼金阵亮起 |
| high | hat、lead、arp、metal tick、sparkle | 墙体反弹、连击、多球、碎晶 |
| fx | riser、impact、sweep、reverse、noise burst | 清房、Boss 预警、稀有砖、炼金反应 |

Groove 内部应再拆为两类：

- 固定音轨：永远保留的地基，例如低频脉冲、暗色 drone、房间主调式暗示。它们负责让暂停、低强度、空窗期仍有统一音乐身份。
- 变动音轨：跟随阶段、Boss、强度开关的层，例如 hat、acid、stab、roll、riser、Boss 专属纹理。它们负责表达战斗情况和阶段推进。

建议数据字段方向：

```text
TrackLayer {
  id,
  band: "low" | "mid" | "high" | "fx",
  role: "fixed" | "stage" | "boss" | "phrase",
  stageMask,
  minIntensity,
  maxIntensity?,
  bossProfile?,
  effectSends?
}
```

### 2.2 Phrase 层

Phrase 是游戏事件触发的短乐句，不是每次碰撞都无脑播一个孤立声响。它应被量化到下一拍、子拍或小节线，并使用当前调式/和声上下文。

推荐事件：

- 挡板命中：短 kick/sub thump，作为低频落点。
- 墙体命中：高频 click/metal tick，保持短、轻、可高并发。
- 普通砖破：中频 stab 或 glass hit。
- 硬砖受击：低中频 thunk + 暗色噪声。
- 元素砖破：按元素触发对应 FX burst。
- 连击里程碑：arp、hat roll 或上行 motif。
- 危险状态：滤波收窄、低频脉冲变稀、dissonant drone。
- 清房：短 resolving phrase，不要拖太长混响尾巴。
- Boss 警告：半拍或整小节前的 reverse/riser/stab。

## 3. 调式 × 风格正交

调式负责和声颜色，风格负责律动方言。二者不要混成一个枚举。

暗黑炼金优先调式：

| 调式 | 用途 |
|---|---|
| Phrygian | 邪典、仪式、异域黑暗；适合作为主 biome 色彩 |
| Harmonic minor | 哥特、炼金、古堡戏剧性；适合 Boss 与稀有房 |
| Aeolian | 稳定暗色；适合普通房间长期听 |
| Locrian / dim | 诅咒、腐化、濒死、危险段落；少量使用 |

适配风格：

| 风格 | 用途 |
|---|---|
| Techno | 炼金机器、循环法阵、稳定房间 |
| Trap / Phonk | 暗黑街机、低频压迫、肉鸽爽感 |
| Dubstep half-time | Boss、重砖、炼金爆发、Drop |
| DnB | 高速房、多球、弹球狂暴阶段 |
| Dark psytrance / psytechno | 高压、夜场 Boss、Frenzy、多球失控 |

### 3.1 Dark Psytrance 音色参考

参考 dark psy / psytrance 的声音设计时，优先抽取这些音色，而不是直接照搬整曲密度：

| 类型 | 音色 | 在本项目中的用途 |
|---|---|---|
| Bass | 单振荡器 saw/triangle、短包络、低通滤波、轻饱和 | 高压滚动低频、Boss 地基 |
| Lead | FM psy lead、acid squelch、resonant laser、vowel/formant lead | 紧张氛围、高强度连击、多球；优先作为音色手势，不做长旋律 |
| Pad | 慢开滤波 pad、moving bandpass、granular dark pad | 关卡风味、Boss 仪式、暂停 veil |
| FX | reverse shimmer、noise sweep、hall/reverb throw、delay automation | Boss 预警、阶段切换、清房 |
| Texture | horror-like whisper、metal scrape、crystal granular、bubbling liquid | 暗黑炼金世界观染色 |

资料摘录方向：

- Psytrance 常见速度、层叠、每 4-8 小节加层、持续 bass line 与 dark psy 的深色/重低频方向，可参考 [Psychedelic trance](https://en.wikipedia.org/wiki/Psychedelic_trance)。
- Psytrance bassline 的核心可收束为单振荡器、filter、envelope，再少量 distortion/compressor 给性格，可参考 Daniel Sokolovskiy 的 [Psytrance bassline synthesis](https://dsokolovskiy.com/blog/all/psytrance-bassline-synthesis/)。
- FM psy lead 可用高速 pitch/LFO 调制来获得 aggressive、granular 的高频质感，可参考 [Creating an FM Psy lead](https://dsokolovskiy.com/blog/all/creating-an-fm-psy-lead/)。
- Dark/progressive psy pad 常见做法包括 slow opening filter、moving bandpass、phaser/flanger、modulated delay、large hall/reverb tail，可参考 KVR 的 [dark progressive psytrance pads and synts](https://www.kvraudio.com/forum/viewtopic.php?t=223097) 讨论。
- Acid 线条的 TB-303 语汇来自 cutoff、resonance、envelope modulation、accent 的实时变化，可参考 [Acid trance](https://en.wikipedia.org/wiki/Acid_trance)。

### 3.2 和弦进行是情绪导演

Pad 与和弦进行应作为音乐系统核心，而不是背景装饰。推荐拆成两条轴：

- 情绪轴：由游戏阶段和激烈程度决定，选择当前 progression。
- 风味轴：由 Boss/关卡决定，选择调式、voicing、pad 音色和效果器。

```text
游戏阶段/激烈程度 -> 选择情绪进行
Boss/关卡风格 -> 选择调式、voicing、pad 音色和效果器
碰撞/连击事件 -> 在当前和弦上触发 phrase
```

推荐 progression 词表：

| 情绪状态 | 进行 | 用途 |
|---|---|---|
| Suspended Matter | `i5 drone` | 低强度、暂停、刚进房，悬而未决 |
| Dark Stability | `i - bII - i - VII` | 普通房间，暗色但稳定 |
| Pressure Coil | `i - bII - i - V7` | 高压、多球、连击升温 |
| Boss Ritual | `i - bII - V7 - i` | Boss 进入仪式感与解决感 |
| Frenzy Drop | `i - bII - dim - V7` | 爆发、濒危、Frenzy |

在迷幻 trance / psytechno 语境下，kick/bass 是推进骨架，pad/chord 是空间与情绪。Pad 占比不一定永远最大，但它应该决定“这个房间是什么味道、现在是不是危险、Boss 是什么仪式”。

### 3.3 乐句变体与过渡

电子舞曲常用 4/8/16/32 小节作为结构单位；Trance 中也常见每 4、8、16 或 32 小节增减乐器。低成本但有效的做法是把每个 4-8 小节 phrase 当成“下一个音乐地块”生成：

```text
当前 game state + boss profile + 上一个 phrase
  -> 生成下一个 phrase variation
  -> 最后一小节播放 transition
  -> 新 phrase 进入
```

Phrase variation 可以随机但受约束：

| 维度 | 可变项 | 约束 |
|---|---|---|
| 音色 | lead/pad/bass 的 timbre 变体 | 不改变 Boss profile 的核心风味 |
| 节奏 | lead gesture、时值、stutter、休止 | 必须吸附 beat/bar 网格 |
| 过程音 | 半音擦边、短 pitch bend、滤波扫动 | 必须围绕当前 chord，避免太像主旋律 |
| 音轨 | 新增/移除一条高频或 FX lane | 受 intensity 与阶段门控 |
| 效果器 | reverb throw、delay send、filter sweep、phaser 深度 | 不污染碰撞 one-shot 清晰度 |

常见 transition 手法：

- End-of-phrase fill：第 4 或第 8 小节末尾加短 lead pickup、tom/noise fill、hat roll。
- Riser / reverse：进入新 phrase 前 1 小节或半小节加 reverse shimmer、noise sweep。
- Removal：最后半小节移除 kick 或高频，制造“吸气”。
- Crash / impact：新 phrase 第一拍落 crash、impact 或低频 thump。
- Delay/reverb throw：把上一句最后一个 lead/stab 送入 delay/reverb，作为桥。
- Filter automation：进入 breakdown 或暂停时低通，进入 frenzy 时开滤波。

资料参考：

- Trance 音乐结构常通过 4/8/16/32 小节增减乐器推进，可参考 [Trance music](https://en.wikipedia.org/wiki/Trance_music)。
- EDMProd 对 micro-tension 的解释中提到 short fills、one-bar break、8 小节末尾移除 kick、下一 phrase 开头 crash 等做法，可参考 [The Advanced Guide to Tension and Energy in Electronic Music](https://www.edmprod.com/tension/)。
- Psytrance 音效处理中常见 delay/reverb、reverse squeak/reverse reverb、按 8/16 小节节奏性出现的效果，可参考 KVR 讨论 [Psytrance sounds/effects](https://www.kvraudio.com/forum/viewtopic.php?t=294434)。
- Progressive trance breakdown 可提前 8 小节开始做滤波和元素移除，可参考 [How to Make Progressive Trance Like the Pros](https://www.myloops.net/how-to-make-progressive-trance-like-the-pros-complete-guide)。

## 4. 强度分层 0-5

玩家越强，音乐越满。强度不只是音量，而是可听编曲层数。

| 强度 | 编曲状态 | 打砖块触发语义 |
|---|---|---|
| 0 | 暗色脉冲 + 稀疏 kick | 初始房、低威胁、刚进房 |
| 1 | 加金属 hat / low drone | 稳定弹球循环建立 |
| 2 | 加暗色 pad / snare | 普通战斗进入正轨 |
| 3 | 连击层、acid/stab/ghost perc | 连击成型、道具或遗物触发频繁 |
| 4 | 高频 roll、riser、滤波打开 | 高压、多球、Boss 前摇 |
| 5 | Drop/Frenzy，全频爆发 | 爆发技能、Boss 破防、清屏爽点 |

后续实现可进一步拆成 per-band intensity：`global / low / mid / high`，让不同成长路线听起来不同。例如低频路线让挡板与重击更满，高频路线让多球与连击更密。

强度还应驱动效果器，而不只是音轨开关：

- intensity 0-1：窄频、少混响、低频脉冲清晰。
- intensity 2-3：打开 sidechain、轻微 delay、更多中频 stab。
- intensity 4：滤波打开、riser 和高频 roll 进入。
- intensity 5：Drop/Frenzy，失真、duck、短混响和 impact 进入，但仍保留碰撞瞬态空间。

暂停态可以是一种独立音乐状态：停止大部分变动音轨，仅保留固定 pulse/drone，同时加低通、暗房间混响、延迟或磁带失速感。这样暂停不是静音，而像炼金阵被盖上厚玻璃，战斗被暂时封存。

## 4.1 Boss 音乐身份

Boss 战不应只是同一首曲子的强度 5。每个 Boss 应有显著的风格 profile：

| Boss profile | 音乐差异 | 效果器差异 |
|---|---|---|
| Crucible | Phrygian techno，机器循环，金属帽音 | 滤波自动化、短 rumble、强 sidechain |
| Venom | Aeolian trap/phonk，慢摆 808，腐蚀玻璃感 | bandpass、slime delay、filtered noise |
| Aether | DnB / fast techno，多球狂暴，高速 sparkle | fast hats、短 delay、频闪式高通 |
| Gothic | Harmonic minor half-time，古堡仪式，重 stab | 长一点的暗房间混响、organ-like pad、低频 impact |
| Dark Psy | Occult Phrygian，150 BPM，高频 FM/acid lead，滚动低频 | light distortion、reverb throw、resonant bandpass |
 
Boss profile 应同时控制 tempo、mode、lane 配方、效果器 send 与 PhraseBook，而不是只换一两个 one-shot。

## 5. 密音但低交互

打砖块天然事件很多，不能每个细碎碰撞都直接变成独立强反馈，否则会糊成噪声。应采用“密音但低交互”的处理：

```text
template = audibleNotes(bar)
anchors ⊆ template
autoFill = template - anchors
```

迁移解释：

- `template`：这一小节真实会听到的完整音乐纹理。
- `anchors`：玩家/事件需要命中的少数关键点。
- `autoFill`：其余细碎音由自动层补齐，是真音，但不是每个都需要玩法事件触发。

在打砖块中，可把高频碰撞流先聚合、限流、量化，再映射为少数 musical anchors：

- 50ms 内多次墙体反弹合并成一个 click ghost。
- 连击滚动时只在里程碑触发 phrase，其余由 hat/arp autoFill 撑密度。
- 多球阶段按小节统计碰撞密度，驱动 high lane 强度，而不是逐碰撞全量发声。

## 6. 最小可执行音乐规格

先做 1 个 biome 的竖切：

- 1 条 8 小节 seamless groove，BPM 128，Phrygian。
- 4 stems：`low / mid / high / fx`。
- 5 档 intensity layer，可单独开关。
- 12 个碰撞 one-shot：
  - `paddle`
  - `wall`
  - `normal_brick`
  - `armor_brick`
  - `crystal_brick`
  - `poison_brick`
  - `fire_brick`
  - `coin`
  - `relic`
  - `combo`
  - `danger`
  - `room_clear`
- 6 个 phrase：
  - `combo_up`
  - `multi_ball`
  - `alchemy_reaction`
  - `elite_spawn`
  - `boss_warning`
  - `drop_trigger`
- 2 个编曲版本：
  - 普通房间：126/128 BPM，直 16，稳定暗色 groove。
  - Boss：140 BPM half-time，重低频、长 riser、短促 impact。

## 7. 当前项目落地约束

Echo Alchemist V2 当前已有 `src/audio.js` 和 `.cursor/rules/audio.md`。后续实现时需遵守：

- 不在 gameplay/UI 模块里直接创建 `AudioContext`、`Audio` 或采样 fetch。
- 新方法集中进 `SoundManager` 或未来音乐门面，再通过 `audio` 代理调用。
- 高频碰撞音必须有防抖、限流或聚合。
- 若引入本地采样，必须保留 Web Audio 合成 fallback，并处理授权与 git ignore。
- 若修改音频架构，需要同步更新 `.cursor/rules/audio.md` 与本目录索引。
