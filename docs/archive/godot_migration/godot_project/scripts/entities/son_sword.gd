# 子母剑类 - 追踪、冲刺、插入敌人的飞剑
# 从 JavaScript entities.js 中的 SonSword 类迁移

extends Node2D

class_name SonSword

# 信号
signal enemy_hit(enemy: Node2D, damage_config: Dictionary)
signal stuck_to_enemy(enemy: Node2D)
signal recalled

# 状态枚举
enum SwordState {
	FLYING,
	STUCK,
	RECALLING
}

# 基础属性
var vel: Vector2 = Vector2.ZERO
var mother: Node2D = null
var level: int = 1
var config: Dictionary = {}
var active: bool = true
var state: SwordState = SwordState.FLYING

# 攻击属性
var max_attacks: int = 1
var attacks_left: int = 1
var is_auto_hunting: bool = false
var is_mother_blade: bool = false

# 目标追踪
var target_queue: Array[Node2D] = []
var current_target: Node2D = null
var passing_through_enemy: Node2D = null

# 插入状态
var stuck_host: Node2D = null
var stuck_offset: Vector2 = Vector2.ZERO
var recall_target: Vector2 = Vector2.ZERO

# 延迟和随机化
var start_delay: float = 0.0
var speed_randomizer: float = 1.0
var turn_randomizer: float = 1.0
var dash_speed: float = 25.0
var dash_overshoot: float = 5.0

# 角度和计时器
var sword_angle: float = 0.0
var dash_timer: float = 0.0
var search_timer: float = 0.0

# 命中记录
var hit_enemies_in_dash: Array[Node2D] = []
var hit_enemies_in_recall: Array[Node2D] = []

# 拖尾
var trail: Array[Vector2] = []
var max_trail_length: int = 8

# 配置常量
const SON_SPEED: float = 12.0
const SON_TURN_SPEED: float = 0.12


func _ready() -> void:
	"""初始化子母剑"""
	speed_randomizer = 0.8 + randf() * 0.5
	turn_randomizer = 0.7 + randf() * 0.6
	dash_speed = 22.0 + randf() * 10.0
	dash_overshoot = randf() * 8.0
	search_timer = floori(randf() * 15.0)


func _process(delta: float) -> void:
	"""每帧更新子母剑"""
	if not active:
		return
	
	var time_scale = delta * 60.0
	
	# 1. 启动延迟
	if start_delay > 0:
		start_delay -= time_scale
		if mother and mother.get("active"):
			position.x += (mother.position.x - position.x) * 0.1 * time_scale
			position.y += (mother.position.y - position.y) * 0.1 * time_scale
		return
	
	# 2. 穿透冲刺逻辑
	if passing_through_enemy:
		_handle_dash_through(time_scale)
		return
	
	# 3. 常规状态机
	match state:
		SwordState.FLYING, SwordState.RECALLING:
			_handle_flying_state(time_scale)
		SwordState.STUCK:
			_handle_stuck_state()
	
	queue_redraw()


func _handle_dash_through(time_scale: float) -> void:
	"""处理穿透冲刺"""
	var enemy = passing_through_enemy
	if not enemy or not enemy.get("active"):
		_end_dash()
		return
	
	var enemy_pos = enemy.position if enemy is Node2D else Vector2.ZERO
	var dx = position.x - enemy_pos.x
	var dy = position.y - enemy_pos.y
	var dist_sq = dx * dx + dy * dy
	
	var enemy_width = enemy.get("width") if enemy.get("width") else 40.0
	var enemy_height = enemy.get("height") if enemy.get("height") else 40.0
	var safe_dist = (enemy_width + enemy_height) / 4.0 + 40.0
	
	var is_inside = dist_sq < safe_dist * safe_dist
	
	if is_inside:
		dash_timer = dash_overshoot
	else:
		dash_timer -= time_scale
	
	if not is_inside and dash_timer <= 0:
		_end_dash()
	else:
		position += vel * time_scale
		sword_angle = vel.angle()


func _end_dash() -> void:
	"""结束冲刺"""
	passing_through_enemy = null
	hit_enemies_in_dash.clear()
	var normal_speed = SON_SPEED * speed_randomizer
	vel = vel.normalized() * normal_speed


