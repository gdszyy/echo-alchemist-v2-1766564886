# Boss MIDI 深挖索引 · Music / MIDI Deep-Mining Index

> 状态：v1 进行中 · 日期：2026-06-25
> 目的：把 `Audio_sample/Boss/` 里每个 Boss 的**分轨 MIDI** 逐条解析（不是只取中位 BPM+调式直方图），
> 挖出真实的句法 / 节奏栅格 / 配音 / 力度动态 / 段落结构，用来**丰富 `dark_psy_engine_demo.html` 引擎**，解决「音乐太单调」。
> 这是音乐类文档的**专用索引号段 `M-`**（M-01..M-08，每 Boss 一个稳定编号），与 `INDEX.md` 的 1–17 号设计/规格文档并列。

---

## 0. 为什么需要这一轮（与上一轮的区别）

| | 上一轮（Suno 分段实测，已写入 `boss_music_design.md §3`） | 本轮（MIDI 逐分轨深挖，本索引） |
|---|---|---|
| 数据粒度 | 中位 BPM、root、相对根音级直方图 top-N、calm/rage 两段密度 | **每分轨**的 16 分栅格 onset 分布、力度 min/med/max、音符时值分布、register、CC、按时间的段落切分 |
| 产出 | 8 套**简化** profile（bpm/root/padChord/bassFill/leadNotes/sig） | 每 Boss **新增声部 / 段落编排 / per-step 句法**，落到引擎可调层 |
| 局限 | 织体多靠「density 阶梯」近似，听感偏单调、8 个 boss 共用一套节奏骨架 | 让每个 boss 有**自己的节奏栅格与配器签名**，拉开辨识度 |

工具：`tools/midi_mine.py`（截断防护 SMF 解析器，零依赖）。所有 42 个分轨已通过完整性校验（0 截断，div=480，format-1）。

---

## 1. 索引号段 M-01..M-08（Boss ↔ MIDI ↔ 引擎 key）

| 号 | Boss | MIDI 文件前缀 | 分轨 | 引擎 key | 深挖结论位置 | 状态 |
|---|---|---|---|---|---|---|
| **M-01** | 熔炉守卫·伊格尼斯 ignis | `熔炉之门`（Demo1）+ `熔炉之门 (1)`（Demo2） | Bass / Drums / FX / Percussion / Synth | `ignis` | `boss_music_design.md` §3.1 → 「深挖 **v4** 段落状态机」（v2/v3 定循环已取代） | ✅ v4 段落状态机 state-driven section pools（intro/buildup/drop/groove/synthLead/breakdown 分段 + kick 段落门控 + bass↔synth 逐句轮换 + modalPool/bassColor through-composed 变体 + 战斗 steer 段落池 + slam/riser 过渡 + `playFurnaceKick`/`playEmberLead`；root F/148） |
| **M-02** | 霜晶缝合怪·格拉西斯 glacies | `Glacies 冰骨` | Backing Vocals / Bass / Drums / FX / Synth | `glacies` | §3.2 → 「深挖 v2」 | ✅ 完成（保 kick 叠高 tom shimmer+小三度玻璃铃〔暗化〕+b2 缝合 stutter+八度落差 bass） |
| **M-03** | 裂变母体·米克罗 mikro | `微裂母体` | Backing Vocals / Bass / Drums / FX / Guitar / Synth / Vocals | `mikro` | §3.3 → 「深挖 v2」 | ✅ 完成（八度分身散射+b5 加速颗粒机关枪+闷音吉他 chug） |
| **M-04** | 贪婪之渊·噬神者 devourer | `贪渊吞王` | Bass / Drums / FX / Synth | `devourer` | §3.4 → 「深挖 v2」 | ✅ 完成（半拍抽鼓+双八度 16 分 sub 雪崩+b2/b3 引力拖拽+高五度虚空颤音） |
| **M-05** | 翠绿共生体·维里迪斯 viridis | `Viridis 之茧` | Bass / Drums / FX / Percussion / Synth | `viridis` | §3.5 → 「深挖 v2」 | ✅ 完成（呼吸滤波 pad + 部落有机打击 + 狂暴反向退层出毒液 acid） |
| M-06 | 雷霆幻影·特斯拉 tesla | `特斯拉雷影` | Bass / Drums / FX / Percussion / Synth | `tesla` | §3.6 → 「深挖 v2」 | ✅ 完成 |
| M-07 | 混沌融合体·奇美拉 chimera | `混沌奇美拉` | Bass / Drums / FX / Percussion / Synth | `chimera` | §3.7 → 「深挖 v2」 | ✅ 完成 |
| M-08 | 永恒回声·奥罗波罗斯 ouroboros | `衔尾终环` | Bass / Drums / FX / Percussion / Synth / Woodwinds | `ouroboros` | §3.8 → 「深挖 v2」 | ✅ 完成（b2/b5/6 三音等权循环+echo 尾接衔尾+rage 木管顶腔；唯一 Woodwinds 分轨、133 最慢、222s 最长） |

