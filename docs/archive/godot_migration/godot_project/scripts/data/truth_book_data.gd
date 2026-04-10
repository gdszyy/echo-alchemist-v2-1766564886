# 真理之书数据 - 存储敌人和属性的演示配置
# 从 JavaScript systems.js 中的 TRUTH_BOOK_DATA 迁移

extends Node

class_name TruthBookData

# 敌人演示配置
static var enemies: Array[Dictionary] = [
	{
		"id": "normal",
		"name": "普通魔像",
		"icon": "🤖",
		"tags": ["基础", "测试对象"],
		"desc": "标准的炼金生物。没有特殊能力，是测试伤害的理想对象。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 150, "width": 60, "height": 60, "hp": 200, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "生成测试弹幕..." },
			{ "type": "spawn_projectile", "config": { "damage": 20, "bounce": 2 } },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "shield",
		"name": "护盾魔像",
		"icon": "🛡️",
		"tags": ["减伤", "激光反射"],
		"desc": "拥有能量护盾，减少 50% 受到的伤害。护盾表面光滑，可以反射激光束。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 150, "width": 60, "height": 60, "hp": 200, "affixes": ["shield"] }
			]
		},
		"loop": [
			{ "type": "log", "text": "护盾减伤测试" },
			{ "type": "spawn_projectile", "config": { "damage": 20 } },
			{ "type": "wait", "frames": 60 },
			{ "type": "log", "text": "激光反射测试" },
			{ "type": "spawn_projectile", "config": { "damage": 10, "is_laser": true, "laser": 5 } },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "regen",
		"name": "再生魔像",
		"icon": "💚",
		"tags": ["回血", "持久战"],
		"desc": "体内植入了生命水晶，每回合行动时会恢复最大生命值的 20%。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 150, "width": 60, "height": 60, "hp": 200, "current_hp": 100, "affixes": ["regen"] }
			]
		},
		"loop": [
			{ "type": "log", "text": "魔像受伤状态..." },
			{ "type": "wait", "frames": 60 },
			{ "type": "log", "text": "触发回合行动：再生" },
			{ "type": "enemy_turn" },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "clone",
		"name": "分身魔像",
		"icon": "🦠",
		"tags": ["受击分裂", "人海战术"],
		"desc": "受到攻击或每回合开始时，有概率分裂出较弱的复制体，迅速填满战场。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 150, "width": 60, "height": 60, "hp": 300, "affixes": ["clone"] }
			]
		},
		"loop": [
			{ "type": "log", "text": "攻击触发分裂" },
			{ "type": "spawn_projectile", "config": { "damage": 10 } },
			{ "type": "wait", "frames": 30 },
			{ "type": "spawn_projectile", "config": { "damage": 10 } },
			{ "type": "wait", "frames": 150 },
			{ "type": "reset" }
		]
	},
	{
		"id": "haste",
		"name": "极速魔像",
		"icon": "⚡",
		"tags": ["高速", "两次行动"],
		"desc": "神经反射极快，每回合可以进行两次移动或攻击。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 150, "width": 60, "height": 60, "hp": 200, "affixes": ["haste"] }
			]
		},
		"loop": [
			{ "type": "log", "text": "极速行动 (2x)" },
			{ "type": "enemy_turn" },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "berserk",
		"name": "狂暴魔像",
		"icon": "😡",
		"tags": ["热能转化", "升温强化"],
		"desc": "当前温度：150°C (过热)。当处于「过热」状态时，有高概率触发狂暴，获得额外行动机会。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 150, "width": 60, "height": 60, "hp": 300, "temp": 150, "affixes": ["berserk"] }
			]
		},
		"loop": [
			{ "type": "log", "text": "当前温度：150°C (过热)" },
			{ "type": "wait", "frames": 60 },
			{ "type": "log", "text": "触发狂暴判定..." },
			{ "type": "enemy_turn" },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "healer",
		"name": "治愈魔像",
		"icon": "💖",
		"tags": ["群体治疗", "辅助"],
		"desc": "战场上的医疗兵。回合行动时会治疗周围的友军单位。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.35, "y": 150, "width": 60, "height": 60, "hp": 200, "current_hp": 100, "affixes": [] },
				{ "x_ratio": 0.5, "y": 150, "width": 60, "height": 60, "hp": 200, "affixes": ["healer"] },
				{ "x_ratio": 0.65, "y": 150, "width": 60, "height": 60, "hp": 200, "current_hp": 100, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "队友生命危急..." },
			{ "type": "wait", "frames": 60 },
			{ "type": "log", "text": "施放群体治愈" },
			{ "type": "enemy_turn", "target_idx": 1 },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "devour",
		"name": "贪食魔像",
		"icon": "👅",
		"tags": ["吞噬友军", "成长"],
		"desc": "残忍的同类相食者。会吞噬相邻的友军以恢复自身生命并继承其词条。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.4, "y": 150, "width": 50, "height": 50, "hp": 100, "affixes": ["haste"] },
				{ "x_ratio": 0.5, "y": 150, "width": 70, "height": 70, "hp": 500, "affixes": ["devour"] }
			]
		},
		"loop": [
			{ "type": "log", "text": "发现猎物 (极速魔像)" },
			{ "type": "wait", "frames": 60 },
			{ "type": "log", "text": "吞噬！(继承血量与词条)" },
			{ "type": "enemy_turn", "target_idx": 1 },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "jump",
		"name": "跳跃魔像",
		"icon": "🦘",
		"tags": ["越过障碍", "突进"],
		"desc": "腿部装有弹簧装置。当前方被阻挡时，可以直接跳过障碍物继续前进。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 210, "width": 60, "height": 60, "hp": 100, "affixes": [] },
				{ "x_ratio": 0.5, "y": 150, "width": 60, "height": 60, "hp": 200, "affixes": ["jump"] }
			]
		},
		"loop": [
			{ "type": "log", "text": "前方道路被阻挡" },
			{ "type": "wait", "frames": 60 },
			{ "type": "log", "text": "发动跳跃！" },
			{ "type": "enemy_turn", "target_idx": 1 },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	}
]

