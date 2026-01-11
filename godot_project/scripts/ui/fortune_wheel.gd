# 命运轮盘 - 豪华转盘抽奖系统
# 从 JavaScript entities.js 中的 FortuneWheel 类迁移

extends Node2D

class_name FortuneWheel

# 信号
signal spin_finished(reward_type: String, reward_count: int)
signal spin_started

# 状态
var active: bool = false
var spinning: bool = false
var stopping: bool = false

# 物理参数
var wheel_radius: float = 120.0
var wheel_angle: float = 0.0
var velocity: float = 0.0
var friction: float = 0.977

# 扇区数据
var slices: Array = []

# 屏幕尺寸（用于绘制遮罩）
var screen_width: float = 800.0
var screen_height: float = 600.0

# 属性显示配置
var attribute_display: Dictionary = {
	"damage": { "color": Color(0.94, 0.27, 0.27, 1.0), "icon": "⚔️" },
	"cryo": { "color": Color(0.53, 0.81, 0.92, 1.0), "icon": "❄️" },
	"pyro": { "color": Color(0.97, 0.45, 0.09, 1.0), "icon": "🔥" },
	"lightning": { "color": Color(0.75, 0.5, 1.0, 1.0), "icon": "⚡" },
	"laser": { "color": Color(0.05, 0.65, 0.91, 1.0), "icon": "💠" },
	"wind": { "color": Color(0.2, 0.83, 0.6, 1.0), "icon": "🌀" },
	"resonance": { "color": Color(0.96, 0.25, 0.37, 1.0), "icon": "💫" },
	"explosive": { "color": Color(0.97, 0.44, 0.44, 1.0), "icon": "💥" },
	"bounce": { "color": Color(0.13, 0.82, 0.38, 1.0), "icon": "🔄" },
	"pierce": { "color": Color(0.39, 0.4, 0.95, 1.0), "icon": "🔱" },
	"scatter": { "color": Color(0.98, 0.75, 0.14, 1.0), "icon": "✨" }
}

# 基础概率配置
var probabilities: Dictionary = {
	"damage": 1.0,
	"cryo": 1.0,
	"pyro": 1.0,
	"lightning": 1.0,
	"laser": 0.8,
	"wind": 0.8,
	"resonance": 0.6,
	"explosive": 0.7,
	"bounce": 1.0,
	"pierce": 1.0,
	"scatter": 1.0
}

# 可叠加属性类型
var stackable_types: Array[String] = [
	"bounce", "pierce", "scatter", "damage", "cryo", "pyro", 
	"lightning", "laser", "wind", "resonance", "explosive"
]


func _ready() -> void:
	"""初始化命运轮盘"""
	pass


func _process(delta: float) -> void:
	"""每帧更新轮盘"""
	if not active:
		return
	
	if spinning:
		var time_scale = delta * 60.0
		
		# 更新角度
		wheel_angle += velocity * time_scale
		wheel_angle = fmod(wheel_angle, TAU)
		
		if stopping:
			# 应用摩擦力减速
			velocity *= pow(friction, time_scale)
			
			if velocity < 0.001:
				velocity = 0.0
				spinning = false
				_finalize_result()
		else:
			# 开始减速
			stopping = true
		
		queue_redraw()


func _draw() -> void:
	"""绘制命运轮盘"""
	if not active:
		return
	
	# 绘制半透明黑色背景遮罩
	draw_rect(Rect2(-screen_width / 2.0, -screen_height / 2.0, screen_width, screen_height), 
			  Color(0, 0, 0, 0.7))
	
	# --- 0. 外发光 ---
	# Godot 中使用 CanvasItem 的 modulate 或 shader 实现
	
	# --- 1. 绘制豪华外框 (Rim) ---
	_draw_rim()
	
	# --- 2. 跑马灯灯泡 ---
	_draw_lights()
	
	# --- 3. 绘制盘面 (旋转部分) ---
	_draw_wheel_face()
	
	# --- 4. 绘制中心装饰 ---
	_draw_center_hub()
	
	# --- 5. 绘制指针 ---
	_draw_pointer()