> 本批（用户指定）：先做完 4 个 mini（M-01..M-04）再停下评审，然后做 4 个大 Boss（M-05..M-08）。

---

## 2. 每个 Boss 深挖结论的统一骨架（写入 §3.x 的「深挖 v2」小节）

为保证可比、可回灌引擎，每个 Boss 的深挖结论固定记这几块：

1. **完整性**：字节数 / 分轨数 / 0 截断校验（防 CLAUDE.md 短读）。
2. **全局**：BPM 区间+中位、root、拍号、总时长。
3. **逐分轨实测**：每条 stem 的 音数 / 密度(音/秒) / register / 力度(min·med·max) / 中位时值 / 相对根音级 top / **16 分栅格 onset 向量**（这是上一轮没有的、最能去单调的东西）。
4. **段落结构**：按时间二分（前=calm / 后=rage）的密度与音级变化，必要时更细分。
5. **→ 引擎丰富落点 v2**：明确列出**新增声部 / 改的句法 / 段落编排**，对应 `dark_psy_engine_demo.html` 的 profile 字段或新方法；标注「新增 vs 调参」。
6. **撞味提醒**：与同根/同速 Boss 的区分手段。

---

## 3. 引擎侧改动登记（dark_psy_engine_demo.html）

> 每完成一个 Boss 就在此登记本轮新增的「引擎能力」，便于回看哪些是 v2 深挖带来的。

