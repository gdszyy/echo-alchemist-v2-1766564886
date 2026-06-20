// 调参实验台主装配：持有唯一 params 对象（引擎按引用消费）、驱动 rAF 循环、
// 接线工具栏 / 画布交互 / 预设导入导出。引擎只通过 engine-bridge 间接引用。
import {
  createEngine,
  defaultParams,
  engineParamKeys,
  hasCrystalDisaster,
  CELL_TYPE,
} from './sim/engine-bridge.js';
import { schemaKeys } from './sim/params-schema.js';
import { computeMetrics, METRIC_SERIES, STAT_CARDS } from './sim/metrics.js';
import {
  RING_FRONT_PARAMS,
  RING_FRONT_PREVIEW_TICKS,
  RING_FRONT_SEED,
  STABLE_SOURCE_BASIN_PARAMS,
  analyzeDisaster,
  applyScenario,
  clearHumanEnergyBases,
  deployRingFrontKeySiphons,
  deployRecommendedSiphons,
  getHumanEnergyReport,
  hitBestCriticalSet,
} from './sim/disaster-tools.js';
import { GridRenderer } from './render/grid-renderer.js';
import { MetricsChart } from './render/metrics-chart.js';
import { buildGui } from './ui/gui.js';
import {
  buildLayerButtons,
  buildOverlayToggles,
  buildLegend,
  buildStatsGrid,
} from './ui/controls.js';

// ---------------------------------------------------------------------------
// DOM 引用
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const world = $('world');
const chartCanvas = $('chart');
const layerButtons = $('layer-buttons');
const overlayToggles = $('overlay-toggles');
const seriesLegend = $('series-legend');
const statsGrid = $('stats-grid');
const guiMount = $('gui-mount');
const terrainNote = $('terrain-note');
const inspectCoord = $('inspect-coord');
const inspectBody = $('inspect-body');
const runState = $('run-state');

const btnPlay = $('btn-play');
const btnStep = $('btn-step');
const btnReset = $('btn-reset');
const speedInput = $('speed');
const speedValEl = $('speed-val');
const gridWInput = $('grid-w');
const gridHInput = $('grid-h');
const seedOn = $('seed-on');
const seedVal = $('seed-val');
const btnExport = $('btn-export');
const btnImport = $('btn-import');
const btnDefaults = $('btn-defaults');
const importFile = $('import-file');
const btnScenarioNatural = $('btn-scenario-natural');
const btnScenarioSource = $('btn-scenario-source');
const btnScenarioCircle = $('btn-scenario-circle');
const btnStablePreset = $('btn-stable-preset');
const btnRingFront = $('btn-ring-front');
const btnRingFrontKey = $('btn-ring-front-key');
const btnSiphon = $('btn-siphon');
const btnCut = $('btn-cut');
const btnClearBases = $('btn-clear-bases');

// ---------------------------------------------------------------------------
// 启动自检：schema 参数键是否与引擎 DEFAULT_PARAMS 对齐（防止引擎演进后漏配滑块）
// ---------------------------------------------------------------------------
(function validateSchema() {
  const sKeys = new Set(schemaKeys());
  const eKeys = new Set(engineParamKeys());
  // humanSpawnPoint 由点选设置，非数值滑块，故排除
  const missing = [...eKeys].filter((k) => !sKeys.has(k) && k !== 'humanSpawnPoint');
  const stale = [...sKeys].filter((k) => !eKeys.has(k));
  if (missing.length) console.warn('[world_sim_lab] 引擎有、但参数面板未覆盖：', missing);
  if (stale.length) console.warn('[world_sim_lab] 参数面板有、但引擎已无：', stale);
})();

// ---------------------------------------------------------------------------
// 状态（params 为唯一可变对象，引擎构造时按引用持有 → 滑块改字段即逐帧生效）
// ---------------------------------------------------------------------------
const params = defaultParams();
delete params.humanSpawnPoint; // 默认无重生点；由「点选设定重生点」按需设置

let gridW = 50;
let gridH = 50;
const seed = { on: false, value: 12345 };
let speed = 1;
let layer = 'combined';
let running = false;
let scenario = 'natural';
let currentAnalysis = null;
let currentHumanReport = null;
let lastAction = '';

