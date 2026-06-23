/**
 * audio.js - 音频引擎 (重构版 v5 - 纯合成 + Reverb)
 * 
 * 变更记录：
 * - v5: 回归全 Web Audio API 合成音效，移除 WAV/SFX_MAP/_playSfx 逻辑
 *       保留 v4 引入的 Reverb 卷积混响效果器（钉盘弹珠专用）
 *       所有音效方法恢复为纯合成实现
 * - v4: 钉盘弹珠音效改回合成 + 新增 Reverb 卷积混响
 * - v3: WAV 文件驱动，优先使用预加载 AudioBuffer
 * - v2: 延迟初始化，由 core.js 控制实例化时机
 */

class SoundManager {
    /**
     * 声音管理器类，使用 Web Audio API 合成所有音效
     * 钉盘弹珠相关音效额外接入 Reverb 卷积混响效果器
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

        // 白噪声缓冲（rolling sound / shatter / lightning 用）
        this.noiseBuffer = this.createNoiseBuffer();

        // 防抖记录表
        this.lastPlayTime = {};

        // Local preview samples. These files are intentionally kept in
        // assets/audio-local and ignored by git so the remote repo stays clean.
        this.sampleBuffers = {};
        this.sampleLoadPromises = {};
        this.sampleFailed = new Set();
        this.sampleManifest = {
            shoot: 'assets/audio-local/sfx/shoot_laser.wav',
            pegHit: 'assets/audio-local/sfx/hit_peg.wav',
            bounceHit: 'assets/audio-local/sfx/hit_bounce.wav',
            enemyHit: 'assets/audio-local/sfx/enemy_hit.wav',
            slash: 'assets/audio-local/sfx/slash.wav',
            collect: 'assets/audio-local/sfx/collect.wav',
            split: 'assets/audio-local/sfx/split.wav',
            shatter: 'assets/audio-local/sfx/shatter.wav',
            lightning: 'assets/audio-local/sfx/lightning.wav',
            powerup: 'assets/audio-local/sfx/powerup.wav',
            explosion: 'assets/audio-local/sfx/explosion_sub.wav',
        };
        this._preloadLocalSamples();

        // ── Reverb 效果器（钉盘弹珠专用）──
        // 信号链：钉盘音效节点 → pegDryGain(0.6) → masterGain
        //                      ↘ pegWetGain(0.45) → pegReverbNode → masterGain
        this.pegReverbNode = this._createReverbNode(0.8, 2.5); // decay=0.8, duration=2.5s
        this.pegReverbNode.connect(this.masterGain);
        this.pegDryGain = this.ctx.createGain();
        this.pegDryGain.gain.value = 0.6;  // 干声 60%
        this.pegDryGain.connect(this.masterGain);
        this.pegWetGain = this.ctx.createGain();
        this.pegWetGain.gain.value = 0.45; // 湿声 45%
        this.pegWetGain.connect(this.pegReverbNode);
    }

    // ─────────────────────────────────────────────
    //  Reverb 效果器（钉盘弹珠专用）
    // ─────────────────────────────────────────────

    /**
     * 创建卷积混响节点（合成 IR 脉冲响应）
     * @param {number} decay    - 混响衰减系数（越大尾音越长）
     * @param {number} duration - IR 时长（秒）
     * @returns {ConvolverNode}
     */
    _createReverbNode(decay = 0.8, duration = 2.0) {
        const sampleRate = this.ctx.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                // 指数衰减白噪声 IR
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay * 10);
            }
        }
        const convolver = this.ctx.createConvolver();
        convolver.buffer = impulse;
        return convolver;
    }

    /**
     * 将音效增益节点同时接入干声和湿声（Reverb）总线
     * 用于钉盘弹珠相关音效
     * @param {AudioNode} node - 待连接的音效增益节点
     */
    _connectToPegBus(node) {
        node.connect(this.pegDryGain);
        node.connect(this.pegWetGain);
    }

    _preloadLocalSamples() {
        Object.keys(this.sampleManifest).forEach(key => this._loadSample(key));
    }

    _loadSample(key) {
        if (this.sampleBuffers[key]) return Promise.resolve(this.sampleBuffers[key]);
        if (this.sampleLoadPromises[key]) return this.sampleLoadPromises[key];
        if (this.sampleFailed.has(key)) return Promise.resolve(null);

        const url = this.sampleManifest[key];
        if (!url || typeof fetch !== 'function') return Promise.resolve(null);

        const promise = fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))
            .then(buffer => {
                this.sampleBuffers[key] = buffer;
                return buffer;
            })
            .catch(error => {
                this.sampleFailed.add(key);
                if (typeof console !== 'undefined') {
                    console.warn(`[Audio] Local sample unavailable: ${key}`, error);
                }
                return null;
            })
            .finally(() => {
                delete this.sampleLoadPromises[key];
            });

        this.sampleLoadPromises[key] = promise;
        return promise;
    }

    _playSample(key, options = {}) {
        if (this.muted) return true;

        const buffer = this.sampleBuffers[key];
        if (!buffer) {
            this._loadSample(key);
            return false;
        }

        const {
            volume = 0.35,
            rate = 1,
            output = 'master',
            cooldown = 0,
        } = options;
        const perfNow = performance.now();
        const playKey = `sample:${key}`;
        if (cooldown > 0 && this.lastPlayTime[playKey] && perfNow - this.lastPlayTime[playKey] < cooldown) {
            return true;
        }
        this.lastPlayTime[playKey] = perfNow;

        try {
            const now = this.ctx.currentTime;
            const source = this.ctx.createBufferSource();
            const gain = this.ctx.createGain();
            source.buffer = buffer;
            source.playbackRate.setValueAtTime(rate, now);
            gain.gain.setValueAtTime(volume, now);
            source.connect(gain);
            if (output === 'peg') {
                this._connectToPegBus(gain);
            } else {
                gain.connect(this.masterGain);
            }
            source.start(now);
            return true;
        } catch (error) {
            if (typeof console !== 'undefined') {
                console.warn(`[Audio] Local sample playback failed: ${key}`, error);
            }
            return false;
        }
    }

    // ─────────────────────────────────────────────
    //  基础工具
    // ─────────────────────────────────────────────

    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2; // 2秒缓冲
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // ─────────────────────────────────────────────
    //  持续型音效（弹珠滚动）
    // ─────────────────────────────────────────────

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

        // 滚动音接入钉盘 Reverb 总线（干+湿）
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.pegDryGain);
        gainNode.connect(this.pegWetGain);
        source.start();

        return {
            node: source,
            gainNode: gainNode,
            filter: filter,
            ctx: this.ctx,
            // 核心：根据速度更新声音
            update: function(speed) {
                const clampSpeed = Math.min(Math.max(speed, 0), 25);
                const normalizedSpeed = clampSpeed / 25;
                const now = this.ctx.currentTime;
                // 平方曲线让高速时声音增加得更明显，低速保持安静
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

    /**
     * 挂起音频上下文（页面切到后台时调用，停止音频处理以省电降温）
     */
    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }

    // ─────────────────────────────────────────────
    //  通用基础音调
    // ─────────────────────────────────────────────

    /**
     * 播放基础音调
     * @param {number} freq - 频率
     * @param {string} type - 波形类型
     * @param {number} vol  - 音量
     * @param {number} dur  - 持续时间
     */
    playTone(freq, type = 'sine', vol = 0.3, dur = 0.2) {
        if (this.muted) return;
        // [Perf] 30ms 内同 freq+type 只播一次，避免战斗高峰每帧创建数十个 AudioNode
        const _key = `tone:${type}:${freq | 0}`;
        const _nowMs = performance.now();
        if (this.lastPlayTime[_key] && _nowMs - this.lastPlayTime[_key] < 30) return;
        this.lastPlayTime[_key] = _nowMs;
        if (type === 'normal' && this._playSample('pegHit', {
            volume: 0.34,
            rate: 0.92 + Math.min(Math.max(speed, 0), 20) * 0.015,
            output: 'peg',
        })) return;
        if (type === 'bounce' && this._playSample('bounceHit', {
            volume: 0.36,
            rate: 0.96 + Math.min(Math.max(speed, 0), 20) * 0.012,
            output: 'peg',
        })) return;
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
    //  游戏音效方法（全部 Web Audio API 合成）
    // ─────────────────────────────────────────────

    /**
     * 播放打击音效
     * normal / bounce 接入 Reverb 总线，cryo / pyro 直连 masterGain
     * @param {string} type  - 打击类型：'normal' | 'bounce' | 'cryo' | 'pyro' | 'magic'
     * @param {number} speed - 速度（影响音调）
     */
    playHit(type = 'normal', speed = 5) {
        if (this.muted) return;
        // [Perf] 30ms 内同 type 只播一次，平滑撞击高峰的 AudioNode 创建
        const _key = `hit:${type}`;
        const _nowMs = performance.now();
        if (this.lastPlayTime[_key] && _nowMs - this.lastPlayTime[_key] < 30) return;
        this.lastPlayTime[_key] = _nowMs;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        switch(type) {
            // @section:hit_normal - 钉盘碰撞：triangle，速度驱动频率，接入 Reverb
            case 'normal':
                osc.frequency.setValueAtTime(300 + speed * 20, now);
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                this._connectToPegBus(gain);
                osc.start(now);
                osc.stop(now + 0.15);
                return;
            // @section:hit_bounce - 弹壁反弹：triangle，更高频，接入 Reverb
            case 'bounce':
                osc.frequency.setValueAtTime(400 + speed * 30, now);
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                this._connectToPegBus(gain);
                osc.start(now);
                osc.stop(now + 0.15);
                return;
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
            // @section:hit_magic - 魔法钉子：sine 上扬，直连 masterGain
            case 'magic':
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.linearRampToValueAtTime(1200, now + 0.1);
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.1, now);
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
        if (this._playSample('shoot', { volume: 0.38, rate: 1.08, cooldown: 40 })) return;
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

        const sampleKey = hitType === 'lightning' ? 'lightning' : 'enemyHit';
        const sampleRate = hitType === 'pyro' ? 0.88 : (hitType === 'cryo' ? 1.12 : 1);
        if (this._playSample(sampleKey, { volume: 0.28, rate: sampleRate, cooldown: 45 })) return;

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

        if (this._playSample('lightning', { volume: 0.32, rate: 1.14, cooldown: 80 })) return;

        const now = this.ctx.currentTime;

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
        if (this._playSample('explosion', { volume: 0.42, rate: 1.05, cooldown: 120 })) return;
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
        if (this._playSample('powerup', {
            volume: 0.3,
            rate: Math.min(1.7, 0.9 + pitch * 0.06),
            cooldown: 45,
        })) return;
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
        const sampleByEffect = {
            split: 'split',
            shatter: 'shatter',
        };
        if (sampleByEffect[type] && this._playSample(sampleByEffect[type], {
            volume: type === 'shatter' ? 0.36 : 0.3,
            rate: 1,
            cooldown: type === 'shatter' ? 70 : 50,
        })) return;
        const now = this.ctx.currentTime;

        switch(type) {
            // @section:effect_bump - bump：弹球碰撞钉子，sine 200→80Hz + Reverb
            case 'bump': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.connect(gain);
                this._connectToPegBus(gain); // 干+湿 Reverb
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
        if (this._playSample('powerup', { volume: 0.24, rate: 1.28, cooldown: 60 })) return;
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

        if (this._playSample('slash', { volume: 0.34, rate: 1.02, cooldown: 60 })) return;

        const now = this.ctx.currentTime;

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
        // 泛音包络（消失得稍微快一点）
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
        if (this._playSample('collect', { volume: 0.26, rate: 1.08, cooldown: 50 })) return;
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
