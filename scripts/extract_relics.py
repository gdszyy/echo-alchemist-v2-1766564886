import re

with open('/home/ubuntu/echo-alchemist-v2/src/config.js') as f:
    content = f.read()

start = content.find('const RELIC_DB = [')
# 找到 RELIC_DB 结束的位置（下一个 const 或 export）
end = content.find('\nconst BOARD_STRUCTURE', start)
if end == -1:
    end = content.find('\nexport {', start)
if end == -1:
    end = len(content)
relic_section = content[start:end]

# 用更宽松的正则提取所有 id
all_ids = re.findall(r"id:\s*'([^']+)'", relic_section)
all_names = re.findall(r"name:\s*'([^']+)'", relic_section)
all_icons = re.findall(r"icon:\s*'([^']+)'", relic_section)
all_rarities = re.findall(r"rarity:\s*'([^']+)'", relic_section)

print(f"IDs: {len(all_ids)}, Names: {len(all_names)}, Icons: {len(all_icons)}, Rarities: {len(all_rarities)}")

# 逐块提取（按 id: 分割）
results = []
# 找所有 { id: 'xxx' 的位置
pattern = re.compile(r'\{\s*\n?\s*id:\s*\'([^\']+)\'', re.MULTILINE)
id_positions = [(m.start(), m.group(1)) for m in pattern.finditer(relic_section)]

for i, (pos, rid) in enumerate(id_positions):
    # 取到下一个遗物开始前的内容
    end_pos = id_positions[i+1][0] if i+1 < len(id_positions) else len(relic_section)
    block = relic_section[pos:end_pos]
    
    name_m = re.search(r"name:\s*'([^']+)'", block)
    icon_m = re.search(r"icon:\s*'([^']+)'", block)
    rarity_m = re.search(r"rarity:\s*'([^']+)'", block)
    
    rname = name_m.group(1) if name_m else '?'
    ricon = icon_m.group(1) if icon_m else '?'
    rrarity = rarity_m.group(1) if rarity_m else 'common'
    results.append((rid, rname, ricon, rrarity))

for r in results:
    print(f'{r[0]}|{r[1]}|{r[2]}|{r[3]}')
print(f'\nTotal: {len(results)}')
