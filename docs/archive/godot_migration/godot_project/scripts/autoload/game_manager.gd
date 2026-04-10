extends Node

signal scene_changed(new_scene_name)
signal game_started
signal game_over(win: bool)

var current_scene = null

func _ready():
	# 初始化逻辑
	pass

func change_scene(scene_path: String):
	# 场景切换逻辑
	var scene_resource = load(scene_path)
	if scene_resource:
		var new_scene = scene_resource.instantiate()
		emit_signal("scene_changed", scene_path)
		return new_scene
	return null
