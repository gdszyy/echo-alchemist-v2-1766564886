#!/usr/bin/env python3
"""Single source of truth for route-A (MiniMax concept -> pixelize) assets.

Running this module writes:
  docs/art/pixel_pipeline/asset_catalog.json   (id -> class / collision / key color, read by run_all.py)
  docs/art/pixel_pipeline/minimax_prompt_pack.md (human prompt pack, one row per asset)

Roster anchors (read 2026-10-22, worktree REQ-20261022-wave-loop):
  archetypes   src/spawn_system.js:3419-3427 (cols x rows per archetype)
  affixes      src/config.js:559-628 (gameplay.affixes) + ENEMY_CURVE_CONFIG.AFFIX_WEIGHT_CURVES
  bosses       src/config.js:679-875 (bossConfigs, vulnerability labels) + BOSS_DB
  minions      src/config.js:914-923 (bossMinionProfiles)
  icons        docs/design/dig_build_defend_loop_v1.md section 4-6
Boss size: spec section 2.2 says 2x2 (48px) / 3x3 (72px) matching collision; current code spawns
every boss at 4x3 cells (src/spawn_system.js:2587-2595, BOSS_BODY_SCALE = 1.5). This catalog
follows the spec (isBigBoss false -> 2x2, true -> 3x3); the runtime collision must be reconciled
before final boss art is accepted (open decision, not resolved here).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pp_common as pc  # noqa: E402

OUT_JSON = pc.REPO_ROOT / "docs" / "art" / "pixel_pipeline" / "asset_catalog.json"
OUT_MD = pc.REPO_ROOT / "docs" / "art" / "pixel_pipeline" / "minimax_prompt_pack.md"

KEY_GREEN = "#00FF00"
KEY_MAGENTA = "#FF00FF"  # used when the subject itself is green (venom ramp) - green key would eat it

RAMP_ZH = {
    "pyro": "火（暗红→橙→浅黄）", "cryo": "冰（深蓝→青→冰白）", "lightning": "雷（暗金→亮黄）",
    "venom": "毒（墨绿→酸绿）", "laser": "激光（酒红→粉）", "echo": "回响（靛→紫→淡紫）",
    "steel": "钢（蓝灰）", "stone": "磨石（暖灰褐）", "white": "白（仅高光）",
}
RAMP_EN = {
    "pyro": "fire ramp (dark red to orange to pale yellow)", "cryo": "ice ramp (deep blue to cyan to ice white)",
    "lightning": "lightning ramp (dark gold to bright yellow)", "venom": "venom ramp (dark green to acid green)",
    "laser": "laser ramp (wine red to pink)", "echo": "echo ramp (indigo to violet to lavender)",
    "steel": "steel blue-grey", "stone": "warm grey-brown whetstone", "white": "white highlights only",
}

REQUEST_SIZE = {
    (1, 1): "1024x1024", (2, 1): "1536x768", (1, 2): "768x1536", (3, 1): "1536x512",
    (1, 3): "512x1536", (2, 2): "1024x1024", (3, 2): "1536x1024", (2, 3): "1024x1536",
    (3, 3): "1024x1024", (4, 3): "1536x1152",
}

# --------------------------------------------------------------------------- roster
# fields: id, group, class, name_zh, feature_zh, feature_en, subject_zh, subject_en, ramps, anchor, extra
E = []


def add(aid, group, cls, name_zh, ramps, feature_zh, feature_en, subject_zh, subject_en, anchor,
        negative_extra_zh="", negative_extra_en="", weak_zh="", weak_en="", collision=None, note=""):
    E.append(dict(id=aid, group=group, cls=cls, name_zh=name_zh, ramps=ramps,
                  feature_zh=feature_zh, feature_en=feature_en, subject_zh=subject_zh, subject_en=subject_en,
                  anchor=anchor, neg_zh=negative_extra_zh, neg_en=negative_extra_en,
                  weak_zh=weak_zh, weak_en=weak_en, collision=collision, note=note))


# ---- normal enemies: base + V2 archetypes (footprint = collision)
add("enemy_residue_1x1", "enemy", "enemy_1x1", "炼金残渣（标准 1×1）", ["stone", "echo"],
    "居中一颗小镶嵌核心", "one small inlaid core in the centre",
    "一块切角几何磨石块，表面少量裂纹，中心嵌一颗小紫色晶核", "a chamfered geometric whetstone block with a few cracks and one small violet crystal core inlaid in the centre",
    "docs/enemy_visual_design_v2.md §4.1")
add("enemy_bastion_3x1", "enemy", "enemy_3x1", "重装横梁 heavyArmor", ["steel", "stone"],
    "横向三段厚装甲板 + 两排铆钉，横向封锁感", "three thick horizontal armour plates with two rows of rivets, reads as a wall",
    "横向三格长的磨石装甲横梁，厚边框，铆钉槽", "a long horizontal whetstone armour beam three cells wide, thick frame, riveted slots",
    "src/spawn_system.js:3427 (3x1)")
add("enemy_deflector_2x1", "enemy", "enemy_2x1", "棱盾兽 deflectionWard", ["cryo", "steel"],
    "正面一块斜置的大楔形护板（偏折屏障）", "one big slanted wedge barrier plate on the front",
    "横向两格的楔形磨石兽，前方顶着一块斜置晶盾", "a two-cell-wide wedge-shaped whetstone beast pushing a slanted crystal shield plate in front",
    "src/spawn_system.js:3426 (2x1)")
add("enemy_echo_spire_1x2", "enemy", "enemy_1x2", "共振尖塔 echoRelay", ["echo", "stone"],
    "顶部一颗裂纹晶核 + 两道同心回响环", "one cracked crystal core on top with two concentric echo rings",
    "纵向两格的细高磨石尖塔，塔顶嵌裂纹紫晶", "a tall thin whetstone spire two cells high with a cracked violet crystal at the tip",
    "src/spawn_system.js:3425 (1x2)")
add("enemy_prism_1x3", "enemy", "enemy_1x3", "折光棱柱 prism", ["cryo", "laser"],
    "纵向三棱柱 + 一道被劈成两束的光", "a tall triangular prism splitting one beam into two",
    "纵向三格的透明棱柱石，内部有分束的光路", "a three-cell-tall translucent prism column with a split light path inside",
    "src/spawn_system.js:3423 (1x3)")
add("enemy_maw_2x2", "enemy", "enemy_2x2", "深渊胃囊 maw (devour)", ["laser", "stone"],
    "正面一个张开的大吞噬口（暗红旋涡）", "one huge open devouring mouth with a dark red swirl",
    "2×2 的圆角掏空磨石胃囊，底部锯齿石槽", "a 2x2 rounded hollow whetstone stomach with a jagged toothed slot at the bottom",
    "src/spawn_system.js:3424 (2x2)")
add("enemy_hive_2x3", "enemy", "enemy_2x3", "孵化巢 hive", ["venom", "stone"],
    "三个排成竖列的孵化卵孔（一个正在开裂）", "three egg pods in a column, one cracking open",
    "2 列 3 行的竖向巢穴磨石，表面嵌卵囊", "a tall nest-shaped whetstone two cells wide three cells high with egg pods embedded",
    "src/spawn_system.js:3422 (2x3)")
add("enemy_siege_3x2", "enemy", "enemy_3x2", "破阵履带 siege", ["lightning", "steel"],
    "底部履带 + 正前方一根撞角", "tank treads at the bottom and one battering ram in front",
    "3 列 2 行的履带石板，正面撞角", "a 3x2 tracked stone slab with a battering ram on its front edge",
    "src/spawn_system.js:3421 (3x2)")
add("enemy_carrier_3x2", "enemy", "enemy_3x2", "铸巢母架 carrier（冂形）", ["cryo", "steel"],
    "冂形：下排中间第 5 格必须是空洞（投放舱）", "an upside-down U shape: the bottom-middle cell is an empty launch bay",
    "3×2 冂形甲板，左右两条腿，下排正中留空", "a 3x2 upside-down-U deck, two legs left and right, the bottom-centre cell left empty",
    "src/spawn_system.js:3420; docs/enemy_visual_design_v2.md §6",
    "下排正中被填满", "bottom-centre cell filled in",
    note="碰撞非矩形：填充率按 3×2 盒计，第 5 格空洞须人工确认")
add("enemy_gravity_core_3x3", "enemy", "enemy_3x3", "引力炉心 gravityWell", ["echo", "steel"],
    "中心黑核 + 三层环形炉壁", "a black core in the centre with three concentric furnace rings",
    "3×3 的圆形炉心磨石，向心网格线", "a 3x3 round furnace-core whetstone with inward-collapsing grid lines",
    "src/spawn_system.js:3419 (3x3)")

# ---- boss minions (1x1)
_MINION = [
    ("ignis", "炉卫随从 furnace_guard", ["pyro", "steel"], "胸口一个小炉口", "a small furnace mouth on the chest"),
    ("glacies", "霜缝随从 frost_stitch", ["cryo", "steel"], "身上一道缝合的冰裂", "one stitched ice crack across the body"),
    ("mikro", "裂变细胞 fission_cell", ["echo", "white"], "一分为二的细胞膜（中间缢缩）", "a cell membrane pinching into two"),
    ("devourer", "胃域仆从 maw_thrall", ["laser", "stone"], "一张小獠牙嘴", "one small fanged mouth"),
    ("viridis", "孢甲侍从 spore_vassal", ["venom", "stone"], "背上两颗孢子囊", "two spore pods on its back"),
    ("tesla", "导体 conductor", ["lightning", "steel"], "头顶一根导电避雷针", "one conductor rod sticking up"),
    ("chimera", "混沌养料 chaos_feed", ["pyro", "cryo"], "左冷右热的半边配色", "left half cold blue, right half hot orange"),
    ("ouroboros", "回声附环 orbit_echo", ["echo", "steel"], "一个首尾相衔的小环", "a small ring biting its own tail"),
]
for boss, nm, ramps, fzh, fen in _MINION:
    add(f"minion_{boss}_1x1", "enemy", "enemy_1x1", nm, ramps, fzh, fen,
        "单格小磨石怪，Boss 同族配色", "a single-cell small whetstone creature in its boss family colours",
        "src/config.js:914-923 bossMinionProfiles")

# ---- elites (1x1; affix = one big silhouette feature, no text badge)
add("elite_base_1x1", "elite", "elite_1x1", "精英底形（无词条）", ["stone", "echo"],
    "四角各一枚尖棱（精英冠角），核心比普通怪更大", "four sharp corner spikes (elite crown), larger core than a normal enemy",
    "单格切角磨石块，四角突出尖棱", "a single-cell chamfered whetstone block with four protruding corner spikes",
    "docs/design/art_vfx_ui_direction_v1.md §2.2")
_AFFIX = [
    ("shield", "护盾 shield", ["steel", "stone"], "外层整圈甲片（像盔甲包住身体）", "a full ring of outer armour plates wrapping the body", "config.js gameplay.affixes.shieldReduction"),
    ("regen", "再生 regen", ["venom", "stone"], "一道螺旋状的再生愈合缝（新长出的嫩芽）", "one spiral healing seam with fresh sprouts", "config.js gameplay.affixes.regenPercent"),
    ("healer", "治愈 healer", ["venom", "white"], "正中一个大十字核心", "a big cross-shaped core in the centre", "config.js gameplay.affixes.healerPercent"),
    ("haste", "极速 haste", ["lightning", "stone"], "身体前倾 + 身后三道速度尾迹", "body leaning forward with three speed trails behind", "config.js gameplay.affixes.hasteActions"),
    ("jump", "跳跃 jump", ["cryo", "stone"], "下蹲弹簧腿（两条压缩的粗腿）", "two crouched spring legs, compressed", "config.js gameplay.affixes.jumpRows"),
    ("clone", "增殖 clone", ["echo", "stone"], "身上冒出三颗芽孢小分身", "three budding spores sprouting from the body", "config.js gameplay.affixes.cloneChanceHit"),
    ("berserk", "狂暴 berserk", ["pyro", "stone"], "裂开的外壳露出炽热内核 + 锯齿尖刺", "split-open shell exposing a red-hot core, jagged spikes", "config.js gameplay.affixes.berserkChanceMult"),
    ("devour", "吞噬 devour", ["laser", "stone"], "正面一张大獠牙口", "one big fanged mouth on the front", "config.js gameplay.affixes.devourChance"),
    ("radiantAegis", "流彩护盾 radiantAegis", ["cryo", "laser"], "头顶一圈棱镜冠片", "a crown of prismatic plates on top", "config.js gameplay.affixes.radiantAegisBossRegenPct"),
    ("livingArmor", "活体护甲 livingArmor", ["venom", "stone"], "树皮状的活体外壳包裹", "a bark-like living shell wrapping the body", "config.js gameplay.affixes.livingArmorPct"),
    ("armorSpore", "护甲孢子 armorSpore", ["venom", "steel"], "甲片上长着两颗孢子囊", "two spore pods growing on armour plates", "config.js gameplay.affixes.armorSporeStackPct"),
    ("siegeBreaker", "撞城者 siegeBreaker", ["steel", "stone"], "正前方一根加固撞角", "one reinforced ram horn in front", "config.js gameplay.affixes.siegeBreakerDamageMult"),
    ("deflectShell", "偏折壳 deflectShell", ["cryo", "steel"], "光滑多棱面的倾斜外壳（子弹会被弹偏）", "a smooth faceted slanted shell that deflects shots", "config.js gameplay.affixes.deflectShellNormalRotateAmp"),
    ("energyArmor", "蓄能甲 energyArmor", ["lightning", "steel"], "胸前一块蓄电池甲板（电格刻度）", "a battery plate with charge cells on the chest", "config.js gameplay.affixes.energyArmorThresholdPct"),
    ("phaseShield", "相位护盾 phaseShield", ["echo", "white"], "偏移半格的幽灵重影外壳", "a ghostly duplicate shell offset by half a step", "config.js gameplay.affixes.phaseShieldCycle"),
    ("overloadReactor", "过量反应炉 overloadReactor", ["pyro", "lightning"], "背后两根反应炉排气管", "two reactor exhaust vents on the back", "config.js gameplay.affixes.overloadStepPct"),
    ("lowDamageImmune", "低伤免疫 lowDamageImmune", ["steel", "white"], "钻石般的厚硬棱面外壳", "a thick diamond-hard faceted carapace", "config.js gameplay.affixes.lowDamageImmunePct"),
    ("runeBearer", "符文携带者 runeBearer", ["echo", "stone"], "背着一块刻符石板（只画符号形，不画文字）", "carrying a carved rune tablet (glyph shape only, no letters)", "config.js gameplay.affixes.runeBearerTempAffixPool"),
]
for afx, nm, ramps, fzh, fen, anchor in _AFFIX:
    add(f"elite_{afx}_1x1", "elite", "elite_1x1", nm, ramps, fzh, fen,
        "单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上", "a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure",
        f"src/{anchor}")

# ---- bosses (weak point must be readable; it is the mechanic's counter target)
_BOSS = [
    ("ignis", "boss_2x2", "熔炉守卫·伊格尼斯", ["pyro", "steel"],
     "外层多块护盾甲片 + 胸口熔炉", "layered outer shield plates over a chest furnace",
     "胸口熔炉格栅（破甲熔炉：穿透 / 火 3 次命中）", "the chest furnace grille (pierce / pyro, 3 hits)",
     "厚重的熔炉守卫，石甲覆盖全身，胸口炉门", "a heavy furnace guardian covered in stone armour with a furnace door on the chest"),
    ("glacies", "boss_2x2", "霜晶缝合怪·格拉西斯", ["cryo", "steel"],
     "全身缝合的冰晶块 + 强壮跳跃后腿", "stitched ice crystal chunks and strong jumping hind legs",
     "正中一道发光的缝合冰裂（冻结裂隙：冰 / 穿透）", "one glowing stitched ice seam in the middle (cryo / pierce)",
     "由冰晶块缝合而成的怪物", "a monster stitched together from ice crystal chunks"),
    ("mikro", "boss_2x2", "裂变母体·米克罗", ["echo", "white"],
     "半透明细胞母体 + 外缘三个连接分身的链节", "a translucent mother cell with three link nodes on its rim tethering clones",
     "膜上三个链节（群体断链：雷 / 散射 5 次命中）", "three link nodes on the membrane (lightning / scatter, 5 hits)",
     "巨大的分裂细胞母体，内部有多个核", "a giant dividing mother cell with several nuclei inside"),
    ("devourer", "boss_2x2", "贪婪之渊·噬神者", ["laser", "stone"],
     "占身体一半的深渊巨口", "an abyssal mouth taking up half the body",
     "巨口内部（深渊开口：弹射 / 激光）", "the inside of the mouth (bounce / laser)",
     "贪婪的深渊胃囊巨兽，环形獠牙", "a greedy abyssal stomach beast with a ring of fangs"),
    ("viridis", "boss_3x3", "翠绿共生体·维里迪斯", ["venom", "stone"],
     "孢甲甲片 + 正中开花的孢子囊", "spore-armour plates with a blooming spore pod in the centre",
     "正中孢子花苞（孢甲净化：火 / 毒）", "the central spore bloom (pyro / venom)",
     "巨大的植物-磨石共生体，甲片间长满孢子", "a huge plant-and-stone symbiote with spores growing between plates"),
    ("tesla", "boss_3x3", "雷霆幻影·特斯拉", ["lightning", "cryo"],
     "肩上两组导体线圈 + 脚下一根接地桩", "two conductor coils on the shoulders and one grounding spike below",
     "脚下接地桩（导体接地：冰 / 弹射 4 次命中）", "the grounding spike at the base (cryo / bounce, 4 hits)",
     "高速的雷电幻影机体", "a fast lightning phantom construct"),
    ("chimera", "boss_3x3", "混沌融合体·奇美拉", ["venom", "pyro", "cryo"],
     "左半冰冷、右半炽热的融合体 + 中间污染胃囊", "left half frozen, right half burning, polluted stomach in the middle",
     "中央污染胃囊（污染胃域：毒 / 激光）", "the central polluted stomach (venom / laser)",
     "两种生物拼合的混沌巨兽", "a chaotic beast fused from two creatures",
     ),
    ("ouroboros", "boss_3x3", "永恒回声·奥罗波罗斯", ["echo", "steel"],
     "首尾相衔的巨蛇环 + 环上六个附体插槽", "a great serpent ring biting its tail with six attachment sockets on the ring",
     "当前点亮的那个插槽（轮转破绽，6 组）", "the currently lit socket (rotating weak point, 6 sets)",
     "回响能量构成的衔尾蛇", "an ouroboros serpent made of echo energy"),
]
for boss, cls, nm, ramps, fzh, fen, wzh, wen, szh, sen in _BOSS:
    add(f"boss_{boss}", "boss", cls, nm, ramps, fzh, fen, szh, sen,
        f"src/config.js bossConfigs.{boss} (vulnerability) + BOSS_DB",
        weak_zh=wzh, weak_en=wen,
        note="Boss 尺寸以规格 §2.2 为准；当前代码 4×3 格（spawn_system.js:2587）待对齐")

# ---- icons
_ICON_STYLE = ("icon",)


def icon(aid, cls, nm, ramps, symbol_zh, symbol_en, anchor):
    add(aid, "icon", cls, nm, ramps, symbol_zh, symbol_en, symbol_zh, symbol_en, anchor)


icon("icon_energy_24", "icon_24", "能量 ⚡", ["lightning"], "一道粗闪电能量结晶", "a chunky lightning-bolt energy crystal", "dig_build_defend_loop_v1.md §4")
icon("icon_energy_16", "icon_16", "能量 ⚡（HUD 16）", ["lightning"], "一道粗闪电", "a single chunky lightning bolt", "dig_build_defend_loop_v1.md §4")
icon("icon_crystal_24", "icon_24", "晶核 💎", ["echo"], "一颗切面晶核宝石", "one faceted crystal core gem", "dig_build_defend_loop_v1.md §4")
icon("icon_crystal_16", "icon_16", "晶核 💎（HUD 16）", ["echo"], "一颗菱形宝石", "one rhombus gem", "dig_build_defend_loop_v1.md §4")
icon("icon_cannon_damage", "icon_24", "主炮·伤害", ["pyro", "steel"], "炮口 + 一个向上箭头的炮弹（伤害）", "a cannon muzzle with a heavy shell and an up arrow", "dig_build_defend_loop_v1.md §5.1")
icon("icon_cannon_rate", "icon_24", "主炮·射速", ["lightning", "steel"], "炮口 + 两发连射炮弹", "a cannon muzzle firing two shells in a row", "dig_build_defend_loop_v1.md §5.1")
icon("icon_cannon_bounce", "icon_24", "主炮·弹道（反弹）", ["cryo", "steel"], "一发炮弹走折线反弹轨迹", "one shell on a zig-zag bouncing path", "dig_build_defend_loop_v1.md §5.1")
icon("icon_branch_pierce", "icon_24", "分支·穿透", ["steel", "white"], "一把贯穿两块石板的飞剑", "a flying sword piercing through two stone slabs", "dig_build_defend_loop_v1.md §5.1")
icon("icon_branch_scatter", "icon_24", "分支·散射", ["cryo", "steel"], "三道扇形散开的风刃", "three wind blades fanning out", "dig_build_defend_loop_v1.md §5.1")
icon("icon_branch_element_pyro", "icon_24", "分支·元素（火）", ["pyro"], "炮弹裹着火舌", "a shell wrapped in flame tongues", "dig_build_defend_loop_v1.md §5.1")
icon("icon_branch_element_cryo", "icon_24", "分支·元素（冰）", ["cryo"], "炮弹镶着冰菱", "a shell set with ice rhombus crystals", "dig_build_defend_loop_v1.md §5.1")
icon("icon_branch_element_lightning", "icon_24", "分支·元素（雷）", ["lightning"], "炮弹缠着折线闪电", "a shell wrapped in zig-zag lightning", "dig_build_defend_loop_v1.md §5.1")
icon("icon_facility_turret", "icon_24", "设施·炮台", ["steel", "pyro"], "一座单管小炮台", "a small single-barrel turret", "dig_build_defend_loop_v1.md §5.2")
icon("icon_facility_lightning_tower", "icon_24", "设施·雷击塔", ["lightning", "steel"], "塔顶放出连锁闪电的高塔", "a tower releasing a chain of lightning from its tip", "dig_build_defend_loop_v1.md §5.2")
icon("icon_facility_frost_tower", "icon_24", "设施·冰霜塔", ["cryo", "steel"], "塔顶一颗冰晶的塔", "a tower topped with an ice crystal", "dig_build_defend_loop_v1.md §5.2")
icon("icon_facility_shield_generator", "icon_24", "设施·结界发生器", ["cryo", "echo"], "底座上方一面半圆结界盾", "a half-dome barrier shield above a base", "dig_build_defend_loop_v1.md §5.2")
icon("icon_facility_alchemy_collector", "icon_24", "设施·炼金收集器", ["lightning", "stone"], "接住闪电能量的炼金漏斗", "an alchemy funnel catching lightning energy", "dig_build_defend_loop_v1.md §5.2")
icon("icon_item_bomb", "icon_24", "道具·炸弹", ["pyro", "steel"], "一颗点燃引信的圆炸弹", "one round bomb with a lit fuse", "dig_build_defend_loop_v1.md §5.4")
icon("icon_item_timestop", "icon_24", "道具·时停", ["echo", "white"], "一只停住的沙漏", "one frozen hourglass", "dig_build_defend_loop_v1.md §5.4")
icon("icon_item_emergency_shield", "icon_24", "道具·急救结界", ["cryo", "white"], "一面带十字的盾", "a shield with a cross on it", "dig_build_defend_loop_v1.md §5.4")
icon("icon_item_extra_dig", "icon_24", "道具·加挖", ["stone", "lightning"], "一把镐 + 两颗额外弹珠", "a pickaxe with two extra marbles", "dig_build_defend_loop_v1.md §5.4")
icon("icon_mining_collector_plus1", "icon_24", "挖矿·采集弹珠 +1", ["steel", "lightning"], "三颗弹珠排一行，最后一颗发亮", "three marbles in a row, the last one glowing", "dig_build_defend_loop_v1.md §6")
icon("icon_mining_wide_bucket", "icon_24", "挖矿·宽口能量桶", ["lightning", "stone"], "一个口特别宽的能量桶", "an energy bucket with an extra-wide mouth", "dig_build_defend_loop_v1.md §6")
icon("icon_mining_magnet_peg", "icon_24", "挖矿·磁力钉", ["laser", "steel"], "一颗马蹄磁铁形的钉子吸住弹珠", "a horseshoe-magnet peg pulling a marble", "dig_build_defend_loop_v1.md §6")
icon("icon_mining_throat_widen", "icon_24", "挖矿·咽喉加宽", ["echo", "stone"], "一道窄门被两个向外箭头撑宽", "a narrow gate pushed wider by two outward arrows", "dig_build_defend_loop_v1.md §6")
for el, nm, ramps, szh, sen in [
    ("pyro", "火", ["pyro"], "一簇火舌", "one flame tongue"),
    ("cryo", "冰", ["cryo"], "一颗冰菱", "one ice rhombus"),
    ("lightning", "雷", ["lightning"], "一道折线闪电", "one zig-zag bolt"),
    ("venom", "毒", ["venom"], "一颗液滴", "one droplet"),
    ("wind", "风", ["steel", "cryo"], "一个旋涡", "one swirl vortex"),
    ("laser", "激光", ["laser"], "一道直线光束", "one straight beam"),
    ("pierce", "穿透", ["steel", "white"], "一支穿过横线的箭", "one arrow passing through a bar"),
    ("scatter", "散射", ["cryo", "white"], "三道扇形短线", "three short lines fanning out"),
]:
    icon(f"icon_mark_{el}", "icon_16", f"元素标记·{nm}", ramps, szh, sen, "art_vfx_ui_direction_v1.md §4.2")


# --------------------------------------------------------------------------- render

STYLE_ZH = ("像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，"
            "单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 {key}，无文字无字母无 UI 边框")
STYLE_EN = ("pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, "
            "no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, "
            "bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, "
            "solid pure {key} background, no text, no letters, no UI frame")
ICON_STYLE_ZH = ("像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，"
                 "粗剪影与深色粗描边，最多 {n} 种颜色，纯色背景 {key}，无文字无数字无边框")
ICON_STYLE_EN = ("pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, "
                 "no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, "
                 "at most {n} colours, solid pure {key} background, no text, no numbers, no frame")
NEG_ZH = "写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景"
NEG_EN = ("photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, "
          "noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery")


def key_for(entry):
    ramps = entry["ramps"]
    if "venom" in ramps and "laser" in ramps:
        raise ValueError(f"{entry['id']}: venom+laser has no safe key color")
    return KEY_MAGENTA if "venom" in ramps else KEY_GREEN


def build_entries():
    out = []
    seen = set()
    for e in E:
        if e["id"] in seen:
            raise ValueError(f"duplicate id {e['id']}")
        seen.add(e["id"])
        spec = pc.parse_class(e["cls"])
        key = key_for(e)
        cells = spec.cells or (1, 1)
        size = REQUEST_SIZE.get(cells, "1024x1024")
        ramps_zh = "、".join(RAMP_ZH[r] for r in e["ramps"])
        ramps_en = ", ".join(RAMP_EN[r] for r in e["ramps"])
        if e["group"] == "icon":
            ncol = 4 if spec.width <= 16 else 6
            p_zh = (f"{e['subject_zh']}。只表达一个符号 + 一个元素色。配色：{ramps_zh}。"
                    + ICON_STYLE_ZH.format(n=ncol, key=key))
            p_en = (f"{e['subject_en']}. One symbol plus one element colour only. Palette: {ramps_en}. "
                    + ICON_STYLE_EN.format(n=ncol, key=key))
        else:
            weak_zh = f"弱点必须清晰可见并做成最亮色块：{e['weak_zh']}。" if e["weak_zh"] else ""
            weak_en = f"The weak point must be clearly visible as the brightest block: {e['weak_en']}. " if e["weak_en"] else ""
            foot = f"占格 {cells[0]}×{cells[1]}，轮廓填满该比例的外框。"
            foot_en = f"Footprint {cells[0]}x{cells[1]} cells; the silhouette fills a box of that aspect ratio. "
            p_zh = (f"{e['subject_zh']}。唯一的大机制特征：{e['feature_zh']}。{weak_zh}{foot}配色：{ramps_zh}。"
                    + STYLE_ZH.format(key=key))
            p_en = (f"{e['subject_en']}. One big readable mechanic feature: {e['feature_en']}. {weak_en}{foot_en}"
                    f"Palette: {ramps_en}. " + STYLE_EN.format(key=key))
        neg_zh = NEG_ZH + ("，" + e["neg_zh"] if e["neg_zh"] else "")
        neg_en = NEG_EN + (", " + e["neg_en"] if e["neg_en"] else "")
        if key == KEY_MAGENTA:
            neg_zh += "，品红色主体"
            neg_en += ", magenta subject"
        else:
            neg_zh += "，绿色主体"
            neg_en += ", green subject"
        out.append({
            "id": e["id"], "group": e["group"], "class": e["cls"], "name_zh": e["name_zh"],
            "grid_px": [spec.width, spec.height], "cells": list(spec.cells) if spec.cells else None,
            "collision": list(e["collision"]) if e["collision"] else None,
            "feature_zh": e["feature_zh"], "feature_en": e["feature_en"],
            "weak_point_zh": e["weak_zh"] or None, "weak_point_en": e["weak_en"] or None,
            "ramps": e["ramps"], "key_color": key, "request_size": size,
            "prompt_zh": p_zh, "prompt_en": p_en, "negative_zh": neg_zh, "negative_en": neg_en,
            "anchor": e["anchor"], "note": e["note"] or None,
        })
    return out


def render_md(entries):
    L = []
    w = L.append
    w("# MiniMax 提示词包（路线 A：正式素材）")
    w("")
    w("> 由 `scripts/pixel_pipeline/asset_catalog.py` 生成，**不要手改本文件**；改条目请改脚本后重跑 "
      "`python scripts/pixel_pipeline/asset_catalog.py`。同时生成 `asset_catalog.json`（`run_all.py` 按它把 id 映射到类别）。")
    w(">")
    w("> 状态：provisional。依据 `docs/design/art_vfx_ui_direction_v1.md` §2 / §3 / §5（A1 = 1 美术像素 ≈ 2 CSS px，A2 = A + C）。"
      "不判断好不好看；MiniMax 的具体参数名（种子、参考图、尺寸）本线**未核对**，以你手上的 MiniMax 入口为准。")
    w("")
    w("## 1. 全局风格块（每条提示词已内嵌，单独列出便于统一修改）")
    w("")
    w("**中文**：" + STYLE_ZH.format(key="#00FF00"))
    w("")
    w("**English**: " + STYLE_EN.format(key="#00FF00"))
    w("")
    w("**图标版**：" + ICON_STYLE_ZH.format(n="4–6", key="#00FF00") + " / " + ICON_STYLE_EN.format(n="4-6", key="#00FF00"))
    w("")
    w("**全局负面提示词**：" + NEG_ZH + " / " + NEG_EN)
    w("")
    w("**规则要点**")
    w("")
    w("- 敌人、精英、Boss：正交 3/4 视角；图标：正面正交。全部平涂、无投影 / 渐变 / 轮廓光 / 发光。")
    w("- 单一主体居中约占 80%；剪影要粗；**每个词条只做一个大造型特征**，不画文字徽章（取代 `R:py` / `A:cr`）。")
    w("- 背景纯色键控：默认 `#00FF00`；**主体本身是绿色（毒色带）的条目改用 `#FF00FF`**，否则抠图会吃掉主体。"
      "这是本管线的约定，与 §5.4「纯色键控背景（不在调色板里）」一致——两种键色都不在调色板里。")
    w("- 颜色只给方向（色带名），最终颜色由管线映射到 `palette.json`；生图阶段越少色越好。")
    w("- **风格一致性**：先用 `enemy_residue_1x1` 出一张大家认可的「风格锚图」，放到 `assets_src/minimax/_style_ref/style_anchor.png`。"
      "之后每条都：(a) 若你的 MiniMax 入口支持参考图 / 主体参考，就挂这张锚图；(b) 若支持种子，整批固定同一个种子（建议 `20261022`）并记录在 "
      "`assets_src/minimax/_style_ref/seed.txt`；(c) 两者都不支持时，风格块逐字不改。以上参数是否存在**未核对**。")
    w("- 尺寸：按表中「请求尺寸」（与占格同宽高比）；入口不支持该尺寸时出 1:1，管线会按内容裁切后等比缩放，不会拉伸。")
    w("")
    w("## 2. 放置约定与一键命令")
    w("")
    w("1. 生成后把图存为 `assets_src/minimax/<asset_id>.png`（`.jpg` / `.webp` 也认；文件名必须等于下表 id）。")
    w("2. 可选：保护蒙版 `assets_src/minimax/<asset_id>.protect.png`（白 = 眼睛 / 核心 / 词条特征，与原图同尺寸），这些像素不会被去噪删掉。")
    w("3. 在仓库根目录运行：")
    w("")
    w("```")
    w("python scripts/pixel_pipeline/run_all.py")
    w("```")
    w("")
    w("默认读 `assets_src/minimax/`，输出到 `assets_src/pixel_out/`（PNG + 每张一个 JSON 清单 + `check_report.json` + `contact_sheet.png`），"
      "**不会写 `assets/`**。只跑部分：`python scripts/pixel_pipeline/run_all.py --only boss_ignis,icon_item_bomb`。"
      "机检有 FAIL 时退出码为 1。之后的人工修整与入库见 `README.md`。")
    w("")
    groups = [("enemy", "3. 普通敌人（基底 + 原型 + Boss 随从）"), ("elite", "4. 精英（词条 = 一个大造型特征）"),
              ("boss", "5. Boss（弱点必须可读）"), ("icon", "6. UI 图标")]
    for g, title in groups:
        rows = [e for e in entries if e["group"] == g]
        w(f"## {title}（{len(rows)} 条）")
        w("")
        w("| id | 名称 | 类别 / 网格 | 占格 | 必须可读的特征 | 色带 | 键色 | 请求尺寸 |")
        w("|---|---|---|---|---|---|---|---|")
        for e in rows:
            cells = f"{e['cells'][0]}×{e['cells'][1]}" if e["cells"] else "—"
            feat = e["feature_zh"] + (f"；**弱点**：{e['weak_point_zh']}" if e["weak_point_zh"] else "")
            if e["note"]:
                feat += f"（{e['note']}）"
            w(f"| `{e['id']}` | {e['name_zh']} | `{e['class']}` {e['grid_px'][0]}×{e['grid_px'][1]} | {cells} | {feat} | "
              f"{' / '.join(e['ramps'])} | `{e['key_color']}` | {e['request_size']} |")
        w("")
        w("<details><summary>逐条提示词（中 / 英 / 负面）</summary>")
        w("")
        for e in rows:
            w(f"#### `{e['id']}` — {e['name_zh']}")
            w("")
            w(f"- 依据：`{e['anchor']}`")
            w(f"- 中文：{e['prompt_zh']}")
            w(f"- English: {e['prompt_en']}")
            w(f"- 负面 / Negative：{e['negative_zh']} / {e['negative_en']}")
            w("")
        w("</details>")
        w("")
    w("## 7. 未覆盖与待拍板")
    w("")
    w("- **Boss 尺寸**：规格 §2.2 是 2×2 / 3×3 且与碰撞一致；当前代码所有 Boss 按 4×3 格生成（`src/spawn_system.js:2587-2595`）。"
      "本包按规格出图；若最终保留 4×3，把对应条目类别改为 `boss_4x3`（96×72）再跑即可，提示词的宽高比也要跟着改。")
    w("- **双词条精英**：不逐组合出图；先按单词条出，组合态由运行时叠加或人工合成（未定）。")
    w("- **Boss 动画帧、受击帧、像素破碎血量的保护核心蒙版**：需人工；本包只出首帧概念。")
    w("- **16px 图标**：规格要求单独手绘；这里的 16px 条目只给概念与自动初稿，必须人工逐像素修。")
    w("- **风元素**：调色板 v1 没有独立风色带，风标记用钢 + 冰色（见 `palette.json` notes）。")
    w("")
    return "\n".join(L) + "\n"


def main():
    entries = build_entries()
    pc.write_json(OUT_JSON, {"schema": "echo-alchemist/pixel-asset-catalog@1",
                             "generated_by": "scripts/pixel_pipeline/asset_catalog.py",
                             "count": len(entries), "assets": entries})
    md = render_md(entries)
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_MD, "w", encoding="utf-8", newline="\n") as f:
        f.write(md)
    if OUT_MD.read_text(encoding="utf-8") != md:
        raise IOError("read-back mismatch for prompt pack")
    by = {}
    for e in entries:
        by[e["group"]] = by.get(e["group"], 0) + 1
    print(f"[asset_catalog] {len(entries)} assets {by} -> {pc.rel_to_repo(OUT_JSON)}, {pc.rel_to_repo(OUT_MD)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
