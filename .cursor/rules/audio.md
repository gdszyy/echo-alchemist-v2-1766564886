---
description: "音频系统的架构约定、延迟初始化机制、音效方法全览与调用分布"
globs: ["src/audio.js", "src/core.js"]
---

## Tone Parameter Safety

- `SoundManager.playTone(freq, type, vol, dur)` must sanitize numeric inputs before passing them to Web Audio `AudioParam.setValueAtTime()` or ramp APIs.
- Gameplay callers can still pass derived values, but `freq`, `vol`, and `dur` must become finite fallback values inside `playTone` so a malformed recipe cannot crash the audio graph.

## Local sample preview layer

- `SoundManager` may preload local wav samples from `assets/audio-local/sfx/` and prefer them inside existing public methods such as `playShoot`, `playHit`, `playEnemyHit`, `playLightning`, `playExplosion`, `playPowerup`, `playEffect('split'|'shatter')`, `playMagic`, `playSlash`, and `playCollect`.
- Public callers must keep using the `audio` proxy methods. Do not create `Audio`, `AudioContext`, or `fetch` calls in gameplay/UI modules.
- Local sample files are a preview-only asset layer. `Audio_sample/` and `assets/audio-local/` must stay ignored by git, and sample files must not be uploaded to the remote repository unless the user explicitly approves an asset licensing/import task.
- Every sample playback path must keep synthesized Web Audio fallback behavior. If fetch/decode fails or a sample has not loaded yet, the old synthesized sound should still play.
- High-frequency sounds must keep debounce/cooldown protection through `lastPlayTime` or `_playSample(..., { cooldown })`.
- Cinematic SFX should be authored as layered recipes rather than one-shot replacements: combine a body/sub layer, a recognizable core sample, high-frequency detail/noise, a short transient, and a tail/reverb layer where useful.
- Use `sampleGroups` with round-robin and small random pitch/volume ranges for repeated combat sounds. Avoid one fixed wav for high-frequency triggers.
- Keep the public API stable; gameplay code should still call `playShoot`, `playHit`, `playEffect`, etc. Layering belongs inside `SoundManager`.
# 音频系统规范 (Audio System)

## 1. 架构约定

- **核心类**: `SoundManager`（`src/audio.js`）负责管理所有音效的播放、加载和状态，基于 Web Audio API 实现。
- **音频代理**: 模块导出的 `audio` 是一个 `Proxy` 对象，在 `SoundManager` 未初始化时所有方法调用静默失败，保证安全。
- **事件驱动**: 依赖 `EventBus` 进行解耦，避免与其他模块（如 `core.js`）产生循环依赖。
- **信号链路**: 所有音频节点 → `masterGain`（主音量 0.3）→ `DynamicsCompressor`（防爆音）→ 扬声器。

## 2. 延迟初始化机制

- **浏览器策略限制**: 现代浏览器禁止在用户交互前自动播放音频（Autoplay Policy）。
- **初始化链路**: `core.js` 捕获首次用户交互 → `new SoundManager()` → `_setAudioInstance(instance)` → 所有 `import { audio }` 的模块自动生效。
- **最佳实践**:
  - 不要在全局作用域直接实例化 `AudioContext`。
  - 播放声音前无需手动判断初始化状态，代理层已处理静默失败。
  - 需要确保 `AudioContext` 处于 running 状态时，调用 `audio.resume()`。

## 3. 音效方法全览（18个）

### 3.1 基础与控制

| 方法 | 签名 | 功能 | 备注 |
|------|------|------|------|
| `constructor` | `constructor()` | 初始化 AudioContext、masterGain、Compressor、noiseBuffer | 由 core.js 在首次交互后调用 |
| `createNoiseBuffer` | `createNoiseBuffer()` | 生成 2 秒白噪声缓冲区 | 内部使用，供 playLightning/playExplosion/playEffect('shatter') 复用 |
| `createRollingSound` | `createRollingSound()` | 创建弹球滚动持续音（噪声+低通滤波，速度驱动） | 返回含 `update(speed)` 和 `stop()` 的控制对象；必须在弹球销毁时调用 `.stop()` |
| `toggleMute` | `toggleMute()` | 切换静音状态，返回当前静音布尔值 | 通过 masterGain 控制全局音量 |
| `resume` | `resume()` | 恢复被浏览器暂停的 AudioContext | 在 game_phase.js 的游戏开始事件中调用 |
| `playTone` | `playTone(freq, type='sine', vol=0.3, dur=0.2)` | 通用基础音调 | 被 playCollect 等方法复用，也直接用于 UI 反馈 |

