# 闪电效果 - 单个闪电实例
# 处理闪电的绘制和动画

extends Node2D

class_name LightningBolt

# 闪电参数
var start_pos: Vector2 = Vector2.ZERO
var end_pos: Vector2 = Vector2.ZERO
var lifetime: float = 0.2
var max_lifetime: float = 0.2

# 闪电外观
var color: Color = Color(0.75, 0.5, 1.0, 1.0)  # 紫色
var line_width: float = 3.0
var segment_count: int = 5
var jaggedness: float = 20.0

# 闪电路径点
var path_points: Array = []

# 闪电抖动
var flicker_intensity: float = 1.0


func _ready() -> void:
	"""初始化闪电"""
	# 使用 _draw() 进行自定义绘制
	pass


func _process(delta: float) -> void:
	"""每帧更新闪电"""
	lifetime -= delta
	
	# 闪电闪烁效果 - 随机抖动强度
	flicker_intensity = randf_range(0.7, 1.0)
	
	# 重新生成路径以获得闪电效果
	_generate_lightning_path()
	
	# 触发重绘
	queue_redraw()
	
	# 生命周期结束时移除
	if lifetime <= 0:
		queue_free()


func _draw() -> void:
	"""绘制闪电"""
	if path_points.size() < 2:
		return
	
	# 设置绘制参数
	var draw_color = color
	draw_color.a = (lifetime / max_lifetime) * flicker_intensity
	
	# 绘制闪电线条
	var points = PackedVector2Array(path_points)
	draw_polyline(points, draw_color, line_width)
	
	# 绘制外发光效果（可选）
	var glow_color = color
	glow_color.a = (lifetime / max_lifetime) * 0.3
	draw_polyline(points, glow_color, line_width + 2)


func _generate_lightning_path() -> void:
	"""生成锯齿闪电路径"""
	path_points.clear()
	path_points.append(start_pos)
	
	# 分段生成闪电路径
	for i in range(1, segment_count):
		var t = float(i) / segment_count
		
		# 计算目标位置（直线插值）
		var target_x = start_pos.x + (end_pos.x - start_pos.x) * t
		var target_y = start_pos.y + (end_pos.y - start_pos.y) * t
		
		# 添加随机抖动（除了最后一个点）
		if i < segment_count:
			var jag_x = target_x + (randf() - 0.5) * jaggedness * flicker_intensity
			var jag_y = target_y + (randf() - 0.5) * jaggedness * flicker_intensity
			path_points.append(Vector2(jag_x, jag_y))
		else:
			path_points.append(Vector2(target_x, target_y))
	
	# 添加终点
	path_points.append(end_pos)


func setup(start: Vector2, end: Vector2, duration: float) -> void:
	"""设置闪电参数"""
	start_pos = start
	end_pos = end
	lifetime = duration
	max_lifetime = duration
	
	# 初始化路径
	_generate_lightning_path()
	queue_redraw()


func set_color(new_color: Color) -> void:
	"""设置闪电颜色"""
	color = new_color
	queue_redraw()


func set_jaggedness(value: float) -> void:
	"""设置闪电锯齿程度"""
	jaggedness = value
	queue_redraw()


func set_segment_count(count: int) -> void:
	"""设置闪电分段数"""
	segment_count = max(2, count)
	_generate_lightning_path()
	queue_redraw()
