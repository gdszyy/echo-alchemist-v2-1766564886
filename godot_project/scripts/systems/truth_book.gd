# 真理之书系统 - 游戏内百科和演示系统
# 从 JavaScript systems.js 中的 TruthBook 类迁移

extends Control

class_name TruthBook

# 信号
signal entry_selected(entry: Dictionary)
signal demo_started(entry: Dictionary)
signal demo_reset
signal book_closed

# 游戏引用
var main_game: Node = null

# 状态
var active: bool = false
var current_entry: Dictionary = {}

# 演示控制
var instruction_idx: int = 0
var wait_timer: int = 0
var sim_frame: int = 0

# 视觉特效
var scan_line_y: float = 0.0
var grid_offset: float = 0.0

# 演示游戏状态
var demo_state: Dictionary = {
	"width": 600,
	"height": 800,
	"enemies": [],
	"projectiles": [],
	"particles": [],
	"floating_texts": [],
	"shockwaves": [],
	"lightning_bolts": [],
	"wind_anchors": [],
	"round_damage": 0
}

# 日志
var demo_logs: Array[Dictionary] = []
const MAX_LOGS: int = 6


func _ready() -> void:
	"""初始化真理之书"""
	visible = false


func _process(delta: float) -> void:
	"""每帧更新"""
	if not active:
		return
	
	update_demo()


# ==================== 公共方法 ====================

func open() -> void:
	"""打开真理之书"""
	active = true
	visible = true
	queue_redraw()


func close() -> void:
	"""关闭真理之书"""
	active = false
	visible = false
	book_closed.emit()


func setup(game: Node) -> void:
	"""设置游戏引用"""
	main_game = game


# ==================== 条目管理 ====================

func show_entry(entry: Dictionary) -> void:
	"""显示条目详情"""
	current_entry = entry
	entry_selected.emit(entry)
	start_demo(entry)


func get_current_entry() -> Dictionary:
	"""获取当前条目"""
	return current_entry


# ==================== 演示系统 ====================

func start_demo(entry: Dictionary) -> void:
	"""开始演示"""
	# 重置演示状态
	demo_state.enemies.clear()
	demo_state.projectiles.clear()
	demo_state.particles.clear()
	demo_state.floating_texts.clear()
	demo_state.shockwaves.clear()
	demo_state.lightning_bolts.clear()
	demo_state.wind_anchors.clear()
	demo_state.round_damage = 0
	
	# 设置敌人
	if entry.has("setup") and entry.setup.has("enemies"):
		for enemy_config in entry.setup.enemies:
			var enemy_data = {
				"x": enemy_config.x_ratio * demo_state.width,
				"y": enemy_config.y,
				"width": enemy_config.width,
				"height": enemy_config.height,
				"hp": enemy_config.hp,
				"max_hp": enemy_config.get("max_hp", enemy_config.hp),
				"current_hp": enemy_config.get("current_hp", enemy_config.hp),
				"temp": enemy_config.get("temp", 0),
				"affixes": enemy_config.get("affixes", []),
				"active": true
			}
			demo_state.enemies.append(enemy_data)
	
	# 重置控制变量
	instruction_idx = 0
	wait_timer = 0
	sim_frame = 0
	scan_line_y = 0.0
	
	# 清空日志
	demo_logs.clear()
	add_log("SIMULATION_INIT... OK", Color(0.2, 0.8, 0.4, 1.0))
	
	demo_started.emit(entry)
	queue_redraw()


func reset_demo() -> void:
	"""重置演示"""
	if not current_entry.is_empty():
		start_demo(current_entry)
		demo_reset.emit()


