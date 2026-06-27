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

**辨识度（v2，⚠ 已被下方「深挖 v3」取代——v2 用户仍不满意）**：ignis 当时是全 8 Boss 里**唯一以 tom 四踩取代 kick**者。验证：node 烟测确认 calm `kick=0 / furnace=8 / modal=16 / heat=4`，rage `kick=0 / furnace=16 / modal=8 / heat=16 / wood=4 / tom=4`，与「倒挂弧 + 节奏化喷发」设计一致。

**深挖 v3（hybrid 偏 Demo2 · 2026-06-25 · 见索引 M-01）** ⚠ 其中「`_arrScene` bar%16/%32 **定循环** + calm/rage 直接定 gate」部分已被下方 **深挖 v4 段落状态机** 取代；v3 的音色 / bass 句法 / 狂暴=build 方向**全部沿用**。

> 触发：v2（全程基于 `熔炉之门 MIDI` 这一版 demo）落地后，用户**仍不满意**第一个 boss。这一轮把 Boss 目录下的**两版** demo 一起逐分轨对比——`熔炉之门 MIDI`(=Demo1，v2 的来源) vs `熔炉之门 MIDI (1)`(=Demo2)——发现两版**方向相反**，用户选「混合（偏 Demo2）」。

两版 demo 对比（同名不同编配）：

| 维度 | Demo1（v2 来源） | Demo2（v3 偏向） |
|---|---|---|
| root / bpm | E / 146 | **F / 148** |
| 鼓 | **TOM 驱动、无 kick**（炉腔低 tom 四踩） | **四踩 KICK 驱动**（Kick×183），tom 退为色彩 |
| bass | 低 E pedal/drone（几乎单音） | **滚动 root+5th**（827 音、4.78 音/秒、71% root + 18% 五度；busy `1.1.\|1.1.\|1.1.\|5.5.`、rage `1.1.\|1.1.\|1.1.\|1.-.`） |
| 打击色彩 | 木鱼 accent | **Vibraslap×360 嗡鼓**买路 |
| 旋律 | 密 Phrygian，狂暴**坍缩回根**（倒挂弧） | root-pedal 上**对答 call-response**（和声锁 1=31%/2=27%/7=15%/5=10%） |
| 狂暴弧 | 旋律退场、能量交给节奏（**变薄**） | 织体**变密**（正常 build） |

**hybrid 决策（偏 Demo2，两版长处合并）**：**保留** Demo1 的熔炉签名（`heatPulse` 定根温压脉冲 + 炉腔低 tom，但 tom 从「取代 kick」降级为「反拍叠加层」）；**找回** Demo2 的四踩 KICK 打桩、滚动 root+5th bass、vibraslap 嗡鼓、root-pedal 对答旋律；并把狂暴弧从 v2 的「坍缩/泄气」**反转**为「递增 build」。

→ 引擎 v3 改动（已落 `dark_psy_engine_demo.html`）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `drumMode:'furnaceKick'`（替 `tribalTom`） | 改句法 | 四踩 **KICK** 找回 Demo2 打桩 + 炉腔低 tom 退为**反拍叠加层**（`s%4===2` 落两 kick 之间，保熔炉签名又不撞 sub）；rage 末拍 pickup + 偶拍 tom 连打=加码 |
| `bassFill:'furnaceRoll' / 'furnaceRollDrive'`（替 `furnacePedal/Drive`） | 改句法 | 滚动 root+5th：calm `1.1.\|1.1.\|1.1.\|5.5.`（8 音/bar）；rage 直 8 分 + 16 分填充 + 八度顶（16 音/bar）=**递增不变薄** |
| `playVibraslap(t,gain)` | 新增声部 | vibraslap 嗡鼓：非谐金属舌叮当 + 带通噪声「braaap」rattle，走 hatBus 坐顶端不糊低频；对应 Demo2 Vibraslap×360 |
| `sig.vibraslap`（替 `woodAccent`） | 改句法 | calm 反拍买路（`s%4===2`）→ rage 8 分加密（`s%2===0`）=build；鼓全退的 intro/breakdown 段跟 `_arrGate` 静默 |
| `modalLine` 反转 | 改段落 | calm root-pedal 对答 `[0,2,11,0,7,2,0,11]`；rage `[0,7,11,7,2,11,0,7]` 并加 downbeat 召唤音=**前景加码**（非坍缩回根） |
| `_arrScene` rage 反转 | 改段落 | 旧版 climax 砍旋律（`modal:0`）→ 新版 modal 恒 ≥1、峰值 2，tom/bass/vibraslap 全程加密=喷发即 build |
| root **E→F**(43.65Hz) / bpm **146→148**(rage 152) / padChord `[0,1,7,12]→[0,2,7,11]` | 调参 | 以 Demo2 为准：F 根、稍快、和声床换 root+2+5+maj7（去掉 b2/八度堆叠的撞味） |

> 旧 `tribalTom` / `furnacePedal` / `furnaceDrive` / `playWood` / `sig.woodAccent` 方法**保留在文件中未删**（无 profile 引用，留作 A-B 回滚）。

**辨识度（v3）**：ignis 不再靠「撤 kick」区分，而是「**四踩 KICK + 炉腔低 tom 反拍叠层 + vibraslap 嗡鼓 + root-pedal 对答 + 喷发递增 build**」的组合签名；熔炉味由 `heatPulse` 定根温压脉冲 + `furnaceTom` 腔体音色承载，不再依赖撤 kick。与 chimera（E↔D# 高 tom 乱滚、无 kick、188）、glacies（保 kick 叠高 tom shimmer、145）三者鼓型清晰区分。验证：mount-independent node 测全过——`furnaceRoll`=`1.1.\|1.1.\|1.1.\|5.5.`(8/bar)、`furnaceRollDrive` build(16/bar 含五度+八度)、`furnaceKick` calm `kick×4 + furnaceTom×4`、rage `kick×4 + tom×9`(build) + furnaceTom×4 层、rage modal 12 > calm 8、vibraslap intro 0 / calm 4 / rage 8。

**深挖 v4（段落状态机 state-driven section pools · 2026-06-25 · 取代 v3 的定循环 · 见索引 M-01）**

> 触发：v3 落地后用户**仍不满意**，并给出关键诊断——「原版其实并不存在一个一直循环的小节规律。一直是一相对稳定的节奏型 + 其他音轨的加花；然后在几个小节后做一个过渡」，要求**系统拆分音乐分段**（哪些是 intro / buildup / drop），按段综合音轨分析，并让 **bass 与合成轮换形成变体**。

逐分段实测（两版 demo 一致，以 Demo2 root F / 148 BPM / 115 小节为准）：曲子是 **intro → buildup → drop → groove → synth-lead → breakdown** 的 through-composed 结构，**不是**定长循环：

| 段落 | demo 小节(Demo2) | kick | bass | synth/旋律 | 说明 |
|---|---|---|---|---|---|
| intro | 0–7 | 关 | 关 | 余烬主奏前景 | synth-only 起手 |
| buildup | 8–38 | **关** | 渐进滚入→重 | 背景 | bass 加密但**仍无 kick** |
| drop | 39–46 | **四踩开** | 重驱动 | 退背景 | KICK 落点 |
| groove | 47–67 | 开 | 中 | **与 bass 逐句轮换前景** | 稳定节奏型 |
| synth-lead | 68–91 | 开 | 退一步 | 主奏前景 | lead 主导 |
| breakdown | 92+ | **关** | 滚动收束 | 余烬回前景 | 卸力 |

关键：**kick 只在 drop/groove/synth-lead（约 bars 39–91）出现，intro/buildup/breakdown 全程无 kick**；bass 与 synth **按乐句让位轮换**（bassOnly 53% / both 26% / synthOnly 12%）；各分轨 distinct pattern 数极高（bass 49 种 / synth 29–55 种）= through-composed 而非循环一小节。

→ 引擎 v4 改动（已落 `dark_psy_engine_demo.html`，**仅 ignis**；glacies 仍走 `_arrSceneGlacies` per-bar 闸门，互不影响）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `_secTick / _secGate / _secBegin / _ignisSecDefs / _secPools`（取代 ignis 的 `_arrScene` bar%16/%32 定循环） | 新机制 | 段落状态机：6 个命名段（各 8 bar），每段一套层闸门 `{tom,bass,heat,modal,perc,lead}` + `energy` 旗 + 行为旗（ramp/rotate/enter）。`_onBarStart` 每小节头推进 |
| **战斗状态只 steer 段落池** | 新机制 | `_secCombat`：calm 走 `[intro,buildup,groove,synthLead,breakdown,groove]`、rage 走 `[drop,synthLead,drop,groove]`；段落 `energy` 再回贴 `this.section` 驱动既有 rage-keyed 加花（只有 drop 是 rage 能量）。**战斗状态不再直接定 gate** |
| kick 段落门控 | 改段落 | `_arrGate.tom`：intro/buildup/breakdown=0(鼓全退，旋律前景) / groove/synthLead=1(四踩) / drop climax=2。还原 demo「kick 只在响段」 |
| bass↔synth 逐句轮换 | 新句法 | groove 段 `rotate`：奇句 `modal=2/bass=1`(synth 前景、bass 退) / 偶句 `modal=0/bass=2`(bass 驱动、synth 出)=用户要的「bass 轮换跟合成形成变体」 |
| `modalPool`(4 乐句) + `_bassColor`(末拍 5th/4th/b7/b3) 逐句轮换 | 新句法 | `_phraseGlobal` 每 4 小节换旋律句与 bass 末拍音程=through-composed 变体（非循环一小节） |
| `playFurnaceKick` | 新增声部 | 更深·更「铁」的熔炉 kick（sine sub 180→38 深扫 + 三角炉腔共鸣 + 方波锤头咔 + 软削粒面），替段落机里的 `playKick` |
| `playEmberLead` | 新增声部 | 余烬前景主奏（intro/synthLead/breakdown 的 `lead` 闸门）：锯+三角八度叠 + 5.5Hz 颤音 + 低通扫 → leadBus(+混响尾)，比背景 modal 高一八度坐前景=**音轨数↑** |
| 过渡 | 新句法 | 自然段尾前一小节 riser 预告；战斗强跳=乐句边界 slam（rage→drop 冲击+真镲 / calm→breakdown 下沉 downlifter） |

