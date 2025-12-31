/**
 * core.js - 游戏核心引擎层
 * 
 * 职责：
 * - 游戏的"骨架"和"大脑"
 * - 管理生命周期和全局服务
 * - 全局状态机管理
 * - Canvas 上下文管理
 * 
 * 核心类：
 * - SoundManager: 音频引擎
 * - Game: 游戏主类（管理 sys_loop, phase_switchPhase）
 */

import { 
    META_SHOP_CONFIG, 
    ATTRIBUTES_FOR_SHOP, 
    setDeepValue, 
    CONFIG, 
    RELIC_DB, 
    SKILL_DB 
} from './config.js';

import { 
    Vec2, 
    MarbleDefinition, 
    SpecialSlot, 
    FortuneWheel, 
    Peg, 
    DropBall, 
    Enemy, 
    SwordQi, 
    SlashAnim, 
    SonSword, 
    Projectile, 
    CloneSpore, 
    Particle, 
    SlashEffect, 
    CollectionBeam, 
    Shockwave, 
    LaserBeam, 
    FloatingText, 
    EnergyOrb, 
    LightningBolt, 
    FireWave, 
    showToast, 
    rotateTowards,
    adjustColorBrightness, 
    lerpColor, 
    lerp, 
    hexToRgba 
} from './entities.js';

import { 
    UIManager, 
    TrainingGround, 
    TruthBook 
} from './systems.js';

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
                osc.frequency.linearRampToValueAtTime(freq + 200, now + 0.5);

                // 缓慢淡入淡出
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
                gain.gain.linearRampToValueAtTime(0, now + 0.6);

                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now);
                osc.stop(now + 0.7);
            });
        }
        else if (type === 'split') {
            // 🦠 分裂：类似水泡破裂的声音 (Squishy Pop)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            // 使用锯齿波经过低通滤波，模拟粘稠感
            osc.type = 'sawtooth';
            // 频率快速向上滑动一下
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(400, now + 0.1);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(300, now);
            filter.Q.value = 5; // 增加共振，制造“啵”的感觉

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.25);
        }
        else if (type === 'ignite') {
             // 🔥 点燃/燃烧中：低频轰鸣
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, now);
            const gain = this.ctx.createGain();
            
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            noise.start(now);
            noise.stop(now + 0.4);
        }
    }
    playSlash() {
        if (this.muted) return;
        const now = this.ctx.currentTime;

        // --- Layer 1: 破空声 (The Whoosh) ---
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        // 频率从高往低快速滑落，模拟挥剑
        filter.frequency.setValueAtTime(4000, now);
        filter.frequency.exponentialRampToValueAtTime(500, now + 0.15);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + 0.2);

        // --- Layer 2: 金属闪光感 (The Metal Zing) ---
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle'; // 三角波比正弦波更有质感

        // 高频起始，极快衰减
        osc.frequency.setValueAtTime(2000, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);

        oscGain.gain.setValueAtTime(0.2, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.1);
    }
    /**
     * 播放一个音调
     * @param {number} freq - **重要参数** 频率 (Hz)
     * @param {string} type - **重要参数** 波形类型 ('sine', 'square', 'sawtooth', 'triangle')
     * @param {number} duration - **重要参数** 持续时间 (秒)
     * @param {number} [vol=1] - 初始音量
     */

    playMagic() {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        // 播放一串快速的閃爍音
        [400, 600, 800].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.05);
            gain.gain.setValueAtTime(0.1, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.1);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.1);
        });
    }
    playTone(freq, type, duration, vol = 1) {
        if (this.muted) return;
        
        const now = this.ctx.currentTime;
        //  微小的随机延迟 (0 ~ 0.03秒)，错开波峰
        const randomDelay = Math.random() * 0.03; 
        //  微小的频率抖动 (+- 10Hz)，防止完全共振
        const randomDetune = (Math.random() - 0.5) * 20; 

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        // 使用 detune 来微调，比直接改 freq 更自然
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(randomDetune, now); 

        //  限制单个音效的最大音量，防止传入过大的 vol
        const safeVol = Math.min(vol, 0.5); 

        gain.gain.setValueAtTime(0, now); // 先设为0
        // 快速淡入 (消除点击声)
        gain.gain.linearRampToValueAtTime(safeVol, now + randomDelay + 0.01);
        // 指数淡出
        gain.gain.exponentialRampToValueAtTime(0.01, now + randomDelay + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now + randomDelay);
        osc.stop(now + randomDelay + duration);
    }
    
 
    /**
     * 播放弹珠撞击钉子的音效 (物理真实版：短促、厚实、有打击感)
     * @param {string} type - 钉子类型
     * @param {number} speed - 撞击速度
     */
    playHit(type, speed = 5) {
        if (this.muted) return;

        const now = this.ctx.currentTime;
        
        // 冷却检查
        if (this.lastPlayTime[type] && (now - this.lastPlayTime[type] < 0.05)) {
            return; 
        }
        this.lastPlayTime[type] = now;

        // --- 1. 动态参数 ---
        // 速度影响音量和音调微调
        const velocity = Math.min(Math.max(speed / 15, 0.1), 1.0);
        // 音调微小随机化 (+/- 8%) 模拟不同接触点
        const detune = 1.0 + (Math.random() - 0.5) * 0.16; 

        // --- 2. 基频调整 (整体降低，去除"风铃感") ---
        const baseFreqs = { 
            'normal': 800,    // 降到中频，模拟实心钢珠
            'bounce': 1000,   
            'pierce': 600,    // 更沉
            'scatter': 1200,  
            'damage': 500,    
            'cryo': 2200,     // 冰还是保留一点脆
            'pyro': 300,      // 像爆炸闷响
            'lightning': 900,
            'pink': 1100      
        };
        const baseFreq = (baseFreqs[type] || 800) * detune;

        // --- 3. 声音合成：冲击声 (Impact) + 余音 (Resonance) ---

        // 振荡器 A: 冲击主体 (Impact)
        // 使用正弦波，声音最扎实，不刺耳
        const oscA = this.ctx.createOscillator();
        const gainA = this.ctx.createGain();
        oscA.type = 'sine';
        
        // 振荡器 B: 接触瞬态 (Click)
        // 使用方波模拟刚性接触的瞬间，极短
        const oscB = this.ctx.createOscillator();
        const gainB = this.ctx.createGain();
        oscB.type = 'square'; 

        // --- 4. 频率包络 (模拟物理撞击的音高下潜) ---
        // 极短的时间内频率快速下降，产生"笃"的感觉
        oscA.frequency.setValueAtTime(baseFreq + 200, now);
        oscA.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.05);

        // 瞬态音高更高，衰减更快
        oscB.frequency.setValueAtTime(baseFreq * 3, now); 
        oscB.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.01);

        // --- 5. 音量包络 (极短，无延音) ---
        
        // 主体音：快速起音，快速消逝 (0.08秒内结束)
        gainA.gain.setValueAtTime(0, now);
        gainA.gain.linearRampToValueAtTime(0.8 * velocity, now + 0.002); 
        gainA.gain.exponentialRampToValueAtTime(0.001, now + 0.08 + (velocity * 0.05)); 

        // 接触音：瞬间消失 (0.01秒)，只留个"嗒"的头
        gainB.gain.setValueAtTime(0, now);
        gainB.gain.linearRampToValueAtTime(0.15 * velocity, now + 0.001);
        gainB.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

        // --- 6. 滤波器 (把声音变"闷"一点，去数码味) ---
        // 钢珠撞击不需要太高的高频
        const filter = this.ctx.createBiquadFilter();
        if (type === 'cryo') {
            // [针对冰的优化]：使用高通滤波器
            // 冰块撞击不仅没有低频，还需要突出高频的"脆"
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(1500, now); // 切掉 1500Hz 以下的所有声音
            
            // 冰的撞击声包络要更短、更脆
            gainA.gain.cancelScheduledValues(now);
            gainA.gain.setValueAtTime(0, now);
            gainA.gain.linearRampToValueAtTime(0.6 * velocity, now + 0.002);
            gainA.gain.exponentialRampToValueAtTime(0.001, now + 0.1); // 衰减极快
        } else {
            // 其他类型的原有逻辑 (Lowpass 模拟实心物体)
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000 + (velocity * 3000), now);
        }     
        // 连接路径
        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gainA); // A为主通道控制
        // B的音量单独控制后也汇入 A 的通道或者直接输出，这里简单起见各自连接 Gain
        // 修正连接逻辑：
        oscA.disconnect(); oscB.disconnect();
        
        oscA.connect(gainA);
        gainA.connect(filter);
        
        oscB.connect(gainB);
        gainB.connect(filter);

        filter.connect(this.masterGain);

        // 播放
        oscA.start(now);
        oscA.stop(now + 0.15);
        oscB.start(now);
        oscB.stop(now + 0.15);
    }

    /**
     * 播放发射弹珠的音效 (最终版：干练、清脆、低调爽感)
     * 听感：类似消音手枪或高级机械开关的 "Thwip" 声
     */
    playShoot() {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        
        // 微调：每次发射有极小的音调变化 (+/- 5%)，防止听觉疲劳
        const randomDetune = 1.0 + (Math.random() - 0.5) * 0.1;

        // --- Layer 1: 机械撞针 (The Click) ---
        // 使用高通噪音，制造极短的“咔哒”声
        // 这是“干脆”的关键，负责高频的清晰度
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(2000, now); // 只留2000Hz以上的高频
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.2, now); // 音量适中，不刺耳
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03); // 极短！30ms内消失

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + 0.05);

        // --- Layer 2: 气动推进 (The Thump) ---
        // 使用正弦波，频率极低且快速下潜
        // 制造“噗”的一声，提供力度但没有明显的“Pew”调子
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine'; // 正弦波最干净，不抢戏
        
        // 频率从中低频(180Hz) 瞬间跌落到 超低频(50Hz)
        // 这个范围很低，人耳听起来更像是震动而不是声音
        osc.frequency.setValueAtTime(180 * randomDetune, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08); // 80ms内跌落到底

        oscGain.gain.setValueAtTime(0, now);
        oscGain.gain.linearRampToValueAtTime(0.5, now + 0.005); // 瞬间起音 (Punchy)
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08); // 快速收尾 (Tight)

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
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
        const t = this.ctx.currentTime;
        
        // 1. 創建噪聲源
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        
        // 2. 創建濾波器 (Highpass 模擬撕裂聲)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        
        // --- 修改点 A: 降低起始频率 ---
        // 原来是 1000，改小一點（例如 600-800）可以让声音没那么尖锐刺耳
        filter.frequency.setValueAtTime(800, t); 
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.2); 

        // 3. 音量包絡 (ADSR)
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        
        // --- 修改点 B: 降低峰值音量 ---
        // 原来是 0.8 (極大聲)，建議改成 0.2 或 0.25
        gain.gain.linearRampToValueAtTime(0.25, t + 0.05); 
        
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4); 

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        noise.start(t);
        noise.stop(t + 0.5);
    }

    /**
     * 播放敌人被击中音效
     */
    /**
     * 播放敌人被击中音效 (优化版：低沉冲击 + 破碎质感)
     */
    /**
     * 播放敌人被击中音效 (支持元素材质区分)
     * @param {string} type - 伤害类型 ('normal', 'cryo', 'pyro', 'lightning', 'pierce')
     */
    /**
     * 播放敌人被击中音效 (v3.0: ⚡电流FM合成 & ❄️冰晶碎裂增强)
     * @param {string} type - 伤害类型
     */
    playEnemyHit(type = 'normal') {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        const detune = 0.9 + Math.random() * 0.2; 

        // === Layer A: 基础物理打击 (所有类型都有的"肉感") ===
        const oscLow = this.ctx.createOscillator();
        const gainLow = this.ctx.createGain();
        oscLow.type = 'sine';
        oscLow.frequency.setValueAtTime(150 * detune, now);
        oscLow.frequency.exponentialRampToValueAtTime(40, now + 0.12); // 快速下潜

        gainLow.gain.setValueAtTime(0, now);
        gainLow.gain.linearRampToValueAtTime(0.4, now + 0.005);
        gainLow.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        oscLow.connect(gainLow);
        gainLow.connect(this.masterGain);
        oscLow.start(now);
        oscLow.stop(now + 0.15);

        // === Layer B: 元素特征 (重写部分) ===

        if (type === 'lightning') {
            // ⚡ 闪电: Layer 1 (FM撕裂) + Layer 2 (高频滋滋)
            
            // --- Layer 1: FM 合成 (保留之前的撕裂主音) ---
            // 负责制造 "Pew/Zwap" 的动态感
            const carrier = this.ctx.createOscillator();
            const modulator = this.ctx.createOscillator();
            const modGain = this.ctx.createGain();
            const mainGain = this.ctx.createGain();

            carrier.type = 'sawtooth';
            carrier.frequency.setValueAtTime(600 * detune, now);
            carrier.frequency.linearRampToValueAtTime(200, now + 0.15);

            modulator.type = 'square';
            modulator.frequency.setValueAtTime(120, now); // 震动频率
            modGain.gain.setValueAtTime(800, now);        // 震动深度
            
            // 稍微降低 Layer 1 音量，为 Layer 2 留空间
            mainGain.gain.setValueAtTime(0.15, now);
            mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

            modulator.connect(modGain);
            modGain.connect(carrier.frequency);
            carrier.connect(mainGain);
            mainGain.connect(this.masterGain);

            carrier.start(now); modulator.start(now);
            carrier.stop(now + 0.2); modulator.stop(now + 0.2);

            // --- Layer 2: 高频噪音 (The Sizzle/Zzzzt) ---
            // 负责制造 "滋滋" 的电流接触声
            const noise = this.ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            
            const noiseFilter = this.ctx.createBiquadFilter();
            // 使用带通滤波器 (Bandpass) 提取高频电流声
            noiseFilter.type = 'bandpass';
            noiseFilter.Q.value = 1.5; // 稍微窄一点，让声音更尖锐
            // 频率随机化 (3000Hz ~ 6000Hz)，模拟每次电弧的不稳定
            noiseFilter.frequency.setValueAtTime(3000 + Math.random() * 3000, now);
            
            // 还可以让滤波器频率快速滑动，增加"穿透感"
            noiseFilter.frequency.exponentialRampToValueAtTime(1000, now + 0.1);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.35, now); // 噪音层要够亮
            // 衰减极快，模拟火花瞬间熄灭
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08); 

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            
            noise.start(now);
            noise.stop(now + 0.15);
        }
        else if (type === 'cryo') {
            // ❄️ 冰冻打击 V4：多重微粒碎裂 (Granular Shatter)
            // 钢管是一个长音，冰是无数个短促的崩裂音组合
            
            // 1. 生成 3-4 个极短的随机高频 "Pop" 音 (模拟裂纹扩散)
            const crackCount = 3 + Math.floor(Math.random() * 2);
            
            for (let i = 0; i < crackCount; i++) {
                // 稍微错开时间，制造“咔嚓”的颗粒感，而不是“叮”的一声
                const t = now + (i * 0.015); 
                
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                // 使用三角波 (Triangle) 比正弦波更尖锐，有点玻璃感
                osc.type = 'triangle';
                
                // 频率极高：2500Hz ~ 5000Hz (钢管通常在 800-1500Hz)
                // 每一个颗粒的频率都不同
                const freq = 2500 + Math.random() * 2500;
                osc.frequency.setValueAtTime(freq, t);
                
                // 音量包络：极短！15毫秒内消失
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.15, t + 0.002); // 瞬间起音
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03); // 瞬间停止 (去除余音是关键)
                
                // 高通滤波：切掉所有低频，防止出现“闷”的声音
                const filter = this.ctx.createBiquadFilter();
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

// --- 工具类 ---

// ==================== 游戏主类 ====================

class Game {
    // (需求1 & 2) 通用资源飞入动画
    ui_playResourceFlyEffect(startX, startY, amount) {
        if (amount <= 0) return;
        
        const flyer = document.createElement('div');
        flyer.innerHTML = `🔮 +${amount}`;
        flyer.className = 'fixed font-bold text-amber-400 text-lg pointer-events-none z-[9999]';
        flyer.style.left = `${startX}px`;
        flyer.style.top = `${startY}px`;
        flyer.style.textShadow = '0 0 5px rgba(245,158,11,0.8), 0 2px 4px rgba(0,0,0,0.5)';
        flyer.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        document.body.appendChild(flyer);

        // 目标位置：顶部的资源图标
        let targetEl = document.getElementById('run-currency-display');
        if (!targetEl || targetEl.offsetParent === null) {
            targetEl = document.getElementById('meta-currency-display');
        }
        
        const targetRect = targetEl 
            ? targetEl.getBoundingClientRect() 
            : { left: window.innerWidth - 60, top: 20, width: 0, height: 0 };

        void flyer.offsetWidth;

        flyer.style.transform = `translate(${targetRect.left - startX}px, ${targetRect.top - startY}px) scale(0.5)`;
        flyer.style.opacity = '0';

        setTimeout(() => {
            flyer.remove();
            if (targetEl) {
                const parent = targetEl.parentElement;
                parent.style.transform = 'scale(1.2)';
                parent.style.filter = 'brightness(1.5)';
                setTimeout(() => {
                    parent.style.transform = 'scale(1)';
                    parent.style.filter = 'none';
                }, 150);
            }
        }, 800);
    }

    /**
     * 构造函数：初始化游戏状态、Canvas 和事件监听器
     */
    constructor() {
        this.variantLevels = {
            flying_sword: 1 // 默认为 1 级，后续如有升级逻辑可修改此值
        };
        this.marbleSizeBonus=0;
        this.isVisualEffectActive = false;
        this.isWheelSpinning = false;
        this.canvas = document.getElementById('gameCanvas'); this.ctx = this.canvas.getContext('2d');
        this.sys_resize();
        // 窗口大小变化时重新调整 Canvas 大小并重新初始化弹珠台布局
        window.addEventListener('resize', () => { this.sys_resize(); if (this.phase === 'gathering') this.phase_gathering_initPachinko(); });
        this.ui = new UIManager();
        this.boardTilt = {
            current: { x: 0, y: 0 }, // 当前平滑后的倾斜值 (-1 ~ 1)
            target: { x: 0, y: 0 },  // 目标倾斜值 (来自传感器或鼠标)
            enabled: false           // 是否已启用陀螺仪
        };
        // 游戏状态变量
        this.phase = 'meta'; // 当前阶段 ('meta', 'selection', 'gathering', 'combat', 'gameover')
        this.marblesPool = []; // 弹珠池
        this.selectedMarbles = []; // 已选择的弹珠 (3个)
        this.marbleQueue = []; // 待收集的弹珠队列
        this.ammoQueue = []; // 炼金完成的弹药配置队列
        this.collectionBeams = [];
        this.skillPoints = 0;
        // [新增] 动态难度系数 (默认为 1.0)
        this.difficultyGrowthFactor = 1.0; 
        // [新增] 玩家战力评估值 (用于调试或UI显示)
        this.currentPlayerPower = 0;

        //  特性状态管理
        this.pinkPegCount = 0;      // 粉色钉子数量
        this.hasCombatWall = false; // 是否拥有战斗底墙
        this.unlockedSlots = ['skill_point','wheel'];
        // this.unlockedSlots = ['wheel'];  
        this.slotCount = 1;

        // 游戏实体列表
        this.pegs = []; // 钉子 (收集阶段)
        this.enemies = []; // 敌人 (战斗阶段)
        this.specialSlots = []; // 特殊槽位 (收集阶段)
        this.dropBalls = []; // 正在下落的弹珠 (收集阶段)
        this.projectiles = []; // 正在飞行的弹丸 (战斗阶段)
        this.particles = []; // 粒子特效
        this.shockwaves = []; // 冲击波特效
        this.floatingTexts = []; // 浮动文字 (如 HIT)
        this.rainbowBuffer = []; // 彩虹弹珠分裂的碎片缓存
        this.lightningBolts = []; // 闪电特效
        this.pendingShots = []; // 待发射的弹丸 (用于多重发射)
        this.burstQueue = []; // 散射弹丸队列
        this.sonSwordQueue = []; // 子剑生成队列
        this.swordQis = []; // 剑气数组
        this.ownedRelics = []; // 玩家当前拥有的遗物 ID 列表
        this.spores = []; // 新增：存儲分身孢子
        this.fireWaves = []; // 新增火焰波數組
        this.sonSwords = [];
        this.windAnchors = []; // 风属性锥点数组
        this.activeWindMatrices = []; // 活跃法阵列表 (支持多实例并行)
        this.windMatrixDuration = 40; // 法阵激活持续帧数 (约0.6秒)
        this.screenShake = 0; // 屏幕震动强度
        // --- [修改] 发射与装填物理状态 ---
        this.isChargingShot = false;    // 蓄力吸收中
        this.chargeProgress = 0;        // 0 -> 1
        this.pendingFireVelocity = null;

        this.isReloading = false;       // 装填抓取中
        this.reloadProgress = 0;        // 0 -> 1
        
        this.orbitalAngle = 0;          // 当前轨道旋转角度 (弧度)
        this.spinBoost = 0;             // 额外旋转速度 (受撞击增加)
        
        // [新增] 伤害数字显示开关
        this.showDamageNumbers = true;  // 默认开启
        this.energyOrbs = []; //  存儲能量球
        this.fortuneWheel = new FortuneWheel(this);
        //  初始化所有細分權重
        this.unlockedWeights = { ...CONFIG.probabilities };
        
        // 下一輪保證出現的彈珠類型列表
        this.guaranteedNextRound = [];

        // 输入状态
        this.isDragging = false; 
        this.dragStart = new Vec2(0,0); 
        this.dragCurrent = new Vec2(0,0); 
        this.lastMousePos = new Vec2(0,0); 
        this.currentSession = null; // 当前收集会话
        this.isTiltingGrip = false;
        this.gripStartPos = new Vec2(0, 0); // 抓取起始点
        // 游戏统计和控制
        this.gameOver = false; 
        this.defeatLineY = 570; // 敌人到达此线游戏失败
        this.timeScale = 1.0; // 时间缩放 (加速/减速)
        this.round = 1; // 当前波数
        this.score = 0; // 分数
        this.scoreMultiplier = 1.0; // 分数乘数
        this.hudExpanded = false; // 战斗 HUD 是否展开
        this.roundDamage = 0; // 本回合造成的伤害
        this.prevRoundDamage = 0; // 上回合造成的伤害
        this.currentShotDamage = 0; // 当前子弹造成的伤害
        this.currentShotDamageByAttr = {}; // 当前子弹各属性造成的伤害
        this.shotDamageHistory = []; // 子弹伤害历史记录 (最多保存3个)
        this.shotIdCounter = 0; // 子弹ID计数器
        this.shotDamageMap = new Map(); // 每个子弹ID对应的伤害统计 {shotId: {total, byAttr}}
        this.roundDamageHistory = []; // 回合伤害历史记录 [{round: 1, shots: [...]}]
        this.currentViewingRound = 0; // 当前查看的回合索引 (0表示当前回合)

        // --- 新增：敵人回合控制變量 ---
        this.isEnemyTurn = false;      // 是否處於敵人行動階段
        this.enemyTurnTimer = 0;       // 計時器
        //  扫描波相关变量
        this.enemyWaveY = 0;       // 波当前的 Y 坐标
        this.enemyWaveActive = false; // 波是否正在运行
        this.waveSpeed = 4;        // 波的移动速度 (像素/帧)
        this.waveMomentumTimer = 0;
        this.nextRoundHpMultiplier = 1; // 默认为 1 (正常血量)
        // ---------------------------

        this.baseTimeScale = 1.0;
        this.frameDamageAccumulator = 0; // 记录当前帧造成的总伤害
        this.slowMotionTimer = 0;        // 慢动作持续时间的计时器
        this.slowMotionThreshold = 100;  // 【可调】触发慢动作的伤害阈值

        this.sys_setupInputs(); 

        // --- [META] 存档数据初始化 ---
        this.saveData = {
            currency: 0,        // 能量精粹
            upgrades: {},       // 已购买的升级项 { id: level }
            temporaryUpgrades: {}, // 临时增强 { id: level } 每局重置
            unlockedItems: [],  // 已解锁项目
            highScore: 0
        };
        this.runCurrency = 0;   // 本局获得的货币
        this.sys_loadSaveData(); // 读取存档

        // --- [META] 不再直接开始游戏，而是显示主界面 ---
        this.phase_switchPhase('meta'); 
        
        // 启动游戏主循环 (修复了原始的 this.loop is not a function 错误
        this.currentRows = CONFIG.gameplay.rows; 
        this.boardBottomY = 0;
        this.sys_loop();
        this.truthBook = new TruthBook(this);
        this.trainingGround = new TrainingGround(this);
    }

    ui_openTruthBook() {
        this.phase_switchPhase('truth_book');
        const overlay = document.getElementById('phase-truth-book');
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden-phase');
        overlay.classList.add('active-phase');
    }

    ui_closeTruthBook() {
        const overlay = document.getElementById('phase-truth-book');
        overlay.style.display = 'none';
        overlay.classList.remove('active-phase');
        overlay.classList.add('hidden-phase');
        this.truthBook.active = false;
        this.phase_switchPhase('meta');
    }
    // --- 在 Game 类中新增以下方法 ---

    /**
     * @method calc_getPeakAverageDamage
     * @description 计算最高三轮伤害的平均值，用于动态调整敌人血量。
     */
    calc_getPeakAverageDamage() {
        // 1. 从历史记录中提取每轮总伤害
        const damages = this.roundDamageHistory.map(r => {
            return r.shots.reduce((sum, s) => sum + (s.total || 0), 0);
        });
        
        // 2. 包含上一轮的实时伤害
        if (this.prevRoundDamage > 0) damages.push(this.prevRoundDamage);
        
        if (damages.length === 0) return 0;
        
        // 3. 降序排列并取前 3 名
        damages.sort((a, b) => b - a);
        const top3 = damages.slice(0, 3);
        const sum = top3.reduce((a, b) => a + b, 0);
        
        return sum / top3.length;
    }

    /**
     * @method calculatePlayerExpectedDamage
     * @description 计算玩家当前弹药队列的平均预期伤害 (DDA 核心算法)
     */
    combat_calculatePlayerExpectedDamage() {
        if (this.ammoQueue.length === 0) return 0;

        // 1. 计算每一发弹药的单发期望评分 (Raw Score)
        // 公式: 伤害 * (1 + 连射数 + 特效加成)
        const scores = this.ammoQueue.map(recipe => {
            let specialBonus = 0;
            if (recipe.explosive) specialBonus += 2; // 爆炸权重 +2
            if (recipe.cryo > 0 || recipe.pyro > 0 || recipe.isLaser) specialBonus += 1; // 元素权重 +1
            
            // 基础伤害 * (1 (本体) + 连射次数 + 特效系数)
            // 注意：multicast 是额外发射次数，所以总量是 1 + multicast
            return (recipe.damage || 2) * (1 + (recipe.multicast || 0) + specialBonus);
        });

        // 如果样本太少 (<3)，直接算平均值，不进行统计学剔除
        if (scores.length < 3) {
            return scores.reduce((a, b) => a + b, 0) / scores.length;
        }

        // 2. 排序并去除最高/最低值 (Trimmed Mean)
        scores.sort((a, b) => a - b);
        // 去掉第一个(最低)和最后一个(最高)
        const trimmedScores = scores.slice(1, scores.length - 1);

        // 3. 计算方差和标准差 (Variance Method)
        const n = trimmedScores.length;
        if (n === 0) return 0; // 防止切空

        const mean = trimmedScores.reduce((a, b) => a + b, 0) / n;
        const variance = trimmedScores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);

        // 4. 剔除离群值 (排除落在 Mean ± 1.5倍标准差 之外的数值)
        // 1.5倍标准差通常能涵盖大多数正常波动，排除极端运气值
        const filteredScores = trimmedScores.filter(val => Math.abs(val - mean) <= (stdDev * 1.5 || 1)); // ||1 防止标准差为0

        // 5. 计算最终平均值
        if (filteredScores.length === 0) return mean; // 如果全被剔除了(极其罕见)，返回修剪后的平均值
        
        const finalAverage = filteredScores.reduce((a, b) => a + b, 0) / filteredScores.length;
        
