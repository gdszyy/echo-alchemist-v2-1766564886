extends Control
## HUD 控制器 - 显示游戏状态信息

@onready var round_label: Label = $TopBar/RoundLabel
@onready var currency_label: Label = $TopBar/CurrencyLabel
@onready var ammo_label: Label = $BottomBar/AmmoLabel

var current_round: int = 1
var currency: int = 0
var ammo_count: int = 0

func _ready() -> void:
	update_display()

func set_round(round_num: int) -> void:
	current_round = round_num
	if round_label:
		round_label.text = "回合 %d" % round_num

func set_currency(amount: int) -> void:
	currency = amount
	if currency_label:
		currency_label.text = "%d ✨" % amount

func set_ammo(count: int) -> void:
	ammo_count = count
	if ammo_label:
		ammo_label.text = "弹药: %d" % count

func update_display() -> void:
	set_round(current_round)
	set_currency(currency)
	set_ammo(ammo_count)
