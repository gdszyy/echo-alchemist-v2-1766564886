# =============================================================================
## CombatSystem - 战斗系统管理器
## =============================================================================
## 将 JavaScript 战斗系统核心逻辑迁移到 Godot 4.x
## 实现发射、伤害、碰撞检测、闪电链等核心机制
## =============================================================================
extends Node

class_name CombatSystem

# =============================================================================
# 信号定义 (Signal Definitions)
# =============================================================================

## 发射子弹时触发
signal projectile_fired(projectile)

## 敌人受到伤害时触发
signal enemy_damaged(enemy, damage: float, damage_type: String, source: String)

## 敌人死亡时触发
signal enemy_killed(enemy)

## 伤害统计更新时触发
signal damage_recorded(amount: float, damage_type: String, source_type: String)

## 闪电链触发时触发
signal lightning_chain_triggered(from_enemy, to_enemy, damage: float)

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
# 配置常量
# =============================================================================

const LIGHTNING_CONFIG = {
	"chain_range": 100.0,
	"damage_decay_base": 0.8,
	"damage_decay_per_level": 0.05,
	"max_chain_count": 10,
}

const PYRO_CONFIG = {
	"explode_threshold": 34.0,
	"temp_for_max_chance": 100.0,
	"base_explode_chance": 0.1,
	"max_explode_chance": 0.5,
	"heat_consumption_rate": 0.5,
	"damage_mult": 2.0,
	"radius": 80.0,
	"aoe_damage_mult": 0.5,
}

const DAMAGE_COLOR_MAP = {
	"damage": Color.WHITE,
	"cryo": Color("#06b6d4"),
	"pyro": Color("#f97316"),
	"lightning": Color("#c084fc"),
	"wind": Color("#34d399"),
}

# =============================================================================
# 内部变量 (Internal Variables)
# =============================================================================

## 弹药队列
var ammo_queue: Array = []

## 活跃子弹列表
var projectiles: Array = []

## 敌人列表引用
var enemies: Array = []

## 闪电特效列表
var lightning_bolts: Array = []

## 回合伤害统计
var round_damage: float = 0.0

## 当前射击伤害统计
var current_shot_damage: float = 0.0

## 按属性分类的伤害统计
var current_shot_damage_by_attr: Dictionary = {}

## 射击历史
var shot_damage_map: Dictionary = {}

## 当前射击 ID
var current_shot_id: int = 0

# =============================================================================
# 弹药数据类
# =============================================================================

class AmmoData:
	var damage: float = 10.0
	var bounce: int = 0
	var pierce: int = 0
	var scatter: int = 0
	var cryo: int = 0
	var pyro: int = 0
	var lightning: int = 0
	var wind: int = 0
	var laser: int = 0
	
	func _init(data: Dictionary = {}) -> void:
		damage = data.get("damage", 10.0)
		bounce = data.get("bounce", 0)
		pierce = data.get("pierce", 0)
		scatter = data.get("scatter", 0)
		cryo = data.get("cryo", 0)
		pyro = data.get("pyro", 0)
		lightning = data.get("lightning", 0)
		wind = data.get("wind", 0)
		laser = data.get("laser", 0)

# =============================================================================
# 子弹运行时数据类
# =============================================================================

class ProjectileData:
	var position: Vector2 = Vector2.ZERO
	var velocity: Vector2 = Vector2.ZERO
	var ammo_data: AmmoData = null
	var shot_id: int = -1
	var is_active: bool = true
	var is_copy: bool = false
	var is_last_in_burst: bool = false
	var chain_history: Array = []
	var bounces_left: int = 0
	var pierces_left: int = 0
	
	func _init(ammo: AmmoData = null, id: int = -1) -> void:
		if ammo:
			ammo_data = ammo
			bounces_left = ammo.bounce
			pierces_left = ammo.pierce
		shot_id = id

# =============================================================================
# 生命周期方法
# =============================================================================

func _ready() -> void:
	pass

func _physics_process(delta: float) -> void:
	_update_projectiles(delta)
	_check_collisions()
	_update_lightning_bolts(delta)
	_check_victory_condition()

# =============================================================================
# 公共方法
# =============================================================================

