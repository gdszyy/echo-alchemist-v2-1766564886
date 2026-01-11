## =============================================================================
## CombatSystem - 战斗系统管理器
## =============================================================================
## 将 JavaScript 战斗系统核心逻辑迁移到 Godot 4.x
## 实现发射、伤害、碰撞检测、闪电链等核心机制
## =============================================================================
class_name CombatSystem
extends Node

# =============================================================================
# 信号定义 (Signal Definitions)
# =============================================================================

## 发射子弹时触发
signal projectile_fired(projectile: Projectile)

## 敌人受到伤害时触发
signal enemy_damaged(enemy: Enemy, damage: float, damage_type: String, source: String)

## 敌人死亡时触发
signal enemy_killed(enemy: Enemy)

## 伤害统计更新时触发
signal damage_recorded(amount: float, damage_type: String, source_type: String)

## 闪电链触发时触发
signal lightning_chain_triggered(from_enemy: Enemy, to_enemy: Enemy, damage: float)

## 震屏效果触发时触发
signal screen_shake_requested(intensity: float)

## 战斗回合结束时触发
signal combat_round_ended()

## 所有敌人被消灭时触发
signal all_enemies_defeated()

# =============================================================================
# 导出变量 (Exported Variables)
# =============================================================================

## 子弹场景 (需要在编辑器中指定)
@export var projectile_scene: PackedScene

## 闪电特效场景
@export var lightning_bolt_scene: PackedScene

## 浮动文字场景
@export var floating_text_scene: PackedScene

## 冲击波特效场景
@export var shockwave_scene: PackedScene

## 是否显示伤害数字
@export var show_damage_numbers: bool = true

## 震屏阈值 (伤害超过此值触发震屏)
@export var screen_shake_threshold: float = 50.0

## 震屏最大强度
@export var screen_shake_max_intensity: float = 10.0

# =============================================================================
# 物理层配置 (Physics Layer Configuration)
# =============================================================================

## 子弹物理层
const LAYER_PROJECTILE: int = 2

## 敌人物理层
const LAYER_ENEMY: int = 4

## 墙壁物理层
const LAYER_WALL: int = 8

# =============================================================================
# 内部变量 (Internal Variables)
# =============================================================================

## 弹药队列
var ammo_queue: Array[AmmoData] = []

## 活跃子弹列表
var projectiles: Array[Projectile] = []

## 敌人列表引用
var enemies: Array[Enemy] = []

## 闪电特效列表
var lightning_bolts: Array[Node2D] = []

## 回合伤害统计
var round_damage: float = 0.0

## 当前射击伤害统计
var current_shot_damage: float = 0.0

## 按属性分类的伤害统计
var current_shot_damage_by_attr: Dictionary = {}

## 射击ID计数器
var shot_id_counter: int = 0

## 射击伤害映射表
var shot_damage_map: Dictionary = {}

## 瞄准角度 (弧度)
var aim_angle: float = -PI / 2

## 发射起点
var fire_start_position: Vector2 = Vector2.ZERO

## 连射队列
var burst_queue: Array[Dictionary] = []

## 连射计时器
var burst_timer: float = 0.0

## 音频管理器引用
var audio_manager: Node = null

# =============================================================================
# 配置常量 (Configuration Constants)
# =============================================================================

## 闪电链配置
const LIGHTNING_CONFIG := {
	"chain_range": 150.0,
	"base_chain_chance": 0.6,
	"max_chain_chance": 0.95,
	"temp_chain_mult": 0.02,
	"chain_delay_base": 250,
	"chain_delay_min": 80,
	"chain_delay_decay": 15,
	"damage_decay_base": 0.85,
	"damage_decay_per_level": 0.02,
	"max_chain_count": 100
}

## 元素伤害配置
const ELEMENT_CONFIG := {
	"cryo_amount": 5.0,
	"pyro_amount": 5.0,
	"lightning_temp_increase": 3.0
}

