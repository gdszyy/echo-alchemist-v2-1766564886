## Enemy 实体类
## 从 JavaScript entities.js 迁移到 Godot 4.x
## 包含温度系统、护盾系统、词缀系统等完整功能
class_name Enemy
extends CharacterBody2D

#region 信号定义
## 敌人死亡时发出，携带位置和敌人类型信息
signal died(position: Vector2, enemy_type: String)
## 敌人受到伤害时发出
signal damage_taken(amount: float, remaining_hp: float)
## 护盾被击破时发出
signal shield_broken()
## 温度状态变化时发出
signal temperature_changed(new_temperature: float)
## 进入冰冻状态
signal frozen()
## 进入过热状态
signal overheated()
#endregion

#region 枚举定义
## 敌人类型
enum EnemyType {
	NORMAL,
	ELITE,
	BOSS
}

## 伤害类型
enum DamageType {
	PHYSICAL,
	PYRO,    # 火焰
	CRYO,    # 冰霜
	ELECTRO, # 雷电
	VOID     # 虚空
}

## 词缀类型
enum AffixType {
	SHIELDED,      # 护盾
	REGENERATING,  # 再生
	SWIFT,         # 迅捷
	ARMORED,       # 护甲
	SPLITTING,     # 分裂
	TELEPORTING    # 传送
}
#endregion

#region 导出变量
@export_group("基础属性")
@export var max_hp: float = 100.0
@export var enemy_type: EnemyType = EnemyType.NORMAL
@export var base_radius: float = 20.0
@export var move_speed: float = 2.0

@export_group("护盾系统")
@export var max_shield_hp: float = 0.0

@export_group("视觉效果")
@export var base_color: Color = Color("#eeeeee")
@export var frozen_color: Color = Color("#06b6d4")
@export var overheat_color: Color = Color("#f97316")
@export var hit_flash_color: Color = Color.WHITE
@export var shield_color: Color = Color("#3b82f6")
#endregion

#region 内部变量
# 位置与移动
var target_pos: Vector2 = Vector2.ZERO
var current_velocity: Vector2 = Vector2.ZERO

# 生命值系统
var hp: float = 100.0
var shield_hp: float = 0.0

# 温度系统 (-100 冰冻 到 +100 过热)
var temperature: float = 0.0
var frozen_timer: float = 0.0
var overheat_timer: float = 0.0

# 雷电叠层
var lightning_stacks: int = 0

# 视觉效果
var hit_flash: int = 0
var visual_scale: float = 1.0

# 词缀系统
var affixes: Array[AffixType] = []

# 精英/克隆相关
var is_elite: bool = false
var clone_count: int = 0
var spawn_timer: float = 0.0

# 节点引用
@onready var collision_shape: CollisionShape2D = $CollisionShape2D
@onready var hit_flash_timer: Timer = $HitFlashTimer
@onready var freeze_timer_node: Timer = $FreezeTimer
@onready var overheat_timer_node: Timer = $OverheatTimer
#endregion

#region 生命周期方法
func _ready() -> void:
	# 初始化生命值
	hp = max_hp
	shield_hp = max_shield_hp
	target_pos = global_position
	
	# 连接计时器信号
	hit_flash_timer.timeout.connect(_on_hit_flash_timeout)
	freeze_timer_node.timeout.connect(_on_freeze_timeout)
	overheat_timer_node.timeout.connect(_on_overheat_timeout)
	
	# 更新碰撞形状半径
	_update_collision_radius()


func _physics_process(delta: float) -> void:
	_update_temperature_effects(delta)
	_update_movement(delta)
	_update_visual_scale(delta)
	
	# 请求重绘
	queue_redraw()


func _draw() -> void:
	_draw_main_body()
	_draw_shield()
	_draw_health_bar()
	_draw_temperature_indicator()
#endregion

#region 温度系统
func _update_temperature_effects(delta: float) -> void:
	# 温度自然衰减
	if temperature > 0:
		temperature = maxf(0, temperature - 5.0 * delta)
	elif temperature < 0:
		temperature = minf(0, temperature + 5.0 * delta)
	
	# 冰冻效果检测
	if temperature <= -100:
		if frozen_timer <= 0:
			frozen_timer = 60.0  # 60帧 = 1秒
			frozen.emit()
	
	# 过热效果检测
	if temperature >= 100:
		if overheat_timer <= 0:
			overheat_timer = 60.0  # 60帧 = 1秒
			overheated.emit()
	
	# 计时器递减
	if frozen_timer > 0:
		frozen_timer -= 1
	if overheat_timer > 0:
		overheat_timer -= 1


