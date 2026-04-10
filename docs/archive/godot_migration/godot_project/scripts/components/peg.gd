extends Node2D
## 钉子类 - 代表弹珠台上的钉子

class_name Peg

# 属性
var position_x: float
var position_y: float
var peg_type: String  # "normal", "bounce", "pierce", "scatter", "cryo", "pyro", "lightning"
var radius: float = 5.0

# 视觉效果
var collision_shape: CircleShape2D = null
var color: Color = Color.WHITE

func _init(p_x: float, p_y: float, p_type: String = "normal") -> void:
	"""
	初始化钉子
	
	Args:
		p_x: X 坐标
		p_y: Y 坐标
		p_type: 钉子类型
	"""
	position_x = p_x
	position_y = p_y
	peg_type = p_type
	global_position = Vector2(p_x, p_y)
	
	_set_color_by_type()
	_setup_collision()

func _set_color_by_type() -> void:
	"""根据类型设置颜色"""
	match peg_type:
		"normal":
			color = Color.WHITE
		"bounce":
			color = Color.YELLOW
		"pierce":
			color = Color.RED
		"scatter":
			color = Color.CYAN
		"cryo":
			color = Color.BLUE
		"pyro":
			color = Color.ORANGE
		"lightning":
			color = Color.PURPLE
		_:
			color = Color.GRAY

func _setup_collision() -> void:
	"""设置碰撞形状"""
	collision_shape = CircleShape2D.new()
	collision_shape.radius = radius

func _draw() -> void:
	"""绘制钉子"""
	draw_circle(Vector2.ZERO, radius, color)
	draw_circle(Vector2.ZERO, radius - 1, color.darkened(0.3))

func get_type() -> String:
	"""获取钉子类型"""
	return peg_type

func set_type(new_type: String) -> void:
	"""
	设置钉子类型
	
	Args:
		new_type: 新类型
	"""
	peg_type = new_type
	_set_color_by_type()
	queue_redraw()

func get_position_vector() -> Vector2:
	"""获取位置向量"""
	return Vector2(position_x, position_y)