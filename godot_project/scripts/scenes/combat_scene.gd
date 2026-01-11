extends Node2D
## 战斗场景 - 处理战斗的显示和逻辑

# 引用
var phase_manager = null

# 敌人相关（使用内部类 CombatEnemy 避免与全局 Enemy 冲突）
var enemies: Array = []
var current_enemy_index: int = 0

# 弹药相关
var ammo_queue: Array = []
var current_ammo_index: int = 0

# 统计
var total_damage: int = 0
var shots_fired: int = 0

# 配置
var board_width: float = 800.0
var board_height: float = 600.0

func _ready() -> void:
	print("CombatScene ready")

func _process(delta: float) -> void:
	if phase_manager and phase_manager.is_in_phase("combat"):
		_update_combat(delta)
		queue_redraw()

func _draw() -> void:
	# 绘制背景
	draw_rect(Rect2(0, 0, board_width, board_height), Color.DARK_RED)
	
	# 绘制敌人
	for enemy in enemies:
		if enemy is CombatEnemy:
			_draw_enemy(enemy)
	
	# 绘制 UI 信息
	_draw_combat_ui()

func _draw_enemy(enemy: CombatEnemy) -> void:
	var pos = enemy.get_position()
	var hp = enemy.get_hp()
	var max_hp = enemy.get_max_hp()
	
	# 绘制敌人
	draw_circle(pos, 20.0, Color.RED)
	
	# 绘制血条
	var hp_bar_width = 40.0
	var hp_bar_height = 5.0
	var hp_ratio = float(hp) / float(max_hp)
	
	draw_rect(
		Rect2(pos.x - hp_bar_width / 2.0, pos.y - 30.0, hp_bar_width, hp_bar_height),
		Color.DARK_RED
	)
	draw_rect(
		Rect2(pos.x - hp_bar_width / 2.0, pos.y - 30.0, hp_bar_width * hp_ratio, hp_bar_height),
		Color.GREEN
	)

func _draw_combat_ui() -> void:
	var text_pos = Vector2(10.0, 20.0)
	var font = ThemeDB.fallback_font
	
	draw_string(font, text_pos, "Total Damage: %d" % total_damage)
	draw_string(font, text_pos + Vector2(0, 30), "Shots Fired: %d" % shots_fired)
	
	if current_enemy_index < enemies.size():
		var enemy = enemies[current_enemy_index]
		if enemy is CombatEnemy:
			draw_string(
				font,
				text_pos + Vector2(0, 60),
				"Enemy HP: %d/%d" % [enemy.get_hp(), enemy.get_max_hp()]
			)

func _update_combat(delta: float) -> void:
	if not phase_manager:
		return
	
	# 检查是否有敌人
	if enemies.is_empty():
		_spawn_enemy_wave()
	
	# 检查当前敌人是否已死亡
	if current_enemy_index < enemies.size():
		var current_enemy = enemies[current_enemy_index]
		if current_enemy.is_dead():
			current_enemy_index += 1
			
			# 检查是否所有敌人都已死亡
			if current_enemy_index >= enemies.size():
				_on_wave_complete()

func _spawn_enemy_wave() -> void:
	enemies.clear()
	current_enemy_index = 0
	
	# 生成 3 个敌人
	for i in range(3):
		var enemy_x = 200.0 + i * 200.0
		var enemy_y = 150.0
		var enemy = CombatEnemy.new(enemy_x, enemy_y, 100)
		enemies.append(enemy)
	
	print("Enemy wave spawned: %d enemies" % enemies.size())

func _fire_ammo() -> void:
	if current_ammo_index >= ammo_queue.size():
		return
	
	if current_enemy_index >= enemies.size():
		_on_wave_complete()
		return
	
	var ammo = ammo_queue[current_ammo_index]
	var current_enemy = enemies[current_enemy_index]
	
	# 计算伤害
	var damage = ammo.get("damage", 10)
	
	# 应用属性效果
	if ammo.get("pierce", 0) > 0:
		damage = int(damage * 1.5)
	if ammo.get("cryo", 0) > 0:
		damage = int(damage * 1.2)
	if ammo.get("pyro", 0) > 0:
		damage = int(damage * 1.3)
	if ammo.get("lightning", 0) > 0:
		damage = int(damage * 1.25)
	
	# 造成伤害
	current_enemy.take_damage(damage)
	total_damage += damage
	shots_fired += 1
	current_ammo_index += 1
	
	print("Ammo fired! Damage: %d, Total: %d" % [damage, total_damage])

func _on_wave_complete() -> void:
	print("Wave complete! Total damage: %d" % total_damage)
	if phase_manager:
		phase_manager.switch_phase("gameover")

func set_phase_manager(manager) -> void:
	phase_manager = manager
	
	if phase_manager:
		ammo_queue = phase_manager.get_ammo_queue()
		board_width = phase_manager.game_width
		board_height = phase_manager.game_height

func fire_next_shot() -> void:
	_fire_ammo()

func get_total_damage() -> int:
	return total_damage


# ============ 内部敌人类（避免与全局 Enemy 冲突）============

class CombatEnemy:
	var position_x: float
	var position_y: float
	var hp: int
	var max_hp: int
	
	func _init(p_x: float, p_y: float, p_hp: int) -> void:
		position_x = p_x
		position_y = p_y
		hp = p_hp
		max_hp = p_hp
	
	func get_position() -> Vector2:
		return Vector2(position_x, position_y)
	
	func get_hp() -> int:
		return hp
	
	func get_max_hp() -> int:
		return max_hp
	
	func take_damage(damage: int) -> void:
		hp = max(0, hp - damage)
	
	func is_dead() -> bool:
		return hp <= 0