## 火焰爆炸配置
const PYRO_CONFIG := {
	"explode_threshold": 60.0,
	"temp_for_max_chance": 100.0,
	"base_explode_chance": 0.1,
	"max_explode_chance": 0.5,
	"heat_consumption_rate": 0.6,
	"damage_mult": 2.0,
	"radius": 100.0,
	"aoe_damage_mult": 0.5
}

## 伤害颜色映射
const DAMAGE_COLOR_MAP := {
	"pyro": Color("#f97316"),
	"cryo": Color("#06b6d4"),
	"lightning": Color("#c084fc"),
	"bounce": Color("#fbbf24"),
	"pierce": Color("#fca5a5"),
	"damage": Color.WHITE,
	"wind": Color("#34d399"),
	"flying_sword": Color("#0ea5e9"),
	"scatter": Color("#facc15"),
	"explosive": Color("#ef4444")
}

# =============================================================================
# 生命周期方法 (Lifecycle Methods)
# =============================================================================

func _ready() -> void:
	# 初始化发射起点位置
	var viewport_size := get_viewport().get_visible_rect().size
	fire_start_position = Vector2(viewport_size.x / 2, viewport_size.y - 50)


func _physics_process(delta: float) -> void:
	_process_burst_queue(delta)
	_update_projectiles(delta)
	_check_collisions()
	_cleanup_inactive()
	_check_victory_condition()


# =============================================================================
# 公共API (Public API)
# =============================================================================

## 发射下一发子弹
## @param velocity: 初始速度向量 (可选，默认使用瞄准角度计算)
func fire_next_shot(velocity: Vector2 = Vector2.ZERO) -> void:
	if ammo_queue.is_empty():
		return
	
	# 从队列中取出弹药
	var ammo: AmmoData = _pull_next_ammo()
	if ammo == null:
		return
	
	# 计算发射速度
	var fire_velocity: Vector2
	if velocity == Vector2.ZERO:
		var speed: float = 10.0
		fire_velocity = Vector2(cos(aim_angle), sin(aim_angle)) * speed
	else:
		fire_velocity = velocity
	
	# 创建射击ID
	var shot_id: int = shot_id_counter
	shot_id_counter += 1
	shot_damage_map[shot_id] = {
		"total": 0.0,
		"by_attr": {},
		"projectile_count": 0,
		"destroyed_count": 0
	}
	
	# 判断是否只有单发
	var is_only_one: bool = not (ammo.multicast > 0 and ammo.type != "flying_sword" and ammo.wind <= 0)
	
	# 添加到连射队列
	burst_queue.append({
		"delay": 0.0,
		"velocity": fire_velocity,
		"ammo": ammo,
		"shot_id": shot_id,
		"is_last": is_only_one
	})
	
	# 处理多重射击
	if ammo.multicast > 0 and ammo.type != "flying_sword" and ammo.wind <= 0:
		for i in range(1, ammo.multicast + 1):
			var is_last_in_burst: bool = (i == ammo.multicast)
			burst_queue.append({
				"delay": i * 0.02,  # 20ms 间隔
				"velocity": fire_velocity,
				"ammo": ammo,
				"shot_id": shot_id,
				"is_last": is_last_in_burst
			})
	
	# 播放发射音效
	_play_shoot_sound()


