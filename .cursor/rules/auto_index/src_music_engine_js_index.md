# src\music_engine.js 函数索引

> 自动生成于 2026-07-22 | 总行数: 1069 | 函数数: 53 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| constructor | method | `constructor(soundManager)` |  |
| _noteFreq | method | `_noteFreq(semis)` |  |
| _makeSoftClipCurve | method | `_makeSoftClipCurve(k = 3)` |  |
| _syncDelay | method | `_syncDelay()` |  |
| playKick | method | `playKick(t, gain = 1.0)` |  |
| playBass | method | `playBass(t, freq)` |  |
| duck | method | `duck(t)` |  |
| playHat | method | `playHat(t, open = false, gain = 0.6)` |  |
| playShaker | method | `playShaker(t)` |  |
| playOoh | method | `playOoh(t, freq, dur = 0.4, dest = null)` |  |
| playScreech | method | `playScreech(t, carrierFreq, dur = 0.4)` |  |
| _startDrone | method | `_startDrone()` |  |
| _retuneDrone | method | `_retuneDrone(t)` |  |
| _stopDrone | method | `_stopDrone()` |  |
| riser | method | `riser(dur = 1.2)` |  |
| downlifter | method | `downlifter(dur = 1.0)` |  |
| impact | method | `impact()` |  |
| playTom | method | `playTom(t, freq = 180, gain = 0.65)` |  |
| drumFill | method | `drumFill()` |  |
| finalCue | method | `finalCue()` |  |
| _bossProfiles | method | `_bossProfiles()` |  |
| applyBossProfile | method | `applyBossProfile(bossId, opts = {})` |  |
| setSection | method | `setSection(sec, snap = false)` |  |
| setRage | method | `setRage(on)` |  |
| _scheduleBass | method | `_scheduleBass(s, t)` |  |
| _scheduleSignatures | method | `_scheduleSignatures(s, t, phrase)` |  |
| _vocalChop | method | `_vocalChop(t, freq, n = 6, span = 0.3)` |  |
| _glassBell | method | `_glassBell(t, freq)` |  |
| _onBarStart | method | `_onBarStart(t)` |  |
| _bassStepActive | method | `_bassStepActive(s)` |  |
| _scheduleStep | method | `_scheduleStep(s, t)` |  |
| _scheduler | method | `_scheduler()` |  |
| start | method | `start()` |  |
| stop | method | `stop()` |  |
| setIntensity | method | `setIntensity(v)` |  |
| _applyIntensity | method | `_applyIntensity()` |  |
| setThreat | method | `setThreat(p)` |  |
| setThreatToBoss | method | `setThreatToBoss(on)` |  |
| _startApproach | method | `_startApproach()` |  |
| _stopApproach | method | `_stopApproach()` |  |
| _rideApproach | method | `_rideApproach()` |  |
| _applyThreatToDrone | method | `_applyThreatToDrone()` |  |
| _zoneOf | method | `_zoneOf(p)` |  |
| _updateThreatZone | method | `_updateThreatZone()` |  |
| onThreatZone | method | `onThreatZone(zone, dir)` |  |
| _alarm | method | `_alarm()` |  |
| _heartbeat | method | `_heartbeat(t, gain)` |  |
| setVolume | method | `setVolume(v)` |  |
| getVolume | method | `getVolume()` |  |
| setBpm | method | `setBpm(b)` |  |
| glideBpm | method | `glideBpm(b)` |  |
| setRootFreq | method | `setRootFreq(f)` |  |
| isPlaying | method | `isPlaying()` |  |
