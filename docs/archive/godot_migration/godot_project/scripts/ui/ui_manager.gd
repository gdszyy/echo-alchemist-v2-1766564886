extends CanvasLayer
## UI 管理器 - 处理所有阶段的 UI 显示

class_name UIManager

# 场景引用
var meta_menu: Control = null
var selection_menu: Control = null
var gathering_ui: Control = null
var combat_ui: Control = null
var gameover_ui: Control = null

# 阶段标签
var phase_label: Label = null

# 信号
signal menu_closed()
signal selection_complete(relic: String)

func _ready() -> void:
	"""初始化 UI 管理器"""
	_create_ui_elements()
	print("UIManager initialized")

func _create_ui_elements() -> void:
	"""创建 UI 元素"""
	# 创建阶段标签
	phase_label = Label.new()
	phase_label.text = "PHASE: META"
	phase_label.add_theme_font_size_override("font_size", 24)
	add_child(phase_label)

func show_meta_menu() -> void:
	"""显示元菜单"""
	print("Showing META menu")
	_hide_all_ui()
	
	if meta_menu == null:
		meta_menu = _create_meta_menu()
	
	meta_menu.show()

func show_relic_selection() -> void:
	"""显示遗物选择界面"""
	print("Showing SELECTION menu")
	_hide_all_ui()
	
	if selection_menu == null:
		selection_menu = _create_selection_menu()
	
	selection_menu.show()

func show_gathering_ui() -> void:
	"""显示弹珠台 UI"""
	print("Showing GATHERING UI")
	_hide_all_ui()
	
	if gathering_ui == null:
		gathering_ui = _create_gathering_ui()
	
	gathering_ui.show()

func show_combat_ui() -> void:
	"""显示战斗 UI"""
	print("Showing COMBAT UI")
	_hide_all_ui()
	
	if combat_ui == null:
		combat_ui = _create_combat_ui()
	
	combat_ui.show()

func show_game_over() -> void:
	"""显示游戏结束界面"""
	print("Showing GAMEOVER UI")
	_hide_all_ui()
	
	if gameover_ui == null:
		gameover_ui = _create_gameover_ui()
	
	gameover_ui.show()

func update_phase_ui(phase: String) -> void:
	"""
	更新阶段 UI 显示
	
	Args:
		phase: 当前阶段
	"""
	if phase_label:
		phase_label.text = "PHASE: %s" % phase.to_upper()

func _hide_all_ui() -> void:
	"""隐藏所有 UI"""
	if meta_menu and meta_menu.is_visible():
		meta_menu.hide()
	if selection_menu and selection_menu.is_visible():
		selection_menu.hide()
	if gathering_ui and gathering_ui.is_visible():
		gathering_ui.hide()
	if combat_ui and combat_ui.is_visible():
		combat_ui.hide()
	if gameover_ui and gameover_ui.is_visible():
		gameover_ui.hide()

func _create_meta_menu() -> Control:
	"""创建元菜单"""
	var menu = PanelContainer.new()
	menu.custom_minimum_size = Vector2(400, 300)
	menu.position = Vector2(200, 150)
	
	var vbox = VBoxContainer.new()
	
	var title = Label.new()
	title.text = "GAME MENU"
	title.add_theme_font_size_override("font_size", 32)
	vbox.add_child(title)
	
	var start_btn = Button.new()
	start_btn.text = "Start Game"
	start_btn.pressed.connect(_on_meta_start_pressed)
	vbox.add_child(start_btn)
	
	var quit_btn = Button.new()
	quit_btn.text = "Quit"
	quit_btn.pressed.connect(_on_quit_pressed)
	vbox.add_child(quit_btn)
	
	menu.add_child(vbox)
	add_child(menu)
	
	return menu

func _create_selection_menu() -> Control:
	"""创建遗物选择菜单"""
	var menu = PanelContainer.new()
	menu.custom_minimum_size = Vector2(600, 400)
	menu.position = Vector2(100, 100)
	
	var vbox = VBoxContainer.new()
	
	var title = Label.new()
	title.text = "SELECT RELIC"
	title.add_theme_font_size_override("font_size", 28)
	vbox.add_child(title)
	
	var hbox = HBoxContainer.new()
	
	var relics = ["Relic A", "Relic B", "Relic C"]
	for relic in relics:
		var btn = Button.new()
		btn.text = relic
		btn.pressed.connect(_on_relic_selected.bindv([relic]))
		hbox.add_child(btn)
	
	vbox.add_child(hbox)
	menu.add_child(vbox)
	add_child(menu)
	
	return menu

func _create_gathering_ui() -> Control:
	"""创建弹珠台 UI"""
	var ui = Control.new()
	ui.custom_minimum_size = Vector2(800, 600)
	
	var score_label = Label.new()
	score_label.text = "Marbles: 0"
	score_label.position = Vector2(10, 10)
	score_label.add_theme_font_size_override("font_size", 20)
	ui.add_child(score_label)
	
	add_child(ui)
	return ui

func _create_combat_ui() -> Control:
	"""创建战斗 UI"""
	var ui = Control.new()
	ui.custom_minimum_size = Vector2(800, 600)
	
	var hp_label = Label.new()
	hp_label.text = "Enemy HP: 100"
	hp_label.position = Vector2(10, 10)
	hp_label.add_theme_font_size_override("font_size", 20)
	ui.add_child(hp_label)
	
	add_child(ui)
	return ui

func _create_gameover_ui() -> Control:
	"""创建游戏结束 UI"""
	var menu = PanelContainer.new()
	menu.custom_minimum_size = Vector2(400, 300)
	menu.position = Vector2(200, 150)
	
	var vbox = VBoxContainer.new()
	
	var title = Label.new()
	title.text = "GAME OVER"
	title.add_theme_font_size_override("font_size", 32)
	vbox.add_child(title)
	
	var score_label = Label.new()
	score_label.text = "Final Score: 0"
	score_label.add_theme_font_size_override("font_size", 24)
	vbox.add_child(score_label)
	
	var restart_btn = Button.new()
	restart_btn.text = "Restart"
	restart_btn.pressed.connect(_on_restart_pressed)
	vbox.add_child(restart_btn)
	
	menu.add_child(vbox)
	add_child(menu)
	
	return menu

func _on_meta_start_pressed() -> void:
	"""元菜单开始按钮回调"""
	menu_closed.emit()

func _on_relic_selected(relic: String) -> void:
	"""遗物选择回调"""
	selection_complete.emit(relic)

func _on_restart_pressed() -> void:
	"""重启按钮回调"""
	menu_closed.emit()

func _on_quit_pressed() -> void:
	"""退出按钮回调"""
	get_tree().quit()