## 发射下一发子弹
func fire_next_shot(velocity: Vector2 = Vector2(0, -10)) -> void:
	if ammo_queue.is_empty():
		return
	
	var ammo = ammo_queue.pop_front()
	current_shot_id += 1
	
	var projectile_data = ProjectileData.new(ammo, current_shot_id)
	projectile_data.velocity = velocity
	
	# 如果有场景，实例化子弹
	if projectile_scene:
		var projectile = projectile_scene.instantiate()
		projectile.global_position = Vector2(400, 550)  # 发射位置
		get_tree().current_scene.add_child(projectile)
		projectiles.append(projectile)
		projectile_fired.emit(projectile)
	else:
		projectiles.append(projectile_data)
		projectile_fired.emit(projectile_data)

## 添加弹药到队列
func add_ammo(ammo_data: Dictionary) -> void:
	var ammo = AmmoData.new(ammo_data)
	ammo_queue.append(ammo)

## 设置敌人列表
func set_enemies(enemy_list: Array) -> void:
	enemies = enemy_list

## 获取回合伤害
func get_round_damage() -> float:
	return round_damage

## 重置回合统计
func reset_round_stats() -> void:
	round_damage = 0.0
	current_shot_damage = 0.0
	current_shot_damage_by_attr.clear()

# =============================================================================
# 伤害系统
# =============================================================================

## 对敌人造成伤害
func damage_enemy(enemy, projectile_data: ProjectileData, damage_override: float = -1.0, source_type: String = "main") -> void:
	if not enemy or not projectile_data:
		return
	
	var config = projectile_data.ammo_data
	if not config:
		return
	
	# 计算伤害
	var dmg: float = damage_override if damage_override > 0 else config.damage
	
	# 应用元素效果
	_apply_element_effects(enemy, config, projectile_data, dmg)
	
	# 造成伤害 - 使用简化的调用
	var killed: bool = false
	var actual_dmg: float = dmg
	
	if enemy.has_method("take_damage"):
		var result = enemy.take_damage(dmg)
		if result is Dictionary:
			killed = result.get("killed", false)
			actual_dmg = result.get("actual_damage", dmg)
		elif result is bool:
			killed = result
	
	# 确定伤害统计类型
	var damage_type: String = _determine_damage_type(config, projectile_data)
	var damage_color: Color = DAMAGE_COLOR_MAP.get(damage_type, Color.WHITE)
	
	# 记录伤害
	_record_damage(actual_dmg, damage_type, source_type, projectile_data.shot_id)
	
	# 处理火焰燃烧和爆炸
	if config.pyro > 0 and enemy.get("temp") != null and enemy.temp >= 34:
		_process_pyro_effects(enemy, config, source_type, projectile_data.shot_id)
	
	# 显示伤害数字
	if show_damage_numbers and actual_dmg > 0:
		_spawn_floating_text(projectile_data.position, "-" + str(ceili(actual_dmg)), damage_color)
	
	# 触发震屏效果
	if actual_dmg > screen_shake_threshold:
		var intensity: float = minf(screen_shake_max_intensity, actual_dmg / 10.0)
		screen_shake_requested.emit(intensity)
	
	# 发送信号
	enemy_damaged.emit(enemy, actual_dmg, damage_type, source_type)
	
	if killed:
		enemy_killed.emit(enemy)

