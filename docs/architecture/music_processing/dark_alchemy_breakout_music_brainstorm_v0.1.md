# 暗黑炼金打砖块音乐脑暴 v0.1

> 日期：2026-06-23
> 主题句：破碎物质被重新炼成节奏。

## 1. 核心想象

球不是普通弹珠，而是一枚“节拍坩埚核心”。每次反弹都在把房间里的废料、碎晶、毒雾、火渣重新压成可听的秩序。

房间开始时音乐像残缺机器：低频短脉冲、漏气噪声、远处金属震动。随着玩家击碎砖块、收集遗物、建立连击，音乐逐步被“炼成”：

1. 先有脉搏。
2. 再有律动。
3. 再有和声。
4. 最后有爆发乐句。

失败或濒死时，音乐不是单纯变小，而是退化：高频先碎掉，中频和声消失，只剩低频和噪声，像世界重新被静电吞回去。

## 2. 声音身份

### 普通房间

- BPM：126 或 128。
- 调式：Phrygian / Aeolian。
- 风格：dark techno + alchemy machine。
- 低频：短 kick、sub thump、filtered rumble。
- 中频：m7、sus2、sus4、dim stab，像炼金阵短暂点亮。
- 高频：metal hat、glass tick、granular sparkle。
- FX：短 reverse、低噪 sweep、小 impact。

### 高压房

- BPM：132 到 140。
- 风格：trap/phonk 或 techno 加速。
- 低频更干、更短，避免挡住碰撞反馈。
- 高频通过 hat roll 或 arp 增加“球越来越不受控”的感觉。

### Boss 房

- BPM：140 half-time。
- 调式：Harmonic minor，偶尔 dim/Locrian。
- 风格：dubstep half-time + ritual industrial。
- Boss 阶段切换不是换歌，而是切 section：
  - Phase 1：sub pulse + 稀疏金属打击。
  - Phase 2：wobble bass + 中频 stab。
  - Phase 3：全频 Drop/Frenzy，但低频仍给碰撞留空间。

## 3. 事件到乐句

| 游戏事件 | 音乐反应 |
|---|---|
| 挡板命中 | kick/sub thump，决定低频落点 |
| 墙体命中 | 极短 metal tick，音量小、可限流 |
| 普通砖破 | 中频 stab 或 glass hit |
| 硬砖受击 | dull thunk + 暗噪瞬态 |
| 晶体砖破 | granular sparkle + 上行短音 |
| 毒砖破 | filtered noise + 下行 pitch bend |
| 火砖破 | crackle burst + 短 impact |
| 金币/资源 | 调内短 ping，随连击升音级 |
| 遗物出现 | reverse shimmer + 稳定主音收束 |
| 连击里程碑 | arp run / hat roll / acid fill |
| 多球 | high lane 打开，自动补密音 |
| 危险/低血 | 滤波收窄、和声减薄、低频心跳 |
| 清房 | resolving phrase，短尾巴，别盖 UI |

## 3.1 音轨状态脑暴

音乐可以按“固定层 / 变动层 / 效果器层”组织：

- 固定层：主脉冲、暗色 drone、房间根音。无论暂停还是低强度都保留。
- 阶段变动层：房间推进、连击、多球、Boss 前摇分别打开不同 lane。
- 效果器层：滤波、sidechain、delay、短混响、失真、reverse，随阶段和强度改变。

暂停不是把音乐全关，而是进入 Pause Veil：

- 关闭 hats、acid、roll、riser 等运动层。
- 保留低频 pulse 和 root drone。
- 加低通、暗房间混响、短 delay。
- 可以加入很轻的磁带失速或炼金液体 bubbling。

战斗激烈程度可以这样听出来：

- 低强度：固定层 + 稀疏低频，房间像还没醒。
- 中强度：mid stab 和 hats 进入，砖块破裂开始像乐句。
- 高强度：high roll、acid、riser 打开，多球和连击变成密音。
- 爆发：全频 drop，但碰撞 one-shot 仍保持短尾巴。

和弦/Pad 可以成为这套状态的情绪导演：

