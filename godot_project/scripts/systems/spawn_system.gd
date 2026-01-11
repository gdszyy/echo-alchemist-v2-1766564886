# 生成系统 - 负责敌人、弹丸、特效的生成
# 从 JavaScript spawn_system.js 迁移

extends Node

class_name SpawnSystem

# 信号
signal enemy_spawned(enemy: Node2D)
signal projectile_spawned(projectile: Node2D)
signal particle_spawned(particle: Node2D)
signal score_added(amount: int, total: int)
signal skill_point_added(amount: int, total: int)
signal level_up_triggered

# 预加载场景（需要在编辑器中设置）
var enemy_scene: PackedScene
var projectile_scene: PackedScene
var particle_scene: PackedScene
var floating_text_scene: PackedScene
var shockwave_scene: PackedScene
var energy_orb_scene: PackedScene

# 游戏引用
var game_ref: Node = null
var canvas_width: float = 800.0
var canvas_height: float = 600.0

# 敌人配置
var enemy_width: float = 60.0
var enemy_height: float = 40.0
var enemy_cols: int = 6

# 游戏状态
var current_round: int = 0
var difficulty_growth_factor: float = 1.0
var next_round_hp_multiplier: float = 1.0
var score: int = 0
var score_multiplier: float = 1.0
var skill_points: int = 0
var run_currency: int = 0

# 容器引用
var enemies: Array = []
var projectiles: Array = []
var particles: Array = []
var shockwaves: Array = []
var energy_orbs: Array = []
var floating_texts: Array = []
var son_sword_queue: Array = []
var sword_qis: Array = []
var spores: Array = []
var storm_cores: Array = []

# 配置常量
const MAX_PARTICLES: int = 800
const EMBER_LIMIT: int = 150

# 词缀权重池定义
var affix_pool_definitions: Array = [
	{ "id": "shield",  "weight_func": "_weight_shield" },
	{ "id": "regen",   "weight_func": "_weight_regen" },
	{ "id": "healer",  "weight_func": "_weight_healer" },
	{ "id": "haste",   "weight_func": "_weight_haste" },
	{ "id": "jump",    "weight_func": "_weight_jump" },
	{ "id": "clone",   "weight_func": "_weight_clone" },
	{ "id": "devour",  "weight_func": "_weight_devour" },
	{ "id": "berserk", "weight_func": "_weight_berserk" }
]


func _ready() -> void:
	"""初始化生成系统"""
	pass


# ==================== 词缀权重函数 ====================

func _weight_shield(r: int) -> float:
	if r < 3: return 0.0
	return 100.0 if r < 8 else 50.0

func _weight_regen(r: int) -> float:
	if r < 5: return 0.0
	return 80.0 if r < 12 else 40.0

func _weight_healer(r: int) -> float:
	if r < 6: return 0.0
	return 60.0

func _weight_haste(r: int) -> float:
	if r < 8: return 0.0
	return 70.0 if r < 15 else 50.0

func _weight_jump(r: int) -> float:
	if r < 9: return 0.0
	return 60.0

func _weight_clone(r: int) -> float:
	if r < 12: return 0.0
	return 50.0

func _weight_devour(r: int) -> float:
	if r < 12: return 0.0
	return 40.0

func _weight_berserk(r: int) -> float:
	if r < 14: return 0.0
	return float(r * 3)


# ==================== 词缀生成 ====================

func generate_affixes() -> Array[String]:
	"""生成敌人词缀"""
	var affixes: Array[String] = []
	var r = current_round
	
	# 1. 决定生成多少个词条
	var count = 0
	var chance1 = minf(0.6, 0.1 + r * 0.025)
	var chance2 = 0.0 if r <= 10 else minf(0.15, (r - 10) * 0.01)
	
	var roll = randf()
	if roll < chance2:
		count = 2
	elif roll < chance1 + chance2:
		count = 1
	
	if count == 0:
		return affixes
	
	# 2. 计算当前回合的有效权重池
	var valid_pool: Array = []
	var total_weight: float = 0.0
	
	for def in affix_pool_definitions:
		var w = call(def.weight_func, r)
		if w > 0:
			valid_pool.append({ "id": def.id, "w": w })
			total_weight += w
	
	if total_weight <= 0:
		return affixes
	
	# 3. 抽取词条
	for i in range(count):
		var random_val = randf() * total_weight
		for item in valid_pool:
			if random_val < item.w:
				if item.id not in affixes:
					affixes.append(item.id)
				break
			random_val -= item.w
	
	return affixes


