extends Area2D

class_name Projectile

# 基础属性
var pos: Vector2
var vel: Vector2
var radius: float = 6.0
var active: bool = true

# 属性系统
var attrs: Dictionary = {}
var bounce_count: int = 0
var pierce_count: int = 0
var damage: int = 10
var element: String = ""

# 轨迹系统
var trail: Array[Vector2] = []
var max_trail_length: int = 10

# 游戏引用
var game_ref: Node = null

# 元素颜色映射
var element_colors: Dictionary = {
	"pyro": Color("#f97316"),
	"cryo": Color("#06b6d4"),
	"lightning": Color("#c084fc"),
	"": Color.WHITE
}

func _ready() -> void:
	# 设置初始位置
	global_position = pos
	
	# 连接碰撞信号
	area_entered.connect(_on_area_entered)

func _init(x: float = 0, y: float = 0, vx: float = 0, vy: float = 0, attrs_dict: Dictionary = {}) -> void:
	pos = Vector2(x, y)
	vel = Vector2(vx, vy)
	attrs = attrs_dict.duplicate()
	
	# 从属性字典中提取值
	bounce_count = attrs.get("bounce", 0)
	pierce_count = attrs.get("pierce", 0)
	damage = attrs.get("damage", 10)
	element = attrs.get("element", "")

func update(game: Node) -> void:
	if not active:
		return
	
	game_ref = game
	
	# 移动
	pos += vel
	global_position = pos
	
	# 记录轨迹
	trail.append(pos)
	if trail.size() > max_trail_length:
		trail.pop_front()
	
	# 边界检测 - 水平边界反弹
	if pos.x < 0 or pos.x > game.get_viewport_rect().size.x:
		vel.x *= -1
		bounce_count -= 1
	
	# 边界检测 - 顶部反弹
	if pos.y < 0:
		vel.y *= -1
		bounce_count -= 1
	
	# 边界检测 - 底部销毁
	if pos.y > game.get_viewport_rect().size.y:
		active = false
		queue_free()
	
	# 弹跳次数用尽
	if bounce_count < 0 and attrs.get("bounce", 0) > 0:
		active = false
		queue_free()

func on_hit_enemy(enemy: Node, game: Node) -> void:
	"""处理与敌人的碰撞"""
	if enemy.has_method("take_damage"):
		enemy.take_damage(damage, element, game)
	
	# 穿透逻辑
	if pierce_count > 0:
		pierce_count -= 1
	else:
		active = false
		queue_free()
	
	# 散射逻辑
	if attrs.get("scatter", 0) > 0:
		var scatter_count: int = attrs.get("scatter", 0)
		for i in range(scatter_count):
			var angle: float = randf() * TAU
			var speed: float = 5.0
			var new_attrs = attrs.duplicate()
			new_attrs["scatter"] = 0
			
			var new_projectile = Projectile.new(
				pos.x, pos.y,
				cos(angle) * speed,
				sin(angle) * speed,
				new_attrs
			)
			game.add_child(new_projectile)
			if game.has_meta("projectiles"):
				game.get_meta("projectiles").append(new_projectile)

func _on_area_entered(area: Area2D) -> void:
	"""处理碰撞信号"""
	if not active:
		return
	
	# 检查是否与敌人碰撞
	if area.is_in_group("enemies"):
		on_hit_enemy(area, game_ref)

func _draw() -> void:
	"""绘制轨迹和弹丸"""
	# 绘制轨迹
	if trail.size() > 1:
		var trail_color = Color(1, 1, 1, 0.3)
		for i in range(trail.size() - 1):
			draw_line(trail[i] - global_position, trail[i + 1] - global_position, trail_color, 2.0)
	
	# 绘制弹丸
	var color = get_color()
	draw_circle(Vector2.ZERO, radius, color)

func get_color() -> Color:
	"""根据元素类型返回颜色"""
	return element_colors.get(element, Color.WHITE)

func set_game_reference(game: Node) -> void:
	"""设置游戏引用"""
	game_ref = game