func update_demo() -> void:
	"""更新演示"""
	if current_entry.is_empty():
		return
	
	sim_frame += 1
	
	# 处理等待
	if wait_timer > 0:
		wait_timer -= 1
	else:
		# 执行指令
		if current_entry.has("loop") and current_entry.loop.size() > 0:
			var inst = current_entry.loop[instruction_idx]
			execute_instruction(inst)
			instruction_idx = (instruction_idx + 1) % current_entry.loop.size()
	
	# 更新敌人
	for enemy in demo_state.enemies:
		if enemy.active:
			update_demo_enemy(enemy)
	
	# 更新弹幕
	var active_projectiles: Array = []
	for proj in demo_state.projectiles:
		if proj.active:
			update_demo_projectile(proj)
			if proj.active:
				active_projectiles.append(proj)
	demo_state.projectiles = active_projectiles
	
	# 更新粒子
	var active_particles: Array = []
	for particle in demo_state.particles:
		particle.life -= 1
		if particle.life > 0:
			particle.y -= 0.5
			active_particles.append(particle)
	demo_state.particles = active_particles
	
	# 更新浮动文字
	var active_texts: Array = []
	for text in demo_state.floating_texts:
		text.life -= 1
		text.y -= 0.5
		if text.life > 0:
			active_texts.append(text)
	demo_state.floating_texts = active_texts
	
	# 更新冲击波
	var active_shockwaves: Array = []
	for sw in demo_state.shockwaves:
		sw.radius += 5.0
		sw.alpha -= 0.02
		if sw.alpha > 0:
			active_shockwaves.append(sw)
	demo_state.shockwaves = active_shockwaves
	
	# 更新闪电
	var active_bolts: Array = []
	for bolt in demo_state.lightning_bolts:
		bolt.life -= 1
		if bolt.life > 0:
			active_bolts.append(bolt)
	demo_state.lightning_bolts = active_bolts
	
	queue_redraw()


func execute_instruction(inst: Dictionary) -> void:
	"""执行演示指令"""
	if inst.is_empty():
		return
	
	match inst.type:
		"log":
			add_log(inst.text, Color(0.05, 0.71, 0.83, 1.0))
		
		"wait":
			wait_timer = inst.frames
		
		"enemy_turn":
			var target_idx = inst.get("target_idx", 0)
			if target_idx < demo_state.enemies.size():
				process_enemy_turn(demo_state.enemies[target_idx])
		
		"spawn_projectile":
			var px = inst.get("x", demo_state.width / 2.0)
			var py = inst.get("y", demo_state.height - 150.0)
			var vel = inst.get("vel", { "x": 0, "y": -15 })
			var config = inst.get("config", {})
			spawn_demo_projectile(px, py, vel, config)
		
		"reset":
			wait_timer = inst.get("delay", 60)
			add_log("--- RESET ---", Color(0.4, 0.4, 0.4, 1.0))
			start_demo(current_entry)


func spawn_demo_projectile(x: float, y: float, vel: Dictionary, config: Dictionary) -> void:
	"""生成演示弹幕"""
	# 处理散射
	if config.get("scatter", 0) > 0 and not config.get("_is_scatter_sub", false):
		var count = config.scatter
		var base_angle = atan2(vel.y, vel.x)
		var spread = PI / 4.0
		var speed = sqrt(vel.x * vel.x + vel.y * vel.y)
		
		for i in range(count):
			var angle = base_angle + (i - (count - 1) / 2.0) * (spread / count)
			var new_vel = { "x": cos(angle) * speed, "y": sin(angle) * speed }
			var new_config = config.duplicate(true)
			new_config.scatter = 0
			new_config._is_scatter_sub = true
			spawn_demo_projectile(x, y, new_vel, new_config)
		return
	
	var proj = {
		"x": x,
		"y": y,
		"vx": vel.x,
		"vy": vel.y,
		"config": config,
		"active": true,
		"radius": 8.0
	}
	demo_state.projectiles.append(proj)


