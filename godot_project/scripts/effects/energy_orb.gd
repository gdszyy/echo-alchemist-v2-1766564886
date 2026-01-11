# 能量球特效类 - 带拖尾的物理爆发+磁力吸附效果
# 从 JavaScript entities.js 中的 EnergyOrb 类迁移

extends Node2D

class_name EnergyOrb

# 信号
signal arrived

# 目标位置
var target: Vector2 = Vector2.ZERO

# 外观参数
var color: Color = Color(0.98, 0.75, 0.14, 1.0)  # 默认金色 #fbbf24
var base_size: float = 2.5

# 物理参数
var vel: Vector2 = Vector2.ZERO
var friction: float = 0.88
var float_force: float = 0.21
var suction_acc: float = 0.07
var current_suction: float = 0.0

# 时间参数
var timer: float = 0.0
var hover_time: float = 20.0
var seed_value: float = 0.0

# 拖尾
var trail: Array[Vector2] = []
var max_trail_len: int = 8

# 状态
var active: bool = true

# 回调
var on_arrive: Callable


func _ready() -> void:
	"""初始化能量球特效"""
	seed_value = randf() * 100.0


func _process(delta: float) -> void:
	"""每帧更新能量球特效"""
	if not active:
		return
	
	var time_scale = delta * 60.0
	timer += time_scale
	
	# 1. 滞空阻力
	vel *= pow(friction, time_scale)
	
	# 2. 上浮力
	vel.y -= float_force * time_scale
	
	# 3. 吸附逻辑
	if timer > hover_time:
		var dir = target - position
		var dist = dir.length()
		
		if dist < 20:
			active = false
			arrived.emit()
			if on_arrive.is_valid():
				on_arrive.call()
			queue_free()
			return
		
		dir = dir.normalized()
		current_suction += suction_acc * time_scale
		vel += dir * current_suction * time_scale
	
	position += vel * time_scale
	
	# 更新拖尾
	trail.append(position)
	if trail.size() > max_trail_len:
		trail.pop_front()
	
	queue_redraw()


func _draw() -> void:
	"""绘制能量球特效"""
	if not active:
		return
	
	# --- 1. 绘制拖尾 ---
	if trail.size() > 2:
		var trail_color = color
		trail_color.a = 0.3
		
		var points = PackedVector2Array()
		for point in trail:
			# 转换为本地坐标
			points.append(point - position)
		
		draw_polyline(points, trail_color, base_size)
	
	# --- 2. 绘制核心 ---
	# 计算闪烁
	var flicker = 0.8 + sin(timer * 0.5 + seed_value) * 0.2
	
	# 外发光
	var glow_color = color
	glow_color.a = 0.4
	draw_circle(Vector2.ZERO, base_size * 2.5 * flicker, glow_color)
	
	# 核心亮点
	draw_circle(Vector2.ZERO, base_size * 0.8, Color.WHITE)


# ==================== 设置方法 ====================

func setup(x: float, y: float, target_x: float, target_y: float, orb_color: Color, initial_vel: Vector2, callback: Callable = Callable()) -> void:
	"""设置能量球特效参数
	
	Args:
		x: 起始 X 坐标
		y: 起始 Y 坐标
		target_x: 目标 X 坐标
		target_y: 目标 Y 坐标
		orb_color: 能量球颜色
		initial_vel: 初始速度（来自碰撞）
		callback: 到达目标时的回调函数
	"""
	position = Vector2(x, y)
	target = Vector2(target_x, target_y)
	color = orb_color
	on_arrive = callback
	
	# 计算爆发速度
	var burst_vel = Vector2(initial_vel.x * 3.2, initial_vel.y * 0.72)
	var spread_angle = (randf() - 0.5) * 0.6
	vel = burst_vel.rotated(spread_angle)
	
	# 确保最小速度
	if vel.length() < 3:
		vel = vel.normalized() * 3.0
	
	active = true
	timer = 0.0
	current_suction = 0.0
	trail.clear()
	
	queue_redraw()


func setup_simple(start: Vector2, end: Vector2, orb_color: Color = Color(0.98, 0.75, 0.14, 1.0)) -> void:
	"""简化设置方法"""
	position = start
	target = end
	color = orb_color
	
	# 随机初始速度
	var random_angle = randf() * TAU
	var speed = randf() * 3.0 + 2.0
	vel = Vector2(cos(random_angle) * speed, sin(random_angle) * speed - 2.0)
	
	active = true
	timer = 0.0
	current_suction = 0.0
	trail.clear()
	
	queue_redraw()


func set_hover_time(time: float) -> void:
	"""设置悬停时间"""
	hover_time = time


func set_suction_strength(strength: float) -> void:
	"""设置吸附强度"""
	suction_acc = strength