| 能力 | 引擎位置 | 来源 Boss | 新增/调参 | 说明 |
|---|---|---|---|---|
| `playFurnaceTom(t,gain)` | 方法（playTom 后） | M-01 ignis | 新增声部 | 炉腔低 tom 四踩：sine135→62 + 三角腔体泛音 + 噪声皮膜；走 drumBus |
| `playHeat(t,gain)` | 方法 | M-01 ignis | 新增声部 | 定根 E 温压金属脉冲：正弦芯 + 窄带噪声叮 → fxBus 进混响 |
| `playModal(t,freq,dur,gain)` | 方法 | M-01 ignis | 新增声部 | 模态张力线：失谐双锯+方波芯 → 谐振带通 → drive → leadBus |
| `playWood(t,gain)` | 方法 | M-01 ignis | 新增声部 | 木鱼 accent：极短三角咔 → drumBus |
| `_drumMode='tribalTom'` ⚠ | 构造默认 + `_scheduleStep` | M-01 ignis | 新增句法 | tom 四踩取代 kick；rage 叠反拍 tom + 末小节 16 分连打。**v3 已改用 `furnaceKick`**（tribalTom 保留未删作回滚） |
| `_heatPulse` | 构造默认 + `_scheduleStep` | M-01 ignis | 新增句法 | 温压脉冲层：calm 拍头疏(s%8) → rage 每八分(s%2) 线性加密 |
| `_modalLine`(per-section) | 构造默认 + `setSection` + `_scheduleStep` | M-01 ignis | 段落编排 | calm 反拍 8 分密集 Phrygian；rage 坍缩回根（倒挂弧）。**v3 反转**：rage 改 root-pedal 对答 + downbeat 召唤音=前景加码 |
| `sig.woodAccent` ⚠ | `_scheduleSignatures` | M-01 ignis | 新增句法 | rage 木鱼点缀（s===6/14）。**v3 已改用 `sig.vibraslap`**（woodAccent 保留作回滚） |
| `_applyIntensity` 的 `needLead` 地板 | `_applyIntensity` | M-01 ignis | 调参（全局收益） | 签名/模态层在低强度保底可闻；threat/intensity 拖动不被压没 |
| boss 清除复位补 3 字段 | UI `$('boss').onchange` else | M-01 ignis | 调参 | 切回通用 darkpsy 时复位 `_drumMode/_heatPulse/_modalLine` |
| **— M-01 ignis v3 hybrid（偏 Demo2 · 2026-06-25）—** | | | | 触发：用户对 v2（仅基于 Demo1）仍不满意；并排对比两版 demo 后选「混合偏 Demo2」，保 Demo1 熔炉签名 + 找回 Demo2 四踩/滚动 bass/vibraslap + 反转狂暴弧为 build |
| `_drumMode='furnaceKick'` | 构造 + `_scheduleStep` | M-01 ignis v3 | 改句法 | 四踩 KICK 找回 Demo2 打桩 + 炉腔低 tom 退为反拍叠层(`s%4===2` 落两 kick 间)；rage 末拍 pickup + 偶拍 tom 连打=加码 |
| `bassFill:'furnaceRoll' / 'furnaceRollDrive'` | `_scheduleBass` | M-01 ignis v3 | 改句法 | 滚动 root+5th：calm `1.1.\|1.1.\|1.1.\|5.5.`(8/bar)；rage 直 8 分 + 16 分填充 + 八度顶(16/bar)=build |
| `playVibraslap(t,gain)` | 方法（playWood 后） | M-01 ignis v3 | 新增声部 | vibraslap 嗡鼓：非谐金属舌叮当 + 带通噪声「braaap」rattle → hatBus；对应 Demo2 Vibraslap×360 |
| `sig.vibraslap` | `_scheduleSignatures` | M-01 ignis v3 | 改句法 | calm 反拍买路(`s%4===2`) → rage 8 分加密(`s%2===0`)=build；鼓全退段跟 `_arrGate` 静默 |
| `_arrScene` rage 反转 | `_arrScene` | M-01 ignis v3 | 改段落 | 旧版 climax 砍旋律(`modal:0`) → 新版 modal 恒 ≥1、峰值 2，tom/bass/vibraslap 全程加密=喷发即 build |
| root E→F(43.65) / bpm 146→148(rage 152) / padChord `[0,1,7,12]→[0,2,7,11]` | `_bossProfiles().ignis` | M-01 ignis v3 | 调参 | 以 Demo2 为准：F 根、稍快、和声床换 root+2+5+maj7 |
| **— M-01 ignis v4 段落状态机（state-driven section pools · 2026-06-25 · 取代 v3 定循环）—** | | | | 触发：用户指出「原版并不存在一直循环的小节规律——是稳定节奏型+加花，几小节后过渡」，要求系统拆分 intro/buildup/drop 分段后逐段分析；并选定「状态驱动段落池」。bass 与 synth 轮换成变体 |
| `_secTick / _secGate / _secBegin` + `_ignisSecDefs` + `_secPools` | 段落机核心（`_onBarStart` 仅 ignis 分派） | M-01 ignis v4 | 改段落（核心） | 每段 8 bar 命名段落（intro/buildup/drop/groove/synthLead/breakdown），逐 bar 推进、段尾按池抽下一段，产出 `_arrGate{tom,bass,heat,modal,perc,lead}` 供 `_scheduleStep/_scheduleBass` 消费——替代 v3 的 `bar%16/%32` 定循环 |
| `_secCombat`('calm'/'rage') 选**段落池**而非直接 gate | `setSection` steer + `_secTick` | M-01 ignis v4 | 改段落 | 战斗态只换池：calm 池 `[intro,buildup,groove,synthLead,breakdown,groove]`；rage 池 `[drop,synthLead,drop,groove]`。段落 `energy` 再派生 `this.section`，原 rage 加花自动复用 |
| kick 段落门控（`_arrGate.tom`） | `_scheduleStep`（`playFurnaceKick`） | M-01 ignis v4 | 改句法 | kick 只在 groove/synthLead/drop 段四踩；intro/buildup/breakdown 段熄火——实现「稳定节奏型 vs 加花/留白」对比，非全程打桩 |
| bass↔synth 逐句轮换（groove `rotate`） | `_scheduleBass` + ember 消费 | M-01 ignis v4 | 改段落（变体） | groove 段奇句 modal=2/bass=1（synth 前景）↔偶句 modal=0/bass=2（bass 驱动），每乐句对调前景=用户要的「bass 轮换跟合成使用形成变体」 |
| `modalPool`(4 句旋律) + `_bassColor`(末拍音程轮换) | `_phraseGlobal` 驱动 per-phrase | M-01 ignis v4 | 改段落（through-composed） | modalPool 每乐句旋转选旋律；`_bassColor` 末拍音程轮换 `[7,5,10,3]`(5th/4th/b7/b3)=持续展开不复读 |
| `playFurnaceKick(t)` | 方法（playKick 后） | M-01 ignis v4 | 新增声部 | 更深熔炉打桩 kick：sine sub 180→38 + triangle 炉腔 96→50 + square 锤击 1500→620，过 soft-clip → drumBus |
| `playEmberLead(t,freq,dur,gain)` | 方法（playModal 后） | M-01 ignis v4 | 新增声部 | 前景余烬旋律：saw+triangle 八度 + 5.5Hz vibrato LFO + lowpass 扫频 → leadBus + `_wet` 混响尾；intro/synthLead/breakdown 段唱主题 |
| 过渡 slam / riser / downlifter | `setSection` + `_secTick` 段尾 | M-01 ignis v4 | 改段落（过渡） | 自然段尾末 bar 上 riser；战斗强切在乐句边界（`_bar%4===0`）跳转——rage slam→drop(impact+`_sampleCrash`)，calm pull→breakdown(downlifter)=「几小节后做过渡」 |
| `_arrScene`(ignis) 改派发 | `_onBarStart`（`bossId==='ignis'→_secTick`） | M-01 ignis v4 | 改架构 | ignis 走段落机；glacies 仍走 `_arrScene→_arrSceneGlacies`；其余 boss `_arrGate=null`——隔离不破坏既有编排路径 |
| `playGlassBell(t,freq,dur,gain)` | 方法（playModal 后） | M-02 glacies | 新增声部 | 大三度持续冰晶铃：非谐泛音串 `[1,2.76,5.4,8.93]` → fxBus 进混响 |
| `playStitch(t,gain)` | 方法 | M-02 glacies | 新增声部 | 定根 b2(`_noteFreq(25)`) 方波过 formant 带通 → leadBus，机械「缝针」 |
| `playChime(t,gain)` | 方法 | M-02 glacies | 新增声部 | 冰锥 chime：三角 2640→2200Hz 短下扫 → hatBus |
| `sig.glassBells`(升级→去警铃) | `_scheduleSignatures` | M-02 glacies | 改句法 | 走 `playGlassBell`+`bellDeg`；**去警铃**：实测 Synth 重拍锚(calm s0/s4/s12 留拍3 / rage s0/s6/s10)，连续铃走 root/maj3/5th 三和弦琶音、每乐句旋转换位，不再单音每反拍连敲 |
| `sig.tomShimmer` | `_scheduleSignatures` | M-02 glacies | 新增句法 | **保留四踩 kick**，其上叠 HiTom shimmer（calm s%4===3 / rage s%2===1） |
| `sig.chimeOff` | `_scheduleSignatures` | M-02 glacies | 新增句法 | 反拍冰锥叮（s%4===1） |
| `sig.stitchVox` | `_scheduleSignatures` | M-02 glacies | 新增句法 | 狂暴 s∈{6,12} 各 `stitchN` 连 b2 缝合 stutter |
| `bassFill:'frostMid'/'frostDrop'` | `_scheduleBass` | M-02 glacies | 新增句法 | bass 八度落差：calm 中音 pedal `_noteFreq(12)` → rage 跌低八度 `_noteFreq(0)`+b3 冰裂 |
| `playGuitarChug(t,deg,gain)` | 方法（playChime 后） | M-03 mikro | 新增声部 | 棕榈闷音吉他：锯齿过低通 + 噪声拨片 → leadBus（唯一吉他音色） |
| `_fissionStutter(t,freq,base,span)` | 方法（_vocalChop 后） | M-03 mikro | 新增声部 | b5 加速颗粒机关枪：grain 数随 intensity 翻倍、间隔渐缩=越分越快 |
| `sig.octaveScatter` | `_scheduleSignatures` | M-03 mikro | 新增句法 | 同一动机同时炸 `note/note±12`=克隆到低/中/高八度（reg2/3/6） |
| `sig.fissionStutter`(去警铃) | `_scheduleSignatures` | M-03 mikro | 改句法 | 狂暴增殖颗粒串；**去警铃**：由每 8 分爆改为只在 2 小节乐句切分点爆（偶小节 s6 / 奇小节 s6+s14）=留白呼吸，密度砍 >70% |
| `sig.guitarChug`(去警铃) | `_scheduleSignatures` | M-03 mikro | 改句法 | 实测 Guitar 仅 11 个稀疏根音；**去警铃**：由满屏 16 分 chug 改为拍点 punctuation（s0/s8＋奇小节尾 s14） |
| `playVoidFifth(t,dur,gain)` | 方法（playGuitarChug 后） | M-04 devourer | 新增声部 | 高音区纯五度虚空泛音：失谐双正弦(×1.006) 短颤 → fxBus 进混响 |
| `bassFill:'abyss'` | `_scheduleBass` | M-04 devourer | 新增句法 | 常态 8 分巨 sub pedal（`s%2===0` 锁根 + `I>0.5` 补 b 拍） |
| `bassFill:'abyssRoll'` | `_scheduleBass` | M-04 devourer | 新增句法 | 狂暴双八度 16 分 sub 雪崩 + b2(s7)/b3(s11) 引力拖拽 + `s%4===0` 叠中八度 |
| `sig.voidTremolo` | `_scheduleSignatures` | M-04 devourer | 新增句法 | 每步 `playVoidFifth`（s%2 强长 / 余拍弱短）= 五度 8 分微颤铺底 |
| `profile.kickHalf:true` | profile（devourer） | M-04 devourer | 调参 | 半拍稀疏 kick（仅 s0/s8），把鼓让位给 bass 深渊（「抽鼓」实测） |
| `playBreathPad(t,freq,dur,gain)` | 方法（playVoidFifth 后） | M-05 viridis | 新增声部 | 呼吸 pad：失谐双锯→低通，0.6Hz 慢 LFO 调 cutoff = 活体膨胀收缩→droneBus |
| `playSquelch(t,freq,dur,gain)` | 方法 | M-05 viridis | 新增声部 | 毒液 acid：锯齿过 Q=14 共振低通 + cutoff 快速下扫 = 303「yow」→leadBus |
| `playWoodblock(t,gain)` | 方法 | M-05 viridis | 新增声部 | 有机木鱼/三角铁 accent：极短三角高音咔→drumBus（还原 OTri/HiWdblk/MuConga） |
| `bassFill:'sporeDrone'` | `_scheduleBass` | M-05 viridis | 新增句法 | F 低根切分 drone（重音 s0/s4/s6/s9/s14）+ rage b7 下沉腐坏邻音 |
| `sig.breathDrone` | `_scheduleSignatures` | M-05 viridis | 新增句法（段落反转） | 呼吸 pad：calm 厚而双八度 / rage 变薄+更失谐（drone 狂暴退场，与众反向） |
| `sig.venomSquelch` | `_scheduleSignatures` | M-05 viridis | 新增句法 | 仅 rage 触发毒液 acid（deg2=G 慢扫）= 被催熟的毒 |
| `sig.organicPerc` | `_scheduleSignatures` | M-05 viridis | 新增句法 | 部落律动：沙锤 8 分底色 + 木鱼/三角散点（rage 加密），取代电子四踩 |
| `playZap(t,freq,gain)` | 方法（playWoodblock 后） | M-06 tesla | 新增声部 | 放电 stab：方+锯失谐高频，pitch 快速下扎 + 带通噪声「啪」瞬态→leadBus（FX deg2=G 规律脉冲） |
| `playArcCrackle(t,gain)` | 方法 | M-06 tesla | 新增声部 | 电弧静电噼啪：高通(4.2k)噪声切 4 颗粒、幅度抖动=电火花残影→hatBus（仅 rage） |
| `sig.teslaArc` | `_scheduleSignatures` | M-06 tesla | 新增句法 | 放电脉冲：拍头(s%4===0)强 zap + 拍中(s%4===2)弱 ghost；rage 反拍塞电弧噼啪 |
| `sig.teslaRoll` | `_scheduleSignatures` | M-06 tesla | 新增句法（仅 rage） | 滚动双 tom 残影：offbeat hi/lo 交替 + 反拍(s%4===3)再叠 lo tom=电压击穿 |
| `playChaosDrift(t,freq,dur,gain,drift)` | 方法（playArcCrackle 后） | M-07 chimera | 新增声部 | 双根失稳 howl：双锯在 E↔D# 间 pitch 漂移 + detune LFO 摇摆=身份崩塌→leadBus |
| `drumMode:'chaosTom'` | `_scheduleStep` 鼓分支 | M-07 chimera | 新增鼓机模式 | HiTom2 主导滚动高 tom 取代四踩 kick（实测 Kick:1/HiTom2:126）；rage 叠反拍低 tom + 满 16 分滚 |
| `sig.chaosFlux` | `_scheduleSignatures` | M-07 chimera | 新增句法 | 每小节头 E↔D# 漂移 howl；rage 半拍再来一记从 maj7(D#)起=导音夺权 |
| `driftCycle` / `sig.burstImpact`（沿用） | profile / `_onBarStart` | M-07 chimera | 保留复用 | 逐相位根音 E↔D# 漂移 + rage 每 6 小节 impact() 爆裂（受击全场爆炸） |
| `playEchoCry(t,freq,dur,gain,echoT)` | 方法（playChaosDrift 后） | M-08 ouroboros | 新增声部 | 三音循环动机带回声交接：锯波过 bandpass 扫频 + 按 echoT 自身复触一次=一句尾接下一句头(衔尾)→fxBus |
| `playReed(t,freq,dur,gain,glideTo)` | 方法（playEchoCry 后） | M-08 ouroboros | 新增声部（+去割裂 glide） | 木管顶腔：triangle+sine 八度叠 + 5.5Hz vibrato + bandpass 慢起慢落=rage 木管哀鸣（唯一 Woodwinds 分轨）→leadBus；`glideTo` 非空时尾部(0.85)滑奏到和声床内音=叹息解决 |
| `sig.fxCycle`（playEchoCry→去警铃） | `_scheduleSignatures` | M-08 ouroboros | 改造句法 | 走 playEchoCry 循环三音等权轮回；**去警铃**：音高改回实测 `_fxCycleDeg=[0,5,8]`(root/4th/b6，非原 b2/b5/6) + rage 改三音叹句 s0/s6/s10 留拍、拉长 1.3s 持续=回声叠响 |
| `sig.windCry` | `_scheduleSignatures` | M-08 ouroboros | 新增句法（+去割裂重栅格） | rage 专属木管长音；为去割裂由 s0/s10 移到 **s0/s8（kick 位上格）**，并带 glide：s0 b2→root、s8 maj7→maj6 落在 pad 床内音 |
| `padBus` + `_startPad`/`_retunePad`/`_stopPad` | bus（droneBus 后）+ 方法（_stopDrone 后）+ start/stop/`_onBarStart`/`setSection` | 去割裂（全 8 Boss） | 新增连接层 | 贯穿全程的五度叠和声床 `degs=[12,19,24,31]`（mode-neutral，只 root/5th）→ pumpBus(随 kick 泵)+wet；lowpass820+0.05Hz LFO 呼吸、3.5s 淡入；rage 0.115/常态 0.08，随 root 平滑移调=给所有签名可融的中频混响场 |

