extends Control
## 主菜单控制器

signal start_game_requested
signal workshop_requested
signal truth_book_requested

@onready var start_button: Button = $VBoxContainer/StartButton
@onready var workshop_button: Button = $VBoxContainer/WorkshopButton
@onready var truth_book_button: Button = $VBoxContainer/TruthBookButton

func _ready() -> void:
	if start_button:
		start_button.pressed.connect(_on_start_pressed)
	if workshop_button:
		workshop_button.pressed.connect(_on_workshop_pressed)
	if truth_book_button:
		truth_book_button.pressed.connect(_on_truth_book_pressed)

func _on_start_pressed() -> void:
	start_game_requested.emit()

func _on_workshop_pressed() -> void:
	workshop_requested.emit()

func _on_truth_book_pressed() -> void:
	truth_book_requested.emit()
