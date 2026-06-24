# Boss 音乐风味设计 · Echo Alchemist V2

> 目标：把 8 个 Boss 各自的「主题 / 机制 / 词缀 / 破绽 / 元素」提炼成**独有音乐风味**，再映射到当前「暗黑炼金 psytrance」风格里——既各有辨识度，又不破坏整段统一感。
>
> 用法：每个 Boss 给一段可直接粘贴进 Suno 的 **Style 风格串**（常态 + 狂暴两版）。你在 Suno 生成后，我再从成品里**提炼特征**回填到引擎的 per-boss profile，并在 demo 加 8-Boss 试听切换。
>
> 数据来源：`src/config.js > bossConfigs`（身份/词缀/破绽/themeWeights）、`src/core.js`（BPM/事件接线）、`src/music_engine.js`（可调旋钮）。

---

## 0. Suno 提示词写法（2026 / v5.5 要点）

- **顺序**：流派 → Boss 主题名 → 意境/画面 →（人声）。流派是「承重标签」，必须放最前。
- **意境优先（本设计原则）**：**不堆具体乐器/制作手法**（acid lead、distorted bass、ping-pong delay、16th hats 之类），改给**场景与情绪意象**，把音色与编排的自由度留给 Suno；成品出来后我再从中提炼特征回引擎。
- **不写 BPM**：速度交给 Suno 自由发挥——流派标签本身已隐含速度带（Darkpsy 150–160 / Forest psy 148–154 / Hi-tech psy 155–160），不会跑偏。引擎侧的 Boss 目标速度见 §2 表，由代码 `glideBpm` 控制，与 Suno 成品**解耦**。
- **两个硬锚**：流派（决定风格家族）+ Boss 主题名（给 Suno 叙事锚点、也便于区分曲目）。其余全是意境画面。
- **数量**：意象短语 4–6 段最稳；太长后面会被忽略。
- **纯器乐**：把 `instrumental, no vocals` 放在**最末尾**，否则容易混入人声。
- **情绪词也要具体**：`oppressive / looming / relentless / chaotic / hypnotic`，避免空泛的 "energetic"。

---

## 1. 统一底色（8 个 Boss 共享，先定调再做差异）

- **大流派**：dark alchemy psytrance（darkpsy / forest psy / hi-tech 三个子味按 Boss 切换）。
- **骨架**：四踩底鼓 + 滚动 16 分 offbeat bass + 侧链泵感呼吸；强度靠「层数 × 音符密度」叠加，不靠音量。
- **音色板**：失真咆哮 bass（sub/mid 分离）、FM 金属嘶吼 lead、失谐锯齿 drone、噪声 hat/沙锤、"ooh" 人声铺垫层。
- **空间**：低切混响（不糊低端）+ 八分乒乓延迟。
- **差异化只动**：子味、BPM 微调、调式/根音、节奏密度、lead 动机、drone 音程、FX 强调、1 个签名行为。**不换骨架**。

---

## 2. 一页速查表

| Boss | 元素(themeWeights) | 子味 | 常态/狂暴 BPM | 调式色 | 签名元素 |
|---|---|---|---|---|---|
| 熔炉守卫·伊格尼斯 ignis | pyro / pierce | Darkpsy·灼热 | 152 / 158 | A 弗里几亚属(燥) | 温压渐强 build → 喷发 |
| 霜晶缝合怪·格拉西斯 glacies | cryo / pierce | Forest psy·冰晶 | 146 / 152 | A 自然小调(高音玻璃) | 脆玻璃铃 + 冰窟混响 |
| 裂变母体·米克罗 mikro | lightning / scatter | Darkpsy·裂变 | 156 / 160 | A 小调(密集) | 回声分身 stutter |
| 贪婪之渊·噬神者 devourer | bounce / laser | Dark psy·深渊 | 144 / 150 | E 低根(超低 sub) | 下行 sub 俯冲 + 引力拉拽 |
| 翠绿共生体·维里迪斯 viridis | pyro / venom | Forest psy·共生 | 150 / 156 | A 多利亚(有机) | 缓慢绽放/形变铺层 |
| 雷霆幻影·特斯拉 tesla | cryo / bounce | Hi-tech psy·高压 | 158 / 162 | A 小调(高速琶音) | 急速琶音 + 门限闪烁 |
| 混沌融合体·奇美拉 chimera | venom / laser | Darkpsy·混沌 | 156 / 160 | A + #4/b5(三全音) | 失稳音高漂移 + 爆发 |
| 永恒回声·奥罗波罗斯 ouroboros | pierce/cryo/lightning | Dark psy·轮回 | 154 / 160 | 轮转移调 | 动机每句移调 + 长回声交接 |

> 备注：大 Boss（viridis / tesla / chimera / ouroboros，`isBigBoss:true`）的曲子可做更长的 build 与更厚的层；mini-boss（ignis / glacies / mikro / devourer）更短促直接。

---

## 3. 分 Boss 设计

### 3.1 熔炉守卫·伊格尼斯 ignis（pyro / pierce，mini）