> **去割裂修订（2026-06-25）**：试听反馈「独有签名很割裂」。根因＝中频空（大 Boss 多 `allowLead/allowOoh:false`、drone 仅 sub），签名孤立单发。修法＝① 加 `padBus` 和声胶水床；② windCry 重上格 + reed 叹息 glide 融进床。详见 `boss_music_design.md §3.10`。校验：`_cohesion_check.js` 43/43 + 三接缝括号全平衡。

> **去警铃修订（2026-06-25）**：试听反馈「玻璃铃像铁道口警铃；裂变母体/永恒回声狂暴同病」。根因＝签名在死格点上以单一或不谐音高连发，相对原 Suno MIDI 失真。修法＝重挖 onset grid 后 glassBells 改重拍三和弦琶音、fissionStutter+guitarChug 乐句化留白、fxCycle 音高回 root/4th/b6 + 三音叹句拉长持续。详见 `boss_music_design.md §3.11`。校验：`_alarm_fix_check.js` 13/13 + 全文括号平衡（{}283/()1387/[]81）+ `_scheduleSignatures` brace-walk 归零。

> **去警铃·第二刀＝音色+混音（2026-06-25）**：试听反馈「问题减少了但还是有问题——是不是音色和混音效果器的差距」。根因＝剩余警铃感在**合成音色与 FX 路由**，非音符。修法＝① `playGlassBell` 删 2.76 管钟泛音换近谐玻璃串＋逐击力度/微失谐/声像＋圆顶低通＋额外 `_wet` 混响尾；② `_fissionStutter` 颗粒封顶 7＋逐颗下行半音级联（去同音墙）；③ `playEchoCry` 共振 Q 8→3＋八度下身暖芯＋软起音＋逐击力度，路由加 `delaySend`+`_wet`（真延迟/混响尾）去克拉克松。详见 `boss_music_design.md §3.12`。校验：`_timbre_fix_check.js` 18/18 + node 解析全部被改方法转写（花括号配平）；注：Bash 挂载视图对本文件持续截断尾部，全文配平以**文件工具 Read** 为权威（见 `CLAUDE.md §4`）。