## 对敌人造成伤害
## @param enemy: 目标敌人
## @param projectile: 子弹数据
## @param damage_override: 伤害覆盖值 (可选)
func damage_enemy(enemy: Enemy, projectile: ProjectileData, damage_override: float = -1.0) -> void:
	if enemy == null or not enemy.is_active:
		return
	
	var config: AmmoData = projectile.config
	var dmg: float
	if damage_override >= 0:
		dmg = damage_override
	elif projectile.is_copy:
		dmg = config.damage * 0.5
	else:
		dmg = config.damage
	
	# 确定伤害来源类型
	var source_type: String = "main"
	if config.is_scatter_child:
		source_type = "scatter"
	elif config.type == "flying_sword":
		source_type = "flying_sword"
	elif config.wind > 0:
		source_type = "wind"
	
	# 生成视觉特效
	_spawn_hit_effects(projectile.position, config)
	
	# 确定伤害类型
	var hit_type: String = _determine_hit_type(config)
	
	# 应用元素效果
	_apply_element_effects(enemy, config, projectile, dmg)
	
	# 造成伤害
	var damage_result: Dictionary = enemy.take_damage(dmg, projectile)
	var killed: bool = damage_result.get("killed", false)
	var actual_dmg: float = damage_result.get("actual_damage", dmg)
	
	# 确定伤害统计类型
	var damage_type: String = _determine_damage_type(config, projectile)
	var damage_color: Color = DAMAGE_COLOR_MAP.get(damage_type, Color.WHITE)
	
	# 记录伤害
	_record_damage(actual_dmg, damage_type, source_type, projectile.shot_id)
	
	# 处理火焰燃烧和爆炸
	if config.pyro > 0 and enemy.temp >= 34:
		_process_pyro_effects(enemy, config, source_type, projectile.shot_id)
	
	# 显示伤害数字
	if show_damage_numbers and actual_dmg > 0:
		_spawn_floating_text(projectile.position, "-" + str(ceili(actual_dmg)), damage_color)
	
	# 播放受击音效
	_play_hit_sound(hit_type)
	
	# 触发震屏效果
	if actual_dmg > screen_shake_threshold:
		var intensity: float = minf(screen_shake_max_intensity, actual_dmg / 10.0)
		screen_shake_requested.emit(intensity)
	
	# 发送信号
	enemy_damaged.emit(enemy, actual_dmg, damage_type, source_type)
	
	if killed:
		enemy_killed.emit(enemy)


## 触发闪电链效果
## @param source_enemy: 起始敌人
## @param damage: 初始伤害
## @param history: 已击中敌人历史
## @param level: 闪电等级
## @param shot_id: 射击ID
## @returns: 是否成功触发闪电链
func trigger_lightning_chain(source_enemy: Enemy, damage: float, history: Array[Enemy] = [], level: int = 1, shot_id: int = -1) -> bool:
	if source_enemy == null or not source_enemy.is_active:
		return false
	
	# 查找范围内的有效目标
	var targets: Array[Enemy] = []
	for enemy in enemies:
		if enemy.is_active and enemy != source_enemy:
			var dist: float = source_enemy.global_position.distance_to(enemy.global_position)
			if dist < LIGHTNING_CONFIG.chain_range:
				targets.append(enemy)
	
	if targets.is_empty():
		return false
	
	# 计算权重并选择目标
	var last_source: Enemy = history[-1] if not history.is_empty() else null
	var total_weight: float = 0.0
	var weighted_targets: Array[Dictionary] = []
	
	for target in targets:
		var dist: float = source_enemy.global_position.distance_to(target.global_position)
		var weight: float = 1.0 / (pow(dist, 2) + 1)
		
		# 降低跳回来源的概率
		if last_source != null and target == last_source:
			weight *= 0.5
		
		total_weight += weight
		weighted_targets.append({
			"target": target,
			"weight": weight,
			"dist": dist
		})
	
	# 随机选择目标
	var random_value: float = randf() * total_weight
	var selected: Enemy = null
	for wt in weighted_targets:
		random_value -= wt.weight
		if random_value <= 0:
			selected = wt.target
			break
	
	if selected == null:
		selected = targets[0]
	
	# 判定连锁概率
	var chain_chance: float = LIGHTNING_CONFIG.base_chain_chance
	if selected.temp < 0:
		chain_chance = minf(
			LIGHTNING_CONFIG.max_chain_chance,
			LIGHTNING_CONFIG.base_chain_chance + absf(selected.temp) * LIGHTNING_CONFIG.temp_chain_mult
		)
	
	if randf() < chain_chance:
		# 计算延迟
		var chain_count: int = history.size()
		var delay: float = maxf(
			LIGHTNING_CONFIG.chain_delay_min,
			LIGHTNING_CONFIG.chain_delay_base - chain_count * LIGHTNING_CONFIG.chain_delay_decay
		) / 1000.0  # 转换为秒
		
		# 延迟执行闪电链
		var timer := get_tree().create_timer(delay)
		timer.timeout.connect(func():
			if not is_instance_valid(selected) or not selected.is_active:
				return
			
			# 生成闪电特效
			_spawn_lightning_bolt(source_enemy.global_position, selected.global_position)
			lightning_chain_triggered.emit(source_enemy, selected, damage)
			
			# 播放闪电音效
			_play_lightning_sound()
			
			# 生成粒子特效
			for i in range(5):
				_spawn_particle(selected.global_position, Color("#c084fc"), "spark")
			
			# 计算下一次伤害
			var decay_factor: float = LIGHTNING_CONFIG.damage_decay_base + (LIGHTNING_CONFIG.damage_decay_per_level * level)
			var next_dmg: float = maxf(1.0, floorf(damage * decay_factor))
			
			# 应用温度变化
			selected.apply_temp(level + chain_count / 3.0)
			
			# 造成伤害
			var result: Dictionary = selected.take_damage(damage)
			_record_damage(result.get("actual_damage", damage), "lightning", "main", shot_id)
			
			if result.get("killed", false):
				enemy_killed.emit(selected)
			
			# 递归触发下一次闪电链
			var new_history: Array[Enemy] = history.duplicate()
			new_history.append(selected)
			
			if new_history.size() < LIGHTNING_CONFIG.max_chain_count:
				trigger_lightning_chain(selected, next_dmg, new_history, level, shot_id)
		)
		
		return true
	
	return false


