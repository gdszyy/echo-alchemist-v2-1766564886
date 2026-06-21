# World Sim Alpha Role Design

> 日期：2026-06-21  
> 范围：`src/world_sim/` 纯数据模型的后续设计草案；本文不表示代码已落地。  
> 关联文档：[`docs/world_lore_canon.md`](world_lore_canon.md)、[`.cursor/rules/world_sim.md`](../.cursor/rules/world_sim.md)、[`docs/world_sim_crystal_stability_research.md`](world_sim_crystal_stability_research.md)

## 1. 设计目标

Alpha 晶石不应只是会扩散的单一矿物，而应表现为一种失控的活性晶石网络。网络内部没有中央意志，却能像黏菌、叶脉、河网、骨组织重塑一样，通过局部反馈形成高效能量结构。

本设计引入 **Alpha 功能相**：`CELL_TYPE` 仍然只有 `ALPHA`，但每个 Alpha 元胞可以根据局部环境和网络需求动态分化出不同 `alphaRole`。这些分工不是新物种，而是同一种活性晶石在不同压力下形成的临时器官。

核心目标：

1. 保留 `ALPHA -> BETA` 的不可逆退化。`BETA` 是矿化残骸、失活骨架或灾害化石，不是休眠态。
2. 让 Alpha 网络按需形成汲能端、管线、仓储、前缘和低活性维持态。
3. 让玩家或模拟器能通过“断源、切线、炸仓、压前缘”的方式理解和干预晶石灾害。
4. 保持 `world_sim` 纯数据边界，不接入 DOM、Canvas、EventBus 或 `Game` 主类。
5. 不让地势影响晶石吸能。晶石吸能仍只看地幔能量、源井、雷暴和局部能量差。

## 2. 自然参考

| 自然系统 | 可借用机制 | 对应 Alpha 表达 |
|------|------|------|
| 黏菌网络 | 高收益路径强化，低收益支路回收 | 高流量格分化为 `conduit`，低流量格转 `dormant` |
| 叶脉/维管束 | 主脉负责长距离输送，局部细脉供给组织 | `conduit` 负责跨区输能，`frontier` 消耗能量扩张 |
| 河网 | 上游集水、干流输送、湖泊蓄水、三角洲扩张 | `collector`、`conduit`、`reservoir`、`frontier` |
| 骨组织重塑 | 按受力强化或吸收结构 | 高流量路径稳定，长期不用的 Alpha 退化 |
| 珊瑚礁/化石化 | 活体死亡后留下不可逆矿物结构 | `ALPHA -> BETA`，Beta 仅可采矿或作为地貌/资源残留 |

## 3. 数据模型

### 3.1 新增字段

字段必须由 `createCell()` 初始化，避免各层临时塞字段。

| 字段 | 类型 | 默认值 | 含义 |
|------|------|------|------|
| `alphaRole` | string | `'generic'` | Alpha 功能相。仅当 `crystalState === CELL_TYPE.ALPHA` 时有语义 |
| `alphaRoleAge` | number | `0` | 当前功能相已持续步数，用于防抖和成熟判定 |
| `alphaRoleScore` | object | `{}` | 本步或近期观测分数缓存，如吸能、流量、边界性 |
| `alphaRecentInflow` | number | `0` | 近期输入能量滑动值 |
| `alphaRecentOutflow` | number | `0` | 近期输出能量滑动值 |
| `alphaRecentAbsorption` | number | `0` | 近期从地幔/源井/雷暴吸收的能量 |
| `alphaDormantTicks` | number | `0` | 连续低活性步数，超过阈值后退化为 Beta |

### 3.2 枚举约定

第一版建议放在 `src/world_sim/params.js` 或新建轻量常量文件，避免在业务逻辑中散落裸字符串。

```js
export const ALPHA_ROLE = {
  GENERIC: 'generic',
  COLLECTOR: 'collector',
  CONDUIT: 'conduit',
  RESERVOIR: 'reservoir',
  FRONTIER: 'frontier',
  DORMANT: 'dormant',
};
```

`relay` 暂不进入第一版。它依赖割点、窄颈或关键路由判断，应等 `crystal_disaster.js` 的拓扑分析稳定后再接入。

## 4. 功能相参数

### 4.1 参数含义

| 参数 | 含义 |
|------|------|
| `storageMultiplier` | 最大储能倍率 |
| `absorptionMultiplier` | 从地幔、源井、雷暴吸能的倍率 |
| `transferMultiplier` | 单边能量传输上限与共享速率倍率 |
| `decayMultiplier` | 每步维持消耗倍率，越低越省能 |
| `growthMultiplier` | 向空地繁殖/扩张的倍率 |
| `stabilityMultiplier` | 抗断供和抗干预的阈值倍率 |
| `flowPriority` | 能量调度优先级，越高越优先接收或转发 |

### 4.2 推荐初始表

