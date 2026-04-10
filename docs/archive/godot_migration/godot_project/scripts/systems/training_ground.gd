# 试炼场系统 - 用于测试子弹和敌人配置
# 从 JavaScript systems.js 中的 TrainingGround 类迁移

extends Control

class_name TrainingGround

# 信号
signal bullet_fired(config: Dictionary)
signal enemy_spawned(enemy: Node)
signal training_exited
signal stats_updated(dps: int, total: int)

# 游戏引用
var game_ref: Node = null

# 状态
var active: bool = false

# 敌人配置
var enemy_config: Dictionary = {
	"hp": 100,
	"max_hp": 100,
	"affixes": []
}

# 子弹配置
var bullet_config: Dictionary = {
	"damage": 10,
	"bounce": 0,
	"pierce": 0,
	"scatter": 0,
	"multicast": 0,
	"pyro": 0,
	"cryo": 0,
	"lightning": 0,
	"wind": 0,
	"flying_sword": 0,
	"flying_sword_lv": 1,
	"wind_lv": 1,
	"laser": 0,
	"explosive": false,
	"is_matryoshka": false,
	"type": "normal"
}

# 统计
var stats: Dictionary = {
	"total_damage": 0,
	"last_total": 0,
	"dps": 0,
	"start_time": 0
}

# 词缀列表
var available_affixes: Array[Dictionary] = [
	{ "id": "elite", "name": "精英", "icon": "💀" },
	{ "id": "shield", "name": "护盾", "icon": "🛡️" },
	{ "id": "haste", "name": "极速", "icon": "⚡" },
	{ "id": "regen", "name": "再生", "icon": "💚" },
	{ "id": "clone", "name": "分身", "icon": "🦠" },
	{ "id": "berserk", "name": "狂暴", "icon": "😡" },
	{ "id": "healer", "name": "治疗", "icon": "💖" },
	{ "id": "devour", "name": "吞噬", "icon": "👅" },
	{ "id": "jump", "name": "跳跃", "icon": "🦘" }
]

# 属性列表
var bullet_attributes: Array[Dictionary] = [
	{ "id": "damage", "name": "伤害", "icon": "⚔️", "min": 1, "max": 999, "type": "number" },
	{ "id": "bounce", "name": "弹跳", "icon": "⤴️", "min": 0, "max": 20, "type": "number" },
	{ "id": "pierce", "name": "穿透", "icon": "↗️", "min": 0, "max": 20, "type": "number" },
	{ "id": "scatter", "name": "散射", "icon": "🔱", "min": 0, "max": 10, "type": "number" },
	{ "id": "multicast", "name": "连射", "icon": "🔗", "min": 0, "max": 10, "type": "number" },
	{ "id": "pyro", "name": "火焰", "icon": "🔥", "min": 0, "max": 50, "type": "number" },
	{ "id": "cryo", "name": "冰霜", "icon": "❄️", "min": 0, "max": 50, "type": "number" },
	{ "id": "lightning", "name": "闪电", "icon": "⚡", "min": 0, "max": 50, "type": "number" },
	{ "id": "wind", "name": "风暴", "icon": "🌪️", "min": 0, "max": 50, "type": "number" },
	{ "id": "wind_lv", "name": "风等级", "icon": "📊", "min": 1, "max": 3, "type": "number" },
	{ "id": "flying_sword", "name": "子母剑", "icon": "🗡️", "min": 0, "max": 50, "type": "number" },
	{ "id": "flying_sword_lv", "name": "剑等级", "icon": "📊", "min": 1, "max": 3, "type": "number" },
	{ "id": "laser", "name": "激光", "icon": "🔦", "min": 0, "max": 10, "type": "number" },
	{ "id": "explosive", "name": "爆破", "icon": "💥", "type": "bool" },
	{ "id": "is_matryoshka", "name": "套娃", "icon": "🪆", "type": "bool" }
]


func _ready() -> void:
	"""初始化试炼场"""
	visible = false


func _process(delta: float) -> void:
	"""每帧更新"""
	if not active:
		return
	
	update_stats()


# ==================== 公共方法 ====================

func enter() -> void:
	"""进入试炼场"""
	active = true
	visible = true
	
	# 重置统计
	stats.total_damage = 0
	stats.last_total = 0
	stats.dps = 0
	stats.start_time = 0
	
	# 清空战斗状态（由游戏主逻辑处理）
	if game_ref:
		game_ref.call("clear_combat_state")


func exit() -> void:
	"""退出试炼场"""
	active = false
	visible = false
	training_exited.emit()


func setup(game: Node) -> void:
	"""设置游戏引用"""
	game_ref = game


# ==================== 子弹配置 ====================

func update_bullet_attr(attr_id: String, value: Variant) -> void:
	"""更新子弹属性"""
	bullet_config[attr_id] = value
	update_bullet_preview()


