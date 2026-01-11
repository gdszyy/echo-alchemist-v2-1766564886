# 渲染效果系统 - Godot 4.x 版本
# 处理特殊渲染效果：震屏、闪电、粒子等
# 迁移自 JavaScript render_system.js

extends Node

class_name RenderEffectSystem

# 配置常量
const CONFIG = {
	"colors": {
		"bg": Color.BLACK,
		"peg": Color(0.8, 0.8, 0.8, 1.0),
		"matNormal": Color(0.8, 0.8, 0.8, 1.0),
		"matFire": Color(1.0, 0.4, 0.2, 1.0),
		"matIce": Color(0.4, 0.8, 1.0, 1.0),
		"matElectric": Color(1.0, 1.0, 0.2, 1.0),
	}
}

# 屏幕震动
var screen_shake: float = 0.0
var screen_shake_camera: Camera2D = null

# 闪电
var lightning_bolts: Array = []
var lightning_scene = preload("res://scenes/effects/lightning_bolt.tscn")

# 粒子系统
var particles: Array = []

# 钉子、弹珠、敌人、弹射物引用
var pegs: Array = []
var drop_balls: Array = []
var enemies: Array = []
var projectiles: Array = []

# 当前游戏阶段
var phase: String = "gathering"  # "gathering" 或 "combat"

# 容器节点
var pegs_container: Node2D = null
var balls_container: Node2D = null
var enemies_container: Node2D = null
var projectiles_container: Node2D = null
var effects_container: Node2D = null
var particles_container: Node2D = null


func _ready() -> void:
	"""初始化渲染系统"""
	# 获取或创建容器节点
	_setup_containers()
	
	# 获取摄像机用于震屏效果
	screen_shake_camera = get_tree().root.get_camera_2d()


func _setup_containers() -> void:
	"""设置场景树容器结构"""
	var root = get_parent()
	
	# 创建各个容器（如果不存在）
	pegs_container = _get_or_create_container(root, "PegsContainer")
	balls_container = _get_or_create_container(root, "BallsContainer")
	enemies_container = _get_or_create_container(root, "EnemiesContainer")
	projectiles_container = _get_or_create_container(root, "ProjectilesContainer")
	effects_container = _get_or_create_container(root, "EffectsContainer")
	particles_container = _get_or_create_container(root, "ParticlesContainer")


func _get_or_create_container(parent: Node, name: String) -> Node2D:
	"""获取或创建容器节点"""
	var existing = parent.get_node_or_null(name)
	if existing:
		return existing
	
	var container = Node2D.new()
	container.name = name
	parent.add_child(container)
	return container


func _process(delta: float) -> void:
	"""每帧更新"""
	# 更新震屏效果
	_update_screen_shake(delta)
	
	# 更新闪电
	_update_lightning_bolts(delta)
	
	# 更新粒子
	_update_particles(delta)


func _update_screen_shake(delta: float) -> void:
	"""更新屏幕震动效果"""
	if screen_shake > 0.0:
		if screen_shake_camera:
			# 生成随机震动偏移
			var shake_x = (randf() - 0.5) * screen_shake * 2.0
			var shake_y = (randf() - 0.5) * screen_shake * 2.0
			
			# 应用偏移到摄像机
			screen_shake_camera.offset = Vector2(shake_x, shake_y)
		
		# 逐帧衰减震动强度
		screen_shake *= 0.9


func _update_lightning_bolts(delta: float) -> void:
	"""更新闪电效果"""
	var to_remove = []
	
	for i in range(lightning_bolts.size()):
		var bolt = lightning_bolts[i]
		bolt.lifetime -= delta
		
		if bolt.lifetime <= 0:
			to_remove.append(i)
	
	# 移除已过期的闪电
	for i in to_remove.reverse():
		if lightning_bolts[i].node:
			lightning_bolts[i].node.queue_free()
		lightning_bolts.remove_at(i)


func _update_particles(delta: float) -> void:
	"""更新粒子效果"""
	var to_remove = []
	
	for i in range(particles.size()):
		var particle = particles[i]
		particle.lifetime -= delta
		particle.alpha = clamp(particle.lifetime / particle.max_lifetime, 0.0, 1.0)
		
		if particle.lifetime <= 0:
			to_remove.append(i)
	
	# 移除已过期的粒子
	for i in to_remove.reverse():
		particles.remove_at(i)


