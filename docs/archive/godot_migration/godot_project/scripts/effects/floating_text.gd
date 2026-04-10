# 浮动文字特效类 - 向上飘动的文字
# 从 JavaScript entities.js 中的 FloatingText 类迁移

extends Node2D

class_name FloatingText

# 文字参数
var text: String = ""
var color: Color = Color(0.98, 0.75, 0.14, 1.0)  # 默认金色 #fbbf24
var font_size: int = 16

# 运动参数
var vel: Vector2 = Vector2(0, -1)  # 向上飘动

# 生命周期
var life: float = 1.0
var decay: float = 0.02


func _ready() -> void:
	"""初始化浮动文字特效"""
	pass


func _process(delta: float) -> void:
	"""每帧更新浮动文字特效"""
	var time_scale = delta * 60.0
	
	position += vel * time_scale
	life -= decay * time_scale
	
	if life <= 0:
		queue_free()
	else:
		queue_redraw()


func _draw() -> void:
	"""绘制浮动文字特效"""
	if life <= 0:
		return
	
	var alpha = maxf(0.0, life)
	
	# 获取默认字体
	var font = ThemeDB.fallback_font
	
	# 计算文字尺寸以居中
	var text_size = font.get_string_size(text, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size)
	var text_pos = Vector2(-text_size.x / 2.0, text_size.y / 4.0)
	
	# --- 1. 绘制描边 (黑色轮廓) ---
	var outline_color = Color(0, 0, 0, alpha * 0.8)
	var outline_offset = 1.5
	
	# 四个方向的描边
	draw_string(font, text_pos + Vector2(-outline_offset, 0), text, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, outline_color)
	draw_string(font, text_pos + Vector2(outline_offset, 0), text, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, outline_color)
	draw_string(font, text_pos + Vector2(0, -outline_offset), text, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, outline_color)
	draw_string(font, text_pos + Vector2(0, outline_offset), text, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, outline_color)
	
	# --- 2. 绘制填充 ---
	var fill_color = color
	fill_color.a = alpha
	draw_string(font, text_pos, text, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, fill_color)


# ==================== 设置方法 ====================

func setup(x: float, y: float, display_text: String, text_color: Color = Color(0.98, 0.75, 0.14, 1.0)) -> void:
	"""设置浮动文字特效参数"""
	position = Vector2(x, y)
	text = display_text
	color = text_color
	life = 1.0
	queue_redraw()


func set_velocity(new_vel: Vector2) -> void:
	"""设置运动速度"""
	vel = new_vel


func set_font_size(size: int) -> void:
	"""设置字体大小"""
	font_size = size
	queue_redraw()


func set_decay(new_decay: float) -> void:
	"""设置消散速度"""
	decay = new_decay
