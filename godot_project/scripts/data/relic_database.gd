# 遗物数据库 - 存储所有遗物的静态数据
# 从 JavaScript config.js 中的 RELIC_DB 迁移

extends RefCounted

class_name RelicDatabase

# 稀有度枚举
enum Rarity {
	COMMON,
	RARE,
	LEGENDARY,
	CURSED
}

# 稀有度颜色映射
const RARITY_COLORS: Dictionary = {
	"common": Color(0.6, 0.6, 0.6, 1.0),     # 灰色
	"rare": Color(0.39, 0.4, 0.95, 1.0),     # 蓝色
	"legendary": Color(0.98, 0.75, 0.14, 1.0), # 金色
	"cursed": Color(0.5, 0.0, 0.5, 1.0)       # 紫色
}

# 遗物数据库
const RELIC_DB: Array = [
	{
		"id": "gigantism_relic",
		"name": "倍化之术",
		"icon": "🔮",
		"desc": "永久提升弹珠体积，更容易击中钉子与槽位。",
		"rarity": "rare",
		"effect": "permanent_size_up",
		"max_stacks": 1
	},
	{
		"id": "fortune_wheel_relic",
		"name": "命運輪盤",
		"icon": "🎡",
		"desc": "收集階段：解鎖 [輪盤槽]。進入後轉動輪盤，使選中的已擁有屬性數量翻倍！",
		"rarity": "legendary",
		"effect": "unlock_slot",
		"slot_type": "wheel",
		"max_stacks": 1
	},
	{
		"id": "dimension_shard",
		"name": "維度碎片",
		"icon": "🌌",
		"desc": "收集階段：釘板高度延伸，額外增加 2 行釘子。",
		"rarity": "rare",
		"effect": "row_count_up",
		"max_stacks": 1
	},
	{
		"id": "stars_shines",
		"name": "群星闪烁",
		"icon": "✨",
		"desc": "解鎖 [回响弹珠]：双倍获得连击充能。",
		"rarity": "rare",
		"unlocks": "resonance",
		"boost": 8,
		"max_stacks": 1
	},
	{
		"id": "optical_lens",
		"name": "聚焦透鏡",
		"icon": "🔭",
		"desc": "解鎖 [光球]：發射瞬間穿透的折射光束。",
		"rarity": "legendary",
		"unlocks": "laser",
		"boost": 10,
		"max_stacks": 1
	},
	{
		"id": "pink_slime",
		"name": "粉紅凝膠",
		"icon": "💗",
		"desc": "收集階段：出現 3 個高彈性粉色釘子 (可疊加)。",
		"rarity": "common",
		"effect": "pink_peg_up",
		"max_stacks": 1
	},
	{
		"id": "energy_shield",
		"name": "力場護盾",
		"icon": "🛡️",
		"desc": "戰鬥階段：底部邊界可消耗彈性/穿透次數來反彈子彈。",
		"rarity": "cursed",
		"effect": "combat_wall",
		"max_stacks": 1
	},
	{
		"id": "unlock_recall",
		"name": "時光沙漏",
		"icon": "⏳",
		"desc": "收集階段：解鎖 [回溯槽] 的出現 (若無槽位則+1)。",
		"rarity": "rare",
		"effect": "unlock_slot",
		"slot_type": "recall",
		"max_stacks": 1
	},
	{
		"id": "unlock_multicast",
		"name": "雙子魔鏡",
		"icon": "♊",
		"desc": "收集階段：解鎖 [連射槽] 的出現 (若無槽位則+1)。",
		"rarity": "rare",
		"effect": "unlock_slot",
		"slot_type": "multicast",
		"max_stacks": 1
	},
	{
		"id": "unlock_split",
		"name": "裂變核心",
		"icon": "☢️",
		"desc": "收集階段：解鎖 [分裂槽] 的出現 (若無槽位則+1)。",
		"rarity": "rare",
		"effect": "unlock_slot",
		"slot_type": "split",
		"max_stacks": 1
	},
	{
		"id": "slot_expander",
		"name": "空間鑿子",
		"icon": "🔨",
		"desc": "收集階段：特殊槽出現數量 +1。",
		"rarity": "common",
		"effect": "slot_count_up",
		"max_stacks": 1
	},
	{
		"id": "cryo_stone",
		"name": "永恆凍土",
		"icon": "❄️",
		"desc": "解鎖 [冰霜] 屬性 (彈珠與釘子)。",
		"rarity": "rare",
		"unlocks": "cryo",
		"boost": 15,
		"max_stacks": 1
	},
	{
		"id": "pyro_stone",
		"name": "不滅火種",
		"icon": "🔥",
		"desc": "解鎖 [火焰] 屬性 (彈珠與釘子)。",
		"rarity": "rare",
		"unlocks": "pyro",
		"boost": 15,
		"max_stacks": 1
	},
	{
		"id": "tactical_kit_pierce",
		"name": "穿透補給",
		"icon": "↗",
		"desc": "解鎖 [穿透] 屬性。",
		"rarity": "common",
		"unlocks": ["pierce"],
		"boost": 5,
		"max_stacks": 1
	},
	{
		"id": "tactical_kit_scatter",
		"name": "散射補給",
		"icon": "🔱",
		"desc": "解鎖 [散射] 屬性。",
		"rarity": "common",
		"unlocks": ["scatter"],
		"boost": 5,
		"max_stacks": 1
	},
	{
		"id": "tactical_kit_damage",
		"name": "增幅補給",
		"icon": "⚔️",
		"desc": "解鎖 [增幅] 屬性。",
		"rarity": "common",
		"unlocks": ["damage"],
		"boost": 5,
		"max_stacks": 1
	},
	{
		"id": "explosive_ammo",
		"name": "高爆火藥",
		"icon": "🧨",
		"desc": "解鎖 [爆破彈珠] 出現，且獲得一顆。",
		"rarity": "rare",
		"unlocks": "explosive",
		"boost": 10,
		"max_stacks": 1
	},
	{
		"id": "prism_shard",
		"name": "七彩稜鏡",
		"icon": "🌈",
		"desc": "解鎖 [彩虹彈珠] 出現，且獲得一顆。",
		"rarity": "legendary",
		"unlocks": "rainbow",
		"boost": 5,
		"max_stacks": 1
	},
	{
		"id": "russian_doll",
		"name": "俄羅斯套娃",
		"icon": "🪆",
		"desc": "解鎖 [套娃彈珠]，子彈消失時會發射下一顆子彈。",
		"rarity": "legendary",
		"unlocks": "matryoshka",
		"boost": 5,
		"max_stacks": 1
	}
]


