# 剑气类 - 快速穿透的月牙形剑气
# 从 JavaScript entities.js 中的 SwordQi 类迁移

extends Node2D

class_name SwordQi

# 信号
signal enemy_hit(enemy: Node2D)
signal expired

# 基础属性
var vel: Vector2 = Vector2.ZERO
var sword_width: float = 30.0
var life: float = 40.0
var active: bool = true

# 拖尾
var trail: Array[Vector2] = []
var max_trail_length: int = 5

# 颜色
var color: Color = Color(0.05, 0.65, 0.91, 0.8)  # #0ea5e9


func _ready() -> void:
	"""初始化剑气"""
	pass


func _process(delta: float) -> void:
	"""每帧更新剑气"""
	if not active:
		return
	
	var time_scale = delta * 60.0
	
	# 更新位置
	position += vel * time_scale
	life -= time_scale
	
	# 更新拖尾
	trail.append(position)
	if trail.size() > max_trail_length:
		trail.pop_front()
	
	# 生命结束或超出屏幕
	if life <= 0:
		active = false
		expired.emit()
		queue_free()
	else:
		queue_redraw()


func _draw() -> void:
	"""绘制剑气"""
	if not active:
		return
	
	# 计算旋转角度
	var angle = vel.angle()
	
	# 绘制月牙形剑气
	var half_width = sword_width / 2.0
	
	# 构建月牙形状
	var points = PackedVector2Array()
	var segments = 16
	
	# 左半圆弧
	for i in range(segments + 1):
		var t = float(i) / segments
		var a = PI * 0.5 + t * PI  # 从 90° 到 270°
		var x = cos(a) * half_width
		var y = sin(a) * half_width
		# 旋转到速度方向
		var rx = x * cos(angle) - y * sin(angle)
		var ry = x * sin(angle) + y * cos(angle)
		points.append(Vector2(rx, ry))
	
	# 贝塞尔曲线闭合（简化为直线）
	var end_point = points[points.size() - 1]
	var start_point = points[0]
	var mid_x = (sword_width / 4.0) * cos(angle)
	var mid_y = (sword_width / 4.0) * sin(angle)
	points.append(Vector2(mid_x, mid_y))
	
	draw_colored_polygon(points, color)


# ==================== 碰撞检测 ====================

func check_collision(enemies: Array) -> void:
	"""检测与敌人的碰撞"""
	for enemy in enemies:
		if not enemy or not enemy.get("active"):
			continue
		
		var enemy_pos = enemy.position if enemy is Node2D else Vector2(enemy.pos.x, enemy.pos.y)
		var enemy_width = enemy.get("width") if enemy.get("width") else 40.0
		
		# 简单的矩形碰撞检测
		if abs(enemy_pos.x - position.x) < (sword_width / 2.0 + enemy_width / 2.0) and abs(enemy_pos.y - position.y) < 30:
			# 标记敌人
			if enemy.has_method("add_sword_mark"):
				enemy.add_sword_mark(1)
			
			enemy_hit.emit(enemy)


# ==================== 设置方法 ====================

func setup(x: float, y: float, velocity: Vector2, width: float) -> void:
	"""设置剑气参数
	
	Args:
		x: 起始 X 坐标
		y: 起始 Y 坐标
		velocity: 初始速度方向
		width: 剑气宽度
	"""
	position = Vector2(x, y)
	vel = velocity.normalized() * 15.0  # 剑气速度极快
	sword_width = width * 3.0  # 宽度很宽
	life = 40.0
	active = true
	trail.clear()
	queue_redraw()


func set_color(new_color: Color) -> void:
	"""设置剑气颜色"""
	color = new_color
	queue_redraw()
