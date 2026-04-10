# 遗物选择界面 - 显示遗物选择卡片
# 从 JavaScript ui_system.js 中的遗物选择功能迁移

extends Control

class_name RelicSelection

# 信号
signal relic_selected(relic: Dictionary)
signal selection_skipped
signal selection_closed

# 状态
var is_active: bool = false
var choices: Array = []
var hovered_index: int = -1

# 稀有度颜色
var rarity_colors: Dictionary = {
	"common": Color(0.6, 0.6, 0.6, 1.0),
	"rare": Color(0.39, 0.4, 0.95, 1.0),
	"legendary": Color(0.98, 0.75, 0.14, 1.0),
	"cursed": Color(0.5, 0.0, 0.5, 1.0)
}

# 稀有度权重
var rarity_weights: Dictionary = {
	"common": 60,
	"rare": 30,
	"legendary": 8,
	"cursed": 2
}


func _ready() -> void:
	"""初始化遗物选择界面"""
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP


func show_selection(available_relics: Array, owned_relics: Array) -> void:
	"""显示遗物选择界面"""
	# 过滤已拥有的遗物
	var pool = available_relics.filter(func(r): return r.id not in owned_relics)
	
	if pool.is_empty():
		selection_closed.emit()
		return
	
	# 抽取遗物（加权随机，不放回）
	choices.clear()
	var choice_count = mini(3, pool.size())
	
	for i in range(choice_count):
		if pool.is_empty():
			break
		
		# 计算总权重
		var total_weight: float = 0.0
		for r in pool:
			total_weight += rarity_weights.get(r.rarity, 10)
		
		# 随机选择
		var random_val = randf() * total_weight
		var selected_idx = 0
		
		for j in range(pool.size()):
			var weight = rarity_weights.get(pool[j].rarity, 10)
			random_val -= weight
			if random_val <= 0:
				selected_idx = j
				break
		
		choices.append(pool[selected_idx])
		pool.remove_at(selected_idx)
	
	is_active = true
	visible = true
	queue_redraw()


func hide_selection() -> void:
	"""隐藏遗物选择界面"""
	is_active = false
	visible = false
	choices.clear()
	selection_closed.emit()


func select_relic(index: int) -> void:
	"""选择指定索引的遗物"""
	if index >= 0 and index < choices.size():
		var relic = choices[index]
		relic_selected.emit(relic)
		hide_selection()


func skip_selection() -> void:
	"""跳过遗物选择"""
	selection_skipped.emit()
	hide_selection()


func _draw() -> void:
	"""绘制遗物选择界面"""
	if not is_active:
		return
	
	var panel_rect = get_rect()
	var font = ThemeDB.fallback_font
	
	# 半透明背景遮罩
	draw_rect(panel_rect, Color(0, 0, 0, 0.8))
	
	# 标题
	var title = "选择一个遗物"
	var title_width = font.get_string_size(title, HORIZONTAL_ALIGNMENT_CENTER, -1, 24).x
	draw_string(font, Vector2((panel_rect.size.x - title_width) / 2.0, 80), title, HORIZONTAL_ALIGNMENT_CENTER, -1, 24, Color.WHITE)
	
	# 绘制遗物卡片
	var card_width: float = 180.0
	var card_height: float = 240.0
	var card_spacing: float = 30.0
	var total_width = choices.size() * card_width + (choices.size() - 1) * card_spacing
	var start_x = (panel_rect.size.x - total_width) / 2.0
	var card_y = (panel_rect.size.y - card_height) / 2.0
	
	for i in range(choices.size()):
		var relic = choices[i]
		var card_x = start_x + i * (card_width + card_spacing)
		var card_rect = Rect2(card_x, card_y, card_width, card_height)
		
		var is_hovered = (i == hovered_index)
		
		# 卡片背景
		var bg_color = Color(0.15, 0.17, 0.2, 1.0)
		if is_hovered:
			bg_color = Color(0.2, 0.22, 0.25, 1.0)
		draw_rect(card_rect, bg_color, true, -1, true)
		
		# 稀有度边框
		var border_color = rarity_colors.get(relic.rarity, Color.GRAY)
		var border_width = 3.0 if is_hovered else 2.0
		draw_rect(card_rect, border_color, false, border_width)
		
		# 稀有度发光效果（悬停时）
		if is_hovered:
			var glow_rect = Rect2(card_x - 5, card_y - 5, card_width + 10, card_height + 10)
			draw_rect(glow_rect, Color(border_color.r, border_color.g, border_color.b, 0.3), false, 2.0)
		
		# 图标
		var icon = relic.get("icon", "❓")
		var icon_size = 48
		draw_string(font, Vector2(card_x + (card_width - icon_size) / 2.0, card_y + 70), icon, HORIZONTAL_ALIGNMENT_CENTER, -1, icon_size, Color.WHITE)
		
		# 名称
		var name_text = relic.get("name", "未知遗物")
		var name_width = font.get_string_size(name_text, HORIZONTAL_ALIGNMENT_CENTER, -1, 14).x
		draw_string(font, Vector2(card_x + (card_width - name_width) / 2.0, card_y + 110), name_text, HORIZONTAL_ALIGNMENT_CENTER, -1, 14, Color.WHITE)
		
		# 稀有度标签
		var rarity_text = relic.get("rarity", "common").to_upper()
		var rarity_color = rarity_colors.get(relic.rarity, Color.GRAY)
		var rarity_width = font.get_string_size(rarity_text, HORIZONTAL_ALIGNMENT_CENTER, -1, 10).x
		draw_string(font, Vector2(card_x + (card_width - rarity_width) / 2.0, card_y + 130), rarity_text, HORIZONTAL_ALIGNMENT_CENTER, -1, 10, rarity_color)
		
		# 描述
		var desc = relic.get("desc", "")
		var desc_lines = _wrap_text(desc, card_width - 20, font, 11)
		var desc_y = card_y + 155
		for line in desc_lines:
			draw_string(font, Vector2(card_x + 10, desc_y), line, HORIZONTAL_ALIGNMENT_LEFT, card_width - 20, 11, Color(0.7, 0.7, 0.7, 1.0))
			desc_y += 14
	
	# 跳过按钮
	var skip_rect = Rect2((panel_rect.size.x - 100) / 2.0, panel_rect.size.y - 80, 100, 36)
	draw_rect(skip_rect, Color(0.3, 0.3, 0.3, 1.0), true, -1, true)
	draw_string(font, Vector2(skip_rect.position.x + 25, skip_rect.position.y + 24), "跳过", HORIZONTAL_ALIGNMENT_CENTER, -1, 14, Color(0.7, 0.7, 0.7, 1.0))