func _handle_flying_state(time_scale: float) -> void:
	"""处理飞行状态"""
	# 目标验证
	target_queue = target_queue.filter(func(e): return e and e.get("active"))
	
	# 取目标
	if state == SwordState.FLYING and not current_target and target_queue.size() > 0:
		current_target = target_queue.pop_front()
	
	# 目标失效检测
	if current_target:
		if not current_target.get("active"):
			current_target = null
			if target_queue.size() > 0:
				current_target = target_queue.pop_front()
			else:
				search_timer = 0
	
	# 计算目标位置和速度
	var target_pos: Vector2 = Vector2.ZERO
	var current_speed = SON_SPEED * speed_randomizer
	var max_turn_rate = 0.15 * time_scale
	
	if state == SwordState.RECALLING:
		current_speed *= 1.5
		max_turn_rate = 0.25 * time_scale
		target_pos = recall_target
		
		# 到达检测
		var dist_sq = position.distance_squared_to(target_pos)
		if dist_sq < 600:
			active = false
			recalled.emit()
			queue_free()
			return
	else:
		if current_target:
			var target_node_pos = current_target.position if current_target is Node2D else Vector2.ZERO
			target_pos = target_node_pos
			current_speed *= 2.8
			max_turn_rate = 0.12 * time_scale
		elif mother and mother.get("active"):
			# 跟随母剑
			var mother_vel = mother.get("vel") if mother.get("vel") else Vector2.ZERO
			var len_vel = mother_vel.length()
			if len_vel < 0.01:
				len_vel = 1.0
			target_pos = mother.position - (mother_vel / len_vel) * 40.0
			max_turn_rate = 0.2 * time_scale
		else:
			target_pos = position + vel
	
	# 平滑转向
	if target_pos != Vector2.ZERO:
		var target_angle = (target_pos - position).angle()
		var current_angle = vel.angle()
		var new_angle = _rotate_towards(current_angle, target_angle, max_turn_rate)
		vel = Vector2(cos(new_angle), sin(new_angle)) * current_speed
	
	# 更新位置
	position += vel * time_scale
	sword_angle = vel.angle()
	
	# 更新拖尾
	trail.append(position)
	if trail.size() > max_trail_length:
		trail.pop_front()


func _handle_stuck_state() -> void:
	"""处理插入状态"""
	if stuck_host and stuck_host.get("active"):
		var host_pos = stuck_host.position if stuck_host is Node2D else Vector2.ZERO
		position = host_pos + stuck_offset
	else:
		active = false
		queue_free()


func _rotate_towards(current_angle: float, target_angle: float, max_step: float) -> float:
	"""平滑旋转函数"""
	var diff = target_angle - current_angle
	
	# 处理角度突变
	while diff <= -PI:
		diff += TAU
	while diff > PI:
		diff -= TAU
	
	if abs(diff) < max_step:
		return target_angle
	else:
		return current_angle + (max_step if diff > 0 else -max_step)


func _draw() -> void:
	"""绘制子母剑"""
	if not active or state == SwordState.STUCK:
		return
	
	# 根据等级选择颜色
	var sword_color: Color
	if level >= 3:
		sword_color = Color(0.96, 0.25, 0.37, 1.0)  # #f43f5e 玫红
	elif level >= 2:
		sword_color = Color(0.39, 0.4, 0.95, 1.0)   # #6366f1 靛蓝
	else:
		sword_color = Color(0.05, 0.65, 0.91, 1.0)  # #0ea5e9 青色
	
	# 1. 绘制拖尾
	if trail.size() > 1:
		var trail_color = sword_color
		trail_color.a = 0.4
		
		var points = PackedVector2Array()
		for point in trail:
			points.append(point - position)
		
		draw_polyline(points, trail_color, 2.0)
	
	# 2. 绘制剑身
	var scale_factor = 1.4 if is_mother_blade else 1.0
	var rot = sword_angle + PI / 2.0
	
	# 剑刃
	var blade_points = PackedVector2Array()
	blade_points.append(_rotate_point(Vector2(0, -15) * scale_factor, rot))
	blade_points.append(_rotate_point(Vector2(2.5, -2) * scale_factor, rot))
	blade_points.append(_rotate_point(Vector2(2.5, 2) * scale_factor, rot))
	blade_points.append(_rotate_point(Vector2(-2.5, 2) * scale_factor, rot))
	blade_points.append(_rotate_point(Vector2(-2.5, -2) * scale_factor, rot))
	
	draw_colored_polygon(blade_points, Color(0.97, 0.98, 0.99, 1.0))  # #f8fafc
	draw_polyline(blade_points, Color(0.8, 0.84, 0.88, 1.0), 0.8)  # #cbd5e1
	
	# 护手
	var guard_rect = Rect2(Vector2(-5, 2) * scale_factor, Vector2(10, 2) * scale_factor)
	_draw_rotated_rect(guard_rect, rot, sword_color)
	
	# 剑柄
	var hilt_rect = Rect2(Vector2(-1.25, 4) * scale_factor, Vector2(2.5, 5) * scale_factor)
	_draw_rotated_rect(hilt_rect, rot, Color(0.2, 0.25, 0.33, 1.0))  # #334155
	
	# 剑首
	var pommel_pos = _rotate_point(Vector2(0, 10) * scale_factor, rot)
	draw_circle(pommel_pos, 2.0 * scale_factor, sword_color)
	
	# 3. 母剑剑穗
	if is_mother_blade:
		var pommel_world = pommel_pos
		var time = Time.get_ticks_msec() / 1000.0
		var swing = sin(time * 3.0) * 2.0
		
		# 简化的剑穗
		var tassel_end = pommel_world + Vector2(swing, 18.0)
		draw_line(pommel_world, tassel_end, Color(0.94, 0.27, 0.27, 1.0), 2.0)  # #ef4444
		draw_circle(tassel_end, 2.5, Color(0.94, 0.27, 0.27, 1.0))


