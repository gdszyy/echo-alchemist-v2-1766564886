/**
 * audio.js - 音频引擎 (重构版 v3 - WAV 文件驱动)
 * 
 * 变更记录：
 * - v3: 优先使用 src/assets/sfx/ 目录下的 WAV 文件播放音效
 *       保留 Web Audio API 合成作为 fallback（createRollingSound 等持续型音效）
 *       新增 _loadSfx() 预加载机制，首次用户交互后批量 decode
 * - v2: 移除模块顶层的 `new SoundManager()` 实例化
 *       SoundManager 的实例化延迟到首次用户交互后（由 core.js 控制）
 */

// WAV 文件路径映射表（相对于项目根目录）
const SFX_MAP = {
    hit_normal:       'src/assets/sfx/hit_normal.wav',
    hit_bounce:       'src/assets/sfx/hit_bounce.wav',
    hit_magic:        'src/assets/sfx/hit_magic.wav',
    shoot:            'src/assets/sfx/shoot.wav',
    charge_shot:      'src/assets/sfx/charge_shot.wav',
    enemy_telegraph:  'src/assets/sfx/enemy_telegraph.wav',
    enemy_regen:      'src/assets/sfx/enemy_regen.wav',
    enemy_split:      'src/assets/sfx/enemy_split.wav',
    enemy_freeze:     'src/assets/sfx/enemy_freeze.wav',
    burn_tick:        'src/assets/sfx/burn_tick.wav',
    shatter:          'src/assets/sfx/shatter.wav',
    explosion:        'src/assets/sfx/explosion.wav',
    lightning:        'src/assets/sfx/lightning.wav',
    powerup:          'src/assets/sfx/powerup.wav',
    collect:          'src/assets/sfx/collect.wav',
    energy_orb:       'src/assets/sfx/energy_orb.wav',
    rune_ui:          'src/assets/sfx/rune_ui.wav',
    rune_merge:       'src/assets/sfx/rune_merge.wav',
};

class SoundManager {
    /**
     * 声音管理器类
     * 优先使用预加载的 WAV AudioBuffer 播放音效；
     * createRollingSound 等持续型音效继续使用 Web Audio API 合成。
     */
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.muted = false;

        // 1. 创建主音量节点
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;

        // 2. 创建动态压缩器（防止爆音）
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

        // 3. 连接链路：节点 -> Master -> Compressor -> 扬声器
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        // 白噪声缓冲（rolling sound / shatter fallback 用）
        this.noiseBuffer = this.createNoiseBuffer();

        // 防抖记录表
        this.lastPlayTime = {};

        // WAV AudioBuffer 缓存（key → AudioBuffer）
        this._sfxBuffers = {};

