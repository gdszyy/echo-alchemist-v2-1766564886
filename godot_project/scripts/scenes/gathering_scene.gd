extends Node2D
## 弹珠台场景 - 处理弹珠台的显示和交互

class_name GatheringScene

# 引用
var phase_manager: PhaseManager = null
var pegs: Array = []
var drop_balls: Array = []
var special_slots: Array = []

# 配置
var board_width: float = 800.0
var board_height: float = 600.0
var board_tilt: float = 0.0

# 状态
var marbles_dropped: int = 0
var total_marbles: int = 5

func _ready() -> void:
	"""初始化弹珠台场景"""
	print("GatheringScene ready")

func _process(delta: float) -> void:
	"""
	处理每帧更新
	
	Args:
		delta: 帧时间差
	"""
	if phase_manager and phase_manager.is_in_phase("gathering"):
		_update_pachinko(delta)
		queue_redraw()

func _draw() -> void:
	"""绘制场景"""
	# 绘制背景
	draw_rect(Rect2(0, 0, board_width, board_height), Color.DARK_GRAY)
	
	# 绘制钉子
	for peg in pegs:
		if peg is Peg:
			draw_circle(peg.get_position_vector(), peg.radius, peg.color)
	
	# 绘制槽位
	for slot in special_slots:
		if slot is SpecialSlot:
			_draw_slot(slot)
	
	# 绘制弹珠
	for ball in drop_balls:
		if ball is DropBall:
			draw_circle(ball.global_position, ball.radius, Color.LIGHT_BLUE)

func _draw_slot(slot: SpecialSlot) -> void:
	"""
	绘制槽位
	
	Args:
		slot: 槽位对象
	"""
	var slot_x = slot.get_position_x()
	var slot_y = slot.get_position_y()
	var slot_width = slot.get_width()
	var slot_height = slot.get_height()
	
	var rect = Rect2(slot_x, slot_y, slot_width, slot_height)
	draw_rect(rect, slot.color)
	draw_rect(rect, Color.BLACK, false, 2.0)

func _update_pachinko(delta: float) -> void:
	"""
	更新弹珠台
	
	Args:
		delta: 帧时间差
	"""
	if not phase_manager:
		return
	
	# 定期生成新弹珠
	if marbles_dropped < total_marbles:
		_spawn_marble()
	
	# 更新弹珠
	for ball in phase_manager.drop_balls:
		if ball is DropBall:
			var result = ball.update(
				phase_manager.pegs,
				phase_manager.special_slots,
				board_width,
				board_height,
				phase_manager.time_scale,
				board_tilt
			)
			
			if result == "finished":
				phase_manager.marble_queue.append(ball.get_data())

func _spawn_marble() -> void:
	"""生成新弹珠"""
	if phase_manager and marbles_dropped < total_marbles:
		var spawn_x = board_width / 2.0
		var spawn_y = 20.0
		
		var ball = DropBall.new(spawn_x, spawn_y)
		phase_manager.drop_balls.append(ball)
		add_child(ball)
		
		marbles_dropped += 1
		print("Marble spawned: %d/%d" % [marbles_dropped, total_marbles])

func set_phase_manager(manager: PhaseManager) -> void:
	"""
	设置阶段管理器
	
	Args:
		manager: 阶段管理器
	"""
	phase_manager = manager
	
	if phase_manager:
		pegs = phase_manager.pegs
		drop_balls = phase_manager.drop_balls
		special_slots = phase_manager.special_slots
		board_width = phase_manager.game_width
		board_height = phase_manager.game_height

func get_marble_count() -> int:
	"""获取弹珠数量"""
	return marbles_dropped

func set_board_tilt(tilt: float) -> void:
	"""
	设置棋盘倾斜
	
	Args:
		tilt: 倾斜角度
	"""
	board_tilt = tilt