# ============ 公共接口 ============

func trigger_screen_shake(intensity: float) -> void:
	"""触发屏幕震动效果"""
	screen_shake = intensity


func create_lightning_bolt(start_pos: Vector2, end_pos: Vector2, duration: float = 0.2) -> void:
	"""创建闪电效果"""
	var bolt_instance = lightning_scene.instantiate()
	effects_container.add_child(bolt_instance)
	
	var bolt_data = {
		"node": bolt_instance,
		"start_pos": start_pos,
		"end_pos": end_pos,
		"lifetime": duration,
		"max_lifetime": duration
	}
	
	lightning_bolts.append(bolt_data)
	
	# 初始化闪电节点
	if bolt_instance.has_method("setup"):
		bolt_instance.setup(start_pos, end_pos, duration)


func create_particle(pos: Vector2, color: Color, size: float, lifetime: float) -> void:
	"""创建粒子效果"""
	var particle = {
		"pos": pos,
		"color": color,
		"size": size,
		"lifetime": lifetime,
		"max_lifetime": lifetime,
		"alpha": 1.0
	}
	
	particles.append(particle)


func create_peg_glow_particles(peg_pos: Vector2, count: int = 8) -> void:
	"""为钉子创建发光粒子"""
	for i in range(count):
		var angle = (TAU / count) * i
		var offset = Vector2(cos(angle), sin(angle)) * 20
		var particle_pos = peg_pos + offset
		
		create_particle(particle_pos, Color.WHITE, 3.0, 0.5)


func create_impact_particles(pos: Vector2, color: Color, count: int = 12) -> void:
	"""创建撞击粒子效果"""
	for i in range(count):
		var angle = (TAU / count) * i + randf_range(-0.2, 0.2)
		var speed = randf_range(50, 150)
		var velocity = Vector2(cos(angle), sin(angle)) * speed
		
		var particle = {
			"pos": pos,
			"velocity": velocity,
			"color": color,
			"size": randf_range(2, 6),
			"lifetime": randf_range(0.3, 0.8),
			"max_lifetime": 0.6,
			"alpha": 1.0
		}
		
		particles.append(particle)


func set_phase(new_phase: String) -> void:
	"""设置游戏阶段"""
	phase = new_phase


# ============ 渲染辅助函数 ============

func draw_peg(canvas: CanvasItem, peg: Node2D, peg_data: Dictionary) -> void:
	"""绘制单个钉子"""
	var color = CONFIG.colors.peg
	
	# 根据类型选择颜色
	if peg_data.has("type") and peg_data.type != "normal":
		var type_key = "mat" + peg_data.type.capitalize()
		if CONFIG.colors.has(type_key):
			color = CONFIG.colors[type_key]
	
	# 绘制钉子圆形
	var radius = peg_data.get("radius", 8.0)
	canvas.draw_circle(peg.global_position, radius, color)
	
	# 发光效果
	if peg_data.get("glow_intensity", 0.0) > 0:
		var glow_color = Color.WHITE
		glow_color.a = peg_data.glow_intensity * 0.5
		canvas.draw_circle(peg.global_position, radius + 5, glow_color)


func draw_ball(canvas: CanvasItem, ball: Node2D, ball_data: Dictionary) -> void:
	"""绘制单个弹珠"""
	var radius = ball_data.get("radius", 6.0)
	var color = ball_data.get("color", Color.WHITE)
	
	# 绘制弹珠
	canvas.draw_circle(ball.global_position, radius, color)
	
	# 高光效果
	var highlight_color = Color.WHITE
	highlight_color.a = 0.5
	var highlight_pos = ball.global_position + Vector2(-radius * 0.3, -radius * 0.3)
	canvas.draw_circle(highlight_pos, radius * 0.3, highlight_color)


func draw_particles(canvas: CanvasItem) -> void:
	"""绘制所有粒子"""
	for particle in particles:
		var color = particle.color
		color.a = particle.alpha
		canvas.draw_circle(particle.pos, particle.size, color)


# ============ 调试函数 ============

func get_stats() -> Dictionary:
	"""获取渲染系统统计信息"""
	return {
		"screen_shake": screen_shake,
		"lightning_bolts": lightning_bolts.size(),
		"particles": particles.size(),
		"phase": phase
	}
