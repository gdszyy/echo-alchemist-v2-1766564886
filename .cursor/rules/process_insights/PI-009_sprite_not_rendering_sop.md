---
id: "PI-009"
version: "v1.1"
last_updated: "2026-06-21"
author: "Manus AI"
related_modules: ["entities", "render_system", "core"]
status: "active"
---

# PI-009: Sprite 贴图不显示类型错误排查 SOP

## 流程概述

当在游戏中添加了新的 Sprite Sheet（如敌人、Boss、特效），但在运行时 Canvas 上完全看不到贴图，或者贴图显示异常（如扁扁的、比例失调）时，遵循此标准操作流程（SOP）进行排查。该流程涵盖了从资源加载、元数据映射到渲染层级的全链路诊断。

## 核心防坑指南

### 坑 1: 异步加载未提前触发（预加载缺失）

**现象**：第一次生成敌人时没有贴图，或者贴图闪烁。
**根因**：`SpriteRenderer` 是异步加载图片和 JSON 的，如果在生成实体时才触发加载，`ready` 状态为 `false`，`draw()` 会直接跳过绘制。
**正确做法**：必须在游戏初始化阶段（如 `core.js` 的构造函数中）调用 `preloadAllSprites()`，确保所有贴图资源进入 `_spritePool` 缓存。
**关键位置**：`src/core.js` → `constructor()` 约第 30 行。

### 坑 2: JSON 行映射错误（空白帧）

**现象**：贴图完全不显示，但控制台没有报错，且 `ready` 为 `true`。
**根因**：Sprite Sheet 的 JSON 元数据中，动画的 `row` 属性指向了图片中的空白行（例如 `row: 0`，但实际内容在 `row: 1`）。
**正确做法**：使用图像处理工具（如 Python 的 PIL 库）逐行扫描 PNG 文件的非透明像素，确认每一行是否有实际内容，并修正 JSON 中的 `row` 映射。
**关键位置**：`assets/sprites/enemies/*.json` → `animations` 对象。

### 坑 3: 渲染层级被覆盖（Z-Index 竞争）

**现象**：贴图不显示，但如果注释掉某些绘制代码（如血条），贴图就出现了。
**根因**：在 Canvas 2D 的顺序绘制中，后绘制的内容会覆盖先绘制的内容。如果 Sprite 绘制在血条（Layer 2）之前，满血时血条的 `fillRect` 会完全遮挡 Sprite。
**正确做法**：严格遵守 `enemy.js` 的层级规范，Sprite 必须在所有实心填充层（如底层纹理、血条）之后绘制。建议将 Sprite 放在 Layer 3.95（血条和内部特效之后，裂纹之前）。
**关键位置**：`src/entities/enemy.js` → `draw()` 约第 300-400 行。

### 坑 4: 宽高比与绘制区域不匹配（贴图扁扁）

**现象**：贴图显示了，但是被拉伸或压扁（例如 Boss 贴图扁扁的）。
**根因**：实体的物理尺寸（如 Boss 是 3:2 的长方形）与 Sprite 帧的尺寸（通常是正方形，如 256x256）不一致。如果直接使用实体的 `w` 和 `h` 绘制 Sprite，会导致拉伸。
**正确做法**：在绘制 Sprite 时，计算 `Math.min(w, h)` 作为边长，保持正方形比例，并在实体区域内居中绘制。
**关键位置**：`src/entities/enemy.js` → `draw()` 约第 380 行。

### 坑 5: ES 模块强缓存（调试陷阱）

**现象**：修改了 JS 代码或 JSON 文件，但刷新浏览器后依然是旧的表现。
**根因**：浏览器对 ES 模块（`type="module"`）有强缓存机制，普通的本地文件访问（`file://`）或简单的 HTTP 服务器可能无法强制刷新。
**正确做法**：在调试期间，必须使用无缓存的 HTTP 服务器（如仓库根目录提供的 `serve_nocache.py`），并在浏览器中禁用缓存（DevTools -> Network -> Disable cache）。

### 坑 6: 只改 manifest，漏改内嵌默认表（首帧/Node fallback 命中旧图）

**现象**：`assets/sprites/enemies/enemy_sprite_manifest.json` 已经指向新 PNG，但测试、首帧生成或 manifest fetch 失败时仍命中旧资源。
**根因**：`src/data/enemy_visual_assets.js` 同时维护 `_DEFAULT_COMPOSITES`、`_DEFAULT_ARCHETYPE_FILES` 和 `_DEFAULT_FRAMES`，用于 Node 环境、fetch 失败以及 manifest 尚未加载完成时的同步兜底。只更新 JSON manifest 不会更新这条 fallback 链。
**正确做法**：新增/替换敌人 Sprite 路径时，必须同步更新 `enemy_sprite_manifest.json` 与 `src/data/enemy_visual_assets.js` 的内嵌默认表，并用 `resolveEnemyVisualAsset()` spot check 目标敌人是否命中新路径。
**关键位置**：`src/data/enemy_visual_assets.js` → `_DEFAULT_COMPOSITES` / `_DEFAULT_ARCHETYPE_FILES`。

## 关键排查视角（SOP 顺序）

1. **资源存在性**：检查 PNG 和 JSON 文件路径是否正确，网络请求是否 404。
2. **加载状态**：在 `draw()` 中打印 `this.spriteRenderer.ready`，确认是否为 `true`。
3. **元数据准确性**：检查 JSON 中的 `frameSize` 和 `row` 是否与 PNG 实际内容匹配。
4. **层级顺序**：检查 `draw()` 函数中的绘制顺序，确认 Sprite 没有被后续的 `fillRect` 或 `fill()` 覆盖。
5. **比例与裁剪**：检查 `drawImage` 的参数，确认宽高比是否正确，以及外层的 `clip()` 是否意外裁剪了 Sprite。
6. **解析兜底**：检查 `enemy_sprite_manifest.json` 与 `enemy_visual_assets.js` 内嵌默认表是否同时指向同一资源。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.1 | 2026-06-21 | 补充 manifest 与内嵌默认资源表必须同步的防坑项，覆盖首帧/Node fallback 命中旧图问题 | Codex |
| v1.0 | 2026-04-25 | 初始记录，基于 echo-alchemist-v2 Boss 与敌人贴图修复经验提炼 | Manus AI |
