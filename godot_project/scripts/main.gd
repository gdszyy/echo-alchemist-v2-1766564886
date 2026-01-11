extends Node

@onready var scene_container = $SceneContainer

func _ready():
	# 初始加载主菜单或游戏场景
	load_initial_scene()

func load_initial_scene():
	# 示例：加载元菜单
	var meta_menu = load("res://scenes/ui/meta_menu.tscn").instantiate()
	scene_container.add_child(meta_menu)

func switch_scene(new_scene_path: String):
	# 清理旧场景并加载新场景
	for child in scene_container.get_children():
		child.queue_free()
	
	var new_scene = GameManager.change_scene(new_scene_path)
	if new_scene:
		scene_container.add_child(new_scene)