const overlays = {
  energyFlow: false,
  migrants: true,
  thunderstorm: true,
  wind: true,
  criticalCells: true,
  sourceSeals: true,
  humanBases: true,
  energySiphon: true,
  gridLines: false,
  spawnPoint: true,
  pickSpawn: false,
};

// ---------------------------------------------------------------------------
// 实例化：引擎 / 渲染器 / 曲线 / 参数面板 / 侧栏读数
// ---------------------------------------------------------------------------
// 当前种子值（启用时透传给引擎原生种子源；未启用则 undefined → Math.random）
const seedArg = () => (seed.on ? seed.value >>> 0 : undefined);

let engine = createEngine(gridW, gridH, params, seedArg());
applyScenario(engine, scenario);
console.info('[world_sim_lab] 引擎已构造', `${gridW}×${gridH}`,
  hasCrystalDisaster(engine) ? '· 含晶石灾变 API' : '· 无晶石灾变 API');

const renderer = new GridRenderer(world);
const chart = new MetricsChart(chartCanvas, METRIC_SERIES);
const statEls = buildStatsGrid(statsGrid, STAT_CARDS);
const legendEls = buildLegend(seriesLegend, METRIC_SERIES, (key, on) => chart.toggle(key, on));
buildLayerButtons(layerButtons, layer, (id) => {
  layer = id;
});
buildOverlayToggles(overlayToggles, overlays, (key, checked) => {
  overlays[key] = checked;
  if (key === 'pickSpawn') world.style.cursor = checked ? 'crosshair' : '';
});
const guiApi = buildGui(guiMount, params, {
  onLiveChange: () => updateTerrainNote(),
  onStructuralChange: () => rebuild(false),
});

// ---------------------------------------------------------------------------
// 主循环：始终渲染（保证悬停/缩放/平移流畅）；仅运行态推进引擎并写入曲线
// ---------------------------------------------------------------------------
function loop() {
  if (running) {
    try {
      for (let i = 0; i < speed; i++) engine.update();
    } catch (err) {
      console.error('[engine.update] 抛出异常，已自动暂停：', err);
      setRunning(false);
    }
  }
  currentAnalysis = analyzeDisaster(engine);
  currentHumanReport = getHumanEnergyReport(engine);
  const m = computeMetrics(engine, currentAnalysis, currentHumanReport);
  paintStats(m);
  paintLegend(m);
  updateTerrainNote();
  if (running) chart.push(m);
  renderer.draw(engine, layer, overlays, {
    analysis: currentAnalysis,
    humanReport: currentHumanReport,
  });
  chart.draw();
  requestAnimationFrame(loop);
}

// 重建引擎：网格尺寸 / 种子 / 结构性参数变化时调用。refit=true 时复位视图。
function rebuild(refit) {
  engine = createEngine(gridW, gridH, params, seedArg());
  applyScenario(engine, scenario);
  if (refit) renderer.resetView();
  chart.reset();
  renderer.setHover(null);
  currentAnalysis = analyzeDisaster(engine);
  currentHumanReport = getHumanEnergyReport(engine);
  updateTerrainNote();
}

function setRunning(on) {
  running = on;
  btnPlay.textContent = on ? '⏸ 暂停' : '▶ 运行';
  btnPlay.classList.toggle('btn-primary', !on);
  runState.textContent = on ? '运行中' : '已暂停';
  runState.classList.toggle('running', on);
}

function scenarioLabel(id) {
  if (id === 'source-basin') return '源井盆地';
  if (id === 'source-circle') return '圆形源井';
  return '默认演化';
}

function syncScenarioButtons() {
  btnScenarioNatural.classList.toggle('active', scenario === 'natural');
  btnScenarioSource.classList.toggle('active', scenario === 'source-basin');
  btnScenarioCircle.classList.toggle('active', scenario === 'source-circle');
}

function setScenario(next) {
  scenario = next;
  syncScenarioButtons();
  lastAction = scenario === 'natural' ? '切换默认演化场景' : `生成${scenarioLabel(scenario)}场景`;
  rebuild(true);
}

function refreshAnalysisNow() {
  currentAnalysis = analyzeDisaster(engine);
  currentHumanReport = getHumanEnergyReport(engine);
  updateTerrainNote();
}

function stepOnce() {
  try {
    engine.update();
  } catch (err) {
    console.error('[engine.update] 单步异常：', err);
    return;
  }
  currentAnalysis = analyzeDisaster(engine);
  currentHumanReport = getHumanEnergyReport(engine);
  chart.push(computeMetrics(engine, currentAnalysis, currentHumanReport));
}

