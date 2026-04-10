# 激光束特效类 - 多段折线激光
# 从 JavaScript entities.js 中的 LaserBeam 类迁移

extends Node2D

class_name LaserBeam

# 激光参数
var segments: Array[Vector2] = []  # 激光路径点数组
var beam_width: float = 4.0
var initial_width: float = 4.0
var color: Color = Color(0.05, 0.65, 0.91, 1.0)  # 默认青色

# 生命周期
var life: float = 1.0
var decay: float = 0.04


func _ready() -> void:
	"""初始化激光束特效"""
	pass


func _process(delta: float) -> void:
	"""每帧更新激光束特效"""
	var time_scale = delta * 60.0
	
	life -= decay * time_scale
	
	if life <= 0:
		queue_free()
	else:
		queue_redraw()


func _draw() -> void:
	"""绘制激光束特效"""
	if life <= 0 or segments.size() < 2:
		return
	
	var current_width = initial_width * life
	var opacity = pow(life, 0.5)  # 非线性透明度
	
	# 构建路径点数组
	var points = PackedVector2Array()
	for seg in segments:
		points.append(seg)
	
	# --- 1. 外发光 (宽且淡) ---
	var glow_color = color
	glow_color.a = opacity * 0.3
	draw_polyline(points, glow_color, current_width * 2.5)
	
	# --- 2. 核心光束 (窄且亮) ---
	var core_color = Color.WHITE
	core_color.a = opacity
	draw_polyline(points, core_color, current_width)


# ==================== 设置方法 ====================

func setup(path_segments: Array, width: float, beam_color: Color) -> void:
	"""设置激光束特效参数
	
	Args:
		path_segments: 路径点数组，可以是 Vector2 数组或字典数组
		width: 激光宽度
		beam_color: 激光颜色
	"""
	segments.clear()
	
	# 处理不同类型的输入
	for seg in path_segments:
		if seg is Vector2:
			segments.append(seg)
		elif seg is Dictionary:
			segments.append(Vector2(seg.x, seg.y))
	
	beam_width = width
	initial_width = width
	color = beam_color
	life = 1.0
	queue_redraw()


func setup_from_points(start: Vector2, end: Vector2, width: float = 4.0, beam_color: Color = Color(0.05, 0.65, 0.91, 1.0)) -> void:
	"""从起点和终点设置激光束"""
	segments.clear()
	segments.append(start)
	segments.append(end)
	beam_width = width
	initial_width = width
	color = beam_color
	life = 1.0
	queue_redraw()


func add_segment(point: Vector2) -> void:
	"""添加路径点"""
	segments.append(point)
	queue_redraw()


func set_decay(new_decay: float) -> void:
	"""设置消散速度"""
	decay = new_decay
