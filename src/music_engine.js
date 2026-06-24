/**
 * music_engine.js - 暗黑炼金 Psytrance 实时音乐引擎（纯合成 / 零采样 / 零依赖）
 *
 * 设计要点：
 * - 复用 SoundManager 的 AudioContext / masterGain / noiseBuffer / _createReverbNode，
 *   不新建 AudioContext，不引入任何第三方库或音频文件。
 * - 用 "lookahead scheduler"（Chris Wilson «A Tale of Two Clocks»）做精确节拍：
 *   setTimeout 只负责"醒来看一眼"，所有发声用 ctx.currentTime + osc.start(t) 提前排程。
 * - 音色全部是 Psytrance 标志性的纯合成：合成 kick、谐振滚动 bass、sidechain 泵感、
 *   FM 金属 lead、噪声 hi-hat、失谐暗黑 drone。
 * - 自适应：setIntensity(0~1) 做垂直叠层（低=kick+bass 底；高=加 hat/lead/更亮滤波）。
 * - 总音量：所有总线先汇入 musicGain 子主控，再进 masterGain，便于一键调小整段音乐。
 * - 变体：按小节(bar)推进，轮换 bass 句式 / 缓慢移根 / 加花镲与补 kick / 变化 lead，
 *   避免 16 步死循环的单调感。
 *
 * 用法（见 core.js initAudio）：
 *   const music = new MusicEngine(soundManagerInstance);
 *   music.start();                 // 在首次用户交互后（ctx 已 running）
 *   music.setIntensity(1.0);       // 进战斗
 *   music.setBpm(156);             // Boss 提速
 *   music.setVolume(0.4);          // 整段音乐调小
 *   music.stop();
 */

