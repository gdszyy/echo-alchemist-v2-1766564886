# 斩击动画类 - 飞剑命中时的梭形光效
# 从 JavaScript entities.js 中的 SlashAnim 类迁移

extends Node2D

class_name SlashAnim

# 基础属性
var slash_angle: float = 0.0
var life: float = 1.0
var active: bool = true
var effect_scale: float = 1.0
var color: Color = Color(0.05, 0.65, 0.91, 1.0)  # 默认青色 #0ea5e9

# 运动参数
var move_speed: float = 2.0


func _ready() -> void:
	"""初始化斩击动画"""
	pass


func _process(delta: float) -> void:
	"""每帧更新斩击动画"""
	if not active:
		return
	
	var time_scale = delta * 60.0
	
	# 沿斩击方向移动
	position.x += cos(slash_angle) * move_speed * time_scale
	position.y += sin(slash_angle) * move_speed * time_scale
	
	# 生命衰减
	life -= 0.08 * time_scale
	
	if life <= 0:
		active = false
		queue_free()
	else:
		queue_redraw()


func _draw() -> void:
	"""绘制斩击动画"""
	if not active:
		return
	
	var alpha = maxf(0.0, life)
	var scale_y = effect_scale * (0.5 + life * 0.5)
	
	# --- 1. 白色椭圆核心 ---
	var core_color = Color.WHITE
	core_color.a = alpha
	
	# 绘制椭圆
	var ellipse_points = _create_ellipse(20.0, 0.0, 60.0, 3.0)
	var rotated_ellipse = _rotate_and_scale_points(ellipse_points, slash_angle, effect_scale, scale_y)
	draw_colored_polygon(rotated_ellipse, core_color)
	
	# --- 2. 彩色梭形光效 ---
	var glow_color = color
	glow_color.a = alpha
	
	var spindle_points = _create_spindle(-40.0, 60.0, 25.0)
	var rotated_spindle = _rotate_and_scale_points(spindle_points, slash_angle, effect_scale, scale_y)
	draw_colored_polygon(rotated_spindle, glow_color)


func _create_ellipse(cx: float, cy: float, rx: float, ry: float) -> PackedVector2Array:
	"""创建椭圆形状"""
	var points = PackedVector2Array()
	var segments = 16
	
	for i in range(segments):
		var t = float(i) / segments * TAU
		var x = cx + cos(t) * rx
		var y = cy + sin(t) * ry
		points.append(Vector2(x, y))
	
	return points


func _create_spindle(left: float, right: float, height: float) -> PackedVector2Array:
	"""创建梭形形状"""
	var points = PackedVector2Array()
	var segments = 16
	
	# 上半弧
	for i in range(segments + 1):
		var t = float(i) / segments
		var x = lerp(left, right, t)
		var y = -sin(t * PI) * height
		points.append(Vector2(x, y))
	
	# 下半弧（反向）
	for i in range(segments, -1, -1):
		var t = float(i) / segments
		var x = lerp(left, right, t)
		var y = sin(t * PI) * height
		points.append(Vector2(x, y))
	
	return points


func _rotate_and_scale_points(points: PackedVector2Array, angle: float, sx: float, sy: float) -> PackedVector2Array:
	"""旋转并缩放顶点数组"""
	var result = PackedVector2Array()
	var cos_a = cos(angle)
	var sin_a = sin(angle)
	
	for point in points:
		# 先缩放
		var scaled_x = point.x * sx
		var scaled_y = point.y * sy
		# 再旋转
		var rx = scaled_x * cos_a - scaled_y * sin_a
		var ry = scaled_x * sin_a + scaled_y * cos_a
		result.append(Vector2(rx, ry))
	
	return result


# ==================== 设置方法 ====================

func setup(x: float, y: float, angle: float, scale: float = 1.0, slash_color: Color = Color(0.05, 0.65, 0.91, 1.0)) -> void:
	"""设置斩击动画参数"""
	position = Vector2(x, y)
	slash_angle = angle
	effect_scale = scale
	color = slash_color
	life = 1.0
	active = true
	queue_redraw()


func set_move_speed(speed: float) -> void:
	"""设置移动速度"""
	move_speed = speed
