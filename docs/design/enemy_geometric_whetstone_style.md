# 敌人统一美术风格：几何磨石块基座

本文档定义敌人后续美术重构的统一母题。目标不是要求所有敌人都做成 GIF，而是让 Canvas 矢量回退、PNG Sprite Sheet、组合资产和 UI 图鉴头像都遵循同一套视觉语言：**敌人是被打磨过的几何磨石块，机制核心像矿物或炼金器官一样镶嵌在石块内部**。

资产重生成批次、prompt 模板、接入流程和验收标准见 [`enemy_asset_regeneration_plan.md`](enemy_asset_regeneration_plan.md)。

## 1. 核心概念

敌人的第一眼识别应来自三层结构：

| 层级 | 视觉职责 | 规则 |
|---|---|---|
| 几何磨石基座 | 表达 footprint、碰撞体积和基底职责 | 必须占据主体体积，形状清晰，边缘有磨损、倒角和切削痕 |
| 镶嵌核心 | 表达专属词条或 Boss 机制 | 嵌在基座内部，不悬浮在外；核心形状随基底变化 |
| 词条覆层 | 表达 shield、regen、haste 等通用词条 | 只做薄膜、纹路、边缘刻线或局部晶片，不改写主体轮廓 |

“磨石块”不是单一方块。它应当是经过切削、研磨、撞击和炼金腐蚀的几何体：切角矩形、楔形、柱体、环形、棱镜、履带状石板都可以，但必须保留同一套材质特征。

## 2. 统一材质语言

### 2.1 基座材质

- 主材质：深灰石、黑曜石、磨砂金属矿、暗色陶瓷或晶化矿壳。
- 边缘：清晰倒角、磨白边、缺口、裂纹、压痕和粉尘感。
- 表面：低频颗粒噪声、弧形研磨纹、细碎矿脉，不使用大面积光滑塑料感。
- 厚度：所有敌人都要有“块体感”，避免只像一张发光贴纸。

### 2.2 镶嵌核心

- 核心必须嵌入基座内部，周围有金属扣、石槽、压环、铆钉或裂口。
- 核心颜色表达属性或机制，但面积不应超过主体的 35%，避免颜色盖过 footprint。
- 核心可以是晶核、胃囊、声波柱、卵囊、黑核、热管、折光线等。

### 2.3 光效边界

- 高亮只用于核心、裂缝、刻线和状态覆层，基座本体保持低饱和。
- `low` 档必须仍能通过轮廓和石槽读出敌人身份，不依赖光晕。
- 通用词条覆层优先使用几何刻线、边缘膜、角落晶片，不使用覆盖全身的大面积云雾。

## 3. 各基底风格映射

| baseArchetype | 统一形象 | 镶嵌核心 | 轮廓关键词 |
|---|---|---|---|
| `residue` | 单格炼金残渣磨石 | 小型暗核或矿点 | 切角小石块、裂缝、低亮度 |
| `bastion` | 三段横向磨石梁 | 中央重甲芯和两侧铆钉槽 | 横梁、厚边、三段拼接 |
| `maw` | 被掏空的圆角磨石胃囊 | 内嵌暗红吞噬腔 | 缺口、内凹、锯齿石槽 |
| `deflector` | 低矮楔形盾石 | 前缘青蓝偏折薄膜 | 斜面、盾壳、薄膜槽 |
| `echoSpire` | 细高共振石柱 | 顶部裂纹晶核和内嵌声纹 | 空心柱、纵向槽、环形波 |
| `prism` | 竖直折光磨石棱柱 | 中央白色折射线 | 长棱镜、切面、透明石边 |
| `hive` | 多孔孵化石巢 | 半透明卵囊嵌在孔洞内 | 多孔、隔膜、黏液石槽 |
| `siege` | 双层履带磨石车 | 抗冻热管和前置推铲芯 | 履带、推铲、警戒刻线 |
| `gravityWell` | 三层环形磨石炉心 | 中央黑核和向心网格 | 环壁、塌缩线、重力槽 |

Boss 也应沿用该母题：Boss 不是另一个物种，而是更复杂、更巨大的“几何磨石块基座 + 多核心镶嵌体”。例如 Ignis 是熔炉磨石装甲，Glacies 是霜晶缝合磨石，Ouroboros 是环形磨石蛇炉。

## 4. 资产生产规则

### 4.1 推荐交付形态

- 优先：透明背景 PNG Sprite Sheet，沿用现有 128px frame contract。
- 可选：静态 PNG + Canvas 轻量呼吸动画。
- 不要求 GIF。GIF 只适合作为外部预览，不进入游戏运行时资源管线。
- 组合资产命中失败时，仍回退到现有 Canvas 矢量基底和通用词条覆层。

### 4.2 AI / 手绘 Prompt 骨架

```text
transparent background game enemy sprite, geometric whetstone block base,
dark alchemical fantasy, beveled worn stone, ground edges, chipped mineral surface,
embedded glowing core inside carved socket, clear footprint silhouette,
no text, no UI, no health bar, no full background, readable at 128x128
```

针对不同基底追加一句结构描述，例如：

- `bastion`：`three linked horizontal grinding-stone slabs, heavy armor core, riveted grooves`
- `maw`：`hollow rounded stone maw, embedded dark red vortex stomach, chipped inner teeth`
- `gravityWell`：`three concentric grinding-stone rings, embedded black gravity core, inward etched grid lines`

### 4.3 禁止项

- 不把敌人做成纯软体、纯雾气、纯火焰或纯机械载具。
- 不让通用词条覆层覆盖主体 silhouette。
- 不用文字、数字、Logo、血条或完整背景烘进 Sprite。
- 不为每个词条组合手写渲染分支；资产差异通过 manifest 和 `resolveEnemyVisualAsset(enemy)` 接入。

## 5. 性能与验收

- 新资产只替换位图时，不新增粒子、混合模式、`shadowBlur` 或渐变预算。
- 若新增运行时发光、粒子、径向渐变或 `screen` / `lighter` 混合，必须按 `.cursor/rules/performance.md` 补 `// @perf-impact` 与三档评估。
- 验收入口继续使用试炼场 `enemy_v2` 分类：检查 silhouette、footprint、状态短标签、通用词条覆层和 `Vector fallback` 是否都保持可读。
