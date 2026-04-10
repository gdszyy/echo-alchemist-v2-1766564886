# 粒子特效类 - 支持多种粒子模式
# 从 JavaScript entities.js 中的 Particle 类迁移
# 支持模式: normal, spark, ember, mist, shard, smoke, line, wind_slash

extends Node2D

class_name ParticleEffect

# 粒子模式枚举
enum ParticleMode {
	NORMAL,
	SPARK,
	EMBER,
	MIST,
	SHARD,
	SMOKE,
	LINE,
	WIND_SLASH
}

# 基础属性
var color: Color = Color.WHITE
var mode: ParticleMode = ParticleMode.NORMAL
var life: float = 1.0
var max_life: float = 1.0

# 物理属性
var vel: Vector2 = Vector2.ZERO
var drag: float = 0.92
var gravity: float = 0.0
var decay: float = 0.05
var particle_size: float = 2.0

# 特殊属性
var turbulence: float = 0.0
var wobble: float = 0.0
var angle: float = 0.0
var spin: float = 0.0
var scale_x: float = 1.0
var scale_y: float = 1.0
var line_scale: Vector2 = Vector2.ONE


func _ready() -> void:
	"""初始化粒子"""
	wobble = randf() * PI * 2.0


func _process(delta: float) -> void:
	"""每帧更新粒子"""
	var time_scale = delta * 60.0  # 转换为与原 JS 相同的时间尺度
	
	# 余烬模式的横向摆动
	if mode == ParticleMode.EMBER:
		position.x += sin(life * 10.0 + wobble) * 0.5 * time_scale
	
	# 湍流效果
	if turbulence > 0:
		var speed = vel.length()
		if speed > 0.1:
			var perp = Vector2(-vel.y / speed, vel.x / speed)
			var wave = sin(life * 15.0 + wobble) * turbulence
			position += perp * wave * time_scale
	
	# 更新位置和速度
	position += vel * time_scale
	vel *= pow(drag, time_scale)
	vel.y += gravity * time_scale
	
	# 旋转更新（冰渣和迷雾模式）
	if mode == ParticleMode.SHARD or mode == ParticleMode.MIST:
		angle += spin * time_scale
	
	# 生命衰减
	life -= decay * time_scale
	
	# 生命结束时销毁
	if life <= 0:
		queue_free()
	else:
		queue_redraw()


func _draw() -> void:
	"""绘制粒子"""
	if life <= 0:
		return
	
	var alpha = maxf(0.0, life)
	
	match mode:
		ParticleMode.MIST:
			_draw_mist(alpha)
		ParticleMode.EMBER:
			_draw_ember(alpha)
		ParticleMode.SHARD:
			_draw_shard(alpha)
		ParticleMode.WIND_SLASH:
			_draw_wind_slash(alpha)
		ParticleMode.LINE:
			_draw_line(alpha)
		ParticleMode.SPARK:
			_draw_spark(alpha)
		_:
			_draw_normal(alpha)


func _draw_mist(alpha: float) -> void:
	"""绘制迷雾粒子"""
	var draw_color = color
	draw_color.a = alpha * 0.4
	draw_circle(Vector2.ZERO, particle_size, draw_color)


func _draw_ember(alpha: float) -> void:
	"""绘制余烬粒子"""
	# 核心亮黄
	var core_color = Color(1.0, 1.0, 0.78, alpha)
	draw_circle(Vector2.ZERO, particle_size * 0.5, core_color)
	
	# 外围橙红
	var glow_color = Color(0.98, 0.57, 0.24, alpha * 0.5)
	draw_circle(Vector2.ZERO, particle_size * 2.0, glow_color)


func _draw_shard(alpha: float) -> void:
	"""绘制冰渣粒子"""
	var draw_color = color
	draw_color.a = alpha
	
	# 构建菱形顶点
	var points = PackedVector2Array()
	var s = particle_size
	
	# 应用旋转和缩放
	var transform = Transform2D()
	transform = transform.rotated(angle)
	transform = transform.scaled(Vector2(scale_x, scale_y))
	
	points.append(transform * Vector2(0, -s))
	points.append(transform * Vector2(s * 0.6, 0))
	points.append(transform * Vector2(0, s * 1.5))
	points.append(transform * Vector2(-s * 0.6, 0))
	
	draw_colored_polygon(points, draw_color)


func _draw_wind_slash(alpha: float) -> void:
	"""绘制风刃粒子"""
	var draw_color = Color(0.2, 0.83, 0.6, alpha)  # 青色
	
	# 根据速度方向旋转
	var rot = vel.angle()
	var speed = vel.length()
	var stretch = minf(3.0, 1.0 + speed * 0.1)
	
	# 绘制梭形
	var transform = Transform2D()
	transform = transform.rotated(rot)
	transform = transform.scaled(Vector2(stretch, 1.0))
	
	var s = particle_size
	var points = PackedVector2Array()
	points.append(transform * Vector2(-s * 1.5, 0))
	points.append(transform * Vector2(0, s * 0.4))
	points.append(transform * Vector2(s * 1.5, 0))
	points.append(transform * Vector2(0, -s * 0.4))
	
	draw_colored_polygon(points, draw_color)


