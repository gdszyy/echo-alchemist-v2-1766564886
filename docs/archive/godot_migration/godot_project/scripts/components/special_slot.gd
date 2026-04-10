extends Node2D
## 特殊槽位类 - 代表弹珠台底部的特殊槽位

class_name SpecialSlot

# 属性
var slot_x: float
var slot_y: float
var slot_width: float
var slot_height: float = 40.0
var slot_type: String  # "recall", "multicast", "split", "wheel"

# 视觉效果
var color: Color = Color.WHITE

func _init(p_x: float, p_y: float, p_width: float, p_type: String) -> void:
	"""
	初始化特殊槽位
	
	Args:
		p_x: X 坐标
		p_y: Y 坐标
		p_width: 槽位宽度
		p_type: 槽位类型
	"""
	slot_x = p_x
	slot_y = p_y
	slot_width = p_width
	slot_type = p_type
	global_position = Vector2(p_x, p_y)
	
	_set_color_by_type()

func _set_color_by_type() -> void:
	"""根据类型设置颜色"""
	match slot_type:
		"recall":
			color = Color.GREEN
		"multicast":
			color = Color.YELLOW
		"split":
			color = Color.MAGENTA
		"wheel":
			color = Color.CYAN
		_:
			color = Color.GRAY

func _draw() -> void:
	"""绘制槽位"""
	var rect = Rect2(-slot_width / 2.0, 0, slot_width, slot_height)
	draw_rect(rect, color)
	draw_rect(rect, Color.BLACK, false, 2.0)
	
	# 绘制类型标签
	var label_pos = Vector2(0, slot_height / 2.0 - 5.0)
	draw_string(ThemeDB.fallback_font, label_pos, slot_type.to_upper(), HORIZONTAL_ALIGNMENT_CENTER)

func get_position_x() -> float:
	"""获取槽位 X 坐标"""
	return slot_x

func get_position_y() -> float:
	"""获取槽位 Y 坐标"""
	return slot_y

func get_width() -> float:
	"""获取槽位宽度"""
	return slot_width

func get_height() -> float:
	"""获取槽位高度"""
	return slot_height

func get_slot_type() -> String:
	"""获取槽位类型"""
	return slot_type

func is_point_in_slot(point: Vector2) -> bool:
	"""
	检查点是否在槽位内
	
	Args:
		point: 要检查的点
	
	Returns:
		是否在槽位内
	"""
	return (point.x >= slot_x and point.x <= slot_x + slot_width and
			point.y >= slot_y and point.y <= slot_y + slot_height)