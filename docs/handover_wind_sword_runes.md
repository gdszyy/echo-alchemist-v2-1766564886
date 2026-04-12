# 交接文档：风属性/飞剑变异机制与伤害同步开发任务

## 1. 项目与任务信息

- **项目名称**: Echo Alchemist V2 - 词条效果开发
- **项目 ID (Hub)**: `prj-09572cc3-b05`
- **目标代码库**: `gdszyy/echo-alchemist-v2-1766564886`

我已经完成了前期的需求分析与方案设计，并将其提交到了 GitHub 仓库和 Multi-Agent Hub 系统中。接下来的代码实现工作将由你（新 Agent）来完成。

在 Multi-Agent Hub 中，我为你创建了两个高优先级任务：
1. **`tsk-c8384214-8bc`**: 风属性风暴核合并机制 + 风暴打击伤害同步
2. **`tsk-cf5e7bda-6d0`**: 飞剑/风属性符文词条解锁机制实现

---

## 2. 新 Agent 启动指南（必读）

当你被分配接手此任务时，**必须**严格按照以下步骤进行初始化：

### 2.1 必备技能与权限
你必须被分配并启用以下技能与权限：
- **`/echo-developer` 技能**：这是项目的核心开发规范指引，所有代码修改必须遵循其约定的流程（先读 `AGENTS.md`，单次提交同步更新文档等）。
- **`/multi-agent-hub` 技能**：用于读取我创建的任务详情、汇报进度和提交最终结果。
- **GitHub 仓库权限**：必须拥有对 `gdszyy/echo-alchemist-v2-1766564886` 的读写（克隆与推送）权限。

### 2.2 环境初始化命令
请在你的终端中依次执行以下命令，完成工作区准备：

```bash
# 1. 设置项目密钥
export HUB_API_KEY=mah_GcAvPPyp3_L76v3Ah_fk4UcmOMP9pcbkZAMQ7pfPa0g

# 2. 克隆项目文档库与代码库
python /home/ubuntu/skills/multi-agent-hub/scripts/hub_repo.py clone --repo gdszyy/echo-alchemist-v2-1766564886

# 3. 注册为临时开发者 Agent
python /home/ubuntu/skills/multi-agent-hub/scripts/hub_client.py register --role developer --type temporary

# 4. 进入代码目录并拉取最新代码
cd /home/ubuntu/project-repo
git pull
```

---

## 3. 任务执行指引

### 任务 A：风暴核合并与伤害同步 (`tsk-c8384214-8bc`)
- **设计文档**: `docs/task_plan_wind_sword_runes.md` (已提交至 Git)
- **核心目标**:
  1. 在 `combat_system.js` 的回合结束逻辑中，遍历 `stormCores` 数组，计算两两距离。
  2. 若相交，则合并为一个新的风暴核，位置取中点，半径和能量累加（设定一个合理的最大值）。
  3. 达到最大值时，增加 `bonusTicks`（额外打击次数）和持续时间。
  4. 重构暴风绞杀（Wind Tunnel）的伤害触发逻辑，将基于 `setTimeout` 的伤害与粒子特效改为基于 Tick 的统一更新，确保视觉与伤害生命周期完全同步。

### 任务 B：飞剑/风属性符文词条变异解锁 (`tsk-cf5e7bda-6d0`)
- **设计文档**: `docs/runeword_wind_sword_design_v3.md` (已提交至 Git)
- **核心目标**:
  1. 在 `src/rune_config.js` 的 `RUNEWORD_DB` 中新增“剑意共鸣”和“风暴共鸣”词条。
  2. 在 `src/config.js` 中将 `specialMutationMult` 设为 `0`，彻底关闭无词条时的默认变异。
  3. 在 `src/entities.js` 的 `handlePegInteraction` 中，拦截 `rule.type === 'mutation'`，读取 `game.activeRunewordEffects` 中的词条变异概率（Lv1为0.7）来决定是否触发变异。
  4. 强化 `entities.js` 和 `spawn_system.js` 中的变异瞬间特效（Shockwave、大爆炸、浮动文字）以及特殊钉子的常驻视觉表现（脉冲发光、外围气旋/星芒）。
  5. 确保收集到变异钉子时，将词条等级注入到 `collected` 数组中，以便生成高等级配方。

### 3.1 交付流程规范
完成代码修改后，请严格遵循 `/echo-developer` 规范和 Multi-Agent Hub 工作流提交成果：
1. **代码提交**: `git add . && git commit -m "feat: 实现飞剑/风属性变异解锁与风暴核合并" && git push`
2. **记录结果**: `python /home/ubuntu/skills/multi-agent-hub/scripts/hub_repo.py save-result --task-id <任务ID> --summary "完成开发" --dir src/`
3. **提交审核**: `python /home/ubuntu/skills/multi-agent-hub/scripts/hub_client.py complete-task --task-id <任务ID> --agent-id <你的AgentID> --summary "功能已实现并推送至Git"`

祝开发顺利！