# ==================== 敌人生成 ====================

func spawn_enemy_row_at(y_pos: float) -> void:
	"""在指定位置生成敌人行（导演系统 + 机会生成器）"""
	var w = enemy_width
	
	# 计算基础血量
	var base_hp = _calculate_base_hp()
	
	# 标记占用状态
	var occupied_cols: Array[bool] = []
	occupied_cols.resize(enemy_cols)
	occupied_cols.fill(false)
	
	var pending_spawns: Array = []
	
	# =========================================
	# 1. 导演系统 (The Director) - 生成精英小队
	# =========================================
	var director_chance = minf(0.35, 0.15 + (current_round * 0.01))
	if randf() < director_chance:
		var squad_type = _select_squad_type()
		_apply_squad_preset(squad_type, occupied_cols, pending_spawns, base_hp)
	
	# =========================================
	# 2. 机会生成器 (Opportunity Generator)
	# =========================================
	var layout_type = "random"
	var help_chance = maxf(0.42, 0.99 - (current_round * 0.02))
	
	if randf() < help_chance:
		var types = ["gap", "weak_spot", "checkerboard"]
		layout_type = types[randi() % types.size()]
	
	var weak_spot_col = -1
	
	# 策略 A: 缺口
	if layout_type == "gap":
		var gap_col = randi() % enemy_cols
		if not occupied_cols[gap_col]:
			occupied_cols[gap_col] = true
	
	# 策略 B: 弱点
	elif layout_type == "weak_spot":
		var free_indices: Array[int] = []
		for idx in range(enemy_cols):
			if not occupied_cols[idx]:
				free_indices.append(idx)
		if free_indices.size() > 0:
			weak_spot_col = free_indices[randi() % free_indices.size()]
	
	# 策略 C: 棋盘
	elif layout_type == "checkerboard":
		var parity = 0 if randf() > 0.5 else 1
		for c in range(enemy_cols):
			if c % 2 == parity and not occupied_cols[c]:
				occupied_cols[c] = true
	
	# =========================================
	# 3. 填充剩余空位
	# =========================================
	var min_enemies = mini(enemy_cols, 2 + floori(current_round / 4.0))
	var current_count = pending_spawns.size()
	
	# 获取未占用的列并洗牌
	var free_cols: Array[int] = []
	for c in range(enemy_cols):
		if not occupied_cols[c]:
			free_cols.append(c)
	free_cols.shuffle()
	
	# 填充
	for c in free_cols:
		var center_x = c * w + w / 2.0
		var should_spawn = false
		
		if c == weak_spot_col:
			should_spawn = true
		elif current_count < min_enemies or randf() < 0.7:
			should_spawn = true
		
		if should_spawn:
			var hp = floori(base_hp * (0.8 + randf() * 0.4))
			
			# 弱点怪血量极低
			if c == weak_spot_col:
				var variant_ratio = (12.0 + (randf() * 14.0 - 7.0)) / 100.0
				hp = maxi(1, floori(base_hp * variant_ratio))
			
			_spawn_enemy_at(center_x, y_pos, hp, c == weak_spot_col)
			current_count += 1
	
	# =========================================
	# 4. 实例化导演生成的精英
	# =========================================
	for cfg in pending_spawns:
		var center_x = cfg.col * w + w / 2.0
		_spawn_enemy_at(center_x, y_pos, cfg.hp, false, cfg.affixes)


func _calculate_base_hp() -> float:
	"""计算基础血量"""
	var enemy_base_hp = 10.0
	var enemy_hp_per_round = 5.0
	var hp_exponent = 1.12
	
	var exponential_factor = pow(hp_exponent, maxf(0.0, current_round - 5))
	var linear_hp = (enemy_base_hp + (current_round * enemy_hp_per_round)) * exponential_factor * difficulty_growth_factor
	
	return floorf(linear_hp * next_round_hp_multiplier)


