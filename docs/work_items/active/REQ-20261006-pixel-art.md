# REQ-20261006-pixel-art

Status: Active（第二轮交付，待 Owner 审阅）
Owner: Claude Code（本会话）
Branch / worktree: `codex/REQ-20261006-pixel-art` @ `../echo-alchemist-REQ-20261006-pixel-art`（基线 `codex/REQ-20260717-ui-polish-integration` d97d8ba）
Started: 2026-10-06
Last updated: 2026-10-07

## 需求

重构游戏美术：保持 HTML 载体，以位图版本美术为基础，用 2D canvas 做像素风。
Owner 纠偏（同日）：不要一比一复刻——旧材质一致性差、大量 UI 数据对不上；理解后从呈现与内容层面完全重构。
Owner 纠偏（2026-10-07，附选弹珠卡截图）：卡框绿幕没扣干净——「该重构就重构」。→ 像素模式不再使用任何旧位图或其自动像素化副本。

规范与依据：[docs/design/pixel_art_mode.md](../../design/pixel_art_mode.md)；审计输入：`docs/design/pixel_redesign/`。

## Checkpoints

- [x] 像素网格管线：低分辨率缓冲、整数倍放大、DPR、像素字体、模式开关（`?art=` / 暂停菜单）、Pixi 在像素模式下停用。
- [x] 三份只读审计（局内 HUD、场景实体状态、菜单弹层）入库。
- [x] 场景层程序化像素画：地面、墙、防线三态。
- [x] 敌人：按原型形状语法程序化生成 + 固定四角读数；首领通用造型 + 顶栏名称/血条。
- [x] 发射器、子弹、瞄准标记像素化。
- [x] 研磨：钉子、弹珠、底部三弹珠卡（单一计数口径）。
- [x] 局内 HUD 画布即时绘制 + DOM 热区（读屏/键盘/复用原处理函数），旧 DOM HUD 在像素模式隐藏。
- [x] 菜单组件换装（代码生成九宫格 → CSS 变量），弹层底去位图。
- [x] 内容：繁转简（脚本 + 996 条对照表 + 6 条乱码修正 + 与对照表无关的 GB2312 外字检测 + 转义中文还原）、英文界面词中文化（战斗飘字、提示、模块、药剂形态、结算、说明里的属性 id 与首领英文名）、中文文案里 Boss → 首领、词条名以玩家可见说明统一、术语对齐 `UI_TERMINOLOGY`、"文案与数据不符"修正（含替换弹药卡把基础伤害当增幅层数）。
- [x] 菜单图标全部程序化重画（遗物 45+21、弹珠、属性、符文、词条、技能、首领预览、掉落胶囊、模块 / 商品），自动像素化副本 `assets/px/`（273 张）与转换工具删除；样式表 url() 改为 `--pxa-` 变量；像素模式下载旧位图 0 张。
- [x] 菜单组件重做：选弹珠卡、替换弹药卡（内容重排）、炼金台、技能装配、商店商品卡；彩色 emoji → 点阵图标；Tailwind 颜色 → 调色板。
- [x] 测试：`tests/validate_pixel_art_mode.mjs`（210 项）+ 既有 22 个测试文件全部通过（`validate_enemy_spawn_runtime.mjs` 显式声明走位图模式，因其校验位图精灵接线）；无头截图两种模式逐阶段对比。
- [x] 独立验收复核（2026-10-06，验收专家，范围：全部 diff + 重跑测试 + 无头运行）：结论「通过但有阻断项」。已修：① 繁简漏网（連/獲 等 33 字）与校验门只查表内字 → 补表 + GB2312 外字检测 + 自检用例；② 像素模式仍下载敌人/首领位图与回合横幅位图 → 加载口按模式拦截、横幅规则改为首帧生效（像素模式旧位图下载 11 → 1）；③ 像素模式无法主动打开技能装配 → 战斗画布 HUD 增加入口。复核方判定不成立/非本需求：`canvas.width→this.width` 在位图模式等价；音频与 `music_clip_packs.js` 的 404 为基线缺陷。
- [x] 第二轮独立验收复核（2026-10-07，验收专家，范围：重跑全部测试与生成器检查、无头截图 menus 组两种模式、高风险区「批量文案替换是否改到代码」逐处核对）：结论「通过」，无阻断项。像素模式旧位图下载 0 张；替换文案均只作显示用（id / 键名未动，消费方按 id 取值）。未覆盖：core / home 截图组、全部 210 项断言的逐条质量、真机。
- [ ] P4：特效族像素化、首领专属造型。
- [ ] 试炼场（开发者工具页）、药剂炼成面板按像素组件重做；剩余自定义组件硬编码颜色收敛。
- [ ] 逻辑支持后：最终伤害预览、瞄准期敌人意图。
- [ ] 真机（手机）帧率与观感验收；Owner 方向确认。

## Boundaries

- 位图模式的画面与交互不变；像素相关代码全部按模式分支。文案统一（繁简、英文、术语、词条名）两种模式共享。
- 不改玩法数值与规则；文案修正只让文字符合现有数据。
- `debugShopDefaultEnabled` 等产品开关未动（见规范 §10）。
- 未提交、未推送（等 Owner 指示）。

## 验证命令

```powershell
node tests/validate_pixel_art_mode.mjs
python tools/pixel_art/gen_pixel_css.py --check
python tools/pixel_art/gen_palette_css.py --check
python tools/pixel_art/t2s.py --scan
python tools/pixel_art/unescape_cjk.py --scan
node tools/pixel_art/art_sheet.mjs          # 全部程序化图标预览图
node tools/pixel_art/capture_screens.mjs --set core|menus|home   # 需本地服务 :3002
```
