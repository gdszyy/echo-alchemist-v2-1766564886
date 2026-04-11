import os
import re

tasks_dir = '/home/ubuntu/project-repo/tasks'
archive_file = '/home/ubuntu/project-repo/docs/archive/tasks_summary.md'

# Ensure archive dir exists
os.makedirs(os.path.dirname(archive_file), exist_ok=True)

summaries = []

# Regex to extract date
date_regex = re.compile(r'\*\*提交时间\*\*: (.*)')

for task_id in os.listdir(tasks_dir):
    task_path = os.path.join(tasks_dir, task_id)
    readme_path = os.path.join(task_path, 'README.md')
    if os.path.isdir(task_path) and os.path.isfile(readme_path):
        with open(readme_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract time
        time_match = date_regex.search(content)
        submit_time = time_match.group(1) if time_match else 'Unknown'
        
        # Extract summary section
        summary_match = re.search(r'## 结果摘要\n(.*?)(?=\n##|$)', content, re.DOTALL)
        summary = summary_match.group(1).strip() if summary_match else '无摘要'
        
        # Extract deliverables
        deliverables_match = re.search(r'## 交付物\n(.*?)(?=\n##|$)', content, re.DOTALL)
        deliverables = deliverables_match.group(1).strip() if deliverables_match else '无交付物'
        
        summaries.append({
            'id': task_id,
            'time': submit_time,
            'summary': summary,
            'deliverables': deliverables
        })

# Sort by time descending
summaries.sort(key=lambda x: x['time'], reverse=True)

with open(archive_file, 'w', encoding='utf-8') as f:
    f.write('# 历史任务归档 (Tasks Archive)\n\n')
    f.write('本文档汇总了 `tasks/` 目录下所有历史任务的执行记录和交付成果。\n\n')
    
    for s in summaries:
        f.write(f'## 任务: {s["id"]}\n')
        f.write(f'- **提交时间**: {s["time"]}\n')
        f.write(f'- **结果摘要**:\n  {s["summary"]}\n')
        f.write(f'- **主要交付物**:\n')
        
        # format deliverables
        for line in s['deliverables'].split('\n'):
            if line.strip():
                f.write(f'  {line.strip()}\n')
        f.write('\n---\n\n')

print("Archive generated successfully.")