func _select_squad_type() -> String:
	"""选择小队类型"""
	var candidates: Array[String] = []
	
	if current_round >= 6:
		candidates.append("phalanx")
	if current_round >= 10:
		candidates.append("blitz")
	if current_round >= 12:
		candidates.append("berserk_pack")
	if current_round >= 8:
		candidates.append("jumper_pack")
	
	if candidates.size() > 0:
		return candidates[randi() % candidates.size()]
	return ""


func _apply_squad_preset(squad_type: String, occupied_cols: Array[bool], pending_spawns: Array, base_hp: float) -> void:
	"""应用小队预设"""
	match squad_type:
		"phalanx":
			var c = randi() % (enemy_cols - 1)
			_add_preset(c, 1.4, ["shield"], occupied_cols, pending_spawns, base_hp)
			_add_preset(c + 1, 0.8, ["healer"], occupied_cols, pending_spawns, base_hp)
		"blitz":
			var c1 = randi() % enemy_cols
			var c2 = (c1 + 2) % enemy_cols
			_add_preset(c1, 0.6, ["haste"], occupied_cols, pending_spawns, base_hp)
			_add_preset(c2, 0.6, ["jump"], occupied_cols, pending_spawns, base_hp)
		"berserk_pack":
			var c = randi() % enemy_cols
			_add_preset(c, 1.2, ["berserk"], occupied_cols, pending_spawns, base_hp)
		"jumper_pack":
			var c = randi() % enemy_cols
			_add_preset(c, 0.8, ["jump"], occupied_cols, pending_spawns, base_hp)


func _add_preset(col: int, hp_mult: float, force_affixes: Array, occupied_cols: Array[bool], pending_spawns: Array, base_hp: float) -> void:
	"""添加预设敌人"""
	if col >= 0 and col < enemy_cols and not occupied_cols[col]:
		pending_spawns.append({
			"col": col,
			"hp": floori(base_hp * hp_mult),
			"affixes": force_affixes
		})
		occupied_cols[col] = true


func _spawn_enemy_at(x: float, y: float, hp: int, is_weak: bool, affixes: Array = []) -> void:
	"""在指定位置生成敌人"""
	if enemy_scene:
		var enemy = enemy_scene.instantiate()
		enemy.position = Vector2(x, y)
		enemy.setup(enemy_width, enemy_height, hp)
		
		if not is_weak and affixes.is_empty():
			enemy.affixes = generate_affixes()
		else:
			enemy.affixes = affixes
		
		# 初始化护盾层数
		if "shield" in enemy.affixes:
			enemy.shield_charges = 1 + current_round
		
		if enemy.affixes.size() > 0:
			enemy.enemy_type = "elite"
		
		enemies.append(enemy)
		enemy_spawned.emit(enemy)


func spawn_enemy_row(count: int = 1) -> void:
	"""生成指定数量的敌人行"""
	for i in range(count):
		spawn_enemy_row_at(80.0 - (i * enemy_height))


# ==================== 弹丸生成 ====================

func spawn_bullet(x: float, y: float, vel: Vector2, recipe: Dictionary, shot_id: String = "", is_last: bool = false) -> void:
	"""生成弹丸（处理散射、飞剑、激光）"""
	if shot_id.is_empty():
		shot_id = str(Time.get_ticks_msec()) + str(randf())
	
	# 飞剑处理
	if recipe.get("type") == "flying_sword":
		_spawn_flying_sword(x, y, vel, recipe, shot_id, is_last)
		return
	
	# 激光处理
	if recipe.get("is_laser", false) and not recipe.get("wind", false):
		_spawn_laser(x, y, vel, recipe, shot_id)
		return
	
	# 散射处理
	if recipe.get("scatter", 0) > 0 and not recipe.get("wind", false):
		_spawn_scatter_bullets(x, y, vel, recipe, shot_id)
	
	# 生成主弹丸
	_spawn_main_bullet(x, y, vel, recipe, shot_id, is_last)