        // 异步预加载所有 WAV
        this._preloadAllSfx();
    }

    /**
     * 预加载 SFX_MAP 中所有 WAV 文件到 AudioBuffer
     * 失败时静默忽略，后续调用自动降级到合成音效
     */
    async _preloadAllSfx() {
        const entries = Object.entries(SFX_MAP);
        await Promise.all(entries.map(async ([key, path]) => {
            try {
                const resp = await fetch(path);
                if (!resp.ok) return;
                const arrayBuf = await resp.arrayBuffer();
                this._sfxBuffers[key] = await this.ctx.decodeAudioData(arrayBuf);
            } catch (e) {
                // 静默失败，fallback 到合成音效
            }
        }));
    }

    /**
     * 播放已预加载的 WAV 音效
     * @param {string} key - SFX_MAP 中的键名
     * @param {number} vol - 音量倍率（默认 1.0）
     * @param {number} rate - 播放速率（默认 1.0，可用于音调微调）
     * @returns {boolean} 是否成功播放
     */
    _playSfx(key, vol = 1.0, rate = 1.0) {
        if (this.muted) return false;
        const buf = this._sfxBuffers[key];
        if (!buf) return false;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const gain = this.ctx.createGain();
        gain.gain.value = vol;
        src.connect(gain);
        gain.connect(this.masterGain);
        src.start(this.ctx.currentTime);
        return true;
    }

    // ─────────────────────────────────────────────
    //  持续型音效（保留 Web Audio API 合成）
    // ─────────────────────────────────────────────

    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    createRollingSound() {
        if (this.muted) return null;

        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 1.0;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = 0;

        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);
        source.start();

        return {
            node: source,
            gainNode: gainNode,
            filter: filter,
            ctx: this.ctx,
            update: function(speed) {
                const clampSpeed = Math.min(Math.max(speed, 0), 25);
                const normalizedSpeed = clampSpeed / 25;
                const now = this.ctx.currentTime;
                const targetVol = Math.pow(normalizedSpeed, 1.5) * 2.5;
                this.gainNode.gain.setTargetAtTime(targetVol, now, 0.1);
                const targetFreq = 100 + (normalizedSpeed * 800);
                this.filter.frequency.setTargetAtTime(targetFreq, now, 0.1);
            },
            stop: function() {
                const now = this.ctx.currentTime;
                this.gainNode.gain.setTargetAtTime(0, now, 0.2);
                setTimeout(() => {
                    try { source.stop(); source.disconnect(); } catch(e){}
                }, 300);
            }
        };
    }

    // ─────────────────────────────────────────────
    //  控制方法
    // ─────────────────────────────────────────────

    /**
     * 切换静音状态
     * @returns {boolean} 当前静音状态
     */
    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        } else {
            this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            if (this.ctx.state === 'suspended') this.ctx.resume();
        }
        return this.muted;
    }

    /**
     * 恢复音频上下文（解决浏览器自动暂停策略）
     */
    resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }

    // ─────────────────────────────────────────────
    //  通用基础音调（UI 微调用，保留合成）
    // ─────────────────────────────────────────────

    /**
     * 播放基础音调（用于 UI 微调音效，无对应 WAV 时使用）
     * @param {number} freq - 频率
     * @param {string} type - 波形类型
     * @param {number} vol - 音量
     * @param {number} dur - 持续时间
     */
    playTone(freq, type = 'sine', vol = 0.3, dur = 0.2) {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + dur);
    }

    // ─────────────────────────────────────────────
    //  游戏音效方法（优先 WAV，fallback 合成）
    // ─────────────────────────────────────────────

    /**
     * 播放打击音效
     * @param {string} type - 打击类型：'normal' | 'bounce' | 'cryo' | 'pyro' | 'magic'
     * @param {number} speed - 速度（影响 fallback 合成音调）
     */
    playHit(type = 'normal', speed = 5) {
        if (this.muted) return;

        // WAV 优先：normal / bounce / magic 有对应文件
        if (type === 'normal'  && this._playSfx('hit_normal',  0.9)) return;
        if (type === 'bounce'  && this._playSfx('hit_bounce',  0.85)) return;
        if (type === 'magic'   && this._playSfx('hit_magic',   0.9)) return;

        // Fallback：cryo / pyro 及 WAV 未加载时使用合成
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        switch(type) {
            case 'bounce':
                osc.frequency.setValueAtTime(400 + speed * 30, now);
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.15, now);
                break;
            case 'cryo':
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.linearRampToValueAtTime(1200, now + 0.05);
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.12, now);
                break;
            case 'pyro':
                osc.frequency.setValueAtTime(200, now);
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.15, now);
                break;
            default:
                osc.frequency.setValueAtTime(300 + speed * 20, now);
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.12, now);
        }
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    /**
     * 播放射击音效
     */
    playShoot() {
        if (this.muted) return;
        if (this._playSfx('shoot', 0.9)) return;

        // Fallback
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    /**
     * 播放敌人受击音效
     * @param {string} hitType - 打击类型
     */
    playEnemyHit(hitType = 'normal') {
        if (this.muted) return;

        // 防抖：同类型音效间隔至少 50ms
        const now = performance.now();
        const key = `enemyHit_${hitType}`;
        if (this.lastPlayTime[key] && now - this.lastPlayTime[key] < 50) return;
        this.lastPlayTime[key] = now;

        // 根据 hitType 映射到对应 WAV
        const sfxMap = {
            cryo:      'enemy_freeze',
            pyro:      'burn_tick',
            lightning: 'lightning',
            normal:    'hit_normal',
        };
        const sfxKey = sfxMap[hitType] || 'hit_normal';
        if (this._playSfx(sfxKey, 0.75)) return;

        // Fallback
        const audioNow = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        switch(hitType) {
            case 'cryo':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1000, audioNow);
                osc.frequency.linearRampToValueAtTime(600, audioNow + 0.1);
                gain.gain.setValueAtTime(0.08, audioNow);
                break;
            case 'pyro':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, audioNow);
                osc.frequency.linearRampToValueAtTime(100, audioNow + 0.15);
                gain.gain.setValueAtTime(0.1, audioNow);
                break;
            case 'lightning':
                osc.type = 'square';
                osc.frequency.setValueAtTime(2000, audioNow);
                osc.frequency.exponentialRampToValueAtTime(500, audioNow + 0.08);
                gain.gain.setValueAtTime(0.06, audioNow);
                break;
            default:
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, audioNow);
                osc.frequency.linearRampToValueAtTime(200, audioNow + 0.1);
                gain.gain.setValueAtTime(0.08, audioNow);
        }
        gain.gain.exponentialRampToValueAtTime(0.001, audioNow + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(audioNow);
        osc.stop(audioNow + 0.2);
    }

    /**
     * 播放闪电音效
     */
    playLightning() {
        if (this.muted) return;

        // 防抖
        const perfNow = performance.now();
        if (this.lastPlayTime['lightning'] && perfNow - this.lastPlayTime['lightning'] < 80) return;
        this.lastPlayTime['lightning'] = perfNow;

        if (this._playSfx('lightning', 0.9)) return;

        // Fallback
        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.15, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        noise.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + 0.25);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(3000, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    /**
     * 播放爆炸音效
     */
    playExplosion() {
        if (this.muted) return;
        if (this._playSfx('explosion', 0.9)) return;

        // Fallback
        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + 0.5);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.4);
    }

    /**
     * 播放能量提升音效
     * @param {number} pitch - 音调等级（影响 WAV 播放速率）
     */
    playPowerup(pitch = 1) {
        if (this.muted) return;
        // pitch 影响播放速率，营造等级感（每级提高 5%）
        const rate = 1.0 + (pitch - 1) * 0.05;
        if (this._playSfx('powerup', 0.85, rate)) return;

        // Fallback
        const now = this.ctx.currentTime;
        const baseFreq = 400 + pitch * 50;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    /**
     * 播放特殊效果音
     * @param {string} type - 效果类型
     */
    playEffect(type) {
        if (this.muted) return;

        // WAV 映射
        const sfxKeyMap = {
            freeze:    'enemy_freeze',
            burn_tick: 'burn_tick',
            split:     'enemy_split',
            regen:     'enemy_regen',
            shatter:   'shatter',
            bump:      'hit_normal',
        };
        const sfxKey = sfxKeyMap[type];
        if (sfxKey && this._playSfx(sfxKey, 0.8)) return;

        // Fallback（合成）
        const now = this.ctx.currentTime;
        switch(type) {
            // @section:effect_bump - bump：弹球碰撞钉子，sine 200→80Hz
            case 'bump': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }
            // @section:effect_freeze - freeze：冰冻效果触发，sine 2000→500Hz 下滑
            case 'freeze': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(2000, now);
                osc.frequency.exponentialRampToValueAtTime(500, now + 0.3);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            }
            // @section:effect_burn_tick - burn_tick：燃烧 DoT 每跳，sawtooth 150Hz 短促
            case 'burn_tick': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }
            // @section:effect_split - split：分裂/弹道分叉触发，triangle 600→900Hz 上扬
            case 'split': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.linearRampToValueAtTime(900, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            }
            // @section:effect_regen - regen：敌人回血，sine 500→700Hz 上扬
            case 'regen': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(500, now);
                osc.frequency.linearRampToValueAtTime(700, now + 0.2);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.25);
                break;
            }
            // @section:effect_shatter - shatter：破碎效果（冰冻击碎等），白噪声爆发
            case 'shatter': {
                const noise = this.ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;
                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.15, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                noise.connect(noiseGain);
                noiseGain.connect(this.masterGain);
                noise.start(now);
                noise.stop(now + 0.25);
                break;
            }
            default:
                this.playTone(400, 'sine', 0.08, 0.1);
        }
    }

    /**
     * 播放魔法音效
     */
    playMagic() {
        if (this.muted) return;
        if (this._playSfx('hit_magic', 0.8)) return;

        // Fallback
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.1);
        osc.frequency.linearRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    /**
     * 播放斩击音效
     */
    playSlash() {
        if (this.muted) return;

        // 防抖
        const perfNow = performance.now();
        if (this.lastPlayTime['slash'] && perfNow - this.lastPlayTime['slash'] < 60) return;
        this.lastPlayTime['slash'] = perfNow;

        if (this._playSfx('shoot', 0.7, 0.6)) return;

        // Fallback
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(800, now);
        osc1.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1200, now);
        osc2.frequency.exponentialRampToValueAtTime(400, now + 0.06);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.1, now + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc1.start(now);
        osc1.stop(now + 0.55);
        osc2.start(now);
        osc2.stop(now + 0.55);
    }

    /**
     * 播放收集音效
     */
    playCollect() {
        if (this.muted) return;
        if (this._playSfx('collect', 0.85)) return;
        this.playTone(700, 'sine', 0.1, 0.4);
    }
}