## 检测碰撞
func check_collisions() -> void:
	_check_collisions()


## 记录伤害统计
## @param amount: 伤害量
## @param attr_type: 属性类型
## @param source_type: 来源类型
## @param shot_id: 射击ID
func record_damage(amount: float, attr_type: String = "damage", source_type: String = "main", shot_id: int = -1) -> void:
	_record_damage(amount, attr_type, source_type, shot_id)


## 添加弹药到队列
## @param ammo: 弹药数据
func add_ammo(ammo: AmmoData) -> void:
	ammo_queue.append(ammo)


## 清空弹药队列
func clear_ammo_queue() -> void:
	ammo_queue.clear()


## 设置敌人列表引用
## @param enemy_list: 敌人数组
func set_enemies(enemy_list: Array[Enemy]) -> void:
	enemies = enemy_list


## 重置回合统计
func reset_round_stats() -> void:
	round_damage = 0.0
	current_shot_damage = 0.0
	current_shot_damage_by_attr.clear()


## 获取回合总伤害
func get_round_damage() -> float:
	return round_damage


## 设置瞄准角度
## @param angle: 角度 (弧度)
func set_aim_angle(angle: float) -> void:
	aim_angle = angle


## 设置发射起点位置
## @param position: 位置
func set_fire_start_position(position: Vector2) -> void:
	fire_start_position = position


# =============================================================================
# 内部方法 (Internal Methods)
# =============================================================================

## 从队列中取出下一个弹药 (处理套娃配方)
func _pull_next_ammo() -> AmmoData:
	if ammo_queue.is_empty():
		return null
	
	var ammo: AmmoData = ammo_queue.pop_front()
	
	# 处理套娃配方
	if ammo.is_matryoshka and not ammo_queue.is_empty():
		var nested: AmmoData = _pull_next_ammo()
		if nested != null:
			ammo.nested_payload = nested
	
	return ammo


## 处理连射队列
func _process_burst_queue(delta: float) -> void:
	if burst_queue.is_empty():
		return
	
	burst_timer += delta
	
	var to_remove: Array[int] = []
	
	for i in range(burst_queue.size()):
		var burst_data: Dictionary = burst_queue[i]
		if burst_timer >= burst_data.delay:
			_spawn_projectile(burst_data)
			to_remove.append(i)
	
	# 从后往前移除已处理的项
	for i in range(to_remove.size() - 1, -1, -1):
		burst_queue.remove_at(to_remove[i])
	
	if burst_queue.is_empty():
		burst_timer = 0.0