func _spawn_flying_sword(x: float, y: float, vel: Vector2, recipe: Dictionary, shot_id: String, is_last: bool) -> void:
	"""生成飞剑"""
	# 生成母剑
	if projectile_scene:
		var mother_sword = projectile_scene.instantiate()
		mother_sword.setup(x, y, vel, recipe, false, shot_id, is_last)
		projectiles.append(mother_sword)
		projectile_spawned.emit(mother_sword)
		
		# 生成子剑
		var initial_son_count = recipe.get("scatter", 0)
		var peg_level = recipe.get("level", 1)
		
		for i in range(initial_son_count):
			son_sword_queue.append({
				"mother": mother_sword,
				"level": peg_level,
				"config": recipe,
				"x": x + (randf() - 0.5) * 20.0,
				"y": y + (randf() - 0.5) * 20.0
			})


func _spawn_laser(x: float, y: float, vel: Vector2, recipe: Dictionary, shot_id: String) -> void:
	"""生成激光"""
	# 激光逻辑由战斗系统处理
	pass


func _spawn_scatter_bullets(x: float, y: float, vel: Vector2, recipe: Dictionary, shot_id: String) -> void:
	"""生成散射弹丸"""
	var scatter_count = recipe.get("scatter", 0)
	var full_inherit_count = floori(scatter_count / 2.0)
	var half_inherit_count = scatter_count % 2
	
	var scalable_attrs = ["damage", "cryo", "pyro", "lightning", "laser", "wind", "pierce", "bounce"]
	var current_scatter_idx = 1
	
	# 100% 继承的副子弹
	for i in range(full_inherit_count):
		var sign_val = -1 if current_scatter_idx % 2 == 0 else 1
		var multiplier = ceili(current_scatter_idx / 2.0)
		var angle_offset = 0.2 * multiplier * sign_val
		var new_vel = vel.rotated(angle_offset)
		
		var copy_recipe = _create_scatter_recipe(recipe, 1.0, scalable_attrs)
		_spawn_main_bullet(x, y, new_vel, copy_recipe, shot_id, false)
		current_scatter_idx += 1
	
	# 50% 继承的副子弹
	for i in range(half_inherit_count):
		var sign_val = -1 if current_scatter_idx % 2 == 0 else 1
		var multiplier = ceili(current_scatter_idx / 2.0)
		var angle_offset = 0.2 * multiplier * sign_val
		var new_vel = vel.rotated(angle_offset)
		
		var copy_recipe = _create_scatter_recipe(recipe, 0.5, scalable_attrs)
		_spawn_main_bullet(x, y, new_vel, copy_recipe, shot_id, false)
		current_scatter_idx += 1


func _create_scatter_recipe(base: Dictionary, factor: float, scalable_attrs: Array) -> Dictionary:
	"""创建散射副本配方"""
	var r = base.duplicate()
	r["scatter"] = 0
	r["chain_payload"] = null
	r["is_scatter_child"] = true
	
	for attr in scalable_attrs:
		if r.has(attr) and r[attr] is float or r[attr] is int:
			if attr == "damage":
				r[attr] = maxi(1, floori(r[attr] * factor))
			else:
				r[attr] = floori(r[attr] * factor)
	
	return r


func _spawn_main_bullet(x: float, y: float, vel: Vector2, recipe: Dictionary, shot_id: String, is_last: bool) -> void:
	"""生成主弹丸"""
	if projectile_scene:
		var projectile = projectile_scene.instantiate()
		projectile.setup(x, y, vel, recipe, false, shot_id, is_last)
		projectiles.append(projectile)
		projectile_spawned.emit(projectile)


# ==================== 特效生成 ====================

func create_particle(x: float, y: float, color: Color, mode: String = "normal") -> Node2D:
	"""创建粒子特效"""
	# 限制粒子总数
	if particles.size() > MAX_PARTICLES:
		return null
	
	# 针对火焰粒子的额外限制
	if mode == "ember":
		var current_embers = 0
		for p in particles:
			if p.get("mode") == "ember":
				current_embers += 1
		if current_embers > EMBER_LIMIT:
			return null
	
	if particle_scene:
		var p = particle_scene.instantiate()
		p.setup(x, y, color, mode)
		particles.append(p)
		particle_spawned.emit(p)
		return p
	
	return null


