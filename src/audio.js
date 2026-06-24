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

        // 音量状态（0-1 范围）
        this.sfxVolume = 1.0;
        this.bgmVolume = 1.0;

        // 1. 创建主音量节点
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;

        // 2. 创建音效和音乐独立增益节点
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxVolume;
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this.bgmVolume;

        // 3. 创建动态压缩器（防止爆音）
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

        // 4. 连接链路：sfxGain/bgmGain -> Master -> Compressor -> 扬声器
        this.sfxGain.connect(this.masterGain);
        this.bgmGain.connect(this.masterGain);
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
            shoot_laser_1: 'assets/audio-local/sfx/shoot_laser_1.wav',
            shoot_laser_2: 'assets/audio-local/sfx/shoot_laser_2.wav',
            shoot_laser_5: 'assets/audio-local/sfx/shoot_laser_5.wav',
            shoot_zip_1: 'assets/audio-local/sfx/shoot_zip_1.wav',
            hit_peg_2: 'assets/audio-local/sfx/hit_peg_2.wav',
            hit_peg_3: 'assets/audio-local/sfx/hit_peg_3.wav',
            hit_peg_4: 'assets/audio-local/sfx/hit_peg_4.wav',
            hit_bounce_7: 'assets/audio-local/sfx/hit_bounce_7.wav',
            hit_switch_3: 'assets/audio-local/sfx/hit_switch_3.wav',
            enemy_hit_1: 'assets/audio-local/sfx/enemy_hit_1.wav',
            enemy_hit_5: 'assets/audio-local/sfx/enemy_hit_5.wav',
            enemy_hit_6: 'assets/audio-local/sfx/enemy_hit_6.wav',
            slash_swoosh_1: 'assets/audio-local/sfx/slash_swoosh_1.wav',
            slash_swoosh_2: 'assets/audio-local/sfx/slash_swoosh_2.wav',
            slash_swoosh_3: 'assets/audio-local/sfx/slash_swoosh_3.wav',
            slash_zip_2: 'assets/audio-local/sfx/slash_zip_2.wav',
            collect_bell_4: 'assets/audio-local/sfx/collect_bell_4.wav',
            collect_bell_5: 'assets/audio-local/sfx/collect_bell_5.wav',
            collect_switch_1: 'assets/audio-local/sfx/collect_switch_1.wav',
            split_glitch_2: 'assets/audio-local/sfx/split_glitch_2.wav',
            split_glitch_3: 'assets/audio-local/sfx/split_glitch_3.wav',
            split_glitch_4: 'assets/audio-local/sfx/split_glitch_4.wav',
            shatter_artifact_1: 'assets/audio-local/sfx/shatter_artifact_1.wav',
            shatter_artifact_3: 'assets/audio-local/sfx/shatter_artifact_3.wav',
            shatter_artifact_5: 'assets/audio-local/sfx/shatter_artifact_5.wav',
            lightning_laser_3: 'assets/audio-local/sfx/lightning_laser_3.wav',
            lightning_laser_4: 'assets/audio-local/sfx/lightning_laser_4.wav',
            explosion_sub_16: 'assets/audio-local/sfx/explosion_sub_16.wav',
            explosion_sub_18: 'assets/audio-local/sfx/explosion_sub_18.wav',
            explosion_sub_19: 'assets/audio-local/sfx/explosion_sub_19.wav',
        };
        this.sampleGroups = {
            shootCore: ['shoot_laser_1', 'shoot_laser_2', 'shoot_laser_5'],
            shootTransient: ['shoot_zip_1'],
            pegCore: ['hit_peg_2', 'hit_peg_3', 'hit_peg_4'],
            bounceCore: ['hit_bounce_7', 'hit_switch_3'],
            enemyCore: ['enemy_hit_1', 'enemy_hit_5', 'enemy_hit_6'],
            slashCore: ['slash_swoosh_1', 'slash_swoosh_2', 'slash_swoosh_3'],
            slashTransient: ['slash_zip_2'],
            collectCore: ['collect_bell_4', 'collect_bell_5', 'collect_switch_1'],
            splitCore: ['split_glitch_2', 'split_glitch_3', 'split_glitch_4'],
            shatterCore: ['shatter_artifact_1', 'shatter_artifact_3', 'shatter_artifact_5'],
            lightningCore: ['lightning_laser_3', 'lightning_laser_4'],
            explosionCore: ['explosion_sub_16', 'explosion_sub_18', 'explosion_sub_19'],
            powerupCore: ['collect_bell_4', 'collect_bell_5'],
        };
        this.sampleRoundRobin = {};
        this._preloadLocalSamples();

        // ── Reverb 效果器（钉盘弹珠专用）──
        // 信号链：钉盘音效节点 → pegDryGain(0.6) → sfxGain
        //                      ↘ pegWetGain(0.45) → pegReverbNode → sfxGain
        this.pegReverbNode = this._createReverbNode(0.8, 2.5); // decay=0.8, duration=2.5s
        this.pegReverbNode.connect(this.sfxGain);
        this.pegDryGain = this.ctx.createGain();
        this.pegDryGain.gain.value = 0.6;  // 干声 60%
        this.pegDryGain.connect(this.sfxGain);
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

    _rand(min, max) {
        return min + Math.random() * (max - min);
    }

    _resolveRange(value) {
        return Array.isArray(value) ? this._rand(value[0], value[1]) : value;
    }

    _pickSampleKey(keyOrGroup) {
        const group = this.sampleGroups[keyOrGroup];
        if (!group || group.length === 0) return keyOrGroup;

        const cursor = this.sampleRoundRobin[keyOrGroup] || 0;
        const jitter = Math.floor(Math.random() * group.length);
        const index = (cursor + jitter) % group.length;
        this.sampleRoundRobin[keyOrGroup] = (cursor + 1) % group.length;
        return group[index];
    }

    _connectOutput(node, output = 'master') {
        if (output === 'peg') {
            this._connectToPegBus(node);
        } else {
            node.connect(this.sfxGain);
        }
    }

    _playSample(key, options = {}) {
        if (this.muted) return true;

        const sampleKey = this._pickSampleKey(key);
        const buffer = this.sampleBuffers[sampleKey];
        if (!buffer) {
            this._loadSample(sampleKey);
            return false;
        }

        const {
            volume = 0.35,
            rate = 1,
            delay = 0,
            output = 'master',
            cooldown = 0,
            duration = null,
            fadeOut = null,
        } = options;
        const perfNow = performance.now();
        const playKey = `sample:${key}`;
        if (cooldown > 0 && this.lastPlayTime[playKey] && perfNow - this.lastPlayTime[playKey] < cooldown) {
            return true;
        }
        this.lastPlayTime[playKey] = perfNow;

        try {
            const now = this.ctx.currentTime;
            const startAt = now + Math.max(0, delay);
            const source = this.ctx.createBufferSource();
            const gain = this.ctx.createGain();
            source.buffer = buffer;
            source.playbackRate.setValueAtTime(this._resolveRange(rate), startAt);
            gain.gain.setValueAtTime(this._resolveRange(volume), startAt);
            if (fadeOut) {
                gain.gain.exponentialRampToValueAtTime(0.001, startAt + fadeOut);
            }
            source.connect(gain);
            this._connectOutput(gain, output);
            source.start(startAt);
            if (duration) source.stop(startAt + duration);
            return true;
        } catch (error) {
            if (typeof console !== 'undefined') {
                console.warn(`[Audio] Local sample playback failed: ${key}`, error);
            }
            return false;
        }
    }

    _playToneLayer({
        type = 'sine',
        freq = 220,
        endFreq = null,
        volume = 0.1,
        duration = 0.2,
        delay = 0,
        output = 'master',
        attack = 0.004,
        curve = 'exp',
    } = {}) {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        const startAt = now + Math.max(0, delay);
        const endAt = startAt + duration;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        const startFreq = Math.max(1, this._resolveRange(freq));
        osc.frequency.setValueAtTime(startFreq, startAt);
        if (endFreq !== null) {
            const targetFreq = Math.max(1, this._resolveRange(endFreq));
            if (curve === 'linear') {
                osc.frequency.linearRampToValueAtTime(targetFreq, endAt);
            } else {
                osc.frequency.exponentialRampToValueAtTime(targetFreq, endAt);
            }
        }
        const targetVol = Math.max(0.001, this._resolveRange(volume));
        gain.gain.setValueAtTime(0.001, startAt);
        gain.gain.linearRampToValueAtTime(targetVol, startAt + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, endAt);
        osc.connect(gain);
        this._connectOutput(gain, output);
        osc.start(startAt);
        osc.stop(endAt + 0.03);
    }

    _playNoiseLayer({
        volume = 0.1,
        duration = 0.2,
        delay = 0,
        output = 'master',
        filterType = 'lowpass',
        freq = 1400,
        endFreq = null,
    } = {}) {
        if (this.muted) return;
        const now = this.ctx.currentTime;
        const startAt = now + Math.max(0, delay);
        const endAt = startAt + duration;
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        source.buffer = this.noiseBuffer;
        filter.type = filterType;
        filter.frequency.setValueAtTime(Math.max(1, this._resolveRange(freq)), startAt);
        if (endFreq !== null) {
            filter.frequency.exponentialRampToValueAtTime(Math.max(1, this._resolveRange(endFreq)), endAt);
        }
        gain.gain.setValueAtTime(Math.max(0.001, this._resolveRange(volume)), startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, endAt);
        source.connect(filter);
        filter.connect(gain);
        this._connectOutput(gain, output);
        source.start(startAt);
        source.stop(endAt + 0.02);
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

    /**
     * 设置音效音量（0-1 范围）
     * @param {number} volume - 音量值
     */
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }

    /**
     * 设置音乐音量（0-1 范围）
     * @param {number} volume - 音量值
     */
    setBgmVolume(volume) {
        this.bgmVolume = Math.max(0, Math.min(1, volume));
        this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    }

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
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(this.sfxGain);
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
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    /**
     * 播放射击音效
     */
    playShoot() {
        if (this.muted) return;
        this._playToneLayer({
            type: 'sine',
            freq: [105, 135],
            endFreq: 55,
            volume: 0.055,
            duration: 0.12,
        });
        this._playSample('shootCore', {
            volume: [0.26, 0.34],
            rate: [0.96, 1.12],
            cooldown: 40,
            fadeOut: 0.22,
        });
        this._playSample('shootTransient', {
            volume: [0.12, 0.18],
            rate: [1.05, 1.28],
            delay: 0.005,
            fadeOut: 0.08,
        });
        this._playNoiseLayer({
            volume: 0.035,
            duration: 0.09,
            filterType: 'highpass',
            freq: [1800, 2600],
        });
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

        const sampleRate = hitType === 'pyro' ? [0.84, 0.94] : (hitType === 'cryo' ? [1.08, 1.22] : [0.94, 1.08]);
        this._playToneLayer({
            type: 'sine',
            freq: hitType === 'pyro' ? [70, 95] : [85, 125],
            endFreq: hitType === 'cryo' ? [90, 120] : [38, 58],
            volume: hitType === 'lightning' ? 0.035 : 0.055,
            duration: 0.14,
        });
        this._playSample(hitType === 'lightning' ? 'lightningCore' : 'enemyCore', {
            volume: hitType === 'lightning' ? [0.16, 0.22] : [0.22, 0.3],
            rate: sampleRate,
            cooldown: 45,
            fadeOut: 0.2,
        });
        this._playNoiseLayer({
            volume: hitType === 'cryo' ? 0.045 : 0.03,
            duration: hitType === 'lightning' ? 0.08 : 0.12,
            filterType: 'highpass',
            freq: hitType === 'lightning' ? [2600, 4200] : [1300, 2300],
        });
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

        this._playSample('lightningCore', {
            volume: [0.22, 0.3],
            rate: [1.08, 1.24],
            cooldown: 80,
            fadeOut: 0.18,
        });
        this._playNoiseLayer({
            volume: 0.12,
            duration: 0.16,
            filterType: 'highpass',
            freq: [2600, 4200],
            endFreq: 900,
        });
        this._playToneLayer({
            type: 'square',
            freq: [2800, 3400],
            endFreq: [180, 260],
            volume: 0.035,
            duration: 0.13,
            attack: 0.001,
        });
    }

    /**
     * 播放爆炸音效
     */
    playExplosion() {
        if (this.muted) return;
        this._playToneLayer({
            type: 'sine',
            freq: [68, 88],
            endFreq: [28, 38],
            volume: 0.16,
            duration: 0.42,
            attack: 0.002,
        });
        this._playSample('explosionCore', {
            volume: [0.26, 0.36],
            rate: [0.88, 1.06],
            cooldown: 120,
            fadeOut: 0.65,
        });
        this._playNoiseLayer({
            volume: 0.18,
            duration: 0.34,
            filterType: 'lowpass',
            freq: [1800, 2600],
            endFreq: [120, 180],
        });
    }

    /**
     * 播放能量提升音效
     * @param {number} pitch - 音调等级
     */
    playPowerup(pitch = 1) {
        if (this.muted) return;
        const pitchRate = Math.min(1.7, 0.9 + pitch * 0.06);
        this._playSample('powerupCore', {
            volume: [0.18, 0.26],
            rate: [pitchRate * 0.96, pitchRate * 1.06],
            cooldown: 45,
            fadeOut: 0.35,
        });
        this._playToneLayer({
            type: 'sine',
            freq: 360 + pitch * 42,
            endFreq: 760 + pitch * 72,
            volume: 0.065,
            duration: 0.32,
            curve: 'linear',
        });
        this._playToneLayer({
            type: 'triangle',
            freq: 840 + pitch * 80,
            endFreq: 1260 + pitch * 120,
            volume: 0.035,
            duration: 0.18,
            delay: 0.045,
            curve: 'linear',
        });
    }

    /**
     * 播放特殊效果音
     * @param {string} type - 效果类型
     */
    playEffect(type) {
        if (this.muted) return;
        if (type === 'split') {
            this._playSample('splitCore', {
                volume: [0.2, 0.3],
                rate: [0.92, 1.16],
                cooldown: 50,
                fadeOut: 0.22,
            });
            this._playToneLayer({
                type: 'triangle',
                freq: [560, 720],
                endFreq: [980, 1240],
                volume: 0.045,
                duration: 0.18,
                curve: 'linear',
            });
            this._playNoiseLayer({
                volume: 0.035,
                duration: 0.1,
                filterType: 'highpass',
                freq: [1800, 3200],
            });
            return;
        }
        if (type === 'shatter') {
            this._playToneLayer({
                type: 'sine',
                freq: [120, 160],
                endFreq: [48, 68],
                volume: 0.065,
                duration: 0.16,
            });
            this._playSample('shatterCore', {
                volume: [0.24, 0.34],
                rate: [0.88, 1.12],
                cooldown: 70,
                fadeOut: 0.22,
            });
            this._playNoiseLayer({
                volume: 0.12,
                duration: 0.2,
                filterType: 'highpass',
                freq: [2200, 3800],
                endFreq: [900, 1300],
            });
            return;
        }
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
                gain.connect(this.sfxGain);
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
                gain.connect(this.sfxGain);
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
                gain.connect(this.sfxGain);
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
                gain.connect(this.sfxGain);
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
                noiseGain.connect(this.sfxGain);
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
        this._playSample('powerupCore', {
            volume: [0.12, 0.2],
            rate: [1.18, 1.36],
            cooldown: 60,
            fadeOut: 0.32,
        });
        this._playToneLayer({
            type: 'sine',
            freq: [720, 860],
            endFreq: [1120, 1360],
            volume: 0.06,
            duration: 0.16,
            curve: 'linear',
        });
        this._playToneLayer({
            type: 'triangle',
            freq: [1100, 1400],
            endFreq: [520, 680],
            volume: 0.035,
            duration: 0.28,
            delay: 0.08,
        });
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

        this._playToneLayer({
            type: 'sine',
            freq: [120, 160],
            endFreq: [48, 70],
            volume: 0.05,
            duration: 0.22,
        });
        this._playSample('slashCore', {
            volume: [0.22, 0.32],
            rate: [0.92, 1.12],
            cooldown: 60,
            fadeOut: 0.34,
        });
        this._playSample('slashTransient', {
            volume: [0.12, 0.2],
            rate: [1.0, 1.28],
            delay: 0.012,
            fadeOut: 0.12,
        });
        this._playToneLayer({
            type: 'sawtooth',
            freq: [780, 980],
            endFreq: [180, 260],
            volume: 0.055,
            duration: 0.18,
            attack: 0.001,
        });
    }

    /**
     * 播放收集音效
     */
    playCollect() {
        if (this.muted) return;
        this._playSample('collectCore', {
            volume: [0.16, 0.24],
            rate: [1.0, 1.18],
            cooldown: 50,
            fadeOut: 0.28,
        });
        this._playToneLayer({
            type: 'sine',
            freq: [620, 760],
            endFreq: [980, 1180],
            volume: 0.04,
            duration: 0.22,
            curve: 'linear',
        });
        this._playToneLayer({
            type: 'triangle',
            freq: [1240, 1480],
            endFreq: [1620, 1900],
            volume: 0.022,
            duration: 0.16,
            delay: 0.035,
            curve: 'linear',
        });
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
        if (prop === 'sfxVolume') return 1.0;
        if (prop === 'bgmVolume') return 1.0;
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