        console.log(`[DDA] 战力评估 -> 原始: ${scores.length}, 过滤后: ${filteredScores.length}, 最终评分: ${finalAverage.toFixed(1)}`);
        return finalAverage;
    }

    /**
     * @method evaluateAndAdjustDifficulty
     * @description 对比玩家战力与敌人期望血量，动态调整难度系数
     */
    calc_evaluateAndAdjustDifficulty() {
        // 前 3 回合不调整，让系统预热
        if (this.round < 3) return;

        this.currentPlayerPower = this.combat_calculatePlayerExpectedDamage();

        // 1. 计算当前敌人的期望血量 (Weighted HP Expectation)
        const b = CONFIG.balance;
        // 这里的 enemyBaseHp 和 Growth 是基础配置
        const rawGrowthHp = b.enemyBaseHp + (this.round * b.enemyHpPerRound);
        
        // 计算加权期望倍率：普通怪(1) + 精英(7 * 5%) + BOSS(25 * 1% 估算)
        // 假设精英概率 0.05, Boss 概率在普通关卡视为 0 (或极低)
        const weightMultiplier = 1.0 * 0.95 + b.eliteHpMult * 0.05; 
        
        const expectedEnemyHp = rawGrowthHp * weightMultiplier;

        // 2. 判定逻辑
        // 如果玩家的 [单发平均期望伤害] 低于 [敌人加权平均血量] 的 60%
        // 说明玩家可能需要两发甚至三发子弹才能打死一个普通怪，处于劣势
        const threshold = expectedEnemyHp * 0.6;

        if (this.currentPlayerPower < threshold) {
            // 玩家太弱 -> 降低成长速度
            // 并不直接减半当前血量，而是减半“成长系数”
            // 这样难度曲线会变得平缓，给玩家喘息机会
            this.difficultyGrowthFactor = 0.5;
            showToast("检测到战力不足，敌人成长减缓...", 2000);
            console.log(`[DDA] 难度降低! 玩家战力 ${this.currentPlayerPower.toFixed(1)} < 阈值 ${threshold.toFixed(1)}`);
        } else {
            // 恢复正常成长
            this.difficultyGrowthFactor = 1.0;
        }
    }


    // 1. 汇报伤害（供敌人受伤时调用）
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_reportDamage.
     * @param {any} amount - TODO: Describe this parameter.
     */
    combat_reportDamage(amount) {
        this.frameDamageAccumulator += amount;
    }
    // --- [新增] 动态阈值计算 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for calc_calculateDynamicThreshold.
     */
    calc_calculateDynamicThreshold() {
        // 如果场上没敌人，设置一个极高值防止误触
        if (this.enemies.length === 0) return 999999;

        let totalCurrentHP = 0;
        let totalMaxHP = 0;
        let aliveCount = 0;

        // 1. 统计当前场上敌人的血量数据
        for (const enemy of this.enemies) {
            // 确保只统计活着的敌人
            if (!enemy.isDead && enemy.hp > 0) {
                totalCurrentHP += enemy.hp;
                totalMaxHP += enemy.maxHp;
                aliveCount++;
            }
        }
        
        if (aliveCount === 0) return 999999;

        // --- [配置参数区域] 可根据手感微调 ---
        // 方案：阈值 = (当前总血量 * A%) * 权重1 + (最大总血量 * B%) * 权重2
        
        const percentCurrent = 0.10; // 定义为：造成当前剩余总血量的 10% 伤害算“重击”
        const percentMax = 0.05;     // 定义为：造成最大总血量的 5% 伤害算“重击”
        
        const wCurrent = 0.7;        // 权重：更看重“当前血量”的比例 (70%)
        const wMax = 0.3;            // 权重：最大血量的比例占 (30%)
        
        const minThreshold = 25;     // 【保底值】防止敌人剩1血时，打1血就慢放，太频繁会晕

        // 2. 计算两部分的基准
        const valBasedOnCurrent = totalCurrentHP * percentCurrent;
        const valBasedOnMax = totalMaxHP * percentMax;

        // 3. 加权混合
        let finalThreshold = (valBasedOnCurrent * wCurrent) + (valBasedOnMax * wMax);

        // 4. 应用保底值
        return Math.max(minThreshold, finalThreshold);
    }
    // 2. 更新慢动作逻辑（放在 update 中调用）
    /**
     * [AUTO-GENERATED] TODO: Add a description for ui_updateSlowMotion.
     */
    ui_updateSlowMotion() {
        const dynamicThreshold = this.calc_calculateDynamicThreshold();
        // 1. 触发逻辑
        if (this.frameDamageAccumulator > dynamicThreshold) {
            this.slowMotionTimer = 12; // 慢动作持续约 0.6秒
            // 触发瞬间强制降速，这里可以用固定值 0.1，保证打击感
            this.timeScale = 0.1; 
            console.log(`慢动作触发! 伤害: ${Math.floor(this.frameDamageAccumulator)} > 阈值: ${Math.floor(dynamicThreshold)}`);
        }

        // 清空当帧累计
        this.frameDamageAccumulator = 0;

        // 2. 恢复逻辑
        if (this.slowMotionTimer > 0) {
            // 倒计时阶段
            this.slowMotionTimer--;
            // 保持慢速 (或者你也可以让它在这里就开始缓慢回升)
        } else {
            // 倒计时结束，开始恢复正常
            
            // 如果当前速度 不等于 玩家设定的基础速度
            if (Math.abs(this.timeScale - this.baseTimeScale) > 0.01) {
                
                // 使用插值慢慢恢复 (lerp)
                // 0.1 是恢复速率，越大恢复越快
                this.timeScale += (this.baseTimeScale - this.timeScale) * 0.1;

                // 如果非常接近了，就直接归位，避免浮点数抖动
                if (Math.abs(this.timeScale - this.baseTimeScale) < 0.01) {
                    this.timeScale = this.baseTimeScale;
                }
            } else {
                // 确保完全对齐
                this.timeScale = this.baseTimeScale;
            }
        }
    }
    /**
     * @method loop
     * @description 游戏主循环
     */
    /**
     * [SYS] 游戏主循环，由 requestAnimationFrame 驱动。
     * 负责更新游戏状态、渲染所有实体和 UI。
     */
    /**
     * [SYS] 游戏主循环，由 requestAnimationFrame 驱动。
     * 负责更新游戏状态、渲染所有实体和 UI。
     */
    sys_loop() {
        const timeScale = this.timeScale; 

        // 处理震动衰减
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.9; // 快速衰减
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        this.ctx.save();
        


        // 应用震动偏移
        this.ctx.translate(shakeX, shakeY); 

        // 1. 基础渲染准备
        this.render_clearCanvas();

        // 2. 全局状态更新
        const smoothSpeed = 0.05 * timeScale;
        this.boardTilt.current.x += (this.boardTilt.target.x - this.boardTilt.current.x) * smoothSpeed;
        this.boardTilt.current.y += (this.boardTilt.target.y - this.boardTilt.current.y) * smoothSpeed;

        // 3. 背景层渲染
        if (this.phase !== 'combat' && this.phase !== 'training') {
            this.render_background();
        }

        // 4. 阶段逻辑与渲染分发
if (this.phase === 'truth_book') {
	            this.truthBook.update();
	        }
	        if (this.phase === 'training') {
	            this.trainingGround.update();
	        }
        switch (this.phase) {
            case 'gathering':
                this.phase_gathering_update(timeScale);
                break;
            case 'training':
            case 'combat':
                this.phase_combat_update(timeScale);
                break;
        }

        // 5. 特效与文字层渲柑
        this.render_floatingTexts(timeScale);
        
        // 5.5 风属性锥点渲柑（仅在战斗阶段或试炼场）
        if (this.phase === 'combat' || this.phase === 'training') {
            this.render_windAnchors();
            
            // 5.6 风属性法阵激活状态更新与渲柑 (支持多实例并行)
            for (let i = this.activeWindMatrices.length - 1; i >= 0; i--) {
                const matrix = this.activeWindMatrices[i];
                if (matrix.active) {
                    matrix.timer--;
                    
                    // 渲染该法阵实例的预兆特效
                    this.render_singleWindMatrix(matrix);
                    
                    // 倒计时结束，触发真正的技能
                    if (matrix.timer <= 0) {
                        matrix.active = false;
                        if (matrix.onComplete) matrix.onComplete();
                        // 从活跃列表中移除
                        this.activeWindMatrices.splice(i, 1);
                    }
                }
            }
        }

        // 6. 下一帧请求
        this.ctx.restore(); 
        requestAnimationFrame(() => this.sys_loop());
    }

    /**
     * [RENDER] 清理画布并绘制背景色。
     */
    render_clearCanvas() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = CONFIG.colors.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * [RENDER] 绘制背景网格。
     */
    render_background() {
        this.ctx.save();
        const gridSpacing = 40;
        const tiltX = -this.boardTilt.current.x * 15; 
        const tiltY = this.boardTilt.current.y * 10;
        
        this.ctx.strokeStyle = 'rgba(71, 85, 105, 0.15)'; 
        this.ctx.lineWidth = 1;

        for (let x = (tiltX % gridSpacing); x < this.width; x += gridSpacing) {
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); this.ctx.stroke();
        }
        for (let y = (tiltY % gridSpacing); y < this.height; y += gridSpacing) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y); this.ctx.stroke();
        }
        this.ctx.restore();
    }

    /**
     * [RENDER] 渲染风属性锥点（独立渲染层）
     */
    /**
     * [RENDER] 绘制风道流速底色
     */
    drawWindTunnelFlow(rect, isHorizontal) {
        const offset = (Date.now() / 15) % 80; // 随时间位移
        this.ctx.save();
        
        // [优化]：不再使用 clip，而是让流动线横穿全屏
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 2;
        
        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;

        if (isHorizontal) {
            // 水平流动线：横跨整个屏幕宽度
            for (let x = -80; x < canvasW + 80; x += 40) {
                this.ctx.beginPath();
                this.ctx.moveTo(x + offset, rect.y);
                this.ctx.lineTo(x + offset - 30, rect.y + rect.h);
                this.ctx.stroke();
            }
        } else {
            // 垂直流动线：横跨整个屏幕高度
            for (let y = -80; y < canvasH + 80; y += 40) {
                this.ctx.beginPath();
                this.ctx.moveTo(rect.x, y + offset);
                this.ctx.lineTo(rect.x + rect.w, y + offset - 30);
                this.ctx.stroke();
            }
        }
        this.ctx.restore();
    }

    render_windAnchors() {
        if (this.windAnchors && this.windAnchors.length > 0) {
            this.ctx.save();
            
            // 增强连线视觉：1.5倍宽度虚线 + 发光
            const linePulse = (Math.sin(Date.now() / 400) + 1) / 2;
            this.ctx.strokeStyle = 'rgba(52, 211, 153, ' + (0.5 + linePulse * 0.3) + ')';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([8, 12]);
            this.ctx.shadowBlur = 10 + linePulse * 5;
            this.ctx.shadowColor = '#34d399';
            
            // [属性特效]：在连线上方绘制微小的风纹粒子
            if (Math.random() > 0.8) {
                const a1 = this.windAnchors[Math.floor(Math.random() * this.windAnchors.length)];
                const a2 = this.windAnchors[Math.floor(Math.random() * this.windAnchors.length)];
                if (a1 !== a2) {
                    const lerp = Math.random();
                    const px = a1.x + (a2.x - a1.x) * lerp;
                    const py = a1.y + (a2.y - a1.y) * lerp;
                    this.spawn_createParticle(px, py, '#34d399', 'spark');
                }
            }
            
            // 连线
            if (this.windAnchors.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.windAnchors[0].x, this.windAnchors[0].y);
                for (let i = 1; i < this.windAnchors.length; i++) {
                    this.ctx.lineTo(this.windAnchors[i].x, this.windAnchors[i].y);
                }
                if (this.windAnchors.length === 4) this.ctx.closePath();
                this.ctx.stroke();
            }
            
            // 添加粒子扩散动画（防止被敌人遮挡）
            this.windAnchors.forEach((a, idx) => {
                if (Math.random() < 0.1) { // 10%概率生成粒子
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 5 + Math.random() * 10;
                    const px = a.x + Math.cos(angle) * radius;
                    const py = a.y + Math.sin(angle) * radius;
                    this.spawn_createParticle(px, py, '#34d399', 'spark');
                }
            });
            
            // 绘制锥点（增强视觉效果）
            this.windAnchors.forEach((a, idx) => {
                const pulse = (Math.sin(Date.now() / 200 + idx) + 1) / 2;
                
                // 绘制外圈发光
                this.ctx.save();
                this.ctx.globalAlpha = 0.3 + pulse * 0.3;
                this.ctx.fillStyle = '#34d399';
                this.ctx.shadowBlur = 15 + pulse * 10;
                this.ctx.shadowColor = '#34d399';
                this.ctx.beginPath();
                this.ctx.arc(a.x, a.y, 8 + pulse * 4, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                
                // 绘制主体
                this.ctx.save();
                this.ctx.fillStyle = '#d1fae5';
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = '#34d399';
                this.ctx.beginPath();
                this.ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 绘制中心亮点
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(a.x, a.y, 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                
                // 编号 (1-4)，让玩家知道进度
                this.ctx.save();
                this.ctx.fillStyle = '#34d399';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.shadowBlur = 5;
                this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
                this.ctx.fillText(idx + 1, a.x + 8, a.y - 8);
                this.ctx.restore();
            });
            this.ctx.restore();
        }
    }

    /**
     * [SPAWN] 持续生成风属性技能粒子
     * @param {string} type - 法阵类型
     * @param {object} rect - 法阵区域
     * @param {number} progress - 激活进度 (0-1)
     */
    spawn_windSkillParticles(type, rect, progress) {
        // 生成频率随进度增加
        if (Math.random() > 0.3 + progress * 0.6) return;

        const isHorizontal = rect.w > rect.h;
        
        // 位置：随机分布在法阵内
        const px = rect.x + Math.random() * rect.w;
        const py = rect.y + Math.random() * rect.h;
        
        // 强制使用全屏延伸位置（如果是风道）
        const finalPx = type === 'tunnel' && isHorizontal ? (Math.random() * this.canvas.width) : px;
        const finalPy = type === 'tunnel' && !isHorizontal ? (Math.random() * this.canvas.height) : py;
        
        const p = this.spawn_createParticle(finalPx, finalPy, '#f0fdf4', 'line');
        if (!p) return;
        
        if (type === 'tunnel') {
            // === 风道粒子：像针一样的气流 ===
            const speed = 25 + Math.random() * 15; // 极快速度
            
            if (isHorizontal) {
                p.vel = new Vec2(speed, 0); 
                p.scale = { x: 40 + Math.random() * 40, y: 0.5 }; // 拉得很长且细
            } else {
                p.vel = new Vec2(0, speed);
                p.scale = { x: 0.5, y: 40 + Math.random() * 40 };
            }
            
        } else if (type === 'cyclone') {
            // === 旋风粒子：被离心力甩出的碎片 ===
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;
            
            // 从中心向外发射
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (Math.min(rect.w, rect.h) * 0.3);
            
            p.pos.x = cx + Math.cos(angle) * dist;
            p.pos.y = cy + Math.sin(angle) * dist;
            
            // 切线方向极速旋转
            const tanX = -Math.sin(angle);
            const tanY = Math.cos(angle);
            
            const speed = 15 + Math.random() * 10;
            p.vel = new Vec2(tanX * speed, tanY * speed);
            
            p.scale = { x: 2, y: 2 }; // 短而锐利的风刃
            p.color = '#a7f3d0';
        }
        
        p.life = 0.4; // 寿命极短，强调瞬时速度
        p.opacity = 0.8;
    }

    /**
     * [RENDER] 绘制风属性法阵激活特效（预兆/咏唱阶段）
     * @description 根据阵法类型（风道/旋风/爆破）显示不同的视觉预兆效果
     * @param {object} matrix - 法阵实例对象
     */
    /**
     * [VISUAL] 绘制蝴蝶法阵的路径波预览 (内部渲染版)
     */
    render_butterflyPathWave(ctx, anchors, center, progress) {
        ctx.save();
        const alpha = 0.3 + progress * 0.5;
        ctx.strokeStyle = `rgba(52, 211, 153, ${alpha})`;
        ctx.lineWidth = 2 + progress * 2;
        ctx.setLineDash([10, 10]);
        anchors.forEach((a, i) => {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(center.x, center.y);
            ctx.stroke();
            const segments = 8;
            const offset = (Date.now() / 150) % 1;
            for(let j=0; j<segments; j++) {
                const t = (j / segments + offset) % 1;
                const px = a.x + (center.x - a.x) * t;
                const py = a.y + (center.y - a.y) * t;
                ctx.fillStyle = "#fff";
                ctx.beginPath();
                ctx.arc(px, py, 1.5 + progress * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.restore();
    }

    render_singleWindMatrix(matrix) {
        if (!matrix || !matrix.active) return;
        const { timer, maxTimer, rect, type, anchors, tunnelVector } = matrix;
        const t = 1 - (timer / maxTimer);
        const progress = t === 0 ? 0 : Math.pow(2, 10 * t - 10);
        const ctx = this.ctx;
        const time = Date.now();
        this.spawn_windSkillParticles(type, rect, progress);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.moveTo(anchors[0].x, anchors[0].y);
        anchors.forEach(a => {
            const shakeX = (Math.random() - 0.5) * (3 + progress * 5);
            const shakeY = (Math.random() - 0.5) * (3 + progress * 5);
            ctx.lineTo(a.x + shakeX, a.y + shakeY);
        });
        ctx.closePath();
        const flash = Math.sin(time / 20) > 0;
        ctx.strokeStyle = flash ? "#fff" : "#34d399";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20 * progress;
        ctx.shadowColor = "#34d399";
        ctx.stroke();
        if (type === "tunnel") {
            const isHorizontal = rect.w > rect.h;
            const centerX = rect.x + rect.w/2;
            const centerY = rect.y + rect.h/2;
            ctx.beginPath();
            let grad;
            if (isHorizontal) {
                grad = ctx.createLinearGradient(0, centerY - rect.h/2, 0, centerY + rect.h/2);
                ctx.moveTo(rect.x, centerY);
                ctx.lineTo(rect.x + rect.w, centerY);
            } else {
                grad = ctx.createLinearGradient(centerX - rect.w/2, 0, centerX + rect.w/2, 0);
                ctx.moveTo(centerX, rect.y);
                ctx.lineTo(centerX, rect.y + rect.h);
            }
            grad.addColorStop(0, "rgba(52, 211, 153, 0)");
            grad.addColorStop(0.5, "rgba(52, 211, 153, 0.2)");
            grad.addColorStop(1, "rgba(52, 211, 153, 0)");
            ctx.strokeStyle = grad;
            ctx.lineWidth = isHorizontal ? rect.h : rect.w;
            ctx.stroke();
            const arrowCount = 8;
            const arrowSize = 20 + progress * 10;
            const arrowAlpha = 0.4 + progress * 0.6;
            ctx.fillStyle = `rgba(255, 255, 255, ${arrowAlpha})`;
            ctx.strokeStyle = `rgba(52, 211, 153, ${arrowAlpha})`;
            ctx.lineWidth = 2;
            for(let k=0; k<arrowCount; k++) {
                const arrowPos = ((time / 300) + k/arrowCount) % 1;
                ctx.beginPath();
                if (isHorizontal) {
                    const ax = rect.x + arrowPos * rect.w;
                    const ay = centerY;
                    ctx.moveTo(ax - arrowSize, ay - arrowSize/2);
                    ctx.lineTo(ax, ay);
                    ctx.lineTo(ax - arrowSize, ay + arrowSize/2);
                } else {
                    const ax = centerX;
                    const ay = rect.y + arrowPos * rect.h;
                    ctx.moveTo(ax - arrowSize/2, ay - arrowSize);
                    ctx.lineTo(ax, ay + arrowSize/2);
                    ctx.lineTo(ax + arrowSize/2, ay - arrowSize);
                }
                ctx.stroke();
            }
        } else if (this.isBowtieShape(anchors)) {
            const intersection = this.getLineIntersectionPoint(anchors[0], anchors[2], anchors[1], anchors[3]);
            if (intersection) {
                this.render_butterflyPathWave(ctx, anchors, intersection, progress);
            }
        } else if (type === 'cyclone') {
            // === 旋风：绞肉机法阵 (Shredder Circle) ===
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;
            const maxR = Math.min(rect.w, rect.h) * 0.45;
            
            ctx.translate(cx, cy);

            // 1. 暴风眼：核心高亮，且剧烈震动
            const shake = (Math.random() - 0.5) * 5 * progress;
            ctx.beginPath();
            ctx.arc(shake, shake, maxR * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; // 纯白核心
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#fff';
            ctx.fill();
            
            // 2. 内层：高速切割刃 (顺时针)
            ctx.save();
            ctx.rotate(time / 50); // 极速旋转
            ctx.beginPath();
            const bladeCount = 6;
            for(let i=0; i<bladeCount; i++) {
                const angle = (i / bladeCount) * Math.PI * 2;
                const r = maxR * 0.6;
                ctx.moveTo(Math.cos(angle)*r, Math.sin(angle)*r);
                ctx.quadraticCurveTo(
                    Math.cos(angle + 0.3) * r * 1.5, 
                    Math.sin(angle + 0.3) * r * 1.5, 
                    Math.cos(angle + 0.6) * r * 0.8, 
                    Math.sin(angle + 0.6) * r * 0.8
                );
            }
            ctx.strokeStyle = '#6ee7b7';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = 'rgba(52, 211, 153, 0.3)';
            ctx.fill();
            ctx.restore();

            // 3. 外层：逆向符文环 (产生视觉撕裂感)
            ctx.save();
            ctx.rotate(-time / 100); 
            ctx.beginPath();
            ctx.arc(0, 0, maxR * 0.9, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + progress * 0.5})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([20, 30]); 
            ctx.stroke();
            
            for(let j=0; j<4; j++) {
                ctx.rotate(Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(maxR * 0.9, -5);
                ctx.lineTo(maxR * 1.2, 0); 
                ctx.lineTo(maxR * 0.9, 5);
                ctx.fillStyle = '#fff';
                ctx.fill();
            }
            ctx.restore();

            // 文字提示
            ctx.fillStyle = `rgba(255,255,255, ${progress})`;
            ctx.font = "bold 20px Cinzel";
            ctx.textAlign = "center";
            ctx.fillText("SHREDDER", 0, 0);

        } else {
            // 爆破：取消矩形闪烁，仅保留文字提示
            
            // 文字提示
            ctx.fillStyle = `rgba(255,255,255, ${progress})`;
            ctx.font = "bold 20px Cinzel";
            ctx.textAlign = "center";
            ctx.fillText("BURST", rect.x + rect.w/2, rect.y + rect.h/2);
        }

        ctx.restore();
    }

    /**
     * [RENDER] 绘制并更新全局浮动文字。
     * @param {number} timeScale - 时间缩放系数。
     */
    render_floatingTexts(timeScale) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(timeScale);
            this.floatingTexts[i].draw(this.ctx);
            if (this.floatingTexts[i].life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    /**
     * @method resize
     * @description 响应窗口大小变化，调整 Canvas 尺寸和游戏布局参数。
     */
    sys_resize() {
        const container = document.getElementById('game-container'); 
        
        // --- 修改开始：强制 JS 同步窗口高度，解决部分安卓浏览器兼容问题 ---
        // 这一步会覆盖 CSS 的设置，确保 canvas 刚好填满可视区域
        container.style.height = `${window.innerHeight}px`;
        container.style.width = `${window.innerWidth}px`;
        // --- 修改结束 ---

        this.width = this.canvas.width = container.clientWidth; 
        this.height = this.canvas.height = container.clientHeight; 
        
        // 动态调整失败判定线，防止在矮屏幕上太高
        // 建议改为百分比，而不是固定的 -150
        this.defeatLineY = this.height - 120; // 稍微调低一点，给底部 UI 留空间
        
        this.enemyWidth = (this.width / CONFIG.gameplay.enemyCols); 
        this.enemyHeight = this.enemyWidth; 
        this.ui_updateUICache();
        // 如果是在收集阶段，且已经初始化过，可能需要重新计算钉子位置（可选）
        if (this.phase === 'gathering') {
            this.phase_gathering_initPachinko(true); 
        }
    }
    /**
     * @method initGameStart
     * @description 初始化游戏开始状态 (生成初始敌人和进入选择阶段)。
     */
    sys_initGameStart() {
        // [META] 注入局外升级效果
        this.meta_applyUpgrades();

        // 重新生成初始敌人 (sys_resetGame 已经清空了敌人)
        const startY = 80; 
        for(let i=0; i<CONFIG.gameplay.startRows; i++) { 
            this.spawn_spawnEnemyRowAt(startY + i * this.enemyHeight); 
        }
        
        // 进入遗物选择阶段 (命运抉择)
        this.ui_showRelicSelection();
    }

    /**
     * [META] 应用局外升级到当前运行的 CONFIG
     */
    meta_applyUpgrades() {
        if (!this.saveData.upgrades) this.saveData.upgrades = {};
        if (!this.saveData.temporaryUpgrades) this.saveData.temporaryUpgrades = {};
        
        META_SHOP_CONFIG.upgrades.forEach(upgrade => {
            let level = 0;
            // 临时增强从 temporaryUpgrades 读取
            if (upgrade.temporary) {
                level = this.saveData.temporaryUpgrades[upgrade.id] || 0;
            } else {
                // 永久升级从 upgrades 读取
                level = this.saveData.upgrades[upgrade.id] || 0;
            }
            
            if (level > 0) {
                const effectValue = upgrade.effect.valuePerLevel * level;
                setDeepValue(CONFIG, upgrade.effect.path, effectValue, upgrade.effect.type);
            }
        });
        
        console.log("Meta upgrades applied to CONFIG");
    }
    /**
     * [AUTO-GENERATED] TODO: Add a description for sys_resetGame.
     */
    /**
     * [META] 读取存档 (模拟)
     */
    sys_loadSaveData() {
        const saved = localStorage.getItem('echo_alchemist_save');
        if (saved) {
            try {
                this.saveData = JSON.parse(saved);
            } catch(e) { console.error("Save load failed", e); }
        }
        // --- [新增] 开发福利 ---
        if ((this.saveData.currency || 0) < 2000) {
            this.saveData.currency = 2000;
            console.log("DEV: Granted 2000 Energy Essence");
            this.sys_saveData();
        }
        this.ui_updateMetaCurrency();
    }

    /**
     * [META] 保存存档
     */
    sys_saveData() {
        localStorage.setItem('echo_alchemist_save', JSON.stringify(this.saveData));
    }

    /**
     * [META] 增加货币并保存
     */
    meta_addCurrency(amount) {
        this.saveData.currency += amount;
        this.sys_saveData();
        this.ui_updateMetaCurrency();
    }

    /**
     * [UI] 更新主界面的货币显示
     */
    ui_updateMetaCurrency() {
        const el = document.getElementById('meta-currency-display');
        if (el) el.innerText = this.saveData.currency.toLocaleString();
        const runEl = document.getElementById('run-currency-display');
        if (runEl) runEl.innerText = this.runCurrency.toLocaleString();
    }

    /**
     * [META] 点击"开始炼成"按钮
     */
    meta_startRun() {
        this.sys_resetGame(); 
        this.sys_initGameStart();
        // sys_initGameStart 内部已经调用了 ui_showRelicSelection
    }

    /**
     * [META] 打开商店
     */
    meta_openShop() {
        this.phase_switchPhase('shop');
        this.meta_currentShopCategory = Object.keys(META_SHOP_CONFIG.categories)[0];
        this.ui_renderShop();
    }

    /**
     * [UI] 渲染商店内容
     */
    ui_renderShop() {
        const categoryContainer = document.getElementById('shop-category-tabs');
        const itemsContainer = document.getElementById('shop-items-container');
        const currencyDisplay = document.getElementById('shop-currency-display');
        
        if (currencyDisplay) currencyDisplay.innerText = this.saveData.currency.toLocaleString();
        
        // 1. 渲染分类标签
        if (categoryContainer) {
            categoryContainer.innerHTML = '';
            for (let catId in META_SHOP_CONFIG.categories) {
                const cat = META_SHOP_CONFIG.categories[catId];
                const isActive = this.meta_currentShopCategory === catId;
                const btn = document.createElement('button');
                btn.className = `px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${isActive ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`;
                btn.innerHTML = `${cat.icon} ${cat.name}`;
                btn.onclick = () => {
                    this.meta_currentShopCategory = catId;
                    this.ui_renderShop();
                };
                categoryContainer.appendChild(btn);
            }
        }

        // 2. 渲染升级项
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            const upgrades = META_SHOP_CONFIG.upgrades.filter(u => u.category === this.meta_currentShopCategory);
            
            upgrades.forEach(upgrade => {
                const isTemporary = upgrade.temporary || false;
                const currentData = isTemporary ? this.saveData.temporaryUpgrades : this.saveData.upgrades;
                const level = currentData[upgrade.id] || 0;
                const isMax = level >= upgrade.maxLevel;
                const cost = this.meta_calculateUpgradeCost(upgrade, level);
                const canAfford = this.saveData.currency >= cost;

                const card = document.createElement('div');
                card.className = `bg-slate-900/60 border ${isMax ? 'border-slate-700 opacity-80' : 'border-slate-700/50'} p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden group`;
                
                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex gap-3">
                            <div class="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl shadow-inner">${upgrade.icon}</div>
                            <div>
                                <h3 class="font-bold text-slate-100">${upgrade.name}</h3>
                                <p class="text-[10px] text-slate-500 uppercase tracking-wider">LV. ${level} / ${upgrade.maxLevel}</p>
                            </div>
                        </div>
                        ${isMax ? '<span class="text-[10px] bg-slate-800 text-slate-500 px-2 py-1 rounded">MAX</span>' : ''}
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed">${upgrade.desc}</p>
                    <div class="flex justify-between items-center mt-2">
                        <div class="text-[10px] text-slate-500">
                            ${!isMax ? `下一級: <span class="text-amber-400/80">+${upgrade.effect.valuePerLevel}${upgrade.effect.type === 'multiply' ? 'x' : ''}</span>` : '已達最高等級'}
                        </div>
                        ${!isMax ? `
                            <button onclick="game.meta_buyUpgrade('${upgrade.id}')" 
                                    class="px-4 py-2 rounded-lg text-xs font-bold transition-all ${canAfford ? 'bg-amber-500 text-slate-900 hover:scale-105 active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}">
                                ✨ ${cost.toLocaleString()}
                            </button>
                        ` : ''}
                    </div>
                `;
                itemsContainer.appendChild(card);
            });
        }
    }

    /**
     * [META] 计算升级价格
     */
    meta_calculateUpgradeCost(upgrade, level) {
        const c = upgrade.cost;
        if (c.type === 'fixed') return c.values[level] || 0;
        if (c.type === 'linear') return c.base + level * c.growth;
        if (c.type === 'exponential') return Math.floor(c.base * Math.pow(c.growth, level));
        return 0;
    }

    /**
     * [META] 购买升级
     */
    meta_buyUpgrade(upgradeId) {
        const upgrade = META_SHOP_CONFIG.upgrades.find(u => u.id === upgradeId);
        
        // 临时增强和永久升级分开处理
        const isTemporary = upgrade.temporary || false;
        const currentData = isTemporary ? this.saveData.temporaryUpgrades : this.saveData.upgrades;
        const level = currentData[upgradeId] || 0;
        
        if (level >= upgrade.maxLevel) return;
        
        const cost = this.meta_calculateUpgradeCost(upgrade, level);
        if (this.saveData.currency >= cost) {
            this.saveData.currency -= cost;
            currentData[upgradeId] = level + 1;
            this.sys_saveData();
            this.ui_updateMetaCurrency();
            this.ui_renderShop();
            if (window.audio) audio.playTone(800, 'sine', 0.1, 0.3);
            const typeText = isTemporary ? '下一局生效' : `LV.${level + 1}`;
            if (window.showToast) showToast(`购买成功: ${upgrade.name} ${typeText}`);
        } else {
            if (window.showToast) showToast("能量精粹不足");
            if (window.audio) audio.playTone(200, 'sawtooth', 0.1, 0.2);
        }
    }

    sys_resetGame() {
        this.runCurrency = 0; // 重置本局获得的货币
        this.gameOver = false;
        
        // 清空临时增强（游戏结束后重置）
        this.saveData.temporaryUpgrades = {};
        this.sys_saveData();
        this.round = 1;
        this.score = 0;
        this.scoreMultiplier = 1.0;
        
        // [關鍵] 重置解鎖權重回初始狀態
        this.unlockedWeights = { ...CONFIG.probabilities }; // 回到只有 white 和 bounce 的狀態
        this.guaranteedNextRound = [];
        this.ownedRelics = []; // 清空遺物
        
        // 清空實體
        this.enemies = [];
        this.projectiles = [];
        this.dropBalls = [];
        this.ammoQueue = [];
        this.marbleQueue = [];
        this.energyOrbs = [];
        this.spores = [];
        this.currentRows = CONFIG.gameplay.rows;
        this.skillPoints = 0; // 重置
        this.ui.updateSkillPoints(this.skillPoints);

        // 重新生成初始敵人
        this.spawn_spawnEnemyRow(CONFIG.gameplay.startRows);
        
        // 重置 UI
        document.getElementById('combat-message').innerHTML = '';
        document.getElementById('score-num').innerText = '0';
        document.getElementById('round-num').innerText = '1';
    }
    /**
     * @method setupInputs
     * @description 设置所有输入事件监听器（鼠标/触摸、按钮点击）。
     */
    sys_setupInputs() {
        // 辅助函数：获取鼠标/触摸在 Canvas 上的相对位置
        const handler = (e) => {
            const rect = this.canvas.getBoundingClientRect(); 
            let x = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX; 
            let y = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY; 
            
            return new Vec2(x - rect.left, y - rect.top);
        };
        // 绑定输入事件到 Canvas 和 Window
        this.canvas.addEventListener('mousedown', e => this.phase_handleInputStart(handler(e))); 
        this.canvas.addEventListener('touchstart', e => this.phase_handleInputStart(handler(e)), {passive: false});
        window.addEventListener('mousemove', e => this.input_handleInputMove(handler(e), e)); 
        window.addEventListener('touchmove', e => this.input_handleInputMove(handler(e), e), {passive: false});
        window.addEventListener('mouseup', () => this.input_handleInputEnd()); 
        window.addEventListener('touchend', () => this.input_handleInputEnd());
        document.getElementById('confirm-selection-btn').onclick = () => this.ui_confirmSelection(); // 确认选择按钮

        // 速度控制按钮
        const speedBtn = document.getElementById('speed-btn'); 
        speedBtn.onclick = () => { 
            if (this.timeScale === 1.0) this.timeScale = 2.0; 
            else if (this.timeScale === 2.0) this.timeScale = 3.0; 
            else if (this.timeScale === 3.0) this.timeScale = 0.42; 
            else this.timeScale = 1.0; 
            this.baseTimeScale = this.timeScale
            speedBtn.innerText = `⏩ x${this.timeScale}`; // 更新按钮文本
        };
        // 静音按钮
        const muteBtn = document.getElementById('mute-btn'); 
        muteBtn.onclick = () => { 
            audio.resume(); // 确保音频上下文已激活
            const isMuted = audio.toggleMute(); 
            muteBtn.innerText = isMuted ? '🔇' : '🔊'; 
        };
        
        // [新增] 伤害数字开关按钮
        const damageNumbersBtn = document.getElementById('damage-numbers-btn');
        damageNumbersBtn.onclick = () => {
            this.showDamageNumbers = !this.showDamageNumbers;
            damageNumbersBtn.style.opacity = this.showDamageNumbers ? '1' : '0.5';
            showToast(this.showDamageNumbers ? '伤害数字：开启' : '伤害数字：关闭');
        };
        //  陀螺仪权限申请与监听
        // 注意：iOS 13+ 需要用户交互（点击）才能申请权限
        const enableGyro = async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        this.boardTilt.enabled = true;
                        window.addEventListener('deviceorientation', e => this.input_handleOrientation(e));
                    }
                } catch (e) { console.log("Gyro permission failed", e); }
            } else if ('ondeviceorientation' in window) {
                // 非 iOS 设备通常直接支持
                this.boardTilt.enabled = true;
                window.addEventListener('deviceorientation', e => this.input_handleOrientation(e));
            }
        };

        // 将权限申请绑定到第一次点击
        const initialClickHandler = () => {
            enableGyro();
            // 移除监听，避免每次点击都申请
            window.removeEventListener('click', initialClickHandler);
            window.removeEventListener('touchstart', initialClickHandler);
        };
        window.addEventListener('click', initialClickHandler);
        window.addEventListener('touchstart', initialClickHandler);
    }

    //  处理设备倾斜
    /**
     * [AUTO-GENERATED] TODO: Add a description for input_handleOrientation.
     * @param {any} e - TODO: Describe this parameter.
     */
    input_handleOrientation(e) {
        if (!this.boardTilt.enabled) return;
        
        // gamma: 左倾/右倾 (-90 ~ 90)
        // beta:  前倾/后倾 (-180 ~ 180)
        
        // 限制最大倾斜角度 (例如 15度)，并归一化到 -1 ~ 1
        const maxTilt = 2; 
        
        let x = e.gamma || 0;
        let y = e.beta || 0;
        
        // 修正：通常手机竖拿时 beta 约为 45-90度。我们需要相对于“竖直握持”的偏移。
        // 这里简化处理：假设 beta 60度是基准
        y = y - 60; 

        // 钳制范围
        x = Math.max(-maxTilt, Math.min(maxTilt, x));
        y = Math.max(-maxTilt, Math.min(maxTilt, y));
        
        this.boardTilt.target.x = x / maxTilt; 
        this.boardTilt.target.y = y / maxTilt;
    }
    /**
     * @method createFloatingText
     * @description 創建通用浮動文字 (修復報錯的關鍵)
     * @param {number} x - 位置 X
     * @param {number} y - 位置 Y
     * @param {string} text - 文字內容
     * @param {string} [color] - 文字顏色 (可選)
     */
    spawn_createFloatingText(x, y, text, color) { 
        this.floatingTexts.push(new FloatingText(x, y, text, color)); 
    }

    /**
     * @method combat_createFloatingText
     * @description 兼容旧代码的浮动文字方法
     */
    combat_createFloatingText(x, y, text, color) {
        this.spawn_createFloatingText(x, y, text, color);
    }
    // --- [新增] 更新連射倍率 UI ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_updateMulticastDisplay.
     * @param {any} bonusAmount - TODO: Describe this parameter.
     */
    combat_updateMulticastDisplay(bonusAmount = 0) {
        // 基礎是 1，加上當前累積的 multicast
        const total = 1 + (this.currentSession ? this.currentSession.multicast : 0);
        
        const ui = document.getElementById('multicast-ui');
        const num = document.getElementById('multicast-num');
        
        if (ui && num) {
            // 顯示 UI
            ui.classList.add('multicast-visible');
            
            // 更新數字
            num.innerText = `x${total}`;
            
            // 如果有增加 (bonusAmount > 0)，播放特效
            if (bonusAmount > 0) {
                // 1. 容器彈跳
                ui.classList.remove('multicast-pop');
                void ui.offsetWidth; // 重繪
                ui.classList.add('multicast-pop');
                
                // 2. 文字閃白
                num.classList.add('multicast-flash');
                setTimeout(() => num.classList.remove('multicast-flash'), 300);
            }
        }
    }

    // --- [新增] 播放倍率轉移飛行特效 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_playMulticastTransferEffect.
     * @param {any} multicastValue - TODO: Describe this parameter.
     */
    combat_playMulticastTransferEffect(multicastValue) {
        // 1. 獲取起點 (右下角倍率 UI)
        const startEl = document.getElementById('multicast-ui');
        // 2. 獲取終點 (左側當前配方卡片)
        // 注意：activeMarbleIndex 對應的是 gathering-hud-mount 裡的第 N 個子元素
        const targetEl = document.querySelector(`#gathering-hud-mount .recipe-card:nth-child(${this.activeMarbleIndex + 1})`);

        if (!startEl || !targetEl) return;

        const startRect = startEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        // 3. 創建飛行元素
        const flyer = document.createElement('div');
        flyer.className = 'flying-badge';
        flyer.innerText = `x${multicastValue}`;
        
        // 初始位置 (設置在起點)
        // 計算中心點偏移
        const startX = startRect.left + startRect.width / 2 - 20; // 20是寬度的一半
        const startY = startRect.top + startRect.height / 2 - 20;
        
        flyer.style.left = `${startX}px`;
        flyer.style.top = `${startY}px`;
        flyer.style.transform = 'scale(1.2)'; // 起飛時稍微放大

        document.body.appendChild(flyer);

        // 4. 執行飛行 (下一幀設置終點位置以觸發 transition)
        requestAnimationFrame(() => {
            const targetX = targetRect.left + targetRect.width / 2 - 20;
            const targetY = targetRect.top + targetRect.height / 2 - 20;

            flyer.style.left = `${targetX}px`;
            flyer.style.top = `${targetY}px`;
            flyer.classList.add('arrived'); // 配合 CSS 變小變淡
        });

        // 5. 飛行結束後清理並觸發卡片高亮
        setTimeout(() => {
            flyer.remove();
            
            // 讓目標卡片閃一下，表示接收到了倍率
            targetEl.style.transition = 'none';
            targetEl.style.filter = 'brightness(2) drop-shadow(0 0 10px orange)';
            targetEl.style.transform = 'scale(1.1)';
            
            setTimeout(() => {
                targetEl.style.transition = 'all 0.3s';
                targetEl.style.filter = 'none';
                targetEl.style.transform = 'scale(1)';
            }, 100);

            // 播放音效
            audio.playCollect(); 
        }, 600); // 這裡的時間要和 CSS transition 匹配
    }
    // --- 敌人生成与词缀系统 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_generateAffixes.
     */
    spawn_generateAffixes() {
        const affixes = [];
        let possible = [];
        const r = this.round || 0;

        // 1. 决定生成多少个词条 (数量限制)
        // 基础概率随回合提升，但有上限
        // 0个: 默认
        // 1个: 20% (r=1) -> 60% (r=20)
        // 2个: 0%  (r=1) -> 15% (r=20)
        let count = 0;
        const chance1 = Math.min(0.6, 0.1 + r * 0.025);
        const chance2 = r > 10 ? Math.min(0.15, (r - 10) * 0.01) : 0;
        
        const roll = Math.random();
        if (roll < chance2) count = 2;
        else if (roll < chance1 + chance2) count = 1;
        
        if (count === 0) return [];

        // 2. 定义词条权重池 (Weight Pool)
        // 格式: { id: 'affix_name', weight: function(round) }
        const poolDefinitions = [
            { id: 'shield',  weight: (r) => r < 3 ? 0 : (r < 8 ? 100 : 50) },  // 初期高频，后期变低
            { id: 'regen',   weight: (r) => r < 5 ? 0 : (r < 12 ? 80 : 40) },   // 中期高频
            { id: 'healer',  weight: (r) => r < 6 ? 0 : 60 },                   // 稳定出现
            { id: 'haste',   weight: (r) => r < 8 ? 0 : (r < 15 ? 70 : 50) },
            { id: 'jump',    weight: (r) => r < 9 ? 0 : 60 },
            { id: 'clone',   weight: (r) => r < 12 ? 0 : 50 },
            { id: 'devour',  weight: (r) => r < 12 ? 0 : 40 },
            { id: 'berserk', weight: (r) => r < 14 ? 0 : (r * 3) }              // 后期极其危险，权重随回合无限增加
        ];

        // 3. 计算当前回合的有效权重池
        let validPool = [];
        let totalWeight = 0;
        
        poolDefinitions.forEach(def => {
            const w = def.weight(r);
            if (w > 0) {
                validPool.push({ id: def.id, w: w });
                totalWeight += w;
            }
        });

        if (totalWeight <= 0) return [];

        // 4. 抽取词条
        for (let i = 0; i < count; i++) {
            let randomVal = Math.random() * totalWeight;
            for (let item of validPool) {
                if (randomVal < item.w) {
                    if (!affixes.includes(item.id)) {
                        affixes.push(item.id);
                    }
                    break;
                }
                randomVal -= item.w;
            }
        }

        return affixes;
    }
    /**
     * @method isAreaOccupied
     * @description 檢查指定區域是否被其他敵人佔用 (修正版：基于逻辑目标位置判断)
     */
    calc_isAreaOccupied(x, y, w, h, excludeEnemy = null) {
        // 定義检测区域的邊界
        const l1 = x - w / 2;
        const r1 = x + w / 2;
        const t1 = y - h / 2;
        const b1 = y + h / 2;

        for (let e of this.enemies) {
            if (!e.active || e === excludeEnemy) continue;

            // --- [核心修复] ---
            // 使用 dropTargetY (逻辑上的目标位置) 而不是 pos.y (当前的动画位置)
            // 这样当底部敌人决定移动后，上方敌人立刻就能知道该格子在逻辑上已经空出来了
            const enemyY = e.dropTargetY; 
            const enemyX = e.pos.x; // X轴通常不改变，用 pos.x 即可

            // 手动计算边界，代替 e.getBounds()
            const eLeft = enemyX - e.width / 2;
            const eRight = enemyX + e.width / 2;
            const eTop = enemyY - e.height / 2;
            const eBottom = enemyY + e.height / 2;

            // AABB 碰撞檢測 (保留 margin 防止边缘误触)
            const margin = 2;
            if (l1 < eRight - margin &&
                r1 > eLeft + margin &&
                t1 < eBottom - margin &&
                b1 > eTop + margin) {
                return true;
            }
        }
        return false;
    }

    /**
     * @method spawnEnemyRowAt
     * @description [重构V3] 导演系统 + 机会生成器
     * 1. 导演系统：概率生成强力小队（增加难度/教学）。
     * 2. 机会生成器：概率生成布局破绽（降低难度/提供爽感）。
     * 3. 混合填充：智能填充剩余空位。
     */
    spawn_spawnEnemyRowAt(yPos) {
        const b = CONFIG.balance;
        
        // --- [优化] 动态血量修正逻辑 ---
        // 1. 计算线性增长的基础血量
        const linearHP = b.enemyBaseHp + (this.round * b.enemyHpPerRound) * this.difficultyGrowthFactor;
        
        // 2. 计算基于玩家峰值伤害的理想血量
        const peakAvg = this.calc_getPeakAverageDamage();
        const fullRowsCapacity = 2 * CONFIG.gameplay.enemyCols; // 以 2 行满员为对标
        
        let finalBaseHP = linearHP;
        let idealHP = 0;
        if (peakAvg > 0) {
            idealHP = peakAvg / fullRowsCapacity;
            // 混合：40% 线性增长 + 60% 动态调整，确保血量跟随玩家强度
            finalBaseHP = (linearHP * 0.4) + (idealHP * 0.6);
        }
        
        // 3. 应用最终倍率
        const baseHP = Math.floor(finalBaseHP * this.nextRoundHpMultiplier);
        
        // [日志] 记录血量计算过程
        console.log(`[HP Scaling] Round: ${this.round}`);
        console.log(` - Linear HP: ${linearHP.toFixed(2)}`);
        console.log(` - Peak Avg Damage: ${peakAvg.toFixed(2)}`);
        console.log(` - Ideal HP (based on damage): ${idealHP.toFixed(2)}`);
        console.log(` - Final Base HP (Mixed): ${finalBaseHP.toFixed(2)}`);
        console.log(` - Final HP (with Multiplier): ${baseHP}`);
        // ----------------------------

        const w = this.enemyWidth;
        
        // 标记占用状态：true 表示该列已被"处理"（可能是生成了怪，也可能是强制留空）
        const occupiedCols = Array(CONFIG.gameplay.enemyCols).fill(false);
        const pendingSpawns = []; // 暂存导演生成的怪，最后统一实例化

        // =========================================
        // 1. 导演系统 (The Director) - 生成精英小队
        // =========================================
        const directorChance = Math.min(0.35, 0.15 + (this.round * 0.01));
        if (Math.random() < directorChance) {
            let playerHasCryo = false;
            let playerHasPyro = false;
            for(let i=0; i<Math.min(3, this.marbleQueue.length); i++) {
                const m = this.marbleQueue[i];
                if (m.collected.includes('cryo') || m.type === 'cryo') playerHasCryo = true;
                if (m.collected.includes('pyro') || m.type === 'pyro') playerHasPyro = true;
            }

            let squadType = null;
            const candidates = [];
            
            // 条件模板
            if (playerHasPyro && this.round >= 12) candidates.push('berserk_pack');
            if (playerHasCryo && this.round >= 8) candidates.push('jumper_pack');
            // 通用战术模板
            if (this.round >= 6) candidates.push('phalanx'); 
            if (this.round >= 10) candidates.push('blitz'); 

            if (candidates.length > 0) {
                squadType = candidates[Math.floor(Math.random() * candidates.length)];
            }

            const addPreset = (col, hpMult, forceAffixes) => {
                if (col >= 0 && col < CONFIG.gameplay.enemyCols && !occupiedCols[col]) {
                    pendingSpawns.push({ col, hp: Math.floor(baseHP * hpMult), affixes: forceAffixes });
                    occupiedCols[col] = true; // 导演占座
                }
            };

            if (squadType === 'phalanx') {
                const c = Math.floor(Math.random() * (CONFIG.gameplay.enemyCols - 1));
                addPreset(c, 1.4, ['shield']);
                addPreset(c+1, 0.8, ['healer']);
            } 
            else if (squadType === 'blitz') {
                const c1 = Math.floor(Math.random() * CONFIG.gameplay.enemyCols);
                let c2 = (c1 + 2) % CONFIG.gameplay.enemyCols;
                addPreset(c1, 0.6, ['haste']);
                addPreset(c2, 0.6, ['jump']);
            }
            else if (squadType === 'berserk_pack') {
                const c = Math.floor(Math.random() * CONFIG.gameplay.enemyCols);
                addPreset(c, 1.2, ['berserk']);
            }
            else if (squadType === 'jumper_pack') {
                const c = Math.floor(Math.random() * CONFIG.gameplay.enemyCols);
                addPreset(c, 0.8, ['jump']);
            }
        }

        // =========================================
        // 2. 机会生成器 (Opportunity Generator) - 设计关卡布局
        // =========================================
        // 仅在非 Boss 覆盖的区域生效（Boss战通常不生成普通行，这里作为防御性判断）
        // 概率：初期(前15关)极高，给玩家爽感
        let layoutType = 'random'; 
        const helpChance = Math.max(0.42, 0.99 - (this.round * 0.02)); 

        if (Math.random() < helpChance) {
            const types = ['gap', 'weak_spot', 'checkerboard'];
            layoutType = types[Math.floor(Math.random() * types.length)];
        }

        // 策略 A: [缺口] 强制留空一列
        if (layoutType === 'gap') {
            const gapCol = Math.floor(Math.random() * CONFIG.gameplay.enemyCols);
            // 只有当这一列没有被导演占用时，才将其标记为"留空"
            if (!occupiedCols[gapCol]) {
                occupiedCols[gapCol] = true; 
            }
        }
        
        // 策略 B: [弱点] 稍后在填充循环中生成一个 1 HP 的敌人
        let weakSpotCol = -1;
        if (layoutType === 'weak_spot') {
            // 找一个没被占用的空位
            const freeIndices = [];
            occupiedCols.forEach((occupied, idx) => { if(!occupied) freeIndices.push(idx); });
            
            if (freeIndices.length > 0) {
                weakSpotCol = freeIndices[Math.floor(Math.random() * freeIndices.length)];
                // 注意：这里不要把 occupiedCols 设为 true，因为我们需要在那个位置生成一个弱点怪
            }
        }

        // 策略 C: [棋盘] 强制隔一个生成一个
        if (layoutType === 'checkerboard') {
            const parity = Math.random() > 0.5 ? 0 : 1;
            for (let c = 0; c < CONFIG.gameplay.enemyCols; c++) {
                if (c % 2 === parity) {
                    // 同样，只有当这一列没被导演占用时，才强制留空
                    if (!occupiedCols[c]) {
                        occupiedCols[c] = true; 
                    }
                }
            }
        }

        // =========================================
        // 3. 填充剩余空位 (Fill Loop)
        // =========================================
        const minEnemies = Math.min(CONFIG.gameplay.enemyCols, CONFIG.gameplay.spawnMin + Math.floor(this.round / 4));
        
        // 计算当前已确定的敌人数量 (导演生成的)
        let currentCount = pendingSpawns.length; 
        
        // 获取所有未占用的列
        let freeCols = [];
        for(let c=0; c<CONFIG.gameplay.enemyCols; c++) {
            if(!occupiedCols[c]) freeCols.push(c);
        }
        
        // 洗牌
        for (let i = freeCols.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [freeCols[i], freeCols[j]] = [freeCols[j], freeCols[i]];
        }

        // 开始填充
        for (let c of freeCols) {
            const centerX = c * w + w / 2;
            
            // 基础生成判定
            let shouldSpawn = false;
            
            // 如果是弱点位置，强制生成
            if (c === weakSpotCol) shouldSpawn = true;
            // 否则按概率或最小数量生成 (注意：如果是Checkerboard布局，freeCols 已经很少了，这里的逻辑会自动适应)
            else if (currentCount < minEnemies || Math.random() < b.spawnProb) shouldSpawn = true;

            if (shouldSpawn && !this.calc_isAreaOccupied(centerX, yPos, w * 0.8, this.enemyHeight * 0.8)) {
                
                // 决定血量
                let hp = Math.floor(baseHP * (0.8 + Math.random() * 0.4));
                
                // [应用弱点策略]：如果是选定的弱点列，血量强制设为极低
                if (c === weakSpotCol) {
                    // 弱点怪血量约为基础血量的 10% ~ 20%，或者直接为 1
                    const variantRatio = (12 + (Math.random() * 14 - 7)) / 100; 
                    const weakHP = Math.max(1, Math.floor(baseHP * variantRatio));
                    hp = weakHP;
                }

                const e = new Enemy(centerX, yPos, w, this.enemyHeight, hp);
                
                // 生成词条 (如果是弱点怪，不带词条)
                if (c === weakSpotCol) {
                    e.affixes = [];
                    // 可以在这里给弱点怪加个视觉标记，比如颜色变淡，或者在 update 里处理
                } else {
                    e.affixes = this.spawn_generateAffixes();
                }

                if (e.affixes.length > 0) e.type = 'elite';
                
                this.enemies.push(e);
                currentCount++;
            }
        }

        // =========================================
        // 4. 最后实例化导演生成的精英 (Pending Spawns)
        // =========================================
        for (let cfg of pendingSpawns) {
            const centerX = cfg.col * w + w / 2;
            // 二次检查碰撞，虽然 occupiedCols 应该保证了位置
            if (!this.calc_isAreaOccupied(centerX, yPos, w * 0.8, this.enemyHeight * 0.8)) {
                const e = new Enemy(centerX, yPos, w, this.enemyHeight, cfg.hp);
                e.affixes = cfg.affixes || [];
                if (e.affixes.length > 0) e.type = 'elite';
                this.enemies.push(e);
            }
        }
    }
    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_addSkillPoint.
     * @param {any} amount - TODO: Describe this parameter.
     */
    spawn_addSkillPoint(amount = 1) {
        this.skillPoints += amount;
        this.ui.updateSkillPoints(this.skillPoints);
        this.ui.updateSkillBar(this.skillPoints); // <--- [新增] 更新技能栏状态
    }


    // 在 Game 类中
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_activateSkill.
     * @param {any} skill - TODO: Describe this parameter.
     */
    combat_activateSkill(skill) {
        if (this.phase !== 'combat' || this.isEnemyTurn || this.skillPoints < skill.cost) return;

        // 1. 扣除消耗
        this.skillPoints -= skill.cost;
        this.ui.updateSkillPoints(this.skillPoints);
        this.ui.updateSkillBar(this.skillPoints);
        
        audio.playPowerup(5); 
        showToast(`釋放: ${skill.name}!`);

        const p = skill.params;
        
        // [核心修改] 使用 methodId 进行逻辑分发
        const method = skill.methodId;

        if (method === 'repulsion') {
            // ... (重力反转逻辑保持不变) ...
            const pushDistance = this.enemyHeight * p.pushRows;
            let pushedCount = 0;
            this.enemies.forEach(e => {
                if (e.active) {
                    e.dropTargetY = Math.max(80, e.dropTargetY - pushDistance); 
                    e.pos.y = e.dropTargetY; 
                    e.bumpOffsetY = p.visualShake;
                    pushedCount++;
                    this.spawn_createParticle(e.pos.x, e.pos.y + e.height/2, p.particleColor, 'mist');
                }
            });
            this.spawn_createShockwave(this.width/2, this.height/2, p.shockwaveColor);
            if(pushedCount > 0) audio.playEffect('split');
            document.getElementById('game-container').classList.add('shake-hard');
            setTimeout(() => document.getElementById('game-container').classList.remove('shake-hard'), 200);
        } 
        else if (method === 'chain_lightning_all') {
            // === [新增] 全屏闪电链逻辑 ===
            const dmg = p.baseDmg + (this.round * p.roundMult);
            
            // 视觉：全屏微闪
            const flash = document.createElement('div');
            flash.className = 'absolute inset-0 z-50 pointer-events-none transition-opacity duration-200';
            flash.style.backgroundColor = p.flashColor;
            document.body.appendChild(flash);
            setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 200); }, 50);
            document.getElementById('game-container').classList.add('shake-hard');
            setTimeout(() => document.getElementById('game-container').classList.remove('shake-hard'), 200);
            // 倒序遍历（防止数组变动影响）
            // 策略：对每个敌人从天降下一道闪电，并以此为起点尝试触发连锁
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                if (e.active) {
                    // 1. 视觉：天雷 (从屏幕顶端打到敌人头顶)
                    const startX = e.pos.x + (Math.random() - 0.5) * 50;
                    this.lightningBolts.push(new LightningBolt(startX, 0, e.pos.x, e.pos.y));
                    
                    // 2. 造成主伤害
                    const killed = e.takeDamage(dmg);
                    this.combat_recordDamage(dmg, 'lightning', 'main', this._currentDamageShotId);
                    this.spawn_createFloatingText(e.pos.x, e.pos.y, `-${dmg}`, '#c084fc');
                    
                    // 3. 施加感电效果 (温度)
                    e.applyTemp(CONFIG.balance.lightningTempIncrease || 3); 

                    // 4. [关键] 触发连锁
                    // 我们调用已有的 triggerLightningChain，把当前敌人 e 作为源头
                    // 传递 [e] 作为历史记录，防止闪电瞬间弹回给自己
                    // 使用 p.chainLevel (如果配置了) 或者默认 15 级
                    const skillChainLevel = p.chainLevel || 15; 
                    this.combat_lightning_triggerChain(e, dmg, [e], skillChainLevel);

                    if (killed) this.spawn_addScore(e.maxHp);
                }
            }
            audio.playLightning();

        } 
        else if (method === 'enhance_ammo') {
            // === [修改] 强化弹药逻辑（支持光属性和散射） ===
            if (this.ammoQueue.length > 0) {
                const nextAmmo = this.ammoQueue[0];
                
                // 1. 遍历并应用 buffs (包含 scatter)
                for (const [key, val] of Object.entries(p.buffs)) {
                    // 如果是 damage, scatter, bounce 等数值属性，直接累加
                    if (typeof nextAmmo[key] === 'number' || nextAmmo[key] === undefined) {
                        nextAmmo[key] = (nextAmmo[key] || 0) + val;
                    }
                }

                // 2. 处理 [光属性] 开关
                if (p.forceLaser) {
                    // 激活激光逻辑标志
                    nextAmmo.isLaser = true; 
                    // 确保激光层数至少为 1 (如果 buffs 里没配 laser)
                    if (!nextAmmo.laser || nextAmmo.laser <= 0) {
                        nextAmmo.laser = 1;
                    }
                }

                // 3. 处理 [爆破属性] 开关
                if (p.forceExplosive) nextAmmo.explosive = true;
                
                // 4. 视觉反馈
                this.spawn_createExplosion(this.width/2, this.height - 80, p.explosionColor);
                this.ui_updateAmmoUI(); 
                this.spawn_createFloatingText(this.width/2, this.height - 120, p.floatText, p.explosionColor);
            } else {
                // 返还 SP
                this.skillPoints += skill.cost;
                this.ui.updateSkillPoints(this.skillPoints);
                this.ui.updateSkillBar(this.skillPoints);
                showToast("無彈藥可強化");
            }
        }
    }
    /**
     * @method spawnEnemyRow
     * @description 生成指定数量的敌人行。
     * @param {number} [count=1] - **重要参数** 要生成的敌人行数。
     */
    spawn_spawnEnemyRow(count = 1) { for(let i=0; i<count; i++) { this.spawn_spawnEnemyRowAt(80 - (i * this.enemyHeight)); } }
    
    /**
     * @method triggerCloneSpawn
     * @description 触发分身生成的通用逻辑
     */
    spawn_triggerCloneSpawn(sourceEnemy) {
        const w = this.enemyWidth;
        const cloneHp = Math.max(1, Math.floor(sourceEnemy.maxHp * 0.2));
        
        // 寻找落点
        const validCols = [];
        for(let r = 0; r < 3; r++) {
             for(let c = 0; c < CONFIG.gameplay.enemyCols; c++) {
                 const tx = c * w + w/2;
                 const ty = 80 + r * this.enemyHeight;
                 if (!this.calc_isAreaOccupied(tx, ty, w * 0.9, this.enemyHeight * 0.9)) {
                     validCols.push({x: tx, y: ty});
                 }
             }
        }

        if (validCols.length > 0) {
            const pos = validCols[Math.floor(Math.random() * validCols.length)];
            // 发射孢子
            audio.playEffect('split');
            this.spores.push(new CloneSpore(sourceEnemy.pos.x, sourceEnemy.pos.y, pos.x, pos.y, () => {
                const clone = new Enemy(pos.x, pos.y, w, this.enemyHeight, cloneHp, cloneHp);
                clone.affixes = []; // 分身没有词缀
                this.enemies.push(clone);
                this.spawn_createFloatingText(pos.x, pos.y, "SPAWN", "#a855f7");
            }));
        }
    }
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_assignSwordTarget.
     * @param {any} enemy - TODO: Describe this parameter.
     */
    combat_flyingSword_assignTarget(enemy) {
        // 遍历所有存活的子剑 (不包括充当标记的母剑)
        this.sonSwords.forEach(sword => {
            if (sword.active && !sword.isMotherBlade) {
                sword.addTarget(enemy);
            }
        });
    }

    // --- 新增方法：添加子剑 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_addSonSword.
     * @param {any} x - TODO: Describe this parameter.
     * @param {any} y - TODO: Describe this parameter.
     * @param {any} mother - TODO: Describe this parameter.
     * @param {any} level - TODO: Describe this parameter.
     * @param {any} config - TODO: Describe this parameter.
     * @param {any} delay - TODO: Describe this parameter.
     */
    combat_flyingSword_addSon(x, y, mother, level, config, delay = 0) {
        if (this.sonSwords.length >= 80) return;
        if (isNaN(x) || isNaN(y)) return;
        const sword = new SonSword(x, y, mother, level, config, delay);
        
        // [修复] 子剑继承母剑的飞行方向，并加上小随机偏移
        if (mother && mother.vel) {
            // 获取母剑的单位方向向量
            const motherDir = mother.vel.norm();
            // 加上小随机偏移，避免子剑完全重叠
            const randomOffset = new Vec2(Math.random()-0.5, Math.random()-0.5).mult(2);
            sword.vel = motherDir.mult(8).add(randomOffset);
            // 设置初始角度
            sword.angle = Math.atan2(sword.vel.y, sword.vel.x);
        } else {
            // 如果没有母剑，使用随机方向
            sword.vel = new Vec2(Math.random()-0.5, Math.random()-0.5).mult(5);
            sword.angle = Math.atan2(sword.vel.y, sword.vel.x);
        }
        
        this.sonSwords.push(sword);
    }

    /**
     * @method damageEnemy
     * @description 对敌人造成伤害并处理元素效果。
     * @param {Enemy} enemy - **重要参数** 目标敌人。
     * @param {Projectile} projectile - **重要参数** 造成伤害的弹丸。
     */
    /**
     * [COMBAT] 对敌人造成伤害的核心方法。
     * @param {Enemy} enemy - 目标敌人对象。
     * @param {object} projectile - 造成伤害的弹丸或来源对象。
     * @returns {number} 实际造成的伤害值。
     */
    // --- 视觉工具方法 ---
    triggerScreenShake(amount) {
        this.screenShake = amount;
    }

    // --- 几何工具方法 ---

    // 检测线段 AB 和 CD 是否相交
    checkLineIntersection(a, b, c, d) {
        const cross = (x, y, z) => (y.x - x.x) * (z.y - x.y) - (y.y - x.y) * (z.x - x.x);
        
        // 快速排斥实验
        if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) ||
            Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) {
            return false;
        }

        // 跨立实验
        const f1 = cross(a, b, c) * cross(a, b, d);
        const f2 = cross(c, d, a) * cross(c, d, b);

        // 如果两个叉积都小于0，说明线段互相跨越
        return f1 < 0 && f2 < 0;
    }

    // 检测四边形是否自相交 (蝴蝶形/沙漏形)
    isBowtieShape(anchors) {
        if (anchors.length < 4) return false;
        const p = anchors;
        // 检查对边是否相交：(0-1) 与 (2-3)，以及 (1-2) 与 (3-0)
        const cross1 = this.checkLineIntersection(p[0], p[1], p[2], p[3]);
        const cross2 = this.checkLineIntersection(p[1], p[2], p[3], p[0]);
        return cross1 || cross2;
    }

    /**
     * @method combat_wind_addAnchor
     * @description 添加风属性锚点
     */
    combat_wind_addAnchor(x, y, bulletDamage = 2, bulletConfig = { wind: 1 }) {
        if (this.windAnchors.length >= 4) {
            const old = this.windAnchors.shift();
            // 触发小旋风特效和伤害
            this.spawn_smallWhirlwind(old.x, old.y);
            this.combat_wind_triggerSmallWhirlwindDamage(old.x, old.y, bulletDamage, bulletConfig);
        }
        // [修复] 将 bulletConfig 存入锚点，确保等级信息不丢失
        this.windAnchors.push({ x, y, life: 1.0, bulletDamage: bulletDamage, bulletConfig: bulletConfig });
        this.spawn_createParticle(x, y, '#34d399', 'spark');
        if (this.windAnchors.length === 4) {
            this.combat_wind_triggerMagicCircle();
        }
    }

    /**
     * [EFFECT] 生成小旋风特效 (消失时的反馈)
     */
    spawn_smallWhirlwind(x, y) {
        // 播放风声
        if (this.soundManager) this.soundManager.playEffect('split'); 

        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            // 创建青色粒子
            const p = this.spawn_createParticle(x, y, '#34d399', 'spark');
            if (!p) continue;
            
            // [数学魔法]：计算螺旋速度
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 4;
            
            // 基础向外速度
            const velocity = new Vec2(Math.cos(angle), Math.sin(angle));
            
            // 旋转 90 度得到切线方向，混合一点向外的分量
            // 这样粒子会以螺旋线飞出
            p.vel = velocity.rotate(Math.PI / 2).mult(speed); 
            p.vel.x += velocity.x * 1.5; // 稍微加一点离心力
            p.vel.y += velocity.y * 1.5;
            
            p.life = 0.6; // 短促
            p.size = Math.random() * 3 + 2;
        }
        
        // 中心加一个瞬间的淡出光圈
        this.spawn_createShockwave(x, y, '#34d399');
    }

    /**
     * [COMBAT] 触发锚点消失时的范围伤害
     */
    combat_wind_triggerSmallWhirlwindDamage(centerX, centerY, bulletDamage = 2, bulletConfig = { wind: true }) {
        const cfg = CONFIG.wind_system.base;
        const radius = 60; // 伤害半径

        // 遍历敌人检测碰撞
        this.enemies.forEach(e => {
            if (!e.active) return;

            // 计算距离
            const dist = e.pos.dist(new Vec2(centerX, centerY));
            
            // 判定命中 (考虑敌人体积)
            if (dist < radius + e.width / 2) {
                // 1. 造成伤害 - 统一走 damageEnemy
                // [优化] 伤害挂钩子弹伤害倍率 (使用配置参数)
                const dmg = Math.max(1, Math.floor(bulletDamage * cfg.anchorExplosionMult));
                this.combat_damageEnemy(e, { 
                    config: { ...bulletConfig, damage: dmg }, 
                    pos: e.pos, 
                    isCopy: false,
                    shotId: this._currentDamageShotId 
                });
                
                // [修改] 取消风属性造成的位移效果
                // const pushDir = new Vec2(e.pos.x - centerX, e.pos.y - centerY).norm();
                // this.combat_tryMoveEnemy(e, pushDir.mult(10));   
                
                // 3. 受击反馈
                e.hitTimer = 10;
            }
        });
    }

       combat_wind_triggerMagicCircle() {
        // 1. 数量检查
        if (this.windAnchors.length < 4) return;

        // [修复] 直接从锚点中获取触发时的风属性等级，不再从全局子弹列表中查找
        const lastAnchor = this.windAnchors[this.windAnchors.length - 1];
        const currentRecipe = lastAnchor.bulletConfig || { wind: 1, level: 1 };
        // [迁移] 优先使用 recipe.level (最高等级)，若无则回退到 wind 层数判定
        const windLevel = currentRecipe.level || currentRecipe.wind || 1;

        // 2. [重构] 几何拓扑检查：如果是蝴蝶形/交叉形，触发独立的蝴蝶法阵
        // [等级限制] Lv2 解锁蝴蝶法阵
        if (this.isBowtieShape(this.windAnchors)) {
            if (windLevel >= 2) {
                this.combat_wind_triggerButterflyCircle();
                return; 
            }
            // 等级不足，继续向下判定，通常会进入暴风绞杀
        }
        // --- 判定通过，开始锁定流程 ---
        // 3. 计算形状属性
        const anchors = [...this.windAnchors]; // 复制当前锚点，固化下来
        const xs = anchors.map(a => a.x);
        const ys = anchors.map(a => a.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const rect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        const area = rect.w * rect.h;
        const ratio = Math.max(rect.w / rect.h, rect.h / rect.w);
        
        // [优化]：计算平均子弹伤害作为法阵基础伤害
        const avgBulletDamage = anchors.reduce((sum, a) => sum + (a.bulletDamage || 2), 0) / anchors.length;
        let type = 'burst';
        // [重构] 优先级：风道 > 风暴核心 > 爆破
        // [等级限制] Lv3 解锁风道
        if (ratio >= 3.0 && windLevel >= 3) {
            type = 'tunnel';
        } else if (area < 6000) {
            // 面积较小触发风暴核心 (范围稍微放宽)
            type = 'storm_core';
        }

        // 获取当前元素类型和完整子弹配置 (已在方法开头获取)
        // [新增] 保存完整的子弹配置，用于法阵伤害套用属性效果
        const bulletConfig = { ...currentRecipe };
        let element = 'wind';
        if (currentRecipe.laser > 0) element = 'wind_light';

        // [优化]：为风道计算长轴中线矢量
        let tunnelVector = null;
        if (type === 'tunnel') {
            const isHorizontal = rect.w > rect.h;
            if (isHorizontal) {
                // 水平风道：从中线左侧指向右侧
                tunnelVector = { start: new Vec2(minX, minY + rect.h/2), end: new Vec2(maxX, minY + rect.h/2), dir: new Vec2(1, 0) };
            } else {
                // 垂直风道：从中线顶部指向底部
                tunnelVector = { start: new Vec2(minX + rect.w/2, minY), end: new Vec2(minX + rect.w/2, maxY), dir: new Vec2(0, 1) };
            }
        }

        // 4. 创建独立的法阵实例对象
        const newMatrix = {
            id: Date.now() + Math.random(),
            active: true,
            timer: this.windMatrixDuration,
            maxTimer: this.windMatrixDuration,
            type: type,
            rect: rect,
            anchors: anchors,
            element: element,
            tunnelVector: tunnelVector, // 存储矢量信息
            bulletDamage: avgBulletDamage, // 存储伤害系数
            bulletConfig: bulletConfig, // [新增] 存储完整子弹配置
            // 5. 伤害回调
            onComplete: () => {
                let sizeType = area < 15000 ? 'small' : 'large';
                let shapeType = ratio < 1.5 ? 'square' : 'rect';
                this.combat_wind_executeCircleEffect(minX, minY, rect.w, rect.h, sizeType, shapeType, element, tunnelVector, avgBulletDamage, bulletConfig, type);
            }
        };

        // 6. 推入活跃列表
        this.activeWindMatrices.push(newMatrix);
        
        // 7. [关键] 消耗掉当前的锚点，并触发它们的消失特效
        this.windAnchors.forEach(a => {
            this.spawn_smallWhirlwind(a.x, a.y);
            this.combat_wind_triggerSmallWhirlwindDamage(a.x, a.y);
        });
        this.windAnchors = []; 
        
        // 播放锁定音效 (如果已实现)
        // if (this.soundManager) this.soundManager.playEffect('lock');
    }

    combat_wind_executeCircleEffect(x, y, w, h, size, shape, element, tunnelVector = null, bulletDamage = 2, bulletConfig = null, type = 'burst') {
        const centerX = x + w/2;
        const centerY = y + h/2;

        // [修改 1] 如果没有传入bulletConfig，则使用默认配置
        if (!bulletConfig) {
            bulletConfig = { wind: 1, damage: bulletDamage };
        }

        // 1. 强烈的屏幕震动
        this.triggerScreenShake(size === 'large' ? 15 : 8);
        
        // 2. [优化]：移除爆炸感的冲击波
        // this.spawn_createShockwave(centerX, centerY, '#34d399', Math.max(w, h));
        
        // [优化]：旋风范围比法阵稍大 (1.2倍)
        const expandedW = w * 1.2;
        const expandedH = h * 1.2;
        const expandedX = centerX - expandedW / 2;
        const expandedY = centerY - expandedH / 2;

        if (size === 'small') {
            // [重构] 如果是极小面积法阵触发的'storm_core'类型，则生成风暴核心
            if (type === 'storm_core') {
                this.spawn_stormCore(centerX, centerY, Math.max(w, h) * 1.5, bulletDamage, bulletConfig);
                return; // 结束执行，不走原本的爆炸逻辑
            }

            if (element === 'wind') {
                // 原本的旋风逻辑已移除，此处保留为空或重定向

            } else if (element === 'wind_light') {
                this.spawn_createFloatingText(centerX, centerY, "🕳️黑洞", "#0ea5e9");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > expandedX && e.pos.x < expandedX + expandedW && e.pos.y > expandedY && e.pos.y < expandedY + expandedH) {
                        const dmg = 9999;
                        // [修改 1] 套用子弹完整属性配置
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                    }
                });
            }
        } else if (shape === 'square') {
            if (element === 'wind') {
                this.spawn_createFloatingText(centerX, centerY, "🌪️暴风绞杀", "#34d399");
                
                // [重构] 暴风绞杀：多段切割伤害逻辑
                const scatter = bulletConfig.scatter || 0;
                const multicast = bulletConfig.multicast || 0;
                const tickCount = 1 + scatter;
                const stormDamageMult = CONFIG.wind_system.base.stormDamageMult || 5.0;
                const totalDmg = stormDamageMult * bulletDamage * (1 + multicast);
                const tickDmg = Math.max(1, Math.floor(totalDmg / tickCount));
                const tickInterval = 240; // 每100ms切割一次

                // 1. 制造“暴风眼”视觉：大量风刃向中心旋转坍塌
                for(let i=0; i<100; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 50 + Math.random() * 150; 
                    const px = centerX + Math.cos(angle) * dist;
                    const py = centerY + Math.sin(angle) * dist;
                    
                    // 混合属性粒子
                    let pMode = 'wind_slash';
                    let color = '#34d399';
                    const rand = Math.random();
                    if (bulletConfig) {
                        if (bulletConfig.cryo > 0 && rand < 0.25) { pMode = 'shard'; color = '#cffafe'; }
                        else if (bulletConfig.pyro > 0 && rand < 0.25) { pMode = 'ember'; color = '#fdba74'; }
                    }

                    const p = this.spawn_createParticle(px, py, color, pMode);
                    if (p) {
                        const tangent = new Vec2(-Math.sin(angle), Math.cos(angle));
                        const inward = new Vec2(-Math.cos(angle), -Math.sin(angle));
                        p.vel = tangent.mult(12 + Math.random()*8).add(inward.mult(4 + Math.random()*4)); 
                        p.size = (pMode === 'wind_slash' ? 8 : 4) + Math.random() * 10;
                        p.life = 0.6 + Math.random() * 0.4;
                        
                        // 为旋风粒子添加湍流，增加混沌感
                        p.turbulence = 1 + Math.random() * 2;
                    }

                    // [新增] 弥散微风粒子
                    if (i % 2 === 0) {
                        const pWind = this.spawn_createParticle(px, py, '#f0fdf4', 'spark');
                        if (pWind) {
                            const tangent = new Vec2(-Math.sin(angle), Math.cos(angle));
                            pWind.vel = tangent.mult(5 + Math.random()*5);
                            pWind.turbulence = 4 + Math.random() * 4; // 强湍流
                            pWind.size = 1 + Math.random() * 2;
                            pWind.life = 0.5 + Math.random() * 0.5;
                            pWind.drag = 0.95;
                        }
                    }
                }

                for(let i=0; i<tickCount; i++) {
                    setTimeout(() => {
                        // 每一段伤害使用独立的 shotId 确保不被过滤
                        const currentTickShotId = this._currentDamageShotId ? `${this._currentDamageShotId}_strangle_${i}` : `strangle_${Date.now()}_${i}`;
                        
                        this.enemies.forEach(e => {
                            if (e.active && e.pos.x > expandedX && e.pos.x < expandedX + expandedW && e.pos.y > expandedY && e.pos.y < expandedY + expandedH) {
                                let dmg = tickDmg;
                                // 属性联动逻辑保持
                                if (e.temp >= 100) { 
                                    dmg *= 2; 
                                    e.applyTemp(-50); 
                                    this.spawn_createFloatingText(e.pos.x, e.pos.y, "🔥火旋风", "#f97316"); 
                                    for(let k=0; k<30; k++) {
                                        const angle = Math.random() * Math.PI * 2;
                                        const radius = Math.random() * 100;
                                        const px = centerX + Math.cos(angle) * radius;
                                        const py = centerY + Math.sin(angle) * radius;
                                        this.spawn_createParticle(px, py, '#f97316', 'spark');
                                    }
                                }
                                else if (e.temp <= -100) { 
                                    dmg *= 2; 
                                    e.applyTemp(50); 
                                    this.spawn_createFloatingText(e.pos.x, e.pos.y, "❄️冰旋风", "#06b6d4"); 
                                    for(let k=0; k<30; k++) {
                                        const angle = Math.random() * Math.PI * 2;
                                        const radius = Math.random() * 100;
                                        const px = centerX + Math.cos(angle) * radius;
                                        const py = centerY + Math.sin(angle) * radius;
                                        this.spawn_createParticle(px, py, '#06b6d4', 'shard');
                                    }
                                }
                                
                                // 视觉：身上爆出逆向的风刃
                                for(let k=0; k<3; k++) {
                                    const p = this.spawn_createParticle(e.pos.x, e.pos.y, '#fff', 'wind_slash');
                                    if (p) {
                                        p.vel = new Vec2((Math.random()-0.5)*20, (Math.random()-0.5)*20);
                                        p.size = 15;
                                        p.life = 0.2;
                                    }
                                }

                                // [修改 1] 套用子弹完整属性配置
                                const windConfig = { ...bulletConfig, damage: dmg };
                                this.combat_damageEnemy(e, { 
                                    config: windConfig, 
                                    pos: e.pos, 
                                    isCopy: false,
                                    shotId: currentTickShotId 
                                });
                            }
                        });
                    }, i * tickInterval);
                }
            } else if (element === 'wind_explosive') {
                this.spawn_createFloatingText(centerX, centerY, "💥内爆", "#fca5a5");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h) {
                        // [优化] 伤害挂钩子弹伤害倍率 (使用配置参数)
                        const cfg = CONFIG.wind_system.base;
                        const dmg = Math.max(1, Math.floor(bulletDamage * cfg.shockwaveMult));
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        // [修改] 取消风属性造成的位移效果
                        // const dir = e.pos.sub(new Vec2(centerX, centerY)).norm();
                        // this.combat_tryMoveEnemy(e, dir.mult(40));
                    }
                });
            } else if (element === 'wind_light') {
                this.spawn_createFloatingText(centerX, centerY, "🛡️屏障", "#0ea5e9");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h) {
                        // [优化] 伤害挂钩子弹伤害倍率 (使用配置参数)
                        const cfg = CONFIG.wind_system.base;
                        const dmg = Math.max(1, Math.floor(bulletDamage * cfg.shockwaveMult * 2)); // 屏障伤害通常更高
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                    }
                });
            }
        } else {
            const isHorizontal = w > h;
            // [优化]：使用计算出的矢量方向，如果没有则回退到默认
            const dir = tunnelVector ? tunnelVector.dir : (isHorizontal ? new Vec2(1, 0) : new Vec2(0, 1));
            
            if (element === 'wind') {
                this.spawn_createFloatingText(centerX, centerY, "🌪️风道", "#34d399");
                
                // 1. 绘制底色流光
                this.drawWindTunnelFlow({x, y, w, h}, isHorizontal);

                // 2. [重构] 风道：多段切割伤害逻辑
                const cfg = CONFIG.wind_system.base;
                const scatter = bulletConfig.scatter || 0;
                const multicast = bulletConfig.multicast || 0;
                const tickCount = 1 + scatter;
                const totalDmg = bulletDamage * cfg.tunnelDamageMult * (1 + multicast);
                const tickDmg = Math.max(1, Math.floor(totalDmg / tickCount));
                const tickInterval = 210; // 每100ms切割一次
                
                for(let i=0; i<tickCount; i++) {
                    setTimeout(() => {
                        let hitCount = 0;
                        const currentTickShotId = this._currentDamageShotId ? `${this._currentDamageShotId}_tunnel_${i}` : `tunnel_${Date.now()}_${i}`;
                        
                        this.enemies.forEach(e => {
                            const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y+h) : (e.pos.x > x && e.pos.x < x+w);
                            if (e.active && inPath) {
                                hitCount++;
                                // 伤害挂钩子弹伤害倍率与多段公式
                                const dmg = tickDmg;
                                
                                const windConfig = { ...bulletConfig, damage: dmg, wind: 1 };
                                this.combat_damageEnemy(e, { 
                                    config: windConfig, 
                                    pos: e.pos, 
                                    isCopy: false, 
                                    shotId: currentTickShotId 
                                });
                                
                                // 受击特效
                                for(let k=0; k<3; k++) {
                                    const p = this.spawn_createParticle(e.pos.x, e.pos.y, '#34d399', 'wind_slash');
                                    if (p) {
                                        p.vel = new Vec2((Math.random()-0.5)*15, (Math.random()-0.5)*15);
                                        p.size = 8 + Math.random() * 8;
                                        p.life = 0.3;
                                    }
                                }
                            }
                        });

                        // 每次切割触发顿挫感
                        if (hitCount > 0) {
                            this.slowMotionTimer = 5; 
                            this.timeScale = cfg.hitStopScale;     
                            this.triggerScreenShake(10);
                        }
                    }, i * tickInterval);
                }

                // 4. 生成贯穿全屏的【暴风粒子流】
                const particleCount = 150; // 加大密度
                for(let i=0; i<particleCount; i++) {
                    let px, py;
                    if (isHorizontal) {
                        px = Math.random() * -100; // 从屏幕外生成
                        py = y + Math.random() * h;
                    } else {
                        px = x + Math.random() * w;
                        py = Math.random() * -100;
                    }

                    // [修改] 根据属性混合真实粒子类型
                    let pMode = 'wind_slash';
                    let color = '#d1fae5';
                    const rand = Math.random();
                    
                    if (bulletConfig) {
                        if (bulletConfig.cryo > 0 && rand < 0.3) { pMode = 'shard'; color = '#cffafe'; }
                        else if (bulletConfig.pyro > 0 && rand < 0.3) { pMode = 'ember'; color = '#fdba74'; }
                        else if (bulletConfig.lightning > 0 && rand < 0.3) { pMode = 'spark'; color = '#d8b4fe'; }
                    }

                    const p = this.spawn_createParticle(px, py, color, pMode);
                    if (p && p.vel) {
                        const speed = 40 + Math.random() * 30; 
                        p.vel = dir.mult(speed);
                        p.drag = 1.0; 
                        
                        if (pMode === 'wind_slash') {
                            if (Math.random() < 0.3) {
                                p.size = 20 + Math.random() * 20; // 主风刃
                                p.color = '#ffffff';
                            } else {
                                p.size = 5 + Math.random() * 10; // 伴生气流
                            }
                        } else {
                            p.size = 4 + Math.random() * 6;
                        }

                        p.life = 1.0;
                        const distance = isHorizontal ? this.canvas.width : this.canvas.height;
                        const framesNeeded = (distance + 100) / speed;
                        p.decay = 1.0 / (framesNeeded * 1.2);
                    }

                    // [新增] 湍流微风粒子层：弥散、飘逸
                    if (Math.random() < 0.4) {
                        const pWind = this.spawn_createParticle(px, py, '#f0fdf4', 'spark');
                        if (pWind) {
                            const wSpeed = 15 + Math.random() * 15;
                            pWind.vel = dir.mult(wSpeed).add(new Vec2((Math.random()-0.5)*5, (Math.random()-0.5)*5));
                            pWind.turbulence = 2 + Math.random() * 3; // 湍流强度
                            pWind.size = 1 + Math.random() * 2;
                            pWind.life = 0.8 + Math.random() * 0.4;
                            pWind.decay = 0.02;
                            pWind.drag = 0.98; // 稍微有一点阻力，显得飘逸
                        }
                    }
                }
            } else if (element === 'wind_explosive') {
                this.spawn_createFloatingText(centerX, centerY, "🌊冲击波", "#fca5a5");
                this.enemies.forEach(e => {
                    const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y+h) : (e.pos.x > x && e.pos.x < x+w);
                    if (e.active && inPath) {
                        const dmg = Math.max(1, Math.floor(bulletDamage * 10));
                        // [修改 1] 套用子弹完整属性配置
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        // [修改] 取消风属性造成的位移效果
                        // const pushDir = isHorizontal ? new Vec2(60, 0) : new Vec2(0, 60);
                        // this.combat_tryMoveEnemy(e, pushDir);
                    }
                });
            } else if (element === 'wind_light') {
                this.spawn_createFloatingText(centerX, centerY, "⚡离子风暴", "#0ea5e9");
                this.enemies.forEach(e => {
                    const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y+h) : (e.pos.x > x && e.pos.x < x+w);
                    if (e.active && inPath) {
                        const dmg = Math.max(1, Math.floor(bulletDamage * 12));
                        // [修改 1] 套用子弹完整属性配置
                        const windConfig = { ...bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        this.spawn_createParticle(e.pos.x, e.pos.y, '#c084fc', 'spark');
                    }
                });
            }
        }
    }
    /**
     * [COMBAT] 尝试移动敌人，确保其不超出边界且不与其他敌人重叠
     * @param {Enemy} enemy - 要移动的敌人
     * @param {Vec2} delta - 移动向量
     * @returns {boolean} 是否成功移动
     */
    // === 🦋 蝴蝶法阵系统 ===
    combat_wind_triggerButterflyCircle() {
        // 1. 获取锁点和配置
        const anchors = [...this.windAnchors];
        if (anchors.length < 4) return;
        
        // 2. 计算交叉线的交点（沙漏中心）
        const p = anchors;
        const intersection = this.getLineIntersectionPoint(p[0], p[2], p[1], p[3]);
        if (!intersection) return;
        
        // 3. 获取子弹配置
        const currentRecipe = this.projectiles.find(proj => proj.config.wind)?.config || { wind: true };
        const bulletConfig = { ...currentRecipe };
        const avgBulletDamage = anchors.reduce((sum, a) => sum + (a.bulletDamage || 2), 0) / anchors.length;
        
        // 4. 计算 multicast（散射层数）
        const multicast = bulletConfig.multicast || 1;
        
        // 5. 计算伤害冷却（使用配置参数，根据multicast减少冷却）
        const cfg = CONFIG.wind_system.butterfly;
        // 冷却帧数随multicast增加而减少
        const cooldown = Math.max(cfg.minCooldown, Math.floor(cfg.baseCooldown-bulletConfig.scatter));
        
        // 6. 计算风刃数量（1 + multicast）
        const bladeCount = 1 + multicast;
        
        const butterflyCircle = {
            center: intersection,
            anchors: anchors,
            bulletConfig: bulletConfig,
            bulletDamage: avgBulletDamage,
            duration: cfg.duration,
            timer: 0,
            cooldown: cooldown,
            bladeCount: bladeCount,
            firedCount: 0, // [新增] 已发射次数计数
            maxFires: bladeCount, // [新增] 最大发射次数 (1 + multicast)
            active: true,
            startAnim: 60 // 启动阵图动画时长（帧）
        };
        
        // 8. 添加到游戏对象数组
        if (!this.butterflyCircles) this.butterflyCircles = [];
        this.butterflyCircles.push(butterflyCircle);
        
        // 9. 清空锁点
        this.windAnchors = [];
        
        // 10. 视觉反馈
        this.spawn_createFloatingText(intersection.x, intersection.y, "🦋蝴蝶法阵", "#34d399");
        
        // 11. 启动粒子爆发
        for (let i = 0; i < 30; i++) {
            const p = this.spawn_createParticle(intersection.x, intersection.y, '#34d399', 'wind_slash');
            if (p) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 5 + Math.random() * 10;
                p.vel = new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);
                p.life = 0.5 + Math.random() * 0.5;
            }
        }
    }

    getLineIntersectionPoint(a, b, c, d) {
        const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
        if (Math.abs(denom) < 0.001) return null;
        
        const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
        
        return new Vec2(
            a.x + t * (b.x - a.x),
            a.y + t * (b.y - a.y)
        );
    }

    combat_wind_updateButterflyCircles(timeScale) {
        if (!this.butterflyCircles) return;
        
        for (let i = this.butterflyCircles.length - 1; i >= 0; i--) {
            const bc = this.butterflyCircles[i];
            
            bc.timer += timeScale;
            bc.duration -= timeScale;
            if (bc.startAnim > 0) bc.startAnim -= timeScale;
            
            if (bc.timer >= bc.cooldown) {
                bc.timer = 0;
                this.combat_wind_fireButterflyBlades(bc);
                bc.firedCount++;
                // 如果发射次数达到上限，标记为结束
                if (bc.firedCount >= bc.maxFires) {
                    bc.duration = 0; 
                }
            }
            
            if (bc.duration <= 0) {
                bc.active = false;
                this.butterflyCircles.splice(i, 1);
            }
        }
    }

    combat_wind_fireButterflyBlades(bc) {
        const center = new Vec2(bc.center.x, bc.center.y);
        const directions = [
            new Vec2(bc.anchors[0].x, bc.anchors[0].y).sub(center).norm(),
            new Vec2(bc.anchors[1].x, bc.anchors[1].y).sub(center).norm(),
            new Vec2(bc.anchors[2].x, bc.anchors[2].y).sub(center).norm(),
            new Vec2(bc.anchors[3].x, bc.anchors[3].y).sub(center).norm()
        ];
        
        directions.forEach((dir, idx) => {
            for (let i = 0; i < Math.ceil(bc.bladeCount / 4); i++) {
                // [优化] 发射起点：从中心向外延伸至屏幕边缘，作为起点向内发射
                // 计算射线与屏幕边界的交点
                let startPos = new Vec2(center.x, center.y);
                const rayDir = dir;
                // [优化] 发射起点（使用配置参数）
                const cfg = CONFIG.wind_system.butterfly;
                const tX = rayDir.x > 0 ? (this.canvas.width + cfg.launchOffset - center.x) / rayDir.x : (-cfg.launchOffset - center.x) / rayDir.x;
                const tY = rayDir.y > 0 ? (this.canvas.height + cfg.launchOffset - center.y) / rayDir.y : (-cfg.launchOffset - center.y) / rayDir.y;
                const t = Math.min(tX, tY);
                startPos = center.add(rayDir.mult(t));

                const rotationPhase = (bc.timer / bc.cooldown) * Math.PI * 2;
                const bladeAngle = rotationPhase + (i / (bc.bladeCount / 4)) * Math.PI * 2;
                
                const blade = {
                    pos: startPos,
                    // 向内发射：速度方向取反
                    vel: dir.mult(-(cfg.bladeSpeedBase + Math.random() * cfg.bladeSpeedVar)), 
                    bulletConfig: bc.bulletConfig,
                    bulletDamage: bc.bulletDamage,
                    size: cfg.bladeSizeBase + Math.random() * cfg.bladeSizeVar, 
                    life: 1.0,
                    angle: bladeAngle,
                    rotationAxis: dir,
                    active: true,
                    cooldown: bc.cooldown, // [新增] 传递法阵计算出的伤害冷却
                    // [优化] 初始冷却设为足够大，确保第一次命中立即触发
                    damageTimer: 100 
                };
                
                if (!this.butterflyBlades) this.butterflyBlades = [];
                this.butterflyBlades.push(blade);
            }
        });
    }

    combat_wind_updateButterflyBlades(timeScale) {
        if (!this.butterflyBlades) return;
        
        for (let i = this.butterflyBlades.length - 1; i >= 0; i--) {
            const blade = this.butterflyBlades[i];
            
            // 更新位置
            blade.pos = blade.pos.add(blade.vel.mult(timeScale));
            blade.angle += 0.2 * timeScale; // 3D旋转
            blade.damageTimer += timeScale;
            
            // [优化] 检查是否飞出屏幕（使用配置参数）
            const cfg = CONFIG.wind_system.butterfly;
            if (blade.pos.x < -cfg.deleteOffset || blade.pos.x > this.canvas.width + cfg.deleteOffset ||
                blade.pos.y < -cfg.deleteOffset || blade.pos.y > this.canvas.height + cfg.deleteOffset) {
                this.butterflyBlades.splice(i, 1);
                continue;
            }
            
            // 伤害判定（使用法阵计算出的 cooldown）
            if (blade.damageTimer >= (blade.cooldown || cfg.baseCooldown)) {
                let hasHit = false;
                this.enemies.forEach(e => {
                    if (!e.active) return;
                    const dist = blade.pos.sub(e.pos).mag();
                    if (dist < 40) { // 判定范围稍微增大
                        hasHit = true;
                        // [优化] 伤害挂钩子弹伤害倍率
                        const dmg = Math.max(1, Math.floor(blade.bulletDamage * cfg.damageMult));
                        const windConfig = { ...blade.bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: blade.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        
                        // 受击特效
                        for(let k=0; k<3; k++) {
                            const p = this.spawn_createParticle(e.pos.x, e.pos.y, '#34d399', 'wind_slash');
                            if (p) {
                                p.vel = new Vec2((Math.random()-0.5)*8, (Math.random()-0.5)*8);
                                p.size = 8 + Math.random() * 8;
                                p.life = 0.3;
                            }
                        }
                    }
                });
                if (hasHit) {
                    blade.damageTimer = 0; // 命中后重置计时器
                }
            }
        }
    }

    combat_wind_drawButterflyCircles(ctx) {
        if (!this.butterflyCircles) return;
        
        this.butterflyCircles.forEach(bc => {
            if (bc.startAnim > 0) {
                const progress = 1 - bc.startAnim / 60;
                const alpha = Math.sin(progress * Math.PI) * 0.6;
                
                ctx.save();
                ctx.translate(bc.center.x, bc.center.y);
                ctx.globalAlpha = alpha;
                
                // 1. 绘制核心光阵
                ctx.strokeStyle = '#34d399';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, 40 + progress * 20, 0, Math.PI * 2);
                ctx.stroke();
                
                // 2. 绘制蝴蝶翅膀动效 (四个扇形)
                for (let i = 0; i < 4; i++) {
                    const angle = i * Math.PI / 2 + progress * Math.PI;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.arc(0, 0, 60 + progress * 40, angle - 0.4, angle + 0.4);
                    ctx.closePath();
                    ctx.fillStyle = 'rgba(52, 211, 153, 0.3)';
                    ctx.fill();
                    ctx.stroke();
                }
                
                // 3. 绘制交叉线
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(-100, -100); ctx.lineTo(100, 100);
                ctx.moveTo(100, -100); ctx.lineTo(-100, 100);
                ctx.stroke();
                
                ctx.restore();
            }
        });
    }

    combat_wind_drawButterflyBlades(ctx) {
        if (!this.butterflyBlades) return;
        
        this.butterflyBlades.forEach(blade => {
            // 1. 绘制辅助风粒子流（龙卷风气流感）
            const particleCount = 6;
            for (let i = 0; i < particleCount; i++) {
                const pOffset = (i / particleCount) * Math.PI * 2 + blade.angle * 1.5;
                const pScale = Math.cos(pOffset);
                const pY = pScale * blade.size * 1.2;
                const pAlpha = (0.2 + Math.abs(pScale) * 0.4) * (1 - blade.pos.dist(new Vec2(this.canvas.width/2, this.height/2)) / 1000);
                
                ctx.save();
                ctx.translate(blade.pos.x, blade.pos.y);
                const moveAngle = Math.atan2(blade.vel.y, blade.vel.x);
                ctx.rotate(moveAngle);
                
                ctx.globalAlpha = Math.max(0, pAlpha);
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                // 气流粒子随旋转在垂直方向偏移
                ctx.arc((Math.random()-0.5) * blade.size, pY, 1 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // 2. 绘制主风刃
            ctx.save();
            ctx.translate(blade.pos.x, blade.pos.y);
            
            const scale = Math.abs(Math.cos(blade.angle));
            const alpha = 0.4 + scale * 0.6;
            ctx.globalAlpha = alpha;
            
            let color = '#d1fae5';
            if (blade.bulletConfig) {
                if (blade.bulletConfig.cryo > 0) color = '#cffafe';
                else if (blade.bulletConfig.pyro > 0) color = '#fdba74';
                else if (blade.bulletConfig.lightning > 0) color = '#d8b4fe';
            }
            
            const angle = Math.atan2(blade.vel.y, blade.vel.x);
            ctx.rotate(angle);
            
            // [优化] 风刃变粗：增加垂直方向的缩放基础值
            ctx.scale(1.2, 0.3 + scale * 1.2); 
            
            const grad = ctx.createLinearGradient(-blade.size, 0, blade.size, 0);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            grad.addColorStop(0.3, color);
            grad.addColorStop(0.5, '#ffffff');
            grad.addColorStop(0.7, color);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = grad;
            ctx.shadowBlur = 15;
            ctx.shadowColor = color;
            
            ctx.beginPath();
            // [优化] 形状更厚实
            ctx.moveTo(-blade.size * 1.8, 0);
            ctx.quadraticCurveTo(0, blade.size * 0.8, blade.size * 1.8, 0);
            ctx.quadraticCurveTo(0, -blade.size * 0.8, -blade.size * 1.8, 0);
            ctx.fill();
            
            ctx.restore();
        });
    }

    // === 🌀 风暴核心系统 ===
    /**
     * 生成风暴核心区域
     */
    spawn_stormCore(x, y, radius, bulletDamage, bulletConfig) {
        const cfg = CONFIG.wind_system.storm_core;
        // 计算能量需求（基于半径）
        const energyRequired = Math.max(1, Math.floor(radius / 10)); 
        
        const stormCore = {
            pos: new Vec2(x, y),
            radius: Math.min(cfg.radiusMax, radius),
            bulletDamage: bulletDamage,
            bulletConfig: bulletConfig || { wind: true },
            energy: 0,
            energyRequired: energyRequired,
            chargeTimer: 0,
            active: true,
            alpha: 0.8,
            pulsePhase: Math.random() * Math.PI * 2
        };
        
        if (!this.stormCores) this.stormCores = [];
        this.stormCores.push(stormCore);
        
        this.spawn_createFloatingText(x, y, "🌀风暴核心", "#34d399");
        this.spawn_createShockwave(x, y, '#34d399');
    }

    /**
     * 更新风暴核心
     */
    combat_wind_updateStormCores(timeScale) {
        if (!this.stormCores) return;
        
        for (let i = this.stormCores.length - 1; i >= 0; i--) {
            const core = this.stormCores[i];
            core.pulsePhase += 0.05 * timeScale;
            
            let hasBulletInside = false;
            this.projectiles.forEach(proj => {
                const dist = proj.pos.dist(core.pos);
                if (dist < core.radius) hasBulletInside = true;
            });
            
            if (hasBulletInside) {
                const cfg = CONFIG.wind_system.storm_core;
                core.chargeTimer += timeScale;
                if (core.chargeTimer >= 60) {
                    core.chargeTimer = 0;
                    core.energy += cfg.energyPerSecond;
                    this.spawn_createParticle(core.pos.x, core.pos.y, '#34d399', 'spark');
                }
            }
            
            if (core.energy >= core.energyRequired) {
                this.combat_wind_releaseStormCoreCyclone(core);
                this.stormCores.splice(i, 1);
            }
        }
    }

    /**
     * 释放风暴核心的大旋风
     */
    combat_wind_releaseStormCoreCyclone(core) {
        const cfg = CONFIG.wind_system.storm_core;
        const centerX = core.pos.x;
        const centerY = core.pos.y;
        const radius = core.radius * cfg.cycloneRadiusMult;
        
        this.spawn_createFloatingText(centerX, centerY, "🌀大旋风", "#10b981");
        this.spawn_createShockwave(centerX, centerY, '#10b981');
        
        // [重构] 大旋风爆发：多段高频伤害 + 疯狂旋转粒子
        const tickCount = 12;
        const tickInterval = 100;
        
        for(let i=0; i<tickCount; i++) {
            setTimeout(() => {
                // 1. 造成伤害
                this.enemies.forEach(e => {
                    if (!e.active) return;
                    const dist = e.pos.dist(core.pos);
                    if (dist < radius) {
                        // 每段伤害为总伤害的 1/4，总计 3 倍爆发伤害
                        const dmg = Math.max(1, Math.floor(core.bulletDamage * (CONFIG.wind_system.storm_core.damageMult || 4.0) * 0.25));
                        const windConfig = { ...core.bulletConfig, damage: dmg };
                        this.combat_damageEnemy(e, { 
                            config: windConfig, 
                            pos: e.pos, 
                            isCopy: false,
                            shotId: this._currentDamageShotId 
                        });
                        e.hitTimer = 10;
                    }
                });

                // 2. 疯狂旋转粒子视觉
                const intensity = 1.0 - (i / tickCount); // 随时间减弱
                const particleCount = 20;
                for(let j=0; j<particleCount; j++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * radius;
                    const px = centerX + Math.cos(angle) * dist;
                    const py = centerY + Math.sin(angle) * dist;
                    
                    const p = this.spawn_createParticle(px, py, '#10b981', 'wind_slash');
                    if (p) {
                        const tangent = new Vec2(-Math.sin(angle), Math.cos(angle));
                        p.vel = tangent.mult(15 + Math.random() * 10);
                        p.size = 8 + Math.random() * 8;
                        p.life = 0.6;
                        p.turbulence = 2 + Math.random() * 3;
                    }
                }
                
                if (i % 3 === 0) {
                    this.slowMotionTimer = 5;
                    this.timeScale = 0.2;
                    this.triggerScreenShake(8);
                }
            }, i * tickInterval);
        }
    }

    /**
     * 绘制风暴核心
     */
    combat_wind_drawStormCores(ctx) {
        if (!this.stormCores) return;
        this.stormCores.forEach(core => {
            ctx.save();
            ctx.translate(core.pos.x, core.pos.y);
            
            // 1. 背景脉冲区域
            const pulse = Math.sin(core.pulsePhase) * 0.15 + 1.0;
            ctx.globalAlpha = 0.15 * core.alpha;
            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(0, 0, core.radius * pulse, 0, Math.PI * 2);
            ctx.fill();

            // 2. 平滑能量环反馈
            // [优化] 过程值反馈：当前能量 + 当前秒内的充能进度
            const smoothEnergy = core.energy + (core.chargeTimer / 60);
            const energyRatio = Math.min(1.0, smoothEnergy / core.energyRequired);
            
            // 底环
            ctx.globalAlpha = 0.2 * core.alpha;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(0, 0, core.radius * 0.85, 0, Math.PI * 2);
            ctx.stroke();

            // 进度环
            ctx.globalAlpha = 0.8 * core.alpha;
            ctx.strokeStyle = '#10b981';
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, 0, core.radius * 0.85, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * energyRatio);
            ctx.stroke();

            // 3. 中心图标与数值
            ctx.globalAlpha = 0.9 * core.alpha;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // 图标随充能速度旋转
            ctx.rotate(core.pulsePhase * 2);
            ctx.fillText('🌀', 0, 0);
            ctx.rotate(-core.pulsePhase * 2);

            ctx.font = 'bold 16px monospace';
            ctx.fillStyle = '#10b981';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#000000';
            ctx.fillText(`${core.energy}/${core.energyRequired}`, 0, core.radius + 25);
            
            ctx.restore();
        });
    }

    /**
     * 每回合衰减风暴核心能量
     */
    combat_wind_decayStormCoresEnergy() {
        if (!this.stormCores) return;
        for (let i = this.stormCores.length - 1; i >= 0; i--) {
            const core = this.stormCores[i];
            core.energy = Math.max(0, core.energy - 1);
            if (core.energy > 0) this.spawn_createFloatingText(core.pos.x, core.pos.y, `-1能量`, "#fca5a5");
            if (core.energy === 0) {
                core.alpha -= 0.05;
                if (core.alpha <= 0) this.stormCores.splice(i, 1);
            }
        }
    }

    combat_tryMoveEnemy(enemy, delta) {
        if (!enemy || !enemy.active) return false;

        const newPos = enemy.pos.add(delta);
        const halfW = enemy.width / 2;
        const halfH = enemy.height / 2;

        // 1. 边界检查 (确保不超出画布左右和上下边界)
        if (newPos.x - halfW < 0 || newPos.x + halfW > this.width) return false;
        if (newPos.y - halfH < 0 || newPos.y + halfH > this.height) return false;

        // 2. 碰撞检查 (确保不与其他活跃敌人重叠)
        // 使用简单的 AABB 碰撞检测
        const hasCollision = this.enemies.some(other => {
            if (other === enemy || !other.active) return false;
            
            return Math.abs(newPos.x - other.pos.x) < (enemy.width + other.width) * 0.45 &&
                   Math.abs(newPos.y - other.pos.y) < (enemy.height + other.height) * 0.45;
        });

        if (hasCollision) return false;

        // 3. 执行移动
        enemy.pos = newPos;
        return true;
    }

    combat_damageEnemy(enemy, projectile, damageOverride = null) {
        if (!enemy || !enemy.active) return; 
        // --- [修復]：如果是光球/偽造子彈，補齊 chainHistory 防止報措 ---
        if (!projectile.chainHistory) projectile.chainHistory = [];

        const config = projectile.config;
        let dmg = damageOverride !== null ? damageOverride : (projectile.isCopy ? config.damage * 0.5 : config.damage);

        // --- [新增] 确定伤害来源类型 (用于统计图表颜色) ---
        let sourceType = 'main';
        if (config.isScatterChild) sourceType = 'scatter';
        else if (config.type === 'flying_sword') sourceType = 'flying_sword'; // 飞剑
        else if (config.wind) sourceType = 'wind'; // 风
        
        // --- 1. 视觉特效生成逻辑 ---
        const hitX = projectile.pos.x;
        const hitY = projectile.pos.y;
        const afx = CONFIG.balance.affixes; // 获取配置引用
        
        // 根据子弹属性决定打击特效
        // 根据子弹属性决定打击特效
        if (config.cryo > 0) {
            // === ❄️ 冰霜打击 (Frost Impact) ===
            
            // 2. 冰刺爆发 (Ice Spikes)
            // 数量随层数增加
            const shardCount = 1 + Math.floor(config.cryo /3); 
            for(let i=0; i<shardCount; i++) {
                // 颜色：随机在 青色 和 白色 之间跳动
                const color = Math.random() > 0.5 ? '#cffafe' : '#ffffff';
                const shard = new Particle(hitX, hitY, color, 'shard');
                this.particles.push(shard);
            }

            // 3. 滞留寒雾 (Lingering Mist)
            // 在击中点生成一团慢慢扩散的雾气
            const mistCount = 3 + Math.floor(config.cryo / 2);
            for(let i=0; i<mistCount; i++) {
                // 随机分布在击中点周围
                const mx = hitX + (Math.random()-0.5) * 20;
                const my = hitY + (Math.random()-0.5) * 20;
                // 颜色传 null 即可，Mist 模式内部处理了颜色
                const mist = new Particle(mx, my, null, 'mist');
                // 初始给一个向外的扩散速度
                mist.vel = new Vec2((mx - hitX)*0.05, (my - hitY)*0.05);
                this.particles.push(mist);
            }

        } else if (config.pyro > 0) {
            // 火焰：生成橙色火星和上升烟雾 (降低单体粒子数量，原 5+3=8，现 2+1=3)
            for(let i=0; i<2; i++) this.spawn_createParticle(hitX, hitY, '#fdba74', 'spark');
            for(let i=0; i<1; i++) this.spawn_createParticle(hitX, hitY, '#7c2d12', 'smoke');
        } else if (config.lightning > 0) {
            // 闪电：生成紫色快速火花
            for(let i=0; i<8; i++) this.spawn_createParticle(hitX, hitY, '#d8b4fe', 'spark');
        } else if (config.pierce > 0) {
            // 穿透：红色锐利碎片
            for(let i=0; i<5; i++) this.spawn_createParticle(hitX, hitY, '#fca5a5', 'spark');
        } else if (config.wind > 0) {
            // 风：生成青绿色气流粒子
            for(let i=0; i<6; i++) {
                const p = this.spawn_createParticle(hitX, hitY, '#34d399', 'spark');
                if (p && p.vel) p.vel = p.vel.mult(1.5);
            }
        } else {
            // 普通：生成基础粒子
            const color = config.damage > 5 ? '#d8b4fe' : '#e2e8f0';
            for(let i=0; i<4; i++) this.spawn_createParticle(hitX, hitY, color, 'normal');
        }
        // --- ：判断伤害类型 ---
        let hitType = 'normal';
        if (config.cryo > 0) hitType = 'cryo';
        else if (config.pyro > 0) hitType = 'pyro';
        else if (config.lightning > 0) hitType = 'lightning';
        else if (config.pierce > 0) hitType = 'pierce';
        else if (config.wind > 0) hitType = 'wind';
        // --- 2. 伤害与状态逻辑 (保持原有逻辑) ---
        if (config.cryo > 0) enemy.applyTemp(-CONFIG.balance.cryoAmount * config.cryo); 
        if (config.pyro > 0) enemy.applyTemp(CONFIG.balance.pyroAmount * config.pyro); 
        if (config.lightning > 0) {
		             // 1. 尝试触发闪电链，并获取结果
		             // [修改] 传入当前闪电等级 (config.lightning)
		             const isChainTriggered = this.combat_lightning_triggerChain(enemy, dmg, projectile.chainHistory, config.lightning); 
		             
		             // 2. 只有在成功触发闪电链时，才提升当前敌人的温度 (公式：闪电层数 + 连锁次数/3)
		             if (isChainTriggered) {
                         const chainCount = projectile.chainHistory.length;
		                 enemy.applyTemp(config.lightning + chainCount / 3); 
		             }
		             
		             projectile.chainHistory.push(enemy); 
		        }

        const damageResult = enemy.takeDamage(dmg);
        const killed = damageResult.killed;
        const actualDmg = damageResult.actualDamage;

        // --- [新增] 确定基础伤害类型 (用于统计图表行) ---
        // 需求2a: 火属性子弹的弹射/穿透伤害分别统计，只有额外火伤才算火属性
        let damageType = 'damage'; // 默认为物理/基础

        // 判定是否为弹射或穿透产生的击打
        const isBounceHit = (config.bounce > 0 && projectile.bouncesLeft < config.bounce);
        const isPierceHit = (config.pierce > 0 && projectile.piercesLeft < config.pierce);

        if (isBounceHit) {
            damageType = 'bounce';
        } else if (isPierceHit) {
            damageType = 'pierce';
        } else {
            if (config.pyro > 0) damageType = 'pyro';
            else if (config.cryo > 0) damageType = 'cryo';
            else if (config.lightning > 0) damageType = 'lightning';
            else if (config.wind > 0) damageType = 'wind';
            else if (config.type === 'flying_sword') damageType = 'flying_sword';
        }

        const colorMap = {
            'pyro': '#f97316', 'cryo': '#06b6d4', 'lightning': '#c084fc',
            'bounce': '#fbbf24', 'pierce': '#fca5a5', 'damage': '#ffffff',
            'wind': '#34d399', 'flying_sword': '#0ea5e9', 'scatter': '#facc15'
        };
        const damageColor = colorMap[damageType] || '#ffffff';
        
        const shotId = projectile.shotId !== undefined ? projectile.shotId : null;
        this.combat_recordDamage(actualDmg, damageType, sourceType, shotId);

        // --- 2. [火属性核心逻辑] 燃烧与过热爆炸 ---
        if (config.pyro > 0 && enemy.temp >= 34) {
            
            // Step 1: 计算当前的基础额外火伤 (移除平方根以优化性能，改用线性比例 /150)
            const baseFireDmg = (config.pyro * enemy.temp) / 150;

            // Step 2: 造成基础燃烧伤害
            if (baseFireDmg >= 1) {
                const fireResult = enemy.takeDamage(baseFireDmg);
                this.combat_recordDamage(fireResult.actualDamage, 'pyro', sourceType, shotId);
                // 显示橙色燃烧字样
                this.spawn_createFloatingText(enemy.pos.x, enemy.pos.y - 25, `Burn ${Math.ceil(fireResult.actualDamage)}`, '#fb923c');
            }

            // Step 3: [新增] 过热爆炸机制 (Small Explosion)
            // 设定阈值和动态概率：基础 0.2 (200度)，600度时 1.0 (100%)
            const EXPLODE_THRESHOLD = 200; 
            let explodeChance = 0;
            if (enemy.temp > EXPLODE_THRESHOLD) {
                // 线性插值计算概率: 200->0.2, 600->1.0
                // 公式: 0.2 + (temp - 200) * (1.0 - 0.2) / (600 - 200)
                explodeChance = 0.2 + (enemy.temp - 200) * (0.8 / 400);
                explodeChance = Math.min(1.0, explodeChance); // 最高 100%
            }

            if (explodeChance > 0 && Math.random() < explodeChance) {
                
                // A. 计算消耗量：10% 当前热量
                const consumedHeat = enemy.temp * 0.10;
                
                // B. 执行消耗：先扣除
                enemy.temp -= consumedHeat;

                // C. 计算爆炸伤害：50% 的当前额外火伤
                const explodeDmg = baseFireDmg * 0.50;
                
                if (explodeDmg >= 1) {
                    // --- 1. 视觉特效 (参考爆炸子弹) ---
                    this.spawn_createShockwave(enemy.pos.x, enemy.pos.y, '#f97316'); // 橙色冲击波
                    for(let i=0; i<10; i++) this.spawn_createParticle(enemy.pos.x, enemy.pos.y, '#fdba74', 'spark');
                    for(let i=0; i<5; i++) this.spawn_createParticle(enemy.pos.x, enemy.pos.y, 'rgba(0,0,0,0.5)', 'smoke');
                    audio.playExplosion();

                    // --- 2. 核心伤害 (对当前敌人) ---
                    const expResult = enemy.takeDamage(explodeDmg);
                    this.combat_recordDamage(expResult.actualDamage, 'pyro', sourceType, shotId);
                    this.spawn_createFloatingText(enemy.pos.x, enemy.pos.y - 50, `BOOM! ${Math.ceil(expResult.actualDamage)}`, '#dc2626');
                    
                    // --- 3. 范围伤害 (AOE) ---
                    const EXPLODE_RADIUS = 120; // 爆炸半径
                    this.enemies.forEach(other => {
                        if (other !== enemy && other.active && enemy.pos.dist(other.pos) < EXPLODE_RADIUS) {
                            const aoeDmg = explodeDmg * 0.6; // 范围伤害为爆炸主伤害的 60%
                            const aoeResult = other.takeDamage(aoeDmg);
                            this.combat_recordDamage(aoeResult.actualDamage, 'pyro', sourceType, shotId);
                            
                            // 范围内的敌人也受到热量波及 (增加少量温度)
                            other.applyTemp(config.pyro * 5);
                        }
                    });
                }

                // D. 移除热量回填机制 (根据需求取消回填)
            }
        }
        
        // [新增] 保存当前shotId，供后续额外伤害使用
        this._currentDamageShotId = shotId;
        
        // [新增] 统一显示伤害数字 (使用实际造成的伤害)
        if (this.showDamageNumbers && actualDmg > 0) {
            this.spawn_createFloatingText(hitX, hitY, `-${Math.ceil(actualDmg)}`, damageColor);
        }
        audio.playEnemyHit(hitType);

        // --- [新增] 剑痕共鸣机制 (Stuck Sword Resonance) ---
        if (!killed && enemy.stuckSwords && enemy.stuckSwords.length > 0) {
            enemy.stuckSwords.forEach(sword => {
                if (sword.active) {
                    const level = sword.level || 1;
                    let extraDmg = 0;
                    let resonanceColor = '#0ea5e9';
                    
                    // 1. 计算共鸣伤害和属性
                    if (level === 1) {
                        extraDmg = sword.config.damage * 0.5;
                    } else if (level === 2) {
                        extraDmg = sword.config.damage * 0.5;
                        // 应用 50% 属性效果 (简化处理：直接应用 50% 的温度变化)
                        if (sword.config.cryo > 0) enemy.applyTemp(-CONFIG.balance.cryoAmount * sword.config.cryo * 0.5);
                        if (sword.config.pyro > 0) enemy.applyTemp(CONFIG.balance.pyroAmount * sword.config.pyro * 0.5);
                        resonanceColor = '#6366f1';
                    } else if (level >= 3) {
                        extraDmg = sword.config.damage;
                        // 应用 100% 属性效果
                        if (sword.config.cryo > 0) enemy.applyTemp(-CONFIG.balance.cryoAmount * sword.config.cryo);
                        if (sword.config.pyro > 0) enemy.applyTemp(CONFIG.balance.pyroAmount * sword.config.pyro);
                        resonanceColor = '#f43f5e';
                    }

	                    // 2. 造成额外伤害
	                    if (extraDmg > 0) {
	                        enemy.takeDamage(extraDmg);
	                        this.combat_recordDamage(extraDmg, 'flying_sword', 'flying_sword', this._currentDamageShotId);
	                        this.spawn_createFloatingText(sword.pos.x, sword.pos.y, `+${Math.ceil(extraDmg)}`, resonanceColor);

                            // [新增] 电属性飞剑联动：触发连锁闪电
                            if (sword.config.lightning > 0) {
                                // 按照正常概率触发闪电链
                                this.combat_lightning_triggerChain(enemy, extraDmg, [], sword.config.lightning);
                            }
	                    }

                    // 3. [修复] 视觉特效：斩击动画，使用元素属性颜色
                    const angle = Math.random() * Math.PI * 2;
                    // 根据元素属性决定斩击颜色，优先级：雷 > 火/冰
                    let slashColor = '#0ea5e9'; // 默认飞剑颜色
                    if (sword.config.lightning > 0) slashColor = '#c084fc'; // 雷属性
                    else if (sword.config.pyro > 0) slashColor = '#f97316'; // 火属性
                    else if (sword.config.cryo > 0) slashColor = '#06b6d4'; // 冰属性
                    
                    this.particles.push(new SlashAnim(sword.pos.x, sword.pos.y, angle, 0.35, slashColor));
                    this.spawn_createParticle(sword.pos.x, sword.pos.y, slashColor, 'spark');
                }
            });
            // 清理已失效的子剑
            enemy.stuckSwords = enemy.stuckSwords.filter(s => s.active);
        }

        // 克隆词缀逻辑: 如果敌人被伤害且有 'clone' 词缀，有概率生成克隆
        
        if (!killed && enemy.affixes.includes('clone') && Math.random() < afx.cloneChanceHit) {
             // ... (复制你原来的 clone 生成代码) ...
             const cloneHp = Math.max(1, Math.floor(enemy.maxHp * 0.2));
             const w = this.enemyWidth;
             // ... 寻找位置 ...
             // 简写：实际请保留原来的完整逻辑
             const validCols = [];
             for(let r = 0; r < 3; r++) { for(let c = 0; c < CONFIG.enemyCols; c++) { validCols.push({x: c*w+w/2, y: 80+r*50}); }} // 简单示意
             if (validCols.length > 0) {
                 const pos = validCols[Math.floor(Math.random() * validCols.length)];
                 this.spores.push(new CloneSpore(enemy.pos.x, enemy.pos.y, pos.x, pos.y, () => {
                    const clone = new Enemy(pos.x, pos.y, w, this.enemyHeight, cloneHp, cloneHp);
                    clone.affixes = []; 
                    this.enemies.push(clone);
                }));
             }
        }

        if (killed) { 
            this.spawn_addScore(enemy.maxHp); 

            // [新增] 子剑回收逻辑：如果敌人被杀，插在上面的子剑需要回收
            if (enemy.stuckSwords && enemy.stuckSwords.length > 0) {
                enemy.stuckSwords.forEach(sword => {
                    if (sword.active) {
                        // 寻找回收目标
                        let recallTarget = null;
                        // 寻找母剑是否还插在某个敌人身上
                        const motherBladeMarker = this.sonSwords.find(s => s.mother === sword.mother && s.isMotherBlade && s.state === 'stuck' && s.active);
                        if (motherBladeMarker) {
                            recallTarget = motherBladeMarker.pos;
                        } else {
                            // 母剑不存在或未插在敌人身上，回到玩家位置
                            recallTarget = { x: this.width / 2, y: this.height - 80 };
                        }
                        sword.triggerRecall(recallTarget);
                    }
                });
                enemy.stuckSwords = [];
            }

            // 燃烧扩散逻辑 (保留)
            if (enemy.temp >= 100) {
                this.fireWaves.push(new FireWave(enemy.pos.x, enemy.pos.y));
                game.spawn_createFloatingText(enemy.pos.x, enemy.pos.y - 20, "🔥SPREAD!", "#f97316");
                audio.playExplosion();
                this.enemies.forEach(other => {
                    if (other.active && other !== enemy && enemy.pos.dist(other.pos) < CONFIG.gameplay.fireSpreadRadius) {
                        other.applyTemp(CONFIG.gameplay.fireSpreadTempIncrease);
                        const spreadDmg = enemy.maxHp*CONFIG.gameplay.fireSpreadDamagePercent;
                        other.takeDamage(spreadDmg);
                        // 记录火焰扩散伤害
                        this.combat_recordDamage(spreadDmg, 'pyro', 'main', this._currentDamageShotId);
                    }
                });
            }
            const activeCount = this.enemies.filter(e => e.active && (e.pos.y > 0)).length;
            if(activeCount === 0) {
                console.log(">>> [LOG] 全场敌人已清除。正在清理子弹...");
                this.data_clearProjectiles(); 
                if (this.isEnemyTurn) {
                    console.error(">>> [BUG] 严重错误：在清理子弹时，isEnemyTurn 竟然是 TRUE！");
                }
            }
            if (enemy.type === 'boss') {
                setTimeout(() => {
                    this.stateBeforeRelic = this.phase; 
                    this.openRelicSelection(); 
                }, 500);
            }
        }
        
        // 爆炸逻辑 (保留并增强视觉)
       if (config.explosive) {
            // --- 1. 解析爆炸主题 (Visual Theme Resolver) ---
            // 默认主题 (物理爆炸)
            let theme = {
                waveColor: '#ef4444',       // 冲击波颜色 (红)
                particleColor: '#f87171',   // 粒子颜色 (浅红)
                particleMode: 'spark',      // 粒子模式
                sound: 'explosion'          // (预留)
            };

            // 元素覆盖逻辑 (优先级：火 > 冰 > 电 > 毒/其他)
            if (config.pyro > 0) {
                theme.waveColor = '#f97316';      // 橙色冲击波
                theme.particleColor = '#fdba74';  // 橙黄火星
                theme.particleMode = 'spark';     // 火星四溅
            } else if (config.cryo > 0) {
                theme.waveColor = '#06b6d4';      // 青色冲击波 (寒气)
                theme.particleColor = '#a5f3fc';  // 冰蓝碎片
                theme.particleMode = 'shard';     // 冰渣飞溅
            } else if (config.lightning > 0) {
                theme.waveColor = '#c084fc';      // 紫色冲击波 (电磁脉冲)
                theme.particleColor = '#d8b4fe';  // 紫色电弧
                theme.particleMode = 'spark';     
            } else if (config.isMatryoshka) {
                theme.waveColor = '#d946ef';      // 粉色冲击波 (魔力)
                theme.particleColor = '#f5d0fe';
                theme.particleMode = 'normal';
            }

            // --- 2. 播放视觉特效 ---
            // 生成带有属性颜色的 Shockwave
            this.spawn_createShockwave(projectile.pos.x, projectile.pos.y, theme.waveColor); 
            
            // 生成对应的爆炸粒子群
            const particleCount = 12; // 爆炸产生的粒子数量
            for(let i=0; i < particleCount; i++) { 
                this.spawn_createParticle(projectile.pos.x, projectile.pos.y, theme.particleColor, theme.particleMode); 
            }

            // 如果是火焰爆炸，额外加一点黑烟，增加质感
            if (config.pyro > 0) {
                for(let i=0; i<5; i++) {
                    this.spawn_createParticle(projectile.pos.x, projectile.pos.y, 'rgba(0,0,0,0.5)', 'smoke');
                }
            }
            
            // 播放音效
            audio.playExplosion();

            // --- 3. 造成范围伤害与效果 ---
            this.enemies.forEach(other => {
                // 排除自身 & 距离检测 (爆炸半径 100)
                if (other !== enemy && other.active && projectile.pos.dist(other.pos) < 100) { 
                    
                    // 造成 AOE 伤害 (减半)
                    const aoeDmg = dmg * 0.5;
                    const k = other.takeDamage(aoeDmg); 
                    this.combat_recordDamage(aoeDmg, 'explosive', 'main', this._currentDamageShotId); 
                    if (k) this.spawn_addScore(other.maxHp); 
                    
                    // --- 4. 关键：AOE 也要施加元素效果 ---
                    // 这样爆炸范围内的敌人也会被冰冻/点燃，符合直觉
                    if (config.cryo > 0) {
                        // 范围冰冻效果稍弱 (0.5倍)
                        other.applyTemp(-CONFIG.balance.cryoAmount * config.cryo * 0.5);
                        // 视觉反馈：给被波及的敌人也冒一点冷气
                        if (Math.random() < 0.3) this.spawn_createParticle(other.pos.x, other.pos.y, '#a5f3fc', 'smoke');
                    }
                    if (config.pyro > 0) {
                        other.applyTemp(CONFIG.balance.pyroAmount * config.pyro * 0.5);
                    }
                    if (config.lightning > 0) {
                        other.applyTemp(10 * config.lightning * 0.5);
                        // 闪电链通常只由直接击中触发，这里不触发链式，只加温度/易伤
                    }
                }
            });
        }
    }

    // ... (Rest of Game Controller Methods: advanceWave, updateCombat, etc. same as before) ...

    /**
     * @method advanceWave
     * @description 推进到下一波敌人。
     */
    phase_advanceWave() { 
        this.resolveTemperatureAndAdvance(); // 结算温度效果
        // 根据场上敌人行数决定生成多少行新敌人
        const rows = new Set(this.enemies.filter(e=>e.active).map(e => Math.floor(e.pos.y))); 
        let spawnCount = 1; 
        if (rows.size < 3) spawnCount = 2; // 如果敌人行数少于3，则生成2行
        this.spawn_spawnEnemyRow(spawnCount); 
        
        this.round++; // 回合数增加
        this.prevRoundDamage = this.roundDamage; // 记录上一回合伤害
        this.roundDamage = 0; // 重置本回合伤害
        document.getElementById('round-num').innerText = this.round; 
        showToast(`Round ${this.round}`); 
    }
    /**
     * @method recordDamage
     * @description 记录本回合造成的伤害。
     * @param {number} amount - **重要参数** 伤害量。
     * @param {string} attrType - 属性类型
     * @param {string} sourceType - 来源类型
     * @param {number} shotId - 子弹ID
     */
    combat_recordDamage(amount, attrType = 'damage', sourceType = 'main', shotId = null) {
        if (amount <= 0) return;

        this.roundDamage += amount;
        this.currentShotDamage += amount;

        // --- 1. 更新实时显示的统计 (Game 实例级) ---
        if (!this.currentShotDamageByAttr[attrType]) {
            this.currentShotDamageByAttr[attrType] = {};
        }
        if (!this.currentShotDamageByAttr[attrType][sourceType]) {
            this.currentShotDamageByAttr[attrType][sourceType] = 0;
        }
        this.currentShotDamageByAttr[attrType][sourceType] += amount;

        // --- 2. 更新子弹历史统计 (Shot ID 级) ---
        if (shotId !== null && this.shotDamageMap.has(shotId)) {
            const shotStats = this.shotDamageMap.get(shotId);
            shotStats.total += amount;
            
            if (!shotStats.byAttr[attrType]) {
                shotStats.byAttr[attrType] = {};
            }
            if (!shotStats.byAttr[attrType][sourceType]) {
                shotStats.byAttr[attrType][sourceType] = 0;
            }
            shotStats.byAttr[attrType][sourceType] += amount;
        }

        this.ui_updateRoundDamage();
    }

    /**
     * @method addScore
     * @description 增加分数并提高分数乘数。
     * @param {number} amount - **重要参数** 基础分数。
     */
    spawn_addScore(amount) { 
        const finalScore = Math.floor(amount * this.scoreMultiplier);
        this.score += finalScore;
        const resourceGain = Math.floor(Math.sqrt(finalScore) / 2 + 2);
        if (resourceGain > 0) {
            this.runCurrency += resourceGain;
            this.meta_addCurrency(resourceGain);
            const scoreEl = document.getElementById('score-num');
            if (scoreEl) {
                const rect = scoreEl.getBoundingClientRect();
                this.ui_playResourceFlyEffect(rect.left + rect.width/2, rect.top + rect.height/2, resourceGain);
            }
        } 
        document.getElementById('score-num').innerText = this.score; 
        this.scoreMultiplier = parseFloat((this.scoreMultiplier + 0.2).toFixed(1)); // 乘数增加 0.2
        this.ui_updateMultiplierUI(); 
    }
    /**
     * @method resetMultiplier
     * @description 重置分数乘数。
     */
    sys_resetMultiplier() { 
        this.scoreMultiplier = 1.0; 
        this.ui_updateMultiplierUI(); 
        document.getElementById('multiplier-display').classList.remove('opacity-100'); 
        document.getElementById('multiplier-display').classList.add('opacity-0'); 
    }
    /**
     * @method updateMultiplierUI
     * @description 更新分数乘数 UI。
     */
    ui_updateMultiplierUI() { 
        const el = document.getElementById('multiplier-val'); 
        el.innerText = `x${this.scoreMultiplier.toFixed(1)}`; 
        const container = document.getElementById('multiplier-display'); 
        container.classList.remove('opacity-0'); 
        container.classList.add('opacity-100'); 
        el.classList.remove('pop-anim'); 
        void el.offsetWidth; 
        el.classList.add('pop-anim'); 
    }
    
    /**
     * @method saveShotDamage
     * @description 保存当前子弹的伤害统计到历史记录
     */
    ui_saveShotDamage() {
        if (this.currentShotDamage > 0) {
            // 保存到历史记录，最多保存3个
            this.shotDamageHistory.unshift({
                total: this.currentShotDamage,
                byAttr: JSON.parse(JSON.stringify(this.currentShotDamageByAttr))
            });
            if (this.shotDamageHistory.length > 3) {
                this.shotDamageHistory.pop();
            }
            // 更新显示
            this.ui_updateRoundDamage();
        }
    }
    
    /**
     * @method updateRoundDamage
     * @description 更新当前子弹伤害显示（带滚动数字效果）
     */
    ui_updateRoundDamage() {
        const el = document.getElementById('round-damage-val');
        const container = document.getElementById('round-damage-display');
        if (!el || !container) return;
        
        // 使用本回合实时累计伤害 (roundDamage)
        const targetValue = Math.floor(this.roundDamage);
        const currentValue = parseInt(el.innerText.replace(/,/g, '')) || 0;
        
        if (targetValue > 0) {
            container.classList.remove('opacity-0');
            container.classList.add('opacity-100');
            
            // 如果差值较小，直接更新，避免频繁启动定时器
            if (Math.abs(targetValue - currentValue) < 5) {
                el.innerText = targetValue.toLocaleString();
                return;
            }

            // 滚动数字效果
            if (this._damageScrollInterval) clearInterval(this._damageScrollInterval);
            
            const duration = 300; 
            const steps = 10;
            const stepValue = (targetValue - currentValue) / steps;
            let currentStep = 0;
            
            this._damageScrollInterval = setInterval(() => {
                currentStep++;
                const newValue = Math.floor(currentValue + stepValue * currentStep);
                el.innerText = newValue.toLocaleString();
                
                if (currentStep >= steps) {
                    el.innerText = targetValue.toLocaleString();
                    clearInterval(this._damageScrollInterval);
                }
            }, duration / steps);
        } else {
            container.classList.add('opacity-0');
            container.classList.remove('opacity-100');
            el.innerText = '0';
        }
    }

    /**
     * @method updateDamageStats
     * @description 更新伤害统计图表显示
     */
    ui_updateDamageStats() {
        const container = document.getElementById('damage-stats-container');
        if (!container) return;
        container.innerHTML = '';
        // 修改容器样式：使用 flex-col 垂直排列不同的子弹数据
        container.className = 'flex flex-col gap-4 h-full w-full p-2 overflow-y-auto custom-scrollbar'; 

        // --- 1. 获取数据源 ---
        let shotsData = [];
        let roundNumber = this.round;

        if (this.currentViewingRound === 0) {
            // 查看当前回合（实时数据）
            shotsData = this.shotDamageHistory; 
        } else {
            // 查看历史回合
            const historyIndex = this.roundDamageHistory.length - this.currentViewingRound;
            if (historyIndex >= 0 && historyIndex < this.roundDamageHistory.length) {
                shotsData = this.roundDamageHistory[historyIndex].shots;
                roundNumber = this.roundDamageHistory[historyIndex].round;
            }
        }

        // --- 2. 渲染顶部导航 ---
        const header = document.createElement('div');
        header.className = 'w-full flex justify-between items-center bg-slate-800 p-2 rounded shrink-0 sticky top-0 z-10 border border-slate-700 shadow-md';
        header.innerHTML = `
            <button onclick="game.ui_switchDamageRound(1)" class="text-slate-400 hover:text-white px-3 py-1">◀</button>
            <span class="text-xs font-bold text-amber-400 font-[Cinzel]">Round ${roundNumber}</span>
            <button onclick="game.ui_switchDamageRound(-1)" class="text-slate-400 hover:text-white px-3 py-1">▶</button>
        `;
        container.appendChild(header);

        if (!shotsData || shotsData.length === 0) {
            container.innerHTML += `<div class="text-slate-500 text-center text-xs mt-10 italic">暂无伤害数据</div>`;
            return;
        }

        // --- 3. 遍历每一发子弹 (Shot) 分别渲染 ---
        shotsData.forEach((shot, index) => {
            const shotTotal = shot.total;
            if (shotTotal <= 0) return;

            // 子弹容器
            const shotContainer = document.createElement('div');
            shotContainer.className = 'bg-slate-900/60 p-3 rounded-lg border border-slate-700/50 relative';
            
            // 子弹标题
            const shotTitle = document.createElement('div');
            shotTitle.className = 'text-[10px] text-slate-400 font-bold mb-3 flex justify-between items-center border-b border-slate-700/50 pb-1';
            shotTitle.innerHTML = `
                <span class="bg-slate-800 px-2 py-0.5 rounded text-slate-300">Shot #${index + 1}</span> 
                <span class="text-amber-100">Total: ${Math.ceil(shotTotal).toLocaleString()}</span>
            `;
            shotContainer.appendChild(shotTitle);

            // --- 预计算：找出本发子弹中伤害最高的类型，用于归一化进度条宽度 ---
            let maxTypeTotal = 0;
            const typeTotals = {};
            
            for (const [dtype, sources] of Object.entries(shot.byAttr)) {
                let tTotal = 0;
                // 兼容旧数据格式 (number) 和新格式 (object)
                if (typeof sources === 'number') {
                    tTotal = sources;
                } else {
                    tTotal = Object.values(sources).reduce((a, b) => a + b, 0);
                }
                typeTotals[dtype] = tTotal;
                if (tTotal > maxTypeTotal) maxTypeTotal = tTotal;
            }

            // 按伤害量排序
            const sortedTypes = Object.keys(shot.byAttr).sort((a, b) => typeTotals[b] - typeTotals[a]);

            sortedTypes.forEach(dtype => {
                const sources = shot.byAttr[dtype];
                const typeTotal = typeTotals[dtype];
                
                // [修复3]：横轴坐标缩放
                // 进度条容器的宽度 = (当前类型总伤 / 本发子弹最大类型总伤) * 100%
                // 这样伤害低的类型条就会很短
                const rowWidthPercent = maxTypeTotal > 0 ? (typeTotal / maxTypeTotal) * 100 : 0;

                const row = document.createElement('div');
                row.className = 'flex flex-col gap-1 mb-2';

                // 类型标签与数值
                const label = document.createElement('div');
                label.className = 'flex justify-between text-[10px] px-1';
                
                // [修复1]：颜色定义优化
                // 将 bounce 改为绿色，避免与 scatter (黄色) 混淆
                const typeConfig = {
                    'bounce':   { name: '⤴️ 弹射', color: '#22c55e' }, // Green
                    'pierce':   { name: '➡️ 穿透', color: '#fca5a5' }, // Red-ish
                    'scatter':  { name: '🔱 散射', color: '#facc15' }, // Yellow
                    'damage':   { name: '⚔️ 基础', color: '#e2e8f0' }, // White/Slate
                    'cryo':     { name: '❄️ 冰霜', color: '#06b6d4' },
                    'pyro':     { name: '🔥 火焰', color: '#f97316' },
                    'lightning':{ name: '⚡ 闪电', color: '#c084fc' },
                    'wind':     { name: '🌪️ 风暴', color: '#34d399' },
                    'flying_sword': { name: '🗡️ 飞剑', color: '#0ea5e9' },
                    'explosive': { name: '💥 爆炸', color: '#f87171' }
                };
                
                const conf = typeConfig[dtype] || { name: dtype, color: '#cbd5e1' };

                label.innerHTML = `
                    <span style="color:${conf.color}" class="font-bold shadow-black drop-shadow-sm">${conf.name}</span>
                    <span class="text-slate-400 text-[9px]">${Math.ceil(typeTotal).toLocaleString()}</span>
                `;
                row.appendChild(label);

                // 进度条轨道 (全长背景)
                const track = document.createElement('div');
                track.className = 'w-full h-2.5 bg-slate-800/50 rounded-r-md rounded-bl-md overflow-hidden relative';
                
                // 实际长度容器 (根据伤害比例缩放)
                const barWrapper = document.createElement('div');
                barWrapper.style.width = `${Math.max(1, rowWidthPercent)}%`; // 至少显示 1%
                barWrapper.className = 'h-full flex transition-all duration-500 relative';
                
                // 数据源细分 (Stacking Segments)
                let sourceEntries = [];
                if (typeof sources === 'number') {
                    sourceEntries = [['main', sources]];
                } else {
                    // 排序：主子弹(main)在左侧，其他在右侧
                    sourceEntries = Object.entries(sources).sort((a, b) => (a[0] === 'main' ? -1 : 1));
                }

                sourceEntries.forEach(([stype, amount]) => {
                    // 每一段的宽度相对于该类型的总长度
                    const segmentPercent = (amount / typeTotal) * 100;
                    const segment = document.createElement('div');
                    segment.style.width = `${segmentPercent}%`;
                    
                    // 颜色逻辑：
                    // 如果是散射产生的伤害，使用特定纹理或颜色，但在“弹射”条里，最好保持弹射的主色调，
                    // 只用透明度或高亮来区分来源，避免把“弹射”看成“散射”。
                    if (stype === 'scatter') {
                        segment.style.backgroundColor = conf.color; // 保持类型颜色
                        segment.style.backgroundImage = 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)';
                        segment.style.backgroundSize = '4px 4px'; // 加斜纹表示散射来源
                    } else {
                        segment.style.backgroundColor = conf.color;
                    }
                    
                    // 透明度区分：非主子弹稍微淡一点
                    segment.style.opacity = (stype === 'main') ? '1' : '0.8';
                    
                    // Tooltip
                    segment.title = `${stype === 'main' ? '主子弹' : (stype === 'scatter' ? '散射' : stype)}: ${Math.ceil(amount)}`;
                    
                    barWrapper.appendChild(segment);
                });

                track.appendChild(barWrapper);
                row.appendChild(track);
                shotContainer.appendChild(row);
            });
            
            container.appendChild(shotContainer);
        });

        // 底部图例
        const legend = document.createElement('div');
        legend.className = 'mt-2 pt-2 border-t border-slate-700 flex flex-wrap gap-3 justify-center text-[9px] text-slate-500';
        legend.innerHTML = `
            <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-sm bg-slate-400"></div> 主子弹</div>
            <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-sm bg-slate-400 opacity-80" style="background-image: linear-gradient(45deg, rgba(255,255,255,0.4) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.4) 75%, transparent 75%, transparent); background-size: 4px 4px;"></div> 散射来源</div>
        `;
        container.appendChild(legend);
    }
    
    /**
     * @method switchDamageRound
     * @description 切换伤害统计查看的回合
     */
    ui_switchDamageRound(direction) {
        this.currentViewingRound += direction;
        if (this.currentViewingRound < 0) this.currentViewingRound = 0;
        if (this.currentViewingRound > this.roundDamageHistory.length) {
            this.currentViewingRound = this.roundDamageHistory.length;
        }
        this.ui_updateDamageStats();
    }
    
    /**
     * @method toggleDamagePanel
     * @description 切换伤害统计面板的显示/隐藏
     */
    ui_toggleDamagePanel() {
        if (!this.ui) return;
        
        const drawer = document.getElementById('info-drawer');
        if (!drawer) return;
        
        const isOpen = !drawer.classList.contains('translate-y-full');
        
        if (isOpen) {
            // 关闭面板
            this.ui.closeDrawer();
        } else {
            // 打开面板并切换到伤害统计标签
            drawer.classList.remove('translate-y-full');
            this.ui.switchTab('damage');
        }
    }

    /**
     * @method updateUI
     * @description 更新 UI 界面显示，强制管理各阶段元素的显隐
     */
     ui_updateUI() {
        // 1. 基础：隐藏所有阶段的主容器 (.ui-overlay)
        document.querySelectorAll('.ui-overlay').forEach(el => { 
            el.style.display = 'none'; 
            el.classList.add('hidden-phase'); 
            el.classList.remove('active-phase'); 
        });
        // 2. 显示当前阶段的主容器
        // [META] 兼容 phase-meta, shop, truth_book
        const activeEl = document.getElementById(`phase-${this.phase}`); 
        if(activeEl) { 
            activeEl.style.display = 'flex'; 
            // 微小延迟以触发 CSS transition (如果有)
            setTimeout(() => { 
                activeEl.classList.remove('hidden-phase'); 
                activeEl.classList.add('active-phase'); 
            }, 10); 
        }
        
        // [META] 切换到主界面或商店时更新货币显示
        if (this.phase === 'meta' || this.phase === 'shop') {
            this.ui_updateMetaCurrency();
        }

        // 1. 底部面板 (.bottom-panel) 只在收集阶段 (gathering) 显示
        const bottomPanel = document.querySelector('.bottom-panel');
        if (bottomPanel) {
            if (this.phase === 'gathering') {
                bottomPanel.style.display = 'flex';
            } else {
                bottomPanel.style.display = 'none'; // 战斗阶段隐藏底部面板
            }
        }

        // A. 技能栏 (Skill Bar) - 仅在战斗且非敌人回合显示
        const skillBar = document.getElementById('skill-bar');
        if (skillBar) {
            // 只有在 combat 阶段才显示，其他阶段强制隐藏
            skillBar.style.display = (this.phase === 'combat') ? 'flex' : 'none';
        }

        // B. 连击倍率显示 (Multiplier)
        const multiplierEl = document.getElementById('multiplier-display');
        if (multiplierEl) {
            multiplierEl.style.opacity = (this.phase === 'combat') ? '1' : '0';
        }

        // C. 技能点面板 (SP Panel)
        // 逻辑：在 gathering 和 combat 显示，在选择阶段隐藏
        const spPanel = document.getElementById('sp-panel');
        if (spPanel) {
            if (this.phase === 'gathering' || this.phase === 'combat') {
                spPanel.style.opacity = '1';
                spPanel.style.pointerEvents = 'auto'; // 允许交互（查看提示等）
            } else {
                spPanel.style.opacity = '0';
                spPanel.style.pointerEvents = 'none';
            }
        }
        
        // D. 战斗 HUD (右侧小卡片)
        // 再次确保它在非战斗阶段隐藏 (虽然 renderRecipeHUD 也会处理)
        const combatHud = document.getElementById('recipe-hud-container');
        if (combatHud) {
            if (this.phase === 'combat') {
                combatHud.classList.remove('hidden'); // 确保进入战斗时可见
            } else {
                combatHud.classList.add('hidden');
            }
        }
        // E. 确保 HTML 结构中的弹药槽 (.ammo-stage) 不会泄露
        // 如果你的 current/next 弹药槽是独立元素且有 ID，可以在这里加类似的隐藏逻辑
        // 例如：
        /*
        const ammoSlots = document.getElementById('ammo-ui-container');
        if (ammoSlots) ammoSlots.style.display = (this.phase === 'combat') ? 'block' : 'none';
        */
    }
    //  計算波浪的動態速度
    // [修正] 计算波浪的动态速度
    /**
     * [AUTO-GENERATED] TODO: Add a description for calc_calculateWaveSpeed.
     */
    calc_calculateWaveSpeed() {
        const maxSpeed = 25 * this.timeScale;
        const scanSpeed = 3 * this.timeScale;
        const clearSpeed = 12 * this.timeScale; //  清场时的展示速度 (适中)

        // 1. 如果有阻尼 (刚刚触发了事件)，强制慢速
        if (this.waveMomentumTimer > 0) {
            return scanSpeed;
        }

        // 2. 波浪已经跑出屏幕上方，加速销毁
        if (this.enemyWaveY < -50) return maxSpeed;

        // 3. 统计活着的敌人数量
        const activeEnemyCount = this.enemies.filter(e => e.active).length;

        // [核心修复] 如果场上没有敌人 (清场状态)，不要用 maxSpeed，
        // 而是用 clearSpeed，让玩家能看清波浪扫过空场，产生"安全确认"的视觉反馈。
        if (activeEnemyCount === 0) {
            return clearSpeed;
        }

        let nearestDist = Infinity;
        const defenseLineY = this.height - 100;
        
        // 刚开始还没进入防线区域时，快速进场
        if (this.enemyWaveY > defenseLineY) return maxSpeed;

        let hasEnemyAbove = false;
        this.enemies.forEach(e => {
            if (!e.active || e.hasActedThisTurn) return;
            
            const enemyBottom = e.pos.y + e.height/2;
            // 只检测波浪上方的敌人
            if (enemyBottom <= this.enemyWaveY + 50) { 
                const dist = this.enemyWaveY - enemyBottom;
                if (dist >= -20 && dist < nearestDist) {
                    nearestDist = dist;
                    hasEnemyAbove = true;
                }
            }
        });

        if (!hasEnemyAbove) {
            return maxSpeed; // 只有在有敌人但都不在波浪上方时，才全速追赶
        } else {
            const slowDownRange = 150; 
            const stopRange = 10;      
            if (nearestDist > slowDownRange) return maxSpeed;
            else if (nearestDist < stopRange) return scanSpeed;
            else {
                const t = nearestDist / slowDownRange;
                return scanSpeed + (maxSpeed - scanSpeed) * (t * t); 
            }
        }
    }
    /**
     * @method switchPhase
     * @description 切换游戏阶段。
     * @param {string} newPhase - **重要参数** 新阶段名称 ('selection', 'gathering', 'combat', 'gameover')。
     */
    phase_switchPhase(newPhase) {
        this.phase = newPhase;
        this.ui_updateUI(); // 更新 UI 界面
        const titleContainer = document.getElementById('phase-title-container');
        const titleText = document.getElementById('phase-title');
        const subText = document.getElementById('phase-sub');
        titleContainer.classList.remove('minimized'); // 显示阶段标题

        // 根据阶段设置标题文本
        let text = "命運抉择"; let sub = "選擇你的命運";
        if (newPhase === 'gathering') { text = "研磨階段"; sub = "收集魔力"; }
        else if (newPhase === 'combat') { text = "戰鬥階段"; sub = "抵禦魔像"; }
        else if (newPhase === 'truth_book') { text = "真理之書"; sub = "洞悉萬物之理"; }
        else if (newPhase === 'training') { text = "試煉場"; sub = "極限戰鬥測試"; }
        else if (newPhase === 'training') { text = "試煉場"; sub = "極限戰鬥測試"; }
        titleText.innerText = text; subText.innerText = sub;
        
        // 1.2秒后隐藏阶段标题
        setTimeout(() => { titleContainer.classList.add('minimized'); }, 1200);
    }
    /**
     * 显示遗物选择界面
     */
    /**
     * 显示遗物选择界面 (支持稀有度权重 + 防重复)
     */
    ui_showRelicSelection() {
        // 1. 记录之前的状态 (用于关闭时恢复)
        this.stateBeforeRelic = this.phase; 

        // --- 配置权重 ---
        const RARITY_WEIGHTS = CONFIG.balance.relicRarityWright

        // 2. 准备遗物池
        // 过滤掉玩家已经拥有的遗物 (this.ownedRelics)
        let pool = RELIC_DB.filter(r => !this.ownedRelics.includes(r.id));
        
        // 如果池子空了（全收集了），就给一些保底的或者是空的
        if (pool.length === 0) {
            showToast("已收集所有遗物！");
            this.ui_closeRelicSelection(); // 或者给个分数奖励
            return;
        }

        const choices = [];
        
        // 3. 抽取 3 个遗物 (加权随机 & 不放回)
        for(let i=0; i<CONFIG.gameplay.relicChoiceNum; i++) {
            if(pool.length === 0) break;

            // A. 计算当前临时池子的总权重
            let totalWeight = 0;
            pool.forEach(r => {
                totalWeight += (RARITY_WEIGHTS[r.rarity] || 10); // 默认权重10
            });

            // B. 生成随机数 [0, totalWeight)
            let randomVal = Math.random() * totalWeight;
            let selectedIdx = -1;

            // C. 遍历寻找命中的遗物
            for (let j = 0; j < pool.length; j++) {
                const weight = RARITY_WEIGHTS[pool[j].rarity] || 10;
                randomVal -= weight;
                if (randomVal <= 0) {
                    selectedIdx = j;
                    break;
                }
            }

            // D. 兜底 (防止浮点数误差导致没选中，默认选第一个)
            if (selectedIdx === -1) selectedIdx = 0;

            // E. 加入结果 并 从临时池中移除 (防止同一次选卡出现两个一样的)
            choices.push(pool[selectedIdx]);
            pool.splice(selectedIdx, 1);
        }

        // 4. 生成 HTML (保持原有逻辑)
        const container = document.getElementById('relic-container');
        container.innerHTML = '';
        
        choices.forEach(relic => {
            const el = document.createElement('div');
            // 加上 rarity 类名以便 CSS 显示不同边框颜色
            el.className = `relic-card ${relic.rarity || 'common'}`; 
            el.innerHTML = `
                <div class="relic-icon">${relic.icon}</div>
                <div class="relic-name">${relic.name}</div>
                <div class="relic-desc">${relic.desc}</div>
            `;
            el.onclick = (e) => { 
                e.stopPropagation(); 
                this.ui_selectRelic(relic);
            };
            container.appendChild(el);
        });

        // 5. 显示界面
        const overlay = document.getElementById('phase-relic');
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden-phase');
        overlay.classList.add('active-phase');
    }

    /**
     * 玩家选择遗物
     */
    ui_selectRelic(relic) {
        this.ownedRelics.push(relic.id);
        showToast(`獲得遺物: ${relic.name}`);
        //  处理新遗物效果
        if (relic.effect === 'pink_peg_up') {
            this.pinkPegCount += 3; // 叠加增加
        } 
        else if (relic.effect === 'combat_wall') {
            this.hasCombatWall = true;
        }else if (relic.effect === 'permanent_size_up') {
    this.marbleSizeBonus = 4.2; // 每次获得增加 4 像素半径
}else if (relic.effect === 'unlock_slot') {
            if (!this.unlockedSlots.includes(relic.slotType)) {
                this.unlockedSlots.push(relic.slotType);
            }
            // 规则：解锁任意一种，特殊槽出现数量从 0 -> 1
            if (this.slotCount === 0) this.slotCount = 1;
        }
        else if (relic.effect === 'slot_count_up') {
            this.slotCount += 1;
        } else if (relic.effect === 'row_count_up') {
            this.currentRows += 2;
            this.phase_gathering_initPachinko(true);
        }
        //  支持單個字串或數組的解鎖邏輯
        if (relic.unlocks) {
            const keys = Array.isArray(relic.unlocks) ? relic.unlocks : [relic.unlocks];
            const boost = relic.boost || 10;
            
            keys.forEach(key => {
                const current = this.unlockedWeights[key] || 0;
                // 如果是第一次解鎖，設為 boost；如果是重複獲取，增加權重
                this.unlockedWeights[key] = current === 0 ? boost : current + Math.floor(boost * 1.5);
                
                // 加入保底列表
                this.guaranteedNextRound.push(key);
            });
            
            showToast(`已解鎖相關屬性!`);
        }


        this.ui_closeRelicSelection();
    }

    /**
     * 跳过选择
     */
    ui_skipRelic() {
        this.spawn_addScore(500);
        showToast("獲得 500 分");
        this.ui_closeRelicSelection();
    }

    /**
     * 关闭界面并恢复
     */
    ui_closeRelicSelection() {
        const overlay = document.getElementById('phase-relic');
        overlay.style.display = 'none';
        overlay.classList.remove('active-phase');
        overlay.classList.add('hidden-phase');
        
        // [核心修复] 根据打开前的状态决定去向
        if (this.stateBeforeRelic === 'gathering') {
            // 情况 A: 在收集阶段(打中遗物槽)打开的
            // 不需要跳转阶段，只需要尝试结算当前回合
            // (因为在 updateGathering 里，球已经被移除并 activeBalls-- 了，这里检查是否需要发射)
            this.phase_gathering_attemptComplete();
        } else {
            // 情况 B: 在回合结束(打完BOSS/固定回合事件)打开的
            // 正常进入下一轮的选弹珠阶段
            this.sys_initSelectionPhase(); 
        }
    }
    /**
     * 初始化弹珠选择阶段
     */
    sys_initSelectionPhase() {
        this.phase_switchPhase('selection');
        this.spawn_generateMarbleOptions(); // 生成弹珠选项
        this.selectedMarbles = []; // 重置已选择弹珠
        document.getElementById('selected-count').innerText = '0'; 
        document.getElementById('confirm-selection-btn').disabled = true; 
        document.getElementById('recipe-hud-container').classList.add('hidden');
    }
    /**
     * @method generateMarbleOptions
     * @description 生成弹珠选项 (5个) 供玩家选择。
     * @returns {Array<MarbleDefinition>} 包含五个随机弹珠定义的数组。
     */
    // 在 Game 類中

    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_generateMarbleOptions.
     */
    spawn_generateMarbleOptions() { 
        const container = document.getElementById('marble-selection-grid'); 
        container.innerHTML = ''; 
        this.marblesPool = []; 
        
        // 定義屬性到彈珠定義的映射
        const typeMapping = {
            laser: () => new MarbleDefinition('laser'),
            white: () => new MarbleDefinition('white'),
            explosive: () => new MarbleDefinition('explosive'),
            rainbow: () => new MarbleDefinition('rainbow'),
            matryoshka: () => new MarbleDefinition('matryoshka'),
            resonance: () => new MarbleDefinition('resonance'),
            // 剩下的都是 colored 類型，但 subtype 不同
            bounce: () => new MarbleDefinition('bounce'),
            pierce: () => new MarbleDefinition('pierce'),
            scatter: () => new MarbleDefinition('scatter'),
            damage: () => new MarbleDefinition('damage'),
            cryo: () => new MarbleDefinition('cryo'),
            pyro: () => new MarbleDefinition('pyro')

        };

        for(let i=0; i < CONFIG.gameplay.selectionCount; i++) {
            let m;
            
            // 1. 保底機制
            if (this.guaranteedNextRound.length > 0) {
                const key = this.guaranteedNextRound.shift();
                if (typeMapping[key]) m = typeMapping[key]();
            } 
            
            // 2. 加權隨機機制
            if (!m) {
                // 計算總權重
                let total = 0;
                const keys = Object.keys(this.unlockedWeights);
                keys.forEach(k => total += this.unlockedWeights[k]);
                
                let r = Math.random() * total;
                for (const key of keys) {
                    r -= this.unlockedWeights[key];
                    if (r <= 0) {
                        if (typeMapping[key]) m = typeMapping[key]();
                        break;
                    }
                }
            }
            
            // 兜底防止出錯
            if (!m) m = new MarbleDefinition('white');
            
            this.marblesPool.push(m); 
            
            // ... (創建 UI 卡片代碼保持不變) ...
            const card = document.createElement('div'); 
            card.className = 'select-card'; 
            card.onclick = () => this.sys_toggleMarbleSelection(i, card); 
            const icon = document.createElement('div'); 
            icon.className = 'select-icon flex-shrink-0'; 
            icon.style.background = m.getColor(); 
            const name = document.createElement('div'); 
            name.className = 'text-xs font-bold text-center text-slate-200 mt-2'; 
            name.innerText = m.getName(); 
            card.append(icon, name); 
            container.appendChild(card); 
        } 
    }
    /**
     * @method toggleMarbleSelection
     * @description 切换指定索引弹珠的选中状态。
     * @param {number} idx - **重要参数** 弹珠在 marblesPool 中的索引。
     * @param {HTMLElement} cardEl - **重要参数** 弹珠对应的 UI 元素。
     */
    sys_toggleMarbleSelection(idx, cardEl) { 
        if (this.selectedMarbles.includes(idx)) {
            // 取消选择
            this.selectedMarbles = this.selectedMarbles.filter(i => i !== idx); 
            cardEl.classList.remove('selected'); 
        } else { 
            // 选择 (最多 3 个)
            if (this.selectedMarbles.length < 3) { 
                this.selectedMarbles.push(idx); 
                cardEl.classList.add('selected'); 
            } 
        } 
        const count = this.selectedMarbles.length; 
        document.getElementById('selected-count').innerText = count; 
        document.getElementById('confirm-selection-btn').disabled = count !== 3; // 只有选满 3 个才能确认
    }
    /**
     * @method confirmSelection
     * @description 确认玩家选择的弹珠，并进入收集阶段。
     */
    ui_confirmSelection() { 
        if (this.selectedMarbles.length !== 3) return; 
        this.marbleQueue = this.selectedMarbles.map(i => this.marblesPool[i]); // 将选中的弹珠放入队列
        this.phase_startGatheringPhase(); 
    }

    /**
     * @method startGatheringPhase
     * @description 开始收集阶段，初始化弹珠台和队列。
     */

    /**
     * [AUTO-GENERATED] TODO: Add a description for phase_startGatheringPhase.
     */
    phase_startGatheringPhase() {
        // 保存上一回合的伤害数据
        if (this.shotDamageHistory.length > 0) {
            this.roundDamageHistory.push({
                round: this.round,
                shots: JSON.parse(JSON.stringify(this.shotDamageHistory))
            });
        }
        
        this.phase_switchPhase('gathering');
        requestAnimationFrame(() => {
            this.ui_updateUICache();
        });
        if (this.pegs.length === 0) {
            this.phase_gathering_initPachinko(); 
        }
        
        // --- 新增：初始化持久阈值变量 ---
        this.persistentThreshold = CONFIG.gameplay.initTriggerThreshold; 
        // -----------------------------
        this.ui.updateSkillPoints(this.skillPoints);
        this.ammoQueue = []; 
        this.dropBalls = []; 
        this.activeMarbleIndex = 0; 
        this.combat_updateHitProgress(0, this.persistentThreshold); 
        this.ui_updateGatheringQueueUI(); 
        this.ui_renderRecipeHUD(); 
        this.combat_updateMulticastDisplay(0);
        this.ui_renderRecipeHUD();
    }
    /**
     * @method initRecipeHUD
     * @description 初始化配方 HUD (隐藏)。
     */
    sys_initRecipeHUD() { 
        this.ui_renderRecipeHUD(); 
        const container = document.getElementById('recipe-hud-container'); 
        container.classList.add('hidden'); 
    }
    /**
     * @method toggleHud
     * @description 切换 HUD 展开/折叠状态。
     */
    sys_toggleHud() { 
        this.hudExpanded = !this.hudExpanded; 
        this.ui_renderRecipeHUD(); 
    }
    /**
     * @method renderRecipeHUD
     * @description 渲染配方 HUD (严格单例渲染)
     */
    /**
     * [UI] 渲染配方界面的抬头显示 (HUD)。
     * 负责展示当前收集的弹珠属性和配方预览。
     */
    ui_renderRecipeHUD() {
        // 获取两个容器
        const gatheringHud = document.getElementById('gathering-hud-mount'); 
        const combatHud = document.getElementById('recipe-hud-container');
        
        // --- 战斗阶段 ---
        if (this.phase === 'combat') { 
            // 1. 确保收集阶段的容器为空 (尽管 updateUI 已经隐藏了它的父级，清空更保险)
            if (gatheringHud) gatheringHud.innerHTML = '';

            // 2. 渲染战斗悬浮 HUD
            if (combatHud) {
                combatHud.classList.remove('hidden'); 
                combatHud.classList.add('recipe-hud-floating'); 
                combatHud.innerHTML = '';
                
                const previewLimit = 4;
                this.ammoQueue.slice(0, previewLimit).forEach((recipe, idx) => {
                    const isCurrent = (idx === 0);
                    const card = document.createElement('div');
                    card.className = `recipe-card ${isCurrent ? 'current' : 'queue'} mb-1 transition-all duration-300`;
                    
                    // --- 渲染 Header ---
                    const header = document.createElement('div');
                    header.className = 'flex justify-between items-center border-b border-white/10 pb-1 mb-1';
                    let nameStr = '普通魔藥';
                    if (recipe.explosive) nameStr = '爆破魔藥';
                    else if (recipe.isLaser) nameStr = '光束魔藥';
                    else if (recipe.isMatryoshka) nameStr = '套娃魔藥';
                    header.innerHTML = `<span class="font-bold text-amber-400 text-[11px]">${nameStr}</span><span class="text-[10px] text-slate-300 bg-slate-700/50 px-1 rounded">DMG ${recipe.damage || 0}</span>`;
                    
                    // --- 渲染 Grid ---
                    const grid = document.createElement('div');
                    grid.className = 'grid grid-cols-4 gap-0.5 text-[9px] leading-tight';
                    // ... (复制你原有的 stats 遍历逻辑) ...
                    const stats = [
                        { k: 'flying_sword', i: CONFIG.ui.attributeDisplay.flying_sword.icon },
                        { k: 'bounce', i: CONFIG.ui.attributeDisplay.bounce.icon },
                        { k: 'pierce', i: CONFIG.ui.attributeDisplay.pierce.icon },
                        { k: 'scatter', i: CONFIG.ui.attributeDisplay.scatter.icon },
                        { k: 'multicast', i: CONFIG.ui.attributeDisplay.multicast.icon },
                        { k: 'cryo', i: CONFIG.ui.attributeDisplay.cryo.icon },
                        { k: 'pyro', i: CONFIG.ui.attributeDisplay.pyro.icon },
                        { k: 'lightning', i: CONFIG.ui.attributeDisplay.lightning.icon },
                        { k: 'laser', i: CONFIG.ui.attributeDisplay.laser.icon },
                        { k: 'wind', i: CONFIG.ui.attributeDisplay.wind.icon }
                    ];
                    let hasStats = false;
                    stats.forEach(s => {
                        const val = recipe[s.k];
                        if (val > 0) {
                            hasStats = true;
                            const tag = document.createElement('div');
                            tag.innerHTML = `${s.i}<span class="text-white ml-px">${val}</span>`;
                            grid.appendChild(tag);
                        }
                    });
                    if (!hasStats) grid.innerHTML = '<span class="col-span-4 text-slate-500 italic text-center">基础属性</span>';

                    card.appendChild(header); // 挂载标题
                    card.appendChild(grid);   // 必须添加这一行，否则图标不显示！
                    if (isCurrent) {
                        const indicator = document.createElement('div');
                        indicator.className = 'absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-400 rounded-full shadow-[0_0_8px_#fbbf24]';
                        card.appendChild(indicator);
                    }
                    combatHud.appendChild(card);
                });
            }
        } 
        else { 
            // --- 收集阶段 ---
            
            // 1. 隐藏战斗 HUD
            if (combatHud) {
                combatHud.classList.add('hidden'); 
                combatHud.classList.remove('recipe-hud-floating'); 
                combatHud.innerHTML = '';
            }

            // 2. 渲染收集阶段横向滚动条
            if (gatheringHud && this.phase === 'gathering') {
                gatheringHud.innerHTML = ''; 
                this.marbleQueue.forEach((item, idx) => { 
                    const isActive = idx === this.activeMarbleIndex; 
                    this.ui_renderRecipeCard(gatheringHud, item, isActive, isActive ? 'current' : 'queue'); 
                }); 
            }
        }
    }
    /**
     * @method renderRecipeCard
     * @description 渲染单个配方/弹珠卡片。
     * @param {HTMLElement} container - **重要参数** 容器元素。
     * @param {object} item - **重要参数** 弹珠定义或配方对象。
     * @param {boolean} isActive - 是否为当前激活项。
     * @param {string} statusClass - 状态 CSS 类名。
     */
    ui_renderRecipeCard(container, item, isActive, statusClass) {
        const el = document.createElement('div'); 
        el.className = `recipe-card ${statusClass}`; 
        
        const head = document.createElement('div'); 
        // [优化]：
        // 1. mb-0.5 (2px) 替代 mb-1 (4px)
        // 2. pb-0.5 (2px) 替代 pb-1 (4px)
        // 3. text-[10px] 稍微减小标题字号，使其更精致
        head.className = 'flex items-center justify-between mb-0.5 border-b border-slate-600/50 pb-0.5'; 
        
        const name = document.createElement('span'); 
        name.innerText = item.getName ? item.getName() : (item.name || '光球');
        name.className = 'font-bold text-amber-100 mr-2 text-[11px]'; // 标题字号 11px
        head.appendChild(name); 
        
        const mats = document.createElement('div'); 
        mats.className = 'mats-grid'; // 确保使用了新的 grid 类

        const counts = {}; 
        if (item.collected) { 
            item.collected.forEach(type => { 
                counts[type] = (counts[type] || 0) + 1; 
            }); 
        }

        const colors = {
            'flying_sword': { c: CONFIG.colors.flying_sword, l: CONFIG.ui.attributeDisplay.flying_sword.icon, n: '劍' },
            'bounce': { c: CONFIG.colors.matBounce, l: CONFIG.ui.attributeDisplay.bounce.icon, n: '彈' },
            'pierce': { c: CONFIG.colors.matPierce, l: CONFIG.ui.attributeDisplay.pierce.icon, n: '穿' },
            'scatter': { c: CONFIG.colors.matScatter, l: CONFIG.ui.attributeDisplay.scatter.icon, n: '散' },
            'damage': { c: CONFIG.colors.matDamage, l: CONFIG.ui.attributeDisplay.damage.icon, n: '強' },
            'cryo': { c: CONFIG.colors.matCryo, l: CONFIG.ui.attributeDisplay.cryo.icon, n: '冷' },
            'pyro': { c: CONFIG.colors.matPyro, l: CONFIG.ui.attributeDisplay.pyro.icon, n: '熱' },
            'lightning': { c: CONFIG.colors.matLightning, l: CONFIG.ui.attributeDisplay.lightning.icon, n: '雷' },
            'laser': { c: CONFIG.colors.laser, l: CONFIG.ui.attributeDisplay.laser.icon, n: '光' },
            'wind': { c: CONFIG.colors.matWind, l: CONFIG.ui.attributeDisplay.wind.icon, n: '風' }
        };

        Object.keys(counts).forEach(type => { 
            const info = colors[type]; 
            if(!info) return; 
            const row = document.createElement('div'); 
            row.className = 'mat-row text-slate-300'; 
            // 图标和文字之间只留极小的间距
            row.innerHTML = `<span style="color:${info.c}; font-size:0.8em;">${info.l}</span> <span class="ml-0.5">${info.n}${counts[type]}</span>`; 
            mats.appendChild(row); 
        });
        
        if (item.lightning > 0) {
             const lightningBadge = document.createElement('div');
             lightningBadge.className = 'mat-row text-purple-300 font-bold';
             lightningBadge.innerHTML = `<span style="font-size:0.8em;">⚡</span> <span class="ml-0.5">反應: ${item.lightning}</span>`;
             mats.appendChild(lightningBadge);
        }
        
        if (Object.keys(counts).length === 0) { 
            mats.className = 'text-slate-500 text-[9px] mt-0.5'; // 无材料时也紧凑点
            mats.innerHTML = '<span>無材料</span>'; 
        } 
        
        if (item.multicast > 0) {
            const badge = document.createElement('div');
            // 样式：绝对定位在卡片右上角或醒目位置
            badge.className = 'absolute -top-2 -right-2 bg-slate-900 border border-slate-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10';
            
            // 根据连击数变色
            if (item.multicast >= 5) {
                badge.style.borderColor = '#d8b4fe';
                badge.style.color = '#d8b4fe';
                badge.style.boxShadow = '0 0 5px #d8b4fe';
            } else if (item.multicast >= 10) {
                badge.style.borderColor = '#facc15';
                badge.style.color = '#facc15';
            }
            
            badge.innerText = `x${1+item.multicast}`;
            el.appendChild(badge); // 将徽章添加到卡片中
            
            // 确保父元素 el 有 relative 定位，以便 badge 绝对定位
            el.style.position = 'relative';
            // 确保 overflow 不是 hidden，否则徽章会被切掉
            el.style.overflow = 'visible'; 
        }

        el.append(head, mats); 
        container.appendChild(el);
    }
    /**
     * 初始化弹珠台 (Pachinko) 的钉子和特殊槽位
     */
    /**
     * @method initPachinko
     * @description 初始化弹珠台（Pachinko）的钉子和特殊槽位。
     */

    /**
     * [AUTO-GENERATED] TODO: Add a description for sys_initPachinko.
     */
    phase_gathering_initPachinko(shouldInherit = false) {
        // [修复] 使用动态行数
        const rows = this.currentRows || CONFIG.gameplay.rows;
        // [修复] 获取间距配置
        const spacingX = CONFIG.gameplay.spacingX || 45;
        const spacingY = CONFIG.gameplay.spacingY || 45;
        
        // [修复] 修正 width 引用
        const offsetX = (this.width - (CONFIG.gameplay.cols - 1) * spacingX) / 2;
        const offsetY = 120;

        const previousPegs = [...this.pegs];
        this.pegs = [];
        this.specialSlots = [];
        let pegIndex = 0;
        let maxPegY = 0;

        for (let r = 0; r < rows; r++) {
            const isOddRow = r % 2 !== 0;
            const cols = isOddRow ? CONFIG.gameplay.cols - 1 : CONFIG.gameplay.cols;
            const rowOffsetX = isOddRow ? spacingX / 2 : 0;

            for (let c = 0; c < cols; c++) {
                const x = offsetX + rowOffsetX + c * spacingX;
                const y = offsetY + r * spacingY;
                maxPegY = Math.max(maxPegY, y);

                let type = 'normal';
                let level = 1;

                // [继承逻辑]
                if (shouldInherit && previousPegs[pegIndex]) {
                    const prevPeg = previousPegs[pegIndex];
                    // 排除粉色钉子（假设它是临时Buff）
                    if (prevPeg.type !== 'pink') {
                        type = prevPeg.type;
                        level = prevPeg.level || 1;
                    } else {
                        type = this.phase_gathering_getRandomPegType();
                    }
                } else {
                    type = this.phase_gathering_getRandomPegType();
                }

                let p = new Peg(x, y, type);
                p.level = level;
                // [继承逻辑] 如果继承，保留当前的冷却状态
                if (shouldInherit && previousPegs[pegIndex]) {
                     p.cooldownTimer = previousPegs[pegIndex].cooldownTimer;
                }
                
                this.pegs.push(p);
                pegIndex++;
            }
        }

        if (this.round === 1 && !shouldInherit) {
            const replaceWithSpecial = (count, type) => {
                if (!count || count <= 0) return;
                const normalPegs = this.pegs.filter(p => p.type === 'normal');
                for (let i = normalPegs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [normalPegs[i], normalPegs[j]] = [normalPegs[j], normalPegs[i]];
                }
                for (let i = 0; i < Math.min(count, normalPegs.length); i++) {
                    normalPegs[i].type = type;
                    normalPegs[i].level = 1;
                }
            };
            replaceWithSpecial(CONFIG.gameplay.initWindPegs, 'wind');
            replaceWithSpecial(CONFIG.gameplay.initSwordPegs, 'flying_sword');
        }

        this.boardBottomY = maxPegY;
        const pinkCount = this.pinkPegCount;
        for (let i = 0; i < pinkCount; i++) {
            if (this.pegs.length > 0) {
                const idx = Math.floor(Math.random() * this.pegs.length);
                this.pegs[idx].type = 'pink';
            }
        }

        if (this.unlockedSlots.length > 0 && this.slotCount > 0) {
            const slotTypes = this.unlockedSlots;
            let attempts = 0;
            while (this.specialSlots.length < this.slotCount && attempts < 100) {
                attempts++;
                const r = Math.floor(Math.random() * rows);
                const isOddRow = r % 2 !== 0;
                const cols = isOddRow ? CONFIG.gameplay.cols - 1 : CONFIG.gameplay.cols;
                const c = Math.floor(Math.random() * cols);
                const pegIdx = this.pegs.findIndex(p => 
                    Math.abs(p.y - (offsetY + r * spacingY)) < 1 && 
                    Math.abs(p.x - (offsetX + (isOddRow ? spacingX / 2 : 0) + c * spacingX)) < 1
                );
                if (pegIdx !== -1 && this.pegs[pegIdx].type !== 'pink' && !this.specialSlots.some(s => s.pegIndex === pegIdx)) {
                    const type = slotTypes[Math.floor(Math.random() * slotTypes.length)];
                    this.specialSlots.push({ pegIndex: pegIdx, type: type });
                }
            }
        }
        this.ui_updateGatheringQueueUI();
        this.ui_renderRecipeHUD();
    }
    phase_gathering_getRandomPegType() { 
    // 定义所有可能的钉子类型（包含普通钉子）
    // const pegTypes = ['bounce', 'pierce', 'scatter', 'damage', 'cryo', 'pyro', 'lightning'];
    const pegTypes = ['bounce'];
    // 1. 获取 normal 的基础权重
    // 我们手动从 unlockedWeights 中取 white 作为普通钉子的权重基准（默认 100）
    const normalWeight = this.unlockedWeights['white'] || 100; 

    // 2. 计算当前所有“已解锁”类型的总权重
    let totalWeight = normalWeight;
    pegTypes.forEach(t => {
        totalWeight += (this.unlockedWeights[t] || 0);
    });
    
    // 3. 生成 0 到 totalWeight 之间的随机数
    let r = Math.random() * totalWeight;
    
    // 4. 区间判定：首先判定是否落在 normal 区间
    if (r < normalWeight) return 'normal';
    r -= normalWeight;
    
    // 5. 依次判定落在哪个特殊属性区间
    for (const t of pegTypes) {
        const w = this.unlockedWeights[t] || 0;
        if (w > 0) {
            if (r < w) return t; // 落在当前属性的权重区间内
            r -= w;
        }
    }
    
    return 'normal'; // 兜底返回
}


    /**
     * 开始战斗阶段
     */
    /**
     * @method startCombatPhase
     * @description 开始战斗阶段，初始化敌人和UI。
     */
    phase_startCombatPhase() { 
        console.log("进入战斗阶段...");
        this.isEnemyTurn = false;
        this.energyOrbs = [];
        this.sonSwordQueue = []; 
        this.sonSwordTimer = 0;
        this.phase_switchPhase('combat'); 
        this.phase = 'combat';
        // --- [核心修复 1]：修复属性访问错误 ---
        if (!this.ammoQueue) {
            this.ammoQueue = [];
        }

        // --- [核心修复 2]：UI 渲染 ---
        // 修复后，上面的代码不再报错，这一行将被正确执行，HUD 会在进入战斗时立即出现
        this.ui_updateUI();
        this.ui_renderRecipeHUD(); 

        this.sys_resetMultiplier(); 
        this.burstQueue = []; 
        this.pendingShots = [];
        
        // 初始化当前回合伤害记录
        this.shotDamageHistory = [];
        this.currentViewingRound = 0; 
        
        if (this.ui) {
            this.ui.updateSkillPoints(this.skillPoints);
            this.ui.updateSkillBar(this.skillPoints);
        }
    }
    /**
     * 清除所有弹丸和爆发队列
     */
    /**
     * @method clearProjectiles
     * @description 清除所有现存的投射物。
     */
    data_clearProjectiles() {
        this.sonSwords = [];
        this.projectiles = []; 
        this.burstQueue = []; 
        this.spores = []; // 換場時清理掉還在飛的孢子
        this.fireWaves = []; // 清理火焰波
    }
    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_createParticle.
     * @param {any} x - TODO: Describe this parameter.
     * @param {any} y - TODO: Describe this parameter.
     * @param {any} color - TODO: Describe this parameter.
     * @param {any} mode - TODO: Describe this parameter.
     */
    /**
     * [SPAWN] 创建一个粒子效果。
     * @param {number} x - 粒子的 x 坐标。
     * @param {number} y - 粒子的 y 坐标。
     * @param {string} color - 粒子的颜色。
     * @param {string} [mode='normal'] - 粒子的行为模式 (e.g., 'normal', 'confetti')。
     */
    spawn_createParticle(x, y, color, mode = 'normal') {
        // [优化] 限制粒子总数，防止高频触发（如火焰）导致卡顿
        const MAX_PARTICLES = 800; // 粒子上限翻倍 (原 400)
        const EMBER_LIMIT = 150; // 针对性能开销大的火焰粒子设置更严格的限制
        
        if (this.particles.length > MAX_PARTICLES) return null;
        
        if (mode === 'ember') {
            const currentEmbers = this.particles.filter(p => p.mode === 'ember').length;
            if (currentEmbers > EMBER_LIMIT) return null;
        }

        const p = new Particle(x, y, color, mode);
        this.particles.push(p);
        return p;
    }
    /**
     * 获取当前的视觉偏移量
     */
        /**
     * @method getTiltOffset
     * @description 获取当前的视觉偏移量 (用于修正鼠标点击坐标)
     */
    input_getTiltOffset() {
        if (this.phase === 'combat') {
            const tilt = this.boardTilt.current;
            // [修正]：这里必须与 updateCombat 中"实体层"的系数 (-25, -20) 保持一致
            // 这样点击才会准确落在视觉上偏移了的敌人身上
            return new Vec2(tilt.x * -25, tilt.y * -20); 
        }
        return new Vec2(0, 0);
    }

        /**
     * @method handleInputStart
     * @description 处理输入开始 (鼠标按下/触摸开始) - [修改版：直射模式]
     */
    phase_handleInputStart(pos) {
        audio.resume();
        const offset = this.input_getTiltOffset();
        const logicPos = pos.sub(offset); 
        
        this.lastMousePos = logicPos;

        // 处理 gameOver 状态的点击返回主界面
        if (this.gameOver) {
            this.phase_switchPhase('meta');
            // 注意：这里不再调用 sys_resetGame，因为重置逻辑应该在点击“开始炼成”时触发
            // 这样可以确保返回的是首页，而不是直接进入下一局
            return;
        }

        if (this.phase === 'combat') {
             const hitEnemy = this.input_checkEnemyHover(pos);
             if (hitEnemy) return; 
             if (this.ui.isOpen) {
                 this.ui.closeDrawer();
                 return;
             }
             if (this.ammoQueue.length > 0 && this.projectiles.length === 0 && this.burstQueue.length === 0) {
                this.isDragging = true; 
                this.dragStart = new Vec2(this.width / 2, this.height - 80); 
                this.dragCurrent = logicPos; 
                this.ui.closeDrawer();
            }
        }
        else if (this.phase === 'gathering') {
            if (this.isWheelSpinning) {
                showToast("請等待輪盤結算...");
                return;
            }
            if (this.dropBalls.length > 0 || this.energyOrbs.length > 0) {
                console.log('[DEBUG] 充能中 - dropBalls:', this.dropBalls.length, 'energyOrbs:', this.energyOrbs.length, 'activeBalls:', this.currentSession?.activeBalls);
                showToast("充能中...");
                return;
            }
            
            // ---  判断点击区域 ---
            if (pos.y < this.height * 0.4) {
                // 上方区域：发射弹珠
                if (this.activeMarbleIndex >= this.marbleQueue.length) return;
                const marbleDef = this.marbleQueue[this.activeMarbleIndex];
                
                // 使用之前修复过的持久化阈值逻辑
                this.currentSession = {
                    collected: [], multicast: 0, activeBalls: 1, currentHits: 0,
                    nextTriggerThreshold: this.persistentThreshold, // 确保这里用了 persistentThreshold
                    totalHits: 0, multicastAdded: [], isFinished: false
                };
                if (marbleDef.type === 'laser') {
                    this.currentSession.collected.push('laser');
                } else if (marbleDef.type === 'colored' && marbleDef.type) {
                    this.currentSession.collected.push(marbleDef.type);
                }
                this.combat_updateHitProgress(0, this.persistentThreshold);
                this.dropBalls.push(new DropBall(pos.x, 30, marbleDef, this.currentSession));
                this.ui_updateGatheringQueueUI();
                audio.playShoot();
                this.combat_updateMulticastDisplay(0);
            } else {
                // ---  下方区域：进入“抓取倾斜”模式，暂不报错 ---
                this.isTiltingGrip = true;
                this.gripStartPos = pos;
                // 这里不显示 toast，等到松开时如果没动才显示
            }
        } 
    }
    //  检测是否有敌人被悬浮/点击
    /**
     * [AUTO-GENERATED] TODO: Add a description for input_checkEnemyHover.
     * @param {any} pos - TODO: Describe this parameter.
     */
    input_checkEnemyHover(pos) {
        // 只有战斗阶段且非敌人回合才允许查看
        if (this.phase !== 'combat' || this.isEnemyTurn) return null;

        let hit = null;
        // 逆序遍历，优先检测上层(视觉上)的敌人
        for(let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.active) continue;
            
            // 简单的矩形碰撞检测
            const halfW = e.width / 2;
            const halfH = e.height / 2;
            if (pos.x >= e.pos.x - halfW && pos.x <= e.pos.x + halfW &&
                pos.y >= e.pos.y - halfH && pos.y <= e.pos.y + halfH) {
                hit = e;
                break;
            }
        }

        if (hit) {
            this.ui.showEnemyInfo(hit);
            // 给敌人加一个高亮框 (可选，复用你之前的 scanFeedbackTimer)
            // hit.scanFeedbackTimer = 0.5; // 微微闪亮
        } else {
            // 如果是在PC端鼠标移动，移开即关闭；移动端需要手动点关闭按钮或点空地
            // 为了体验统一，这里设定：如果正在Hover别的，就切过去；如果移到空地，暂时不自动关闭(防止误触)，
            // 或者：移到空地就关闭。这里采用“移到空地不自动关闭，依靠点击关闭或拖拽关闭”，体验较稳。
            // 但如果想要鼠标移开就消失：
            // this.ui.closeDrawer(); 
        }
        return hit;
    }
    /**
     * @method handleInputEnd
     * @description 处理输入结束 (松手发射) - [修改版：直射模式]
     */
    // --- Game 类 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for input_handleInputEnd.
     */
    input_handleInputEnd() {

    if (this.isDragging) {
        // ... (战斗发射逻辑保持不变) ...
        this.isDragging = false;
        const cannonPos = new Vec2(this.width / 2, this.height - 80);
        const targetPos = this.lastMousePos;
        const aimVector = targetPos.sub(cannonPos);
        if (aimVector.y < -20) { 
            this.sys_resetMultiplier();
            // 保存计算好的力度，开启 flag
            this.pendingFireVelocity = aimVector.norm().mult(12);
            this.isChargingShot = true;
            this.chargeProgress = 0;
            
            // 给 UI 一个初始反馈（可选，比如让轨道瞬间亮一下）
            audio.playTone(800, 'sine', 0.1, 0.1); // 可选：吸收开始的音效
            // this.combat_fireNextShot(aimVector.norm().mult(12)); 
        }
    }
    
    // ---  收集阶段抓取结束逻辑 ---
    if (this.isTiltingGrip) {
        // 计算由于抓取产生的位移距离
        const dist = this.lastMousePos.dist(this.gripStartPos);
        
        // 如果移动距离很短 (< 10px)，说明是一次点击，而不是拖拽
        if (dist < 10) {
            showToast("請在上方區域點擊");
        }
        
        // 结束抓取
        this.isTiltingGrip = false;
        
        // 可选：松手后让板子回正
        if (!this.boardTilt.enabled) {
            this.boardTilt.target = {x: 0, y: 0};
        }
    }
}

    /**
     * 处理输入移动 (鼠标移动/触摸移动)
     * @param {Vec2} pos - **重要参数** 当前输入位置
     * @param {Event} e - 事件对象
     */
    /**
     * @method handleInputMove
     * @description 处理输入移动 (鼠标移动/触摸移动)。
     * @param {Vec2} pos - **重要参数** 当前输入位置。
     * @param {Event} e - 事件对象。
     */

    /**
     * [AUTO-GENERATED] TODO: Add a description for input_handleInputMove.
     * @param {any} pos - TODO: Describe this parameter.
     * @param {any} e - TODO: Describe this parameter.
     */
    input_handleInputMove(pos, e) {
        const offset = this.input_getTiltOffset();
        const logicPos = pos.sub(offset);
        this.lastMousePos = logicPos;
        
        // 战斗拖拽瞄准
        if (this.isDragging) { 
            this.dragCurrent = logicPos; 
            e.preventDefault(); 
            return;
        } 
        
        //  收集阶段 - 手动拖拽倾斜
        if (this.phase === 'gathering' && this.isTiltingGrip && !this.boardTilt.enabled) {
            e.preventDefault();
            // 计算拖拽偏移量，模拟倾斜
            const deltaX = pos.x - this.gripStartPos.x;
            const deltaY = pos.y - this.gripStartPos.y;
            
            // 灵敏度系数
            const sensitivity = 0.005; 
            
            // 将偏移量叠加到目标倾斜值上
            this.boardTilt.target.x = Math.max(-1, Math.min(1, deltaX * sensitivity));
            this.boardTilt.target.y = Math.max(-1, Math.min(1, deltaY * sensitivity));
            return;
        }

        // [保留] 收集阶段 - 鼠标悬停倾斜 (PC端体验优化)
        // 如果没有在抓取，且没有陀螺仪，鼠标位置也会产生轻微倾斜
        if ((this.phase === 'gathering' || this.phase === 'combat') && !this.isTiltingGrip && !this.boardTilt.enabled) {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            // 悬停的幅度要小一点，防止太晕
            this.boardTilt.target.x = ((pos.x - centerX) / centerX) * 0.3;
            this.boardTilt.target.y = ((pos.y - centerY) / centerY) * 0.3;
        }

        // 战斗阶段悬浮检测
        if (this.phase === 'combat' && !this.ui.isOpen) {
             this.input_checkEnemyHover(logicPos);
        }
    }
    
    /**
     * @method triggerLightningChain
     * @description 触发连锁闪电效果 (修复单体报错版)
     * @returns {boolean} 是否成功触发了闪电链
     */
    combat_lightning_triggerChain(sourceEnemy, dmg, history, level = 1) {
        // [修复1] 安全检查
        if (!sourceEnemy || !sourceEnemy.pos) return false;

        // [修复2] 容错处理
        history = history || [];

        // 查找范围内的所有有效敌人 (取消 !history.includes(e) 限制，允许重复命中)
        const RANGE = 150;
        let targets = this.enemies.filter(e => 
            e.active &&             
            e !== sourceEnemy &&
            sourceEnemy.pos.dist(e.pos) < RANGE
        ); 

        // 如果没有有效目标
        if (targets.length === 0) return false;

        // --- 核心逻辑：距离越近概率越高，且降低跳回来源的概率 ---
        // 获取上一个来源敌人 (history 的最后一个元素)
        const lastSource = history.length > 0 ? history[history.length - 1] : null;

        let totalWeight = 0;
        const weightedTargets = targets.map(t => {
            const dist = sourceEnemy.pos.dist(t.pos);
            let weight = 1 / (Math.pow(dist, 2) + 1); // 基础权重：距离平方反比
            
            // [优化] 如果目标是上一个来源敌人，权重减半，防止来回跳
            if (lastSource && t === lastSource) {
                weight *= 0.5;
            }
            
            totalWeight += weight;
            return { target: t, weight: weight, dist: dist };
        });

        // 随机选择一个目标
        let randomValue = Math.random() * totalWeight;
        let selected = null;
        for (const wt of weightedTargets) {
            randomValue -= wt.weight;
            if (randomValue <= 0) {
                selected = wt.target;
                break;
            }
        }
        if (!selected) selected = targets[0];

        // 判定连锁概率
        let p = 0.15; // 基础连锁概率
        if (selected.temp < 0) p = Math.min(1.0, 0.15 + Math.abs(selected.temp) * 0.0085); 
        
        if (Math.random() < p) { 
            // [优化] 增加基础延迟，放慢连锁节奏，提升视觉快感
            const chainCount = history.length;
            // 基础延迟从 150ms 增加到 250ms，且减速曲线更平缓
            const delay = Math.max(50, 250 - chainCount * 15); 

            setTimeout(() => {
                if (!selected.active) return;

                // 视觉效果：闪电链
                this.lightningBolts.push(new LightningBolt(sourceEnemy.pos.x, sourceEnemy.pos.y, selected.pos.x, selected.pos.y)); 
                audio.playLightning(); 
                
                for(let i=0; i<5; i++) {
                    this.spawn_createParticle(selected.pos.x, selected.pos.y, '#c084fc', 'spark');
                }
                
                // 计算下一次伤害
                const decayFactor = 0.45 + (0.05 * level);
                const nextDmg = Math.max(1, Math.floor(dmg * decayFactor));

                // 伤害与状态：提升温度 (公式：闪电层数 + 连锁次数/3)
                const chainCount = history.length;
                selected.applyTemp(level + chainCount / 3); 
                
                const result = selected.takeDamage(dmg); 
                this.combat_recordDamage(result.actualDamage, 'lightning', 'main', this._currentDamageShotId); 
                
                if(result.killed) this.spawn_addScore(selected.maxHp);
                
                // 递归
                history.push(selected); 
                // 限制最大连锁次数防止死循环 (增加到 100 次)
                if (history.length < 100) {
                    this.combat_lightning_triggerChain(selected, nextDmg, history, level); 
                }
            }, delay);
            
            return true;
        } 
        return false;
    }
    /**
    /**
     * @method fireNextShot
     * @description 发射下一发弹丸 (处理多重射击)。
     * @param {Vec2} vel - **重要参数** 初始速度向量。
     */
    combat_fireNextShot(vel) {
        if (this.ammoQueue.length === 0) return;

        // [修复] 递归提取套娃配方，并确保使用深拷贝防止后续逻辑修改原始配方
        const pullNext = () => {
            if (this.ammoQueue.length === 0) return null;
            let r = this.ammoQueue.shift();
            // 深拷贝配方对象，防止引用污染
            const recipeCopy = JSON.parse(JSON.stringify(r));
            if (recipeCopy.isMatryoshka) {
                const nextR = pullNext();
                if (nextR) recipeCopy.nestedPayload = nextR;
            }
            return recipeCopy;
        };
        const finalRecipe = pullNext();
        if (!finalRecipe) return;
        
        // --- 新增：触发UI动画 ---
        const currentSlot = document.getElementById('current-ammo-render');
        if (currentSlot) {
            // 1. 播放飞出动画
            currentSlot.classList.add('shoot-anim');
            
            // 2. 延迟更新 UI (等待动画播放一部分，制造视觉连贯性)
            // 实际子弹已经生成，但UI滞后一点点更新，让玩家看到"发射"的过程
            setTimeout(() => {
                this.ui_updateAmmoUI();
                
                // 3. 为新上膛的子弹添加"滑入"动画
                const newCurrent = document.getElementById('current-ammo-render');
                if (newCurrent) {
                    newCurrent.classList.add('slide-in-anim');
                    setTimeout(() => newCurrent.classList.remove('slide-in-anim'), 400);
                }
            }, 150); 
        } else {
            this.ui_updateAmmoUI();
        }
        
        this.ui_renderRecipeHUD(); 
        
        // [修复] 为这次发射创建独立的shotId
        const shotId = this.shotIdCounter++;
        this.shotDamageMap.set(shotId, { total: 0, byAttr: {}, projectileCount: 0, destroyedCount: 0 });
        
        // 基础射击
        // 如果没有多重射击，那么这第一发就是最后一发
        // [修改] 风属性子弹也强制单发，不受 multicast 影响
        const isOnlyOne = !(finalRecipe.multicast > 0 && finalRecipe.type != 'flying_sword' && !finalRecipe.wind);
        this.burstQueue.push({ delay: 0, vel: vel, recipe: finalRecipe, shotId: shotId, isLast: isOnlyOne }); 
        
        // 多重射击
        if (finalRecipe.multicast > 0 && finalRecipe.type != 'flying_sword' && !finalRecipe.wind) {
            for(let i=1; i<=finalRecipe.multicast; i++) { 
                const isLastInBurst = (i === finalRecipe.multicast);
                this.burstQueue.push({ delay: i * 20, vel: vel, recipe: finalRecipe, shotId: shotId, isLast: isLastInBurst }); 
            } 
        } 
    }
    /**
    /**
     * @method spawnBullet
     * @description 生成弹丸 (处理散射)。
     * @param {number} x - **重要参数** 初始位置 X。
     * @param {number} y - **重要参数** 初始位置 Y。
     * @param {Vec2} vel - **重要参数** 初始速度向量。
     * @param {object} recipe - **重要参数** 弹药配方。
     * @param {number} shotId - 发射ID，用于统计伤害
     */
    spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false) {
        if (!shotId) shotId = Date.now() + Math.random();

        // 初始化伤害统计结构 (支持二维统计: 伤害类型 -> 来源类型)
        if (!this.shotDamageMap.has(shotId)) {
            this.shotDamageMap.set(shotId, { 
                total: 0, 
                projectileCount: 0, 
                destroyedCount: 0, 
                // 修改：byAttr 存储为二维对象 { 'pyro': { 'main': 0, 'scatter': 0 }, ... }
                byAttr: {} 
            });
            
            // 绑定到当前 Game 实例的临时变量，供 UI 实时显示
            this.currentShotDamage = 0;
            this.currentShotDamageByAttr = {}; 
        }
        
        const shotStats = this.shotDamageMap.get(shotId);

        // [关键] 属性优先级：飞剑 > 激光
        // 如果是飞剑，优先处理飞剑逻辑
        if (recipe.type === 'flying_sword') {
            // 1. 生成【唯一的母劍】 (Mother Sword)
            // 母劍強制只有一把，不受 scatter/multicast 影響而分裂
            const motherSword = new Projectile(x, y, vel, recipe, false, shotId, isLast);
            this.projectiles.push(motherSword);

            // 2. 處理散射 -> 生成【初始護衛子劍】
            // 規則：散射數 = 初始攜帶的子劍數
            const initialSonCount = recipe.scatter || 0;
            const pegLevel = recipe.level || 1;

            for (let i = 0; i < initialSonCount; i++) {
                this.sonSwordQueue.push({
                    mother: motherSword,
                    level: pegLevel,
                    config: recipe,
                    // 初始位置稍微随机一点，避免重叠
                    x: x + (Math.random() - 0.5) * 20,
                    y: y + (Math.random() - 0.5) * 20
                });
            }

            // 3. 處理光球效果 -> 劍氣
            if (recipe.lightOrb || recipe.laser > 0) {
                // 假設 laser 屬性代表光球/劍氣等級
                // 這裡可以複用你的 SwordQi 邏輯
                if (typeof SwordQi !== 'undefined') {
                    this.swordQis = this.swordQis || [];
                    this.swordQis.push(new SwordQi(x, y, vel, 30));
                    audio.playEffect('split');
                }
            }

            return; // <--- 飛劍邏輯結束，直接返回
        }

        // 如果是激光且不是风属性，发射光束后直接 return，不生成 Projectile
        // [修改] 优先级：风属性 > 激光。如果同时拥有，则发射风属性实体子弹。
        if (recipe.isLaser && !recipe.wind) {
            this.combat_laser_fire(x, y, vel, recipe, shotId);
            
            // 处理散射激光 (如果激光带有散射属性，比如吃了黄色钉子)
            if (recipe.scatter > 0) {
                const scatterCount = recipe.scatter;
                const fullInheritCount = Math.floor(scatterCount / 2);
                const halfInheritCount = scatterCount % 2;
                
                let currentScatterIdx = 1;
                // 生成 100% 继承的副子弹
                for (let i = 0; i < fullInheritCount; i++) {
                    const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                    const multiplier = Math.ceil(currentScatterIdx / 2);
                    const angleOffset = 0.2 * multiplier * sign;
                    const newVel = vel.rotate(angleOffset);
                    const copyRecipe = { ...recipe, scatter: 0 };
                    this.combat_laser_fire(x, y, newVel, copyRecipe, shotId);
                    currentScatterIdx++;
                }
                // 生成 50% 继承的副子弹
                for (let i = 0; i < halfInheritCount; i++) {
                    const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                    const multiplier = Math.ceil(currentScatterIdx / 2);
                    const angleOffset = 0.2 * multiplier * sign;
                    const newVel = vel.rotate(angleOffset);
                    const copyRecipe = { ...recipe, scatter: 0, damage: Math.max(1, Math.floor(recipe.damage * 0.5)) };
                    this.combat_laser_fire(x, y, newVel, copyRecipe, shotId);
                    currentScatterIdx++;
                }
            }
            return; 
        }

        // 散射 (Scatter)
        // [修改] 风属性子弹强制单发，不受 scatter 影响
        if (recipe.scatter > 0 && !recipe.wind) { 
            const scatterCount = recipe.scatter;
            const fullInheritCount = Math.floor(scatterCount / 2);
            const halfInheritCount = scatterCount % 2;
            
            let currentScatterIdx = 1;
            // 生成 100% 继承的副子弹
            for (let i = 0; i < fullInheritCount; i++) {
                const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                const multiplier = Math.ceil(currentScatterIdx / 2);
                const angleOffset = 0.2 * multiplier * sign;
                const newVel = vel.rotate(angleOffset);
                const copyRecipe = { ...recipe, scatter: 0, chainPayload: null, isScatterChild: true };
                this.projectiles.push(new Projectile(x, y, newVel, copyRecipe, true, shotId));
                shotStats.projectileCount++;
                currentScatterIdx++;
            }
            // 生成 50% 继承的副子弹
            for (let i = 0; i < halfInheritCount; i++) {
                const sign = currentScatterIdx % 2 === 0 ? -1 : 1;
                const multiplier = Math.ceil(currentScatterIdx / 2);
                const angleOffset = 0.2 * multiplier * sign;
                const newVel = vel.rotate(angleOffset);
                const copyRecipe = { ...recipe, scatter: 0, chainPayload: null, damage: Math.max(1, Math.floor(recipe.damage * 0.5)), isScatterChild: true };
                this.projectiles.push(new Projectile(x, y, newVel, copyRecipe, true, shotId));
                shotStats.projectileCount++;
                currentScatterIdx++;
            }
        }
        
        // [关键] 生成主子弹
        shotStats.projectileCount++;
        const mainRecipe = { ...recipe, isScatterChild: false };
        this.projectiles.push(new Projectile(x, y, vel, mainRecipe, false, shotId, isLast)); 
    }

