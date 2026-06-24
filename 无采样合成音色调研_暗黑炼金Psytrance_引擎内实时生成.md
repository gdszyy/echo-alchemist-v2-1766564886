# 无采样自合成音色作为游戏音源 · 调研报告
### 主题：在「没有现成音源/采样」的前提下，自行合成音色，并满足「暗黑炼金 · Psytrance」游戏音乐风格 · 面向「游戏引擎内实时/程序化生成」

> 调研日期：2026-06-24　|　范围：广撒网式综述，**不预设单一结论**，给出多条并行路线 + 待验证清单。
> 适用前提（来自需求确认）：① 主要在**游戏引擎内实时生成**音频；② 风格为**暗黑炼金 / Psytrance（含 darkpsy / forest 倾向）**；③ 交付为结构化调研文档。
>
> **⚠️ 引擎已确认 = HTML / Web（vanilla JS PWA，Web Audio API）。** §2–§7 是跨引擎全景综述（保留作参考）；**真正落到你项目的答案在 §10（HTML + Web Audio 实战路线，含可运行代码）——建议先看 §10。**

---

## 0. 一页速览（TL;DR）

**核心判断（阶段性，非定论）：**「没有音源也能造音源」这件事在技术上完全成立，而且对 Psytrance 来说**反而是顺路**——Psytrance 的标志音色（酸性贝斯、滚动 bass、FM 嘶吼、暗黑 drone、合成 kick）本来就是**纯合成**出来的，几乎不依赖真实乐器采样。真正的难点不在「能不能合成」，而在「**在引擎里实时合成、并随玩法自适应**」这条工程链路。

**三层「无采样」技术栈（从成熟到前沿）：**

1. **纯算法合成（DSP）**——减法 / FM / 加法 / 波表 / 颗粒 / 波形折叠。**这是 Psytrance 的主力**，成熟、可实时、引擎原生支持最好。
2. **物理建模合成**——Karplus-Strong / 波导 / 模态。用于「有机/原声/打击/铃」类点缀音色，给暗黑氛围加「真实物体在震动」的不安感。
3. **神经合成（AI）**——DDSP / RAVE / NSynth。目前更适合**离线**生成音色样本/波表，再喂回引擎；纯实时仍在成熟中。

**引擎内落地的四条主路线（详见 §3、§7）：**

| 路线 | 引擎/工具 | 一句话定位 |
|---|---|---|
| A | **UE5 MetaSounds** | 引擎内置的 DSP 图，可直接搭振荡器→滤波→包络→效果，运行时改参数。**若用 UE，首选。** |
| B | **Unity 原生 DSP（OnAudioFilterRead）+ Faust / libpd** | Unity 没内置合成器，靠脚本写 DSP，或用 Faust/Pure Data 设计后编译进来。 |
| C | **中间件无关：Pure Data / Faust 设计 → Heavy(hvcc) 编译 → 喂 Wwise / Unity / UE** | 一次设计，多端部署的「DSP 源语言」路线。 |
| D | **Wwise（Synth One + SoundSeed）/ GameSynth** | 中间件自带合成器与程序化音效引擎，靠 RTPC 做自适应。 |

**最稳的工程姿势**：**离线设计 + 引擎内实时演奏**双轨——先用免费/开源合成器（Vital、Surge XT、VCV Rack、Dexed）把暗黑 Psytrance 的音色「调」出来、固化为参数表/波表，再在引擎里用等价的振荡器+滤波器**实时重建并由游戏参数驱动**。这样既保证音色质量，又拿到实时自适应。

---

## 1. 先把问题拆清楚

### 1.1 三个被混用的词
- **采样（sample）**：一段录好的音频文件（.wav）。「没有音源」通常指**没有采样库 / 没有真实乐器去录音**。
- **音色（timbre）**：声音的「音质指纹」——由谐波结构、包络、调制共同决定。**音色可以纯靠数学算出来，不需要任何录音。**
- **音源（sound source / 虚拟乐器）**：能被「弹奏」的发声体。我们的目标 = **用合成算法造出一个可弹奏的发声体**，让它在引擎里响应音符/游戏事件。

### 1.2 「无采样合成」的本质
一切声音 = 随时间变化的气压波形 = 一串 −1.0~1.0 之间的浮点数。**只要能用算法生成这串数，就不需要任何采样**。游戏引擎层面，这正是 Unity `OnAudioFilterRead`（把音频当 float 数组直接写）和 UE MetaSounds（缓冲级 DSP 图）所做的事。

### 1.3 本报告的两条约束
- **实时 / 引擎内**：方法必须能在每帧音频缓冲（48kHz 下约 0.02ms/样本）里算完，且能被游戏参数即时改写。
- **Psytrance 风格**：音色要能覆盖酸性、滚动、FM 金属、暗黑氛围、合成鼓这几类。

---

## 2. 合成方法全景（广撒网，先不下结论）

下面把「无采样」能用的合成法摊开。每种给出：原理一句话、对暗黑 Psytrance 的适配、引擎内实时可行性。

### 2.1 减法合成 Subtractive　★Psytrance 主力
- **原理**：从谐波丰富的波形（锯齿/方波）出发，用**滤波器减掉**部分频率，再用包络塑形。是最经典、最易实时的合成法。
- **Psytrance 适配**：**酸性贝斯、滚动 bass、酸 lead、合成 kick** 全靠它。经典配方就是「单锯齿振荡器 + 24dB 谐振低通 + 滤波包络」。
- **引擎可行性**：极高。MetaSounds 有 Saw/Sine 振荡器 + Ladder Filter；Unity 可手写；几乎所有路线都支持。

### 2.2 FM 合成 Frequency Modulation　★暗黑/嘶吼核心
- **原理**：用一个波形（调制子 modulator）去调制另一个波形（载波 carrier）的频率，生成密集的金属/不谐和谐波。DX7 即此原理。
- **Psytrance 适配**：darkpsy/forest 的「**冷的、机械的、外星的嘶吼/电流/screech**」主要来自 FM、环形调制与频谱处理。
- **引擎可行性**：高。MetaSounds 支持音频速率调制（一个振荡器的输出去调另一个的频率）；Dexed（开源 DX7 克隆）可离线设计。

### 2.3 加法合成 Additive
- **原理**：减法的反面——从纯正弦出发，**叠加**指定谐波来「搭」出复杂波形。
- **Psytrance 适配**：适合做**演化型 drone/pad**、金属铃、精确控制的泛音扫动。
- **引擎可行性**：中（谐波多时 CPU 重）。MetaSounds 可多正弦相加；适合少谐波或离线生波表。

