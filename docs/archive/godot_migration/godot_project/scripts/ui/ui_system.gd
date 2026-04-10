# UI系统 - 管理所有游戏UI界面
# 从 JavaScript ui_system.js 迁移

extends Control

class_name UISystem

# 信号
signal phase_changed(new_phase: String)
signal relic_selected(relic: Dictionary)
signal shop_item_purchased(item_id: String)
signal currency_changed(amount: int)
signal damage_updated(damage: int)

# 游戏引用
var game_ref: Node = null

# 阶段状态
var current_phase: String = "meta"
var state_before_relic: String = ""

# 货币
var meta_currency: int = 0
var run_currency: int = 0

# 伤害统计
var current_shot_damage: int = 0
var current_shot_damage_by_attr: Dictionary = {}
var shot_damage_history: Array = []
var round_damage: int = 0
var round_damage_history: Array = []
var current_viewing_round: int = 0

# 慢动作
var time_scale: float = 1.0
var base_time_scale: float = 1.0
var slow_motion_timer: int = 0
var frame_damage_accumulator: float = 0.0

# 分数乘数
var score_multiplier: float = 1.0

# 遗物
var owned_relics: Array[String] = []

# UI缓存
var ui_cache: Dictionary = {}

# 配置
var slow_motion_config: Dictionary = {
	"duration": 36,
	"time_scale": 0.1,
	"recovery_rate": 0.1
}

# 稀有度权重
var rarity_weights: Dictionary = {
	"common": 60,
	"rare": 30,
	"legendary": 8,
	"cursed": 2
}


func _ready() -> void:
	"""初始化UI系统"""
	pass


func _process(delta: float) -> void:
	"""每帧更新"""
	update_slow_motion()


# ==================== 资源飞入动画 ====================

func play_resource_fly_effect(start_pos: Vector2, target_pos: Vector2, amount: int) -> void:
	"""播放资源飞入动画"""
	if amount <= 0:
		return
	
	# 创建飞行标签
	var label = Label.new()
	label.text = "🔮 +" + str(amount)
	label.position = start_pos
	label.add_theme_color_override("font_color", Color(0.98, 0.75, 0.14, 1.0))
	label.add_theme_font_size_override("font_size", 18)
	add_child(label)
	
	# 创建动画
	var tween = create_tween()
	tween.set_ease(Tween.EASE_OUT)
	tween.set_trans(Tween.TRANS_CUBIC)
	
	tween.tween_property(label, "position", target_pos, 0.8)
	tween.parallel().tween_property(label, "scale", Vector2(0.5, 0.5), 0.8)
	tween.parallel().tween_property(label, "modulate:a", 0.0, 0.8)
	
	tween.tween_callback(label.queue_free)


# ==================== 慢动作系统 ====================

func update_slow_motion() -> void:
	"""更新慢动作效果"""
	var dynamic_threshold = calculate_dynamic_threshold()
	
	# 触发逻辑
	if frame_damage_accumulator > dynamic_threshold:
		slow_motion_timer = slow_motion_config.duration
		time_scale = slow_motion_config.time_scale
	
	# 清空当帧累计
	frame_damage_accumulator = 0.0
	
	# 恢复逻辑
	if slow_motion_timer > 0:
		slow_motion_timer -= 1
	else:
		if absf(time_scale - base_time_scale) > 0.01:
			time_scale += (base_time_scale - time_scale) * slow_motion_config.recovery_rate
			if absf(time_scale - base_time_scale) < 0.01:
				time_scale = base_time_scale
		else:
			time_scale = base_time_scale


func calculate_dynamic_threshold() -> float:
	"""计算动态阈值"""
	# 基于当前回合和难度计算
	return 50.0


func add_frame_damage(damage: float) -> void:
	"""添加当帧伤害（用于触发慢动作）"""
	frame_damage_accumulator += damage


# ==================== 货币系统 ====================

func update_meta_currency(amount: int) -> void:
	"""更新元货币"""
	meta_currency = amount
	currency_changed.emit(meta_currency)


func update_run_currency(amount: int) -> void:
	"""更新局内货币"""
	run_currency = amount


func add_currency(amount: int) -> void:
	"""增加货币"""
	meta_currency += amount
	currency_changed.emit(meta_currency)


# ==================== 伤害统计 ====================

func save_shot_damage() -> void:
	"""保存当前子弹的伤害统计"""
	if current_shot_damage > 0:
		shot_damage_history.push_front({
			"total": current_shot_damage,
			"by_attr": current_shot_damage_by_attr.duplicate(true)
		})
		
		if shot_damage_history.size() > 3:
			shot_damage_history.pop_back()
		
		update_round_damage()