## 生成子弹
func _spawn_projectile(burst_data: Dictionary) -> void:
	if projectile_scene == null:
		push_warning("CombatSystem: projectile_scene is not set!")
		return
	
	var projectile: Projectile = projectile_scene.instantiate()
	projectile.global_position = fire_start_position
	projectile.velocity = burst_data.velocity
	projectile.ammo_data = burst_data.ammo
	projectile.shot_id = burst_data.shot_id
	projectile.is_last_in_burst = burst_data.is_last
	
	# 设置物理层
	projectile.collision_layer = LAYER_PROJECTILE
	projectile.collision_mask = LAYER_ENEMY | LAYER_WALL
	
	# 连接信号
	projectile.hit_enemy.connect(_on_projectile_hit_enemy)
	projectile.destroyed.connect(_on_projectile_destroyed)
	
	get_tree().current_scene.add_child(projectile)
	projectiles.append(projectile)
	
	# 更新射击统计
	if shot_damage_map.has(burst_data.shot_id):
		shot_damage_map[burst_data.shot_id].projectile_count += 1
	
	projectile_fired.emit(projectile)


## 更新所有子弹
func _update_projectiles(delta: float) -> void:
	for projectile in projectiles:
		if is_instance_valid(projectile) and projectile.is_active:
			projectile.update_movement(delta)


## 检测碰撞
func _check_collisions() -> void:
	for projectile in projectiles:
		if not is_instance_valid(projectile) or not projectile.is_active:
			continue
		
		for enemy in enemies:
			if not is_instance_valid(enemy) or not enemy.is_active:
				continue
			
			var dist: float = projectile.global_position.distance_to(enemy.global_position)
			if dist < projectile.radius + enemy.radius:
				_on_projectile_hit_enemy(projectile, enemy)


## 清理无效对象
func _cleanup_inactive() -> void:
	# 清理无效子弹
	projectiles = projectiles.filter(func(p): return is_instance_valid(p) and p.is_active)
	
	# 清理无效闪电特效
	lightning_bolts = lightning_bolts.filter(func(l): return is_instance_valid(l))


## 检查胜利条件
func _check_victory_condition() -> void:
	var active_enemies: int = 0
	for enemy in enemies:
		if is_instance_valid(enemy) and enemy.is_active:
			active_enemies += 1
	
	if active_enemies == 0 and not enemies.is_empty():
		all_enemies_defeated.emit()


## 子弹击中敌人回调
func _on_projectile_hit_enemy(projectile: Projectile, enemy: Enemy) -> void:
	var projectile_data := ProjectileData.new()
	projectile_data.config = projectile.ammo_data
	projectile_data.position = projectile.global_position
	projectile_data.is_copy = projectile.is_copy
	projectile_data.shot_id = projectile.shot_id
	projectile_data.chain_history = projectile.chain_history
	projectile_data.bounces_left = projectile.bounces_left
	projectile_data.pierces_left = projectile.pierces_left
	
	damage_enemy(enemy, projectile_data)
	
	# 处理闪电链
	if projectile.ammo_data.lightning > 0:
		trigger_lightning_chain(enemy, projectile.ammo_data.damage, projectile.chain_history, projectile.ammo_data.lightning, projectile.shot_id)
		projectile.chain_history.append(enemy)
	
	# 处理穿透和弹射
	projectile.on_hit_enemy(enemy)


## 子弹销毁回调
func _on_projectile_destroyed(projectile: Projectile) -> void:
	if shot_damage_map.has(projectile.shot_id):
		shot_damage_map[projectile.shot_id].destroyed_count += 1