- 低强度或暂停：`i5 drone`，只保留根音与五度，像炼金阵在待机。
- 普通战斗：`i - bII - i - VII`，暗色循环但不惊慌。
- 高压/多球：`i - bII - i - V7`，V7 把球速和危险感往前推。
- Boss：`i - bII - V7 - i`，让阶段变化有仪式性的“问答”。
- Frenzy/濒死：`i - bII - dim - V7`，用 dim 和未解决感制造压迫。

Boss/关卡不直接决定情绪，而是决定同一条情绪进行的风味：Crucible 用金属 saw pad，Venom 用 bandpass/slime pad，Aether 用 glass/sine pad，Gothic 用 choir/organ-like pad。

## 4. Biome 方向

### 坩埚地窖

- 色彩：黑铁、暗金、煤烟。
- 音乐：Phrygian techno。
- 关键词：机器循环、炉膛脉搏、金属帽音。
- 代表砖：铁砖、煤渣砖、过热砖。

### 毒晶温室

- 色彩：绿晶、紫雾、腐蚀玻璃。
- 音乐：Aeolian trap/phonk。
- 关键词：808 drone、玻璃碎光、带毒的慢摆。
- 代表砖：毒砖、孢子砖、晶体砖。

### 以太锻炉

- 色彩：蓝白电弧、银灰符文、失控核心。
- 音乐：DnB / fast techno。
- 关键词：多球、狂暴、快速 arp、过载滤波。
- 代表砖：电砖、折射砖、传送砖。

### 古堡反应釜

- 色彩：深红、旧金、蜡封符号。
- 音乐：Harmonic minor half-time。
- 关键词：哥特戏剧性、Boss 仪式、重低频宣判。
- 代表砖：Boss 护盾、血晶砖、诅咒砖。

### 夜场炼金阵

- 色彩：黑红、紫外荧光、几何法阵、深夜仪式。
- 音乐：Dark psytrance / psytechno，约 150 BPM。
- 关键词：rolling bass、FM psy lead、acid squelch、轻失真、reverb throw。
- 代表砖：混乱砖、折返砖、幻觉砖、Boss 弱点窗。
- 用法：高强度时把高音 lead 轻微失真并送入暗房间 reverb；低强度只保留 pad/filter movement，避免一开始就过满。

## 5. 竖切优先级

第一轮只做“能听出系统”的最小闭环：

1. 固定 BPM 128，Phrygian。
2. 一条 8 小节 groove，拆 low/mid/high/fx。
3. intensity 0-5 可切层。
4. 碰撞事件先不逐个作曲，只做聚合：
   - paddle 直接低频。
   - wall 限流高频。
   - brick break 量化到下一 16 分或下一拍。
   - combo 里程碑触发 phrase。
5. Boss 先做 half-time 变体，不做完整新曲。

## 5.1 Lead 与 Phrase 变体补充

当前方向里 lead 类音色需要补齐，但 dark psy 的 lead 不宜做成长旋律，更适合做“音色手势”：

- Squelch：酸性短叫声，围绕根音半音摆动。
- Laser：短促上扫，适合危险提示和多球高压。
- Throat：formant/vowel 感，适合毒性与怪异 Boss。
- Scrape：金属刮擦式高频，适合暗黑炼金材质。

每 4 或 8 小节生成一个新 phrase variation，像肉鸽地图抽下一个地块：

- 抽一个 lead pattern。
- 抽一个 passing-note 偏移。
- 决定是否打开一条新高频/FX lane。
- 在最后一小节生成 transition。
- 下一小节第一拍用 impact 或 pad voicing change 接住。

过渡可以先做三种：

- Riser + lead pickup：新阶段前半小节抬起。
- Delay/reverb throw：上一句最后一个音拖进下一句。
- Kick removal：最后半小节少一个低频落点，让下一拍更重。

## 6. 可以先问的问题

- 球的速度是否应该永远自由，还是在关键段落轻微吸附到音乐网格？
- 高速多球时，碰撞反馈是“逐个听见”，还是“整体变成高频质感”？
- 遗物/符文是否各自有 leitmotif，还是只用元素音色区分？
- Boss 阶段切换是否要反向驱动玩法节奏，比如强制进入 4 小节危险窗口？
- 玩家成长是统一提高 `global intensity`，还是按低/中/高频分路线成长？