| Role | 定位 | 储能 | 吸能 | 传输 | 消耗 | 扩张 | 稳定 | 优先级 |
|------|------|------|------|------|------|------|------|------|
| `generic` | 普通活性晶石 | `1.0x` | `1.0x` | `1.0x` | `1.0x` | `1.0x` | `1.0x` | 1 |
| `collector` | 汲能晶石，靠近源井或高吸能区 | `0.8x` | `2.0x` | `1.0x` | `1.1x` | `0.6x` | `1.2x` | 3 |
| `conduit` | 管线晶石，高流量路径 | `0.5x` | `0.8x` | `2.5x` | `0.7x` | `0.4x` | `0.8x` | 4 |
| `reservoir` | 仓储晶石，网络腹地或交汇处 | `3.0x` | `0.9x` | `0.7x` | `0.8x` | `0.5x` | `1.5x` | 2 |
| `frontier` | 扩张前缘，负责侵蚀和繁殖 | `0.7x` | `1.2x` | `1.0x` | `1.4x` | `2.0x` | `0.7x` | 3 |
| `dormant` | 低活性维持态 | `0.6x` | `0.5x` | `0.4x` | `0.4x` | `0.0x` | `0.6x` | 0 |

推荐配置对象：

```js
export const ALPHA_ROLE_CONFIG = {
  generic: {
    storageMultiplier: 1.0,
    absorptionMultiplier: 1.0,
    transferMultiplier: 1.0,
    decayMultiplier: 1.0,
    growthMultiplier: 1.0,
    stabilityMultiplier: 1.0,
    flowPriority: 1,
  },
  collector: {
    storageMultiplier: 0.8,
    absorptionMultiplier: 2.0,
    transferMultiplier: 1.0,
    decayMultiplier: 1.1,
    growthMultiplier: 0.6,
    stabilityMultiplier: 1.2,
    flowPriority: 3,
  },
  conduit: {
    storageMultiplier: 0.5,
    absorptionMultiplier: 0.8,
    transferMultiplier: 2.5,
    decayMultiplier: 0.7,
    growthMultiplier: 0.4,
    stabilityMultiplier: 0.8,
    flowPriority: 4,
  },
  reservoir: {
    storageMultiplier: 3.0,
    absorptionMultiplier: 0.9,
    transferMultiplier: 0.7,
    decayMultiplier: 0.8,
    growthMultiplier: 0.5,
    stabilityMultiplier: 1.5,
    flowPriority: 2,
  },
  frontier: {
    storageMultiplier: 0.7,
    absorptionMultiplier: 1.2,
    transferMultiplier: 1.0,
    decayMultiplier: 1.4,
    growthMultiplier: 2.0,
    stabilityMultiplier: 0.7,
    flowPriority: 3,
  },
  dormant: {
    storageMultiplier: 0.6,
    absorptionMultiplier: 0.5,
    transferMultiplier: 0.4,
    decayMultiplier: 0.4,
    growthMultiplier: 0.0,
    stabilityMultiplier: 0.6,
    flowPriority: 0,
  },
};
```

## 5. 分化规则

分化规则必须基于近期观测，不应单步抖动。建议所有判断使用滑动平均或计数器，并设置最小持续步数。

| 条件 | 目标功能相 | 说明 |
|------|------|------|
| 近期从地幔/源井/雷暴吸能高，且周围 Alpha 不少 | `collector` | 表示该格成为稳定入口 |
| 近期输入和输出都高，自身不长期积能 | `conduit` | 表示该格主要承担输能 |
| 近期输入高于输出，储能接近上限，邻接 Alpha 多 | `reservoir` | 表示该格成为网络蓄水池 |
| 位于 Alpha 边界，邻接空地，储能充足 | `frontier` | 表示该格承担扩张压力 |
| 近期吸能、输入、输出都低，且无扩张机会 | `dormant` | 表示网络开始回收支路 |
| `dormant` 连续低于维持线 | `BETA` | 不可逆矿化，清空 `alphaRole` 语义 |

推荐优先级：

1. `dormant` 退化为 `BETA`
2. `frontier`
3. `collector`
4. `reservoir`
5. `conduit`
6. `generic`

说明：`frontier` 优先于 `collector`，是为了避免边界源井附近的晶石只吸能不扩张；`reservoir` 优先于 `conduit`，是为了让能量堆积点先成为仓储，再由周边形成管线。

## 6. 能量公式接入点

### 6.1 最大储能

```text
effectiveMaxEnergy = maxCrystalEnergy * role.storageMultiplier
```

当角色切换导致当前储能超过新上限时，不建议瞬间截断。第一版可让超额能量在后续代谢中自然外流或按 `overflowDecayRate` 缓慢泄出，避免角色切换造成能量跳变。

### 6.2 吸能

```text
absorbed = baseAbsorbed * role.absorptionMultiplier
```

适用来源：

- 地幔能量吸收
- `mantleSourceStrength` 源井补能
- 雷暴充能

不适用来源：

- Alpha 间共享传输。共享传输走 `transferMultiplier`。

