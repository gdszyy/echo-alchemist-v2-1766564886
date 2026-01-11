# 冲击波特效类 - 扩散的圆环波纹
# 从 JavaScript entities.js 中的 Shockwave 类迁移

extends Node2D

class_name Shockwave

# 冲击波参数
var radius: float = 1.0
var max_radius: float = 120.0
var color: Color = Color.WHITE
var alpha: float = 1.0

# 扩散速度
var expand_speed: float = 4.0
var fade_speed: float = 0.04


func _ready() -> void:
	"""初始化冲击波特效"""
	pass


func _process(delta: float) -> void:
	"""每帧更新冲击波特效"""
	var time_scale = delta * 60.0
	
	radius += expand_speed * time_scale
	alpha -= fade_speed * time_scale
	
	if alpha <= 0:
		queue_free()
	else:
		queue_redraw()


func _draw() -> void:
	"""绘制冲击波特效"""
	if alpha <= 0:
		return
	
	# --- 1. 填充部分 (很淡) ---
	var fill_color = color
	fill_color.a = alpha * 0.2
	draw_circle(Vector2.ZERO, radius, fill_color)
	
	# --- 2. 高亮边缘 (冲击波本体) ---
	var edge_color = color
	edge_color.a = alpha
	draw_arc(Vector2.ZERO, radius, 0, TAU, 64, edge_color, 4.0)
	
	# --- 3. 内部的一圈细线 (增加层次感) ---
	if radius > 10:
		var inner_color = color
		inner_color.a = alpha * 0.5
		draw_arc(Vector2.ZERO, radius * 0.7, 0, TAU, 48, inner_color, 1.0)


# ==================== 设置方法 ====================

func setup(x: float, y: float, wave_color: Color = Color.WHITE) -> void:
	"""设置冲击波特效参数"""
	position = Vector2(x, y)
	color = wave_color
	radius = 1.0
	alpha = 1.0
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