# ==================== 查询方法 ====================

static func get_all_relics() -> Array:
	"""获取所有遗物"""
	return RELIC_DB.duplicate(true)


static func get_relic_by_id(relic_id: String) -> Dictionary:
	"""根据 ID 获取遗物"""
	for relic in RELIC_DB:
		if relic.id == relic_id:
			return relic.duplicate(true)
	return {}


static func get_relics_by_rarity(rarity: String) -> Array:
	"""根据稀有度获取遗物列表"""
	var result: Array = []
	for relic in RELIC_DB:
		if relic.rarity == rarity:
			result.append(relic.duplicate(true))
	return result


static func get_relics_by_effect(effect: String) -> Array:
	"""根据效果类型获取遗物列表"""
	var result: Array = []
	for relic in RELIC_DB:
		if relic.get("effect", "") == effect:
			result.append(relic.duplicate(true))
	return result


static func get_unlock_relics() -> Array:
	"""获取所有解锁类遗物"""
	var result: Array = []
	for relic in RELIC_DB:
		if relic.has("unlocks"):
			result.append(relic.duplicate(true))
	return result


static func get_slot_unlock_relics() -> Array:
	"""获取所有槽位解锁类遗物"""
	var result: Array = []
	for relic in RELIC_DB:
		if relic.get("effect", "") == "unlock_slot":
			result.append(relic.duplicate(true))
	return result


static func get_rarity_color(rarity: String) -> Color:
	"""获取稀有度对应的颜色"""
	return RARITY_COLORS.get(rarity, Color.WHITE)


static func get_random_relic() -> Dictionary:
	"""随机获取一个遗物"""
	if RELIC_DB.size() == 0:
		return {}
	return RELIC_DB[randi() % RELIC_DB.size()].duplicate(true)


static func get_random_relic_by_rarity(rarity: String) -> Dictionary:
	"""根据稀有度随机获取一个遗物"""
	var relics = get_relics_by_rarity(rarity)
	if relics.size() == 0:
		return {}
	return relics[randi() % relics.size()]


static func get_weighted_random_relic(weights: Dictionary = {}) -> Dictionary:
	"""根据权重随机获取遗物
	
	Args:
		weights: 稀有度权重字典，例如 {"common": 60, "rare": 30, "legendary": 10}
	
	Returns:
		随机选中的遗物
	"""
	# 默认权重
	var default_weights = {
		"common": 60,
		"rare": 30,
		"legendary": 8,
		"cursed": 2
	}
	
	var final_weights = default_weights.duplicate()
	for key in weights:
		final_weights[key] = weights[key]
	
	# 计算总权重
	var total_weight: float = 0.0
	for rarity in final_weights:
		total_weight += final_weights[rarity]
	
	# 随机选择稀有度
	var roll = randf() * total_weight
	var selected_rarity = "common"
	
	for rarity in final_weights:
		roll -= final_weights[rarity]
		if roll <= 0:
			selected_rarity = rarity
			break
	
	# 从该稀有度中随机选择
	return get_random_relic_by_rarity(selected_rarity)


static func get_relic_count() -> int:
	"""获取遗物总数"""
	return RELIC_DB.size()


static func has_relic(relic_id: String) -> bool:
	"""检查遗物是否存在"""
	for relic in RELIC_DB:
		if relic.id == relic_id:
			return true
	return false