### 6.3 传输

```text
effectiveSharingLimit = energySharingLimit * sourceRole.transferMultiplier
effectiveSharingRate = energySharingRate * sourceRole.transferMultiplier
```

第一版建议只让源格角色影响“可输出能力”，避免源格和目标格同时加成导致指数膨胀。目标格的 `flowPriority` 可用于排序接收者，但不直接放大能量。

### 6.4 维持消耗

```text
effectiveDemand = alphaEnergyDemand * role.decayMultiplier / role.stabilityMultiplier
```

`reservoir` 和 `dormant` 更耐断供，`frontier` 更昂贵。这样前缘扩张会自然需要后方管线与仓储支撑。

### 6.5 扩张

```text
effectiveExpansionCost = expansionCost / role.growthMultiplier
```

当 `growthMultiplier === 0` 时禁止扩张。`dormant` 不扩张，`conduit` 和 `reservoir` 也不应成为主要扩张源。

## 7. 可视化语义

本文不实现渲染，但建议未来视图层按以下方式读取纯数据字段：

| Role | 视觉语义 |
|------|------|
| `collector` | 根状吸能点，靠近源井处更亮，脉冲向外流出 |
| `conduit` | 细长亮脉，流动方向清晰，储能低但流速高 |
| `reservoir` | 厚重晶核或鼓包，亮度稳定，受击时可能释放大量能量 |
| `frontier` | 锯齿状、分叉状边缘，向空地伸展 |
| `dormant` | 暗淡、钙化边缘，接近 Beta 的矿物质感 |

视图层只能读取 `alphaRole`、`energyFlow`、`storedEnergy` 等字段，不得反写模拟状态。

## 8. 玩法语义

| 玩家行为 | 目标 Role | 结果 |
|------|------|------|
| 断源 | `collector` | 降低整片网络长期补能 |
| 切线 | `conduit` | 让前缘和仓储分离，制造饥饿区 |
| 炸仓 | `reservoir` | 快速削弱续航，但可能触发一次性能量外泄 |
| 压前缘 | `frontier` | 阻止扩张，争取时间 |
| 清残 | `dormant` | 阻止低活性支路恢复为其他功能相 |

这能把晶石灾害从“看到 Alpha 就清掉”升级为“读懂能量网络的器官结构”。玩家可以从流向判断要害，而不是靠固定坐标解谜。

## 9. 实装阶段建议

### Phase 1：数据字段与静态倍率

- 在 `cell.js` 初始化 Alpha 角色相关字段。
- 在 `params.js` 增加 `ALPHA_ROLE_CONFIG` 和分化阈值。
- `updateCrystalLayer()` 读取 `alphaRole` 影响储能、吸能、传输、消耗、扩张。
- 所有新字段保持默认兼容：旧场景初始都是 `generic`。

### Phase 2：近期观测与自动分化

- 在晶石代谢和网络共享阶段记录 `alphaRecentAbsorption`、`alphaRecentInflow`、`alphaRecentOutflow`。
- 在 `crystal_expansion` 前后计算边界性、邻接 Alpha 数、邻接空地数。
- 新增 `updateAlphaRoles()` 或 `crystal_role` 分段，统一处理角色切换。

### Phase 3：拓扑角色

- 等 `crystal_disaster.js` 的关键割点分析稳定后，引入 `relay`。
- `relay` 只由拓扑分析或稳定高流量交汇触发，不由单步邻居数量触发。

## 10. 测试验收

第一版至少需要以下测试：

1. 固定 seed 下，默认场景运行后存在多种 `alphaRole`，且不是全部 `generic`。
2. 人工高源井场景中，源井邻近 Alpha 倾向分化为 `collector`。
3. 人工单通道场景中，长期高流量路径倾向分化为 `conduit`。
4. 人工能量汇聚场景中，交汇高储能格倾向分化为 `reservoir`。
5. 边界高储能 Alpha 倾向分化为 `frontier`，且扩张强于 `generic`。
6. 断供后低流量支路先进入 `dormant`，持续低能后退化为 `BETA`。
7. `BETA` 不会因为周围高能 Alpha 或源井重新变为 `ALPHA`。
8. 同等地幔能量下，地势高低仍不影响 Alpha 吸能。
9. 所有文件保持纯数据，不引入 DOM、Canvas、EventBus 或 `Game` 依赖。

## 11. 设计边界

- 不新增 `CELL_TYPE`。功能相是 `ALPHA` 内部字段。
- 不让 `BETA` 复活。Beta 只能作为惰性矿物被开采、清除或用于叙事/地貌表达。
- 不在第一版实现全局最优路由。局部流量反馈已经足够表达“像有智能但无意识”的自然计算感。
- 不让角色切换过于频繁。所有分化必须有持续阈值、冷却或 `alphaRoleAge` 防抖。
- 不把 `relay` 提前塞进第一版。它需要拓扑分析支撑，否则容易变成邻居数量的重复包装。