> v3 的 `_arrScene`（ignis 分支）、`furnacePedal/Drive`、`tribalTom` 等**保留未删**（无 ignis 引用，留作 A-B 回滚）；glacies 仍用 `_arrScene`→`_arrSceneGlacies`。

**辨识度（v4）**：ignis 现在是「**段落状态机驱动的 through-composed 熔炉**」——稳定节奏型 + 加花 + 每几小节过渡，kick 按段进出，bass↔synth 逐句让位轮换，战斗状态只换「段落池」。验证：mount-independent node 单测 **27/27 全过**——段序 intro→buildup→groove→synthLead→breakdown→groove(各 8 bar)、kick 仅 groove/synthLead 在场、bass 仅 intro 离场、lead 仅 intro/synthLead/breakdown 在场、buildup bass 段内 1→2 渐进、groove 两乐句 gate 不同(轮换非循环)、bassColor 逐句 7/5/10/3、战斗→rage 在乐句边界 slam 进 drop、rage 冷启从 drop 起手。

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

**深挖 v2（逐分轨 MIDI 实测 · 2026-06-25 · 见索引 M-02）**

> 上一轮只取中位 BPM + 音级直方图；这一轮把 5 条分轨（BackVox / Bass / Drums / FX / Synth）逐条按 16 分栅格解析。
> 完整性：5 分轨全过校验（0 截断，div=480，format-1）。全局：143–152 BPM、中位 145、root D#/Eb、约 212s。

关键发现（与 ignis 形成**镜像对比**）：

1. **鼓保留四踩 kick，再在其上叠高 tom shimmer**。Drums 轨主体 = HiTom2(50):329 主导，但 kick 仍踩四分（栅格 `▁   █   ▁   █`，s4/s12 加重）——与 ignis「撤 kick 换炉腔 tom」**正好反着来**：glacies 不撤 kick，而是用高 tom 在四踩上撒「冰晶碎光」。
2. **大三度玻璃铃是持续音，不是点缀**。Synth deg 1:48 / 5:20 / **3:12** / 2:12，reg5，中位时值 **3.90 拍**（超长持续）。常态 reg4 偏低且更密、狂暴 reg5 抬高反而更疏——明亮**大三度**晶体色，确认不是阴小调。
3. **定根 b2「缝合」stutter**。BackVox 死锁 **E5(pitch 64)=b2**、vel 127 满、中位时值 0.19 拍极短——这就是「缝合怪」把音机械咬针缝住的标志刺点（仅狂暴段出现）。
4. **bass 跌落低八度**。常态 106 音 reg4 → 狂暴 218 音 reg2，并掺 b3:15 / b2:6 冰裂音。
5. **定根 D# FX 脉冲随段加密**（0.24 → 0.88 音/秒）；另有 Crash + STwhistle + 反拍三角高频 perc。

→ 引擎丰富落点 v2（已落 `dark_psy_engine_demo.html`，无新增构造字段，全部走 `sig` 旗标 + `bassFill`，比 ignis 更干净）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `playGlassBell` | 新增声部 | 大三度持续冰晶铃：非谐泛音串 `[1,2.76,5.4,8.93]`→fxBus 进混响；calm reg4 密 / rage reg5 疏且拖更长 |
| `playStitch` | 新增声部 | 定根 b2(`_noteFreq(25)`) 方波芯过 formant 带通→leadBus，极短机械「缝针」 |
| `playChime` | 新增声部 | 三角高频 2640→2200Hz→hatBus，反拍冰锥「叮」 |
| `glassBells` 段落编排 | 改句法 | calm `s%4===2` 密 + 低八度 `bellDeg:[36,40,43]`；rage `s∈{4,12}` 疏 + 高八度 `[48,52,55]`（**还原 calm 密低→rage 疏高**） |
| `tomShimmer` | 新增句法 | **四踩 kick 保留**，在其上叠 HiTom shimmer（calm `s%4===3` / rage `s%2===1` 加密） |
| `stitchVox` | 新增句法 | 狂暴 `s∈{6,12}` 各 4 连 b2 stutter（缝合收紧；仅狂暴） |
| `frostMid → frostDrop` | 新增句法 | bass calm 中音 pedal `_noteFreq(12)` → rage 跌低八度 `_noteFreq(0)` + b3 冰裂（**八度落差**落地） |

**辨识度**：glacies 是全 8 Boss 里**唯一「保留四踩 kick 又在其上叠高 tom shimmer」**者，与 ignis（撤 kick 换炉腔 tom）构成镜像；大三度玻璃铃 + 定根 b2 缝合 stutter 为其专属。验证：node 烟测确认 calm `kick=4 / glassBell=4 / tom=4 / chime=4 / bass=2`，rage `kick=4 / glassBell=2 / tom=8 / chime=4 / stitch=8 / bass=16`，与「保 kick 叠 shimmer + 大三度铃 + b2 缝合 + 八度落差」设计一致。

**撞味提醒**：与 mikro 共用的 `vocalChop`（三全音机关枪）句法分开——glacies 改用 `stitchVox`（定根 b2、固定不漂），句法与音程都不同，不撞味。

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

**深挖 v2（逐分轨 MIDI 实测 · 2026-06-25 · 见索引 M-03）**

> 上一轮只取中位 BPM + 音级直方图；这一轮把 **7 条分轨**（BackVox / Bass / Drums / FX / Guitar / Synth / Vocals，全场最多）逐条按 16 分栅格解析。
> 完整性：7 分轨全过校验（0 截断，div=480，format-1）。全局：165–175 BPM、中位 173（**全场最快**）、root F、约 197s。

关键发现（裂变母体 = 「一个变多个」的复制母题）：

1. **Vocals 是颗粒机关枪，死锁 b5 三全音**。246 音、**63.49 音/秒**（全场最密）、锁 B4=b5、vel 满、中位时值 0.04 拍——一颗三全音被绞成颗粒群，是「裂变/散射」最直观的声学体现（仅狂暴）。
2. **Synth 把同一根音「克隆」到多个八度**。680 音、deg 1:582 主导，但 register **同时散落 reg3:202 / reg2:198 / reg6:180**——同一个音不同八度齐发 = 分身。常态偏 reg6（高），狂暴坍到 reg3（低）。
3. **新增 Guitar 闷音 chug**（上一轮完全没提）。staccato 棕榈闷音、deg1 锁根、vel 满、reg4——电气 swarm 的「体」，mikro 是 8 boss 里**唯一带吉他**者（仅狂暴）。
4. **Bass 忙碌近-16 分 + maj7/b7 chromatic glitch**。deg 1:558 主导 + 7:60 / b7:48 / b3 / b2 半音邻音，calm 3.22 → rage 4.67 音/秒。
5. **Drums 常态是 glitch perc（n27 blip）、狂暴才加回四踩 kick + open-hat**；另有 BackVox（deg4）二层人声答句（「分身」回应）。

→ 引擎丰富落点 v2（已落 `dark_psy_engine_demo.html`，大胆改动）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `playGuitarChug` | 新增声部 | 棕榈闷音吉他：锯齿芯过低通 + 噪声拨片瞬态 → leadBus（全 8 boss 唯一吉他音色） |
| `_fissionStutter` | 新增声部 | b5 加速颗粒机关枪：grain 数随 intensity 翻倍（1→2→4 分裂）、间隔渐缩=越分越快 |
| `sig.octaveScatter` | 新增句法 | 同一 lead 动机同时炸 `note / note±12` = 克隆到低/中/高八度（还原 reg2/3/6 散落） |
| `sig.fissionStutter` | 新增句法 | 狂暴每 8 分触发一串增殖颗粒（**替代**旧 generic `vocalChop`，更密更躁） |
| `sig.guitarChug` | 新增句法 | 狂暴 16 分闷音 chug 锁根（电气 swarm 体） |

**辨识度**：mikro 是全 8 Boss 里**唯一「八度分身散射 + 加速颗粒裂变 + 吉他 chug」**者，与 ignis（炉腔 tom）/ glacies（玻璃铃 + 缝合）完全不同的「增殖/散射」语汇。验证：node 烟测确认 calm `kick=4 / screech=6(八度散射) / bass=8`，rage `kick=4 / screech=6 / bass=12 / ooh=96(机关枪颗粒) / guitar=12`，与「多八度分身 + b5 加速颗粒 + 吉他 chug」设计一致。

