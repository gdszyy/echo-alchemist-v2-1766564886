# 钉盘组件深化设计 V2

> 日期：2026-06-19  
> 范围：`#phase-gathering`、`#module-editor-layer`、`src/pinboard_modules.js`、`src/game_phase.js`、`src/ui_system.js`  
> 目标：解决初始钉盘偏左/偏右、组件特色不足、异形组件缺少真实路径差异的问题。
> 实现状态：P0-D1 / P0-D2 已落地；P1 首批商店异形组件、编辑态轻量轮廓、放置覆盖预览、符文融合摘要、开始采集边界检查、首行 5 个初始钉板与底部奖励分栏已落地。

---

## 1. 现状问题

当前模块化钉盘已经具备组件实例、库存、符文融合优先级、多格占用与编辑器校验，但仍有三类体验问题：

1. **旧初始布局左对齐感明显**：早期 `moduleCols=4`、`moduleDefaultSlots=3` 时默认构建 row-major 前 3 格，画面中心会落在第 2/3 格之间，视觉上偏向一侧。
2. **旧组件形态仍像“钉子密度变体”**：不少组件只是 3x3、4x4、三角/菱形的点阵变化，缺少“看到轮廓就知道这块板子会怎么改路”的强识别。
3. **异形组件必须有机制收益**：多格组件和首发 1x1 组件都需要明确路线、固定属性/融合优先级或 `SpecialSlot` 收益，避免不如常规交错钉子模块。

---

## 2. 设计原则

### 2.1 初始布局必须是两行

初始钉盘改为 **两行铺满布局**，每行 `5` 个槽：

- 当前默认：首行 5 个小组件；第二行与第三行通过局内扩容逐步解锁，降低开局信息量。
- 后期扩展：在 5 列基础上增加第三行，但第三行也优先按 `3` 或 `5` 居中解锁，避免出现 4 列行带。

采用奇数列的原因：发射口、重力中心、钉盘中轴都天然落在中间槽，不会出现“3 个槽塞进 4 列网格导致偏一边”的问题。

### 2.2 组件要有“路线身份”

每个钉盘组件不只描述收益，还必须回答：

- **入口**：弹珠从哪里容易进入？
- **出口**：弹珠大概率从哪里离开？
- **节奏**：加速、减速、分流、回收、聚焦还是横移？
- **风险**：容易漏球、卡球、偏航还是过度随机？
- **符文关系**：适合融合、固定属性、触发特殊槽，还是纯路线组件？

### 2.3 异形优先复用现有实体

第一阶段不新增物理实体类型，先用现有能力拼出真实异形：

- `Peg`：普通钉、属性钉、`pink` 高弹钉，以及 `shape='barrier'` 的异形挡板钉。
- `SpecialSlot`：`wheel`、`multicast`、`recall`、`split` 等已有槽。
- `fusionPriority`：标记符文融合落点。
- `layoutRole`：只做轻量描边/符号语义，不加粒子。

### 2.4 模块接缝必须参与设计

模块不能按孤岛设计。相邻模块的左/右边缘钉、上下行模块的底/顶边缘钉会共同形成弹珠通道，因此：

- `moduleSpacingX` / `moduleSpacingY` 默认为 `0`，不再用空白间隔区分模块。
- 首发模块统一补“接缝实体”：左右边缘使用安全圆钉和必要的 `barrier` 异形钉，让模块拼接后仍像连续钉阵。
- 接缝圆钉必须做近距保护，避免为了密度把钉距压到容易卡球。
- 多格异形模块只在外边缘补接缝实体，内部空间由模块自身路径设计负责。
- 圆钉两两中心距必须大于倍化弹珠通行距离：`2*pegRadius + 2*(marbleRadius + maxMarbleSizeBonus) + pinboardSpacingBuffer`，当前约 `23.8px`。
- 斜翼、杯口、回环、挡板等连续形状必须使用 `barrier` 异形钉实现，禁止用近距离圆钉硬拼。

---

## 3. 槽位布局设计

### 3.1 推荐底层网格

底层仍可用数组存储，但视觉和构建上改成 **5 列中心网格**：

```text
列:     0      1      2      3      4
      [L2]   [L1]   [C]    [R1]   [R2]

行 0:  00     01     02     03     04
行 1:  05     06     07     08     09
行 2:  10     11     12     13     14
```

初始 `5 + 5` 直接铺满前两行：

```text
行 0:  [00]   [01]   [02]   [03]   [04]
行 1:  [05]   [06]   [07]   [08]   [09]
```