### 3.2 战斗音效

| 方法 | 签名 | 功能 | 防抖 | 调用次数 |
|------|------|------|------|----------|
| `playHit` | `playHit(type='normal', speed=5)` | 弹球打击音，类型：normal/bounce/cryo/pyro | — | 3 |
| `playShoot` | `playShoot()` | 射击音，square 波 600→200Hz | — | 2 |
| `playEnemyHit` | `playEnemyHit(hitType='normal')` | 敌人受击音，类型：normal/cryo/pyro/lightning | ✅ 50ms | 1 |
| `playLightning` | `playLightning()` | 闪电音效，白噪声+square 3000→200Hz | ✅ 80ms | 5 |
| `playExplosion` | `playExplosion()` | 爆炸音效，噪声+低通滤波+sine 低频冲击 | — | 5 |
| `playSlash` | `playSlash()` | 斩击音效，sawtooth+triangle 双振荡器叠加 | ✅ 60ms | 5 |

### 3.3 状态与特效音

| 方法 | 签名 | 功能 | 防抖 | 调用次数 |
|------|------|------|------|----------|
| `playPowerup` | `playPowerup(pitch=1)` | 能量提升音，sine 频率上扬，pitch 控制音调高低 | — | 20 |
| `playEffect` | `playEffect(type)` | 特殊效果音分发器，内含 6 种子类型（见下表） | — | 20 |
| `playMagic` | `playMagic()` | 魔法音效，sine 800→1200→600Hz 波动 | — | 2 |
| `playCollect` | `playCollect()` | 收集音效，等价于 `playTone(700, 'sine', 0.1, 0.4)` | — | 3 |

### 3.4 playEffect 子类型详表

| 子类型 | 触发场景 | 波形 | 频率特征 |
|--------|----------|------|----------|
| `bump` | 弹球碰撞钉子 | sine | 200→80Hz 下滑，0.1s |
| `freeze` | 冰冻效果触发 | sine | 2000→500Hz 下滑，0.3s |
| `burn_tick` | 燃烧 DoT 每跳 | sawtooth | 150Hz 短促，0.1s |
| `split` | 分裂/弹道分叉触发 | triangle | 600→900Hz 上扬，0.15s |
| `regen` | 敌人回血 | sine | 500→700Hz 上扬，0.25s |
| `shatter` | 破碎效果（冰冻击碎等） | 白噪声 | 爆发后快速衰减，0.25s |

## 4. 调用分布（按文件）

| 文件 | 调用次数 | 主要音效 |
|------|----------|----------|
| `src/entities.js` | 24 | playPowerup（插槽触发）、playSlash（近战）、playMagic（魔法弹）、createRollingSound（弹球滚动） |
| `src/combat_system.js` | 21 | playLightning/playExplosion（元素爆发）、playEffect（cryo/pyro/split/shatter）、playEnemyHit |
| `src/entities/enemy.js` | 12 | playEffect（regen/split/freeze/burn_tick，状态效果） |
| `src/game_phase.js` | 10 | playShoot（发射弹球）、playPowerup（回合警示）、playCollect（掉落收集）、resume |
| `src/ui/rune_launcher.js` | 6 | playTone（UI 交互反馈：选符文、确认、错误） |
| `src/spawn_system.js` | 4 | playEffect('split')（敌人分裂生成）、playPowerup（多播触发） |
| `src/game_system.js` | 3 | toggleMute（静音按钮）、resume、playTone（成就解锁） |
| `src/combat/damage_calc.js` | 2 | playLightning（连锁闪电）、playExplosion（元素反应爆炸） |
| `src/entities/projectile.js` | 1 | playSlash（飞行道具命中） |

## 5. 已知问题与修改规范

- **内存泄漏**: `createRollingSound` 返回的控制对象必须在弹球销毁时调用 `.stop()`，否则 BufferSource 节点不会自动释放。
- **并发限制**: 同时播放过多音效可能导致音频失真或被浏览器截断。已通过 `DynamicsCompressor` 和各方法内的 `lastPlayTime` 防抖机制缓解。
- **修改规范**:
  - 添加新音效时，必须在 `SoundManager` 中定义新方法，并通过 `audio` 代理统一调度。
  - 严禁在 UI 或业务逻辑中直接操作 `AudioContext` 或创建 `Audio` 对象。
  - 新增 `playEffect` 子类型时，在 `switch` 中添加新 `case`，并同步更新本文档的子类型详表（§3.4）。
  - 有并发风险的高频音效必须添加 `lastPlayTime` 防抖保护（参考 `playEnemyHit`、`playLightning`、`playSlash`）。
