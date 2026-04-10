# 技能数据库 - 存储所有技能的静态数据
# 从 JavaScript config.js 中的 SKILL_DB 迁移

extends RefCounted

class_name SkillDatabase

# 技能数据库
const SKILL_DB: Array = [
	{
		"id": "repulsion",
		"method_id": "repulsion",
		"name": "重力反轉",
		"icon": "🌬️",
		"cost": 2,
		"color": Color(0.38, 0.65, 0.98, 1.0),  # #60a5fa
		"desc": "將所有敵人強制向上推回 2 行。",
		"params": {
			"push_rows": 2,
			"visual_shake": -20,
			"particle_color": Color(0.38, 0.65, 0.98, 1.0),
			"shockwave_color": Color(0.38, 0.65, 0.98, 1.0)
		}
	},
	{
		"id": "storm",
		"method_id": "chain_lightning_all",
		"name": "以太風暴",
		"icon": "⚡",
		"cost": 3,
		"color": Color(0.75, 0.52, 0.99, 1.0),  # #c084fc
		"desc": "召喚雷擊命中所有敵人，並觸發連鎖閃電。",
		"params": {
			"base_dmg": 10,
			"round_mult": 5,
			"bolt_color": Color(0.75, 0.52, 0.99, 1.0),
			"flash_color": Color(0.75, 0.52, 0.99, 0.2),
			"chain_level": 15
		}
	},
	{
		"id": "enhance_normal",
		"method_id": "enhance_ammo",
		"name": "賢者充能",
		"icon": "💎",
		"cost": 2,
		"color": Color(0.98, 0.8, 0.08, 1.0),  # #facc15
		"desc": "下一發子彈強化：散射、連射與全屬性提升。",
		"params": {
			"buffs": {
				"damage": 5,
				"bounce": 3,
				"pierce": 2,
				"multicast": 1,
				"scatter": 4
			},
			"force_explosive": true,
			"force_laser": false,
			"explosion_color": Color(0.98, 0.8, 0.08, 1.0),
			"float_text": "ENHANCED!"
		}
	},
	{
		"id": "enhance_laser",
		"method_id": "enhance_ammo",
		"name": "光之充能",
		"icon": "🔦",
		"cost": 1,
		"color": Color(0.05, 0.65, 0.91, 1.0),  # #0ea5e9
		"desc": "下一發子彈轉化為高能激光。",
		"params": {
			"buffs": {
				"damage": 5,
				"pierce": 8,
				"multicast": 2,
				"laser": 5
			},
			"force_laser": true,
			"force_explosive": false,
			"explosion_color": Color(0.05, 0.65, 0.91, 1.0),
			"float_text": "LASER READY!"
		}
	}
]


# ==================== 查询方法 ====================

static func get_all_skills() -> Array:
	"""获取所有技能"""
	return SKILL_DB.duplicate(true)


static func get_skill_by_id(skill_id: String) -> Dictionary:
	"""根据 ID 获取技能"""
	for skill in SKILL_DB:
		if skill.id == skill_id:
			return skill.duplicate(true)
	return {}


static func get_skill_by_method_id(method_id: String) -> Dictionary:
	"""根据方法 ID 获取技能"""
	for skill in SKILL_DB:
		if skill.method_id == method_id:
			return skill.duplicate(true)
	return {}


static func get_skills_by_cost(cost: int) -> Array:
	"""根据消耗获取技能列表"""
	var result: Array = []
	for skill in SKILL_DB:
		if skill.cost == cost:
			result.append(skill.duplicate(true))
	return result


static func get_skills_by_max_cost(max_cost: int) -> Array:
	"""获取消耗不超过指定值的技能列表"""
	var result: Array = []
	for skill in SKILL_DB:
		if skill.cost <= max_cost:
			result.append(skill.duplicate(true))
	return result


static func get_skill_count() -> int:
	"""获取技能总数"""
	return SKILL_DB.size()


static func has_skill(skill_id: String) -> bool:
	"""检查技能是否存在"""
	for skill in SKILL_DB:
		if skill.id == skill_id:
			return true
	return false


static func get_skill_cost(skill_id: String) -> int:
	"""获取技能消耗"""
	var skill = get_skill_by_id(skill_id)
	return skill.get("cost", 0)


static func get_skill_color(skill_id: String) -> Color:
	"""获取技能颜色"""
	var skill = get_skill_by_id(skill_id)
	return skill.get("color", Color.WHITE)


static func get_skill_params(skill_id: String) -> Dictionary:
	"""获取技能参数"""
	var skill = get_skill_by_id(skill_id)
	return skill.get("params", {}).duplicate(true)


static func get_enhance_skills() -> Array:
	"""获取所有强化类技能"""
	var result: Array = []
	for skill in SKILL_DB:
		if skill.method_id == "enhance_ammo":
			result.append(skill.duplicate(true))
	return result


static func get_random_skill() -> Dictionary:
	"""随机获取一个技能"""
	if SKILL_DB.size() == 0:
		return {}
	return SKILL_DB[randi() % SKILL_DB.size()].duplicate(true)


static func get_random_affordable_skill(available_points: int) -> Dictionary:
	"""随机获取一个可负担的技能"""
	var affordable = get_skills_by_max_cost(available_points)
	if affordable.size() == 0:
		return {}
	return affordable[randi() % affordable.size()]