第三行建议先解锁中间三格，再解锁两翼：

```text
行 2:         [11]   [12]   [13]        -> 后期第一段
行 2:  [10]   [11]   [12]   [13]   [14] -> 后期完整
```

### 3.2 配置建议

保留 `currentModuleLayout` 数组模型，但新增显式顺序，避免所有逻辑继续假设 `0..cap-1`：

```js
moduleCols: 5,
moduleRows: 3,
moduleDefaultSlots: 5,
moduleInitialSlots: [0, 1, 2, 3, 4],
moduleUnlockOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 10, 14],
```

构建、编辑器命中、放置校验都应从“前 cap 个 row-major 槽”改为：

```text
activeSlots = moduleUnlockOrder.slice(0, unlockedModuleSlots)
```

多格组件放置时必须检查覆盖槽全部在 `activeSlots` 内，而不是只检查 `covered.some(ci >= cap)`。

### 3.3 初始 10 组件建议

初始布局要兼顾密度、可读、可融合、可反弹和真实机关收益：

```text
行 0:  左导流翼   分裂符文桥(2x1)        连射门     右导流翼
行 1:  轻回环     弹跳室     炼金核     接球杯     轻轮盘杯
```

对应组件：

| 槽 | 组件 | 职责 |
|---|---|---|
| 00 | `guide_fin_left` | 左侧导流，固定 `wind` 钉 + `pink` 翼把偏航球推回中线 |
| 01-02 | `split_lattice_bridge` | `2x1` 分裂符文桥，内置 `split` 槽并提供融合承载 |
| 03 | `multicast_gate_light` | 内置 `multicast` 槽，命中后追加连射 |
| 04 | `guide_fin_right` | 右侧导流，与左翼镜像 |
| 05 | `recall_loop_light` | 内置 `recall` 槽，提供漏球回收 |
| 06 | `bounce_chamber` | 密集高弹区，制造第一次明显反弹 |
| 07 | `crucible_seed` | 初始炼金核，固定属性钉 + 可融合钉 |
| 08 | `catcher_cup` | U 型杯 + `recall` 槽，减少直落挫败 |
| 09 | `wheel_cup_light` | 杯形导流 + `wheel` 槽，复制已收集属性 |

历史异形默认盘目标曾为约 `75` 个安全圆钉 + `10` 个 `barrier` 异形挡板钉 + `5` 个 SpecialSlot；当前默认盘已回退为纯 `dense_stagger` 交错钉板，异形组件仅作为商店/后续可替换组件，不再进入开局默认盘。

---

### 3.4 当前初始钉盘覆盖方案（2026-06-19）

当前开局默认布局以首行 5 个 `dense_stagger` 1x1 小模块为准。默认盘只做普通交错钉板，不放 `wheel`、`pink` 弹力角、`starter_*`、`^` 形机关或其它异形默认模块；爆破/激光等奖励专属属性改由底部小概率奖励分栏提供。旧的首发多异形组件组合、临时 `caret_wheel_field` 超大模块与 `starter_*` 默认盘仅作为迁移来源，不再作为默认盘面。

约束：
- 默认盘不使用圆钉硬拼挡板；需要挡板时必须使用 `shape='barrier'`。
- `dense_stagger` 当前默认盘仅由首行 5 个普通交错模块组成；具体圆钉数量由模块生成器按安全间距计算，不包含默认 barrier 或 SpecialSlot。
- 圆钉两两中心距必须大于 `2 * pegRadius + 2 * (marbleRadius + maxMarbleSizeBonus) + pinboardSpacingBuffer`；当前默认盘最小距离约 `29.49px`，高于 `23.8px` 阈值。

## 4. 异形组件池

### 4.1 组件分类

| 分类 | 作用 | 典型收益 | 典型风险 |
|---|---|---|---|
| 导流类 | 改变横向路线 | 把偏航球拉回中心或推向特定侧 | 过强会降低随机性 |
| 聚焦类 | 把球汇入中心/槽位 | 提高融合钉、特殊槽命中率 | 容易拥堵或重复命中 |
| 分流类 | 把一路拆成两路 | 提高覆盖面和随机性 | 收益不稳定 |
| 回收类 | 给漏球第二次机会 | 提升新手容错 | 回合时长变长 |
| 属性类 | 固定属性/词条方向 | 构筑目标清晰 | 泛用性低 |
| 奖励类 | 轮盘、连射、召回等 | 峰值高 | 需要路线配合 |