## 应用温度变化
func apply_temperature_change(amount: float) -> void:
	var old_temperature := temperature
	temperature = clampf(temperature + amount, -100.0, 100.0)
	
	if temperature != old_temperature:
		temperature_changed.emit(temperature)
#endregion

#region 移动系统
func _update_movement(delta: float) -> void:
	var diff := target_pos - global_position
	
	if diff.length() > 1.0:
		var direction := diff.normalized()
		var speed := move_speed
		
		# 冰冻减速效果
		if temperature < 0:
			speed *= 0.5
		
		# 冰冻状态完全停止
		if frozen_timer > 0:
			speed = 0.0
		
		velocity = direction * speed * 60.0  # 转换为每秒单位
		move_and_slide()
	else:
		velocity = Vector2.ZERO


## 设置目标位置
func set_target_position(pos: Vector2) -> void:
	target_pos = pos
#endregion

#region 伤害系统
## 受到伤害
## 返回 true 表示敌人死亡
func take_damage(amount: float, damage_type: DamageType = DamageType.PHYSICAL) -> bool:
	var actual_damage := amount
	
	# 护盾优先承受伤害
	if shield_hp > 0:
		var shield_damage := minf(shield_hp, actual_damage)
		shield_hp -= shield_damage
		actual_damage -= shield_damage
		
		if shield_hp <= 0:
			shield_broken.emit()
	
	# 温度效果处理
	match damage_type:
		DamageType.PYRO:
			apply_temperature_change(10.0)
		DamageType.CRYO:
			apply_temperature_change(-10.0)
		DamageType.ELECTRO:
			lightning_stacks += 1
	
	# 过热伤害加成
	if overheat_timer > 0:
		actual_damage *= 1.5
	
	# 应用伤害
	hp -= actual_damage
	damage_taken.emit(actual_damage, hp)
	
	# 触发受击效果
	_trigger_hit_effect()
	
	# 检查死亡
	if hp <= 0:
		_on_death()
		return true
	
	return false


## 触发受击视觉效果
func _trigger_hit_effect() -> void:
	hit_flash = 10
	visual_scale = 1.3
	hit_flash_timer.start(0.1)
#endregion

#region 护盾系统
## 添加护盾
func add_shield(amount: float) -> void:
	shield_hp = minf(shield_hp + amount, max_shield_hp)


## 设置最大护盾值
func set_max_shield(amount: float) -> void:
	max_shield_hp = amount
	shield_hp = amount
#endregion

#region 词缀系统
## 添加词缀
func add_affix(affix: AffixType) -> void:
	if affix not in affixes:
		affixes.append(affix)
		_apply_affix_effects(affix)


## 移除词缀
func remove_affix(affix: AffixType) -> void:
	affixes.erase(affix)


## 检查是否拥有词缀
func has_affix(affix: AffixType) -> bool:
	return affix in affixes


## 应用词缀效果
func _apply_affix_effects(affix: AffixType) -> void:
	match affix:
		AffixType.SHIELDED:
			set_max_shield(max_hp * 0.5)
		AffixType.SWIFT:
			move_speed *= 1.5
		AffixType.ARMORED:
			max_hp *= 1.5
			hp = max_hp
#endregion

#region 死亡处理
func _on_death() -> void:
	# 发出死亡信号
	died.emit(global_position, EnemyType.keys()[enemy_type])
	
	# 可以在这里添加死亡动画或粒子效果
	# 然后销毁节点
	queue_free()
#endregion

#region 绘制方法
func _draw_main_body() -> void:
	var color := _get_current_color()
	
	# 受击闪烁
	if hit_flash > 0:
		color = hit_flash_color
	
	# 绘制主体圆形
	var scaled_radius := base_radius * visual_scale
	draw_circle(Vector2.ZERO, scaled_radius, color)
	
	# 绘制边框
	draw_arc(Vector2.ZERO, scaled_radius, 0, TAU, 32, color.darkened(0.3), 2.0)


func _draw_shield() -> void:
	if shield_hp <= 0:
		return
	
	var shield_radius := base_radius * visual_scale + 5.0
	var shield_ratio := shield_hp / max_shield_hp
	
	# 绘制护盾圆环
	draw_arc(Vector2.ZERO, shield_radius, 0, TAU * shield_ratio, 32, shield_color, 3.0)


