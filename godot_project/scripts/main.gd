extends Node
## 主场景控制器

@onready var scene_container: Node = $SceneContainer

func _ready() -> void:
	# 确保场景容器存在
	if not scene_container:
		scene_container = Node.new()
		scene_container.name = "SceneContainer"
		add_child(scene_container)
	
	# 初始加载主菜单
	load_initial_scene()

func load_initial_scene() -> void:
	var meta_menu_scene = load("res://scenes/ui/meta_menu.tscn")
	if meta_menu_scene:
		var meta_menu = meta_menu_scene.instantiate()
		scene_container.add_child(meta_menu)
		
		# 连接信号
		if meta_menu.has_signal("start_game_requested"):
			meta_menu.start_game_requested.connect(_on_start_game)

func switch_scene(new_scene_path: String) -> void:
	# 清理旧场景
	for child in scene_container.get_children():
		child.queue_free()
	
	# 加载新场景
	var new_scene_resource = load(new_scene_path)
	if new_scene_resource:
		var new_scene = new_scene_resource.instantiate()
		scene_container.add_child(new_scene)

func _on_start_game() -> void:
	switch_scene("res://scenes/game/game.tscn")
