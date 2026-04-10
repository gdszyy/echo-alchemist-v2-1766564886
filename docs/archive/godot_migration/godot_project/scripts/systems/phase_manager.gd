extends Node
## 游戏阶段管理系统 - Godot 4.x 实现
## 负责管理游戏的五个主要阶段：meta、selection、gathering、combat、gameover

class_name PhaseManager

# 信号定义
signal phase_changed(old_phase: String, new_phase: String)
signal phase_entered(phase: String)
signal phase_exited(phase: String)

# 阶段常量
const PHASE_META = "meta"
const PHASE_SELECTION = "selection"
const PHASE_GATHERING = "gathering"
const PHASE_COMBAT = "combat"
const PHASE_GAMEOVER = "gameover"

# 成员变量
var current_phase: String = PHASE_META
var previous_phase: String = ""

# 游戏状态
var game_width: float = 800.0
var game_height: float = 600.0
var time_scale: float = 1.0

# 弹珠台相关
var pegs: Array = []
var drop_balls: Array = []
var special_slots: Array = []
var marble_queue: Array = []
var marbles_pool: Array = []

# 战斗相关
var ammo_queue: Array = []
var round_damage: int = 0
var current_shot_damage: int = 0
var current_shot_damage_by_attr: Dictionary = {}

# 场景引用
var ui_manager: Node = null
var gathering_scene: Node = null
var combat_scene: Node = null

# 阶段处理器字典
var phase_handlers: Dictionary = {}

func _ready() -> void:
	"""初始化阶段管理器"""
	_setup_phase_handlers()
	_initialize_game_state()
	print("PhaseManager initialized")

func _setup_phase_handlers() -> void:
	"""设置阶段处理器映射"""
	phase_handlers = {
		PHASE_META: _handle_meta_phase,
		PHASE_SELECTION: _handle_selection_phase,
		PHASE_GATHERING: _handle_gathering_phase,
		PHASE_COMBAT: _handle_combat_phase,
		PHASE_GAMEOVER: _handle_gameover_phase,
	}

func _initialize_game_state() -> void:
	"""初始化游戏状态"""
	marble_queue = []
	marbles_pool = []
	drop_balls = []
	pegs = []
	special_slots = []
	ammo_queue = []
	round_damage = 0
	current_shot_damage = 0
	current_shot_damage_by_attr = {}

func switch_phase(new_phase: String) -> void:
	"""
	切换游戏阶段
	
	Args:
		new_phase: 新阶段名称
	"""
	if new_phase == current_phase:
		push_warning("Attempting to switch to the same phase: %s" % new_phase)
		return
	
	if new_phase not in phase_handlers:
		push_error("Unknown phase: %s" % new_phase)
		return
	
	print("Phase: %s -> %s" % [current_phase, new_phase])
	
	# 退出当前阶段
	_exit_phase(current_phase)
	
	# 更新阶段
	previous_phase = current_phase
	current_phase = new_phase
	phase_exited.emit(previous_phase)
	
	# 进入新阶段
	_enter_phase(new_phase)
	phase_entered.emit(new_phase)
	
	# 发出阶段改变信号
	phase_changed.emit(previous_phase, new_phase)
	
	# 更新 UI
	_update_phase_ui(new_phase)

func _exit_phase(phase: String) -> void:
	"""
	退出指定阶段的清理工作
	
	Args:
		phase: 要退出的阶段
	"""
	match phase:
		PHASE_GATHERING:
			_cleanup_gathering_phase()
		PHASE_COMBAT:
			_cleanup_combat_phase()

func _enter_phase(phase: String) -> void:
	"""
	进入指定阶段的初始化工作
	
	Args:
		phase: 要进入的阶段
	"""
	if phase in phase_handlers:
		phase_handlers[phase].call()

func _cleanup_gathering_phase() -> void:
	"""清理弹珠台阶段"""
	drop_balls.clear()
	pegs.clear()
	special_slots.clear()
	marble_queue.clear()

func _cleanup_combat_phase() -> void:
	"""清理战斗阶段"""
	ammo_queue.clear()
	round_damage = 0
	current_shot_damage = 0
	current_shot_damage_by_attr.clear()

func _handle_meta_phase() -> void:
	"""处理元菜单阶段"""
	print("Entering META phase")
	if ui_manager:
		ui_manager.show_meta_menu()

func _handle_selection_phase() -> void:
	"""处理遗物选择阶段"""
	print("Entering SELECTION phase")
	if ui_manager:
		ui_manager.show_relic_selection()

func _handle_gathering_phase() -> void:
	"""处理弹珠台阶段"""
	print("Entering GATHERING phase")
	_init_pachinko()

func _handle_combat_phase() -> void:
	"""处理战斗阶段"""
	print("Entering COMBAT phase")
	_start_combat_phase()

func _handle_gameover_phase() -> void:
	"""处理游戏结束阶段"""
	print("Entering GAMEOVER phase")
	if ui_manager:
		ui_manager.show_game_over()

func _update_phase_ui(phase: String) -> void:
	"""
	更新 UI 显示
	
	Args:
		phase: 当前阶段
	"""
	if ui_manager:
		ui_manager.update_phase_ui(phase)

# ============ 弹珠台初始化 ============

func _init_pachinko() -> void:
	"""初始化弹珠台"""
	pegs.clear()
	drop_balls.clear()
	special_slots.clear()
	
	_generate_peg_grid()
	_assign_attribute_pegs()
	_init_slots()