func _rotate_point(point: Vector2, angle: float) -> Vector2:
	"""旋转点"""
	var cos_a = cos(angle)
	var sin_a = sin(angle)
	return Vector2(
		point.x * cos_a - point.y * sin_a,
		point.x * sin_a + point.y * cos_a
	)


func _draw_rotated_rect(rect: Rect2, angle: float, color: Color) -> void:
	"""绘制旋转的矩形"""
	var points = PackedVector2Array()
	var corners = [
		rect.position,
		rect.position + Vector2(rect.size.x, 0),
		rect.position + rect.size,
		rect.position + Vector2(0, rect.size.y)
	]
	
	for corner in corners:
		points.append(_rotate_point(corner, angle))
	
	draw_colored_polygon(points, color)


# ==================== 公共方法 ====================

func add_target(enemy: Node2D) -> void:
	"""添加目标到队列"""
	if enemy and enemy.get("active"):
		target_queue.append(enemy)


func handle_hit(enemy: Node2D) -> void:
	"""处理命中敌人"""
	if state == SwordState.RECALLING:
		if enemy not in hit_enemies_in_recall:
			hit_enemies_in_recall.append(enemy)
			enemy_hit.emit(enemy, config)
		return
	
	if enemy == current_target and passing_through_enemy != enemy:
		enemy_hit.emit(enemy, config)
		
		passing_through_enemy = enemy
		vel = vel.normalized() * dash_speed
		current_target = null
		
		attacks_left -= 1
		if attacks_left <= 0:
			stick_to_enemy(enemy)


func stick_to_enemy(enemy: Node2D) -> void:
	"""插入敌人"""
	state = SwordState.STUCK
	stuck_host = enemy
	var enemy_pos = enemy.position if enemy is Node2D else Vector2.ZERO
	stuck_offset = position - enemy_pos
	
	# 限制偏移量
	var enemy_width = enemy.get("width") if enemy.get("width") else 40.0
	var enemy_height = enemy.get("height") if enemy.get("height") else 40.0
	var max_off = minf(enemy_width, enemy_height) * 0.4
	if stuck_offset.length() > max_off:
		stuck_offset = stuck_offset.normalized() * max_off
	
	stuck_to_enemy.emit(enemy)


func trigger_recall(target_pos: Vector2) -> void:
	"""触发回收"""
	state = SwordState.RECALLING
	stuck_host = null
	recall_target = target_pos
	target_queue.clear()
	current_target = null
	passing_through_enemy = null
	hit_enemies_in_recall.clear()


# ==================== 设置方法 ====================

func setup(x: float, y: float, mother_sword: Node2D, sword_level: int, sword_config: Dictionary, delay: float = 0.0) -> void:
	"""设置子母剑参数"""
	position = Vector2(x, y)
	vel = Vector2(randf() - 0.5, randf() - 0.5) * 5.0
	mother = mother_sword
	level = sword_level
	config = sword_config
	
	max_attacks = (sword_config.get("multicast", 0)) + 1
	attacks_left = max_attacks
	
	start_delay = delay + randf() * 20.0
	state = SwordState.FLYING
	active = true
	
	trail.clear()
	hit_enemies_in_dash.clear()
	hit_enemies_in_recall.clear()
	
	queue_redraw()


func set_auto_hunting(enabled: bool) -> void:
	"""设置自动寻敌"""
	is_auto_hunting = enabled


func set_mother_blade(is_mother: bool) -> void:
	"""设置为母剑"""
	is_mother_blade = is_mother