func _draw_health_bar() -> void:
	var bar_width := base_radius * 2.0
	var bar_height := 4.0
	var bar_y := -base_radius - 10.0
	
	# 背景条
	var bg_rect := Rect2(-bar_width / 2.0, bar_y, bar_width, bar_height)
	draw_rect(bg_rect, Color("#333333"))
	
	# 血量条
	var hp_ratio := hp / max_hp
	var hp_color: Color
	if hp_ratio > 0.5:
		hp_color = Color("#22c55e")  # 绿色
	elif hp_ratio > 0.25:
		hp_color = Color("#facc15")  # 黄色
	else:
		hp_color = Color("#ef4444")  # 红色
	
	var hp_rect := Rect2(-bar_width / 2.0, bar_y, bar_width * hp_ratio, bar_height)
	draw_rect(hp_rect, hp_color)
	
	# 护盾条（如果有）
	if max_shield_hp > 0 and shield_hp > 0:
		var shield_bar_y := bar_y - bar_height - 2.0
		var shield_ratio := shield_hp / max_shield_hp
		
		var shield_bg_rect := Rect2(-bar_width / 2.0, shield_bar_y, bar_width, bar_height)
		draw_rect(shield_bg_rect, Color("#1e3a5f"))
		
		var shield_rect := Rect2(-bar_width / 2.0, shield_bar_y, bar_width * shield_ratio, bar_height)
		draw_rect(shield_rect, shield_color)


func _draw_temperature_indicator() -> void:
	if absf(temperature) < 10:
		return
	
	var indicator_y := base_radius + 8.0
	var indicator_width := base_radius * 1.5
	var indicator_height := 3.0
	
	# 温度条背景
	var bg_rect := Rect2(-indicator_width / 2.0, indicator_y, indicator_width, indicator_height)
	draw_rect(bg_rect, Color("#333333"))
	
	# 温度指示
	var temp_ratio := temperature / 100.0
	var temp_color: Color
	var temp_width: float
	
	if temperature > 0:
		temp_color = overheat_color
		temp_width = indicator_width / 2.0 * temp_ratio
		var temp_rect := Rect2(0, indicator_y, temp_width, indicator_height)
		draw_rect(temp_rect, temp_color)
	else:
		temp_color = frozen_color
		temp_width = indicator_width / 2.0 * absf(temp_ratio)
		var temp_rect := Rect2(-temp_width, indicator_y, temp_width, indicator_height)
		draw_rect(temp_rect, temp_color)


func _get_current_color() -> Color:
	if frozen_timer > 0:
		return frozen_color
	if overheat_timer > 0:
		return overheat_color
	return base_color
#endregion

#region 视觉效果更新
func _update_visual_scale(delta: float) -> void:
	# 弹性恢复
	if visual_scale > 1.0:
		visual_scale -= 6.0 * delta  # 约0.1每帧 at 60fps
		if visual_scale < 1.0:
			visual_scale = 1.0


func _update_collision_radius() -> void:
	if collision_shape and collision_shape.shape is CircleShape2D:
		(collision_shape.shape as CircleShape2D).radius = base_radius
#endregion

#region 计时器回调
func _on_hit_flash_timeout() -> void:
	hit_flash = 0


func _on_freeze_timeout() -> void:
	frozen_timer = 0


func _on_overheat_timeout() -> void:
	overheat_timer = 0
#endregion

#region 工具方法
## 获取当前状态信息（用于调试）
func get_status_info() -> Dictionary:
	return {
		"hp": hp,
		"max_hp": max_hp,
		"shield_hp": shield_hp,
		"max_shield_hp": max_shield_hp,
		"temperature": temperature,
		"frozen": frozen_timer > 0,
		"overheated": overheat_timer > 0,
		"lightning_stacks": lightning_stacks,
		"affixes": affixes,
		"is_elite": is_elite
	}


## 重置敌人状态
func reset() -> void:
	hp = max_hp
	shield_hp = max_shield_hp
	temperature = 0.0
	frozen_timer = 0.0
	overheat_timer = 0.0
	lightning_stacks = 0
	hit_flash = 0
	visual_scale = 1.0


## 设置为精英敌人
func make_elite() -> void:
	is_elite = true
	max_hp *= 2.0
	hp = max_hp
	base_radius *= 1.2
	_update_collision_radius()
#endregion