func _generate_peg_grid() -> void:
	"""生成钉子网格"""
	var rows: int = 8
	var cols: int = 7
	var start_y: float = 100.0
	var spacing: float = 50.0
	
	for row in range(rows):
		var offset: float = float(row % 2) * (spacing / 2.0)
		for col in range(cols):
			var x: float = 50.0 + col * spacing + offset
			var y: float = start_y + row * spacing
			var peg = PegData.new(x, y, "normal")
			pegs.append(peg)

func _assign_attribute_pegs() -> void:
	"""随机分配属性钉子"""
	var attr_types: Array = ["bounce", "pierce", "scatter", "cryo", "pyro", "lightning"]
	var assigned: int = 0
	var max_assignments: int = 10
	
	while assigned < max_assignments and pegs.size() > 0:
		var random_index: int = randi() % pegs.size()
		var random_peg: PegData = pegs[random_index]
		
		if random_peg.type == "normal":
			random_peg.type = attr_types[randi() % attr_types.size()]
			assigned += 1

func _init_slots() -> void:
	"""生成底部槽位"""
	var slot_width: float = 60.0
	var slot_y: float = game_height - 30.0
	var slot_types: Array = ["recall", "multicast", "split", "wheel"]
	
	for i in range(slot_types.size()):
		var x: float = 50.0 + i * (slot_width + 20.0)
		var slot = SpecialSlotData.new(x, slot_y, slot_width, slot_types[i])
		special_slots.append(slot)

# ============ 战斗阶段初始化 ============

func _start_combat_phase() -> void:
	"""启动战斗阶段"""
	_compile_ammo_queue()
	_spawn_enemy_wave()
	_reset_combat_stats()

func _compile_ammo_queue() -> void:
	"""编译弹药队列"""
	ammo_queue.clear()
	
	for marble in marble_queue:
		var ammo = _create_ammo_from_marble(marble)
		ammo_queue.append(ammo)

func _create_ammo_from_marble(marble: Dictionary) -> Dictionary:
	"""
	从弹珠创建弹药
	
	Args:
		marble: 弹珠数据
	
	Returns:
		弹药数据字典
	"""
	var collected: Array = marble.get("collected", [])
	var damage_count: int = collected.filter(func(a): return a == "damage").size()
	
	var ammo = {
		"damage": 10 + (damage_count * 5),
		"bounce": collected.filter(func(a): return a == "bounce").size(),
		"pierce": collected.filter(func(a): return a == "pierce").size(),
		"scatter": collected.filter(func(a): return a == "scatter").size(),
		"cryo": collected.filter(func(a): return a == "cryo").size(),
		"pyro": collected.filter(func(a): return a == "pyro").size(),
		"lightning": collected.filter(func(a): return a == "lightning").size(),
	}
	
	return ammo

func _spawn_enemy_wave() -> void:
	"""生成敌人波次"""
	# 这里应该调用敌人生成系统
	print("Spawning enemy wave")

func _reset_combat_stats() -> void:
	"""重置战斗统计"""
	round_damage = 0
	current_shot_damage = 0
	current_shot_damage_by_attr.clear()

# ============ 更新循环 ============

func _process(delta: float) -> void:
	"""
	主更新循环
	
	Args:
		delta: 帧时间差
	"""
	if current_phase == PHASE_GATHERING:
		_update_gathering_phase(delta)

func _update_gathering_phase(delta: float) -> void:
	"""
	更新弹珠台阶段
	
	Args:
		delta: 帧时间差
	"""
	# 更新弹珠
	for ball in drop_balls:
		if ball.has_method("update"):
			var result = ball.update(pegs, special_slots, game_width, game_height, time_scale, 0.0)
			
			if result == "finished":
				# 弹珠收集完成
				marble_queue.append(ball.get_data())
	
	# 清理无效弹珠
	drop_balls = drop_balls.filter(func(b): return b.is_active())
	
	# 检查是否所有弹珠都已落下
	if drop_balls.is_empty() and marbles_pool.is_empty():
		switch_phase(PHASE_COMBAT)

# ============ 公共接口 ============

func get_current_phase() -> String:
	"""获取当前阶段"""
	return current_phase

func is_in_phase(phase: String) -> bool:
	"""检查是否在指定阶段"""
	return current_phase == phase

func add_marble_to_pool(marble: Dictionary) -> void:
	"""添加弹珠到池"""
	marbles_pool.append(marble)

func get_marble_queue() -> Array:
	"""获取弹珠队列"""
	return marble_queue.duplicate()

func get_ammo_queue() -> Array:
	"""获取弹药队列"""
	return ammo_queue.duplicate()

func set_ui_manager(manager: Node) -> void:
	"""设置 UI 管理器"""
	ui_manager = manager

func set_gathering_scene(scene: Node) -> void:
	"""设置弹珠台场景"""
	gathering_scene = scene

func set_combat_scene(scene: Node) -> void:
	"""设置战斗场景"""
	combat_scene = scene


# ============ 辅助数据类 ============

class PegData:
	"""钉子数据"""
	var x: float
	var y: float
	var type: String
	
	func _init(p_x: float, p_y: float, p_type: String) -> void:
		x = p_x
		y = p_y
		type = p_type


class SpecialSlotData:
	"""特殊槽位数据"""
	var x: float
	var y: float
	var width: float
	var slot_type: String
	
	func _init(p_x: float, p_y: float, p_width: float, p_type: String) -> void:
		x = p_x
		y = p_y
		width = p_width
		slot_type = p_type