### 2.4 波表合成 Wavetable　★音色最广
- **原理**：在一组单周期波形（波表）间扫描/插值，得到随时间演化的音色。Vital/Serum 路线。
- **Psytrance 适配**：**演化 lead、生长型 bass、暗黑纹理**。可用「频谱扭曲」拉伸/扭曲谐波造新音色，甚至**从文字生成波表**（Vital）。
- **引擎可行性**：高。波表本质是极小的数据 + 一个读表振荡器，**很适合「离线设计波表 → 引擎实时弹奏」**。MetaSounds 有 Wavetable 振荡器思路；Surge XT 提供波表/FM/弦模型等多种振荡器。

### 2.5 相位失真 / 波形折叠 / 西海岸 Phase Distortion / Wavefolding
- **原理**：不靠滤波，而是**扭曲波形本身**（折叠、相位畸变）来增谐波。Buchla「西海岸」流派。
- **Psytrance 适配**：制造**尖锐、撕裂、有攻击性**的音色，暗黑系很吃这套。
- **引擎可行性**：中高。本质是逐样本非线性函数，手写/Faust/MetaSounds 都能做。

### 2.6 颗粒合成 Granular　★暗黑纹理利器
- **原理**：把声音切成上百个毫秒级「颗粒」，重新排布/云化/脉冲化，生成织体。
- **Psytrance 适配**：forest/darkpsy 的**扭曲织体、毛刺、空间云、变形人声感**。注意：传统颗粒需要源素材，但**源可以是你自己合成出来的波形**，因此仍属「无采样」可行。
- **引擎可行性**：高。Wwise **SoundSeed Grain** 原生支持（含 cloud/pulsar/concatenative/wavetable 派生）；GameSynth **Particles** 实时控制海量颗粒。

### 2.7 物理建模 Physical Modeling
- **原理**：不录乐器，而是**用方程模拟物体振动**。
  - **Karplus-Strong**：一段「噪声脉冲激励 + 延迟线反馈共振」即可仿拨弦。
  - **数字波导（Julius Smith）**：用延迟线 + 散射节点模拟波在弦/管/膜中的传播，是 Karplus-Strong 的精确化扩展；商用首例是 1994 年 Yamaha VL1。
  - **模态合成**：一排并联谐振器，擅长**钟、铃、敲击**类。
- **Psytrance 适配**：给暗黑氛围加**「有机/真实物体在震」的不安点缀**（拨弦、敲击金属、共鸣管）；与电子音色并置形成张力。
- **引擎可行性**：高且省 CPU（延迟线+滤波很轻）。Wwise **SoundSeed Impact** 即用模态合成做碰撞共振；MetaSounds/Faust 都能搭 Karplus-Strong。

### 2.8 神经 / AI 合成 Neural Audio Synthesis　☆前沿
- **DDSP（Differentiable DSP，Google Magenta）**：把经典 DSP 模块（振荡器、滤波、混响）做成可微分、可被神经网络控制的积木，**不需要大型自回归模型就能高保真**，擅长**音色迁移、歌声合成、音效生成**。
- **RAVE（实时音频变分自编码器，IRCAM）**：用因果 CNN 实现 **48kHz 合成**与较好音色建模，是少数主打**实时/近实时**的神经合成器（有 `nn~` 的 Max/Pd 外部对象）。
- **NSynth / 可微波表 / 神经 FM（NAS-FM）**：用网络学习/插值音色，或自动搜索 FM 参数得到可调可解释的音色。
- **Psytrance 适配**：可用来**生成「暗黑有机」音色样本/波表**（先离线产出，再进引擎弹奏），或做音色迁移把普通音色「染」成想要的质感。
- **引擎可行性**：**目前以离线/近实时为主**，纯引擎内实时部署还不成熟（CPU/延迟/集成成本）。建议作为「离线音色工厂」，不作为实时主力。

### 2.9 芯片 / PSG 合成 Chiptune　☆混搭备选
- **原理**：用早期声芯片的程序化发生器：方波/三角/噪声（NES APU：2 脉冲+三角+噪声+DPCM）、SID（3 振荡器+滤波+环调+振荡器同步）、FM 芯片（YM2612/OPN2：6 通道 4 算子 FM）。
- **Psytrance 适配**：本身不是 Psytrance，但**8-bit/FM 颗粒可作为暗黑系的点缀层**（故障感、复古错位），或在「炼金机械」场景做 UI/道具音。
- **引擎可行性**：高（逻辑极简）。可用 Furnace（开源 tracker）设计，或在引擎里直接生成方波/噪声。

#### 合成法 × Psytrance 速查表

| 合成法 | 典型 Psy 用途 | 实时性 | 引擎内成熟度 | 是否真·无采样 |
|---|---|---|---|---|
| 减法 | 酸 bass / 滚动 bass / 酸 lead / kick | ★★★ | ★★★ | 是 |
| FM | 嘶吼 / 电流 / 金属 lead | ★★★ | ★★★ | 是 |
| 加法 | drone / 泛音扫动 / 铃 | ★★ | ★★ | 是 |
| 波表 | 演化 lead / 生长 bass / 纹理 | ★★★ | ★★★ | 是（波表可算出） |
| 相位失真/折叠 | 撕裂/攻击性音色 | ★★★ | ★★ | 是 |
| 颗粒 | 暗黑织体 / 毛刺 / 云 | ★★ | ★★★（Wwise/GameSynth） | 是（源可自合成） |
| 物理建模 | 有机点缀 / 敲击 / 共鸣 | ★★★ | ★★★ | 是 |
| 神经/AI | 离线音色工厂 / 音色迁移 | ★（实时未熟） | ★ | 是 |
| 芯片/PSG | 复古点缀 / 道具 UI | ★★★ | ★★ | 是 |

---

## 3. 引擎内实时 / 程序化音频管线（本案核心）

「在引擎里实时合成」才是这次的真问题。下面逐一拆每条管线的合成能力、自适应能力、成本与坑。

### 3.1 UE5 MetaSounds　★若用 Unreal，首选
**定位**：MetaSound 是 UE 内置的**高性能 DSP 渲染图**，让音频设计师在缓冲级、样本级（48kHz 下约 0.02ms）完全掌控发声。不是 Sound Cue 那种「播采样」，而是**真正的合成图**，节点式、无需写代码，且支持**音频速率调制**（用一个音频缓冲去调另一个节点参数）——这正是 FM、PWM、深度调制的基础。