# 属性演示配置
static var attributes: Array[Dictionary] = [
	{
		"id": "bounce",
		"name": "弹性",
		"icon": "⤴️",
		"tags": ["物理", "连击"],
		"desc": "增加弹珠在敌人之间弹射的次数，适合在密集怪群中制造混乱。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.35, "y": 220, "width": 50, "height": 50, "hp": 500, "affixes": [] },
				{ "x_ratio": 0.65, "y": 220, "width": 50, "height": 50, "hp": 500, "affixes": [] },
				{ "x_ratio": 0.5, "y": 140, "width": 50, "height": 50, "hp": 500, "affixes": [] },
				{ "x_ratio": 0.25, "y": 100, "width": 40, "height": 40, "hp": 300, "affixes": [] },
				{ "x_ratio": 0.75, "y": 100, "width": 40, "height": 40, "hp": 300, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "发射高弹性弹珠" },
			{ "type": "spawn_projectile", "config": { "damage": 15, "bounce": 8 }, "vel": { "x": 2, "y": -18 } },
			{ "type": "wait", "frames": 240 },
			{ "type": "reset" }
		]
	},
	{
		"id": "pierce",
		"name": "穿透",
		"icon": "↗️",
		"tags": ["物理", "贯穿"],
		"desc": "使弹珠能够穿透敌人的身体，直接打击后排目标。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 250, "width": 50, "height": 40, "hp": 200, "affixes": [] },
				{ "x_ratio": 0.5, "y": 200, "width": 50, "height": 40, "hp": 200, "affixes": [] },
				{ "x_ratio": 0.5, "y": 150, "width": 50, "height": 40, "hp": 200, "affixes": [] },
				{ "x_ratio": 0.5, "y": 100, "width": 50, "height": 40, "hp": 200, "affixes": [] },
				{ "x_ratio": 0.5, "y": 50, "width": 50, "height": 40, "hp": 200, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "发射强力穿透弹" },
			{ "type": "spawn_projectile", "config": { "damage": 20, "pierce": 5 }, "vel": { "x": 0, "y": -20 } },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "scatter",
		"name": "散射",
		"icon": "🔱",
		"tags": ["物理", "分裂"],
		"desc": "弹珠飞行时会向两侧分裂出小型子弹，扩大打击覆盖面。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 120, "width": 80, "height": 80, "hp": 1000, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "发射分裂散射弹" },
			{ "type": "spawn_projectile", "config": { "damage": 12, "scatter": 8 }, "vel": { "x": 0, "y": -15 } },
			{ "type": "wait", "frames": 180 },
			{ "type": "reset" }
		]
	},
	{
		"id": "cryo",
		"name": "冰霜",
		"icon": "❄️",
		"tags": ["元素", "控制"],
		"desc": "降低敌人温度。温度 < 0°C 时触发【易伤】，每降低 1°C 增加 0.5% 受到的伤害。达到 -100°C 时触发【冻结】，敌人将无法行动。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 180, "width": 90, "height": 90, "hp": 2000, "temp": -100, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "目标已处于【冻结】状态" },
			{ "type": "wait", "frames": 60 },
			{ "type": "log", "text": "触发【易伤】(伤害大幅提升)" },
			{ "type": "spawn_projectile", "config": { "damage": 100, "cryo": 0 }, "vel": { "x": 0, "y": -15 } },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "pyro",
		"name": "火焰",
		"icon": "🔥",
		"tags": ["元素", "范围爆炸"],
		"desc": "升高敌人温度。温度 >= 34°C 时触发【燃烧】造成持续伤害。温度 > 200°C 时有概率触发【过热爆炸】，造成大范围 AOE 伤害。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 180, "width": 80, "height": 80, "hp": 1500, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "第一步：施加火属性使其【燃烧】" },
			{ "type": "spawn_projectile", "config": { "damage": 10, "pyro": 600 }, "vel": { "x": 0, "y": -15 } },
			{ "type": "wait", "frames": 100 },
			{ "type": "log", "text": "第二步：击杀燃烧中的敌人触发爆炸" },
			{ "type": "spawn_projectile", "config": { "damage": 2000 }, "vel": { "x": 0, "y": -15 } },
			{ "type": "wait", "frames": 150 },
			{ "type": "reset" }
		]
	},
	{
		"id": "lightning",
		"name": "闪电",
		"icon": "⚡",
		"tags": ["元素", "连锁"],
		"desc": "命中时触发连锁闪电，提升等同于本次伤害的温度。闪电链可对重复敌人造成伤害，随机在范围内索敌且距离越近概率越高。",
		"setup": {
			"enemies": []  # 动态生成
		},
		"setup_func": "setup_lightning_demo",
		"loop": [
			{ "type": "log", "text": "打击冻结目标 (启动无限连锁)" },
			{ "type": "spawn_projectile", "config": { "damage": 15, "lightning": 10 }, "vel": { "x": 0, "y": -15 } },
			{ "type": "wait", "frames": 300 },
			{ "type": "reset" }
		]
	},
	{
		"id": "laser",
		"name": "光球",
		"icon": "🔦",
		"tags": ["特殊", "瞬时"],
		"desc": "发射弹珠，命中时触发折射激光，瞬间对路径上的敌人造成伤害。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.35, "y": 250, "width": 50, "height": 50, "hp": 300, "affixes": [] },
				{ "x_ratio": 0.65, "y": 210, "width": 50, "height": 50, "hp": 300, "affixes": [] },
				{ "x_ratio": 0.35, "y": 170, "width": 50, "height": 50, "hp": 300, "affixes": [] },
				{ "x_ratio": 0.65, "y": 130, "width": 50, "height": 50, "hp": 300, "affixes": [] },
				{ "x_ratio": 0.35, "y": 90, "width": 50, "height": 50, "hp": 300, "affixes": [] },
				{ "x_ratio": 0.65, "y": 50, "width": 50, "height": 50, "hp": 300, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "发射光学折射弹 (laser=true)" },
			{ "type": "spawn_projectile", "config": { "damage": 40, "laser": 10 }, "vel": { "x": 2, "y": -15 } },
			{ "type": "wait", "frames": 150 },
			{ "type": "reset" }
		]
	},
	{
		"id": "wind",
		"name": "风",
		"icon": "🌪️",
		"tags": ["特殊", "法阵"],
		"desc": "在命中点生成风暴法阵，持续发射风刃攻击附近的敌人。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 200, "width": 80, "height": 80, "hp": 1000, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "spawn_projectile", "config": { "damage": 5, "wind": 1, "bounce": 4 }, "vel": { "x": 5, "y": -15 } },
			{ "type": "wait", "frames": 60 },
			{ "type": "log", "text": "风暴法阵持续攻击..." },
			{ "type": "wait", "frames": 180 },
			{ "type": "reset" }
		]
	},
	{
		"id": "explosive",
		"name": "爆破",
		"icon": "🧨",
		"tags": ["特殊", "AOE"],
		"desc": "接触敌人时引发剧烈爆炸，造成大范围伤害。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.25, "y": 200, "width": 40, "height": 40, "hp": 100, "affixes": [] },
				{ "x_ratio": 0.375, "y": 200, "width": 40, "height": 40, "hp": 100, "affixes": [] },
				{ "x_ratio": 0.5, "y": 200, "width": 40, "height": 40, "hp": 100, "affixes": [] },
				{ "x_ratio": 0.625, "y": 200, "width": 40, "height": 40, "hp": 100, "affixes": [] },
				{ "x_ratio": 0.75, "y": 200, "width": 40, "height": 40, "hp": 100, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "spawn_projectile", "config": { "damage": 30, "explosive": true }, "vel": { "x": 0, "y": -15 } },
			{ "type": "wait", "frames": 120 },
			{ "type": "reset" }
		]
	},
	{
		"id": "matryoshka",
		"name": "套娃",
		"icon": "🪆",
		"tags": ["特殊", "连锁"],
		"desc": "子弹消失时会分裂出下一颗子弹。演示：散射子弹分裂出散射火属性子弹。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.5, "y": 120, "width": 80, "height": 80, "hp": 1500, "affixes": [] },
				{ "x_ratio": 0.25, "y": 220, "width": 40, "height": 40, "hp": 300, "affixes": [] },
				{ "x_ratio": 0.417, "y": 220, "width": 40, "height": 40, "hp": 300, "affixes": [] },
				{ "x_ratio": 0.583, "y": 220, "width": 40, "height": 40, "hp": 300, "affixes": [] },
				{ "x_ratio": 0.75, "y": 220, "width": 40, "height": 40, "hp": 300, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "发射套娃弹 (散射->火散射)" },
			{ "type": "spawn_projectile", "config": { 
				"damage": 10, 
				"scatter": 3,
				"nested_payload": { "damage": 10, "scatter": 5, "pyro": 100 }
			}, "vel": { "x": 0, "y": -15 } },
			{ "type": "wait", "frames": 240 },
			{ "type": "reset" }
		]
	},
	{
		"id": "flying_sword",
		"name": "子母剑",
		"icon": "🗡️",
		"tags": ["特殊", "追踪"],
		"desc": "发射后会生成追踪飞剑，自动攻击附近敌人。",
		"setup": {
			"enemies": [
				{ "x_ratio": 0.3, "y": 150, "width": 50, "height": 50, "hp": 500, "affixes": [] },
				{ "x_ratio": 0.5, "y": 200, "width": 50, "height": 50, "hp": 500, "affixes": [] },
				{ "x_ratio": 0.7, "y": 150, "width": 50, "height": 50, "hp": 500, "affixes": [] }
			]
		},
		"loop": [
			{ "type": "log", "text": "发射子母剑弹" },
			{ "type": "spawn_projectile", "config": { "damage": 20, "flying_sword": 5, "type": "flying_sword" }, "vel": { "x": 0, "y": -15 } },
			{ "type": "wait", "frames": 200 },
			{ "type": "reset" }
		]
	}
]


# 获取敌人条目
static func get_enemy_entry(id: String) -> Dictionary:
	for entry in enemies:
		if entry.id == id:
			return entry
	return {}


# 获取属性条目
static func get_attribute_entry(id: String) -> Dictionary:
	for entry in attributes:
		if entry.id == id:
			return entry
	return {}


# 获取所有敌人条目
static func get_all_enemies() -> Array[Dictionary]:
	return enemies


# 获取所有属性条目
static func get_all_attributes() -> Array[Dictionary]:
	return attributes