func create_floating_text(x: float, y: float, text: String, color: Color = Color.GOLD) -> void:
	"""创建浮动文字"""
	if floating_text_scene:
		var ft = floating_text_scene.instantiate()
		ft.setup(x, y, text, color)
		floating_texts.append(ft)


func create_explosion(x: float, y: float, color: Color = Color(0.97, 0.44, 0.44, 1.0)) -> void:
	"""创建爆炸特效"""
	for i in range(10):
		create_particle(x, y, color, "normal")


func create_shockwave(x: float, y: float, color: Color = Color.WHITE) -> void:
	"""创建冲击波特效"""
	if shockwave_scene:
		var sw = shockwave_scene.instantiate()
		sw.setup(x, y, color)
		shockwaves.append(sw)


func create_hit_feedback(x: float, y: float, velocity: Vector2, feedback_type: String = "normal") -> void:
	"""创建命中反馈"""
	var target_x = canvas_width / 2.0
	var target_y = canvas_height - 100.0
	
	var color = Color(0.98, 0.75, 0.14, 1.0)  # 默认金色
	
	match feedback_type:
		"cryo":
			color = Color(0.53, 0.81, 0.92, 1.0)
		"pyro":
			color = Color(0.97, 0.45, 0.09, 1.0)
		"lightning":
			color = Color(0.75, 0.5, 1.0, 1.0)
		"bounce":
			color = Color(0.13, 0.82, 0.38, 1.0)
		"resonance":
			color = Color(0.96, 0.25, 0.37, 1.0)
		"damage":
			color = Color(0.94, 0.27, 0.27, 1.0)
	
	var init_vel = velocity if velocity != Vector2.ZERO else Vector2((randf() - 0.5) * 5.0, -5.0)
	
	if energy_orb_scene:
		var orb = energy_orb_scene.instantiate()
		orb.setup(x, y, target_x, target_y, color, init_vel, Callable())
		energy_orbs.append(orb)


func small_whirlwind(x: float, y: float) -> void:
	"""生成小旋风特效"""
	var particle_count = 12
	for i in range(particle_count):
		var p = create_particle(x, y, Color(0.2, 0.83, 0.6, 1.0), "spark")
		if not p:
			continue
		
		var angle = float(i) / particle_count * TAU
		var speed = 4.0
		
		var velocity = Vector2(cos(angle), sin(angle))
		var tangent = velocity.rotated(PI / 2.0) * speed
		tangent.x += velocity.x * 1.5
		tangent.y += velocity.y * 1.5
		
		p.set_velocity(tangent)
		p.life = 0.6
	
	create_shockwave(x, y, Color(0.2, 0.83, 0.6, 1.0))


# ==================== 分数和技能点 ====================

func add_score(amount: int) -> void:
	"""添加分数"""
	var final_score = floori(amount * score_multiplier)
	score += final_score
	
	var resource_gain = floori(sqrt(final_score) / 2.0 + 2.0)
	if resource_gain > 0:
		run_currency += resource_gain
	
	score_multiplier = snappedf(score_multiplier + 0.2, 0.1)
	score_added.emit(final_score, score)


func add_skill_point(amount: int = 1) -> void:
	"""添加技能点"""
	skill_points += amount
	skill_point_added.emit(amount, skill_points)


func trigger_level_up_event(ui_x: float, ui_y: float) -> void:
	"""触发升级事件"""
	create_shockwave(ui_x, ui_y, Color(0.98, 0.8, 0.08, 1.0))
	
	for i in range(20):
		var px = ui_x + (randf() - 0.5) * 80.0
		var py = ui_y + (randf() - 0.5) * 30.0
		create_particle(px, py, Color(0.99, 0.83, 0.3, 1.0), "spark")
	
	create_floating_text(ui_x, ui_y - 50.0, "LEVEL UP!", Color.WHITE)
	level_up_triggered.emit()