func toggle_bullet_attr(attr_id: String) -> void:
	"""切换布尔属性"""
	bullet_config[attr_id] = not bullet_config[attr_id]
	update_bullet_preview()


func reset_bullet() -> void:
	"""重置子弹配置"""
	bullet_config = {
		"damage": 10,
		"bounce": 0,
		"pierce": 0,
		"scatter": 0,
		"multicast": 0,
		"pyro": 0,
		"cryo": 0,
		"lightning": 0,
		"wind": 0,
		"flying_sword": 0,
		"flying_sword_lv": 1,
		"wind_lv": 1,
		"laser": 0,
		"explosive": false,
		"is_matryoshka": false,
		"type": "normal"
	}
	update_bullet_preview()


func update_bullet_preview() -> void:
	"""更新子弹预览"""
	queue_redraw()


func fire_bullet() -> void:
	"""发射测试子弹"""
	# 构造配方
	var recipe = bullet_config.duplicate(true)
	
	# 自动推导特殊属性
	if recipe.flying_sword > 0:
		recipe.type = "flying_sword"
		recipe.level = bullet_config.flying_sword_lv
	
	if recipe.laser > 0:
		recipe.is_laser = true
	
	if recipe.wind > 0:
		recipe.level = bullet_config.wind_lv
		recipe.wind_lv = recipe.level
	
	# 记录开始时间
	if stats.start_time == 0:
		stats.start_time = Time.get_ticks_msec()
	
	bullet_fired.emit(recipe)


func get_bullet_config() -> Dictionary:
	"""获取当前子弹配置"""
	return bullet_config.duplicate(true)


# ==================== 敌人配置 ====================

func toggle_affix(affix_id: String) -> void:
	"""切换敌人词缀"""
	var idx = enemy_config.affixes.find(affix_id)
	if idx == -1:
		enemy_config.affixes.append(affix_id)
	else:
		enemy_config.affixes.remove_at(idx)


func set_enemy_hp(hp: int) -> void:
	"""设置敌人血量"""
	enemy_config.hp = hp
	enemy_config.max_hp = hp


func spawn_enemy() -> void:
	"""生成敌人"""
	var spawn_config = enemy_config.duplicate(true)
	enemy_spawned.emit(spawn_config)


func clear_enemies() -> void:
	"""清空敌人"""
	if game_ref:
		game_ref.call("clear_enemies")


func get_enemy_config() -> Dictionary:
	"""获取当前敌人配置"""
	return enemy_config.duplicate(true)


# ==================== 统计 ====================

func update_stats() -> void:
	"""更新统计数据"""
	if game_ref:
		stats.total_damage = game_ref.get("round_damage") if game_ref.has_method("get") else 0
	
	# 计算 DPS
	if stats.total_damage > 0 and stats.start_time == 0:
		stats.start_time = Time.get_ticks_msec()
	
	if stats.start_time > 0:
		var duration = (Time.get_ticks_msec() - stats.start_time) / 1000.0
		if duration > 0.5:
			stats.dps = floori(stats.total_damage / duration)
	
	stats_updated.emit(stats.dps, floori(stats.total_damage))


func get_stats() -> Dictionary:
	"""获取统计数据"""
	return stats.duplicate(true)


# ==================== 绘制 ====================

func _draw() -> void:
	"""绘制试炼场UI"""
	if not active:
		return
	
	var rect = get_rect()
	
	# 背景
	draw_rect(rect, Color(0.06, 0.09, 0.12, 0.95))
	
	# 顶部状态栏
	var top_bar_rect = Rect2(0, 0, rect.size.x, 40)
	draw_rect(top_bar_rect, Color(0.08, 0.1, 0.12, 0.9))
	
	var font = ThemeDB.fallback_font
	
	# 标题
	draw_string(font, Vector2(16, 26), "⚔️ Combat Simulation", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.6, 0.6, 0.6, 1.0))
	
	# DPS 显示
	var stats_text = "DPS: %s | TOTAL: %s" % [str(stats.dps), str(floori(stats.total_damage))]
	draw_string(font, Vector2(rect.size.x - 200, 26), stats_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.98, 0.75, 0.14, 1.0))
	
	# 退出按钮
	draw_string(font, Vector2(rect.size.x - 50, 26), "退出", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.6, 0.6, 0.6, 1.0))


# ==================== 输入处理 ====================

func _gui_input(event: InputEvent) -> void:
	"""处理输入事件"""
	if not active:
		return
	
	if event is InputEventMouseButton and event.pressed:
		var mouse_pos = event.position
		var rect = get_rect()
		
		# 检查退出按钮点击
		var exit_rect = Rect2(rect.size.x - 60, 10, 50, 20)
		if exit_rect.has_point(mouse_pos):
			exit()
