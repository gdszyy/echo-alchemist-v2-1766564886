# src/audio.js 函数索引

> 自动生成于 2026-04-25 | 总行数: 570 | 函数数: 18 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| SoundManager | class | `SoundManager()` |  |
| constructor | method | `constructor()` |  |
| createNoiseBuffer | method | `createNoiseBuffer()` |  |
| createRollingSound | method | `createRollingSound()` |  |
| toggleMute | method | `toggleMute()` |  |
| resume | method | `resume()` |  |
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
| `@section:effect_bump` | bump：弹球碰撞钉子，sine 200→80Hz |
| `@section:effect_freeze` | freeze：冰冻效果触发，sine 2000→500Hz 下滑 |
| `@section:effect_burn_tick` | burn_tick：燃烧 DoT 每跳，sawtooth 150Hz 短促 |
| `@section:effect_split` | split：分裂/弹道分叉触发，triangle 600→900Hz 上扬 |
| `@section:effect_regen` | regen：敌人回血，sine 500→700Hz 上扬 |
| `@section:effect_shatter` | shatter：破碎效果（冰冻击碎等），白噪声爆发 |
