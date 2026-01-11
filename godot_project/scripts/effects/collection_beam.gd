# 收集光束特效类 - 收集完成时的向上光柱
# 从 JavaScript entities.js 中的 CollectionBeam 类迁移

extends Node2D

class_name CollectionBeam

# 光束参数
var bottom_y: float = 0.0
var beam_width: float = 60.0
var current_height: float = 0.0
var max_height: float = 0.0

# 生命周期
var life: float = 1.0
var decay: float = 0.04


func _ready() -> void:
	"""初始化光束特效"""
	pass


func _process(delta: float) -> void:
	"""每帧更新光束特效"""
	var time_scale = delta * 60.0
	
	life -= decay * time_scale
	
	# 光柱快速冲高
	current_height = lerp(current_height, max_height, 0.2 * time_scale)
	
	if life <= 0:
		queue_free()
	else:
		queue_redraw()


func _draw() -> void:
	"""绘制光束特效"""
	if life <= 0:
		return
	
	var alpha = maxf(0.0, life)
	
	# --- 1. 核心光柱 (梯形，底部窄上部宽) ---
	var w_bottom = beam_width * 0.4
	var w_top = beam_width
	
	# 构建梯形顶点（相对于 position）
	var points = PackedVector2Array()
	points.append(Vector2(-w_bottom, 0))  # 左下
	points.append(Vector2(w_bottom, 0))   # 右下
	points.append(Vector2(w_top, -current_height))    # 右上
	points.append(Vector2(-w_top, -current_height))   # 左上
	
	# 使用渐变色绘制
	var colors = PackedColorArray()
	var bottom_color = Color(1.0, 1.0, 1.0, alpha)
	var top_color = Color(0.05, 0.65, 0.91, 0.0)  # Sky Blue 渐变到透明
	
	colors.append(bottom_color)
	colors.append(bottom_color)
	colors.append(top_color)
	colors.append(top_color)
	
	draw_polygon(points, colors)
	
	# --- 2. 底部爆发光晕 ---
	var glow_size = 40.0 * life
	var glow_color = Color(1.0, 1.0, 1.0, alpha * 0.8)
	draw_circle(Vector2.ZERO, glow_size, glow_color)
	
	# 外圈光晕
	var outer_glow_color = Color(0.05, 0.65, 0.91, alpha * 0.4)
	draw_circle(Vector2.ZERO, glow_size * 1.5, outer_glow_color)


# ==================== 设置方法 ====================

func setup(x: float, y: float) -> void:
	"""设置光束特效参数"""
	position = Vector2(x, y)
	bottom_y = y
	max_height = y + 100.0  # 向上延伸的高度
	current_height = 0.0
	life = 1.0
	queue_redraw()


func set_width(new_width: float) -> void:
	"""设置光束宽度"""
	beam_width = new_width
	queue_redraw()


func set_max_height(height: float) -> void:
	"""设置最大高度"""
	max_height = height