class MusicEngine {
    /**
     * @param {SoundManager} soundManager - 已初始化的 SoundManager 实例
     */
    constructor(soundManager) {
        this.sm = soundManager;
        this.ctx = soundManager.ctx;
        this.out = soundManager.bgmGain;   // → bgmGain → masterGain → compressor → destination（含 mute + bgm 音量控制）

        // ── 音乐子主控（统一控制整段音乐响度，独立于游戏音效）──
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.5;       // 默认偏小，避免盖过音效
        // 注意：musicGain 不直接进 out，而是先过母线饱和"胶水"（见下方 §效果器机架(4)）

        // ── 乐器总线（音量整体下调，再经 musicGain）──
        this._bassGain = 0.7;                  // bass 常态增益（duck 时围绕它升降）
        this.drumBus = this.ctx.createGain();  this.drumBus.gain.value = 0.72;
        this.bassBus = this.ctx.createGain();  this.bassBus.gain.value = this._bassGain;
        this.hatBus  = this.ctx.createGain();  this.hatBus.gain.value  = 0.18;
        this.leadBus = this.ctx.createGain();  this.leadBus.gain.value = 0.0; // 由 intensity 控制
        this.droneBus = this.ctx.createGain(); this.droneBus.gain.value = 0.13;

        // ── 侧链泵压总线（pumpBus）──
        // bass + lead + drone 的"干声"汇入此处，被每记 kick 侧链下压再回弹（整段随 kick 呼吸）。
        // kick(drumBus) / hat / fx 不进泵：kick 要穿透、镲与过渡音要持续推进。
        this.pumpBus = this.ctx.createGain(); this.pumpBus.gain.value = 1.0;
        this._pumpDepth = 0.36;                // 每记 kick 把 pumpBus 压到的最低值（intensity 越高越深）
        this.pumpBus.connect(this.musicGain);

        // ── 干净 sub 总线：bass 的正弦 sub 层走此处，绕过 bass 失真/EQ 链，仅进侧链泵 ──
        // 让低端保持干净紧致（规范"sub 干净"），中频咆哮才去吃失真。
        this.subBus = this.ctx.createGain(); this.subBus.gain.value = 0.6;
        this.subBus.connect(this.pumpBus);

        this.drumBus.connect(this.musicGain);  // kick 不被侧链（要穿透）
        // bassBus 先过失真 + EQ 再进 pumpBus（见 §效果器机架(1)）
        this.hatBus.connect(this.musicGain);   // hat 不被侧链（持续推进）

        // 过渡特效总线（段落切换：riser / downlifter / impact），独立于乐器层
        this.fxBus = this.ctx.createGain(); this.fxBus.gain.value = 0.9;
        this.fxBus.connect(this.musicGain);

        // ════════════ 效果器机架（参考规范文档 §效果器的运用）════════════
        // 规范要点：合成 IR 混响 / 乒乓立体声延迟(fb≈0.4) / WaveShaper 失真饱和 /
        //          频率管理 EQ(切 ~300Hz 浑浊) / 母线胶水饱和；并用 RTPC 把
        //          失真驱动量、回声送量绑到游戏强度(intensity)。全程零采样、零依赖。

        // (1) Bass 失真 + 频率管理 EQ —— 规范"sub 干净 / 中频失真咆哮"+"切 300Hz 浑浊"
        //     bassBus → bassDrive(驱动量, 受 intensity RTPC) → bassShaper(tanh 软削波)
        //             → bassEQ(300Hz peaking 衰减) → musicGain
        this.bassDrive  = this.ctx.createGain(); this.bassDrive.gain.value = 1.2;
        this.bassShaper = this.ctx.createWaveShaper();
        this.bassShaper.curve = this._makeSoftClipCurve(3.0);
        this.bassShaper.oversample = '2x';
        this.bassEQ = this.ctx.createBiquadFilter();
        this.bassEQ.type = 'peaking';
        this.bassEQ.frequency.value = 300;     // 切中低浑浊频段
        this.bassEQ.Q.value = 1.1;
        this.bassEQ.gain.value = -6;           // dB 衰减
        this.bassBus.connect(this.bassDrive);
        this.bassDrive.connect(this.bassShaper);
        this.bassShaper.connect(this.bassEQ);
        this.bassEQ.connect(this.pumpBus);     // bass 进侧链泵

        // (2) 乒乓立体声延迟 —— 规范"signature echo + 立体声宽度"，feedback 0.4 左右交叉
        //     send ← lead + hat；dA→左声道，dB→右声道，dA↔dB 交叉反馈
        this.delaySend = this.ctx.createGain(); this.delaySend.gain.value = 0.25;
        const eighth0 = (60 / 148) / 2;        // 默认 148bpm 的八分音符（_syncDelay 会按实时 bpm 更新）
        const dA = this.ctx.createDelay(1.0); dA.delayTime.value = eighth0;
        const dB = this.ctx.createDelay(1.0); dB.delayTime.value = eighth0;
        const dfb = this.ctx.createGain(); dfb.gain.value = 0.4;   // 反馈量
        const panL = this.ctx.createStereoPanner(); panL.pan.value = -1;
        const panR = this.ctx.createStereoPanner(); panR.pan.value =  1;
        this._delayA = dA; this._delayB = dB;
        this.delaySend.connect(dA);
        dA.connect(dB);
        dB.connect(dfb); dfb.connect(dA);      // 交叉反馈 → 左右乒乓
        dA.connect(panL); dB.connect(panR);
        panL.connect(this.musicGain); panR.connect(this.musicGain);
        this.leadBus.connect(this.delaySend); // 嘶吼带回声
        this.hatBus.connect(this.delaySend);  // 镲带宽度

        // (3) 合成 IR 混响（保留，零采样）：lead + drone + fx 的湿声
        this.reverb = soundManager._createReverbNode(0.7, 2.2);
        const wet = this.ctx.createGain(); wet.gain.value = 0.32;
        this._wet = wet;
        this.reverb.connect(this.musicGain);
        this.leadBus.connect(this.pumpBus);    // 干（进侧链泵）
        this.leadBus.connect(wet);             // 湿（混响尾不泵，自然呼吸）
        this.droneBus.connect(this.pumpBus);   // 干（进侧链泵）
        this.droneBus.connect(wet);
        this.fxBus.connect(wet);               // 过渡音也吃一点混响空间
        // 清理混响低频浑浊：湿声先高通再进混响（不混响低频，保持低端干净）
        this._wetHPF = this.ctx.createBiquadFilter();
        this._wetHPF.type = 'highpass'; this._wetHPF.frequency.value = 250;
        wet.connect(this._wetHPF); this._wetHPF.connect(this.reverb);

        // (4) 母线胶水 —— 规范 master glue：先温和总线压缩（统一动态、收住峰值），
        //     再过 tanh 软削波饱和；slow-ish attack 放过 kick 瞬态，保留冲击力。
        this.musicComp = this.ctx.createDynamicsCompressor();
        this.musicComp.threshold.value = -18;  // dB，超过即压
        this.musicComp.knee.value = 6;         // 软拐点
        this.musicComp.ratio.value = 2.8;      // 温和胶水比
        this.musicComp.attack.value = 0.006;   // 6ms，放过 kick 瞬态
        this.musicComp.release.value = 0.18;
        this.masterSat = this.ctx.createWaveShaper();
        this.masterSat.curve = this._makeSoftClipCurve(1.6);
        this.masterSat.oversample = '2x';
        this.musicGain.connect(this.musicComp);
        this.musicComp.connect(this.masterSat);
        this.masterSat.connect(this.out);

        // ── 节拍 / 状态 ──
        this.bpm = 148;            // darkpsy 区间（145–160）
        this._bpmTarget = 148;     // 速度过渡目标：scheduler 每次唤醒朝它平滑靠拢
        this._bpmGlide = 0.06;     // 靠拢比例（越大越快；snap 时与 bpm 相等无动作）
        this.rootFreq = 55;        // A1（暗、稳）
        this.intensity = 0.45;     // 0~1 自适应强度
        this.playing = false;
        this._step = 0;            // 0~15（16 分音符）
        this._bar = 0;             // 小节计数（驱动变体）
        this._rootOffset = 0;      // 当前移根半音偏移（缓慢变化）
        this._nextStepTime = 0;
        this._timer = null;
        this._drone = null;        // 持续 drone 的节点引用（start 时创建，stop 时释放）

        // 滚动 bass 的半音偏移序列（仅在非 kick 步生效；以小调 / 暗色为主）
        // 0=根音, 12=高八度根, 3=小三度, 7=纯五度, 10=小七度。null=kick 步留空。
        // 多套句式，按小节轮换，制造律动变化。
        this._bassPatterns = [
            [ null, 0, 0, 0,   null, 0, 12, 0,   null, 0, 3, 0,   null, 7, 0, 10 ],
            [ null, 0, 0, 12,  null, 0, 0, 0,    null, 3, 0, 0,   null, 0, 7, 0  ],
            [ null, 0, 3, 0,   null, 0, 0, 7,    null, 0, 0, 0,   null, 12, 0, 10 ],
            [ null, 0, 0, 0,   null, 7, 0, 0,    null, 0, 10, 0,  null, 0, 3, 12 ],
        ];
        this._activePattern = this._bassPatterns[0];

        // 缓慢移根：每个乐句（4 小节）取一个半音偏移，整体仍暗色不跳脱
        this._rootCycle = [0, 0, 3, 0];

        // lead 落点的高音偏移（相对当前根，半音），按乐句轮换音高
        this._leadNotes = [36, 36, 39, 43];

        // lead drive 软削波曲线（缓存：每个音符复用，避免重建 1024 点数组）
        this._leadDriveCurve = this._makeSoftClipCurve(4.0);

        // ── Boss profile 层（profile=null 时全部走原有通用逻辑，向后兼容）──
        this.profile = null;        // 当前 boss profile 对象（null=通用 darkpsy）
        this.bossId = null;         // 当前 boss id
        this.section = 'calm';      // 'calm'（常态）| 'rage'（狂暴）
        this._padChord = [0, 3, 7, 12]; // ooh 铺垫和弦（profile 可覆盖）
        this._bassFill = 'auto';    // bass 织体：auto/offbeat/sparse/pedal/straight8/driving16/avalanche
        this._sig = {};             // 当前段落签名行为开关集合
        this._drumShaker = true;    // 顶层沙锤 shimmer 层（devourer 关）
        this._drumTom = false;      // 反拍 tom 滚（tesla 狂暴开，经 sig.tomRoll）
        this._kickHalf = false;     // 半拍 kick（devourer：疏而重）
        this._allowLead = true;     // 是否允许 FM lead 点缀层（默认开=向后兼容）
        this._allowOoh = true;      // 是否允许 ooh 铺垫层（默认开=向后兼容）
        this._driftCycle = null;    // 根音漂移序列（chimera 失稳；null=回退 _rootCycle）
        this._fxCycleDeg = null;    // FX 循环动机音级（ouroboros：b2/b5/6）
        this._fxCycleIdx = 0;       // FX 循环动机轮转游标

        // ── 威胁/逼近轴（敌人逼近警戒线：距离 distance + 数量 count → 紧张危机）──
        // threat 0~1：一条连续可逆的"迫近"轴，叠加在 intensity / boss 狂暴之上。
        // 数量 count 走 setIntensity 的密度阶梯；距离 distance 走本轴（迫近啸叫 + 加速心跳 + drone 失谐）。
        this.threat = 0;            // 当前威胁等级（连续，可逆）
        this._baseIntensity = 0.45; // setIntensity 设的"地板"强度（与 threat 取较大者）
        this._threatZone = 'safe';  // 警戒分区：safe / caution / danger / critical
        this._approach = null;      // 迫近啸叫语音节点（噪声带通 riser + 正弦 whine）
        this._threatToBoss = true;  // 告破(critical)是否强推 boss 狂暴 setRage(true)
    }

    // ─────────────────────────────────────────────
    //  音高工具
    // ─────────────────────────────────────────────

    /** 当前根音上偏移 semis 半音后的频率（含缓慢移根） */
    _noteFreq(semis) {
        return this.rootFreq * Math.pow(2, (this._rootOffset + semis) / 12);
    }

    // ─────────────────────────────────────────────
    //  效果器工具（WaveShaper 曲线 / 延迟同步）
    // ─────────────────────────────────────────────

