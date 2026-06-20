// 实时指标曲线：滚动多序列折线图（纯 Canvas，无第三方依赖）。
// 各序列按自身在可视窗口内的 min/max 独立归一化，便于在同一画布上对比「形状/趋势」
//（温度 ~[-50,50] 与人口 ~[0,200] 量级不同）；绝对数值在图例中显示。
export class MetricsChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{key:string,label:string,color:string,on:boolean}[]} series
   */
  constructor(canvas, series) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.maxLen = 720; // 滚动窗口样本数
    this.series = series.map((s) => ({ ...s }));
    this.history = Object.fromEntries(this.series.map((s) => [s.key, []]));
    this.steps = [];

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas);
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this._w = Math.max(1, r.width);
    this._h = Math.max(1, r.height);
    this.canvas.width = Math.round(this._w * this.dpr);
    this.canvas.height = Math.round(this._h * this.dpr);
  }

  reset() {
    for (const k of Object.keys(this.history)) this.history[k] = [];
    this.steps = [];
  }

  /** 追加一帧指标（只取已定义序列对应字段）。 */
  push(m) {
    this.steps.push(m.timeStep);
    if (this.steps.length > this.maxLen) this.steps.shift();
    for (const s of this.series) {
      const arr = this.history[s.key];
      arr.push(Number(m[s.key]) || 0);
      if (arr.length > this.maxLen) arr.shift();
    }
  }

  toggle(key, on) {
    const s = this.series.find((x) => x.key === key);
    if (s) s.on = on ?? !s.on;
  }

  current(key) {
    const arr = this.history[key];
    return arr && arr.length ? arr[arr.length - 1] : 0;
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this._w, this._h);

    const padL = 8,
      padR = 8,
      padT = 10,
      padB = 16;
    const plotW = this._w - padL - padR;
    const plotH = this._h - padT - padB;
    if (plotW <= 4 || plotH <= 4) return;

    // 背景网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4;
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
    }
    ctx.stroke();

    const n = this.steps.length;
    if (n < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '12px system-ui';
      ctx.fillText('运行后这里会显示指标随时间的变化…', padL + 8, padT + 18);
      return;
    }

    const xAt = (i) => padL + (plotW * i) / (this.maxLen - 1);

    for (const s of this.series) {
      if (!s.on) continue;
      const arr = this.history[s.key];
      let lo = Infinity,
        hi = -Infinity;
      for (const v of arr) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (!isFinite(lo)) continue;
      const span = hi - lo || 1;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const norm = (arr[i] - lo) / span; // 0..1
        const y = padT + plotH * (1 - norm);
        const x = xAt(i);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // x 轴：步数范围
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px system-ui';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`step ${this.steps[0]}`, padL, this._h - 4);
    const last = `step ${this.steps[n - 1]}`;
    ctx.fillText(last, padL + plotW - ctx.measureText(last).width, this._h - 4);
  }
}
