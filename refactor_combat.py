#!/usr/bin/env python3.11
"""
精细重构 phase_combat_update 函数
将逻辑更新和渲染绘制完全分离
"""

with open('src/core.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 原函数范围: 7246-7858
FUNC_START = 7246
FUNC_END = 7858

# 提取函数体(不包括函数声明和结束括号)
func_body = lines[FUNC_START:FUNC_END-1]

# 分析并分类每一行
logic_lines = []
render_lines = []
shared_vars = []  # 需要在两个函数中都使用的变量

# 第一阶段: 提取纯逻辑部分 (前130行左右)
for i, line in enumerate(func_body[:131]):
    logic_lines.append(line)

# 提取需要在渲染中使用的变量定义
shared_vars = [
    "        const tilt = this.boardTilt.current;\n",
    "        const bgShiftX = tilt.x * 20;\n",
    "        const bgShiftY = tilt.y * 15;\n",
    "        const entityShiftX = tilt.x * -15;\n",
    "        const entityShiftY = tilt.y * -10;\n",
]

# 第二阶段: 从渲染部分提取逻辑代码
# 需要移动到逻辑层的代码段
logic_from_render = []

# 扫描渲染部分,提取逻辑代码
in_render_section = False
for i, line in enumerate(func_body[131:], start=131):
    line_stripped = line.strip()
    
    # 敌人更新逻辑
    if 'this.enemies.forEach(e => {' in line:
        # 提取整个敌人更新块
        logic_from_render.append("        // 更新敌人状态\n")
        logic_from_render.append("        let activeEnemies = 0;\n")
        logic_from_render.append("        let anyEnemyMoving = false;\n")
        logic_from_render.append("        this.enemies.forEach(e => {\n")
        logic_from_render.append("            if (e.active) {\n")
        logic_from_render.append("                e.update(this.timeScale, this);\n")
        logic_from_render.append("                if (e.pos.y > 0) activeEnemies++;\n")
        logic_from_render.append("                if (Math.abs(e.pos.y - e.dropTargetY) > 1) anyEnemyMoving = true;\n")
        logic_from_render.append("            }\n")
        logic_from_render.append("        });\n")
        logic_from_render.append("\n")
    
    # 弹丸更新逻辑
    elif 'for (let i = this.projectiles.length - 1' in line:
        logic_from_render.append("        // 更新弹丸\n")
        logic_from_render.append("        for (let i = this.projectiles.length - 1; i >= 0; i--) {\n")
        logic_from_render.append("            const p = this.projectiles[i];\n")
        logic_from_render.append("            if(p) {\n")
        logic_from_render.append("                p.update(this.width, this.height, this.enemies, (spawnInfo) => { this.spawn_spawnBullet(spawnInfo.x, spawnInfo.y, spawnInfo.vel, spawnInfo.config, p.shotId); }, timeScale);\n")
        logic_from_render.append("                if (p.destroyed) {\n")
        logic_from_render.append("                    if (p.shotId !== null && this.shotDamageMap.has(p.shotId)) {\n")
        logic_from_render.append("                        const shotStats = this.shotDamageMap.get(p.shotId);\n")
        logic_from_render.append("                        shotStats.destroyedCount++;\n")
        logic_from_render.append("                        if (shotStats.destroyedCount >= shotStats.projectileCount && shotStats.total > 0) {\n")
        logic_from_render.append("                            this.shotDamageHistory.push({ total: shotStats.total, byAttr: JSON.parse(JSON.stringify(shotStats.byAttr)) });\n")
        logic_from_render.append("                            if (this.shotDamageHistory.length > 10) this.shotDamageHistory.shift();\n")
        logic_from_render.append("                            this.ui_updateDamageStats();\n")
        logic_from_render.append("                            this.shotDamageMap.delete(p.shotId);\n")
        logic_from_render.append("                        }\n")
        logic_from_render.append("                    }\n")
        logic_from_render.append("                    this.projectiles.splice(i, 1);\n")
        logic_from_render.append("                }\n")
        logic_from_render.append("            }\n")
        logic_from_render.append("        }\n")
        logic_from_render.append("\n")

print("✓ 重构脚本已生成")
print("由于代码复杂度较高,将采用手动编辑方式完成重构")
