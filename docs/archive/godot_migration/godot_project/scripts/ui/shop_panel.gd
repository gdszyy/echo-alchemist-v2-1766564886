# 商店面板 - 管理局外升级商店
# 从 JavaScript ui_system.js 中的商店功能迁移

extends Control

class_name ShopPanel

# 信号
signal item_purchased(item_id: String, level: int)
signal category_changed(category_id: String)
signal shop_closed

# 状态
var current_category: String = ""
var player_currency: int = 0

# 数据
var categories: Dictionary = {}
var upgrades: Array = []
var player_upgrades: Dictionary = {}
var temporary_upgrades: Dictionary = {}


func _ready() -> void:
	"""初始化商店面板"""
	visible = false


func open_shop() -> void:
	"""打开商店"""
	visible = true
	if categories.size() > 0 and current_category.is_empty():
		current_category = categories.keys()[0]
	render_shop()


func close_shop() -> void:
	"""关闭商店"""
	visible = false
	shop_closed.emit()


func set_categories(cats: Dictionary) -> void:
	"""设置商店分类"""
	categories = cats


func set_upgrades(ups: Array) -> void:
	"""设置升级列表"""
	upgrades = ups


func set_player_data(currency: int, owned_upgrades: Dictionary, temp_upgrades: Dictionary) -> void:
	"""设置玩家数据"""
	player_currency = currency
	player_upgrades = owned_upgrades
	temporary_upgrades = temp_upgrades


func switch_category(category_id: String) -> void:
	"""切换分类"""
	current_category = category_id
	category_changed.emit(category_id)
	render_shop()


func render_shop() -> void:
	"""渲染商店内容"""
	queue_redraw()


func _draw() -> void:
	"""绘制商店界面"""
	if not visible:
		return
	
	var panel_rect = get_rect()
	var font = ThemeDB.fallback_font
	
	# 背景
	draw_rect(panel_rect, Color(0.08, 0.1, 0.12, 0.98))
	
	# 标题
	draw_string(font, Vector2(20, 30), "能量商店", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color.WHITE)
	
	# 货币显示
	var currency_text = "🔮 " + str(player_currency)
	draw_string(font, Vector2(panel_rect.size.x - 120, 30), currency_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.98, 0.75, 0.14, 1.0))
	
	# 分类标签
	var tab_x: float = 20.0
	var tab_y: float = 60.0
	
	for cat_id in categories:
		var cat = categories[cat_id]
		var is_active = (cat_id == current_category)
		
		var tab_color = Color(0.96, 0.62, 0.04, 1.0) if is_active else Color(0.2, 0.22, 0.25, 1.0)
		var text_color = Color(0.1, 0.1, 0.1, 1.0) if is_active else Color(0.6, 0.6, 0.6, 1.0)
		
		var tab_rect = Rect2(tab_x, tab_y, 80, 28)
		draw_rect(tab_rect, tab_color, true, -1, true)
		
		var tab_text = cat.get("icon", "") + " " + cat.get("name", cat_id)
		draw_string(font, Vector2(tab_x + 8, tab_y + 18), tab_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, text_color)
		
		tab_x += 90
	
	# 升级项列表
	var item_y: float = 110.0
	var filtered_upgrades = upgrades.filter(func(u): return u.get("category", "") == current_category)
	
	for upgrade in filtered_upgrades:
		var is_temporary = upgrade.get("temporary", false)
		var current_data = temporary_upgrades if is_temporary else player_upgrades
		var level = current_data.get(upgrade.id, 0)
		var is_max = level >= upgrade.get("max_level", 1)
		var cost = calculate_upgrade_cost(upgrade, level)
		var can_afford = player_currency >= cost
		
		# 卡片背景
		var card_rect = Rect2(20, item_y, panel_rect.size.x - 40, 80)
		var card_color = Color(0.15, 0.17, 0.2, 0.8) if is_max else Color(0.12, 0.14, 0.16, 0.9)
		draw_rect(card_rect, card_color, true, -1, true)
		
		# 边框
		draw_rect(card_rect, Color(0.25, 0.27, 0.3, 1.0), false, 1.0)
		
		# 图标
		var icon = upgrade.get("icon", "❓")
		draw_string(font, Vector2(35, item_y + 35), icon, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color.WHITE)
		
		# 名称
		var name_text = upgrade.get("name", upgrade.id)
		draw_string(font, Vector2(70, item_y + 25), name_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color.WHITE)
		
		# 等级
		var level_text = "LV. %d / %d" % [level, upgrade.get("max_level", 1)]
		draw_string(font, Vector2(70, item_y + 45), level_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.5, 0.5, 0.5, 1.0))
		
		# 描述
		var desc = upgrade.get("desc", "")
		draw_string(font, Vector2(70, item_y + 65), desc, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.6, 0.6, 0.6, 1.0))
		
		# 购买按钮
		if not is_max:
			var btn_rect = Rect2(panel_rect.size.x - 120, item_y + 25, 80, 30)
			var btn_color = Color(0.96, 0.62, 0.04, 1.0) if can_afford else Color(0.3, 0.3, 0.3, 1.0)
			draw_rect(btn_rect, btn_color, true, -1, true)
			
			var cost_text = "✨ " + str(cost)
			var cost_color = Color(0.1, 0.1, 0.1, 1.0) if can_afford else Color(0.5, 0.5, 0.5, 1.0)
			draw_string(font, Vector2(panel_rect.size.x - 110, item_y + 45), cost_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, cost_color)
		else:
			draw_string(font, Vector2(panel_rect.size.x - 100, item_y + 45), "MAX", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.5, 0.5, 0.5, 1.0))
		
		item_y += 90


