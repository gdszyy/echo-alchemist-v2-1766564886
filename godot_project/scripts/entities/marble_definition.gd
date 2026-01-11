# marble_definition.gd
# 彈珠定义类 - 对应 JavaScript 中的 MarbleDefinition 类
# 用于定义和管理彈珠的属性、配置和状态

class_name MarbleDefinition

## 彈珠类型
var type: String

## 已收集的属性列表
var collected: Array[String]

## 是否已编译
var compiled: bool

## 配方信息
var recipe: Variant

## 会话信息
var session: Variant

## 配置引用（假设在全局 CONFIG 中）
var config: Dictionary


## 初始化彈珠定义
## 参数:
##   - p_type: 彈珠类型（如 'pyro', 'cryo', 'rainbow' 等）
##   - p_config: 配置字典（包含 UI 和颜色配置）
func _init(p_type: String, p_config: Dictionary = {}) -> void:
	type = p_type
	collected = []
	compiled = false
	recipe = null
	session = null
	config = p_config
	
	# 如果是 pyro 或 cryo 类型，自动添加到已收集列表
	if type == "pyro" or type == "cryo":
		collected.append(type)


## 获取彈珠的显示名称
## 返回: 彈珠的本地化名称（如 "火焰彈珠"）
func get_name() -> String:
	# 从配置中获取属性显示信息
	if config.is_empty():
		return "未知彈珠"
	
	var attribute_display = config.get("ui", {}).get("attributeDisplay", {})
	var display = attribute_display.get(type, {})
	
	if display.has("name"):
		return display.get("name", "") + "彈珠"
	
	return "未知彈珠"


## 获取彈珠的颜色
## 返回: Color 对象
func get_color() -> Color:
	# 彩虹彈珠返回特殊颜色
	if type == "rainbow":
		if config.is_empty():
			return Color.WHITE
		var marble_rainbow = config.get("colors", {}).get("marbleRainbow", Color.WHITE)
		if marble_rainbow is Color:
			return marble_rainbow
		elif marble_rainbow is String:
			return CalcUtils.hex_to_color(marble_rainbow)
		return Color.WHITE
	
	# 从配置中获取属性颜色
	if config.is_empty():
		return Color.WHITE
	
	var attribute_display = config.get("ui", {}).get("attributeDisplay", {})
	var display = attribute_display.get(type, {})
	
	if display.has("color"):
		var color = display.get("color")
		if color is Color:
			return color
		elif color is String:
			return CalcUtils.hex_to_color(color)
	
	# 默认白色
	var marble_white = config.get("colors", {}).get("marbleWhite", Color.WHITE)
	if marble_white is Color:
		return marble_white
	elif marble_white is String:
		return CalcUtils.hex_to_color(marble_white)
	
	return Color.WHITE


## 获取彈珠是否已收集特定属性
## 参数:
##   - attribute: 属性类型
## 返回: 是否已收集
func has_collected(attribute: String) -> bool:
	return attribute in collected


## 添加已收集的属性
## 参数:
##   - attribute: 属性类型
func add_collected(attribute: String) -> void:
	if attribute not in collected:
		collected.append(attribute)


## 清空已收集的属性
func clear_collected() -> void:
	collected.clear()


## 获取已收集属性的数量
## 返回: 属性数量
func get_collected_count() -> int:
	return collected.size()


## 转换为字符串表示
## 返回: 字符串表示
func _to_string() -> String:
	return "MarbleDefinition(type=%s, collected=%s, compiled=%s)" % [type, collected, compiled]