**它能直接搭出 Psytrance 链路**（基于官方「用 MetaSounds 做程序化音乐」教程的实测节点）：
- **节奏**：`Trigger Repeat` + `BPM To Seconds`（可把 BPM 设 60–180，覆盖 full-on 145–150 / darkpsy 150–160）+ `Trigger Counter` 做 8/16 步循环。
- **旋律/音高**：`Scale To Note Array`（限定调式，暗黑系选小调/半音/无调性）+ `Random Get` + `Random(Int) Seed` 生成随机音符，`MIDI To Frequency` 转频率。
- **合成**：`Sine` / `Saw` 振荡器；两路相加；`Crossfade` 在正弦/锯齿间混合（等于实时改音色明亮度）。
- **滤波**：`Ladder Filter`（梯形滤波，Resonance 可拉到 6+ 做酸性谐振）+ `LFO` 调 Cutoff（500→5000Hz 扫动）——**这就是酸性扫频的引擎原生实现**。
- **包络**：`AD Envelope`（Decay≈0.1s）做短促打音——和 Psy bass「Attack/Release=0、短 Decay」的理念一致。
- **效果**：`Delay` + `Stereo Delay`（Ping Pong，feedback 0.4）做立体声拓宽与 psy 标志性回声。
- **运行时自适应**：在 Blueprint 里用 `Set Float Parameter`（改 BPM/Crossfade/Cutoff）和 `Execute Trigger Parameter`（触发新旋律），由碰撞盒/玩法事件驱动——**音色随玩法实时变形**。

**优点**：引擎内置、免费、可视化、样本级精度、原生自适应。**坑**：仅 UE；复杂 patch 的 CPU 预算要盯紧；高级合成（颗粒/物理建模）需自行用基础节点搭或等插件。

### 3.2 Unity 路线（Unity 不内置合成器，三种补法）
1. **原生 DSP：`OnAudioFilterRead(float[] data, int channels)`**。实现它即把自定义滤波器插入 DSP 链；若它是链首且 AudioSource 无 clip，**它本身就成了音源**——你直接往 float 数组写波形（正弦/噪声/任意合成）。配合 `AudioSettings.dspTime` 做样本级定时。适合手写振荡器/滤波/合成鼓。开源参考：`pixlpa/Unity-Synth-Experiments`（C# 生成式合成脚本）。
2. **libpd / Heavy(hvcc)**：用 **Pure Data** 可视化设计合成器，再用 **Heavy 编译器（hvcc，现由 Wasted Audio 维护）** 把 Pd patch 编译成**优化的 C/C++ + C# 接口**塞进 Unity（也能编译成 VST、或喂 Wwise/UE）。注意 Unity 官方已不再正式支持 libpd，社区项目（如 `Magicolo/uPD`）用 Pd+libpd 替换 Unity 音频引擎。
3. **Faust（faust2unity）**：用 **Faust** 这门专做实时 DSP 的函数式语言写合成器/效果，`faust2unity` 直接产出 Unity 音频插件（含原生 `.bundle` + C# 脚本与 Inspector）。同一份 Faust 源码可编译到 **20+ 目标**（VST、Unity、Web Audio、嵌入式…），**一次写、多端用**。

**优点**：灵活、跨平台、可深度定制。**坑**：要写代码/学 Pd 或 Faust；原生 `OnAudioFilterRead` 在主线程外回调，性能与线程安全要小心。

### 3.3 Wwise（中间件自带合成 + RTPC 自适应）
- **Synth One**：Wwise 内置的**虚拟模拟合成器**（双振荡器 + 噪声 + 滤波），可做减法类 bass/lead，纯合成不依赖采样。
- **SoundSeed 系列**（纯合成/程序化）：
  - **Grain**：颗粒合成源插件，含 cloud/pulsar/concatenative/wavetable 派生——**暗黑织体主力**。
  - **Air**：纯合成风/whoosh，随游戏动作无限变体。
  - **Impact**：**模态合成**做碰撞共振变体（无采样的敲击/物体声）。
- **自定义 DSP**：可挂 Heavy/hvcc 编译的 Pd patch 作为插件。
- **自适应**：靠 **RTPC**（实时参数控制）+ 水平重排 + 垂直分层，把 cutoff/distortion/层级绑到游戏变量。
**坑**：商业授权（有免费/独立档，超阈值收费）；Synth One 偏基础，复杂音色仍需叠插件。

### 3.4 FMOD
- 合成能力相对弱：核心是**采样回放 + 事件/参数系统**，自带的发生器以振荡器/噪声等基础单元为主。做 Psytrance 这种**重合成**风格，FMOD 更适合「**回放离线合成好的素材 + 用参数做垂直分层/水平重排/实时混音**」，纯实时合成需靠插件（含 hvcc 编译的 Pd）。
- **定位**：若团队已用 FMOD，可走「离线设计音色 → FMOD 做自适应编排」的混合姿势；纯引擎内合成不是它的强项。

### 3.5 GameSynth（Tsugi）+ Runtime
- **专做程序化音效合成**的工具：**模块合成器（130+ 模块）**自搭任意音色模型；**Particles** 用颗粒合成实时控制海量声音颗粒；另有 Whoosh、Impact/Contact 等专用合成器。
- **实时优势**：声音运行时合成，所有维度都能被游戏参数控制；**一个 patch 仅几百字节**，比采样省好几个数量级的内存与传输。
- **定位**：偏「程序化**音效/SFX**」而非旋律音乐，但其模块合成器 + 颗粒非常适合做**暗黑炼金的环境织体、道具、魔法/化学反应音**。有 Runtime 可集成进引擎（商业授权）。

### 3.6 「DSP 源语言」层：Pure Data / Faust / Csound / SuperCollider
把这层单列，因为它是 B/C/D 路线的**公共上游**——你在这里设计音色，再编译/嵌入到任意引擎：
- **Pure Data（开源）**：可视化 DSP，社区最大；经 **Heavy/hvcc** 编译成 C → Unity/UE/Wwise/VST。
- **Faust（开源）**：文本式、极致实时、编译目标最多（含 Unity）；适合工程化、版本管理。
- **Csound / SuperCollider**：老牌、强大，常用于实验/生成音乐，也有引擎绑定，但集成成本高于前两者。

#### 引擎管线对比表

| 管线 | 内置合成强度 | 实时合成 | 自适应机制 | 学习曲线 | 授权/成本 | 适合本案吗 |
|---|---|---|---|---|---|---|
| **UE5 MetaSounds** | 高（图内搭） | ★★★ | 蓝图改参/触发 | 中 | UE 内置免费 | ★★★（用 UE 则首选） |
| **Unity + OnAudioFilterRead** | 需手写 | ★★★ | 脚本/dspTime | 中高（写 DSP） | Unity 免费档 | ★★ |
| **Unity + Faust/libpd** | 高（外部设计） | ★★★ | 脚本/参数 | 高 | 开源免费 | ★★★ |
| **Wwise（Synth One+SoundSeed）** | 中高 | ★★★ | RTPC/分层/重排 | 中 | 商业（有免费档） | ★★★（重音效+自适应） |
| **FMOD** | 低（偏回放） | ★（靠插件） | 参数/分层 | 低中 | 商业（有免费档） | ★（做编排不做合成） |
| **GameSynth + Runtime** | 高（程序化SFX） | ★★★ | 游戏参数直驱 | 中 | 商业 | ★★（音效/织体强，旋律弱） |
| **Pd/Faust（上游设计）** | 极高 | ★★★ | 取决于宿主 | 高 | 开源免费 | ★★★（跨引擎复用） |