## 记录伤害
func _record_damage(amount: float, attr_type: String, source_type: String, shot_id: int) -> void:
	if amount <= 0:
		return
	
	round_damage += amount
	current_shot_damage += amount
	
	# 更新按属性分类的统计
	if not current_shot_damage_by_attr.has(attr_type):
		current_shot_damage_by_attr[attr_type] = {}
	if not current_shot_damage_by_attr[attr_type].has(source_type):
		current_shot_damage_by_attr[attr_type][source_type] = 0.0
	current_shot_damage_by_attr[attr_type][source_type] += amount
	
	# 更新射击历史统计
	if shot_id >= 0 and shot_damage_map.has(shot_id):
		var shot_stats: Dictionary = shot_damage_map[shot_id]
		shot_stats.total += amount
		
		if not shot_stats.by_attr.has(attr_type):
			shot_stats.by_attr[attr_type] = {}
		if not shot_stats.by_attr[attr_type].has(source_type):
			shot_stats.by_attr[attr_type][source_type] = 0.0
		shot_stats.by_attr[attr_type][source_type] += amount
	
	damage_recorded.emit(amount, attr_type, source_type)


## 确定伤害类型
func _determine_hit_type(config: AmmoData) -> String:
	if config.cryo > 0:
		return "cryo"
	elif config.pyro > 0:
		return "pyro"
	elif config.lightning > 0:
		return "lightning"
	elif config.pierce > 0:
		return "pierce"
	elif config.wind > 0:
		return "wind"
	return "normal"


## 确定伤害统计类型
func _determine_damage_type(config: AmmoData, projectile: ProjectileData) -> String:
	var is_bounce_hit: bool = config.bounce > 0 and projectile.bounces_left < config.bounce
	var is_pierce_hit: bool = config.pierce > 0 and projectile.pierces_left < config.pierce
	
	if is_bounce_hit:
		return "bounce"
	elif is_pierce_hit:
		return "pierce"
	elif config.pyro > 0:
		return "pyro"
	elif config.cryo > 0:
		return "cryo"
	elif config.lightning > 0:
		return "lightning"
	elif config.wind > 0:
		return "wind"
	elif config.type == "flying_sword":
		return "flying_sword"
	
	return "damage"


## 应用元素效果
func _apply_element_effects(enemy: Enemy, config: AmmoData, projectile: ProjectileData, damage: float) -> void:
	if config.cryo > 0:
		enemy.apply_temp(-ELEMENT_CONFIG.cryo_amount * config.cryo)
	
	if config.pyro > 0:
		enemy.apply_temp(ELEMENT_CONFIG.pyro_amount * config.pyro)
	
	if config.lightning > 0:
		var is_chain_triggered: bool = trigger_lightning_chain(
			enemy, damage, projectile.chain_history, config.lightning, projectile.shot_id
		)
		if is_chain_triggered:
			var chain_count: int = projectile.chain_history.size()
			enemy.apply_temp(config.lightning + chain_count / 3.0)
		projectile.chain_history.append(enemy)


## 处理火焰效果
func _process_pyro_effects(enemy: Enemy, config: AmmoData, source_type: String, shot_id: int) -> void:
	# 计算基础额外火伤
	var base_fire_dmg: float = (config.pyro * enemy.temp) / 200.0
	
	# 造成燃烧伤害
	if base_fire_dmg >= 1:
		var fire_result: Dictionary = enemy.take_damage(base_fire_dmg)
		_record_damage(fire_result.get("actual_damage", base_fire_dmg), "pyro", source_type, shot_id)
		_spawn_floating_text(enemy.global_position + Vector2(0, -25), "Burn " + str(ceili(fire_result.get("actual_damage", base_fire_dmg))), Color("#fb923c"))
	
	# 过热爆炸机制
	var explode_chance: float = 0.0
	if enemy.temp > PYRO_CONFIG.explode_threshold:
		var range_val: float = PYRO_CONFIG.temp_for_max_chance - PYRO_CONFIG.explode_threshold
		var chance_range: float = PYRO_CONFIG.max_explode_chance - PYRO_CONFIG.base_explode_chance
		explode_chance = PYRO_CONFIG.base_explode_chance + (enemy.temp - PYRO_CONFIG.explode_threshold) * (chance_range / range_val)
		explode_chance = minf(PYRO_CONFIG.max_explode_chance, explode_chance)
	
	if explode_chance > 0 and randf() < explode_chance:
		# 计算消耗量
		var consumed_heat: float = enemy.temp * PYRO_CONFIG.heat_consumption_rate
		enemy.temp -= consumed_heat
		
		# 计算爆炸伤害
		var explode_dmg: float = base_fire_dmg * PYRO_CONFIG.damage_mult
		
		if explode_dmg >= 1:
			# 视觉特效
			_spawn_shockwave(enemy.global_position, Color("#f97316"))
			for i in range(10):
				_spawn_particle(enemy.global_position, Color("#fdba74"), "spark")
			for i in range(5):
				_spawn_particle(enemy.global_position, Color(0, 0, 0, 0.5), "smoke")
			
			_play_explosion_sound()
			
			# 核心伤害
			var exp_result: Dictionary = enemy.take_damage(explode_dmg)
			_record_damage(exp_result.get("actual_damage", explode_dmg), "pyro", source_type, shot_id)
			_spawn_floating_text(enemy.global_position + Vector2(0, -50), "BOOM! " + str(ceili(exp_result.get("actual_damage", explode_dmg))), Color("#dc2626"))
			
			# 范围伤害
			for other in enemies:
				if other != enemy and other.is_active:
					if enemy.global_position.distance_to(other.global_position) < PYRO_CONFIG.radius:
						var aoe_dmg: float = explode_dmg * PYRO_CONFIG.aoe_damage_mult
						var aoe_result: Dictionary = other.take_damage(aoe_dmg)
						_record_damage(aoe_result.get("actual_damage", aoe_dmg), "pyro", source_type, shot_id)
						other.apply_temp(consumed_heat * 0.25)


