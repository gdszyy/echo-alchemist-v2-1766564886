# 火焰波特效类 - 扩散的火焰圆环
# 从 JavaScript entities.js 中的 FireWave 类迁移

extends Node2D

class_name FireWave

# 火焰波参数
var radius: float = 10.0
var max_radius: float = 80.0

# 生命周期
var life: float = 1.0

# 扩散速度
var expand_speed: float = 5.0
var fade_speed: float = 0.05


func _ready() -> void:
	"""初始化火焰波特效"""
	pass


func _process(delta: float) -> void:
	"""每帧更新火焰波特效"""
	var time_scale = delta * 60.0
	
	radius += expand_speed * time_scale
	life -= fade_speed * time_scale
	
	if life <= 0:
		queue_free()
	else:
		queue_redraw()


func _draw() -> void:
	"""绘制火焰波特效"""
	if life <= 0:
		return
	
	# 绘制火焰渐变圆环
	# 中心透明 -> 橙色火焰 -> 边缘透明
	
	var segments = 32
	var inner_radius = radius * 0.6
	
	# 绘制多层圆环模拟渐变效果
	# 外层 - 红色边缘
	var outer_color = Color(1.0, 0.0, 0.0, 0.0)
	draw_arc(Vector2.ZERO, radius, 0, TAU, segments, outer_color, radius - inner_radius)
	
	# 中层 - 橙色火焰
	var mid_color = Color(0.98, 0.45, 0.09, life * 0.8)  # #f97316
	var mid_radius = (radius + inner_radius) / 2.0
	draw_arc(Vector2.ZERO, mid_radius, 0, TAU, segments, mid_color, (radius - inner_radius) * 0.5)
	
	# 内层 - 亮黄色核心
	var inner_color = Color(1.0, 0.78, 0.0, life * 0.6)
	draw_circle(Vector2.ZERO, inner_radius * 0.5, inner_color)


# ==================== 设置方法 ====================

func setup(x: float, y: float) -> void:
	"""设置火焰波特效参数"""
	position = Vector2(x, y)
	radius = 10.0
	life = 1.0
	queue_redraw()


func set_max_radius(new_max: float) -> void:
	"""设置最大半径"""
	max_radius = new_max


func set_expand_speed(speed: float) -> void:
	"""设置扩散速度"""
	expand_speed = speed


func set_fade_speed(speed: float) -> void:
	"""设置消失速度"""
	fade_speed = speed