func _draw_line(alpha: float) -> void:
	"""绘制线条粒子"""
	var draw_color = color
	draw_color.a = alpha
	
	var rot = vel.angle()
	var transform = Transform2D()
	transform = transform.rotated(rot)
	transform = transform.scaled(line_scale)
	
	var start = transform * Vector2(-1, 0)
	var end = transform * Vector2(1, 0)
	
	draw_line(start, end, draw_color, particle_size)


func _draw_spark(alpha: float) -> void:
	"""绘制火花粒子"""
	var draw_color = color
	draw_color.a = alpha
	
	var rot = vel.angle()
	
	# 绘制拉长的椭圆形火花
	var transform = Transform2D()
	transform = transform.rotated(rot)
	
	var points = PackedVector2Array()
	var segments = 8
	for i in range(segments):
		var t = float(i) / segments * TAU
		var x = cos(t) * particle_size * 2.0
		var y = sin(t) * particle_size * 0.4
		points.append(transform * Vector2(x, y))
	
	draw_colored_polygon(points, draw_color)


func _draw_normal(alpha: float) -> void:
	"""绘制普通粒子"""
	var draw_color = color
	draw_color.a = alpha
	draw_circle(Vector2.ZERO, particle_size, draw_color)


# ==================== 设置方法 ====================

func setup(x: float, y: float, particle_color: Color, particle_mode: String = "normal") -> void:
	"""设置粒子参数"""
	position = Vector2(x, y)
	color = particle_color
	
	# 解析模式字符串
	match particle_mode:
		"spark":
			mode = ParticleMode.SPARK
			_init_spark()
		"ember":
			mode = ParticleMode.EMBER
			_init_ember()
		"mist":
			mode = ParticleMode.MIST
			_init_mist()
		"shard":
			mode = ParticleMode.SHARD
			_init_shard()
		"smoke":
			mode = ParticleMode.SMOKE
			_init_smoke()
		"line":
			mode = ParticleMode.LINE
			_init_line()
		"wind_slash":
			mode = ParticleMode.WIND_SLASH
			_init_wind_slash()
		_:
			mode = ParticleMode.NORMAL
			_init_normal()
	
	max_life = life


func _init_spark() -> void:
	"""初始化火花模式"""
	var random_angle = randf() * TAU
	var speed = randf() * 5.0 + 2.0
	vel = Vector2(cos(random_angle) * speed, sin(random_angle) * speed)
	drag = 0.85
	gravity = 0.1
	decay = 0.05 + randf() * 0.05
	particle_size = randf() * 2.0 + 1.0


func _init_ember() -> void:
	"""初始化余烬模式"""
	vel = Vector2((randf() - 0.5) * 1.0, -randf() * 2.0 - 0.5)
	drag = 0.98
	gravity = -0.08
	decay = 0.015 + randf() * 0.02
	particle_size = randf() * 1.5 + 0.5
	wobble = randf() * 10.0


func _init_mist() -> void:
	"""初始化迷雾模式"""
	vel = Vector2((randf() - 0.5) * 0.8, randf() * 0.5 + 0.5)
	drag = 0.96
	gravity = 0.02
	decay = 0.015 + randf() * 0.01
	particle_size = randf() * 8.0 + 6.0
	angle = randf() * TAU


func _init_shard() -> void:
	"""初始化冰渣模式"""
	var random_angle = randf() * TAU
	var speed = randf() * 4.0 + 2.0
	vel = Vector2(cos(random_angle) * speed, sin(random_angle) * speed)
	drag = 0.96
	gravity = 0.4
	decay = 0.02 + randf() * 0.02
	particle_size = randf() * 4.0 + 2.0
	scale_x = randf() * 0.5 + 0.5
	scale_y = randf() * 1.5 + 1.0
	angle = randf() * TAU
	spin = (randf() - 0.5) * 0.5


func _init_smoke() -> void:
	"""初始化烟雾模式"""
	vel = Vector2((randf() - 0.5) * 0.5, -randf() * 1.5 - 0.5)
	drag = 0.98
	gravity = -0.02
	decay = 0.015
	particle_size = randf() * 6.0 + 4.0
	life = 1.2


func _init_line() -> void:
	"""初始化线条模式"""
	vel = Vector2.ZERO
	drag = 0.98
	gravity = 0.0
	decay = 0.02
	particle_size = 2.0
	life = 1.0
	line_scale = Vector2.ONE


func _init_wind_slash() -> void:
	"""初始化风刃模式"""
	vel = Vector2.ZERO
	drag = 1.0
	gravity = 0.0
	decay = 0.05
	particle_size = 10.0
	life = 1.0


func _init_normal() -> void:
	"""初始化普通模式"""
	vel = Vector2((randf() - 0.5) * 4.0, (randf() - 0.5) * 4.0)
	drag = 0.92
	gravity = 0.0
	decay = 0.05
	particle_size = randf() * 2.0 + 1.0


func set_velocity(velocity: Vector2) -> void:
	"""设置粒子速度"""
	vel = velocity


func set_turbulence(value: float) -> void:
	"""设置湍流强度"""
	turbulence = value