func update_demo_projectile(proj: Dictionary) -> void:
	"""更新演示弹幕"""
	proj.x += proj.vx
	proj.y += proj.vy
	
	# 墙壁反弹
	var margin = 20.0
	if proj.x < margin or proj.x > demo_state.width - margin:
		proj.vx *= -1
		proj.x = clampf(proj.x, margin, demo_state.width - margin)
		if proj.config.get("bounce", 0) > 0:
			proj.config.bounce -= 1
	
	if proj.y < margin:
		proj.vy *= -1
		proj.y = margin
		if proj.config.get("bounce", 0) > 0:
			proj.config.bounce -= 1
	
	# 底部边界
	if proj.y > demo_state.height - margin:
		proj.active = false
		return
	
	# 碰撞检测
	for enemy in demo_state.enemies:
		if not enemy.active:
			continue
		
		var dx = proj.x - enemy.x
		var dy = proj.y - enemy.y
		var dist = sqrt(dx * dx + dy * dy)
		
		if dist < enemy.width / 2.0 + proj.radius:
			# 造成伤害
			var damage = proj.config.get("damage", 10)
			enemy.current_hp -= damage
			demo_state.round_damage += damage
			
			# 浮动文字
			create_floating_text(enemy.x, enemy.y - 20, "-" + str(damage), Color.RED)
			
			# 检查死亡
			if enemy.current_hp <= 0:
				enemy.active = false
				create_shockwave(enemy.x, enemy.y, Color(1, 0.5, 0.5, 1))
			
			# 处理穿透
			if proj.config.get("pierce", 0) > 0:
				proj.config.pierce -= 1
			else:
				proj.active = false
			
			# 处理弹跳
			if proj.config.get("bounce", 0) > 0 and proj.active:
				proj.config.bounce -= 1
				# 简单反弹
				proj.vy *= -1
			
			break


func update_demo_enemy(enemy: Dictionary) -> void:
	"""更新演示敌人"""
	# 简单的敌人更新逻辑
	pass


func process_enemy_turn(enemy: Dictionary) -> void:
	"""处理敌人回合"""
	if not enemy.active:
		return
	
	# 处理词缀效果
	if "regen" in enemy.affixes:
		var heal = floori(enemy.max_hp * 0.2)
		enemy.current_hp = mini(enemy.current_hp + heal, enemy.max_hp)
		create_floating_text(enemy.x, enemy.y - 20, "+" + str(heal), Color.GREEN)
	
	if "healer" in enemy.affixes:
		for other in demo_state.enemies:
			if other != enemy and other.active:
				var heal = floori(other.max_hp * 0.15)
				other.current_hp = mini(other.current_hp + heal, other.max_hp)
				create_floating_text(other.x, other.y - 20, "+" + str(heal), Color.GREEN)


# ==================== 特效创建 ====================

func create_floating_text(x: float, y: float, text: String, color: Color) -> void:
	"""创建浮动文字"""
	demo_state.floating_texts.append({
		"x": x,
		"y": y,
		"text": text,
		"color": color,
		"life": 60
	})


func create_shockwave(x: float, y: float, color: Color) -> void:
	"""创建冲击波"""
	demo_state.shockwaves.append({
		"x": x,
		"y": y,
		"radius": 10.0,
		"color": color,
		"alpha": 1.0
	})


func create_particle(x: float, y: float, color: Color) -> void:
	"""创建粒子"""
	demo_state.particles.append({
		"x": x,
		"y": y,
		"color": color,
		"life": 30
	})


# ==================== 日志 ====================

func add_log(text: String, color: Color = Color(0.05, 0.71, 0.83, 1.0)) -> void:
	"""添加日志"""
	demo_logs.append({
		"frame": sim_frame,
		"text": text,
		"color": color
	})
	
	if demo_logs.size() > MAX_LOGS:
		demo_logs.pop_front()


# ==================== 绘制 ====================