func update_round_damage() -> void:
	"""更新回合伤害显示"""
	damage_updated.emit(round_damage)


func update_damage_stats() -> void:
	"""更新伤害统计面板"""
	# 由 DamagePanel 子节点处理
	pass


func switch_damage_round(direction: int) -> void:
	"""切换伤害统计查看的回合"""
	current_viewing_round += direction
	current_viewing_round = clampi(current_viewing_round, 0, round_damage_history.size())
	update_damage_stats()


func reset_damage_stats() -> void:
	"""重置伤害统计"""
	current_shot_damage = 0
	current_shot_damage_by_attr.clear()
	round_damage = 0


# ==================== 分数乘数 ====================

func update_multiplier(multiplier: float) -> void:
	"""更新分数乘数"""
	score_multiplier = multiplier


# ==================== 阶段UI管理 ====================

func update_ui() -> void:
	"""更新阶段UI显示"""
	phase_changed.emit(current_phase)


func switch_phase(new_phase: String) -> void:
	"""切换阶段"""
	current_phase = new_phase
	update_ui()


# ==================== 遗物选择 ====================

func show_relic_selection(available_relics: Array) -> void:
	"""显示遗物选择界面"""
	state_before_relic = current_phase
	
	# 过滤已拥有的遗物
	var pool = available_relics.filter(func(r): return r.id not in owned_relics)
	
	if pool.is_empty():
		close_relic_selection()
		return
	
	# 抽取遗物（加权随机）
	var choices: Array = []
	var choice_count = mini(3, pool.size())
	
	for i in range(choice_count):
		if pool.is_empty():
			break
		
		# 计算总权重
		var total_weight: float = 0.0
		for r in pool:
			total_weight += rarity_weights.get(r.rarity, 10)
		
		# 随机选择
		var random_val = randf() * total_weight
		var selected_idx = 0
		
		for j in range(pool.size()):
			var weight = rarity_weights.get(pool[j].rarity, 10)
			random_val -= weight
			if random_val <= 0:
				selected_idx = j
				break
		
		choices.append(pool[selected_idx])
		pool.remove_at(selected_idx)
	
	# 发送选择事件（由 RelicSelection 子节点处理UI）
	# 这里只是准备数据


func select_relic(relic: Dictionary) -> void:
	"""选择遗物"""
	owned_relics.append(relic.id)
	relic_selected.emit(relic)
	close_relic_selection()


func skip_relic() -> void:
	"""跳过遗物选择"""
	close_relic_selection()


func close_relic_selection() -> void:
	"""关闭遗物选择界面"""
	switch_phase(state_before_relic)


# ==================== 配方/弹药HUD ====================

func update_ui_cache(gauge_rect: Rect2) -> void:
	"""更新UI缓存"""
	ui_cache = {
		"x": gauge_rect.position.x + gauge_rect.size.x / 2.0,
		"y": gauge_rect.position.y + gauge_rect.size.y / 2.0
	}


func get_ui_cache() -> Dictionary:
	"""获取UI缓存"""
	return ui_cache


# ==================== Meta系统 ====================

func apply_upgrades(upgrades: Dictionary, shop_config: Array) -> void:
	"""应用局外升级"""
	for upgrade in shop_config:
		var level = upgrades.get(upgrade.id, 0)
		if level > 0:
			var effect_value = upgrade.effect.value_per_level * level
			# 应用效果（需要根据具体配置实现）


func calculate_upgrade_cost(upgrade: Dictionary, level: int) -> int:
	"""计算升级价格"""
	var cost = upgrade.cost
	
	match cost.type:
		"fixed":
			return cost.values[level] if level < cost.values.size() else 0
		"linear":
			return cost.base + level * cost.growth
		"exponential":
			return floori(cost.base * pow(cost.growth, level))
	
	return 0


func buy_upgrade(upgrade_id: String, shop_config: Array) -> bool:
	"""购买升级"""
	var upgrade = null
	for u in shop_config:
		if u.id == upgrade_id:
			upgrade = u
			break
	
	if not upgrade:
		return false
	
	var level = 0  # 从存档读取
	if level >= upgrade.max_level:
		return false
	
	var cost = calculate_upgrade_cost(upgrade, level)
	if meta_currency >= cost:
		meta_currency -= cost
		# 保存升级等级
		shop_item_purchased.emit(upgrade_id)
		return true
	
	return false


# ==================== 设置方法 ====================

func setup(game: Node) -> void:
	"""设置UI系统"""
	game_ref = game


func set_time_scale(scale: float) -> void:
	"""设置时间缩放"""
	base_time_scale = scale


func get_time_scale() -> float:
	"""获取当前时间缩放"""
	return time_scale
