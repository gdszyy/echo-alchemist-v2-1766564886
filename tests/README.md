# Echo Alchemist v2 — 自动化测试

本目录包含两层验证：T1 是无需浏览器的 Node 静态/运行时合同，T3 是连接本地游戏服务的真实浏览器回归。默认本地地址统一为 `http://localhost:3002`。

## T1：全量 Node 闸门

先校验 `src/` 与 `tests/` 内全部 JavaScript 语法：

```powershell
$files = @(
    Get-ChildItem src -Recurse -File
    Get-ChildItem tests -Recurse -File
) | Where-Object { $_.Extension -in '.js', '.mjs' }
foreach ($file in $files) {
    node --check $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "syntax failed: $($file.Name)" }
}
```

再运行仓库内全部 `validate_*`：

```powershell
$validators = Get-ChildItem tests -File -Filter 'validate_*' | Sort-Object Name
foreach ($validator in $validators) {
    node $validator.FullName
    if ($LASTEXITCODE -ne 0) { throw "validator failed: $($validator.Name)" }
}
```

这会自动覆盖当前所有验证器，避免 README 的手写清单随新增测试过期。本轮 UI 集成重点包括：

- `validate_tutorial_flow.mjs`
- `validate_run_lifecycle.mjs`
- `validate_mobile_ui_contracts.mjs`
- `validate_launcher_settlement_ux.mjs`
- `validate_ui_terminology.mjs`
- `validate_phase_contracts.mjs`
- `validate_core_optional_clip_pack.mjs`

核心机制、Boss、敌人、药剂、符文、波次与 `world_sim` 的其余 `validate_*` 也必须一并通过；不能只跑 UI 专项。

## T3：浏览器回归

### 1. 启动或复用服务

Runner 不会启动服务。运行前先检查 3002；如已有本项目服务应直接复用，不得重复启动。

```powershell
Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue
npm start
```

### 2. 浏览器驱动

Runner 优先使用项目可解析的 Puppeteer；没有 Puppeteer 时回退到 Playwright，并自动尝试本机 Chrome/Edge。Codex bundled Playwright 可通过 `NODE_PATH` 暴露：

```powershell
$env:NODE_PATH='C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules;C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules'
```

为避免外网抖动污染本地 UI 证据，浏览器适配层只精确拦截 Google Fonts 和页面固定引用的 PixiJS 7.4.2 CDN URL：字体返回空 CSS，Pixi URL 返回空 JavaScript，让应用走其既有 Canvas 2D fallback。本套件因此验证 UI/交互与 Canvas fallback，不宣称覆盖 Pixi WebGL；本地资源、应用脚本和其他网络错误仍会失败。

### 3. Goal E 四视口命令

```powershell
node tests/ai_test_runner.js `
  --url http://localhost:3002 `
  --suite ui-polish `
  --headless `
  --artifacts tmp/codex/REQ-20260717-ui-polish-integration/t3-final
```

默认逐档覆盖：

- `mobile-360x800`
- `mobile-390x844`
- `mobile-480x854`
- `desktop-1440x900`

调试单档视口：

```powershell
node tests/ai_test_runner.js --suite ui-polish --headless --viewport mobile-360x800
```

每档运行八个正式用例：

1. 空存档首局教程：真实点击开始、选择遗物、resolver 进入研磨，并以受控 combat 事件完成末步。
2. pause lease：父/子释放顺序、焦点语义及最后 lease 释放时的同步 launcher continuation 重入。
3. save / Continue / abandon：真实跨页面重载、Round 4 恢复、确认放弃和延迟 callback 不复活。
4. 商店 / round-start resolver：dialog、disabled/ARIA、关闭幂等和单次终点。
5. 训练场 / 真理之书：响应式挂载、同会话移动→桌面→移动往返、返回链、桌面训练 pane 清理和符文挂载恢复。
6. 炼金台：移动焦点陷阱、短按/长按/touchcancel、picker Escape、Codex 四态、术语与知识双向入口；桌面验证非模态 region 和真实可见尺寸。
7. gameover：30% 结算、术语、滚动、存档与旧 overlay/lease 清理。
8. 运行时零红线：未归类 `console.error`、`pageerror`、HTTP/请求失败和意外 dialog 均令测试失败。

精确已知项会写入报告的 `classifiedIssues`，不与真实红线混淆：可选本地音频/clip pack 只接受缺失资源 `404` 与对应 `net::ERR_ABORTED`，受控导航只接受同源静态图片或主文档取消。任何服务端错误、连接异常或未命中规则的错误都会失败；JS/CSS 请求不会按导航取消放行。

每个视口产出教程、Codex、gameover 三张截图，并生成 `ui-polish-report.json`。报告记录 surface 尺寸、滚动边界、ARIA、焦点、pause owner、触控结果、Codex 状态和分类诊断。

## 旧浏览器套件

以下套件仍可用于定向诊断：

```powershell
node tests/ai_test_runner.js --suite smoke
node tests/ai_test_runner.js --suite relic
node tests/ai_test_runner.js --suite essence
node tests/ai_test_runner.js --suite runeword
node tests/ai_test_runner.js --suite enemy
node tests/ai_test_runner.js --suite overlay
node tests/ai_test_runner.js --suite pinboard
```

这些套件不能替代 Goal E 的四视口 `ui-polish` 回归。

## 结果判定

- T1：全部语法检查与全部 `validate_*` 进程退出码为 0。
- T3：四档视口全部用例通过，未归类运行时错误为 0，证据文件完整。
- 若任一阶段失败，先修复并重跑完整受影响层；不得用单视口或部分专项结果声明集成完成。