**机制速览**：护盾 + 流光彩护盾(radiantAegis) + 温压过热(furnacePressure)，狂暴后火焰溅射、每回合升温。破绽=破甲熔炉(pierce/pyro 命中 3 次)。

**提炼风味**：一座持续蓄压的熔炉——金属、灼热、压迫，热到临界就喷发。音乐核心是「不断积累的张力」。

**音乐映射**：Darkpsy 灼热味，152 BPM。A 弗里几亚属(b2、燥辣) 制造灼烧感。bass 失真驱动拉到最猛(咆哮)；lead 用明亮 acid 长啸 stab；加金属敲击点缀。**签名**：每 8 小节一段「温压」上升 sweep（对应 furnacePressure 阈值），狂暴时变成持续升温 + 喷发冲击。

**Suno 风格串**

```
常态: Dark psytrance, boss battle theme for Ignis the Furnace Guardian, the inside of a sealed furnace heating toward eruption, oppressive molten pressure with nowhere to escape, searing and relentless, instrumental, no vocals
狂暴: Dark psytrance, enraged boss theme for Ignis the Furnace Guardian, the furnace bursting wide open, white-hot eruption with no restraint, overwhelming and explosive, instrumental, no vocals
```

**引擎落点（已从 Suno 成品「熔炉之门」提炼，5 分轨 MIDI）**

> 提炼证据：时长 ~180s；中位 **146 BPM**（区间 143–150，Suno 人性化抖动）；root = **E**（bass E 占 187/211）；synth 音级(相对 E)= 1 / b2 / b5 / 5 / b7 为主。