> **Boss 钢琴变体 `playBossPiano`（2026-06-25）**：§3.13 把去警铃后的玻璃铃存为冻结钢琴 `playPiano`；用户嫌纯钢琴用于 boss「呆」，走 Suno 参考流程并回传 `Pulse Breaker MIDI.zip`。深挖 Keyboard 轨＝**高音区(八度5-7)·弗里几亚属(root/b2/M3/4/5/b6/b7,重 root·4th·b6)·八分反拍切分(s0/6/8/10)·力度51-95·四分延音**，低盘交给 bass(八分直推)+drums(四踩)。据此另起 `playBossPiano`：开亮低通+多一阶高泛音+方波咬边+低八度 body+锤击快起音+`fxBus`/`delaySend`/`_wet`/`pumpBus` 四路（含 kick 侧链泵）；dispatch rage arp 加拍3锚 s8，**rage→bossPiano / calm→glassBell**。`playPiano` 冻结快照零改动。详见 `boss_music_design.md §3.14`。校验：`_boss_piano_check.js` 17/17 + Read 核对方法 655–676 配平。

> **段落编排控制器 `_arrSceneGlacies`（glacies 原型 · 2026-06-25）**：用户指出单调根因＝**音色/音轨数量/编排**，「原版不存在一直循环的小节，是稳定节奏型+加花，几小节一过渡，分 intro/buildup/drop；钢琴=加花」。用 `arr.py`（分段分析器）证实 Pulse Breaker：**Bass 0.78+Drums 0.72=骨架、Keyboard 0.53/cv0.58=加花（终曲硬 drop 缺席）**。据此给 **glacies（opt-in `arrange:true`）** 加 through-composed 段落机：`_arrScene` 按 `bossId` 分流到 `_arrSceneGlacies`，返回闸门 `{kick,bass,bells,shimmer,chime,vox}`——**骨架 kick+bass 有能量段恒 1**，**加花(玻璃铃/`playBossPiano`/shimmer/chime/vox) 按段进出**（calm intro/breakdown 剥到铃、build/climax 加花离席；rage 峰前 vent）。bells duty 0.63（来去）。活路径 `_onBarStart`→`_arrScene`；ignis v4 `_secTick` 无调用点=惰性死码；其余 6 boss `_arrGate=null` 回退原行为。详见 `boss_music_design.md §3.15`。校验：`glacies_sched_test.js` 13/13 + Read 核对 485–517/613/999/1086–1102 配平（全文件挂载短读，配平以 Read 为权威）。