func _draw_rim() -> void:
	"""绘制豪华外框"""
	# 外圈渐变（简化为纯色）
	draw_circle(Vector2.ZERO, wheel_radius + 12.0, Color(0.96, 0.62, 0.04, 1.0))  # Amber-500
	
	# 内圈深色底
	draw_circle(Vector2.ZERO, wheel_radius + 2.0, Color(0.27, 0.1, 0.01, 1.0))  # 深褐色


func _draw_lights() -> void:
	"""绘制跑马灯灯泡"""
	var light_count = 12
	var time = Time.get_ticks_msec()
	
	for i in range(light_count):
		var la = float(i) / light_count * TAU
		var lx = cos(la) * (wheel_radius + 7.0)
		var ly = sin(la) * (wheel_radius + 7.0)
		
		# 灯泡闪烁逻辑
		var is_on = floori(time / 100.0) % light_count == i
		
		var light_color = Color.WHITE if is_on else Color(0.47, 0.21, 0.06, 1.0)
		draw_circle(Vector2(lx, ly), 3.0, light_color)


func _draw_wheel_face() -> void:
	"""绘制盘面（旋转部分）"""
	var active_slice = _get_current_slice() if stopping else null
	
	for s in slices:
		var is_highlighted = (active_slice == s)
		
		# 绘制扇形
		var points = _create_arc_polygon(wheel_radius, s.start_angle + wheel_angle, s.end_angle + wheel_angle)
		draw_colored_polygon(points, s.color)
		
		# 高亮叠加层
		if is_highlighted and velocity < 0.1:
			draw_colored_polygon(points, Color(0, 0, 0, 0.3))
		
		# 绘制图标和文字
		var mid_angle = s.start_angle + (s.end_angle - s.start_angle) / 2.0 + wheel_angle
		var icon_dist = wheel_radius * 0.65
		var ix = cos(mid_angle) * icon_dist
		var iy = sin(mid_angle) * icon_dist
		
		# 获取默认字体
		var font = ThemeDB.fallback_font
		
		# 绘制图标
		var icon_pos = Vector2(ix, iy)
		draw_string(font, icon_pos + Vector2(-12, 8), s.icon, HORIZONTAL_ALIGNMENT_CENTER, -1, 24, Color.WHITE)
		
		# 如果扇区足够大，显示数量
		if (s.end_angle - s.start_angle) > 0.4:
			draw_string(font, icon_pos + Vector2(-12, 24), "x" + str(s.count), HORIZONTAL_ALIGNMENT_CENTER, -1, 12, Color.WHITE)


func _draw_center_hub() -> void:
	"""绘制中心装饰"""
	# 外圈
	draw_circle(Vector2.ZERO, 18.0, Color(0.96, 0.62, 0.04, 1.0))
	# 内圈
	draw_circle(Vector2.ZERO, 12.0, Color.WHITE)
	# 星星
	var font = ThemeDB.fallback_font
	draw_string(font, Vector2(-8, 6), "★", HORIZONTAL_ALIGNMENT_CENTER, -1, 16, Color(0.96, 0.62, 0.04, 1.0))


func _draw_pointer() -> void:
	"""绘制指针"""
	var pointer_y = -wheel_radius - 5.0
	
	# 指针三角形
	var points = PackedVector2Array()
	points.append(Vector2(-10, pointer_y - 5))
	points.append(Vector2(10, pointer_y - 5))
	points.append(Vector2(0, pointer_y + 15))
	
	draw_colored_polygon(points, Color(0.94, 0.27, 0.27, 1.0))  # 红色
	
	# 指针铆钉
	draw_circle(Vector2(0, pointer_y - 2), 4.0, Color(0.5, 0.11, 0.11, 1.0))


