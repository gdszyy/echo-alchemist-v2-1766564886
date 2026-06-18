# src\audio.js 函数索引

> 自动生成于 2026-06-18 | 总行数: 672 | 函数数: 20 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| constructor | method | `constructor()` |  |
| _createReverbNode | method | `_createReverbNode(decay = 0.8, duration = 2.0)` |  |
| _connectToPegBus | method | `_connectToPegBus(node)` |  |
| createNoiseBuffer | method | `createNoiseBuffer()` |  |
| createRollingSound | method | `createRollingSound()` |  |
| toggleMute | method | `toggleMute()` |  |
| resume | method | `resume()` |  |
| suspend | method | `suspend()` |  |
| playTone | method | `playTone(freq, type = 'sine', vol = 0.3, dur = 0.2)` |  |
| playHit | method | `playHit(type = 'normal', speed = 5)` |  |
| playShoot | method | `playShoot()` |  |
| playEnemyHit | method | `playEnemyHit(hitType = 'normal')` |  |
| playLightning | method | `playLightning()` |  |
| playExplosion | method | `playExplosion()` |  |
| playPowerup | method | `playPowerup(pitch = 1)` |  |
| playEffect | method | `playEffect(type)` |  |
| playMagic | method | `playMagic()` |  |
| playSlash | method | `playSlash()` |  |
| playCollect | method | `playCollect()` |  |
| _setAudioInstance | function | `_setAudioInstance(instance)` |  |

## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:hit_normal` | 钉盘碰撞：triangle，速度驱动频率，接入 Reverb |
| `@section:hit_bounce` | 弹壁反弹：triangle，更高频，接入 Reverb |
| `@section:hit_magic` | 魔法钉子：sine 上扬，直连 masterGain |
| `@section:effect_bump` | bump：弹球碰撞钉子，sine 200→80Hz + Reverb |
| `@section:effect_freeze` | freeze：冰冻效果触发，sine 2000→500Hz 下滑 |
| `@section:effect_burn_tick` | burn_tick：燃烧 DoT 每跳，sawtooth 150Hz 短促 |
| `@section:effect_split` | split：分裂/弹道分叉触发，triangle 600→900Hz 上扬 |
| `@section:effect_regen` | regen：敌人回血，sine 500→700Hz 上扬 |
| `@section:effect_shatter` | shatter：破碎效果（冰冻击碎等），白噪声爆发 |
