// 世界画布渲染器：忠实移植 world-morphing-simulator 原型 Home.tsx 的多图层绘制
//（地幔 / 地形 / 气候 / 晶石 / 生物 / 合并），并补充缩放、平移、悬停取格。
// 原则与引擎规范一致：渲染层只「拉取」engine.grid 只读字段，绝不修改引擎状态。
import { CELL_TYPE } from '../sim/engine-bridge.js';

const VOID = '#1a1a1a';

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function mixChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function mixColor(a, b, t) {
  return [
    mixChannel(a[0], b[0], t),
    mixChannel(a[1], b[1], t),
    mixChannel(a[2], b[2], t),
  ];
}

function rgb(c, alpha = 1) {
  return alpha >= 1
    ? `rgb(${c[0]}, ${c[1]}, ${c[2]})`
    : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

function terrainColor(elevation) {
  const e = clamp01(elevation ?? 0);
  const low = [34, 75, 84];
  const plain = [75, 115, 72];
  const high = [161, 117, 73];
  const ridge = [228, 216, 184];
  if (e < 0.35) return mixColor(low, plain, e / 0.35);
  if (e < 0.72) return mixColor(plain, high, (e - 0.35) / 0.37);
  return mixColor(high, ridge, (e - 0.72) / 0.28);
}

export class GridRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 视图变换：屏幕坐标 = pan + k * (居中偏移 + 基础像素)
    this.k = 1;
    this.pan = { x: 0, y: 0 };
    this._fitted = false;

    // 每次绘制后缓存，供 screenToCell 使用
    this._baseCell = 10;
    this._offsetX = 0;
    this._offsetY = 0;
    this._cssW = 0;
    this._cssH = 0;

    // 当前悬停格（{x,y} 或 null），由 main.js 在 mousemove 时设置
    this._hover = null;

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(canvas);
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this._cssW = Math.max(1, r.width);
    this._cssH = Math.max(1, r.height);
    this.canvas.width = Math.round(this._cssW * this.dpr);
    this.canvas.height = Math.round(this._cssH * this.dpr);
  }

  /** 复位缩放/平移，使整张网格居中铺满。 */
  resetView() {
    this.k = 1;
    this.pan = { x: 0, y: 0 };
    this._fitted = false;
  }

  _computeFit(engine) {
    const pad = 16;
    const availW = this._cssW - pad * 2;
    const availH = this._cssH - pad * 2;
    this._baseCell = Math.max(2, Math.floor(Math.min(availW / engine.width, availH / engine.height)));
    const gw = engine.width * this._baseCell;
    const gh = engine.height * this._baseCell;
    this._offsetX = (this._cssW - gw) / 2;
    this._offsetY = (this._cssH - gh) / 2;
    this._fitted = true;
  }

  /** 屏幕(CSS)坐标 → 网格格子索引；落在网格外返回 null。 */
  screenToCell(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    const px = (sx - this.pan.x) / this.k - this._offsetX;
    const py = (sy - this.pan.y) / this.k - this._offsetY;
    const x = Math.floor(px / this._baseCell);
    const y = Math.floor(py / this._baseCell);
    return { x, y };
  }

  /** 以光标为锚点缩放。 */
  zoomAt(clientX, clientY, factor) {
    const r = this.canvas.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    const newK = Math.max(0.25, Math.min(12, this.k * factor));
    // 保持光标下的世界点不动
    this.pan.x = sx - (sx - this.pan.x) * (newK / this.k);
    this.pan.y = sy - (sy - this.pan.y) * (newK / this.k);
    this.k = newK;
  }

  panBy(dx, dy) {
    this.pan.x += dx;
    this.pan.y += dy;
  }

  /** 设置悬停高亮格；传 null 清除。 */
  setHover(cell) {
    this._hover = cell;
  }

  /**
   * 绘制一帧。
   * @param {import('@engine/engine.js').SimulationEngine} engine
   * @param {string} layer  mantle|terrain|climate|crystal|bio|combined
   * @param {Record<string,boolean>} ov 叠加层开关
   */
  draw(engine, layer, ov, lab = {}) {
    if (!this._fitted) this._computeFit(engine);
    const ctx = this.ctx;
    const cs = this._baseCell;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this._cssW, this._cssH);
    ctx.translate(this.pan.x, this.pan.y);
    ctx.scale(this.k, this.k);
    ctx.translate(this._offsetX, this._offsetY);

    for (let y = 0; y < engine.height; y++) {
      for (let x = 0; x < engine.width; x++) {
        const cell = engine.grid[y][x];
        const px = x * cs;
        const py = y * cs;

        if (!cell.exists) {
          ctx.fillStyle = VOID;
          ctx.fillRect(px, py, cs, cs);
          continue;
        }

        if (layer === 'mantle') this._paintMantle(ctx, cell, px, py, cs);
        else if (layer === 'terrain') this._paintTerrain(ctx, cell, px, py, cs);
        else if (layer === 'climate') this._paintClimate(ctx, cell, px, py, cs, ov);
        else if (layer === 'crystal') this._paintCrystal(ctx, cell, px, py, cs);
        else if (layer === 'bio') this._paintBio(ctx, cell, px, py, cs);
        else this._paintCombined(ctx, cell, px, py, cs, ov);
      }
    }

    if (ov.gridLines && cs >= 6) this._drawGridLines(ctx, engine, cs);
    if (ov.energyFlow && (layer === 'crystal' || layer === 'combined')) this._drawEnergyFlow(ctx, engine, cs);
    if (ov.migrants && (layer === 'bio' || layer === 'combined')) this._drawMigrants(ctx, engine, cs);
    if (ov.wind && layer === 'climate') this._drawWind(ctx, engine, cs);
    if (ov.energySiphon) this._drawEnergySiphon(ctx, engine, cs);
    if (ov.sourceSeals) this._drawSourceSeals(ctx, lab.analysis, cs);
    if (ov.criticalCells) this._drawCriticalCells(ctx, lab.analysis, cs);
    if (ov.humanBases) this._drawHumanBases(ctx, lab.humanReport, cs);
    if (ov.spawnPoint && engine.params.humanSpawnPoint) this._drawSpawnPoint(ctx, engine.params.humanSpawnPoint, cs);

    // 悬停高亮（最后绘制，盖在所有层之上）
    const hv = this._hover;
    if (hv && hv.x >= 0 && hv.y >= 0 && hv.x < engine.width && hv.y < engine.height) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2 / this.k;
      ctx.strokeRect(hv.x * cs + 0.5, hv.y * cs + 0.5, cs - 1, cs - 1);
    }
  }

  // ---- 单格绘制（颜色映射对齐原型） ----
  _paintMantle(ctx, cell, px, py, cs) {
    const i = cell.mantleEnergy / 100;
    ctx.fillStyle = `rgb(${i * 255}, ${i * 100}, 0)`;
    ctx.fillRect(px, py, cs, cs);
  }

  _paintTerrain(ctx, cell, px, py, cs) {
    const elevation = clamp01(cell.terrainElevation ?? 0);
    const slope = clamp01((cell.terrainSlope ?? 0) * 2.2);
    const basin = clamp01((cell.terrainBasinDepth ?? 0) * 3);
    ctx.fillStyle = rgb(terrainColor(elevation));
    ctx.fillRect(px, py, cs, cs);

    if (basin > 0.04) {
      ctx.fillStyle = `rgba(11, 34, 46, ${Math.min(0.5, basin * 0.45)})`;
      ctx.fillRect(px, py, cs, cs);
    }

    if (slope > 0.08 && cs >= 4) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.45, slope * 0.38)})`;
      ctx.lineWidth = Math.max(1 / this.k, cs * 0.08);
      ctx.beginPath();
      ctx.moveTo(px + cs * 0.18, py + cs * 0.78);
      ctx.lineTo(px + cs * 0.82, py + cs * 0.22);
      ctx.stroke();
    }
  }

  _paintClimate(ctx, cell, px, py, cs, ov) {
    const ideal = 35,
      maxT = 85,
      minT = -15;
    let r, g, b;
    if (cell.temperature > ideal) {
      const t = Math.min(1, (cell.temperature - ideal) / (maxT - ideal));
      r = 255;
      g = Math.round(255 * (1 - t));
      b = Math.round(255 * (1 - t));
    } else {
      const t = Math.max(0, (cell.temperature - minT) / (ideal - minT));
      r = Math.round(255 * t);
      g = Math.round(255 * t);
      b = 255;
    }
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(px, py, cs, cs);
    if (ov.thunderstorm && cell.hasThunderstorm) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.fillRect(px, py, cs, cs);
    }
  }

  _paintCrystal(ctx, cell, px, py, cs) {
    if (cell.crystalState === CELL_TYPE.ALPHA) {
      ctx.fillStyle = cell.isAbsorbing ? '#34d399' : '#10b981';
    } else if (cell.crystalState === CELL_TYPE.BETA) {
      ctx.fillStyle = '#64748b';
    } else {
      ctx.fillStyle = '#404040';
    }
    ctx.fillRect(px, py, cs, cs);
  }

  _paintBio(ctx, cell, px, py, cs) {
    if (cell.crystalState === CELL_TYPE.BIO && cell.bioAttributes) {
      ctx.fillStyle = cell.bioAttributes.color;
      ctx.fillRect(px, py, cs, cs);
      const i = Math.min(1, cell.prosperity / 100);
      ctx.fillStyle = `rgba(255,255,255,${i * 0.5})`;
      ctx.fillRect(px + cs * 0.25, py + cs * 0.25, cs * 0.5, cs * 0.5);
    } else {
      const diff = Math.abs(cell.temperature - 20);
      if (diff < 10) {
        ctx.fillStyle = `rgba(34,197,94,${0.1 * (1 - diff / 10)})`;
        ctx.fillRect(px, py, cs, cs);
      } else {
        ctx.fillStyle = VOID;
        ctx.fillRect(px, py, cs, cs);
      }
    }
  }

  _paintCombined(ctx, cell, px, py, cs, ov) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px, py, cs, cs);

    const terrain = terrainColor(cell.terrainElevation ?? 0);
    const terrainAlpha = 0.18 + Math.min(0.18, (cell.terrainSlope ?? 0) * 0.5);
    ctx.fillStyle = rgb(terrain, terrainAlpha);
    ctx.fillRect(px, py, cs, cs);

    const m = Math.min(1, cell.mantleEnergy / 150);
    if (m > 0.1) {
      ctx.fillStyle = `rgba(255, ${m * 100}, 0, ${m * 0.4})`;
      ctx.fillRect(px, py, cs, cs);
    }

    if (cell.crystalState === CELL_TYPE.ALPHA) {
      ctx.fillStyle = cell.isAbsorbing ? '#34d399' : '#10b981';
      ctx.fillRect(px, py, cs, cs);
    } else if (cell.crystalState === CELL_TYPE.BETA) {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(px, py, cs, cs);
    } else if (cell.crystalState === CELL_TYPE.BIO && cell.bioAttributes) {
      ctx.fillStyle = cell.bioAttributes.color;
      ctx.fillRect(px, py, cs, cs);
      if (cs >= 7) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(8, cs * 0.8)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const id = cell.bioAttributes.speciesId;
        const ch = id === 0 ? 'X' : String.fromCharCode(65 + (id % 26));
        ctx.fillText(ch, px + cs / 2, py + cs / 2);
      }
    }

    if (ov.thunderstorm && cell.hasThunderstorm) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.fillRect(px, py, cs, cs);
    }
  }

  // ---- 叠加层 ----
  _drawGridLines(ctx, engine, cs) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1 / this.k;
    ctx.beginPath();
    for (let x = 0; x <= engine.width; x++) {
      ctx.moveTo(x * cs, 0);
      ctx.lineTo(x * cs, engine.height * cs);
    }
    for (let y = 0; y <= engine.height; y++) {
      ctx.moveTo(0, y * cs);
      ctx.lineTo(engine.width * cs, y * cs);
    }
    ctx.stroke();
  }

  _drawEnergyFlow(ctx, engine, cs) {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1 / this.k;
    ctx.beginPath();
    for (let y = 0; y < engine.height; y++) {
      for (let x = 0; x < engine.width; x++) {
        const cell = engine.grid[y][x];
        if (!cell.exists || !cell.energyFlow || cell.energyFlow.length === 0) continue;
        const sx = x * cs + cs / 2;
        const sy = y * cs + cs / 2;
        for (const f of cell.energyFlow) {
          if (f.amount < 0.05) continue;
          ctx.moveTo(sx, sy);
          ctx.lineTo(f.x * cs + cs / 2, f.y * cs + cs / 2);
        }
      }
    }
    ctx.stroke();
  }

  _drawMigrants(ctx, engine, cs) {
    for (let y = 0; y < engine.height; y++) {
      for (let x = 0; x < engine.width; x++) {
        const cell = engine.grid[y][x];
        if (!cell.exists || !cell.migrant) continue;
        const cx = x * cs + cs / 2;
        const cy = y * cs + cs / 2;
        ctx.fillStyle = cell.migrant.attributes?.color || '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, cs / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1 / this.k;
        ctx.stroke();
      }
    }
  }

  _drawWind(ctx, engine, cs) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1 / this.k;
    const step = 2;
    for (let y = 1; y < engine.height - 1; y += step) {
      for (let x = 1; x < engine.width - 1; x += step) {
        if (!engine.grid[y][x].exists) continue;
        const tL = engine.grid[y][x - 1].temperature;
        const tR = engine.grid[y][x + 1].temperature;
        const tU = engine.grid[y - 1][x].temperature;
        const tD = engine.grid[y + 1][x].temperature;
        const flowX = -(tR - tL) / 2;
        const flowY = -(tD - tU) / 2;
        const mag = Math.sqrt(flowX * flowX + flowY * flowY);
        if (mag <= 0.5) continue;
        const cx = x * cs + cs / 2;
        const cy = y * cs + cs / 2;
        const scale = Math.min(cs * 1.5, mag * 2);
        const dx = (flowX / mag) * scale;
        const dy = (flowY / mag) * scale;
        const ang = Math.atan2(dy, dx);
        const hl = scale * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + dx, cy + dy);
        ctx.lineTo(cx + dx - hl * Math.cos(ang - Math.PI / 6), cy + dy - hl * Math.sin(ang - Math.PI / 6));
        ctx.moveTo(cx + dx, cy + dy);
        ctx.lineTo(cx + dx - hl * Math.cos(ang + Math.PI / 6), cy + dy - hl * Math.sin(ang + Math.PI / 6));
        ctx.stroke();
      }
    }
  }

  _drawSpawnPoint(ctx, sp, cs) {
    const px = sp.x * cs;
    const py = sp.y * cs;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2 / this.k;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + cs, py + cs);
    ctx.moveTo(px + cs, py);
    ctx.lineTo(px, py + cs);
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / this.k;
    ctx.strokeRect(px - 2, py - 2, cs + 4, cs + 4);
  }

  _drawEnergySiphon(ctx, engine, cs) {
    for (let y = 0; y < engine.height; y++) {
      for (let x = 0; x < engine.width; x++) {
        const cell = engine.grid[y][x];
        if (!cell.exists || !cell.isEnergySiphoned) continue;
        const a = Math.min(0.55, 0.12 + (cell.humanEnergyDrain || 0) / 40);
        ctx.fillStyle = `rgba(34, 211, 238, ${a})`;
        ctx.fillRect(x * cs, y * cs, cs, cs);
      }
    }
  }

  _drawCriticalCells(ctx, analysis, cs) {
    if (!analysis) return;
    ctx.lineWidth = 2 / this.k;
    for (const set of analysis.criticalSets || []) {
      for (const cell of set.cells || []) {
        const px = cell.x * cs;
        const py = cell.y * cs;
        ctx.strokeStyle = '#e879f9';
        ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
      }
    }
    ctx.fillStyle = '#f43f5e';
    for (const cell of analysis.criticalCells || []) {
      const cx = cell.x * cs + cs / 2;
      const cy = cell.y * cs + cs / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, cs * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawSourceSeals(ctx, analysis, cs) {
    if (!analysis) return;
    ctx.lineWidth = 2 / this.k;
    for (const seal of analysis.sourceSeals || []) {
      const px = seal.x * cs;
      const py = seal.y * cs;
      ctx.strokeStyle = '#f97316';
      ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
      ctx.beginPath();
      ctx.moveTo(px + cs * 0.25, py + cs * 0.5);
      ctx.lineTo(px + cs * 0.75, py + cs * 0.5);
      ctx.moveTo(px + cs * 0.5, py + cs * 0.25);
      ctx.lineTo(px + cs * 0.5, py + cs * 0.75);
      ctx.stroke();
    }
  }

  _drawHumanBases(ctx, humanReport, cs) {
    const bases = humanReport?.bases || [];
    for (const base of bases) {
      const cx = base.x * cs + cs / 2;
      const cy = base.y * cs + cs / 2;
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 1 / this.k;
      ctx.beginPath();
      ctx.arc(cx, cy, base.radius * cs, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.strokeStyle = '#06242a';
      ctx.lineWidth = 2 / this.k;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(3, cs * 0.28), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