### 4.2 首批组件清单

| ID | 名称 | 占位 | 分类 | 形态 | 机制 |
|---|---|---:|---|---|---|
| `guide_fin_left` | 左导流翼 | 1x1 | 导流 | 左高右低斜翼 | 8 个安全圆钉 + 1 根 `barrier` 斜翼，固定 `wind` 钉形成导流身份 |
| `guide_fin_right` | 右导流翼 | 1x1 | 导流 | 右高左低斜翼 | 与左导流翼镜像，8 个安全圆钉 + 1 根 `barrier` 斜翼 |
| `split_lattice_bridge` | 分裂符文桥 | 2x1 | 分流/融合 | 宽桥 | 19 个安全圆钉 + 2 根 `barrier` 导流翼 + `split` 槽 |
| `split_gate_light` | 轻分裂门 | 1x1 | 分流 | 窄门 | 12 颗钉夹住 `split` 槽，提供真实分裂收益 |
| `multicast_gate_light` | 连射门 | 1x1 | 奖励 | 沙漏门 | 7 个安全圆钉夹住 `multicast` 槽，命中后追加连射 |
| `recall_loop_light` | 轻回环 | 1x1 | 回收 | 小回环 | 7 个安全圆钉 + 2 根 `barrier` 回环，降低漏球挫败 |
| `wheel_cup_light` | 轻轮盘杯 | 1x1 | 奖励 | 杯形 | 6 个安全圆钉 + 1 根 `barrier` 杯口导向 `wheel` 槽 |
| `rune_lattice_light` | 轻符文格 | 1x1 | 聚焦/融合 | 小菱格 | 13 颗普通钉，中心 `fusionPriority=3`，承担初始密集融合目标 |
| `bounce_chamber` | 弹跳室 | 1x1 | 回收 | 圆角反弹腔 | 7 个安全圆钉 + 2 根 `barrier` 腔壁，`pink` 维持强反馈 |
| `crucible_seed` | 炼金核 | 1x1 | 属性/融合 | 三角核 | 6 个安全圆钉，固定候选属性钉 + 融合优先钉构成三角核 |
| `catcher_cup` | 接球杯 | 1x1 | 回收 | U 型杯 | 7 个安全圆钉 + 1 根 `barrier` 杯口 + `recall` 槽 |
| `split_yoke` | 分叉轭 | 2x1 | 分流 | Y 字 | 10 颗钉补齐 Y 字入口和左右出口，内置 `split` 槽可选 |
| `hourglass_gate` | 沙漏门 | 1x2 | 聚焦 | 上宽下窄再张开 | 11 颗钉强化上下收束点，适合接轮盘/连射槽 |
| `crescent_bank` | 月牙坡 | 2x1 | 导流 | 弧形斜坡 | 10 颗钉沿弧线与内侧回中点排布，强制横移后回中 |
| `spiral_return` | 螺旋回廊 | 2x2 | 回收/奖励 | 小螺旋 | 13 颗钉 + 内圈 `recall` 槽，峰值高但占位大 |
| `prism_splitter` | 棱镜分光器 | 1x1 | 属性/分流 | 三射线 | 9 颗钉组成三射线路径，固定属性钉适合散射/穿透构筑 |
| `twin_wheel_bridge` | 双轮桥 | 3x1 | 奖励 | 横桥 | 11 颗钉 + 两个 `wheel` 槽，中间导流更连续，传奇级大件 |

### 4.3 组件强度约束

首批组件按“形态强，数值克制”落地：

- 1x1 首发组件安全圆钉建议 `6 - 9`，连续形状额外使用 `barrier`。
- 2x1 / 1x2 组件安全圆钉建议 `12 - 22`，但必须有明确路线或机关收益。
- 2x2 组件安全圆钉建议 `18 - 32`，且只放入稀有/史诗池。
- 3x1 组件只放传奇或特殊奖励池，不能进入初始盘。
- 任何带 `SpecialSlot` 的组件都要减少普通 Peg 数量，避免“既高频碰撞又高峰奖励”。

---

## 5. 编辑器视觉语法

编辑器需要让玩家一眼看懂“这是一个组件，不是普通网格”：

| 状态 | 视觉建议 |
|---|---|
| 空槽 | 细虚线边框 + 半透明中心十字 |
| 已安装 | 按组件外轮廓画淡色描边，不只画矩形 |
| 当前选中 | 矩形外框 + 组件轮廓双层描边 |
| 可放置 | 绿色淡扫光覆盖目标槽 |
| 不可放置 | 红色斜线覆盖，并显示统一原因 |
| 多格占用 ref | 不画独立按钮，只在锚点组件轮廓内显示被覆盖范围 |
| 可融合钉 | 轻量圆环，不新增 `shadowBlur` 或粒子 |

