extends Node

## AudioManager (Godot 4.x)
## 这是一个单例类，用于模拟 Web Audio API 的程序化音效生成。

var master_gain: float = 0.5
var enabled: bool = true
var sample_rate: float = 44100.0

func _ready() -> void:
	# 设置音频处理线程
	process_mode = Node.PROCESS_MODE_ALWAYS

## 模拟 resume()
func resume() -> void:
	# Godot 的 AudioServer 通常会自动处理音频上下文
	# 如果在某些平台（如 Web）需要手动恢复，可以使用：
	# AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), false)
	pass

## 核心方法：播放程序化音调
## frequency: 频率 (Hz)
## duration: 持续时间 (秒)
## type: 波形类型 ('sine', 'square', 'sawtooth', 'triangle')
func play_tone(frequency: float, duration: float, type: String = "sine") -> void:
	if not enabled:
		return
	
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = sample_rate
	generator.buffer_length = duration
	
	var player = AudioStreamPlayer.new()
	player.stream = generator
	player.volume_db = linear_to_db(master_gain * 0.3)
	add_child(player)
	player.play()
	
	var playback: AudioStreamGeneratorPlayback = player.get_stream_playback()
	var frames_to_fill = int(sample_rate * duration)
	var phase = 0.0
	var increment = frequency / sample_rate
	
	for i in range(frames_to_fill):
		var sample = 0.0
		# 模拟指数级衰减 (Exponential Ramp)
		var envelope = lerp(1.0, 0.01, float(i) / frames_to_fill)
		
		match type:
			"sine":
				sample = sin(phase * TAU)
			"square":
				sample = 1.0 if sin(phase * TAU) >= 0 else -1.0
			"sawtooth":
				sample = 2.0 * (phase - floor(0.5 + phase))
			"triangle":
				sample = 2.0 * abs(2.0 * (phase - floor(0.5 + phase))) - 1.0
		
		playback.push_frame(Vector2.ONE * sample * envelope)
		phase = fmod(phase + increment, 1.0)
	
	# 播放结束后自动销毁
	await get_tree().create_timer(duration + 0.1).timeout
	player.queue_free()

## 播放射击音效
func play_shoot() -> void:
	play_tone(440, 0.1, "square")
	play_tone(880, 0.05, "sine")

## 播放击中音效
func play_hit() -> void:
	play_tone(200, 0.1, "sawtooth")

## 播放爆炸音效 (白噪音 + 指数衰减)
func play_explosion() -> void:
	if not enabled:
		return
		
	var duration = 0.3
	var generator = AudioStreamGenerator.new()
	generator.mix_rate = sample_rate
	generator.buffer_length = duration
	
	var player = AudioStreamPlayer.new()
	player.stream = generator
	player.volume_db = linear_to_db(master_gain)
	add_child(player)
	player.play()
	
	var playback: AudioStreamGeneratorPlayback = player.get_stream_playback()
	var frames_to_fill = int(sample_rate * duration)
	
	for i in range(frames_to_fill):
		var noise = randf_range(-1.0, 1.0)
		var envelope = exp(-float(i) / (frames_to_fill * 0.1))
		playback.push_frame(Vector2.ONE * noise * envelope)
	
	await get_tree().create_timer(duration + 0.1).timeout
	player.queue_free()

## 播放魔法音效 (上升音阶)
func play_magic() -> void:
	var notes = [261.63, 329.63, 392.00, 523.25] # C4, E4, G4, C5
	for i in range(notes.size()):
		get_tree().create_timer(i * 0.05).timeout.connect(
			func(): play_tone(notes[i], 0.15, "sine")
		)

## 播放升级音效
func play_powerup(pitch: float = 1.0) -> void:
	play_tone(440 * pitch, 0.2, "triangle")
	get_tree().create_timer(0.1).timeout.connect(
		func(): play_tone(660 * pitch, 0.2, "triangle")
	)

## 播放购买音效
func play_purchase() -> void:
	play_tone(523.25, 0.1, "sine") # C5
	get_tree().create_timer(0.08).timeout.connect(
		func(): play_tone(659.25, 0.15, "sine") # E5
	)

## 播放反弹音效
func play_bounce() -> void:
	play_tone(300 + randf() * 200, 0.05, "sine")

## 创建持续的滚动声音
## 返回一个包含控制方法的对象 (在 GDScript 中通常使用内部类或字典)
func create_rolling_sound() -> RollingSound:
	var rs = RollingSound.new(self)
	add_child(rs)
	return rs

## 内部类用于处理持续音效
class RollingSound extends Node:
	var player: AudioStreamPlayer
	var playback: AudioStreamGeneratorPlayback
	var frequency: float = 100.0
	var volume: float = 0.0
	var phase: float = 0.0
	var manager: Node
	
	func _init(_manager: Node) -> void:
		manager = _manager
		player = AudioStreamPlayer.new()
		var generator = AudioStreamGenerator.new()
		generator.mix_rate = 44100.0
		generator.buffer_length = 0.1 # 短缓冲区用于实时更新
		player.stream = generator
		add_child(player)
		
	func _ready() -> void:
		player.play()
		playback = player.get_stream_playback()

	func _process(_delta: float) -> void:
		if not playback: return
		
		var frames_available = playback.get_frames_available()
		var increment = frequency / 44100.0
		
		for i in range(frames_available):
			var sample = sin(phase * TAU) * volume * 0.1
			playback.push_frame(Vector2.ONE * sample)
			phase = fmod(phase + increment, 1.0)

	func set_volume(v: float) -> void:
		volume = v

	func set_frequency(f: float) -> void:
		frequency = f

	func stop() -> void:
		player.stop()
		queue_free()