func _create_arc_polygon(radius: float, start_angle: float, end_angle: float) -> PackedVector2Array:
	"""创建扇形多边形"""
	var points = PackedVector2Array()
	points.append(Vector2.ZERO)
	
	var segments = 16
	for i in range(segments + 1):
		var t = float(i) / segments
		var angle = lerp(start_angle, end_angle, t)
		points.append(Vector2(cos(angle) * radius, sin(angle) * radius))
	
	return points


func _get_current_slice() -> Dictionary:
	"""获取当前指针指向的扇区"""
	var rel_angle = (-PI / 2.0) - wheel_angle
	rel_angle = fmod(rel_angle, TAU)
	if rel_angle < 0:
		rel_angle += TAU
	
	for s in slices:
		if rel_angle >= s.start_angle and rel_angle < s.end_angle:
			return s
	
	return {}


func _finalize_result() -> void:
	"""确定最终结果"""
	var winner = _get_current_slice()
	if not winner.is_empty():
		spin_finished.emit(winner.type, winner.reward_count)
	
	# 延迟关闭
	await get_tree().create_timer(1.5).timeout
	active = false
	queue_redraw()


# ==================== 公共方法 ====================

func spin(x: float, y: float, collected_attributes: Array, callback: Callable = Callable()) -> void:
	"""启动轮盘旋转
	
	Args:
		x: 轮盘中心 X 坐标
		y: 轮盘中心 Y 坐标
		collected_attributes: 收集的属性数组
		callback: 完成回调（可选，推荐使用信号）
	"""
	position = Vector2(x, y)
	active = true
	spinning = true
	stopping = false
	velocity = 0.4 + randf() * 0.2
	wheel_angle = 0.0
	
	# 连接回调到信号
	if callback.is_valid():
		if not spin_finished.is_connected(callback):
			spin_finished.connect(callback, CONNECT_ONE_SHOT)
	
	# 构建扇区
	_build_slices(collected_attributes)
	
	spin_started.emit()
	queue_redraw()


func _build_slices(collected_attributes: Array) -> void:
	"""构建扇区"""
	slices.clear()
	
	# 统计可叠加属性
	var counts: Dictionary = {}
	for item in collected_attributes:
		var attr_type: String
		if item is String:
			attr_type = item
		elif item is Dictionary:
			attr_type = item.get("type", "")
		else:
			continue
		
		if attr_type in stackable_types and attribute_display.has(attr_type):
			counts[attr_type] = counts.get(attr_type, 0) + 1
	
	var valid_types = counts.keys()
	
	# 计算权重
	var weights: Dictionary = {}
	var total_weight: float = 0.0
	
	for attr_type in valid_types:
		var base_prob = probabilities.get(attr_type, 1.0)
		var weight = base_prob * (1.0 + counts[attr_type] * 0.5)
		weights[attr_type] = weight
		total_weight += weight
	
	# 保底：如果没有有效属性，加入 damage
	if total_weight == 0:
		var fallback_type = "damage"
		weights[fallback_type] = 1.0
		total_weight = 1.0
		valid_types.append(fallback_type)
		counts[fallback_type] = 0
	
	# 构建扇区
	var current_angle: float = 0.0
	for attr_type in weights.keys():
		var arc = (weights[attr_type] / total_weight) * TAU
		var display = attribute_display.get(attr_type, { "color": Color.GRAY, "icon": "❓" })
		
		# 动态奖励算法
		var reward_count = maxi(1, ceili(counts.get(attr_type, 0) * 0.5))
		
		slices.append({
			"type": attr_type,
			"start_angle": current_angle,
			"end_angle": current_angle + arc,
			"color": display.color,
			"icon": display.icon,
			"reward_count": reward_count,
			"count": reward_count
		})
		
		current_angle += arc


func set_screen_size(width: float, height: float) -> void:
	"""设置屏幕尺寸"""
	screen_width = width
	screen_height = height


func set_radius(radius: float) -> void:
	"""设置轮盘半径"""
	wheel_radius = radius


func is_active() -> bool:
	"""检查轮盘是否激活"""
	return active


func is_spinning() -> bool:
	"""检查轮盘是否正在旋转"""
	return spinning