# ==================== 风暴核心 ====================

func spawn_storm_core(x: float, y: float, radius: float, bullet_damage: float, bullet_config: Dictionary = {}) -> void:
	"""生成风暴核心区域"""
	var energy_required = maxi(1, floori(radius / 10.0))
	
	var storm_core = {
		"pos": Vector2(x, y),
		"radius": minf(150.0, radius),
		"bullet_damage": bullet_damage,
		"bullet_config": bullet_config,
		"energy": 0,
		"energy_required": energy_required,
		"charge_timer": 0.0,
		"active": true,
		"alpha": 0.8,
		"pulse_phase": randf() * TAU
	}
	
	storm_cores.append(storm_core)
	
	create_floating_text(x, y, "🌀风暴核心", Color(0.2, 0.83, 0.6, 1.0))
	create_shockwave(x, y, Color(0.2, 0.83, 0.6, 1.0))


# ==================== 分身生成 ====================

func trigger_clone_spawn(source_enemy: Node2D) -> void:
	"""触发分身生成"""
	var w = enemy_width
	var clone_hp = maxi(1, floori(source_enemy.max_hp * 0.2))
	
	# 寻找落点
	var valid_cols: Array = []
	for r in range(3):
		for c in range(enemy_cols):
			var tx = c * w + w / 2.0
			var ty = 80.0 + r * enemy_height
			# 简化碰撞检测
			var is_occupied = false
			for e in enemies:
				if e.position.distance_to(Vector2(tx, ty)) < w * 0.9:
					is_occupied = true
					break
			if not is_occupied:
				valid_cols.append({"x": tx, "y": ty})
	
	if valid_cols.size() > 0:
		var pos = valid_cols[randi() % valid_cols.size()]
		# 发射孢子（简化版直接生成）
		_spawn_enemy_at(pos.x, pos.y, clone_hp, false, [])
		create_floating_text(pos.x, pos.y, "SPAWN", Color(0.66, 0.33, 0.97, 1.0))


# ==================== 风属性粒子 ====================

func spawn_wind_skill_particles(particle_type: String, rect: Rect2, progress: float) -> void:
	"""生成风属性技能粒子"""
	if randf() > 0.3 + progress * 0.6:
		return
	
	var is_horizontal = rect.size.x > rect.size.y
	var px = rect.position.x + randf() * rect.size.x
	var py = rect.position.y + randf() * rect.size.y
	
	var final_px = px
	var final_py = py
	
	if particle_type == "tunnel":
		if is_horizontal:
			final_px = randf() * canvas_width
		else:
			final_py = randf() * canvas_height
	
	var p = create_particle(final_px, final_py, Color(0.94, 0.99, 0.96, 1.0), "line")
	if not p:
		return
	
	if particle_type == "tunnel":
		var speed = 25.0 + randf() * 15.0
		if is_horizontal:
			p.set_velocity(Vector2(speed, 0))
		else:
			p.set_velocity(Vector2(0, speed))
	elif particle_type == "cyclone":
		var cx = rect.position.x + rect.size.x / 2.0
		var cy = rect.position.y + rect.size.y / 2.0
		var angle = randf() * TAU
		var dist = randf() * (minf(rect.size.x, rect.size.y) * 0.3)
		
		p.position = Vector2(cx + cos(angle) * dist, cy + sin(angle) * dist)
		
		var tan_x = -sin(angle)
		var tan_y = cos(angle)
		var speed = 15.0 + randf() * 10.0
		p.set_velocity(Vector2(tan_x * speed, tan_y * speed))
	
	p.life = 0.4


# ==================== 设置方法 ====================

func setup(game: Node, width: float, height: float) -> void:
	"""设置生成系统"""
	game_ref = game
	canvas_width = width
	canvas_height = height


func set_round(round_num: int) -> void:
	"""设置当前回合"""
	current_round = round_num


func set_difficulty_factor(factor: float) -> void:
	"""设置难度因子"""
	difficulty_growth_factor = factor


func set_hp_multiplier(multiplier: float) -> void:
	"""设置血量倍率"""
	next_round_hp_multiplier = multiplier