## 生成击中特效
func _spawn_hit_effects(position: Vector2, config: AmmoData) -> void:
	if config.cryo > 0:
		# 冰霜效果
		var shard_count: int = 1 + int(config.cryo / 3)
		for i in range(shard_count):
			var color: Color = Color("#cffafe") if randf() > 0.5 else Color.WHITE
			_spawn_particle(position, color, "shard")
		
		var mist_count: int = 3 + int(config.cryo / 2)
		for i in range(mist_count):
			var offset := Vector2((randf() - 0.5) * 20, (randf() - 0.5) * 20)
			_spawn_particle(position + offset, Color("#a5f3fc"), "mist")
	
	elif config.pyro > 0:
		# 火焰效果
		for i in range(2):
			_spawn_particle(position, Color("#fdba74"), "spark")
		_spawn_particle(position, Color("#7c2d12"), "smoke")
	
	elif config.lightning > 0:
		# 闪电效果
		for i in range(8):
			_spawn_particle(position, Color("#d8b4fe"), "spark")
	
	elif config.pierce > 0:
		# 穿透效果
		for i in range(5):
			_spawn_particle(position, Color("#fca5a5"), "spark")
	
	elif config.wind > 0:
		# 风效果
		for i in range(6):
			_spawn_particle(position, Color("#34d399"), "spark")
	
	else:
		# 普通效果
		var color: Color = Color("#d8b4fe") if config.damage > 5 else Color("#e2e8f0")
		for i in range(4):
			_spawn_particle(position, color, "normal")


## 生成粒子特效 (占位实现)
func _spawn_particle(position: Vector2, color: Color, type: String) -> void:
	# TODO: 实现粒子系统
	pass


## 生成浮动文字
func _spawn_floating_text(position: Vector2, text: String, color: Color) -> void:
	if floating_text_scene == null:
		return
	
	var floating_text: Node2D = floating_text_scene.instantiate()
	floating_text.global_position = position
	floating_text.set_text(text)
	floating_text.set_color(color)
	get_tree().current_scene.add_child(floating_text)


## 生成闪电特效
func _spawn_lightning_bolt(from_pos: Vector2, to_pos: Vector2) -> void:
	if lightning_bolt_scene == null:
		return
	
	var bolt: Node2D = lightning_bolt_scene.instantiate()
	bolt.set_points(from_pos, to_pos)
	get_tree().current_scene.add_child(bolt)
	lightning_bolts.append(bolt)