---

## 4. 暗黑炼金 Psytrance 音色清单 × 无采样合成配方

darkpsy/forest 的共性：**148–160 BPM、四踩 kick、滚动 sub、密集 FM/酸性织体、小调/半音/无调性、drone 与 horror 氛围**。下面给每类音色一份「**合成法 + 关键参数 + 引擎落地**」配方。所有配方都不需要采样。

### 4.1 合成 Kick（鼓全部可合成，无需采样）
- **合成法**：减法 + 音高包络。
- **配方**：正弦振荡器基频 ~58Hz；**音高包络**从高频快速下扫到低频（攻击 ~1ms、衰减 ~50ms）给出「咚」的冲击；叠一个极短噪声/click 给「点」；再过波形折叠/失真增加穿透。
- **引擎**：MetaSounds（Sine + 音高用包络驱动）/ Unity OnAudioFilterRead 手写 / Faust。Psy 的 kick 与 bass 是**一体设计**（见 4.2 的 duck 关系）。

### 4.2 滚动贝斯 / Psy Bass　★全曲灵魂（含权威配方）
- **合成法**：减法（单振荡器即可）。
- **权威配方**（综合 Daniel Sokolovskiy 的拆解）：
  1. **单锯齿（Saw）振荡器**，整体**降一个八度**；多音色时开 **Retrig**（强制每次发音从波形同一相位起，防止相位漂移）。
  2. **24dB/oct 低通滤波**（比 12dB 更锐），cutoff 取味；**把 cutoff 接到调制包络**。
  3. **ADSR**：**Attack=0、Release=0**（bass 不要淡入淡出），**Sustain 低**（不要长身），**Decay≈30%**——这就是「短促、有弹性」的滚动感来源。
  4. （可选）**resample/bake**成单音后放进采样器排 pattern——这是 DAW 做法；**在引擎里等价于「把这套合成参数固化成一个可触发的 MetaSound/Faust 实例，由序列器触发」**。
  5. **EQ**：清掉 ~300Hz 的「mud」，轻推基频与低次谐波（如 D 音在 73/147Hz）。
- **分层与 growl**：**sub 层（纯正弦低频）+ mid 层（带失真的中频）**，中频失真层提供能「切穿混音」的 **growl**，是 darkpsy 标志。频率管理：mid 层 40Hz 高通、sub 层 120Hz 低通、两层 200–250Hz 窄带切给 kick 让位。
- **与 kick 的关系（off-beat 滚动）**：bass 落在 kick 的反拍；用 **sidechain/ducking**（kick 触发，2:1、约 3–6dB 衰减）让 bass「每拍呼吸」，制造 145–150BPM 的滚动律动。**引擎内**可用包络跟随或由 kick 触发的增益包络实现，不必依赖插件。

### 4.3 酸性 303 Lead / Acid
- **合成法**：减法 + 实时滤波操控。
- **配方**：方波/锯齿 → **谐振低通**，**实时改 cutoff/resonance + accent（重音）+ slide（滑音）**，这「滤波扫频 + 重音 + 滑音」就是酸味本体。叠失真增强 squelch。
- **引擎**：MetaSounds `Ladder Filter`（Resonance↑）+ `LFO`/包络扫 Cutoff；slide 用音高滑移节点；accent 用速度→包络深度。**cutoff/resonance 正好绑成 RTPC**，让酸度随玩法变化。

### 4.4 FM 嘶吼 / 电流 / Screech　★暗黑系标志
- **合成法**：FM + 环形调制 + 反馈。
- **配方**：载波 + 调制子，**高调制指数**得到密集不谐和谐波；加**环形调制**做金属/钟感；调制比非整数 → 外星/不稳定音；用 LFO 慢扫调制深度让音色「活着演化」。darkpsy 的「电流/闪电」声多是 FM + 噪声 + 快速随机调制。
- **引擎**：MetaSounds 音频速率调制（一个振荡器输出接另一个频率输入）；离线可用 **Dexed**（DX7 克隆）设计后移植参数。

### 4.5 暗黑氛围 Drone / Pad
- **合成法**：加法 / 波表 / 噪声+滤波 +（颗粒）。
- **配方**：低频正弦堆叠（加法）或缓慢扫描的波表做**演化 drone**；噪声过带通滤波做「风/空间」底噪；叠**长混响 + ping-pong delay**塑空间；用极慢 LFO 调音色避免静止。forest 风可混入物理建模的有机共鸣。
- **引擎**：MetaSounds 多正弦 + 滤波 + Stereo Delay；Wwise **SoundSeed Air**（纯合成风/whoosh）。

### 4.6 故障 / 扭曲织体 / 变形人声感
- **合成法**：颗粒 + 物理建模 +（神经迁移）。
- **配方**：把**自合成的波形**作为颗粒源，云化/脉冲化做毛刺织体；快速随机化颗粒位置/音高得到 glitch；用颤动 LFO + 比特/采样率下采样加「腐坏」感。需要「变形人声」可用**共振峰（formant）滤波**在无人声采样下模拟元音。
- **引擎**：Wwise **SoundSeed Grain** / GameSynth **Particles**；离线可用 **RAVE/DDSP** 生成「暗黑有机」素材再进引擎。

### 4.7 有机点缀 / 敲击 / 铃 / 共鸣
- **合成法**：物理建模（Karplus-Strong / 模态）。
- **配方**：Karplus-Strong（噪声脉冲激励 + 延迟线反馈）做拨弦/拨片；模态合成（并联谐振器）做钟/铃/敲击金属——给「炼金器皿、机械、滴落」类音效真实物理感，与电子层形成暗黑张力。
- **引擎**：Faust/MetaSounds 搭延迟线；Wwise **SoundSeed Impact**（模态）。

#### 音色 → 合成法 → 引擎落地 速查

| Psy 音色 | 首选合成法 | 引擎落地（举例） |
|---|---|---|
| Kick | 减法+音高包络 | MetaSounds / OnAudioFilterRead / Faust |
| 滚动 Bass | 减法（saw+24dB LP+env） | MetaSounds（Saw+Ladder+AD）/ Faust |
| 酸 303 Lead | 减法+实时滤波 | MetaSounds（Ladder+LFO+RTPC） |
| FM 嘶吼/电流 | FM+环调+反馈 | MetaSounds 音频速率调制 / Dexed 设计 |
| 暗黑 Drone/Pad | 加法/波表/噪声+滤波 | MetaSounds 多正弦+混响 / SoundSeed Air |
| 故障织体/变形人声 | 颗粒+formant+(神经) | SoundSeed Grain / GameSynth Particles |
| 敲击/铃/有机 | 物理建模（KS/模态） | Faust / SoundSeed Impact |

---

## 5. 让音色「活」在游戏里：自适应 / 生成式

「实时合成」的真正价值是**音乐随玩法变化**。两大经典机制 + 生成式：