// ---------------------------------------------------------------------------
// 侧栏 / 图例数值刷新
// ---------------------------------------------------------------------------
function paintStats(m) {
  for (const c of STAT_CARDS) {
    const el = statEls[c.key];
    if (!el) continue;
    const v = m[c.key];
    el.textContent = (c.fmt ? c.fmt(v) : String(v)) + (c.unit || '');
  }
}

function paintLegend(m) {
  for (const s of METRIC_SERIES) {
    const el = legendEls[s.key];
    if (!el) continue;
    const v = m[s.key];
    el.textContent =
      typeof v !== 'number' ? '–' : Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
}

function updateTerrainNote() {
  const initR = Math.min(gridW, gridH) * 0.4;
  const maxR = params.maxRadius;
  const analysis = currentAnalysis || analyzeDisaster(engine);
  const report = currentHumanReport || getHumanEnergyReport(engine);
  let msg = `场景：${scenarioLabel(scenario)}。`;
  msg += analysis.active
    ? ` 晶石灾害活跃：${analysis.stats.disasterCount} 个；关键割集 ${analysis.criticalSets.length}；源井目标 ${analysis.sourceSeals.length}。`
    : ' 当前未检测到稳定晶石灾害。';
  msg += ` 人类基地 ${report.baseCount}，累计抽能 ${num(report.totalExtracted, 1)}。`;
  if (layer === 'terrain') {
    const metrics = computeMetrics(engine, analysis, report);
    msg += ` 地形层：平均地势 ${num(metrics.avgElevation, 2)}，最大坡度 ${num(metrics.maxSlope, 2)}，盆地格 ${metrics.basinCells}。`;
  }
  if (lastAction) msg += ` 最近操作：${lastAction}。`;
  msg += ` 初始陆地半径 ≈ ${initR.toFixed(1)}。`;
  if (initR >= maxR) {
    msg += ` 已 ≥ 世界最大半径 ${maxR}，默认地形不会向外生长。`;
  } else {
    msg += ` < 世界最大半径 ${maxR}，默认地形可向外生长。`;
  }
  terrainNote.textContent = msg;
}

// 单格检视文本
function crystalLabel(s) {
  if (s === CELL_TYPE.ALPHA) return 'Alpha 晶石';
  if (s === CELL_TYPE.BETA) return 'Beta 晶石';
  if (s === CELL_TYPE.BIO) return '生物聚落';
  return '空地';
}

function describeCell(cell, x, y) {
  if (!cell || !cell.exists) return `(${x}, ${y})\n虚空 · 无陆地`;
  const L = [];
  L.push(`坐标        (${x}, ${y})`);
  L.push(`晶石态      ${crystalLabel(cell.crystalState)}`);
  L.push(`温度        ${num(cell.temperature, 2)}°`);
  L.push(`地势高度    ${num(cell.terrainElevation, 3)}`);
  L.push(`坡度        ${num(cell.terrainSlope, 3)}`);
  L.push(`盆地深度    ${num(cell.terrainBasinDepth, 3)}`);
  L.push(`通行代价    ${num(cell.terrainMoveCost, 2)}`);
  L.push(`地幔能量    ${num(cell.mantleEnergy, 1)}`);
  L.push(`储存能量    ${num(cell.storedEnergy, 1)}`);
  if (cell.isEnergySiphoned || cell.humanEnergyDrain > 0) {
    L.push(`人类抽能    ${num(cell.humanEnergyDrain, 1)}`);
  }
  const key = `${x},${y}`;
  const analysis = currentAnalysis || analyzeDisaster(engine);
  if (analysis.sourceSeals?.some((s) => `${s.x},${s.y}` === key)) L.push('灾害角色    源井封印目标');
  if (analysis.criticalCells?.some((c) => `${c.x},${c.y}` === key)) L.push('灾害角色    关键阻断点');
  if (analysis.criticalSets?.some((set) => set.cells?.some((c) => `${c.x},${c.y}` === key))) {
    L.push('灾害角色    关键割集成员');
  }
  if (cell.hasThunderstorm) L.push('天气        ⚡ 雷暴');
  if (cell.isAbsorbing) L.push('状态        吸收地幔能量中');
  if (cell.isMining) L.push('状态        开采晶石中');
  if (cell.crystalState === CELL_TYPE.BIO) {
    L.push(`繁荣度      ${num(cell.prosperity, 1)}`);
    if (cell.bioAttributes) {
      L.push(`物种 ID     ${cell.bioAttributes.speciesId}`);
      if (cell.bioAttributes.color) L.push(`物种颜色    ${cell.bioAttributes.color}`);
    }
  }
  if (cell.migrant) {
    const sid = cell.migrant.attributes?.speciesId;
    L.push(`迁徙者      物种 ${sid ?? '?'}`);
  }
  if (Array.isArray(cell.energyFlow) && cell.energyFlow.length) {
    L.push(`能量流出    ${cell.energyFlow.length} 条`);
  }
  return L.join('\n');
}

function num(v, d) {
  return typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—';
}

// ---------------------------------------------------------------------------
// 工具栏接线
// ---------------------------------------------------------------------------
btnPlay.onclick = () => setRunning(!running);
btnStep.onclick = () => {
  if (running) setRunning(false);
  stepOnce();
};
btnReset.onclick = () => rebuild(true);

speedInput.oninput = () => {
  speed = +speedInput.value;
  speedValEl.textContent = String(speed);
};

const clampGrid = (v) => Math.max(16, Math.min(160, Math.round(v) || 36));
gridWInput.onchange = () => {
  gridW = clampGrid(+gridWInput.value);
  gridWInput.value = String(gridW);
  rebuild(true);
};
gridHInput.onchange = () => {
  gridH = clampGrid(+gridHInput.value);
  gridHInput.value = String(gridH);
  rebuild(true);
};

seedOn.onchange = () => {
  seed.on = seedOn.checked;
  seedVal.disabled = !seed.on;
  rebuild(true);
};
seedVal.onchange = () => {
  seed.value = (+seedVal.value) >>> 0;
  seedVal.value = String(seed.value);
  if (seed.on) rebuild(true);
};

// ---------------------------------------------------------------------------
// 预设导入 / 导出 / 默认
// ---------------------------------------------------------------------------
btnExport.onclick = () => {
  const data = {
    version: 1,
    width: gridW,
    height: gridH,
    scenario,
    seed: { on: seed.on, value: seed.value },
    params: structuredClone(params),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `world-preset-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

btnImport.onclick = () => importFile.click();
importFile.onchange = async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.params && typeof data.params === 'object') {
      // 原地写入：保持引擎持有的 params 引用不变
      Object.assign(params, data.params);
      if (!data.params.humanSpawnPoint) delete params.humanSpawnPoint;
    }
    if (Number.isFinite(data.width)) {
      gridW = clampGrid(data.width);
      gridWInput.value = String(gridW);
    }
    if (Number.isFinite(data.height)) {
      gridH = clampGrid(data.height);
      gridHInput.value = String(gridH);
    }
    if (data.seed && typeof data.seed === 'object') {
      seed.on = !!data.seed.on;
      if (Number.isFinite(data.seed.value)) seed.value = data.seed.value >>> 0;
      seedOn.checked = seed.on;
      seedVal.value = String(seed.value);
      seedVal.disabled = !seed.on;
    }
    if (['source-basin', 'source-circle', 'natural'].includes(data.scenario)) {
      scenario = data.scenario;
      syncScenarioButtons();
    }
    guiApi.refresh();
    rebuild(true);
  } catch (err) {
    console.error('导入预设失败：', err);
    alert('导入失败：无法解析该 JSON 预设文件。');
  } finally {
    importFile.value = '';
  }
};

btnDefaults.onclick = () => {
  Object.assign(params, defaultParams());
  delete params.humanSpawnPoint;
  guiApi.refresh();
  rebuild(false);
};

btnScenarioNatural.onclick = () => setScenario('natural');
btnScenarioSource.onclick = () => setScenario('source-basin');
btnScenarioCircle.onclick = () => setScenario('source-circle');

btnStablePreset.onclick = () => {
  Object.assign(params, STABLE_SOURCE_BASIN_PARAMS);
  delete params.humanSpawnPoint;
  gridW = 50;
  gridH = 50;
  gridWInput.value = String(gridW);
  gridHInput.value = String(gridH);
  scenario = scenario === 'source-circle' ? 'source-circle' : 'source-basin';
  syncScenarioButtons();
  guiApi.refresh();
  lastAction = `载入 ${scenario} 50x50 / 600步可解稳定参数`;
  rebuild(true);
};

btnRingFront.onclick = () => {
  Object.assign(params, RING_FRONT_PARAMS);
  delete params.humanSpawnPoint;
  gridW = 50;
  gridH = 50;
  gridWInput.value = String(gridW);
  gridHInput.value = String(gridH);
  seed.on = true;
  seed.value = RING_FRONT_SEED;
  seedOn.checked = true;
  seedVal.disabled = false;
  seedVal.value = String(seed.value);
  scenario = 'natural';
  syncScenarioButtons();
  guiApi.refresh();
  rebuild(true);
  for (let t = 0; t < RING_FRONT_PREVIEW_TICKS; t++) engine.update();
  currentAnalysis = analyzeDisaster(engine);
  currentHumanReport = getHumanEnergyReport(engine);
  chart.reset();
  lastAction = `载入 50x50 圆形岛屿环形前缘参数并推进 ${RING_FRONT_PREVIEW_TICKS} 步`;
  updateTerrainNote();
};

btnRingFrontKey.onclick = () => {
  const result = deployRingFrontKeySiphons(engine);
  lastAction = result.placed > 0
    ? `部署环形前缘六点吸能阵列：${result.placed}/${result.targets.length}`
    : '没有可部署的环形前缘关键点';
  refreshAnalysisNow();
};

btnSiphon.onclick = () => {
  const placed = deployRecommendedSiphons(engine, currentAnalysis || analyzeDisaster(engine), 3);
  lastAction = placed > 0 ? `部署 ${placed} 座吸能基地` : '没有可部署的推荐目标';
  refreshAnalysisNow();
};

btnCut.onclick = () => {
  const result = hitBestCriticalSet(engine, currentAnalysis || analyzeDisaster(engine));
  lastAction = result
    ? `阻断 ${result.changed} 格，resolved=${result.resolved ? 'true' : 'false'}`
    : '没有可阻断的关键割集';
  refreshAnalysisNow();
};

btnClearBases.onclick = () => {
  clearHumanEnergyBases(engine);
  lastAction = '清除所有吸能基地';
  refreshAnalysisNow();
};

// ---------------------------------------------------------------------------
// 画布交互：滚轮缩放 · 拖拽平移 · 双击复位 · 悬停检视 · 点选重生点
// ---------------------------------------------------------------------------
let dragging = false;
let dragMoved = false;
let lastX = 0;
let lastY = 0;

world.addEventListener('mousedown', (e) => {
  dragging = true;
  dragMoved = false;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
  renderer.panBy(dx, dy);
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener('mouseup', (e) => {
  if (dragging && !dragMoved && overlays.pickSpawn) handlePick(e);
  dragging = false;
});

world.addEventListener('mousemove', (e) => {
  const { x, y } = renderer.screenToCell(e.clientX, e.clientY);
  if (x >= 0 && y >= 0 && x < engine.width && y < engine.height) {
    renderer.setHover({ x, y });
    inspectCoord.textContent = `(${x}, ${y})`;
    inspectBody.textContent = describeCell(engine.grid[y][x], x, y);
    inspectBody.classList.remove('muted');
  } else {
    renderer.setHover(null);
    inspectCoord.textContent = '画布外';
  }
});

world.addEventListener('mouseleave', () => {
  renderer.setHover(null);
  inspectCoord.textContent = '悬停画布';
});

world.addEventListener('dblclick', () => renderer.resetView());

world.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    renderer.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  },
  { passive: false }
);

function handlePick(e) {
  const { x, y } = renderer.screenToCell(e.clientX, e.clientY);
  if (x < 0 || y < 0 || x >= engine.width || y >= engine.height) return;
  if (!engine.grid[y][x].exists) return;
  const sp = params.humanSpawnPoint;
  if (sp && sp.x === x && sp.y === y) delete params.humanSpawnPoint;
  else params.humanSpawnPoint = { x, y };
}

// ---------------------------------------------------------------------------
// 键盘：空格播放/暂停 · S 单步（输入框聚焦时不拦截）
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    setRunning(!running);
  } else if (e.code === 'KeyS') {
    e.preventDefault();
    if (running) setRunning(false);
    stepOnce();
  }
});

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------
updateTerrainNote();
setRunning(false);
requestAnimationFrame(loop);
