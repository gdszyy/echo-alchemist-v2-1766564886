// 工具栏 / 图例 / 状态读数等 DOM 构建助手。仅负责生成元素并回调，状态留在 main.js。

export const LAYERS = [
  { id: 'mantle', label: '地幔' },
  { id: 'terrain', label: '地形' },
  { id: 'climate', label: '气候' },
  { id: 'crystal', label: '晶石' },
  { id: 'bio', label: '生物' },
  { id: 'combined', label: '合并' },
];

// 渲染叠加层开关 + 一个特殊「点选重生点」模式开关（pickSpawn）。
export const OVERLAYS = [
  { key: 'energyFlow', label: '能量流' },
  { key: 'migrants', label: '迁徙者' },
  { key: 'thunderstorm', label: '雷暴' },
  { key: 'wind', label: '风向' },
  { key: 'criticalCells', label: '关键点' },
  { key: 'sourceSeals', label: '源井' },
  { key: 'humanBases', label: '吸能基地' },
  { key: 'energySiphon', label: '吸能区' },
  { key: 'gridLines', label: '网格线' },
  { key: 'spawnPoint', label: '重生点标记' },
  { key: 'pickSpawn', label: '点选设定重生点' },
];

export function buildLayerButtons(container, current, onSelect) {
  container.innerHTML = '';
  const btns = {};
  for (const l of LAYERS) {
    const b = document.createElement('button');
    b.className = 'btn' + (l.id === current ? ' active' : '');
    b.textContent = l.label;
    b.onclick = () => {
      Object.values(btns).forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      onSelect(l.id);
    };
    container.appendChild(b);
    btns[l.id] = b;
  }
  return btns;
}

export function buildOverlayToggles(container, state, onChange) {
  container.innerHTML = '';
  for (const o of OVERLAYS) {
    const lab = document.createElement('label');
    lab.className = 'ov-toggle' + (state[o.key] ? '' : ' off');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!state[o.key];
    cb.onchange = () => {
      lab.classList.toggle('off', !cb.checked);
      onChange(o.key, cb.checked);
    };
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(o.label));
    container.appendChild(lab);
  }
}

export function buildLegend(container, series, onToggle) {
  container.innerHTML = '';
  const valEls = {};
  for (const s of series) {
    const item = document.createElement('span');
    item.className = 'legend-item' + (s.on ? '' : ' off');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = s.color;
    const txt = document.createElement('span');
    txt.textContent = s.label + ' ';
    const val = document.createElement('b');
    val.textContent = '–';
    item.append(sw, txt, val);
    item.onclick = () => {
      const on = item.classList.toggle('off');
      onToggle(s.key, !on);
    };
    container.appendChild(item);
    valEls[s.key] = val;
  }
  return valEls;
}

export function buildStatsGrid(container, cards) {
  container.innerHTML = '';
  const valEls = {};
  for (const c of cards) {
    const cell = document.createElement('div');
    cell.className = 'stat';
    const k = document.createElement('div');
    k.className = 'k';
    k.textContent = c.label;
    const v = document.createElement('div');
    v.className = 'v';
    v.textContent = '–';
    cell.append(k, v);
    container.appendChild(cell);
    valEls[c.key] = v;
  }
  return valEls;
}