> **glacies 钢琴暗化＝大三→小三 + 下行根音进行（2026-06-25）**：用户追问「钢琴和弦进行不像紧张刺激的 boss 站」。诊断属实——原 glacies 钢琴＝**静止 D# 大三和弦琶音**（`rootCycle [0,0,0,0]` 无进行 ＋ `padChord [0,4,7,12]` ＋ `bellDeg` root/maj3/5th），明亮协和、无张力曲线，且与 §3.14 参考（弗里几亚·暗）反向。修法（**仅 glacies profile，对其余 7 boss 零影响**）：`bellDeg` calm `[36,40,43]→[36,39,43]` / rage `[48,52,55]→[48,51,55]`（maj3→b3，**保留纯五度**=boss 重量）；`padChord→[0,3,7,12]`（pad 床同步小调，避免 maj3/b3 低频撞响）；`rootCycle→[0,0,-2,-3]`（root→root→b7→b6 下行沉降补「和声进行」，drop/climax 沉到最低=压迫、intro/breakdown 回根；转调经 `_retunePad/_retuneDrone` 平滑、bells/bass 经 `_noteFreq` 跟随）。暗色与既有 `stitchVox` b2 缝针 / `frostDrop` b3 冰裂统一。详见 `boss_music_design.md §3.16`。校验：`glacies_dark_test.js` **18/18**（bells/pad 均小调 pc `[0,3,7]`·含 b3 无 maj3·留五度；`rootCycle` 下行·回根；段落门控回归未被破坏）。

---

## 4. 复现方式

```bash
# 单 Boss 全分轨深挖（root 可手动锁定，避免鼓轨干扰自动判根）
python3 tools/midi_mine.py "Audio_sample/Boss/熔炉之门 (Bass).mid" \
  "Audio_sample/Boss/熔炉之门 (Synth).mid" ... --root=E
```

输出 JSON：每分轨含 `grid`(16 分 onset 向量)、`deg`(相对根音级)、`calm`/`rage` 分段、`vmin/vmed/vmax`、`meddur`、`reg`。