// 在 Game 类中更新此方法
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_fireLaser.
     * @param {any} startX - TODO: Describe this parameter.
     * @param {any} startY - TODO: Describe this parameter.
     * @param {any} vel - TODO: Describe this parameter.
     * @param {any} recipe - TODO: Describe this parameter.
     */
    combat_laser_fire(startX, startY, vel, recipe, shotId = null) {
        // [新增] 保存shotId供伤害记录使用
        this._currentDamageShotId = shotId;
        
        // [新增] 激光统计处理：激光是即时的，手动增加计数并在完成后减少
        if (shotId !== null && this.shotDamageMap.has(shotId)) {
            this.shotDamageMap.get(shotId).projectileCount++;
        }
        
        // --- 1. 参数计算 ---
        this.isVisualEffectActive = true;
        // [射程] 基础 500 * 1.35 + 每层穿透 250 (决定光线能跑多远)
        let maxLen = (500 * 1.35) + (recipe.pierce * 250) + (CONFIG.gameplay.laserLengthBonus || 0); 
        
        // [粗细] 基础 3px + 每层激光 4px + 爆破加成 (决定光线视觉宽度)
        let width = 3 + (recipe.laser * 4) + (recipe.explosive ? 10 : 0);
        
        // [反弹] 直接读取配方中的 bounce 值 (决定折射次数)
        let bounces = recipe.bounce; 

        // [颜色] 优先级：爆破 > 元素 > 默认蓝
        let color = '#0ea5e9'; 
        if (recipe.pyro > 0) color = '#f97316';
        else if (recipe.cryo > 0) color = '#06b6d4';
        else if (recipe.lightning > 0) color = '#d8b4fe';
        else if (recipe.explosive) color = '#ef4444';

        // --- 2. 射线检测 (Raycasting Logic) ---
        let points = [new Vec2(startX, startY)]; 
        let currPos = new Vec2(startX, startY);
        let currDir = vel.norm(); 
        let remainLen = maxLen;
        
        // 循环条件：只要还有剩余长度 (remainLen > 0) 就继续
        // 内部会判断是否撞墙/次数耗尽来 break
        while (remainLen > 0) {
            // A. 寻找最近的反射面 (墙壁 或 护盾敌人)
            let hitResult = this.combat_laser_castRay(currPos, currDir, remainLen);
            
            // B. 结算这一段路径 (移动光标)
            let segmentLen = hitResult.dist;
            let nextPos = currPos.add(currDir.mult(segmentLen));
            
            // C. 伤害路径上的普通敌人 (穿透所有)
            this.combat_laser_processPenetration(currPos, nextPos, recipe);

            // 记录路径点用于绘制
            points.push(nextPos);
            
            // 扣除长度
            remainLen -= segmentLen;
            currPos = nextPos;

            // D. 处理撞击结果
            if (hitResult.hitType === 'none') {
                // 没撞到任何反射面，光线在空气中耗尽长度，结束
                break; 
            } else {
                // 撞到了反射面！检查是否有剩余反弹次数
                if (bounces <= 0) {
                    // 次数耗尽，光线在这里终止 (虽有长度但无法折射)
                    // 可以在末端加个小火花表示能量耗尽
                    this.spawn_createParticle(nextPos.x, nextPos.y, color, 'spark');
                    break;
                }

                // 消耗一次反弹次数
                bounces--;
                
                // 触发撞击反馈
                if (hitResult.hitType === 'wall') {
                    audio.playHit('bounce');
                    this.spawn_createParticle(nextPos.x, nextPos.y, color, 'spark');
                } else if (hitResult.hitType === 'shield') {
                    // 击中护盾敌人
                    this.combat_damageEnemy(hitResult.enemy, { config: recipe, pos: nextPos, isCopy: false }); 
                    audio.playHit('bounce'); // 听起来像打铁
                    this.spawn_createParticle(nextPos.x, nextPos.y, '#3b82f6', 'spark');
                }

                // 计算反射向量 (镜面反射)
                if (hitResult.normal === 'x') currDir.x *= -1;
                else currDir.y *= -1;
            }
        }

        // --- 3. 生成视觉与音效 ---
        this.particles.push(new LaserBeam(points, width, color));
        
        // 音效：越粗越低沉
        audio.playTone(Math.max(100, 800 - width * 20), 'sawtooth', 0.15, 0.2 + width * 0.01);
        setTimeout(() => {
            this.isVisualEffectActive = false;
        }, 600); 
        
        // [新增] 激光发射完成，增加销毁计数以触发统计保存
        if (shotId !== null && this.shotDamageMap.has(shotId)) {
            const shotStats = this.shotDamageMap.get(shotId);
            shotStats.destroyedCount++;
            // 检查是否所有子弹都已销毁
            if (shotStats.destroyedCount >= shotStats.projectileCount && shotStats.total > 0) {
                this.shotDamageHistory.push({
                    total: shotStats.total,
                    byAttr: JSON.parse(JSON.stringify(shotStats.byAttr))
                });
                if (this.shotDamageHistory.length > 10) this.shotDamageHistory.shift();
                this.ui_updateDamageStats();
                this.shotDamageMap.delete(shotId);
            }
        }
    }

    // 辅助：寻找最近的反射面（墙壁或带盾敌人）
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_castRayToReflectors.
     * @param {any} start - TODO: Describe this parameter.
     * @param {any} dir - TODO: Describe this parameter.
     * @param {any} maxDist - TODO: Describe this parameter.
     */
    combat_laser_castRay(start, dir, maxDist) {
        let closest = { dist: maxDist, hitType: 'none', normal: null, enemy: null };

        // 1. 检测墙壁
        // 左墙 (x=radius)
        if (dir.x < 0) {
            let d = (CONFIG.physics.bulletRadius - start.x) / dir.x;
            if (d > 0 && d < closest.dist) closest = { dist: d, hitType: 'wall', normal: 'x' };
        }
        // 右墙 (x=width-radius)
        if (dir.x > 0) {
            let d = (this.width - CONFIG.physics.bulletRadius - start.x) / dir.x;
            if (d > 0 && d < closest.dist) closest = { dist: d, hitType: 'wall', normal: 'x' };
        }
        // 顶墙 (y=radius)
        if (dir.y < 0) {
            let d = (CONFIG.physics.bulletRadius - start.y) / dir.y;
            if (d > 0 && d < closest.dist) closest = { dist: d, hitType: 'wall', normal: 'y' };
        }
        // 底墙 (y=height-radius) - 只有在有 CombatWall 遗物时才反弹
        if (this.hasCombatWall && dir.y > 0) {
            let d = (this.height - CONFIG.physics.bulletRadius - start.y) / dir.y;
            if (d > 0 && d < closest.dist) closest = { dist: d, hitType: 'wall', normal: 'y' };
        }

        // 2. 检测带盾敌人 (视为反射面)
        this.enemies.forEach(e => {
            if (!e.active || !e.affixes.includes('shield')) return;
            
            // 简单的 AABB 射线检测
            // 扩展一下边界作为碰撞箱
            const halfW = e.width / 2 + 5;
            const halfH = e.height / 2 + 5;
            
            // 为了简化，我们把敌人看作一个圆或者简单的矩形
            // 这里使用简化的矩形求交 (Slab method 的简化版)
            // 实际上，为了游戏手感，我们可以遍历所有敌人的边界线
            // 但最简单的方法是：检测射线是否穿过敌人中心附近
            
            // 使用线段与矩形相交检测
            const t = this.calc_getLineRectIntersection(start, dir, e.pos.x - halfW, e.pos.y - halfH, e.width, e.height);
            if (t !== null && t > 0 && t < closest.dist) {
                // 确定法线 (简化：看击中点的相对位置)
                const hitX = start.x + dir.x * t;
                const hitY = start.y + dir.y * t;
                const dx = Math.abs(hitX - e.pos.x);
                const dy = Math.abs(hitY - e.pos.y);
                // 如果 x 偏差比 y 偏差大，说明撞的是左右侧 (Normal X)，否则是上下侧
                // 需归一化比较 (宽高比)
                const nx = dx / halfW;
                const ny = dy / halfH;
                
                closest = { 
                    dist: t, 
                    hitType: 'shield', 
                    normal: nx > ny ? 'x' : 'y',
                    enemy: e 
                };
            }
        });

        return closest;
    }

    // 辅助：处理线段上的普通穿透
    /**
     * [AUTO-GENERATED] TODO: Add a description for combat_processLaserPenetration.
     * @param {any} p1 - TODO: Describe this parameter.
     * @param {any} p2 - TODO: Describe this parameter.
     * @param {any} recipe - TODO: Describe this parameter.
     */
    combat_laser_processPenetration(p1, p2, recipe) {
        const laserVisualWidth = 3 + (recipe.laser * 4) + (recipe.explosive ? 10 : 0);
    const laserLogicRadius = laserVisualWidth / 2;
        // 构建线段包围盒用于快速剔除
        const minX = Math.min(p1.x, p2.x) - 20;
        const maxX = Math.max(p1.x, p2.x) + 20;
        const minY = Math.min(p1.y, p2.y) - 20;
        const maxY = Math.max(p1.y, p2.y) + 20;

        this.enemies.forEach(e => {
            if (!e.active) return;
            // 如果是护盾怪，之前在反射逻辑里已经处理过了，这里跳过？
            // 不，反射逻辑只处理了“最近”的一个。
            // 激光原理是：它会穿透所有普通怪，直到遇到反射面。
            // 所以这里要排除掉那个充当反射面的护盾怪（如果这束光正好终结于它）。
            // 简单处理：全部检测一遍，伤害频率不高。
            
            if (e.pos.x < minX || e.pos.x > maxX || e.pos.y < minY || e.pos.y > maxY) return;

            // 点到线段距离公式
            const l2 = p1.dist(p2) * p1.dist(p2);
            if (l2 == 0) return;
            let t = ((e.pos.x - p1.x) * (p2.x - p1.x) + (e.pos.y - p1.y) * (p2.y - p1.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = p1.x + t * (p2.x - p1.x);
            const projY = p1.y + t * (p2.y - p1.y);
            const dist = Math.sqrt(Math.pow(e.pos.x - projX, 2) + Math.pow(e.pos.y - projY, 2));

            // 判定半径：敌人半径 + 激光粗细
            const enemyRadius = Math.min(e.width, e.height) / 2;
            const totalHitRadius = enemyRadius + laserLogicRadius;
            if (dist < totalHitRadius) {
                // 造成伤害
                // 为了避免多重判定问题，我们可以在这里直接伤害
                // 伪造一个 projectile 对象传给 damageEnemy
                this.combat_damageEnemy(e, { config: recipe, pos: new Vec2(projX, projY), isCopy: false });
                
                // 视觉：受击点特效
                if (Math.random() < 0.3) this.spawn_createParticle(projX, projY, '#fff', 'spark');
            }
        });
    }

    // 辅助：射线与矩形相交 (Slab Method) 返回距离 t
    /**
     * [AUTO-GENERATED] TODO: Add a description for calc_getLineRectIntersection.
     * @param {any} start - TODO: Describe this parameter.
     * @param {any} dir - TODO: Describe this parameter.
     * @param {any} rx - TODO: Describe this parameter.
     * @param {any} ry - TODO: Describe this parameter.
     * @param {any} rw - TODO: Describe this parameter.
     * @param {any} rh - TODO: Describe this parameter.
     */
    calc_getLineRectIntersection(start, dir, rx, ry, rw, rh) {
        let tmin = -Infinity;
        let tmax = Infinity;

        if (dir.x !== 0) {
            let tx1 = (rx - start.x) / dir.x;
            let tx2 = (rx + rw - start.x) / dir.x;
            tmin = Math.max(tmin, Math.min(tx1, tx2));
            tmax = Math.min(tmax, Math.max(tx1, tx2));
        } else if (start.x < rx || start.x > rx + rw) {
            return null;
        }

        if (dir.y !== 0) {
            let ty1 = (ry - start.y) / dir.y;
            let ty2 = (ry + rh - start.y) / dir.y;
            tmin = Math.max(tmin, Math.min(ty1, ty2));
            tmax = Math.min(tmax, Math.max(ty1, ty2));
        } else if (start.y < ry || start.y > ry + rh) {
            return null;
        }

        if (tmax >= tmin && tmin >= 0) return tmin;
        return null;
    }
    /**
     * @method createExplosion
     * @description 创建爆炸特效 (粒子群)。
     * @param {number} x - **重要参数** 位置 X。
     * @param {number} y - **重要参数** 位置 Y。
     * @param {string} color - 颜色。
     */
    spawn_createExplosion(x, y, color) { 
        for(let i=0; i<10; i++) { 
            this.particles.push(new Particle(x, y, color || '#f87171')); 
        } 
    }

    /**
     * @method createShockwave
     * @description 创建冲击波特效。
     * @param {number} x - **重要参数** 位置 X。
     * @param {number} y - **重要参数** 位置 Y。
     */
    spawn_createShockwave(x, y, color = null) { 
        this.shockwaves.push(new Shockwave(x, y, color)); 
    }

    /**
     * [AUTO-GENERATED] TODO: Add a description for ui_updateUICache.
     */
    ui_updateUICache() {
        const gaugeEl = document.getElementById('hero-gauge-container');
        if (gaugeEl) {
            const rect = gaugeEl.getBoundingClientRect();
            // 缓存中心坐标
            this.uiCache = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                // 缓存 DOM 引用，避免重复查询
                el: gaugeEl,
                pulseLayer: document.getElementById('gauge-pulse-layer'),
                gaugeShell: document.getElementById('gauge-shell')
            };
        } else {
            // 兜底坐标
            this.uiCache = { x: this.width / 2, y: this.height - 100, el: null };
        }
    }
    // ---  createHitFeedback ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_createHitFeedback.
     * @param {any} x - TODO: Describe this parameter.
     * @param {any} y - TODO: Describe this parameter.
     * @param {any} velocity - TODO: Describe this parameter.
     * @param {any} type - TODO: Describe this parameter.
     */
    spawn_createHitFeedback(x, y, velocity, type = 'normal') {
        // 1. 获取目标坐标
        if (!this.uiCache) this.ui_updateUICache();
        
        let targetX = this.uiCache.x;
        let targetY = this.uiCache.y;

        // [核心修复]：兜底检测
        // 如果缓存坐标是 0 (说明上次获取时 UI 可能被隐藏了)，强制重算
        if (targetX === 0 && targetY === 0) {
            this.ui_updateUICache();
            targetX = this.uiCache.x;
            targetY = this.uiCache.y;
            
            // 如果还是 0 (极罕见)，就手动指定一个大概位置 (屏幕中下方)
            if (targetX === 0) {
                targetX = this.width / 2;
                targetY = this.height - 100;
            }
        }

        // --- 以下保持之前的优化逻辑不变 ---
        
        let color = '#fbbf24'; 
        if (type === 'cryo') {
            color = CONFIG.colors.cryo;
        } else if (type == 'pyro') {
            color = CONFIG.colors.pyro;
        } else if (type == 'lightning') {
            color = CONFIG.colors.lightning;
        } else if (type == 'bounce') {
            color = CONFIG.colors.bounce;
        } else if (type == 'resonance') {
            color = CONFIG.colors.resonanceRipple;

        } else if (type == 'damage') {
            color = CONFIG.colors.damage;
        } 
        const initVel = velocity ? velocity : new Vec2((Math.random()-0.5)*5, -5);

        this.energyOrbs.push(new EnergyOrb(x, y, targetX, targetY, color, initVel, () => {
            if(this.currentSession) { 
                this.currentSession.currentHits++;
                this.currentSession.totalHits++; 
                
                // [META] 获得货币
                this.runCurrency += 1;
                this.meta_addCurrency(1);
                this.ui_playResourceFlyEffect(targetX, targetY, 1);
                
                // 音效
                const progress = Math.min(1, this.currentSession.currentHits / this.currentSession.nextTriggerThreshold);
                if (this.currentSession.currentHits < this.currentSession.nextTriggerThreshold) {
                    if (Math.random() < 0.5) audio.playTone(500 * (1.0 + progress * 0.5), 'triangle', 0.05, 0.2); 
                }

                // 更新 UI
                this.combat_updateHitProgress(this.currentSession.currentHits, this.currentSession.nextTriggerThreshold); 
                
                const pulseLayer = this.uiCache.pulseLayer; // 使用缓存 DOM
                if (pulseLayer) {
                    pulseLayer.style.setProperty('--pulse-color', color);
                    if (!pulseLayer.classList.contains('pulse-active')) {
                        pulseLayer.classList.add('pulse-active');
                        setTimeout(() => pulseLayer.classList.remove('pulse-active'), 700);
                    }
                }

                // 震动节流
                const now = Date.now();
                if (this.uiCache.el && (!this.lastUiShakeTime || now - this.lastUiShakeTime > 100)) {
                    this.lastUiShakeTime = now;
                    const el = this.uiCache.el;
                    el.classList.remove('gauge-shake');
                    void el.offsetWidth; 
                    el.classList.add('gauge-shake');
                }
                
                // 粒子
                for(let i=0; i<3; i++) {
                    const p = new Particle(targetX, targetY, color, 'spark');
                    p.vel = new Vec2((Math.random()-0.5)*3, (Math.random()-0.5)*3);
                    this.particles.push(p);
                }

                if (this.currentSession.currentHits >= this.currentSession.nextTriggerThreshold) {
                    this.spawn_triggerLevelUpEvent(targetX, targetY); 
                } 
            }
            this.phase_gathering_attemptComplete();
        }));
    }

    /**
     * [AUTO-GENERATED] TODO: Add a description for spawn_triggerLevelUpEvent.
     * @param {any} uiX - TODO: Describe this parameter.
     * @param {any} uiY - TODO: Describe this parameter.
     */
    spawn_triggerLevelUpEvent(uiX, uiY) {
    this.currentSession.currentHits = 0;
    this.currentSession.multicast++; 
    this.combat_updateMulticastDisplay(1);
    
    // 1. 音效爆發
    audio.playPowerup(this.currentSession.multicast); 
    
    // 2. UI 容器进入“满能量”状态动画
    const gaugeShell = this.uiCache ? this.uiCache.gaugeShell : document.getElementById('gauge-shell');
    if (gaugeShell) {
        // 添加针对圆角优化的发光类
        gaugeShell.classList.add('gauge-full');
        
        // 0.8秒后移除
        setTimeout(() => gaugeShell.classList.remove('gauge-full'), 800);
    }
    // 3. 强力冲击波
    this.spawn_createShockwave(uiX, uiY, '#facc15');
    
    // 4. 生成大量粒子
    for(let i=0; i<20; i++) {
        const px = uiX + (Math.random()-0.5) * 80;
        const py = uiY + (Math.random()-0.5) * 30;
        this.spawn_createParticle(px, py, '#fcd34d', 'spark');
    }

    this.spawn_createFloatingText(uiX, uiY - 50, "LEVEL UP!", "#fff");
    this.combat_updateHitProgress(0, this.currentSession.nextTriggerThreshold);
}

    // 在 Game 类中
    /**
     * [AUTO-GENERATED] TODO: Add a description for calc_compileCollectionToRecipe.
     * @param {any} marbleDef - TODO: Describe this parameter.
     * @param {any} collectedTypes - TODO: Describe this parameter.
     * @param {any} totalMulticast - TODO: Describe this parameter.
     */
    calc_compileCollectionToRecipe(marbleDef, collectedTypes, totalMulticast) {
        const recipe = { 
            damage: CONFIG.gameplay.baseDamage || 1, 
            bounce: 0, pierce: 0, scatter: 0, 
            explosive: marbleDef.type === 'explosive', 
            isMatryoshka: marbleDef.type === 'matryoshka', 
            isLaser: marbleDef.type === 'laser', // 默认为 false，由 collected 决定
            nestedPayload: null, chainPayload: null, 
            multicast: totalMulticast,
            flying_sword: 0,
            cryo: 0, pyro: 0, lightning: 0, laser: marbleDef.type === 'laser' ? 1 : 0,
            wind: 0,
            level: 1, 
            type: 'normal'
        };


        // --- 2. 收集属性 (Collected Stats) ---
        collectedTypes.forEach(t => { 
            // [修复] 支持混合格式：字符串或对象 {type, level}
            const itemType = (typeof t === 'string') ? t : t.type;
            const itemLevel = (typeof t === 'string') ? 1 : (t.level || 1);
            
            // 收集到弹性钉子 -> 增加反弹次数
            if (itemType === 'bounce') recipe.bounce += 1; 
            if (itemType === 'pierce') recipe.pierce += 1; 
            if (itemType === 'scatter') recipe.scatter += 1; 
            if (itemType === 'damage') recipe.damage += itemLevel; 
            
            // [修复] 确保元素属性正确累加，并支持层数 (itemLevel)
            if (itemType === 'cryo') recipe.cryo = (recipe.cryo || 0) + itemLevel; 
            if (itemType === 'pyro') recipe.pyro = (recipe.pyro || 0) + itemLevel;       
            if (itemType === 'lightning') recipe.lightning = (recipe.lightning || 0) + itemLevel;      
            
            // 收集到激光钉子 -> 增加激光层数
            if (itemType === 'laser') {
                recipe.laser = (recipe.laser || 0) + itemLevel; 
            }
            
            if (itemType === 'flying_sword') {
                recipe.flying_sword = 1;
                recipe.type = 'flying_sword'; 
                recipe.level = Math.max(recipe.level, itemLevel);
            }
            
            // [新增] 处理风属性
            if (itemType === 'wind') {
                recipe.wind = (recipe.wind || 0) + itemLevel;
                recipe.level = Math.max(recipe.level, itemLevel); // [迁移] 记录最高等级
            }
            
            // [已移除] 彩虹属性不再同步增加元素层数，仅保留分裂机制逻辑
        });
        if (recipe.laser > 0) {
            recipe.isLaser = true;
        }
        return recipe;
    }
    /**
    /**
     * @method updateGatheringQueueUI
     * @description 更新收集阶段的弹珠队列UI。
     */
    ui_updateGatheringQueueUI() { 
        const q = document.getElementById('gathering-queue'); 
        q.innerHTML = ''; 
        for(let i = this.activeMarbleIndex; i < this.marbleQueue.length; i++) { 
            const m = this.marbleQueue[i]; 
            const d = document.createElement('div'); 
            d.className = 'queue-dot flex-shrink-0'; 
            d.style.background = m.type === 'rainbow' ? CONFIG.colors.marbleRainbow : m.getColor(); 
            q.appendChild(d); 
        } 
    }
    /**
    /**
     * @method updateHitProgress
     * @description 更新命中进度条UI。
     * @param {number} val - **重要参数** 当前命中次数。
     * @param {number} target - **重要参数** 目标命中次数。
     */
    combat_updateHitProgress(val, target) { 
        // 更新数字
        document.getElementById('hit-text').innerText = `${val}/${target}`; 
        
        // 计算百分比
        const pct = target > 0 ? Math.min(100, (val/target)*100) : 0; 
        const bar = document.getElementById('hit-bar');
        
        if(bar) {
            // 更新宽度
            bar.style.width = `${pct}%`;
            
            // 状态切换：满能量 vs 普通
            if (pct >= 99) {
                bar.classList.add('bar-full');
            } else {
                bar.classList.remove('bar-full');
            }
        }
    }
    /**
     * @method updateAmmoUI
     * @description 更新战斗阶段的双槽位弹药UI (Current & Next)
     */
    ui_updateAmmoUI() {
        const currentContainer = document.getElementById('current-ammo-render');
        const nextContainer = document.getElementById('next-ammo-render');
        const statsContainer = document.getElementById('current-bullet-stats');
        
        if (!currentContainer || !nextContainer) return;

        // 清空当前内容
        currentContainer.innerHTML = '';
        nextContainer.innerHTML = '';

        // 1. 渲染当前弹药 (Queue[0])
        if (this.ammoQueue.length > 0) {
            const currentRecipe = this.ammoQueue[0];
            this.ui_renderAmmoIcon(currentContainer, currentRecipe, true);
            
            // 更新底部属性文本
            let html = '';
            if (currentRecipe.damage > 2) html += `<span class="text-purple-300">⚔️${currentRecipe.damage}</span>`;
            else html += `<span class="text-slate-400">⚔️${currentRecipe.damage}</span>`;

            Object.keys(CONFIG.ui.attributeDisplay).foreach((_type) => {
                if (currentRecipe[_type]) html += `<span class="text-green-300">${CONFIG.ui.attributeDisplay[_type].icon}${currentRecipe[_type]}</span>`;
            })
            if(html === '') html = '<span class="text-slate-500">基础弹药</span>';
            statsContainer.innerHTML = html;
            
            // 移除发射动画类（如果是重新渲染）
            currentContainer.classList.remove('shoot-anim');
        } else {
            currentContainer.innerHTML = '<span class="text-slate-600 text-xs">EMPTY</span>';
            statsContainer.innerHTML = '<span class="text-slate-600">-- 弹药耗尽 --</span>';
        }

        // 2. 渲染下一发弹药 (Queue[1])
        if (this.ammoQueue.length > 1) {
            const nextRecipe = this.ammoQueue[1];
            this.ui_renderAmmoIcon(nextContainer, nextRecipe, false);
        } else {
            nextContainer.innerHTML = '<span class="text-slate-700 text-xs">--</span>';
        }
    }

    /**
     * 辅助方法：在UI中绘制一个纯CSS的子弹图标
     */
    ui_renderAmmoIcon(container, recipe, isCurrent) {
        const size = isCurrent ? 24 : 16;
        const div = document.createElement('div');
        
        // 基础球体
        div.style.width = `${size}px`;
        div.style.height = `${size}px`;
        div.style.borderRadius = '50%';
        
        // 颜色逻辑 (与 Projectile 一致)
        let bg = '#e2e8f0';
        let shadow = 'none';


        //  光球的 UI 样式 (高优先级)
        if (recipe.isLaser) { 
            // 核心白，外发光蓝，模拟“光球”质感
            bg = '#ffffff'; 
            // 动态阴影：激光层数越多，阴影扩散越大
            const glowSize = 10 + (recipe.laser || 0) * 2;
            shadow = `0 0 ${glowSize}px ${CONFIG.colors.laser}, inset 0 0 5px ${CONFIG.colors.laser}`;
        }else if (recipe.explosive) { bg = '#fca5a5'; shadow = '0 0 10px #ef4444'; }
        else if (recipe.pyro) { bg = '#fdba74'; shadow = '0 0 8px #f97316'; }
        else if (recipe.cryo) { bg = '#cffafe'; shadow = '0 0 8px #06b6d4'; }
        else if (recipe.lightning) { bg = '#e9d5ff'; shadow = '0 0 8px #c084fc'; }
        else if (recipe.pierce) { bg = '#fecaca'; }
        else if (recipe.bounce) { bg = '#bbf7d0'; }
        
        div.style.background = bg;
        div.style.boxShadow = shadow;
        div.style.position = 'relative';

        if (recipe.isLaser) {
             div.style.border = '2px solid #fff'; // 加个白圈
        }
        // 简单图标装饰
        if (recipe.scatter) {
            div.style.border = '2px solid #facc15'; // 黄框
        }
        if (recipe.multicast) {
            const badge = document.createElement('div');
            badge.innerText = `+${recipe.multicast}`;
            badge.className = 'absolute -top-2 -right-2 text-[10px] bg-orange-500 text-white rounded-full px-1 font-bold leading-tight';
            container.appendChild(badge);
        }
        
        container.appendChild(div);
    }
    //  处理单个敌人的回合逻辑 (当波扫到它时调用)
    /**
     * [AUTO-GENERATED] TODO: Add a description for calc_processSingleEnemyTurn.
     * @param {any} e - TODO: Describe this parameter.
     */
    phase_enemy_processTurn(e) {
        if (!e.active || e.hasActedThisTurn) return;
        
        e.hasActedThisTurn = true; 
        
        //  只要觸發了結算，強迫掃描波在接下來的 45 幀內保持慢速
        // 這樣即使敵人被燒死消失了，波浪也會慢慢掃過屍體位置，展現"擊殺確認"的感覺
        this.waveMomentumTimer = 45; 

        // --- 1. 溫度結算邏輯 ---
        if (e.temp < 0) {
            // 1. 深度冻结 (-100以下)：视觉上有冰块，逻辑上必须 100% 冻结
             // 2. 浅度冻结 (-50 ~ -99)：视觉上无冰块，逻辑上概率冻结
             
             let shouldFreeze = false;

             if (e.temp <= -100) {
                 shouldFreeze = true; // 强制冻结
             } else if (e.temp <= -50) {
                 // 概率计算：从 -50 的 0% 到 -100 的 100% 线性增加
                 const chance = (Math.abs(e.temp) - 50) / 50; 
                 if (Math.random() < chance) shouldFreeze = true;
             }

             if (shouldFreeze) { 
                 e.isFrozenCurrentTurn = true;
                 this.spawn_createExplosion(e.pos.x, e.pos.y, '#06b6d4');
                 audio.playEffect('freeze');
             } else {
                 e.isFrozenCurrentTurn = false;
             }
             
             // 温度衰减 (保持不变)
             e.temp = Math.ceil(e.temp / 2);
        }

        if (e.temp > 0) {
            if (e.temp < 100) {
                 e.temp = Math.max(0, e.temp - 5);
            } else {
                const dot = 5 + (e.temp - 100);
                e.takeDamage(dot); // <--- 敵人可能在這裡死亡 (active = false)
                
                // 记录火焰持续伤害
                this.combat_recordDamage(dot, 'pyro', 'main');
                
                // 觸發燃燒特效
                e.playBurnTickEffect(this, Math.floor(dot));
                
                const decay = Math.floor(e.temp / 20);
                e.temp = Math.max(0, e.temp - decay);
            }
        }

        // --- 2. 行動邏輯 ---
        // 只有活著的敵人才移動
        if (e.active && e.isFrozenCurrentTurn == false) {
            e.startTurnAction(this);
        }
    }
    /**
     * @method startEnemyTurnLogic
     * @description 启动敌人回合：锁定状态、显示UI提示、并计算所有敌人的移动与技能
     */
    phase_enemy_startLogic() {
        console.log(">>> [LOG] 启动敌人回合逻辑"); //
        this.isEnemyTurn = true;
        this.enemyTurnTimer = 0;

        // 初始化扫描波
        this.enemyWaveActive = true;
        this.enemyWaveY = this.height + 50; // 从屏幕最下方开始
        this.waveSpeed = 8 * this.timeScale; // 根据倍速调整扫描速度
        console.log(">>> [LOG] 扫描波已激活，起始 Y:", this.enemyWaveY);
        // 重置所有敌人的行动标记
        this.enemies.forEach(e => {
            e.hasActedThisTurn = false;
            e.isFrozenCurrentTurn = false; // 重置上一轮的冰冻状态
        });

        // UI 提示
        const msgEl = document.getElementById('combat-message');
        if (msgEl) {
            msgEl.innerHTML = '<span class="text-yellow-400 font-bold text-xl drop-shadow-md">⚠️ ENEMY TURN</span>';
            msgEl.classList.remove('opacity-0');
            msgEl.classList.add('pop-anim'); 
        }
    }


      /**
     * @method finalizeRound
     * @description [修改版] 回合结算，包含劣势补偿机制(自动极速)
     */
    phase_finalizeRound() {
        // 1. 统计当前存活敌人数据
        const activeEnemies = this.enemies.filter(e => e.active);
        // 使用 Set 统计有多少个不同的 Y 坐标（即有多少行）
        // Math.round 处理浮点误差，/50 是行高，确保归类准确
        const uniqueRows = new Set(activeEnemies.map(e => Math.round(e.pos.y / this.enemyHeight)));
        
        // 2. 触发条件判定：行数 <= 1 或 总数 <= 5
        if (uniqueRows.size <= 1 || activeEnemies.length <= 5) {
            let buffCount = 0;
            activeEnemies.forEach(e => {
                if (!e.affixes.includes('haste')) {
                    e.affixes.push('haste');
                    buffCount++;
                    // [视觉] 获得Buff的特效
                    this.spawn_createParticle(e.pos.x, e.pos.y, '#facc15', 'spark');
                }
            });
            
            if (buffCount > 0) {
                showToast("⚠️ 敵軍狂暴 (HASTE APPLIED) ⚠️");
                audio.playPowerup(); // 播放警示音
            }
        }

        // --- 以下保持原有的回合结算逻辑 ---
        
        // 生成新敌人
        const rowCountCurrent = uniqueRows.size;
        let spawnCount = 1;
        if (rowCountCurrent < 4) spawnCount = 3; // 稍微激进一点的生成
        this.spawn_spawnEnemyRow(spawnCount);

        // 重置倍率
        if (this.nextRoundHpMultiplier > 1) {
            showToast("強敵來襲！HP x" + this.nextRoundHpMultiplier);
            this.nextRoundHpMultiplier = 1;
        }

        // [修复] 回合切换时清空蝴蝶法阵和风刃，防止残留
        if (this.butterflyCircles) this.butterflyCircles = [];
        if (this.butterflyBlades) this.butterflyBlades = [];
        
        // 更新回合数
        this.round++;
        this.prevRoundDamage = this.roundDamage;
        this.roundDamage = 0;
        document.getElementById('round-num').innerText = this.round;
        showToast(`Round ${this.round}`);

        // 检查失败
        if (this.input_checkDefeat()) {
            this.gameOver = true;
            return;
        }

        document.getElementById('combat-message').innerHTML = '';
        this.phase_gathering_initPachinko(true);

        this.isEnemyTurn = false;
        // 遗物事件检查
        if (this.round % CONFIG.gameplay.relicRoundInterval == 0) {
            showToast("✨ 命運的饋贈 ✨");
            this.phase = 'relic_event';
            setTimeout(() => { this.ui_showRelicSelection(); }, 500);
            return;
        }
        
        
        if (this.ammoQueue.length === 0) {
            this.sys_initSelectionPhase();
        }
    }

    /**
     * @method checkDefeat
     * @description 检查是否失败 (是否有敌人越过失败线)。
     * @returns {boolean} 是否失败。
     */
        /**
     * @method checkDefeat
     * @description 检查是否失败 (包含视差偏移计算)。
     * @returns {boolean} 是否失败。
     */
        /**
     * @method checkDefeat
     * @description 检查是否失败 (包含视差偏移计算)。
     */
    input_checkDefeat() { 
        // [修正]：使用实体层 Y 轴系数 (-20)
        const viewShiftY = this.boardTilt.current.y * -20;

        for(let e of this.enemies) { 
            // 判断：(敌人逻辑位置 + 视觉偏移) 是否超过 防线
            if (e.active && (e.pos.y + viewShiftY) > this.defeatLineY) {
                return true; 
            }
        } 
        return false; 
    }

        /**
     * @method updateCombat
     * @description 战斗阶段的游戏逻辑更新 (含可视化墙壁与分层视差)。
     */
    phase_combat_update(timeScale) {

        // === [新增] 处理子剑动态生成队列 ===
        if (this.sonSwordQueue.length > 0) {
            this.sonSwordTimer -= timeScale;
            
            if (this.sonSwordTimer <= 0) {
                // 取出一个生成请求
                const req = this.sonSwordQueue.shift();
                
                // 只要母剑还活着(或者没飞太远)，就生成子剑
                if (req.mother.active || !req.mother.destroyed) {
                    // 这里 startDelay 传 0，因为我们已经通过队列控制了时间
                    this.combat_flyingSword_addSon(req.x, req.y, req.mother, req.level, req.config, 0);
                    
                    // 播放一个轻微的生成音效 (可选)
                    // audio.playTone(600 + this.sonSwordQueue.length * 50, 'sine', 0.05, 0.1);
                }

                // [核心算法] 动态延迟计算
                // 剩余数量越多，延迟越短 (喷射而出)；剩余越少，延迟越长 (慢慢收尾)
                const remaining = this.sonSwordQueue.length;
                
                // 公式：基础延迟 20帧，每多一个排队减少 2帧，最快 2帧
                // 例如：剩 10 个 -> delay = max(2, 20 - 20) = 2 (极速)
                // 例如：剩 1 个 -> delay = max(2, 20 - 2) = 18 (慢速)
                this.sonSwordTimer = Math.max(2, 20 - (remaining * 2));
            }
        }

        if (this.isChargingShot) {
            // 吸收速度：0.08 大约需要 12 帧 (0.2秒)，手感比较干脆
            this.chargeProgress += 0.08 * timeScale;
            
            if (this.chargeProgress >= 1.0) {
                // 动画结束，真正发射
                this.isChargingShot = false;
                this.chargeProgress = 0;
                if (this.pendingFireVelocity) {
                    this.combat_fireNextShot(this.pendingFireVelocity);
                    this.pendingFireVelocity = null;
                    // --- [新增] 发射后立即触发“能量注入”动画 ---
                    this.isReloading = true;
                    this.reloadProgress = 0;
                }
            }
        }
        // --- [修改] 2. 处理能量注入 (变慢 & 增加撞击反馈) ---
        if (this.isReloading) {
            // [修改点] 速度从 0.1 改为 0.035，让过程持续约 0.5秒，更具重量感
            this.reloadProgress += 0.035 * timeScale;
            
            if (this.reloadProgress >= 1.0) {
                this.isReloading = false;
                this.reloadProgress = 1.0;
                
                // [新增] 撞击时刻！给予轨道一个巨大的旋转初速度
                // 就像能量球狠狠砸在了轨道上，带动它疯狂旋转
                this.spinBoost = 0.002; 
            }
        }

        // --- [新增] 3. 计算轨道旋转物理 (惯性与阻力) ---
        // 基础旋转速度 (约为 0.5 rad/frame)
        const baseSpeed = 0.00012; 
        
        // 阻力衰减：每一帧速度乘以 0.92，快速慢下来
        this.spinBoost *= 0.95;
        if (this.spinBoost < 0.0001) this.spinBoost = 0;

        // 最终角度累加：基础速度 + 爆发速度
        // 在装填过程中(isReloading)，为了体现"未就位"，我们可以让轨道转得稍慢一点，或者反向转
        let currentFrameSpeed = baseSpeed + this.spinBoost;
        this.orbitalAngle += currentFrameSpeed * timeScale * 60; // *60 是为了适配 timeScale 的基准
        this.ui_updateSlowMotion();
        const tilt = this.boardTilt.current;
        const container = document.getElementById('game-container');
        if (container) {
            container.style.perspective = "1200px";
            const rotateX = tilt.y * -8;
            const rotateY = tilt.x * 8;
            const translateZ = -20;
            // container.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`;
            container.style.transform = `rotateX(0deg) rotateY(0deg) translateZ(0px)`;
        }

        // === 1. 计算视差参数 ===
        // 背景层 (地板)：正向移动
        const bgShiftX = tilt.x * 20;
        const bgShiftY = tilt.y * 15;

        // 实体层 (敌人/UI/墙壁)：反向移动
        const entityShiftX = tilt.x * -15;
        const entityShiftY = tilt.y * -10;

        // 应用 CSS 到 DOM UI
        // const skillBar = document.getElementById('skill-bar');
        // const hud = document.getElementById('recipe-hud-container');
        // const uiTransform = `translate3d(${entityShiftX}px, ${entityShiftY}px, 0)`;
        // if (skillBar) skillBar.style.transform = uiTransform;
        // if (hud) hud.style.transform = uiTransform;

        if (this.swordQis) {
            for (let i = this.swordQis.length - 1; i >= 0; i--) {
                const qi = this.swordQis[i];
                qi.update(timeScale, this.enemies, this); // 傳入 enemies 和 game 實例
                if (!qi.active) {
                    this.swordQis.splice(i, 1);
                }
            }
        }
        // --- 逻辑更新 ---
        for (let i = this.burstQueue.length - 1; i >= 0; i--) { 
            const shot = this.burstQueue[i]; 
            shot.delay -= timeScale; 
            if (shot.delay <= 0) { 
                this.spawn_spawnBullet(this.width/2, this.height-80, shot.vel, shot.recipe, shot.shotId, shot.isLast); 
                audio.playShoot(); 
                this.burstQueue.splice(i, 1); 
            } 
        }
        if (this.waveMomentumTimer > 0) this.waveMomentumTimer -= timeScale;

        // ==========================================
        //  LAYER 0: 固定 UI 层 (防线)
        // ==========================================
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.defeatLineY);
        this.ctx.lineTo(this.width, this.defeatLineY);
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
        this.ctx.font = 'bold 10px monospace';
        this.ctx.fillText("⚠️ DEFENSE LINE", 10, this.defeatLineY - 6);
        const dangerGrad = this.ctx.createLinearGradient(0, this.defeatLineY, 0, this.height);
        dangerGrad.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
        dangerGrad.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
        this.ctx.fillStyle = dangerGrad;
        this.ctx.fillRect(0, this.defeatLineY, this.width, this.height - this.defeatLineY);
        this.ctx.restore();


        // ==========================================
        //  LAYER 1: 背景层 (网格 & 扫描波)
        // ==========================================
        this.ctx.save();
        this.ctx.translate(bgShiftX, bgShiftY); 

            // A. 绘制背景网格
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(71, 85, 105, 0.15)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            const gridOffsetX = bgShiftX * 1.5;
            const gridOffsetY = bgShiftY * 1.5;
            for (let x = -50; x < this.width + 50; x += 40) {
                this.ctx.moveTo(x, -50); this.ctx.lineTo(x, this.height + 50);
            }
            for (let y = -50; y < this.height + 50; y += 40) {
                this.ctx.moveTo(-50, y); this.ctx.lineTo(this.width + 50, y);
            }
            this.ctx.stroke();
            this.ctx.restore();

            // B. 绘制扫描波
            if (this.isEnemyTurn && this.enemyWaveActive) {
                const currentSpeed = this.calc_calculateWaveSpeed();
                this.enemyWaveY -= currentSpeed;

                this.ctx.save();
                this.ctx.globalCompositeOperation = 'lighter';
                
                const trailHeight = 220; 
                const gridGrad = this.ctx.createLinearGradient(0, this.enemyWaveY, 0, this.enemyWaveY + trailHeight);
                gridGrad.addColorStop(0, 'rgba(251, 191, 36, 0.5)'); 
                gridGrad.addColorStop(0.3, 'rgba(217, 119, 6, 0.2)'); 
                gridGrad.addColorStop(1, 'rgba(180, 83, 9, 0)');     
                this.ctx.strokeStyle = gridGrad;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                const cols = 8;
                for(let i=0; i<=cols; i++) {
                    const x = (this.width / cols) * i;
                    this.ctx.moveTo(x, this.enemyWaveY);
                    this.ctx.lineTo(x, this.enemyWaveY + trailHeight);
                }
                const gridSize = 40;
                const startGridY = Math.floor(this.enemyWaveY / gridSize) * gridSize;
                for(let y = startGridY; y < this.enemyWaveY + trailHeight; y += gridSize) {
                    if(y > this.enemyWaveY) { 
                        this.ctx.moveTo(0, y);
                        this.ctx.lineTo(this.width, y);
                    }
                }
                this.ctx.stroke();

                const time = Date.now() / 50; 
                this.ctx.beginPath();
                this.ctx.strokeStyle = '#ffffff'; 
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = '#fef08a'; 
                this.ctx.shadowBlur = 15;
                for (let x = 0; x <= this.width; x += 10) {
                    const offset = Math.sin(x * 0.1 + time) * 2 + (Math.random() - 0.5) * 6;
                    const y = this.enemyWaveY + offset;
                    if (x === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#fef3c7'; 
                for(let i=0; i<5; i++) {
                    const lx = Math.random() * this.width;
                    const ly = this.enemyWaveY + (Math.random() - 0.5) * 30;
                    const lw = Math.random() * 50 + 10;
                    this.ctx.fillRect(lx, ly, lw, 1);
                }
                this.ctx.restore();

                const triggerLine = this.enemyWaveY; 
                this.enemies.forEach(e => {
                    if (!e.active) return;
                    if (e.pos.y + e.height/2 >= triggerLine && !e.hasActedThisTurn) {
                        e.playScanFeedback();
                        this.phase_enemy_processTurn(e);
                    }
                });
                if (this.enemyWaveY < -50) {
                    this.enemyWaveActive = false;
                    this.enemyTurnTimer = 0;
                }
            }
        this.ctx.restore(); 


        // ==========================================
        //  LAYER 2: 实体层 (墙壁 / 敌人 / 子弹)
        // ==========================================
        this.ctx.save();
        this.ctx.translate(entityShiftX, entityShiftY); 

            // --- [新增]：绘制可视化的边界墙壁 ---
            this.ctx.save();
            // 左墙 (半透明渐变)
            const wallGradLeft = this.ctx.createLinearGradient(0, 0, 20, 0);
            wallGradLeft.addColorStop(0, 'rgba(148, 163, 184, 0.2)');
            wallGradLeft.addColorStop(1, 'rgba(148, 163, 184, 0)');
            this.ctx.fillStyle = wallGradLeft;
            this.ctx.fillRect(0, -100, 20, this.height + 100);
            
            // 右墙 (半透明渐变)
            const wallGradRight = this.ctx.createLinearGradient(this.width, 0, this.width - 20, 0);
            wallGradRight.addColorStop(0, 'rgba(148, 163, 184, 0.2)');
            wallGradRight.addColorStop(1, 'rgba(148, 163, 184, 0)');
            this.ctx.fillStyle = wallGradRight;
            this.ctx.fillRect(this.width - 20, -100, 20, this.height + 100);

            // 墙壁发光边框 (明确反弹线)
            this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'; // Slate-400
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = '#94a3b8';
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            // 左边线
            this.ctx.moveTo(1, -100); this.ctx.lineTo(1, this.height);
            // 右边线
            this.ctx.moveTo(this.width - 1, -100); this.ctx.lineTo(this.width - 1, this.height);
            // 顶部线 (封顶)
            this.ctx.moveTo(0, 1); this.ctx.lineTo(this.width, 1);
            this.ctx.stroke();
            this.ctx.restore();
            // ------------------------------------

            // C. 绘制游戏实体
            let activeEnemies = 0; 
            let anyEnemyMoving = false;
            this.enemies.forEach(e => {
                if (e.active) {
                    e.update(this.timeScale, this);
                    e.draw(this.ctx);
                    // e.dropTargetY > 0 || 
                    if (e.pos.y > 0) {
                        activeEnemies++;
                    }
                    if (Math.abs(e.pos.y - e.dropTargetY) > 1) anyEnemyMoving = true;
                }
            });

            if (this.input_checkDefeat()) this.gameOver = true;

            // 更新和绘制弹丸
            for (let i = this.projectiles.length - 1; i >= 0; i--) { 
                const p = this.projectiles[i]; 
                if(p) { 
                    p.update(this.width, this.height, this.enemies, (spawnInfo) => { this.spawn_spawnBullet(spawnInfo.x, spawnInfo.y, spawnInfo.vel, spawnInfo.config, p.shotId); }, timeScale); 
                    p.draw(this.ctx); 
                    if (p.destroyed) {
                        // [修复] 当该shotId的所有子弹都销毁时，保存统计
                        if (p.shotId !== null && this.shotDamageMap.has(p.shotId)) {
                            const shotStats = this.shotDamageMap.get(p.shotId);
                            shotStats.destroyedCount++;
                            
                            // 当所有子弹都销毁时，保存统计
                            if (shotStats.destroyedCount >= shotStats.projectileCount && shotStats.total > 0) {
                                this.shotDamageHistory.push({
                                    total: shotStats.total,
                                    byAttr: JSON.parse(JSON.stringify(shotStats.byAttr))
                                });
                                // 增加容量到 10 发子弹，方便查看
                                if (this.shotDamageHistory.length > 10) {
                                    this.shotDamageHistory.shift();
                                }
                                this.ui_updateDamageStats();
                                this.shotDamageMap.delete(p.shotId);
                            }
                        }
                        this.projectiles.splice(i, 1);
                    } 
                } 
            }

            // 更新和绘制 FireWaves
            for (let i = this.fireWaves.length - 1; i >= 0; i--) {
                const fw = this.fireWaves[i];
                fw.update(timeScale);
                fw.draw(this.ctx);
                if (fw.life <= 0) this.fireWaves.splice(i, 1);
            }

            // 更新和绘制特效
            for(let i=this.particles.length-1; i>=0; i--) { let p = this.particles[i]; if(p) { p.update(timeScale); p.draw(this.ctx); if(p.life <= 0) this.particles.splice(i,1); } } 
            for(let i=this.shockwaves.length-1; i>=0; i--) { let s = this.shockwaves[i]; if(s) { s.update(timeScale); s.draw(this.ctx); if(s.alpha <= 0) this.shockwaves.splice(i,1); } } 
            for(let i=this.lightningBolts.length-1; i>=0; i--) { let b = this.lightningBolts[i]; b.update(timeScale); b.draw(this.ctx); if(b.life <= 0) this.lightningBolts.splice(i,1); } 
            for(let i=this.spores.length-1; i>=0; i--) { let s = this.spores[i]; if(s) { s.update(timeScale); s.draw(this.ctx); if(!s.active) this.spores.splice(i,1); } }
            if (this.swordQis) {
                this.swordQis.forEach(qi => qi.draw(this.ctx));
            }
            // 蝴蝶法阵更新和绘制
            this.combat_wind_updateButterflyCircles(timeScale);
            this.combat_wind_drawButterflyCircles(this.ctx);
            this.combat_wind_updateButterflyBlades(timeScale);
            this.combat_wind_drawButterflyBlades(this.ctx);
            // 风暴核心更新和绘制
            this.combat_wind_updateStormCores(timeScale);
            this.combat_wind_drawStormCores(this.ctx);
            // 拖拽瞄准线
            if (this.isDragging && this.projectiles.length === 0 && this.ammoQueue.length > 0 && this.burstQueue.length === 0) {
                const start = new Vec2(this.width / 2, this.height - 80);
                let force = this.lastMousePos.sub(start);
                
                if (force.y < -20) {
                    const maxLen = 800; 
                    const radius = CONFIG.physics.bulletRadius;
                    let dir = force.norm(); 
                    
                    this.ctx.save();
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([6, 6]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(start.x, start.y);

                    let distToX = Infinity;
                    let distToY = Infinity;
                    if (dir.x > 0) distToX = (this.width - radius - start.x) / dir.x;
                    else if (dir.x < 0) distToX = (radius - start.x) / dir.x;
                    if (dir.y < 0) distToY = (radius - start.y) / dir.y;

                    let hitDist = Math.min(distToX, distToY);
                    if (hitDist < maxLen) {
                        const hitPoint = start.add(dir.mult(hitDist));
                        this.ctx.lineTo(hitPoint.x, hitPoint.y);
                        const remainLen = maxLen - hitDist;
                        let reflectDir = new Vec2(dir.x, dir.y);
                        if (distToX < distToY) reflectDir.x *= -1; 
                        else reflectDir.y *= -1; 
                        const endPoint = hitPoint.add(reflectDir.mult(remainLen));
                        this.ctx.lineTo(endPoint.x, endPoint.y);
                        this.ctx.stroke();
                        this.ctx.beginPath();
                        this.ctx.setLineDash([]);
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        this.ctx.arc(endPoint.x, endPoint.y, 3, 0, Math.PI * 2);
                        this.ctx.fill();
                    } else {
                        const end = start.add(dir.mult(maxLen));
                        this.ctx.lineTo(end.x, end.y);
                        this.ctx.stroke();
                    }
                    this.ctx.restore();

                    this.ctx.save();
                    this.ctx.translate(start.x, start.y);
                    this.ctx.rotate(Math.atan2(force.y, force.x));
                    this.ctx.fillStyle = '#6366f1';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 15, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.fillStyle = '#818cf8';
                    this.ctx.fillRect(10, -6, 12, 12); 
                    this.ctx.restore();
                }
            } else if (this.projectiles.length === 0) {
                const start = new Vec2(this.width / 2, this.height - 80);
                this.ctx.save();
                this.ctx.translate(start.x, start.y);
                this.ctx.rotate(-Math.PI / 2); 
                this.ctx.fillStyle = '#475569';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillRect(8, -4, 8, 8);
                this.ctx.restore();
            }

        this.sonSwords.forEach(s => s.update(timeScale, this.enemies, this));
        this.sonSwords.forEach(s => s.draw(this.ctx));
        // 清理不活跃的子剑
        this.sonSwords = this.sonSwords.filter(s => s.active);

        this.ctx.restore(); // 结束实体层


        // --- UI Overlays ---
        if (this.gameOver) { 
            // [META] 结算货币并保存
            if (this.runCurrency > 0) {
                this.meta_addCurrency(this.runCurrency);
                this.runCurrency = 0;
            }

            document.getElementById('combat-message').innerHTML = '<span class="text-red-400 font-bold text-4xl">防線失守</span><br><span class="text-sm">點擊返回主界面</span>'; 
            return; 
        }

        if (activeEnemies === 0) {
            const hasLeftoverAmmo = this.ammoQueue.length > 0;
            if (hasLeftoverAmmo) {
                console.log(">>> [LOG] 检测到全清场，自动结算剩余弹药");
                const leftoverCount = this.ammoQueue.length;
                const scoreMult = Math.pow(CONFIG.balance.unusedAmmoScoreMult, leftoverCount);
                this.score *= scoreMult;
                document.getElementById('score-num').innerText = this.score; 
                this.nextRoundHpMultiplier = CONFIG.balance.nextRoundDifficultyMult;
                showToast(`完美清場! 分數 x${scoreMult} | 下輪難度 UP!`);
                audio.playPowerup();
                this.ammoQueue = []; 
                this.ui_updateAmmoUI();
                this.ui_renderRecipeHUD();
                this.data_clearProjectiles();
            }
        }

        const playerTurnFinished = this.ammoQueue.length === 0 && 
                                   this.projectiles.length === 0 && 
                                   this.burstQueue.length === 0 &&
                           !this.isVisualEffectActive;

        if (playerTurnFinished && !this.gameOver) {
            // 试炼场模式下，不自动进入敌人回合
            if (this.phase === 'training') {
                if (this.isEnemyTurn) {
                    if (this.enemyWaveActive) return;
                    if (anyEnemyMoving) {
                        this.enemyTurnTimer = 0; 
                        return;
                    }
                    this.enemyTurnTimer += this.timeScale;
                    if (this.enemyTurnTimer > 60) { 
                        this.isEnemyTurn = false;
                        this.enemyTurnTimer = 0;
                        this.enemies.forEach(e => e.hasActedThisTurn = false);
                        return;
                    }
                }
                return;
            }

            if (!this.isEnemyTurn) {
                this.phase_enemy_startLogic();
            } else {
                if (this.enemyWaveActive) return;
                if (anyEnemyMoving) {
                    this.enemyTurnTimer = 0; 
                    return;
                }
                this.enemyTurnTimer += this.timeScale;
                if (this.enemyTurnTimer > 60) { 
                    if (this.phase === 'training') {
                        // 试炼场不进入下一阶段，只重置敌人回合状态
                        this.isEnemyTurn = false;
                        this.enemyTurnTimer = 0;
                        this.enemies.forEach(e => e.hasActedThisTurn = false);
                    } else {
                        this.phase_finalizeRound(); 
                    }
                    return;
                }
            }
            return;
        }

        if (this.ammoQueue.length === 0 && this.projectiles.length === 0 && this.burstQueue.length === 0 && !this.gameOver) { 
            // 回合结束，风暴核心能量衰减
            this.combat_wind_decayStormCoresEnergy();
            document.getElementById('combat-message').innerHTML = '<div class="bg-black/50 p-4 rounded-xl backdrop-blur-md border border-blue-500/50 pointer-events-none"><span class="text-blue-300 font-bold text-xl block mb-2">彈藥耗盡</span><span class="text-sm text-slate-300">點擊收集新彈药</span></div>'; 
        } else { 
            if (!this.gameOver) document.getElementById('combat-message').innerHTML = ''; 
        }
        // --- 修改开始：调整层级，先画轨道，再画炮台 ---
        this.ctx.save();
        // 应用与实体层相同的视差偏移
        this.ctx.translate(entityShiftX, entityShiftY);

        const startPos = new Vec2(this.width / 2, this.height - 80);
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // 深色半透明底 (Slate-900 80%)
        this.ctx.beginPath();
        this.ctx.arc(startPos.x, startPos.y, 22, 0, Math.PI * 2); // 半径比子弹稍大
        this.ctx.fill();
        let nextAmmo = this.ammoQueue.length > 0 ? this.ammoQueue[0] : null;

        if (nextAmmo) {
            const params = Projectile.calculateVisualParams(nextAmmo, false);
            let previewRotation =  -Math.PI / 2;
            let deformation = {x: 1, y: 1};
            
            if (this.isDragging) {
                const force = this.dragStart.sub(this.dragCurrent);
                if (force.mag() > 10) {
                    previewRotation = Math.atan2(force.y, force.x) ;
                    deformation = {x: 1.15, y: 0.85}; 
                }
            }
            if (this.isChargingShot) {
                const shake = Math.random() * 2; // 吸收时的剧烈抖动
                startPos.x += (Math.random()-0.5) * shake;
                startPos.y += (Math.random()-0.5) * shake;
                // 核心随着能量吸收变大变亮
                const absorbScale = 1.0 + this.chargeProgress * 0.3;
                deformation.x *= absorbScale;
                deformation.y *= absorbScale;
            }

            //先绘制轨道 (Orbitals) -> 这样它就在炮台下面
            this.render_combat_launcherOrbitals(this.ctx, startPos.x, startPos.y, nextAmmo);

            //后绘制炮台核心 (Visuals) -> 这样它就在上面
            Projectile.drawVisuals(this.ctx, startPos.x, startPos.y, params.radius, nextAmmo, previewRotation, params.intensity, deformation);

        } else {
            // 空仓状态
            this.ctx.fillStyle = '#1e293b';
            this.ctx.beginPath();
            this.ctx.arc(startPos.x, startPos.y, 10, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#475569';
            this.ctx.stroke();
        }
        this.ctx.restore();
        
    }


    /**
     * @method attemptCompleteGatheringTurn
     * @description 尝试完成收集回合。修复了最后一个能量球导致无法结算的BUG。
     */
    phase_gathering_attemptComplete() {
        if (this.isWheelSpinning) return;
        // 解决方法：只计算 active 为 true 的能量球。
        const activeOrbsCount = this.energyOrbs.filter(orb => orb.active).length;

        // 1. 基础检查：如果还有东西在动，绝对不能结算
        console.log('[DEBUG] attemptComplete - dropBalls:', this.dropBalls.length, 'activeOrbs:', activeOrbsCount, 'activeBalls:', this.currentSession?.activeBalls);
        if (this.dropBalls.length > 0 || activeOrbsCount > 0 || this.currentSession.activeBalls > 0) {
            console.log('[DEBUG] 不能结算，还有东西在动');
            return;
        }

        // 2. 状态检查：防止重复结算
        // 如果当前 session 已经被标记为“已结算”或不存在，则直接返回
        if (!this.currentSession || this.currentSession.isFinished) return;

        // 3. 执行结算
        this.currentSession.isFinished = true; // 立即上锁

        const marbleDef = this.marbleQueue[this.activeMarbleIndex];
        // 兜底检查：如果此时 marbleDef 不存在（防止数组越界），直接停止
        if (!marbleDef) {
            this.currentSession = null;
            return;
        }
        marbleDef.collected = [...this.currentSession.collected];
        // --- [新增] 觸發倍率轉移特效 ---
        // 計算當前倍率 (1 + 額外)
        const totalMulticast = 1 + this.currentSession.multicast;
        // 只有倍率大於 1 時才播放特效，或者你想每次都播也可以
        if (totalMulticast > 0) {
            this.combat_playMulticastTransferEffect(totalMulticast);
        }
        const recipe = this.calc_compileCollectionToRecipe(marbleDef, this.currentSession.collected, this.currentSession.multicast > 0);
        recipe.finalHits = this.currentSession.totalHits;
        recipe.multicast = this.currentSession.multicast;
        this.ammoQueue.push(recipe);
        
        marbleDef.multicast = this.currentSession.multicast;
        marbleDef.finalHits = this.currentSession.totalHits;

        this.activeMarbleIndex++;
        this.ui_updateGatheringQueueUI();
        
        // [新增] 弹珠结算时，重置所有钉子的冷却
        this.pegs.forEach(p => p.resetCooldown());
        
        // 4. 状态流转
        if (this.activeMarbleIndex >= this.marbleQueue.length) {
            // 所有弹珠都扔完了，进入战斗
            setTimeout(() => this.phase_startCombatPhase(), 500);
        } else {
             // 准备下一回合，清空当前 session，允许玩家再次点击
             this.currentSession = null; 
        }
    }

    /**
     * @method drawLauncherOrbitals
     * @description 绘制发射器周围的属性轨道 (方案2：透明能量球环绕)
     */
    render_combat_launcherOrbitals(ctx, centerX, centerY, recipe) {
        if (!recipe) return;

        const stats = [];
        const mapping = {
            damage:    { val: recipe.damage > 2 ? recipe.damage : 0},
            bounce:    { val: recipe.bounce},
            pierce:    { val: recipe.pierce},
            scatter:   { val: recipe.scatter},
            cryo:      { val: recipe.cryo},
            multicast: { val: recipe.multicast},
            pyro:      { val: recipe.pyro},
            lightning: { val: recipe.lightning},
            laser:     { val: recipe.laser},
            explosive: { val: recipe.explosive ? 1 : 0},
            flying_sword: { val: recipe.flying_sword || 0 }
        };
        Object.keys(mapping).forEach(key => {
            mapping[key].color = CONFIG.ui.attributeDisplay[key].color;
            mapping[key].icon = CONFIG.ui.attributeDisplay[key].icon;
            if (mapping[key].val > 0) stats.push(mapping[key]);
        });
        if (stats.length === 0) return;

        // --- 动画数值计算 ---
        let currentRotation = this.orbitalAngle;
        let baseRadius = 55;
        let globalAlpha = 1.0;
        let orbScale = 1.0;

        if (this.isChargingShot) {
            const t = this.chargeProgress;
            baseRadius = 55 * (1 - t * t); 
            currentRotation += t * 2; // 吸收时稍微加速旋转
            if (t > 0.8) globalAlpha = 1.0 - (t - 0.8) * 5;
            orbScale = 1 - t * 0.6;
        } 
        else if (this.isReloading) {
            const t = this.reloadProgress;
            // 使用 EaseInCubic，能量球会从远处缓缓启动，快撞击时猛地加速
            const easeVal = t * t * t; 
            const startDist = 450; // 从更远的地方（屏幕外）抓取回来
            const endDist = 55;
            baseRadius = startDist + (endDist - startDist) * easeVal;
            globalAlpha = easeVal;
            orbScale = 0.3 + 0.7 * easeVal;
            // 抓取时由于还没“合体”，产生轻微的抖动感
            const shake = (1 - t) * 5;
            baseRadius += (Math.random() - 0.5) * shake;
        }

        const radius = baseRadius;
        const stepAngle = (Math.PI * 2) / stats.length;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.globalAlpha = Math.max(0, globalAlpha);

        // 绘制轨道线 (仅在非吸收状态画)
        if (radius > 15 && radius < 150) {
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * globalAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        stats.forEach((stat, index) => {
            const angle = stepAngle * index + currentRotation;
            const ox = Math.cos(angle) * radius;
            const oy = Math.sin(angle) * radius;

            // --- [报错防御点] ---
            // 如果计算出的位置不是有效的数字，跳过绘制，防止 createLinearGradient 崩溃
            if (!isFinite(ox) || !isFinite(oy)) return;

            const speedGlow = Math.min(1, this.spinBoost * 2); // 撞击后的高光
            ctx.shadowBlur = (10 + speedGlow * 20) * orbScale;
            ctx.shadowColor = stat.color;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            
            const baseSize = Math.min(22, 14 + stat.val * 0.5);
            const currentSize = Math.max(0, baseSize * orbScale);
            
            ctx.beginPath();
            ctx.arc(ox, oy, currentSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = stat.color;
            ctx.lineWidth = (2 + speedGlow * 2) * orbScale;
            ctx.stroke();

            // 拖尾特效 (增强撞击爆发感)
            const totalTrail = this.spinBoost * 3 + (this.isReloading ? (1-this.reloadProgress) * 0.5 : 0);
            if (totalTrail > 0.05) {
                ctx.beginPath();
                ctx.strokeStyle = stat.color;
                ctx.lineWidth = 2 * orbScale;
                const dir = this.isReloading ? 1 : -1;
                ctx.arc(0, 0, radius, angle, angle + totalTrail * dir, this.isReloading);
                ctx.stroke();
            }

            // 绘制文字 (仅在大小合适时)
            if (radius < 200 && currentSize > 8) {
                ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                if (stat.isMulticast) {
                    ctx.font = `bold ${12 * orbScale}px monospace`;
                    ctx.fillText(`x${1 + stat.val}`, ox, oy);
                } else {
                    ctx.font = `${10 * orbScale}px sans-serif`;
                    if (stat.val > 1) {
                        ctx.fillText(stat.icon, ox, oy - 5 * orbScale);
                        ctx.font = `bold ${9 * orbScale}px sans-serif`; ctx.fillStyle = stat.color;
                        ctx.fillText(`${stat.val}`, ox, oy + 6 * orbScale);
                    } else {
                        ctx.font = `${14 * orbScale}px sans-serif`; ctx.fillText(stat.icon, ox, oy);
                    }
                }
            }
            
            // --- 绘制连线 (修复 gradient 报错点) ---
            if (radius > 10 && radius < 120) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                // 确保渐变坐标点也是有限的
                const grad = ctx.createLinearGradient(0, 0, ox, oy);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(1, stat.color);
                ctx.strokeStyle = grad;
                ctx.globalAlpha = 0.3 * globalAlpha;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(ox, oy);
                ctx.stroke();
                ctx.restore();
            }
        });

        ctx.restore();
    }
    // Gathering Phase Update
    /**
     * @method updateGathering
     * @description 收集階段的遊戲邏輯更新。
     * @param {number} [timeScale=1] - **重要參數** 時間縮放因子。
     */
    phase_gathering_update(timeScale = 1) {
        if (document.getElementById('phase-relic').style.display !== 'none') return;

        const tilt = this.boardTilt.current;


        const container = document.getElementById('game-container');
        if (container) {
            // 1. 设置透视距离，值越小 3D 感越强
            container.style.perspective = "1200px"; 
            
            // 2. 根据倾斜值旋转容器
            // rotateX 对应上下倾斜 (tilt.y)，rotateY 对应左右倾斜 (tilt.x)
            // 乘以 5 或 8 增加旋转角度的体感
            const rotateX = tilt.y * -8; 
            const rotateY = tilt.x * 8;
            const translateZ = -20; // 稍微向后退一点，防止边缘穿模

            container.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`;
            container.style.transition = "transform 0.1s ease-out"; // 平滑动画
        }
        // 模拟板子边缘受光不均
        const grad = this.ctx.createRadialGradient(
            this.width / 2 + (tilt.x * 100), // 光心随倾斜移动
            this.height / 2 + (tilt.y * 100),
            this.width * 0.2,
            this.width / 2,
            this.height / 2,
            this.width * 0.8
        );
        grad.addColorStop(0, 'rgba(30, 41, 59, 0)');
        grad.addColorStop(1, `rgba(2, 6, 23, ${0.3 + Math.abs(tilt.x) * 0.2})`); // 倾斜越大边缘越暗

        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // --- [新增] 绘制转盘 (在阴影和钉子之前) ---
        if (this.fortuneWheel.active) {
            this.fortuneWheel.update(timeScale);
            this.fortuneWheel.draw(this.ctx);
        }
        // 2.  计算动态光源位置
        // 假设光源在屏幕上方很远的地方。当板子向左倾斜 (tilt.x < 0) 时，
        // 阴影应该向左移动，或者说光源看起来像是在右边。
        // 这里的逻辑是：板子动，光不动 -> 相对运动
        const lightSourcePos = new Vec2(
            this.width / 2 - (tilt.x * 300), // X轴偏移：倾斜越大，光源相对位移越大
            -200 - (tilt.y * 100)            // Y轴偏移
        );
        const LIGHT_RADIUS = 150;
        const LIGHT_RADIUS_SQ = LIGHT_RADIUS * LIGHT_RADIUS;// 预计算平方，避免开根号
        // --- 绘制阴影 (传入动态光源) ---
        // DropBalls 发出的光
        this.dropBalls.forEach(ball => {
            if (!ball.active) return;
            this.pegs.forEach(p => {
                 // 这里是原有的小球光照阴影
                p.drawShadow(this.ctx, ball.pos, LIGHT_RADIUS);
            });
        });

        //  全局环境光阴影 (基于倾斜)
        // 让所有钉子都有一个基于板子倾斜的微弱基础阴影，增加立体感
        this.pegs.forEach(p => {
            // 我们利用 drawShadow 的逻辑，制造一个伪造的“太阳”
            p.drawShadow(this.ctx, lightSourcePos, 9999); // 半径很大，覆盖全屏
        });
        const lightSources = [...this.dropBalls];

        // --- 优化开始：只对范围内的钉子画阴影 ---
        lightSources.forEach(ball => {
            if (!ball.active) return;
            
            // 遍历所有钉子
            for (let i = 0; i < this.pegs.length; i++) {
                const p = this.pegs[i];
                // 简单的 AABB 预判或距离平方判断
                const dx = ball.pos.x - p.pos.x;
                const dy = ball.pos.y - p.pos.y;
                
                // 只有距离小于 LIGHT_RADIUS 时才绘制阴影
                // Math.abs 检查比乘法快，先做粗略筛选
                if (Math.abs(dx) < LIGHT_RADIUS && Math.abs(dy) < LIGHT_RADIUS) {
                    if ((dx*dx + dy*dy) < LIGHT_RADIUS_SQ) {
                        p.drawShadow(this.ctx, ball.pos, LIGHT_RADIUS);
                        p.calculateLight(ball.pos, LIGHT_RADIUS); // 光照计算也放这里
                    }
                }
            }
        });
        // 繪製釘子
        const pegRadius = Math.min(8, this.width / 60);
        this.pegs.forEach(p => { 
            p.update(); // 更新冷却和动画
            p.draw(this.ctx, pegRadius); 
            p.resetLight();
        });

        
        lightSources.forEach(ball => {
            // 优化：只检查垂直距离接近的行，或者直接遍历所有 (钉子数量不多，直接遍历性能没问题)
            this.pegs.forEach(p => {
                // 简单的性能优化：如果Y轴距离太远就不用算平方根了
                if (Math.abs(ball.pos.y - p.pos.y) < LIGHT_RADIUS) {
                    p.calculateLight(ball.pos, LIGHT_RADIUS);
                }
            });
        });
        this.specialSlots = this.specialSlots.filter(s => !s.hit);
        // 繪製特殊槽位
        this.specialSlots.forEach(s => s.draw(this.ctx));
        // --- 更新和绘制光柱 ---
        for (let i = this.collectionBeams.length - 1; i >= 0; i--) {
            const beam = this.collectionBeams[i];
            beam.update(timeScale);
            beam.draw(this.ctx);
            if (beam.life <= 0) this.collectionBeams.splice(i, 1);
        }
        // 更新和繪製下落的彈珠
        for (let i = this.dropBalls.length - 1; i >= 0; i--) {
            const ball = this.dropBalls[i];
            // **重要參數** result: 'finished' (落出屏幕), {type: 'collected', ...}, {type: 'slot', ...}, {action: 'split', ...}
            const result = ball.update(this.pegs, this.specialSlots, this.width, this.height, this.timeScale, tilt);
                
            //  绘制时也可以传入 tilt 做球体高光偏移 (可选)
            ball.draw(this.ctx, tilt);
            
            if (result) {
                // 處理彈珠落出屏幕
                if (result === 'finished') {
                    // 1. 生成光柱 (在球掉落的X轴位置，屏幕底部升起)
                    this.collectionBeams.push(new CollectionBeam(ball.pos.x, this.height));
                    
                    // 2. 触发 UI 卡片高亮
                    // 获取当前正在进行的配方卡片 DOM 元素
                    // 注意：nth-child 是从 1 开始的，activeMarbleIndex 是从 0 开始
                    const activeCardIdx = this.activeMarbleIndex + 1;
                    const activeCard = document.querySelector(`#gathering-hud-mount .recipe-card:nth-child(${activeCardIdx})`);
                    
                    if (activeCard) {
                        // 先移除可能存在的类（以防万一），强制重绘，再添加
                        activeCard.classList.remove('locked-anim');
                        void activeCard.offsetWidth; // 触发 Reflow
                        activeCard.classList.add('locked-anim');
                    }

                    // 3. 播放一个确认音效 (比如 reload 或 magic)
                    audio.playCollect(); // 或者 audio.playTone(800, 'sine', 0.2)
                    // 弹珠落出屏幕
                    console.log('[DEBUG] 弹珠移除 - 移除前 dropBalls:', this.dropBalls.length, 'activeBalls:', this.currentSession.activeBalls);
                    this.dropBalls.splice(i, 1);
                    this.currentSession.activeBalls--;
                    console.log('[DEBUG] 弹珠移除 - 移除后 dropBalls:', this.dropBalls.length, 'activeBalls:', this.currentSession.activeBalls);
                    
                    // --- ：不再直接結算，而是嘗試結算 ---
                    // 處理“能量球先落地，彈珠後死”的情況
                    this.phase_gathering_attemptComplete();

                } else if (result.type === 'collected') {
                    // 彈珠收集到材料
                    this.currentSession.collected.push(result.material);
                    // 这样 UI (renderRecipeCard) 才能读取到变化
                    if (this.marbleQueue[this.activeMarbleIndex]) {
                        this.marbleQueue[this.activeMarbleIndex].collected.push(result.material);
                    }
                    this.spawn_createHitFeedback(ball.pos.x, ball.pos.y, ball.vel, result.material); // 這裡也許要傳入屬性類型作為顏色依據
                    audio.playCollect();
                    this.ui_renderRecipeHUD();
                    
                } else if (result.type === 'slot') {
                    // 彈珠擊中特殊槽位
                    if (result.slotType === 'recall') {
                        // 回溯槽位：將彈珠傳送回頂部
                        ball.pos.y = 50;
                        ball.vel = new Vec2(0, 2);
                        showToast("回溯!");
                    } else if (result.slotType === 'multicast') {
                        // 多重發射槽位：增加多重發射次數
                        if (!this.currentSession.multicastAdded.includes(i)) {
                            this.currentSession.multicast++;
                            this.currentSession.multicastAdded.push(i);
                            showToast("+連射!");
                        }
                    } else if (result.slotType === 'split' && ball.canTriggerSplitSlot) {
                        // 分裂槽位：分裂彈珠
                        ball.canTriggerSplitSlot = false;
                        const newBall = new DropBall(ball.pos.x, ball.pos.y, ball.def, this.currentSession);
                        newBall.vel = new Vec2(-ball.vel.x, ball.vel.y);
                        newBall.canTriggerSplitSlot = false;
                        this.dropBalls.push(newBall);
                        this.currentSession.activeBalls++;
                        showToast("分裂!");
                    } else if (result.slotType === 'relic') {
                        // 調用遺物選擇
                        this.ui_showRelicSelection(); 
                        
                        // 將彈珠移除
                        this.dropBalls.splice(i, 1);
                        this.currentSession.activeBalls--;
                    }
                } else if (result.action === 'split') {
                    // 處理 DropBall 內部觸發的分裂
                    const newBall1 = new DropBall(result.pos.x - 10, result.pos.y, result.def, this.currentSession);
                    const newBall2 = new DropBall(result.pos.x + 10, result.pos.y, result.def, this.currentSession);
                    newBall1.vel = new Vec2(-Math.abs(result.vel.x) - 2, result.vel.y);
                    newBall2.vel = new Vec2(Math.abs(result.vel.x) + 2, result.vel.y);
                    newBall1.canTriggerSplitSlot = false;
                    newBall2.canTriggerSplitSlot = false;
                    this.dropBalls.push(newBall1, newBall2);
                    this.currentSession.activeBalls += 1; 
                    this.dropBalls.splice(i, 1);
                    showToast("分裂!");
                } else if (result.action === 'rainbow_split') {
                    // 處理彩虹彈珠分裂
                    const colors = ['bounce', 'pierce', 'scatter'];
                    if (this.marbleQueue[this.activeMarbleIndex]) {
                        colors.forEach(c => {
                            this.marbleQueue[this.activeMarbleIndex].collected.push(c);
                        });
                    }
                    colors.forEach((c, idx) => {
                        const shardDef = new MarbleDefinition(c);
                        const shard = new DropBall(result.pos.x + (idx - 1) * 20, result.pos.y, shardDef, this.currentSession);
                        shard.vel = new Vec2((idx - 1) * 3, result.vel.y);
                        shard.isRainbowShard = true;
                        this.dropBalls.push(shard);

                        // --- [新增修复]：分裂时直接将对应的材料加入收集列表 ---
                        this.currentSession.collected.push(c);
                    });
                    
                    this.currentSession.activeBalls += 2; // -1 (本体) + 3 (碎片) = +2
                    this.dropBalls.splice(i, 1);
                    
                    // --- [新增修复]：刷新 UI 以显示新收集到的材料 ---
                    this.ui_renderRecipeHUD();
                    
                    showToast("彩虹分裂!");
                }
            }
        } 
        
        // --- 更新和繪製能量球 ---
        for (let i = this.energyOrbs.length - 1; i >= 0; i--) {
            const orb = this.energyOrbs[i];
            orb.update(timeScale);
            orb.draw(this.ctx);
            if (!orb.active) this.energyOrbs.splice(i, 1);
        }
        // 繪製粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(this.timeScale);
            p.draw(this.ctx);
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        // 更新和繪製 Shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            let s = this.shockwaves[i];
            if (s) {
                s.update(timeScale);
                s.draw(this.ctx);
                if (s.alpha <= 0) this.shockwaves.splice(i, 1);
            }
        }
        // 在 updateGathering 的末尾添加对 DOM 的操作
        //const container = document.getElementById('game-container');
        const tx = this.boardTilt.current.x * -10; // 负值产生视差
        const ty = this.boardTilt.current.y * -5;

        // 这里的 transform 会让整个 UI 产生微弱的悬浮感
        container.style.perspective = "1000px";
        // 甚至可以增加旋转感 (谨慎使用，可能会晕)
        container.style.transform = `rotateY(${tx * 0.2}deg) rotateX(${-ty * 0.2}deg)`;

    }
}
/**
 * 调整 Hex 颜色的亮度
 * @param {string} hex - 颜色值 (例如 "#ff0000" 或 "f00")
 * @param {number} factor - 亮度系数 (1.0 = 原色, 0.5 = 变暗50%, 1.5 = 变亮50%)
 * @returns {string} 调整后的 Hex 颜色
 */


// ==================== 创建全局实例 ====================

const audio = new SoundManager();

// ==================== 导出核心类 ====================

export {
    SoundManager,
    Game,
    audio
};
