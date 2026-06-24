# Combat Emitter Muzzle Anchor Asset Pass

日期：2026-06-23

## 目标

修正炮管发射子弹与引导线起点的视觉偏差，并把引导线节点、炮口发射特效替换为绿幕抠图后的位图资产，减少手绘 Canvas 特效与当前炮管画风不一致的问题。

2026-06-24 调整：视觉重心改为炮管蓄能发光，炮口发射帧仅保留低透明、小尺寸的喷口反馈，避免开火瞬间特效过亮、喧宾夺主。

2026-06-24 追加修正：炮管与基座之间不使用外置 U 型夹臂。正确结构是补齐基座中央圆形转轴内的旋转圆盘/轴承盖，使炮管底部圆环坐进基座圆孔。绘制顺序为基座 -> 圆形转台 -> 炮管。

2026-06-24 厚度调整：圆形转台改为更厚的轴承盘，使用基座圆环与炮管底环像素重组，加宽外圈、加强前沿金属唇和中心轴承阴影，运行尺寸调整为 96px。

2026-06-24 炮管调整：替换直筒玻璃仓式 V4 炮管，使用第一版 V5 生成图的金属质感作为源图，经绿幕抠图后横向收窄并运行时缩放到 100px。目标读感是短锥形炼金炮管：保留厚金属炮口、暗金属肩部、底部安装环和少量青色能量窗，避免针筒/试管轮廓。

## 运行契约

- `port`：炮台旋转与瞄准方向计算锚点，用于保证拖拽方向稳定。
- `muzzle`：视觉炮口端点，用于子弹生成、引导线起点、炮口闪光挂点。
- 发射队列中的延迟/连发子弹必须携带 `x` / `y`，优先从 `pendingFireOrigin` 生成；兜底时使用当前炮口 `muzzle`。

## 新增资产

- 引导线节点：
  - `assets/ui/sprites/aim_guide_node_origin.png`
  - `assets/ui/sprites/aim_guide_node_wall.png`
  - `assets/ui/sprites/aim_guide_node_enemy.png`
  - `assets/ui/sprites/aim_guide_node_endpoint.png`
- 炮口闪光序列：
  - `assets/ui/sprites/emitter_muzzle_flash_v1_0.png`
  - `assets/ui/sprites/emitter_muzzle_flash_v1_1.png`
  - `assets/ui/sprites/emitter_muzzle_flash_v1_2.png`
  - `assets/ui/sprites/emitter_muzzle_flash_v1_3.png`
- 圆形转台/轴承盖：
  - `assets/ui/sprites/emitter_turret_ring_v1.png`
- 炮管：
  - `assets/ui/sprites/emitter_barrel_rotating_v5_runtime.png`

原始绿幕图与抠图中间产物保留在同目录，便于后续重新切片或二次调色。

## 性能自适应影响评估

- `high`：炮管蓄能使用固定数量线段/椭圆发光，炮口只绘制小尺寸 4 帧 PNG，圆形转台额外增加 1 次固定 `drawImage`，开销可控。
- `medium`：同样使用固定绘制路径与位图帧，降低阴影强度，仍遵循现有 `CONFIG.performance` 档位。
- `low`：禁用额外 `shadowBlur`，蓄能环数量降为 1，炮口只绘制低透明位图帧；圆形转台仍为单次位图绘制，避免新增高开销渐变或粒子对象。

本次没有新增粒子池或长期驻留对象；消耗端仍受现有 `CONFIG.performance` 档位约束。

## 验证

- `node --check src/render_system.js`
- `node --check src/game_phase.js`
- `node --check src/combat_system.js`
- `node --check src/game_system.js`
- `node --check src/bitmap_icons.js`
- `node tests/validate_phase_contracts.mjs`
- `node tests/validate_scenarios.js`
- 本地 `serve` 预览检查新 PNG 资源均返回 200。