- **bpm**：`setBpm(146)`（原设计 152 偏快，以成品为准）。
- **根音/调式**：root **E**，`setRootFreq(41.2)`（E1）。调式 = **E 弗里几亚 + 突出 b5(A#) 三全音**张力音（成品 b2、b5 都很重，正是「燥辣/灼热」来源）。
- **bass**：成品是**低 E 压力持续音（pedal/drone）**——约八分重触、几乎单音（E 为主、偶 F=b2），**不是**滚动 16 分。→ ignis profile 把 bass 密度阶梯压低、改 pedal 型 pattern（如 `[0,null,0,0, 0,null,0,1, 0,null,0,0, 0,null,1,0]`），`bassDrive` 仍拉高保留咆哮压迫感。
- **鼓**：干净**四踩 kick**（每拍正中）+ 轻 hat / shaker(GM maracas 层) + 偶发 tom；与引擎现有 kick/hat 阶梯一致，shaker 层可加重。
- **lead/synth**：八分驱动的**模态张力线**，中音区(E3 中心)，密度最高(~2.9 音/秒)。动机走 E 弗里几亚 + 三全音 → `_leadNotes` 设 `[0,1,6,7]`（root / b2 / b5 / 5）。
- **FX/签名**：E 同音 FX 铺垫在拍点脉动 + 宏观「持续升温 → 喷发」结构 → 8 小节末 `riser`/温压 sweep，狂暴用 `impact` 做喷发冲击。
- **常态 / 狂暴（分段实测）**：常态段 synth 稀疏(~1.06 音/秒、deg 1/b2/b7)、bass 八分 pedal、干净四踩；狂暴段 synth 翻到 ~2.83 音/秒并**点亮 b5 三全音**(deg 1/5/b5/b3、移到 A#3 高八度) + 加 shaker(n70) 层 → 引擎用 `setIntensity` 拉满 + 解锁 `_leadNotes` 的 b5 音 + `playShaker` 加重，表达「升温 → 喷发」。
- **撞味提醒**：三全音(b5)其实是 ignis 成品**自带**的签名色；原设计把三全音分给了 chimera，后续做 chimera 时改用别的失稳手段（detune / 音高漂移）以免两者撞味。

**深挖 v2（逐分轨 MIDI 实测 · 2026-06-25 · 见索引 M-01）**

> 上一轮只取中位 BPM + 音级直方图；这一轮把 5 条分轨逐条按 16 分栅格解析，挖出**真实节奏骨架**，专治「太单调」。
> 完整性：5 分轨全过校验（0 截断，div=480，format-1）。全局：143–150 BPM、中位 146、root E、约 180s。

关键发现（颠覆上一轮的「四踩 kick + acid lead」近似）：

1. **鼓是 tom 驱动，不是 kick 驱动**。Drums 轨主体 = HiTom2(50):192 / LoTom(41):113 / Maraca(70):58；LoTom 正落每拍正中（栅格 `█   █   █   █`），是真正的「炉腔」四踩——引擎原来却给的是干净 kick，完全没还原。
2. **旋律是「倒挂弧」**。常态 synth 极密（412 音，E 弗里几亚 1/b2/5/b5/b7 织成张力线），狂暴 synth 反而**坍缩回根**（88 音、几乎只剩 deg 1）。喷发不是靠「加旋律」，而是旋律退场、把能量交给节奏。
3. **FX 是定根「温压」脉冲**。FX 轨死锁 E、力度满，密度随段从 0.35 → 1.19 音/秒线性加密——这是「持续升温」的真正声学载体。
4. **木鱼 accent**。狂暴段出现 HiWdblk 短击点缀。

→ 引擎丰富落点 v2（已落 `dark_psy_engine_demo.html`，大胆改动）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `playFurnaceTom` | 新增声部 | 炉腔低 tom 四踩（sine 135→62Hz + 三角腔体泛音 + 噪声皮膜）；`drumMode:'tribalTom'` 时**取代 kick** |
| `playHeat` | 新增声部 | 定根 E「温压」金属脉冲（正弦芯 + 窄带噪声「叮」，走 fxBus 进混响）；`heatPulse:true` |
| `playModal` | 新增声部 | 中音区模态张力线（失谐双锯+方波芯 → 谐振带通 → drive → leadBus）；按 `modalLine` 度数序列走 |
| `playWood` | 新增声部 | 木鱼 accent；狂暴 `sig.woodAccent` 触发 |
| `modalLine` 段落编排 | 新增句法 | 常态=反拍 8 分密集 Phrygian `[0,1,7,6,10,…]`；狂暴=坍缩回根 `[0,0,1,0,…]` 且更稀（**倒挂弧**落地） |
| `heatPulse` 密度 | 新增句法 | 常态拍头疏(s%8)、狂暴每八分(s%2) → 还原「升温」线性加密 |
| `allowLead:false` | 调参 | 关掉原 acid 长啸——ignis 的喷发是节奏化的，acid lead 反而冲淡辨识度 |
| `_applyIntensity` 加 `needLead` 地板 | 调参(全局收益) | 模态/签名层在低强度也保底可闻，threat 拖动时不被压没（所有签名 Boss 受益） |

**辨识度**：ignis 现在是全 8 Boss 里**唯一以 tom 四踩取代 kick**者，节奏骨架自带签名，不再与其它 boss 共用一套四踩。验证：node 烟测确认 calm `kick=0 / furnace=8 / modal=16 / heat=4`，rage `kick=0 / furnace=16 / modal=8 / heat=16 / wood=4 / tom=4`，与「倒挂弧 + 节奏化喷发」设计一致。

---

### 3.2 霜晶缝合怪·格拉西斯 glacies（cryo / pierce，mini）

**机制速览**：跳跃(jump) + 再生(regen 12%) + 霜缝(把周围敌人缝合、减伤、回血)。破绽=冻结裂隙(cryo/pierce 累计伤害 10%)。

**提炼风味**：冰冷、晶体、脆——把敌人「缝」在一起的诡异手术感，缓慢而黏。

**音乐映射**：Forest psy 冰晶味，146 BPM（最慢之一，配缓慢移动/再生）。A 自然小调，主旋律放**高音区**做玻璃铃/钟琴质感；bass 密度稀疏（留空、催眠）；**长冰窟混响**拉大空间。**签名**：脆玻璃高频 shimmer + 偶发「缝合」式短滑音把两个音连起来。狂暴时高频更密、再生感的回声更紧。

**Suno 风格串**

```
常态: Forest psytrance, boss battle theme for Glacies the Frost Stitcher, a frozen crystalline cavern deep in the cold, brittle and glassy, an eerie slow ritual, hypnotic and creeping, instrumental, no vocals
狂暴: Forest psytrance, enraged boss theme for Glacies the Frost Stitcher, the frozen cavern cracking apart, sharper and more brittle, the cold closing in faster, instrumental, no vocals
```

**引擎落点（已从 Suno 成品「冰骨」提炼，分轨 MIDI）**

> 提炼证据：时长 ~212s；中位 **145 BPM**（区间 143–152）；root = **D#/Eb**；常态 synth 含 **大三度(3)** → 明亮玻璃铃音色，**不是**设计预想的 A 自然小调。

- **bpm**：`glideBpm(145)`（设计 146，基本吻合）。
- **根音/调式**：root **D#/Eb**，`setRootFreq(38.9)`（D#1/Eb1，bass 压在最低八度）。调式偏 **D# + 大三度** 的明亮晶体色（deg 1 / 5 / 3）——保留这份「亮脆」反而更像玻璃/冰晶，比阴小调更对味。
- **bass**：**极低 D# pedal**（reg D#1、~1.23 音/秒、几乎单音 deg 1:147）→ 稀疏催眠 pedal 型，密度阶梯压低、多留空。
- **鼓**：常态干净**四踩 kick**；狂暴转 8 分更密。
- **lead/synth**：常态高音区(reg D#4)缓慢明亮、玻璃铃/钟琴质感（deg 1/5/3）→ `_leadNotes` 抬高八度 + 走大三度；reverb wet / 尾长拉大做冰窟空间。
- **常态 / 狂暴（分段实测）**：**狂暴段加入 backing 人声层**——落在 **b2(E，相对 D#)**、reg E4、极短 ~0.19 拍 = 诡异「缝合」式短切音；鼓转更密 8 分。→ 引擎狂暴用一条 b2 短促 stab/vox 层（可借 `playOoh` 高八度短包络）+ intensity 上移，表达「缝合收紧」。

---

### 3.3 裂变母体·米克罗 mikro（lightning / scatter，mini）

**机制速览**：分身(clone，每个存活分身给减伤) + 治疗者(healer)。破绽=群体断链(lightning/scatter 命中 5 次)。

**提炼风味**：不断自我复制的电气母体——一个变两个、两个变四个，散射、glitch、群集。

**音乐映射**：Darkpsy 裂变味，156 BPM。A 小调，密集 16 分。核心手法用**重反馈乒乓延迟**把每个 stab「复制」成一串回声（= 分身），加散射电 zap、忙碌 16 分 hat。**签名**：stutter / 颗粒重复（一个音被切成快速重复 = 分裂）。狂暴(分身 100%)时延迟反馈拉满、密度翻倍。

**Suno 风格串**

```
常态: Darkpsy, boss battle theme for Mikro the Fission Mother, an organism endlessly splitting and multiplying, a glitching electric swarm spreading out of control, restless and replicating, instrumental, no vocals
狂暴: Darkpsy, enraged boss theme for Mikro the Fission Mother, the swarm multiplying beyond all control, total electric chaos, overwhelming and frantic, instrumental, no vocals
```

**引擎落点（已从 Suno 成品「微裂母体」提炼，7 分轨 MIDI）**

> 提炼证据：时长 ~197s；中位 **173 BPM**（区间 165–175，**全场最快**，远高于设计 156）；root = **F**（带 maj7=E 的色彩音）。

- **bpm**：`glideBpm(173)`（设计 156 偏慢，以成品为准——mikro 就是要快、要躁）。
- **根音/调式**：root **F**，`setRootFreq(43.65)`（F1）。F 小调氛围 + **maj7(E)** 当紧张色彩音。
- **bass**：常态**反拍 16 分**(reg F3、deg 1:226/7:59/b7:20、pattern 头 `[40,16,23,3,…]` 反拍重)；狂暴转**平直 8 分**(`[38,0,36,1,38,1,36,0,…]`、~3 音/秒) → 引擎常态用错位 16 分阶梯、狂暴切平 8 分锁根。
- **鼓**：常态 n27 kick 四踩；狂暴加 n36 kick + n46 open-hat 更满。
- **lead/synth**：忙碌高音 pluck(reg F5、~3.23 音/秒) → stab 频次高、`delaySend` + 重反馈把单 stab 复制成回声串(= 分身)。
- **常态 / 狂暴（分段实测）**：**狂暴签名 = 机关枪式人声碎切**——VOX 247 个音全砸在 **b5 三全音(B，相对 F)**、每个 ~0.04 拍、约 63 音/秒 = stutter/颗粒切片群集（正是「分身/散射」听感）。→ 引擎狂暴解锁一条三全音上的超高频 stutter 层（短包络 + 重 ping-pong delay），密度阶梯整体拉满。

---

### 3.4 贪婪之渊·噬神者 devourer（bounce / laser，mini）

**机制速览**：吞噬(devour，吞敌取其血量/词条) + 护盾，召唤奴隶、范围拉拽。破绽=深渊开口(bounce/laser 累计伤害 8%)。

**提炼风味**：一张无底的嘴——引力、下坠、贪婪、压顶的低频深渊。

**音乐映射**：Dark psy 深渊味，144 BPM（全场最慢、最重）。根音下移到 **E1 区**强调**巨型 sub**；drone 阴森、空腔感；节奏疏但每一下都重。**签名**：下行 sub 俯冲 + 偶发向下滑音（= 吞噬/拉拽的引力）。狂暴(全屏吞噬)时低频更压、滑音更频。

**Suno 风格串**

```
常态: Dark psytrance, boss battle theme for the Devourer of the Greedy Abyss, a bottomless abyss dragging everything downward, immense gravity and dread, slow, crushing and cavernous, instrumental, no vocals
狂暴: Dark psytrance, enraged boss theme for the Devourer of the Greedy Abyss, the abyss swallowing everything whole, crushing weight and suffocating depth, inescapable, instrumental, no vocals
```

**引擎落点（已从 Suno 成品「贪渊吞王」提炼，分轨 MIDI）**

> 提炼证据：时长 ~243s；中位 **141 BPM**（区间 134–144，**全场最慢最重**）；root = **D#/Eb**（与 glacies 同根，但走法完全不同）。

- **bpm**：`glideBpm(141)`（设计 144，基本吻合——就是要慢要沉）。
- **根音/调式**：root **D#/Eb**，`setRootFreq(38.9)`（D#1/Eb1，巨型 sub）。
- **bass**：常态**低 D# pedal**(reg D#3、~2.58 音/秒)；狂暴**彻底爆发** → 1098 个音、~8.44 音/秒、medDur 0.11、**掉到最低八度(Eb1)**，pattern `[102,87,80,13, 98,72,78,10, 100,70,94,18, 100,82,86,8]` = 近乎连续的 16 分滚动 sub 雪崩、死锁根音。→ 引擎常态 pedal 留空、狂暴把 bass 密度阶梯拉满成滚动 16 分 sub + `setRootFreq` 下沉 + `_pumpDepth` 加深。
- **鼓**：自始至终**极疏**(常态 ~0.51 音/秒，狂暴几乎不加鼓)——压迫感全靠 bass 与空腔，不靠鼓点。
- **lead/synth**：纯五度(A#)高音区(reg A#5)颤音铺底(medDur 0.12) → drone/tremolo 型 + 空腔混响。
- **常态 / 狂暴（分段实测）**：常态「深渊静默」靠稀疏 + 巨 sub pedal；狂暴不加鼓不加旋律，而是**低频 16 分 sub 雪崩**吞掉一切(8.44 音/秒、锁 Eb1) → 引擎狂暴只动 bass 密度与 sub 权重，鼓/lead 基本不动，制造「被低频吞没」的窒息感。

---

### 3.5 翠绿共生体·维里迪斯 viridis（pyro / venom，大 Boss）

**机制速览**：再生 + 治疗 + 活体护甲(livingArmor) + 孢甲(armorSpore，给随从套甲/反噬毒)。破绽=孢甲净化(pyro/venom 累计伤害 12%)。

**提炼风味**：活着的、会生长会腐坏的有机体——孢子、藤蔓、毒液，缓慢呼吸般膨胀收缩。

**音乐映射**：Forest psy 共生味，150 BPM。A 多利亚(略亮、有机)。大量**缓慢调制**：呼吸般的 filter LFO、形变 squelch acid、厚 "ooh" 人声云铺层（活体合唱）。venom = 轻微失谐摇摆(wobble)。大 Boss 做更长的 build。**签名**：层层缓慢绽放/枯萎的铺垫。狂暴(集中自愈)时铺层更密、毒味摇摆更明显。

**Suno 风格串**

```
常态: Forest psytrance, boss battle theme for Viridis the Verdant Symbiote, a living organism breathing as it grows and rots, toxic spores and creeping vines, organic and venomous, slowly blooming, instrumental, no vocals
狂暴: Forest psytrance, enraged boss theme for Viridis the Verdant Symbiote, the organism overgrowing and turning toxic, writhing and feverish, denser and more poisonous, instrumental, no vocals
```

**引擎落点（已从 Suno 成品「Viridis 之茧」提炼，5 分轨 MIDI）**

> 提炼证据：时长 ~210s；中位 **147 BPM**（区间 144–149）；root = **F**（bass 几乎纯 F 长音 612/632）；synth 全程**只走大六度(6=D)** → 悬浮有机的「茧」色。

- **bpm**：`glideBpm(147)`（设计 150，基本吻合）。
- **根音/调式**：root **F**，`setRootFreq(43.65)`（F1，bass 压在最低八度做 drone）。色彩 = **F + 大六度(D) 悬浮**——不是常规小调，而是一层挂在六度上的 pad，对应「共生/孕育」。
- **bass**：**极低 F drone/pedal**(reg **F1**、~1.53 音/秒、deg 1:310 近乎纯根)，16 分铺底但锁单音 → 引擎 bass 走低 drone + 轻 wobble、密度阶梯中低。
- **鼓**：**n82 shaker/maracas 主导(288)** + kick 四踩(`[69,2,10,2,64,2,14,5,…]`)——沙锤律动是底色，不是重 kick。→ `playShaker` 层权重拉高。
- **lead/synth**：**全程大六度悬浮 pad**(deg 6:322、reg D2、medDur 0.50 拍) → `playOoh`/pad 铺一层挂六度的长音；drone/filter 慢 LFO 形变。
- **常态 / 狂暴（分段实测）**：viridis **不靠模式突变**——常态↔狂暴都是 F drone + 六度 pad + 沙锤；狂暴只是 bass 从锁拍转更均匀滚动 16 分、鼓填得更满(密度上移)。→ 引擎狂暴只推 intensity / 密度阶梯与 build 时长，保持催眠有机感，不换调式不换音色（「活体缓慢扩张」）。
- **撞味提醒**：root F 与 mikro、tesla 同；viridis 靠**大六度 drone**(147 BPM) 区分，mikro 靠 maj7 + 三全音人声(173)、tesla 靠 b6 小调 + 16 分驱动(150)，三者调色/速度/织体都不同，不撞。

---

### 3.6 雷霆幻影·特斯拉 tesla（cryo / bounce，大 Boss）

**机制速览**：急速(haste，共 3 次行动) + 分身，电场(teslaField)、导体随从、放电。破绽=导体接地(cryo/bounce 命中 4 次)。

**提炼风味**：高压、相位、幻影——快到残影，电弧噼啪，密集放电的压迫节奏。

**音乐映射**：Hi-tech psy 高压味，**158 BPM（全场最快）**。A 小调，主奏用**急速琶音/分解**（对应 3 次行动的连击感）；明亮电气 zap lead；**门限/gate 闪烁**做相位幻影。**签名**：快速琶音 + stutter 门限闪。狂暴(再 +1 行动)时琶音更急、闪烁更频，逼近 162。

**Suno 风格串**

```
常态: Hi-tech psytrance, boss battle theme for Tesla the Thunder Phantom, a high-voltage phantom moving faster than its own afterimage, the air crackling with electric discharge, frantic and relentless, instrumental, no vocals
狂暴: Hi-tech psytrance, enraged boss theme for Tesla the Thunder Phantom, overcharged beyond control, a blinding relentless electric storm, frantic and unstoppable, instrumental, no vocals
```

**引擎落点（已从 Suno 成品「特斯拉雷影」提炼，5 分轨 MIDI）**

> 提炼证据：时长 ~177s；中位 **150 BPM**（区间 148–153，设计 158 偏快）；root = **F**（F 自然小调，突出 **b6(C#)** 与 4）。

- **bpm**：`glideBpm(150)`。
- **根音/调式**：root **F**，`setRootFreq(43.65)`（F1）。**F 自然小调 + 重 b6(C#)**（deg 1/b6/4）——比预想更「阴」，b6 给雷雨压抑感。
- **bass**：常态八分律动(reg F3、~1.80 音/秒、deg 1/b6/4、`[40,8,14,8,24,6,35,3,…]` 带反拍)；狂暴**转近乎连续 16 分驱动**(~2.66 音/秒、deg 1:200 锁根、`[29,19,13,17,16,19,14,17,…]` 每格都满) → 引擎狂暴把 bass 密度阶梯拉满成滚动 16 分。
- **鼓**：hat 主导——常态 **n44 踏镲 78 次**最重 + n38 军鼓 + 四踩 kick；狂暴加 **n45 tom 40 + n50** 并打碎成反拍 → 「连击/电闪」感来自 hat 密 + tom 滚。
- **lead/synth**：常态稀疏(0.87/s，deg 1/5/4)；狂暴密度翻倍并加 **b5 三全音 + 7 + 2** 张力(1.76/s) → 引擎 lead 走高频琶音连击、狂暴解锁 b5/7。
- **常态 / 狂暴（分段实测）**：常态稳态八分 groove；狂暴 = bass 16 分驱动满格 + 鼓加 tom 反拍 + synth 上三全音/7 度 + perc 爆发(3.82/s) → 引擎用 intensity 拉满 + bass 阶梯满格 + 解锁 tom/perc 层表达「电压击穿」。

---

### 3.7 混沌融合体·奇美拉 chimera（venom / laser，大 Boss）

**机制速览**：狂暴(berserk，初始温度 60=半狂暴) + 吞噬，热量叠层、受击触发全场爆炸、热吸收成盾。破绽=污染胃域(venom/laser 累计伤害 9%)。

**提炼风味**：不稳定的混沌拼接体——音高发飘、组织错位、随时炸开的狂暴脉冲。

**音乐映射**：Darkpsy 混沌味，156 BPM。A 叠 **#4/b5 三全音**制造不安定张力。lead 故意**失稳音高漂移**(detune/pitch drift)；不和谐的融合织体；突发爆裂 accent。**签名**：音高失稳 + 不定时爆发冲击(对应受击全场爆炸)。狂暴(温度满)时爆发更密、失真更脏。

**Suno 风格串**

```
常态: Darkpsy, boss battle theme for Chimera the Chaos Fusion, an unstable patchwork creature on the verge of coming apart, dissonant and drifting, erupting in sudden violent bursts, chaotic and aggressive, instrumental, no vocals
狂暴: Darkpsy, enraged boss theme for Chimera the Chaos Fusion, the patchwork creature gone fully berserk, violent and filthy, exploding without warning, instrumental, no vocals
```

**引擎落点（已从 Suno 成品「混沌奇美拉」提炼，5 分轨 MIDI）**

> 提炼证据：时长 ~100s（最短）；中位 **188 BPM**（区间 185–191，**全场最快**，远超设计 156）；root = **E**，但 **D#(7/maj7) 几乎与根同强**(E:239 / D#:161) → 内建「双根打架」的混沌。

- **bpm**：`glideBpm(188)`（设计 156 太慢，chimera 就是要最快最躁）。
- **根音/调式**：root **E**，`setRootFreq(41.2)`（E1）。**E 与 D#(maj7) 半音互搏**——常态 bass deg 1:189 / **7:66**；狂暴 **7:95 反超 1:50、reg 掉到 D#2**，即根被自己的导音夺走 = 失稳/混沌；synth 另带 **b5 三全音**。
- **bass**：常态驱动八分/反拍(reg E3、~2.82 音/秒、`[44,0,22,0,32,0,36,1,…]`)；狂暴维持驱动但根音在 E↔D# 间漂移 → 引擎用 chimera 专属失稳手段 = **E/D# 半音漂移**（非 ignis 的三全音），即 `_rootCycle` 掺入 maj7、或 bass 周期性下滑半音。
- **鼓**：n50 主导(92) + n33，偏 tom/conga 而非四踩 → 异色打击。
- **lead/synth**：稀疏长音(常态 0.64/s、medDur 1.5 拍)带 **b5 三全音 + 6**；狂暴加 b3 → 引擎 lead 慢音 + 三全音 + 缓慢 detune 漂移叠加根音失稳。
- **常态 / 狂暴（分段实测）**：常态 E 为根、D# 作色；狂暴 **D# 反客为主压过 E**（导音夺权）= 听感「身份崩塌」。→ 引擎狂暴把根音漂移幅度/频率拉大 + `impact` 不定时穿插 + synth 上三全音，制造混沌融合。
- **撞味提醒**：root E 与 ignis 同；但 chimera 靠 **E↔D# 半音失稳**（188 BPM），ignis 靠 **E 弗里几亚 b2/b5**（146 BPM），机制与速度都不同，不撞。

---

### 3.8 永恒回声·奥罗波罗斯 ouroboros（pierce/cryo/lightning，大 Boss·终）

**机制速览**：六附体每回合轮转(6 种词缀/破绽循环切换) + 回声分身(orbitEcho) + 动态破绽。破绽随轮转变化(鳞盾裂隙/轮回再生核/回声裂群/疾步断环/吞尾咽喉/雷回涌核)。

**提炼风味**：吞尾蛇的永恒循环——同一动机不断**移调轮回**，回声层层交接，结构最复杂、最史诗。

**音乐映射**：Dark psy 轮回味，154 BPM。核心是**一个反复出现的动机，每个乐句移调一次**（对应六附体轮转，呼应引擎 `_rootCycle`）；级联回声延迟做「回声」；相位叠层缓慢演化。大 Boss·终，做最长 build。**签名**：动机移调轮回 + 长回声交接(handoff)。狂暴(每回合切换)时轮转更快、回声更密、走向高潮，160。

**Suno 风格串**

```
常态: Dark psytrance, boss battle theme for Ouroboros the Eternal Echo, the eternal cycle of a serpent devouring its own tail, spiraling and ever-returning, hypnotic and slowly building, epic, instrumental, no vocals
狂暴: Dark psytrance, final boss theme for Ouroboros the Eternal Echo, the cycle racing toward its end, the serpent rushing to devour itself, towering and eternal, climactic, instrumental, no vocals
```

**引擎落点（已从 Suno 成品「衔尾终环」提炼，6 分轨含 Woodwinds）**

> 提炼证据：时长 ~222s；中位 **133 BPM**（区间 131–135，**全场最慢**，史诗终曲感）；root = **D#/Eb**；签名 = **FX 三音循环动机 b2 / b5 / 6 无限轮转**，狂暴时密度从 1.65/s 飙到 **6.11/s**（同一动机加速吞没 = 衔尾/永恒回声）。

- **bpm**：`glideBpm(133)`（设计 154 太快；终 Boss 要慢、要重、要史诗）。
- **根音/调式**：root **D#/Eb**，`setRootFreq(38.9)`（D#1/Eb1）。bass 近乎纯 D# pedal(deg 1:184/185)；调式暗色 = **b2 / b5 / 6 / b6 / b7** 混合（Phrygian 底 + 三全音 + 大六度色）。
- **bass**：低 D# pedal(reg D#3、常态 1.20/s → 狂暴 1.66/s、几乎单音锁根) → 引擎 bass 稳态 pedal、随 build 缓增密度。
- **鼓**：**n82 shaker 主导(常态 131)** + 四踩 kick；狂暴鼓反而变疏(0.72/s)——终曲张力交给 FX 与 synth，不是鼓。
- **lead/synth**：常态稀疏长音(0.58/s、deg 1/5/b7/b6、reg D#4)；狂暴跳到 2.40/s、**deg 5+1 power 音、medDur 0.25 短促 stab**(reg A#2) → 引擎 lead 终段转密集五度 stab。
- **FX/签名（核心）**：**b2 / b5 / 6 三音等权循环动机**(常态各 ~80 次、reg A3) → 用 `_rootCycle`/动机轮转让这三音逐句轮替 + `delaySend` + 高反馈做「回声交接」(一句尾接下一句头 = 衔尾)。
- **常态 / 狂暴（分段实测）**：常态 = 三音动机缓慢轮转 + D# pedal；狂暴 = **同一 b2/b5/6 动机密度 ×3.7 加速到 6.11/s** 吞掉空间 + synth 五度短 stab → 引擎狂暴不换素材，只把 FX 动机触发密度/反馈拉满 + `finalCue` 收束，做「永恒回声自噬」高潮，build 最长。
- **撞味提醒**：root D# 与 glacies、devourer 同；ouroboros 靠**三音循环动机(133 BPM、最慢)** 区分，glacies 靠大三度玻璃铃(145) + b2 缝合人声、devourer 靠低频 16 分 sub 雪崩(141)，织体完全不同。三全音(b5)与 ignis 也不撞：此处是循环动机一员，非 ignis 的 Phrygian 定音。

---

### 3.9 威胁/逼近轴 threat（通用紧张层 · 非 Boss）

**机制速览**：敌人逼近警戒线，`(距离 distance, 数量 count)` → 紧张危机程度。引擎里是一条连续可逆的 `setThreat(0~1)` 轴，**叠加**在任意 Boss/常态强度之上：数量走密度阶梯、距离走「迫近」轴；越线打点（safe→caution→danger→critical 四区），**告破(critical) 强推狂暴**。不是某个 Boss 的曲子，而是一条能盖在任何场景上的通用张力层。

**提炼风味**：一个看不见的东西在黑暗里**越来越近**——距离塌缩、四壁收紧、心跳加速，跨过警戒线的一刻警报炸响、直至告破。核心是「单向收紧的迫近感」+「拒绝解决」。

**音乐映射**：forest / dark psy 的**幽闭**子味。不抢骨架，只做张力：失谐底噪随迫近变宽（不安定）、高频啸叫从远到近由暗到亮、sub 心跳逐级加速（疏→密）、告破三全音+五度警报刺、全程**不给解决音**。越线打点对应 `onThreatZone`（caution→riser / danger→impact / critical→impact+alarm+强推狂暴），退区 → downlifter 卸力。一首歌走完四区，方便我按区提炼。

> ⚠️ **提示词必须全程钉在 psy 驱动骨架上**（四踩 kick + 滚动 bass 从第一拍就不停）。「迫近」= 骨架**收紧 / 提速 / 加层** + 不协和上升，**不是**从静默/ambient 渐入。首版用「far off / sparse / almost still / hum」太静，被 Suno 跑成了 dark ambient；故改写为**追逐/驱动**意象、流派标签前置、每一段都保持律动。

**Suno 风格串（Style 框）**

```
Darkpsy, forest psytrance, dark alchemy boss-chase theme, "The Hunt Closes In" — a relentless driving four-on-the-floor pursuit with a rolling churning bassline that never lets up, a predator bearing down through the dark and gaining fast, the groove tightening and accelerating as the gap collapses, a shrieking alarm the instant it crosses the line, then a full-throttle overrun, hypnotic, oppressive, merciless, instrumental, no vocals
```

**结构脚本（Lyrics 框 · 纯器乐分段指引，对应引擎四区 + 退区）**

```
[Intro — the hunt / safe]
dark and driving from the first beat, a relentless rolling psytrance groove, a menacing pursuer already on the move and gaining, tension coiled

[Build — caution]
closing the gap, the rolling bass tightening and speeding up, a rising whine bearing down, a heavy heartbeat pounding under the kick, the chase relentless

[Rising — danger]
right behind you now, frenzied and pounding, dissonance biting, a hard impact, no room to breathe, refusing to resolve

[Drop — critical / 告破]
it crosses the line, the alarm screams, full-throttle overrun, hammering kick and churning bass at peak chaos, merciless, no release

[Outro — it falls back]
the chase breaks off, the drive winding down, the pursuer receding into the dark
```

**引擎落点（待从 Suno 成品提炼，用来校准 threat 轴常量）**

> 已先落代码（见 `music_engine.js` / demo 的 `setThreat`、`_rideApproach`、`_heartbeat`、`_alarm`、`onThreatZone`、`_zoneOf`）；成品出来后按下表对齐数值。

- **心跳加速曲线** → 校 `_scheduleStep` 的 `hb` 细分阶梯（当前 8→4→2→1 分音）与 `_heartbeat` 的音高扫程(62→38Hz)/时值：听成品各区心跳的实际疏密与「砰」的下坠感。
- **迫近啸叫** → 校 `_rideApproach` 带通扫程(当前 300→3500Hz)、Q、增益曲线，与正弦 whine 的起点/显形阈值(当前 p≥0.4)：听远近时啸叫的亮度与突显点。
- **告破警报** → 校 `_alarm` 的音程(当前三全音 b5 + 五度)与时值/重复：听告破刺的不协和度与狠劲。
- **drone 失谐** → 校 `_applyThreatToDrone` 拍频增量(当前 +threat×0.03)：听迫近时底噪的「发毛」程度。
- **越线打点 & 卸力** → 校 `onThreatZone` 各区 riser/impact 强度与退区 downlifter 时长(当前 0.7s)：听跨线与撤离的力度。
- **区阈值** → 校 `_zoneOf`（当前 0.3/0.6/0.85）：对齐成品里「不安/危险/告破」的转折点。

---

## 4. 下一步

1. **你**：把上面每个 Boss 的 Suno 风格串（常态 + 狂暴）拿去 Suno 生成，导出音频。
2. **我**：从你的成品里**提炼特征**——BPM/调式、lead 音色与动机、bass 密度与失真、节奏密度阶梯、FX(混响/延迟/泵)、签名元素，对齐回引擎可调旋钮。
3. **落地**：给 `music_engine.js` 加 `applyBossProfile(bossId)`，按提炼出的特征设 8 套 profile；在 `core.js` 把 `boss:spawned` 的 `bossId`（已携带）接到该方法。
4. **试听**：在 `dark_psy_engine_demo.html` 加 8-Boss 切换按钮，逐个 A/B 对比、微调，再用 Node 谐波校验。

> 注：本作引擎是**纯实时合成**（零采样），所以第 2 步不是直接塞 Suno 音频，而是把 Suno 跑出来的「风味」翻译成合成参数。Suno 成品用作**风格基准/参考**，引擎据此复刻。