## 生成冲击波特效
func _spawn_shockwave(position: Vector2, color: Color) -> void:
	if shockwave_scene == null:
		return
	
	var shockwave: Node2D = shockwave_scene.instantiate()
	shockwave.global_position = position
	shockwave.set_color(color)
	get_tree().current_scene.add_child(shockwave)


# =============================================================================
# 音效方法 (Audio Methods)
# =============================================================================

func _play_shoot_sound() -> void:
	if audio_manager != null and audio_manager.has_method("play_shoot"):
		audio_manager.play_shoot()


func _play_hit_sound(hit_type: String) -> void:
	if audio_manager != null and audio_manager.has_method("play_enemy_hit"):
		audio_manager.play_enemy_hit(hit_type)


func _play_lightning_sound() -> void:
	if audio_manager != null and audio_manager.has_method("play_lightning"):
		audio_manager.play_lightning()


func _play_explosion_sound() -> void:
	if audio_manager != null and audio_manager.has_method("play_explosion"):
		audio_manager.play_explosion()


# =============================================================================
# 数据类定义 (Data Class Definitions)
# =============================================================================

## 弹药数据类
class AmmoData:
	extends RefCounted
	
	var damage: float = 10.0
	var bounce: int = 0
	var pierce: int = 0
	var scatter: int = 0
	var element: String = ""
	var cryo: int = 0
	var pyro: int = 0
	var lightning: int = 0
	var wind: int = 0
	var multicast: int = 0
	var explosive: bool = false
	var is_laser: bool = false
	var is_matryoshka: bool = false
	var is_scatter_child: bool = false
	var type: String = "normal"
	var nested_payload: AmmoData = null
	
	func _init(data: Dictionary = {}) -> void:
		damage = data.get("damage", 10.0)
		bounce = data.get("bounce", 0)
		pierce = data.get("pierce", 0)
		scatter = data.get("scatter", 0)
		element = data.get("element", "")
		cryo = data.get("cryo", 0)
		pyro = data.get("pyro", 0)
		lightning = data.get("lightning", 0)
		wind = data.get("wind", 0)
		multicast = data.get("multicast", 0)
		explosive = data.get("explosive", false)
		is_laser = data.get("is_laser", false)
		is_matryoshka = data.get("is_matryoshka", false)
		is_scatter_child = data.get("is_scatter_child", false)
		type = data.get("type", "normal")


## 子弹数据类 (用于伤害计算)
class ProjectileData:
	extends RefCounted
	
	var config: AmmoData = null
	var position: Vector2 = Vector2.ZERO
	var is_copy: bool = false
	var shot_id: int = -1
	var chain_history: Array[Enemy] = []
	var bounces_left: int = 0
	var pierces_left: int = 0


# =============================================================================
# 占位类定义 (Placeholder Class Definitions)
# 这些类需要在项目中单独实现
# =============================================================================

## 子弹基类 (需要单独实现)
class Projectile:
	extends CharacterBody2D
	
	signal hit_enemy(projectile: Projectile, enemy: Enemy)
	signal destroyed(projectile: Projectile)
	
	var is_active: bool = true
	var is_copy: bool = false
	var ammo_data: AmmoData = null
	var shot_id: int = -1
	var is_last_in_burst: bool = false
	var chain_history: Array[Enemy] = []
	var bounces_left: int = 0
	var pierces_left: int = 0
	var radius: float = 5.0
	
	func update_movement(delta: float) -> void:
		pass
	
	func on_hit_enemy(enemy: Enemy) -> void:
		pass


## 敌人基类 (需要单独实现)
class Enemy:
	extends CharacterBody2D
	
	var is_active: bool = true
	var hp: float = 100.0
	var max_hp: float = 100.0
	var temp: float = 0.0
	var radius: float = 20.0
	
	func take_damage(damage: float, source = null) -> Dictionary:
		var actual_damage: float = minf(damage, hp)
		hp -= actual_damage
		var killed: bool = hp <= 0
		if killed:
			is_active = false
		return {"killed": killed, "actual_damage": actual_damage}
	
	func apply_temp(amount: float) -> void:
		temp += amount
