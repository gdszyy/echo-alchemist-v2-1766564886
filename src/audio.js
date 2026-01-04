// ==================== 音频管理器 ====================
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
        this.masterGain.gain.value = this.muted ? 0 : 0.3;
        
        //  如果静音了，强制暂停所有 AudioContext (因为滚动声是独立节点的)
        if (this.muted) {
            if (this.ctx.state === 'running') this.ctx.suspend();
        } else {
            if (this.ctx.state === 'suspended') this.ctx.resume();
        }
        return this.muted;
    }

    /**
     * 恢复 AudioContext (解决浏览器自动播放限制)
     */
    resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
    /**
     * 播放通用游戏特效音
     * @param {string} type - 'burn_tick', 'freeze', 'regen', 'split', 'ignite'
     */
 playEffect(type) {
        if (this.muted) return;
        const now = this.ctx.currentTime;

        if (type === 'burn_tick') {
            // 🔥 燃烧结算：重做为 "烈火升腾" (Fwoosh + Crackle)
            // 之前的版本太像漏气了，这个版本强调火焰的"吞噬感"
            
            // --- Layer 1: 火焰的主体 (The Body/Whoosh) ---
            // 使用低通滤波后的噪音，模拟热空气膨胀
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 1; // 增加一点共振，让火声更有力
            
            // 关键：频率动态扫描
            // 从中频(1500Hz) 快速滑落到 低频(100Hz)
            // 模拟火苗瞬间窜起又平息的过程 ("Fwump")
            filter.frequency.setValueAtTime(1500, now);
            filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.5, now + 0.02); // 快速起音
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25); // 稍微长一点的尾韵

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            noise.start(now);
            noise.stop(now + 0.3);

            // --- Layer 2: 爆裂杂音 (The Crackle) ---
            // 极短的高通噪音，模拟木材或燃料的爆裂声
            const crackle = this.ctx.createBufferSource();
            crackle.buffer = this.noiseBuffer;
            
            const cFilter = this.ctx.createBiquadFilter();
            cFilter.type = 'highpass';
            cFilter.frequency.setValueAtTime(3000, now); // 只留高频细节
            
            const cGain = this.ctx.createGain();
            // 随机化音量，让每次燃烧听起来不一样
            cGain.gain.setValueAtTime(0.1 + Math.random() * 0.1, now); 
            cGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); // 极短，像火花

            crackle.connect(cFilter);
            cFilter.connect(cGain);
            cGain.connect(this.masterGain);
            crackle.start(now);
            crackle.stop(now + 0.15);
        } else if (type === 'ignite') {
             // 🔥 点燃瞬间：更猛烈的气体爆燃声 (Ignition)
             const noise = this.ctx.createBufferSource();
             noise.buffer = this.noiseBuffer;
             
             // 使用带通滤波器 (Bandpass) 模拟从中心向外爆发的声音
             const filter = this.ctx.createBiquadFilter();
             filter.type = 'bandpass';
             filter.Q.value = 0.5; // 宽频带
             
             // 频率向上扫，模拟火势变大 ("Vwooom")
             filter.frequency.setValueAtTime(200, now);
             filter.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
             
             const gain = this.ctx.createGain();
             gain.gain.setValueAtTime(0.4, now);
             gain.gain.linearRampToValueAtTime(0, now + 0.4);
 
             noise.connect(filter);
             filter.connect(gain);
             gain.connect(this.masterGain);
             noise.start(now);
             noise.stop(now + 0.5);
        }
        else if (type === 'freeze') {
            // ❄️ 冻结：晶体极速生长 (Arpeggio / Granular)
            // 播放一串快速、随机的高频短音
            const count = 5; // 颗粒数量
            for (let i = 0; i < count; i++) {
                const t = now + i * 0.03; // 间隔极短 (30ms)
                
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sine';
                // 频率在 2000Hz ~ 4500Hz 之间随机，且随时间越来越高 (结冰通常是向上蔓延)
                const freq = 2000 + (Math.random() * 1000) + (i * 500);
                osc.frequency.setValueAtTime(freq, t);
                
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(t);
                osc.stop(t + 0.15);
            }
            
            // 底层的风声/寒气 (White Noise Sweep)
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(1000, now);
            filter.frequency.linearRampToValueAtTime(4000, now + 0.3); // 滤波器向上扫
            
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.2, now);
            nGain.gain.linearRampToValueAtTime(0, now + 0.3);
            
            noise.connect(filter);
            filter.connect(nGain);
            nGain.connect(this.masterGain);
            noise.start(now);
            noise.stop(now + 0.3);
        }
        else if (type === 'regen') {
            // 💚 恢复：柔和的双音上升 (Magical Chime)
            [400, 600].forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                
                // 频率缓慢上升
                osc.frequency.setValueAtTime(freq, now);
                osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.4);
                
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.4);
            });
        }
        else if (type === 'split') {
            // 💠 分裂：清脆的短促音 (Pop)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
            
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    }
    /**
     * 播放挥剑音效
     */
    playSlash() {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.15);
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
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    /**
     * 播放通用音调
     */
    playTone(freq, type, duration, vol = 1) {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(vol * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * 播放击中音效
     * @param {string} type - 'normal', 'heavy', 'metal', 'wood'
     * @param {number} speed - 击中速度 (影响音调)
     */
    playHit(type, speed = 5) {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        
        // 限制速度对音调的影响
        const detune = Math.min(Math.max(speed / 10, 0.5), 2.0);

        if (type === 'normal') {
            this.playTone(150 * detune, 'sine', 0.1, 0.5);
        } else if (type === 'heavy') {
            this.playTone(80 * detune, 'triangle', 0.2, 0.8);
        } else if (type === 'metal') {
            this.playTone(1000 * detune, 'square', 0.05, 0.3);
        }
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
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    /**
     * 播放爆炸音效
     */
    playExplosion() { if (!this.muted) this.playTone(100, 'sawtooth', 0.4, 0.5); }

    /**
     * 播放闪电音效
     */
    playLightning() {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, now);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.2);
    }

    /**
     * 播放敌人受击音效
     */
    playEnemyHit(type = 'normal') {
        const freq = type === 'boss' ? 100 : 200;
        this.playTone(freq, 'triangle', 0.15, 0.4);
    }
    /**
     * 播放属性触发音效 (核心：区分不同属性的听感)
     * @param {string} type - 'cryo', 'pyro', 'lightning', 'pierce'
     * @param {number} speed - 速度系数
     */
    playAttributeEffect(type, speed = 1) {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        const detune = Math.min(Math.max(speed, 0.5), 2.0);

        if (type === 'lightning') {
            // ⚡ 闪电: 高频方波 + 极短包络 (清脆的电火花声)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1500 * detune, now);
            osc.frequency.exponentialRampToValueAtTime(3000, now + 0.05);
            
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            
            osc.connect(gain); gain.connect(this.masterGain);
            osc.start(now); osc.stop(now + 0.05);
        } else if (type === 'cryo') {
            // ❄️ 冰霜: 
            // 1. 高频正弦波随机序列 (模拟晶体破碎)
            const count = 3;
            for(let i=0; i<count; i++) {
                const t = now + i * 0.01;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(3000 + Math.random() * 2000, t);
                
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
                
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(2000, t);
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);
                
                osc.start(t);
                osc.stop(t + 0.05);
            }
            // 2. 冰屑噪音 (Noise Burst) - 增加“沙沙”的质感
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.setValueAtTime(5000, now); // 只留极高频的呲呲声
            
            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.3, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05); // 50ms 结束
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            
            noise.start(now);
            noise.stop(now + 0.06);
            
            return; // 结束 cryo 的处理
        } else if (type === 'pyro') {
            // 🔥 火焰: 低频锯齿 + 低通滤波 (保持之前的闷响感)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100 * detune, now);
            osc.frequency.linearRampToValueAtTime(30, now + 0.15);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.exponentialRampToValueAtTime(50, now + 0.15);
            
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            
            osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
            osc.start(now); osc.stop(now + 0.2);
        }
        else if (type === 'pierce') {
             // 🗡️ 穿透: 方波 + 高截止频率
             const osc = this.ctx.createOscillator();
             const gain = this.ctx.createGain();
             const filter = this.ctx.createBiquadFilter();
             
             osc.type = 'square';
             osc.frequency.setValueAtTime(800 * detune, now);
             osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
             
             filter.type = 'lowpass'; // 稍微修饰一下方波的刺耳
             filter.frequency.setValueAtTime(4000, now);
             gain.gain.setValueAtTime(0.15, now);
             gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
             
             osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
             osc.start(now); osc.stop(now + 0.2);
        }
    }
    /**
     * 播放充能/升级音效 (音调随等级爬升)
     * @param {number} level - 当前充能等级 (1 ~ 7+)
     */
    playPowerup(level = 1) {
        if (this.muted) return;
        
        // 1. 限制等级范围 (1-7)，超过7级保持最高音，避免太刺耳
        const safeLevel = Math.min(Math.max(level, 1), 7);
        
        // 2. 五声音阶半音增量表 (C, D, E, G, A, C, D...)
        // 对应的半音数: 0, 2, 4, 7, 9, 12, 14
        const intervals = [0, 2, 4, 7, 9, 12, 14];
        const semitoneShift = intervals[safeLevel - 1];
        
        // 3. 计算基频 (基础音 C5 = 523.25Hz)
        // 公式: f = f0 * 2^(n/12)
        const baseFreq = 523.25 * Math.pow(2, semitoneShift / 12);
        
        const now = this.ctx.currentTime;
        // --- 声音合成：清亮的水晶音 ---
        
        // 振荡器 1: 主音 (Triangle - 温暖明亮)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(baseFreq, now);
        // 振荡器 2: 泛音 (Sine - 高八度，增加通透感)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(baseFreq * 2, now); // 高八度
        // 微调一点点音分，制造“闪烁感”
        osc2.detune.setValueAtTime(10, now); 
        // --- 包络 (ADSR) ---
        // 快速起音，中等衰减
        
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
const audio = new SoundManager();
export { SoundManager, audio };