func _draw() -> void:
	"""绘制真理之书"""
	if not active:
		return
	
	var rect = get_rect()
	var font = ThemeDB.fallback_font
	
	# 背景
	draw_rect(rect, Color(0.04, 0.06, 0.08, 0.98))
	
	# 左侧列表区域
	var list_width = 250.0
	var list_rect = Rect2(0, 0, list_width, rect.size.y)
	draw_rect(list_rect, Color(0.06, 0.08, 0.1, 1.0))
	
	# 列表标题
	draw_string(font, Vector2(16, 30), "📚 真理之书", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)
	
	# 敌人列表标题
	draw_string(font, Vector2(16, 70), "敌人图鉴", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.6, 0.6, 0.6, 1.0))
	
	# 绘制敌人列表
	var y_offset = 90.0
	for entry in TruthBookData.get_all_enemies():
		var is_selected = (current_entry.get("id", "") == entry.id)
		var btn_rect = Rect2(8, y_offset, list_width - 16, 40)
		
		var btn_color = Color(0.05, 0.35, 0.4, 1.0) if is_selected else Color(0.1, 0.12, 0.14, 1.0)
		draw_rect(btn_rect, btn_color, true, -1, true)
		
		draw_string(font, Vector2(16, y_offset + 26), entry.icon + " " + entry.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)
		
		y_offset += 44
	
	# 属性列表标题
	y_offset += 20
	draw_string(font, Vector2(16, y_offset), "属性图鉴", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.6, 0.6, 0.6, 1.0))
	y_offset += 20
	
	# 绘制属性列表
	for entry in TruthBookData.get_all_attributes():
		var is_selected = (current_entry.get("id", "") == entry.id)
		var btn_rect = Rect2(8, y_offset, list_width - 16, 40)
		
		var btn_color = Color(0.05, 0.35, 0.4, 1.0) if is_selected else Color(0.1, 0.12, 0.14, 1.0)
		draw_rect(btn_rect, btn_color, true, -1, true)
		
		draw_string(font, Vector2(16, y_offset + 26), entry.icon + " " + entry.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color.WHITE)
		
		y_offset += 44
	
	# 右侧详情区域
	var detail_x = list_width + 20
	
	if not current_entry.is_empty():
		# 条目标题
		var icon = current_entry.get("icon", "❓")
		var entry_name = current_entry.get("name", "未知")
		draw_string(font, Vector2(detail_x, 40), icon, HORIZONTAL_ALIGNMENT_LEFT, -1, 32, Color.WHITE)
		draw_string(font, Vector2(detail_x + 50, 40), entry_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color.WHITE)
		
		# 标签
		var tags = current_entry.get("tags", [])
		var tag_x = detail_x
		for tag in tags:
			var tag_rect = Rect2(tag_x, 55, 60, 20)
			draw_rect(tag_rect, Color(0.1, 0.12, 0.14, 1.0), true, -1, true)
			draw_string(font, Vector2(tag_x + 5, 70), tag.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 9, Color(0.05, 0.71, 0.83, 1.0))
			tag_x += 70
		
		# 描述
		var desc = current_entry.get("desc", "")
		draw_string(font, Vector2(detail_x, 100), desc, HORIZONTAL_ALIGNMENT_LEFT, rect.size.x - detail_x - 20, 11, Color(0.7, 0.7, 0.7, 1.0))
		
		# 演示区域
		var demo_rect = Rect2(detail_x, 140, rect.size.x - detail_x - 20, rect.size.y - 200)
		draw_rect(demo_rect, Color(0.02, 0.04, 0.06, 1.0), true, -1, true)
		draw_rect(demo_rect, Color(0.1, 0.12, 0.14, 1.0), false, 1.0)
		
		# 绘制演示内容
		draw_demo(demo_rect)
		
		# 日志区域
		var log_y = rect.size.y - 50
		for i in range(demo_logs.size()):
			var log_entry = demo_logs[i]
			var log_text = "[%d] %s" % [log_entry.frame, log_entry.text]
			draw_string(font, Vector2(detail_x, log_y), log_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, log_entry.color)
			log_y -= 14
	else:
		# 空状态
		draw_string(font, Vector2(detail_x + 100, rect.size.y / 2.0), "选择一个条目查看详情", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.5, 0.5, 0.5, 1.0))
	
	# 关闭按钮
	draw_string(font, Vector2(rect.size.x - 50, 30), "✕ 关闭", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.6, 0.6, 0.6, 1.0))