实现上可以给 `MODULE_DEFS` 增加 `shape` 元数据：

```js
shape: {
    footprint: 'fin-left' | 'fin-right' | 'cup' | 'hourglass' | 'spiral' | 'bridge',
    entry: 'top' | 'top-left' | 'top-right' | 'center',
    exit: 'bottom' | 'bottom-left' | 'bottom-right' | 'split',
}
```

Canvas overlay 只根据 `shape.footprint` 画廉价线框，不参与物理。

---

## 6. 实现拆分建议

### Phase P0-D1：居中初始布局

目标：先修“偏左/偏右怪”。

1. `CONFIG.gameplay` 增加 `moduleInitialSlots` / `moduleUnlockOrder`，把 `moduleCols` 调整为 5。
2. `createDefaultModuleLayout()` 按 slot index 写入默认组件，而不是填充前 N 个。
3. `phase_gathering_initPachinko_v2()` 改为遍历 active slot list。
4. `_moduleEditor_getSlotRects()` 和 `_moduleEditor_getModulePlacementStatus()` 改用 active slot set 校验。
5. 旧存档迁移：若旧 layout 长度为 12，则把旧前 6 个组件迁移到 `[1,2,3,6,7,8]`，其余按顺序迁入扩展槽。

### Phase P0-D2：历史首批 10 个初始异形组件方案

目标：初始盘不再像普通点阵。

新增：

- `guide_fin_left`
- `guide_fin_right`
- `split_gate_light`
- `multicast_gate_light`
- `recall_loop_light`
- `wheel_cup_light`
- `rune_lattice_light`
- `bounce_chamber`
- `crucible_seed`
- `catcher_cup`

该方案已从当前默认盘移出：默认布局只使用首行 5 个 `dense_stagger`，上述组件如仍保留，应作为商店/旧存档兼容来源，不再直接进入开局默认盘。

### Phase P1：商店异形组件池

目标：让局内商店出现真正改变路径的组件。

新增：

- `split_yoke_module`（已落地）
- `hourglass_gate_module`（已落地）
- `crescent_bank_module`（已落地）
- `spiral_return_module`（已落地）
- `prism_splitter_module`（已落地）
- `twin_wheel_bridge_module`（已落地）

商店展示卡需要显示：

- 占位：`1x1` / `2x1` / `1x2` / `2x2` / `3x1`
- 路线：聚焦 / 分流 / 回收 / 横移 / 奖励
- 风险：漏球 / 高随机 / 占位大 / 需要配合

---

## 7. 性能自适应影响评估

本设计第一阶段不新增粒子、混合模式、`shadowBlur` 或新渐变。性能风险主要来自 Peg 数量和 SpecialSlot 数量。

- `high`：允许完整组件轮廓、所有 Peg 软阴影和底部光晕，沿用现有 `pegSoftShadow` / `pegGlowHalo`。
- `medium`：Peg 光晕按现有预算关闭，组件轮廓仍保留廉价描边。
- `low`：关闭 Peg 软阴影和光晕，组件轮廓仅保留纯色线框；可融合钉只画平面圆环。

硬性预算建议：

- 初始 `5+5`：安全圆钉约 `75`，`barrier` 约 `10`，SpecialSlot 不超过 `5`。
- 后期三行完整：安全圆钉硬上限 `130`，`barrier` 硬上限 `20`，SpecialSlot 不超过 `8`。

若实现时新增任何高开销 Canvas 效果，必须补 `// @perf-impact` 并同步更新 `.cursor/rules/performance.md`。

---

## 8. 验收清单

- 初始进入收集阶段时，钉盘为两行，且每行 5 个组件，整体中心对齐。
- 任意移动端宽度下，初始盘中轴与发射口/画布中线一致。
- 组件外观和收益都能区分导流、聚焦、分裂、连射、回收、属性、奖励。
- 多格组件放置时，校验基于 active slot set，不会覆盖未解锁槽或隐藏 ref。
- 符文融合目标在模块内可预测，且写回组件 `pegStates` 后重建不丢失。
- `node --check src/pinboard_modules.js`
- `node --check src/game_phase.js`
- `node --check src/ui_system.js`
- `node tests/validate_scenarios.js`
