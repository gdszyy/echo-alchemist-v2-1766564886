## 游戏配置和常量

class_name GameConfig

# 游戏阶段常量
const PHASE_META = "meta"
const PHASE_SELECTION = "selection"
const PHASE_GATHERING = "gathering"
const PHASE_COMBAT = "combat"
const PHASE_GAMEOVER = "gameover"

# 所有阶段列表
const ALL_PHASES = [
	PHASE_META,
	PHASE_SELECTION,
	PHASE_GATHERING,
	PHASE_COMBAT,
	PHASE_GAMEOVER,
]

# 游戏窗口配置
const WINDOW_WIDTH = 800
const WINDOW_HEIGHT = 600
const WINDOW_TITLE = "Game Phase Manager"

# 弹珠台配置
const PACHINKO_ROWS = 8
const PACHINKO_COLS = 7
const PACHINKO_START_Y = 100.0
const PACHINKO_SPACING = 50.0
const PACHINKO_PEG_RADIUS = 5.0

# 弹珠配置
const BALL_RADIUS = 8.0
const BALL_GRAVITY = 500.0
const BALL_BOUNCE_DAMPING = 0.8
const BALL_SPAWN_X = 400.0
const BALL_SPAWN_Y = 20.0

# 槽位配置
const SLOT_WIDTH = 60.0
const SLOT_HEIGHT = 40.0
const SLOT_TYPES = ["recall", "multicast", "split", "wheel"]

# 属性类型
const ATTRIBUTE_TYPES = ["bounce", "pierce", "scatter", "cryo", "pyro", "lightning"]

# 战斗配置
const INITIAL_ENEMY_HP = 100
const ENEMY_SPAWN_COUNT = 3
const INITIAL_DAMAGE = 10
const DAMAGE_PER_ATTRIBUTE = 5

# 属性倍数
const ATTRIBUTE_MULTIPLIERS = {
	"pierce": 1.5,
	"cryo": 1.2,
	"pyro": 1.3,
	"lightning": 1.25,
}

# 时间配置
const DEFAULT_TIME_SCALE = 1.0
const SLOW_MOTION_TIME_SCALE = 0.5
const FAST_FORWARD_TIME_SCALE = 2.0

# 颜色配置
const COLOR_NORMAL_PEG = Color.WHITE
const COLOR_BOUNCE_PEG = Color.YELLOW
const COLOR_PIERCE_PEG = Color.RED
const COLOR_SCATTER_PEG = Color.CYAN
const COLOR_CRYO_PEG = Color.BLUE
const COLOR_PYRO_PEG = Color.ORANGE
const COLOR_LIGHTNING_PEG = Color.PURPLE

const COLOR_RECALL_SLOT = Color.GREEN
const COLOR_MULTICAST_SLOT = Color.YELLOW
const COLOR_SPLIT_SLOT = Color.MAGENTA
const COLOR_WHEEL_SLOT = Color.CYAN

# 获取属性颜色
static func get_peg_color(attr_type: String) -> Color:
	"""
	根据属性类型获取颜色
	
	Args:
		attr_type: 属性类型
	
	Returns:
		颜色
	"""
	match attr_type:
		"normal":
			return COLOR_NORMAL_PEG
		"bounce":
			return COLOR_BOUNCE_PEG
		"pierce":
			return COLOR_PIERCE_PEG
		"scatter":
			return COLOR_SCATTER_PEG
		"cryo":
			return COLOR_CRYO_PEG
		"pyro":
			return COLOR_PYRO_PEG
		"lightning":
			return COLOR_LIGHTNING_PEG
		_:
			return Color.GRAY

# 获取槽位颜色
static func get_slot_color(slot_type: String) -> Color:
	"""
	根据槽位类型获取颜色
	
	Args:
		slot_type: 槽位类型
	
	Returns:
		颜色
	"""
	match slot_type:
		"recall":
			return COLOR_RECALL_SLOT
		"multicast":
			return COLOR_MULTICAST_SLOT
		"split":
			return COLOR_SPLIT_SLOT
		"wheel":
			return COLOR_WHEEL_SLOT
		_:
			return Color.GRAY

# 获取属性倍数
static func get_attribute_multiplier(attr_type: String) -> float:
	"""
	获取属性伤害倍数
	
	Args:
		attr_type: 属性类型
	
	Returns:
		伤害倍数
	"""
	return ATTRIBUTE_MULTIPLIERS.get(attr_type, 1.0)