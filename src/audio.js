/**
 * audio.js - 音频引擎 (重构版 v2)
 * 
 * 变更记录：
 * - 移除模块顶层的 `new SoundManager()` 实例化
 * - SoundManager 的实例化延迟到首次用户交互后（由 core.js 控制）
 * - 只导出 SoundManager 类，不再导出预创建的实例
 * - 解决浏览器 AudioContext 策略警告
 */

class SoundManager {
    /**
     * 声音管理器类，使用 Web Audio API 播放音效
     */
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.muted = false;

        // 1. 创建主音量节点
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; 

        // 2.  创建动态压缩器 (防止爆音的核心)
        this.compressor = this.ctx.createDynamicsCompressor();
        // 压缩器参数调优 (适合快节奏游戏)
        this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime); // 超过-24dB开始压缩
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);       // 平滑过渡
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);      // 压缩比率 (高一点防止极响)
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);  // 快速响应
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);  // 快速释放

        // 3.  连接链路： 节点 -> Master -> Compressor -> 扬声器
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        this.noiseBuffer = this.createNoiseBuffer();
        
        //  用于防抖动的记录表 (方法二用到)
        this.lastPlayTime = {}; 
    }
    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2; // 2秒緩衝
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
            
            // 核心：根据速度更新声音
            update: function(speed) {
                // 限制最大速度影响
                const clampSpeed = Math.min(Math.max(speed, 0), 25);
                const normalizedSpeed = clampSpeed / 25; 

                const now = this.ctx.currentTime;

                // --- ：大幅提升滚动音量 ---
                // 原来是 0.4，现在提升到 2.5，保证能听得清
                // 使用平方曲线 (normalizedSpeed^2) 让高速时声音增加得更明显，低速保持安静
                const targetVol = Math.pow(normalizedSpeed, 1.5) * 2.5; 
                this.gainNode.gain.setTargetAtTime(targetVol, now, 0.1);

                // 频率随速度变化，高速时更脆
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

    /**
     * 播放基础音调
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

    /**
     * 播放打击音效
     * @param {string} type - 打击类型
     * @param {number} speed - 速度（影响音调）
     */
    playHit(type = 'normal', speed = 5) {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // 根据类型调整音效
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
        const now = this.ctx.currentTime;
        
        // 防抖
        const perfNow = performance.now();
        if (this.lastPlayTime['lightning'] && perfNow - this.lastPlayTime['lightning'] < 80) return;
        this.lastPlayTime['lightning'] = perfNow;
        
        // 噪声 + 高频扫描
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
        const now = this.ctx.currentTime;
        
        // 噪声爆发
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
        
        // 低频冲击
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
     * @param {number} pitch - 音调等级
     */
    playPowerup(pitch = 1) {
        if (this.muted) return;
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
                // 冰冻效果：高频下滑
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
                // 破碎效果
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
        const now = this.ctx.currentTime;
        
        // 防抖
        const perfNow = performance.now();
        if (this.lastPlayTime['slash'] && perfNow - this.lastPlayTime['slash'] < 60) return;
        this.lastPlayTime['slash'] = perfNow;
        
        // 主音：快速频率下滑
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(800, now);
        osc1.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        
        // 泛音：更高频的点缀
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1200, now);
        osc2.frequency.exponentialRampToValueAtTime(400, now + 0.06);
        
        // 主音包络
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        // 泛音包络 (消失得稍微快一点)
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.1, now + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        // 连接
        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        // 播放
        osc1.start(now);
        osc1.stop(now + 0.55);
        osc2.start(now);
        osc2.stop(now + 0.55);
    }
    /**
     * 播放收集音效
     */
    playCollect() { this.playTone(700, 'sine', 0.1, 0.4); }
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