- **垂直分层（Vertical Layering）**：同一段音乐叠多层（氛围底 → bass → 酸 lead → 嘶吼），按**强度/事件**增减层，改变织体与紧张度而不打断流动。暗黑炼金可把「炼金进度/危险度」绑到层数。
- **水平重排（Horizontal Re-sequencing）**：按状态在不同乐段间切换/过渡（探索段 ↔ 战斗段）。
- **生成式 / 算法作曲**：Psytrance 的催眠性正好契合算法生成——
  - **Euclidean 节奏**：把 N 个脉冲尽量均匀分布到 M 步，自动产出滚动/复节奏，实时变体无穷（很适合 psy 的 16 分滚动）。
  - **随机音阶取音 + 种子**：MetaSounds 的 `Scale To Note Array + Random Get + Seed` 即可在限定调式内生成永不重复的旋律。
  - **Markov / 元胞自动机 / L 系统**：做更长程的演化（参考 `subsequence` 这类生成式序列引擎的思路）。
- **参数直驱音色（RTPC / Set Parameter）**：把 **cutoff、resonance、失真量、调制深度、BPM、层增益**绑到游戏变量（玩家血量、炼金温度、敌人密度），**音色本身随玩法形变**——这是采样做不到、纯合成独有的优势（GameSynth 也主打这一点）。

---

## 6. 工具与成本盘点（免费/开源优先）

**设计期（离线把音色调出来 / 生成波表）**
- **Vital**（免费，波表+频谱扭曲，可文字生波表）——演化 lead / 纹理。
- **Surge XT**（开源，混合合成：经典/现代 VA、波表、FM、弦模型、Twist）——一个顶多个。
- **Dexed**（开源，DX7/FM 克隆）——FM 嘶吼/金属音色设计。
- **VCV Rack / Cardinal**（开源模块合成）——自由实验，Surge XT 也有 VCV 模块版。
- **Pure Data / Faust**（开源）——既是设计工具也是引擎上游。

**引擎期（实时落地）**
- **UE5 MetaSounds**：UE 内置免费。
- **Unity**：免费档；原生 `OnAudioFilterRead` + 可选 Faust/libpd（开源）。
- **Wwise**：商业，有免费/独立档（Synth One + SoundSeed 程序化）。
- **FMOD**：商业，有免费档（偏回放+自适应编排）。
- **GameSynth + Runtime**：商业（程序化音效/织体）。

**神经/AI（离线音色工厂）**
- **DDSP**（开源，Magenta）：音色迁移/合成。
- **RAVE / `nn~`**（开源，IRCAM）：实时/近实时神经合成，可进 Max/Pd。

---

## 7. 推荐路线（分场景并行，**保留多选**）

> 仍不下唯一结论——按你最终选的引擎与团队习惯，从下面选 1 主 + 1 兜底。

- **路线 A · UE5 全程序化**：用 **MetaSounds** 直接在引擎里搭 kick/bass/酸 lead/嘶吼/drone，蓝图用 RTPC 与触发做自适应。最少外部依赖、最强实时性。**若项目用 Unreal，首选。**
- **路线 B · Unity 混合**：用 **Faust 或 Pure Data 设计音色 → 编译进 Unity**（faust2unity / hvcc），关键路径用 **OnAudioFilterRead** 兜底。跨平台、可深度定制。
- **路线 C · 中间件无关**：在 **Pd/Faust** 一次设计全部音色 → **Heavy(hvcc)** 编译 → 同时喂 **Wwise/Unity/UE**。适合多端/换引擎风险高的项目。
- **路线 D · Wwise 自适应为主**：**Synth One + SoundSeed（Grain/Air/Impact）** 做合成，RTPC + 分层/重排做自适应；重音效与氛围时尤其合适。
- **贯穿姿势 · 离线设计 + 引擎实时演奏**：先用 **Vital/Surge XT/Dexed** 把暗黑 Psy 音色与**波表**调好、固化参数，引擎里用等价振荡器+滤波**实时重建**并由游戏参数驱动。兼顾质量与实时。
- **增强 · 神经离线工厂**：用 **DDSP/RAVE** 批量产「暗黑有机」音色样本/波表，作为引擎波表振荡器的素材源（不做实时主力）。

---

## 8. 风险 · 坑 · 待验证清单（**不轻易收口**）

- **CPU 预算**：Psytrance 层多、调制密；引擎内同时跑多路实时合成要压性能，移动端/主机尤甚。**待验证**：目标平台单帧音频预算够不够。
- **合成鼓 vs 采样鼓的冲击感**：纯合成 kick 可能不如精修采样「狠」。**待验证**：A/B 试听，必要时合成 + 极短瞬态层叠加。
- **神经合成实时性**：DDSP/RAVE 多为离线/近实时，纯引擎内实时部署不成熟。**结论**：先当离线工厂。
- **中间件授权成本**：Wwise/FMOD/GameSynth 超免费阈值要付费；预算需评估。
- **「无采样」的边界**：颗粒/物理建模的「激励」可以是自合成波形，仍算无采样；但若图省事用了录音激励就破例了——**保持纪律**。
- **音乐性 vs 程序化**：纯算法生成易「机械」；Psy 的催眠靠微妙律动与渐变，**生成式需要人工设计约束**（调式、节奏模板、渐变曲线）。
- **平台 DSP 差异**：Unity `OnAudioFilterRead` 回调线程/缓冲大小因平台而异，需做缓冲与线程安全。
- **暂未深挖、可继续撒网的方向**：① Reaktor/Max-gen~ 等其他可移植 DSP 框架；② Sonic Pi/SuperCollider 的引擎绑定；③ 移动端轻量合成库（如 Soundpipe/Tonic/STK 工具箱）；④ WebAudio（若有网页版/小游戏）；⑤ 物理建模商用库（AAS、Pianoteq）做离线音色源。

---

## 9. 下一步 & 需要你拍板的问题

为把上面收敛成可执行原型，需要确认：
1. **引擎到底是 UE5 还是 Unity？**（决定走 A 还是 B/C；这是最大分叉）
2. **目标平台**（PC / 主机 / 移动 / 网页）——决定 CPU 预算与库选型。
3. **音乐是「全程序化生成」还是「合成音色 + 预排结构」**？（影响生成式投入）
4. 要不要我**直接产出一个最小可跑原型配方**——例如「MetaSounds 版滚动 Psy-bass 节点清单」或「Faust 版酸性 303」的逐节点/逐行参数表，让你照着搭？

---

## 来源（Sources）