## 触发闪电链
func trigger_lightning_chain(source_enemy, damage: float, history: Array, level: int, shot_id: int) -> bool:
	if history.size() >= LIGHTNING_CONFIG.max_chain_count:
		return false
	
	# 查找最近的未被击中的敌人
	var nearest_enemy = null
	var nearest_dist: float = LIGHTNING_CONFIG.chain_range
	
	for enemy in enemies:
		if enemy in history:
			continue
		if not enemy.get("is_active") or (enemy.has_method("is_dead") and enemy.is_dead()):
			continue
		
		var dist = source_enemy.global_position.distance_to(enemy.global_position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest_enemy = enemy
	
	if nearest_enemy:
		# 创建闪电视觉效果
		if lightning_bolt_scene:
			var bolt = lightning_bolt_scene.instantiate()
			get_tree().current_scene.add_child(bolt)
			if bolt.has_method("setup"):
				bolt.setup(source_enemy.global_position, nearest_enemy.global_position, 0.2)
		
		lightning_chain_triggered.emit(source_enemy, nearest_enemy, damage)
		
		# 计算下一次伤害
		var decay_factor: float = LIGHTNING_CONFIG.damage_decay_base + (LIGHTNING_CONFIG.damage_decay_per_level * level)
		var next_dmg: float = maxf(1.0, floorf(damage * decay_factor))
		
		# 应用温度变化
		if nearest_enemy.has_method("apply_temp"):
			nearest_enemy.apply_temp(level + history.size() / 3.0)
		
		# 造成伤害
		var actual_dmg = damage
		if nearest_enemy.has_method("take_damage"):
			var result = nearest_enemy.take_damage(damage)
			if result is Dictionary:
				actual_dmg = result.get("actual_damage", damage)
				if result.get("killed", false):
					enemy_killed.emit(nearest_enemy)
		
		_record_damage(actual_dmg, "lightning", "chain", shot_id)
		
		# 递归触发下一次闪电链
		var new_history: Array = history.duplicate()
		new_history.append(nearest_enemy)
		
		if new_history.size() < LIGHTNING_CONFIG.max_chain_count:
			# 延迟触发下一次
			get_tree().create_timer(0.05).timeout.connect(func():
				trigger_lightning_chain(nearest_enemy, next_dmg, new_history, level, shot_id)
			)
		
		return true
	
	return false

# =============================================================================
# 内部方法
# =============================================================================

func _update_projectiles(delta: float) -> void:
	var to_remove: Array = []
	
	for i in range(projectiles.size()):
		var proj = projectiles[i]
		
		if proj is ProjectileData:
			proj.position += proj.velocity * delta * 60.0
			
			# 边界检查
			if proj.position.y < -50 or proj.position.y > 700:
				to_remove.append(i)
		elif proj.has_method("update_movement"):
			proj.update_movement(delta)
	
	# 移除无效子弹
	to_remove.reverse()
	for i in to_remove:
		projectiles.remove_at(i)

func _check_collisions() -> void:
	for proj in projectiles:
		var proj_pos: Vector2
		var proj_radius: float = 6.0
		
		if proj is ProjectileData:
			proj_pos = proj.position
			if not proj.is_active:
				continue
		else:
			proj_pos = proj.global_position
			if proj.has("is_active") and not proj.is_active:
				continue
		
		for enemy in enemies:
			if enemy.has_method("is_dead") and enemy.is_dead():
				continue
			if enemy.get("is_active") == false:
				continue
			
			var enemy_pos = enemy.global_position
			var enemy_radius: float = enemy.get("radius") if enemy.get("radius") else 20.0
			
			var dist = proj_pos.distance_to(enemy_pos)
			if dist < proj_radius + enemy_radius:
				_on_projectile_hit_enemy(proj, enemy)

func _on_projectile_hit_enemy(projectile, enemy) -> void:
	var projectile_data: ProjectileData
	
	if projectile is ProjectileData:
		projectile_data = projectile
	else:
		# 从节点创建 ProjectileData
		projectile_data = ProjectileData.new()
		projectile_data.position = projectile.global_position
		if projectile.has("ammo_data"):
			projectile_data.ammo_data = projectile.ammo_data
		if projectile.has("shot_id"):
			projectile_data.shot_id = projectile.shot_id
		if projectile.has("chain_history"):
			projectile_data.chain_history = projectile.chain_history
	
	damage_enemy(enemy, projectile_data)
	
	# 处理闪电链
	if projectile_data.ammo_data and projectile_data.ammo_data.lightning > 0:
		trigger_lightning_chain(enemy, projectile_data.ammo_data.damage, projectile_data.chain_history, projectile_data.ammo_data.lightning, projectile_data.shot_id)
		projectile_data.chain_history.append(enemy)
	
	# 处理穿透
	if projectile_data.pierces_left > 0:
		projectile_data.pierces_left -= 1
	else:
		if projectile is ProjectileData:
			projectile.is_active = false
		elif projectile.has("is_active"):
			projectile.is_active = false
		elif projectile.has_method("queue_free"):
			projectile.queue_free()

func _update_lightning_bolts(delta: float) -> void:
	var to_remove: Array = []
	
	for i in range(lightning_bolts.size()):
		var bolt = lightning_bolts[i]
		if bolt.has("lifetime"):
			bolt.lifetime -= delta
			if bolt.lifetime <= 0:
				to_remove.append(i)
				if bolt.has("node") and bolt.node:
					bolt.node.queue_free()
	
	to_remove.reverse()
	for i in to_remove:
		lightning_bolts.remove_at(i)

func _check_victory_condition() -> void:
	var all_dead = true
	for enemy in enemies:
		if enemy.has_method("is_dead"):
			if not enemy.is_dead():
				all_dead = false
				break
		elif enemy.get("is_active") != false:
			all_dead = false
			break
	
	if all_dead and not enemies.is_empty():
		all_enemies_defeated.emit()

func _apply_element_effects(enemy, config: AmmoData, projectile_data: ProjectileData, damage: float) -> void:
	if not enemy.has_method("apply_temp"):
		return
	
	# 冰霜效果
	if config.cryo > 0:
		enemy.apply_temp(-config.cryo * 2.0)
	
	# 火焰效果
	if config.pyro > 0:
		enemy.apply_temp(config.pyro * 2.0)
	
	# 闪电效果 - 叠层
	if config.lightning > 0 and enemy.has("lightning_stacks"):
		enemy.lightning_stacks += config.lightning

func _determine_damage_type(config: AmmoData, projectile_data: ProjectileData) -> String:
	if config.cryo > 0:
		return "cryo"
	if config.pyro > 0:
		return "pyro"
	if config.lightning > 0:
		return "lightning"
	if config.wind > 0:
		return "wind"
	return "damage"

func _process_pyro_effects(enemy, config: AmmoData, source_type: String, shot_id: int) -> void:
	if not enemy.has("temp"):
		return
	
	# 计算基础额外火伤
	var base_fire_dmg: float = (config.pyro * enemy.temp) / 200.0
	
	# 造成燃烧伤害
	if base_fire_dmg >= 1:
		if enemy.has_method("take_damage"):
			var result = enemy.take_damage(base_fire_dmg)
			var actual_dmg = base_fire_dmg
			if result is Dictionary:
				actual_dmg = result.get("actual_damage", base_fire_dmg)
			_record_damage(actual_dmg, "pyro", source_type, shot_id)
	
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
			# 核心伤害
			if enemy.has_method("take_damage"):
				var result = enemy.take_damage(explode_dmg)
				var actual_dmg = explode_dmg
				if result is Dictionary:
					actual_dmg = result.get("actual_damage", explode_dmg)
				_record_damage(actual_dmg, "pyro", source_type, shot_id)
			
			# 范围伤害
			for other in enemies:
				if other != enemy and (other.get("is_active") != false):
					if enemy.global_position.distance_to(other.global_position) < PYRO_CONFIG.radius:
						var aoe_dmg: float = explode_dmg * PYRO_CONFIG.aoe_damage_mult
						if other.has_method("take_damage"):
							var aoe_result = other.take_damage(aoe_dmg)
							var actual_aoe = aoe_dmg
							if aoe_result is Dictionary:
								actual_aoe = aoe_result.get("actual_damage", aoe_dmg)
							_record_damage(actual_aoe, "pyro", source_type, shot_id)
						if other.has_method("apply_temp"):
							other.apply_temp(consumed_heat * 0.25)

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
	
	damage_recorded.emit(amount, attr_type, source_type)

func _spawn_floating_text(pos: Vector2, text: String, color: Color) -> void:
	if floating_text_scene:
		var floating_text = floating_text_scene.instantiate()
		floating_text.global_position = pos
		if floating_text.has_method("setup"):
			floating_text.setup(text, color)
		get_tree().current_scene.add_child(floating_text)

func _spawn_particle(pos: Vector2, color: Color, particle_type: String) -> void:
	# 简化的粒子生成
	pass

func _spawn_shockwave(pos: Vector2, color: Color) -> void:
	if shockwave_scene:
		var shockwave = shockwave_scene.instantiate()
		shockwave.global_position = pos
		get_tree().current_scene.add_child(shockwave)

func _play_hit_sound(hit_type: String = "normal") -> void:
	# 播放音效
	pass

func _play_lightning_sound() -> void:
	# 播放闪电音效
	pass

func _play_explosion_sound() -> void:
	# 播放爆炸音效
	pass