func draw_demo(demo_rect: Rect2) -> void:
	"""绘制演示内容"""
	# 计算缩放
	var scale_x = demo_rect.size.x / demo_state.width
	var scale_y = demo_rect.size.y / demo_state.height
	var scale_factor = minf(scale_x, scale_y)
	var offset_x = demo_rect.position.x + (demo_rect.size.x - demo_state.width * scale_factor) / 2.0
	var offset_y = demo_rect.position.y + (demo_rect.size.y - demo_state.height * scale_factor) / 2.0
	
	# 绘制网格
	grid_offset = fmod(grid_offset + 0.5, 40.0)
	draw_set_transform(Vector2(offset_x, offset_y), 0, Vector2(scale_factor, scale_factor))
	
	# 绘制敌人
	for enemy in demo_state.enemies:
		if not enemy.active:
			continue
		
		var enemy_rect = Rect2(
			enemy.x - enemy.width / 2.0,
			enemy.y - enemy.height / 2.0,
			enemy.width,
			enemy.height
		)
		draw_rect(enemy_rect, Color(0.8, 0.2, 0.2, 1.0), true, -1, true)
		
		# 血条
		var hp_ratio = float(enemy.current_hp) / float(enemy.max_hp)
		var hp_bar_rect = Rect2(enemy.x - enemy.width / 2.0, enemy.y - enemy.height / 2.0 - 10, enemy.width * hp_ratio, 5)
		draw_rect(hp_bar_rect, Color(0.2, 0.8, 0.2, 1.0))
	
	# 绘制弹幕
	for proj in demo_state.projectiles:
		if not proj.active:
			continue
		
		var color = Color.WHITE
		if proj.config.get("pyro", 0) > 0:
			color = Color(0.97, 0.45, 0.09, 1.0)
		elif proj.config.get("cryo", 0) > 0:
			color = Color(0.05, 0.71, 0.83, 1.0)
		elif proj.config.get("lightning", 0) > 0:
			color = Color(0.75, 0.5, 1.0, 1.0)
		
		draw_circle(Vector2(proj.x, proj.y), proj.radius, color)
	
	# 绘制冲击波
	for sw in demo_state.shockwaves:
		var sw_color = Color(sw.color.r, sw.color.g, sw.color.b, sw.alpha)
		draw_arc(Vector2(sw.x, sw.y), sw.radius, 0, TAU, 32, sw_color, 2.0)
	
	# 绘制浮动文字
	var font = ThemeDB.fallback_font
	for text in demo_state.floating_texts:
		var alpha = float(text.life) / 60.0
		var text_color = Color(text.color.r, text.color.g, text.color.b, alpha)
		draw_string(font, Vector2(text.x, text.y), text.text, HORIZONTAL_ALIGNMENT_CENTER, -1, 12, text_color)
	
	# 扫描线
	scan_line_y = fmod(scan_line_y + 2.0, demo_state.height)
	draw_rect(Rect2(0, scan_line_y, demo_state.width, 2), Color(0.05, 0.71, 0.83, 0.1))
	
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)


# ==================== 输入处理 ====================

func _gui_input(event: InputEvent) -> void:
	"""处理输入事件"""
	if not active:
		return
	
	if event is InputEventMouseButton and event.pressed:
		var mouse_pos = event.position
		var rect = get_rect()
		
		# 检查关闭按钮
		var close_rect = Rect2(rect.size.x - 60, 15, 50, 20)
		if close_rect.has_point(mouse_pos):
			close()
			return
		
		# 检查列表点击
		var list_width = 250.0
		if mouse_pos.x < list_width:
			var y_offset = 90.0
			
			# 敌人列表
			for entry in TruthBookData.get_all_enemies():
				var btn_rect = Rect2(8, y_offset, list_width - 16, 40)
				if btn_rect.has_point(mouse_pos):
					show_entry(entry)
					return
				y_offset += 44
			
			y_offset += 40  # 标题间距
			
			# 属性列表
			for entry in TruthBookData.get_all_attributes():
				var btn_rect = Rect2(8, y_offset, list_width - 16, 40)
				if btn_rect.has_point(mouse_pos):
					show_entry(entry)
					return
				y_offset += 44