func calculate_upgrade_cost(upgrade: Dictionary, level: int) -> int:
	"""计算升级价格"""
	var cost = upgrade.get("cost", {})
	var cost_type = cost.get("type", "fixed")
	
	match cost_type:
		"fixed":
			var values = cost.get("values", [0])
			return values[level] if level < values.size() else 0
		"linear":
			return cost.get("base", 0) + level * cost.get("growth", 0)
		"exponential":
			return floori(cost.get("base", 0) * pow(cost.get("growth", 1), level))
	
	return 0


func buy_upgrade(upgrade_id: String) -> bool:
	"""购买升级"""
	var upgrade = null
	for u in upgrades:
		if u.id == upgrade_id:
			upgrade = u
			break
	
	if not upgrade:
		return false
	
	var is_temporary = upgrade.get("temporary", false)
	var current_data = temporary_upgrades if is_temporary else player_upgrades
	var level = current_data.get(upgrade_id, 0)
	
	if level >= upgrade.get("max_level", 1):
		return false
	
	var cost = calculate_upgrade_cost(upgrade, level)
	if player_currency >= cost:
		player_currency -= cost
		current_data[upgrade_id] = level + 1
		item_purchased.emit(upgrade_id, level + 1)
		render_shop()
		return true
	
	return false


func _gui_input(event: InputEvent) -> void:
	"""处理输入事件"""
	if event is InputEventMouseButton and event.pressed:
		var mouse_pos = event.position
		
		# 检查分类标签点击
		var tab_x: float = 20.0
		var tab_y: float = 60.0
		
		for cat_id in categories:
			var tab_rect = Rect2(tab_x, tab_y, 80, 28)
			if tab_rect.has_point(mouse_pos):
				switch_category(cat_id)
				return
			tab_x += 90
		
		# 检查购买按钮点击
		var item_y: float = 110.0
		var filtered_upgrades = upgrades.filter(func(u): return u.get("category", "") == current_category)
		
		for upgrade in filtered_upgrades:
			var btn_rect = Rect2(size.x - 120, item_y + 25, 80, 30)
			if btn_rect.has_point(mouse_pos):
				buy_upgrade(upgrade.id)
				return
			item_y += 90
