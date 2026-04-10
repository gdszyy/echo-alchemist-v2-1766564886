extends Node

## 游戏配置单例
## 注意：不使用 class_name 避免与自动加载冲突

## 游戏资源定义类（重命名避免与 Godot Resource 冲突）
class GameResource:
	var id: String
	var res_name: String
	var icon: String
	var color: String
	
	func _init(p_id: String, p_name: String, p_icon: String, p_color: String) -> void:
		id = p_id
		res_name = p_name
		icon = p_icon
		color = p_color

## 成本定义类
class Cost:
	var resource_id: String
	var base: int
	var growth: float
	var cost_type: String  # "exponential", "linear", etc.
	
	func _init(p_resource_id: String, p_base: int, p_growth: float, p_type: String) -> void:
		resource_id = p_resource_id
		base = p_base
		growth = p_growth
		cost_type = p_type

## 效果定义类
class Effect:
	var path: String
	var value_per_level: int
	var effect_type: String  # "add", "multiply", etc.
	
	func _init(p_path: String, p_value_per_level: int, p_type: String) -> void:
		path = p_path
		value_per_level = p_value_per_level
		effect_type = p_type

## 升级项定义类
class Upgrade:
	var id: String
	var category: String
	var upgrade_name: String
	var desc: String
	var icon: String
	var max_level: int
	var cost: Cost
	var effect: Effect
	
	func _init(
		p_id: String,
		p_category: String,
		p_name: String,
		p_desc: String,
		p_icon: String,
		p_max_level: int,
		p_cost: Cost,
		p_effect: Effect
	) -> void:
		id = p_id
		category = p_category
		upgrade_name = p_name
		desc = p_desc
		icon = p_icon
		max_level = p_max_level
		cost = p_cost
		effect = p_effect

## 属性显示配置类
class AttributeDisplay:
	var display_name: String
	var icon: String
	var color: Color
	
	func _init(p_name: String, p_icon: String, p_color: Color) -> void:
		display_name = p_name
		icon = p_icon
		color = p_color

# ============================================================================
# META SHOP 配置
# ============================================================================

var meta_shop_config: Dictionary = {}

func _ready() -> void:
	_init_meta_shop_config()

func _init_meta_shop_config() -> void:
	# 资源定义
	var resources: Dictionary = {
		"energy_essence": GameResource.new(
			"energy_essence",
			"能量精粹",
			"✨",
			"#fbbf24"
		)
	}
	
	# 升级项定义
	var upgrades: Array = [
		Upgrade.new(
			"init_weight_bounce",
			"attribute",
			"彈性增幅",
			"增加初始彈珠中 [反彈] 屬性的權重。",
			"🔄",
			10,
			Cost.new("energy_essence", 50, 1.4, "exponential"),
			Effect.new("probabilities.bounce", 10, "add")
		)
		# 更多升级项可在此添加
	]
	
	meta_shop_config = {
		"resources": resources,
		"upgrades": upgrades
	}

# ============================================================================
# 主配置
# ============================================================================

## UI 配置 - 属性显示
var ui_attribute_display: Dictionary = {}

## 颜色配置
var colors: Dictionary = {}

## 物理配置
var physics: Dictionary = {}

## 游戏玩法配置
var gameplay: Dictionary = {}

func _init() -> void:
	_init_ui_config()
	_init_colors_config()
	_init_physics_config()
	_init_gameplay_config()

func _init_ui_config() -> void:
	ui_attribute_display = {
		"bounce": AttributeDisplay.new("彈性", "⤴️", Color("#22c55e")),
		"pierce": AttributeDisplay.new("穿透", "↗️", Color("#ef4444")),
		"scatter": AttributeDisplay.new("散射", "🔱", Color("#facc15")),
		"damage": AttributeDisplay.new("增幅", "⚔️", Color("#a855f7")),
		"cryo": AttributeDisplay.new("冰霜", "❄️", Color("#06b6d4")),
		"pyro": AttributeDisplay.new("火焰", "🔥", Color("#f97316")),
		"lightning": AttributeDisplay.new("閃電", "⚡", Color("#c084fc")),
		"laser": AttributeDisplay.new("光", "☄️", Color("#0ea5e9")),
		"wind": AttributeDisplay.new("風", "🌪️", Color("#34d399")),
	}

func _init_colors_config() -> void:
	colors = {
		"bg": Color("#0f172a"),
		"peg": Color("#475569"),
		"peg_active": Color("#cbd5e1"),
		"enemy": Color("#eeeeee"),
	}

func _init_physics_config() -> void:
	physics = {
		"gravity": 0.3,
		"friction": 0.99,
		"marble_radius": 8.0,
		"peg_radius": 10.0,
	}

func _init_gameplay_config() -> void:
	gameplay = {
		"rows": 4,
		"cols": 8,
		"start_rows": 3,
		"base_damage": 10,
		"max_skill_points": 3,
	}

# ============================================================================
# 便捷访问方法
# ============================================================================

## 获取资源配置
func get_resource(resource_id: String) -> GameResource:
	if meta_shop_config.has("resources") and meta_shop_config["resources"].has(resource_id):
		return meta_shop_config["resources"][resource_id]
	push_error("Resource not found: %s" % resource_id)
	return null

## 获取升级项配置
func get_upgrade(upgrade_id: String) -> Upgrade:
	if meta_shop_config.has("upgrades"):
		for upgrade in meta_shop_config["upgrades"]:
			if upgrade.id == upgrade_id:
				return upgrade
	push_error("Upgrade not found: %s" % upgrade_id)
	return null

## 获取所有升级项
func get_all_upgrades() -> Array:
	if meta_shop_config.has("upgrades"):
		return meta_shop_config["upgrades"]
	return []

## 获取属性显示配置
func get_attribute_display(attribute_id: String) -> AttributeDisplay:
	if ui_attribute_display.has(attribute_id):
		return ui_attribute_display[attribute_id]
	push_error("Attribute display not found: %s" % attribute_id)
	return null

## 获取颜色
func get_color(color_id: String) -> Color:
	if colors.has(color_id):
		return colors[color_id]
	push_error("Color not found: %s" % color_id)
	return Color.WHITE

## 获取物理参数
func get_physics_value(param_name: String) -> float:
	if physics.has(param_name):
		return physics[param_name]
	push_error("Physics parameter not found: %s" % param_name)
	return 0.0

## 获取游戏玩法参数
func get_gameplay_value(param_name: String) -> int:
	if gameplay.has(param_name):
		return gameplay[param_name]
	push_error("Gameplay parameter not found: %s" % param_name)
	return 0

## 场景切换方法（供 main.gd 调用）
func change_scene(scene_path: String) -> Node:
	var scene_resource = load(scene_path)
	if scene_resource:
		return scene_resource.instantiate()
	return null