**撞味提醒**：b5 三全音是 mikro 的**颗粒签名**；后续大 Boss chimera 也涉三全音，但 chimera 走「音高漂移 / detune 失稳」，与 mikro 的「密集颗粒增殖」语汇分开，不撞。另：`_fissionStutter` 取代了 glacies 曾共用过的 `vocalChop` 通用句法，二者各自独立。

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

**深挖 v2（逐分轨 MIDI 实测 · 2026-06-25 · 见索引 M-04）**

> 上一轮只取中位 BPM + 音级直方图；这一轮把 **4 条分轨**（Bass / Drums / FX / Synth）逐条按 16 分栅格解析。
> 完整性：4 分轨全过校验（0 截断，div=480，format-1）。全局：134–144 BPM、中位 **141（全场最慢最重）**、root D#/Eb、约 243s。

关键发现（噬神者 = 「被低频吞没」的引力深渊）：

1. **Bass 是全曲主体，近乎死锁根音的 16 分雪崩**。1687 音、**9.31 音/秒**、deg 1 近乎全锁 + 半音邻音 b2:49 / b3:6（= 下坠的引力拖拽，不是旋律），register **对半劈成 reg2:873 / reg4:814** = 同一根音在两个八度齐砸 → 「双八度 sub 墙」。段落 calm 4.69 → rage **11.59 音/秒**，靠密度翻倍而非换音制造狂暴。
2. **Drums 极疏，仅维持四踩骨架**。1.14 音/秒（全场最疏之一），CHat 四踩打底，压迫感**完全不靠鼓**——这是 devourer 与其它 boss 最大的节奏差异（别人加鼓，它抽鼓）。
3. **FX 与 Synth 都死锁纯五度(A#)高音区**。deg **5 纯五度**、reg6（高），Synth onset 呈 `█▃█▃█▃…` 的**8 分颤音**铺底 = 深渊上方一层惨白的空腔泛音，与底部 sub 墙形成「上下撕开」的空旷恐怖。

→ 引擎丰富落点 v2（已落 `dark_psy_engine_demo.html`，大胆改动）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `playVoidFifth` | 新增声部 | 高音区纯五度「虚空泛音」：失谐双正弦(×1.006 拍频)短颤 → fxBus 进混响，还原 FX/Synth 的 reg6 五度颤音铺底 |
| `bassFill:'abyss'` | 新增句法 | 常态 8 分巨 sub pedal：`s%2===0` 锁根，`I>0.5` 再补稀疏 b 拍 = 深渊静默下的心跳 |
| `bassFill:'abyssRoll'` | 新增句法 | 狂暴**双八度 16 分 sub 雪崩**：每步低八度根音 + b2(s7)/b3(s11) 引力拖拽半音 + `s%4===0` 叠中八度=还原 reg2/reg4 双层 |
| `sig.voidTremolo` | 新增句法 | 每步触发 `playVoidFifth`（`s%2===0` 强而长 / 余拍弱而短）= 上方五度 8 分微颤，对位底部 sub 墙 |
| `profile.kickHalf:true` | 调参 | 半拍稀疏 kick（s0/s8 仅两下），把鼓让位给 bass 深渊——与「抽鼓」实测一致 |

**辨识度**：devourer 是全 8 Boss 里**唯一「半拍抽鼓 + 双八度 16 分 sub 雪崩 + 高五度虚空颤音」**者——别人靠加层变狂，它靠**抽掉鼓、让低频吞没一切**变狂，节奏语汇与众相反。验证：node 烟测确认 calm `kick=2 / bass=8(8 分 pedal) / void=16`，rage `kick=2 / bass=20(16 分雪崩+双八度) / void=16`，与「稀疏半 kick + 低频雪崩 + 五度虚空颤音」设计一致。

**撞味提醒**：root D#/Eb 与 glacies、ouroboros 同根族——glacies 靠大三度玻璃铃(145) + b2 缝合，ouroboros 靠三音循环动机(133、最慢)，devourer 靠**双八度低频 16 分 sub 雪崩 + 抽鼓**(141)，三者织体完全不同。devourer 的五度颤音是「空腔泛音」铺底，非旋律，不与任何 lead-boss 撞。

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

**深挖 v2（逐分轨 MIDI 实测 · 2026-06-25 · 见索引 M-05）**

> 上一轮把 viridis 压成「F drone + 六度 pad + 沙锤」，听感偏静。这一轮把 **5 条分轨**逐条按 16 分栅格解析，发现它真正的识别点是**「呼吸 + 腐坏」的段落反转**，上一轮整段没抓到。
> 完整性：5 分轨全过校验（0 截断，div=480，format-1）。全局：144–149 BPM、中位 **147**、root **F**、约 210s。

关键发现（维里迪斯 = 「活体呼吸 → 腐坏出毒」的有机体）：

1. **Synth 是一条近乎连续的「呼吸」悬浮 pad**。606 音、deg **6 大六度(D) 全锁**、reg3、onset `▇█▇▇▇▇▇▇▆▇▇▆█▇▇▇`（几乎每个 16 分都有，但靠 vel/时值微动呼吸）——这不是旋律，是一层挂在六度上的活体长音。**关键：calm 3.87 → rage 1.96 音/秒**，pad 在狂暴**反而变薄**（别的 boss 狂暴加层，它退层）。
2. **Bass 是 F 低根 drone，但有切分呼吸**。590 音、deg 1:570 锁根、reg2(F1)、onset `▅▅▃▁▅▄▇▂▃█▃▂▄▄█▁`（重音落在 s9/s14，非平铺），calm≈rage（2.67→2.96）几乎不变=稳定的地基。
3. **FX 是慢扫毒液 acid，只在 rage 冒头**。仅 31 音、medDur **2.34 拍**（超长慢扫=滤波 squelch）、deg 2(G)、reg4–5，**calm 2 音 → rage 29 音**——毒味是被「催熟」出来的。
4. **打击是有机部落色，不是电子四踩**。n82 沙锤/maraca 主导(512) + 散点 LoTom/LoTom2/MuConga/OTri(三角)/HiWdblk(木鱼)，外加**第二条 Percussion 分轨只在 rage** 补 Kick+Snare(各 20/10)。
5. **段落逻辑反转**：常态=厚呼吸 pad + 沙锤律动（生）；狂暴=pad 腐坏退层 + 毒液 acid 上升 + 打击加密（腐）。还原 Suno 串「the organism overgrowing and turning toxic」。

→ 引擎丰富落点 v2（已落 `dark_psy_engine_demo.html`，大胆改动）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `playBreathPad` | 新增声部 | 呼吸 pad：失谐双锯→低通，cutoff 由 0.6Hz 慢 LFO 调制 = 活体膨胀-收缩「呼吸」→droneBus（calm 叠高八度更厚） |
| `playSquelch` | 新增声部 | 毒液 acid squelch：锯齿过 Q=14 共振低通 + cutoff 快速下扫 = 303「yow」→leadBus（仅 rage 冒头） |
| `playWoodblock` | 新增声部 | 有机木鱼/三角铁 accent：极短三角高音咔→drumBus（还原 OTri/HiWdblk/MuConga 部落散点） |
| `bassFill:'sporeDrone'` | 新增句法 | F 低根切分 drone（重音 s0/s4/s6/s9/s14），rage 补 b7 下沉邻音=「腐坏」摇摆 |
| `sig.breathDrone`（段落反转） | 新增句法 | 呼吸 pad：**calm 厚而双八度 / rage 变薄+更失谐**（drone 在狂暴退场，与众反向） |
| `sig.venomSquelch` | 新增句法 | **仅 rage** 触发毒液 acid（deg2=G 慢扫），每拍半一记=被催熟的毒 |
| `sig.organicPerc` | 新增句法 | 部落律动：沙锤 8 分底色 + 木鱼/三角散点（rage 加密），取代呆板电子四踩 |

**辨识度**：viridis 是全 8 Boss 里**唯一「呼吸滤波 pad + 部落有机打击 + 狂暴反向退层出毒」**者——别人狂暴=加，它狂暴=腐（drone 退、毒升）。验证：node 烟测确认 calm `kick=4 / bass=5 / breath=4(双八度厚) / shaker=8 / wood=3`、无毒；rage `breath=2(变薄) / bass=6(+b7 腐) / squelch=4(毒) / wood=5(加密)`，与「呼吸→腐坏」设计一致。

**撞味提醒**：root F 与 mikro、tesla 同——mikro 是 maj7 + 三全音颗粒(173、最快)、tesla 是 b6 小调 16 分驱动(150)、viridis 是**大六度呼吸 pad + 部落打击(147)**，三者调色/速度/织体完全不同。viridis 的 acid squelch 与 ouroboros 的 fxCycle 也不撞：前者慢扫毒液、后者三音循环动机。

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

**深挖 v2（逐分轨 MIDI 实测 · 2026-06-25 · 见索引 M-06）**

> 上一轮把 tesla 压成「八分 groove → 16 分驱动」，识别点只剩"快"，但跟其他快 boss 撞。这一轮把 **5 条分轨**逐条按 16 分栅格解析，发现它真正的签名是 **FX 那条「规律放电脉冲」+ Drums 那条「滚动双 tom 残影」**——上一轮把这两条最有辨识度的层都揉进泛化的 hat/tom 里丢了。
> 完整性：5 分轨全过校验（0 截断，div=480，format-1）。全局：148–153 BPM、中位 **150**、root **F**、约 177s。

关键发现（特斯拉 = 「高压放电脉冲 + 快到出残影」的相位幻影）：

1. **FX 是一条规律的「放电 stab」脉冲，这才是签名**。216 音、deg **2(G) 全锁**、reg4、onset `█▂▄ █▂▃ █▁▄ █▁▄`——每拍头一记强 stab + 拍中弱 ghost，像电容**规律充放电**。不是随机 zap，是有节拍栅格的脉冲。
2. **Drums 是「滚动双 tom 残影」**。HiTom2:49 + LoTom2:34 **近乎连续**地交替滚动（占了鼓轨主体），外加 Snare:96 / PedHat:77 / Vibslap:15。双 tom 高低交替的连滚 = 「快到出残影」的听感来源，不是普通四踩。
3. **Bass 是中音区(reg4)旋律 arp，不是低 drone**。389 音、onset `▆▃▆▂█▃▄▃▅▃▆▃▆▃▆▃`、deg 1:389/4:79/b6:78/2:20/b3:19/b7:13——围绕 root/4/b6 跑句的中音琶音，比上一轮"低八分律动"亮、更有动势。
4. **Synth lead 含 b5 三全音相位失稳**。deg 1:133/2:47/4:39/5:36/**b5:22**/b6:20、reg4–5——b5 三全音是「相位/幻影」的张力来源，狂暴解锁。
5. **段落逻辑**：常态=放电脉冲 + 中音 arp + 干净 lead；狂暴=PedHat 四踩压满 + Vibslap + bass 16 分驱动 + 滚动双 tom 全开 + b5 失稳 → 「过充失控的电暴」。

→ 引擎丰富落点 v2（已落 `dark_psy_engine_demo.html`，大胆改动）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `playZap` | 新增声部 | 放电 stab：方+锯失谐高频，pitch 快速下扎(freq*2→freq) + 带通噪声「啪」瞬态→leadBus（还原 FX deg2=G 规律脉冲） |
| `playArcCrackle` | 新增声部 | 电弧静电噼啪：高通(4.2k)噪声切成 4 颗粒、幅度抖动=电火花残影→hatBus（仅 rage 填间隙） |
| `sig.teslaArc` | 新增句法 | 放电脉冲：拍头(s%4===0)强 zap + 拍中(s%4===2)弱 ghost = 电容规律充放电；rage 反拍(s%2===1)塞电弧噼啪 |
| `sig.teslaRoll`（仅 rage） | 新增句法 | 滚动双 tom 残影：offbeat hi/lo 交替(s%4===1 用 hi 300/否则 lo 150) + 反拍(s%4===3)再叠 lo tom=电压击穿 |
| `bassFill` 常态`offbeat`/狂暴`driving16` | 句法切换 | 常态中音 arp(reg4 旋律 pattern `[null,0,0,8,…]`) → 狂暴 16 分驱动满格锁根 |
| `leadNotes` 狂暴解锁 b5 | 音高 | 狂暴 `[18,23,12,19]`，18=上八度+b5 三全音=相位失稳 |

**辨识度**：tesla 是全 8 Boss 里**唯一「规律放电脉冲 stab + 滚动双 tom 残影」**者——签名不在"快"，而在 FX 那条带节拍栅格的电容充放电脉冲 + 双 tom 连滚。验证：node 烟测确认 calm `kick=4 / bass=8(中音 arp) / zap=8(放电脉冲)`、无 crackle/tom；rage `bass=16(16分驱动) / zap=8 / crackle=8(电弧填间隙) / tom=12(滚动双 tom 残影)`，与「常态脉冲→狂暴电暴」设计一致。

**撞味提醒**：root F 与 mikro、viridis 同——但 tesla 靠 **FX 放电脉冲 + 双 tom 残影 + b5 三全音(150)** 区分；mikro 是 maj7+三全音颗粒(173、最快)、viridis 是大六度呼吸 pad+部落打击(147)。tesla 的 zap stab(短脉冲)与 chimera 的 burstImpact(爆冲)、ouroboros 的 fifthStab(纯五度)织体不同，不撞。

---

### 3.7 混沌融合体·奇美拉 chimera（venom / laser，大 Boss）

**机制速览**：左右热核吞噬 + 流彩转盾。每回合召唤 2-3 个热核养料，左侧低温、右侧高温；每次吞噬两个目标，左侧倾向低温、右侧倾向高温；热核/冰核按温度一比一累计，冷热抵消 100% 转为流彩护盾，狂暴后护盾量翻倍。破绽=污染胃域(venom/laser 累计伤害 9%)。

**提炼风味**：不稳定的混沌拼接体——音高发飘、组织错位、随时炸开的狂暴脉冲。

**音乐映射**：Darkpsy 混沌味，156 BPM。A 叠 **#4/b5 三全音**制造不安定张力。lead 故意**失稳音高漂移**(detune/pitch drift)；不和谐的融合织体；冷热核心抵消时用短促盾脉冲 accent。**签名**：音高失稳 + 冷热相位互相抵消的脉冲节奏。护盾越厚，低频侧链越重。

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
- **撞味提醒**：~~root E 与 ignis 同~~ → ignis v3 已改 **root F / 148**（见 §3.1「深挖 v3」），与 chimera root E **连根音都不同**；chimera 再靠 **E↔D# 半音失稳**（188 BPM）拉开，更不撞。

**深挖 v2（逐分轨 MIDI 实测 · 2026-06-25 · 见索引 M-07）**

> 上一轮把 chimera 的失稳压进 `driftCycle`（逐相位根音偷偷 -1）+ 一条带 maj7 的 bass pattern，听感上"乱"但说不清乱在哪。这一轮把 **5 条分轨**逐条按 16 分栅格解析，发现它真正的签名是 **bass 的「root 与 maj7(导音) 互搏」+ 几乎全 tom 没有 kick 的鼓**——这两点上一轮都被泛化掉了。
> 完整性：5 分轨全过校验（0 截断，div=480，format-1）。全局：185–191 BPM、中位 **188（全场最快）**、root **E**、约 **100s（最短）**。

关键发现（奇美拉 = 「root 与导音 D# 互相夺权 → 身份崩塌」的混沌拼接体）：

1. **Bass 是一场「root E ↔ maj7 D# 的夺权战」，这才是签名**。415 音、4.22 音/秒、deg 1:228 / **7:155(maj7=D#)** / b2:19。按时间切两段：**前段 D# 反超 root（7:153 vs 1:59、reg3）**，后段 **root E 收复（1:169 vs 7:2、reg4，并冒 b2:15 半音邻音）**——root 和它下方半音的导音 D# 一直在抢「谁是根」，这是别的 boss 都没有的「双根打架」。
2. **鼓几乎没有 kick，是 HiTom2 主导的滚动高 tom**。147 音里 **HiTom2(50):126** 压倒性主导，**Kick 只有 1 下**，外加 LoTom2 + note33（仅 rage 的低 conga，16 下）。→ chimera 的脉冲来自滚动高 tom，不是四踩。
3. **FX 是稀疏的超长爆裂 swell**。仅 12 音、deg1(E)、reg4、medDur **9.56 拍**（超长）、onset `▄ ██▄▄█  ▄  █`（不规律）=「随时炸开的暴力脉冲」（对应受击全场爆炸）。
4. **Synth 叠 b5 三全音**。101 音、deg 1:69 / **b5:12(三全音 Bb)** / 5 / 6 / b3，reg4–5；calm 密(3.31/s 带 b5)→rage 疏(0.97/s)。b5 与 bass 的 maj7 叠在一起=最大不和谐的「拼接体」。
5. **Percussion 的 Snare 12 下全在 rage**=狂暴才补上的 backbeat。

→ 引擎丰富落点 v2（已落 `dark_psy_engine_demo.html`，大胆改动）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `playChaosDrift` | 新增声部 | 双根失稳 howl：双锯在 **E↔D# 间缓慢 pitch 漂移**(linearRamp 来回) + detune LFO 摇摆=身份崩塌→leadBus（drift 参数 calm 窄 1 / rage 宽 2） |
| `drumMode:'chaosTom'` | 新增鼓机模式 | **HiTom2 主导滚动高 tom 取代四踩 kick**（实测 Kick:1/HiTom2:126）：s%4 高 tom 脉冲(音高逐拍下行) + 八分 ghost；rage 叠反拍低 tom + 满 16 分 tom 滚 |
| `sig.chaosFlux` | 新增句法 | 每小节头一记 E↔D# 漂移 howl；**rage 半拍再来一记从 maj7(deg11=D#)起=导音夺权** + 漂得更宽更频 |
| （沿用）`driftCycle` | 保留 | 逐相位根音 E↔D# 漂移（calm `[0,0,-1,0]` 偶夹 D# / rage `[-1,0,-1,-1]` 多 D#）=和声层持续失稳 |
| （沿用）`sig.burstImpact` | 保留 | rage 每 6 小节(bar%6===2)触发 `impact()` 爆裂 boom=受击全场爆炸的「随时炸开」 |

> 段落映射说明：报告按**时间**切的 calm/rage 显示「前 D#→后 E」；引擎把「D# 导音夺权」映射到**狂暴**（berserk=身份崩塌更剧烈），与 Suno 串「gone fully berserk」一致——两者表达的是同一个 E↔D# 失稳轴，只是方向取最戏剧的那一面。

**辨识度**：chimera 是全 8 Boss 里**唯一「root 与 maj7 导音互搏 + 几乎无 kick 的滚动高 tom + 双根漂移 howl」**者（188 最快、100s 最短）。验证：node 烟测确认 calm `kick=0(无四踩) / tom=8(滚动高 tom) / drift=1(双根 howl) / bass=8`；rage `tom=20(满 16 分 tom 滚) / drift=2(含 maj7 夺权那记) / bass=12`，与「失稳→崩塌」设计一致。

**撞味提醒**：~~root E 与 ignis 同~~ → ignis v3 已改 **root F + 四踩 KICK(148)**（见 §3.1「深挖 v3」），与 chimera **不再同根、鼓型也彻底分开**：chimera 是 **E↔D# 导音夺权 + chaosTom 无 kick 高 tom 乱滚(188)**，ignis 是 **F 四踩 KICK + furnaceTom 炉腔低 tom 反拍叠层(148)**。chaosDrift 漂移 howl 与 viridis 呼吸 pad、tesla zap 均不撞。

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

**深挖 v2（逐分轨 MIDI 实测 · 2026-06-25 · 见索引 M-08）**

> 上一轮 ouroboros 只有「D# pedal + FX 循环」的泛化描述，听不出「衔尾」在哪。这一轮把 **6 条分轨**（唯一带 Woodwinds 木管的 boss）逐条按 16 分栅格解析，发现它真正的签名是 **FX 的「b2/b5/6 三音严格等权轮回」+ rage 才登场的木管顶腔**——前者上一轮被压成一句话、后者整条分轨上一轮根本没提。
> 完整性：6 分轨全过校验（0 截断，div=480，format-1）。全局：130–135 BPM、中位 **133（全场最慢）**、root **D#/Eb**、约 **222s（全场最长）**。

关键发现（奥罗波罗斯 = 「同一三音动机永恒轮回 + 回声交接」的吞尾终曲）：

1. **FX 是「b2/b5/6 三音严格等权循环」，这才是签名**。667 音（全场最密 FX）、deg **b2:202 / b5:197 / 6:194**——三音近乎完美等权；按时间切到 rage 段更是 **101/101/101 精确相等**，reg4–5、onset `▇▆▇▆▆▃█▅█▃▇▆█▇▇▄`（满栅格密铺）=「同一动机三音不断轮替、首尾相接」的衔尾本体。
2. **bass 是几乎纯 D# pedal**。326 音、deg **1:312 / 5:14**，reg4 主 + reg2 副（低八度加厚）=锁根 pedal，把空间全让给 FX 轮回。
3. **鼓是 shaker 主导、calm 疏 → rage 密**。note82(reg6 shaker):189 压倒性主导 + OpenTri:20 + LoTom2:11 + Tamb:11；calm 稀 → rage 铺满=终曲张力靠织体密度，不是换鼓色。
4. **synth：calm 稀长音(deg 1/5/b6/b7/b2) → rage 转 reg3 密集五度**。310 音、deg 1:171 / 5:102 / b6 / b7 / b2；rage 掉到低八度铺密 power-fifth=终段顶住高潮。
5. **唯一带 Woodwinds 木管分轨，且只在 rage 出现**。5 音、deg b2:3 / 7:2、reg5、onset `█ ▄    ▄ ▄`=狂暴才浮出的木管哀鸣顶腔（全 8 boss 独有）。
6. **Percussion 3 音一次性**=rage 单次撞击点缀。

→ 引擎丰富落点 v2（已落 `dark_psy_engine_demo.html`，大胆改动）：

| 改动 | 类型 | 说明 |
|---|---|---|
| `playEchoCry` | 新增声部 | 三音循环动机带「回声交接」：锯波过 bandpass(扫频 4×→1.4×)，**自身按 echoT 复触一次(0.45 衰减)**，echoT=一个 fxPeriod 的时长=一句尾接下一句头(衔尾)→fxBus |
| `playReed` | 新增声部 | 木管顶腔：triangle+sine 八度叠 + 5.5Hz vibrato + bandpass，慢起慢落长音=rage 木管哀鸣（对应唯一 Woodwinds 分轨）→leadBus |
| `sig.fxCycle`（改用 playEchoCry） | 改造句法 | fxCycle 分支 ouroboros 专用改走 `playEchoCry`，循环 `_fxCycleDeg=[1,6,9]`(b2/b5/6 实测三音) + 按 fxPeriod 算 echoT 做尾接=三音等权轮回 |
| `sig.windCry` | 新增句法 | **rage 专属**：s0 起 deg37(高 D#) + s10 起 deg47 的木管长音=狂暴才登场的顶腔哀鸣 |
| （沿用）`bassFill:'pedal'` | 保留 | D# pedal 锁根，calm 疏(I=0.4 → bass4) / rage 满(I=0.9 → bass16) |
| （沿用）`sig.fifthStab` | 保留 | rage s4/s12 五度 power stab=synth 转密集五度那一层 |

> 段落映射说明：calm `fxPeriod=8`(三音慢轮、bass4、无 stab/reed) → rage `fxPeriod=2`(同一三音动机密度 ×4 加速 + fifthStab + windCry 木管)；不换素材、只把 FX 轮回密度/反馈与顶腔拉满=「永恒回声自噬」高潮，与实测 rage 段三音 101/101/101 精确等权一致。

**辨识度**：ouroboros 是全 8 Boss 里**唯一「b2/b5/6 三音严格等权 + echo 尾接衔尾 + rage 木管顶腔」**者（133 最慢、222s 最长、唯一 Woodwinds 分轨）。验证：node 烟测确认 calm `kick=4(四踩) / bass=4(D# pedal 疏) / echocry=2(period8 慢轮) / 无 stab/reed`；rage `bass=16(pedal 满) / echocry=8(period2 密度激增) / screech=2(五度 stab) / reed=2(木管顶腔)`，与「永恒回声→自噬高潮」设计一致。

**撞味提醒**：root D# 与 glacies、devourer 同；ouroboros 靠**三音等权循环 + 回声尾接(133 最慢)** 区分，glacies 靠大三度玻璃铃(145)、devourer 靠 16 分 sub 雪崩(141)。b5 三全音与 ignis 不撞：此处是三音循环一员、非 ignis 的 Phrygian 定音。木管 reed 与 tesla zap、chimera drift howl、viridis 呼吸 pad 音色完全不同。

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

**引擎落点（已从 Suno 成品「告破 Chase」提炼，5 分轨 MIDI · 2026-06-25 · 见索引 M-09）**

> 提炼证据：时长 ~163s；加权中位 **169 BPM**（区间 166–171.5，Suno 抖动）；root = **D#**（bass D# 占 638/703，range D#1–D#4）；synth 以**五度 A#** 为主(339 次，range D#3–F4)；音级(相对 D#)= 1:641 / 5:346 / b2:40 为主 → **root+五度协和**、仅轻 b2、**近零不协和**(不协和占比 早段 0.02 / 高潮 0.00)。能量**前置**：16 桶密度高潮在第 5 桶(~51–61s)后**递减至尾**，**非**脚本设想的 safe→告破 单调递增。鼓层 Crash 189 / Snr 168 / Crash2 117 / maraca 25 主导、**无 kick**（Suno 分轨分离假象，四踩不在此 stem）。FX 层 29 次全在**单音 F3**（根上方大二度），成对出现、间隔 ~1.4s ≈ 169BPM 下一小节。
>
> 结论：成品给的是**音色 / 根音 / BPM / FX 性格**参考，**不**自带威胁升级曲线与强不协和（符合 §4「纯合成、不塞音频」）——升级阶梯仍由引擎设计，Suno 只校准底色。本轮据此**改 1 处**(drone 失谐)，其余经证据**校验保留**。

- **心跳加速曲线** → `_scheduleStep` 的 `hb` 阶梯(8→4→2→1) **保留引擎设计**：成品能量前置、非单调，不能照搬其时间线做升级。`_heartbeat` 音高扫程 **62→38Hz 保留**：38Hz ≈ **D#1** 正落在成品根音的下八度，已与参考同调；心跳是体感「砰」，刻意保持绝对音高（不随根漂）。
- **迫近啸叫** → `_rideApproach` 带通噪声扫程 **300→3500Hz 保留**：成品宽频能量由 **crash/snare** 扛（Crash 系共 306 击），正对应上扫带通噪声的「气压」。正弦 whine **1800→6000Hz / p≥0.4 显形 保留**：成品 FX 是中音 F3 脉冲、并无高频环鸣，故高 whine 记为**引擎自加的「锁定/逼近环鸣」**（游戏可读性），与 Suno 有意分工。
- **告破警报** → `_alarm` **三全音(18)→五度(19) 保留**。五度经成品**校实** = 高潮主音程(synth A# over D#)；三全音作为**游戏警报色**刻意保留——成品靠**能量/密度**报「告破」(不协和≈0)，但引擎需要一记不会被误听的警报。备选(未落)：加一记**根+大二度**(F over D#) 前置 stinger 呼应成品反复的 F3。
- **drone 失谐** → `_applyThreatToDrone` 拍频增量 **+threat×0.03 → +threat×0.02**（✅ 已改 engine + demo 各两处：`_applyThreatToDrone` / `_retuneDrone`）。证据：成品近零不协和、稳态 D# 协和铺底；0.03 会让 drone lowpass(300Hz) 通带内顶部谐波出现 ~10Hz 粗糙拍频，听感「跑调」；0.02 留 ~6–7Hz「发毛」漂移，张力在而不刺。
- **越线打点 & 卸力** → `onThreatZone` riser/impact 与退区 downlifter 时长 **保留**(riser 0.8 / downlifter 0.7s)。参考：成品 stinger 成对、间隔 ~1.4s ≈ 169BPM 一小节；引擎半小节级的 0.7–0.8s 打点在同一量级。
- **区阈值** → `_zoneOf` **0.3/0.6/0.85 保留**：阈值是**玩法手感**(距离驱动)，成品时间线能量前置、非干净四区，不可由其反推。
- **参考事实 / 推荐后续**：chase 参考 **BPM≈169**、root **D#≈38.9Hz**(D#1，与 glacies/devourer/ouroboros 同根族)、root+五度协和铺底。**推荐后续**(本轮未动 tempo)：threat 进 danger/critical 时用 `glideBpm` 把 BPM 朝 **~169** 平滑提速耦合，落实 Style 串「accelerating as the gap collapses」；威胁轴现仍不触 tempo。

---

### 3.10 连接层和声床 + 签名融合（去割裂 · 全 8 Boss 通用 · 2026-06-25）

> 触发：试听反馈「独有签名显得很割裂」。诊断：每个 Boss 的签名（windCry / fifthStab / metalGliss / 各类 stab）是**孤立单发**事件，落在一片**空的中频**里——大 Boss 多数 `allowOoh:false / allowLead:false`，而 drone 只铺 sub（≤300Hz lowpass），200Hz–2kHz 没有任何持续声音托底，签名一响就像「凭空蹦出来又凭空消失」。采用**最大胆**方案：① 加一层贯穿全程的和声胶水床；② 把暴露的离格签名重新融进床里。

**① 连接层和声床 `padBus` / `_startPad` / `_retunePad` / `_stopPad`**

- **路由**：`padBus(0.09) → pumpBus + wet`。干声入 pumpBus → 随每记 kick 被 `duck()` 侧链泵动（和鼓同呼吸，不糊底鼓）；湿声入混响，给签名一个**有混响的中频场**可融。
- **音色**：调式中立的**五度叠置** `degs=[12,19,24,31]`＝root / 5th / 八度 / 十二度。四个音级 mod 12 只有 **0(root) 与 7(5th)**，**任何 Boss 调式都不撞**（故意不用 `_padChord`——那会把 ouroboros 的 b2+b5 这类不协和长挂成噪音床）。前两声三角、后两声正弦，gains `[0.34,0.26,0.2,0.12]` 上薄下厚。
- **流动**：lowpass 820Hz + 极慢正弦 LFO（0.05Hz、深度 260）让滤波「呼吸」，不是死 pad；起声 3.5s 慢淡入。
- **动态**：`setSection` 里 rage 抬到 **0.115**、常态收到 **0.08**；跟随 `_rootOffset`（`_onBarStart` 移调 + `setSection`）用 `setTargetAtTime` 平滑retune，始终托住当前调中心。`start()` 起、`stop()` 0.5s 淡出收。

**② 签名融合（先审计：仅 windCry 是「离格旋律单发」，其余 stab 已在格或为织体）**

- **windCry 重新上格**：ouroboros 终曲木管悲鸣由 `s0/s10` 移到 **`s0/s8`**（正落在 kick 位），不再漂在反拍格点外；每小节仍恰好 2 记（不破坏既有计数校验）。
- **reed 叹息解决**：`playReed` 加 `glideTo` 参数——长音尾部（`t+dur*0.85`）线性滑奏到**和声床内音**：`s0` b2(deg37)→root(deg36)、`s8` maj7(deg47)→maj6(deg45)。暴露的张力音不再硬切收尾，而是「叹一口气落回床上」，与 pad 的 root/5th 协和收束。`glideTo=null` 时行为不变（向后兼容其它调用）。

**校验**：转写谐波台 `_cohesion_check.js` **43/43 通过**（pad 建 4 振荡器、音级/频率正确、mode-neutral 全为 root/5th、移调 retune、reed 滑奏目标与时点、windCry 仅 s0/s8 触发且 calm 静默）；三处接缝（pad 三法 / playReed / windCry dispatch）经权威 Read 花括号-括号-方括号**全平衡**。

---

### 3.11 去「铁道口警铃」：签名节奏从死格改乐句化（glacies / mikro / ouroboros · 2026-06-25）

> 触发：试听「霜变结晶玻璃铃太割裂、一直敲、像铁道口警铃；裂变母体狂暴、永恒回声狂暴同病」。诊断：三处签名都在**死规整格点**上以**单一或不谐音高**连发，相对原 Suno MIDI 的真实 onset 完全失真。回去重挖三条 stem 取真实 onset grid + 音高校正（`midi_mine.py`，root 自测/`--root=D#`）。

**glacies `glassBells`**（实测 Synth：重拍锚 s0/s4/s12 强、拍 3 弱；音高 root/maj3/5th；rage 转疏+断奏 s0/s6/s10、meddur 0.59 短）
- 旧：calm 每反拍 `s%4===2`（s2/6/10/14）单音 `bells[phrase%3]`——4 击/小节同一音高 = 警铃。
- 新：calm `{s0→root, s4→maj3, s12→5th}`（落实测重拍、**留拍 3**），rage `{s0→root, s6→5th, s10→maj3}`；连续铃**走三和弦琶音**，每乐句 `(idx+phrase)%3` 旋转换位（bar0≠bar4）；calm 长音 1.6s 叠成 shimmer、rage 0.85s 断奏。仍 3 击/小节，但音高**各不相同**。

**mikro 狂暴 `fissionStutter` + `guitarChug`**（实测 Guitar 全曲仅 11 个稀疏根音、偶 8 分；Synth 虽 16 分连发但是持续音不是颗粒爆）
- 旧：fission 每 8 分爆（×`fissBase`4 颗 = 32 颗/小节）＋ guitar 每 8 分 chug = 双层机关枪墙。
- 新：fission 只在 **2 小节乐句切分点**爆（偶小节 s6 / 奇小节 s6+s14）= 每 2 小节喘息一次；guitar 退成**拍点 punctuation**（s0/s8 ＋奇小节尾 s14），密度砍 **>70%**。八度散射 `octaveScatter`（s4/s10）不动。

**ouroboros 狂暴 `fxCycle`**（实测 FX：三音 deg **0/5/8 = root/4th/b6** 各≈200 等权；rage meddur 1.49 = 持续不是短促）
- 旧：`fxCycleDeg=[1,6,9]`（b2/b5/6 最不谐三音）每 8 分一发、0.5s 短促 = klaxon。
- 新：音高改回实测 **[0,5,8]**（协和哀句色）；rage 改**三音叹句 s0/s6/s10**（空出拍 2、拍 4 喘息）、拉长到 **1.3s** 持续=回声叠响而非短促警铃；calm 仍 `fxPeriod=8` 半拍缓转。

**校验**：转写台 `_alarm_fix_check.js` **13/13 通过**（fxCycle rage 3/小节 ⊆{0,6,10} 且只用 0/5/8、calm 2/小节；bells calm/rage 各 3/小节、每小节 3 个**相异**和弦音、乐句旋转 bar0≠bar4、丢弃旧反拍 s2/s14；fission ≤2/小节砍 >70%、guitar ≤3/小节）；size-guard 全文 UTF-8 完整解码（79466 B），花括号 283/283 · 括号 1387/1387 · 方括号 81/81 全平衡，`_scheduleSignatures` 方法独立 brace-walk 深度归零。

---

### 3.12 去「警铃」第二刀：音色 + 混音效果器（glacies / mikro / ouroboros · 2026-06-25）

> 触发：节奏乐句化后试听「问题减少了但还是有问题——是不是**音色和混音效果器**上的差距」。诊断：剩余警铃感不在音符，而在**合成音色**与 **FX 路由**——三处签名的振荡器/滤波器本身就是警报器音色，且每击参数恒定（无力度/失谐变化）、干声前置（贴脸、不进混响）。

**glacies `playGlassBell`**（音色元凶 = 非谐管钟泛音 2.76 = 金属敲击 clang）
- 泛音串 `[1,2.76,5.4,8.93]→[1,2.0,3.01,4.76]`：删掉 2.76 管钟比，换近八度＋柔三泛音＋微高空气 = 玻璃而非铁钟。
- 逐击力度 `vel`（实测 Synth vel 63-127）→ gain ×(0.5..1)；弱击起音更软（0.012→最长 0.042s）化解「敲击」瞬态。
- 泛音间微失谐（±~3.5 cents）= 玻璃 beating，逐击不同相 → 去机械重复。
- 调度按琶音音级散**声像**（pan=(idx-1)×0.4±jitter）＋力度浮动 → 连续三击 gain|pan|detune **无一相同**。
- 圆顶低通（freq×6+1800Hz）去脆刺；**额外 `_wet` 送**（0.6）让铃声晕进冰雾 shimmer（实测 calm meddur≈4.8 长叠）而非前景叮当。

**mikro `_fissionStutter`**（音色元凶 = 同音颗粒墙）
- 旧：intensity 1.0 时 `round(4×3)=12` 颗**同音**加速串 = 突突机关枪。
- 新：颗粒数封顶 7（`round(base×(1+intensity))`）；每颗下行半音 `freq×2^(-i/12)` = 裂变塌缩**级联**；间隔渐缩放缓（0.92→0.94）。靠**音程位移**而非同音连发出增殖感。

**ouroboros `playEchoCry`**（音色元凶 = 高 Q 共振扫频锯齿 = 克拉克松）
- 共振 **Q 8→3**：去窄带共鸣警笛峰；带通中心扫 `freq×4→1.4` 改 `freq×3→1.3` 更柔。
- 加**八度下身正弦**（freq×0.5，混入 0.4）= 暖芯，化解尖啸。
- 软起音 0.02→0.04s 去「按喇叭」瞬态；逐击力度（实测 FX vel 3-99 宽）＋微失谐（±5 cents）。
- 路由从纯 fxBus 干声 → **同时送 `delaySend`（真乒乓延迟尾）＋额外 `_wet`（混响）** = 名副其实的「永恒回声」晕开，而非贴脸短促警笛。

**校验**：转写台 `_timbre_fix_check.js` **18/18 通过**——确认 2.76 clang 已除、新泛音串、力度软↔硬 gain 拉开、连续三击 gain|pan|detune 三元组互异、声像横向铺开；echoCry Q===3、八度下身存在、同时连到 delaySend 与 _wet、逐击力度浮动；fission 颗粒≤7、每颗音高严格下行且互异。Node 成功解析并运行全部被改方法的忠实转写（= 花括号配平、无语法错）。

> 注：本沙箱 Bash 挂载视图对本文件**持续短读/截断尾部**（缺 `</script>`、花括号少计 2），与 NTFS 真值不符——以**文件工具 Read** 为准（已逐段复核 5 处改动就位、类体 156→908 闭合、`</script>`/`</body>`/`</html>` 976-978 完整）。故全文配平以 Read ＋转写台 node 解析为权威，不采信挂载层 brace 计数（见 `CLAUDE.md` §4 双视图不一致）。

---

### 3.13 保存预设·钢琴 `playPiano`（冻结快照 · 2026-06-25）

> 来源：§3.12 给 glacies `glassBell` 去警铃（删 2.76 管钟泛音换近谐串）后，意外得到一个**近钢琴**音色，用户认可、要求存档命名为「钢琴」。
> 用途：可复用的命名声部；作为**冻结快照**——后续若为 boss 战另调钢琴变体，新起方法，**不动 `playPiano`**。

**配方** `playPiano(t,freq,dur=1.6,gain=0.3,vel=1,pan=0)`
- 振荡：4 路正弦，近谐泛音 `[1,2.0,3.01,4.76]`、幅度 `[1,0.34,0.15,0.07]`；泛音间微失谐 ±~3.5 cent = beating。
- 包络：逐击力度 `gain×(0.5+0.5·vel)`；起音 `0.012+(1-vel)×0.03`s（弱击更软）；各泛音衰减 `dur×(1-i×0.16)`（高泛音先死＝自然琴尾）。
- 滤波：圆顶低通 `freq×6+1800Hz` Q0.5 去脆刺。
- 混音：`pn→fxBus`（干声临场）＋ `pn→gw(0.6)→_wet`（额外混响尾）；逐击 `pan` 散声场。
- 现状：`playGlassBell` 直接委托 `playPiano`；glacies 玻璃铃即此音色。

**Boss 战续作**：用户反馈纯钢琴用于 boss 战「呆」，选定走 **Suno 参考流程**（见同目录 `suno_boss_piano_prompts.md`）——由 Suno 生成「钢琴演绎 boss 战」参考音频，我再提炼成引擎参数、另调 boss 钢琴变体（不覆盖本快照）。

---

### 3.14 Boss 钢琴变体 `playBossPiano`（Suno「Pulse Breaker」提炼 · 2026-06-25）

> 来源：§3.13 选定的 Suno 参考流程落地。用户回传 `Pulse Breaker MIDI.zip`（6 stem：Synth/Drums/FX/Vocals/**Keyboard**/Bass）作为「钢琴怎么演绎 boss 战」的参考。用 `midi_mine.py` 逐轨深挖，**Keyboard=钢琴轨**。
> 目的：给 boss/狂暴段一版**撑得起战斗、不呆**的钢琴，**不动**冻结的 `playPiano`（§3.13）。

**Pulse Breaker 钢琴轨实测（root=C 归一）**

| 维度 | 实测 | 含义 |
|---|---|---|
| 音域 | 八度 5–7 为主（reg6=271/reg5=100/reg7=85），medpitch 77≈F5 | **钢琴坐高**，低盘交给 bass，不弹低八度 power octave |
| 调式 | deg top：root98 · 4th83 · b6 71 · 5th56 · b7 50 · M3 46 · M7 33 · b2 29 | **弗里几亚属**（root/b2/M3/4/5/b6/b7）＝异域/反派色，重 root·4th·b6 |
| 节奏 | grid[16] 峰值 s0·s6·s8·s10（36/50/38/47） | **八分反拍切分**：强拍 0/8＋反拍「ands」6/10，顶着鼓推 |
| 力度 | vmin/med/max 51/83/95 | 真有起伏（mp→ff，跨度 44），非等响 |
| 时值 | meddur≈1.0 拍 | **四分延音**＝踏板叠响，不是断奏机关枪 16 分 |
| 密度 | dens 2.71（bass 3.75 更忙） | 钢琴是旋律/和声 lead，**不当节奏引擎** |

> 框架佐证：**Bass** 低区八分直推（meddur0.5、grid 偶数步全亮、vel127）＋**Drums** 四踩 kick（grid s0/4/8/12 爆）扛住低盘与拍点，钢琴才能坐高发亮。

**6 维 → 引擎决策**（对齐 `suno_boss_piano_prompts.md` 的提炼清单）
- 音域/声部密度 → 旋律保持高、另叠**低八度 triangle body** 补下盘重量。
- 节奏型 → dispatch 在 rage arp **加回拍3锚 s8**（`{0,6,10}`→`{0,6,8,10}`），贴实测 s0/s6/s8/s10。
- 力度与起音 → 逐击 vel→响度＋**更短促锤击起音**（`0.004+(1-vel)×0.012`，比钢琴 0.012 起更狠）。
- 音色处理 → **开亮低通**（`freq×8+3200` Q0.9，盖过鼓/bass）＋多一阶高泛音（6×）＋**方波咬边**＝亮且糙。
- 与鼓/bass 叠法 → 一路进 **pumpBus** 被 kick 侧链泵动＝随四踩呼吸；干声进 fxBus。
- 段落动态 → 仅 **rage** 用 `playBossPiano`，calm 仍走温和 `playGlassBell`（→`playPiano`）。

**配方** `playBossPiano(t,freq,dur=0.85,gain=0.24,vel=1,pan=0)`
- 振荡：5 路正弦近谐泛音 `[1,2,3.01,4.76,6.0]` 幅度 `[1,0.40,0.22,0.12,0.06]`（比钢琴多一阶、上泛音更响）＋ **低八度 triangle**（0.5×，幅 0.5）body ＋ **square**（1×，幅 0.05）咬边；逐泛音微失谐 ±~4.5cent。
- 包络：`gain×(0.55+0.45·vel)`；锤击起音 `0.004+(1-vel)×0.012`s；高泛音先死 `dur×(1-i×0.13)`。
- 滤波：开亮低通 `freq×8+3200Hz` Q0.9（vs 钢琴 `freq×6+1800` Q0.5）。
- 路由：`pn→fxBus`（干）＋`gd(0.5)→delaySend`（反拍乒乓回声）＋`gw(0.42)→_wet`（混响尾）＋`gp(0.45)→pumpBus`（kick 侧链泵）。

**接线**（`_scheduleSignatures` 的 `glassBells` 分支）
```js
const arp = rage ? {0:0,6:2,8:0,10:1} : {0:0,4:1,12:2}; // rage +s8 拍3锚
...
if(rage) this.playBossPiano(t,this._noteFreq(bells[idx]),0.85,0.24,vel,pan); // boss 段
else     this.playGlassBell(t,this._noteFreq(bells[idx]),1.6,0.30,vel,pan);  // 常态
```
> `playBossPiano` 是通用方法，任何 boss 想要「糙亮钢琴 lead」都可调；当前仅 glacies rage 接入。

**冻结边界**：`playPiano` 泛音/低通/路由**零改动**（校验断言其仍 `[1,2,3.01,4.76]`、`freq×6+1800`、仅 fxBus+_wet）。

**校验**：`_boss_piano_check.js`（mock AudioContext 转写 playPiano+playBossPiano+dispatch）→ **17/17 PASS**（音色更亮/糙/重、4 总线路由、力度起伏、起音更快、playPiano 未被污染、rage→bossPiano·calm→glassBell、rage 网格 s0/6/8/10）；Read 工具核对方法 655–676 大括号配平。

---

### 3.15 段落编排控制器 `_arrSceneGlacies`（glacies 原型 · 2026-06-25）

> 来源：用户指出「音乐还是太单调」，根因是**音色 / 音轨数量 / 编排**——「原版其实并不存在一个一直循环的小节规律，一直是一相对稳定的节奏型 + 其他音轨的加花，然后在几个小节后做一个过渡；要去看哪些是 intro / buildup / drop，系统去分析、拆分音乐分段、综合分段的音轨去分析；**钢琴部分在这个例子中应该属于加花**」。
> 数据印证：`arr.py`（分段编排分析器，复用 `midi_mine.py`）对 Pulse Breaker 参考做共享小节网格分析——**Bass duty 0.78 + Drums 0.72 = backbone（骨架）**；**Keyboard duty 0.53 / cv 0.58 = 加花**（突发、且在终曲硬 drop 80-94 几乎缺席，密度 0.3）；同一时刻通常只有 2-4 stem 在响。证实「骨架常驻 + 加花来去 + 分段过渡」。
> 范围：**仅 glacies 原型**（opt-in，profile 加 `arrange:true`），先 A/B 再推广其余 7 boss。

**机制**：`_arrScene(bar,section)` 顶部按 `this.bossId` 分流——`==='glacies'` 走新方法 `_arrSceneGlacies`（返回闸门集 `{kick,bass,bells,shimmer,chime,vox}`），其余落回原 ignis 逻辑（闸门集 `{tom,bass,heat,modal,perc}`，两套不共键、互不污染）。活路径仍是 `_onBarStart`→`_arrScene`（每小节头由 sequencer 调用）；ignis 的 v4 `_secTick`/`_secGate` 草稿**无调用点=惰性死码**，不影响本控制器。

**闸门约定**：`kick 0关/1四踩`｜`bass 0关/1开`｜`bells 0加花离席 / 1疏(仅重拍锚) / 2密(全琶音)`｜`shimmer 0/1 高tom`｜`chime 0/1 冰锥`｜`vox 0/1 缝针(仅rage)`。**骨架=kick+bass 在所有有能量段恒为 1**；**加花=bells（玻璃铃 calm / `playBossPiano` rage）+ shimmer + chime + vox 按段进出**。

常态 32 小节 through-composed：

| 段 | bars(1-idx) | kick | bass | bells | shimmer | chime | 含义 |
|---|---|---|---|---|---|---|---|
| intro | 1–4 | 0 | 0 | 2 | 0 | 1 | 玻璃铃前景独奏，无鼓无 bass（参考 synth-only 起手） |
| build | 5–8 | 1 | 1 | **0** | 1 | 1 | 骨架单独确立、加花暂退（groove 先立住） |
| drop | 9–16 | 1 | 1 | 2 | 1 | 1 | 加花在 drop 揭幕、铃密 |
| breakdown | 17–20 | 0 | 0 | 2 | 0 | 1 | 鼓退、剥到玻璃铃（呼吸） |
| build2 | 21–24 | 1 | 1 | **0** | 1 | 1 | 骨架再立、加花退 |
| drop2 | 25–28 | 1 | 1 | 1 | 1 | 0 | 铃疏铺在 groove 上 |
| climax | 29–32 | 1 | 1 | **0** | 1 | 0 | 鼓主导收尾、**加花离席**（贴参考终曲硬 drop 钢琴退场） |

狂暴 16 小节（递增 build，但加花仍来去）：`build①(1-4) bells1 vox0`→`build②(5-8) bells2 vox1 chime让位`→`drop(9-12) 全开`→`vent(13-16) bells0`（加花离席让骨架+缝针透气，循环回 build 再砸=去「一直循环」）。

**接线**（各闸门的消费点，均防御式 `!ag||key===undefined||key>0` 回退原行为）：`kick`→四踩 kick 分支；`bass`→`_scheduleBass` 顶部 `bass===0 return`（与 ignis 共用）；`bells`→`glassBells` 分支（`bl===0` 跳过；`bl===1` 用稀疏 arp `rage{0,8}/calm{0,12}`；`bl===2` 全琶音）；`shimmer/chime/vox`→各自签名行。

**come-and-go 实测**：bells 常态 duty **0.63**（20/32 在场，落在参考 0.45–0.75 带内），在两个 build + climax 离席，在 intro/drop/breakdown 在场——与「钢琴=加花、峰段离席」一致。

**隔离**：其余 6 boss 无 `arrange`→`_arrGate=null`→所有消费点回退原并行；ignis `arrange:true` 但 `bossId!=='glacies'`→落回原 ignis 闸门，且无 glassBells/shimmer/chime/vox 签名，零影响。

**校验**：`glacies_sched_test.js`（内嵌 `_arrSceneGlacies` 原文逐字 + arp 选择器，纯逻辑跑 32+16 小节）→ **13/13 PASS**（骨架 24 段全 1、bells 来去含 0 与 2、duty 0.63、intro/build/drop/breakdown/climax 各段断言、bells 疏<密、rage vox/vent）；Read 工具核对 `_arrScene`/`_arrSceneGlacies`(485–517)、kick(613)、glassBells(1086–1099)、shimmer/chime/vox(1100–1102)、bass(999) 全部大括号配平。
> 注：本文件所在仓库挂载对该 HTML **整文件 bash/node 读会短读截断**（实测 stat 79466B 但流止于 mikro profile），故全文件 `node --check` 不可靠；改用「Read 工具核对配平 + 内嵌原文逻辑跑测」二段校验。

---

### 3.16 glacies 钢琴暗化：大三→小三 + 下行根音进行（2026-06-25）

**起因**：用户反馈「钢琴的和弦进行不太像紧张刺激的 boss 站」。诊断属实——原 glacies 钢琴是**静止的 D# 大三和弦琶音**：`rootCycle [0,0,0,0]`（无和声运动）+ `padChord [0,4,7,12]` + `bellDeg` = root/maj3/5th。明亮协和、无张力曲线，听感偏冰晶氛围而非战斗；且与 §3.14 实测参考（Pulse Breaker Keyboard = 弗里几亚·暗）方向相反（glacies 当初 §3.2 是**故意**设计成亮的）。

**改动（仅 glacies profile，对其余 7 boss 零影响）**：

- `bellDeg` calm `[36,40,43]→[36,39,43]`、rage `[48,52,55]→[48,51,55]`：maj3(4)→b3(3)，玻璃铃 / boss 钢琴琶音变**小三和弦**（root/b3/5th，**保留纯五度**=boss 重量，不削成阴郁小调）。
- `padChord [0,4,7,12]→[0,3,7,12]`：sustained pad 床同步转小调——否则 pad 的 maj3 会与 bells 的 b3 形成低频交叉撞响（cross-relation 糊低频）。
- `rootCycle [0,0,0,0]→[0,0,-2,-3]`：每 4 小节相位根音 **root→root→b7→b6 下行沉降**，补上「和声进行」（原为静止踏板）。由 `phrase=floor(bar/4)` 索引，转调经 `_retunePad/_retuneDrone` 平滑，bells/bass 经 `_noteFreq(_rootOffset+deg)` 自动跟随。与段落弧**巧合对齐**：drop(b8-15) 沉到 −2/−3、climax(b28-31) 落最低 −3=压迫顶点，intro/breakdown 回根=留白。

**为何「暗化」而非「换概念」**：glacies rage 的暗色张力本就散在别处（`stitchVox`=b2 缝针 stutter、`frostDrop` bass=b3 冰裂）；钢琴转小三后与它们统一，且保留纯五度 + 四踩骨架=仍是有重量的 boss，而非单纯阴郁氛围。

**校验**：`glacies_dark_test.js`（内嵌新值 + `_arrSceneGlacies` 原文逐字）→ **18/18 PASS**：① bells calm/rage 与 pad 均小调（pc `[0,3,7]`、含 b3 无 maj3、留五度）；② `rootCycle` 有运动·含负偏移下行·回根，drop/climax 沉到最低、intro/breakdown 在根；③ **回归**——段落门控（骨架 24 段全 1、bells 来去含 0/2、duty 0.63、intro/climax/rage vent）未被本次和声改动破坏。沿用「Read 工具核对 + 内嵌逻辑跑测」二段校验（整文件挂载读仍会短读截断）。

---

## 4. 下一步

1. **你**：把上面每个 Boss 的 Suno 风格串（常态 + 狂暴）拿去 Suno 生成，导出音频。
2. **我**：从你的成品里**提炼特征**——BPM/调式、lead 音色与动机、bass 密度与失真、节奏密度阶梯、FX(混响/延迟/泵)、签名元素，对齐回引擎可调旋钮。
3. **落地**：给 `music_engine.js` 加 `applyBossProfile(bossId)`，按提炼出的特征设 8 套 profile；在 `core.js` 把 `boss:spawned` 的 `bossId`（已携带）接到该方法。
4. **试听**：在 `dark_psy_engine_demo.html` 加 8-Boss 切换按钮，逐个 A/B 对比、微调，再用 Node 谐波校验。

> 注：本作引擎是**纯实时合成**（零采样），所以第 2 步不是直接塞 Suno 音频，而是把 Suno 跑出来的「风味」翻译成合成参数。Suno 成品用作**风格基准/参考**，引擎据此复刻。

