extends Node2D
## 弹珠类 - 代表从顶部落下的弹珠

class_name DropBall

# 物理属性
var velocity: Vector2 = Vector2.ZERO
var gravity: float = 500.0
var bounce_damping: float = 0.8
var radius: float = 8.0

# 状态
var is_active: bool = true
var collected_attributes: Array = []
var final_slot: String = ""

# 位置
var ball_x: float
var ball_y: float

# 配置
var board_width: float = 800.0
var board_height: float = 600.0

func _init(p_x: float, p_y: float) -> void:
	"""
	初始化弹珠
	
	Args:
		p_x: 初始 X 坐标
		p_y: 初始 Y 坐标
	"""
	ball_x = p_x
	ball_y = p_y
	global_position = Vector2(p_x, p_y)
	velocity = Vector2.ZERO
	collected_attributes = []

func update(pegs: Array, slots: Array, board_w: float, board_h: float, time_scale: float, board_tilt: float) -> String:
	"""
	更新弹珠状态
	
	Args:
		pegs: 钉子数组
		slots: 槽位数组
		board_w: 棋盘宽度
		board_h: 棋盘高度
		time_scale: 时间缩放
		board_tilt: 棋盘倾斜角度
	
	Returns:
		"active" 或 "finished"
	"""
	if not is_active:
		return "finished"
	
	board_width = board_w
	board_height = board_h
	
	# 应用重力
	velocity.y += gravity * time_scale
	
	# 应用倾斜
	if board_tilt != 0.0:
		velocity.x += sin(board_tilt) * gravity * time_scale
	
	# 更新位置
	ball_x += velocity.x * time_scale
	ball_y += velocity.y * time_scale
	global_position = Vector2(ball_x, ball_y)
	
	# 碰撞检测
	_check_peg_collisions(pegs)
	_check_wall_collisions()
	
	# 检查是否到达底部
	if ball_y >= board_height - 50.0:
		_check_slot_collision(slots)
		if final_slot != "":
			is_active = false
			return "finished"
	
	return "active"

func _check_peg_collisions(pegs: Array) -> void:
	"""
	检查与钉子的碰撞
	
	Args:
		pegs: 钉子数组
	"""
	for peg in pegs:
		if peg is Peg:
			var peg_pos = peg.get_position_vector()
			var distance = global_position.distance_to(peg_pos)
			
			if distance < radius + peg.radius:
				_handle_peg_collision(peg, peg_pos)

func _handle_peg_collision(peg: Peg, peg_pos: Vector2) -> void:
	"""
	处理与钉子的碰撞
	
	Args:
		peg: 钉子对象
		peg_pos: 钉子位置
	"""
	# 计算碰撞法向量
	var collision_normal = (global_position - peg_pos).normalized()
	
	# 反弹
	velocity = collision_normal * velocity.length() * bounce_damping
	
	# 分离以避免重复碰撞
	var separation = (radius + peg.radius + 1.0) * collision_normal
	global_position = peg_pos + separation
	ball_x = global_position.x
	ball_y = global_position.y
	
	# 收集属性
	if peg.get_type() != "normal":
		if peg.get_type() not in collected_attributes:
			collected_attributes.append(peg.get_type())

func _check_wall_collisions() -> void:
	"""检查与墙壁的碰撞"""
	# 左右墙
	if ball_x - radius < 0:
		ball_x = radius
		velocity.x = abs(velocity.x) * bounce_damping
	elif ball_x + radius > board_width:
		ball_x = board_width - radius
		velocity.x = -abs(velocity.x) * bounce_damping
	
	# 顶部
	if ball_y - radius < 0:
		ball_y = radius
		velocity.y = abs(velocity.y) * bounce_damping

func _check_slot_collision(slots: Array) -> void:
	"""
	检查与槽位的碰撞
	
	Args:
		slots: 槽位数组
	"""
	for slot in slots:
		if slot is SpecialSlot:
			var slot_x = slot.get_position_x()
			var slot_width = slot.get_width()
			
			# 检查 X 坐标是否在槽位范围内
			if ball_x >= slot_x and ball_x <= slot_x + slot_width:
				final_slot = slot.get_slot_type()
				collected_attributes.append(final_slot)
				is_active = false

func get_data() -> Dictionary:
	"""获取弹珠数据"""
	return {
		"collected": collected_attributes.duplicate(),
		"final_slot": final_slot,
		"x": ball_x,
		"y": ball_y,
	}

func is_active_ball() -> bool:
	"""检查弹珠是否活跃"""
	return is_active

func _draw() -> void:
	"""绘制弹珠"""
	draw_circle(Vector2.ZERO, radius, Color.LIGHT_BLUE)
	draw_circle(Vector2.ZERO, radius - 1, Color.BLUE)