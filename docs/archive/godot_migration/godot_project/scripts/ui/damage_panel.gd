# 伤害统计面板 - 显示伤害统计信息
# 从 JavaScript ui_system.js 中的伤害统计功能迁移

extends Control

class_name DamagePanel

# 信号
signal round_switched(round_index: int)
signal panel_toggled(is_open: bool)

# 状态
var is_open: bool = false
var current_viewing_round: int = 0

# 数据
var round_damage_history: Array = []
var shot_damage_history: Array = []
var current_round_damage: int = 0
var current_shot_damage_by_attr: Dictionary = {}

# 属性显示配置
var attribute_config: Dictionary = {
	"damage": { "color": Color(0.94, 0.27, 0.27, 1.0), "icon": "⚔️", "name": "物理" },
	"cryo": { "color": Color(0.53, 0.81, 0.92, 1.0), "icon": "❄️", "name": "冰霜" },
	"pyro": { "color": Color(0.97, 0.45, 0.09, 1.0), "icon": "🔥", "name": "火焰" },
	"lightning": { "color": Color(0.75, 0.5, 1.0, 1.0), "icon": "⚡", "name": "闪电" },
	"laser": { "color": Color(0.05, 0.65, 0.91, 1.0), "icon": "💠", "name": "激光" },
	"wind": { "color": Color(0.2, 0.83, 0.6, 1.0), "icon": "🌀", "name": "风" },
	"bounce": { "color": Color(0.13, 0.82, 0.38, 1.0), "icon": "🔄", "name": "弹射" },
	"pierce": { "color": Color(0.39, 0.4, 0.95, 1.0), "icon": "🔱", "name": "穿透" },
	"scatter": { "color": Color(0.98, 0.75, 0.14, 1.0), "icon": "✨", "name": "散射" }
}


func _ready() -> void:
	"""初始化伤害面板"""
	visible = false


func toggle_panel() -> void:
	"""切换面板显示/隐藏"""
	is_open = not is_open
	visible = is_open
	panel_toggled.emit(is_open)
	
	if is_open:
		update_display()


func open_panel() -> void:
	"""打开面板"""
	is_open = true
	visible = true
	panel_toggled.emit(true)
	update_display()


func close_panel() -> void:
	"""关闭面板"""
	is_open = false
	visible = false
	panel_toggled.emit(false)


func switch_round(direction: int) -> void:
	"""切换查看的回合"""
	current_viewing_round += direction
	current_viewing_round = clampi(current_viewing_round, 0, round_damage_history.size())
	round_switched.emit(current_viewing_round)
	update_display()


func update_display() -> void:
	"""更新显示内容"""
	queue_redraw()


func _draw() -> void:
	"""绘制伤害统计"""
	if not is_open:
		return
	
	var panel_rect = get_rect()
	
	# 背景
	draw_rect(panel_rect, Color(0.1, 0.12, 0.15, 0.95))
	
	# 标题
	var font = ThemeDB.fallback_font
	var title = "伤害统计"
	if current_viewing_round == 0:
		title = "本回合伤害"
	else:
		title = "第 %d 回合" % (round_damage_history.size() - current_viewing_round + 1)
	
	draw_string(font, Vector2(16, 24), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)
	
	# 获取数据
	var data: Dictionary = {}
	if current_viewing_round == 0:
		data = current_shot_damage_by_attr
	elif current_viewing_round <= round_damage_history.size():
		data = round_damage_history[current_viewing_round - 1].get("by_attr", {})
	
	if data.is_empty():
		draw_string(font, Vector2(16, 60), "暂无数据", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.5, 0.5, 0.5, 1.0))
		return
	
	# 计算总伤害
	var total_damage: float = 0.0
	for attr in data:
		var sources = data[attr]
		if sources is float or sources is int:
			total_damage += sources
		elif sources is Dictionary:
			for source in sources:
				total_damage += sources[source]
	
	if total_damage == 0:
		return
	
	# 绘制伤害条
	var y_offset: float = 50.0
	var bar_height: float = 20.0
	var bar_spacing: float = 8.0
	var max_bar_width: float = panel_rect.size.x - 100.0
	
	for attr in data:
		var conf = attribute_config.get(attr, { "color": Color.GRAY, "icon": "❓", "name": attr })
		var sources = data[attr]
		var type_total: float = 0.0
		
		if sources is float or sources is int:
			type_total = sources
		elif sources is Dictionary:
			for source in sources:
				type_total += sources[source]
		
		if type_total <= 0:
			continue
		
		var bar_width = (type_total / total_damage) * max_bar_width
		
		# 绘制标签
		draw_string(font, Vector2(16, y_offset + 14), conf.icon + " " + conf.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)
		
		# 绘制伤害条
		var bar_rect = Rect2(80, y_offset, bar_width, bar_height)
		draw_rect(bar_rect, conf.color)
		
		# 绘制数值
		var damage_text = str(ceili(type_total))
		draw_string(font, Vector2(85 + bar_width, y_offset + 14), damage_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color.WHITE)
		
		y_offset += bar_height + bar_spacing


func set_round_damage_history(history: Array) -> void:
	"""设置回合伤害历史"""
	round_damage_history = history


func set_shot_damage_history(history: Array) -> void:
	"""设置子弹伤害历史"""
	shot_damage_history = history


func set_current_damage(damage: int, by_attr: Dictionary) -> void:
	"""设置当前伤害数据"""
	current_round_damage = damage
	current_shot_damage_by_attr = by_attr
	
	if is_open:
		update_display()


func get_total_damage() -> int:
	"""获取总伤害"""
	var total: int = 0
	for round_data in round_damage_history:
		total += round_data.get("total", 0)
	return total