    /** tanh 软削波曲线：k 越大失真越猛（bass 用 ~3，母线胶水用 ~1.6）。1024 点。 */
    _makeSoftClipCurve(k = 3) {
        const n = 1024, curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * 2 - 1;   // 映射到 -1..1
            curve[i] = Math.tanh(k * x);
        }
        return curve;
    }

    /** 把乒乓延迟时间对齐到当前 bpm 的八分音符（变速时调用，保持回声踩点） */
    _syncDelay() {
        if (!this._delayA) return;
        const t = this.ctx.currentTime;
        const eighth = (60 / this.bpm) / 2;
        this._delayA.delayTime.setTargetAtTime(eighth, t, 0.05);
        this._delayB.delayTime.setTargetAtTime(eighth, t, 0.05);
    }

    // ─────────────────────────────────────────────
    //  合成音色（每个 voice 都是一次性 Osc/Buffer，播完即弃）
    // ─────────────────────────────────────────────

    /** 合成 Kick：sine 下扫频率包络 + 快增益包络 + 1.2kHz click 瞬态 */
    playKick(t, gain = 1.0) {
        const c = this.ctx;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(g); g.connect(this.drumBus);
        o.start(t); o.stop(t + 0.2);

        const ck = c.createOscillator(), cg = c.createGain();
        ck.type = 'square'; ck.frequency.setValueAtTime(1200, t);
        cg.gain.setValueAtTime(0.3 * gain, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        ck.connect(cg); cg.connect(this.drumBus);
        ck.start(t); ck.stop(t + 0.03);
    }

    /** 滚动 Bass（优化版 · 规范"sub 干净 / 中频失真咆哮"双层）：
     *  ① 干净正弦 sub → subBus（绕过失真链，仅进侧链泵，随 kick 呼吸）→ 稳住低端；
     *  ② 双失谐锯齿"咆哮"中频 → 高通(让出低端给 sub) → 谐振低通(滤波包络 squelch)
     *     → bassBus(失真 + 300Hz EQ 链)；A/R≈0、短衰减、无 sustain（Psy 标志）。 */
    playBass(t, freq) {
        const c = this.ctx;

        // ① 干净 sub 正弦（清低频，不进失真）
        const sub = c.createOscillator(), subG = c.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(freq, t);
        subG.gain.setValueAtTime(0, t);
        subG.gain.linearRampToValueAtTime(0.9, t + 0.004);
        subG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        sub.connect(subG); subG.connect(this.subBus);
        sub.start(t); sub.stop(t + 0.17);

        // ② 中频咆哮：双失谐锯齿 → 高通(120Hz) → 谐振低通(滤波包络) → bassBus(失真+EQ)
        const oA = c.createOscillator(), oB = c.createOscillator();
        const hp = c.createBiquadFilter(), f = c.createBiquadFilter(), g = c.createGain();
        oA.type = 'sawtooth'; oB.type = 'sawtooth';
        oA.frequency.setValueAtTime(freq, t);
        oB.frequency.setValueAtTime(freq, t); oB.detune.value = 14;   // 轻微失谐增厚
        hp.type = 'highpass'; hp.frequency.value = 120;               // 去低频，低端交给 sub
        f.type = 'lowpass'; f.Q.value = 9;
        const peak = 900 + this.intensity * 1600;                     // intensity 越高滤波越亮
        f.frequency.setValueAtTime(peak, t);
        f.frequency.exponentialRampToValueAtTime(140, t + 0.12);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.6, t + 0.002);               // A≈2ms
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);         // 短衰减、无 sustain
        oA.connect(hp); oB.connect(hp); hp.connect(f); f.connect(g); g.connect(this.bassBus);
        oA.start(t); oB.start(t); oA.stop(t + 0.16); oB.stop(t + 0.16);
    }

    /** 侧链压缩泵感：每记 kick 把 pumpBus（bass+lead+drone 干声）瞬间下压，
     *  再以指数曲线回弹（仿压缩器 release），回弹时长随 bpm 同步 → 整段随 kick 呼吸。 */
    duck(t) {
        const p = this.pumpBus.gain;
        const beat = 60 / this.bpm;
        p.cancelScheduledValues(t);
        p.setValueAtTime(this._pumpDepth, t);     // attack≈0，瞬间下压
        p.setTargetAtTime(1.0, t, beat * 0.18);   // 指数回弹（release 随拍速）
    }

    /** 噪声 hi-hat：noiseBuffer → 高通 → 快衰减 */
    playHat(t, open = false, gain = 0.6) {
        if (!this.sm.noiseBuffer) return;
        const c = this.ctx;
        const src = c.createBufferSource(); src.buffer = this.sm.noiseBuffer;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
        const g = c.createGain();
        const dur = open ? 0.12 : 0.04;
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(hp); hp.connect(g); g.connect(this.hatBus);
        src.start(t); src.stop(t + dur + 0.02);
    }

    /** 沙锤 shaker（顶层 16 分 shimmer，参考 DrumGridDensityRamp 的 maracas/shaker 密度层）：
     *  比 hat 更高通、软起音、更短更轻 → maracas 般"沙沙"质感，仅在高强度叠入填满细分。 */
    playShaker(t) {
        if (!this.sm.noiseBuffer) return;
        const c = this.ctx;
        const src = c.createBufferSource(); src.buffer = this.sm.noiseBuffer;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 9000;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.005);     // 软起音（沙沙感，区别于 hat 的 click）
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        src.connect(hp); hp.connect(g); g.connect(this.hatBus);
        src.start(t); src.stop(t + 0.07);
    }

    /** "Voice Ooh" 律动铺垫（参考 VoiceOohsCloudDensityRamp）：失谐双锯齿 → 低通 + 500Hz 元音共鸣峰
     *  → 软起音（人声感）短音；走 droneBus（吃混响 + 侧链泵），随 intensity 叠成八分 stab / 十六分 chop 云。 */
    playOoh(t, freq, dur = 0.4, dest = null) {
        const c = this.ctx;
        const oA = c.createOscillator(), oB = c.createOscillator();
        const f = c.createBiquadFilter(), fm = c.createBiquadFilter(), g = c.createGain();
        oA.type = 'sawtooth'; oB.type = 'sawtooth';
        oA.frequency.value = freq; oB.frequency.value = freq * 1.005;   // 轻微失谐 → 合唱厚度
        f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.7;   // 整体偏暗
        fm.type = 'peaking'; fm.frequency.value = 500; fm.Q.value = 1.2; fm.gain.value = 8; // "ooh"元音共鸣
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.5, t + 0.04);                  // 软起音（人声感、不 click）
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        // dest 默认 droneBus（铺垫云）；boss 签名「人声碎切」可传 leadBus 让短切音更靠前穿透
        oA.connect(f); oB.connect(f); f.connect(fm); fm.connect(g); g.connect(dest || this.droneBus);
        oA.start(t); oB.start(t); oA.stop(t + dur + 0.05); oB.stop(t + dur + 0.05);
    }

    /** FM 金属 lead / 嘶吼（优化版，参考 darkpsy/full-on FM lead 声音设计）：
     *  ① 3:1 调制比 → 奇次谐波金属基底；调制指数高→低包络做"开口"动态；
     *  ② ~7Hz 快速颤音 LFO 叠加到音高 → 那种"凶悍/granly"的味道（资料指出 FM psy lead 本质是快速 pitch 调制，低音区最明显）；
     *  ③ 入音从 1.5× 俯冲到目标音 → 短促咬合(bite)；
     *  ④ 高 Q 谐振低通由亮扫到暗 → acid 挤压(squelch)；
     *  ⑤ tanh 软削波 drive 加齿。FM/颤音/俯冲三者都相加在 carrier.frequency 上。 */
    playScreech(t, carrierFreq, dur = 0.4) {
        const c = this.ctx;
        const carrier = c.createOscillator(), mod = c.createOscillator(), vib = c.createOscillator();
        const modGain = c.createGain(), vibGain = c.createGain();
        const shaper = c.createWaveShaper(), filt = c.createBiquadFilter(), g = c.createGain();

        // ① FM：3:1 比 + 高→低调制指数（β≈2 入音，衰减到清亮）
        carrier.type = 'sine';
        mod.type = 'sine'; mod.frequency.value = carrierFreq * 3;
        modGain.gain.setValueAtTime(carrierFreq * 6, t);
        modGain.gain.exponentialRampToValueAtTime(carrierFreq * 0.8, t + dur);
        mod.connect(modGain); modGain.connect(carrier.frequency);

        // ② 凶悍快速颤音（音高 LFO，叠加在 carrier.frequency）
        vib.type = 'sine'; vib.frequency.value = 7;
        vibGain.gain.value = carrierFreq * 0.04;
        vib.connect(vibGain); vibGain.connect(carrier.frequency);

        // ③ 入音俯冲咬合：1.5× → 目标音（snappy bite）
        carrier.frequency.setValueAtTime(carrierFreq * 1.5, t);
        carrier.frequency.exponentialRampToValueAtTime(carrierFreq, t + 0.05);

        // ④ acid 谐振挤压：高 Q 低通由亮扫到暗
        filt.type = 'lowpass'; filt.Q.value = 12;
        filt.frequency.setValueAtTime(carrierFreq * 8, t);
        filt.frequency.exponentialRampToValueAtTime(carrierFreq * 1.5, t + dur);

        // ⑤ drive 加齿
        shaper.curve = this._leadDriveCurve; shaper.oversample = '2x';

        // 振幅包络（A≈2ms，指数衰减到本音符末）
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);

        carrier.connect(shaper); shaper.connect(filt); filt.connect(g); g.connect(this.leadBus);
        carrier.start(t); carrier.stop(t + dur + 0.05);
        mod.start(t); mod.stop(t + dur + 0.05);
        vib.start(t); vib.stop(t + dur + 0.05);
    }

    /** 暗黑 drone：两枚失谐锯齿 + 低通（慢 LFO 扫动）→ 持续铺底，start 时创建 */
    _startDrone() {
        const c = this.ctx, t = c.currentTime;
        const oA = c.createOscillator(), oB = c.createOscillator();
        const f = c.createBiquadFilter(), g = c.createGain();
        const lfo = c.createOscillator(), lfoGain = c.createGain();
        const base = this._noteFreq(0) / 2;             // 低八度
        oA.type = 'sawtooth'; oB.type = 'sawtooth';
        oA.frequency.value = base;
        oB.frequency.value = base * 1.006;              // 轻微失谐拍频
        f.type = 'lowpass'; f.Q.value = 6; f.frequency.value = 300;
        lfo.type = 'sine'; lfo.frequency.value = 0.07;   // 极慢扫动
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain); lfoGain.connect(f.frequency);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(1.0, t + 4.0);    // 缓入
        oA.connect(f); oB.connect(f); f.connect(g); g.connect(this.droneBus);
        oA.start(t); oB.start(t); lfo.start(t);
        this._drone = { oA, oB, lfo, g, f };
    }

    /** 移根时把 drone 平滑重新调音（避免硬切跳音） */
    _retuneDrone(t) {
        if (!this._drone) return;
        const base = this._noteFreq(0) / 2;
        const { oA, oB } = this._drone;
        oA.frequency.setTargetAtTime(base, t, 0.4);
        oB.frequency.setTargetAtTime(base * (1.006 + this.threat * 0.03), t, 0.4);  // 保留 threat 失谐
    }

    _stopDrone() {
        if (!this._drone) return;
        const { oA, oB, lfo, g } = this._drone;
        const t = this.ctx.currentTime;
        try {
            g.gain.cancelScheduledValues(t);
            g.gain.setValueAtTime(g.gain.value, t);
            g.gain.linearRampToValueAtTime(0.0001, t + 0.5);
            oA.stop(t + 0.6); oB.stop(t + 0.6); lfo.stop(t + 0.6);
        } catch (e) { /* 已停止则忽略 */ }
        this._drone = null;
    }

    // ─────────────────────────────────────────────
    //  过渡特效（段落切换：riser / downlifter / impact）
    // ─────────────────────────────────────────────

    /** 上升音（riser / uplifter）：噪声带通扫频上行 + 锯齿升八度，进段前蓄力 */
    riser(dur = 1.2) {
        if (this.sm.muted) return;
        const c = this.ctx, t = c.currentTime;
        if (this.sm.noiseBuffer) {
            const src = c.createBufferSource(); src.buffer = this.sm.noiseBuffer; src.loop = true;
            const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
            bp.frequency.setValueAtTime(300, t);
            bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
            const g = c.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.35, t + dur);          // 渐强到顶
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.18); // 顶点后骤落（drop 前留白）
            src.connect(bp); bp.connect(g); g.connect(this.fxBus);
            src.start(t); src.stop(t + dur + 0.25);
        }
        const o = c.createOscillator(), og = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(this._noteFreq(0), t);
        o.frequency.exponentialRampToValueAtTime(this._noteFreq(12), t + dur); // 升一个八度
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.12, t + dur);
        og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.18);
        o.connect(og); og.connect(this.fxBus);
        o.start(t); o.stop(t + dur + 0.25);
    }

    /** 下降音（downlifter）：噪声带通扫频下行 + 锯齿降调，回落/松弛过段 */
    downlifter(dur = 1.0) {
        if (this.sm.muted) return;
        const c = this.ctx, t = c.currentTime;
        if (this.sm.noiseBuffer) {
            const src = c.createBufferSource(); src.buffer = this.sm.noiseBuffer; src.loop = true;
            const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.0;
            bp.frequency.setValueAtTime(9000, t);
            bp.frequency.exponentialRampToValueAtTime(300, t + dur);
            const g = c.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(bp); bp.connect(g); g.connect(this.fxBus);
            src.start(t); src.stop(t + dur + 0.1);
        }
        const o = c.createOscillator(), og = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(this._noteFreq(12), t);
        o.frequency.exponentialRampToValueAtTime(this._noteFreq(-12), t + dur); // 下行两个八度
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.1, t + 0.08);
        og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(og); og.connect(this.fxBus);
        o.start(t); o.stop(t + dur + 0.1);
    }

    /** 落点冲击（impact / drop）：sub 下扫爆音 + 低通噪声爆裂，标记新段落落地 */
    impact() {
        if (this.sm.muted) return;
        const c = this.ctx, t = c.currentTime;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g); g.connect(this.fxBus);
        o.start(t); o.stop(t + 0.65);
        if (this.sm.noiseBuffer) {
            const src = c.createBufferSource(); src.buffer = this.sm.noiseBuffer;
            const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000;
            const ng = c.createGain();
            ng.gain.setValueAtTime(0.5, t);
            ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            src.connect(lp); lp.connect(ng); ng.connect(this.fxBus);
            src.start(t); src.stop(t + 0.3);
        }
    }

    /** 合成 Tom：sine 短下扫（比 kick 高、有音高感）→ drumBus（穿透不被侧链泵）。过渡 fill 用。 */
    playTom(t, freq = 180, gain = 0.65) {
        const c = this.ctx;
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq * 1.4, t);
        o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(g); g.connect(this.drumBus);
        o.start(t); o.stop(t + 0.2);
    }

    /** Tom 连打 fill（参考 DrumFillMidHighCue）：前半八分铺垫 → 后半 16 分加速下行冲刺，进段前蓄力。
     *  公开方法：段落切换 / Boss 前由游戏触发（调度器也会在 8 小节末自动铺一记）。 */
    drumFill() {
        if (this.sm.muted) return;
        const eighth = 60 / this.bpm / 2, sixteenth = eighth / 2;
        let t = this.ctx.currentTime + 0.02;
        for (let i = 0; i < 8; i++) {
            const fast = i >= 4;                       // 后半加速到 16 分
            this.playTom(t, 210 - i * 16, 0.6 + i * 0.03);
            t += fast ? sixteenth : eighth;
        }
    }

    /** 收尾解决音 tag（参考 VoiceOohsFGFinalCue）：根音 → 上行一个全音(+2 半音) 两记长 "ooh"，
     *  给关卡通过 / 胜利 / 段落收束一个上扬解决感。公开方法，由游戏在结束点调用。 */
    finalCue() {
        if (this.sm.muted) return;
        const beat = 60 / this.bpm;
        const t = this.ctx.currentTime + 0.02;
        this.playOoh(t, this._noteFreq(0), beat * 1.9);
        this.playOoh(t + beat * 0.95, this._noteFreq(2), beat * 2.2);   // F→G 式上行解决
    }

    // ─────────────────────────────────────────────
    //  Boss profile（per-boss 风味；从 Suno 成品分段实测提炼，见 boss_music_design.md §3）
    //  设计原则：不换骨架（四踩 + 滚动 bass + 侧链泵），只动 BPM/根音/调式色/织体/
    //  lead 动机/签名行为；profile=null 时全部回退通用逻辑（向后兼容）。
    // ─────────────────────────────────────────────

    /** 8 个 boss 的 profile 表。每个 boss：bpm/rootHz/rootCycle/padChord/leadNotes/
     *  allowLead/allowOoh/shaker/kickHalf/(bassPatterns) + calm{} / rage{} 两段。
     *  段内可覆盖 intensity/bpm/bassFill/leadNotes/driftCycle/sig/shaker/tom/allow*。 */
    _bossProfiles() {
        return {
            // ───────── mini bosses（短促直接）─────────
            ignis: {       // 熔炉守卫·伊格尼斯：E 弗里几亚 b2/b5（燥辣），温压渐强→喷发
                bpm: 146, rootHz: 41.2, rootCycle: [0, 0, 0, 0],
                padChord: [0, 1, 7, 12], allowLead: true, allowOoh: false,
                calm: { intensity: 0.45, bassFill: 'straight8',
                        leadNotes: [12, 15, 12, 19], sig: { buildSweep: true } },
                rage: { intensity: 1.0, bpm: 150, bassFill: 'driving16',
                        leadNotes: [18, 13, 18, 19],            // 点亮 b5(18) 三全音
                        sig: { buildSweep: true, impactOnEnter: true } },
            },
            glacies: {     // 霜晶缝合怪·格拉西斯：D# + 大三度玻璃铃（亮脆），狂暴 b2 缝合人声
                bpm: 145, rootHz: 38.9, rootCycle: [0, 0, 0, 0],
                bassPatterns: [[null, 0, 0, 4, null, 0, 7, 0, null, 0, 4, 0, null, 7, 0, 12]],
                padChord: [0, 4, 7, 12], allowLead: false, allowOoh: false,
                calm: { intensity: 0.4, bassFill: 'sparse', sig: { glassBells: true } },
                rage: { intensity: 0.85, bpm: 149, bassFill: 'offbeat',
                        sig: { glassBells: true, vocalChop: true, chopDeg: 1, chopN: 4, chopStep: 4 } },
            },
            mikro: {       // 裂变母体·米克罗：F + maj7（密集），狂暴机关枪三全音人声碎切
                bpm: 173, rootHz: 43.65, rootCycle: [0, 0, 0, 0],
                bassPatterns: [[null, 0, 10, 0, null, 11, 0, 7, null, 0, 10, 0, null, 7, 0, 11]],
                padChord: [0, 3, 7, 11], leadNotes: [12, 23, 12, 18],   // maj7(23)+三全音(18)
                allowLead: true, allowOoh: false,
                calm: { intensity: 0.6, bassFill: 'offbeat' },
                rage: { intensity: 1.0, bpm: 175, bassFill: 'straight8',  // 平直 8 分锁根
                        sig: { vocalChop: true, chopDeg: 6, chopN: 8, chopStep: 2 } }, // 三全音(6) 高密度
            },
            devourer: {    // 贪婪之渊·噬神者：D# 巨型 sub，狂暴 16 分 sub 雪崩吞没（鼓/旋律不动）
                bpm: 141, rootHz: 38.9, rootCycle: [0, 0, 0, 0],
                padChord: [0, 3, 7, 12], allowLead: false, allowOoh: false,
                shaker: false, kickHalf: true,                  // 鼓极疏：无沙锤 + 半拍 kick
                calm: { intensity: 0.35, bassFill: 'pedal' },
                rage: { intensity: 0.95, bassFill: 'avalanche', sig: { impactOnEnter: true } },
            },
            // ───────── big bosses（更长 build / 更厚层）─────────
            viridis: {     // 翠绿共生体·维里迪斯：F + 大六度悬浮 pad，活体缓慢扩张（不换调式）
                bpm: 147, rootHz: 43.65, rootCycle: [0, 0, 0, 0],
                padChord: [0, 9, 12, 9], allowLead: false, allowOoh: true, // 大六度(9) 悬浮云
                calm: { intensity: 0.5, bassFill: 'pedal' },
                rage: { intensity: 0.85, bpm: 151, bassFill: 'driving16' }, // 仅推密度，不变音色
            },
            tesla: {       // 雷霆幻影·特斯拉：F 自然小调 b6（阴），狂暴 16 分驱动 + tom 反拍
                bpm: 150, rootHz: 43.65, rootCycle: [0, 0, 0, 0],
                bassPatterns: [[null, 0, 0, 8, null, 0, 5, 0, null, 0, 8, 0, null, 5, 0, 0]], // b6(8)/4(5)
                padChord: [0, 3, 7, 12], allowLead: true, allowOoh: false,
                calm: { intensity: 0.55, bassFill: 'offbeat', leadNotes: [12, 19, 17, 12] },
                rage: { intensity: 1.0, bpm: 156, bassFill: 'driving16',
                        leadNotes: [18, 23, 12, 19], sig: { tomRoll: true } },  // 上三全音/7 + tom 击穿
            },
            chimera: {     // 混沌融合体·奇美拉：E↔D# 半音失稳（导音夺权），最快 188
                bpm: 188, rootHz: 41.2, rootCycle: [0, 0, -1, 0],
                bassPatterns: [[null, 0, 0, 0, null, 0, 11, 0, null, 0, 0, 0, null, 7, 0, 6]],
                padChord: [0, 3, 6, 12], allowLead: true, allowOoh: false,
                calm: { intensity: 0.6, bassFill: 'offbeat', driftCycle: [0, 0, -1, 0],
                        leadNotes: [18, 12, 18, 15] },          // 三全音(18)+b3(15)
                rage: { intensity: 1.0, bassFill: 'offbeat', driftCycle: [-1, 0, -1, -1], // D# 反客为主
                        leadNotes: [18, 15, 18, 18], sig: { burstImpact: true } },
            },
            ouroboros: {   // 永恒回声·奥罗波罗斯：D# pedal + b2/b5/6 三音循环动机，最慢 133
                bpm: 133, rootHz: 38.9, rootCycle: [0, 0, 0, 0],
                padChord: [0, 1, 9, 6], allowLead: false, allowOoh: false,
                fxCycleDeg: [1, 6, 9],                          // b2 / b5 / 大六度
                calm: { intensity: 0.4, bassFill: 'pedal', sig: { fxCycle: true, fxPeriod: 8 } },
                rage: { intensity: 0.9, bpm: 138, bassFill: 'pedal',
                        sig: { fxCycle: true, fxPeriod: 2, fifthStab: true } }, // 动机 ×3.7 + 五度 stab
            },
        };
    }

    /** 套用某 boss 的 profile；opts.section 默认 'calm'，opts.snap=true 时 BPM 立即切。
     *  返回 false 表示无此 boss（profile 置空，回退通用逻辑）。 */
    applyBossProfile(bossId, opts = {}) {
        const P = this._bossProfiles()[bossId];
        if (!P) { this.profile = null; this.bossId = null; return false; }
        this.profile = P;
        this.bossId = bossId;
        if (P.rootHz) this.setRootFreq(P.rootHz);
        if (P.bassPatterns) { this._bassPatterns = P.bassPatterns; this._activePattern = P.bassPatterns[0]; }
        if (P.rootCycle) this._rootCycle = P.rootCycle;
        this._padChord = P.padChord || [0, 3, 7, 12];
        this._fxCycleDeg = P.fxCycleDeg || null;
        this._fxCycleIdx = 0;
        this._kickHalf = !!P.kickHalf;
        const snap = !!opts.snap;
        if (P.bpm) { snap ? this.setBpm(P.bpm) : this.glideBpm(P.bpm); }
        this.setSection(opts.section || 'calm', snap);
        return true;
    }

    /** 切换常态/狂暴段落：套用该段的 intensity / bpm / 织体 / lead 动机 / 签名行为。
     *  跟随游戏狂暴状态自动调用（见 setRage）。无 profile 时仅记录 section。 */
    setSection(sec, snap = false) {
        this.section = (sec === 'rage') ? 'rage' : 'calm';
        if (!this.profile) return;
        const P = this.profile, S = P[this.section] || {};
        this._bassFill   = S.bassFill || P.bassFill || 'auto';
        this._sig        = S.sig || {};
        this._drumShaker = (S.shaker !== undefined) ? S.shaker : (P.shaker !== undefined ? P.shaker : true);
        this._drumTom    = !!S.tom;
        this._allowLead  = (S.allowLead !== undefined) ? S.allowLead : (P.allowLead !== false);
        this._allowOoh   = (S.allowOoh  !== undefined) ? S.allowOoh  : (P.allowOoh === true);
        this._driftCycle = S.driftCycle || P.driftCycle || null;
        if (S.leadNotes) this._leadNotes = S.leadNotes;
        else if (P.leadNotes) this._leadNotes = P.leadNotes;
        if (S.intensity !== undefined) this.setIntensity(S.intensity);
        const bpm = S.bpm || P.bpm;
        if (bpm) { snap ? this.setBpm(bpm) : this.glideBpm(bpm); }
        // 让签名层（玻璃铃/FX 动机/五度 stab/人声碎切）即使在较低 intensity 也被听见
        const needLead = this._allowLead ||
            this._sig.glassBells || this._sig.fxCycle || this._sig.fifthStab || this._sig.vocalChop;
        const t = this.ctx.currentTime;
        const leadByInt = this.intensity > 0.55 ? (this.intensity - 0.55) / 0.45 : 0;
        this.leadBus.gain.setTargetAtTime(Math.max(leadByInt, needLead ? 0.5 : 0), t, 0.4);
        if (this._sig.impactOnEnter) this.impact();
    }

    /** 跟随游戏狂暴状态自动切段：setRage(true)→狂暴，setRage(false)→常态 */
    setRage(on) { this.setSection(on ? 'rage' : 'calm'); }

    /** Bass 织体调度：按 _bassFill 选织体。'auto'/'offbeat' 走原句式 + 密度阶梯（向后兼容）。 */
    _scheduleBass(s, t) {
        const fill = this._bassFill || 'auto';
        const I = this.intensity;
        switch (fill) {
            case 'pedal':          // 低根 pedal（devourer/viridis/ouroboros 常态）：拍上根音，强度高补反拍
                if (s % 4 === 0) this.playBass(t, this._noteFreq(0));
                else if (s % 2 === 0 && I > 0.55) this.playBass(t, this._noteFreq(0));
                else if (I > 0.85) this.playBass(t, this._noteFreq(0));
                return;
            case 'avalanche':      // 滚动 16 分 sub 雪崩、死锁根（devourer 狂暴：被低频吞没）
            case 'driving16':      // 16 分驱动满格、锁根（tesla/viridis 狂暴）
                this.playBass(t, this._noteFreq(0));
                return;
            case 'straight8':      // 平直 8 分锁根（ignis 常态 / mikro 狂暴）
                if (s % 2 === 0) this.playBass(t, this._noteFreq(0));
                return;
            case 'sparse':         // 稀疏催眠（glacies 常态）：仅反拍根音，高强度补八分
                if (s % 4 === 2) this.playBass(t, this._noteFreq(0));
                else if (s % 2 === 0 && I > 0.7) this.playBass(t, this._noteFreq(0));
                return;
            default: {             // 'offbeat' / 'auto'：原句式 + intensity 密度阶梯
                const off = this._activePattern[s];
                if (off !== null && off !== undefined && this._bassStepActive(s)) {
                    this.playBass(t, this._noteFreq(off));
                }
            }
        }
    }

    /** Boss 签名行为调度（每 step 调用，仅 profile 模式）。 */
    _scheduleSignatures(s, t, phrase) {
        const sig = this._sig;
        if (!sig) return;
        // FX 三音循环动机（ouroboros）：b2/b5/6 无限轮转，狂暴 period 收紧→密度飙升
        if (sig.fxCycle && this._fxCycleDeg && s % (sig.fxPeriod || 4) === 0) {
            const deg = this._fxCycleDeg[this._fxCycleIdx % this._fxCycleDeg.length];
            this._fxCycleIdx++;
            this.playScreech(t, this._noteFreq(12 + deg), 0.5);
        }
        // 机关枪式人声碎切（mikro 狂暴=三全音 / glacies 狂暴=b2 缝合）
        if (sig.vocalChop && s % (sig.chopStep || 4) === 2) {
            const deg = (sig.chopDeg !== undefined) ? sig.chopDeg : 6;
            this._vocalChop(t, this._noteFreq(24 + deg), sig.chopN || 6, (60 / this.bpm) * 0.5);
        }
        // 脆玻璃铃 shimmer（glacies）：高八度大三度/五度高频 ring
        if (sig.glassBells && s % 4 === 2) {
            const deg = this._padChord[phrase % this._padChord.length];
            this._glassBell(t, this._noteFreq(24 + deg));
        }
        // 五度 power 短 stab（ouroboros 狂暴）
        if (sig.fifthStab && (s === 4 || s === 12)) {
            this.playScreech(t, this._noteFreq(19), 0.18);
        }
        // 反拍 tom 滚（tesla 狂暴：电压击穿）
        if (sig.tomRoll && s % 4 === 3) {
            this.playTom(t, 150, 0.5);
        }
    }

    /** 人声碎切 stutter：把一颗音切成 n 个超短 "ooh" 走 leadBus（更靠前穿透 + 吃乒乓延迟）。 */
    _vocalChop(t, freq, n = 6, span = 0.3) {
        const dt = span / Math.max(1, n);
        for (let i = 0; i < n; i++) {
            this.playOoh(t + i * dt, freq, dt * 0.9, this.leadBus);
        }
    }

    /** 脆玻璃铃：借 FM lead 出一记高频金属 ring（亮脆、短尾），表现冰晶质感。 */
    _glassBell(t, freq) { this.playScreech(t, freq, 0.5); }

    // ─────────────────────────────────────────────
    //  调度器（lookahead）+ 变体
    // ─────────────────────────────────────────────

    /** 每个小节起始：切换 bass 句式、按乐句移根、刷新 lead 音高 */
    _onBarStart(t) {
        // 轮换 bass 句式
        this._activePattern = this._bassPatterns[this._bar % this._bassPatterns.length];

        // 每 4 小节为一个乐句，缓慢移根；profile 的 _driftCycle（chimera 失稳）优先于 _rootCycle
        const phrase = Math.floor(this._bar / 4);
        const cycle = this._driftCycle || this._rootCycle;
        const newOffset = cycle[phrase % cycle.length];
        if (newOffset !== this._rootOffset) {
            this._rootOffset = newOffset;
            this._retuneDrone(t);
        }

        // 签名级 bar 事件：ignis 温压 sweep（每 8 小节）/ chimera 不定时爆裂
        if (this._sig) {
            if (this._sig.buildSweep && this._bar % 8 === 0 && this._bar > 0) {
                this.riser((60 / this.bpm) * 2);
            }
            if (this._sig.burstImpact && this._bar % 6 === 2) {
                this.impact();
            }
        }
    }

    /** Bass 密度阶梯（参考 BassFRootDensityRamp）：按 step 在拍内的细分位置定"存活门槛"，
     *  intensity 越高铺得越满。sub2(反拍 and)恒响 → sub3(pickup a)中强度进 → sub1(e)高强度进
     *  = 稀疏脉冲 → 滚动 16 分。 */
    _bassStepActive(s) {
        const sub = s % 4;                       // 0=kick(已被 null 排除),1=e,2=and,3=a
        // 门槛与 hat 阶梯对齐：<0.15 无 bass（仅 kick+drone）→ 0.15 反拍 and → 0.4 +pickup → 0.7 铺满
        const rank = sub === 2 ? 0.15 : (sub === 3 ? 0.4 : 0.7);
        return this.intensity >= rank;
    }

    /** 把单个 step 上该响的音符排进音频时钟 */
    _scheduleStep(s, t) {
        if (this.sm.muted) return; // 静音时不发声（省 CPU）

        const phrase = Math.floor(this._bar / 4);

        // kick 在每拍（步 0/4/8/12），并触发 sidechain；devourer 用半拍 kick（疏而重）
        const kickOn = this._kickHalf ? (s === 0 || s === 8) : (s % 4 === 0);
        if (kickOn) { this.playKick(t); this.duck(t); }

        // 加速心跳：威胁越高，砰击越密（八分→四分→二分→十六分），越近越急促
        if (this.threat > 0.2) {
            const hb = this.threat < 0.4 ? 8 : this.threat < 0.65 ? 4 : this.threat < 0.85 ? 2 : 1;
            if (s % hb === 0) this._heartbeat(t, 0.3 + this.threat * 0.5);
        }

        // 8 小节末 Tom 连打 fill（参考 DrumFillMidHighCue）：高强度才铺满，末拍 16 分下行冲刺；
        // 低强度退化为一记切分 kick，仍打破规整。
        if (this._bar % 8 === 7 && this.intensity > 0.5 && s >= 12) {
            this.playTom(t, 220 - (s - 12) * 26, 0.6);
        } else if (this._bar % 8 === 7 && s === 14) {
            this.playKick(t, 0.7);
        }

        // 滚动 bass：织体由 _bassFill 决定（profile 可切 pedal/avalanche/driving16/...，
        // 默认 'auto' = 原句式 + intensity 密度阶梯，向后兼容）。
        this._scheduleBass(s, t);

        // hi-hat / 沙锤密度阶梯（参考 DrumGridDensityRamp：四分 → 八分 → 十六分 + 顶层沙锤）
        if (this.intensity > 0.15) {
            if (this.intensity > 0.7) {
                this.playHat(t, s % 4 === 2);                    // 满 16 分 hat
                if (this._drumShaker) this.playShaker(t);        // 顶层沙锤 shimmer 填细分（devourer 关）
            } else if (this.intensity > 0.4) {
                if (s % 2 === 0) this.playHat(t, s % 4 === 2);   // 八分
            } else {
                if (s % 4 === 2) this.playHat(t, true);          // 仅反拍开镲（四分位，最稀疏）
            }
            // 乐句末小节最后一步加一记 32 分加花（roll 感）
            if (this._bar % 4 === 3 && s === 15 && this.intensity > 0.55) {
                const half = (60 / this.bpm / 4) / 2;
                this.playHat(t + half, false, 0.4);
            }
        }

        // "ooh" 律动铺垫层（参考 VoiceOohsCloudDensityRamp：中强度八分 stab → 高强度十六分 chop）
        // 和弦由 _padChord 决定（viridis 用大六度悬浮）；_allowOoh 关时整层静默（默认开=向后兼容）。
        if (this._allowOoh && this.intensity > 0.5) {
            const chord = this._padChord;          // 根 / 色彩音 / 五 / 八度（高八度成"云"）
            if (this.intensity > 0.78) {
                if (s % 2 === 0) this.playOoh(t, this._noteFreq(12 + chord[(s / 2) % 4]), 0.22);
            } else if (s % 4 === 2) {
                this.playOoh(t, this._noteFreq(12 + chord[(this._bar + s) % 4]), 0.4);
            }
        }

        // FM lead 点缀：高强度时按乐句变化音高与落点；_allowLead 关时静默（默认开=向后兼容）。
        if (this._allowLead && this.intensity > 0.65) {
            const note = this._leadNotes[phrase % this._leadNotes.length];
            if (s === 14) this.playScreech(t, this._noteFreq(note), 0.4);
            // 偶数乐句多甩一发在第 10 步，制造问答句
            if (phrase % 2 === 1 && s === 10) {
                this.playScreech(t, this._noteFreq(note - 5), 0.3);
            }
        }

        // Boss 签名层（玻璃铃 / 人声碎切 / FX 三音循环 / 五度 stab / tom 滚）——仅 profile 模式触发
        if (this.profile) this._scheduleSignatures(s, t, phrase);
    }

    _scheduler() {
        const ahead = 0.1;                     // 提前 100ms 排程
        // 速度平滑过渡：每次唤醒把 bpm 朝目标靠拢（snap 时两者相等，无动作）
        if (this.bpm !== this._bpmTarget) {
            this.bpm += (this._bpmTarget - this.bpm) * this._bpmGlide;
            if (Math.abs(this._bpmTarget - this.bpm) < 0.25) { this.bpm = this._bpmTarget; this._syncDelay(); }
        }
        const stepDur = 60 / this.bpm / 4;     // 16 分音符时长
        while (this._nextStepTime < this.ctx.currentTime + ahead) {
            if (this._step === 0) this._onBarStart(this._nextStepTime); // 新小节
            this._scheduleStep(this._step, this._nextStepTime);
            this._nextStepTime += stepDur;
            this._step++;
            if (this._step >= 16) { this._step = 0; this._bar++; }
        }
        this._timer = setTimeout(() => this._scheduler(), 25); // 不精确时钟只负责唤醒
    }

    // ─────────────────────────────────────────────
    //  公共控制
    // ─────────────────────────────────────────────

    start() {
        if (this.playing) return;
        // 移动端 / 自动播放策略：ctx 可能挂起，需在用户手势栈里 resume
        if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
        this.playing = true;
        this._step = 0;
        this._bar = 0;
        this._rootOffset = 0;
        this._activePattern = this._bassPatterns[0];
        this._nextStepTime = this.ctx.currentTime + 0.06;
        this._startDrone();
        this._startApproach();        // 迫近啸叫语音（常驻静音，由 threat 骑参显形）
        this._applyThreatToDrone();   // 若已有 threat，应用 drone 失谐
        this._scheduler();
    }

    stop() {
        if (!this.playing) return;
        this.playing = false;
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        this._stopDrone();
        this._stopApproach();
    }

    /** 自适应强度 0~1：垂直叠层（lead 层渐入渐出，bass/hat 亮度随之变化）。
     *  数量 count 的密度阶梯走这里；实际 this.intensity 取 base 与 threat 地板的较大者。 */
    setIntensity(v) {
        this._baseIntensity = Math.max(0, Math.min(1, v));
        this._applyIntensity();
    }

    /** 把 _baseIntensity 与 threat 地板合成为实际 this.intensity，并刷新所有 RTPC。
     *  threat=0 时退化为旧 setIntensity 行为（向后兼容）。 */
    _applyIntensity() {
        // 逼近本身就抬张力：单个近敌（count 低）也能把强度顶起来 → 取较大者作地板
        this.intensity = Math.max(this._baseIntensity, this.threat * 0.8);
        const t = this.ctx.currentTime;
        const lead = this.intensity > 0.55 ? (this.intensity - 0.55) / 0.45 : 0;
        this.leadBus.gain.setTargetAtTime(lead, t, 0.6);
        // RTPC：强度越高 → bass 失真驱动越猛（咆哮）、回声送量越大（空间更密）、侧链泵越深
        this.bassDrive.gain.setTargetAtTime(0.9 + this.intensity * 0.9, t, 0.6);
        this.delaySend.gain.setTargetAtTime(0.18 + this.intensity * 0.18, t, 0.6);
        // 泵深随 intensity，再随 threat 进一步收紧（危机时呼吸更急促）
        this._pumpDepth = (0.44 - this.intensity * 0.16) - this.threat * 0.06;
    }

    // ─────────────────────────────────────────────
    //  威胁/逼近轴（distance, count → 紧张危机）
    //  RTPC 模式：连续骑参（迫近啸叫/心跳/失谐）+ 越线打点（警戒线 stinger）
    // ─────────────────────────────────────────────

    /** 威胁等级 0~1（连续、可逆）。p 来自 (距离 distance, 数量 count) 的综合迫近度。
     *  数量请同时喂 setIntensity（密度阶梯）；本轴负责"迫近"的张力与危机感。 */
    setThreat(p) {
        this.threat = Math.max(0, Math.min(1, p));
        this._applyIntensity();      // 逼近抬强度地板 + 收紧泵
        this._rideApproach();        // 连续骑：迫近啸叫滤波/增益
        this._applyThreatToDrone();  // drone 失谐拍频随迫近加剧
        this._updateThreatZone();    // 警戒分区跨越 → 打点 stinger
    }

    /** 是否启用"告破强推狂暴"（默认开） */
    setThreatToBoss(on) { this._threatToBoss = !!on; }

    /** 启动迫近啸叫语音：噪声→带通(可扫)→fxBus + 正弦 whine→fxBus，均初始静音，由 _rideApproach 骑参 */
    _startApproach() {
        if (this._approach) return;
        const c = this.ctx, t = c.currentTime;
        const src = c.createBufferSource();
        src.buffer = this.sm.noiseBuffer; src.loop = true;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 4.5; bp.frequency.value = 300;
        const g = c.createGain(); g.gain.value = 0.0001;
        src.connect(bp); bp.connect(g); g.connect(this.fxBus);
        const sine = c.createOscillator();
        sine.type = 'sine'; sine.frequency.value = 1800;
        const sg = c.createGain(); sg.gain.value = 0.0001;
        sine.connect(sg); sg.connect(this.fxBus);
        src.start(t); sine.start(t);
        this._approach = { src, bp, g, sine, sg };
    }

    _stopApproach() {
        if (!this._approach) return;
        const { src, sine } = this._approach;
        const t = this.ctx.currentTime;
        try { src.stop(t + 0.05); sine.stop(t + 0.05); } catch (e) {}
        this._approach = null;
    }

    /** 连续骑迫近啸叫：越近 → 带通越高越响、whine 越高，危机段才显形（p<0.4 whine 静默） */
    _rideApproach() {
        if (!this._approach) return;
        const { bp, g, sine, sg } = this._approach;
        const t = this.ctx.currentTime, p = this.threat;
        bp.frequency.setTargetAtTime(300 + p * p * 3200, t, 0.25);   // 非线性：临近骤亮
        g.gain.setTargetAtTime(p < 0.05 ? 0.0001 : 0.05 + p * 0.22, t, 0.25);
        sine.frequency.setTargetAtTime(1800 + p * 4200, t, 0.25);
        sg.gain.setTargetAtTime(p < 0.4 ? 0.0001 : (p - 0.4) * 0.08, t, 0.25);
    }

    /** drone 拍频随迫近加剧（失谐变宽 → 不安定） */
    _applyThreatToDrone() {
        if (!this._drone) return;
        const base = this._noteFreq(0) / 2;
        this._drone.oB.frequency.setTargetAtTime(base * (1.006 + this.threat * 0.03), this.ctx.currentTime, 0.3);
    }

    _zoneOf(p) { return p >= 0.85 ? 'critical' : p >= 0.6 ? 'danger' : p >= 0.3 ? 'caution' : 'safe'; }

    /** 警戒分区变化检测：跨线才打点（不是每帧），方向区分进/出 */
    _updateThreatZone() {
        const z = this._zoneOf(this.threat);
        if (z === this._threatZone) return;
        const order = { safe: 0, caution: 1, danger: 2, critical: 3 };
        const dir = order[z] > order[this._threatZone] ? 'in' : 'out';
        this._threatZone = z;
        this.onThreatZone(z, dir);
    }

    /** 警戒线 stinger：进区 → riser/impact/告破警报；出区 → downlifter 卸力。
     *  告破(critical) 且有 boss profile 时强推狂暴。 */
    onThreatZone(zone, dir) {
        if (dir === 'in') {
            if (zone === 'caution') this.riser(0.8);
            else if (zone === 'danger') this.impact();
            else if (zone === 'critical') {
                this.impact();
                this._alarm();
                if (this._threatToBoss && this.profile) this.setRage(true);
            }
        } else {
            this.downlifter(0.7);   // 退区：卸力
        }
    }

    /** 告破警报：三全音 + 五度尖叫（不协和，强烈警示） */
    _alarm() {
        const t = this.ctx.currentTime;
        this.playScreech(t, this._noteFreq(18), 0.25);        // 三全音
        this.playScreech(t + 0.12, this._noteFreq(19), 0.25); // 五度
    }

    /** 加速心跳：下行正弦砰（62→38Hz），由 _scheduleStep 按 threat 加密触发，走干净 subBus */
    _heartbeat(t, gain) {
        const c = this.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(62, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.01, gain), t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        o.connect(g); g.connect(this.subBus);
        o.start(t); o.stop(t + 0.16);
    }

    /** 整段音乐音量 0~1（独立于游戏音效与系统静音） */
    setVolume(v) {
        const vol = Math.max(0, Math.min(1, v));
        this.musicGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }

    getVolume() { return this.musicGain.gain.value; }

    /** 立即变速（无过渡） */
    setBpm(b) { this.bpm = this._bpmTarget = Math.max(60, Math.min(200, b)); this._syncDelay(); }

    /** 平滑变速：只设目标，由 _scheduler 每次唤醒逐步逼近（段落过渡用） */
    glideBpm(b) { this._bpmTarget = Math.max(60, Math.min(200, b)); }

    setRootFreq(f) { this.rootFreq = f; }
    isPlaying() { return this.playing; }
}

export { MusicEngine };
