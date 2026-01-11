extends Node
## 游戏主管理器 - 协调所有系统和场景

class_name GameManager

# 系统引用
var phase_manager: PhaseManager = null
var ui_manager: UIManager = null

# 场景引用
var gathering_scene: Node = null
var combat_scene: Node = null

# 游戏配置
var game_config: Dictionary = {
	"width": 800,
	"height": 600,
	"initial_phase": "meta",
	"time_scale": 1.0,
}

func _ready() -> void:
	"""初始化游戏管理器"""
	_setup_systems()
	_connect_signals()
	_initialize_game()
	print("GameManager initialized")

func _setup_systems() -> void:
	"""设置游戏系统"""
	# 创建阶段管理器
	phase_manager = PhaseManager.new()
	phase_manager.game_width = game_config["width"]
	phase_manager.game_height = game_config["height"]
	phase_manager.time_scale = game_config["time_scale"]
	add_child(phase_manager)
	
	# 创建 UI 管理器
	ui_manager = UIManager.new()
	add_child(ui_manager)
	
	# 设置关联
	phase_manager.set_ui_manager(ui_manager)

func _connect_signals() -> void:
	"""连接信号"""
	if phase_manager:
		phase_manager.phase_changed.connect(_on_phase_changed)
		phase_manager.phase_entered.connect(_on_phase_entered)
		phase_manager.phase_exited.connect(_on_phase_exited)
	
	if ui_manager:
		ui_manager.menu_closed.connect(_on_menu_closed)
		ui_manager.selection_complete.connect(_on_selection_complete)

func _initialize_game() -> void:
	"""初始化游戏"""
	if phase_manager:
		phase_manager.switch_phase(game_config["initial_phase"])

func _on_phase_changed(old_phase: String, new_phase: String) -> void:
	"""
	阶段改变回调
	
	Args:
		old_phase: 旧阶段
		new_phase: 新阶段
	"""
	print("Game phase changed: %s -> %s" % [old_phase, new_phase])
	
	match new_phase:
		"gathering":
			_load_gathering_scene()
		"combat":
			_load_combat_scene()

func _on_phase_entered(phase: String) -> void:
	"""
	阶段进入回调
	
	Args:
		phase: 进入的阶段
	"""
	print("Entered phase: %s" % phase)

func _on_phase_exited(phase: String) -> void:
	"""
	阶段退出回调
	
	Args:
		phase: 退出的阶段
	"""
	print("Exited phase: %s" % phase)

func _on_menu_closed() -> void:
	"""菜单关闭回调"""
	if phase_manager:
		if phase_manager.get_current_phase() == "meta":
			phase_manager.switch_phase("selection")
		elif phase_manager.get_current_phase() == "gameover":
			phase_manager.switch_phase("meta")

func _on_selection_complete(relic: String) -> void:
	"""
	遗物选择完成回调
	
	Args:
		relic: 选择的遗物
	"""
	print("Relic selected: %s" % relic)
	if phase_manager:
		phase_manager.switch_phase("gathering")

func _load_gathering_scene() -> void:
	"""加载弹珠台场景"""
	if gathering_scene == null:
		gathering_scene = GatheringScene.new()
		gathering_scene.set_phase_manager(phase_manager)
		add_child(gathering_scene)
	
	gathering_scene.show()

func _load_combat_scene() -> void:
	"""加载战斗场景"""
	if combat_scene == null:
		combat_scene = CombatScene.new()
		combat_scene.set_phase_manager(phase_manager)
		add_child(combat_scene)
	
	combat_scene.show()

func get_phase_manager() -> PhaseManager:
	"""获取阶段管理器"""
	return phase_manager

func get_ui_manager() -> UIManager:
	"""获取 UI 管理器"""
	return ui_manager

func set_game_config(config: Dictionary) -> void:
	"""
	设置游戏配置
	
	Args:
		config: 配置字典
	"""
	game_config.merge(config)
	
	if phase_manager:
		phase_manager.game_width = game_config["width"]
		phase_manager.game_height = game_config["height"]
		phase_manager.time_scale = game_config["time_scale"]