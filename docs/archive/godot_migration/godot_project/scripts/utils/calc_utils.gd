# calc_utils.gd
# 工具函数脚本 - 包含颜色操作和数学计算函数
# 对应 JavaScript 中的辅助函数

class_name CalcUtils

## 调整颜色亮度
## 参数:
##   - color: Color 对象
##   - factor: 亮度因子（1.0 为原色，>1.0 变亮，<1.0 变暗）
## 返回: 调整后的 Color 对象
static func adjust_color_brightness(color: Color, factor: float) -> Color:
	var r = clamp(color.r * factor, 0.0, 1.0)
	var g = clamp(color.g * factor, 0.0, 1.0)
	var b = clamp(color.b * factor, 0.0, 1.0)
	return Color(r, g, b, color.a)


## 颜色线性插值
## 参数:
##   - color_a: 起始颜色
##   - color_b: 结束颜色
##   - amount: 插值系数（0.0 到 1.0）
## 返回: 插值后的 Color 对象
static func lerp_color(color_a: Color, color_b: Color, amount: float) -> Color:
	return color_a.lerp(color_b, amount)


## 数值线性插值
## 参数:
##   - start: 起始值
##   - end: 结束值
##   - t: 插值系数（0.0 到 1.0）
## 返回: 插值后的数值
static func lerp(start: float, end: float, t: float) -> float:
	return start * (1.0 - t) + end * t


## 从十六进制字符串转换为 Color
## 参数:
##   - hex: 十六进制颜色字符串（如 "#FF0000" 或 "FF0000"）
## 返回: Color 对象
static func hex_to_color(hex: String) -> Color:
	hex = hex.trim_prefix("#").to_upper()
	
	# 处理短格式 (如 "F00" -> "FF0000")
	if hex.length() == 3:
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
	
	if hex.length() != 6:
		push_error("Invalid hex color format: " + hex)
		return Color.WHITE
	
	var r = hex.substr(0, 2).hex_to_int() / 255.0
	var g = hex.substr(2, 2).hex_to_int() / 255.0
	var b = hex.substr(4, 2).hex_to_int() / 255.0
	
	return Color(r, g, b, 1.0)


## 将 Color 转换为十六进制字符串
## 参数:
##   - color: Color 对象
## 返回: 十六进制颜色字符串（如 "#FF0000"）
static func color_to_hex(color: Color) -> String:
	var r = int(clamp(color.r * 255, 0, 255))
	var g = int(clamp(color.g * 255, 0, 255))
	var b = int(clamp(color.b * 255, 0, 255))
	
	return "#" + "%02X" % r + "%02X" % g + "%02X" % b