func _wrap_text(text: String, max_width: float, font: Font, font_size: int) -> Array[String]:
	"""文本换行"""
	var lines: Array[String] = []
	var words = text.split(" ")
	var current_line = ""
	
	for word in words:
		var test_line = current_line + (" " if current_line.length() > 0 else "") + word
		var line_width = font.get_string_size(test_line, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		
		if line_width > max_width and current_line.length() > 0:
			lines.append(current_line)
			current_line = word
		else:
			current_line = test_line
	
	if current_line.length() > 0:
		lines.append(current_line)
	
	return lines


func _gui_input(event: InputEvent) -> void:
	"""处理输入事件"""
	if not is_active:
		return
	
	if event is InputEventMouseMotion:
		_update_hover(event.position)
	
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_handle_click(event.position)


func _update_hover(mouse_pos: Vector2) -> void:
	"""更新悬停状态"""
	var old_hovered = hovered_index
	hovered_index = -1
	
	var panel_rect = get_rect()
	var card_width: float = 180.0
	var card_height: float = 240.0
	var card_spacing: float = 30.0
	var total_width = choices.size() * card_width + (choices.size() - 1) * card_spacing
	var start_x = (panel_rect.size.x - total_width) / 2.0
	var card_y = (panel_rect.size.y - card_height) / 2.0
	
	for i in range(choices.size()):
		var card_x = start_x + i * (card_width + card_spacing)
		var card_rect = Rect2(card_x, card_y, card_width, card_height)
		
		if card_rect.has_point(mouse_pos):
			hovered_index = i
			break
	
	if old_hovered != hovered_index:
		queue_redraw()


func _handle_click(mouse_pos: Vector2) -> void:
	"""处理点击事件"""
	var panel_rect = get_rect()
	
	# 检查遗物卡片点击
	var card_width: float = 180.0
	var card_height: float = 240.0
	var card_spacing: float = 30.0
	var total_width = choices.size() * card_width + (choices.size() - 1) * card_spacing
	var start_x = (panel_rect.size.x - total_width) / 2.0
	var card_y = (panel_rect.size.y - card_height) / 2.0
	
	for i in range(choices.size()):
		var card_x = start_x + i * (card_width + card_spacing)
		var card_rect = Rect2(card_x, card_y, card_width, card_height)
		
		if card_rect.has_point(mouse_pos):
			select_relic(i)
			return
	
	# 检查跳过按钮点击
	var skip_rect = Rect2((panel_rect.size.x - 100) / 2.0, panel_rect.size.y - 80, 100, 36)
	if skip_rect.has_point(mouse_pos):
		skip_selection()
