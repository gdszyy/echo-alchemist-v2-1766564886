# 斩击特效类 - 梭形光刃效果
# 从 JavaScript entities.js 中的 SlashEffect 类迁移

extends Node2D

class_name SlashEffect

# 斩击参数
var slash_angle: float = 0.0
var length: float = 100.0
var color: Color = Color(0.05, 0.65, 0.91, 1.0)  # 默认青色 #0ea5e9
var width: float = 6.0

# 生命周期
var life: float = 1.0
var decay: float = 0.06
var active: bool = true


func _ready() -> void:
	"""初始化斩击特效"""
	pass


func _process(delta: float) -> void:
	"""每帧更新斩击特效"""
	if not active:
		return
	
	life -= decay
	
	if life <= 0:
		active = false
		queue_free()
	else:
		queue_redraw()


func _draw() -> void:
	"""绘制斩击特效"""
	if not active:
		return
	
	var alpha = maxf(0.0, life)
	var current_width = width * life
	var half_length = length / 2.0
	
	# --- 1. 外部光晕 (彩色) ---
	var glow_color = color
	glow_color.a = alpha * 0.6
	var glow_width = current_width * 2.5
	
	var glow_points = _create_spindle_shape(half_length + 20.0, glow_width)
	var rotated_glow = _rotate_points(glow_points, slash_angle)
	draw_colored_polygon(rotated_glow, glow_color)
	
	# --- 2. 核心光束 (亮白) ---
	var core_color = Color.WHITE
	core_color.a = alpha
	
	var core_points = _create_spindle_shape(half_length, current_width)
	var rotated_core = _rotate_points(core_points, slash_angle)
	draw_colored_polygon(rotated_core, core_color)
	
	# --- 3. 横向闪光 (Impact Cross) ---
	if life > 0.5:
		var cross_alpha = (life - 0.5) * 2.0
		var cross_color = Color.WHITE
		cross_color.a = cross_alpha
		
		# 计算垂直于斩击方向的线
		var perp_angle = slash_angle + PI / 2.0
		var cross_start = Vector2(cos(perp_angle) * 30.0, sin(perp_angle) * 30.0)
		var cross_end = Vector2(cos(perp_angle) * -30.0, sin(perp_angle) * -30.0)
		
		draw_line(cross_start, cross_end, cross_color, 2.0)


func _create_spindle_shape(half_len: float, max_width: float) -> PackedVector2Array:
	"""创建梭形形状的顶点"""
	var points = PackedVector2Array()
	var segments = 16
	
	# 上半弧
	for i in range(segments + 1):
		var t = float(i) / segments
		var x = lerp(-half_len, half_len, t)
		var y = -sin(t * PI) * max_width
		points.append(Vector2(x, y))
	
	# 下半弧（反向）
	for i in range(segments, -1, -1):
		var t = float(i) / segments
		var x = lerp(-half_len, half_len, t)
		var y = sin(t * PI) * max_width
		points.append(Vector2(x, y))
	
	return points


func _rotate_points(points: PackedVector2Array, rotation_angle: float) -> PackedVector2Array:
	"""旋转顶点数组"""
	var rotated = PackedVector2Array()
	var cos_a = cos(rotation_angle)
	var sin_a = sin(rotation_angle)
	
	for point in points:
		var rx = point.x * cos_a - point.y * sin_a
		var ry = point.x * sin_a + point.y * cos_a
		rotated.append(Vector2(rx, ry))
	
	return rotated


# ==================== 设置方法 ====================

func setup(x: float, y: float, angle: float, slash_length: float, slash_color: Color = Color(0.05, 0.65, 0.91, 1.0)) -> void:
	"""设置斩击特效参数"""
	position = Vector2(x, y)
	slash_angle = angle
	length = slash_length
	color = slash_color
	life = 1.0
	active = true
	queue_redraw()


func set_width(new_width: float) -> void:
	"""设置斩击宽度"""
	width = new_width
	queue_redraw()


func set_decay(new_decay: float) -> void:
	"""设置消散速度"""
	decay = new_decay
