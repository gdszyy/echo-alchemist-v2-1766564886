# 游戏音效资源目录

> 由 [jsfxr](https://github.com/chr15m/jsfxr) 程序化生成，44100Hz / 8-bit / 单声道 WAV。
> 所有文件均带固定 seed，可复现重新生成。

## 音效清单

| 文件名 | 预设 | Seed | 对应 audio.js 方法 | 触发场景 |
|--------|------|------|--------------------|----------|
| `hit_normal.wav` | hitHurt | 101 | `playHit('normal')` | 弹球打击普通钉子 |
| `hit_bounce.wav` | hitHurt | 202 | `playHit('bounce')` | 弹球弹壁反弹 |
| `hit_magic.wav` | powerUp | 303 | `playHit('magic')` | 弹球打击魔法钉子 |
| `shoot.wav` | laserShoot | 404 | `playShoot()` | 射击/发射弹球 |
| `charge_shot.wav` | blipSelect | 505 | `@section:charge_shot_audio` | 玩家蓄力发射开始（800Hz） |
| `enemy_telegraph.wav` | hitHurt | 606 | `@section:enemy_telegraph_audio` | 敌人特殊动作预警蓄力（200Hz） |
| `enemy_regen.wav` | powerUp | 707 | `playEffect('regen')` | 敌人回血/再生 |
| `enemy_split.wav` | explosion | 808 | `playEffect('split')` | 敌人分裂/吞噬/跳跃 |
| `enemy_freeze.wav` | blipSelect | 909 | `playEffect('freeze')` | 冰冻效果触发 |
| `burn_tick.wav` | hitHurt | 1010 | `playEffect('burn_tick')` | 燃烧 DoT 每跳 |
| `shatter.wav` | explosion | 1111 | `playEffect('shatter')` | 破碎效果（冰冻击碎） |
| `explosion.wav` | explosion | 1212 | `playExplosion()` | 爆炸效果 |
| `lightning.wav` | laserShoot | 1313 | `playLightning()` | 闪电/静电场 |
| `powerup.wav` | powerUp | 1414 | `playPowerup()` | 能量提升/升级/技能激活 |
| `collect.wav` | pickupCoin | 1515 | `playCollect()` | 收集物品/弹珠落槽 |
| `energy_orb.wav` | pickupCoin | 1616 | `@section:energy_orb_collect_audio` | 能量球收集进度（蓄力升调） |
| `rune_ui.wav` | blipSelect | 1717 | `@section:rune_grid_remove_audio` 等 | 符文菜单 UI 操作 |
| `rune_merge.wav` | powerUp | 1818 | `@section:rune_merge_audio` | 符文合成/重铸成功 |

## 重新生成

```bash
cd /home/ubuntu/skills/jsfxr-sfx-generator
node scripts/generate_sfx.js <preset> <output_path> --seed <seed>
# 例：
node scripts/generate_sfx.js explosion src/assets/sfx/explosion.wav --seed 1212
```
