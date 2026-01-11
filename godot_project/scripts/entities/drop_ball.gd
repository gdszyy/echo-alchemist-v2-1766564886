extends RigidBody2D

class_name DropBall

# 基础属性
var pos: Vector2
var vel: Vector2
var radius: float = 8.0
var active: bool = true

# 定义和会话
var def: Dictionary = {}
var session: Dictionary = {}

# 物理常数
var gravity_acceleration: float = 0.3
var friction: float = 0.99
var bounce_damping: float = 0.8
var tilt_influence: float = 0.1

# 视口尺寸缓存
var viewport_width: float = 1024.0
var viewport_height: float = 768.0

func _ready() -> void:
	# 初始化位置
	pos = global_position
	
	# 设置物理属性
	gravity_scale = 1.0
	linear_damp = 0.0
	angular_damp = 0.0

func _init(x: float = 0, y: float = 0, marble_def: Dictionary = {}, session_dict: Dictionary = {}) -> void:
	pos = Vector2(x, y)
	vel = Vector2((randf() - 0.5) * 2, 2)
	def = marble_def.duplicate()
	session = session_dict.duplicate()
	
	# 初始化会话的收集列表
	if not session.has("collected"):
		session["collected"] = []

func update(pegs: Array, slots: Array, width: float, height: float, time_scale: float = 1.0, tilt: Vector2 = Vector2.ZERO) -> String:
	"""
	更新弹球物理状态
	返回值: "finished" 表示弹球已到达底部，null 表示继续活动
	"""
	if not active:
		return ""
	
	viewport_width = width
	viewport_height = height
	
	# 应用重力
	vel.y += gravity_acceleration * time_scale
	
	# 应用倾斜影响
	if tilt != Vector2.ZERO:
		vel.x += tilt.x * tilt_influence
	
	# 应用摩擦
	vel = vel * friction
	
	# 移动
	pos += vel * time_scale
	global_position = pos
	
	# 边界碰撞 - 左右边界
	if pos.x < radius:
		pos.x = radius
		vel.x *= -bounce_damping
	
	if pos.x > width - radius:
		pos.x = width - radius
		vel.x *= -bounce_damping
	
	# 钉子碰撞检测
	for peg in pegs:
		var peg_pos = peg.get("pos", Vector2.ZERO)
		var peg_radius = peg.get("radius", 5.0)
		var peg_type = peg.get("type", "normal")
		
		var dist = pos.distance_to(peg_pos)
		
		if dist < radius + peg_radius:
			# 计算法向量
			var normal = (pos - peg_pos).normalized()
			
			# 碰撞响应 - 反射速度
			var dot_product = vel.dot(normal)
			vel = vel - normal * (2 * dot_product)
			vel = vel * bounce_damping
			
			# 收集属性
			if peg_type != "normal":
				session["collected"].append(peg_type)
			
			# 分离重叠
			var overlap = radius + peg_radius - dist
			pos = pos + normal * overlap
	
	# 检查是否到达底部
	if pos.y > height:
		active = false
		return "finished"
	
	return ""

func get_collected() -> Array:
	"""获取收集的属性列表"""
	return session.get("collected", [])

func set_session(session_dict: Dictionary) -> void:
	"""设置会话数据"""
	session = session_dict.duplicate()
	if not session.has("collected"):
		session["collected"] = []

func _draw() -> void:
	"""绘制弹球"""
	var color = Color.WHITE
	
	# 根据定义获取颜色
	if def.has("color"):
		color = def["color"]
	
	draw_circle(Vector2.ZERO, radius, color)
	
	# 绘制轮廓
	draw_arc(Vector2.ZERO, radius, 0, TAU, 32, Color.GRAY, 1.0)