**合成方法 / 物理建模 / 神经合成**
- [What Are The Different Types of Synthesis? FM, Subtractive, Additive – SOUND7](https://sound7.com/blogs/knowledge/what-are-the-different-synthesis-types)
- [4 Main types of Synthesis explained: Wavetable, Subtractive, Additive, FM – Top Music Arts](https://topmusicarts.com/blogs/news/4-main-types-of-synthesis-explained-wavetable-fm-additive-and-subtractive)
- [Wavetable vs FM vs Additive vs Subtractive Synths – ProducerHive](https://producerhive.com/ask-the-hive/wavetable-vs-fm-vs-additive-vs-subtractive-synthesis/)
- [Excite and Resonate: A History of Physical Modelling Synthesis – Attack Magazine](https://www.attackmagazine.com/features/long-read/excite-and-resonate-a-history-of-physical-modelling-synthesis/)
- [Physical modelling synthesis – Wikipedia](https://en.wikipedia.org/wiki/Physical_modelling_synthesis)
- [What is Physical Modeling? 5 Techniques – Baby Audio](https://babyaud.io/blog/what-is-physical-modeling)
- [DDSP: Differentiable Digital Signal Processing – OpenReview](https://openreview.net/forum?id=B1x1ma4tDr)
- [DDSP (Differentiable Digital Signal Processing), finally explained – Neural Analog](https://neuralanalog.com/docs/ddsp-model-magenta)
- [DDSP Framework: Differentiable Audio Synthesis – Emergent Mind](https://www.emergentmind.com/topics/ddsp-framework)
- [NAS-FM: Neural Architecture Search for Tunable and Interpretable Sound Synthesis (FM) – arXiv](https://arxiv.org/pdf/2305.12868)

**引擎内实时 / 程序化音频**
- [Creating Procedural Music with MetaSounds – Unreal Engine 5.7 Documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/creating-procedural-music-with-metasounds)
- [MetaSounds: The Next Generation Sound Sources – Unreal Engine Documentation](https://dev.epicgames.com/documentation/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine?lang=en-US)
- [MonoBehaviour.OnAudioFilterRead – Unity Scripting API](https://docs.unity3d.com/ScriptReference/MonoBehaviour.OnAudioFilterRead.html)
- [Procedural Audio, made in Unity3D – Konstantinos Sfikas](https://www.konsfik.com/procedural-audio-made-in-unity3d/)
- [Unity-Synth-Experiments (OnAudioFilterRead) – GitHub / pixlpa](https://github.com/pixlpa/Unity-Synth-Experiments)
- [hvcc – the heavy compiler collection for Pure Data – GitHub / Wasted-Audio](https://github.com/Wasted-Audio/hvcc)
- [Pure Data with Unity using Enzien Audio Heavy – Thareeq Roshan](https://www.thareeqroshan.com/post/pure-data-with-unity-game-engine-using-enzien-audio-heavy)
- [uPD: alternative to Unity's audio engine using Pure Data and LibPD – GitHub / Magicolo](https://github.com/Magicolo/uPD)
- [Faust Programming Language](https://faust.grame.fr/)
- [faust/architecture/unity (faust2unity) – GitHub / grame-cncm](https://github.com/grame-cncm/faust/blob/master-dev/architecture/unity/README.md)
- [Wwise SoundSeed Grain – Audiokinetic](https://www.audiokinetic.com/products/plugins/soundseed-grain/)
- [Audiokinetic Plug-ins (SoundSeed Air/Impact, Synth One)](https://www.audiokinetic.com/products/plug-ins/)
- [GameSynth – Tsugi](https://tsugi-studio.com/web/en/products-gamesynth.html)
- [GameSynth 2021: New Tools for Procedural Audio Synthesis – Synthtopia](https://www.synthtopia.com/content/2021/02/18/gamesynth-2021-delivers-new-tools-for-procedural-audio-synthesis/)

**Psytrance / darkpsy 声音设计 + 自适应/生成式**
- [Psytrance bassline synthesis – Daniel Sokolovskiy](https://dsokolovskiy.com/blog/all/psytrance-bassline-synthesis/)
- [PsyTrance Bass Process – CineTrance](https://cinetrance-records.com/blogs/cinetrance-blog/psytrance-bass-process)
- [Crafting the Perfect Psytrance Bassline – Psychedelic Island](https://psychedelicisland.com/articles/music-production/how-to-create-the-perfect-bassline-for-psytrance/)
- [Mastering Psytrance: Crafting Hypnotic Sounds Step-By-Step – SoundCy](https://soundcy.com/article/how-to-make-psytrance-sounds)
- [Dark Psytrance – Melodigging](https://www.melodigging.com/genre/dark-psytrance)
- [Forest Psytrance – Melodigging](https://www.melodigging.com/genre/forest-psytrance)
- [Synthesizing Your Own Percussion Samples – Sweetwater InSync](https://www.sweetwater.com/insync/synthesizing-and-creating-your-own-percussion-samples/)
- [Drum Synth Sound Design: Kick & Snare – ModeAudio](https://modeaudio.com/magazine/drum-synth-sound-design-kick-snare)
- [Vertical Layering vs. Horizontal Resequencing – The Game Audio Co.](https://www.thegameaudioco.com/making-your-game-s-music-more-dynamic-vertical-layering-vs-horizontal-resequencing)
- [Adaptive music – Wikipedia](https://en.wikipedia.org/wiki/Adaptive_music)
- [Euclidean Rhythms: How to Make Complex Beats – LANDR](https://blog.landr.com/euclidean-rhythms/)
- [subsequence: generative MIDI sequencer / algorithmic composition – GitHub / simonholliday](https://github.com/simonholliday/subsequence)

**Chiptune / 声芯片**
- [Chiptune – Grokipedia](https://grokipedia.com/page/Chiptune)
- [Sound chips and chip music – Introduction to Demoscene](https://compumuseum.gitbook.io/introduction-to-demoscene/07-soundchip-chiptune)
- [furnace (开源 chiptune tracker) – GitHub / tildearrow](https://github.com/tildearrow/furnace)

**免费/开源合成器**
- [8 phenomenal free synths for sound design & composition – dBs Institute](https://insider.dbsinstitute.ac.uk/8-phenomenal-free-synths-for-sound-design-composition)
- [Vital – Spectral Warping Wavetable Synth](https://vital.audio/)
- [Surge XT for VCV Rack – CDM](https://cdm.link/surge-xt-for-vcv-rack/)
- [Best free synth plugins – MusicTech](https://musictech.com/guides/buyers-guide/best-free-synth-plugins/)

---

## 10. 落到你的项目：HTML + Web Audio API 实战路线（含可运行代码）★先看这节

> 前面 §2–§7 是跨引擎全景（UE/Unity/Wwise 等），保留作参考。**你的引擎是 HTML / vanilla JS PWA，音频走 Web Audio API**——所以真正能落地的答案在这里。本节全部基于你仓库里**已经存在**的 `src/audio.js`（`SoundManager`，v5「纯合成 + Reverb」）来写，代码可直接接进去。

### 10.1 现状盘点（基于 `src/audio.js`）

好消息：**你的项目其实已经在「无采样合成」这条路上了**，只是只做了「音效」，还没做「音乐」。

| 已具备 | 证据（audio.js） | 对本需求意味着 |
|---|---|---|
| 一个全局 `AudioContext` | `this.ctx = new AudioContext()` | 音乐引擎直接复用，**不要再新建** ctx |
| 主输出链 | `masterGain(0.3) → compressor → destination` | 音乐总线挂到 `masterGain` 即可，自动过压缩防爆 |
| **纯合成混响（零采样）** | `_createReverbNode()` 用指数衰减白噪声合成 IR → ConvolverNode | 暗黑 drone/lead 的空间感现成，**不需要任何 IR 采样文件** |
| 纯合成音效 | playKick/playShoot/playLightning… 全是 Osc+Filter+Gain | 证明「无采样」在你项目里已验证可行 |
| 噪声源 | `this.noiseBuffer` | hi-hat / 颗粒纹理 / 风噪直接复用 |

缺口（= 本次要补的）：

1. **没有节拍时钟 / 音序器**——音效是「事件触发即响」，音乐需要稳定时间轴。
2. **没有 BGM / 音乐层**——没有 kick+bass 的循环、没有按玩法变化的自适应音乐。
3. **`Audio_sample/` 仍是采样依赖**（Stickz Rise 纹理 + KSHMR kick）——做完本方案后**可以整包删掉**，音乐+音效全纯合成。（`assets/audio-local` 那批 preview 采样本来就 git-ignored、不上线，不用管。）

### 10.2 「想要的 Psy 音色 → Web Audio 节点」对照表

| 目标音色 | Web Audio 节点组合 | 关键参数 |
|---|---|---|
| 合成 Kick | `Oscillator(sine)` + 频率包络 + `Gain` 包络（可选 `WaveShaper` 饱和） | 频率 160→45 Hz / 0.12s；增益 1→0.001 / 0.18s；+1.2kHz click |
| 滚动 Bass | `Oscillator(saw)` → `BiquadFilter(lowpass, Q≈8)` + 滤波包络 + `Gain` ADSR | 截止 1200→120 Hz；A≈2ms / D≈140ms / **无 sustain** |
| 酸性 303 | 同上 + accent（增益跳变）+ slide（`frequency` 线性滑音）+ `WaveShaper` 失真 | Q 10–18；截止随 step 扫动 |
| FM 嘶吼/金属 lead | mod `Oscillator` → `modGain` → carrier.`frequency`(AudioParam) → `Gain` | mod 比 **2.5（非整数）**；调制深度高 |
| 暗黑 Drone/Pad | 多 `Oscillator` 失谐叠加 / `PeriodicWave` 加法 + lowpass + 合成 Reverb | 慢 LFO 扫滤波；长尾 IR |
| 空间感 | `ConvolverNode` + 合成指数衰减 IR | **复用你已有的 `_createReverbNode()`，零采样** |
| 泵感 sidechain | 手动调度 `bassBus.gain` 在 kick 时刻下压再回升 | 0.2→1.0 / 0.12s |
| 颗粒纹理 / 物理建模铃 | `AudioWorkletNode`（自写逐样本 DSP） | 后续增量，非首版必需 |

### 10.3 关键缺口：音序器 —— 用 lookahead scheduler，别用 setInterval

JS 的 `setInterval`/`setTimeout` 抖动大（受主线程阻塞），**直接拿来当节拍器会飘**。正解是 Chris Wilson 的「两个时钟」模式：

- **不精确的时钟**（`setTimeout` ~25ms）只负责「醒来看一眼」；
- **精确的时钟**（`ctx.currentTime` + `osc.start(t)`，采样级精度）负责「准点发声」；
- 每次醒来，把未来 ~100ms 内该响的音符**提前排进音频时钟**。

库的取舍：**手写**（零依赖，~30 行，推荐）/ WAAClock（轻封装）/ Tone.js（功能全但 ~0.5MB，且自带一套封装，与你现有「裸 Web Audio」风格冲突）。**给你项目：手写，零新依赖**（`package.json` 不变）。

### 10.4 可运行代码：`MusicEngine`（接进 SoundManager，零依赖）

下面是一个最小可玩的 darkpsy 循环引擎，**复用** `SoundManager` 的 `ctx` / `masterGain` / `_createReverbNode`。新建 `src/music_engine.js`：

```js
/**
 * music_engine.js - 暗黑炼金 Psytrance 实时音乐引擎（纯合成，零采样，零依赖）
 * 复用 SoundManager 的 AudioContext / masterGain / 合成混响。
 */
class MusicEngine {
  constructor(soundManager) {
    this.ctx = soundManager.ctx;          // 复用同一个 AudioContext
    this.out = soundManager.masterGain;   // 复用 master → compressor → 扬声器

    // 三条乐器总线
    this.drumBus = this.ctx.createGain();
    this.bassBus = this.ctx.createGain();
    this.leadBus = this.ctx.createGain();
    this.drumBus.connect(this.out);
    this.bassBus.connect(this.out);

    // lead 走一条合成混响（复用 audio.js 的 IR 技术，零采样文件）
    this.reverb = soundManager._createReverbNode(0.7, 2.0);
    const wet = this.ctx.createGain(); wet.gain.value = 0.3;
    this.leadBus.connect(this.out);                       // 干
    this.leadBus.connect(wet); wet.connect(this.reverb);  // 湿
    this.reverb.connect(this.out);

    this.bpm = 148;        // darkpsy 区间（145–160）
    this.rootFreq = 55;    // A1
    this.intensity = 0.4;  // 自适应强度 0~1
    this._step = 0;
    this._nextStepTime = 0;
    this._timer = null;
    this.leadBus.gain.value = this.intensity;
  }

  // ── 合成 Kick：sine + 下扫频率包络 + 快速增益包络 + click ──
  playKick(t) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(this.drumBus);
    o.start(t); o.stop(t + 0.2);
    // 1.2kHz click 增加敲击瞬态
    const ck = c.createOscillator(), cg = c.createGain();
    ck.type = 'square'; ck.frequency.setValueAtTime(1200, t);
    cg.gain.setValueAtTime(0.3, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    ck.connect(cg); cg.connect(this.drumBus);
    ck.start(t); ck.stop(t + 0.03);
  }

  // ── 滚动 Bass：单锯齿 → 谐振低通 + 滤波包络 + A/R≈0 短包络（Psy 标志）──
  playBass(t, freq) {
    const c = this.ctx;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass'; f.Q.value = 8;
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.002);   // A≈2ms
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); // D≈140ms，无 sustain
    o.connect(f); f.connect(g); g.connect(this.bassBus);
    o.start(t); o.stop(t + 0.16);
  }

  // ── sidechain 泵感：kick 时刻把 bass 压低再回升 ──
  duck(t) {
    const p = this.bassBus.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.2, t);
    p.linearRampToValueAtTime(1.0, t + 0.12);
  }

  // ── FM 嘶吼 lead：非整数调制比 → 不谐和金属感 ──
  playScreech(t, carrierFreq, dur = 0.4) {
    const c = this.ctx;
    const carrier = c.createOscillator(), mod = c.createOscillator();
    const modGain = c.createGain(), g = c.createGain();
    carrier.type = 'sine'; carrier.frequency.value = carrierFreq;
    mod.type = 'sine'; mod.frequency.value = carrierFreq * 2.5; // 非整数比
    modGain.gain.setValueAtTime(carrierFreq * 4, t);            // 高调制指数
    modGain.gain.exponentialRampToValueAtTime(carrierFreq * 0.5, t + dur);
    mod.connect(modGain); modGain.connect(carrier.frequency);   // FM
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    carrier.connect(g); g.connect(this.leadBus);
    carrier.start(t); carrier.stop(t + dur + 0.05);
    mod.start(t); mod.stop(t + dur + 0.05);
  }

  // ── lookahead 调度器（A Tale of Two Clocks）──
  _scheduler() {
    const ahead = 0.1;                    // 提前 100ms 排程
    const stepDur = 60 / this.bpm / 4;    // 16 分音符
    while (this._nextStepTime < this.ctx.currentTime + ahead) {
      this._scheduleStep(this._step, this._nextStepTime);
      this._nextStepTime += stepDur;
      this._step = (this._step + 1) % 16;
    }
    this._timer = setTimeout(() => this._scheduler(), 25); // 不精确时钟只负责唤醒
  }

  _scheduleStep(s, t) {
    if (s % 4 === 0) { this.playKick(t); this.duck(t); }      // 每拍 kick
    if (s % 4 !== 0) { this.playBass(t, this.rootFreq); }     // off-beat 滚动 bass
    if (this.intensity > 0.6 && s === 14) {                   // 高强度才加 FM lead
      this.playScreech(t, this.rootFreq * 8, 0.4);
    }
  }

  start() {
    if (this.ctx.state === 'suspended') this.ctx.resume(); // 移动端需用户手势后
    this._step = 0;
    this._nextStepTime = this.ctx.currentTime + 0.05;
    this._scheduler();
  }
  stop() { clearTimeout(this._timer); this._timer = null; }

  // 自适应：垂直叠层（强度低=只有 kick+bass；高=加 lead 层、更亮）
  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
    this.leadBus.gain.setTargetAtTime(this.intensity, this.ctx.currentTime, 0.5);
  }
}
// 暴露给非模块脚本（与 audio.js 同风格）
if (typeof window !== 'undefined') window.MusicEngine = MusicEngine;
```

接线（在已有 `SoundManager` 实例化之后，例如 core.js）：

```js
const music = new MusicEngine(window.sound /* 你的 SoundManager 实例 */);
// 首次用户交互里启动（满足浏览器自动播放策略）
canvas.addEventListener('pointerdown', () => music.start(), { once: true });
```

### 10.5 自适应：用现有 `src/event_bus.js` 驱动

你仓库已有 `event_bus.js`。订阅游戏事件改音乐参数，即得「随玩法变化」的自适应 BGM：

```js
eventBus.on('combat:start', () => music.setIntensity(1.0)); // 进战斗：加 FM lead 层
eventBus.on('combat:end',   () => music.setIntensity(0.3)); // 出战斗：回到 kick+bass
eventBus.on('boss:phase2',  () => { music.bpm = 156; });    // Boss 二阶段：提速
eventBus.on('player:lowHP', () => { music.rootFreq = 49;  });// 残血：降调更暗
```

这就是教科书里的**垂直叠层（vertical layering）+ 参数驱动音色（RTPC 思路）**，在纯 Web Audio 里用几行就实现，无需任何中间件。

### 10.6 进阶：想先在桌面合成器调好音色再「原样」搬进浏览器

如果手写 DSP 不够用、想用 Vital/Surge/VCV/Max/Pd 设计更复杂的暗黑音色，再「同一套 DSP、仍然零采样」地搬进浏览器，有三条成熟通道，产物都是 `AudioWorkletNode`，能直接接到上面的 `masterGain`：

- **faustwasm**：Faust DSP → WASM → AudioWorkletProcessor。
- **RNBO（Max）web export**：Max 搭 patch → 云编译 WASM → AudioWorkletNode。
- **WebPd**：Pure Data patch → JS/wasm 跑在浏览器。

代价：引入构建步骤 + WASM 体积，与你「零依赖 vanilla JS」的现状相反。**建议：先用 §10.4 的手写方案，确实不够再上 AudioWorklet 或这三条通道。**

### 10.7 给本项目的明确建议

1. **新增 `src/music_engine.js`**（上面整段），构造时接收现有 `SoundManager`，复用其 `ctx` / `masterGain` / `compressor` / `_createReverbNode`。**零新依赖，`package.json` 不变。**
2. 手写 lookahead scheduler 驱动 **kick + off-beat 滚动 bass + sidechain 泵感 + 强度门控 FM lead** = 最小可玩 darkpsy 循环（148 BPM）。
3. 用 `event_bus.js` 做战斗/Boss 自适应（垂直叠层）。
4. **可以删掉 `Audio_sample/`**（Stickz Rise / KSHMR kick）——音乐与音效全纯合成；线上零音频文件。
5. **风险/待测**：① 移动端首帧需用户手势 `ctx.resume()`（已在 `start()` 里处理，但要确保由交互触发）；② 同时几十个振荡器在低端机的 CPU，要实测（必要时复用/限制 voice 数）；③ AudioWorklet 颗粒/Karplus-Strong 物理建模属后续增量。

> **下一步我可以直接帮你把 `src/music_engine.js` 写进项目并跑通一个暗黑 psy 循环**——确认后我就动手（会先确认，不擅自改你代码）。

### 10.8 本节新增参考来源（Web Audio / 实时调度 / 离线→浏览器）

- [A Tale of Two Clocks – Scheduling Web Audio with Precision (Chris Wilson) – web.dev](https://web.dev/articles/audio-scheduling)
- [Web Audio API – MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioParam（automation: setValueAtTime / linearRampToValueAtTime / exponentialRampToValueAtTime / setTargetAtTime）– MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam)
- [BiquadFilterNode – MDN](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode)
- [AudioWorkletNode – MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode)
- [Tone.js（Transport / Sequence / 内置合成器）](https://tonejs.github.io/)
- [WAAClock – 轻量 Web Audio 调度库](https://github.com/sebpiq/WAAClock)
- [faustwasm – Faust → WASM/AudioWorklet – GitHub / grame-cncm](https://github.com/grame-cncm/faustwasm)
- [RNBO（Max → web/WASM export）– Cycling '74](https://rnbo.cycling74.com/)
- [WebPd – Pure Data → JS/wasm – GitHub / sebpiq](https://github.com/sebpiq/WebPd)

