# 主游戏场景 - 集成渲染系统
# 演示如何使用 RenderEffectSystem

extends Node2D

class_name GameScene

# 渲染系统
var render_system: RenderEffectSystem = null

# 游戏对象容器
var pegs: Array = []
var drop_balls: Array = []
var enemies: Array = []
var projectiles: Array = []

# 摄像机
var camera: Camera2D = null


func _ready() -> void:
	"""初始化游戏场景"""
	# 创建或获取渲染系统
	render_system = RenderEffectSystem.new()
	add_child(render_system)
	
	# 获取摄像机
	camera = get_tree().root.get_camera_2d()
	
	# 初始化游戏对象
	_setup_game_objects()


func _setup_game_objects() -> void:
	"""设置游戏对象"""
	# 这里可以添加钉子、弹珠等游戏对象
	pass


func _process(delta: float) -> void:
	"""每帧更新"""
	# 处理输入
	_handle_input()


func _handle_input() -> void:
	"""处理输入"""
	# 演示：按 Space 触发震屏
	if Input.is_action_just_pressed("ui_accept"):
		render_system.trigger_screen_shake(10.0)
	
	# 演示：按 L 创建闪电
	if Input.is_action_just_pressed("ui_select"):
		var start = Vector2(100, 100)
		var end = Vector2(400, 300)
		render_system.create_lightning_bolt(start, end, 0.3)
	
	# 演示：按 P 创建粒子
	if Input.is_action_just_pressed("ui_focus_next"):
		var mouse_pos = get_global_mouse_position()
		render_system.create_impact_particles(mouse_pos, Color.WHITE, 12)


func _draw() -> void:
	"""自定义绘制"""
	# 绘制粒子
	render_system.draw_particles(self)


# ============ 公共接口 ============

func add_peg(peg: Node2D, peg_data: Dictionary) -> void:
	"""添加钉子"""
	pegs.append(peg)
	render_system.pegs_container.add_child(peg)


func add_ball(ball: Node2D, ball_data: Dictionary) -> void:
	"""添加弹珠"""
	drop_balls.append(ball)
	render_system.balls_container.add_child(ball)


func add_enemy(enemy: Node2D) -> void:
	"""添加敌人"""
	enemies.append(enemy)
	render_system.enemies_container.add_child(enemy)


func add_projectile(projectile: Node2D) -> void:
	"""添加弹射物"""
	projectiles.append(projectile)
	render_system.projectiles_container.add_child(projectile)


func trigger_screen_shake(intensity: float) -> void:
	"""触发屏幕震动"""
	render_system.trigger_screen_shake(intensity)


func create_lightning(start_pos: Vector2, end_pos: Vector2) -> void:
	"""创建闪电"""
	render_system.create_lightning_bolt(start_pos, end_pos)


func set_game_phase(phase: String) -> void:
	"""设置游戏阶段"""
	render_system.set_phase(phase)