// ==================== 变更：不再在模块顶层创建实例 ====================
// 旧代码: const audio = new SoundManager();
// 新代码: SoundManager 实例由 core.js 在首次用户交互后创建

// ==================== 兼容性导出 ====================
// 子系统仍然通过 `import { audio } from './audio.js'` 引用
// 提供一个安全的代理对象，在 SoundManager 未初始化时静默失败
let _audioInstance = null;

/**
 * 设置音频实例（由 core.js 在首次用户交互后调用）
 * @param {SoundManager} instance
 */
function _setAudioInstance(instance) {
    _audioInstance = instance;
}

/**
 * 安全的音频代理对象
 * 在 SoundManager 未初始化时，所有方法调用静默失败
 */
const audio = new Proxy({}, {
    get: (target, prop) => {
        if (_audioInstance) {
            const val = _audioInstance[prop];
            if (typeof val === 'function') {
                return val.bind(_audioInstance);
            }
            return val;
        }
        // 未初始化时返回安全默认值
        if (prop === 'ctx') return null;
        if (prop === 'muted') return false;
        return () => {};
    },
    set: (target, prop, value) => {
        if (_audioInstance) {
            _audioInstance[prop] = value;
        }
        return true;
    }
});

export { SoundManager, audio, _setAudioInstance };
